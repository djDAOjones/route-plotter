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
 * A request is now refused whole while an export runs, the size the codec
 * dialog's reduced MP4 carries included, and a probe that answers once an
 * export has started opens no dialog over it.
 */

import { afterEach, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { authoredExtrasProject } from './fixtures/authoredExtras.js';
import { VideoExporter } from '../src/services/VideoExporter.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * A booted app with a route, its encoder replaced by one that, as the real one
 * does, takes one export at a time, reports its progress after each frame,
 * rejects when cancelled, and waits after the first frame until the test lets
 * it finish. Each frame it asks for records how it was drawn.
 */
async function exportingApp() {
  const app = await bootApp();
  await app.ready;
  // The welcome dialog's focus trap would take the Escape a test presses.
  document.getElementById('splash-close').click();
  expect(await loadSnapshot(app, authoredExtrasProject())).toBe(true);
  vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
  vi.stubGlobal('alert', vi.fn());
  const frames = [];
  let started;
  let hold = null;
  const running = new Promise((resolve) => { started = resolve; });
  let exporting = false;
  app.videoExporter = {
    cancel() {
      hold?.reject(new Error('Export cancelled'));
    },
    async export({ renderFrame, onProgress }) {
      if (exporting) throw new Error('Export already in progress');
      exporting = true;
      try {
        const frame = async (progress) => {
          await renderFrame(progress);
          frames.push({
            exportMode: app._isExportMode,
            width: app.canvas.width,
            height: app.canvas.height,
            background: app.background.image ? 'drawn' : 'hidden',
          });
          onProgress(Math.round(progress * 100));
        };
        await frame(0.1);
        await new Promise((resolve, reject) => {
          hold = { resolve, reject };
          started();
        });
        await frame(0.5);
        await frame(1);
        return new Blob(['video'], { type: 'video/mp4' });
      } finally {
        hold = null;
        exporting = false;
      }
    },
  };
  return { app, frames, running, finish: () => hold?.resolve() };
}

/** Whether each export control is disabled: MP4, WebM, HTML and the menu. */
const exportButtons = () => ['export-mp4-btn', 'export-webm-btn', 'export-html-btn', 'export-dropdown-btn']
  .map(id => document.getElementById(id).disabled);

const codecDialogShown = () => document.getElementById('codec-unsupported-modal').style.display === 'flex';

/** Set the export size through its fields, as the author does. */
function exportSize(app, width, height) {
  for (const [field, value] of [[app.elements.exportResX, width], [app.elements.exportResY, height]]) {
    field.value = String(value);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * What a refused request must leave as it was: the Preview flag, the
 * transport, the background, the bus's listeners and the window's (by
 * identity), and the reveal mask and seek it would redo.
 */
function watchRunningExport(app) {
  const transport = app.animationEngine.state.captureTransportState();
  const listeners = [...app.eventBus.events].map(([name, each]) => [name, [...each]]);
  const background = app.background.image;
  const previewMode = app.previewMode;
  const touched = [
    vi.spyOn(app.motionVisibilityService, 'resetRevealMask'),
    vi.spyOn(app.animationEngine, 'seekToProgress'),
    vi.spyOn(window, 'addEventListener'),
    vi.spyOn(window, 'removeEventListener'),
  ];
  return () => {
    expect(app.previewMode).toBe(previewMode);
    expect(app.animationEngine.state.captureTransportState()).toEqual(transport);
    expect(app.background.image).toBe(background);
    expect([...app.eventBus.events].map(([name, each]) => [name, [...each]])).toEqual(listeners);
    for (const spy of touched) expect(spy).not.toHaveBeenCalled();
    for (const spy of touched) spy.mockRestore();
  };
}

test('a second export asked for while one runs is refused before it touches anything, and the first draws every frame as it began', async () => {
  const { app, frames, running, finish } = await exportingApp();
  const announce = vi.spyOn(app, 'announce');
  const first = app.exportVideo();
  await running;
  const size = { width: app.canvas.width, height: app.canvas.height };
  expect(size).toEqual({ width: app.exportSettings.resolutionX, height: app.exportSettings.resolutionY });
  const progress = document.getElementById('export-dropdown-btn');
  expect(progress.textContent).toBe('Exporting... 10% · Esc to cancel');
  const unchanged = watchRunningExport(app);

  await app.exportVideo();

  unchanged();
  expect(progress.textContent).toBe('Exporting... 10% · Esc to cancel');
  expect(app._isExportMode).toBe(true);
  expect({ width: app.canvas.width, height: app.canvas.height }).toEqual(size);
  expect(exportButtons()).toEqual([true, true, true, true]);
  expect(alert).not.toHaveBeenCalled();
  expect(announce).toHaveBeenLastCalledWith('A video export is already running.');

  finish();
  await first;
  expect(frames).toEqual(Array(3).fill({ exportMode: true, ...size, background: 'hidden' }));
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

test('a request that carries its own size, made while an export runs, is refused before the size changes', async () => {
  const { app, frames, running, finish } = await exportingApp();
  const announce = vi.spyOn(app, 'announce');
  const first = app.exportVideo();
  await running;
  const size = { width: app.canvas.width, height: app.canvas.height };
  const settings = { ...app.exportSettings };
  const unchanged = watchRunningExport(app);

  // The codec dialog's reduced MP4, and a plain WebM, as the bus carries them.
  app.eventBus.emit('video:export-request', { format: 'mp4', resolution: { width: 1280, height: 720 } });
  app.eventBus.emit('video:export-request', 'webm');

  unchanged();
  expect(app.exportSettings).toEqual(settings);
  expect({ width: app.canvas.width, height: app.canvas.height }).toEqual(size);
  expect(announce).toHaveBeenLastCalledWith('A video export is already running.');
  finish();
  await first;
  expect(frames).toEqual(Array(3).fill({ exportMode: true, ...size, background: 'hidden' }));
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

test('an MP4 probe that answers once a WebM export has started opens no codec dialog, and changes nothing of that export', async () => {
  const { app, frames, running, finish } = await exportingApp();
  exportSize(app, 3840, 2160);
  let answer;
  vi.spyOn(VideoExporter, '_testWebCodecsConfig')
    .mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }))
    .mockResolvedValue({ codec: 'avc1' });
  const encode = vi.spyOn(app.videoExporter, 'export');
  const announce = vi.spyOn(app, 'announce');

  document.getElementById('export-mp4-btn').click();
  document.getElementById('export-webm-btn').click();
  await running;
  // H.264 cannot take the full size, but could take a reduced one.
  answer(null);
  await vi.waitFor(() => expect(announce).toHaveBeenLastCalledWith('A video export is already running.'));

  expect(codecDialogShown()).toBe(false);
  finish();
  await vi.waitFor(() => expect(app._isExportMode).toBe(false));
  expect(encode).toHaveBeenCalledTimes(1);
  expect(encode.mock.calls[0][0].format).toBe('webm');
  expect(frames).toEqual(Array(3).fill({ exportMode: true, width: 3840, height: 2160, background: 'hidden' }));
});

test('a double click on Export MP4 at a size H.264 cannot take makes one export, at the size the dialog offered', async () => {
  const { app, frames, running, finish } = await exportingApp();
  exportSize(app, 3840, 2160);
  const reducedAnswers = [];
  vi.spyOn(VideoExporter, '_testWebCodecsConfig').mockImplementation(width => (width === 3840
    ? Promise.resolve(null)
    : new Promise(resolve => reducedAnswers.push(resolve))));
  const encode = vi.spyOn(app.videoExporter, 'export');
  const mp4 = document.getElementById('export-mp4-btn');

  mp4.click();
  mp4.click();
  await vi.waitFor(() => expect(reducedAnswers).toHaveLength(2));
  reducedAnswers[0]({ codec: 'avc1' });
  await vi.waitFor(() => expect(codecDialogShown()).toBe(true));
  document.getElementById('codec-mp4-reduced').click();
  await running;
  // The second click's reduced probe answers while that export runs.
  reducedAnswers[1]({ codec: 'avc1' });
  await new Promise(resolve => setTimeout(resolve, 0));

  expect(codecDialogShown()).toBe(false);
  finish();
  await vi.waitFor(() => expect(app._isExportMode).toBe(false));
  expect(encode).toHaveBeenCalledTimes(1);
  expect(frames).toEqual(Array(3).fill({ exportMode: true, width: 1920, height: 1080, background: 'hidden' }));
});

test('a codec dialog still open when an export starts changes nothing of it when its reduced MP4 is chosen', async () => {
  const { app, frames, running, finish } = await exportingApp();
  exportSize(app, 3840, 2160);
  // The first click's probe finds H.264 cannot take the full size, and offers
  // a reduced one; the second's, answering later, finds it can (an encoder
  // another tab held has come free), and starts an export under the dialog.
  let secondAnswer;
  vi.spyOn(VideoExporter, '_testWebCodecsConfig')
    .mockResolvedValueOnce(null)
    .mockImplementationOnce(() => new Promise((resolve) => { secondAnswer = resolve; }))
    .mockResolvedValue({ codec: 'avc1' });
  const announce = vi.spyOn(app, 'announce');
  const mp4 = document.getElementById('export-mp4-btn');

  mp4.click();
  mp4.click();
  await vi.waitFor(() => expect(codecDialogShown()).toBe(true));
  secondAnswer({ codec: 'avc1' });
  await running;
  document.getElementById('codec-mp4-reduced').click();

  expect(announce).toHaveBeenLastCalledWith('A video export is already running.');
  expect({ width: app.exportSettings.resolutionX, height: app.exportSettings.resolutionY }).toEqual({ width: 3840, height: 2160 });
  finish();
  await vi.waitFor(() => expect(app._isExportMode).toBe(false));
  expect(frames).toEqual(Array(3).fill({ exportMode: true, width: 3840, height: 2160, background: 'hidden' }));
});

test('Escape cancels a running export, which puts everything back, and the next export runs', async () => {
  const { app, frames, running, finish } = await exportingApp();
  const announce = vi.spyOn(app, 'announce');
  const first = app.exportVideo();
  await running;

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await first;

  expect(announce).toHaveBeenLastCalledWith('Video export cancelled');
  expect(alert).not.toHaveBeenCalled();
  expect(app._isExportMode).toBe(false);
  expect(exportButtons()).toEqual([false, false, false, false]);
  const next = app.exportVideo();
  await vi.waitFor(() => expect(frames).toHaveLength(2));
  finish();
  await next;
  expect(announce).toHaveBeenLastCalledWith('Video export complete');
});

test.each([
  ['its encoder fails', (app) => {
    allowConsole(/Video export failed/);
    const encode = app.videoExporter.export;
    app.videoExporter.export = vi.fn().mockRejectedValueOnce(new Error('the encoder failed')).mockImplementation(encode);
    return { message: 'Export failed: the encoder failed', undo: () => {} };
  }],
  ['its route has no duration', (app) => {
    const timing = vi.spyOn(app, 'invalidateAnimationTiming').mockReturnValue(0);
    return { message: 'Animation duration is zero. Please check your waypoints.', undo: () => timing.mockRestore() };
  }],
])('an export that ends early because %s leaves the next one free to run', async (_, arrange) => {
  const { app, frames, finish } = await exportingApp();
  const { message, undo } = arrange(app);

  await app.exportVideo();

  expect(alert).toHaveBeenLastCalledWith(message);
  // (An export with no duration never enters export mode.)
  expect(Boolean(app._isExportMode)).toBe(false);
  expect(exportButtons()).toEqual([false, false, false, false]);
  undo();
  const next = app.exportVideo();
  await vi.waitFor(() => expect(frames).toHaveLength(1));
  finish();
  await next;
  expect(frames).toHaveLength(3);
});

test('a transparent export hides the background for its frames only', async () => {
  const { app, frames, running, finish } = await exportingApp();
  // A background, as a loaded image gives one: jsdom decodes none.
  const image = document.createElement('canvas');
  image.width = 1600;
  image.height = 1000;
  app.background.image = image;
  app.updateImageTransform(image);
  expect(app.exportSettings.pathOnly).toBe(true);

  const first = app.exportVideo();
  await running;
  finish();
  await first;

  expect(frames.map(frame => frame.background)).toEqual(['hidden', 'hidden', 'hidden']);
  expect(app.background.image).toBe(image);
});
