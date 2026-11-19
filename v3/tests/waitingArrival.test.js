import { expect, test } from 'vitest';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { sampleCrowdArea } from '../src/utils/crowdArea.js';
import { createFinishPackingContext, packFinishArea } from '../src/utils/finishArea.js';

const pointFor = (e, i, entry) => sampleCrowdArea(entry.area, entry.position(),
  [SwarmEngine.hash((e.seed ^ 0xA83E92D7) >>> 0, i, 0), SwarmEngine.hash((e.seed ^ 0xA83E92D7) >>> 0, i, 1)], 2);
const paceFor = (e, role) => Math.max(0.05, 1 + e.speedVariance * (2 * SwarmEngine.hash(e.seed, role, -2) - 1));

test.each([0.3, 0.02, 0.01])('actual G/F/ordinary arrivals jointly own C places, including capacity reuse at width %s', width => {
  const layer = new FlowLayer({ id: 'mixed', guideType: 'graph', graph: {
    nodes: [{ id: 'a', type: 'entry', x: 0.2, y: 0.5,
      area: { shape: 'ellipse', width: 0.2, height: 0.3, turn: 17 } },
    { id: 'z', type: 'exit', x: 0.8, y: 0.5,
      area: { shape: 'rectangle', width, height: width, turn: 0 } }],
    edges: [{ id: 'az', sourceId: 'a', targetId: 'z', direction: 'one-way' }],
  }, emitters: [
    { id: 'g', seed: 7, dotCount: 7, waitAtStart: true, speed: 0.5, speedVariance: 0.3 },
    { id: 'f', seed: 42, dotCount: 5, groups: true, groupSize: 2, groupWidth: 0, speed: 0.8, speedVariance: 0.2 },
    { id: 'ordinary', seed: 99, dotCount: 3, speed: 0.65, speedVariance: 0.4 },
  ].map(e => ({ lifecycleMode: 'collect', releaseStart: 0.1, releaseDuration: 0.6, onsetVariance: 0,
    wobble: 0, dotSize: e.id === 'ordinary' ? 0.5 : 0.4, ...e })) });
  const plane = createFinishPackingContext({ renderReference: { width: 800, height: 800 } });
  const ctx = { durationMs: 9000, imageAspect: 2, finishReleaseContext: { durationMs: 10000 }, finishPackingContext: plane };
  const entry = layer.graph.getNode('a'), exit = layer.graph.getNode('z');
  const expected = [];
  layer.emitters.forEach((e, order) => {
    const grouped = e.groups, size = grouped ? e.groupSize : 1, count = Math.ceil(e.dotCount / size);
    const starts = Array.from({ length: e.dotCount }, (_, i) => pointFor(e, i, entry));
    const ranks = [...starts.keys()].sort((a, b) => {
      const distance = i => Math.hypot((starts[i].x - 0.2) * 2, starts[i].y - 0.5);
      return distance(a) - distance(b) || a - b;
    });
    for (let i = 0; i < e.dotCount; i++) {
      const role = grouped ? Math.floor(i / size) : i;
      const slot = e.waitAtStart ? ranks.indexOf(i) : role;
      const onset = (0.1 + 0.6 * (slot + 0.5) / count) * 10000;
      const first = grouped ? role * size : i, last = grouped ? Math.min(first + size, e.dotCount) : i + 1;
      let approach = 0;
      for (let j = first; j < last; j++) approach = Math.max(approach, Math.hypot(starts[j].x - 0.2, starts[j].y - 0.5));
      expected.push({ order, i, emitter: e, arrival: onset + (approach + 0.6) / (e.speed * paceFor(e, role)) * 1000 });
    }
  });
  expected.sort((a, b) => a.arrival - b.arrival || a.order - b.order || a.i - b.i);
  const packing = packFinishArea(exit.area, exit.position(), plane, 0.5, expected.length);
  const engine = new SwarmEngine(), end = engine.crowdFinishMs(layer, ctx), dots = engine.evaluate(end, layer, ctx);
  expect(dots).toHaveLength(expected.length);
  expect(engine.finishAreaSummary(layer, 'z', ctx).capacity).toBe(packing.capacity);
  expected.forEach((row, rank) => {
    const dot = dots.find(d => d.emitterId === row.emitter.id && d.dotIndex === row.i);
    const wanted = packing.places.length ? packing.places[rank % packing.places.length] : exit.position();
    expect({ x: dot.x, y: dot.y }).toEqual(wanted);
    const actual = engine._groupAllocationCache.get(layer).byEmitter.get(row.emitter)[row.i];
    expect(actual.arrivalMs).toBeCloseTo(row.arrival, 8);
  });
});
