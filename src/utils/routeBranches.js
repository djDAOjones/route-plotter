/**
 * Hero-route branch structure: resolving a flat waypoint array into a trunk
 * plus zero or more branches, and validating that structure.
 *
 * ROUTE-01a. The hero route stays ONE ordered array — the same array that has
 * always been serialised — because the approved contract requires a valid
 * linear project to keep its exact shape and timeline until it is explicitly
 * split. A branch is therefore a *contiguous run* of waypoints sharing a
 * `branchId`, exactly as a leg's minors are a contiguous run under their
 * major. Nothing here mutates a waypoint or reads the clock.
 *
 * This is deliberately NOT the crowd `GraphModel`. A guide network is a
 * weighted, directed graph where dots *choose* an edge; a hero-route branch is
 * storytelling — every enabled branch animates simultaneously. Reusing the
 * crowd model would have imported edge weights and probabilistic selection
 * into a place where neither has any meaning.
 *
 * Structural terms:
 * - **trunk** — the waypoints with no `branchId`. Always present, possibly
 *   empty, and always the run the route starts from.
 * - **fork** — the waypoint a branch springs from (`branchFrom` on the
 *   branch's first waypoint). The head reaches it, then every branch leaving
 *   it starts at once.
 * - **rejoin** — the waypoint a branch reconverges into (`branchRejoin` on the
 *   branch's last waypoint), or null for a terminal branch that simply ends.
 */

/** Problem codes a caller can present to the author. */
export const BRANCH_PROBLEM = {
  SPLIT_RUN: 'branch-run-split',
  MISSING_FORK: 'branch-fork-missing',
  SELF_FORK: 'branch-fork-self',
  MISSING_REJOIN: 'branch-rejoin-missing',
  SELF_REJOIN: 'branch-rejoin-self',
  NO_FORK_DECLARED: 'branch-fork-undeclared',
  CYCLE: 'branch-cycle',
  EMPTY_OF_MAJORS: 'branch-has-no-major',
};

/**
 * @typedef {Object} RouteBranch
 * @property {string|null} id Branch id; null for the trunk
 * @property {Array<Object>} waypoints The run, in route order
 * @property {number} startIndex Index of the run's first waypoint in the array
 * @property {string|null} forkFromId Waypoint this branch leaves; null on trunk
 * @property {string|null} rejoinAtId Waypoint this branch reconverges into
 * @property {boolean} terminal True when the branch ends the route
 */

/**
 * @typedef {Object} RouteStructure
 * @property {RouteBranch} trunk
 * @property {Array<RouteBranch>} branches Non-trunk runs, in array order
 * @property {Array<RouteBranch>} all Trunk first, then branches
 * @property {boolean} isLinear True when no waypoint declares a branch
 * @property {Array<{code: string, branchId: string|null, detail: string}>} problems
 */

/**
 * Resolve the branch structure of a route.
 *
 * Never throws and never repairs: a malformed structure comes back with its
 * runs intact plus a `problems` list, so the caller can render the route it
 * has and tell the author exactly what is wrong. Silent repair here would
 * rewrite authored intent during a render.
 *
 * @param {Array<Object>} waypoints Route order, majors and minors
 * @returns {RouteStructure}
 */
export function resolveRouteBranches(waypoints = []) {
  const list = Array.isArray(waypoints) ? waypoints : [];
  const problems = [];

  const trunk = {
    id: null,
    waypoints: [],
    startIndex: 0,
    forkFromId: null,
    rejoinAtId: null,
    terminal: true,
  };

  if (list.length === 0) {
    return { trunk, branches: [], all: [trunk], isLinear: true, problems };
  }

  const byId = new Map();
  for (const waypoint of list) {
    if (waypoint && waypoint.id !== undefined) byId.set(waypoint.id, waypoint);
  }

  // Walk once, cutting the array into contiguous runs by branchId. A branchId
  // that reappears after a different run is the author's structure being
  // broken by an edit, not a second branch: report it rather than merging.
  const runs = [];
  const seenBranchIds = new Set();
  let current = null;

  list.forEach((waypoint, index) => {
    const branchId = branchIdOf(waypoint);
    if (!current || current.id !== branchId) {
      if (branchId !== null && seenBranchIds.has(branchId)) {
        problems.push({
          code: BRANCH_PROBLEM.SPLIT_RUN,
          branchId,
          detail: `Branch ${branchId} appears in more than one place in the route`,
        });
      }
      current = {
        id: branchId,
        waypoints: [],
        startIndex: index,
        forkFromId: null,
        rejoinAtId: null,
        terminal: true,
      };
      if (branchId !== null) seenBranchIds.add(branchId);
      runs.push(current);
    }
    current.waypoints.push(waypoint);
  });

  // Trunk runs merge: the trunk is one logical run even when branches sit
  // between its waypoints in the array.
  const branches = [];
  for (const run of runs) {
    if (run.id === null) {
      if (trunk.waypoints.length === 0) trunk.startIndex = run.startIndex;
      trunk.waypoints.push(...run.waypoints);
      continue;
    }
    const first = run.waypoints[0];
    const last = run.waypoints[run.waypoints.length - 1];
    run.forkFromId = readLink(first, 'branchFrom');
    run.rejoinAtId = readLink(last, 'branchRejoin');
    run.terminal = run.rejoinAtId === null;
    branches.push(run);
    validateBranch(run, byId, problems);
  }

  if (branches.length > 0) detectCycles(branches, byId, problems);

  return {
    trunk,
    branches,
    all: [trunk, ...branches],
    isLinear: branches.length === 0,
    problems,
  };
}

function branchIdOf(waypoint) {
  const value = waypoint && waypoint.branchId;
  return typeof value === 'string' && value !== '' ? value : null;
}

function readLink(waypoint, field) {
  const value = waypoint && waypoint[field];
  return typeof value === 'string' && value !== '' ? value : null;
}

function validateBranch(branch, byId, problems) {
  const memberIds = new Set(branch.waypoints.map(waypoint => waypoint.id));

  if (branch.forkFromId === null) {
    problems.push({
      code: BRANCH_PROBLEM.NO_FORK_DECLARED,
      branchId: branch.id,
      detail: `Branch ${branch.id} does not say which waypoint it leaves`,
    });
  } else if (!byId.has(branch.forkFromId)) {
    problems.push({
      code: BRANCH_PROBLEM.MISSING_FORK,
      branchId: branch.id,
      detail: `Branch ${branch.id} forks from a waypoint that no longer exists`,
    });
  } else if (memberIds.has(branch.forkFromId)) {
    problems.push({
      code: BRANCH_PROBLEM.SELF_FORK,
      branchId: branch.id,
      detail: `Branch ${branch.id} forks from one of its own waypoints`,
    });
  }

  if (branch.rejoinAtId !== null) {
    if (!byId.has(branch.rejoinAtId)) {
      problems.push({
        code: BRANCH_PROBLEM.MISSING_REJOIN,
        branchId: branch.id,
        detail: `Branch ${branch.id} rejoins a waypoint that no longer exists`,
      });
    } else if (memberIds.has(branch.rejoinAtId)) {
      problems.push({
        code: BRANCH_PROBLEM.SELF_REJOIN,
        branchId: branch.id,
        detail: `Branch ${branch.id} rejoins one of its own waypoints`,
      });
    }
  }

  if (!branch.waypoints.some(waypoint => waypoint.isMajor !== false)) {
    problems.push({
      code: BRANCH_PROBLEM.EMPTY_OF_MAJORS,
      branchId: branch.id,
      detail: `Branch ${branch.id} has only minor waypoints, so it has no timing of its own`,
    });
  }
}

/**
 * A branch may fork from the trunk or from another branch. Following
 * fork links upward must always terminate at the trunk; if it revisits a
 * branch, the author has built a loop the single master timeline cannot
 * schedule (branch B waits for A, which waits for B).
 */
function detectCycles(branches, byId, problems) {
  const ownerOf = new Map();
  for (const branch of branches) {
    for (const waypoint of branch.waypoints) ownerOf.set(waypoint.id, branch.id);
  }

  for (const branch of branches) {
    const seen = new Set([branch.id]);
    let cursor = branch.forkFromId;
    while (cursor !== null && byId.has(cursor)) {
      const owner = ownerOf.get(cursor);
      if (owner === undefined) break; // reached the trunk: well-founded
      if (seen.has(owner)) {
        problems.push({
          code: BRANCH_PROBLEM.CYCLE,
          branchId: branch.id,
          detail: `Branch ${branch.id} forks from a branch that ultimately forks from it`,
        });
        break;
      }
      seen.add(owner);
      const parent = branches.find(candidate => candidate.id === owner);
      cursor = parent ? parent.forkFromId : null;
    }
  }
}

/**
 * The trunk-only waypoint array — what every renderer, timeline and export
 * path sees for a project that has never been split. For a linear route this
 * is the input array itself, so no caller pays for a copy it does not need.
 *
 * @param {Array<Object>} waypoints
 * @returns {Array<Object>}
 */
export function trunkWaypoints(waypoints = []) {
  const list = Array.isArray(waypoints) ? waypoints : [];
  return list.some(waypoint => branchIdOf(waypoint) !== null)
    ? list.filter(waypoint => branchIdOf(waypoint) === null)
    : list;
}

/**
 * True when no waypoint declares a branch — the fast path that lets every
 * existing caller keep its exact single-chain behaviour.
 *
 * @param {Array<Object>} waypoints
 * @returns {boolean}
 */
export function isLinearRoute(waypoints = []) {
  const list = Array.isArray(waypoints) ? waypoints : [];
  return !list.some(waypoint => branchIdOf(waypoint) !== null);
}

/**
 * The spline input for one branch: the fork waypoint, the branch's own
 * waypoints, and the rejoin waypoint when it has one.
 *
 * The fork and rejoin anchors are included so the branch's drawn path meets
 * the trunk at both ends — a branch whose spline started at its own first
 * waypoint would float, detached from the route it leaves. They are anchors
 * only: the branch's timing starts at the fork's arrival, so the anchor
 * contributes geometry, not a second visit.
 *
 * @param {RouteStructure} structure
 * @param {string} branchId
 * @param {Array<Object>} waypoints The full route, for resolving anchors
 * @returns {Array<Object>} Waypoints in spline order; empty when unresolvable
 */
export function branchPathWaypoints(structure, branchId, waypoints = []) {
  const branch = structure?.branches?.find(candidate => candidate.id === branchId);
  if (!branch) return [];

  const byId = new Map();
  for (const waypoint of waypoints) {
    if (waypoint && waypoint.id !== undefined) byId.set(waypoint.id, waypoint);
  }

  const fork = branch.forkFromId === null ? null : byId.get(branch.forkFromId);
  if (!fork) return [];

  const rejoin = branch.rejoinAtId === null ? null : byId.get(branch.rejoinAtId);
  return rejoin
    ? [fork, ...branch.waypoints, rejoin]
    : [fork, ...branch.waypoints];
}
