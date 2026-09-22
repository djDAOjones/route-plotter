#!/usr/bin/env node

/**
 * Safe deployment helper for GitHub Pages.
 *
 * The helper deploys the current branch so a remediation branch can be chosen
 * as the Pages `/docs` source without rewriting the command. Source must
 * already be committed: only generated docs/ and version.json are committed
 * here, preserving a reproducible source → artifact relationship.
 *
 * Usage:
 *   npm run push
 *   npm run push -- "Custom message"
 *   npm run push:dry-run
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const STAGE_TARGETS = ['docs', 'version.json'];

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    stdio: options.silent ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: false
  });
  return typeof output === 'string' ? output.trim() : '';
}

function commandSucceeded(command, args) {
  return spawnSync(command, args, { stdio: 'ignore', shell: false }).status === 0;
}

function getVersionLabel(buildOffset = 0) {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const ver = JSON.parse(readFileSync('version.json', 'utf8'));
    const [major, minor] = pkg.version.split('.');
    const build = Number(ver.build);
    if (!Number.isSafeInteger(build)) return 'unknown';
    return `${major}.${minor}.${build + buildOffset}`;
  } catch {
    return 'unknown';
  }
}

function getCurrentBranch() {
  const branch = run('git', ['branch', '--show-current'], { silent: true });
  if (!branch) {
    throw new Error('Deployment requires a named branch; detached HEAD is not supported.');
  }
  return branch;
}

function assertCleanTree() {
  const status = run('git', ['status', '--porcelain', '--untracked-files=all'], { silent: true });
  if (status) {
    throw new Error(
      'Commit or stash all source changes before deployment. The build must map to one clean commit.\n' + status
    );
  }
}

function changedPaths() {
  const commands = [
    ['diff', '--name-only'],
    ['diff', '--cached', '--name-only'],
    ['ls-files', '--others', '--exclude-standard']
  ];

  return [...new Set(commands.flatMap(args => {
    const output = run('git', args, { silent: true });
    return output ? output.split('\n') : [];
  }))];
}

function isGeneratedPath(file) {
  return file === 'version.json' || file.startsWith('docs/');
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || process.env.npm_config_dry_run === 'true';
  const customMessage = args.find(arg => !arg.startsWith('--'));
  const branch = getCurrentBranch();

  console.log(`🧭 Route Plotter deploy helper (${branch} → origin/${branch})\n`);
  assertCleanTree();

  if (dryRun) {
    console.log('[dry-run] npm test');
    console.log('[dry-run] npm run build:deploy');
    console.log('[dry-run] verify only docs/ and version.json changed');
    console.log('[dry-run] git add docs version.json');
    // build:deploy increments version.json before the real commit is named, so
    // preview the version that would be produced rather than the current one.
    console.log(`[dry-run] git commit -m "${customMessage || `chore: deploy v${getVersionLabel(1)}`}"`);
    console.log(`[dry-run] git push origin ${branch}`);
    console.log('\n✅ Dry run complete; no files, Git state, or remote refs changed.');
    return;
  }

  console.log('🧪 Running tests ...');
  run('npm', ['test']);

  console.log('\n📦 Building a fresh production bundle → docs/ ...');
  run('npm', ['run', 'build:deploy']);

  const unexpected = changedPaths().filter(file => !isGeneratedPath(file));
  if (unexpected.length > 0) {
    throw new Error(`Build changed non-generated files: ${unexpected.join(', ')}`);
  }

  console.log('\n📋 Staging docs/ and version.json ...');
  run('git', ['add', ...STAGE_TARGETS], { silent: true });

  if (commandSucceeded('git', ['diff', '--cached', '--quiet', '--', ...STAGE_TARGETS])) {
    console.log('\nℹ️  Nothing new to commit. Pushing the existing branch only.');
  } else {
    const commitMessage = customMessage || `chore: deploy v${getVersionLabel()}`;
    console.log(`\n💾 Committing generated output: "${commitMessage}"`);
    run('git', ['commit', '-m', commitMessage], { silent: true });
  }

  console.log(`\n📤 Pushing to origin/${branch} ...`);
  run('git', ['push', 'origin', branch]);
  console.log('\n✅ Branch pushed. Select this branch and /docs in GitHub Pages settings when ready.');
}

try {
  main();
} catch (error) {
  console.error('\n❌ Deployment stopped:', error.message);
  process.exit(1);
}
