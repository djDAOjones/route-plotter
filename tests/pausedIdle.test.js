/**
 * DEF-44 — a still editor queues no animation frame.
 *
 * The camera eases a smoothed zoom and centre toward their targets, and the
 * render loop stays awake while any of them is short of its target
 * (`CameraService.isZoomTransitioning`, `playback.js`). Only a frame that
 * draws the camera eased them, so wherever a target moved without one (no
 * waypoints, Edit mode, Camera movement off) the gap never closed, and a view
 * that should be still ran about 60 frames a second, against the rule that a
 * stable paused view queues none. A frame that draws no camera now puts it on
 * its target; Preview, where it is drawn, still eases it.
 *
 * Frames run only when a test runs them, 20 ms apart, so a loop that never
 * sleeps shows as a frame still queued after hundreds, not as a timeout. The
 * last two tests hold the camera to settling in one call, not a frame late.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { CameraService } from '../src/services/CameraService.js';
import { VideoExporter } from '../src/services/VideoExporter.js';

/** Slower than the engine's 60 fps gate, so every frame updates. */
const FRAME_MS = 20;
/** Ten seconds of frames: a loop still awake after these never sleeps. */
const NEVER_IDLE = 500;
/**
 * A view that draws no camera settles in the frames already queued for it;
 * easing the camera's centre out of sight took some eighty more.
 */
const SETTLES_WITHIN = 10;

let frames;
let originalRequest;
let originalCancel;

beforeEach(() => {
  originalRequest = globalThis.requestAnimationFrame;
  originalCancel = globalThis.cancelAnimationFrame;
  frames = frameHarness();
  globalThis.requestAnimationFrame = frames.request;
  globalThis.cancelAnimationFrame = frames.cancel;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRequest;
  globalThis.cancelAnimationFrame = originalCancel;
  localStorage.getItem.mockImplementation(() => null);
});

/**
 * Animation frames that run only when the test runs them, as
 * `performanceScheduling.test.js` runs them, on a clock of 20 ms a frame.
 */
function frameHarness() {
  let nextId = 1;
  let now = 0;
  const pending = new Map();
  const harness = {
    pending,
    request: vi.fn((callback) => {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    }),
    cancel: vi.fn((id) => { pending.delete(id); }),
    /** Run the oldest queued frame. */
    runNext() {
      const [id, callback] = pending.entries().next().value;
      pending.delete(id);
      now += FRAME_MS;
      callback(now);
    },
    /** Run frames until none is queued, or `limit` have run; how many ran. */
    runUntilIdle(limit = NEVER_IDLE) {
      let ran = 0;
      while (pending.size > 0 && ran < limit) {
        harness.runNext();
        ran += 1;
      }
      return ran;
    },
  };
  return harness;
}

/** The view settles in the frames already queued for it, then queues none. */
function expectIdle(label) {
  const ran = frames.runUntilIdle();
  expect(frames.pending.size, `${label}: a frame is still queued after ${ran}`).toBe(0);
  expect(ran, `${label}: the frames it ran before going idle`).toBeLessThanOrEqual(SETTLES_WITHIN);
}

/** From now on, the camera each frame is drawn with, as the renderer is handed it. */
function watchCamera(app) {
  const render = vi.spyOn(app.renderingService, 'render');
  return () => render.mock.calls.map(([, , , state]) => state.cameraState);
}

/**
 * A booted editor in Preview, where it starts, with two waypoints whose
 * camera zooms 3× (set as the This Zoom slider sets it), at rest at the start.
 */
async function routeWithCamera() {
  const app = await bootApp();
  await app.ready;
  app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.8, imgY: 0.7, isMajor: true });
  for (const waypoint of app.waypoints) waypoint.camera.zoom = 3;
  app.eventBus.emit('ui:animation:skip-start');
  frames.runUntilIdle();
  expect(app.previewMode).toBe(true);
  expect(app.exportSettings.includeCamera).toBe(true);
  return app;
}

/** Play for 300 ms, so the camera trails the moving head, then pause. */
function playAMomentAndPause(app) {
  app.eventBus.emit('ui:animation:play');
  for (let frame = 0; frame < 15; frame += 1) frames.runNext();
  app.eventBus.emit('ui:animation:pause');
}

/** The Camera movement checkbox, as the author unticks it. */
function untickCameraMovement(app) {
  const checkbox = app.elements.exportIncludeCamera;
  checkbox.checked = false;
  checkbox.dispatchEvent(new Event('change'));
}

describe('DEF-44: a still view queues no animation frame', () => {

  test('a cold start with no waypoints goes idle once drawn', async () => {
    // Its target was the canvas centre and its smoothed centre (0, 0), which
    // no frame eased while there were no waypoints to follow.
    const app = await bootApp();
    await app.ready;
    expect(app.waypoints).toEqual([]);
    expect(app.previewMode).toBe(true);

    expectIdle('a cold start');
  });

  test.each([
    ['off', false],
    ['on', true],
  ])('a session restored in Preview with Camera movement %s goes idle once drawn', async (setting, includeCamera) => {
    // A bundled example, as recovery finds it; each is saved with Camera
    // movement off. The startup frame, drawn before the restore with no
    // waypoints, left the camera short of the canvas centre: with the camera
    // off nothing eased it there, and with it on, at 1×, its centre eased
    // there out of sight for some eighty frames.
    const project = buildExampleProjects().find(each => each.id === 'uon-open-day').project;
    project.exportSettings.includeCamera = includeCamera;
    const saved = JSON.stringify(project);
    localStorage.getItem.mockImplementation(key => (key === 'routePlotter_autosave' ? saved : null));

    const app = await bootApp();
    await app.ready;
    expect(app.waypoints.length).toBeGreaterThan(1);
    expect(app.previewMode).toBe(true);
    expect(app.exportSettings.includeCamera).toBe(includeCamera);

    expectIdle(`a session restored with Camera movement ${setting}`);
  });

  test('leaving Preview while the camera eases leaves Edit mode idle, and Preview resumes where it was heading', async () => {
    const app = await routeWithCamera();
    const drawn = watchCamera(app);
    playAMomentAndPause(app);

    // Paused, the camera still eases after the head, as the rule allows in
    // Preview: a frame stays queued for it, and each draws it zoomed and moved.
    let previous = drawn().at(-1);
    for (let frame = 0; frame < 3; frame += 1) {
      expect(frames.pending.size, `easing frame ${frame + 1} is queued`).toBeGreaterThan(0);
      frames.runNext();
      const current = drawn().at(-1);
      expect(current.enabled).toBe(true);
      expect(current.zoom).toBeCloseTo(3);
      expect(Math.hypot(current.centerX - previous.centerX, current.centerY - previous.centerY),
        `easing frame ${frame + 1} moves the camera`).toBeGreaterThan(0.1);
      previous = current;
    }
    expect(frames.pending.size, 'the camera is still easing').toBeGreaterThan(0);

    app.elements.modeToggleBtn.click();
    expect(app.previewMode).toBe(false);
    expectIdle('Edit mode, left while the camera eased');
    expect(drawn().at(-1)).toMatchObject({ zoom: 1, enabled: false });

    // The move ended on its target, unseen, so Preview draws the camera there
    // at once: not eased in again from the flat view, nor on from where it
    // was left.
    const before = drawn().length;
    app.elements.modeToggleBtn.click();
    expect(app.previewMode).toBe(true);
    expectIdle('Preview again');
    const resumed = drawn().slice(before);
    expect(resumed.length).toBeGreaterThan(0);
    expect(resumed[0].enabled).toBe(true);
    expect(resumed[0].zoom).toBeCloseTo(3);
    for (const later of resumed) expect(later).toEqual(resumed[0]);
  });

  test('unticking Camera movement while the camera eases leaves Preview idle', async () => {
    const app = await routeWithCamera();
    const drawn = watchCamera(app);
    playAMomentAndPause(app);
    frames.runNext();
    expect(frames.pending.size, 'the camera is still easing').toBeGreaterThan(0);

    untickCameraMovement(app);
    expect(app.exportSettings.includeCamera).toBe(false);
    expectIdle('Preview with Camera movement off');
    expect(drawn().at(-1)).toMatchObject({ zoom: 1, enabled: false });
  });

  test('Skip to start in Edit mode, after the camera zoomed in Preview, goes idle', async () => {
    // A reset puts the zoom's rate limiter back to 1× (`resetRateLimiter`),
    // short of the 3× target, and only a frame that drew the camera took it
    // back there.
    const app = await routeWithCamera();
    app.eventBus.emit('ui:animation:seek', 0.5);
    frames.runUntilIdle();
    app.elements.modeToggleBtn.click();
    expectIdle('Edit mode');

    app.eventBus.emit('ui:animation:skip-start');
    expectIdle('Edit mode, after Skip to start');
  });

  test('removing every waypoint while the camera is zoomed in Preview goes idle', async () => {
    // With no waypoints the camera's target is the flat view, which no frame
    // eased the 3× camera toward, so the next frame that woke the loop, here
    // a scrub of the timeline, kept it awake.
    const app = await routeWithCamera();
    app.eventBus.emit('ui:animation:seek', 0.5);
    frames.runUntilIdle();
    for (const waypoint of [...app.waypoints]) app.eventBus.emit('waypoint:delete', waypoint);
    expect(app.waypoints).toEqual([]);
    frames.runUntilIdle();

    app.eventBus.emit('ui:animation:seek', 0.25);
    expectIdle('no waypoints, after a scrub');
  });

  test('a video exported from Edit mode leaves the editor idle', async () => {
    // The export draws in Preview at the export size, and leaving it draws
    // one frame at the display size, which moves the camera's target; back
    // in Edit mode nothing eased the camera after it.
    const download = vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    try {
      const app = await routeWithCamera();
      app.elements.modeToggleBtn.click();
      expectIdle('Edit mode');

      // The real exportVideo(), with only the encoder replaced
      app.videoExporter = {
        cancel() {},
        async export({ renderFrame }) {
          for (let step = 0; step <= 30; step += 1) await renderFrame(step / 30);
          return new Blob(['video']);
        },
      };
      await app.exportVideo();
      expect(download).toHaveBeenCalledTimes(1);
      expect(app.previewMode).toBe(false);

      expectIdle('Edit mode, after the export');
    } finally {
      download.mockRestore();
    }
  });

});

describe('DEF-44: the camera settles where no frame eases it', () => {

  /** A 4× camera part-way through a move, its zoom's rate limit reset to 1× as a reset leaves it. */
  function cameraMidMove() {
    const camera = new CameraService();
    camera._targetZoom = 4;
    camera._rateLimitedZoom = 1;
    camera._smoothedZoom = 2.5;
    camera._targetCenterX = 700;
    camera._targetCenterY = 300;
    camera._smoothedCenterX = 0;
    camera._smoothedCenterY = 0;
    expect(camera.isZoomTransitioning(1200, 800)).toBe(true);
    return camera;
  }

  test('settling puts the zoom, its rate limit and the centre on their targets in one call', () => {
    const camera = cameraMidMove();

    camera.settle();

    expect(camera.isZoomTransitioning(1200, 800)).toBe(false);
    expect([camera._rateLimitedZoom, camera._smoothedZoom]).toEqual([4, 4]);
    expect([camera._smoothedCenterX, camera._smoothedCenterY]).toEqual([700, 300]);
  });

  test('with no waypoints the camera rests on the flat view in one frame', () => {
    const camera = cameraMidMove();

    const state = camera.calculateCameraState({ waypoints: [], canvasWidth: 1200, canvasHeight: 800 });

    expect(state).toEqual({ zoom: 1, centerX: 600, centerY: 400, enabled: false });
    expect(camera.isZoomTransitioning(1200, 800)).toBe(false);
    expect([camera._rateLimitedZoom, camera._smoothedZoom]).toEqual([1, 1]);
    expect([camera._smoothedCenterX, camera._smoothedCenterY]).toEqual([600, 400]);
  });

});
