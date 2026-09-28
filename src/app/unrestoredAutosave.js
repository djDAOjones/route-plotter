/**
 * Browser recovery records that could not be restored (DEF-28).
 *
 * A failed restore used to reach the console alone, and the next edit's
 * autosave overwrote the record, so the work in it was lost without the
 * author learning of it. Now the record is kept (`StorageService.keepUnrestored`):
 * under a key of its own, which autosave never writes, or, where no copy can
 * be written, held in the recovery key, which no tab then writes. The author
 * is told, and a notice offers Download it and Discard until they choose; a
 * later start offers it again. Only that Discard and Clear All remove one
 * (Joe, decision log 2026-09-28, "the big run").
 *
 * The notice offers one record at a time: those this start could not
 * restore first, then those kept earlier, newest first. What is on offer is
 * read back from the store after every change, so it is always what the
 * store holds; `app._unrestoredOffers` lists it as `{ text, where, key?,
 * earlier }`.
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

/** What this start kept, so its records are offered first, under the row's own sentence. */
function thisStart(app) {
  app._unrestoredThisStart ??= { keys: new Set(), held: false, unkept: [] };
  return app._unrestoredThisStart;
}

/** What the notice, and an announcement, say of one offer. */
function messageFor(offer) {
  return `${offer.earlier ? HEADING.earlier : HEADING.now} ${STATUS[offer.where]}`;
}

/**
 * What is on offer now, read back from the store: the records this start
 * could keep only in memory, a held one, then those under keys of their own.
 * A record whose key cannot be read cannot be offered; Clear All still
 * removes it.
 */
function readOffers(app) {
  const started = thisStart(app);
  const offers = started.unkept.map(text => ({ text, where: 'unkept', earlier: false }));
  const held = app.storageService.adoptHeld();
  if (held !== null) offers.push({ text: held, where: 'held', earlier: !started.held });
  for (const { key, text } of app.storageService.listKept().records) {
    if (text !== null) offers.push({ text, where: 'parked', key, earlier: !started.keys.has(key) });
  }
  return [...offers.filter(offer => !offer.earlier), ...offers.filter(offer => offer.earlier)];
}

/**
 * Show what is on offer: the first record in the notice, and the line in
 * Clear All's dialog that goes with them.
 * @returns {Array<Object>} The offers, first shown first
 */
function showOffers(app) {
  const offers = readOffers(app);
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
  return offers;
}

/**
 * Keep a record this start could not restore, and tell the author.
 * @param {Object} app
 * @param {string} text - The record exactly as read
 * @returns {false} Nothing was restored
 */
export function keepUnrestoredAutosave(app, text) {
  const kept = app.storageService.keepUnrestored(text);
  const started = thisStart(app);
  // A record kept earlier and read again now is on offer already.
  if (kept.where === 'parked' && kept.existing) {
    showOffers(app);
    return false;
  }
  if (kept.where === 'parked') started.keys.add(kept.key);
  else if (kept.where === 'held') started.held = true;
  else started.unkept.unshift(text);
  showOffers(app);
  app.announce(messageFor({ where: kept.where, earlier: false }), 'assertive');
  return false;
}

/**
 * At start-up, before this start's restore, offer what earlier starts kept,
 * so what the restore reports can point to it. A record an earlier start
 * held is not restored again: it is on offer.
 */
export function offerKeptAutosave(app) {
  const [first] = showOffers(app);
  if (first) app.announce(messageFor(first), 'assertive');
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
    return " Auto-save is off until you discard the session that couldn't be restored; download it first to keep a copy.";
  }
  return offers.some(offer => offer.where === 'parked')
    ? " To free space, download the session that couldn't be restored, then discard it."
    : '';
}

/**
 * Clear All's part: discard every kept record, on offer or not, readable or
 * not, and any this start could keep only in memory.
 * @returns {{ discarded: number, failed: boolean }} How many went, and
 *   whether any could not be found or removed
 */
export function discardForClearAll(app) {
  const started = thisStart(app);
  const unkept = started.unkept.length;
  started.unkept = [];
  const { ok, removed } = app.storageService.discardAllKept();
  showOffers(app);
  return { discarded: removed + unkept, failed: !ok };
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
    const [offer] = offersOf(app);
    if (!offer) return;
    if (!app.storageService.discardKept(offer)) {
      showOffers(app);
      app.announce("The session that couldn't be restored could not be discarded.", 'assertive');
      return;
    }
    const started = thisStart(app);
    if (offer.where === 'unkept') started.unkept = started.unkept.filter(text => text !== offer.text);
    const notice = document.getElementById('unrestored-notice');
    const focusInNotice = Boolean(notice?.contains(document.activeElement));
    const [next] = showOffers(app);
    if (focusInNotice && !next) focusPastNotice(notice);
    // Autosave could not write while the record was held; the project goes
    // to browser recovery now, not at the next change.
    if (offer.where === 'held') app.saveRecovery?.();
    app.announce(next ? `${DISCARDED} ${messageFor(next)}` : DISCARDED);
  });
}
