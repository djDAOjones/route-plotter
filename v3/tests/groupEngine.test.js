import { expect, test, vi } from 'vitest';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { Emitter } from '../src/models/Emitter.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { sampleCrowdArea } from '../src/utils/crowdArea.js';
import { createFinishPackingContext } from '../src/utils/finishArea.js';
import { lastArrivalMs, dotsReachingJourneyEnd } from '../src/utils/crowdArrival.js';

const ctx = { durationMs: 10000, imageAspect: 1, finishReleaseContext: { durationMs: 10000 },
  finishPackingContext: createFinishPackingContext({ renderReference: { width: 1000, height: 1000 } }) };
const spec = { shape: 'rectangle', width: 0.2, height: 0.2, turn: 0 };
const crowd = (extra = {}, area = null) => new FlowLayer({ id: 'crowd', guideType: 'graph', graph: {
  nodes: [{ id: 'in', x: 0.2, y: 0.5, type: 'entry' }, { id: 'out', x: 0.8, y: 0.5, type: 'exit', ...(area ? { area } : {}) }],
  edges: [{ id: 'edge', sourceId: 'in', targetId: 'out', direction: 'one-way' }],
}, emitters: [{ id: 'em', seed: 7, dotCount: 4, groups: true, groupSize: 4, groupWidth: 0.2,
  speed: 0.1, speedVariance: 0, releaseStart: 0, releaseDuration: 0, onsetVariance: 0,
  lifecycleMode: 'collect', wobble: 0, dotSize: 1, ...extra }] });
const pos = dots => dots.map(({ x, y }) => ({ x, y }));
const close = (p, x, y, digits = 12) => { expect(p.x).toBeCloseTo(x, digits); expect(p.y).toBeCloseTo(y, digits); };
const next = (x, dir) => {
  const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, x); b.setBigUint64(0, b.getBigUint64(0) + BigInt(dir));
  return b.getFloat64(0);
};

test('straight group owns release and pace; fixed places lag then collapse individually', () => {
  const layer = crowd(), engine = new SwarmEngine();
  engine.evaluate(0, layer, ctx).forEach((p, i) => close(p, i < 2 ? 0.2 : 0, i % 2 ? 0.6 : 0.4));
  engine.evaluate(1000, layer, ctx).forEach((p, i) => close(p, i < 2 ? 0.3 : 0.1, i % 2 ? 0.6 : 0.4));
  engine.evaluate(6500, layer, ctx).forEach((p, i) => close(p, i < 2 ? 0.8 : 0.65, i % 2 ? (i < 2 ? 0.55 : 0.6) : (i < 2 ? 0.45 : 0.4)));
  engine.evaluate(9000, layer, ctx).forEach(p => close(p, 0.8, 0.5));
  const rows = engine.scheduleDots(layer, ctx);
  rows.forEach((r, i) => { expect(r.onsetMs).toBe(0); expect(r.journeyMs).toBeCloseTo(i < 2 ? 7000 : 9000, 9); });
  expect(engine.crowdFinishMs(layer, ctx)).toBeCloseTo(9000, 9);
});

test('group count supplies slots and group k supplies pace even at width zero', () => {
  const layer = crowd({ dotCount: 9, groupSize: 4, groupWidth: 0, releaseStart: 0.1, releaseDuration: 0.6,
    speedVariance: 0.8 }), e = layer.emitters[0], engine = new SwarmEngine();
  const rows = engine.scheduleDots(layer, ctx);
  for (let i = 0; i < 9; i++) {
    const k = Math.floor(i / 4), onset = (0.1 + ((k + 0.5) / 3) * 0.6) * 10000;
    const pace = Math.max(0.05, 1 + 0.8 * (2 * SwarmEngine.hash(7, k, -2) - 1));
    expect(rows[i].onsetMs).toBe(onset); expect(rows[i].journeyMs).toBeCloseTo(6000 / pace, 9);
    const p = engine.evaluate(onset + 100, layer, ctx).find(d => d.dotIndex === i);
    close(p, 0.2 + 0.01 * pace, 0.5);
  }
});

test('each B point belongs to original i; early members wait beside Entry for the last', () => {
  const layer = crowd(), engine = new SwarmEngine(), entry = layer.graph.getNode('in'); entry.area = spec;
  const starts = Array.from({ length: 4 }, (_, i) => sampleCrowdArea(spec, entry.position(),
    [SwarmEngine.hash((7 ^ 0xA83E92D7) >>> 0, i, 0), SwarmEngine.hash((7 ^ 0xA83E92D7) >>> 0, i, 1)], 1));
  expect(pos(engine.evaluate(0, layer, ctx))).toEqual(starts);
  const staging = [{ x: 0.2, y: 0.4 }, { x: 0.2, y: 0.6 }, { x: 0, y: 0.4 }, { x: 0, y: 0.6 }];
  const lengths = starts.map((p, i) => Math.hypot(p.x - staging[i].x, p.y - staging[i].y));
  const longest = Math.max(...lengths), startTime = longest / 0.1 * 1000;
  const early = lengths.indexOf(Math.min(...lengths)), t = (lengths[early] + longest) / 2 / 0.1 * 1000;
  close(engine.evaluate(t, layer, ctx)[early], staging[early].x, staging[early].y);
  engine.evaluate(startTime, layer, ctx).forEach((p, i) => close(p, staging[i].x, staging[i].y));
  expect(engine.crowdFinishMs(layer, ctx)).toBeCloseTo(startTime + 9000, 8);
});

test('group k makes Entry and junction choices; emitters keep their own count/seed/window', () => {
  const layer = crowd({ dotCount: 17, groupSize: 3, groupWidth: 0, releaseStart: 0.1, releaseDuration: 0.5 });
  const g = layer.graph; g.getNode('in').entryWeight = 1;
  g.addNode({ id: 'second', x: 0.3, y: 0.5, type: 'entry', entryWeight: 3 });
  g.addEdge({ id: 'second-out', sourceId: 'second', targetId: 'out', direction: 'one-way' });
  layer.emitters.push(new Emitter({ ...layer.emitters[0].toJSON(), id: 'other', seed: 42, dotCount: 5,
    groupSize: 2, releaseStart: 0.5, releaseDuration: 0.2 }));
  const engine = new SwarmEngine(), rows = engine.scheduleDots(layer, ctx);
  let offset = 0;
  for (const e of layer.emitters) {
    const count = Math.ceil(e.dotCount / e.groupSize);
    for (let i = 0; i < e.dotCount; i++) {
      const k = Math.floor(i / e.groupSize), r = rows[offset + i];
      const span = Math.min(e.releaseStart + e.releaseDuration, 1) - e.releaseStart;
      const onset = (e.releaseStart + ((k + 0.5) / count) * span) * 10000;
      expect(r.onsetMs).toBe(onset);
      const p = engine.evaluate(onset, layer, ctx).find(d => d.emitterId === e.id && d.dotIndex === i);
      close(p, SwarmEngine.hash(e.seed, k, 0) < 0.25 ? 0.2 : 0.3, 0.5);
    }
    offset += e.dotCount;
  }
});

test('C ranks actual lag/collapse arrival across group and ordinary emitters', () => {
  const layer = crowd({}, spec), engine = new SwarmEngine();
  layer.emitters.push(new Emitter({ ...layer.emitters[0].toJSON(), id: 'ordinary', groups: false,
    dotCount: 1, releaseStart: 0.2, speed: 0.12 })); // 2s +5s, tie with front group: emitter order wins
  const rows = engine.scheduleDots(layer, ctx);
  expect(rows[0].onsetMs + rows[0].journeyMs).toBeCloseTo(7000, 8); // rank0 centre
  expect(rows[1].onsetMs + rows[1].journeyMs).toBeGreaterThan(7000); // rank1 seat walk
  const final = engine.evaluate(20000, layer, ctx);
  expect(new Set(final.map(d => `${d.x},${d.y}`)).size).toBe(5);
  close(final[0], 0.8, 0.5); close(final[1], 0.775, 0.5);
  close(final[4], 0.825, 0.5); // rank2 before the lagging back row
  expect(engine.crowdFinishMs(layer, ctx)).toBe(Math.max(...rows.map(r => r.onsetMs + r.journeyMs)));
});

test('all active group rows use the reference clock even without C areas, ordinary rows keep old clock', () => {
  const layer = crowd({ groupWidth: 0, releaseStart: 0.4 }), e = layer.emitters[0];
  e.releaseAnchor = { waypointId: 'w', at: 'arrival' };
  layer.emitters.push(new Emitter({ ...e.toJSON(), id: 'ordinary', groups: false, dotCount: 1, releaseAnchor: null }));
  const engine = new SwarmEngine();
  const stable = { durationMs: 5000, routeAnchors: { totalDurationMs: 5000, arrivalMsById: { w: 1000 } } };
  const a = engine.scheduleDots(layer, { ...ctx, durationMs: 20000, finishReleaseContext: stable });
  const b = engine.scheduleDots(layer, { ...ctx, durationMs: 30000, finishReleaseContext: stable });
  expect(a.slice(0, 4)).toEqual(b.slice(0, 4)); expect(a[0].onsetMs).toBe(1000);
  expect(a[4].onsetMs).toBeUndefined(); expect(a[4].onsetFraction).toBe(0.4);
  close(engine.evaluate(1500, layer, { ...ctx, durationMs: 30000, finishReleaseContext: stable })[0], 0.25, 0.5);
});

test('terminal-first boundaries agree with Disappear visibility, including next representable instants', () => {
  const layer = crowd({ lifecycleMode: 'disappear' }), engine = new SwarmEngine();
  const rows = engine.scheduleDots(layer, ctx), finish = rows[0].onsetMs + rows[0].journeyMs;
  expect(engine.evaluate(next(finish, -1), layer, ctx).some(d => d.dotIndex === 0)).toBe(true);
  expect(engine.evaluate(finish, layer, ctx).some(d => d.dotIndex === 0)).toBe(false);
  expect(engine.evaluate(next(finish, 1), layer, ctx).some(d => d.dotIndex === 0)).toBe(false);
  layer.graph.getNode('out').x = 0.2;
  layer.emitters[0].update({ groupWidth: 0, releaseStart: 0.8, speed: 1000 });
  const huge = { ...ctx, finishReleaseContext: { durationMs: 1e20 } };
  expect(engine.canRelease(layer, huge)).toBe(false);
  expect(engine.evaluate(8e19, layer, huge)).toEqual([]);
});

test('nonending plans park, never collapse or enter C, and do not extend or count as arrival', () => {
  const layer = crowd(), g = layer.graph; g.getNode('out').type = 'normal';
  g.addEdge({ id: 'back', sourceId: 'out', targetId: 'in', direction: 'one-way' });
  const engine = new SwarmEngine(), rows = engine.scheduleDots(layer, ctx);
  expect(rows).toHaveLength(4); expect(rows.every(r => !r.ends && !r.finishes)).toBe(true);
  expect(engine.crowdFinishMs(layer, ctx)).toBe(0); expect(engine.canRelease(layer, ctx)).toBe(true);
  expect(lastArrivalMs(rows, 10000)).toEqual({ ms: 0, finishingDots: 0, allFinish: false });
  expect(dotsReachingJourneyEnd(rows, Infinity)).toBe(0);
  const parked = engine.evaluate(1e10, layer, ctx);
  expect(parked).toEqual(engine.evaluate(2e10, layer, ctx));
  expect(parked.some(d => d.y !== 0.5)).toBe(true);
});

test('width zero keeps original-member walking variation while sharing pace and routing', () => {
  const layer = crowd({ groupWidth: 0, wobble: 0.6 }), engine = new SwarmEngine();
  const dots = engine.evaluate(1000, layer, ctx);
  expect(new Set(dots.map(d => d.y)).size).toBe(4);
  dots.forEach((p, i) => {
    const phase = SwarmEngine.hash(7, i, -3) * Math.PI * 2;
    const freq = 4 + SwarmEngine.hash(7, i, -4) * 8;
    close(p, 0.3, 0.5 + 0.6 * 0.02 * Math.sin(0.1 * freq * Math.PI * 2 + phase));
  });
});

test.each(['off', 'single', 'respawn', 'loop', 'waiting', 'route'])('complete legacy paths remain exact when %s', mode => {
  const layer = crowd({ dotCount: 7, speedVariance: 0.8, wobble: 0.5, releaseDuration: 0.8 }, spec);
  const e = layer.emitters[0];
  if (mode === 'off') e.groups = false;
  if (mode === 'single') e.groupSize = 1;
  if (['respawn', 'loop'].includes(mode)) e.lifecycleMode = mode;
  if (mode === 'waiting') e.waitAtStart = true;
  if (mode === 'route') layer.guideType = 'route';
  const old = FlowLayer.fromJSON(layer.toJSON()); old.emitters[0].groups = false;
  const c = { ...ctx, routePathPoints: [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.8 }] };
  const engine = new SwarmEngine(), legacy = new SwarmEngine();
  for (const t of [0, 1000, 5000, 20000, 5000, 100, 1e6]) expect(engine.evaluate(t, layer, c)).toEqual(legacy.evaluate(t, old, c));
  expect(engine.scheduleDots(layer, c)).toEqual(legacy.scheduleDots(old, c));
  expect(engine.crowdFinishMs(layer, c)).toBe(legacy.crowdFinishMs(old, c));
});

test('cold/warm/scrambled seeks and graph/seed/size/width/identity changes match a fresh engine', () => {
  const layer = crowd({}, spec), engine = new SwarmEngine();
  for (const change of [() => {}, () => layer.emitters[0].update({ seed: 9 }),
    () => layer.emitters[0].update({ groupWidth: 0.07, groupSize: 3 }),
    () => { layer.graph.getNode('in').x = 0.25; },
    () => { layer.graph.getEdge('edge').controlPoints = [{ x: 0.5, y: 0.1 }]; },
    () => { layer.emitters[0] = Emitter.fromJSON({ ...layer.emitters[0].toJSON(), seed: 11 }); }]) {
    change();
    for (const t of [0, 5000, 1000, 12000, 5000, 100]) expect(engine.evaluate(t, layer, ctx))
      .toEqual(new SwarmEngine().evaluate(t, layer, ctx));
    expect(engine.scheduleDots(layer, ctx)).toEqual(new SwarmEngine().scheduleDots(layer, ctx));
  }
});

test('active groups never warm legacy per-member journeys or scan whole edges for implicit Entry/topology', () => {
  const layer = crowd(); layer.graph.getNode('in').type = 'normal';
  const engine = new SwarmEngine();
  const walk = vi.spyOn(engine, '_cachedJourneys').mockImplementation(() => { throw new Error('legacy warming'); });
  const scan = vi.spyOn(layer.graph, 'getEdgesForNode').mockImplementation(() => { throw new Error('whole-edge scan'); });
  expect(engine.evaluate(1000, layer, ctx)).toHaveLength(4);
  expect(engine.scheduleDots(layer, ctx, { endsOnly: true })).toHaveLength(4);
  expect(engine.crowdFinishMs(layer, ctx)).toBeGreaterThan(0);
  expect(engine.canRelease(layer, ctx)).toBe(true); expect(engine.hasJourneyEnd(layer)).toBe(true);
  expect(walk).not.toHaveBeenCalled(); expect(scan).not.toHaveBeenCalled();
});

test('junction hash is group k/hop1 and all members take its branch', () => {
  const layer = crowd({ dotCount: 20, groupSize: 3, groupWidth: 0 });
  layer.graph.addNode({ id: 'other-exit', type: 'exit', x: 0.8, y: 0.3 });
  layer.graph.addEdge({ id: 'fork', sourceId: 'in', targetId: 'other-exit', direction: 'one-way' });
  const final = new SwarmEngine().evaluate(30000, layer, ctx);
  for (const dot of final) close(dot, 0.8, SwarmEngine.hash(7, Math.floor(dot.dotIndex / 3), 1) < 0.5 ? 0.5 : 0.3);
});

test.each([Number.MIN_VALUE, 1e-30, 0.012345678901234567, 0.2])('width %s stays finite through every phase with sway', width => {
  const layer = crowd({ groupWidth: width, wobble: 0.7 });
  layer.graph.getNode('in').area = spec;
  const engine = new SwarmEngine();
  for (const t of [0, 1e-10, 1000, 9000, 1000, 1e7]) for (const p of engine.evaluate(t, layer, ctx)) {
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  }
});

test.each([false, true])('actual curved spline uses a pinned true-distance oracle; reversed=%s', reversed => {
  const layer = crowd({ dotCount: 1, groupSize: 2, groupWidth: 0.2 }), g = layer.graph;
  const edge = g.getEdge('edge'); edge.direction = 'two-way';
  if (reversed) { edge.sourceId = 'out'; edge.targetId = 'in'; }
  edge.controlPoints = reversed ? [{ x: 0.6, y: 0.7 }, { x: 0.3, y: 0.1 }]
    : [{ x: 0.3, y: 0.1 }, { x: 0.6, y: 0.7 }];
  const a = g.getNode(edge.sourceId).position(), b = g.getNode(edge.targetId).position();
  const path = new PathCalculator().calculatePath([a, ...edge.controlPoints, b]).map(p => ({ x: p.x, y: p.y }));
  path[0] = a; path[path.length - 1] = b; if (reversed) path.reverse();
  const prefix = [0];
  for (let i = 1; i < path.length; i++) prefix.push(prefix[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  const length = prefix[prefix.length - 1], engine = new SwarmEngine();
  expect(length).toBeGreaterThan(0.6);
  for (const fraction of [0.13, 0.31, 0.61, 0.87]) {
    const d = length * fraction; let index = 0;
    while (prefix[index + 1] <= d) index++;
    const f = (d - prefix[index]) / (prefix[index + 1] - prefix[index]);
    const x = path[index].x + (path[index + 1].x - path[index].x) * f;
    const y = path[index].y + (path[index + 1].y - path[index].y) * f;
    close(engine.evaluate(d / 0.1 * 1000, layer, ctx)[0], x, y);
  }
  expect(engine.scheduleDots(layer, ctx)[0].journeyMs).toBeCloseTo(length / 0.1 * 1000, 8);
});

test('area/aspect, Entry and Path weights, direction, release clock, packing and inactive transitions never reuse a stale plan', () => {
  const layer = crowd({ dotCount: 11, groupSize: 3, groupWidth: 0.07, releaseDuration: 0.6 }, spec), g = layer.graph;
  g.getNode('in').area = { ...spec, turn: 17 };
  g.addNode({ id: 'second', type: 'entry', x: 0.3, y: 0.7, entryWeight: 1 });
  g.addEdge({ id: 'second-path', sourceId: 'out', targetId: 'second', direction: 'two-way', weight: 3 });
  g.addNode({ id: 'fork-exit', type: 'exit', x: 0.65, y: 0.2, area: { ...spec } });
  g.addEdge({ id: 'fork', sourceId: 'in', targetId: 'fork-exit', direction: 'one-way' });
  layer.emitters.push(new Emitter({ ...layer.emitters[0].toJSON(), id: 'ordinary', groups: false, dotCount: 3 }));
  const engine = new SwarmEngine(), c = { ...ctx, finishReleaseContext: { durationMs: 10000 } };
  for (const change of [() => {}, () => { layer.emitters[0].seed = 11; },
    () => { layer.emitters[0].groupWidth = 0.09; }, () => { layer.emitters[0].groupSize = 2; },
    () => { layer.emitters[0].dotCount = 13; }, () => { g.getNode('in').entryWeight = 4; },
    () => { g.getEdge('edge').weight = 9; }, () => { g.getEdge('second-path').direction = 'one-way'; },
    () => { g.getNode('in').area.turn = -37; }, () => { c.imageAspect = 2; },
    () => { layer.emitters[0].releaseStart = 0.2; layer.emitters[0].speedVariance = 0.6; },
    () => { layer.emitters[1].dotSize = 2; },
    () => { c.finishPackingContext = createFinishPackingContext({ renderReference: { width: 700, height: 500 } }); },
    () => { c.finishReleaseContext.durationMs = 3000; },
    () => { layer.emitters[0].lifecycleMode = 'disappear'; }, () => { layer.emitters[0].groups = false; },
    () => { layer.emitters[0].groups = true; },
    () => { const copy = layer.graph.constructor.fromJSON(layer.graph.toJSON());
      copy.getNode('in').area.turn = 83; layer.graph = copy; },
    () => { layer.emitters[0] = Emitter.fromJSON(layer.emitters[0].toJSON()); }]) {
    change(); const cold = new SwarmEngine();
    const schedules = engine.scheduleDots(layer, c); expect(schedules).toEqual(cold.scheduleDots(layer, c));
    const times = [0, 1000, 8000, 20000, ...schedules.slice(0, 4).map(row => (row.onsetMs ?? row.onsetFraction * c.durationMs) + 100)];
    for (const time of times.reverse()) expect(engine.evaluate(time, layer, c)).toEqual(cold.evaluate(time, layer, c));
    expect(engine.crowdFinishMs(layer, c)).toBe(cold.crowdFinishMs(layer, c));
  }
});

test('walking sway is suppressed in collapse and nonterminal parking, as the explicit phase-step convention states', () => {
  const layer = crowd({ wobble: 0.7 }), engine = new SwarmEngine();
  const moving = engine.evaluate(1000, layer, ctx), collapsing = engine.evaluate(6500, layer, ctx).slice(0, 2);
  layer.emitters[0].wobble = 0;
  expect(engine.evaluate(1000, layer, ctx)).not.toEqual(moving);
  expect(engine.evaluate(6500, layer, ctx).slice(0, 2)).toEqual(collapsing);
  layer.graph.getNode('out').type = 'normal';
  layer.graph.addEdge({ id: 'back', sourceId: 'out', targetId: 'in', direction: 'one-way' });
  const parked = engine.evaluate(1e10, layer, ctx);
  layer.emitters[0].wobble = 0.7; expect(engine.evaluate(1e10, layer, ctx)).toEqual(parked);
});

test('partial singleton uses its actual centred place and C counts no imaginary members', () => {
  const layer = crowd({ dotCount: 5, groupSize: 4 }, spec), engine = new SwarmEngine();
  close(engine.evaluate(0, layer, ctx).find(d => d.dotIndex === 4), 0.2, 0.5);
  close(engine.evaluate(1000, layer, ctx).find(d => d.dotIndex === 4), 0.3, 0.5);
  const rows = engine.scheduleDots(layer, ctx);
  expect(rows).toHaveLength(5); expect(rows[4].journeyMs).toBeCloseTo(6000, 9);
  close(engine.evaluate(20000, layer, ctx).find(d => d.dotIndex === 4), 0.8, 0.5);
  expect(engine.finishAreaSummary(layer, 'out', ctx).arrivals).toBe(5);
});

test('a configured size larger than count uses the real eight-member grid', () => {
  const layer = crowd({ dotCount: 8, groupSize: 5000 }), engine = new SwarmEngine();
  const wanted = [[0.2, 0.4], [0.2, 0.5], [0.2, 0.6], [0.1, 0.4], [0.1, 0.5], [0.1, 0.6], [0, 0.4], [0, 0.6]];
  engine.evaluate(0, layer, ctx).forEach((dot, i) => close(dot, ...wanted[i]));
  expect(engine.scheduleDots(layer, ctx)[1].journeyMs).toBeCloseTo(6000, 9);
});

test('uneven onset hash uses group k and groupCount, while member pace stays shared', () => {
  const layer = crowd({ dotCount: 9, groupSize: 4, groupWidth: 0, onsetVariance: 0.7,
    speedVariance: 0.8, releaseStart: 0.1, releaseDuration: 0.6 }), engine = new SwarmEngine();
  const rows = engine.scheduleDots(layer, ctx);
  for (let i = 0; i < 9; i++) {
    const k = Math.floor(i / 4), slot = (k + 0.5) / 3;
    const u = slot + (SwarmEngine.hash(7, k, -1) - slot) * 0.7;
    const onset = (0.1 + u * 0.6) * 10000;
    const pace = Math.max(0.05, 1 + 0.8 * (2 * SwarmEngine.hash(7, k, -2) - 1));
    expect(rows[i].onsetMs).toBe(onset);
    expect(rows[i].journeyMs).toBeCloseTo(6000 / pace, 9);
  }
});

test('C group placement uses the largest size from every emitter, including independent streams', () => {
  const layer = crowd({}, spec);
  layer.emitters.push(new Emitter({ ...layer.emitters[0].toJSON(), id: 'large-ordinary', groups: false,
    dotCount: 1, dotSize: 2, releaseStart: 0.2, speed: 0.12 }));
  const final = new SwarmEngine().evaluate(20000, layer, ctx);
  close(final[0], 0.8, 0.5); close(final[1], 0.75, 0.5); close(final[4], 0.85, 0.5);
});

test('C capacity overflow reuses places; zero-capacity groups finish at the node', () => {
  const layer = crowd({ groupWidth: 0 }, { shape: 'rectangle', width: 0.1, height: 0.02, turn: 0 });
  const engine = new SwarmEngine(), final = engine.evaluate(20000, layer, ctx);
  expect(engine.finishAreaSummary(layer, 'out', ctx)).toMatchObject({ capacity: 3, arrivals: 4 });
  close(final[0], 0.8, 0.5); close(final[1], 0.775, 0.5); close(final[2], 0.825, 0.5); close(final[3], 0.8, 0.5);
  layer.graph.getNode('out').area = { shape: 'ellipse', width: 0.001, height: 0.001, turn: 31 };
  expect(engine.finishAreaSummary(layer, 'out', ctx)).toMatchObject({ capacity: 0, arrivals: 4 });
  engine.evaluate(20000, layer, ctx).forEach(dot => close(dot, 0.8, 0.5));
  expect(engine.crowdFinishMs(layer, ctx)).toBeCloseTo(6000, 9);
});
