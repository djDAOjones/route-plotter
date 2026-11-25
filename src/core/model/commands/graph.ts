// CORE-06: the edits the pen makes to one route's graph (the plan's §3, A1), ported in behaviour from frozen v3's
// NetworkEditService (`placeNode`, `clickNode`), never its code. Each edit is a pure function on one `Route`: ids come
// from the caller's `IdSource`, and an edit the route cannot take gives back an `EditRefusal`, never a throw. An edit
// checks no limit and no range (`checkScene` does, after every command); it changes only what it names, keeping every
// other point, line, mark, key and order as it was; and an edit that changes nothing gives back the same route
// object. Saved order is behaviour (the lead's walk follows `lines` in it), so a new point goes at the end of
// `points` and a new line at the end of `lines`.
import { newLine, newPoint, type IdSource, type Route } from '../scene';

type Point = Route['points'][number];

/** Where a new point goes and what it is: `x` and `y` in image fractions, a stop or a bend. */
export type Place = Pick<Point, 'x' | 'y' | 'kind'>;

/** Why an edit changed nothing; the route given back is the one given. */
export type EditRefusal =
  /** The route holds no point with this id. */
  | { readonly refused: 'no-such-point'; readonly id: string }
  /** A line would join a point to itself. */
  | { readonly refused: 'same-point'; readonly id: string }
  /** The two points are joined already, by a line either way: the line's id (v3: never a duplicate link). */
  | { readonly refused: 'already-joined'; readonly id: string };

export const isRefusal = <T extends object>(result: T | EditRefusal): result is EditRefusal => 'refused' in result;

const holds = (route: Route, pointId: string): boolean => route.points.some((point) => point.id === pointId);

/** A new point at `place`, after the route's others; the route's first point becomes the lead's start. */
export function addPoint(route: Route, nextId: IdSource, place: Place): { route: Route; point: string } {
  const point = newPoint(nextId, place);
  const first = route.points.length === 0;
  const added = { ...route, points: [...route.points, point] };
  return { route: first ? { ...added, leadStart: point.id } : added, point: point.id };
}

/** The line joining `a` and `b`, either way, if there is one. */
function lineBetween(route: Route, a: string, b: string): Route['lines'][number] | undefined {
  return route.lines.find((line) => (line.from === a && line.to === b) || (line.from === b && line.to === a));
}

/** A one-way line from `from` to `to` at the default speed, after the route's other lines. */
export function joinPoints(route: Route, nextId: IdSource, from: string, to: string): Route | EditRefusal {
  for (const end of [from, to]) if (!holds(route, end)) return { refused: 'no-such-point', id: end };
  if (from === to) return { refused: 'same-point', id: from };
  const joined = lineBetween(route, from, to);
  if (joined !== undefined) return { refused: 'already-joined', id: joined.id };
  return { ...route, lines: [...route.lines, newLine(nextId, from, to)] };
}

/** Where the pen goes next: a new point at a place, or a point the route holds. */
export type PenTarget = { readonly place: Place } | { readonly point: string };

/** The route after a pen step, and the point the pen now stands on. */
export interface PenStep {
  readonly route: Route;
  readonly pen: string;
}

/**
 * One step of the pen, standing on `pen` (or on nothing). With no pen point, the target becomes it: a new point is
 * added, or the pen is put down on a point the route holds. From a pen point, a new place gets a new point and a line
 * to it (a chain); a point the route holds gets a line to it (a join, a loop's closing line or, from a point a line
 * already leaves, a fork), unless the two are joined already, when nothing is added and the pen still moves there.
 */
export function penStep(route: Route, nextId: IdSource, pen: string | null, target: PenTarget): PenStep | EditRefusal {
  if (pen !== null && !holds(route, pen)) return { refused: 'no-such-point', id: pen };
  if ('place' in target) {
    const added = addPoint(route, nextId, target.place);
    if (pen === null) return { route: added.route, pen: added.point };
    const joined = joinPoints(added.route, nextId, pen, added.point);
    return isRefusal(joined) ? joined : { route: joined, pen: added.point };
  }
  if (!holds(route, target.point)) return { refused: 'no-such-point', id: target.point };
  if (pen === null || pen === target.point) return { route, pen: target.point };
  const joined = joinPoints(route, nextId, pen, target.point);
  if (!isRefusal(joined)) return { route: joined, pen: target.point };
  return joined.refused === 'already-joined' ? { route, pen: target.point } : joined;
}
