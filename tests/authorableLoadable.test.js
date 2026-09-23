/**
 * TST-06 — authorable ⇒ loadable (part 2 of 2).
 *
 * The invariant: anything the app's own interface can author must survive a
 * save and a load. It is not held today — DEF-03 and DEF-04 each break it, and
 * each one loses a user's work — so this file does three things. The property
 * tests state the invariant over the controls where it *does* hold; the known
 * failures are characterised exactly as they behave now, each with a `todo`
 * naming the fix that will replace it; and a fixed one (DEF-31) keeps its
 * regression.
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

import { describe, test, expect } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole, recordedConsole } from './helpers/consoleGuard.js';
import {
  comparableSnapshot, freezeClock, loadSnapshot, LOAD_REFUSED,
} from './helpers/projectSnapshot.js';
import { PROJECT_MODEL_LIMITS } from '../src/app/persistence.js';

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

  describe('the known failures (W2 fixes each one)', () => {

    test('DEF-03: a waypoint authored outside the image at 50% zoom will not load', async () => {
      allowConsole(LOAD_REFUSED);
      const app = await bootWithRoute({ waypoints: 1 });
      // Below 100% background zoom `screenToImage` deliberately returns
      // coordinates outside 0–1 (`viewport.js:257-262`), and the `waypoint:add`
      // handler builds the waypoint from them without clamping
      // (`wiringControllers.js:309-310`, `Waypoint.js:172`). A click in the
      // margin is an ordinary thing to do while zoomed out.
      app.exportSettings.backgroundZoom = 50;
      app.eventBus.emit('waypoint:add', { imgX: 1.35, imgY: -0.2, isMajor: true });
      expect(app.waypoints.map(waypoint => waypoint.imgX)).toContain(1.35);

      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(false);
      expect(refusalReason()).toContain('Invalid waypoint at index 1');
    });

    test.todo('DEF-03: a waypoint authored outside the image at 50% zoom loads again');

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

});
