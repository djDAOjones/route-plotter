/**
 * Browser recovery records that could not be restored (DEF-28).
 *
 * A failed restore used to reach the console alone, and the next edit's
 * autosave overwrote the record, so the work in it was lost without the
 * author learning of it. Now the record is kept (`StorageService.keepUnrestored`):
 * under a key of its own, which autosave never writes, or, where no copy can
 * be written, held in the recovery key under a mark every tab's writer
 * respects. The author is told, and a notice offers Download it and Discard
 * until they choose; a later start offers it again. Only that Discard and
 * Clear All remove one (Joe, decision log 2026-09-28, "the big run").
 *
 * The notice offers one record at a time: those this start could not
 * restore first, then those kept earlier, newest first. What is on offer is
 * read back from the store after every change, and when another tab changes
 * it, so it is what the store holds; `app._unrestoredOffers` lists it as
 * `{ text, where, durable?, key?, earlier }`.
 */
import { downloadText } from './privacy.js';
import { STORAGE } from '../config/constants.js';

const HEADING = {
  now: "Your previous session couldn't be restored.",
  earlier: "An earlier session couldn't be restored.",
};

const STATUS = {
  parked: 'Kept until you discard it. You can download a copy.',
  held: "Kept until you discard it, and new work isn't saved in this browser until then. You can download a copy.",
  // Held without its mark, or where the store cannot be read: this tab keeps
  // it from being written over, but another tab or the next start might not.
  heldHere: "Kept by this tab only, so download it now to keep a copy. New work isn't saved in this browser until you discard it.",
  unkept: "This browser couldn't keep it, so download it now to keep a copy.",
};

const DISCARDED = "The session that couldn't be restored was discarded.";

function offersOf(app) {
  return app._unrestoredOffers ?? [];
}

/**
 * What this start kept, so its records are offered first, under the row's
 * own sentence, and can be downloaded even if the store cannot read them back.
 */
function thisStart(app) {
  app._unrestoredThisStart ??= { keys: new Map(), heldText: null, heldDurable: false, unkept: [] };
  return app._unrestoredThisStart;
}

function statusFor(offer) {
  if (offer.where === 'held') return offer.durable ? STATUS.held : STATUS.heldHere;
  return STATUS[offer.where];
}

/** What the notice, and an announcement, say of one offer. */
function messageFor(offer) {
  return `${offer.earlier ? HEADING.earlier : HEADING.now} ${statusFor(offer)}`;
}

/**
 * What is on offer now, read back from the store: the records this start
 * could keep only in memory, a held one, then those under keys of their own;
 * and how many records Clear All would discard, readable or not.
 */
function readStore(app) {
  const started = thisStart(app);
  const offers = started.unkept.map(text => ({ text, where: 'unkept', earlier: false }));
  let discardable = started.unkept.length;
  const hold = app.storageService.holdState();
  if (hold.state !== 'none') discardable += 1;
  if (hold.text !== null && hold.text !== undefined) {
    offers.push({
      text: hold.text,
      where: 'held',
      durable: hold.state === 'held' && hold.durable,
      earlier: started.heldText !== hold.text,
    });
  }
  const kept = app.storageService.listKept();
  discardable += kept.records.length;
  for (const { key, text } of kept.records) {
    const known = text ?? started.keys.get(key) ?? null;
    if (known !== null) offers.push({ text: known, where: 'parked', key, earlier: !started.keys.has(key) });
  }
  // A record this start held without its mark, which the recovery key no
  // longer holds: another tab or build wrote there, not the author choosing,
  // so it is still this tab's to offer.
  const held = started.heldText;
  if (held !== null && !started.heldDurable && !offers.some(offer => offer.text === held)) {
    offers.push({ text: held, where: 'unkept', earlier: false });
    discardable += 1;
  }
  return {
    offers: [...offers.filter(offer => !offer.earlier), ...offers.filter(offer => offer.earlier)],
    discardable,
    searched: kept.ok,
  };
}

/**
 * Show what is on offer: the first record in the notice, and the line in
 * Clear All's dialog, which counts every record Clear All would discard.
 * @returns {Array<Object>} The offers, first shown first
 */
function showOffers(app) {
  const { offers, discardable, searched } = readStore(app);
  app._unrestoredOffers = offers;
  const [first] = offers;
  const notice = document.getElementById('unrestored-notice');
  if (notice) notice.hidden = !first;
  if (first) {
    const heading = document.getElementById('unrestored-notice-text');
    if (heading) heading.textContent = first.earlier ? HEADING.earlier : HEADING.now;
    const status = document.getElementById('unrestored-notice-status');
    if (status) status.textContent = statusFor(first);
  }
  const clearNote = document.getElementById('clear-unrestored-note');
  if (clearNote) {
    clearNote.hidden = discardable === 0 && searched;
    if (!searched) clearNote.textContent = "Any session that couldn't be restored will be discarded too.";
    else if (discardable > 1) clearNote.textContent = `The ${discardable} sessions that couldn't be restored will be discarded too.`;
    else clearNote.textContent = "The session that couldn't be restored will be discarded too.";
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
  if (kept.where === 'parked') started.keys.set(kept.key, text);
  else if (kept.where === 'held') {
    started.heldText = text;
    started.heldDurable = kept.durable;
  } else started.unkept.unshift(text);
  showOffers(app);
  app.announce(messageFor({ where: kept.where, durable: kept.durable, earlier: false }), 'assertive');
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
 * record is kept, since keeping it may be what stopped the write. It reads
 * the store first: another tab may have held a record since.
 * @returns {string} A sentence to append, or ''
 */
export function recoveryFailureGuidance(app) {
  const offers = showOffers(app);
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
  started.heldText = null;
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

/** Whether a change another tab made to storage may change what is on offer. */
function changesOffers(app, key) {
  if (key === null || key === STORAGE.HELD_AUTOSAVE_KEY || key.startsWith(STORAGE.KEPT_AUTOSAVE_PREFIX)) return true;
  // A held record written over by a build that knows no mark has gone.
  return key === STORAGE.AUTOSAVE_KEY && offersOf(app).some(offer => offer.where === 'held');
}

/** Wire the notice's two choices, and keep it true to the store. */
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
    started.unkept = started.unkept.filter(text => text !== offer.text);
    if (started.heldText === offer.text) started.heldText = null;
    const notice = document.getElementById('unrestored-notice');
    const focusInNotice = Boolean(notice?.contains(document.activeElement));
    const [next] = showOffers(app);
    if (focusInNotice && !next) focusPastNotice(notice);
    // Autosave could not write while the record was held; the project goes
    // to browser recovery now, not at the next change.
    if (offer.where === 'held') app.saveRecovery?.();
    app.announce(next ? `${DISCARDED} ${messageFor(next)}` : DISCARDED);
  });
  // Clear All's dialog says how many it would discard, as the store has it now.
  document.getElementById('clear-btn')?.addEventListener('click', () => showOffers(app));
  // Another tab of the app may keep, hold or discard a record meanwhile.
  window.addEventListener('storage', (event) => {
    if (changesOffers(app, event.key)) showOffers(app);
  });
}
