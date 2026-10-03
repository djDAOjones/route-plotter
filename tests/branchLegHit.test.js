/**
 * DEF-64 — a branched route's legs, each hit by its own geometry.
 *
 * `findSegmentAt` paired the trunk's progress with every waypoint of the
 * route, so on a branched route it found no leg at all: hovering a leg showed
 * nothing, a click on one added a waypoint at the end of the route, and no
 * leg's "+" could be reached. Each run, the trunk and each branch, is now hit
 * along its own polyline, and the hit names the leg the author pointed at:
 * the waypoint it leaves (which owns it), the one it reaches, and its run.
 *
 * Driven through the booted app with real Pointer Events on its canvas, so
 * the InteractionHandler transaction, the bus queries, the hover state and
 * the hover affordances the editor draws are all the real ones.
 *
 * DEF-22 stays out of reach: a branch leg offers no "+", so the leg insert,
 * which gives its waypoint no branch, is never asked to land inside a
 * branch's run. A trunk leg's "+" inserts on the trunk, the run of the
 * waypoint it is inserted after, which is DEF-22's decided rule (§20 Q7).
 */

import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { PIXEL_DATA_URL } from './fixtures/authoredExtras.js';
import { contextFor } from './setup.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { loadExampleBackground } from '../src/app/backgroundLoading.js';
import { resolveRouteBranches } from '../src/utils/routeBranches.js';
import { RENDERING } from '../src/config/constants.js';

const BRANCH = 'ex-uon-branch';

/** The fill of the "+" handle not under the pointer (`RenderingService._drawPlusHandle`). */
const IDLE_PLUS_FILL = 'rgba(255, 255, 255, 0.95)';

/**
 * The inspector's flash scrolls the Leg card into view a frame later, and
 * jsdom has no `scrollIntoView`; each call is noted instead.
 */
const scrolled = [];
const ownScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
beforeAll(() => {
  Element.prototype.scrollIntoView = function noteScroll() {
    scrolled.push(this);
  };
});
afterAll(() => {
  if (ownScrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', ownScrollIntoView);
  else delete Element.prototype.scrollIntoView;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ========== FIXTURES ==========

function example(id) {
  return structuredClone(buildExampleProjects().find(each => each.id === id).project);
}

/**
 * The open day example with a second waypoint on its branch, so the branch
 * has a leg between two of its own waypoints: the leg on which a waypoint
 * given no branch would split the run (DEF-22).
 */
function openDayWithTwoWaypointBranch() {
  const project = example('uon-open-day');
  const at = project.waypoints.findIndex(each => each.id === 'ex-uon-b1');
  const first = project.waypoints[at];
  const second = {
    ...structuredClone(first),
    id: 'ex-uon-b2',
    name: 'Cricket pavilion',
    label: 'Cricket pavilion',
    imgX: 0.62,
    imgY: 0.2,
  };
  delete second.branchFrom;
  delete first.branchRejoin;
  project.waypoints.splice(at + 1, 0, second);
  return project;
}

/**
 * The open day example with the route going on past the rejoin, so a trunk
 * leg's waypoint sits later in the route's array than its place on the
 * trunk: the branch's run comes before it.
 */
function openDayPastTheRejoin() {
  const project = example('uon-open-day');
  const rejoin = project.waypoints.find(each => each.id === 'ex-uon-3');
  project.waypoints.push({
    ...structuredClone(rejoin), id: 'ex-uon-4', name: 'Highfields', label: 'Highfields', imgX: 0.9, imgY: 0.7,
  });
  return project;
}

/**
 * The open day example with its branch's run stored at the end of the
 * route's array, as a list drop leaves it (DEF-55): the branch's last
 * waypoint, which owns its leg into the rejoin, is then the array's last.
 */
function openDayBranchStoredLast() {
  const project = example('uon-open-day');
  const at = project.waypoints.findIndex(each => each.id === 'ex-uon-b1');
  project.waypoints.push(...project.waypoints.splice(at, 1));
  return project;
}

/**
 * The open day example with its branch leaving the trunk's first waypoint,
 * where the trunk's polyline and the branch's start at the same point.
 */
function openDayBranchingAtTheStart() {
  const project = example('uon-open-day');
  const at = project.waypoints.findIndex(each => each.id === 'ex-uon-b1');
  const [branch] = project.waypoints.splice(at, 1);
  branch.branchFrom = 'ex-uon-1';
  project.waypoints.splice(1, 0, branch);
  return project;
}

/** Each fixture and the native size of the map it is seen against. */
const FIXTURES = {
  // Trunk: 1, 2, 2a and 2b (minors), 3. A branch leaves 2 for b1 and rejoins at 3.
  'open day': () => ({ project: example('uon-open-day'), image: [2914, 2061] }),
  // The same, with b2 after b1 on the branch.
  'open day, two-waypoint branch': () => ({ project: openDayWithTwoWaypointBranch(), image: [2914, 2061] }),
  // The same, going on from 3 to 4.
  'open day, past the rejoin': () => ({ project: openDayPastTheRejoin(), image: [2914, 2061] }),
  // The same route, with b1 stored after 3.
  'open day, branch stored last': () => ({ project: openDayBranchStoredLast(), image: [2914, 2061] }),
  // The branch leaves 1 for b1 and rejoins at 3.
  'open day, branching at the start': () => ({ project: openDayBranchingAtTheStart(), image: [2914, 2061] }),
  // Unbranched: 1, 1a (minor), 2, 3.
  'site walk': () => ({ project: example('parm-aerial-walk'), image: [3371, 2651] }),
};

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * A booted app with a fixture loaded and its map in place, in Edit mode,
 * where the canvas hit tests answer. Recovery never holds the map, so a stub
 * of the real one's size is given through `loadExampleBackground`'s own
 * `loadAsset` seam.
 */
async function open(name) {
  const fixture = FIXTURES[name]();
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, fixture.project)).toBe(true);

  const [width, height] = fixture.image;
  const image = new Image();
  Object.assign(image, { width, height, naturalWidth: width, naturalHeight: height });
  expect(await loadExampleBackground(app, './images/fixture-map.png', {
    autoSave: false,
    loadAsset: async () => ({ base64: PIXEL_DATA_URL, getImageElement: async () => image }),
  })).toBe(true);
  app._setPreviewMode(false);
  for (let i = 0; i < 3; i += 1) await tick();
  return app;
}

// ========== THE ROUTE'S LEGS, AS THE APP DRAWS THEM ==========

const wp = (app, id) => app.getWaypointById(id);
const ids = app => app.waypoints.map(each => each.id);

/**
 * A leg as the editor draws it: the points of its run's polyline from the
 * waypoint it leaves to the next one on that run, and its midpoint, where
 * the "+" sits. Read off the app's own geometry: the trunk's polyline and
 * progress, or the branch's.
 */
function legOf(app, fromId, branchId = null) {
  let waypoints;
  let pathPoints;
  let progress;
  if (branchId === null) {
    waypoints = app.waypoints.filter(each => !each.branchId);
    pathPoints = app.pathPoints;
    progress = app.getWaypointProgressValues();
  } else {
    const branch = app.branchPaths.find(each => each.id === branchId);
    ({ waypoints, pathPoints } = branch);
    progress = branch.progressValues;
  }
  const index = waypoints.findIndex(each => each.id === fromId);
  expect(index, `${fromId} leaves no leg on that run`).toBeGreaterThanOrEqual(0);
  expect(index).toBeLessThan(waypoints.length - 1);
  const last = pathPoints.length - 1;
  const a = Math.round(progress[index] * last);
  const b = Math.round(progress[index + 1] * last);
  return {
    from: waypoints[index],
    to: waypoints[index + 1],
    points: pathPoints.slice(a, b + 1),
    mid: pathPoints[Math.round((a + b) / 2)],
  };
}

const onScreen = (app, point) => app.imageToScreen(point.x, point.y);

/** A point a quarter of the way along a leg: on the line, off its "+" and clear of its waypoints. */
const quarterOf = (app, leg) => onScreen(app, leg.points[Math.floor(leg.points.length / 4)]);

/** The point `distance` screen pixels along a leg, from its start or from its end. */
function alongLeg(app, leg, distance, { fromEnd = false } = {}) {
  const points = (fromEnd ? [...leg.points].reverse() : leg.points).map(point => onScreen(app, point));
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const step = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (travelled + step >= distance) {
      const t = (distance - travelled) / step;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      };
    }
    travelled += step;
  }
  throw new Error(`the leg is shorter than ${distance} px`);
}

// ========== THE POINTER, AND WHAT THE EDITOR SHOWS ==========

function pointer(app, type, { x, y }) {
  const rect = app.canvas.getBoundingClientRect();
  app.canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: type === 'pointerdown' ? 0 : -1,
    buttons: type === 'pointerdown' ? 1 : 0,
    clientX: rect.left + x,
    clientY: rect.top + y,
  }));
}

/** Move the pointer there and let the hover test run, on its animation frame. */
async function hoverAt(app, point) {
  pointer(app, 'pointermove', point);
  await tick();
  return app.canvasHover;
}

/** Press and release there: a tap, which the pointer transaction resolves as a click. */
async function clickAt(app, point) {
  pointer(app, 'pointerdown', point);
  pointer(app, 'pointerup', point);
  await tick();
}

/** What the canvas query answers for a point. */
function hitAt(app, point) {
  let answer;
  app.eventBus.emit('segment:check-at-position', point, (hit) => { answer = hit; });
  return answer;
}

/**
 * What the editor draws for the hover, read from the vector layer's calls:
 * the glow under the hovered leg (the path stroked in the glow colour) and
 * the "+" handle (the circle filled in its colours), or null for each the
 * frame does not draw.
 */
function drawnHover(app) {
  const context = contextFor(app.renderingService.vectorCanvas);
  context.takeCalls();
  app.render();
  let glow = null;
  let plus = null;
  let path = [];
  let circle = null;
  for (const [name, ...args] of context.takeCalls()) {
    if (name === 'beginPath') path = [];
    if (name === 'moveTo' || name === 'lineTo') path.push({ x: args[0], y: args[1] });
    if (name === 'set:strokeStyle' && args[0] === RENDERING.HOVER_ACCENT_GLOW) glow = path;
    if (name === 'arc') circle = { x: args[0], y: args[1] };
    if (name === 'set:fillStyle' && (args[0] === RENDERING.HOVER_ACCENT_COLOR || args[0] === IDLE_PLUS_FILL)) {
      plus = { ...circle, active: args[0] === RENDERING.HOVER_ACCENT_COLOR };
    }
  }
  return { glow, plus };
}

const rounded = points => points.map(({ x, y }) => [Number(x.toFixed(3)), Number(y.toFixed(3))]);

/** The glow along this leg, and a "+" at its midpoint (or none), as the editor should draw them. */
function expectDrawn(app, leg, plus) {
  const drawn = drawnHover(app);
  expect(drawn.glow, 'no glow under the hovered leg').not.toBeNull();
  expect(rounded(drawn.glow)).toEqual(rounded(leg.points.map(point => app.imageToCanvas(point.x, point.y))));
  if (plus === null) {
    expect(drawn.plus).toBeNull();
  } else {
    const mid = app.imageToCanvas(leg.mid.x, leg.mid.y);
    expect(drawn.plus).toEqual({ x: mid.x, y: mid.y, active: plus === 'active' });
  }
}

/** The cards the inspector is asked to flash: a leg click flashes the Leg card. */
function noteFlashes(app) {
  const flashes = [];
  app.eventBus.on('section:flash', ({ section }) => flashes.push(section));
  return flashes;
}

/** The route's runs as the resolver reads them, and any problem it finds. */
function structureOf(app) {
  const structure = resolveRouteBranches(app.waypoints);
  return {
    trunk: structure.trunk.waypoints.map(each => each.id),
    branches: structure.branches.map(branch => `${branch.id}: ${branch.forkFromId} > ` +
      `${branch.waypoints.map(each => each.id).join(' ')} > ${branch.rejoinAtId}`),
    problems: structure.problems.map(problem => problem.code),
  };
}

// ========== THE ROWS ==========

describe('DEF-64: a branched route\'s trunk legs are hit along the trunk', () => {
  test('hovering a trunk leg highlights it and offers its "+", which lights under the pointer', async () => {
    const app = await open('open day');
    // The leg from 2b to the rejoin: in the route's array, 2b is followed by the branch's b1.
    const leg = legOf(app, 'ex-uon-2b');
    expect(leg.to.id).toBe('ex-uon-3');

    expect(await hoverAt(app, quarterOf(app, leg))).toMatchObject({
      type: 'leg', waypoint: wp(app, 'ex-uon-2b'), waypointIndex: 3, branchId: null, canInsert: true,
    });
    expect(app.canvas.style.cursor).toBe('pointer');
    expectDrawn(app, leg, 'idle');

    expect(await hoverAt(app, onScreen(app, leg.mid))).toMatchObject({
      type: 'leg-plus', waypoint: wp(app, 'ex-uon-2b'), branchId: null,
    });
    expectDrawn(app, leg, 'active');
  });

  test('clicking a trunk leg selects the waypoint it leaves and flashes its Leg card, adding nothing', async () => {
    const app = await open('open day');
    const flashes = noteFlashes(app);
    const route = ids(app);
    // The fork's own leg on the trunk, to the lake curve's first minor.
    const leg = legOf(app, 'ex-uon-2');
    expect(leg.to.id).toBe('ex-uon-2a');

    await clickAt(app, quarterOf(app, leg));

    expect(app.selectedWaypoint).toBe(wp(app, 'ex-uon-2'));
    expect(flashes).toEqual(['leg']);
    expect(scrolled.at(-1)?.dataset.section).toBe('leg');
    expect(ids(app)).toEqual(route);
  });

  test.each([
    ['the fork\'s trunk leg (inserted at the fork itself, a waypoint joins the trunk)', 'open day',
      'ex-uon-2', 'ex-uon-2a', 1],
    ['the leg into the rejoin (the branch\'s run follows its waypoint in the array)', 'open day',
      'ex-uon-2b', 'ex-uon-3', 3],
    ['a leg past the rejoin (its waypoint fifth on the trunk, sixth in the array)', 'open day, past the rejoin',
      'ex-uon-3', 'ex-uon-4', 5],
  ])('the "+" on %s inserts a minor on the trunk, between the leg\'s ends', async (
    _, fixture, fromId, toId, ownerIndex,
  ) => {
    const app = await open(fixture);
    const leg = legOf(app, fromId);
    expect(leg.to.id).toBe(toId);
    const before = structureOf(app);
    expect(before.problems).toEqual([]);
    const count = app.waypoints.length;

    expect(await hoverAt(app, onScreen(app, leg.mid))).toMatchObject({ type: 'leg-plus', waypointIndex: ownerIndex });
    expectDrawn(app, leg, 'active');
    await clickAt(app, onScreen(app, leg.mid));

    const added = app.waypoints[ownerIndex + 1];
    expect(app.waypoints).toHaveLength(count + 1);
    expect(app.waypoints[ownerIndex]).toBe(leg.from);
    expect(added.isMajor).toBe(false);
    expect(added.branchId ?? null).toBeNull();
    expect([added.imgX, added.imgY]).toEqual([leg.mid.x, leg.mid.y]);
    expect(app.selectedWaypoint).toBe(added);

    // Joined the trunk, the run of the waypoint it was inserted after,
    // between the leg's ends; the branch is as it was.
    const trunk = [...before.trunk];
    trunk.splice(trunk.indexOf(fromId) + 1, 0, added.id);
    expect(structureOf(app)).toEqual({ ...before, trunk });
  });
});

describe('DEF-64: a branched route\'s branch legs are hit along the branch', () => {
  test.each([
    ['first leg (from the fork)', 'open day', 'ex-uon-2', 'ex-uon-b1'],
    ['last leg (into the rejoin)', 'open day', 'ex-uon-b1', 'ex-uon-3'],
    ['last leg (its waypoint the last in the array)', 'open day, branch stored last', 'ex-uon-b1', 'ex-uon-3'],
  ])('hovering a branch\'s %s highlights that leg, on the branch', async (_, fixture, fromId, toId) => {
    const app = await open(fixture);
    const leg = legOf(app, fromId, BRANCH);
    expect(leg.to.id).toBe(toId);

    expect(await hoverAt(app, quarterOf(app, leg))).toMatchObject({
      type: 'leg', waypoint: wp(app, fromId), waypointIndex: ids(app).indexOf(fromId), branchId: BRANCH,
    });
    expect(app.canvas.style.cursor).toBe('pointer');
    expectDrawn(app, leg, null);
  });

  test.each([
    ['first leg selects the fork (its owner)', 'ex-uon-2'],
    ['last leg selects the branch\'s own waypoint', 'ex-uon-b1'],
  ])('clicking a branch\'s %s and flashes the Leg card, adding nothing', async (_, fromId) => {
    const app = await open('open day');
    const flashes = noteFlashes(app);
    const route = ids(app);

    await clickAt(app, quarterOf(app, legOf(app, fromId, BRANCH)));

    expect(app.selectedWaypoint).toBe(wp(app, fromId));
    expect(flashes).toEqual(['leg']);
    expect(ids(app)).toEqual(route);
  });
});

describe('DEF-64 and DEF-22: a branch leg offers no "+"', () => {
  // Each of the branch's legs: from the fork, between two of its own
  // waypoints (where a waypoint with no branch would split the run), and
  // into the rejoin.
  test.each([
    ['ex-uon-2', 'ex-uon-b1'],
    ['ex-uon-b1', 'ex-uon-b2'],
    ['ex-uon-b2', 'ex-uon-3'],
  ])('at the midpoint of the leg from %s to %s: no "+" is shown or hit, and a click there selects', async (
    fromId, toId,
  ) => {
    const app = await open('open day, two-waypoint branch');
    const flashes = noteFlashes(app);
    const leg = legOf(app, fromId, BRANCH);
    expect(leg.to.id).toBe(toId);
    const route = ids(app);
    const structure = structureOf(app);
    expect(structure.problems).toEqual([]);
    const mid = onScreen(app, leg.mid);

    expect(hitAt(app, mid)).toEqual({
      waypoint: wp(app, fromId),
      waypointIndex: ids(app).indexOf(fromId),
      next: wp(app, toId),
      branchId: BRANCH,
      canInsert: false,
      onPlus: false,
      midImg: { x: leg.mid.x, y: leg.mid.y },
    });
    expect(await hoverAt(app, mid)).toMatchObject({ type: 'leg', branchId: BRANCH, canInsert: false });
    expectDrawn(app, leg, null);

    await clickAt(app, mid);

    expect(ids(app)).toEqual(route);
    expect(structureOf(app)).toEqual(structure);
    expect(app.selectedWaypoint).toBe(wp(app, fromId));
    expect(flashes).toEqual(['leg']);
  });
});

describe('DEF-64: where trunk and branch legs meet, the hit names the leg pointed at', () => {
  test('near the fork, the trunk\'s leg and the branch\'s first leg, both the fork\'s, are told apart', async () => {
    const app = await open('open day');
    const trunkLeg = legOf(app, 'ex-uon-2');
    const branchLeg = legOf(app, 'ex-uon-2', BRANCH);
    // Clear of the fork's own marker, which the pointer would otherwise take.
    const onTrunk = alongLeg(app, trunkLeg, 24);
    const onBranch = alongLeg(app, branchLeg, 24);

    expect(hitAt(app, onTrunk)).toMatchObject({
      waypoint: wp(app, 'ex-uon-2'), next: wp(app, 'ex-uon-2a'), branchId: null,
    });
    expect(hitAt(app, onBranch)).toMatchObject({
      waypoint: wp(app, 'ex-uon-2'), next: wp(app, 'ex-uon-b1'), branchId: BRANCH,
    });

    // One leg to the other: the same owner, at the same index, so the
    // hover is told apart by its run, and the glow moves with it.
    expect(await hoverAt(app, onTrunk)).toMatchObject({ type: 'leg', waypoint: wp(app, 'ex-uon-2'), branchId: null });
    expectDrawn(app, trunkLeg, 'idle');
    expect(await hoverAt(app, onBranch)).toMatchObject({
      type: 'leg', waypoint: wp(app, 'ex-uon-2'), branchId: BRANCH,
    });
    expectDrawn(app, branchLeg, null);
    expect(await hoverAt(app, onTrunk)).toMatchObject({ branchId: null });
    expectDrawn(app, trunkLeg, 'idle');
  });

  test('near the rejoin, the trunk\'s last leg and the branch\'s are told apart', async () => {
    const app = await open('open day');
    const onTrunk = alongLeg(app, legOf(app, 'ex-uon-2b'), 24, { fromEnd: true });
    const onBranch = alongLeg(app, legOf(app, 'ex-uon-b1', BRANCH), 24, { fromEnd: true });

    expect(hitAt(app, onTrunk)).toMatchObject({
      waypoint: wp(app, 'ex-uon-2b'), next: wp(app, 'ex-uon-3'), branchId: null,
    });
    expect(hitAt(app, onBranch)).toMatchObject({
      waypoint: wp(app, 'ex-uon-b1'), next: wp(app, 'ex-uon-3'), branchId: BRANCH,
    });
  });

  test('where the trunk and a branch are the same distance away, the trunk, drawn over it, is named', async () => {
    // A branch leaving the trunk's first waypoint: both polylines start at
    // that point, so it is no distance from either. The canvas gives the
    // waypoint's marker the pointer there; the leg query is asked directly.
    const app = await open('open day, branching at the start');
    expect(structureOf(app).problems).toEqual([]);
    const start = wp(app, 'ex-uon-1');

    expect(hitAt(app, onScreen(app, { x: start.imgX, y: start.imgY }))).toMatchObject({
      waypoint: start, next: wp(app, 'ex-uon-2'), branchId: null,
    });
  });
});

describe('DEF-64: only the route\'s own legs are hit', () => {
  // This passes on `main` too, where no branch's path was hit at all.
  test('a branched project that fails to load leaves none of its legs to hit, and the route\'s own', async () => {
    // A load that fails late puts the route back, but not the branch paths
    // built for the project it refused (DEF-51's): they are drawn from that
    // project's waypoints, which are not the route's.
    allowConsole(/Failed to load project/);
    const app = await open('open day');
    const refused = app.branchPaths.find(each => each.id === BRANCH).pathPoints.map(({ x, y }) => ({ x, y }));
    expect(await loadSnapshot(app, example('parm-aerial-walk'))).toBe(true);
    const route = ids(app);

    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: example('uon-open-day'), imageAssets: [], backgroundBase64: null,
    });
    vi.spyOn(app, 'pruneImageAssets').mockImplementationOnce(() => {
      throw new Error('the commit failed after the project switched');
    });
    expect(await app.loadProject(new File([''], 'open-day.zip'))).toBe(false);
    expect(ids(app)).toEqual(route);
    app._setPreviewMode(false);

    // Along the whole of the refused project's branch, nothing it owns is named.
    const owners = refused.filter((_, index) => index % 8 === 0)
      .map(point => hitAt(app, onScreen(app, point))?.waypoint)
      .filter(Boolean);
    expect(owners.filter(owner => !app.waypoints.includes(owner))).toEqual([]);
    expect(await hoverAt(app, onScreen(app, refused[Math.floor(refused.length / 4)]))).toBeNull();
    expect(hitAt(app, onScreen(app, legOf(app, 'ex-parm-1').mid))).toMatchObject({ waypoint: wp(app, 'ex-parm-1') });
  });
});

describe('DEF-64: an unbranched route is unchanged', () => {
  // These pass on `main` too: the hit, the hover, what it draws and what a
  // click does, on a route with no branch.
  test('each leg is hit, hovered and drawn as before', async () => {
    const app = await open('site walk');
    for (const [index, id] of ['ex-parm-1', 'ex-parm-1a', 'ex-parm-2'].entries()) {
      const leg = legOf(app, id);

      expect(hitAt(app, onScreen(app, leg.mid))).toMatchObject({
        waypoint: wp(app, id), waypointIndex: index, onPlus: true, midImg: { x: leg.mid.x, y: leg.mid.y },
      });
      expect(await hoverAt(app, onScreen(app, leg.mid))).toMatchObject({
        type: 'leg-plus', waypoint: wp(app, id), waypointIndex: index,
      });
      expectDrawn(app, leg, 'active');
      expect(await hoverAt(app, quarterOf(app, leg))).toMatchObject({ type: 'leg', waypoint: wp(app, id) });
      expectDrawn(app, leg, 'idle');
    }
  });

  test('a click on a leg selects the waypoint it leaves; one on its "+" inserts a minor after it', async () => {
    const app = await open('site walk');
    const flashes = noteFlashes(app);

    await clickAt(app, quarterOf(app, legOf(app, 'ex-parm-1a')));
    expect(app.selectedWaypoint).toBe(wp(app, 'ex-parm-1a'));
    expect(flashes).toEqual(['leg']);

    const leg = legOf(app, 'ex-parm-1');
    await clickAt(app, onScreen(app, leg.mid));
    const added = app.waypoints[1];
    expect(ids(app)).toEqual(['ex-parm-1', added.id, 'ex-parm-1a', 'ex-parm-2', 'ex-parm-3']);
    expect(added.isMajor).toBe(false);
    expect([added.imgX, added.imgY]).toEqual([leg.mid.x, leg.mid.y]);
    expect(app.selectedWaypoint).toBe(added);
  });

  test('the hit names its leg too: the trunk, and the "+" offered', async () => {
    const app = await open('site walk');
    const leg = legOf(app, 'ex-parm-1a');

    expect(hitAt(app, onScreen(app, leg.mid))).toEqual({
      waypoint: wp(app, 'ex-parm-1a'),
      waypointIndex: 1,
      next: wp(app, 'ex-parm-2'),
      branchId: null,
      canInsert: true,
      onPlus: true,
      midImg: { x: leg.mid.x, y: leg.mid.y },
    });
  });
});
