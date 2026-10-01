/**
 * TST-05 — the event transcript.
 *
 * `wiringControllers.js` and `wiringBus.js` subscribe the app to 96 EventBus
 * events, and 52 of them were named in no test. W9 splits the 1,228-line
 * function that registers most of them into ordered, named methods (CLR-01)
 * and merges what they do (CON-02, CON-03). So before any of it moves, this
 * file writes down what each event does, and in which order its listeners
 * run.
 *
 * Two kinds of golden do that.
 *
 * `event-registrations.txt` lists every listener on the booted app's bus, per
 * event, in the order the listeners were added. A listener is named by the
 * module that added it and its place among that module's listeners for that
 * event, never by line or function, so moving code within a file, or
 * splitting a function into methods called in the same order, leaves it
 * byte-identical, while reordering listeners or moving one to another module
 * changes it. Two listeners from one module on one event could swap without
 * changing it; today the one such pair is `waypoint:add-at-center`, whose
 * first listener is dead, and the transcript shows any swap whose order
 * matters.
 *
 * `event-transcript-*.txt` drives, one fresh app per row, every event the two
 * files subscribe to in the scenarios its rows name, with a bundled example
 * loaded, in Edit mode, nothing selected and the transport paused at the
 * start unless the row says otherwise. Each row keeps, phase by phase: every
 * event emitted on the bus, nested under the emit that caused it; each step
 * the app takes that the transcript counts, where it took it (autosave,
 * path, retime, queued render, render, each autosave written to storage, and
 * each undo entry with what an Undo of it would take back); what the app
 * said and showed, and the values the two replaced steps were handed; then
 * the change that phase made to the project, the selection and the undo
 * history, with the transport, editor and inspector fields listed in
 * `runtimeState`. "At once" is the emit and its promise continuations; then
 * the clock runs on ten seconds, and each step a timer takes there carries
 * its time, so the 50 ms retime, the 400 ms undo grouping and the 1 s
 * autosave write are pinned to their delays. Last, each row compares the
 * copy browser recovery holds with the project as it stands.
 *
 * What is not recorded: drawing (the renderer is a counter: the draw logs
 * are TST-02's); inspector and control state beyond those fields (TST-04's);
 * timers due more than ten seconds after an act; frames the engine books for
 * itself (it runs each frame it is asked for once, as with the clock frozen
 * it would never stop); and the work behind the two replaced steps, image
 * decoding and the whole of `exportVideo`, which jsdom cannot do.
 *
 * The scene-edit transcript adds the commits CON-03 will merge that the bus
 * reaches: the scene outline's commands, the guide network's commit and the
 * crowd cards' debounced change.
 *
 * Defects are pinned as they stand, and their rows are named: the live J/K/L
 * speed surviving a pause (DEF-15), the keyboard nudge under an editor zoom
 * (DEF-16), and inserts that split a branch run (DEF-22). Their fixes change
 * those rows; a change anywhere else is to be explained, not regenerated.
 *
 * Every event the two files subscribe to has a row or a stated reason it has
 * none, and every row's event must still be subscribed: a new listener cannot
 * arrive unrecorded, and a removed one cannot leave a row that pins nothing.
 *
 * Regenerate deliberately: `UPDATE_EVENT_GOLDENS=1 npx vitest run
 * tests/eventTranscript.test.js`, then read the diff. Goldens are written
 * only when every test in the file has run; a filtered run writes nothing
 * and fails.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { FIXED_NOW, freezeClock, loadSnapshot } from './helpers/projectSnapshot.js';
import { authoredExtrasProject, PIXEL_DATA_URL } from './fixtures/authoredExtras.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { loadExampleBackground } from '../src/app/backgroundLoading.js';
import { STORAGE } from '../src/config/constants.js';
import { EventBus } from '../src/core/EventBus.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { Scene } from '../src/models/Scene.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { RenderingService } from '../src/services/RenderingService.js';
import { boundEntryWaypointIds } from '../src/utils/routeAnchors.js';

const THIS_FILE = basename(fileURLToPath(import.meta.url));
const goldenDir = join(dirname(fileURLToPath(import.meta.url)), 'goldens');
const UPDATING = process.env.UPDATE_EVENT_GOLDENS === '1';

freezeClock();

/**
 * New ids are `Date.now()` plus `Math.random()`. The clock is frozen, and the
 * random part is seeded per test so a run repeats exactly; the transcript
 * still names new ids by their order of appearance, not their value.
 */
let seededRandom = null;
beforeEach(() => {
  let seed = 20260930;
  seededRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  });
});
afterEach(() => {
  seededRandom?.mockRestore();
  seededRandom = null;
});

// ========== WHO REGISTERED EACH LISTENER ==========

/**
 * The module of the first stack frame outside the bus and this file: the
 * file whose code called `on`, `once` or `subscribe`.
 */
function registeringModule(stack) {
  for (const line of String(stack).split('\n').slice(1)) {
    const match = line.match(/((?:file:\/\/)?\/[^\s()]*?\.m?js)(?:\?[^\s():]*)?:\d+:\d+/);
    if (!match) continue;
    const name = basename(match[1]);
    if (name === 'EventBus.js' || name === THIS_FILE) continue;
    return name;
  }
  return '(unknown)';
}

/**
 * Boot an app while noting which module added each bus listener.
 *
 * Listeners are added while the app is being constructed, before the test
 * can reach the instance, so the note is taken on the class for the length
 * of the boot and put back however the boot ends.
 */
async function bootNotingListeners() {
  const noted = [];
  const on = EventBus.prototype.on;
  EventBus.prototype.on = function noteListener(eventName, callback) {
    noted.push({ bus: this, eventName, listener: callback, module: registeringModule(new Error().stack) });
    return on.call(this, eventName, callback);
  };
  let app;
  try {
    app = await bootReturning();
  } finally {
    EventBus.prototype.on = on;
  }
  return { app, noted: noted.filter(each => each.bus === app.eventBus) };
}

/** Per event, its listeners in dispatch order, each as `module#n`. */
function listenerTable(app, noted) {
  const table = new Map();
  for (const [eventName, listeners] of app.eventBus.events) {
    const perModule = new Map();
    table.set(eventName, listeners.map(listener => {
      const note = noted.find(each => each.eventName === eventName && each.listener === listener);
      const module = note?.module ?? '(unattributed)';
      const ordinal = (perModule.get(module) ?? 0) + 1;
      perModule.set(module, ordinal);
      return `${module}#${ordinal}`;
    }));
  }
  return table;
}

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function registrationGolden(table) {
  const events = [...table.keys()].sort(byText);
  const modules = new Map();
  for (const names of table.values()) {
    for (const name of names) {
      const module = name.replace(/#\d+$/, '');
      modules.set(module, (modules.get(module) ?? 0) + 1);
    }
  }
  const total = [...modules.values()].reduce((sum, count) => sum + count, 0);
  return [
    '# Every listener on the app\'s EventBus once `app.ready` has resolved, per event',
    '# in dispatch order. Each is named by the module that added it and its place',
    '# among that module\'s listeners for the event. Written by',
    '# tests/eventTranscript.test.js (TST-05); regenerate with UPDATE_EVENT_GOLDENS=1.',
    '#',
    `# ${total} listeners on ${events.length} events, from ${modules.size} modules:`,
    ...[...modules].sort(([a], [b]) => byText(a, b)).map(([module, count]) => `#   ${module} ${count}`),
    '',
    ...events.map(name => [name, ...table.get(name).map(each => `  ${each}`)].join('\n')),
  ].join('\n') + '\n';
}

// ========== FIXTURES ==========

function example(id) {
  return structuredClone(buildExampleProjects().find(each => each.id === id).project);
}

/**
 * The open day example with a second waypoint on its branch, so that a
 * waypoint inserted between the two lands inside the run (DEF-22).
 */
function openDayWithTwoWaypointBranch() {
  const project = example('uon-open-day');
  const at = project.waypoints.findIndex(each => each.id === 'ex-uon-b1');
  const first = project.waypoints[at];
  const second = {
    ...structuredClone(first),
    id: 'ex-uon-b2',
    name: 'Cricket pavilion',
    label: 'Cricket pavilion',
    imgX: 0.62,
    imgY: 0.2,
    branchFrom: null,
    branchRejoin: first.branchRejoin,
  };
  first.branchRejoin = null;
  project.waypoints.splice(at + 1, 0, second);
  return project;
}

/** The open day example's settings with no route and no crowd. */
function emptyRoute() {
  return { ...example('uon-open-day'), waypoints: [], scene: new Scene().toJSON() };
}

/** Each fixture and the native size of the map it is seen against. */
const FIXTURES = {
  'open day': () => ({ project: example('uon-open-day'), image: [2914, 2061] }),
  'open day, two-waypoint branch': () => ({ project: openDayWithTwoWaypointBranch(), image: [2914, 2061] }),
  'PARM walk': () => ({ project: example('parm-aerial-walk'), image: [3371, 2651] }),
  'authored extras': () => ({ project: authoredExtrasProject(), image: [2914, 2061] }),
  'empty route': () => ({ project: emptyRoute(), image: [2914, 2061] }),
};

/** The `Image` stub from `setup.js` decodes nothing; it is given a size. */
function stubImage([width, height]) {
  const image = new Image();
  Object.assign(image, { width, height, naturalWidth: width, naturalHeight: height });
  return image;
}

const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * A real turn of the event loop, which drains every promise continuation.
 * `setImmediate` is not among the faked timers.
 */
const drainPromises = () => new Promise(resolve => setImmediate(resolve));

/** `playback.js` keeps this key to itself: the one-off tip about Preview. */
const PREVIEW_TIP_KEY = 'routePlotter_previewTipDismissed';

/**
 * How far the clock runs on after an act, and after a row's setup: past the
 * longest timer the app sets (a toast's eight seconds), so every timer an act
 * sets runs, in time order, whatever else happens to be pending.
 */
const LATER_MS = 10000;

/** The row being recorded, if any: the render counter reports to it. */
let recording = null;

/**
 * Drawing is replaced for the whole file, from the first boot: the app still
 * builds each frame's state (`app.render`), and the count of frames it hands
 * to the renderer is what a row keeps. The recording canvases would
 * otherwise keep every draw call of every boot. jsdom has no
 * `scrollIntoView`, which the inspector's section flash calls; it is given
 * one that notes the call.
 */
const drawFrame = RenderingService.prototype.render;
const hadScrollIntoView = 'scrollIntoView' in Element.prototype;
beforeAll(() => {
  RenderingService.prototype.render = function countFrame() {
    recording?.step('render');
  };
  if (!hadScrollIntoView) {
    Element.prototype.scrollIntoView = function noteScroll() {
      recording?.note(`scrolled ${summarise(this)} into view`);
    };
  }
});
afterAll(() => {
  RenderingService.prototype.render = drawFrame;
  if (!hadScrollIntoView) delete Element.prototype.scrollIntoView;
});

/**
 * Each row's app is let go when its test ends. It adds listeners to the
 * window, the document and the body, which outlive the shell each boot
 * replaces, and through them every app this file boots would stay reachable,
 * its whole page with it: about 10 MB a row. So the listeners added there
 * while a test runs are noted, and removed when it ends, except the entry
 * module's `DOMContentLoaded`, which it adds once and every boot needs.
 */
const pageListeners = [];
let unpatchPageListeners = null;

function notePageListeners() {
  const targets = [window, document, document.body];
  const originals = targets.map(target => target.addEventListener);
  targets.forEach((target, index) => {
    target.addEventListener = function noteListener(type, listener, options) {
      if (type !== 'DOMContentLoaded') pageListeners.push({ target, type, listener, options });
      return originals[index].call(this, type, listener, options);
    };
  });
  unpatchPageListeners = () => targets.forEach((target, index) => {
    if (originals[index] === EventTarget.prototype.addEventListener) delete target.addEventListener;
    else target.addEventListener = originals[index];
  });
}

beforeEach(() => notePageListeners());
afterEach(() => {
  unpatchPageListeners?.();
  unpatchPageListeners = null;
  for (const { target, type, listener, options } of pageListeners.splice(0)) {
    target.removeEventListener(type, listener, options);
  }
});

/**
 * Boot the app as a returning user's opens: the first-run help and the
 * Preview tip already seen, and an empty session restored. No dialog is
 * open, the default map is not decoded at every boot, and no tip is left on
 * a real timer to fire into a later row's fake clock. The bus listeners are
 * the ones a first run adds: all of them are added before `app.ready`.
 */
async function bootReturning() {
  const restored = JSON.stringify(emptyRoute());
  localStorage.getItem.mockImplementation(key => {
    if (key === STORAGE.AUTOSAVE_KEY) return restored;
    if (key === STORAGE.SPLASH_SHOWN_KEY) return 'true';
    if (key === PREVIEW_TIP_KEY) return 'true';
    return null;
  });
  try {
    const app = await bootApp();
    await app.ready;
    return app;
  } finally {
    localStorage.getItem.mockImplementation(() => null);
  }
}

/**
 * A booted app with a fixture loaded, its map in place, and nothing pending.
 *
 * The fixture is loaded through the recovery path (`loadSnapshot`), which
 * leaves the transport paused at the start. Recovery never holds the map, so
 * a stub of the real one's size is given through `loadExampleBackground`'s
 * own `loadAsset` seam. Loading it sets the export resolution to its native
 * size, so the fixture's own is put back and the canvas fitted to it, which
 * is how opening the example leaves the editor.
 */
async function bootWith(fixtureName) {
  const fixture = FIXTURES[fixtureName]();
  const app = await bootReturning();
  oneFramePerRequest(app);
  expect(await loadSnapshot(app, fixture.project)).toBe(true);

  const image = stubImage(fixture.image);
  const loaded = await loadExampleBackground(app, './images/fixture-map.png', {
    autoSave: false,
    loadAsset: async () => ({ base64: PIXEL_DATA_URL, getImageElement: async () => image }),
  });
  expect(loaded).toBe(true);
  app.exportSettings.resolutionX = fixture.project.exportSettings.resolutionX;
  app.exportSettings.resolutionY = fixture.project.exportSettings.resolutionY;
  app.updateCanvasAspectRatio();
  // The app opens in Preview; authoring happens in Edit, where the canvas
  // hit tests answer, so every row starts there unless its setup says not.
  app._setPreviewMode(false);

  // Settle on real timers: queued frames, then the retime, undo grouping and
  // autosave that loading left pending. One autosave is made and the project
  // marked clean, as after opening and saving it: the one-off notice that
  // browser recovery leaves the background out is then given here, not in
  // the first row that autosaves.
  for (let i = 0; i < 3; i += 1) await nextTask();
  app.invalidateAnimationTiming();
  app._flushPendingUndo();
  app.autoSave();
  app.storageService.flushAutoSave();
  app.markClean();
  for (let i = 0; i < 3; i += 1) await nextTask();
  expect(app.renderQueued, 'a render is still queued').toBe(false);
  parkEngine(app);
  return app;
}

/**
 * A frame the engine is asked for runs, once; a frame it then books for
 * itself, to keep playing or to let the camera settle, is not booked. Time
 * is frozen or faked here, so that loop would either spin without end or run
 * as fast as the fake clock is wound; a row shows the frame its act asked
 * for, and not the loop that would follow it.
 */
function oneFramePerRequest(app) {
  const engine = app.animationEngine;
  const { _loop: loop, _scheduleFrame: scheduleFrame } = engine;
  let inFrame = false;
  engine._loop = function oneFrame(timestamp) {
    inFrame = true;
    try {
      return loop.call(this, timestamp);
    } finally {
      inFrame = false;
    }
  };
  engine._scheduleFrame = function scheduleUnlessLooping() {
    if (!inFrame) scheduleFrame.call(this);
  };
}

/**
 * Cancel the engine's idle frame. The camera eases toward its target as time
 * passes and as frames are drawn; with the clock frozen and drawing replaced,
 * it never arrives, so the idle loop never sleeps. Parked before each act,
 * the engine runs only the frames the act asks for, and each shows once.
 */
function parkEngine(app) {
  app.animationEngine._cancelFrame();
}

/**
 * From here every timer the app sets is fake. The clock is put back to the
 * frozen instant, so new waypoints are stamped exactly as at boot.
 */
function fakeTimers() {
  vi.useRealTimers();
  vi.useFakeTimers({
    toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    shouldClearNativeTimers: true,
  });
  vi.setSystemTime(FIXED_NOW);
}

/** Run what a row's setup left pending, so the row starts from rest. */
async function settleSetup(app) {
  await drainPromises();
  await vi.advanceTimersByTimeAsync(LATER_MS);
  await drainPromises();
  expect(app.renderQueued, 'a render is still queued').toBe(false);
  parkEngine(app);
  vi.setSystemTime(FIXED_NOW);
}

// ========== RECORDING ==========

const COUNT_ORDER = [
  'autosave', 'autosave written', 'render', 'queued render', 'path', 'retime', 'undo saved', 'undo unchanged',
];

/**
 * One row's record, phase by phase, every line in the order it happened. An
 * emit is a line, nested under the emit that caused it. So is each step the
 * transcript counts (`· autosave`, `· path`, `· undo saved` …), so a commit's
 * order is kept and not only its totals. In "later", a line no emit caused
 * carries the fake clock's time since the act ended, so each timer's delay is
 * part of the record.
 */
class Recorder {
  constructor() {
    this.phases = [];
    this.depth = 0;
  }

  begin(name, { timed = false } = {}) {
    this.phase = { name, lines: [], counts: new Map(), startedAt: timed ? Date.now() : null };
    this.phases.push(this.phase);
  }

  /** Add a line where the record has got to; returns its index. */
  note(text) {
    const { startedAt } = this.phase;
    const when = startedAt !== null && this.depth === 0 ? `+${Date.now() - startedAt} ms ` : '';
    this.phase.lines.push(`${'  '.repeat(this.depth + 1)}${when}${text}`);
    return this.phase.lines.length - 1;
  }

  tally(name) {
    this.phase.counts.set(name, (this.phase.counts.get(name) ?? 0) + 1);
  }

  /** A counted step: tallied for the phase, and a line where it happened. */
  step(name) {
    this.tally(name);
    return this.note(`· ${name}`);
  }

  /** Finish a step's line once its outcome is known, with detail under it. */
  complete(index, text, detail = []) {
    const lines = this.phase.lines;
    const indent = `${lines[index].match(/^ */)[0]}    `;
    lines[index] = lines[index].replace(/· .*$/, `· ${text}`);
    lines.splice(index + 1, 0, ...detail.map(line => `${indent}${line.trimStart()}`));
  }

  /** A callback for a request/response event, noting what it was answered. */
  reply() {
    return answer => this.note(`answered ${summarise(answer)}`);
  }
}

/** Wrap a method so a note is taken before it runs as before. */
function before(object, name, take) {
  const original = object[name];
  object[name] = function recorded(...args) {
    take(...args);
    return original.apply(this, args);
  };
}

/**
 * What an Undo of this entry would take back: the entry against the one
 * under it. A waypoint or node that appears whole is named, not listed field
 * by field, because the model diff lists it.
 */
function undoEntryChange(under, entry) {
  if (!under) return ['(the first entry)'];
  const [was, is] = [new Map(), new Map()];
  flatten(was, '', JSON.parse(under));
  flatten(is, '', JSON.parse(entry));
  return diffLines(was, is, { fields: false });
}

/**
 * Listen to everything the row's app does: each emit (nested by cause), what
 * it says and shows, each counted step, and any listener that throws, which
 * is noted where it happened and does not stop the listeners after it, as in
 * production (the harness would otherwise fail the test on it).
 */
function instrument(app, recorder) {
  const bus = app.eventBus;
  const { emit, onListenerError } = bus;
  recorder.restore = () => {
    bus.emit = emit;
    bus.onListenerError = onListenerError;
  };
  bus.emit = function recordedEmit(eventName, ...args) {
    const heard = bus.listenerCount(eventName) > 0;
    recorder.note(`${eventName}${describeArgs(args)}${heard ? '' : '  (no listener)'}`);
    recorder.depth += 1;
    try {
      return emit.call(bus, eventName, ...args);
    } finally {
      recorder.depth -= 1;
    }
  };
  bus.onListenerError = (error, { eventName }) => {
    recorder.note(`! a listener for ${eventName} threw ${error?.name}: ${error?.message}`);
  };
  before(app, 'autoSave', () => recorder.step('autosave'));
  before(app, 'queueRender', () => recorder.step('queued render'));
  before(app, 'calculatePath', () => recorder.step('path'));
  before(app, 'updateAnimationDuration', () => recorder.step('retime'));
  before(app, 'announce', (message, priority) => recorder.note(
    `said ${JSON.stringify(message)}${priority && priority !== 'polite' ? ` (${priority})` : ''}`));
  before(app, 'showToast', (message, duration, action) => recorder.note(
    `toast ${JSON.stringify(message)}${duration === undefined ? '' : ` for ${duration} ms`}` +
    `${action?.label ? ` offering ${JSON.stringify(action.label)}` : ''}`));
  before(app, 'showSelectWaypointPrompt', () => recorder.note('prompted "Select a waypoint to zoom"'));
  before(app.uiController, 'startRenameFor', waypoint => recorder.note(`rename started for ${summarise(waypoint)}`));
  before(app.storageService, '_writeSerialized', key => {
    if (key === STORAGE.AUTOSAVE_KEY) recorder.step('autosave written');
  });
  const saveState = app.undoService.saveState;
  app.undoService.saveState = function recordedSave(...args) {
    const under = this._undoStack.at(-1);
    const at = recorder.note('· undo save');
    const result = saveState.apply(this, args);
    const outcome = result?.saved ? 'undo saved' : 'undo unchanged';
    recorder.tally(outcome);
    recorder.complete(at, outcome, result?.saved ? undoEntryChange(under, this._undoStack.at(-1)) : []);
    return result;
  };
}

// ========== DESCRIBING VALUES ==========

function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Number(value.toFixed(4));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Quoted text; only something as long as a data URL is cut short. */
function formatText(value, limit = 200) {
  const text = value.length > limit ? `${value.slice(0, limit - 20)}…(${value.length} chars)` : value;
  return JSON.stringify(text);
}

/** A compact, deterministic summary of an emitted value. */
function summarise(value, depth = 0) {
  if (value === null || value === undefined || typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'string') return formatText(value, 60);
  if (typeof value === 'function') return 'fn';
  if (value instanceof Waypoint) return `wp(${value.id})`;
  if (typeof File !== 'undefined' && value instanceof File) return `File(${value.name})`;
  if (typeof Element !== 'undefined' && value instanceof Element) {
    return `<${value.tagName.toLowerCase()}${value.id ? `#${value.id}` : ''}>`;
  }
  if (Array.isArray(value)) {
    if (depth >= 2) return `[${value.length} items]`;
    const shown = value.slice(0, 6).map(each => summarise(each, depth + 1));
    if (value.length > 6) shown.push(`…+${value.length - 6}`);
    return `[${shown.join(', ')}]`;
  }
  const kind = value.constructor?.name;
  if (kind && kind !== 'Object') return typeof value.id === 'string' ? `${kind}(${value.id})` : kind;
  if (depth >= 2) return '{…}';
  const keys = Object.keys(value).sort(byText);
  const shown = keys.slice(0, 8).map(key => `${key}: ${summarise(value[key], depth + 1)}`);
  if (keys.length > 8) shown.push(`…+${keys.length - 8}`);
  return `{${shown.join(', ')}}`;
}

function describeArgs(args) {
  return args.length === 0 ? '' : ` ${args.map(each => summarise(each)).join(', ')}`;
}

function formatLeaf(value) {
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'string') return formatText(value);
  return String(value);
}

/**
 * Flatten a value into `path → text`. An array whose items all carry a string
 * `id` is keyed by id, with its order kept as `path#order`, so an insert
 * reads as one new entry rather than every later index changing.
 */
function flatten(into, path, value) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      into.set(path, '[]');
    } else if (value.every(each => each && typeof each === 'object' && typeof each.id === 'string')) {
      into.set(`${path}#order`, value.map(each => each.id).join(' '));
      for (const each of value) flatten(into, `${path}[${each.id}]`, each);
    } else if (value.every(each => each === null || typeof each !== 'object')) {
      into.set(path, `[${value.map(formatLeaf).join(', ')}]`);
    } else {
      value.forEach((each, index) => flatten(into, `${path}[${index}]`, each));
    }
    return;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) into.set(path, '{}');
    for (const key of keys) flatten(into, path ? `${path}.${key}` : key, value[key]);
    return;
  }
  into.set(path, formatLeaf(value));
}

const idsOf = list => (list ?? []).map(each => each?.id ?? String(each)).join(' ');

function contextMenuState() {
  const menu = document.querySelector('ul.context-menu');
  if (!menu || menu.style.display === 'none') return 'closed';
  const items = [...menu.querySelectorAll('[role="menuitem"]')].map(item =>
    `${item.textContent}${item.getAttribute('aria-disabled') === 'true' ? ' (disabled)' : ''}`);
  return `${menu.getAttribute('aria-label')}: ${items.join(' | ')}`;
}

/** What the app holds outside the saved project: transport, route, editor. */
function runtimeState(app) {
  const engine = app.animationEngine;
  const state = engine.state;
  const structure = app.routeStructure;
  const elements = app.elements;
  const sections = app.sectionController;
  return {
    previewMode: app.previewMode,
    canvas: `${formatNumber(app.displayWidth)}x${formatNumber(app.displayHeight)}`,
    viewport: `zoom ${formatNumber(app.viewport.zoom)} pan ${formatNumber(app.viewport.panX)},` +
      `${formatNumber(app.viewport.panY)}`,
    transport: {
      playing: state.isPlaying,
      paused: state.isPaused,
      progress: state.progress,
      pathProgress: state.pathProgress,
      timeMs: state.currentTime,
      playbackSpeed: state.playbackSpeed,
      waitingAt: state.isWaitingAtWaypoint ? state.pauseWaypointIndex : null,
    },
    timeline: {
      pauses: engine.pauseMarkers?.length ?? 0,
      speedSegments: engine.segmentMarkers?.length ?? 0,
      beacons: engine.beaconSchedules?.length ?? 0,
      introMs: engine.introTime,
      tailMs: engine.totalTailTime,
    },
    jkl: { live: `${app.jklDirection} x${app.jklSpeed}`, unused: `${app._jklDirection} x${app._jklSpeedMultiplier}` },
    route: {
      pathPoints: app.pathPoints?.length ?? 0,
      trunk: idsOf(structure?.trunk?.waypoints),
      branches: (structure?.branches ?? []).map(branch =>
        `${branch.id}: ${branch.forkFromId ?? '-'} to ${branch.rejoinAtId ?? 'end'}: ${idsOf(branch.waypoints)}`),
      problems: (structure?.problems ?? []).map(problem =>
        `${problem.code}${problem.branchId ? ` (${problem.branchId})` : ''}`),
      branchPaths: (app.branchPaths ?? []).map(each => `${each.id}: ${each.pathPoints.length} points`),
    },
    hover: app.canvasHover ? `${app.canvasHover.type} ${app.canvasHover.waypoint?.id ?? ''}`.trim() : null,
    branchArmed: app.interactionHandler?.branchArmed?.id ?? null,
    crowd: app.selectedCrowd?.id ?? null,
    dirty: app._isDirty,
    // The format a video export is asked for: an export setting the saved
    // project leaves out, so the model diff cannot show it.
    exportFormat: app.exportSettings.format ?? null,
    ui: {
      playButton: elements.playBtn?.style.display || '(stylesheet)',
      pauseButton: elements.pauseBtn?.style.display || '(stylesheet)',
      undoDisabled: elements.undoBtn?.disabled,
      redoDisabled: elements.redoBtn?.disabled,
      splash: elements.splash?.style.display || '(stylesheet)',
      shareDisclosure: app._shareDisclosureModal?.style.display === 'flex'
        ? app._shareDisclosureTitle?.textContent
        : 'closed',
      contextMenu: contextMenuState(),
      sections: `waypoints ${sections?.hasWaypoints} selection ${sections?.hasSelection}` +
        ` crowd ${sections?.hasCrowdSelection}`,
    },
  };
}

function describeSelection(list, primary) {
  return list.length === 0 && !primary ? 'none' : `[${list.join(' ')}] ${primary ?? '-'}`;
}

/** The app's selection, and the copies its components hold where they differ. */
function selectionOf(app) {
  const ids = list => [...(list ?? [])].map(each => each?.id ?? String(each));
  const own = describeSelection(ids(app.selectedWaypoints), app.selectedWaypoint?.id ?? null);
  const handler = describeSelection(ids(app.interactionHandler?.selectedWaypoints),
    app.interactionHandler?.selectedWaypoint?.id ?? null);
  const inspector = describeSelection(ids(app.uiController?.selectedWaypoints),
    app.uiController?.selectedWaypoint?.id ?? null);
  return [own, handler !== own ? `canvas ${handler}` : null, inspector !== own ? `inspector ${inspector}` : null]
    .filter(Boolean).join('; ');
}

function observe(app, row = {}) {
  const model = new Map();
  flatten(model, '', app._buildProjectSnapshot({ includeAssets: false }));
  flatten(model, 'runtime', runtimeState(app));
  if (row.observe) flatten(model, 'row', row.observe(app));
  return {
    model,
    selection: selectionOf(app),
    history: `stack ${app.undoService._undoStack.length}, redo ${app.undoService._redoStack.length}`,
  };
}

/** Every `[id]` prefix of a flattened key, outermost first. */
function entityPrefixes(key) {
  const prefixes = [];
  for (const match of key.matchAll(/\[[^\]]*\]/g)) prefixes.push(key.slice(0, match.index + match[0].length));
  return prefixes;
}

/**
 * The model diff. An entry that appears whole (a new waypoint, node or
 * layer) is listed with its fields under one `+`, or named alone without
 * `fields`; one that disappears is one `-` line; anything else is a
 * changed, added or removed field.
 */
function diffLines(before, after, { fields = true } = {}) {
  const known = map => new Set([...map.keys()].flatMap(entityPrefixes));
  const knownBefore = known(before);
  const knownAfter = known(after);
  const lines = [];
  const opened = new Set();
  for (const key of [...new Set([...before.keys(), ...after.keys()])].sort(byText)) {
    const was = before.get(key);
    const is = after.get(key);
    if (before.has(key) && after.has(key)) {
      if (was !== is) lines.push(`  ~ ${key}: ${was} -> ${is}`);
    } else if (after.has(key)) {
      const root = entityPrefixes(key).find(prefix => !knownBefore.has(prefix));
      if (!root) {
        lines.push(`  + ${key} = ${is}`);
        continue;
      }
      if (!opened.has(root)) {
        opened.add(root);
        lines.push(`  + ${root}`);
      }
      if (fields) lines.push(`      ${key.slice(root.length).replace(/^\./, '')} = ${is}`);
    } else {
      const root = entityPrefixes(key).find(prefix => !knownAfter.has(prefix));
      if (!root) {
        lines.push(`  - ${key} = ${was}`);
      } else if (!opened.has(root)) {
        opened.add(root);
        lines.push(`  - ${root}`);
      }
    }
  }
  return lines.length > 0 ? lines : ['  (unchanged)'];
}

const change = (was, is) => (was === is ? `${is} (unchanged)` : `${was} -> ${is}`);

/** Generated ids become `wp#1`, `gn#1` …, numbered by first appearance. */
function nameNewIds(text) {
  const names = new Map();
  const counts = new Map();
  return text.replace(/(?<![A-Za-z0-9])(wp|gn|ge|em|fl)_\d{10,}_[a-z0-9]+/g, (id, kind) => {
    if (!names.has(id)) {
      const next = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, next);
      names.set(id, `${kind}#${next}`);
    }
    return names.get(id);
  });
}

function countsText(counts) {
  const parts = COUNT_ORDER.filter(name => counts.has(name)).map(name => `${name} ${counts.get(name)}`);
  return parts.length > 0 ? parts.join(', ') : 'nothing counted';
}

/**
 * The copy browser recovery holds: the last autosave handed to storage in
 * this test, unless the key was removed after it, as Clear All removes it.
 * Calls on the two storage mocks are ordered by Vitest's call counter.
 */
function storedRecovery() {
  const last = mock => mock.calls
    .map((args, index) => ({ args, order: mock.invocationCallOrder[index] }))
    .filter(({ args }) => args[0] === STORAGE.AUTOSAVE_KEY)
    .at(-1);
  const written = last(localStorage.setItem.mock);
  const removed = last(localStorage.removeItem.mock);
  if (!written || (removed && removed.order > written.order)) return null;
  return JSON.parse(written.args[1]);
}

/**
 * The project as browser recovery holds it, against the project as it
 * stands: what a reload now would lose or bring back stale.
 */
function recoveryLines(app) {
  const copy = storedRecovery();
  if (!copy) return ['recovery: nothing stored'];
  const [stored, live] = [new Map(), new Map()];
  flatten(stored, '', copy);
  flatten(live, '', app._buildProjectSnapshot({ includeAssets: false }));
  const gap = diffLines(stored, live, { fields: false });
  return gap[0] === '  (unchanged)'
    ? ['recovery: as the project stands']
    : ['recovery (stored -> project):', ...gap];
}

/**
 * Drive one row on a fresh app and return its transcript section.
 *
 * The act runs, then its promise continuations; that is "at once". Then the
 * clock runs on `LATER_MS`, and every timer due in that time runs, in order;
 * that is "later". The project, selection and history are read before the
 * act and after each phase, so a change shows in the phase that made it. The
 * engine runs only the frames it is asked for, so a playing transport shows
 * one frame there, not a loop.
 */
async function transcribe(row) {
  const app = await bootWith(row.fixture);
  fakeTimers();
  const context = {};
  if (row.setup) await row.setup(app, context);
  await settleSetup(app);

  const recorder = new Recorder();
  const states = [observe(app, row)];
  instrument(app, recorder);
  recording = recorder;
  try {
    recorder.begin('at once');
    await row.act(app, { ...context, reply: () => recorder.reply() });
    await drainPromises();
    states.push(observe(app, row));
    recorder.begin('later', { timed: true });
    await vi.advanceTimersByTimeAsync(LATER_MS);
    await drainPromises();
    states.push(observe(app, row));
  } finally {
    recording = null;
    recorder.restore();
  }

  const lines = [`## ${row.title}`, `fixture: ${row.fixture}`];
  if (row.given) lines.push(`given: ${row.given}`);
  if (row.how) lines.push(`act: ${row.how}`);
  recorder.phases.forEach((phase, index) => {
    const [was, is] = [states[index], states[index + 1]];
    lines.push(`${phase.name}: ${countsText(phase.counts)}`, ...phase.lines);
    lines.push('  model:', ...diffLines(was.model, is.model).map(line => `  ${line}`));
    lines.push(`  selection: ${change(was.selection, is.selection)}`);
    lines.push(`  history: ${change(was.history, is.history)}`);
  });
  const [first, last] = [states[0], states.at(-1)];
  for (const key of row.watch ?? []) {
    if (first.model.get(key) === last.model.get(key)) lines.push(`kept ${key} = ${last.model.get(key)}`);
  }
  lines.push(...recoveryLines(app));
  return nameNewIds(lines.join('\n'));
}

// ========== THE ROWS ==========

const wp = (app, id) => app.getWaypointById(id);
const emit = (app, name, ...args) => app.eventBus.emit(name, ...args);
const select = (app, id) => emit(app, 'waypoint:selected', wp(app, id));
const screenAt = (app, x, y) => app.imageToScreen(x, y);
const screenOf = (app, id) => screenAt(app, wp(app, id).imgX, wp(app, id).imgY);

/** Start dragging a waypoint and move it, as the pointer would. */
function dragTo(app, context, id, x, y) {
  const waypoint = wp(app, id);
  context.dragGroup = [{ waypoint, imgX: waypoint.imgX, imgY: waypoint.imgY }];
  select(app, id);
  emit(app, 'waypoint:position-changed', {
    waypoint, imgX: x, imgY: y, dragGroup: context.dragGroup, isDragging: true, shiftKey: false,
  });
}

/** The midpoint "+" of a leg, in screen space, where the editor draws it. */
function legPlus(app, index) {
  const progress = app.getWaypointProgressValues();
  const count = app.pathPoints.length;
  const start = Math.round(progress[index] * (count - 1));
  const end = Math.round(progress[index + 1] * (count - 1));
  const mid = app.pathPoints[Math.round((start + end) / 2)];
  return { screen: screenAt(app, mid.x, mid.y), image: mid };
}

/** The swatch shown as chosen for a colour input, as its picker shows it. */
function checkedSwatch(input) {
  const picker = document.querySelector(`.swatch-picker[data-target-input="${input}"]`);
  return picker?.querySelector('input[type="radio"]:checked')?.value ?? 'none';
}

/** What a video export reads from the app before its first await (`exporting.js`). */
function exportHandoff(app) {
  const { format, frameRate, resolutionX, resolutionY, pathOnly } = app.exportSettings;
  return `format ${JSON.stringify(format)}, ${frameRate} fps, ${resolutionX}x${resolutionY}, path only ${pathOnly}` +
    `, in ${app.previewMode ? 'Preview' : 'Edit'}`;
}

/** Select several waypoints, with one as primary, as the canvas does. */
function multiSelect(app, ids, primary) {
  emit(app, 'waypoint:multi-selected', { waypoints: ids.map(id => wp(app, id)), primary: wp(app, primary) });
}

/** J/K/L with L pressed twice: playing forward at 2x. */
function playAtDoubleSpeed(app) {
  emit(app, 'animation:jkl-forward');
  emit(app, 'animation:jkl-forward');
}

const PLAYING_AT_2X = 'L pressed twice from the start: playing forward at 2x';

/** The J/K/L state DEF-15 is about: the live copy, and the copy nothing reads. */
const JKL_STATE = ['runtime.jkl.live', 'runtime.jkl.unused', 'runtime.transport.playbackSpeed'];

/**
 * The rows for `wiringControllers.js`, in the order the file subscribes.
 * Each runs on a fresh app; `setup` reaches the given state through the bus,
 * and `act` makes the emit the row is about.
 */
const CONTROLLER_ROWS = [
  {
    event: 'background:upload', fixture: 'open day',
    given: 'decoding replaced, since jsdom decodes no images: the app\'s loadImageFileAsset notes the file it is'
      + ' given and answers a prepared 1600x900 image',
    setup: (app, context) => {
      const asset = new ImageAsset({
        id: 'asset-upload', base64: PIXEL_DATA_URL, name: 'campus.png', width: 1600, height: 900,
        mimeType: 'image/png', size: 68,
      });
      asset._imageElement = stubImage([1600, 900]);
      context.file = new File([new Uint8Array(68)], 'campus.png', { type: 'image/png' });
      app.loadImageFileAsset = async file => {
        recording?.note(`decoding asked for ${summarise(file)}${file === context.file ? ', the file uploaded' : ''}`);
        return asset;
      };
    },
    act: (app, { file }) => emit(app, 'background:upload', file),
  },
  { event: 'background:overlay-change', fixture: 'open day', act: app => emit(app, 'background:overlay-change', 40) },
  { event: 'background:mode-change', fixture: 'open day', act: app => emit(app, 'background:mode-change', 'fill') },
  {
    event: 'ui:animation:play', fixture: 'open day', given: 'paused at the start, as loaded',
    act: app => emit(app, 'ui:animation:play'),
  },
  {
    event: 'ui:animation:play', title: 'ui:animation:play at the end', fixture: 'open day', given: 'paused at the end',
    setup: app => emit(app, 'ui:animation:skip-end'),
    act: app => emit(app, 'ui:animation:play'),
  },
  {
    event: 'ui:animation:pause', fixture: 'open day', given: 'playing from the start',
    setup: app => emit(app, 'ui:animation:play'),
    act: app => emit(app, 'ui:animation:pause'),
  },
  {
    event: 'ui:animation:skip-start', fixture: 'open day', given: 'paused half way',
    setup: app => emit(app, 'ui:animation:seek', 0.5),
    act: app => emit(app, 'ui:animation:skip-start'),
  },
  {
    event: 'ui:animation:skip-end', fixture: 'open day', given: 'paused at the start, as loaded',
    act: app => emit(app, 'ui:animation:skip-end'),
  },
  { event: 'ui:animation:seek', fixture: 'open day', act: app => emit(app, 'ui:animation:seek', 0.5) },
  {
    event: 'animation:speed-change', fixture: 'open day', given: 'paused half way',
    setup: app => emit(app, 'ui:animation:seek', 0.5),
    act: app => emit(app, 'animation:speed-change', 400),
  },
  {
    event: 'animation:jkl-reverse', fixture: 'open day', given: 'paused half way',
    setup: app => emit(app, 'ui:animation:seek', 0.5),
    act: app => emit(app, 'animation:jkl-reverse'),
  },
  {
    event: 'animation:jkl-forward', fixture: 'open day', given: 'paused at the start, as loaded',
    act: app => emit(app, 'animation:jkl-forward'),
  },
  {
    event: 'animation:jkl-forward', title: 'animation:jkl-forward after L, L and a pause (DEF-15)', fixture: 'open day',
    given: 'L pressed twice from the start, then the pause button', watch: JKL_STATE,
    setup: app => {
      playAtDoubleSpeed(app);
      emit(app, 'ui:animation:pause');
    },
    act: app => emit(app, 'animation:jkl-forward'),
  },
  {
    event: 'ui:animation:toggle', fixture: 'open day', given: 'paused half way',
    setup: app => emit(app, 'ui:animation:seek', 0.5),
    act: app => emit(app, 'ui:animation:toggle'),
  },
  {
    event: 'ui:animation:toggle', title: 'ui:animation:toggle while playing at 2x', fixture: 'open day',
    given: PLAYING_AT_2X,
    setup: app => playAtDoubleSpeed(app),
    act: app => emit(app, 'ui:animation:toggle'),
  },
  {
    event: 'waypoint:nudge', fixture: 'open day', given: 'ex-uon-3 selected',
    setup: app => select(app, 'ex-uon-3'),
    act: app => emit(app, 'waypoint:nudge', { waypoint: wp(app, 'ex-uon-3'), dxFraction: 0.005, dyFraction: 0 }),
  },
  {
    event: 'waypoint:nudge', title: 'waypoint:nudge under a 2x editor zoom (DEF-16)', fixture: 'open day',
    given: 'ex-uon-3 selected, the editor zoomed to 2x on it',
    how: 'the right-arrow nudge the canvas sends at that zoom',
    setup: app => {
      select(app, 'ex-uon-3');
      app.setZoom(2, wp(app, 'ex-uon-3'));
    },
    act: app => emit(app, 'waypoint:nudge', {
      waypoint: wp(app, 'ex-uon-3'), dxFraction: 0.005 / app.interactionHandler.zoomLevel, dyFraction: 0,
    }),
  },
  {
    event: 'waypoint:nudge', title: 'waypoint:nudge with two waypoints selected', fixture: 'open day',
    given: 'ex-uon-1 and ex-uon-3 selected, ex-uon-3 primary',
    setup: app => emit(app, 'waypoint:multi-selected', {
      waypoints: [wp(app, 'ex-uon-1'), wp(app, 'ex-uon-3')], primary: wp(app, 'ex-uon-3'),
    }),
    act: app => emit(app, 'waypoint:nudge', { waypoint: wp(app, 'ex-uon-3'), dxFraction: 0, dyFraction: -0.02 }),
  },
  {
    event: 'waypoint:nudge', title: 'waypoint:nudge past the map\'s edge', fixture: 'open day',
    given: 'ex-uon-3 selected', how: 'a nudge of 30% of the canvas to the right (CON-13: the clamp at 100% zoom)',
    setup: app => select(app, 'ex-uon-3'),
    act: app => emit(app, 'waypoint:nudge', { waypoint: wp(app, 'ex-uon-3'), dxFraction: 0.3, dyFraction: 0 }),
  },
  {
    event: 'waypoint:nudge', title: 'waypoint:nudge past the map\'s edge, zoomed out to 50%', fixture: 'open day',
    given: 'the map zoomed out to 50%, ex-uon-3 selected',
    how: 'a nudge of 30% of the canvas to the right (CON-13: the clamp zoomed out)',
    setup: app => {
      emit(app, 'background:zoom-change', 50);
      select(app, 'ex-uon-3');
    },
    act: app => emit(app, 'waypoint:nudge', { waypoint: wp(app, 'ex-uon-3'), dxFraction: 0.3, dyFraction: 0 }),
  },
  {
    event: 'waypoint:add', fixture: 'open day', given: 'ex-uon-3 selected',
    setup: app => select(app, 'ex-uon-3'),
    act: app => emit(app, 'waypoint:add', { imgX: 0.9, imgY: 0.3, isMajor: true, shiftKey: false }),
  },
  {
    event: 'waypoint:add', title: 'waypoint:add, a minor after the selected waypoint', fixture: 'open day',
    given: 'ex-uon-2 selected',
    setup: app => select(app, 'ex-uon-2'),
    act: app => emit(app, 'waypoint:add', { imgX: 0.7, imgY: 0.5, isMajor: false, shiftKey: false }),
  },
  {
    event: 'waypoint:add', title: 'waypoint:add with Shift held, snapped to 15°', fixture: 'open day',
    given: 'ex-uon-3 selected',
    setup: app => select(app, 'ex-uon-3'),
    act: app => emit(app, 'waypoint:add', { imgX: 0.95, imgY: 0.37, isMajor: true, shiftKey: true }),
  },
  {
    event: 'waypoint:add', title: 'waypoint:add, the first waypoint of an empty route', fixture: 'empty route',
    act: app => emit(app, 'waypoint:add', { imgX: 0.3, imgY: 0.4, isMajor: true, shiftKey: false }),
  },
  {
    event: 'waypoint:add', title: 'waypoint:add after the first waypoint of a branch (DEF-22)',
    fixture: 'open day, two-waypoint branch',
    how: 'the semantic insert, as the scene outline makes it',
    act: app => emit(app, 'waypoint:add', { imgX: 0.53, imgY: 0.22, isMajor: true, insertAfterId: 'ex-uon-b1' }),
  },
  {
    event: 'route:branch-arm', fixture: 'open day',
    act: app => emit(app, 'route:branch-arm', { waypoint: wp(app, 'ex-uon-1') }),
  },
  {
    event: 'route:branch-arm', title: 'route:branch-arm on a minor waypoint', fixture: 'open day',
    act: app => emit(app, 'route:branch-arm', { waypoint: wp(app, 'ex-uon-2a') }),
  },
  {
    event: 'route:branch-cancel', fixture: 'open day', given: 'a branch armed at ex-uon-1',
    setup: app => emit(app, 'route:branch-arm', { waypoint: wp(app, 'ex-uon-1') }),
    act: app => emit(app, 'route:branch-cancel'),
  },
  {
    event: 'route:branch-place', fixture: 'open day', given: 'a branch armed at ex-uon-1',
    setup: app => emit(app, 'route:branch-arm', { waypoint: wp(app, 'ex-uon-1') }),
    act: app => emit(app, 'route:branch-place', { imgX: 0.2, imgY: 0.3 }),
  },
  {
    event: 'route:branch-rejoin', fixture: 'open day',
    how: 'the branch end dropped on the waypoint it already rejoins',
    act: app => emit(app, 'route:branch-rejoin', { waypoint: wp(app, 'ex-uon-b1'), targetId: 'ex-uon-3' }),
  },
  { event: 'waypoint:selected', fixture: 'open day', act: app => select(app, 'ex-uon-2') },
  {
    event: 'waypoint:multi-selected', fixture: 'open day',
    act: app => emit(app, 'waypoint:multi-selected', {
      waypoints: [wp(app, 'ex-uon-3'), wp(app, 'ex-uon-1')], primary: wp(app, 'ex-uon-3'),
    }),
  },
  {
    event: 'waypoint:toggle-select', fixture: 'open day', given: 'ex-uon-1 selected',
    setup: app => select(app, 'ex-uon-1'),
    act: app => emit(app, 'waypoint:toggle-select', wp(app, 'ex-uon-3')),
  },
  {
    event: 'waypoint:toggle-select', title: 'waypoint:toggle-select, the primary out of four', fixture: 'open day',
    given: 'ex-uon-1, ex-uon-2, ex-uon-2a and ex-uon-3 selected, ex-uon-3 primary',
    how: 'ex-uon-3 toggled off: the reducer CON-02 merges promotes a survivor (here the last)',
    setup: app => multiSelect(app, ['ex-uon-1', 'ex-uon-2', 'ex-uon-2a', 'ex-uon-3'], 'ex-uon-3'),
    act: app => emit(app, 'waypoint:toggle-select', wp(app, 'ex-uon-3')),
  },
  {
    event: 'waypoint:toggle-select', title: 'waypoint:toggle-select, another out of three', fixture: 'open day',
    given: 'ex-uon-1, ex-uon-2a and ex-uon-3 selected, ex-uon-3 primary', how: 'ex-uon-1 toggled off',
    setup: app => multiSelect(app, ['ex-uon-1', 'ex-uon-2a', 'ex-uon-3'], 'ex-uon-3'),
    act: app => emit(app, 'waypoint:toggle-select', wp(app, 'ex-uon-1')),
  },
  {
    event: 'waypoint:toggle-select', title: 'waypoint:toggle-select, two down to one', fixture: 'open day',
    given: 'ex-uon-1 and ex-uon-3 selected, ex-uon-3 primary', how: 'ex-uon-3 toggled off',
    setup: app => multiSelect(app, ['ex-uon-1', 'ex-uon-3'], 'ex-uon-3'),
    act: app => emit(app, 'waypoint:toggle-select', wp(app, 'ex-uon-3')),
  },
  {
    event: 'waypoint:toggle-select', title: 'waypoint:toggle-select, the only one', fixture: 'open day',
    given: 'ex-uon-1 selected', how: 'ex-uon-1 toggled off',
    setup: app => select(app, 'ex-uon-1'),
    act: app => emit(app, 'waypoint:toggle-select', wp(app, 'ex-uon-1')),
  },
  {
    event: 'waypoint:deselected', fixture: 'open day', given: 'ex-uon-2 selected',
    setup: app => select(app, 'ex-uon-2'),
    act: app => emit(app, 'waypoint:deselected'),
  },
  {
    event: 'waypoint:delete', fixture: 'open day', given: 'ex-uon-1 selected',
    setup: app => select(app, 'ex-uon-1'),
    act: app => emit(app, 'waypoint:delete', wp(app, 'ex-uon-1')),
  },
  {
    event: 'waypoint:delete', title: 'waypoint:delete, the primary of three selected', fixture: 'open day',
    given: 'ex-uon-1, ex-uon-2a and ex-uon-3 selected, ex-uon-1 primary',
    how: 'ex-uon-1 deleted: deleting promotes a survivor (here the last), the other reducer CON-02 merges',
    setup: app => multiSelect(app, ['ex-uon-1', 'ex-uon-2a', 'ex-uon-3'], 'ex-uon-1'),
    act: app => emit(app, 'waypoint:delete', wp(app, 'ex-uon-1')),
  },
  {
    event: 'waypoint:delete-selected', fixture: 'open day', given: 'ex-uon-2a selected',
    setup: app => select(app, 'ex-uon-2a'),
    act: app => emit(app, 'waypoint:delete-selected'),
  },
  {
    event: 'waypoint:delete-selected', title: 'waypoint:delete-selected with two waypoints selected',
    fixture: 'open day', given: 'ex-uon-1 and ex-uon-2a selected',
    setup: app => emit(app, 'waypoint:multi-selected', {
      waypoints: [wp(app, 'ex-uon-1'), wp(app, 'ex-uon-2a')], primary: wp(app, 'ex-uon-2a'),
    }),
    act: app => emit(app, 'waypoint:delete-selected'),
  },
  { event: 'waypoints:clear-all', fixture: 'open day', act: app => emit(app, 'waypoints:clear-all') },
  {
    event: 'waypoint:add-at-center', fixture: 'open day',
    given: 'nothing selected; both of the file\'s listeners for this event run',
    act: app => emit(app, 'waypoint:add-at-center'),
  },
  {
    event: 'waypoint:name-changed', fixture: 'open day', how: 'ex-uon-2 renamed in the list, then reported on the bus',
    act: app => {
      wp(app, 'ex-uon-2').name = 'Trent';
      emit(app, 'waypoint:name-changed', { waypoint: wp(app, 'ex-uon-2'), name: 'Trent' });
    },
  },
  {
    event: 'waypoint:show-context-menu', fixture: 'open day',
    act: app => emit(app, 'waypoint:show-context-menu', { waypoint: wp(app, 'ex-uon-2'), x: 400, y: 300 }),
  },
  {
    event: 'canvas:show-context-menu', fixture: 'open day', how: 'a right-click on the map, clear of the route',
    act: app => {
      const point = screenAt(app, 0.3, 0.85);
      emit(app, 'canvas:show-context-menu', { x: point.x + 10, y: point.y + 60, canvasX: point.x, canvasY: point.y });
    },
  },
  {
    event: 'canvas:show-context-menu', title: 'canvas:show-context-menu in the margin, zoomed out to 50%',
    fixture: 'open day', given: 'the map zoomed out to 50%',
    how: 'a right-click in the margin beside the map (CON-13: the bounds rule zoomed out)',
    setup: app => emit(app, 'background:zoom-change', 50),
    act: app => emit(app, 'canvas:show-context-menu', { x: 30, y: 380, canvasX: 20, canvasY: 330 }),
  },
  {
    event: 'waypoint:toggle-type', fixture: 'open day',
    act: app => emit(app, 'waypoint:toggle-type', wp(app, 'ex-uon-2a')),
  },
  {
    event: 'waypoint:insert-adjacent', fixture: 'open day',
    act: app => emit(app, 'waypoint:insert-adjacent', { waypoint: wp(app, 'ex-uon-1'), where: 'after' }),
  },
  {
    event: 'waypoint:insert-adjacent', title: 'waypoint:insert-adjacent after the first waypoint of a branch (DEF-22)',
    fixture: 'open day, two-waypoint branch',
    act: app => emit(app, 'waypoint:insert-adjacent', { waypoint: wp(app, 'ex-uon-b1'), where: 'after' }),
  },
  {
    event: 'waypoint:insert-adjacent', title: 'waypoint:insert-adjacent after the last waypoint of a branch (DEF-22)',
    fixture: 'open day, two-waypoint branch',
    act: app => emit(app, 'waypoint:insert-adjacent', { waypoint: wp(app, 'ex-uon-b2'), where: 'after' }),
  },
  {
    event: 'waypoint:request-rename', fixture: 'open day',
    act: app => emit(app, 'waypoint:request-rename', wp(app, 'ex-uon-2')),
  },
  { event: 'video:frame-rate-change', fixture: 'open day', act: app => emit(app, 'video:frame-rate-change', 25) },
  { event: 'video:layers-change', fixture: 'open day', act: app => emit(app, 'video:layers-change', true) },
  {
    event: 'video:camera-change', fixture: 'open day', given: 'Preview mode',
    setup: app => emit(app, 'motion:preview-mode-change', true),
    act: app => emit(app, 'video:camera-change', true),
  },
  {
    event: 'video:text-change', fixture: 'open day', given: 'Preview mode',
    setup: app => emit(app, 'motion:preview-mode-change', true),
    act: app => emit(app, 'video:text-change', false),
  },
  {
    event: 'video:resolution-change', fixture: 'open day',
    act: app => emit(app, 'video:resolution-change', { width: 1280, height: null }),
  },
  {
    event: 'video:resolution-change', title: 'video:resolution-change, a new height', fixture: 'open day',
    act: app => emit(app, 'video:resolution-change', { width: null, height: 720 }),
  },
  { event: 'video:resolution-native', fixture: 'open day', act: app => emit(app, 'video:resolution-native') },
  { event: 'background:zoom-change', fixture: 'open day', act: app => emit(app, 'background:zoom-change', 150) },
  {
    event: 'video:export-request', fixture: 'open day',
    given: 'the format at its default, MP4; the app\'s whole exportVideo replaced, since jsdom has no encoder, by'
      + ' a note of what it was asked for and the settings it reads before its first await',
    setup: app => {
      app.exportVideo = (...asked) => recording?.note(
        `exportVideo called (replaced) with ${JSON.stringify(asked)}: it would read ${exportHandoff(app)}`);
    },
    act: app => emit(app, 'video:export-request', 'webm'),
  },
  { event: 'html:export-request', fixture: 'open day', act: app => emit(app, 'html:export-request') },
  {
    event: 'motion:preview-mode-change', fixture: 'open day',
    act: app => emit(app, 'motion:preview-mode-change', true),
  },
  ...[
    ['motion:path-visibility-change', 'instantaneous'],
    ['motion:path-trail-change', 0.25],
    ['motion:waypoint-visibility-change', 'hide-before'],
    ['motion:background-visibility-change', 'spotlight-reveal'],
    ['motion:reveal-size-change', 15],
    ['motion:reveal-feather-change', 30],
    ['motion:reveal-trail-change', 50],
    ['motion:aov-angle-change', 90],
    ['motion:aov-distance-change', 40],
    ['motion:aov-dropoff-change', 70],
  ].map(([event, value]) => ({
    event, fixture: 'open day', given: 'Preview mode',
    setup: app => emit(app, 'motion:preview-mode-change', true),
    act: app => emit(app, event, value),
  })),
  {
    event: 'waypoints:reordered', fixture: 'PARM walk', how: 'ex-parm-2 dragged above ex-parm-1 in the list',
    act: app => emit(app, 'waypoints:reordered', ['ex-parm-2', 'ex-parm-1', 'ex-parm-3'].map(id => wp(app, id))),
  },
  {
    event: 'coordinate:canvas-to-image', fixture: 'open day', how: 'the screen point of ex-uon-2',
    act: (app, { reply }) => {
      const point = screenOf(app, 'ex-uon-2');
      emit(app, 'coordinate:canvas-to-image', { canvasX: point.x, canvasY: point.y }, reply());
    },
  },
  {
    event: 'coordinate:image-to-canvas', fixture: 'open day',
    act: (app, { reply }) => emit(app, 'coordinate:image-to-canvas', { imgX: 0.4, imgY: 0.47 }, reply()),
  },
  {
    event: 'coordinate:check-bounds', fixture: 'open day', how: 'a point on the map, then one in the margin beside it',
    act: (app, { reply }) => {
      const inside = screenAt(app, 0.5, 0.5);
      emit(app, 'coordinate:check-bounds', { canvasX: inside.x, canvasY: inside.y }, reply());
      emit(app, 'coordinate:check-bounds', { canvasX: 20, canvasY: inside.y }, reply());
    },
  },
  {
    event: 'coordinate:check-bounds', title: 'coordinate:check-bounds, zoomed out to 50%', fixture: 'open day',
    given: 'the map zoomed out to 50%',
    how: 'a point on the map, then one in the margin beside it (CON-13: the bounds rule zoomed out)',
    setup: app => emit(app, 'background:zoom-change', 50),
    act: (app, { reply }) => {
      const inside = screenAt(app, 0.5, 0.5);
      emit(app, 'coordinate:check-bounds', { canvasX: inside.x, canvasY: inside.y }, reply());
      emit(app, 'coordinate:check-bounds', { canvasX: 20, canvasY: inside.y }, reply());
    },
  },
  {
    event: 'waypoint:check-branch-handle', fixture: 'open day',
    how: 'the branch handle of the first waypoint a bound crowd enters from, then a point on the map',
    act: (app, { reply }) => {
      const entries = boundEntryWaypointIds(app.scene);
      const entry = app.waypoints.find(each => entries.has(each.id));
      const handle = app.waypointBranchHandleAt(entry);
      const point = app.canvasToScreen(handle.x, handle.y);
      emit(app, 'waypoint:check-branch-handle', { x: point.x, y: point.y }, reply());
      const map = screenAt(app, 0.3, 0.85);
      emit(app, 'waypoint:check-branch-handle', { x: map.x, y: map.y }, reply());
    },
  },
  {
    event: 'waypoint:check-at-position', fixture: 'open day', how: 'the screen point of ex-uon-2',
    act: (app, { reply }) => emit(app, 'waypoint:check-at-position', screenOf(app, 'ex-uon-2'), reply()),
  },
  {
    event: 'area:check-handle', fixture: 'authored extras', given: 'ex-uon-2 (a rectangle area) selected',
    how: 'the centre handle of its area',
    setup: app => select(app, 'ex-uon-2'),
    act: (app, { reply }) => {
      const area = wp(app, 'ex-uon-2').areaHighlight;
      const point = screenAt(app, area.centerX, area.centerY);
      emit(app, 'area:check-handle', { screenX: point.x, screenY: point.y }, reply());
    },
  },
  {
    event: 'canvas:hover-move', fixture: 'open day', how: 'the pointer over ex-uon-2',
    act: (app, { reply }) => emit(app, 'canvas:hover-move', screenOf(app, 'ex-uon-2'), reply()),
  },
  {
    event: 'canvas:hover-move', title: 'canvas:hover-move over a leg\'s "+"', fixture: 'PARM walk',
    how: 'the pointer over the midpoint of the first leg',
    act: (app, { reply }) => emit(app, 'canvas:hover-move', legPlus(app, 0).screen, reply()),
  },
  {
    event: 'canvas:hover-clear', fixture: 'open day', given: 'the pointer over ex-uon-2',
    setup: app => emit(app, 'canvas:hover-move', screenOf(app, 'ex-uon-2'), () => {}),
    act: app => emit(app, 'canvas:hover-clear'),
  },
  {
    event: 'segment:check-at-position', fixture: 'PARM walk', how: 'the midpoint of the first leg',
    act: (app, { reply }) => emit(app, 'segment:check-at-position', legPlus(app, 0).screen, reply()),
  },
  {
    event: 'segment:check-at-position', title: 'segment:check-at-position on a branched route', fixture: 'open day',
    how: 'the midpoint of the first leg',
    act: (app, { reply }) => emit(app, 'segment:check-at-position', legPlus(app, 0).screen, reply()),
  },
  {
    event: 'segment:clicked', fixture: 'open day',
    act: app => emit(app, 'segment:clicked', { waypoint: wp(app, 'ex-uon-2') }),
  },
  {
    event: 'waypoint:insert-on-leg', fixture: 'PARM walk', how: 'the "+" on the first leg',
    act: app => {
      const { image } = legPlus(app, 0);
      emit(app, 'waypoint:insert-on-leg', { waypointIndex: 0, imgX: image.x, imgY: image.y });
    },
  },
  {
    event: 'waypoint:insert-on-leg', title: 'waypoint:insert-on-leg between the two waypoints of a branch (DEF-22)',
    fixture: 'open day, two-waypoint branch', how: 'halfway between ex-uon-b1 and ex-uon-b2',
    act: app => emit(app, 'waypoint:insert-on-leg', {
      waypointIndex: app.waypoints.indexOf(wp(app, 'ex-uon-b1')), imgX: 0.53, imgY: 0.22,
    }),
  },
  { event: 'help:toggle', fixture: 'open day', act: app => emit(app, 'help:toggle') },
  { event: 'help:show-shortcuts', fixture: 'open day', act: app => emit(app, 'help:show-shortcuts') },
  {
    event: 'waypoint:deselect', fixture: 'open day', given: 'ex-uon-2 selected',
    setup: app => select(app, 'ex-uon-2'),
    act: app => emit(app, 'waypoint:deselect'),
  },
  {
    event: 'waypoint:duplicate', fixture: 'open day', given: 'ex-uon-2 selected',
    setup: app => select(app, 'ex-uon-2'),
    act: app => emit(app, 'waypoint:duplicate'),
  },
  { event: 'waypoint:select-all', fixture: 'open day', act: app => emit(app, 'waypoint:select-all') },
  {
    event: 'waypoint:select-all', title: 'waypoint:select-all, keeping the selected waypoint as primary',
    fixture: 'open day', given: 'ex-uon-3 selected',
    setup: app => select(app, 'ex-uon-3'),
    act: app => emit(app, 'waypoint:select-all'),
  },
  {
    event: 'ui:toast', fixture: 'open day',
    act: app => emit(app, 'ui:toast', { message: 'Shift-click deletes; Ctrl+Z brings it back', duration: 3000 }),
  },
  {
    event: 'canvas:zoom-in', fixture: 'open day', given: 'ex-uon-2 selected',
    setup: app => select(app, 'ex-uon-2'),
    act: app => emit(app, 'canvas:zoom-in'),
  },
  {
    event: 'canvas:zoom-in', title: 'canvas:zoom-in with nothing selected', fixture: 'open day',
    act: app => emit(app, 'canvas:zoom-in'),
  },
  {
    event: 'canvas:zoom-out', fixture: 'open day', given: 'ex-uon-2 selected, zoomed in once',
    setup: app => {
      select(app, 'ex-uon-2');
      emit(app, 'canvas:zoom-in');
    },
    act: app => emit(app, 'canvas:zoom-out'),
  },
  {
    event: 'canvas:zoom-reset', fixture: 'open day', given: 'ex-uon-2 selected, zoomed in once',
    setup: app => {
      select(app, 'ex-uon-2');
      emit(app, 'canvas:zoom-in');
    },
    act: app => emit(app, 'canvas:zoom-reset'),
  },
  {
    event: 'undo:state-change', fixture: 'open day',
    act: app => emit(app, 'undo:state-change', { canUndo: true, canRedo: true, undoCount: 1, redoCount: 1 }),
  },
  {
    event: 'history:undo', fixture: 'open day', given: 'ex-uon-3 nudged right, its undo entry saved',
    setup: app => {
      select(app, 'ex-uon-3');
      emit(app, 'waypoint:nudge', { waypoint: wp(app, 'ex-uon-3'), dxFraction: 0.02, dyFraction: 0 });
    },
    act: app => emit(app, 'history:undo'),
  },
  {
    event: 'history:redo', fixture: 'open day', given: 'ex-uon-3 nudged right, then undone',
    setup: async app => {
      select(app, 'ex-uon-3');
      emit(app, 'waypoint:nudge', { waypoint: wp(app, 'ex-uon-3'), dxFraction: 0.02, dyFraction: 0 });
      await settleSetup(app);
      emit(app, 'history:undo');
    },
    act: app => emit(app, 'history:redo'),
  },
  { event: 'file:save', fixture: 'open day', act: app => emit(app, 'file:save') },
];

/** The rows for `wiringBus.js`, in the order the file subscribes. */
const BUS_ROWS = [
  {
    event: 'waypoint:added', fixture: 'open day', how: 'a minor spliced in after ex-uon-2a, then reported on the bus',
    act: app => {
      const waypoint = Waypoint.createMinor(0.58, 0.6);
      app.waypoints.splice(app.waypoints.indexOf(wp(app, 'ex-uon-2a')) + 1, 0, waypoint);
      emit(app, 'waypoint:added', waypoint);
    },
  },
  {
    event: 'waypoint:deleted', fixture: 'open day', how: 'ex-uon-2b spliced out, then reported by its index',
    act: app => {
      const index = app.waypoints.indexOf(wp(app, 'ex-uon-2b'));
      app._removeWaypointFromMap(wp(app, 'ex-uon-2b'));
      app.waypoints.splice(index, 1);
      emit(app, 'waypoint:deleted', index);
    },
  },
  {
    event: 'waypoint:position-changed', fixture: 'open day', given: 'ex-uon-3 selected',
    how: 'ex-uon-3 moved by the editor\'s own arrow-key handler, which sends the waypoint alone',
    setup: app => select(app, 'ex-uon-3'),
    act: app => {
      const waypoint = wp(app, 'ex-uon-3');
      waypoint.imgX = 0.8;
      emit(app, 'waypoint:position-changed', waypoint);
    },
  },
  {
    event: 'waypoint:position-changed', title: 'waypoint:position-changed mid-drag', fixture: 'open day',
    given: 'ex-uon-3 selected', how: 'one pointer move of a drag',
    setup: app => select(app, 'ex-uon-3'),
    act: app => {
      const waypoint = wp(app, 'ex-uon-3');
      emit(app, 'waypoint:position-changed', {
        waypoint, imgX: 0.8, imgY: 0.5, isDragging: true, shiftKey: false,
        dragGroup: [{ waypoint, imgX: waypoint.imgX, imgY: waypoint.imgY }],
      });
    },
  },
  {
    event: 'waypoint:position-changed', title: 'waypoint:position-changed, a group drag past the map\'s edge',
    fixture: 'open day', given: 'ex-uon-1 and ex-uon-3 selected, ex-uon-3 primary',
    how: 'one pointer move dragging both, ex-uon-3 to 1.3 across (CON-13: one shared delta kept on the map)',
    setup: app => multiSelect(app, ['ex-uon-1', 'ex-uon-3'], 'ex-uon-3'),
    act: app => {
      const dragGroup = ['ex-uon-1', 'ex-uon-3'].map(id => wp(app, id))
        .map(waypoint => ({ waypoint, imgX: waypoint.imgX, imgY: waypoint.imgY }));
      emit(app, 'waypoint:position-changed', {
        waypoint: wp(app, 'ex-uon-3'), imgX: 1.3, imgY: 0.42, isDragging: true, shiftKey: false, dragGroup,
      });
    },
  },
  {
    event: 'waypoint:drag-ended', fixture: 'open day', given: 'ex-uon-3 dragged to (0.8, 0.5)',
    setup: (app, context) => dragTo(app, context, 'ex-uon-3', 0.8, 0.5),
    act: (app, { dragGroup }) => {
      const drop = screenAt(app, 0.8, 0.5);
      emit(app, 'waypoint:drag-ended', { waypoint: wp(app, 'ex-uon-3'), dragGroup, dropX: drop.x, dropY: drop.y });
    },
  },
  {
    event: 'waypoint:drag-ended', title: 'waypoint:drag-ended, a branch end dropped on its rejoin', fixture: 'open day',
    given: 'ex-uon-b1, the branch\'s last waypoint, dragged onto ex-uon-3',
    setup: (app, context) => dragTo(app, context, 'ex-uon-b1', wp(app, 'ex-uon-3').imgX, wp(app, 'ex-uon-3').imgY),
    act: (app, { dragGroup }) => {
      const drop = screenOf(app, 'ex-uon-3');
      emit(app, 'waypoint:drag-ended', { waypoint: wp(app, 'ex-uon-b1'), dragGroup, dropX: drop.x, dropY: drop.y });
    },
  },
  {
    event: 'waypoint:drag-cancelled', fixture: 'open day', given: 'ex-uon-3 dragged to (0.8, 0.5)',
    setup: (app, context) => dragTo(app, context, 'ex-uon-3', 0.8, 0.5),
    act: (app, { dragGroup }) => emit(app, 'waypoint:drag-cancelled', { positions: dragGroup }),
  },
  {
    event: 'waypoint:style-changed', fixture: 'open day', how: 'ex-uon-2\'s dot colour set, then reported on the bus',
    act: app => {
      wp(app, 'ex-uon-2').dotColor = '#56B4E9';
      emit(app, 'waypoint:style-changed', wp(app, 'ex-uon-2'));
    },
  },
  {
    event: 'area:changed', fixture: 'open day', how: 'ex-uon-2 given a circle area, then reported on the bus',
    act: app => {
      Object.assign(wp(app, 'ex-uon-2').areaHighlight, { shape: 'circle', centerX: 0.4, centerY: 0.47 });
      emit(app, 'area:changed', { waypoint: wp(app, 'ex-uon-2') });
    },
  },
  {
    event: 'area:draw-mode-changed', fixture: 'open day', given: 'Preview mode',
    setup: app => emit(app, 'motion:preview-mode-change', true),
    act: app => emit(app, 'area:draw-mode-changed', { active: true }),
  },
  { event: 'render:request', fixture: 'open day', act: app => emit(app, 'render:request') },
  {
    event: 'area:draw-completed', fixture: 'open day', given: 'ex-uon-2 selected',
    setup: app => select(app, 'ex-uon-2'),
    act: app => emit(app, 'area:draw-completed', { waypoint: wp(app, 'ex-uon-2') }),
  },
  {
    event: 'ui:refresh-swatches', fixture: 'open day',
    given: 'the area fill\'s hidden input set to None without an input event, as the inspector writes it, so its'
      + ' swatches still show the old choice (jsdom loads no stylesheet, so only None has a swatch value)',
    setup: () => {
      document.querySelector('#area-fill-color').value = 'transparent';
    },
    observe: () => ({
      areaFillSwatch: checkedSwatch('#area-fill-color'),
      areaBorderSwatch: checkedSwatch('#area-border-color'),
    }),
    act: app => emit(app, 'ui:refresh-swatches', { targets: ['#area-fill-color', '#area-border-color'] }),
  },
  {
    event: 'waypoint:path-property-changed', fixture: 'open day',
    how: 'ex-uon-2\'s leg colour set, then reported on the bus',
    act: app => {
      wp(app, 'ex-uon-2').segmentColor = '#009E73';
      emit(app, 'waypoint:path-property-changed', wp(app, 'ex-uon-2'));
    },
  },
  {
    event: 'waypoint:pause-changed', fixture: 'open day', how: 'ex-uon-2\'s wait set to 3 s, then reported on the bus',
    act: app => {
      Object.assign(wp(app, 'ex-uon-2'), { pauseTime: 3000, pauseMode: 'timed' });
      emit(app, 'waypoint:pause-changed', { waypoint: wp(app, 'ex-uon-2'), pauseTime: 3000, pauseMode: 'timed' });
    },
  },
  {
    event: 'waypoint:speed-changed', fixture: 'open day',
    how: 'ex-uon-2\'s leg speed set to 2x, then reported on the bus',
    act: app => {
      wp(app, 'ex-uon-2').segmentSpeed = 2;
      emit(app, 'waypoint:speed-changed', { waypoint: wp(app, 'ex-uon-2'), segmentSpeed: 2 });
    },
  },
  {
    event: 'animation:play', fixture: 'open day', given: 'paused at the start, as loaded',
    how: 'the engine plays, and sends the notice',
    act: app => app.animationEngine.play(),
  },
  {
    event: 'animation:pause', title: 'animation:pause after L, L (DEF-15)', fixture: 'open day', given: PLAYING_AT_2X,
    how: 'the engine pauses, and sends the notice', watch: JKL_STATE,
    setup: app => playAtDoubleSpeed(app),
    act: app => app.animationEngine.pause(),
  },
  {
    event: 'animation:complete', title: 'animation:complete after L, L (DEF-15)', fixture: 'open day',
    given: PLAYING_AT_2X,
    how: 'the notice the engine sends as it plays past the end, sent alone', watch: JKL_STATE,
    setup: app => playAtDoubleSpeed(app),
    act: app => emit(app, 'animation:complete'),
  },
  {
    event: 'animation:reset', title: 'animation:reset after L, L (DEF-15)', fixture: 'open day', given: PLAYING_AT_2X,
    how: 'the engine resets, and sends the notice', watch: JKL_STATE,
    setup: app => playAtDoubleSpeed(app),
    act: app => app.animationEngine.reset(),
  },
  {
    event: 'animation:waypointWaitEnd', fixture: 'open day',
    how: 'the notice the engine sends as a wait ends, sent alone',
    act: app => emit(app, 'animation:waypointWaitEnd', 1),
  },
];

const crowdLayer = app => app.scene.getFlowLayers().find(each => each.id === 'ex-uon-crowd');

/**
 * The outline's emitter form as it submits: untouched percentages carry the
 * stored value they were drawn from, so only the changed field differs.
 */
function emitterCommand(app, changes) {
  const layer = crowdLayer(app);
  const emitter = layer.emitters[0];
  const command = {
    action: 'update-emitter', layerId: layer.id, emitterId: emitter.id, outlineOriginalValues: {},
  };
  const percentFields = [
    'releaseStart', 'releaseDuration', 'onsetVariance', 'speedVariance', 'wobble', 'intensityRamp',
  ];
  for (const field of percentFields) {
    command[field] = String(emitter[field] * 100);
    command.outlineOriginalValues[field] = { display: command[field], canonical: emitter[field] };
  }
  return Object.assign(command, {
    dotCount: emitter.dotCount, speed: emitter.speed, dotSize: emitter.dotSize,
    dotColor: emitter.dotColor, lifecycleMode: emitter.lifecycleMode,
  }, changes);
}

/**
 * The scene-edit commits CON-03 will merge into one, wherever the bus reaches
 * them: the scene outline's commands, the guide network's commit and the
 * crowd cards' debounced change. The crowd strip's own buttons and sliders
 * reach the rest from the DOM, which is TST-04's ground.
 */
const SCENE_EDIT_ROWS = [
  {
    event: 'scene-outline:command', module: 'sceneOutline.js', title: 'scene-outline:command update-waypoint',
    fixture: 'open day', how: 'ex-uon-2 moved to 45% across in the outline',
    act: app => emit(app, 'scene-outline:command', {
      action: 'update-waypoint', waypointId: 'ex-uon-2', x: '45', y: '47', waitSeconds: '2', segmentSpeed: '1',
    }),
  },
  {
    event: 'scene-outline:command', module: 'sceneOutline.js', title: 'scene-outline:command update-crowd',
    fixture: 'open day', how: 'the crowd renamed in the outline',
    act: app => emit(app, 'scene-outline:command', {
      action: 'update-crowd', layerId: 'ex-uon-crowd', name: 'Open day visitors', guideType: 'graph', visible: 'shown',
    }),
  },
  {
    event: 'scene-outline:command', module: 'sceneOutline.js', title: 'scene-outline:command update-emitter',
    fixture: 'open day', how: 'the crowd\'s dots raised from 60 to 80 in the outline',
    act: app => emit(app, 'scene-outline:command', emitterCommand(app, { dotCount: '80' })),
  },
  {
    event: 'scene-outline:command', module: 'sceneOutline.js', title: 'scene-outline:command create-polygon',
    fixture: 'open day',
    act: app => emit(app, 'scene-outline:command', { action: 'create-polygon', waypointId: 'ex-uon-3' }),
  },
  {
    event: 'scene-outline:command', module: 'sceneOutline.js', title: 'scene-outline:command add-crowd',
    fixture: 'open day',
    act: app => emit(app, 'scene-outline:command', { action: 'add-crowd' }),
  },
  {
    event: 'scene-outline:command', module: 'sceneOutline.js', title: 'scene-outline:command delete-crowd',
    fixture: 'open day',
    act: app => emit(app, 'scene-outline:command', { action: 'delete-crowd', layerId: 'ex-uon-crowd' }),
  },
  {
    event: 'network:changed', module: 'network.js', fixture: 'open day',
    how: 'the first edge of the crowd\'s network weighted 3, then committed',
    act: app => {
      crowdLayer(app).graph.getEdges()[0].setWeight(3);
      emit(app, 'network:changed', { commit: true });
    },
  },
  {
    event: 'crowd:param-changed', module: 'crowds.js', fixture: 'open day',
    how: 'the crowd\'s walking speed set on its card, then reported on the bus',
    act: app => {
      crowdLayer(app).emitters[0].update({ speed: 0.08 });
      emit(app, 'crowd:param-changed');
    },
  },
];

/**
 * Events the two files subscribe to that have no row, with the reason, as
 * `{ 'event:name': 'why it cannot be driven here' }`. Each must still be
 * subscribed, and must not also have a row. None is needed today: the two
 * rows whose handler reaches something jsdom cannot run (decoding an image,
 * encoding a video) replace just that step, and say so in their "given".
 */
const NOT_TRANSCRIBED = {
  'wiringControllers.js': {},
  'wiringBus.js': {},
};

const GOLDENS = [
  { file: 'event-transcript-wiring-controllers.txt', source: 'wiringControllers.js', rows: CONTROLLER_ROWS },
  { file: 'event-transcript-wiring-bus.txt', source: 'wiringBus.js', rows: BUS_ROWS },
  { file: 'event-transcript-scene-edits.txt', source: null, rows: SCENE_EDIT_ROWS },
];

for (const golden of GOLDENS) {
  for (const row of golden.rows) row.title ??= row.event;
}

// ========== THE TESTS ==========

function goldenPath(file) {
  return join(goldenDir, file);
}

/** A golden's sections by title. Missing file: no sections. */
function goldenSections(file) {
  const path = goldenPath(file);
  const sections = new Map();
  if (!existsSync(path)) return sections;
  let title = null;
  let lines = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith('## ')) {
      if (title !== null) sections.set(title, lines.join('\n').trimEnd());
      title = line.slice(3);
      lines = [line];
    } else if (title !== null) {
      lines.push(line);
    }
  }
  if (title !== null) sections.set(title, lines.join('\n').trimEnd());
  return sections;
}

function transcriptHeader(golden) {
  return [
    golden.source
      ? `# What each event ${golden.source} subscribes to does, one fresh app per row.`
      : '# What the scene-edit commits CON-03 will merge do, reached through the bus.',
    '# A row starts in Edit mode, nothing selected, the transport paused at the',
    '# start, unless its "given" says otherwise. "at once" is the emit and its',
    '# promise continuations; "later" runs the clock on ten seconds, and each line',
    '# no emit caused carries the time since the act. Nested lines are what an',
    '# emit caused; "·" marks a counted step, an undo entry with what an Undo would',
    '# take back. Each phase ends with the change it made to the project, the',
    '# selection and the undo history; "recovery" compares the copy browser',
    '# recovery holds with the project. Written by tests/eventTranscript.test.js',
    '# (TST-05); regenerate with UPDATE_EVENT_GOLDENS=1 and read the diff.',
  ].join('\n');
}

const REGISTRATIONS = 'event-registrations.txt';

/**
 * What this run recorded, kept until the file ends: the registration golden
 * and each transcript's sections, by row title.
 */
const recorded = {
  registrations: null,
  sections: new Map(GOLDENS.map(golden => [golden.file, new Map()])),
};

function goldenText(golden) {
  const sections = recorded.sections.get(golden.file);
  return `${transcriptHeader(golden)}\n\n${golden.rows.map(row => sections.get(row.title)).join('\n\n')}\n`;
}

/**
 * Whole files are compared, and written, once every test has run, in
 * whatever order they ran. A run that left a test unrecorded (a `-t`
 * filter, a failure) has compared each section it recorded in its own test,
 * and compares no whole file; asked to regenerate, it writes nothing and
 * fails, so a partial run cannot overwrite a golden.
 */
afterAll(() => {
  const missing = [
    ...(recorded.registrations === null ? ['the registration test'] : []),
    ...GOLDENS.flatMap(golden => golden.rows
      .filter(row => !recorded.sections.get(golden.file).has(row.title))
      .map(row => `${golden.file}: ${row.title}`)),
  ];
  if (UPDATING) {
    if (missing.length > 0) {
      throw new Error(`UPDATE_EVENT_GOLDENS=1 wrote nothing: ${missing.length} tests did not record, ` +
        `starting with "${missing[0]}". Regenerate with a run of the whole file.`);
    }
    writeFileSync(goldenPath(REGISTRATIONS), recorded.registrations, 'utf8');
    for (const golden of GOLDENS) writeFileSync(goldenPath(golden.file), goldenText(golden), 'utf8');
    return;
  }
  for (const golden of GOLDENS) {
    const sections = recorded.sections.get(golden.file);
    if (!golden.rows.every(row => sections.has(row.title))) continue;
    const path = goldenPath(golden.file);
    expect(existsSync(path), `Missing golden ${path}`).toBe(true);
    expect(readFileSync(path, 'utf8'), `${golden.file} differs from the rows just recorded`).toBe(goldenText(golden));
  }
});

describe('the bus listeners', () => {
  test('once the app is ready, every listener is where the golden says, in the same order', async () => {
    const { app, noted } = await bootNotingListeners();
    const text = registrationGolden(listenerTable(app, noted));
    expect(text, 'a listener whose module could not be read').not.toMatch(/\((unknown|unattributed)\)/);
    recorded.registrations = text;
    if (UPDATING) return;
    const path = goldenPath(REGISTRATIONS);
    expect(existsSync(path), `Missing golden ${path}`).toBe(true);
    expect(text).toBe(readFileSync(path, 'utf8'));
  });

  test('every event the two wiring files subscribe to has a row or a stated reason, and no more', async () => {
    const { noted } = await bootNotingListeners();
    for (const golden of GOLDENS.filter(each => each.source)) {
      const subscribed = new Set(noted.filter(each => each.module === golden.source).map(each => each.eventName));
      const transcribed = new Set(golden.rows.map(row => row.event));
      const excused = new Set(Object.keys(NOT_TRANSCRIBED[golden.source] ?? {}));
      const sorted = set => [...set].sort(byText);
      expect(sorted([...subscribed].filter(name => !transcribed.has(name) && !excused.has(name))),
        `${golden.source}: subscribed with no row`).toEqual([]);
      expect(sorted([...transcribed, ...excused].filter(name => !subscribed.has(name))),
        `${golden.source}: a row or reason for an event it no longer subscribes to`).toEqual([]);
      expect(sorted([...transcribed].filter(name => excused.has(name))),
        `${golden.source}: both a row and a reason`).toEqual([]);
    }
  });

  test('every scene-edit row\'s event is still subscribed by the module it names', async () => {
    const { noted } = await bootNotingListeners();
    const unheard = SCENE_EDIT_ROWS.filter(row =>
      !noted.some(each => each.module === row.module && each.eventName === row.event));
    expect(unheard.map(row => `${row.module} ${row.event}`)).toEqual([]);
  });
});

for (const golden of GOLDENS) {
  describe(`the transcript of ${golden.source ?? 'the scene-edit commits'}`, () => {
    const expected = goldenSections(golden.file);
    const titles = golden.rows.map(row => row.title);

    test('has one row per title', () => {
      expect(new Set(titles).size).toBe(titles.length);
    });

    for (const row of golden.rows) {
      test(`${row.title} does what its transcript records`, async () => {
        const text = await transcribe(row);
        recorded.sections.get(golden.file).set(row.title, text);
        if (UPDATING) return;
        expect(expected.has(row.title), `No section for "${row.title}" in ${golden.file}`).toBe(true);
        expect(text).toBe(expected.get(row.title));
      }, 20000);
    }
  });
}
