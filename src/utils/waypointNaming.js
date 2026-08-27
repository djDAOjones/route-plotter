/**
 * One hierarchical numbering for the whole route, shared by the sidebar
 * waypoint list and the semantic scene outline.
 *
 * Majors number `1..N`. A minor numbers `<owning major>.<position in leg>`,
 * so the row a sighted user reads and the outline node a screen-reader user
 * hears carry the same number for the same waypoint. Route-position numbering
 * could not do that: the outline's "Minor waypoint 7" and the list's
 * "Waypoint 7" named two different waypoints (UI-02).
 *
 * Leg 0 is real, not a guard. Deleting a major leaves its trailing minors in
 * front of every remaining major; those read `0.1`, `0.2` rather than silently
 * borrowing the number of the major that now follows them.
 *
 * A branch waypoint numbers `<fork>·<letter><position>` — `2·B1` is the first
 * waypoint of the first branch leaving waypoint 2 (ROUTE-01c). Letters start
 * at B because the trunk's own continuation past the fork is implicitly A, so
 * a second branch off the same fork reads `2·C1` without renumbering the
 * first. A minor inside a branch appends its own position: `2·B1.1`.
 */

/**
 * @typedef {Object} RouteNumberEntry
 * @property {boolean} isMajor
 * @property {number|null} majorNumber 1-based major number, null for a minor
 * @property {number|null} minorNumber 1-based position within the leg, null for a major
 * @property {number} legNumber Owning major's number; 0 before the first major
 * @property {string} displayNumber `"3"` for a major, `"3.2"` for a minor
 */

/**
 * Number every waypoint in route order.
 *
 * @param {Array<{isMajor?: boolean}>} waypoints Route order
 * @returns {Array<RouteNumberEntry>} One entry per waypoint, same order
 */
export function buildRouteNumbering(waypoints = []) {
  const list = Array.isArray(waypoints) ? waypoints : [];

  // Pass one: the trunk's own numbering, so a branch can name its fork.
  let majorNumber = 0;
  let minorNumber = 0;
  const trunkNumberById = new Map();
  for (const waypoint of list) {
    if (branchIdOf(waypoint) !== null) continue;
    if (waypoint?.isMajor) {
      majorNumber += 1;
      minorNumber = 0;
      trunkNumberById.set(waypoint.id, String(majorNumber));
    } else {
      minorNumber += 1;
      trunkNumberById.set(waypoint.id, `${majorNumber}.${minorNumber}`);
    }
  }

  // Letters are assigned per fork, in the order branches appear in the array,
  // so adding a second branch never renumbers the first. Only a branch's FIRST
  // waypoint carries branchFrom, so the fork is resolved once per branch and
  // reused — reading it per waypoint left later members unable to name it.
  const letterByBranchId = new Map();
  const forkIdByBranchId = new Map();
  const branchesPerFork = new Map();
  for (const waypoint of list) {
    const branchId = branchIdOf(waypoint);
    if (branchId === null || letterByBranchId.has(branchId)) continue;
    const forkId = typeof waypoint.branchFrom === 'string' ? waypoint.branchFrom : '';
    forkIdByBranchId.set(branchId, forkId);
    const taken = branchesPerFork.get(forkId) || 0;
    branchesPerFork.set(forkId, taken + 1);
    letterByBranchId.set(branchId, String.fromCharCode(66 + Math.min(taken, 23))); // B, C, D…
  }

  majorNumber = 0;
  minorNumber = 0;
  let branchMajor = 0;
  let branchMinor = 0;
  let currentBranchId = null;

  return list.map(waypoint => {
    const branchId = branchIdOf(waypoint);

    if (branchId === null) {
      if (waypoint?.isMajor) {
        majorNumber += 1;
        minorNumber = 0;
        currentBranchId = null;
        return {
          isMajor: true, majorNumber, minorNumber: null, legNumber: majorNumber,
          branchId: null, branchLetter: null, forkNumber: null,
          displayNumber: String(majorNumber),
        };
      }
      minorNumber += 1;
      currentBranchId = null;
      return {
        isMajor: false, majorNumber: null, minorNumber, legNumber: majorNumber,
        branchId: null, branchLetter: null, forkNumber: null,
        displayNumber: `${majorNumber}.${minorNumber}`,
      };
    }

    if (branchId !== currentBranchId) {
      currentBranchId = branchId;
      branchMajor = 0;
      branchMinor = 0;
    }
    const letter = letterByBranchId.get(branchId) || 'B';
    const forkId = forkIdByBranchId.get(branchId);
    const forkNumber = trunkNumberById.get(forkId)
      ?? branchNumberFallback(list, forkId, letterByBranchId, trunkNumberById);

    if (waypoint?.isMajor) {
      branchMajor += 1;
      branchMinor = 0;
      return {
        isMajor: true, majorNumber: null, minorNumber: null, legNumber: majorNumber,
        branchId, branchLetter: letter, forkNumber,
        displayNumber: `${forkNumber}·${letter}${branchMajor}`,
      };
    }
    branchMinor += 1;
    return {
      isMajor: false, majorNumber: null, minorNumber: branchMinor, legNumber: majorNumber,
      branchId, branchLetter: letter, forkNumber,
      displayNumber: `${forkNumber}·${letter}${branchMajor}.${branchMinor}`,
    };
  });
}

function branchIdOf(waypoint) {
  const value = waypoint && waypoint.branchId;
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * A branch may fork from another branch's waypoint, which has no trunk number.
 * Name that fork by its own branch letter so the chain stays readable rather
 * than collapsing to an anonymous "?".
 */
function branchNumberFallback(list, forkId, letterByBranchId, trunkNumberById) {
  if (!forkId) return '?';
  const owner = list.find(waypoint => waypoint.id === forkId);
  if (!owner) return '?';
  const ownerBranch = branchIdOf(owner);
  if (ownerBranch === null) return trunkNumberById.get(forkId) ?? '?';
  return letterByBranchId.get(ownerBranch) ?? '?';
}

/**
 * The list row's default title when the waypoint carries no authored name.
 *
 * @param {RouteNumberEntry} entry
 * @returns {string}
 */
export function waypointDisplayName(entry) {
  return `Waypoint ${entry.displayNumber}`;
}
