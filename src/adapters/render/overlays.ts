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
import type { DrawContext } from './context';
import type { Frame } from './layers';

/** A place on screen, in canvas pixels. */
export interface Place {
  readonly x: number;
  readonly y: number;
}

/** A route as every module saw it in this frame: its shape and its timeline. */
type RouteView = RouteInput<unknown>['route'];

/** What the composer hands each overlay besides the frame. */
export interface Screen {
  /** The zoom of the frame's one transform: the scene's view times the further zoom; 1 with neither. */
  readonly zoom: number;
  /** Where an image point (shares of the picture) lies on screen under that transform; null if it is not a number. */
  readonly place: (point: ImagePoint) => Place | null;
  /** Each route by its id: the very shape and timeline the modules were handed this frame. */
  readonly routes: ReadonlyMap<string, RouteView>;
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
