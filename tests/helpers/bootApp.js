/**
 * Boot the whole application in jsdom (TST-01).
 *
 * Until this harness, no test loaded `src/main.js`: every test built its own
 * partial world, so nothing pinned the app as users meet it. The shell comes
 * from the shipped `index.html`, and the app starts the way a browser starts
 * it — import the entry module, then fire `DOMContentLoaded` — so the wiring
 * under test is the real wiring.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, vi } from 'vitest';
import { contextFor } from '../setup.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * A booted app keeps working after its test ends — a queued render, the
 * autosave debounce, the transport — and anything it logs then races the
 * environment's teardown. Every boot is stopped when its test finishes.
 */
const booted = new Set();

afterEach(() => {
  const failures = [];
  for (const app of booted) failures.push(...stopApp(app));
  booted.clear();
  delete window.app;
  // Each step is attempted, and a failure is reported rather than swallowed:
  // a throwing listener during teardown is exactly what the strict bus is for.
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, 'The booted app could not be stopped');
});

/**
 * Stop one booted app before its test ends and let it go, for a test that
 * replaces its app many times: kept until the test ended, hundreds of them
 * would exhaust the worker's heap.
 * @param {Object} app - An app `bootApp` returned
 */
export function retireApp(app) {
  if (!booted.delete(app)) return;
  const failures = stopApp(app);
  if (window.app === app) delete window.app;
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, 'The booted app could not be stopped');
}

function stopApp(app) {
  const failures = [];
  const attempt = (step) => {
    try {
      step();
    } catch (error) {
      failures.push(error);
    }
  };

  attempt(() => quiesce(app));
  attempt(() => app.storageService?.cancelAutoSave?.());
  attempt(() => app.eventBus?.removeAllListeners?.());
  attempt(() => releasePageListeners(app));
  // A dialog's focus trap listens on the window and the document while the
  // dialog is open (added as it shows, so not among the boot's own listeners
  // above): a splash a test never closed would take every later test's
  // Escape. Once start-up has settled, since the splash shows during it.
  attempt(() => onceSettled(app, () => deactivateFocusTraps(app)));
  attempt(() => releaseRecordingContexts(app));
  return failures;
}

function deactivateFocusTraps(app) {
  const traps = [app._splashFocusTrap, app._shareDisclosureTrap, app._diagnosticsTrap, app._discardFocusTrap,
    app.uiController?._codecFocusTrap, app.uiController?._clearFocusTrap];
  for (const trap of traps) trap?.deactivate?.();
}

/**
 * The shell each app's boot parsed (the body's children, as they stood), for
 * the canvas recorder (tests/setup.js). A canvas is an app's — its context
 * released when the app is stopped, after the test's assertions — only if it
 * is one the app holds (its page canvas, its layers' canvases) or stands in
 * that shell. Ownership is explicit, never a matter of when a canvas was
 * made: one a test makes for itself, before the boot, while its start-up is
 * pending or once it is ready, detached or beside the shell, is the test's
 * and stays. (A canvas a test puts inside the shell is the shell's.)
 * @type {WeakMap<object, Element[]>}
 */
const shellOf = new WeakMap();

/** The canvases an app owns: the ones it holds, and every one in its shell. */
function canvasesOf(app) {
  const owned = new Set([app.canvas, app.renderingService?.vectorCanvas, app.motionVisibilityService?.revealMaskCanvas]
    .filter(Boolean));
  for (const root of shellOf.get(app) ?? []) {
    if (root.matches?.('canvas')) owned.add(root);
    root.querySelectorAll?.('canvas').forEach(canvas => owned.add(canvas));
  }
  return [...owned];
}
/** The apps whose `ready` has settled: a stopped one is released at once. */
const settled = new WeakSet();

/**
 * Run `step` for a stopped app at once when its start-up has settled, else
 * once it has: a start-up still in flight (a test that did not await
 * `ready`) is left to finish — drawing against a live canvas, showing and
 * trapping its splash — rather than throwing into the next test's console or
 * leaving a trap it had not yet set.
 */
function onceSettled(app, step) {
  if (settled.has(app)) step();
  else Promise.resolve(app.ready).then(step, step);
}

/**
 * Release a stopped app's contexts (see `onceSettled` and `canvasesOf`). A
 * start-up still in flight when the app was stopped starts the render loop
 * again on its way to ready (`startRenderLoop` in `init`), so the loop is
 * stopped and its frames cancelled once more here, just before the release:
 * no frame of the app's is left to land on a released canvas.
 */
function releaseRecordingContexts(app) {
  if (!shellOf.has(app)) return;
  onceSettled(app, () => {
    quiesce(app);
    for (const canvas of canvasesOf(app)) contextFor(canvas)?.release();
    shellOf.delete(app);
  });
}

/** Stop what would draw: the queued render, the engine's loop and its frames. */
function quiesce(app) {
  if (app._renderRafId) cancelAnimationFrame(app._renderRafId);
  app._renderRafId = null;
  app.renderQueued = false;
  app.animationEngine?.stop?.() ?? app.animationEngine?.pause?.();
}

/**
 * The listeners a boot puts on the document and the window for the app (a
 * resize, a click, a keydown, a storage event: each closes over the app), by
 * app. With the canvas recorder letting a stopped app's contexts go, these
 * were what still kept the app alive, so a file that boots an app per test
 * held every one until it ended and the largest ran out of worker heap
 * (UI-06). Only what the synchronous boot registers is recorded, so a test's
 * own spies on `addEventListener` are never caught up in it. A listener that
 * is the document's rather than an app's says so in its options
 * (`documentLifetime: true`, ParamTooltip's `DOCUMENT_LIFETIME`): bound once
 * per document, it serves every app the document boots and holds none, so
 * it is left in place.
 * @type {WeakMap<object, Array<[EventTarget, string, EventListenerOrEventListenerObject, *]>>}
 */
const pageListeners = new WeakMap();

/** Whether listener options declare the listener the document's, not an app's. */
const forTheDocument = options => Boolean(options && typeof options === 'object' && options.documentLifetime);

function recordPageListeners(boot) {
  const added = [];
  const originals = [document, window].map(target => [target, target.addEventListener]);
  for (const [target, original] of originals) {
    target.addEventListener = function recordedAddEventListener(type, listener, options) {
      if (!forTheDocument(options)) added.push([target, type, listener, options]);
      return original.call(this, type, listener, options);
    };
  }
  try {
    return boot();
  } finally {
    for (const [target, original] of originals) target.addEventListener = original;
    if (window.app) pageListeners.set(window.app, added);
  }
}

function releasePageListeners(app) {
  for (const [target, type, listener, options] of pageListeners.get(app) ?? []) {
    target.removeEventListener(type, listener, options);
  }
  pageListeners.delete(app);
}

/** The shipped shell's body, without the script tags that load the bundle. */
function appShellBody() {
  const html = readFileSync(join(repoRoot, 'index.html'), 'utf8');
  const opening = html.indexOf('<body');
  const body = html.slice(html.indexOf('>', opening) + 1, html.lastIndexOf('</body>'));
  return body.replace(/<script\b[\s\S]*?<\/script>/g, '');
}

const shellBody = appShellBody();

/** jsdom lays nothing out, so the canvas would size itself to 0×0. */
const DEFAULT_VIEWPORT = Object.freeze({ width: 1280, height: 720, playbarHeight: 60 });

function fixSize(element, sizes) {
  for (const [name, value] of Object.entries(sizes)) {
    Object.defineProperty(element, name, { configurable: true, get: () => value });
  }
}

function installLayout({ width, height, playbarHeight }) {
  const area = document.querySelector('.canvas-area');
  const playbar = area?.querySelector('.controls');
  if (area) fixSize(area, { clientWidth: width, clientHeight: height });
  if (playbar) fixSize(playbar, { offsetHeight: playbarHeight });
}

/**
 * The app fetches its bundled example images by relative path, so the harness
 * serves the repository itself. Anything outside it fails loudly: a test that
 * needs the network needs its own fixture.
 */
function serveRepositoryFiles() {
  return vi.fn(async (input) => {
    const path = String(input).replace(/^\.?\//, '').split(/[?#]/)[0];
    const file = join(repoRoot, path);
    if (!file.startsWith(repoRoot) || !existsSync(file)) {
      return { ok: false, status: 404, statusText: 'Not Found' };
    }
    const bytes = readFileSync(file);
    return {
      ok: true,
      status: 200,
      blob: async () => new Blob([bytes]),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      text: async () => bytes.toString('utf8'),
      json: async () => JSON.parse(bytes.toString('utf8'))
    };
  });
}

/**
 * Stubs for what jsdom does not provide and the build normally injects.
 * `APP_VERSION` is an esbuild define, so without it `main.js` throws on load.
 */
function installBrowserStubs(viewport) {
  globalThis.APP_VERSION = '0.0.0-test';

  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
  }

  globalThis.fetch = serveRepositoryFiles();
  installLayout(viewport);
}

/**
 * Boot a fresh app and return the live `RoutePlotter` instance.
 *
 * The class is not exported: `main.js` assigns `window.app` on
 * `DOMContentLoaded`, which is the only way the app is ever constructed.
 */
let entryPromise = null;

/** The app entry module, imported once per worker. */
function entryModule() {
  entryPromise ??= import('../../src/main.js');
  return entryPromise;
}

export async function bootApp({ viewport = DEFAULT_VIEWPORT } = {}) {
  // An app booted earlier in this test lets its dialogs go before its shell
  // is replaced: detached, its splash's trap still listened on the window and
  // the document and took the Escape meant for this app's dialog (UI-06,
  // Codex r1). It is not stopped: a test may keep it beside this one (an
  // editor drawn beside its exported player), until the test ends.
  for (const earlier of booted) onceSettled(earlier, () => deactivateFocusTraps(earlier));
  document.body.innerHTML = shellBody;
  // The shell this boot parsed: what is in it is the app's (`canvasesOf`).
  const shell = [...document.body.children];
  installBrowserStubs({ ...DEFAULT_VIEWPORT, ...viewport });

  delete window.app;
  // Imported once per worker on purpose: a fresh import would register another
  // DOMContentLoaded listener, and the next boot would build an app per
  // listener, leaving untracked apps running.
  await entryModule();
  recordPageListeners(() => document.dispatchEvent(new Event('DOMContentLoaded')));

  const app = window.app;
  if (!app) throw new Error('The app did not boot: window.app is unset');
  booted.add(app);
  shellOf.set(app, shell);
  const over = () => settled.add(app);
  Promise.resolve(app.ready).then(over, over);

  // The bus swallows listener errors by design (ISO-02), which in a test means
  // a broken handler passes silently. Here they are failures.
  app.eventBus.onListenerError = (error, { eventName }) => {
    throw new Error(`Listener for "${eventName}" threw: ${error.message}`, { cause: error });
  };
  return app;
}
