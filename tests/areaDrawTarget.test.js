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

/** A colour that paints nothing, as jsdom computes one. */
const CLEAR = /^(transparent|rgba\([^)]*,\s*0(\.0*)?\)|hsla\([^)]*,\s*0(\.0*)?%?\))$/;
/** A filter that makes what it filters transparent. */
const FADED = /opacity\(\s*0*(\.0*)?%?\s*\)/;

/**
 * The one toast saying so, checked as far as a page can check it without a
 * browser's layout, against a stated list and nothing more:
 * - its own text is the message, and its text includes it;
 * - it is in the app's own live region (the one the page started with),
 *   polite, atomic, relevant to additions;
 * - from the toast up to and including `<html>`: no role, nothing `hidden`,
 *   `aria-hidden`, inert or busy, no `aria-live="off"` inside the region,
 *   no `aria-relevant` without additions; and, by the app's stylesheet,
 *   displayed, `visibility: visible`, not transparent (opacity, a filter)
 *   and its content not hidden (`content-visibility`); the toast's text not
 *   a colour that paints nothing.
 * Where it lands on screen, what covers it, and how a screen reader speaks
 * it are a browser's to check; `expectPlaced` pins the stylesheet's
 * placement.
 */
function expectTold() {
  const toasts = goneToasts();
  expect(toasts).toHaveLength(1);
  const [toast] = toasts;
  expect(toast.textContent).toContain(GONE);
  expect(toastRegion()).toBe(shellRegion);
  expect(toastRegion().getAttribute('aria-live')).toBe('polite');
  expect(toastRegion().getAttribute('aria-atomic')).toBe('true');
  expect(toast.classList.contains('is-visible')).toBe(true);
  expect(getComputedStyle(toast).color).not.toMatch(CLEAR);
  for (let node = toast; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const relevant = node.getAttribute('aria-relevant');
    expect({
      at: node.id || node.className || node.tagName,
      role: node.getAttribute('role'),
      hidden: node.hidden || node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('inert') || node.getAttribute('aria-busy') === 'true',
      silenced: node !== toastRegion() && node.getAttribute('aria-live') === 'off' && toastRegion().contains(node),
      irrelevant: relevant !== null && !/\b(additions|all)\b/.test(relevant),
      drawn: style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0
        && !FADED.test(style.filter) && style.getPropertyValue('content-visibility') !== 'hidden',
    }).toEqual({ at: node.id || node.className || node.tagName, role: null, hidden: false, silenced: false, irrelevant: false, drawn: true });
  }
}

/**
 * The toasts' region where the app's stylesheet puts it: fixed, centred at
 * the top, above the page (z-index 9000), with no margin and nothing above
 * it moved. A structural check of this design, not of the screen: a new
 * design updates it.
 */
function expectPlaced() {
  const region = getComputedStyle(toastRegion());
  expect({
    position: region.position, top: region.top, left: region.left, transform: region.transform, zIndex: region.zIndex,
    margin: [region.marginTop, region.marginRight, region.marginBottom, region.marginLeft],
  }).toEqual({
    position: 'fixed', top: 'var(--space-3)', left: '50%', transform: 'translateX(-50%)', zIndex: '9000',
    margin: ['0px', '0px', '0px', '0px'],
  });
  const above = [];
  for (let node = toastRegion().parentElement; node; node = node.parentElement) above.push(getComputedStyle(node).transform);
  expect(above.every(transform => transform === 'none')).toBe(true);
}

/** The test's clock: timers, frames and the time they read. */
const CLOCK = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'];

/**
 * Check `expectTold` after every change to the page, as well as when asked:
 * a toast hidden between two samples, however briefly, is caught at the
 * change that hides it. Changes to a stylesheet's rules through the CSSOM
 * are not page changes; the samples catch those.
 */
function watchTold() {
  const failures = [];
  const observer = new MutationObserver(() => {
    try {
      expectTold();
    } catch (error) {
      failures.push(error.message);
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  return () => {
    observer.disconnect();
    expect(failures).toEqual([]);
  };
}

/**
 * Nothing said of the draw, from `act` for a toast's five seconds on the
 * test's clock: no toast asked for with the message, and the message
 * nowhere in the toasts' region at any change to the page or 250 ms
 * sample, however it is marked up.
 */
async function expectNothingTold(app, act) {
  const asked = [];
  const heard = ({ message } = {}) => asked.push(message);
  app.eventBus.on('ui:toast', heard);
  const seen = [];
  const look = () => {
    if (toastRegion().textContent.includes(GONE)) seen.push(toastRegion().textContent);
  };
  const observer = new MutationObserver(look);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  vi.useFakeTimers({ toFake: CLOCK });
  try {
    const acting = act();
    for (let at = 0; at < 5000; at += 250) {
      look();
      await vi.advanceTimersByTimeAsync(250);
    }
    await acting;
    look();
  } finally {
    observer.disconnect();
    vi.useRealTimers();
    app.eventBus.off('ui:toast', heard);
  }
  expect(asked.filter(message => String(message).includes(GONE))).toEqual([]);
  expect(seen).toEqual([]);
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

test.each(REMOVALS)('a draw whose waypoint is %s ends, and the author is told once, in a toast shown for a toast’s five seconds, checked at every change to the page and every 250 ms', async (_, { target, remove }) => {
  const app = await openDay();
  const waypoint = await target(app);
  drawFor(app, waypoint);
  placeTriangle(app);
  // The clock is the test's from here, the time the app reads included: what
  // the action schedules runs as time is let pass, promise work with it.
  vi.useFakeTimers({ toFake: CLOCK });
  try {
    remove(app, waypoint);

    expect(app.getWaypointById(waypoint.id)).toBeUndefined();
    expect(drawing(app)).toEqual(ENDED);
    // Told from the next frame to the last moment of its five seconds, past
    // the action's own announcement (cleared at two seconds): at every
    // change to the page, and every 250 ms.
    await vi.advanceTimersByTimeAsync(16);
    expectPlaced();
    const watched = watchTold();
    for (let at = 16; at < 4999; at += 250) {
      expectTold();
      await vi.advanceTimersByTimeAsync(Math.min(250, 4999 - at));
    }
    expect(document.getElementById('announcer').textContent).toBe('');
    expectTold();
    watched();
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

  await expectNothingTold(app, () => {
    document.getElementById('clear-btn').click();
    document.getElementById('clear-confirm').click();
  });

  expect(drawing(app)).toEqual(ENDED);
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

  await expectNothingTold(app, async () => {
    app.eventBus.emit('waypoint:delete', target);
    await nextTask();
    app.undo();
    app.redo();
  });
});

test('a draw goes on, unannounced, when a project fails to open over it', async () => {
  const app = await openDay();
  const target = app.getWaypointById('ex-uon-2');
  drawFor(app, target);
  placeTriangle(app);
  allowConsole(LOAD_REFUSED);
  vi.spyOn(app, 'pruneImageAssets').mockImplementationOnce(() => { throw new Error('late failure'); });

  await expectNothingTold(app, async () => {
    expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(false);
  });

  expect(drawing(app)).toMatchObject({ active: true, vertices: 3 });
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

  await expectNothingTold(app, async () => {
    app.eventBus.emit('waypoint:delete', app.getWaypointById('ex-uon-3'));
    await nextTask();
  });
  place(app, 0.2, 0.2);

  expect(target.areaHighlight).toMatchObject({ shape: 'polygon', points: TRIANGLE });
});

test('a draw goes on through an undo that keeps its waypoint, and its polygon lands on the waypoint the project has', async () => {
  const app = await openDay();
  // An edit to undo, made before the draw.
  app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.9, isMajor: true });
  await nextTask();
  drawFor(app, app.getWaypointById('ex-uon-2'));
  placeTriangle(app);

  await expectNothingTold(app, () => app.undo());
  expect(drawing(app)).toMatchObject({ active: true, vertices: 3, banner: true });
  place(app, 0.2, 0.2);

  const live = app.getWaypointById('ex-uon-2');
  expect(live.areaHighlight).toMatchObject({ shape: 'polygon', enabled: true, points: TRIANGLE });
  expect(app._buildProjectSnapshot().waypoints.find(each => each.id === 'ex-uon-2').areaHighlight.points)
    .toEqual(TRIANGLE);
});

test('a draw goes on through a redo that keeps its waypoint, and Draw Area pressed again there keeps its vertices', async () => {
  const app = await openDay();
  app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.9, isMajor: true });
  await nextTask();
  app.undo();
  const drawn = app.getWaypointById('ex-uon-2');
  drawFor(app, drawn);
  placeTriangle(app);

  await expectNothingTold(app, () => app.redo());
  const live = app.getWaypointById('ex-uon-2');
  expect(live).not.toBe(drawn);
  expect(app.areaDrawingService.targetWaypoint).toBe(live);
  // The restored waypoint selected, and Draw Area asked for again.
  drawFor(app, live);
  expect(drawing(app)).toMatchObject({ active: true, vertices: 3 });
  place(app, 0.2, 0.2);

  expect(live.areaHighlight).toMatchObject({ shape: 'polygon', points: TRIANGLE });
});

test('a draw ends, and is not carried over, when a project with the same waypoints is opened', async () => {
  const app = await openDay();
  drawFor(app, app.getWaypointById('ex-uon-2'));
  placeTriangle(app);

  await expectNothingTold(app, async () => {
    expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(true);
  });

  expect(drawing(app)).toEqual(ENDED);
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
