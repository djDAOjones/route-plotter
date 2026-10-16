import { expect, test } from 'vitest';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { createFinishPackingContext } from '../src/utils/finishArea.js';

const make = () => new FlowLayer({ id: 'same', guideType: 'graph', graph: {
  nodes: [{ id: 'a', type: 'entry', x: 0.2, y: 0.5,
    area: { shape: 'rectangle', width: 0.2, height: 0.3, turn: 17 } },
  { id: 'z', type: 'exit', x: 0.8, y: 0.5,
    area: { shape: 'ellipse', width: 0.3, height: 0.3, turn: 0 } }],
  edges: [{ id: 'az', sourceId: 'a', targetId: 'z', direction: 'one-way', controlPoints: [{ x: 0.4, y: 0.2 }] }],
}, emitters: [{ id: 'e', seed: 7, dotCount: 11, waitAtStart: true, lifecycleMode: 'collect',
  groups: true, groupSize: 4, groupWidth: 0.13, releaseStart: 0.2, releaseDuration: 0.6 }] });
const context = { durationMs: 13000, imageAspect: 2, finishReleaseContext: { durationMs: 10000 },
  finishPackingContext: createFinishPackingContext({ renderReference: { width: 1920, height: 1080 } }) };
const read = (engine, layer, ctx = context) => ({ frames: [0, 3000, 7000, 12000, 20000]
  .map(t => engine.evaluate(t, layer, ctx)), rows: engine.scheduleDots(layer, ctx), end: engine.crowdFinishMs(layer, ctx) });

test('G ranks and route rows invalidate on full area/aspect/identity tuples, while release-only edits reuse geometry', () => {
  const layer = make(), engine = new SwarmEngine();
  read(engine, layer); let prior = engine._groupGeometryCache.get(layer);
  for (const edit of [() => { layer.graph.getNode('a').area.turn = 91; },
    () => { layer.graph.getNode('a').area.width = 0.31; },
    () => { layer.emitters[0].update({ seed: 88 }); }, () => { layer.emitters[0].update({ dotCount: 13 }); }]) {
    edit(); expect(read(engine, layer)).toEqual(read(new SwarmEngine(), layer));
    expect(engine._groupGeometryCache.get(layer)).not.toBe(prior); prior = engine._groupGeometryCache.get(layer);
  }
  expect(read(engine, layer, { ...context, imageAspect: 0.5 })).toEqual(
    read(new SwarmEngine(), layer, { ...context, imageAspect: 0.5 }));
  expect(engine._groupGeometryCache.get(layer)).not.toBe(prior);
  read(engine, layer); prior = engine._groupGeometryCache.get(layer);
  layer.emitters[0].update({ releaseStart: 0.4, onsetVariance: 1, speed: 0.8 });
  expect(read(engine, layer)).toEqual(read(new SwarmEngine(), layer));
  expect(engine._groupGeometryCache.get(layer)).toBe(prior);
  const other = make(); other.graph.getNode('a').area.turn = -79;
  expect(read(engine, other)).toEqual(read(new SwarmEngine(), other));
  expect(read(engine, layer)).toEqual(read(new SwarmEngine(), layer));
});

test('all-area eligibility refreshes and authored-on waiting excludes F independently of its stored configuration', () => {
  const layer = make(), engine = new SwarmEngine();
  const individual = FlowLayer.fromJSON(layer.toJSON()); individual.emitters[0].update({ groups: false });
  expect(read(engine, layer)).toEqual(read(new SwarmEngine(), individual));
  const rows = engine._groupGeometryCache.get(layer).byEmitter.get(layer.emitters[0]);
  expect(new Set(rows.map(row => row.group)).size).toBe(11);
  layer.graph.addNode({ id: 'extra', type: 'entry', x: 0.3, y: 0.7 });
  expect(engine.evaluate(0, layer, context)).toEqual([]);
  expect(read(engine, layer)).toEqual(read(new SwarmEngine(), layer));
  layer.graph.getNode('extra').area = { shape: 'ellipse', width: 0.2, height: 0.2, turn: 0 };
  expect(engine.evaluate(0, layer, context)).toHaveLength(11);
  expect(read(engine, layer)).toEqual(read(new SwarmEngine(), layer));
  layer.emitters[0].update({ waitAtStart: false });
  const f = FlowLayer.fromJSON(layer.toJSON());
  expect(read(engine, layer)).toEqual(read(new SwarmEngine(), f));
  const groups = engine._groupGeometryCache.get(layer).byEmitter.get(layer.emitters[0]);
  expect(new Set(groups.map(row => row.group)).size).toBe(3);
});
