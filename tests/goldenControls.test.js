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
 * shown and its card is open: a range is set and released, a select chooses
 * each of its other options, a number or text field is given its new value
 * and committed, a file input is given a file, a radio already chosen is
 * chosen from another of its group as well, a control that renames on a
 * double click is double-clicked, and renamed (typed into where the app put
 * the selection) and clicked away from, a waypoint row is Shift-, Cmd- and
 * Ctrl-clicked too, a list row is dragged (onto either half of the next
 * major's row, onto the minor's, and let go outside the list), the busyness
 * graph is dragged by a handle (inside it, out of it, and cancelled; its
 * middle handle along and past each neighbour), and anything else is clicked.
 * Drags and pointer drags go as Chromium sends them: a drop only where the
 * page accepted the drag, and a pointer's events to whatever holds its
 * capture. A disabled or read-only control is listed, not operated. The row
 * records:
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
 * stated reason excuses it, and it watches for controls a row itself creates.
 * Each such listener is wrapped as it is added, so a row is credited with the
 * listeners its gesture ran, not with where its events went (an event stopped
 * on the way, or one that does not bubble, reaches no listener past that
 * point); and every event type the app listens for on a control is either a
 * gesture or says what it is instead. A waypoint row is a major's, a minor's
 * or the add row, and a layer row the route's or a crowd's: each is its own
 * control, whatever its position. Keyboard gestures belong to the key table
 * (TST-13), and are excused by gesture, not by a click row.
 *
 * Regenerate deliberately: `UPDATE_CONTROL_GOLDENS=1 npx vitest run
 * tests/goldenControls.test.js`, read the diff, then run it once more with
 * `CONTROL_GOLDENS_ISOLATED=1`.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
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
const identityOf = (registration, site) => `${registration} at ${site}`;

/** Each element's registrations, by where each was added (`registrationSite`). */
const wiredSites = new WeakMap();

/**
 * Where each of an element's listeners was added, by registration: one
 * listener added to two elements by two lines of code is credited, on each,
 * to its own line.
 */
const listenerSites = new WeakMap();
const siteFor = (element, registration, listener) => listenerSites.get(element)?.get(registration)?.get(listener) ?? 'an unknown place';

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
  if (!invoked) return;
  const key = dispatchKeys.get(element) ?? keyFor(element);
  const registration = registrationOf(event.type, capture);
  invoked.push({ control: controlOf(element, key), registration: identityOf(registration, siteFor(element, registration, listener)) });
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
    if (this instanceof Element) {
      const registration = registrationOf(type, captureOf(options));
      const site = registrationSite();
      if (!wiredEvents.has(this)) wiredEvents.set(this, new Set());
      wiredEvents.get(this).add(registration);
      if (!wiredSites.has(this)) wiredSites.set(this, new Set());
      wiredSites.get(this).add(identityOf(registration, site));
      if (!listenerSites.has(this)) listenerSites.set(this, new Map());
      const sites = listenerSites.get(this);
      if (!sites.has(registration)) sites.set(registration, new Map());
      sites.get(registration).set(listener, site);
    }
    const outlasting = this === document || this === window || this === document.body;
    if (owner && (this instanceof HTMLCanvasElement || (outlasting && !new Error().stack.includes('ParamTooltip.js')))) {
      owner.listeners.push({ target: this, type, listener, options });
    }
    const registered = wraps(this, type, listener) ? wrapperFor(listener, captureOf(options)) : listener;
    return originalAddEventListener.call(this, type, registered, options);
  };
  EventTarget.prototype.removeEventListener = function removeEventListener(type, listener, options) {
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
        if (pointerCaptures.get(pointerId) === this) return;
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
        return pointerCaptures.get(pointerId) === this;
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
function pointer(under, type, { pointerId = 1, clientX = 0, clientY = 0 } = {}) {
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

/** A range is set a third of the way along its track (two thirds, if it is there already). */
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
 * A double-click as a pointer gives it: each click goes to what is under the
 * pointer then. A first click that rebuilds its control (a list redrawn as it
 * selects) leaves the second click, and the double-click, to what took its
 * place.
 */
function doubleClick(element) {
  const key = keyFor(element);
  element.click();
  const target = element.isConnected ? element : (elementAt(key) ?? element);
  target.click();
  target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
}

/** Toggles are undone by the same gesture, which spares a reload. */
const click = { label: 'click', run: element => element.click() };
const toggle = { ...click, undo: element => element.click() };
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
    // A waypoint row opens it a frame later, once the list is rebuilt.
    let field = elementAt(key)?.querySelector('input');
    for (let frame = 0; !field && frame < 3; frame += 1) {
      vi.advanceTimersToNextTimer();
      field = elementAt(key)?.querySelector('input');
    }
    if (!field) throw new Error(`${key}: a double-click opened no name field`);
    typeIntoFocused('Renamed');
    // A click away takes focus from the field, wherever it is.
    document.activeElement?.blur();
  },
};

/**
 * The only click handler in the sidebar that reads a modifier key: a waypoint
 * row's, where Shift selects the rows between and Cmd or Ctrl adds or removes
 * one (see `the only sidebar click that reads a modifier`).
 */
const MODIFIED_CLICKS = '.waypoint-row:not(.waypoint-add-btn)';
const modifiedClick = (label, modifiers) => ({
  label,
  run: element => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...modifiers })),
});
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
    prepare: () => elementAt(otherKey).click(),
    run: element => element.click(),
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

/** What a drag carries, as far as a page can see it. */
function dragData() {
  const data = new Map();
  return {
    effectAllowed: 'uninitialized',
    dropEffect: 'none',
    get types() { return [...data.keys()]; },
    setData: (format, value) => { data.set(format, String(value)); },
    getData: format => data.get(format) ?? '',
    clearData: (format) => { if (format === undefined) data.clear(); else data.delete(format); },
    setDragImage() {},
  };
}

/** The list's rows in the order it shows them, by title (the add row has none). */
const listShown = () => [...document.getElementById('waypoint-list').children]
  .map(row => row.querySelector('.waypoint-title')?.textContent ?? '(add)')
  .join(', ');

/**
 * Drag a row by its handle, as Chromium sends the drag: `dragstart` at the
 * row; `dragenter` and `dragover` at the row under the pointer, over the half
 * given; there, a `drop` only if the page cancelled that `dragover` (so
 * accepting it) and left it an effect the drag's source allows, or else a
 * `dragleave`; and last,
 * `dragend` at the row it began from, though its drop may have rebuilt the
 * list. `away` takes the pointer out of the list before letting go, over the
 * page, which accepts no drop. The row records where the list shows the
 * block while the pointer is over its target: where it will land.
 */
function dragging(label, ontoOf, { half, away = false }) {
  return {
    label,
    run: (row) => {
      const onto = ontoOf(row);
      if (!onto) throw new Error(`${keyFor(row)}: nothing to drag onto`);
      const transfer = dragData();
      const send = (target, type, clientY = 0) => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: type !== 'dragleave' && type !== 'dragend', clientY });
        Object.defineProperty(event, 'dataTransfer', { value: transfer });
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
        if (send(row, 'dragstart').defaultPrevented) return;
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
 * outside it.
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
        pointer(handle, 'pointerdown', { clientX: moves[0][0], clientY: moves[0][1] });
        for (const move of moves) pointer(under(move), 'pointermove', { clientX: move[0], clientY: move[1] });
        const last = moves.at(-1);
        pointer(under(last), finish, { clientX: last[0], clientY: last[1] });
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
      .map(option => ({ label: `choose ${JSON.stringify(option.value)}`, run: each => commit(each, option.value) }));
  }
  if (element instanceof HTMLInputElement) {
    switch (element.type) {
      case 'range': {
        const target = rangeTarget(element);
        return [{ label: `set ${target}`, run: each => commit(each, String(target)) }];
      }
      case 'number':
        return [
          { label: 'enter 24', run: each => commit(each, '24') },
          { label: 'enter 99999', run: each => commit(each, '99999') },
        ];
      case 'text':
        return [{ label: 'type "Typed"', run: each => commit(each, 'Typed') }];
      case 'color':
        return [{ label: 'pick #56b4e9', run: each => commit(each, '#56b4e9') }];
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

/**
 * The control an element is, from its key (`keyFor`'s, or the one it had when
 * an event reached it). A list's rows are instances of a few controls,
 * whichever position a row stands at, so the position gives way to the row's
 * role: a waypoint row is a major's, a minor's or the add row, and a layer
 * row the route's (the first) or a crowd's.
 */
function controlOf(element, key = keyFor(element)) {
  return key
    .replace(/^#layers-strip>li\[(\d+)\]/, (_, index) => `#layers-strip>li[${index === '0' ? 'route' : 'crowd'}]`)
    .replace(/^#waypoint-list>li\[\d+\]/, () => `#waypoint-list>li[${waypointRowRole(element)}]`);
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
  const history = session.app.undoService.createSnapshot().lastState;
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
  const recorded = session.app.undoService.createSnapshot().lastState !== history;
  if (!session.context.running && recorded && session.app.undoService.canUndo()) {
    await expectHistoryRestores(session, name);
    settledComplete = capture(session, { complete: true });
  }
  random.mockRestore();
  if (later.length > 0) lines.push('settled:', ...later.map(line => `  ${line}`));
  return { lines, settled: settledComplete };
}

/**
 * A row that recorded an entry for undo, and can be undone: undone, then
 * redone, the project is what the row made it. What an entry holds, not only that there is one. A
 * waypoint's `modified` stamp is not compared: every waypoint made, from a
 * history entry as from a file, is stamped when it is made, and the stamp
 * is never read back.
 */
async function expectHistoryRestores(session, name) {
  const made = modelState(session.app);
  session.app.undo();
  await settle();
  session.app.redo();
  await settle();
  vi.clearAllTimers();
  session.emits.take();
  await takeBrowserRequests();
  const differences = modelChanges(made, modelState(session.app))
    .filter(line => !/^model ~ waypoints\[\d+\]\.modified: /.test(line));
  expect(differences, `${name}: undone and redone, the project is not what the row made it`).toEqual([]);
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
 * Every control seen wired for a user gesture, with its registrations, and
 * every registration a row's gesture ran, by control.
 */
const wiredSeen = new Map();
const coverage = new Map();
/** Each control and gesture a row has recorded, as `control · label`. */
const recordedLabels = new Set();
/** The controls rows have operated. */
const operatedControls = new Set();

function noteWiring(context) {
  for (const element of document.querySelectorAll('*')) {
    const registrations = wiredSites.get(element);
    if (!registrations) continue;
    const key = controlOf(element);
    const seen = wiredSeen.get(key) ?? { excluded: exclusionFor(element), context: context.name, registrations: new Set() };
    for (const registration of registrations) seen.registrations.add(registration);
    wiredSeen.set(key, seen);
  }
}

/** Credit what a row's gesture ran: each listener's registration, to the control it is on. */
function noteCoverage(invocations) {
  for (const { control, registration } of invocations) {
    if (!coverage.has(control)) coverage.set(control, new Set());
    coverage.get(control).add(registration);
  }
}

/**
 * The registrations for a gesture no row ran and nothing excuses, and those
 * of a type that is neither a gesture nor said to be something else.
 */
function inventoryGaps() {
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
    watchDispatch();
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

  afterAll(() => {
    unwatchDispatch();
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
      let session = await startSession(context);
      noteWiring(context);

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
          noteWiring(context);
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
    expect(wiredSeen.size).toBeGreaterThan(200);
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
