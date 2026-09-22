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
 */

import { describe, test, expect } from 'vitest';
import { RenderingService } from '../src/services/RenderingService.js';

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
