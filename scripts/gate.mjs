#!/usr/bin/env node
/**
 * The gate, sorted by what changed (GATE-01, the owner's Q23 pick "Gate by
 * what changed (Recommended)").
 *
 * Every changed path is put in one class: record, v3, v4 or other. A change
 * whose paths are all record runs the record checker alone. Otherwise the
 * gate's own tests run, then each lane the classes ask for, then the record
 * checker; a single path of class other, or a change that cannot be read,
 * runs everything. So a wrong or missing list entry fails towards running
 * more, never less.
 *
 *   node scripts/gate.mjs                  sort this checkout's change against
 *                                          origin/main and run what it needs
 *                                          (from v3/, npm run check:changed)
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
 * overnight grant). Nothing in v3's code, tests or build reads these, and the
 * build never ships them; scripts/gate.test.mjs keeps that true.
 */
export const RECORD = {
  files: ['AGENTS.md', 'CLAUDE.md', 'UI-STANDARDS.md', 'DEV-INFRASTRUCTURE.md', 'README.md'],
  dirs: ['project/', 'verbs/', 'tools/', 'reviews/', 'pm_skills/']
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
 * v4's paths: empty until STACK-02 puts v4's skeleton at the root. While it is
 * empty the v4 lane never runs, and STACK-02 fills both this list and
 * `check:v4`.
 */
export const V4 = { files: [], dirs: [] };

/** v4's gate has a 10-minute budget; exceeding it is a finding, not a failure. */
export const V4_BUDGET_SECONDS = 600;

/**
 * The lanes, in the order they run, each from its folder (cwd, below the
 * root). The record checker runs last, as before.
 */
export const LANES = {
  gate: {
    title: "the gate's own tests",
    commands: [[process.execPath, ['--test', 'scripts/gate.test.mjs']]]
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

const inList = (path, list) => list.files.includes(path) || list.dirs.some(dir => path.startsWith(dir));

/**
 * The class of one repository path, compared exactly as git spells it.
 * @param {string} path
 * @param {{ v4?: { files: string[], dirs: string[] } }} [lists]
 * @returns {'record'|'v3'|'v4'|'other'}
 */
export function classify(path, { v4 = V4 } = {}) {
  if (inList(path, RECORD)) return 'record';
  if (inList(path, V3)) return 'v3';
  if (inList(path, v4)) return 'v4';
  return 'other';
}

/**
 * Which lanes a change runs.
 * @param {string[]|null} paths every path the change adds, changes or deletes;
 *   null when the change could not be read
 * @param {{ v4?: { files: string[], dirs: string[] } }} [lists]
 * @returns {{ lanes: string[], reason: string, classes: Map<string, string> }}
 */
export function plan(paths, { v4 = V4 } = {}) {
  const v4Exists = v4.files.length > 0 || v4.dirs.length > 0;
  const everything = ORDER.filter(lane => lane !== 'v4' || v4Exists);
  const classes = new Map((paths ?? []).map(path => [path, classify(path, { v4 })]));
  if (paths === null) return { lanes: everything, reason: 'the change could not be read', classes };
  if (paths.length === 0) return { lanes: everything, reason: 'the change names no path', classes };

  const found = new Set(classes.values());
  if (found.size === 1 && found.has('record')) {
    return { lanes: ['record'], reason: 'every path is record-only', classes };
  }
  if (found.has('other')) {
    return { lanes: everything, reason: 'a path is outside the record, v3 and v4 lists', classes };
  }
  const lanes = ['gate', ...['v3', 'v4'].filter(lane => found.has(lane)), 'record'];
  return { lanes, reason: `the change touches ${['v3', 'v4'].filter(l => found.has(l)).join(' and ')}`, classes };
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
 * workflow passed, from GitHub's API; null when it cannot be had, which makes
 * the push run everything.
 * @param {object} env the CI environment
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<string|null>}
 */
export async function lastGreenSha(env, fetchImpl = globalThis.fetch) {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, GITHUB_API_URL: api = 'https://api.github.com' } = env;
  const workflow = env.GITHUB_WORKFLOW_REF?.match(/\.github\/workflows\/([^@/]+)@/)?.[1] ?? 'ci.yml';
  if (!token || !repo || !env.DEFAULT_BRANCH) return null;
  const query = new URLSearchParams({ branch: env.DEFAULT_BRANCH, event: 'push', status: 'success', per_page: '1' });
  try {
    const response = await fetchImpl(`${api}/repos/${repo}/actions/workflows/${workflow}/runs?${query}`, {
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    const sha = (await response.json())?.workflow_runs?.[0]?.head_sha;
    return isSha(sha) ? sha : null;
  } catch {
    return null;
  }
}

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

async function main(argv, env) {
  const has = flag => argv.includes(flag);
  const valueOf = flag => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);

  if (has('--lane')) return runLane(valueOf('--lane'), { env });

  let paths;
  let source;
  if (has('--all')) {
    paths = null;
    source = 'everything was asked for';
  } else if (has('--ci')) {
    let event = {};
    try { event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')); } catch { /* read as no range */ }
    const main = event?.repository?.default_branch || 'main';
    const onMain = env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === `refs/heads/${main}`;
    const lastGreen = onMain ? await lastGreenSha({ ...env, DEFAULT_BRANCH: main }) : null;
    const range = ciRange({ eventName: env.GITHUB_EVENT_NAME, event, ref: env.GITHUB_REF, sha: env.GITHUB_SHA, lastGreen });
    paths = range ? pathsOfRange(range) : null;
    source = `${env.GITHUB_EVENT_NAME} ${range ? range.join(' ') : 'with no readable range'}` +
      (onMain ? `, from the last passing run on ${main}${lastGreen ? '' : ', which could not be read'}` : '');
  } else if (has('--range')) {
    const range = valueOf('--range');
    paths = range ? pathsOfRange([range]) : null;
    source = `range ${range}`;
  } else {
    paths = localPaths();
    source = 'this checkout against origin/main, working tree and untracked files included';
  }

  const decided = has('--all') ? { ...plan(null), reason: 'everything was asked for' } : plan(paths);
  const words = describe(decided, source);
  console.log(words);

  if (has('--ci')) {
    const outputs = [`lanes=${decided.lanes.join(' ')}`, ...ORDER.map(lane => `${lane}=${decided.lanes.includes(lane)}`),
      `install=${decided.lanes.includes('v3') || decided.lanes.includes('v4')}`];
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${outputs.join('\n')}\n`);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `## Gate by what changed\n\n\`\`\`\n${words}\n\`\`\`\n`);
  }
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
