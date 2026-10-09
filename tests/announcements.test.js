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
 * That queue had no bound: each project opened asked for its warning again,
 * and every copy waited, so twelve Site walk openings a second apart left six
 * still to read twenty seconds after the last (the second review's F1). A
 * message the author must hear now goes into the same text still waiting.
 *
 * Every text the region shows is recorded by a MutationObserver and stamped
 * with the fake clock, so each test reads the region's whole history: what was
 * written, in what order, and for how long. That is what reached the region;
 * whether a screen reader speaks it needs a real one.
 */

import { setTimeout as realDelay } from 'node:timers/promises';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp, tipSeen } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { ANNOUNCEMENTS, STORAGE } from '../src/config/constants.js';
import { EventBus } from '../src/core/EventBus.js';
import { UIController } from '../src/controllers/UIController.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { createAnnouncementQueue } from '../src/utils/announcementQueue.js';
import { VideoExporter } from '../src/services/VideoExporter.js';

const HOLD = ANNOUNCEMENTS.HOLD_MS;
const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const BACKGROUND_WARNING = 'Browser recovery excludes the background. Save a project file to preserve it.';
const IMAGES_WARNING = 'Browser recovery excludes custom images. Save a project file to preserve them.';
const BOTH_WARNING = 'Browser recovery excludes the background and custom images. Save a project file to preserve them.';
const AUTOSAVE_FAILED = 'Auto-save failed. Save a project file to keep your work.';
const BOOT_TIP = 'Tip: Check your sequence in Preview mode before exporting';

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
  // The start's tip seen: its timer runs on the real clock and would land mid-test on a slow runner.
  localStorage.getItem.mockImplementation(tipSeen());
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

    // The start's tip follows, once both have had their time (the owner, 2026-10-09).
    expect(since(shown)).toEqual([
      [0, BACKGROUND_WARNING],
      [HOLD, 'Previous session restored'],
      [2 * HOLD, BOOT_TIP],
      [3 * HOLD, ''],
    ]);
  });

  test('opening a project whose recovery leaves out its background shows the warning, then "Project loaded", each for its time', async () => {
    // The start's tip seen: its timer runs on the real clock and would land mid-test on a slow runner.
    localStorage.getItem.mockImplementation(tipSeen());
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

  test('an app booted idle stays idle once the start\'s tip would be due: the tip, on the real clock, never lands in a test (UI-06, CI on 882123d)', async () => {
    // The tip waits 1.5 s on the real clock from the boot (`_showPreviewTipToast`).
    // A slow runner let a test outlast it, and the tip was read in the middle of
    // what the test pinned. The one real wait in this file: just past it.
    await bootIdleApp();
    const { region, shown } = recordRegion();

    await realDelay(1600);
    await playOut();

    expect(shown).toEqual([]);
    expect(region.textContent).toBe('');
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

  test('the same routine text, merged into a message the author must hear waiting, leaves it unable to give way', async () => {
    // The other order: the must-hear message first, its routine duplicate after.
    const app = await bootIdleApp();
    const { shown } = recordRegion();
    const start = Date.now();

    app.announce('Waypoint moved');
    app.announce(AUTOSAVE_FAILED, 'polite', { essential: true });
    app.announce(AUTOSAVE_FAILED);
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

  test('a message the author must hear goes into the same text still waiting, so each such text waits once', async () => {
    const app = await bootIdleApp();
    const { shown } = recordRegion();
    const start = Date.now();

    // Two must-hear notices, each said again with other messages between.
    app.announce('Waypoint moved');
    app.announce(AUTOSAVE_FAILED, 'polite', { essential: true });
    app.announce('Undo');
    app.announce(BACKGROUND_WARNING, 'polite', { essential: true });
    app.announce(AUTOSAVE_FAILED, 'polite', { essential: true });
    app.announce('Redo');
    app.announce(BACKGROUND_WARNING, 'polite', { essential: true });
    await playOut();

    // Each is written where its text first waited, once.
    expect(since(shown, start)).toEqual([
      [0, 'Waypoint moved'],
      [HOLD, AUTOSAVE_FAILED],
      [2 * HOLD, 'Undo'],
      [3 * HOLD, BACKGROUND_WARNING],
      [4 * HOLD, 'Redo'],
      [5 * HOLD, ''],
    ]);

    // A routine copy of its text waiting, not the one it follows, takes it in
    // and can no longer give way.
    shown.length = 0;
    const joined = Date.now();
    app.announce('Waypoint moved');
    app.announce(IMAGES_WARNING);
    app.announce('Undo');
    app.announce(IMAGES_WARNING, 'polite', { essential: true });
    for (const message of ['Redo', 'Waypoint deleted', 'Waypoint duplicated']) app.announce(message);
    await playOut();

    expect(since(shown, joined)).toEqual([
      [0, 'Waypoint moved'],
      [HOLD, IMAGES_WARNING],
      [2 * HOLD, 'Redo'],
      [3 * HOLD, 'Waypoint deleted'],
      [4 * HOLD, 'Waypoint duplicated'],
      [5 * HOLD, ''],
    ]);

    // Assertive messages too: errors that alternate wait once each, still ahead.
    shown.length = 0;
    const again = Date.now();
    app.announce('Saving project...');
    app.announce('Project saved');
    for (const message of ['First error.', 'Second error.', 'First error.', 'Second error.', 'First error.']) {
      app.announce(message, 'assertive');
    }
    await playOut();

    expect(since(shown, again)).toEqual([
      [0, 'Saving project...'],
      [HOLD, 'First error.'],
      [2 * HOLD, 'Second error.'],
      [3 * HOLD, 'Project saved'],
      [4 * HOLD, ''],
    ]);
  });

  test('a must-hear text is written again after others once its first copy has been; routine text merges only into what it follows', async () => {
    const app = await bootIdleApp();
    const { shown } = recordRegion();
    const start = Date.now();

    // The copy showing was written before the second request, so it cannot answer it.
    app.announce(AUTOSAVE_FAILED, 'polite', { essential: true });
    app.announce('Undo');
    app.announce(AUTOSAVE_FAILED, 'polite', { essential: true });
    // A routine message waits again after another, as a repeated action is.
    app.announce('Redo');
    app.announce('Undo');
    await playOut();

    expect(since(shown, start)).toEqual([
      [0, AUTOSAVE_FAILED],
      [HOLD, 'Undo'],
      [2 * HOLD, AUTOSAVE_FAILED],
      [3 * HOLD, 'Redo'],
      [4 * HOLD, 'Undo'],
      [5 * HOLD, ''],
    ]);
  });

  test('under sustained input a repeated must-hear notice waits once, keeps being read, and the region clears soon after input stops', async () => {
    // An opening's messages once a second for a minute: synthetic traffic,
    // five times the twelve real openings below.
    const app = await bootIdleApp();
    const { shown } = recordRegion();
    const start = Date.now();

    for (let second = 0; second < 60; second += 1) {
      if (second) await vi.advanceTimersByTimeAsync(1000);
      for (const message of ['Opening Site walk…', 'Loading project...', 'Animation paused']) app.announce(message);
      app.announce(BACKGROUND_WARNING, 'polite', { essential: true });
      app.announce('Project loaded');
    }
    const stopped = Date.now();
    await vi.advanceTimersByTimeAsync(30 * HOLD);

    const warnings = shown.filter(([, text]) => text === BACKGROUND_WARNING).map(([at]) => at);
    // While input goes on the notice is never starved: no more than the routine
    // messages that may wait come between two readings of it.
    const gaps = warnings.slice(1).map((at, turn) => at - warnings[turn]);
    expect(warnings[0] - start).toBeLessThanOrEqual((ANNOUNCEMENTS.MAX_WAITING + 1) * HOLD);
    expect(Math.max(...gaps)).toBeLessThanOrEqual((ANNOUNCEMENTS.MAX_WAITING + 1) * HOLD);
    // Once input stops, one copy is left to read, and the region is clear
    // within a hold for the message showing and one for each that may wait.
    expect(warnings.filter(at => at > stopped)).toHaveLength(1);
    const [clearedAt, cleared] = shown.at(-1);
    expect(cleared).toBe('');
    expect(clearedAt - stopped).toBeLessThanOrEqual((1 + ANNOUNCEMENTS.MAX_WAITING + 1) * HOLD);
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

  test('a message is written exactly as given, its surrounding spaces too', async () => {
    // Only a message with nothing to read is refused; one with text is not trimmed.
    const app = await bootIdleApp();
    const { region } = recordRegion();

    app.announce('  Waypoint moved \n');

    expect(region.textContent).toBe('  Waypoint moved \n');
  });

  test('an assertive message merged into the same text waiting politely promotes it ahead of the polite messages; the one showing keeps its hold (UI-06, Codex r1)', async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    const region = document.createElement('div');
    const queue = createAnnouncementQueue(region);
    const state = () => [region.textContent, region.getAttribute('aria-live')];

    const turns = async (count) => {
      const seen = [state()];
      for (let turn = 0; turn < count; turn += 1) {
        await vi.advanceTimersByTimeAsync(HOLD);
        seen.push(state());
      }
      return seen;
    };

    queue.announce('Saving project...');
    queue.announce('Waypoint moved');
    queue.announce('Export failed: the encoder stopped.');
    // The error said again, as an error: it waits once, as the error it is.
    queue.announce('Export failed: the encoder stopped.', 'assertive');
    expect(await turns(3)).toEqual([
      ['Saving project...', 'polite'],
      ['Export failed: the encoder stopped.', 'assertive'],
      ['Waypoint moved', 'polite'],
      ['', 'polite'],
    ]);

    // The text showing, said again assertively, is neither cut short nor said again.
    queue.announce('Export failed: the encoder stopped.');
    queue.announce('Export failed: the encoder stopped.', 'assertive');
    expect(await turns(1)).toEqual([
      ['Export failed: the encoder stopped.', 'polite'],
      ['', 'polite'],
    ]);
  });

  test('a message marked whenIdle waits until nothing else shows or waits: it cuts nothing short, displaces nothing, and later messages go ahead of it (UI-06; the owner, 2026-10-09)', async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    const region = document.createElement('div');
    const queue = createAnnouncementQueue(region);
    const seen = [];
    const turns = async (count) => {
      for (let turn = 0; turn < count; turn += 1) {
        seen.push(region.textContent);
        await vi.advanceTimersByTimeAsync(HOLD);
      }
      seen.push(region.textContent);
    };

    queue.announce('Previous session restored', 'polite', { essential: true });
    queue.announce('A tip', 'polite', { whenIdle: true });
    // A burst past the cap of routine messages: the tip is not one of them.
    for (const message of ['Playing animation', 'Animation paused', 'Undo']) queue.announce(message);
    await turns(5);
    expect(seen).toEqual(['Previous session restored', 'Playing animation', 'Animation paused', 'Undo', 'A tip', '']);

    // With nothing showing, it is written at once.
    seen.length = 0;
    queue.announce('Another tip', 'polite', { whenIdle: true });
    await turns(1);
    expect(seen).toEqual(['Another tip', '']);
  });

  test('messages announced under a key are withdrawn together while they wait; the one showing keeps its hold, and nothing else moves (UI-06, Codex r2)', async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    const region = document.createElement('div');
    const queue = createAnnouncementQueue(region);
    const seen = [];
    const turns = async (count) => {
      for (let turn = 0; turn < count; turn += 1) {
        seen.push(region.textContent);
        await vi.advanceTimersByTimeAsync(HOLD);
      }
      seen.push(region.textContent);
    };
    const thisExport = Symbol('this export');
    const another = Symbol('another export');

    queue.announce('Starting video export — press Esc to cancel');
    queue.announce('Exporting MP4 25%', 'polite', { key: thisExport });
    queue.announce('Waypoint moved');
    queue.announce('Exporting MP4 50%', 'polite', { key: thisExport });
    queue.withdraw(thisExport);
    queue.announce('Exporting WebM 25%', 'polite', { key: another });
    queue.announce('Video export cancelled');
    await turns(4);
    expect(seen).toEqual(['Starting video export — press Esc to cancel', 'Waypoint moved', 'Exporting WebM 25%', 'Video export cancelled', '']);

    // What is showing was written already: it is not withdrawn. A keyed
    // message another caller asked for too is no longer the key's alone.
    seen.length = 0;
    queue.announce('Exporting MP4 75%', 'polite', { key: thisExport });
    queue.announce('Saving project...', 'polite', { key: thisExport });
    queue.announce('Saving project...');
    queue.withdraw(thisExport);
    await turns(2);
    expect(seen).toEqual(['Exporting MP4 75%', 'Saving project...', '']);
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

    // The start's tip follows all of it, and displaces none of it (the owner, 2026-10-09).
    expect(since(shown)).toEqual([
      [0, BACKGROUND_WARNING],
      [HOLD, outcome],
      [2 * HOLD, 'Animation paused'],
      [3 * HOLD, 'Playing animation'],
      [4 * HOLD, 'Animation paused'],
      [5 * HOLD, BOOT_TIP],
      [6 * HOLD, ''],
    ]);
  });

  test('the boot tip is spoken after the start-up recovery messages, however long the restore takes, and displaces none of them (UI-06; the owner, 2026-10-09)', async () => {
    const legacy = await legacyRecoveryPoint();
    // The restore's background decodes only when told: after the tip's 1.5 s.
    const decode = ImageAsset.decodeDataURL;
    let release = null;
    vi.spyOn(ImageAsset, 'decodeDataURL').mockImplementationOnce((...args) => new Promise((resolve) => {
      release = () => resolve(decode.apply(ImageAsset, args));
    }));
    const app = await bootRestoring(legacy);
    const { shown } = recordRegion();
    await vi.advanceTimersByTimeAsync(2000);
    expect(release).toEqual(expect.any(Function));
    expect(shown).toEqual([]);
    release();
    expect(await settle(app.ready)).toBe(true);
    // The author plays and pauses at once, as in the restore above.
    press(app, 'play', 'pause', 'play', 'pause');
    await playOut();

    expect(since(shown)).toEqual([
      [0, BACKGROUND_WARNING],
      [HOLD, 'Previous session restored'],
      [2 * HOLD, 'Animation paused'],
      [3 * HOLD, 'Playing animation'],
      [4 * HOLD, 'Animation paused'],
      [5 * HOLD, BOOT_TIP],
      [6 * HOLD, ''],
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

  test('a second project opened before the first one\'s warning is read gets that warning read once, after both are open', async () => {
    const app = await bootIdleApp();
    const file = await projectFile(app, { background: true });
    const { shown } = recordRegion();

    expect(await settle(app.loadProject(file))).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(await settle(app.loadProject(file))).toBe(true);
    await playOut();

    // The first opening's warning still waited when the second asked for it.
    expect(since(shown)).toEqual([
      [0, 'Loading project...'],
      [HOLD, BACKGROUND_WARNING],
      [2 * HOLD, 'Loading project...'],
      [3 * HOLD, 'Animation paused'],
      [4 * HOLD, 'Project loaded'],
      [5 * HOLD, ''],
    ]);
  });

  test('a second project opened while the first one\'s warning is read gets its own warning after its opening', async () => {
    const app = await bootIdleApp();
    const file = await projectFile(app, { background: true });
    const { region, shown } = recordRegion();

    expect(await settle(app.loadProject(file))).toBe(true);
    await vi.advanceTimersByTimeAsync(2 * HOLD + 300);
    expect(region.textContent).toBe(BACKGROUND_WARNING);
    expect(await settle(app.loadProject(file))).toBe(true);
    await playOut();

    // The first opening's own pause (DEF-67) and "Project loaded" each take a turn.
    expect(since(shown)).toEqual([
      [0, 'Loading project...'],
      [HOLD, 'Animation paused'],
      [2 * HOLD, BACKGROUND_WARNING],
      [3 * HOLD, 'Loading project...'],
      [4 * HOLD, 'Animation paused'],
      [5 * HOLD, BACKGROUND_WARNING],
      [6 * HOLD, 'Project loaded'],
      [7 * HOLD, ''],
    ]);
  });

  test('twelve Site walk openings a second apart leave one warning to read after the last, and the region clear soon after', async () => {
    // The second review's reproduction, through the Examples menu with the
    // shipped archive: the site serves it from the build output, docs/.
    const app = await bootIdleApp();
    const serveRepository = globalThis.fetch;
    globalThis.fetch = vi.fn(input => serveRepository(String(input).replace(/^examples\//, 'docs/examples/')));
    const opening = vi.spyOn(app, 'loadExampleProject');
    const siteWalk = [...document.querySelectorAll('#example-projects-menu button')]
      .find(item => item.textContent === 'Site walk');
    const { shown } = recordRegion();

    for (let click = 0; click < 12; click += 1) {
      if (click) await vi.advanceTimersByTimeAsync(1000);
      siteWalk.click();
      expect(await settle(opening.mock.results.at(-1).value)).toBe(true);
    }
    const stopped = Date.now();
    await playOut();

    // Every opening asked for the warning; one copy waited for them all, and
    // is read after the last.
    const warnings = shown.filter(([, text]) => text === BACKGROUND_WARNING).map(([at]) => at);
    expect(warnings.filter(at => at > stopped)).toHaveLength(1);
    // The region is clear within a hold for the message showing and one for each that may wait.
    const [clearedAt, cleared] = shown.at(-1);
    expect(cleared).toBe('');
    expect(clearedAt - stopped).toBeLessThanOrEqual((1 + ANNOUNCEMENTS.MAX_WAITING + 1) * HOLD);
  });

  test('the start\'s tip arriving during twelve Site walk openings is read after the last one\'s warning, and the region clears one hold later (UI-06; the owner, 2026-10-09)', async () => {
    // Tips are "queued after the start-up recovery messages so they never cut
    // in" (the owner): one shown in the middle of the burst waits for the end.
    const app = await bootIdleApp();
    const serveRepository = globalThis.fetch;
    globalThis.fetch = vi.fn(input => serveRepository(String(input).replace(/^examples\//, 'docs/examples/')));
    const opening = vi.spyOn(app, 'loadExampleProject');
    const siteWalk = [...document.querySelectorAll('#example-projects-menu button')]
      .find(item => item.textContent === 'Site walk');
    const { shown } = recordRegion();

    for (let click = 0; click < 12; click += 1) {
      if (click) await vi.advanceTimersByTimeAsync(1000);
      // Shown as `_showPreviewTipToast` shows it, on the test's clock.
      if (click === 6) app.showToast(BOOT_TIP, 8000, null, { whenIdle: true });
      siteWalk.click();
      expect(await settle(opening.mock.results.at(-1).value)).toBe(true);
    }
    const stopped = Date.now();
    await playOut();

    // The warning still waits once for all the openings, and is read after the last;
    const warnings = shown.filter(([, text]) => text === BACKGROUND_WARNING).map(([at]) => at);
    expect(warnings.filter(at => at > stopped)).toHaveLength(1);
    // the tip is read once, after it, last;
    const tips = shown.filter(([, text]) => text === BOOT_TIP).map(([at]) => at);
    expect(tips).toHaveLength(1);
    expect(tips[0]).toBeGreaterThan(warnings.at(-1));
    expect(shown.at(-2)[1]).toBe(BOOT_TIP);
    // and the region is clear within a hold for the message showing, one for
    // each that may wait, and one for the tip.
    const [clearedAt, cleared] = shown.at(-1);
    expect(cleared).toBe('');
    expect(clearedAt - stopped).toBeLessThanOrEqual((1 + ANNOUNCEMENTS.MAX_WAITING + 1 + 1) * HOLD);
  });

  test('Clear All\'s warning that recovery could not be cleared is shown though a burst of routine messages follows it', async () => {
    const app = await bootIdleApp();
    vi.spyOn(app.storageService, 'clearAutoSave').mockReturnValue(false);
    document.getElementById('splash-close').click();
    const { shown } = recordRegion();

    // Clear All, then Clear in its confirmation.
    press(app, 'clear');
    await vi.advanceTimersByTimeAsync(0);
    document.getElementById('clear-confirm').click();
    for (const message of ['Undo', 'Redo', 'Waypoint deleted', 'Waypoint duplicated']) app.announce(message);
    await playOut();

    // It is assertive, so it is kept, and shown after what Clear All's reset said.
    expect(since(shown)).toEqual([
      [0, 'Animation reset'],
      [HOLD, 'Browser recovery could not be cleared; reload may restore old work.'],
      [2 * HOLD, 'Redo'],
      [3 * HOLD, 'Waypoint deleted'],
      [4 * HOLD, 'Waypoint duplicated'],
      [5 * HOLD, ''],
    ]);
  });
});

/**
 * Codex r2: an export's spoken progress (25, 50 and 75 %) waits its turn like
 * any message, and outlived the export: cancelled while the start's message
 * still held the region, the queue went on to read "25%" and "50%" before
 * "Video export cancelled". Progress belongs to its export; when the export
 * ends, however it ends, what of it still waits is withdrawn.
 */
describe('an export\'s progress belongs to it (UI-06 J-18, Codex r2)', () => {
  const START = 'Starting video export — press Esc to cancel';

  test.each([
    ['is cancelled with Escape', 'Video export cancelled', (reject) => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(reject).toHaveBeenCalledOnce();
    }],
    ['fails', 'Export failed: the encoder failed', reject => reject(new Error('the encoder failed'))],
    ['finishes', 'Video export complete', (reject, resolve) => resolve(new Blob(['video']))],
  ])('an export that %s while its first two marks wait behind the start: neither is written, and its end is', async (_, end, finish) => {
    const app = await bootIdleApp();
    document.getElementById('splash-close').click();
    app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
    await playOut();
    allowConsole(/Video export failed/);
    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    const announce = vi.spyOn(app, 'announce');
    let pending;
    const reject = vi.fn(error => pending.reject(error));
    app.videoExporter = {
      export: ({ onProgress }) => new Promise((resolve, rejectExport) => {
        pending = { resolve, reject: rejectExport };
        onProgress(25);
        onProgress(50);
      }),
      cancel: () => reject(new Error('Export cancelled')),
    };
    const { region, shown } = recordRegion();

    const exported = app.exportVideo({ format: 'mp4' });
    await vi.advanceTimersByTimeAsync(0);
    // Both were said, and wait behind the start, which still holds the region.
    expect(announce.mock.calls.map(([message]) => message)).toEqual(expect.arrayContaining(['Exporting MP4 25%', 'Exporting MP4 50%']));
    expect(region.textContent).toBe(START);

    finish(reject, value => pending.resolve(value));
    await settle(exported);
    await playOut();

    const written = shown.map(([, text]) => text);
    expect(written.filter(text => /^Exporting /.test(text))).toEqual([]);
    expect(written.slice(written.indexOf(START))).toEqual([START, end, '']);
  });
});
