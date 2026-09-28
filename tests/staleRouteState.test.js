/**
 * DEF-06 — nothing a route fed outlives it.
 *
 * `calculatePath()` rebuilds everything a route feeds: its path and branches,
 * its structure, the anchors its crowds follow, and, through the engine, the
 * timeline (duration, pauses, speed segments, beacon schedules). With fewer
 * than two waypoints it clears them. Five callers skipped it below two
 * waypoints (Clear All, deleting down to one, undo and redo, a load, an
 * outline edit), so what the last route fed survived; once DEF-08 drew a
 * paused beacon's scale, a route cut to one waypoint drew that marker, paused,
 * at the grow scale of a route that no longer existed.
 */

import { expect, test } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { buildExampleProjects } from '../src/examples/index.js';

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
  return { app, growing };
}

/** Everything a route feeds, as it stands. */
function routeState(app) {
  const engine = app.animationEngine;
  return {
    pathPoints: app.pathPoints.length,
    trunk: app._trunkWaypoints?.length ?? 0,
    branchPaths: app.branchPaths.length,
    branches: app.routeStructure.branches.length,
    duration: engine.state.duration,
    pathDuration: engine.pathDuration,
    pauses: engine.pauseMarkers.length,
    segments: engine.segmentMarkers.length,
    beacons: engine.beaconSchedules.length,
  };
}

const NO_ROUTE = { pathPoints: 0, trunk: 0, branchPaths: 0, branches: 0, duration: 0, pathDuration: 0, pauses: 0, segments: 0, beacons: 0 };

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

test('undo back to one waypoint, and redo to two, each leave only what their route feeds', async () => {
  const { app, growing } = await openDayMidGrow();
  for (const waypoint of [...app.waypoints]) {
    if (waypoint !== growing) app.eventBus.emit('waypoint:delete', waypoint);
  }
  await nextTask();
  app.eventBus.emit('waypoint:add', { imgX: 0.8, imgY: 0.8, isMajor: true });
  await nextTask();
  expect(app.waypoints).toHaveLength(2);
  app.invalidateAnimationTiming();
  expect(routeState(app).duration).toBeGreaterThan(0);

  app.undo();
  await nextTask();
  expect(app.waypoints).toHaveLength(1);
  expect(routeState(app)).toEqual(NO_ROUTE);

  app.redo();
  await nextTask();
  app.invalidateAnimationTiming();
  expect(app.waypoints).toHaveLength(2);
  expect(routeState(app).pathPoints).toBeGreaterThan(0);
  expect(routeState(app).duration).toBeGreaterThan(0);
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
