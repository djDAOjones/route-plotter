/**
 * TST-03 — the reveal masks, characterised as they stand.
 *
 * Two background modes reveal the image through a mask that
 * `MotionVisibilityService` paints on an off-screen canvas each frame and the
 * renderer composites with `destination-in`: the spotlight reveal
 * (`buildSpotlightRevealMask`: a feathered disc at every passed path point,
 * fading behind the head when REVEAL-01's trail is shorter than the whole
 * path, plus one at the head's exact position) and the angle-of-view reveal
 * (`buildAOVRevealMask`: a cone at every passed point, aimed forward along the
 * path or at the next waypoint, turned at most 5° a point, joined by
 * corridors and in-between cones, with its own rules while waiting at a
 * waypoint). Both grow from nothing over a one-second intro. The mask canvas
 * is reused, and each build clears and repaints it from the path's start,
 * which is what lets a scrub run backwards.
 *
 * A mask is read here as `tests/setup.js` records it: the calls painted on it
 * since it was last emptied (by a full clear, a resize or being made), in
 * `drawLog.js`'s text, three decimal places, each draw with the state it draws
 * with (`state: 'drawn'`: its transform, alpha, compositing and fill), since a
 * clear empties pixels, not the context's state: an alpha of 0 set before the
 * clear would otherwise leave a mask that reveals nothing reading the same
 * (Codex's review of TST-03). The recorder keeps no clip region, so a build
 * that clips its mask fails here until the clip is pinned on purpose. Pinned
 * (`tests/goldens/visibility-masks.json`): each builder across its settings
 * (spotlight size, feather including BUG-02's zero, REVEAL-01's trail at its
 * sentinel, mid-range and minimum; cone angle, distance and dropoff, with and
 * without waypoints, approaching a waypoint), the intro, the degenerate
 * inputs, and both along a real engine's timeline with its intro and a wait.
 *
 * Then hand-derived geometry at the boundaries, and seek == sequential: the
 * mask built cold equals the mask built after any other builds on the same
 * service, in any order, at another canvas size in between, and seeked,
 * played forwards and played backwards on a real engine, compared with the
 * state each draw used, so a style left over from an earlier build would
 * show.
 *
 * What would move the golden on purpose: §20 Q10 (one intro curve and one
 * time base for the four background modes; the spotlight reveal's intro is
 * never seen today, pinned below), and SPL-02 only if it changes a draw.
 */

import { describe, expect, test } from 'vitest';
import { BACKGROUND_VISIBILITY, MOTION } from '../src/config/constants.js';
import { MotionVisibilityService } from '../src/services/MotionVisibilityService.js';
import { discardFrame, takeFrame } from './helpers/drawLog.js';
import { rounded, seekOrders, visibilityGolden } from './helpers/visibilityGoldens.js';
import { playBackThrough, playThrough, routeEngine } from './helpers/visibilityTimeline.js';

const pin = visibilityGolden('masks');

const WIDTH = 200;
const HEIGHT = 100;
const toCanvas = (x, y) => ({ x: x * WIDTH, y: y * HEIGHT });

/**
 * Nine points 20 px apart on a 200 × 100 canvas: right along the top, a
 * right-angle turn down at the fifth (progress 0.5), and a right-angle turn
 * back to the right for the last. Point i sits at progress i / 8.
 */
const PATH = [
  [0.1, 0.2], [0.2, 0.2], [0.3, 0.2], [0.4, 0.2], [0.5, 0.2], [0.5, 0.4], [0.5, 0.6], [0.5, 0.8], [0.6, 0.8],
].map(([x, y]) => ({ x, y }));

/** W0 at the start, W1 at the first turn, W2 at the end. */
const WAYPOINTS = [{ imgX: 0.1, imgY: 0.2 }, { imgX: 0.5, imgY: 0.2 }, { imgX: 0.6, imgY: 0.8 }];
const AT_POINTS = [0, 0.5, 1];
/** W1 a hair past its point, so the point before it is inside the 2% approach zone, not at it. */
const NEAR_POINTS = [0, 0.51, 1];

/**
 * A quarter circle of 41 points (radius 80 px, centred on the canvas's
 * bottom-left), so the cones' forward look of 25 points and their 5° turn
 * limit act on a curve, not on straight legs.
 */
const ARC = Array.from({ length: 41 }, (_, i) => {
  const angle = (Math.PI / 2) * (i / 40);
  return { x: (20 + 80 * Math.sin(angle)) / WIDTH, y: (100 - 80 * Math.cos(angle)) / HEIGHT };
});

const SPOTLIGHT = { revealSize: MOTION.SPOTLIGHT_SIZE_DEFAULT, revealFeather: MOTION.SPOTLIGHT_FEATHER_DEFAULT };
const AOV = { aovAngle: MOTION.AOV_ANGLE_DEFAULT, aovDistance: MOTION.AOV_DISTANCE_DEFAULT, aovDropoff: MOTION.AOV_DROPOFF_DEFAULT };

/**
 * Before the path, at it, inside the first leg, at the turn, past it, at the
 * end, past it. The cone has no answer before the path (it throws, below).
 */
const PROGRESS = [-0.1, 0, 0.05, 0.5, 0.6, 1, 1.05];
const CONE_PROGRESS = PROGRESS.filter(progress => progress >= 0);
const FEW = [0.05, 0.5, 1];

/**
 * What each service's mask canvas holds: the lines painted since it was last
 * emptied. A build that does not empty it adds to what was there.
 */
const held = new WeakMap();

function isEmptying(line, canvas) {
  const clear = `mask clearRect 0 0 ${canvas.width} ${canvas.height}`;
  return line === clear || line.startsWith(`${clear} `) || /^mask canvas\.(width|height) /.test(line);
}

/**
 * Run one build and read the mask it leaves, each draw carrying the styles it
 * used (`drawLog.js`'s `state: 'drawn'`).
 * @returns {{size: number[], lines: string[]}}
 */
function maskAfter(mvs, build, { state = 'drawn' } = {}) {
  discardFrame();
  build(mvs);
  const lines = takeFrame({ motionVisibilityService: mvs }, { state });
  const canvas = mvs.revealMaskCanvas;
  expect(lines.filter(line => !line.startsWith('mask ')), 'a build paints only its mask').toEqual([]);
  expect(lines.filter(line => /^mask clip\b/.test(line)),
    'a build clips its mask, which the recorder cannot follow across a clear: pin the clip on purpose').toEqual([]);
  const before = held.get(mvs);
  let content = before && before.canvas === canvas ? [...before.lines] : [];
  for (const line of lines) {
    if (isEmptying(line, canvas)) content = [];
    else content.push(line);
  }
  held.set(mvs, { canvas, lines: content });
  return { size: [canvas.width, canvas.height], lines: content };
}

const spotlight = (pathPoints, progress, settings, { currentTimeMs = Infinity, transform = toCanvas, size = [WIDTH, HEIGHT] } = {}) =>
  mvs => mvs.buildSpotlightRevealMask(pathPoints, progress, size[0], size[1], settings, transform, currentTimeMs);

const cone = (pathPoints, progress, settings, { waypoints = null, progressValues = null, engine = null,
  currentTimeMs = Infinity, transform = toCanvas, size = [WIDTH, HEIGHT] } = {}) =>
  mvs => mvs.buildAOVRevealMask(pathPoints, progress, size[0], size[1], settings, waypoints, progressValues,
    engine, transform, currentTimeMs);

/** The mask one build leaves on a fresh service. */
const coldMask = (build, options) => maskAfter(new MotionVisibilityService(), build, options);

/** Every case: a builder with fixed settings, and the samples it is pinned at. */
const CASES = {
  'spotlight default': { builder: spotlight, path: PATH, settings: SPOTLIGHT, samples: PROGRESS },
  'spotlight trail 50%, feather 50%': { builder: spotlight, path: PATH, settings: { ...SPOTLIGHT, revealFeather: 50, revealTrail: 50 }, samples: FEW },
  'spotlight shortest trail, widest feather': { builder: spotlight, path: PATH,
    settings: { revealSize: 10, revealFeather: MOTION.SPOTLIGHT_FEATHER_MAX, revealTrail: MOTION.SPOTLIGHT_TRAIL_MIN }, samples: FEW },
  'spotlight largest, feather 1%': { builder: spotlight, path: PATH,
    settings: { revealSize: MOTION.SPOTLIGHT_SIZE_MAX, revealFeather: MOTION.SPOTLIGHT_FEATHER_MIN, revealTrail: MOTION.SPOTLIGHT_TRAIL_MAX }, samples: [0.5] },
  'spotlight untransformed': { builder: spotlight, path: PATH, settings: SPOTLIGHT, samples: [0.5], options: { transform: null } },
  'cone default, no waypoints': { builder: cone, path: PATH, settings: AOV, samples: CONE_PROGRESS },
  'cone default, waypoints': { builder: cone, path: PATH, settings: AOV, samples: CONE_PROGRESS,
    options: { waypoints: WAYPOINTS, progressValues: AT_POINTS } },
  'cone approaching a waypoint': { builder: cone, path: PATH, settings: AOV, samples: FEW,
    options: { waypoints: WAYPOINTS, progressValues: NEAR_POINTS } },
  // W1 a hair before its point: within 0.001, so the point counts as at it.
  'cone with a waypoint just short of its point': { builder: cone, path: PATH, settings: AOV, samples: FEW,
    options: { waypoints: WAYPOINTS, progressValues: [0, 0.4995, 1] } },
  // W1 between points 4 and 5 (0.53 of the path, nearer 4): the forward
  // look from point 4 is cut off at the point W1 rounds to, its own.
  'cone with a waypoint between points': { builder: cone, path: PATH, settings: AOV, samples: FEW,
    options: { waypoints: WAYPOINTS, progressValues: [0, 0.53, 1] } },
  // W1 after the turn, at point 6: its incoming chord from W0 is not the
  // path's own direction, so the head's cone just before it is not blended.
  'cone with a waypoint after the turn': { builder: cone, path: PATH, settings: AOV, samples: [0.5, 0.62, 1],
    options: { waypoints: [WAYPOINTS[0], { imgX: 0.5, imgY: 0.6 }, WAYPOINTS[2]], progressValues: [0, 0.75, 1] } },
  'cone hard edge': { builder: cone, path: PATH, settings: { ...AOV, aovDropoff: MOTION.AOV_DROPOFF_MIN }, samples: [0.5],
    options: { waypoints: WAYPOINTS, progressValues: AT_POINTS } },
  'cone full feather': { builder: cone, path: PATH, settings: { ...AOV, aovDropoff: MOTION.AOV_DROPOFF_MAX }, samples: [0.5],
    options: { waypoints: WAYPOINTS, progressValues: AT_POINTS } },
  'cone narrowest, furthest': { builder: cone, path: PATH,
    settings: { aovAngle: MOTION.AOV_ANGLE_MIN, aovDistance: MOTION.AOV_DISTANCE_MAX, aovDropoff: 50 }, samples: [0.5] },
  'cone widest, nearest': { builder: cone, path: PATH,
    settings: { aovAngle: MOTION.AOV_ANGLE_MAX, aovDistance: MOTION.AOV_DISTANCE_MIN, aovDropoff: 50 }, samples: [0.5] },
  'cone untransformed': { builder: cone, path: PATH, settings: AOV, samples: [0.5],
    options: { waypoints: WAYPOINTS, progressValues: AT_POINTS, transform: null } },
  // Only the cones' arcs (their aim) are pinned on the curve: 41 points of
  // corridors and in-between cones would bury them.
  'cone on a curve, arcs only': { builder: cone, path: ARC, settings: AOV, samples: [0.5, 1], arcsOnly: true },
};

/** The canvas, then wider, then taller too, then only taller. */
const SIZES = [[WIDTH, HEIGHT], [WIDTH + 40, HEIGHT], [WIDTH + 40, HEIGHT + 20], [WIDTH, HEIGHT + 20]];

/** The intro: no size at 0 ms, a quarter at 500 ms (ease-in quad), whole at 1 s. */
const INTRO_MS = [0, 250, 500, 999, 1000];

const mask = (name, progress, overrides = {}) => {
  const { builder, path, settings, options = {} } = CASES[name];
  return builder(path, progress, settings, { ...options, ...overrides });
};

/** Arc lines only, for the curve case. */
const arcs = lines => lines.filter(line => line.startsWith('mask arc '));

/** The mask route: W0, then W1 at the turn with a 1 s wait, then W2 at the end with a 0.5 s one (the beacons' completion wait). */
const MASK_ROUTE = [
  { id: 'W0', progress: 0, pauseTime: 0, imgX: 0.1, imgY: 0.2 },
  { id: 'W1', progress: 0.5, pauseTime: 1000, imgX: 0.5, imgY: 0.2 },
  { id: 'W2', progress: 1, pauseTime: 500, imgX: 0.6, imgY: 0.8 },
];

/**
 * A reveal mode's engine, as Preview times it: a 1 s intro, then 4 s of path
 * with W1's wait (3000–4000 ms) and W2's (6000–6500 ms). On a 50 ms grid.
 */
const maskEngine = () => routeEngine({ route: MASK_ROUTE, pathMs: 4000,
  introMs: MotionVisibilityService.INTRO_ANIMATION.DURATION_MS });

const MASK_TIMELINE = [
  ['intro starts', 0], ['intro', 500], ['intro ends', 1000], ['leaving W0', 1250], ['first leg', 2000],
  ['W1 wait starts', 3000], ['W1 wait', 3500], ['W1 wait ends', 4000], ['second leg', 5000],
  ['W2 wait starts', 6000], ['W2 wait', 6250], ['end', 6500], ['past the end', 7000],
];

/** What the renderer builds at the engine's instant, for each reveal mode (`RenderingService.render`). */
const ENGINE_BUILDS = {
  [BACKGROUND_VISIBILITY.SPOTLIGHT_REVEAL]: (engine, settings) => mvs => mvs.buildSpotlightRevealMask(
    PATH, engine.getPathProgress(), WIDTH, HEIGHT, settings, toCanvas, engine.getTime()),
  [BACKGROUND_VISIBILITY.ANGLE_OF_VIEW_REVEAL]: (engine, settings, waypoints) => mvs => mvs.buildAOVRevealMask(
    PATH, engine.getPathProgress(), WIDTH, HEIGHT, settings, waypoints, MASK_ROUTE.map(each => each.progress),
    engine, toCanvas, engine.getTime()),
};
const ENGINE_SETTINGS = {
  [BACKGROUND_VISIBILITY.SPOTLIGHT_REVEAL]: { ...SPOTLIGHT, revealTrail: 50 },
  [BACKGROUND_VISIBILITY.ANGLE_OF_VIEW_REVEAL]: AOV,
};

describe('the reveal masks (golden)', () => {
  test.each(Object.keys(CASES))('%s', (name) => {
    const { samples, arcsOnly } = CASES[name];
    const rows = {};
    for (const progress of samples) {
      const { size, lines } = coldMask(mask(name, progress));
      rows[`at ${progress}`] = { size, lines: arcsOnly ? arcs(lines) : lines };
    }
    pin(name, rows);
  });

  test.each(['spotlight default', 'spotlight trail 50%, feather 50%', 'cone default, waypoints'])('%s through its intro', (name) => {
    const rows = {};
    for (const currentTimeMs of INTRO_MS) {
      rows[`at 0.5, ${currentTimeMs} ms`] = coldMask(mask(name, 0.5, { currentTimeMs }));
    }
    rows['at 0, 0 ms'] = coldMask(mask(name, 0, { currentTimeMs: 0 }));
    rows['at 0, 500 ms'] = coldMask(mask(name, 0, { currentTimeMs: 500 }));
    pin(`${name} intro`, rows);
  });

  test('degenerate inputs leave an empty mask of the canvas\'s size', () => {
    const rows = {
      'spotlight, no path': coldMask(spotlight(null, 0.5, SPOTLIGHT)),
      'spotlight, empty path': coldMask(spotlight([], 0.5, SPOTLIGHT)),
      'spotlight, one point': coldMask(spotlight([PATH[0]], 0.5, SPOTLIGHT)),
      'cone, no path': coldMask(cone(null, 0.5, AOV)),
      'cone, one point': coldMask(cone([PATH[0]], 0.5, AOV)),
      'cone, two points': coldMask(cone(PATH.slice(0, 2), 0.5, AOV)),
      'cone, at the start with no intro left': coldMask(cone(PATH, 0, AOV, { currentTimeMs: 0 })),
    };
    pin('degenerate', rows);
    for (const name of ['spotlight, no path', 'spotlight, empty path', 'cone, no path', 'cone, one point',
      'cone, at the start with no intro left']) {
      expect(rows[name], name).toEqual({ size: [WIDTH, HEIGHT], lines: [] });
    }
  });

  test.each(Object.keys(ENGINE_BUILDS))('%s along a reveal mode\'s timeline', (mode) => {
    const rows = {};
    for (const [label, ms] of MASK_TIMELINE) {
      const { engine, waypoints } = maskEngine();
      engine.seekToTime(ms);
      rows[`${ms} ${label}`] = {
        head: rounded([engine.getPathProgress(), engine.getIntroProgress(), engine.state.isWaitingAtWaypoint]),
        ...coldMask(ENGINE_BUILDS[mode](engine, ENGINE_SETTINGS[mode], waypoints)),
      };
    }
    pin(`${mode} timeline`, rows);
  });

  test('before the path, the cone throws rather than drawing (the engine never gives it a negative progress)', () => {
    // Its comment says only a negative progress with no intro left is skipped;
    // with the intro done, the head's cone reads the point before the first.
    expect(() => coldMask(cone(PATH, -0.1, AOV))).toThrow(TypeError);
    expect(coldMask(spotlight(PATH, -0.1, SPOTLIGHT))).toEqual({ size: [WIDTH, HEIGHT], lines: [] });
  });

  test('the two reveal modes are the background modes that build a mask', () => {
    expect(Object.values(BACKGROUND_VISIBILITY).filter(mode => mode.endsWith('-reveal')))
      .toEqual(Object.keys(ENGINE_BUILDS));
  });
});

/** A transcript line's call, without the state it draws with (` @ …`). */
const call = line => line.split(' @ ')[0];

/** The numbers in one transcript line after its call name. */
const args = line => call(line).split(' ').slice(2).map(Number);

describe('the reveal masks, derived by hand', () => {
  test('a spotlight is a disc 10% of the canvas\'s mean side at each passed point and at the head', () => {
    // (200 + 100) / 2 × 10% = 15 px; a zero feather leaves a half-pixel edge (BUG-02).
    const { lines } = coldMask(mask('spotlight default', 0.5));
    // 9 × 0.5 = 4.5: points 0–4, then the head halfway from point 4 to 5, at (100, 30).
    expect(arcs(lines).map(call)).toEqual(['mask arc 20 20 15 0 6.283', 'mask arc 40 20 15 0 6.283', 'mask arc 60 20 15 0 6.283',
      'mask arc 80 20 15 0 6.283', 'mask arc 100 20 15 0 6.283', 'mask arc 100 30 15 0 6.283']);
    const centres = [[20, 20], [40, 20], [60, 20], [80, 20], [100, 20], [100, 30]];
    expect(lines.filter(line => line.includes('createRadialGradient')).map(args))
      .toEqual(centres.map(([x, y]) => [x, y, 14.5, x, y, 15]));
    expect(lines[0]).toBe('mask set:globalCompositeOperation source-over');
  });

  test('a REVEAL-01 trail fades each point by how far behind the head it is', () => {
    // A 50% trail with the head at index 4.5 of 9: point i keeps i / 4.5, so point 0 is not drawn.
    const { lines } = coldMask(mask('spotlight trail 50%, feather 50%', 0.5));
    const alphas = lines.filter(line => / 0 rgba\(/.test(line)).map(line => Number(/, ([\d.]+)\)$/.exec(line)[1]));
    expect(rounded(alphas)).toEqual(rounded([1 / 4.5, 2 / 4.5, 3 / 4.5, 4 / 4.5, 1]));
    expect(arcs(lines)).toHaveLength(5);
    // Feather 50% of 15 px: the gradient starts 7.5 px out.
    expect(args(lines.find(line => line.includes('createRadialGradient')))).toEqual([40, 20, 7.5, 40, 20, 15]);
  });

  test('the intro grows the spotlight by the square of the elapsed share of a second', () => {
    const radius = (ms) => args(arcs(coldMask(mask('spotlight default', 0.5, { currentTimeMs: ms })).lines)[0])[2];
    expect([0, 250, 500, 1000].map(radius)).toEqual([0, 0.938, 3.75, 15]);
  });

  test('a cone reaches 25% of the diagonal and is 60° wide, its first aim set by the forward look', () => {
    // No waypoints: the look runs to the last point, (120, 80). From (20, 20) that is atan2(60, 100).
    const { lines } = coldMask(mask('cone default, no waypoints', 0.05));
    const distance = 0.25 * Math.sqrt(WIDTH ** 2 + HEIGHT ** 2);
    const aim = Math.atan2(60, 100);
    const half = Math.PI / 6;
    expect(args(arcs(lines)[0])).toEqual(rounded([20, 20, distance, aim - half, aim + half], 3));
    // A 50% dropoff: solid to halfway, then fading out.
    expect(lines.slice(1, 5)).toEqual(['mask createRadialGradient 20 20 0 20 20 55.902',
      'mask [gradient 1].addColorStop 0 rgba(255, 255, 255, 1)', 'mask [gradient 1].addColorStop 0.5 rgba(255, 255, 255, 1)',
      'mask [gradient 1].addColorStop 1 rgba(255, 255, 255, 0)']);
  });

  test('a cone turns at most 5° a point', () => {
    // From (40, 20) the look aims at atan2(60, 80), 5.9° past the first cone: held to 5°.
    const { lines } = coldMask(mask('cone default, no waypoints', 0.25));
    const aims = arcs(lines).map(line => (args(line)[3] + args(line)[4]) / 2);
    expect(rounded(aims[0], 3)).toBe(rounded(Math.atan2(60, 100), 3));
    expect(rounded(aims[1] - aims[0], 3)).toBe(rounded(Math.PI / 36, 3));
  });

  test('a cone\'s dropoff is its gradient: none at 0%, from the tip at 100%, 50% when unset', () => {
    const hard = coldMask(mask('cone hard edge', 0.5)).lines;
    expect(hard.some(line => line.includes('Gradient'))).toBe(false);
    expect(new Set(hard.filter(line => line.startsWith('mask set:fillStyle')))).toEqual(new Set(['mask set:fillStyle rgba(255, 255, 255, 1)']));
    const soft = coldMask(mask('cone full feather', 0.5)).lines;
    const stops = soft.filter(line => line.includes('addColorStop')).map(line => line.split('.addColorStop ')[1]);
    const gradients = soft.filter(line => line.includes('createRadialGradient')).length;
    expect(gradients).toBeGreaterThan(0);
    expect(stops).toEqual(Array.from({ length: gradients }, () => ['0 rgba(255, 255, 255, 1)', '1 rgba(255, 255, 255, 0)']).flat());
    const unset = { waypoints: WAYPOINTS, progressValues: AT_POINTS };
    const standard = coldMask(cone(PATH, 0.5, AOV, unset));
    expect(coldMask(cone(PATH, 0.5, { ...AOV, aovDropoff: null }, unset))).toEqual(standard);
    expect(coldMask(cone(PATH, 0.5, { ...AOV, aovDropoff: Number.NaN }, unset))).toEqual(standard);
  });

  test('waiting at a waypoint, the head\'s cone sits on it and looks back the way it came', () => {
    const { engine, waypoints } = maskEngine();
    engine.seekToTime(3500);
    expect(engine.state.isWaitingAtWaypoint).toBe(true);
    const { lines } = coldMask(ENGINE_BUILDS[BACKGROUND_VISIBILITY.ANGLE_OF_VIEW_REVEAL](engine, AOV, waypoints));
    const head = args(arcs(lines).at(-1));
    // W1 is at (100, 20); W0 → W1 points along +x, so the cone straddles 0.
    expect(head.slice(0, 3)).toEqual([100, 20, 55.902]);
    expect(rounded(head[3] + head[4], 3)).toBe(0);
  });

  test('the cone\'s intro follows the engine\'s intro clock when it has one', () => {
    const at = (ms) => {
      const { engine, waypoints } = maskEngine();
      engine.seekToTime(ms);
      return coldMask(ENGINE_BUILDS[BACKGROUND_VISIBILITY.ANGLE_OF_VIEW_REVEAL](engine, AOV, waypoints)).lines;
    };
    // Halfway through the intro: a quarter of 55.902, at the start.
    expect(args(arcs(at(500))[0]).slice(0, 3)).toEqual([20, 20, 13.975]);
    expect(at(0)).toEqual([]);
  });

  test('without an engine intro, the cone grows on the time-based fallback', () => {
    const { engine, waypoints } = routeEngine({ route: MASK_ROUTE, pathMs: 4000 });
    engine.seekToTime(500);
    expect(engine.introTime).toBe(0);
    const { lines } = coldMask(ENGINE_BUILDS[BACKGROUND_VISIBILITY.ANGLE_OF_VIEW_REVEAL](engine, AOV, waypoints));
    // 500 ms of the 1 s intro: a quarter of 55.902.
    expect(args(arcs(lines)[0])[2]).toBe(13.975);
  });

  test('§20 Q10, pinned: the spotlight reveal shows nothing during its intro, then appears whole', () => {
    // The intro holds the head at the start, and a spotlight at progress 0
    // paints nothing; by the time the head moves, a second has passed and
    // the intro scale is 1. So the spotlight reveal's intro is never seen,
    // while the cone's grows from the start.
    const at = (ms) => {
      const { engine, waypoints } = maskEngine();
      engine.seekToTime(ms);
      return coldMask(ENGINE_BUILDS[BACKGROUND_VISIBILITY.SPOTLIGHT_REVEAL](engine, ENGINE_SETTINGS[BACKGROUND_VISIBILITY.SPOTLIGHT_REVEAL], waypoints)).lines;
    };
    expect(at(500)).toEqual([]);
    expect(at(999)).toEqual([]);
    expect(args(arcs(at(1250)).at(-1))[2]).toBe(15);
  });
});

describe('the reveal masks, seek == sequential', () => {
  test.each(Object.keys(CASES))('%s, built on one service or many, in any order, the canvas resized between', (name) => {
    const { samples } = CASES[name];
    // Each instant at each size in turn, so consecutive builds change the
    // width alone, then the height alone, as a window resize can.
    const instants = [
      ...samples.map(progress => ({ progress })),
      ...INTRO_MS.map(currentTimeMs => ({ progress: 0.5, currentTimeMs })),
    ].flatMap(instant => SIZES.map(size => ({ ...instant, size })));
    const build = (mvs, { progress, ...overrides }) => maskAfter(mvs, mask(name, progress, overrides), { state: 'drawn' });
    const { cold, forwards, backwards, scrambled } = seekOrders(instants, () => new MotionVisibilityService(), build);
    expect(forwards).toEqual(cold);
    expect(backwards).toEqual(cold);
    expect(scrambled).toEqual(cold);
    expect(cold.map(each => each.size)).toEqual(instants.map(each => each.size));
  });

  test.each(Object.keys(ENGINE_BUILDS))('%s, seeked or played on a real engine', (mode) => {
    const settings = ENGINE_SETTINGS[mode];
    const instants = MASK_TIMELINE.map(([, ms]) => ms);
    const read = (rig) => maskAfter(rig.mvs, ENGINE_BUILDS[mode](rig.engine, settings, rig.waypoints), { state: 'drawn' });
    const rig = () => ({ ...maskEngine(), mvs: new MotionVisibilityService() });

    const cold = instants.map((ms) => {
      const fresh = rig();
      fresh.engine.seekToTime(ms);
      return read(fresh);
    });
    const seeked = seekOrders(instants, rig, (each, ms) => {
      each.engine.seekToTime(ms);
      return read(each);
    });
    expect(seeked.forwards).toEqual(cold);
    expect(seeked.backwards).toEqual(cold);
    expect(seeked.scrambled).toEqual(cold);

    // Played at 20 fps with a mask built every frame on the way.
    const played = rig();
    const evaluate = () => read(played);
    const forwards = playThrough(played.engine, instants, 50, evaluate, evaluate);
    expect(instants.map(ms => forwards.get(ms))).toEqual(cold);
    const backwards = playBackThrough(played.engine, instants, 50, evaluate, evaluate);
    expect(instants.map(ms => backwards.get(ms))).toEqual(cold);
  });

  test('the canvas a build returns is the one the renderer composites, reused across builds', () => {
    const mvs = new MotionVisibilityService();
    const first = mvs.buildSpotlightRevealMask(PATH, 0.5, WIDTH, HEIGHT, SPOTLIGHT, toCanvas);
    const second = mvs.buildAOVRevealMask(PATH, 0.5, WIDTH, HEIGHT, AOV, null, null, null, toCanvas);
    expect(second).toBe(first);
    expect(mvs.getRevealMask()).toBe(first);
    const resized = mvs.buildAOVRevealMask(PATH, 0.5, WIDTH * 2, HEIGHT, AOV, null, null, null, toCanvas);
    expect(resized).not.toBe(first);
    expect([resized.width, resized.height]).toEqual([WIDTH * 2, HEIGHT]);
  });
});
