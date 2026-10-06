/**
 * A real transport for the TST-03 visibility matrix, and the arguments the
 * renderer hands `MotionVisibilityService` at an instant of it.
 *
 * The service's path and waypoint answers are functions of their arguments,
 * so seek == sequential is only worth checking with arguments that come from
 * somewhere: here, an `AnimationEngine` built the way `pathTiming.js`
 * builds one (pause markers from the waypoints, the comet's tail time, the
 * reveal modes' intro), either seeked straight to an instant or played to it
 * frame by frame. The arguments are assembled as `RenderingService` assembles
 * them (`renderPath`, `renderWaypoints`, the reveal branches of `render`),
 * from the engine's public API only.
 */

import { EventBus } from '../../src/core/EventBus.js';
import { AnimationEngine } from '../../src/services/AnimationEngine.js';
import { Waypoint } from '../../src/models/Waypoint.js';

/** Path travel in the route fixture, pauses excluded. */
export const ROUTE_PATH_MS = 10000;

/**
 * The route: five major waypoints. B waits 1 s and C 2 s, so the comet has a
 * held tail between waits, and D sits 60 ms of travel after C, so it is
 * closer than the 250 ms appear animation and starts appearing during C's
 * wait (the deficit rule, 190 ms of it). Waits: B 3000–4000 ms, C 7000–9000.
 * The path ends at 13000 ms.
 */
export const ROUTE = [
  { id: 'A', progress: 0, pauseTime: 0 },
  { id: 'B', progress: 0.3, pauseTime: 1000 },
  { id: 'C', progress: 0.6, pauseTime: 2000 },
  { id: 'D', progress: 0.606, pauseTime: 0 },
  { id: 'E', progress: 1, pauseTime: 0 },
];

export function routeWaypoints(route = ROUTE) {
  return route.map(({ id, progress, pauseTime, imgX = progress, imgY = 0.5 }) =>
    new Waypoint({ id, imgX, imgY, pauseTime, isMajor: true }));
}

/**
 * An engine for a route, timed as `updateAnimationDuration` times it in
 * Preview: intro, path, waits and tail, no handles.
 * @param {{route?: Array, pathMs?: number, tailMs?: number, tailHandleMs?: number, introMs?: number}} [options]
 *   `tailMs` is the comet's trail duration (`pathTrail × path`); Preview adds
 *   a 500 ms handle to it.
 */
export function routeEngine({ route = ROUTE, pathMs = ROUTE_PATH_MS, tailMs = 0, tailHandleMs = 500, introMs = 0 } = {}) {
  const engine = new AnimationEngine(new EventBus());
  const waypoints = routeWaypoints(route);
  const progressValues = route.map(each => each.progress);
  engine.pathDuration = pathMs;
  if (introMs > 0) engine.setIntroTime(introMs);
  engine.setPauseMarkers(waypoints, pathMs, progressValues, 0);
  if (tailMs > 0) engine.setTailTime(tailMs, tailHandleMs);
  engine.setDuration(introMs + pathMs + engine.totalPauseTime + engine.totalTailTime);
  return { engine, waypoints, progressValues };
}

/**
 * What `renderPath` passes `getPathVisibleRange` at the engine's instant,
 * after the settings: the path's progress and duration, the wait and tail
 * flags with their elapsed time, and the absolute timeline context. With a
 * context the service reads only progress, duration and the context; the
 * flags are passed as the renderer passes them, from the public API.
 */
export function pathArguments(engine) {
  const pathDuration = engine.pathDuration || (engine.state.baseDuration ?? engine.state.duration) || 1;
  const isWaiting = engine.state.isWaitingAtWaypoint || false;
  const isInTailTime = engine.isInTailTime();
  let pauseElapsed = 0;
  if (isInTailTime) pauseElapsed = engine.getTailTimeElapsed();
  else if (isWaiting) pauseElapsed = engine.getPauseState().elapsed;
  return {
    pathProgress: engine.getPathProgress(),
    pathDuration,
    isWaiting,
    pauseElapsed,
    isInTailTime,
    trailContext: engine.getTrailVisibilityContext(),
  };
}

/**
 * What `renderWaypoints` passes `getWaypointVisibility` for each major
 * waypoint, after the settings: its progress, the head's, the path duration,
 * its neighbours' progress (-1 and 2 for none), the engine's pause state
 * and the previous waypoint's wait.
 */
export function waypointArguments(engine, waypoints, progressValues) {
  const pathDuration = engine.pathDuration || (engine.state.baseDuration ?? engine.state.duration) || 1;
  const currentPathProgress = engine.getPathProgress() || 0;
  const pauseState = engine.getPauseState() || null;
  return waypoints.map((waypoint, index) => ({
    id: waypoint.id,
    waypointPathProgress: progressValues[index],
    currentPathProgress,
    pathDuration,
    prevWaypointProgress: index > 0 ? progressValues[index - 1] : -1,
    nextWaypointProgress: index < waypoints.length - 1 ? progressValues[index + 1] : 2,
    pauseState,
    prevWaypointPauseMs: index > 0 ? waypoints[index - 1].getPauseDuration() : 0,
  }));
}

/**
 * Play an engine from the start to each instant in turn, one `stepMs` frame
 * at a time, calling `visit(ms)` at every frame (so whatever is evaluated
 * there sees every frame between the instants) and `sample(ms)` at each
 * instant. Instants must be ascending and on the step's grid.
 */
export function playThrough(engine, instants, stepMs, visit, sample) {
  engine.seekToTime(0);
  const out = new Map();
  let ms = 0;
  visit(ms);
  for (const target of instants) {
    while (ms < target) {
      engine.updateAnimation(stepMs, 0);
      ms += stepMs;
      visit(ms);
    }
    out.set(target, sample(target));
  }
  return out;
}

/**
 * Play an engine backwards from its end to each instant in turn (reverse
 * playback: negative frames), as `playThrough` plays forwards.
 */
export function playBackThrough(engine, instants, stepMs, visit, sample) {
  const end = engine.state.duration;
  engine.seekToTime(end);
  const out = new Map();
  let ms = end;
  visit(ms);
  for (const target of [...instants].sort((a, b) => b - a)) {
    while (ms > target) {
      engine.updateAnimation(-stepMs, 0);
      ms -= stepMs;
      visit(ms);
    }
    out.set(target, sample(target));
  }
  return out;
}
