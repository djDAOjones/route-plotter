/**
 * DEF-46 — a second video export spoils the first.
 *
 * `exportVideo()` sets an export up (Preview, timing, the reveal mask, the
 * export canvas), hands the encoder a frame at a time, and in its `finally`
 * puts the display back. A second request while one ran repeated that setup,
 * was refused by the encoder, told the author the export failed, and then left
 * export mode and re-enabled the buttons under the running export, whose
 * remaining frames were drawn at display size without the export flag. The
 * likely route is a double click on Export MP4: its codec probe answers later,
 * so both clicks can ask for an export before the first disables the buttons.
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

/**
 * A booted app with a route, its encoder replaced by one that, as the real one
 * does, takes one export at a time, and that waits after the first frame until
 * the test lets it finish. Each frame it asks for records how it was drawn.
 */
async function exportingApp() {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, authoredExtrasProject())).toBe(true);
  vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
  vi.stubGlobal('alert', vi.fn());
  const frames = [];
  let started;
  let finish;
  const running = new Promise((resolve) => { started = resolve; });
  let exporting = false;
  app.videoExporter = {
    cancel() {},
    async export({ renderFrame }) {
      if (exporting) throw new Error('Export already in progress');
      exporting = true;
      try {
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
      } finally {
        exporting = false;
      }
    },
  };
  return { app, frames, running, finish: () => finish() };
}

/** Whether each export control is disabled: MP4, WebM, HTML and the menu. */
const exportButtons = () => ['export-mp4-btn', 'export-webm-btn', 'export-html-btn', 'export-dropdown-btn']
  .map(id => document.getElementById(id).disabled);

test('a second export asked for while one runs is refused before it touches anything, and the first draws every frame as it began', async () => {
  const { app, frames, running, finish } = await exportingApp();
  const announce = vi.spyOn(app, 'announce');
  const first = app.exportVideo();
  await running;
  const size = { width: app.canvas.width, height: app.canvas.height };
  expect(size).toEqual({ width: app.exportSettings.resolutionX, height: app.exportSettings.resolutionY });
  const progress = document.getElementById('export-dropdown-btn');
  progress.textContent = 'Exporting... 40% · Esc to cancel';

  await app.exportVideo();

  expect(progress.textContent).toBe('Exporting... 40% · Esc to cancel');
  expect(app._isExportMode).toBe(true);
  expect({ width: app.canvas.width, height: app.canvas.height }).toEqual(size);
  expect(exportButtons()).toEqual([true, true, true, true]);
  expect(alert).not.toHaveBeenCalled();
  expect(announce).toHaveBeenLastCalledWith('A video export is already running.');

  finish();
  await first;
  expect(frames).toEqual(Array(3).fill({ exportMode: true, ...size }));
  expect(announce).toHaveBeenLastCalledWith('Video export complete');
  expect(app._isExportMode).toBe(false);
  expect(exportButtons()).toEqual([false, false, false, false]);

  // And the next export, asked for once this one has ended, runs.
  const next = app.exportVideo();
  await vi.waitFor(() => expect(frames).toHaveLength(4));
  finish();
  await next;
  expect(frames).toHaveLength(6);
});

test('a double click on Export MP4 makes one export', async () => {
  const { app, running, finish } = await exportingApp();
  vi.spyOn(VideoExporter, '_testWebCodecsConfig').mockResolvedValue({ codec: 'avc1' });
  const encode = vi.spyOn(app.videoExporter, 'export');
  const mp4 = document.getElementById('export-mp4-btn');

  mp4.click();
  mp4.click();
  await running;
  // The second click's probe answers, and asks for an export.
  await new Promise(resolve => setTimeout(resolve, 0));
  finish();
  await vi.waitFor(() => expect(app._isExportMode).toBe(false));

  expect(encode).toHaveBeenCalledTimes(1);
  expect(alert).not.toHaveBeenCalled();
});
