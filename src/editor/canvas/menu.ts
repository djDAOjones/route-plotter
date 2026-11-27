// CORE-06, chat G1 (brief 130, rulings CB, CC; D267 (a), provisional until the owner answers): the point's menu as one
// pure list, built from the project and the point as the menu opens. Its items, in order: "Mark as start" or "Remove
// start mark", "Mark as end" or "Remove end mark", "Set lead start", "Make stop" or "Make bend", then "Delete" set
// apart. Each runs a store command already built (./commands.ts), whose undo words are the item's words; Delete's are
// "Delete point" or "Delete points". Delete acts on the whole selection when the point is part of it, as the Delete key
// does (dom.ts point 7), else on the point alone. An item whose command the store would refuse, or that would change
// nothing (the lead's start set again), stays listed with its reason, and running it does nothing (v3's menu kept such
// an entry, focusable, with its reason: v3/src/components/ContextMenu.js 11 to 13, 82 to 91).
//
// `menuSelection` is the selection the menu opens with (ruling CB, as v3's waypoint menu: v3/src/app/wiringControllers.js
// 751 to 754): a point already in the selection keeps the selection as it is; any other is selected alone. The page's
// opener (dom.ts point 9) selects it, never a step, before the list is built.
//
// CORE-06, chat G2 (brief 138, ruling DA; D242, D250 (a), D270, provisional until the owner objects): "Move" stands
// after "Make stop" or "Make bend" and before Delete. It is no store command: its `command` is null and its `move` names
// the route, the point and the points to move (Delete's rule: the whole selection when the point is in it, else the
// point alone), so `runItem` never dispatches it and the page hands it to the canvas's binding (dom.ts point 10), where
// the next click on the picture places it. It is off, with its reason, only when the point is no longer on the route.
import type { Command, Current, Refusal } from '../store/command';
import type { Selection } from '../store/selection';
import type { Store } from '../store/store';
import { deletePoints, markPoint, setKind, setLeadStart, unmarkPoint } from './commands';

/** What "Move" hands the canvas's binding (dom.ts point 10): the route, the menu's point, and every point to move. */
export interface MoveRequest {
  readonly route: string;
  readonly point: string;
  readonly points: readonly string[];
}

export interface MenuItem {
  /** The item's words. */
  readonly label: string;
  /** The built command it runs; null for "Move", which runs no command. */
  readonly command: Command | null;
  /** "Move"'s request for the canvas's binding; null for every other item. */
  readonly move: MoveRequest | null;
  /** Why it cannot run now, shown as its description; null when it can. */
  readonly reason: string | null;
  /** Whether a separator stands before it. */
  readonly apart: boolean;
}

export interface PointMenu {
  readonly route: string;
  readonly point: string;
  readonly items: readonly MenuItem[];
}

/** The reason an item cannot run, from the store's refusal of its command. */
function refusalReason(refusal: Refusal): string {
  if (refusal.why === 'refused-edit' && refusal.refusal.refused === 'no-such-point') return 'This point is no longer on the route.';
  if (refusal.why === 'missing') return 'This route is no longer in the project.';
  return 'The route cannot take this change now.';
}

/** No item adds anything, so none asks for an id. */
const NO_ID = (): string => {
  throw new Error('a menu item adds nothing');
};

/**
 * Why `command` cannot run on `current`, or null when it can: the refusal's reason, or `unchanged` when it would give
 * back what it found (the store would make no step).
 */
export function itemReason(current: Current, command: Command, unchanged: string): string | null {
  const result = command.apply(current, { nextId: NO_ID });
  if ('why' in result) return refusalReason(result);
  return result === current ? unchanged : null;
}

/** What an item says when it would change nothing; only "Set lead start" on the lead's start can. */
const UNCHANGED = 'This would change nothing.';

/** Why "Move" cannot start now, or null when it can: only when the point (or its route) is no longer in the project. */
function moveReason(current: Current, routeId: string, pointId: string): string | null {
  const route = current.project.scene.routes.find((each) => each.id === routeId);
  if (route === undefined) return 'This route is no longer in the project.';
  return route.points.some((each) => each.id === pointId) ? null : 'This point is no longer on the route.';
}

/** The menu of point `pointId` of route `routeId`, or null when the project holds no such point. */
export function pointMenu(current: Current, routeId: string, pointId: string): PointMenu | null {
  const route = current.project.scene.routes.find((each) => each.id === routeId);
  const point = route?.points.find((each) => each.id === pointId);
  if (route === undefined || point === undefined) return null;
  const marked = (end: 'start' | 'end') => route.marks.some((mark) => mark.point === pointId && mark.end === end);
  const { selection } = current;
  const ids = selection.route === routeId && selection.points.includes(pointId) ? selection.points : [pointId];
  const built: readonly (readonly [string, Command, string, boolean])[] = [
    ['start', marked('start') ? unmarkPoint(routeId, pointId, 'start') : markPoint(routeId, pointId, 'start'), UNCHANGED, false],
    ['end', marked('end') ? unmarkPoint(routeId, pointId, 'end') : markPoint(routeId, pointId, 'end'), UNCHANGED, false],
    ['lead', setLeadStart(routeId, pointId), 'This point is already where the lead starts.', false],
    ['kind', setKind(routeId, pointId, point.kind === 'stop' ? 'bend' : 'stop'), UNCHANGED, false],
    ['delete', deletePoints(routeId, ids), UNCHANGED, true],
  ];
  const items = built.map(([which, command, unchanged, apart]): MenuItem => ({
    label: which === 'delete' ? 'Delete' : command.label,
    command,
    move: null,
    reason: itemReason(current, command, unchanged),
    apart,
  }));
  const move: MenuItem = { label: 'Move', command: null, move: { route: routeId, point: pointId, points: ids }, reason: moveReason(current, routeId, pointId), apart: false };
  return { route: routeId, point: pointId, items: [...items.slice(0, -1), move, ...items.slice(-1)] };
}

/**
 * Runs `item` on `store`: its command as one undo step under its words. Nothing for an item with a reason, for "Move"
 * (no command: the page hands it to the canvas's binding), nor when the store refuses it (the project changed since
 * the menu opened); true when it ran.
 */
export function runItem(store: Pick<Store, 'dispatch'>, item: MenuItem): boolean {
  if (item.reason !== null || item.command === null) return false;
  const outcome = store.dispatch(item.command);
  return outcome.ok && outcome.changed;
}

/** The selection the menu opens with (ruling CB): kept when the point is in it, else the point alone. */
export function menuSelection(selection: Selection, routeId: string, pointId: string): Selection {
  if (selection.route === routeId && selection.points.includes(pointId)) return selection;
  return { route: routeId, points: [pointId] };
}
