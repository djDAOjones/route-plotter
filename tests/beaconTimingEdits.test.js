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
 * edit is the one a project saved with that beacon would open with.
 * On a branched route (the open day example is one), rebuilding timing also
 * composes the branches' timeline afresh: it had been kept per path and
 * speed, so a pause or beacon edit there kept the old total.
 */

import { expect, test } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { buildExampleProjects } from '../src/examples/index.js';

/** The open day example, its second trunk major given `beacon` settings. */
function openDay(beacon = {}) {
  const project = structuredClone(buildExampleProjects().find(each => each.id === 'uon-open-day').project);
  const waypoint = project.waypoints.find(each => each.id === 'ex-uon-2');
  Object.assign(waypoint, beacon);
  return project;
}

/** An app with `project` open and its timeline built, as opening it leaves it. */
async function opened(project) {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, project)).toBe(true);
  app.invalidateAnimationTiming();
  return app;
}

/** The timeline as the editor plays it: duration, pauses and beacon schedules. */
function timeline(app) {
  const engine = app.animationEngine;
  return {
    duration: engine.state.duration,
    pauses: engine.pauseMarkers.map(({ waypointIndex, pathProgress, timelineStartMs, duration }) => ({
      waypointIndex, pathProgress, timelineStartMs, duration,
    })),
    beacons: engine.beaconSchedules.map(({ waypointId, style, arrivalMs, holdEndMs, earlyOnsetMs, pauseDurationMs }) => ({
      waypointId, style, arrivalMs, holdEndMs, earlyOnsetMs, pauseDurationMs,
    })),
  };
}

/** Select the waypoint in the editor, as a click on its row does. */
function select(app) {
  app.eventBus.emit('waypoint:selected', app.getWaypointById('ex-uon-2'));
}

function choose(id, value, type = 'change') {
  const control = document.getElementById(id);
  control.value = String(value);
  control.dispatchEvent(new Event(type, { bubbles: true }));
}

test.each([
  ['pop', 'grow'],
  ['none', 'grow'],
  ['grow', 'ripple'],
  ['ripple', 'pulse'],
  ['pulse', 'none'],
])('a beacon changed from %s to %s in the inspector is timed by its new style at once', async (from, to) => {
  const expected = timeline(await opened(openDay({ beaconStyle: to, rippleWait: false })));
  const app = await opened(openDay({ beaconStyle: from, rippleWait: false }));
  select(app);

  choose('editor-beacon-style', to);

  expect(timeline(app)).toEqual(expected);
});

test('a ripple made larger in the inspector pauses as long as it now lasts, at once', async () => {
  const ripple = { beaconStyle: 'ripple', rippleMaxScale: 1000, rippleWait: false };
  const expected = timeline(await opened(openDay({ ...ripple, rippleMaxScale: 3000 })));
  const app = await opened(openDay(ripple));
  select(app);

  choose('ripple-max-scale', 3000, 'input');

  expect(timeline(app)).toEqual(expected);
});

test('a pulse given a slower cycle in the inspector pauses for its whole cycle, at once', async () => {
  const pulse = { beaconStyle: 'pulse', pulseCycleSpeed: 2 };
  const expected = timeline(await opened(openDay({ ...pulse, pulseCycleSpeed: 8 })));
  const app = await opened(openDay(pulse));
  select(app);

  choose('pulse-cycle-speed', 8, 'input');

  expect(timeline(app)).toEqual(expected);
});

test('a pause shortened in the inspector on a branched route shortens the route’s total at once', async () => {
  const app = await opened(openDay({ beaconStyle: 'none', pauseMode: 'timed', pauseTime: 6000 }));
  select(app);
  // Where the slider lands for two seconds, and the pause that gives.
  const slider = app.uiController.pauseTimeToSlider(2);
  const pauseTime = app.uiController.sliderToPauseTime(slider) * 1000;

  choose('waypoint-pause-time', slider, 'input');

  const expected = timeline(await opened(openDay({ beaconStyle: 'none', pauseMode: 'timed', pauseTime })));
  expect(timeline(app)).toEqual(expected);
});
