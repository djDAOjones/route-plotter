/**
 * DEF-99 and DEF-100 — a video export frames the picture at its own size,
 * whatever the editor shows.
 *
 * DEF-99: the editor's zoom (the scroll wheel on a selected waypoint, up to
 * 48×) went into the video export. Its pan is in display pixels, so on the
 * export's larger canvas it framed a patch of the map away from the one
 * zoomed on, enlarged as much, and it stood in for the camera, so Camera
 * movement was lost. The HTML export's player never zooms (`PlayerApp`'s
 * viewport stays at 1×); a video export now frames as it does, and the
 * editor keeps its zoom.
 *
 * DEF-100: a path-only video export (Background image unticked) hid the
 * background before the canvas took the export size, and the image's place
 * on the canvas is worked out again only when there is an image, so the
 * route, its markers and every crowd were drawn where they sat on the display
 * canvas: smaller, in the frame's top-left. The image's place is now worked
 * out at the export size before the background is hidden.
 *
 * Both are read from the calls the test recorder keeps, against an export of
 * the same project that never had the fault: the path-only export's path
 * layer against the same export with its background, and an export made with
 * the editor zoomed against one made at 1×. The image's place is also checked
 * against the fit worked out here, and with Camera movement on, that the
 * camera, not the editor's zoom, frames the map.
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import { authoredExtrasProject } from './fixtures/authoredExtras.js';
import { loadBackgroundFile } from '../src/app/backgroundLoading.js';
import { VideoExporter } from '../src/services/VideoExporter.js';
import { contextIdFor, recordCallOrder, takeOrderedCalls } from './setup.js';

// The camera limits its zoom by wall-clock time (`performance.now()`, TST-09's
// camera domain), so its state at an instant depends on how it was reached,
// and two apps' exports with Camera movement on need not match. On a clock
// that moves 2 s at each read, past the limit's 1 s, the camera reaches its
// target at every frame, as after a pause, so they do.
beforeEach(() => {
  let now = 0;
  performance.now.mockImplementation(() => (now += 2000));
});

afterEach(() => {
  performance.now.mockImplementation(() => Date.now());
  recordCallOrder(false);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** 4:3 on the 16:9 export, so an image placed for another canvas is off in both axes. */
const IMAGE = { width: 1200, height: 900 };

/**
 * Where the image sits on a canvas of `width` × `height`, worked out here,
 * not by the app's layout code: fitted inside it, scaled by the background
 * zoom, centred.
 */
function fitted(width, height, zoom) {
  const scale = Math.min(width / IMAGE.width, height / IMAGE.height) * zoom;
  const w = IMAGE.width * scale;
  const h = IMAGE.height * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, w, h, scale };
}

/**
 * A booted app with the authored-extras project (a branched route with
 * markers, labels, beacons and a crowd) on a 1200×900 background, set to
 * export with its background or the path only, with Camera movement on or
 * off, and with its text labels (the fixture exports none).
 */
async function withBackground({ pathOnly, includeCamera }) {
  const app = await bootApp();
  await app.ready;
  document.getElementById('splash-close').click();
  expect(await loadCurrentSnapshot(app, authoredExtrasProject())).toBe(true);
  const image = Object.assign(new Image(), { naturalWidth: IMAGE.width, naturalHeight: IMAGE.height, ...IMAGE, src: 'framing-under-test.png' });
  vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: 'data:image/png;base64,AA==', getImageElement: async () => image });
  expect(await loadBackgroundFile(app, new File(['x'], 'framing.png', { type: 'image/png' }))).toBe(true);
  app.exportSettings.pathOnly = pathOnly;
  app.exportSettings.includeCamera = includeCamera;
  app.exportSettings.includeText = true;
  vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
  vi.stubGlobal('alert', vi.fn());
  return app;
}

/**
 * A frame's calls on every canvas, in order, with their arguments, transform
 * and drawing state, the canvases named by what they are, so that two apps'
 * frames can be compared.
 */
function transcriptOf(calls, names) {
  const nameOf = id => names[id] ?? 'other';
  return calls.map(entry => JSON.stringify([
    nameOf(entry[0]),
    ...entry.slice(1).map(arg => (typeof arg === 'string' ? arg.replace(/^\[canvas #(\d+)\]$/, (_, id) => `[canvas ${nameOf(Number(id))}]`) : arg)),
    [...entry.transform],
    entry.state,
  ]));
}

/**
 * Run a video export to its end through the app's own `exportVideo`, the
 * encoder replaced by one that draws three frames: for each, the image's
 * place on the canvas, what the renderer was given to frame it by (a viewport
 * zoom, and whether the camera was on), every call made on any canvas, and
 * those made on the path's own layer (the renderer's vector canvas: route,
 * markers, labels).
 */
async function exportFrames(app) {
  const frames = [];
  let given = null;
  const render = app.renderingService.render.bind(app.renderingService);
  vi.spyOn(app.renderingService, 'render').mockImplementation((ctx, width, height, state) => {
    given = { viewport: state.viewport, camera: state.cameraState?.enabled ?? false };
    return render(ctx, width, height, state);
  });
  app.videoExporter = {
    cancel() {},
    async export({ renderFrame }) {
      for (const progress of [0.1, 0.5, 1]) {
        recordCallOrder(true);
        takeOrderedCalls();
        given = null;
        await renderFrame(progress);
        const calls = takeOrderedCalls();
        recordCallOrder(false);
        const vector = contextIdFor(app.renderingService.vectorCanvas);
        const names = { [contextIdFor(app.canvas)]: 'main', [vector]: 'vector' };
        const mask = app.motionVisibilityService?.revealMaskCanvas;
        if (mask) names[contextIdFor(mask)] = 'mask';
        frames.push({
          size: [app.canvas.width, app.canvas.height],
          image: { ...app.coordinateTransform.imageBounds },
          given: { ...given },
          all: transcriptOf(calls, names),
          path: transcriptOf(calls.filter(([surface]) => surface === vector), names),
        });
      }
      return new Blob(['video'], { type: 'video/mp4' });
    },
  };
  await app.exportVideo();
  expect(frames).toHaveLength(3);
  return frames;
}

/** Select a waypoint, as an author does before zooming on it. */
function selectWaypoint(app) {
  const waypoint = app.waypoints[2];
  app.selectedWaypoint = waypoint;
  app.eventBus.emit('waypoint:selected', waypoint);
}

/** Zoom the editor as an author does: scroll up over the canvas, on the selected waypoint. */
function zoomEditor(app, steps) {
  for (let step = 0; step < steps; step += 1) {
    app.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
  }
}

/** The scale the map was drawn at in a frame (its one draw on the export's canvas), or none, path only. */
function mapScaleOf(frame) {
  const draws = frame.all.map(line => JSON.parse(line))
    .filter(([surface, name, source]) => surface === 'main' && name === 'drawImage' && String(source).includes('framing-under-test.png'));
  return draws.length === 1 ? draws[0].at(-2)[0] : draws.length;
}

test.each([['off', false], ['on', true]])('a path-only export with Camera movement %s draws its route, markers and labels where the export with its background does, on the image fitted to the export size (DEF-100)', async (_, includeCamera) => {
  const withImage = await exportFrames(await withBackground({ pathOnly: false, includeCamera }));
  const app = await withBackground({ pathOnly: true, includeCamera });
  const pathOnly = await exportFrames(app);

  const { resolutionX, resolutionY, backgroundZoom } = app.exportSettings;
  const place = fitted(resolutionX, resolutionY, backgroundZoom / 100);
  for (const frame of [...withImage, ...pathOnly]) {
    expect(frame.size).toEqual([resolutionX, resolutionY]);
    expect(frame.image).toEqual(place);
  }
  // Not vacuous: the path layer draws a route and labels.
  expect(pathOnly[0].path.some(line => line.startsWith('["vector","lineTo"'))).toBe(true);
  expect(pathOnly[0].path.some(line => line.startsWith('["vector","fillText"'))).toBe(true);
  expect(pathOnly.map(frame => frame.path)).toEqual(withImage.map(frame => frame.path));
});

/**
 * An export of the same project, the same waypoint selected (so that only the
 * zoom differs), made with the editor at 1× and with it zoomed in five wheel
 * steps; and the zoomed editor's viewport before and after its export.
 */
async function exportsAtOneAndZoomed(includeCamera) {
  const unzoomed = await withBackground({ pathOnly: false, includeCamera });
  selectWaypoint(unzoomed);
  const atOne = await exportFrames(unzoomed);
  const app = await withBackground({ pathOnly: false, includeCamera });
  selectWaypoint(app);
  zoomEditor(app, 5);
  const before = { ...app.viewport };
  expect(before.zoom).toBeGreaterThan(7);
  const zoomed = await exportFrames(app);
  return { atOne, zoomed, before, after: { ...app.viewport } };
}

test.each([['off', false], ['on', true]])('an export with Camera movement %s draws the same frames with the editor zoomed as at 1×, and the editor keeps its zoom (DEF-99)', async (_, includeCamera) => {
  const { atOne, zoomed, before, after } = await exportsAtOneAndZoomed(includeCamera);

  expect(zoomed.map(frame => frame.given)).toEqual(Array(3).fill({ viewport: null, camera: includeCamera }));
  expect(zoomed.map(frame => frame.all)).toEqual(atOne.map(frame => frame.all));
  // The map is drawn at 1×, or zoomed by the camera: never by the editor's zoom.
  for (const scale of zoomed.map(mapScaleOf)) {
    if (includeCamera) {
      expect(scale).toBeGreaterThan(1);
      expect(scale).toBeLessThan(before.zoom);
    } else {
      expect(scale).toBe(1);
    }
  }
  expect(after).toEqual(before);
});
