// CORE-01: v3's limits on a project's size, carried into v4 (the plan's §15: "their checks and limits kept"). Each
// names where it stands in frozen v3, under v3/. The limits of single settings are on their fields in settings.ts.

export const LIMITS = Object.freeze({
  /** An id is 1 to 256 characters (v3/src/utils/entityId.js:7). */
  idLength: 256,
  /** Routes in a scene: v3's flow layers, each a network a crowd ran on (v3/src/models/Scene.js:4). */
  routes: 32,
  /**
   * Points in a scene, all routes together: v3's network nodes (v3/src/models/Scene.js:7). A v4 route is both the
   * hero route and a network (A1), so the network's larger limit is kept; v3's 2,000 waypoints
   * (v3/src/app/persistence.js:65) were the hero route's alone.
   */
  points: 10_000,
  /** Lines in a scene, all routes together: v3's network edges (v3/src/models/Scene.js:8). */
  lines: 20_000,
  /** A stop's pause (v3/src/app/persistence.js:74). */
  pauseMs: 10 * 60 * 1000,
  /** All of a route's pauses together (v3/src/app/persistence.js:75). */
  routePausesMs: 24 * 60 * 60 * 1000,
  /** Any time in the scene: a start, a total time, a fixed length (v3/src/app/persistence.js:72). */
  timeMs: 24 * 60 * 60 * 1000,
  /** A label's text (v3/src/app/persistence.js:69). */
  textLength: 100_000,
  /**
   * Where a point may stand, in image fractions: v3's authoring and load range, off the image included
   * (v3/src/config/constants.js:102–105; the rules file's first invariant).
   */
  coordinateMin: -10,
  coordinateMax: 11,
});
