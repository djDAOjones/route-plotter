// CORE-04: what the markers draw (the plan's §8, P4): each stop's marker in the markers layer, under the lead's head,
// at the stop's place on the picture, its size scaled once by the frame's render scale and then by its appearance.
// Ported from v3's renderWaypoints (RenderingService.js:2385–2486): a dot, a square or a flag in the marker colour with
// a white edge two reference pixels wide, or the author's picture with neither; nothing for `none` or a transparent
// colour. v3's selection drawing between those lines is the editor's (stage 6), not drawn here.
import type { DrawContext } from '../../../adapters/render/context';
import type { Drawings, Frame } from '../../../adapters/render/layers';
import { imageToCanvas } from '../../../core/geometry/transform';
import type { MarkerLook, MarkerStyle } from '../model/look';
import type { Course, MarkersDrawing } from '../model/markers';

/** v3's edge: white, two reference pixels wide whatever the marker's size (RenderingService.js:2402–2403). */
const EDGE = { colour: '#ffffff', width: 2 };

/** v3's other way to draw nothing: a marker coloured `transparent` (RenderingService.js:2397–2400). */
const CLEAR = 'transparent';

/** A drawn marker at (x, y) on the canvas, `size` its half-width there, filled and edged. */
type Shape = (context: DrawContext, x: number, y: number, size: number) => void;

/** v3's dot (:2475–2479): `size` its radius. */
const dot: Shape = (context, x, y, size) => {
  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);
  context.fill();
  context.stroke();
};

/** v3's square (:2443–2447): twice the size each way, centred on the stop. */
const square: Shape = (context, x, y, size) => {
  context.beginPath();
  context.rect(x - size, y - size, size * 2, size * 2);
  context.fill();
  context.stroke();
};

/** v3's flag (:2453–2468): a pole with its foot at the stop and a pennant at its top, one path filled and edged. */
const flag: Shape = (context, x, y, size) => {
  const flagY = y - size;
  context.beginPath();
  context.moveTo(x, flagY - size * 2);
  context.lineTo(x, y);
  context.moveTo(x, flagY - size * 2);
  context.lineTo(x + size * 1.5, flagY - size * 1.3);
  context.lineTo(x + size * 1.2, flagY - size);
  context.lineTo(x, flagY - size * 0.7);
  context.closePath();
  context.fill();
  context.stroke();
};

/** The drawn styles. A custom marker with no picture handed in is a dot, as v3's with no image was (:2477–2482). */
const SHAPES: Record<Exclude<MarkerStyle, 'none'>, Shape> = { dot, square, flag, custom: dot };

/** A course's angle on the canvas, where v3 measured it, so a picture wider than tall turns a diagonal flatter. */
function angleOf(frame: Frame, [from, to]: Course): number {
  const [a, b] = [imageToCanvas(frame.bounds, from), imageToCanvas(frame.bounds, to)];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * A picture's turn (v3's :2414–2433): under `auto`, its course's angle (0 for a stop on no line) and then the offset;
 * under `fixed`, v3's default, none, and the offset is not read. The head adds its offset in both modes (draw/lead.ts):
 * each keeps v3's own rule.
 */
function turnOf(look: MarkerLook, course: Course | null, frame: Frame): number | null {
  if (look.rotation === 'fixed') return null;
  return (course === null ? 0 : angleOf(frame, course)) + (look.offsetDegrees * Math.PI) / 180;
}

/** A custom marker's picture (:2407–2437): twice its size, centred on the stop, with no fill or edge; turned or not. */
function picture(
  context: DrawContext,
  [x, y, size]: readonly [number, number, number],
  source: CanvasImageSource,
  turn: number | null,
) {
  context.save();
  context.translate(x, y);
  if (turn !== null) context.rotate(turn);
  context.drawImage(source, -size, -size, size * 2, size * 2);
  context.restore();
}

export const MARKER_DRAWINGS: Drawings<MarkersDrawing> = {
  markers(context, { look, markers }, frame) {
    const { style } = look;
    if (style === 'none' || look.colour === CLEAR) return;
    const source = style === 'custom' && look.image !== null ? frame.images.get(look.image) : undefined;
    context.fillStyle = look.colour;
    context.strokeStyle = EDGE.colour;
    context.lineWidth = EDGE.width * frame.scale;
    for (const marker of markers) {
      const { x, y } = imageToCanvas(frame.bounds, marker.at);
      const size = look.size * frame.scale * marker.scale;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !(size > 0)) continue;
      if (source === undefined) SHAPES[style](context, x, y, size);
      else picture(context, [x, y, size], source, turnOf(look, marker.course, frame));
    }
  },
};
