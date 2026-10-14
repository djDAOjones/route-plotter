/** CROWD-08 B: start areas precede the unchanged network walk. */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { IMAGE_COORDINATES } from '../src/config/constants.js';

const NAMESPACE = 0xA83E92D7;
const area = (extra = {}) => ({ shape: 'rectangle', width: 0.4, height: 0.2, turn: 0, ...extra });
const context = { durationMs: 10000, imageAspect: 2 };
const layerWith = ({ spec = area(), emitter = {}, nodes = null, edges = null } = {}) => new FlowLayer({
  id: 'crowd', guideType: 'graph', graph: {
    nodes: nodes || [{ id: 'in', x: 0.2, y: 0.5, type: 'entry', area: spec },
      { id: 'out', x: 0.8, y: 0.5, type: 'exit' }],
    edges: edges || [{ id: 'path', sourceId: 'in', targetId: 'out', direction: 'one-way' }],
  }, emitters: [{ id: 'people', seed: 7, dotCount: 1, speed: 0.2, speedVariance: 0, wobble: 0,
    releaseStart: 0, releaseDuration: 0, onsetVariance: 0, lifecycleMode: 'disappear', ...emitter }],
});

// Independent sampler: existing tested hash, then explicit image-plane maths.
function startFor(spec, seed = 7, index = 0, aspect = 2, center = { x: 0.2, y: 0.5 }) {
  const first = SwarmEngine.hash((seed ^ NAMESPACE) >>> 0, index, 0);
  const second = SwarmEngine.hash((seed ^ NAMESPACE) >>> 0, index, 1);
  const theta = second * Math.PI * 2;
  const u = spec.shape === 'ellipse' ? Math.sqrt(first) * Math.cos(theta) / 2 : first - 0.5;
  const v = spec.shape === 'ellipse' ? Math.sqrt(first) * Math.sin(theta) / 2 : second - 0.5;
  const turn = spec.turn * Math.PI / 180;
  return { x: center.x + u * spec.width * Math.cos(turn) - v * spec.height * Math.sin(turn) / aspect,
    y: center.y + u * spec.width * Math.sin(turn) * aspect + v * spec.height * Math.cos(turn) };
}
const near = (point, expected) => {
  expect(point).toBeDefined();
  expect(point.x).toBeCloseTo(expected.x, 12);
  expect(point.y).toBeCloseTo(expected.y, 12);
};
function adjacent(value, direction) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + BigInt(direction));
  return view.getFloat64(0);
}
const withoutArea = layer => {
  const json = layer.toJSON();
  json.graph.nodes.forEach(node => delete node.area);
  return FlowLayer.fromJSON(json);
};
afterEach(() => vi.restoreAllMocks());

describe('the seeded straight approach', () => {
  test.each(['rectangle', 'ellipse'])('%s: initial point, pace, schedule and terminal state', shape => {
    const spec = area({ shape, turn: 37 });
    const layer = layerWith({ spec });
    const engine = new SwarmEngine();
    const start = startFor(spec);
    const length = Math.hypot(start.x - 0.2, start.y - 0.5);
    near(engine.evaluate(0, layer, context)[0], start);
    near(engine.evaluate(length / 0.2 * 500, layer, context)[0], {
      x: (start.x + 0.2) / 2, y: (start.y + 0.5) / 2,
    });
    const [schedule] = engine.scheduleDots(layer, context);
    expect(schedule.journeyMs).toBeCloseTo((length + (0.8 - 0.2)) / 0.2 * 1000, 8);
    const end = engine.crowdFinishMs(layer, context);
    expect(end).toBe(schedule.journeyMs);
    expect(engine.canRelease(layer, context)).toBe(true);
    expect(engine.evaluate(end, layer, context)).toEqual([]);
    expect(engine.evaluate(end - 1e-8, layer, context)).toHaveLength(1);
    layer.emitters[0].lifecycleMode = 'collect';
    near(engine.evaluate(end, layer, context)[0], { x: 0.8, y: 0.5 });
    near(engine.evaluate(end + 10000, layer, context)[0], { x: 0.8, y: 0.5 });
  });

  test('walking variation is absent on approach and starts after the exact Entry boundary', () => {
    const layer = layerWith({ emitter: { wobble: 1 } });
    const engine = new SwarmEngine();
    const start = startFor(area());
    const length = Math.hypot(start.x - 0.2, start.y - 0.5);
    const boundary = length / 0.2 * 1000;
    near(engine.evaluate(boundary / 2, layer, context)[0], {
      x: (start.x + 0.2) / 2, y: (start.y + 0.5) / 2,
    });
    near(engine.evaluate(boundary, layer, context)[0], { x: 0.2, y: 0.5 });
    near(engine.evaluate(adjacent(boundary, -1), layer, context)[0], { x: 0.2, y: 0.5 });
    const phase = SwarmEngine.hash(7, 0, -3) * 2 * Math.PI;
    const offset = Math.sin(phase) * 0.02;
    expect(Math.abs(offset)).toBeGreaterThan(0.001);
    near(engine.evaluate(adjacent(boundary, 1), layer, context)[0], { x: 0.2, y: 0.5 + offset });
    near(engine.evaluate(boundary + 500, layer, context)[0],
      engine.evaluate(500, withoutArea(layer), context)[0]);
  });

  test('each dot keeps its old onset, pace, Entry and junction choices', () => {
    const layer = layerWith({ emitter: { dotCount: 12, speedVariance: 0.8, releaseDuration: 0.4 }, nodes: [
      { id: 'in', x: 0.2, y: 0.5, type: 'entry', area: area() },
      { id: 'other', x: 0.2, y: 0.2, type: 'entry', area: area({ shape: 'ellipse' }) },
      { id: 'out', x: 0.8, y: 0.5, type: 'exit' },
      { id: 'end', x: 0.8, y: 0.8, type: 'exit' },
    ], edges: [
      { id: 'a', sourceId: 'in', targetId: 'out', direction: 'one-way' },
      { id: 'b', sourceId: 'in', targetId: 'end', direction: 'one-way', weight: 2 },
      { id: 'c', sourceId: 'other', targetId: 'out', direction: 'one-way' },
      { id: 'd', sourceId: 'other', targetId: 'end', direction: 'one-way', weight: 3 },
    ] });
    const old = withoutArea(layer), engine = new SwarmEngine();
    const schedules = engine.scheduleDots(layer, context), legacy = engine.scheduleDots(old, context);
    for (let i = 0; i < 12; i++) {
      const entry = layer.graph.getNode(SwarmEngine.hash(7, i, 0) < 0.5 ? 'in' : 'other');
      const start = startFor(entry.area, 7, i, 2, entry.position());
      const pace = Math.max(0.05, 1 + 0.8 * (2 * SwarmEngine.hash(7, i, -2) - 1));
      const approach = Math.hypot(start.x - entry.x, start.y - entry.y) / (0.2 * pace) * 1000;
      expect(schedules[i].onsetFraction).toBe(legacy[i].onsetFraction);
      expect(schedules[i].journeyMs - legacy[i].journeyMs).toBeCloseTo(approach, 8);
      const onset = schedules[i].onsetFraction * context.durationMs;
      near(engine.evaluate(onset, layer, context).find(dot => dot.dotIndex === i), start);
      near(engine.evaluate(onset + approach + 100, layer, context).find(dot => dot.dotIndex === i),
        engine.evaluate(onset + 100, old, context).find(dot => dot.dotIndex === i));
    }
  });

  test.each(['respawn', 'loop'])('%s ignores stored areas exactly; switching back restores them', mode => {
    const layer = layerWith({ emitter: { lifecycleMode: mode, wobble: 0.7 } });
    const engine = new SwarmEngine(), old = withoutArea(layer);
    for (const time of [0, 50, 1000, 3100, 10000, 50000]) {
      expect(engine.evaluate(time, layer, context)).toEqual(engine.evaluate(time, old, context));
    }
    expect(engine.scheduleDots(layer, context)).toEqual(engine.scheduleDots(old, context));
    expect(engine.crowdFinishMs(layer, context)).toBe(0);
    layer.emitters[0].lifecycleMode = 'collect';
    near(engine.evaluate(0, layer, context)[0], startFor(area()));
  });

  test('mixed emitters decide independently, and Follow route ignores all areas', () => {
    const layer = layerWith();
    layer.addEmitter({ ...layer.emitters[0].toJSON(), id: 'repeat', lifecycleMode: 'loop' });
    const engine = new SwarmEngine();
    const dots = engine.evaluate(0, layer, context);
    near(dots[0], startFor(area()));
    near(dots[1], { x: 0.2, y: 0.5 });
    layer.guideType = 'route';
    const ctx = { ...context, routePathPoints: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }] };
    expect(engine.evaluate(0, layer, ctx)).toEqual(engine.evaluate(0, withoutArea(layer), ctx));
  });
});

describe('active-area boundary precedence and cache invalidation', () => {
  test.each(['rectangle', 'ellipse'])('%s: late onset and adjacent representable final instants agree', shape => {
    const layer = layerWith({ spec: area({ shape, turn: -73 }),
      emitter: { releaseStart: 0.99, speed: 1000 } });
    const engine = new SwarmEngine(), ctx = { durationMs: 300000, imageAspect: 0.5 };
    const point = startFor(layer.graph.getNode('in').area, 7, 0, 0.5);
    const approach = Math.hypot(point.x - 0.2, point.y - 0.5);
    const onset = 0.99 * 300000;
    const finish = onset + (approach + (0.8 - 0.2)) / 1000 * 1000;
    expect(engine.crowdFinishMs(layer, ctx)).toBe(finish);
    expect(engine.evaluate(adjacent(onset, -1), layer, ctx)).toEqual([]);
    near(engine.evaluate(onset, layer, ctx)[0], point);
    expect(engine.evaluate(adjacent(finish, -1), layer, ctx)).toHaveLength(1);
    expect(engine.evaluate(finish, layer, ctx)).toEqual([]);
    expect(engine.evaluate(adjacent(finish, 1), layer, ctx)).toEqual([]);
    layer.emitters[0].lifecycleMode = 'collect';
    near(engine.evaluate(finish, layer, ctx)[0], { x: 0.8, y: 0.5 });
  });

  test('a closed loop still approaches then walks without extending the end', () => {
    const layer = layerWith({ nodes: [
      { id: 'in', x: 0.2, y: 0.5, type: 'entry', area: area() },
      { id: 'a', x: 0.8, y: 0.5 }, { id: 'b', x: 0.8, y: 0.8 },
    ], edges: [
      { sourceId: 'in', targetId: 'a', direction: 'one-way' },
      { sourceId: 'a', targetId: 'b', direction: 'one-way' },
      { sourceId: 'b', targetId: 'in', direction: 'one-way' },
    ] });
    const engine = new SwarmEngine();
    near(engine.evaluate(0, layer, context)[0], startFor(area()));
    expect(engine.canRelease(layer, context)).toBe(true);
    expect(engine.crowdFinishMs(layer, context)).toBe(0);
    expect(engine.scheduleDots(layer, context)[0].ends).toBe(false);
    for (const time of [2500, 100000, 300, 0]) {
      expect(engine.evaluate(time, layer, context)).toEqual(new SwarmEngine().evaluate(time, layer, context));
    }
  });

  test('speed, release and pace edits reuse cached geometry; changing seed creates independent starts', () => {
    const layer = layerWith(), engine = new SwarmEngine();
    const first = engine.evaluate(0, layer, context);
    const walk = vi.spyOn(engine, '_journeyLength');
    layer.emitters[0].update({ speed: 0.3, releaseStart: 0.2, speedVariance: 0.7 });
    const finish = engine.crowdFinishMs(layer, context);
    engine.canRelease(layer, context);
    engine.evaluate(2500, layer, context);
    expect(walk).not.toHaveBeenCalled();
    expect(finish).toBe(new SwarmEngine().crowdFinishMs(layer, context));
    layer.emitters[0].update({ seed: 15, releaseStart: 0 });
    const changed = engine.evaluate(0, layer, context);
    expect(changed).not.toEqual(first);
    near(changed[0], startFor(area(), 15));
    expect(walk).toHaveBeenCalledOnce();
  });

  test('an area cannot activate a graph without an edge; it can precede a zero-length edge', () => {
    const layer = layerWith({ edges: [] }), engine = new SwarmEngine();
    expect(engine.canRelease(layer, context)).toBe(false);
    expect(engine.evaluate(0, layer, context)).toEqual([]);
    layer.graph.getNode('out').moveTo(0.2, 0.5);
    layer.graph.addEdge({ id: 'zero', sourceId: 'in', targetId: 'out', direction: 'one-way' });
    expect(engine.canRelease(layer, context)).toBe(true);
    const start = startFor(area()), end = engine.crowdFinishMs(layer, context);
    expect(end).toBeCloseTo(Math.hypot(start.x - 0.2, start.y - 0.5) / 0.2 * 1000, 9);
    near(engine.evaluate(0, layer, context)[0], start);
    expect(engine.evaluate(end, layer, context)).toEqual([]);
  });

  test('a clipped-zero approach and two tiny edges finish at onset: active terminal state wins', () => {
    const originalHash = SwarmEngine.hash;
    vi.spyOn(SwarmEngine, 'hash').mockImplementation((seed, index, channel) =>
      seed === ((7 ^ NAMESPACE) >>> 0) ? (channel === 0 ? 0.99 : 0.5) : originalHash(seed, index, channel));
    const layer = layerWith({ emitter: { speed: 1000, releaseStart: 0.5 }, nodes: [
      { id: 'in', x: 0.5, y: 0.5, type: 'entry', area: area() },
      { id: 'middle', x: 0.5, y: 0.5, type: 'normal' },
      { id: 'out', x: 0.5, y: 0.5, type: 'exit' },
    ], edges: [
      { id: 'first', sourceId: 'in', targetId: 'middle', direction: 'one-way' },
      { id: 'last', sourceId: 'middle', targetId: 'out', direction: 'one-way' },
    ] });
    layer.graph.getNodes().forEach((node, i) => node.applyAnchor(IMAGE_COORDINATES.MAX,
      IMAGE_COORDINATES.MAX - i * Number.EPSILON * 16));
    const engine = new SwarmEngine();
    expect(engine.edgeGeometry(layer.graph, layer.graph.getEdges()[0]).length).toBeGreaterThan(0);
    expect(engine.crowdFinishMs(layer, context)).toBe(5000);
    expect(engine.canRelease(layer, context)).toBe(false);
    expect(engine.evaluate(5000, layer, context)).toEqual([]);
    layer.emitters[0].lifecycleMode = 'collect';
    expect(engine.canRelease(layer, context)).toBe(true);
    expect(engine.evaluate(4999, layer, context)).toEqual([]);
    near(engine.evaluate(5000, layer, context)[0], layer.graph.getNode('out').position());
  });

  test('each geometry edit and image aspect invalidates warm journeys; seeks and replacements stay pure', () => {
    const layer = layerWith({ spec: area({ turn: 37 }) }), engine = new SwarmEngine();
    let ctx = { ...context };
    const read = e => ({ finish: e.crowdFinishMs(layer, ctx), admit: e.canRelease(layer, ctx),
      dots: [0, 1500, 500, 5000, 0].map(time => e.evaluate(time, layer, ctx)) });
    const node = layer.graph.getNode('in');
    for (const edit of [() => {}, () => { node.area.width = 0.7; }, () => { node.area.height = 0.8; },
      () => { node.area.turn = -70; }, () => { node.area.shape = 'ellipse'; },
      () => { ctx.imageAspect = 0.5; }, () => node.applyAnchor(-0.3, 0.7),
      () => node.clearAnchorResolution(), () => { node.type = 'normal'; }, () => { node.type = 'entry'; }]) {
      edit();
      expect(read(engine)).toEqual(read(new SwarmEngine()));
    }
    const other = layerWith({ spec: area({ width: 0.02 }) });
    for (const target of [other, layer, other, layer]) {
      expect(engine.evaluate(0, target, ctx)).toEqual(new SwarmEngine().evaluate(0, target, ctx));
      expect(engine.crowdFinishMs(target, ctx)).toBe(new SwarmEngine().crowdFinishMs(target, ctx));
    }
  });
});
