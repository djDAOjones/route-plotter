/**
 * COMPOSE-02 — waiting for a crowd, solved rather than watched.
 *
 * The property that matters is self-consistency: after the solved wait is
 * applied, the head must actually still be at the waypoint when the last dot
 * arrives. That is a stronger claim than "the number looks right", because
 * adding the wait lengthens the timeline and pushes every dot's release out
 * with it — the trap a naive difference falls into.
 */

import { describe, test, expect } from 'vitest';
import {
  dotOnsetFraction, dotJourneyMs, dotsReachingJourneyEnd, lastArrivalMs, waitForCrowdMs,
} from '../src/utils/crowdArrival.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { Scene } from '../src/models/Scene.js';

const flat = value => value;

describe('dotOnsetFraction', () => {
  const base = {
    index: 0, dotCount: 4, onsetHash: 0.5, onsetVariance: 0,
    intensityRamp: 0, sampleEnvelope: flat, windowStart: 0, windowSpan: 1,
  };

  test('zero variance spreads dots evenly across the window', () => {
    const spread = [0, 1, 2, 3].map(index => dotOnsetFraction({ ...base, index }));

    expect(spread).toEqual([0.125, 0.375, 0.625, 0.875]);
  });

  test('full variance hands the dot straight to its hash draw', () => {
    expect(dotOnsetFraction({ ...base, onsetVariance: 1, onsetHash: 0.9 })).toBeCloseTo(0.9, 9);
  });

  test('the window start and span place the result inside the window', () => {
    const value = dotOnsetFraction({ ...base, windowStart: 0.5, windowSpan: 0.25 });

    expect(value).toBeGreaterThanOrEqual(0.5);
    expect(value).toBeLessThanOrEqual(0.75);
  });

  test('a back-loaded ramp pushes a dot later, a front-loaded one earlier', () => {
    const neutral = dotOnsetFraction({ ...base, index: 1 });

    expect(dotOnsetFraction({ ...base, index: 1, intensityRamp: 1 })).toBeGreaterThan(neutral);
    expect(dotOnsetFraction({ ...base, index: 1, intensityRamp: -1 })).toBeLessThan(neutral);
  });
});

describe('dotJourneyMs', () => {
  test('distance over speed, in milliseconds', () => {
    expect(dotJourneyMs(1, 0.5, 1)).toBe(2000);
    expect(dotJourneyMs(1, 0.5, 2)).toBe(1000);
  });

  test('a stalled or zero-length journey takes no time rather than forever', () => {
    expect(dotJourneyMs(1, 0, 1)).toBe(0);
    expect(dotJourneyMs(0, 1, 1)).toBe(0);
  });
});

describe('lastArrivalMs', () => {
  test('the latest finisher sets the time', () => {
    const schedules = [
      { onsetFraction: 0.1, journeyMs: 1000, finishes: true },
      { onsetFraction: 0.5, journeyMs: 1000, finishes: true },
    ];

    expect(lastArrivalMs(schedules, 10000)).toEqual({
      ms: 6000, allFinish: true, finishingDots: 2,
    });
  });

  test('dots that never finish are excluded and flagged', () => {
    const schedules = [
      { onsetFraction: 0.1, journeyMs: 1000, finishes: true },
      { onsetFraction: 0.9, journeyMs: 9000, finishes: false },
    ];
    const result = lastArrivalMs(schedules, 10000);

    expect(result.ms).toBe(2000);
    expect(result.allFinish).toBe(false);
    expect(result.finishingDots).toBe(1);
  });

  test('an empty crowd arrives at zero', () => {
    expect(lastArrivalMs([], 10000)).toEqual({ ms: 0, allFinish: true, finishingDots: 0 });
  });
});

describe('waitForCrowdMs solves for a wait that actually holds', () => {
  /** Re-derive the crowd's last arrival with the solved wait applied. */
  const lastArrivalAfter = (schedules, durationMs, currentWaitMs, waitMs) =>
    lastArrivalMs(schedules, durationMs - currentWaitMs + waitMs).ms;

  test('the solved wait still holds once the timeline grows under it', () => {
    // The trap: adding P lengthens the timeline, so onsets (fractions of it)
    // move out too. A naive "arrival minus now" undershoots.
    const schedules = [{ onsetFraction: 0.8, journeyMs: 1000, finishes: true }];
    const durationMs = 10000;
    const arrivalMs = 6000;

    const naive = lastArrivalMs(schedules, durationMs).ms - arrivalMs; // 3000
    const solved = waitForCrowdMs({ schedules, arrivalMs, durationMs });

    expect(solved.satisfiable).toBe(true);
    expect(solved.waitMs).toBeGreaterThan(naive);
    // The real test: with the solved wait applied, the head is still there.
    expect(arrivalMs + solved.waitMs)
      .toBeGreaterThanOrEqual(lastArrivalAfter(schedules, durationMs, 0, solved.waitMs) - 1e-6);
    // …and the naive answer is not.
    expect(arrivalMs + naive)
      .toBeLessThan(lastArrivalAfter(schedules, durationMs, 0, naive) - 1e-6);
  });

  test('a crowd that already finishes early needs no wait', () => {
    const schedules = [{ onsetFraction: 0.1, journeyMs: 100, finishes: true }];

    expect(waitForCrowdMs({ schedules, arrivalMs: 9000, durationMs: 10000 }))
      .toEqual({ waitMs: 0, satisfiable: true, reason: null });
  });

  test('the slowest dot sets the wait, not the average', () => {
    const one = [{ onsetFraction: 0.2, journeyMs: 500, finishes: true }];
    const two = [...one, { onsetFraction: 0.6, journeyMs: 4000, finishes: true }];

    expect(waitForCrowdMs({ schedules: two, arrivalMs: 1000, durationMs: 10000 }).waitMs)
      .toBeGreaterThan(waitForCrowdMs({ schedules: one, arrivalMs: 1000, durationMs: 10000 }).waitMs);
  });

  test('an existing wait is replaced, not added to', () => {
    const schedules = [{ onsetFraction: 0.5, journeyMs: 1000, finishes: true }];
    const fresh = waitForCrowdMs({ schedules, arrivalMs: 2000, durationMs: 10000, currentWaitMs: 0 });
    const refit = waitForCrowdMs({
      schedules, arrivalMs: 2000, durationMs: 10000 + fresh.waitMs, currentWaitMs: fresh.waitMs,
    });

    // Fitting twice must land on the same number, or every refit would creep.
    expect(refit.waitMs).toBeCloseTo(fresh.waitMs, 6);
  });

  test('a crowd whose dots never finish is refused with a reason', () => {
    const schedules = [{ onsetFraction: 0.2, journeyMs: 500, finishes: false }];
    const solved = waitForCrowdMs({ schedules, arrivalMs: 1000, durationMs: 10000 });

    expect(solved.satisfiable).toBe(false);
    expect(solved.reason).toContain('never finish');
  });

  test('a dot released at the very end can never be waited for', () => {
    const schedules = [{ onsetFraction: 1, journeyMs: 500, finishes: true }];
    const solved = waitForCrowdMs({ schedules, arrivalMs: 1000, durationMs: 10000 });

    expect(solved.satisfiable).toBe(false);
    expect(solved.reason).toContain('very end of the timeline');
  });

  test('an empty crowd is refused rather than answered with zero', () => {
    expect(waitForCrowdMs({ schedules: [], arrivalMs: 0, durationMs: 10000 }).satisfiable)
      .toBe(false);
  });
});

describe('SwarmEngine.scheduleDots', () => {
  const routePoints = Array.from({ length: 40 }, (_, i) => ({ x: i / 39, y: 0.5 }));
  const routeLayer = (emitterOptions = {}) => {
    const scene = new Scene();
    const layer = scene.addFlowLayer({ name: 'Crowd', guideType: 'route' });
    layer.addEmitter({ seed: 5, dotCount: 6, speed: 0.25, releaseStart: 0.1,
      releaseDuration: 0.5, ...emitterOptions });
    return layer;
  };

  test('one schedule per dot, all finishing on a disappear lifecycle', () => {
    const schedules = new SwarmEngine().scheduleDots(routeLayer({ lifecycleMode: 'disappear' }), {
      durationMs: 10000, routePathPoints: routePoints,
    });

    expect(schedules).toHaveLength(6);
    expect(schedules.every(dot => dot.finishes)).toBe(true);
    expect(schedules.every(dot => dot.journeyMs > 0)).toBe(true);
  });

  test('a looping crowd has no arrival to wait for', () => {
    const schedules = new SwarmEngine().scheduleDots(routeLayer({ lifecycleMode: 'loop' }), {
      durationMs: 10000, routePathPoints: routePoints,
    });

    expect(schedules.every(dot => dot.finishes)).toBe(false);
  });

  test('the schedule agrees with when dots actually appear', () => {
    const engine = new SwarmEngine();
    const layer = routeLayer({ lifecycleMode: 'disappear', onsetVariance: 0 });
    const context = { durationMs: 10000, routePathPoints: routePoints };
    const schedules = engine.scheduleDots(layer, context);
    const firstOnsetMs = Math.min(...schedules.map(dot => dot.onsetFraction)) * 10000;

    // Nothing before the first scheduled onset; something just after it.
    expect(engine.evaluate(firstOnsetMs - 1, layer, context)).toHaveLength(0);
    expect(engine.evaluate(firstOnsetMs + 1, layer, context).length).toBeGreaterThan(0);
  });

  test('scheduling is deterministic', () => {
    const engine = new SwarmEngine();
    const layer = routeLayer();
    const context = { durationMs: 10000, routePathPoints: routePoints };

    expect(engine.scheduleDots(layer, context)).toEqual(engine.scheduleDots(layer, context));
  });

  test('a layer with no usable guide schedules nothing', () => {
    const engine = new SwarmEngine();

    expect(engine.scheduleDots(routeLayer(), { durationMs: 10000, routePathPoints: [] })).toEqual([]);
    expect(engine.scheduleDots(routeLayer(), { durationMs: 0, routePathPoints: routePoints })).toEqual([]);
    expect(engine.scheduleDots(null, { durationMs: 10000 })).toEqual([]);
  });

  test('a graph crowd schedules each dot by its own walk', () => {
    const scene = new Scene();
    const layer = scene.addFlowLayer({ name: 'Crowd', guideType: 'graph' });
    const entry = layer.graph.addNode({ x: 0, y: 0, type: 'entry' });
    const near = layer.graph.addNode({ x: 0.2, y: 0, type: 'exit' });
    const far = layer.graph.addNode({ x: 1, y: 1, type: 'exit' });
    layer.graph.addEdge({ sourceId: entry.id, targetId: near.id });
    layer.graph.addEdge({ sourceId: entry.id, targetId: far.id });
    layer.addEmitter({ seed: 3, dotCount: 12, speed: 0.25, lifecycleMode: 'disappear' });

    const schedules = new SwarmEngine().scheduleDots(layer, { durationMs: 10000 });
    const journeys = new Set(schedules.map(dot => Math.round(dot.journeyMs)));

    // Two routes of different length, so the crowd must show two journey times.
    expect(schedules).toHaveLength(12);
    expect(journeys.size).toBeGreaterThan(1);
  });
});

describe('a walk that runs out of hops reaches no journey end (DEF-77)', () => {
  const DURATION = 60000;
  /**
   * The review's closed triangle: three pass-through nodes, three two-way
   * paths, no Entry and no Exit. With `exitPath`, a path off on its own whose
   * far end is an Exit; `entries` types the triangle's corners as Entries,
   * so no dot sets off anywhere else.
   */
  function triangleLayer({ entries = false, exitPath = false, ...emitterOptions } = {}) {
    const layer = new Scene().addFlowLayer({ name: 'Crowd', guideType: 'graph' });
    const { graph } = layer;
    const type = entries ? 'entry' : 'normal';
    const corners = [[0.1, 0.1], [0.12, 0.1], [0.1, 0.12]]
      .map(([x, y]) => graph.addNode({ x, y, type }));
    corners.forEach((node, index) => graph.addEdge({
      sourceId: node.id, targetId: corners[(index + 1) % 3].id, direction: 'two-way',
    }));
    if (exitPath) {
      const start = graph.addNode({ x: 0.5, y: 0.5 });
      const exit = graph.addNode({ x: 0.9, y: 0.5, type: 'exit' });
      graph.addEdge({ sourceId: start.id, targetId: exit.id, direction: 'two-way' });
    }
    layer.addEmitter({
      seed: 5, dotCount: 1, speed: 1, speedVariance: 0, onsetVariance: 0,
      releaseStart: 0, releaseDuration: 0, lifecycleMode: 'disappear', ...emitterOptions,
    });
    return layer;
  }

  test('only a dot that ends is counted', () => {
    const dot = { onsetFraction: 0, journeyMs: 1000, finishes: true };

    expect(dotsReachingJourneyEnd([{ ...dot, ends: true }], 10000)).toBe(1);
    expect(dotsReachingJourneyEnd([{ ...dot, ends: false }], 10000)).toBe(0);
  });

  test('the review\'s closed triangle: one dot, released at once, at Speed 1 does not end', () => {
    // Its walk ran out of hops 46.6 s in, which was counted as reaching its
    // end: the hint went, though Disappear still showed the dot.
    const engine = new SwarmEngine();
    const layer = triangleLayer();
    const [dot] = engine.scheduleDots(layer, { durationMs: DURATION });

    expect(dot.ends).toBe(false);
    expect(dot.journeyMs).toBeLessThan(DURATION); // in time, had it been an end
    expect(dotsReachingJourneyEnd([dot], DURATION)).toBe(0);
    expect(engine.evaluate(DURATION, layer, { durationMs: DURATION })).toHaveLength(1);

    // Read for the hint alone, the walk is not taken at all; the crowd wait
    // still has the distance walked.
    expect(engine.scheduleDots(layer, { durationMs: DURATION }, { endsOnly: true }))
      .toEqual([{ ...dot, journeyMs: Infinity }]);
  });

  test('an Exit no Entry leads to ends no journey; set off beside it, dots do end', () => {
    const engine = new SwarmEngine();
    const context = { durationMs: DURATION };
    const crowd = { dotCount: 60, speedVariance: 0.2, onsetVariance: 0.2, releaseDuration: 0.5 };

    const stranded = triangleLayer({ entries: true, exitPath: true, ...crowd });
    for (const options of [{}, { endsOnly: true }]) {
      const schedules = engine.scheduleDots(stranded, context, options);
      expect(schedules).toHaveLength(60);
      expect(schedules.every(dot => !dot.ends)).toBe(true);
      expect(dotsReachingJourneyEnd(schedules, DURATION)).toBe(0);
    }

    // Without Entries every node with a path is one, so some dots set off on
    // the Exit's own path, and those are the ones counted.
    const mixed = triangleLayer({ exitPath: true, ...crowd });
    const schedules = engine.scheduleDots(mixed, context);
    const ending = schedules.filter(dot => dot.ends);
    expect(ending.length).toBeGreaterThan(0);
    expect(ending.length).toBeLessThan(60);
    expect(dotsReachingJourneyEnd(schedules, DURATION)).toBe(ending.length);
    expect(dotsReachingJourneyEnd(engine.scheduleDots(mixed, context, { endsOnly: true }), DURATION))
      .toBe(ending.length);
  });

  test('a network with a reachable end still counts its dots', () => {
    const layer = new Scene().addFlowLayer({ name: 'Crowd', guideType: 'graph' });
    const entry = layer.graph.addNode({ x: 0, y: 0, type: 'entry' });
    const near = layer.graph.addNode({ x: 0.2, y: 0, type: 'exit' });
    const far = layer.graph.addNode({ x: 1, y: 1, type: 'exit' });
    layer.graph.addEdge({ sourceId: entry.id, targetId: near.id });
    layer.graph.addEdge({ sourceId: entry.id, targetId: far.id });
    layer.addEmitter({ seed: 3, dotCount: 12, speed: 0.25, lifecycleMode: 'respawn' });

    const schedules = new SwarmEngine().scheduleDots(layer, { durationMs: 10000 });
    const inTime = schedules.filter(dot => dot.onsetFraction * 10000 + dot.journeyMs <= 10000);

    expect(schedules.every(dot => dot.ends)).toBe(true);
    expect(inTime.length).toBeGreaterThan(0);
    expect(dotsReachingJourneyEnd(schedules, 10000)).toBe(inTime.length);
  });
});
