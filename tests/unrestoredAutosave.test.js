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
 * a second record that fails, not a move that fails for want of room (the
 * record is then held where it was, and autosave fails until the author
 * chooses), not a commit that rolls back.
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

const AUTOSAVE = STORAGE.AUTOSAVE_KEY;
const PARKED = STORAGE.PARKED_AUTOSAVE_KEY;
const NOW = "Your previous session couldn't be restored.";
const EARLIER = "An earlier session couldn't be restored.";
const KEPT = 'Kept until you discard it. You can download a copy.';
const HELD = "Kept until you discard it, and new work isn't saved in this browser until then. You can download a copy.";
const UNKEPT = "This browser couldn't keep it, so download it now to keep a copy.";
const DISCARDED = "The session that couldn't be restored was discarded.";
const FREE_SPACE = " To free space, download the session that couldn't be restored, then discard it.";
const RESUMES = " Auto-save resumes once you discard the session that couldn't be restored; download it first to keep a copy.";
const WRITE_FAILED = /Failed to save to localStorage/;
/**
 * A store full to its last character also refuses the preview tip's
 * one-time flag, which is written unguarded from a timer; seen already, the
 * tip is not shown, and the flag is not written.
 */
const TIP_SEEN = { routePlotter_previewTipDismissed: 'true' };
const TIP_SIZE = Object.entries(TIP_SEEN).reduce((total, [key, value]) => total + key.length + value.length, 0);

/**
 * A browser's storage, in memory. A write to a key in `quotaFor`, or one that
 * would take the store past `capacity` characters (keys and values both, as
 * browsers count them), fails as a full store does; a removal from a key in
 * `removalFails`, or a read of one in `readFails`, throws.
 */
function useStorage(entries = {}, { quotaFor = [], capacity = Infinity, removalFails = [], readFails = [] } = {}) {
  const store = new Map(Object.entries(entries));
  const size = () => [...store].reduce((total, [key, value]) => total + key.length + value.length, 0);
  localStorage.getItem.mockImplementation((key) => {
    if (readFails.includes(key)) throw new DOMException('The operation is insecure.', 'SecurityError');
    return store.has(key) ? store.get(key) : null;
  });
  localStorage.setItem.mockImplementation((key, value) => {
    const text = String(value);
    const replaced = store.has(key) ? key.length + store.get(key).length : 0;
    if (quotaFor.includes(key) || size() - replaced + key.length + text.length > capacity) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    store.set(key, text);
  });
  localStorage.removeItem.mockImplementation((key) => {
    if (removalFails.includes(key)) throw new DOMException('The operation is insecure.', 'SecurityError');
    store.delete(key);
  });
  return store;
}

afterEach(() => {
  vi.restoreAllMocks();
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
const discard = () => document.getElementById('unrestored-discard').click();

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

describe('a record that cannot be restored (DEF-28)', () => {
  test('is set aside as it was stored, announced, and offered', async () => {
    allowConsole(LOAD_REFUSED);
    const record = await refusedRecord();
    const { store, app, announced } = await bootRecording({ [AUTOSAVE]: record });

    expect(app.waypoints).toHaveLength(0);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(store.get(PARKED)).toBe(record);
    expect(notice().hidden).toBe(false);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(KEPT);
    expect(announced).toContainEqual({ message: `${NOW} ${KEPT}`, priority: 'assertive' });
  });

  test('is set aside when it is not even JSON', async () => {
    allowConsole(LOAD_REFUSED);
    const { store } = await bootRecording({ [AUTOSAVE]: '{"coordVersion": 9, "waypoints": [' });

    expect(store.has(AUTOSAVE)).toBe(false);
    expect(store.get(PARKED)).toBe('{"coordVersion": 9, "waypoints": [');
    expect(notice().hidden).toBe(false);
  });

  test('is set aside, not cleared, when its format is older than the app reads', async () => {
    // Joe, 2026-09-28: a refused autosave gets this notice, never a silent clear.
    const record = await olderRecord('older');
    const { store } = await bootRecording({ [AUTOSAVE]: record });

    expect(store.has(AUTOSAVE)).toBe(false);
    expect(store.get(PARKED)).toBe(record);
    expect(notice().hidden).toBe(false);
  });

  test('leaves new work to autosave, and autosave leaves it alone', async () => {
    allowConsole(LOAD_REFUSED);
    const record = await refusedRecord();
    const { store, app } = await bootRecording({ [AUTOSAVE]: record });

    editAndSave(app);

    expect(JSON.parse(store.get(AUTOSAVE)).waypoints).toHaveLength(1);
    expect(store.get(PARKED)).toBe(record);
    expect(localStorage.setItem.mock.calls.filter(([key]) => key === PARKED)).toHaveLength(1);
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
    expect(store.get(PARKED)).toBe(record);
    expect(notice().hidden).toBe(false);
    await restart(prototype);
    expect(notice().hidden).toBe(false);
    expect(store.get(PARKED)).toBe(record);
  });

  test('goes when the author discards it', async () => {
    allowConsole(LOAD_REFUSED);
    const { store, app } = await bootRecording({ [AUTOSAVE]: await refusedRecord() });
    const announced = listen(app);

    discard();

    expect(store.has(PARKED)).toBe(false);
    expect(notice().hidden).toBe(true);
    expect(announced()).toEqual([{ message: DISCARDED, priority: 'polite' }]);
  });

  test('is offered again by the next start, as one kept earlier, until the author chooses', async () => {
    const { store, announced } = await bootRecording({ [PARKED]: 'kept from an earlier session' });

    expect(store.get(PARKED)).toBe('kept from an earlier session');
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
    expect(store.get(PARKED)).toBe(record);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(notice().hidden).toBe(false);
    editAndSave(app);
    expect(store.get(PARKED)).toBe(record);
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
    expect(store.has(PARKED)).toBe(false);
    expect(notice().hidden).toBe(true);
  });

  test('is the record that was read, even if another tab writes the key while it restores', async () => {
    const record = JSON.stringify({ ...(await savedProject()), backgroundImage: 'data:image/png;base64,iVBORw0KGgo=' });
    const store = useStorage();
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED);
    let failDecode;
    const decoding = new Promise((reached) => {
      vi.spyOn(ImageAsset, 'decodeDataURL').mockImplementation(() => new Promise((_, reject) => {
        failDecode = reject;
        reached();
      }));
    });

    const restoring = app.loadAutosave();
    await decoding;
    store.set(AUTOSAVE, 'a newer record, written by another tab');
    failDecode(new Error('the background could not be decoded'));

    expect(await restoring).toBe(false);
    expect(store.get(PARKED)).toBe(record);
    expect(store.get(AUTOSAVE)).toBe('a newer record, written by another tab');
  });

  test('is offered, and not called kept, when another tab writes the key and a record kept earlier fills its own', async () => {
    // Nowhere is left to keep it: its own key is taken, and the recovery key
    // now holds the other tab's record, which is not this one to hold.
    const record = JSON.stringify({ ...(await savedProject()), backgroundImage: 'data:image/png;base64,iVBORw0KGgo=' });
    const store = useStorage({ [PARKED]: 'kept from an earlier session' });
    const app = await bootApp();
    await app.ready;
    store.set(AUTOSAVE, record);
    allowConsole(LOAD_REFUSED);
    let failDecode;
    const decoding = new Promise((reached) => {
      vi.spyOn(ImageAsset, 'decodeDataURL').mockImplementation(() => new Promise((_, reject) => {
        failDecode = reject;
        reached();
      }));
    });

    const restoring = app.loadAutosave();
    await decoding;
    store.set(AUTOSAVE, 'a newer record, written by another tab');
    failDecode(new Error('the background could not be decoded'));

    expect(await restoring).toBe(false);
    expect(store.get(PARKED)).toBe('kept from an earlier session');
    expect(heading()).toBe(NOW);
    expect(status()).toBe(UNKEPT);
    const [blob] = download();
    expect(await blob.text()).toBe(record);
    // Nothing is held, so this tab's autosave writes as it always has.
    editAndSave(app);
    expect(JSON.parse(store.get(AUTOSAVE)).waypoints).toHaveLength(1);
  });
});

describe('a record that cannot move to its own key (DEF-28)', () => {
  test('moves when the store has room for only one copy, by freeing the recovery key first', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED, /Failed to save section states/);
    const record = await refusedRecord();
    const { store } = await bootRecording(
      { [AUTOSAVE]: record, ...TIP_SEEN },
      { capacity: TIP_SIZE + PARKED.length + record.length + 10 }
    );

    expect(store.get(PARKED)).toBe(record);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(status()).toBe(KEPT);
  });

  test('is held where it was when the store cannot take it, and autosave leaves it until the author discards it', async () => {
    allowConsole(LOAD_REFUSED, /Failed to save to localStorage \(routePlotter_parkedAutosave\)/);
    const record = await refusedRecord();
    const { store, app, announced } = await bootRecording({ [AUTOSAVE]: record }, { quotaFor: [PARKED] });

    expect(store.get(AUTOSAVE)).toBe(record);
    expect(store.has(PARKED)).toBe(false);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(HELD);
    expect(announced).toContainEqual({ message: `${NOW} ${HELD}`, priority: 'assertive' });

    const later = listen(app);
    editAndSave(app);
    expect(store.get(AUTOSAVE)).toBe(record);
    expect(later()).toContainEqual({ message: `Auto-save failed. Save a project file to keep your work.${RESUMES}`, priority: 'polite' });

    discard();
    expect(notice().hidden).toBe(true);
    // The work autosave could not write meanwhile is written now.
    app.storageService.flushAutoSave();
    expect(JSON.parse(store.get(AUTOSAVE)).waypoints).toHaveLength(1);
  });

  test('is held when the store fits it exactly: the move would need six more characters', async () => {
    // A full store, counted as browsers count it: the parked key is longer
    // than the recovery key, so the record fits only where it already is.
    allowConsole(LOAD_REFUSED, WRITE_FAILED, /Failed to save section states/);
    const record = await refusedRecord();
    const { store, app } = await bootRecording(
      { [AUTOSAVE]: record, ...TIP_SEEN },
      { capacity: TIP_SIZE + AUTOSAVE.length + record.length }
    );

    expect(store.get(AUTOSAVE)).toBe(record);
    expect(store.has(PARKED)).toBe(false);
    expect(status()).toBe(HELD);
    editAndSave(app);
    expect(store.get(AUTOSAVE)).toBe(record);
  });

  test('is held, not written over what may be there, when its own key cannot be read', async () => {
    allowConsole(LOAD_REFUSED, /Failed to load from localStorage \(routePlotter_parkedAutosave\)/);
    const record = await refusedRecord();
    const { store } = await bootRecording(
      { [AUTOSAVE]: record, [PARKED]: 'kept from an earlier session' },
      { readFails: [PARKED] }
    );

    expect(store.get(AUTOSAVE)).toBe(record);
    expect(store.get(PARKED)).toBe('kept from an earlier session');
    expect(localStorage.setItem.mock.calls.filter(([key]) => key === PARKED)).toHaveLength(0);
    expect(status()).toBe(HELD);
  });

  test('is offered for download, and not called kept, when the store takes it nowhere', async () => {
    allowConsole(LOAD_REFUSED, WRITE_FAILED);
    const record = await refusedRecord();
    const { store, announced } = await bootRecording({ [AUTOSAVE]: record }, { quotaFor: [PARKED, AUTOSAVE] });

    expect(store.has(PARKED)).toBe(false);
    expect(status()).toBe(UNKEPT);
    expect(announced).toContainEqual({ message: `${NOW} ${UNKEPT}`, priority: 'assertive' });
    const [blob] = download();
    expect(await blob.text()).toBe(record);
    discard();
    expect(notice().hidden).toBe(true);
  });
});

describe('two records that could not be restored (DEF-28)', () => {
  test('are both kept, across starts, and offered one at a time, this start’s first', async () => {
    const second = await olderRecord('second');
    const { store, announced, prototype } = await bootRecording({
      [PARKED]: 'first record',
      [AUTOSAVE]: second,
    });

    // The first keeps its key; the second is held where it was.
    expect(store.get(PARKED)).toBe('first record');
    expect(store.get(AUTOSAVE)).toBe(second);
    expect(heading()).toBe(NOW);
    expect(status()).toBe(HELD);
    expect(announced).toContainEqual({ message: `${NOW} ${HELD}`, priority: 'assertive' });
    expect(clearNote().textContent).toBe("The 2 sessions that couldn't be restored will be discarded too.");
    const [blob] = download();
    expect(await blob.text()).toBe(second);

    const again = await restart(prototype);
    expect(store.get(PARKED)).toBe('first record');
    expect(store.get(AUTOSAVE)).toBe(second);
    expect(heading()).toBe(NOW);

    const later = listen(again.app);
    discard();
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(store.get(PARKED)).toBe('first record');
    expect(heading()).toBe(EARLIER);
    expect(status()).toBe(KEPT);
    expect(later()).toEqual([{ message: `${DISCARDED} ${EARLIER} ${KEPT}`, priority: 'polite' }]);
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");

    editAndSave(again.app);
    expect(JSON.parse(store.get(AUTOSAVE)).waypoints).toHaveLength(1);
    expect(store.get(PARKED)).toBe('first record');

    discard();
    expect(store.has(PARKED)).toBe(false);
    expect(notice().hidden).toBe(true);
  });

  test('are one record when an earlier start kept it but could not clear the recovery key', async () => {
    allowConsole(LOAD_REFUSED);
    const { store } = await bootRecording({ [PARKED]: 'the same record', [AUTOSAVE]: 'the same record' });

    expect(store.get(PARKED)).toBe('the same record');
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(heading()).toBe(EARLIER);
    expect(clearNote().textContent).toBe("The session that couldn't be restored will be discarded too.");
  });
});

describe('Discard and a record that could not be restored (DEF-28)', () => {
  test('removes only the record it offered, where it was kept', async () => {
    const { store } = await bootRecording({ [PARKED]: 'kept from an earlier session' });
    store.set(PARKED, 'another record, parked by another tab');

    discard();

    expect(store.get(PARKED)).toBe('another record, parked by another tab');
    expect(notice().hidden).toBe(true);
  });

  test('says so, and keeps the offer, when the record cannot be removed', async () => {
    allowConsole(/Failed to remove from localStorage \(routePlotter_parkedAutosave\)/);
    const { store, app } = await bootRecording({ [PARKED]: 'kept' }, { removalFails: [PARKED] });
    const announced = listen(app);

    discard();

    expect(store.get(PARKED)).toBe('kept');
    expect(notice().hidden).toBe(false);
    expect(announced()).toEqual([
      { message: "The session that couldn't be restored could not be discarded.", priority: 'assertive' },
    ]);
  });

  test('moves focus on to the next control when the notice closes under it', async () => {
    // Seen before, so the splash does not open and hold focus itself.
    await bootRecording({ [PARKED]: 'kept', [STORAGE.SPLASH_SHOWN_KEY]: 'true' });
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
});

describe('Clear All and a record that could not be restored (DEF-28)', () => {
  test('says it will discard the record too, and does', async () => {
    allowConsole(LOAD_REFUSED);
    const { store, app } = await bootRecording({ [AUTOSAVE]: await refusedRecord() });
    const announced = listen(app);

    expect(clearNote().hidden).toBe(false);
    document.getElementById('clear-confirm').click();

    expect(store.has(PARKED)).toBe(false);
    expect(notice().hidden).toBe(true);
    expect(clearNote().hidden).toBe(true);
    expect(announced()).toContainEqual({
      message: "Project cleared, and the session that couldn't be restored was discarded",
      priority: 'polite',
    });
  });

  test('discards both records, the held one too, and autosave writes again', async () => {
    const second = await olderRecord('second');
    const { store, app } = await bootRecording({ [PARKED]: 'first record', [AUTOSAVE]: second });
    const announced = listen(app);

    document.getElementById('clear-confirm').click();

    expect(store.has(PARKED)).toBe(false);
    expect(store.has(AUTOSAVE)).toBe(false);
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
    store.set(PARKED, 'parked by another tab');
    const announced = listen(app);

    document.getElementById('clear-confirm').click();

    expect(store.has(PARKED)).toBe(false);
    expect(announced()).toContainEqual({
      message: "Project cleared, and the session that couldn't be restored was discarded",
      priority: 'polite',
    });
  });

  test('says so, and keeps the offer, when the record cannot be removed', async () => {
    allowConsole(/Failed to remove from localStorage \(routePlotter_parkedAutosave\)/);
    const { store, app } = await bootRecording({ [PARKED]: 'kept' }, { removalFails: [PARKED] });
    const announced = listen(app);

    document.getElementById('clear-confirm').click();

    expect(store.get(PARKED)).toBe('kept');
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
      { [AUTOSAVE]: valid, [PARKED]: 'kept from an earlier session' },
      { quotaFor: [AUTOSAVE] }
    );

    expect(app.waypoints).toHaveLength(2);
    expect(store.has(AUTOSAVE)).toBe(false);
    expect(store.get(PARKED)).toBe('kept from an earlier session');
    expect(announced.at(-1)).toEqual({
      message: `Previous session restored, but browser recovery is now unavailable. Save a project file to keep it safe.${FREE_SPACE}`,
      priority: 'polite',
    });
  });

  test('a restore that works says a record kept earlier is still waiting', async () => {
    const valid = JSON.stringify(await savedProject());
    const { store, announced } = await bootRecording({ [AUTOSAVE]: valid, [PARKED]: 'kept from an earlier session' });

    expect(store.get(PARKED)).toBe('kept from an earlier session');
    expect(announced.at(-1)).toEqual({
      message: "Previous session restored. An earlier session couldn't be restored, and is kept until you discard it.",
      priority: 'assertive',
    });
  });

  test('a full store keeps it, and the failure report says how to free space', async () => {
    allowConsole(/Failed to save to localStorage \(routePlotter_autosave\)/);
    const { store, app } = await bootRecording({ [PARKED]: 'kept from an earlier session' }, { quotaFor: [AUTOSAVE] });
    const announced = listen(app);

    editAndSave(app);

    expect(store.get(PARKED)).toBe('kept from an earlier session');
    expect(announced()).toContainEqual({
      message: `Auto-save failed. Save a project file to keep your work.${FREE_SPACE}`,
      priority: 'polite',
    });
  });

  test('clearing recovery, the storage service’s own clear, an edit and undo, and opening a project', async () => {
    const second = await olderRecord('second');
    const { store, app } = await bootRecording({ [PARKED]: 'first record', [AUTOSAVE]: second });

    expect(app.storageService.clearAutoSave()).toBe(false);
    expect(app.storageService.clearAll()).toBe(false);
    expect(store.get(PARKED)).toBe('first record');
    expect(store.get(AUTOSAVE)).toBe(second);

    app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.5, isMajor: true });
    app.eventBus.emit('history:undo');
    app.storageService.flushAutoSave();
    expect(store.get(PARKED)).toBe('first record');
    expect(store.get(AUTOSAVE)).toBe(second);

    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: app._buildProjectSnapshot(), imageAssets: [], backgroundBase64: null,
    });
    const announced = listen(app);
    expect(await app.loadProject(new File([''], 'project.zip'))).toBe(true);
    expect(store.get(PARKED)).toBe('first record');
    expect(store.get(AUTOSAVE)).toBe(second);
    expect(announced()).toContainEqual({
      message: `Project loaded, but browser recovery is unavailable. Save the project file to keep it safe.${RESUMES}`,
      priority: 'polite',
    });
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
