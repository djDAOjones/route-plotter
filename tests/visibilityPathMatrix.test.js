/**
 * TST-03 — the path visibility mode matrix, characterised as it stands.
 *
 * `MotionVisibilityService.getPathVisibleRange` decides how much of the route
 * is drawn: all of it, none of it, the part behind the head (drawing), the
 * part ahead (erasing), or the comet, a tail chasing the head whose length is
 * a fraction of the path's duration, capped at 80% of the progress early on,
 * that shrinks toward the head during waits and after the end. Until this,
 * one mode was seek-tested (the comet, in `reviewTimeline.test.js`) and no
 * table said what each mode gives where.
 *
 * Pinned here (`tests/goldens/visibility-path.json`, six decimal places):
 *
 * - every `PATH_VISIBILITY` value, and an unrecognised one (the fallback),
 *   at every trail setting the slider's range names (off, its minimum, the
 *   default, 100% and its maximum), at progress samples before the start,
 *   inside and at the edge of the 80% cap, mid-route, at the end and past it;
 * - the same with a wait and with the tail time running, without a timeline
 *   context (the arguments a host without `getTrailVisibilityContext` sends);
 * - the same along a real engine's timeline with three waits and the
 *   comet's tail time, which is what the renderer sends: the context, whose
 *   held tail carries a wait's shrinkage on until the base tail catches it
 *   up, into the next wait if that comes first;
 * - `getPathPointOpacity`, which nothing in `src/` calls (DEL-02 deletes it).
 *
 * Then hand-derived values at each boundary from the documented rules, so the
 * table is checked against something other than itself, and seek ==
 * sequential: the same answer seeked cold, played forwards frame by frame,
 * played backwards, and seeked in any order, for every mode.
 *
 * What would move the golden on purpose: nothing planned. SEG-013 leaves the
 * comet as it is; a change to the 80% cap, the tail rule or a mode's range is
 * a behaviour change and arrives as a diff here.
 */

import { describe, expect, test } from 'vitest';
import { MOTION, PATH_VISIBILITY } from '../src/config/constants.js';
import { MotionVisibilityService } from '../src/services/MotionVisibilityService.js';
import { rounded, seekOrders, visibilityGolden } from './helpers/visibilityGoldens.js';
import { pathArguments, playBackThrough, playThrough, ROUTE, routeEngine, ROUTE_PATH_MS } from './helpers/visibilityTimeline.js';

const pin = visibilityGolden('path');

/** Every mode, and a value the switch does not know, which falls back to drawing. */
const MODES = { ...PATH_VISIBILITY, UNRECOGNISED: 'not-a-path-mode' };

/** Off, the slider's minimum, the default, 100% of the path and the slider's maximum. */
const TRAILS = [0, MOTION.PATH_TRAIL_MIN, MOTION.PATH_TRAIL_DEFAULT, 1, MOTION.PATH_TRAIL_MAX];

/**
 * Progress samples. 0.05 is the 80% cap's edge for the minimum trail (0.05 ×
 * 0.8 = 0.04) and 0.25 for the default (0.25 × 0.8 = 0.2); 1 is the edge for
 * 100%, and the maximum never leaves the cap.
 */
const PROGRESS = [-0.05, 0, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.05];

/** Time into a wait or the tail, as a share of the trail's duration: none, half, all of it, twice it. */
const ELAPSED_SHARES = [0, 0.5, 1, 2];

const service = () => new MotionVisibilityService();

function range(mvs, settings, args) {
  const { pathProgress, pathDuration = ROUTE_PATH_MS, isWaiting = false, pauseElapsed = 0,
    isInTailTime = false, trailContext = null } = args;
  const { startProgress, endProgress, fadeStartProgress } = mvs.getPathVisibleRange(
    pathProgress, settings, pathDuration, isWaiting, pauseElapsed, isInTailTime, trailContext);
  return rounded([startProgress, endProgress, fadeStartProgress]);
}

/** The trails a mode is pinned at: all of them for the modes that read the trail, the default for the rest. */
function trailsFor(mode) {
  return mode === MODES.INSTANTANEOUS || mode === MODES.UNRECOGNISED ? TRAILS : [MOTION.PATH_TRAIL_DEFAULT];
}

/** Each mode with each of its trails, as `[name, mode, trail]`. */
const CASES = Object.entries(MODES).flatMap(([name, mode]) => trailsFor(mode).map(trail => [name, mode, trail]));

/**
 * The route fixture with D waiting too (500 ms), so a wait begins while the
 * tail is still held from the one before: C's 2 s wait shrinks a 0.2 trail
 * to nothing, and D is only 60 ms of travel later.
 */
const PATH_ROUTE = ROUTE.map(each => (each.id === 'D' ? { ...each, pauseTime: 500 } : each));
const pathEngine = tailMs => routeEngine({ route: PATH_ROUTE, tailMs }).engine;

/** Arguments for one instant with no timeline context, labelled. */
function legacyInstants(trail) {
  const trailMs = trail * ROUTE_PATH_MS;
  const moving = PROGRESS.map(pathProgress => [`at ${pathProgress}`, { pathProgress }]);
  const waiting = ELAPSED_SHARES.map(share => [`wait at 0.5, ${share}× trail in`,
    { pathProgress: 0.5, isWaiting: true, pauseElapsed: share * trailMs }]);
  const tail = ELAPSED_SHARES.map(share => [`tail, ${share}× trail in`,
    { pathProgress: 1, isInTailTime: true, pauseElapsed: share * trailMs }]);
  const odd = [
    ['wait at 0.5, elapsed not a number', { pathProgress: 0.5, isWaiting: true, pauseElapsed: Number.NaN }],
    ['wait at 0.5, elapsed negative', { pathProgress: 0.5, isWaiting: true, pauseElapsed: -500 }],
    ['wait before the start, half the trail in', { pathProgress: -0.05, isWaiting: true, pauseElapsed: trailMs / 2 }],
    ['wait and tail at 1, half the trail in', { pathProgress: 1, isWaiting: true, isInTailTime: true, pauseElapsed: trailMs / 2 }],
    ['no path duration, at 0.5', { pathProgress: 0.5, pathDuration: 0 }],
  ];
  return [...moving, ...waiting, ...tail, ...odd];
}

/**
 * Instants along `PATH_ROUTE`'s timeline (waits B 3000–4000 ms, C 7000–9000
 * and D 9060–9560, path done at 13500 ms), then the comet's tail time, which
 * Preview gives only a comet (`trail × path`, plus a 500 ms handle).
 */
function timelineInstants(tailMs) {
  const instants = [
    ['start', 0], ['inside the 80% cap', 1000], ['travel', 2500], ['B wait starts', 3000], ['B wait', 3500],
    ['B wait ends', 4000], ['after B, held tail', 4500], ['base tail catches up', 5000], ['travel', 6000],
    ['C wait starts', 7000], ['C wait', 8000], ['C wait ending', 8990], ['C wait ends', 9000],
    ['D wait starts, tail still held', 9060], ['D wait', 9310], ['D wait ends', 9560], ['travel', 11500],
    ['path ends', 13500],
  ];
  if (tailMs > 0) {
    instants.push(['tail, half the trail in', 13500 + tailMs / 2], ['tail, trail gone', 13500 + tailMs],
      ['end', 13500 + tailMs + 500]);
  }
  const last = instants[instants.length - 1][1];
  instants.push(['past the end', last + 500]);
  return instants;
}

/** The tail time Preview gives a mode: only the comet has one, and only with a trail. */
function tailFor(mode, trail) {
  return mode === MODES.INSTANTANEOUS ? trail * ROUTE_PATH_MS : 0;
}

/** The range at the engine's instant, with the progress it was taken at. */
function rangeOnEngine(mvs, engine, settings) {
  const args = pathArguments(engine);
  return rounded([args.pathProgress, ...range(mvs, settings, args)]);
}

describe('the path mode matrix (golden)', () => {
  test.each(CASES)('%s (%s) at trail %s, without a timeline context', (name, mode, trail) => {
    const settings = { pathVisibility: mode, pathTrail: trail };
    const rows = Object.fromEntries(legacyInstants(trail).map(([label, args]) => [label, range(service(), settings, args)]));
    pin(`${name} trail ${trail} legacy`, rows);
  });

  test.each(CASES)('%s (%s) at trail %s, along the route\'s timeline', (name, mode, trail) => {
    const settings = { pathVisibility: mode, pathTrail: trail };
    const tailMs = tailFor(mode, trail);
    const rows = {};
    for (const [label, ms] of timelineInstants(tailMs)) {
      const engine = pathEngine(tailMs);
      engine.seekToTime(ms);
      rows[`${ms} ${label}`] = rangeOnEngine(service(), engine, settings);
    }
    pin(`${name} trail ${trail} timeline`, rows);
  });

  test('a timeline context with no tail period and no waits', () => {
    // What a host sends when the comet has no tail time: the base tail only.
    const settings = { pathVisibility: PATH_VISIBILITY.INSTANTANEOUS, pathTrail: 0.2 };
    const rows = {};
    for (const pathProgress of PROGRESS) {
      const trailContext = { timelineMs: pathProgress * ROUTE_PATH_MS, pauseMarkers: [], tailStartMs: 10000, tailEndMs: 10000 };
      rows[`at ${pathProgress}`] = range(service(), settings, { pathProgress, trailContext });
    }
    pin('INSTANTANEOUS trail 0.2 context without tail', rows);
  });

  test('every mode is in the matrix', () => {
    expect(Object.values(PATH_VISIBILITY).every(mode => CASES.some(([, each]) => each === mode))).toBe(true);
    expect(Object.keys(PATH_VISIBILITY)).toEqual(['ALWAYS_SHOW', 'SHOW_ON_PROGRESSION', 'HIDE_ON_PROGRESSION',
      'INSTANTANEOUS', 'ALWAYS_HIDE']);
  });
});

describe('the path modes, derived by hand from their documented rules', () => {
  const at = (mode, pathProgress, extra = {}, trail = 0.2) =>
    range(service(), { pathVisibility: mode, pathTrail: trail }, { pathProgress, ...extra });

  test('always show and always hide ignore progress, waits and the trail', () => {
    for (const pathProgress of [-0.05, 0, 0.5, 1, 1.05]) {
      expect(at(PATH_VISIBILITY.ALWAYS_SHOW, pathProgress, { isWaiting: true, pauseElapsed: 900 })).toEqual([0, 1, 0]);
      expect(at(PATH_VISIBILITY.ALWAYS_HIDE, pathProgress, { isInTailTime: true, pauseElapsed: 900 })).toEqual([0, 0, 0]);
    }
  });

  test('show on progression draws from the start to the head, unclamped', () => {
    expect(at(PATH_VISIBILITY.SHOW_ON_PROGRESSION, 0)).toEqual([0, 0, 0]);
    expect(at(PATH_VISIBILITY.SHOW_ON_PROGRESSION, 0.5)).toEqual([0, 0.5, 0]);
    expect(at(PATH_VISIBILITY.SHOW_ON_PROGRESSION, 1.05)).toEqual([0, 1.05, 0]);
    expect(at(PATH_VISIBILITY.SHOW_ON_PROGRESSION, -0.05)).toEqual([0, -0.05, 0]);
  });

  test('hide on progression draws from the head to the end, with its fade start at the head', () => {
    expect(at(PATH_VISIBILITY.HIDE_ON_PROGRESSION, 0)).toEqual([0, 1, 0]);
    expect(at(PATH_VISIBILITY.HIDE_ON_PROGRESSION, 0.5)).toEqual([0.5, 1, 0.5]);
    expect(at(PATH_VISIBILITY.HIDE_ON_PROGRESSION, 1)).toEqual([1, 1, 1]);
  });

  test('the comet\'s tail is the trail behind the head, capped at 80% of the progress', () => {
    const comet = PATH_VISIBILITY.INSTANTANEOUS;
    // 0.1 × 0.8 = 0.08 < 0.2: capped, the tail at 0.02.
    expect(at(comet, 0.1)).toEqual([0.02, 0.1, 0.02]);
    // 0.25 × 0.8 = 0.2: the cap's edge, both rules agree at 0.05.
    expect(at(comet, 0.25)).toEqual([0.05, 0.25, 0.05]);
    // Past the cap, the whole trail: 0.5 − 0.2.
    expect(at(comet, 0.5)).toEqual([0.3, 0.5, 0.3]);
    expect(at(comet, 1)).toEqual([0.8, 1, 0.8]);
    // Off: no tail at all, the range collapses on the head.
    expect(at(comet, 0.5, {}, 0)).toEqual([0.5, 0.5, 0.5]);
    // The head is clamped for the tail, but the range ends at the progress given.
    expect(at(comet, 1.05)).toEqual([0.8, 1.05, 0.8]);
    expect(at(comet, -0.05)).toEqual([0, -0.05, 0]);
  });

  test('candidate defect: the trail maximum never shows the first fifth of the travelled path', () => {
    // MOTION.PATH_TRAIL_MAX is documented as "400% of path = 100% on slider
    // (full path always visible)". The 80% cap applies to every trail, so a
    // trail at least as long as the path keeps the tail at a fifth of the
    // progress: at the end, the first 20% of the route is not drawn.
    const comet = PATH_VISIBILITY.INSTANTANEOUS;
    expect(at(comet, 1, {}, MOTION.PATH_TRAIL_MAX)).toEqual([0.2, 1, 0.2]);
    expect(at(comet, 0.5, {}, MOTION.PATH_TRAIL_MAX)).toEqual([0.1, 0.5, 0.1]);
    expect(at(comet, 1, {}, 1)).toEqual([0.2, 1, 0.2]);
  });

  test('a wait or the tail time shrinks the comet toward the head over the trail\'s duration', () => {
    const comet = PATH_VISIBILITY.INSTANTANEOUS;
    // The trail lasts 0.2 × 10 s = 2 s. Halfway: 0.3 + (0.5 − 0.3) / 2.
    expect(at(comet, 0.5, { isWaiting: true, pauseElapsed: 1000 })).toEqual([0.4, 0.5, 0.4]);
    expect(at(comet, 0.5, { isWaiting: true, pauseElapsed: 2000 })).toEqual([0.5, 0.5, 0.5]);
    expect(at(comet, 0.5, { isWaiting: true, pauseElapsed: 4000 })).toEqual([0.5, 0.5, 0.5]);
    // A quarter of the way through the tail: 0.8 + 0.2 / 4.
    expect(at(comet, 1, { isInTailTime: true, pauseElapsed: 500 })).toEqual([0.85, 1, 0.85]);
    // Elapsed time that is not a number counts as none.
    expect(at(comet, 0.5, { isWaiting: true, pauseElapsed: Number.NaN })).toEqual([0.3, 0.5, 0.3]);
  });

  test('along the timeline, a wait\'s shrinkage is held until the base tail catches it up', () => {
    // Trail 0.2 of 10 s = 2 s; B waits 1 s at 0.3 (3000–4000 ms).
    const settings = { pathVisibility: PATH_VISIBILITY.INSTANTANEOUS, pathTrail: 0.2 };
    const onTimeline = (ms) => {
      const engine = pathEngine(2000);
      engine.seekToTime(ms);
      return rangeOnEngine(service(), engine, settings);
    };
    // 500 ms into B's wait: from 0.1 a quarter of the way to 0.3.
    expect(onTimeline(3500)).toEqual([0.3, 0.15, 0.3, 0.15]);
    // B's wait over: half the trail's time has passed, so the tail holds at 0.2.
    expect(onTimeline(4000)).toEqual([0.3, 0.2, 0.3, 0.2]);
    // At 0.35 the base tail (0.15) is still behind the held one; at 0.4 it
    // has caught it up; at 0.5 it leads.
    expect(onTimeline(4500)).toEqual([0.35, 0.2, 0.35, 0.2]);
    expect(onTimeline(5000)).toEqual([0.4, 0.2, 0.4, 0.2]);
    expect(onTimeline(6000)).toEqual([0.5, 0.3, 0.5, 0.3]);
    // C's 2 s wait shrinks the tail to C (0.6). D's wait starts from that
    // held tail, not from D's base tail (0.406), and a quarter of the way
    // through the trail's time it has closed a quarter of the 0.006 gap.
    expect(onTimeline(9060)).toEqual([0.606, 0.6, 0.606, 0.6]);
    expect(onTimeline(9560)).toEqual([0.606, 0.6015, 0.606, 0.6015]);
    // The tail time starts at 13500 ms; a second in, half the trail has shrunk.
    expect(onTimeline(14500)).toEqual([1, 0.9, 1, 0.9]);
    expect(onTimeline(15500)).toEqual([1, 1, 1, 1]);
  });

  test('an unrecognised mode draws as show on progression, whatever the trail', () => {
    for (const trail of TRAILS) {
      expect(at(MODES.UNRECOGNISED, 0.5, { isWaiting: true, pauseElapsed: 500 }, trail)).toEqual([0, 0.5, 0]);
    }
  });
});

describe('the path modes, seek == sequential', () => {
  test.each(CASES)('%s (%s) at trail %s, one service or many, in any order', (name, mode, trail) => {
    const settings = { pathVisibility: mode, pathTrail: trail };
    const instants = legacyInstants(trail).map(([, args]) => args);
    const { cold, forwards, backwards, scrambled } = seekOrders(instants, service, (mvs, args) => range(mvs, settings, args));
    expect(forwards).toEqual(cold);
    expect(backwards).toEqual(cold);
    expect(scrambled).toEqual(cold);
  });

  test.each(CASES)('%s (%s) at trail %s, seeked or played on a real engine', (name, mode, trail) => {
    const settings = { pathVisibility: mode, pathTrail: trail };
    const tailMs = tailFor(mode, trail);
    const instants = timelineInstants(tailMs).map(([, ms]) => ms);

    const cold = instants.map((ms) => {
      const engine = pathEngine(tailMs);
      engine.seekToTime(ms);
      return rangeOnEngine(service(), engine, settings);
    });

    const rig = () => ({ engine: pathEngine(tailMs), mvs: service() });
    const seeked = seekOrders(instants, rig, ({ engine, mvs }, ms) => {
      engine.seekToTime(ms);
      return rangeOnEngine(mvs, engine, settings);
    });
    expect(seeked.forwards).toEqual(cold);
    expect(seeked.backwards).toEqual(cold);
    expect(seeked.scrambled).toEqual(cold);

    // Played at 100 fps, the service asked for every frame on the way.
    const played = rig();
    const evaluate = () => rangeOnEngine(played.mvs, played.engine, settings);
    const forwards = playThrough(played.engine, instants, 10, evaluate, evaluate);
    expect(instants.map(ms => forwards.get(ms))).toEqual(cold);
    const backwards = playBackThrough(played.engine, instants, 10, evaluate, evaluate);
    expect(instants.map(ms => backwards.get(ms))).toEqual(cold);
  });
});

/**
 * The wait's elapsed time the renderer passes is its own `_getPauseElapsed`,
 * which `pathArguments` calls rather than copies. It counts the intro: 500 ms
 * into a 1 s wait that starts at 3,000 ms, after a 1 s intro, it reads
 * 1,500 ms, where the engine's pause state reads 500. Given the timeline
 * context, as the renderer always gives it, the service ignores that argument,
 * so no mode's answer differs today (Codex's review of TST-03; a wish line).
 */
describe("the renderer's wait elapsed", () => {
  const WAIT_ROUTE = [
    { id: 'A', progress: 0, pauseTime: 0 },
    { id: 'B', progress: 0.5, pauseTime: 1000 },
    { id: 'C', progress: 1, pauseTime: 0 },
  ];

  test('counts the intro, and no mode reads it given the timeline context', () => {
    const { engine } = routeEngine({ route: WAIT_ROUTE, pathMs: 4000, introMs: 1000 });
    engine.seekToTime(3500);
    expect(engine.state.isWaitingAtWaypoint).toBe(true);
    expect(engine.getPauseState().elapsed).toBe(500);
    const args = pathArguments(engine);
    expect(args.pauseElapsed).toBe(1500);
    for (const [, mode, trail] of CASES) {
      const settings = { pathVisibility: mode, pathTrail: trail };
      expect(range(service(), settings, { ...args, pauseElapsed: 500 }), `${mode} at trail ${trail}`)
        .toEqual(range(service(), settings, args));
    }
  });
});

/**
 * `getPathPointOpacity` has no caller in `src/` (the renderer fades the trail
 * itself), and DEL-02 deletes it; that change deletes this block with it.
 * Until then it is pinned as it stands. Its comment says the fade runs "from
 * 0 (at fadeStart) to 1 (at endProgress)"; the code gives the reverse, 1 at
 * the fade start and 0 at the head.
 */
describe('getPathPointOpacity (dead code, DEL-02)', () => {
  const opacity = (point, fadeStart, end, trail) => rounded(service().getPathPointOpacity(point, fadeStart, end, trail));
  const POINTS = [-0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 1];

  test.each(CASES)('%s (%s) at trail %s, across each range the matrix gives', (name, mode, trail) => {
    const settings = { pathVisibility: mode, pathTrail: trail };
    const rows = {};
    for (const pathProgress of [0.1, 0.5, 1]) {
      const [, end, fadeStart] = range(service(), settings, { pathProgress });
      rows[`head at ${pathProgress}`] = POINTS.map(point => opacity(point, fadeStart, end, trail));
    }
    pin(`${name} trail ${trail} point opacity`, rows);
  });

  test('without a trail a point is fully in or out, both edges in', () => {
    expect([0.1, 0.3, 0.5, 0.6].map(point => opacity(point, 0.3, 0.5, 0))).toEqual([0, 1, 1, 0]);
  });

  test('with a trail it fades linearly, today from 1 at the fade start to 0 at the head', () => {
    expect([0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6].map(point => opacity(point, 0.3, 0.5, 0.2)))
      .toEqual([0, 1, 0.75, 0.5, 0.25, 0, 0]);
    // A range with no length is fully lit at its one point.
    expect(opacity(0.5, 0.5, 0.5, 0.2)).toBe(1);
  });
});
