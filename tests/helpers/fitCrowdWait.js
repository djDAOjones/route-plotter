/**
 * A wait fitted by `waitForCrowdMs`, as "Wait here for this crowd" fitted it
 * until CROWD-06 retired the button: solved from the crowd's schedules against
 * the base timeline and the head's route-time arrival at the waypoint, then
 * written as the waypoint's own timed pause, the timing rebuilt, and kept in
 * history and recovery. The steps are the retired handler's
 * (`fitRouteWaitToCrowd`, `src/app/crowds.js` at e6cb2dd), so the tests that
 * pinned what such a wait does still run against what remains.
 */

import { waitForCrowdMs } from '../../src/utils/crowdArrival.js';

/**
 * @param {Object} app A booted RoutePlotter
 * @param {Object} layer The crowd
 * @param {Object} waypoint The major waypoint to hold at
 * @returns {boolean} Whether a wait was solved and written
 */
export function fitWaitWithWaitForCrowdMs(app, layer, waypoint) {
  const durationMs = app.animationEngine.state.baseDuration;
  const routeAnchors = app.getRouteArrivalMap?.();
  const arrivalMs = routeAnchors?.arrivalMsById?.[waypoint.id];
  if (!Number.isFinite(arrivalMs) || !(durationMs > 0)) return false;
  const schedules = app.swarmEngine.scheduleDots(layer, {
    durationMs,
    routePathPoints: app.pathPoints,
    routeAnchors,
  });
  const solved = waitForCrowdMs({
    schedules,
    arrivalMs,
    durationMs,
    currentWaitMs: waypoint.pauseMode === 'timed' ? (waypoint.pauseTime || 0) : 0,
  });
  if (!solved.satisfiable) return false;
  const waitMs = Math.ceil(solved.waitMs);
  waypoint.pauseMode = waitMs > 0 ? 'timed' : 'none';
  waypoint.pauseTime = waitMs;
  app.calculatePath();
  app.invalidateAnimationTiming();
  app.updateWaypointList();
  app.saveUndoState();
  app.autoSave();
  app.queueRender();
  return true;
}
