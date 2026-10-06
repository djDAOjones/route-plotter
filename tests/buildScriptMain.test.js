// @vitest-environment node
/**
 * TST-11 — build.js's main(), run as a script in a copy of the repository.
 *
 * releaseSafety.test.js pins the release's safety by reading build.js's
 * source: the old tree removed after the swap, and a failure to remove it only
 * a warning; the rollback call in main()'s failure path, and the rollback's
 * order; the stylesheet stamp, its check and the call that applies it. A
 * behaviour-neutral edit (a comment reworded, a local renamed) fails those,
 * and a call made unreachable passes them. SPL-06 exported the two
 * release-safety steps and the checks, and buildScript.test.js calls them;
 * what no test ran was main(), which wires them together. Here the copy's
 * build.js runs as the npm scripts run it, and what it leaves behind is the
 * evidence: a release that publishes, one whose old tree cannot be removed,
 * releases that fail, a check build, and a watch build.
 *
 * The check build is publicationBoundary.test.js's, which runs build.js in the
 * repository; here a check misread as a release would publish only into the
 * copy, where the test sees it.
 *
 * Nothing here runs or imports build.js in the repository
 * (helpers/buildScriptHarness.js says why).
 */

import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  childEnvironment,
  copyRepository,
  projectRoot,
  removeCopy,
  snapshotTree,
  treeChanges,
} from './helpers/buildScriptHarness.js';

// A broken build.js may run a whole build before it is caught.
const SPAWN_TIMEOUT = 120000;

const manifest = JSON.parse(readFileSync(join(projectRoot, 'public-assets.json'), 'utf8'));
const MAJOR_MINOR = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
  .version.split('.').slice(0, 2).join('.');

/** The example archives the manifest approves, which a build must ship and nothing else. */
const approvedExampleArchives = (manifest.exampleProjects?.archives || [])
  .map(archive => `examples/${archive.id}.zip`);

/** Every file a complete Pages build holds (publicationBoundary.test.js's list). */
const PAGES_INVENTORY = [
  'LICENSE.txt',
  'THIRD_PARTY_NOTICES.txt',
  'app.js',
  'app.js.map',
  'index.html',
  'meta.json',
  'player.js',
  'styles/context-menu.css',
  'styles/dropdown.css',
  'styles/main.css',
  'styles/swatch-picker.css',
  'styles/tokens.css',
  'styles/tooltip.css',
  'images/Court.png',
  'images/Garlic.jpg',
  'images/Nervous_System.jpg',
  'images/PARM_Aerial.jpg',
  'images/Rocketry.jpg',
  'images/UoN_map.png',
  ...approvedExampleArchives,
].sort();

const copies = [];
const lockedDirectories = [];

afterEach(() => {
  // Write access back first, or the copy could not be removed.
  for (const directory of lockedDirectories.splice(0)) {
    if (existsSync(directory)) chmodSync(directory, 0o700);
  }
  for (const copy of copies.splice(0)) removeCopy(copy);
});

function freshCopy() {
  const copy = copyRepository();
  copies.push(copy);
  return copy;
}

/**
 * Run the copy's build.js as an npm script runs it: `npm run build` and
 * `npm run build:check` set NODE_ENV=production; `npm run dev` sets nothing.
 */
function runBuild(copy, args, { nodeEnv = 'production' } = {}) {
  const env = childEnvironment(copy);
  if (nodeEnv === null) delete env.NODE_ENV;
  else env.NODE_ENV = nodeEnv;
  return spawnSync(process.execPath, [join(copy, 'build.js'), ...args], {
    cwd: copy,
    env,
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT,
    maxBuffer: 10 * 1024 * 1024,
  });
}

const buildNumberOf = copy => JSON.parse(readFileSync(join(copy, 'version.json'), 'utf8')).build;

/** Every file under a directory, relative to it, sorted. */
function filesUnder(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(root, join(entry.parentPath, entry.name)))
    .sort();
}

/** What a build left beside docs/: its staging output, or the old tree it swapped out. */
function leftovers(copy) {
  return readdirSync(copy).filter(name => /^\.docs-(build|backup)-/.test(name)).sort();
}

/** The stylesheets the authored shell links, in order, without their query. */
function authoredStylesheets(copy) {
  const html = readFileSync(join(copy, 'index.html'), 'utf8');
  return [...html.matchAll(/href="(styles\/[^"?]+\.css)[^"]*"/g)].map(match => match[1]);
}

/** The stylesheet references a generated shell carries, query included. */
function stylesheetReferences(html) {
  return [...html.matchAll(/href="(styles\/[^"]+)"/g)].map(match => match[1]);
}

/** A file that cannot be removed, as a cloud-sync lock holds one: its directory is read-only. */
function lockDirectory(directory) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'held.txt'), 'held');
  chmodSync(directory, 0o500);
  lockedDirectories.push(directory);
  let held = false;
  try {
    rmSync(join(directory, 'held.txt'));
  } catch {
    held = true;
  }
  expect(held, 'a read-only directory refuses removal (run the suite as an ordinary user)').toBe(true);
}

describe('a release (npm run build)', () => {
  test('bumps the version once, swaps in the complete tree stamped with it, and leaves nothing beside docs/', () => {
    const copy = freshCopy();
    const build = buildNumberOf(copy);
    const release = `${MAJOR_MINOR}.${build + 1}`;
    writeFileSync(join(copy, 'docs', 'stale-from-an-older-build.txt'), 'from an older build');

    const result = runBuild(copy, []);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stderr).toBe('');
    expect(buildNumberOf(copy)).toBe(build + 1);
    // The old tree went as a whole: nothing of it outlives the swap.
    expect(filesUnder(join(copy, 'docs'))).toEqual(PAGES_INVENTORY);
    expect(leftovers(copy)).toEqual([]);

    const published = readFileSync(join(copy, 'docs', 'index.html'), 'utf8');
    expect(published).toContain(`<title>Route Plotter v${release}</title>`);
    expect(published).toContain(`src="app.js?v=${release}"`);
    expect(stylesheetReferences(published))
      .toEqual(authoredStylesheets(copy).map(href => `${href}?v=${release}`));
  }, SPAWN_TIMEOUT);

  test('whose old tree cannot be removed still publishes and keeps its version, with a warning', () => {
    const copy = freshCopy();
    const build = buildNumberOf(copy);
    lockDirectory(join(copy, 'docs', 'locked'));

    const result = runBuild(copy, []);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    // The swap is the commit point: a cleanup failure after it must not roll
    // version.json back underneath the tree it published.
    expect(buildNumberOf(copy)).toBe(build + 1);
    expect(filesUnder(join(copy, 'docs'))).toEqual(PAGES_INVENTORY);
    const [backup, ...others] = leftovers(copy);
    expect(others).toEqual([]);
    expect(backup).toMatch(/^\.docs-backup-\d+$/);
    expect(existsSync(join(copy, backup, 'locked', 'held.txt'))).toBe(true);
    lockedDirectories.push(join(copy, backup, 'locked'));
    expect(result.stderr).toMatch(
      new RegExp(`^Published successfully; stale backup could not be removed: \\S+/\\${backup} \\(`)
    );
  }, SPAWN_TIMEOUT);

  test('that fails puts version.json back byte for byte, leaves docs/ alone and removes its staging output', () => {
    const copy = freshCopy();
    const build = buildNumberOf(copy);
    // A reference to a file the build does not ship: the output check refuses
    // it once every bundle is built, the last step before the swap.
    const shell = join(copy, 'index.html');
    writeFileSync(shell, readFileSync(shell, 'utf8')
      .replace('</head>', '  <link rel="icon" href="missing-icon.png">\n</head>'));
    const versionBefore = readFileSync(join(copy, 'version.json'));
    const docsBefore = snapshotTree(join(copy, 'docs'));

    const result = runBuild(copy, []);

    expect(result.status).toBe(1);
    // It had taken its own number, which the rollback gives back.
    expect(result.stdout).toContain(`Building Route Plotter v${MAJOR_MINOR}.${build + 1}`);
    expect(result.stderr)
      .toMatch(/^Build failed: Error: Generated index references missing assets: missing-icon\.png\n/);
    expect(readFileSync(join(copy, 'version.json'))).toEqual(versionBefore);
    expect(treeChanges(docsBefore, snapshotTree(join(copy, 'docs')))).toEqual([]);
    expect(leftovers(copy)).toEqual([]);
  }, SPAWN_TIMEOUT);

  test('that fails where there was no version.json removes the one it created', () => {
    const copy = freshCopy();
    rmSync(join(copy, 'version.json'));
    const shell = join(copy, 'index.html');
    writeFileSync(shell, readFileSync(shell, 'utf8')
      .replace('</head>', '  <link rel="icon" href="missing-icon.png">\n</head>'));

    const result = runBuild(copy, []);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`Building Route Plotter v${MAJOR_MINOR}.1`);
    expect(result.stderr).toMatch(/Build failed: Error: Generated index references missing assets: missing-icon\.png/);
    expect(existsSync(join(copy, 'version.json'))).toBe(false);
    expect(leftovers(copy)).toEqual([]);
  }, SPAWN_TIMEOUT);
});

describe('a check build (npm run build:check)', () => {
  test('verifies the exact Pages inventory, ships only approved archives, and changes nothing', () => {
    const copy = freshCopy();
    const before = snapshotTree(copy);

    const result = runBuild(copy, ['--check']);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stderr).toBe('');
    const inventoryMatch = result.stdout.match(/Artifact inventory \(\d+ files\): (\[[^\n]+\])/);
    expect(inventoryMatch, result.stdout).not.toBeNull();
    const inventory = JSON.parse(inventoryMatch[1]);
    expect(inventory).toEqual(PAGES_INVENTORY);
    expect(inventory.filter(file => /\.zip$/i.test(file))).toEqual([...approvedExampleArchives].sort());
    // Not docs/, not version.json, and no staging output left: a check
    // misread as a release would show here, in the copy.
    expect(treeChanges(before, snapshotTree(copy))).toEqual([]);
  }, SPAWN_TIMEOUT);
});

describe('a watch build (npm run dev, without --serve)', () => {
  let watcher = null;

  afterEach(async () => {
    if (!watcher) return;
    const { child, closed } = watcher;
    watcher = null;
    child.kill('SIGKILL');
    await closed;
  });

  function startWatch(copy) {
    const env = childEnvironment(copy);
    delete env.NODE_ENV;
    const child = spawn(process.execPath, [join(copy, 'build.js'), '--watch'], {
      cwd: copy,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const output = { stdout: '', stderr: '' };
    child.stdout.setEncoding('utf8').on('data', text => { output.stdout += text; });
    child.stderr.setEncoding('utf8').on('data', text => { output.stderr += text; });
    child.on('error', () => {});
    const closed = new Promise(resolve => child.once('close', resolve));
    watcher = { child, closed };
    return output;
  }

  const readIfPresent = file => (existsSync(file) ? readFileSync(file, 'utf8') : '');

  test('writes docs/ in place, bumps the version once, and copies a changed shell stamped with it', async () => {
    const copy = freshCopy();
    const build = buildNumberOf(copy);
    const release = `${MAJOR_MINOR}.${build + 1}`;
    const publishedShell = join(copy, 'docs', 'index.html');

    const output = startWatch(copy);
    await vi.waitFor(() => expect(output.stdout).toContain('Watching static files:'),
      { timeout: SPAWN_TIMEOUT / 2, interval: 50 });

    expect(buildNumberOf(copy)).toBe(build + 1);
    await vi.waitFor(() => expect(readIfPresent(join(copy, 'docs', 'app.js')))
      .toMatch(/^\/\/ Route Plotter v3 - Development Build\n/), { timeout: SPAWN_TIMEOUT / 2, interval: 50 });
    const published = readFileSync(publishedShell, 'utf8');
    expect(published).toContain(`<title>Route Plotter v${release}</title>`);
    expect(stylesheetReferences(published))
      .toEqual(authoredStylesheets(copy).map(href => `${href}?v=${release}`));
    // Written where the dev server serves it, not staged.
    expect(leftovers(copy)).toEqual([]);

    // A shell edited while it watches reaches docs/, stamped with this
    // session's version rather than a new one.
    const authoredShell = join(copy, 'index.html');
    const edited = readFileSync(authoredShell, 'utf8').replace('</body>', '<!-- edited while watching -->\n</body>');
    writeFileSync(authoredShell, edited);
    await vi.waitFor(() => expect(readFileSync(publishedShell, 'utf8')).toContain('<!-- edited while watching -->'),
      { timeout: SPAWN_TIMEOUT / 2, interval: 50 });
    const republished = readFileSync(publishedShell, 'utf8');
    expect(republished).toContain(`<title>Route Plotter v${release}</title>`);
    expect(stylesheetReferences(republished))
      .toEqual(authoredStylesheets(copy).map(href => `${href}?v=${release}`));
    expect(buildNumberOf(copy)).toBe(build + 1);
    expect(output.stderr).toBe('');
  }, SPAWN_TIMEOUT);
});
