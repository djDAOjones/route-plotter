/**
 * The publishing step's tests (PUB-01): its command line refuses what it does
 * not know, its site check finds a missing or outside reference, a publish and
 * a take-back write only the site and only from CI on main, a record-only
 * merge publishes nothing, and the workflow wires the guards as written.
 * Node's own runner, no dependency: `node --test scripts/publish.test.mjs`.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { ROOT, STEP, git, stepMade } from './gate.mjs';
import {
  ADDRESS, PUSH_TRIES, REPOSITORY, USAGE, VERIFY, UsageError, checkSite, cssReferences, decide, htmlReferences, main,
  markupReferences, nextPreview, parseArgs, prSection, publish, sameBuild, scriptReferences, sourceMapReferences,
  stepHistory, takeBack, versionRecord, watchPages, whatIsNew, whatToTry
} from './publish.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

/** A folder of files, written from a {path: text} map. */
function folder(files, dir = mkdtempSync(join(tmpdir(), 'pub-01-site-'))) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

/** A small built site, as Vite lays one out. */
const BUILT = {
  'index.html': '<!doctype html><html><head><script type="module" crossorigin src="./assets/index-a1.js"></script>' +
    '<link rel="stylesheet" crossorigin href="./assets/index-b2.css"></head><body><div id="root"></div></body></html>',
  'assets/index-a1.js': 'console.log(1);\n//# sourceMappingURL=index-a1.js.map\n',
  'assets/index-a1.js.map': '{}',
  'assets/index-b2.css': '@font-face{src:url(./Plex-c3.woff2) format("woff2")}body{color:#161616}',
  'assets/Plex-c3.woff2': 'font',
  'player/player.js': 'var RoutePlotterPlayer=1;'
};

describe('the command line refuses what it does not know (DEF-71)', () => {
  test('a mode, its values and nothing else', () => {
    assert.deepEqual(parseArgs(['--dry-run']), { mode: 'dry-run', dist: 'dist', source: undefined, verified: undefined,
      tryFile: undefined, commit: undefined, takeBackTo: undefined });
    assert.equal(parseArgs(['--dry-run', '--dist', 'out']).dist, 'out');
    const published = parseArgs(['--publish', '--source', SHA_A, '--verified', SHA_B, '--try-file', '/tmp/t']);
    assert.deepEqual([published.mode, published.source, published.verified, published.tryFile],
      ['publish', SHA_A, SHA_B, '/tmp/t']);
    assert.equal(parseArgs(['--take-back', 'v3.3.726']).takeBackTo, 'v3.3.726');
    assert.equal(parseArgs(['--watch-pages', '--commit', SHA_A]).commit, SHA_A);
  });

  test('an unknown, misspelt, repeated or incomplete command never runs, and no mode is assumed', () => {
    for (const argv of [
      [], ['--publsh'], ['--Publish'], ['publish'], ['-p'], ['--dry-run=true'], ['--dryrun'], ['--dry-run', '--force'],
      ['--dry-run', '--dry-run'], ['--dry-run', '--publish', '--source', SHA_A, '--verified', SHA_B],
      ['--publish'], ['--publish', '--source', SHA_A], ['--publish', '--source', 'HEAD', '--verified', SHA_B],
      ['--publish', '--source', SHA_A, '--verified', SHA_B, '--dist', 'elsewhere'], ['--take-back'],
      ['--take-back', ''], ['--take-back', '--publish'], ['--watch-pages'], ['--watch-pages', '--commit', 'abc'],
      ['--decide', '--source', SHA_A], ['--dry-run', '--dist']
    ]) assert.throws(() => parseArgs(argv), UsageError, argv.join(' '));
  });

  test('run as a command, a misspelt flag stops with status 2 before reading or writing anything', () => {
    const before = git(['status', '--porcelain', '--', 'docs', 'version.json']);
    for (const argv of [['--publsh'], [], ['--publish', '--source', SHA_A]]) {
      const result = spawnSync(process.execPath, ['scripts/publish.mjs', ...argv], { cwd: ROOT, encoding: 'utf8' });
      assert.equal(result.status, 2, argv.join(' '));
      assert.match(result.stderr, /nothing was read or written/);
      assert.ok(result.stderr.includes(USAGE));
    }
    assert.equal(git(['status', '--porcelain', '--', 'docs', 'version.json']), before);
  });
});

describe('the site check: every file the site refers to is there (DEF-75)', () => {
  test('a built site passes, and its references are listed', () => {
    const dir = folder(BUILT);
    try {
      const { files, references } = checkSite(dir);
      assert.equal(files.length, 6);
      assert.deepEqual(references, ['assets/Plex-c3.woff2', 'assets/index-a1.js', 'assets/index-a1.js.map', 'assets/index-b2.css']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a planted missing file stops it, however the reference is written', () => {
    for (const [path, text, missing] of [
      ['index.html', '<link rel="stylesheet" href="./assets/missing.css">', 'missing.css'],
      ['index.html', "<script src='./assets/single.js'></script>", 'single.js'],
      ['index.html', '<img src=assets/bare.png alt="">', 'bare.png'],
      ['index.html', '<img srcset="assets/a.png 1x, assets/b2x.png 2x" alt="">', 'b2x.png'],
      ['index.html', '<link rel="icon" href="./icon.svg?v=2#x">', 'icon.svg'],
      ['assets/index-b2.css', 'a{background:url("./gone.png")}', 'gone.png'],
      ['assets/index-b2.css', "@import 'theme.css';", 'theme.css'],
      ['assets/index-a1.js', 'x()\n//# sourceMappingURL=lost.js.map\n', 'lost.js.map']
    ]) {
      const site = { ...BUILT };
      site[path] = path === 'index.html' ? site[path].replace('</head>', `${text}</head>`) : text;
      const dir = folder(site);
      try {
        assert.throws(() => checkSite(dir), new RegExp(`refers to a missing file: [^;]*${missing.replace('.', '\\.')}`), text);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  test('nothing loads from another site, from the domain root or from outside the site', () => {
    for (const [text, said] of [
      ['<script src="https://cdn.example.com/x.js"></script>', 'loads from another site'],
      ['<link href="//fonts.example.com/f.css" rel="stylesheet">', 'loads from another site'],
      ['<script src="/assets/index-a1.js"></script>', "the domain's root"],
      ['<img src="../secret.png" alt="">', 'outside the site'],
      ['<a href="javascript:alert(1)">x</a>', 'refers to javascript:']
    ]) {
      const dir = folder({ ...BUILT, 'index.html': BUILT['index.html'].replace('</head>', `${text}</head>`) });
      try {
        assert.throws(() => checkSite(dir), new RegExp(said), text);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  test('a build holds only what a site serves: no project archive, no hidden file, no link, an index', () => {
    for (const extra of [{ 'saves/project.zip': 'zip' }, { '.env': 'SECRET=1' }, { 'notes.md': '# x' }]) {
      const dir = folder({ ...BUILT, ...extra });
      try {
        assert.throws(() => checkSite(dir), /hidden file|does not serve/);
        // A restored release is checked for its references only: v3's site holds its approved example archives.
        assert.doesNotThrow(() => checkSite(dir, { build: false }));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    const linked = folder(BUILT);
    symlinkSync('/etc/hosts', join(linked, 'hosts.txt'));
    assert.throws(() => checkSite(linked), /holds a link: hosts\.txt/);
    rmSync(linked, { recursive: true, force: true });
    const empty = folder({ 'a.txt': 'x' });
    assert.throws(() => checkSite(empty), /there is no index\.html/);
    rmSync(empty, { recursive: true, force: true });
    const jekyll = folder({ ...BUILT, '.nojekyll': '' });
    assert.doesNotThrow(() => checkSite(jekyll));
    rmSync(jekyll, { recursive: true, force: true });
  });

  test("a page's inline styles and scripts, a quoted >, an SVG's links and a script's imports are all read", () => {
    for (const [path, text, missing] of [
      ['index.html', '<style>body{background:url(inline.png)}</style>', 'inline.png'],
      ['index.html', '<div style="background:url(\'attr.png\')"></div>', 'attr.png'],
      ['index.html', '<img alt="a > b" src="after-quote.png">', 'after-quote.png'],
      ['index.html', '<script type="module">import "./inline-module.js";</script>', 'inline-module.js'],
      ['index.html', '<object data="movie.svg"></object>', 'movie.svg'],
      ['assets/index-a1.js', 'import{a as b}from"./chunk-static.js";\n', 'chunk-static.js'],
      ['assets/index-a1.js', 'const m=()=>import("./chunk-lazy.js");\n', 'chunk-lazy.js'],
      ['assets/index-a1.js', 'const u=new URL("./worker.js",import.meta.url);\n', 'worker.js'],
      ['assets/index-a1.js', 'export*from"./re-export.js";\n', 're-export.js']
    ]) {
      const site = { ...BUILT };
      site[path] = path === 'index.html' ? site[path].replace('</body>', `${text}</body>`) : text;
      const dir = folder(site);
      try {
        assert.throws(() => checkSite(dir), new RegExp(`refers to a missing file: [^;]*${missing.replace('.', '\\.')}`), text);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    const svg = folder({ ...BUILT, 'icon.svg': '<svg><use xlink:href="sprite.svg#a"/></svg>',
      'index.html': BUILT['index.html'].replace('</head>', '<link rel="icon" href="icon.svg"></head>') });
    assert.throws(() => checkSite(svg), /icon\.svg refers to a missing file: sprite\.svg#a/);
    rmSync(svg, { recursive: true, force: true });
    for (const [text, said] of [['import"react";', 'imports react by name'], ['import("https://esm.example/x.js")', 'loads from another site']]) {
      const dir = folder({ ...BUILT, 'assets/index-a1.js': text });
      assert.throws(() => checkSite(dir), new RegExp(said), text);
      rmSync(dir, { recursive: true, force: true });
    }
    // A method named import, and a path built at run time, are not loads the check can see.
    assert.deepEqual(scriptReferences('loader.import("x");const p="./a"+n;import(p);'), []);
    assert.deepEqual(markupReferences('<p title="<img src=x>">t</p>').markup, []);
  });

  test('references are read in tags, either quote or none, and not in comments, code or text', () => {
    assert.deepEqual(htmlReferences(`<!-- <img src="old.png"> --><a href='#top'>x</a><p>src="text.png"</p><img data-image="i.png" alt="">`),
      ['#top', 'i.png']);
    assert.deepEqual(cssReferences('/* url(old.png) */ a{b:url( "x.png" )} @import "y.css";'), ['x.png', 'y.css']);
    assert.deepEqual(sourceMapReferences('const s = /# sourceMappingURL=\\S+\\s/;\n//# sourceMappingURL=app.js.map\n'), ['app.js.map']);
    assert.deepEqual(sourceMapReferences('a{}\n/*# sourceMappingURL=a.css.map */'), ['a.css.map']);
  });

  test('the live site as it stands passes the reference check, so a take-back to it is possible', () => {
    assert.doesNotThrow(() => checkSite(join(ROOT, 'docs'), { build: false }));
  });

  test("v4's own build, when one is present, passes the whole check", { skip: !existsSync(join(ROOT, 'dist', 'index.html')) }, () => {
    const { references } = checkSite(join(ROOT, 'dist'));
    assert.ok(references.some(path => /^assets\/index-[\w-]+\.js$/.test(path)), references.join(' '));
  });

  test('two sites hold the same build when every built file matches, whatever the step added', () => {
    const a = folder(BUILT);
    const b = folder({ ...BUILT, '.nojekyll': '', 'version.json': '{"preview":1}' });
    try {
      assert.equal(sameBuild(a, b), true);
      writeFileSync(join(b, 'assets/index-a1.js'), 'console.log(2);\n//# sourceMappingURL=index-a1.js.map\n');
      assert.equal(sameBuild(a, b), false);
      writeFileSync(join(b, 'assets/index-a1.js'), BUILT['assets/index-a1.js']);
      writeFileSync(join(b, 'extra.txt'), 'x');
      assert.equal(sameBuild(a, b), false);
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });
});

describe('what each preview comes with', () => {
  const trajectory = lines => `# Trajectory\n\n## Phase 6 — v4\n\n${lines.join('\n')}\n\n## Phase 5 — plan\n\n- GATE-01 — sorted (2026-11-18) — see decisions\n`;

  test("what is new: the trajectory's item lines since the last publish, or the phase's at the first", () => {
    const before = trajectory(['- STACK-01 — moved (2026-11-18) — see decisions']);
    const after = trajectory(['- STACK-01 — moved (2026-11-18) — see decisions', '- PUB-01 — publishes (2026-11-19) — see decisions']);
    assert.deepEqual(whatIsNew(before, after), ['PUB-01 — publishes (2026-11-19)']);
    assert.deepEqual(whatIsNew(null, after), ['STACK-01 — moved (2026-11-18)', 'PUB-01 — publishes (2026-11-19)']);
    assert.deepEqual(whatIsNew(after, after), ['No item has shipped since the last publish.']);
    const many = trajectory(Array.from({ length: 11 }, (_, i) => `- CORE-${i + 1} — done (2026-11-20) — see decisions`));
    assert.deepEqual(whatIsNew(null, many).slice(-2), ['CORE-11 — done (2026-11-20)', 'And 3 earlier item(s).']);
  });

  test("what to try: the merged pull request's section, the hand-run's words, or a plain default", () => {
    const body = '## Summary\nx\n\n## What to try\n- Open the page.\n- Look at version.json.\n\n## Proof\ny';
    assert.deepEqual(prSection(body), ['- Open the page.', '- Look at version.json.']);
    assert.deepEqual(whatToTry(prSection(body).join('\n')), ['Open the page.', 'Look at version.json.']);
    assert.deepEqual(prSection('no such section'), []);
    assert.deepEqual(prSection(null), []);
    assert.deepEqual(whatToTry('one\n\n* two\n'), ['one', 'two']);
    assert.equal(whatToTry('a\nb\nc\nd\ne\nf\ng').length, 5);
    assert.match(whatToTry('')[0], new RegExp(`^Open ${ADDRESS.replace(/[./]/g, '\\$&')}`));
  });

  test('version.json says which preview is live, from which commit, and what it holds', () => {
    const record = JSON.parse(versionRecord({ preview: 3, source: SHA_A, published: '2026-11-19T03:00:00Z',
      whatIsNew: ['A'], whatToTry: ['B'] }));
    assert.deepEqual(record, { app: 'Route Plotter', version: '4.0.0-preview.3', preview: 3, source: SHA_A,
      published: '2026-11-19T03:00:00Z', address: ADDRESS, whatIsNew: ['A'], whatToTry: ['B'] });
    assert.equal(nextPreview([]), 1);
    assert.equal(nextPreview([{ preview: 2 }, { restored: SHA_A }, { preview: 1 }]), 3);
  });
});

/** A scratch repository shaped like this one, with its own origin: v3's site live, v4 built into dist/. */
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'pub-01-repo-'));
  const origin = `${dir}-origin.git`;
  const person = { ...process.env, GIT_AUTHOR_NAME: 'someone', GIT_AUTHOR_EMAIL: 'someone@example.invalid',
    GIT_COMMITTER_NAME: 'someone', GIT_COMMITTER_EMAIL: 'someone@example.invalid' };
  const runIn = (cwd, ...args) => {
    const result = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', env: person });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const run = (...args) => runIn(dir, ...args);
  /** Commit everything and push it to origin's main, as a merge to main would land. */
  const commit = message => {
    run('add', '-A');
    run('commit', '-q', '-m', message);
    run('push', '-q', 'origin', 'HEAD:refs/heads/main');
    return run('rev-parse', 'HEAD');
  };
  /** Someone else lands a commit on origin's main, as a merge during a build would. */
  const landElsewhere = (path, text, message) => {
    const other = mkdtempSync(join(tmpdir(), 'pub-01-other-'));
    runIn(tmpdir(), 'clone', '-q', origin, other);
    folder({ [path]: text }, other);
    runIn(other, 'add', '-A');
    runIn(other, 'commit', '-q', '-m', message);
    runIn(other, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
    const sha = runIn(other, 'rev-parse', 'HEAD');
    rmSync(other, { recursive: true, force: true });
    return sha;
  };
  folder({
    '.gitignore': 'dist/\n',
    'docs/index.html': '<!doctype html><title>v3</title><link rel="stylesheet" href="styles/main.css?v=3.3.726">',
    'docs/styles/main.css': 'body{}',
    'docs/examples/one.zip': 'approved archive',
    'version.json': '{"build":726}\n',
    'src/main.tsx': 'export {};\n',
    'project/trajectory.md': '# Trajectory\n\n## Phase 6 — v4\n\n- STACK-02 — skeleton (2026-11-19) — see decisions\n'
  }, dir);
  runIn(tmpdir(), 'init', '-q', '--bare', '-b', 'main', origin);
  run('init', '-q', '-b', 'main');
  run('remote', 'add', 'origin', origin);
  const v3 = commit('REL-726: v3.3.726');
  run('tag', 'v3.3.726');
  folder(BUILT, join(dir, 'dist'));
  const ci = { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: REPOSITORY, GITHUB_RUN_ID: '42',
    GITHUB_RUN_ATTEMPT: '1' };
  const fixedNow = () => new Date('2026-11-19T03:00:00Z');
  const originMain = () => runIn(origin, 'rev-parse', 'refs/heads/main');
  return { dir, run, commit, landElsewhere, originMain, v3, ci, fixedNow,
    done: () => { rmSync(dir, { recursive: true, force: true }); rmSync(origin, { recursive: true, force: true }); } };
}

describe('a publish and a take-back write only the site, only from CI on main', () => {
  test('a publish puts the build in docs/, the record in version.json, and one commit the gate knows as the step\'s, pushed to main', () => {
    const repo = scratch();
    try {
      const done = publish({ cwd: repo.dir, source: repo.v3, verified: repo.v3, tryText: '- Open it.', env: repo.ci,
        now: repo.fixedNow });
      assert.equal(done.changed, true);
      assert.equal(done.preview, 1);
      assert.equal(repo.originMain(), done.commit, 'pushed to main');
      assert.match(done.said, /Pushed [0-9a-f]{7} to main\.$/);
      assert.equal(readFileSync(join(repo.dir, 'docs/index.html'), 'utf8'), BUILT['index.html']);
      assert.equal(existsSync(join(repo.dir, 'docs/examples/one.zip')), false, "v3's files go with the old site");
      assert.equal(existsSync(join(repo.dir, 'docs/.nojekyll')), true);
      const record = JSON.parse(readFileSync(join(repo.dir, 'version.json'), 'utf8'));
      assert.equal(record.version, '4.0.0-preview.1');
      assert.equal(record.source, repo.v3);
      assert.deepEqual(record.whatToTry, ['Open it.']);
      assert.equal(readFileSync(join(repo.dir, 'docs/version.json'), 'utf8'), readFileSync(join(repo.dir, 'version.json'), 'utf8'));
      assert.equal(repo.run('status', '--porcelain'), '');
      // The commit: the site only, by the bot, in the commit checker's shape, and the gate's step.
      assert.deepEqual(repo.run('show', '--name-only', '--format=', 'HEAD').split('\n').filter(path => !path.startsWith('docs/')),
        ['version.json']);
      const [author, message] = [repo.run('log', '-1', '--format=%an <%ae>|%cn <%ce>'), repo.run('log', '-1', '--format=%B')];
      assert.equal(author, `${STEP.name} <${STEP.email}>|${STEP.name} <${STEP.email}>`);
      assert.match(message, /^PUB-01: publish v4 4\.0\.0-preview\.1, built from [0-9a-f]{7}\n/);
      assert.match(message, /^Verify: \S.+$/m);
      assert.match(message, /^What is new:\n- STACK-02 — skeleton \(2026-11-19\)$/m);
      assert.match(message, new RegExp(`^${STEP.trailer} publish\\.yml run 42, attempt 1$`, 'm'));
      assert.equal(stepMade(repo.v3, 'HEAD', repo.dir), true);
      assert.deepEqual(stepHistory(repo.dir).map(commit => [commit.preview, commit.source]), [[1, repo.v3]]);
      // The same build again changes nothing and commits nothing.
      repo.run('update-ref', 'refs/remotes/origin/main', 'HEAD');
      const head = repo.run('rev-parse', 'HEAD');
      const again = publish({ cwd: repo.dir, source: head, verified: repo.v3, env: repo.ci, now: repo.fixedNow });
      assert.equal(again.changed, false);
      assert.equal(repo.run('rev-parse', 'HEAD'), head);
    } finally {
      repo.done();
    }
  });

  test('a planted missing file stops a publish: nothing written, nothing committed', () => {
    const repo = scratch();
    try {
      writeFileSync(join(repo.dir, 'dist/index.html'), BUILT['index.html'].replace('</head>', '<script src="./assets/planted.js"></script></head>'));
      assert.throws(() => publish({ cwd: repo.dir, source: repo.v3, verified: repo.v3, env: repo.ci }),
        /refers to a missing file: \.\/assets\/planted\.js/);
      assert.equal(repo.run('rev-parse', 'HEAD'), repo.v3);
      assert.equal(repo.originMain(), repo.v3, 'nothing pushed');
      assert.equal(repo.run('status', '--porcelain'), '');
      assert.match(readFileSync(join(repo.dir, 'docs/index.html'), 'utf8'), /<title>v3<\/title>/);
    } finally {
      repo.done();
    }
  });

  test('a record-only merge landing during a build is written over again, so the app change still publishes', () => {
    const repo = scratch();
    try {
      let landed;
      const done = publish({ cwd: repo.dir, source: repo.v3, verified: repo.v3, env: repo.ci, now: repo.fixedNow,
        beforePush: attempt => { if (attempt === 1) landed = repo.landElsewhere('project/backlog.md', '# Backlog\n', 'X: record'); } });
      assert.equal(done.changed, true, done.said);
      assert.match(done.said, /at try 2 of 3, main having moved on/);
      assert.equal(repo.originMain(), done.commit);
      assert.equal(repo.run('rev-parse', `${done.commit}^`), landed, "written on main's new tip");
      assert.equal(stepMade(repo.v3, done.commit, repo.dir), true);
    } finally {
      repo.done();
    }
  });

  test("a change to the app landing during a build stops the publish, for that change's own run; a main that keeps moving stops it too", () => {
    let repo = scratch();
    try {
      const done = publish({ cwd: repo.dir, source: repo.v3, verified: repo.v3, env: repo.ci,
        beforePush: attempt => { if (attempt === 1) repo.landElsewhere('src/main.tsx', 'export const later = 1;\n', 'Y: v4'); } });
      assert.equal(done.changed, false);
      assert.match(done.said, /moved on with a change of its own \(src\/main\.tsx\)/);
      assert.notEqual(repo.run('show', '-s', '--format=%an', repo.originMain()), STEP.name, 'nothing of the step pushed');
    } finally {
      repo.done();
    }
    repo = scratch();
    try {
      let n = 0;
      assert.throws(() => publish({ cwd: repo.dir, source: repo.v3, verified: repo.v3, env: repo.ci,
        beforePush: () => { n += 1; repo.landElsewhere(`project/note-${n}.md`, 'x\n', `X: record ${n}`); } }),
      new RegExp(`main kept moving while the step wrote: nothing was pushed after ${PUSH_TRIES} tries`));
      assert.equal(n, PUSH_TRIES);
      assert.match(readFileSync(join(repo.dir, 'docs/index.html'), 'utf8'), /<title>v3<\/title>/);
    } finally {
      repo.done();
    }
  });

  test('outside CI on main, off main, on a fork, from a stale or dirty checkout, or after v4.0, nothing is written', () => {
    const repo = scratch();
    try {
      const attempt = env => publish({ cwd: repo.dir, source: repo.v3, verified: repo.v3, env });
      assert.throws(() => attempt({}), /only in GitHub Actions/);
      assert.throws(() => attempt({ ...repo.ci, GITHUB_REF: 'refs/heads/pub-01/publish-step' }), /only on main/);
      assert.throws(() => attempt({ ...repo.ci, GITHUB_REF: 'refs/tags/v4.0.0' }), /only on main/);
      assert.throws(() => attempt({ ...repo.ci, GITHUB_REPOSITORY: 'someone/route-plotter' }), /publishes djDAOjones/);
      assert.throws(() => takeBack({ cwd: repo.dir, to: 'v3.3.726', env: {} }), /only in GitHub Actions/);
      writeFileSync(join(repo.dir, 'stray.txt'), 'x');
      assert.throws(() => attempt(repo.ci), /not clean/);
      rmSync(join(repo.dir, 'stray.txt'));
      assert.throws(() => publish({ cwd: repo.dir, source: SHA_A, verified: repo.v3, env: repo.ci }), /not the source/);
      folder({ 'project/trajectory.md': '# Trajectory\n\n## Phase 9\n\n- V40-01 — declared (2026-12-01) — see decisions\n' }, repo.dir);
      const declared = repo.commit('V40-01: declare');
      assert.throws(() => publish({ cwd: repo.dir, source: declared, verified: declared, env: repo.ci }), /v4\.0 is declared/);
      assert.throws(() => takeBack({ cwd: repo.dir, to: 'v3.3.726', env: repo.ci }), /v4\.0 is declared/);
      assert.match(readFileSync(join(repo.dir, 'docs/index.html'), 'utf8'), /<title>v3<\/title>/);
    } finally {
      repo.done();
    }
  });

  test('a take-back restores the site as a commit or tag on main had it, as the step; nothing off main', () => {
    const repo = scratch();
    try {
      publish({ cwd: repo.dir, source: repo.v3, verified: repo.v3, env: repo.ci, now: repo.fixedNow });
      repo.run('update-ref', 'refs/remotes/origin/main', 'HEAD');
      const done = takeBack({ cwd: repo.dir, to: 'v3.3.726', env: repo.ci });
      assert.equal(done.changed, true);
      assert.equal(repo.originMain(), done.commit, 'pushed to main');
      assert.equal(repo.run('diff', '--stat', repo.v3, 'HEAD', '--', 'docs', 'version.json'), '');
      assert.equal(readFileSync(join(repo.dir, 'docs/examples/one.zip'), 'utf8'), 'approved archive');
      assert.match(repo.run('log', '-1', '--format=%B'), new RegExp(`^PUB-01: take the site back to v3\\.3\\.726 \\([0-9a-f]{7}\\)\\n[\\s\\S]*^Verify: \\S.+$[\\s\\S]*^Restored-from: ${repo.v3}$`, 'm'));
      assert.equal(stepMade(repo.v3, 'HEAD', repo.dir), true);
      // The next publish counts on from the last preview, the take-back between them.
      repo.run('update-ref', 'refs/remotes/origin/main', 'HEAD');
      const head = repo.run('rev-parse', 'HEAD');
      assert.equal(publish({ cwd: repo.dir, source: head, verified: repo.v3, env: repo.ci, now: repo.fixedNow }).preview, 2);
      // A commit off main, an unknown name, or the site as it already is: refused, or nothing to do.
      repo.run('update-ref', 'refs/remotes/origin/main', 'HEAD');
      repo.run('switch', '-q', '-c', 'side');
      folder({ 'docs/index.html': '<title>side</title>' }, repo.dir);
      repo.run('add', '-A');
      repo.run('commit', '-q', '-m', 'side');
      const side = repo.run('rev-parse', 'HEAD');
      repo.run('switch', '-q', 'main');
      assert.throws(() => takeBack({ cwd: repo.dir, to: side, env: repo.ci }), /is not on main/);
      assert.throws(() => takeBack({ cwd: repo.dir, to: 'no-such-tag', env: repo.ci }), /names no commit/);
      assert.equal(takeBack({ cwd: repo.dir, to: 'HEAD', env: repo.ci }).changed, false);
    } finally {
      repo.done();
    }
  });
});

describe('deciding whether a run publishes: the gate green, and a change to the app', () => {
  /** A fake GitHub API: the Verify run's steps, the merged pull request, main's newest passing run. */
  function github({ v4Step = 'success', jobsOk = true, pulls = [], lastGreen = null } = {}) {
    const asked = [];
    const fetchImpl = async url => {
      asked.push(url);
      const path = new URL(url).pathname;
      let body = null;
      if (/\/actions\/runs\/\d+\/jobs$/.test(path)) body = jobsOk ? { jobs: [{ steps: [
        { name: 'Sort the change by what it touches', conclusion: 'success' },
        { name: VERIFY.v4Step, conclusion: v4Step }
      ] }] } : null;
      else if (/\/commits\/[0-9a-f]{40}\/pulls$/.test(path)) body = pulls;
      else if (path.endsWith('/actions/workflows/ci.yml/runs')) body = { workflow_runs: lastGreen ? [{ head_sha: lastGreen }] : [] };
      return { ok: body !== null, status: 200, json: async () => body };
    };
    return { fetchImpl, asked };
  }
  const env = { GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: REPOSITORY, GITHUB_TOKEN: 't' };
  const runEvent = (sha, change = {}) => ({ workflow_run: { id: 7, name: VERIFY.name, path: VERIFY.path, event: 'push',
    head_branch: 'main', head_repository: { full_name: REPOSITORY }, conclusion: 'success', head_sha: sha, ...change } });

  test("an app merge whose Verify passed publishes main's tip, with the pull request's What to try", async () => {
    const repo = scratch();
    try {
      const { fetchImpl } = github({ pulls: [{ merge_commit_sha: repo.v3, body: '## What to try\n- Open it.' }] });
      const decided = await decide({ env: { ...env, GITHUB_EVENT_NAME: 'workflow_run' }, event: runEvent(repo.v3), cwd: repo.dir, fetchImpl });
      assert.equal(decided.publish, true, decided.reason);
      assert.equal(decided.source, repo.v3);
      assert.equal(decided.tryText, '- Open it.');
    } finally {
      repo.done();
    }
  });

  test('a record-only or v3-only merge publishes nothing: Verify skipped v4\'s gate', async () => {
    const repo = scratch();
    try {
      const { fetchImpl } = github({ v4Step: 'skipped' });
      const decided = await decide({ env: { ...env, GITHUB_EVENT_NAME: 'workflow_run' }, event: runEvent(repo.v3), cwd: repo.dir, fetchImpl });
      assert.equal(decided.publish, false);
      assert.match(decided.reason, /did not touch v4/);
      const unread = await decide({ env: { ...env, GITHUB_EVENT_NAME: 'workflow_run' }, event: runEvent(repo.v3), cwd: repo.dir,
        fetchImpl: github({ jobsOk: false }).fetchImpl });
      assert.equal(unread.publish, false);
    } finally {
      repo.done();
    }
  });

  test('a failed run, a pull request, a fork, another branch, another workflow or another event publishes nothing', async () => {
    const repo = scratch();
    try {
      const { fetchImpl } = github();
      for (const [change, said] of [
        [{ conclusion: 'failure' }, /did not pass/], [{ event: 'pull_request' }, /only a push to main/],
        [{ head_repository: { full_name: 'someone/route-plotter' } }, /only a push to main/],
        [{ head_branch: 'feature' }, /only a push to main/], [{ name: 'Publish', path: '.github/workflows/publish.yml' }, /not Verify/]
      ]) {
        const decided = await decide({ env: { ...env, GITHUB_EVENT_NAME: 'workflow_run' }, event: runEvent(repo.v3, change), cwd: repo.dir, fetchImpl });
        assert.equal(decided.publish, false, JSON.stringify(change));
        assert.match(decided.reason, said);
      }
      for (const [change, said] of [
        [{ GITHUB_EVENT_NAME: 'push' }, /never publishes/], [{ GITHUB_EVENT_NAME: 'schedule' }, /never publishes/],
        [{ GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/feature' }, /only main/],
        [{ GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/tags/v3.3.726' }, /only main/]
      ]) {
        const decided = await decide({ env: { ...env, ...change }, event: runEvent(repo.v3), cwd: repo.dir, fetchImpl });
        assert.equal(decided.publish, false, JSON.stringify(change));
        assert.match(decided.reason, said);
      }
    } finally {
      repo.done();
    }
  });

  test("by hand, main's newest passing run must hold main's v4; a later app change waits for its own run", async () => {
    const repo = scratch();
    try {
      const dispatch = { ...env, GITHUB_EVENT_NAME: 'workflow_dispatch', WHAT_TO_TRY: 'Look.' };
      let decided = await decide({ env: dispatch, cwd: repo.dir, fetchImpl: github({ lastGreen: repo.v3 }).fetchImpl });
      assert.equal(decided.publish, true, decided.reason);
      assert.equal(decided.tryText, 'Look.');
      decided = await decide({ env: dispatch, cwd: repo.dir, fetchImpl: github({ lastGreen: null }).fetchImpl });
      assert.equal(decided.publish, false);
      // A record-only commit after the passing run: the same v4, so it publishes.
      folder({ 'project/backlog.md': '# Backlog\n' }, repo.dir);
      const record = repo.commit('X: record');
      decided = await decide({ env: dispatch, cwd: repo.dir, fetchImpl: github({ lastGreen: repo.v3 }).fetchImpl });
      assert.equal(decided.publish, true, decided.reason);
      assert.equal(decided.source, record);
      // An app commit after it: not the v4 that passed, so no.
      folder({ 'src/main.tsx': 'export const later = 1;\n' }, repo.dir);
      repo.commit('Y: v4');
      decided = await decide({ env: dispatch, cwd: repo.dir, fetchImpl: github({ lastGreen: repo.v3 }).fetchImpl });
      assert.equal(decided.publish, false);
      assert.match(decided.reason, /moved on .*src\/main\.tsx/);
    } finally {
      repo.done();
    }
  });
});

describe('seeing Pages build and serve a publish', () => {
  function pages({ startsByPush, served }) {
    let requested = false;
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
      calls.push(`${options.method ?? 'GET'} ${url}`);
      if (url.endsWith('/pages/builds/latest')) {
        const ours = startsByPush || requested;
        return { ok: true, status: 200, json: async () => ({ status: 'built', commit: ours ? served.commit : SHA_B }) };
      }
      if (url.endsWith('/pages/builds') && options.method === 'POST') {
        requested = true;
        return { ok: true, status: 201, json: async () => ({ status: 'queued' }) };
      }
      if (url.startsWith(ADDRESS)) return { ok: true, status: 200, arrayBuffer: async () => Buffer.from(served.html) };
      return { ok: false, status: 404, json: async () => null };
    };
    return { fetchImpl, calls };
  }
  const clock = () => {
    let t = 0;
    return { now: () => t, sleep: async ms => { t += ms; } };
  };

  test('a build the push started is seen as such; one it did not start is asked for; the address must serve the commit', async () => {
    const repo = scratch();
    try {
      const commit = repo.v3;
      const html = readFileSync(join(repo.dir, 'docs/index.html'), 'utf8');
      const env = { GITHUB_TOKEN: 't' };
      let fake = pages({ startsByPush: true, served: { commit, html } });
      let seen = await watchPages({ commit, env, cwd: repo.dir, fetchImpl: fake.fetchImpl, ...clock() });
      assert.equal(seen.ok, true, seen.said.join('\n'));
      assert.equal(seen.started, 'by the push');
      assert.ok(!fake.calls.some(call => call.startsWith('POST')));
      fake = pages({ startsByPush: false, served: { commit, html } });
      seen = await watchPages({ commit, env, cwd: repo.dir, fetchImpl: fake.fetchImpl, ...clock() });
      assert.equal(seen.ok, true, seen.said.join('\n'));
      assert.equal(seen.started, 'on request');
      assert.ok(fake.calls.some(call => call.startsWith('POST') && call.endsWith('/pages/builds')));
      fake = pages({ startsByPush: true, served: { commit, html: 'something else' } });
      seen = await watchPages({ commit, env, cwd: repo.dir, fetchImpl: fake.fetchImpl, ...clock(), limitMs: 60_000 });
      assert.equal(seen.ok, false);
      assert.match(seen.said.join('\n'), /did not serve/);
    } finally {
      repo.done();
    }
  });
});

describe('the step as wired in this repository', () => {
  const read = path => readFileSync(join(ROOT, path), 'utf8');
  const workflow = read('.github/workflows/publish.yml');
  const job = name => workflow.split(/\n {2}(?=[\w-]+:\n)/).find(part => part.startsWith(`${name}:`)) ?? '';

  test('it starts after Verify on main, by hand (a dry run unless asked), and on branch pushes as a dry run only', () => {
    assert.match(workflow, /\n {2}workflow_run:\n {4}workflows: \[Verify\]\n {4}types: \[completed\]\n {4}branches: \[main\]\n/);
    assert.match(workflow, /options: \[dry-run, publish, take-back\]\n {8}default: dry-run\n/);
    assert.match(workflow, /\n {2}push:\n {4}branches-ignore: \[main\]\n/);
    assert.doesNotMatch(workflow, /pull_request_target|\n {2}schedule:|\n {4}tags:|repository_dispatch/);
    assert.match(workflow, /^permissions:\n {2}contents: read\n/m);
  });

  test('only the publish and take-back jobs write, only on main, one at a time, never forced', () => {
    const dryRun = job('dry-run');
    assert.match(dryRun, /permissions:\n {6}contents: read\n/);
    assert.doesNotMatch(dryRun, /contents: write|git push|--publish|--take-back/);
    for (const name of ['publish', 'take-back']) {
      const text = job(name);
      assert.match(text, /if: (>-\n\s+)?github\.ref == 'refs\/heads\/main' && /, name);
      assert.match(text, /contents: write/, name);
      assert.match(text, /group: publish-main\n {6}cancel-in-progress: false/, name);
    }
    assert.match(job('publish'), /run: node scripts\/publish\.mjs --publish /);
    assert.match(job('take-back'), /run: node scripts\/publish\.mjs --take-back /);
    // The step itself pushes, to main's branch only, never forced; the workflow pushes nothing of its own.
    assert.doesNotMatch(workflow, /git push|--force|\+HEAD|push -f|--tags|git tag/);
    const script = read('scripts/publish.mjs');
    assert.equal(script.match(/\['push',/g).length, 1, 'one git push in the step');
    assert.match(script, /\['push', '-q', 'origin', 'HEAD:refs\/heads\/main'\]/);
    // (git clean -f in restoreSite removes untracked site files from the checkout; it is no push.)
    assert.doesNotMatch(script, /--force|\+HEAD|\['tag'|'push', '-f'|--force-with-lease/);
    assert.match(job('publish'), /github\.event\.workflow_run\.conclusion == 'success'/);
    assert.match(job('publish'), /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/);
    // Inputs reach the scripts through the environment, never pasted into a command.
    assert.doesNotMatch(workflow, /run: [^\n]*\$\{\{/);
  });

  test("Verify is the workflow and v4's gate the step that the decision reads", () => {
    const ci = read(VERIFY.path);
    assert.match(ci, /^name: Verify\n/);
    const steps = ci.split(/\n\s+- name: /).slice(1);
    const v4 = steps.filter(step => step.startsWith(`${VERIFY.v4Step}\n`));
    assert.equal(v4.length, 1, `exactly one step named ${VERIFY.v4Step}`);
    assert.match(v4[0], /run: node scripts\/gate\.mjs --lane v4(\n|$)/);
  });

  test('the step runs as the gate knows it: the same bot and trailer', () => {
    assert.equal(STEP.trailer, 'Published-by: PUB-01');
    assert.equal(STEP.name, 'github-actions[bot]');
    assert.match(read('scripts/publish.mjs'), /STEP\.trailer/);
  });

  test('the command line runs a dry run end to end and writes nothing', { skip: !existsSync(join(ROOT, 'dist', 'index.html')) }, async () => {
    const before = git(['status', '--porcelain', '--', 'docs', 'version.json']);
    const result = spawnSync(process.execPath, ['scripts/publish.mjs', '--dry-run'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^Dry run: docs\/ and version\.json are left as they are, and nothing is committed or pushed/);
    assert.equal(git(['status', '--porcelain', '--', 'docs', 'version.json']), before);
    assert.equal(typeof main, 'function');
  });
});
