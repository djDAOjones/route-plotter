/**
 * BUG-01 — the path head must survive a wait that belongs to another run.
 *
 * A branched hero route renders each run with its own waypoint sub-array, but
 * `pauseWaypointIndex` indexes the *whole* route. When the branch run is
 * shorter than that index, `getHeadDirection` read past the end of the array
 * and threw on `undefined.imgX`, taking video export down with it and
 * throwing on the final preview frame.
 *
 * `MotionVisibilityService` already guards the identical calculation with
 * `pauseWaypointIndex < waypoints.length`; this is the same contract for the
 * renderer's copy. Out of range means "this wait is not ours", so the run
 * falls through to its own path-based direction rather than crashing.
 *
 * The last block is CON-09's baseline: the two copies of the calculation
 * agree, a curved path's directions under a zoom are pinned, and a wait index
 * in range is read as the run's own, which DEF-05 changes.
 */

import { describe, test, expect, vi } from 'vitest';
import { RenderingService } from '../src/services/RenderingService.js';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';

/** A minimal engine stub: only what getHeadDirection reads. */
function engineStub({ progress, waitingIndex }) {
  return {
    getPathProgress: () => progress,
    state: {
      isWaitingAtWaypoint: waitingIndex >= 0,
      pauseWaypointIndex: waitingIndex,
    },
  };
}

const wp = (imgX, imgY) => ({ imgX, imgY });

/** Straight west-to-east path, so the expected direction is a known 0 rad. */
const pathPoints = [
  { x: 0.1, y: 0.5 },
  { x: 0.4, y: 0.5 },
  { x: 0.7, y: 0.5 },
  { x: 0.9, y: 0.5 },
];

describe('getHeadDirection with a branch run', () => {
  const renderer = new RenderingService();

  test('a wait indexed past the end of this run does not throw', () => {
    // The exact shape observed live: the branch run carries three waypoints
    // while the route-level wait sits at index 4 of six.
    const branchRun = [wp(0.1, 0.5), wp(0.5, 0.5), wp(0.9, 0.5)];
    const engine = engineStub({ progress: 1, waitingIndex: 4 });

    expect(() => renderer.getHeadDirection(pathPoints, engine, null, branchRun))
      .not.toThrow();
  });

  test('it falls through to this run’s own path direction', () => {
    const branchRun = [wp(0.1, 0.5), wp(0.5, 0.5), wp(0.9, 0.5)];
    const outOfRange = renderer.getHeadDirection(
      pathPoints, engineStub({ progress: 1, waitingIndex: 4 }), null, branchRun);
    const notWaiting = renderer.getHeadDirection(
      pathPoints, engineStub({ progress: 1, waitingIndex: -1 }), null, branchRun);

    // Out of range means "not our wait", so both answer identically.
    expect(outOfRange).toBe(notWaiting);
    expect(outOfRange).toBeCloseTo(0, 6); // due east along a flat path
  });

  test('an in-range wait still uses the waypoint pair, not the path', () => {
    // The guard must not disable the behaviour it protects: a wait this run
    // does own still steers from the previous waypoint to the current one.
    const run = [wp(0.5, 0.5), wp(0.5, 0.9)]; // second leg points due south
    const direction = renderer.getHeadDirection(
      pathPoints, engineStub({ progress: 0.5, waitingIndex: 1 }), null, run);

    expect(direction).toBeCloseTo(Math.PI / 2, 6);
  });

  test('a wait at the first waypoint still steers toward the next', () => {
    const run = [wp(0.5, 0.5), wp(0.9, 0.5)];
    const direction = renderer.getHeadDirection(
      pathPoints, engineStub({ progress: 0, waitingIndex: 0 }), null, run);

    expect(direction).toBeCloseTo(0, 6);
  });
});

/**
 * CON-09 — the head's direction is calculated twice.
 *
 * `RenderingService.getHeadDirection` turns the path head and
 * `MotionVisibilityService.buildAOVRevealMask` aims the angle-of-view cone;
 * they share their primitives by copy, and the copies have drifted before
 * (BUG-01, above). CON-09 moves the primitives into one module. The parity and
 * the golden are what that move must keep; the wait index's ownership is what
 * DEF-05 changes.
 */
describe('CON-09: the head direction baseline', () => {
  const still = { pauseMode: 'none', pauseTime: 0 };
  const WAITS = { pauseMode: 'timed', pauseTime: 2000 };

  /** The booted app with a route loaded, its trunk timed at 10 s, and its one wait half done. */
  async function waitingApp(waypoints, motionSettings = {}) {
    const app = await bootApp();
    await app.ready;
    expect(await loadSnapshot(app, { coordVersion: 9, waypoints, motionSettings })).toBe(true);
    // Where a branch's head is during the trunk's wait depends on the speed,
    // which the speed control rounds; set it exactly, and settle the timeline
    // a load debounces.
    const lengthPx = app.pathCalculator.calculatePathLength(
      app.pathPoints.map(point => app.imageToCanvas(point.x, point.y)));
    app.animationEngine.state.speed = lengthPx / 10;
    app.invalidateAnimationTiming();
    const [wait] = app.animationEngine.pauseMarkers;
    app.animationEngine.seekToTime((wait.timelineStartMs + wait.timelineEndMs) / 2);
    expect(app.animationEngine.state.isWaitingAtWaypoint).toBe(true);
    return app;
  }

  /** The canvas angle from one image point to another. */
  const angle = (app, [x1, y1], [x2, y2]) => {
    const from = app.imageToCanvas(x1, y1);
    const to = app.imageToCanvas(x2, y2);
    return Math.atan2(to.y - from.y, to.x - from.x);
  };

  test('CON-09: while the head waits, the path head and the angle-of-view cone point the same way', async () => {
    const app = await waitingApp([
      { id: 'a', imgX: 0.1, imgY: 0.6, isMajor: true, ...still },
      { id: 'f', imgX: 0.3, imgY: 0.6, isMajor: true, ...still },
      { id: 'm', imgX: 0.5, imgY: 0.3, isMajor: true, ...WAITS },
      { id: 'c', imgX: 0.9, imgY: 0.6, isMajor: true, ...still },
    ], { backgroundVisibility: 'angle-of-view-reveal' });
    const direction = vi.spyOn(app.renderingService, 'getHeadDirection');

    app.render();

    // Both hold the incoming leg, f to m, until the wait ends.
    const incoming = angle(app, [0.3, 0.6], [0.5, 0.3]);
    expect(direction.mock.results.map(result => result.value)).toEqual([expect.closeTo(incoming, 9)]);
    // The cone is the mask's last arc, centred on its direction.
    const cone = app.motionVisibilityService.revealMaskCtx.calls.filter(([name]) => name === 'arc').at(-1);
    expect((cone[4] + cone[5]) / 2).toBeCloseTo(incoming, 9);
  });

  test('CON-09: a curved path\'s head directions under a zoomed, panned transform', () => {
    const renderer = new RenderingService();
    const curve = s => 0.5 + 0.3 * Math.sin(s * Math.PI * 1.5);
    const pathPoints = Array.from({ length: 41 }, (_, index) => ({ x: 0.1 + 0.02 * index, y: curve(index / 40) }));
    const waypoints = [{ imgX: 0.1, imgY: curve(0) }, { imgX: 0.5, imgY: curve(0.5) }, { imgX: 0.9, imgY: curve(1) }];
    // 2× on a 1280×720 canvas, panned, so x and y scale differently.
    const zoomed = (x, y) => ({ x: 677 + (x - 0.5) * 2560, y: 339 + (y - 0.5) * 1440 });

    const directions = [0.05, 0.2, 0.35, 0.49, 0.5, 0.51, 0.65, 0.8, 0.95].map(progress => renderer.getHeadDirection(
      pathPoints, engineStub({ progress, waitingIndex: -1 }), [0, 0.5, 1], waypoints, 1, 1, zoomed));

    expect(directions.map(value => Number(value.toFixed(6)))).toEqual([
      0.777341, 0.611895, 0.07245, 0.289906, 0.289906, 0.081105, -0.766709, -0.712613, -0.330404,
    ]);
  });

  test('CON-09 (DEF-05): while the trunk waits, a wait index in range of any run steers it', async () => {
    // The trunk is a, f, m, c and waits at m, its index 2. Branch B leaves f
    // north to x1, then east to x2; its run is f, x1, x2.
    const app = await waitingApp([
      { id: 'a', imgX: 0.1, imgY: 0.5, isMajor: true, ...still },
      { id: 'f', imgX: 0.3, imgY: 0.5, isMajor: true, ...still },
      { id: 'x1', imgX: 0.3, imgY: 0.1, isMajor: true, branchId: 'B', branchFrom: 'f', ...still },
      { id: 'x2', imgX: 0.6, imgY: 0.1, isMajor: true, branchId: 'B', ...still },
      { id: 'm', imgX: 0.5, imgY: 0.5, isMajor: true, ...WAITS },
      { id: 'c', imgX: 0.9, imgY: 0.5, isMajor: true, ...still },
    ]);
    expect(app.animationEngine.state.pauseWaypointIndex).toBe(2);
    const direction = vi.spyOn(app.renderingService, 'getHeadDirection');

    app.render();

    const [branch] = app.branchPaths;
    const callFor = points => direction.mock.calls.findIndex(([pathPoints]) => pathPoints === points);
    const trunkCall = callFor(app.pathPoints);
    const branchCall = callFor(branch.pathPoints);
    // The trunk's head is handed the whole route, where index 2 is x1, so it
    // points north up the branch's first leg instead of east along f to m.
    expect(direction.mock.calls[trunkCall][3].map(waypoint => waypoint.id)).toEqual(['a', 'f', 'x1', 'x2', 'm', 'c']);
    expect(direction.mock.results[trunkCall].value).toBeCloseTo(angle(app, [0.3, 0.5], [0.3, 0.1]), 9);
    // The branch's run has an index 2 too, x2, so its head points east from
    // x1 to x2 while it is still climbing north from f.
    expect(direction.mock.calls[branchCall][3].map(waypoint => waypoint.id)).toEqual(['f', 'x1', 'x2']);
    expect(direction.mock.results[branchCall].value).toBeCloseTo(angle(app, [0.3, 0.1], [0.6, 0.1]), 9);
    // Its own way, at the same place without the wait, is north.
    const [points, facade, progressValues, runWaypoints, , , imageToCanvas] = direction.mock.calls[branchCall];
    expect(facade.getPathProgress()).toBeCloseTo(0.4, 2);
    const ownWay = app.renderingService.getHeadDirection(points,
      engineStub({ progress: facade.getPathProgress(), waitingIndex: -1 }),
      progressValues, runWaypoints, 1, 1, imageToCanvas);
    expect(ownWay).toBeCloseTo(-Math.PI / 2, 2);
  });
});
