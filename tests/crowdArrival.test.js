/**
 * COMPOSE-02 — waiting for a crowd, solved rather than watched.
 *
 * The property that matters is self-consistency: after the solved wait is
 * applied, the head must actually still be at the waypoint when the last dot
 * arrives. That is a stronger claim than "the number looks right", because
 * adding the wait lengthens the timeline and pushes every dot's release out
 * with it — the trap a naive difference falls into.
 *
 * The last block characterises DEF-12 in the booted app: where route time is
 * read as engine time, an anchored release, a branch's start and a fitted
 * wait drift by a reveal intro or a comet tail.
 */

import { describe, test, expect, vi } from 'vitest';
import {
  dotOnsetFraction, dotJourneyMs, lastArrivalMs, waitForCrowdMs,
} from '../src/utils/crowdArrival.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { Scene } from '../src/models/Scene.js';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';

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

    // No dot finishes. `every(...)` being false would also pass if only one
    // dot looped, so the predicate is `some`, over a crowd that has its dots.
    expect(schedules).toHaveLength(6);
    expect(schedules.some(dot => dot.finishes)).toBe(false);
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

/**
 * DEF-12 — route time read as engine time.
 *
 * The route's own timeline (`getRouteArrivalMap`, the composed branch
 * timeline) starts when the head leaves its first waypoint. The engine's
 * clock (`getTime()`) also runs through a reveal mode's 1 s intro first, and
 * in Preview its duration adds a comet trail's tail. Three paths read one as
 * the other: an anchored crowd's release (`releaseStartFraction` in
 * `routeAnchors.js`, scaled by the engine's duration in `SwarmEngine`), a
 * branch's start (`RenderingService.activeBranches`) and the wait
 * `fitRouteWaitToCrowd` solves (`crowds.js`). Each test pins what the booted
 * app does today, so the fix changes it on purpose, and says what it should
 * become.
 *
 * The route: a straight line timed at exactly 10 s, with no pauses, so the
 * head reaches a at 0 ms, b at 5,000 ms and c at 10,000 ms of route time.
 */
describe('DEF-12: route time read as engine time', () => {
  const still = { pauseMode: 'none', pauseTime: 0 };
  const LINE = [
    { id: 'a', imgX: 0.1, imgY: 0.5, isMajor: true, ...still },
    { id: 'b', imgX: 0.5, imgY: 0.5, isMajor: true, ...still },
    { id: 'c', imgX: 0.9, imgY: 0.5, isMajor: true, ...still },
  ];
  const REVEAL_INTRO = { backgroundVisibility: 'spotlight-reveal' };
  const COMET_TAIL = { pathVisibility: 'instantaneous', pathTrail: 0.2 };

  /** A route-guided crowd of one emitter, serialised for a project. */
  function crowd(emitter) {
    const scene = new Scene();
    scene.addFlowLayer({ name: 'Crowd', guideType: 'route' }).addEmitter({
      seed: 5, onsetVariance: 0, lifecycleMode: 'disappear', ...emitter,
    });
    return scene.toJSON();
  }

  /** One dot, released the moment the head reaches b. */
  const anchoredAtB = () => crowd({
    dotCount: 1, speed: 0.25, releaseDuration: 0, releaseAnchor: { waypointId: 'b', at: 'arrival' },
  });

  /** The booted app with a project loaded, its route timed at exactly 10 s. */
  async function appWith({ waypoints = LINE, scene = null, motionSettings = {} } = {}) {
    const app = await bootApp();
    await app.ready;
    expect(await loadSnapshot(app, { coordVersion: 9, waypoints, motionSettings, ...(scene ? { scene } : {}) }))
      .toBe(true);
    // The speed control rounds to 5 px/s, so the speed is set exactly instead.
    const lengthPx = app.pathCalculator.calculatePathLength(
      app.pathPoints.map(point => app.imageToCanvas(point.x, point.y)));
    app.animationEngine.state.speed = lengthPx / 10;
    app.invalidateAnimationTiming();
    expect(app.animationEngine.pathDuration).toBeCloseTo(10000, 6);
    return app;
  }

  /** A frame drawn at `ms` on the engine's clock: the head's place, the crowd's dots, the branch's place. */
  function frameAt(app, ms) {
    const evaluate = vi.spyOn(app.swarmEngine, 'evaluate');
    const branches = vi.spyOn(app.renderingService, 'activeBranches');
    app.animationEngine.seekToTime(ms);
    app.render();
    const frame = {
      head: app.animationEngine.getPathProgress(),
      dots: evaluate.mock.results.at(-1)?.value.length ?? null,
      branch: branches.mock.results.at(-1)?.value[0]?.engine.getPathProgress() ?? null,
    };
    evaluate.mockRestore();
    branches.mockRestore();
    return frame;
  }

  test('with neither an intro nor a tail, an anchored crowd leaves as the head reaches its waypoint', async () => {
    const app = await appWith({ scene: anchoredAtB() });

    const before = frameAt(app, 4999);
    const after = frameAt(app, 5001);
    expect(before.dots).toBe(0);
    expect(before.head).toBeCloseTo(0.4999, 9);
    expect(after.dots).toBe(1);
    expect(after.head).toBeCloseTo(0.5001, 9);
  });

  test('DEF-12: under a reveal intro, an anchored crowd leaves 500 ms before the head reaches its waypoint', async () => {
    const app = await appWith({ scene: anchoredAtB(), motionSettings: REVEAL_INTRO });
    expect(app.animationEngine.introTime).toBe(1000);

    // Released at b's 5,000 ms of route time, as a fraction of a 10 s route,
    // scaled by the engine's 11 s: 5,500 ms, while the head is at 45%.
    expect(frameAt(app, 5499).dots).toBe(0);
    const released = frameAt(app, 5501);
    expect(released.dots).toBe(1);
    expect(released.head).toBeCloseTo(0.4501, 9);
    // The head reaches b at 6,000 ms, which is when the fix releases it.
    expect(frameAt(app, 5999).head).toBeCloseTo(0.4999, 9);
    expect(frameAt(app, 6001).head).toBeCloseTo(0.5001, 9);
  });

  test('DEF-12: under a comet tail, an anchored crowd leaves 1,250 ms after the head passes its waypoint', async () => {
    const app = await appWith({ scene: anchoredAtB(), motionSettings: COMET_TAIL });
    expect(app.previewMode).toBe(true);
    expect(app.animationEngine.totalTailTime).toBe(2500);

    // The head passes b at 5,000 ms, which is when the fix releases it; the
    // release waits for half of the engine's 12.5 s.
    expect(frameAt(app, 4999).head).toBeCloseTo(0.4999, 9);
    expect(frameAt(app, 5001).head).toBeCloseTo(0.5001, 9);
    expect(frameAt(app, 6249).dots).toBe(0);
    const released = frameAt(app, 6251);
    expect(released.dots).toBe(1);
    expect(released.head).toBeCloseTo(0.6251, 9);
  });

  test('DEF-12: under a reveal intro, a branch starts 1,000 ms before the head reaches its fork', async () => {
    const app = await appWith({
      waypoints: [
        { id: 'a', imgX: 0.1, imgY: 0.5, isMajor: true, ...still },
        { id: 'f', imgX: 0.5, imgY: 0.5, isMajor: true, ...still },
        { id: 'x', imgX: 0.5, imgY: 0.1, isMajor: true, branchId: 'B', branchFrom: 'f', ...still },
        { id: 'c', imgX: 0.9, imgY: 0.5, isMajor: true, ...still },
      ],
      motionSettings: REVEAL_INTRO,
    });
    expect(app.getBranchTimeline().legs.B.startMs).toBe(5000);

    // The branch starts at its fork's 5,000 ms of route time, read on the
    // engine's clock: it moves from 5,001 ms, with the head at 40%.
    expect(frameAt(app, 5000).branch).toBe(0);
    const started = frameAt(app, 5001);
    expect(started.branch).toBeGreaterThan(0);
    expect(started.head).toBeCloseTo(0.4001, 9);
    // The head reaches the fork, f at 50%, at 6,000 ms, when the fix starts
    // the branch; by then the branch is a fifth of the way along.
    expect(frameAt(app, 5999).head).toBeCloseTo(0.4999, 9);
    const atFork = frameAt(app, 6000);
    expect(atFork.head).toBeCloseTo(0.5, 9);
    expect(atFork.branch).toBeCloseTo(0.2, 9);
  });

  test('DEF-12: under a reveal intro, a fitted wait holds the head 1,000 ms after the crowd arrives', async () => {
    /** The head's wait at c, measured on the engine's clock, minus the crowd's last arrival. */
    async function lingerAfterFit(motionSettings) {
      const app = await appWith({
        scene: crowd({ dotCount: 4, speed: 0.1, releaseStart: 0.3, releaseDuration: 0.2 }),
        motionSettings,
      });
      const [layer] = app.scene.getFlowLayers();
      const c = app.waypoints[2];
      expect(app.fitRouteWaitToCrowd(layer, c)).toBe(true);
      expect(c.pauseMode).toBe('timed');

      // The head reaches c after the intro and the 10 s route, then waits.
      const reachesC = app.animationEngine.introTime + 10000;
      expect(frameAt(app, reachesC - 1).head).toBeLessThan(1);
      expect(frameAt(app, reachesC + 1).head).toBe(1);
      const durationMs = app.animationEngine.state.duration;
      expect(durationMs).toBeCloseTo(reachesC + c.pauseTime, 6);

      // The crowd's last arrival, from the schedule that agrees with the dots
      // drawn (above), given what the renderer gives `evaluate`.
      const schedules = app.swarmEngine.scheduleDots(layer, {
        durationMs, routePathPoints: app.pathPoints, routeAnchors: app.getRouteArrivalMap(),
      });
      return reachesC + c.pauseTime - lastArrivalMs(schedules, durationMs).ms;
    }

    // Without an intro the wait ends within its 1 ms rounding of the arrival.
    const plain = await lingerAfterFit({});
    expect(plain).toBeGreaterThanOrEqual(0);
    expect(plain).toBeLessThan(1);
    // The solve reads the head's arrival in route time, 1,000 ms early on the
    // engine's clock, so the head waits that much longer; the fix makes it
    // the same as without the intro.
    const intro = await lingerAfterFit(REVEAL_INTRO);
    expect(intro).toBeGreaterThanOrEqual(1000);
    expect(intro).toBeLessThan(1001);
  });
});
