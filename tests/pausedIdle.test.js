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
 * its target: in Edit mode, with Camera movement off, and under the author's
 * viewport zoom, which takes the camera's place. That target is where the
 * camera comes to rest, its target zoom and the centre at that zoom, so a
 * camera drawn again is drawn there at once. Where it is drawn, in Preview
 * and in the exported player, it still eases.
 *
 * Not every still view goes idle at once: DEF-44's plan row names the bounded
 * residuals found. One is pinned here, on `main` too: easing back to 1× from
 * just above it, the camera can end with frames that draw the same flat view,
 * as the renderer draws it flat within 0.001 of 1× while its centre eases on
 * to within a pixel. It ends by itself; the last test holds it to ten frames.
 *
 * Frames run only when a test runs them, so a loop that never sleeps shows as
 * a frame still queued after hundreds, not as a timeout. They run on one
 * clock, which `performance.now()` reads too (the camera's zoom rate limit
 * does): it starts at zero, as on a page just opened, and moves 20 ms a frame.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { CameraService } from '../src/services/CameraService.js';
import { VideoExporter } from '../src/services/VideoExporter.js';
import { contextIdFor, recordCallOrder, takeOrderedCalls } from './setup.js';

/** Slower than the engine's 60 fps gate, so every frame updates. */
const FRAME_MS = 20;
/** Ten seconds of frames: a loop still awake after these never sleeps. */
const NEVER_IDLE = 500;
/**
 * A view that draws no camera settles in the frames already queued for it;
 * easing the camera's centre out of sight took some eighty more.
 */
const SETTLES_WITHIN = 10;
/**
 * A camera within this of 1× is drawn flat. This test's own figure, so which
 * frames count as flat is not taken from the code under test, which holds it
 * in `RenderingService`: `cameraApplies` for the image, and `render`'s own
 * check for the vector layer.
 */
const FLAT_WITHIN = 0.001;

let frames;
let originalRequest;
let originalCancel;

beforeEach(() => {
  originalRequest = globalThis.requestAnimationFrame;
  originalCancel = globalThis.cancelAnimationFrame;
  frames = frameHarness();
  globalThis.requestAnimationFrame = frames.request;
  globalThis.cancelAnimationFrame = frames.cancel;
  performance.now.mockImplementation(() => frames.now());
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRequest;
  globalThis.cancelAnimationFrame = originalCancel;
  performance.now.mockImplementation(() => Date.now());
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
    /** The clock, in ms: frames and `performance.now()` both read it. */
    now: () => now,
    /** Move the clock on without running a frame. */
    wait(ms) {
      now += ms;
    },
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
  expect(frames.pending.size, 'the camera came to rest at the start').toBe(0);
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

/** The canvas's bottom-right corner, in image coordinates. */
const THE_CORNER = { x: 0.98, y: 0.98 };

/**
 * A booted editor in Preview, at rest at the start, whose route runs from
 * (0.2, 0.3) with a 3× camera to `end`, by or on the canvas's edge, with an
 * `endZoom` camera: zoomed in there, the view stops at the edge, short of the
 * head.
 */
async function routeToTheEdge(end, endZoom) {
  const app = await bootApp();
  await app.ready;
  app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: end.x, imgY: end.y, isMajor: true });
  app.waypoints[0].camera.zoom = 3;
  app.waypoints[1].camera.zoom = endZoom;
  app.eventBus.emit('ui:animation:skip-start');
  frames.runUntilIdle();
  expect(frames.pending.size, 'the camera came to rest at the start').toBe(0);
  expect(app.previewMode).toBe(true);
  expect(app.exportSettings.includeCamera).toBe(true);
  return app;
}

/** The same route, to the canvas's corner, (0.98, 0.98). */
function routeToTheCorner(endZoom) {
  return routeToTheEdge(THE_CORNER, endZoom);
}

/**
 * The camera as it rests at the route's end, `end`, drawn: at `zoom`, and on
 * the head, held where the view at that zoom stays on the canvas at each edge
 * in `held`, the edges the head lies past; flat at 1×.
 */
function restingAtTheEdge(app, zoom, end, held) {
  const width = app.displayWidth;
  const height = app.displayHeight;
  if (zoom === 1) return { zoom: 1, centerX: width / 2, centerY: height / 2, enabled: false };
  // The image fills the canvas, so the head is exactly where its waypoint is:
  // on 0 for a waypoint on the image's left or top edge.
  const head = app.imageToCanvas(end.x, end.y);
  expect(head, 'the head, where its waypoint is').toEqual({ x: end.x * width, y: end.y * height });
  const reach = {
    left: width / (2 * zoom),
    right: width - width / (2 * zoom),
    top: height / (2 * zoom),
    bottom: height - height / (2 * zoom),
  };
  const past = {
    left: head.x < reach.left,
    right: head.x > reach.right,
    top: head.y < reach.top,
    bottom: head.y > reach.bottom,
  };
  for (const edge of Object.keys(reach)) {
    expect(past[edge], `the head lies past where the view can follow it, at the ${edge}`).toBe(held.includes(edge));
  }
  return {
    zoom,
    centerX: past.left ? reach.left : past.right ? reach.right : head.x,
    centerY: past.top ? reach.top : past.bottom ? reach.bottom : head.y,
    enabled: true,
  };
}

/** The same, at the canvas's corner, where the head lies past the right and bottom edges. */
function restingAtTheCorner(app, zoom) {
  return restingAtTheEdge(app, zoom, THE_CORNER, ['right', 'bottom']);
}

/** A drawn camera equals the expected one, to floating-point rounding. */
function expectCamera(actual, expected, label) {
  expect(actual.enabled, `${label}: drawn`).toBe(expected.enabled);
  expect(actual.zoom, `${label}: zoom`).toBeCloseTo(expected.zoom, 9);
  expect(actual.centerX, `${label}: centre x`).toBeCloseTo(expected.centerX, 6);
  expect(actual.centerY, `${label}: centre y`).toBeCloseTo(expected.centerY, 6);
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

  test('zooming the view in while the camera eases in Preview goes idle, and undoing it draws the camera where it belongs', async () => {
    // The author's viewport zoom takes the camera's place on the canvas
    // (DEF-61), and the camera eased out of sight beneath it: some 48 frames,
    // each drawn the same.
    const app = await routeWithCamera();
    const drawn = watchCamera(app);
    playAMomentAndPause(app);
    expect(frames.pending.size, 'the camera is still easing').toBeGreaterThan(0);
    expect(app.selectedWaypoint, 'Zoom in centres on the selection').toBeTruthy();

    app.eventBus.emit('canvas:zoom-in');
    expect(app.viewport.zoom).toBeCloseTo(1.5);
    expectIdle('under Zoom in’s first step, 1.5×');
    app.eventBus.emit('canvas:zoom-in');
    expect(app.viewport.zoom).toBeCloseTo(2.25);
    expectIdle('under a 2.25× viewport zoom');

    // Scrubbed under the zoom, where the camera belongs moves out of sight.
    app.eventBus.emit('ui:animation:seek', app.animationEngine.getProgress() + 0.02);
    expectIdle('under the zoom, after a scrub');

    // Undoing the zoom draws one frame and wakes no loop, so that frame must
    // already show the camera where it belongs: when the loop next runs, it
    // finds nothing left to draw.
    app.eventBus.emit('canvas:zoom-reset');
    expect(app.viewport.zoom).toBe(1);
    const shown = drawn().at(-1);
    expect(shown.enabled).toBe(true);
    expect(shown.zoom).toBeCloseTo(3);
    const before = drawn().length;
    app.animationEngine.requestUpdate();
    expectIdle('the zoom undone');
    expect(drawn().slice(before), 'frames drawn after the zoom was undone').toEqual([]);
  });

  test.each([
    ['in from 3× to 16×', 'edge', 16, THE_CORNER, ['right', 'bottom']],
    ['out from 3× to 2.25×', 'edge', 2.25, THE_CORNER, ['right', 'bottom']],
    ['in from 3× to 16×', 'left edge', 16, { x: 0.02, y: 0.6 }, ['left']],
    ['in from 3× to 16×', 'right edge', 16, { x: 0.98, y: 0.6 }, ['right']],
    ['in from 3× to 16×', 'top edge', 16, { x: 0.6, y: 0.02 }, ['top']],
    ['in from 3× to 16×', 'bottom edge', 16, { x: 0.6, y: 0.98 }, ['bottom']],
    ['in from 3× to 16×', 'top-left corner, the head on 0', 16, { x: 0, y: 0 }, ['left', 'top']],
  ])('undoing the view’s zoom after the camera zoomed %s beneath it, at the canvas’s %s, draws the camera at rest there at once', async (change, where, endZoom, end, held) => {
    // The camera hidden by the view's zoom is put where it comes to rest. It
    // was put at its target zoom on the centre its one frame had found at the
    // zoom its rate limit had reached, about 3×: undone, the 16× view was
    // drawn some 79 px short of the edge, and stayed there, as undoing the
    // zoom draws one frame and wakes no loop. The same holds at each of the
    // four edges, and with the head exactly on 0: resting past an edge, the
    // camera would be drawn held at it but never settle; resting on the
    // canvas centre for a head on 0, it would be drawn away from the edge.
    const app = await routeToTheEdge(end, endZoom);
    const drawn = watchCamera(app);
    app.eventBus.emit('canvas:zoom-in');
    expect(app.viewport.zoom).toBeCloseTo(1.5);
    app.eventBus.emit('ui:animation:seek', 1);
    expectIdle('at the end, under the view’s zoom');

    app.eventBus.emit('canvas:zoom-reset');
    expect(app.viewport.zoom).toBe(1);
    expectCamera(drawn().at(-1), restingAtTheEdge(app, endZoom, end, held), 'the zoom undone');
    const before = drawn().length;
    app.animationEngine.requestUpdate();
    expectIdle('the zoom undone');
    expect(drawn().slice(before), 'frames drawn after the zoom was undone').toEqual([]);
  });

  test('undoing the view’s zoom after the camera went back to 1× beneath it leaves the flat view still', async () => {
    // Put at 1× on a centre found at some 2.9×, the camera, drawn again at
    // 1×, eased that centre back to the canvas centre unseen: the next scrub
    // ran 72 frames, each drawn the same.
    const app = await routeToTheCorner(1);
    const drawn = watchCamera(app);
    app.eventBus.emit('canvas:zoom-in');
    app.eventBus.emit('ui:animation:seek', 1);
    expectIdle('at the end, under the view’s zoom');

    app.eventBus.emit('canvas:zoom-reset');
    expect(drawn().at(-1)).toEqual(restingAtTheCorner(app, 1));
    app.eventBus.emit('ui:animation:seek', 1);
    expectIdle('a scrub to where the head is, the zoom undone');
  });

  test('after the view’s zoom is undone, a scrub draws the camera as it draws one that was never hidden', async () => {
    // A hidden frame still records where the head is, as a drawn one does, so
    // a small scrub after the zoom is undone eases the camera on rather than
    // jumping it. The same moves, Skip to start between: once drawn
    // throughout, once beneath the view's zoom, each from the camera at rest
    // at the start, and the scrub 20 ms after its last frame.
    const app = await routeToTheCorner(1);
    const drawn = watchCamera(app);
    const nearTheEnd = app.animationEngine.pathToTimelineProgress(0.97);
    const scrubBack = () => {
      const before = drawn().length;
      app.eventBus.emit('ui:animation:seek', nearTheEnd);
      const ran = frames.runUntilIdle();
      expect(frames.pending.size, `the camera eased on and stopped, after ${ran}`).toBe(0);
      return drawn().slice(before);
    };

    app.eventBus.emit('ui:animation:seek', 1);
    frames.runUntilIdle();
    expect(frames.pending.size, 'drawn throughout, the camera came to rest at the end').toBe(0);
    const neverHidden = scrubBack();
    app.eventBus.emit('ui:animation:skip-start');
    frames.runUntilIdle();
    expect(frames.pending.size, 'the camera came to rest at the start again').toBe(0);

    app.eventBus.emit('canvas:zoom-in');
    app.eventBus.emit('ui:animation:seek', 1);
    expectIdle('at the end, under the view’s zoom');
    app.eventBus.emit('canvas:zoom-reset');
    const onceHidden = scrubBack();

    expect(neverHidden.length).toBeGreaterThan(1);
    expect(neverHidden[0].zoom, 'a small scrub eases the camera: a jump draws the 1.03× its rate limit allows at once')
      .toBeLessThan(1.01);
    expect(onceHidden).toEqual(neverHidden);
  });

  test.each([
    ['in from 3× to 16×', 16],
    ['back from 3× to 1×', 1],
  ])('leaving Preview while the camera zooms %s at the canvas’s edge, Preview draws it at rest there on return', async (change, endZoom) => {
    // Edit mode puts the camera on the same target, and it was the same pair:
    // the 16× view came back some 74 px short of the edge and stayed there,
    // and the flat view's centre was left to ease unseen.
    const app = await routeToTheCorner(endZoom);
    const drawn = watchCamera(app);
    app.eventBus.emit('ui:animation:seek', 1);
    for (let frame = 0; frame < 3; frame += 1) {
      expect(frames.pending.size, `zooming frame ${frame + 1} is queued`).toBeGreaterThan(0);
      frames.runNext();
    }
    expect(frames.pending.size, 'the camera is still zooming').toBeGreaterThan(0);

    app.elements.modeToggleBtn.click();
    expect(app.previewMode).toBe(false);
    expectIdle('Edit mode, left while the camera zoomed');

    const before = drawn().length;
    app.elements.modeToggleBtn.click();
    expect(app.previewMode).toBe(true);
    expectIdle('Preview again');
    const resumed = drawn().slice(before);
    expect(resumed.length).toBeGreaterThan(0);
    expectCamera(resumed[0], restingAtTheCorner(app, endZoom), 'Preview again');
    for (const later of resumed) expect(later).toEqual(resumed[0]);
    app.eventBus.emit('ui:animation:seek', 1);
    expectIdle('a scrub to where the head is, in Preview again');
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

  test('Skip to start in Edit mode with every waypoint removed, after the camera zoomed in Preview, goes idle', async () => {
    // Edit mode returns before the camera's own no-waypoint branch, so the
    // Edit frame alone must settle the 1× rate limit a reset leaves below
    // the 3× target it remembers.
    const app = await routeWithCamera();
    app.elements.modeToggleBtn.click();
    expectIdle('Edit mode');
    for (const waypoint of [...app.waypoints]) app.eventBus.emit('waypoint:delete', waypoint);
    expect(app.waypoints).toEqual([]);
    expectIdle('Edit mode, every waypoint removed');

    app.eventBus.emit('ui:animation:skip-start');
    expectIdle('Edit mode, every waypoint removed, after Skip to start');
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

  test('settling a fractional zoom, as the This Zoom slider sets most, puts it exactly on its target', () => {
    // The slider's zooms are 2 to a power in steps of 0.04: all but 1×, 2×,
    // 4×, 8× and 16× are fractional.
    const zoom = CameraService.sliderToZoom(0.3);
    expect(zoom % 1).not.toBe(0);
    const camera = cameraMidMove();
    camera._targetZoom = zoom;

    camera.settle();

    expect(camera.isZoomTransitioning(1200, 800)).toBe(false);
    expect([camera._rateLimitedZoom, camera._smoothedZoom]).toEqual([zoom, zoom]);
  });

  test.each([
    ['in to 16×', 3, FRAME_MS, 16, { zoom: 16, centerX: 7440, centerY: 4185, enabled: true }],
    ['out to 1×', 3, FRAME_MS, 1, { zoom: 1, centerX: 3840, centerY: 2160, enabled: false }],
    ['out to within 1×’s tolerance', 3, FRAME_MS, 1.0005, { zoom: 1, centerX: 3840, centerY: 2160, enabled: false }],
    ['in to 16× from the flat view before its rate limit moves', 1, 0, 16, { zoom: 16, centerX: 7440, centerY: 4185, enabled: true }],
  ])('a frame zooming %s aims the camera where it comes to rest, so settled there it is drawn still', (change, from, elapsed, endZoom, rest) => {
    // The target centre is the one at the target zoom (flat on the canvas
    // centre within 1×'s tolerance, as a drawn camera rests), not the one at
    // the zoom the rate limit has reached this frame, which settling paired
    // with the target zoom. On an 8K canvas, the head in its corner, past
    // where a zoomed view can follow it; the camera already at the route's
    // end, its rate limit at `from`, `elapsed` ms after its last step.
    const camera = new CameraService();
    const frameAt = () => camera.calculateCameraState({
      progress: 1,
      waypoints: [{ camera: { zoom: from } }, { camera: { zoom: endZoom } }],
      waypointProgressValues: [0, 1],
      headPosition: { x: 7670, y: 4310 },
      canvasWidth: 7680,
      canvasHeight: 4320,
      animationDuration: 10000,
    });
    camera._lastProgress = 1;
    camera._rateLimitedZoom = from;
    camera._lastZoomUpdateTime = frames.now();
    frames.wait(elapsed);
    frameAt();
    expect(camera._rateLimitedZoom, 'the rate limit has not reached the target').not.toBeCloseTo(endZoom, 2);

    camera.settle();

    expect(camera.isZoomTransitioning(7680, 4320)).toBe(false);
    frames.wait(FRAME_MS);
    const next = frameAt();
    expect(next.enabled).toBe(rest.enabled);
    expect(next.zoom).toBeCloseTo(rest.zoom, 9);
    expect(next.centerX).toBeCloseTo(rest.centerX, 6);
    expect(next.centerY).toBeCloseTo(rest.centerY, 6);
    expect(camera.isZoomTransitioning(7680, 4320)).toBe(false);
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

describe('DEF-44: a camera that is drawn still eases', () => {

  test('the zoom eases toward a new target a frame at a time, even when its rate limit allows the whole step', () => {
    // After a pause of a second or more the rate limit lets the zoom jump to
    // its target; the zoom's own easing must still take it there gradually.
    const camera = new CameraService();
    const frameAt = (zoom) => camera.calculateCameraState({
      progress: 0.5,
      waypoints: [{ camera: { zoom } }, { camera: { zoom } }],
      waypointProgressValues: [0, 1],
      headPosition: { x: 600, y: 400 },
      canvasWidth: 1200,
      canvasHeight: 800,
      animationDuration: 10000,
    });
    frames.wait(1500);
    expect(frameAt(2).zoom).toBe(2);

    frames.wait(1500);
    const zooms = [];
    for (let frame = 0; frame < 5; frame += 1) {
      zooms.push(frameAt(4).zoom);
      frames.wait(FRAME_MS);
    }
    expect(zooms[0], 'one frame closes only part of the step').toBeLessThan(2.5);
    for (let frame = 1; frame < zooms.length; frame += 1) {
      expect(zooms[frame], `frame ${frame + 1} zooms on`).toBeGreaterThan(zooms[frame - 1]);
    }
    expect(zooms.at(-1)).toBeLessThan(4);
  });

  test('the exported player keeps easing its camera after a pause, then goes idle', async () => {
    // The player gates its loop as the editor does (`PlayerApp.start`): a
    // paused view stays awake only while its camera visibly eases.
    const app = await routeWithCamera();
    const project = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
    const player = new PlayerApp(document.createElement('canvas'));
    try {
      await player.load(project, app.background.image);
      const drawn = watchCamera(player);
      player.start();
      frames.runUntilIdle();
      expect(frames.pending.size, 'the player came to rest at the start').toBe(0);

      player.animationEngine.play();
      for (let frame = 0; frame < 15; frame += 1) frames.runNext();
      player.animationEngine.pause();

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
      const ran = frames.runUntilIdle();
      expect(frames.pending.size, `the paused player: a frame is still queued after ${ran}`).toBe(0);
    } finally {
      player.animationEngine.stop();
    }
  });

});

describe('DEF-44: a residual, as on `main`, that ends by itself', () => {

  /** No camera: here both layers start every frame at the identity. */
  const NO_CAMERA = [1, 0, 0, 1, 0, 0];

  /** What a frame's camera draws with: its centre at the canvas's middle, zoomed. */
  function cameraTransform({ zoom, centerX, centerY }, width, height) {
    return [zoom, 0, 0, zoom, width / 2 - zoom * centerX, height / 2 - zoom * centerY];
  }

  /**
   * The transforms one frame drew its two layers with, as the canvases
   * recorded them (`setup.js`): the background image's, on the visible
   * canvas, and the route's first point's, on the vector layer.
   */
  function layersDrawnWith(player, calls) {
    const visible = contextIdFor(player.canvas);
    const vector = contextIdFor(player.renderingService.vectorCanvas);
    const image = calls.find(([id, name, source]) =>
      id === visible && name === 'drawImage' && String(source).startsWith('[image '));
    const route = calls.find(([id, name]) => id === vector && name === 'moveTo');
    return { image: image?.transform, route: route?.transform };
  }

  /** A recorded transform equals the expected one, to floating-point rounding. */
  function expectTransform(actual, expected, label) {
    expect(actual, `${label}: drawn`).toBeDefined();
    expected.forEach((value, index) => {
      expect(actual[index], `${label}: ${'abcdef'[index]}`).toBeCloseTo(value, 6);
    });
  }

  test('an 8K player easing its camera back to 1× from the This Zoom slider’s first step ends with frames that draw the same flat view, then goes idle', async () => {
    // Not repaired here, and on `main` too (the PR's third review): the
    // renderer draws a camera within 0.001 of 1× flat, while the camera eases
    // its centre on to within a pixel of the canvas centre and keeps the loop
    // awake. At 8K the zoom gets there first. Found: eight such frames; held
    // to ten. Which frames are flat is this test's own figure (`FLAT_WITHIN`),
    // held against the transforms both layers drew with, not the renderer's
    // word. A repair that settles the centre once it is drawn flat would end
    // them, and this test and the plan row's residual with them.
    const app = await bootApp();
    await app.ready;
    app.eventBus.emit('waypoint:add', { imgX: 0.96, imgY: 0.96, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.98, imgY: 0.98, isMajor: true });
    app.waypoints[0].camera.zoom = CameraService.sliderToZoom(0.01);
    app.waypoints[1].camera.zoom = 1;
    app.eventBus.emit('ui:animation:skip-start');
    frames.runUntilIdle();
    const project = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
    Object.assign(project.exportSettings, { resolutionX: 7680, resolutionY: 4320, includeCamera: true });
    const player = new PlayerApp(document.createElement('canvas'));
    try {
      await player.load(project, app.background.image);
      const drawn = watchCamera(player);
      player.start();
      frames.runUntilIdle();
      expect(frames.pending.size, 'the player came to rest at the start').toBe(0);
      const flatAt = ({ zoom }) => Math.abs(zoom - 1) <= FLAT_WITHIN;
      expect(flatAt(drawn().at(-1)), 'the camera zoomed at the start').toBe(false);

      // Paused, a seek to the end, where the camera is 1×: each frame's
      // camera, and the transforms its layers drew with
      const before = drawn().length;
      const layers = [];
      recordCallOrder(true);
      try {
        player.animationEngine.seekToProgress(1);
        while (frames.pending.size > 0 && layers.length < NEVER_IDLE) {
          frames.runNext();
          layers.push(layersDrawnWith(player, takeOrderedCalls()));
        }
      } finally {
        recordCallOrder(false);
      }
      expect(frames.pending.size, `the paused player: a frame is still queued after ${layers.length}`).toBe(0);
      const eased = drawn().slice(before);
      expect(eased.length, 'each frame drew once').toBe(layers.length);

      // The background and the route each draw the camera this test expects:
      // the frame's own, or none within FLAT_WITHIN of 1×
      eased.forEach((camera, index) => {
        const expected = flatAt(camera)
          ? NO_CAMERA
          : cameraTransform(camera, player.displayWidth, player.displayHeight);
        const label = `frame ${index + 1}, the camera at ${camera.zoom}×`;
        expectTransform(layers[index].image, expected, `${label}: the background image`);
        expectTransform(layers[index].route, expected, `${label}: the route`);
      });

      const flat = eased.slice(eased.findLastIndex(camera => !flatAt(camera)) + 1);
      expect(flat.length, 'the camera eased back to 1× in view').toBeLessThan(eased.length);
      // The first frame drawn flat shows the camera's last step to 1×; each
      // after it draws that same view again.
      const again = flat.length - 1;
      expect(again, 'frames that draw the same flat view, the residual as found').toBeGreaterThan(0);
      expect(again, 'they end by themselves, within ten').toBeLessThanOrEqual(10);
    } finally {
      player.animationEngine.stop();
    }
  });

});
