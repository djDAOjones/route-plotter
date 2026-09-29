/**
 * DEF-53 — changing the export size during a video export spoils the rest of it.
 *
 * An export draws on a canvas of its own size (`_enterExportMode`). The
 * export size fields and presets stay enabled while it runs, and any change
 * to them (even the same width typed again) set the canvas to the display
 * size at once (`updateCanvasAspectRatio`), so the export's remaining frames
 * were drawn at 1173×660 into a 1280×720 video, still flagged as export
 * frames. A window resize already waited for the export to end; now every
 * size change does: the running export keeps its canvas, and the display
 * and the next export take the new size once it ends. A path-only export
 * hides the background while it runs, and put the display back before the
 * background, so the image kept the place it had at the old size; the
 * background now comes back first.
 */

import { afterEach, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { authoredExtrasProject } from './fixtures/authoredExtras.js';
import { loadBackgroundFile } from '../src/app/backgroundLoading.js';
import { VideoExporter } from '../src/services/VideoExporter.js';
import { contextIdFor, recordCallOrder, takeOrderedCalls } from './setup.js';

/** Exports a test left held (one whose assertion failed first): let go, so their Escape listeners go with them. */
const held = new Set();

afterEach(async () => {
  for (const letGo of held) await letGo();
  held.clear();
  recordCallOrder(false);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The background under test, named so its draws can be told from any other image's. */
const BACKGROUND = 'landscape-under-test.png';
const IMAGE = { width: 1600, height: 900 };
const ZOOM = 1.75;

/**
 * Where the background is drawn on a canvas of `width` × `height`, worked out
 * here from the image, the size and the zoom, not by the app's own layout
 * code: the image fitted inside the canvas, scaled by the zoom, centred.
 */
function fitted(width, height) {
  const scale = Math.min(width / IMAGE.width, height / IMAGE.height) * ZOOM;
  const w = IMAGE.width * scale;
  const h = IMAGE.height * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, w, h, scale };
}

/**
 * A booted app with a route and a 1600×900 background, zoomed to 175% (so a
 * placement put back at 100% shows), set to export with it or path only.
 */
async function withBackground(pathOnly) {
  const app = await bootApp();
  await app.ready;
  document.getElementById('splash-close').click();
  expect(await loadSnapshot(app, authoredExtrasProject())).toBe(true);
  const image = Object.assign(new Image(), { naturalWidth: IMAGE.width, naturalHeight: IMAGE.height, ...IMAGE, src: BACKGROUND });
  vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: 'data:image/png;base64,AA==', getImageElement: async () => image });
  expect(await loadBackgroundFile(app, new File(['x'], 'landscape.png', { type: 'image/png' }))).toBe(true);
  app.elements.backgroundZoom.value = '175';
  app.elements.backgroundZoom.dispatchEvent(new Event('input', { bubbles: true }));
  app.exportSettings.pathOnly = pathOnly;
  vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
  vi.stubGlobal('alert', vi.fn());
  return { app, image };
}

/**
 * An export whose encoder holds after its first frame until it is let
 * finish, made to fail, or cancelled. Each frame records the canvas it was
 * drawn on, and every draw of the background the frame made, on any canvas:
 * where on the main canvas, or on which other.
 */
async function exporting(app) {
  const frames = [];
  const main = contextIdFor(app.canvas);
  recordCallOrder(true);
  let started;
  let release;
  let outcome = 'complete';
  const running = new Promise((resolve) => { started = resolve; });
  app.videoExporter = {
    cancel() {
      outcome = 'cancelled';
      release?.();
    },
    async export({ renderFrame }) {
      const frame = async (progress) => {
        takeOrderedCalls();
        await renderFrame(progress);
        const background = takeOrderedCalls()
          .filter(([, name, source]) => name === 'drawImage' && String(source).includes(BACKGROUND))
          .map(([surface, , , ...at]) => [surface === main ? 'main' : `canvas #${surface}`, ...at.slice(0, 4)]);
        frames.push({ exportMode: app._isExportMode, width: app.canvas.width, height: app.canvas.height, background });
      };
      await frame(0.1);
      started();
      await new Promise((resolve) => { release = resolve; });
      if (outcome === 'cancelled') throw new Error('Export cancelled');
      if (outcome === 'failed') throw new Error('the encoder failed');
      await frame(0.5);
      await frame(1);
      return new Blob(['video'], { type: 'video/mp4' });
    },
  };
  const done = app.exportVideo();
  const letGo = async () => { release?.(); await done; };
  held.add(letGo);
  done.finally(() => {
    held.delete(letGo);
    recordCallOrder(false);
  });
  await running;
  return {
    frames,
    completes: async () => { release(); await done; },
    fails: async () => { allowConsole(/Video export failed/); outcome = 'failed'; release(); await done; },
    'is cancelled with Escape': async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await done;
    },
  };
}

/** Where the display puts things: its size, its canvas and the size the page shows it at, the image's place on it, and an image point's. */
const geometry = app => JSON.parse(JSON.stringify({
  display: [app.displayWidth, app.displayHeight],
  canvas: [app.canvas.width, app.canvas.height],
  css: [app.canvas.style.width, app.canvas.style.height],
  image: app.coordinateTransform.imageBounds,
  point: app.imageToCanvas(0.25, 0.25),
}));

/**
 * The display at the 9:16 size, worked out here: the harness's canvas area is
 * 660 high (720, less the 60 of its playbar), so the display is 371.25 wide,
 * its canvas 371 by 660, shown at 371.25 by 660; the image fitted into it at
 * the zoom, and the image point (0.25, 0.25) a quarter of the way into it.
 */
function portraitDisplay() {
  const width = 660 * 1080 / 1920;
  const image = fitted(width, 660);
  return {
    display: [width, 660],
    canvas: [371, 660],
    css: [`${width}px`, '660px'],
    image,
    point: { x: image.x + 0.25 * image.w, y: image.y + 0.25 * image.h },
  };
}

/** What a frame of `width` × `height` should show of the background: drawn once, on the main canvas, fitted at the zoom; or nothing, path only. */
const frameOf = (width, height, pathOnly) => {
  const { x, y, w, h } = fitted(width, height);
  return { exportMode: true, width, height, background: pathOnly ? [] : [['main', x, y, w, h]] };
};

/** That, and the export size and background zoom the project keeps. */
const placement = app => ({
  ...geometry(app),
  settings: [app.exportSettings.resolutionX, app.exportSettings.resolutionY, app.exportSettings.backgroundZoom],
});

/** What the display should be: an app like it that chooses the 9:16 preset without exporting at all. */
async function chosenWithoutExporting(pathOnly) {
  const { app } = await withBackground(pathOnly);
  document.getElementById('preset-9-16').click();
  return placement(app);
}

const KINDS = [['with its background', false], ['of the path only', true]];

const CHANGES = [
  ['its width typed again, the same', (app) => {
    app.elements.exportResX.value = String(app.exportSettings.resolutionX);
    app.elements.exportResX.dispatchEvent(new Event('change', { bubbles: true }));
  }],
  ['its width changed', (app) => {
    app.elements.exportResX.value = '1080';
    app.elements.exportResX.dispatchEvent(new Event('change', { bubbles: true }));
  }],
  ['the 9:16 preset chosen', () => document.getElementById('preset-9-16').click()],
];

test.each(KINDS.flatMap(([kind, pathOnly]) => CHANGES.map(([label, change]) => [kind, label, pathOnly, change])))('an export %s whose size has %s draws every frame at the size it began at, placed as it began', async (_, __, pathOnly, change) => {
  const { app } = await withBackground(pathOnly);
  const run = await exporting(app);
  const began = geometry(app);

  change(app);

  expect(geometry(app)).toEqual(began);
  await run.completes();
  expect(run.frames).toEqual(Array(3).fill(frameOf(began.canvas[0], began.canvas[1], pathOnly)));
});

const ENDINGS = ['completes', 'fails', 'is cancelled with Escape'];

test.each(KINDS.flatMap(([kind, pathOnly]) => ENDINGS.map(ending => [kind, ending, pathOnly])))('an export %s with no size chosen during it, which then %s, leaves the display as it was before it', async (_, ending, pathOnly) => {
  const { app, image } = await withBackground(pathOnly);
  const before = placement(app);
  const run = await exporting(app);

  await run[ending]();

  expect(app.background.image).toBe(image);
  expect(placement(app)).toEqual(before);
});

test.each(KINDS.flatMap(([kind, pathOnly]) => ENDINGS.map(ending => [kind, ending, pathOnly])))('an export %s given a new size while it runs, which then %s, leaves the display at that size, as it would be chosen without exporting, and the next export draws at it', async (_, ending, pathOnly) => {
  const { app, image } = await withBackground(pathOnly);
  const run = await exporting(app);

  document.getElementById('preset-9-16').click();
  await run[ending]();

  expect(app._isExportMode).toBeFalsy();
  expect(app.background.image).toBe(image);
  const restored = placement(app);
  expect(restored).toMatchObject(portraitDisplay());
  const next = await exporting(app);
  await next.completes();
  expect(next.frames).toEqual(Array(3).fill(frameOf(1080, 1920, pathOnly)));
  // Booting the app to compare with replaces this one's page: last.
  expect(restored).toEqual(await chosenWithoutExporting(pathOnly));
});
