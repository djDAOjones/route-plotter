/**
 * ROUTE-01a — hero-route branch structure and master-timeline composition.
 *
 * The approved contract, restated as the three things these tests defend:
 * 1. every enabled branch starts when the head reaches its fork, simultaneously
 * 2. a reconverged continuation waits for the LATEST incoming branch, and the
 *    join's own wait fires once
 * 3. completion means every terminal endpoint is complete
 *
 * Plus the constraint that makes the change safe to ship headless: a route
 * with no branches resolves, composes and serialises exactly as before.
 */

import { describe, test, expect } from 'vitest';
import {
  resolveRouteBranches,
  trunkWaypoints,
  isLinearRoute,
  BRANCH_PROBLEM,
} from '../src/utils/routeBranches.js';
import { PlayerCore } from '../src/core/PlayerCore.js';
import { Waypoint } from '../src/models/Waypoint.js';

const wp = (id, extra = {}) => Object.assign(
  Waypoint.createMajor(0.5, 0.5), { id }, extra
);

describe('resolveRouteBranches', () => {
  test('a route with no branch links is linear and is all trunk', () => {
    const route = [wp('a'), wp('b'), wp('c')];
    const structure = resolveRouteBranches(route);

    expect(structure.isLinear).toBe(true);
    expect(structure.branches).toEqual([]);
    expect(structure.trunk.waypoints).toEqual(route);
    expect(structure.problems).toEqual([]);
  });

  test('an empty route resolves to an empty trunk without complaint', () => {
    const structure = resolveRouteBranches([]);

    expect(structure.isLinear).toBe(true);
    expect(structure.trunk.waypoints).toEqual([]);
    expect(structure.problems).toEqual([]);
  });

  test('a contiguous run with a branchId becomes one branch', () => {
    const route = [
      wp('a'), wp('b'),
      wp('b1', { branchId: 'B', branchFrom: 'b' }),
      wp('b2', { branchId: 'B', branchRejoin: 'c' }),
      wp('c'),
    ];
    const structure = resolveRouteBranches(route);

    expect(structure.isLinear).toBe(false);
    expect(structure.branches).toHaveLength(1);
    expect(structure.branches[0]).toMatchObject({
      id: 'B', forkFromId: 'b', rejoinAtId: 'c', terminal: false, startIndex: 2,
    });
    expect(structure.branches[0].waypoints.map(w => w.id)).toEqual(['b1', 'b2']);
    expect(structure.trunk.waypoints.map(w => w.id)).toEqual(['a', 'b', 'c']);
    expect(structure.problems).toEqual([]);
  });

  test('a branch with no rejoin is terminal', () => {
    const structure = resolveRouteBranches([
      wp('a'), wp('b'),
      wp('b1', { branchId: 'B', branchFrom: 'b' }),
    ]);

    expect(structure.branches[0]).toMatchObject({ terminal: true, rejoinAtId: null });
    expect(structure.problems).toEqual([]);
  });

  test('two branches leaving the same fork both resolve', () => {
    const structure = resolveRouteBranches([
      wp('a'),
      wp('l1', { branchId: 'L', branchFrom: 'a' }),
      wp('r1', { branchId: 'R', branchFrom: 'a' }),
    ]);

    expect(structure.branches.map(b => b.id)).toEqual(['L', 'R']);
    expect(structure.branches.every(b => b.forkFromId === 'a')).toBe(true);
    expect(structure.problems).toEqual([]);
  });

  test('a branch forking from another branch resolves without complaint', () => {
    const structure = resolveRouteBranches([
      wp('a'),
      wp('b1', { branchId: 'B', branchFrom: 'a' }),
      wp('c1', { branchId: 'C', branchFrom: 'b1' }),
    ]);

    expect(structure.problems).toEqual([]);
    expect(structure.branches.find(b => b.id === 'C').forkFromId).toBe('b1');
  });

  test('the trunk stays one run even when a branch sits between its waypoints', () => {
    const structure = resolveRouteBranches([
      wp('a'),
      wp('b1', { branchId: 'B', branchFrom: 'a', branchRejoin: 'z' }),
      wp('z'),
    ]);

    expect(structure.trunk.waypoints.map(w => w.id)).toEqual(['a', 'z']);
  });
});

describe('resolveRouteBranches reports problems instead of repairing them', () => {
  const problemCodes = route => resolveRouteBranches(route).problems.map(p => p.code);

  test('a branch id that reappears elsewhere is a split run', () => {
    expect(problemCodes([
      wp('a'),
      wp('b1', { branchId: 'B', branchFrom: 'a' }),
      wp('mid'),
      wp('b2', { branchId: 'B' }),
    ])).toContain(BRANCH_PROBLEM.SPLIT_RUN);
  });

  test('a branch that never says where it forks from', () => {
    expect(problemCodes([wp('a'), wp('b1', { branchId: 'B' })]))
      .toContain(BRANCH_PROBLEM.NO_FORK_DECLARED);
  });

  test('a fork target deleted out from under the branch', () => {
    expect(problemCodes([wp('a'), wp('b1', { branchId: 'B', branchFrom: 'gone' })]))
      .toContain(BRANCH_PROBLEM.MISSING_FORK);
  });

  test('a branch forking from one of its own waypoints', () => {
    expect(problemCodes([
      wp('a'),
      wp('b1', { branchId: 'B', branchFrom: 'b2' }),
      wp('b2', { branchId: 'B' }),
    ])).toContain(BRANCH_PROBLEM.SELF_FORK);
  });

  test('a rejoin target deleted out from under the branch', () => {
    expect(problemCodes([
      wp('a'),
      wp('b1', { branchId: 'B', branchFrom: 'a', branchRejoin: 'gone' }),
    ])).toContain(BRANCH_PROBLEM.MISSING_REJOIN);
  });

  test('a branch rejoining itself', () => {
    expect(problemCodes([
      wp('a'),
      wp('b1', { branchId: 'B', branchFrom: 'a' }),
      wp('b2', { branchId: 'B', branchRejoin: 'b1' }),
    ])).toContain(BRANCH_PROBLEM.SELF_REJOIN);
  });

  test('a branch of only minors has no timing of its own', () => {
    const minor = Object.assign(Waypoint.createMinor(0.5, 0.5),
      { id: 'm1', branchId: 'B', branchFrom: 'a' });
    expect(problemCodes([wp('a'), minor]))
      .toContain(BRANCH_PROBLEM.EMPTY_OF_MAJORS);
  });

  test('two branches forking from each other are a cycle', () => {
    expect(problemCodes([
      wp('a'),
      wp('b1', { branchId: 'B', branchFrom: 'c1' }),
      wp('c1', { branchId: 'C', branchFrom: 'b1' }),
    ])).toContain(BRANCH_PROBLEM.CYCLE);
  });

  test('a malformed structure still returns its runs so the route can render', () => {
    const structure = resolveRouteBranches([
      wp('a'), wp('b1', { branchId: 'B', branchFrom: 'gone' }),
    ]);

    expect(structure.problems).not.toEqual([]);
    expect(structure.branches[0].waypoints.map(w => w.id)).toEqual(['b1']);
    expect(structure.trunk.waypoints.map(w => w.id)).toEqual(['a']);
  });
});

describe('trunkWaypoints / isLinearRoute', () => {
  test('a linear route returns the same array instance, no copy', () => {
    const route = [wp('a'), wp('b')];
    expect(trunkWaypoints(route)).toBe(route);
    expect(isLinearRoute(route)).toBe(true);
  });

  test('a branched route yields only the trunk', () => {
    const route = [wp('a'), wp('b1', { branchId: 'B', branchFrom: 'a' }), wp('c')];
    expect(trunkWaypoints(route).map(w => w.id)).toEqual(['a', 'c']);
    expect(isLinearRoute(route)).toBe(false);
  });
});

describe('PlayerCore.composeBranchTimeline', () => {
  const trunkLeg = (durationMs, offsets) => ({
    id: null, durationMs, forkFromId: null, rejoinAtId: null,
    arrivalOffsetsById: offsets,
  });

  test('a trunk with no branches composes to the linear timeline unchanged', () => {
    const composed = PlayerCore.composeBranchTimeline([
      trunkLeg(5000, { a: 0, b: 2000, c: 5000 }),
    ]);

    expect(composed.totalDurationMs).toBe(5000);
    expect(composed.arrivalMsById).toEqual({ a: 0, b: 2000, c: 5000 });
    expect(composed.joinWaitsById).toEqual({});
    expect(composed.unresolved).toEqual([]);
  });

  test('an empty legs list composes to a zero-length timeline', () => {
    expect(PlayerCore.composeBranchTimeline([])).toMatchObject({
      totalDurationMs: 0, arrivalMsById: {}, unresolved: [],
    });
  });

  test('a branch starts the instant the head reaches its fork', () => {
    const composed = PlayerCore.composeBranchTimeline([
      trunkLeg(5000, { a: 0, b: 2000, c: 5000 }),
      { id: 'B', durationMs: 1500, forkFromId: 'b', rejoinAtId: null,
        arrivalOffsetsById: { b1: 600, b2: 1500 } },
    ]);

    expect(composed.legs.B.startMs).toBe(2000);
    expect(composed.arrivalMsById.b1).toBe(2600);
    expect(composed.arrivalMsById.b2).toBe(3500);
  });

  test('branches leaving one fork run simultaneously, not in sequence', () => {
    const composed = PlayerCore.composeBranchTimeline([
      trunkLeg(1000, { a: 0, z: 1000 }),
      { id: 'L', durationMs: 4000, forkFromId: 'a', rejoinAtId: null,
        arrivalOffsetsById: { l1: 4000 } },
      { id: 'R', durationMs: 2500, forkFromId: 'a', rejoinAtId: null,
        arrivalOffsetsById: { r1: 2500 } },
    ]);

    expect(composed.legs.L.startMs).toBe(0);
    expect(composed.legs.R.startMs).toBe(0);
    // Sequential scheduling would put the route at 6500; simultaneous is 4000.
    expect(composed.totalDurationMs).toBe(4000);
  });

  test('a rejoin waits for the latest incoming branch', () => {
    const composed = PlayerCore.composeBranchTimeline([
      trunkLeg(3000, { fork: 0, join: 3000 }),
      { id: 'SLOW', durationMs: 5000, forkFromId: 'fork', rejoinAtId: 'join',
        arrivalOffsetsById: { s1: 5000 } },
      { id: 'FAST', durationMs: 1000, forkFromId: 'fork', rejoinAtId: 'join',
        arrivalOffsetsById: { f1: 1000 } },
    ]);

    // The trunk reaches the join at 3000; the slow branch not until 5000.
    expect(composed.arrivalMsById.join).toBe(3000);
    expect(composed.joinWaitsById.join).toBe(2000);
    expect(composed.totalDurationMs).toBe(5000);
  });

  test('the join wait is recorded once, not once per incoming branch', () => {
    const composed = PlayerCore.composeBranchTimeline([
      trunkLeg(1000, { fork: 0, join: 1000 }),
      { id: 'A', durationMs: 4000, forkFromId: 'fork', rejoinAtId: 'join', arrivalOffsetsById: {} },
      { id: 'B', durationMs: 3000, forkFromId: 'fork', rejoinAtId: 'join', arrivalOffsetsById: {} },
      { id: 'C', durationMs: 2000, forkFromId: 'fork', rejoinAtId: 'join', arrivalOffsetsById: {} },
    ]);

    expect(Object.keys(composed.joinWaitsById)).toEqual(['join']);
    expect(composed.joinWaitsById.join).toBe(3000); // latest (4000) minus arrival (1000)
  });

  test('an early branch imposes no wait on a join the trunk reaches later', () => {
    const composed = PlayerCore.composeBranchTimeline([
      trunkLeg(9000, { fork: 0, join: 9000 }),
      { id: 'B', durationMs: 1000, forkFromId: 'fork', rejoinAtId: 'join', arrivalOffsetsById: {} },
    ]);

    expect(composed.joinWaitsById.join).toBe(0);
    expect(composed.totalDurationMs).toBe(9000);
  });

  test('completion counts every terminal endpoint, not just the trunk', () => {
    const composed = PlayerCore.composeBranchTimeline([
      trunkLeg(2000, { fork: 1000, end: 2000 }),
      { id: 'LONG', durationMs: 6000, forkFromId: 'fork', rejoinAtId: null, arrivalOffsetsById: {} },
    ]);

    expect(composed.totalDurationMs).toBe(7000); // 1000 fork + 6000 branch
  });

  test('a disabled branch keeps its place but contributes no time', () => {
    const composed = PlayerCore.composeBranchTimeline([
      trunkLeg(2000, { fork: 500, join: 2000 }),
      { id: 'OFF', durationMs: 9000, forkFromId: 'fork', rejoinAtId: 'join',
        arrivalOffsetsById: { o1: 9000 }, enabled: false },
    ]);

    expect(composed.legs.OFF.enabled).toBe(false);
    expect(composed.legs.OFF.durationMs).toBe(0);
    expect(composed.joinWaitsById).toEqual({});
    expect(composed.arrivalMsById.o1).toBeUndefined();
    expect(composed.totalDurationMs).toBe(2000);
  });

  test('a branch of a branch chains its start through both forks', () => {
    const composed = PlayerCore.composeBranchTimeline([
      trunkLeg(1000, { a: 200 }),
      { id: 'B', durationMs: 3000, forkFromId: 'a', rejoinAtId: null,
        arrivalOffsetsById: { b1: 800 } },
      { id: 'C', durationMs: 500, forkFromId: 'b1', rejoinAtId: null, arrivalOffsetsById: {} },
    ]);

    expect(composed.legs.B.startMs).toBe(200);
    expect(composed.legs.C.startMs).toBe(1000); // 200 + 800
    expect(composed.totalDurationMs).toBe(3200); // B ends at 200 + 3000
  });

  test('composition is independent of the order legs are passed in', () => {
    const legs = [
      trunkLeg(3000, { fork: 500, join: 3000 }),
      { id: 'A', durationMs: 4000, forkFromId: 'fork', rejoinAtId: 'join', arrivalOffsetsById: { a1: 4000 } },
      { id: 'B', durationMs: 2000, forkFromId: 'a1', rejoinAtId: null, arrivalOffsetsById: {} },
    ];
    const forward = PlayerCore.composeBranchTimeline(legs);
    const reversed = PlayerCore.composeBranchTimeline([...legs].reverse());

    expect(reversed).toEqual(forward);
  });

  test('a leg whose fork can never resolve is reported, not silently placed', () => {
    const composed = PlayerCore.composeBranchTimeline([
      trunkLeg(1000, { a: 0 }),
      { id: 'ORPHAN', durationMs: 500, forkFromId: 'nowhere', rejoinAtId: null, arrivalOffsetsById: {} },
    ]);

    expect(composed.unresolved).toEqual(['ORPHAN']);
    expect(composed.legs.ORPHAN).toBeUndefined();
    expect(composed.totalDurationMs).toBe(1000);
  });

  test('mutually forking legs terminate instead of looping', () => {
    const composed = PlayerCore.composeBranchTimeline([
      trunkLeg(1000, { a: 0 }),
      { id: 'X', durationMs: 500, forkFromId: 'y1', rejoinAtId: null, arrivalOffsetsById: { x1: 500 } },
      { id: 'Y', durationMs: 500, forkFromId: 'x1', rejoinAtId: null, arrivalOffsetsById: { y1: 500 } },
    ]);

    expect(composed.unresolved.sort()).toEqual(['X', 'Y']);
  });
});

describe('linear projects keep their exact serialized shape', () => {
  test('an unsplit waypoint serialises without any branch key', () => {
    const json = Waypoint.createMajor(0.25, 0.75).toJSON();

    expect('branchId' in json).toBe(false);
    expect('branchFrom' in json).toBe(false);
    expect('branchRejoin' in json).toBe(false);
  });

  test('branch links round-trip only when they are set', () => {
    const branched = new Waypoint({
      imgX: 0.1, imgY: 0.2, branchId: 'B', branchFrom: 'a', branchRejoin: 'z',
    });
    const restored = new Waypoint(branched.toJSON());

    expect(restored.branchId).toBe('B');
    expect(restored.branchFrom).toBe('a');
    expect(restored.branchRejoin).toBe('z');
  });

  test('empty-string links normalise to null rather than a falsy branch', () => {
    const waypoint = new Waypoint({ imgX: 0, imgY: 0, branchId: '', branchFrom: '' });

    expect(waypoint.branchId).toBeNull();
    expect(waypoint.branchFrom).toBeNull();
    expect('branchId' in waypoint.toJSON()).toBe(false);
  });

  test('a clone carries branch membership', () => {
    const branched = new Waypoint({ imgX: 0, imgY: 0, branchId: 'B', branchFrom: 'a' });

    expect(branched.clone().branchId).toBe('B');
    expect(branched.clone().branchFrom).toBe('a');
  });
});
