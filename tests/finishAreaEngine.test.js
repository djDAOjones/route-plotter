import { describe, expect, test } from 'vitest';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { createFinishPackingContext } from '../src/utils/finishArea.js';
import { dotsReachingJourneyEnd, lastArrivalMs } from '../src/utils/crowdArrival.js';
import { sampleCrowdArea } from '../src/utils/crowdArea.js';

const spec = { shape: 'rectangle', width: 0.2, height: 0.2, turn: 0 };
const context = { durationMs: 10000, finishPackingContext: createFinishPackingContext({
  renderReference: { width: 1000, height: 1000 } }), finishReleaseContext: { durationMs: 10000 } };
const emitter = (id, extra = {}) => ({ id, seed: 1, dotCount: 1, dotSize: 1, speed: 0.1,
  speedVariance: 0, wobble: 0, releaseStart: 0, releaseDuration: 0, onsetVariance: 0,
  lifecycleMode: 'collect', ...extra });
const crowd = (emitters = [emitter('a', { dotCount: 3 })], area = spec) => new FlowLayer({
  id: 'crowd', guideType: 'graph', graph: {
    nodes: [{ id: 'in', x: 0.2, y: 0.5, type: 'entry' }, { id: 'out', x: 0.5, y: 0.5, type: 'exit', area }],
    edges: [{ id: 'path', sourceId: 'in', targetId: 'out', direction: 'one-way' }],
  }, emitters,
});
const positions = dots => dots.map(({ x, y }) => ({ x, y }));
const adjacent = (number, direction) => {
  const v = new DataView(new ArrayBuffer(8)); v.setFloat64(0, number);
  v.setBigUint64(0, v.getBigUint64(0) + BigInt(direction)); return v.getFloat64(0);
};

describe('finish areas rank actual first arrivals across emitters', () => {
  test('R3 anchor drift and R4 base drift cannot reverse permanent places', () => {
    const layer = crowd([emitter('bound', { releaseAnchor: { waypointId: 'w', at: 'arrival' } }),
      emitter('plain', { releaseStart: 0.4 })]);
    layer.graph.getNode('in').x = 0.4; // both network journeys take 1000 ms
    const stable = { durationMs: 3000,
      routeAnchors: { arrivalMsById: { w: 1000 }, pauseMsById: { w: 1000 }, totalDurationMs: 3000 } };
    const engine = new SwarmEngine(), results = [];
    for (const [arrival, total] of [[1000, 3000], [5000, 11000]]) {
      const ctx = { ...context, durationMs: 3000, finishReleaseContext: stable,
        routeAnchors: { arrivalMsById: { w: arrival }, pauseMsById: { w: 1000 }, totalDurationMs: total } };
      results.push(engine.scheduleDots(layer, ctx));
      expect(engine.evaluate(5000, layer, ctx).map(d => d.x)).toEqual([0.5, 0.475]);
      const legacy = FlowLayer.fromJSON(layer.toJSON()); delete legacy.graph.getNode('out').area;
      const old = new SwarmEngine().scheduleDots(legacy, ctx);
      expect(old[0].onsetFraction * 3000 + old[0].journeyMs)
        .toBeCloseTo(arrival === 1000 ? 2000 : 2363.6363636363635, 9);
      expect(old[1].onsetFraction * 3000 + old[1].journeyMs).toBeCloseTo(2200, 9);
    }
    expect(results[0]).toEqual(results[1]);
    expect(results[0][0].onsetMs + results[0][0].journeyMs).toBeCloseTo(2000, 9);
    layer.graph.getNode('in').x = 0.3; // R4: journeys 2000/1000, releases 20%/40%
    layer.emitters[0].releaseAnchor = null; layer.emitters[0].releaseStart = 0.2;
    layer.emitters[1].speed = 0.2;
    stable.durationMs = 3000;
    const same = [];
    for (const durationMs of [3000, 11000]) {
      const ctx = { ...context, durationMs, finishReleaseContext: stable };
      same.push(engine.scheduleDots(layer, ctx));
      expect(engine.evaluate(7000, layer, ctx).map(d => d.x)).toEqual([0.475, 0.5]);
      const legacy = FlowLayer.fromJSON(layer.toJSON()); delete legacy.graph.getNode('out').area;
      const old = new SwarmEngine().scheduleDots(legacy, ctx);
      const arrivals = old.map(row => row.onsetFraction * durationMs + row.journeyMs);
      expect(arrivals[0] < arrivals[1]).toBe(durationMs === 11000);
    }
    expect(same[0]).toEqual(same[1]);
  });
  test('one emitter can use both clocks; an unreachable area and other lifecycles retain legacy rows', () => {
    const layer = crowd([emitter('mixed', { dotCount: 40, releaseStart: 0.4 })]);
    layer.graph.addNode({ id: 'plain', x: 0.5, y: 0.6, type: 'exit' });
    layer.graph.addEdge({ id: 'other', sourceId: 'in', targetId: 'plain', direction: 'one-way' });
    const engine = new SwarmEngine(), rows = engine.scheduleDots(layer, context);
    const active = rows.filter(r => r.onsetMs !== undefined), legacy = rows.filter(r => r.onsetMs === undefined);
    expect(active.length).toBeGreaterThan(0); expect(legacy.length).toBeGreaterThan(0);
    expect(active.every(r => r.onsetMs === 4000)).toBe(true);
    const changedBase = { ...context, durationMs: 30000 };
    const atFirstRelease = engine.evaluate(4000, layer, changedBase);
    expect(atFirstRelease).toHaveLength(active.length);
    const withoutArea = FlowLayer.fromJSON(layer.toJSON());
    delete withoutArea.graph.getNode('out').area;
    const oldRows = new SwarmEngine().scheduleDots(withoutArea, context);
    rows.forEach((row, i) => { if (row.onsetMs === undefined) expect(row).toEqual(oldRows[i]); });
    for (const mode of ['disappear', 'respawn', 'loop']) {
      layer.emitters[0].lifecycleMode = mode; withoutArea.emitters[0].lifecycleMode = mode;
      expect(engine.scheduleDots(layer, context)).toEqual(new SwarmEngine().scheduleDots(withoutArea, context));
      for (const t of [0, 4000, 9000, 20000]) {
        expect(engine.evaluate(t, layer, context)).toEqual(new SwarmEngine().evaluate(t, withoutArea, context));
      }
    }
  });
  test('resolved pause/end anchor changes rerank without a stored anchor edit; base/output changes do not', () => {
    const layer = crowd([emitter('bound', { releaseAnchor: { waypointId: 'w', at: 'pause-end' } }),
      emitter('plain', { releaseStart: 0.4 })]);
    const engine = new SwarmEngine();
    const ctx = { ...context, finishReleaseContext: { durationMs: 10000,
      routeAnchors: { arrivalMsById: { w: 2000 }, pauseMsById: { w: 1000 }, totalDurationMs: 10000 } } };
    expect(engine.evaluate(12000, layer, ctx).map(d => d.x)).toEqual([0.5, 0.475]);
    ctx.finishReleaseContext.routeAnchors.pauseMsById.w = 3000;
    expect(engine.evaluate(12000, layer, ctx).map(d => d.x)).toEqual([0.475, 0.5]);
    const rows = engine.scheduleDots(layer, ctx);
    for (const durationMs of [0, 3000, 11000, 12000]) {
      expect(engine.scheduleDots(layer, { ...ctx, durationMs })).toEqual(rows);
    }
    delete ctx.finishReleaseContext.routeAnchors.arrivalMsById.w;
    expect(engine.scheduleDots(layer, ctx)[0].onsetMs).toBe(0); // broken binding's authored fallback
    expect(engine.scheduleDots(layer, ctx)).toEqual(new SwarmEngine().scheduleDots(layer, ctx));
  });
  test('large-onset coincident Entry/Exit boundary prioritises Exit then terminal, including B approach', () => {
    const layer = crowd([emitter('a', { dotCount: 2, speed: 1000, releaseStart: 0.8 })]);
    const entry = layer.graph.getNode('in'), exit = layer.graph.getNode('out');
    entry.area = { ...spec, width: 0.01, height: 0.01 };
    exit.x = entry.x + 1e-9;
    const ctx = { ...context, imageAspect: 1, durationMs: 100000000,
      finishReleaseContext: { durationMs: 100000000 } };
    const engine = new SwarmEngine(), schedules = engine.scheduleDots(layer, ctx);
    for (let i = 0; i < 2; i++) {
      const seed = (1 ^ 0xA83E92D7) >>> 0;
      const start = sampleCrowdArea(entry.area, entry.position(), [SwarmEngine.hash(seed, i, 0),
        SwarmEngine.hash(seed, i, 1)], 1);
      const approach = Math.hypot(start.x - entry.x, start.y - entry.y);
      const entryTime = 80000000 + approach;
      const exitTime = 80000000 + (approach + (exit.x - entry.x));
      expect(entryTime).toBe(exitTime);
      const dot = engine.evaluate(exitTime, layer, ctx)[i];
      expect({ x: dot.x, y: dot.y }).toEqual(exit.position());
      const end = schedules[i].onsetMs + schedules[i].journeyMs;
      expect(engine.evaluate(end, layer, ctx)[i]).toEqual(engine.evaluate(adjacent(end, 1), layer, ctx)[i]);
    }
    expect(schedules.some(s => s.journeyMs > 0.02)).toBe(true);
  });
  test('ties use emitter order then index; terminal walk contributes to scene end', () => {
    const layer = crowd([emitter('a', { dotCount: 2 }), emitter('b')]), engine = new SwarmEngine();
    const schedules = engine.scheduleDots(layer, context);
    expect(schedules.map(s => s.onsetMs)).toEqual([0, 0, 0]);
    expect(schedules.map(s => s.journeyMs)).toEqual([2999.9999999999995, 3250, 3250]);
    expect(positions(engine.evaluate(schedules[0].journeyMs, layer, context)))
      .toEqual(Array(3).fill({ x: 0.5, y: 0.5 }));
    const midway = engine.evaluate(3125, layer, context);
    [0.5, 0.4875, 0.5125].forEach((x, i) => {
      expect(midway[i].x).toBeCloseTo(x, 14);
      expect(midway[i].y).toBe(0.5);
    });
    expect(positions(engine.evaluate(3250, layer, context))).toEqual([
      { x: 0.5, y: 0.5 }, { x: 0.475, y: 0.5 }, { x: 0.525, y: 0.5 },
    ]);
    expect(engine.crowdFinishMs(layer, context)).toBe(3250);
    expect(lastArrivalMs(schedules, 1).ms).toBe(3250);
    expect(dotsReachingJourneyEnd(schedules, 3250)).toBe(3);
    layer.emitters.reverse();
    expect(engine.evaluate(4000, layer, context).map(d => [d.emitterId, d.x])).toEqual([
      ['b', 0.5], ['a', 0.475], ['a', 0.525],
    ]);
  });
  test('ordinary approach, network and finish lengths share seconds-to-milliseconds timing', () => {
    const layer = crowd([emitter('a', { dotSize: 2, releaseStart: 0.1 }),
      emitter('b', { dotSize: 2, releaseStart: 0.1 })]);
    const entry = layer.graph.getNode('in'), exit = layer.graph.getNode('out');
    exit.x = 0.4;
    const seed = (1 ^ 0xA83E92D7) >>> 0;
    const draws = [SwarmEngine.hash(seed, 0, 0), SwarmEngine.hash(seed, 0, 1)];
    const initial = sampleCrowdArea(spec, entry.position(), draws, 1);
    const scale = 0.1 / Math.hypot(initial.x - entry.x, initial.y - entry.y);
    entry.area = { ...spec, width: spec.width * scale, height: spec.height * scale };
    const engine = new SwarmEngine(), ctx = { ...context, imageAspect: 1 };
    const schedules = engine.scheduleDots(layer, ctx);
    const arrival = schedules[0].onsetMs + schedules[0].journeyMs;
    const terminal = schedules[1].onsetMs + schedules[1].journeyMs;
    expect(arrival).toBeCloseTo(4000, 10);
    expect(terminal).toBeCloseTo(4500, 10);
    expect(engine.crowdFinishMs(layer, ctx)).toBe(terminal);
    expect(positions(engine.evaluate(arrival, layer, ctx))).toEqual([exit.position(), exit.position()]);
    expect(engine.evaluate(1003.5, layer, ctx)[1].x).not.toBe(0.35);
    expect(engine.evaluate(terminal, layer, ctx)[1].x).toBeCloseTo(0.35, 14);
    expect(engine.evaluate(adjacent(terminal, 1), layer, ctx))
      .toEqual(engine.evaluate(terminal, layer, ctx));
  });
  test('rank uses unextended Exit arrival, with shared largest size including inactive/count-zero emitters', () => {
    const layer = crowd([emitter('slow'), emitter('fast', { speed: 0.2 }),
      emitter('inactive', { lifecycleMode: 'respawn', dotSize: 2 })]);
    layer.emitters[2].dotCount = 0; // Runtime guard also tolerates empty emitters; JSON rejects them.
    const engine = new SwarmEngine();
    expect(engine.evaluate(5000, layer, context).map(d => [d.emitterId, d.x])).toEqual([
      ['slow', 0.45], ['fast', 0.5],
    ]);
    expect(engine.crowdFinishMs(layer, context)).toBeCloseTo(3500, 10);
    layer.emitters[0].releaseStart = 0.4;
    layer.emitters[1].releaseStart = 0.6;
    expect(engine.evaluate(9000, layer, context).map(d => [d.emitterId, d.x])).toEqual([
      ['slow', 0.5], ['fast', 0.45],
    ]);
  });
  test('exact capacity wraps ranks; zero capacity retains the C clock and node collection', () => {
    const layer = crowd([emitter('a', { dotCount: 12 })], { ...spec, width: 0.1, height: 0.1 });
    const engine = new SwarmEngine(), dots = positions(engine.evaluate(9000, layer, context));
    expect(dots.slice(9)).toEqual(dots.slice(0, 3));
    expect(engine.finishAreaSummary(layer, 'out', context)).toMatchObject({ capacity: 9, exact: true, arrivals: 12 });
    layer.graph.getNode('out').area = { ...spec, width: 0.01 };
    layer.emitters[0].releaseStart = 0.5;
    const differentBase = { ...context, durationMs: 30000 };
    expect(engine.scheduleDots(layer, differentBase).map(s => s.onsetMs)).toEqual(Array(12).fill(5000));
    expect(positions(engine.evaluate(8000, layer, differentBase))).toEqual(Array(12).fill({ x: 0.5, y: 0.5 }));
    expect(engine.finishAreaSummary(layer, 'out', context)).toMatchObject({ capacity: 0, exact: true });
  });
  test('drawable zero-base journeys release at zero; owning an unreachable area is insufficient', () => {
    const layer = crowd(), engine = new SwarmEngine();
    layer.graph.getNode('in').x = 0.5;
    const zero = { ...context, durationMs: 0, finishReleaseContext: { durationMs: 0 } };
    expect(engine.canRelease(layer, zero)).toBe(true);
    expect(engine.scheduleDots(layer, zero).map(s => s.onsetMs)).toEqual([0, 0, 0]);
    expect(engine.crowdFinishMs(layer, zero)).toBeCloseTo(250, 10);
    expect(positions(engine.evaluate(0, layer, zero))).toEqual(Array(3).fill({ x: 0.5, y: 0.5 }));
    layer.graph.getNode('out').type = 'pass-through';
    expect(engine.canRelease(layer, zero)).toBe(false);
    expect(engine.evaluate(10000, layer, zero)).toEqual([]);
    expect(engine.scheduleDots(layer, zero)).toEqual([]);
  });
  test('finite onset and terminal comparisons agree at adjacent representable instants; no sway on final leg', () => {
    const layer = crowd([emitter('a', { dotCount: 2, releaseStart: 0.1, wobble: 1 })]);
    const engine = new SwarmEngine(), schedules = engine.scheduleDots(layer, context);
    const exit = schedules[0].onsetMs + schedules[0].journeyMs;
    const end = schedules[1].onsetMs + schedules[1].journeyMs;
    expect(engine.evaluate(adjacent(1000, -1), layer, context)).toEqual([]);
    expect(positions(engine.evaluate(exit, layer, context))).toEqual(Array(2).fill({ x: 0.5, y: 0.5 }));
    expect(engine.evaluate(adjacent(exit, -1), layer, context)[1].y).not.toBe(0.5);
    expect(engine.evaluate((exit + end) / 2, layer, context)[1].y).toBe(0.5);
    expect(engine.evaluate(end, layer, context)[1].x).toBe(0.475);
    expect(engine.evaluate(adjacent(end, 1), layer, context)[1].x).toBe(0.475);
  });
  test('R5 warm/cold network curvature, ranking, actual walking, cancellation and same-id replacement', () => {
    const layer = crowd([emitter('a', { seed: 1 }),
      emitter('b', { seed: 2, speed: 0.2, releaseStart: 0.13983564961161028 })]);
    layer.graph.getNode('in').x = 0.1; layer.graph.getNode('in').y = 0.1;
    layer.graph.getNode('out').x = 0.9; layer.graph.getNode('out').y = 0.9;
    layer.graph.getNode('out').area = { ...spec, width: 0.8, height: 0.8 };
    const edge = layer.graph.getEdges()[0];
    edge.controlPoints = [[0.2, 0.2], [0.3, 0.8], [0.5, 0.5], [0.65, 0.7], [0.8, 0.2]].map(([x, y]) => ({ x, y }));
    const ctx = { ...context, durationMs: 100000, finishReleaseContext: { durationMs: 100000 } };
    const engine = new SwarmEngine();
    const read = (e, model = layer) => ({ schedules: e.scheduleDots(model, ctx), end: e.crowdFinishMs(model, ctx),
      frames: [0, 10000, 20000, 27967.5, 50000, 15000].map(t => e.evaluate(t, model, ctx)) });
    const before = read(engine);
    engine.edgeGeometry(layer.graph, edge); // also warm the isolated legacy cache
    edge.controlPoints[0].y = 0.9;
    engine.edgeGeometry(layer.graph, edge);
    const changed = read(engine);
    expect(changed).toEqual(read(new SwarmEngine()));
    expect(changed.frames[4].map(d => [d.emitterId, d.x])).toEqual([['a', 0.875], ['b', 0.9]]);
    const reopened = FlowLayer.fromJSON(layer.toJSON());
    expect(read(engine, reopened)).toEqual(changed);
    edge.controlPoints[0].y = 0.2;
    expect(read(engine)).toEqual(before);
  });
  test('all allocation inputs invalidate while warm and cold agree', () => {
    const layer = crowd([emitter('a', { dotCount: 5 }), emitter('b', { dotCount: 5, seed: 23 })]);
    const engine = new SwarmEngine();
    for (const edit of [() => {}, () => layer.emitters[0].speed = 0.15,
      () => layer.emitters[1].speedVariance = 0.8, () => layer.emitters[0].seed = 123,
      () => layer.emitters[1].releaseDuration = 0.8, () => layer.emitters[0].dotSize = 2,
      () => layer.emitters.reverse(), () => layer.graph.getNode('out').area.turn = 37,
      () => layer.emitters[0].lifecycleMode = 'respawn']) {
      edit();
      const read = e => [e.scheduleDots(layer, context), e.crowdFinishMs(layer, context),
        ...[10000, 5000, 3000, 50000, 0].map(t => e.evaluate(t, layer, context))];
      expect(read(engine)).toEqual(read(new SwarmEngine()));
    }
  });
  test('reference and pace/release edits move the appropriate places on a warm allocation', () => {
    const layer = crowd([emitter('a'), emitter('b')]), engine = new SwarmEngine();
    expect(engine.evaluate(10000, layer, context).map(d => d.x)).toEqual([0.5, 0.475]);
    const bigger = { ...context, finishPackingContext: createFinishPackingContext({
      renderReference: { width: 2000, height: 2000 } }) };
    expect(engine.evaluate(10000, layer, bigger).map(d => d.x)).toEqual([0.5, 0.4875]);
    layer.emitters[0].releaseStart = 0.2;
    expect(engine.evaluate(10000, layer, bigger).map(d => d.x)).toEqual([0.4875, 0.5]);
    layer.emitters[1].speedVariance = 0.9;
    expect(engine.scheduleDots(layer, bigger)).toEqual(new SwarmEngine().scheduleDots(layer, bigger));
    layer.emitters[1].lifecycleMode = 'respawn';
    const noArea = FlowLayer.fromJSON(layer.toJSON()); delete noArea.graph.getNode('out').area;
    for (const time of [2000, 6000, 10000]) {
      expect(engine.evaluate(time, layer, bigger).filter(d => d.emitterId === 'b'))
        .toEqual(new SwarmEngine().evaluate(time, noArea, bigger).filter(d => d.emitterId === 'b'));
    }
  });
});
