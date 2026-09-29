/**
 * DEF-43 — a polygon draw outlives its target.
 *
 * Draw Area draws a polygon for the selected waypoint, vertex by vertex on
 * the canvas, and closing it writes the polygon to that waypoint. Only a
 * project replacement or Clear All ended a draw, so deleting the waypoint
 * (the list's ×) or undoing past it left the tool drawing, and closing the
 * polygon wrote it to a waypoint the project no longer had: lost, without a
 * word. An undo that kept the waypoint lost it too, since undo restores
 * copies. And focus stays on Draw Area through the canvas clicks, so Space or
 * Enter asked for the draw again, which discarded the vertices placed so far.
 * Now a draw follows its waypoint to the restored copy, or ends and says so
 * when it has gone; and asking again for the draw in progress keeps it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { loadSnapshot, LOAD_REFUSED } from './helpers/projectSnapshot.js';
import { buildExampleProjects } from '../src/examples/index.js';

const GONE = 'Area drawing cancelled: its waypoint was removed.';
const TRIANGLE = [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.2 }, { x: 0.3, y: 0.4 }];
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

/** The app's stylesheet, which the harness's shell leaves out, so how a toast is drawn can be read. */
function withStyles() {
  if (document.getElementById('app-styles')) return;
  const style = document.createElement('style');
  style.id = 'app-styles';
  style.textContent = readFileSync(resolve(process.cwd(), 'styles/main.css'), 'utf8');
  document.head.append(style);
}

async function openDay() {
  const app = await bootApp();
  await app.ready;
  withStyles();
  shellRegion = toastRegion();
  // The welcome dialog, open at start, makes the page behind it inert.
  document.getElementById('splash-close').click();
  const project = structuredClone(buildExampleProjects().find(each => each.id === 'uon-open-day').project);
  expect(await loadSnapshot(app, project)).toBe(true);
  return app;
}

/** Select `waypoint` and press Draw Area, as the author does. */
function drawFor(app, waypoint) {
  app.eventBus.emit('waypoint:selected', waypoint);
  document.getElementById('area-draw-btn').click();
}

/** A canvas click during the draw, at image coordinates. */
const place = (app, x, y) => app.eventBus.emit('area:draw-click', { imgX: x, imgY: y });
const placeTriangle = app => TRIANGLE.forEach(({ x, y }) => place(app, x, y));

const drawing = app => ({
  active: app.areaDrawingService.isDrawing,
  vertices: app.areaDrawingService.vertices.length,
  banner: Boolean(document.getElementById('area-draw-banner')),
  canvasDraws: app.interactionHandler.isDrawingArea,
});
const ENDED = { active: false, vertices: 0, banner: false, canvasDraws: false };

/** The toasts' live region, as the page had it when the app started. */
let shellRegion = null;
const toastRegion = () => document.getElementById('toast-container');

/** A toast's own text: its message, not its dismiss button's. */
const messageOf = toast => [...toast.childNodes]
  .filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.nodeValue).join('');

/** The toasts saying the draw was cancelled. */
const goneToasts = () => [...toastRegion().querySelectorAll('.toast')].filter(toast => messageOf(toast) === GONE);
const toldGone = () => goneToasts().length;

/**
 * The one toast saying so, where the author is told, as far as a page can
 * check without a browser's layout: its text the message; in the app's own
 * polite, atomic live region (the one the page started with); no role over
 * its text; and nothing from it up to the page hidden, inert, busy, taken
 * out of the live region, or drawn invisible by the stylesheet (display,
 * visibility, opacity). Where it lands on screen, and how a screen reader
 * speaks it, are for a browser.
 */
function expectTold() {
  const toasts = goneToasts();
  expect(toasts).toHaveLength(1);
  const [toast] = toasts;
  expect(toast.textContent).toContain(GONE);
  expect(toastRegion()).toBe(shellRegion);
  expect(toastRegion().getAttribute('aria-live')).toBe('polite');
  expect(toastRegion().getAttribute('aria-atomic')).toBe('true');
  expect(toast.getAttribute('role')).toBeNull();
  expect(toast.classList.contains('is-visible')).toBe(true);
  for (let node = toast; node && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node);
    expect({
      at: node.id || node.className,
      hidden: node.hidden || node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('inert') || node.getAttribute('aria-busy') === 'true',
      silenced: node !== toastRegion() && node.getAttribute('aria-live') === 'off' && toastRegion().contains(node),
      drawn: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0',
    }).toEqual({ at: node.id || node.className, hidden: false, silenced: false, drawn: true });
  }
}

/** Each way a waypoint leaves the project: how its draw's target is got ready, and removed. */
const REMOVALS = [
  ['deleted with its row’s ×', {
    target: app => app.getWaypointById('ex-uon-2'),
    remove: (app, target) => app.eventBus.emit('waypoint:delete', target),
  }],
  ['deleted with another waypoint also selected', {
    target: app => app.getWaypointById('ex-uon-2'),
    remove: (app, target) => {
      app.eventBus.emit('waypoint:multi-selected', { waypoints: [target, app.getWaypointById('ex-uon-3')], primary: target });
      app.eventBus.emit('waypoint:delete-selected');
    },
  }],
  ['deleted from the outline', {
    target: app => app.getWaypointById('ex-uon-2'),
    remove: (app, target) => app._outlineDeleteWaypoint({ waypointId: target.id }),
  }],
  ['undone away', {
    target: async app => {
      app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.9, isMajor: true });
      await nextTask();
      return app.waypoints.at(-1);
    },
    remove: app => app.undo(),
  }],
  ['redone away', {
    target: app => {
      const deleted = app.getWaypointById('ex-uon-2');
      app.deleteWaypoint(deleted);
      app.undo();
      return app.getWaypointById(deleted.id);
    },
    remove: app => app.redo(),
  }],
];

test.each(REMOVALS)('a draw whose waypoint is %s ends, and the author is told once, in a toast shown for a toast’s five seconds whatever the action does meanwhile', async (_, { target, remove }) => {
  const app = await openDay();
  const waypoint = await target(app);
  drawFor(app, waypoint);
  placeTriangle(app);
  // The clock is the test's from here: what the action schedules runs as time is let pass.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  try {
    remove(app, waypoint);

    expect(app.getWaypointById(waypoint.id)).toBeUndefined();
    expect(drawing(app)).toEqual(ENDED);
    // Told from the next frame, and all through, promise work included, past
    // the action's own announcement (cleared at two seconds), to the last
    // moment of its five seconds.
    await vi.advanceTimersByTimeAsync(16);
    for (let at = 16; at < 4999; at += 250) {
      expectTold();
      await vi.advanceTimersByTimeAsync(Math.min(250, 4999 - at));
    }
    expect(document.getElementById('announcer').textContent).toBe('');
    expectTold();
    await vi.advanceTimersByTimeAsync(1);
    expect(goneToasts().map(toast => toast.classList.contains('is-visible'))).toEqual([false]);
    // Nothing more is drawn, for it or anything else.
    place(app, 0.2, 0.2);
    expect(drawing(app).vertices).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

test('a draw ended by Clear All, with the project, says nothing of its waypoint', async () => {
  const app = await openDay();
  drawFor(app, app.getWaypointById('ex-uon-2'));
  placeTriangle(app);

  document.getElementById('clear-btn').click();
  document.getElementById('clear-confirm').click();

  expect(drawing(app)).toEqual(ENDED);
  // Nor a moment later.
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(toldGone()).toBe(0);
});

test.each([
  ['cancelled', () => document.querySelector('#area-draw-banner .banner-cancel').click()],
  ['ended with Escape', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))],
  ['closed', app => place(app, 0.2, 0.2)],
])('a draw already %s says nothing when its waypoint is then deleted, undone back and redone away', async (_, end) => {
  const app = await openDay();
  const target = app.getWaypointById('ex-uon-2');
  drawFor(app, target);
  placeTriangle(app);
  end(app);
  expect(drawing(app)).toEqual(ENDED);

  app.eventBus.emit('waypoint:delete', target);
  await nextTask();
  app.undo();
  app.redo();

  expect(toldGone()).toBe(0);
});

test('a draw goes on, unannounced, when a project fails to open over it', async () => {
  const app = await openDay();
  const target = app.getWaypointById('ex-uon-2');
  drawFor(app, target);
  placeTriangle(app);
  allowConsole(LOAD_REFUSED);
  vi.spyOn(app, 'pruneImageAssets').mockImplementationOnce(() => { throw new Error('late failure'); });

  expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(false);

  expect(drawing(app)).toMatchObject({ active: true, vertices: 3 });
  expect(toldGone()).toBe(0);
  place(app, 0.2, 0.2);
  expect(target.areaHighlight).toMatchObject({ shape: 'polygon', points: TRIANGLE });
});

test('a draw ended by a deletion stays ended when the deletion is undone', async () => {
  const app = await openDay();
  drawFor(app, app.getWaypointById('ex-uon-2'));
  placeTriangle(app);
  app.eventBus.emit('waypoint:delete', app.getWaypointById('ex-uon-2'));
  await nextTask();

  app.undo();

  expect(app.getWaypointById('ex-uon-2')).toBeDefined();
  expect(drawing(app)).toEqual(ENDED);
  expect(toldGone()).toBe(1);
});

test('a draw goes on, unannounced, through another waypoint’s deletion', async () => {
  const app = await openDay();
  const target = app.getWaypointById('ex-uon-2');
  drawFor(app, target);
  placeTriangle(app);

  app.eventBus.emit('waypoint:delete', app.getWaypointById('ex-uon-3'));
  await nextTask();
  place(app, 0.2, 0.2);

  expect(target.areaHighlight).toMatchObject({ shape: 'polygon', points: TRIANGLE });
  expect(toldGone()).toBe(0);
});

test('a draw goes on through an undo that keeps its waypoint, and its polygon lands on the waypoint the project has', async () => {
  const app = await openDay();
  // An edit to undo, made before the draw.
  app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.9, isMajor: true });
  await nextTask();
  drawFor(app, app.getWaypointById('ex-uon-2'));
  placeTriangle(app);

  app.undo();
  expect(drawing(app)).toMatchObject({ active: true, vertices: 3, banner: true });
  place(app, 0.2, 0.2);

  const live = app.getWaypointById('ex-uon-2');
  expect(live.areaHighlight).toMatchObject({ shape: 'polygon', enabled: true, points: TRIANGLE });
  expect(app._buildProjectSnapshot().waypoints.find(each => each.id === 'ex-uon-2').areaHighlight.points)
    .toEqual(TRIANGLE);
  expect(toldGone()).toBe(0);
});

test('a draw goes on through a redo that keeps its waypoint, and Draw Area pressed again there keeps its vertices', async () => {
  const app = await openDay();
  app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.9, isMajor: true });
  await nextTask();
  app.undo();
  const drawn = app.getWaypointById('ex-uon-2');
  drawFor(app, drawn);
  placeTriangle(app);

  app.redo();
  const live = app.getWaypointById('ex-uon-2');
  expect(live).not.toBe(drawn);
  expect(app.areaDrawingService.targetWaypoint).toBe(live);
  // The restored waypoint selected, and Draw Area asked for again.
  drawFor(app, live);
  expect(drawing(app)).toMatchObject({ active: true, vertices: 3 });
  place(app, 0.2, 0.2);

  expect(live.areaHighlight).toMatchObject({ shape: 'polygon', points: TRIANGLE });
  expect(toldGone()).toBe(0);
});

test('a draw ends, and is not carried over, when a project with the same waypoints is opened', async () => {
  const app = await openDay();
  drawFor(app, app.getWaypointById('ex-uon-2'));
  placeTriangle(app);

  expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(true);

  expect(drawing(app)).toEqual(ENDED);
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(toldGone()).toBe(0);
  place(app, 0.2, 0.2);
  expect(app.getWaypointById('ex-uon-2').areaHighlight?.points ?? []).not.toEqual(TRIANGLE);
});

test('Draw Area asked for again, as Space or Enter on it does, keeps the draw in progress', async () => {
  const app = await openDay();
  const target = app.getWaypointById('ex-uon-2');
  drawFor(app, target);
  place(app, 0.2, 0.2);
  place(app, 0.4, 0.2);

  document.getElementById('area-draw-btn').click();

  expect(drawing(app)).toEqual({ active: true, vertices: 2, banner: true, canvasDraws: true });
  expect(app.areaDrawingService.targetWaypoint).toBe(target);
  expect(document.querySelector('#area-draw-banner .banner-count').textContent).toBe('2 vertices (1 more needed to close)');
});

test('Draw Area for another waypoint starts that waypoint’s draw afresh', async () => {
  const app = await openDay();
  drawFor(app, app.getWaypointById('ex-uon-2'));
  place(app, 0.2, 0.2);

  const other = app.getWaypointById('ex-uon-3');
  drawFor(app, other);

  expect(drawing(app)).toEqual({ active: true, vertices: 0, banner: true, canvasDraws: true });
  expect(app.areaDrawingService.targetWaypoint).toBe(other);
});
