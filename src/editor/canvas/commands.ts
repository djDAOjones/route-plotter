// CORE-06: the store's commands for drawing a route (the plan's §8, A19). Each wraps one of the graph's edits
// (src/core/model/commands/graph.ts) as a `Command`: the words of its undo step, the route it works on, and the
// selection after it. A point the pen adds or reaches becomes the selection, alone, so the pen's point is always the
// selection's last point; every other edit keeps the selection. An edit the route cannot take is the store's
// `refused-edit`, carrying the core's refusal; a route the project does not hold is `missing`. An edit that changes
// nothing gives back what it found, so the store makes no step; the limits are the store's check, never these.
import * as editing from '../../core/model/commands/editing';
import * as graph from '../../core/model/commands/graph';
import type { EditRefusal, PenTarget, Place } from '../../core/model/commands/graph';
import type { Route } from '../../core/model/scene';
import type { Command, Current, Refusal } from '../store/command';

type Line = Route['lines'][number];
type Mark = Route['marks'][number];
type Point = Route['points'][number];

const refusedEdit = (refusal: EditRefusal): Refusal => ({ why: 'refused-edit', refusal });

/**
 * `current` with route `routeId` changed by `edit`, which gives the new route and the point to select (or none, to
 * keep the selection). The same `current` when the edit gave back the same route and selects nothing.
 */
function onRoute(
  current: Current,
  routeId: string,
  edit: (route: Route) => { route: Route; select: readonly string[] | null } | EditRefusal,
): Current | Refusal {
  const scene = current.project.scene;
  const route = scene.routes.find((each) => each.id === routeId);
  if (route === undefined) return { why: 'missing', what: `route ${routeId}` };
  const result = edit(route);
  if (graph.isRefusal(result)) return refusedEdit(result);
  const selection = result.select === null ? current.selection : { route: routeId, points: result.select };
  if (result.route === route && selection === current.selection) return current;
  const routes = result.route === route ? scene.routes : scene.routes.map((each) => (each === route ? result.route : each));
  const project = routes === scene.routes ? current.project : { ...current.project, scene: { ...scene, routes } };
  return { project, selection };
}

/** An edit that keeps the selection. */
const keeping = (result: Route | EditRefusal) => (graph.isRefusal(result) ? result : { route: result, select: null });

/** A new point at `place`, after the route's others, and selected; a route's first point becomes the lead's start. */
export function addPoint(routeId: string, place: Place): Command {
  return {
    label: 'Add point',
    apply: (current, { nextId }) =>
      onRoute(current, routeId, (route) => {
        const added = graph.addPoint(route, nextId, place);
        return { route: added.route, select: [added.point] };
      }),
  };
}

/** A one-way line from `from` to `to`; two points joined already, either way, are refused. */
export function joinPoints(routeId: string, from: string, to: string): Command {
  return {
    label: 'Join points',
    apply: (current, { nextId }) => onRoute(current, routeId, (route) => keeping(graph.joinPoints(route, nextId, from, to))),
  };
}

/**
 * One step of the pen standing on `pen` (or on nothing): a new point at a place, chained from the pen point, or a
 * point of the route, joined from it. The point the pen moves to becomes the selection, even when nothing is added.
 */
export function penStep(routeId: string, pen: string | null, target: PenTarget): Command {
  return {
    label: 'place' in target ? 'Add point' : 'Join points',
    apply: (current, { nextId }) =>
      onRoute(current, routeId, (route) => {
        const step = graph.penStep(route, nextId, pen, target);
        return graph.isRefusal(step) ? step : { route: step.route, select: [step.pen] };
      }),
  };
}

/** A line set to run one way, from its first point to its second, or both ways. */
export function setDirection(routeId: string, lineId: string, direction: Line['direction']): Command {
  return {
    label: direction === 'one way' ? 'Make line one way' : 'Make line two-way',
    apply: (current) => onRoute(current, routeId, (route) => keeping(graph.setDirection(route, lineId, direction))),
  };
}

/** A line's ends swapped, one way or both ways; its id, place, direction and speed kept. */
export function reverseLine(routeId: string, lineId: string): Command {
  return {
    label: 'Reverse line',
    apply: (current) => onRoute(current, routeId, (route) => keeping(graph.reverseLine(route, lineId))),
  };
}

/** The point the lead walks from. */
export function setLeadStart(routeId: string, pointId: string): Command {
  return {
    label: 'Set lead start',
    apply: (current) => onRoute(current, routeId, (route) => keeping(graph.setLeadStart(route, pointId))),
  };
}

/** A point marked as a start or an end. */
export function markPoint(routeId: string, pointId: string, end: Mark['end']): Command {
  return {
    label: end === 'start' ? 'Mark as start' : 'Mark as end',
    apply: (current) => onRoute(current, routeId, (route) => keeping(graph.markPoint(route, pointId, end))),
  };
}

/** A point's start or end mark taken off. */
export function unmarkPoint(routeId: string, pointId: string, end: Mark['end']): Command {
  return {
    label: end === 'start' ? 'Remove start mark' : 'Remove end mark',
    apply: (current) => onRoute(current, routeId, (route) => keeping(graph.unmarkPoint(route, pointId, end))),
  };
}

/** A point made a stop or a bend, its label and pause kept. */
export function setKind(routeId: string, pointId: string, kind: Point['kind']): Command {
  return {
    label: kind === 'stop' ? 'Make stop' : 'Make bend',
    apply: (current) => onRoute(current, routeId, (route) => keeping(graph.setKind(route, pointId, kind))),
  };
}

/** "Delete point" or "Delete points", by how many are named. */
const byCount = (ids: readonly string[], one: string, many: string) => (new Set(ids).size === 1 ? one : many);

/**
 * Points deleted one at a time, in the order given: a point between one line in and one line out closes up, otherwise
 * its lines go with it. The selection is kept; the store drops what went.
 */
export function deletePoints(routeId: string, ids: readonly string[]): Command {
  return {
    label: byCount(ids, 'Delete point', 'Delete points'),
    apply: (current) => onRoute(current, routeId, (route) => keeping(editing.deletePoints(route, ids))),
  };
}

/** A line deleted; its points stay. */
export function deleteLine(routeId: string, lineId: string): Command {
  return {
    label: 'Delete line',
    apply: (current) => onRoute(current, routeId, (route) => keeping(editing.deleteLine(route, lineId))),
  };
}

/** A point inserted on a line at `place`, and selected alone; the line's second half goes straight after it. */
export function splitLine(routeId: string, lineId: string, place: Place): Command {
  return {
    label: 'Insert point',
    apply: (current, { nextId }) =>
      onRoute(current, routeId, (route) => {
        const split = editing.splitLine(route, nextId, lineId, place);
        return graph.isRefusal(split) ? split : { route: split.route, select: [split.point] };
      }),
  };
}

/**
 * Points moved by `dx` and `dy` in image fractions, unclamped: the page works out the amounts (v3's nudge sizes and
 * its clamp). The selection is kept. A drag moves through `store.begin`, one undo step a gesture.
 */
export function movePoints(routeId: string, ids: readonly string[], dx: number, dy: number): Command {
  return {
    label: byCount(ids, 'Move point', 'Move points'),
    apply: (current) => onRoute(current, routeId, (route) => keeping(editing.movePoints(route, ids, dx, dy))),
  };
}

/**
 * A drag's points placed: each at its place when the drag began plus one offset in image fractions, unclamped
 * (editing.placePoints). The pointer's binding (gesture.ts) applies it in its gesture at every move, under movePoints'
 * words. The selection is kept.
 */
export function placePoints(routeId: string, starts: readonly editing.Start[], dx: number, dy: number): Command {
  return {
    label: byCount(
      starts.map((start) => start.id),
      'Move point',
      'Move points',
    ),
    apply: (current) => onRoute(current, routeId, (route) => keeping(editing.placePoints(route, starts, dx, dy))),
  };
}

/** The named points copied, with the lines between them; the copies become the selection, the last copy last. */
export function duplicatePoints(routeId: string, ids: readonly string[]): Command {
  return {
    label: 'Duplicate',
    apply: (current, { nextId }) =>
      onRoute(current, routeId, (route) => {
        const copied = editing.duplicatePoints(route, nextId, ids);
        if (graph.isRefusal(copied)) return copied;
        return { route: copied.route, select: copied.points.length === 0 ? null : copied.points };
      }),
  };
}
