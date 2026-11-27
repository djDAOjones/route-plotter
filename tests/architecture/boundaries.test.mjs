// STACK-04: every rule in .dependency-cruiser.cjs is proved for good, not once. Each folder in fixtures/boundaries/ is a
// small src/ tree: `legal` uses every edge the rules allow, so a rule that fires too widely fails here; each other folder
// plants one violation, and must break exactly the rules named for it, from the planted file to its target, as the gate's
// own `npm run boundaries` would report them (the same configuration file, loaded the same way). `npm run
// test:architecture` runs this on every v4 change, so a rule that stops biting is noticed.
import { strict as assert } from 'node:assert';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cruiseWithTheGatesRules, violationLines } from '../../scripts/measures.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'boundaries');
const RULES = {
  core: 'core-reaches-only-core',
  adapters: 'adapters-reach-only-core-and-adapters',
  player: 'player-reaches-only-its-closure',
  exported: 'exported-reaches-only-the-players-closure',
  model: 'feature-model-reaches-only-core-and-its-own-model',
  draw: 'feature-draw-reaches-only-core-render-and-its-own-model',
  editor: 'feature-editor-reaches-only-kit-ui-and-its-own-model',
  feature: 'no-feature-reaches-another-or-a-catalogue',
  catalogues: 'only-the-catalogues-import-a-feature',
  features: 'core-and-adapters-never-reach-features',
  screens: 'editor-screens-never-draw',
  cycles: 'no-cycles',
  unresolvable: 'no-unresolvable',
};

// Each plant: the rules it must break, and the planted edge (from → to) each is reported on.
const PLANTS = {
  legal: [],
  'kept-core-reaches-editor': [['core', 'src/core/model.ts', 'src/editor/panel.ts']],
  'kept-adapter-reaches-editor': [['adapters', 'src/adapters/bridge.ts', 'src/editor/panel.ts']],
  'player-reaches-zip-adapter': [['player', 'src/player/compose.ts', 'src/adapters/zip.ts']],
  'player-reaches-zip-through-render': [['player', 'src/player/compose.ts', 'src/adapters/zip.ts']],
  'player-reaches-editor-app': [['player', 'src/player/compose.ts', 'src/editor/App.ts']],
  'player-reaches-feature-editor-through-catalogue': [['player', 'src/player/compose.ts', 'src/features/a/editor/Panel.ts']],
  'player-reaches-react': [['player', 'src/player/compose.ts', /node_modules\/react\//]],
  'player-reaches-react-dom': [['player', 'src/player/compose.ts', /node_modules\/react-dom\//]],
  'player-reaches-carbon': [['player', 'src/player/compose.ts', /node_modules\/@carbon\/react\//]],
  'player-reaches-jszip': [['player', 'src/player/compose.ts', /node_modules\/jszip\//]],
  'player-reaches-mediabunny': [['player', 'src/player/compose.ts', /node_modules\/mediabunny\//]],
  'exported-reaches-editor-app': [['exported', 'src/exported/player.ts', 'src/editor/App.ts']],
  'exported-reaches-storage-adapter': [['exported', 'src/exported/player.ts', 'src/adapters/storage.ts']],
  'model-reaches-render': [['model', 'src/features/a/model/settings.ts', 'src/adapters/render.ts']],
  'model-reaches-react': [['model', 'src/features/a/model/settings.ts', /node_modules\/react\//]],
  'draw-reaches-zip-adapter': [['draw', 'src/features/a/draw/layer.ts', 'src/adapters/zip.ts']],
  'draw-reaches-editor-kit': [['draw', 'src/features/a/draw/layer.ts', 'src/editor/kit/Slider.ts']],
  'editor-part-reaches-store': [['editor', 'src/features/a/editor/Panel.ts', 'src/editor/store.ts']],
  'editor-part-reaches-own-draw': [['editor', 'src/features/a/editor/Panel.ts', 'src/features/a/draw/layer.ts']],
  'feature-test-reaches-another-feature': [['feature', 'src/features/a/model/settings.test.ts', 'src/features/b/model/settings.ts']],
  'feature-model-reaches-another-feature': [['model', 'src/features/a/model/settings.ts', 'src/features/b/model/settings.ts'],
    ['feature', 'src/features/a/model/settings.ts', 'src/features/b/model/settings.ts']],
  'feature-reaches-a-catalogue': [['feature', 'src/features/a/index.ts', 'src/features/catalogue.ts']],
  'editor-imports-two-features': [['catalogues', 'src/editor/Outline.ts', 'src/features/a/model/settings.ts'],
    ['catalogues', 'src/editor/Outline.ts', 'src/features/b/model/settings.ts']],
  'core-test-reaches-a-feature-through-the-player': [['features', 'src/core/model.test.ts', 'src/features/catalogue.ts'],
    ['features', 'src/core/model.test.ts', 'src/features/a/model/settings.ts']],
  'core-test-reaches-a-feature': [['features', 'src/core/model.test.ts', 'src/features/a/model/settings.ts'],
    ['catalogues', 'src/core/model.test.ts', 'src/features/a/model/settings.ts']],
  'adapter-test-reaches-a-feature': [['features', 'src/adapters/render.test.ts', 'src/features/a/model/settings.ts'],
    ['catalogues', 'src/adapters/render.test.ts', 'src/features/a/model/settings.ts']],
  'adapter-reaches-a-feature': [['adapters', 'src/adapters/render.ts', 'src/features/a/model/settings.ts'],
    ['features', 'src/adapters/render.ts', 'src/features/a/model/settings.ts'],
    ['catalogues', 'src/adapters/render.ts', 'src/features/a/model/settings.ts']],
  'editor-screen-reaches-the-composer': [['screens', 'src/editor/Screen.tsx', 'src/player/compose.ts']],
  'cycle-in-core': [['cycles', 'src/core/a.ts', 'src/core/b.ts']],
  'unresolvable-import': [['unresolvable', 'src/editor/App.ts', './missing']],
};

const matches = (expected, actual) => (expected instanceof RegExp ? expected.test(actual) : expected === actual);

describe("the gate's dependency rules, each broken by a planted violation", () => {
  test('every fixture folder is listed here, and every rule in the configuration is broken by at least one', async () => {
    assert.deepEqual(readdirSync(FIXTURES).sort(), Object.keys(PLANTS).sort());
    const { forbidden } = (await import('../../.dependency-cruiser.cjs')).default;
    const broken = new Set(Object.values(PLANTS).flat().map(([rule]) => RULES[rule]));
    assert.deepEqual(forbidden.map((rule) => rule.name).sort(), [...broken].sort());
    assert.deepEqual(Object.values(RULES).sort(), [...broken].sort());
  });

  for (const [name, edges] of Object.entries(PLANTS)) {
    const rules = [...new Set(edges.map(([rule]) => RULES[rule]))];
    test(`${name}: ${rules.length ? `breaks ${rules.join(' and ')}` : 'breaks no rule'}`, async (t) => {
      const output = await cruiseWithTheGatesRules(join(FIXTURES, name));
      for (const line of violationLines(output)) t.diagnostic(line);
      const found = output.summary.violations.map((v) => [v.rule.name, v.from, v.to]);
      assert.equal(found.length, edges.length, `${found.length} violations, not ${edges.length}: ${JSON.stringify(found)}`);
      for (const [rule, from, to] of edges) {
        assert.ok(found.some(([r, f, d]) => r === RULES[rule] && f === from && matches(to, d)),
          `no ${RULES[rule]} from ${from} to ${to}: ${JSON.stringify(found)}`);
      }
      // Every module was read and every import resolved, except the one plant that tests resolution itself.
      assert.equal(output.summary.error, edges.length);
      if (name !== 'unresolvable-import') {
        assert.ok(output.modules.every((m) => m.dependencies.every((d) => !d.couldNotResolve)), 'an import did not resolve');
      }
    });
  }
});
