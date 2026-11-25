// CORE-06: the route's editing half (the plan's §3, A1): delete points and lines, insert a point on a line, move and
// duplicate points. Ported in behaviour from frozen v3 (`NetworkEditService.deleteNode`, the leg's + handle, the
// arrow keys' nudge, Duplicate), never its code, and ruled by the orchestrator where v4's graph differs (D229, answered
// by the owner, and D237 and D238 in DECISIONS-FOR-JOE.md). Each edit keeps graph.ts's rules: a pure function on one
// `Route`, ids from the caller's `IdSource`, an `EditRefusal` and never a throw, no limit or range checked (`checkScene`
// does), only what it names changed, the same route object when nothing changes, and saved order kept as behaviour.
import type { Route } from '../scene';
import { holds, lineBetween, type EditRefusal } from './graph';

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
