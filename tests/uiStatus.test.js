/**
 * UI-06 PR 4 — status, errors and destructive actions (B-16 = DEF-91, B-17,
 * B-18, B-22, B-31, J-05 = C-5, J-18; B-23 is in unrestoredAutosave.test.js).
 *
 * UI-STANDARDS, System status: "Every async action must show status …
 * Auto-save, export, import, and recovery states must be visible." Error
 * prevention: "disable impossible actions", "No silent propagation of invalid
 * states." Motion: "Respect prefers-reduced-motion." Empty states: "No blank
 * panels or silent failures." The review found the save state carried only by
 * a "●" and its tooltip, a failed example background that said nothing, export
 * items that stayed enabled when they could not work and failed through
 * `alert()`, a card flash that always scrolled smoothly, two live regions
 * reading each delete twice, and a crowd with no emitter that left the
 * previous crowd's controls on screen. Nothing pinned any of it.
 *
 * What is pinned here: the header's status line (`#app-status`, a status
 * beside a decorative glyph) through an edit, the recovery write, opening an
 * example, and a video export (whose progress leaves the disabled menu toggle
 * alone); a background that fails to load, uploaded or bundled, as a toast the
 * author must hear with the canvas area busy meanwhile; the export items
 * disabled with a described reason, and a refused export as a toast, never an
 * `alert` (none is left in `src/`); the flash's scroll under reduced motion;
 * the toast container not live and every toast announced once through the
 * queue, so a delete is heard once; and a crowd with no emitter disabling its
 * cards with a line that says so.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { loadBackgroundFile } from '../src/app/backgroundLoading.js';
import { isMac } from '../src/config/keybindings.js';
import { VideoExporter } from '../src/services/VideoExporter.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const UNDO = `press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`;

const id = name => document.getElementById(name);
const status = () => id('app-status').textContent;
/** The text an element is described by, through every token of its `aria-describedby`. */
const describedBy = element => (element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
  .map(token => id(token)?.textContent ?? `<missing ${token}>`).join(' ').trim();

async function editor() {
  const app = await bootApp();
  await app.ready;
  // The splash's focus trap would take a later Escape.
  id('splash-close').click();
  return app;
}

async function routeOfTwo() {
  const app = await editor();
  app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
  expect(app.waypoints).toHaveLength(2);
  return app;
}

/** What the app tells the author: every toast and every announcement, in turn. */
function listen(app) {
  const toasts = [];
  app.eventBus.on('ui:toast', toast => toasts.push(toast));
  const announce = vi.spyOn(app, 'announce');
  return { toasts, announced: () => announce.mock.calls.map(([message, priority = 'polite']) => [message, priority]) };
}

const scrollIntoView = Element.prototype.scrollIntoView;
const matchMedia = window.matchMedia;

afterEach(() => {
  vi.unstubAllGlobals();
  Element.prototype.scrollIntoView = scrollIntoView;
  window.matchMedia = matchMedia;
});

describe('the header status line (UI-06 B-17)', () => {
  test('is a status beside a decorative glyph, says "Unsaved changes" on an edit and "Saved to browser recovery" once the write lands', async () => {
    const app = await editor();
    const line = id('app-status');
    const glyph = id('title-indicator');
    const title = id('app-title');
    expect(line.closest('header.header')).not.toBeNull();
    expect(line.getAttribute('role')).toBe('status');
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
    expect(title.textContent).toBe('Route Plotter');
    // Nothing has happened: nothing to say, and no glyph.
    expect(status()).toBe('');
    expect(glyph.hidden).toBe(true);

    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
    expect(status()).toBe('Unsaved changes');
    expect(glyph.hidden).toBe(false);
    // The title is the app's name alone; the status text carries the meaning.
    expect(title.textContent).toBe('Route Plotter');

    expect(app.storageService.flushAutoSave()).toBe(true);
    expect(status()).toBe('Saved to browser recovery');
    // Recovery is not the project file: the glyph stays until that is saved.
    expect(glyph.hidden).toBe(false);

    app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
    expect(status()).toBe('Unsaved changes');
  });

  test('says "Opening Open day route…" while an example opens, then that it is in browser recovery; a failed one, that it could not be opened', async () => {
    const app = await editor();
    const serveRepository = globalThis.fetch;
    // The shipped archive, as the site serves it from the build output.
    globalThis.fetch = vi.fn(input => serveRepository(String(input).replace(/^examples\//, 'docs/examples/')));
    const shown = vi.spyOn(app, 'setStatus');

    expect(await app.loadExampleProject('uon-open-day')).toBe(true);
    expect(shown.mock.calls.map(([text]) => text)).toContain('Opening Open day route…');
    expect(status()).toBe('Saved to browser recovery');
    expect(id('title-indicator').hidden).toBe(true);

    allowConsole(/Failed to open example project/);
    globalThis.fetch = serveRepository; // no examples/ folder: 404
    const { toasts } = listen(app);
    expect(await app.loadExampleProject('parm-aerial-walk')).toBe(false);
    expect(status()).toBe('Could not open Site walk');
    // One message, with the reason, heard as the toast it is.
    expect(toasts).toEqual([{ message: 'Could not open Site walk: HTTP 404', priority: 'assertive' }]);
  });
});

describe('export progress in the status line (UI-06 J-18)', () => {
  test('a video export writes its progress and its end to the status line, never into the disabled menu toggle', async () => {
    const app = await routeOfTwo();
    const toggle = id('export-dropdown-btn');
    const toggleText = toggle.textContent;
    const inFlight = [];
    app.videoExporter = {
      export: vi.fn(async ({ onProgress }) => {
        onProgress(42);
        inFlight.push({ status: status(), toggle: toggle.textContent, disabled: toggle.disabled });
        return new Blob(['video']);
      }),
      cancel: vi.fn(),
    };
    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    const shown = vi.spyOn(app, 'setStatus');

    await app.exportVideo({ format: 'mp4' });

    expect(inFlight).toEqual([{ status: 'Exporting MP4 42% · Esc to cancel', toggle: toggleText, disabled: true }]);
    expect(shown.mock.calls.map(([text]) => text).filter(text => /^Export/.test(text)))
      .toEqual(['Exporting MP4 0% · Esc to cancel', 'Exporting MP4 42% · Esc to cancel', 'Export complete']);
    expect(status()).toBe('Export complete');
    expect(toggle.textContent).toBe(toggleText);
    expect(toggle.disabled).toBe(false);
    expect([id('export-mp4-btn').disabled, id('export-webm-btn').disabled, id('export-html-btn').disabled]).toEqual([false, false, false]);
  });

  test('a cancelled export says so; a failed one says so and tells the author why', async () => {
    const app = await routeOfTwo();
    app.videoExporter = { export: vi.fn().mockRejectedValueOnce(new Error('Export cancelled')), cancel: vi.fn() };
    await app.exportVideo({ format: 'webm' });
    expect(status()).toBe('Export cancelled');

    allowConsole(/Video export failed/);
    const { toasts, announced } = listen(app);
    app.videoExporter.export = vi.fn().mockRejectedValueOnce(new Error('the encoder failed'));
    await app.exportVideo({ format: 'webm' });
    expect(status()).toBe('Export failed');
    expect(toasts).toEqual([{ message: 'Export failed: the encoder failed', priority: 'assertive' }]);
    expect(announced()).toContainEqual(['Export failed: the encoder failed', 'assertive']);
  });

  test('an HTML export says it is exporting, then that it is complete, and leaves its menu item’s words alone', async () => {
    const app = await routeOfTwo();
    const item = id('export-html-btn');
    const words = item.textContent;
    let seen;
    vi.spyOn(app.htmlExportService, 'exportHTML').mockImplementation(async () => {
      seen = { status: status(), words: item.textContent, disabled: item.disabled };
      return new Blob(['<html></html>'], { type: 'text/html' });
    });

    await app.exportHTML();

    expect(seen).toEqual({ status: 'Exporting HTML…', words, disabled: true });
    expect(status()).toBe('Export complete');
    expect(item.textContent).toBe(words);
    expect(item.disabled).toBe(false);
  });
});

describe('export validation (UI-06 B-18)', () => {
  test('the export items are disabled, with a described reason, until the route has two waypoints and, for HTML, a background', async () => {
    const app = await editor();
    const mp4 = id('export-mp4-btn');
    const webm = id('export-webm-btn');
    const html = id('export-html-btn');
    const line = id('export-menu-reason');
    expect(app.waypoints).toHaveLength(0);
    expect(app.background.image).not.toBeNull();

    expect([mp4.disabled, webm.disabled, html.disabled]).toEqual([true, true, true]);
    expect(describedBy(mp4)).toBe('Export MP4 and WebM need at least 2 waypoints.');
    expect(describedBy(webm)).toBe('Export MP4 and WebM need at least 2 waypoints.');
    expect(describedBy(html)).toBe('Export HTML needs at least 2 waypoints.');
    expect(line.hidden).toBe(false);
    // The toggle stays: the diagnostics items behind it still work.
    expect(id('export-dropdown-btn').disabled).toBe(false);

    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
    expect([mp4.disabled, webm.disabled, html.disabled]).toEqual([true, true, true]);
    app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
    expect([mp4.disabled, webm.disabled, html.disabled]).toEqual([false, false, false]);
    expect([describedBy(mp4), describedBy(webm), describedBy(html)]).toEqual(['', '', '']);
    expect(line.hidden).toBe(true);
    // The names never change with the state; the description does.
    expect([mp4.textContent, webm.textContent, html.textContent]).toEqual(['Export MP4…', 'Export WebM…', 'Export HTML…']);

    // A project with a route but no background: only HTML is refused.
    expect(await loadSnapshot(app, {
      coordVersion: 9,
      waypoints: [{ id: 'a', imgX: 0.2, imgY: 0.3, isMajor: true }, { id: 'b', imgX: 0.7, imgY: 0.6, isMajor: true }],
    })).toBe(true);
    expect(app.background.image).toBeNull();
    expect([mp4.disabled, webm.disabled, html.disabled]).toEqual([false, false, true]);
    expect(describedBy(html)).toBe('Export HTML needs a background image.');
    expect(line.hidden).toBe(false);

    // And with neither.
    app.eventBus.emit('waypoint:delete', app.waypoints[1]);
    expect([mp4.disabled, webm.disabled, html.disabled]).toEqual([true, true, true]);
    expect(describedBy(html)).toBe('Export HTML needs at least 2 waypoints and a background image.');
  });

  test('a refused or failed export is a toast the author must hear, never an alert', async () => {
    const app = await editor();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { toasts, announced } = listen(app);

    await app.exportVideo({ format: 'mp4' });
    expect(toasts).toEqual([{ message: 'Export MP4 and WebM need at least 2 waypoints.', priority: 'assertive' }]);
    expect(announced()).toContainEqual(['Export MP4 and WebM need at least 2 waypoints.', 'assertive']);

    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
    app.background.image = null;
    await app.exportHTML();
    expect(toasts.at(-1)).toEqual({ message: 'Export HTML needs a background image.', priority: 'assertive' });

    vi.spyOn(app, 'invalidateAnimationTiming').mockReturnValueOnce(0);
    await app.exportVideo({ format: 'mp4' });
    expect(toasts.at(-1)).toEqual({ message: 'Nothing to export: the animation has no duration.', priority: 'assertive' });

    expect(alert).not.toHaveBeenCalled();
  });

  test('no call to alert is left in src', () => {
    const files = [];
    const walk = folder => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith('.js')) files.push(path);
      }
    };
    walk(join(repoRoot, 'src'));
    expect(files.length).toBeGreaterThan(50);
    const calls = files.flatMap(path => {
      const code = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
      return [...code.matchAll(/(?:^|[^.\w$])(?:window\.)?alert\s*\(/g)].map(() => path.slice(repoRoot.length + 1));
    });
    expect(calls).toEqual([]);
  });
});

describe('a background that fails to load (UI-06 B-16, DEF-91)', () => {
  /** An image that fails to decode, whatever it is given. */
  const failingImages = () => vi.stubGlobal('Image', class {
    constructor() {
      setTimeout(() => this.onerror?.(new Event('error')), 0);
    }
    set src(value) {
      this._src = value;
    }
    get src() {
      return this._src;
    }
  });
  /** A real 1 × 1 PNG: its signature passes, so the decode is what fails. */
  const PIXEL_PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), c => c.charCodeAt(0));

  test('an example background that fails is a toast the author must hear, the canvas area is busy meanwhile, and the caller hears false', async () => {
    const app = await editor();
    allowConsole(/Failed to load example image/);
    const before = app.background.image;
    const { toasts, announced } = listen(app);
    const area = id('canvas-area');
    failingImages();

    const pending = app.loadExampleImage('images/Court.png');
    expect(area.getAttribute('aria-busy')).toBe('true');
    expect(await pending).toBe(false);

    expect(area.getAttribute('aria-busy')).toBe('false');
    expect(toasts).toEqual([{ message: 'Background not loaded: unsupported file. Use PNG, JPEG or WebP', priority: 'assertive' }]);
    expect(announced()).toEqual([['Background not loaded: unsupported file. Use PNG, JPEG or WebP', 'assertive']]);
    expect(app.background.image).toBe(before);
  });

  test('an uploaded file that fails to decode says so too', async () => {
    const app = await editor();
    allowConsole(/Background upload rejected/);
    const { toasts, announced } = listen(app);
    failingImages();

    expect(await loadBackgroundFile(app, new File([PIXEL_PNG], 'photo.png', { type: 'image/png' }))).toBe(false);

    expect(toasts).toEqual([{ message: 'Background not loaded: unsupported file. Use PNG, JPEG or WebP', priority: 'assertive' }]);
    expect(announced()).toEqual([['Background not loaded: unsupported file. Use PNG, JPEG or WebP', 'assertive']]);
    expect(id('canvas-area').getAttribute('aria-busy')).toBe('false');
  });

  test('an example the site cannot serve says why', async () => {
    const app = await editor();
    allowConsole(/Failed to load example image/);
    const { toasts } = listen(app);

    expect(await app.loadExampleImage('images/Missing.png')).toBe(false);

    expect(toasts).toEqual([{ message: 'Background not loaded: the file could not be fetched (HTTP 404)', priority: 'assertive' }]);
  });
});

describe('the card flash respects reduced motion (UI-06 B-22)', () => {
  test.each([
    ['reduce', 'auto', true],
    ['no-preference', 'smooth', false],
  ])('prefers-reduced-motion: %s scrolls the flashed card with behavior %s', async (_, behavior, reduce) => {
    const app = await editor();
    window.matchMedia = vi.fn(query => ({
      matches: reduce && query === '(prefers-reduced-motion: reduce)', media: query,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    }));
    const scrolls = [];
    Element.prototype.scrollIntoView = function record(options) {
      scrolls.push([this.dataset.section, options]);
    };

    app.sectionController.flashSection('marker');
    await new Promise(resolve => requestAnimationFrame(resolve));

    expect(scrolls).toEqual([['marker', { block: 'nearest', behavior }]]);
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});

describe('one live region (UI-06 J-05, C-5)', () => {
  test('the toast container is not live; a toast is announced once, through the queue, at its priority', async () => {
    const app = await editor();
    expect(id('toast-container').getAttribute('aria-live')).toBe('off');
    expect(id('announcer').getAttribute('aria-live')).toBe('polite');
    const { announced } = listen(app);

    app.showToast('Hello there');
    expect(announced()).toEqual([['Hello there', 'polite']]);
    app.eventBus.emit('ui:toast', { message: 'Hear this', priority: 'assertive' });
    expect(announced()).toEqual([['Hello there', 'polite'], ['Hear this', 'assertive']]);
    expect([...document.querySelectorAll('#toast-container .toast')].map(toast => toast.firstChild.textContent))
      .toEqual(['Hello there', 'Hear this']);
  });

  test('deleting a waypoint is heard once: the toast with its undo hint', async () => {
    const app = await routeOfTwo();
    const { toasts, announced } = listen(app);

    app.eventBus.emit('waypoint:delete', app.waypoints[0]);

    expect(app.waypoints).toHaveLength(1);
    expect(toasts).toEqual([{ message: `Deleted waypoint — ${UNDO}` }]);
    expect(announced()).toEqual([[`Deleted waypoint — ${UNDO}`, 'polite']]);
  });

  test('arming a branch, cancelling it, and a crowd traced from the route are each heard once', async () => {
    const app = await routeOfTwo();
    const { announced } = listen(app);

    app.eventBus.emit('route:branch-arm', { waypoint: app.waypoints[0] });
    expect(announced()).toEqual([['Branch from this waypoint — click where it should go (Esc to cancel)', 'polite']]);
    app.eventBus.emit('route:branch-cancel');
    expect(announced().at(-1)).toEqual(['Branch cancelled', 'polite']);

    const before = announced().length;
    app.addCrowd({ enterNetworkEditor: false });
    app.selectedCrowd.setGuideType('graph');
    expect(app.traceRouteIntoCrowd(app.selectedCrowd)).toBe(true);
    const traced = announced().slice(before).filter(([message]) => /^Traced the route into/.test(message));
    expect(traced).toHaveLength(1);
  });
});

describe('a crowd with no emitter (UI-06 B-31)', () => {
  const CARDS = ['dots', 'release', 'motion'];
  const card = name => document.querySelector(`#crowd-scope .settings-section[data-section="${name}"]`);
  const controlsOf = name => [...card(name).querySelectorAll('.section-content input, .section-content select, .section-content button')];
  /** The ids of a card's controls that are disabled by a rule of their own (Reset to even, with the busyness even). */
  const disabledIn = name => controlsOf(name).filter(control => control.disabled).map(control => control.id);

  test('disables the Dots, Release and Motion cards with a line that says so; a crowd with an emitter has them back', async () => {
    const app = await editor();
    expect(await loadSnapshot(app, {
      coordVersion: 9,
      waypoints: [{ id: 'a', imgX: 0.2, imgY: 0.3, isMajor: true }, { id: 'b', imgX: 0.7, imgY: 0.6, isMajor: true }],
      scene: { flowLayers: [{ id: 'empty', name: 'Empty crowd', guideType: 'graph', graph: { nodes: [], edges: [] }, emitters: [] }] },
    })).toBe(true);
    app.addCrowd({ enterNetworkEditor: false });
    const full = app.selectedCrowd;
    expect(full.emitters).toHaveLength(1);
    const line = id('crowd-no-emitter');
    expect(line.hidden).toBe(true);
    const ownRules = Object.fromEntries(CARDS.map(name => [name, disabledIn(name)]));
    expect(ownRules).toEqual({ dots: [], release: ['crowd-busyness-reset'], motion: [] });

    app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('empty'));

    expect(line.hidden).toBe(false);
    expect(line.textContent).toBe('This crowd has no emitter yet');
    for (const name of CARDS) {
      expect(controlsOf(name).length, name).toBeGreaterThan(0);
      expect(controlsOf(name).filter(control => !control.disabled), `${name} controls left enabled`).toEqual([]);
      expect(card(name).querySelector('.section-header').getAttribute('aria-describedby')).toBe('crowd-no-emitter');
    }
    // The guide is the crowd's, emitter or not.
    expect(id('crowd-guide-type').disabled).toBe(false);
    expect(id('crowd-guide-type').value).toBe('graph');

    app.eventBus.emit('crowd:selected', full);

    expect(line.hidden).toBe(true);
    for (const name of CARDS) {
      // Back as they were: only what a rule of its own disables.
      expect(disabledIn(name), name).toEqual(ownRules[name]);
      expect(card(name).querySelector('.section-header').hasAttribute('aria-describedby')).toBe(false);
    }
  });
});
