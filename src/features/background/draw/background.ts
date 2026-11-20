// CORE-04: what the background draws (the plan's §8, P4): the picture where the frame places it, on a white margin,
// in the background layer; its tint over the picture alone, in the background effects layer. Both are drawn under the
// frame's one transform, so the tint covers the picture at any zoom and moves with any view (v3's DEF-27). Nothing
// is drawn when Show image is off or the caller gave no picture (v3's UI-08 and RenderingService.js:1191).
import type { Drawings } from '../../../adapters/render/layers';
import type { Background } from '../model/background';

/** The margin about the picture (RenderingService.js:1198). */
const MARGIN = '#ffffff';

export const BACKGROUND_DRAWINGS: Drawings<Background> = {
  background(context, value, frame) {
    if (!value.shown || frame.picture === null) return;
    context.save();
    context.resetTransform();
    context.fillStyle = MARGIN;
    context.fillRect(0, 0, frame.size.width, frame.size.height);
    context.restore();
    const { x, y, width, height } = frame.bounds;
    context.drawImage(frame.picture, x, y, width, height);
  },
  backgroundEffects(context, value, frame) {
    if (!value.shown || value.tint === null || frame.picture === null) return;
    const { x, y, width, height } = frame.bounds;
    context.globalAlpha = value.tint.alpha;
    context.fillStyle = value.tint.colour;
    context.fillRect(x, y, width, height);
  },
};
