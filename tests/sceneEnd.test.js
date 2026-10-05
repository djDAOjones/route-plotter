/**
 * CROWD-05 — the scene ends when everything that concludes has concluded.
 *
 * The playback duration, F, is the latest of the base timeline, B, and every
 * end that comes after it: the last Disappear or Collect dot to finish a
 * journey that ends, and the last beacon still changing. These pin the
 * reducer (`computeSceneEnd`), the crowd finish it reads
 * (`SwarmEngine.crowdFinishMs`), the beacon ends it reads (`beaconEndMs`,
 * checked against the beacon classes themselves), the exact end a dot meets
 * at its finish, the journey cache and the topology the "At journey end"
 * hint now reads.
 */

import { describe, test, expect, vi } from 'vitest';
import { computeSceneEnd, beaconEndMs, describeSceneEnd } from '../src/utils/sceneEnd.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { Scene } from '../src/models/Scene.js';
import { dotJourneyMs } from '../src/utils/crowdArrival.js';
import {
  RippleBeacon, GlowBeacon, PopBeacon, GrowBeacon, PulseBeacon,
} from '../src/services/BeaconRenderer.js';

const B = 10000;
const ROUTE = new PathCalculator().calculatePath([{ x: 0.1, y: 0.5 }, { x: 0.5, y: 0.4 }, { x: 0.9, y: 0.5 }]);

/** A crowd that cannot finish inside B: slow, released through the window. */
const SLOW = {
  seed: 11, dotCount: 30, speed: 0.08, speedVariance: 0.3, onsetVariance: 0.4,
  releaseStart: 0.2, releaseDuration: 0.6,
};

function routeLayer(emitters) {
  const layer = new FlowLayer({ name: 'Route crowd', guideType: 'route' });
  for (const options of emitters) layer.addEmitter(options);
  return layer;
}

/** Entry → a → b → exit, bent, so a journey crosses several paths. */
function chainLayer(emitters, { zeroLengthEnd = false } = {}) {
  const layer = new FlowLayer({ name: 'Network crowd', guideType: 'graph' });
  const { graph } = layer;
  const entry = graph.addNode({ x: 0.1, y: 0.2, type: 'entry' });
  const a = graph.addNode({ x: 0.35, y: 0.6 });
  const b = graph.addNode({ x: 0.6, y: 0.3 });
  const exit = graph.addNode({ x: 0.9, y: 0.7, type: zeroLengthEnd ? 'normal' : 'exit' });
  graph.addEdge({ sourceId: entry.id, targetId: a.id, direction: 'one-way', controlPoints: [{ x: 0.2, y: 0.5 }] });
  graph.addEdge({ sourceId: a.id, targetId: b.id, direction: 'one-way' });
  graph.addEdge({ sourceId: b.id, targetId: exit.id, direction: 'one-way', controlPoints: [{ x: 0.8, y: 0.3 }] });
  // A fork at a, so dots differ in their walks.
  const side = graph.addNode({ x: 0.4, y: 0.95, type: 'exit' });
  graph.addEdge({ sourceId: a.id, targetId: side.id, direction: 'one-way', weight: 0.5 });
  let end = exit;
  if (zeroLengthEnd) {
    // The journey's last path has no length: its exit sits on the node before it.
    end = graph.addNode({ x: 0.9, y: 0.7, type: 'exit' });
    graph.addEdge({ sourceId: exit.id, targetId: end.id, direction: 'one-way' });
  }
  for (const options of emitters) layer.addEmitter(options);
  return { layer, end, side };
}

/** The scene's end over `layers`, with the route as their guide. */
const sceneEndOver = (layers, engine, baseMs = B) =>
  computeSceneEnd({ baseMs, layers, swarmEngine: engine, swarmContext: { routePathPoints: ROUTE } });

/** The latest finish of every dot that ends, read off `scheduleDots` independently. */
function latestEndingFinish(engine, layer, context) {
  let latest = 0;
  for (const dot of engine.scheduleDots(layer, context)) {
    if (!dot.finishes || !dot.ends) continue;
    latest = Math.max(latest, dot.onsetFraction * context.durationMs + dot.journeyMs);
  }
  return latest;
}

describe('computeSceneEnd', () => {
  test('a route alone: the end is the base timeline and the readout says nothing more', () => {
    const end = computeSceneEnd({ baseMs: 12000 });

    expect(end).toEqual({ endMs: 12000, parts: { routeMs: 12000, crowdsMs: 0, beaconsMs: 0 } });
    expect(describeSceneEnd(end.parts, end.endMs)).toBe('');
  });

  test.each(['disappear', 'collect'])('a %s crowd on a route sets the end by its last finishing dot', mode => {
    const engine = new SwarmEngine();
    const layer = routeLayer([{ ...SLOW, lifecycleMode: mode }]);
    const context = { durationMs: B, routePathPoints: ROUTE };
    const expected = latestEndingFinish(engine, layer, context);

    const end = sceneEndOver([layer], engine);

    expect(expected).toBeGreaterThan(B);
    expect(end.parts.crowdsMs).toBe(expected);
    expect(end.endMs).toBe(expected);
  });

  test.each(['disappear', 'collect'])('a %s crowd on a network sets the end by its last finishing dot', mode => {
    const engine = new SwarmEngine();
    const { layer } = chainLayer([{ ...SLOW, lifecycleMode: mode }]);
    const expected = latestEndingFinish(engine, layer, { durationMs: B });

    const end = computeSceneEnd({ baseMs: B, layers: [layer], swarmEngine: engine });

    expect(expected).toBeGreaterThan(B);
    expect(end.parts.crowdsMs).toBe(expected);
    expect(end.endMs).toBe(expected);
  });

  test.each(['respawn', 'loop'])('a %s crowd never concludes, so it never lengthens the timeline', mode => {
    const engine = new SwarmEngine();
    const walk = vi.spyOn(engine, '_journeyLength');
    const layers = [
      routeLayer([{ ...SLOW, lifecycleMode: mode }]),
      chainLayer([{ ...SLOW, lifecycleMode: mode }]).layer,
    ];

    const end = sceneEndOver(layers, engine);

    expect(end).toEqual({ endMs: B, parts: { routeMs: B, crowdsMs: 0, beaconsMs: 0 } });
    expect(walk).not.toHaveBeenCalled(); // skipped before any walk
  });

  test('ending and looping streams in one crowd, and in one scene: only the ending ones count', () => {
    const engine = new SwarmEngine();
    const ending = { ...SLOW, lifecycleMode: 'disappear' };
    const looping = { ...SLOW, seed: 99, speed: 0.01, lifecycleMode: 'respawn' };
    const { layer: mixed } = chainLayer([looping, ending]);
    const { layer: endingOnly } = chainLayer([ending]);
    const repeating = routeLayer([{ ...looping, lifecycleMode: 'loop' }]);
    const expected = latestEndingFinish(engine, endingOnly, { durationMs: B });

    const oneCrowd = computeSceneEnd({ baseMs: B, layers: [mixed], swarmEngine: engine });
    const scene = sceneEndOver([repeating, mixed], engine);

    expect(oneCrowd.parts.crowdsMs).toBe(expected);
    expect(scene.parts.crowdsMs).toBe(expected);
    // The looping stream alone, at 0.01 img/s, would have run far past it.
    const loopingAlone = chainLayer([{ ...looping, lifecycleMode: 'disappear' }]).layer;
    expect(latestEndingFinish(engine, loopingAlone, { durationMs: B })).toBeGreaterThan(expected);
  });

  test('a crowd with no dot stream, or no network to walk, adds nothing', () => {
    const engine = new SwarmEngine();
    const empty = new FlowLayer({ guideType: 'route' });
    const unwalkable = new FlowLayer({ guideType: 'graph' });
    unwalkable.addEmitter({ ...SLOW, lifecycleMode: 'disappear' });
    const routeless = routeLayer([{ ...SLOW, lifecycleMode: 'disappear' }]);

    const end = computeSceneEnd({ baseMs: B, layers: [empty, unwalkable, routeless], swarmEngine: engine });

    expect(end.endMs).toBe(B);
    expect(end.parts.crowdsMs).toBe(0);
  });

  test('a hidden crowd is not drawn, so the end does not wait for it', () => {
    const engine = new SwarmEngine();
    const layer = routeLayer([{ ...SLOW, lifecycleMode: 'disappear' }]);
    layer.visible = false;

    expect(sceneEndOver([layer], engine).endMs).toBe(B);
  });

  test('a dot released at 100% of the timeline finishes its whole journey after it', () => {
    const engine = new SwarmEngine();
    const layer = routeLayer([{ seed: 3, dotCount: 1, speed: 0.5, speedVariance: 0, onsetVariance: 0,
      releaseStart: 1, releaseDuration: 0, lifecycleMode: 'disappear' }]);
    const length = new PathCalculator().calculatePathLength(ROUTE);

    const end = sceneEndOver([layer], engine);

    expect(end.endMs).toBe(1 * B + dotJourneyMs(length, 0.5, 1));
  });

  test('a walk that runs out of hops before its end is not waited for', () => {
    // A chain of more paths than a walk takes: its Exit is on the dot's way,
    // so nothing prunes the walk, and it stops short. Disappear leaves that
    // dot parked where its hops ran out, for ever.
    const layer = new FlowLayer({ guideType: 'graph' });
    let previous = layer.graph.addNode({ x: 0, y: 0, type: 'entry' });
    for (let index = 1; index <= 2100; index++) {
      const node = layer.graph.addNode({ x: index / 2100, y: 0, type: index === 2100 ? 'exit' : 'normal' });
      layer.graph.addEdge({ sourceId: previous.id, targetId: node.id, direction: 'one-way' });
      previous = node;
    }
    layer.addEmitter({ seed: 1, dotCount: 2, speed: 0.01, lifecycleMode: 'disappear', releaseDuration: 0 });
    const engine = new SwarmEngine();

    const schedules = engine.scheduleDots(layer, { durationMs: B });
    expect(schedules.every(dot => !dot.ends)).toBe(true);
    // Counted, the distance walked would have run far past B.
    expect(schedules.every(dot => dot.journeyMs > B)).toBe(true);
    expect(computeSceneEnd({ baseMs: B, layers: [layer], swarmEngine: engine }).endMs).toBe(B);
  });

  test('nothing is measured against a base of nothing', () => {
    const engine = new SwarmEngine();
    const layer = routeLayer([{ ...SLOW, lifecycleMode: 'disappear' }]);

    expect(sceneEndOver([layer], engine, 0)).toEqual({ endMs: 0, parts: { routeMs: 0, crowdsMs: 0, beaconsMs: 0 } });
  });
});

describe('beaconEndMs, read against the beacon classes', () => {
  const ARRIVAL = 8000;
  const schedule = (style, { holdMs = 0, earlyMs = 0 } = {}) => ({
    waypointId: 'last', style, arrivalMs: ARRIVAL, holdEndMs: ARRIVAL + holdMs,
    earlyOnsetMs: earlyMs, earlyOnsetStartMs: ARRIVAL - earlyMs,
  });
  const waypoint = extra => [{ id: 'last', isMajor: true, ...extra }];
  const BEACONS = { ripple: RippleBeacon, glow: GlowBeacon, pop: PopBeacon, grow: GrowBeacon, pulse: PulseBeacon };
  /** What the beacon draws at a local instant: its scale, opacity and rings. */
  const look = (style, localSec, win, options) => {
    const beacon = new BEACONS[style]();
    beacon.sync(localSec, win, options);
    return JSON.stringify({ scale: beacon.scale, opacity: beacon.opacity, radius: beacon.radius,
      rings: beacon.rings?.map(ring => ring.opacity) });
  };

  test.each([
    ['glow', {}, 'always-show', 3000],
    ['ripple', { rippleMaxScale: 1500 }, 'always-show', 6000],
    ['pop', {}, 'always-show', 1000],
    ['pop', {}, 'hide-after', 1500],
    ['pop', {}, 'hide-before-and-after', 1250],
    ['pulse', { pulseCycleSpeed: 4 }, 'always-show', 8000],
    ['pulse', { pulseCycleSpeed: 4 }, 'hide-after', 9000],
    ['grow', {}, 'always-show', 2000],
  ])('a %s beacon (%o, %s) at the last waypoint ends %i ms after arrival, when it stops changing',
    (style, settings, visibility, afterArrivalMs) => {
      const holdMs = style === 'pulse' ? 4500 : 0;
      const earlyMs = style === 'grow' ? 2000 : (visibility.startsWith('hide-before') ? 250 : 0);
      const sched = schedule(style, { holdMs, earlyMs });
      const endMs = beaconEndMs([sched], waypoint({ beaconStyle: style, ...settings }),
        { waypointVisibility: visibility });

      expect(endMs).toBe(ARRIVAL + afterArrivalMs);

      // The beacon itself: still changing just before, settled from then on.
      const hidesBefore = visibility.startsWith('hide-before');
      const options = {
        hidesBefore, hidesAfter: visibility.endsWith('after'),
        rippleMaxScale: settings.rippleMaxScale, pulseCycleSpeed: settings.pulseCycleSpeed,
      };
      const early = style === 'grow' || ((style === 'pop' || style === 'pulse') && hidesBefore);
      const clockStart = early ? sched.earlyOnsetStartMs : sched.arrivalMs;
      const win = { arrivalSec: (ARRIVAL - clockStart) / 1000, holdEndSec: (sched.holdEndMs - clockStart) / 1000 };
      const localEnd = (endMs - clockStart) / 1000;
      expect(look(style, localEnd - 0.05, win, options)).not.toBe(look(style, localEnd, win, options));
      expect(look(style, localEnd + 1, win, options)).toBe(look(style, localEnd, win, options));
    });

  test('every major waypoint counts; a minor, one with no beacon and waypoints hidden throughout do not', () => {
    const schedules = [
      { ...schedule('glow'), waypointId: 'early', arrivalMs: 9000, holdEndMs: 9000 },
      { ...schedule('glow'), waypointId: 'minor', arrivalMs: 20000, holdEndMs: 20000 },
      { ...schedule('none'), waypointId: 'plain', arrivalMs: 30000, holdEndMs: 30000 },
    ];
    const waypoints = [
      { id: 'early', isMajor: true }, { id: 'minor', isMajor: false }, { id: 'plain', isMajor: true },
    ];

    expect(beaconEndMs(schedules, waypoints)).toBe(12000);
    expect(beaconEndMs(schedules, waypoints, { offsetMs: 500 })).toBe(12500);
    expect(beaconEndMs(schedules, waypoints, { waypointVisibility: 'always-hide' })).toBe(0);
  });

  test('the scene waits for a beacon that outlasts the route', () => {
    const end = computeSceneEnd({
      baseMs: ARRIVAL, beaconSchedules: [schedule('glow')], waypoints: waypoint({ beaconStyle: 'glow' }),
    });

    expect(end).toEqual({ endMs: ARRIVAL + 3000, parts: { routeMs: ARRIVAL, crowdsMs: 0, beaconsMs: ARRIVAL + 3000 } });
    expect(describeSceneEnd(end.parts, end.endMs)).toBe('Ends at 11.0 s — route 8.0 s, beacon ends +3.0 s');
  });
});

describe('describeSceneEnd', () => {
  test('names each part past the route, with its own lead', () => {
    expect(describeSceneEnd({ routeMs: 12000, crowdsMs: 16500, beaconsMs: 12800 }, 16500))
      .toBe('Ends at 16.5 s — route 12.0 s, crowds finish +4.5 s, beacon ends +0.8 s');
    expect(describeSceneEnd({ routeMs: 12000, crowdsMs: 16500, beaconsMs: 9000 }, 16500))
      .toBe('Ends at 16.5 s — route 12.0 s, crowds finish +4.5 s');
    expect(describeSceneEnd({ routeMs: 12000, crowdsMs: 11000, beaconsMs: 0 }, 12000)).toBe('');
    expect(describeSceneEnd(null, 12000)).toBe('');
  });
});

describe('a journey that ends is over at its finish (exact end)', () => {
  /** Every ending dot's index and finish, as the scene end measures it. */
  function finishes(engine, layer, context) {
    const out = [];
    engine.scheduleDots(layer, context).forEach((dot, index) => {
      if (!dot.finishes || !dot.ends) return;
      out.push({ index, finishMs: dot.onsetFraction * context.durationMs + dot.journeyMs });
    });
    return out;
  }
  const drawn = (engine, layer, ms, context, index) =>
    engine.evaluate(ms, layer, context).find(dot => dot.dotIndex === index);

  test.each([
    ['a route', () => routeLayer([{ ...SLOW, dotCount: 100, wobble: 0.6, lifecycleMode: 'disappear' }])],
    ['a network of several paths',
      () => chainLayer([{ ...SLOW, dotCount: 100, wobble: 0.6, lifecycleMode: 'disappear' }]).layer],
    ['a network ending on a path of no length', () => chainLayer(
      [{ ...SLOW, dotCount: 100, wobble: 0.6, lifecycleMode: 'disappear' }], { zeroLengthEnd: true }).layer],
  ])('Disappear on %s: drawn just before its finish, gone at it and after', (name, make) => {
    const engine = new SwarmEngine();
    const layer = make();
    const context = { durationMs: B, routePathPoints: ROUTE };
    const ending = finishes(engine, layer, context);
    expect(ending).toHaveLength(100);

    for (const { index, finishMs } of ending) {
      expect(drawn(engine, layer, finishMs - 1, context, index), `${name}: dot ${index} before`).toBeDefined();
      expect(drawn(engine, layer, finishMs, context, index), `${name}: dot ${index} at its finish`).toBeUndefined();
      expect(drawn(engine, layer, finishMs + 1e-6, context, index), `${name}: dot ${index} after`).toBeUndefined();
    }
  });

  test.each([
    ['a network of several paths', {}],
    ['a network ending on a path of no length', { zeroLengthEnd: true }],
  ])('Collect on %s: parked on its terminal node at its finish and after, never between', (name, options) => {
    const engine = new SwarmEngine();
    const { layer, end, side } = chainLayer(
      [{ ...SLOW, dotCount: 100, wobble: 0.6, lifecycleMode: 'collect' }], options);
    const context = { durationMs: B };
    const terminals = [end.position(), side.position()].map(({ x, y }) => `${x},${y}`);

    for (const { index, finishMs } of finishes(engine, layer, context)) {
      for (const ms of [finishMs, finishMs + 1e-6, finishMs + 5000]) {
        const dot = drawn(engine, layer, ms, context, index);
        expect(terminals, `${name}: dot ${index} at ${ms}`).toContain(`${dot.x},${dot.y}`);
      }
      const before = drawn(engine, layer, finishMs - 50, context, index);
      expect(terminals, `${name}: dot ${index} still walking`).not.toContain(`${before.x},${before.y}`);
    }
  });

  test('a journey of no length ends at its release: the dot is never drawn and waits for nothing', () => {
    // An Entry no path leaves is a dead end: the journey ends where it starts.
    const layer = new FlowLayer({ guideType: 'graph' });
    const entry = layer.graph.addNode({ x: 0.2, y: 0.2, type: 'entry' });
    const into = layer.graph.addNode({ x: 0.6, y: 0.6 });
    layer.graph.addEdge({ sourceId: into.id, targetId: entry.id, direction: 'one-way' });
    layer.addEmitter({ seed: 4, dotCount: 5, releaseStart: 0.5, releaseDuration: 0.5, lifecycleMode: 'disappear' });
    const engine = new SwarmEngine();
    const context = { durationMs: B };

    const schedules = engine.scheduleDots(layer, context);
    expect(schedules.every(dot => dot.ends && dot.journeyMs === 0)).toBe(true);
    for (const ms of [5000, 7500, B]) expect(engine.evaluate(ms, layer, context)).toEqual([]);
    expect(engine.crowdFinishMs(layer, context))
      .toBe(Math.max(...schedules.map(dot => dot.onsetFraction * B)));
    expect(computeSceneEnd({ baseMs: B, layers: [layer], swarmEngine: engine }).endMs).toBe(B);
  });

  test('Respawn and Repeat journey are untouched at the same instants: every released dot is drawn', () => {
    const engine = new SwarmEngine();
    const context = { durationMs: B };
    for (const mode of ['respawn', 'loop']) {
      const { layer } = chainLayer([{ ...SLOW, dotCount: 40, wobble: 0.6, lifecycleMode: mode }]);
      const disappearing = chainLayer([{ ...SLOW, dotCount: 40, wobble: 0.6, lifecycleMode: 'disappear' }]).layer;
      const onsets = engine.scheduleDots(layer, context).map(dot => dot.onsetFraction * B);
      for (const { finishMs } of finishes(engine, disappearing, context)) {
        expect(engine.evaluate(finishMs, layer, context), `${mode} at ${finishMs}`)
          .toHaveLength(onsets.filter(onset => onset <= finishMs).length);
      }
    }
  });
});

describe('the journey cache (cost)', () => {
  function cachedCrowd() {
    const engine = new SwarmEngine();
    const { layer } = chainLayer([{ ...SLOW, lifecycleMode: 'disappear' }]);
    const walks = vi.spyOn(engine, '_journeyLength');
    const finish = () => engine.crowdFinishMs(layer, { durationMs: B });
    return { engine, layer, emitter: layer.emitters[0], walks, finish };
  }

  test('walks each dot once; colour, size, sway, pace and releases walk nothing, and are still answered', () => {
    const { emitter, walks, finish } = cachedCrowd();
    const first = finish();
    expect(walks).toHaveBeenCalledTimes(SLOW.dotCount);
    walks.mockClear();

    expect(finish()).toBe(first);
    emitter.update({ dotColor: '#009E73', dotSize: 0.9, wobble: 0.4 });
    expect(finish()).toBe(first);
    emitter.update({ speed: SLOW.speed / 2 });
    const slower = finish();
    emitter.update({ speedVariance: 0, releaseStart: 0.5, onsetVariance: 0, intensityRamp: 0.5 });
    const moved = finish();
    expect(walks).not.toHaveBeenCalled();

    // The answers are a fresh engine's, which walks from cold.
    const cold = new SwarmEngine();
    expect(slower).toBeGreaterThan(first);
    expect(moved).toBe(cold.crowdFinishMs(cachedCrowdLayerLike(emitter), { durationMs: B }));
  });

  /** The same network, carrying a copy of `emitter`'s settings. */
  function cachedCrowdLayerLike(emitter) {
    return chainLayer([{ ...emitter.toJSON(), id: undefined }]).layer;
  }

  test.each([
    ['its seed', ({ emitter }) => emitter.update({ seed: 12 })],
    ['its dot count', ({ emitter }) => emitter.update({ dotCount: 31 })],
    ['a node moved', ({ layer }) => layer.graph.getNodes()[1].moveTo(0.3, 0.7)],
    ['a node anchored elsewhere', ({ layer }) => layer.graph.getNodes()[2].applyAnchor(0.62, 0.32)],
    ['a node\'s type', ({ layer }) => { layer.graph.getNodes()[2].type = 'exit'; }],
    ['a path\'s direction', ({ layer }) => layer.graph.getEdges()[1].setDirection('two-way')],
    ['a path\'s weight', ({ layer }) => layer.graph.getEdges()[3].setWeight(4)],
    ['a path\'s bend', ({ layer }) => layer.graph.getEdges()[0].addControlPoint(0.15, 0.45)],
    ['the order of the paths', ({ layer }) => {
      const edge = layer.graph.getEdges()[1];
      layer.graph.removeEdge(edge.id);
      layer.graph.addEdge(edge.toJSON());
    }],
  ])('walks again when %s changes', (name, change) => {
    const crowd = cachedCrowd();
    crowd.finish();
    crowd.walks.mockClear();

    change(crowd);
    const after = crowd.finish();

    expect(crowd.walks, name).toHaveBeenCalledTimes(crowd.emitter.dotCount);
    expect(after).toBe(new SwarmEngine().crowdFinishMs(crowd.layer, { durationMs: B }));
  });
});

describe('whether a journey can end (the "At journey end" hint\'s question)', () => {
  /** A closed triangle of two-way paths, optionally with an Exit elsewhere. */
  function triangle({ entries = true, exitPath = false, reachable = false } = {}) {
    const layer = new Scene().addFlowLayer({ name: 'Loop', guideType: 'graph' });
    const { graph } = layer;
    const corners = [[0.1, 0.1], [0.3, 0.1], [0.2, 0.3]]
      .map(([x, y]) => graph.addNode({ x, y, type: entries ? 'entry' : 'normal' }));
    corners.forEach((node, index) => graph.addEdge({
      sourceId: node.id, targetId: corners[(index + 1) % 3].id, direction: 'two-way',
    }));
    if (exitPath) {
      const start = graph.addNode({ x: 0.5, y: 0.5 });
      const exit = graph.addNode({ x: 0.9, y: 0.5, type: 'exit' });
      graph.addEdge({ sourceId: start.id, targetId: exit.id, direction: 'two-way' });
      if (reachable) graph.addEdge({ sourceId: corners[0].id, targetId: start.id, direction: 'one-way' });
    }
    layer.addEmitter({ seed: 5, dotCount: 10, lifecycleMode: 'disappear' });
    return layer;
  }

  test('no end anywhere: none can end', () => {
    expect(new SwarmEngine().hasJourneyEnd(triangle({ entries: false }))).toBe(false);
  });

  test('an Exit no entry leads to: none can end; a path to it from an entry: one can', () => {
    const engine = new SwarmEngine();
    expect(engine.hasJourneyEnd(triangle({ exitPath: true }))).toBe(false);
    expect(engine.hasJourneyEnd(triangle({ exitPath: true, reachable: true }))).toBe(true);
  });

  test('a route always ends; a crowd with no network to walk is not asked', () => {
    const engine = new SwarmEngine();
    expect(engine.hasJourneyEnd(new FlowLayer({ guideType: 'route' }))).toBe(true);
    expect(engine.hasJourneyEnd(new FlowLayer({ guideType: 'graph' }))).toBeNull();
  });
});
