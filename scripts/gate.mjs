#!/usr/bin/env node
/**
 * The gate, sorted by what changed (GATE-01, the owner's Q23 pick "Gate by
 * what changed (Recommended)").
 *
 * Every changed path is put in one class: record, v3, v4, pages (the live
 * site), step (the publishing step's own files), gate (the gate's own test
 * file) or other. A change whose
 * paths are all record runs the record checker alone. Otherwise the gate's
 * own tests run, then each lane the classes ask for, then the record checker;
 * a single path of class other, or a change that cannot be read, runs
 * everything. So a wrong or missing list entry fails towards running more,
 * never less.
 *
 *   node scripts/gate.mjs                  sort this checkout's change against
 *                                          origin/main and run what it needs
 *                                          (at the root, npm run check; from
 *                                          v3/, npm run check:changed)
 *   node scripts/gate.mjs --all            run everything
 *   node scripts/gate.mjs --plan [--range A...B]
 *                                          say what a change would run, run
 *                                          nothing (a range is git diff's)
 *   node scripts/gate.mjs --ci --plan      CI: sort the push or pull request,
 *                                          write the lanes to GITHUB_OUTPUT
 *                                          (a push to main reads GitHub's API
 *                                          with GITHUB_TOKEN)
 *   node scripts/gate.mjs --lane <name>    run one lane (CI runs each in a step)
 *
 * The live site, the root docs/ and version.json, is written only by the
 * publishing step (PUB-01), on main. A pull request, a branch or a checkout
 * that changes either is refused; on main, a change the step made (its
 * commits checked against GitHub's record of their runs) runs nothing of its
 * own, so a publish never makes the next change wait, and a hand change fails.
 *
 * No dependency: Node and git only, so the record-only path needs no npm ci.
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root, so the gate reads and runs the same from any folder. */
export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Record-only paths: the list the owner was shown (D4, provisional under his
 * overnight grant). Nothing in v3's or v4's code, tests or build reads these,
 * and the build never ships them; scripts/gate.test.mjs keeps that true. The
 * accessibility pack's files inside two of these folders are v4's (A11Y).
 */
export const RECORD = {
  files: ['AGENTS.md', 'CLAUDE.md', 'UI-STANDARDS.md', 'DEV-INFRASTRUCTURE.md', 'README.md'],
  dirs: ['project/', 'verbs/', 'tools/', 'reviews/', 'pm_skills/']
};

/**
 * The accessibility pack's own files (STACK-03), which sit in the record's
 * folders where the pack's own refresh looks for them: its run, report and
 * coverage check, tools/a11y-*.mjs, and its catalogue and coverage file,
 * project/a11y/. v4's gate runs and reads them (package.json's `a11y` script,
 * tests/a11y/), so they sort as v4, ahead of the record list, whatever v4's
 * list holds (GATE-02, wish STACK-03.1). A file here is matched by a pattern,
 * so a pack file added later is v4 too.
 */
export const A11Y = {
  files: [],
  dirs: ['project/a11y/'],
  patterns: [/^tools\/a11y-[^/]+\.mjs$/]
};

/**
 * Frozen v3 (3.3.726), which STACK-01 moved into v3/: its code, its tests, its
 * package, its build's inputs and its own copies of version.json, LICENSE and
 * THIRD_PARTY_NOTICES.md, which its build reads. The two .github documents stay
 * at the root and are here because v3's governance test reads them. The paths
 * v3 left at the root are not v3 any more: a file there is other until v4's
 * list names it.
 */
export const V3 = {
  files: ['.github/SECURITY.md', '.github/SUPPORT.md'],
  dirs: ['v3/']
};

/**
 * v4's paths (STACK-02): the root package, its lockfile and the editor stack's
 * settings, the page, and v4's code and tests. The root `npm run check:v4`
 * runs v4's whole gate; v4's settings exclude v3/. LICENSE and the root
 * THIRD_PARTY_NOTICES.md stay other, as STACK-01 left them. The measures
 * script (STACK-04) is v4's: CI's v4 step runs it after the lane, and
 * tests/architecture/ tests it (GATE-02).
 */
export const V4 = {
  files: [
    'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'tsconfig.base.json', 'tsconfig.app.json',
    'tsconfig.core.json', 'vite.config.mjs', 'eslint.config.mjs', 'eslint.base.mjs', 'eslint.a11y.mjs', 'knip.json',
    '.dependency-cruiser.cjs', 'scripts/measures.mjs'
  ],
  dirs: ['src/', 'tests/']
};

/**
 * The live site (PUB-01): the root docs/, which GitHub Pages serves, and the
 * root version.json beside it, which says what is live. Only the publishing
 * step writes them (.github/workflows/publish.yml, scripts/publish.mjs).
 */
export const PAGES = {
  files: ['version.json'],
  dirs: ['docs/']
};

/**
 * The publishing step's own files (PUB-01): its workflow, and
 * scripts/publish*.mjs, the step and its tests. A change to them runs the
 * gate's lane, which holds the step's tests, v4's gate and the record
 * checker, not frozen v3's suite (GATE-02, wish PUB-01.3). v4's gate reads
 * them: knip's GitHub Actions plugin takes the scripts the workflows run as
 * its entries. A push of a branch also runs the step's dry run on v4's real
 * build (.github/workflows/publish.yml).
 */
export const PUBLISHING = {
  files: ['.github/workflows/publish.yml'],
  dirs: [],
  patterns: [/^scripts\/publish[^/]*\.mjs$/]
};

/**
 * The gate's own test file, scripts/gate.test.mjs, named exactly. Its tests
 * pin what v4's files say (the accessibility run's project file among them),
 * so a v4 item changes it along with them. It defines tests only (the sorting
 * and the lanes' commands live in scripts/gate.mjs), and frozen v3 reads
 * nothing of it, so it asks for the gate's lane, which runs it, and v4's gate,
 * whose files it reads; not frozen v3's suite. scripts/gate.mjs itself stays
 * other: a change to the sorting or to a lane's commands still runs everything
 * (GATE-03).
 */
export const GATE_TESTS = {
  files: ['scripts/gate.test.mjs'],
  dirs: []
};

/**
 * How the publishing step's own commits are known: one parent, made and
 * committed by the Actions bot, a line beginning with the trailer, and no path
 * changed outside PAGES. The step writes exactly these (scripts/publish.mjs).
 */
export const STEP = {
  trailer: 'Published-by: PUB-01',
  name: 'github-actions[bot]',
  email: '41898282+github-actions[bot]@users.noreply.github.com'
};

/**
 * The line the step prints, on a line of its own in its job's log, once it has
 * pushed a commit to main; the gate reads it to know the commit as that run's.
 * @param {string} sha
 */
export const pushedLine = sha => `PUB-01 pushed ${sha} to refs/heads/main`;

/** v4's gate has a 10-minute budget; exceeding it is a finding, not a failure. */
export const V4_BUDGET_SECONDS = 600;

/**
 * The lanes, in the order they run, each from its folder (cwd, below the
 * root). The record checker runs last, as before.
 */
export const LANES = {
  gate: {
    title: "the gate's and the publishing step's own tests",
    commands: [[process.execPath, ['--test', 'scripts/gate.test.mjs', 'scripts/publish.test.mjs']]]
  },
  v3: {
    title: "frozen v3's whole suite, shell contract and build check",
    cwd: 'v3',
    commands: [['npm', ['test']], ['npm', ['run', 'test:shell']], ['npm', ['run', 'build:check']]]
  },
  v4: {
    title: "v4's gate",
    commands: [['npm', ['run', 'check:v4']]],
    budgetSeconds: V4_BUDGET_SECONDS
  },
  record: {
    title: 'the record checker',
    commands: [[process.execPath, ['tools/check.mjs']]]
  }
};
const ORDER = ['gate', 'v3', 'v4', 'record'];

/** Whether a path is on a list: one of its files, under one of its folders, or matched by one of its patterns. */
const inList = (path, list) => list.files.includes(path) || list.dirs.some(dir => path.startsWith(dir)) ||
  (list.patterns ?? []).some(pattern => pattern.test(path));

/**
 * The class of one repository path, compared exactly as git spells it. The
 * accessibility pack's files are v4's before the record list is read, since
 * they sit in its folders (GATE-02).
 * @param {string} path
 * @param {{ v4?: { files: string[], dirs: string[] } }} [lists]
 * @returns {'record'|'v3'|'pages'|'step'|'gate'|'v4'|'other'}
 */
export function classify(path, { v4 = V4 } = {}) {
  if (inList(path, A11Y)) return 'v4';
  if (inList(path, RECORD)) return 'record';
  if (inList(path, V3)) return 'v3';
  if (inList(path, PAGES)) return 'pages';
  if (inList(path, PUBLISHING)) return 'step';
  if (inList(path, GATE_TESTS)) return 'gate';
  if (inList(path, v4)) return 'v4';
  return 'other';
}

/**
 * Which lanes a change runs.
 * @param {string[]|null} paths every path the change adds, changes or deletes;
 *   null when the change could not be read
 * @param {{ v4?: { files: string[], dirs: string[] }, pages?: 'step'|'hand' }} [lists] pages: who left
 *   docs/ and version.json as the change leaves them. The step's output runs nothing of its own; a hand
 *   change is other, so it runs everything (and outside main the gate refuses it before this).
 * @returns {{ lanes: string[], reason: string, classes: Map<string, string> }}
 */
export function plan(paths, { v4 = V4, pages = 'hand' } = {}) {
  const v4Exists = v4.files.length > 0 || v4.dirs.length > 0;
  const everything = ORDER.filter(lane => lane !== 'v4' || v4Exists);
  const kindOf = path => {
    const kind = classify(path, { v4 });
    return kind === 'pages' && pages !== 'step' ? 'other' : kind;
  };
  const classes = new Map((paths ?? []).map(path => [path, kindOf(path)]));
  if (paths === null) return { lanes: everything, reason: 'the change could not be read', classes };
  if (paths.length === 0) return { lanes: everything, reason: 'the change names no path', classes };

  const found = new Set(classes.values());
  if (found.size === 1 && found.has('record')) {
    return { lanes: ['record'], reason: 'every path is record-only', classes };
  }
  // PUB-01: the publishing step's own output asks for no lane; the record checker still runs on every push.
  found.delete('pages');
  if (found.size === 0 || (found.size === 1 && found.has('record'))) {
    return { lanes: ['record'], reason: "every path is record-only or the publishing step's own output", classes };
  }
  if (found.has('other')) {
    return { lanes: everything, reason: 'a path is outside the record, v3 and v4 lists', classes };
  }
  // GATE-02: the publishing step's own files ask for the gate's lane, which holds the step's tests, and v4's, whose
  // dead-code check reads the scripts the workflows run. GATE-03: the gate's own test file asks for the same two: the
  // gate's lane runs it, and it pins what v4's files say.
  const ownFiles = found.has('step') || found.has('gate');
  const wants = lane => found.has(lane) || (lane === 'v4' && ownFiles && v4Exists);
  const lanes = ['gate', ...['v3', 'v4'].filter(wants), 'record'];
  const touched = [...['v3', 'v4'].filter(l => found.has(l)), ...(found.has('step') ? ['the publishing step'] : []),
    ...(found.has('gate') ? ["the gate's own tests"] : [])];
  return { lanes, reason: `the change touches ${touched.join(' and ')}`, classes };
}

/**
 * Run git and return its output, or null when it fails.
 * @param {string[]} args
 * @param {string} cwd
 */
export function git(args, cwd = ROOT) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 });
  return result.status === 0 ? result.stdout : null;
}

const splitZ = output => output.split('\0').filter(Boolean);

/**
 * The paths a git diff range names. Renames are read as a deletion and an
 * addition, so a file moved out of v3 into the record still counts as v3.
 * @param {string[]} range git diff's revision arguments, e.g. ['A...B']
 * @returns {string[]|null}
 */
export function pathsOfRange(range, cwd) {
  const output = git(['diff', '--name-only', '--no-renames', '-z', ...range, '--'], cwd);
  return output === null ? null : splitZ(output);
}

const isSha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value) && !/^0+$/.test(value);

/**
 * The range CI should read for this event, or null when none is safe.
 *
 * A pull request is read from where it left its base. A push to a branch
 * other than the default is read against the default branch, not against the
 * push before it, because a cancelled run would otherwise leave a change
 * unchecked. A push to the default branch is read from the last commit on it
 * whose run passed, not from the commit before it: a run that was replaced,
 * cancelled or failed leaves its change in every later range until one passes.
 * @param {{ eventName: string, event: object, ref: string, sha: string, lastGreen?: string|null }} ci
 * @returns {string[]|null}
 */
export function ciRange({ eventName, event, ref, sha, lastGreen = null }) {
  const main = event?.repository?.default_branch || 'main';
  if (eventName === 'pull_request') {
    const base = event?.pull_request?.base?.sha;
    const head = event?.pull_request?.head?.sha;
    return isSha(base) && isSha(head) ? [`${base}...${head}`] : null;
  }
  if (eventName !== 'push' || !isSha(sha)) return null;
  if (ref === `refs/heads/${main}`) return isSha(lastGreen) ? [lastGreen, sha] : null;
  if (ref?.startsWith('refs/heads/')) return [`origin/${main}...${sha}`];
  return null;
}

/**
 * The commit of the newest push to the default branch whose run of this
 * workflow passed and which `accept` takes, from GitHub's API; null when it
 * cannot be had, which makes the push run everything. CI accepts only an
 * ancestor of the commit it sorts, so a run that finished late, for a newer
 * commit, never reads a range backwards (PUB-01, from Codex's review).
 * @param {object} env the CI environment
 * @param {typeof fetch} [fetchImpl]
 * @param {(sha: string) => boolean} [accept]
 * @returns {Promise<string|null>}
 */
export async function lastGreenSha(env, fetchImpl = globalThis.fetch, accept = () => true) {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, GITHUB_API_URL: api = 'https://api.github.com' } = env;
  const workflow = env.GITHUB_WORKFLOW_REF?.match(/\.github\/workflows\/([^@/]+)@/)?.[1] ?? 'ci.yml';
  if (!token || !repo || !env.DEFAULT_BRANCH) return null;
  const query = new URLSearchParams({ branch: env.DEFAULT_BRANCH, event: 'push', status: 'success', per_page: '20' });
  try {
    const response = await fetchImpl(`${api}/repos/${repo}/actions/workflows/${workflow}/runs?${query}`, {
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    const runs = (await response.json())?.workflow_runs ?? [];
    return runs.map(run => run?.head_sha).find(sha => isSha(sha) && accept(sha)) ?? null;
  } catch {
    return null;
  }
}

/** Whether `ancestor` is `descendant` or comes before it. */
export const isAncestor = (ancestor, descendant, cwd = ROOT) =>
  git(['merge-base', '--is-ancestor', ancestor, descendant], cwd) !== null;

/**
 * The two ends of a range as git diff reads it: A...B from where B left A, A..B
 * and [A, B] from A. Null when they cannot be had.
 * @param {string[]} range
 * @returns {[string, string]|null}
 */
export function rangeEnds(range, cwd = ROOT) {
  if (range.length === 2) return [range[0], range[1]];
  const [spec] = range;
  const three = spec?.match(/^(.+)\.\.\.(.+)$/);
  if (three) {
    const base = git(['merge-base', three[1], three[2]], cwd)?.trim();
    return base ? [base, three[2]] : null;
  }
  const two = spec?.match(/^(.+)\.\.(.+)$/);
  return two ? [two[1], two[2]] : null;
}

/**
 * The commits reachable from `to` (and not from `from`, when given) that are
 * shaped as the publishing step's own (see STEP), newest first: one parent,
 * the bot as author and committer, the trailer, and only the live site's
 * paths. Shape is git metadata, which anyone can write, so on main the gate
 * and the step also check each one against GitHub's record of the run that
 * made it (authenticateStep); a pull request never relies on it.
 * @returns {{ sha: string, run: string|null, attempt: string, body: string }[]} empty when unreadable
 */
export function stepCommits(from, to, cwd = ROOT) {
  const log = git(['log', '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e', from ? `${from}..${to}` : to], cwd);
  if (log === null) return [];
  const found = [];
  for (const entry of log.split('\x1e')) {
    const [sha, parents, authorName, authorEmail, committerName, committerEmail, body = ''] =
      entry.replace(/^\s+/, '').split('\x1f');
    if (!isSha(sha) || parents.trim().split(/\s+/).length !== 1) continue;
    if (authorName !== STEP.name || committerName !== STEP.name) continue;
    if (authorEmail !== STEP.email || committerEmail !== STEP.email) continue;
    const trailer = body.split('\n').find(line => line.startsWith(`${STEP.trailer} `));
    if (!trailer) continue;
    const changed = pathsOfRange([`${sha}^`, sha], cwd);
    if (!changed?.length || changed.some(path => classify(path) !== 'pages')) continue;
    found.push({ sha, run: trailer.match(/\brun (\d+)\b/)?.[1] ?? null, attempt: trailer.match(/\battempt (\d+)\b/)?.[1] ?? '1', body });
  }
  return found;
}

/**
 * The step-shaped commits after `from` that left the live site as `to` holds
 * it: neither docs/ nor version.json has changed since.
 * @returns {{ sha: string, run: string|null, attempt: string }[]} newest first
 */
export function stepCandidates(from, to, cwd = ROOT) {
  return stepCommits(from, to, cwd)
    // git diff --quiet exits 1 on a difference, which git() reads as null.
    .filter(({ sha }) => git(['diff', '--quiet', sha, to, '--', ...PAGES.files, ...PAGES.dirs], cwd) !== null)
    .map(({ sha, run, attempt }) => ({ sha, run, attempt }));
}

/** Whether a commit shaped as the step's left the live site as `to` holds it (git metadata alone). */
export const stepMade = (from, to, cwd = ROOT) => stepCandidates(from, to, cwd).length > 0;

/** A GitHub API call with the run's token: JSON, or text when asked; null when it cannot be had. */
async function github(env, fetchImpl, path, { text = false } = {}) {
  const { GITHUB_TOKEN: token, GITHUB_API_URL: api = 'https://api.github.com' } = env;
  try {
    // A job's log answers with a redirect to a signed address, which fetch follows without the token.
    const response = await fetchImpl(`${api}${path}`, {
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` }
    });
    if (response.status === 404) return { missing: true };
    if (!response.ok) return null;
    return { body: text ? await response.text() : await response.json() };
  } catch {
    return null;
  }
}

/**
 * Check a step-shaped commit against GitHub's record of the run its trailer
 * names: a run of .github/workflows/publish.yml on main of this repository,
 * started after Verify or by hand, whose publish or take-back job printed, on
 * a line of its own in its log, that it pushed exactly this commit (see
 * pushedLine). Only the step on main prints that line, so an old run's number
 * cannot vouch for another commit. Only the jobs that ran are read: a job
 * whose conclusion is skipped has no log and pushed nothing (GATE-02). True
 * or false when the record says; null when it cannot be read: while a job
 * still runs, when a log is missing (not yet written, expired or deleted), or
 * when GitHub does not answer. On main the gate refuses a null as it refuses
 * a false; the step does not publish over it (scripts/publish.mjs).
 * @param {{ sha: string, run: string|null, attempt?: string }} candidate
 * @returns {Promise<boolean|null>}
 */
export async function authenticateStep(candidate, env, fetchImpl = globalThis.fetch, cwd = ROOT) {
  const repo = env.GITHUB_REPOSITORY;
  if (!candidate.run) return false;
  if (!env.GITHUB_TOKEN || !repo) return null;
  const ran = await github(env, fetchImpl, `/repos/${repo}/actions/runs/${candidate.run}`);
  if (!ran) return null;
  if (ran.missing) return false;
  const run = ran.body;
  const fits = run?.path === '.github/workflows/publish.yml' && run?.head_branch === 'main' &&
    ['workflow_run', 'workflow_dispatch'].includes(run?.event) && run?.repository?.full_name === repo &&
    isSha(run?.head_sha) && isAncestor(run.head_sha, `${candidate.sha}^`, cwd);
  if (!fits) return false;
  const listed = await github(env, fetchImpl,
    `/repos/${repo}/actions/runs/${candidate.run}/attempts/${candidate.attempt ?? '1'}/jobs?per_page=100`);
  if (!listed || listed.missing) return listed ? false : null;
  const marker = new RegExp(`^(?:\\S+\\s)?${pushedLine(candidate.sha).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?$`, 'm');
  let unread = false;
  for (const job of (listed.body?.jobs ?? []).filter(item => ['publish', 'take-back'].includes(item.name))) {
    // GATE-02: a skipped job never ran, so it has no log to wait for; a run whose other job pushed is read whole.
    if (job.conclusion === 'skipped') continue;
    if (job.status !== 'completed') { unread = true; continue; }
    const log = await github(env, fetchImpl, `/repos/${repo}/actions/jobs/${job.id}/logs`, { text: true });
    if (!log || log.missing) { unread = true; continue; }
    if (marker.test(log.body)) return true;
  }
  return unread ? null : false;
}

/**
 * The commit that made the live site what `to` holds, read back from `to`:
 * while a commit holds the same site (docs/ and version.json, by object id)
 * as one of its parents, the first such parent is followed, through a merge
 * on either side; the first commit that holds it and no parent does made it.
 * Once the walk reaches `from` or a commit before it, the site came from
 * before the range ({ outside }). So the commit that last put the site there
 * is the one found, whatever an older commit held, and however main got to
 * `to`, by a merge or a fast-forward (GATE-02, from Codex's reviews).
 * @returns {{ sha: string|null, outside?: string }} sha null when git cannot say
 */
export function siteIntroducer(from, to, cwd = ROOT) {
  const names = [...PAGES.files, ...PAGES.dirs.map(dir => dir.replace(/\/$/, ''))];
  const held = new Map();
  const siteOf = commit => {
    if (!held.has(commit)) held.set(commit, git(['ls-tree', '--full-tree', commit, '--', ...names], cwd));
    return held.get(commit);
  };
  let at = git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${to}^{commit}`], cwd)?.trim();
  while (isSha(at)) {
    if (from && isAncestor(at, from, cwd)) return { sha: null, outside: at };
    const parents = git(['rev-list', '--parents', '-n', '1', at], cwd)?.trim().split(' ').slice(1);
    const here = siteOf(at);
    if (!parents || here === null) return { sha: null };
    const same = parents.find(parent => siteOf(parent) === here);
    if (!same) return { sha: at };
    at = same;
  }
  return { sha: null };
}

/**
 * Who left the live site as a push to main leaves it, judged by the commit
 * that made it (siteIntroducer): 'step' when that commit is shaped as the
 * step's and GitHub's record of its run vouches for it; 'unverified' when it
 * is so shaped but the record cannot be read; 'hand' otherwise, or when the
 * site came from before the range but is not the one `from` holds; 'none'
 * when the site is still the one `from` holds. The gate refuses 'hand' and
 * 'unverified' on main (GATE-02). A step commit after a hand change makes
 * the site the step's again.
 * @returns {Promise<{ provenance: 'step'|'unverified'|'hand'|'none', paths: string[] }>}
 */
export async function siteProvenance(from, to, env, fetchImpl = globalThis.fetch, cwd = ROOT) {
  const site = [...PAGES.files, ...PAGES.dirs];
  const made = siteIntroducer(from, to, cwd);
  if (made.outside) {
    const changed = pathsOfRange([from, to], cwd);
    if (changed !== null && pagesPaths(changed).length === 0) return { provenance: 'none', paths: [] };
    return { provenance: 'hand', paths: changed === null ? site : pagesPaths(changed) };
  }
  if (!made.sha) return { provenance: 'hand', paths: site };
  const changed = pathsOfRange([`${made.sha}^`, made.sha], cwd);
  const paths = changed === null ? site : pagesPaths(changed).length ? pagesPaths(changed) : site;
  const [candidate] = stepCommits(`${made.sha}^`, made.sha, cwd);
  if (!candidate || candidate.sha !== made.sha) return { provenance: 'hand', paths };
  const said = await authenticateStep(candidate, env, fetchImpl, cwd);
  return { provenance: said === true ? 'step' : said === null ? 'unverified' : 'hand', paths };
}

/**
 * siteProvenance's verdict alone.
 * @returns {Promise<'step'|'unverified'|'hand'|'none'>}
 */
export const mainProvenance = async (from, to, env, fetchImpl = globalThis.fetch, cwd = ROOT) =>
  (await siteProvenance(from, to, env, fetchImpl, cwd)).provenance;

/** The paths of a change that are the live site's. */
export const pagesPaths = paths => (paths ?? []).filter(path => classify(path) === 'pages');

/**
 * Every tracked symbolic link. A link can make a v3 path and a record path
 * the same file, so that a record-only change alters what v3 reads or ships;
 * links can chain, so rather than trust a resolution of them the gate's tests
 * refuse them all. The repository holds none.
 * @returns {string[]|null}
 */
export function trackedLinks(cwd) {
  const listing = git(['ls-files', '--stage', '-z'], cwd);
  if (listing === null) return null;
  return splitZ(listing).filter(entry => entry.startsWith('120000 ')).map(entry => entry.split('\t')[1]).sort();
}

/**
 * This checkout's change: what its commits and its working tree hold that
 * origin/main does not, untracked files included.
 * @returns {string[]|null}
 */
export function localPaths(cwd) {
  const base = git(['merge-base', 'origin/main', 'HEAD'], cwd)?.trim();
  if (!base) return null;
  const tracked = pathsOfRange([base], cwd);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], cwd);
  if (tracked === null || untracked === null) return null;
  return [...new Set([...tracked, ...splitZ(untracked)])].sort();
}

/** A plan in words, one line per path, for the log and the step summary. */
export function describe({ lanes, reason, classes }, source) {
  const lines = [`gate: ${classes.size} changed path(s) (${source})`];
  for (const [path, kind] of classes) lines.push(`  ${kind.padEnd(6)} ${path}`);
  lines.push(`gate: runs ${lanes.map(lane => LANES[lane].title).join(', then ')}, because ${reason}`);
  return lines.join('\n');
}

/**
 * Run one lane's commands in order, stopping at the first failure. A lane
 * with a budget reports a finding when it runs over, and still passes.
 * @returns {number} the exit status
 */
export function runLane(name, { env = process.env, log = console.log, lanes = LANES, now = Date.now } = {}) {
  const lane = lanes[name];
  if (!lane) throw new Error(`gate: no lane named ${name}; lanes: ${Object.keys(lanes).join(', ')}`);
  log(`gate: running ${lane.title}`);
  const started = now();
  for (const [command, args] of lane.commands) {
    const result = spawnSync(command, args, { cwd: join(ROOT, lane.cwd ?? ''), stdio: 'inherit', env });
    if (result.status !== 0) {
      log(`gate: ${lane.title} failed at ${[command === process.execPath ? 'node' : command, ...args].join(' ')}`);
      return result.status ?? 1;
    }
  }
  const seconds = Math.round((now() - started) / 1000);
  log(`gate: ${lane.title} passed in ${seconds} s`);
  if (lane.budgetSeconds && seconds > lane.budgetSeconds) {
    const finding = `${lane.title} took ${seconds} s, over its budget of ${lane.budgetSeconds} s: a finding`;
    log(env.GITHUB_ACTIONS ? `::warning title=Gate budget::${finding}` : `FINDING: ${finding}`);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `\n**Finding:** ${finding}\n`);
  }
  return 0;
}

/**
 * The gate's command line (see the top of this file). Exported so its tests
 * can run it in a scratch repository: cwd is the repository, log the output.
 * @returns {Promise<number>} the exit status
 */
export async function main(argv, env, { cwd = ROOT, log = console.log, fetchImpl = globalThis.fetch } = {}) {
  const has = flag => argv.includes(flag);
  const valueOf = flag => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);

  if (has('--lane')) return runLane(valueOf('--lane'), { env });

  let paths;
  let source;
  // PUB-01: who left the live site as the change leaves it. Outside main a
  // change to it is always a hand change, since the step writes only on main
  // and a branch that merged main reads from after its commits; on main the
  // step's commits are checked against GitHub's record of their runs.
  let provenance = 'hand';
  let shapeOnly = false;
  // GATE-02: on main, the live site's paths that the commit which last changed it changed.
  let siteChanged = [];
  if (has('--all')) {
    paths = null;
    source = 'everything was asked for';
  } else if (has('--ci')) {
    let event = {};
    try { event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')); } catch { /* read as no range */ }
    const main = event?.repository?.default_branch || 'main';
    const onMain = env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === `refs/heads/${main}`;
    const lastGreen = onMain && isSha(env.GITHUB_SHA)
      ? await lastGreenSha({ ...env, DEFAULT_BRANCH: main }, fetchImpl, sha => isAncestor(sha, env.GITHUB_SHA, cwd))
      : null;
    const range = ciRange({ eventName: env.GITHUB_EVENT_NAME, event, ref: env.GITHUB_REF, sha: env.GITHUB_SHA, lastGreen });
    paths = range ? pathsOfRange(range, cwd) : null;
    if (onMain && isSha(env.GITHUB_SHA)) {
      // GATE-02: on main, the commit that made the live site what this push holds, found within the range read or,
      // when no last passing run can be read, before it, is checked against its run's record, whether or not the site
      // differs at the range's two ends (a forged commit can put back an older site).
      ({ provenance, paths: siteChanged } = await siteProvenance(range ? range[0] : null, env.GITHUB_SHA, env,
        fetchImpl, cwd));
    }
    source = `${env.GITHUB_EVENT_NAME} ${range ? range.join(' ') : 'with no readable range'}` +
      (onMain ? `, from the last passing run on ${main}${lastGreen ? '' : ', which could not be read'}` : '');
  } else if (has('--range')) {
    // Says what a range would run, by the commits' shape alone: no record of their runs is read here.
    const range = valueOf('--range');
    paths = range ? pathsOfRange([range], cwd) : null;
    const ends = range && pagesPaths(paths).length ? rangeEnds([range], cwd) : null;
    provenance = ends && stepMade(ends[0], ends[1], cwd) ? 'step' : 'hand';
    shapeOnly = true;
    source = `range ${range}`;
  } else {
    paths = localPaths(cwd);
    source = 'this checkout against origin/main, working tree and untracked files included';
  }

  const pages = provenance === 'step' ? 'step' : 'hand';
  const decided = has('--all') ? { ...plan(null), reason: 'everything was asked for' } : plan(paths, { pages });
  const words = describe(decided, source) +
    (shapeOnly && pagesPaths(paths).length ? `\ngate: the live site's paths read as ${provenance === 'step' ? "the step's" : 'by hand'}, by the commits' shape alone` : '');
  log(words);

  const sitePaths = ['step', 'none'].includes(provenance) ? [] : [...new Set([...pagesPaths(paths), ...siteChanged])];
  // GATE-02: on main, a change to the live site that GitHub's record cannot vouch for is refused, as a hand change is,
  // so that a commit shaped as the step's never passes Verify unproven and becomes the last passing run.
  const refuse = sitePaths.length > 0 && !shapeOnly;
  if (sitePaths.length) {
    const said = provenance === 'unverified'
      ? "the live site's change looks like the publishing step's (PUB-01), but GitHub's record of its run cannot " +
        'vouch for it (a job still running, a log missing, or GitHub not answering), so it is not trusted: ' +
        `${sitePaths.join(', ')}. Re-run this run once the Publish run has finished`
      : `docs/ and version.json are the live site, which only the publishing step writes (PUB-01), on main; this change edits them by hand: ${sitePaths.join(', ')}` +
        (has('--ci') && env.GITHUB_REF?.endsWith('/main')
          ? '. Run the Publish workflow by hand on main so that the step rewrites the site: mode take-back, ' +
            "naming the step's last commit before this change; if the site already holds that commit's files, a " +
            'take-back to it commits nothing, so take it back first to an earlier one, then to it (a publish commits ' +
            "nothing when v4's build is unchanged)"
          : !has('--ci') && !shapeOnly ? '. If they came from main, fetch origin first' : '');
    const level = refuse ? 'error' : 'warning';
    const title = !refuse ? 'Live site'
      : provenance === 'unverified' ? 'Live site not vouched for' : 'Hand change to the live site';
    log(env.GITHUB_ACTIONS ? `::${level} title=${title}::${said}` : `gate: ${refuse ? 'refused' : 'warning'}: ${said}`);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `\n**${refuse ? 'Refused' : 'Warning'}:** ${said}\n`);
  }

  if (has('--ci')) {
    // Each lane's step, and each package's install, reads its own lane's output (STACK-02).
    const outputs = [`lanes=${decided.lanes.join(' ')}`, ...ORDER.map(lane => `${lane}=${decided.lanes.includes(lane)}`)];
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${outputs.join('\n')}\n`);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `## Gate by what changed\n\n\`\`\`\n${words}\n\`\`\`\n`);
  }
  if (refuse) return 1;
  if (has('--plan')) return 0;

  for (const lane of decided.lanes) {
    const status = runLane(lane, { env });
    if (status !== 0) return status;
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2), process.env);
}
