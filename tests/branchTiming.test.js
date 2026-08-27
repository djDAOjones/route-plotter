/**
 * ROUTE-01b — branch geometry, per-branch timing and the branch render pass.
 *
 * The invariant under most pressure here is that a branch resolves its
 * position through the SAME `PlayerCore.timelineToPath` the trunk uses. A
 * second, approximate mapping would drift from the trunk under variable speed
 * or an interleaved pause, and play/scrub/export would stop agreeing.
 */

import { describe, test, expect } from 'vitest';
import { buildRunLeg, composeRouteTimeline, branchPathProgressAt } from '../src/utils/branchTiming.js';
import { branchPathWaypoints, resolveRouteBranches } from '../src/utils/routeBranches.js';
import { RenderingService } from '../src/services/RenderingService.js';
import { Waypoint } from '../src/models/Waypoint.js';

const wp = (id, extra = {}) => Object.assign(Waypoint.createMajor(0.5, 0.5), { id }, extra);

// A major defaults to a 1500 ms wait, which would hide the travel arithmetic
// these fixtures are about, so timing fixtures wait explicitly or not at all.
const stop = (id, extra = {}) => wp(id, { pauseMode: 'none', pauseTime: 0, ...extra });

// A run whose majors are evenly spaced along a 1000px path at 100px/s,
// giving a 10s travel time with no pauses.
const evenRun = (id, ids, extra = {}) => ({
  id,
  waypoints: ids.map(each => stop(each)),
  progressValues: ids.map((_, index) => index / (ids.length - 1)),
  pathLengthPx: 1000,
  ...extra,
});

describe('buildRunLeg', () => {
  test('an even run times to length over speed', () => {
    const leg = buildRunLeg(evenRun(null, ['a', 'b', 'c']), 100);

    expect(leg.durationMs).toBeCloseTo(10000, 6);
    expect(leg.pathDurationMs).toBeCloseTo(10000, 6);
    expect(leg.totalPauseMs).toBe(0);
    expect(leg.arrivalOffsetsById.a).toBeCloseTo(0, 6);
    expect(leg.arrivalOffsetsById.b).toBeCloseTo(5000, 6);
    expect(leg.arrivalOffsetsById.c).toBeCloseTo(10000, 6);
  });

  test('a pause lengthens the run and pushes later arrivals out', () => {
    const run = evenRun(null, ['a', 'b', 'c']);
    Object.assign(run.waypoints[1], { pauseMode: 'timed', pauseTime: 2000 });
    const leg = buildRunLeg(run, 100);

    expect(leg.totalPauseMs).toBe(2000);
    expect(leg.durationMs).toBeCloseTo(12000, 6);
    // The pause sits AT b, so b's own arrival is unchanged and c's slips.
    expect(leg.arrivalOffsetsById.b).toBeCloseTo(5000, 6);
    expect(leg.arrivalOffsetsById.c).toBeCloseTo(12000, 6);
  });

  test('minors bend the path but never open a timing leg', () => {
    const run = evenRun(null, ['a', 'm', 'b']);
    run.waypoints[1] = Object.assign(Waypoint.createMinor(0.5, 0.5), { id: 'm' });
    run.waypoints[0].segmentSpeed = 2.0;
    const leg = buildRunLeg(run, 100);

    // One major leg at 2x over the whole 1000px, not two legs split at the minor
    expect(leg.pathDurationMs).toBeCloseTo(5000, 6);
  });

  test('a run of fewer than two majors has no timing of its own', () => {
    const run = evenRun(null, ['a', 'b']);
    run.waypoints[1] = Object.assign(Waypoint.createMinor(0.5, 0.5), { id: 'b' });

    expect(buildRunLeg(run, 100).durationMs).toBe(0);
  });

  test('a branch does not claim the arrival of an anchor it merely touches', () => {
    // fork 'f' and rejoin 'z' belong to the trunk; the branch only passes them
    const run = evenRun('B', ['f', 'b1', 'z'], {
      forkFromId: 'f', rejoinAtId: 'z', anchorIds: ['f', 'z'],
    });
    const leg = buildRunLeg(run, 100);

    expect(Object.keys(leg.arrivalOffsetsById)).toEqual(['b1']);
  });

  test('the leg carries the timeline shape PlayerCore.timelineToPath consumes', () => {
    const leg = buildRunLeg(evenRun(null, ['a', 'b']), 100);

    expect(leg.timeline).toMatchObject({
      segments: expect.any(Array),
      pauses: expect.any(Array),
      pathDuration: expect.any(Number),
      totalPauseTime: expect.any(Number),
      hasVariableSpeed: expect.any(Boolean),
    });
  });
});

describe('composeRouteTimeline', () => {
  test('a trunk and one rejoining branch place on one master timeline', () => {
    const composed = composeRouteTimeline([
      evenRun(null, ['a', 'f', 'z']),                       // 10s, fork at 5s
      evenRun('B', ['f', 'b1', 'z'], {                      // 10s from the fork
        forkFromId: 'f', rejoinAtId: 'z', anchorIds: ['f', 'z'],
      }),
    ], 100);

    expect(composed.legs.__trunk__.startMs).toBe(0);
    expect(composed.legs.B.startMs).toBeCloseTo(5000, 6);
    // Trunk reaches z at 10s; the branch not until 5s + 10s.
    expect(composed.arrivalMsById.z).toBeCloseTo(10000, 6);
    expect(composed.joinWaitsById.z).toBeCloseTo(5000, 6);
    expect(composed.totalDurationMs).toBeCloseTo(15000, 6);
  });

  test('a terminal branch extends the route past the trunk', () => {
    const composed = composeRouteTimeline([
      evenRun(null, ['a', 'f']),                            // 10s, fork at the end
      evenRun('B', ['f', 'b1'], { forkFromId: 'f', anchorIds: ['f'] }),
    ], 100);

    expect(composed.totalDurationMs).toBeCloseTo(20000, 6);
  });

  test('legsById is keyed so the renderer can find a branch by id', () => {
    const composed = composeRouteTimeline([
      evenRun(null, ['a', 'f']),
      evenRun('B', ['f', 'b1'], { forkFromId: 'f', anchorIds: ['f'] }),
    ], 100);

    expect(composed.legsById.B.durationMs).toBeCloseTo(10000, 6);
    expect(composed.legsById.__trunk__.durationMs).toBeCloseTo(10000, 6);
  });
});

describe('branchPathProgressAt', () => {
  const setup = () => {
    const composed = composeRouteTimeline([
      evenRun(null, ['a', 'f']),                            // fork at 10s
      evenRun('B', ['f', 'b1'], { forkFromId: 'f', anchorIds: ['f'] }),
    ], 100);
    return { placement: composed.legs.B, leg: composed.legsById.B };
  };

  test('a branch sits at its start until the head reaches the fork', () => {
    const { placement, leg } = setup();

    expect(branchPathProgressAt(0, placement, leg)).toBe(0);
    expect(branchPathProgressAt(9999, placement, leg)).toBe(0);
  });

  test('a branch runs from its fork and reaches the end at its own duration', () => {
    const { placement, leg } = setup();

    expect(branchPathProgressAt(15000, placement, leg)).toBeCloseTo(0.5, 3);
    expect(branchPathProgressAt(20000, placement, leg)).toBe(1);
  });

  test('a finished branch holds at its end rather than looping or vanishing', () => {
    const { placement, leg } = setup();

    expect(branchPathProgressAt(999999, placement, leg)).toBe(1);
  });

  test('an interleaved pause holds the branch head still', () => {
    const run = evenRun('B', ['f', 'b1', 'b2'], { forkFromId: 'f', anchorIds: ['f'] });
    Object.assign(run.waypoints[1], { pauseMode: 'timed', pauseTime: 4000 });
    const composed = composeRouteTimeline([evenRun(null, ['a', 'f']), run], 100);
    const placement = composed.legs.B;
    const leg = composed.legsById.B;

    // Fork at 10s; b1 is halfway along the branch, reached 5s later.
    const atArrival = branchPathProgressAt(15000, placement, leg);
    const midPause = branchPathProgressAt(17000, placement, leg);
    const nearPauseEnd = branchPathProgressAt(18900, placement, leg);

    expect(atArrival).toBeCloseTo(0.5, 3);
    expect(midPause).toBeCloseTo(atArrival, 6);
    expect(nearPauseEnd).toBeCloseTo(atArrival, 6);
    // …and it moves again once the pause is over
    expect(branchPathProgressAt(20000, placement, leg)).toBeGreaterThan(atArrival);
  });

  test('a leg with no timeline reports no progress rather than throwing', () => {
    expect(branchPathProgressAt(100, { startMs: 0, durationMs: 10 }, {})).toBe(0);
    expect(branchPathProgressAt(100, null, null)).toBe(0);
  });
});

describe('branchPathWaypoints', () => {
  const route = [
    wp('a'), wp('f'),
    wp('b1', { branchId: 'B', branchFrom: 'f' }),
    wp('b2', { branchId: 'B', branchRejoin: 'z' }),
    wp('z'),
  ];

  test('a rejoining branch is anchored at both ends so it meets the trunk', () => {
    const structure = resolveRouteBranches(route);

    expect(branchPathWaypoints(structure, 'B', route).map(w => w.id))
      .toEqual(['f', 'b1', 'b2', 'z']);
  });

  test('a terminal branch is anchored only at its fork', () => {
    const terminal = [wp('a'), wp('f'), wp('b1', { branchId: 'B', branchFrom: 'f' })];
    const structure = resolveRouteBranches(terminal);

    expect(branchPathWaypoints(structure, 'B', terminal).map(w => w.id))
      .toEqual(['f', 'b1']);
  });

  test('a branch whose fork is gone yields no spline rather than a floating one', () => {
    const broken = [wp('a'), wp('b1', { branchId: 'B', branchFrom: 'gone' })];
    const structure = resolveRouteBranches(broken);

    expect(branchPathWaypoints(structure, 'B', broken)).toEqual([]);
  });

  test('an unknown branch id yields no spline', () => {
    expect(branchPathWaypoints(resolveRouteBranches(route), 'NOPE', route)).toEqual([]);
  });
});

describe('the branch render pass', () => {
  const svc = new RenderingService();
  const engineAt = timelineMs => ({
    state: { duration: 30000, speed: 100 },
    pathDuration: 10000,
    getTime: () => timelineMs,
  });

  const stateWith = (timelineMs) => {
    const composed = composeRouteTimeline([
      evenRun(null, ['a', 'f']),
      evenRun('B', ['f', 'b1'], { forkFromId: 'f', anchorIds: ['f'] }),
    ], 100);
    return {
      animationEngine: engineAt(timelineMs),
      branchTimeline: composed,
      branchPaths: [{
        id: 'B',
        pathPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        waypoints: [wp('f'), wp('b1')],
        progressValues: [0, 1],
      }],
    };
  };

  test('a linear route has no branch pass at all', () => {
    expect(svc.activeBranches({ animationEngine: engineAt(0) })).toEqual([]);
    expect(svc.activeBranches({ branchPaths: [], branchTimeline: null })).toEqual([]);
  });

  test('each branch reports its own progress at the master instant', () => {
    expect(svc.activeBranches(stateWith(10000))[0].engine.getPathProgress()).toBe(0);
    expect(svc.activeBranches(stateWith(15000))[0].engine.getPathProgress()).toBeCloseTo(0.5, 3);
    expect(svc.activeBranches(stateWith(20000))[0].engine.getPathProgress()).toBe(1);
  });

  test('the facade delegates everything except path progress to the real engine', () => {
    const state = stateWith(15000);
    const [branch] = svc.activeBranches(state);

    expect(branch.engine.state).toBe(state.animationEngine.state);
    expect(branch.engine.pathDuration).toBe(10000);
    expect(branch.engine.getTime()).toBe(15000);
    // Absent optional methods degrade rather than throw
    expect(branch.engine.isInTailTime()).toBe(false);
    expect(branch.engine.getTailTimeElapsed()).toBe(0);
    expect(branch.engine.getTrailVisibilityContext()).toBeNull();
  });

  test('a branch with too few path points is skipped', () => {
    const state = stateWith(15000);
    state.branchPaths[0].pathPoints = [{ x: 0, y: 0 }];

    expect(svc.activeBranches(state)).toEqual([]);
  });

  test('both branch layers are registered and guard on branch data', () => {
    const names = RenderingService.VECTOR_LAYERS.map(layer => layer.name);
    const order = name => names.indexOf(name);

    expect(order('branch-paths')).toBeGreaterThan(-1);
    expect(order('branch-heads')).toBeGreaterThan(-1);
    // Branch paths under the trunk, branch heads above it
    expect(order('branch-paths')).toBeLessThan(order('path'));
    expect(order('branch-heads')).toBeGreaterThan(order('path-head'));
    expect(order('branch-heads')).toBeLessThan(order('beacons'));
  });

  test('the branch layers draw nothing when a route has no branches', () => {
    const drawn = [];
    const stub = {
      activeBranches: () => { throw new Error('must not be reached on a linear route'); },
      renderPath: () => drawn.push('path'),
      renderPathHead: () => drawn.push('head'),
    };
    const frame = { shouldRenderPath: true, applyMotion: false, hasPath: true };
    for (const layer of RenderingService.VECTOR_LAYERS) {
      if (!layer.name.startsWith('branch-')) continue;
      expect(() => layer.draw(stub, {}, { branchPaths: [] }, frame)).not.toThrow();
    }
    expect(drawn).toEqual([]);
  });
});
