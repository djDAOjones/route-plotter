// CORE-06: hit testing (hit.ts), on plain routes whose shapes `composeTimeline` builds, as the frame draws them.
//
// Ported from v3 by meaning (the plan's rules for porting tests, line 995: "Port, with DEF-64.1's one-point branch
// fixture"): segmentHitTest.test.js's six nearestOnPolyline assertions; findWaypointAt's rule (pointer.js:198–224, the
// closest within 15 px, a tie to the earlier) with INTAKE.22 fixed; findSegmentAt's (:226–300, the nearest line within
// 8 px, a tie to the line drawn on top); branchLegHit.test.js's run shapes (:579–646) and its fork, rejoin and tie
// tests (:524–577), with DEF-64.1's terminal branch of one line; and DEF-51's pins (:647–737), inverted.
//
// Not ported, and why:
// - waypointPointIndices (2 tests) and legIndexForPointIndex (4): v3 mapped a run's polyline back to its legs; v4's
//   `routeShape` gives each line its own samples, both authored ends exact, so there is nothing to map.
// - legMidpointIndex (2 tests), the "+" handle (12 px, onPlus, canInsert, midImg) and hovering: chat F's, with the
//   insert and the hovered stretch (D208). DEF-22's "a branch leg offers no '+'" does not carry: v4 splits any line.
// - findWaypointAt's `exclude` (ROUTE-01c, a drop's hit test skipping the dragged point): a drop joins nothing (D239).
// - "legs are not hit in preview" and the clicks, hovers, flashes and drawing of branchLegHit.test.js: the page's.
import { describe, expect, it } from 'vitest';
import type { ImageBounds } from '../../core/geometry/transform';
import { imageToCanvas } from '../../core/geometry/transform';
import { newLine, newPoint, newRoute, type IdSource, type Route } from '../../core/model/scene';
import { routeShape } from '../../core/timing/shape';
import { composeTimeline } from '../../core/timing/timeline';
import { hitTest, LINE_HIT_RADIUS, nearestOnPolyline, POINT_HIT_RADIUS, type HitRoute } from './hit';
import type { Pixel } from './pointer';

/** The image drawn at 1000 by 800 CSS pixels. */
const BOUNDS: ImageBounds = { x: 0, y: 0, width: 1000, height: 800, scale: 1 };
const ASPECT = 1000 / 800;
/** A marker drawn smaller than v3's radius: its half-width is under 15 px. */
const SMALL = 8;

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}${String((n += 1))}`;
}

type Spec = Readonly<Record<string, readonly [number, number] | readonly [number, number, 'stop' | 'bend']>>;

/**
 * A route of named points at image fractions, joined by `lines` ("a>b", one way) in that saved order, the lead
 * starting at `start`; its timeline as the frame builds it. `ids` maps each name, and each line "a>b", to its id.
 */
function routeOf(spec: Spec, lines: readonly string[], start: string, prefix = 'r') {
  const nextId = counter(prefix);
  const ids = new Map<string, string>();
  const points = Object.entries(spec).map(([name, [x, y, kind = 'stop']]) => {
    const point = newPoint(nextId, { x, y, kind });
    ids.set(name, point.id);
    return point;
  });
  const id = (name: string): string => {
    const found = ids.get(name);
    if (found === undefined) throw new Error(`no ${name}`);
    return found;
  };
  const made = lines.map((each) => {
    const [from = '', to = ''] = each.split('>');
    const line = newLine(nextId, id(from), id(to));
    ids.set(each, line.id);
    return line;
  });
  const route: Route = { ...newRoute(nextId), points, lines: made, leadStart: id(start) };
  return { route, timeline: composeTimeline(route, ASPECT), id };
}

const edited = (made: ReturnType<typeof routeOf>, markerHalf = SMALL): HitRoute => ({
  route: made.route,
  timeline: made.timeline,
  markerHalf,
});

/** A line's samples in pixels. */
function drawn(made: ReturnType<typeof routeOf>, line: string): Pixel[] {
  const shape = made.timeline.shapes.get(made.id(line));
  if (shape === undefined) throw new Error(`no shape for ${line}`);
  return shape.samples.map((sample) => imageToCanvas(BOUNDS, sample));
}

const middleOf = (samples: readonly Pixel[]): Pixel => {
  const middle = samples[Math.floor(samples.length / 2)];
  if (middle === undefined) throw new Error('no samples');
  return middle;
};

/** The first sample at least `far` pixels from the line's first. */
function along(samples: readonly Pixel[], far: number): Pixel {
  const [first] = samples;
  const found = samples.find((each) => first !== undefined && Math.hypot(each.x - first.x, each.y - first.y) >= far);
  if (found === undefined) throw new Error('the line is too short');
  return found;
}

const lerp = (a: Pixel, b: Pixel, t: number): Pixel => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

describe('nearestOnPolyline (v3’s segmentHitTest.test.js, its six assertions)', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ];

  it('projects perpendicular onto a segment interior', () => {
    const hit = nearestOnPolyline(line, { x: 5, y: 3 });
    expect(hit?.dist).toBeCloseTo(3);
    expect(hit?.index).toBeCloseTo(0.5);
    expect(hit?.x).toBeCloseTo(5);
    expect(hit?.y).toBeCloseTo(0);
  });

  it('finds the second segment when the point projects there', () => {
    const hit = nearestOnPolyline(line, { x: 15, y: -4 });
    expect(hit?.dist).toBeCloseTo(4);
    expect(hit?.index).toBeCloseTo(1.5);
  });

  it('clamps to the polyline end for points beyond it', () => {
    const hit = nearestOnPolyline(line, { x: 25, y: 0 });
    expect(hit?.dist).toBeCloseTo(5);
    expect(hit?.index).toBeCloseTo(2);
    expect(hit?.x).toBeCloseTo(20);
  });

  it('clamps to the polyline start for points before it', () => {
    const hit = nearestOnPolyline(line, { x: -3, y: 4 });
    expect(hit?.dist).toBeCloseTo(5);
    expect(hit?.index).toBeCloseTo(0);
  });

  it('survives zero-length segments (duplicate points): a finite index, halfway along the second', () => {
    const hit = nearestOnPolyline(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      { x: 5, y: 2 },
    );
    expect(hit?.dist).toBeCloseTo(2);
    expect(Number.isFinite(hit?.index)).toBe(true);
    expect(hit?.index).toBeCloseTo(1.5);
  });

  it('returns null for fewer than two points', () => {
    expect(nearestOnPolyline([], { x: 0, y: 0 })).toBeNull();
    expect(nearestOnPolyline([{ x: 1, y: 1 }], { x: 0, y: 0 })).toBeNull();
  });
});

describe('a point under the pointer', () => {
  // One stop at (500, 400) pixels, joined to nothing.
  const alone = () => routeOf({ p: [0.5, 0.5] }, [], 'p');

  it('INTAKE.22: a marker drawn at a half-width of 24 px (size 16 at a frame scale of 1.5), pressed 22 px from its centre, is named', () => {
    const made = alone();
    const half = 16 * 1.5;
    expect(hitTest({ x: 522, y: 400 }, BOUNDS, [edited(made, half)])).toEqual({ kind: 'point', route: made.route.id, id: made.id('p') });
    // Its radius is the drawn half-width exactly: within it means at most it.
    expect(hitTest({ x: 500, y: 424 }, BOUNDS, [edited(made, half)])).toEqual({ kind: 'point', route: made.route.id, id: made.id('p') });
    expect(hitTest({ x: 500, y: 424.5 }, BOUNDS, [edited(made, half)])).toBeNull();
  });

  it('v3’s miss kept: a marker smaller than 15 px across its half, pressed 22 px away, names nothing; at 15 px, the point', () => {
    const made = alone();
    expect(hitTest({ x: 522, y: 400 }, BOUNDS, [edited(made, SMALL)])).toBeNull();
    expect(hitTest({ x: 500 - POINT_HIT_RADIUS, y: 400 }, BOUNDS, [edited(made, SMALL)])).toEqual({
      kind: 'point',
      route: made.route.id,
      id: made.id('p'),
    });
    // 9 by 12 is 15 by Math.hypot.
    expect(hitTest({ x: 509, y: 412 }, BOUNDS, [edited(made, SMALL)])?.kind).toBe('point');
    expect(hitTest({ x: 509, y: 412.1 }, BOUNDS, [edited(made, SMALL)])).toBeNull();
  });

  it('a bend’s radius is a stop’s: the larger of 15 px and the markers’ drawn half-width', () => {
    const made = routeOf({ p: [0.5, 0.5, 'bend'] }, [], 'p');
    expect(hitTest({ x: 522, y: 400 }, BOUNDS, [edited(made, 24)])?.kind).toBe('point');
    expect(hitTest({ x: 514, y: 400 }, BOUNDS, [edited(made, SMALL)])?.kind).toBe('point');
  });

  it('every radius is in the pointer’s pixels, never divided by a zoom: 15 px whatever the image’s bounds', () => {
    const made = alone();
    for (const bounds of [
      { x: -250, y: -200, width: 2000, height: 1600, scale: 2 },
      { x: 250, y: 200, width: 500, height: 400, scale: 0.5 },
    ]) {
      const centre = imageToCanvas(bounds, { x: 0.5, y: 0.5 });
      expect(hitTest({ x: centre.x + 15, y: centre.y }, bounds, [edited(made)])?.kind).toBe('point');
      expect(hitTest({ x: centre.x + 15.5, y: centre.y }, bounds, [edited(made)])).toBeNull();
    }
  });

  it('the closest point within its radius wins, not the first', () => {
    // a at (500, 400), b at (520, 400): both within 15 px of (511, 400) and (509, 400).
    const made = routeOf({ a: [0.5, 0.5], b: [0.52, 0.5] }, [], 'a');
    expect(hitTest({ x: 511, y: 400 }, BOUNDS, [edited(made)])).toMatchObject({ id: made.id('b') });
    expect(hitTest({ x: 509, y: 400 }, BOUNDS, [edited(made)])).toMatchObject({ id: made.id('a') });
  });

  it('a tie keeps the earlier in the route’s points (v3’s strict <), then the earlier route given', () => {
    const made = routeOf({ a: [0.5, 0.5], b: [0.52, 0.5] }, [], 'a');
    expect(hitTest({ x: 510, y: 400 }, BOUNDS, [edited(made)])).toMatchObject({ id: made.id('a') });
    const flipped = { ...made.route, points: [...made.route.points].reverse() };
    expect(hitTest({ x: 510, y: 400 }, BOUNDS, [{ ...edited(made), route: flipped }])).toMatchObject({ id: made.id('b') });
    const other = routeOf({ c: [0.5, 0.5] }, [], 'c', 'o');
    expect(hitTest({ x: 505, y: 400 }, BOUNDS, [edited(other), edited(made)])).toEqual({
      kind: 'point',
      route: other.route.id,
      id: other.id('c'),
    });
  });

  it('a point is hit before any line, even where a line is nearer', () => {
    // a line from a (100, 400) to b (900, 400); pressed on the line, 12 px from a.
    const made = routeOf({ a: [0.1, 0.5], b: [0.9, 0.5] }, ['a>b'], 'a');
    expect(hitTest({ x: 112, y: 400 }, BOUNDS, [edited(made)])).toEqual({ kind: 'point', route: made.route.id, id: made.id('a') });
  });
});

describe('a line under the pointer', () => {
  // a at (100, 400), b at (900, 400): a straight line.
  const straight = () => routeOf({ a: [0.1, 0.5], b: [0.9, 0.5] }, ['a>b'], 'a');

  it('the nearest line within 8 px is named; beyond 8 px, nothing', () => {
    const made = straight();
    const line = { kind: 'line', route: made.route.id, id: made.id('a>b') };
    expect(hitTest({ x: 500, y: 400 }, BOUNDS, [edited(made)])).toEqual(line);
    expect(hitTest({ x: 500, y: 400 + LINE_HIT_RADIUS }, BOUNDS, [edited(made)])).toEqual(line);
    expect(hitTest({ x: 500, y: 400 - LINE_HIT_RADIUS - 0.5 }, BOUNDS, [edited(made)])).toBeNull();
    // Beyond its end, measured to the end itself (clamped), not to the line carried on.
    expect(hitTest({ x: 906, y: 400 + 14 }, BOUNDS, [edited(made)])).toBeNull();
  });

  it('a line is measured by projection onto its spans, not to its nearest sample', () => {
    // Its shape at a budget of two samples: its two ends alone, 800 px apart.
    const made = straight();
    const sparse = { ...made.timeline, shapes: routeShape(made.route, made.timeline.walk, ASPECT, 2) };
    expect(sparse.shapes.get(made.id('a>b'))?.samples).toHaveLength(2);
    expect(hitTest({ x: 500, y: 405 }, BOUNDS, [{ ...edited(made), timeline: sparse }])).toEqual({
      kind: 'line',
      route: made.route.id,
      id: made.id('a>b'),
    });
  });

  it('the nearest of two lines within 8 px is named', () => {
    // Two parallel lines 10 px apart, at y 400 and 410; the second is a line the lead does not walk.
    const made = routeOf({ a: [0.1, 0.5], b: [0.9, 0.5], c: [0.1, 0.5125], d: [0.9, 0.5125] }, ['a>b', 'c>d'], 'a');
    expect(hitTest({ x: 500, y: 404 }, BOUNDS, [edited(made)])).toMatchObject({ id: made.id('a>b') });
    expect(hitTest({ x: 500, y: 406 }, BOUNDS, [edited(made)])).toMatchObject({ id: made.id('c>d') });
  });

  // v3: "where the trunk and a branch are the same distance away, the trunk, drawn over it, is named". In v4 a route's
  // lines are drawn in the lead's walk order, then the lines it leaves out (src/features/line/model/line.ts, `evaluate`),
  // and routes in list order (src/player/compose.ts): the line drawn last is on top, and keeps a tie.
  describe('a tie goes to the line drawn on top', () => {
    // Two lines over the same pixels: a to b, and c to d with c on a and d on b.
    const twin = { a: [0.1, 0.5], b: [0.9, 0.5], c: [0.1, 0.5], d: [0.9, 0.5] } as const;

    it('a line the lead leaves out is drawn after the walked lines, so it keeps the tie', () => {
      const fromA = routeOf(twin, ['a>b', 'c>d'], 'a');
      expect(fromA.timeline.walk.leftOut).toEqual([fromA.id('c>d')]);
      expect(hitTest({ x: 500, y: 403 }, BOUNDS, [edited(fromA)])).toMatchObject({ id: fromA.id('c>d') });
      const fromC = routeOf(twin, ['a>b', 'c>d'], 'c');
      expect(fromC.timeline.walk.leftOut).toEqual([fromC.id('a>b')]);
      expect(hitTest({ x: 500, y: 403 }, BOUNDS, [edited(fromC)])).toMatchObject({ id: fromC.id('a>b') });
    });

    it('of two walked lines, the later in the walk keeps the tie', () => {
      // A fork from a to b and to d, b and d at one place; the walk follows the lines' saved order.
      const spec = { a: [0.1, 0.5], b: [0.9, 0.5], d: [0.9, 0.5] } as const;
      const bFirst = routeOf(spec, ['a>b', 'a>d'], 'a');
      expect(bFirst.timeline.lines.map((line) => line.lineId)).toEqual([bFirst.id('a>b'), bFirst.id('a>d')]);
      expect(hitTest({ x: 500, y: 403 }, BOUNDS, [edited(bFirst)])).toMatchObject({ id: bFirst.id('a>d') });
      const dFirst = routeOf(spec, ['a>d', 'a>b'], 'a');
      expect(hitTest({ x: 500, y: 403 }, BOUNDS, [edited(dFirst)])).toMatchObject({ id: dFirst.id('a>b') });
    });

    it('of two routes, the later given keeps the tie', () => {
      const first = routeOf({ a: [0.1, 0.5], b: [0.9, 0.5] }, ['a>b'], 'a', 'f');
      const second = routeOf({ a: [0.1, 0.5], b: [0.9, 0.5] }, ['a>b'], 'a', 's');
      expect(hitTest({ x: 500, y: 403 }, BOUNDS, [edited(first), edited(second)])).toEqual({
        kind: 'line',
        route: second.route.id,
        id: second.id('a>b'),
      });
      expect(hitTest({ x: 500, y: 403 }, BOUNDS, [edited(second), edited(first)])).toMatchObject({ route: first.route.id });
    });
  });
});

// branchLegHit.test.js :579–646, by meaning: every line of every run is hit along its own drawn shape, whatever the
// route's shape. The trunk t1 > t2 > t3 runs along y 400; branch a leaves t1 and rejoins at t2 above it, branch b
// leaves t2 below it.
const TRUNK = { t1: [0.1, 0.5], t2: [0.45, 0.5], t3: [0.8, 0.5] } as const;
const SHAPES = [
  ['an unbranched route', { ...TRUNK }, ['t1>t2', 't2>t3']],
  [
    'two branches',
    { ...TRUNK, a1: [0.27, 0.42], b1: [0.62, 0.58] },
    ['t1>t2', 't2>t3', 't1>a1', 'a1>t2', 't2>b1', 'b1>t3'],
  ],
  [
    'a terminal second branch, which ends at its own last point',
    { ...TRUNK, a1: [0.27, 0.42], b1: [0.62, 0.58], b2: [0.75, 0.75] },
    ['t1>t2', 't2>t3', 't1>a1', 'a1>t2', 't2>b1', 'b1>b2'],
  ],
  [
    'a third branch, leaving the first and rejoining the second',
    { ...TRUNK, a1: [0.27, 0.42], b1: [0.62, 0.58], c1: [0.45, 0.2] },
    ['t1>t2', 't2>t3', 't1>a1', 'a1>t2', 'a1>c1', 'c1>b1', 't2>b1', 'b1>t3'],
  ],
  [
    'both branches stored ahead of the trunk',
    { ...TRUNK, a1: [0.27, 0.42], b1: [0.62, 0.58] },
    ['t1>a1', 'a1>t2', 't2>b1', 'b1>t3', 't1>t2', 't2>t3'],
  ],
  [
    'a line the lead does not walk, a run of its own',
    { ...TRUNK, x: [0.1, 0.2] },
    ['t1>t2', 't2>t3', 'x>t1'],
  ],
] as const;

describe('DEF-64: every line is hit, whatever its run’s shape', () => {
  it.each(SHAPES)('%s: each line is named at the middle of its drawn shape, and 5 px off it', (_, spec, lines) => {
    const made = routeOf(spec, lines, 't1');
    if ((lines as readonly string[]).includes('x>t1')) expect(made.timeline.walk.leftOut).toEqual([made.id('x>t1')]);
    for (const line of lines) {
      const middle = middleOf(drawn(made, line));
      const named = { kind: 'line', route: made.route.id, id: made.id(line) };
      expect(hitTest(middle, BOUNDS, [edited(made)]), line).toEqual(named);
      expect(hitTest({ x: middle.x, y: middle.y + 5 }, BOUNDS, [edited(made)]), `5 px below ${line}`).toEqual(named);
    }
  });

  it('near the fork, the trunk’s line and the branch’s first line, both leaving it, are told apart', () => {
    const made = routeOf(SHAPES[1][1], SHAPES[1][2], 't1');
    const trunk = along(drawn(made, 't1>t2'), 24);
    const branch = along(drawn(made, 't1>a1'), 24);
    // Each press is within 8 px of both lines, nearer one of them.
    expect(hitTest(lerp(trunk, branch, 0.3), BOUNDS, [edited(made)])).toMatchObject({ id: made.id('t1>t2') });
    expect(hitTest(lerp(trunk, branch, 0.7), BOUNDS, [edited(made)])).toMatchObject({ id: made.id('t1>a1') });
  });

  it('near the rejoin, the trunk’s line and the branch’s last line, both reaching it, are told apart', () => {
    const made = routeOf(SHAPES[1][1], SHAPES[1][2], 't1');
    const trunk = along([...drawn(made, 't1>t2')].reverse(), 24);
    const branch = along([...drawn(made, 'a1>t2')].reverse(), 24);
    expect(hitTest(lerp(trunk, branch, 0.3), BOUNDS, [edited(made)])).toMatchObject({ id: made.id('t1>t2') });
    expect(hitTest(lerp(trunk, branch, 0.7), BOUNDS, [edited(made)])).toMatchObject({ id: made.id('a1>t2') });
  });

  // DEF-64.1, "a branch-leg hit fixture with a terminal branch of one waypoint (its fork and b1 only)".
  it('DEF-64.1: a fork with a terminal branch of one line (the fork and one point beyond it) is hit near its middle', () => {
    const made = routeOf({ ...TRUNK, b1: [0.55, 0.7] }, ['t1>t2', 't2>t3', 't2>b1'], 't1');
    const middle = middleOf(drawn(made, 't2>b1'));
    expect(hitTest({ x: middle.x + 4, y: middle.y }, BOUNDS, [edited(made)])).toEqual({
      kind: 'line',
      route: made.route.id,
      id: made.id('t2>b1'),
    });
  });
});

// DEF-51's pins, inverted: v3 pinned that paths left from a refused load named none of the route's legs. In v4 the
// caller hands the shapes, so the route decides what may be named.
describe('DEF-51: only what the route holds is named', () => {
  const made = () => routeOf({ ...TRUNK, b1: [0.62, 0.58] }, ['t1>t2', 't2>t3', 't2>b1'], 't1');

  it('a shape whose line the route does not hold names nothing', () => {
    const whole = made();
    const without = { ...whole.route, lines: whole.route.lines.filter((line) => line.id !== whole.id('t2>b1')) };
    const middle = middleOf(drawn(whole, 't2>b1'));
    expect(hitTest(middle, BOUNDS, [edited(whole)])).toMatchObject({ id: whole.id('t2>b1') });
    expect(hitTest(middle, BOUNDS, [{ ...edited(whole), route: without }])).toBeNull();
  });

  it('a line with no shape is not hit, and nothing throws', () => {
    const whole = made();
    const shapes = new Map([...whole.timeline.shapes].filter(([lineId]) => lineId !== whole.id('t2>b1')));
    const middle = middleOf(drawn(whole, 't2>b1'));
    expect(() => hitTest(middle, BOUNDS, [{ ...edited(whole), timeline: { ...whole.timeline, shapes } }])).not.toThrow();
    expect(hitTest(middle, BOUNDS, [{ ...edited(whole), timeline: { ...whole.timeline, shapes } }])).toBeNull();
  });

  it('a point the route does not hold is never named', () => {
    const whole = made();
    const gone = whole.id('b1');
    const without = {
      ...whole.route,
      points: whole.route.points.filter((point) => point.id !== gone),
      lines: whole.route.lines.filter((line) => line.from !== gone && line.to !== gone),
    };
    const place = imageToCanvas(BOUNDS, { x: 0.62, y: 0.58 });
    expect(hitTest(place, BOUNDS, [edited(whole)])).toMatchObject({ kind: 'point', id: gone });
    // The old timeline still draws a line to it, and its shape ends there.
    expect(hitTest(place, BOUNDS, [{ ...edited(whole), route: without }])).toBeNull();
  });
});
