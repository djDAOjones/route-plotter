/**
 * TST-09 — routes and branches that end on a minor waypoint, characterised
 * as they stand.
 *
 * Timing is keyframed on majors, so a run of minors after the last major
 * belongs to no timing leg. Today that splits two regimes (DEF-11):
 *
 * - every leg at 1.0×: the engine times the whole path by its length, but the
 *   arrival map (`getRouteArrivalMap`, `buildRunLeg`) times only the majors'
 *   span and scales every arrival into it. A crowd bound to a waypoint is
 *   released at its arrival's share of that map, waits included, so with a
 *   wait on the route it leaves before the head gets there;
 * - any leg at another speed (1.01× here): the engine's segment markers also
 *   stop at the last major, so the route's duration collapses to that span,
 *   the head stalls at the last major and jumps to the end at the last
 *   instant;
 * - a branch ending on a minor runs its whole length in its majors' span.
 *
 * And at the last instant every host draws the head one path point short of
 * the end (`renderPathHead` reads index `n × progress`, so progress 1 is
 * point n − 2 at fraction 0), in Edit, Preview, a video export's last frame
 * and the HTML player alike.
 *
 * Pinned in `tests/goldens/domains-minor-end.json`. DEF-11's rule (a trailing
 * minor run is timed at the last major's speed, decided 2026-09-22) moves the
 * timing, head and arrival cases; the drawn head moves only if its index
 * arithmetic is changed.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { PlayerCore } from '../src/core/PlayerCore.js';
import { branchPathProgressAt } from '../src/utils/branchTiming.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { Scene } from '../src/models/Scene.js';
import { VideoExporter, createVideoFramePlan } from '../src/services/VideoExporter.js';
import { domainGolden, durationsOf, openProject, rounded } from './helpers/domainGoldens.js';

const pin = domainGolden('minor-end');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const still = { pauseMode: 'none', pauseTime: 0 };
const waypoint = (id, imgX, imgY, isMajor, extra = {}) => ({ id, imgX, imgY, isMajor, ...still, ...extra });

/**
 * `uniform`: a → b majors (b waits 1 s), then minors c and d to the end.
 * `faster`: the same without the wait, a's leg at 1.01×. `branch`: a → f → c majors; a branch from f
 * through x1 (major) to x2 (minor), where it ends.
 */
const ROUTES = {
  uniform: () => [waypoint('a', 0.1, 0.6, true), waypoint('b', 0.45, 0.4, true, { pauseMode: 'timed', pauseTime: 1000 }),
    waypoint('c', 0.75, 0.55, false), waypoint('d', 0.9, 0.3, false)],
  faster: () => [waypoint('a', 0.1, 0.6, true, { segmentSpeed: 1.01 }), waypoint('b', 0.45, 0.4, true),
    waypoint('c', 0.75, 0.55, false), waypoint('d', 0.9, 0.3, false)],
  branch: () => [waypoint('a', 0.1, 0.6, true), waypoint('f', 0.45, 0.4, true),
    waypoint('x1', 0.5, 0.15, true, { branchId: 'B', branchFrom: 'f' }),
    waypoint('x2', 0.75, 0.1, false, { branchId: 'B' }), waypoint('c', 0.9, 0.5, true)],
};

function project(name, scene = null) {
  return {
    coordVersion: 9,
    waypoints: ROUTES[name](),
    animationState: { mode: 'constant-speed', speed: 150 },
    ...(scene ? { scene } : {}),
  };
}

/** Where the head is at `ms`, from the engine's own timeline, touching nothing. */
function headAt(app, ms) {
  const engine = app.animationEngine;
  return PlayerCore.timelineToPath(ms, engine.getTimeline(), engine.getLiveTiming()).pathProgress;
}

/** Path length in canvas pixels, as timing measures it. */
function lengthPx(app, points) {
  return app.pathCalculator.calculatePathLength(points.map(point => app.imageToCanvas(point.x, point.y)));
}

const FRACTIONS = [0, 0.25, 0.5, 0.75, 0.9, 0.99, 0.999, 1];

describe('minor end — timing, the head and the arrival map', () => {

  for (const name of ['uniform', 'faster', 'branch']) {
    test(`${name}: the engine's timeline against the arrival map, and the head across it (DEF-11)`, async () => {
      const app = await openProject(project(name));
      const engine = app.animationEngine;
      const { B, F } = durationsOf(app);
      const arrivals = app.getRouteArrivalMap();
      const branched = app.getBranchTimeline();
      const result = {
        B, F,
        pathDurationMs: engine.pathDuration,
        trunkLengthPx: lengthPx(app, app.pathPoints),
        progressValues: app.getWaypointProgressValues(),
        segments: engine.segmentMarkers.map(({ startPathProgress, endPathProgress, duration }) =>
          [startPathProgress, endPathProgress, duration]),
        arrivalMsById: arrivals.arrivalMsById,
        arrivalTotalMs: arrivals.totalDurationMs,
        head: FRACTIONS.map(fraction => [fraction, headAt(app, fraction * B)]),
      };
      if (branched) {
        const branch = app.branchPaths[0];
        const placement = branched.legs.B;
        result.branch = {
          legs: branched.legs,
          lengthPx: lengthPx(app, branch.pathPoints),
          progressValues: branch.progressValues,
          // The branch's own progress across its leg, and the instant it ends.
          progress: FRACTIONS.map(fraction => [fraction, branchPathProgressAt(
            placement.startMs + fraction * placement.durationMs, placement, branched.legsById.B)]),
        };
      }
      pin(`${name}.timing`, rounded(result));

      if (name === 'uniform') {
        // The engine times the whole path; the arrival map, its wait aside, only the majors' share.
        expect(engine.pathDuration).toBeCloseTo(result.trunkLengthPx / 150 * 1000, 6);
        expect((arrivals.arrivalMsById.d - 1000) / engine.pathDuration).toBeCloseTo(result.progressValues[1], 6);
      }
      if (name === 'faster') {
        // The duration collapses to the majors' span, the head stalls there, then jumps.
        expect(B).toBeLessThan(0.5 * (result.trunkLengthPx / 150) * 1000);
        expect(headAt(app, 0.999 * B)).toBeLessThan(result.progressValues[1]);
        expect(headAt(app, B)).toBe(1);
      }
      if (name === 'branch') {
        // The branch covers its whole length in its majors' span: faster than the route's speed.
        expect(result.branch.legs.B.durationMs).toBeLessThan(0.6 * (result.branch.lengthPx / 150) * 1000);
      }
    });
  }

  test('uniform: a crowd bound to b leaves before the head reaches b; one bound to the route\'s end leaves at B (DEF-11)', async () => {
    const scene = new Scene();
    const layer = scene.addFlowLayer({ name: 'Bound', guideType: 'route' });
    const one = { dotCount: 1, speed: 0.2, onsetVariance: 0, releaseDuration: 0, lifecycleMode: 'disappear' };
    layer.addEmitter({ id: 'at-b', seed: 3, ...one, releaseAnchor: { waypointId: 'b', at: 'arrival' } });
    layer.addEmitter({ id: 'at-end', seed: 4, ...one, releaseAnchor: { waypointId: 'd', at: 'route-end' } });
    const app = await openProject(project('uniform', scene.toJSON()));
    const { B } = durationsOf(app);
    const schedules = app.swarmEngine.scheduleDots(app.scene.getFlowLayers()[0], {
      durationMs: B, routePathPoints: app.pathPoints, routeAnchors: app.getRouteArrivalMap(),
    });
    const [atB, atEnd] = schedules.map(dot => dot.onsetFraction * B);
    // The head reaches b where its wait starts.
    const reachesB = app.animationEngine.pauseMarkers[0].timelineStartMs;
    expect(headAt(app, reachesB)).toBe(app.getWaypointProgressValues()[1]);
    expect(atB).toBeLessThan(reachesB - 100);
    expect(atEnd).toBe(B);
    pin('uniform.boundReleases', rounded({ B, reachesB, atB, headAtB: headAt(app, atB), atEnd }));
  });

  test('faster: play == seek through the stall, and the jump comes only at B itself', async () => {
    const app = await openProject(project('faster'));
    const engine = app.animationEngine;
    const B = engine.state.baseDuration;
    const stalled = app.getWaypointProgressValues()[1];
    engine.seekToTime(0);
    engine.play();
    let frames = 0;
    while (engine.state.currentTime < B) {
      engine.updateAnimation(B / 50, 0);
      frames += 1;
      expect(headAt(app, engine.state.currentTime), `frame ${frames}`).toBe(engine.getPathProgress());
    }
    // Fifty steps of B / 50 fall a hair short of B, where the head is still stalled.
    expect(frames).toBe(51);
    expect(engine.getPathProgress()).toBe(1);
    expect(headAt(app, B * (1 - 1e-12))).toBeLessThan(stalled);
    expect(headAt(app, B)).toBe(1);
  });
});

describe('minor end — what each host draws at the last instant', () => {

  /** The heads drawn in one render, each as the path point it sits on. */
  function headsDrawn(host, render) {
    const draw = vi.spyOn(host.renderingService, 'drawPathHead');
    try {
      render();
      const runs = [{ id: 'trunk', points: host.pathPoints }, ...host.branchPaths.map(branch => ({ id: branch.id, points: branch.pathPoints }))];
      return draw.mock.calls.map(([, x, y]) => {
        for (const run of runs) {
          const index = run.points.findIndex(point => {
            const at = host.imageToCanvas(point.x, point.y);
            return Math.abs(at.x - x) < 1e-6 && Math.abs(at.y - y) < 1e-6;
          });
          if (index >= 0) return { run: run.id, point: index, of: run.points.length };
        }
        return { run: null, x, y };
      });
    } finally {
      draw.mockRestore();
    }
  }

  for (const name of ['uniform', 'branch']) {
    test(`${name}: Edit, Preview, the video export's last frame and the player draw the head one point short of the end`, async () => {
      const app = await openProject(project(name), { preview: false });
      const drawn = {};
      const lastInstant = host => () => {
        host.animationEngine.seekToTime(host.animationEngine.state.duration);
        host.render();
      };
      drawn.edit = headsDrawn(app, lastInstant(app));
      expect(app.animationEngine.getPathProgress()).toBe(1);

      app._setPreviewMode(true);
      app.invalidateAnimationTiming();
      drawn.preview = headsDrawn(app, lastInstant(app));

      const snapshot = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
      vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
      vi.stubGlobal('alert', vi.fn());
      app.videoExporter = {
        cancel() {},
        async export({ frameRate, duration, startBuffer, renderFrame }) {
          const plan = createVideoFramePlan({ frameRate, duration, startBuffer });
          // The last frame, as the export seeks and draws it, read again in export mode.
          await renderFrame(plan.sampleAt(plan.frameCount - 1).progress);
          drawn.exportLastFrame = headsDrawn(app, () => app.render());
          return new Blob(['video'], { type: 'video/mp4' });
        },
      };
      await app.exportVideo();

      const player = new PlayerApp(document.createElement('canvas'));
      await player.load(snapshot, app.background.image);
      drawn.player = headsDrawn(player, lastInstant(player));

      for (const heads of Object.values(drawn)) {
        for (const head of heads) expect(head.point).toBe(head.of - 2);
      }
      pin(`${name}.lastInstant`, drawn);
    });
  }
});
