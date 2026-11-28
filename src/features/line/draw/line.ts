// CORE-04: what the line draws (the plan's §8, P4): each stroke in the lines layer, where the frame places the
// picture, its width and dash scaled once by the frame's render scale, with round caps and joins as v3's
// (RenderingService.js:1756–1758). Casing and glow are the Line glow feature's (§7), not the core's.
import type { Drawings } from '../../../adapters/render/layers';
import { imageToCanvas } from '../../../core/geometry/transform';
import type { Dash, LineDrawing } from '../model/line';

/** Each dash's pattern in reference pixels, as v3's applyLineStyle (RenderingService.js:2657–2671). */
export const DASHES: Record<Dash, readonly number[]> = {
  solid: [],
  dashed: [10, 5],
  dotted: [2, 6],
};

export const LINE_DRAWINGS: Drawings<LineDrawing> = {
  lines(context, value, frame) {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const { points, style } of value.strokes) {
      context.strokeStyle = style.colour;
      context.lineWidth = style.width * frame.scale;
      context.setLineDash(DASHES[style.dash].map((length) => length * frame.scale));
      context.beginPath();
      points.forEach((point, i) => {
        const { x, y } = imageToCanvas(frame.bounds, point);
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    }
  },
};
