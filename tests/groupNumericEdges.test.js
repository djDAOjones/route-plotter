import { expect, test } from 'vitest';
import { stageProjectModel } from '../src/app/persistence.js';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { GraphModel } from '../src/models/GraphModel.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { FinishReleaseClock } from '../src/utils/finishReleaseClock.js';
import { buildGroupRouting, chooseGroupDeparture } from '../src/utils/groupRouting.js';
import { createGroupArc, traceGroupJourney, sampleGroupJourney } from '../src/utils/groupJourney.js';

const direction = sample => {
  expect(sample.tangent, 'a nonzero segment must supply a tangent').not.toBeNull();
  // Signed zero does not change a geometric direction; NaN still fails below.
  return { x: sample.tangent.x + 0, y: sample.tangent.y + 0 };
};

test.each(['disappear', 'collect'])('loaded %s groups stay absent before a subnormal onset', lifecycleMode => {
  const data = JSON.parse(JSON.stringify({ coordVersion: 9, waypoints: [], styles: {},
    animationState: { baseDuration: 1, duration: 1 }, scene: { flowLayers: [{ id: 'tiny', guideType: 'graph',
      graph: { nodes: [{ id: 'a', x: 0.5, y: 0.5, type: 'entry' },
        { id: 'b', x: 0.5, y: 0.5, type: 'exit' }],
      edges: [{ id: 'ab', sourceId: 'a', targetId: 'b', direction: 'one-way' }] },
      emitters: [{ id: 'e', seed: 7, dotCount: 2, groups: true, groupSize: 2, groupWidth: 0,
        releaseStart: Number.MIN_VALUE, releaseDuration: 0, onsetVariance: 0, speed: 1,
        speedVariance: 0, wobble: 0, lifecycleMode }],
    }] } }));
  const layer = stageProjectModel(data).scene.getFlowLayers()[0], engine = new SwarmEngine();
  const context = { durationMs: 1, finishReleaseContext: new FinishReleaseClock().resolve({ baseDuration: 1 }) };
  expect(layer.emitters[0].releaseStart).toBe(Number.MIN_VALUE);
  const schedule = engine.scheduleDots(layer, context);
  expect(schedule).toHaveLength(2);
  schedule.forEach(row => { expect(row.onsetMs).toBe(Number.MIN_VALUE); expect(row.journeyMs).toBe(0); });
  // A negative millisecond difference can lose its sign when expressed in seconds.
  expect(Object.is((0 - Number.MIN_VALUE) / 1000, -0)).toBe(true);
  expect(engine.evaluate(0, layer, context)).toEqual([]);
  const atOnset = engine.evaluate(Number.MIN_VALUE, layer, context);
  expect(atOnset).toHaveLength(lifecycleMode === 'collect' ? 2 : 0);
  expect(atOnset.every(dot => Number.isFinite(dot.x) && Number.isFinite(dot.y))).toBe(true);
  expect(engine.canRelease(layer, context)).toBe(lifecycleMode === 'collect');
});

test.each([0, 1, 3])('reverse travel departs an internal corner past %s zero segments', duplicates => {
  const graph = new GraphModel();
  graph.addNode({ id: 'a', x: 0, y: 0, type: 'exit' });
  graph.addNode({ id: 'b', x: 1, y: 1, type: 'entry' });
  graph.addEdge({ id: 'ab', sourceId: 'a', targetId: 'b', direction: 'two-way' });
  const points = [{ x: 0, y: 0 }, ...Array.from({ length: duplicates + 1 }, () => ({ x: 1, y: 0 })),
    { x: 1, y: 1 }];
  const arc = createGroupArc(points, points[0], points.at(-1)), routing = buildGroupRouting(graph);
  const journey = traceGroupJourney(routing, graph.getNode('b'),
    (pool, from) => chooseGroupDeparture(pool, from, 0), () => arc);
  expect(journey.codes).toEqual(new Uint16Array([1]));
  expect(arc.sample(1).point).toEqual({ x: 1, y: 0 });
  expect(arc.sample(1).tangent).toMatchObject({ x: 0, y: 1 });
  expect(sampleGroupJourney(journey, 1).point).toEqual({ x: 1, y: 0 });
  expect(direction(sampleGroupJourney(journey, 1))).toEqual({ x: -1, y: 0 });
  expect(direction(sampleGroupJourney(journey, 1 - 1e-12))).toEqual({ x: 0, y: -1 });
  expect(direction(sampleGroupJourney(journey, 1 + 1e-12))).toEqual({ x: -1, y: 0 });
  expect(direction(sampleGroupJourney(journey, 0))).toEqual({ x: 0, y: -1 });
  expect(direction(sampleGroupJourney(journey, 2))).toEqual({ x: -1, y: 0 });
});

test('a reversed curved group applies each member’s sway along the next segment at an exact vertex', () => {
  const layer = new FlowLayer({ id: 'reverse', guideType: 'graph', graph: {
    nodes: [{ id: 'a', x: 0.2, y: 0.5, type: 'exit' }, { id: 'b', x: 0.8, y: 0.5, type: 'entry' }],
    edges: [{ id: 'ab', sourceId: 'a', targetId: 'b', direction: 'two-way',
      controlPoints: [{ x: 0.3, y: 0.1 }, { x: 0.6, y: 0.7 }] }],
  }, emitters: [{ id: 'e', seed: 7, dotCount: 2, groups: true, groupSize: 2, groupWidth: 0,
    releaseStart: 0, releaseDuration: 0, onsetVariance: 0, speed: 1, speedVariance: 0,
    wobble: 0.6, lifecycleMode: 'collect' }] });
  const edge = layer.graph.getEdge('ab'), a = layer.graph.getNode('a').position();
  const b = layer.graph.getNode('b').position();
  const points = new PathCalculator().calculatePath([a, ...edge.controlPoints, b]).map(p => ({ x: p.x, y: p.y }));
  points[0] = a; points[points.length - 1] = b;
  const prefix = [0];
  for (let i = 1; i < points.length; i++) {
    prefix.push(prefix[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const length = prefix.at(-1);
  let sample;
  for (let i = 1; i < points.length - 1; i++) {
    const time = (length - prefix[i]) * 1000, distance = time / 1000;
    const dx = points[i - 1].x - points[i].x, dy = points[i - 1].y - points[i].y;
    const nx = points[i].x - points[i + 1].x, ny = points[i].y - points[i + 1].y;
    const before = Math.hypot(dx, dy), after = Math.hypot(nx, ny);
    if (length - distance === prefix[i] && before > 0 && after > 0
        && Math.abs(dx / before * ny / after - dy / before * nx / after) > 0.01) {
      sample = { point: points[i], time, distance, x: dx / before, y: dy / before }; break;
    }
  }
  expect(sample, 'the fixture must hit a non-collinear internal vertex exactly').toBeDefined();
  const dots = new SwarmEngine().evaluate(sample.time, layer,
    { durationMs: 10000, finishReleaseContext: { durationMs: 10000 } });
  expect(dots).toHaveLength(2);
  dots.forEach((dot, i) => {
    const frequency = 4 + SwarmEngine.hash(7, i, -4) * 8;
    const offset = Math.sin(2 * Math.PI * (sample.distance * frequency + SwarmEngine.hash(7, i, -3))) * 0.6 * 0.02;
    expect(dot.x).toBeCloseTo(sample.point.x - sample.y * offset, 12);
    expect(dot.y).toBeCloseTo(sample.point.y + sample.x * offset, 12);
  });
});
