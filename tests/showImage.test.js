/**
 * UI-08 — Background → Show image hides the background everywhere.
 *
 * The owner, 2026-10-18: "for the backlog, the background section needs a
 * toggle to hide the background", and, asked where, "Everywhere": while
 * editing, in playback and in exports, the export checkbox following it. The
 * plan's answers, 2026-10-19: the toggle reads "Show image"; a save from
 * before it opens with its image shown ("image shown, but we need no
 * backward compatibility, so keep code lean"); an HTML export leaves a
 * hidden image out ("Leave it out"); an image chosen while it is hidden is
 * shown ("Show it").
 *
 * Unticked, nothing of the background is drawn: not the image, its white
 * margins or its tint, in any Reveal mode, in Edit or in Preview, paused,
 * playing or scrubbing. The route, markers and labels are drawn as before,
 * since the image keeps its place. The image is kept and saved, and one
 * change is one undo step. Video exports are checked beside DEF-100's in
 * `exportFraming.test.js`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import { discardFrame, frameAt, takeFrame } from './helpers/drawLog.js';
import { cascade, resolveValue, tokensFor } from './helpers/cssTokens.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { loadBackgroundFile, loadExampleBackground } from '../src/app/backgroundLoading.js';
import { clearProject } from '../src/app/projectReset.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { BACKGROUND_VISIBILITY } from '../src/config/constants.js';
import { VideoExporter } from '../src/services/VideoExporter.js';

const OPEN_DAY = buildExampleProjects().find(each => each.id === 'uon-open-day');

afterEach(() => {
  vi.restoreAllMocks();
});

/** Open day on its own map, with a tint, so that a hidden tint can be seen to go too. */
async function openDay(project = OPEN_DAY.project) {
  const app = await bootApp();
  await app.ready;
  document.getElementById('splash-close').click();
  expect(await loadCurrentSnapshot(app, project)).toBe(true);
  expect(await loadExampleBackground(app, `./${OPEN_DAY.backgroundSource}`, { autoSave: false })).toBe(true);
  app.background.overlay = -40;
  app.invalidateAnimationTiming();
  return app;
}

const showImage = () => document.getElementById('bg-show-image');
const includeImage = () => document.getElementById('export-include-image');

/** Both faces of the one setting, and the model under them. */
const setting = app => ({ hidden: app.background.hidden, show: showImage().checked, include: includeImage().checked });
const SHOWN = { hidden: false, show: true, include: true };
const HIDDEN = { hidden: true, show: false, include: false };

/**
 * What a frame draws of the background: on the visible canvas the image, its
 * white margins and its tint (the route, markers and labels are drawn on the
 * vector layer and composited as a canvas), and any reveal mask.
 */
const backgroundOf = frame => frame.filter(line => /^main (fillRect|drawImage \[image )/.test(line) || line.startsWith('mask '));
const vectorOf = frame => frame.filter(line => line.startsWith('vector '));
const IMAGE_DRAWN = /^main drawImage \[image /;

/** The frame the app draws now, as it stands. */
function frameNow(app) {
  discardFrame();
  app.render();
  return takeFrame(app);
}

describe('hidden, nothing of the background is drawn while editing or in playback (UI-08)', () => {
  const MODES = [
    ['in Edit', app => { app._setPreviewMode(false); app.animationEngine.seekToProgress(0.5); }],
    ['in Preview, paused', app => { app._setPreviewMode(true); app.animationEngine.seekToProgress(0.5); }],
    ['in Preview, scrubbing the timeline', (app) => {
      app._setPreviewMode(true);
      const slider = document.getElementById('timeline-slider');
      slider.value = '400';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      expect(app.animationEngine.getProgress()).toBeCloseTo(0.4, 2);
    }],
    ['in Preview, playing', (app) => {
      app._setPreviewMode(true);
      const engine = app.animationEngine;
      engine.seekToProgress(0);
      engine.play();
      const step = engine.state.duration / 100;
      for (let tick = 1; tick <= 50; tick += 1) engine.updateAnimation(step, tick * step);
      expect(engine.isPlaying()).toBe(true);
    }],
  ];

  test.each(MODES)('%s: the route, markers and labels as before, and the same picture again once shown', async (_, enter) => {
    const app = await openDay();
    enter(app);
    const shown = frameNow(app);
    // Not vacuous: shown, the frame draws the map, its margins and its tint.
    expect(shown.filter(line => IMAGE_DRAWN.test(line))).toHaveLength(1);
    expect(shown.filter(line => /^main fillRect /.test(line)).length).toBeGreaterThanOrEqual(2);
    expect(vectorOf(shown).length).toBeGreaterThan(0);

    showImage().click();
    expect(setting(app)).toEqual(HIDDEN);
    const hidden = frameNow(app);
    expect(backgroundOf(hidden)).toEqual([]);
    expect(vectorOf(hidden)).toEqual(vectorOf(shown));

    // Showing it again needs no upload: the same image, zoom and tint.
    const { image } = app.background;
    showImage().click();
    expect(setting(app)).toEqual(SHOWN);
    expect([app.background.image, app.background.overlay, app.exportSettings.backgroundZoom]).toEqual([image, -40, 100]);
    expect(frameNow(app)).toEqual(shown);
    app.animationEngine.pause();
  });

  test.each(Object.values(BACKGROUND_VISIBILITY))('in Preview with Reveal → Background at %s, as with none', async (mode) => {
    const app = await openDay();
    app.motionSettings.backgroundVisibility = mode;
    app._setPreviewMode(true);
    const shown = frameAt(app, 0.5);
    // Every mode draws something of the background shown: Reveal's Hide still
    // draws the tint, which Show image unticked does not.
    expect(backgroundOf(shown).length).toBeGreaterThan(0);

    showImage().click();
    const hidden = frameAt(app, 0.5);
    expect(backgroundOf(hidden)).toEqual([]);
    expect(vectorOf(hidden)).toEqual(vectorOf(shown));
  });
});

describe('Show image and Include in export → Background image are one setting (UI-08)', () => {
  test('a new project starts shown, and changing either changes both', async () => {
    const app = await openDay();
    expect(setting(app)).toEqual(SHOWN);

    showImage().click();
    expect(setting(app)).toEqual(HIDDEN);
    includeImage().click();
    expect(setting(app)).toEqual(SHOWN);
    includeImage().click();
    expect(setting(app)).toEqual(HIDDEN);
    showImage().click();
    expect(setting(app)).toEqual(SHOWN);
  });

  test('a native checkbox, named by its visible label, whose Space the app leaves to it', async () => {
    const app = await openDay();
    const box = showImage();
    expect([box.tagName, box.type, box.disabled, box.tabIndex]).toEqual(['INPUT', 'checkbox', false, 0]);
    expect(box.labels).toHaveLength(1);
    expect(box.labels[0].textContent.replace(/\s+/g, ' ').trim()).toBe('Show image');
    // Its help describes it, appended to its description, not its name.
    expect(box.getAttribute('aria-describedby')).toBe('bg-show-image-tip');

    // Space on it is the checkbox's own, not the app's Play shortcut.
    box.focus();
    const space = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
    box.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
    expect(app.animationEngine.isPlaying()).toBe(false);
  });

  test('its row is a 44 px target, as Path casing’s is', () => {
    const page = new DOMParser().parseFromString(readFileSync(resolve(process.cwd(), 'index.html'), 'utf8'), 'text/html');
    const row = page.getElementById('bg-show-image').closest('label');
    const hit = cascade(row, 'min-height');
    expect(hit && resolveValue(hit.value, tokensFor())).toBe('2.75rem');
  });
});

describe('one change of the setting is one undo step (UI-08)', () => {
  test('Undo shows the image again and Redo hides it, both checkboxes with them', async () => {
    const app = await openDay();
    const shown = frameAt(app, 0.5);
    const entries = app.undoService.getRetainedSerializedStates().length;

    showImage().click();
    expect(app.undoService.getRetainedSerializedStates()).toHaveLength(entries + 1);
    app.undo();
    expect(setting(app)).toEqual(SHOWN);
    expect(frameAt(app, 0.5)).toEqual(shown);
    app.redo();
    expect(setting(app)).toEqual(HIDDEN);
    expect(backgroundOf(frameAt(app, 0.5))).toEqual([]);
    app.undo();
    expect(app.undoService.canUndo()).toBe(false);
  });

  test('a slider edit still inside its undo debounce stays a step of its own (Codex r1)', async () => {
    const app = await openDay();
    const size = document.getElementById('path-head-size');
    const before = app.styles.pathHead.size;
    size.value = String(before + 1);
    size.dispatchEvent(new Event('input', { bubbles: true }));
    showImage().click();

    app.undo();
    expect(setting(app)).toEqual(SHOWN);
    expect(app.styles.pathHead.size).toBe(before + 1);
    app.undo();
    expect(app.styles.pathHead.size).toBe(before);
    expect(app.undoService.canUndo()).toBe(false);
  });

  test('an image chosen while hidden is shown, and Undo hides it again, keeping the new image', async () => {
    const app = await openDay();
    showImage().click();
    const image = Object.assign(new Image(), { naturalWidth: 1200, naturalHeight: 900, width: 1200, height: 900, src: 'chosen-while-hidden.png' });
    vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: 'data:image/png;base64,AA==', getImageElement: async () => image });

    expect(await loadBackgroundFile(app, new File(['x'], 'chosen.png', { type: 'image/png' }))).toBe(true);
    expect(setting(app)).toEqual(SHOWN);
    expect(frameAt(app, 0.5).filter(line => line.includes('chosen-while-hidden.png'))).toHaveLength(1);

    app.undo();
    expect(setting(app)).toEqual(HIDDEN);
    expect(app.background.image).toBe(image);
  });

  test('Clear All starts a new project shown', async () => {
    const app = await openDay();
    showImage().click();
    clearProject(app);
    expect(setting(app)).toEqual(SHOWN);
  });
});

describe('hidden is saved, and a save from before UI-08 opens shown (UI-08)', () => {
  test('a project file keeps the hidden image and reopens hidden', async () => {
    const app = await openDay();
    showImage().click();
    let saved = null;
    app.imageAssetService.downloadZip = blob => { saved = blob; };
    await app.saveProject();
    const zip = await JSZip.loadAsync(await saved.arrayBuffer());
    const project = JSON.parse(await zip.file('project.json').async('string'));
    expect(project.background).toEqual({ overlay: -40, fit: 'fit', hidden: true });
    expect(project.exportSettings).not.toHaveProperty('pathOnly');
    // The image is still saved with the project.
    expect(zip.file('background.png')).not.toBeNull();

    const reopened = await bootApp();
    await reopened.ready;
    expect(await reopened.loadProject(new File([saved], 'hidden.zip', { type: 'application/zip' }))).toBe(true);
    expect(setting(reopened)).toEqual(HIDDEN);
    expect(reopened.background.image).not.toBeNull();
    expect(backgroundOf(frameAt(reopened, 0.5))).toEqual([]);
    // Opening is not a change to undo.
    expect(reopened.undoService.canUndo()).toBe(false);
  });

  test('a save made with Include in export → Background image unticked opens with its image shown', async () => {
    const before = JSON.parse(JSON.stringify(OPEN_DAY.project));
    before.exportSettings = { ...before.exportSettings, pathOnly: true };
    delete before.background.hidden;
    const app = await bootApp();
    await app.ready;
    expect(await loadCurrentSnapshot(app, before)).toBe(true);
    expect(setting(app)).toEqual(SHOWN);
    // What it saves next carries the new setting alone.
    const snapshot = app._buildProjectSnapshot({ includeAssets: false });
    expect(snapshot.background.hidden).toBe(false);
    expect(snapshot.exportSettings).not.toHaveProperty('pathOnly');
  });
});

describe('an HTML export leaves a hidden image out (UI-08)', () => {
  /** Run the app's own HTML export and read back what the page embeds. */
  async function exportPage(app) {
    const serveRepo = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => (/\/player\.js(\?|$)/.test(String(input))
      ? { ok: true, status: 200, text: async () => '/* player bundle */' }
      : serveRepo(input)));
    let exported = null;
    URL.createObjectURL = blob => { exported = blob; return 'blob:test'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};
    await app.exportHTML();
    expect(exported).not.toBeNull();
    const html = await exported.text();
    return {
      html,
      project: JSON.parse(/window\.__ROUTE_PLOTTER_PROJECT__ = (.*);\n/.exec(html)[1]),
      background: JSON.parse(/window\.__ROUTE_PLOTTER_BG__ = (.*);\n/.exec(html)[1]),
    };
  }

  test('the page carries the image’s size, not its bytes, and its player places and draws everything else as over it', async () => {
    const app = await openDay();
    const image = app.background.image;
    const bytes = app._autosaveBackgroundCache.dataURL;
    const withImage = await exportPage(app);
    expect(withImage.background).toBe(bytes);

    showImage().click();
    const page = await exportPage(app);
    expect(page.background).toBeNull();
    expect(page.html).not.toContain(bytes.slice(-200));
    expect(page.project.background).toMatchObject({ hidden: true, imageSize: { width: image.naturalWidth, height: image.naturalHeight } });

    // The player of the hidden page against the player of the shown one, on its image.
    const hiddenPlayer = new PlayerApp(document.createElement('canvas'));
    await hiddenPlayer.load(page.project, null);
    const shownPlayer = new PlayerApp(document.createElement('canvas'));
    await shownPlayer.load(withImage.project, image);
    try {
      expect(hiddenPlayer.coordinateTransform.imageBounds).toEqual(shownPlayer.coordinateTransform.imageBounds);
      const shown = frameAt(shownPlayer, 0.5);
      const hidden = frameAt(hiddenPlayer, 0.5);
      expect(shown.filter(line => IMAGE_DRAWN.test(line))).toHaveLength(1);
      expect(backgroundOf(hidden)).toEqual([]);
      expect(vectorOf(hidden)).toEqual(vectorOf(shown));
    } finally {
      hiddenPlayer.animationEngine.destroy();
      shownPlayer.animationEngine.destroy();
    }
  });
});

describe('a video export keeps the background as it began (UI-08, Codex r1)', () => {
  test.each([['hidden', 'ticked', HIDDEN, SHOWN], ['shown', 'unticked', SHOWN, HIDDEN]])(
    'begun %s, with Include in export → Background image %s between its frames, every frame is as the first, and the display follows the tick once it ends',
    async (_, __, began, after) => {
      const app = await openDay();
      app.exportSettings.includeCamera = false;
      if (began.hidden) showImage().click();
      vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
      const frames = [];
      app.videoExporter = {
        cancel() {},
        async export({ renderFrame }) {
          for (const progress of [0.1, 0.5, 1]) {
            discardFrame();
            await renderFrame(progress);
            frames.push(takeFrame(app));
            if (progress === 0.1) includeImage().click();
          }
          return new Blob(['video'], { type: 'video/webm' });
        },
      };
      await app.exportVideo({ format: 'webm' });

      expect(frames).toHaveLength(3);
      for (const frame of frames) {
        expect(frame.some(line => IMAGE_DRAWN.test(line))).toBe(!began.hidden);
        if (began.hidden) expect(backgroundOf(frame)).toEqual([]);
      }
      expect(setting(app)).toEqual(after);
      expect(frameAt(app, 0.5).some(line => IMAGE_DRAWN.test(line))).toBe(!after.hidden);
    },
  );
});
