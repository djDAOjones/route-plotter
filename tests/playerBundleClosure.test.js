// @vitest-environment node
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { describe, expect, test } from 'vitest';

/**
 * TST-07 — the exported player's closure, checked against the real bundle.
 *
 * `src/player/**` must not reach the editor's heavy dependencies: an export
 * that pulled in jszip or mediabunny would carry a muxer and a zip library
 * into every exported HTML file, and the rule has only ever been prose.
 * esbuild's metafile lists exactly what the bundle contains, so this asks the
 * bundler rather than the import statements.
 *
 * Node environment: esbuild cannot run inside jsdom.
 */

const repoRoot = resolve(import.meta.dirname, '..');

const FORBIDDEN = [
  'node_modules/jszip',
  'node_modules/mediabunny',
  'src/services/ImageAssetService.js',
  'src/services/VideoExporter.js',
  'src/services/HTMLExportService.js',
  'src/app/exporting.js',
  'src/app/persistence.js'
];

async function bundleInputs(entry) {
  const result = await build({
    entryPoints: [resolve(repoRoot, entry)],
    bundle: true,
    write: false,
    format: 'iife',
    target: ['es2022'],
    // The same loader and define the real player build uses (build.js →
    // createPlayerBuildOptions), so these are the shipped bundles.
    loader: { '.png': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"test"', APP_VERSION: '"0.0.0-test"' },
    metafile: true,
    logLevel: 'silent'
  });
  return Object.keys(result.metafile.inputs);
}

describe('the exported player bundle is closed (TST-07)', () => {
  test('it carries none of the editor-only modules', async () => {
    const inputs = await bundleInputs('src/player/playerEntry.js');

    expect(inputs.filter(input => FORBIDDEN.some(name => input.includes(name)))).toEqual([]);
    // This really is the player bundle, with its own render stack.
    expect(inputs).toContain('src/player/PlayerApp.js');
    expect(inputs).toContain('src/services/RenderingService.js');
  }, 60000);

  test('the editor bundle does carry them, so the check can tell them apart', async () => {
    const inputs = await bundleInputs('src/main.js');
    const found = FORBIDDEN.filter(name => inputs.some(input => input.includes(name)));

    expect(found).toEqual(FORBIDDEN);
  }, 60000);
});
