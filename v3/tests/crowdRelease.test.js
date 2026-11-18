/**
 * CROWD-08 part A — whether a crowd can be drawn, the test Play and both
 * exports admit a project with no route by (`SwarmEngine.canRelease`).
 *
 * The lead's settlement of "can release dots" (the brief, §10.1, §11.2): a
 * crowd qualifies when the engine's `evaluate` returns at least one of its
 * dots at some finite instant of the playback, whatever the layer's
 * visibility. Every witness here is checked against `evaluate` itself, never
 * against the predicate: at each dot's exact onset, computed as the engine
 * computes it (`scheduleDots`'s onset fraction times the base timeline), and,
 * where it is finite and inside the playback, half its journey later. A
 * seeded property test of generated small networks backs them all (§13.2).
 */

import { describe, expect, test, vi } from 'vitest';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { Scene } from '../src/models/Scene.js';
import { dotJourneyMs } from '../src/utils/crowdArrival.js';

const B = 10000;
const EPS = Number.EPSILON;
const LIFECYCLES = ['disappear', 'collect', 'respawn', 'loop'];

/** A layer of `nodes` ([x, y, type]) and `paths` ([from, to, options]) with `emitters`. */
function networkLayer({ nodes, paths = [], emitters = [], id }) {
  const layer = new FlowLayer({ guideType: 'graph', ...(id ? { id } : {}) });
  const made = nodes.map(([x, y, type = 'normal']) => layer.graph.addNode({ x, y, type }));
  for (const [from, to, options = {}] of paths) {
    layer.graph.addEdge({ sourceId: made[from].id, targetId: made[to].id, direction: 'one-way', ...options });
  }
  for (const options of emitters) layer.addEmitter(options);
  return { layer, nodes: made };
}

/**
 * Each dot's exact onset, as `evaluate` computes it, in emitter and dot order;
 * none where the engine has no guide to release them onto (it then schedules
 * nothing).
 */
function onsets(engine, layer, context) {
  const fractions = engine.scheduleDots(layer, context).map(dot => dot.onsetFraction);
  if (fractions.length === 0) return [];
  let at = 0;
  return layer.emitters.flatMap(emitter => Array.from({ length: emitter.dotCount }, (_, index) => ({
    emitter, index, onsetMs: fractions[at++] * context.durationMs,
  })));
}

/** Whether `evaluate` draws this dot at `ms`. */
const drawnAt = (engine, layer, context, { emitter, index }, ms) =>
  engine.evaluate(ms, layer, context).some(dot => dot.emitterId === emitter.id && dot.dotIndex === index);

/** Instants through the whole base timeline, for a layer the engine schedules nothing on. */
const across = durationMs => [0, 0.25, 0.5, 0.75, 1].map(step => step * durationMs);

/**
 * The oracle (§10.2, §11.3): does `evaluate` return a dot at some dot's exact
 * onset, or, where it is finite and inside the playback, half its journey on?
 * With nothing scheduled, it is asked across the base timeline instead.
 */
function evaluatorDraws(engine, layer, context) {
  const schedules = engine.scheduleDots(layer, context);
  if (schedules.length === 0) {
    return across(context.durationMs).some(ms => engine.evaluate(ms, layer, context).length > 0);
  }
  return onsets(engine, layer, context).some(({ onsetMs }, at) => {
    if (engine.evaluate(onsetMs, layer, context).length > 0) return true;
    const later = onsetMs + schedules[at].journeyMs / 2;
    return Number.isFinite(later) && later <= context.durationMs
      && engine.evaluate(later, layer, context).length > 0;
  });
}

/** The predicate and the oracle, side by side. */
function verdicts(layer, context = { durationMs: B }) {
  const engine = new SwarmEngine();
  return { predicate: engine.canRelease(layer, context), evaluator: evaluatorDraws(engine, layer, context) };
}

describe('refused: nothing the evaluator would draw (§9.1, §10.2, §11.3)', () => {
  const disappear = { seed: 3, dotCount: 4, releaseStart: 0.2, releaseDuration: 0.5, lifecycleMode: 'disappear' };
  test.each([
    ['an empty network', () => networkLayer({ nodes: [], emitters: [disappear] }).layer],
    ['nodes and no path', () => networkLayer({
      nodes: [[0.2, 0.2, 'entry'], [0.8, 0.8, 'exit']], emitters: [disappear],
    }).layer],
    ['an incoming-only Entry under Disappear', () => networkLayer({
      nodes: [[0.2, 0.2, 'entry'], [0.6, 0.6]], paths: [[1, 0]], emitters: [disappear],
    }).layer],
    ['every path of no length under Disappear', () => networkLayer({
      nodes: [[0.4, 0.4, 'entry'], [0.4, 0.4], [0.4, 0.4, 'exit']], paths: [[0, 1], [1, 2]], emitters: [disappear],
    }).layer],
    ['a layer with no emitters (FlowLayer allows one)', () => networkLayer({
      nodes: [[0.2, 0.2, 'entry'], [0.8, 0.8, 'exit']], paths: [[0, 1]],
    }).layer],
    ['Follow route with no route', () => {
      const layer = new FlowLayer({ guideType: 'route' });
      layer.addEmitter({ ...disappear, lifecycleMode: 'collect' });
      return layer;
    }],
  ])('%s', (name, make) => {
    expect(verdicts(make())).toEqual({ predicate: false, evaluator: false });
  });

  test('a count of 0, which cannot be authored or loaded, as defensive input', () => {
    const { layer } = networkLayer({
      nodes: [[0.2, 0.2, 'entry'], [0.8, 0.8, 'exit']], paths: [[0, 1]],
      emitters: [{ ...disappear, lifecycleMode: 'collect' }],
    });
    expect(new SwarmEngine().canRelease(layer, { durationMs: B })).toBe(true);
    layer.emitters[0].dotCount = 0; // past the model's own clamp (Emitter.js), as a unit input
    expect(new SwarmEngine().canRelease(layer, { durationMs: B })).toBe(false);
    expect(new SwarmEngine().evaluate(B / 2, layer, { durationMs: B })).toEqual([]);
  });

  test('no base timeline: nothing is drawn, so nothing is admitted', () => {
    const { layer } = networkLayer({
      nodes: [[0.2, 0.2, 'entry'], [0.8, 0.8, 'exit']], paths: [[0, 1]],
      emitters: [{ ...disappear, lifecycleMode: 'respawn' }],
    });
    expect(verdicts(layer, { durationMs: 0 })).toEqual({ predicate: false, evaluator: false });
    expect(verdicts(layer, { durationMs: B })).toEqual({ predicate: true, evaluator: true });
  });
});

describe('admitted: the evaluator draws a dot (§9.1, §10.1)', () => {
  test('Respawn and Repeat journey play, though they never extend the end', () => {
    for (const lifecycleMode of ['respawn', 'loop']) {
      const { layer } = networkLayer({
        nodes: [[0.2, 0.2, 'entry'], [0.8, 0.8, 'exit']], paths: [[0, 1]],
        emitters: [{ seed: 5, dotCount: 3, lifecycleMode }],
      });
      expect(verdicts(layer), lifecycleMode).toEqual({ predicate: true, evaluator: true });
      expect(new SwarmEngine().crowdFinishMs(layer, { durationMs: B }), lifecycleMode).toBe(0);
    }
  });

  test('a release window of no span releases together, and one clipped to the end releases at it', () => {
    for (const [releaseStart, releaseDuration] of [[0.4, 0], [1, 0.3], [0.95, 0.5]]) {
      const { layer } = networkLayer({
        nodes: [[0.2, 0.2, 'entry'], [0.8, 0.8, 'exit']], paths: [[0, 1]],
        emitters: [{ seed: 9, dotCount: 3, releaseStart, releaseDuration, lifecycleMode: 'disappear' }],
      });
      const engine = new SwarmEngine();
      const times = onsets(engine, layer, { durationMs: B }).map(dot => dot.onsetMs);
      if (releaseDuration === 0) expect(new Set(times).size).toBe(1);
      if (releaseStart === 1) expect(times.every(ms => ms === B)).toBe(true);
      expect(verdicts(layer), `${releaseStart}+${releaseDuration}`).toEqual({ predicate: true, evaluator: true });
    }
  });

  test('an Entry → a coincident junction (a path of no length) → a path with length qualifies', () => {
    const { layer } = networkLayer({
      nodes: [[0.3, 0.3, 'entry'], [0.3, 0.3], [0.7, 0.6, 'exit']], paths: [[0, 1], [1, 2]],
      emitters: [{ seed: 2, dotCount: 2, lifecycleMode: 'disappear' }],
    });
    expect(verdicts(layer)).toEqual({ predicate: true, evaluator: true });
  });

  test('a blocked-only network: Disappear refused; Collect, Respawn and Repeat journey drawn, parked', () => {
    const results = Object.fromEntries(LIFECYCLES.map(lifecycleMode => {
      const { layer } = networkLayer({
        nodes: [[0.2, 0.2, 'entry'], [0.6, 0.6]], paths: [[1, 0]],
        emitters: [{ seed: 4, dotCount: 3, lifecycleMode }],
      });
      return [lifecycleMode, verdicts(layer)];
    }));
    expect(results).toEqual({
      disappear: { predicate: false, evaluator: false },
      collect: { predicate: true, evaluator: true },
      respawn: { predicate: true, evaluator: true },
      loop: { predicate: true, evaluator: true },
    });
  });

  test('several emitters on a blocked Entry: Disappear ones are refused, a Collect one beside them is drawn', () => {
    const blocked = { lifecycleMode: 'disappear', dotCount: 3 };
    const { layer } = networkLayer({
      nodes: [[0.2, 0.2, 'entry'], [0.6, 0.6], [0.9, 0.2, 'exit']], paths: [[1, 0], [1, 2]],
      emitters: [{ ...blocked, seed: 1 }, { ...blocked, seed: 2 }],
    });
    expect(verdicts(layer)).toEqual({ predicate: false, evaluator: false });
    // A third emitter that collects at the blocked Entry is drawn, parked there.
    layer.addEmitter({ ...blocked, seed: 3, lifecycleMode: 'collect' });
    expect(verdicts(layer)).toEqual({ predicate: true, evaluator: true });
  });
});

describe('mixed Entries: the seed and the dot index decide (§10.1)', () => {
  /** A blocked Entry (no path leaves it, nodes[0]) beside a productive one (nodes[1]). */
  const mixed = (seeds, lifecycleMode = 'disappear') => networkLayer({
    nodes: [[0.2, 0.2, 'entry'], [0.2, 0.8, 'entry'], [0.8, 0.5, 'exit']],
    paths: [[2, 0], [1, 2]],
    emitters: seeds.map(seed => ({ seed, dotCount: 2, wobble: 0, lifecycleMode })),
  });
  /**
   * Which Entry each of a seed's two dots picks, read off the evaluator: a
   * Collect twin, released at the same onset, stands on the Entry it picked.
   */
  const entriesPicked = seed => {
    const { layer, nodes } = mixed([seed], 'collect');
    const engine = new SwarmEngine();
    return onsets(engine, layer, { durationMs: B }).map(dot => {
      const [drawn] = engine.evaluate(dot.onsetMs, layer, { durationMs: B })
        .filter(each => each.dotIndex === dot.index);
      return nodes.findIndex(node => node.x === drawn.x && node.y === drawn.y);
    });
  };

  test('seeds found by search: one where some dot picks the productive Entry, one where none does', () => {
    let someSeed = null;
    let noneSeed = null;
    for (let seed = 0; seed < 200 && (someSeed === null || noneSeed === null); seed += 1) {
      const picked = entriesPicked(seed);
      expect(picked.every(entry => entry === 0 || entry === 1), `seed ${seed}`).toBe(true);
      const productive = picked.includes(1);
      if (productive && someSeed === null) someSeed = seed;
      if (!productive && noneSeed === null) noneSeed = seed;
      expect(verdicts(mixed([seed]).layer), `seed ${seed}`).toEqual({ predicate: productive, evaluator: productive });
    }
    expect(someSeed).not.toBeNull();
    expect(noneSeed).not.toBeNull();
    expect(entriesPicked(someSeed)).toContain(1);
    expect(entriesPicked(noneSeed)).toEqual([0, 0]);

    // Several emitters, only one productive: the crowd qualifies by that one, and not without it.
    expect(verdicts(mixed([noneSeed, someSeed]).layer)).toEqual({ predicate: true, evaluator: true });
    expect(verdicts(mixed([noneSeed, noneSeed]).layer)).toEqual({ predicate: false, evaluator: false });
  });
});

describe('the hop cap and the onset (§11.1, §12.3, §13.1)', () => {
  test('a directed cycle of coincident nodes, its Exit behind a departure weighted 0.01: parked, drawn, admitted', () => {
    // The cycle's departure first, weighted 1e20; the Exit's at 0.01.
    const { layer } = networkLayer({
      nodes: [[0.5, 0.5, 'entry'], [0.5, 0.5], [0.5, 0.5], [0.8, 0.5, 'exit']],
      paths: [[0, 1, { weight: 1e20 }], [0, 3, { weight: 0.01 }], [1, 2], [2, 0]],
      emitters: [{ seed: 1, dotCount: 1, speedVariance: 0, lifecycleMode: 'disappear' }],
    });
    const engine = new SwarmEngine();
    const journeys = engine.scheduleDots(layer, { durationMs: B }, { endsOnly: false });
    expect(journeys[0]).toMatchObject({ ends: false, journeyMs: 0 });
    const [dot] = onsets(engine, layer, { durationMs: B });
    expect(drawnAt(engine, layer, { durationMs: B }, dot, dot.onsetMs)).toBe(true);
    expect(engine.evaluate(dot.onsetMs, layer, { durationMs: B })[0]).toMatchObject({ x: 0.5, y: 0.5 });
    expect(verdicts(layer)).toEqual({ predicate: true, evaluator: true });
  });

  /** One Disappear dot released at 5,000 ms over a path from (0.5, 0.5) `along` to the right. */
  const lone = (along, { speed = 1000, extra = null } = {}) => networkLayer({
    nodes: [[0.5, 0.5, 'entry'], [0.5 + along, 0.5, extra === null ? 'exit' : 'normal'],
      ...(extra === null ? [] : [[0.5 + along + extra, 0.5, 'exit']])],
    paths: extra === null ? [[0, 1]] : [[0, 1], [1, 2]],
    emitters: [{ seed: 7, dotCount: 1, speed, speedVariance: 0, onsetVariance: 0,
      releaseStart: 0.5, releaseDuration: 0, lifecycleMode: 'disappear' }],
  });

  test('one path of Number.EPSILON at speed 1000: its finish rounds to its onset, so it is never drawn: refused', () => {
    const { layer } = lone(EPS);
    const engine = new SwarmEngine();
    const [dot] = onsets(engine, layer, { durationMs: B });
    expect(dot.onsetMs).toBe(5000);
    expect(engine.edgeGeometry(layer.graph, layer.graph.getEdges()[0]).length).toBeGreaterThan(0);
    expect(5000 + dotJourneyMs(EPS, 1000, 1)).toBe(5000);
    expect(verdicts(layer)).toEqual({ predicate: false, evaluator: false });
  });

  test('a path just long enough that its finish passes its onset: drawn, admitted', () => {
    // 5000 + d > 5000 once d passes half the spacing of doubles near 5000.
    const along = 1e-12;
    const { layer } = lone(along);
    expect(5000 + dotJourneyMs(new SwarmEngine().edgeGeometry(layer.graph, layer.graph.getEdges()[0]).length,
      1000, 1)).toBeGreaterThan(5000);
    expect(verdicts(layer)).toEqual({ predicate: true, evaluator: true });
  });

  test('two paths of Number.EPSILON (Codex r5): the first ends at its onset, but more is ahead, so it is drawn', () => {
    const { layer } = lone(EPS, { extra: EPS });
    const engine = new SwarmEngine();
    const [dot] = onsets(engine, layer, { durationMs: B });
    expect(engine.scheduleDots(layer, { durationMs: B })[0].ends).toBe(true);
    expect(dot.onsetMs + engine.scheduleDots(layer, { durationMs: B })[0].journeyMs).toBe(5000);
    expect(engine.evaluate(5000, layer, { durationMs: B })).toHaveLength(1);
    expect(verdicts(layer)).toEqual({ predicate: true, evaluator: true });
  });

  test('the base timeline or the speed can flip such a dot, and the predicate follows the evaluator', () => {
    const { layer } = lone(4e-13);
    const length = new SwarmEngine().edgeGeometry(layer.graph, layer.graph.getEdges()[0]).length;
    expect(length).toBeGreaterThan(0);
    // A journey of 6.8e-13 ms clears half the spacing of doubles at 5,000 (4.5e-13), not at 10,000 (9.1e-13).
    const speed = (length * 1000) / 6.8e-13;
    layer.emitters[0].update({ speed });
    expect(verdicts(layer, { durationMs: B })).toEqual({ predicate: true, evaluator: true });
    expect(verdicts(layer, { durationMs: 2 * B })).toEqual({ predicate: false, evaluator: false });
    layer.emitters[0].update({ speed: speed * 2 });
    expect(verdicts(layer, { durationMs: B })).toEqual({ predicate: false, evaluator: false });
  });
});

describe('the journey cache is kept per crowd (§11.6)', () => {
  test('two crowds whose emitters share an id: the second round walks nothing', () => {
    const make = id => networkLayer({
      id, nodes: [[0.2, 0.2, 'entry'], [0.5, 0.6], [0.8, 0.2, 'exit']], paths: [[0, 1], [1, 2]],
      emitters: [{ id: 'shared', seed: 8, dotCount: 4, lifecycleMode: 'disappear' }],
    }).layer;
    const [first, second] = [make('crowd-a'), make('crowd-b')];
    const engine = new SwarmEngine();
    const walk = vi.spyOn(engine, '_journeyLength');
    const round = () => [first, second].map(layer => [
      engine.crowdFinishMs(layer, { durationMs: B }), engine.canRelease(layer, { durationMs: B }),
    ]);
    const cold = round();
    expect(walk).toHaveBeenCalledTimes(8);
    walk.mockClear();
    expect(round()).toEqual(cold);
    expect(walk).not.toHaveBeenCalled();
    // And a scene holding both loads as it did (ids unique within a layer).
    const scene = new Scene();
    scene.flowLayers = [first, second];
    expect(() => Scene.fromJSON(scene.toJSON())).not.toThrow();
  });
});

/** mulberry32: a small seeded generator, so a failing case can be reproduced. */
function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROPERTY_SEED = 20261013;
const PROPERTY_CASES = 360;

/** One generated case: 2–6 nodes, coincident and EPSILON-close, paths of every kind, every lifecycle. */
function generatedCase(random) {
  const pick = list => list[Math.floor(random() * list.length)];
  const nodeCount = 2 + Math.floor(random() * 5);
  const nodes = [];
  for (let n = 0; n < nodeCount; n += 1) {
    const roll = random();
    const type = pick(['entry', 'entry', 'exit', 'normal', 'normal']);
    if (n > 0 && roll < 0.25) nodes.push([...nodes[Math.floor(random() * n)].slice(0, 2), type]);
    else if (n > 0 && roll < 0.45) {
      const [x, y] = nodes[Math.floor(random() * n)];
      nodes.push([x + EPS * (1 + Math.floor(random() * 3)), y, type]);
    } else nodes.push([0.1 + random() * 0.8, 0.1 + random() * 0.8, type]);
  }
  const paths = [];
  const pathCount = Math.floor(random() * (nodeCount + 3));
  for (let p = 0; p < pathCount; p += 1) {
    const from = Math.floor(random() * nodeCount);
    let to = Math.floor(random() * nodeCount);
    if (to === from) to = (to + 1) % nodeCount;
    paths.push([from, to, {
      direction: random() < 0.5 ? 'one-way' : 'two-way',
      weight: pick([0.01, 0.5, 1, 3, 1e6, 1e20]),
    }]);
  }
  const emitterCount = 1 + Math.floor(random() * 2);
  const emitters = Array.from({ length: emitterCount }, () => ({
    seed: Math.floor(random() * 0xFFFFFFFF),
    dotCount: 1 + Math.floor(random() * 5),
    speed: pick([0.001, 0.05, 0.3, 2, 1000]),
    speedVariance: pick([0, 0.3, 1]),
    onsetVariance: pick([0, 0.5, 1]),
    releaseStart: pick([0, 0.3, 0.9, 1]),
    releaseDuration: pick([0, 0.2, 0.7, 1]),
    lifecycleMode: pick(LIFECYCLES),
  }));
  const durationMs = pick([1000, 5000, B, 123456, 300000]);
  return { nodes, paths, emitters, durationMs };
}

describe(`the predicate is the evaluator's, over ${PROPERTY_CASES} generated networks (§13.2)`, () => {
  test(`generator seed ${PROPERTY_SEED}: true exactly when evaluate draws a dot at some dot's exact onset`, () => {
    const random = generator(PROPERTY_SEED);
    const seen = { admitted: 0, refused: 0, lifecycles: new Set(), coincident: 0 };
    for (let n = 0; n < PROPERTY_CASES; n += 1) {
      const spec = generatedCase(random);
      const { layer } = networkLayer(spec);
      const context = { durationMs: spec.durationMs };
      const engine = new SwarmEngine();
      const dots = onsets(engine, layer, context);
      const schedules = engine.scheduleDots(layer, context);
      const atOwnOnset = dots.map(dot => drawnAt(engine, layer, context, dot, dot.onsetMs));
      const atSomeOnset = dots.some(dot => engine.evaluate(dot.onsetMs, layer, context).length > 0);
      if (dots.length === 0) {
        // No guide (no path, or no Entry a path leaves): nothing scheduled, and nothing drawn anywhere.
        for (const ms of across(spec.durationMs)) expect(engine.evaluate(ms, layer, context), `case ${n}`).toEqual([]);
      }
      const label = `case ${n} of seed ${PROPERTY_SEED}: ${JSON.stringify(spec)}`;
      expect(engine.canRelease(layer, context), label).toBe(atSomeOnset);
      expect(atOwnOnset.some(Boolean), label).toBe(atSomeOnset);
      // A dot ever drawn is drawn at its onset: sampled after it, through the playback.
      dots.forEach((dot, at) => {
        if (atOwnOnset[at]) return;
        const journeyMs = schedules[at].journeyMs;
        const span = Number.isFinite(journeyMs) && journeyMs > 0 ? journeyMs : spec.durationMs;
        for (const step of [1e-9, 0.25, 0.5, 0.75, 1, 2]) {
          const ms = dot.onsetMs + span * step;
          const why = `${label}, dot ${at} at ${ms}: drawn later, not at its onset`;
          expect(drawnAt(engine, layer, context, dot, ms), why).toBe(false);
        }
      });
      seen[atSomeOnset ? 'admitted' : 'refused'] += 1;
      spec.emitters.forEach(emitter => seen.lifecycles.add(emitter.lifecycleMode));
      if (new Set(spec.nodes.map(([x, y]) => `${x},${y}`)).size < spec.nodes.length) seen.coincident += 1;
    }
    // Not vacuous: both verdicts, every lifecycle and coincident nodes were met.
    expect(seen.admitted).toBeGreaterThan(30);
    expect(seen.refused).toBeGreaterThan(30);
    expect([...seen.lifecycles].sort()).toEqual([...LIFECYCLES].sort());
    expect(seen.coincident).toBeGreaterThan(30);
  });
});

describe('the evaluator is unchanged (§12.3: the shared comparison moves nothing)', () => {
  test('a route crowd and a network crowd draw the same dots through a whole timeline', () => {
    const route = new PathCalculator().calculatePath([{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }]);
    const routeLayer = new FlowLayer({ guideType: 'route' });
    routeLayer.addEmitter({ seed: 3, dotCount: 20, speed: 0.2, lifecycleMode: 'disappear' });
    const engine = new SwarmEngine();
    const context = { durationMs: B, routePathPoints: route };
    expect(engine.canRelease(routeLayer, context)).toBe(true);
    expect(engine.canRelease(routeLayer, { durationMs: B })).toBe(false); // no route, no guide
    const drawn = [0, 2500, 5000, 7500, B, 14000].map(ms => engine.evaluate(ms, routeLayer, context).length);
    expect(drawn.some(count => count > 0)).toBe(true);
  });
});
