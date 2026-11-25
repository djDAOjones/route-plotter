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
import { dirname, extname, join, posix, relative } from 'node:path';

import {
  LANES, RECORD, ROOT, V3, V4, V4_BUDGET_SECONDS,
  ciRange, classify, describe as describePlan, git, lastGreenSha, localPaths, pathsOfRange, plan, runLane,
  trackedLinks
} from './gate.mjs';
// PUB-01: the live site's class, the publishing step's commits and the refusal of a hand change.
import {
  PAGES, STEP, authenticateStep, isAncestor, main as gate, mainProvenance, pagesPaths, pushedLine, rangeEnds, stepCandidates,
  stepMade
} from './gate.mjs';
// GATE-02: the accessibility pack's files and the publishing step's own class.
import { A11Y, PUBLISHING, siteIntroducer } from './gate.mjs';
// GATE-03: the gate's own test file's class.
import { GATE_TESTS } from './gate.mjs';

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
      '.github/workflows/ci.yml', 'scripts/gate.mjs', 'scripts/new-script.sh',
      '.npmrc', 'vitest.config.mjs', 'playwright.config.ts', 'dist/index.html', '.nvmrc', '.gitignore', '.editorconfig', '.claude/settings.json',
      'specs/dot-crowd-navigator/README.md', '_Joe/dev notes/task list.md',
      'Route Plotter v3.code-workspace',
      // Near misses: only the exact spelling at the root counts.
      'project', 'Project/backlog.md', 'readme.md', 'README.md.orig', 'tools',
      'toolsx/check.mjs', 'reviews.md', 'LICENSE.txt', 'scripts/gate.sh',
      'v3', 'V3/src/a.js', 'v3x/src/a.js', '.github/workflows/v3.yml',
      'src', 'Src/main.tsx', 'srcx/a.ts', 'testsx/a.mjs', 'tsconfig.json.orig',
      // PUB-01: the live site's near misses (docs/ and version.json themselves are its class, below).
      'docs', 'Docs/index.html', 'docsx/index.html', 'version.json.orig', 'Version.json', 'specs/version.json'
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

  test("the accessibility pack's own files are v4's, ahead of the record that holds their folders (GATE-02)", () => {
    // Wish STACK-03.1, D70: v4's gate runs and reads them, so a change to them alone runs v4's lane.
    for (const path of [
      'tools/a11y-run.mjs', 'tools/a11y-report.mjs', 'tools/a11y-coverage.mjs', 'tools/a11y-ledger.mjs',
      'project/a11y/catalogue.json', 'project/a11y/coverage.json', 'project/a11y/accessibility.md'
    ]) {
      assert.equal(classify(path), 'v4', path);
      assert.equal(classify(path, { v4: SOME_V4 }), 'v4', path);
      assert.deepEqual(plan([path]).lanes, ['gate', 'v4', 'record'], path);
    }
    assert.deepEqual(plan(['project/a11y/coverage.json', 'project/backlog.md']).lanes, ['gate', 'v4', 'record']);
    // Only the pack's: the record's other tools and files, and near misses, stay record.
    for (const path of [
      'tools/check.mjs', 'tools/a11y.mjs', 'tools/a11y-run.js', 'tools/a11y-run.mjs.orig', 'tools/lib/a11y-run.mjs',
      'tools/a11y-/x.mjs', 'project/a11y', 'project/a11yx/coverage.json', 'project/items/STACK-03.md'
    ]) assert.equal(classify(path), 'record', path);
    assert.equal(classify('v3/tools/a11y-run.mjs'), 'v3');
  });

  test("the publishing step's own files are a class of their own (GATE-02)", () => {
    // Wish PUB-01.3: its workflow and scripts/publish*.mjs.
    for (const path of ['.github/workflows/publish.yml', 'scripts/publish.mjs', 'scripts/publish.test.mjs',
      'scripts/publish-notes.mjs']) assert.equal(classify(path), 'step', path);
    for (const path of ['.github/workflows/publish.yaml', '.github/workflows/publish.yml.orig', 'scripts/publish.sh',
      'scripts/publish/notes.mjs', 'scripts/Publish.mjs', 'scripts/republish.mjs', 'scripts/publish.mjs.orig',
      'publish.mjs']) assert.equal(classify(path), 'other', path);
    assert.equal(classify('v3/scripts/publish.mjs'), 'v3');
  });

  test("the gate's own test file is a class of its own, named exactly (GATE-03)", () => {
    assert.deepEqual(GATE_TESTS, { files: ['scripts/gate.test.mjs'], dirs: [] });
    assert.equal(classify('scripts/gate.test.mjs'), 'gate');
    // The sorting itself, and anything spelt nearly the same, stays other, so it runs everything.
    for (const path of ['scripts/gate.mjs', 'scripts/gate.test.js', 'scripts/gate.test.mjs.orig', 'scripts/Gate.test.mjs',
      'scripts/gate/gate.test.mjs', 'gate.test.mjs', 'scripts/gate.spec.mjs']) {
      assert.equal(classify(path), 'other', path);
    }
    assert.equal(classify('v3/scripts/gate.test.mjs'), 'v3');
  });

  test("STACK-04's measures script is v4's, whose lane runs it (GATE-02)", () => {
    assert.equal(classify('scripts/measures.mjs'), 'v4');
    assert.deepEqual(plan(['scripts/measures.mjs']).lanes, ['gate', 'v4', 'record']);
    for (const path of ['scripts/measures.js', 'scripts/measures.test.mjs', 'scripts/measures.mjs.orig']) {
      assert.equal(classify(path), 'other', path);
    }
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
    for (const path of ['.github/workflows/ci.yml', 'scripts/gate.mjs']) {
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

  test("the publishing step's own files run the gate's lane and v4's gate, never v3's suite (GATE-02)", () => {
    // The gate's lane holds the step's tests; v4's dead-code check (knip) reads the scripts the workflows run, as its
    // GitHub Actions plugin, which knip.json leaves on, takes them for entries.
    assert.ok(LANES.gate.commands.flat(2).includes('scripts/publish.test.mjs'), "the gate's lane has the step's tests");
    const knip = JSON.parse(readFileSync(join(ROOT, 'knip.json'), 'utf8'));
    assert.notEqual(knip['github-actions'], false, 'knip reads the workflows');
    assert.match(readFileSync(join(ROOT, '.github/workflows/publish.yml'), 'utf8'), /run: node scripts\/publish\.mjs /);
    assert.deepEqual(plan(['scripts/publish.mjs']).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['.github/workflows/publish.yml', 'scripts/publish.test.mjs']).lanes,
      ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['scripts/publish.mjs', 'project/backlog.md']).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['scripts/publish.mjs', 'docs/index.html'], { pages: 'step' }).lanes,
      ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['scripts/publish.mjs', 'src/main.tsx']).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['scripts/publish.mjs', 'v3/build.js']).lanes, ['gate', 'v3', 'v4', 'record']);
    assert.deepEqual(plan(['scripts/publish.mjs'], { v4: NO_V4 }).lanes, ['gate', 'record']);
    // Beside a path on no list, or a hand change to the live site, everything runs, as before.
    assert.deepEqual(plan(['scripts/publish.mjs', 'scripts/gate.mjs']).lanes, EVERYTHING);
    assert.deepEqual(plan(['scripts/publish.mjs', 'docs/index.html']).lanes, EVERYTHING);
    const words = describePlan(plan(['scripts/publish.mjs', 'project/backlog.md']), 'a test');
    assert.match(words, /step\s+scripts\/publish\.mjs/);
    assert.match(words, /because the change touches the publishing step$/);
    assert.match(describePlan(plan(['scripts/publish.mjs', 'src/main.tsx']), 'a test'),
      /touches v4 and the publishing step$/);
  });

  test("the gate's own test file runs the gate's lane and v4's gate, never v3's suite (GATE-03)", () => {
    // The gate's lane runs the file; frozen v3 names it nowhere, so v3's suite has nothing of it to prove.
    assert.ok(LANES.gate.commands.flat(2).includes('scripts/gate.test.mjs'), "the gate's lane runs its own tests");
    assert.ok(!LANES.v3.commands.flat(2).some(word => word.includes('gate')), "v3's lane runs nothing of the gate's");
    // git grep ends 1 when it finds nothing, 0 when it lists a file, more on an error.
    const named = spawnSync('git', ['grep', '-l', '-F', 'gate.test', '--', 'v3/'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(named.status, 1, `frozen v3 names the file nowhere: ${named.stdout}${named.stderr}`);
    assert.deepEqual(plan(['scripts/gate.test.mjs']).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['scripts/gate.test.mjs', 'project/backlog.md']).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['scripts/gate.test.mjs', 'src/main.tsx', 'tests/a11y/project.mjs']).lanes,
      ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['scripts/gate.test.mjs', 'scripts/publish.mjs']).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['scripts/gate.test.mjs', 'docs/index.html'], { pages: 'step' }).lanes,
      ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['scripts/gate.test.mjs', 'v3/build.js']).lanes, ['gate', 'v3', 'v4', 'record']);
    assert.deepEqual(plan(['scripts/gate.test.mjs'], { v4: NO_V4 }).lanes, ['gate', 'record']);
    // Beside the sorting itself, a path on no list, or a hand change to the live site, everything runs, as before.
    assert.deepEqual(plan(['scripts/gate.test.mjs', 'scripts/gate.mjs']).lanes, EVERYTHING);
    assert.deepEqual(plan(['scripts/gate.test.mjs', '.nvmrc']).lanes, EVERYTHING);
    assert.deepEqual(plan(['scripts/gate.test.mjs', 'docs/index.html']).lanes, EVERYTHING);
    const words = describePlan(plan(['scripts/gate.test.mjs', 'project/backlog.md']), 'a test');
    assert.match(words, /gate\s+scripts\/gate\.test\.mjs/);
    assert.match(words, /because the change touches the gate's own tests$/);
    assert.match(describePlan(plan(['scripts/gate.test.mjs', 'src/main.tsx']), 'a test'),
      /touches v4 and the gate's own tests$/);
    assert.match(describePlan(plan(['scripts/gate.test.mjs', 'scripts/publish.mjs']), 'a test'),
      /touches the publishing step and the gate's own tests$/);
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
      { branch: 'main', event: 'push', status: 'success', per_page: '20' });
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
    for (const list of [RECORD, V3, V4, PAGES, A11Y, PUBLISHING]) {
      for (const file of list.files) assert.ok(tracked.includes(file), file);
      for (const dir of list.dirs) assert.ok(tracked.some(path => path.startsWith(dir)), dir);
      // GATE-02: a pattern names at least one tracked file, and the whole path, from its start to its end.
      for (const pattern of list.patterns ?? []) {
        assert.ok(tracked.some(path => pattern.test(path)), String(pattern));
        assert.match(pattern.source, /^\^.*\$$/, String(pattern));
      }
    }
  });

  // A record-only path named in a file; a folder counts when a path follows it, so `/Failed to load project/` (a
  // regular expression) does not.
  const escape = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const recordPath = new RegExp(`(?<![\\w.-])(${RECORD.files.map(escape).join('|')}|` +
    `(?:${RECORD.dirs.map(dir => escape(dir.slice(0, -1))).join('|')})/(?=[\\w.-]))([\\w.*/-]*)`, 'g');
  // GATE-02: a folder's mention is read with the path that follows it, and counts only when that path is the
  // record's, since the accessibility pack's files in the record's folders are v4's (A11Y). A web address names
  // no path in this repository, so it is read past.
  const webAddress = /\bhttps?:\/\/[^\s'"`<>()]*/gi;
  const recordNames = text => [...text.replace(webAddress, ' ').matchAll(recordPath)]
    .filter(([, name, rest]) => !name.endsWith('/') || classify(posix.normalize(name + rest)) === 'record')
    .map(([, name]) => name);
  // v3's code and v4's: scripts, TypeScript, React, markup, styles, settings, shell.
  const CODE = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.html', '.css', '.scss', '.json', '.sh']);

  test('the record-path guard reads v4\'s TypeScript, React and Sass, and finds a planted record dependency', () => {
    for (const ext of ['.ts', '.tsx', '.scss', '.mjs', '.json']) assert.ok(CODE.has(ext), ext);
    const found = recordNames;
    assert.deepEqual(found("import set from '../../project/app/set1.json';"), ['project/']);
    assert.deepEqual(found("@use '../../tools/theme';"), ['tools/']);
    assert.deepEqual(found("fetch('README.md')"), ['README.md']);
    assert.deepEqual(found('/Failed to load project/; projects/x; myproject/x'), []);
    // GATE-02: the accessibility pack's files are v4's wherever they sit; the record's own files beside them, and near
    // misses, still count; a web address is not this repository, but a path beside one still counts.
    assert.deepEqual(found("node tools/a11y-run.mjs && read('project/a11y/coverage.json') // tools/a11y-*.mjs"), []);
    assert.deepEqual(found("node tools/check.mjs; '../../project/backlog.md'; tools/a11y-run.js; project/a11yx/x.json"),
      ['tools/', 'project/', 'tools/', 'project/']);
    assert.deepEqual(found("url: 'https://www.w3.org/WAI/test-evaluate/tools/selecting/'"), []);
    assert.deepEqual(found("see https://example.com/project/x and read('project/app/set1.json')"), ['project/']);
    // Only a web address is read past, and a path is read as it resolves: a file address or a climb out of the pack's
    // folder into the record's still counts (Codex's review).
    assert.deepEqual(found("readFileSync(new URL('file:///checkout/project/backlog.md'))"), ['project/']);
    assert.deepEqual(found("readFileSync('project/a11y/../backlog.md'); 'tools/a11y-run.mjs/../check.mjs'"),
      ['project/', 'tools/']);
  });

  test("no v3 or v4 code, test or build file names a record-only path, so the record cannot change their result", () => {
    // Mentions in comments, read by hand on 2026-11-18: none reads a record file. v3's
    // package.json names tools/ in its `check` script, which ends by running the record
    // checker from the root, the record lane's own command; the v3 lane does not run it.
    // Three of v4's settings, copied from the PM-Skills app pack (STACK-02), cite in a comment
    // the pack's own `lab/next-v31/app/README.md`, not this repository's README.md.
    // GATE-02: the accessibility pack's run, report and coverage check in tools/ and its catalogue
    // and coverage file in project/a11y/ are v4's (A11Y), so v4's files that run and read them name
    // no record path, and the pack's own files are read here as v4's. The measures script (STACK-04)
    // cites, in a comment, the two reviews its v3 figures were counted from; it reads no record file.
    const known = new Set([
      'v3/src/services/HTMLExportService.js UI-STANDARDS.md', 'v3/src/app/privacy.js project/',
      'v3/scripts/restart.sh DEV-INFRASTRUCTURE.md', 'v3/scripts/perf-harness.js DEV-INFRASTRUCTURE.md',
      'v3/package.json tools/',
      '.dependency-cruiser.cjs README.md', 'eslint.base.mjs README.md', 'vite.config.mjs README.md',
      'scripts/measures.mjs reviews/'
    ]);
    const found = [];
    for (const path of tracked) {
      if (!['v3', 'v4'].includes(classify(path)) || !CODE.has(extname(path))) continue;
      for (const name of recordNames(read(path))) {
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
    // STACK-04: the architecture's planted violations and the player's closure, after the build they read.
    assert.equal(scripts['check:v4'], ['typecheck', 'lint', 'boundaries', 'deadcode', 'test', 'build', 'test:bundle',
      'test:architecture', 'a11y', 'a11y:known-bad'].map(name => (name === 'test' ? 'npm test' : `npm run ${name}`)).join(' && '));
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
    // Each check measures the shell settled, drawn and with its fonts loaded (wish STACK-03.6), and offline.
    assert.match(project, /setup: settled,/);
    assert.match(project, /await offline\(\{ page \}\);\n\s+await page\.locator\('header h1'\)\.waitFor\(\);/);
    // Vite's native config loader: its default bundles the configuration into node_modules/.vite-temp first.
    assert.match(project, /command: 'npm run preview -- --port 4173 --strictPort --configLoader native'/);
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
    // STACK-04: the measures follow the lane in its step, timed, whether it passed or not, and the step fails if either
    // did; the proof below covers them, after a failing lane too.
    assert.ok(v4Lane.includes('gate=0; node scripts/gate.mjs --lane v4 || gate=$?\n'
      + '          measures=0; npm run measures -- --gate-seconds "$(( $(date +%s) - started ))" || measures=$?\n'
      + '          exit $(( gate || measures ))\n'), 'the measures follow the lane');
    const [unchanged] = stepRunning(`${status} | diff "$RUNNER_TEMP/checkout-before-v4" -`);
    assert.ok(unchanged && steps.indexOf(unchanged) === steps.indexOf(v4Lane) + 1, 'the proof follows the lane');
    assert.match(unchanged, /if: \$\{\{ !cancelled\(\) && steps\.sort\.outputs\.v4 == 'true' \}\}/);
    const [record] = stepRunning('node scripts/gate.mjs --lane record');
    assert.ok(record && !/\bif:/.test(record), 'the record checker runs unconditionally');
    // The live site and both version files are proven untouched on every push.
    const [pages] = stepRunning('git diff --exit-code');
    assert.match(pages, /run: git diff --exit-code -- docs version\.json v3\/version\.json\n/);
    assert.ok(!/\bif:/.test(pages), 'the Pages proof runs unconditionally');
  });
});

describe('the live site, which only the publishing step writes (PUB-01)', () => {
  /** A scratch repository on main with a live site, a v4 file and a record file, origin/main at its start. */
  function site() {
    const dir = mkdtempSync(join(tmpdir(), 'pub-01-gate-'));
    const env = (name, email) => ({ ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email });
    const person = env('someone', 'someone@example.invalid');
    const bot = env(STEP.name, STEP.email);
    const run = (args, as = person) => {
      const result = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8', env: as });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    const write = (path, text) => {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    };
    const commit = (message, as) => {
      run(['add', '-A'], as);
      run(['commit', '-q', '-m', message], as);
      return run(['rev-parse', 'HEAD']);
    };
    /** What the step commits: the whole site and version.json, with its trailer. */
    const publish = (text, { as = bot, trailer = `${STEP.trailer} publish.yml run 1` } = {}) => {
      rmSync(join(dir, 'docs'), { recursive: true, force: true });
      write('docs/index.html', text);
      write('version.json', `{"site":"${text}"}\n`);
      return commit(`PUB-01: publish ${text}\n\nVerify: test\n${trailer}`, as);
    };
    run(['init', '-q', '-b', 'main']);
    write('docs/index.html', 'v3');
    write('version.json', '{"build":726}\n');
    write('src/main.tsx', 'export {};\n');
    write('project/backlog.md', '# Backlog\n');
    const start = commit('start');
    run(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    return { dir, run, write, commit, publish, start, person, bot, done: () => rmSync(dir, { recursive: true, force: true }) };
  }

  test('docs/ and the root version.json are the live site; v3/ keeps its own copies', () => {
    assert.deepEqual(PAGES, { files: ['version.json'], dirs: ['docs/'] });
    for (const path of ['docs/index.html', 'docs/assets/index-abc.js', 'docs/AGENTS.md', 'docs/v3/app.js',
      'docs/src/a.js', 'docs/.nojekyll', 'version.json']) assert.equal(classify(path), 'pages', path);
    for (const path of ['v3/docs/app.js', 'v3/version.json']) assert.equal(classify(path), 'v3', path);
    assert.deepEqual(pagesPaths(['docs/a', 'src/b.ts', 'version.json', 'v3/version.json']), ['docs/a', 'version.json']);
    assert.deepEqual(pagesPaths(null), []);
  });

  test("a hand change to the live site runs everything; the step's own output runs nothing of its own", () => {
    assert.deepEqual(plan(['docs/index.html']).lanes, EVERYTHING);
    assert.deepEqual(plan(['version.json'], { pages: 'hand' }).lanes, EVERYTHING);
    assert.equal(plan(['docs/index.html']).classes.get('docs/index.html'), 'other');
    assert.deepEqual(plan(['docs/index.html', 'version.json'], { pages: 'step' }).lanes, ['record']);
    assert.deepEqual(plan(['docs/index.html', 'project/backlog.md'], { pages: 'step' }).lanes, ['record']);
    assert.deepEqual(plan(['docs/index.html', 'src/main.tsx'], { pages: 'step' }).lanes, ['gate', 'v4', 'record']);
    assert.deepEqual(plan(['docs/index.html', 'v3/build.js'], { pages: 'step' }).lanes, ['gate', 'v3', 'record']);
    assert.deepEqual(plan(['docs/index.html', '.nvmrc'], { pages: 'step' }).lanes, EVERYTHING);
    const words = describePlan(plan(['version.json'], { pages: 'step' }), 'a test');
    assert.match(words, /pages\s+version\.json/);
    assert.match(words, /the publishing step's own output/);
  });

  test("the merge after a publish reads the step's commit as the step's, so a record-only merge stays record-only", () => {
    const repo = site();
    try {
      repo.publish('v4 preview 1');
      repo.run(['switch', '-q', '-c', 'work', repo.start]);
      repo.write('project/backlog.md', '# Backlog\n- [x] A\n');
      repo.commit('A: record');
      repo.run(['switch', '-q', 'main']);
      repo.run(['merge', '-q', '--no-ff', '--no-edit', 'work']);
      const merged = repo.run(['rev-parse', 'HEAD']);
      const paths = pathsOfRange([repo.start, merged], repo.dir);
      assert.deepEqual(paths.sort(), ['docs/index.html', 'project/backlog.md', 'version.json']);
      assert.equal(stepMade(repo.start, merged, repo.dir), true);
      assert.deepEqual(plan(paths, { pages: 'step' }).lanes, ['record']);
      // Before PUB-01 the same range ran everything, v3's suite included.
      assert.deepEqual(plan(paths).lanes, EVERYTHING);
    } finally {
      repo.done();
    }
  });

  test('a take-back, a publish after it and a branch that merged main are all the step\'s', () => {
    const repo = site();
    try {
      repo.publish('v4 preview 1');
      repo.publish('v3', { trailer: `${STEP.trailer} publish.yml run 2 (take-back)` });
      const republished = repo.publish('v4 preview 2');
      assert.equal(stepMade(repo.start, republished, repo.dir), true);
      // A branch cut before the publishes that merged main in: its own range holds no site path.
      repo.run(['switch', '-q', '-c', 'work', repo.start]);
      repo.write('src/main.tsx', 'export const a = 1;\n');
      repo.commit('B: v4');
      repo.run(['merge', '-q', '--no-edit', 'main']);
      const head = repo.run(['rev-parse', 'HEAD']);
      assert.deepEqual(pathsOfRange([`main...${head}`], repo.dir), ['src/main.tsx']);
      assert.equal(stepMade(repo.start, head, repo.dir), true);
    } finally {
      repo.done();
    }
  });

  test("a hand change is never the step's: after it, without the bot, without the trailer, or beside other paths", () => {
    const repo = site();
    try {
      // After a publish, a hand edit to the site.
      repo.publish('v4 preview 1');
      repo.write('docs/index.html', 'edited');
      const edited = repo.commit('X: edit the site');
      assert.equal(stepMade(repo.start, edited, repo.dir), false);
      // The step's trailer from someone else.
      repo.run(['reset', '-q', '--hard', repo.start]);
      const forged = repo.publish('forged', { as: repo.person });
      assert.equal(stepMade(repo.start, forged, repo.dir), false);
      // The bot, without the trailer.
      repo.run(['reset', '-q', '--hard', repo.start]);
      const plain = repo.publish('plain', { trailer: 'Verify: nothing' });
      assert.equal(stepMade(repo.start, plain, repo.dir), false);
      // The bot and the trailer, beside an app path.
      repo.run(['reset', '-q', '--hard', repo.start]);
      repo.write('src/main.tsx', 'export const b = 2;\n');
      const beside = repo.publish('beside');
      assert.equal(stepMade(repo.start, beside, repo.dir), false);
      // Nothing to read is never the step's.
      assert.equal(stepMade('0'.repeat(40), beside, repo.dir), false);
    } finally {
      repo.done();
    }
  });

  test('a range is read from both its ends, three dots from where the branch left', () => {
    const repo = site();
    try {
      repo.run(['switch', '-q', '-c', 'work']);
      repo.write('src/main.tsx', 'export const c = 3;\n');
      const head = repo.commit('C: v4');
      repo.run(['switch', '-q', 'main']);
      repo.write('project/backlog.md', '# Backlog\n- [ ] D\n');
      repo.commit('D: record');
      assert.deepEqual(rangeEnds([`main...${head}`], repo.dir), [repo.start, head]);
      assert.deepEqual(rangeEnds([`main..${head}`], repo.dir), ['main', head]);
      assert.deepEqual(rangeEnds(['a', 'b'], repo.dir), ['a', 'b']);
      assert.equal(rangeEnds(['HEAD'], repo.dir), null);
    } finally {
      repo.done();
    }
  });

  /** A fake GitHub API: main's passing runs, newest first, the runs the step's commits name, their jobs and logs. */
  function github({ green = [], runs = {}, jobs = {}, logs = {}, fail = false } = {}) {
    const json = body => ({ ok: true, status: 200, json: async () => body });
    return async url => {
      const { pathname } = new URL(url);
      if (fail) return { ok: false, status: 500, json: async () => null };
      if (pathname.endsWith('/actions/workflows/ci.yml/runs')) return json({ workflow_runs: green.map(head_sha => ({ head_sha })) });
      const run = pathname.match(/\/actions\/runs\/(\d+)$/)?.[1];
      if (run && runs[run]) return json(runs[run]);
      const listed = pathname.match(/\/actions\/runs\/(\d+)\/attempts\/\d+\/jobs$/)?.[1];
      if (listed && jobs[listed]) return json({ jobs: jobs[listed] });
      const log = pathname.match(/\/actions\/jobs\/(\d+)\/logs$/)?.[1];
      if (log && logs[log] !== undefined) return { ok: true, status: 200, text: async () => logs[log] };
      return { ok: false, status: 404, json: async () => null };
    };
  }
  const publishRun = headSha => ({ path: '.github/workflows/publish.yml', head_branch: 'main', event: 'workflow_dispatch',
    repository: { full_name: 'djDAOjones/route-plotter' }, head_sha: headSha });
  /** GitHub's record of a publish run that pushed `pushed`: the run, its jobs (a dry run beside), and their logs. */
  const stepRun = (id, headSha, pushed, { status = 'completed', run = {} } = {}) => ({
    runs: { [id]: { ...publishRun(headSha), ...run } },
    jobs: { [id]: [{ id: 900 + id, name: 'dry-run', status: 'completed' }, { id, name: 'publish', status }] },
    logs: { [900 + id]: `2026-11-19T03:00:00.0000000Z ${pushedLine('d'.repeat(40))}\n`,
      [id]: `2026-11-19T03:00:00.0000000Z Committed v4.\n2026-11-19T03:00:01.0000000Z ${pushedLine(pushed)}\n` }
  });

  /** The gate exactly as CI runs it, on a pull request or a push to main, in the scratch repository. */
  async function ciSort(repo, base, head, { eventName = 'pull_request', fetchImpl = github() } = {}) {
    const said = [];
    const eventPath = join(repo.dir, '..', `${relative(tmpdir(), repo.dir).replace(/\W/g, '')}-event.json`);
    writeFileSync(eventPath, JSON.stringify({ repository: { default_branch: 'main' },
      pull_request: { base: { sha: base }, head: { sha: head } } }));
    const onMain = eventName === 'push';
    try {
      const status = await gate(['--ci', '--plan'], { GITHUB_EVENT_NAME: eventName, GITHUB_EVENT_PATH: eventPath,
        GITHUB_REF: onMain ? 'refs/heads/main' : 'refs/pull/9/merge', GITHUB_SHA: head, GITHUB_ACTIONS: 'true',
        GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'djDAOjones/route-plotter',
        GITHUB_WORKFLOW_REF: 'djDAOjones/route-plotter/.github/workflows/ci.yml@refs/heads/main' },
      { cwd: repo.dir, log: line => said.push(line), fetchImpl });
      return { status, said: said.join('\n') };
    } finally {
      rmSync(eventPath, { force: true });
    }
  }

  test('CI fails a pull request that changes docs/ or version.json, even one dressed as the step', async () => {
    const repo = site();
    try {
      repo.run(['switch', '-q', '-c', 'hand']);
      repo.write('docs/index.html', 'by hand');
      const docs = repo.commit('X: edit docs');
      let sorted = await ciSort(repo, repo.start, docs);
      assert.equal(sorted.status, 1, sorted.said);
      assert.match(sorted.said, /::error title=Hand change to the live site::.*docs\/index\.html/);

      repo.run(['reset', '-q', '--hard', repo.start]);
      repo.write('version.json', '{"build":727}\n');
      const version = repo.commit('X: bump the version');
      sorted = await ciSort(repo, repo.start, version);
      assert.equal(sorted.status, 1, sorted.said);
      assert.match(sorted.said, /by hand: version\.json/);

      // The bot's name, its trailer and nothing but the site: still refused, as the step writes only on main.
      repo.run(['reset', '-q', '--hard', repo.start]);
      const forged = repo.publish('forged');
      assert.equal(stepMade(repo.start, forged, repo.dir), true, 'shaped exactly as the step');
      assert.equal((await ciSort(repo, repo.start, forged)).status, 1);

      repo.run(['reset', '-q', '--hard', repo.start]);
      repo.write('docs/extra.txt', 'new');
      const added = repo.commit('X: add a file');
      assert.equal((await ciSort(repo, repo.start, added)).status, 1);
      repo.run(['reset', '-q', '--hard', repo.start]);
      repo.write('src/main.tsx', 'export const d = 4;\n');
      const app = repo.commit('Y: v4');
      sorted = await ciSort(repo, repo.start, app);
      assert.equal(sorted.status, 0, sorted.said);
      assert.doesNotMatch(sorted.said, /live site/);
    } finally {
      repo.done();
    }
  });

  test("on main, the step's commit counts as the step's only when its run's own log names it", async () => {
    const repo = site();
    try {
      const published = repo.publish('v4 preview 1', { trailer: `${STEP.trailer} publish.yml run 77, attempt 1` });
      repo.run(['switch', '-q', '-c', 'work', repo.start]);
      repo.write('project/backlog.md', '# Backlog\n- [x] A\n');
      repo.commit('A: record');
      repo.run(['switch', '-q', 'main']);
      repo.run(['merge', '-q', '--no-ff', '--no-edit', 'work']);
      const merged = repo.run(['rev-parse', 'HEAD']);
      const push = fetchImpl => ciSort(repo, repo.start, merged, { eventName: 'push', fetchImpl });
      const env = { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'djDAOjones/route-plotter' };

      // The record agrees: the merge after a publish runs the record checker alone.
      let sorted = await push(github({ green: [repo.start], ...stepRun(77, repo.start, published) }));
      assert.equal(sorted.status, 0, sorted.said);
      assert.match(sorted.said, /pages\s+docs\/index\.html/);
      assert.match(sorted.said, /runs the record checker, because every path is record-only or the publishing step's own output/);
      assert.equal(await mainProvenance(repo.start, merged, env, github(stepRun(77, repo.start, published)), repo.dir), 'step');

      // No such run, another workflow's run, a run on another branch, one after the commit, or an old run whose log
      // names another commit (a run's number replayed): a hand change, which fails.
      for (const record of [{}, stepRun(77, repo.start, published, { run: { path: '.github/workflows/ci.yml' } }),
        stepRun(77, repo.start, published, { run: { head_branch: 'feature' } }), stepRun(77, published, published),
        stepRun(77, repo.start, 'c'.repeat(40))]) {
        sorted = await push(github({ green: [repo.start], ...record }));
        assert.equal(sorted.status, 1, JSON.stringify(record.runs));
        assert.match(sorted.said, /::error title=Hand change to the live site::.*Run the Publish workflow by hand on main/);
      }
      // The run's job still running, or the record unreadable: everything would run, and since GATE-02 the push fails
      // too, so that a commit the record cannot vouch for never becomes main's last passing run.
      for (const fetchImpl of [github({ green: [repo.start], ...stepRun(77, repo.start, published, { status: 'in_progress' }) }),
        async url => (new URL(url).pathname.endsWith('/ci.yml/runs')
          ? { ok: true, status: 200, json: async () => ({ workflow_runs: [{ head_sha: repo.start }] }) }
          : { ok: false, status: 502, json: async () => null })]) {
        sorted = await push(fetchImpl);
        assert.equal(sorted.status, 1, sorted.said);
        assert.match(sorted.said, /::error title=Live site not vouched for::.*cannot vouch for it.*Re-run this run/);
        assert.match(sorted.said, /other\s+docs\/index\.html/);
      }
    } finally {
      repo.done();
    }
  });

  test("a step commit's run must name it: the trailer's run, its workflow, branch, event, commit and its job's log", async () => {
    const repo = site();
    try {
      const published = repo.publish('v4', { trailer: `${STEP.trailer} publish.yml run 5, attempt 2` });
      const env = { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'djDAOjones/route-plotter' };
      const [candidate] = stepCandidates(repo.start, published, repo.dir);
      assert.deepEqual(candidate, { sha: published, run: '5', attempt: '2' });
      const check = (options = {}) => authenticateStep(candidate, env, github(stepRun(5, repo.start, published, options)), repo.dir);
      assert.equal(await check(), true);
      assert.equal(await check({ run: { event: 'workflow_run' } }), true);
      assert.equal(await check({ run: { event: 'push' } }), false);
      assert.equal(await check({ run: { repository: { full_name: 'someone/route-plotter' } } }), false);
      assert.equal(await check({ run: { head_sha: published } }), false);
      assert.equal(await check({ status: 'in_progress' }), null);
      // The marker counts only on a line of its own, in the publish or take-back job: not quoted in other words, and
      // not in the dry run's job.
      const quoted = stepRun(5, repo.start, published);
      quoted.logs[5] = `2026-11-19T03:00:00.0000000Z what to try: ${pushedLine(published)} (pasted)\n`;
      assert.equal(await authenticateStep(candidate, env, github(quoted), repo.dir), false);
      const inDryRun = stepRun(5, repo.start, 'e'.repeat(40));
      inDryRun.logs[905] = `2026-11-19T03:00:00.0000000Z ${pushedLine(published)}\n`;
      assert.equal(await authenticateStep(candidate, env, github(inDryRun), repo.dir), false);
      assert.equal(await authenticateStep({ sha: published, run: null }, env, github(), repo.dir), false);
      assert.equal(await authenticateStep(candidate, env, github({ fail: true }), repo.dir), null);
      assert.equal(await authenticateStep(candidate, {}, github(), repo.dir), null);
    } finally {
      repo.done();
    }
  });

  /**
   * GATE-02: a scratch main with the step's commit and a commit by hand shaped as the step's that names the same run,
   * and GitHub's record of a run like the night's first publish: started after Verify; its publish job pushed and said
   * so; its dry run, take-back and take-back's watch were skipped, and a skipped job's log answers 404.
   */
  function replayed() {
    const repo = site();
    const trailer = `${STEP.trailer} publish.yml run 6, attempt 1`;
    const published = repo.publish('v4', { trailer });
    const forged = repo.publish('forged', { trailer });
    const real = stepRun(6, repo.start, published, { run: { event: 'workflow_run' } });
    real.jobs[6] = [
      { id: 906, name: 'dry-run', status: 'completed', conclusion: 'skipped' },
      { id: 6, name: 'publish', status: 'completed', conclusion: 'success', completed_at: '2026-11-19T03:56:58Z' },
      { id: 16, name: 'watch-publish', status: 'completed', conclusion: 'success' },
      { id: 26, name: 'take-back', status: 'completed', conclusion: 'skipped' },
      { id: 36, name: 'watch-take-back', status: 'completed', conclusion: 'skipped' }
    ];
    delete real.logs[906];
    const [genuine] = stepCandidates(repo.start, published, repo.dir);
    const [copy] = stepCandidates(published, forged, repo.dir);
    assert.deepEqual(copy, { sha: forged, run: '6', attempt: '1' });
    const env = { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'djDAOjones/route-plotter' };
    return { repo, forged, real, genuine, copy, env };
  }

  test("a run's skipped jobs are passed over, so a commit replaying a real run's number fails (GATE-02)", async () => {
    const { repo, forged, real, genuine, copy, env } = replayed();
    try {
      assert.equal(await authenticateStep(genuine, env, github(real), repo.dir), true);
      // The publish job's log names another commit, and the skipped take-back has no log to wait for: so, no.
      assert.equal(await authenticateStep(copy, env, github(real), repo.dir), false);
      assert.equal(await mainProvenance(repo.start, forged, env, github(real), repo.dir), 'hand');
      const fetchImpl = github({ green: [repo.start], ...real });
      const sorted = await ciSort(repo, repo.start, forged, { eventName: 'push', fetchImpl });
      assert.equal(sorted.status, 1, sorted.said);
      assert.match(sorted.said, /::error title=Hand change to the live site::.*Run the Publish workflow by hand/);
      assert.doesNotMatch(sorted.said, /could not be read/);
      // The job still running, or GitHub not answering: still read later, as before.
      const started = job => (job.id === 6 ? { ...job, status: 'in_progress', conclusion: null } : job);
      const running = { ...real, jobs: { 6: real.jobs[6].map(started) } };
      assert.equal(await authenticateStep(copy, env, github(running), repo.dir), null);
      assert.equal(await authenticateStep(copy, env, github({ fail: true }), repo.dir), null);
    } finally {
      repo.done();
    }
  });

  test("on main, a change to the live site that GitHub's record cannot vouch for fails Verify (GATE-02)", async () => {
    const { repo, forged, real, genuine, copy, env } = replayed();
    try {
      // A replay whose run's record cannot settle it: the publish job still running, its log missing (not yet
      // written, expired or deleted), or GitHub not answering. authenticateStep says null, as before, so the step
      // never publishes over it (scripts/publish.mjs); the gate now refuses it rather than warning.
      const started = job => (job.id === 6 ? { ...job, status: 'in_progress', conclusion: null } : job);
      const records = { running: { ...real, jobs: { 6: real.jobs[6].map(started) } }, gone: { ...real, logs: {} } };
      for (const [name, record] of Object.entries(records)) {
        assert.equal(await authenticateStep(copy, env, github(record), repo.dir), null, name);
        assert.equal(await mainProvenance(repo.start, forged, env, github(record), repo.dir), 'unverified', name);
        const sorted = await ciSort(repo, repo.start, forged, { eventName: 'push',
          fetchImpl: github({ green: [repo.start], ...record }) });
        assert.equal(sorted.status, 1, `${name}: ${sorted.said}`);
        assert.match(sorted.said, /::error title=Live site not vouched for::.*docs\/index\.html/, name);
      }
      // Main's last passing run unreadable: everything runs, and the newest change to the live site is still checked.
      const fetchOf = record => async url => (new URL(url).pathname.endsWith('/ci.yml/runs')
        ? { ok: false, status: 502, json: async () => null } : github(record)(url));
      let sorted = await ciSort(repo, repo.start, forged, { eventName: 'push', fetchImpl: fetchOf(real) });
      assert.equal(sorted.status, 1, sorted.said);
      assert.match(sorted.said, /with no readable range, from the last passing run on main, which could not be read/);
      assert.match(sorted.said, /::error title=Hand change to the live site::.*docs\/index\.html/);
      repo.run(['reset', '-q', '--hard', genuine.sha]);
      repo.write('src/main.tsx', 'export const after = 1;\n');
      const app = repo.commit('B: v4 after the publish');
      sorted = await ciSort(repo, repo.start, app, { eventName: 'push', fetchImpl: fetchOf(real) });
      assert.equal(sorted.status, 0, sorted.said);
      assert.doesNotMatch(sorted.said, /live site/i);
      sorted = await ciSort(repo, repo.start, app, { eventName: 'push', fetchImpl: fetchOf(records.gone) });
      assert.equal(sorted.status, 1, sorted.said);
      assert.match(sorted.said, /::error title=Live site not vouched for::/);
    } finally {
      repo.done();
    }
  });

  test("on main, the site's last change is the one checked, so no older publish covers it (GATE-02)", async () => {
    // Codex's second review: an older publish holding the same site, or a site put back as it was at the range's
    // start, must not let a commit shaped as the step's pass unchecked.
    const runs = (...records) => Object.fromEntries(['runs', 'jobs', 'logs']
      .map(key => [key, Object.assign({}, ...records.map(record => record[key]))]));
    const trailer = run => `${STEP.trailer} publish.yml run ${run}, attempt 1`;
    const sortPush = (repo, head, record) => ciSort(repo, repo.start, head, { eventName: 'push',
      fetchImpl: github({ green: [repo.start], ...record }) });
    let repo = site();
    try {
      // Publishes B (run 6) and C (run 7), then D, by hand, puts B's site back and names B's run, then a record change.
      const b = repo.publish('snapshot 1', { trailer: trailer(6) });
      const c = repo.publish('snapshot 2', { trailer: trailer(7) });
      const d = repo.publish('snapshot 1', { trailer: trailer(6) });
      repo.write('project/backlog.md', '# Backlog\n- [x] E\n');
      const e = repo.commit('E: record');
      const record = runs(stepRun(6, repo.start, b), stepRun(7, repo.start, c));
      const env = { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'djDAOjones/route-plotter' };
      assert.equal(siteIntroducer(repo.start, e, repo.dir).sha, d);
      assert.equal(await mainProvenance(repo.start, e, env, github(record), repo.dir), 'hand');
      const sorted = await sortPush(repo, e, record);
      assert.equal(sorted.status, 1, sorted.said);
      assert.match(sorted.said, new RegExp(`::error title=Hand change to the live site::.*docs/index\\.html`));
    } finally {
      repo.done();
    }
    repo = site();
    try {
      // B publishes (run 6); D, by hand and naming B's run, puts the site back as the range's start held it, so the two
      // ends show no change to it; with a record change after it, and without.
      const b = repo.publish('snapshot 1', { trailer: trailer(6) });
      repo.write('docs/index.html', 'v3');
      repo.write('version.json', '{"build":726}\n');
      const d = repo.commit(`PUB-01: publish back\n\nVerify: forged\n${trailer(6)}`, repo.bot);
      assert.deepEqual(pathsOfRange([repo.start, d], repo.dir), []);
      const record = stepRun(6, repo.start, b);
      let sorted = await sortPush(repo, d, record);
      assert.equal(sorted.status, 1, sorted.said);
      assert.match(sorted.said, /::error title=Hand change to the live site::.*docs\/index\.html/);
      repo.write('project/backlog.md', '# Backlog\n- [x] E\n');
      const e = repo.commit('E: record');
      sorted = await sortPush(repo, e, record);
      assert.equal(sorted.status, 1, sorted.said);
      assert.match(sorted.said, /record\s+project\/backlog\.md/);
      assert.match(sorted.said, /::error title=Hand change to the live site::/);
    } finally {
      repo.done();
    }
    repo = site();
    try {
      // Main reached by a fast-forward to a branch's merge of main (Codex's third review). The branch left main
      // before the publish G (run 6) and changed only the record; G passed. Its merge of G, if it keeps the old site,
      // puts back a site main had left, which fails; if it takes G's site, the site is G's, vouched for by G's run.
      const g = repo.publish('snapshot 1', { trailer: trailer(6) });
      const record = stepRun(6, repo.start, g);
      repo.run(['switch', '-q', '-c', 'branch', repo.start]);
      repo.write('project/backlog.md', '# Backlog\n- [x] F\n');
      repo.commit('F: record');
      repo.run(['merge', '-q', '--no-ff', '--no-commit', g]);
      repo.run(['checkout', 'HEAD', '--', 'docs', 'version.json']);
      const kept = repo.commit('F: bring main in, keeping the old site');
      repo.run(['switch', '-q', 'main']);
      repo.run(['merge', '-q', '--ff-only', kept]);
      const env = { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'djDAOjones/route-plotter' };
      assert.equal(siteIntroducer(g, kept, repo.dir).outside, repo.start);
      let sorted = await ciSort(repo, g, kept, { eventName: 'push', fetchImpl: github({ green: [g], ...record }) });
      assert.equal(sorted.status, 1, sorted.said);
      assert.match(sorted.said, /::error title=Hand change to the live site::.*docs\/index\.html/);
      repo.run(['reset', '-q', '--hard', g]);
      repo.run(['switch', '-q', 'branch']);
      repo.run(['reset', '-q', '--hard', 'HEAD^']);
      repo.run(['merge', '-q', '--no-ff', '--no-edit', g]);
      const took = repo.run(['rev-parse', 'HEAD']);
      repo.run(['switch', '-q', 'main']);
      repo.run(['merge', '-q', '--ff-only', took]);
      assert.equal(siteIntroducer(repo.start, took, repo.dir).sha, g);
      assert.equal(await mainProvenance(repo.start, took, env, github(record), repo.dir), 'step');
      sorted = await ciSort(repo, repo.start, took, { eventName: 'push',
        fetchImpl: github({ green: [repo.start], ...record }) });
      assert.equal(sorted.status, 0, sorted.said);
      assert.match(sorted.said, /runs the record checker, because every path is record-only or the publishing step's/);
    } finally {
      repo.done();
    }
    repo = site();
    try {
      // A hand change, then another putting back exactly the publish B's files (Codex's fourth review): refused, and
      // since a take-back to B would then commit nothing, the refusal says to go through an earlier site first. Two
      // take-backs by the step (runs 9 and 10), to the start's site and then to B's, make the site the step's again.
      const b = repo.publish('snapshot 1', { trailer: trailer(6) });
      repo.write('docs/index.html', 'by hand');
      repo.commit('X: edit the site');
      repo.write('docs/index.html', 'snapshot 1');
      const d = repo.commit('D: put the site back by hand');
      assert.deepEqual(pathsOfRange([b, d], repo.dir), []);
      let sorted = await sortPush(repo, d, stepRun(6, repo.start, b));
      assert.equal(sorted.status, 1, sorted.said);
      assert.match(sorted.said, /::error title=Hand change to the live site::.*take it back first to an earlier one/);
      repo.write('docs/index.html', 'v3');
      repo.write('version.json', '{"build":726}\n');
      const t1 = repo.commit(`PUB-01: take the site back\n\nVerify: test\n${trailer(9)}`, repo.bot);
      repo.write('docs/index.html', 'snapshot 1');
      repo.write('version.json', '{"site":"snapshot 1"}\n');
      const t2 = repo.commit(`PUB-01: take the site back\n\nVerify: test\n${trailer(10)}`, repo.bot);
      const record = runs(stepRun(6, repo.start, b), stepRun(9, repo.start, t1), stepRun(10, repo.start, t2));
      sorted = await sortPush(repo, t2, record);
      assert.equal(sorted.status, 0, sorted.said);
    } finally {
      repo.done();
    }
    repo = site();
    try {
      // A hand change, then a publish (run 8) that rewrites the site: the site is the step's again, as before.
      repo.write('docs/index.html', 'by hand');
      repo.commit('X: edit the site');
      const s = repo.publish('rewritten', { trailer: trailer(8) });
      repo.write('project/backlog.md', '# Backlog\n- [x] E\n');
      const e = repo.commit('E: record');
      const sorted = await sortPush(repo, e, stepRun(8, repo.start, s));
      assert.equal(sorted.status, 0, sorted.said);
      assert.match(sorted.said, /runs the record checker, because every path is record-only or the publishing step's/);
    } finally {
      repo.done();
    }
  });

  test("main's last passing run is read only from a commit before the one sorted, never backwards", async () => {
    const repo = site();
    try {
      repo.write('project/backlog.md', '# Backlog\n- [ ] B\n');
      const b = repo.commit('B: record');
      repo.write('src/main.tsx', 'export const c = 3;\n');
      const c = repo.commit('C: v4');
      assert.equal(isAncestor(b, c, repo.dir), true);
      assert.equal(isAncestor(c, b, repo.dir), false);
      // C's run finished first; B's run, sorted later, must not read C..B.
      const env = { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', DEFAULT_BRANCH: 'main' };
      assert.equal(await lastGreenSha(env, github({ green: [c, repo.start] }), sha => isAncestor(sha, b, repo.dir)), repo.start);
      const sorted = await ciSort(repo, repo.start, b, { eventName: 'push', fetchImpl: github({ green: [c, repo.start] }) });
      assert.match(sorted.said, new RegExp(`push ${repo.start} ${b}`));
      assert.match(sorted.said, /record\s+project\/backlog\.md/);
    } finally {
      repo.done();
    }
  });

  test('the gate in a checkout refuses any change to the live site, staged, committed or untracked', async () => {
    const repo = site();
    const local = async () => {
      const said = [];
      const status = await gate(['--plan'], {}, { cwd: repo.dir, log: line => said.push(line) });
      return { status, said: said.join('\n') };
    };
    try {
      repo.run(['switch', '-q', '-c', 'work']);
      assert.equal((await local()).status, 0);
      repo.write('docs/new.txt', 'untracked');
      let result = await local();
      assert.equal(result.status, 1, result.said);
      assert.match(result.said, /gate: refused: .*docs\/new\.txt\. If they came from main, fetch origin first/);
      rmSync(join(repo.dir, 'docs', 'new.txt'));
      repo.write('version.json', '{}\n');
      repo.run(['add', 'version.json']);
      assert.equal((await local()).status, 1);
      repo.run(['reset', '-q', '--hard', 'HEAD']);
      // The step's commit on main, merged in: refused while origin/main is behind, read as main's once fetched.
      repo.run(['switch', '-q', 'main']);
      repo.publish('v4 preview 1');
      repo.run(['switch', '-q', 'work']);
      repo.run(['merge', '-q', '--no-edit', 'main']);
      assert.equal((await local()).status, 1);
      repo.run(['update-ref', 'refs/remotes/origin/main', 'main']);
      result = await local();
      assert.equal(result.status, 0, result.said);
      assert.doesNotMatch(result.said, /live site/);
      // --range says what a range would run, by the commits' shape, and refuses nothing.
      const said = [];
      assert.equal(await gate(['--plan', '--range', `${repo.start}..main`], {}, { cwd: repo.dir, log: line => said.push(line) }), 0);
      assert.match(said.join('\n'), /runs the record checker[\s\S]*read as the step's, by the commits' shape alone/);
    } finally {
      repo.done();
    }
  });
});
