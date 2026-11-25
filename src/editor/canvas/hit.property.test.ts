// CORE-06: hit testing as a property (brief 106's stage 3), over random small routes (a few points and lines, forks,
// rejoins and lines the lead leaves out allowed), random bounds (offset, size and scale), a random marker half-width
// from 0 to 40 px for each route, and random presses. Each route is given its timeline by `composeTimeline`, as the
// frame builds it. For every press, measured here by the test's own distances, not by `hitTest`'s:
//   1. a press exactly on a point's drawn place names a point, at distance 0 from the press (it may be another point
//      drawn at the same place);
//   2. a named point is within its own radius, max(15, markerHalf), and no other point is strictly nearer while within
//      its own radius;
//   3. a line is named only when no point is within its radius, and the line named is within 8 px of the press by
//      `nearestOnPolyline` over its drawn samples;
//   4. nothing is named only when no point is within its radius and no line within 8 px;
//   5. every id named is one its route holds.
// The presses are drawn as four kinds, so that every result is reached: exactly on a point's place; on a point's ring,
// its radius away along an axis (so that a distance equal to the radius is reached: within means `<=`); near a line's
// drawn sample, up to 12 px off; and anywhere over the image and a margin round it. One run of 200 cases tested 767
// presses: 448 named a point, 104 a line and 215 nothing, and 188 were exactly a radius from some point (sub-chat 107,
// 25 Nov 2026; two more runs gave 464, 102, 183 and 195, and 511, 101, 188 and 201). Each is asserted to occur.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { imageToCanvas, type ImageBounds } from '../../core/geometry/transform';
import { newLine, newPoint, newRoute, type IdSource, type Route } from '../../core/model/scene';
import { composeTimeline } from '../../core/timing/timeline';
import { hitTest, LINE_HIT_RADIUS, nearestOnPolyline, POINT_HIT_RADIUS, type HitRoute } from './hit';
import type { Pixel } from './pointer';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}${String((n += 1))}`;
}

/** A place as an image fraction: on a coarse grid (so that points share places) or a fine one. */
const aFraction = fc.oneof(
  fc.integer({ min: 0, max: 8 }).map((n) => n / 8),
  fc.integer({ min: 0, max: 1024 }).map((n) => n / 1024),
);

/** A route's plan: its points' places and kinds, its lines as pairs of point indices, its lead's start. */
const aPlan = fc
  .integer({ min: 1, max: 5 })
  .chain((count) =>
    fc.record({
      places: fc.array(fc.record({ x: aFraction, y: aFraction, kind: fc.constantFrom<'stop' | 'bend'>('stop', 'bend') }), {
        minLength: count,
        maxLength: count,
      }),
      // Ordered pairs of two different points; a pair joined already, either way round, is dropped (a route never
      // joins two points twice). The saved order is the order drawn, so forks, rejoins and left-out lines all occur.
      // The second point is the first plus 1 to count − 1, round, so never the first (and a route of one point has none).
      pairs: fc.array(
        fc
          .tuple(fc.integer({ min: 0, max: count - 1 }), fc.integer({ min: 1, max: Math.max(1, count - 1) }))
          .map(([a, step]) => [a, (a + step) % count] as const),
        { maxLength: count === 1 ? 0 : 6 },
      ),
      start: fc.integer({ min: 0, max: count - 1 }),
      markerHalf: fc.oneof(fc.integer({ min: 0, max: 40 }), fc.double({ min: 0, max: 40, noNaN: true })),
    }),
  );

type Plan = typeof aPlan extends fc.Arbitrary<infer T> ? T : never;

/** The image's bounds in the pointer's pixels: any offset, a positive size, any scale. */
const aBounds = fc.record({
  x: fc.oneof(fc.integer({ min: -400, max: 400 }), fc.double({ min: -400, max: 400, noNaN: true })),
  y: fc.oneof(fc.integer({ min: -400, max: 400 }), fc.double({ min: -400, max: 400, noNaN: true })),
  width: fc.oneof(fc.integer({ min: 60, max: 2400 }), fc.double({ min: 60, max: 2400, noNaN: true })),
  height: fc.oneof(fc.integer({ min: 60, max: 2400 }), fc.double({ min: 60, max: 2400, noNaN: true })),
  scale: fc.double({ min: 0.25, max: 4, noNaN: true }),
});

function made(plan: Plan, prefix: string, bounds: ImageBounds): HitRoute {
  const nextId = counter(prefix);
  const points = plan.places.map((place) => newPoint(nextId, place));
  const joined = new Set<string>();
  const lines = plan.pairs.flatMap(([a, b]) => {
    const from = points[a];
    const to = points[b];
    const key = [a, b].sort().join('-');
    if (from === undefined || to === undefined || joined.has(key)) return [];
    joined.add(key);
    return [newLine(nextId, from.id, to.id)];
  });
  const leadStart = points[plan.start]?.id ?? null;
  const route: Route = { ...newRoute(nextId), points, lines, leadStart };
  return { route, timeline: composeTimeline(route, bounds.width / bounds.height), markerHalf: plan.markerHalf };
}

/** Which press, by kind: indices are taken modulo what the routes hold, so every draw names something real. */
const aPress = fc.oneof(
  fc.record({ kind: fc.constant('on-point' as const), route: fc.nat(), point: fc.nat() }),
  fc.record({ kind: fc.constant('on-ring' as const), route: fc.nat(), point: fc.nat(), axis: fc.constantFrom(0, 1, 2, 3) }),
  fc.record({
    kind: fc.constant('near-line' as const),
    route: fc.nat(),
    line: fc.nat(),
    sample: fc.nat(),
    dx: fc.double({ min: -12, max: 12, noNaN: true }),
    dy: fc.double({ min: -12, max: 12, noNaN: true }),
  }),
  fc.record({ kind: fc.constant('anywhere' as const), u: fc.double({ min: -0.1, max: 1.1, noNaN: true }), v: fc.double({ min: -0.1, max: 1.1, noNaN: true }) }),
);

type Press = typeof aPress extends fc.Arbitrary<infer T> ? T : never;

const pick = <T,>(list: readonly T[], index: number): T | undefined => (list.length === 0 ? undefined : list[index % list.length]);

/** The press's place in pixels, or null where its kind has nothing to take it from (a route with no lines). */
function placeOf(press: Press, bounds: ImageBounds, routes: readonly HitRoute[]): Pixel | null {
  if (press.kind === 'anywhere') return { x: bounds.x + press.u * bounds.width, y: bounds.y + press.v * bounds.height };
  const edited = pick(routes, press.route);
  if (edited === undefined) return null;
  if (press.kind === 'near-line') {
    const shapes = [...edited.timeline.shapes.values()];
    const sample = pick(pick(shapes, press.line)?.samples ?? [], press.sample);
    if (sample === undefined) return null;
    const at = imageToCanvas(bounds, sample);
    return { x: at.x + press.dx, y: at.y + press.dy };
  }
  const point = pick(edited.route.points, press.point);
  if (point === undefined) return null;
  const at = imageToCanvas(bounds, point);
  if (press.kind === 'on-point') return at;
  const radius = Math.max(POINT_HIT_RADIUS, edited.markerHalf);
  const offsets: readonly (readonly [number, number])[] = [[radius, 0], [-radius, 0], [0, radius], [0, -radius]];
  const [dx, dy] = offsets[press.axis] ?? [0, 0];
  return { x: at.x + dx, y: at.y + dy };
}

describe('hit testing over random routes, bounds and presses', () => {
  it('a press on a point names a point; a named point is the nearest within its radius; a line only when no point is, within 8 px; nothing only when neither; every id held', () => {
    const reach = { point: 0, line: 0, none: 0, onRadius: 0 };
    fc.assert(
      fc.property(
        aBounds,
        fc.array(aPlan, { minLength: 1, maxLength: 2 }),
        fc.array(aPress, { minLength: 1, maxLength: 8 }),
        (bounds, plans, presses) => {
          const routes = plans.map((plan, index) => made(plan, `r${String(index)}-`, bounds));
          // Every point of every route with its distance and radius, and every line a route holds and the frame drew.
          for (const press of presses) {
            const at = placeOf(press, bounds, routes);
            if (at === null) continue;
            const points = routes.flatMap(({ route, markerHalf }) =>
              route.points.map((point) => {
                const place = imageToCanvas(bounds, point);
                return { route: route.id, id: point.id, dist: Math.hypot(place.x - at.x, place.y - at.y), radius: Math.max(POINT_HIT_RADIUS, markerHalf) };
              }),
            );
            const within = points.filter((each) => each.dist <= each.radius);
            if (points.some((each) => each.dist === each.radius)) reach.onRadius += 1;
            const lineDist = (edited: HitRoute, lineId: string): number => {
              const shape = edited.timeline.shapes.get(lineId);
              const nearest = shape === undefined ? null : nearestOnPolyline(shape.samples.map((sample) => imageToCanvas(bounds, sample)), at);
              return nearest?.dist ?? Infinity;
            };
            const linesNear = routes.flatMap((edited) =>
              edited.route.lines.filter((line) => lineDist(edited, line.id) <= LINE_HIT_RADIUS).map((line) => line.id),
            );

            const under = hitTest(at, bounds, routes);

            // 5: every id named is held by the route named.
            if (under !== null) {
              const holder = routes.find((each) => each.route.id === under.route);
              expect(holder).toBeDefined();
              const held = under.kind === 'point' ? holder?.route.points : holder?.route.lines;
              expect(held?.some((each) => each.id === under.id)).toBe(true);
            }
            // 1: a press exactly on a point's place names a point at distance 0.
            if (press.kind === 'on-point') {
              expect(under?.kind).toBe('point');
              expect(points.find((each) => each.route === under?.route && each.id === under.id)?.dist).toBe(0);
            }
            if (under === null) {
              // 4: nothing named, so no point within its radius and no line within 8 px.
              reach.none += 1;
              expect(within).toEqual([]);
              expect(linesNear).toEqual([]);
            } else if (under.kind === 'point') {
              // 2: the named point is within its radius, and no point within its own is strictly nearer.
              reach.point += 1;
              const named = points.find((each) => each.route === under.route && each.id === under.id);
              expect(named).toBeDefined();
              if (named === undefined) continue;
              expect(named.dist).toBeLessThanOrEqual(named.radius);
              expect(within.filter((each) => each.dist < named.dist)).toEqual([]);
            } else {
              // 3: a line only when no point is within its radius, and it is within 8 px over its drawn samples.
              reach.line += 1;
              expect(within).toEqual([]);
              const holder = routes.find((each) => each.route.id === under.route);
              expect(holder === undefined ? Infinity : lineDist(holder, under.id)).toBeLessThanOrEqual(LINE_HIT_RADIUS);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
    expect(reach.point).toBeGreaterThan(0);
    expect(reach.line).toBeGreaterThan(0);
    expect(reach.none).toBeGreaterThan(0);
    expect(reach.onRadius).toBeGreaterThan(0);
  });
});
