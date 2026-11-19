/**
 * The gate's own tests (GATE-01): the sorting rule, mixed pushes included, how
 * a change is read in CI and in a checkout, and the guards that keep the
 * record-only list safe. Node's built-in runner, so no dependency is added and
 * v3's frozen Vitest suite is untouched: `node --test scripts/gate.test.mjs`.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative } from 'node:path';

import {
  LANES, RECORD, ROOT, V3, V4, V4_BUDGET_SECONDS,
  ciRange, classify, describe as describePlan, git, lastGreenSha, localPaths, pathsOfRange, plan, runLane,
  trackedLinks
} from './gate.mjs';

const EVERYTHING = ['gate', 'v3', 'v4', 'record'];
const NO_V4 = { files: [], dirs: [] };
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const ZERO = '0'.repeat(40);
const SOME_V4 = { files: ['tsconfig.json'], dirs: ['app/'] };

describe('classify', () => {
  test('the record-only list', () => {
    for (const path of [
      'AGENTS.md', 'CLAUDE.md', 'UI-STANDARDS.md', 'DEV-INFRASTRUCTURE.md', 'README.md',
      'project/backlog.md', 'project/items/GATE-01.md', 'project/digests/carbon.md',
      'verbs/close.md', 'tools/check.mjs', 'tools/VERSION', 'reviews/v4-programme-2026-11-18.md',
      'reviews/some/deep/file.png', 'pm_skills/project/conventions.md'
    ]) assert.equal(classify(path), 'record', path);
  });

  test("frozen v3's code, tests and build, under v3/ since STACK-01", () => {
    for (const path of [
      'v3/src/app/main.js', 'v3/styles/main.css', 'v3/tests/governance.test.js', 'v3/tests/helpers/bootApp.js',
      'v3/images/Court.png', 'v3/index.html', 'v3/build.js', 'v3/push.js', 'v3/vitest.config.js',
      'v3/public-assets.json', 'v3/package.json', 'v3/package-lock.json', 'v3/version.json', 'v3/LICENSE',
      'v3/THIRD_PARTY_NOTICES.md', 'v3/scripts/restart.sh', 'v3/scripts/build.sh', 'v3/scripts/perf-harness.js',
      'v3/scripts/build-examples.mjs', 'v3/scripts/README.md', 'v3/docs/app.js', 'v3/new-file.txt',
      // v3's governance test reads these two from the root.
      '.github/SECURITY.md', '.github/SUPPORT.md'
    ]) assert.equal(classify(path), 'v3', path);
  });

  test('the paths v3 left at the root are not v3 any more: v4 took src/, tests/, index.html and the package', () => {
    const left = [
      'styles/main.css', 'images/Court.png', 'build.js', 'push.js', 'vitest.config.js', 'public-assets.json',
      'LICENSE', 'THIRD_PARTY_NOTICES.md', 'scripts/restart.sh', 'scripts/build.sh', 'scripts/perf-harness.js',
      'scripts/build-examples.mjs', 'scripts/README.md'
    ];
    for (const path of left) assert.equal(classify(path), 'other', path);
    for (const path of left) assert.deepEqual(plan([path]).lanes, EVERYTHING, path);
    for (const path of ['src/app/main.js', 'tests/governance.test.js', 'index.html', 'package.json']) {
      assert.equal(classify(path), 'v4', path);
    }
  });

  test('everything else is other, near misses included', () => {
    for (const path of [
      '.github/workflows/ci.yml', 'scripts/gate.mjs', 'scripts/gate.test.mjs', 'scripts/new-script.sh',
      '.npmrc', 'vitest.config.mjs', 'playwright.config.ts', 'dist/index.html', '.nvmrc', '.gitignore', '.editorconfig', '.claude/settings.json',
      'docs/index.html', 'version.json', 'specs/dot-crowd-navigator/README.md', '_Joe/dev notes/task list.md',
      'Route Plotter v3.code-workspace',
      // Near misses: only the exact spelling at the root counts.
      'project', 'Project/backlog.md', 'readme.md', 'README.md.orig', 'docs/AGENTS.md', 'tools',
      'toolsx/check.mjs', 'reviews.md', 'LICENSE.txt', 'scripts/gate.sh',
      'v3', 'V3/src/a.js', 'v3x/src/a.js', 'docs/v3/app.js', '.github/workflows/v3.yml',
      'src', 'Src/main.tsx', 'srcx/a.ts', 'testsx/a.mjs', 'docs/src/a.js', 'tsconfig.json.orig'
    ]) assert.equal(classify(path), 'other', path);
    // A record folder's name below the root is not the record.
    assert.equal(classify('v3/src/project/x.js'), 'v3');
    assert.equal(classify('v3/project/backlog.md'), 'v3');
  });

  test("v4's paths, listed by STACK-02: the root package, the stack's settings, the page, src/ and tests/", () => {
    for (const path of [
      'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'tsconfig.base.json', 'tsconfig.app.json',
      'tsconfig.core.json', 'vite.config.mjs', 'eslint.config.mjs', 'eslint.base.mjs', 'eslint.a11y.mjs', 'knip.json', '.dependency-cruiser.cjs',
      'src/main.tsx', 'src/core/model.ts', 'src/exported/player.ts', 'src/features/crowd/model/x.ts',
      'tests/bundle/player.test.mjs', 'tests/a11y/states.spec.ts'
    ]) assert.equal(classify(path), 'v4', path);
    // A v3 or record path keeps its class whatever v4 lists.
    assert.equal(classify('v3/src/app/main.js'), 'v3');
    assert.equal(classify('v3/package.json'), 'v3');
    assert.equal(classify('project/app/set1.json'), 'record');
    assert.equal(classify('app/main.tsx'), 'other');
    assert.equal(classify('app/main.tsx', { v4: SOME_V4 }), 'v4');
  });
});

describe('plan', () => {
  test('a record-only change runs the record checker alone', () => {
    assert.deepEqual(plan(['project/backlog.md']).lanes, ['record']);
    assert.deepEqual(plan(['AGENTS.md', 'reviews/x.md', 'tools/check.mjs', 'verbs/close.md']).lanes, ['record']);
  });

  test("a v3 change runs v3's whole suite, with the gate's tests and the record checker", () => {
    assert.deepEqual(plan(['v3/src/app/main.js']).lanes, ['gate', 'v3', 'record']);
    assert.deepEqual(plan(['v3/tests/governance.test.js', 'v3/LICENSE']).lanes, ['gate', 'v3', 'record']);
    assert.deepEqual(plan(['.github/SECURITY.md']).lanes, ['gate', 'v3', 'record']);
  });

  test('mixed pushes run every lane any of their paths asks for', () => {
    assert.deepEqual(plan(['project/backlog.md', 'v3/src/app/main.js']).lanes, ['gate', 'v3', 'record']);
    assert.deepEqual(plan(['project/backlog.md', '.nvmrc']).lanes, EVERYTHING);
    assert.deepEqual(plan(['v3/src/app/main.js', '.github/workflows/ci.yml']).lanes, EVERYTHING);
    assert.deepEqual(plan(['v3/src/app/main.js', 'scripts/gate.mjs']).lanes, EVERYTHING);
    assert.deepEqual(plan(['project/backlog.md', 'v3/src/app/main.js', 'specs/x.md']).lanes, EVERYTHING);
  });

  test('a change that is empty or cannot be read runs everything', () => {
    assert.deepEqual(plan([]).lanes, EVERYTHING);
    assert.deepEqual(plan(null).lanes, EVERYTHING);
  });

  test("a v4 change runs v4's gate and the record checker, never v3's suite (STACK-02)", () => {
    assert.deepEqual(plan(['src/main.tsx']).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['src/core/model.ts', 'tests/bundle/player.test.mjs', 'package-lock.json']).lanes,
      ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['src/main.tsx', 'project/backlog.md']).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['src/main.tsx', 'v3/src/app/main.js']).lanes, ['gate', 'v3', 'v4', 'record']);
    assert.deepEqual(plan(['v3/src/app/main.js']).lanes, ['gate', 'v3', 'record']);
    for (const path of ['.github/workflows/ci.yml', 'scripts/gate.mjs', 'scripts/gate.test.mjs']) {
      assert.deepEqual(plan([path]).lanes, EVERYTHING, path);
    }
  });

  test("v4's lane runs only once v4 has paths", () => {
    const v4 = SOME_V4;
    assert.ok(!plan(['package.json'], { v4: NO_V4 }).lanes.includes('v4'));
    assert.deepEqual(plan(null, { v4: NO_V4 }).lanes, ['gate', 'v3', 'record']);
    assert.deepEqual(plan(['app/main.tsx'], { v4 }).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['app/main.tsx', 'project/backlog.md'], { v4 }).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['app/main.tsx', 'v3/src/app/main.js'], { v4 }).lanes, ['gate', 'v3', 'v4', 'record']);
    assert.deepEqual(plan(['app/main.tsx', 'package.json'], { v4 }).lanes, ['gate', 'v3', 'v4', 'record']);
    assert.deepEqual(plan(null, { v4 }).lanes, ['gate', 'v3', 'v4', 'record']);
  });

  test('the plan says why, path by path', () => {
    const words = describePlan(plan(['project/backlog.md', '.nvmrc', 'src/main.tsx']), 'a test');
    assert.match(words, /record\s+project\/backlog\.md/);
    assert.match(words, /other\s+\.nvmrc/);
    assert.match(words, /v4\s+src\/main\.tsx/);
    assert.match(words, /outside the record, v3 and v4 lists/);
  });
});

describe('ciRange', () => {
  const repository = { default_branch: 'main' };

  test('a pull request is read from where it left its base', () => {
    const event = { repository, pull_request: { base: { sha: SHA_A }, head: { sha: SHA_B } } };
    assert.deepEqual(ciRange({ eventName: 'pull_request', event, ref: 'refs/pull/7/merge', sha: SHA_A }),
      [`${SHA_A}...${SHA_B}`]);
  });

  test("a push to a branch is read against the default branch, not the push before it", () => {
    const event = { repository, before: SHA_A };
    assert.deepEqual(ciRange({ eventName: 'push', event, ref: 'refs/heads/gate-01/x', sha: SHA_B }),
      [`origin/main...${SHA_B}`]);
  });

  test("a push to the default branch is read from main's last passing run, not the commit before it", () => {
    const event = { repository, before: SHA_A };
    const lastGreen = 'c'.repeat(40);
    assert.deepEqual(ciRange({ eventName: 'push', event, ref: 'refs/heads/main', sha: SHA_B, lastGreen }),
      [lastGreen, SHA_B]);
  });

  test('anything without a safe range has none, so it runs everything', () => {
    // On main, with no passing run to read from, `before` alone is not trusted.
    assert.equal(ciRange({ eventName: 'push', event: { repository, before: SHA_A }, ref: 'refs/heads/main', sha: SHA_B }),
      null);
    assert.equal(ciRange({ eventName: 'push', event: { repository }, ref: 'refs/heads/main', sha: SHA_B, lastGreen: ZERO }),
      null);
    assert.equal(ciRange({ eventName: 'push', event: { repository, before: SHA_A }, ref: 'refs/tags/v1', sha: SHA_B }),
      null);
    assert.equal(ciRange({ eventName: 'push', event: { repository, before: SHA_A }, ref: 'refs/heads/x', sha: 'HEAD' }),
      null);
    assert.equal(ciRange({ eventName: 'pull_request', event: { pull_request: { base: { sha: SHA_A } } } }), null);
    assert.equal(ciRange({ eventName: 'workflow_dispatch', event: {}, ref: 'refs/heads/main', sha: SHA_B }), null);
    assert.equal(ciRange({ eventName: undefined, event: {}, ref: undefined, sha: undefined }), null);
  });
});

describe('lastGreenSha', () => {
  const env = { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', DEFAULT_BRANCH: 'main',
    GITHUB_WORKFLOW_REF: 'o/r/.github/workflows/ci.yml@refs/heads/main' };
  const answer = (body, ok = true) => async () => ({ ok, json: async () => body });

  test("reads the newest passing push run of this workflow on main", async () => {
    let asked;
    const fetchImpl = async (url, options) => {
      asked = { url, options };
      return { ok: true, json: async () => ({ workflow_runs: [{ head_sha: SHA_A }] }) };
    };
    assert.equal(await lastGreenSha(env, fetchImpl), SHA_A);
    const url = new URL(asked.url);
    assert.equal(url.pathname, '/repos/o/r/actions/workflows/ci.yml/runs');
    assert.deepEqual(Object.fromEntries(url.searchParams),
      { branch: 'main', event: 'push', status: 'success', per_page: '1' });
    assert.equal(asked.options.headers.authorization, 'Bearer t');
  });

  test('anything it cannot read is null, so the push runs everything', async () => {
    assert.equal(await lastGreenSha(env, answer({ workflow_runs: [] })), null);
    assert.equal(await lastGreenSha(env, answer({ workflow_runs: [{ head_sha: 'not-a-sha' }] })), null);
    assert.equal(await lastGreenSha(env, answer({}, false)), null);
    assert.equal(await lastGreenSha(env, async () => { throw new Error('offline'); }), null);
    assert.equal(await lastGreenSha({ ...env, GITHUB_TOKEN: undefined }, answer({ workflow_runs: [{ head_sha: SHA_A }] })),
      null);
  });
});

describe('reading a change from git', () => {
  /** A scratch repository with two v3 files, a record file and origin/main. */
  function scratch() {
    const dir = mkdtempSync(join(tmpdir(), 'gate-01-'));
    const run = (...args) => {
      const result = spawnSync('git', ['-c', 'user.name=gate', '-c', 'user.email=gate@example.invalid',
        '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    const write = (path, text) => {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    };
    run('init', '-q', '-b', 'main');
    write('v3/src/a.js', 'export const a = 1;\n');
    write('v3/src/b.js', 'export const b = 2;\n');
    write('project/backlog.md', '# Backlog\n');
    run('add', '-A');
    run('commit', '-q', '-m', 'start');
    run('update-ref', 'refs/remotes/origin/main', 'HEAD');
    run('switch', '-q', '-c', 'work');
    return { dir, run, write, done: () => rmSync(dir, { recursive: true, force: true }) };
  }

  test('a record-only branch is record-only, in a commit or in the working tree', () => {
    const repo = scratch();
    try {
      repo.write('project/backlog.md', '# Backlog\n- [ ] X\n');
      assert.deepEqual(plan(localPaths(repo.dir)).lanes, ['record']);
      repo.run('commit', '-q', '-am', 'record');
      assert.deepEqual(localPaths(repo.dir), ['project/backlog.md']);
      assert.deepEqual(plan(pathsOfRange([`origin/main...${repo.run('rev-parse', 'HEAD')}`], repo.dir)).lanes,
        ['record']);
      repo.write('reviews/new.md', 'untracked\n');
      assert.deepEqual(localPaths(repo.dir), ['project/backlog.md', 'reviews/new.md']);
    } finally {
      repo.done();
    }
  });

  test('a file moved from v3 into the record still counts as v3', () => {
    const repo = scratch();
    try {
      repo.run('mv', 'v3/src/a.js', 'project/a.js');
      repo.run('commit', '-q', '-m', 'move');
      const paths = pathsOfRange(['origin/main...HEAD'], repo.dir);
      assert.deepEqual(paths.sort(), ['project/a.js', 'v3/src/a.js']);
      assert.deepEqual(plan(paths).lanes, ['gate', 'v3', 'record']);
    } finally {
      repo.done();
    }
  });

  test('a deletion, an untracked file and a staged change are all read', () => {
    const repo = scratch();
    try {
      repo.run('rm', '-q', 'v3/src/b.js');
      repo.run('commit', '-q', '-m', 'delete');
      assert.deepEqual(localPaths(repo.dir), ['v3/src/b.js']);
      repo.run('reset', '-q', '--hard', 'origin/main');
      repo.write('notes.txt', 'loose\n');
      assert.deepEqual(plan(localPaths(repo.dir)).lanes, EVERYTHING);
      rmSync(join(repo.dir, 'notes.txt'));
      repo.write('v3/src/a.js', 'export const a = 3;\n');
      repo.run('add', 'v3/src/a.js');
      assert.deepEqual(localPaths(repo.dir), ['v3/src/a.js']);
    } finally {
      repo.done();
    }
  });

  test('a push to main reads every commit since the last passing run, merges included', () => {
    const repo = scratch();
    try {
      const green = repo.run('rev-parse', 'HEAD');
      repo.write('v3/src/a.js', 'export const a = 4;\n');
      repo.run('commit', '-q', '-am', 'v3');
      repo.run('switch', '-q', 'main');
      repo.write('project/backlog.md', '# Backlog\n- [x] Y\n');
      repo.run('commit', '-q', '-am', 'record on main');
      repo.run('merge', '-q', '--no-edit', 'work');
      const after = repo.run('rev-parse', 'HEAD');
      const range = ciRange({ eventName: 'push', event: {}, ref: 'refs/heads/main', sha: after, lastGreen: green });
      assert.deepEqual(pathsOfRange(range, repo.dir).sort(), ['project/backlog.md', 'v3/src/a.js']);
    } finally {
      repo.done();
    }
  });

  test("a v3 push whose run was replaced or failed is read again by the record-only push after it", () => {
    // Codex's sequence: main passed at P; push B changes v3 and its run is
    // replaced while it waits (or fails); push C changes only the record.
    const repo = scratch();
    try {
      repo.run('switch', '-q', 'main');
      const passed = repo.run('rev-parse', 'HEAD');
      repo.write('v3/src/b.js', 'export const b = 5;\n');
      repo.run('commit', '-q', '-am', 'B: v3');
      const b = repo.run('rev-parse', 'HEAD');
      repo.write('project/backlog.md', '# Backlog\n- [ ] C\n');
      repo.run('commit', '-q', '-am', 'C: record');
      const c = repo.run('rev-parse', 'HEAD');
      const range = ciRange({ eventName: 'push', event: { before: b }, ref: 'refs/heads/main', sha: c, lastGreen: passed });
      assert.deepEqual(plan(pathsOfRange(range, repo.dir)).lanes, ['gate', 'v3', 'record']);
      // Read from the commit before it, C alone would have looked record-only.
      assert.deepEqual(plan(pathsOfRange([b, c], repo.dir)).lanes, ['record']);
    } finally {
      repo.done();
    }
  });

  test('every tracked link is found, chained ones included', () => {
    // Codex's chain: v3/src/alias -> ../images, then v3/LICENSE -> src/alias/../../project/license.txt,
    // which a lexical reading places in v3/ but the file system places in the record.
    const repo = scratch();
    try {
      repo.write('project/license.txt', 'terms\n');
      mkdirSync(join(repo.dir, 'v3', 'images'));
      symlinkSync('../images', join(repo.dir, 'v3', 'src', 'alias'));
      symlinkSync('src/alias/../../project/license.txt', join(repo.dir, 'v3', 'LICENSE'));
      symlinkSync('a.js', join(repo.dir, 'v3', 'src', 'c.js'));
      repo.run('add', '-A');
      assert.deepEqual(trackedLinks(repo.dir), ['v3/LICENSE', 'v3/src/alias', 'v3/src/c.js']);
    } finally {
      repo.done();
    }
  });

  test('a change that cannot be read is null, so it runs everything', () => {
    const repo = scratch();
    try {
      assert.equal(pathsOfRange([`${SHA_A}...HEAD`], repo.dir), null);
      repo.run('update-ref', '-d', 'refs/remotes/origin/main');
      assert.equal(localPaths(repo.dir), null);
      assert.deepEqual(plan(localPaths(repo.dir)).lanes, EVERYTHING);
    } finally {
      repo.done();
    }
  });
});

describe('runLane', () => {
  const quiet = { log: () => {}, env: {} };

  test('a lane stops at its first failing command and returns its status', () => {
    const lanes = { probe: { title: 'probe', commands: [
      [process.execPath, ['-e', 'process.exit(3)']],
      [process.execPath, ['-e', 'throw new Error("must not run")']]
    ] } };
    assert.equal(runLane('probe', { ...quiet, lanes }), 3);
  });

  test("a lane over its budget is a finding and still passes", () => {
    const said = [];
    let clock = 0;
    const lanes = { slow: { title: 'slow', budgetSeconds: 1, commands: [[process.execPath, ['-e', '']]] } };
    const status = runLane('slow', { env: {}, log: line => said.push(line), lanes, now: () => (clock += 5000) });
    assert.equal(status, 0);
    assert.ok(said.some(line => /^FINDING: slow took 5 s, over its budget of 1 s/.test(line)), said.join('\n'));
  });

  test("a lane runs from its own folder, and v3's from v3/", () => {
    assert.equal(LANES.v3.cwd, 'v3');
    for (const lane of ['gate', 'v4', 'record']) assert.equal(LANES[lane].cwd, undefined, lane);
    const here = [process.execPath, ['-e', 'process.exit(process.cwd() === process.env.WANT ? 0 : 7)']];
    const lanes = { root: { title: 'root', commands: [here] }, v3: { title: 'v3', cwd: 'v3', commands: [here] } };
    assert.equal(runLane('root', { ...quiet, env: { ...process.env, WANT: ROOT }, lanes }), 0);
    assert.equal(runLane('v3', { ...quiet, env: { ...process.env, WANT: join(ROOT, 'v3') }, lanes }), 0);
    assert.equal(runLane('v3', { ...quiet, env: { ...process.env, WANT: ROOT }, lanes }), 7);
  });

  test("v4's gate has the 10-minute budget the owner chose", () => {
    assert.equal(V4_BUDGET_SECONDS, 600);
    assert.equal(LANES.v4.budgetSeconds, 600);
  });

  test('an unknown lane is refused', () => {
    assert.throws(() => runLane('nope', quiet), /no lane named nope/);
  });
});

describe('the gate as wired in this repository', () => {
  const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
  const read = path => readFileSync(join(ROOT, path), 'utf8');

  test('every listed file and folder exists, so a typo cannot hide a path', () => {
    for (const list of [RECORD, V3, V4]) {
      for (const file of list.files) assert.ok(tracked.includes(file), file);
      for (const dir of list.dirs) assert.ok(tracked.some(path => path.startsWith(dir)), dir);
    }
  });

  // A record-only path named in a file; a folder counts when a path follows it, so `/Failed to load project/` (a
  // regular expression) does not.
  const escape = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const recordPath = new RegExp(`(?<![\\w.-])(${RECORD.files.map(escape).join('|')}|` +
    `(?:${RECORD.dirs.map(dir => escape(dir.slice(0, -1))).join('|')})/(?=[\\w.-]))`, 'g');
  // v3's code and v4's: scripts, TypeScript, React, markup, styles, settings, shell.
  const CODE = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.html', '.css', '.scss', '.json', '.sh']);

  test('the record-path guard reads v4\'s TypeScript, React and Sass, and finds a planted record dependency', () => {
    for (const ext of ['.ts', '.tsx', '.scss', '.mjs', '.json']) assert.ok(CODE.has(ext), ext);
    const found = text => [...text.matchAll(recordPath)].map(([, name]) => name);
    assert.deepEqual(found("import set from '../../project/app/set1.json';"), ['project/']);
    assert.deepEqual(found("@use '../../tools/theme';"), ['tools/']);
    assert.deepEqual(found("fetch('README.md')"), ['README.md']);
    assert.deepEqual(found('/Failed to load project/; projects/x; myproject/x'), []);
  });

  test("no v3 or v4 code, test or build file names a record-only path, so the record cannot change their result", () => {
    // Mentions in comments, read by hand on 2026-11-18: none reads a record file. v3's
    // package.json names tools/ in its `check` script, which ends by running the record
    // checker from the root, the record lane's own command; the v3 lane does not run it.
    // Three of v4's settings, copied from the PM-Skills app pack (STACK-02), cite in a comment
    // the pack's own `lab/next-v31/app/README.md`, not this repository's README.md.
    // STACK-03, a known gap and not a comment: the accessibility pack keeps its run and report in
    // tools/ and its catalogue and coverage file in project/a11y/, where the pack's own refresh
    // looks for them. v4's gate runs them (package.json's `a11y` script) and its helpers read the
    // catalogue and coverage file, so a change to those alone sorts as record and skips the v4
    // lane until the gate sorts them as v4 (wish STACK-03.1). project.mjs and the Playwright
    // configuration only name them in comments.
    const known = new Set([
      'v3/src/services/HTMLExportService.js UI-STANDARDS.md', 'v3/src/app/privacy.js project/',
      'v3/scripts/restart.sh DEV-INFRASTRUCTURE.md', 'v3/scripts/perf-harness.js DEV-INFRASTRUCTURE.md',
      'v3/package.json tools/',
      '.dependency-cruiser.cjs README.md', 'eslint.base.mjs README.md', 'vite.config.mjs README.md',
      'package.json tools/', 'tests/a11y/helpers.ts project/', 'tests/a11y/project.mjs project/',
      'tests/a11y/playwright.config.ts tools/'
    ]);
    const found = [];
    for (const path of tracked) {
      if (!['v3', 'v4'].includes(classify(path)) || !CODE.has(extname(path))) continue;
      for (const [, name] of read(path).matchAll(recordPath)) {
        if (!known.has(`${path} ${name}`)) found.push(`${path} ${name}`);
      }
    }
    assert.deepEqual(found, []);
  });

  test('no file is a tracked link, so no v3 path can be a record path in disguise', () => {
    assert.deepEqual(trackedLinks(), []);
  });

  test("v3's npm run check still runs its whole suite and the record checker, as its release helper expects", () => {
    const { scripts } = JSON.parse(read('v3/package.json'));
    const asText = ([command, args]) => [command === process.execPath ? 'node' : command, ...args].join(' ');
    // From v3/, where npm runs it, back to the root, where the record checker runs.
    const back = `cd ${relative(join(ROOT, LANES.v3.cwd), ROOT)}`;
    const v3AndRecord = [...LANES.v3.commands.map(asText), back, ...LANES.record.commands.map(asText)].join(' && ');
    assert.equal(back, 'cd ..');
    assert.equal(scripts.check, v3AndRecord);
    assert.equal(scripts['check:changed'], 'node ../scripts/gate.mjs');
  });

  test("the root's npm run check is the sorted gate, and check:v4 is v4's whole gate, as the v4 lane runs it", () => {
    const { scripts, dependencies, devDependencies } = JSON.parse(read('package.json'));
    assert.equal(scripts.check, 'node scripts/gate.mjs');
    assert.deepEqual(LANES.v4.commands, [['npm', ['run', 'check:v4']]]);
    // STACK-03: the accessibility run comes after the build it serves, then the proof that it fails on the two
    // planted faults the item names.
    assert.equal(scripts['check:v4'], ['typecheck', 'lint', 'boundaries', 'deadcode', 'test', 'build', 'test:bundle',
      'a11y', 'a11y:known-bad'].map(name => (name === 'test' ? 'npm test' : `npm run ${name}`)).join(' && '));
    assert.equal(scripts.test, 'vitest run --maxWorkers=3');
    assert.equal(scripts.build, 'vite build && vite build --mode player');
    assert.equal(scripts.a11y, 'node tools/a11y-run.mjs');
    assert.equal(scripts['a11y:known-bad'], 'node tests/a11y/non-vacuity.mjs');
    // Every package at an exact version: no range, tag or path; an override too.
    const overrides = Object.values(JSON.parse(read('package.json')).overrides ?? {}).flatMap(Object.entries);
    for (const [name, version] of [...Object.entries({ ...dependencies, ...devDependencies }), ...overrides]) {
      assert.match(version, /^\d+\.\d+\.\d+$/, name);
    }
  });

  test("the accessibility run (STACK-03) writes outside the checkout, from the pack's files, at level AAA", () => {
    // Playwright's configuration sends every output to the run folder the gate makes in the system's temporary folder.
    const config = read('tests/a11y/playwright.config.ts');
    assert.match(config, /outputDir: join\(run, 'output'\)/);
    assert.match(config, /outputFile: join\(run, 'playwright\.json'\)/);
    assert.match(config, /updateSnapshots: 'none'/);
    assert.match(read('tools/a11y-run.mjs'), /mkdtempSync\(join\(real\(tmpdir\(\)\), 'a11y-run-'\)\)/);
    // The level is AAA, and the shell is declared, with the server the gate starts.
    assert.equal(JSON.parse(read('project/a11y/coverage.json')).level, 'AAA');
    const project = read('tests/a11y/project.mjs');
    assert.match(project, /name: 'shell',\n\s+path: '\/'/);
    assert.match(project, /command: 'npm run preview -- --port 4173 --strictPort'/);
    // The routed document stays out of the live site's folder.
    assert.ok(tracked.includes('project/a11y/accessibility.md'));
    assert.ok(!tracked.some(path => /^docs\/(accessibility|extended)\.md$/.test(path)));
  });

  test("v4's settings leave frozen v3 and the record's tools/ alone", () => {
    // v3's esbuild reads the nearest tsconfig.json above each file and would take v4's strict as "use strict" in its
    // player: the root one names only v4's two projects and sets no option (STACK-02).
    assert.deepEqual(JSON.parse(read('tsconfig.json')),
      { files: [], references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.core.json' }] });
    assert.deepEqual(JSON.parse(read('tsconfig.app.json')).include, ['src']);
    assert.deepEqual(JSON.parse(read('tsconfig.core.json')).include, ['src/core']);
    const knip = JSON.parse(read('knip.json'));
    assert.ok(knip.ignore.includes('v3/**'));
    assert.equal(knip.node, false, "knip's Node test-runner plugin would sweep v3's and the gate's tests");
    for (const glob of [...knip.entry, ...knip.project]) assert.match(glob, /^(src|tests)\/|^eslint\.(base|a11y)\.mjs$/, glob);
    const { scripts } = JSON.parse(read('package.json'));
    for (const name of ['lint', 'boundaries']) assert.match(scripts[name], / src$/, name);
  });

  test('CI sorts first, runs each lane in its own step, and runs the record checker on every push', () => {
    const workflow = read('.github/workflows/ci.yml');
    const steps = workflow.split(/\n\s+- name: /).slice(1);
    const stepRunning = text => steps.filter(step => step.includes(text));
    assert.match(workflow, /fetch-depth: 0/);
    // Runs on main never share a group, so none is replaced while it waits.
    assert.match(workflow, /group: verify-\$\{\{ github\.ref == 'refs\/heads\/main' && github\.run_id \|\| github\.ref \}\}/);
    assert.match(workflow, /cancel-in-progress: \$\{\{ github\.ref != 'refs\/heads\/main' \}\}/);
    assert.match(workflow, /\n {2}actions: read\n/);
    const sort = stepRunning('node scripts/gate.mjs --ci --plan');
    assert.equal(sort.length, 1);
    assert.match(sort[0], /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
    const installs = stepRunning('npm ci');
    assert.equal(installs.length, 2);
    // v3's package and lockfile live in v3/ (STACK-01), v4's at the root (STACK-02); each installs for its own lane.
    const [v3Install] = installs.filter(step => /working-directory: v3\n/.test(step));
    assert.match(v3Install, /if: steps\.sort\.outputs\.v3 == 'true'/);
    assert.match(v3Install, /run: npm ci\n/);
    const [v4Install] = installs.filter(step => !/working-directory/.test(step));
    assert.match(v4Install, /if: steps\.sort\.outputs\.v4 == 'true'/);
    // Install scripts off: Carbon's and IBM Plex's run IBM's telemetry in CI.
    assert.match(v4Install, /run: npm ci --ignore-scripts\n/);
    assert.match(v4Install, /IBM_TELEMETRY_DISABLED: 'true'/);
    assert.match(workflow, /cache-dependency-path: \|\n\s+v3\/package-lock\.json\n\s+package-lock\.json\n/);
    for (const lane of ['gate', 'v3', 'v4']) {
      const [step] = stepRunning(`node scripts/gate.mjs --lane ${lane}`);
      assert.ok(step, lane);
      assert.match(step, new RegExp(`if: steps\\.sort\\.outputs\\.${lane} == 'true'`), lane);
    }
    // STACK-03: the accessibility run's browser is installed by Playwright's own installer, never npx, only when v4's
    // lane runs, before it, into a folder outside the checkout that the lane is told of; then the checkout is proved
    // unchanged by v4's gate.
    const browser = stepRunning('cli.js install');
    assert.equal(browser.length, 1);
    assert.match(browser[0], /run: node node_modules\/@playwright\/test\/cli\.js install --only-shell chromium\n/);
    assert.match(browser[0], /if: steps\.sort\.outputs\.v4 == 'true'/);
    assert.ok(!/npx/.test(workflow), 'no step runs npx');
    const [v4Lane] = stepRunning('node scripts/gate.mjs --lane v4');
    for (const step of [browser[0], v4Lane]) {
      assert.match(step, /PLAYWRIGHT_BROWSERS_PATH: \$\{\{ runner\.temp \}\}\/ms-playwright$/m);
      // ubuntu-latest is newer than the pinned Playwright names; both steps take the build for the newest it supports.
      assert.match(step, /PLAYWRIGHT_HOST_PLATFORM_OVERRIDE: ubuntu24\.04-x64$/m);
    }
    assert.ok(steps.indexOf(browser[0]) < steps.indexOf(v4Lane), 'the browser is installed before the lane');
    const status = "git status --porcelain --ignored=matching --untracked-files=all | sed '/^!! dist\\/$/d'";
    assert.ok(v4Lane.includes(`${status} > "$RUNNER_TEMP/checkout-before-v4"\n`), 'the checkout is noted before the lane');
    const [unchanged] = stepRunning(`${status} | diff "$RUNNER_TEMP/checkout-before-v4" -`);
    assert.ok(unchanged && steps.indexOf(unchanged) === steps.indexOf(v4Lane) + 1, 'the proof follows the lane');
    assert.match(unchanged, /if: steps\.sort\.outputs\.v4 == 'true'/);
    const [record] = stepRunning('node scripts/gate.mjs --lane record');
    assert.ok(record && !/\bif:/.test(record), 'the record checker runs unconditionally');
    // The live site and both version files are proven untouched on every push.
    const [pages] = stepRunning('git diff --exit-code');
    assert.match(pages, /run: git diff --exit-code -- docs version\.json v3\/version\.json\n/);
    assert.ok(!/\bif:/.test(pages), 'the Pages proof runs unconditionally');
  });
});
