/**
 * DEF-45 — announcements are written to the live region in turn.
 *
 * The live region holds one message, and `announce` replaced it. Restoring a
 * legacy recovery point announced "Browser recovery excludes the background…"
 * and then, in the same task, "Previous session restored"; opening a project
 * replaced the same warning with "Project loaded". A screen reader read only
 * the last, so its user was never told what their recovery point leaves out.
 * Each message also set a 2 s clear that nothing cancelled, so an earlier
 * message's clear blanked a later one early.
 *
 * The first queue still lost that warning: opening a project and pressing
 * Play and Pause within two seconds pushed it out of a full queue, and
 * persistence never says it again (the falsification review's R1). A message
 * the author must hear now never gives way; only routine ones do.
 *
 * Every text the region shows is recorded by a MutationObserver and stamped
 * with the fake clock, so each test reads the region's whole history: what was
 * written, in what order, and for how long. That is what reached the region;
 * whether a screen reader speaks it needs a real one.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { ANNOUNCEMENTS, STORAGE } from '../src/config/constants.js';
import { EventBus } from '../src/core/EventBus.js';
import { UIController } from '../src/controllers/UIController.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { createAnnouncementQueue } from '../src/utils/announcementQueue.js';

const HOLD = ANNOUNCEMENTS.HOLD_MS;
const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const BACKGROUND_WARNING = 'Browser recovery excludes the background. Save a project file to preserve it.';
const IMAGES_WARNING = 'Browser recovery excludes custom images. Save a project file to preserve them.';
const BOTH_WARNING = 'Browser recovery excludes the background and custom images. Save a project file to preserve them.';
const AUTOSAVE_FAILED = 'Auto-save failed. Save a project file to keep your work.';

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

/**
 * Run the clock until every queue these tests build has had its time and
 * cleared. Messages the author must hear do not count towards the cap, so a
 * queue can be longer than it allows.
 */
function playOut() {
  return vi.advanceTimersByTimeAsync(10 * HOLD);
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

/** Press the transport buttons the way an author does. */
function press(app, ...buttons) {
  for (const button of buttons) app.elements[`${button}Btn`].click();
}

/** A one-pixel custom marker image, already decoded. */
function markerAsset() {
  const asset = new ImageAsset({
    id: 'marker', name: 'marker.png', base64: PIXEL_PNG, width: 1, height: 1,
    mimeType: 'image/png', size: ImageAsset.inspectDataURL(PIXEL_PNG).byteLength,
  });
  asset._imageElement = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
  return asset;
}

/**
 * A two-waypoint project file built in the app, with a background and a
 * custom marker image as asked: what browser recovery leaves out. What the
 * building said has played out before the file is returned.
 */
async function projectFile(app, { background = false, customImage = false } = {}) {
  app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
  if (customImage) {
    app.imageAssetService.addAsset(markerAsset());
    Object.assign(app.waypoints[0], { customImageAssetId: 'marker', markerStyle: 'custom' });
  }
  await playOut();
  const project = app._buildProjectSnapshot({ includeAssets: false });
  const archive = await app.imageAssetService.exportZip(project, background ? PIXEL_PNG : null);
  return new File([archive], 'project.zip', { type: 'application/zip' });
}

/**
 * A recovery point saved before recovery became model-only, which carries the
 * background's bytes; restoring one rewrites it without them, and says so.
 */
async function legacyRecoveryPoint() {
  const first = await bootApp();
  await first.ready;
  first.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
  first.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
  return JSON.stringify({ ...first._buildProjectSnapshot(), backgroundImage: PIXEL_PNG });
}

/** Boot an app that restores `recovery` as it starts, on the fake clock from boot. */
function bootRestoring(recovery) {
  localStorage.getItem.mockImplementation(key => (key === STORAGE.AUTOSAVE_KEY ? recovery : null));
  vi.useFakeTimers(FAKE_CLOCK);
  return bootApp();
}

describe('announcements are written to the region in turn (DEF-45)', () => {

  test('restoring a legacy recovery point shows the background warning, then "Previous session restored", each for its time', async () => {
    const legacy = await legacyRecoveryPoint();

    // The restore runs while the app starts, so the clock is fake from boot.
    const app = await bootRestoring(legacy);
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

    // Whatever else the load says is written first, each message for one hold,
    expect(shown[0][1]).toBe('Loading project...');
    expect(since(shown).map(([at]) => at)).toEqual(shown.map((_, turn) => turn * HOLD));
    // and the warning is written before "Project loaded" instead of under it.
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

  test('a burst of the same message is written once, and a later repeat in its turn', async () => {
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

  test('at most three routine messages wait, and the oldest gives way to a newer one', async () => {
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

  test('an assertive message is shown next, without cutting short the one showing', async () => {
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

  test('beyond the cap only routine messages give way: assertive ones and those the author must hear never do', async () => {
    const app = await bootIdleApp();
    const { region, shown } = recordRegion();
    const start = Date.now();

    app.announce('Project cleared');
    app.announce('First error.', 'assertive');
    app.announce('Second error.', 'assertive');
    app.announce(AUTOSAVE_FAILED, 'polite', { essential: true });
    for (const message of ['Undo', 'Redo', 'Waypoint deleted', 'Waypoint duplicated']) app.announce(message);
    await playOut();

    // Only routine messages count: "Undo" was the oldest when a fourth arrived.
    expect(since(shown, start)).toEqual([
      [0, 'Project cleared'],
      [HOLD, 'First error.'],
      [2 * HOLD, 'Second error.'],
      [3 * HOLD, AUTOSAVE_FAILED],
      [4 * HOLD, 'Redo'],
      [5 * HOLD, 'Waypoint deleted'],
      [6 * HOLD, 'Waypoint duplicated'],
      [7 * HOLD, ''],
    ]);

    // However many assertive messages wait, none gives way.
    shown.length = 0;
    const again = Date.now();
    app.announce('Project cleared');
    for (const message of ['First error.', 'Second error.', 'Third error.', 'Fourth error.']) {
      app.announce(message, 'assertive');
    }
    await playOut();

    expect(since(shown, again)).toEqual([
      [0, 'Project cleared'],
      [HOLD, 'First error.'],
      [2 * HOLD, 'Second error.'],
      [3 * HOLD, 'Third error.'],
      [4 * HOLD, 'Fourth error.'],
      [5 * HOLD, ''],
    ]);
    // With nothing left to show, the region is polite again, as the shell has it.
    expect(region.getAttribute('aria-live')).toBe('polite');
  });

  test('a message the author must hear, merged into the same routine text waiting, keeps it from giving way', async () => {
    const app = await bootIdleApp();
    const { shown } = recordRegion();
    const start = Date.now();

    app.announce('Waypoint moved');
    app.announce(AUTOSAVE_FAILED);
    app.announce(AUTOSAVE_FAILED, 'polite', { essential: true });
    for (const message of ['Undo', 'Redo', 'Waypoint deleted', 'Waypoint duplicated']) app.announce(message);
    await playOut();

    expect(since(shown, start)).toEqual([
      [0, 'Waypoint moved'],
      [HOLD, AUTOSAVE_FAILED],
      [2 * HOLD, 'Redo'],
      [3 * HOLD, 'Waypoint deleted'],
      [4 * HOLD, 'Waypoint duplicated'],
      [5 * HOLD, ''],
    ]);
  });

  test('a blank or whitespace-only message is never written and never takes a turn', async () => {
    const app = await bootIdleApp();
    const { region, shown } = recordRegion();
    const start = Date.now();

    // While the region is idle nothing is written, and the next message still is at once;
    app.announce('  \t\n');
    expect(region.textContent).toBe('');
    app.announce('Waypoint moved');
    expect(region.textContent).toBe('Waypoint moved');
    // while it is busy, neither kind of blank takes a turn.
    app.announce('');
    app.announce(' \n ');
    app.announce('Undo');
    await playOut();

    expect(since(shown, start)).toEqual([
      [0, 'Waypoint moved'],
      [HOLD, 'Undo'],
      [2 * HOLD, ''],
    ]);
  });

  test('a message is written as text, never parsed as markup', async () => {
    // Author-named things reach announcements ("<name> shown", "<name> moved up").
    const app = await bootIdleApp();
    const { region } = recordRegion();
    const message = 'Crowd <b>North</b> & "South" shown';

    app.announce(message);

    expect(region.textContent).toBe(message);
    expect(region.children).toHaveLength(0);
  });

  test('a queue without a live region announces nothing, and does not throw', () => {
    const queue = createAnnouncementQueue(null);
    expect(() => queue.announce('Waypoint moved')).not.toThrow();
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

describe('what browser recovery did or could not do reaches the region, whatever the author does next (DEF-45)', () => {

  test.each([
    ['its background', { background: true }, BACKGROUND_WARNING],
    ['its custom images', { customImage: true }, IMAGES_WARNING],
    ['its background and custom images', { background: true, customImage: true }, BOTH_WARNING],
  ])('opening a project whose recovery leaves out %s shows the warning though the author plays and pauses at once', async (_what, contents, warning) => {
    const app = await bootIdleApp();
    const file = await projectFile(app, contents);
    const { shown } = recordRegion();

    // The review's reproduction: Play 300 ms into the load's messages, Pause 300 ms later.
    expect(await settle(app.loadProject(file))).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    press(app, 'play');
    await vi.advanceTimersByTimeAsync(300);
    press(app, 'pause');
    await playOut();

    // The load's own pause (DEF-67) is the routine message that gives way.
    expect(since(shown)).toEqual([
      [0, 'Loading project...'],
      [HOLD, warning],
      [2 * HOLD, 'Project loaded'],
      [3 * HOLD, 'Playing animation'],
      [4 * HOLD, 'Animation paused'],
      [5 * HOLD, ''],
    ]);
    // Written once, so the next auto-save need not say it again.
    app.autoSave();
    await playOut();
    expect(shown.filter(([, text]) => text === warning)).toHaveLength(1);
  });

  test('opening a project whose recovery cannot be written says so, though the author plays and pauses at once', async () => {
    const app = await bootIdleApp();
    const file = await projectFile(app);
    vi.spyOn(app.storageService, 'saveAutoSave').mockReturnValue(false);
    const { shown } = recordRegion();

    expect(await settle(app.loadProject(file))).toBe(true);
    press(app, 'play', 'pause', 'play', 'pause');
    await playOut();

    expect(since(shown)).toEqual([
      [0, 'Loading project...'],
      [HOLD, 'Project loaded, but browser recovery is unavailable. Save the project file to keep it safe.'],
      [2 * HOLD, 'Animation paused'],
      [3 * HOLD, 'Playing animation'],
      [4 * HOLD, 'Animation paused'],
      [5 * HOLD, ''],
    ]);
  });

  test.each([
    ['writes the new recovery point', true, 'Previous session restored'],
    ['cannot write the new recovery point', false,
      'Previous session restored, but browser recovery is now unavailable. Save a project file to keep it safe.'],
  ])('a restore that %s keeps its warning and its outcome though the author plays and pauses once it is ready', async (_how, writes, outcome) => {
    const legacy = await legacyRecoveryPoint();
    const app = await bootRestoring(legacy);
    if (!writes) vi.spyOn(app.storageService, 'saveAutoSave').mockReturnValue(false);
    const { shown } = recordRegion();
    expect(await settle(app.ready)).toBe(true);

    // The editor opens to the author with the warning showing and the outcome waiting.
    press(app, 'play', 'pause', 'play', 'pause');
    await playOut();

    expect(since(shown)).toEqual([
      [0, BACKGROUND_WARNING],
      [HOLD, outcome],
      [2 * HOLD, 'Animation paused'],
      [3 * HOLD, 'Playing animation'],
      [4 * HOLD, 'Animation paused'],
      [5 * HOLD, ''],
    ]);
  });

  test('an auto-save failure is shown though a burst of routine messages follows it', async () => {
    const app = await bootIdleApp();
    // The cold start's background is left out of recovery: let that warning pass first.
    app.autoSave();
    await playOut();
    const { shown } = recordRegion();
    const start = Date.now();

    app.announce('Waypoint moved');
    vi.spyOn(app.storageService, 'autoSave').mockReturnValue({ ok: false });
    app.autoSave();
    for (const message of ['Undo', 'Redo', 'Waypoint deleted', 'Waypoint duplicated', 'All waypoints selected']) {
      app.announce(message);
    }
    await playOut();

    expect(since(shown, start)).toEqual([
      [0, 'Waypoint moved'],
      [HOLD, AUTOSAVE_FAILED],
      [2 * HOLD, 'Waypoint deleted'],
      [3 * HOLD, 'Waypoint duplicated'],
      [4 * HOLD, 'All waypoints selected'],
      [5 * HOLD, ''],
    ]);
  });
});
