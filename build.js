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
 */

import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'fs';
import path from 'path';

// ========== VERSION MANAGEMENT ==========

const VERSION_FILE = './version.json';
const PACKAGE_FILE = './package.json';
const PUBLIC_ASSET_MANIFEST_FILE = './public-assets.json';
const APPROVED_PUBLIC_ASSET_COUNT = 6;

/**
 * Read and validate the owner-approved public image manifest. Its paths are
 * repository-relative and deliberately limited to bitmap files in images/;
 * project archives can therefore never enter the Pages copy list through this
 * boundary.
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

// Read-only verification mode lets the focused boundary test exercise a bad
// manifest without ever replacing an approved image in the shared worktree.
const verifyOnlyIndex = process.argv.indexOf('--verify-public-assets-only');
if (verifyOnlyIndex !== -1) {
  const candidateManifestFile = process.argv[verifyOnlyIndex + 1] || PUBLIC_ASSET_MANIFEST_FILE;
  try {
    const candidateManifest = readPublicAssetManifest(candidateManifestFile);
    verifyPublicAssetHashes(candidateManifest);
    console.log(`Verified ${candidateManifest.assets.length} approved public image hashes`);
    process.exit(0);
  } catch (error) {
    console.error(`Public asset verification failed: ${error.message}`);
    process.exit(1);
  }
}

const publicAssetManifest = readPublicAssetManifest();
verifyPublicAssetHashes(publicAssetManifest);
const approvedPublicImageFiles = publicAssetManifest.assets.map(asset => asset.path);
const approvedPublicImageHashes = new Map(
  publicAssetManifest.assets.map(asset => [asset.path, asset.sha256])
);

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

const isWatchMode = process.argv.includes('--watch');
const isCheckBuild = process.argv.includes('--check');
const publishedDistDir = path.resolve('docs');
const originalVersionContents = fs.existsSync(VERSION_FILE)
  ? fs.readFileSync(VERSION_FILE)
  : null;

// Production output is assembled away from docs/ and swapped into place only
// after every bundle and referenced asset has passed validation. This prevents
// stale committed files from making an incomplete build look healthy.
const distDir = isWatchMode
  ? publishedDistDir
  : fs.mkdtempSync(path.resolve('.docs-build-'));

fs.mkdirSync(distDir, { recursive: true });

// Static shell files plus the manifest-derived, byte-bound image allowlist.
const staticShellFiles = [
  'index.html',
  'styles/tokens.css',
  'styles/main.css',
  'styles/swatch-picker.css',
  'styles/tooltip.css',
  'styles/dropdown.css',
  'styles/context-menu.css'
];
const staticFiles = [...staticShellFiles, ...approvedPublicImageFiles];

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
    let html = fs.readFileSync(src, 'utf8');
    
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
    fs.writeFileSync(dest, html);
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
 * Verify that every local asset referenced by the generated shell exists.
 * This is deliberately performed before docs/ is replaced.
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
  const stylesheetVersions = [...html.matchAll(/href="styles\/[^"?]+\.css\?v=([^"]+)"/g)]
    .map(match => match[1]);
  if (stylesheetVersions.length === 0 || stylesheetVersions.some(value => value !== version)) {
    throw new Error(`Generated index does not cache-bust every stylesheet with v=${version}`);
  }

  const referencedPublicImages = [...html.matchAll(/\bdata-image="([^"]+)"/g)]
    .map(match => match[1]);
  if (JSON.stringify(referencedPublicImages) !== JSON.stringify(approvedPublicImageFiles)) {
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
  const references = rawReferences
    .map(ref => ref.split(/[?#]/, 1)[0])
    .filter(ref => ref && !ref.startsWith('#') && !/^(?:https?:|mailto:|data:)/.test(ref));

  const missing = [...new Set(references)]
    .filter(ref => !fs.existsSync(path.join(outputDir, ref)));
  if (missing.length > 0) {
    throw new Error(`Generated index references missing assets: ${missing.join(', ')}`);
  }

  verifyPublicAssetHashes(publicAssetManifest, outputDir);

  const expectedInventory = [
    ...staticFiles,
    'app.js',
    'app.js.map',
    'player.js',
    'meta.json'
  ].sort();
  const actualInventory = listOutputFiles(outputDir);
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
  if (actualInventory.some(file => /\.zip$/i.test(file))) {
    throw new Error('Build output contains a project ZIP');
  }
  console.log(`Artifact inventory (${actualInventory.length} files): ${JSON.stringify(actualInventory)}`);
  return actualInventory;
}

/**
 * Replace the Pages directory only after a complete build. The staging and
 * backup directories share the repository filesystem, so rename is atomic.
 * @param {string} stagingDir
 */
function publishBuiltOutput(stagingDir) {
  const backupDir = path.resolve(`.docs-backup-${process.pid}`);
  fs.rmSync(backupDir, { recursive: true, force: true });
  let previousOutputMoved = false;

  if (fs.existsSync(publishedDistDir)) {
    fs.renameSync(publishedDistDir, backupDir);
    previousOutputMoved = true;
  }

  try {
    fs.renameSync(stagingDir, publishedDistDir);
  } catch (error) {
    if (!fs.existsSync(publishedDistDir) && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, publishedDistDir);
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
  if (process.argv.includes('--serve')) {
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
    if (process.argv.includes('--analyze')) {
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
      publishBuiltOutput(distDir);
    }
  } catch (error) {
    // A failed release build must not consume a version number. Restore the
    // exact pre-build file before best-effort staging cleanup: a cloud-sync
    // lock on the temporary directory must not prevent version rollback.
    if (!isCheckBuild) {
      try {
        if (originalVersionContents === null) {
          fs.rmSync(VERSION_FILE, { force: true });
        } else {
          fs.writeFileSync(VERSION_FILE, originalVersionContents);
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
    console.error('Build failed:', error);
    process.exit(1);
  }
}
