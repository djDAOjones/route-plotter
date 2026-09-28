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
 * each of its other options, a number or text field is typed into and
 * committed, a file input is given a file, a control that renames on a double
 * click is double-clicked as well, and anything else is clicked. A disabled or
 * read-only control is listed, not operated. The row records:
 *
 * - `emit`: each event the handling emitted outside a listener, with its
 *   payload. What the app's listeners emit in turn is the event transcript's
 *   business (TST-05), not the control's.
 * - `file dialog`, `download`, `clipboard`: what it asked of the browser — a
 *   file picker, a file to save (its name, type, size and a checksum of its
 *   bytes), text to copy.
 * - `model`, `app`, `ui`: how the saved project, the app's own flags and the
 *   shell changed once every promise it started had settled.
 * - after `settled:`, what the timers it left then did, each event once, and
 *   anything still pending when the frame budget ran out.
 *
 * Every row starts from its context's baseline. A row is undone by reloading
 * the fixture through the real recovery path and entering the context again;
 * the result must equal the baseline and be at rest, or a fresh app is booted
 * instead (the app does not re-sync every control on load, DEF-20). Equality
 * of what is captured does not prove that nothing else carried over, so
 * `CONTROL_GOLDENS_ISOLATED=1` boots a fresh app for every row, and must
 * reproduce the goldens byte for byte. All timers are fake, the clock is
 * fixed and randomness is seeded, so the rows are deterministic; frames come
 * when the fake clock lets them, so transport rows show the harness's
 * schedule, not a browser's frame timings.
 *
 * `every wired control has a row` fails when an element gets a listener for a
 * user gesture that no row performs on it and no stated reason excuses, and
 * it watches for controls a row itself creates. Keyboard gestures belong to
 * the key table (TST-13), and are excused by gesture, not by a click row.
 *
 * Regenerate deliberately: `UPDATE_CONTROL_GOLDENS=1 npx vitest run
 * tests/goldenControls.test.js`, read the diff, then run it once more with
 * `CONTROL_GOLDENS_ISOLATED=1`.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

const USER_EVENTS = new Set(['click', 'dblclick', 'input', 'change', 'submit', 'contextmenu', 'keydown']);
const wiredEvents = new WeakMap();
const originalAddEventListener = EventTarget.prototype.addEventListener;

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

function recordWiring() {
  EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
    if (USER_EVENTS.has(type) && this instanceof Element) {
      if (!wiredEvents.has(this)) wiredEvents.set(this, new Set());
      wiredEvents.get(this).add(type);
    }
    const outlasting = this === document || this === window || this === document.body;
    if (owner && (this instanceof HTMLCanvasElement || (outlasting && !new Error().stack.includes('ParamTooltip.js')))) {
      owner.listeners.push({ target: this, type, listener, options });
    }
    return originalAddEventListener.call(this, type, listener, options);
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

// ---------------------------------------------------------------------------
// What a row asks of the browser beyond the page: file pickers, saved files,
// copied text.
// ---------------------------------------------------------------------------

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

/** A double click as a browser delivers it: two clicks, then `dblclick`. */
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

const CLICK = ['click'];
const EDIT = ['input', 'change'];

/** Toggles are undone by the same gesture, which spares a reload. */
const click = { label: 'click', events: CLICK, run: element => element.click() };
const toggle = { ...click, undo: element => element.click() };
const doubleClicking = { label: 'double-click', events: ['click', 'dblclick'], run: doubleClick };

/** Rows rename on a double click the app times itself (`UIController`) or hears as `dblclick`. */
const RENAMES_ON_DOUBLE_CLICK = '.waypoint-row';

function operationsFor(element) {
  if (element.disabled) return [{ label: 'disabled, not operated', events: [], run: () => {} }];
  if (element.readOnly) return [{ label: 'read-only, not operated', events: [], run: () => {} }];
  const extra = wiredEvents.get(element)?.has('dblclick') || element.matches(RENAMES_ON_DOUBLE_CLICK)
    ? [doubleClicking] : [];
  return [...singleGestures(element), ...extra];
}

function singleGestures(element) {
  if (element.matches('.section-header, summary, [data-tip], .dropdown-toggle, button[aria-expanded]')) return [toggle];
  if (element instanceof HTMLSelectElement) {
    return [...element.options]
      .filter(option => !option.disabled && option.value !== element.value)
      .map(option => ({ label: `choose ${JSON.stringify(option.value)}`, events: EDIT, run: each => commit(each, option.value) }));
  }
  if (element instanceof HTMLInputElement) {
    switch (element.type) {
      case 'range': {
        const target = rangeTarget(element);
        return [{ label: `set ${target}`, events: EDIT, run: each => commit(each, String(target)) }];
      }
      case 'number':
        return [
          { label: 'enter 24', events: EDIT, run: each => commit(each, '24') },
          { label: 'enter 99999', events: EDIT, run: each => commit(each, '99999') },
        ];
      case 'text':
        return [{ label: 'type "Typed"', events: EDIT, run: each => commit(each, 'Typed') }];
      case 'color':
        return [{ label: 'pick #56b4e9', events: EDIT, run: each => commit(each, '#56b4e9') }];
      case 'file':
        return [
          { label: 'choose nothing', events: ['change'], run: each => chooseFile(each, null) },
          { label: `choose ${pickedFile(element).name}`, events: ['change'], run: each => chooseFile(each, pickedFile(each)) },
        ];
      case 'checkbox':
      case 'radio':
        return [{ ...click, events: ['click', 'input', 'change'] }];
      default:
        return [click];
    }
  }
  return [click];
}

const INTERACTIVE = 'button, input, select, textarea, a[href], summary, [role=button], [data-tip], [role=listitem]';

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
 * context that repeats another's with a different selection.
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
      if (newOnly && operatedBefore(keyFor(element))) continue;
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
 * The control a key stands for. A list's rows are instances of the same
 * controls, whichever row a row happens to add, so their index is dropped.
 */
function controlOf(key) {
  return key.replace(/^(#waypoint-list|#layers-strip)>li\[\d+\]/, '$1>li[*]');
}

/** Whether a row has already performed some gesture on this control. */
function operatedBefore(key) {
  return (coverage.get(controlOf(key))?.size ?? 0) > 0;
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

async function establish(app, context) {
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
  await settle(50);
  app.markClean();
  forgetDrawing(app);
  // A baseline is at rest: anything still pending would run inside the next row.
  return context.running || vi.getTimerCount() === 0;
}

async function openSession(context) {
  const session = { context, listeners: [], canvases: new Set() };
  owner = session;
  session.app = await drive(bootApp().then(async (booted) => {
    await booted.ready;
    return booted;
  }));
  expect(await establish(session.app, context), `${context.name} is still busy after settling`).toBe(true);
  session.emits = recordEmits(session.app);
  return session;
}

/**
 * Stop an app that a fresh one replaces, and take back what it registered on
 * the document and window. `bootApp` stops its apps only when the test ends,
 * and until then a retired app's listeners and timers would act among the new
 * one's.
 */
function retire(session) {
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
  return { model: modelState(session.app), app: appState(session.app), ui: session.ui.capture({ complete }) };
}

function changes(before, after) {
  return [
    ...modelChanges(before.model, after.model),
    ...changedLines(before.app, after.app, 'app'),
    ...uiChanges(before.ui, after.ui),
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

/** Operate one control and record what it did. */
async function runRow(session, element, operation, name) {
  session.emits.take();
  await takeBrowserRequests();
  vi.setSystemTime(ROW_NOW);
  const random = vi.spyOn(Math, 'random').mockImplementation(seededRandom(name));
  operation.run(element);
  await flush();
  const asked = await takeBrowserRequests();
  const after = capture(session);
  const lines = [...session.emits.take(), ...asked, ...changes(session.base, after)];
  await settle();
  const askedLater = await takeBrowserRequests();
  const settled = capture(session);
  const later = [...onceEach(session.emits.take()), ...askedLater, ...changes(after, settled)];
  const pending = vi.getTimerCount();
  if (pending > 0 && !session.context.running) later.push(`still pending after settling: ${pending} timer(s)`);
  const settledComplete = capture(session, { complete: true });
  vi.clearAllTimers();
  random.mockRestore();
  if (later.length > 0) lines.push('settled:', ...later.map(line => `  ${line}`));
  return { lines, settled: settledComplete };
}

/**
 * Put the session back at its baseline, and prove it; boot afresh when a
 * reload cannot, and always in isolated mode.
 */
async function restore(session, element, operation, settled) {
  const complete = { complete: true };
  if (!ISOLATED) {
    if (changes(session.baseComplete, settled).length === 0) return session;
    if (operation.undo && element.isConnected) {
      operation.undo(element);
      await settle();
      const atRest = vi.getTimerCount() === 0;
      vi.clearAllTimers();
      if (atRest && changes(session.baseComplete, capture(session, complete)).length === 0) return session;
    }
    forgetDrawing(session.app);
    const atRest = await establish(session.app, session.context);
    session.emits.take();
    if (atRest && changes(session.baseComplete, capture(session, complete)).length === 0) return session;
  }
  retire(session);
  const fresh = await openSession(session.context);
  fresh.ui = session.ui;
  fresh.base = session.base;
  fresh.baseComplete = session.baseComplete;
  const drift = changes(fresh.baseComplete, capture(fresh, complete));
  expect(drift, `a fresh app in ${session.context.name} does not match the baseline`).toEqual([]);
  return fresh;
}

// ---------------------------------------------------------------------------
// Goldens.
// ---------------------------------------------------------------------------

/**
 * Every element seen wired for a user gesture, and every gesture a row
 * performed on an element.
 */
const wiredSeen = new Map();
const coverage = new Map();

function noteWiring(context) {
  for (const element of document.querySelectorAll('*')) {
    const events = wiredEvents.get(element);
    if (!events) continue;
    const key = controlOf(keyFor(element));
    const seen = wiredSeen.get(key) ?? { excluded: exclusionFor(element), context: context.name, events: new Set() };
    for (const type of events) seen.events.add(type);
    wiredSeen.set(key, seen);
  }
}

function noteCoverage(key, operation) {
  const control = controlOf(key);
  if (!coverage.has(control)) coverage.set(control, new Set());
  for (const type of operation.events) coverage.get(control).add(type);
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
    EventTarget.prototype.addEventListener = originalAddEventListener;
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
      let session = await openSession(context);
      session.ui = watchUi(document.body, { opaque: OUTLINE });
      session.base = capture(session);
      session.baseComplete = capture(session, { complete: true });
      noteWiring(context);

      const sections = [`# ${context.name}: ${context.about}`];
      for (const key of controlsOf(context)) {
        // What each option reveals is pinned where the control is first
        // operated; a repeated context needs one write to show whom it reaches.
        const operations = operationsFor(elementAt(key)).slice(0, context.values ? 1 : undefined);
        for (const operation of operations) {
          const element = elementAt(key);
          noteCoverage(key, operation);
          const { lines, settled } = await runRow(session, element, operation, `${context.name} ${key} ${operation.label}`);
          sections.push(`\n## ${key} · ${operation.label}${lines.length ? `\n${lines.join('\n')}` : ''}`);
          // Controls a row creates (a handle, an editor) are wired too.
          noteWiring(context);
          session = await restore(session, element, operation, settled);
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

  test('every wired control has a row for each gesture, or a reason it has none', () => {
    // Were the wiring not recorded, nothing would be missing either: the app
    // wires about 300 elements across these contexts.
    expect(wiredSeen.size).toBeGreaterThan(200);
    const missing = [];
    for (const [key, { excluded, context, events }] of wiredSeen) {
      if (excluded) continue;
      for (const type of events) {
        if (GESTURES_NOT_PERFORMED.has(type) || coverage.get(key)?.has(type)) continue;
        // (keys here are already controls: `noteWiring` stores them so)
        missing.push(`${key} ${type} (seen in ${context})`);
      }
    }
    expect(missing).toEqual([]);
  });
});
