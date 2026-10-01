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
 *
 * The frames are read from the calls the test recorder keeps, not from
 * pixels. A size choice that changes any call or its state fails the
 * comparison with the same export drawn with no size chosen; a fault both
 * share meets only the absolute checks (`frameOf`): the background and the
 * path layer drawn, placed and shown (alpha, compositing, filter), every draw
 * on that layer and on the reveal mask shown, and nothing emptying or
 * erasing any of them once drawn, but the reveal mask cutting the background
 * to what it reveals. They do not see how much the mask's gradients reveal,
 * a draw that paints over the background, or a stroke's own colour, width
 * and shape.
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
/** How the harness's transcript names that image: by its source, resolved as the page resolves it. */
const backgroundToken = () => `[image ${Object.assign(new Image(), { src: BACKGROUND }).src}]`;
/** A context with nothing moved, scaled or turned. */
const IDENTITY = [1, 0, 0, 1, 0, 0];
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
 * The camera is off (its authored zoom would move each frame's view): a
 * frame then draws with nothing moved, so where it draws can be checked.
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
  app.exportSettings.includeCamera = false;
  vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
  vi.stubGlobal('alert', vi.fn());
  return { app, image };
}

/**
 * The calls that empty a whole canvas: a size given to it, through its
 * `width` and `height` properties or by any route to the attributes they
 * reflect (the test recorder records both the same way), even the size it
 * has, and `reset()`.
 */
const EMPTIES = new Set(['canvas.width', 'canvas.height', 'reset']);

/** The calls that draw or erase on a canvas. */
const MARKS = new Set(['clearRect', 'fillRect', 'strokeRect', 'fill', 'stroke', 'fillText', 'strokeText', 'drawImage', 'putImageData', ...EMPTIES]);

/** Those that draw, as against emptying a canvas. */
const DRAWS = new Set(['fillRect', 'strokeRect', 'fill', 'stroke', 'fillText', 'strokeText', 'drawImage', 'putImageData']);

/**
 * The compositing under which a draw paints over what is there and takes
 * none of it away: `source-over`, `lighter` (the path's glow) and the blend
 * modes. Any other draws only beneath or within what is there
 * (`destination-over`, `source-atop`), or takes away what is beneath, where
 * it falls or everywhere else (`destination-in`, as the reveal mask is put
 * on, `destination-out`, `copy`, ...).
 */
const PAINTS = new Set(['source-over', 'lighter', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge',
  'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']);

/**
 * How the draws on one of the renderer's layers (the path's, the reveal
 * mask), made before it is put on the main canvas at `end` (in the whole
 * frame if it is not), fail to show as drawn, each kind once: at alpha 0,
 * through a filter (the app sets none, and one such as `opacity(0)` hides a
 * draw as alpha 0 does), with a compositing that does not paint (an erasing
 * one among them), or as pixels written by `putImageData`, which heeds
 * neither alpha nor compositing.
 */
function unseenOn(calls, surface, end) {
  return [...new Set((end < 0 ? calls : calls.slice(0, end))
    .filter(([on, name]) => on === surface && DRAWS.has(name))
    .map(entry => [entry[1], entry.state.globalAlpha ?? 1, entry.state.globalCompositeOperation ?? 'source-over', entry.state.filter ?? 'none'])
    .filter(([name, alpha, compositing, filter]) => name === 'putImageData' || !(alpha > 0) || !PAINTS.has(compositing) || filter !== 'none')
    .map(draw => JSON.stringify(draw)))];
}

/**
 * Whether one of the renderer's layers is emptied (cleared, given a size by
 * any route, or reset) once anything is drawn on it in the frame, before it
 * is put on the main canvas at `end` (in the whole frame if it is not).
 */
function emptiedOnceDrawnOn(calls, surface, end) {
  const on = (end < 0 ? calls : calls.slice(0, end)).filter(([at]) => at === surface);
  const first = on.findIndex(([, name]) => DRAWS.has(name));
  return first >= 0 && on.slice(first + 1).some(([, name]) => name === 'clearRect' || EMPTIES.has(name));
}

/**
 * A frame's calls on every canvas, in order, each with its arguments, the
 * transform it was made under and the drawing state it was made in (alpha,
 * compositing, filter and the rest, as the test recorder keeps them: not the
 * bitmap, nor a clip region), the canvases named by what they are, so that two
 * apps' frames can be compared. A size given to a canvas, by any route, and a
 * `reset()` are among the calls.
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
 * An export's frames as the same app draws them with no size chosen during
 * it: each call on every canvas, as `transcriptOf` has it (worked out once
 * for each kind of export).
 */
const unchosen = new Map();
async function framesWithNoSizeChosen(pathOnly) {
  if (!unchosen.has(pathOnly)) {
    const { app } = await withBackground(pathOnly);
    const run = await exporting(app);
    await run.completes();
    unchosen.set(pathOnly, run.transcripts);
  }
  return unchosen.get(pathOnly);
}

/**
 * An export whose encoder holds after its first frame until it is let
 * finish, made to fail, or cancelled. Each frame records the canvas it was
 * drawn on; every draw of the background it made, on any canvas (which,
 * where, the transform it was drawn under, and the alpha, compositing and
 * filter it was drawn with, the state that decides whether a draw shows at
 * all); every draw of the path's own layer (the renderer's vector canvas) on
 * the main canvas, the same; whether the path was drawn on that layer before
 * it was put there; how any draw on that layer, or on the reveal mask, before
 * it is put on the main canvas, fails to show as drawn (alpha 0, a filter, a
 * compositing that does not paint, pixels written as they are), and whether
 * either is emptied once drawn on; whether the main canvas was cleared after
 * the frame's first draw that must survive, so that what the encoder captures
 * next would have lost it, and every draw after that one that takes away or
 * replaces what is beneath it; and whether the main canvas was emptied during
 * the frame (given a size, by any route, or reset).
 */
async function exporting(app) {
  const frames = [];
  const transcripts = [];
  const between = [];
  const clipped = [];
  const main = contextIdFor(app.canvas);
  /** The canvases an export draws on, by what they are: the export's own, the path's layer and the reveal mask. */
  const roles = () => {
    const names = { [main]: 'main', [contextIdFor(app.renderingService.vectorCanvas)]: 'vector' };
    const mask = app.motionVisibilityService?.revealMaskCanvas;
    if (mask) names[contextIdFor(mask)] = 'mask';
    return names;
  };
  const clipsIn = (calls, names) => calls.filter(([, name]) => name === 'clip').map(([surface]) => `${names[surface] ?? 'other'} clip`);
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
      const token = backgroundToken();
      const frame = async (progress) => {
        // What any canvas was given since the last frame, outside any frame
        // (before the first, the export's setting up)
        const outside = takeOrderedCalls();
        between.push(outside.map(([surface, name]) => `${roles()[surface] ?? 'other'} ${name}`));
        clipped.push(...clipsIn(outside, roles()));
        await renderFrame(progress);
        const calls = takeOrderedCalls();
        const names = roles();
        clipped.push(...clipsIn(calls, names));
        const vector = contextIdFor(app.renderingService.vectorCanvas);
        const layer = `[canvas #${vector}]`;
        const maskCanvas = app.motionVisibilityService?.revealMaskCanvas;
        const mask = maskCanvas ? contextIdFor(maskCanvas) : null;
        const named = arg => (typeof arg === 'string' ? arg.replace(/^\[canvas #(\d+)\]$/, (_, id) => `[canvas ${names[id] ?? 'other'}]`) : arg);
        /**
         * A draw: its surface, its rectangle (every number it was given, so
         * that a source rectangle drawn into nothing does not pass for the
         * place), the transform, and the alpha, compositing and filter it was
         * drawn with (a filter such as `opacity(0)` hides it as alpha 0 does;
         * a shadow is drawn beneath it and smoothing only softens it, so
         * neither can).
         */
        const drawOf = entry => [entry[0] === main ? 'main' : `canvas #${entry[0]}`, ...entry.slice(3), [...entry.transform],
          entry.state.globalAlpha ?? 1, entry.state.globalCompositeOperation ?? 'source-over', entry.state.filter ?? 'none'];
        const background = calls.filter(([, name, source]) => name === 'drawImage' && source === token).map(drawOf);
        const composite = ([surface, name, source]) => surface === main && name === 'drawImage' && source === layer;
        const put = calls.findIndex(composite);
        const maskPut = calls.findIndex(([surface, name, source]) => surface === main && name === 'drawImage' && source === `[canvas #${mask}]`);
        const onMain = calls.filter(([surface]) => surface === main);
        const kept = onMain.findIndex(([, name, source]) => name === 'drawImage' && (source === token || source === layer));
        const lastStroke = calls.findLastIndex(([surface, name], at) => at < put && surface === vector && name === 'stroke');
        frames.push({
          exportMode: app._isExportMode,
          width: app.canvas.width,
          height: app.canvas.height,
          background,
          path: calls.filter(composite).map(drawOf),
          pathDrawn: put > 0 && lastStroke >= 0,
          clearedAfter: kept < 0 || onMain.slice(kept + 1).some(([, name]) => name === 'clearRect'),
          emptied: onMain.some(([, name]) => EMPTIES.has(name)),
          // Anything that draws or erases on the main canvas once the path is on it
          afterPath: put < 0 ? [] : calls.slice(put + 1).filter(([surface, name]) => surface === main && MARKS.has(name)).map(([, name]) => name),
          // The path layer emptied once anything is drawn on it (so also
          // between its last stroke and being put on the main canvas)
          layerErased: emptiedOnceDrawnOn(calls, vector, put),
          // Its draws, its strokes among them, that do not show as drawn
          layerUnseen: unseenOn(calls, vector, put),
          // The same of the reveal mask, which decides where the background shows
          maskErased: emptiedOnceDrawnOn(calls, mask, maskPut),
          maskUnseen: unseenOn(calls, mask, maskPut),
          // Each draw on the main canvas, once the first that must survive is
          // on it, that takes away or replaces what is beneath it, by its
          // compositing or as pixels written as they are, with its arguments,
          // transform, alpha, compositing and filter
          erasedAfter: kept < 0 ? [] : onMain.slice(kept + 1)
            .filter(entry => DRAWS.has(entry[1]) && (entry[1] === 'putImageData' || !PAINTS.has(entry.state.globalCompositeOperation ?? 'source-over')))
            .map(entry => [entry[1], ...entry.slice(2).map(named), [...entry.transform],
              entry.state.globalAlpha ?? 1, entry.state.globalCompositeOperation ?? 'source-over', entry.state.filter ?? 'none']),
        });
        transcripts.push(transcriptOf(calls, names));
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
    transcripts,
    between,
    clipped,
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

/**
 * What a frame of `width` × `height` should show: the background drawn once,
 * on the main canvas, fitted at the zoom, nothing moved, at full alpha,
 * composited over and unfiltered (none, path only); the renderer's own path
 * layer, drawn on in the frame, put on the main canvas over the whole of it
 * the same way; every draw on that layer and on the reveal mask, strokes and
 * fills alike, made at an alpha above 0, unfiltered and painting over what is
 * there, and neither emptied once drawn on before it is put on the main
 * canvas; and the main canvas neither cleared after the first draw that must
 * survive nor emptied (given a size or reset) during the frame, nothing after
 * that draw taking away or replacing what is beneath it but the reveal mask,
 * put over the whole frame under `destination-in` (none, path only), and
 * nothing drawn once the path layer is on it.
 *
 * These are calls, not pixels. A fault that both this export and the one
 * with no size chosen share passes the comparison between them, and meets
 * only these checks, which do not judge what needs pixels or a path's
 * geometry: how much of the background the mask's gradients let show,
 * whether a draw that paints over the background before the path layer hides
 * it, and whether a stroke or fill on that layer shows in its own colour,
 * width and shape (a transparent colour or gradient, an empty or off-canvas
 * path would not).
 */
const frameOf = (width, height, pathOnly) => {
  const { x, y, w, h } = fitted(width, height);
  return {
    exportMode: true, width, height,
    background: pathOnly ? [] : [['main', x, y, w, h, IDENTITY, 1, 'source-over', 'none']],
    path: [['main', 0, 0, width, height, IDENTITY, 1, 'source-over', 'none']],
    pathDrawn: true,
    clearedAfter: false,
    emptied: false,
    afterPath: [],
    layerErased: false,
    layerUnseen: [],
    maskErased: false,
    maskUnseen: [],
    erasedAfter: pathOnly ? [] : [['drawImage', '[canvas mask]', 0, 0, width, height, IDENTITY, 1, 'destination-in', 'none']],
  };
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
  ['its height changed', (app) => {
    app.elements.exportResY.value = '1920';
    app.elements.exportResY.dispatchEvent(new Event('change', { bubbles: true }));
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
  // No canvas is given anything between its frames, no call, and no size
  // or reset by any route (the recorder records a size given through a
  // canvas's attributes as through its properties): a size chosen meanwhile
  // leaves each as the last frame left it. Within the frames, the comparison
  // below holds that it gives none a size or reset either
  expect(run.between.slice(1)).toEqual([[], []]);
  // Nothing in this app clips, and the recorder keeps no clip region: a clip
  // on any canvas, from the export's setting up to its last frame, could
  // hide what every call above still makes
  expect(run.clipped).toEqual([]);
  // Call for call, as the same export draws its frames with no size chosen
  const unchanged = await framesWithNoSizeChosen(pathOnly);
  expect(unchanged).toHaveLength(3);
  expect(run.transcripts.length).toBe(unchanged.length);
  run.transcripts.forEach((frame, index) => expect(frame, `frame ${index + 1}`).toEqual(unchanged[index]));
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
