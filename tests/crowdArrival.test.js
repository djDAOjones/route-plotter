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
  dotOnsetFraction, dotJourneyMs, lastArrivalMs, waitForCrowdMs,
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
