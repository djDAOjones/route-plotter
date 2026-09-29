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
 * it, so it is what the store holds, one offer to each record however many
 * copies of it there are; `app._unrestoredOffers` lists it as
 * `{ text, where, durable?, key?, earlier }`. Where the store cannot be
 * searched, the records this tab knows are looked for by their keys, and
 * one whose key cannot be read either is offered from this tab's copy of
 * its text, as one that may be kept still (`where: 'cached'`).
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
  // Known to this tab, where the store cannot be read to say it is kept still.
  cached: "This browser's storage can't be read at the moment, so download it now to keep a copy.",
};

const DISCARDED = "The session that couldn't be restored was discarded.";

function offersOf(app) {
  return app._unrestoredOffers ?? [];
}

/**
 * What this start kept, so its records are offered first, under the row's
 * own sentence, and can be downloaded even if the store cannot read them back:
 * `own`, the text of each record it could not restore, wherever it is kept
 * now; `keys`, the keys it kept them under itself; `unkept`, those it could
 * keep only in memory; `heldText`, one it held, and `heldDurable`, once that
 * is seen kept where every tab knows. And what it has seen of other tabs:
 * `seen`, each kept key it has read, with its text; `discarded`, each record
 * whose every kept copy it saw go, which only the author's Discard or Clear
 * All does, so a restore still in progress here keeps it no more; and
 * `keptAtStart`, the text of each record kept before this start's restore
 * began, which, read again by that restore, is an earlier start's. A kept
 * key's text never changes while the key is there, so what `keys` and
 * `seen` know of a key holds until a search shows the key gone, or the
 * author's Discard or Clear All here removes it.
 */
function thisStart(app) {
  app._unrestoredThisStart ??= {
    own: new Set(), keys: new Map(), heldText: null, heldDurable: false, unkept: [],
    seen: new Map(), discarded: new Set(), keptAtStart: null,
  };
  return app._unrestoredThisStart;
}

/**
 * Where a record is in more than one place (a copy another tab kept, a copy
 * a failed removal left), the notice says the place that matters most: a
 * hold every tab knows stops autosave; a key of its own keeps it; a hold this
 * tab alone knows, or memory, keep it least.
 */
const RANK = { unkept: 0, cached: 1, heldHere: 2, parked: 3, held: 4 };
const rankOf = offer => (offer.where === 'held' ? RANK[offer.durable ? 'held' : 'heldHere'] : RANK[offer.where]);

function statusFor(offer) {
  if (offer.where === 'held') return offer.durable ? STATUS.held : STATUS.heldHere;
  return STATUS[offer.where];
}

/** What the notice, and an announcement, say of one offer. */
function messageFor(offer) {
  return `${offer.earlier ? HEADING.earlier : HEADING.now} ${statusFor(offer)}`;
}

/** The text this tab knows a kept key by, or null. */
function knownText(started, key) {
  return started.keys.get(key) ?? started.seen.get(key) ?? null;
}

/**
 * What is on offer now, read back from the store, one offer to each record:
 * those this start could keep only in memory, then a held one, then those
 * under keys of their own; and how many records Clear All would discard,
 * each known record once and each it cannot read as one more. A record this
 * start kept only in memory, or held without its mark, that the store is now
 * seen to keep where every tab knows (another tab kept it) is offered where
 * it is kept, still as this start's; and the memory copy retires, so that a
 * later Discard, in any tab, is the author's choice and not a loss to make
 * good. A copy only this tab can vouch for (a hold whose mark cannot be
 * read) retires nothing. A kept key that cannot be read is offered by the
 * text this tab knows it by; where the store cannot be searched, each key
 * this tab knows is read on its own, and offered from this tab's copy when
 * it cannot be read, never when it is seen empty; a search that works again
 * forgets the keys it no longer lists.
 */
function readStore(app) {
  const started = thisStart(app);
  const stored = [];
  let unreadable = 0;
  const hold = app.storageService.holdState();
  if (hold.state !== 'none') {
    if (hold.text === null || hold.text === undefined) unreadable += 1;
    else stored.push({ text: hold.text, where: 'held', durable: hold.state === 'held' && hold.durable });
  }
  const kept = app.storageService.listKept();
  const parked = new Map();
  for (const { key, text } of kept.records) {
    const known = text ?? knownText(started, key);
    if (known === null) {
      unreadable += 1;
      continue;
    }
    parked.set(key, known);
    stored.push({ text: known, where: 'parked', key });
  }
  if (kept.ok) {
    const listed = new Set(kept.records.map(record => record.key));
    for (const key of started.keys.keys()) if (!listed.has(key)) started.keys.delete(key);
  } else {
    for (const key of new Set([...started.seen.keys(), ...started.keys.keys()])) {
      const read = app.storageService.readKept(key);
      if (!read.ok) stored.push({ text: knownText(started, key), where: 'cached', key });
      else if (read.text !== null) stored.push({ text: read.text, where: 'parked', key });
    }
  }
  const keptTexts = new Set(stored.filter(offer => offer.where === 'parked' || offer.durable).map(offer => offer.text));
  noteDiscards(started, kept, parked, keptTexts);
  started.unkept = started.unkept.filter(text => !keptTexts.has(text));
  if (started.heldText !== null && keptTexts.has(started.heldText)) started.heldDurable = true;

  const byText = new Map();
  const offer = (candidate) => {
    const current = byText.get(candidate.text);
    if (!current || rankOf(candidate) > rankOf(current)) byText.set(candidate.text, candidate);
  };
  for (const text of started.unkept) offer({ text, where: 'unkept' });
  // A record this start held without its mark, which the recovery key no
  // longer holds and the store was never seen to keep: another tab or build
  // wrote there, not the author choosing, so it is still this tab's to offer.
  if (started.heldText !== null && !started.heldDurable) offer({ text: started.heldText, where: 'unkept' });
  for (const each of stored) offer(each);
  const offers = [...byText.values()].map(each => ({ ...each, earlier: !started.own.has(each.text) }));
  return {
    offers: [...offers.filter(each => !each.earlier), ...offers.filter(each => each.earlier)],
    discardable: byText.size + unreadable,
    unreadable,
    searched: kept.ok,
  };
}

/**
 * Note the records the author has discarded in another tab: a kept key this
 * tab read goes only by Discard or Clear All, so once one has gone and its
 * record is kept nowhere else, a restore of it still in progress here keeps
 * it no more. A hold that ends is not taken for one: a build that knows no
 * mark may have written over it. Nor is a key this tab never read (it may
 * have come and gone between two reads): that choice this tab cannot see.
 */
function noteDiscards(started, kept, parked, keptTexts) {
  if (!kept.ok) return;
  const present = new Set(kept.records.map(record => record.key));
  for (const [key, text] of started.seen) {
    if (present.has(key)) continue;
    started.seen.delete(key);
    if (!keptTexts.has(text)) started.discarded.add(text);
  }
  for (const [key, text] of parked) started.seen.set(key, text);
}

/**
 * Show what is on offer: the first record in the notice, and the line in
 * Clear All's dialog, which counts every record Clear All would discard.
 * @returns {Array<Object>} The offers, first shown first
 */
function showOffers(app, read = readStore(app)) {
  const { offers, discardable, searched } = read;
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
  const started = thisStart(app);
  // The author discarded it in another tab while this restore ran, so it is
  // not kept again. But a restore in another tab that had not seen that
  // choice may have kept it since: that copy is on offer, and, unless it was
  // kept before this start began, is this start's, and its failure is told.
  if (started.discarded.has(text)) {
    const again = readStore(app).offers.some(each => each.text === text);
    if (!again || started.keptAtStart?.has(text)) {
      showOffers(app);
      return false;
    }
    started.own.add(text);
    return tell(app, text);
  }
  const kept = app.storageService.keepUnrestored(text);
  // A record kept before this restore began, read again now, is an earlier
  // start's, and on offer already. One another tab kept while this restore
  // ran is this start's, and its failure is told.
  if (kept.where === 'parked' && kept.existing && started.keptAtStart?.has(text)) {
    showOffers(app);
    return false;
  }
  started.own.add(text);
  if (kept.where === 'parked') started.keys.set(kept.key, text);
  else if (kept.where === 'held') {
    started.heldText = text;
    started.heldDurable = kept.durable;
  } else started.unkept.unshift(text);
  return tell(app, text);
}

/**
 * Tell the author of this start's record as the notice now offers it: where
 * it is kept may matter more than where this keep put it (still held, say,
 * where a copy could not replace the hold). One no longer on offer went by
 * the author's Discard in another tab meanwhile, and nothing is told of it.
 * @returns {false} Nothing was restored
 */
function tell(app, text) {
  const offer = showOffers(app).find(each => each.text === text);
  if (offer) app.announce(messageFor(offer), 'assertive');
  return false;
}

/**
 * At start-up, before this start's restore, offer what earlier starts kept,
 * so what the restore reports can point to it. A record an earlier start
 * held is not restored again: it is on offer.
 */
export function offerKeptAutosave(app) {
  const offers = showOffers(app);
  thisStart(app).keptAtStart = new Set(offers.map(offer => offer.text));
  const [first] = offers;
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
 * @returns {{ discarded: number, failed: boolean }} How many records went,
 *   counted as its dialog counts them (a record once, however many copies of
 *   it there were, and gone only when none is left), and whether any could
 *   not be found or removed
 */
export function discardForClearAll(app) {
  const started = thisStart(app);
  // Every record on offer, those kept only in memory among them.
  const before = readStore(app);
  for (const offer of before.offers) started.discarded.add(offer.text);
  started.unkept = [];
  started.heldText = null;
  const { ok } = app.storageService.discardAllKept();
  // Every kept record went: no key this tab knew is to be looked for again.
  if (ok) {
    started.keys.clear();
    started.seen.clear();
  }
  const after = readStore(app);
  showOffers(app, after);
  const left = new Set(after.offers.map(offer => offer.text));
  const gone = before.offers.filter(offer => !left.has(offer.text)).length;
  return { discarded: gone + Math.max(0, before.unreadable - after.unreadable), failed: !ok };
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
    started.discarded.add(offer.text);
    started.unkept = started.unkept.filter(text => text !== offer.text);
    if (started.heldText === offer.text) started.heldText = null;
    // Nor is it looked for again by a key this tab knew it under.
    for (const known of [started.keys, started.seen]) {
      for (const [key, text] of known) if (text === offer.text) known.delete(key);
    }
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
