/**
 * TST-09 — the curvature cache, characterised as it stands.
 *
 * `PathCalculator` caches each rough spline's curvature under a key made of
 * its first, middle and last points and its length (`_getPathHash`). So a
 * move that leaves those alone is answered with the curvature of the route
 * as it was, and the reparameterised path depends on edit history (DEF-10).
 * With five waypoints the middle rough point is waypoint 2 itself (100 rough
 * points per leg), so moving waypoint 1 or 3 keeps the key. The cache is
 * also never bounded.
 *
 * Each case compares what the warm calculator returns after an edit with a
 * fresh computation of the same input: the curvature, the path, its length.
 * Inserts, deletes and a branch change the key and agree; a move that keeps
 * the key does not, and neither does anything rebuilt from that route until
 * its key changes again. In the booted app the same gap is the editor
 * against the exported player, which computes the path on a calculator of
 * its own. The differences and the cache's growth are pinned
 * (`tests/goldens/domains-curvature.json`); DEF-10's fix (key on the full
 * input, bound the cache) makes every case agree and moves those numbers.
 */

import { describe, expect, test } from 'vitest';
import { CatmullRom } from '../src/utils/CatmullRom.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { PATH } from '../src/config/constants.js';
import { domainGolden, exampleProject, openProject, rounded } from './helpers/domainGoldens.js';

const pin = domainGolden('curvature');

/** The input `calculatePath` gives the calculator (`pathTiming.js` `splineInput`). */
const splineInput = waypoint => ({
  x: waypoint.imgX,
  y: waypoint.imgY,
  isMajor: waypoint.isMajor,
  pathShape: waypoint.pathShape,
  shapeAmplitude: waypoint.shapeAmplitude,
  shapeFrequency: waypoint.shapeFrequency,
});

/** The rough spline the cache is keyed on, as `calculatePath` builds it. */
function roughPath(input) {
  return CatmullRom.createPath(input.map(({ x, y, isMajor }) => ({ x, y, isMajor })),
    PATH.POINTS_PER_SEGMENT, PATH.DEFAULT_TENSION);
}

/**
 * How far apart two paths are: the largest distance between them at the same
 * fraction along, sampled at 1,000 places (they may differ in point count).
 */
function divergence(left, right) {
  if (left.length === 0 || right.length === 0) return left.length === right.length ? 0 : Infinity;
  const calculator = new PathCalculator();
  let worst = 0;
  for (let step = 0; step <= 1000; step += 1) {
    const a = calculator.getPointAtProgress(left, step / 1000);
    const b = calculator.getPointAtProgress(right, step / 1000);
    worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
  }
  return worst;
}

/** Length in thousandths of the image (the reparameteriser's own spacing unit). */
const lengthOf = points => new PathCalculator().calculatePathLength(points) * 1000;

/** What the warm calculator gives for `input`, against a fresh one. */
function compare(warm, input) {
  const rough = roughPath(input);
  const keyKnown = warm._curvatureCache.has(warm._getPathHash(rough));
  const warmPath = warm.calculatePath(input);
  const freshPath = new PathCalculator().calculatePath(input);
  const cachedCurvature = warm._getCachedCurvature(rough);
  const freshCurvature = new PathCalculator()._calculateCurvatureFast(rough);
  return {
    agree: JSON.stringify(warmPath) === JSON.stringify(freshPath),
    curvatureAgrees: JSON.stringify(cachedCurvature) === JSON.stringify(freshCurvature),
    keyKnown,
    cacheSize: warm._curvatureCache.size,
    roughPoints: rough.length,
    points: [warmPath.length, freshPath.length],
    length: [lengthOf(warmPath), lengthOf(freshPath)],
    divergence: divergence(warmPath, freshPath),
  };
}

const trunkOf = project => project.waypoints.filter(waypoint => !waypoint.branchId);

describe('curvature cache — PathCalculator, edit by edit', () => {

  test('cached against fresh after insert, move, delete and a branch (DEF-10)', () => {
    const project = exampleProject('uon-open-day');
    let route = trunkOf(project).map(splineInput); // 1, 2, 2a, 2b, 3
    const branch = project.waypoints.filter(waypoint => waypoint.branchId || ['ex-uon-2', 'ex-uon-3'].includes(waypoint.id));
    const warm = new PathCalculator();
    const steps = {};
    const step = (label, next) => {
      route = next;
      steps[label] = compare(warm, route);
    };

    step('1-initial', route);
    // Waypoint 3 (2b) moves: first, middle and last rough points and the length stay.
    const original = route[3];
    step('2-move-keeping-key', route.map((point, index) => (index === 3 ? { ...point, x: point.x + 0.08, y: point.y - 0.16 } : point)));
    // A minor between 2 and 2a: one more leg, so a new key.
    step('3-insert', [...route.slice(0, 2), { ...route[1], x: 0.46, y: 0.52, isMajor: false }, ...route.slice(2)]);
    // Deleting it puts back the moved route, whose key is the first route's.
    step('4-delete', [...route.slice(0, 2), ...route.slice(3)]);
    // The branch's spline on the same calculator (2 → b1 → 3), then the trunk again.
    steps['5-branch-add'] = compare(warm, branch.map(splineInput));
    step('6-trunk-after-branch', route);
    // Waypoint 2 (2a) moves: the middle rough point moves, so the key changes.
    step('7-move-changing-key', route.map((point, index) => (index === 2 ? { ...point, x: point.x + 0.02 } : point)));
    // Waypoint 3 goes back: the first route again, which the cache does hold.
    step('8-move-back', route.map((point, index) => (index === 3 ? original : point)).map((point, index) => (index === 2 ? { ...point, x: point.x - 0.02 } : point)));

    // What agrees today, and what DEF-10 will make agree.
    const agreeing = Object.fromEntries(Object.entries(steps).map(([label, result]) => [label, result.agree]));
    expect(agreeing).toEqual({
      '1-initial': true,
      '2-move-keeping-key': false,
      '3-insert': true,
      '4-delete': false,
      '5-branch-add': true,
      '6-trunk-after-branch': false,
      '7-move-changing-key': true,
      '8-move-back': true,
    });
    for (const result of Object.values(steps)) expect(result.curvatureAgrees).toBe(result.agree);
    pin('pathCalculator.steps', rounded(steps));
  });

  test('a drag grows the cache by a frame per key it makes, and never shrinks it (DEF-10)', () => {
    const route = trunkOf(exampleProject('uon-open-day')).map(splineInput);
    const sizes = {};
    for (const index of [2, 3]) {
      const calculator = new PathCalculator();
      calculator.calculatePath(route);
      for (let frame = 1; frame <= 30; frame += 1) {
        calculator.calculatePath(route.map((point, at) => (at === index ? { ...point, x: point.x + frame * 0.001 } : point)));
      }
      sizes[`drag-waypoint-${index}`] = calculator._curvatureCache.size;
    }
    // Dragging the middle waypoint makes a key a frame; dragging waypoint 3
    // makes none, so its whole drag is drawn with the first frame's curvature.
    expect(sizes).toEqual({ 'drag-waypoint-2': 31, 'drag-waypoint-3': 1 });
  });
});

describe('curvature cache — the booted editor against the exported player', () => {

  /**
   * Ids the fixture did not author are made of the clock and a random draw;
   * they are named by order of appearance instead, so the golden is stable.
   */
  const AUTHORED = new Set(exampleProject('uon-open-day').waypoints.map(waypoint => waypoint.id).concat('ex-uon-branch'));
  const added = new Map();
  const named = id => (AUTHORED.has(id) ? id : (added.has(id) ? added.get(id) : added.set(id, `added-${added.size + 1}`).get(id)));

  /** The editor's path and timing against a fresh calculator and against the player it exports. */
  async function snapshotOf(app) {
    const trunk = app._trunkWaypoints;
    const fresh = new PathCalculator().calculatePath(trunk.map(splineInput));
    const canvas = document.createElement('canvas');
    const player = new PlayerApp(canvas);
    await player.load(JSON.parse(JSON.stringify(app._buildProjectSnapshot())), app.background.image);
    const branchDivergence = app.branchPaths.map(branch => {
      const theirs = player.branchPaths.find(each => each.id === branch.id);
      return [named(branch.id), theirs ? divergence(branch.pathPoints, theirs.pathPoints) : null];
    });
    return {
      trunk: trunk.map(waypoint => named(waypoint.id)),
      points: { editor: app.pathPoints.length, fresh: fresh.length, player: player.pathPoints.length },
      divergence: { fresh: divergence(app.pathPoints, fresh), player: divergence(app.pathPoints, player.pathPoints) },
      branchDivergence: Object.fromEntries(branchDivergence),
      pathDurationMs: { editor: app.animationEngine.pathDuration, player: player.animationEngine.pathDuration },
      cacheSize: app.pathCalculator._curvatureCache.size,
    };
  }

  test('edits through the app\'s own gestures: what the editor draws against what its export plays (DEF-10)', async () => {
    const app = await openProject(exampleProject('uon-open-day'), { preview: false });
    const byId = id => app.waypoints.find(waypoint => waypoint.id === id);
    const cases = {};

    cases['1-opened'] = await snapshotOf(app);

    // A drag of 2b, as the pointer handler does it: move, then rebuild the path.
    const moved = byId('ex-uon-2b');
    for (let frame = 1; frame <= 5; frame += 1) {
      moved.imgX += 0.016;
      moved.imgY -= 0.032;
      app.calculatePath();
    }
    app.invalidateAnimationTiming();
    cases['2-drag-keeping-key'] = await snapshotOf(app);

    // A minor on the first leg, by the leg's plus.
    app.eventBus.emit('waypoint:insert-on-leg', { waypointIndex: 0, imgX: 0.28, imgY: 0.55 });
    app.invalidateAnimationTiming();
    cases['3-insert-on-leg'] = await snapshotOf(app);

    // And deleted again.
    app.eventBus.emit('waypoint:delete', app.waypoints[1]);
    app.invalidateAnimationTiming();
    cases['4-delete'] = await snapshotOf(app);

    // A second branch from 2.
    app.eventBus.emit('route:branch-arm', { waypoint: byId('ex-uon-2') });
    app.eventBus.emit('route:branch-place', { imgX: 0.3, imgY: 0.2 });
    app.invalidateAnimationTiming();
    cases['5-branch-add'] = await snapshotOf(app);

    const agreeing = Object.fromEntries(Object.entries(cases).map(([label, result]) => [label, result.divergence.player === 0]));
    expect(agreeing).toEqual({
      '1-opened': true,
      '2-drag-keeping-key': false,
      '3-insert-on-leg': true,
      '4-delete': false,
      '5-branch-add': false,
    });
    // The player is a fresh computation.
    for (const result of Object.values(cases)) expect(result.divergence.player).toBe(result.divergence.fresh);
    pin('app.edits', rounded(cases));
  });
});
