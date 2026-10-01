#!/usr/bin/env node

/**
 * Build script for Route Plotter v3
 * Uses esbuild for fast, efficient bundling
 * 
 * ## Version Management
 * 
 * Version format: major.minor.build (e.g., 3.1.76)
 * 
 * Sources:
 * - package.json: major.minor (manually updated)
 * - version.json: build number (incremented once per dev-server session or
 *   production build; `--check` builds never mutate it)
 * 
 * ## Version Increment Guidelines
 * 
 * | Component | When to Increment | Example |
 * |-----------|-------------------|---------|
 * | **major** | Breaking changes, major rewrites, incompatible API changes | 2.x → 3.x |
 * | **minor** | New features, significant improvements, UI changes | 3.0 → 3.1 |
 * | **build** | Incremented per dev-server start or production build (not each watch/check rebuild) | 3.1.75 → 3.1.76 |
 * 
 * Examples:
 * - v3.0 → v3.1: Added trail system, new UI controls
 * - v3.1 → v4.0: Complete rewrite, new file format
 * - v3.1.75 → v3.1.76: Bug fix, code cleanup (automatic)
 * 
 * The combined version is injected into the bundle via esbuild's define feature,
 * making it available as APP_VERSION at runtime.
 * 
 * ## Performance
 * - Version files read once at build start
 * - No runtime overhead (version is compile-time constant)
 * - Minimal I/O (only version.json written on build)
 *
 * ## Running and importing
 * The build runs only when Node runs this file as a script (`node build.js`,
 * as every npm script does); importing it runs nothing (SPL-06). Tests import
 * the pure checks the build applies, and the two release-safety steps
 * (`publishBuiltOutput`, `rollBackFailedBuild`), which act only on the paths
 * they are given.
 */

import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fs from 'fs';
import path from 'path';

// ========== VERSION MANAGEMENT ==========

const VERSION_FILE = './version.json';
const PACKAGE_FILE = './package.json';
const PUBLIC_ASSET_MANIFEST_FILE = './public-assets.json';
const APPROVED_PUBLIC_ASSET_COUNT = 6;

/**
 * Read and validate the owner-approved public image manifest.
 * @param {string} manifestFile
 * @returns {{schemaVersion: number, approval: Object, assets: Array<{path: string, sha256: string}>}}
 */
function readPublicAssetManifest(manifestFile = PUBLIC_ASSET_MANIFEST_FILE) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch (error) {
    throw new Error(`Public asset manifest could not be read: ${manifestFile} (${error.message})`);
  }
  return validatePublicAssetManifest(manifest);
}

/**
 * Check a parsed manifest's owner approval record and image list. Its paths
 * are repository-relative and deliberately limited to bitmap files in images/;
 * project archives can therefore never enter the Pages copy list through this
 * boundary. Pure: whether the files still hold the approved bytes is
 * verifyPublicAssetHashes's check.
 * @param {*} manifest - the parsed manifest
 * @returns {{schemaVersion: number, approval: Object, assets: Array<{path: string, sha256: string}>}} the same manifest
 */
export function validatePublicAssetManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !manifest.approval || !Array.isArray(manifest.assets)) {
    throw new Error('Public asset manifest has an unsupported shape');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.approval.approvedOn || '') ||
      manifest.approval.approvedBy !== 'owner' ||
      typeof manifest.approval.scope !== 'string' || manifest.approval.scope.length === 0) {
    throw new Error('Public asset manifest is missing its owner approval record');
  }
  if (manifest.assets.length !== APPROVED_PUBLIC_ASSET_COUNT) {
    throw new Error(`Public asset manifest must contain exactly ${APPROVED_PUBLIC_ASSET_COUNT} approved images`);
  }

  const seenPaths = new Set();
  for (const asset of manifest.assets) {
    const assetPath = asset?.path;
    const isSafeImagePath = typeof assetPath === 'string' &&
      assetPath === path.posix.normalize(assetPath) &&
      /^images\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp)$/i.test(assetPath);
    if (!isSafeImagePath) throw new Error(`Invalid public image path: ${String(assetPath)}`);
    if (seenPaths.has(assetPath)) throw new Error(`Duplicate public image path: ${assetPath}`);
    if (!/^[a-f0-9]{64}$/.test(asset.sha256 || '')) {
      throw new Error(`Invalid SHA-256 for public image: ${assetPath}`);
    }
    seenPaths.add(assetPath);
  }
  return manifest;
}

/**
 * Verify that every approved path still contains the exact bytes reviewed by
 * the owner. `sourceRoot` may be a staging directory when validating output.
 * @param {{assets: Array<{path: string, sha256: string}>}} manifest
 * @param {string} sourceRoot
 */
function verifyPublicAssetHashes(manifest, sourceRoot = '.') {
  for (const asset of manifest.assets) {
    const file = path.join(sourceRoot, asset.path);
    if (!fs.existsSync(file)) throw new Error(`Approved public image is missing: ${asset.path}`);
    const actual = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (actual !== asset.sha256) {
      throw new Error(
        `Approved public image hash mismatch: ${asset.path} (expected ${asset.sha256}, received ${actual})`
      );
    }
  }
}

// The approved manifest and what the build derives from it. main() reads and
// verifies the manifest before any build step, so every step sees these set;
// importing this file leaves them empty and reads nothing.
let publicAssetManifest = null;
let approvedPublicImageFiles = [];
let approvedPublicImageHashes = new Map();

/**
 * Read package.json version and extract major.minor only
 * @returns {string} Major.minor version (e.g., "3.1")
 */
function readPackageVersion() {
  try {
    const data = fs.readFileSync(PACKAGE_FILE, 'utf8');
    const pkg = JSON.parse(data);
    const version = pkg.version || '3.0.0';
    // Extract only major.minor (drop patch)
    const parts = version.split('.');
    return `${parts[0]}.${parts[1]}`;
  } catch (error) {
    console.warn('⚠️ package.json not found, using default version');
    return '3.0';
  }
}

/**
 * Read build number from version.json
 * @returns {{build: number, lastUpdated: string}}
 */
function readBuildNumber() {
  try {
    const data = fs.readFileSync(VERSION_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('⚠️ version.json not found, creating with build 0');
    return { build: 0, lastUpdated: new Date().toISOString() };
  }
}

/**
 * Write build number to version.json
 * @param {{build: number}} version
 */
function writeBuildNumber(version) {
  const data = {
    build: version.build,
    lastUpdated: new Date().toISOString()
  };
  fs.writeFileSync(VERSION_FILE, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Increment build number and return formatted version string.
 * Combines package.json major.minor with auto-incremented build number.
 * 
 * @returns {string} Full version string (e.g., "3.1.76")
 */
function incrementBuildVersion() {
  const pkgVersion = readPackageVersion();
  const buildData = readBuildNumber();
  buildData.build += 1;
  writeBuildNumber(buildData);
  
  // Format: major.minor.build (no padding)
  return `${pkgVersion}.${buildData.build}`;
}

/**
 * Get current version string without incrementing
 * @returns {string} Full version string (e.g., "3.1.76")
 */
function getCurrentVersion() {
  const pkgVersion = readPackageVersion();
  const buildData = readBuildNumber();
  return `${pkgVersion}.${buildData.build}`;
}

// ========== BUILD SETUP ==========

// Track if this is the initial build (version only increments once per server start)
let initialBuildDone = false;

/**
 * Get version for build - only increments on FIRST build of a dev session.
 * This prevents version jumping when file watchers trigger multiple rebuilds.
 * @returns {{version: string, incremented: boolean}}
 */
let sessionVersion = null; // Cache the version for this session

function getVersionForBuild() {
  if (initialBuildDone) {
    // Subsequent rebuilds in same session - use cached version
    return { version: sessionVersion, incremented: false };
  }
  initialBuildDone = true;
  sessionVersion = incrementBuildVersion();
  return { version: sessionVersion, incremented: true };
}

// Where this run writes: docs/ itself in watch mode, otherwise a staging
// directory (main() says why). Set by main() before any step that writes.
let distDir = null;

// Static shell files plus the manifest-derived, byte-bound image allowlist,
// which main() adds once the manifest is verified.
const staticShellFiles = [
  'index.html',
  'styles/tokens.css',
  'styles/main.css',
  'styles/swatch-picker.css',
  'styles/tooltip.css',
  'styles/dropdown.css',
  'styles/context-menu.css'
];
let staticFiles = [];

// LEGAL-01: the licence and third-party notices ship with the application
// itself, so anyone who receives the bundled components from the live site —
// not only someone who browses the repository — can see what they are and
// where their exact source is. Published as .txt because Pages runs Jekyll
// over docs/, which would render a .md file to HTML under a different name;
// plain text is copied byte for byte, so the link in index.html stays true.
const publishedNoticeFiles = [
  { from: 'THIRD_PARTY_NOTICES.md', to: 'THIRD_PARTY_NOTICES.txt' },
  { from: 'LICENSE', to: 'LICENSE.txt' },
];

/**
 * Stamp the app shell with its release: the version in the tab title, and a
 * `?v=` query on app.js and on every stylesheet (replacing any it had), so a
 * browser fetches this release's files rather than an older cached copy. The
 * no-cache meta tags are added once. Without a version only those tags are
 * added. Pure: the caller reads and writes the file.
 * @param {string} html - index.html as authored
 * @param {string|null} version - the release version, e.g. "3.2.692"
 * @returns {string}
 */
export function rewriteIndexHtml(html, version) {
  if (version) {
    // Update browser tab title (version visible in tab for debugging)
    html = html.replace(/<title>Route Plotter[^<]*<\/title>/, `<title>Route Plotter v${version}</title>`);
    // Add cache-busting to app.js script tag
    html = html.replace(/src="app\.js[^"]*"/, `src="app.js?v=${version}"`);
    // CSS is copied rather than bundled, so it needs the same release
    // version query or Pages clients can retain an older UI indefinitely.
    html = html.replace(
      /href="(styles\/[^"?]+\.css)(?:\?[^\"]*)?"/g,
      (_match, href) => `href="${href}?v=${version}"`
    );
  }

  // Add no-cache meta tag for development (insert after charset meta)
  if (!html.includes('http-equiv="Cache-Control"')) {
    html = html.replace(
      '<meta charset="UTF-8">',
      '<meta charset="UTF-8">\n  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n  <meta http-equiv="Pragma" content="no-cache">\n  <meta http-equiv="Expires" content="0">'
    );
  }
  return html;
}

/**
 * Copy a single static file to dist
 * For index.html, also updates version references and adds cache-busting
 */
function copyStaticFile(file, version = null) {
  const src = path.join('.', file);
  const dest = path.join(distDir, file);

  if (!fs.existsSync(src)) {
    throw new Error(`Required static asset is missing: ${file}`);
  }
  if (approvedPublicImageHashes.has(file)) {
    verifyPublicAssetHashes({ assets: [{ path: file, sha256: approvedPublicImageHashes.get(file) }] });
  }
  
  // Create directory if needed
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Special handling for index.html - update version and add cache-busting
  if (file === 'index.html') {
    fs.writeFileSync(dest, rewriteIndexHtml(fs.readFileSync(src, 'utf8'), version));
  } else {
    fs.copyFileSync(src, dest);
  }
  return true;
}

/**
 * Copy all static files
 * @param {string} version - Version string for cache-busting
 */
function copyAllStaticFiles(version) {
  staticFiles.forEach(file => {
    copyStaticFile(file, version);
    console.log(`Copied ${file}`);
  });
  for (const { from, to } of publishedNoticeFiles) {
    if (!fs.existsSync(from)) {
      throw new Error(`Required notice file is missing: ${from}`);
    }
    fs.copyFileSync(from, path.join(distDir, to));
    console.log(`Copied ${from} as ${to}`);
  }
}

/**
 * Write the downloadable example project archives (DEMO-01).
 *
 * Generated rather than committed as source: the repository keeps the small
 * example definitions and the already-bundled backgrounds, and the archive
 * that pairs them is assembled here. Reproducible byte-for-byte, so a rebuild
 * that changed no example produces no diff.
 */
async function buildExampleArchivesInto(outputDir) {
  const { buildExampleArchives } = await import('./scripts/build-examples.mjs');
  const written = await buildExampleArchives(path.join(outputDir, 'examples'));
  for (const item of written) {
    console.log(`Built examples/${item.file} (${(item.bytes / 1024).toFixed(0)} KB)`);
  }
  return written;
}

/**
 * Enumerate ordinary files in a generated output tree using POSIX separators.
 * Generated symlinks or special entries are not valid Pages artifacts.
 * @param {string} root
 * @param {string} relativeDir
 * @returns {string[]}
 */
function listOutputFiles(root, relativeDir = '') {
  const directory = path.join(root, relativeDir);
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listOutputFiles(root, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    } else {
      throw new Error(`Build output contains a non-file entry: ${relativePath}`);
    }
  }
  return files.sort();
}

/**
 * Check a generated index.html against the release it belongs to: every
 * stylesheet carries this release's `?v=`, the example backgrounds are exactly
 * the owner-approved images in manifest order, and nothing loads from another
 * origin. Pure: the caller reads the file and looks for what it references.
 * @param {string} html - the generated index.html
 * @param {string} version - the version the build stamped
 * @param {string[]} approvedImages - the manifest's image paths, in order
 * @returns {string[]} the local paths it references, without query or
 *   fragment, in document order
 */
export function checkGeneratedIndex(html, version, approvedImages) {
  const stylesheetVersions = [...html.matchAll(/href="styles\/[^"?]+\.css\?v=([^"]+)"/g)]
    .map(match => match[1]);
  if (stylesheetVersions.length === 0 || stylesheetVersions.some(value => value !== version)) {
    throw new Error(`Generated index does not cache-bust every stylesheet with v=${version}`);
  }

  const referencedPublicImages = [...html.matchAll(/\bdata-image="([^"]+)"/g)]
    .map(match => match[1]);
  if (JSON.stringify(referencedPublicImages) !== JSON.stringify(approvedImages)) {
    throw new Error(
      'Generated index example images do not match the owner-approved public asset manifest'
    );
  }

  const rawReferences = [...html.matchAll(/\b(?:src|href|data-image)="([^"]+)"/g)]
    .map(match => match[1]);
  const outboundReferences = rawReferences.filter(ref => /^(?:https?:)?\/\//i.test(ref));
  if (outboundReferences.length > 0) {
    throw new Error(`Generated index contains outbound resource references: ${outboundReferences.join(', ')}`);
  }
  return rawReferences
    .map(ref => ref.split(/[?#]/, 1)[0])
    .filter(ref => ref && !ref.startsWith('#') && !/^(?:https?:|mailto:|data:)/.test(ref));
}

/**
 * Every file a complete Pages build holds, sorted: the static shell, the
 * approved images, the published notices, the two bundles with the app's
 * source map and metafile, and the example archives the manifest approves.
 * Pure.
 * @param {{assets: Array<{path: string}>, exampleProjects?: {archives?: Array<{id: string}>}}} manifest
 * @returns {string[]}
 */
export function expectedArtifactInventory(manifest) {
  return [
    ...staticShellFiles,
    ...manifest.assets.map(asset => asset.path),
    ...publishedNoticeFiles.map(notice => notice.to),
    'app.js',
    'app.js.map',
    'player.js',
    'meta.json',
    ...(manifest.exampleProjects?.archives || [])
      .map(archive => `examples/${archive.id}.zip`)
  ].sort();
}

/**
 * Check a build's file list against that exact inventory: a missing file is
 * an incomplete build, an extra one something that must not reach Pages.
 * Pure: the caller lists the files.
 * @param {string[]} actualInventory - the output's files, as listOutputFiles lists them
 * @param {Object} manifest - the verified public asset manifest
 */
export function checkArtifactInventory(actualInventory, manifest) {
  const expectedInventory = expectedArtifactInventory(manifest);
  const expectedSet = new Set(expectedInventory);
  const actualSet = new Set(actualInventory);
  const missingOutput = expectedInventory.filter(file => !actualSet.has(file));
  const unexpectedOutput = actualInventory.filter(file => !expectedSet.has(file));
  if (missingOutput.length > 0 || unexpectedOutput.length > 0) {
    throw new Error(
      `Build artifact inventory mismatch (missing: ${missingOutput.join(', ') || 'none'}; ` +
      `unexpected: ${unexpectedOutput.join(', ') || 'none'})`
    );
  }
  // Project ZIPs need individual provenance review before publication
  // (decision-log 2026-08-26). The ban is therefore not blanket: an archive
  // may ship only if `public-assets.json` names it as an approved example,
  // which is the record of that review. Anything else — a stray user project,
  // a leaked save — still fails the build.
  const approvedArchives = new Set(
    (manifest.exampleProjects?.archives || [])
      .map(archive => `examples/${archive.id}.zip`)
  );
  const unapprovedArchives = actualInventory
    .filter(file => /\.zip$/i.test(file))
    .filter(file => !approvedArchives.has(file));
  if (unapprovedArchives.length > 0) {
    throw new Error(
      `Build output contains an unapproved project ZIP: ${unapprovedArchives.join(', ')}`
    );
  }
}

/**
 * Verify that every local asset referenced by the generated shell exists.
 * This is deliberately performed before docs/ is replaced. The index and
 * inventory rules are the pure checks above; this reads what they judge.
 * @param {string} outputDir
 */
function validateBuiltOutput(outputDir, version) {
  const required = ['index.html', 'app.js', 'app.js.map', 'player.js', 'meta.json'];
  required.forEach(file => {
    if (!fs.existsSync(path.join(outputDir, file))) {
      throw new Error(`Build output is incomplete: ${file}`);
    }
  });

  const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
  const references = checkGeneratedIndex(html, version, approvedPublicImageFiles);

  const missing = [...new Set(references)]
    .filter(ref => !fs.existsSync(path.join(outputDir, ref)));
  if (missing.length > 0) {
    throw new Error(`Generated index references missing assets: ${missing.join(', ')}`);
  }

  verifyPublicAssetHashes(publicAssetManifest, outputDir);

  const actualInventory = listOutputFiles(outputDir);
  checkArtifactInventory(actualInventory, publicAssetManifest);
  console.log(`Artifact inventory (${actualInventory.length} files): ${JSON.stringify(actualInventory)}`);
  return actualInventory;
}

/**
 * Undo what a failed production build changed: for a release build,
 * version.json goes back to its exact pre-build bytes, or is removed if there
 * was none (a check build never changed it); then the staging output is
 * removed, best effort. Every location is passed in, so a test can run it in a
 * temporary directory; the build passes its own.
 * @param {string} distDir - the staging directory the build was writing
 * @param {{isCheckBuild: boolean, versionFile: string, originalVersionContents: Buffer|null}} state -
 *   whether it was a check build, the version file, and that file's bytes before the build (null: none)
 */
export function rollBackFailedBuild(distDir, { isCheckBuild, versionFile, originalVersionContents }) {
  // A failed release build must not consume a version number. Restore the
  // exact pre-build file before best-effort staging cleanup: a cloud-sync
  // lock on the temporary directory must not prevent version rollback.
  if (!isCheckBuild) {
    try {
      if (originalVersionContents === null) {
        fs.rmSync(versionFile, { force: true });
      } else {
        fs.writeFileSync(versionFile, originalVersionContents);
      }
    } catch (rollbackError) {
      console.error('Version rollback also failed:', rollbackError);
    }
  }
  try {
    fs.rmSync(distDir, { recursive: true, force: true });
  } catch (cleanupError) {
    console.warn(`Build failed; temporary output could not be removed: ${distDir} (${cleanupError.message})`);
  }
}

/**
 * Replace the Pages directory only after a complete build. The staging and
 * backup directories share the repository filesystem, so rename is atomic.
 * Every location is passed in, so a test can publish into a temporary
 * directory; the build passes docs/ and a backup beside it.
 * @param {string} stagingDir - the complete, validated output
 * @param {string} publishedDir - the directory Pages serves
 * @param {string} backupDir - where the previous output waits until the swap has happened
 */
export function publishBuiltOutput(stagingDir, publishedDir, backupDir) {
  fs.rmSync(backupDir, { recursive: true, force: true });
  let previousOutputMoved = false;

  if (fs.existsSync(publishedDir)) {
    fs.renameSync(publishedDir, backupDir);
    previousOutputMoved = true;
  }

  try {
    fs.renameSync(stagingDir, publishedDir);
  } catch (error) {
    if (!fs.existsSync(publishedDir) && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, publishedDir);
    }
    throw error;
  }

  // The rename above is the publish commit point. A cloud-sync lock can make
  // old-output cleanup fail after the new tree is already live; that must not
  // roll version.json back underneath the successfully published bundle.
  if (previousOutputMoved) {
    try {
      fs.rmSync(backupDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Published successfully; stale backup could not be removed: ${backupDir} (${error.message})`);
    }
  }
}

/**
 * Create esbuild plugin that increments version on first build.
 * Returns a plugin configured with the correct version.
 * 
 * @param {string} version - The version string to inject
 * @returns {Object} esbuild plugin
 */
function createVersionPlugin(version) {
  return {
    name: 'version-increment',
    setup(build) {
      build.onStart(() => {
        // Copy static files with version for cache-busting
        copyAllStaticFiles(version);
      });
    }
  };
}

/**
 * Create build options with the correct version injected
 * @param {string} version - Version string to inject
 * @returns {Object} esbuild build options
 */
function createBuildOptions(version) {
  return {
    entryPoints: ['src/main.js'],
    bundle: true,
    minify: process.env.NODE_ENV === 'production',
    sourcemap: true,
    outfile: path.join(distDir, 'app.js'),
    format: 'esm',
    target: ['es2022'],
    loader: {
      // Built-in path heads must survive self-contained HTML export. Large
      // example backgrounds remain explicit copied files rather than imports.
      '.png': 'dataurl',
      '.jpg': 'file',
      '.jpeg': 'file',
      '.svg': 'file'
    },
    define: {
      'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
      'APP_VERSION': `"${version}"`
    },
    plugins: [createVersionPlugin(version)]
  };
}

/**
 * Create build options for the exported-HTML player bundle (Phase 5).
 * Same source tree and defines as the app, but a self-executing IIFE:
 * HTMLExportService inlines docs/player.js into every exported file, so it
 * must run without module loading. Sourcemaps stay out of production — the
 * bundle is embedded verbatim in user-downloaded exports.
 * @param {string} version - Version string to inject
 * @returns {Object} esbuild build options
 */
function createPlayerBuildOptions(version) {
  return {
    entryPoints: ['src/player/playerEntry.js'],
    bundle: true,
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',
    outfile: path.join(distDir, 'player.js'),
    format: 'iife',
    target: ['es2022'],
    loader: {
      '.png': 'dataurl'
    },
    define: {
      'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
      'APP_VERSION': `"${version}"`
    }
  };
}

// ========== ENTRY POINT ==========

/**
 * Which build a command line asks for, in the order the script acts on its
 * flags: `--verify-public-assets-only` (optionally followed by a manifest
 * path) only checks the approved images and exits; otherwise `--watch` is the
 * dev build, which writes docs/ and version.json whatever else is passed,
 * `--check` included; otherwise a production build, validated and discarded
 * under `--check`, or published to docs/ (a release). Pure.
 * @param {string[]} argv - the process arguments, as in `process.argv`
 * @returns {{mode: 'verify-public-assets', manifestFile: string}
 *   | {mode: 'watch', serve: boolean}
 *   | {mode: 'check'|'release', analyze: boolean}}
 */
export function resolveBuildMode(argv) {
  const verifyOnlyIndex = argv.indexOf('--verify-public-assets-only');
  if (verifyOnlyIndex !== -1) {
    return {
      mode: 'verify-public-assets',
      manifestFile: argv[verifyOnlyIndex + 1] || PUBLIC_ASSET_MANIFEST_FILE
    };
  }
  if (argv.includes('--watch')) {
    return { mode: 'watch', serve: argv.includes('--serve') };
  }
  return { mode: argv.includes('--check') ? 'check' : 'release', analyze: argv.includes('--analyze') };
}

/**
 * Whether Node is running this file as its script, rather than a test or
 * another module importing it. Node 24.2 and later say so directly
 * (`import.meta.main`). The engines range starts at 24.0, which lacks it, so
 * there the script path is compared with this module's path, both resolved:
 * `process.argv[1]` keeps a symlink, or the macOS `/tmp` alias, as typed, and
 * an unresolved comparison would skip the build without a word. Pure apart
 * from the `realpath` it is given.
 * @param {boolean|undefined} moduleIsMain - `import.meta.main`
 * @param {string|undefined} scriptPath - `process.argv[1]`
 * @param {string} modulePath - this file's path
 * @param {(file: string) => string} [realpath] - resolves symlinks
 * @returns {boolean}
 */
export function isEntryScript(moduleIsMain, scriptPath, modulePath, realpath = fs.realpathSync) {
  if (typeof moduleIsMain === 'boolean') return moduleIsMain;
  if (!scriptPath) return false;
  try {
    return realpath(scriptPath) === realpath(modulePath);
  } catch {
    return false;
  }
}

/**
 * Run the build the command line asks for. Every step with a side effect
 * starts here, in the order the script has always taken them.
 * @param {string[]} argv - the process arguments, as in `process.argv`
 */
async function main(argv) {
  const request = resolveBuildMode(argv);

  // Read-only verification mode lets the focused boundary test exercise a bad
  // manifest without ever replacing an approved image in the shared worktree.
  if (request.mode === 'verify-public-assets') {
    try {
      const candidateManifest = readPublicAssetManifest(request.manifestFile);
      verifyPublicAssetHashes(candidateManifest);
      console.log(`Verified ${candidateManifest.assets.length} approved public image hashes`);
      process.exit(0);
    } catch (error) {
      console.error(`Public asset verification failed: ${error.message}`);
      process.exit(1);
    }
  }

  publicAssetManifest = readPublicAssetManifest();
  verifyPublicAssetHashes(publicAssetManifest);
  approvedPublicImageFiles = publicAssetManifest.assets.map(asset => asset.path);
  approvedPublicImageHashes = new Map(
    publicAssetManifest.assets.map(asset => [asset.path, asset.sha256])
  );

  const isWatchMode = request.mode === 'watch';
  const isCheckBuild = request.mode === 'check';
  const publishedDistDir = path.resolve('docs');
  const originalVersionContents = fs.existsSync(VERSION_FILE)
    ? fs.readFileSync(VERSION_FILE)
    : null;

  // Production output is assembled away from docs/ and swapped into place only
  // after every bundle and referenced asset has passed validation. This prevents
  // stale committed files from making an incomplete build look healthy.
  distDir = isWatchMode
    ? publishedDistDir
    : fs.mkdtempSync(path.resolve('.docs-build-'));

  fs.mkdirSync(distDir, { recursive: true });
  staticFiles = [...staticShellFiles, ...approvedPublicImageFiles];

  // Development mode with watch
  if (isWatchMode) {
    console.log('Starting development build with watch mode...');

    // Increment version once at start of dev session
    const { version } = getVersionForBuild();
    console.log(`📦 Building Route Plotter v${version}`);

    const buildOptions = createBuildOptions(version);
    const ctx = await esbuild.context({
      ...buildOptions,
      minify: false,
      banner: {
        js: '// Route Plotter v3 - Development Build\n'
      }
    });

    // Watch for changes (JS/source files handled by esbuild)
    await ctx.watch();

    // Player bundle (exported-HTML player) rebuilds alongside the app
    const playerCtx = await esbuild.context({
      ...createPlayerBuildOptions(version),
      minify: false
    });
    await playerCtx.watch();

    // The dev server serves docs/, so the examples have to exist there too or a
    // developer testing "Open example" gets a 404 the production build never has.
    await buildExampleArchivesInto(distDir);

    console.log('Watching for JS changes...');

    // Watch static files for changes (HTML, CSS, images)
    console.log('Watching static files:', staticFiles.join(', '));
    staticFiles.forEach(file => {
      const filePath = path.join('.', file);
      if (!fs.existsSync(filePath)) return;
      try {
        const watcher = fs.watch(filePath, (eventType) => {
          if (eventType !== 'change') return;
          console.log(`\n📄 Static file changed: ${file}`);
          try {
            // Pass sessionVersion for index.html to maintain version injection
            if (copyStaticFile(file, sessionVersion)) {
              console.log(`✅ Copied ${file} to docs/`);
            }
          } catch (err) {
            // OneDrive can remove/replace a file mid-sync; a transient copy failure must not crash the watcher
            console.warn(`⚠️ Skipped copy of ${file}: ${err.message}`);
          }
        });
        // This workspace is OneDrive-synced; sync swaps file inodes, which makes
        // fs.watch emit 'error'. Without this handler Node rethrows it as an
        // uncaught exception and the dev server exits 1.
        watcher.on('error', (err) => {
          console.warn(`⚠️ Watcher error for ${file} (ignored): ${err.message}`);
        });
      } catch (err) {
        console.warn(`⚠️ Could not watch ${file}: ${err.message}`);
      }
    });

    // Serve on port 3000 if --serve flag is present
    if (request.serve) {
      // Use esbuild's serve with onRequest to add no-cache headers
      const serveResult = await ctx.serve({
        servedir: distDir,
        port: 3000,
        host: 'localhost',
        onRequest: (args) => {
          // Log requests for debugging
          if (args.path === '/' || args.path.endsWith('.html')) {
            console.log(`📄 Served: ${args.path}`);
          }
        }
      });
      // We pass host:'localhost', so the URL is always localhost. (Current esbuild
      // returns { hosts: [...] } rather than { host }, which previously logged "undefined".)
      console.log(`Serving at http://localhost:${serveResult.port}`);
      console.log(`💡 Tip: Use Cmd+Shift+R (hard refresh) to bypass browser cache`);
    }
  }
  // Production build
  else {
    console.log('Building for production...');

    // Check builds are non-mutating; release builds increment only when they
    // are going to publish a fresh docs/ tree.
    const version = isCheckBuild ? getCurrentVersion() : getVersionForBuild().version;
    console.log(`📦 Building Route Plotter v${version}`);

    const buildOptions = createBuildOptions(version);

    try {
      const result = await esbuild.build({
        ...buildOptions,
        minify: true,
        banner: {
          js: '// Route Plotter v3 - Production Build\n// Built: ' + new Date().toISOString() + '\n'
        },
        metafile: true
      });

      // Write build metadata
      fs.writeFileSync(
        path.join(distDir, 'meta.json'),
        JSON.stringify(result.metafile, null, 2)
      );

      // Player bundle for exported HTML files (inlined by HTMLExportService)
      await esbuild.build({
        ...createPlayerBuildOptions(version),
        minify: true
      });

      // Downloadable example project saves (DEMO-01) — written before the
      // inventory check, which expects exactly the approved archives.
      await buildExampleArchivesInto(distDir);

      // Calculate bundle sizes
      validateBuiltOutput(distDir, version);

      const stats = fs.statSync(path.join(distDir, 'app.js'));
      const sizeKB = (stats.size / 1024).toFixed(2);
      const playerStats = fs.statSync(path.join(distDir, 'player.js'));
      const playerSizeKB = (playerStats.size / 1024).toFixed(2);

      console.log(`✅ Build complete!`);
      console.log(`   Bundle size: ${sizeKB} KB`);
      console.log(`   Output: ${isCheckBuild ? 'temporary validation output' : 'docs/app.js'}`);
      console.log(`   Player bundle: ${playerSizeKB} KB → docs/player.js`);

      // Analyze bundle if --analyze flag is present
      if (request.analyze) {
        console.log('\nBundle analysis:');
        const meta = result.metafile;
        const inputs = Object.entries(meta.inputs)
          .sort((a, b) => b[1].bytes - a[1].bytes)
          .slice(0, 10);

        inputs.forEach(([file, data]) => {
          const sizeKB = (data.bytes / 1024).toFixed(2);
          console.log(`  ${file}: ${sizeKB} KB`);
        });
      }

      if (isCheckBuild) {
        fs.rmSync(distDir, { recursive: true, force: true });
        console.log('   Check build left docs/ and version.json unchanged');
      } else {
        publishBuiltOutput(distDir, publishedDistDir, path.resolve(`.docs-backup-${process.pid}`));
      }
    } catch (error) {
      rollBackFailedBuild(distDir, { isCheckBuild, versionFile: VERSION_FILE, originalVersionContents });
      console.error('Build failed:', error);
      process.exit(1);
    }
  }
}

// Importing this file (as the tests do) runs nothing: the build starts only
// when Node runs it as a script.
if (isEntryScript(import.meta.main, process.argv[1], fileURLToPath(import.meta.url))) {
  await main(process.argv);
}
