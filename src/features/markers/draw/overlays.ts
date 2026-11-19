// CORE-04 stage 6: the editor's overlays that follow a point (the plan's §8; DEF-99.1), ported from v3's
// renderWaypoints (v3/src/services/RenderingService.js:2439–2516) and hover (:358–383). The editor hands the maker
// the routes it is editing and plain ids (which points are selected, which one is under the pointer) and puts the overlay it gets back in the request's list; no
// module ever sees them. The overlay finds each point where every module did (screen.routes) and draws with the
// kit's shapes, in screen pixels, after every layer.
//
// Sizes, as v3's on screen (D153): a ring or a rectangle goes round its stop's marker as the markers' layer draws it,
// look.size × frame.scale × screen.zoom (src/features/markers/draw/markers.ts; v4's markers have no zoom clamp), and
// at the marker's whole size whatever its timing, as v3's editor showed every marker whole: a selection is never
// invisible, even for a stop whose marker is not shown at that moment. v3's gaps and widths go by unitAt(screen.zoom).
// Each route's points are walked once, whatever the number selected; nothing is kept between frames (D147).
import { greyDot, hoverRing, selectionRect, selectionRing, unitAt, type Overlay, type Place, type Screen } from '../../../adapters/render/overlays';
import type { Frame } from '../../../adapters/render/layers';
import type { DrawContext } from '../../../adapters/render/context';
import type { Route } from '../../../core/model/scene';
import { lookOf, type MarkerLook } from '../model/look';

/** A point by its route's id and its own. */
interface PointRef {
  readonly routeId: string;
  readonly pointId: string;
}

/** What the editor chooses: plain ids, never a module's state. */
export interface PointChoices {
  readonly selected: readonly PointRef[];
  /** The point under the pointer; none when absent or null. */
  readonly hovered?: PointRef | null;
}

/** The look a route's stops are drawn with: the markers' one place (D144); a test may hand another. */
type LookFor = (route: Route) => MarkerLook;

const lookOfRoute: LookFor = (route) => lookOf(route.settings.markers);

/** The ids chosen on each route, so each route's points are walked once whatever the number chosen. */
function byRoute(refs: readonly PointRef[]): ReadonlyMap<string, ReadonlySet<string>> {
  const routes = new Map<string, Set<string>>();
  for (const { routeId, pointId } of refs) {
    const ids = routes.get(routeId) ?? new Set<string>();
    ids.add(pointId);
    routes.set(routeId, ids);
  }
  return routes;
}

/** A picture's and a square's selection is a rectangle round the marker's box (:2439–2456); every other look's a ring. */
function boxed(look: MarkerLook, frame: Frame): boolean {
  return look.style === 'square' || (look.style === 'custom' && look.image !== null && frame.images.has(look.image));
}

/** A selected stop: the box and a gap of 2 each side, or a ring at the marker's half-width + 4; both 3 wide (:2442–2486). */
function selectStop(context: DrawContext, at: Place, half: number, boxedLook: boolean, unit: number): void {
  if (boxedLook) {
    const side = half + 2 * unit;
    selectionRect(context, { x: at.x - side, y: at.y - side, width: 2 * side, height: 2 * side }, 3 * unit);
  } else {
    selectionRing(context, at, half + 4 * unit, 3 * unit);
  }
}

/** v3's grey dot on a bend (constants.js:45–47): radius 4, edge 1, sized by v3's clamped scale (:105–116, :2497–2504). */
const BEND = { radius: 4, edge: 1 } as const;

const NONE: ReadonlySet<string> = new Set();

/**
 * The overlay that follows the chosen points of the routes handed in: every bend's grey dot (v3 drew them only while
 * editing, :2490–2495), each selected point's ring or rectangle in its turn (v3's order), then the hover ring on the
 * point under the pointer unless it is selected (:375). A route or a point not in the frame draws nothing.
 */
export function pointOverlay(routes: readonly Route[], choices: PointChoices, lookFor: LookFor = lookOfRoute): Overlay {
  return (context: DrawContext, frame: Frame, screen: Screen) => {
    const selected = byRoute(choices.selected);
    const { hovered } = choices;
    const unit = unitAt(screen.zoom);
    // v3's scaleSizeClamped: the reference scale and the Graphics scale (both in frame.scale), then the clamp.
    const bend = BEND.radius * frame.scale * unit;
    let hover: { readonly at: Place; readonly radius: number } | null = null;
    for (const route of routes) {
      const view = screen.routes.get(route.id);
      if (view === undefined) continue;
      const chosen = selected.get(route.id) ?? NONE;
      const look = lookFor(route);
      const half = look.size * frame.scale * screen.zoom;
      const boxedLook = boxed(look, frame);
      const pointer = hovered?.routeId === route.id ? hovered.pointId : null;
      for (const point of view.shape.points) {
        const at = screen.place(point);
        if (at === null) continue;
        const isBend = point.kind === 'bend';
        if (isBend) greyDot(context, at, bend, BEND.edge * frame.scale * unit);
        if (chosen.has(point.id)) {
          if (isBend) selectionRing(context, at, bend + 3 * unit, 2 * unit);
          else selectStop(context, at, half, boxedLook, unit);
        } else if (point.id === pointer) {
          hover = { at, radius: (isBend ? bend : half) + 6 * unit };
        }
      }
    }
    // v3's hover ring (:358–383): the point's size + 6, over everything else.
    if (hover !== null) hoverRing(context, hover.at, hover.radius, unit);
  };
}
