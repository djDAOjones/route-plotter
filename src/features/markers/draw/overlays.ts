// CORE-04 stage 6: the editor's overlays that follow a point (the plan's §8; DEF-99.1), ported from v3's
// renderWaypoints (v3/src/services/RenderingService.js:2439–2516) and hover (:358–383). The editor hands the maker
// plain ids (the routes it is editing, which points are selected, which one is under the pointer) and puts the overlay
// it gets back in the request's list; no module ever sees them. The overlay reads each route from the frame it draws
// over (screen.routes: the shape every module was handed, and the settings the frame's scene holds, so a stop's look is
// this frame's) and draws with the kit's shapes, in screen pixels, after every layer.
//
// Sizes, as v3's on screen (D153): a ring or a rectangle goes round its stop's marker as the markers' layer draws it,
// look.size × frame.scale × screen.zoom (src/features/markers/draw/markers.ts; v4's markers have no zoom clamp), and
// at the marker's whole size whatever its timing, as v3's editor showed every marker whole: a selection is never
// invisible, even for a stop whose marker is not shown at that moment. v3's gaps and widths go by unitAt(screen.zoom).
// Each route's points are walked once, whatever the number selected, and a route named twice is drawn once; an id the
// frame does not hold draws nothing; nothing is kept between frames (D147).
//
// The guide's dots while paused (CORE-06, D265; brief 128, BQ): `dotOverlay` marks every point of each route named,
// joined to a line or not (Duplicate's copies, which the lead never reaches, included), with the kit's guide dot: a
// disc in the route's colour (its line's), radius 3 × unitAt(screen.zoom), no white or black edge, so it stays inside
// the 5 units a selection's ring starts at. The editor asks for it, for every route, only while the preview is not
// playing (../../../editor/shell/previewLogic.ts, point 4d), drawn before the selection's rings and the hover.
//
// The marks while paused (CORE-06, D274 part 1; brief 142, GC): after a route's dots, each point the author marked as
// a start or an end (`route.shape.marks`; only the marks the author set, never a worked-out first point) gets v3's
// glyph (v3/src/services/NetworkEditService.js:1236–1259): a start the kit's `startMark` triangle, an end its `endMark`
// square, in the route's colour edged white, v3's radius 7 and edge 1.5 (:940, :1258), sized as the guide dot is, by
// unitAt(screen.zoom) alone (brief 142 asked for frame.scale too, as v3's scaleSizeClamped; on the editor's canvas,
// about 400 pixels on its short side in the journeys, that made the mark 2.6 pixels, inside the guide dot's 3, so it
// could not be seen). Drawn after all the route's dots, a mark is never covered by a later point's dot. A route's end marks are drawn before its
// start marks, so a point that holds both shows the square with the triangle over it. A mark whose point the frame does
// not place draws nothing. Being part of the guide's dots, the marks are drawn only while paused, never in an export.
import { endMark, greyDot, guideDot, hoverRing, selectionRect, selectionRing, startMark, unitAt, type Overlay, type Place, type Screen } from '../../../adapters/render/overlays';
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

/** The look a route's stops are drawn with, from its settings in the frame: the markers' one place (D144); a test may hand another. */
type LookFor = (settings: Route['settings']) => MarkerLook;

const lookOfSettings: LookFor = (settings) => lookOf(settings.markers);

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

/** The guide dot's radius in screen pixels at a zoom of 1 (D265). */
const GUIDE_DOT = 3;

/** v3's glyph for a marked point (NetworkEditService.js:940, :1236–1259): radius 7, white edge 1.5, screen pixels at a zoom of 1 (D274). */
const MARK = { radius: 7, edge: 1.5 } as const;

/** The guide's dots while paused (D265): every point of each route named, in the route's colour, in the points' order; then its marks (D274). */
export function dotOverlay(routeIds: readonly string[]): Overlay {
  return (context: DrawContext, _frame: Frame, screen: Screen) => {
    const unit = unitAt(screen.zoom);
    const radius = GUIDE_DOT * unit;
    const mark = MARK.radius * unit;
    const edge = MARK.edge * unit;
    for (const id of new Set(routeIds)) {
      const route = screen.routes.get(id);
      if (route === undefined) continue;
      const colour = route.settings.line.colour;
      const places = new Map<string, Place>();
      for (const point of route.shape.points) {
        const at = screen.place(point);
        if (at === null) continue;
        guideDot(context, at, radius, colour);
        places.set(point.id, at);
      }
      for (const end of ['end', 'start'] as const) {
        for (const each of route.shape.marks) {
          const at = each.end === end ? places.get(each.point) : undefined;
          if (at === undefined) continue;
          if (end === 'start') startMark(context, at, mark, colour, edge);
          else endMark(context, at, mark, colour, edge);
        }
      }
    }
  };
}

/**
 * The overlay that follows the chosen points of the routes handed in: every bend's grey dot (v3 drew them only while
 * editing, :2490–2495), each selected point's ring or rectangle in its turn (v3's order), then the hover ring on the
 * point under the pointer unless it is selected (:375). A route or a point not in the frame draws nothing.
 */
export function pointOverlay(routeIds: readonly string[], choices: PointChoices, lookFor: LookFor = lookOfSettings): Overlay {
  return (context: DrawContext, frame: Frame, screen: Screen) => {
    const selected = byRoute(choices.selected);
    const { hovered } = choices;
    const unit = unitAt(screen.zoom);
    // v3's scaleSizeClamped: the reference scale and the Graphics scale (both in frame.scale), then the clamp.
    const bend = BEND.radius * frame.scale * unit;
    let hover: { readonly at: Place; readonly radius: number } | null = null;
    for (const id of new Set(routeIds)) {
      const route = screen.routes.get(id);
      if (route === undefined) continue;
      const chosen = selected.get(id) ?? NONE;
      const look = lookFor(route.settings);
      const half = look.size * frame.scale * screen.zoom;
      const boxedLook = boxed(look, frame);
      const pointer = hovered?.routeId === id ? hovered.pointId : null;
      for (const point of route.shape.points) {
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
