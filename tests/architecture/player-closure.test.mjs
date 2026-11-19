// STACK-04: the closure test on the built exported player (the architecture plan's §8, rule 6). The player's build is
// made again in memory with the build's own settings, so the bundler can say which modules it holds; the test checks
// that bundle is the very file `npm run build` wrote, then that every module in it is in the player's closure: the core,
// the renderer's kit, the player, the player-safe catalogue and the features' model/ and draw/ parts, and never React,
// React DOM, Carbon, jszip, mediabunny or an editor part. Planted entries in fixtures/player/ show the test fails on each.
// The build's own check (vite.config.mjs) refuses any package but cannot see an editor part; this test can.
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildPlayer, closureFindings, ROOT } from '../../scripts/measures.mjs';

const PLANTS = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'player');
const BUILT = join(ROOT, 'dist', 'player', 'player.js');

describe("the exported player's closure, on its build", () => {
  test('the real player: the file npm run build wrote, holding only modules in its closure', async (t) => {
    assert.ok(existsSync(BUILT), 'dist/player/player.js is missing: run `npm run build` first');
    const { code, moduleIds } = await buildPlayer();
    assert.equal(code, readFileSync(BUILT, 'utf8'), "the in-memory build differs from dist/player/player.js");
    for (const id of moduleIds) t.diagnostic(`holds ${id.slice(ROOT.length + 1)}`);
    assert.ok(moduleIds.includes(join(ROOT, 'src', 'exported', 'player.ts')), 'the entry is among its modules');
    assert.deepEqual(closureFindings(moduleIds, ROOT), []);
  });

  test('a clean planted entry passes, so each finding below comes from its plant, not the plants\' folder', async () => {
    const { moduleIds } = await buildPlayer({ root: PLANTS, entry: 'src/exported/clean.ts', check: false });
    assert.deepEqual(closureFindings(moduleIds, PLANTS), []);
  });

  const packages = { react: 'React', 'react-dom': 'React DOM', carbon: 'Carbon', jszip: 'jszip', mediabunny: 'mediabunny' };
  for (const [entry, name] of Object.entries(packages)) {
    test(`a planted ${name} import fails it, and the build's own check refuses it too`, async (t) => {
      const { moduleIds } = await buildPlayer({ root: PLANTS, entry: `src/exported/${entry}.ts`, check: false });
      const findings = closureFindings(moduleIds, PLANTS);
      for (const finding of findings.filter((f) => f.startsWith(`holds ${name} `))) t.diagnostic(finding);
      assert.ok(findings.some((f) => f.startsWith(`holds ${name} (`)), `no finding names ${name}: ${findings.join('; ')}`);
      await assert.rejects(buildPlayer({ root: PLANTS, entry: `src/exported/${entry}.ts` }), /must be one self-contained script/);
    });
  }

  for (const [entry, part] of [['editor-part', 'src/editor/panel.ts'], ['feature-editor-part', 'src/features/a/editor/Panel.ts']]) {
    test(`a planted editor part (${part}) fails it, though the build's own check lets it through`, async (t) => {
      const { moduleIds } = await buildPlayer({ root: PLANTS, entry: `src/exported/${entry}.ts`, check: false });
      const findings = closureFindings(moduleIds, PLANTS);
      for (const finding of findings) t.diagnostic(finding);
      assert.deepEqual(findings, [`reaches an editor part (${part})`]);
      await buildPlayer({ root: PLANTS, entry: `src/exported/${entry}.ts` });
    });
  }

  test("the closure's verdicts on module IDs: the bundler's helper allowed, anything unlisted refused", () => {
    const at = (path) => join(PLANTS, path);
    assert.deepEqual(closureFindings(['\0rolldown/runtime.js', at('src/core/a.ts'), at('src/adapters/render.ts'),
      at('src/adapters/render/kit.ts'), at('src/player/compose.ts'), at('src/features/catalogue.ts'),
      at('src/features/crowd/model/engine.ts'), at('src/features/crowd/draw/dots.ts')], PLANTS), []);
    assert.deepEqual(closureFindings([at('src/adapters/zip.ts'), at('src/features/catalogue.editor.ts'), at('src/ui/theme.ts'),
      at('node_modules/@carbon/styles/x.js'), at('node_modules/left-pad/index.js'), '\0vite/preload-helper.js'], PLANTS), [
      'holds a module outside its closure (src/adapters/zip.ts)',
      'holds a module outside its closure (src/features/catalogue.editor.ts)',
      'reaches an editor part (src/ui/theme.ts)',
      'holds Carbon (node_modules/@carbon/styles/x.js)',
      'holds the package left-pad (node_modules/left-pad/index.js)',
      'holds a module outside its closure (vite/preload-helper.js)',
    ]);
  });
});
