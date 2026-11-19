// CORE-04: what the lead draws (the plan's §8, P4): each head in the lead's head layer, at its place on the picture,
// turned to its heading as measured on the canvas, its size scaled once by the frame's render scale. Ported from v3's
// drawPathHead (RenderingService.js:2068–2140) and getHeadDirection's blendAngles (:752).
import type { DrawContext } from '../../../adapters/render/context';
import type { Drawings, Frame } from '../../../adapters/render/layers';
import { imageToCanvas } from '../../../core/geometry/transform';
import type { Course, Heading, LeadDrawing } from '../model/lead';
import type { HeadLook, HeadStyle } from '../model/presets';

/** An angle in (−π, π]. */
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** A course's angle on the canvas, where v3 measured it, so a picture wider than tall turns a diagonal flatter. */
function angleOf(frame: Frame, [from, to]: Course): number {
  const [a, b] = [imageToCanvas(frame.bounds, from), imageToCanvas(frame.bounds, to)];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** v3's blendAngles: from one angle toward another the short way round, by a weight from 0 to 1. */
function blend(from: number, to: number, weight: number): number {
  return wrap(wrap(from) + wrap(wrap(to) - wrap(from)) * weight);
}

/** The head's turn: its heading unless fixed upright, then the look's offset (v3's drawPathHead :2083–2092). */
function turnOf(look: HeadLook, heading: Heading, frame: Frame): number {
  const course = angleOf(frame, heading.course);
  const angle = heading.toward === null ? course : blend(course, angleOf(frame, heading.toward), heading.weight);
  return (look.rotation === 'fixed' ? 0 : angle) + (look.offsetDegrees * Math.PI) / 180;
}

function dot(context: DrawContext, size: number) {
  context.beginPath();
  context.arc(0, 0, size / 2, 0, Math.PI * 2);
  context.fill();
}

/** An image head: its picture twice the head's size, centred (v3's :2112–2120), or a dot until it is handed in. */
function picture(context: DrawContext, size: number, source: CanvasImageSource | undefined) {
  if (source === undefined) dot(context, size);
  else context.drawImage(source, -size, -size, size * 2, size * 2);
}

/** Each style, drawn about the head's place, pointing right (the turn points it). An image head with no picture is a dot. */
const SHAPES: Record<HeadStyle, (context: DrawContext, size: number, picture: CanvasImageSource | undefined) => void> = {
  dot,
  arrow(context, size) {
    context.beginPath();
    context.moveTo(size, 0);
    context.lineTo(-size / 2, size / 2);
    context.lineTo(-size / 4, 0);
    context.lineTo(-size / 2, -size / 2);
    context.closePath();
    context.fill();
  },
  drone: picture,
  custom: picture,
};

export const LEAD_DRAWINGS: Drawings<LeadDrawing> = {
  leadHead(context, { look, heads }, frame) {
    const size = look.size * frame.scale;
    const source = look.image === null ? undefined : frame.images.get(look.image);
    context.fillStyle = look.colour;
    for (const head of heads) {
      const { x, y } = imageToCanvas(frame.bounds, head.at);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      context.save();
      context.translate(x, y);
      context.rotate(turnOf(look, head.heading, frame));
      SHAPES[look.style](context, size, source);
      context.restore();
    }
  },
};
