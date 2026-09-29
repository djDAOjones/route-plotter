/**
 * TST-02 — golden draw logs.
 *
 * Almost nothing asserted what the renderer actually draws. `goldenFrames`
 * pins the *state* an instant resolves to, `backgroundModeOverlay` pins one
 * absence (DEF-01's debug panel) and `renderReference` checks a handful of
 * arguments, but the 2,000-line `RenderingService` between that state and the
 * canvas was otherwise unmeasured — and W5–W7 are about to move it.
 *
 * So each fixture is drawn at five instants in each of the three modes a user
 * can see it in — the editor, preview, and the export canvas — and the whole
 * transcript of calls and style changes is kept as a file. A
 * behaviour-preserving refactor leaves these byte-identical; anything else
 * arrives as a diff someone has to justify.
 *
 * The three bundled examples are realistic and therefore narrow: between them
 * they use one background mode, two beacon styles, no camera zoom and no area
 * highlights. `authoredExtras` — TST-06's every-field-non-default fixture —
 * joins them to cover the spotlight reveal, all four beacon styles, authored
 * camera zooms and area highlights. It also asks for a path-only export, but
 * `enterMode` does not take the export step that hides the background, so no
 * golden here draws one.
 *
 * Two invariants come with them. `play == seek`: reaching an instant by
 * stepping the engine must draw exactly what seeking to it draws, both on the
 * host that played and on one that never did. And `app == player`: the
 * exported HTML player must draw what the export canvas draws — for every
 * fixture, which it did not at an authored Graphics scale until DEF-34 was
 * fixed, and after an anchored crowd node's waypoint has moved, which it did
 * not until DEF-02 was fixed.
 *
 * What these do not cover: the player's *display* transform (`PlayerApp.resize`
 * returns early on a canvas with no parent, so the comparison is in export
 * space only), and the mode matrix proper, which is TST-03's.
 *
 * Regenerate deliberately: `UPDATE_DRAW_GOLDENS=1 npx vitest run
 * tests/goldenDrawLogs.test.js`, then read the diff.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { freezeClock, loadSnapshot } from './helpers/projectSnapshot.js';
import { differingLines, discardFrame, frameAt, setUpFrame, takeFrame } from './helpers/drawLog.js';
import { authoredExtrasProject } from './fixtures/authoredExtras.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { loadExampleBackground } from '../src/app/backgroundLoading.js';
import { BACKGROUND_VISIBILITY } from '../src/config/constants.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { BeaconRenderer } from '../src/services/BeaconRenderer.js';
import { VideoExporter } from '../src/services/VideoExporter.js';

const goldenDir = join(dirname(fileURLToPath(import.meta.url)), 'goldens');
const UPDATING = process.env.UPDATE_DRAW_GOLDENS === '1';

/** Start, quarters, end: enough to catch the reveal and pause edges. */
const INSTANTS = [0, 0.25, 0.5, 0.75, 1];

/**
 * The three things a user can be looking at. `edit` shows the authoring
 * handles; `preview` is what playback looks like; `export` is that preview
 * drawn onto the export-resolution canvas, which is the frame the video
 * encoder receives (`exporting.js:172-186`).
 */
const MODES = ['edit', 'preview', 'export'];

/**
 * Every fixture, with the background it is meant to be seen against.
 *
 * The background matters: without it `stageProject` leaves `background.image`
 * null, the renderer skips it entirely, and a golden taken that way would not
 * notice the background disappearing.
 */
function fixtures() {
  const examples = buildExampleProjects();
  return [
    ...examples.map(example => ({
      id: example.id,
      project: example.project,
      background: example.backgroundSource,
    })),
    {
      id: 'authored-extras',
      project: authoredExtrasProject(),
      background: examples.find(each => each.id === 'uon-open-day').backgroundSource,
    },
  ];
}

/** A booted app with a fixture loaded, its background in place and timed. */
async function appWithFixture(fixture) {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, fixture.project)).toBe(true);
  expect(await loadExampleBackground(app, `./${fixture.background}`, { autoSave: false })).toBe(true);
  expect(app.background.image).not.toBeNull();

  // Loading a background announces its native size, and the export resolution
  // follows it — which in jsdom is the `Image` stub's 100×100 (`setup.js`),
  // not the real map. The authored resolution is put back, so export mode is
  // the 1920×1080 (or 1280×720) canvas the fixture actually asks for.
  app.exportSettings.resolutionX = fixture.project.exportSettings.resolutionX;
  app.exportSettings.resolutionY = fixture.project.exportSettings.resolutionY;
  app.invalidateAnimationTiming();
  return app;
}

/** Put the app into one of the three modes and size its canvases. */
function enterMode(app, mode) {
  app._setPreviewMode(mode !== 'edit');
  app.invalidateAnimationTiming();
  if (mode === 'export') {
    app._enterExportMode(app.exportSettings.resolutionX, app.exportSettings.resolutionY);
  }
  return setUpFrame(app);
}

function goldenPath(name) {
  return join(goldenDir, `draw-log-${name}.txt`);
}

/**
 * One file per fixture and mode: the frame that sized the canvases, then the
 * five instants. A missing golden is a failure rather than a silent pass:
 * deleting the file would otherwise disable the check it exists to make.
 */
function expectGolden(name, sections) {
  const path = goldenPath(name);
  const text = sections.map(([title, lines]) => `# ${title}\n${lines.join('\n')}`).join('\n\n') + '\n';

  // A surface with no role is labelled by its recorder id, which depends on
  // how many canvases the file made before it, so a golden holding one would
  // pass or fail by test order. Name the surface in `drawLog.js` instead.
  expect(text, `${name} uses a surface with no name`).not.toMatch(/other#\d/);

  if (UPDATING) {
    writeFileSync(path, text, 'utf8');
    return;
  }
  expect(existsSync(path), `Missing golden ${path}`).toBe(true);
  expect(readFileSync(path, 'utf8')).toBe(text);
}

/** The app in export mode plus a player loaded from the snapshot it made. */
async function exportAndPlayer(fixture) {
  const app = await appWithFixture(fixture);
  app._setPreviewMode(true);
  app.invalidateAnimationTiming();
  const project = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
  app._enterExportMode(app.exportSettings.resolutionX, app.exportSettings.resolutionY);
  setUpFrame(app);
  return { app, player: await loadedPlayer(project, app) };
}

/**
 * A `PlayerApp` on a canvas the size of the app's export canvas, given the
 * same background image the app is drawing — which is how an HTML export
 * arrives, the image travelling with the project rather than inside it.
 */
async function loadedPlayer(project, app) {
  const canvas = document.createElement('canvas');
  canvas.width = app.canvas.width;
  canvas.height = app.canvas.height;
  const player = new PlayerApp(canvas);
  await player.load(project, app.background.image);
  setUpFrame(player);
  return player;
}

/**
 * The calls a frame makes on one surface's context (`main` or `vector`), in
 * order. A `set:` is a property, not a call, and an `addColorStop` is a
 * gradient's.
 */
function surfaceCalls(frame, surface) {
  const notCalls = new RegExp(`^${surface} (set:|canvas\\.|\\[gradient )`);
  return frame.filter(line => line.startsWith(`${surface} `) && !notCalls.test(line));
}

/** How deep one surface's saves nest in a frame. */
function deepestSave(frame, surface) {
  let depth = 0;
  let deepest = 0;
  for (const line of frame) {
    if (line.startsWith(`${surface} save`)) deepest = Math.max(deepest, ++depth);
    else if (line.startsWith(`${surface} restore`)) depth -= 1;
  }
  return deepest;
}

/**
 * Render a frame whose call `index` on one surface's context throws (none,
 * for -1). Returns how many calls the frame made on that context, and whether
 * the error reached the caller.
 */
function renderThrowingAt(host, surface, index) {
  const canvas = surface === 'main' ? host.canvas : host.renderingService.vectorCanvas;
  const context = canvas.getContext('2d');
  const thrown = new Error(`${surface} call ${index} throws`);
  const names = Object.keys(context).filter(name => vi.isMockFunction(context[name]));
  const methods = names.map(name => context[name]);
  let calls = 0;
  names.forEach((name, n) => {
    context[name] = (...args) => {
      if (calls++ === index) throw thrown;
      return methods[n](...args);
    };
  });
  try {
    host.render();
    return { calls, threw: false };
  } catch (error) {
    if (error !== thrown) throw error;
    return { calls, threw: true };
  } finally {
    names.forEach((name, n) => { context[name] = methods[n]; });
  }
}

/** The renderers of the main canvas's background pass, each given its inputs as arguments. */
const BACKGROUND_RENDERERS = ['renderBackground', 'renderBackgroundWithSpotlight', 'renderBackgroundWithReveal',
  'renderBackgroundWithAOV', 'renderOverlay'];

/**
 * Render a frame in which the `index`th read the background pass makes of its
 * inputs throws (none, for -1): of the viewport and the camera state it is
 * given, and of every object passed to a background renderer. No canvas call
 * need throw for a save to be left open: a read placed between a `save` and
 * its `try` would do it (Codex's review of DEF-38). The vector layer's reads
 * come after the pass and are not counted. Returns how many reads the pass
 * made, and whether the error reached the caller.
 */
function renderThrowingAtRead(host, index) {
  const service = host.renderingService;
  const thrown = new Error(`read ${index} throws`);
  const watchedObjects = new WeakSet();
  let inPass = false;
  let reads = 0;
  const watch = (value) => {
    if (value === null || typeof value !== 'object' || watchedObjects.has(value)) return value;
    const watched = new Proxy(value, {
      get(target, name, receiver) {
        if (inPass && reads++ === index) throw thrown;
        return Reflect.get(target, name, receiver);
      },
    });
    watchedObjects.add(watched);
    return watched;
  };
  const replaced = new Map();
  const replace = (name, wrap) => {
    replaced.set(name, Object.getOwnPropertyDescriptor(service, name));
    service[name] = wrap(service[name]);
  };
  replace('render', render => function (ctx, width, height, state) {
    inPass = true;
    return render.call(this, ctx, width, height,
      { ...state, viewport: watch(state.viewport), cameraState: watch(state.cameraState) });
  });
  replace('getVectorCanvas', getVectorCanvas => function (...args) {
    inPass = false;
    return getVectorCanvas.apply(this, args);
  });
  for (const name of BACKGROUND_RENDERERS) {
    replace(name, renderer => function (ctx, ...args) { return renderer.call(this, ctx, ...args.map(watch)); });
  }
  try {
    host.render();
    return { reads, threw: false };
  } catch (error) {
    if (error !== thrown) throw error;
    return { reads, threw: true };
  } finally {
    for (const [name, own] of replaced) {
      if (own) Object.defineProperty(service, name, own);
      else delete service[name];
    }
  }
}

describe('golden draw logs (TST-02)', () => {

  // Frozen, because a golden may not depend on when it ran.
  freezeClock();

  for (const fixture of fixtures()) {
    describe(fixture.id, () => {

      for (const mode of MODES) {
        // `nervous-system-flow` has no minor waypoints, so its editor draws
        // exactly its preview; the test below asserts that equality at every
        // instant instead of keeping a second identical file.
        const skipGolden = fixture.id === 'nervous-system-flow' && mode === 'edit';

        test(`${mode} draws its golden frames`, async () => {
          const app = await appWithFixture(fixture);
          const setUp = enterMode(app, mode);

          const frames = INSTANTS.map(instant => frameAt(app, instant));

          // Non-vacuity: a mode that drew nothing would otherwise match a
          // golden full of nothing, and the last instant always draws more
          // than the first because the route has been revealed by then.
          expect(frames.at(-1).length).toBeGreaterThan(frames[0].length);
          expect(frames.at(-1).length).toBeGreaterThan(20);
          // The background reaches the canvas in every mode.
          expect(frames[0].some(operations => /^main drawImage \[image/.test(operations))).toBe(true);
          // So does the vector layer, in every frame and by name (TST-17): a
          // source written only as `[canvas]` let a render that composited
          // the wrong canvas, blanking the route, match every golden.
          for (const [index, frame] of frames.entries()) {
            expect(frame.some(operations => operations.startsWith('main drawImage [canvas vector] ')),
              `progress ${INSTANTS[index]} composites the vector layer`).toBe(true);
          }

          if (skipGolden) return;
          expectGolden(`${fixture.id}-${mode}`, [
            ['canvas set-up', setUp],
            ...INSTANTS.map((instant, index) => [`progress ${instant}`, frames[index]]),
          ]);
        });
      }

      test('the editor and preview differ by exactly the minor-waypoint handles', async () => {
        // The goldens would be worth much less if the modes were the same file
        // three times over. Preview and export always differ, because export
        // draws at the export resolution. Edit adds only the minor-waypoint
        // handles on top of preview, so for the one fixture with no minors the
        // two are identical — asserted at every instant, which is what lets
        // that file be left out above.
        const hasMinors = fixture.project.waypoints.some(waypoint => waypoint.isMajor === false);
        expect(!hasMinors).toBe(fixture.id === 'nervous-system-flow');

        const drawn = {};
        for (const mode of MODES) {
          const app = await appWithFixture(fixture);
          enterMode(app, mode);
          drawn[mode] = INSTANTS.map(instant => frameAt(app, instant));
        }

        for (const index of INSTANTS.keys()) {
          if (hasMinors) expect(drawn.edit[index]).not.toEqual(drawn.preview[index]);
          else expect(drawn.edit[index]).toEqual(drawn.preview[index]);
        }
        expect(drawn.preview[2]).not.toEqual(drawn.export[2]);
      });

      test('play draws what seek draws', async () => {
        // The render-level half of the deterministic-timeline contract. Two
        // comparisons, because they fail differently: the same host must draw
        // the same frame after playing as after seeking (no accumulated
        // renderer state), and a host that never played must draw it too (no
        // accumulated *engine* state that a later seek inherits).
        //
        // Both compare against the progress playing actually reached, not the
        // one it aimed at: fifty additions of duration/100 land a few ulps
        // past 0.5, and on a branched route one ulp is a whole extra path
        // point. That is arithmetic, not rendering.
        const app = await appWithFixture(fixture);
        enterMode(app, 'preview');

        app.animationEngine.seekToProgress(0);
        app.render();
        app.animationEngine.play();
        const step = app.animationEngine.state.duration / 100;
        let elapsed = 0;
        for (let tick = 0; tick < 50; tick += 1) {
          elapsed += step;
          app.animationEngine.updateAnimation(step, elapsed);
        }
        const reached = app.animationEngine.state.progress;
        expect(reached).toBeCloseTo(0.5, 10);

        // Drawn with the transport still running, then after it stops: a
        // renderer reading `isPlaying()` (DEF-08's mechanism) would part them.
        discardFrame();
        app.render();
        const midPlayback = takeFrame(app);
        app.animationEngine.pause();
        discardFrame();
        app.render();
        const afterPausing = takeFrame(app);
        const seekedOnTheSameHost = frameAt(app, reached);

        const fresh = await appWithFixture(fixture);
        enterMode(fresh, 'preview');
        const seekedOnAFreshHost = frameAt(fresh, reached);

        expect(differingLines(midPlayback, seekedOnTheSameHost)).toEqual([]);
        expect(differingLines(afterPausing, seekedOnTheSameHost)).toEqual([]);
        expect(differingLines(seekedOnTheSameHost, seekedOnAFreshHost)).toEqual([]);
      });

      test('the exported player draws what the export canvas draws', async () => {
        // The HTML player is a second renderer host over the same
        // `RenderingService`, reading the saved project. This is the test that
        // an export is what it promised to be.
        //
        // `authored-extras` is the only fixture with a Graphics scale, which
        // the player dropped until DEF-34, and the only one with a camera,
        // whose easing makes its very first frame a transient rather than a
        // picture. That frame is still drawn on both hosts, so the later ones
        // follow the same sequence, but it is compared below instead.
        const { app, player } = await exportAndPlayer(fixture);

        for (const instant of INSTANTS) {
          const differing = differingLines(frameAt(app, instant), frameAt(player, instant));
          if (fixture.id === 'authored-extras' && instant === 0) continue;
          expect(differing, `instant ${instant}`).toEqual([]);
        }
      });

    });
  }

  test('the vector layer is composited at its display size at any pixel density', async () => {
    // The goldens run at a pixel density of 1, where the vector layer's
    // backing store and its display size are the same numbers, so a render
    // that composited it at the wrong one of the two matched every golden
    // (Codex, TST-17). At density 2 the editor backs the layer at twice its
    // display size, and must still composite it at its display size.
    const density = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    try {
      const app = await appWithFixture(fixtures().find(each => each.id === 'uon-open-day'));
      enterMode(app, 'preview');
      const frame = frameAt(app, 0.5);

      expect(app.renderingService.vectorCanvas.width).toBe(app.displayWidth * 2);
      expect(frame).toContain(`main drawImage [canvas vector] 0 0 ${app.displayWidth} ${app.displayHeight}`);
    } finally {
      if (density) Object.defineProperty(window, 'devicePixelRatio', density);
      else delete window.devicePixelRatio;
    }
  });

  describe('fixed defects stay fixed', () => {

    test('DEF-02: the exported player follows a moved anchor waypoint', async () => {
      // `PlayerApp` used to leave `waypointsById` unbuilt (the structural half
      // is in `playerHostContract.test.js`), so it could not resolve a crowd
      // node to its anchor waypoint and fell back to the position written at
      // trace time. Nothing shows that in the shipped examples, because no
      // waypoint has moved since its trace. Move one through the bus the drag
      // uses (`wiringBus.js:185-198`): the player must still draw what the
      // export canvas draws, crowd included.
      const fixture = fixtures().find(each => each.id === 'uon-open-day');
      const app = await appWithFixture(fixture);

      const anchored = app.scene.getFlowLayers()[0].graph.getNodes()
        .filter(node => node.anchorWaypointId);
      expect(anchored.length).toBeGreaterThan(0);
      const moved = app.waypoints.find(waypoint => waypoint.id === anchored[0].anchorWaypointId);
      app.eventBus.emit('waypoint:position-changed', { waypoint: moved, imgX: 0.05, imgY: 0.05 });
      app.eventBus.emit('waypoint:drag-ended', { waypoint: moved });
      expect(moved.imgX).toBe(0.05);

      app._setPreviewMode(true);
      app.invalidateAnimationTiming();
      const project = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
      app._enterExportMode(app.exportSettings.resolutionX, app.exportSettings.resolutionY);
      setUpFrame(app);

      const player = await loadedPlayer(project, app);
      expect(player.renderingService._graphicsScale).toBe(app.renderingService._graphicsScale);

      // The move reached the saved project and the node's authored position
      // did not follow it, so a player falling back to that position would
      // draw the crowd somewhere else.
      const node = player.scene.getFlowLayers()[0].graph.getNodes()
        .find(each => each.id === anchored[0].id);
      expect(node.position()).toEqual({ x: 0.05, y: 0.05 });
      expect(Math.hypot(node.x - 0.05, node.y - 0.05)).toBeGreaterThan(0.1);

      const differing = INSTANTS.map(instant =>
        differingLines(frameAt(app, instant), frameAt(player, instant)).length);
      expect(differing).toEqual(INSTANTS.map(() => 0));
    });

    test.each([0.5, 1.6, 8])('DEF-34: the exported player draws at the authored Graphics scale (%s)', async (scale) => {
      // `RenderingService` keeps the Graphics scale multiplier on itself
      // rather than reading it from each frame's styles, and `PlayerApp` never
      // set it. So an HTML export drew every path width, dash, marker radius
      // and area rectangle as though the scale were 1, each out by exactly the
      // authored scale, while the video export of the same project was right.
      //
      // The fixture is authored at 1.6; a scale below 1 and one past the
      // renderer's 4× clamp are checked too. It exports without text and with
      // a camera, so text is turned on, because label type scales as well, and
      // the camera off, so the first instant can be compared with the rest.
      const fixture = fixtures().find(each => each.id === 'authored-extras');
      fixture.project.styles.graphicsScale = scale;
      fixture.project.exportSettings.includeText = true;
      fixture.project.exportSettings.includeCamera = false;
      const { app, player } = await exportAndPlayer(fixture);
      expect(app.renderingService._graphicsScale).toBe(Math.min(scale, 4));
      expect(player.renderingService._graphicsScale).toBe(app.renderingService._graphicsScale);

      const frames = INSTANTS.map(instant => {
        const appFrame = frameAt(app, instant);
        expect(differingLines(appFrame, frameAt(player, instant)), `instant ${instant}`).toEqual([]);
        return appFrame;
      });

      // Non-vacuity: the frames draw every kind of size the player got wrong,
      // and labels.
      const operations = new Set(frames[2].map(line => line.split(' ')[1]));
      for (const sized of ['arc', 'rect', 'set:lineWidth', 'setLineDash', 'set:font', 'fillText']) {
        expect(operations).toContain(sized);
      }
    });

    describe('DEF-29: a video export ignores the author\'s reduced-motion setting', () => {
      // Under prefers-reduced-motion the pulse, ripple and glow beacons are held
      // still, which is right for the editor and the live player. A video is
      // watched elsewhere, by people whose setting it cannot know, so it bakes
      // the beacons as authored (§20 Q7b, accepted 2026-09-22). Open day's
      // camera never zooms, so frames at one instant differ only by beacons.
      const STILLED = new Map([['ex-uon-1', 'ripple'], ['ex-uon-2', 'pulse'], ['ex-uon-3', 'glow']]);

      /** Open day with the stilled styles, or only `id`'s, so a check sees only its own beacon. */
      function stilledFixture(id = null) {
        const fixture = fixtures().find(each => each.id === 'uon-open-day');
        for (const waypoint of fixture.project.waypoints) {
          if (!STILLED.has(waypoint.id)) continue;
          waypoint.beaconStyle = id === null || waypoint.id === id ? STILLED.get(waypoint.id) : 'none';
        }
        return fixture;
      }

      /**
       * A quarter-second after `id`'s arrival, the frame drawn with reduced
       * motion (from reset beacons, as when the setting is on from the start)
       * and the frame drawn without it. A pulse shows only through its marker's
       * scale, which a paused frame did not draw before DEF-08, so a pulse's
       * frames are drawn with the transport running.
       */
      function withAndWithoutReducedMotion(host, id) {
        const engine = host.animationEngine;
        const offset = (engine.startHandleTime || 0) + (engine.introTime || 0);
        const schedule = engine.beaconSchedules.find(each => each.waypointId === id);
        expect(schedule?.style).toBe(STILLED.get(id));
        const progress = (schedule.arrivalMs + 250 + offset) / engine.state.duration;
        const drawAt = () => {
          const paused = frameAt(host, progress);
          if (schedule.style !== 'pulse') return paused;
          engine.play();
          discardFrame();
          host.render();
          const playing = takeFrame(host);
          engine.pause();
          return playing;
        };
        const setting = BeaconRenderer.prefersReducedMotion;
        try {
          BeaconRenderer.prefersReducedMotion = true;
          host.renderingService.resetBeacons();
          const reduced = drawAt();
          BeaconRenderer.prefersReducedMotion = false;
          return { reduced, moving: drawAt() };
        } finally {
          BeaconRenderer.prefersReducedMotion = setting;
        }
      }

      for (const [id, style] of STILLED) {
        test(`the export canvas draws a ${style} as authored`, async () => {
          const { app } = await exportAndPlayer(stilledFixture(id));
          const { reduced, moving } = withAndWithoutReducedMotion(app, id);
          expect(differingLines(reduced, moving), `export: ${style}`).toEqual([]);
        });

        test(`the editor and the exported player still hold a ${style} still`, async () => {
          const app = await appWithFixture(stilledFixture(id));
          enterMode(app, 'preview');
          const { player } = await exportAndPlayer(stilledFixture(id));
          for (const [label, host] of [['preview', app], ['player', player]]) {
            const { reduced, moving } = withAndWithoutReducedMotion(host, id);
            expect(differingLines(reduced, moving).length, `${label}: ${style}`).toBeGreaterThan(0);
          }
        });
      }

      // The editor's hold never syncs a beacon, so whatever an export frame
      // left in one used to stay drawn, frozen, after the export ended.
      for (const [outcome, lastProgress, error] of [
        ['finished', 1, null], ['cancelled', 0.15, 'Export cancelled'], ['failed', 0.15, 'encoder failed'],
      ]) {
        test(`after a ${outcome} export, a reduced-motion editor draws what it drew before`, async () => {
          const download = vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
          vi.stubGlobal('alert', vi.fn());
          allowConsole(/export/i);
          const setting = BeaconRenderer.prefersReducedMotion;
          BeaconRenderer.prefersReducedMotion = true;
          try {
            const app = await appWithFixture(stilledFixture());
            app.updateCanvasAspectRatio(); // the geometry leaving export mode restores
            enterMode(app, 'preview');
            const instants = [0.05, 0.15, 0.8, 1];
            const before = instants.map(instant => frameAt(app, instant));
            // The real exportVideo(), with only the encoder replaced
            app.videoExporter = {
              cancel() {},
              async export({ renderFrame }) {
                for (let step = 0; step <= 60; step += 1) await renderFrame((step / 60) * lastProgress);
                if (error) throw new Error(error);
                return new Blob(['video']);
              },
            };
            await app.exportVideo();
            instants.forEach((instant, index) => {
              expect(differingLines(before[index], frameAt(app, instant)), `at ${instant}`).toEqual([]);
            });
          } finally {
            BeaconRenderer.prefersReducedMotion = setting;
            download.mockRestore();
            vi.unstubAllGlobals();
          }
        });
      }
    });

    describe('DEF-36: a frame that throws leaves nothing behind', () => {
      // A renderer that throws part-way through the vector layer skips the
      // `restore` of every save it had open: the camera's or the viewport's
      // around the layer, and a beacon's or a marker's inside it. So every
      // later frame drew through this one's transform, until a resize — under
      // the 1.75× camera below, on a 2× display, at 3.5× instead of 2×. No
      // call changes, so these transcripts carry the state each call was made
      // in: its transform, the saved states still open, and its styles.
      //
      // The frame after a throw must draw what a freshly sized layer draws,
      // as the first frame after any resize does. A steady-state frame can
      // differ from that in styles no call draws with, which the layer
      // carries from one frame to the next; since DEF-39 (below) it draws the
      // same.
      //
      // A browser throws from a context call given a bad argument (an `arc`
      // with a negative radius, a gradient given NaN, DEF-26's colour), so the
      // throw is injected at a call on the vector layer's context. Every save
      // the frame makes is tried at its `restore`, the latest point inside
      // it, which leaves its whole body behind. The error must still reach the
      // caller, which reports it (DEF-26).

      /** The instant at which `authored-extras`'s first ripple is still drawing. */
      const BEACON_INSTANT = 0.005;

      /** Where the vector layer's calls `restore`, by their index among them. */
      function restoreCalls(frame) {
        return surfaceCalls(frame, 'vector').flatMap((line, index) => (line.startsWith('vector restore') ? [index] : []));
      }

      /**
       * Throw at every `restore` of a clean frame in turn, and draw the frame
       * again after each: it must be the clean frame, transforms included.
       */
      /**
       * The frame a freshly sized layer draws, less the resize that sized it.
       * A frame at the same instant comes first, so the main canvas and the
       * reveal mask start as they do after any frame there (their styles carry
       * over too), and only the layer is fresh. Any change of scale takes
       * `getVectorCanvas`'s resize branch, the one a window resize takes,
       * rather than the reset the fix adds.
       */
      function freshFrame(host) {
        frameAt(host, BEACON_INSTANT);
        host.renderingService.vectorCanvasScale = NaN;
        const frame = frameAt(host, BEACON_INSTANT, { state: true });
        const cleared = frame.findIndex(line => line.startsWith('vector clearRect'));
        return frame.filter((line, index) => index >= cleared || !line.startsWith('vector '));
      }

      /**
       * Throw at every `restore` of a fresh frame in turn, and draw the frame
       * again after each: it must be the fresh frame, state included.
       */
      function expectEachThrowForgotten(host, { layerScale, beacon }) {
        // Counted over the fresh frame only: a beacon's own save is one of
        // the saves tried below.
        const beaconRenderer = host.renderingService.beaconRenderer;
        const save = host.renderingService.vectorCanvas.getContext('2d').save;
        const renderBeacon = beaconRenderer.renderBeacon;
        let beaconSaves = 0;
        beaconRenderer.renderBeacon = function (...args) {
          const before = save.mock.calls.length;
          const result = renderBeacon.apply(this, args);
          beaconSaves += save.mock.calls.length - before;
          return result;
        };
        const fresh = freshFrame(host);
        beaconRenderer.renderBeacon = renderBeacon;

        // Non-vacuity: the layer draws under its own transform, with saves
        // nested inside it, one of them a beacon's where the host draws one.
        expect(fresh.some(line => line.startsWith(`${layerScale} @ `)), layerScale).toBe(true);
        expect(deepestSave(fresh, 'vector')).toBeGreaterThanOrEqual(2);
        if (beacon) expect(beaconSaves).toBeGreaterThan(0);

        // A throw is placed by counting calls, so the count must be the
        // transcript's, or the throws below would land beside the restores.
        expect(renderThrowingAt(host, 'vector', -1).calls).toBe(surfaceCalls(fresh, 'vector').length);

        const throwAt = restoreCalls(fresh);
        expect(throwAt.length).toBeGreaterThanOrEqual(2);
        for (const index of throwAt) {
          expect(renderThrowingAt(host, 'vector', index).threw,
            `the throw at vector call ${index} reaches the caller`).toBe(true);
          const next = frameAt(host, BEACON_INSTANT, { state: true });
          const differing = differingLines(next, fresh);
          expect(differing, `after a throw at vector call ${index}, "${next[differing[0]]}" ` +
            `was "${fresh[differing[0]]}"`).toEqual([]);
        }
        return fresh;
      }

      test('in the editor, under the camera and under a viewport zoom, at pixel density 2', async () => {
        // At density 1 the layer's base transform is the identity, so a
        // reset that dropped it would pass; at 2 it is `scale(2, 2)`.
        const density = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
        Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
        try {
          const app = await appWithFixture(fixtures().find(each => each.id === 'authored-extras'));

          enterMode(app, 'preview');
          const underCamera = expectEachThrowForgotten(app, { layerScale: 'vector scale 1.75 1.75', beacon: true });
          expect(underCamera.find(line => line.startsWith('vector clearRect'))).toMatch(/ @ 2 0 0 2 0 0 \| saved 0$/);

          enterMode(app, 'edit');
          app.setZoom(2, app.waypoints[1]);
          expectEachThrowForgotten(app, { layerScale: 'vector scale 2 2', beacon: false });
        } finally {
          if (density) Object.defineProperty(window, 'devicePixelRatio', density);
          else delete window.devicePixelRatio;
        }
      });

      test('on the export canvas and in the exported player', async () => {
        // Video frames are drawn by the editor on its export canvas; the HTML
        // player is a second host over the same `RenderingService`.
        const { app, player } = await exportAndPlayer(fixtures().find(each => each.id === 'authored-extras'));
        for (const host of [app, player]) {
          expectEachThrowForgotten(host, { layerScale: 'vector scale 1.75 1.75', beacon: true });
        }
      });

    });

    describe('DEF-38: a throw in the background pass leaves nothing behind', () => {
      // Before the vector layer is composited, the main canvas draws the
      // background inside saves of its own: the viewport zoom's around the
      // whole pass, the camera's around the image, a mask mode's around the
      // image and the `destination-in` that cuts it to the mask, and the
      // contrast overlay's. A throw inside one skipped every `restore` still
      // owed, so each later frame drew through that frame's zoom or camera,
      // and after a mask mode under `destination-in`, until a resize: on a 2×
      // display under the 1.75× camera, at 3.5× where a steady frame draws at
      // 2×. DEF-36's cure, a resize, does not carry over, because the main
      // canvas's base transform and smoothing belong to its host.
      //
      // The frame after a throw must draw exactly what a steady frame at the
      // same instant draws, state included: its transform, open saves and
      // styles. (The recorder keeps no clip region, and nothing in the pass
      // clips.) The throw goes to each call the frame makes on the main canvas
      // in turn, except a `restore`, which takes no argument, so cannot throw
      // in a browser; then to each read the pass makes of its inputs, since
      // code between a `save` and its `try` can throw without the canvas. The
      // error must still reach the caller.

      /** Past the reveal's intro, with the camera at its authored 1.75×. */
      const INSTANT = 0.5;

      /**
       * Every background mode: how deep its saves nest at least (the overlay
       * opens one in each, and in a mask mode the image's camera opens one
       * inside the mode's), whether it cuts the image to a mask, and whether
       * it draws the image under the camera, which the instant spotlight and
       * angle of view did not until DEF-27.
       */
      const BACKGROUND_MODES = new Map([
        ['always-show', { nesting: 1, masked: false, underCamera: true }],
        ['spotlight', { nesting: 2, masked: true, underCamera: true }],
        ['spotlight-reveal', { nesting: 2, masked: true, underCamera: true }],
        ['angle-of-view', { nesting: 2, masked: true, underCamera: true }],
        ['angle-of-view-reveal', { nesting: 2, masked: true, underCamera: true }],
        ['always-hide', { nesting: 1, masked: false, underCamera: false }],
      ]);

      /**
       * Throw at each call a steady frame makes on the main canvas in turn,
       * and with `reads`, at each read its background pass makes of its
       * inputs, and draw the frame again after each: it must be the steady
       * frame, state included. `transform` names a zoom the pass must really
       * apply. Where a read sits depends on the renderer, not the host, so the
       * reads are tried in the editor only.
       */
      function expectEachBackgroundThrowForgotten(host, { nesting, masked, transform = null, reads = false }) {
        frameAt(host, INSTANT);
        const steady = frameAt(host, INSTANT, { state: true });
        const calls = surfaceCalls(steady, 'main');

        // Non-vacuity: the pass opens its saves, nested where they nest, a
        // mask mode masks, and the zoom or camera is really there.
        expect(deepestSave(steady, 'main')).toBeGreaterThanOrEqual(nesting);
        expect(steady.some(line => line.split(' @ ')[0] === 'main set:globalCompositeOperation destination-in'),
          'masked').toBe(masked);
        if (transform) expect(calls.some(line => line.split(' @ ')[0] === `main ${transform}`), transform).toBe(true);

        // A throw is placed by counting calls, so the count must be the transcript's.
        expect(renderThrowingAt(host, 'main', -1).calls).toBe(calls.length);

        for (const [index, call] of calls.entries()) {
          if (call.startsWith('main restore')) continue;
          expect(renderThrowingAt(host, 'main', index).threw,
            `the throw at main call ${index} reaches the caller`).toBe(true);
          const next = frameAt(host, INSTANT, { state: true });
          const differing = differingLines(next, steady);
          expect(differing, `after a throw at main call ${index} (${call.split(' ')[1]}), ` +
            `"${next[differing[0]]}" was "${steady[differing[0]]}"`).toEqual([]);
        }

        if (reads) {
          // Every pass reads at least the viewport.
          const { reads: count } = renderThrowingAtRead(host, -1);
          expect(count).toBeGreaterThan(0);
          for (let index = 0; index < count; index += 1) {
            expect(renderThrowingAtRead(host, index).threw, `the throw at read ${index} reaches the caller`).toBe(true);
            const next = frameAt(host, INSTANT, { state: true });
            const differing = differingLines(next, steady);
            expect(differing, `after a throw at read ${index}, "${next[differing[0]]}" ` +
              `was "${steady[differing[0]]}"`).toEqual([]);
          }
        }
        return steady;
      }

      /**
       * `authored-extras` in the editor with the display at pixel density 2,
       * where the main canvas's base transform is `scale(2, 2)`. At density 1
       * it is the identity, which a context reset to its defaults would also
       * leave. The density is put back afterwards.
       */
      async function inTheEditorAtDensityTwo(check) {
        const density = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
        Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
        try {
          const app = await appWithFixture(fixtures().find(each => each.id === 'authored-extras'));
          const steady = check(app);
          expect(steady.find(line => line.startsWith('main clearRect'))).toMatch(/ @ 2 0 0 2 0 0 \| saved 0 /);
        } finally {
          if (density) Object.defineProperty(window, 'devicePixelRatio', density);
          else delete window.devicePixelRatio;
        }
      }

      test('the modes below are all the background modes there are', () => {
        expect([...BACKGROUND_MODES.keys()].sort()).toEqual(Object.values(BACKGROUND_VISIBILITY).sort());
      });

      // One test per mode, so a failure names its mode and each test's
      // recorded calls are let go before the next.
      for (const [mode, { underCamera, ...expected }] of BACKGROUND_MODES) {
        const transform = underCamera ? 'scale 1.75 1.75' : null;

        test(`in the editor at pixel density 2: ${mode}`, () => inTheEditorAtDensityTwo((app) => {
          enterMode(app, 'preview');
          app.motionSettings.backgroundVisibility = mode;
          return expectEachBackgroundThrowForgotten(app, { ...expected, transform, reads: true });
        }));

        test(`on the export canvas and in the exported player at its display size: ${mode}`, async () => {
          // The export canvas draws at the identity. The player maps the
          // export resolution onto its window with a transform of its own,
          // which `resize` sets only for a canvas with a parent: here a
          // 640-pixel-wide one, so half of the 1280-wide export.
          const fixture = fixtures().find(each => each.id === 'authored-extras');
          fixture.project.motionSettings.backgroundVisibility = mode;
          const { app, player } = await exportAndPlayer(fixture);
          const playerWindow = document.createElement('div');
          Object.defineProperties(playerWindow, { clientWidth: { value: 640 }, clientHeight: { value: 480 } });
          playerWindow.appendChild(player.canvas);
          document.body.appendChild(playerWindow);
          try {
            player.resize();
            for (const [host, base] of [[app, '1 0 0 1 0 0'], [player, '0.5 0 0 0.5 0 0']]) {
              expect(host.motionSettings.backgroundVisibility).toBe(mode);
              const steady = expectEachBackgroundThrowForgotten(host, { ...expected, transform });
              expect(steady.find(line => line.startsWith('main clearRect'))).toContain(` @ ${base} | saved 0 `);
            }
          } finally {
            playerWindow.remove();
          }
        });
      }

      test('in the editor at pixel density 2: edit mode under a 2× viewport zoom', () => inTheEditorAtDensityTwo((app) => {
        enterMode(app, 'edit');
        app.setZoom(2, app.waypoints[1]);
        return expectEachBackgroundThrowForgotten(app, { nesting: 2, masked: false, transform: 'scale 2 2', reads: true });
      }));

    });

    describe('DEF-39: a frame draws the same, whatever frame came before it', () => {
      // The vector layer keeps its styles from one frame to the next, and the
      // route sets its caps and joins outside any save. An area's border,
      // drawn before the route, set neither, so it drew with whatever the frame
      // before had left: round in a steady frame, but butt caps and mitred
      // corners on a freshly sized layer (the first frame after a resize, and
      // the frame after a throw, DEF-36), which drew a dotted border's dots
      // square. Joe chose the round look steady frames draw (2026-09-25).
      //
      // Every instant is drawn four ways: after a frame at the same instant,
      // after a frame at another, after a frame that left other caps and joins
      // behind, and on a freshly sized layer. Each call must draw with the
      // same state every time (`takeFrame`'s drawn view); a style no call
      // draws with may differ.

      /**
       * The frame at `instant` on a freshly sized layer, less the resize that
       * sized it, which is the branch a window resize takes.
       */
      function freshFrameAt(host, instant) {
        host.renderingService.vectorCanvasScale = NaN;
        const frame = frameAt(host, instant, { state: 'drawn' });
        const cleared = frame.findIndex(line => line.startsWith('vector clearRect'));
        expect(frame.slice(0, cleared).some(line => line.startsWith('vector canvas.width'))).toBe(true);
        return frame.filter((line, index) => index >= cleared || !line.startsWith('vector '));
      }

      /** `frame` must draw everything as `steady` does; the message names the first line that does not. */
      function expectDrawnAlike(frame, steady, label) {
        const differing = differingLines(frame, steady);
        expect(differing, `${label}: "${frame[differing[0]]}" where the steady frame has ` +
          `"${steady[differing[0]]}"`).toEqual([]);
      }

      /**
       * Every instant, drawn the four ways, must draw alike; and where the
       * fixture has areas (`border` is their colour), each stroke of a border
       * must be round, the look Joe chose, not merely the same each time.
       */
      function expectEveryInstantAlike(host, label, border) {
        let marks = 0;
        let borderStrokes = 0;
        for (const [index, instant] of INSTANTS.entries()) {
          // Each way arrives by a seek from another instant, which snaps the
          // camera there; a camera left easing would differ for its own reasons.
          const other = INSTANTS[(index + 2) % INSTANTS.length];
          frameAt(host, other);
          frameAt(host, instant);
          const steady = frameAt(host, instant, { state: 'drawn' });
          frameAt(host, other);
          expectDrawnAlike(frameAt(host, instant, { state: 'drawn' }), steady, `${label} at ${instant}, after another instant`);
          // As any outline that set its own caps and joins outside a save would
          frameAt(host, other);
          const layer = host.renderingService.vectorCanvas.getContext('2d');
          layer.lineCap = 'square';
          layer.lineJoin = 'bevel';
          expectDrawnAlike(frameAt(host, instant, { state: 'drawn' }), steady,
            `${label} at ${instant}, after a frame that left square caps and bevelled joins`);
          frameAt(host, other);
          const fresh = freshFrameAt(host, instant);
          expectDrawnAlike(fresh, steady, `${label} at ${instant}, on a freshly sized layer`);
          marks += steady.filter(line => line.startsWith('vector ') && line.includes(' @ ')).length;

          if (!border) continue;
          for (const line of [...steady, ...fresh]) {
            if (!/^vector stroke(Rect)? /.test(line) || !line.includes(` strokeStyle=${border} `)) continue;
            borderStrokes += 1;
            expect(line, `${label} at ${instant}: an area's border strokes round`).toMatch(/ lineCap=round lineJoin=round /);
          }
        }
        // Non-vacuity: the vector layer's marks are compared by the state they
        // draw with (`testHarness.test.js` pins what that view shows), and a
        // fixture with areas really strokes their borders.
        expect(marks, label).toBeGreaterThan(0);
        if (border) expect(borderStrokes, `${label}: area borders`).toBeGreaterThan(0);
      }

      for (const fixture of fixtures()) {
        test(`${fixture.id}: in the editor, in preview, on the export canvas and in the player`, async () => {
          const border = fixture.project.waypoints.find(each => each.areaHighlight?.enabled)?.areaHighlight.borderColor;
          const app = await appWithFixture(fixture);
          for (const mode of ['edit', 'preview']) {
            enterMode(app, mode);
            expectEveryInstantAlike(app, mode, border);
          }
          // Under a viewport zoom the layer is drawn inside a save, which put
          // the route's round caps back at the end of every frame (Codex).
          enterMode(app, 'edit');
          app.setZoom(2, app.waypoints[1]);
          expectEveryInstantAlike(app, 'edit under a 2× zoom', border);
          const { app: exporter, player } = await exportAndPlayer(fixture);
          expectEveryInstantAlike(exporter, 'export', border);
          expectEveryInstantAlike(player, 'player', border);
        });
      }

    });

    describe('DEF-47: a polygon being drawn draws in its own blue, whatever drew before it', () => {
      // While an area was being drawn, the preview stroked its placed edges and
      // the line to the cursor before setting its own style, so they drew with
      // whatever stroke the layer last had: the last marker's white outline in
      // `authored-extras`, the route's colour and width elsewhere, a black
      // hairline on a freshly sized layer. The dashed line back to the first
      // vertex and the vertex rings drew in the preview's blue, as did the same
      // edges while the cursor was off the canvas; Joe chose that blue for the
      // edges too (2026-09-28).

      /** The preview's strokes: the last save on the vector layer is the preview's (`VECTOR_LAYERS`). */
      function previewStrokes(frame) {
        const vector = frame.filter(line => line.startsWith('vector '));
        const opened = vector.findLastIndex(line => line === 'vector save');
        const closed = vector.indexOf('vector restore', opened);
        return vector.slice(opened, closed).filter(line => /^vector stroke /.test(line));
      }

      /** The blue each stroke of the preview draws with, solid or with the closing line's dashes. */
      const BLUE = / strokeStyle=#0f62fe lineWidth=2 lineCap=round lineJoin=round (lineDash=4,4 )?globalAlpha=0\.8$/;

      function expectPreviewInBlue(frame, label, { cursor, vertices = 2 }) {
        const strokes = previewStrokes(frame);
        // Non-vacuity: the placed edges, then the dashed line back to the
        // first vertex while the cursor is on the canvas, then a ring for each
        // vertex.
        expect(strokes, label).toHaveLength(1 + (cursor ? 1 : 0) + vertices);
        strokes.forEach((stroke, index) => {
          expect(stroke, `${label}: "${stroke}"`).toMatch(BLUE);
          // Only the line back is dashed; the edges and the rings are solid
          if (cursor && index === 1) expect(stroke, `${label}: the line back`).toMatch(/ lineDash=4,4 /);
          else expect(stroke, `${label}: stroke ${index}`).not.toMatch(/lineDash=/);
        });
      }

      test('in the editor, whatever frame came before', async () => {
        const app = await appWithFixture(fixtures().find(each => each.id === 'authored-extras'));
        enterMode(app, 'edit');
        const drawing = app.areaDrawingService;
        app.eventBus.emit('area:draw-start', { waypoint: app.waypoints[1] });
        try {
          for (const [imgX, imgY] of [[0.2, 0.2], [0.4, 0.3]]) app.eventBus.emit('area:draw-click', { imgX, imgY });
          expect(drawing.vertices).toHaveLength(2);
          frameAt(app, 0.5);
          expectPreviewInBlue(frameAt(app, 0.5, { state: 'drawn' }), 'before the cursor moves', { cursor: false });

          app.eventBus.emit('area:draw-move', { imgX: 0.6, imgY: 0.4 });
          frameAt(app, 0.5);
          expectPreviewInBlue(frameAt(app, 0.5, { state: 'drawn' }), 'after a frame with the route', { cursor: true });
          frameAt(app, 0);
          expectPreviewInBlue(frameAt(app, 0, { state: 'drawn' }), 'after a frame with no route', { cursor: true });
          app.renderingService.vectorCanvasScale = NaN;
          expectPreviewInBlue(frameAt(app, 0.5, { state: 'drawn' }), 'on a freshly sized layer', { cursor: true });

          // As a layer drawn before the preview would leave its own stroke, if
          // it set it outside a save; between frames the route would clear it.
          // What the preview hands back is read before this wrapper's own
          // restore, which would otherwise hide a style the preview leaked.
          frameAt(app, 0.5);
          let handedBack = null;
          drawing.renderPreview = function (ctx, ...args) {
            ctx.save();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 9;
            ctx.globalAlpha = 0.3;
            ctx.setLineDash([7, 3]);
            try {
              return Object.getPrototypeOf(drawing).renderPreview.call(this, ctx, ...args);
            } finally {
              handedBack = [ctx.strokeStyle, ctx.lineWidth, ctx.globalAlpha, ctx.getLineDash()];
              ctx.restore();
            }
          };
          // The preview's own save is still the last on the layer
          const poisoned = frameAt(app, 0.5, { state: 'drawn' });
          delete drawing.renderPreview;
          expect(poisoned).toContain('vector setLineDash [7,3]');
          expectPreviewInBlue(poisoned, 'after a layer that left another stroke', { cursor: true });
          expect(handedBack, 'the preview hands the layer back as it found it').toEqual(['#ff0000', 9, 0.3, [7, 3]]);

          // A third vertex adds the translucent fill, in the same blue
          app.eventBus.emit('area:draw-click', { imgX: 0.5, imgY: 0.6 });
          expect(drawing.vertices).toHaveLength(3);
          frameAt(app, 0.5);
          const withFill = frameAt(app, 0.5, { state: 'drawn' });
          expectPreviewInBlue(withFill, 'with three vertices', { cursor: true, vertices: 3 });
          expect(withFill.filter(line => line.endsWith('| fillStyle=rgba(15, 98, 254, 0.1) globalAlpha=0.8')),
            'the fill').toHaveLength(1);
        } finally {
          delete drawing.renderPreview;
          drawing.cancelDrawing();
        }
      });

    });

    describe('DEF-08: a beacon scales its marker whether or not the transport runs', () => {
      // Pop, grow and pulse beacons scale their waypoint's marker. The
      // renderer applied that scale only while the transport ran
      // (`isPlaying()`), so a scrubbed or paused editor, a video export (which
      // suspends the transport) and a paused player drew the marker at its
      // plain size. Open day's camera never zooms, so two frames at one
      // instant can differ only through the renderer, not through easing.
      const SCALING = new Map([['ex-uon-1', 'pop'], ['ex-uon-2', 'pulse'], ['ex-uon-3', 'grow']]);
      const VISIBILITY = ['always-show', 'hide-before', 'hide-after', 'hide-before-and-after'];

      function scalingFixture(waypointVisibility = null) {
        const fixture = fixtures().find(each => each.id === 'uon-open-day');
        for (const waypoint of fixture.project.waypoints) {
          if (SCALING.has(waypoint.id)) waypoint.beaconStyle = SCALING.get(waypoint.id);
        }
        if (waypointVisibility) fixture.project.motionSettings.waypointVisibility = waypointVisibility;
        return fixture;
      }

      function scaleOf(host, schedule) {
        const waypoint = host.waypoints.find(each => each.id === schedule.waypointId);
        return host.renderingService.getBeaconScaleOverride(waypoint)?.scale;
      }

      /** The same frame drawn with every beacon's scale withheld. */
      function unscaledFrame(host) {
        const withheld = vi.spyOn(host.renderingService, 'getBeaconScaleOverride').mockReturnValue(null);
        discardFrame();
        host.render();
        const frame = takeFrame(host);
        withheld.mockRestore();
        return frame;
      }

      /**
       * Wherever a beacon is scaling its marker — a quarter-second after its
       * arrival, and before it while the beacon owns the marker's reveal — a
       * frame scrubbed there draws that scale, and matches one played to it.
       */
      function expectPlayingDrawsScrubbed(host, label) {
        const engine = host.animationEngine;
        const offset = (engine.startHandleTime || 0) + (engine.introTime || 0);
        const schedules = engine.beaconSchedules.filter(schedule => SCALING.has(schedule.waypointId));
        expect(schedules.map(schedule => schedule.style).sort(), label).toEqual(['grow', 'pop', 'pulse']);
        const exercised = new Set();

        for (const schedule of schedules) {
          const instants = [schedule.arrivalMs + 250, (schedule.earlyOnsetStartMs + schedule.arrivalMs) / 2];
          for (const ms of instants) {
            const at = `${label}: ${schedule.style} at ${Math.round(ms)} ms`;
            const scrubbed = frameAt(host, (ms + offset) / engine.state.duration);
            const scale = scaleOf(host, schedule);
            if (scale === undefined || Math.abs(scale - 1) < 0.1) continue;
            exercised.add(schedule.style);
            engine.play();
            discardFrame();
            host.render();
            const playing = takeFrame(host);
            engine.pause();
            expect(differingLines(scrubbed, unscaledFrame(host)).length, `${at}: drawn`).toBeGreaterThan(0);
            expect(differingLines(scrubbed, playing).map(index => [scrubbed[index], playing[index]]), at).toEqual([]);
          }
        }
        expect([...exercised].sort(), `${label}: every beacon scaled somewhere`).toEqual(['grow', 'pop', 'pulse']);
      }

      test('in the editor and in preview', async () => {
        const app = await appWithFixture(scalingFixture());
        for (const mode of ['edit', 'preview']) {
          enterMode(app, mode);
          expectPlayingDrawsScrubbed(app, mode);
        }
      });

      test('on the export canvas and in the exported player', async () => {
        const { app, player } = await exportAndPlayer(scalingFixture());
        expectPlayingDrawsScrubbed(app, 'export');
        expectPlayingDrawsScrubbed(player, 'player');
      });

      test('in every waypoint-visibility mode, where hide-before lets a beacon reveal its marker', async () => {
        for (const visibility of VISIBILITY) {
          const app = await appWithFixture(scalingFixture(visibility));
          enterMode(app, 'preview');
          expectPlayingDrawsScrubbed(app, `preview, ${visibility}`);
          const { player } = await exportAndPlayer(scalingFixture(visibility));
          expectPlayingDrawsScrubbed(player, `player, ${visibility}`);
        }
      });

      test('a marker set to always hide stays hidden, playing or paused', async () => {
        // Beacons are not synced while markers are always hidden, so the
        // scale an earlier frame left must not bring a marker back. While
        // playing, it did.
        const app = await appWithFixture(scalingFixture());
        enterMode(app, 'preview');
        const engine = app.animationEngine;
        const offset = (engine.startHandleTime || 0) + (engine.introTime || 0);
        const pop = engine.beaconSchedules.find(schedule => schedule.style === 'pop');
        const waypoint = app.waypoints.find(each => each.id === pop.waypointId);
        const at = app.imageToCanvas(waypoint.imgX, waypoint.imgY);
        const marker = `vector arc ${Number(at.x.toFixed(3))} ${Number(at.y.toFixed(3))} `;
        const scaled = frameAt(app, (pop.arrivalMs + 250 + offset) / engine.state.duration);
        expect(scaled.filter(line => line.startsWith(marker))).toHaveLength(1);

        app.eventBus.emit('motion:waypoint-visibility-change', 'always-hide');
        engine.play();
        discardFrame();
        app.render();
        const playing = takeFrame(app);
        engine.pause();
        discardFrame();
        app.render();
        const paused = takeFrame(app);
        expect(app.renderingService.getBeaconScaleOverride(waypoint)).not.toBeNull();
        expect(playing.filter(line => line.startsWith(marker)), 'playing').toEqual([]);
        expect(paused.filter(line => line.startsWith(marker)), 'paused').toEqual([]);
      });

      test('a beacon that is no longer synced leaves its marker alone', async () => {
        // A beacon is cached per waypoint and only replaced when the waypoint
        // still has a style, so one whose style was undone to none, or one
        // held still for reduced motion, kept its last scale; now that the
        // scale applies at every instant, it would have stuck to the marker.
        const app = await appWithFixture(scalingFixture('hide-before'));
        enterMode(app, 'preview');
        const engine = app.animationEngine;
        const offset = (engine.startHandleTime || 0) + (engine.introTime || 0);
        const [pop, pulse] = ['pop', 'pulse'].map(style => engine.beaconSchedules.find(each => each.style === style));
        const setting = BeaconRenderer.prefersReducedMotion;
        try {
          // The pop, mid-scale, then its style undone to none
          const midScale = (pop.arrivalMs + 400 + offset) / engine.state.duration;
          frameAt(app, midScale);
          expect(Math.abs(scaleOf(app, pop) - 1)).toBeGreaterThan(0.1);
          app.waypoints.find(each => each.id === pop.waypointId).beaconStyle = 'none';
          const undone = frameAt(app, midScale);
          expect(differingLines(undone, unscaledFrame(app)), 'style undone').toEqual([]);

          // The pulse revealing its hidden marker, then reduced motion on
          const early = (pulse.earlyOnsetStartMs + pulse.arrivalMs) / 2;
          frameAt(app, (early + offset) / engine.state.duration);
          expect(scaleOf(app, pulse)).toBeGreaterThan(0);
          BeaconRenderer.prefersReducedMotion = true;
          const stilled = frameAt(app, (early + offset) / engine.state.duration);
          expect(differingLines(stilled, unscaledFrame(app)), 'reduced motion').toEqual([]);
        } finally {
          BeaconRenderer.prefersReducedMotion = setting;
        }
      });

    });

    describe('DEF-27: the tint covers the image, and the instant spotlight and angle of view follow the camera', () => {
      // The contrast tint filled the whole canvas, or with `fit: 'fit'` the
      // image's rectangle before the background zoom, and never under the
      // camera: at 50% background zoom it darkened the margin round the image,
      // and under the camera it stayed put while the image zoomed. The instant
      // spotlight and angle of view drew their image and mask with no camera,
      // while the route was zoomed, so the circle or cone sat away from the
      // head. The combination is supported (§20 Q17, accepted 2026-09-22):
      // each is now drawn under the image's transform, which is the one the
      // route is drawn under.

      /** The transform a call was made under, in a frame taken with `state: true`. */
      function transformOf(line) {
        return line.split(' @ ')[1].split(' | ')[0];
      }

      /** A rectangle call's last four arguments, and the transform it was made under. */
      function placement(line) {
        return { rect: line.split(' @ ')[0].split(' ').slice(-4).map(Number), transform: transformOf(line) };
      }

      /** The one line of a frame that `match` picks out. */
      function onlyLine(frame, match, label) {
        const lines = frame.filter(match);
        expect(lines, label).toHaveLength(1);
        return lines[0];
      }

      const isImage = line => line.startsWith('main drawImage [image ');

      /**
       * At every instant, the tint (-40, so drawn at alpha 0.4) fills exactly
       * the rectangle the image is drawn into, under exactly its transform.
       * Returns where the image is drawn at 0.5, where the camera is at its
       * authored 1.75×.
       */
      function expectTintOnTheImage(host, label) {
        let middle = null;
        for (const instant of INSTANTS) {
          const frame = frameAt(host, instant, { state: true });
          const image = placement(onlyLine(frame, isImage, `${label} at ${instant}: the image`));
          const tint = placement(onlyLine(frame, line => line.startsWith('main fillRect ')
            && / globalAlpha=0\.4( |$)/.test(line), `${label} at ${instant}: the tint`));
          expect(tint, `${label} at ${instant}`).toEqual(image);
          if (instant === 0.5) middle = image;
        }
        return middle;
      }

      for (const fit of ['fit', 'fill']) {
        test(`at 50% background zoom the tint covers exactly the image, under its camera (fit ${fit})`, async () => {
          // 'fill' has no control any more, but a project saved with it still
          // loads (`authored-extras` has it), and the image is drawn contained
          // whatever it says.
          const fixture = fixtures().find(each => each.id === 'authored-extras');
          fixture.project.background.fit = fit;
          fixture.project.background.overlay = -40;
          fixture.project.exportSettings.backgroundZoom = 50;
          const app = await appWithFixture(fixture);
          enterMode(app, 'edit');
          const edit = expectTintOnTheImage(app, 'edit');
          enterMode(app, 'preview');
          const preview = expectTintOnTheImage(app, 'preview');
          const { app: exporter, player } = await exportAndPlayer(fixture);
          const exported = expectTintOnTheImage(exporter, 'export');
          const played = expectTintOnTheImage(player, 'player');

          // Non-vacuity: at 50% the image leaves a margin on every side, which
          // a tint over the canvas or over the unzoomed image would darken,
          // and outside the editor it is drawn under the camera.
          const drawn = { edit, preview, export: exported, player: played };
          for (const [label, { rect: [x, y] }] of Object.entries(drawn)) {
            expect(Math.min(x, y), `${label}: the margin`).toBeGreaterThan(0);
          }
          expect(edit.transform).toBe('1 0 0 1 0 0');
          for (const { transform } of [preview, exported, played]) expect(transform).toMatch(/^1\.75 0 0 1\.75 /);
        });
      }

      /**
       * Where each path the vector layer strokes ends, with the transform it
       * is drawn under: the route's revealed path ends at the head.
       */
      function strokeEnds(frame) {
        const ends = [];
        let last = null;
        for (const line of frame) {
          const call = line.split(' @ ')[0];
          if (call === 'vector beginPath') last = null;
          else if (/^vector (moveTo|lineTo) /.test(call)) {
            last = `${call.split(' ').slice(-2).join(' ')} @ ${transformOf(line)}`;
          } else if (call === 'vector stroke' && last) ends.push(last);
        }
        return ends;
      }

      /**
       * At 0.5, where the camera is at its authored 1.75×, the image and the
       * mask that cuts it are drawn under one transform, the camera's, and the
       * route is drawn under it too; the mask's circle, or its cone's arc, is
       * centred where the route's path ends, so the mask stays on the head.
       */
      function expectMaskUnderTheCamera(host, label) {
        const frame = frameAt(host, 0.5, { state: true });
        const image = transformOf(onlyLine(frame, isImage, `${label}: the image`));
        const mask = transformOf(onlyLine(frame, line => line.startsWith('main fill @ ')
          && line.includes(' globalCompositeOperation=destination-in'), `${label}: the mask`));
        expect(image, `${label}: the image`).toMatch(/^1\.75 0 0 1\.75 /);
        expect(mask, `${label}: the mask`).toBe(image);
        const edge = onlyLine(frame, line => line.startsWith('main arc ')
          && line.includes(' globalCompositeOperation=destination-in'), `${label}: the mask's edge`);
        expect(transformOf(edge), `${label}: the mask's edge`).toBe(mask);
        const [x, y] = edge.split(' ').slice(2, 4);
        expect(strokeEnds(frame), `${label}: the route ends where the mask is centred`).toContain(`${x} ${y} @ ${mask}`);
      }

      for (const mode of [BACKGROUND_VISIBILITY.SPOTLIGHT, BACKGROUND_VISIBILITY.ANGLE_OF_VIEW]) {
        test(`the instant ${mode} draws its image and mask under the route's camera, in every host`, async () => {
          const fixture = fixtures().find(each => each.id === 'authored-extras');
          fixture.project.motionSettings.backgroundVisibility = mode;
          const app = await appWithFixture(fixture);
          enterMode(app, 'preview');
          expect(app.motionSettings.backgroundVisibility).toBe(mode);
          expectMaskUnderTheCamera(app, 'preview');

          const { app: exporter, player } = await exportAndPlayer(fixture);
          for (const [label, host] of [['export', exporter], ['player', player]]) {
            expect(host.motionSettings.backgroundVisibility, label).toBe(mode);
            expectMaskUnderTheCamera(host, label);
          }
          // Each host has drawn at 0.5 since its first frame, and a seek of
          // more than a twentieth of the route snaps the camera
          // (`CameraService`), so no instant here is left easing: the player
          // must draw what the export canvas draws at every one.
          for (const instant of INSTANTS) {
            expect(differingLines(frameAt(exporter, instant), frameAt(player, instant)), `instant ${instant}`)
              .toEqual([]);
          }
        });
      }

      for (const mode of [BACKGROUND_VISIBILITY.SPOTLIGHT, BACKGROUND_VISIBILITY.ANGLE_OF_VIEW]) {
        test(`with the camera on but within a thousandth of 1×, as it is while it settles, the instant ${mode}'s image, its mask and the tint are drawn as with the camera off`, async () => {
          // While the camera eases back to 1× it stays on, its zoom within a
          // thousandth of 1× and its centre still away from the canvas's
          // (`CameraService.calculateCameraState`): the image is then drawn
          // without it, and so must the mask and the tint be, or they would
          // be moved off the image by the camera's pan.
          const fixture = fixtures().find(each => each.id === 'authored-extras');
          fixture.project.motionSettings.backgroundVisibility = mode;
          fixture.project.background.overlay = -40;
          const app = await appWithFixture(fixture);
          enterMode(app, 'preview');
          const drawnWith = (camera) => {
            const calculated = vi.spyOn(app, '_calculateCameraState').mockReturnValue(camera);
            try {
              const frame = frameAt(app, 0.5, { state: true });
              return {
                image: placement(onlyLine(frame, isImage, 'the image')),
                tint: placement(onlyLine(frame, line => line.startsWith('main fillRect ')
                  && / globalAlpha=0\.4( |$)/.test(line), 'the tint')),
                mask: transformOf(onlyLine(frame, line => line.startsWith('main fill @ ')
                  && line.includes(' globalCompositeOperation=destination-in'), 'the mask')),
              };
            } finally {
              calculated.mockRestore();
            }
          };
          const settling = drawnWith({ zoom: 1.0005, centerX: 100, centerY: 80, enabled: true });
          const off = drawnWith({ zoom: 1, centerX: 330, centerY: 330, enabled: false });
          expect(settling).toEqual(off);
          expect(settling.tint).toEqual(settling.image);
          expect(settling.mask).toBe(settling.image.transform);
        });
      }

    });

  });

  describe('the one expected difference', () => {

    test('a camera project\'s first frame differs only by the easing', async () => {
      // Not a defect, and stated so it cannot be mistaken for one later. The
      // editor eases its camera toward the authored centre over several
      // frames (`CameraService.js:110-129`) and a freshly loaded player starts
      // on it, so the instant a project is opened at is the one frame where
      // the two legitimately disagree — and only in the camera transform.
      const fixture = fixtures().find(each => each.id === 'authored-extras');
      const { app, player } = await exportAndPlayer(fixture);
      const TRANSLATION = /^(main|vector) translate /;
      const translations = frame => frame.filter(line => TRANSLATION.test(line));

      const appFirst = frameAt(app, 0);
      const playerFirst = frameAt(player, 0);
      const atZero = differingLines(appFirst, playerFirst);
      expect(atZero.length).toBeGreaterThan(0);
      for (const index of atZero) expect(appFirst[index]).toMatch(TRANSLATION);

      // A size could hide in a translation, so each host must translate
      // exactly as it does at Graphics scale 1 rather than the authored 1.6.
      const unscaled = fixtures().find(each => each.id === 'authored-extras');
      unscaled.project.styles.graphicsScale = 1;
      const plain = await exportAndPlayer(unscaled);
      expect(translations(frameAt(plain.app, 0))).toEqual(translations(appFirst));
      expect(translations(frameAt(plain.player, 0))).toEqual(translations(playerFirst));

      for (const instant of INSTANTS.slice(1)) {
        expect(differingLines(frameAt(app, instant), frameAt(player, instant)),
          `instant ${instant}`).toEqual([]);
      }
    });

  });

});
