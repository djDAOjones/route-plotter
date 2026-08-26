import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, test } from 'vitest';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(projectRoot, 'public-assets.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const temporaryDirectories = [];

const approvedAssets = [
  ['images/Court.png', 'ff7a7436c6cf42afa9d8ee4a5d69d2c94de60f84fc920e58ec22d3fff1693bb5'],
  ['images/Garlic.jpg', '87031c28a3eb6788e9fddcf91393c6f0f80114da22a819a5f3bcaefe90dd5cc6'],
  ['images/Nervous_System.jpg', '25792a838d1a5ebb9d9457375d611198e7e0e6b383c0cf8cc88d1bcd11f1be05'],
  ['images/PARM_Aerial.jpg', '380a6ead0f0a8c179eeee798a835605e8416f1055354b26b6a17c3be22e996af'],
  ['images/Rocketry.jpg', '07e7cd19facb06dc9071929e21ec0130c266467fd9127e15634e2e9e71b05ec8'],
  ['images/UoN_map.png', '2951edd4fd35392948b337224e2820cc6ca64916ebded1f6beb7c789e85d0bea'],
].map(([path, sha256]) => ({ path, sha256 }));

const expectedArtifactInventory = [
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
  ...approvedAssets.map(asset => asset.path),
].sort();

function runBuild(args) {
  return spawnSync(process.execPath, [join(projectRoot, 'build.js'), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' },
    maxBuffer: 10 * 1024 * 1024,
  });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

describe('owner-approved public artifact boundary', () => {
  test('binds the six approved image paths to their reviewed bytes and approval', () => {
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      approval: {
        approvedOn: '2026-08-26',
        approvedBy: 'owner',
        scope: 'The exact bytes of the six listed built-in background images are approved for public publication.',
      },
      assets: approvedAssets,
    });
    expect(manifest.assets).toHaveLength(6);

    for (const asset of manifest.assets) {
      const bytes = readFileSync(join(projectRoot, asset.path));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    }
  });

  test('keeps the example-background references identical to the approved manifest order', () => {
    const html = readFileSync(join(projectRoot, 'index.html'), 'utf8');
    const references = [...html.matchAll(/\bdata-image="([^"]+)"/g)]
      .map(match => match[1]);

    expect(references).toEqual(manifest.assets.map(asset => asset.path));
  });

  test('the Pages shell is same-origin-only and carries its restrictive CSP', () => {
    const html = readFileSync(join(projectRoot, 'index.html'), 'utf8');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("connect-src 'self'");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("base-uri 'none'");

    const resourceReferences = [...html.matchAll(/\b(?:src|href|data-image)="([^"]+)"/g)]
      .map(match => match[1]);
    expect(resourceReferences.some(reference => /^(?:https?:)?\/\//i.test(reference))).toBe(false);
  });

  test('check build verifies the exact Pages inventory and emits no project archive', () => {
    const result = runBuild(['--check']);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const inventoryMatch = result.stdout.match(/Artifact inventory \(\d+ files\): (\[[^\n]+\])/);
    expect(inventoryMatch, result.stdout).not.toBeNull();
    const inventory = JSON.parse(inventoryMatch[1]);

    expect(inventory).toEqual(expectedArtifactInventory);
    expect(inventory.some(file => /\.zip$/i.test(file))).toBe(false);
  });

  test('verification rejects a manifest whose reviewed hash no longer matches', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'route-plotter-public-assets-'));
    temporaryDirectories.push(fixture);
    const mismatched = structuredClone(manifest);
    mismatched.assets[0].sha256 = '0'.repeat(64);
    const candidateManifest = join(fixture, 'public-assets.json');
    writeFileSync(candidateManifest, `${JSON.stringify(mismatched, null, 2)}\n`);

    const result = runBuild(['--verify-public-assets-only', candidateManifest]);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Approved public image hash mismatch');
    expect(`${result.stdout}\n${result.stderr}`).toContain('images/Court.png');
  });
});
