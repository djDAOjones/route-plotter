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

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp, tipSeen } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { callsOf, lex, lexedFiles, lineAt } from './helpers/sourceScan.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { loadBackgroundFile } from '../src/app/backgroundLoading.js';
import { isMac } from '../src/config/keybindings.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { VideoExporter } from '../src/services/VideoExporter.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const UNDO = `press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`;

const id = name => document.getElementById(name);
const status = () => id('app-status').textContent;
/** The text an element is described by, through every token of its `aria-describedby`. */
const describedBy = element => (element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
  .map(token => id(token)?.textContent ?? `<missing ${token}>`).join(' ').trim();

/** What `alert`, `confirm` and `prompt` are reached through: the page's global object, by any of its names. */
const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self']);

/**
 * Every native dialog a file reaches (UI-06 B-18; Codex r1 found the regex scan
 * missed `globalThis.alert(…)` and `window['alert'](…)`, and could misread a
 * string as a comment): `alert`, `confirm` or `prompt` called bare, or called
 * or taken as a member of the global object (`window.alert.call(…)`, `const say
 * = globalThis.alert`), computed or spelled with an escape. Read as code by
 * the lexer `elementIds` uses, so a comment, a string, a template or a regular
 * expression is never a call; a name the file declares and uses as its own
 * (`prompt.classList`) is not one either. A bare call is counted whatever
 * declares it: `src/` has no function of these names.
 * @returns {string[]} `line: receiver.name` with `()` where it is called
 */
function nativeDialogsIn(lexed) {
  const found = [];
  for (const name of ['alert', 'confirm', 'prompt']) {
    const { calls, others } = callsOf(lexed, name);
    const mentions = [...calls.map(call => [call.index, true]), ...others.map(index => [index, false])];
    for (const [index, called] of mentions) {
      // `.name`, `?.name` or `['name']` is a member of what stands before it; anything else is the bare name.
      const before = lexed.code.slice(0, index).trimEnd();
      const member = before.endsWith('.') || (before.endsWith('[') && lexed.kind[index] === 's');
      const receiver = member ? /([A-Za-z_$][\w$]*)\s*(?:\?\.|\.|\[)$/.exec(before)?.[1] ?? '?' : '';
      const reached = member ? GLOBAL_OBJECTS.has(receiver) : called && lexed.kind[index] === 'c';
      if (reached) found.push([index, `${lineAt(lexed.source, index)}: ${member ? `${receiver}.` : ''}${name}${called ? '()' : ''}`]);
    }
  }
  return found.sort(([a], [b]) => a - b).map(([, text]) => text);
}

async function editor() {
  // The start's tip seen: its timer runs on the real clock and would land mid-test on a slow runner.
  localStorage.getItem.mockImplementation(tipSeen());
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

/**
 * The owner's answer, 2026-10-09 ("Speak changes, not repeats"): through the
 * one announcer, politely, "Unsaved changes" the first time an opened or
 * saved project changes, "Saved to browser recovery" the first time recovery
 * saves after that, then quiet until the next open or save; export progress
 * spoken at 25%, 50% and 75%. The status line itself stays `aria-live="off"`.
 */
describe('the status line, spoken as it changes, not as it repeats (UI-06 B-17, J-18; the owner, 2026-10-09)', () => {
  const UNSAVED = 'Unsaved changes';
  const RECOVERED = 'Saved to browser recovery';
  const add = (app, x) => app.eventBus.emit('waypoint:add', { imgX: x, imgY: 0.5, isMajor: true });
  /** How often each status was heard so far. */
  const counts = announced => [UNSAVED, RECOVERED].map(text => announced().filter(([message]) => message === text).length);

  test('an edit on a clean project is heard once as "Unsaved changes", the first recovery save after it once as "Saved to browser recovery", and the rest of the episode is quiet', async () => {
    const app = await editor();
    const { announced } = listen(app);

    add(app, 0.2);
    expect(announced().filter(([message]) => message === UNSAVED)).toEqual([[UNSAVED, 'polite']]);
    add(app, 0.4);
    expect(counts(announced)).toEqual([1, 0]);
    expect(app.storageService.flushAutoSave()).toBe(true);
    expect(announced().filter(([message]) => message === RECOVERED)).toEqual([[RECOVERED, 'polite']]);
    add(app, 0.6);
    expect(app.storageService.flushAutoSave()).toBe(true);
    expect(counts(announced)).toEqual([1, 1]);
    // The line still shows each; it is not a live region of its own.
    expect(status()).toBe(RECOVERED);
    expect(id('app-status').getAttribute('aria-live')).toBe('off');
  });

  test.each([
    ['a save', async (app) => {
      vi.spyOn(app.imageAssetService, 'downloadZip').mockImplementation(() => {});
      await app.saveProject();
      expect(status()).toBe('Project saved');
    }],
    ['an opened example', async (app) => {
      // The shipped archive, as the site serves it from the build output.
      const serveRepository = globalThis.fetch;
      globalThis.fetch = vi.fn(input => serveRepository(String(input).replace(/^examples\//, 'docs/examples/')));
      expect(await app.loadExampleProject('uon-open-day')).toBe(true);
    }],
    ['Clear all', async app => app.eventBus.emit('waypoints:clear-all')],
  ])('%s starts the episode again: its next change is heard, and the recovery save after it', async (_, begin) => {
    const app = await editor();
    const { announced } = listen(app);
    add(app, 0.2);
    expect(app.storageService.flushAutoSave()).toBe(true);
    expect(counts(announced)).toEqual([1, 1]);

    await begin(app);
    // Nothing is said of the new episode until it changes.
    expect(counts(announced)).toEqual([1, 1]);
    add(app, 0.5);
    add(app, 0.7);
    expect(app.storageService.flushAutoSave()).toBe(true);
    expect(counts(announced)).toEqual([2, 2]);
  });

  test('a recovery write that fails says so once, and recovery working again is heard again', async () => {
    const app = await editor();
    allowConsole(/Failed to save to localStorage/);
    const { announced } = listen(app);
    add(app, 0.2);
    expect(app.storageService.flushAutoSave()).toBe(true);
    expect(counts(announced)).toEqual([1, 1]);

    localStorage.setItem.mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    try {
      add(app, 0.4);
      app.storageService.flushAutoSave();
      expect(status()).toBe('Browser recovery failed');
      expect(announced().filter(([message]) => message.startsWith('Auto-save failed.'))).toHaveLength(1);
    } finally {
      localStorage.setItem.mockImplementation(() => {});
    }
    add(app, 0.6);
    expect(app.storageService.flushAutoSave()).toBe(true);
    expect(counts(announced)).toEqual([1, 2]);
    add(app, 0.8);
    expect(app.storageService.flushAutoSave()).toBe(true);
    expect(counts(announced)).toEqual([1, 2]);
  });

  test('a video export is heard at 25, 50 and 75 %, once each, in the status line\'s words, and each export again', async () => {
    const app = await routeOfTwo();
    const { announced } = listen(app);
    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    app.videoExporter = {
      // Every percent, each reported twice, as frames can be.
      export: vi.fn(async ({ onProgress }) => {
        for (let percent = 0; percent <= 100; percent += 1) {
          onProgress(percent);
          onProgress(percent);
        }
        return new Blob(['video']);
      }),
      cancel: vi.fn(),
    };
    const progress = () => announced().filter(([message]) => /^Exporting /.test(message));

    await app.exportVideo({ format: 'mp4' });
    expect(progress()).toEqual([['Exporting MP4 25%', 'polite'], ['Exporting MP4 50%', 'polite'], ['Exporting MP4 75%', 'polite']]);
    // The start and the end are said as they were, once each.
    expect(announced().filter(([message]) => /^(Starting video export|Video export complete)/.test(message)).map(([message]) => message))
      .toEqual(['Starting video export — press Esc to cancel', 'Video export complete']);

    await app.exportVideo({ format: 'mp4' });
    expect(progress()).toHaveLength(6);

    // Progress that jumps is heard at the furthest mark it passed, never at one behind it.
    app.videoExporter.export = vi.fn(async ({ onProgress }) => {
      [10, 60, 80, 100].forEach(onProgress);
      return new Blob(['video']);
    });
    await app.exportVideo({ format: 'webm' });
    expect(progress().slice(6)).toEqual([['Exporting WebM 50%', 'polite'], ['Exporting WebM 75%', 'polite']]);
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

  test('the Export menu opens on its first item that can run, never on a disabled one (Codex r1)', async () => {
    const app = await editor();
    const toggle = id('export-dropdown-btn');
    const key = (target, name) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    expect(app.waypoints).toHaveLength(0);
    expect([id('export-mp4-btn'), id('export-webm-btn'), id('export-html-btn')].map(item => item.disabled))
      .toEqual([true, true, true]);

    // Clicked open, and opened by the keyboard.
    toggle.focus();
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(id('download-debug-btn'));
    key(document.activeElement, 'Escape');
    expect(document.activeElement).toBe(toggle);
    key(toggle, 'ArrowDown');
    expect(document.activeElement).toBe(id('download-debug-btn'));
    key(document.activeElement, 'Escape');

    // Once the route has two waypoints, the first item can run, and is where it opens.
    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
    key(toggle, 'Enter');
    expect(document.activeElement).toBe(id('export-mp4-btn'));
    key(document.activeElement, 'Escape');
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

  test('no call to alert, confirm or prompt is left in src, however it is reached (Codex r1)', () => {
    const files = lexedFiles(repoRoot, 'src');
    expect(files.length).toBeGreaterThan(50);
    expect(files.flatMap(({ file, lexed }) => nativeDialogsIn(lexed).map(found => `${file}:${found}`))).toEqual([]);
  });

  test('the scan reads code, not text: every way of reaching a native dialog is found, a mention in a comment or a string is not', () => {
    const found = source => nativeDialogsIn(lex(source));
    expect(found([
      "alert('a');",
      "window.alert('b');",
      "globalThis.confirm('c');",
      "self.prompt('d');",
      "window['alert']('e');",
      'globalThis["confirm"]?.(\'f\');',
      "window.alert.call(window, 'g');",
      'const say = globalThis.alert; say(\'h\');',
      'window',
      "  .prompt('i');",
      "return alert('j');",
      "window.al\\u0065rt('k');",
    ].join('\n'))).toEqual([
      '1: alert()', '2: window.alert()', '3: globalThis.confirm()', '4: self.prompt()', '5: window.alert()',
      '6: globalThis.confirm()', '7: window.alert', '8: globalThis.alert', '10: window.prompt()', '11: alert()',
      '12: window.alert()',
    ]);
    expect(found([
      "// alert('a') in a comment",
      "/* window.confirm('b') */",
      'const text = "alert(\'c\') // prompt(";',
      "const template = `window.alert('d')`;",
      "const role = 'alert';",
      "let prompt = document.getElementById('zoom-prompt');",
      "prompt.classList.add('visible');",
      "dialog.confirm(choice);",
      "const pattern = /alert\\(/;",
    ].join('\n'))).toEqual([]);
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

  /**
   * Uploads whose files are read only when told: each `upload()` starts one,
   * and `settle(n)` lets the n-th go (it is refused, as a file that fails is).
   */
  function heldUploads(app) {
    const held = [];
    vi.spyOn(app, 'loadImageFileAsset').mockImplementation(() => new Promise((_, reject) => held.push(reject)));
    return {
      upload: name => loadBackgroundFile(app, new File([PIXEL_PNG], name, { type: 'image/png' })),
      settle: index => held[index](new Error('Failed to load image: held')),
    };
  }
  const busy = () => id('canvas-area').getAttribute('aria-busy');

  test.each([
    ['Clear all', app => app.eventBus.emit('waypoints:clear-all')],
    ['an opened project', async (app) => {
      // The shipped archive, as the site serves it from the build output.
      const serveRepository = globalThis.fetch;
      globalThis.fetch = vi.fn(input => serveRepository(String(input).replace(/^examples\//, 'docs/examples/')));
      expect(await app.loadExampleProject('uon-open-day')).toBe(true);
    }],
  ])('an upload that %s supersedes leaves the canvas area not busy; one started after it owns the flag (Codex r1)', async (_, supersede) => {
    const app = await editor();
    allowConsole(/Background upload rejected/);
    const { toasts } = listen(app);
    const { upload, settle } = heldUploads(app);

    const superseded = upload('first.png');
    expect(busy()).toBe('true');
    await supersede(app);
    // Nothing it decodes can commit now, so nothing is loading.
    expect(busy()).toBe('false');

    const newer = upload('second.png');
    expect(busy()).toBe('true');
    settle(0);
    expect(await superseded).toBe(false);
    expect(busy()).toBe('true');
    settle(1);
    expect(await newer).toBe(false);
    expect(busy()).toBe('false');
    // Only the request still current says why it failed.
    expect(toasts.map(toast => toast.message)).toEqual(['Background not loaded: unsupported file. Use PNG, JPEG or WebP']);
  });

  test('two uploads that overlap keep the canvas area busy until the newer one settles', async () => {
    const app = await editor();
    allowConsole(/Background upload rejected/);
    const { upload, settle } = heldUploads(app);

    const older = upload('older.png');
    const newer = upload('newer.png');
    expect(busy()).toBe('true');
    settle(0);
    expect(await older).toBe(false);
    expect(busy()).toBe('true');
    settle(1);
    expect(await newer).toBe(false);
    expect(busy()).toBe('false');
  });

  test('a file read that is aborted settles as a failure the author hears, and the canvas area is not left busy (Codex r1)', async () => {
    const app = await editor();
    allowConsole(/Background upload rejected/);
    const { toasts } = listen(app);
    vi.stubGlobal('FileReader', class {
      readAsDataURL() {
        setTimeout(() => this.onabort?.(new Event('abort')), 0);
      }
    });
    const within = (promise, ms = 1000) => Promise.race([
      promise.then(value => ({ value }), error => ({ error: error.message })),
      new Promise(resolve => setTimeout(() => resolve('never settled'), ms)),
    ]);
    const file = () => new File([PIXEL_PNG], 'photo.png', { type: 'image/png' });

    expect(await within(ImageAsset.fromFile(file()))).toEqual({ error: 'File reading was stopped: photo.png' });
    const loading = loadBackgroundFile(app, file());
    expect(busy()).toBe('true');
    expect(await within(loading)).toEqual({ value: false });
    expect(busy()).toBe('false');
    expect(toasts).toEqual([{ message: 'Background not loaded: file reading was stopped: photo.png', priority: 'assertive' }]);
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

  /** A clipboard that takes whatever it is given, for one test. */
  function useClipboard() {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    return writeText;
  }
  afterEach(() => {
    delete navigator.clipboard;
  });
  /** Every live region inside a dialog: none but the announcer's queue may speak while one is open. */
  const liveInDialogs = () => [...document.querySelectorAll('[role="dialog"] *')]
    .filter(element => {
      const live = element.getAttribute('aria-live');
      if (live) return live !== 'off';
      return ['status', 'alert', 'log'].includes(element.getAttribute('role')) || element.tagName === 'OUTPUT';
    })
    .map(element => `#${element.id}`);

  test('copying diagnostics is heard once: the dialog\'s line shows it and is not live (the owner, 2026-10-09)', async () => {
    const app = await editor();
    const writeText = useClipboard();
    const { announced } = listen(app);

    id('copy-debug-btn').click();
    await vi.waitFor(() => expect(id('diagnostics-modal').contains(document.activeElement)).toBe(true));
    id('diagnostics-copy').click();
    await vi.waitFor(() => expect(id('diagnostics-status').textContent).toBe('Diagnostics copied.'));

    expect(writeText).toHaveBeenCalledOnce();
    expect(announced()).toEqual([['Diagnostics copied', 'polite']]);
    expect(id('diagnostics-status').getAttribute('aria-live')).toBe('off');
    expect(liveInDialogs()).toEqual([]);
  });

  test('every line the bug-report dialog shows is heard once, through the queue', async () => {
    const app = await editor();
    useClipboard();
    const { announced } = listen(app);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:diagnostics');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const line = () => id('diagnostics-status').textContent;
    /** Follow a link as the author does, without leaving the page. */
    const follow = (link) => {
      link.addEventListener('click', event => event.preventDefault(), { once: true });
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    };

    id('report-bug-btn').click();
    await vi.waitFor(() => expect(id('diagnostics-modal').contains(document.activeElement)).toBe(true));
    follow(id('diagnostics-open-issues'));
    follow(id('diagnostics-open-security'));
    id('diagnostics-copy-issues-address').click();
    await vi.waitFor(() => expect(line()).toMatch(/^GitHub Issues address copied/));
    const shownBeforeDownload = line();
    id('diagnostics-download').click();

    expect(announced()).toEqual([
      ['GitHub Issues was requested in a new tab. Diagnostics were not sent.', 'polite'],
      ['Private vulnerability reporting was requested in a new tab. Diagnostics were not sent.', 'polite'],
      [shownBeforeDownload, 'polite'],
      ['Diagnostics downloaded. Nothing was sent.', 'polite'],
    ]);
    expect(line()).toBe('Diagnostics downloaded. Nothing was sent.');
    expect(liveInDialogs()).toEqual([]);
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
