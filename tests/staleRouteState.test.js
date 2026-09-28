/**
 * DEF-06 — what a route scheduled does not outlive it.
 *
 * `calculatePath()` rebuilds what a route feeds: its path and branches, its
 * structure and the anchors its crowds follow; with fewer than two waypoints
 * it clears them, and now also what the route scheduled in the engine
 * (pauses, beacon schedules, speed segments, a wait at one of its waypoints)
 * and the renderer's beacons. Five callers skipped it below two waypoints
 * (Clear All, deleting down to one, undo and redo, a load, an outline edit),
 * so what the last route fed survived; once DEF-08 drew a paused beacon's
 * scale, a route cut to one waypoint drew that marker, paused, at the grow
 * scale of a route that no longer existed. The duration is left; a route
 * that comes back to schedules the clear took away has its timing rebuilt,
 * in either timing mode.
 */

import { expect, test } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { trunkWaypoints } from '../src/utils/routeBranches.js';

const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * The open day example, branched, with a grow beacon on one waypoint, and the
 * transport paused a quarter-second after that waypoint's arrival, where the
 * grow is scaling its marker.
 */
async function openDayMidGrow() {
  const app = await bootApp();
  await app.ready;
  const project = structuredClone(buildExampleProjects().find(each => each.id === 'uon-open-day').project);
  for (const waypoint of project.waypoints) {
    if (waypoint.id === 'ex-uon-3') waypoint.beaconStyle = 'grow';
    // A leg at its own speed, so the route has speed segments to leave behind.
    if (waypoint.id === 'ex-uon-2') waypoint.segmentSpeed = 2;
  }
  expect(await loadSnapshot(app, project)).toBe(true);
  app.invalidateAnimationTiming();
  const engine = app.animationEngine;
  const grow = engine.beaconSchedules.find(each => each.style === 'grow');
  const offset = (engine.startHandleTime || 0) + (engine.introTime || 0);
  engine.seekToProgress((grow.arrivalMs + 250 + offset) / engine.state.duration);
  app.render();
  const growing = app.waypoints.find(each => each.id === grow.waypointId);
  // The route before: branched, timed, at two speeds, and the grow scaling its marker.
  expect(app.branchPaths.length).toBeGreaterThan(0);
  expect(engine.segmentMarkers.length).toBeGreaterThan(0);
  expect(app.renderingService.getBeaconScaleOverride(growing)?.scale).toBeGreaterThan(1.1);
  expect(engine.state.isWaiting()).toBe(true);
  return { app, growing };
}

/** What a route feeds and schedules, as it stands. */
function routeState(app) {
  const engine = app.animationEngine;
  return {
    pathPoints: app.pathPoints.length,
    trunk: app._trunkWaypoints?.length ?? 0,
    branchPaths: app.branchPaths.length,
    branches: app.routeStructure.branches.length,
    pauses: engine.pauseMarkers.length,
    segments: engine.segmentMarkers.length,
    beacons: engine.beaconSchedules.length,
    waiting: engine.state.isWaiting(),
  };
}

const NO_ROUTE = { pathPoints: 0, trunk: 0, branchPaths: 0, branches: 0, pauses: 0, segments: 0, beacons: 0, waiting: false };

test('a route deleted down to one waypoint leaves nothing of itself, and its marker is drawn at rest', async () => {
  const { app, growing } = await openDayMidGrow();

  for (const waypoint of [...app.waypoints]) {
    if (waypoint !== growing) app.eventBus.emit('waypoint:delete', waypoint);
  }
  await nextTask();
  app.render();

  expect(app.waypoints).toEqual([growing]);
  expect(routeState(app)).toEqual(NO_ROUTE);
  expect(app.renderingService.getBeaconScaleOverride(growing)).toBeNull();
});

/** Past the 50 ms the app waits before it rebuilds a route's timing. */
const timingSettled = () => new Promise(resolve => setTimeout(resolve, 100));

test('undo back to one waypoint, and redo to two, each leave only what their route feeds', async () => {
  const { app, growing } = await openDayMidGrow();
  for (const waypoint of [...app.waypoints]) {
    if (waypoint !== growing) app.eventBus.emit('waypoint:delete', waypoint);
  }
  await nextTask();
  app.eventBus.emit('waypoint:add', { imgX: 0.8, imgY: 0.8, isMajor: true });
  await timingSettled();
  expect(app.waypoints).toHaveLength(2);
  expect(app.pathPoints.length).toBeGreaterThan(0);

  app.undo();
  await timingSettled();
  expect(app.waypoints).toHaveLength(1);
  expect(routeState(app)).toEqual(NO_ROUTE);

  app.redo();
  await timingSettled();
  expect(app.waypoints).toHaveLength(2);
  expect(routeState(app).pathPoints).toBeGreaterThan(0);
  expect(routeState(app).trunk).toBe(2);
  // The route's own timeline is back, built by the app, and it plays.
  app.play();
  app.animationEngine.updateAnimation(16, 16);
  expect(app.animationEngine.isPlaying()).toBe(true);
  expect(app.animationEngine.state.progress).toBeGreaterThan(0);
  expect(app.animationEngine.state.progress).toBeLessThan(1);
});

test('a constant-time project keeps its duration with no route, and plays when a second waypoint is added', async () => {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, {
    coordVersion: 9,
    waypoints: [{ id: 'first', imgX: 0.2, imgY: 0.2, isMajor: true }],
    animationState: { mode: 'constant-time', speed: 200, duration: 12000 },
  })).toBe(true);
  expect(app.animationEngine.state.duration).toBe(12000);

  app.eventBus.emit('waypoint:add', { imgX: 0.8, imgY: 0.8, isMajor: true });
  await timingSettled();
  app.play();
  app.animationEngine.updateAnimation(16, 16);

  expect(app.animationEngine.state.duration).toBe(12000);
  expect(app.animationEngine.isPlaying()).toBe(true);
  expect(app.animationEngine.state.progress).toBeGreaterThan(0);
  expect(app.animationEngine.state.progress).toBeLessThan(1);
  expect(app._buildProjectSnapshot().animationState.duration).toBe(12000);
});

test('a route deleted to no waypoint leaves no beacon in the renderer', async () => {
  const { app, growing } = await openDayMidGrow();

  for (const waypoint of [...app.waypoints]) app.eventBus.emit('waypoint:delete', waypoint);
  await nextTask();
  app.render();

  expect(app.waypoints).toEqual([]);
  expect(routeState(app)).toEqual(NO_ROUTE);
  expect(app.renderingService.getBeaconScaleOverride(growing)).toBeNull();
});

test('a trunk cut to one waypoint, its branch still there, leaves nothing the trunk scheduled', async () => {
  const { app } = await openDayMidGrow();
  const [first, ...rest] = trunkWaypoints(app.waypoints);
  expect(app.waypoints.length).toBeGreaterThan(rest.length + 1);

  for (const waypoint of rest) app.eventBus.emit('waypoint:delete', waypoint);
  await nextTask();

  expect(app.waypoints).toContain(first);
  expect(app.waypoints.length).toBeGreaterThan(1);
  expect(trunkWaypoints(app.waypoints)).toHaveLength(1);
  const { branches, ...scheduled } = routeState(app);
  expect(scheduled).toEqual({ ...NO_ROUTE, branches: undefined, branchPaths: 0 });
});

test('Clear All leaves nothing of the route: no branch, structure, anchors, timeline or beacon', async () => {
  const { app } = await openDayMidGrow();

  document.getElementById('clear-btn').click();
  document.getElementById('clear-confirm').click();
  await nextTask();

  expect(app.waypoints).toEqual([]);
  expect(routeState(app)).toEqual(NO_ROUTE);
  expect(app.anchorReport).toEqual({ bound: 0, broken: [] });
  expect(app._waypointProgressCache).toBeNull();
});

test('a project of one waypoint, opened over a route, leaves nothing of that route', async () => {
  const { app } = await openDayMidGrow();

  expect(await loadSnapshot(app, {
    coordVersion: 9,
    waypoints: [{ id: 'only', imgX: 0.5, imgY: 0.5, isMajor: true, beaconStyle: 'grow' }],
  })).toBe(true);
  app.render();

  expect(routeState(app)).toEqual(NO_ROUTE);
  expect(app.renderingService.getBeaconScaleOverride(app.waypoints[0])).toBeNull();
});

test('a constant-time route deleted down to one and undone gets back its pauses and beacons, as it had them', async () => {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, {
    coordVersion: 9,
    animationState: { mode: 'constant-time', speed: 200, duration: 12000 },
    waypoints: [
      { id: 'a', imgX: 0.2, imgY: 0.2, isMajor: true, pauseTime: 0 },
      { id: 'b', imgX: 0.5, imgY: 0.5, isMajor: true, pauseTime: 3000, beaconStyle: 'grow' },
      { id: 'c', imgX: 0.8, imgY: 0.8, isMajor: true, pauseTime: 0 },
    ],
  })).toBe(true);
  // Preview builds the route's timeline, as it does on main.
  app.eventBus.emit('motion:preview-mode-change', true);
  await timingSettled();
  const engine = app.animationEngine;
  const grow = engine.beaconSchedules.find(each => each.waypointId === 'b');
  const instant = grow.arrivalMs + 1000 + engine.startHandleTime + engine.introTime;
  const at = () => {
    engine.seekToTime(instant);
    app.render();
    return {
      duration: engine.state.duration,
      pauses: engine.pauseMarkers.length,
      beacons: engine.beaconSchedules.length,
      waiting: engine.state.isWaiting(),
      pathProgress: engine.state.pathProgress,
      scale: app.renderingService.getBeaconScaleOverride(app.getWaypointById('b'))?.scale,
    };
  };
  const before = at();
  expect(before).toMatchObject({ pauses: 1, beacons: 1, waiting: true });
  expect(before.scale).toBeGreaterThan(1.1);

  app.eventBus.emit('waypoint:delete', app.getWaypointById('c'));
  app.eventBus.emit('waypoint:delete', app.getWaypointById('a'));
  await timingSettled();
  expect(routeState(app)).toEqual(NO_ROUTE);
  app.undo();
  app.undo();
  await timingSettled();

  expect(app.waypoints.map(each => each.id)).toEqual(['a', 'b', 'c']);
  expect(engine.state.mode).toBe('constant-time');
  expect(at()).toEqual(before);
});

test('an outline edit to the one waypoint left moves the crowd node anchored to it', async () => {
  const app = await bootApp();
  await app.ready;
  const project = structuredClone(buildExampleProjects().find(each => each.id === 'uon-open-day').project);
  expect(await loadSnapshot(app, project)).toBe(true);
  const layer = app.scene.getFlowLayers().find(each => each.graph.getNodes().some(node => node.anchorWaypointId));
  const node = layer.graph.getNodes().find(each => each.anchorWaypointId);
  const anchor = app.getWaypointById(node.anchorWaypointId);
  for (const waypoint of [...app.waypoints]) {
    if (waypoint !== anchor) app.eventBus.emit('waypoint:delete', waypoint);
  }
  await nextTask();

  app.eventBus.emit('scene-outline:command', {
    action: 'update-waypoint', waypointId: anchor.id, x: 23, y: 34, waitSeconds: 0, segmentSpeed: 1,
  });

  expect(app.waypoints).toEqual([anchor]);
  expect({ x: anchor.imgX, y: anchor.imgY }).toEqual({ x: 0.23, y: 0.34 });
  expect(node.position()).toEqual({ x: 0.23, y: 0.34 });
});
