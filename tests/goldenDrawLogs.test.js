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
 * camera zooms, area highlights and a path-only export.
 *
 * Two invariants come with them. `play == seek`: reaching an instant by
 * stepping the engine must draw exactly what seeking to it draws, both on the
 * host that played and on one that never did. And `app == player`: the
 * exported HTML player must draw what the export canvas draws — for every
 * fixture, and after an anchored crowd node's waypoint has moved, which it did
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
import { describe, test, expect } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { freezeClock, loadSnapshot } from './helpers/projectSnapshot.js';
import { differingLines, discardFrame, frameAt, setUpFrame, takeFrame } from './helpers/drawLog.js';
import { authoredExtrasProject } from './fixtures/authoredExtras.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { loadExampleBackground } from '../src/app/backgroundLoading.js';
import { PlayerApp } from '../src/player/PlayerApp.js';

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
        // `authored-extras` is excluded and tested below instead: it is the
        // only fixture with a graphics scale, which the player drops, and the
        // only one with a camera, whose easing makes its very first frame a
        // transient rather than a picture.
        if (fixture.id === 'authored-extras') return;
        const { app, player } = await exportAndPlayer(fixture);

        for (const instant of INSTANTS) {
          expect(differingLines(frameAt(app, instant), frameAt(player, instant)),
            `instant ${instant}`).toEqual([]);
        }
      });

    });
  }

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

  });

  describe('the known failures', () => {

    test('DEF-34 (proposed): the exported player ignores Graphics scale', async () => {
      // `RenderingService` keeps the graphics-scale multiplier on itself
      // (`RenderingService.js:83,141`) and only the editor's slider and undo
      // restore ever call `setGraphicsScale` (`wiringDom.js:736`,
      // `undoRedo.js:444`). `PlayerApp` never does — it holds
      // `styles.graphicsScale` and draws as though it were 1 — so a project
      // authored at any other graphics scale exports to video correctly and to
      // HTML at the wrong size. Found here; not in the plan; proposed to Joe.
      const fixture = fixtures().find(each => each.id === 'authored-extras');
      const { app, player } = await exportAndPlayer(fixture);
      expect(app.styles.graphicsScale).toBe(1.6);
      expect(player.styles.graphicsScale).toBe(1.6);
      expect(app.renderingService._graphicsScale).toBe(1.6);
      expect(player.renderingService._graphicsScale).toBe(1);

      const appFrame = frameAt(app, 0.5);
      const playerFrame = frameAt(player, 0.5);
      const differences = differingLines(appFrame, playerFrame);
      expect(differences.length).toBeGreaterThan(20);

      // Every difference is a *size*, and each one is out by exactly the
      // graphics scale — not some other divergence that happens to show up
      // here. Nothing else about the two frames differs: not a coordinate, not
      // a colour, not the order of a single call.
      const operationOf = (line) => line.split(' ')[1];
      expect([...new Set(differences.map(index => operationOf(appFrame[index])))].sort())
        .toEqual(['arc', 'rect', 'set:lineWidth', 'setLineDash']);

      /** The one argument each of those operations scales. */
      const sizeOf = (line) => {
        const parts = line.split(' ');
        if (parts[1] === 'arc') return Number(parts[4]);            // radius
        if (parts[1] === 'rect') return Number(parts[4]);           // width
        if (parts[1] === 'setLineDash') return Number(parts[2].replace('[', '').split(',')[0]);
        return Number(parts.at(-1));                                 // lineWidth
      };
      for (const index of differences) {
        // Three decimals of tolerance, because the transcript rounds to three.
        expect(sizeOf(appFrame[index]) / sizeOf(playerFrame[index]),
          `${appFrame[index]} vs ${playerFrame[index]}`).toBeCloseTo(1.6, 3);
      }
    });

    test.todo('DEF-34: the exported player draws at the authored Graphics scale');

    test('a camera project\'s first frame differs only by the easing', async () => {
      // Not a defect, and stated so it cannot be mistaken for one later. The
      // editor eases its camera toward the authored centre over several
      // frames (`CameraService.js:110-129`) and a freshly loaded player starts
      // on it, so the instant a project is opened at is the one frame where
      // the two legitimately disagree — and only in the camera transform.
      const fixture = fixtures().find(each => each.id === 'authored-extras');
      fixture.project.styles.graphicsScale = 1; // isolate from DEF-34 above
      const { app, player } = await exportAndPlayer(fixture);

      const atZero = differingLines(frameAt(app, 0), frameAt(player, 0));
      const first = frameAt(app, 0);
      expect(atZero.length).toBeGreaterThan(0);
      for (const index of atZero) expect(first[index]).toMatch(/^(main|vector) translate /);

      for (const instant of INSTANTS.slice(1)) {
        expect(differingLines(frameAt(app, instant), frameAt(player, instant)),
          `instant ${instant}`).toEqual([]);
      }
    });

  });

});
