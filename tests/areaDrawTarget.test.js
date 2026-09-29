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
import { afterEach, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { loadSnapshot, LOAD_REFUSED } from './helpers/projectSnapshot.js';
import { buildExampleProjects } from '../src/examples/index.js';

const GONE = 'Area drawing cancelled: its waypoint was removed.';
const TRIANGLE = [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.2 }, { x: 0.3, y: 0.4 }];
/** The next task: on the test's clock once it runs (from Draw Area on), else the real one. */
const nextTask = () => (vi.isFakeTimers() ? vi.advanceTimersByTimeAsync(0) : new Promise(resolve => setTimeout(resolve, 0)));

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

/**
 * Select `waypoint` and press Draw Area, as the author does. The clock is the
 * test's from here on, the time the app reads included: whatever the draw
 * schedules, and all that follows, runs only as a test lets time pass
 * (what the app scheduled while it started and the test set up is before
 * it, and not covered).
 */
function drawFor(app, waypoint) {
  if (!vi.isFakeTimers()) vi.useFakeTimers({ toFake: CLOCK });
  app.eventBus.emit('waypoint:selected', waypoint);
  document.getElementById('area-draw-btn').click();
}

afterEach(() => {
  vi.useRealTimers();
});

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
 * A colour's alpha, as this environment's CSS parser reads it, or null where
 * it cannot be read: a custom property (`var()`) by its value on `node`,
 * else its fallback; any other value set on a span of its own, off the page,
 * and read back as the parser computes it (`rgb()`/`rgba()` with commas, or a colour
 * function with an optional slash alpha), so keywords in any case, relative
 * and mixed colours are read as the parser resolves them. A value the parser
 * refuses, one that takes its colour from elsewhere (`currentcolor`,
 * `light-dark()`, `inherit`), or a computed form not listed is null: not
 * known to paint.
 */
function alphaOf(colour, node) {
  const value = String(colour).trim();
  const custom = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(value);
  if (custom) {
    const own = getComputedStyle(node).getPropertyValue(custom[1]).trim();
    return own ? alphaOf(own, node) : custom[2] !== undefined ? alphaOf(custom[2], node) : null;
  }
  // A colour that takes its value from where it is used cannot be read off
  // the page: `currentcolor`, and `light-dark()`, by the element's colour
  // scheme, even inside another colour
  if (/currentcolor|light-dark/i.test(value) || /^(inherit|initial|unset|revert|revert-layer)$/i.test(value)) return null;
  // A span of its own, off the page, so reading it changes nothing the checks watch
  const probe = document.createElement('span');
  probe.style.color = value;
  if (!probe.style.color) return null;
  const computed = getComputedStyle(probe).color;
  const number = text => (text.endsWith('%') ? Number.parseFloat(text) / 100 : Number(text));
  const legacy = /^rgba?\(([^()]*)\)$/.exec(computed);
  if (legacy && legacy[1].includes(',')) {
    const parts = legacy[1].split(',').map(part => part.trim());
    if (parts.length === 3) return 1;
    const alpha = parts.length === 4 ? number(parts[3]) : NaN;
    return Number.isFinite(alpha) ? alpha : null;
  }
  const modern = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(([^()]*)\)$/.exec(computed);
  if (!modern) return null;
  const [channels, alphaText, ...rest] = modern[1].split('/');
  if (rest.length > 0 || !channels.trim()) return null;
  if (alphaText === undefined) return 1;
  const alpha = number(alphaText.trim());
  return Number.isFinite(alpha) ? alpha : null;
}
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
 *   displayed, `visibility: visible`, not transparent by opacity or by an
 *   `opacity(0)` filter, and its content not hidden (`content-visibility`);
 *   the toast's text
 *   colour one whose alpha can be read (`alphaOf`), and more than 0;
 * - the region placed as the stylesheet places it (`expectPlaced`).
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
  const colour = getComputedStyle(toast).color;
  expect({ colour, alpha: alphaOf(colour, toast) > 0 }).toEqual({ colour, alpha: true });
  expectPlaced();
  for (let node = toast; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const relevant = node.getAttribute('aria-relevant');
    expect({
      at: node.id || node.className || node.tagName,
      role: node.getAttribute('role'),
      hidden: node.hidden || node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('inert') || node.getAttribute('aria-busy') === 'true',
      silenced: node !== toastRegion() && node.getAttribute('aria-live') === 'off' && toastRegion().contains(node),
      irrelevant: relevant !== null && !relevant.trim().split(/\s+/).some(token => token === 'additions' || token === 'all'),
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
 * Check `expectTold` at each point the page's changes are delivered (a
 * `MutationObserver`'s checkpoints), as well as when asked: a toast hidden
 * between two samples, and still hidden when its change is delivered, is
 * caught. Changes made and undone within one task (a browser draws none of
 * them) and changes to a stylesheet's rules through the CSSOM are not seen
 * there; the samples catch lasting ones.
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
  // The document itself, so a page whose root is replaced is still watched
  observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  return () => {
    observer.disconnect();
    expect(failures).toEqual([]);
  };
}

/**
 * Nothing said of the draw, from `act` for a toast's five seconds on the
 * test's clock: no toast asked for with the message, and the message
 * nowhere in the toasts' region (the one the page started with, which stays
 * the one the page has) at each point the page's changes are delivered or
 * 250 ms sample, however it is marked up.
 */
async function expectNothingTold(app, act) {
  const asked = [];
  const heard = ({ message } = {}) => asked.push(message);
  app.eventBus.on('ui:toast', heard);
  const seen = [];
  const look = () => {
    for (const region of new Set([shellRegion, toastRegion()])) {
      if (region?.textContent.includes(GONE)) seen.push(region.textContent);
    }
  };
  const observer = new MutationObserver(look);
  observer.observe(document, { subtree: true, childList: true, characterData: true });
  if (!vi.isFakeTimers()) vi.useFakeTimers({ toFake: CLOCK });
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
    app.eventBus.off('ui:toast', heard);
  }
  expect(asked.filter(message => String(message).includes(GONE))).toEqual([]);
  expect(seen).toEqual([]);
  expect(toastRegion()).toBe(shellRegion);
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

test.each(REMOVALS)('a draw whose waypoint is %s ends, and the author is told once, in a toast shown for a toast’s five seconds, checked as the page’s changes are delivered and every 250 ms', async (_, { target, remove }) => {
  const app = await openDay();
  const waypoint = await target(app);
  drawFor(app, waypoint);
  placeTriangle(app);
  // The clock has been the test's since Draw Area: what the draw and the
  // action schedule runs as time is let pass, promise work with it.
  try {
    remove(app, waypoint);

    expect(app.getWaypointById(waypoint.id)).toBeUndefined();
    expect(drawing(app)).toEqual(ENDED);
    // Told from the next frame to the last moment of its five seconds, past
    // the action's own announcement (cleared at two seconds): as the page's
    // changes are delivered, and every 250 ms.
    await vi.advanceTimersByTimeAsync(16);
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

test('the toast’s colour is read as this environment’s CSS parser reads it, and one it cannot read is not known to paint', () => {
  // As a stylesheet sets them: custom properties on an element, read through `var()`
  const sheet = document.createElement('style');
  sheet.textContent = '.colour-read { --upper: TRANSPARENT; --relative: rgb(from transparent r g b); --unknown: blorple; '
    + '--mixed: color-mix(in srgb, currentcolor, transparent); color-scheme: dark; --dark: light-dark(white, transparent); }';
  document.head.append(sheet);
  const node = document.createElement('span');
  node.className = 'colour-read';
  document.body.append(node);
  try {
    const read = colour => alphaOf(colour, node);
    expect({
      opaque: ['white', 'WHITE', '#fff', 'rgb(1 2 3)', 'var(--missing, white)'].map(read),
      transparent: ['TRANSPARENT', 'Transparent', '#0000', 'rgb(1 2 3 / 0)', 'color(srgb 1 0 0 / 0)', 'oklch(0.5 0.1 20 / 0)',
        'rgb(from transparent r g b)', 'var(--upper, white)', 'var(--relative, white)'].map(read),
      half: read('color-mix(in srgb, red, transparent)'),
      unread: ['blorple', 'rgb(blorple)', 'var(--unknown, white)', 'currentcolor', 'inherit', 'var(--missing)',
        'var(--mixed, white)', 'color-mix(in srgb, CurrentColor, red)',
        // under a dark scheme, which a span off the page does not share
        'light-dark(white, transparent)', 'var(--dark, white)', 'var(--missing, light-dark(white, transparent))',
        'color-mix(in srgb, LIGHT-DARK(white, transparent), red)'].map(read),
    }).toEqual({ opaque: [1, 1, 1, 1, 1], transparent: [0, 0, 0, 0, 0, 0, 0, 0, 0], half: 0.5, unread: Array(12).fill(null) });
  } finally {
    node.remove();
    sheet.remove();
  }
});
