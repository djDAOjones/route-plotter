// STACK-04: `npm run measures` counts what each measure says it counts. Each count runs on a planted fixture where the
// answer is known: the boundaries' fixtures for M1 to M3, fixtures/measures/ for M4, M6 and M8. v3's column is held,
// counted once: the table takes it from the script's V3 list alone, so it is the same from a folder with no v3/ in it.
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cruiseWithTheGatesRules, cyclesAndCrossings, featureReach, featureToFeature, interfaceWords, longCode, measures,
  parseArgs, ROOT, sharedThis, table, V3 } from '../../scripts/measures.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const boundaries = (name) => join(FIXTURES, 'boundaries', name);
const MEASURES = join(FIXTURES, 'measures');

describe('the measures, each proved on a planted fixture', () => {
  test('M1: a file outside a feature that imports it counts; the two catalogues do not', async () => {
    const legal = boundaries('legal');
    assert.deepEqual(featureReach(await cruiseWithTheGatesRules(legal), legal), [{ id: 'a', beyond: [] }, { id: 'b', beyond: [] }]);
    const plant = boundaries('core-test-reaches-a-feature');
    assert.deepEqual(featureReach(await cruiseWithTheGatesRules(plant), plant), [{ id: 'a', beyond: ['src/core/model.test.ts'] }]);
  });

  test('M2: an import from one feature into another counts', async () => {
    assert.deepEqual(featureToFeature(await cruiseWithTheGatesRules(boundaries('legal'))), []);
    assert.deepEqual(featureToFeature(await cruiseWithTheGatesRules(boundaries('feature-model-reaches-another-feature'))),
      ['src/features/a/model/settings.ts → src/features/b/model/settings.ts']);
  });

  test('M3: a cycle and an edge the layer rules forbid each count, apart', async () => {
    assert.deepEqual(cyclesAndCrossings(await cruiseWithTheGatesRules(boundaries('legal'))), { cycles: [], crossings: [] });
    const cycle = cyclesAndCrossings(await cruiseWithTheGatesRules(boundaries('cycle-in-core')));
    assert.equal(cycle.cycles.length, 1);
    assert.deepEqual(cycle.crossings, []);
    assert.deepEqual(cyclesAndCrossings(await cruiseWithTheGatesRules(boundaries('kept-core-reaches-editor'))),
      { cycles: [], crossings: ['core-reaches-only-core: src/core/model.ts → src/editor/panel.ts'] });
  });

  test('M4: a mixin assigned into a prototype and a prototype member written from outside both count', () => {
    assert.deepEqual(sharedThis(MEASURES), ['src/editor/app.ts', 'src/editor/app.ts']);
    assert.deepEqual(sharedThis(boundaries('legal')), []);
  });

  test("M6: retired words in what a person reads count, in text, attributes, expressions and both branches; class names do not", async () => {
    const { strings, retired } = await interfaceWords(MEASURES);
    assert.equal(strings, 11);
    assert.deepEqual(retired, [
      'src/editor/Panel.tsx: "waypoint" in "Add a waypoint here."',
      'src/editor/Panel.tsx: "node" in "Delete the node"',
      'src/editor/Panel.tsx: "edges" in "Show the edges"',
      'src/editor/Panel.tsx: "guide" in "guide"',
      'src/editor/Panel.tsx: "node" in "node"',
      'src/editor/Panel.tsx: "waypoint" in "Delete waypoint"',
    ]);
  });

  test('M8: a function over 60 lines and a file over 400 count, each named', async () => {
    assert.deepEqual(await longCode(MEASURES), { functions: ['src/core/long.ts:1'], files: ['src/core/big.ts:401'] });
  });

  test("v3's column is held, counted once: the same from a folder with no v3/ in it", async () => {
    const rows = await measures({ root: boundaries('legal') });
    assert.deepEqual(rows.map((row) => row.id), Object.keys(V3));
    assert.deepEqual(Object.fromEntries(rows.map((row) => [row.id, row.v3])), V3);
    assert.ok(Object.isFrozen(V3));
    assert.match(table(rows), /^\| # \| Measure \| v3 \(baseline\) \| v4 now \| v4 aim \|\n/);
  });

  test('a measure that cannot be taken says so in its own cell, and the rest of the table stands', async () => {
    // fixtures/ itself has no src/ for the dependency graph, so M1 to M3 cannot be taken there.
    const rows = await measures({ root: FIXTURES });
    assert.equal(rows.length, 11);
    for (const row of rows) {
      assert.equal(row.failed, ['M1', 'M2', 'M3'].includes(row.id), row.id);
      if (row.failed) assert.match(row.v4, /^not measured: /, row.id);
    }
    assert.equal(rows.find((row) => row.id === 'M4').v4, '0');
  });

  test('the script takes one option, --gate-seconds N, and refuses anything else before it measures', () => {
    assert.deepEqual(parseArgs([]), {});
    assert.deepEqual(parseArgs(['--gate-seconds', '42']), { gateSeconds: 42 });
    for (const args of [['--gate-seconds'], ['--gate-seconds', 'x'], ['--summary']]) assert.throws(() => parseArgs(args), /unknown arguments/);
    const run = spawnSync(process.execPath, [join(ROOT, 'scripts', 'measures.mjs'), '--gate-secs', '3'], { encoding: 'utf8' });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /measures: unknown arguments: --gate-secs 3/);
  });
});
