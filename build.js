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
 * - version.json: build number (auto-incremented on every build)
 * 
 * ## Version Increment Guidelines
 * 
 * | Component | When to Increment | Example |
 * |-----------|-------------------|---------|
 * | **major** | Breaking changes, major rewrites, incompatible API changes | 2.x → 3.x |
 * | **minor** | New features, significant improvements, UI changes | 3.0 → 3.1 |
 * | **build** | Auto-incremented on every build (dev iterations, bug fixes) | 3.1.75 → 3.1.76 |
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
import fs from 'fs';
import path from 'path';

// ========== VERSION MANAGEMENT ==========

const VERSION_FILE = './version.json';
const PACKAGE_FILE = './package.json';

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

// Ensure docs directory exists (GitHub Pages convention)
const distDir = './docs';
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Static files to copy
const staticFiles = [
  'index.html',
  'styles/tokens.css',
  'styles/main.css',
  'styles/swatch-picker.css',
  'styles/tooltip.css',
  'styles/dropdown.css',
  'UoN_map.png',
  'UoN_map 24-bit.png'
];

// Static directories to copy (entire folder contents)
const staticDirs = [
  'images'
];

/**
 * Copy a single static file to dist
 * For index.html, also updates version references and adds cache-busting
 */
function copyStaticFile(file, version = null) {
  const src = path.join('.', file);
  const dest = path.join(distDir, file);
  
  // Create directory if needed
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Copy file
  if (fs.existsSync(src)) {
    // Special handling for index.html - update version and add cache-busting
    if (file === 'index.html') {
      let html = fs.readFileSync(src, 'utf8');
      
      if (version) {
        // Update browser tab title (version visible in tab for debugging)
        html = html.replace(/<title>Route Plotter[^<]*<\/title>/, `<title>Route Plotter v${version}</title>`);
        // Add cache-busting to app.js script tag
        html = html.replace(/src="app\.js[^"]*"/, `src="app.js?v=${version}"`);
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
  return false;
}

/**
 * Copy a directory recursively to dist
 * @param {string} dir - Directory name to copy
 */
function copyStaticDir(dir) {
  const srcDir = path.join('.', dir);
  const destDir = path.join(distDir, dir);
  
  if (!fs.existsSync(srcDir)) {
    return false;
  }
  
  // Create destination directory
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Copy all files in directory
  const files = fs.readdirSync(srcDir);
  let count = 0;
  files.forEach(file => {
    // Skip hidden files like .DS_Store
    if (file.startsWith('.')) return;
    
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  });
  
  return count;
}

/**
 * Copy all static files
 * @param {string} version - Version string for cache-busting
 */
function copyAllStaticFiles(version) {
  staticFiles.forEach(file => {
    if (copyStaticFile(file, version)) {
      console.log(`Copied ${file}`);
    }
  });
  
  // Copy static directories
  staticDirs.forEach(dir => {
    const count = copyStaticDir(dir);
    if (count) {
      console.log(`Copied ${dir}/ (${count} files)`);
    }
  });
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
    outfile: 'docs/app.js',
    format: 'esm',
    target: ['es2020', 'chrome58', 'firefox57', 'safari11'],
    loader: {
      '.png': 'file',
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

// Development mode with watch
if (process.argv.includes('--watch')) {
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
      servedir: 'docs',
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
  
  // Increment version for production build
  const { version } = getVersionForBuild();
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
      'docs/meta.json',
      JSON.stringify(result.metafile, null, 2)
    );
    
    // Calculate bundle size
    const stats = fs.statSync('docs/app.js');
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    console.log(`✅ Build complete!`);
    console.log(`   Bundle size: ${sizeKB} KB`);
    console.log(`   Output: docs/app.js`);
    
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
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}
