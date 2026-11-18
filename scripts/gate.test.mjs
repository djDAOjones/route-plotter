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
import { dirname, extname, join } from 'node:path';

import {
  LANES, RECORD, ROOT, V3, V4, V4_BUDGET_SECONDS,
  ciRange, classify, describe as describePlan, git, lastGreenSha, localPaths, pathsOfRange, plan, runLane,
  trackedLinks
} from './gate.mjs';

const EVERYTHING = ['gate', 'v3', 'record'];
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

  test("frozen v3's code, tests and build", () => {
    for (const path of [
      'src/app/main.js', 'styles/main.css', 'tests/governance.test.js', 'tests/helpers/bootApp.js',
      'images/Court.png', 'index.html', 'build.js', 'push.js', 'vitest.config.js', 'public-assets.json',
      'LICENSE', 'THIRD_PARTY_NOTICES.md', '.github/SECURITY.md', '.github/SUPPORT.md',
      'scripts/restart.sh', 'scripts/build.sh', 'scripts/perf-harness.js', 'scripts/build-examples.mjs',
      'scripts/README.md'
    ]) assert.equal(classify(path), 'v3', path);
  });

  test('everything else is other, near misses included', () => {
    for (const path of [
      '.github/workflows/ci.yml', 'scripts/gate.mjs', 'scripts/gate.test.mjs', 'scripts/new-script.sh',
      'package.json', 'package-lock.json', '.nvmrc', '.gitignore', '.editorconfig', '.claude/settings.json',
      'docs/index.html', 'version.json', 'specs/dot-crowd-navigator/README.md', '_Joe/dev notes/task list.md',
      'Route Plotter v3.code-workspace',
      // Near misses: only the exact spelling at the root counts.
      'project', 'Project/backlog.md', 'readme.md', 'README.md.orig', 'docs/AGENTS.md', 'tools',
      'toolsx/check.mjs', 'reviews.md', 'LICENSE.txt', 'scripts/gate.sh'
    ]) assert.equal(classify(path), 'other', path);
    // A record folder's name below the root is not the record.
    assert.equal(classify('src/project/x.js'), 'v3');
  });

  test("v4's paths are other until STACK-01 lists them", () => {
    assert.deepEqual(V4, { files: [], dirs: [] });
    assert.equal(classify('app/main.tsx'), 'other');
    assert.equal(classify('app/main.tsx', { v4: SOME_V4 }), 'v4');
    assert.equal(classify('tsconfig.json', { v4: SOME_V4 }), 'v4');
    assert.equal(classify('src/app/main.js', { v4: SOME_V4 }), 'v3');
  });
});

describe('plan', () => {
  test('a record-only change runs the record checker alone', () => {
    assert.deepEqual(plan(['project/backlog.md']).lanes, ['record']);
    assert.deepEqual(plan(['AGENTS.md', 'reviews/x.md', 'tools/check.mjs', 'verbs/close.md']).lanes, ['record']);
  });

  test("a v3 change runs v3's whole suite, with the gate's tests and the record checker", () => {
    assert.deepEqual(plan(['src/app/main.js']).lanes, ['gate', 'v3', 'record']);
    assert.deepEqual(plan(['tests/governance.test.js', 'LICENSE']).lanes, ['gate', 'v3', 'record']);
  });

  test('mixed pushes run every lane any of their paths asks for', () => {
    assert.deepEqual(plan(['project/backlog.md', 'src/app/main.js']).lanes, ['gate', 'v3', 'record']);
    assert.deepEqual(plan(['project/backlog.md', 'package.json']).lanes, EVERYTHING);
    assert.deepEqual(plan(['src/app/main.js', '.github/workflows/ci.yml']).lanes, EVERYTHING);
    assert.deepEqual(plan(['project/backlog.md', 'src/app/main.js', 'specs/x.md']).lanes, EVERYTHING);
  });

  test('a change that is empty or cannot be read runs everything', () => {
    assert.deepEqual(plan([]).lanes, EVERYTHING);
    assert.deepEqual(plan(null).lanes, EVERYTHING);
  });

  test("v4's lane runs only once v4 has paths", () => {
    const v4 = SOME_V4;
    assert.ok(!plan(['package.json']).lanes.includes('v4'));
    assert.deepEqual(plan(['app/main.tsx'], { v4 }).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['app/main.tsx', 'project/backlog.md'], { v4 }).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['app/main.tsx', 'src/app/main.js'], { v4 }).lanes, ['gate', 'v3', 'v4', 'record']);
    assert.deepEqual(plan(['app/main.tsx', 'package.json'], { v4 }).lanes, ['gate', 'v3', 'v4', 'record']);
    assert.deepEqual(plan(null, { v4 }).lanes, ['gate', 'v3', 'v4', 'record']);
  });

  test('the plan says why, path by path', () => {
    const words = describePlan(plan(['project/backlog.md', 'package.json']), 'a test');
    assert.match(words, /record\s+project\/backlog\.md/);
    assert.match(words, /other\s+package\.json/);
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
  /** A scratch repository with a v3 file, a record file and origin/main. */
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
    write('src/a.js', 'export const a = 1;\n');
    write('src/b.js', 'export const b = 2;\n');
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
      repo.run('mv', 'src/a.js', 'project/a.js');
      repo.run('commit', '-q', '-m', 'move');
      const paths = pathsOfRange(['origin/main...HEAD'], repo.dir);
      assert.deepEqual(paths.sort(), ['project/a.js', 'src/a.js']);
      assert.deepEqual(plan(paths).lanes, ['gate', 'v3', 'record']);
    } finally {
      repo.done();
    }
  });

  test('a deletion, an untracked file and a staged change are all read', () => {
    const repo = scratch();
    try {
      repo.run('rm', '-q', 'src/b.js');
      repo.run('commit', '-q', '-m', 'delete');
      assert.deepEqual(localPaths(repo.dir), ['src/b.js']);
      repo.run('reset', '-q', '--hard', 'origin/main');
      repo.write('notes.txt', 'loose\n');
      assert.deepEqual(plan(localPaths(repo.dir)).lanes, EVERYTHING);
      rmSync(join(repo.dir, 'notes.txt'));
      repo.write('src/a.js', 'export const a = 3;\n');
      repo.run('add', 'src/a.js');
      assert.deepEqual(localPaths(repo.dir), ['src/a.js']);
    } finally {
      repo.done();
    }
  });

  test('a push to main reads every commit since the last passing run, merges included', () => {
    const repo = scratch();
    try {
      const green = repo.run('rev-parse', 'HEAD');
      repo.write('src/a.js', 'export const a = 4;\n');
      repo.run('commit', '-q', '-am', 'v3');
      repo.run('switch', '-q', 'main');
      repo.write('project/backlog.md', '# Backlog\n- [x] Y\n');
      repo.run('commit', '-q', '-am', 'record on main');
      repo.run('merge', '-q', '--no-edit', 'work');
      const after = repo.run('rev-parse', 'HEAD');
      const range = ciRange({ eventName: 'push', event: {}, ref: 'refs/heads/main', sha: after, lastGreen: green });
      assert.deepEqual(pathsOfRange(range, repo.dir).sort(), ['project/backlog.md', 'src/a.js']);
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
      repo.write('src/b.js', 'export const b = 5;\n');
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
    // Codex's chain: src/alias -> ../images, then LICENSE -> src/alias/../project/license.txt,
    // which a lexical reading places in src/ but the file system places in the record.
    const repo = scratch();
    try {
      repo.write('project/license.txt', 'terms\n');
      mkdirSync(join(repo.dir, 'images'));
      symlinkSync('../images', join(repo.dir, 'src', 'alias'));
      symlinkSync('src/alias/../project/license.txt', join(repo.dir, 'LICENSE'));
      symlinkSync('a.js', join(repo.dir, 'src', 'c.js'));
      repo.run('add', '-A');
      assert.deepEqual(trackedLinks(repo.dir), ['LICENSE', 'src/alias', 'src/c.js']);
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
    for (const list of [RECORD, V3]) {
      for (const file of list.files) assert.ok(tracked.includes(file), file);
      for (const dir of list.dirs) assert.ok(tracked.some(path => path.startsWith(dir)), dir);
    }
  });

  test("no v3 code, test or build file names a record-only path, so the record cannot change v3's result", () => {
    const escape = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // A folder counts when a path follows it, so `/Failed to load project/` (a regular expression) does not.
    const pattern = new RegExp(`(?<![\\w.-])(${RECORD.files.map(escape).join('|')}|` +
      `(?:${RECORD.dirs.map(dir => escape(dir.slice(0, -1))).join('|')})/(?=[\\w.-]))`, 'g');
    // Mentions in comments, read by hand on 2026-11-18: none reads a record file.
    const known = new Set([
      'src/services/HTMLExportService.js UI-STANDARDS.md', 'src/app/privacy.js project/',
      'scripts/restart.sh DEV-INFRASTRUCTURE.md', 'scripts/perf-harness.js DEV-INFRASTRUCTURE.md'
    ]);
    const code = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.sh']);
    const found = [];
    for (const path of tracked) {
      if (!['v3', 'v4'].includes(classify(path)) || !code.has(extname(path))) continue;
      for (const [, name] of read(path).matchAll(pattern)) {
        if (!known.has(`${path} ${name}`)) found.push(`${path} ${name}`);
      }
    }
    assert.deepEqual(found, []);
  });

  test('no file is a tracked link, so no v3 path can be a record path in disguise', () => {
    assert.deepEqual(trackedLinks(), []);
  });

  test("npm run check still runs v3's whole suite and the record checker, as the release helper expects", () => {
    const { scripts } = JSON.parse(read('package.json'));
    const asText = ([command, args]) => [command === process.execPath ? 'node' : command, ...args].join(' ');
    const v3AndRecord = [...LANES.v3.commands, ...LANES.record.commands].map(asText).join(' && ');
    assert.equal(scripts.check, v3AndRecord);
    assert.equal(scripts['check:changed'], 'node scripts/gate.mjs');
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
    assert.match(stepRunning('npm ci')[0], /if: steps\.sort\.outputs\.install == 'true'/);
    for (const lane of ['gate', 'v3', 'v4']) {
      const [step] = stepRunning(`node scripts/gate.mjs --lane ${lane}`);
      assert.ok(step, lane);
      assert.match(step, new RegExp(`if: steps\\.sort\\.outputs\\.${lane} == 'true'`), lane);
    }
    const [record] = stepRunning('node scripts/gate.mjs --lane record');
    assert.ok(record && !/\bif:/.test(record), 'the record checker runs unconditionally');
  });
});
