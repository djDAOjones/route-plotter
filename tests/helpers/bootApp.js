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

function stopApp(app) {
  const failures = [];
  const attempt = (step) => {
    try {
      step();
    } catch (error) {
      failures.push(error);
    }
  };

  attempt(() => { if (app._renderRafId) cancelAnimationFrame(app._renderRafId); });
  attempt(() => { app.renderQueued = false; });
  attempt(() => app.animationEngine?.stop?.() ?? app.animationEngine?.pause?.());
  attempt(() => app.storageService?.cancelAutoSave?.());
  attempt(() => app.eventBus?.removeAllListeners?.());
  return failures;
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
  document.body.innerHTML = shellBody;
  installBrowserStubs({ ...DEFAULT_VIEWPORT, ...viewport });

  delete window.app;
  // Imported once per worker on purpose: a fresh import would register another
  // DOMContentLoaded listener, and the next boot would build an app per
  // listener, leaving untracked apps running.
  await entryModule();
  document.dispatchEvent(new Event('DOMContentLoaded'));

  const app = window.app;
  if (!app) throw new Error('The app did not boot: window.app is unset');
  booted.add(app);

  // The bus swallows listener errors by design (ISO-02), which in a test means
  // a broken handler passes silently. Here they are failures.
  app.eventBus.onListenerError = (error, { eventName }) => {
    throw new Error(`Listener for "${eventName}" threw: ${error.message}`, { cause: error });
  };
  return app;
}
