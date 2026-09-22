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

function run(cwd, command, args) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' }
  });
}

describe('deployment helper safety', () => {
  let fixture;

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
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({
      name: 'release-fixture',
      version: '3.2.0',
      type: 'module',
      scripts: { push: 'node push.js' }
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
});
