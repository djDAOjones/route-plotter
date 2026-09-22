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
 *
 * Any other option is refused before anything runs (DEF-18).
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const STAGE_TARGETS = ['docs', 'version.json'];
const DRY_RUN_OPTION = '--dry-run';
const NPM_SETTING_PREFIX = 'npm_config_';

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

/**
 * Read the helper's one option, refusing anything it would otherwise ignore.
 *
 * A mistyped dry run used to fall through to a real deploy, which on `main` is
 * a live release (DEF-18). A typo reaches the helper in one of two ways:
 * `npm run push -- --dryrun` passes it as an argument, while
 * `npm run push --dryrun` (no `--`) makes npm keep it as its own setting, so
 * the helper sees only an `npm_config_*` variable. npm also exports .npmrc
 * values that way, so npm settings are screened by name, not by an allowlist.
 * npm matches setting names case-insensitively and passes environment values
 * through as written (`NPM_CONFIG_DRY_RUN=1`), so the dry-run setting is read
 * the same way, and a value that is neither yes nor no is refused.
 */
function readOptions(args, env) {
  const unknownOption = args.find(arg => arg.startsWith('-') && arg !== DRY_RUN_OPTION);
  if (unknownOption) {
    throw new Error(`Unknown option: ${unknownOption}. The only option is ${DRY_RUN_OPTION}; nothing was run.`);
  }

  const npmSettings = Object.entries(env)
    .filter(([key]) => key.toLowerCase().startsWith(NPM_SETTING_PREFIX))
    .map(([key, value]) => ({
      key,
      name: key.slice(NPM_SETTING_PREFIX.length).toLowerCase(),
      value: String(value).trim().toLowerCase()
    }));

  const mistyped = npmSettings.find(({ name }) => name !== 'dry_run' && /dry|run/.test(name));
  if (mistyped) {
    throw new Error(
      `npm passed a setting this helper does not honour (${mistyped.key}), probably a mistyped ` +
      `${DRY_RUN_OPTION}. For a dry run use npm run push:dry-run; nothing was run.`
    );
  }

  // `-n` means "dry run" in many tools, but npm reads it as --no-yes and exports
  // an empty `yes`. `yes=false` in an .npmrc looks the same, so the refusal
  // names the bypass: run the helper directly, outside npm's settings.
  if (npmSettings.some(({ name, value }) => name === 'yes' && value === '')) {
    throw new Error(
      'npm passed an empty yes setting, which is how it reads -n. For a dry run use npm run push:dry-run. ' +
      'If yes=false is in your npm config, run node push.js instead; nothing was run.'
    );
  }

  const dryRunValues = npmSettings.filter(({ name }) => name === 'dry_run').map(({ value }) => value);
  const unreadable = dryRunValues.find(value => !['true', '1', 'false', '0', ''].includes(value));
  if (unreadable !== undefined) {
    throw new Error(`npm's dry-run setting "${unreadable}" is neither yes nor no; nothing was run.`);
  }

  return {
    dryRun: args.includes(DRY_RUN_OPTION) || dryRunValues.some(value => value === 'true' || value === '1')
  };
}

function main() {
  const args = process.argv.slice(2);
  const { dryRun } = readOptions(args, process.env);
  const customMessage = args.find(arg => !arg.startsWith('--'));
  const branch = getCurrentBranch();

  console.log(`🧭 Route Plotter deploy helper (${branch} → origin/${branch})\n`);
  assertCleanTree();

  if (dryRun) {
    console.log('[dry-run] npm run check');
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

  // The full gate (tests, shell contract, check build), matching CI.
  console.log('🧪 Running the quality gate (npm run check) ...');
  run('npm', ['run', 'check']);

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
