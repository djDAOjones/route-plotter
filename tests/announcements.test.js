/**
 * DEF-45 — announcements are read in turn.
 *
 * The live region holds one message, and `announce` replaced it. Restoring a
 * legacy recovery point announced "Browser recovery excludes the background…"
 * and then, in the same task, "Previous session restored"; opening a project
 * replaced the same warning with "Project loaded". A screen reader read only
 * the last, so its user was never told what their recovery point leaves out.
 * Each message also set a 2 s clear that nothing cancelled, so an earlier
 * message's clear blanked a later one early.
 *
 * Every text the region shows is recorded by a MutationObserver and stamped
 * with the fake clock, so each test reads the region's whole history: what
 * showed, in what order, and for how long.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { ANNOUNCEMENTS, STORAGE } from '../src/config/constants.js';
import { EventBus } from '../src/core/EventBus.js';
import { UIController } from '../src/controllers/UIController.js';

const HOLD = ANNOUNCEMENTS.HOLD_MS;
const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const BACKGROUND_WARNING = 'Browser recovery excludes the background. Save a project file to preserve it.';

// The queue's timers and the history's stamps; everything else runs as booted.
const FAKE_CLOCK = { toFake: ['setTimeout', 'clearTimeout', 'Date'] };

const observers = [];

afterEach(() => {
  for (const observer of observers.splice(0)) observer.disconnect();
  vi.useRealTimers();
  localStorage.getItem.mockImplementation(() => null);
});

/**
 * Record every text the live region shows, stamped with the fake clock.
 * `textContent` replaces the region's text node, so each write is one record
 * whose added node holds the new text; a clear adds none, and reads as ''.
 */
function recordRegion() {
  const region = document.getElementById('announcer');
  const shown = [];
  const observer = new MutationObserver(records => {
    for (const record of records) {
      shown.push([Date.now(), [...record.addedNodes].map(node => node.textContent).join('')]);
    }
  });
  observer.observe(region, { childList: true });
  observers.push(observer);
  return { region, shown };
}

/** The history in ms since `start`, by default since its first entry. */
function since(shown, start = shown[0]?.[0]) {
  return shown.map(([at, text]) => [at - start, text]);
}

/** Run the clock until the longest queue has had its time and cleared. */
function playOut() {
  return vi.advanceTimersByTimeAsync((ANNOUNCEMENTS.MAX_WAITING + 2) * HOLD);
}

/**
 * Let async work finish without moving the clock: zero-length steps run what
 * is due now (an image's onload) and yield to real tasks (unzipping) between.
 */
async function settle(promise) {
  let settled = false;
  promise.then(() => { settled = true; }, () => { settled = true; });
  for (let step = 0; !settled && step < 1000; step += 1) await vi.advanceTimersByTimeAsync(0);
  if (!settled) throw new Error('The async work never finished');
  return promise;
}

/** A booted app with nothing announced (DEF-33), on the fake clock from here. */
async function bootIdleApp() {
  const app = await bootApp();
  await app.ready;
  vi.useFakeTimers(FAKE_CLOCK);
  return app;
}

describe('announcements are read in turn (DEF-45)', () => {

  test('restoring a legacy recovery point shows the background warning, then "Previous session restored", each for its time', async () => {
    // Recovery points saved before recovery became model-only carry the
    // background's bytes; restoring one rewrites it without them, and says so.
    const first = await bootApp();
    await first.ready;
    first.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
    first.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
    const legacy = JSON.stringify({ ...first._buildProjectSnapshot(), backgroundImage: PIXEL_PNG });
    localStorage.getItem.mockImplementation(key => (key === STORAGE.AUTOSAVE_KEY ? legacy : null));

    // The restore runs while the app starts, so the clock is fake from boot.
    vi.useFakeTimers(FAKE_CLOCK);
    const app = await bootApp();
    const { shown } = recordRegion();
    expect(await settle(app.ready)).toBe(true);
    expect(app.waypoints).toHaveLength(2);
    expect(app.background.image).toBeTruthy();
    await playOut();

    expect(since(shown)).toEqual([
      [0, BACKGROUND_WARNING],
      [HOLD, 'Previous session restored'],
      [2 * HOLD, ''],
    ]);
  });

  test('opening a project whose recovery leaves out its background shows the warning, then "Project loaded", each for its time', async () => {
    const app = await bootApp();
    await app.ready;
    const project = app._buildProjectSnapshot({ includeAssets: false });
    const archive = await app.imageAssetService.exportZip(project, PIXEL_PNG);
    const file = new File([archive], 'with-background.zip', { type: 'application/zip' });

    vi.useFakeTimers(FAKE_CLOCK);
    const { shown } = recordRegion();
    expect(await settle(app.loadProject(file))).toBe(true);
    await playOut();

    // Whatever else the load says is read first, each message for one hold,
    expect(shown[0][1]).toBe('Loading project...');
    expect(since(shown).map(([at]) => at)).toEqual(shown.map((_, turn) => turn * HOLD));
    // and the warning is read before "Project loaded" instead of under it.
    expect(shown.slice(-3).map(([, text]) => text)).toEqual([BACKGROUND_WARNING, 'Project loaded', '']);
  });

  test('an earlier message’s clear does not blank a later one early', async () => {
    const app = await bootIdleApp();
    const { region, shown } = recordRegion();
    const start = Date.now();

    // Alone, a message is written at once and cleared 2 s later, as it always was.
    app.announce('Waypoint moved');
    expect(region.textContent).toBe('Waypoint moved');
    await playOut();
    expect(since(shown, start)).toEqual([[0, 'Waypoint moved'], [2000, '']]);

    shown.length = 0;
    const again = Date.now();
    app.announce('Waypoint moved');
    await vi.advanceTimersByTimeAsync(HOLD - 500);
    app.announce('Undo');
    expect(region.textContent).toBe('Waypoint moved');
    await playOut();

    // The first message's clear fell due 500 ms after "Undo" was announced.
    expect(since(shown, again)).toEqual([
      [0, 'Waypoint moved'],
      [HOLD, 'Undo'],
      [2 * HOLD, ''],
    ]);
  });

  test('a burst of the same message is read once, and a later repeat in its turn', async () => {
    const app = await bootIdleApp();
    const { shown } = recordRegion();
    const start = Date.now();

    for (const message of ['Undo', 'Undo', 'Undo', 'Redo', 'Redo', 'Undo']) app.announce(message);
    await playOut();

    expect(since(shown, start)).toEqual([
      [0, 'Undo'],
      [HOLD, 'Redo'],
      [2 * HOLD, 'Undo'],
      [3 * HOLD, ''],
    ]);

    // An error repeated while it shows would wait ahead of "Undo", right after
    // itself, so it is dropped too.
    shown.length = 0;
    const again = Date.now();
    app.announce('That node no longer exists.', 'assertive');
    app.announce('Undo');
    app.announce('That node no longer exists.', 'assertive');
    await playOut();

    expect(since(shown, again)).toEqual([
      [0, 'That node no longer exists.'],
      [HOLD, 'Undo'],
      [2 * HOLD, ''],
    ]);
  });

  test('at most three messages wait, and the oldest gives way to a newer one', async () => {
    const app = await bootIdleApp();
    const { shown } = recordRegion();
    const start = Date.now();

    for (const message of ['Undo', 'Redo', 'Waypoint deleted', 'Waypoint duplicated', 'All waypoints selected']) {
      app.announce(message);
    }
    await playOut();

    // "Redo" waited longest when the fifth arrived, so it gave way.
    expect(since(shown, start)).toEqual([
      [0, 'Undo'],
      [HOLD, 'Waypoint deleted'],
      [2 * HOLD, 'Waypoint duplicated'],
      [3 * HOLD, 'All waypoints selected'],
      [4 * HOLD, ''],
    ]);
  });

  test('an assertive message is read next, without cutting short the one showing', async () => {
    const app = await bootIdleApp();
    const { region, shown } = recordRegion();
    const start = Date.now();

    app.announce('Saving project...');
    app.announce('Project saved');
    app.announce('That node no longer exists.', 'assertive');
    expect(region.textContent).toBe('Saving project...');
    expect(region.getAttribute('aria-live')).toBe('polite');

    await vi.advanceTimersByTimeAsync(HOLD);
    expect(region.textContent).toBe('That node no longer exists.');
    expect(region.getAttribute('aria-live')).toBe('assertive');
    await vi.advanceTimersByTimeAsync(HOLD);
    expect(region.getAttribute('aria-live')).toBe('polite');
    await playOut();

    expect(since(shown, start)).toEqual([
      [0, 'Saving project...'],
      [HOLD, 'That node no longer exists.'],
      [2 * HOLD, 'Project saved'],
      [3 * HOLD, ''],
    ]);
  });

  test('beyond the cap a polite message gives way before an assertive one, and the oldest assertive only when all are', async () => {
    const app = await bootIdleApp();
    const { shown } = recordRegion();
    const start = Date.now();

    app.announce('Project cleared');
    app.announce('First error.', 'assertive');
    app.announce('Second error.', 'assertive');
    app.announce('Undo');
    app.announce('Redo');
    await playOut();

    // "Undo" was the oldest polite message waiting when "Redo" overfilled the queue.
    expect(since(shown, start)).toEqual([
      [0, 'Project cleared'],
      [HOLD, 'First error.'],
      [2 * HOLD, 'Second error.'],
      [3 * HOLD, 'Redo'],
      [4 * HOLD, ''],
    ]);

    shown.length = 0;
    const again = Date.now();
    for (const message of ['Project cleared', 'First error.', 'Second error.', 'Third error.', 'Fourth error.']) {
      app.announce(message, message.endsWith('error.') ? 'assertive' : 'polite');
    }
    await playOut();

    expect(since(shown, again)).toEqual([
      [0, 'Project cleared'],
      [HOLD, 'Second error.'],
      [2 * HOLD, 'Third error.'],
      [3 * HOLD, 'Fourth error.'],
      [4 * HOLD, ''],
    ]);
  });

  test('a blank message neither shows nor cuts short the one showing', async () => {
    const app = await bootIdleApp();
    const { shown } = recordRegion();
    const start = Date.now();

    app.announce('Waypoint moved');
    app.announce('');
    app.announce('Undo');
    await playOut();

    expect(since(shown, start)).toEqual([
      [0, 'Waypoint moved'],
      [HOLD, 'Undo'],
      [2 * HOLD, ''],
    ]);
  });

  test('a waypoint list reorder waits its turn instead of replacing what the region shows', async () => {
    // UIController wrote the region itself, past the app's queue and clear.
    const app = await bootIdleApp();
    app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
    await playOut();
    const { region, shown } = recordRegion();
    const start = Date.now();

    app.announce('All waypoints selected');
    document.querySelector('#waypoint-list button[aria-label="Move Waypoint 1 down"]').click();
    expect(region.textContent).toBe('All waypoints selected');
    await playOut();

    expect(since(shown, start)).toEqual([
      [0, 'All waypoints selected'],
      [HOLD, 'Waypoint 1 moved down'],
      [2 * HOLD, ''],
    ]);
  });

  test('the waypoint list asks the app to announce, and never writes the region itself', () => {
    // A shell of only the region, so the visibility registry warns about the
    // sidebar controls it leaves out.
    allowConsole(/^\[Visibility\] Element not found: /);
    document.body.innerHTML = '<div id="announcer" role="status" aria-live="polite" aria-atomic="true"></div>';
    const announcer = document.getElementById('announcer');
    const bus = new EventBus();
    const asked = [];
    bus.on('ui:announce', request => asked.push(request));
    const ui = new UIController({ announcer }, bus);

    ui.announce('Waypoint 1 moved down');

    expect(announcer.textContent).toBe('');
    expect(asked).toEqual([{ message: 'Waypoint 1 moved down' }]);
  });
});
