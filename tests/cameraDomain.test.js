/**
 * TST-09 — the camera domain, characterised as it stands.
 *
 * The camera is not a pure function of timeline time (DEF-07): each frame
 * eases a smoothed zoom and centre a fixed fraction toward their targets,
 * snaps them only on a jump of more than 5% of the path, and limits the zoom
 * to an octave per 500 ms of *wall-clock* time (`performance.now()`). So the
 * state at an instant depends on how it was reached. What does hold today:
 *
 * - a seek that follows a far seek after the camera has rested a second
 *   lands on the same state whichever far seek came before (the jump snap);
 * - at 1× the camera snaps to the flat view once it is within a pixel, so a
 *   bounded run of frames at one instant ends exactly there, however the
 *   instant was reached;
 * - at any other zoom it only approaches its target, so a bounded run ends
 *   within the settling thresholds of `isZoomTransitioning`, never exactly.
 *
 * The rest is pinned as numbers (`tests/goldens/domains-camera.json`): the
 * first frame after a near seek, a fast scrub, a seek after a 1× seek (which
 * records no progress, so the next seek back may not count as a jump),
 * playing at three real-time frame rates and at an export's encoding pace,
 * and how many frames each settles in. DEF-07's pure `cameraStateAt` moves
 * all of those on purpose.
 *
 * Both fixtures are bundled examples given authored zooms. The branched one
 * (Open day: trunk 1 → 2 → 2a → 2b → 3, branch b1 from 2 rejoining at 3)
 * also pins DEF-05: its camera keyframes pair the whole waypoint array with
 * the trunk's progress values, so b1 takes the trunk end's progress and 3
 * takes none (0), and the trunk's last leg eases toward b1's 8× before the
 * end snaps the target to 3's 2×. DEF-05's trunk-aligned accessor moves the
 * `keyframes`, `seek` and every later branched case.
 *
 * Frames are driven by hand, one `_calculateCameraState` per frame as
 * `render()` makes, on a clock `performance.now()` reads.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { CameraService } from '../src/services/CameraService.js';
import { PlayerCore } from '../src/core/PlayerCore.js';
import { domainGolden, exampleProject, openProject, rounded } from './helpers/domainGoldens.js';

const pin = domainGolden('camera');

/** One 25 fps frame of timeline. */
const FRAME_MS = 40;
/**
 * A rest just long enough for the rate limit to let the zoom jump (it lets go
 * after 1 s). At an octave per 500 ms, 1.1 s alone would allow only 2.2
 * octaves, so the branched route's 1× → 7.8× seeks land only by letting go.
 */
const REST_MS = 1100;
/** A scrub that lands before the rate limit lets go. */
const SCRUB_MS = 100;
/** No settling run takes this many frames; reaching it is a failure. */
const MAX_SETTLE_FRAMES = 2000;

const FIXTURES = {
  branched: {
    id: 'uon-open-day',
    zooms: { 'ex-uon-1': 1, 'ex-uon-2': 4, 'ex-uon-b1': 8, 'ex-uon-3': 2 },
    // Leaving 1, climbing to 2, held in 2's wait, the trunk's last leg, the
    // end's wait; all on an 80 ms grid, so every frame rate below lands on them.
    instants: { start: 0, climb: 640, held: 3040, lastLeg: 7040, end: 12000 },
  },
  linear: {
    id: 'parm-aerial-walk',
    zooms: { 'ex-parm-1': 1, 'ex-parm-2': 3, 'ex-parm-3': 1 },
    instants: { start: 0, climb: 960, held: 4000, lastLeg: 8000, end: 9600 },
  },
};

let wall = 0;

beforeEach(() => {
  wall = 0;
  performance.now.mockImplementation(() => wall);
});

afterEach(() => {
  performance.now.mockImplementation(() => Date.now());
});

/** The fixture in Preview, with Camera movement on and its zooms authored (continuous). */
async function cameraApp(name) {
  const fixture = FIXTURES[name];
  const project = exampleProject(fixture.id);
  project.exportSettings = { ...project.exportSettings, includeCamera: true };
  for (const waypoint of project.waypoints) {
    if (fixture.zooms[waypoint.id] !== undefined) {
      waypoint.camera = { zoom: fixture.zooms[waypoint.id], zoomMode: 'continuous' };
    }
  }
  const app = await openProject(project);
  expect(app.previewMode).toBe(true);
  return app;
}

/** One frame's camera, `wallMs` of wall clock after the last. */
function frame(app, wallMs) {
  wall += wallMs;
  const { zoom, centerX, centerY, enabled } = app._calculateCameraState(app.displayWidth, app.displayHeight);
  return { zoom, centerX, centerY, enabled };
}

/** Seek, then draw one frame `wallMs` later. */
function seek(app, ms, wallMs = REST_MS) {
  app.animationEngine.seekToTime(ms);
  return frame(app, wallMs);
}

function transitioning(app) {
  return app.cameraService.isZoomTransitioning(app.displayWidth, app.displayHeight);
}

/** Frames at the same instant until the camera stops transitioning, bounded. */
function settle(app, state) {
  let frames = 0;
  let last = state;
  while (transitioning(app)) {
    expect(frames, 'the camera settles within the bound').toBeLessThan(MAX_SETTLE_FRAMES);
    last = frame(app, FRAME_MS);
    frames += 1;
  }
  return { frames, state: last };
}

/**
 * Ways to play to an instant: timeline step and wall-clock step per frame.
 * Real time at 25, 50 and 12.5 fps, and a 25 fps export encoding eight
 * times faster than real time (an export seeks frame by frame at the
 * encoder's pace).
 */
const PLAYS = {
  realtime25: { stepMs: 40, wallMs: 40 },
  realtime50: { stepMs: 20, wallMs: 20 },
  realtime12: { stepMs: 80, wallMs: 80 },
  export25: { stepMs: 40, wallMs: 5 },
};

/**
 * Play from the start to `ms`, one frame per step. The steps are whole
 * milliseconds and `ms` is on their grid, so the engine reaches it exactly.
 */
function playTo(app, ms, { stepMs, wallMs }) {
  seek(app, 0);
  const engine = app.animationEngine;
  let state = frame(app, wallMs);
  while (engine.state.currentTime < ms) {
    engine.updateAnimation(stepMs, 0);
    state = frame(app, wallMs);
  }
  expect(engine.state.currentTime).toBe(ms);
  return state;
}

/** Where the head is at `ms`, read without touching the engine's wait state. */
function headAt(app, ms) {
  const engine = app.animationEngine;
  return PlayerCore.timelineToPath(ms, engine.getTimeline(), engine.getLiveTiming()).pathProgress;
}

/** A seek the far side of the route: more than 5% of the path away, so the camera snaps. */
function farFrom(app, ms) {
  return headAt(app, ms) < 0.5 ? app.animationEngine.state.baseDuration : 0;
}

/** The zoom the camera heads for with the head at `pathProgress`, from a camera of its own. */
function targetAt(app, pathProgress) {
  const { waypoints, progressValues } = CameraService.toMajorKeyframes(app.waypoints, app.getWaypointProgressValues());
  return new CameraService()._calculateTargetZoom(pathProgress, waypoints, progressValues,
    app.animationEngine.state.baseDuration);
}

/**
 * Prior seeks far from `ms` (over 10% of the path away): the two farthest
 * where the camera is zoomed, with the head in different places, and the
 * farthest at 1×, if any.
 */
function priorsFor(app, ms) {
  const B = app.animationEngine.state.baseDuration;
  const here = headAt(app, ms);
  const far = Array.from({ length: 21 }, (_, step) => (B * step) / 20)
    .filter(prior => Math.abs(headAt(app, prior) - here) > 0.1)
    .sort((a, b) => Math.abs(headAt(app, b) - here) - Math.abs(headAt(app, a) - here));
  const zoomed = far.filter(prior => Math.abs(targetAt(app, headAt(app, prior)) - 1) > 0.001);
  const [first] = zoomed;
  const second = zoomed.find(prior => Math.abs(headAt(app, prior) - headAt(app, first)) > 0.01);
  expect(second, `two distinct zoomed priors for ${ms} ms`).toBeDefined();
  const flat = far.find(prior => Math.abs(targetAt(app, headAt(app, prior)) - 1) <= 0.001) ?? null;
  return { zoomed: [first, second], flat };
}

/** The flat view: no camera transform, the canvas centre. */
function flatView(app) {
  return { zoom: 1, centerX: app.displayWidth / 2, centerY: app.displayHeight / 2, enabled: false };
}

/** Settled within `isZoomTransitioning`'s own thresholds of `target`, the state a snap would give. */
function expectNear(actual, target) {
  expect(Math.abs(actual.zoom - target.zoom)).toBeLessThan(0.002);
  expect(Math.abs(actual.centerX - target.centerX) + Math.abs(actual.centerY - target.centerY)).toBeLessThan(1.5);
  expect(actual.enabled).toBe(target.enabled);
}

for (const name of Object.keys(FIXTURES)) {
  const { instants } = FIXTURES[name];

  describe(`camera — ${name} route`, () => {

    test('keyframes: majors paired with the progress values the camera reads (DEF-05 moves the branched pairing)', async () => {
      const app = await cameraApp(name);
      const { waypoints, progressValues } =
        CameraService.toMajorKeyframes(app.waypoints, app.getWaypointProgressValues());
      pin(`${name}.keyframes`, rounded({
        ids: waypoints.map(waypoint => waypoint.id),
        progress: progressValues,
        trunk: app._trunkWaypoints.map(waypoint => waypoint.id),
      }));
    });

    test('seek: the state a seek lands on after resting from a far seek, across the base timeline', async () => {
      const app = await cameraApp(name);
      const B = app.animationEngine.state.baseDuration;
      const rows = [];
      for (let step = 0; step <= 20; step += 1) {
        const ms = (B * step) / 20;
        seek(app, farFrom(app, ms));
        const state = seek(app, ms);
        rows.push([step / 20, app.animationEngine.getPathProgress(), app.cameraService._targetZoom,
          state.zoom, state.centerX, state.centerY, state.enabled]);
      }
      pin(`${name}.seek`, { columns: ['fractionOfB', 'pathProgress', 'targetZoom', 'zoom', 'centerX', 'centerY', 'enabled'], rows: rounded(rows) });
    });

    test('after a different prior seek: a zoomed one lands exactly alike; a 1× one leaves the camera easing (DEF-07)', async () => {
      // Zoomed instants snap on the jump, so two different zoomed far priors
      // land on the same first frame. A 1× instant snaps only once it is
      // within a pixel, so it eases from wherever the prior left the camera,
      // and a bounded run of frames ends exactly flat. A prior at 1× records
      // no progress (the 1× branch of `calculateCameraState` returns before
      // `_lastProgress` is written), so a seek back to a zoomed instant near
      // the last zoomed one is no jump: it eases in from 1× instead.
      const app = await cameraApp(name);
      const cases = {};
      for (const [label, ms] of Object.entries(instants)) {
        const { zoomed, flat } = priorsFor(app, ms);
        const runs = [];
        for (const prior of [...zoomed, ...(flat === null ? [] : [flat])]) {
          seek(app, prior);
          const first = seek(app, ms);
          const { frames, state } = settle(app, first);
          runs.push({ prior, first, frames, settled: state });
        }
        const flatInstant = app.cameraService._targetZoom === 1;
        if (flatInstant) {
          for (const run of runs) expect(run.settled).toEqual(flatView(app));
        } else {
          expect(runs[1].first).toEqual(runs[0].first);
          for (const run of runs) expectNear(run.settled, runs[0].first);
          if (flat !== null) expect(runs[2].first).not.toEqual(runs[0].first);
        }
        cases[label] = rounded({ ms, flatInstant, runs: runs.map(({ settled, ...run }) => run) });
      }
      pin(`${name}.priors`, cases);
    });

    test('a near seek smooths instead of snapping, and a fast scrub is rate-limited by the wall clock (DEF-07)', async () => {
      const app = await cameraApp(name);
      const cases = {};
      for (const [label, ms] of Object.entries(instants)) {
        // Reference: rested after a far seek.
        seek(app, farFrom(app, ms));
        const rested = seek(app, ms);
        // Near: 200 ms of timeline earlier, rested, then the seek.
        seek(app, farFrom(app, ms));
        seek(app, Math.max(0, ms - 200));
        const near = seek(app, ms);
        // Scrub: a far seek, then the seek a tenth of a second of wall clock later.
        seek(app, farFrom(app, ms));
        const scrub = seek(app, ms, SCRUB_MS);
        cases[label] = rounded({ ms, rested, near, scrub });
      }
      pin(`${name}.nearAndScrub`, cases);
    });

    test('play: the state at an instant depends on the frame rate and the wall clock; held at the instant it settles where a seek lands (DEF-07)', async () => {
      const app = await cameraApp(name);
      const cases = {};
      for (const [label, ms] of Object.entries(instants)) {
        seek(app, farFrom(app, ms));
        const seeked = seek(app, ms);
        const flatInstant = app.cameraService._targetZoom === 1;
        if (flatInstant) expect(settle(app, seeked).state).toEqual(flatView(app));

        const runs = {};
        for (const [play, rate] of Object.entries(PLAYS)) {
          const reached = playTo(app, ms, rate);
          const held = settle(app, reached);
          if (flatInstant) expect(held.state).toEqual(flatView(app));
          else expectNear(held.state, seeked);
          runs[play] = { reached, settleFrames: held.frames };
        }
        cases[label] = rounded({ ms, flatInstant, seeked, ...runs });
      }
      pin(`${name}.play`, cases);
    });
  });
}

describe('camera — the defects, stated', () => {

  test('DEF-07: mid-transition, the same instant played at 25 and 50 fps, or exported, draws three different cameras, none the seek\'s', async () => {
    const app = await cameraApp('linear');
    const ms = FIXTURES.linear.instants.climb;
    const reached = ['realtime25', 'realtime50', 'export25'].map(play => playTo(app, ms, PLAYS[play]));
    expect(reached[1]).not.toEqual(reached[0]); // smoothing is per frame, not per millisecond
    expect(reached[2]).not.toEqual(reached[0]); // the zoom's rate limit reads the wall clock
    seek(app, farFrom(app, ms));
    const seeked = seek(app, ms);
    for (const state of reached) expect(state).not.toEqual(seeked);
  });

  test('DEF-05: on the branched route the trunk\'s last leg eases toward the branch waypoint\'s zoom, and the end snaps the target to the rejoin\'s', async () => {
    const app = await cameraApp('branched');
    const B = app.animationEngine.state.baseDuration;
    const { waypoints, progressValues } = CameraService.toMajorKeyframes(app.waypoints, app.getWaypointProgressValues());
    expect(waypoints.map(waypoint => waypoint.id)).toEqual(['ex-uon-1', 'ex-uon-2', 'ex-uon-b1', 'ex-uon-3']);
    expect(progressValues.slice(2)).toEqual([1, 0]);

    seek(app, 0);
    seek(app, FIXTURES.branched.instants.lastLeg);
    expect(app.cameraService._targetZoom).toBeGreaterThan(4); // heading for b1's 8×, not 3's 2×
    seek(app, 0);
    seek(app, B);
    expect(app.cameraService._targetZoom).toBe(2);
  });
});
