// CORE-06: the route's editing half (the plan's §3, A1): delete points and lines, insert a point on a line, move and
// duplicate points. Ported in behaviour from frozen v3 (`NetworkEditService.deleteNode`, the leg's + handle, the
// arrow keys' nudge, Duplicate), never its code, and ruled by the orchestrator where v4's graph differs (D229, answered
// by the owner, and D237 and D238 in DECISIONS-FOR-JOE.md). Each edit keeps graph.ts's rules: a pure function on one
// `Route`, ids from the caller's `IdSource`, an `EditRefusal` and never a throw, no limit or range checked (`checkScene`
// does), only what it names changed, the same route object when nothing changes, and saved order kept as behaviour.
import { newLine, newPoint, type IdSource, type Route } from '../scene';
import { holds, lineBetween, type EditRefusal, type Place } from './graph';

type Line = Route['lines'][number];

/** The first id of `ids` the route does not hold, as a refusal; none when it holds them all. */
function unheld(route: Route, ids: readonly string[]): EditRefusal | undefined {
  const missing = ids.find((id) => !holds(route, id));
  return missing === undefined ? undefined : { refused: 'no-such-point', id: missing };
}

/**
 * One point deleted (D229, the owner's "Depends on shape"). It closes up when exactly two lines touch it, one reaching
 * it and one leaving it by their saved ends, whose far ends are two different points no other line joins either way:
 * the reaching line keeps its id, place, direction and speed and now reaches the leaving line's far end, and the
 * leaving line goes. Otherwise every line touching it goes. Its marks go; a lead's start on it moves on.
 */
function deleteOne(route: Route, pointId: string): Route {
  const touching = route.lines.filter((line) => line.from === pointId || line.to === pointId);
  const closed = closingUp(route, touching, pointId);
  const lines: Line[] = closed
    ? route.lines
        .filter((line) => line !== closed.outgoing)
        .map((line) => (line === closed.incoming ? { ...line, to: closed.outgoing.to } : line))
    : route.lines.filter((line) => !touching.includes(line));
  const points = route.points.filter((point) => point.id !== pointId);
  const marks = route.marks.some((mark) => mark.point === pointId)
    ? route.marks.filter((mark) => mark.point !== pointId)
    : route.marks;
  return { ...route, points, lines, marks, leadStart: nextLeadStart(route, pointId, points, closed?.outgoing) };
}

/** The line reaching the point and the line leaving it, when deleting the point closes them up into one. */
function closingUp(route: Route, touching: readonly Line[], pointId: string) {
  if (touching.length !== 2) return undefined;
  const incoming = touching.find((line) => line.to === pointId);
  const outgoing = touching.find((line) => line.from === pointId);
  if (incoming === undefined || outgoing === undefined || incoming === outgoing) return undefined;
  if (incoming.from === outgoing.to || lineBetween(route, incoming.from, outgoing.to) !== undefined) return undefined;
  return { incoming, outgoing };
}

/**
 * The lead's start once `pointId` has gone (the stage plan's ruling 4): kept when elsewhere; when it closed up, the
 * leaving line's far end; else the far end of the first line in `lines` leaving the point; else the first point left;
 * else none.
 */
function nextLeadStart(route: Route, pointId: string, left: Route['points'], closedBy: Line | undefined): string | null {
  if (route.leadStart !== pointId) return route.leadStart;
  if (closedBy !== undefined) return closedBy.to;
  const leaving = route.lines.find((line) => line.from === pointId);
  return leaving?.to ?? left[0]?.id ?? null;
}

/** Points deleted one at a time, in the order given (D229); an id the route does not hold refuses them all. */
export function deletePoints(route: Route, ids: readonly string[]): Route | EditRefusal {
  const refusal = unheld(route, ids);
  if (refusal !== undefined) return refusal;
  return [...new Set(ids)].reduce(deleteOne, route);
}

/** A line deleted; its points, the marks and the lead's start stay. */
export function deleteLine(route: Route, lineId: string): Route | EditRefusal {
  if (!route.lines.some((line) => line.id === lineId)) return { refused: 'no-such-line', id: lineId };
  return { ...route, lines: route.lines.filter((line) => line.id !== lineId) };
}

/**
 * A point inserted on a line (v3's + handle on a leg, D237's ruling 4): a new point at `place`, after the route's
 * others; the line keeps its id, place, direction and speed and now ends at the new point; a new line from the new
 * point to the old end, with the same direction and speed, goes straight after it in `lines`, so the walk's order is
 * kept. The page picks the place; the core does not clamp it.
 */
export function splitLine(
  route: Route,
  nextId: IdSource,
  lineId: string,
  place: Place,
): { route: Route; point: string } | EditRefusal {
  const at = route.lines.findIndex((line) => line.id === lineId);
  const line = route.lines[at];
  if (line === undefined) return { refused: 'no-such-line', id: lineId };
  const point = newPoint(nextId, place);
  const rest = { ...newLine(nextId, point.id, line.to), direction: line.direction, speedFactor: line.speedFactor };
  const lines = [...route.lines.slice(0, at), { ...line, to: point.id }, rest, ...route.lines.slice(at + 1)];
  return { route: { ...route, points: [...route.points, point], lines }, point: point.id };
}

/**
 * Points moved by the same amount, in image fractions. Nothing is clamped here: v3's nudge sizes and its clamp to the
 * image at a zoom of 1 or more are the page's, which works out the amounts; `checkScene` holds the range. A point whose
 * coordinates the move leaves as they were (by 0, or by an amount too small to change them) stays the same object, and
 * when none changes the route given is given back.
 */
export function movePoints(route: Route, ids: readonly string[], dx: number, dy: number): Route | EditRefusal {
  const refusal = unheld(route, ids);
  if (refusal !== undefined) return refusal;
  const moving = new Set(ids);
  let moved = false;
  const points = route.points.map((point) => {
    if (!moving.has(point.id)) return point;
    const [x, y] = [point.x + dx, point.y + dy];
    if (x === point.x && y === point.y) return point;
    moved = true;
    return { ...point, x, y };
  });
  return moved ? { ...route, points } : route;
}

/** A point's place when a drag began. */
export interface Start {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/**
 * A drag's points placed (CORE-06, chat C): each named point at its place when the drag began plus one offset in image
 * fractions, unclamped, so that after any number of moves the places are those of one move by the whole offset, never
 * a sum of steps. A point the route no longer holds is refused; the route given comes back when no place changes.
 */
export function placePoints(route: Route, starts: readonly Start[], dx: number, dy: number): Route | EditRefusal {
  const refusal = unheld(
    route,
    starts.map((start) => start.id),
  );
  if (refusal !== undefined) return refusal;
  const placed = new Map(starts.map((start) => [start.id, { x: start.x + dx, y: start.y + dy }]));
  let moved = false;
  const points = route.points.map((point) => {
    const place = placed.get(point.id);
    if (place === undefined || (place.x === point.x && place.y === point.y)) return point;
    moved = true;
    return { ...point, ...place };
  });
  return moved ? { ...route, points } : route;
}

/** How far right and down a copy stands from what it copies (v3's Duplicate: 2% of the image each way). */
export const DUPLICATE_OFFSET = 0.02;

/**
 * Points copied (D238, awaiting the owner's answer): a copy of each named point, in the order given, after the route's
 * others, DUPLICATE_OFFSET right and down, unclamped, with its kind, label and pause; a copy of each line between two
 * named points, after the route's other lines in their saved order, with its direction and speed. No mark and no
 * lead's start is copied. Gives the copies' ids in the order made.
 */
export function duplicatePoints(
  route: Route,
  nextId: IdSource,
  ids: readonly string[],
): { route: Route; points: string[] } | EditRefusal {
  const refusal = unheld(route, ids);
  if (refusal !== undefined) return refusal;
  if (ids.length === 0) return { route, points: [] };
  const copyOf = new Map<string, string>();
  const copies = [...new Set(ids)].flatMap((id) => {
    const point = route.points.find((each) => each.id === id);
    if (point === undefined) return [];
    const copy = { ...point, id: nextId(), x: point.x + DUPLICATE_OFFSET, y: point.y + DUPLICATE_OFFSET };
    copyOf.set(id, copy.id);
    return [copy];
  });
  const lines = route.lines.flatMap((line) => {
    const [from, to] = [copyOf.get(line.from), copyOf.get(line.to)];
    return from === undefined || to === undefined ? [] : [{ ...line, id: nextId(), from, to }];
  });
  const points = copies.map((copy) => copy.id);
  return { route: { ...route, points: [...route.points, ...copies], lines: [...route.lines, ...lines] }, points };
}
