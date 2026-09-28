/**
 * Browser recovery records that could not be restored (DEF-28).
 *
 * A failed restore used to reach the console alone, and the next edit's
 * autosave overwrote the record, so the work in it was lost without the
 * author learning of it. Now the record is kept (`StorageService.keepUnrestored`):
 * under a key autosave never writes, or, where it cannot move there, held in
 * the recovery key, which autosave then leaves alone. The author is told, and
 * a notice offers Download it and Discard until they choose; a later start
 * offers it again. Only that Discard and Clear All remove one (Joe, decision
 * log 2026-09-28, "the big run").
 *
 * Two can wait at once: one an earlier start kept, and one this start could
 * not restore, held because the first has its key. The notice offers one at
 * a time, this start's first.
 *
 * `app._unrestoredOffers` lists them, as `{ text, where, earlier }`: the
 * record exactly as read, where `keepUnrestored` placed it, and whether an
 * earlier start kept it.
 */
import { downloadText } from './privacy.js';

const HEADING = {
  now: "Your previous session couldn't be restored.",
  earlier: "An earlier session couldn't be restored.",
};

const STATUS = {
  parked: 'Kept until you discard it. You can download a copy.',
  held: "Kept until you discard it, and new work isn't saved in this browser until then. You can download a copy.",
  unkept: "This browser couldn't keep it, so download it now to keep a copy.",
};

const DISCARDED = "The session that couldn't be restored was discarded.";

function offersOf(app) {
  return app._unrestoredOffers ?? [];
}

/** What the notice, and an announcement, say of one offer. */
function messageFor(offer) {
  return `${offer.earlier ? HEADING.earlier : HEADING.now} ${STATUS[offer.where]}`;
}

/**
 * Set what is on offer, and show the first: the notice, and the line in
 * Clear All's dialog that goes with it.
 */
function showOffers(app, offers) {
  app._unrestoredOffers = offers;
  const [first] = offers;
  const notice = document.getElementById('unrestored-notice');
  if (notice) notice.hidden = !first;
  if (first) {
    const heading = document.getElementById('unrestored-notice-text');
    if (heading) heading.textContent = first.earlier ? HEADING.earlier : HEADING.now;
    const status = document.getElementById('unrestored-notice-status');
    if (status) status.textContent = STATUS[first.where];
  }
  const clearNote = document.getElementById('clear-unrestored-note');
  if (clearNote) {
    clearNote.hidden = !first;
    clearNote.textContent = offers.length > 1
      ? `The ${offers.length} sessions that couldn't be restored will be discarded too.`
      : "The session that couldn't be restored will be discarded too.";
  }
}

/**
 * Keep a record this start could not restore, and tell the author.
 * @param {Object} app
 * @param {string} text - The record exactly as read
 * @returns {false} Nothing was restored
 */
export function keepUnrestoredAutosave(app, text) {
  const offers = offersOf(app);
  const where = app.storageService.keepUnrestored(text);
  // A record kept earlier and read again now is on offer already.
  if (offers.some(offer => offer.text === text)) return false;
  const offer = { text, where, earlier: false };
  showOffers(app, [offer, ...offers]);
  app.announce(messageFor(offer), 'assertive');
  return false;
}

/**
 * At start-up, before this start's restore, offer a record an earlier start
 * kept, so what the restore reports can point to it.
 */
export function offerKeptAutosave(app) {
  const text = app.storageService.loadParkedAutoSave();
  if (text === null || offersOf(app).some(offer => offer.text === text)) return;
  const offer = { text, where: 'parked', earlier: true };
  showOffers(app, [...offersOf(app), offer]);
  app.announce(messageFor(offer), 'assertive');
}

/**
 * What a restore's report adds while a record kept earlier is on offer: that
 * report is announced over the offer's own.
 * @returns {string} A sentence to append, or ''
 */
export function keptEarlierNote(app) {
  return offersOf(app).some(offer => offer.earlier)
    ? " An earlier session couldn't be restored, and is kept until you discard it."
    : '';
}

/**
 * What a report that browser recovery could not be written adds while a
 * record is kept, since keeping it may be what stopped the write.
 * @returns {string} A sentence to append, or ''
 */
export function recoveryFailureGuidance(app) {
  const offers = offersOf(app);
  if (offers.some(offer => offer.where === 'held')) {
    return " Auto-save resumes once you discard the session that couldn't be restored; download it first to keep a copy.";
  }
  return offers.some(offer => offer.where === 'parked')
    ? " To free space, download the session that couldn't be restored, then discard it."
    : '';
}

/**
 * Clear All's part: discard every record kept, on offer or not.
 * @returns {{ discarded: number, failed: boolean }} How many went, and
 *   whether any could not be removed
 */
export function discardForClearAll(app) {
  const kept = [...offersOf(app)];
  const parked = app.storageService.loadParkedAutoSave();
  if (parked !== null && !kept.some(offer => offer.where === 'parked' && offer.text === parked)) {
    kept.push({ text: parked, where: 'parked', earlier: true });
  }
  const remaining = kept.filter(offer => !app.storageService.discardKept(offer));
  showOffers(app, remaining);
  return { discarded: kept.length - remaining.length, failed: remaining.length > 0 };
}

/**
 * Where focus goes when the notice closes under it: the next control a
 * keyboard reaches, as if the notice had not been there.
 */
function focusPastNotice(notice) {
  const controls = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]');
  for (const control of controls) {
    if (notice.contains(control)) continue;
    if (!(notice.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    if (control.disabled || control.tabIndex < 0 || control.closest('[hidden], [inert]')) continue;
    if (control.checkVisibility && !control.checkVisibility()) continue;
    control.focus();
    return;
  }
}

/** Wire the notice's two choices. */
export function setupUnrestoredNotice(app) {
  app._unrestoredOffers = [];
  document.getElementById('unrestored-download')?.addEventListener('click', () => {
    const [offer] = offersOf(app);
    if (!offer) return;
    downloadText(offer.text, 'application/json', 'route-plotter-unrestored-session.json');
  });
  document.getElementById('unrestored-discard')?.addEventListener('click', () => {
    const [offer, ...rest] = offersOf(app);
    if (!offer) return;
    if (!app.storageService.discardKept(offer)) {
      app.announce("The session that couldn't be restored could not be discarded.", 'assertive');
      return;
    }
    const notice = document.getElementById('unrestored-notice');
    const focusInNotice = Boolean(notice?.contains(document.activeElement));
    showOffers(app, rest);
    if (focusInNotice && rest.length === 0) focusPastNotice(notice);
    // Autosave failed while the record was held; unsaved work goes to
    // browser recovery now rather than at the next change.
    if (offer.where === 'held' && app._isDirty) app.saveRecovery?.();
    app.announce(rest.length ? `${DISCARDED} ${messageFor(rest[0])}` : DISCARDED);
  });
}
