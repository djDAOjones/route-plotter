import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// npm settings inherited from whatever launched the suite (`npm run check`, CI,
// a shell or an .npmrc) would steer the helper under test, so they are dropped
// and each test passes the settings it means.
function run(cwd, command, args, env = {}) {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_config_'))
  );
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...inherited,
      GIT_CONFIG_NOSYSTEM: '1',
      npm_config_userconfig: join(cwd, 'absent-user-npmrc'),
      npm_config_globalconfig: join(cwd, 'absent-global-npmrc'),
      ...env
    }
  });
}

describe('deployment helper safety', () => {
  let fixture;

  function stepsRun() {
    const log = join(fixture, 'steps.log');
    return existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
  }

  function head() {
    return run(fixture, 'git', ['rev-parse', 'HEAD']).stdout;
  }

  test('post-publish backup cleanup is explicitly non-fatal', () => {
    const buildSource = readFileSync(join(projectRoot, 'build.js'), 'utf8');
    const cleanupBlock = buildSource.slice(
      buildSource.indexOf('// The rename above is the publish commit point'),
      buildSource.indexOf('/**\n * Create esbuild plugin')
    );

    expect(cleanupBlock).toContain('fs.rmSync(backupDir');
    expect(cleanupBlock).toContain('catch (error)');
    expect(cleanupBlock).toContain('Published successfully; stale backup could not be removed');
    expect(cleanupBlock).not.toContain('throw error');
  });

  test('failed builds restore version.json before best-effort staging cleanup', () => {
    const buildSource = readFileSync(join(projectRoot, 'build.js'), 'utf8');
    const failureBlock = buildSource.slice(
      buildSource.lastIndexOf('  } catch (error) {'),
      buildSource.lastIndexOf("    console.error('Build failed:', error);")
    );
    const rollbackIndex = failureBlock.indexOf('fs.writeFileSync(VERSION_FILE, originalVersionContents)');
    const cleanupIndex = failureBlock.indexOf('fs.rmSync(distDir, { recursive: true, force: true })');

    expect(rollbackIndex).toBeGreaterThan(-1);
    expect(cleanupIndex).toBeGreaterThan(rollbackIndex);
    expect(failureBlock).toContain('catch (cleanupError)');
    expect(failureBlock).toContain('temporary output could not be removed');
  });

  test('built stylesheet references are cache-busted with the release version', () => {
    const buildSource = readFileSync(join(projectRoot, 'build.js'), 'utf8');
    expect(buildSource).toContain('(_match, href) => `href="${href}?v=${version}"`');
    expect(buildSource).toContain('stylesheetVersions.some(value => value !== version)');
    expect(buildSource).toContain('validateBuiltOutput(distDir, version)');
  });

  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), 'route-plotter-release-'));
    copyFileSync(join(projectRoot, 'push.js'), join(fixture, 'push.js'));
    // Each gate step records its name and fails, so a real run in the fixture
    // always stops at its first step: nothing is ever built, committed or pushed.
    writeFileSync(join(fixture, 'record-step.mjs'), [
      "import { appendFileSync } from 'node:fs';",
      "appendFileSync('steps.log', `${process.argv[2]}\\n`);",
      'process.exit(1);'
    ].join('\n'));
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({
      name: 'release-fixture',
      version: '3.2.0',
      type: 'module',
      scripts: {
        push: 'node push.js',
        test: 'node record-step.mjs test',
        check: 'node record-step.mjs check'
      }
    }));
    writeFileSync(join(fixture, 'version.json'), JSON.stringify({ build: 1 }));

    expect(run(fixture, 'git', ['init', '-b', 'review-remediation']).status).toBe(0);
    expect(run(fixture, 'git', ['config', 'user.email', 'test@example.invalid']).status).toBe(0);
    expect(run(fixture, 'git', ['config', 'user.name', 'Release test']).status).toBe(0);
    expect(run(fixture, 'git', ['add', '.']).status).toBe(0);
    expect(run(fixture, 'git', ['commit', '-m', 'fixture']).status).toBe(0);
  });

  afterEach(() => {
    rmSync(fixture, { recursive: true, force: true });
  });

  test('explicit dry run leaves files and Git state unchanged', () => {
    const marker = join(fixture, 'should-not-exist');
    const result = run(fixture, process.execPath, [
      'push.js',
      '--dry-run',
      `$(touch ${marker})`
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Dry run complete');
    expect(existsSync(marker)).toBe(false);
    expect(run(fixture, 'git', ['status', '--porcelain']).stdout).toBe('');
  });

  test('npm dry-run option is treated as a deployment dry run', () => {
    const result = run(fixture, 'npm', ['run', 'push', '--dry-run']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Dry run complete');
    expect(run(fixture, 'git', ['status', '--porcelain']).stdout).toBe('');
  });

  test('default dry-run commit message predicts the build increment', () => {
    const result = run(fixture, process.execPath, ['push.js', '--dry-run']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[dry-run] git commit -m "chore: deploy v3.2.2"');
    expect(result.stdout).not.toContain('[dry-run] git commit -m "chore: deploy v3.2.1"');
  });

  // DEF-18: a mistyped dry run used to fall through to a real, live release.
  test('an unknown option is refused before any step runs', () => {
    const before = head();
    for (const option of ['--dryrun', '--dry-rn', '-n', '--force']) {
      const result = run(fixture, process.execPath, ['push.js', option]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`Unknown option: ${option}`);
    }
    expect(stepsRun()).toEqual([]);
    expect(head()).toBe(before);
    expect(run(fixture, 'git', ['status', '--porcelain']).stdout).toBe('');
  });

  // Without `--`, npm keeps a misspelt flag as its own setting and the helper
  // receives no argument at all, only an npm_config_* variable.
  test('a dry-run typo that npm keeps as a setting is refused', () => {
    const before = head();
    for (const typo of ['--dryrun', '--dru-run', '-n']) {
      const result = run(fixture, 'npm', ['run', 'push', typo]);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('npm run push:dry-run');
    }
    expect(stepsRun()).toEqual([]);
    expect(head()).toBe(before);
    expect(run(fixture, 'git', ['status', '--porcelain']).stdout).toBe('');
  });

  test('the dry-run setting is read as npm reads it', () => {
    for (const env of [{ NPM_CONFIG_DRY_RUN: 'true' }, { npm_config_dry_run: '1' }, { npm_config_dry_run: 'TRUE' }]) {
      const result = run(fixture, process.execPath, ['push.js'], env);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Dry run complete');
    }
    expect(stepsRun()).toEqual([]);
  });

  test('a dry-run setting that is neither yes nor no is refused', () => {
    const result = run(fixture, process.execPath, ['push.js'], { npm_config_dry_run: 'maybe' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('nothing was run');
    expect(stepsRun()).toEqual([]);
  });

  test('a real deployment runs the canonical check gate first', () => {
    const before = head();
    const result = run(fixture, process.execPath, ['push.js']);

    expect(result.status).toBe(1);
    expect(stepsRun()).toEqual(['check']);
    expect(head()).toBe(before);
  });

  test('the dry run previews the check gate', () => {
    const result = run(fixture, process.execPath, ['push.js', '--dry-run']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[dry-run] npm run check');
    expect(result.stdout).not.toContain('[dry-run] npm test');
  });
});
