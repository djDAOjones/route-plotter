/**
 * TST-03 — the waypoint visibility mode matrix, characterised as it stands.
 *
 * `MotionVisibilityService.getWaypointVisibility` was the most intricate pure
 * logic in its file and had no test at all (SEG-013). It decides whether a
 * major waypoint's marker shows, and at what scale, as the head approaches,
 * reaches and leaves it:
 *
 * - a window either side of the waypoint, ideally 250 ms of travel, held to
 *   1–8% of the path, and to half the gap to each neighbour (the first and
 *   last waypoints use the whole distance to the route's ends), never
 *   starting before the previous waypoint;
 * - in that window a marker that hides before scales in (cubic ease-out) and
 *   one that hides after scales out (cubic ease-in); a band 0.001 of the path
 *   wide at the waypoint, where a wait holds the head, shows it whole;
 * - when the previous waypoint is under 250 ms of travel away, the missing
 *   time (the deficit) is spent appearing during the end of the previous
 *   waypoint's wait, driven by the wait's clock, and the travel picks the
 *   curve up where the wait left it.
 *
 * Pinned here (`tests/goldens/visibility-waypoints.json`, six decimal places,
 * each answer as `[visible, scale, opacity, phase]`): every
 * `WAYPOINT_VISIBILITY` value and an unrecognised one, for the first, a
 * middle, the last and an only waypoint, at both clamps of the window, with
 * no path duration, between tight neighbours and close after waits of three
 * lengths, at samples before the route, before, at, inside and at the end of
 * each window, in the band and past the route; the wait-driven appearance
 * against every pause state; and every waypoint of a real engine's route
 * (`visibilityTimeline.js`) along its timeline, through both waits.
 *
 * Then hand-derived values from the documented rules at each edge, and seek
 * == sequential: one service or many, any order, and a real engine seeked,
 * played forwards and played backwards.
 *
 * What would move the golden on purpose: nothing planned. SEG-013 leaves this
 * logic as it is, and §8.4 keeps it apart from the area and text visibility
 * rules, which differ on purpose and are not tested here.
 */

import { describe, expect, test } from 'vitest';
import { WAYPOINT_VISIBILITY } from '../src/config/constants.js';
import { MotionVisibilityService } from '../src/services/MotionVisibilityService.js';
import { rounded, seekOrders, visibilityGolden } from './helpers/visibilityGoldens.js';
import { playBackThrough, playThrough, routeEngine, waypointArguments } from './helpers/visibilityTimeline.js';

const pin = visibilityGolden('waypoints');

/** Every mode, and a value the switch does not know, which shows the marker throughout. */
const MODES = { ...WAYPOINT_VISIBILITY, UNRECOGNISED: 'not-a-waypoint-mode' };

const service = () => new MotionVisibilityService();

/** One answer as `[visible, scale, opacity, phase]`, rounded. */
function answer(result) {
  return rounded([result.visible, result.scale, result.opacity, result.phase]);
}

function visibility(mvs, mode, args) {
  return answer(mvs.getWaypointVisibility({}, args.waypointPathProgress, args.currentPathProgress,
    { waypointVisibility: mode }, args.pathDuration, args.prevWaypointProgress, args.nextWaypointProgress,
    args.pauseState ?? null, args.prevWaypointPauseMs ?? 0));
}

/**
 * Where each waypoint sits, and its windows' edges worked out by hand from
 * the rule (the ideal 250 ms of travel as a share of the path, held to 1–8%
 * and to the space each side, the start never before the previous waypoint).
 */
const LAYOUTS = {
  // 250 ms of 10 s is 2.5% of the path; the neighbours are 30% away.
  middle: { wp: 0.5, prev: 0.2, next: 0.8, pathMs: 10000, inStart: 0.475, outEnd: 0.525 },
  // The first uses all the distance from the start, which is none: 1%, from 0.
  first: { wp: 0, prev: -1, next: 0.3, pathMs: 10000, inStart: 0, outEnd: 0.025 },
  // The last uses the distance to the end, which is none: its window ends at 1.
  last: { wp: 1, prev: 0.7, next: 2, pathMs: 10000, inStart: 0.975, outEnd: 1 },
  only: { wp: 0.5, prev: -1, next: 2, pathMs: 10000, inStart: 0.475, outEnd: 0.525 },
  // 250 ms of a 1 s path is 25%, held to 8%.
  'short path, window held to 8%': { wp: 0.5, prev: 0.2, next: 0.8, pathMs: 1000, inStart: 0.42, outEnd: 0.58 },
  // 250 ms of a 100 s path is 0.25%, held to 1%.
  'long path, window held to 1%': { wp: 0.5, prev: 0.2, next: 0.8, pathMs: 100000, inStart: 0.49, outEnd: 0.51 },
  // No duration: 1%. Zero travel time from the previous waypoint is a 250 ms
  // deficit, all of it spent in the previous waypoint's 1 s wait.
  'no path duration': { wp: 0.5, prev: 0.2, next: 0.8, pathMs: 0, prevPauseMs: 1000, inStart: 0.49, outEnd: 0.51 },
  // Half of each gap is 1.5%, between the 1% floor and the 2.5% ideal.
  'near neighbours': { wp: 0.5, prev: 0.47, next: 0.53, pathMs: 10000, inStart: 0.485, outEnd: 0.515 },
  // Half of each gap is 0.5%, under the 1% floor: the window is 1%, its start
  // clamped to the previous waypoint. 100 ms of travel, no wait to spend the
  // 150 ms deficit in.
  'tight neighbours': { wp: 0.5, prev: 0.49, next: 0.51, pathMs: 10000, inStart: 0.49, outEnd: 0.51 },
  // 60 ms after the previous waypoint: a 190 ms deficit. The window's start
  // (0.496) is clamped to the previous waypoint (0.5).
  'close, no wait before': { wp: 0.506, prev: 0.5, next: 0.8, pathMs: 10000, prevPauseMs: 0, inStart: 0.5, outEnd: 0.531 },
  // A 100 ms wait spends 100 of the 190 ms: the travel starts 40% through the curve.
  'close, short wait before': { wp: 0.506, prev: 0.5, next: 0.8, pathMs: 10000, prevPauseMs: 100, inStart: 0.5, outEnd: 0.531 },
  // A 1 s wait spends all 190 ms: the travel starts 76% through.
  'close, long wait before': { wp: 0.506, prev: 0.5, next: 0.8, pathMs: 10000, prevPauseMs: 1000, inStart: 0.5, outEnd: 0.531 },
  // On a 100 s path, 0.5% after the previous waypoint is 500 ms: no deficit,
  // but the 1% floor still clamps the window's start to the previous waypoint.
  'long path, close, no deficit': { wp: 0.505, prev: 0.5, next: 0.8, pathMs: 100000, prevPauseMs: 1000, inStart: 0.5, outEnd: 0.515 },
  // The same 60 ms after the first waypoint, whose authored wait the engine
  // skips (a wait at 0% is never taken): the head start is counted anyway.
  'close after the first, its wait skipped': { wp: 0.006, prev: 0, next: 0.3, pathMs: 10000, prevPauseMs: 1000, inStart: 0, outEnd: 0.031 },
};

/** Before the route, its start, before, at and inside each window, the band, its edge, the route's end and past it. */
function samplesFor({ wp, inStart, outEnd }) {
  const labelled = [
    ['before the route', -0.05], ['route start', 0], ['before the window', inStart - 0.005],
    ['window starts', inStart], ['halfway in', (inStart + wp) / 2], ['just short', wp - 0.0001],
    ['at the waypoint', wp], ['in the band', wp + 0.0005], ['band edge', wp + 0.001],
    ['halfway out', (wp + outEnd) / 2], ['window ends', outEnd], ['after the window', outEnd + 0.005],
    ['route end', 1], ['past the route', 1.05],
  ];
  return labelled.map(([label, t]) => [`${label} (${rounded(t)})`, rounded(t)]);
}

function layoutArgs(layout, currentPathProgress, pauseState = null) {
  return {
    waypointPathProgress: layout.wp,
    currentPathProgress,
    pathDuration: layout.pathMs,
    prevWaypointProgress: layout.prev,
    nextWaypointProgress: layout.next,
    pauseState,
    prevWaypointPauseMs: layout.prevPauseMs ?? 0,
  };
}

/**
 * Pause states while the head is held at the previous waypoint (0.5) of the
 * close layouts. The deficit is 190 ms, so in a 1 s wait the appearance
 * starts 810 ms in; in a 100 ms wait, at once.
 */
const PAUSE_STATES = [
  ['none', null],
  ['not waiting', { isWaiting: false, waypointProgress: 0.5, elapsed: 900, total: 1000 }],
  ['1 s wait, 0 ms in', { isWaiting: true, waypointProgress: 0.5, elapsed: 0, total: 1000 }],
  ['1 s wait, 800 ms in', { isWaiting: true, waypointProgress: 0.5, elapsed: 800, total: 1000 }],
  ['1 s wait, 810 ms in', { isWaiting: true, waypointProgress: 0.5, elapsed: 810, total: 1000 }],
  ['1 s wait, 905 ms in', { isWaiting: true, waypointProgress: 0.5, elapsed: 905, total: 1000 }],
  ['1 s wait, 999 ms in', { isWaiting: true, waypointProgress: 0.5, elapsed: 999, total: 1000 }],
  ['1 s wait, all of it in', { isWaiting: true, waypointProgress: 0.5, elapsed: 1000, total: 1000 }],
  ['100 ms wait, 0 ms in', { isWaiting: true, waypointProgress: 0.5, elapsed: 0, total: 100 }],
  ['100 ms wait, 50 ms in', { isWaiting: true, waypointProgress: 0.5, elapsed: 50, total: 100 }],
  ['a wait of no length', { isWaiting: true, waypointProgress: 0.5, elapsed: 0, total: 0 }],
  ['waiting elsewhere', { isWaiting: true, waypointProgress: 0.2, elapsed: 905, total: 1000 }],
  ['waiting within the tolerance', { isWaiting: true, waypointProgress: 0.50005, elapsed: 905, total: 1000 }],
  ['waiting just outside the tolerance', { isWaiting: true, waypointProgress: 0.5002, elapsed: 905, total: 1000 }],
];

const CLOSE_LAYOUTS = ['close, no wait before', 'close, short wait before', 'close, long wait before', 'no path duration',
  'long path, close, no deficit'];

/**
 * Instants along the route fixture (`visibilityTimeline.js`: A 0, B 0.3 with
 * a 1 s wait, C 0.6 with a 2 s wait, D 0.606, E 1; waits 3000–4000 and
 * 7000–9000 ms; path done at 13000 ms), on a 5 ms grid: each waypoint's
 * windows and band, both waits, and D's appearance in the last 190 ms of C's.
 */
const TIMELINE = [
  ['start', 0], ['travel', 1000], ['B window starts', 2750], ['halfway into B', 2875], ['B wait starts', 3000],
  ['B wait', 3500], ['B wait ends', 4000], ['in B\'s band', 4005], ['halfway out of B', 4125],
  ['B window ends', 4250], ['travel', 5000], ['C window starts', 6750], ['C wait starts', 7000], ['C wait', 8000],
  ['before D appears', 8800], ['D starts appearing', 8810], ['D appearing', 8900], ['D nearly there', 8990],
  ['C wait ends', 9000], ['halfway into D', 9030], ['at D', 9060], ['C window ends', 9100],
  ['halfway out of D', 9185], ['D window ends', 9310], ['travel', 11000], ['E window starts', 12750],
  ['halfway into E', 12875], ['at the end', 13000], ['past the end', 13500],
];

function routeRow(mvs, engine, waypoints, progressValues, mode) {
  return Object.fromEntries(waypointArguments(engine, waypoints, progressValues)
    .map(args => [args.id, visibility(mvs, mode, args)]));
}

describe('the waypoint mode matrix (golden)', () => {
  test.each(Object.entries(MODES))('%s, every layout and sample', (name, mode) => {
    for (const [layoutName, layout] of Object.entries(LAYOUTS)) {
      const rows = Object.fromEntries(samplesFor(layout)
        .map(([label, t]) => [label, visibility(service(), mode, layoutArgs(layout, t))]));
      pin(`${name} ${layoutName}`, rows);
    }
  });

  test.each(Object.entries(MODES))('%s, held at the previous waypoint, every pause state', (name, mode) => {
    for (const layoutName of CLOSE_LAYOUTS) {
      const layout = LAYOUTS[layoutName];
      const held = layout.prev;
      const rows = Object.fromEntries(PAUSE_STATES.map(([label, pauseState]) =>
        [label, visibility(service(), mode, layoutArgs(layout, held, pauseState))]));
      pin(`${name} ${layoutName} held at the previous waypoint`, rows);
    }
  });

  test.each(Object.entries(MODES))('%s, the route\'s waypoints along its timeline', (name, mode) => {
    const rows = {};
    for (const [label, ms] of TIMELINE) {
      const { engine, waypoints, progressValues } = routeEngine();
      engine.seekToTime(ms);
      rows[`${ms} ${label}`] = routeRow(service(), engine, waypoints, progressValues, mode);
    }
    pin(`${name} route timeline`, rows);
  });

  test('every mode is in the matrix', () => {
    expect(Object.keys(WAYPOINT_VISIBILITY)).toEqual(['ALWAYS_SHOW', 'HIDE_BEFORE', 'HIDE_AFTER',
      'HIDE_BEFORE_AND_AFTER', 'ALWAYS_HIDE']);
    expect(Object.values(WAYPOINT_VISIBILITY).every(mode => Object.values(MODES).includes(mode))).toBe(true);
  });
});

describe('the waypoint modes, derived by hand from their documented rules', () => {
  const { ALWAYS_SHOW, HIDE_BEFORE, HIDE_AFTER, HIDE_BEFORE_AND_AFTER, ALWAYS_HIDE } = WAYPOINT_VISIBILITY;
  const at = (mode, layoutName, t, pauseState = null) => visibility(service(), mode, layoutArgs(LAYOUTS[layoutName], t, pauseState));
  const waiting = (elapsed, total = 1000) => ({ isWaiting: true, waypointProgress: 0.5, elapsed, total });

  test('always show and always hide never animate, even where the others pre-animate', () => {
    for (const t of [-0.05, 0.475, 0.5, 0.5125, 1.05]) {
      expect(at(ALWAYS_SHOW, 'middle', t)).toEqual([true, 1, 1, 'always-show']);
      expect(at(ALWAYS_HIDE, 'middle', t)).toEqual([false, 0, 0, 'always-hide']);
    }
    expect(at(ALWAYS_SHOW, 'close, long wait before', 0.5, waiting(905))).toEqual([true, 1, 1, 'always-show']);
    expect(at(ALWAYS_HIDE, 'close, long wait before', 0.5, waiting(905))).toEqual([false, 0, 0, 'always-hide']);
  });

  test('hide before: hidden, then a cubic ease-out over the window, then shown', () => {
    expect(at(HIDE_BEFORE, 'middle', 0.47)).toEqual([false, 0, 0, 'before-hidden']);
    // The window's first instant shows the marker, at no size.
    expect(at(HIDE_BEFORE, 'middle', 0.475)).toEqual([true, 0, 1, 'animating-in']);
    // Halfway: 1 − 0.5³.
    expect(at(HIDE_BEFORE, 'middle', 0.4875)).toEqual([true, 0.875, 1, 'animating-in']);
    expect(at(HIDE_BEFORE, 'middle', 0.5)).toEqual([true, 1, 1, 'at-waypoint']);
    expect(at(HIDE_BEFORE, 'middle', 0.5125)).toEqual([true, 1, 1, 'leaving']);
    expect(at(HIDE_BEFORE, 'middle', 0.525)).toEqual([true, 1, 1, 'after-visible']);
    expect(at(HIDE_BEFORE, 'middle', 1.05)).toEqual([true, 1, 1, 'after-visible']);
  });

  test('hide after: shown, then a cubic ease-in out of the band, then hidden', () => {
    expect(at(HIDE_AFTER, 'middle', 0.47)).toEqual([true, 1, 1, 'before-visible']);
    expect(at(HIDE_AFTER, 'middle', 0.4875)).toEqual([true, 1, 1, 'approaching']);
    expect(at(HIDE_AFTER, 'middle', 0.5005)).toEqual([true, 1, 1, 'at-waypoint']);
    // Out of the band the curve is measured from the waypoint: 0.001 of 0.025 is 4%, 1 − 0.04³.
    expect(at(HIDE_AFTER, 'middle', 0.501)).toEqual([true, 0.999936, 1, 'animating-out']);
    // Halfway: 1 − 0.5³.
    expect(at(HIDE_AFTER, 'middle', 0.5125)).toEqual([true, 0.875, 1, 'animating-out']);
    expect(at(HIDE_AFTER, 'middle', 0.525)).toEqual([false, 0, 0, 'after-hidden']);
  });

  test('hide before and after does both, and is whole only in the band', () => {
    expect(at(HIDE_BEFORE_AND_AFTER, 'middle', 0.47)).toEqual([false, 0, 0, 'before-hidden']);
    expect(at(HIDE_BEFORE_AND_AFTER, 'middle', 0.4875)).toEqual([true, 0.875, 1, 'animating-in']);
    expect(at(HIDE_BEFORE_AND_AFTER, 'middle', 0.5)).toEqual([true, 1, 1, 'at-waypoint']);
    expect(at(HIDE_BEFORE_AND_AFTER, 'middle', 0.5125)).toEqual([true, 0.875, 1, 'animating-out']);
    expect(at(HIDE_BEFORE_AND_AFTER, 'middle', 0.53)).toEqual([false, 0, 0, 'after-hidden']);
  });

  test('the window is held to 1–8% of the path, and to the space each side', () => {
    // 8% (a 1 s path): halfway in is 0.46.
    expect(at(HIDE_BEFORE, 'short path, window held to 8%', 0.46)).toEqual([true, 0.875, 1, 'animating-in']);
    expect(at(HIDE_BEFORE, 'short path, window held to 8%', 0.419)).toEqual([false, 0, 0, 'before-hidden']);
    // 1% (a 100 s path): halfway out is 0.505.
    expect(at(HIDE_AFTER, 'long path, window held to 1%', 0.505)).toEqual([true, 0.875, 1, 'animating-out']);
    expect(at(HIDE_AFTER, 'long path, window held to 1%', 0.511)).toEqual([false, 0, 0, 'after-hidden']);
    // The first waypoint has no window before it: at the start it is in its band.
    expect(at(HIDE_BEFORE, 'first', 0)).toEqual([true, 1, 1, 'at-waypoint']);
    expect(at(HIDE_BEFORE, 'first', -0.05)).toEqual([false, 0, 0, 'before-hidden']);
    // The last has no window after it: at and past the end, the band, then gone.
    expect(at(HIDE_AFTER, 'last', 1)).toEqual([true, 1, 1, 'at-waypoint']);
    expect(at(HIDE_AFTER, 'last', 1.05)).toEqual([false, 0, 0, 'after-hidden']);
  });

  test('a close waypoint picks its curve up where the previous waypoint\'s wait left it', () => {
    // 190 ms of a 250 ms appearance is spent in a 1 s wait: the travel starts at 76%, 1 − 0.24³.
    expect(at(HIDE_BEFORE, 'close, long wait before', 0.5)).toEqual([true, 0.986176, 1, 'animating-in']);
    // A 100 ms wait spends 100 ms: 40%, 1 − 0.6³.
    expect(at(HIDE_BEFORE, 'close, short wait before', 0.5)).toEqual([true, 0.784, 1, 'animating-in']);
    // No wait, no head start: the window's first instant shows it at no size.
    expect(at(HIDE_BEFORE, 'close, no wait before', 0.5)).toEqual([true, 0, 1, 'animating-in']);
    // Before the previous waypoint, still hidden: the window never starts earlier.
    expect(at(HIDE_BEFORE, 'close, long wait before', 0.499)).toEqual([false, 0, 0, 'before-hidden']);
    // No path duration: the whole 250 ms is a deficit, spent in the wait, so it is whole from the start.
    expect(at(HIDE_BEFORE, 'no path duration', 0.49)).toEqual([true, 1, 1, 'animating-in']);
    // Hide after has no appearance to start early.
    expect(at(HIDE_AFTER, 'close, long wait before', 0.5)).toEqual([true, 1, 1, 'approaching']);
  });

  test('during the previous waypoint\'s wait, the appearance runs on the wait\'s clock', () => {
    // A 1 s wait: the last 190 ms of it.
    expect(at(HIDE_BEFORE, 'close, long wait before', 0.5, waiting(800))).toEqual([false, 0, 0, 'before-hidden']);
    expect(at(HIDE_BEFORE, 'close, long wait before', 0.5, waiting(810))).toEqual([true, 0, 1, 'pre-animating-in']);
    // 95 ms in: 38% of the curve, 1 − 0.62³.
    expect(at(HIDE_BEFORE, 'close, long wait before', 0.5, waiting(905))).toEqual([true, 0.761672, 1, 'pre-animating-in']);
    // At the wait's end it reaches exactly the scale the travel picks up from.
    expect(at(HIDE_BEFORE, 'close, long wait before', 0.5, waiting(1000))).toEqual([true, 0.986176, 1, 'pre-animating-in']);
    expect(at(HIDE_BEFORE, 'close, long wait before', 0.5)).toEqual([true, 0.986176, 1, 'animating-in']);
    // A wait shorter than the deficit is all appearance: 50 ms in is 20%, 1 − 0.8³.
    expect(at(HIDE_BEFORE, 'close, short wait before', 0.5, waiting(50, 100))).toEqual([true, 0.488, 1, 'pre-animating-in']);
    // Hide before and after appears the same way.
    expect(at(HIDE_BEFORE_AND_AFTER, 'close, long wait before', 0.5, waiting(905)))
      .toEqual([true, 0.761672, 1, 'pre-animating-in']);
    // A wait somewhere else, or of no length, leaves it to the travel rule.
    expect(at(HIDE_BEFORE, 'close, long wait before', 0.5, { ...waiting(905), waypointProgress: 0.2 }))
      .toEqual([true, 0.986176, 1, 'animating-in']);
    expect(at(HIDE_BEFORE, 'close, long wait before', 0.5, waiting(0, 0))).toEqual([true, 0.986176, 1, 'animating-in']);
  });

  test('on the route, D appears in the last 190 ms of C\'s wait and carries on seamlessly', () => {
    const atMs = (ms) => {
      const { engine, waypoints, progressValues } = routeEngine();
      engine.seekToTime(ms);
      return routeRow(service(), engine, waypoints, progressValues, HIDE_BEFORE).D;
    };
    expect(atMs(8800)).toEqual([false, 0, 0, 'before-hidden']);
    expect(atMs(8810)).toEqual([true, 0, 1, 'pre-animating-in']);
    // 90 ms in: 36%, 1 − 0.64³.
    expect(atMs(8900)).toEqual([true, 0.737856, 1, 'pre-animating-in']);
    // The wait over, the travel starts at 76%.
    expect(atMs(9000)).toEqual([true, 0.986176, 1, 'animating-in']);
    // Halfway there: 76% + 24% / 2 = 88%, 1 − 0.12³.
    expect(atMs(9030)).toEqual([true, 0.998272, 1, 'animating-in']);
    expect(atMs(9060)).toEqual([true, 1, 1, 'at-waypoint']);
  });

  test('candidate defect: a waypoint just after the first appears nearly whole at the start', () => {
    // The renderer passes the first waypoint's authored wait as the head
    // start's budget, but the engine never waits at 0% (PlayerCore skips it),
    // so nothing was spent: a waypoint 60 ms of travel in, hiding before,
    // shows at 98.6% on the first frame instead of growing from nothing.
    // Every new waypoint is authored with a 1.5 s wait.
    const route = [
      { id: 'A', progress: 0, pauseTime: 1500 }, { id: 'B', progress: 0.006, pauseTime: 0 }, { id: 'C', progress: 1, pauseTime: 0 },
    ];
    const { engine, waypoints, progressValues } = routeEngine({ route });
    expect(engine.pauseMarkers).toEqual([]);
    engine.seekToTime(0);
    expect(routeRow(service(), engine, waypoints, progressValues, HIDE_BEFORE).B).toEqual([true, 0.986176, 1, 'animating-in']);
    // With no wait authored on the first, it grows from nothing.
    const { engine: plain, waypoints: plainWaypoints } = routeEngine({ route: route.map(each => ({ ...each, pauseTime: 0 })) });
    plain.seekToTime(0);
    expect(routeRow(service(), plain, plainWaypoints, progressValues, HIDE_BEFORE).B).toEqual([true, 0, 1, 'animating-in']);
  });

  test('an unrecognised mode shows the marker whole throughout, with the animating modes\' phases', () => {
    expect(at(MODES.UNRECOGNISED, 'middle', 0.47)).toEqual([true, 1, 1, 'before-visible']);
    expect(at(MODES.UNRECOGNISED, 'middle', 0.4875)).toEqual([true, 1, 1, 'approaching']);
    expect(at(MODES.UNRECOGNISED, 'middle', 0.5125)).toEqual([true, 1, 1, 'leaving']);
    expect(at(MODES.UNRECOGNISED, 'middle', 0.6)).toEqual([true, 1, 1, 'after-visible']);
    expect(at(MODES.UNRECOGNISED, 'close, long wait before', 0.5, waiting(905))).toEqual([true, 1, 1, 'approaching']);
  });
});

describe('the waypoint modes, seek == sequential', () => {
  test.each(Object.entries(MODES))('%s, one service or many, in any order', (name, mode) => {
    const instants = [
      ...Object.values(LAYOUTS).flatMap(layout => samplesFor(layout).map(([, t]) => layoutArgs(layout, t))),
      ...CLOSE_LAYOUTS.flatMap(layoutName => PAUSE_STATES.map(([, pauseState]) =>
        layoutArgs(LAYOUTS[layoutName], LAYOUTS[layoutName].prev, pauseState))),
    ];
    const { cold, forwards, backwards, scrambled } = seekOrders(instants, service, (mvs, args) => visibility(mvs, mode, args));
    expect(forwards).toEqual(cold);
    expect(backwards).toEqual(cold);
    expect(scrambled).toEqual(cold);
  });

  test.each(Object.entries(MODES))('%s, seeked or played on a real engine', (name, mode) => {
    const instants = TIMELINE.map(([, ms]) => ms);
    const cold = instants.map((ms) => {
      const { engine, waypoints, progressValues } = routeEngine();
      engine.seekToTime(ms);
      return routeRow(service(), engine, waypoints, progressValues, mode);
    });

    const rig = () => ({ ...routeEngine(), mvs: service() });
    const seeked = seekOrders(instants, rig, ({ engine, waypoints, progressValues, mvs }, ms) => {
      engine.seekToTime(ms);
      return routeRow(mvs, engine, waypoints, progressValues, mode);
    });
    expect(seeked.forwards).toEqual(cold);
    expect(seeked.backwards).toEqual(cold);
    expect(seeked.scrambled).toEqual(cold);

    // Played at 200 fps, every waypoint asked at every frame on the way.
    const played = rig();
    const evaluate = () => routeRow(played.mvs, played.engine, played.waypoints, played.progressValues, mode);
    const forwards = playThrough(played.engine, instants, 5, evaluate, evaluate);
    expect(instants.map(ms => forwards.get(ms))).toEqual(cold);
    const backwards = playBackThrough(played.engine, instants, 5, evaluate, evaluate);
    expect(instants.map(ms => backwards.get(ms))).toEqual(cold);
  });
});
