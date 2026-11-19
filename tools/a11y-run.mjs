#!/usr/bin/env node
// V31-A11Y stage 3: the standard command behind `npm run a11y` — Playwright, then the report tool in gate mode. It
// validates the project's declarations (tests/a11y/project.mjs), makes a run folder outside the checkout and writes
// run.json there: the date, the tested tree (the working tree with untracked files, hashed through a temporary index
// and object folder, so the checkout's own index and objects are untouched), the coverage file's level, the tools'
// installed versions and the declared states and journeys. It runs the lint step into methods/lint.json with the
// credits eslint.a11y.mjs names, then the installed Playwright CLI, then always the report tool with --gate. It writes
// nothing in the checkout, installs nothing and reaches no network; a missing browser reads blocked, never a download.
// Usage: node tools/a11y-run.mjs [--root <dir>] [--known-bad <page>] [--date YYYY-MM-DD] [--grep <pattern>]
//   --grep narrows the run to matching tests, for diagnosis; a narrowed run never exits 0.
// Exit: 0 the gate's policy holds; 1 a failure, an empty suite, a blocked standard method, or a test failure the
//   report did not record; 2 invalid declarations or input, a run that errored, or a crash here, in Playwright or in
//   the report.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export class InputError extends Error {}
const NAME = /^[a-z0-9][a-z0-9-]*$/;
const SPECS = 'tests/a11y';
const firstLine = (s) => String(s ?? '').split('\n').map((l) => l.trim()).find(Boolean) || '';
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const rel = (s) => typeof s === 'string' && s.trim() && !isAbsolute(s) && !s.split(/[\\/]/).includes('..');
const inside = (child, parent) => { const r = relative(parent, child); return r === '' || (!r.startsWith('..') && !isAbsolute(r)); };
const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

// The environment every child gets: the caller's, without Git's variables (a hook's GIT_DIR would redirect Git).
export function childEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !k.startsWith('GIT_') && !k.startsWith('A11Y_')));
}

export function parseArgs(argv) {
  // Nothing passes through to Playwright but a test filter: its configuration, output and reporters stay the pack's.
  const o = { root: process.cwd(), knownBad: null, date: null, grep: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--root' && v) { o.root = resolve(v); i++; } else if (a === '--known-bad' && v) { o.knownBad = v; i++; } else if (a === '--date' && v) { o.date = v; i++; } else if (a === '--grep' && v) { o.grep = v; i++; } else throw new InputError(`unknown or incomplete option ${a}`);
  }
  if (o.date !== null && !(/^\d{4}-\d{2}-\d{2}$/.test(o.date) && new Date(o.date).toISOString().slice(0, 10) === o.date)) throw new InputError(`--date takes a real YYYY-MM-DD date, not ${o.date}`);
  return o;
}

const rowsOf = (r) => r === '*' ? '*' : [r].flat().join(' ').split(/\s+/).filter(Boolean);
// The declarations' shape, checked before anything runs: a declared journey with no implementation, a row a journey
// cannot claim or a duplicate name stops the run, so nothing declared is silently left out of the run.
export function declarations(project, cat) {
  if (!isObj(project)) throw new InputError('tests/a11y/project.mjs must export a default object');
  const names = new Set(), seen = (n, what) => { if (typeof n !== 'string' || !NAME.test(n)) throw new InputError(`${what}: name ${JSON.stringify(n)} must be lower-case letters, digits and hyphens`); if (names.has(n)) throw new InputError(`${what}: the name ${n} is declared twice`); names.add(n); };
  if (!Array.isArray(project.states)) throw new InputError('project.mjs: states must be a list');
  if (project.baseURL !== undefined && !(typeof project.baseURL === 'string' && /^https?:\/\//.test(project.baseURL))) throw new InputError('project.mjs: baseURL must be an http(s) URL');
  if (!(project.server === undefined || project.server === null || (isObj(project.server) && typeof project.server.command === 'string' && typeof project.server.url === 'string'))) throw new InputError('project.mjs: server must be null or { command, url }');
  if (!(project.lint === undefined || (Array.isArray(project.lint) && project.lint.every((p) => rel(p) && !p.startsWith('-'))))) throw new InputError('project.mjs: lint must list paths inside the project');
  if (project.houseTarget !== undefined && !(Number.isFinite(project.houseTarget) && project.houseTarget > 0)) throw new InputError('project.mjs: houseTarget must be a size in CSS px');
  const states = new Set();
  for (const s of project.states) {
    if (!isObj(s)) throw new InputError('project.mjs: each state must be an object');
    seen(s.name, 'state'); states.add(s.name);
    if (typeof s.path !== 'string' || !s.path) throw new InputError(`state ${s.name}: path is required`);
    if (s.setup !== undefined && typeof s.setup !== 'function') throw new InputError(`state ${s.name}: setup must be a function`);
    if (s.snapshot !== undefined && typeof s.snapshot !== 'string') throw new InputError(`state ${s.name}: snapshot must be the reviewed ARIA snapshot text`);
    for (const d of s.dialogs ?? []) if (!isObj(d) || typeof d.name !== 'string' || typeof d.opener !== 'string') throw new InputError(`state ${s.name}: each dialog needs a name and an opener selector`);
    if (!(s.interactions === undefined || (Array.isArray(s.interactions) && s.interactions.every((i) => isObj(i) && text(i.name) && typeof i.run === 'function' && (i.snapshot === undefined || text(i.snapshot)))))) throw new InputError(`state ${s.name}: interactions must list { name, run, snapshot? } with a run function`);
    const k = s.keeps, selectors = (v) => v === undefined || (Array.isArray(v) && v.every(text));
    if (k !== undefined && !(isObj(k) && selectors(k.content) && selectors(k.cues) && (k.functions === undefined || (Array.isArray(k.functions) && k.functions.every((fn) => isObj(fn) && text(fn.name) && typeof fn.run === 'function'))))) throw new InputError(`state ${s.name}: keeps must be { content?: [selectors], cues?: [selectors], functions?: [{ name, run }] }`);
  }
  const journeys = [];
  for (const f of project.keyboardFunctions ?? []) {
    seen(f?.name, 'keyboard function'); journeys.push(f.name);
    if (!states.has(f.state)) throw new InputError(`keyboard function ${f.name}: state ${f.state} is not declared`);
    if (!Array.isArray(f.steps) || !f.steps.length || typeof f.check !== 'function') throw new InputError(`keyboard function ${f.name}: steps and a check function are required`);
  }
  for (const j of project.journeys ?? []) {
    seen(j?.name, 'journey'); journeys.push(j.name);
    if (!cat.methods[j.method] || !(j.method.startsWith('j-') || j.method === 'keyboard')) throw new InputError(`journey ${j.name}: method ${j.method} is not a journey method or keyboard`);
    if (typeof j.run !== 'function') throw new InputError(`journey ${j.name}: run is not written`);
    const ids = rowsOf(j.rows);
    if (ids !== '*') {
      if (!ids.length) throw new InputError(`journey ${j.name}: name the rows it claims, or *`);
      for (const id of ids) if (!cat.rows.some((r) => r.id === id && r.methods.standard.some((m) => m.method === j.method))) throw new InputError(`journey ${j.name}: row ${id} does not list ${j.method}`);
    }
  }
  if (project.records !== undefined) {
    const r = project.records;
    if (!isObj(r) || !isObj(r.rows) || (r.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(r.date))) throw new InputError('project.mjs: records must be { date?, rows: { id: { state, note } } }');
    for (const [id, e] of Object.entries(r.rows)) {
      if (!cat.rows.some((row) => row.id === id && row.methods.standard.some((m) => m.method === 'records'))) throw new InputError(`records: ${id} does not list the records method`);
      if (!isObj(e) || typeof e.state !== 'string' || typeof e.note !== 'string' || !e.note.trim()) throw new InputError(`records: ${id} needs a state and the note that grounds it`);
    }
  }
  return { states: [...states], journeys };
}

// The tested tree: HEAD's tree with the working tree's changes and untracked files added, in a temporary index whose
// new objects go to a temporary folder, the repository's objects borrowed read-only.
export function testedTree(root, scratch, env = childEnv()) {
  const git = (args, extra = {}) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: { ...env, ...extra } });
    if (r.status !== 0) throw new InputError(`git ${args.join(' ')}: ${firstLine(r.stderr) || 'failed'}; the gate runs in a Git checkout`);
    return r.stdout.trim();
  };
  const objects = git(['rev-parse', '--path-format=absolute', '--git-path', 'objects']);
  mkdirSync(join(scratch, 'objects'), { recursive: true });
  const temp = { GIT_INDEX_FILE: join(scratch, 'index'), GIT_OBJECT_DIRECTORY: join(scratch, 'objects'), GIT_ALTERNATE_OBJECT_DIRECTORIES: objects };
  if (spawnSync('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd: root, env }).status === 0) git(['read-tree', 'HEAD'], temp);
  git(['add', '-A', '--', '.'], temp);
  return git(['write-tree'], temp);
}

const version = (dir) => { try { return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version || null; } catch { return null; } };
// A package as Node would resolve it from a folder: that folder's node_modules, then each parent's, symbolic links read.
const resolvePkg = (from, name) => { for (let d = from; ; d = dirname(d)) { const p = join(d, 'node_modules', name); if (existsSync(join(p, 'package.json'))) return real(p); if (dirname(d) === d) return null; } };
// Playwright's own core, the copy @playwright/test's playwright resolves: npm installs @axe-core/playwright's peer
// playwright-core at its latest and may hoist it beside Playwright's own, whose browser revision then differs.
export function playwrightCore(root) {
  const t = resolvePkg(root, '@playwright/test'), pw = t && resolvePkg(t, 'playwright');
  return pw && resolvePkg(pw, 'playwright-core');
}
function shell(root) {
  const core = playwrightCore(root);
  try { return JSON.parse(readFileSync(join(core, 'browsers.json'), 'utf8')).browsers.find((b) => b.name === 'chromium-headless-shell') || null; } catch { return null; }
}
export function versions(root) {
  const b = shell(root);
  const tools = { node: process.versions.node };
  for (const [name, pkg] of [['playwright', '@playwright/test'], ['@axe-core/playwright', '@axe-core/playwright'], ['axe-core', 'axe-core'], ['eslint', 'eslint'], ['eslint-plugin-jsx-a11y', 'eslint-plugin-jsx-a11y']]) tools[name] = version(join(root, 'node_modules', pkg)) || 'absent';
  const core = playwrightCore(root);
  tools['playwright-core'] = (core && version(core)) || 'absent';
  tools.chromium = b ? `${b.browserVersion || 'unknown'} (headless shell, revision ${b.revision})` : 'absent';
  return tools;
}
// The browser Playwright would launch, looked for where Playwright keeps it; never downloaded.
export function browserMissing(root, env = process.env) {
  const b = shell(root);
  if (!b) return 'Playwright\'s browser list is not installed (the browsers.json of the playwright-core @playwright/test resolves)';
  const base = env.PLAYWRIGHT_BROWSERS_PATH === '0' ? join(root, 'node_modules/playwright-core/.local-browsers') : env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), 'Library/Caches/ms-playwright');
  const dir = join(base, `chromium_headless_shell-${b.revision}`);
  return existsSync(join(dir, 'INSTALLATION_COMPLETE')) ? '' : `Chromium headless shell revision ${b.revision} is not installed in ${base}; install it on the owner's word, never from the gate`;
}

// The lint step: ESLint with the project's own configuration over the declared source, each credited row failed by
// an error from a rule credited to it, and not run where a credited rule is off in the effective configuration.
export async function lintMethod(root, project, date, env = childEnv()) {
  const out = (rows, note) => ({ method: 'lint', date, rows, note });
  let credits = null, why = '';
  try { credits = (await import(pathToFileURL(join(root, 'eslint.a11y.mjs')).href)).CREDITS; } catch (e) { why = firstLine(e.message); }
  const ids = credits ? Object.keys(credits) : ['1.1.1', '1.3.1', '1.3.5', '3.3.2', '4.1.2'];
  const all = (state, note) => out(Object.fromEntries(ids.map((id) => [id, { state, note }])), note);
  if (!credits) return all('blocked', `eslint.a11y.mjs or its plugin cannot be loaded: ${why}`);
  const bin = join(root, 'node_modules/eslint/bin/eslint.js');
  if (!existsSync(bin)) return all('blocked', 'ESLint is not installed');
  if (!project.lint?.length) return all('not_run', 'tests/a11y/project.mjs declares no lint source');
  const r = spawnSync(process.execPath, [bin, '--format', 'json', '--', ...project.lint], { cwd: root, encoding: 'utf8', env, maxBuffer: 64 << 20 });
  if (r.status !== 0 && r.status !== 1) return all('error', `ESLint exited ${r.status}: ${firstLine(r.stderr || r.stdout)}`);
  let results;
  try { results = JSON.parse(r.stdout); } catch { return all('error', 'ESLint printed no JSON'); }
  if (!results.length) return all('not_run', 'ESLint found no source file in the declared paths');
  const messages = results.flatMap((f) => f.messages.map((m) => ({ ...m, file: relative(root, f.filePath) })));
  const fatal = messages.filter((m) => m.fatal);
  if (fatal.length) return all('error', `ESLint could not parse ${fatal.length} file(s): ${fatal.slice(0, 3).map((m) => `${m.file}:${m.line}`).join(', ')}`);
  // The effective configuration of every file the step read. A credited rule is judged only over the files the
  // configuration applies it to (V31-A11Y-FIXES): a file whose configuration leaves the rule out, as the fragment's
  // JSX and TSX glob leaves a .ts file, is not read as the rule off. A rule the project switched off by hand in any
  // file, or applied to no file read, does not run.
  const onIn = new Map(), offFor = new Map(), ruleNames = Object.values(credits).flat();
  for (const rule of ruleNames) onIn.set(rule, new Set());
  for (const f of results) {
    const cfg = spawnSync(process.execPath, [bin, '--print-config', f.filePath], { cwd: root, encoding: 'utf8', env, maxBuffer: 16 << 20 });
    let active;
    try { active = JSON.parse(cfg.stdout).rules || {}; } catch { return all('error', `ESLint could not print the effective configuration of ${relative(root, f.filePath)}: ${firstLine(cfg.stderr)}`); }
    for (const rule of ruleNames) {
      const v = active[`jsx-a11y/${rule}`];
      if (v === undefined) continue;
      const s = Array.isArray(v) ? v[0] : v;
      if (s === 2 || s === 1 || s === 'error' || s === 'warn') onIn.get(rule).add(f.filePath);
      else if (!offFor.has(rule)) offFor.set(rule, relative(root, f.filePath));
    }
  }
  const credited = new Set(Object.values(credits).flat().map((rule) => `jsx-a11y/${rule}`));
  const other = messages.filter((m) => m.ruleId?.startsWith('jsx-a11y/') && !credited.has(m.ruleId));
  const rows = {};
  for (const id of ids) {
    const off = credits[id].filter((rule) => offFor.has(rule));
    if (off.length) { rows[id] = { state: 'not_run', note: `credited rule(s) off in the effective configuration: ${off.map((rule) => `${rule} (${offFor.get(rule)})`).join(', ')}` }; continue; }
    const none = credits[id].filter((rule) => !onIn.get(rule).size);
    if (none.length) { rows[id] = { state: 'not_run', note: `credited rule(s) applied to none of the ${results.length} file(s) read: ${none.join(', ')}` }; continue; }
    const judged = new Set(credits[id].flatMap((rule) => [...onIn.get(rule)]));
    const hits = messages.filter((m) => m.severity >= 1 && credits[id].some((rule) => m.ruleId === `jsx-a11y/${rule}`));
    rows[id] = hits.length ? { state: 'fail', note: hits.slice(0, 5).map((m) => `${m.file}:${m.line} ${m.ruleId}`).join('; ') + (hits.length > 5 ? `; and ${hits.length - 5} more` : '') } : { state: 'pass', note: `eslint-plugin-jsx-a11y strict: no finding from ${credits[id].length} credited rule(s) in ${judged.size === results.length ? `${results.length} file(s)` : `${judged.size} of ${results.length} file(s), the others not covered by the configuration`}` };
  }
  const res = out(rows, `ESLint over ${project.lint.join(', ')}${other.length ? `; ${other.length} finding(s) from jsx-a11y rules no row credits: ${[...new Set(other.map((m) => m.ruleId))].join(', ')}` : ''}`);
  return Object.assign(res, { uncredited: other.length });
}

export async function main(argv, env = process.env) {
  const o = parseArgs(argv);
  const root = real(o.root);
  const read = (p) => { try { return JSON.parse(readFileSync(join(root, p), 'utf8')); } catch (e) { throw new InputError(`${p}: ${e.code === 'ENOENT' ? 'missing' : firstLine(e.message)}`); } };
  const cat = read('project/a11y/catalogue.json'), cov = read('project/a11y/coverage.json');
  if (!['AA', 'AAA'].includes(cov.level)) throw new InputError('project/a11y/coverage.json: level must be AA or AAA');
  let project;
  try { project = (await import(pathToFileURL(join(root, SPECS, 'project.mjs')).href)).default; } catch (e) { throw new InputError(`${SPECS}/project.mjs cannot be loaded: ${firstLine(e.message)}`); }
  let declared = declarations(project, cat);
  if (o.knownBad) {
    const { pages } = read(`${SPECS}/known-bad/known-bad.json`);
    if (!pages.some((p) => p.page === o.knownBad)) throw new InputError(`no known-bad page named ${o.knownBad}`);
    declared = { states: [`known-bad-${o.knownBad}`], journeys: [] };
  }
  if (inside(real(tmpdir()), root)) throw new InputError(`the temporary folder ${real(tmpdir())} lies inside the checkout; set TMPDIR outside it`);
  const run = mkdtempSync(join(real(tmpdir()), 'a11y-run-'));
  const scratch = mkdtempSync(join(real(tmpdir()), 'a11y-tree-'));
  const base = childEnv(env);
  let tree;
  try { tree = testedTree(root, scratch, base); } finally { rmSync(scratch, { recursive: true, force: true }); }
  const date = o.date || new Date().toISOString().slice(0, 10);
  writeFileSync(join(run, 'run.json'), `${JSON.stringify({ schema: 1, depth: 'standard', date, tree, level: cov.level, tools: versions(root), baseline: null, projects: { chromium: 'standard' }, declared }, null, 2)}\n`);
  let uncredited = 0;
  if (!o.knownBad) {
    mkdirSync(join(run, 'methods'));
    const { uncredited: n = 0, ...lint } = await lintMethod(root, project, date, base);
    uncredited = n;
    writeFileSync(join(run, 'methods/lint.json'), `${JSON.stringify(lint, null, 2)}\n`);
    // The records the session keeps in project.mjs (P09, P10), each grounded in its note; none is invented here.
    if (project.records) writeFileSync(join(run, 'methods/records.json'), `${JSON.stringify({ method: 'records', date: project.records.date || date, rows: project.records.rows }, null, 2)}\n`);
  }
  const cli = join(root, 'node_modules/@playwright/test/cli.js');
  let pw = 2;
  if (!existsSync(cli)) console.error('a11y-run: @playwright/test is not installed; nothing ran');
  else {
    const server = o.knownBad || !project.server ? null : project.server;
    const r = spawnSync(process.execPath, [cli, 'test', '--config', `${SPECS}/playwright.config.ts`, '--pass-with-no-tests', ...(o.grep ? ['--grep', o.grep] : [])], {
      cwd: root, stdio: 'inherit',
      env: { ...base, A11Y_RUN_DIR: run, A11Y_ROOT: root, A11Y_KNOWN_BAD: o.knownBad || '', A11Y_BASE_URL: o.knownBad ? '' : project.baseURL || '', A11Y_SERVER: server ? JSON.stringify(server) : '', A11Y_BROWSER_MISSING: browserMissing(root, env) },
    });
    pw = r.status === null ? 2 : r.status;
  }
  const rep = spawnSync(process.execPath, [join(HERE, 'a11y-report.mjs'), '--root', root, '--run', run, '--gate'], { cwd: root, stdio: 'inherit', env: base });
  let code = rep.status === null ? 2 : rep.status;
  if (pw >= 2) { if (code < 2) console.error(`a11y-run: Playwright exited ${pw}: the run crashed`); code = 2; } else if (pw === 1 && code === 0) { console.error('a11y-run: Playwright reported a failure the report did not record'); code = 1; }
  if (uncredited && code === 0) { console.error(`a11y-run: ${uncredited} jsx-a11y finding(s) from rules no row credits; fix them, as the project's own lint would`); code = 1; }
  if (o.grep && code === 0) { console.error('a11y-run: a run narrowed by --grep is never a passing gate'); code = 1; }
  console.log(`a11y-run: run folder ${run}`);
  return code;
}

if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    console.error(`a11y-run: ${e instanceof InputError ? e.message : `crash: ${e.stack || e.message}`}`);
    process.exitCode = 2;
  });
}
