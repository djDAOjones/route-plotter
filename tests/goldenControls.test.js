/**
 * TST-04 — what every control does (control → bus).
 *
 * Nothing pinned the sidebar's wiring. Its handlers are spread over
 * UIController, the app's DOM wiring and the crowd, network and privacy
 * mixins; some write the model themselves; and nothing read the readouts
 * they update (the pilot's finding, plan §14.5). W4 deletes dead code around
 * them, and CON-01, CON-02 and SPL-07 later move them, so each needs a record
 * that proves a move changed nothing.
 *
 * Each row operates one control as a user would, in a context where it is
 * shown and its card is open: a range is pressed a third of the way along its
 * track, a select is pressed and chooses each of its other options, a number,
 * text or colour field is pressed and given its new value, which is
 * committed, a file input is given a file, a radio already chosen is chosen
 * from another of its group as well, a control that renames on a double click
 * is double-clicked, and renamed (typed into where the app put the selection)
 * and clicked away from, a waypoint row is Shift-, Cmd- and Ctrl-clicked too,
 * a list row is dragged (onto either half of the next major's row, onto the
 * minor's, and let go outside the list), the busyness graph is dragged by a
 * handle (inside it, out of it, and cancelled; its middle handle along and
 * past each neighbour), and anything else is clicked.
 *
 * A press goes as Chromium sends a mouse's (`press`, checked against Chromium
 * 152): `pointerdown`; `mousedown`, unless the page cancelled that; focus
 * moved to the nearest element a click can focus, from the one pressed up, or
 * taken from whatever had it when there is none, unless either was cancelled;
 * `pointerup` and `mouseup` to what is under the pointer then; and `click` to
 * the element holding both, if the one pressed is still on the page. A
 * double-click's second press counts 2, and its `dblclick` follows its
 * `click` if what that clicked is still there. A range takes its value as the
 * button goes down (`input`, before focus moves) and commits it (`change`) as
 * it comes up. The pointer's arrival over a control (hover) is not sent: were
 * an app listener for it wired on a control, no row would run it, and the
 * inventory would fail. A select's popup, a colour picker and typing are not
 * modelled either: once the press has focused the field, its value is set and
 * committed (`input`, `change`), as Enter commits it. Ctrl-click is the one
 * Windows and Linux send: on a Mac, Chromium takes it for the context menu
 * (`contextmenu`, no `click`). Chromium blurs a focused element as it takes it
 * off the page, and so does the harness, where jsdom would move focus
 * silently; one hidden while focused keeps jsdom's focus, which the state
 * records as the body, where Chromium's next frame puts it, but the blur
 * Chromium sends then is not sent. jsdom's `:focus-visible`, which decides
 * whether a field's focus shows its hint, matches Chromium's for a pressed
 * number field, range, checkbox or button, but not for a pressed select, which
 * Chromium 152 counts as visible: the hint a select's focus would show, and
 * the press's own click then hides, is not shown. Drags and pointer drags go
 * as Chromium sends them: a drop only where the page accepted the drag, and a
 * pointer's events to whatever holds its capture. A context is reached, and a
 * row's starting point put back, by the app's own calls and programmatic
 * clicks: that is setup, not a row. A disabled or read-only control is
 * listed, not operated. The row records:
 *
 * - `emit`: each event the handling emitted outside a listener, with its
 *   payload. What the app's listeners emit in turn is the event transcript's
 *   business (TST-05), not the control's.
 * - `file dialog`, `download`, `clipboard`, `alert`, `pointer capture`: what
 *   it asked of the browser — a file picker, a file to save (its name, type,
 *   size and a checksum of its bytes), text to copy, a dialog, a pointer held.
 * - `model`, `app`, `storage`, `ui`: how the saved project, the app's own
 *   flags (among them the focused control and the text it has selected),
 *   what it keeps in the browser's storage and the shell changed once every
 *   promise it started had settled.
 * - after `settled:`, what the timers it left then did, each event once, and
 *   anything still pending when the frame budget ran out.
 *
 * A row that records entries for undo has them undone, and what the app's
 * history holds (`_getUndoableState`: the project, the selection and the
 * scene) must be as it held it before the row; then redone, and both that and
 * the saved project must be what the row made them. The one exception is a
 * waypoint's `modified` stamp, which every waypoint made from a history entry
 * gets afresh and nothing reads back.
 *
 * Every row starts from its context's baseline. A row is undone by reloading
 * the fixture through the real recovery path, entering the context again and
 * putting back every field's text selection; the result must equal the
 * baseline and be at rest, or a fresh app is booted instead (the app does not
 * re-sync every control on load, DEF-20). Equality of what is captured does
 * not prove that nothing else carried over, so `CONTROL_GOLDENS_ISOLATED=1`
 * boots a fresh app for every row, and must reproduce the goldens byte for
 * byte. All timers are fake, the clock is fixed and randomness is seeded, so
 * the rows are deterministic; frames come when the fake clock lets them, so
 * transport rows show the harness's schedule, not a browser's frame timings.
 *
 * `every wired control has a row` fails when an app listener for a user
 * gesture, on an element and in its phase, was never run by a row and no
 * stated reason excuses it. A control is noted with its listeners whenever it
 * stands on the page: as a listener is added to it there, as soon as the page
 * is idle after it was put there, right after each row's gesture, and after
 * the row's history is undone and redone. So a control a row creates is
 * noted, and so is one its history replay then replaces, its role read while
 * it stood; one put up and taken down again within one run of the harness's
 * timers, with no idle moment between, is not. Each such listener is wrapped
 * as it is added, so a row is credited with the listeners its gesture ran,
 * not with where its events went (an event stopped on the way, or one that
 * does not bubble, reaches no listener past that point); and every event type
 * the app listens for on a control is either a gesture or says what it is
 * instead. A waypoint row is a major's, a minor's or the add row, and a layer
 * row the route's or a crowd's: each is its own control, whatever its
 * position. Keyboard gestures belong to the key table (TST-13), and are
 * excused by gesture, not by a click row.
 *
 * Regenerate deliberately: `UPDATE_CONTROL_GOLDENS=1 npx vitest run
 * tests/goldenControls.test.js`, read the diff, then run it once more with
 * `CONTROL_GOLDENS_ISOLATED=1`.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { bootApp, retireApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { FIXED_NOW, loadSnapshot } from './helpers/projectSnapshot.js';
import {
  applyMapPalette, appState, changedLines, keyFor, modelChanges, modelState, quote, recordEmits,
  uiChanges, uiState, watchUi,
} from './helpers/controlState.js';
import { authoredExtrasProject, PIXEL_DATA_URL } from './fixtures/authoredExtras.js';
import { contextFor } from './setup.js';
import { VideoExporter } from '../src/services/VideoExporter.js';
import { getGraphDepartureShares } from '../src/utils/graphRouting.js';

const goldenDir = join(dirname(fileURLToPath(import.meta.url)), 'goldens');
const UPDATING = process.env.UPDATE_CONTROL_GOLDENS === '1';
const ISOLATED = process.env.CONTROL_GOLDENS_ISOLATED === '1';

/** Rows run a minute after the fixture loads, so an edit's `modified` stamp shows. */
const ROW_NOW = FIXED_NOW + 60_000;

/**
 * Every clock a row could race is fake: `setImmediate` too, because jsdom's
 * FileReader steps through it, so an image read lands where the row lets it
 * rather than wherever the real event loop happens to be.
 */
const FAKE_TIMERS = {
  toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date'],
  now: FIXED_NOW,
};

/** Taken before any timer is faked: one real turn of the event loop. */
const realSetImmediate = globalThis.setImmediate;

const project = authoredExtrasProject();

/** The semantic outline has its own suites; here it is one line (sceneOutline*.test.js). */
const OUTLINE = '#scene-outline';

/**
 * The fixture's waypoint 3 is a major with a timed pause, waypoint 2 a major
 * without one, and waypoint 1 its only minor.
 */
const MAJOR = 3;
const OTHER_MAJOR = 2;
const MINOR = 1;

// ---------------------------------------------------------------------------
// Time. Nothing a row starts may run unless the row lets it.
// ---------------------------------------------------------------------------

/**
 * Let every promise chain run as far as it can without a timer: a real turn
 * of the event loop begins only once no microtask is left. Timers, jsdom's
 * FileReader steps included, are fake and wait for `settle`.
 */
function flush() {
  return new Promise(resolve => realSetImmediate(resolve));
}

/**
 * Run the timers pending now, then those they leave, until none are left or
 * the frame budget runs out: playback asks for a frame every frame, so it
 * never stops on its own.
 */
async function settle(passes = 12) {
  for (let pass = 0; pass < passes; pass += 1) {
    await flush();
    if (vi.getTimerCount() === 0) return;
    vi.runOnlyPendingTimers();
  }
  await flush();
}

/** Await a promise that waits on fake timers, running them until it settles. */
async function drive(promise) {
  let outcome = null;
  promise.then(value => { outcome = { value }; }, error => { outcome = { error }; });
  for (let step = 0; step < 200 && !outcome; step += 1) {
    await flush();
    if (!outcome) vi.advanceTimersByTime(1);
  }
  if (!outcome) throw new Error('A setup step never settled');
  if (outcome.error) throw outcome.error;
  return outcome.value;
}

/**
 * Web Crypto hashes on another thread and answers in real time, which no fake
 * clock reaches. Image assets are named by a SHA-256 digest, so the digest is
 * computed here with the same algorithm, and answers at once.
 */
function answerDigestsAtOnce() {
  return vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(async (algorithm, data) => {
    const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
    const bytes = createHash(name.replace('-', '').toLowerCase()).update(new Uint8Array(data.buffer ?? data)).digest();
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  });
}

/**
 * New crowds, emitters and rerolls draw on `Math.random`. Each row gets the
 * same sequence however many rows ran before it (mulberry32, seeded by the
 * row's name).
 */
function seededRandom(seedText) {
  let seed = 0;
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 0x9e3779b1) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// What the app wires, and what each app registers on the document and window.
// ---------------------------------------------------------------------------

/**
 * What a user's input can deliver to a control. The app's listeners for any
 * other type are not gestures, and each such type says what it is in
 * `NOT_GESTURES`, so a listener of a new kind cannot go unnoticed.
 */
const GESTURE_TYPES = new Set([
  'click', 'dblclick', 'auxclick', 'contextmenu',
  'input', 'beforeinput', 'change', 'submit', 'reset', 'toggle', 'select',
  'keydown', 'keyup', 'keypress',
  'focus', 'blur', 'focusin', 'focusout',
  'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerover', 'pointerout',
  'pointerenter', 'pointerleave', 'gotpointercapture', 'lostpointercapture',
  'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave',
  'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel', 'scroll',
  'dragstart', 'drag', 'dragend', 'dragenter', 'dragover', 'dragleave', 'drop',
  'copy', 'cut', 'paste',
]);

/** Types the app listens for on its controls that no user's input delivers. */
const NOT_GESTURES = new Map([
  ['transitionend', "a toast's own fade ending"],
  ['focustrap:escape', 'the focus trap telling its dialog that Escape closed it: a key press (TST-13)'],
]);

/**
 * Each element's listeners, as registrations: the event type, and
 * `(capture)` for one that listens on the way down. A listener on the way
 * down runs for any event bound for something inside; one on the way up only
 * for an event that bubbles, or is sent to the element itself.
 */
const wiredEvents = new WeakMap();
const originalAddEventListener = EventTarget.prototype.addEventListener;
const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

const captureOf = options => (typeof options === 'boolean' ? options : Boolean(options?.capture));
const registrationOf = (type, capture) => (capture ? `${type} (capture)` : type);
const typeOf = registration => registration.split(' ', 1)[0];

/**
 * Where a listener was added: the file, line and column of the code that
 * added it, read from the stack. Two listeners for one gesture on one
 * element, added by different code, are two registrations, each to be run
 * by some row; the same code adding a listener to each rebuilt row is one.
 */
function registrationSite() {
  const caller = new Error().stack.split('\n')[3] ?? '';
  const place = caller.match(/((?:src|tests)\/[^\s():]+:\d+:\d+)/);
  return place ? place[1] : 'an unknown place';
}
const identityOf = (registration, site, slot = 1) => `${registration} at ${site}${slot > 1 ? ` (listener ${slot})` : ''}`;

/** Each element's registrations, by where each was added (`registrationSite`). */
const wiredSites = new WeakMap();

/**
 * Each of an element's listeners, by registration, with the registration it
 * is credited to: where it was added and, where the same line of code has
 * added another listener for the gesture to the same element that is still
 * there (a loop adding two, the first of which can stop the second), which of
 * them it is. A listener added again is still one; one removed, run `once` or
 * aborted leaves its place to the next that line adds, so the same code
 * adding a listener to each rebuilt row, or again once the last is gone, is
 * one registration.
 */
const listenerIdentities = new WeakMap();
const identityFor = (element, registration, listener) => listenerIdentities.get(element)?.get(registration)?.get(listener)?.identity
  ?? identityOf(registration, 'an unknown place');

/** Note a listener added to an element at `site`; returns its registration's identity. */
function addIdentity(element, registration, listener, site, options) {
  if (!listenerIdentities.has(element)) listenerIdentities.set(element, new Map());
  const listeners = listenerIdentities.get(element);
  if (!listeners.has(registration)) listeners.set(registration, new Map());
  const byListener = listeners.get(registration);
  const known = byListener.get(listener);
  if (known?.live) return known.identity;
  const taken = new Set([...byListener.values()].filter(each => each.live && each.site === site).map(each => each.slot));
  let slot = 1;
  while (taken.has(slot)) slot += 1;
  const entry = { site, slot, identity: identityOf(registration, site, slot), live: true, once: Boolean(options?.once) };
  byListener.set(listener, entry);
  // The signal may be the environment's own, not the page's: its own method
  options?.signal?.addEventListener('abort', () => { entry.live = false; }, { once: true });
  return entry.identity;
}

/** Note a listener gone from an element: removed, run `once`, or aborted. */
function dropIdentity(element, registration, listener) {
  const entry = listenerIdentities.get(element)?.get(registration)?.get(listener);
  if (entry) entry.live = false;
}

/**
 * The session whose app is booting or running. Its listeners on the document,
 * the window and the body, which outlast it, and on its canvases are its own,
 * and go when it is retired; the parameter hints bind theirs once per
 * document, for every app after, so they are left alone.
 */
let owner = null;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
// Vitest's jsdom environment gives the global its own bound copy of the
// window's methods, which the prototype's replacement does not reach.
const originalWindowAddEventListener = window.addEventListener;

/**
 * What a row's gesture ran: each app listener for a gesture on an element,
 * with that element, the event's type and the listener's phase. A row is
 * credited with these alone, not with what its gesture was meant to send (a
 * click on a radio already chosen fires no `change`) nor with where its
 * events went.
 */
let invoked = null;

/**
 * Each element's key as it was when an event bound through it was sent, for
 * a listener that runs once a rebuild has taken it off the page (a drag ends
 * at the row it began from, which its drop replaced).
 */
let dispatchKeys = new WeakMap();

function noteDispatch(event) {
  if (!invoked) return;
  for (const node of event.composedPath()) {
    if (node instanceof Element) dispatchKeys.set(node, keyFor(node));
  }
}

function noteInvocation(element, event, capture, listener) {
  const registration = registrationOf(event.type, capture);
  const identity = identityFor(element, registration, listener);
  if (listenerIdentities.get(element)?.get(registration)?.get(listener)?.once) dropIdentity(element, registration, listener);
  if (!invoked) return;
  const key = dispatchKeys.get(element) ?? keyFor(element);
  invoked.push({ control: controlOf(element, key), registration: identity });
}

/**
 * An app listener for a gesture on an element runs inside a wrapper that
 * notes it ran. There is one wrapper per listener and phase, so adding the
 * same listener twice still adds it once, and removing it by the listener it
 * was added with removes it; `once` and an abort signal act on the wrapper as
 * they would on the listener. A listener object's `handleEvent` is called on
 * the object, as a browser calls it.
 */
const wrappers = new Map([[true, new WeakMap()], [false, new WeakMap()]]);

const wraps = (target, type, listener) => target instanceof Element && GESTURE_TYPES.has(type)
  && (typeof listener === 'function' || (typeof listener === 'object' && listener !== null));

function wrapperFor(listener, capture) {
  const byListener = wrappers.get(capture);
  let wrapper = byListener.get(listener);
  if (!wrapper) {
    wrapper = function ranByRow(event) {
      noteInvocation(this, event, capture, listener);
      return typeof listener === 'function' ? listener.call(this, event) : listener.handleEvent(event);
    };
    byListener.set(listener, wrapper);
  }
  return wrapper;
}

function recordWiring() {
  EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
    // A listener with an aborted signal is not added at all
    if (this instanceof Element && listener && !options?.signal?.aborted) {
      const registration = registrationOf(type, captureOf(options));
      const site = registrationSite();
      if (!wiredEvents.has(this)) wiredEvents.set(this, new Set());
      wiredEvents.get(this).add(registration);
      if (!wiredSites.has(this)) wiredSites.set(this, new Set());
      wiredSites.get(this).add(addIdentity(this, registration, listener, site, options));
      // A control wired where it stands is noted at once: the next thing to
      // happen to it may take it off the page.
      noteElementWiring(this);
    }
    const outlasting = this === document || this === window || this === document.body;
    if (owner && (this instanceof HTMLCanvasElement || (outlasting && !new Error().stack.includes('ParamTooltip.js')))) {
      owner.listeners.push({ target: this, type, listener, options });
    }
    const registered = wraps(this, type, listener) ? wrapperFor(listener, captureOf(options)) : listener;
    return originalAddEventListener.call(this, type, registered, options);
  };
  EventTarget.prototype.removeEventListener = function removeEventListener(type, listener, options) {
    if (this instanceof Element) dropIdentity(this, registrationOf(type, captureOf(options)), listener);
    const registered = wraps(this, type, listener)
      ? (wrappers.get(captureOf(options)).get(listener) ?? listener)
      : listener;
    return originalRemoveEventListener.call(this, type, registered, options);
  };
  HTMLCanvasElement.prototype.getContext = function getContext(...args) {
    owner?.canvases.add(this);
    return originalGetContext.apply(this, args);
  };
  window.addEventListener = function addWindowListener(type, listener, options) {
    if (owner && !new Error().stack.includes('ParamTooltip.js')) {
      owner.listeners.push({ target: window, type, listener, options });
    }
    return originalWindowAddEventListener.call(window, type, listener, options);
  };
}

function watchDispatch() {
  for (const type of GESTURE_TYPES) originalWindowAddEventListener.call(window, type, noteDispatch, true);
}

function unwatchDispatch() {
  for (const type of GESTURE_TYPES) window.removeEventListener(type, noteDispatch, true);
}

// ---------------------------------------------------------------------------
// What a row asks of the browser beyond the page: file pickers, saved files,
// copied text, and what it keeps in the browser's storage.
// ---------------------------------------------------------------------------

/**
 * The browser's storage, in memory, as a browser keeps it: what a row writes
 * there (a section folded, the recovery record, a tip seen) is part of what
 * it does, and a later start reads it back.
 */
const stored = new Map();

function installStorage() {
  localStorage.getItem.mockImplementation(key => (stored.has(key) ? stored.get(key) : null));
  localStorage.setItem.mockImplementation((key, value) => { stored.set(key, String(value)); });
  localStorage.removeItem.mockImplementation((key) => { stored.delete(key); });
  localStorage.clear.mockImplementation(() => stored.clear());
  Object.defineProperty(localStorage, 'length', { configurable: true, get: () => stored.size });
  localStorage.key = index => [...stored.keys()][index] ?? null;
}

function uninstallStorage() {
  localStorage.getItem.mockImplementation(() => null);
  localStorage.setItem.mockImplementation(() => {});
  localStorage.removeItem.mockImplementation(() => {});
  localStorage.clear.mockImplementation(() => {});
  delete localStorage.length;
  delete localStorage.key;
  stored.clear();
}

/** What storage holds, as a golden can read it: each key, its value quoted, a long one elided. */
function storageState() {
  return new Map([...stored].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, quote(value)]));
}

const browserRequests = [];
const blobsByUrl = new Map();
let nextBlobUrl = 0;
const originalAnchorClick = HTMLAnchorElement.prototype.click;

/** A click on a file input asks for the browser's file dialog, which jsdom does not open. */
function noteFileDialog(event) {
  if (event.target instanceof HTMLInputElement && event.target.type === 'file') {
    browserRequests.push(Promise.resolve(`file dialog ${keyFor(event.target)}`));
  }
}

function checksum(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 12);
}

/** Saved files are recorded by what they hold, and not otherwise followed. */
function watchDownloads() {
  const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    nextBlobUrl += 1;
    const url = `blob:controls-${nextBlobUrl}`;
    blobsByUrl.set(url, blob);
    return url;
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function saveOrFollow() {
    if (!this.hasAttribute('download')) return originalAnchorClick.call(this);
    const blob = blobsByUrl.get(this.href);
    browserRequests.push(blob
      ? blob.arrayBuffer().then(buffer => `download ${this.download} ${blob.type || '(no type)'} ${buffer.byteLength} bytes ${checksum(new Uint8Array(buffer))}`)
      : Promise.resolve(`download ${this.download} from ${quote(this.href)}`));
  });
  return [create, click];
}

/**
 * Route Plotter is Chromium-only, and Chromium lets a page write the
 * clipboard; jsdom has none. A context may take the write away.
 */
function installClipboard(writeText) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}

const copying = async (text) => {
  browserRequests.push(Promise.resolve(`clipboard ${quote(text)}`));
};

/** An alert is a browser dialog the page opens; jsdom has none. */
function watchAlerts() {
  return vi.spyOn(window, 'alert').mockImplementation((message) => {
    browserRequests.push(Promise.resolve(`alert ${quote(String(message))}`));
  });
}

/**
 * Pointer capture, which jsdom lacks, as a browser keeps it: a pointer that
 * is down can be captured by an element, which then receives its events
 * wherever it goes, and is let go by a release, or when the pointer goes up
 * or is cancelled. Taking and letting go of a capture are requests of the
 * browser; `gotpointercapture` and `lostpointercapture` are sent as it sends
 * them. (`pointer` below sends a row's pointer events.)
 */
const pointersDown = new Set();
const pointerCaptures = new Map();
const capturesToAnnounce = new Set();
/** Captures let go of while a pointer event is being sent: lost once it has been. */
const releasesPending = new Set();
let sendingPointerEvent = false;
const POINTER_CAPTURE_METHODS = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'];
const originalPointerCapture = POINTER_CAPTURE_METHODS.map(name => [name, Object.getOwnPropertyDescriptor(Element.prototype, name)]);

function losePointerCapture(pointerId) {
  const holder = pointerCaptures.get(pointerId);
  if (!holder) return;
  pointerCaptures.delete(pointerId);
  capturesToAnnounce.delete(pointerId);
  browserRequests.push(Promise.resolve(`pointer capture ${pointerId} let go by ${keyFor(holder)}`));
  holder.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, pointerId }));
}

function installPointerCapture() {
  Object.defineProperties(Element.prototype, {
    setPointerCapture: {
      configurable: true,
      writable: true,
      value(pointerId) {
        if (!pointersDown.has(pointerId)) throw new DOMException(`No active pointer with the id ${pointerId}.`, 'NotFoundError');
        // Taken again before a release is carried out, it is kept
        if (pointerCaptures.get(pointerId) === this) {
          releasesPending.delete(pointerId);
          return;
        }
        losePointerCapture(pointerId);
        pointerCaptures.set(pointerId, this);
        capturesToAnnounce.add(pointerId);
        browserRequests.push(Promise.resolve(`pointer capture ${pointerId} taken by ${keyFor(this)}`));
      },
    },
    releasePointerCapture: {
      configurable: true,
      writable: true,
      value(pointerId) {
        if (pointerCaptures.get(pointerId) !== this) return;
        if (sendingPointerEvent) releasesPending.add(pointerId);
        else losePointerCapture(pointerId);
      },
    },
    hasPointerCapture: {
      configurable: true,
      writable: true,
      value(pointerId) {
        // A browser answers for the capture it will hold after the event: one
        // let go of while the event is sent is no longer held, though it is
        // lost (`lostpointercapture`) only once the event has been sent
        return pointerCaptures.get(pointerId) === this && !releasesPending.has(pointerId);
      },
    },
  });
}

function uninstallPointerCapture() {
  for (const [name, descriptor] of originalPointerCapture) {
    if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
    else delete Element.prototype[name];
  }
  pointersDown.clear();
  pointerCaptures.clear();
  capturesToAnnounce.clear();
  releasesPending.clear();
}

/**
 * Send a pointer event as a browser would: to the element holding the
 * pointer's capture, if one does, or else to the element under it. A capture
 * taken since the last event is announced to its holder first; one let go of
 * while the event is sent, or held when the pointer goes up or is cancelled,
 * is lost once the event has been sent, as a browser processes pending
 * captures after the event.
 */
function pointer(under, type, { pointerId = 1, clientX = 0, clientY = 0, modifiers = {} } = {}) {
  if (type === 'pointerdown') pointersDown.add(pointerId);
  if (capturesToAnnounce.delete(pointerId)) {
    pointerCaptures.get(pointerId).dispatchEvent(new PointerEvent('gotpointercapture', { bubbles: true, pointerId }));
  }
  const target = pointerCaptures.get(pointerId) ?? under;
  const ending = type === 'pointerup' || type === 'pointercancel';
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: type !== 'pointercancel',
    composed: true,
    pointerId,
    pointerType: 'mouse',
    isPrimary: true,
    button: type === 'pointerdown' || type === 'pointerup' ? 0 : -1,
    buttons: ending ? 0 : 1,
    clientX,
    clientY,
    ...modifiers,
  });
  sendingPointerEvent = true;
  try {
    target.dispatchEvent(event);
  } finally {
    sendingPointerEvent = false;
  }
  if (releasesPending.delete(pointerId) || ending) losePointerCapture(pointerId);
  if (ending) pointersDown.delete(pointerId);
  return event;
}

// ---------------------------------------------------------------------------
// A press, and focus, as Chromium has them (checked against Chromium 152).
// ---------------------------------------------------------------------------

/**
 * Chromium blurs a focused element as it takes it off the page (`blur`, then
 * `focusout`, while it is still there), whether it is removed, replaced or
 * moved; the app relies on it (a rename's field commits on `blur`). jsdom
 * moves focus to the body silently, so its own step for a node about to go,
 * which every removal passes through, blurs the focused element first.
 */
let restoreRemovalBlur = null;

function blurBeforeRemoval() {
  const implKey = Object.getOwnPropertySymbols(document).find(symbol => symbol.description === 'impl');
  const documentImpl = document[implKey];
  const wrapperKey = Object.getOwnPropertySymbols(documentImpl).find(symbol => symbol.description === 'wrapper');
  const steps = Object.getPrototypeOf(documentImpl);
  const original = steps._runPreRemovingSteps;
  if (typeof original !== 'function' || !wrapperKey) throw new Error('jsdom no longer has the removal step this harness extends');
  steps._runPreRemovingSteps = function blurFirst(goingImpl) {
    const focused = this._lastFocusedElement?.[wrapperKey];
    const going = goingImpl?.[wrapperKey];
    if (focused && going?.contains(focused)) focused.blur();
    return original.call(this, goingImpl);
  };
  restoreRemovalBlur = () => { steps._runPreRemovingSteps = original; };
}

/**
 * What a press can focus, as Chromium finds it: a form control, a link, a
 * details' summary, an editable element, or anything with a tabindex, while it
 * is enabled, shown and not inert. jsdom lays nothing out, so shown is read
 * from what the page sets inline (`hidden`, `display`), as `isShown` reads it.
 */
const PRESS_FOCUSABLE = 'a[href], area[href], button, input:not([type=hidden]), select, textarea, iframe, [tabindex], [contenteditable]:not([contenteditable=false]), details > summary:first-of-type';

function pressFocusable(element) {
  if (!element.isConnected || !element.matches(PRESS_FOCUSABLE) || element.matches(':disabled')) return false;
  for (let node = element; node; node = node.parentElement) {
    if (node.hidden || node.style?.display === 'none' || node.inert || node.hasAttribute('inert')) return false;
  }
  return true;
}

/**
 * Move focus as a press does once its button is down: to the nearest element
 * from the one pressed up that a press can focus, unless one on the way has
 * focus already; when there is none (plain text, the page itself, or an
 * element the press took off the page), focus leaves whatever had it.
 */
function focusByPress(pressed) {
  for (let node = pressed.isConnected ? pressed : null; node; node = node.parentElement) {
    if (!pressFocusable(node)) continue;
    if (node !== document.activeElement) node.focus();
    if (document.activeElement !== node) throw new Error(`a press on ${keyFor(pressed)} did not focus ${keyFor(node)}`);
    return;
  }
  document.activeElement?.blur();
}

/** The nearest element holding both (each holds itself). */
function commonAncestor(first, second) {
  for (let node = first; node; node = node.parentElement) {
    if (node.contains(second)) return node;
  }
  return document.documentElement;
}

const NO_KEYS = { shiftKey: false, metaKey: false, ctrlKey: false, altKey: false };

/** A mouse event as Chromium sends it alongside a pointer's: `count` is its click count. */
function mouseEvent(target, type, { count = 1, buttons = 0, keys = NO_KEYS } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, detail: count, button: 0, buttons, ...keys });
  target.dispatchEvent(event);
  return event;
}

/**
 * The primary button going down on an element: `pointerdown`; `mousedown`,
 * unless the page cancelled `pointerdown` (nor does any mouse event follow
 * until the button comes up); then, unless either was cancelled, the press's
 * own effect (`onDown`: a range takes its value here) and its focus
 * (`focusByPress`). Says whether mouse events follow (`compatible`) and
 * whether the press did what it does (`acted`).
 */
function buttonDown(element, { count = 1, keys = NO_KEYS, onDown = null } = {}) {
  const compatible = !pointer(element, 'pointerdown', { modifiers: keys }).defaultPrevented;
  const acted = compatible && !mouseEvent(element, 'mousedown', { count, buttons: 1, keys }).defaultPrevented;
  if (acted) {
    onDown?.();
    focusByPress(element);
  }
  return { compatible, acted };
}

/**
 * Press the primary button on an element and let it go, as Chromium sends a
 * mouse's: the button goes down (`buttonDown`), then `onHeld` if the press
 * acted; `pointerup` and, unless `pointerdown` was cancelled, `mouseup`, to
 * what is under the pointer then: the element pressed, or what took its place
 * if the press rebuilt it; then `onUp`; and `click`, to the nearest element
 * holding both the one pressed and that one, if the one pressed is still on
 * the page. `count` is the press's place in a run of them, 2 for a
 * double-click's second. Returns what was clicked, or null.
 */
function press(element, { count = 1, modifiers = {}, onDown = null, onHeld = null, onUp = null } = {}) {
  const key = keyFor(element);
  const keys = { ...NO_KEYS, ...modifiers };
  const { compatible, acted } = buttonDown(element, { count, keys, onDown });
  if (acted) onHeld?.();
  const under = element.isConnected ? element : (elementAt(key) ?? document.body);
  const up = pointer(under, 'pointerup', { modifiers: keys });
  if (compatible) mouseEvent(up.target, 'mouseup', { count, keys });
  onUp?.();
  if (!element.isConnected) return null;
  const clicked = commonAncestor(element, up.target.isConnected ? up.target : element);
  clicked.dispatchEvent(new PointerEvent('click', {
    bubbles: true, cancelable: true, composed: true, detail: count, button: 0, buttons: 0,
    pointerId: 1, pointerType: 'mouse', isPrimary: true, ...keys,
  }));
  return clicked;
}

async function takeBrowserRequests() {
  const pending = browserRequests.splice(0);
  return Promise.all(pending);
}

// ---------------------------------------------------------------------------
// Operations: one user gesture per row.
// ---------------------------------------------------------------------------

/**
 * Wired elements no row operates, each with the reason. A reason names where
 * the behaviour is pinned instead, or why a user cannot reach it.
 */
const NOT_OPERATED = [
  ['#canvas', 'canvas gestures: interactionPointer.test.js and the draw logs'],
  [`${OUTLINE}, ${OUTLINE} *`, 'the semantic outline: sceneOutline.test.js and sceneOutlineApp.test.js'],
  ['#settings-sections', 'delegation only: it marks the section last used, which the rows inside show'],
  ['#waypoint-scope', 'delegation only: card actions and mixed-state resets, which the rows inside show'],
  ['#crowd-busyness-handles', 'delegation only: the handle inputs inside are rows'],
  ['input[type=hidden]', 'written by its swatch picker, whose radios and custom-colour inputs are rows'],
];

/** Gestures no row performs anywhere, each with the reason. */
const GESTURES_NOT_PERFORMED = new Map([
  ['keydown', 'keyboard: the key table (TST-13)'],
  ['keyup', 'keyboard: the key table (TST-13)'],
]);

function exclusionFor(element) {
  for (const [selector, reason] of NOT_OPERATED) {
    if (element.matches(selector)) return reason;
  }
  return null;
}

const fire = (element, type) => element.dispatchEvent(new Event(type, { bubbles: true }));

function commit(element, value) {
  element.value = value;
  fire(element, 'input');
  fire(element, 'change');
}

/** A range is pressed a third of the way along its track (two thirds, if its value is there already). */
function rangeTarget(element) {
  const min = Number(element.min || 0);
  const max = Number(element.max || 100);
  const step = element.step && element.step !== 'any' ? Number(element.step) : 1;
  const snap = value => Number((Math.round((value - min) / step) * step + min).toFixed(6));
  const third = snap(min + (max - min) / 3);
  return String(third) === element.value ? snap(min + (2 * (max - min)) / 3) : third;
}

const PNG_BYTES = Uint8Array.from(atob(PIXEL_DATA_URL.split(',')[1]), char => char.charCodeAt(0));

/** The file a user picks: an image for image inputs, and a project that is not one for Open. */
function pickedFile(element) {
  return element.accept === '.zip'
    ? new File(['not a zip'], 'not-a-project.zip', { type: 'application/zip' })
    : new File([PNG_BYTES], 'picked.png', { type: 'image/png' });
}

function chooseFile(element, file) {
  Object.defineProperty(element, 'files', { configurable: true, get: () => (file ? [file] : []) });
  fire(element, 'change');
  delete element.files;
}

/**
 * A value set as a user sets it: the control is pressed first, which focuses
 * it and opens its picker or puts the caret in it, and once the value is
 * chosen or typed it is committed (`input`, `change`), as choosing from a
 * popup or pressing Enter commits it. The picker and the typing between are
 * not sent.
 */
function pressAndCommit(element, value) {
  const key = keyFor(element);
  press(element);
  commit(element.isConnected ? element : elementAt(key), value);
}

/**
 * What a range does with a press at `value` (Chromium 152): it takes the
 * value as the button goes down (`input`, while focus is still where it was),
 * holds the pointer while the button is down, and commits the value
 * (`change`) as it comes up, before the `click`. A press on its thumb, where
 * its value already is, changes nothing.
 */
function rangePress(element, value = element.value) {
  let moved = false;
  const capture = type => element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  return {
    onDown: () => {
      if (element.value === value) return;
      element.value = value;
      moved = true;
      fire(element, 'input');
    },
    onHeld: () => capture('gotpointercapture'),
    onUp: () => {
      if (moved) fire(element, 'change');
      capture('lostpointercapture');
    },
  };
}

/** A range pressed a place along its track. */
const slide = (element, value) => press(element, rangePress(element, value));

/** A press as its control takes it: a range's on its thumb. */
const pressControl = (element, options = {}) => press(element, {
  ...options,
  ...(element instanceof HTMLInputElement && element.type === 'range' ? rangePress(element) : {}),
});

/**
 * A double-click as a pointer gives it: two presses, the second counting 2,
 * each going to what is under the pointer then, so a first click that
 * rebuilds its control (a list redrawn as it selects) leaves the second to
 * what took its place; then `dblclick`, after the second `click`, if what that
 * clicked is still on the page (Chromium sends none to a control its second
 * click rebuilt).
 */
function doubleClick(element) {
  const key = keyFor(element);
  pressControl(element);
  const clicked = pressControl(element.isConnected ? element : (elementAt(key) ?? element), { count: 2 });
  if (clicked?.isConnected) {
    clicked.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, composed: true, detail: 2, button: 0 }));
  }
}

/**
 * A click away: a press on the page itself, which nothing on it can focus, so
 * it takes focus from whatever had it.
 */
const clickAway = () => press(document.body);

/**
 * Toggles are undone by the app's own activation of the same control, which
 * spares a reload; focus goes back to the body, where the press found it.
 * The result must still equal the baseline, or the reload follows.
 */
const click = { label: 'click', run: element => pressControl(element) };
const toggle = {
  ...click,
  undo: (element) => {
    element.click();
    document.activeElement?.blur();
  },
};
const doubleClicking = { label: 'double-click', run: doubleClick };

/** Rows rename on a double click the app times itself (`UIController`) or hears as `dblclick`. */
const RENAMES_ON_DOUBLE_CLICK = '.waypoint-row';
/**
 * Rows whose double-click opens a name field, which a click away commits: a
 * waypoint's, and a crowd's (the route's row has none, nor the add row).
 */
const RENAMES = 'li.waypoint-item > .waypoint-row:not(.waypoint-add-btn), #layers-strip > li:not(:first-child) > button:first-child';

/**
 * Type text as a keyboard does: into the focused field, over the text it has
 * selected (or at its caret). Nothing is typed when no text field has focus.
 */
function typeIntoFocused(text) {
  const field = document.activeElement;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || field.selectionStart === null) return;
  field.setRangeText(text, field.selectionStart, field.selectionEnd, 'end');
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
}

/**
 * Double-click, type a new name, and click away: the field commits on `blur`.
 * The name is typed where the app left the selection when it opened the field.
 */
const renaming = {
  label: 'double-click, type "Renamed", click away',
  run: (element) => {
    const key = keyFor(element);
    doubleClick(element);
    // A waypoint row opens it a frame later, once the list is rebuilt, after
    // the frames that give focus back to the rebuilt rows.
    let field = elementAt(key)?.querySelector('input');
    for (let frame = 0; !field && frame < 6; frame += 1) {
      vi.advanceTimersToNextTimer();
      field = elementAt(key)?.querySelector('input');
    }
    if (!field) throw new Error(`${key}: a double-click opened no name field`);
    typeIntoFocused('Renamed');
    clickAway();
  },
};

/**
 * The only click handler in the sidebar that reads a modifier key: a waypoint
 * row's, where Shift selects the rows between and Cmd or Ctrl adds or removes
 * one (see `the only sidebar click that reads a modifier`). The key is held
 * through the whole press. Ctrl-click is as Windows and Linux send it: on a
 * Mac, Chromium sends `contextmenu` and no `click` for it, so the row's
 * Ctrl-click is not reached there (Cmd-click is the Mac's).
 */
const MODIFIED_CLICKS = '.waypoint-row:not(.waypoint-add-btn)';
const modifiedClick = (label, modifiers) => ({ label, run: element => press(element, { modifiers }) });
const shiftClicking = modifiedClick('shift-click', { shiftKey: true });
const commandClicking = modifiedClick('Cmd-click', { metaKey: true });
const controlClicking = modifiedClick('Ctrl-click', { ctrlKey: true });

/** Every read of a modifier key in `src/`, by file, and where each is pinned. */
const MODIFIER_READS = {
  'app/pointer.js': 1, // the canvas: interactionPointer.test.js
  'app/wiringBus.js': 1, // a payload from the canvas's drag
  'app/wiringControllers.js': 1, // a payload from the canvas's click
  'app/wiringDom.js': 1, // the arrow keys' nudge: TST-13
  'config/keybindings.js': 8, // the key table: TST-13
  'controllers/UIController.js': 3, // a waypoint row's click: rows here
  'handlers/InteractionHandler.js': 43, // the canvas: interactionPointer.test.js
  'utils/focusTrap.js': 2, // Tab in a dialog: TST-13
};

/**
 * A radio already chosen fires nothing when clicked again, so it is chosen
 * from another of its group too: the other is chosen first, as part of the
 * row's starting point, and the row records choosing this one.
 */
function otherChoiceOf(radio) {
  return [...document.querySelectorAll('input[type=radio]')]
    .find(each => each.name === radio.name && each !== radio && !each.disabled && isShown(each)) ?? null;
}

function choosingFromAnother(radio) {
  const other = otherChoiceOf(radio);
  if (!other) return [];
  const otherKey = keyFor(other);
  return [{
    label: `click, from ${otherKey}`,
    prepare: () => press(elementAt(otherKey)),
    run: element => press(element),
  }];
}

/** A waypoint list row a user can drag: a major, with its leg. */
const DRAGGABLE_ROW = '#waypoint-list > li[draggable="true"]';

/**
 * jsdom lays nothing out. For a drag, each list row is given a height, in the
 * order the rows stand in when it is measured, so the half of a row a pointer
 * is over is the half a browser would report.
 */
const ROW_HEIGHT = 20;

function layOutList() {
  const measure = Element.prototype.getBoundingClientRect;
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rowBox() {
    const list = this.parentElement;
    if (!(this instanceof HTMLLIElement) || list?.id !== 'waypoint-list') return measure.call(this);
    const top = Array.prototype.indexOf.call(list.children, this) * ROW_HEIGHT;
    return { left: 0, top, right: 240, bottom: top + ROW_HEIGHT, width: 240, height: ROW_HEIGHT, x: 0, y: top, toJSON() {} };
  });
}

/** How a drag starts out over a target, from what its source allowed (HTML's drag-and-drop model). */
const INITIAL_DROP_EFFECT = {
  none: 'none', copy: 'copy', copyLink: 'copy', copyMove: 'copy', all: 'copy',
  link: 'link', linkMove: 'link', move: 'move', uninitialized: 'move',
};

/** The operations a drag's source allows, by its `effectAllowed`: a target cannot ask for another. */
const ALLOWED_OPERATIONS = {
  none: [], copy: ['copy'], copyLink: ['copy', 'link'], copyMove: ['copy', 'move'], all: ['copy', 'link', 'move'],
  link: ['link'], linkMove: ['link', 'move'], move: ['move'], uninitialized: ['copy', 'link', 'move'],
};

/** Whether a `dragover` accepts the drop: the page cancelled it, and left an effect the source allows. */
const dropAccepted = (dragover, transfer) => dragover.defaultPrevented
  && (ALLOWED_OPERATIONS[transfer.effectAllowed] ?? []).includes(transfer.dropEffect);

/**
 * What a drag carries, as far as a page can see it, in the mode HTML's drag
 * data store gives each event: at `dragstart` the page may write it and read
 * it back, and say which operations the source allows; at `drop` it may read
 * it; at every other event (`dragenter`, `dragover`, `dragleave`, `dragend`)
 * it sees only its formats, as a browser keeps a drag's data from the pages
 * it passes over. `sending(type)` puts the store in the mode for an event of
 * that type, before it is sent.
 */
function dragData() {
  const data = new Map();
  let mode = 'protected';
  let effectAllowed = 'uninitialized';
  const formatOf = (format) => {
    const lower = String(format).toLowerCase();
    return { text: 'text/plain', url: 'text/uri-list' }[lower] ?? lower;
  };
  const transfer = {
    dropEffect: 'none',
    get effectAllowed() { return effectAllowed; },
    set effectAllowed(value) { if (mode === 'read/write' && value in ALLOWED_OPERATIONS) effectAllowed = value; },
    get types() { return [...data.keys()]; },
    setData: (format, value) => { if (mode === 'read/write') data.set(formatOf(format), String(value)); },
    getData: format => (mode === 'protected' ? '' : data.get(formatOf(format)) ?? ''),
    clearData: (format) => {
      if (mode !== 'read/write') return;
      if (format === undefined) data.clear();
      else data.delete(formatOf(format));
    },
    setDragImage() {},
  };
  const sending = (type) => {
    mode = { dragstart: 'read/write', drop: 'read-only' }[type] ?? 'protected';
  };
  return { transfer, sending };
}

/** The list's rows in the order it shows them, by title (the add row has none). */
const listShown = () => [...document.getElementById('waypoint-list').children]
  .map(row => row.querySelector('.waypoint-title')?.textContent ?? '(add)')
  .join(', ');

/**
 * Drag a row by its handle, as Chromium sends the drag: the button goes down
 * on the handle (`pointerdown`, `mousedown`, and focus to the row's button)
 * and the pointer moves (`pointermove`, `mousemove`); `dragstart` at the row,
 * and the pointer's own events end there (`pointercancel`); `dragenter` and
 * `dragover` at the row under the pointer, over the half given; there, a
 * `drop` only if the page cancelled that `dragover` (so accepting it) and left
 * it an effect the drag's source allows, or else a `dragleave`; and last,
 * `dragend` at the row it began from, though its drop may have rebuilt the
 * list (no `mouseup` or `click` follows a drag). `away` takes the pointer out
 * of the list before letting go, over the page, which accepts no drop. The
 * row records where the list shows the block while the pointer is over its
 * target: where it will land.
 */
function dragging(label, ontoOf, { half, away = false }) {
  return {
    label,
    run: (row) => {
      const onto = ontoOf(row);
      if (!onto) throw new Error(`${keyFor(row)}: nothing to drag onto`);
      const { transfer, sending } = dragData();
      const send = (target, type, clientY = 0) => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: type !== 'dragleave' && type !== 'dragend', clientY });
        Object.defineProperty(event, 'dataTransfer', { value: transfer });
        sending(type);
        target.dispatchEvent(event);
        return event;
      };
      const over = (target, clientY) => {
        send(target, 'dragenter', clientY);
        transfer.dropEffect = INITIAL_DROP_EFFECT[transfer.effectAllowed] ?? 'none';
        return dropAccepted(send(target, 'dragover', clientY), transfer);
      };
      const layout = layOutList();
      try {
        const handle = row.querySelector('.waypoint-handle') ?? row;
        if (!buttonDown(handle).acted) throw new Error(`${keyFor(row)}: the page cancelled the press a drag starts with`);
        pointer(handle, 'pointermove');
        mouseEvent(handle, 'mousemove', { count: 0, buttons: 1 });
        if (send(row, 'dragstart').defaultPrevented) throw new Error(`${keyFor(row)}: the page refused the drag`);
        pointer(handle, 'pointercancel');
        const box = onto.getBoundingClientRect();
        const clientY = box.top + (half === 'upper' ? box.height / 4 : (3 * box.height) / 4);
        let target = onto;
        let accepted = over(onto, clientY);
        const shown = `while over it, the list shows: ${listShown()}`;
        if (away) {
          send(onto, 'dragleave', clientY);
          target = document.body;
          accepted = over(target, -ROW_HEIGHT);
        }
        if (accepted) send(target, 'drop', clientY);
        else {
          transfer.dropEffect = 'none';
          send(target, 'dragleave', clientY);
        }
        send(row, 'dragend');
        return [shown];
      } finally {
        layout.mockRestore();
      }
    },
  };
}

const draggableRows = row => [...row.parentElement.querySelectorAll(':scope > li[draggable="true"]')];
const nextMajorRow = row => draggableRows(row)[draggableRows(row).indexOf(row) + 1] ?? null;
const previousMajorRow = row => draggableRows(row)[draggableRows(row).indexOf(row) - 1] ?? null;
const minorRow = row => row.parentElement.querySelector(':scope > li.waypoint-item-minor');

/**
 * The next major's row (the one before, for the last): over its upper half a
 * block lands before it, over its lower half after its leg. Over a minor's
 * row, either half, it lands after the leg that minor is in, never inside it;
 * and let go outside the list, nowhere.
 */
function rowDrags(row) {
  const neighbour = nextMajorRow(row) ? ['next', nextMajorRow] : ['previous', previousMajorRow];
  const [which, ontoOf] = neighbour;
  const drags = [
    dragging(`drag onto the upper half of the ${which} major’s row`, ontoOf, { half: 'upper' }),
    dragging(`drag onto the lower half of the ${which} major’s row`, ontoOf, { half: 'lower' }),
    dragging(`drag onto the ${which} major’s row, then let go outside the list`, ontoOf, { half: 'lower', away: true }),
  ];
  if (minorRow(row)) {
    drags.push(
      dragging('drag onto the upper half of the minor’s row', minorRow, { half: 'upper' }),
      dragging('drag onto the lower half of the minor’s row', minorRow, { half: 'lower' }),
    );
  }
  return drags;
}

/**
 * The busyness graph is dragged by its handles. jsdom lays nothing out, so
 * the graph is given a size for the gesture: 300 wide and 150 high, at the
 * page's corner.
 */
const BUSYNESS_GRAPH = '#crowd-busyness-graph';
const GRAPH_BOX = { left: 0, top: 0, right: 300, bottom: 150, width: 300, height: 150, x: 0, y: 0 };

/**
 * Press on a handle, move through `moves` (each `[x, y]`, from the graph's
 * corner; one outside the graph is over the page instead), and finish with
 * `finish` at the last of them. Each event goes where a browser would send it
 * (`pointer`), so a graph that did not capture the pointer never hears one
 * outside it; and the mouse's go with them, as a press's do: `mousedown` and
 * the press's focus unless the page cancelled `pointerdown` (the graph does,
 * on a handle), `mousemove` and `mouseup` to where the pointer's went unless
 * it did, and a `click` once the button comes up (not for a cancelled
 * gesture) if the handle pressed is still on the page.
 */
function busynessGesture(label, handleIndex, moves, finish = 'pointerup') {
  return {
    label,
    run: (graph) => {
      const handles = graph.querySelectorAll('[data-busyness-handle]');
      const handle = handleIndex === 'last' ? handles[handles.length - 1] : graph.querySelector(`[data-busyness-handle="${handleIndex}"]`);
      if (!handle) throw new Error(`the busyness graph has no handle ${handleIndex}`);
      const measure = vi.spyOn(graph, 'getBoundingClientRect').mockReturnValue(GRAPH_BOX);
      const under = ([x, y]) => (x >= 0 && x <= GRAPH_BOX.width && y >= 0 && y <= GRAPH_BOX.height ? graph : document.body);
      try {
        const compatible = !pointer(handle, 'pointerdown', { clientX: moves[0][0], clientY: moves[0][1] }).defaultPrevented;
        if (compatible && !mouseEvent(handle, 'mousedown', { buttons: 1 }).defaultPrevented) focusByPress(handle);
        for (const move of moves) {
          const moved = pointer(under(move), 'pointermove', { clientX: move[0], clientY: move[1] });
          if (compatible) mouseEvent(moved.target, 'mousemove', { count: 0, buttons: 1 });
        }
        const last = moves.at(-1);
        const ended = pointer(under(last), finish, { clientX: last[0], clientY: last[1] });
        if (finish === 'pointerup') {
          if (compatible) mouseEvent(ended.target, 'mouseup');
          if (handle.isConnected) {
            commonAncestor(handle, ended.target).dispatchEvent(new PointerEvent('click', {
              bubbles: true, cancelable: true, composed: true, detail: 1, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true,
            }));
          }
        }
      } finally {
        measure.mockRestore();
      }
    },
  };
}

/** The first and last handles hold the ends: they move up and down, not along. */
const END_HANDLE_DRAGS = [
  busynessGesture('drag its first handle a third of the way down, and let go there', 0, [[0, 10], [0, 50]]),
  busynessGesture('drag its first handle below the graph, and let go there', 0, [[0, 10], [0, 50], [0, 200]]),
  busynessGesture('drag its first handle, then the drag is cancelled', 0, [[0, 10], [0, 50]], 'pointercancel'),
  busynessGesture('drag its last handle a third of the way down, and let go there', 'last', [[300, 10], [300, 50]]),
];

/** A handle between them moves along too, but never onto or past a neighbour. */
const MIDDLE_HANDLE_DRAGS = [
  busynessGesture('drag its middle handle a quarter of the way along and a third down', 1, [[150, 75], [75, 50]]),
  busynessGesture('drag its middle handle past the last', 1, [[150, 75], [300, 50]]),
  busynessGesture('drag its middle handle past the first', 1, [[150, 75], [0, 50]]),
];

function operationsFor(element) {
  if (element.disabled) return [{ label: 'disabled, not operated', notOperated: true, run: () => {} }];
  if (element.readOnly) return [{ label: 'read-only, not operated', notOperated: true, run: () => {} }];
  if (element.matches(DRAGGABLE_ROW)) return rowDrags(element);
  if (element.matches(BUSYNESS_GRAPH)) {
    return element.querySelectorAll('[data-busyness-handle]').length > 2 ? MIDDLE_HANDLE_DRAGS : END_HANDLE_DRAGS;
  }
  const extra = [];
  if (wiredEvents.get(element)?.has('dblclick') || element.matches(RENAMES_ON_DOUBLE_CLICK)) extra.push(doubleClicking);
  if (element.matches(RENAMES)) extra.push(renaming);
  if (element.matches(MODIFIED_CLICKS)) extra.push(shiftClicking, commandClicking, controlClicking);
  return [...singleGestures(element), ...extra];
}

function singleGestures(element) {
  if (element.matches('.section-header, summary, [data-tip], .dropdown-toggle, button[aria-expanded]')) return [toggle];
  if (element instanceof HTMLSelectElement) {
    return [...element.options]
      .filter(option => !option.disabled && option.value !== element.value)
      .map(option => ({ label: `choose ${JSON.stringify(option.value)}`, run: each => pressAndCommit(each, option.value) }));
  }
  if (element instanceof HTMLInputElement) {
    switch (element.type) {
      case 'range': {
        const target = rangeTarget(element);
        return [{ label: `set ${target}`, run: each => slide(each, String(target)) }];
      }
      case 'number':
        return [
          { label: 'enter 24', run: each => pressAndCommit(each, '24') },
          { label: 'enter 99999', run: each => pressAndCommit(each, '99999') },
        ];
      case 'text':
        return [{ label: 'type "Typed"', run: each => pressAndCommit(each, 'Typed') }];
      case 'color':
        return [{ label: 'pick #56b4e9', run: each => pressAndCommit(each, '#56b4e9') }];
      case 'file':
        return [
          { label: 'choose nothing', run: each => chooseFile(each, null) },
          { label: `choose ${pickedFile(element).name}`, run: each => chooseFile(each, pickedFile(each)) },
        ];
      case 'radio':
        return element.checked ? [click, ...choosingFromAnother(element)] : [click];
      default:
        return [click];
    }
  }
  return [click];
}

const INTERACTIVE = `button, input, select, textarea, a[href], summary, [role=button], [data-tip], [role=listitem], ${DRAGGABLE_ROW}, ${BUSYNESS_GRAPH}`;

/**
 * Shown to a user: nothing on the way up hides it, makes it inert or hides it
 * from them. A file input is never displayed; a user reaches it through the
 * dialog its button opens, so it counts as shown where its button would be.
 */
function isShown(element) {
  const start = element.type === 'file' ? element.parentElement : element;
  for (let node = start; node && node !== document.body; node = node.parentElement) {
    if (node.hidden || node.style?.display === 'none' || node.inert) return false;
    if (node.getAttribute('aria-hidden') === 'true') return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Contexts: where a control is shown, and what a row starts from.
// ---------------------------------------------------------------------------

const clickId = id => () => document.getElementById(id).click();
const choose = (id, value) => commit(document.getElementById(id), value);
const selectWaypoint = index => app => app.eventBus.emit('waypoint:selected', app.waypoints[index]);

function selectCrowd(app) {
  app.eventBus.emit('crowd:selected', app.scene.flowLayers[0]);
}

function inspectNetwork(app, pick) {
  const layer = app.scene.flowLayers[0];
  selectCrowd(app);
  app.networkEditService.bindForInspection(layer);
  pick(app.networkEditService, layer.graph);
}

/** The first node a crowd must choose between paths at: its weights and shares are editable. */
function junctionOf(graph) {
  const node = graph.getNodes().find(each => getGraphDepartureShares(graph, each.id).length >= 2);
  expect(node, 'the fixture network has a junction').toBeDefined();
  return node;
}

/**
 * A toast goes when its own timer takes it down, and a baseline's settling
 * runs every timer. So, where a context exists to press a toast's buttons,
 * the app shows its toasts as it does, but without that timer: the toast a
 * user reaches in time.
 */
function holdToasts(app) {
  if (vi.isMockFunction(app.showToast)) return;
  const show = app.showToast;
  vi.spyOn(app, 'showToast').mockImplementation(function heldToast(message, duration, action) {
    return show.call(this, message, 0, action);
  });
}

/** jsdom has neither WebCodecs nor MediaRecorder, so a WebM export stops at its first step. */
const WEBM_UNSUPPORTED = [/Export failed: Error: Video export not supported/, /Video export failed: Error: Video export not supported/];

/**
 * `roots` are where the context's controls live, all operated; `newRoots` add
 * only controls no earlier context reached, for a context that exists to
 * reveal them. `values` keeps only the controls that write a value, for a
 * context that repeats another's with a different selection; `only`, only
 * the gestures it names, for one that exists to show what they do there.
 */
const CONTEXTS = [
  {
    name: 'route',
    about: 'nothing selected',
    roots: ['body'],
    enter: () => {},
    // Native size, with no background loaded (a recovered project has none).
    logs: [/No image loaded for native resolution/],
  },
  {
    name: 'file-menu',
    about: 'the File menu open',
    roots: ['#file-menu'],
    enter: clickId('file-dropdown-btn'),
    // The example archives are built into docs/, which a checkout lacks; the
    // project a row opens is not a ZIP.
    logs: [/Failed to open example project: Error: HTTP 404/, /Failed to load project: Error: Project ZIP is malformed/],
  },
  {
    name: 'export-menu',
    about: 'the Export menu open',
    roots: ['#export-menu'],
    enter: clickId('export-dropdown-btn'),
    logs: WEBM_UNSUPPORTED,
  },
  {
    name: 'major',
    about: `waypoint ${MAJOR} (a major) selected`,
    roots: ['#scope-chip', '#waypoint-scope'],
    enter: selectWaypoint(MAJOR),
  },
  {
    name: 'mixed',
    about: `waypoint ${MINOR} (a minor) and waypoints ${OTHER_MAJOR} and ${MAJOR} (majors) selected, waypoint ${MAJOR} last`,
    roots: ['#waypoint-scope'],
    values: true,
    enter: (app) => {
      app.eventBus.emit('waypoint:selected', app.waypoints[MINOR]);
      app.eventBus.emit('waypoint:toggle-select', app.waypoints[OTHER_MAJOR]);
      app.eventBus.emit('waypoint:toggle-select', app.waypoints[MAJOR]);
    },
  },
  {
    name: 'list-selected',
    about: `waypoint ${MAJOR} (a major) selected, so a row's Shift-, Cmd- and Ctrl-click each add to a selection`,
    roots: ['#waypoint-list'],
    only: ['shift-click', 'Cmd-click', 'Ctrl-click'],
    enter: selectWaypoint(MAJOR),
  },
  { name: 'crowd', about: 'the crowd selected', roots: ['#scope-chip', '#crowd-scope'], enter: selectCrowd },
  {
    name: 'node',
    about: 'the crowd network\'s first node inspected',
    roots: ['#node-scope'],
    enter: app => inspectNetwork(app, (service, graph) => service.selectNode(graph.getNodes()[0])),
  },
  {
    name: 'edge',
    about: 'the crowd network\'s first edge inspected',
    roots: ['#edge-scope'],
    enter: app => inspectNetwork(app, (service, graph) => service.selectEdge(graph.getEdges()[0])),
  },
  { name: 'clear', about: 'Clear All asked to confirm', roots: ['#clear-confirm-modal'], enter: clickId('clear-btn') },
  { name: 'share', about: 'Save Project asked to disclose', roots: ['#share-disclosure-modal'], enter: clickId('save-project-btn') },
  { name: 'diagnostics', about: 'Report a bug open', roots: ['#diagnostics-modal'], enter: clickId('report-bug-btn') },
  {
    name: 'diagnostics-denied',
    about: 'Report a bug open, in a browser that refuses to write the clipboard',
    roots: ['#diagnostics-modal'],
    clipboard: async () => { throw new DOMException('Write permission denied.', 'NotAllowedError'); },
    enter: clickId('report-bug-btn'),
  },
  { name: 'splash', about: 'Help open', roots: ['#splash'], enter: clickId('help-btn') },
  {
    name: 'codec',
    about: 'an MP4 export this browser cannot encode',
    roots: ['#codec-unsupported-modal'],
    enter: clickId('export-mp4-btn'),
    logs: WEBM_UNSUPPORTED,
  },

  // What another choice or a position reveals, or makes behave otherwise.
  {
    name: 'major-first',
    about: 'waypoint 0 (ripple beacon, polygon area; the first) selected',
    roots: ['#scope-chip'],
    newRoots: ['#waypoint-scope'],
    enter: selectWaypoint(0),
  },
  {
    name: 'major-last',
    about: 'waypoint 5 (pulse beacon; the last) selected',
    roots: ['#scope-chip'],
    newRoots: ['#waypoint-scope'],
    enter: selectWaypoint(5),
  },
  {
    name: 'major-revealed',
    about: `waypoint ${MAJOR} selected, then given a custom marker, a squiggle, a circle area and both custom colours`,
    newRoots: ['#waypoint-scope'],
    enter: (app) => {
      selectWaypoint(MAJOR)(app);
      choose('marker-style', 'custom');
      choose('path-shape', 'squiggle');
      choose('area-shape', 'circle');
      for (const id of ['label-color-custom-disclosure', 'label-bg-color-custom-disclosure']) {
        document.querySelector(`[aria-controls="${id}"]`).click();
      }
    },
  },
  {
    name: 'crowd-handles',
    about: 'the crowd selected, and a busyness handle added between its two ends',
    // The graph again: a handle between the ends is dragged along it too.
    roots: [BUSYNESS_GRAPH],
    newRoots: ['#crowd-scope'],
    enter: (app) => {
      selectCrowd(app);
      document.getElementById('crowd-busyness-add').click();
    },
  },
  {
    name: 'node-junction',
    about: 'a node where the crowd chooses between paths inspected',
    roots: ['#node-scope'],
    enter: app => inspectNetwork(app, (service, graph) => service.selectNode(junctionOf(graph))),
  },
  {
    name: 'edge-junction',
    about: 'a path leaving that junction inspected',
    roots: ['#edge-scope'],
    enter: app => inspectNetwork(app, (service, graph) => {
      const [, second] = getGraphDepartureShares(graph, junctionOf(graph).id);
      service.selectEdge(second.edge);
    }),
  },
  {
    name: 'route-spotlight',
    about: 'the background set to Spotlight Reveal, and the head to a custom image',
    newRoots: ['#route-scope'],
    enter: () => {
      choose('background-visibility', 'spotlight-reveal');
      choose('path-head-style', 'custom');
    },
  },
  { name: 'route-aov', about: 'the background set to Angle of View', newRoots: ['#route-scope'], enter: () => choose('background-visibility', 'angle-of-view') },
  {
    name: 'route-glow',
    about: 'the path glow switched on',
    newRoots: ['#route-scope'],
    enter: clickId('path-glow-toggle'),
  },
  {
    name: 'history',
    about: `waypoint ${MAJOR} given a dot marker, so there is an edit to undo`,
    roots: ['#undo-btn'],
    enter: async (app) => {
      selectWaypoint(MAJOR)(app);
      choose('marker-style', 'dot');
      await settle(6);
    },
  },
  {
    name: 'history-undone',
    about: 'that edit undone, so there is one to redo',
    roots: ['#redo-btn'],
    enter: async (app) => {
      selectWaypoint(MAJOR)(app);
      choose('marker-style', 'dot');
      await settle(6);
      document.getElementById('undo-btn').click();
      await settle(6);
    },
  },
  {
    name: 'network-editing',
    about: 'the crowd network being drawn',
    roots: ['#network-edit-banner'],
    enter: async (app) => {
      selectCrowd(app);
      await settle(6);
      document.getElementById('network-edit-btn').click();
    },
  },
  {
    name: 'area-drawing',
    about: 'a polygon area being drawn for waypoint 0',
    roots: ['#area-draw-banner'],
    enter: async (app) => {
      selectWaypoint(0)(app);
      await settle(6);
      document.getElementById('area-draw-btn').click();
    },
  },
  // Playback asks for a frame every frame, so this baseline is never at rest:
  // each row starts from the same instant of the same playback instead.
  { name: 'playing', about: 'the animation playing', newRoots: ['body'], running: true, enter: clickId('play-btn') },
  {
    name: 'codec-reduced',
    about: 'an 8K MP4 export in a browser that encodes H.264 only up to 9 megapixels',
    roots: ['#codec-unsupported-modal'],
    // The probe stands for the browser's encoder, which jsdom lacks.
    stub: () => vi.spyOn(VideoExporter, '_testWebCodecsConfig')
      .mockImplementation(async (width, height) => (width * height <= 9_000_000 ? { codec: 'avc1' } : null)),
    enter: () => {
      choose('export-res-x', '7680');
      choose('export-res-y', '4320');
      document.getElementById('export-mp4-btn').click();
    },
    logs: WEBM_UNSUPPORTED,
  },
  // A toast's buttons stand only until its timer runs, as every row's
  // settling does, so no other context's rows reach them.
  {
    name: 'toast',
    about: `waypoint ${MAJOR}'s label typed in where it overlaps something, so a toast offers to move it (held: its timer stopped)`,
    roots: ['#toast-container'],
    enter: async (app) => {
      holdToasts(app);
      selectWaypoint(MAJOR)(app);
      await settle(6);
      choose('waypoint-label', 'Typed');
    },
  },
];

const VALUE_CONTROLS = 'input:not([type=hidden]), select, textarea, [data-card-action]';

/**
 * The controls a context operates, in document order. A root that is itself
 * wired for clicks (a modal's backdrop) is operated too.
 */
function controlsOf(context) {
  const chosen = new Set();
  const radioGroups = new Set();
  const roots = [
    ...(context.roots ?? []).map(selector => ({ selector, newOnly: false })),
    ...(context.newRoots ?? []).map(selector => ({ selector, newOnly: true })),
  ];
  for (const { selector, newOnly } of roots) {
    const root = document.querySelector(selector);
    const candidates = root.matches(INTERACTIVE) || wiredEvents.get(root)?.has('click') ? [root] : [];
    candidates.push(...root.querySelectorAll(INTERACTIVE));
    for (const element of candidates) {
      if (chosen.has(element) || !isShown(element) || exclusionFor(element)) continue;
      if (newOnly && operatedControls.has(controlOf(element))) continue;
      if (context.values && !element.matches(VALUE_CONTROLS)) continue;
      // A swatch group's radios do the same thing with another colour; a
      // context that repeats another's controls keeps the first of each.
      if (context.values && element.type === 'radio') {
        if (radioGroups.has(element.name)) continue;
        radioGroups.add(element.name);
      }
      chosen.add(element);
    }
  }
  return [...chosen].map(keyFor);
}

/**
 * The role of the waypoint list row an element is in: a major's, a minor's,
 * or the add row. The class says it, so it can be read off a row that has
 * left the page.
 */
function waypointRowRole(element) {
  const row = element?.closest?.('li.waypoint-item');
  if (!row) return '*';
  if (row.classList.contains('waypoint-item-add')) return 'add';
  return row.classList.contains('waypoint-item-minor') ? 'minor' : 'major';
}

/** A toast's button: its offer's action, or Dismiss. The class says it, on a toast that has gone too. */
function toastButtonRole(element) {
  const button = element?.closest?.('.toast-action, .toast-dismiss');
  if (!button) return '*';
  return button.classList.contains('toast-action') ? 'action' : 'dismiss';
}

/**
 * The control an element is, from its key (`keyFor`'s, or the one it had when
 * an event reached it). A list's rows are instances of a few controls,
 * whichever position a row stands at, so the position gives way to the row's
 * role: a waypoint row is a major's, a minor's or the add row, a layer row the
 * route's (the first) or a crowd's, and a toast's button, in whichever toast,
 * its offer's action or Dismiss.
 */
function controlOf(element, key = keyFor(element)) {
  return key
    .replace(/^#layers-strip>li\[(\d+)\]/, (_, index) => `#layers-strip>li[${index === '0' ? 'route' : 'crowd'}]`)
    .replace(/^#waypoint-list>li\[\d+\]/, () => `#waypoint-list>li[${waypointRowRole(element)}]`)
    .replace(/^#toast-container>div\[\d+\](>button\[\d+\])?/, (_, button) => `#toast-container>div[toast]${button ? `>button[${toastButtonRole(element)}]` : ''}`);
}

/** The element a key names in the current document (keys are `keyFor`'s). */
function elementAt(key) {
  const [anchor, ...steps] = key.split('>');
  let node = anchor === 'body' ? document.body : document.getElementById(anchor.slice(1));
  for (const step of steps) node = node?.children[Number(step.slice(step.indexOf('[') + 1, -1))];
  return node;
}

// ---------------------------------------------------------------------------
// A session: one booted app in one context, and the baseline its rows start from.
// ---------------------------------------------------------------------------

/**
 * The mocks that grow with every frame or write, the harness's own included,
 * and so keep what they were given, `this` too: a canvas, and through it a
 * retired app, is kept by `getContext`'s record of it.
 */
const growingMocks = [];

/**
 * Canvases keep every call they were given, and mocks every call they took:
 * neither is pinned here, and across hundreds of rows they fill the heap.
 * Only the mocks that grow are cleared: clearing every mock Vitest has made
 * walks each retired canvas's too, and costs seconds.
 */
function forgetDrawing(app) {
  for (const canvas of [app.canvas, app.renderingService?.vectorCanvas, app.motionVisibilityService?.revealMaskCanvas]) {
    const context = canvas && contextFor(canvas);
    if (!context) continue;
    context.takeCalls();
    for (const name of Object.keys(context)) {
      const method = Object.getOwnPropertyDescriptor(context, name).value;
      if (vi.isMockFunction(method)) method.mockClear();
    }
  }
  for (const mock of [
    requestAnimationFrame, cancelAnimationFrame, performance.now,
    localStorage.getItem, localStorage.setItem, localStorage.removeItem,
    HTMLCanvasElement.prototype.getContext, HTMLCanvasElement.prototype.toDataURL, HTMLCanvasElement.prototype.toBlob,
    globalThis.fetch, window.matchMedia, ...growingMocks,
  ]) {
    if (vi.isMockFunction(mock)) mock.mockClear();
  }
}

/** Open every card and disclosure in the context's roots, as a user would to reach them. */
function openCards(context) {
  for (const selector of [...(context.roots ?? []), ...(context.newRoots ?? [])]) {
    const root = document.querySelector(selector);
    for (const header of root.querySelectorAll('.section-header[aria-expanded="false"]')) {
      if (isShown(header)) header.click();
    }
    for (const details of root.querySelectorAll('details:not([open])')) {
      if (isShown(details) && !details.closest(OUTLINE)) details.open = true;
    }
  }
}

async function establish(app, context, selections = null) {
  vi.setSystemTime(FIXED_NOW);
  expect(await drive(loadSnapshot(app, project))).toBe(true);
  const splash = document.getElementById('splash');
  if (splash.style.display !== 'none') document.getElementById('splash-close').click();
  // A dialog a row opened outlives the reload: Escape closes it, as it would
  // for a user, and gives back focus and the page it made inert.
  for (let open = 0; open < 4 && document.querySelector('body > [inert]'); open += 1) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(6);
  }
  // A click outside closes any open menu and any shown hint, as it would for
  // a user.
  document.body.click();
  // The one hint tooltip is shared, and keeps the text of the last hint
  // shown: each baseline shows and hides the first hint, so it exists, hidden,
  // holding that hint's text.
  const hint = document.querySelector('[data-tip]');
  hint.click();
  hint.click();
  const transport = app.animationEngine.state;
  if (transport.isPlaying || transport.progress !== 0) {
    app.eventBus.emit('ui:animation:pause');
    app.eventBus.emit('ui:animation:skip-start');
  }
  // The camera settles in Preview, where the app starts. Once it has moved
  // there, Edit mode never lets it settle (DEF-44), so a row that leaves it
  // moving is undone by a fresh app.
  app._setPreviewMode(false);
  app.invalidateAnimationTiming();
  // Rows move focus; each starts with it on the body, once the splash's focus
  // trap has let go.
  await settle(6);
  document.activeElement?.blur();
  await context.enter(app);
  await settle(6);
  openCards(context);
  // The section last used is kept for the session, and no reload clears it.
  if (app.sectionController.lastInteracted !== null) {
    app.sectionController.lastInteracted = null;
    app.sectionController._applyLastInteractedIndicator();
  }
  // Nor the waypoint row last clicked, which a second click on it soon after
  // takes for a double-click and a rename (UIController times it itself).
  app.uiController._renameLastClickWaypoint = null;
  app.uiController._renameLastClickTime = 0;
  // Nor a field's text selection, which a reload that leaves its value as it
  // was leaves too, and typing then goes over: each goes back to where the
  // baseline had it (a fresh app's, which a new session records).
  for (const [key, range] of selections ?? []) {
    const field = elementAt(key);
    const [start, end, direction] = JSON.parse(range);
    if (field && JSON.stringify(selectionOf(field)) !== range) field.setSelectionRange(start, end, direction);
  }
  await settle(50);
  app.markClean();
  forgetDrawing(app);
  // A baseline is at rest: anything still pending would run inside the next row.
  return context.running || vi.getTimerCount() === 0;
}

/** A text field's selection, `[start, end, direction]`, or null for a field that has none. */
function selectionOf(field) {
  if (field.selectionStart === null || field.selectionStart === undefined) return null;
  return [field.selectionStart, field.selectionEnd, field.selectionDirection];
}

/** Every text field's selection, by key, as a reset must put it back. */
function selectionState() {
  const state = new Map();
  for (const field of document.querySelectorAll('input, textarea')) {
    const range = selectionOf(field);
    if (range) state.set(keyFor(field), JSON.stringify(range));
  }
  return state;
}

async function openSession(context) {
  const session = { context, listeners: [], canvases: new Set() };
  owner = session;
  // Every app starts from the same storage: none of its own.
  stored.clear();
  session.app = await drive(bootApp().then(async (booted) => {
    await booted.ready;
    return booted;
  }));
  expect(await establish(session.app, context), `${context.name} is still busy after settling`).toBe(true);
  session.emits = recordEmits(session.app);
  return session;
}

/** A session in a context, with the baseline its rows start from. */
async function startSession(context) {
  const session = await openSession(context);
  session.ui = watchUi(document.body, { opaque: OUTLINE });
  session.base = capture(session);
  session.baseComplete = capture(session, { complete: true });
  session.baseStored = new Map(stored);
  session.baseSelections = selectionState();
  return session;
}

/**
 * Stop an app that a fresh one replaces, and take back what it registered on
 * the document and window. `bootApp` stops its apps only when the test ends,
 * and until then a retired app's listeners and timers would act among the new
 * one's.
 */
function retire(session) {
  // An open name field commits when it loses focus, and needs the app to:
  // it loses it while the app is still whole.
  document.activeElement?.blur();
  session.emits.restore();
  session.app.destroy();
  retireApp(session.app);
  for (const { target, type, listener, options } of session.listeners) {
    target.removeEventListener(type, listener, options);
  }
  session.listeners = [];
  // Vitest keeps every mock it makes, and each canvas's recording context is
  // made of mocks: through a canvas, its page and the calls it was given, a
  // retired app would be kept for the rest of the file. So its canvases leave
  // the page, emptied, as does the calls' record of the files it fetched.
  for (const canvas of session.canvases) {
    const context = contextFor(canvas);
    context?.takeCalls();
    for (const name of Object.keys(context ?? {})) {
      const method = Object.getOwnPropertyDescriptor(context, name).value;
      if (vi.isMockFunction(method)) method.mockClear();
    }
    canvas.remove();
  }
  session.canvases.clear();
  if (vi.isMockFunction(globalThis.fetch)) globalThis.fetch.mockClear();
  // The document remembers the element last focused, and through it that page.
  document.activeElement?.blur();
  forgetDrawing(session.app);
  if (owner === session) owner = null;
  vi.clearAllTimers();
}

/**
 * The session's state as a golden records it, or `complete`, as a reset must
 * reproduce it: a hidden panel's leftover values can show in a later row.
 */
function capture(session, { complete = false } = {}) {
  const app = appState(session.app);
  let selection = new Map();
  if (complete) {
    const ui = session.app.uiController;
    const waypoint = ui._renameLastClickWaypoint;
    app.set('renameClick', JSON.stringify([waypoint ? session.app.waypoints.indexOf(waypoint) : null, ui._renameLastClickTime]));
    selection = selectionState();
  }
  return { model: modelState(session.app), app, storage: storageState(), ui: session.ui.capture({ complete }), selection };
}

function changes(before, after) {
  return [
    ...modelChanges(before.model, after.model),
    ...changedLines(before.app, after.app, 'app'),
    ...changedLines(before.storage, after.storage, 'storage'),
    ...uiChanges(before.ui, after.ui),
    ...changedLines(before.selection, after.selection, 'selection'),
  ];
}

/**
 * What the timers emitted, each event once: how often a frame loop fires in a
 * row is the harness's count of passes, not the app's, so a repeated event
 * keeps only its last payload and says it recurred.
 */
function onceEach(emitted) {
  const byEvent = new Map();
  for (const line of emitted) {
    const name = line.split(' ', 2)[1];
    byEvent.set(name, { line, repeated: byEvent.has(name) });
  }
  return [...byEvent.values()].map(({ line, repeated }) => (repeated ? `${line} (repeatedly)` : line));
}

/**
 * Operate one control and record what it did, and which of the app's
 * listeners its gesture ran. A gesture that starts from somewhere else (a
 * radio chosen from another) is taken there first, and the row records only
 * its own part.
 */
async function runRow(session, key, operation, name) {
  session.emits.take();
  await takeBrowserRequests();
  vi.setSystemTime(ROW_NOW);
  const random = vi.spyOn(Math, 'random').mockImplementation(seededRandom(name));
  let base = session.base;
  if (operation.prepare) {
    operation.prepare(elementAt(key));
    await settle();
    vi.setSystemTime(ROW_NOW);
    session.emits.take();
    await takeBrowserRequests();
    base = capture(session);
  }
  const history = session.app.undoService.createSnapshot();
  invoked = [];
  dispatchKeys = new WeakMap();
  // What the gesture saw on the way, if it says (a drag: where the list
  // showed the block).
  let seen = [];
  try {
    const said = operation.run(elementAt(key));
    if (Array.isArray(said)) seen = said;
  } finally {
    session.invoked = invoked;
    invoked = null;
  }
  // What the gesture wired, before anything (its history replayed below)
  // can take it off the page.
  noteWiring();
  await flush();
  const asked = await takeBrowserRequests();
  const after = capture(session);
  const lines = [...session.emits.take(), ...seen, ...asked, ...changes(base, after)];
  await settle();
  const askedLater = await takeBrowserRequests();
  const settled = capture(session);
  const later = [...onceEach(session.emits.take()), ...askedLater, ...changes(after, settled)];
  const pending = vi.getTimerCount();
  if (pending > 0 && !session.context.running) later.push(`still pending after settling: ${pending} timer(s)`);
  let settledComplete = capture(session, { complete: true });
  vi.clearAllTimers();
  // Playing writes the head's rotation into the project as it goes (DEF-09).
  // A row that undid (the last entry is then one to redo) has no entry of
  // its own to undo.
  const recorded = session.app.undoService.createSnapshot().lastState !== history.lastState;
  if (!session.context.running && recorded && session.app.undoService.canUndo()) {
    await expectHistoryRestores(session, name, history);
    settledComplete = capture(session, { complete: true });
  }
  random.mockRestore();
  if (later.length > 0) lines.push('settled:', ...later.map(line => `  ${line}`));
  return { lines, settled: settledComplete };
}

/**
 * What the app's history holds (`_getUndoableState`: the waypoints, the
 * selection, the styles and the scene), without the `modified` stamp every
 * waypoint made gets when it is made, from a history entry as from a file,
 * and never reads back.
 */
function undoable(state) {
  const copy = JSON.parse(typeof state === 'string' ? state : JSON.stringify(state));
  for (const waypoint of copy.waypoints ?? []) delete waypoint.modified;
  return copy;
}

/**
 * A row that recorded an entry for undo, and can be undone: its own entries
 * undone, what history holds is as it held it before the row; redone, it is
 * what the row made it, selection included, and so is the saved project.
 * What an entry holds, and that undoing and redoing it put it back, not only
 * that there is one. A row whose entries are not simply added on top of the
 * history it began with (it undid; the history was full) is undone and redone
 * once, and its result compared. The controls each step rebuilds are noted
 * for the inventory while they stand.
 */
async function expectHistoryRestores(session, name, before) {
  const made = modelState(session.app);
  const madeHeld = undoable(session.app._getUndoableState());
  const now = session.app.undoService.createSnapshot();
  const own = now.undoStack.length - before.undoStack.length;
  const added = own > 0 && before.undoStack.every((entry, index) => now.undoStack[index] === entry);
  const steps = added ? own : 1;
  for (let step = 0; step < steps; step += 1) {
    session.app.undo();
    await settle();
    noteWiring();
  }
  if (added) {
    expect(undoable(session.app._getUndoableState()), `${name}: undone, the project is not as it was before the row`)
      .toEqual(undoable(before.lastState));
  }
  for (let step = 0; step < steps; step += 1) {
    session.app.redo();
    await settle();
    noteWiring();
  }
  vi.clearAllTimers();
  session.emits.take();
  await takeBrowserRequests();
  const differences = modelChanges(made, modelState(session.app))
    .filter(line => !/^model ~ waypoints\[\d+\]\.modified: /.test(line));
  expect(differences, `${name}: undone and redone, the project is not what the row made it`).toEqual([]);
  expect(undoable(session.app._getUndoableState()), `${name}: undone and redone, what history holds is not what the row made it`)
    .toEqual(madeHeld);
}

/**
 * Put the session back at its baseline, and prove it; boot afresh when a
 * reload cannot, and always in isolated mode.
 */
async function restore(session, element, operation, settled) {
  const complete = { complete: true };
  if (!ISOLATED) {
    if (changes(session.baseComplete, settled).length === 0) return session;
    if (operation.undo && element?.isConnected) {
      operation.undo(element);
      await settle();
      const atRest = vi.getTimerCount() === 0;
      vi.clearAllTimers();
      if (atRest && changes(session.baseComplete, capture(session, complete)).length === 0) return session;
    }
    forgetDrawing(session.app);
    stored.clear();
    for (const [key, value] of session.baseStored) stored.set(key, value);
    const atRest = await establish(session.app, session.context, session.baseSelections);
    session.emits.take();
    if (atRest && changes(session.baseComplete, capture(session, complete)).length === 0) return session;
  }
  retire(session);
  const fresh = await openSession(session.context);
  fresh.ui = session.ui;
  fresh.base = session.base;
  fresh.baseComplete = session.baseComplete;
  fresh.baseStored = session.baseStored;
  fresh.baseSelections = session.baseSelections;
  const drift = changes(fresh.baseComplete, capture(fresh, complete));
  expect(drift, `a fresh app in ${session.context.name} does not match the baseline`).toEqual([]);
  return fresh;
}

// ---------------------------------------------------------------------------
// Goldens.
// ---------------------------------------------------------------------------

/**
 * The inventory: every control seen wired for a user gesture, with its
 * registrations (`wiredSeen`), and every registration a row's gesture ran, by
 * control (`coverage`). Wiring is noted while a context's test runs
 * (`inventoryContext` names it); a self-test may note into one of its own.
 */
const newInventory = () => ({ wiredSeen: new Map(), coverage: new Map() });
let inventory = newInventory();
let inventoryContext = null;
/** Each control and gesture a row has recorded, as `control · label`. */
const recordedLabels = new Set();
/** The controls rows have operated. */
const operatedControls = new Set();

/**
 * Note an element's registrations under the control it is, while it stands on
 * the page: its key, its role and whether a reason excuses it are read from
 * where it stands, and are kept once it has gone.
 */
function noteElementWiring(element) {
  if (!inventoryContext || !element.isConnected) return;
  const registrations = wiredSites.get(element);
  if (!registrations) return;
  const key = controlOf(element);
  const seen = inventory.wiredSeen.get(key) ?? { excluded: exclusionFor(element), context: inventoryContext, registrations: new Set() };
  for (const registration of registrations) seen.registrations.add(registration);
  inventory.wiredSeen.set(key, seen);
}

/** Note every wired element on the page now. */
function noteWiring() {
  for (const element of document.querySelectorAll('*')) noteElementWiring(element);
}

/**
 * Note each wired element put on the page once the page is idle after it
 * (a mutation observer's records arrive then), so a control that is built,
 * shown and later replaced is noted while it stood, even when no row's scan
 * finds it: a history replay can rebuild the controls a row's gesture wired
 * before the row ends.
 */
let wiringObserver = null;

function watchWiring() {
  wiringObserver = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element) || !node.isConnected) continue;
        noteElementWiring(node);
        for (const element of node.querySelectorAll('*')) noteElementWiring(element);
      }
    }
  });
  wiringObserver.observe(document, { childList: true, subtree: true });
}

/** Credit what a row's gesture ran: each listener's registration, to the control it is on. */
function noteCoverage(invocations) {
  for (const { control, registration } of invocations) {
    if (!inventory.coverage.has(control)) inventory.coverage.set(control, new Set());
    inventory.coverage.get(control).add(registration);
  }
}

/**
 * The registrations for a gesture no row ran and nothing excuses, and those
 * of a type that is neither a gesture nor said to be something else.
 */
function inventoryGaps() {
  const { wiredSeen, coverage } = inventory;
  const missing = [];
  const unclassified = [];
  for (const [key, { excluded, context, registrations }] of wiredSeen) {
    if (excluded) continue;
    for (const registration of registrations) {
      const type = typeOf(registration);
      if (!GESTURE_TYPES.has(type)) {
        if (!NOT_GESTURES.has(type)) unclassified.push(`${key} ${registration} (seen in ${context})`);
        continue;
      }
      if (GESTURES_NOT_PERFORMED.has(type) || coverage.get(key)?.has(registration)) continue;
      missing.push(`${key} ${registration} (seen in ${context})`);
    }
  }
  return { missing, unclassified };
}

function expectGolden(name, text) {
  const path = join(goldenDir, `controls-${name}.txt`);
  if (UPDATING && !ISOLATED) {
    writeFileSync(path, text, 'utf8');
    return;
  }
  expect(existsSync(path), `missing golden ${path}; regenerate with UPDATE_CONTROL_GOLDENS=1`).toBe(true);
  expect(text).toBe(readFileSync(path, 'utf8'));
}

describe('control → bus goldens (TST-04)', () => {
  let digests = null;
  let downloads = [];
  let removePalette = null;
  let narration = [];

  beforeAll(async () => {
    // The entry module is imported before the timers are faked: loading it
    // waits on real ones. `bootApp` defines APP_VERSION too, but only once it
    // is already importing.
    globalThis.APP_VERSION = '0.0.0-test';
    await import('../src/main.js');
    recordWiring();
    watchWiring();
    watchDispatch();
    blurBeforeRemoval();
    installStorage();
    installPointerCapture();
    removePalette = applyMapPalette();
    document.addEventListener('click', noteFileDialog, true);
    digests = answerDigestsAtOnce();
    downloads = [...watchDownloads(), watchAlerts()];
    // The app narrates itself to the console, thousands of lines across these
    // rows. None of it is what they pin; warnings and errors still reach the
    // guard, and each context declares those it provokes.
    narration = ['log', 'info', 'debug'].map(level => vi.spyOn(console, level).mockImplementation(() => {}));
    growingMocks.push(...narration, ...downloads, digests);
  });

  // Only a context's own test notes wiring into the inventory.
  afterEach(() => {
    inventoryContext = null;
  });

  afterAll(() => {
    unwatchDispatch();
    wiringObserver?.disconnect();
    restoreRemovalBlur?.();
    uninstallStorage();
    uninstallPointerCapture();
    EventTarget.prototype.addEventListener = originalAddEventListener;
    EventTarget.prototype.removeEventListener = originalRemoveEventListener;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    window.addEventListener = originalWindowAddEventListener;
    document.removeEventListener('click', noteFileDialog, true);
    removePalette?.();
    digests?.mockRestore();
    for (const spy of [...downloads, ...narration]) spy.mockRestore();
    growingMocks.length = 0;
    delete navigator.clipboard;
    vi.useRealTimers();
  });

  for (const context of CONTEXTS) {
    test(`${context.name}: ${context.about}`, async () => {
      allowConsole(...(context.logs ?? []));
      vi.useFakeTimers(FAKE_TIMERS);
      installClipboard(context.clipboard ?? copying);
      const stub = context.stub?.();
      inventoryContext = context.name;
      let session = await startSession(context);
      noteWiring();

      const sections = [`# ${context.name}: ${context.about}`];
      for (const key of controlsOf(context)) {
        const element = elementAt(key);
        const control = controlOf(element, key);
        // What each option reveals is pinned where the control is first
        // operated; a repeated context needs one write to show whom it reaches.
        const operations = operationsFor(element)
          .filter(operation => !context.only || context.only.includes(operation.label))
          .slice(0, context.values ? 1 : undefined);
        for (const operation of operations) {
          const { lines, settled } = await runRow(session, key, operation, `${context.name} ${key} ${operation.label}`);
          noteCoverage(session.invoked);
          recordedLabels.add(`${control} · ${operation.label}`);
          if (!operation.notOperated) operatedControls.add(control);
          sections.push(`\n## ${key} · ${operation.label}${lines.length ? `\n${lines.join('\n')}` : ''}`);
          // Controls a row creates (a handle, an editor) are wired too.
          noteWiring();
          session = await restore(session, elementAt(key), operation, settled);
        }
      }
      // The watcher describes each element again only after a mutation reaches
      // it; had one been missed, what it holds would differ from a full read.
      const watched = session.ui.capture({ complete: true });
      session.ui.disconnect();
      expect(uiChanges(uiState(document.body, { opaque: OUTLINE, complete: true }), watched)).toEqual([]);
      const registered = session.listeners;
      retire(session);
      expect(registered.length, 'the app registered its document and window listeners').toBeGreaterThan(0);
      stub?.mockRestore();
      expectGolden(context.name, `${sections.join('\n')}\n`);
    }, 180_000);
  }

  test('every wired control has a row that runs each listener it has for a gesture, or a reason it has none', () => {
    // Were the wiring not recorded, nothing would be missing either: the app
    // wires about 300 elements across these contexts.
    expect(inventory.wiredSeen.size).toBeGreaterThan(200);
    const { missing, unclassified } = inventoryGaps();
    expect(unclassified).toEqual([]);
    expect(missing).toEqual([]);
  });

  test('a row is credited only with the listeners its gesture ran, in their phase', () => {
    const parent = document.createElement('div');
    const button = document.createElement('button');
    const field = document.createElement('input');
    parent.append(button, field);
    document.body.append(parent);
    const parentKey = controlOf(parent);
    const ran = [];
    button.addEventListener('click', () => ran.push('button click'));
    // Stopped on the way down, the click never reaches the button.
    parent.addEventListener('click', event => event.stopPropagation(), true);
    // `blur` does not bubble: the parent hears a child's only on the way down.
    parent.addEventListener('blur', () => ran.push('parent blur'));
    parent.addEventListener('blur', () => ran.push('parent blur, on the way down'), true);
    // A row a drop replaced still hears its drag end, off the page.
    const leaving = document.createElement('div');
    parent.append(leaving);
    const leavingKey = controlOf(leaving);
    leaving.addEventListener('dragstart', () => leaving.remove());
    leaving.addEventListener('dragend', () => ran.push('dragend, off the page'));
    invoked = [];
    dispatchKeys = new WeakMap();
    let ranByRow;
    try {
      button.click();
      field.focus();
      field.blur();
      leaving.dispatchEvent(new Event('dragstart', { bubbles: true }));
      leaving.dispatchEvent(new Event('dragend', { bubbles: true }));
    } finally {
      ranByRow = invoked;
      invoked = null;
      parent.remove();
    }
    expect(ran).toEqual(['parent blur, on the way down', 'dragend, off the page']);
    const here = /^(.+) at tests\/goldenControls\.test\.js:\d+:\d+$/;
    expect(ranByRow.map(({ control, registration }) => ({ control, registration: registration.match(here)?.[1] }))).toEqual([
      { control: parentKey, registration: 'click (capture)' },
      { control: parentKey, registration: 'blur (capture)' },
      { control: leavingKey, registration: 'dragstart' },
      { control: leavingKey, registration: 'dragend' },
    ]);
  });

  test('two listeners for one gesture on one element, added by different code, are two registrations: one a stopped propagation keeps from running is not credited', () => {
    const button = document.createElement('button');
    document.body.append(button);
    const ran = [];
    button.addEventListener('click', (event) => { ran.push('first'); event.stopImmediatePropagation(); });
    button.addEventListener('click', () => ran.push('second'));
    invoked = [];
    let ranByRow;
    try {
      button.click();
    } finally {
      ranByRow = invoked.map(({ registration }) => registration);
      invoked = null;
      button.remove();
    }
    const wired = [...wiredSites.get(button)];
    expect(ran).toEqual(['first']);
    expect(wired).toHaveLength(2);
    expect(wired.filter(identity => !ranByRow.includes(identity))).toHaveLength(1);
  });

  test('two listeners for one gesture on one element, added by the same line of code, are two registrations: one a stopped propagation keeps from running is not credited', () => {
    const button = document.createElement('button');
    document.body.append(button);
    const ran = [];
    const listeners = [
      (event) => { ran.push('first'); event.stopImmediatePropagation(); },
      () => ran.push('second'),
    ];
    for (const listener of listeners) button.addEventListener('click', listener);
    invoked = [];
    let ranByRow;
    try {
      button.click();
    } finally {
      ranByRow = invoked.map(({ registration }) => registration);
      invoked = null;
      button.remove();
    }
    const wired = [...wiredSites.get(button)];
    expect(ran).toEqual(['first']);
    expect(wired).toHaveLength(2);
    expect(wired.filter(identity => !ranByRow.includes(identity))).toEqual([`${ranByRow[0]} (listener 2)`]);
  });

  test('at one line of code, a listener added again is one registration, and one added once another has been removed, has run once or was aborted takes its place', () => {
    const button = document.createElement('button');
    document.body.append(button);
    const add = (listener, options) => button.addEventListener('click', listener, options);
    const wired = () => wiredSites.get(button).size;
    const controller = new AbortController();
    try {
      const kept = () => {};
      add(kept);
      add(kept);
      expect(wired(), 'the same listener added again').toBe(1);
      const removed = () => {};
      add(removed);
      expect(wired(), 'another beside it').toBe(2);
      button.removeEventListener('click', removed);
      add(() => {});
      expect(wired(), 'one in the place of one removed').toBe(2);
      add(() => {}, { once: true });
      expect(wired(), 'a third beside them').toBe(3);
      button.click();
      add(() => {});
      expect(wired(), 'one in the place of one that ran once').toBe(3);
      add(() => {}, { signal: controller.signal });
      expect(wired(), 'a fourth beside them').toBe(4);
      controller.abort();
      add(() => {});
      expect(wired(), 'one in the place of one aborted').toBe(4);
      add(() => {}, { signal: controller.signal });
      expect(wired(), 'one with an aborted signal, which is not added').toBe(4);
    } finally {
      button.remove();
    }
  });

  test('a listener a drag\'s commit adds to a busyness field, which the row\'s own undo then replaces, is in the inventory, noted while the field stood', async () => {
    // The row replays its history before it ends, and the replay rebuilds the
    // busyness fields: a scan of the page after the row finds only the new
    // ones. The field is noted as the listener is added, where it stands.
    vi.useFakeTimers(FAKE_TIMERS);
    installClipboard(copying);
    const kept = inventory;
    inventory = newInventory();
    inventoryContext = 'crowd';
    const session = await startSession(CONTEXTS.find(each => each.name === 'crowd'));
    const { app } = session;
    const announce = app.announce;
    let wired = null;
    let control = null;
    const spy = vi.spyOn(app, 'announce').mockImplementation(function announceAndWire(message, ...rest) {
      if (String(message).startsWith('Busyness handle moved')) {
        wired = document.querySelector('#crowd-busyness-handles input[data-busyness-field="value"]');
        control = controlOf(wired);
        wired.addEventListener('dblclick', () => { throw new Error('a listener no row runs'); });
      }
      return announce.call(this, message, ...rest);
    });
    try {
      await runRow(session, keyFor(document.querySelector(BUSYNESS_GRAPH)), END_HANDLE_DRAGS[0], 'crowd: a drag whose commit wires a field');
      noteCoverage(session.invoked);
      expect(wired, 'the drag was committed').not.toBeNull();
      expect(wired.readOnly || wired.disabled, 'a user can double-click the field').toBe(false);
      expect(wired.isConnected, 'undoing the drag replaced the field').toBe(false);
      const scanned = inventory;
      inventory = newInventory();
      noteWiring();
      const scanAfter = [...(inventory.wiredSeen.get(control)?.registrations ?? [])];
      inventory = scanned;
      expect(scanAfter.filter(identity => identity.startsWith('dblclick')), 'a scan after the row').toEqual([]);
      const { missing } = inventoryGaps();
      expect(missing.filter(line => line.startsWith(`${control} dblclick`))).toEqual([
        expect.stringMatching(new RegExp(`^${control.replace(/[[\]>]/g, '\\$&')} dblclick at tests/goldenControls\\.test\\.js:\\d+:\\d+ \\(seen in crowd\\)$`)),
      ]);
    } finally {
      spy.mockRestore();
      inventory = kept;
      inventoryContext = null;
      session.ui.disconnect();
      retire(session);
    }
  }, 60_000);

  test('a drag\'s data can be read where a browser lets a page read it: written at dragstart, read at drop, only its formats seen in between', () => {
    const { transfer, sending } = dragData();
    sending('dragstart');
    transfer.setData('Text', '3');
    transfer.effectAllowed = 'move';
    expect(transfer.getData('text/plain')).toBe('3');
    for (const type of ['dragenter', 'dragover', 'dragleave', 'dragend']) {
      sending(type);
      expect(transfer.getData('text/plain'), type).toBe('');
      expect(transfer.types, type).toEqual(['text/plain']);
      transfer.setData('text/plain', 'changed');
      transfer.clearData();
      transfer.effectAllowed = 'copy';
    }
    sending('drop');
    expect(transfer.getData('text/plain')).toBe('3');
    transfer.setData('text/plain', 'changed');
    transfer.clearData('text/plain');
    transfer.effectAllowed = 'copy';
    expect(transfer.getData('text')).toBe('3');
    expect(transfer.effectAllowed).toBe('move');
  });

  test('a drag is dropped only where the page accepts an operation its source allows', () => {
    const dragover = accepted => ({ defaultPrevented: accepted });
    const cases = [
      ['move', 'move', true], ['none', 'move', false], ['copy', 'move', false], ['copyMove', 'move', true],
      ['uninitialized', 'move', true], ['all', 'link', true], ['move', 'none', false],
    ].map(([effectAllowed, dropEffect]) => dropAccepted(dragover(true), { effectAllowed, dropEffect }));
    expect(cases).toEqual([true, false, false, true, true, true, false]);
    expect(dropAccepted(dragover(false), { effectAllowed: 'move', dropEffect: 'move' })).toBe(false);
  });

  test('a pointer capture let go of while pointerup is sent is lost once pointerup has been sent', async () => {
    const handle = document.createElement('div');
    document.body.append(handle);
    const heard = [];
    handle.addEventListener('pointerdown', event => handle.setPointerCapture(event.pointerId));
    handle.addEventListener('pointerup', (event) => {
      heard.push('up begins');
      handle.releasePointerCapture(event.pointerId);
      heard.push('up ends');
    });
    handle.addEventListener('lostpointercapture', () => heard.push('capture lost'));
    try {
      pointer(handle, 'pointerdown');
      pointer(document.body, 'pointerup');
    } finally {
      handle.remove();
      await takeBrowserRequests();
    }
    expect(heard).toEqual(['up begins', 'up ends', 'capture lost']);
  });

  test('a pointer capture let go of while an event is sent is no longer held from then, and one taken again before the event ends is kept', async () => {
    const handle = document.createElement('div');
    document.body.append(handle);
    const heard = [];
    const held = event => handle.hasPointerCapture(event.pointerId);
    handle.addEventListener('pointerdown', event => handle.setPointerCapture(event.pointerId));
    handle.addEventListener('pointermove', (event) => {
      handle.releasePointerCapture(event.pointerId);
      heard.push(`move: held once let go, ${held(event)}`);
      handle.setPointerCapture(event.pointerId);
      heard.push(`move: held once taken again, ${held(event)}`);
    });
    handle.addEventListener('pointerup', (event) => {
      handle.releasePointerCapture(event.pointerId);
      heard.push(`up: held once let go, ${held(event)}`);
    });
    handle.addEventListener('lostpointercapture', () => heard.push('capture lost'));
    try {
      pointer(handle, 'pointerdown');
      pointer(document.body, 'pointermove');
      pointer(document.body, 'pointerup');
    } finally {
      handle.remove();
      await takeBrowserRequests();
    }
    expect(heard).toEqual([
      'move: held once let go, false', 'move: held once taken again, true', 'up: held once let go, false', 'capture lost',
    ]);
  });

  test('a press, a double-click and a removal go as Chromium 152 sends them: focus moves as the button goes down, unless the page cancels it', () => {
    // Each sequence is the one Chromium 152 sent for a real mouse in the same
    // page, less the pointer's arrival (hover), which rows do not send.
    const page = document.createElement('div');
    document.body.append(page);
    const make = (tag, id, parent = page) => {
      const element = document.createElement(tag);
      element.id = id;
      parent.append(element);
      return element;
    };
    const field = make('input', 'field');
    const play = make('button', 'play');
    const plain = make('div', 'plain');
    make('button', 'nodown').addEventListener('pointerdown', event => event.preventDefault());
    make('button', 'nomouse').addEventListener('mousedown', event => event.preventDefault());
    const list = make('ul', 'list');
    const rebuild = () => {
      list.replaceChildren();
      make('button', 'row', make('li', 'item', list));
    };
    rebuild();
    list.addEventListener('click', rebuild);
    // Named, not given an id: what takes its place stands where it stood.
    const named = (name) => {
      const button = document.createElement('button');
      button.dataset.name = name;
      return button;
    };
    const replaced = make('div', 'slot').appendChild(named('replaced'));
    replaced.addEventListener('mousedown', () => replaced.replaceWith(named('replacement')));
    const types = ['pointerdown', 'mousedown', 'blur', 'focusout', 'focus', 'focusin', 'pointerup', 'mouseup', 'click', 'dblclick', 'contextmenu'];
    const heard = [];
    const hear = (event) => {
      const name = element => (element === document.body ? 'body' : element?.id || element?.dataset?.name);
      const count = event instanceof MouseEvent && !event.type.startsWith('pointer') ? ` ×${event.detail}` : '';
      heard.push(`${event.type} ${name(event.target)}${count}, focus on ${name(document.activeElement)}${event.target.isConnected ? '' : ', off the page'}`);
    };
    for (const type of types) originalWindowAddEventListener.call(window, type, hear, true);
    const sent = (run) => {
      heard.length = 0;
      run();
      return [...heard];
    };
    try {
      field.focus();
      expect(sent(() => press(play)), 'a press on a button, with a field focused').toEqual([
        'pointerdown play, focus on field', 'mousedown play ×1, focus on field',
        'blur field, focus on body', 'focusout field, focus on body', 'focus play, focus on play', 'focusin play, focus on play',
        'pointerup play, focus on play', 'mouseup play ×1, focus on play', 'click play ×1, focus on play',
      ]);
      expect(sent(() => press(plain)), 'a press on plain text').toEqual([
        'pointerdown plain, focus on play', 'mousedown plain ×1, focus on play',
        'blur play, focus on body', 'focusout play, focus on body',
        'pointerup plain, focus on body', 'mouseup plain ×1, focus on body', 'click plain ×1, focus on body',
      ]);
      play.focus();
      expect(sent(() => press(document.getElementById('nodown'))), 'pointerdown cancelled').toEqual([
        'pointerdown nodown, focus on play', 'pointerup nodown, focus on play', 'click nodown ×1, focus on play',
      ]);
      expect(sent(() => press(document.getElementById('nomouse'))), 'mousedown cancelled').toEqual([
        'pointerdown nomouse, focus on play', 'mousedown nomouse ×1, focus on play',
        'pointerup nomouse, focus on play', 'mouseup nomouse ×1, focus on play', 'click nomouse ×1, focus on play',
      ]);
      document.activeElement.blur();
      expect(sent(() => doubleClick(play)), 'a double-click').toEqual([
        'pointerdown play, focus on body', 'mousedown play ×1, focus on body', 'focus play, focus on play', 'focusin play, focus on play',
        'pointerup play, focus on play', 'mouseup play ×1, focus on play', 'click play ×1, focus on play',
        'pointerdown play, focus on play', 'mousedown play ×2, focus on play',
        'pointerup play, focus on play', 'mouseup play ×2, focus on play', 'click play ×2, focus on play', 'dblclick play ×2, focus on play',
      ]);
      // Each click rebuilds the row: the second press goes to the new one,
      // and its click rebuilds that too, so no `dblclick` follows.
      expect(sent(() => doubleClick(document.getElementById('row'))), 'a double-click on a row each click rebuilds').toEqual([
        'pointerdown row, focus on play', 'mousedown row ×1, focus on play',
        'blur play, focus on body', 'focusout play, focus on body', 'focus row, focus on row', 'focusin row, focus on row',
        'pointerup row, focus on row', 'mouseup row ×1, focus on row', 'click row ×1, focus on row',
        'blur row, focus on body', 'focusout row, focus on body',
        'pointerdown row, focus on body', 'mousedown row ×2, focus on body', 'focus row, focus on row', 'focusin row, focus on row',
        'pointerup row, focus on row', 'mouseup row ×2, focus on row', 'click row ×2, focus on row',
        'blur row, focus on body', 'focusout row, focus on body',
      ]);
      // A control replaced as the button goes down is not clicked; the
      // button comes up over what took its place.
      expect(sent(() => press(replaced)), 'a press whose control is replaced as the button goes down').toEqual([
        'pointerdown replaced, focus on body', 'mousedown replaced ×1, focus on body',
        'pointerup replacement, focus on body', 'mouseup replacement ×1, focus on body',
      ]);
      // Moved, replaced or removed, a focused element is blurred while it is
      // still on the page.
      field.focus();
      expect(sent(() => page.append(field)), 'the focused field moved').toEqual(['blur field, focus on body', 'focusout field, focus on body']);
      field.focus();
      expect(sent(() => field.remove()), 'the focused field removed').toEqual(['blur field, focus on body', 'focusout field, focus on body']);
      expect(field.isConnected).toBe(false);
    } finally {
      for (const type of types) window.removeEventListener(type, hear, true);
      page.remove();
    }
  });

  test('a listener wrapped to note that it ran is added and removed as it would be unwrapped', () => {
    const target = document.createElement('button');
    document.body.append(target);
    const ran = [];
    const listener = () => ran.push('listener');
    const handler = { handleEvent(event) { ran.push(this === handler && event.type); } };
    const controller = new AbortController();
    try {
      target.addEventListener('click', listener);
      target.addEventListener('click', listener);
      target.addEventListener('click', listener, { capture: true });
      target.addEventListener('click', handler);
      target.addEventListener('click', () => ran.push('once'), { once: true });
      target.addEventListener('click', () => ran.push('until aborted'), { signal: controller.signal });
      target.click();
      // Added twice in one phase, a listener runs once; in both phases, twice.
      expect(ran.sort()).toEqual(['click', 'listener', 'listener', 'once', 'until aborted']);

      ran.length = 0;
      controller.abort();
      target.removeEventListener('click', listener);
      target.removeEventListener('click', handler);
      target.click();
      expect(ran).toEqual(['listener']);

      ran.length = 0;
      target.removeEventListener('click', listener, true);
      target.click();
      expect(ran).toEqual([]);
    } finally {
      target.remove();
    }
  });

  test('a click on the selected waypoint\'s row leaves no double-click for the next row to finish', async () => {
    // A second click on the same row within 400 ms renames it (UIController
    // times it), so a row that clicked it must not hand that on.
    const context = CONTEXTS.find(each => each.name === 'major');
    vi.useFakeTimers(FAKE_TIMERS);
    installClipboard(copying);
    let session = await startSession(context);
    const key = keyFor(document.querySelector('#waypoint-list > li.selected > .waypoint-row'));

    const first = await runRow(session, key, click, 'the selected row, clicked');
    session = await restore(session, elementAt(key), click, first.settled);
    const second = await runRow(session, key, click, 'the selected row, clicked');

    expect(second.lines).toEqual(first.lines);
    expect(document.querySelector('.waypoint-rename-input')).toBeNull();
    session.ui.disconnect();
    retire(session);
  }, 60_000);

  test('a click on Play, from a field that has focus, moves focus to Play before Play\'s handler runs, and plays', async () => {
    // Chromium focuses a pressed button as the mouse button goes down, before
    // its click, so a handler that reads focus finds Play focused and the
    // field already blurred; `click()` alone would leave focus in the field.
    vi.useFakeTimers(FAKE_TIMERS);
    installClipboard(copying);
    const session = await startSession(CONTEXTS.find(each => each.name === 'route'));
    const { app } = session;
    const field = document.getElementById('export-res-x');
    const heard = [];
    const focusNow = () => (document.activeElement === document.body ? 'body' : keyFor(document.activeElement));
    field.focus();
    field.addEventListener('blur', () => heard.push(`field blurred, focus on ${focusNow()}`));
    const emit = app.eventBus.emit;
    app.eventBus.emit = function heardEmit(name, ...args) {
      if (name === 'ui:animation:play') heard.push(`play asked for, focus on ${focusNow()}`);
      return emit.call(this, name, ...args);
    };
    try {
      click.run(document.getElementById('play-btn'));
      await settle(3);
      expect(heard).toEqual(['field blurred, focus on body', 'play asked for, focus on #play-btn']);
      expect(app.animationEngine.state.isPlaying, 'playing').toBe(true);
    } finally {
      app.eventBus.emit = emit;
      session.ui.disconnect();
      retire(session);
    }
  }, 60_000);

  test('a text selection a row leaves is put back, so the next row types where a fresh app would', async () => {
    const context = CONTEXTS.find(each => each.name === 'major');
    vi.useFakeTimers(FAKE_TIMERS);
    installClipboard(copying);
    const key = '#waypoint-label';
    const selecting = { label: 'select its text', run: (field) => { field.focus(); field.select(); field.blur(); } };
    const typing = { label: 'type "Z"', run: (field) => { field.focus(); typeIntoFocused('Z'); field.blur(); } };

    let session = await startSession(context);
    const reused = session.app;
    const selected = await runRow(session, key, selecting, 'select its text');
    expect(selected.lines.join('\n')).not.toContain('selection');
    session = await restore(session, elementAt(key), selecting, selected.settled);
    if (!ISOLATED) expect(session.app, 'the reload put the session back').toBe(reused);
    const afterReset = await runRow(session, key, typing, 'type "Z"');
    session.ui.disconnect();
    retire(session);

    const fresh = await startSession(context);
    const inFresh = await runRow(fresh, key, typing, 'type "Z"');
    fresh.ui.disconnect();
    retire(fresh);
    expect(afterReset.lines).toEqual(inFresh.lines);
  }, 60_000);

  test('a row whose undo does not put the project back fails, and so does one whose redo does not make it again', async () => {
    // What an entry holds, and that undoing it puts it back, is compared, not
    // only that there is an entry.
    vi.useFakeTimers(FAKE_TIMERS);
    installClipboard(copying);
    const session = await startSession(CONTEXTS.find(each => each.name === 'major'));
    const { app } = session;
    const recorded = async () => {
      const history = app.undoService.createSnapshot();
      app.eventBus.emit('waypoint:add', { imgX: 0.4, imgY: 0.6, isMajor: true });
      await settle();
      expect(app.undoService.createSnapshot().undoStack.length).toBe(history.undoStack.length + 1);
      return history;
    };
    const spies = [];
    try {
      spies.push(vi.spyOn(app, 'undo').mockImplementation(() => {}));
      await expect(expectHistoryRestores(session, 'an undo that does nothing', await recorded()))
        .rejects.toThrow('an undo that does nothing: undone, the project is not as it was before the row');
      spies.pop().mockRestore();
      spies.push(vi.spyOn(app, 'redo').mockImplementation(() => {}));
      await expect(expectHistoryRestores(session, 'a redo that does nothing', await recorded()))
        .rejects.toThrow('a redo that does nothing: undone and redone, the project is not what the row made it');
    } finally {
      for (const spy of spies) spy.mockRestore();
      session.ui.disconnect();
      retire(session);
    }
  }, 60_000);

  test('undone and redone, a marker change to a mixed selection gets all three selected waypoints back, and a redo that keeps only one of them fails', async () => {
    // The saved project holds no selection; what history holds does, and the
    // redo is compared with it too.
    vi.useFakeTimers(FAKE_TIMERS);
    installClipboard(copying);
    const session = await startSession(CONTEXTS.find(each => each.name === 'mixed'));
    const { app } = session;
    const selected = () => app.selectedWaypoints.map(waypoint => app.waypoints.indexOf(waypoint));
    expect(selected()).toEqual([MINOR, OTHER_MAJOR, MAJOR]);
    const redo = app.redo;
    let spy = null;
    try {
      // The row as the mixed golden runs it, whose history `runRow` replays.
      const markerStyle = singleGestures(document.getElementById('marker-style')).find(each => each.label === 'choose "dot"');
      await runRow(session, '#marker-style', markerStyle, 'mixed #marker-style choose "dot", undone and redone');
      expect(selected(), 'the selection, once the row was undone and redone').toEqual([MINOR, OTHER_MAJOR, MAJOR]);
      // A redo that brings back only the first of them.
      spy = vi.spyOn(app, 'redo').mockImplementation(function redoKeepingOne(...args) {
        const result = redo.apply(this, args);
        this.selectedWaypoints = this.selectedWaypoints.slice(0, 1);
        return result;
      });
      const history = app.undoService.createSnapshot();
      choose('marker-style', 'square');
      await settle();
      expect(app.undoService.createSnapshot().undoStack.length, 'the change recorded an entry').toBe(history.undoStack.length + 1);
      await expect(expectHistoryRestores(session, 'a redo that keeps one', history))
        .rejects.toThrow('a redo that keeps one: undone and redone, what history holds is not what the row made it');
    } finally {
      spy?.mockRestore();
      session.ui.disconnect();
      retire(session);
    }
  }, 60_000);

  test('an app retired with a name field open and focused leaves the next app whole', async () => {
    vi.useFakeTimers(FAKE_TIMERS);
    installClipboard(copying);
    const session = await startSession(CONTEXTS.find(each => each.name === 'crowd'));
    document.querySelector('#layers-strip > li:nth-child(2) > button')
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect(document.activeElement).toBeInstanceOf(HTMLInputElement);
    const retired = session.app;
    session.ui.disconnect();
    retire(session);
    expect(window.app).not.toBe(retired);

    const next = await startSession(CONTEXTS.find(each => each.name === 'route'));
    const menu = document.getElementById('file-menu');
    document.getElementById('file-dropdown-btn').click();
    expect(menu.classList.contains('is-open')).toBe(true);
    document.getElementById('file-dropdown-btn').click();
    expect(menu.classList.contains('is-open')).toBe(false);
    next.ui.disconnect();
    retire(next);
  }, 60_000);

  test('the only sidebar click that reads a modifier key is a waypoint row\'s, and it has rows', () => {
    // Every read of a modifier key in the app, by file. The keyboard's are
    // TST-13's; the canvas's are its own suites'; the bus payloads that carry
    // one come from the canvas. A new one fails here until it is placed.
    const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
    const reads = {};
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith('.js')) {
          const count = (readFileSync(path, 'utf8').match(/\.(?:shiftKey|metaKey|ctrlKey|altKey)\b/g) ?? []).length;
          if (count) reads[relative(srcDir, path)] = count;
        }
      }
    };
    walk(srcDir);
    expect(reads).toEqual(MODIFIER_READS);
    // Counting reads is no test of them: each modifier is a row, on a major's
    // row and a minor's, and what each did is in the goldens.
    for (const role of ['major', 'minor']) {
      for (const label of [shiftClicking.label, commandClicking.label, controlClicking.label]) {
        expect(recordedLabels.has(`#waypoint-list>li[${role}]>button[0] · ${label}`), `${role} ${label}`).toBe(true);
      }
    }
  });
});
