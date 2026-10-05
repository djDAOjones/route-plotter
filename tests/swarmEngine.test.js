/**
 * SwarmEngine — the deterministic flow-layer dot evaluator (Phase 3).
 *
 * The engine must be a pure function of (timelineMs, layer, context): no
 * stored dot state, no call-order sensitivity, hash-driven per-dot
 * variation. These tests pin the behavioural spec carried over from the
 * salvaged fork suites (release scheduling, weighted junction choice, the
 * four lifecycle modes, normalised positions) re-expressed against the
 * evaluate() API — the fork's stateful tick() architecture is superseded
 * (decision-log 2026-08-17).
 */

import { SwarmEngine, JOURNEY_PACE_CYCLE } from '../src/services/SwarmEngine.js';
import { NetworkEditService } from '../src/services/NetworkEditService.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { EventBus } from '../src/core/EventBus.js';
import { IMAGE_COORDINATES } from '../src/config/constants.js';

const DURATION_MS = 10000;

/** Emitter params that remove all stochastic spread unless a test wants it. */
const CALM = {
  seed: 42,
  speedVariance: 0,
  onsetVariance: 0,
  intensityRamp: 0,
  wobble: 0,
  releaseStart: 0,
  releaseDuration: 0, // burst at t=0 — every dot released together
  lifecycleMode: 'collect',
};

/**
 * Straight west→east line graph: entry (0.1, 0.5) → exit (0.9, 0.5).
 * Returns the layer plus the node handles.
 */
function lineLayer(emitterOptions = {}) {
  const layer = new FlowLayer({ guideType: 'graph' });
  const entry = layer.graph.addNode({ x: 0.1, y: 0.5, type: 'entry' });
  const exit = layer.graph.addNode({ x: 0.9, y: 0.5, type: 'exit' });
  layer.graph.addEdge({ sourceId: entry.id, targetId: exit.id, direction: 'one-way' });
  layer.addEmitter({ ...CALM, ...emitterOptions });
  return { layer, entry, exit };
}

/**
 * Fork: entry → mid, then mid → exitA (heavy) / mid → exitB (light).
 */
function forkLayer(weightA, weightB, emitterOptions = {}) {
  const layer = new FlowLayer({ guideType: 'graph' });
  const entry = layer.graph.addNode({ x: 0.1, y: 0.5, type: 'entry' });
  const mid = layer.graph.addNode({ x: 0.5, y: 0.5, type: 'normal' });
  const exitA = layer.graph.addNode({ x: 0.9, y: 0.2, type: 'exit' });
  const exitB = layer.graph.addNode({ x: 0.9, y: 0.8, type: 'exit' });
  layer.graph.addEdge({ sourceId: entry.id, targetId: mid.id, direction: 'one-way' });
  layer.graph.addEdge({ sourceId: mid.id, targetId: exitA.id, direction: 'one-way', weight: weightA });
  layer.graph.addEdge({ sourceId: mid.id, targetId: exitB.id, direction: 'one-way', weight: weightB });
  layer.addEmitter({ ...CALM, ...emitterOptions });
  return { layer, exitA, exitB };
}

function evaluate(layer, timelineMs, engine = new SwarmEngine()) {
  return engine.evaluate(timelineMs, layer, { durationMs: DURATION_MS });
}

/** Where each dot is, without the emitter id two separately built layers never share. */
const where = dots => dots.map(({ dotIndex, x, y }) => ({ dotIndex, x, y }));

describe('SwarmEngine.hash', () => {
  test('is deterministic and uniform in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = SwarmEngine.hash(123, i, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(v).toBe(SwarmEngine.hash(123, i, 7));
    }
  });

  test('pins exact values — changing the hash would silently restyle every authored scene', () => {
    expect(SwarmEngine.hash(0, 0, 0)).toBeCloseTo(0.096537693636491895, 15);
    expect(SwarmEngine.hash(42, 1, 2)).toBeCloseTo(0.50684719881974161, 15);
    expect(SwarmEngine.hash(0xFFFFFFFF, 99, -1)).toBeCloseTo(0.30740235978737473, 15);
  });

  test('decorrelates consecutive dot and hop indices', () => {
    const values = new Set();
    for (let dot = 0; dot < 50; dot++) {
      for (let hop = -4; hop < 6; hop++) {
        values.add(SwarmEngine.hash(7, dot, hop));
      }
    }
    expect(values.size).toBe(500); // no collisions across the working range
  });
});

describe('SwarmEngine.evaluate — basics', () => {
  test('returns no dots without a usable timeline or guide', () => {
    const { layer } = lineLayer();
    const engine = new SwarmEngine();
    expect(engine.evaluate(1000, layer, { durationMs: 0 })).toEqual([]);
    expect(engine.evaluate(1000, layer, {})).toEqual([]);
    expect(engine.evaluate(1000, null, { durationMs: DURATION_MS })).toEqual([]);

    const empty = new FlowLayer({ guideType: 'graph' });
    empty.addEmitter(CALM);
    expect(evaluate(empty, 1000)).toEqual([]); // no nodes/edges

    const routeless = new FlowLayer({ guideType: 'route' });
    routeless.addEmitter(CALM);
    expect(routeless.emitters.length).toBe(1);
    expect(new SwarmEngine().evaluate(1000, routeless, { durationMs: DURATION_MS })).toEqual([]);
  });

  test('dots carry normalised positions, size, colour and identity', () => {
    const { layer } = lineLayer({ dotCount: 20, dotSize: 0.7, dotColor: '#0072B2' });
    const dots = evaluate(layer, 4000);
    expect(dots.length).toBe(20);
    for (const dot of dots) {
      expect(dot.x).toBeGreaterThanOrEqual(0);
      expect(dot.x).toBeLessThanOrEqual(1);
      expect(dot.y).toBeGreaterThanOrEqual(0);
      expect(dot.y).toBeLessThanOrEqual(1);
      expect(dot.size).toBe(0.7);
      expect(dot.color).toBe('#0072B2');
      expect(dot.emitterId).toBe(layer.emitters[0].id);
      expect(typeof dot.dotIndex).toBe('number');
    }
  });

  test('invisible-layer gating is the renderer’s job — the engine always evaluates', () => {
    const { layer } = lineLayer({ dotCount: 3 });
    layer.visible = false;
    expect(evaluate(layer, 4000).length).toBe(3);
  });
});

describe('SwarmEngine.evaluate — determinism', () => {
  test('same instant → identical dots, call after call', () => {
    const { layer } = lineLayer({ dotCount: 30, speedVariance: 0.5, onsetVariance: 0.5, wobble: 0.5, releaseDuration: 1 });
    const engine = new SwarmEngine();
    const first = engine.evaluate(3333, layer, { durationMs: DURATION_MS });
    const second = engine.evaluate(3333, layer, { durationMs: DURATION_MS });
    expect(second).toEqual(first);
  });

  test('scrub order never matters: t2 after t1 equals t2 on a fresh engine', () => {
    const { layer } = lineLayer({ dotCount: 25, speedVariance: 0.8, onsetVariance: 1, releaseDuration: 1, lifecycleMode: 'respawn' });
    const warm = new SwarmEngine();
    warm.evaluate(9000, layer, { durationMs: DURATION_MS });
    warm.evaluate(500, layer, { durationMs: DURATION_MS });
    const viaWarm = warm.evaluate(6000, layer, { durationMs: DURATION_MS });
    const viaFresh = new SwarmEngine().evaluate(6000, layer, { durationMs: DURATION_MS });
    expect(viaWarm).toEqual(viaFresh);
  });

  test('reseeding changes the look; restoring the seed restores it exactly', () => {
    const { layer } = lineLayer({ dotCount: 10, speedVariance: 1, releaseDuration: 1 });
    const emitter = layer.emitters[0];
    const before = evaluate(layer, 5000);
    emitter.update({ seed: 987654 });
    expect(evaluate(layer, 5000)).not.toEqual(before);
    emitter.update({ seed: 42 });
    expect(evaluate(layer, 5000)).toEqual(before);
  });

  test('a serialized clone gives editor, reload, and export consumers identical frames', () => {
    const { layer } = forkLayer(3, 1, {
      dotCount: 40,
      speed: 0.2,
      speedVariance: 1,
      onsetVariance: 1,
      intensityRamp: -0.6,
      busynessEnvelope: [
        { time: 0, value: 0.1, transition: 'step' },
        { time: 0.4, value: 1, transition: 'gradual' },
        { time: 1, value: 0.2, transition: 'gradual' },
      ],
      wobble: 1,
      releaseDuration: 1,
      lifecycleMode: 'respawn',
    });
    const restored = FlowLayer.fromJSON(JSON.parse(JSON.stringify(layer.toJSON())));

    for (const timelineMs of [0, 1750, 5000, 10000]) {
      expect(evaluate(restored, timelineMs)).toEqual(evaluate(layer, timelineMs));
    }
  });
});

describe('SwarmEngine.evaluate — release window', () => {
  test('no dots exist before the window opens', () => {
    const { layer } = lineLayer({ releaseStart: 0.5, releaseDuration: 0.2, dotCount: 10 });
    expect(evaluate(layer, 4999).length).toBe(0);
    expect(evaluate(layer, 7100).length).toBe(10); // whole burst window passed
  });

  test('with zero variance, dots onset at centred even-spread slots', () => {
    // Window = whole timeline, 2 dots → slots at 0.25 and 0.75 of 10s.
    const { layer } = lineLayer({ dotCount: 2, releaseDuration: 1 });
    expect(evaluate(layer, 2000).length).toBe(0);
    expect(evaluate(layer, 5000).length).toBe(1);
    expect(evaluate(layer, 8000).length).toBe(2);
  });

  test('an overhanging window is clipped at the timeline end', () => {
    // Authored [0.8, 1.4) — effective [0.8, 1.0].
    const { layer } = lineLayer({ releaseStart: 0.8, releaseDuration: 0.6, dotCount: 8 });
    expect(evaluate(layer, 7900).length).toBe(0);
    expect(evaluate(layer, DURATION_MS).length).toBe(8); // all released by the end
  });

  test('intensityRamp biases release density front/back', () => {
    const mkLayer = ramp => lineLayer({ dotCount: 100, releaseDuration: 1, intensityRamp: ramp }).layer;
    const midCount = layer => evaluate(layer, DURATION_MS / 2).length;
    const frontLoaded = midCount(mkLayer(-1));
    const uniform = midCount(mkLayer(0));
    const backLoaded = midCount(mkLayer(1));
    expect(frontLoaded).toBeGreaterThan(uniform);
    expect(backLoaded).toBeLessThan(uniform);
    expect(uniform).toBe(50);
  });

  test('onsetVariance=1 scatters onsets while keeping the count exact by window end', () => {
    const { layer } = lineLayer({ dotCount: 40, releaseDuration: 1, onsetVariance: 1 });
    const midway = evaluate(layer, DURATION_MS / 2).length;
    expect(midway).toBeGreaterThan(5);
    expect(midway).toBeLessThan(35); // scattered, not slotted
    expect(evaluate(layer, DURATION_MS).length).toBe(40);
  });

  test('quiet-busy-quiet envelope concentrates deterministic releases around the middle', () => {
    const busynessEnvelope = [
      { time: 0, value: 0, transition: 'gradual' },
      { time: 0.5, value: 1, transition: 'gradual' },
      { time: 1, value: 0, transition: 'gradual' },
    ];
    const even = lineLayer({ dotCount: 100, releaseDuration: 1 }).layer;
    const shaped = lineLayer({ dotCount: 100, releaseDuration: 1, busynessEnvelope }).layer;
    expect(evaluate(shaped, 2500).length).toBeLessThan(evaluate(even, 2500).length);
    expect(evaluate(shaped, 7500).length).toBeGreaterThan(evaluate(even, 7500).length);
    expect(evaluate(shaped, DURATION_MS).length).toBe(100);
  });

  test('sudden spans hold the earlier busyness until their boundary', () => {
    const gradual = lineLayer({ dotCount: 100, releaseDuration: 1, busynessEnvelope: [
      { time: 0, value: 0.1, transition: 'gradual' },
      { time: 0.5, value: 1, transition: 'gradual' },
      { time: 1, value: 1, transition: 'gradual' },
    ] }).layer;
    const sudden = lineLayer({ dotCount: 100, releaseDuration: 1, busynessEnvelope: [
      { time: 0, value: 0.1, transition: 'step' },
      { time: 0.5, value: 1, transition: 'gradual' },
      { time: 1, value: 1, transition: 'gradual' },
    ] }).layer;
    expect(evaluate(sudden, 4900).length).toBeLessThan(evaluate(gradual, 4900).length);
  });
});

describe('SwarmEngine.evaluate — movement and speed', () => {
  test('a calm dot advances west→east at emitter speed', () => {
    // Burst at t=0, speed 0.1 units/s along a 0.8-unit edge.
    const { layer } = lineLayer({ dotCount: 1, speed: 0.1 });
    const early = evaluate(layer, 1000)[0]; // travelled 0.1
    const later = evaluate(layer, 4000)[0]; // travelled 0.4
    expect(early.x).toBeGreaterThan(0.1);
    expect(later.x).toBeGreaterThan(early.x);
    expect(early.y).toBeCloseTo(0.5, 2);
    expect(later.y).toBeCloseTo(0.5, 2);
    // Corner-slowing on a straight line is a no-op, so distance ≈ linear.
    expect(later.x - early.x).toBeCloseTo(0.3, 1);
  });

  test('speedVariance spreads dots released together', () => {
    const { layer } = lineLayer({ dotCount: 12, speed: 0.05, speedVariance: 1 });
    const xs = evaluate(layer, 3000).map(d => d.x);
    const spread = Math.max(...xs) - Math.min(...xs);
    expect(spread).toBeGreaterThan(0.05);
  });
});

describe('SwarmEngine.evaluate — lifecycle modes', () => {
  const FAST = { dotCount: 1, speed: 5 }; // crosses the whole graph in well under a second

  test('disappear: the dot is gone after reaching the exit', () => {
    const { layer } = lineLayer({ ...FAST, lifecycleMode: 'disappear' });
    expect(evaluate(layer, 50).length).toBe(1);
    expect(evaluate(layer, 5000).length).toBe(0);
  });

  test('collect: the dot parks exactly on the exit node', () => {
    const { layer, exit } = lineLayer({ ...FAST, lifecycleMode: 'collect' });
    const dot = evaluate(layer, 5000)[0];
    expect(dot.x).toBeCloseTo(exit.x, 5);
    expect(dot.y).toBeCloseTo(exit.y, 5);
    expect(evaluate(layer, 9000)[0]).toEqual(dot); // still parked later
  });

  test('respawn: the dot outlives its journey and keeps moving', () => {
    const { layer } = lineLayer({ ...FAST, lifecycleMode: 'respawn' });
    const a = evaluate(layer, 5000);
    const b = evaluate(layer, 5040);
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
    expect(a[0]).not.toEqual(b[0]); // moving, not parked
  });

  test('loop: the dot replays its own journey with an exact period', () => {
    // Two-leg path so the journey has real junctions to replay.
    const layer = new FlowLayer({ guideType: 'graph' });
    const entry = layer.graph.addNode({ x: 0.1, y: 0.5, type: 'entry' });
    const mid = layer.graph.addNode({ x: 0.5, y: 0.5, type: 'normal' });
    const exit = layer.graph.addNode({ x: 0.9, y: 0.5, type: 'exit' });
    layer.graph.addEdge({ sourceId: entry.id, targetId: mid.id, direction: 'one-way' });
    layer.graph.addEdge({ sourceId: mid.id, targetId: exit.id, direction: 'one-way' });
    layer.addEmitter({ ...CALM, dotCount: 1, speed: 0.2, lifecycleMode: 'loop' });

    // Journey ≈ 0.8 units at 0.2 u/s → period ≈ 4000ms. Compare two instants
    // exactly one period apart (both mid-journey, away from the wrap seam).
    const engine = new SwarmEngine();
    const at = t => engine.evaluate(t, layer, { durationMs: 20000 })[0];
    const p1 = at(5000);
    const p2 = at(9000);
    expect(p1.x).toBeCloseTo(p2.x, 2);
    expect(p1.y).toBeCloseTo(p2.y, 2);
  });
});

describe('SwarmEngine.evaluate — a pen-drawn network ends its journeys (DEF-77)', () => {
  // Drawn with the real pen, so its nodes and paths take the types the pen
  // gives them: pass-through nodes, two-way paths, no Entry and no Exit.
  // The crowd keeps the model's defaults (50 dots across the whole timeline,
  // 20% pace and release variation) at a fast pace.
  const DURATION = 30000;
  function penDrawnLayer(lifecycleMode) {
    const layer = new FlowLayer({ guideType: 'graph' });
    const pen = new NetworkEditService(new EventBus());
    pen.enter(layer);
    const a = pen.placeNode({ x: 0.1, y: 0.5 });
    pen.placeNode({ x: 0.5, y: 0.4 });
    const c = pen.placeNode({ x: 0.9, y: 0.5 });
    pen.exit();
    layer.addEmitter({ seed: 12345, speed: 0.6, lifecycleMode });
    return { layer, ends: [a, c] };
  }
  const at = (layer, t) => new SwarmEngine().evaluate(t, layer, { durationMs: DURATION });

  test('the pen types nothing as an exit (the fallback, not the pen, ends the journey)', () => {
    const { layer } = penDrawnLayer('disappear');
    expect(layer.graph.getNodes().map(node => node.type)).toEqual(['normal', 'normal', 'normal']);
    expect(layer.graph.getEdges().map(edge => edge.direction)).toEqual(['two-way', 'two-way']);
  });

  test('Disappear leaves no dot late: only dots released in the last 2 s are still walking', () => {
    // The longest walk, end to end, is about 0.82 of the image at no less than
    // 0.48 a second (0.6 less 20%): under 1.8 s. Collect shows every released
    // dot, so a dot it showed 2 s earlier has had time to finish.
    const { layer: disappear } = penDrawnLayer('disappear');
    const { layer: collect } = penDrawnLayer('collect');
    for (const t of [12000, 18000, 28000]) {
      const releasedEarlier = new Set(at(collect, t - 2000).map(dot => dot.dotIndex));
      const walking = at(disappear, t);
      expect(releasedEarlier.size, `released by ${t - 2000} ms`).toBeGreaterThan(5);
      expect(walking.filter(dot => releasedEarlier.has(dot.dotIndex)), `late at ${t} ms`).toEqual([]);
    }
    expect(at(disappear, DURATION).length).toBeLessThan(at(collect, DURATION).length);
  });

  test('Collect parks every finished dot on an end node, and it stays there', () => {
    const { layer, ends } = penDrawnLayer('collect');
    const released = new Set(at(layer, 13000).map(dot => dot.dotIndex));
    const parked = at(layer, 15000).filter(dot => released.has(dot.dotIndex));
    expect(parked.length).toBeGreaterThan(10);
    for (const dot of parked) {
      const end = ends.find(node => Math.abs(node.x - dot.x) < 1e-9 && Math.abs(node.y - dot.y) < 1e-9);
      expect(end, `dot ${dot.dotIndex} at (${dot.x}, ${dot.y})`).toBeDefined();
    }
    const later = at(layer, 29000).filter(dot => released.has(dot.dotIndex));
    expect(later).toEqual(parked);
  });
});

describe('SwarmEngine.evaluate — graph routing', () => {
  test('junction choices follow edge weights', () => {
    const { layer, exitA, exitB } = forkLayer(3, 1, { dotCount: 400, speed: 5 });
    const dots = evaluate(layer, 9000); // all collected at an exit
    const atA = dots.filter(d => Math.abs(d.y - exitA.y) < 0.01).length;
    const atB = dots.filter(d => Math.abs(d.y - exitB.y) < 0.01).length;
    expect(atA + atB).toBe(400);
    const ratio = atA / atB;
    expect(ratio).toBeGreaterThan(2.2); // ~3:1 with hash noise
    expect(ratio).toBeLessThan(4.0);
  });

  test('junction choices stay distributed when finite weights overflow a direct sum', () => {
    const { layer, exitA, exitB } = forkLayer(1e308, 1e308, { dotCount: 400, speed: 5 });
    const dots = evaluate(layer, 9000);
    const atA = dots.filter(d => Math.abs(d.y - exitA.y) < 0.01).length;
    const atB = dots.filter(d => Math.abs(d.y - exitB.y) < 0.01).length;
    expect(atA).toBeGreaterThan(150);
    expect(atB).toBeGreaterThan(150);
  });

  test('one-way edges are never traversed backwards', () => {
    // Only edge is exit→entry one-way, so the entry has no way onward:
    // dots park at the entry node (dead end behaves as an exit).
    const layer = new FlowLayer({ guideType: 'graph' });
    const entry = layer.graph.addNode({ x: 0.2, y: 0.5, type: 'entry' });
    const exit = layer.graph.addNode({ x: 0.8, y: 0.5, type: 'exit' });
    layer.graph.addEdge({ sourceId: exit.id, targetId: entry.id, direction: 'one-way' });
    layer.addEmitter({ ...CALM, dotCount: 4, speed: 1 });
    for (const dot of evaluate(layer, 8000)) {
      expect(dot.x).toBeCloseTo(entry.x, 5);
    }
  });

  test('two-way edges carry dots from either end', () => {
    const layer = new FlowLayer({ guideType: 'graph' });
    const entry = layer.graph.addNode({ x: 0.8, y: 0.5, type: 'entry' });
    const exit = layer.graph.addNode({ x: 0.2, y: 0.5, type: 'exit' });
    layer.graph.addEdge({ sourceId: exit.id, targetId: entry.id, direction: 'two-way' });
    layer.addEmitter({ ...CALM, dotCount: 2, speed: 5 });
    for (const dot of evaluate(layer, 8000)) {
      expect(dot.x).toBeCloseTo(exit.x, 5); // travelled east→west against edge direction
    }
  });

  test('a graph with no explicit entries falls back to nodes with a way onward', () => {
    const layer = new FlowLayer({ guideType: 'graph' });
    const a = layer.graph.addNode({ x: 0.1, y: 0.5, type: 'normal' });
    const b = layer.graph.addNode({ x: 0.9, y: 0.5, type: 'normal' });
    layer.graph.addEdge({ sourceId: a.id, targetId: b.id, direction: 'one-way' });
    layer.addEmitter({ ...CALM, dotCount: 3, speed: 0.05 });
    expect(evaluate(layer, 2000).length).toBe(3);
  });

  test('editing a node position invalidates that edge’s cached path', () => {
    // Catch the dot MID-EDGE (parked dots read the node directly and would
    // pass even with a stale path cache).
    const { layer, exit } = lineLayer({ dotCount: 1, speed: 0.1 });
    const engine = new SwarmEngine();
    const before = engine.evaluate(6000, layer, { durationMs: DURATION_MS })[0];
    expect(before.y).toBeCloseTo(0.5, 2); // on the original level edge
    exit.moveTo(0.9, 0.1);
    const after = engine.evaluate(6000, layer, { durationMs: DURATION_MS })[0];
    expect(after.y).toBeLessThan(0.4); // now climbing the re-authored slope
  });

  test('an edge with control points keeps dots inside the canvas', () => {
    const layer = new FlowLayer({ guideType: 'graph' });
    const entry = layer.graph.addNode({ x: 0.1, y: 0.1, type: 'entry' });
    const exit = layer.graph.addNode({ x: 0.9, y: 0.1, type: 'exit' });
    const edge = layer.graph.addEdge({ sourceId: entry.id, targetId: exit.id, direction: 'one-way' });
    edge.addControlPoint(0.5, 0.9);
    layer.addEmitter({ ...CALM, dotCount: 10, speed: 0.1, releaseDuration: 1, lifecycleMode: 'respawn' });
    for (const t of [1000, 3000, 5000, 7000, 9000]) {
      for (const dot of evaluate(layer, t)) {
        expect(dot.x).toBeGreaterThanOrEqual(0);
        expect(dot.x).toBeLessThanOrEqual(1);
        expect(dot.y).toBeGreaterThanOrEqual(0);
        expect(dot.y).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('SwarmEngine.evaluate — route guide', () => {
  const routePath = () => {
    // Straight pre-computed hero polyline, west→east at y=0.3.
    const points = [];
    for (let i = 0; i <= 100; i++) points.push({ x: 0.1 + (i / 100) * 0.8, y: 0.3 });
    return points;
  };

  test('dots travel the hero polyline', () => {
    const layer = new FlowLayer({ guideType: 'route' });
    layer.addEmitter({ ...CALM, dotCount: 1, speed: 0.1 });
    const engine = new SwarmEngine();
    const context = { durationMs: DURATION_MS, routePathPoints: routePath() };
    const early = engine.evaluate(1000, layer, context)[0];
    const later = engine.evaluate(5000, layer, context)[0];
    expect(early.y).toBeCloseTo(0.3, 5);
    expect(later.x).toBeGreaterThan(early.x);
  });

  test('dots follow a route that runs off the image (DEF-35)', () => {
    // Since DEF-03 a route may leave the image. Every dot was clamped to 0–1,
    // so a crowd on such a route slid along the image's edge instead.
    const offImage = [];
    for (let i = 0; i <= 100; i++) offImage.push({ x: -0.5 + (i / 100) * 0.8, y: 1.25 });
    const layer = new FlowLayer({ guideType: 'route' });
    layer.addEmitter({ ...CALM, dotCount: 1, speed: 0.1 });
    const [dot] = new SwarmEngine().evaluate(1000, layer, { durationMs: DURATION_MS, routePathPoints: offImage });
    expect(dot.x).toBeLessThan(0);
    expect(dot.y).toBeCloseTo(1.25, 5);
  });

  test('a wobbling dot stops where a project can store a point (DEF-35)', () => {
    // A route along the very edge of that range: the wobble pushes dots
    // across it both ways, and the ones pushed out are held on it.
    const { MIN } = IMAGE_COORDINATES;
    const edge = [];
    for (let i = 0; i <= 100; i++) edge.push({ x: MIN, y: 0.1 + (i / 100) * 0.8 });
    const layer = new FlowLayer({ guideType: 'route' });
    layer.addEmitter({ ...CALM, dotCount: 8, speed: 0.05, releaseDuration: 1, lifecycleMode: 'respawn', wobble: 1 });
    const dots = new SwarmEngine().evaluate(6000, layer, { durationMs: DURATION_MS, routePathPoints: edge });
    expect(dots.every(dot => dot.x >= MIN)).toBe(true);
    expect(dots.some(dot => dot.x === MIN)).toBe(true);
    expect(dots.some(dot => dot.x > MIN)).toBe(true);
  });

  test('lifecycles apply at the route end', () => {
    const context = { durationMs: DURATION_MS, routePathPoints: routePath() };
    const mk = mode => {
      const layer = new FlowLayer({ guideType: 'route' });
      layer.addEmitter({ ...CALM, dotCount: 1, speed: 5, lifecycleMode: mode });
      return new SwarmEngine().evaluate(8000, layer, context);
    };
    expect(mk('disappear').length).toBe(0);
    const collected = mk('collect')[0];
    expect(collected.x).toBeCloseTo(0.9, 2);
    expect(mk('respawn').length).toBe(1);
    expect(mk('loop').length).toBe(1);

    // Where, not just how many (DEF-77: "Make Respawn vary"). A burst of 12
    // dots at the default 20% Pace variation crosses the 0.8 route in about
    // 2 s. Until the first journey ends the two modes agree exactly; after
    // it, every respawned dot is somewhere its repeating twin is not.
    const crowd = (mode, t) => {
      const layer = new FlowLayer({ guideType: 'route' });
      layer.addEmitter({ ...CALM, dotCount: 12, speed: 0.4, speedVariance: 0.2, lifecycleMode: mode });
      return new SwarmEngine().evaluate(t, layer, context);
    };
    expect(where(crowd('respawn', 1000))).toEqual(where(crowd('loop', 1000)));
    for (const t of [4000, 6500, 9000]) {
      const respawned = crowd('respawn', t);
      const repeated = crowd('loop', t);
      expect(respawned.map(dot => dot.dotIndex)).toEqual(repeated.map(dot => dot.dotIndex));
      respawned.forEach((dot, index) => {
        expect(Math.abs(dot.x - repeated[index].x), `dot ${dot.dotIndex} at ${t} ms`).toBeGreaterThan(1e-4);
      });
    }

    // Repeat journey stays an exact replay: one journey period apart (0.8 at
    // 0.4 a second, no pace variation), every dot is where it was, sway and all.
    const period = (0.8 / 0.4) * 1000;
    const replay = t => {
      const layer = new FlowLayer({ guideType: 'route' });
      layer.addEmitter({ ...CALM, dotCount: 6, speed: 0.4, wobble: 0.6, lifecycleMode: 'loop' });
      return new SwarmEngine().evaluate(t, layer, context);
    };
    for (const t of [700, 2300, 3100]) {
      const first = replay(t);
      const again = replay(t + period);
      expect(again.length).toBe(first.length);
      again.forEach((dot, index) => {
        expect(dot.x).toBeCloseTo(first[index].x, 9);
        expect(dot.y).toBeCloseTo(first[index].y, 9);
      });
    }
  });

  test('each respawned journey draws its own pace, not one shared by every journey after the first (DEF-77)', () => {
    // Sampled every 5 ms: a dot re-enters where its x drops back to the start,
    // so the gaps between re-entries are its respawned journeys' durations.
    const durationMs = 30000;
    const context = { durationMs, routePathPoints: routePath() };
    const layer = new FlowLayer({ guideType: 'route' });
    layer.addEmitter({ ...CALM, dotCount: 4, speed: 0.4, speedVariance: 0.5, lifecycleMode: 'respawn' });
    const engine = new SwarmEngine();
    const reentries = new Map();
    const lastX = new Map();
    for (let t = 0; t <= durationMs; t += 5) {
      for (const dot of engine.evaluate(t, layer, context)) {
        if (lastX.has(dot.dotIndex) && dot.x < lastX.get(dot.dotIndex) - 0.4) {
          reentries.set(dot.dotIndex, [...(reentries.get(dot.dotIndex) || []), t]);
        }
        lastX.set(dot.dotIndex, dot.x);
      }
    }
    expect(reentries.size).toBe(4);
    for (const [dotIndex, times] of reentries) {
      const journeys = times.slice(1).map((t, index) => t - times[index]);
      expect(journeys.length, `dot ${dotIndex}`).toBeGreaterThanOrEqual(3);
      expect(Math.max(...journeys) - Math.min(...journeys), `dot ${dotIndex}: ${journeys}`).toBeGreaterThan(50);
    }
  });

  test('Respawn sways afresh each journey; with no variation to draw, every journey is alike (DEF-77)', () => {
    const context = { durationMs: DURATION_MS, routePathPoints: routePath() };
    const crowd = (mode, extra) => {
      const layer = new FlowLayer({ guideType: 'route' });
      layer.addEmitter({ ...CALM, dotCount: 6, speed: 0.4, lifecycleMode: mode, ...extra });
      return new SwarmEngine().evaluate(5000, layer, context);
    };
    // Walking variation alone (0% Pace variation): same places along the
    // route, different places across it.
    const swayed = crowd('respawn', { wobble: 0.6 });
    const replayed = crowd('loop', { wobble: 0.6 });
    swayed.forEach((dot, index) => {
      expect(dot.x).toBeCloseTo(replayed[index].x, 6);
      expect(Math.abs(dot.y - replayed[index].y), `dot ${dot.dotIndex}`).toBeGreaterThan(1e-5);
    });
    // 0% Pace and 0% Walking variation promise dots that move as one.
    expect(where(crowd('respawn', {}))).toEqual(where(crowd('loop', {})));
  });
});

describe('SwarmEngine.evaluate — Respawn against Repeat journey on a network (DEF-77)', () => {
  test('one entry, no junctions: Respawn varies after the first journey, Repeat journey replays it', () => {
    // The traced-route shape: entry → mid → exit, one way.
    const make = mode => {
      const layer = new FlowLayer({ guideType: 'graph' });
      const entry = layer.graph.addNode({ x: 0.1, y: 0.5, type: 'entry' });
      const mid = layer.graph.addNode({ x: 0.5, y: 0.5 });
      const exit = layer.graph.addNode({ x: 0.9, y: 0.5, type: 'exit' });
      layer.graph.addEdge({ sourceId: entry.id, targetId: mid.id, direction: 'one-way' });
      layer.graph.addEdge({ sourceId: mid.id, targetId: exit.id, direction: 'one-way' });
      layer.addEmitter({ ...CALM, dotCount: 12, speed: 0.4, speedVariance: 0.2, lifecycleMode: mode });
      return layer;
    };
    const respawn = make('respawn');
    const loop = make('loop');
    expect(where(evaluate(respawn, 1000))).toEqual(where(evaluate(loop, 1000)));
    for (const t of [4000, 6500, 9000]) {
      const respawned = evaluate(respawn, t);
      const repeated = evaluate(loop, t);
      respawned.forEach((dot, index) => {
        expect(Math.abs(dot.x - repeated[index].x), `dot ${dot.dotIndex} at ${t} ms`).toBeGreaterThan(1e-4);
      });
    }
  });
});

describe('SwarmEngine.evaluate — Respawn varies however long it runs (DEF-77)', () => {
  // The review's case: a route a hundredth of the image long at Speed 1, so a
  // dot respawns about 100 times a second, with 20% Pace and 50% Walking
  // variation. Journey 2,049 on used to repeat journey 2,048's pace and sway.
  const N = JOURNEY_PACE_CYCLE;
  const SEED = 2024;
  const PACE = 0.2;
  const SWAY = 0.5;
  const ROUTE = Array.from({ length: 101 }, (_, i) => ({ x: 0.5 + 0.01 * (i / 100), y: 0.3 }));
  const LENGTH = new PathCalculator().calculatePathLength(ROUTE);
  const context = { durationMs: 60000, routePathPoints: ROUTE };
  const crowd = (extra = {}) => {
    const layer = new FlowLayer({ guideType: 'route' });
    layer.addEmitter({
      ...CALM, seed: SEED, dotCount: 3, speed: 1, speedVariance: PACE, wobble: SWAY,
      lifecycleMode: 'respawn', ...extra,
    });
    return layer;
  };
  const at = (layer, t, engine = new SwarmEngine()) => where(engine.evaluate(t, layer, context));

  // The rule, restated from the hash: journey 0 keeps the dot's founding
  // channels; journey k ≥ 1 sways by its own block of three channels below
  // them, and takes its pace from block ((k − 1) mod N) + 1.
  const block = k => -5 - 3 * (k - 1);
  const pace = (dot, k) => 1 + PACE * (2 * SwarmEngine.hash(SEED, dot, k === 0 ? -2 : block(((k - 1) % N) + 1)) - 1);
  const sway = (dot, k, travelled, wobble = SWAY) => {
    const phase0 = SwarmEngine.hash(SEED, dot, k === 0 ? -3 : block(k) - 1);
    const frequency = 4 + 8 * SwarmEngine.hash(SEED, dot, k === 0 ? -4 : block(k) - 2);
    return Math.sin(2 * Math.PI * (travelled * frequency + phase0)) * wobble * 0.02;
  };
  const takes = (dot, k) => LENGTH / pace(dot, k); // seconds, at Speed 1
  /** Journey by journey from release, with no cycle skipped: where the dot is. */
  const reference = (dot, seconds, wobble = SWAY) => {
    let start = 0;
    for (let k = 0; ; k++) {
      if (seconds < start + takes(dot, k)) {
        const travelled = ((seconds - start) / takes(dot, k)) * LENGTH;
        return { journey: k, start, x: ROUTE[0].x + travelled, y: 0.3 + sway(dot, k, travelled, wobble) };
      }
      start += takes(dot, k);
    }
  };

  test('at any instant, however late, it is where summing its journeys one by one puts it', () => {
    const layer = crowd();
    for (const t of [300, 1234, 30000, 45678, 60000]) {
      at(layer, t).forEach(dot => {
        const expected = reference(dot.dotIndex, t / 1000);
        const label = `dot ${dot.dotIndex} at ${t} ms, journey ${expected.journey}`;
        expect(dot.x, label).toBeCloseTo(expected.x, 9);
        expect(dot.y, label).toBeCloseTo(expected.y, 9);
      });
    }
    // Past one cycle, and past the old bound of 2,048 journeys.
    expect(reference(0, 1.234).journey).toBeGreaterThan(N);
    expect(reference(0, 30).journey).toBeGreaterThan(2048);
  });

  test('thousands of journeys in, each still takes its own time and sways its own way', () => {
    // Re-entries found from the engine alone, sampled every 0.1 ms.
    const layer = crowd({ dotCount: 1 });
    const engine = new SwarmEngine();
    for (const from of [30000, 59900]) {
      const reentries = [];
      let last = null;
      for (let t = from; t <= from + 60; t += 0.1) {
        const [dot] = engine.evaluate(t, layer, context);
        if (last && dot.x < last.x - LENGTH / 2) reentries.push(t);
        last = dot;
      }
      expect(reentries.length, `from ${from} ms`).toBeGreaterThanOrEqual(5);
      const journeys = reentries.slice(1).map((t, index) => t - reentries[index]);
      expect(Math.max(...journeys) - Math.min(...journeys), `from ${from} ms: ${journeys}`).toBeGreaterThan(0.5);
      // Halfway along, consecutive journeys sway to different sides of the route.
      const halfway = reentries.slice(0, -1)
        .map((t, index) => engine.evaluate((t + reentries[index + 1]) / 2, layer, context)[0].y);
      expect(new Set(halfway.map(y => y.toFixed(6))).size, `from ${from} ms`).toBe(halfway.length);
    }
  });

  test('its paces come round every N journeys; its sway never does', () => {
    // One cycle's time: journeys 1 to N, which every later cycle repeats.
    const cycleSeconds = dot => Array.from({ length: N }, (_, index) => takes(dot, index + 1))
      .reduce((sum, seconds) => sum + seconds, 0);
    const swaying = crowd();
    const steady = crowd({ wobble: 0 });
    for (const t of [700, 2500, 30000]) {
      for (const dotIndex of [0, 1, 2]) {
        const later = t + cycleSeconds(dotIndex) * 1000;
        const [now, then] = [at(steady, t)[dotIndex], at(steady, later)[dotIndex]];
        expect(then.x, `dot ${dotIndex} at ${t} ms`).toBeCloseTo(now.x, 9);
        expect(then.y).toBeCloseTo(now.y, 12);
        const [sway0, sway1] = [at(swaying, t)[dotIndex], at(swaying, later)[dotIndex]];
        expect(sway1.x).toBeCloseTo(sway0.x, 9);
        expect(Math.abs(sway1.y - sway0.y), `dot ${dotIndex} at ${t} ms`).toBeGreaterThan(1e-5);
      }
    }
  });

  test('seeking back and forth gives the same answer as a fresh engine', () => {
    const layer = crowd();
    const engine = new SwarmEngine();
    for (const t of [60000, 1500, 30000, 29999, 45678, 300, 60000]) {
      expect(engine.evaluate(t, layer, context), `${t} ms`).toEqual(new SwarmEngine().evaluate(t, layer, context));
    }
    expect(SwarmEngine.hash(SEED, 0, block(6000) - 2)).toBeLessThan(1); // a late journey's channel is a draw
  });

  test('Repeat journey is still the arithmetic it was before DEF-77, to the last bit', () => {
    // Restated from the engine before DEF-77, on a winding route so the sway
    // turns with it: a dot's distance wraps by the route's length, at its
    // founding pace, swaying by its founding phase and frequency.
    const route = Array.from({ length: 81 }, (_, i) => ({ x: 0.1 + 0.8 * (i / 80), y: 0.4 + 0.1 * Math.sin(i / 8) }));
    const calc = new PathCalculator();
    const length = calc.calculatePathLength(route);
    const layer = new FlowLayer({ guideType: 'route' });
    layer.addEmitter({
      ...CALM, seed: SEED, dotCount: 5, speed: 0.7, speedVariance: 0.5, wobble: 0.8, lifecycleMode: 'loop',
    });
    const { seed, speed, speedVariance, wobble } = layer.emitters[0];
    const before = (dotIndex, t) => {
      const multiplier = Math.max(0.05, 1 + speedVariance * (2 * SwarmEngine.hash(seed, dotIndex, -2) - 1));
      let distance = speed * multiplier * (t / 1000);
      if (distance >= length) distance = distance % length;
      const progress = distance / length;
      const point = calc.getPointAtProgress(route, progress);
      const ahead = calc.getPointAtProgress(route, Math.min(1, progress + 0.01));
      const behind = calc.getPointAtProgress(route, Math.max(0, progress - 0.01));
      const dx = ahead.x - behind.x;
      const dy = ahead.y - behind.y;
      const len = Math.hypot(dx, dy);
      const frequency = 4 + 8 * SwarmEngine.hash(seed, dotIndex, -4);
      const phase0 = SwarmEngine.hash(seed, dotIndex, -3);
      const offset = Math.sin(2 * Math.PI * (distance * frequency + phase0)) * wobble * 0.02;
      return { dotIndex, x: point.x + (-dy / len) * offset, y: point.y + (dx / len) * offset };
    };
    for (const t of [400, 3300, 17777, 60000]) {
      const dots = new SwarmEngine().evaluate(t, layer, { durationMs: 60000, routePathPoints: route });
      expect(where(dots), `${t} ms`).toEqual(dots.map(dot => before(dot.dotIndex, t)));
    }
  });
});

describe('SwarmEngine.evaluate — wobble', () => {
  test('zero wobble keeps dots on the guide; full wobble displaces within bounds', () => {
    const calm = lineLayer({ dotCount: 8, speed: 0.05, releaseDuration: 1, lifecycleMode: 'respawn' });
    for (const dot of evaluate(calm.layer, 6000)) {
      expect(dot.y).toBeCloseTo(0.5, 2);
    }

    const wobbly = lineLayer({ dotCount: 8, speed: 0.05, releaseDuration: 1, lifecycleMode: 'respawn', wobble: 1 });
    const dots = evaluate(wobbly.layer, 6000);
    const maxDeviation = Math.max(...dots.map(d => Math.abs(d.y - 0.5)));
    expect(maxDeviation).toBeGreaterThan(0.001); // visibly off the line
    expect(maxDeviation).toBeLessThanOrEqual(0.021); // amplitude cap + rounding
  });
});

describe('SwarmEngine.evaluate — multiple emitters', () => {
  test('emitters evaluate independently and tag their dots', () => {
    const { layer } = lineLayer({ dotCount: 3, dotColor: '#E69F00' });
    const second = layer.addEmitter({ ...CALM, seed: 7, dotCount: 5, dotColor: '#56B4E9', speed: 0.02 });
    const dots = evaluate(layer, 6000);
    expect(dots.length).toBe(8);
    expect(dots.filter(d => d.emitterId === second.id).length).toBe(5);
    expect(new Set(dots.map(d => d.color))).toEqual(new Set(['#E69F00', '#56B4E9']));
  });
});
