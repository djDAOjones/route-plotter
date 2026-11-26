// CORE-06: hit testing, what lies under a pointer's place on the canvas (the plan's §15; v3's findWaypointAt and
// findSegmentAt, v3/src/app/pointer.js:198–300, and its polyline geometry, v3/src/utils/segmentHitTest.js), as pure
// functions: no DOM, no store, no clock, no drawing. The page gives what the frame already holds (the place pressed and
// the image's bounds, both in the pointer's CSS pixels, and each edited route's timeline and its markers' drawn
// half-width) and gets the pointer machine's `Under`: a point, a line (with the "+"'s place when on it) or nothing.
//
// Every radius is in those pixels and is never divided by a zoom: v3 divided by its zoom because it worked in canvas
// units, while v4's bounds already carry the zoom, so a radius is constant on screen, as v3's was. A point is hit before
// any line (v3's handler asked for a waypoint first). A line is hit along the very samples it was drawn with
// (`composeTimeline`'s shapes, never rebuilt here), so the hit and the drawing cannot disagree. Between the two, a line's
// "+" (CORE-06, brief 120, ruling Y; v3's leg plus, app/pointer.js:293–294) is hit where the line overlay draws it,
// `pointAt(samples, 0.5)` of the same samples (src/features/line/draw/overlays.ts). The hit knows no pointer type: a
// finger's press on the "+" counts as a mouse's.
import { pointAt as placeAlong } from '../../core/geometry/path';
import { imageToCanvas, type ImageBounds } from '../../core/geometry/transform';
import type { Route } from '../../core/model/scene';
import type { Timeline } from '../../core/timing/timeline';
import type { Pixel, Under } from './pointer';

/** v3's INTERACTION.WAYPOINT_HIT_RADIUS (constants.js:109): a point's least radius, in CSS pixels. */
export const POINT_HIT_RADIUS = 15;

/** v3's INTERACTION.SEGMENT_HIT_RADIUS (constants.js:110): how near a line a press must be, in CSS pixels. */
export const LINE_HIT_RADIUS = 8;

/** v3's leg-plus radius (app/pointer.js:293–294): how near a line's "+" a press must be, in CSS pixels (D255 asks). */
export const PLUS_HIT_RADIUS = 12;

/** A route the editor is editing, as the frame drew it. */
export interface HitRoute {
  readonly route: Pick<Route, 'id' | 'points' | 'lines'>;
  /** The route's timeline as `composeTimeline` built it for the frame: its walk, its walked lines and their shapes. */
  readonly timeline: Pick<Timeline, 'lines' | 'walk' | 'shapes'>;
  /**
   * Its markers' drawn half-width in the pointer's pixels: `look.size × frame.scale × screen.zoom`, the ring the editor
   * draws round a selected stop (src/features/markers/draw/overlays.ts), at the marker's whole size whatever its timing.
   */
  readonly markerHalf: number;
}

/** The nearest place on a polyline: `index` is the span's start plus how far along it (0 to 1), as v3's. */
export interface Nearest {
  readonly index: number;
  readonly dist: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The nearest place on `points` to `at`, by perpendicular projection onto each span, clamped to the span's ends (not
 * the nearest vertex, so a straight line with sparse samples is still hit along its length). A span of no length is
 * its one place. The earlier span keeps a tie. Null for fewer than two points. v3's nearestOnPolyline.
 */
export function nearestOnPolyline(points: readonly Pixel[], at: Pixel): Nearest | null {
  let best: { index: number; distSq: number; x: number; y: number } | null = null;
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (a === undefined || b === undefined) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / lengthSq)) : 0;
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    const distSq = (at.x - x) ** 2 + (at.y - y) ** 2;
    if (best === null || distSq < best.distSq) best = { index: i + t, distSq, x, y };
  }
  return best === null ? null : { index: best.index, dist: Math.sqrt(best.distSq), x: best.x, y: best.y };
}

/** A point's radius: v3's 15 px, or its marker's drawn half-width where that is larger (INTAKE.22). */
function pointRadius(markerHalf: number): number {
  return Math.max(POINT_HIT_RADIUS, markerHalf);
}

/**
 * The lines of a route in the order the line feature draws them, the later on top: the lead's walked lines in walk
 * order, then the lines it leaves out (src/features/line/model/line.ts, `evaluate`'s `order`).
 */
function drawnOrder(timeline: HitRoute['timeline']): readonly string[] {
  return [...timeline.lines.map((line) => line.lineId), ...timeline.walk.leftOut];
}

/**
 * The point under `at`: of every point within its radius, the closest; a tie keeps the earlier route given, then the
 * earlier in its route's `points` (v3's strict `<`). Within means at most the radius.
 */
function pointAt(at: Pixel, bounds: ImageBounds, routes: readonly HitRoute[]): Under {
  let found: Under = null;
  let nearest = Infinity;
  for (const { route, markerHalf } of routes) {
    const radius = pointRadius(markerHalf);
    for (const point of route.points) {
      const place = imageToCanvas(bounds, point);
      const dist = Math.hypot(place.x - at.x, place.y - at.y);
      if (dist <= radius && dist < nearest) {
        found = { kind: 'point', route: route.id, id: point.id };
        nearest = dist;
      }
    }
  }
  return found;
}

/**
 * The line under `at`: the nearest within LINE_HIT_RADIUS across every line of every route; a tie goes to the line
 * drawn on top, the later route given (the routes are drawn in list order, src/player/compose.ts's drawing stage) and,
 * within a route, the later in its drawn order. A line is tried only if its route holds it and the timeline both draws
 * it and gives its shape (DEF-51: a shape left from another route names nothing, a line with no shape is not hit).
 */
function lineAt(at: Pixel, bounds: ImageBounds, routes: readonly HitRoute[]): Under {
  let found: Under = null;
  let nearest = Infinity;
  for (const { route, timeline } of routes) {
    const held = new Set(route.lines.map((line) => line.id));
    for (const lineId of drawnOrder(timeline)) {
      if (!held.has(lineId)) continue;
      const shape = timeline.shapes.get(lineId);
      if (shape === undefined) continue;
      const hit = nearestOnPolyline(
        shape.samples.map((sample) => imageToCanvas(bounds, sample)),
        at,
      );
      if (hit !== null && hit.dist <= LINE_HIT_RADIUS && hit.dist <= nearest) {
        found = { kind: 'line', route: route.id, id: lineId };
        nearest = hit.dist;
      }
    }
  }
  return found;
}

/**
 * The line whose "+" is under `at`: the nearest "+" within PLUS_HIT_RADIUS, each at its line's middle sample by index
 * (`pointAt(samples, 0.5)`, as the overlay draws it); a tie as `lineAt`'s, to the line drawn on top. Its `plus` is that
 * place in image fractions. The lines tried are `lineAt`'s.
 */
function plusAt(at: Pixel, bounds: ImageBounds, routes: readonly HitRoute[]): Under {
  let found: Under = null;
  let nearest = Infinity;
  for (const { route, timeline } of routes) {
    const held = new Set(route.lines.map((line) => line.id));
    for (const lineId of drawnOrder(timeline)) {
      if (!held.has(lineId)) continue;
      const middle = placeAlong(timeline.shapes.get(lineId)?.samples ?? [], 0.5);
      if (middle === null) continue;
      const place = imageToCanvas(bounds, middle);
      const dist = Math.hypot(place.x - at.x, place.y - at.y);
      if (dist <= PLUS_HIT_RADIUS && dist <= nearest) {
        found = { kind: 'line', route: route.id, id: lineId, plus: middle };
        nearest = dist;
      }
    }
  }
  return found;
}

/**
 * What lies under `at` (in the pointer's CSS pixels, as `bounds` are): a point of one of `routes` if any is within its
 * radius, else a line whose "+" is within PLUS_HIT_RADIUS (with `plus`), else a line within LINE_HIT_RADIUS (without),
 * else nothing. Every id named is one its route holds.
 */
export function hitTest(at: Pixel, bounds: ImageBounds, routes: readonly HitRoute[]): Under {
  return pointAt(at, bounds, routes) ?? plusAt(at, bounds, routes) ?? lineAt(at, bounds, routes);
}
