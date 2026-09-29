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
 * dialog's reduced MP4 carries included; and a codec probe, or the dialog it
 * opened, answers for the export the author last asked for alone: a probe
 * that answers after a later click or another request (even one that could
 * not start) asks for nothing and opens no dialog, and a dialog open when
 * another export is asked for closes, its choices and its hold on Escape
 * gone with it. An export is the app's from its first line to the end of its
 * clean-up, so a request made from anything it sets off on the way (focus
 * given back as a dialog closes, a size or mode change) is refused too.
 */

import { afterEach, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { authoredExtrasProject } from './fixtures/authoredExtras.js';
import { frameAt } from './helpers/drawLog.js';
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
  const label = document.getElementById('export-dropdown-btn').textContent;
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
  // The menu shows its own label again
  expect(progress.textContent).toBe(label);

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

/** Let every probe answer that is ready, and whatever it starts. */
const answered = () => new Promise(resolve => setTimeout(resolve, 0));

test('a double click on Export MP4 makes one export, of the click made last, and nothing is refused', async () => {
  const { app, running, finish } = await exportingApp();
  vi.spyOn(VideoExporter, '_testWebCodecsConfig').mockResolvedValue({ codec: 'avc1' });
  const encode = vi.spyOn(app.videoExporter, 'export');
  const announce = vi.spyOn(app, 'announce');
  const mp4 = document.getElementById('export-mp4-btn');

  mp4.click();
  mp4.click();
  await running;
  await answered();
  finish();
  await vi.waitFor(() => expect(app._isExportMode).toBe(false));

  expect(encode).toHaveBeenCalledTimes(1);
  expect(encode.mock.calls[0][0].format).toBe('mp4');
  expect(announce).not.toHaveBeenCalledWith('A video export is already running.');
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

  document.getElementById('export-mp4-btn').click();
  document.getElementById('export-webm-btn').click();
  await running;
  // H.264 cannot take the full size, but could take a reduced one.
  answer(null);
  await answered();

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
  // The first click's full-size answer comes after the second click: it asks
  // for nothing more, and the second click's goes on to the reduced size.
  await vi.waitFor(() => expect(reducedAnswers).toHaveLength(1));
  reducedAnswers[0]({ codec: 'avc1' });
  await vi.waitFor(() => expect(codecDialogShown()).toBe(true));
  document.getElementById('codec-mp4-reduced').click();
  await running;
  await answered();

  expect(codecDialogShown()).toBe(false);
  finish();
  await vi.waitFor(() => expect(app._isExportMode).toBe(false));
  expect(encode).toHaveBeenCalledTimes(1);
  expect(encode.mock.calls[0][0].format).toBe('mp4');
  expect(frames).toEqual(Array(3).fill({ exportMode: true, width: 1920, height: 1080, background: 'hidden' }));
});

/** Probes that open the codec dialog: no H.264 at all, or only at a reduced size. */
const DIALOGS = [
  ['no H.264 at all', () => vi.spyOn(VideoExporter, '_testWebCodecsConfig').mockResolvedValue(null)],
  ['H.264 only at a reduced size', () => vi.spyOn(VideoExporter, '_testWebCodecsConfig')
    .mockImplementation(width => Promise.resolve(width === 3840 ? null : { codec: 'avc1' }))],
];

test.each(DIALOGS)('the codec dialog’s WebM (%s) exports WebM at the full size', async (_, probes) => {
  const { app, frames, running, finish } = await exportingApp();
  exportSize(app, 3840, 2160);
  probes();
  const encode = vi.spyOn(app.videoExporter, 'export');

  document.getElementById('export-mp4-btn').click();
  await vi.waitFor(() => expect(codecDialogShown()).toBe(true));
  document.getElementById('codec-webm').click();
  await running;
  finish();
  await vi.waitFor(() => expect(app._isExportMode).toBe(false));

  expect(encode.mock.calls.map(([options]) => options.format)).toEqual(['webm']);
  expect(frames).toEqual(Array(3).fill({ exportMode: true, width: 3840, height: 2160, background: 'hidden' }));
});

test.each([
  ['completes', 'H.264 can take the full size'],
  ['completes', 'H.264 can take only a reduced size'],
  ['is cancelled with Escape', 'H.264 can take the full size'],
  ['is cancelled with Escape', 'H.264 can take only a reduced size'],
])('an MP4 probe still out when WebM was chosen asks for nothing once that export %s (%s)', async (ending, codec) => {
  const { app, frames, running, finish } = await exportingApp();
  exportSize(app, 3840, 2160);
  let answer;
  // A reduced size, were it probed, could be taken: its dialog would offer an
  // export nobody asked for.
  vi.spyOn(VideoExporter, '_testWebCodecsConfig')
    .mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }))
    .mockResolvedValue({ codec: 'avc1' });
  const encode = vi.spyOn(app.videoExporter, 'export');

  document.getElementById('export-mp4-btn').click();
  document.getElementById('export-webm-btn').click();
  await running;
  if (ending === 'completes') finish();
  else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));
  const drawn = frames.length;

  answer(codec === 'H.264 can take the full size' ? { codec: 'avc1' } : null);
  await answered();

  expect(encode).toHaveBeenCalledTimes(1);
  expect(app._videoExportRunning).toBe(false);
  expect(codecDialogShown()).toBe(false);
  expect(frames).toHaveLength(drawn);
});

test.each([
  ['can take', { codec: 'avc1' }], ['cannot take', null],
].flatMap(([can, reply]) => ['while that export runs', 'once it has ended'].map(when => [can, when, reply])))('WebM chosen while the reduced-size probe is out leaves that probe, saying H.264 %s the reduced size %s, asking for nothing', async (_, when, reply) => {
  // Either answer would open a dialog were it heard: the offered size, or
  // no H.264 at all.
  const { app, running, finish } = await exportingApp();
  exportSize(app, 3840, 2160);
  let reducedAnswer;
  vi.spyOn(VideoExporter, '_testWebCodecsConfig')
    .mockResolvedValueOnce(null)
    .mockImplementationOnce(() => new Promise((resolve) => { reducedAnswer = resolve; }));
  const encode = vi.spyOn(app.videoExporter, 'export');

  document.getElementById('export-mp4-btn').click();
  await vi.waitFor(() => expect(reducedAnswer).toBeDefined());
  document.getElementById('export-webm-btn').click();
  await running;
  if (when === 'while that export runs') {
    reducedAnswer(reply);
    await answered();
    // (No Escape here: it is the running export's.)
    expect([codecDialogShown(), document.getElementById('app').hasAttribute('inert')]).toEqual([false, false]);
    finish();
    await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));
  } else {
    finish();
    await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));
    reducedAnswer(reply);
    await answered();
  }

  expect(pageFreed()).toEqual(FREED);
  expect(encode.mock.calls.map(([options]) => options.format)).toEqual(['webm']);
});

test('an MP4 probe still out when an export starts another way asks for nothing once that export ends', async () => {
  const { app, running, finish } = await exportingApp();
  let answer;
  vi.spyOn(VideoExporter, '_testWebCodecsConfig').mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
  const encode = vi.spyOn(app.videoExporter, 'export');

  document.getElementById('export-mp4-btn').click();
  // An export the app starts itself, not through the export buttons.
  const other = app.exportVideo();
  await running;
  finish();
  await other;
  answer({ codec: 'avc1' });
  await answered();

  expect(encode).toHaveBeenCalledTimes(1);
  expect(app._videoExportRunning).toBe(false);
});

test.each([
  ['WebM is chosen', () => document.getElementById('export-webm-btn').click()],
  ['WebM is asked for through the bus', app => app.eventBus.emit('video:export-request', 'webm')],
  ['an export is asked for directly', app => { void app.exportVideo(); }],
])('an MP4 probe still out when %s asks for nothing, though that export could not start', async (_, request) => {
  const { app } = await exportingApp();
  expect(await loadSnapshot(app, { coordVersion: 9, waypoints: [{ id: 'only', imgX: 0.5, imgY: 0.5, isMajor: true }] })).toBe(true);
  let answer;
  vi.spyOn(VideoExporter, '_testWebCodecsConfig').mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));

  document.getElementById('export-mp4-btn').click();
  request(app);
  expect(alert).toHaveBeenCalledTimes(1);
  answer({ codec: 'avc1' });
  await answered();

  expect(alert).toHaveBeenCalledTimes(1);
});

/** Every way to put a codec dialog away without choosing. */
const DISMISSALS = [
  ['Cancel', () => document.getElementById('codec-cancel').click()],
  ['its close button', () => document.querySelector('#codec-unsupported-modal [data-modal-close]').click()],
  ['its backdrop', () => document.getElementById('codec-unsupported-modal').click()],
  ['Escape', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))],
];

/** Open a codec dialog from Export MP4, focused as a keyboard leaves it. */
async function openDialog(probes) {
  const exporting = await exportingApp();
  exportSize(exporting.app, 3840, 2160);
  probes();
  const mp4 = document.getElementById('export-mp4-btn');
  mp4.focus();
  mp4.click();
  await vi.waitFor(() => expect(codecDialogShown()).toBe(true));
  return exporting;
}

/** Whether the page is as a closed dialog leaves it: live, focus outside the dialog, and Escape free for others. */
function pageFreed() {
  const heard = vi.fn();
  window.addEventListener('keydown', heard);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  window.removeEventListener('keydown', heard);
  return {
    shown: codecDialogShown(),
    inert: document.getElementById('app').hasAttribute('inert'),
    focusInDialog: document.getElementById('codec-unsupported-modal').contains(document.activeElement),
    escapeHeard: heard.mock.calls.length,
  };
}
const FREED = { shown: false, inert: false, focusInDialog: false, escapeHeard: 1 };

/**
 * The transport is the author's again: no longer held for an export (a hold
 * left on keeps playback from ever scheduling a frame, whatever the
 * transport's own state says), and playing schedules one.
 */
function expectTransportFree(app) {
  const engine = app.animationEngine;
  expect(engine._transportSuspended).toBe(false);
  engine.play();
  expect(engine.animationFrameId).not.toBeNull();
  engine.pause();
}

test.each(DIALOGS.flatMap(([dialog, probes]) => DISMISSALS.map(([how, dismiss]) => [dialog, how, probes, dismiss])))('a codec dialog (%s) put away with %s is gone at once: hidden, the page live, focus out of it, and Escape free', async (_, __, probes, dismiss) => {
  await openDialog(probes);

  dismiss();

  expect(pageFreed()).toEqual(FREED);
});

test('Export MP4 clicked again while its codec dialog is open closes that dialog at once, and the new click’s answer is the one that counts', async () => {
  const { app, running, finish } = await openDialog(DIALOGS[0][1]);
  const encode = vi.spyOn(app.videoExporter, 'export');

  document.getElementById('export-mp4-btn').click();

  expect(codecDialogShown()).toBe(false);
  // The new click's probe answers the same, and opens the dialog afresh: its WebM exports.
  await vi.waitFor(() => expect(codecDialogShown()).toBe(true));
  document.getElementById('codec-webm').click();
  await running;
  finish();
  await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));
  expect(encode.mock.calls.map(([options]) => options.format)).toEqual(['webm']);
});

test('a click sent to Export MP4 while it is disabled, as it is while an export runs, asks for nothing', async () => {
  const { app, frames, running, finish } = await exportingApp();
  exportSize(app, 3840, 2160);
  const probe = vi.spyOn(VideoExporter, '_testWebCodecsConfig').mockResolvedValue(null);
  const first = app.exportVideo();
  await running;
  const mp4 = document.getElementById('export-mp4-btn');
  expect(mp4.disabled).toBe(true);

  mp4.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await answered();

  expect(probe).not.toHaveBeenCalled();
  expect(codecDialogShown()).toBe(false);
  finish();
  await first;
  expect(frames).toEqual(Array(3).fill({ exportMode: true, width: 3840, height: 2160, background: 'hidden' }));
});

test.each(DIALOGS)('a codec dialog (%s) open when an export is asked for another way closes, and the first Escape cancels that export', async (_, probes) => {
  const { app, running } = await exportingApp();
  exportSize(app, 3840, 2160);
  probes();
  const announce = vi.spyOn(app, 'announce');
  const mp4 = document.getElementById('export-mp4-btn');
  mp4.focus();
  mp4.click();
  await vi.waitFor(() => expect(codecDialogShown()).toBe(true));

  const other = app.exportVideo();
  await running;

  expect(codecDialogShown()).toBe(false);
  expect(document.getElementById('codec-unsupported-modal').contains(document.activeElement)).toBe(false);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await other;
  expect(announce).toHaveBeenLastCalledWith('Video export cancelled');
});

test.each(DIALOGS)('the choices of a codec dialog (%s) closed by another request ask for nothing, while that export runs or after it ends', async (_, probes) => {
  const { app, frames, running, finish } = await exportingApp();
  exportSize(app, 3840, 2160);
  probes();
  const encode = vi.spyOn(app.videoExporter, 'export');
  const announce = vi.spyOn(app, 'announce');
  document.getElementById('export-mp4-btn').click();
  await vi.waitFor(() => expect(codecDialogShown()).toBe(true));
  const first = app.exportVideo();
  await running;
  const choose = () => ['codec-mp4-reduced', 'codec-webm'].forEach(id => document.getElementById(id).click());

  choose();
  expect(announce).not.toHaveBeenCalledWith('A video export is already running.');
  expect({ width: app.exportSettings.resolutionX, height: app.exportSettings.resolutionY }).toEqual({ width: 3840, height: 2160 });
  finish();
  await first;
  choose();
  await answered();

  expect(encode).toHaveBeenCalledTimes(1);
  expect(app._videoExportRunning).toBe(false);
  expect(frames).toEqual(Array(3).fill({ exportMode: true, width: 3840, height: 2160, background: 'hidden' }));
});

test('an export request whose notice to the export controls throws holds no export, and the next one runs', async () => {
  const { app, frames, finish } = await exportingApp();
  vi.spyOn(app.uiController, 'exportRequested').mockImplementationOnce(() => { throw new Error('the notice failed'); });

  await expect(app.exportVideo()).rejects.toThrow('the notice failed');

  expect(app._videoExportRunning).toBeFalsy();
  expect(exportButtons()).toEqual([false, false, false, false]);
  const next = app.exportVideo();
  await vi.waitFor(() => expect(frames).toHaveLength(1));
  finish();
  await next;
  expect(frames).toHaveLength(3);
});

test('one click on Export MP4, H.264 taking the full size, exports MP4', async () => {
  const { app, frames, running, finish } = await exportingApp();
  vi.spyOn(VideoExporter, '_testWebCodecsConfig').mockResolvedValue({ codec: 'avc1' });
  const encode = vi.spyOn(app.videoExporter, 'export');

  document.getElementById('export-mp4-btn').click();
  await running;
  finish();
  await vi.waitFor(() => expect(app._isExportMode).toBe(false));

  expect(encode.mock.calls.map(([options]) => options.format)).toEqual(['mp4']);
  expect(frames).toHaveLength(3);
});

test.each([
  ['a WebM export completed', async ({ app, finish }) => {
    document.getElementById('export-webm-btn').click();
    await vi.waitFor(() => expect(app._videoExportRunning).toBe(true));
    await vi.waitFor(() => expect(app.videoExporter.export).toHaveBeenCalled());
    finish();
    await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));
  }],
  ['a WebM export cancelled with Escape', async ({ app, running }) => {
    document.getElementById('export-webm-btn').click();
    await running;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));
  }],
  ['a codec dialog dismissed', async () => {
    VideoExporter._testWebCodecsConfig.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    document.getElementById('export-mp4-btn').click();
    await vi.waitFor(() => expect(codecDialogShown()).toBe(true));
    document.getElementById('codec-cancel').click();
  }],
])('after %s, the next click on Export MP4 exports MP4', async (_, before) => {
  const exporting = await exportingApp();
  const { app, frames, finish } = exporting;
  vi.spyOn(VideoExporter, '_testWebCodecsConfig').mockResolvedValue({ codec: 'avc1' });
  const encode = vi.spyOn(app.videoExporter, 'export');
  await before(exporting);
  const drawn = frames.length;

  document.getElementById('export-mp4-btn').click();
  await vi.waitFor(() => expect(frames).toHaveLength(drawn + 1));
  finish();
  await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));

  expect(encode.mock.calls.at(-1)[0].format).toBe('mp4');
  expect(frames).toHaveLength(drawn + 3);
});

test('a refused request leaves the running export drawing what it drew', async () => {
  const { app, running, finish } = await exportingApp();
  // A fixed camera, so the same instant draws the same frame.
  app.exportSettings.includeCamera = false;
  app.motionSettings.pathVisibility = 'always-show';
  const first = app.exportVideo();
  await running;
  frameAt(app, 0.5, { state: 'drawn' });
  const drawn = frameAt(app, 0.5, { state: 'drawn' });
  const settings = JSON.stringify({ motion: app.motionSettings, styles: app.styles, export: app.exportSettings });

  await app.exportVideo();
  app.eventBus.emit('video:export-request', { format: 'webm', resolution: { width: 640, height: 360 } });

  expect(JSON.stringify({ motion: app.motionSettings, styles: app.styles, export: app.exportSettings })).toBe(settings);
  expect(frameAt(app, 0.5, { state: 'drawn' })).toEqual(drawn);
  finish();
  await first;
});

test('an export whose clean-up throws still lets the next one run', async () => {
  const { app, frames, running, finish } = await exportingApp();
  vi.spyOn(app, '_exitExportMode').mockImplementationOnce(() => { throw new Error('the clean-up failed'); });
  const first = app.exportVideo();
  const failed = expect(first).rejects.toThrow('the clean-up failed');
  await running;
  finish();
  await failed;

  expect(app._videoExportRunning).toBe(false);
  const next = app.exportVideo();
  await vi.waitFor(() => expect(frames).toHaveLength(4));
  finish();
  await next;
  expect(frames).toHaveLength(6);
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
  expectTransportFree(app);
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

/** A request made from the next focus given back, as a page's own script might make one. */
function onNextFocus(request) {
  const made = [];
  document.addEventListener('focusin', () => made.push(request()), { once: true });
  return made;
}

test('an export asked for from focus given back as another export closes a codec dialog is refused, and the first draws every frame as it began', async () => {
  const { app, frames, running, finish } = await openDialog(DIALOGS[1][1]);
  const encode = vi.spyOn(app.videoExporter, 'export');
  const nested = onNextFocus(() => app.exportVideo());

  const first = app.exportVideo();
  await running;
  finish();
  await first;
  await Promise.all(nested);

  expect(nested).toHaveLength(1);
  expect(encode).toHaveBeenCalledTimes(1);
  expect(frames).toEqual(Array(3).fill({ exportMode: true, width: 3840, height: 2160, background: 'hidden' }));
  expect([app._videoExportRunning, app._isExportMode, exportButtons()]).toEqual([false, false, [false, false, false, false]]);
});

test('a request through the bus from focus given back as an export starts, in Edit, is refused before it shows its tip about Preview', async () => {
  const { app, running, finish } = await openDialog(DIALOGS[1][1]);
  app._setPreviewMode(false);
  const tips = vi.spyOn(app, 'showToast');
  const told = vi.spyOn(app, 'announce');
  const nested = onNextFocus(() => app.eventBus.emit('video:export-request', 'webm'));

  const first = app.exportVideo();
  await running;
  finish();
  await first;

  expect(nested).toHaveLength(1);
  expect(told).toHaveBeenCalledWith('A video export is already running.');
  expect(tips).not.toHaveBeenCalled();
});

test('an export asked for while a request sets its own size is refused, and that request exports in its own format and size', async () => {
  const { app, frames, running, finish } = await exportingApp();
  const encode = vi.spyOn(app.videoExporter, 'export');
  const nested = [];
  const onSize = () => {
    app.eventBus.off('video:resolution-change', onSize);
    nested.push(app.eventBus.emit('video:export-request', 'webm'));
  };
  app.eventBus.on('video:resolution-change', onSize);

  app.eventBus.emit('video:export-request', { format: 'mp4', resolution: { width: 1920, height: 1080 } });
  await running;
  finish();
  await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));

  expect(nested).toHaveLength(1);
  expect(encode.mock.calls.map(([options]) => options.format)).toEqual(['mp4']);
  expect(app.exportSettings.format).toBe('mp4');
  expect(frames).toEqual(Array(3).fill({ exportMode: true, width: 1920, height: 1080, background: 'hidden' }));
});

test('an export asked for while another is cleaned up, as the mode it began in is put back, is refused, and the clean-up leaves the controls free', async () => {
  const { app, frames, running, finish } = await exportingApp();
  // In Edit, so the clean-up puts the mode back, and says so on the bus.
  app._setPreviewMode(false);
  const encode = vi.spyOn(app.videoExporter, 'export');
  const first = app.exportVideo();
  await running;
  const nested = [];
  const onMode = (preview) => {
    if (preview) return;
    app.eventBus.off('motion:preview-mode-change', onMode);
    nested.push(app.exportVideo());
  };
  app.eventBus.on('motion:preview-mode-change', onMode);

  finish();
  await first;
  await Promise.all(nested);

  expect(nested).toHaveLength(1);
  expect(encode).toHaveBeenCalledTimes(1);
  expect(frames).toHaveLength(3);
  expect([app.previewMode, app._videoExportRunning, app._isExportMode, exportButtons()]).toEqual([false, false, false, [false, false, false, false]]);
});

test('Export MP4 clicked while its codec dialog is open, whose closing lets another export start first, asks for nothing, not even a probe', async () => {
  const { app, running, finish } = await openDialog(DIALOGS[1][1]);
  const encode = vi.spyOn(app.videoExporter, 'export');
  const nested = onNextFocus(() => app.exportVideo());
  const probed = VideoExporter._testWebCodecsConfig.mock.calls.length;

  document.getElementById('export-mp4-btn').click();
  await running;
  await answered();
  await answered();

  expect(nested).toHaveLength(1);
  expect(VideoExporter._testWebCodecsConfig.mock.calls.length, 'a probe started once the other export had').toBe(probed);
  expect(codecDialogShown()).toBe(false);
  expect(document.getElementById('app').hasAttribute('inert')).toBe(false);
  finish();
  await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));
  expect(encode).toHaveBeenCalledTimes(1);
});

test('Export MP4 clicked while its codec dialog is open, whose closing asks for an export that cannot start, asks for nothing, not even a probe', async () => {
  const { app } = await openDialog(DIALOGS[1][1]);
  const encode = vi.spyOn(app.videoExporter, 'export');
  // As the dialog closes, a request finds one waypoint left, and is refused
  // for it: the click, asked for before it, is no longer the latest
  const nested = onNextFocus(() => {
    while (app.waypoints.length > 1) app.eventBus.emit('waypoint:delete', app.waypoints.at(-1));
    return app.exportVideo();
  });
  const probed = VideoExporter._testWebCodecsConfig.mock.calls.length;

  document.getElementById('export-mp4-btn').click();
  await Promise.all(nested);
  await answered();
  await answered();

  expect(nested).toHaveLength(1);
  expect(alert).toHaveBeenCalledWith('Please add at least 2 waypoints before exporting.');
  expect(VideoExporter._testWebCodecsConfig.mock.calls.length, 'a probe for a click a later request superseded').toBe(probed);
  expect(encode).not.toHaveBeenCalled();
  expect([app._videoExportRunning, codecDialogShown()]).toEqual([false, false]);
});

test.each([['WebM', 'codec-webm'], ['the reduced MP4', 'codec-mp4-reduced']])('%s chosen in a codec dialog asks for nothing when closing it lets another export start first, which draws every frame as it began', async (_, choice) => {
  const { app, frames, running, finish } = await openDialog(DIALOGS[1][1]);
  const encode = vi.spyOn(app.videoExporter, 'export');
  const nested = onNextFocus(() => app.exportVideo());
  const told = vi.spyOn(app, 'announce');

  document.getElementById(choice).click();
  await running;
  await answered();
  finish();
  await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));

  expect(nested).toHaveLength(1);
  expect(encode).toHaveBeenCalledTimes(1);
  // The choice asked for nothing: not even a request to be refused.
  expect(told).not.toHaveBeenCalledWith('A video export is already running.');
  expect(frames).toEqual(Array(3).fill({ exportMode: true, width: 3840, height: 2160, background: 'hidden' }));
});

test.each([
  ['3840×2160', [3840, 2160], [1920, 1080]],
  ['7680×4320, past H.264’s nine million pixels', [7680, 4320], [4000, 2250]],
])('the reduced MP4 the codec dialog offers for %s exports at the size it offered, asked for again after the dialog was put away', async (_, [width, height], [reducedWidth, reducedHeight]) => {
  const { app, frames, running, finish } = await exportingApp();
  exportSize(app, width, height);
  vi.spyOn(VideoExporter, '_testWebCodecsConfig').mockImplementation(probed => Promise.resolve(probed === width ? null : { codec: 'avc1' }));
  const encode = vi.spyOn(app.videoExporter, 'export');
  const mp4 = document.getElementById('export-mp4-btn');
  mp4.click();
  await vi.waitFor(() => expect(codecDialogShown()).toBe(true));
  document.getElementById('codec-cancel').click();

  mp4.click();
  await vi.waitFor(() => expect(codecDialogShown()).toBe(true));
  expect(document.getElementById('codec-mp4-reduced').textContent).toBe(`Export MP4 at ${reducedWidth}×${reducedHeight}`);
  document.getElementById('codec-mp4-reduced').click();
  await running;
  finish();
  await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));

  expect(encode.mock.calls.map(([options]) => options.format)).toEqual(['mp4']);
  expect(frames).toEqual(Array(3).fill({ exportMode: true, width: reducedWidth, height: reducedHeight, background: 'hidden' }));
});

test.each(['while it runs', 'once it ends'])('Export MP4 clicked from focus given back as an export closes a codec dialog asks for nothing, %s', async (when) => {
  const { app, running, finish } = await openDialog(DIALOGS[1][1]);
  let answer;
  const probe = VideoExporter._testWebCodecsConfig;
  probe.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
  const probes = probe.mock.calls.length;
  const encode = vi.spyOn(app.videoExporter, 'export');
  const clicked = onNextFocus(() => app.elements.exportMp4Btn.click());

  const first = app.exportVideo({ format: 'webm' });
  await running;
  if (when === 'once it ends') {
    finish();
    await first;
  }
  answer?.(when === 'once it ends' ? { codec: 'avc1' } : null);
  await answered();
  await answered();

  expect(clicked).toHaveLength(1);
  expect(probe.mock.calls.length - probes).toBe(0);
  expect(codecDialogShown()).toBe(false);
  finish();
  await first;
  await answered();
  expect(encode.mock.calls.map(([options]) => options.format)).toEqual(['webm']);
});

test.each([
  ['its clean-up', app => vi.spyOn(app, '_exitExportMode').mockImplementationOnce(() => { throw new Error('the clean-up failed'); })],
  ['its starting announcement', app => vi.spyOn(app, 'announce').mockImplementationOnce(() => { throw new Error('the announcement failed'); })],
])('an export that throws in %s puts back what it can, frees the controls, and the next export runs from them', async (where, fail) => {
  const { app, running, finish, frames } = await exportingApp();
  const encode = vi.spyOn(app.videoExporter, 'export');
  const image = document.createElement('canvas');
  image.width = 1600;
  image.height = 1000;
  app.background.image = image;
  app.exportSettings.pathOnly = true;
  const transport = app.animationEngine.state.captureTransportState();
  const label = document.getElementById('export-dropdown-btn').textContent;
  fail(app);
  if (where === 'its starting announcement') allowConsole(/Video export failed/);

  const first = app.exportVideo();
  if (where === 'its clean-up') {
    const failed = expect(first).rejects.toThrow('the clean-up failed');
    await running;
    finish();
    await failed;
  } else {
    await first;
  }

  expect([app._videoExportRunning, exportButtons()]).toEqual([false, [false, false, false, false]]);
  expect(document.getElementById('export-dropdown-btn').textContent).toBe(label);
  expect(app.background.image).toBe(image);
  expect(app.animationEngine.state.captureTransportState()).toEqual(transport);
  expectTransportFree(app);
  const before = encode.mock.calls.length;
  const drawn = frames.length;
  app.elements.exportWebmBtn.click();
  // The next export's first frame, then its hold let go.
  await vi.waitFor(() => expect(frames.length).toBe(drawn + 1));
  finish();
  await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));
  expect(encode.mock.calls.length).toBe(before + 1);
  expect(encode.mock.calls.at(-1)[0].format).toBe('webm');
});

test('the reduced MP4 chosen in a codec dialog holds the export before its size is set: a request made as the size changes is refused', async () => {
  const { app, running, finish } = await openDialog(DIALOGS[1][1]);
  const encode = vi.spyOn(app.videoExporter, 'export');
  const held = [];
  const onSize = () => {
    app.eventBus.off('video:resolution-change', onSize);
    held.push(app._videoExportRunning);
    app.eventBus.emit('video:export-request', 'webm');
  };
  app.eventBus.on('video:resolution-change', onSize);

  document.getElementById('codec-mp4-reduced').click();
  await running;
  finish();
  await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));

  expect(held).toEqual([true]);
  expect(encode.mock.calls.map(([options]) => options.format)).toEqual(['mp4']);
});

test.each([
  ['its download link is clicked', (app, request) => {
    VideoExporter.downloadBlob.mockRestore();
    const clicked = (event) => {
      if (!event.target.matches('a[download]')) return;
      event.preventDefault();
      document.removeEventListener('click', clicked);
      request();
    };
    document.addEventListener('click', clicked);
  }],
  ['its transport is put back', (app, request) => {
    const seeked = () => {
      if (app._isExportMode) return;
      app.eventBus.off('animation:seek', seeked);
      request();
    };
    app.eventBus.on('animation:seek', seeked);
  }],
])('an export asked for as a finishing export’s %s is refused, and the controls are free once it has let go', async (_, at) => {
  const { app, running, finish } = await exportingApp();
  const encode = vi.spyOn(app.videoExporter, 'export');
  const nested = [];
  at(app, () => nested.push(app.exportVideo()));

  const first = app.exportVideo();
  await running;
  finish();
  await first;
  await Promise.all(nested);

  expect(nested).toHaveLength(1);
  expect(encode).toHaveBeenCalledTimes(1);
  expect([app._videoExportRunning, app._isExportMode, exportButtons()]).toEqual([false, false, [false, false, false, false]]);
});

test('an export whose clean-up fails at two steps reports both, puts back the rest, and Export MP4 then exports MP4', async () => {
  const { app, running, finish, frames } = await exportingApp();
  const exitFailed = new Error('exit failed');
  const redrawFailed = new Error('redraw failed');
  vi.spyOn(app, '_exitExportMode').mockImplementationOnce(() => { throw exitFailed; });
  const failed = app.exportVideo().catch(error => error);
  await running;
  vi.spyOn(app, 'queueRender').mockImplementation(() => { throw redrawFailed; });
  finish();
  const error = await failed;
  app.queueRender.mockRestore();

  expect(error).toBeInstanceOf(AggregateError);
  expect(error.errors).toEqual([exitFailed, redrawFailed]);
  expect([app._videoExportRunning, exportButtons()]).toEqual([false, [false, false, false, false]]);
  const encode = vi.spyOn(app.videoExporter, 'export');
  const probe = vi.spyOn(VideoExporter, '_testWebCodecsConfig').mockResolvedValue({ codec: 'avc1' });
  const drawn = frames.length;
  app.elements.exportMp4Btn.click();
  // The next export's first frame, then its hold let go.
  await vi.waitFor(() => expect(frames.length).toBe(drawn + 1));
  finish();
  await vi.waitFor(() => expect(app._videoExportRunning).toBe(false));
  expect(probe).toHaveBeenCalledTimes(1);
  expect(encode.mock.calls.map(([options]) => options.format)).toEqual(['mp4']);
});

test.each([
  ['its Escape listener off the window', () => {
    const remove = window.removeEventListener.bind(window);
    const fault = vi.spyOn(window, 'removeEventListener').mockImplementationOnce(() => { throw new Error('remove failed'); });
    return () => {
      const [type, listener, capture] = fault.mock.calls[0];
      fault.mockRestore();
      remove(type, listener, capture);
    };
  }],
  ...['video:export-paused', 'video:export-resumed'].map(event => [`its ${event} listener off the bus`, (app) => {
    const off = app.eventBus.off.bind(app.eventBus);
    let kept = null;
    const fault = vi.spyOn(app.eventBus, 'off').mockImplementation((name, callback) => {
      if (name === event && kept === null) {
        kept = callback;
        throw new Error('remove failed');
      }
      return off(name, callback);
    });
    return () => {
      fault.mockRestore();
      off(event, kept);
    };
  }]),
])('a clean-up that fails to take %s still puts back the rest, and frees the controls', async (_, failOnce) => {
  const { app, running, finish } = await exportingApp();
  const image = document.createElement('canvas');
  app.background.image = image;
  app.exportSettings.pathOnly = true;
  const transport = app.animationEngine.state.captureTransportState();
  const listening = () => ['video:export-paused', 'video:export-resumed'].map(event => app.eventBus.listenerCount(event));
  const before = listening();
  const failed = app.exportVideo().catch(error => error);
  await running;
  const letGo = failOnce(app);
  finish();
  const error = await failed;
  // The one listener the fault kept is taken off here, so what is checked is the rest
  letGo();

  expect(error.message).toBe('remove failed');
  expect(app.background.image).toBe(image);
  expect(listening()).toEqual(before);
  expect(app.animationEngine.state.captureTransportState()).toEqual(transport);
  expectTransportFree(app);
  expect([app._videoExportRunning, app._isExportMode, exportButtons()]).toEqual([false, false, [false, false, false, false]]);
});

test('a finished export no longer listens for its pause and resume', async () => {
  const { app, running, finish } = await exportingApp();
  const listening = () => ['video:export-paused', 'video:export-resumed'].map(event => app.eventBus.listenerCount(event));
  const before = listening();
  const label = document.getElementById('export-dropdown-btn').textContent;
  const first = app.exportVideo();
  await running;
  expect(listening()).toEqual(before.map(count => count + 1));
  finish();
  await first;

  expect(listening()).toEqual(before);
  app.eventBus.emit('video:export-paused');
  app.eventBus.emit('video:export-resumed');
  expect(document.getElementById('export-dropdown-btn').textContent).toBe(label);
});
