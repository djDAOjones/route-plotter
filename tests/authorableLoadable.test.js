/**
 * TST-06 — authorable ⇒ loadable (part 2 of 2).
 *
 * The invariant: anything the app's own interface can author must survive a
 * save and a load. It is not held today — DEF-04 breaks it, and loses a
 * user's work — so this file does three things. The property tests state the
 * invariant over the controls where it *does* hold; the known failures are
 * characterised exactly as they behave now, each with a `todo` naming the fix
 * that will replace it; and the fixed ones (DEF-03, DEF-31, DEF-37) keep
 * their regressions.
 *
 * "Authorable" is taken literally: the controls are the real `<input>` and
 * `<select>` elements of the shipped shell, driven through the real wiring on
 * a booted app (TST-01). Sampling a model field's bounds instead would only
 * ask the loader to agree with itself, and most sliders are UI-scale values
 * the wiring converts — 0–1000 on screen is not 0–1000 in the model.
 *
 * What this does **not** cover, and a later wave should: checkboxes, colour
 * and number inputs, the outline forms, uploads, undo/redo, the modal tools,
 * and pointer gestures other than the three below. Crowd and network controls
 * are present but inert in this fixture, which the coverage test names rather
 * than hides.
 *
 * Part 1 is `tests/projectSnapshotShape.test.js`.
 */

import { describe, test, expect, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole, recordedConsole } from './helpers/consoleGuard.js';
import {
  comparableSnapshot, freezeClock, loadSnapshot, LOAD_REFUSED,
} from './helpers/projectSnapshot.js';
import { PROJECT_MODEL_LIMITS } from '../src/app/persistence.js';
import { IMAGE_COORDINATES } from '../src/config/constants.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { CoordinateTransform } from '../src/services/CoordinateTransform.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { DotRenderer } from '../src/services/DotRenderer.js';
import { setUpFrame, frameAt } from './helpers/drawLog.js';

/**
 * A booted app with enough route for the per-waypoint controls to act on.
 *
 * Two waits matter. `app.ready` is the end of startup — before it, pointer
 * interaction is still disabled. And the speed slider ignores input for 50 ms
 * after a programmatic update (`UIController.js:833-840`), one of which
 * happens during startup; without the pause it would look inert on a fast
 * machine and live on a slow one.
 */
async function bootWithRoute({ waypoints = 3 } = {}) {
  const app = await bootApp();
  await app.ready;
  await new Promise(resolve => setTimeout(resolve, 80));
  for (let index = 0; index < waypoints; index += 1) {
    app.eventBus.emit('waypoint:add', {
      imgX: 0.2 + index * 0.25,
      imgY: 0.35 + (index % 2) * 0.2,
      isMajor: true,
    });
  }
  return app;
}

/** Every range control in the shipped shell. */
function ranges() {
  return [...document.querySelectorAll('input[type="range"]')];
}

/** Every select in the shipped shell that offers a choice. */
function selects() {
  return [...document.querySelectorAll('select')].filter(select => select.options.length > 1);
}

function applyValue(control, value) {
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Why the loader refused, taken from the warning it prints.
 *
 * A refusal test that only asserts `false` would pass on any failure at all,
 * including one the test introduced itself, so each one names its reason.
 */
function refusalReason() {
  const refusals = recordedConsole().filter(entry => LOAD_REFUSED.test(entry));
  expect(refusals).toHaveLength(1);
  return refusals[0];
}

/**
 * The controls that cannot change the saved project in this fixture.
 *
 * Crowd and network controls need a selected crowd or edge, and adding one
 * moves the selection off the waypoint, which would silence every per-waypoint
 * control instead. The timeline scrubber is transport, and transport is
 * deliberately not persisted. Named rather than counted, so a control that
 * falls silent for some *other* reason fails this test.
 */
const SLIDERS_INERT_WITHOUT_A_CROWD = [
  'crowd-dot-size', 'crowd-wobble', 'crowd-count', 'crowd-release-start',
  'crowd-release-duration', 'crowd-onset-variance', 'crowd-intensity-ramp',
  'crowd-speed', 'crowd-speed-variance', 'network-edge-weight',
  'timeline-slider',
];

/**
 * The same, for the selects. The last two are the scene outline's "add a
 * waypoint after X, as a major or a minor" form: they configure a pending
 * action rather than editing the model, so leaving the project untouched is
 * correct. The outline builds them without ids, so they are named by the
 * `data-outline-key` it stamps on them.
 */
const SELECTS_INERT_WITHOUT_A_CROWD = [
  'crowd-guide-type', 'crowd-lifecycle', 'network-node-type',
  'network-edge-direction', 'route:add-after', 'route:add-kind',
];

/** A select's id, or the outline key it carries instead. */
function selectName(select) {
  return select.id || select.dataset.outlineKey || '(unnamed select)';
}

/** Deterministic PRNG, so a failing seed is a reproducible failing seed. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('what the UI can author, a load must accept (TST-06)', () => {

  // The clock is frozen so that moving a control is the only thing that can
  // change a snapshot: every `update()` restamps `modified` with `Date.now()`.
  freezeClock();

  for (const extreme of ['min', 'max']) {
    test(`every slider at its ${extreme} saves a project that loads`, async () => {
      const app = await bootWithRoute();
      const controls = ranges();
      // A shell that stopped shipping its controls would make this vacuous.
      expect(controls.length).toBeGreaterThan(40);

      for (const control of controls) {
        const bound = control.getAttribute(extreme);
        expect(bound, `${control.id} has no ${extreme}`).not.toBeNull();
        applyValue(control, bound);
      }

      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(true);
    });
  }

  // Three seeds rather than one: a single arrangement of the controls can pass
  // by luck, and a random seed per run would turn a real failure into a flake.
  for (const seed of [1, 20260923, 777]) {
    test(`a random setting of every control saves a project that loads (seed ${seed})`, async () => {
      const random = mulberry32(seed);
      const app = await bootWithRoute({ waypoints: 4 });

      for (const control of ranges()) {
        const min = Number(control.min === '' ? 0 : control.min);
        const max = Number(control.max === '' ? 100 : control.max);
        applyValue(control, String(min + random() * (max - min)));
      }
      for (const control of selects()) {
        applyValue(control, control.options[Math.floor(random() * control.options.length)].value);
      }

      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(true);
    });
  }

  test('each slider is shown, on its own, to reach the saved project', async () => {
    // The passes above dispatch to every control at once, which would prove
    // nothing if the events went nowhere. Here each slider is swept from its
    // own minimum to its own maximum and the snapshot compared across just
    // that move, so one control cannot stand in for another.
    const app = await bootWithRoute();

    const inert = [];
    for (const control of ranges()) {
      applyValue(control, control.min);
      const low = JSON.stringify(comparableSnapshot(app._buildProjectSnapshot()));
      applyValue(control, control.max);
      const high = JSON.stringify(comparableSnapshot(app._buildProjectSnapshot()));
      if (low === high) inert.push(control.id);
    }

    expect(inert).toEqual(SLIDERS_INERT_WITHOUT_A_CROWD);
    expect(ranges().length - inert.length).toBeGreaterThanOrEqual(38);
  });

  test('each select is shown, on its own, to reach the saved project', async () => {
    // The same guarantee for the mode choosers, which are where the visibility
    // behaviour lives: a select is walked through every one of its options and
    // must produce at least two different saved projects.
    const app = await bootWithRoute();

    const inert = [];
    for (const select of selects()) {
      const saved = new Set();
      for (const option of select.options) {
        applyValue(select, option.value);
        saved.add(JSON.stringify(comparableSnapshot(app._buildProjectSnapshot())));
      }
      if (saved.size < 2) inert.push(selectName(select));
    }

    expect(inert).toEqual(SELECTS_INERT_WITHOUT_A_CROWD);
    expect(selects().length - inert.length).toBeGreaterThanOrEqual(14);
  });

  describe('DEF-03: points authored off the image reload', () => {

    // Below 100% background zoom `screenToImage` deliberately returns the
    // canvas margin round the image as coordinates outside 0–1
    // (`viewport.js:257-262`), and a click, a drag or a polygon vertex there
    // is an ordinary thing to do while zoomed out. Until DEF-03 the loader
    // refused anything outside 0–1, so the project, its autosave and the
    // exported player's copy of the route were all lost.

    test('a waypoint authored outside the image at 50% zoom loads again', async () => {
      const app = await bootWithRoute({ waypoints: 1 });
      app.exportSettings.backgroundZoom = 50;
      app.eventBus.emit('waypoint:add', { imgX: 1.35, imgY: -0.2, isMajor: true });
      expect(app.waypoints.map(waypoint => [waypoint.imgX, waypoint.imgY])).toEqual([[0.2, 0.35], [1.35, -0.2]]);

      // Was refused: "Invalid waypoint at index 1".
      const saved = app._buildProjectSnapshot();
      expect(await loadSnapshot(app, saved)).toBe(true);
      expect(app.waypoints.map(waypoint => [waypoint.imgX, waypoint.imgY])).toEqual([[0.2, 0.35], [1.35, -0.2]]);
      expect(comparableSnapshot(app._buildProjectSnapshot())).toEqual(comparableSnapshot(saved));
    });

    test('a polygon drawn outside the image at 50% zoom loads again', async () => {
      const app = await bootWithRoute({ waypoints: 1 });
      app.exportSettings.backgroundZoom = 50;
      const drawing = app.areaDrawingService;
      drawing.startDrawing(app.waypoints[0]);
      drawing._placeVertex(-0.3, 0.2);
      drawing._placeVertex(1.4, 0.3);
      drawing._placeVertex(0.5, 1.6);
      drawing._completePolygon();
      const drawn = [{ x: -0.3, y: 0.2 }, { x: 1.4, y: 0.3 }, { x: 0.5, y: 1.6 }];
      expect(app.waypoints[0].areaHighlight.points).toEqual(drawn);

      // Was refused: "Invalid waypoint polygon point at index 0".
      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(true);
      expect(app.waypoints[0].areaHighlight.points).toEqual(drawn);
    });

    test('an area highlight on a waypoint off the image loads again', async () => {
      // Choosing a shape centres the new area on its waypoint
      // (`UIController.js:1331-1335`), so an off-image waypoint gives its area
      // an off-image centre, which load refused as well ("Waypoint area
      // centerX is outside the supported range").
      const app = await bootWithRoute({ waypoints: 1 });
      app.exportSettings.backgroundZoom = 50;
      app.eventBus.emit('waypoint:add', { imgX: 1.35, imgY: -0.2, isMajor: true });
      const offImage = app.waypoints.find(waypoint => waypoint.imgX === 1.35);
      expect(app.selectedWaypoint).toBe(offImage);
      applyValue(document.getElementById('area-shape'), 'circle');
      expect([offImage.areaHighlight.centerX, offImage.areaHighlight.centerY]).toEqual([1.35, -0.2]);

      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(true);
      const reloaded = app.waypoints.find(waypoint => waypoint.id === offImage.id);
      expect([reloaded.areaHighlight.centerX, reloaded.areaHighlight.centerY]).toEqual([1.35, -0.2]);
    });

    test('the exported player keeps a waypoint authored outside the image', async () => {
      // The player validates each waypoint on its own and silently dropped the
      // ones outside 0–1 (`PlayerApp.js:140-142`), so the exported route lost
      // them without a word while the project itself refused to open.
      const app = await bootWithRoute({ waypoints: 2 });
      app.exportSettings.backgroundZoom = 50;
      app.eventBus.emit('waypoint:add', { imgX: -0.4, imgY: 1.3, isMajor: true });
      const project = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));

      const player = new PlayerApp(document.createElement('canvas'));
      await player.load(project, null);
      expect(player.waypoints.map(waypoint => [waypoint.imgX, waypoint.imgY]))
        .toEqual(app.waypoints.map(waypoint => [waypoint.imgX, waypoint.imgY]));
      expect(player.waypoints).toHaveLength(3);
    });

    test('load takes the whole range and nothing past it', async () => {
      allowConsole(LOAD_REFUSED);
      const app = await bootWithRoute({ waypoints: 2 });
      const { MIN, MAX } = IMAGE_COORDINATES;
      const withFirstAt = (imgX, imgY) => {
        const project = app._buildProjectSnapshot();
        Object.assign(project.waypoints[0], { imgX, imgY });
        return project;
      };

      expect(await loadSnapshot(app, withFirstAt(MIN, MAX))).toBe(true);
      expect(await loadSnapshot(app, withFirstAt(MAX, MIN))).toBe(true);
      expect(await loadSnapshot(app, withFirstAt(MIN - 0.001, 0.5))).toBe(false);
      expect(refusalReason()).toContain('Invalid waypoint at index 0');
    });

    test('authoring stops where load does, so the extremes reload too', async () => {
      // A drag follows the captured pointer off the canvas and off the window,
      // and a held arrow key nudges without end, so zoomed out nothing bounded
      // a point at all. It now stops at the range load accepts, which lies far
      // outside the visible canvas.
      const app = await bootWithRoute({ waypoints: 3 });
      app.exportSettings.backgroundZoom = 50;
      const { MIN, MAX } = IMAGE_COORDINATES;
      const [first, second, third] = app.waypoints;

      app.eventBus.emit('waypoint:position-changed', { waypoint: first, imgX: -40, imgY: 55, isDragging: true });
      app.eventBus.emit('waypoint:drag-ended', { waypoint: first });
      expect([first.imgX, first.imgY]).toEqual([MIN, MAX]);

      for (let press = 0; press < 12; press += 1) {
        app.eventBus.emit('waypoint:nudge', { waypoint: second, dxFraction: 1, dyFraction: -1 });
      }
      expect([second.imgX, second.imgY]).toEqual([MAX, MIN]);

      // A group moves by one delta that keeps every member inside, so the
      // lowest member stops exactly on the edge and the shape is kept.
      const group = [second, third].map(waypoint => ({ waypoint, imgX: waypoint.imgX, imgY: waypoint.imgY }));
      const gap = third.imgX - second.imgX;
      app.eventBus.emit('waypoint:position-changed', {
        waypoint: third, imgX: -80, imgY: third.imgY, dragGroup: group, isDragging: true,
      });
      app.eventBus.emit('waypoint:drag-ended', { waypoint: third, dragGroup: group });
      expect(Math.min(second.imgX, third.imgX)).toBeGreaterThanOrEqual(MIN);
      expect(Math.min(second.imgX, third.imgX)).toBeCloseTo(MIN, 12);
      expect(third.imgX - second.imgX).toBeCloseTo(gap, 9);

      const before = new Set(app.waypoints);
      app.eventBus.emit('waypoint:add', { imgX: 70, imgY: -70, isMajor: true });
      const added = app.waypoints.find(waypoint => !before.has(waypoint));
      expect([added.imgX, added.imgY]).toEqual([MAX, MIN]);

      // The leg "+" handle inserts on the path midpoint, which a curved leg
      // can carry past its endpoints.
      app.eventBus.emit('waypoint:insert-on-leg', { waypointIndex: 0, imgX: 50, imgY: -50 });
      expect([app.waypoints[1].imgX, app.waypoints[1].imgY]).toEqual([MAX, MIN]);

      // A branch starts wherever its first waypoint is clicked, and that click
      // is limited only to the canvas surface.
      app.interactionHandler.branchArmed = first;
      app.eventBus.emit('route:branch-place', { imgX: -40, imgY: 55 });
      const branch = app.waypoints.find(waypoint => waypoint.branchFrom === first.id);
      expect([branch.imgX, branch.imgY]).toEqual([MIN, MAX]);

      app.areaDrawingService.startDrawing(first);
      app.areaDrawingService._placeVertex(-30, 0.5);
      app.areaDrawingService._placeVertex(0.5, 30);
      app.areaDrawingService._placeVertex(30, -30);
      app.areaDrawingService._completePolygon();
      expect(first.areaHighlight.points).toEqual([{ x: MIN, y: 0.5 }, { x: 0.5, y: MAX }, { x: MAX, y: MIN }]);

      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(true);
    });

    test('a group dragged to the edge stops exactly on it', async () => {
      // The shared delta keeps the group's shape, but start + (edge − start)
      // is not always the edge in floating point: from −9.12976462053035 it is
      // 11.000000000000002, one step past MAX, which load would refuse.
      const app = await bootWithRoute({ waypoints: 2 });
      app.exportSettings.backgroundZoom = 50;
      const [first] = app.waypoints;
      first.imgX = -9.12976462053035;
      const group = [{ waypoint: first, imgX: first.imgX, imgY: first.imgY }];

      app.eventBus.emit('waypoint:position-changed', {
        waypoint: first, imgX: 500, imgY: first.imgY, dragGroup: group, isDragging: true,
      });
      app.eventBus.emit('waypoint:drag-ended', { waypoint: first, dragGroup: group });
      expect(first.imgX).toBe(IMAGE_COORDINATES.MAX);
      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(true);
    });

    test('the range covers the whole canvas at 50% zoom, every preset, images up to 5:1', () => {
      // Measured with the real transform rather than restated, so narrowing
      // the range fails here: a 3.2:1 panorama on the 9:16 preset already puts
      // the canvas edge at y = −5.2, and a 5:1 one at y = −8.4.
      const { MIN, MAX } = IMAGE_COORDINATES;
      const presets = [[1920, 1080], [1080, 1080], [1080, 1920]];
      const images = [[5000, 1000], [1000, 5000], [3200, 1000], [1000, 3200], [1600, 1200]];
      let farthest = 0;
      for (const [canvasWidth, canvasHeight] of presets) {
        for (const [imageWidth, imageHeight] of images) {
          for (const fitMode of ['fit', 'fill']) {
            const transform = new CoordinateTransform();
            transform.setCanvasDimensions(canvasWidth, canvasHeight);
            transform.setImageDimensions(imageWidth, imageHeight, fitMode);
            transform.setBackgroundZoom(0.5);
            for (const corner of [[0, 0], [canvasWidth, canvasHeight]]) {
              const point = transform.canvasToImage(...corner);
              for (const value of [point.x, point.y]) {
                expect(value).toBeGreaterThanOrEqual(MIN);
                expect(value).toBeLessThanOrEqual(MAX);
                farthest = Math.max(farthest, Math.abs(value - 0.5));
              }
            }
          }
        }
      }
      // Non-vacuity: the widest cases really do reach far into the range.
      expect(farthest).toBeGreaterThan(8);
    });

  });

  describe('the known failures (W2 fixes each one)', () => {

    test('DEF-04: a polygon drawn past 256 vertices will not load', async () => {
      allowConsole(LOAD_REFUSED);
      const app = await bootWithRoute({ waypoints: 1 });
      // `AreaDrawingService._placeVertex` appends without a bound, while the
      // loader refuses more than `MAX_AREA_POINTS_PER_WAYPOINT`
      // (`persistence.js:278-279`). The outline path checks the same budget
      // (`sceneOutline.js:921`); the pointer path does not.
      const drawing = app.areaDrawingService;
      drawing.startDrawing(app.waypoints[0]);
      // A vertex within `DRAW_CLOSE_THRESHOLD` (0.02) of the first closes the
      // polygon, so the first is placed in the middle and the rest zig-zag
      // along the top and bottom edges, never coming near it.
      drawing._placeVertex(0.5, 0.5);
      for (let index = 0; index < 299; index += 1) {
        drawing._placeVertex(0.05 + (index / 298) * 0.9, 0.05 + (index % 2) * 0.9);
      }
      drawing._completePolygon();
      expect(app.waypoints[0].areaHighlight.points).toHaveLength(300);

      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(false);
      expect(refusalReason()).toContain('Waypoint polygon-point limit is 256');
    });

    test.todo('DEF-04: a polygon drawn past 256 vertices loads again');

    test('DEF-04: a label typed past 100,000 characters will not load', async () => {
      allowConsole(LOAD_REFUSED);
      const app = await bootWithRoute({ waypoints: 1 });
      // The same class as the polygon above, on a different control: the label
      // field carries no `maxlength` (`index.html:315`) and its handler copies
      // the whole value into the model (`wiringDom.js:457-475`), while the
      // loader refuses any string past `MAX_STRING_LENGTH`
      // (`persistence.js:119-121`). Found by Codex during the TST-06 review;
      // the DEF-04 plan row is annotated with it.
      const label = document.getElementById('waypoint-label');
      applyValue(label, 'x'.repeat(PROJECT_MODEL_LIMITS.MAX_STRING_LENGTH + 1));
      expect(app.selectedWaypoint.label.length).toBe(PROJECT_MODEL_LIMITS.MAX_STRING_LENGTH + 1);

      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(false);
      expect(refusalReason()).toContain('Project contains an oversized text value');
    });

    test.todo('DEF-04: a label typed past 100,000 characters loads again');

  });

  describe('DEF-31: a traced crowd reloads', () => {

    test('tracing a route with long waypoint ids loads again', async () => {
      const app = await bootWithRoute({ waypoints: 0 });
      // Ids up to 256 characters load (`entityId.js:6`), so a project can
      // legitimately carry them — this one is given them the way a load would.
      // `traceRouteIntoGraph` used to build derived ids as `gn_trace_<id>` and
      // `ge_trace_<from>__<to>`, which overshot the same limit, so "Trace
      // route into crowd" produced a project the app could no longer open
      // ("Invalid graph node id").
      const project = {
        coordVersion: 9,
        waypoints: [
          { id: `wp_${'a'.repeat(250)}`, imgX: 0.2, imgY: 0.5, isMajor: true },
          { id: `wp_${'b'.repeat(250)}`, imgX: 0.8, imgY: 0.5, isMajor: true },
        ],
      };
      expect(await loadSnapshot(app, project)).toBe(true);
      expect(app.waypoints.map(waypoint => waypoint.id.length)).toEqual([253, 253]);

      app.addCrowd({ enterNetworkEditor: false });
      expect(app.traceRouteIntoCrowd(app.selectedCrowd)).toBe(true);
      const { graph } = app._buildProjectSnapshot().scene.flowLayers[0];
      const ids = [...graph.nodes, ...graph.edges].map(each => each.id);
      expect(ids).toHaveLength(3);
      expect(ids.every(id => id.length <= PROJECT_MODEL_LIMITS.MAX_ENTITY_ID_LENGTH)).toBe(true);

      // Was refused: "Invalid graph node id".
      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(true);
      // The mapping survives: each node still follows its own waypoint, and
      // the leg between them is still there.
      const reloaded = app.scene.getFlowLayers()[0].graph;
      expect(reloaded.getNodes().map(node => node.anchorWaypointId))
        .toEqual(app.waypoints.map(waypoint => waypoint.id));
      expect(reloaded.getEdges()).toHaveLength(1);
      expect(app.anchorReport).toEqual({ bound: 2, broken: [] });
    });

  });

  describe('DEF-41: a traced bend off the image reloads', () => {

    test('a crowd traced through a minor waypoint off the image keeps its bend there, and reloads', async () => {
      const app = await bootWithRoute({ waypoints: 0 });
      const project = {
        coordVersion: 9,
        waypoints: [
          { id: 'wp-a', imgX: 0.3, imgY: 0.5, isMajor: true },
          { id: 'wp-bend', imgX: 1.25, imgY: 0.15, isMajor: false },
          { id: 'wp-b', imgX: 1.6, imgY: 0.5, isMajor: true },
        ],
      };
      expect(await loadSnapshot(app, project)).toBe(true);

      app.addCrowd({ enterNetworkEditor: false });
      expect(app.traceRouteIntoCrowd(app.selectedCrowd)).toBe(true);
      const saved = app._buildProjectSnapshot();
      expect(saved.scene.flowLayers[0].graph.edges[0].controlPoints).toEqual([{ x: 1.25, y: 0.15 }]);

      // Widening the model alone would have saved a project load refuses.
      expect(await loadSnapshot(app, saved)).toBe(true);
      expect(app.scene.getFlowLayers()[0].graph.getEdges()[0].controlPoints).toEqual([{ x: 1.25, y: 0.15 }]);
    });

    test('the network pen places and drags on the image only', async () => {
      // Its pointer positions are held to the image before any bend or node
      // is made; the model no longer holds a bend there itself.
      const app = await bootWithRoute({ waypoints: 0 });
      // Zoomed out, the canvas shows past the image's edges, and a pointer
      // there reads as a point off the image.
      app.exportSettings.backgroundZoom = 50;
      expect(app.screenToImage(-100000, 100000).x).toBeLessThan(0);
      const far = app._networkImgPos(-100000, 100000);
      const farther = app._networkImgPos(100000, -100000);

      expect([far, farther]).toEqual([{ x: 0, y: 1 }, { x: 1, y: 0 }]);
    });

    test('a bend past the range a project can store is refused, as a waypoint there is', async () => {
      const app = await bootWithRoute({ waypoints: 0 });
      const project = {
        coordVersion: 9,
        waypoints: [
          { id: 'wp-a', imgX: 0.3, imgY: 0.5, isMajor: true },
          { id: 'wp-b', imgX: 0.6, imgY: 0.5, isMajor: true },
        ],
      };
      expect(await loadSnapshot(app, project)).toBe(true);
      app.addCrowd({ enterNetworkEditor: false });
      expect(app.traceRouteIntoCrowd(app.selectedCrowd)).toBe(true);
      const saved = app._buildProjectSnapshot();
      const withBend = (point) => {
        const project = structuredClone(saved);
        project.scene.flowLayers[0].graph.edges[0].controlPoints = [point];
        return project;
      };

      allowConsole(LOAD_REFUSED);
      for (const point of [{ x: -10.5, y: 0.5 }, { x: 11.5, y: 0.5 }, { x: 0.5, y: -10.5 }, { x: 0.5, y: 11.5 }]) {
        const before = recordedConsole().length;
        expect(await loadSnapshot(app, withBend(point))).toBe(false);
        expect(recordedConsole().slice(before).some(line => line.includes('Invalid graph control point: expected coordinates from -10 to 11'))).toBe(true);
      }
      // The boundary is exact: one representable step past either end is
      // refused, and each end, and one step inside it, loads as it was.
      const step = 2 ** -49;
      for (const point of [{ x: -10 - step, y: 0.5 }, { x: 11 + step, y: 0.5 }, { x: 0.5, y: -10 - step }, { x: 0.5, y: 11 + step }]) {
        expect(await loadSnapshot(app, withBend(point))).toBe(false);
      }
      for (const point of [{ x: 11, y: -10 }, { x: -10, y: 11 }, { x: 11 - step, y: -10 + step }, { x: -10 + step, y: 11 - step }]) {
        expect(await loadSnapshot(app, withBend(point))).toBe(true);
        expect(app._buildProjectSnapshot().scene.flowLayers[0].graph.edges[0].controlPoints).toEqual([point]);
      }
    });

    /** A crowd traced from a route that bends through `bend`. */
    async function tracedThrough(bend, end = { x: 0.8, y: 0.5 }) {
      const app = await bootWithRoute({ waypoints: 0 });
      expect(await loadSnapshot(app, {
        coordVersion: 9,
        waypoints: [
          { id: 'wp-a', imgX: 0.3, imgY: 0.5, isMajor: true },
          { id: 'wp-bend', imgX: bend.x, imgY: bend.y, isMajor: false },
          { id: 'wp-b', imgX: end.x, imgY: end.y, isMajor: true },
        ],
      })).toBe(true);
      app.addCrowd({ enterNetworkEditor: false });
      expect(app.traceRouteIntoCrowd(app.selectedCrowd)).toBe(true);
      return app;
    }

    test.each([
      ['right', { x: 1.25, y: 0.15 }],
      ['left', { x: -0.25, y: 0.15 }],
      ['bottom', { x: 0.55, y: 1.25 }],
      ['top', { x: 0.55, y: -0.25 }],
    ])('a traced bend off the image, past its %s edge: its guide passes through it, in the editor, as drawn, and in the exported player', async (edgeName, bend) => {
      const app = await tracedThrough(bend);
      // The curve a route's own path takes through those points.
      const expected = new PathCalculator().calculatePath([{ x: 0.3, y: 0.5 }, bend, { x: 0.8, y: 0.5 }]);
      const [layer] = app.scene.getFlowLayers();
      const [edge] = layer.graph.getEdges();
      expect(app.swarmEngine.edgeGeometry(layer.graph, edge).points).toEqual(expected);

      // The line the editor draws for it, through a plain transform.
      const calls = [];
      const ctx = new Proxy({}, { get: (target, name) => (name in target ? target[name] : (...args) => calls.push([name, ...args])) });
      const toCanvas = (x, y) => ({ x: x * 500, y: y * 400 });
      app.networkEditService.renderGuide({ scaleSizeClamped: size => size }, ctx, { swarmEngine: app.swarmEngine, imageToCanvas: toCanvas }, layer);
      const pathStart = calls.findIndex(([name]) => name === 'beginPath');
      const pathEnd = calls.findIndex(([name], index) => index > pathStart && name === 'stroke');
      const line = calls.slice(pathStart + 1, pathEnd).map(([, x, y]) => ({ x, y }));
      expect(line).toEqual(expected.map(point => toCanvas(point.x, point.y)));

      const player = new PlayerApp(document.createElement('canvas'));
      await player.load(JSON.parse(JSON.stringify(app._buildProjectSnapshot())), null);
      const [playerLayer] = player.scene.getFlowLayers();
      const [playerEdge] = playerLayer.graph.getEdges();
      expect(playerEdge.controlPoints).toEqual([bend]);
      expect(player.swarmEngine.edgeGeometry(playerLayer.graph, playerEdge).points).toEqual(expected);
    });

    test('its dots are drawn off the image too, in the editor, Preview, a video frame and the exported player', async () => {
      const app = await tracedThrough({ x: 1.25, y: 0.15 }, { x: 1.6, y: 0.5 });
      const [layer] = app.scene.getFlowLayers();
      // One dot, released at once, at a steady pace: at 1 s it is at the bend.
      layer.emitters[0].update({
        dotCount: 1, speed: 1, speedVariance: 0, releaseStart: 0, releaseDuration: 0,
        onsetVariance: 0, wobble: 0, lifecycleMode: 'collect',
      });
      app.invalidateAnimationTiming();
      const player = new PlayerApp(document.createElement('canvas'));
      await player.load(JSON.parse(JSON.stringify(app._buildProjectSnapshot())), null);
      player.resize(app.displayWidth, app.displayHeight);

      // Each arc the dot renderer draws, and where the image's right edge is.
      const render = DotRenderer.render;
      let drawn = [];
      vi.spyOn(DotRenderer, 'render').mockImplementation((ctx, dots, imageToCanvas, svc) => {
        const recording = new Proxy(ctx, {
          get(target, name) {
            if (name === 'arc') return (x, y, ...rest) => { drawn.push({ x, edge: imageToCanvas(1, y).x }); return target.arc(x, y, ...rest); };
            const value = target[name];
            return typeof value === 'function' ? value.bind(target) : value;
          },
          set(target, name, value) { target[name] = value; return true; },
        });
        return render.call(DotRenderer, recording, dots, imageToCanvas, svc);
      });
      try {
        for (const mode of ['edit', 'preview', 'video', 'player']) {
          const host = mode === 'player' ? player : app;
          if (mode !== 'player') app._setPreviewMode(mode !== 'edit');
          if (mode === 'video') app._enterExportMode(app.exportSettings.resolutionX, app.exportSettings.resolutionY);
          setUpFrame(host);
          drawn = [];
          frameAt(host, 1000 / host.animationEngine.state.duration);
          if (mode === 'video') app._exitExportMode();
          // (A video frame draws it more than once.)
          expect(drawn.length, mode).toBeGreaterThan(0);
          for (const arc of drawn) expect(arc.x, mode).toBeGreaterThan(arc.edge);
        }
      } finally {
        vi.restoreAllMocks();
      }
    });

    test('a traced bend off the image is kept, or moved onto the image, from the outline', async () => {
      // Its fields show where it is; left as they are, the app keeps it, and a
      // new value is held to the image, as a bend drawn by hand is.
      const app = await bootWithRoute({ waypoints: 0 });
      expect(await loadSnapshot(app, {
        coordVersion: 9,
        waypoints: [
          { id: 'wp-a', imgX: 0.3, imgY: 0.5, isMajor: true },
          { id: 'wp-bend', imgX: 1.25, imgY: 0.15, isMajor: false },
          { id: 'wp-b', imgX: 0.8, imgY: 0.5, isMajor: true },
          { id: 'wp-below', imgX: 0.9, imgY: -0.2, isMajor: false },
          { id: 'wp-c', imgX: 0.4, imgY: 0.6, isMajor: true },
        ],
      })).toBe(true);
      app.addCrowd({ enterNetworkEditor: false });
      expect(app.traceRouteIntoCrowd(app.selectedCrowd)).toBe(true);
      const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));
      const graph = () => app.scene.getFlowLayers()[0].graph;
      const [aboveId, belowId] = graph().getEdges().map(edge => edge.id);
      const bend = edgeId => ({ ...graph().getEdge(edgeId).controlPoints[0] });
      const formFor = async (edgeId) => {
        app.networkEditService.bindForInspection(app.scene.getFlowLayers()[0]);
        app.networkEditService.selectControlPoint(graph().getEdge(edgeId), 0);
        await nextTask();
        return document.querySelector(`form[data-outline-action="update-control"][data-edge-id="${edgeId}"]`);
      };
      const commits = [];
      app.eventBus.on('network:changed', ({ commit } = {}) => { if (commit) commits.push(commit); });
      const apply = async (form, values) => {
        for (const [name, value] of Object.entries(values)) form.elements.namedItem(name).value = value;
        form.querySelector('[type="submit"]').click();
        await nextTask();
      };

      let form = await formFor(aboveId);
      expect(form.elements.namedItem('x').value).toBe('125');
      expect(form.elements.namedItem('x').max).toBe('125');
      await apply(form, { y: '20' });
      expect(bend(aboveId)).toEqual({ x: 1.25, y: 0.2 });

      // Applying it as it is changes nothing.
      form = await formFor(aboveId);
      const before = commits.length;
      await apply(form, {});
      expect(commits.length).toBe(before);
      expect(bend(aboveId)).toEqual({ x: 1.25, y: 0.2 });

      // A new place off the image is refused, and said why.
      form = await formFor(aboveId);
      await apply(form, { x: '110' });
      expect(bend(aboveId)).toEqual({ x: 1.25, y: 0.2 });
      expect(document.querySelector('form[data-outline-action="update-control"] [role="alert"]').textContent)
        .toBe('Horizontal position must be between 0 and 100.');

      form = await formFor(aboveId);
      await apply(form, { x: '50' });
      expect(bend(aboveId)).toEqual({ x: 0.5, y: 0.2 });
      app.undo();
      expect(bend(aboveId)).toEqual({ x: 1.25, y: 0.2 });
      app.redo();
      expect(bend(aboveId)).toEqual({ x: 0.5, y: 0.2 });

      // Below the image, too.
      form = await formFor(belowId);
      expect(form.elements.namedItem('y').min).toBe(String(bend(belowId).y * 100));
      await apply(form, { x: '80' });
      expect(bend(belowId)).toEqual({ x: 0.8, y: -0.2 });
      // (Escape resetting a form is the outline's own: sceneOutline.test.js.)
    });

  });

  describe('DEF-37: a null Graphics scale reloads', () => {

    test('a project whose Graphics scale is null opens at 1×, and its next save reopens', async () => {
      const app = await bootWithRoute({ waypoints: 2 });
      // Only a hand-edited or third-party file carries `null`. Load read
      // `Number(null)` as 0 and stored it, so the editor drew at the
      // renderer's 0.25× floor and read "0.0×", and the next save wrote 0,
      // which load refuses ("Invalid graphics scale").
      const project = app._buildProjectSnapshot();
      project.styles.graphicsScale = null;
      expect(await loadSnapshot(app, project)).toBe(true);
      expect(app.styles.graphicsScale).toBe(1);
      expect(app.renderingService._graphicsScale).toBe(1);
      expect(app.elements.graphicsScaleValue.textContent).toBe('1×');

      const saved = app._buildProjectSnapshot();
      expect(saved.styles.graphicsScale).toBe(1);
      expect(await loadSnapshot(app, saved)).toBe(true);
    });

    test('a project file whose Graphics scale is null opens at 1× through Open Project', async () => {
      // Open Project and the examples share recovery's staging; this pins them
      // to the rule too, so the guard cannot move to one entry point unnoticed.
      const app = await bootWithRoute({ waypoints: 2 });
      const project = app._buildProjectSnapshot({ includeAssets: false });
      project.styles.graphicsScale = null;
      const archive = await app.imageAssetService.exportZip(project);
      const file = new File([archive], 'null-scale.zip', { type: 'application/zip' });
      expect(await app.loadProject(file)).toBe(true);
      expect(app.styles.graphicsScale).toBe(1);
      expect(app.renderingService._graphicsScale).toBe(1);
      expect(app.elements.graphicsScaleValue.textContent).toBe('1×');
      expect(app._buildProjectSnapshot().styles.graphicsScale).toBe(1);
    });

    test('the other null styles the row names still read as 0 and reopen', async () => {
      // Left as they are until the owner widens DEF-37 (2026-09-24): pinned so
      // a fix cannot widen to them unnoticed.
      const app = await bootWithRoute({ waypoints: 2 });
      const project = app._buildProjectSnapshot();
      Object.assign(project.styles, { pathThickness: null, dotSize: null });
      Object.assign(project.styles.pathHead, { size: null, rotationOffset: null });
      project.styles.pathGlow = { ...project.styles.pathGlow, intensity: null };
      expect(await loadSnapshot(app, project)).toBe(true);
      expect([app.styles.pathThickness, app.styles.dotSize, app.styles.pathHead.size,
        app.styles.pathHead.rotationOffset, app.styles.pathGlow.intensity]).toEqual([0, 0, 0, 0, 0]);
      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(true);
    });

    test('a Graphics scale of 0 is still refused', async () => {
      // Only `null` means "absent"; 0 is an invalid scale, as before.
      allowConsole(LOAD_REFUSED);
      const app = await bootWithRoute({ waypoints: 2 });
      const project = app._buildProjectSnapshot();
      project.styles.graphicsScale = 0;
      expect(await loadSnapshot(app, project)).toBe(false);
      expect(refusalReason()).toContain('Invalid graphics scale');
    });

  });

});
