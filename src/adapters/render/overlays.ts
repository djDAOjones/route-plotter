// CORE-04 stage 6: the editor's overlays (the plan's §8; DEF-99.1): what an overlay is handed, and v3's four shapes.
//
// An overlay is a drawing only the editor asks for, in the request's list: the composer draws the list last, after
// every layer, in screen space (src/player/compose.ts), so a frame asked for without the list is the frame an export
// or the player draws. Nothing here names a selection, a hover or a feature: an overlay's maker is handed plain ids
// by the editor and finds their places through what the composer hands each overlay (Screen).
//
// Each shape sets every style it draws with (alpha, composite, dash, dash offset, cap, join, width, colours) and
// leaves none behind (its own save and restore, and no path left open), so it draws the same over whatever drew
// before it, with or without the composer's isolated() (INTAKE.31's second half: v3's inherited what drew before).
// A shape whose figures are not finite, or whose size is not above 0, draws nothing (a canvas throws on a negative
// radius). Figures are screen pixels, v3's at a zoom of 1 (RenderingService.js:182–264, :424–450). v3 drew them under
// its viewport's zoom times a clamp (:105–116, :1511), so on screen they grew with the zoom up to 3×, then were
// held: unitAt is that factor, for an overlay's maker to size v3's widths by.
import type { RouteInput } from '../../core/feature/contract';
import type { ImagePoint } from '../../core/geometry/units';
import type { Route } from '../../core/model/scene';
import type { DrawContext } from './context';
import type { Frame } from './layers';

/** A place on screen, in canvas pixels. */
export interface Place {
  readonly x: number;
  readonly y: number;
}

/**
 * A route in this frame: the very shape and timeline every module was handed, and the route's settings as the frame's
 * scene holds them, so an overlay's maker, handed ids alone, reads both from the frame it draws over.
 */
type ScreenRoute = RouteInput<unknown>['route'] & { readonly settings: Route['settings'] };

/** What the composer hands each overlay besides the frame. */
export interface Screen {
  /** The zoom of the frame's one transform: the scene's view times the further zoom; 1 with neither. */
  readonly zoom: number;
  /** Where an image point (shares of the picture) lies on screen under that transform; null if it is not a number. */
  readonly place: (point: ImagePoint) => Place | null;
  /** Each route by its id, as this frame holds it. */
  readonly routes: ReadonlyMap<string, ScreenRoute>;
}

/** A drawing over the finished frame, in screen space, that only the editor asks for. */
export type Overlay = (context: DrawContext, frame: Frame, screen: Screen) => void;

/** v3's hover accent (`v3/src/config/constants.js:48`, HOVER_ACCENT_COLOR). */
const ACCENT = '#0f62fe';

/** Screen pixels for one of v3's pixels at this zoom: v3's sizes grew with its zoom up to 3×, then were held. */
export const unitAt = (zoom: number): number => Math.min(zoom, 3);

const finite = (...values: readonly number[]) => values.every((value) => Number.isFinite(value));

/** Draw with every style the shape uses set from the canvas's own defaults, and put back what was there after. */
function own(context: DrawContext, draw: () => void): void {
  context.save();
  try {
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.setLineDash([]);
    context.lineDashOffset = 0;
    context.lineCap = 'butt';
    context.lineJoin = 'miter';
    context.beginPath();
    draw();
  } finally {
    context.beginPath();
    context.restore();
  }
}

/** v3's selection ring (:182–208): ten dashes round the circle, white under, black over, butt caps. */
export function selectionRing(context: DrawContext, at: Place, radius: number, width = 3): void {
  if (!finite(at.x, at.y, radius, width) || radius <= 0 || width <= 0) return;
  const segment = (2 * Math.PI * radius) / 10;
  own(context, () => {
    context.lineWidth = width;
    context.setLineDash([segment, segment]);
    context.strokeStyle = 'white';
    context.arc(at.x, at.y, radius, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = 'black';
    context.lineDashOffset = -segment;
    context.beginPath();
    context.arc(at.x, at.y, radius, 0, Math.PI * 2);
    context.stroke();
  });
}

/** v3's selection rectangle (:219–241): six dashes round the box, white under, black over, butt caps. */
export function selectionRect(context: DrawContext, box: Place & { readonly width: number; readonly height: number }, width = 3): void {
  if (!finite(box.x, box.y, box.width, box.height, width) || box.width <= 0 || box.height <= 0 || width <= 0) return;
  const segment = (2 * (box.width + box.height)) / 6;
  own(context, () => {
    context.lineWidth = width;
    context.setLineDash([segment, segment]);
    context.strokeStyle = 'white';
    context.strokeRect(box.x, box.y, box.width, box.height);
    context.strokeStyle = 'black';
    context.lineDashOffset = -segment;
    context.strokeRect(box.x, box.y, box.width, box.height);
  });
}

/** v3's hover ring (:252–264): solid, white at 0.9 and 4 wide under the accent 2 wide. */
export function hoverRing(context: DrawContext, at: Place, radius: number, unit = 1): void {
  if (!finite(at.x, at.y, radius, unit) || radius <= 0 || unit <= 0) return;
  own(context, () => {
    context.arc(at.x, at.y, radius, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    context.lineWidth = 4 * unit;
    context.stroke();
    context.strokeStyle = ACCENT;
    context.lineWidth = 2 * unit;
    context.stroke();
  });
}

/**
 * v3's grey dot for a point drawn only while editing (:2497–2509; `v3/src/config/constants.js:45–47`): black at alpha
 * 0.5, edged white at the same alpha. v3 sized both by its clamped scale (:105–116); the caller hands the figures.
 */
export function greyDot(context: DrawContext, at: Place, radius: number, edge: number): void {
  if (!finite(at.x, at.y, radius, edge) || radius <= 0 || edge <= 0) return;
  own(context, () => {
    context.globalAlpha = 0.5;
    context.fillStyle = '#000000';
    context.strokeStyle = '#ffffff';
    context.lineWidth = edge;
    context.arc(at.x, at.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  });
}

/**
 * The editor's guide dot on a point while the preview is not playing (CORE-06, D265, brief 128, BQ): a disc filled in
 * the route's colour at full alpha, no edge, so it reads as the route's own mark and never as a ring. The caller hands
 * the radius (3 × unitAt(zoom)) and the colour.
 */
export function guideDot(context: DrawContext, at: Place, radius: number, colour: string): void {
  if (!finite(at.x, at.y, radius) || radius <= 0) return;
  own(context, () => {
    context.fillStyle = colour;
    context.arc(at.x, at.y, radius, 0, Math.PI * 2);
    context.fill();
  });
}

/** Fill the path in `colour` at full alpha, then edge it white `edge` wide (v3's glyph ink and outline). */
function inkAndEdge(context: DrawContext, colour: string, edge: number): void {
  context.fillStyle = colour;
  context.fill();
  context.strokeStyle = '#ffffff';
  context.lineWidth = edge;
  context.stroke();
}

/**
 * A point the author marked as a start, drawn while paused (CORE-06, D274 part 1): v3's entry glyph
 * (`v3/src/services/NetworkEditService.js`:1236–1259), a triangle apex up of radius r, points (x, y − r),
 * (x + 0.87r, y + 0.5r), (x − 0.87r, y + 0.5r), filled in the route's colour and edged white. The caller hands the
 * radius (v3's 7, :940), the edge (v3's 1.5) and the colour.
 */
export function startMark(context: DrawContext, at: Place, radius: number, colour: string, edge: number): void {
  if (!finite(at.x, at.y, radius, edge) || radius <= 0 || edge <= 0) return;
  own(context, () => {
    context.moveTo(at.x, at.y - radius);
    context.lineTo(at.x + radius * 0.87, at.y + radius * 0.5);
    context.lineTo(at.x - radius * 0.87, at.y + radius * 0.5);
    context.closePath();
    inkAndEdge(context, colour, edge);
  });
}

/**
 * A point the author marked as an end, drawn while paused (CORE-06, D274 part 1): v3's exit glyph
 * (`v3/src/services/NetworkEditService.js`:1236–1259), a square of side 1.6r centred on the point, filled in the
 * route's colour and edged white. The caller hands the radius, the edge and the colour, as for `startMark`.
 */
export function endMark(context: DrawContext, at: Place, radius: number, colour: string, edge: number): void {
  if (!finite(at.x, at.y, radius, edge) || radius <= 0 || edge <= 0) return;
  own(context, () => {
    const half = radius * 0.8;
    context.rect(at.x - half, at.y - half, half * 2, half * 2);
    inkAndEdge(context, colour, edge);
  });
}

/** v3's "+" handle (:424–450): a disc of radius 9, or 11 when active, edged 1.5 wide, with a plus of round-capped arms. */
export function plusHandle(context: DrawContext, at: Place, active: boolean, unit = 1, radius: number = (active ? 11 : 9) * unit): void {
  if (!finite(at.x, at.y, unit, radius) || unit <= 0 || radius <= 0) return;
  const ink = active ? '#ffffff' : ACCENT;
  const arm = radius * 0.5;
  own(context, () => {
    context.arc(at.x, at.y, radius, 0, Math.PI * 2);
    context.fillStyle = active ? ACCENT : 'rgba(255, 255, 255, 0.95)';
    context.fill();
    context.strokeStyle = ink;
    context.lineWidth = 1.5 * unit;
    context.stroke();
    context.beginPath();
    context.moveTo(at.x - arm, at.y);
    context.lineTo(at.x + arm, at.y);
    context.moveTo(at.x, at.y - arm);
    context.lineTo(at.x, at.y + arm);
    context.lineWidth = 2 * unit;
    context.lineCap = 'round';
    context.stroke();
  });
}
