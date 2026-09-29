/**
 * DEF-42 — a beacon edit keeps the old schedule.
 *
 * A beacon's style decides its schedule (when its clock starts, how long it
 * holds) and, with a ripple's scale and a pulse's cycle, how long its
 * waypoint pauses. The schedules and pauses are built only when timing is
 * rebuilt, and the inspector's style and pulse-cycle controls only redrew
 * (a ripple's went through its wait time, which rebuilds), so the editor
 * went on timing a beacon by the style it had, or not at all if it had none,
 * until something else rebuilt timing, such as a mode switch. Both now
 * rebuild timing, as the motion settings do; the editor's timeline after an
 * edit is the one the project, saved then, opens with.
 * On a branched route (the open day example is one), rebuilding timing also
 * composes the branches' timeline afresh: it had been kept per path and
 * speed, so a pause or beacon edit there kept the old total.
 */

import { expect, test } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { buildExampleProjects } from '../src/examples/index.js';

/** The open day example, its waypoints given `beacons` settings by id. */
function openDay(beacons = {}, animationState = null) {
  const project = structuredClone(buildExampleProjects().find(each => each.id === 'uon-open-day').project);
  for (const [id, beacon] of Object.entries(beacons)) {
    Object.assign(project.waypoints.find(each => each.id === id), beacon);
  }
  if (animationState) project.animationState = { ...project.animationState, ...animationState };
  return project;
}

/** Past the 50 ms the app waits before it rebuilds a route's timing. */
const timingSettled = () => new Promise(resolve => setTimeout(resolve, 100));

/** An app with `project` open, as opening it leaves it, in Preview or (toggled) Edit. */
async function opened(project, { edit = false } = {}) {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, project)).toBe(true);
  if (edit) document.getElementById('mode-toggle-btn').click();
  await timingSettled();
  expect(app.previewMode).toBe(!edit);
  return app;
}

/** Numbers rounded far below any authored control, so equal timings compare equal. */
const plain = value => JSON.parse(JSON.stringify(value, (_, each) => (typeof each === 'number' ? Math.round(each * 1e6) / 1e6 : each)));

/** The timeline as the editor plays it: duration, pauses, beacon schedules, and each branch's leg. */
function timeline(app) {
  const engine = app.animationEngine;
  const branches = app.getBranchTimeline?.();
  return plain({
    duration: engine.state.duration,
    pauses: engine.pauseMarkers.map(({ waypointIndex, pathProgress, timelineStartMs, duration }) => ({
      waypointIndex, pathProgress, timelineStartMs, duration,
    })),
    beacons: engine.beaconSchedules,
    legs: branches ? Object.values(branches.legsById).map(({ id, durationMs, arrivalOffsetsById, pathDurationMs, totalPauseMs }) => ({
      id, durationMs, arrivalOffsetsById, pathDurationMs, totalPauseMs,
    })) : null,
  });
}

/** The timeline the project, saved now, opens with in a fresh app, in the same mode. */
async function reopened(app) {
  return timeline(await opened(app._buildProjectSnapshot(), { edit: !app.previewMode }));
}

/** Select waypoints in the editor, as a click, or a modified click, on their rows does. */
function select(app, ...ids) {
  const [primary, ...more] = ids.map(id => app.getWaypointById(id));
  app.eventBus.emit('waypoint:selected', primary);
  if (more.length > 0) app.eventBus.emit('waypoint:multi-selected', { waypoints: [primary, ...more], primary });
}

function choose(id, value, type = 'change') {
  const control = document.getElementById(id);
  control.value = String(value);
  control.dispatchEvent(new Event(type, { bubbles: true }));
}

const scheduleOf = (app, id) => app.animationEngine.beaconSchedules.find(each => each.waypointId === id);

test.each([
  ['pop', 'grow'],
  ['none', 'grow'],
  ['grow', 'ripple'],
  ['ripple', 'pulse'],
  ['pulse', 'none'],
  ['glow', 'pop'],
  ['pop', 'glow'],
])('a beacon changed from %s to %s in the inspector is timed by its new style at once', async (from, to) => {
  const app = await opened(openDay({ 'ex-uon-2': { beaconStyle: from, rippleWait: false } }));
  select(app, 'ex-uon-2');

  choose('editor-beacon-style', to);

  expect(timeline(app)).toEqual(await reopened(app));
  if (to !== 'none') expect(scheduleOf(app, 'ex-uon-2')?.style).toBe(to);
});

test('a ripple made larger in the inspector pauses as long as it now lasts, at once', async () => {
  const app = await opened(openDay({ 'ex-uon-2': { beaconStyle: 'ripple', rippleMaxScale: 1000, rippleWait: false } }));
  select(app, 'ex-uon-2');

  choose('ripple-max-scale', 3000, 'input');

  expect(timeline(app)).toEqual(await reopened(app));
});

test('a pulse given a slower cycle in the inspector pauses for its whole cycle, at once', async () => {
  const app = await opened(openDay({ 'ex-uon-2': { beaconStyle: 'pulse', pulseCycleSpeed: 2 } }));
  select(app, 'ex-uon-2');

  choose('pulse-cycle-speed', 8, 'input');

  expect(timeline(app)).toEqual(await reopened(app));
});

test('a pause shortened in the inspector on a branched route shortens the route’s total at once', async () => {
  const app = await opened(openDay({ 'ex-uon-2': { beaconStyle: 'none', pauseMode: 'timed', pauseTime: 6000 } }));
  const before = timeline(app).duration;
  select(app, 'ex-uon-2');

  choose('waypoint-pause-time', app.uiController.pauseTimeToSlider(2), 'input');

  expect(timeline(app).duration).toBeLessThan(before);
  expect(timeline(app)).toEqual(await reopened(app));
});

test('a beacon changed for two selected waypoints times both by the new style at once', async () => {
  const app = await opened(openDay({ 'ex-uon-2': { beaconStyle: 'none' }, 'ex-uon-3': { beaconStyle: 'none' } }));
  select(app, 'ex-uon-2', 'ex-uon-3');

  choose('editor-beacon-style', 'grow');

  expect([scheduleOf(app, 'ex-uon-2')?.style, scheduleOf(app, 'ex-uon-3')?.style]).toEqual(['grow', 'grow']);
  expect(timeline(app)).toEqual(await reopened(app));
});

test('a beacon changed in Edit is timed by its new style at once', async () => {
  const app = await opened(openDay({ 'ex-uon-2': { beaconStyle: 'none' } }), { edit: true });
  select(app, 'ex-uon-2');

  choose('editor-beacon-style', 'grow');

  expect(scheduleOf(app, 'ex-uon-2')?.style).toBe('grow');
  expect(timeline(app)).toEqual(await reopened(app));
});

test('a beacon on a branch’s own waypoint given a slower pulse retimes that branch at once', async () => {
  const app = await opened(openDay({ 'ex-uon-b1': { beaconStyle: 'pulse', pulseCycleSpeed: 2 } }));
  const leg = () => timeline(app).legs.find(each => each.id !== null && each.id !== undefined);
  const before = leg();
  select(app, 'ex-uon-b1');

  choose('pulse-cycle-speed', 8, 'input');

  expect(leg().totalPauseMs).toBeGreaterThan(before.totalPauseMs);
  expect(timeline(app)).toEqual(await reopened(app));
});

test('a beacon changed in a constant-time project is timed as any rebuild of it would time it, at once', async () => {
  const app = await opened(openDay({ 'ex-uon-2': { beaconStyle: 'none' } }, { mode: 'constant-time' }));
  select(app, 'ex-uon-2');

  choose('editor-beacon-style', 'grow');

  const edited = timeline(app);
  expect(scheduleOf(app, 'ex-uon-2')?.style).toBe('grow');
  app.invalidateAnimationTiming();
  expect(timeline(app)).toEqual(edited);
});

test('a beacon edit undone, and redone, times the beacon as the project then has it', async () => {
  const app = await opened(openDay({ 'ex-uon-2': { beaconStyle: 'pop' } }));
  const original = timeline(app);
  select(app, 'ex-uon-2');
  choose('editor-beacon-style', 'grow');
  const edited = timeline(app);
  expect(edited).not.toEqual(original);

  app.undo();
  await timingSettled();
  expect(app.getWaypointById('ex-uon-2').beaconStyle).toBe('pop');
  expect(timeline(app)).toEqual(original);

  app.redo();
  await timingSettled();
  expect(app.getWaypointById('ex-uon-2').beaconStyle).toBe('grow');
  expect(timeline(app)).toEqual(edited);
});
