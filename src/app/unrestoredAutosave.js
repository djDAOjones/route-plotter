/**
 * A browser recovery record that could not be restored (DEF-28).
 *
 * A failed restore used to reach the console alone, and the next edit's
 * autosave overwrote the record, so the work in it was lost without the
 * author learning of it. Now the record moves to a key autosave never writes
 * (`StorageService.parkAutoSave`), the author is told, and a notice offers
 * Download it and Discard until they choose; a later start offers it again.
 * Only that Discard and Clear All remove it (Joe, decision log 2026-09-28,
 * "the big run").
 *
 * `app._unrestoredAutosave` holds the text on offer while there is one.
 */
import { downloadText } from './privacy.js';

const NOTICE = "Your previous session couldn't be restored.";

/**
 * Whether a record is on offer now.
 * @returns {boolean}
 */
export function hasUnrestoredOffer(app) {
  return typeof app._unrestoredAutosave === 'string';
}

/** Show or hide the notice, and the line in Clear All's dialog that goes with it. */
function showOffer(app, text) {
  app._unrestoredAutosave = text;
  const offered = text !== null;
  const notice = document.getElementById('unrestored-notice');
  if (notice) notice.hidden = !offered;
  const clearNote = document.getElementById('clear-unrestored-note');
  if (clearNote) clearNote.hidden = !offered;
}

/**
 * Keep a record that could not be restored, and tell the author.
 * @param {Object} app
 * @param {string} text - The record exactly as stored
 * @returns {false} Nothing was restored
 */
export function parkUnrestoredAutosave(app, text) {
  const parked = app.storageService.parkAutoSave(text);
  showOffer(app, text);
  app.announce(parked
    ? `${NOTICE} It is kept until you download or discard it.`
    : `${NOTICE} This browser could not keep it aside, so the next autosave will replace it: download it first if you want it.`,
  'assertive');
  return false;
}

/** At start-up, offer a record an earlier session could not restore. */
export function offerParkedAutosave(app) {
  if (hasUnrestoredOffer(app)) return;
  const text = app.storageService.loadParkedAutoSave();
  if (text === null) return;
  showOffer(app, text);
  app.announce(`${NOTICE} It is kept until you download or discard it.`, 'assertive');
}

/**
 * Clear All's part: discard the record on offer, if any.
 * @returns {{ offered: boolean, discarded: boolean }}
 */
export function discardForClearAll(app) {
  if (!hasUnrestoredOffer(app)) return { offered: false, discarded: true };
  const discarded = app.storageService.discardParkedAutoSave();
  if (discarded) showOffer(app, null);
  return { offered: true, discarded };
}

/** Wire the notice's two choices. */
export function setupUnrestoredNotice(app) {
  app._unrestoredAutosave = null;
  document.getElementById('unrestored-download')?.addEventListener('click', () => {
    if (!hasUnrestoredOffer(app)) return;
    downloadText(app._unrestoredAutosave, 'application/json', 'route-plotter-unrestored-session.json');
  });
  document.getElementById('unrestored-discard')?.addEventListener('click', () => {
    if (!app.storageService.discardParkedAutoSave()) {
      app.announce("The session that couldn't be restored could not be discarded.", 'assertive');
      return;
    }
    showOffer(app, null);
    app.announce("The session that couldn't be restored was discarded.");
  });
}
