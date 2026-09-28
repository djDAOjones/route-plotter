/**
 * DEF-28 — a recovery record that could not be restored is kept, and offered.
 *
 * A failed restore used to reach the console alone, and the next edit's
 * autosave overwrote the record, so the work in it was lost without the
 * author ever learning of it. Joe's treatment (decision log, 2026-09-28,
 * option A): announce it; set the record aside under a key autosave never
 * writes; offer **Download it** and **Discard** until the author chooses.
 * Clear All discards it too, and says so. When storage cannot hold both the
 * parked record and a new autosave, the parked record stays, and the
 * autosave's failure report points to the notice.
 *
 * Each test boots the real app over an in-memory `localStorage`, so the
 * startup restore reads what a browser would have kept.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { LOAD_REFUSED } from './helpers/projectSnapshot.js';
import { STORAGE } from '../src/config/constants.js';

const AUTOSAVE = STORAGE.AUTOSAVE_KEY;
const PARKED = STORAGE.PARKED_AUTOSAVE_KEY;
const NOTICE = "Your previous session couldn't be restored.";

/**
 * A browser's storage, in memory. `quotaFor` names keys a write to which
 * fails as a full store does.
 */
function useStorage(entries = {}, { quotaFor = [] } = {}) {
  const store = new Map(Object.entries(entries));
  localStorage.getItem.mockImplementation(key => (store.has(key) ? store.get(key) : null));
  localStorage.setItem.mockImplementation((key, value) => {
    if (quotaFor.includes(key)) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    store.set(key, String(value));
  });
  localStorage.removeItem.mockImplementation((key) => { store.delete(key); });
  return store;
}

afterEach(() => {
  localStorage.getItem.mockImplementation(() => null);
  localStorage.setItem.mockImplementation(() => {});
  localStorage.removeItem.mockImplementation(() => {});
});

/** A saved project, as a booted app writes it. */
async function savedProject() {
  const app = await bootApp();
  await app.ready;
  app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
  return app._buildProjectSnapshot();
}

/**
 * A record the loader refuses (a Graphics scale of 0 is invalid), laid out
 * as the app never would, so a copy made by re-serialising it shows.
 */
async function refusedRecord() {
  const project = await savedProject();
  project.styles.graphicsScale = 0;
  return JSON.stringify(project, null, 2);
}

/**
 * Boot over a browser storage holding `entries`, recording every
 * announcement, including those made while starting. The app class is not
 * exported, so a first app, booted over empty storage, lends its prototype.
 */
async function bootRecording(entries, options) {
  const probe = await bootApp();
  await probe.ready;
  const announce = vi.spyOn(Object.getPrototypeOf(probe), 'announce');
  try {
    const store = useStorage(entries, options);
    const app = await bootApp();
    await app.ready;
    return { app, store, announced: announce.mock.calls.map(([message]) => message) };
  } finally {
    announce.mockRestore();
  }
}

const notice = () => document.getElementById('unrestored-notice');

describe('a record that cannot be restored (DEF-28)', () => {
  test('is set aside as it was stored, announced, and offered', async () => {
    allowConsole(LOAD_REFUSED);
    const record = await refusedRecord();
    const { store, app, announced } = await bootRecording({ [AUTOSAVE]: record });

    expect(app.waypoints).toHaveLength(0);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(store.get(PARKED)).toBe(record);
    expect(notice().hidden).toBe(false);
    expect(notice().textContent).toContain(NOTICE);
    expect(announced).toContain(`${NOTICE} It is kept until you download or discard it.`);
  });

  test('is set aside when it is not even JSON', async () => {
    allowConsole(/Failed to load from localStorage \(routePlotter_autosave\)/);
    const { store } = await bootRecording({ [AUTOSAVE]: '{"coordVersion": 9, "waypoints": [' });

    expect(store.has(AUTOSAVE)).toBe(false);
    expect(store.get(PARKED)).toBe('{"coordVersion": 9, "waypoints": [');
    expect(notice().hidden).toBe(false);
  });

  test('is set aside, not cleared, when its format is older than the app reads', async () => {
    // Joe, 2026-09-28: a refused autosave gets this notice, never a silent clear.
    const project = await savedProject();
    project.coordVersion = 5;
    const record = JSON.stringify(project);
    const { store } = await bootRecording({ [AUTOSAVE]: record });

    expect(store.has(AUTOSAVE)).toBe(false);
    expect(store.get(PARKED)).toBe(record);
    expect(notice().hidden).toBe(false);
  });

  test('leaves new work to autosave, and autosave leaves it alone', async () => {
    allowConsole(LOAD_REFUSED);
    const record = await refusedRecord();
    const { store, app } = await bootRecording({ [AUTOSAVE]: record });

    app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.5, isMajor: true });
    app.storageService.flushAutoSave();

    expect(JSON.parse(store.get(AUTOSAVE)).waypoints).toHaveLength(1);
    expect(store.get(PARKED)).toBe(record);
    expect(localStorage.setItem.mock.calls.filter(([key]) => key === PARKED)).toHaveLength(1);
  });

  test('downloads as it was stored', async () => {
    allowConsole(LOAD_REFUSED);
    const record = await refusedRecord();
    await bootRecording({ [AUTOSAVE]: record });
    const blobs = [];
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob);
      return 'blob:unrestored';
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function recordDownload() {
      blobs.push(this.download);
    });
    try {
      document.getElementById('unrestored-download').click();
    } finally {
      createObjectURL.mockRestore();
      click.mockRestore();
    }

    const [blob, filename] = blobs;
    expect(filename).toBe('route-plotter-unrestored-session.json');
    expect(blob.type).toBe('application/json');
    expect(await blob.text()).toBe(record);
    // Downloading is not choosing: the record waits for Discard or Clear All.
    expect(notice().hidden).toBe(false);
  });

  test('goes when the author discards it', async () => {
    allowConsole(LOAD_REFUSED);
    const { store, app } = await bootRecording({ [AUTOSAVE]: await refusedRecord() });
    const announce = vi.spyOn(app, 'announce');

    document.getElementById('unrestored-discard').click();

    expect(store.has(PARKED)).toBe(false);
    expect(notice().hidden).toBe(true);
    expect(announce).toHaveBeenCalledWith('The session that couldn\'t be restored was discarded.');
  });

  test('stays where it was, and says so, when the store cannot take a copy', async () => {
    allowConsole(LOAD_REFUSED, /Failed to save to localStorage \(routePlotter_parkedAutosave\)/);
    const record = await refusedRecord();

    const { store, announced } = await bootRecording({ [AUTOSAVE]: record }, { quotaFor: [PARKED] });

    expect(store.get(AUTOSAVE)).toBe(record);
    expect(store.has(PARKED)).toBe(false);
    expect(notice().hidden).toBe(false);
    expect(announced).toContain(
      `${NOTICE} This browser could not keep it aside, so the next autosave will replace it: download it first if you want it.`
    );
  });

  test('is offered again by the next start, until the author chooses', async () => {
    const { store, announced } = await bootRecording({ [PARKED]: 'kept from an earlier session' });

    expect(store.get(PARKED)).toBe('kept from an earlier session');
    expect(notice().hidden).toBe(false);
    expect(announced).toContain(`${NOTICE} It is kept until you download or discard it.`);
  });
});

describe('Clear All and a record that could not be restored (DEF-28)', () => {
  test('says it will discard the record too, and does', async () => {
    allowConsole(LOAD_REFUSED);
    const { store, app } = await bootRecording({ [AUTOSAVE]: await refusedRecord() });
    const announce = vi.spyOn(app, 'announce');

    expect(document.getElementById('clear-unrestored-note').hidden).toBe(false);
    document.getElementById('clear-confirm').click();

    expect(store.has(PARKED)).toBe(false);
    expect(notice().hidden).toBe(true);
    expect(document.getElementById('clear-unrestored-note').hidden).toBe(true);
    expect(announce).toHaveBeenCalledWith('Project cleared, and the session that couldn\'t be restored was discarded');
  });

  test('says nothing of one when there is none', async () => {
    const { app } = await bootRecording({});
    const announce = vi.spyOn(app, 'announce');

    expect(document.getElementById('clear-unrestored-note').hidden).toBe(true);
    expect(notice().hidden).toBe(true);
    document.getElementById('clear-confirm').click();

    expect(announce).toHaveBeenCalledWith('Project cleared');
  });
});

describe('what may never remove the parked record (DEF-28)', () => {
  test('a recovery write that fails clears the recovery key, not the parked record', async () => {
    // A restore rewrites recovery at once (model-only); when that write fails,
    // `clearAutoSave` runs (`persistence.js`), and it must not reach the record.
    allowConsole(/Failed to save to localStorage \(routePlotter_autosave\)/);
    const valid = JSON.stringify(await savedProject());
    const { store, app, announced } = await bootRecording({ [AUTOSAVE]: valid, [PARKED]: 'kept from an earlier session' }, { quotaFor: [AUTOSAVE] });

    expect(app.waypoints).toHaveLength(2);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(store.get(PARKED)).toBe('kept from an earlier session');
    expect(announced).toContain('Previous session restored, but browser recovery is now unavailable. Save a project file to keep it safe.');
  });

  test('a full store keeps it, and the failure report points to it', async () => {
    allowConsole(/Failed to save to localStorage \(routePlotter_autosave\)/);
    const { store, app } = await bootRecording({ [PARKED]: 'kept from an earlier session' }, { quotaFor: [AUTOSAVE] });
    const announce = vi.spyOn(app, 'announce');

    app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.5, isMajor: true });
    app.storageService.flushAutoSave();

    expect(store.get(PARKED)).toBe('kept from an earlier session');
    expect(announce).toHaveBeenCalledWith(
      'Auto-save failed. Save a project file to keep your work, or download or discard the session that couldn\'t be restored to make room.'
    );
  });
});
