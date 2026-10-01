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
 * Nothing but that Discard and Clear All may remove one or write over it: not
 * a second record that fails (each has a key of its own), not a store with no
 * room for a copy (the record is then held where it was, and no tab writes
 * there until the author chooses), not a commit that rolls back, not a later
 * start.
 *
 * Each test boots the real app over an in-memory `localStorage`, so the
 * startup restore reads what a browser would have kept.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { LOAD_REFUSED } from './helpers/projectSnapshot.js';
import { STORAGE } from '../src/config/constants.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { StorageService } from '../src/services/StorageService.js';
import { keepUnrestoredAutosave } from '../src/app/unrestoredAutosave.js';

const AUTOSAVE = STORAGE.AUTOSAVE_KEY;
const KEPT_PREFIX = STORAGE.KEPT_AUTOSAVE_PREFIX;
const HELD_MARK = STORAGE.HELD_AUTOSAVE_KEY;
const NOW = "Your previous session couldn't be restored.";
const EARLIER = "An earlier session couldn't be restored.";
const KEPT = 'Kept until you discard it. You can download a copy.';
const HELD = "Kept until you discard it, and new work isn't saved in this browser until then. You can download a copy.";
const HELD_HERE = "Kept by this tab only, so download it now to keep a copy. New work isn't saved in this browser until you discard it.";
const UNKEPT = "This browser couldn't keep it, so download it now to keep a copy.";
const CACHED = "This browser's storage can't be read at the moment, so download it now to keep a copy.";
const DISCARDED = "The session that couldn't be restored was discarded.";
const FREE_SPACE = " To free space, download the session that couldn't be restored, then discard it.";
const OFF_UNTIL = " Auto-save is off until you discard the session that couldn't be restored; download it first to keep a copy.";
const WRITE_FAILED = /Failed to save to localStorage/;
/**
 * A store full to its last character also refuses the preview tip's
 * one-time flag, which is written unguarded from a timer; seen already, the
 * tip is not shown, and the flag is not written.
 */
const TIP_SEEN = { routePlotter_previewTipDismissed: 'true' };
const TIP_SIZE = Object.entries(TIP_SEEN).reduce((total, [key, value]) => total + key.length + value.length, 0);

const isKept = key => key.startsWith(KEPT_PREFIX);
/** A key an earlier start kept a record under. */
const keptKey = (time, tag) => `${KEPT_PREFIX}${time}-${tag}`;

/**
 * A browser's storage, in memory, searchable as `localStorage` is. A write to
 * a key `quotaFor` names, or one that would take the store past `capacity`
 * characters (keys and values both, as browsers count them), fails as a full
 * store does; a removal from a key `removalFails` names, or a read of one
 * `readFails` names, throws; so does a search while `searchFails()` says so.
 * Each names keys by value or by a test, which is given the store too.
 */
function useStorage(entries = {}, { quotaFor = [], capacity = Infinity, removalFails = [], readFails = [], searchFails = () => false } = {}) {
  const store = new Map(Object.entries(entries));
  const names = list => key => list.some(entry => (typeof entry === 'function' ? entry(key, store) : entry === key));
  const [refused, unremovable, unreadable] = [quotaFor, removalFails, readFails].map(names);
  const size = () => [...store].reduce((total, [key, value]) => total + key.length + value.length, 0);
  localStorage.getItem.mockImplementation((key) => {
    if (unreadable(key)) throw new DOMException('The operation is insecure.', 'SecurityError');
    return store.has(key) ? store.get(key) : null;
  });
  localStorage.setItem.mockImplementation((key, value) => {
    const text = String(value);
    const replaced = store.has(key) ? key.length + store.get(key).length : 0;
    if (refused(key) || size() - replaced + key.length + text.length > capacity) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    store.set(key, text);
  });
  localStorage.removeItem.mockImplementation((key) => {
    if (unremovable(key)) throw new DOMException('The operation is insecure.', 'SecurityError');
    store.delete(key);
  });
  Object.defineProperty(localStorage, 'length', {
    configurable: true,
    get: () => {
      if (searchFails()) throw new DOMException('The operation is insecure.', 'SecurityError');
      return store.size;
    },
  });
  localStorage.key = index => [...store.keys()][index] ?? null;
  return store;
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.getItem.mockImplementation(() => null);
  localStorage.setItem.mockImplementation(() => {});
  localStorage.removeItem.mockImplementation(() => {});
  delete localStorage.length;
  delete localStorage.key;
});

/** The records kept under keys of their own, newest first. */
function kept(store) {
  return [...store.keys()].filter(isKept).sort().reverse().map(key => store.get(key));
}

/** A saved project, as a booted app writes it. */
async function savedProject() {
  const app = await bootApp();
  await app.ready;
  app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
  app.storageService.cancelAutoSave();
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

/** A record in a format older than the app reads (Joe: kept, never cleared). */
async function olderRecord(name) {
  const project = await savedProject();
  project.coordVersion = 5;
  project.name = name;
  return JSON.stringify(project);
}

/**
 * Start the app over the storage as it stands, recording every announcement,
 * including those made while starting. The app class is not exported, so an
 * app booted earlier lends its prototype.
 */
async function restart(prototype) {
  const announce = vi.spyOn(prototype, 'announce');
  try {
    const app = await bootApp();
    await app.ready;
    return {
      app,
      announced: announce.mock.calls.map(([message, priority = 'polite']) => ({ message, priority })),
    };
  } finally {
    announce.mockRestore();
  }
}

/** Boot over a browser storage holding `entries`, recording announcements. */
async function bootRecording(entries, options) {
  const probe = await bootApp();
  await probe.ready;
  const prototype = Object.getPrototypeOf(probe);
  const store = useStorage(entries, options);
  const { app, announced } = await restart(prototype);
  return { app, store, announced, prototype };
}

/** Record the announcements a booted app makes from now on. */
function listen(app) {
  const announce = vi.spyOn(app, 'announce');
  return () => announce.mock.calls.map(([message, priority = 'polite']) => ({ message, priority }));
}

const notice = () => document.getElementById('unrestored-notice');
const heading = () => document.getElementById('unrestored-notice-text').textContent;
const status = () => document.getElementById('unrestored-notice-status').textContent;
const clearNote = () => document.getElementById('clear-unrestored-note');
const announcer = () => document.getElementById('announcer').textContent;
const discard = () => document.getElementById('unrestored-discard').click();
/** Clear All's dialog opened and cancelled: the notice reads the store again. */
function refresh() {
  document.getElementById('clear-btn').click();
  document.getElementById('clear-cancel').click();
}
const COULD_NOT = { message: "The session that couldn't be restored could not be discarded.", priority: 'assertive' };

/** A change in the editor, and its autosave written at once. */
function editAndSave(app) {
  app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.5, isMajor: true });
  app.storageService.flushAutoSave();
}

/** What the notice's Download it hands the browser: the blob, then the file name. */
function download() {
  const handed = [];
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    handed.push(blob);
    return 'blob:unrestored';
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function recordDownload() {
    handed.push(this.download);
  });
  try {
    document.getElementById('unrestored-download').click();
  } finally {
    createObjectURL.mockRestore();
    click.mockRestore();
  }
  return handed;
}

/** Hold `loadAutosave`'s staging on a background image that decodes only when told. */
function holdDecoding() {
  let fail;
  const reached = new Promise((resolveReached) => {
    vi.spyOn(ImageAsset, 'decodeDataURL').mockImplementation(() => new Promise((_, reject) => {
      fail = reject;
      resolveReached();
    }));
  });
  return { reached, fail: () => fail(new Error('the background could not be decoded')) };
}

describe('a record that cannot be restored (DEF-28)', () => {
  test('is set aside as it was stored, announced, and offered', async () => {
    allowConsole(LOAD_REFUSED);
    const record = await refusedRecord();
    const { store, app, announced } = await bootRecording({ [AUTOSAVE]: record });

    expect(app.waypoints).toHaveLength(0);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(kept(store)).toEqual([record]);
    expect(notice().hidden).toBe(false);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(KEPT);
    expect(announced).toContainEqual({ message: `${NOW} ${KEPT}`, priority: 'assertive' });
  });

  test('is set aside when it is not even JSON', async () => {
    allowConsole(LOAD_REFUSED);
    const { store } = await bootRecording({ [AUTOSAVE]: '{"coordVersion": 9, "waypoints": [' });

    expect(store.has(AUTOSAVE)).toBe(false);
    expect(kept(store)).toEqual(['{"coordVersion": 9, "waypoints": [']);
    expect(notice().hidden).toBe(false);
  });

  test('is set aside, not cleared, when its format is older than the app reads', async () => {
    // Joe, 2026-09-28: a refused autosave gets this notice, never a silent clear.
    const record = await olderRecord('older');
    const { store } = await bootRecording({ [AUTOSAVE]: record });

    expect(store.has(AUTOSAVE)).toBe(false);
    expect(kept(store)).toEqual([record]);
    expect(notice().hidden).toBe(false);
  });

  test('leaves new work to autosave, and autosave leaves it alone', async () => {
    allowConsole(LOAD_REFUSED);
    const record = await refusedRecord();
    const { store, app } = await bootRecording({ [AUTOSAVE]: record });

    editAndSave(app);

    expect(JSON.parse(store.get(AUTOSAVE)).waypoints).toHaveLength(1);
    expect(kept(store)).toEqual([record]);
    expect(localStorage.setItem.mock.calls.filter(([key]) => isKept(key))).toHaveLength(1);
  });

  test('downloads as it was stored, and stays until the author discards it', async () => {
    allowConsole(LOAD_REFUSED);
    const record = await refusedRecord();
    const { store, prototype } = await bootRecording({ [AUTOSAVE]: record });

    const [blob, filename] = download();

    expect(filename).toBe('route-plotter-unrestored-session.json');
    expect(blob.type).toBe('application/json');
    expect(await blob.text()).toBe(record);
    // Downloading is not choosing: the record waits for Discard or Clear All.
    expect(kept(store)).toEqual([record]);
    expect(notice().hidden).toBe(false);
    await restart(prototype);
    expect(notice().hidden).toBe(false);
    expect(kept(store)).toEqual([record]);
  });

  test('goes when the author discards it, and the announcement says so', async () => {
    allowConsole(LOAD_REFUSED);
    const { store, app } = await bootRecording({ [AUTOSAVE]: await refusedRecord() });
    const announced = listen(app);

    discard();

    expect(kept(store)).toEqual([]);
    expect(notice().hidden).toBe(true);
    expect(announced()).toEqual([{ message: DISCARDED, priority: 'polite' }]);
    expect(announcer()).toBe(DISCARDED);
  });

  test('is offered again by the next start, as one kept earlier, until the author chooses', async () => {
    const { store, announced } = await bootRecording({ [keptKey(1, 'a')]: 'kept from an earlier session' });

    expect(kept(store)).toEqual(['kept from an earlier session']);
    expect(notice().hidden).toBe(false);
    expect(heading()).toBe(EARLIER);
    expect(status()).toBe(KEPT);
    expect(announced).toContainEqual({ message: `${EARLIER} ${KEPT}`, priority: 'assertive' });
  });

  test('is kept when the commit rolls back, as when staging refuses it', async () => {
    // The commit can fail after it began replacing the project; it rolls
    // back, so nothing was restored, and the record is kept like any other.
    const record = JSON.stringify(await savedProject(), null, 2);
    const store = useStorage();
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED);
    vi.spyOn(app.imageAssetService, 'replaceAssets').mockImplementationOnce(() => {
      throw new Error('commit failed before the model was replaced');
    });

    expect(await app.loadAutosave()).toBe(false);

    expect(app.waypoints).toHaveLength(0);
    expect(kept(store)).toEqual([record]);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(notice().hidden).toBe(false);
    editAndSave(app);
    expect(kept(store)).toEqual([record]);
  });

  test('is not kept when the project restored and only what follows the commit failed', async () => {
    const record = JSON.stringify(await savedProject());
    const store = useStorage();
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(/Restoring the autosave did not finish after it was loaded/);
    app.eventBus.on('project:replaced', () => { throw new Error('an observer of the new project failed'); });

    expect(await app.loadAutosave()).toBe(false);

    expect(app.waypoints).toHaveLength(2);
    expect(kept(store)).toEqual([]);
    expect(notice().hidden).toBe(true);
  });

  test('is the record that was read, even if another tab writes the key while it restores', async () => {
    const record = JSON.stringify({ ...(await savedProject()), backgroundImage: 'data:image/png;base64,iVBORw0KGgo=' });
    const store = useStorage();
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED);
    const decoding = holdDecoding();

    const restoring = app.loadAutosave();
    await decoding.reached;
    store.set(AUTOSAVE, 'a newer record, written by another tab');
    decoding.fail();

    expect(await restoring).toBe(false);
    expect(kept(store)).toEqual([record]);
    expect(store.get(AUTOSAVE)).toBe('a newer record, written by another tab');
  });

  test('is kept although the recovery key cannot be read again: the copy is made, and the key left alone', async () => {
    const record = await refusedRecord();
    const store = useStorage();
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED, /Failed to load from localStorage \(routePlotter_autosave\)/);
    let reads = 0;
    const read = localStorage.getItem.getMockImplementation();
    localStorage.getItem.mockImplementation((key) => {
      if (key === AUTOSAVE && ++reads > 1) throw new DOMException('The operation is insecure.', 'SecurityError');
      return read(key);
    });

    expect(await app.loadAutosave()).toBe(false);

    expect(kept(store)).toEqual([record]);
    expect(store.get(AUTOSAVE)).toBe(record);
    expect(status()).toBe(KEPT);
  });
});

describe('more than one record that could not be restored (DEF-28)', () => {
  test('are each kept under a key of their own, across starts, and offered one at a time, this start’s first', async () => {
    const second = await olderRecord('second');
    const { store, announced, prototype } = await bootRecording({
      [keptKey(1, 'first')]: 'first record',
      [AUTOSAVE]: second,
    });

    expect(kept(store)).toEqual([second, 'first record']);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(KEPT);
    expect(announced).toContainEqual({ message: `${NOW} ${KEPT}`, priority: 'assertive' });
    expect(clearNote().textContent).toBe("The 2 sessions that couldn't be restored will be discarded too.");
    const [blob] = download();
    expect(await blob.text()).toBe(second);

    const again = await restart(prototype);
    expect(kept(store)).toEqual([second, 'first record']);
    expect(heading()).toBe(EARLIER);

    const later = listen(again.app);
    editAndSave(again.app);
    expect(JSON.parse(store.get(AUTOSAVE)).waypoints).toHaveLength(1);
    discard();
    expect(kept(store)).toEqual(['first record']);
    expect(heading()).toBe(EARLIER);
    expect(later()).toContainEqual({ message: `${DISCARDED} ${EARLIER} ${KEPT}`, priority: 'polite' });
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");

    discard();
    expect(kept(store)).toEqual([]);
    expect(notice().hidden).toBe(true);
  });

  test('are all kept when one fails at each of three starts', async () => {
    const records = [await olderRecord('one'), await olderRecord('two'), await olderRecord('three')];
    const { store, prototype } = await bootRecording({ [AUTOSAVE]: records[0] });
    for (const record of records.slice(1)) {
      store.set(AUTOSAVE, record);
      await restart(prototype);
    }

    expect(kept(store).sort()).toEqual([...records].sort());
    expect(clearNote().textContent).toBe("The 3 sessions that couldn't be restored will be discarded too.");
  });

  test('are one record when an earlier start kept it but could not clear the recovery key', async () => {
    allowConsole(LOAD_REFUSED);
    const { store } = await bootRecording({ [keptKey(1, 'a')]: 'the same record', [AUTOSAVE]: 'the same record' });

    expect(kept(store)).toEqual(['the same record']);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(heading()).toBe(EARLIER);
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");
  });

  test('are each an earlier start’s when a recovery copy of one is refused again, the first on offer or not, and nothing is told as this start’s', async () => {
    allowConsole(LOAD_REFUSED);
    const record = await refusedRecord();
    const { app, announced } = await bootRecording({ [keptKey(1, 't')]: record, [keptKey(2, 'q')]: 'a newer record', [AUTOSAVE]: record });

    expect(app._unrestoredOffers.map(({ text, earlier }) => ({ text, earlier })))
      .toEqual([{ text: 'a newer record', earlier: true }, { text: record, earlier: true }]);
    expect(announced.filter(call => call.message.startsWith(NOW))).toEqual([]);
  });

  test('leave no copy in the recovery key for Discard to miss, so none returns on reload', async () => {
    allowConsole(LOAD_REFUSED, /Failed to remove from localStorage \(routePlotter_autosave\)/);
    const record = await refusedRecord();
    const removal = { fails: true };
    const { store, prototype } = await bootRecording(
      { [AUTOSAVE]: record, [STORAGE.SPLASH_SHOWN_KEY]: 'true' },
      { removalFails: [key => removal.fails && key === AUTOSAVE] }
    );
    expect(kept(store)).toEqual([record]);
    expect(store.get(AUTOSAVE)).toBe(record);

    // While the copy in the recovery key cannot go, Discard says it failed.
    discard();
    expect(notice().hidden).toBe(false);
    expect(announcer()).toBe("The session that couldn't be restored could not be discarded.");

    removal.fails = false;
    discard();
    expect(kept(store)).toEqual([]);
    expect(store.has(AUTOSAVE)).toBe(false);
    await restart(prototype);
    expect(notice().hidden).toBe(true);
  });
});

describe('a record no copy of which fits (DEF-28)', () => {
  test('is held where it was, and autosave leaves it until the author discards it', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const record = await refusedRecord();
    const { store, app, announced } = await bootRecording({ [AUTOSAVE]: record }, { quotaFor: [isKept] });

    expect(store.get(AUTOSAVE)).toBe(record);
    expect(kept(store)).toEqual([]);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(HELD);
    expect(announced).toContainEqual({ message: `${NOW} ${HELD}`, priority: 'assertive' });

    const later = listen(app);
    editAndSave(app);
    expect(store.get(AUTOSAVE)).toBe(record);
    expect(later()).toContainEqual({ message: `Auto-save failed. Save a project file to keep your work.${OFF_UNTIL}`, priority: 'polite' });

    discard();
    expect(notice().hidden).toBe(true);
    expect(store.has(HELD_MARK)).toBe(false);
    // The work autosave could not write meanwhile is written now.
    app.storageService.flushAutoSave();
    expect(JSON.parse(store.get(AUTOSAVE)).waypoints).toHaveLength(1);
  });

  test('is held, and nothing removed to make room, when the store fits it exactly, and said to be kept by this tab only', async () => {
    // A full store, counted as browsers count it: a copy needs room the store
    // has not got, and the original is never given up to find it. Nor has it
    // room for the mark, so other tabs and later starts cannot know of it.
    allowConsole(LOAD_REFUSED, WRITE_FAILED, /Failed to save section states/);
    const record = await refusedRecord();
    const { store, app, announced } = await bootRecording(
      { [AUTOSAVE]: record, ...TIP_SEEN },
      { capacity: TIP_SIZE + AUTOSAVE.length + record.length }
    );

    expect(store.get(AUTOSAVE)).toBe(record);
    expect(localStorage.removeItem.mock.calls.filter(([key]) => key === AUTOSAVE)).toEqual([]);
    expect(status()).toBe(HELD_HERE);
    expect(announced).toContainEqual({ message: `${NOW} ${HELD_HERE}`, priority: 'assertive' });
    editAndSave(app);
    expect(store.get(AUTOSAVE)).toBe(record);

    // Discarded, it goes, and is not offered again as a record this tab
    // could not keep.
    discard();
    expect(notice().hidden).toBe(true);
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(notice().hidden).toBe(true);
  });

  test('held by this tab only, it goes with Clear All, and is not offered again', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED, /Failed to save section states/);
    const record = await refusedRecord();
    await bootRecording(
      { [AUTOSAVE]: record, ...TIP_SEEN },
      { capacity: TIP_SIZE + AUTOSAVE.length + record.length }
    );
    expect(status()).toBe(HELD_HERE);

    document.getElementById('clear-btn').click();
    document.getElementById('clear-confirm').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notice().hidden).toBe(true);
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(notice().hidden).toBe(true);
  });

  test('is held against another tab of the app, which cannot write or clear the recovery key over it', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const record = await refusedRecord();
    const { store } = await bootRecording({ [AUTOSAVE]: record }, { quotaFor: [isKept] });
    const otherTab = new StorageService();

    expect(otherTab.saveAutoSave({ coordVersion: 9, name: 'the other tab' })).toBe(false);
    expect(otherTab.clearAutoSave()).toBe(false);
    expect(store.get(AUTOSAVE)).toBe(record);
  });

  test('is still held, and offered, not tried again, at the next start', async () => {
    const record = JSON.stringify(await savedProject(), null, 2);
    const store = useStorage({}, { quotaFor: [isKept] });
    const app = await bootApp();
    await app.ready;
    const prototype = Object.getPrototypeOf(app);
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    vi.spyOn(app.imageAssetService, 'replaceAssets').mockImplementationOnce(() => {
      throw new Error('a commit failure that the next start would not meet');
    });
    expect(await app.loadAutosave()).toBe(false);
    expect(status()).toBe(HELD);

    const { app: next } = await restart(prototype);

    expect(next.waypoints).toHaveLength(0);
    expect(store.get(AUTOSAVE)).toBe(record);
    expect(heading()).toBe(EARLIER);
    expect(status()).toBe(HELD);
    discard();
    expect(store.has(AUTOSAVE)).toBe(false);
  });

  test('is offered for download, and not called kept, when no copy fits and another tab writes the key while it restores', async () => {
    const record = JSON.stringify({ ...(await savedProject()), backgroundImage: 'data:image/png;base64,iVBORw0KGgo=' });
    const store = useStorage({}, { quotaFor: [isKept] });
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const decoding = holdDecoding();

    const restoring = app.loadAutosave();
    await decoding.reached;
    store.set(AUTOSAVE, 'a newer record, written by another tab');
    decoding.fail();

    expect(await restoring).toBe(false);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(UNKEPT);
    const [blob] = download();
    expect(await blob.text()).toBe(record);
    // Nothing is held, so this tab's autosave writes as it always has.
    editAndSave(app);
    expect(JSON.parse(store.get(AUTOSAVE)).waypoints).toHaveLength(1);
    discard();
    expect(notice().hidden).toBe(true);
  });

  test('is held, not called unkept, when no copy fits and the recovery key cannot be read again', async () => {
    // It may still be there, so it is treated as there: held, not given up.
    const record = await refusedRecord();
    const store = useStorage({}, { quotaFor: [isKept] });
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED, WRITE_FAILED, /Failed to load from localStorage \(routePlotter_autosave\)/);
    let reads = 0;
    const read = localStorage.getItem.getMockImplementation();
    localStorage.getItem.mockImplementation((key) => {
      if (key === AUTOSAVE && ++reads > 1) throw new DOMException('The operation is insecure.', 'SecurityError');
      return read(key);
    });

    const heard = listen(app);
    expect(await app.loadAutosave()).toBe(false);

    expect(status()).toBe(HELD_HERE);
    expect(heard()).toContainEqual({ message: `${NOW} ${HELD_HERE}`, priority: 'assertive' });
    editAndSave(app);
    expect(store.get(AUTOSAVE)).toBe(record);
  });

  test('is out of reach of the storage service’s own import and clears, which say so', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const record = await refusedRecord();
    const { store, app } = await bootRecording({ [AUTOSAVE]: record }, { quotaFor: [isKept] });
    const service = app.storageService;

    expect(service.importData(JSON.stringify({ autosave: { name: 'imported' } }))).toBe(false);
    expect(service.saveAutoSave({ name: 'saved' })).toBe(false);
    expect(service.clearAutoSave()).toBe(false);
    expect(service.clearAll()).toBe(false);
    expect(store.get(AUTOSAVE)).toBe(record);
  });

  test('stays held when Discard cannot remove it', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED, /Failed to remove from localStorage \(routePlotter_autosave\)/);
    const record = await refusedRecord();
    const { store, app } = await bootRecording({ [AUTOSAVE]: record }, { quotaFor: [isKept], removalFails: [AUTOSAVE] });

    discard();

    expect(notice().hidden).toBe(false);
    expect(status()).toBe(HELD);
    editAndSave(app);
    expect(store.get(AUTOSAVE)).toBe(record);
  });

  test('once discarded, leaves a record another writer put in its place', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const record = await refusedRecord();
    const { store } = await bootRecording({ [AUTOSAVE]: record }, { quotaFor: [isKept] });
    store.set(AUTOSAVE, 'written by a build that does not know the mark');

    discard();

    expect(store.get(AUTOSAVE)).toBe('written by a build that does not know the mark');
    expect(notice().hidden).toBe(true);
    expect(store.has(HELD_MARK)).toBe(false);
  });

  test('once discarded, lets a project opened meanwhile reach browser recovery, unsaved or not', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const { store, app } = await bootRecording({ [AUTOSAVE]: await refusedRecord() }, { quotaFor: [isKept] });
    const project = app._buildProjectSnapshot();
    project.waypoints = [{ id: 'opened', imgX: 0.2, imgY: 0.3, isMajor: true }];
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({ projectData: project, imageAssets: [], backgroundBase64: null });
    expect(await app.loadProject(new File([''], 'opened.zip'))).toBe(true);
    expect(app._isDirty).toBe(false);

    discard();
    app.storageService.flushAutoSave();

    expect(JSON.parse(store.get(AUTOSAVE)).waypoints.map(waypoint => waypoint.id)).toEqual(['opened']);
  });

  test('once discarded, is written over without the project being marked edited', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const { app } = await bootRecording({ [AUTOSAVE]: await refusedRecord() }, { quotaFor: [isKept] });
    editAndSave(app);
    const revision = app._editRevision;

    discard();

    expect(app._editRevision).toBe(revision);
  });
});

describe('Discard and a record that could not be restored (DEF-28)', () => {
  test('removes only the record it offered', async () => {
    const { store } = await bootRecording({
      [keptKey(2, 'b')]: 'offered first',
      [keptKey(1, 'a')]: 'offered next',
    });

    discard();

    expect(kept(store)).toEqual(['offered next']);
    expect(heading()).toBe(EARLIER);
  });

  test('says so, and keeps the offer, when the record cannot be removed', async () => {
    allowConsole(/Failed to remove from localStorage \(routePlotter_keptAutosave:/);
    const { store, app } = await bootRecording({ [keptKey(1, 'a')]: 'kept' }, { removalFails: [isKept] });
    const announced = listen(app);

    discard();

    expect(kept(store)).toEqual(['kept']);
    expect(notice().hidden).toBe(false);
    expect(announced()).toEqual([
      { message: "The session that couldn't be restored could not be discarded.", priority: 'assertive' },
    ]);
  });

  test('moves focus on to the next control when the notice closes under it', async () => {
    // Seen before, so the splash does not open and hold focus itself.
    await bootRecording({ [keptKey(1, 'a')]: 'kept', [STORAGE.SPLASH_SHOWN_KEY]: 'true' });
    const button = document.getElementById('unrestored-discard');
    button.focus();

    button.click();

    const focused = document.activeElement;
    expect(notice().hidden).toBe(true);
    expect(notice().contains(focused)).toBe(false);
    expect(focused).not.toBe(document.body);
    expect(focused.closest('[hidden]')).toBe(null);
    expect(focused.disabled).toBeFalsy();
    expect(notice().compareDocumentPosition(focused) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('leaves focus where it was when the notice stays for the next record', async () => {
    await bootRecording({
      [keptKey(2, 'b')]: 'first',
      [keptKey(1, 'a')]: 'next',
      [STORAGE.SPLASH_SHOWN_KEY]: 'true',
    });
    const button = document.getElementById('unrestored-discard');
    button.focus();

    button.click();

    expect(notice().hidden).toBe(false);
    expect(document.activeElement).toBe(button);
  });
});

describe('Clear All and a record that could not be restored (DEF-28)', () => {
  test('says it will discard the record too, and does', async () => {
    allowConsole(LOAD_REFUSED);
    const { store, app } = await bootRecording({ [AUTOSAVE]: await refusedRecord() });
    const announced = listen(app);

    expect(clearNote().hidden).toBe(false);
    document.getElementById('clear-confirm').click();

    expect(kept(store)).toEqual([]);
    expect(notice().hidden).toBe(true);
    expect(clearNote().hidden).toBe(true);
    expect(announced()).toContainEqual({
      message: "Project cleared, and the session that couldn't be restored was discarded",
      priority: 'polite',
    });
  });

  test('discards every record, a held one too, and autosave writes again', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const { store, app } = await bootRecording(
      { [keptKey(1, 'a')]: 'kept earlier', [AUTOSAVE]: await refusedRecord() },
      { quotaFor: [isKept] }
    );
    expect(status()).toBe(HELD);
    const announced = listen(app);

    document.getElementById('clear-confirm').click();

    expect(kept(store)).toEqual([]);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(store.has(HELD_MARK)).toBe(false);
    expect(notice().hidden).toBe(true);
    expect(announced()).toContainEqual({
      message: "Project cleared, and the 2 sessions that couldn't be restored were discarded",
      priority: 'polite',
    });
    editAndSave(app);
    expect(JSON.parse(store.get(AUTOSAVE)).waypoints).toHaveLength(1);
  });

  test('discards a record kept after this start, and says so', async () => {
    const { store, app } = await bootRecording({});
    store.set(keptKey(9, 'late'), 'kept by another tab');
    const announced = listen(app);

    document.getElementById('clear-confirm').click();

    expect(kept(store)).toEqual([]);
    expect(announced()).toContainEqual({
      message: "Project cleared, and the session that couldn't be restored was discarded",
      priority: 'polite',
    });
  });

  test('discards a kept record it cannot read, and says so', async () => {
    allowConsole(/Failed to load from localStorage \(routePlotter_keptAutosave:/);
    const unreadable = keptKey(1, 'unreadable');
    const { store, app } = await bootRecording({ [unreadable]: 'kept' }, { readFails: [unreadable] });
    expect(notice().hidden).toBe(true);
    const announced = listen(app);

    document.getElementById('clear-confirm').click();

    expect(store.has(unreadable)).toBe(false);
    expect(announced()).toContainEqual({
      message: "Project cleared, and the session that couldn't be restored was discarded",
      priority: 'polite',
    });
  });

  test('says so, and keeps the offer, when the record cannot be removed', async () => {
    allowConsole(/Failed to remove from localStorage \(routePlotter_keptAutosave:/);
    const { store, app } = await bootRecording({ [keptKey(1, 'a')]: 'kept' }, { removalFails: [isKept] });
    const announced = listen(app);

    document.getElementById('clear-confirm').click();

    expect(kept(store)).toEqual(['kept']);
    expect(notice().hidden).toBe(false);
    expect(announced()).toContainEqual({
      message: 'Browser recovery could not be cleared; reload may restore old work.',
      priority: 'assertive',
    });
  });

  test('says nothing of one when there is none', async () => {
    const { app } = await bootRecording({});
    const announced = listen(app);

    expect(clearNote().hidden).toBe(true);
    expect(notice().hidden).toBe(true);
    document.getElementById('clear-confirm').click();

    expect(announced()).toContainEqual({ message: 'Project cleared', priority: 'polite' });
  });
});

describe('what may never remove or overwrite a kept record (DEF-28)', () => {
  test('a recovery write that fails after a restore clears the recovery key, not the record, and says how to free space', async () => {
    // A restore rewrites recovery at once (model-only); when that write fails,
    // `clearAutoSave` runs (`persistence.js`), and it must not reach the record.
    allowConsole(/Failed to save to localStorage \(routePlotter_autosave\)/);
    const valid = JSON.stringify(await savedProject());
    const { store, app, announced } = await bootRecording(
      { [AUTOSAVE]: valid, [keptKey(1, 'a')]: 'kept from an earlier session' },
      { quotaFor: [AUTOSAVE] }
    );

    expect(app.waypoints).toHaveLength(2);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(kept(store)).toEqual(['kept from an earlier session']);
    expect(announced.at(-1)).toEqual({
      message: `Previous session restored, but browser recovery is now unavailable. Save a project file to keep it safe.${FREE_SPACE}`,
      priority: 'polite',
    });
  });

  test('a restore that works says a record kept earlier is still waiting', async () => {
    const valid = JSON.stringify(await savedProject());
    const { store, announced } = await bootRecording({ [AUTOSAVE]: valid, [keptKey(1, 'a')]: 'kept from an earlier session' });

    expect(kept(store)).toEqual(['kept from an earlier session']);
    expect(announced.at(-1)).toEqual({
      message: "Previous session restored. An earlier session couldn't be restored, and is kept until you discard it.",
      priority: 'assertive',
    });
  });

  test('a full store keeps it, and the failure report says how to free space', async () => {
    allowConsole(/Failed to save to localStorage \(routePlotter_autosave\)/);
    const { store, app } = await bootRecording({ [keptKey(1, 'a')]: 'kept from an earlier session' }, { quotaFor: [AUTOSAVE] });
    const announced = listen(app);

    editAndSave(app);

    expect(kept(store)).toEqual(['kept from an earlier session']);
    expect(announced()).toContainEqual({
      message: `Auto-save failed. Save a project file to keep your work.${FREE_SPACE}`,
      priority: 'polite',
    });
  });

  test('clearing recovery, the storage service’s own clear, an edit and undo, and opening a project', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const record = await refusedRecord();
    const { store, app } = await bootRecording(
      { [keptKey(1, 'a')]: 'kept earlier', [AUTOSAVE]: record },
      { quotaFor: [isKept] }
    );

    expect(app.storageService.clearAutoSave()).toBe(false);
    expect(app.storageService.clearAll()).toBe(false);
    expect(kept(store)).toEqual(['kept earlier']);
    expect(store.get(AUTOSAVE)).toBe(record);

    app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.5, isMajor: true });
    app.eventBus.emit('history:undo');
    app.storageService.flushAutoSave();
    window.dispatchEvent(new Event('pagehide'));
    expect(kept(store)).toEqual(['kept earlier']);
    expect(store.get(AUTOSAVE)).toBe(record);

    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: app._buildProjectSnapshot(), imageAssets: [], backgroundBase64: null,
    });
    const announced = listen(app);
    expect(await app.loadProject(new File([''], 'project.zip'))).toBe(true);
    expect(kept(store)).toEqual(['kept earlier']);
    expect(store.get(AUTOSAVE)).toBe(record);
    expect(announced()).toContainEqual({
      message: `Project loaded, but browser recovery is unavailable. Save the project file to keep it safe.${OFF_UNTIL}`,
      priority: 'polite',
    });
  });
});

describe('several tabs, and a store that cannot always be read (DEF-28)', () => {
  const noCopies = { quotaFor: [isKept] };

  test('discarding a record another tab already discarded leaves a newer held record, and its mark, alone', () => {
    allowConsole(WRITE_FAILED);
    const store = useStorage({ [AUTOSAVE]: 'first held' }, noCopies);
    const firstTab = new StorageService();
    expect(firstTab.keepUnrestored('first held')).toEqual({ where: 'held', durable: true });
    const secondTab = new StorageService();
    expect(secondTab.discardKept({ text: 'first held', where: 'held' })).toBe(true);
    expect(secondTab.saveAutoSave({ coordVersion: 9, name: 'second' })).toBe(true);
    const second = store.get(AUTOSAVE);
    expect(secondTab.keepUnrestored(second).where).toBe('held');
    const secondMark = store.get(HELD_MARK);

    // The first tab still offers the first record, and its author discards it.
    expect(firstTab.discardKept({ text: 'first held', where: 'held' })).toBe(true);

    expect(store.get(AUTOSAVE)).toBe(second);
    expect(store.get(HELD_MARK)).toBe(secondMark);
    expect(new StorageService().saveAutoSave({ name: 'a third tab' })).toBe(false);
    expect(store.get(AUTOSAVE)).toBe(second);
  });

  test('a hold another tab ended ends here too, and this tab saves again', () => {
    allowConsole(WRITE_FAILED);
    useStorage({ [AUTOSAVE]: 'held' }, noCopies);
    const here = new StorageService();
    here.keepUnrestored('held');
    const otherTab = new StorageService();
    expect(otherTab.holdState()).toEqual({ state: 'held', text: 'held', durable: true });
    expect(otherTab.discardKept({ text: 'held', where: 'held' })).toBe(true);

    expect(here.holdState()).toEqual({ state: 'none' });
    expect(here.saveAutoSave({ name: 'new work' })).toBe(true);
  });

  test('a hold ends when a build that knows no mark writes over it, and the stale mark goes', () => {
    allowConsole(WRITE_FAILED);
    const store = useStorage({ [AUTOSAVE]: 'held' }, noCopies);
    const here = new StorageService();
    here.keepUnrestored('held');
    store.set(AUTOSAVE, 'written by an older build');

    expect(here.saveAutoSave({ name: 'new work' })).toBe(true);
    expect(store.has(HELD_MARK)).toBe(false);
  });

  test('a held record that finds room under its own key is no longer held, here or in the tab that held it', () => {
    allowConsole(WRITE_FAILED);
    const room = { forCopies: false };
    const store = useStorage({ [AUTOSAVE]: 'held' }, { quotaFor: [key => isKept(key) && !room.forCopies] });
    const here = new StorageService();
    here.keepUnrestored('held');
    room.forCopies = true;

    expect(new StorageService().keepUnrestored('held').where).toBe('parked');
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(here.saveAutoSave({ name: 'new work' })).toBe(true);

    here.keepUnrestored(store.get(AUTOSAVE));
    expect(here.holdState()).toEqual({ state: 'none' });
  });

  test('keeping a held record again, once there is room, ends its hold', () => {
    allowConsole(WRITE_FAILED);
    const room = { forCopies: false };
    const store = useStorage({ [AUTOSAVE]: 'held' }, { quotaFor: [key => isKept(key) && !room.forCopies] });
    const here = new StorageService();
    here.keepUnrestored('held');
    room.forCopies = true;

    expect(here.keepUnrestored('held').where).toBe('parked');
    expect(here.saveAutoSave({ name: 'new work' })).toBe(true);
    expect(store.has(HELD_MARK)).toBe(false);
  });

  test('a held record kept under a key of its own is no longer held, though its recovery copy cannot be removed', () => {
    // It is safe under its own key, so autosave may write over the old copy.
    allowConsole(WRITE_FAILED, /Failed to remove from localStorage \(routePlotter_autosave\)/);
    const room = { forCopies: false };
    const store = useStorage(
      { [AUTOSAVE]: 'held' },
      { quotaFor: [key => isKept(key) && !room.forCopies], removalFails: [AUTOSAVE] }
    );
    const here = new StorageService();
    here.keepUnrestored('held');
    room.forCopies = true;

    expect(here.keepUnrestored('held').where).toBe('parked');
    expect(store.get(AUTOSAVE)).toBe('held');
    expect(store.has(HELD_MARK)).toBe(false);
    expect(here.holdState()).toEqual({ state: 'none' });
    expect(here.saveAutoSave({ name: 'new work' })).toBe(true);
    expect(kept(store)).toEqual(['held']);
  });

  test('a mark, or a marked recovery key, that cannot be read stops every write', () => {
    allowConsole(/Failed to load from localStorage/);
    const unreadable = { key: HELD_MARK };
    useStorage({ [HELD_MARK]: 'a mark' }, { readFails: [key => key === unreadable.key] });
    const service = new StorageService();

    expect(service.saveAutoSave({ name: 'new work' })).toBe(false);
    unreadable.key = AUTOSAVE;
    expect(service.saveAutoSave({ name: 'new work' })).toBe(false);
  });

  test('a record is offered, and not restored, while its mark cannot be read', async () => {
    allowConsole(/Failed to load from localStorage \(routePlotter_heldAutosave\)/);
    const record = JSON.stringify(await savedProject());
    const { store, app } = await bootRecording(
      { [AUTOSAVE]: record, [HELD_MARK]: 'a mark' },
      { readFails: [HELD_MARK] }
    );

    expect(app.waypoints).toHaveLength(0);
    expect(store.get(AUTOSAVE)).toBe(record);
    expect(notice().hidden).toBe(false);
    expect(status()).toBe(HELD_HERE);
  });

  test('a mark whose record has gone does not stop saving, even when it cannot be removed', () => {
    allowConsole(/Failed to remove from localStorage \(routePlotter_heldAutosave\)/);
    useStorage({ [HELD_MARK]: 'a mark left behind' }, { removalFails: [HELD_MARK] });

    expect(new StorageService().saveAutoSave({ name: 'new work' })).toBe(true);
  });

  test('a record written over a held one is not taken for it', () => {
    // Two records the first version's 32-bit mark could not tell apart.
    allowConsole(WRITE_FAILED);
    const held = '{"coordVersion":9,"name":"6d0a83f534f412e9def98860"}';
    const replacement = '{"coordVersion":9,"name":"d3698241ec6f9382fa5f51e1"}';
    const store = useStorage({ [AUTOSAVE]: held }, noCopies);
    new StorageService().keepUnrestored(held);
    store.set(AUTOSAVE, replacement);

    expect(new StorageService().holdState()).toEqual({ state: 'none' });
  });

  test('records kept in the same millisecond each get a key of their own, newest first', () => {
    useStorage();
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    vi.spyOn(Math, 'random').mockReturnValue(0.125);
    const service = new StorageService();
    const first = service.keepUnrestored('first');
    const second = service.keepUnrestored('second');

    expect(first.key).not.toBe(second.key);
    expect(service.listKept().records.map(record => record.text)).toEqual(['second', 'first']);
  });

  test('Discard removes every readable copy of the record it offered', async () => {
    const { store } = await bootRecording({
      [keptKey(2, 'b')]: 'the same record',
      [keptKey(1, 'a')]: 'the same record',
    });

    discard();

    expect(kept(store)).toEqual([]);
    expect(notice().hidden).toBe(true);
  });

  test('keeping a record while the recovery key cannot be read leaves another record’s mark alone', () => {
    allowConsole(WRITE_FAILED, /Failed to load from localStorage \(routePlotter_autosave\)/);
    const unreadable = { now: false };
    const store = useStorage({ [AUTOSAVE]: 'B' }, { ...noCopies, readFails: [key => key === AUTOSAVE && unreadable.now] });
    expect(new StorageService().keepUnrestored('B')).toEqual({ where: 'held', durable: true });
    const markB = store.get(HELD_MARK);

    unreadable.now = true;
    expect(new StorageService().keepUnrestored('A')).toEqual({ where: 'held', durable: false });
    unreadable.now = false;

    expect(store.get(HELD_MARK)).toBe(markB);
    expect(new StorageService().saveAutoSave({ name: 'a third tab' })).toBe(false);
    expect(store.get(AUTOSAVE)).toBe('B');
  });

  test('a restore that fails while the recovery key cannot be read keeps its record on offer, and another tab’s hold', async () => {
    const record = JSON.stringify({ ...(await savedProject()), backgroundImage: 'data:image/png;base64,iVBORw0KGgo=' });
    const unreadable = { now: false };
    const store = useStorage({}, { ...noCopies, readFails: [key => key === AUTOSAVE && unreadable.now] });
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED, WRITE_FAILED, /Failed to load from localStorage \(routePlotter_autosave\)/);
    const decoding = holdDecoding();

    const restoring = app.loadAutosave();
    await decoding.reached;
    // Meanwhile another tab writes its own record, which it cannot restore, and holds.
    const otherTab = new StorageService();
    expect(otherTab.saveAutoSave({ coordVersion: 9, name: 'the other tab' })).toBe(true);
    const otherRecord = store.get(AUTOSAVE);
    expect(otherTab.keepUnrestored(otherRecord)).toEqual({ where: 'held', durable: true });
    const otherMark = store.get(HELD_MARK);
    unreadable.now = true;
    decoding.fail();
    expect(await restoring).toBe(false);
    expect(status()).toBe(HELD_HERE);
    unreadable.now = false;

    expect(store.get(HELD_MARK)).toBe(otherMark);
    expect(new StorageService().saveAutoSave({ name: 'a third tab' })).toBe(false);
    expect(store.get(AUTOSAVE)).toBe(otherRecord);
    // This tab's record is still its to download, as not kept; the other's is offered as held.
    window.dispatchEvent(new StorageEvent('storage', { key: HELD_MARK, newValue: otherMark }));
    expect(app._unrestoredOffers.map(offer => [offer.where, offer.text === record])).toEqual([['unkept', true], ['held', false]]);
    expect(status()).toBe(UNKEPT);
    const [blob] = download();
    expect(await blob.text()).toBe(record);
  });

  test('a hold ends in the tab that held it once another tab keeps the record under its own key, though that tab could not remove this copy', () => {
    allowConsole(WRITE_FAILED, /Failed to remove from localStorage \(routePlotter_autosave\)/);
    const room = { forCopies: false };
    const removal = { fails: false };
    const store = useStorage({ [AUTOSAVE]: 'held' }, {
      quotaFor: [key => isKept(key) && !room.forCopies],
      removalFails: [key => key === AUTOSAVE && removal.fails],
    });
    const holder = new StorageService();
    expect(holder.keepUnrestored('held')).toEqual({ where: 'held', durable: true });
    room.forCopies = true;
    removal.fails = true;
    expect(new StorageService().keepUnrestored('held').where).toBe('parked');
    removal.fails = false;

    expect(store.get(AUTOSAVE)).toBe('held');
    expect(holder.holdState()).toEqual({ state: 'none' });
    expect(holder.saveAutoSave({ name: 'new work' })).toBe(true);
    expect(kept(store)).toEqual(['held']);
  });

  test('a Discard of a held record another tab has since kept under its own key removes that copy too', () => {
    allowConsole(WRITE_FAILED);
    const room = { forCopies: false };
    const store = useStorage({ [AUTOSAVE]: 'held' }, { quotaFor: [key => isKept(key) && !room.forCopies] });
    const here = new StorageService();
    here.keepUnrestored('held');
    room.forCopies = true;
    expect(new StorageService().keepUnrestored('held').where).toBe('parked');

    expect(here.discardKept({ text: 'held', where: 'held' })).toBe(true);
    expect(kept(store)).toEqual([]);
    expect(store.has(AUTOSAVE)).toBe(false);
  });

  test('Discard says it failed when the store cannot be searched for other copies, or one cannot be removed', () => {
    allowConsole(/Failed to search localStorage for kept sessions/, /Failed to remove from localStorage/);
    const search = { fails: false };
    let store = useStorage({ [keptKey(2, 'b')]: 'same', [keptKey(1, 'a')]: 'same' }, { searchFails: () => search.fails });
    search.fails = true;
    expect(new StorageService().discardKept({ text: 'same', where: 'parked', key: keptKey(2, 'b') })).toBe(false);
    expect(kept(store)).toEqual(['same']);

    store = useStorage({ [keptKey(2, 'b')]: 'same', [keptKey(1, 'a')]: 'same' }, { removalFails: [keptKey(1, 'a')] });
    expect(new StorageService().discardKept({ text: 'same', where: 'parked', key: keptKey(2, 'b') })).toBe(false);
    expect(kept(store)).toEqual(['same']);
  });

  test('discarding a record this tab could not keep leaves the recovery key alone', () => {
    const store = useStorage({ [AUTOSAVE]: 'other work' });
    expect(new StorageService().discardKept({ text: 'a record not kept', where: 'unkept' })).toBe(true);
    expect(store.get(AUTOSAVE)).toBe('other work');
  });

  test('Clear All says it failed when a hold cannot be read', () => {
    allowConsole(/Failed to load from localStorage \(routePlotter_heldAutosave\)/);
    useStorage({ [HELD_MARK]: 'a mark', [AUTOSAVE]: 'held' }, { readFails: [HELD_MARK] });
    expect(new StorageService().discardAllKept().ok).toBe(false);
  });

  test('saving the same work again writes it when another tab has removed it since', () => {
    const store = useStorage();
    const here = new StorageService();
    expect(here.saveAutoSave({ name: 'work' })).toBe(true);
    store.delete(AUTOSAVE);

    expect(here.autoSave({ name: 'work' })).toEqual({ ok: true, pending: true });
    here.flushAutoSave();
    expect(JSON.parse(store.get(AUTOSAVE))).toEqual({ name: 'work' });
  });

  test('the notice follows another tab: a record it keeps shows, a store it clears goes', async () => {
    const { store } = await bootRecording({});
    expect(notice().hidden).toBe(true);
    store.set(keptKey(9, 'late'), 'kept by another tab');
    window.dispatchEvent(new StorageEvent('storage', { key: keptKey(9, 'late'), newValue: 'kept by another tab' }));
    expect(notice().hidden).toBe(false);
    expect(heading()).toBe(EARLIER);

    store.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(notice().hidden).toBe(true);
  });

  test('a held record written over by a build that knows no mark leaves the notice, which no longer says saving is off', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const { store } = await bootRecording({ [AUTOSAVE]: await refusedRecord() }, noCopies);
    expect(status()).toBe(HELD);

    store.set(AUTOSAVE, 'written by an older build');
    window.dispatchEvent(new StorageEvent('storage', { key: AUTOSAVE, newValue: 'written by an older build' }));

    expect(notice().hidden).toBe(true);
  });

  test('a record this tab could keep only in memory, kept since by another tab, is offered once, as this start’s, and Discard removes that copy', async () => {
    const record = JSON.stringify({ ...(await savedProject()), backgroundImage: 'data:image/png;base64,iVBORw0KGgo=' });
    const room = { forCopies: false };
    const store = useStorage({}, { quotaFor: [key => isKept(key) && !room.forCopies] });
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const decoding = holdDecoding();
    const restoring = app.loadAutosave();
    await decoding.reached;
    store.set(AUTOSAVE, 'a newer record, written by another tab');
    decoding.fail();
    expect(await restoring).toBe(false);
    expect(status()).toBe(UNKEPT);

    // Another tab, which read the same record, keeps it once there is room.
    room.forCopies = true;
    const { key } = new StorageService().keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: record }));

    expect(app._unrestoredOffers.map(offer => offer.where)).toEqual(['parked']);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(KEPT);
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");
    const heard = listen(app);
    discard();
    expect(kept(store)).toEqual([]);
    expect(notice().hidden).toBe(true);
    expect(heard()).toEqual([{ message: DISCARDED, priority: 'polite' }]);
  });

  test('a record this tab held without its mark, kept since by another tab and then discarded there, is not offered again', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED, /Failed to save section states/);
    const record = await refusedRecord();
    // A full store: no copy fits, nor the mark. Room is made later.
    const capacity = { value: TIP_SIZE + AUTOSAVE.length + record.length, valueOf() { return this.value; } };
    const { store } = await bootRecording({ [AUTOSAVE]: record, ...TIP_SEEN }, { capacity });
    expect(status()).toBe(HELD_HERE);

    capacity.value = Infinity;
    const otherTab = new StorageService();
    const { key } = otherTab.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: record }));
    expect(notice().hidden).toBe(false);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(KEPT);

    // The author discards it there.
    expect(otherTab.discardKept({ text: record, where: 'parked', key })).toBe(true);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: null }));
    expect(kept(store)).toEqual([]);
    expect(notice().hidden).toBe(true);
  });

  /**
   * This tab's restore of `record` fails while another tab writes the
   * recovery key, and no copy fits: the record is kept only in memory here.
   */
  async function keptOnlyInMemory(options = {}) {
    const record = JSON.stringify({ ...(await savedProject()), backgroundImage: 'data:image/png;base64,iVBORw0KGgo=' });
    const room = { forCopies: false };
    const store = useStorage({}, { quotaFor: [key => isKept(key) && !room.forCopies], ...options });
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED, WRITE_FAILED, /Failed to load from localStorage/);
    const decoding = holdDecoding();
    const restoring = app.loadAutosave();
    await decoding.reached;
    store.set(AUTOSAVE, 'a newer record, written by another tab');
    decoding.fail();
    expect(await restoring).toBe(false);
    expect(status()).toBe(UNKEPT);
    return { app, store, record, room };
  }

  test('Clear All over a record this tab could keep only in memory says it discarded that session', async () => {
    const { app } = await keptOnlyInMemory();
    const heard = listen(app);

    document.getElementById('clear-btn').click();
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");
    document.getElementById('clear-confirm').click();

    expect(heard()).toContainEqual({ message: "Project cleared, and the session that couldn't be restored was discarded", priority: 'polite' });
    expect(app._unrestoredOffers).toEqual([]);
  });

  test('a Discard of a record kept only in memory removes the copy another tab kept, though this tab had not heard of it', async () => {
    const { store, record, room } = await keptOnlyInMemory();
    room.forCopies = true;
    new StorageService().keepUnrestored(record);

    discard();
    expect(kept(store)).toEqual([]);
  });

  test('a record kept only in memory here, held by another tab under a mark this tab cannot read, is offered once', async () => {
    const unreadable = { now: false };
    const { app, store, record } = await keptOnlyInMemory({ readFails: [key => key === HELD_MARK && unreadable.now] });
    store.set(AUTOSAVE, record);
    expect(new StorageService().keepUnrestored(record)).toEqual({ where: 'held', durable: true });
    unreadable.now = true;
    window.dispatchEvent(new StorageEvent('storage', { key: HELD_MARK, newValue: store.get(HELD_MARK) }));

    expect(app._unrestoredOffers.map(offer => offer.where)).toEqual(['held']);
  });

  test('a hold without its mark stays while an unrelated record is kept under a key of its own', () => {
    allowConsole(WRITE_FAILED);
    const store = useStorage(
      { [AUTOSAVE]: 'held', [keptKey(1, 'q')]: 'another record' },
      { quotaFor: [key => isKept(key) || key === HELD_MARK] }
    );
    const here = new StorageService();

    expect(here.keepUnrestored('held')).toEqual({ where: 'held', durable: false });
    expect(here.holdState()).toEqual({ state: 'held', text: 'held', durable: false });
    expect(here.saveAutoSave({ name: 'new work' })).toBe(false);
    expect(store.get(AUTOSAVE)).toBe('held');
  });

  test('discarding a record kept only in memory leaves every other kept record', () => {
    const store = useStorage({ [keptKey(1, 'q')]: 'another record' });
    expect(new StorageService().discardKept({ text: 'a record kept only in memory', where: 'unkept' })).toBe(true);
    expect(kept(store)).toEqual(['another record']);
  });

  test('a record another tab holds shows here, and a failure to save here says why', async () => {
    allowConsole(WRITE_FAILED);
    const { store, app } = await bootRecording({}, noCopies);
    store.set(AUTOSAVE, 'held by another tab');
    new StorageService().keepUnrestored('held by another tab');
    window.dispatchEvent(new StorageEvent('storage', { key: HELD_MARK, newValue: store.get(HELD_MARK) }));

    expect(notice().hidden).toBe(false);
    expect(status()).toBe(HELD);
    const later = listen(app);
    editAndSave(app);
    expect(store.get(AUTOSAVE)).toBe('held by another tab');
    expect(later()).toContainEqual({ message: `Auto-save failed. Save a project file to keep your work.${OFF_UNTIL}`, priority: 'polite' });
  });

  test('a failure to save names a hold another tab made, though no storage event came', async () => {
    allowConsole(WRITE_FAILED);
    const { store, app } = await bootRecording({}, noCopies);
    store.set(AUTOSAVE, 'held by another tab');
    new StorageService().keepUnrestored('held by another tab');
    const later = listen(app);

    editAndSave(app);

    expect(later()).toContainEqual({ message: `Auto-save failed. Save a project file to keep your work.${OFF_UNTIL}`, priority: 'polite' });
    expect(notice().hidden).toBe(false);
  });

  test('a record this start kept can be downloaded even when its key cannot be read back', async () => {
    allowConsole(LOAD_REFUSED, /Failed to load from localStorage \(routePlotter_keptAutosave:/);
    const record = await refusedRecord();
    const { store } = await bootRecording(
      { [AUTOSAVE]: record },
      { readFails: [(key, entries) => isKept(key) && entries.has(key)] }
    );

    expect(kept(store)).toEqual([record]);
    expect(notice().hidden).toBe(false);
    expect(status()).toBe(KEPT);
    const [blob] = download();
    expect(await blob.text()).toBe(record);
  });

  test('Clear All’s dialog counts a kept record it cannot read', async () => {
    allowConsole(/Failed to load from localStorage \(routePlotter_keptAutosave:/);
    const unreadable = keptKey(1, 'unreadable');
    await bootRecording({ [unreadable]: 'kept' }, { readFails: [unreadable] });

    expect(notice().hidden).toBe(true);
    expect(clearNote().hidden).toBe(false);
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");
  });

  test('Clear All says it failed when it cannot search the store', async () => {
    allowConsole(/Failed to search localStorage for kept sessions/);
    const faults = { search: false };
    const { app } = await bootRecording({}, { searchFails: () => faults.search });
    faults.search = true;
    const announced = listen(app);

    document.getElementById('clear-btn').click();
    expect(clearNote().hidden).toBe(false);
    expect(clearNote().textContent).toBe("Any session that couldn't be restored will be discarded too.");
    document.getElementById('clear-confirm').click();

    expect(announced()).toContainEqual({
      message: 'Browser recovery could not be cleared; reload may restore old work.',
      priority: 'assertive',
    });
  });

  /**
   * A restore held at its background's decoding, in a tab that has a record
   * another tab read too: that tab keeps it under a key of its own, which
   * this tab sees, then the author discards it there (or clears all there).
   */
  async function discardedElsewhereDuringRestore(choice, start) {
    const record = JSON.stringify({ ...(await savedProject()), backgroundImage: 'data:image/png;base64,iVBORw0KGgo=' });
    const store = useStorage();
    allowConsole(LOAD_REFUSED);
    const { app, restoring, decoding } = await start(record, store);
    await decoding.reached;
    const otherTab = new StorageService();
    const { key } = otherTab.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: record }));
    expect(app._unrestoredOffers.map(offer => offer.where)).toEqual(['parked']);
    if (choice === 'Discard') {
      expect(otherTab.discardKept({ text: record, where: 'parked', key })).toBe(true);
    } else {
      expect(otherTab.discardAllKept().ok).toBe(true);
      expect(otherTab.clearAutoSave()).toBe(true);
    }
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: null }));
    expect(notice().hidden).toBe(true);
    decoding.fail();
    await restoring;
    return { app, store, record };
  }

  test.each(['Discard', 'Clear All'])('a restore still in progress does not keep again a record the author chose to discard in another tab meanwhile (%s)', async (choice) => {
    const { app, store, record } = await discardedElsewhereDuringRestore(choice, async (text, storage) => {
      const booted = await bootApp();
      await booted.ready;
      storage.set(AUTOSAVE, text);
      const decoding = holdDecoding();
      return { app: booted, restoring: booted.loadAutosave(), decoding };
    });

    expect(kept(store)).toEqual([]);
    expect(app._unrestoredOffers).toEqual([]);
    expect(notice().hidden).toBe(true);
    expect(store.get(AUTOSAVE)).not.toBe(record);
    // Nor does a later start find it.
    vi.mocked(ImageAsset.decodeDataURL).mockRestore();
    const { app: later } = await restart(Object.getPrototypeOf(app));
    expect(later._unrestoredOffers).toEqual([]);
  });

  test.each(['Discard', 'Clear All'])('nor does the restore a start makes (%s in another tab)', async (choice) => {
    const { app, store } = await discardedElsewhereDuringRestore(choice, async (text, storage) => {
      storage.set(AUTOSAVE, text);
      // Only the restore's decoding is held: the start's default image after it decodes.
      let fail;
      const reached = new Promise((resolveReached) => {
        vi.spyOn(ImageAsset, 'decodeDataURL').mockImplementationOnce(() => new Promise((_, reject) => {
          fail = reject;
          resolveReached();
        }));
      });
      const booted = await bootApp();
      return { app: booted, restoring: booted.ready, decoding: { reached, fail: () => fail(new Error('the background could not be decoded')) } };
    });

    expect(kept(store)).toEqual([]);
    expect(app._unrestoredOffers).toEqual([]);
  });

  test('a record kept only in memory here, then held by another tab under its mark, is offered once, as this start’s', async () => {
    const { app, store, record } = await keptOnlyInMemory();
    store.set(AUTOSAVE, record);
    expect(new StorageService().keepUnrestored(record)).toEqual({ where: 'held', durable: true });
    window.dispatchEvent(new StorageEvent('storage', { key: HELD_MARK, newValue: store.get(HELD_MARK) }));

    expect(app._unrestoredOffers.map(offer => [offer.where, offer.earlier])).toEqual([['held', false]]);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(HELD);
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");
  });

  test('a record kept only in memory here, held by another tab under a mark this tab cannot read, is one session to Clear All', async () => {
    const unreadable = { now: false };
    const { store, record } = await keptOnlyInMemory({ readFails: [key => key === HELD_MARK && unreadable.now] });
    store.set(AUTOSAVE, record);
    new StorageService().keepUnrestored(record);
    unreadable.now = true;
    window.dispatchEvent(new StorageEvent('storage', { key: HELD_MARK, newValue: store.get(HELD_MARK) }));

    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");
  });

  test('a record kept only in memory here stays on offer when another tab holds it under a mark this tab cannot read, then writes over it', async () => {
    const unreadable = { now: false };
    const { app, store, record } = await keptOnlyInMemory({ readFails: [key => key === HELD_MARK && unreadable.now] });
    const otherTab = new StorageService();
    store.set(AUTOSAVE, record);
    otherTab.keepUnrestored(record);
    unreadable.now = true;
    window.dispatchEvent(new StorageEvent('storage', { key: HELD_MARK, newValue: store.get(HELD_MARK) }));
    unreadable.now = false;
    // The other tab's hold ends (its author discarded it there, or a build
    // that knows no mark wrote over it): this tab cannot tell which.
    store.delete(HELD_MARK);
    store.set(AUTOSAVE, 'newer work');
    window.dispatchEvent(new StorageEvent('storage', { key: AUTOSAVE, newValue: 'newer work' }));

    expect(app._unrestoredOffers.map(offer => [offer.text === record, offer.where])).toEqual([[true, 'unkept']]);
  });

  test('two kept copies of one record are one offer and one session to Clear All, and Discard removes both', async () => {
    const { store } = await bootRecording({ [keptKey(1, 'a')]: 'a record', [keptKey(2, 'b')]: 'a record' });

    expect(notice().hidden).toBe(false);
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");
    discard();
    expect(kept(store)).toEqual([]);
    expect(notice().hidden).toBe(true);
  });

  test('a record kept only in memory here leaves another kept record as one kept earlier', async () => {
    const { app, store } = await keptOnlyInMemory();
    store.set(keptKey(1, 'q'), 'another record');
    window.dispatchEvent(new StorageEvent('storage', { key: keptKey(1, 'q'), newValue: 'another record' }));

    expect(app._unrestoredOffers.map(offer => [offer.where, offer.earlier])).toEqual([['unkept', false], ['parked', true]]);
  });

  test('a record this tab could keep only in memory, kept since by another tab and then discarded there, is not offered again', async () => {
    const { app, store, record, room } = await keptOnlyInMemory();
    room.forCopies = true;
    const otherTab = new StorageService();
    const { key } = otherTab.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: record }));
    expect(app._unrestoredOffers.map(offer => offer.where)).toEqual(['parked']);

    // The author discards it there.
    expect(otherTab.discardKept({ text: record, where: 'parked', key })).toBe(true);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: null }));

    expect(kept(store)).toEqual([]);
    expect(app._unrestoredOffers).toEqual([]);
    expect(notice().hidden).toBe(true);
  });

  test('a record this tab could keep only in memory, kept since by another tab under a key this tab later cannot read, can still be downloaded here', async () => {
    const unreadable = { key: null };
    const { app, record, room } = await keptOnlyInMemory({ readFails: [key => key === unreadable.key] });
    room.forCopies = true;
    const { key } = new StorageService().keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: record }));
    allowConsole(/Failed to load from localStorage \(routePlotter_keptAutosave:/);
    unreadable.key = key;
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: record }));

    expect(app._unrestoredOffers.map(offer => [offer.where, offer.text === record])).toEqual([['parked', true]]);
    const [blob, name] = download();
    expect(name).toBe('route-plotter-unrestored-session.json');
    expect(await blob.text()).toBe(record);
  });

  test('a restore still in progress keeps its record where this tab can read it, when another tab’s copy of it can no longer be read here', async () => {
    const record = JSON.stringify({ ...(await savedProject()), backgroundImage: 'data:image/png;base64,iVBORw0KGgo=' });
    const unreadable = { key: null };
    const store = useStorage({}, { readFails: [key => key === unreadable.key] });
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED, /Failed to load from localStorage \(routePlotter_keptAutosave:/);
    const decoding = holdDecoding();
    const restoring = app.loadAutosave();
    await decoding.reached;
    const { key } = new StorageService().keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: record }));
    unreadable.key = key;
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: record }));
    decoding.fail();
    await restoring;

    expect(app._unrestoredOffers.some(offer => offer.text === record && !offer.earlier)).toBe(true);
    const [blob] = download();
    expect(await blob.text()).toBe(record);
  });

  test('discarding a record kept only in memory says it failed when another tab has since put it in the recovery key, and it cannot go from there', async () => {
    const removal = { fails: false };
    const { app, store, record } = await keptOnlyInMemory({ removalFails: [key => key === AUTOSAVE && removal.fails] });
    allowConsole(/Failed to remove from localStorage \(routePlotter_autosave\)/);
    const [offered] = app._unrestoredOffers;
    store.set(AUTOSAVE, record);
    removal.fails = true;

    expect(app.storageService.discardKept(offered)).toBe(false);
    expect(store.get(AUTOSAVE)).toBe(record);
  });
});

describe('another tab during this start’s restore, and what Clear All says it did (DEF-28)', () => {
  /** A record whose restore fails on its background, decoded only when told. */
  async function recordWithBackground() {
    return JSON.stringify({ ...(await savedProject()), backgroundImage: 'data:image/png;base64,iVBORw0KGgo=' });
  }

  /** Start with `record` in browser recovery, its restore waiting on its background decode. */
  async function startRestoring(record, entries = {}, options = {}) {
    const store = useStorage({ ...entries, [AUTOSAVE]: record }, options);
    allowConsole(LOAD_REFUSED);
    let fail;
    const reached = new Promise((resolveReached) => {
      vi.spyOn(ImageAsset, 'decodeDataURL').mockImplementationOnce(() => new Promise((_, reject) => {
        fail = reject;
        resolveReached();
      }));
    });
    const app = await bootApp();
    const heard = listen(app);
    await reached;
    return { app, store, heard, fail: () => fail(new Error('the background could not be decoded')) };
  }

  test('a record another tab keeps while this start restores it, and this restore then fails, is this start’s, and its failure is announced', async () => {
    const record = await recordWithBackground();
    const { app, store, heard, fail } = await startRestoring(record);
    const otherTab = new StorageService();
    const { key } = otherTab.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: record }));

    fail();
    await app.ready;

    expect(kept(store)).toEqual([record]);
    expect(heading()).toBe(NOW);
    expect(app._unrestoredOffers.map(({ text, where, earlier }) => ({ text, where, earlier })))
      .toEqual([{ text: record, where: 'parked', earlier: false }]);
    expect(heard().filter(call => call.message.includes("couldn't be restored")))
      .toEqual([{ message: `${NOW} ${KEPT}`, priority: 'assertive' }]);
    const [blob] = download();
    expect(await blob.text()).toBe(record);
    editAndSave(app);
    expect(store.has(AUTOSAVE)).toBe(true);
    expect(kept(store)).toEqual([record]);
  });

  test.each([
    ['', {}],
    [', beside an unrelated record kept before this start', { [keptKey(1, 'q')]: 'an earlier record' }],
  ])('a record another tab keeps again after the author discarded it there, while this start restores it, is this start’s when the restore fails: told, offered, and not copied again%s', async (_, entries) => {
    allowConsole(/Failed to load from localStorage/);
    const record = await recordWithBackground();
    const faults = { unreadable: null };
    const { app, store, heard, fail } = await startRestoring(record, entries, { readFails: [key => key === faults.unreadable] });
    const mine = () => app._unrestoredOffers.filter(offer => offer.text === record).map(({ where, earlier }) => ({ where, earlier }));
    // A restore in a third tab has read the record too, and does not see what follows.
    const late = new StorageService();
    expect(late.loadAutoSaveText()).toBe(record);
    const otherTab = new StorageService();
    const first = otherTab.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key: first.key }));
    expect(otherTab.discardKept({ ...first, text: record })).toBe(true);
    window.dispatchEvent(new StorageEvent('storage', { key: first.key }));
    const again = late.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key: again.key }));

    fail();
    await app.ready;

    expect(kept(store).filter(text => text === record)).toEqual([record]);
    expect(heading()).toBe(NOW);
    expect(mine()).toEqual([{ where: 'parked', earlier: false }]);
    expect(heard().filter(call => call.message.startsWith(NOW)))
      .toEqual([{ message: `${NOW} ${KEPT}`, priority: 'assertive' }]);
    // Its copy can then no longer be read here: still this start's, and it downloads.
    faults.unreadable = again.key;
    refresh();
    expect(mine()).toEqual([{ where: 'parked', earlier: false }]);
    const [blob] = download();
    expect(await blob.text()).toBe(record);
  });

  test('a record the author discards in another tab during this start’s restore, kept there again only once the restore has ended, is an earlier start’s', async () => {
    const record = await recordWithBackground();
    const { app, heard, fail } = await startRestoring(record);
    const late = new StorageService();
    expect(late.loadAutoSaveText()).toBe(record);
    const otherTab = new StorageService();
    const first = otherTab.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key: first.key }));
    expect(otherTab.discardKept({ ...first, text: record })).toBe(true);
    window.dispatchEvent(new StorageEvent('storage', { key: first.key }));

    fail();
    await app.ready;
    expect(app._unrestoredOffers).toEqual([]);
    const again = late.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key: again.key }));

    expect(heading()).toBe(EARLIER);
    expect(heard().filter(call => call.message.startsWith(NOW))).toEqual([]);
  });

  test('a record kept before this start, discarded in another tab and kept there again while this start restores it, stays an earlier start’s when the restore fails, and nothing is told of it', async () => {
    const record = await recordWithBackground();
    const { app, store, heard, fail } = await startRestoring(record, { [keptKey(1, 'earlier')]: record });
    expect(heading()).toBe(EARLIER);
    const late = new StorageService();
    expect(late.loadAutoSaveText()).toBe(record);
    const otherTab = new StorageService();
    expect(otherTab.discardKept({ text: record, where: 'parked', key: keptKey(1, 'earlier') })).toBe(true);
    window.dispatchEvent(new StorageEvent('storage', { key: keptKey(1, 'earlier') }));
    expect(notice().hidden).toBe(true);
    const again = late.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key: again.key }));

    fail();
    await app.ready;

    expect(kept(store)).toEqual([record]);
    expect(heading()).toBe(EARLIER);
    expect(heard().filter(call => call.message.startsWith(NOW))).toEqual([]);
  });

  test('an unrelated record kept before this start does not make one another tab keeps during this start’s restore an earlier one: the restore’s failure is told once', async () => {
    const record = await recordWithBackground();
    const { app, store, heard, fail } = await startRestoring(record, { [keptKey(1, 'q')]: 'an earlier record' });
    const otherTab = new StorageService();
    const { key } = otherTab.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key }));

    fail();
    await app.ready;

    expect(app._unrestoredOffers.find(offer => offer.text === record)).toMatchObject({ where: 'parked', earlier: false });
    expect(heard().filter(call => call.message.startsWith(NOW))).toEqual([{ message: `${NOW} ${KEPT}`, priority: 'assertive' }]);
    expect(kept(store)).toHaveLength(2);
    expect(kept(store)).toEqual(expect.arrayContaining([record, 'an earlier record']));
  });

  test('another tab’s Discard of an unrelated record while this start restores leaves this start’s record to keep', async () => {
    const record = await recordWithBackground();
    const { app, store, fail } = await startRestoring(record);
    const otherTab = new StorageService();
    const unrelated = otherTab.keepUnrestored('an unrelated record');
    window.dispatchEvent(new StorageEvent('storage', { key: unrelated.key }));
    expect(otherTab.discardKept({ ...unrelated, text: 'an unrelated record' })).toBe(true);
    window.dispatchEvent(new StorageEvent('storage', { key: unrelated.key }));

    fail();
    await app.ready;

    expect(kept(store)).toEqual([record]);
    expect(app._unrestoredOffers.map(offer => offer.text)).toEqual([record]);
  });

  test('a store that cannot be searched is not taken for another tab’s Discard: a restore still in progress keeps its record where this tab can read it', async () => {
    const record = await recordWithBackground();
    const faults = { search: false, read: null };
    const store = useStorage({}, { searchFails: () => faults.search, readFails: [key => key === faults.read] });
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED, /Failed to search localStorage/, /Failed to load from localStorage/);
    const decoding = holdDecoding();
    const restoring = app.loadAutosave();
    await decoding.reached;
    const otherTab = new StorageService();
    const theirs = otherTab.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key: theirs.key }));
    faults.search = true;
    window.dispatchEvent(new StorageEvent('storage', { key: theirs.key }));
    faults.search = false;
    faults.read = theirs.key;

    decoding.fail();

    expect(await restoring).toBe(false);
    expect(app._unrestoredOffers.map(offer => offer.text)).toContain(record);
    expect(kept(store)).toEqual([record, record]);
  });

  test('a Discard in another tab that removes one copy and leaves another is not taken for the author’s choice: a restore still in progress keeps its record', async () => {
    const record = await recordWithBackground();
    const faults = { search: false, remove: null, read: null };
    const store = useStorage({}, { searchFails: () => faults.search, removalFails: [key => key === faults.remove], readFails: [key => key === faults.read] });
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED, /Failed to search localStorage/, /Failed to load from localStorage/, /Failed to remove from localStorage/);
    const decoding = holdDecoding();
    const restoring = app.loadAutosave();
    await decoding.reached;
    const otherTab = new StorageService();
    const first = otherTab.keepUnrestored(record);
    faults.search = true;
    const second = otherTab.keepUnrestored(record);
    faults.search = false;
    window.dispatchEvent(new StorageEvent('storage', { key: second.key }));
    faults.remove = second.key;
    expect(otherTab.discardKept({ ...first, text: record })).toBe(false);
    expect(store.has(first.key)).toBe(false);
    expect(store.get(second.key)).toBe(record);
    window.dispatchEvent(new StorageEvent('storage', { key: first.key }));
    faults.read = second.key;

    decoding.fail();

    expect(await restoring).toBe(false);
    expect(app._unrestoredOffers.map(offer => offer.text)).toContain(record);
    expect(kept(store)).toEqual([record, record]);
  });

  test('a record kept again after the author discarded it is offered again, and kept from autosave', async () => {
    const { app, store } = await bootRecording({ [keptKey(1, 'old')]: 'the same text' });
    discard();
    const otherTab = new StorageService();
    const again = otherTab.keepUnrestored('the same text');
    window.dispatchEvent(new StorageEvent('storage', { key: again.key }));

    expect(app._unrestoredOffers.map(offer => offer.text)).toEqual(['the same text']);
    editAndSave(app);
    expect(kept(store)).toEqual(['the same text']);
  });

  test('a record held where every tab knows, which a copy could not replace, is announced as the notice has it: new work is not saved', async () => {
    allowConsole(WRITE_FAILED, /Failed to remove from localStorage/);
    const faults = { copies: true };
    const { app, store } = await bootRecording({}, { quotaFor: [key => isKept(key) && faults.copies] });
    const record = 'the same text';
    store.set(AUTOSAVE, record);
    expect(new StorageService().keepUnrestored(record)).toEqual({ where: 'held', durable: true });
    // Room for a copy now, but neither the recovery copy nor its mark can go.
    faults.copies = false;
    localStorage.removeItem.mockImplementation((key) => {
      if (key === AUTOSAVE || key === HELD_MARK) throw new DOMException('blocked', 'SecurityError');
      store.delete(key);
    });
    const heard = listen(app);

    keepUnrestoredAutosave(app, record);

    expect(status()).toBe(HELD);
    expect(heard()).toEqual([{ message: `${NOW} ${HELD}`, priority: 'assertive' }]);
    expect(app.storageService.saveAutoSave({ name: 'new work' })).toBe(false);
    localStorage.removeItem.mockImplementation(key => store.delete(key));
    discard();
    app.storageService.flushAutoSave();
    expect(app.storageService.saveAutoSave({ name: 'new work' })).toBe(true);
  });

  test.each([
    ['two copies of one record', { [keptKey(1, 'a')]: 'a record', [keptKey(2, 'b')]: 'a record' }, 'the session that couldn’t be restored was discarded', "The session that couldn't be restored will be discarded too."],
    ['two records, one of them in two copies', { [keptKey(1, 'a')]: 'a record', [keptKey(2, 'b')]: 'a record', [keptKey(3, 'c')]: 'another record' }, 'the 2 sessions that couldn’t be restored were discarded', "The 2 sessions that couldn't be restored will be discarded too."],
  ])('Clear All over %s says it discarded as many as its dialog said it would', async (_, entries, done, asked) => {
    const { app, store } = await bootRecording(entries);
    const heard = listen(app);

    document.getElementById('clear-btn').click();
    expect(clearNote().textContent).toBe(asked);
    document.getElementById('clear-confirm').click();

    expect(kept(store)).toEqual([]);
    expect(heard()).toContainEqual({ message: `Project cleared, and ${done.replace(/’/g, "'")}`, priority: 'polite' });
    editAndSave(app);
    expect(store.has(AUTOSAVE)).toBe(true);
  });

  test('Clear All over a record held where every tab knows and also kept under a key of its own says it discarded one', async () => {
    allowConsole(WRITE_FAILED, /Failed to remove from localStorage/);
    const faults = { copies: true };
    const { app, store } = await bootRecording({}, { quotaFor: [key => isKept(key) && faults.copies] });
    const record = 'the same text';
    store.set(AUTOSAVE, record);
    expect(new StorageService().keepUnrestored(record)).toEqual({ where: 'held', durable: true });
    faults.copies = false;
    localStorage.removeItem.mockImplementation((key) => {
      if (key === AUTOSAVE || key === HELD_MARK) throw new DOMException('blocked', 'SecurityError');
      store.delete(key);
    });
    keepUnrestoredAutosave(app, record);
    expect(kept(store)).toEqual([record]);
    localStorage.removeItem.mockImplementation(key => store.delete(key));
    const heard = listen(app);

    document.getElementById('clear-btn').click();
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");
    document.getElementById('clear-confirm').click();

    expect(kept(store)).toEqual([]);
    expect(heard()).toContainEqual({ message: "Project cleared, and the session that couldn't be restored was discarded", priority: 'polite' });
  });

  // Codex’s round-9 cases: provenance through a fault
  test.each(['read', 'search'])('a record kept before this start stays an earlier start’s when a %s fault hides its copy as this start’s restore fails, and nothing is told', async (kind) => {
    allowConsole(/Failed to load from localStorage|Failed to search localStorage/);
    const record = await recordWithBackground();
    const oldKey = keptKey(1, 'earlier');
    const faults = { active: false };
    const { app, store, heard, fail } = await startRestoring(record, { [oldKey]: record }, {
      readFails: [key => faults.active && kind === 'read' && key === oldKey],
      searchFails: () => faults.active && kind === 'search',
    });
    expect(heading()).toBe(EARLIER);
    faults.active = true;
    fail();
    await app.ready;

    // The keep could not find the copy, so made another: kept, not lost
    expect(kept(store)).toEqual([record, record]);
    expect(heading()).toBe(EARLIER);
    expect(heard().filter(call => call.message.startsWith(NOW))).toEqual([]);
    faults.active = false;
    refresh();
    expect(heading()).toBe(EARLIER);
    editAndSave(app);
    expect(kept(store)).toEqual([record, record]);
    document.getElementById('clear-btn').click();
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");
    document.getElementById('clear-cancel').click();
  });

  test('a record kept again after a Discard, its key known but unreadable as this start’s restore fails, is this start’s, and told as the notice has it', async () => {
    allowConsole(/Failed to load from localStorage|Failed to search localStorage/);
    const record = await recordWithBackground();
    const faults = { denied: false };
    const { app, store, heard, fail } = await startRestoring(record, {}, {
      searchFails: () => faults.denied, readFails: [key => faults.denied && isKept(key)],
    });
    const late = new StorageService();
    expect(late.loadAutoSaveText()).toBe(record);
    const other = new StorageService();
    const first = other.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key: first.key }));
    expect(other.discardKept({ ...first, text: record })).toBe(true);
    window.dispatchEvent(new StorageEvent('storage', { key: first.key }));
    const again = late.keepUnrestored(record);
    window.dispatchEvent(new StorageEvent('storage', { key: again.key }));
    faults.denied = true;
    fail();
    await app.ready;

    expect(kept(store)).toEqual([record]);
    expect(app._unrestoredOffers).toEqual([{ text: record, where: 'cached', key: again.key, earlier: false }]);
    expect(heading()).toBe(NOW);
    expect(heard().filter(call => call.message.startsWith(NOW))).toEqual([{ message: `${NOW} ${CACHED}`, priority: 'assertive' }]);
  });

});

describe('a store that cannot be searched, or read, and the records this tab knows (DEF-28)', () => {
  const denied = /Failed to load from localStorage|Failed to search localStorage/;

  test('a record this start keeps where the store cannot be searched is offered, as this start’s and kept, and downloads; the announcement says what the notice says', async () => {
    allowConsole(LOAD_REFUSED, denied);
    const record = await refusedRecord();
    const { store, announced } = await bootRecording({ [AUTOSAVE]: record }, { searchFails: () => true });

    expect(kept(store)).toEqual([record]);
    expect(notice().hidden).toBe(false);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(KEPT);
    expect(announced).toContainEqual({ message: `${NOW} ${KEPT}`, priority: 'assertive' });
    const [blob] = download();
    expect(await blob.text()).toBe(record);
  });

  test('a record this start kept stays on offer, and downloads, while the store can be neither searched nor read; Discard then says it could not; and once the store can be read it is offered as kept', async () => {
    allowConsole(LOAD_REFUSED, denied);
    const faults = { denied: false };
    const record = await refusedRecord();
    const { app, store } = await bootRecording({ [AUTOSAVE]: record }, { readFails: [() => faults.denied], searchFails: () => faults.denied });
    expect(status()).toBe(KEPT);

    faults.denied = true;
    refresh();

    expect(notice().hidden).toBe(false);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(CACHED);
    const [blob] = download();
    expect(await blob.text()).toBe(record);
    const heard = listen(app);
    discard();
    expect(heard()).toContainEqual(COULD_NOT);
    expect(status()).toBe(CACHED);
    expect(kept(store)).toEqual([record]);

    faults.denied = false;
    refresh();
    expect(status()).toBe(KEPT);
    const [again] = download();
    expect(await again.text()).toBe(record);
    expect(app.storageService.saveAutoSave({ name: 'once the store can be read' })).toBe(true);
  });

  test('a record kept by an earlier start stays on offer, and downloads, while the store can be neither searched nor read', async () => {
    allowConsole(denied);
    const faults = { denied: false };
    await bootRecording({ [keptKey(1, 'q')]: 'an earlier record' }, { readFails: [() => faults.denied], searchFails: () => faults.denied });

    faults.denied = true;
    refresh();

    expect(heading()).toBe(EARLIER);
    expect(status()).toBe(CACHED);
    const [blob] = download();
    expect(await blob.text()).toBe('an earlier record');
  });

  test('a record kept by an earlier start stays on offer, as kept, when its key can no longer be read here', async () => {
    allowConsole(denied);
    const faults = { read: null };
    await bootRecording({ [keptKey(1, 'q')]: 'an earlier record' }, { readFails: [key => key === faults.read] });

    faults.read = keptKey(1, 'q');
    refresh();

    expect(heading()).toBe(EARLIER);
    expect(status()).toBe(KEPT);
    const [blob] = download();
    expect(await blob.text()).toBe('an earlier record');
  });

  test('a record kept by an earlier start, offered while the store could not be searched, stays on offer as kept once it can, though its key can no longer be read', async () => {
    allowConsole(denied);
    const faults = { search: false, read: null };
    await bootRecording({ [keptKey(1, 'q')]: 'an earlier record' }, { searchFails: () => faults.search, readFails: [key => key === faults.read] });
    faults.search = true;
    refresh();
    expect(status()).toBe(KEPT);

    faults.search = false;
    faults.read = keptKey(1, 'q');
    refresh();

    expect(heading()).toBe(EARLIER);
    expect(status()).toBe(KEPT);
    const [blob] = download();
    expect(await blob.text()).toBe('an earlier record');
  });

  test('where the store cannot be searched, a record whose key is read empty is not offered', async () => {
    allowConsole(denied);
    const faults = { search: false };
    const { store } = await bootRecording({ [keptKey(1, 'q')]: 'an earlier record' }, { searchFails: () => faults.search });
    expect(notice().hidden).toBe(false);

    faults.search = true;
    // Another tab's Discard, which this tab cannot see by a search.
    store.delete(keptKey(1, 'q'));
    refresh();

    expect(notice().hidden).toBe(true);
  });

  test('Discard of a record offered from this tab’s copy says it could not, while its key still cannot be read, though the store can be searched again', async () => {
    allowConsole(LOAD_REFUSED, denied, /Failed to remove from localStorage/);
    const faults = { search: false, read: null };
    const record = await refusedRecord();
    const { app, store } = await bootRecording({ [AUTOSAVE]: record }, { readFails: [key => key === faults.read], searchFails: () => faults.search });
    const [key] = [...store.keys()].filter(isKept);
    faults.search = true;
    faults.read = key;
    refresh();
    expect(status()).toBe(CACHED);
    // The store can be searched again before the notice next reads it.
    faults.search = false;
    const heard = listen(app);

    discard();

    expect(heard()).toContainEqual(COULD_NOT);
    expect(store.get(key)).toBe(record);
    expect(app._unrestoredOffers.map(offer => offer.text)).toEqual([record]);
  });

  test('a record the author discards here is not offered again from this tab’s copy when the store then cannot be read', async () => {
    allowConsole(LOAD_REFUSED, denied);
    const faults = { denied: false };
    const record = await refusedRecord();
    const { app, store } = await bootRecording({ [AUTOSAVE]: record }, { readFails: [() => faults.denied], searchFails: () => faults.denied });
    // The store stops being readable the moment the Discard has done its work.
    const discardKept = app.storageService.discardKept.bind(app.storageService);
    vi.spyOn(app.storageService, 'discardKept').mockImplementation((offer) => {
      const done = discardKept(offer);
      faults.denied = true;
      return done;
    });

    discard();

    expect(kept(store)).toEqual([]);
    expect(notice().hidden).toBe(true);
    refresh();
    expect(notice().hidden).toBe(true);
  });

  test('a record discarded in another tab, as this tab saw, is not offered from this tab’s copy when the store then cannot be read', async () => {
    allowConsole(LOAD_REFUSED, denied);
    const faults = { denied: false };
    const record = await refusedRecord();
    const { store } = await bootRecording({ [AUTOSAVE]: record }, { readFails: [() => faults.denied], searchFails: () => faults.denied });
    const [key] = [...store.keys()].filter(isKept);
    expect(new StorageService().discardKept({ text: record, where: 'parked', key })).toBe(true);
    window.dispatchEvent(new StorageEvent('storage', { key }));
    expect(notice().hidden).toBe(true);

    faults.denied = true;
    refresh();

    expect(notice().hidden).toBe(true);
  });

  test('where the store cannot be searched, a record read under one of the keys this tab knows it by is offered as kept, though another of them cannot be read', async () => {
    allowConsole(denied);
    const faults = { search: false, read: null };
    await bootRecording({ [keptKey(1, 'a')]: 'a record', [keptKey(2, 'b')]: 'a record' }, {
      searchFails: () => faults.search, readFails: [key => key === faults.read],
    });

    faults.search = true;
    faults.read = keptKey(2, 'b');
    refresh();

    expect(status()).toBe(KEPT);
  });

  test('a record another tab discards the moment this start has kept it is neither told nor offered', async () => {
    allowConsole(LOAD_REFUSED);
    const record = await refusedRecord();
    const keep = StorageService.prototype.keepUnrestored;
    vi.spyOn(StorageService.prototype, 'keepUnrestored').mockImplementation(function keptThenDiscarded(text) {
      const kept = keep.call(this, text);
      // The author's Discard in another tab, before this tab reads the store again.
      if (kept.key) localStorage.removeItem(kept.key);
      return kept;
    });

    const { app, store, announced } = await bootRecording({ [AUTOSAVE]: record });

    expect(kept(store)).toEqual([]);
    expect(app._unrestoredOffers).toEqual([]);
    expect(announced.filter(call => call.message.includes("couldn't be restored"))).toEqual([]);
  });

  test('after Clear All, no record is offered from this tab’s copy when the store then cannot be read', async () => {
    allowConsole(LOAD_REFUSED, denied, /Failed to remove from localStorage|Failed to save to localStorage/);
    const faults = { denied: false };
    const record = await refusedRecord();
    const { app, store } = await bootRecording({ [keptKey(1, 'q')]: 'an earlier record', [AUTOSAVE]: record }, {
      readFails: [() => faults.denied], searchFails: () => faults.denied,
    });
    expect(app._unrestoredOffers).toHaveLength(2);
    // The store stops being readable the moment Clear All has discarded them.
    const discardAllKept = app.storageService.discardAllKept.bind(app.storageService);
    vi.spyOn(app.storageService, 'discardAllKept').mockImplementation(() => {
      const done = discardAllKept();
      faults.denied = true;
      return done;
    });

    document.getElementById('clear-btn').click();
    document.getElementById('clear-confirm').click();

    expect(kept(store)).toEqual([]);
    expect(app._unrestoredOffers).toEqual([]);
    expect(notice().hidden).toBe(true);
  });
});

describe('the notice, as the markup and styles declare it (DEF-28)', () => {
  const tokensCss = readFileSync(resolve(process.cwd(), 'styles/tokens.css'), 'utf8');
  const mainCss = readFileSync(resolve(process.cwd(), 'styles/main.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  /** A declared value, following `var()` references through the tokens. */
  function resolveValue(value) {
    const reference = value.trim().match(/^var\((--[\w-]+)\)$/);
    if (!reference) return value.trim();
    const definition = tokensCss.match(new RegExp(`${reference[1]}\\s*:\\s*([^;]+);`));
    expect(definition, `${reference[1]} is defined`).not.toBeNull();
    return resolveValue(definition[1].replace(/\/\*.*?\*\//g, ''));
  }

  function luminance(hex) {
    const channels = hex.replace('#', '').match(/../g).map(pair => parseInt(pair, 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  test('is a region named by its visible sentence, and described by its status', async () => {
    allowConsole(LOAD_REFUSED);
    await bootRecording({ [AUTOSAVE]: await refusedRecord() });

    expect(notice().getAttribute('role')).toBe('region');
    expect(document.getElementById(notice().getAttribute('aria-labelledby')).textContent).toBe(NOW);
    expect(document.getElementById(notice().getAttribute('aria-describedby')).textContent).toBe(KEPT);
  });

  test('its text meets AAA contrast on its background', () => {
    const rule = mainCss.match(/^\.unrestored-notice\{[^}]*\}/m)[0];
    const text = resolveValue(rule.match(/[\s{;]color:([^;]+);/)[1]);
    const background = resolveValue(rule.match(/[\s{;]background:([^;]+);/)[1]);
    const [lighter, darker] = [luminance(text), luminance(background)].sort((a, b) => b - a);

    expect((lighter + 0.05) / (darker + 0.05)).toBeGreaterThanOrEqual(7);
  });

  test('its buttons keep the 44px target every button has', () => {
    const shell = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    for (const id of ['unrestored-download', 'unrestored-discard']) {
      expect(shell).toMatch(new RegExp(`<button id="${id}" class="btn[ "]`));
    }
    expect(mainCss.match(/^\.btn\{[^}]*\}/m)[0]).toContain('min-height:var(--control-min-h)');
    expect(resolveValue('var(--control-min-h)')).toBe('2.75rem');
    // Nothing in the notice sizes them otherwise.
    const noticeRules = [...mainCss.matchAll(/([^{}]*unrestored[^{}]*)\{([^}]*)\}/g)];
    expect(noticeRules.length).toBeGreaterThan(0);
    for (const [, selector, body] of noticeRules) {
      expect(selector).not.toMatch(/\.btn|button|unrestored-download|unrestored-discard/);
      expect(body).not.toMatch(/(?:^|[\s;])(?:min-|max-)?height\s*:/);
    }
  });
});

describe('two tabs keeping records at once (DEF-28)', () => {
  // Last in this file: each tab is a fresh copy of the storage module, as a
  // second tab's is, so each numbers its keys from the start.
  async function anotherTab() {
    vi.resetModules();
    const { StorageService: Service } = await import('../src/services/StorageService.js');
    return new Service();
  }

  test('a key another tab has taken is never written over, even one made in the same millisecond with the same chance', async () => {
    const store = useStorage();
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    vi.spyOn(Math, 'random').mockReturnValue(0.125);
    const [first, second] = [await anotherTab(), await anotherTab()];

    expect(first.keepUnrestored('from the first tab').where).toBe('parked');
    expect(second.keepUnrestored('from the second tab').where).toBe('parked');
    expect(kept(store).sort()).toEqual(['from the first tab', 'from the second tab']);
  });

  test('two tabs writing in the same millisecond keep both records, though each looked before the other wrote', async () => {
    const store = useStorage();
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.25).mockReturnValueOnce(0.75);
    const [here, there] = [await anotherTab(), await anotherTab()];
    // The other tab keeps its record between this tab's look at a key and
    // its write there, as tabs may: storage has no lock across them.
    const read = localStorage.getItem.getMockImplementation();
    let between = () => there.keepUnrestored('from the other tab');
    localStorage.getItem.mockImplementation((key) => {
      const value = read(key);
      if (isKept(key) && between) {
        const run = between;
        between = null;
        run();
      }
      return value;
    });

    expect(here.keepUnrestored('from this tab').where).toBe('parked');
    expect(between).toBe(null);
    expect(kept(store).sort()).toEqual(['from the other tab', 'from this tab']);
  });
});

describe('Codex’s round-9 cases: faults while records are known', () => {
  const denied = /Failed to load from localStorage|Failed to search localStorage/;


  test('a kept key read empty while the store cannot be searched is forgotten: a later fault reading it does not bring its record back', async () => {
    allowConsole(denied);
    const key = keptKey(1, 'q');
    const faults = { search: false, read: false };
    const { app, store } = await bootRecording({ [key]: 'earlier T' }, {
      searchFails: () => faults.search, readFails: [each => faults.read && each === key],
    });
    expect(new StorageService().discardKept({ text: 'earlier T', key })).toBe(true);
    faults.search = true;
    window.dispatchEvent(new StorageEvent('storage', { key }));
    expect(notice().hidden).toBe(true);
    expect(store.has(key)).toBe(false);

    faults.read = true;
    refresh();
    expect(notice().hidden).toBe(true);
    expect(app._unrestoredOffers).toEqual([]);
  });

  test('where the store cannot be searched, the records this tab knows are offered newest first, as a search lists them', async () => {
    allowConsole(/Failed to search localStorage/);
    const faults = { search: false };
    const { app } = await bootRecording({ [keptKey(1, 'q')]: 'older Q' }, { searchFails: () => faults.search });
    const newer = new StorageService().keepUnrestored('newer T');
    window.dispatchEvent(new StorageEvent('storage', { key: newer.key }));
    expect(app._unrestoredOffers.map(offer => offer.text)).toEqual(['newer T', 'older Q']);

    faults.search = true;
    refresh();
    expect(app._unrestoredOffers.map(offer => offer.text)).toEqual(['newer T', 'older Q']);
    faults.search = false;
    refresh();
    expect(app._unrestoredOffers.map(offer => offer.text)).toEqual(['newer T', 'older Q']);
  });

  test('where the store cannot be searched, a record this tab keeps is offered with those it knew', async () => {
    allowConsole(denied);
    const faults = { search: false };
    const { app, store } = await bootRecording({ [keptKey(1, 'old')]: 'earlier Q' }, { searchFails: () => faults.search });
    faults.search = true;
    keepUnrestoredAutosave(app, 'current T');

    expect(app._unrestoredOffers.map(offer => offer.text)).toEqual(['current T', 'earlier Q']);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(KEPT);
    expect(kept(store)).toEqual(expect.arrayContaining(['current T', 'earlier Q']));
    const [blob] = download();
    expect(await blob.text()).toBe('current T');
  });

  test('Discard forgets every copy it removed, so a read outage straight after offers none of them', async () => {
    allowConsole(denied);
    const faults = { denied: false };
    const { app, store } = await bootRecording({ [keptKey(1, 'a')]: 'T', [keptKey(2, 'b')]: 'T' }, {
      searchFails: () => faults.denied, readFails: [() => faults.denied],
    });
    const remove = app.storageService.discardKept.bind(app.storageService);
    vi.spyOn(app.storageService, 'discardKept').mockImplementation((offer) => {
      const result = remove(offer);
      // After the removal, before the notice is brought up to date
      faults.denied = true;
      return result;
    });

    discard();

    expect(kept(store)).toEqual([]);
    refresh();
    expect(app._unrestoredOffers).toEqual([]);
    expect(notice().hidden).toBe(true);
  });

  test('a copy of a record removed in another tab, while another copy stays, is not taken for a Discard, whatever can be read or searched meanwhile', async () => {
    allowConsole(denied);
    const keys = [keptKey(1, 'a'), keptKey(2, 'b')];
    const faults = { read: null, search: false };
    const { app, store } = await bootRecording({ [keys[0]]: 'T', [keys[1]]: 'T' }, {
      readFails: [key => key === faults.read], searchFails: () => faults.search,
    });
    faults.read = keys[1];
    refresh();
    store.delete(keys[0]);
    refresh();
    expect(app._unrestoredThisStart.discarded.has('T')).toBe(false);
    expect(app._unrestoredOffers.map(offer => offer.text)).toEqual(['T']);
    faults.search = true;
    refresh();
    expect(status()).toBe(CACHED);
    faults.search = false;
    refresh();
    expect(status()).toBe(KEPT);
    store.delete(keys[1]);
    refresh();
    expect(app._unrestoredThisStart.discarded.has('T')).toBe(true);
    expect(app._unrestoredOffers).toEqual([]);
  });


  test('a Clear All that removes some copies counts records, and completes once removal works again', async () => {
    allowConsole(/Failed to remove from localStorage/);
    const faults = { remove: true };
    const [a, b, q] = [keptKey(1, 'a'), keptKey(2, 'b'), keptKey(3, 'q')];
    const { app, store } = await bootRecording({ [a]: 'T', [b]: 'T', [q]: 'Q' }, { removalFails: [key => faults.remove && key === b] });
    const heard = listen(app);
    document.getElementById('clear-btn').click();
    expect(clearNote().textContent).toBe("The 2 sessions that couldn't be restored will be discarded too.");
    document.getElementById('clear-confirm').click();
    expect(kept(store)).toEqual(['T']);
    expect(heard().at(-1)).toEqual({ message: 'Browser recovery could not be cleared; reload may restore old work.', priority: 'assertive' });
    expect(app._unrestoredOffers.map(offer => offer.text)).toEqual(['T']);

    faults.remove = false;
    document.getElementById('clear-btn').click();
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");
    document.getElementById('clear-confirm').click();
    expect(kept(store)).toEqual([]);
    expect(heard().at(-1)).toEqual({ message: "Project cleared, and the session that couldn't be restored was discarded", priority: 'polite' });
    editAndSave(app);
    expect(store.has(AUTOSAVE)).toBe(true);
  });
});
