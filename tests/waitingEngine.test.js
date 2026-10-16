import { expect, test, vi } from 'vitest';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { sampleCrowdArea } from '../src/utils/crowdArea.js';
import { createFinishPackingContext } from '../src/utils/finishArea.js';

const make = (options = {}) => new FlowLayer({ id: 'waiting', guideType: 'graph', graph: {
  nodes: [{ id: 'a', type: 'entry', x: 0.2, y: 0.3, entryWeight: 3,
    area: { shape: 'ellipse', width: 0.2, height: 0.3, turn: 37 } },
  { id: 'b', type: 'entry', x: 0.2, y: 0.7, entryWeight: 1,
    area: { shape: 'rectangle', width: 0.15, height: 0.2, turn: -17 } },
  { id: 'j', type: 'normal', x: 0.5, y: 0.5 }, { id: 'z', type: 'exit', x: 0.8, y: 0.5 }],
  edges: [{ id: 'aj', sourceId: 'a', targetId: 'j', direction: 'one-way' },
    { id: 'bj', sourceId: 'b', targetId: 'j', direction: 'one-way' },
    { id: 'jz', sourceId: 'j', targetId: 'z', direction: 'one-way' }],
}, emitters: [{ id: 'e', seed: 7, dotCount: 17, speed: 0.35, speedVariance: 0.4, wobble: 0.7,
  lifecycleMode: 'collect', releaseStart: 0.2, releaseDuration: 0.6, onsetVariance: 0.8,
  intensityRamp: -0.3, waitAtStart: true, ...options }] });
const context = (aspect = 1) => ({ durationMs: 13000, imageAspect: aspect,
  finishReleaseContext: { durationMs: 10000 },
  finishPackingContext: createFinishPackingContext({ renderReference: { width: 1920, height: 1080 } }) });
// D's known 3:1 Entry pool and B's independent seed namespace, before G exists.
function starts(layer, aspect) {
  const emitter = layer.emitters[0], entries = ['a', 'b'].map(id => layer.graph.getNode(id));
  return Array.from({ length: emitter.dotCount }, (_, i) => {
    const node = entries[SwarmEngine.hash(emitter.seed, i, 0) < 0.75 ? 0 : 1];
    const seed = (emitter.seed ^ 0xA83E92D7) >>> 0;
    const point = sampleCrowdArea(node.area, node.position(),
      [SwarmEngine.hash(seed, i, 0), SwarmEngine.hash(seed, i, 1)], aspect);
    return { i, node, point, distance: Math.hypot((point.x - node.position().x) * aspect, point.y - node.position().y) };
  });
}

test.each([1, 2, 0.5])('all original-i B samples wait unswayed from zero, intrinsic aspect %s', aspect => {
  const layer = make(), engine = new SwarmEngine(), ctx = context(aspect), expected = starts(layer, aspect);
  for (const t of [0, 1, 1999]) {
    const dots = engine.evaluate(t, layer, ctx);
    expect(dots).toHaveLength(17);
    expect(dots.map(dot => dot.dotIndex)).toEqual(expected.map(row => row.i));
    dots.forEach((dot, i) => expect({ x: dot.x, y: dot.y }).toEqual(expected[i].point));
  }
  expect(engine.evaluate(-Number.MIN_VALUE, layer, ctx)).toEqual([]);
  expect(engine.canRelease(layer, ctx)).toBe(true);
});

test.each([0, 0.4, 1])('distance order assigns the unchanged ordinary onset multiset at variance %s', onsetVariance => {
  const layer = make({ onsetVariance }), engine = new SwarmEngine(), ctx = context(2);
  const ordinary = make({ onsetVariance, waitAtStart: false });
  const old = new SwarmEngine().scheduleDots(ordinary, { durationMs: 10000 });
  const slots = old.map(row => row.onsetFraction).sort((a, b) => a - b);
  const ranked = starts(layer, 2).sort((a, b) => a.distance - b.distance || a.i - b.i);
  const rows = engine.scheduleDots(layer, ctx);
  expect(rows).toHaveLength(17);
  expect(rows.map(row => row.onsetFraction).sort((a, b) => a - b)).toEqual(slots);
  ranked.forEach((row, rank) => {
    expect(rows[row.i].onsetFraction).toBe(slots[rank]);
    expect(rows[row.i].onsetMs).toBe(slots[rank] * 10000);
  });
  // Every earlier sample is still at its own B point until its own exact onset.
  const before = Math.min(...rows.map(row => row.onsetMs)) / 2;
  engine.evaluate(before, layer, ctx).forEach(dot => expect({ x: dot.x, y: dot.y }).toEqual(starts(layer, 2)[dot.dotIndex].point));
});

test('missing one Entry area makes stored-on G inactive and retains exact ordinary movement', () => {
  const layer = make(), ordinary = make({ waitAtStart: false });
  delete layer.graph.getNode('b').area; delete ordinary.graph.getNode('b').area;
  const a = new SwarmEngine(), b = new SwarmEngine(), ctx = context(2);
  for (const t of [0, 500, 3000, 6500, 15000]) expect(a.evaluate(t, layer, ctx)).toEqual(b.evaluate(t, ordinary, ctx));
  expect(a.scheduleDots(layer, ctx)).toEqual(b.scheduleDots(ordinary, ctx));
  expect(a.crowdFinishMs(layer, ctx)).toBe(b.crowdFinishMs(ordinary, ctx));
});

test('cold, warm and backwards seeks reuse rankings and packed routes without the legacy journey cache', () => {
  const layer = make(), engine = new SwarmEngine(), ctx = context(2), times = [0, 2000, 5000, 9000, 15000];
  const expected = times.map(t => new SwarmEngine().evaluate(t, layer, ctx));
  for (const i of [4, 2, 0, 3, 1, 4, 0]) expect(engine.evaluate(times[i], layer, ctx)).toEqual(expected[i]);
  expect(engine._journeyCache.get(layer)).toBeUndefined();
  const geometry = engine._groupGeometryCache.get(layer), allocation = engine._groupAllocationCache.get(layer);
  const choice = vi.spyOn(engine, '_pickEntry');
  times.forEach(t => engine.evaluate(t, layer, ctx));
  expect(engine._groupGeometryCache.get(layer)).toBe(geometry);
  expect(engine._groupAllocationCache.get(layer)).toBe(allocation);
  expect(choice).not.toHaveBeenCalled(); choice.mockRestore();
});

test('each original dot owns its pace through approach/network motion and exact terminal sums', () => {
  const layer = make({ lifecycleMode: 'disappear', releaseStart: 0, releaseDuration: 0, wobble: 0 }), engine = new SwarmEngine();
  const ctx = context(2), expected = starts(layer, 2), rows = engine.scheduleDots(layer, ctx);
  const nextDown = value => {
    const bytes = new ArrayBuffer(8), view = new DataView(bytes); view.setFloat64(0, value);
    view.setBigUint64(0, view.getBigUint64(0) - 1n); return view.getFloat64(0);
  };
  expected.forEach(({ i, node, point }) => {
    const emitter = layer.emitters[0], pace = Math.max(0.05, 1 + emitter.speedVariance * (2 * SwarmEngine.hash(emitter.seed, i, -2) - 1));
    const a = node.position(), approach = Math.hypot(point.x - a.x, point.y - a.y);
    const approachMs = approach / (emitter.speed * pace) * 1000;
    const during = engine.evaluate(approachMs / 2, layer, ctx).find(dot => dot.dotIndex === i);
    expect(during.x).toBeCloseTo((point.x + a.x) / 2, 12);
    expect(during.y).toBeCloseTo((point.y + a.y) / 2, 12);
    const firstLength = Math.hypot(0.5 - a.x, 0.5 - a.y), along = 0.1;
    const walk = engine.evaluate(approachMs + along / (emitter.speed * pace) * 1000, layer, ctx)
      .find(dot => dot.dotIndex === i);
    expect(walk.x).toBeCloseTo(a.x + (0.5 - a.x) * along / firstLength, 12);
    expect(walk.y).toBeCloseTo(a.y + (0.5 - a.y) * along / firstLength, 12);
    const end = rows[i].onsetMs + rows[i].journeyMs;
    expect(engine.evaluate(nextDown(end), layer, ctx).some(dot => dot.dotIndex === i)).toBe(true);
    expect(engine.evaluate(end, layer, ctx).some(dot => dot.dotIndex === i)).toBe(false);
  });
});

test.each([0, 7, 42])('independent original-i junction hashes survive distance ranking for seed %s', seed => {
  const layer = make({ seed, dotCount: 37, releaseStart: 0, releaseDuration: 0, wobble: 0 }), engine = new SwarmEngine();
  layer.graph.addNode({ id: 'other-exit', type: 'exit', x: 0.5, y: 0.8 });
  layer.graph.addEdge({ id: 'other-road', sourceId: 'j', targetId: 'other-exit', direction: 'one-way', weight: 3 });
  const ctx = context(2), end = engine.crowdFinishMs(layer, ctx);
  const dots = engine.evaluate(end, layer, ctx);
  expect(dots).toHaveLength(37);
  dots.forEach(dot => {
    const wanted = SwarmEngine.hash(seed, dot.dotIndex, 2) < 0.25 ? { x: 0.8, y: 0.5 } : { x: 0.5, y: 0.8 };
    expect({ x: dot.x, y: dot.y }).toEqual(wanted);
  });
});


test('Disappear waiting ignores an Exit Finish area and ends at the same exact time', () => {
  const withArea = make({ lifecycleMode: 'disappear' }), withoutArea = make({ lifecycleMode: 'disappear' });
  withArea.graph.getNode('z').area = { shape: 'ellipse', width: 0.4, height: 0.4, turn: 17 };
  const a = new SwarmEngine(), b = new SwarmEngine(), ctx = context(2);
  expect(a.scheduleDots(withArea, ctx)).toEqual(b.scheduleDots(withoutArea, ctx));
  expect(a.crowdFinishMs(withArea, ctx)).toBe(b.crowdFinishMs(withoutArea, ctx));
  for (const t of [0, 2000, 5000, 9000, 15000, 20000]) {
    expect(a.evaluate(t, withArea, ctx)).toEqual(b.evaluate(t, withoutArea, ctx));
  }
});
