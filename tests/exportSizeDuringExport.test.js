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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A booted app with a route and a 1600×900 background, set to export with it or path only. */
async function withBackground(pathOnly) {
  const app = await bootApp();
  await app.ready;
  document.getElementById('splash-close').click();
  expect(await loadSnapshot(app, authoredExtrasProject())).toBe(true);
  const image = Object.assign(new Image(), { naturalWidth: 1600, naturalHeight: 900, width: 1600, height: 900 });
  vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: 'data:image/png;base64,AA==', getImageElement: async () => image });
  expect(await loadBackgroundFile(app, new File(['x'], 'landscape.png', { type: 'image/png' }))).toBe(true);
  app.exportSettings.pathOnly = pathOnly;
  vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
  vi.stubGlobal('alert', vi.fn());
  return { app, image };
}

/** An export whose encoder holds after its first frame until it is let finish, made to fail, or cancelled. */
async function exporting(app) {
  const frames = [];
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
        await renderFrame(progress);
        frames.push({ exportMode: app._isExportMode, width: app.canvas.width, height: app.canvas.height });
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

/** Where the display puts things: its size, its canvas, the image's place on it, and an image point's. */
const placement = app => JSON.parse(JSON.stringify({
  display: [app.displayWidth, app.displayHeight],
  canvas: [app.canvas.width, app.canvas.height],
  image: app.coordinateTransform.imageBounds,
  point: app.imageToCanvas(0.25, 0.25),
}));

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
  const began = placement(app);

  change(app);

  expect(placement(app)).toEqual(began);
  await run.completes();
  expect(run.frames).toEqual(Array(3).fill({ exportMode: true, width: began.canvas[0], height: began.canvas[1] }));
});

test.each(KINDS.flatMap(([kind, pathOnly]) => ['completes', 'fails', 'is cancelled with Escape'].map(ending => [kind, ending, pathOnly])))('an export %s given a new size while it runs, which then %s, leaves the display at that size, placed as that size places it', async (_, ending, pathOnly) => {
  const { app, image } = await withBackground(pathOnly);
  const run = await exporting(app);

  document.getElementById('preset-9-16').click();
  await run[ending]();

  expect(app._isExportMode).toBeFalsy();
  expect(app.background.image).toBe(image);
  const restored = placement(app);
  expect(restored.display[0] / restored.display[1]).toBeCloseTo(1080 / 1920, 2);
  // Chosen now, the same size places everything where it is.
  app.updateCanvasAspectRatio();
  expect(placement(app)).toEqual(restored);
});

test('the next export after one given a new size while it ran draws at that size', async () => {
  const { app } = await withBackground(false);
  const first = await exporting(app);
  document.getElementById('preset-9-16').click();
  await first.completes();

  const next = await exporting(app);
  await next.completes();

  expect(next.frames).toEqual(Array(3).fill({ exportMode: true, width: 1080, height: 1920 }));
});
