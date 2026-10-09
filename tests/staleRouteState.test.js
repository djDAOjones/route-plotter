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

import { describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot, LOAD_REFUSED } from './helpers/projectSnapshot.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { trunkWaypoints } from '../src/utils/routeBranches.js';
import { ANIMATION, STORAGE } from '../src/config/constants.js';
import { loadBackgroundFile } from '../src/app/backgroundLoading.js';

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

/**
 * What a route feeds and schedules, as it stands: its speed mode and the
 * wait the renderer reads (`getPauseState`) among them.
 */
function routeState(app) {
  const engine = app.animationEngine;
  return {
    pathPoints: app.pathPoints.length,
    trunk: app._trunkWaypoints?.length ?? 0,
    branchPaths: app.branchPaths.length,
    branches: app.routeStructure.branches.length,
    pauses: engine.pauseMarkers.length,
    segments: engine.segmentMarkers.length,
    variableSpeed: engine.getTimeline().hasVariableSpeed,
    beacons: engine.beaconSchedules.length,
    waiting: engine.state.isWaiting(),
    waitShown: engine.getPauseState().isWaiting,
  };
}

const NO_ROUTE = {
  pathPoints: 0, trunk: 0, branchPaths: 0, branches: 0, pauses: 0, segments: 0, variableSpeed: false, beacons: 0, waiting: false, waitShown: false,
};

test.each(['Preview', 'Edit'])('in %s, a route deleted down to one waypoint while it waits ends the wait the renderer reads too, once, naming the waypoint it waited at', async (mode) => {
  const { app, growing } = await openDayMidGrow();
  const engine = app.animationEngine;
  if (mode === 'Edit') {
    app.eventBus.emit('motion:preview-mode-change', false);
    await timingSettled();
    const pause = engine.pauseMarkers.find(each => each.duration > 0);
    engine.seekToTime((engine.startHandleTime || 0) + (engine.introTime || 0) + pause.timelineStartMs + 100);
  }
  expect(app.previewMode).toBe(mode === 'Preview');
  expect(engine.getPauseState().isWaiting).toBe(true);
  const waitedAt = engine.state.pauseWaypointIndex;
  expect(waitedAt).toBeGreaterThanOrEqual(0);
  const ended = vi.fn();
  app.eventBus.on('animation:waypointWaitEnd', ended);

  for (const waypoint of [...app.waypoints]) if (waypoint !== growing) app.eventBus.emit('waypoint:delete', waypoint);

  expect([engine.state.isWaiting(), engine.getPauseState().isWaiting, engine.state.pauseWaypointIndex]).toEqual([false, false, -1]);
  expect(ended.mock.calls).toEqual([[waitedAt]]);
  // And nothing else the route scheduled, its pauses and beacons among them, once its retiming has run
  await timingSettled();
  expect(routeState(app)).toEqual(NO_ROUTE);
});

test('a route with a leg at its own speed, deleted down to one, keeps its duration and plays through it evenly', async () => {
  const project = threeStops();
  project.waypoints[0].segmentSpeed = 2;
  const app = await derivedByPreview(project);
  const engine = app.animationEngine;
  expect(engine.getTimeline().hasVariableSpeed).toBe(true);

  app.eventBus.emit('waypoint:delete', app.getWaypointById('c'));
  app.eventBus.emit('waypoint:delete', app.getWaypointById('a'));
  await timingSettled();
  engine.seekToTime(engine.state.duration / 2);

  expect(engine.getTimeline().hasVariableSpeed).toBe(false);
  expect(engine.state.pathProgress).toBe(0.5);
});

test('a route deleted down to one leaves the transport where it was, and its last marker drawn as that place shows it', async () => {
  // The duration and the place in it are kept when a route goes. A reset of
  // the path's place passed every test that seeked afterwards, and drew a
  // marker set to hide once passed again.
  const app = await derivedByPreview(threeStops());
  const engine = app.animationEngine;
  app.eventBus.emit('waypoint:delete', app.getWaypointById('c'));
  await timingSettled();
  app.eventBus.emit('motion:waypoint-visibility-change', 'hide-after');
  engine.seekToProgress(0.6);
  const transport = () => ({
    duration: engine.state.duration, pathProgress: engine.state.pathProgress,
    progress: engine.state.progress, currentTime: engine.state.currentTime,
  });
  const kept = transport();
  expect(kept.pathProgress).toBeGreaterThan(0);

  app.eventBus.emit('waypoint:delete', app.getWaypointById('a'));
  await timingSettled();
  expect(transport()).toEqual(kept);

  const visibility = vi.spyOn(app.motionVisibilityService, 'getWaypointVisibility');
  app.render();
  expect(visibility.mock.calls.map(([waypoint]) => waypoint.id)).toEqual(['b']);
  expect(visibility.mock.results[0].value.visible).toBe(false);
});

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

test('in Edit, a route deleted down to one waypoint draws nothing more of the ripple it had started there, at once or once its timing settles', async () => {
  // The engine's schedules are not all a clear must take: the renderer keeps
  // each beacon it started, and one left behind draws on, in Edit as in Preview
  const { app, growing } = await openDayMidGrow();
  growing.beaconStyle = 'ripple';
  app.invalidateAnimationTiming();
  const engine = app.animationEngine;
  const ripple = engine.beaconSchedules.find(each => each.waypointId === growing.id);
  expect(ripple.style).toBe('ripple');
  const offset = (engine.startHandleTime || 0) + (engine.introTime || 0);
  engine.seekToProgress((ripple.arrivalMs + 250 + offset) / engine.state.duration);
  app.render();
  app.eventBus.emit('motion:preview-mode-change', false);
  const beacon = app.renderingService.beaconRenderer.beacons.get(growing.id);
  const drawn = vi.spyOn(beacon, 'render');
  app.render();
  // Drawing, in Edit
  expect(drawn).toHaveBeenCalled();
  drawn.mockClear();

  for (const waypoint of [...app.waypoints]) {
    if (waypoint !== growing) app.eventBus.emit('waypoint:delete', waypoint);
  }
  app.render();
  expect(drawn).not.toHaveBeenCalled();
  await timingSettled();
  app.render();

  expect(drawn).not.toHaveBeenCalled();
  // The waypoint's beacon is a new one, idle: no schedule starts it
  const now = app.renderingService.beaconRenderer.beacons.get(growing.id);
  expect(now).not.toBe(beacon);
  expect(now?.isActive() ?? false).toBe(false);
  expect(routeState(app)).toEqual(NO_ROUTE);
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

test.each([['in one turn', false], ['a moment apart', true]])('a constant-time route deleted down to one and undone (the undos %s) gets back its timeline, as it had it', async (_, apart) => {
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
  const pausesAt = engine.pauseMarkers.map(marker => marker.pathProgress);
  expect(before).toMatchObject({ pauses: 1, beacons: 1, waiting: true });
  expect(before.scale).toBeGreaterThan(1.1);

  app.eventBus.emit('waypoint:delete', app.getWaypointById('c'));
  app.eventBus.emit('waypoint:delete', app.getWaypointById('a'));
  await timingSettled();
  expect(routeState(app)).toEqual(NO_ROUTE);
  app.undo();
  if (apart) await timingSettled();
  app.undo();
  await timingSettled();

  expect(app.waypoints.map(each => each.id)).toEqual(['a', 'b', 'c']);
  expect(engine.state.mode).toBe('constant-time');
  expect(engine.pauseMarkers.map(marker => marker.pathProgress)).toEqual(pausesAt);
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

/** A constant-time project of `waypoints`, as a file opens it: its duration the author's. */
const authoredConstantTime = waypoints => ({
  coordVersion: 9,
  animationState: { mode: 'constant-time', speed: 200, duration: 12000 },
  waypoints,
});

/** What a constant-time project can be opened over. */
const OPENED_OVER = [
  ['over a route with its timeline', async app => app],
  ['over a route deleted down to one', async (app) => {
    for (const waypoint of app.waypoints.slice(1)) app.eventBus.emit('waypoint:delete', waypoint);
    await timingSettled();
  }],
  ['over Clear All', async () => {
    document.getElementById('clear-btn').click();
    document.getElementById('clear-confirm').click();
    await timingSettled();
  }],
];

test.each(OPENED_OVER)('a constant-time project of one waypoint, opened %s, keeps the duration it was saved with when its second is added', async (_, before) => {
  const { app } = await openDayMidGrow();
  await before(app);

  expect(await loadSnapshot(app, authoredConstantTime([{ id: 'first', imgX: 0.2, imgY: 0.2, isMajor: true }]))).toBe(true);
  app.eventBus.emit('waypoint:add', { imgX: 0.8, imgY: 0.8, isMajor: true });
  await timingSettled();

  expect(app.animationEngine.state.duration).toBe(12000);
  expect(app._buildProjectSnapshot().animationState.duration).toBe(12000);
});

test.each(OPENED_OVER)('a constant-time project of two waypoints, opened %s, keeps the duration it was saved with, and nothing the previous route scheduled', async (_, before) => {
  const { app } = await openDayMidGrow();
  await before(app);

  expect(await loadSnapshot(app, authoredConstantTime([
    { id: 'first', imgX: 0.2, imgY: 0.2, isMajor: true },
    { id: 'second', imgX: 0.8, imgY: 0.8, isMajor: true },
  ]))).toBe(true);
  await timingSettled();

  expect(app.animationEngine.state.duration).toBe(12000);
  expect(app._buildProjectSnapshot().animationState.duration).toBe(12000);
  const engine = app.animationEngine;
  expect({ pauses: engine.pauseMarkers.length, segments: engine.segmentMarkers.length, beacons: engine.beaconSchedules.length })
    .toEqual({ pauses: 0, segments: 0, beacons: 0 });
});

/** A constant-time project of three stops, the middle one pausing with a grow beacon, or not at all. */
const threeStops = ({ pausing = true } = {}) => authoredConstantTime([
  { id: 'a', imgX: 0.2, imgY: 0.2, isMajor: true, pauseTime: 0 },
  { id: 'b', imgX: 0.5, imgY: 0.5, isMajor: true, pauseTime: pausing ? 3000 : 0, beaconStyle: pausing ? 'grow' : 'none' },
  { id: 'c', imgX: 0.8, imgY: 0.8, isMajor: true, pauseTime: 0 },
]);

/** An app with `project` open, in Preview or Edit. */
async function opened(project, { preview = true } = {}) {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, project)).toBe(true);
  if (!preview) app.eventBus.emit('motion:preview-mode-change', false);
  expect(app.previewMode).toBe(preview);
  return app;
}

/** Timing rebuilt for the route by Preview, as it is on `main`: the duration is then the rebuild's. */
async function derivedByPreview(project) {
  const app = await opened(project);
  app.eventBus.emit('motion:preview-mode-change', true);
  await timingSettled();
  expect(app._timingDerived).toBe(true);
  return app;
}

/** Move a waypoint, as a finished drag or an arrow key does. */
const move = (app, id, imgX, imgY) => app.eventBus.emit('waypoint:position-changed', { waypoint: app.getWaypointById(id), imgX, imgY });

/** The last recovery written, as the page left now writes the autosave the app has queued. */
function recoveryOnLeaving() {
  localStorage.setItem.mockClear();
  window.dispatchEvent(new Event('pagehide'));
  const writes = localStorage.setItem.mock.calls.filter(([key]) => key === STORAGE.AUTOSAVE_KEY);
  expect(writes).toHaveLength(1);
  return JSON.parse(writes[0][1]);
}

/** The duration a fresh app gives `recovery`, restoring it as the browser does. */
async function reopenedDuration(recovery) {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, recovery)).toBe(true);
  await timingSettled();
  return app.animationEngine.state.duration;
}

/** Ways a derived constant-time route changes, each ending on the route it keeps. */
const DERIVED_CHANGES = [
  ['a stop moved, its timing derived by Preview', async () => {
    const app = await derivedByPreview(threeStops());
    move(app, 'b', 0.25, 0.7);
    return app;
  }],
  ['a stop moved in Edit, its timing derived by the speed control', async () => {
    const app = await opened(threeStops({ pausing: false }), { preview: false });
    app.eventBus.emit('animation:speed-change', 200);
    await timingSettled();
    expect(app._timingDerived).toBe(true);
    move(app, 'b', 0.25, 0.7);
    return app;
  }],
  ['the route deleted to one stop, and undone a moment apart', async () => {
    const app = await derivedByPreview(threeStops());
    app.eventBus.emit('waypoint:delete', app.getWaypointById('c'));
    app.eventBus.emit('waypoint:delete', app.getWaypointById('a'));
    await timingSettled();
    app.undo();
    await timingSettled();
    app.undo();
    return app;
  }],
];

test.each(DERIVED_CHANGES)('recovery written the moment after %s keeps the route with its own duration', async (_, change) => {
  const app = await change();

  const recovery = recoveryOnLeaving();

  await timingSettled();
  const live = app.animationEngine.state.duration;
  expect(recovery.waypoints.map(each => [each.id, each.imgX, each.imgY]))
    .toEqual(app.waypoints.map(each => [each.id, each.imgX, each.imgY]));
  expect(recovery.animationState.duration).toBe(live);
  expect(await reopenedDuration(recovery)).toBe(live);
});

test('recovery written after the autosave delay keeps a moved stop with its own duration', async () => {
  const app = await derivedByPreview(threeStops());
  const before = app.animationEngine.state.duration;
  localStorage.setItem.mockClear();

  move(app, 'b', 0.25, 0.7);
  await new Promise(resolve => setTimeout(resolve, STORAGE.AUTOSAVE_INTERVAL + 200));

  const live = app.animationEngine.state.duration;
  expect(live).not.toBe(before);
  const recovery = JSON.parse(localStorage.setItem.mock.calls.filter(([key]) => key === STORAGE.AUTOSAVE_KEY).at(-1)[1]);
  expect(recovery.waypoints[1]).toMatchObject({ imgX: 0.25, imgY: 0.7 });
  expect(recovery.animationState.duration).toBe(live);
});

/** The engine's timeline and live timing, as the player and the renderers read them. */
const timelineOf = app => ({ ...app.animationEngine.getTimeline(), ...app.animationEngine.getLiveTiming() });

test.each([
  ['a Spotlight Reveal’s intro', app => app.eventBus.emit('motion:background-visibility-change', 'spotlight-reveal')],
  ['a comet path’s tail', app => app.eventBus.emit('motion:path-visibility-change', 'instantaneous')],
])('a constant-time project opened over %s is timed as a fresh app opens it, its route played evenly over its duration', async (_, timeline) => {
  const app = await derivedByPreview(threeStops());
  timeline(app);
  await timingSettled();
  const engine = app.animationEngine;
  expect(engine.introTime + engine.totalTailTime).toBeGreaterThan(0);

  const incoming = authoredConstantTime([
    { id: 'first', imgX: 0.2, imgY: 0.2, isMajor: true },
    { id: 'second', imgX: 0.8, imgY: 0.8, isMajor: true },
  ]);
  incoming.motionSettings = { backgroundVisibility: 'always-show', pathVisibility: 'always-show' };
  expect(await loadSnapshot(app, incoming)).toBe(true);
  await timingSettled();

  const fresh = await opened(incoming);
  await timingSettled();
  expect(timelineOf(app)).toEqual(timelineOf(fresh));
  const progressAt = ms => {
    engine.seekToTime(ms);
    return engine.state.pathProgress;
  };
  expect(engine.state.duration).toBe(12000);
  expect([progressAt(1000), progressAt(6000), progressAt(12000)]).toEqual([1 / 12, 0.5, 1]);
});

test('after an open that failed and was rolled back, the next move of a derived constant-time route rebuilds its timing', async () => {
  const app = await derivedByPreview(threeStops());
  const before = app.animationEngine.state.duration;
  allowConsole(LOAD_REFUSED);
  vi.spyOn(app, 'pruneImageAssets').mockImplementationOnce(() => { throw new Error('late failure'); });
  expect(await loadSnapshot(app, authoredConstantTime([{ id: 'only', imgX: 0.5, imgY: 0.5, isMajor: true }]))).toBe(false);
  expect(app.waypoints.map(each => each.id)).toEqual(['a', 'b', 'c']);

  move(app, 'b', 0.25, 0.7);
  await timingSettled();

  const [pause] = app.animationEngine.pauseMarkers;
  expect(app.animationEngine.pauseMarkers).toHaveLength(1);
  expect(pause.pathProgress).toBeCloseTo(app.getWaypointProgressValues()[1], 8);
  expect(app.animationEngine.state.duration).not.toBe(before);
});

test.each([
  ['the speed control', app => app.eventBus.emit('animation:speed-change', 220)],
  ['a pause edited', app => {
    const stop = app.getWaypointById('b');
    stop.pauseTime = 3400;
    app.eventBus.emit('waypoint:pause-changed', { waypoint: stop, pauseTime: 3400, pauseMode: 'timed' });
  }],
])('in Edit, a constant-time route whose timing %s rebuilt is rebuilt again when a stop moves', async (_, derive) => {
  const app = await opened(threeStops(), { preview: false });
  derive(app);
  await timingSettled();
  const before = app.animationEngine.state.duration;
  expect(app.animationEngine.pauseMarkers[0].pathProgress).toBeCloseTo(0.5, 8);

  move(app, 'b', 0.25, 0.7);
  await timingSettled();

  expect(app.animationEngine.pauseMarkers[0].pathProgress).toBeCloseTo(app.getWaypointProgressValues()[1], 8);
  expect(app.animationEngine.pauseMarkers[0].pathProgress).not.toBeCloseTo(0.5, 3);
  const moved = app.animationEngine.state.duration;
  expect(moved).not.toBe(before);
  // …at the speed set, not the default's
  const { speed } = app.animationEngine.state;
  expect(moved).toBeCloseTo(rebuiltAt(app, speed), 6);
});

/** The duration the route as it stands has at `speed`, rebuilt now: what any retime should give. */
function rebuiltAt(app, speed) {
  app.calculatePath();
  return app.invalidateAnimationTiming(speed);
}

test.each([80, 650].flatMap(speed => ['constant-time', 'constant-speed'].flatMap(mode =>
  ['at once', 'once its retime has run'].map(when => [speed, mode, when]))))(
  'at %i px/s, a %s route whose stop moved and was saved %s has, saves and reopens with its duration at that speed', async (speed, mode, when) => {
  // A retime at the default speed, not the speed set, passed every test that
  // asked only that the duration change, or that saved and live agree.
  const project = threeStops();
  Object.assign(project.animationState, { mode, speed });
  const app = await derivedByPreview(project);
  dragging(app, 'b', 0.3, 0.7);
  if (when !== 'at once') await timingSettled();
  const saved = await savedProject(app);
  await timingSettled();
  const live = app.animationEngine.state.duration;
  const reopened = await reopenedDuration(saved);

  expect(app.animationEngine.state.speed).toBe(speed);
  const expected = rebuiltAt(app, speed);
  expect(expected).not.toBeCloseTo(rebuiltAt(app, ANIMATION.DEFAULT_SPEED), 0);
  expect(live).toBeCloseTo(expected, 6);
  // A constant-speed file's duration is rebuilt when it opens; a constant-time one's is kept.
  if (mode === 'constant-time') expect(saved.animationState.duration).toBeCloseTo(expected, 6);
  expect(reopened).toBeCloseTo(expected, 6);
});

/** A stop dragged and not yet let go: the route changes, and nothing is saved. */
const dragging = (app, id, imgX, imgY) => app.eventBus.emit('waypoint:position-changed', { waypoint: app.getWaypointById(id), imgX, imgY, isDragging: true });

test.each([
  ['Save Project', async (app) => {
    let saved = null;
    vi.spyOn(app.imageAssetService, 'exportZip').mockImplementation(async (project) => { saved = project; return new Blob(['zip']); });
    vi.spyOn(app.imageAssetService, 'downloadZip').mockImplementation(() => {});
    await app.saveProject();
    return saved;
  }],
  ['an HTML export', async (app) => {
    // An HTML export carries its background, so the project needs one.
    const image = Object.assign(new Image(), { naturalWidth: 1600, naturalHeight: 900, width: 1600, height: 900 });
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: png, getImageElement: async () => image });
    expect(await loadBackgroundFile(app, new File(['x'], 'background.png', { type: 'image/png' }))).toBe(true);
    dragging(app, 'b', 0.3, 0.65);
    let saved = null;
    vi.spyOn(app.htmlExportService, 'estimateSize').mockResolvedValue({ formatted: '1 KB' });
    vi.spyOn(app.htmlExportService, 'exportHTML').mockImplementation(async ({ projectData }) => { saved = projectData; return new Blob(['html']); });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await app.exportHTML();
    return saved;
  }],
].flatMap(([name, save]) => ['Preview', 'Edit'].map(mode => [name, mode, save])))('%s made mid-drag in %s, before the route’s rebuild has run, holds the route with its own duration', async (_, mode, save) => {
  // Each save settles the route's timing itself, in either mode: an HTML
  // export that settled it only in Preview held, in Edit, the duration before
  const app = await derivedByPreview(threeStops());
  if (mode === 'Edit') {
    app.eventBus.emit('motion:preview-mode-change', false);
    await timingSettled();
  }
  dragging(app, 'b', 0.25, 0.7);

  const saved = await save(app);

  await timingSettled();
  const b = app.getWaypointById('b');
  expect(saved.waypoints.find(each => each.id === 'b')).toMatchObject({ imgX: b.imgX, imgY: b.imgY });
  expect(saved.animationState.duration).toBe(app.animationEngine.state.duration);
  // …the route as it stands, rebuilt at the speed set
  expect(saved.animationState.duration).toBeCloseTo(rebuiltAt(app, app.animationEngine.state.speed), 6);
});

test('a video export begun just after a stop moved keeps the duration it began with, all through', async () => {
  const app = await derivedByPreview(threeStops());
  move(app, 'b', 0.25, 0.7);
  vi.stubGlobal('alert', vi.fn());
  const durations = [];
  let requested;
  app.videoExporter = {
    cancel() {},
    async export({ renderFrame }) {
      requested = app.animationEngine.state.duration;
      await renderFrame(0.1);
      durations.push(app.animationEngine.state.duration);
      // Past the 50 ms a queued rebuild waits.
      await timingSettled();
      await renderFrame(0.5);
      durations.push(app.animationEngine.state.duration);
      return new Blob(['video']);
    },
  };
  vi.spyOn(app, 'announce');
  const { VideoExporter } = await import('../src/services/VideoExporter.js');
  vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});

  await app.exportVideo();

  expect(durations).toEqual([requested, requested]);
  vi.unstubAllGlobals();
});

test.each([
  // A drag under way queues the rebuild and saves nothing.
  ['when its time came', app => dragging(app, 'b', 0.25, 0.7)],
  ['when the save that followed it settled it', app => move(app, 'b', 0.25, 0.7)],
])('once a route’s rebuild has run (%s), a change that leaves the route alone rebuilds nothing', async (_, change) => {
  const app = await derivedByPreview(threeStops());
  change(app);
  await timingSettled();
  const rebuilds = vi.spyOn(app, 'updateAnimationDuration');

  app.autoSave();

  expect(rebuilds).not.toHaveBeenCalled();
});

test('in constant-speed timing, a run of saved edits to the route is rebuilt once, after the last', async () => {
  const project = threeStops();
  project.animationState = { mode: 'constant-speed', speed: 200, duration: 0 };
  const app = await opened(project);
  await timingSettled();
  const rebuilds = vi.spyOn(app, 'updateAnimationDuration');

  for (let step = 1; step <= 10; step += 1) move(app, 'b', 0.5 - step * 0.01, 0.5);

  expect(rebuilds).not.toHaveBeenCalled();
  await timingSettled();
  expect(rebuilds).toHaveBeenCalledTimes(1);
});

test.each([
  ['a Spotlight Reveal’s intro', app => app.eventBus.emit('motion:background-visibility-change', 'spotlight-reveal')],
  ['a comet path’s tail', app => app.eventBus.emit('motion:path-visibility-change', 'instantaneous')],
])('a constant-time project of one waypoint opened over %s, given its second, is timed as a fresh app times it', async (_, timeline) => {
  const app = await derivedByPreview(threeStops());
  timeline(app);
  await timingSettled();
  const incoming = authoredConstantTime([{ id: 'first', imgX: 0.2, imgY: 0.2, isMajor: true }]);
  incoming.motionSettings = { backgroundVisibility: 'always-show', pathVisibility: 'always-show' };
  expect(await loadSnapshot(app, incoming)).toBe(true);
  app.eventBus.emit('waypoint:add', { imgX: 0.8, imgY: 0.8, isMajor: true });
  await timingSettled();

  const fresh = await opened(incoming);
  fresh.eventBus.emit('waypoint:add', { imgX: 0.8, imgY: 0.8, isMajor: true });
  await timingSettled();
  expect(timelineOf(app)).toEqual(timelineOf(fresh));
  app.animationEngine.seekToTime(6000);
  expect(app.animationEngine.state.pathProgress).toBe(0.5);
});

test.each([
  ['a Spotlight Reveal’s intro', app => app.eventBus.emit('motion:background-visibility-change', 'spotlight-reveal'), 'introMs'],
  ['a comet path’s tail', app => app.eventBus.emit('motion:path-visibility-change', 'instantaneous'), 'totalTailMs'],
])('a route deleted down to one keeps the last timeline’s %s, as on main', async (_, timeline, field) => {
  const app = await derivedByPreview(threeStops());
  timeline(app);
  app.eventBus.emit('waypoint:delete', app.getWaypointById('c'));
  await timingSettled();
  const kept = app.animationEngine.getLiveTiming()[field];
  expect(kept).toBeGreaterThan(0);

  app.eventBus.emit('waypoint:delete', app.getWaypointById('a'));
  await timingSettled();

  expect(app.waypoints).toHaveLength(1);
  expect(app.animationEngine.getLiveTiming()[field]).toBe(kept);
});

/** A constant-time project whose one-stop branch leaves its fork and rejoins at its end, a minor between them. */
const branched = () => authoredConstantTime([
  { id: 'a', imgX: 0.1, imgY: 0.2, isMajor: true, pauseTime: 0 },
  { id: 'fork', imgX: 0.2, imgY: 0.2, isMajor: true, pauseTime: 0 },
  { id: 'minor', imgX: 0.25, imgY: 0.2, isMajor: false },
  { id: 'end', imgX: 0.3, imgY: 0.2, isMajor: true, pauseTime: 0 },
  { id: 'b', imgX: 0.9, imgY: 0.9, isMajor: true, pauseTime: 0, branchId: 'B', branchFrom: 'fork', branchRejoin: 'end' },
]);

/** Save Project, as the author asks for it: the project it writes. */
async function savedProject(app) {
  let saved = null;
  vi.spyOn(app.imageAssetService, 'exportZip').mockImplementation(async (project) => { saved = project; return new Blob(['zip']); });
  vi.spyOn(app.imageAssetService, 'downloadZip').mockImplementation(() => {});
  await app.saveProject();
  return saved;
}

/**
 * The branch's end dragged over `targetId`, and let go there (once the
 * drag's queued retiming has run, or at once): the rebuilds the drop made
 * (the path built, the timing rebuilt, the queued rebuild's time let pass),
 * and the toasts it asked for.
 */
async function droppedOn(app, targetId, { atOnce = false } = {}) {
  const end = app.getWaypointById('b');
  const start = { imgX: end.imgX, imgY: end.imgY };
  const target = app.getWaypointById(targetId);
  dragging(app, 'b', target.imgX, target.imgY);
  if (!atOnce) await timingSettled();
  const built = vi.spyOn(app, 'calculatePath');
  const timed = vi.spyOn(app, 'updateAnimationDuration');
  const told = vi.fn();
  app.eventBus.on('ui:toast', told);
  const drop = app.imageToCanvas(target.imgX, target.imgY);
  app.eventBus.emit('waypoint:drag-ended', { waypoint: end, dropX: drop.x, dropY: drop.y, dragGroup: [{ waypoint: end, ...start }] });
  await timingSettled();
  const work = { built: built.mock.calls.length, timed: timed.mock.calls.length, toasts: told.mock.calls.length };
  built.mockRestore();
  timed.mockRestore();
  app.eventBus.off('ui:toast', told);
  return { end, start, work };
}

test('a branch end dropped on a minor, its rejoin refused, is back where it was, its route built and timed once, nothing recorded or said but the refusal, and Save Project then holds the route with the duration a rebuild gives it', async () => {
  const app = await derivedByPreview(branched());
  app.eventBus.emit('motion:preview-mode-change', false);
  await timingSettled();
  app.storageService.flushAutoSave();
  app._isDirty = false;
  const before = { dirty: app._isDirty, revision: app._editRevision, history: app.undoService.createSnapshot() };
  const announced = vi.spyOn(app, 'announce');
  const saving = vi.spyOn(app, 'autoSave');

  const { end, start, work } = await droppedOn(app, 'minor');

  expect(work).toEqual({ built: 1, timed: 1, toasts: 1 });
  expect(end).toMatchObject({ ...start, branchRejoin: 'end' });
  expect({ dirty: app._isDirty, revision: app._editRevision, history: app.undoService.createSnapshot() }).toEqual(before);
  // Said once: the refusal's toast is its announcement (UI-06 J-05).
  expect(announced).toHaveBeenCalledTimes(1);
  expect(saving).not.toHaveBeenCalled();

  const saved = await savedProject(app);

  // The route as it is, rebuilt from nothing.
  app.calculatePath();
  app.invalidateAnimationTiming();
  expect(saved.animationState.duration).toBe(app.animationEngine.state.duration);
});

test.each([80, 650])('at %i px/s, a branch end dropped on a minor, its rejoin refused, is timed at that speed: Save Project holds the route rebuilt at it, and the path’s own travel', async (speed) => {
  // The refusal's rebuild times the route by the queued retime, at the speed
  // set; one at the default speed passed the default-speed test above. At 80
  // the branch's own timeline hides a trunk timed wrong in the total, so the
  // path's travel time is compared too.
  const project = branched();
  project.animationState.speed = speed;
  const app = await derivedByPreview(project);
  app.eventBus.emit('motion:preview-mode-change', false);
  await timingSettled();

  const { end, start, work } = await droppedOn(app, 'minor');

  expect(work).toEqual({ built: 1, timed: 1, toasts: 1 });
  expect(end).toMatchObject({ ...start, branchRejoin: 'end' });
  const travel = app.animationEngine.pathDuration;
  const saved = await savedProject(app);
  expect(app.animationEngine.state.speed).toBe(speed);
  const expected = rebuiltAt(app, speed);
  expect(saved.animationState.duration).toBeCloseTo(expected, 6);
  expect(travel, 'the path’s own travel').toBeCloseTo(app.animationEngine.pathDuration, 6);
});

test.each([
  ['cleared, dropped on the major it rejoins at', 1, null],
  ['made again, dropped there once more', 2, 'end'],
])('a branch end’s rejoin %s: the route is built once and timed once for it, and Save Project holds the duration a rebuild gives it', async (_, drops, rejoin) => {
  const app = await derivedByPreview(branched());
  app.eventBus.emit('motion:preview-mode-change', false);
  await timingSettled();

  let work;
  for (let drop = 0; drop < drops; drop += 1) ({ work } = await droppedOn(app, 'end'));

  expect(work).toEqual({ built: 1, timed: 1, toasts: 1 });
  expect(app.getWaypointById('b').branchRejoin ?? null).toBe(rejoin);
  const saved = await savedProject(app);
  app.calculatePath();
  app.invalidateAnimationTiming();
  expect(saved.animationState.duration).toBe(app.animationEngine.state.duration);
});

describe.each([
  ['made', null, 'end', 'Branch rejoins at that waypoint'],
  ['cleared', 'end', null, 'Branch now ends here'],
])('a branch end’s rejoin %s by a drop', (_, initial, rejoin, message) => {
  /** The branched route with its rejoin as `initial`, its timing derived, in Edit, nothing pending. */
  async function editing() {
    const project = branched();
    project.waypoints.at(-1).branchRejoin = initial;
    const app = await derivedByPreview(project);
    app.eventBus.emit('motion:preview-mode-change', false);
    await timingSettled();
    app.storageService.flushAutoSave();
    app._isDirty = false;
    return app;
  }

  test.each([['once the drag is retimed', false], ['at once', true]])('let go %s, is recorded once, said once and written for recovery, and undone and redone', async (__, atOnce) => {
    const app = await editing();
    const revision = app._editRevision;
    const recorded = vi.spyOn(app, 'saveUndoState');
    const saving = vi.spyOn(app, 'autoSave');
    const announced = vi.spyOn(app, 'announce');

    const { end, start, work } = await droppedOn(app, 'end', { atOnce });

    expect(work).toEqual({ built: 1, timed: 1, toasts: 1 });
    expect({ imgX: end.imgX, imgY: end.imgY, branchRejoin: end.branchRejoin ?? null }).toEqual({ ...start, branchRejoin: rejoin });
    expect(recorded).toHaveBeenCalledTimes(1);
    expect(saving).toHaveBeenCalledTimes(1);
    expect(app._editRevision - revision).toBe(1);
    // The toast is the announcement, at its priority: one message, heard once (UI-06 J-05);
    // before it, the opened project's first change, heard once (the owner, 2026-10-09).
    expect(announced.mock.calls).toEqual([['Unsaved changes'], [message, 'polite']]);
    localStorage.setItem.mockClear();
    app.storageService.flushAutoSave();
    const writes = localStorage.setItem.mock.calls.filter(([key]) => key === STORAGE.AUTOSAVE_KEY);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0][1]).waypoints.at(-1).branchRejoin ?? null).toBe(rejoin);

    app.undo();
    await timingSettled();
    expect(app.getWaypointById('b').branchRejoin ?? null).toBe(initial);
    app.redo();
    await timingSettled();
    expect(app.getWaypointById('b').branchRejoin ?? null).toBe(rejoin);
  });

  test('then dragged on, Save Project before the drag is retimed holds the duration a rebuild gives the new route', async () => {
    const app = await editing();
    await droppedOn(app, 'end');

    dragging(app, 'b', 0.7, 0.4);
    const saved = await savedProject(app);

    // The route as it is, rebuilt from nothing.
    app.calculatePath();
    app.invalidateAnimationTiming();
    expect(saved.animationState.duration).toBe(app.animationEngine.state.duration);
  });
});

test('an HTML export made mid-drag runs the route’s queued rebuild, and changes nothing else: no edit, no history, no recovery written', async () => {
  const app = await derivedByPreview(threeStops());
  const image = Object.assign(new Image(), { naturalWidth: 1600, naturalHeight: 900, width: 1600, height: 900 });
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: png, getImageElement: async () => image });
  expect(await loadBackgroundFile(app, new File(['x'], 'background.png', { type: 'image/png' }))).toBe(true);
  app.storageService.flushAutoSave();
  app._isDirty = false;
  dragging(app, 'b', 0.3, 0.65);
  const before = { dirty: app._isDirty, revision: app._editRevision, history: app.undoService.createSnapshot(), pending: app.storageService._pendingAutoSave };
  localStorage.setItem.mockClear();
  vi.spyOn(app.htmlExportService, 'estimateSize').mockResolvedValue({ formatted: '1 KB' });
  vi.spyOn(app.htmlExportService, 'exportHTML').mockResolvedValue(new Blob(['html']));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  await app.exportHTML();

  expect(app._durationUpdateTimeout).toBeNull();
  expect({ dirty: app._isDirty, revision: app._editRevision, history: app.undoService.createSnapshot(), pending: app.storageService._pendingAutoSave })
    .toEqual(before);
  expect(localStorage.setItem.mock.calls.filter(([key]) => key === STORAGE.AUTOSAVE_KEY)).toEqual([]);
});

test.each(['Preview', 'Edit'].flatMap(mode => [2, -2].map(rate => [mode, rate])))('in %s, a route deleted down to one while it plays at %ix goes on playing at that rate, as the transport is kept', async (mode, rate) => {
  // Whether it is playing, and at what rate, is part of the transport, which
  // a route that goes leaves as it was (Clear All's reset is its own)
  const app = await derivedByPreview(threeStops());
  if (mode === 'Edit') app.eventBus.emit('motion:preview-mode-change', false);
  app.eventBus.emit('waypoint:delete', app.getWaypointById('c'));
  await timingSettled();
  app.animationEngine.play();
  app.animationEngine.setPlaybackSpeed(rate);
  expect([app.animationEngine.isPlaying(), app.animationEngine.state.playbackSpeed]).toEqual([true, rate]);

  app.eventBus.emit('waypoint:delete', app.getWaypointById('a'));

  expect([app.animationEngine.isPlaying(), app.animationEngine.state.playbackSpeed]).toEqual([true, rate]);
  await timingSettled();
  expect([app.animationEngine.isPlaying(), app.animationEngine.state.playbackSpeed]).toEqual([true, rate]);
});

test.each([
  ['undone', app => app.undo()],
  // Not where c was: a route as long as the one before the clear would be
  // timed right by a duration kept from it
  ['given a second stop', app => app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.4, isMajor: true })],
])('a route authored at 80 px/s and deleted down to one keeps that speed, and the route that comes back (%s) is timed at it, live and in the saved file', async (_, comeBack) => {
  // The speed a route is authored at (px/s) is the project's, and not the
  // transport's rate (the 2× and -2× above): a clear that put it back to the
  // default 200 went unnoticed, and timed the route that came back at it
  const project = threeStops();
  project.animationState.speed = 80;
  const app = await derivedByPreview(project);
  app.eventBus.emit('waypoint:delete', app.getWaypointById('c'));
  await timingSettled();
  app.eventBus.emit('waypoint:delete', app.getWaypointById('a'));
  await timingSettled();
  expect(app.waypoints.map(each => each.id)).toEqual(['b']);
  const kept = app.animationEngine.state.speed;

  comeBack(app);
  await timingSettled();
  expect(app.waypoints).toHaveLength(2);
  const live = app.animationEngine.state.duration;
  const saved = await savedProject(app);

  const expected = rebuiltAt(app, 80);
  expect(expected).not.toBeCloseTo(rebuiltAt(app, ANIMATION.DEFAULT_SPEED), 0);
  for (const [where, duration] of [['live', live], ['the saved file', saved.animationState.duration]]) {
    expect(duration, where).toBeCloseTo(expected, 6);
  }
  expect({ cleared: kept, saved: saved.animationState.speed }).toEqual({ cleared: 80, saved: 80 });
});

test.each(['Preview', 'Edit'])('in %s, a stop moved while the route plays is saved with its duration at the speed set: in recovery, in the saved file, and reopened', async (mode) => {
  // Each save settles the route's timing itself, playing or not: a settle that
  // passed over a playing transport left recovery and the file with the
  // duration from before the move
  const project = threeStops();
  project.animationState.speed = 80;
  const app = await derivedByPreview(project);
  if (mode === 'Edit') {
    app.eventBus.emit('motion:preview-mode-change', false);
    await timingSettled();
  }
  app.animationEngine.play();
  expect(app.animationEngine.isPlaying()).toBe(true);
  const before = app.animationEngine.state.duration;

  move(app, 'b', 0.25, 0.7);
  const recovery = recoveryOnLeaving();
  const saved = await savedProject(app);
  const reopened = await reopenedDuration(saved);

  app.animationEngine.pause();
  const expected = rebuiltAt(app, 80);
  expect(expected).not.toBeCloseTo(before, 0);
  for (const [where, duration] of [['recovery', recovery.animationState.duration], ['the saved file', saved.animationState.duration], ['reopened', reopened]]) {
    expect(duration, where).toBeCloseTo(expected, 6);
  }
});

/** A background loaded, as an HTML export needs one, and the retime it brings run. */
async function withBackground(app) {
  const image = Object.assign(new Image(), { naturalWidth: 1600, naturalHeight: 900, width: 1600, height: 900 });
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: png, getImageElement: async () => image });
  expect(await loadBackgroundFile(app, new File(['x'], 'background.png', { type: 'image/png' }))).toBe(true);
  await timingSettled();
}

/** An HTML export, as the author asks for it: the project it embeds. */
async function htmlExported(app) {
  let embedded = null;
  vi.spyOn(app.htmlExportService, 'estimateSize').mockResolvedValue({ formatted: '1 KB' });
  vi.spyOn(app.htmlExportService, 'exportHTML').mockImplementation(async ({ projectData }) => { embedded = projectData; return new Blob(['html']); });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await app.exportHTML();
  return embedded;
}

/**
 * The route at 80 px/s in `mode`, playing (at `rate`, 1× unless given), a
 * stop dragged and not yet let go (which saves nothing): its rebuild still
 * queued, the duration the one from before the drag. No recovery written and
 * no save has run that rebuild, so what a save made next holds is that save's
 * own settling.
 */
async function playingMidDrag(mode, { background = false, rate = 1 } = {}) {
  const project = threeStops();
  project.animationState.speed = 80;
  const app = await derivedByPreview(project);
  if (mode === 'Edit') {
    app.eventBus.emit('motion:preview-mode-change', false);
    await timingSettled();
  }
  if (background) await withBackground(app);
  app.animationEngine.play();
  if (rate !== 1) app.animationEngine.setPlaybackSpeed(rate);
  const before = app.animationEngine.state.duration;

  dragging(app, 'b', 0.25, 0.7);

  expect({ playing: app.animationEngine.isPlaying(), rate: app.animationEngine.state.playbackSpeed, queued: Boolean(app._durationUpdateTimeout), duration: app.animationEngine.state.duration })
    .toEqual({ playing: true, rate, queued: true, duration: before });
  return { app, before };
}

test.each(['Preview', 'Edit'])('in %s, Save Project made mid-drag while the route plays at 80 px/s, nothing having run the route’s rebuild before it, saves the route with its duration rebuilt at that speed, and the file reopens with it', async (mode) => {
  // Save Project settles the route's timing itself, while it plays. In the
  // test above, the finished move's recovery snapshot had settled it first, so
  // a Save Project that skipped its own settle while playing passed the whole
  // gate, and saved and reopened the duration from before the move
  const { app, before } = await playingMidDrag(mode);

  const saved = await savedProject(app);

  expect(app.animationEngine.isPlaying()).toBe(true);
  app.animationEngine.pause();
  expect(app.animationEngine.state.speed).toBe(80);
  const expected = rebuiltAt(app, 80);
  expect(expected).not.toBeCloseTo(before, 0);
  expect(expected).not.toBeCloseTo(rebuiltAt(app, ANIMATION.DEFAULT_SPEED), 0);
  expect(saved.waypoints.find(each => each.id === 'b')).toMatchObject({ imgX: 0.25, imgY: 0.7 });
  expect(saved.animationState.duration, 'the saved file').toBeCloseTo(expected, 6);
  expect(await reopenedDuration(saved), 'reopened').toBeCloseTo(expected, 6);
});

test.each(['Preview', 'Edit'])('in %s, an HTML export made mid-drag while the route plays at 80 px/s, nothing having run the route’s rebuild before it, embeds the route with its duration rebuilt at that speed', async (mode) => {
  // As Save Project: the export settles the route's timing itself, while it
  // plays. The exported player rebuilds a constant-time route's duration from
  // its speed (the plan's exception), but the project it embeds is the
  // project's snapshot, and holds the route with its own duration
  const { app, before } = await playingMidDrag(mode, { background: true });

  const embedded = await htmlExported(app);

  expect(app.animationEngine.isPlaying()).toBe(true);
  app.animationEngine.pause();
  expect(app.animationEngine.state.speed).toBe(80);
  const expected = rebuiltAt(app, 80);
  expect(expected).not.toBeCloseTo(before, 0);
  expect(expected).not.toBeCloseTo(rebuiltAt(app, ANIMATION.DEFAULT_SPEED), 0);
  expect(embedded.waypoints.find(each => each.id === 'b')).toMatchObject({ imgX: 0.25, imgY: 0.7 });
  expect(embedded.animationState.duration, 'the embedded project').toBeCloseTo(expected, 6);
});

/**
 * Rates the transport plays at other than 1×. A rate multiplies how fast the
 * timeline plays; the route's speed (80 px/s here) is the project's, and its
 * duration is the route's at that speed, whatever the rate. 2× and -2× (in
 * reverse) are what L and J reach, each pressed twice; 0.5× is a rate the
 * engine's transport takes (any from 0.1× to 16×, either way) and the
 * exported player's menu offers, though no key in the editor reaches it.
 */
const PLAYBACK_RATES = [2, -2, 0.5];

/**
 * A snapshot made while the route at 80 px/s plays at `rate` leaves the
 * transport playing at that rate, and holds the route with the duration it
 * has at 80 px/s, in the snapshot, live and, where it `reopens`, reopened:
 * the route rebuilt once the transport is paused, and so back at 1×, with no
 * rate in the rebuild, and checked to differ from the route timed at 80 px/s
 * times the rate. The speed saved is 80 px/s, and the rate is not saved.
 */
async function heldAtTheSpeedAuthored(app, { rate, before, snapshot, reopens }) {
  expect({ playing: app.animationEngine.isPlaying(), rate: app.animationEngine.state.playbackSpeed }, 'the transport')
    .toEqual({ playing: true, rate });
  const live = app.animationEngine.state.duration;
  app.animationEngine.pause();
  expect({ rate: app.animationEngine.state.playbackSpeed, speed: app.animationEngine.state.speed }).toEqual({ rate: 1, speed: 80 });
  const expected = rebuiltAt(app, 80);
  expect(expected).not.toBeCloseTo(before, 0);
  expect(expected, 'the route timed at the rate played').not.toBeCloseTo(rebuiltAt(app, 80 * Math.abs(rate)), 0);
  expect(snapshot.waypoints.find(each => each.id === 'b')).toMatchObject({ imgX: 0.25, imgY: 0.7 });
  expect(snapshot.animationState).toMatchObject({ mode: 'constant-time', speed: 80 });
  expect(snapshot.animationState).not.toHaveProperty('playbackSpeed');
  for (const [where, duration] of [['the snapshot', snapshot.animationState.duration], ['live', live]]) {
    expect(duration, where).toBeCloseTo(expected, 6);
  }
  if (reopens) expect(await reopenedDuration(snapshot), 'reopened').toBeCloseTo(expected, 6);
}

test.each(['Preview', 'Edit'].flatMap(mode => PLAYBACK_RATES.map(rate => [mode, rate])))('in %s, a stop let go while the route at 80 px/s plays at %s×, its rebuild still queued, writes recovery holding the route’s duration at 80 px/s, not at the rate played, and recovery reopens with it', async (mode, rate) => {
  // Every other snapshot in this file is made at 1×: a retime that timed the
  // route at its speed times the transport's rate passed the whole gate, and
  // at 2× saved and reopened 8,089 ms for a route that rebuilds at 11,519
  const { app, before } = await playingMidDrag(mode, { rate });
  const b = app.getWaypointById('b');

  // Let go, as the canvas reports it: the drop records the move and writes recovery
  app.eventBus.emit('waypoint:drag-ended', { waypoint: b, dragGroup: [{ waypoint: b, imgX: 0.5, imgY: 0.5 }] });
  const recovery = recoveryOnLeaving();

  await heldAtTheSpeedAuthored(app, { rate, before, snapshot: recovery, reopens: true });
});

test.each(['Preview', 'Edit'].flatMap(mode => PLAYBACK_RATES.map(rate => [mode, rate])))('in %s, Save Project made mid-drag while the route at 80 px/s plays at %s×, nothing having run the route’s rebuild before it, saves the route with its duration at 80 px/s, not at the rate played, and the file reopens with it', async (mode, rate) => {
  const { app, before } = await playingMidDrag(mode, { rate });

  const saved = await savedProject(app);

  await heldAtTheSpeedAuthored(app, { rate, before, snapshot: saved, reopens: true });
});

test.each(['Preview', 'Edit'].flatMap(mode => PLAYBACK_RATES.map(rate => [mode, rate])))('in %s, an HTML export made mid-drag while the route at 80 px/s plays at %s×, nothing having run the route’s rebuild before it, embeds the route with its duration at 80 px/s, not at the rate played', async (mode, rate) => {
  // Not reopened: the exported player rebuilds the route's timing from the
  // speed it embeds (the plan's exception), so that speed is held to the one
  // authored too
  const { app, before } = await playingMidDrag(mode, { background: true, rate });

  const embedded = await htmlExported(app);

  await heldAtTheSpeedAuthored(app, { rate, before, snapshot: embedded, reopens: false });
});

test.each([80, 650].flatMap(speed => ['made', 'cleared'].map(action => [speed, action])))('at %i px/s, a rejoin %s times the route at that speed: live, in recovery, in the saved file, reopened, and in the path’s own travel', async (speed, action) => {
  // A rejoin retimes the route at once, by its own call, not the retime a
  // move queues. A long trunk, so a trunk timed at the wrong speed shows in
  // the total at 650 px/s; at 80 the branch's own timeline would hide it
  // there, so the path's travel time is compared too.
  const project = branched();
  project.animationState.speed = speed;
  project.waypoints.find(each => each.id === 'end').imgX = 0.9;
  Object.assign(project.waypoints.at(-1), { imgX: 0.25, imgY: 0.21, branchRejoin: action === 'made' ? null : 'end' });
  const app = await derivedByPreview(project);
  app.eventBus.emit('motion:preview-mode-change', false);
  await timingSettled();
  const { work } = await droppedOn(app, 'end', { atOnce: true });
  expect(work).toEqual({ built: 1, timed: 1, toasts: 1 });
  expect(app.getWaypointById('b').branchRejoin).toBe(action === 'made' ? 'end' : null);
  const live = app.animationEngine.state.duration;
  const travel = app.animationEngine.pathDuration;
  const recovery = recoveryOnLeaving();
  const saved = await savedProject(app);
  const reopened = await reopenedDuration(saved);

  expect(app.animationEngine.state.speed).toBe(speed);
  const expected = rebuiltAt(app, speed);
  for (const [where, duration] of [['live', live], ['recovery', recovery.animationState.duration], ['the saved file', saved.animationState.duration], ['reopened', reopened]]) {
    expect(duration, where).toBeCloseTo(expected, 6);
  }
  expect(travel, 'the path’s own travel').toBeCloseTo(app.animationEngine.pathDuration, 6);
});

test.each(['Preview', 'Edit'].flatMap(mode => ['made', 'cleared'].flatMap(action => PLAYBACK_RATES.map(rate => [mode, action, rate]))))('in %s, a rejoin %s while the route at 650 px/s plays at %s× is timed at 650 px/s, not at the rate played: live, in the path’s own travel, in recovery, the saved file and the HTML export, and recovery and the file reopen with it', async (mode, action, rate) => {
  // A rejoin retimes the route by its own call, not the queued retime the
  // rate cases above hold to the speed authored, and every rejoin test played
  // at 1×: a rejoin that timed the route at its speed times the rate passed
  // the whole gate, and at 0.5× saved and reopened 4,388 ms for a route that
  // rebuilds at 2,944. At 2× and -2× the branch's own timeline, timed at the
  // speed authored, hides the trunk timed wrong in the total, so the path's
  // own travel is compared too (722 ms at 2×, -722 at -2×, for 1,444).
  const project = branched();
  project.animationState.speed = 650;
  project.waypoints.find(each => each.id === 'end').imgX = 0.9;
  Object.assign(project.waypoints.at(-1), { imgX: 0.25, imgY: 0.21, branchRejoin: action === 'made' ? null : 'end' });
  const rejoin = action === 'made' ? 'end' : null;
  const app = await derivedByPreview(project);
  if (mode === 'Edit') {
    app.eventBus.emit('motion:preview-mode-change', false);
    await timingSettled();
  }
  // Loaded before the gesture, so the export follows it with no retime between
  await withBackground(app);
  app.animationEngine.play();
  app.animationEngine.setPlaybackSpeed(rate);
  const transport = () => ({ playing: app.animationEngine.isPlaying(), rate: app.animationEngine.state.playbackSpeed });

  const { work } = await droppedOn(app, 'end', { atOnce: true });

  expect(work).toEqual({ built: 1, timed: 1, toasts: 1 });
  expect({ rejoin: app.getWaypointById('b').branchRejoin, ...transport() }).toEqual({ rejoin, playing: true, rate });
  const live = app.animationEngine.state.duration;
  const travel = app.animationEngine.pathDuration;
  const recovery = recoveryOnLeaving();
  const saved = await savedProject(app);
  const embedded = await htmlExported(app);
  expect(transport(), 'the transport').toEqual({ playing: true, rate });

  // The route rebuilt at 650 px/s once the transport is paused, and so back at
  // 1×, with no rate in the rebuild; its path's travel checked to differ from
  // the path timed at 650 px/s times the rate
  app.animationEngine.pause();
  expect({ rate: app.animationEngine.state.playbackSpeed, speed: app.animationEngine.state.speed })
    .toEqual({ rate: 1, speed: 650 });
  const expected = rebuiltAt(app, 650);
  const expectedTravel = app.animationEngine.pathDuration;
  rebuiltAt(app, 650 * Math.abs(rate));
  expect(app.animationEngine.pathDuration, 'the path timed at the rate played').not.toBeCloseTo(expectedTravel, 0);
  expect(live, 'live').toBeCloseTo(expected, 6);
  expect(travel, 'the path’s own travel').toBeCloseTo(expectedTravel, 6);
  for (const [where, snapshot] of [['recovery', recovery], ['the saved file', saved], ['the HTML export', embedded]]) {
    expect(snapshot.waypoints.find(each => each.id === 'b').branchRejoin ?? null, where).toBe(rejoin);
    expect(snapshot.animationState, where).toMatchObject({ mode: 'constant-time', speed: 650 });
    expect(snapshot.animationState, where).not.toHaveProperty('playbackSpeed');
    expect(snapshot.animationState.duration, where).toBeCloseTo(expected, 6);
  }
  for (const [where, snapshot] of [['recovery', recovery], ['the saved file', saved]]) {
    expect(await reopenedDuration(snapshot), `${where}, reopened`).toBeCloseTo(expected, 6);
  }
});
