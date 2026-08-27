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
  let majorNumber = 0;
  let minorNumber = 0;

  return waypoints.map(waypoint => {
    if (waypoint?.isMajor) {
      majorNumber += 1;
      minorNumber = 0;
      return {
        isMajor: true,
        majorNumber,
        minorNumber: null,
        legNumber: majorNumber,
        displayNumber: String(majorNumber),
      };
    }

    minorNumber += 1;
    return {
      isMajor: false,
      majorNumber: null,
      minorNumber,
      legNumber: majorNumber,
      displayNumber: `${majorNumber}.${minorNumber}`,
    };
  });
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
