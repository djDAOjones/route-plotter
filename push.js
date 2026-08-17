#!/usr/bin/env node

/**
 * Simple deployment helper for GitHub Pages.
 *
 * What it does:
 * 1. Runs `npm run build:deploy` (production build → docs/)
 * 2. Stages docs/, version.json
 * 3. Commits (auto message uses version.json build number unless custom message provided)
 * 4. Pushes to origin/main
 *
 * Usage:
 *   node push.js
 *   node push.js "Custom message"
 *   node push.js --dry-run
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const STAGE_TARGETS = ['docs', 'version.json'];

function exec(cmd, options = {}) {
  const defaults = { stdio: options.silent ? 'pipe' : 'inherit', encoding: 'utf8' };
  const output = execSync(cmd, { ...defaults, ...options });
  return typeof output === 'string' ? output.trim() : '';
}

function tryExec(cmd) {
  try {
    return exec(cmd, { silent: true });
  } catch {
    return '';
  }
}

function getVersionLabel() {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const ver = JSON.parse(readFileSync('version.json', 'utf8'));
    const [major, minor] = pkg.version.split('.');
    return `${major}.${minor}.${ver.build}`;
  } catch {
    return 'unknown';
  }
}

function hasStagedTargetsChanged() {
  const targets = STAGE_TARGETS.join(' ');
  return tryExec(`git status --porcelain ${targets}`).length > 0;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const customMessage = args.find((arg) => !arg.startsWith('--'));

  console.log('🧭 Route Plotter deploy helper\n');

  console.log('📦 Building production bundle → docs/ ...');
  if (dryRun) {
    console.log('[dry-run] npm run build:deploy');
  } else {
    exec('npm run build:deploy');
  }

  console.log('\n📋 Staging docs/, version.json ...');
  if (dryRun) {
    console.log('[dry-run] git add docs version.json');
  } else {
    exec('git add docs version.json', { silent: true });
  }

  if (!hasStagedTargetsChanged()) {
    console.log('\nℹ️  Nothing new to commit for docs/version.json. Aborting.');
    return;
  }

  const versionLabel = getVersionLabel();
  const commitMsg = customMessage || `chore: deploy v${versionLabel}`;

  console.log(`\n💾 Committing with message: "${commitMsg}"`);
  if (dryRun) {
    console.log(`[dry-run] git commit -m "${commitMsg}"`);
  } else {
    exec(`git commit -m "${commitMsg}"`, { silent: true });
  }

  console.log('\n📤 Pushing to origin/main ...');
  if (dryRun) {
    console.log('[dry-run] git push origin main');
  } else {
    exec('git push origin main');
  }

  console.log('\n✅ Deployment initiated! GitHub Pages will update shortly.');
}

try {
  main();
} catch (error) {
  console.error('\n❌ Deployment script failed:', error.message);
  process.exit(1);
}
