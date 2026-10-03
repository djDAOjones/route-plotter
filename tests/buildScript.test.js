// @vitest-environment node
/**
 * SPL-06 — build.js builds only when it is run, and its checks can be called.
 *
 * build.js used to do everything at its top level, so a test could not load it
 * without starting a build, and the release tests read its source text
 * instead. It now builds only when Node runs it as a script, and exports the
 * pure checks the build applies (the image manifest, the index.html release
 * stamp and its check, the Pages inventory, the command line) plus the two
 * release-safety steps, which act only on the paths they are given.
 *
 * Nothing here runs or imports build.js in the repository. Run, it builds
 * where it runs; imported with a broken entry guard, it would do the same:
 * version.json bumped, docs/ replaced. So it is run, and imported, only in a
 * fresh copy of the repository, and the exports are called in the process
 * that imported them there (helpers/buildScriptHarness.js says why, and
 * helpers/buildScriptHost.mjs what that process watches). Whatever a broken
 * build.js did would land in the copy, where these tests look for it.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';

import {
  childArguments,
  copyRepository,
  projectRoot,
  removeCopy,
  runBuildScript,
  snapshotTree,
  startBuildModule,
  treeChanges,
} from './helpers/buildScriptHarness.js';
import { allowConsole, recordedConsole } from './helpers/consoleGuard.js';

const manifest = JSON.parse(readFileSync(join(projectRoot, 'public-assets.json'), 'utf8'));
const packageScripts = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')).scripts;
const indexHtml = readFileSync(join(projectRoot, 'index.html'), 'utf8');
const approvedImages = manifest.assets.map(asset => asset.path);
const NO_CACHE_TAGS = '\n  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">' +
  '\n  <meta http-equiv="Pragma" content="no-cache">\n  <meta http-equiv="Expires" content="0">';
const RELEASE = '3.2.999';
// A broken build.js may run a whole build in the copy before it is caught.
const SPAWN_TIMEOUT = 120000;

const EXPORTS = [
  'checkArtifactInventory',
  'checkGeneratedIndex',
  'expectedArtifactInventory',
  'isEntryScript',
  'publishBuiltOutput',
  'resolveBuildMode',
  'rewriteIndexHtml',
  'rollBackFailedBuild',
  'validatePublicAssetManifest',
];

const scratchDirectories = [];
let copy = null; // the copy of the repository every run and import happens in
let buildScript = null; // the copy's build.js
let copyBefore = null; // the copy's files before anything ran there
let copyAfterImport = null;
let host = null; // the process that imported build.js in the copy
let hostFailure = null;

function scratchDirectory(name) {
  const directory = mkdtempSync(join(tmpdir(), `route-plotter-${name}-`));
  scratchDirectories.push(directory);
  return directory;
}

/** Give back write access a test took away, so the directory can be removed. */
function unlockTree(root) {
  if (!existsSync(root)) return;
  chmodSync(root, 0o700);
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (entry.isDirectory()) chmodSync(join(entry.parentPath, entry.name), 0o700);
  }
}

afterEach(() => {
  while (scratchDirectories.length > 0) {
    const directory = scratchDirectories.pop();
    unlockTree(directory);
    rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * Hold a file that cannot be removed, as a cloud-sync lock does: the
 * directory holding it is made read-only. The lock is proved to hold first,
 * since it would not as root, and then the failure path would never run.
 */
function lockDirectory(directory) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'held.txt'), 'held');
  chmodSync(directory, 0o500);
  let held = false;
  try {
    rmSync(join(directory, 'held.txt'));
  } catch {
    held = true;
  }
  expect(held, 'a read-only directory refuses removal (run the suite as an ordinary user)').toBe(true);
}

function writeTree(root, files) {
  for (const [name, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), contents);
  }
}

/** Every file under a directory, as {relative path: contents}. */
function readTree(root) {
  return Object.fromEntries(
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => {
        const file = join(entry.parentPath, entry.name);
        return [relative(root, file), readFileSync(file, 'utf8')];
      })
  );
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The message a call throws or rejects with, or null when it does neither. */
async function thrownMessage(call) {
  try {
    await call();
  } catch (error) {
    return error.message;
  }
  return null;
}

beforeAll(async () => {
  copy = copyRepository();
  buildScript = join(copy, 'build.js');
  copyBefore = snapshotTree(copy);
  try {
    host = await startBuildModule(copy);
  } catch (error) {
    hostFailure = error;
  }
  copyAfterImport = snapshotTree(copy);
}, SPAWN_TIMEOUT);

afterAll(async () => {
  await host?.stop();
  if (copy) removeCopy(copy);
});

/** build.js's exports, each called in the process that imported them in the copy. */
function loaded() {
  if (!host) throw new Error(`build.js was not imported in the copy: ${hostFailure?.message}`);
  return host.build;
}

/**
 * What the entry check does on Node 24.0 and 24.1: resolve the script path
 * and this module's path, to compare them. Nothing else may happen.
 */
function entryCheckPaths() {
  const scriptPath = childArguments(copy)[0];
  return scriptPath
    ? [`fs.realpathSync(${scriptPath})`, `fs.realpathSync(${realpathSync(buildScript)})`]
    : [];
}

/** An import that started nothing: the exports, and no other trace. */
function expectNothingStarted(evaluation, calls) {
  expect(evaluation.error).toBeNull();
  expect(evaluation.exports).toEqual(EXPORTS);
  expect(evaluation.calls, 'files touched or processes started by build.js').toEqual(calls);
  expect(evaluation.pending, 'timers or other work build.js started').toEqual([]);
  expect(evaluation.output, 'what build.js printed').toEqual([]);
  expect(evaluation.changed, 'what build.js changed in the process').toEqual([]);
}

describe('the entry guard', () => {
  test('importing build.js starts nothing: no file read or written, nothing printed or started, no exit', () => {
    expect(hostFailure?.message).toBeUndefined();
    const { importMetaMain, first } = host.report;

    expectNothingStarted(first, importMetaMain ? [] : entryCheckPaths());
    expect(treeChanges(copyBefore, copyAfterImport), 'the copy, after the import').toEqual([]);
  });

  test('imported a second time in the same process, it still starts nothing', () => {
    expect(hostFailure?.message).toBeUndefined();
    const { importMetaMain, second } = host.report;

    expectNothingStarted(second, importMetaMain ? [] : entryCheckPaths());
    expect(treeChanges(copyBefore, copyAfterImport), 'the copy, after the import').toEqual([]);
  });

  test('imported where Node has no import.meta.main (24.0 and 24.1), it only resolves the two paths it compares', async () => {
    const before = snapshotTree(copy);
    const withoutMain = await startBuildModule(copy, { importMetaMain: false });
    try {
      expectNothingStarted(withoutMain.report.first, entryCheckPaths());
      expect(await withoutMain.strays()).toEqual({ calls: [], pending: [], output: [] });
    } finally {
      await withoutMain.stop();
    }
    expect(withoutMain.raw).toEqual({ stdout: '', stderr: '' });
    expect(treeChanges(before, snapshotTree(copy))).toEqual([]);
  }, SPAWN_TIMEOUT);

  test('run as a script, it does what the command line asks, and verifying writes nothing', () => {
    const before = snapshotTree(copy);
    const result = runBuildScript(copy, buildScript, ['--verify-public-assets-only']);

    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('Verified 6 approved public image hashes\n');
    expect(result.status).toBe(0);
    expect(treeChanges(before, snapshotTree(copy))).toEqual([]);
  }, SPAWN_TIMEOUT);

  test('run through a symlink, as through the macOS /tmp alias, it still runs', () => {
    const link = join(scratchDirectory('build-link'), 'build.js');
    symlinkSync(buildScript, link);
    const before = snapshotTree(copy);
    const result = runBuildScript(copy, link, ['--verify-public-assets-only']);

    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('Verified 6 approved public image hashes\n');
    expect(result.status).toBe(0);
    expect(treeChanges(before, snapshotTree(copy))).toEqual([]);
  }, SPAWN_TIMEOUT);

  test('run as a script where Node has no import.meta.main, it still runs, also through a symlink', () => {
    const link = join(scratchDirectory('build-link'), 'build.js');
    symlinkSync(buildScript, link);
    const before = snapshotTree(copy);

    for (const script of [buildScript, link]) {
      const result = runBuildScript(copy, script, ['--verify-public-assets-only'], { importMetaMain: false });

      expect(result.stderr).toBe('');
      expect(result.stdout).toBe('Verified 6 approved public image hashes\n');
      expect(result.status).toBe(0);
    }
    expect(treeChanges(before, snapshotTree(copy))).toEqual([]);
  }, SPAWN_TIMEOUT);

  test("Node's own answer decides, when it gives one", async () => {
    const { isEntryScript } = loaded();

    expect(await isEntryScript(true, undefined, buildScript)).toBe(true);
    expect(await isEntryScript(false, buildScript, buildScript)).toBe(false);
  });

  test('without it (Node 24.0 and 24.1), the resolved script path must be this file', async () => {
    const { isEntryScript } = loaded();
    const directory = scratchDirectory('entry');
    const link = join(directory, 'linked-build.js');
    const other = join(directory, 'other.js');
    symlinkSync(buildScript, link);
    writeFileSync(other, '');

    expect(await isEntryScript(undefined, buildScript, buildScript)).toBe(true);
    expect(await isEntryScript(undefined, link, buildScript)).toBe(true);
    expect(await isEntryScript(undefined, other, buildScript)).toBe(false);
    expect(await isEntryScript(undefined, undefined, buildScript)).toBe(false);
    expect(await isEntryScript(undefined, join(directory, 'missing.js'), buildScript)).toBe(false);
  });
});

describe('the command line', () => {
  /** The arguments an npm script gives build.js, as `process.argv` holds them. */
  function argvOf(script) {
    const command = packageScripts[script];
    expect(command).toContain('node build.js');
    const flags = command.split('node build.js')[1].trim().split(/\s+/).filter(Boolean);
    return ['/usr/local/bin/node', '/repo/build.js', ...flags];
  }

  test('each npm script asks for the build it is named for', async () => {
    const { resolveBuildMode } = loaded();

    expect(await resolveBuildMode(argvOf('dev'))).toEqual({ mode: 'watch', serve: true });
    expect(await resolveBuildMode(argvOf('start'))).toEqual({ mode: 'watch', serve: true });
    expect(await resolveBuildMode(argvOf('build'))).toEqual({ mode: 'release', analyze: false });
    expect(await resolveBuildMode(argvOf('build:check'))).toEqual({ mode: 'check', analyze: false });
  });

  test('verification only checks the images, whatever else is asked', async () => {
    const { resolveBuildMode } = loaded();

    expect(await resolveBuildMode(['node', 'build.js', '--verify-public-assets-only']))
      .toEqual({ mode: 'verify-public-assets', manifestFile: './public-assets.json' });
    expect(await resolveBuildMode(['node', 'build.js', '--watch', '--verify-public-assets-only', 'candidate.json']))
      .toEqual({ mode: 'verify-public-assets', manifestFile: 'candidate.json' });
  });

  test('--watch is the dev build, which writes docs/, even beside --check', async () => {
    const { resolveBuildMode } = loaded();

    expect(await resolveBuildMode(['node', 'build.js', '--watch', '--check']))
      .toEqual({ mode: 'watch', serve: false });
  });

  test('--analyze is read by the production builds', async () => {
    const { resolveBuildMode } = loaded();

    expect(await resolveBuildMode(['node', 'build.js', '--check', '--analyze']))
      .toEqual({ mode: 'check', analyze: true });
    expect(await resolveBuildMode(['node', 'build.js', '--analyze']))
      .toEqual({ mode: 'release', analyze: true });
  });
});

describe('the public asset manifest', () => {
  test('the approved manifest passes as it is', async () => {
    const { validatePublicAssetManifest } = loaded();

    expect(await validatePublicAssetManifest(manifest)).toBe(manifest);
  });

  const unsupported = 'Public asset manifest has an unsupported shape';
  const unapproved = 'Public asset manifest is missing its owner approval record';
  test.each([
    ['another schema version', m => { m.schemaVersion = 2; }, unsupported],
    ['no approval record', m => { delete m.approval; }, unsupported],
    ['images that are not a list', m => { m.assets = {}; }, unsupported],
    ['an approver other than the owner', m => { m.approval.approvedBy = 'agent'; }, unapproved],
    ['an approval date in another form', m => { m.approval.approvedOn = '26/08/2026'; }, unapproved],
    ['an empty approval scope', m => { m.approval.scope = ''; }, unapproved],
    ['five images', m => { m.assets.pop(); }, 'Public asset manifest must contain exactly 6 approved images'],
    ['seven images', m => { m.assets.push({ path: 'images/Extra.png', sha256: '0'.repeat(64) }); },
      'Public asset manifest must contain exactly 6 approved images'],
    ['an image outside images/', m => { m.assets[0].path = 'docs/Court.png'; },
      'Invalid public image path: docs/Court.png'],
    ['a path that climbs out', m => { m.assets[0].path = 'images/../Court.png'; },
      'Invalid public image path: images/../Court.png'],
    ['a nested image', m => { m.assets[0].path = 'images/old/Court.png'; },
      'Invalid public image path: images/old/Court.png'],
    ['a project archive', m => { m.assets[0].path = 'images/project.zip'; },
      'Invalid public image path: images/project.zip'],
    ['a vector image', m => { m.assets[0].path = 'images/Court.svg'; }, 'Invalid public image path: images/Court.svg'],
    ['a path that is not text', m => { m.assets[0].path = 42; }, 'Invalid public image path: 42'],
    ['the same image twice', m => { m.assets[1].path = m.assets[0].path; },
      'Duplicate public image path: images/Court.png'],
    ['an upper-case hash', m => { m.assets[0].sha256 = m.assets[0].sha256.toUpperCase(); },
      'Invalid SHA-256 for public image: images/Court.png'],
    ['a hash a character short', m => { m.assets[0].sha256 = m.assets[0].sha256.slice(1); },
      'Invalid SHA-256 for public image: images/Court.png'],
  ])('refuses %s', async (_name, change, message) => {
    const { validatePublicAssetManifest } = loaded();
    const candidate = structuredClone(manifest);
    change(candidate);

    expect(await thrownMessage(() => validatePublicAssetManifest(candidate))).toBe(message);
  });
});

describe('the release stamp on index.html', () => {
  const authoredTitle = indexHtml.match(/<title>[^<]*<\/title>/)[0];
  const authoredAppSource = indexHtml.match(/src="app\.js[^"]*"/)[0];
  const authoredStylesheets = [...indexHtml.matchAll(/href="(styles\/[^"?]+\.css)[^"]*"/g)];

  test('stamps the title, app.js and every stylesheet, and adds the no-cache tags', async () => {
    const { rewriteIndexHtml } = loaded();
    const html = await rewriteIndexHtml(indexHtml, RELEASE);

    expect(authoredStylesheets).toHaveLength(6);
    expect(html).toContain(`<title>Route Plotter v${RELEASE}</title>`);
    expect(html).toContain(`<script src="app.js?v=${RELEASE}"></script>`);
    for (const [, href] of authoredStylesheets) {
      expect(html).toContain(`<link rel="stylesheet" href="${href}?v=${RELEASE}">`);
    }
    expect([...html.matchAll(/\?v=([^"]*)"/g)].map(match => match[1]))
      .toEqual(Array(7).fill(RELEASE));
    expect(html).toContain(`<meta charset="UTF-8">${NO_CACHE_TAGS}`);
  });

  test('changes nothing else', async () => {
    const { rewriteIndexHtml } = loaded();
    let html = (await rewriteIndexHtml(indexHtml, RELEASE))
      .replace(NO_CACHE_TAGS, '')
      .replace(`<title>Route Plotter v${RELEASE}</title>`, authoredTitle)
      .replace(`src="app.js?v=${RELEASE}"`, authoredAppSource);
    for (const [authored, href] of authoredStylesheets) {
      html = html.replace(`href="${href}?v=${RELEASE}"`, authored);
    }

    expect(html).toBe(indexHtml);
  });

  test('without a version, adds only the no-cache tags', async () => {
    const { rewriteIndexHtml } = loaded();

    expect(await rewriteIndexHtml(indexHtml, null))
      .toBe(indexHtml.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">${NO_CACHE_TAGS}`));
  });

  test('restamping replaces the earlier stamp rather than adding to it', async () => {
    const { rewriteIndexHtml } = loaded();

    expect(await rewriteIndexHtml(await rewriteIndexHtml(indexHtml, '3.2.1'), '3.2.2'))
      .toBe(await rewriteIndexHtml(indexHtml, '3.2.2'));
  });
});

describe('the check of a generated index.html', () => {
  test('a stamped shell passes, and every local file it needs is one the build ships', async () => {
    const { checkGeneratedIndex, expectedArtifactInventory, rewriteIndexHtml } = loaded();
    const references = await checkGeneratedIndex(await rewriteIndexHtml(indexHtml, RELEASE), RELEASE, approvedImages);
    const shipped = new Set(await expectedArtifactInventory(manifest));

    expect(references).toEqual(expect.arrayContaining([
      'app.js',
      ...[...indexHtml.matchAll(/href="(styles\/[^"?]+\.css)/g)].map(match => match[1]),
      ...approvedImages,
    ]));
    expect(references.filter(reference => !shipped.has(reference))).toEqual([]);
  });

  // What is checked is the `?v=` of each stylesheet that has one; a stylesheet
  // without one beside stamped ones is not caught (inherited; the SPL-06 row
  // records it).
  test('a stylesheet stamped for another release, or none stamped at all, fails the build', async () => {
    const { checkGeneratedIndex, rewriteIndexHtml } = loaded();
    const stamped = await rewriteIndexHtml(indexHtml, RELEASE);
    const message = `Generated index does not cache-bust every stylesheet with v=${RELEASE}`;

    const oneStale = stamped.replace(`styles/main.css?v=${RELEASE}`, 'styles/main.css?v=3.2.998');
    expect(oneStale).not.toBe(stamped);
    expect(await thrownMessage(() => checkGeneratedIndex(oneStale, RELEASE, approvedImages))).toBe(message);
    expect(await thrownMessage(() => checkGeneratedIndex(indexHtml, RELEASE, approvedImages))).toBe(message);
    const noStylesheet = stamped.replace(/<link rel="stylesheet"[^>]*>/g, '');
    expect(await thrownMessage(() => checkGeneratedIndex(noStylesheet, RELEASE, approvedImages))).toBe(message);
  });

  test('the example backgrounds must be exactly the approved images, in order', async () => {
    const { checkGeneratedIndex, rewriteIndexHtml } = loaded();
    const stamped = await rewriteIndexHtml(indexHtml, RELEASE);
    const message = 'Generated index example images do not match the owner-approved public asset manifest';

    expect(await thrownMessage(() => checkGeneratedIndex(stamped, RELEASE, [...approvedImages].reverse())))
      .toBe(message);
    expect(await thrownMessage(() => checkGeneratedIndex(stamped, RELEASE, approvedImages.slice(1)))).toBe(message);
    const extra = stamped.replace('</body>', '<button data-image="images/Extra.png">Extra</button></body>');
    expect(await thrownMessage(() => checkGeneratedIndex(extra, RELEASE, approvedImages))).toBe(message);
  });

  // Only double-quoted src, href and data-image values are read; a
  // single-quoted one is not (inherited; the SPL-06 row records it).
  test('a double-quoted reference to another origin fails the build', async () => {
    const { checkGeneratedIndex, rewriteIndexHtml } = loaded();
    const stamped = await rewriteIndexHtml(indexHtml, RELEASE);

    for (const reference of ['https://cdn.example.com/x.js', 'http://cdn.example.com/x.js', '//cdn.example.com/x.js']) {
      const html = stamped.replace('</body>', `<script src="${reference}"></script></body>`);
      expect(await thrownMessage(() => checkGeneratedIndex(html, RELEASE, approvedImages)))
        .toBe(`Generated index contains outbound resource references: ${reference}`);
    }
  });

  test('local references come back without query or fragment, in document order', async () => {
    const { checkGeneratedIndex } = loaded();
    const html = '<link rel="stylesheet" href="styles/a.css?v=1"><script src="app.js?v=1"></script>' +
      '<a href="#top">Top</a><a href="mailto:someone@example.invalid">Mail</a>' +
      '<img src="data:image/png;base64,AA=="><a href="LICENSE.txt#terms">Licence</a>' +
      '<a href="styles/a.css?v=1">Again</a>';

    expect(await checkGeneratedIndex(html, '1', [])).toEqual(['styles/a.css', 'app.js', 'LICENSE.txt', 'styles/a.css']);
  });
});

describe('the Pages inventory', () => {
  const inventory = [
    'LICENSE.txt',
    'THIRD_PARTY_NOTICES.txt',
    'app.js',
    'app.js.map',
    'examples/nervous-system-flow.zip',
    'examples/parm-aerial-walk.zip',
    'examples/uon-open-day.zip',
    'images/Court.png',
    'images/Garlic.jpg',
    'images/Nervous_System.jpg',
    'images/PARM_Aerial.jpg',
    'images/Rocketry.jpg',
    'images/UoN_map.png',
    'index.html',
    'meta.json',
    'player.js',
    'styles/context-menu.css',
    'styles/dropdown.css',
    'styles/main.css',
    'styles/swatch-picker.css',
    'styles/tokens.css',
    'styles/tooltip.css',
  ];

  test('is the shell, the approved images and archives, the notices and the bundles, sorted', async () => {
    const { expectedArtifactInventory } = loaded();

    expect(await expectedArtifactInventory(manifest)).toEqual(inventory);
  });

  test('a build holding exactly that passes', async () => {
    const { checkArtifactInventory } = loaded();

    expect(await thrownMessage(() => checkArtifactInventory([...inventory], manifest))).toBeNull();
  });

  test('a missing file, a stray file or an unapproved project ZIP fails the build', async () => {
    const { checkArtifactInventory } = loaded();
    const without = file => inventory.filter(entry => entry !== file);

    expect(await thrownMessage(() => checkArtifactInventory(without('player.js'), manifest)))
      .toBe('Build artifact inventory mismatch (missing: player.js; unexpected: none)');
    expect(await thrownMessage(() => checkArtifactInventory([...inventory, 'notes.md'].sort(), manifest)))
      .toBe('Build artifact inventory mismatch (missing: none; unexpected: notes.md)');
    expect(await thrownMessage(() => checkArtifactInventory([...inventory, 'examples/my-project.zip'].sort(), manifest)))
      .toBe('Build artifact inventory mismatch (missing: none; unexpected: examples/my-project.zip)');
    expect(await thrownMessage(() => checkArtifactInventory([...without('app.js.map'), 'app.js.bak'].sort(), manifest)))
      .toBe('Build artifact inventory mismatch (missing: app.js.map; unexpected: app.js.bak)');
  });
});

describe('publishing a build', () => {
  function setUp() {
    const root = scratchDirectory('publish');
    return { published: join(root, 'docs'), staging: join(root, 'staging'), backup: join(root, 'backup') };
  }

  test('swaps the new tree in and removes the old one', async () => {
    const { publishBuiltOutput } = loaded();
    const { published, staging, backup } = setUp();
    writeTree(published, { 'app.js': 'old', 'stale.txt': 'from an older build' });
    writeTree(staging, { 'app.js': 'new', 'styles/main.css': 'new' });

    await publishBuiltOutput(staging, published, backup);

    expect(readTree(published)).toEqual({ 'app.js': 'new', 'styles/main.css': 'new' });
    expect(existsSync(staging)).toBe(false);
    expect(existsSync(backup)).toBe(false);
  });

  test('a first publish moves the tree in', async () => {
    const { publishBuiltOutput } = loaded();
    const { published, staging, backup } = setUp();
    writeTree(staging, { 'app.js': 'new' });

    await publishBuiltOutput(staging, published, backup);

    expect(readTree(published)).toEqual({ 'app.js': 'new' });
    expect(existsSync(backup)).toBe(false);
  });

  test('an old tree that cannot be removed after the swap is a warning, not a failure', async () => {
    allowConsole(/stale backup could not be removed/);
    const { publishBuiltOutput } = loaded();
    const { published, staging, backup } = setUp();
    writeTree(published, { 'app.js': 'old' });
    lockDirectory(join(published, 'locked'));
    writeTree(staging, { 'app.js': 'new' });

    expect(await thrownMessage(() => publishBuiltOutput(staging, published, backup))).toBeNull();

    expect(readTree(published)).toEqual({ 'app.js': 'new' });
    expect(existsSync(join(backup, 'locked', 'held.txt'))).toBe(true);
    expect(recordedConsole()).toEqual([expect.stringMatching(
      new RegExp(`^warn: Published successfully; stale backup could not be removed: ${escapeRegExp(backup)} \\(`)
    )]);
  });

  test('a swap that fails puts the old tree back and fails', async () => {
    const { publishBuiltOutput } = loaded();
    const { published, staging, backup } = setUp();
    writeTree(published, { 'app.js': 'old' });

    expect(await thrownMessage(() => publishBuiltOutput(staging, published, backup))).toMatch(/^ENOENT/);

    expect(readTree(published)).toEqual({ 'app.js': 'old' });
    expect(existsSync(backup)).toBe(false);
  });
});

describe('a failed build', () => {
  const before = Buffer.from('{\n  "build": 692,\n  "lastUpdated": "2026-09-24T10:16:20.308Z"\n}\n');

  function setUp() {
    const root = scratchDirectory('rollback');
    const staging = join(root, '.docs-build-test');
    writeTree(staging, { 'app.js': 'half built' });
    return { root, staging, versionFile: join(root, 'version.json') };
  }

  test('a release build puts version.json back byte for byte, and removes its staging output', async () => {
    const { rollBackFailedBuild } = loaded();
    const { staging, versionFile } = setUp();
    writeFileSync(versionFile, '{"build":693}');

    await rollBackFailedBuild(staging, { isCheckBuild: false, versionFile, originalVersionContents: before });

    expect(readFileSync(versionFile)).toEqual(before);
    expect(existsSync(staging)).toBe(false);
  });

  test('a release build removes the version.json it created', async () => {
    const { rollBackFailedBuild } = loaded();
    const { staging, versionFile } = setUp();
    writeFileSync(versionFile, '{"build":1}');

    await rollBackFailedBuild(staging, { isCheckBuild: false, versionFile, originalVersionContents: null });

    expect(existsSync(versionFile)).toBe(false);
    expect(existsSync(staging)).toBe(false);
  });

  test('a check build leaves version.json alone: it never changed it', async () => {
    const { rollBackFailedBuild } = loaded();
    const { staging, versionFile } = setUp();
    writeFileSync(versionFile, 'written since by another build');

    await rollBackFailedBuild(staging, { isCheckBuild: true, versionFile, originalVersionContents: before });

    expect(readFileSync(versionFile, 'utf8')).toBe('written since by another build');
    expect(existsSync(staging)).toBe(false);
  });

  test('staging output that cannot be removed does not stop the rollback', async () => {
    allowConsole(/temporary output could not be removed/);
    const { rollBackFailedBuild } = loaded();
    const { staging, versionFile } = setUp();
    writeFileSync(versionFile, '{"build":693}');
    lockDirectory(join(staging, 'locked'));

    expect(await thrownMessage(() => rollBackFailedBuild(
      staging, { isCheckBuild: false, versionFile, originalVersionContents: before }
    ))).toBeNull();

    expect(readFileSync(versionFile)).toEqual(before);
    expect(existsSync(join(staging, 'locked', 'held.txt'))).toBe(true);
    expect(recordedConsole()).toEqual([expect.stringMatching(
      new RegExp(`^warn: Build failed; temporary output could not be removed: ${escapeRegExp(staging)} \\(`)
    )]);
  });

  test('a rollback that fails is reported, and the staging output still goes', async () => {
    allowConsole(/Version rollback also failed/);
    const { rollBackFailedBuild } = loaded();
    const { root, staging } = setUp();
    const versionFile = join(root, 'no-such-directory', 'version.json');

    expect(await thrownMessage(() => rollBackFailedBuild(
      staging, { isCheckBuild: false, versionFile, originalVersionContents: before }
    ))).toBeNull();

    expect(existsSync(staging)).toBe(false);
    expect(recordedConsole()).toEqual([expect.stringMatching(/^error: Version rollback also failed: Error: ENOENT/)]);
  });
});

describe('the checks a release applies', () => {
  test('are pure: no file touched, nothing printed or started, and their arguments left as they were', async () => {
    expect(hostFailure?.message).toBeUndefined();
    const stamped = (await host.call('rewriteIndexHtml', [indexHtml, RELEASE])).value;
    const inventory = (await host.call('expectedArtifactInventory', [manifest])).value;

    for (const [name, args] of [
      ['validatePublicAssetManifest', [manifest]],
      ['rewriteIndexHtml', [indexHtml, RELEASE]],
      ['checkGeneratedIndex', [stamped, RELEASE, approvedImages]],
      ['expectedArtifactInventory', [manifest]],
      ['checkArtifactInventory', [inventory, manifest]],
      ['resolveBuildMode', [['node', 'build.js', '--check']]],
      ['isEntryScript', [false, buildScript, buildScript]],
    ]) {
      const { error, calls, pending, output, argumentsChanged } = await host.call(name, args);

      expect({ name, error, calls, pending, output, argumentsChanged })
        .toEqual({ name, error: undefined, calls: [], pending: [], output: [], argumentsChanged: false });
    }
  });
});

describe('after every test', () => {
  test('nothing build.js started ran later, nothing reached the terminal, and the copy is as it was', async () => {
    expect(hostFailure?.message).toBeUndefined();

    expect(await host.strays()).toEqual({ calls: [], pending: [], output: [] });
    await host.stop();
    expect(host.raw).toEqual({ stdout: '', stderr: '' });
    expect(treeChanges(copyBefore, snapshotTree(copy))).toEqual([]);
  });
});
