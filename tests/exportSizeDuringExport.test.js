/**
 * DEF-53 — changing the export size during a video export spoils the rest of it.
 *
 * An export draws on a canvas of its own size (`_enterExportMode`). The
 * export size fields and presets stay enabled while it runs, and any change
 * to them (even the same width typed again) sets the canvas to the display
 * size at once (`updateCanvasAspectRatio`), so the export's remaining frames
 * were drawn at 1173×660 into a 1280×720 video, still flagged as export
 * frames. A window resize already waited for the export to end; now every
 * size change does: the running export keeps its canvas, and the next one,
 * and the display, take the new size once it ends.
 */

import { afterEach, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { authoredExtrasProject } from './fixtures/authoredExtras.js';
import { VideoExporter } from '../src/services/VideoExporter.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A booted app mid-export: its encoder holds after the first frame until told. */
async function midExport() {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, authoredExtrasProject())).toBe(true);
  vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
  vi.stubGlobal('alert', vi.fn());
  const frames = [];
  let started;
  let finish;
  const running = new Promise((resolve) => { started = resolve; });
  app.videoExporter = {
    cancel() {},
    async export({ renderFrame }) {
      const frame = async (progress) => {
        await renderFrame(progress);
        frames.push({ exportMode: app._isExportMode, width: app.canvas.width, height: app.canvas.height });
      };
      await frame(0.1);
      started();
      await new Promise((resolve) => { finish = resolve; });
      await frame(0.5);
      await frame(1);
      return new Blob(['video'], { type: 'video/mp4' });
    },
  };
  const exporting = app.exportVideo();
  await running;
  const size = { width: app.canvas.width, height: app.canvas.height };
  expect(size).toEqual({ width: app.exportSettings.resolutionX, height: app.exportSettings.resolutionY });
  return { app, frames, size, end: async () => { finish(); await exporting; } };
}

const aspect = app => Math.round((app.displayWidth / app.displayHeight) * 100) / 100;

test.each([
  ['its width typed again, the same', (app) => {
    const field = app.elements.exportResX;
    field.value = String(app.exportSettings.resolutionX);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }],
  ['its width changed', (app) => {
    const field = app.elements.exportResX;
    field.value = '1080';
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }],
  ['the 9:16 preset chosen', () => document.getElementById('preset-9-16').click()],
])('an export whose size has %s draws every frame at the size it began at', async (_, change) => {
  const { app, frames, size, end } = await midExport();

  change(app);
  expect({ width: app.canvas.width, height: app.canvas.height }).toEqual(size);
  await end();

  expect(frames).toEqual(Array(3).fill({ exportMode: true, ...size }));
});

test('a size chosen during an export is the display’s, and the next export’s, once it ends', async () => {
  const { app, end } = await midExport();

  document.getElementById('preset-9-16').click();
  expect(app.exportSettings).toMatchObject({ resolutionX: 1080, resolutionY: 1920 });
  await end();

  expect(app._isExportMode).toBe(false);
  expect(aspect(app)).toBe(Math.round((1080 / 1920) * 100) / 100);
});
