// CORE-06 (brief 133, rulings CR and CT; D268, the words for the owner's D263 answer, "Yes, every edit"): the one short
// line the page's one status area says after an edit, so a screen-reader user hears what it did. v3's words where v3
// spoke ("Undo", "Redo"), "point" where v4's page already says point. A count comes from the points of every route
// before and after the step, never from the label (which gives singular or plural at most, and Duplicate neither): the
// points fewer for a delete, the points more for a duplicate, the points standing elsewhere for a move. Every other
// step is silent: a nudge (v3 was), the marks, the lead's start, a point's kind and the line's commands (the point's
// menu and the line's are not on the page yet: their chats name their words). Select all is not a step, so it has its
// own line, `allSelected`.
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
