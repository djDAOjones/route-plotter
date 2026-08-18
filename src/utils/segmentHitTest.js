/**
 * Pure geometry for route-segment hit-testing (Phase 4 canvas affordances).
 *
 * The route path is a dense polyline (PathCalculator output, evenly
 * resampled). A "leg" here is the span between two consecutive waypoints
 * of any type — the same span the inspector's Leg card names ("Leg →
 * Waypoint 3"): waypoint i owns the leg from itself to waypoint i+1.
 *
 * All inputs are in one coordinate space (callers pass canvas coords for
 * pointer work); no DOM, no app state — unit-tested in isolation.
 */

/**
 * Map waypoint progress values (0-1 along the path) to polyline point
 * indices. Same formula renderPath uses for segment boundaries, so
 * hit-testing and drawing agree on where a leg starts and ends.
 *
 * @param {Array<number>} progressValues - Per-waypoint progress (0-1)
 * @param {number} totalPoints - Polyline point count
 * @returns {Array<number>} Point index per waypoint
 */
export function waypointPointIndices(progressValues, totalPoints) {
  return progressValues.map(p => Math.round(p * (totalPoints - 1)));
}

/**
 * Find the nearest point on a polyline to (x, y), by perpendicular
 * projection onto each polyline segment (not nearest-vertex, so thin
 * straight legs with sparse points still hit accurately).
 *
 * @param {Array<{x: number, y: number}>} points - Polyline points
 * @param {number} x
 * @param {number} y
 * @returns {{index: number, dist: number, px: number, py: number}|null}
 *          index is fractional: segment start index + projection t (0-1).
 */
export function nearestOnPolyline(points, x, y) {
  if (!points || points.length < 2) return null;

  let best = null;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = ((x - a.x) * dx + (y - a.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const distSq = (x - px) * (x - px) + (y - py) * (y - py);
    if (!best || distSq < best.distSq) {
      best = { index: i + t, distSq, px, py };
    }
  }
  return { index: best.index, dist: Math.sqrt(best.distSq), px: best.px, py: best.py };
}

/**
 * Map a (fractional) polyline point index to the waypoint that owns the
 * leg it falls in: the last waypoint whose point index is <= the hit,
 * clamped so the final waypoint (which has no outgoing leg) never owns.
 *
 * @param {number} pointIndex - Fractional polyline index from nearestOnPolyline
 * @param {Array<number>} wpPointIndices - From waypointPointIndices()
 * @returns {number} Owning waypoint index (0 .. waypoints.length - 2)
 */
export function legIndexForPointIndex(pointIndex, wpPointIndices) {
  let leg = 0;
  for (let i = 1; i < wpPointIndices.length - 1; i++) {
    if (pointIndex >= wpPointIndices[i]) leg = i;
    else break;
  }
  return leg;
}

/**
 * Polyline point index of a leg's midpoint. The polyline is evenly
 * resampled, so the index midpoint is the arc-length midpoint — where
 * the "+" insert handle sits.
 *
 * @param {Array<number>} wpPointIndices - From waypointPointIndices()
 * @param {number} legIndex - Owning waypoint index
 * @returns {number} Integer polyline index of the leg midpoint
 */
export function legMidpointIndex(wpPointIndices, legIndex) {
  const a = wpPointIndices[legIndex];
  const b = wpPointIndices[legIndex + 1];
  return Math.round((a + b) / 2);
}
