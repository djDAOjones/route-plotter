/**
 * TST-11 — review remediation contracts, pinned by what the booted editor does.
 *
 * reviewAccessibility.test.js pins five of the review's fixes by reading
 * source text: the support routes in privacy.js, one owner for the background
 * controls, Clear All's reset, the custom-image uploads' generation checks,
 * and the image inputs' reset. A behaviour-neutral edit (a helper extracted, a
 * method moved, a local renamed) fails those reads, and the same defect spelt
 * another way passes them: "at least four call sites" counts calls, not what
 * they guard. Here each contract is what a user, or a slow decode, meets in
 * the editor as `index.html` and `src/main.js` start it.
 *
 * Two of those reads have no behaviour to pin, and stay source-only: the
 * comment naming UIController as the background controls' owner, and
 * clearAll()'s position just above showSplash() in main.js.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MOTION } from '../src/config/constants.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { bipolarSliderToLog2Value } from '../src/utils/sliderScales.js';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole, recordedConsole } from './helpers/consoleGuard.js';
import { localStorageMock } from './setup.js';

const GITHUB_ISSUES = 'https://github.com/djDAOjones/route-plotter/issues';
const GITHUB_SECURITY_REPORT = 'https://github.com/djDAOjones/route-plotter/security/advisories/new';
const AUTOSAVE_KEY = 'routePlotter_autosave';

/** A 1×1 PNG. The editor checks the signature; the test Image reports 100×100. */
const PNG_BYTES = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
  char => char.charCodeAt(0)
);

/** A PNG file; each `variant` has its own bytes, so its own asset id. */
function png(name, variant = 0) {
  return new File([PNG_BYTES, new Uint8Array([variant])], name, { type: 'image/png' });
}

/** A file that says it is a PNG and is not one: its decode fails. */
function notAPng(name) {
  return new File(['not an image'], name, { type: 'image/png' });
}

const running = [];

/** The dialogs a test can leave open, and the button that closes each. */
const DIALOGS = [
  ['diagnostics-modal', 'diagnostics-cancel'],
  ['clear-confirm-modal', 'clear-cancel'],
  ['splash', 'splash-close'],
];

beforeEach(() => {
  localStorageMock.getItem.mockImplementation(() => null);
});

afterEach(async () => {
  // An open dialog keeps its focus trap on `window`, where it would take a
  // later test's keys: close it as a user would.
  for (const [dialog, close] of DIALOGS) {
    if (document.getElementById(dialog)?.style.display === 'flex') document.getElementById(close).click();
  }
  await Promise.resolve();
  // bootApp stops each app, but its key listener stays on `document`.
  for (const app of running.splice(0)) app.interactionHandler.destroy();
  delete navigator.clipboard;
  vi.restoreAllMocks();
});

/** The editor a user meets: booted, Help closed, its example background in. */
async function editor() {
  const app = await bootApp();
  running.push(app);
  await app.ready;
  // A first run opens Help, whose focus trap holds the keyboard.
  document.getElementById('splash-close').click();
  await vi.waitFor(() => expect(app.background.image).toBeTruthy());
  return app;
}

/** The editor with a two-waypoint route, its first waypoint selected. */
async function editorWithSelectedWaypoint() {
  const app = await editor();
  app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
  app.eventBus.emit('waypoint:selected', app.waypoints[0]);
  expect(app.selectionTargets(true)).toEqual([app.waypoints[0]]);
  return app;
}

/**
 * A file input as a browser runs one. Choosing a file fires `input` and
 * `change` only when it is not the file the input already holds, which is why
 * an input must be cleared for the same file to be chosen twice; clearing it
 * (value '') empties its files, and any other value is refused.
 */
function filePicker(input) {
  let files = [];
  Object.defineProperty(input, 'files', { configurable: true, get: () => files });
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => (files.length > 0 ? `C:\\fakepath\\${files[0].name}` : ''),
    set: (value) => {
      if (value !== '') throw new DOMException('A file input can only be cleared', 'InvalidStateError');
      files = [];
    },
  });
  return {
    /** Choose a file; false when the browser would send no event. */
    choose(file) {
      if (input.value === `C:\\fakepath\\${file.name}`) return false;
      files = [file];
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
  };
}

/**
 * Hold every image decode until the test lets it go, as a slow decode would.
 * Reading, checking and hashing the file are left to the editor.
 * @returns {Array<{name: string, release: Function, settled: Promise}>} the
 *   decodes started, in order; `settled` once one has resolved or failed
 */
function holdDecodes() {
  const decode = ImageAsset.decodeDataURL;
  const held = [];
  vi.spyOn(ImageAsset, 'decodeDataURL').mockImplementation((dataURL, name) => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const decoded = gate.then(() => decode.call(ImageAsset, dataURL, name));
    held.push({ name, release, settled: decoded.then(() => {}, () => {}) });
    return decoded;
  });
  return held;
}

/**
 * The names of the decoded images the editor has gone on to use. Each name is
 * recorded just before the code awaiting that image resumes, so once a test
 * sees it, that code has run to its commit or its refusal.
 */
function watchDecodedImages() {
  const getImageElement = ImageAsset.prototype.getImageElement;
  const used = [];
  vi.spyOn(ImageAsset.prototype, 'getImageElement').mockImplementation(function useImage() {
    const image = getImageElement.call(this);
    image.then(() => used.push(this.name), () => {});
    return image;
  });
  return used;
}

const assetNames = app => app.imageAssetService.getAssets().map(asset => asset.name).sort();

/** The two custom-image uploads: where each is chosen, and where its image lands. */
const UPLOADS = {
  'marker image': {
    input: 'marker-upload',
    failure: 'Failed to load marker image:',
    chosen: app => app.imageAssetService.getAsset(app.waypoints[0]?.customImageAssetId)?.name ?? null,
  },
  'path head image': {
    input: 'head-upload',
    failure: 'Failed to load path head image:',
    chosen: app => app.imageAssetService.getAsset(app.styles.pathHead.imageAssetId)?.name ?? null,
  },
};

describe('Report a bug hands off to the governed GitHub routes, and nothing rides along', () => {
  test('the Issues and security addresses are the governed ones, before and after diagnostics are copied', async () => {
    await editor();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const issuesLink = document.getElementById('diagnostics-open-issues');
    const securityLink = document.getElementById('diagnostics-open-security');
    const addresses = () => [
      issuesLink.getAttribute('href'),
      document.getElementById('diagnostics-issues-address').textContent,
      securityLink.getAttribute('href'),
    ];

    document.getElementById('report-bug-btn').click();

    expect(document.getElementById('diagnostics-modal').style.display).toBe('flex');
    expect([issuesLink.hidden, securityLink.hidden]).toEqual([false, false]);
    expect(addresses()).toEqual([GITHUB_ISSUES, GITHUB_ISSUES, GITHUB_SECURITY_REPORT]);

    // The diagnostics are on screen and copied; none of them joins an address.
    expect(document.getElementById('diagnostics-preview').value).not.toBe('');
    document.getElementById('diagnostics-copy').click();
    document.getElementById('diagnostics-copy-issues-address').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText.mock.calls[1]).toEqual([GITHUB_ISSUES]);
    expect(addresses()).toEqual([GITHUB_ISSUES, GITHUB_ISSUES, GITHUB_SECURITY_REPORT]);
  });
});

describe('each background control has one owner', () => {
  /** Every background command the bus carries, in order. */
  function backgroundCommands(emit) {
    return emit.mock.calls.filter(([name]) => String(name).startsWith('background:')).map(call => call.slice(0, 2));
  }

  test('the upload button opens the picker once, and a chosen image is loaded and saved once', async () => {
    const app = await editor();
    const input = document.getElementById('bg-upload');
    const openPicker = vi.spyOn(input, 'click').mockImplementation(() => {});

    document.getElementById('bg-upload-btn').click();
    expect(openPicker).toHaveBeenCalledTimes(1);

    const emit = vi.spyOn(app.eventBus, 'emit');
    const autoSave = vi.spyOn(app, 'autoSave');
    const decodes = vi.spyOn(ImageAsset, 'fromFile');
    const used = watchDecodedImages();
    const exampleBackground = app.background.image;
    const file = png('photo.png', 1);

    filePicker(input).choose(file);
    await vi.waitFor(() => expect(used).toEqual(['photo.png']));

    expect(backgroundCommands(emit)).toEqual([['background:upload', file]]);
    expect(decodes.mock.calls).toEqual([[file]]);
    expect(app.background.image).not.toBe(exampleBackground);
    expect(autoSave).toHaveBeenCalledTimes(1);
  });

  test('the tint slider sets the log-scaled tint once', async () => {
    const app = await editor();
    const emit = vi.spyOn(app.eventBus, 'emit');
    const autoSave = vi.spyOn(app, 'autoSave');
    const slider = document.getElementById('bg-overlay');
    const tint = bipolarSliderToLog2Value(600, MOTION.TINT_MIN, MOTION.TINT_MAX);
    expect(tint).not.toBe(600);

    slider.value = '600';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    expect(backgroundCommands(emit)).toEqual([['background:overlay-change', tint]]);
    expect(app.background.overlay).toBe(tint);
    expect(autoSave).toHaveBeenCalledTimes(1);
  });

  test('the Fit/Fill toggle, when the shell has one, switches the mode once per press', async () => {
    // The shipped shell has no #bg-fit-toggle (elementIds.test.js pins that),
    // so it is supplied here, before the editor gathers its controls.
    window.addEventListener('DOMContentLoaded', () => {
      const toggle = document.createElement('button');
      toggle.id = 'bg-fit-toggle';
      toggle.type = 'button';
      toggle.dataset.mode = 'fit';
      toggle.textContent = 'Fit';
      document.getElementById('bg-upload-btn').after(toggle);
    }, { capture: true, once: true });
    const app = await editor();
    const toggle = document.getElementById('bg-fit-toggle');
    expect(app.elements.bgFitToggle).toBe(toggle);
    const emit = vi.spyOn(app.eventBus, 'emit');
    const autoSave = vi.spyOn(app, 'autoSave');

    toggle.click();
    expect(backgroundCommands(emit)).toEqual([['background:mode-change', 'fill']]);
    expect([app.background.fit, toggle.dataset.mode, toggle.textContent]).toEqual(['fill', 'fill', 'Fill']);
    expect(autoSave).toHaveBeenCalledTimes(1);

    toggle.click();
    expect([app.background.fit, toggle.dataset.mode, toggle.textContent]).toEqual(['fit', 'fit', 'Fit']);
    expect(autoSave).toHaveBeenCalledTimes(2);
  });
});

describe('Clear All, confirmed, leaves one empty baseline and no recovery point', () => {
  function confirmClearAll() {
    document.getElementById('clear-btn').click();
    expect(document.getElementById('clear-confirm-modal').style.display).toBe('flex');
    document.getElementById('clear-confirm').click();
  }

  const recoveryWrites = () => localStorageMock.setItem.mock.calls.filter(([key]) => key === AUTOSAVE_KEY);

  test('no route, images or background, nothing to undo, recovery removed, and nothing saved after', async () => {
    const app = await editorWithSelectedWaypoint();
    const used = watchDecodedImages();
    filePicker(document.getElementById('marker-upload')).choose(png('marker.png', 2));
    await vi.waitFor(() => expect(used).toEqual(['marker.png']));
    expect(assetNames(app)).toEqual(['marker.png']);
    // An edit whose save is still waiting for its debounce.
    app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.25, isMajor: true });
    expect(app.undoService.canUndo()).toBe(true);
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();

    confirmClearAll();

    expect(app.waypoints).toEqual([]);
    expect(app.imageAssetService.getAssets()).toEqual([]);
    expect(app.background.image).toBeNull();
    expect(app.undoService.canUndo()).toBe(false);
    expect(app.undoService.canRedo()).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(AUTOSAVE_KEY);
    // Neither the save that was waiting nor a new one lands.
    app.storageService.flushAutoSave();
    expect(recoveryWrites()).toEqual([]);

    // The cleared project is the baseline: the first edit after it undoes to it.
    app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.5, isMajor: true });
    expect(app.waypoints).toHaveLength(1);
    app.eventBus.emit('history:undo');
    expect(app.waypoints).toEqual([]);
    expect(app.undoService.canUndo()).toBe(false);
  });

  test('a custom image still decoding when Clear All is confirmed never enters the cleared project', async () => {
    const app = await editor();
    const held = holdDecodes();
    const used = watchDecodedImages();
    filePicker(document.getElementById('head-upload')).choose(png('late.png', 3));
    await vi.waitFor(() => expect(held.map(({ name }) => name)).toEqual(['late.png']));

    confirmClearAll();
    localStorageMock.setItem.mockClear();
    held[0].release();
    await vi.waitFor(() => expect(used).toEqual(['late.png']));

    expect(app.styles.pathHead.imageAssetId).toBeNull();
    expect(app.imageAssetService.getAssets()).toEqual([]);
    app.storageService.flushAutoSave();
    expect(recoveryWrites()).toEqual([]);
  });
});

describe.each(Object.entries(UPLOADS))('a custom %s decodes aside and commits only while current', (_kind, upload) => {
  test('it enters the project only once its decode is done', async () => {
    const app = await editorWithSelectedWaypoint();
    const held = holdDecodes();
    const used = watchDecodedImages();
    const before = assetNames(app);

    filePicker(document.getElementById(upload.input)).choose(png('chosen.png', 4));
    await vi.waitFor(() => expect(held.map(({ name }) => name)).toEqual(['chosen.png']));
    // Read, checked and decoding: none of it is in the project yet.
    expect(assetNames(app)).toEqual(before);
    expect(upload.chosen(app)).toBeNull();

    held[0].release();
    await vi.waitFor(() => expect(used).toEqual(['chosen.png']));
    expect(upload.chosen(app)).toBe('chosen.png');
    expect(assetNames(app)).toEqual([...before, 'chosen.png'].sort());
  });

  test('one overtaken by a newer choice never commits, even when it finishes last', async () => {
    const app = await editorWithSelectedWaypoint();
    const held = holdDecodes();
    const used = watchDecodedImages();
    const picker = filePicker(document.getElementById(upload.input));

    picker.choose(png('first.png', 5));
    await vi.waitFor(() => expect(held).toHaveLength(1));
    picker.choose(png('second.png', 6));
    await vi.waitFor(() => expect(held).toHaveLength(2));
    held[1].release();
    await vi.waitFor(() => expect(used).toEqual(['second.png']));
    held[0].release();
    await vi.waitFor(() => expect(used).toEqual(['second.png', 'first.png']));

    expect(upload.chosen(app)).toBe('second.png');
    expect(assetNames(app)).not.toContain('first.png');
  });

  test('one overtaken that then fails says nothing; a current one that fails is reported', async () => {
    allowConsole(new RegExp(`^${upload.failure}`));
    const app = await editorWithSelectedWaypoint();
    const held = holdDecodes();
    const used = watchDecodedImages();
    const announce = vi.spyOn(app, 'announce');
    const picker = filePicker(document.getElementById(upload.input));

    picker.choose(notAPng('broken.png'));
    await vi.waitFor(() => expect(held).toHaveLength(1));
    picker.choose(png('good.png', 7));
    await vi.waitFor(() => expect(held).toHaveLength(2));
    held[1].release();
    await vi.waitFor(() => expect(used).toEqual(['good.png']));
    announce.mockClear();
    held[0].release();
    // Let the refused decode run on to wherever it goes.
    await held[0].settled;
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(upload.chosen(app)).toBe('good.png');
    expect(recordedConsole()).toEqual([]);
    expect(announce).not.toHaveBeenCalled();

    picker.choose(notAPng('also-broken.png'));
    await vi.waitFor(() => expect(held).toHaveLength(3));
    held[2].release();
    await vi.waitFor(() => expect(announce).toHaveBeenCalledWith(
      'Image bytes do not match the declared type: also-broken.png'
    ));
    expect(recordedConsole())
      .toEqual([expect.stringMatching(new RegExp(`^error: ${upload.failure} Error: Image bytes`))]);
    expect(upload.chosen(app)).toBe('good.png');
  });
});

describe('the marker and the path head upload on separate channels', () => {
  test('a path head chosen while a marker decodes does not cancel the marker', async () => {
    const app = await editorWithSelectedWaypoint();
    const held = holdDecodes();
    const used = watchDecodedImages();

    filePicker(document.getElementById('marker-upload')).choose(png('marker.png', 8));
    await vi.waitFor(() => expect(held).toHaveLength(1));
    filePicker(document.getElementById('head-upload')).choose(png('head.png', 9));
    await vi.waitFor(() => expect(held).toHaveLength(2));
    held[1].release();
    await vi.waitFor(() => expect(used).toEqual(['head.png']));
    held[0].release();
    await vi.waitFor(() => expect(used).toEqual(['head.png', 'marker.png']));

    expect(UPLOADS['path head image'].chosen(app)).toBe('head.png');
    expect(UPLOADS['marker image'].chosen(app)).toBe('marker.png');
  });
});

describe('an image input takes its file, then clears, so the same file can be chosen again', () => {
  test.each([
    ['background', 'bg-upload'],
    ['marker image', 'marker-upload'],
    ['path head image', 'head-upload'],
  ])('the %s input', async (_kind, id) => {
    await editorWithSelectedWaypoint();
    const decodes = vi.spyOn(ImageAsset, 'fromFile');
    const used = watchDecodedImages();
    const input = document.getElementById(id);
    const picker = filePicker(input);
    const file = png('same.png', 10);

    expect(picker.choose(file)).toBe(true);
    await vi.waitFor(() => expect(used).toEqual(['same.png']));
    expect(decodes.mock.calls).toEqual([[file]]);
    expect(input.value).toBe('');

    // A browser sends the second choice only because the input was cleared.
    expect(picker.choose(file)).toBe(true);
    await vi.waitFor(() => expect(used).toEqual(['same.png', 'same.png']));
    expect(decodes.mock.calls).toEqual([[file], [file]]);
  });
});
