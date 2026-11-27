// CORE-06 (brief 133, rulings CR and CT; D268, the words for the owner's D263 answer, "Yes, every edit"): the one short
// line the page's one status area says after an edit, so a screen-reader user hears what it did. v3's words where v3
// spoke ("Undo", "Redo"), "point" where v4's page already says point. A count comes from the points of every route
// before and after the step, never from the label (which gives singular or plural at most, and Duplicate neither): the
// points fewer for a delete, the points more for a duplicate, the points standing elsewhere for a move. The point's
// menu's items (brief 137, D269, provisional: the same short past-tense pattern) say "Start marked", "Start mark
// removed", "End marked", "End mark removed", "Lead start set", "Point made a stop" and "Point made a bend"; an item
// that is off makes no step, so it says nothing. Every other step is silent: a nudge (v3 was) and the line's commands
// (the line's menu is not on the page yet: its chat names their words). Select all is not a step, so it has its own
// line, `allSelected`.
//
// "Move" from the point's menu (brief 138, ruling DC; D270, provisional until the owner objects) is not a step while it
// waits, so it has its own lines: on choosing it, the prompt (one for a point alone, another when the selection comes
// with it), and on a cancel by Escape, a right-click or leaving the preview, "Move cancelled". The place itself is a
// "Move point" or "Move points" step, so the store's hook says "Point moved" or "N points moved" as above.
import type { Current } from '../store/command';
import type { Stepped } from '../store/store';

/** The points of every route, in order. */
const pointsOf = (current: Current) => current.project.scene.routes.flatMap((route) => route.points);

/** How many more points `after` holds than `before` (fewer is less than 0). */
const gained = (before: Current, after: Current): number => pointsOf(after).length - pointsOf(before).length;

/** How many points of `after` stand elsewhere than they did in `before`. */
function moved(before: Current, after: Current): number {
  const was = new Map(pointsOf(before).map((point) => [point.id, point]));
  return pointsOf(after).filter((point) => {
    const old = was.get(point.id);
    return old !== undefined && (old.x !== point.x || old.y !== point.y);
  }).length;
}

/** "Point <done>" for one, "N points <done>" for more, nothing for none. */
function counted(n: number, done: string): string | null {
  if (n === 1) return `Point ${done}`;
  return n > 1 ? `${String(n)} points ${done}` : null;
}

/** The words for a step made under `label`, from what it found and what it left; null when it is silent. */
export function editWords(label: string, before: Current, after: Current): string | null {
  switch (label) {
    case 'Add point':
      return 'Point added';
    case 'Join points':
      return 'Points joined';
    case 'Insert point':
      return 'Point inserted';
    case 'Delete point':
    case 'Delete points':
      return counted(-gained(before, after), 'deleted');
    case 'Duplicate':
      return counted(gained(before, after), 'duplicated');
    case 'Move point':
    case 'Move points':
      return counted(moved(before, after), 'moved');
    case 'Mark as start':
      return 'Start marked';
    case 'Remove start mark':
      return 'Start mark removed';
    case 'Mark as end':
      return 'End marked';
    case 'Remove end mark':
      return 'End mark removed';
    case 'Set lead start':
      return 'Lead start set';
    case 'Make stop':
      return 'Point made a stop';
    case 'Make bend':
      return 'Point made a bend';
    default:
      return null;
  }
}

/** What a step the store tells of says: a commit its edit's words, an Undo "Undo" and a Redo "Redo", whatever the step. */
export function stepWords(step: Stepped): string | null {
  if (step.kind === 'undo') return 'Undo';
  if (step.kind === 'redo') return 'Redo';
  return editWords(step.label, step.before, step.after);
}

/** Select all's line, `n` the points the selection now holds: "All N points selected", one point as a step says it. */
export function allSelected(n: number): string {
  return n === 1 ? 'Point selected' : `All ${String(n)} points selected`;
}

/** "Move"'s own lines (D270): the prompt for one point, the prompt when the selection comes with it, and the cancel. */
export const MOVE_WORDS = {
  one: 'Move: click where the point should go, or press Escape to cancel',
  group: 'Move: click where the point should go; the other selected points come with it. Escape cancels',
  cancelled: 'Move cancelled',
} as const;

/** "Move"'s prompt, `n` the points that will move: one point the first, two or more the second. */
export function moveAsked(n: number): string {
  return n > 1 ? MOVE_WORDS.group : MOVE_WORDS.one;
}

