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

import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { FlowLayer } from '../src/models/FlowLayer.js';

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
