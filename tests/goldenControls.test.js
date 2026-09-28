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
 * Each row operates one control the way a user does, in a context where the
 * control is shown: a range is set and released, a select chooses each of its
 * other options, a number or text field is typed into and committed, a file
 * input is given a file, and anything else is clicked. A disabled control is
 * listed but not operated. The row records:
 *
 * - `emit`: each event the handling emitted outside a listener, with its
 *   payload. What the app's listeners emit in turn is the event transcript's
 *   business (TST-05), not the control's.
 * - `model`, `app`, `ui`: how the saved project, the app's own flags and the
 *   shell changed once the handling's promises had settled.
 * - after `settled:`, what the timers it left changed: the debounced undo
 *   entry and autosave, the next frame, a toast's timeout.
 *
 * Every row starts from its context's baseline. A row is undone by reloading
 * the fixture through the real recovery path and entering the context again,
 * and the result is compared with the baseline; anything left over (the app
 * does not re-sync every control on load, DEF-20) boots a fresh app instead.
 * All timers are fake and the clock is fixed, so the rows are deterministic.
 *
 * `every wired control has a row` fails when a control the app wires is
 * operated by no row and not excluded with a reason, so a new control cannot
 * arrive unpinned.
 *
 * Regenerate deliberately: `UPDATE_CONTROL_GOLDENS=1 npx vitest run
 * tests/goldenControls.test.js`, then read the diff.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { FIXED_NOW, loadSnapshot } from './helpers/projectSnapshot.js';
import {
  applyMapPalette, appState, changedLines, keyFor, modelChanges, modelState, recordEmits, uiChanges, uiState, watchUi,
} from './helpers/controlState.js';
import { authoredExtrasProject, PIXEL_DATA_URL } from './fixtures/authoredExtras.js';
import { contextFor } from './setup.js';
import { VideoExporter } from '../src/services/VideoExporter.js';

const goldenDir = join(dirname(fileURLToPath(import.meta.url)), 'goldens');
const UPDATING = process.env.UPDATE_CONTROL_GOLDENS === '1';

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

/** Let promise chains run as far as they can without a timer. */
async function flush() {
  for (let tick = 0; tick < 20; tick += 1) await Promise.resolve();
}

/**
 * Run the timers pending now, then those they leave, until none are left or
 * `passes` runs out: playback asks for a frame every frame, so it never stops
 * on its own.
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
// Which elements the app wires, recorded as it wires them.
// ---------------------------------------------------------------------------

const USER_EVENTS = new Set(['click', 'dblclick', 'input', 'change', 'submit', 'contextmenu', 'keydown']);
const wiredEvents = new WeakMap();
const originalAddEventListener = EventTarget.prototype.addEventListener;

function recordWiring() {
  EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
    if (USER_EVENTS.has(type) && this instanceof Element) {
      if (!wiredEvents.has(this)) wiredEvents.set(this, new Set());
      wiredEvents.get(this).add(type);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
}

/**
 * Wired elements that no row operates, each with the reason. A reason names
 * where the behaviour is pinned instead, or why a user cannot reach it.
 */
const NOT_OPERATED = [
  ['#canvas', 'canvas gestures: interactionPointer.test.js and the draw logs'],
  ['#scene-outline, #scene-outline *', 'the semantic outline: sceneOutline.test.js and sceneOutlineApp.test.js'],
  ['#settings-sections', 'delegation only: it marks the section last used, which the rows inside show'],
  ['#waypoint-scope', 'delegation only: card actions and mixed-state resets, which the rows inside show'],
  ['#crowd-busyness-handles', 'delegation only: the handle inputs inside are rows'],
  ['#file-menu, #export-menu', 'menu keyboard navigation: the key table (TST-13)'],
  ['input[type=hidden]', 'written by its swatch picker, whose radios and custom-colour inputs are rows'],
];

function exclusionFor(element) {
  for (const [selector, reason] of NOT_OPERATED) {
    if (reason && element.matches(selector)) return reason;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Operations: one user gesture per row.
// ---------------------------------------------------------------------------

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

/** Toggles are undone by the same gesture, which spares a reload. */
const click = { label: 'click', run: element => element.click() };
const toggle = { label: 'click', run: element => element.click(), undo: element => element.click() };

function operationsFor(element) {
  if (element.disabled) return [{ label: 'disabled, not operated', run: () => {} }];
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
      case 'color':
        return element.type === 'color'
          ? [{ label: 'pick #56b4e9', run: each => commit(each, '#56b4e9') }]
          : [{ label: 'type "Typed"', run: each => commit(each, 'Typed') }];
      case 'file':
        return [
          { label: 'choose nothing', run: each => chooseFile(each, null) },
          { label: `choose ${pickedFile(element).name}`, run: each => chooseFile(each, pickedFile(each)) },
        ];
      default:
        return [click];
    }
  }
  return [click];
}

const INTERACTIVE = 'button, input, select, textarea, a[href], summary, [role=button], [data-tip]';

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

/** jsdom has neither WebCodecs nor MediaRecorder, so a WebM export stops at its first step. */
const WEBM_UNSUPPORTED = [/Export failed: Error: Video export not supported/, /Video export failed: Error: Video export not supported/];

/**
 * `roots` are where the context's controls live; `values` keeps only the
 * controls that write a value, for a context that repeats another's with a
 * different selection.
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
    enter: app => app.eventBus.emit('waypoint:selected', app.waypoints[MAJOR]),
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
  { name: 'splash', about: 'Help open', roots: ['#splash'], enter: clickId('help-btn') },
  {
    name: 'codec',
    about: 'an MP4 export this browser cannot encode',
    roots: ['#codec-unsupported-modal'],
    enter: clickId('export-mp4-btn'),
    logs: WEBM_UNSUPPORTED,
  },

  // Controls a baseline keeps hidden until another control reveals them. Each
  // context below operates only what no context before it reached.
  { name: 'major-first', about: 'waypoint 0 (ripple beacon, polygon area) selected', roots: ['#waypoint-scope'], onlyNew: true, enter: selectWaypoint(0) },
  { name: 'major-last', about: 'waypoint 5 (pulse beacon) selected', roots: ['#waypoint-scope'], onlyNew: true, enter: selectWaypoint(5) },
  {
    name: 'major-revealed',
    about: `waypoint ${MAJOR} selected, then given a custom marker, a squiggle, a circle area and both custom colours`,
    roots: ['#waypoint-scope'],
    onlyNew: true,
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
    name: 'route-spotlight',
    about: 'the background set to Spotlight Reveal, and the head to a custom image',
    roots: ['#route-scope'],
    onlyNew: true,
    enter: () => {
      choose('background-visibility', 'spotlight-reveal');
      choose('path-head-style', 'custom');
    },
  },
  { name: 'route-aov', about: 'the background set to Angle of View', roots: ['#route-scope'], onlyNew: true, enter: () => choose('background-visibility', 'angle-of-view') },
  // Playback asks for a frame every frame, so this baseline is never at rest:
  // each row starts from the same instant of the same playback instead.
  { name: 'playing', about: 'the animation playing', roots: ['body'], onlyNew: true, running: true, enter: clickId('play-btn') },
  {
    name: 'codec-reduced',
    about: 'an 8K MP4 export in a browser that encodes H.264 only up to 9 megapixels',
    roots: ['#codec-unsupported-modal'],
    onlyNew: true,
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
 * The controls a context operates, as keys, in document order. A root that is
 * itself wired for clicks (a modal's backdrop) is operated too.
 */
function controlsOf(context) {
  const chosen = new Set();
  const radioGroups = new Set();
  for (const root of context.roots.map(selector => document.querySelector(selector))) {
    const candidates = root.matches(INTERACTIVE) || wiredEvents.get(root)?.has('click') ? [root] : [];
    candidates.push(...root.querySelectorAll(INTERACTIVE));
    for (const element of candidates) {
      if (chosen.has(element) || !isShown(element) || exclusionFor(element)) continue;
      if (context.onlyNew && operated.has(keyFor(element))) continue;
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

/** Canvases keep every call they were given, and every mock its calls: neither is pinned here. */
function forgetDrawing(app) {
  for (const canvas of [app.canvas, app.renderingService?.vectorCanvas, app.motionVisibilityService?.revealMaskCanvas]) {
    if (canvas) contextFor(canvas)?.takeCalls();
  }
  vi.clearAllMocks();
}

async function establish(app, context) {
  vi.setSystemTime(FIXED_NOW);
  expect(await drive(loadSnapshot(app, project))).toBe(true);
  const splash = document.getElementById('splash');
  if (splash.style.display !== 'none') document.getElementById('splash-close').click();
  // A click outside closes any open menu and any shown hint, as it would for
  // a user.
  document.body.click();
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
  // The section last used is kept for the session, and no reload clears it.
  if (app.sectionController.lastInteracted !== null) {
    app.sectionController.lastInteracted = null;
    app.sectionController._applyLastInteractedIndicator();
  }
  // Rows move focus; each starts with it on the body, once the splash's focus
  // trap has let go.
  await settle(6);
  document.activeElement?.blur();
  context.enter(app);
  await settle(50);
  app.markClean();
  forgetDrawing(app);
  // A baseline is at rest: anything still pending would run inside the next row.
  return context.running || vi.getTimerCount() === 0;
}

async function openSession(context) {
  const app = await drive(bootApp().then(async (booted) => {
    await booted.ready;
    return booted;
  }));
  // The shared hint tooltip is created the first time any hint shows. It is
  // made here, so each hint row starts with it existing and hidden.
  const hint = document.querySelector('[data-tip]');
  hint.click();
  hint.click();
  expect(await establish(app, context), `${context.name} is still busy after settling`).toBe(true);
  return { app, context, emits: recordEmits(app) };
}

function capture(session) {
  return { model: modelState(session.app), app: appState(session.app), ui: session.ui.capture() };
}

function changes(before, after) {
  return [
    ...modelChanges(before.model, after.model),
    ...changedLines(before.app, after.app, 'app'),
    ...uiChanges(before.ui, after.ui),
  ];
}

/**
 * Stop an app that a fresh one replaces. `bootApp` stops every app it booted
 * only when the test ends, and until then a retired app's frames and timers
 * would run among the new one's.
 */
function retire(session) {
  session.emits.restore();
  session.app.animationEngine.stop?.();
  session.app.eventBus.removeAllListeners();
  vi.clearAllTimers();
}

/**
 * A click on a file input asks the browser for its file dialog, which jsdom
 * does not open; the request is what a row can see of it.
 */
const fileDialogs = [];

function noteFileDialog(event) {
  if (event.target instanceof HTMLInputElement && event.target.type === 'file') {
    fileDialogs.push(`file dialog ${keyFor(event.target)}`);
  }
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
    const seen = byEvent.get(name);
    byEvent.set(name, { line, repeated: Boolean(seen) });
  }
  return [...byEvent.values()].map(({ line, repeated }) => (repeated ? `${line} (repeatedly)` : line));
}

/** Operate one control and record what it did. */
async function runRow(session, element, operation, name) {
  session.emits.take();
  fileDialogs.length = 0;
  vi.setSystemTime(ROW_NOW);
  const random = vi.spyOn(Math, 'random').mockImplementation(seededRandom(name));
  operation.run(element);
  await flush();
  const after = capture(session);
  const lines = [...session.emits.take(), ...fileDialogs.splice(0), ...changes(session.base, after)];
  await settle();
  const settled = capture(session);
  const later = [...onceEach(session.emits.take()), ...changes(after, settled)];
  vi.clearAllTimers();
  random.mockRestore();
  if (later.length > 0) lines.push('settled:', ...later.map(line => `  ${line}`));
  return { lines, settled };
}

/** Put the session back at its baseline, and prove it; boot afresh when a reload cannot. */
async function restore(session, element, operation, settled) {
  if (changes(session.base, settled).length === 0) return session;
  if (operation.undo && element.isConnected) {
    operation.undo(element);
    await settle();
    vi.clearAllTimers();
    if (changes(session.base, capture(session)).length === 0) return session;
  }
  forgetDrawing(session.app);
  const atRest = await establish(session.app, session.context);
  session.emits.take();
  if (atRest && changes(session.base, capture(session)).length === 0) return session;
  retire(session);
  const fresh = await openSession(session.context);
  fresh.ui = session.ui;
  fresh.base = session.base;
  const drift = changes(fresh.base, capture(fresh));
  expect(drift, `a fresh app in ${session.context.name} does not match the baseline`).toEqual([]);
  return fresh;
}

// ---------------------------------------------------------------------------
// Goldens.
// ---------------------------------------------------------------------------

/** Every wired element seen in some context, and every element some row operated. */
const wiredSeen = new Map();
const operated = new Set();

function noteWiring(context) {
  for (const element of document.querySelectorAll('*')) {
    if (!wiredEvents.has(element)) continue;
    const key = keyFor(element);
    if (!wiredSeen.has(key)) wiredSeen.set(key, { element, context: context.name });
  }
}

function expectGolden(name, text) {
  const path = join(goldenDir, `controls-${name}.txt`);
  if (UPDATING) {
    writeFileSync(path, text, 'utf8');
    return;
  }
  expect(existsSync(path), `missing golden ${path}; regenerate with UPDATE_CONTROL_GOLDENS=1`).toBe(true);
  expect(text).toBe(readFileSync(path, 'utf8'));
}

describe('control → bus goldens (TST-04)', () => {
  let digests = null;
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
    // The app narrates itself to the console, thousands of lines across these
    // rows. None of it is what they pin; warnings and errors still reach the
    // guard, and each context declares those it provokes.
    narration = ['log', 'info', 'debug'].map(level => vi.spyOn(console, level).mockImplementation(() => {}));
  });

  afterAll(() => {
    EventTarget.prototype.addEventListener = originalAddEventListener;
    document.removeEventListener('click', noteFileDialog, true);
    removePalette?.();
    digests?.mockRestore();
    for (const spy of narration) spy.mockRestore();
    vi.useRealTimers();
  });

  for (const context of CONTEXTS) {
    test(`${context.name}: ${context.about}`, async () => {
      allowConsole(...(context.logs ?? []));
      vi.useFakeTimers(FAKE_TIMERS);
      const stub = context.stub?.();
      let session = await openSession(context);
      session.ui = watchUi(document.body, { opaque: OUTLINE });
      session.base = capture(session);
      noteWiring(context);

      const sections = [`# ${context.name}: ${context.about}`];
      for (const key of controlsOf(context)) {
        // What each option reveals is pinned where the control is first
        // operated; a repeated context needs one write to show whom it reaches.
        const operations = operationsFor(elementAt(key)).slice(0, context.values ? 1 : undefined);
        for (const operation of operations) {
          const element = elementAt(key);
          operated.add(key);
          const { lines, settled } = await runRow(session, element, operation, `${context.name} ${key} ${operation.label}`);
          sections.push(`\n## ${key} · ${operation.label}${lines.length ? `\n${lines.join('\n')}` : ''}`);
          session = await restore(session, element, operation, settled);
        }
      }
      session.emits.restore();
      // The watcher describes each element again only after a mutation reaches
      // it; had one been missed, what it holds would differ from a full read.
      const watched = session.ui.capture();
      session.ui.disconnect();
      stub?.mockRestore();
      expect(uiChanges(uiState(document.body, { opaque: OUTLINE }), watched)).toEqual([]);
      expectGolden(context.name, `${sections.join('\n')}\n`);
    }, 120_000);
  }

  test('every wired control has a row, or a reason it has none', () => {
    // Were the wiring not recorded, nothing would be missing either: the app
    // wires about 285 elements across these contexts.
    expect(wiredSeen.size).toBeGreaterThan(200);
    const missing = [...wiredSeen]
      .filter(([key, { element }]) => !operated.has(key) && !exclusionFor(element))
      .map(([key, { context }]) => `${key} (seen in ${context})`);
    expect(missing).toEqual([]);
  });
});
