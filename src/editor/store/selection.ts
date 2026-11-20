// CORE-05: what the author has selected. It lives in the editor's store beside the project, never in the saved file:
// a route, and some of that route's points. An undo step records the selection it found and the one it left (DEF-74).
import type { Project } from '../../adapters/io/format';

/** A route, and some of its points; the last point is the one the author picked last, whose sections show. */
export interface Selection {
  readonly route: string | null;
  readonly points: readonly string[];
}

export const NOTHING_SELECTED: Selection = { route: null, points: [] };

/**
 * `selection` with every id the project no longer holds dropped, and each point once: what stays selected after a
 * change. Points with no route are dropped too. The same object comes back when nothing had to go.
 */
export function repairSelection(project: Project, selection: Selection): Selection {
  const route = project.scene.routes.find((each) => each.id === selection.route);
  if (route === undefined) return selection.route === null && selection.points.length === 0 ? selection : NOTHING_SELECTED;
  const held = new Set(route.points.map((point) => point.id));
  const points = [...new Set(selection.points)].filter((id) => held.has(id));
  return points.length === selection.points.length ? selection : { route: route.id, points };
}
