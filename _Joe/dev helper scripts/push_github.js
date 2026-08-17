#!/usr/bin/env node

/**
 * Git Push Script for Route Plotter v3
 * 
 * Automates the commit and push workflow:
 * 1. Runs build to update dist/
 * 2. Copies dist/ to docs/ for GitHub Pages
 * 3. Stages all changes
 * 4. Commits with auto-generated or custom message
 * 5. Pushes to origin
 * 
 * Usage:
 *   node push.js                    # Auto-generates commit message from version
 *   node push.js "Custom message"   # Uses custom commit message
 *   node push.js --dry-run          # Shows what would happen without executing
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ========== CONFIGURATION ==========

const VERSION_FILE = './version.json';
const PACKAGE_FILE = './package.json';
const DIST_DIR = './dist';
const DOCS_DIR = './docs';

// ========== HELPERS ==========

/**
 * Execute a shell command and return output
 * @param {string} cmd - Command to execute
 * @param {boolean} silent - Suppress output
 * @returns {string} Command output
 */
function exec(cmd, silent = false) {
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return output?.trim() || '';
  } catch (error) {
    if (!silent) {
      console.error(`❌ Command failed: ${cmd}`);
      console.error(error.message);
    }
    throw error;
  }
}

/**
 * Execute a shell command and return output (silent, for checking)
 */
function execSilent(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {
    return '';
  }
}

/**
 * Get current version string from package.json and version.json
 * @returns {string} Full version (e.g., "3.1.1017")
 */
function getVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
    const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    const [major, minor] = pkg.version.split('.');
    return `${major}.${minor}.${versionData.build}`;
  } catch {
    return 'unknown';
  }
}

/**
 * Copy directory recursively
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory not found: ${src}`);
  }
  
  // Remove existing dest
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
  }
  
  // Create dest
  fs.mkdirSync(dest, { recursive: true });
  
  // Copy files
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ========== MAIN ==========

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const customMessage = args.find(arg => !arg.startsWith('--'));
  
  console.log('🚀 Route Plotter Push Script\n');
  
  // Check for uncommitted changes first
  const status = execSilent('git status --porcelain');
  const hasChanges = status.length > 0;
  
  if (!hasChanges) {
    console.log('ℹ️  No changes to commit. Working tree clean.');
    
    // Check if we're ahead of remote
    const ahead = execSilent('git rev-list --count @{u}..HEAD 2>/dev/null');
    if (ahead && parseInt(ahead) > 0) {
      console.log(`📤 ${ahead} commit(s) ahead of remote. Pushing...`);
      if (!dryRun) {
        exec('git push');
        console.log('\n✅ Push complete!');
      } else {
        console.log('\n[DRY RUN] Would push existing commits');
      }
    } else {
      console.log('✅ Already up to date with remote.');
    }
    return;
  }
  
  // Step 1: Build
  console.log('📦 Step 1: Building project...');
  if (!dryRun) {
    exec('npm run build');
  } else {
    console.log('[DRY RUN] Would run: npm run build');
  }
  
  // Step 2: Copy dist to docs
  console.log('\n📁 Step 2: Updating docs/ for GitHub Pages...');
  if (!dryRun) {
    copyDir(DIST_DIR, DOCS_DIR);
    console.log('   Copied dist/ → docs/');
  } else {
    console.log('[DRY RUN] Would copy dist/ → docs/');
  }
  
  // Step 3: Stage all changes
  console.log('\n📋 Step 3: Staging changes...');
  if (!dryRun) {
    exec('git add -A', true);
  } else {
    console.log('[DRY RUN] Would run: git add -A');
  }
  
  // Show what's being committed
  const stagedFiles = execSilent('git diff --cached --name-only');
  if (stagedFiles) {
    const fileList = stagedFiles.split('\n');
    console.log(`   ${fileList.length} file(s) staged:`);
    fileList.slice(0, 10).forEach(f => console.log(`   - ${f}`));
    if (fileList.length > 10) {
      console.log(`   ... and ${fileList.length - 10} more`);
    }
  }
  
  // Step 4: Commit
  const version = getVersion();
  const commitMessage = customMessage || `v${version} - build update`;
  
  console.log(`\n💾 Step 4: Committing with message: "${commitMessage}"`);
  if (!dryRun) {
    exec(`git commit -m "${commitMessage}"`, true);
  } else {
    console.log(`[DRY RUN] Would run: git commit -m "${commitMessage}"`);
  }
  
  // Step 5: Push
  console.log('\n📤 Step 5: Pushing to origin...');
  if (!dryRun) {
    exec('git push');
  } else {
    console.log('[DRY RUN] Would run: git push');
  }
  
  // Done
  console.log('\n✅ Push complete!');
  console.log(`   Version: v${version}`);
  console.log('   GitHub Pages will update shortly.');
  console.log('   🔗 https://djdaojones.github.io/router-plotter-02/');
}

main().catch(error => {
  console.error('\n❌ Push failed:', error.message);
  process.exit(1);
});
