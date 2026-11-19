// CORE-04: reference scaling. Every size the core draws (a line's thickness, a marker, a label's text) is saved in
// reference pixels: pixels in a frame whose short edge is REFERENCE_SHORT_EDGE, the short edge of the default video
// (src/core/config/settings.ts, EXPORT_SETTINGS). A frame of any other size draws them scaled by its short edge, so
// the editor's preview, a video of any size and the exported player draw the same picture in proportion, whichever is
// asking. The scale is worked out once a frame, here, and handed to every module (the plan's §8); no module measures
// a size in canvas pixels of its own. v3 took its reference from the editor's canvas when a project was made
// (v3/src/utils/renderReference.js), so a project's look depended on the screen it was begun on; v4 fixes it (D126).
import type { Size } from '../../core/geometry/transform';

export const REFERENCE_SHORT_EDGE = 1080;

/**
 * How many canvas pixels one reference pixel is in a frame of this size, at the scene's Graphics scale. A frame with
 * no area, or a size that is not a finite number, draws at the Graphics scale alone, as v3 fell back to 1: a width of
 * 0 would be ignored by a canvas and leave the last width in force.
 */
export function renderScale(frame: Size, graphicsScale: number): number {
  const graphics = Number.isFinite(graphicsScale) && graphicsScale > 0 ? graphicsScale : 1;
  const shortEdge = Math.min(frame.width, frame.height);
  if (!Number.isFinite(shortEdge) || shortEdge <= 0) return graphics;
  return (shortEdge / REFERENCE_SHORT_EDGE) * graphics;
}
