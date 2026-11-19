#!/usr/bin/env node
/**
 * The publishing step (PUB-01): the only way v4 reaches GitHub Pages, under
 * the owner's advance word of 2026-11-18 (PLAN-6, 2026-11-19), until v4.0.
 *
 * GitHub Pages serves the root docs/ on main. This script, run by
 * .github/workflows/publish.yml, is the only writer of docs/ and the root
 * version.json; the gate (scripts/gate.mjs) refuses either changed by hand.
 *
 *   node scripts/publish.mjs --dry-run [--dist <dir>]
 *       check v4's build (dist/, from npm run build) and say what a publish
 *       would change; change nothing in docs/ or version.json, commit and push
 *       nothing. Anywhere, and the only mode that runs off main.
 *   node scripts/publish.mjs --decide
 *       CI, on main: may this run publish, and which commit? Verify must have
 *       passed and main's v4 must be what it checked; after Verify, only when
 *       something that changes v4 has landed since the last publish.
 *   node scripts/publish.mjs --publish --source <sha> --verified <sha> [--try-file <file>]
 *       CI, on main: put the checked build in docs/, write version.json, commit
 *       both as the Actions bot and push to main, never forced.
 *   node scripts/publish.mjs --take-back <commit or tag>
 *       CI, on main: restore docs/ and version.json from a commit or tag on
 *       main, such as v3.3.726, commit them as the bot and push to main.
 *   node scripts/publish.mjs --watch-pages --commit <sha>
 *       CI: see that Pages builds the pushed commit (asking for a build if
 *       the push started none) and serves its index.html.
 *
 * An unknown, misspelt or repeated flag, a missing value or no mode at all
 * stops before anything is read or written (v3's DEF-71: an unknown flag was
 * taken to mean a release). Every file the site refers to is checked before
 * it is committed (v3's DEF-75, which also missed single-quoted references).
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync, cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAGES, ROOT, STEP, classify, git, isAncestor, lastGreenSha, pathsOfRange, pushedLine } from './gate.mjs';

/** The repository the step publishes, and the address Pages serves it at. */
export const REPOSITORY = 'djDAOjones/route-plotter';
export const ADDRESS = 'https://djdaojones.github.io/route-plotter/';
/** Verify (ci.yml), whose passing push runs on main start the step. */
export const VERIFY = { name: 'Verify', file: 'ci.yml', path: '.github/workflows/ci.yml' };
/** v4's previews are numbered 4.0.0-preview.N, N counting the step's publishes. */
export const VERSION_BASE = '4.0.0-preview';
/** What the step adds beside the build in docs/: no Jekyll run on it, and what is live. */
export const ADDED = ['.nojekyll', 'version.json'];
/** The record line that marks v4.0 declared, when the owner's advance word ends. */
const V40 = /^- V40-01 — /m;
/** The kinds of file a built site may hold; anything else is refused, as v3's inventory check refused it. */
const KINDS = new Set([
  '.html', '.js', '.mjs', '.css', '.map', '.json', '.txt', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif',
  '.ico', '.woff', '.woff2', '.ttf', '.otf', '.webmanifest', '.xml'
]);
const SHA = /^[0-9a-f]{40}$/;

export const USAGE = `Usage, exactly one of:
  node scripts/publish.mjs --dry-run [--dist <dir>]
  node scripts/publish.mjs --decide
  node scripts/publish.mjs --publish --source <sha> --verified <sha> [--try-file <file>]
  node scripts/publish.mjs --take-back <commit or tag>
  node scripts/publish.mjs --watch-pages --commit <sha>`;

export class UsageError extends Error {}

const MODES = ['--dry-run', '--decide', '--publish', '--take-back', '--watch-pages'];
const VALUED = new Set(['--dist', '--source', '--verified', '--try-file', '--commit', '--take-back']);
const GOES_WITH = {
  '--dry-run': ['--dist'], '--decide': [], '--publish': ['--source', '--verified', '--try-file'],
  '--take-back': [], '--watch-pages': ['--commit']
};
const NEEDS = { '--publish': ['--source', '--verified'], '--watch-pages': ['--commit'] };

/**
 * Read the command line strictly: every argument is a known flag, each at most
 * once, a value after each flag that takes one, exactly one mode, and nothing
 * that does not go with it. Throws a UsageError otherwise; never defaults.
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const seen = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!MODES.includes(flag) && !VALUED.has(flag)) throw new UsageError(`unknown argument: ${flag}`);
    if (seen.has(flag)) throw new UsageError(`${flag} is given twice`);
    if (VALUED.has(flag)) {
      const value = argv[i + 1];
      if (value === undefined || value === '' || value.startsWith('-')) throw new UsageError(`${flag} needs a value`);
      seen.set(flag, value);
      i += 1;
    } else {
      seen.set(flag, true);
    }
  }
  const modes = MODES.filter(mode => seen.has(mode));
  if (modes.length === 0) throw new UsageError('say what to do: one mode is required, and none is assumed');
  if (modes.length > 1) throw new UsageError(`one mode at a time, not ${modes.join(' and ')}`);
  const [mode] = modes;
  for (const flag of seen.keys()) {
    if (flag !== mode && !GOES_WITH[mode].includes(flag)) throw new UsageError(`${flag} does not go with ${mode}`);
  }
  for (const flag of NEEDS[mode] ?? []) if (!seen.has(flag)) throw new UsageError(`${mode} needs ${flag}`);
  for (const flag of ['--source', '--verified', '--commit']) {
    if (seen.has(flag) && !SHA.test(seen.get(flag))) throw new UsageError(`${flag} must be a full commit hash`);
  }
  return {
    mode: mode.slice(2),
    dist: seen.get('--dist') ?? 'dist',
    source: seen.get('--source'),
    verified: seen.get('--verified'),
    tryFile: seen.get('--try-file'),
    commit: seen.get('--commit'),
    takeBackTo: mode === '--take-back' ? seen.get('--take-back') : undefined
  };
}

/** Every file under a site folder, as sorted relative paths; a link or anything not a file is refused. */
export function listSite(dir) {
  const files = [];
  const walk = relative => {
    for (const entry of readdirSync(join(dir, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`the site holds a link: ${path}`);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`the site holds something that is not a file: ${path}`);
    }
  };
  walk('');
  return files.sort();
}

const extension = path => {
  const name = path.split('/').pop();
  return name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
};

const ATTRIBUTES = new Set(['src', 'href', 'xlink:href', 'poster', 'data-image', 'srcset', 'action', 'formaction', 'data', 'background', 'manifest']);

/**
 * The references a page or an SVG makes: its tags' src, href, xlink:href,
 * poster, data-image, srcset, action, formaction, data, background and
 * manifest attributes, quoted either way or not at all (a `>` inside quotes
 * does not end a tag); the url()s of its style attributes and <style> blocks;
 * and the imports of its inline scripts. Comments are skipped.
 * @param {string} text
 * @returns {{ markup: string[], scripts: string[] }}
 */
export function markupReferences(text) {
  const markup = [];
  const scripts = [];
  let rest = text.replace(/<!--[\s\S]*?-->/g, '');
  rest = rest.replace(/(<style\b(?:"[^"]*"|'[^']*'|[^>"'])*>)([\s\S]*?)(<\/style\s*>)/gi, (_, open, body, close) => {
    markup.push(...cssReferences(body));
    return `${open}${close}`;
  });
  rest = rest.replace(/(<script\b(?:"[^"]*"|'[^']*'|[^>"'])*>)([\s\S]*?)(<\/script\s*>)/gi, (_, open, body, close) => {
    const { modules, urls } = scriptReferences(body);
    scripts.push(...modules);
    markup.push(...urls);
    return `${open}${close}`;
  });
  const attribute = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  // Attributes are separated by space or by a slash, as browsers read <img/src="x">.
  for (const [, inside] of rest.matchAll(/<[a-zA-Z][\w:-]*((?:[\s/]+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)[\s/]*>/g)) {
    for (const match of inside.matchAll(attribute)) {
      const name = match[1].toLowerCase();
      const value = (match[2] ?? match[3] ?? match[4] ?? '').trim();
      if (name === 'style') markup.push(...cssReferences(value));
      else if (name === 'srcset') markup.push(...value.split(',').map(part => part.trim().split(/\s+/)[0]));
      else if (ATTRIBUTES.has(name)) markup.push(value);
    }
  }
  return { markup: markup.filter(Boolean), scripts: scripts.filter(Boolean) };
}

/** The references an HTML file's tags make (markupReferences, scripts included). */
export const htmlReferences = text => {
  const { markup, scripts } = markupReferences(text);
  return [...markup, ...scripts];
};

/** The references a stylesheet makes: url(...) either way quoted or not, and @import. */
export function cssReferences(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, match => (/sourceMappingURL/.test(match) ? match : ''));
  const found = [];
  for (const match of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)) found.push(match[1] ?? match[2] ?? match[3]);
  for (const match of text.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) found.push(match[1] ?? match[2]);
  return found.filter(Boolean);
}

/**
 * What a script loads by a literal path: modules, by static `import`,
 * `export ... from` and `import()` (a module name, like `react`, has no file a
 * browser could fetch), and URLs, by `new URL(..., import.meta.url)`, which
 * resolve as any URL does. Comments may sit between the words. A path built at
 * run time is not seen: no check that reads text can see it.
 * @param {string} text
 * @returns {{ modules: string[], urls: string[] }}
 */
export function scriptReferences(text) {
  const gap = '(?:\\s|/\\*[\\s\\S]*?\\*/|//[^\\n]*\\n)*';
  const quoted = '(?:"([^"\\n]+)"|\'([^\'\\n]+)\'|`([^`$\\n]+)`)';
  const read = pattern => [...text.matchAll(new RegExp(pattern, 'g'))].map(match => match[1] ?? match[2] ?? match[3]);
  const modules = [
    ...read(`(?:^|[;}\\s)])import${gap}${quoted}`),
    ...read(`(?:^|[;}\\s)])(?:import|export)${gap}(?:[\\w$*{},\\s]|/\\*[\\s\\S]*?\\*/)+?${gap}from${gap}${quoted}`),
    ...read(`(?<![.\\w$])import${gap}\\(${gap}${quoted}${gap}\\)`)
  ];
  const urls = read(`\\bnew${gap}URL${gap}\\(${gap}${quoted}${gap},${gap}import${gap}\\.${gap}meta${gap}\\.${gap}url${gap}\\)`);
  return { modules, urls };
}

/**
 * A script's or stylesheet's source map comment: `//# sourceMappingURL=` on a
 * line of its own, or `/*# sourceMappingURL= *\/`; the same words inside code,
 * such as a pattern that strips such comments, are not one.
 */
export const sourceMapReferences = text => [
  ...[...text.matchAll(/^[ \t]*\/\/[#@][ \t]*sourceMappingURL=(\S+)[ \t]*$/gm)].map(match => match[1]),
  ...[...text.matchAll(/\/\*[#@][ \t]*sourceMappingURL=(\S+?)[ \t]*\*\//g)].map(match => match[1])
];

/**
 * Check a site folder before it is published: every file the site refers to is
 * there, inside it, and nothing loads from another site or from the domain's
 * root (a project site lives under /route-plotter/). A build (not a restored
 * release) also holds only the kinds of file a site serves, no hidden file but
 * the step's own .nojekyll, and no project archive. Throws naming every problem.
 * @param {string} dir
 * @param {{ build?: boolean }} [options]
 * @returns {{ files: string[], references: string[] }}
 */
export function checkSite(dir, { build = true } = {}) {
  const problems = [];
  let files;
  try {
    files = listSite(dir);
  } catch (error) {
    throw new Error(`site check: ${error.message}`);
  }
  const present = new Set(files);
  if (!present.has('index.html')) problems.push('there is no index.html');
  if (build) {
    for (const file of files) {
      const name = file.split('/').pop();
      if (name.startsWith('.') && file !== '.nojekyll') problems.push(`a hidden file: ${file}`);
      else if (!name.startsWith('.') && !KINDS.has(extension(file))) problems.push(`a kind of file a site does not serve: ${file}`);
    }
  }
  const references = [];
  for (const file of files) {
    const kind = extension(file);
    if (!['.html', '.svg', '.css', '.js', '.mjs'].includes(kind)) continue;
    const text = readFileSync(join(dir, file), 'utf8');
    let found = [];
    let modules = [];
    if (kind === '.html' || kind === '.svg') ({ markup: found, scripts: modules } = markupReferences(text));
    else if (kind === '.css') found = cssReferences(text);
    else ({ modules, urls: found } = scriptReferences(text));
    if (kind === '.css' || kind === '.js' || kind === '.mjs') found.push(...sourceMapReferences(text));
    for (const name of modules) {
      // A bare module name, such as react, has no file a browser could fetch.
      if (/^(?:\.{1,2}\/|\/|[a-z][a-z0-9+.-]*:)/i.test(name)) found.push(name);
      else problems.push(`${file} imports ${name} by name, which a browser cannot fetch`);
    }
    for (const reference of found) {
      if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(reference)) {
        problems.push(`${file} loads from another site: ${reference}`);
        continue;
      }
      if (reference.startsWith('#') || /^(?:data|blob|mailto|tel|about):/i.test(reference)) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) {
        problems.push(`${file} refers to ${reference}`);
        continue;
      }
      let bare;
      try {
        bare = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
      } catch {
        problems.push(`${file} refers to a path that cannot be read: ${reference}`);
        continue;
      }
      if (!bare) continue;
      if (bare.startsWith('/')) {
        problems.push(`${file} refers to the domain's root, outside the project site: ${reference}`);
        continue;
      }
      const target = posix.normalize(posix.join(posix.dirname(file), bare));
      if (target === '..' || target.startsWith('../')) problems.push(`${file} refers outside the site: ${reference}`);
      else if (!present.has(target) && !present.has(posix.join(target, 'index.html'))) {
        problems.push(`${file} refers to a missing file: ${reference}`);
      } else references.push(target);
    }
  }
  if (problems.length) throw new Error(`site check: ${problems.join('; ')}`);
  return { files, references: [...new Set(references)].sort() };
}

/** Whether two site folders hold the same build, byte for byte, beside what the step adds. */
export function sameBuild(a, b) {
  if (!existsSync(join(a, 'index.html')) || !existsSync(join(b, 'index.html'))) return false;
  const built = dir => listSite(dir).filter(file => !ADDED.includes(file));
  const left = built(a);
  const right = built(b);
  if (left.join('\n') !== right.join('\n')) return false;
  return left.every(file => readFileSync(join(a, file)).equals(readFileSync(join(b, file))));
}

/**
 * The step's commits reachable from a revision, newest first, with their
 * trailers: they carry STEP's trailer and are made and committed by the bot.
 * @returns {{ sha: string, preview?: number, source?: string, restored?: string }[]}
 */
export function stepHistory(cwd = ROOT, revision = 'HEAD') {
  const log = git(['log', '--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e', revision], cwd);
  if (log === null) return [];
  const commits = [];
  for (const entry of log.split('\x1e')) {
    const [sha, authorName, authorEmail, committerName, committerEmail, body = ''] = entry.replace(/^\s+/, '').split('\x1f');
    if (!SHA.test(sha ?? '')) continue;
    if (authorName !== STEP.name || committerName !== STEP.name || authorEmail !== STEP.email || committerEmail !== STEP.email) continue;
    const lines = body.split('\n');
    if (!lines.some(line => line.startsWith(STEP.trailer))) continue;
    const trailer = key => lines.find(line => line.startsWith(`${key}: `))?.slice(key.length + 2).trim();
    const preview = Number.parseInt(trailer('Preview') ?? '', 10);
    commits.push({ sha, preview: Number.isFinite(preview) ? preview : undefined, source: trailer('Source'),
      restored: trailer('Restored-from') });
  }
  return commits;
}

/** The next preview's number: one more than any the step has published, take-backs between them or not. */
export const nextPreview = history => 1 + Math.max(0, ...history.map(commit => commit.preview ?? 0));

const ITEM_LINE = /^- [A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*(?:\.\d+)? — /;
const shortLine = line => line.slice(2).replace(/ — see decisions\s*$/, '').trim();

/**
 * What is new: the trajectory's item lines that `after` holds and `before`
 * did not; with no earlier publish, the current phase's lines. At most `limit`,
 * the newest kept, and a count of the rest.
 * @param {string|null} before the trajectory at the last published source, or null
 * @param {string} after the trajectory at the source being published
 */
export function whatIsNew(before, after, limit = 8) {
  const lines = after.split('\n');
  let picked;
  if (before === null) {
    const start = lines.findIndex(line => line.startsWith('## '));
    const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
    picked = lines.slice(start + 1, end === -1 ? undefined : end).filter(line => ITEM_LINE.test(line));
  } else {
    const known = new Set(before.split('\n'));
    picked = lines.filter(line => ITEM_LINE.test(line) && !known.has(line));
  }
  const items = picked.map(shortLine);
  if (items.length <= limit) return items.length ? items : ['No item has shipped since the last publish.'];
  return [...items.slice(-limit), `And ${items.length - limit} earlier item(s).`];
}

/** The "What to try" section of a pull request's description, as lines; empty when there is none. */
export function prSection(body) {
  const lines = (body ?? '').replace(/\r/g, '').split('\n');
  const start = lines.findIndex(line => /^#{1,6}\s*What to try\s*:?\s*$/i.test(line.trim()));
  if (start === -1) return [];
  const end = lines.findIndex((line, index) => index > start && /^#{1,6}\s/.test(line.trim()));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim().split('\n').filter(line => line.trim());
}

/** What to try, from free text: one item a line, bullets removed, at most five; a plain default otherwise. */
export function whatToTry(text) {
  const items = (text ?? '').replace(/\r/g, '').split('\n')
    .map(line => line.trim().replace(/^[-*•]\s*/, '').trim()).filter(Boolean).slice(0, 5);
  return items.length ? items : [`Open ${ADDRESS} and check that the page loads and says what this preview holds.`];
}

/** The record of what is live: the root version.json, and docs/version.json, which the site serves. */
export function versionRecord({ preview, source, published, whatIsNew: added, whatToTry: tries }) {
  return `${JSON.stringify({
    app: 'Route Plotter', version: `${VERSION_BASE}.${preview}`, preview, source, published, address: ADDRESS,
    whatIsNew: added, whatToTry: tries
  }, null, 2)}\n`;
}

/** Whether v4.0 has been declared, which ends the owner's advance word (PUB-01's criteria). */
export function v40Declared(cwd = ROOT, revision = 'HEAD') {
  const trajectory = git(['show', `${revision}:project/trajectory.md`], cwd) ?? '';
  return V40.test(trajectory);
}

const run = (command, args, cwd, env = process.env) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env, maxBuffer: 64 << 20 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
};

/** Git as the Actions bot, so the gate knows the step's commits. */
const BOT = env => ({ ...env, GIT_AUTHOR_NAME: STEP.name, GIT_AUTHOR_EMAIL: STEP.email,
  GIT_COMMITTER_NAME: STEP.name, GIT_COMMITTER_EMAIL: STEP.email });

/**
 * A publish or a take-back writes only from CI, on main of this repository,
 * on a clean checkout of main's tip; anything else is refused before a write.
 */
export function requireMain(env, cwd = ROOT) {
  const problems = [];
  if (env.GITHUB_ACTIONS !== 'true') problems.push('it runs only in GitHub Actions (publish.yml)');
  if (env.GITHUB_REF !== 'refs/heads/main') problems.push(`it runs only on main, not ${env.GITHUB_REF ?? 'an unknown ref'}`);
  if (env.GITHUB_REPOSITORY !== REPOSITORY) problems.push(`it publishes ${REPOSITORY} only`);
  const head = git(['rev-parse', 'HEAD'], cwd)?.trim();
  const main = git(['rev-parse', 'refs/remotes/origin/main'], cwd)?.trim();
  if (!head || head !== main) problems.push("the checkout is not main's tip");
  if (git(['status', '--porcelain', '--untracked-files=all'], cwd) !== '') problems.push('the checkout is not clean');
  if (problems.length) throw new Error(`refused: ${problems.join('; ')}`);
  return head;
}

const short = sha => sha.slice(0, 7);
const runLine = env => `publish.yml run ${env.GITHUB_RUN_ID ?? 'local'}, attempt ${env.GITHUB_RUN_ATTEMPT ?? '1'}`;

/** Commit exactly the site, as the bot, refusing if anything else is staged; returns the commit. */
function commitSite(cwd, message, env) {
  run('git', ['add', '-A', '--', ...PAGES.files, ...PAGES.dirs], cwd);
  const staged = run('git', ['diff', '--cached', '--name-only', '-z'], cwd).split('\0').filter(Boolean);
  const stray = staged.filter(path => classify(path) !== 'pages');
  if (stray.length) throw new Error(`refused: something besides the site is staged: ${stray.join(', ')}`);
  const folder = mkdtempSync(join(tmpdir(), 'pub-01-message-'));
  writeFileSync(join(folder, 'message.txt'), message);
  try {
    run('git', ['-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-F', join(folder, 'message.txt')], cwd, BOT(env));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  return run('git', ['rev-parse', 'HEAD'], cwd).trim();
}

/** Put the site back as HEAD has it, after a refused write. */
function restoreSite(cwd) {
  spawnSync('git', ['reset', '-q', '--', ...PAGES.files, ...PAGES.dirs], { cwd });
  spawnSync('git', ['checkout', '-q', 'HEAD', '--', ...PAGES.files, ...PAGES.dirs], { cwd });
  spawnSync('git', ['clean', '-q', '-f', '-d', '--', ...PAGES.dirs], { cwd });
}

/** How many times the step writes and pushes before it gives up on a moving main. */
export const PUSH_TRIES = 3;

/**
 * Write the site, commit it as the bot and push it to main, never forced. When
 * the push is refused because main has moved on, fetch main and, if `still`
 * finds nothing against it, write again on its new tip, up to PUSH_TRIES
 * times; so a record-only merge landing during a build does not leave an app
 * change unpublished (Codex's review). Any other refusal stops at once.
 * @param {{ cwd: string, env: object, write: () => { changed: boolean, said: string, message?: string },
 *   still: (tip: string) => string|null, beforePush?: (attempt: number) => void }} options
 */
function commitAndPush({ cwd, env, write, still, beforePush = () => {} }) {
  for (let attempt = 1; attempt <= PUSH_TRIES; attempt += 1) {
    if (attempt > 1) {
      run('git', ['fetch', '-q', 'origin', '+refs/heads/main:refs/remotes/origin/main'], cwd);
      const tip = run('git', ['rev-parse', 'refs/remotes/origin/main'], cwd).trim();
      const stop = still(tip);
      if (stop) return { changed: false, said: stop };
      run('git', ['reset', '-q', '--hard', tip], cwd);
    }
    const base = run('git', ['rev-parse', 'HEAD'], cwd).trim();
    const done = write();
    if (!done.changed) return done;
    const commit = commitSite(cwd, done.message, env);
    beforePush(attempt);
    const pushed = spawnSync('git', ['push', '-q', 'origin', 'HEAD:refs/heads/main'], { cwd, encoding: 'utf8' });
    if (pushed.status === 0) {
      // The gate reads this line from the job's log, to know the commit as this run's (scripts/gate.mjs).
      console.log(pushedLine(commit));
      return { changed: true, commit, said: `${done.said} Pushed ${short(commit)} to main${attempt > 1 ? `, at try ${attempt} of ${PUSH_TRIES}, main having moved on` : ''}.` };
    }
    // Not pushed: the checkout lets go of the commit, so it never holds a step commit main lacks.
    run('git', ['reset', '-q', '--hard', base], cwd);
    if (!/\b(?:fetch first|non-fast-forward|rejected)\b/.test(`${pushed.stderr}${pushed.stdout}`)) {
      throw new Error(`the push to main failed: ${pushed.stderr || pushed.stdout}`);
    }
  }
  throw new Error(`main kept moving while the step wrote: nothing was pushed after ${PUSH_TRIES} tries`);
}

/** The notes for a publish of `source`: what is new since the last published source, and what to try. */
export function notesFor(cwd, source, tryText) {
  const history = stepHistory(cwd, source);
  const previous = history.find(commit => commit.source && SHA.test(commit.source))?.source;
  const read = revision => git(['show', `${revision}:project/trajectory.md`], cwd);
  return {
    whatIsNew: whatIsNew(previous ? read(previous) ?? '' : null, read(source) ?? ''),
    whatToTry: whatToTry(tryText)
  };
}

const V40_REFUSAL = "refused: v4.0 is declared, which ends the owner's advance word; the site changes only on his word";

/**
 * The publish: the checked build into docs/, the record into version.json and
 * docs/version.json, one commit by the bot, pushed to main. Nothing is
 * written when the build equals what docs/ holds, or when any check fails.
 * @returns {{ changed: boolean, commit?: string, preview?: number, said: string }}
 */
export function publish({ cwd = ROOT, dist = 'dist', source, verified, tryText = '', env = process.env,
  now = () => new Date(), beforePush }) {
  const head = requireMain(env, cwd);
  if (head !== source) throw new Error(`refused: main's tip is ${short(head)}, not the source ${short(source)} it was decided for`);
  const built = join(cwd, dist);
  const docs = join(cwd, 'docs');
  let preview;
  const write = () => {
    if (v40Declared(cwd)) throw new Error(V40_REFUSAL);
    checkSite(built);
    if (sameBuild(built, docs)) return { changed: false, said: 'Nothing new: the build is what docs/ already holds.' };
    preview = nextPreview(stepHistory(cwd));
    const notes = notesFor(cwd, source, tryText);
    const record = versionRecord({ preview, source, published: now().toISOString().replace(/\.\d{3}Z$/, 'Z'), ...notes });
    try {
      rmSync(docs, { recursive: true, force: true });
      cpSync(built, docs, { recursive: true });
      writeFileSync(join(docs, '.nojekyll'), '');
      writeFileSync(join(docs, 'version.json'), record);
      writeFileSync(join(cwd, 'version.json'), record);
      checkSite(docs);
    } catch (error) {
      restoreSite(cwd);
      throw error;
    }
    const version = `${VERSION_BASE}.${preview}`;
    const message = [
      `PUB-01: publish v4 ${version}, built from ${short(source)}`,
      '',
      'What is new:',
      ...notes.whatIsNew.map(line => `- ${line}`),
      '',
      'What to try:',
      ...notes.whatToTry.map(line => `- ${line}`),
      '',
      `Verify: Verify passed on ${short(verified)} and main's v4 at ${short(source)} is the v4 it checked; ` +
        `built by ${runLine(env)}; every file the site refers to is present and inside it, none from another site`,
      `${STEP.trailer} ${runLine(env)}`,
      `Source: ${source}`,
      `Verified: ${verified}`,
      `Preview: ${preview}`,
      ''
    ].join('\n');
    return { changed: true, message, said: `Committed v4 ${version}, from ${short(source)}.` };
  };
  // On a retry, main's new tip must hold the same v4 as the source the build came from.
  const still = tip => {
    const between = pathsOfRange([source, tip], cwd);
    const moved = between === null ? ['(unreadable)'] : between.filter(path => !['record', 'v3', 'pages'].includes(classify(path)));
    return moved.length ? `Main moved on with a change of its own (${moved.slice(0, 3).join(', ')}); its own run publishes it.` : null;
  };
  try {
    const done = commitAndPush({ cwd, env, write, still, beforePush });
    return done.changed ? { ...done, preview } : done;
  } catch (error) {
    restoreSite(cwd);
    throw error;
  }
}

/**
 * The take-back: docs/ and version.json as a commit or tag on main had them,
 * such as v3.3.726, committed by the bot and pushed to main. Refused for
 * anything not on main, and once v4.0 is declared.
 * @returns {{ changed: boolean, commit?: string, said: string }}
 */
export function takeBack({ cwd = ROOT, to, env = process.env, beforePush }) {
  requireMain(env, cwd);
  if (v40Declared(cwd)) throw new Error(V40_REFUSAL);
  const target = git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${to}^{commit}`], cwd)?.trim();
  if (!target || !SHA.test(target)) throw new Error(`refused: ${to} names no commit`);
  if (git(['merge-base', '--is-ancestor', target, 'HEAD'], cwd) === null) {
    throw new Error(`refused: ${to} (${short(target)}) is not on main, so it was never reviewed and published there`);
  }
  for (const path of ['docs/index.html', 'version.json']) {
    if (git(['cat-file', '-e', `${target}:${path}`], cwd) === null) throw new Error(`refused: ${to} has no ${path}`);
  }
  const write = () => {
    if (v40Declared(cwd)) throw new Error(V40_REFUSAL);
    if (git(['diff', '--quiet', target, 'HEAD', '--', ...PAGES.files, ...PAGES.dirs], cwd) !== null) {
      return { changed: false, said: `Nothing to take back: the site is already as ${to} has it.` };
    }
    try {
      run('git', ['rm', '-r', '-q', '--ignore-unmatch', '--', 'docs'], cwd);
      rmSync(join(cwd, 'docs'), { recursive: true, force: true });
      run('git', ['checkout', target, '--', ...PAGES.files, ...PAGES.dirs], cwd);
      checkSite(join(cwd, 'docs'), { build: false });
    } catch (error) {
      restoreSite(cwd);
      throw error;
    }
    const message = [
      `PUB-01: take the site back to ${to} (${short(target)})`,
      '',
      `Verify: docs/ and version.json restored byte for byte from ${short(target)}, which is on main; ` +
        `every file the site refers to is present and inside it; by ${runLine(env)}`,
      `${STEP.trailer} ${runLine(env)} (take-back)`,
      `Restored-from: ${target}`,
      ''
    ].join('\n');
    return { changed: true, message, said: `Committed the site as ${to} (${short(target)}) had it.` };
  };
  try {
    return commitAndPush({ cwd, env, write, still: () => null, beforePush });
  } catch (error) {
    restoreSite(cwd);
    throw error;
  }
}

/** A GitHub API call with the run's token; null when it fails. */
async function api(env, fetchImpl, path, { method = 'GET' } = {}) {
  const base = env.GITHUB_API_URL ?? 'https://api.github.com';
  if (!env.GITHUB_TOKEN) return null;
  try {
    const response = await fetchImpl(`${base}${path}`, { method, headers: {
      accept: 'application/vnd.github+json', authorization: `Bearer ${env.GITHUB_TOKEN}`
    } });
    if (!response.ok) return null;
    return response.status === 204 ? {} : await response.json();
  } catch {
    return null;
  }
}

/** Paths that change what v4's build holds: v4's own and anything unplaced. */
const APP = path => !['record', 'v3', 'pages'].includes(classify(path));

/**
 * "What to try", from the pull requests merged since the last publish, newest
 * first: the first "What to try" section found, among at most five.
 */
async function tryFromPulls(env, fetchImpl, cwd, from, to) {
  const commits = (git(['rev-list', '--first-parent', '--max-count=5', from ? `${from}..${to}` : to], cwd) ?? '').split('\n').filter(Boolean);
  for (const sha of commits) {
    const pulls = await api(env, fetchImpl, `/repos/${REPOSITORY}/commits/${sha}/pulls`);
    const pull = Array.isArray(pulls) ? pulls.find(item => item.merge_commit_sha === sha) ?? pulls[0] : null;
    const lines = prSection(pull?.body);
    if (lines.length) return lines.join('\n');
  }
  return '';
}

/**
 * May this run publish, and what? The gate must be green: Verify passed on a
 * commit of main (the run that started this one, or main's newest passing run
 * when started by hand), and main's tip holds the same v4 (every path between
 * them is record, v3 or the site). After Verify, the step publishes when
 * something that changes v4's build has landed since the last publish's
 * source, so a record-only or v3-only merge publishes nothing, and a change
 * whose own publish was queued out or failed is published by the next run
 * (Codex's review). By hand on main it publishes at any point.
 * @returns {Promise<{ publish: boolean, reason: string, source?: string, verified?: string, tryText?: string }>}
 */
export async function decide({ env, event = {}, cwd = ROOT, fetchImpl = globalThis.fetch }) {
  const no = reason => ({ publish: false, reason });
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_REPOSITORY !== REPOSITORY) return no('only main of this repository publishes');
  const tip = git(['rev-parse', 'refs/remotes/origin/main'], cwd)?.trim();
  if (!tip || git(['rev-parse', 'HEAD'], cwd)?.trim() !== tip) return no("the checkout is not main's tip");
  if (v40Declared(cwd)) return no("v4.0 is declared, which ends the owner's advance word: nothing publishes without his word");

  let verified;
  const byHand = env.GITHUB_EVENT_NAME === 'workflow_dispatch';
  if (env.GITHUB_EVENT_NAME === 'workflow_run') {
    const ran = event.workflow_run ?? {};
    if (ran.name !== VERIFY.name || ran.path !== VERIFY.path) return no('the run that started this is not Verify');
    if (ran.event !== 'push' || ran.head_branch !== 'main' || ran.head_repository?.full_name !== REPOSITORY) {
      return no('only a push to main of this repository publishes');
    }
    if (ran.conclusion !== 'success') return no(`Verify did not pass (${ran.conclusion})`);
    if (!SHA.test(ran.head_sha ?? '')) return no('the run names no commit');
    verified = ran.head_sha;
  } else if (byHand) {
    verified = await lastGreenSha({ ...env, DEFAULT_BRANCH: 'main', GITHUB_WORKFLOW_REF: `${REPOSITORY}/${VERIFY.path}@refs/heads/main` },
      fetchImpl, sha => isAncestor(sha, tip, cwd));
    if (!verified) return no("main's newest passing Verify run could not be read");
  } else {
    return no(`a ${env.GITHUB_EVENT_NAME ?? 'unknown'} event never publishes`);
  }

  if (!isAncestor(verified, tip, cwd)) return no(`${short(verified)} is not on main`);
  const between = pathsOfRange([verified, tip], cwd);
  if (between === null) return no(`what changed between ${short(verified)} and main's tip could not be read`);
  const moved = between.filter(APP);
  if (moved.length) {
    return no(`main has moved on from ${short(verified)} with a change of its own (${moved.slice(0, 3).join(', ')}); its own run publishes it`);
  }

  // The last publish's source: what the live v4 was built from (a take-back leaves it, so v3 stays until v4 changes).
  const last = stepHistory(cwd, tip).find(commit => commit.source && SHA.test(commit.source) && isAncestor(commit.source, tip, cwd))?.source;
  if (!byHand && last && isAncestor(last, verified, cwd)) {
    const since = pathsOfRange([last, verified], cwd);
    if (since !== null && !since.some(APP)) {
      return no(`nothing that changes v4 has landed since the last publish's source ${short(last)}: a record-only or v3-only change publishes nothing`);
    }
  }
  const tryText = byHand && env.WHAT_TO_TRY?.trim() ? env.WHAT_TO_TRY : await tryFromPulls(env, fetchImpl, cwd, last, verified);
  return { publish: true, source: tip, verified, tryText,
    reason: `Verify passed on ${short(verified)}, main's tip ${short(tip)} holds the same v4, ` +
      (byHand ? 'and the step was run by hand' : last ? `and v4 has changed since the last publish's source ${short(last)}` : 'and v4 has never been published') };
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/**
 * Whether a commit Pages built serves the same site as ours: ours itself, or a
 * later commit on main whose docs/ is ours byte for byte (a record-only merge
 * may land before Pages builds). 'later' when a later commit on main serves a
 * different site: a newer publish or take-back replaced ours.
 * @returns {'same'|'later'|'other'}
 */
export function servesOurs(commit, built, cwd = ROOT) {
  if (built === commit) return 'same';
  if (!SHA.test(built ?? '')) return 'other';
  if (git(['cat-file', '-e', `${built}^{commit}`], cwd) === null) {
    spawnSync('git', ['fetch', '-q', 'origin', '+refs/heads/main:refs/remotes/origin/main'], { cwd });
  }
  if (!isAncestor(commit, built, cwd)) return 'other';
  return git(['diff', '--quiet', commit, built, '--', ...PAGES.dirs], cwd) !== null ? 'same' : 'later';
}

/**
 * See Pages build the pushed commit and serve it: whether the push itself
 * started a build is observed, not assumed, and if none starts within two
 * minutes one is asked for. Then the address must serve the commit's
 * index.html, byte for byte.
 * @returns {Promise<{ ok: boolean, started: 'by the push'|'on request'|'never', said: string[] }>}
 */
export async function watchPages({ commit, env, cwd = ROOT, fetchImpl = globalThis.fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now, limitMs = 15 * 60_000, askAfterMs = 120_000 }) {
  const said = [];
  const expected = sha256(Buffer.from(run('git', ['show', `${commit}:docs/index.html`], cwd)));
  const started = now();
  let how = 'never';
  let asked = false;
  let built = false;
  while (now() - started < limitMs) {
    const latest = await api(env, fetchImpl, `/repos/${REPOSITORY}/pages/builds/latest`);
    const serves = latest ? servesOurs(commit, latest.commit, cwd) : 'other';
    if (serves === 'later') {
      said.push(`A later commit on main, ${short(latest.commit)}, replaced this site before Pages served it; nothing more to watch.`);
      return { ok: true, started: how, said };
    }
    if (serves === 'same') {
      if (how === 'never') how = asked ? 'on request' : 'by the push';
      if (latest.status === 'built') { built = true; break; }
      if (latest.status === 'errored') {
        said.push(`Pages could not build ${short(latest.commit)}: ${latest.error?.message ?? 'no reason given'}`);
        return { ok: false, started: how, said };
      }
    } else if (!asked && now() - started >= askAfterMs) {
      asked = Boolean(await api(env, fetchImpl, `/repos/${REPOSITORY}/pages/builds`, { method: 'POST' }));
      said.push(asked ? 'The push started no Pages build within two minutes, so one was requested.'
        : 'The push started no Pages build within two minutes, and asking for one failed.');
    }
    await sleep(15_000);
  }
  said.push(built ? `Pages built ${short(commit)}'s site; the build was started ${how}.`
    : `Pages did not report building ${short(commit)}'s site in time (started: ${how}).`);
  if (!built) return { ok: false, started: how, said };
  while (now() - started < limitMs) {
    try {
      const response = await fetchImpl(`${ADDRESS}index.html?publish=${commit}`, { headers: { 'cache-control': 'no-cache' } });
      if (response.ok && sha256(Buffer.from(await response.arrayBuffer())) === expected) {
        said.push(`${ADDRESS} serves ${short(commit)}'s index.html (sha256 ${expected}).`);
        return { ok: true, started: how, said };
      }
    } catch { /* try again */ }
    await sleep(15_000);
  }
  said.push(`${ADDRESS} did not serve ${short(commit)}'s index.html in time.`);
  return { ok: false, started: how, said };
}

/** Lines for the run's summary, and named outputs for the next steps. */
function report(env, lines, outputs = {}) {
  for (const line of lines) console.log(line);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${lines.map(line => `- ${line}`).join('\n')}\n`);
  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
  }
}

/**
 * The command line. Exported so a test can run it.
 * @returns {Promise<number>} 0 done, 1 refused or failed, 2 not understood
 */
export async function main(argv, env = process.env, { cwd = ROOT } = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(`publish: ${error.message}; nothing was read or written.\n\n${USAGE}`);
    return 2;
  }
  try {
    if (args.mode === 'dry-run') {
      const built = join(cwd, args.dist);
      const { files, references } = checkSite(built);
      const history = stepHistory(cwd);
      const notes = notesFor(cwd, 'HEAD', '');
      const same = sameBuild(built, join(cwd, 'docs'));
      report(env, [
        `Dry run: docs/ and version.json are left as they are, and nothing is committed or pushed${env.GITHUB_REF && env.GITHUB_REF !== 'refs/heads/main' ? ` (on ${env.GITHUB_REF}, a dry run is all that runs)` : ''}.`,
        `The build checks out: ${files.length} files, ${references.length} referred to, every one present and inside the site.`,
        same ? 'A publish now would change nothing: docs/ already holds this build.'
          : `A publish now would put this build in docs/ as v4 ${VERSION_BASE}.${nextPreview(history)}.`,
        `What is new: ${notes.whatIsNew.join(' | ')}`
      ]);
      return 0;
    }
    if (args.mode === 'decide') {
      let event = {};
      try { event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')); } catch { /* no event: decided as such */ }
      const decided = await decide({ env, event, cwd });
      const tryFile = join(env.RUNNER_TEMP ?? tmpdir(), 'pub-01-what-to-try.txt');
      writeFileSync(tryFile, decided.tryText ?? '');
      report(env, [`${decided.publish ? 'Publish' : 'Nothing to publish'}: ${decided.reason}.`], {
        publish: decided.publish, source: decided.source ?? '', verified: decided.verified ?? '', try_file: tryFile
      });
      return 0;
    }
    if (args.mode === 'publish') {
      const tryText = args.tryFile && existsSync(args.tryFile) ? readFileSync(args.tryFile, 'utf8') : '';
      const done = publish({ cwd, dist: args.dist, source: args.source, verified: args.verified, tryText, env });
      report(env, [done.said], { changed: done.changed, commit: done.commit ?? '', preview: done.preview ?? '' });
      return 0;
    }
    if (args.mode === 'take-back') {
      const done = takeBack({ cwd, to: args.takeBackTo, env });
      report(env, [done.said], { changed: done.changed, commit: done.commit ?? '' });
      return 0;
    }
    const watched = await watchPages({ commit: args.commit, env, cwd });
    report(env, watched.said, { pages_started: watched.started });
    return watched.ok ? 0 : 1;
  } catch (error) {
    console.error(`publish: ${error.message}`);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `- Refused or failed: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2), process.env);
}
