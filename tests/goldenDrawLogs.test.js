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
      // differ from that, because the layer's styles carry from one frame to
      // the next (DEF-39, proposed); that is older than this, and not its
      // subject.
      //
      // A browser throws from a context call given a bad argument (an `arc`
      // with a negative radius, a gradient given NaN, DEF-26's colour), so the
      // throw is injected at a call on the vector layer's context. Every save
      // the frame makes is tried at its `restore`, the latest point inside
      // it, which leaves its whole body behind. The error must still reach the
      // caller, which reports it (DEF-26).

      /** The instant at which `authored-extras`'s first ripple is still drawing. */
      const BEACON_INSTANT = 0.005;

      /** The calls a frame makes on the vector layer's context, in order. */
      function vectorCalls(frame) {
        // A `set:` is a property, not a call, and an `addColorStop` is a gradient's.
        return frame.filter(line => line.startsWith('vector ') && !/^vector (set:|canvas\.|\[gradient )/.test(line));
      }

      /** Where those calls `restore`, by their index among them. */
      function restoreCalls(frame) {
        return vectorCalls(frame).flatMap((line, index) => (line.startsWith('vector restore') ? [index] : []));
      }

      /** How deep the vector layer's saves nest in a frame. */
      function deepestSave(frame) {
        let depth = 0;
        let deepest = 0;
        for (const line of frame) {
          if (line.startsWith('vector save')) deepest = Math.max(deepest, ++depth);
          else if (line.startsWith('vector restore')) depth -= 1;
        }
        return deepest;
      }

      /**
       * Render a frame whose vector-layer call `index` throws (none, for -1).
       * Returns how many calls the frame made on that context, and whether
       * the error reached the caller.
       */
      function renderThrowingAt(host, index) {
        const context = host.renderingService.vectorCanvas.getContext('2d');
        const thrown = new Error(`vector call ${index} throws`);
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
        expect(deepestSave(fresh)).toBeGreaterThanOrEqual(2);
        if (beacon) expect(beaconSaves).toBeGreaterThan(0);

        // A throw is placed by counting calls, so the count must be the
        // transcript's, or the throws below would land beside the restores.
        expect(renderThrowingAt(host, -1).calls).toBe(vectorCalls(fresh).length);

        const throwAt = restoreCalls(fresh);
        expect(throwAt.length).toBeGreaterThanOrEqual(2);
        for (const index of throwAt) {
          expect(renderThrowingAt(host, index).threw,
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
