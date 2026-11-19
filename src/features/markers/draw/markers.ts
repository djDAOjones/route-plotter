// CORE-04: what the markers draw (the plan's §8, P4): each stop's marker in the markers layer, under the lead's head,
// at the stop's place on the picture, its size scaled once by the frame's render scale and then by its appearance.
// Ported from v3's renderWaypoints (RenderingService.js:2385–2486): a dot of the look's size as its radius, in the
// marker colour, with a white edge two reference pixels wide.
import type { DrawContext } from '../../../adapters/render/context';
import type { Drawings } from '../../../adapters/render/layers';
import { imageToCanvas } from '../../../core/geometry/transform';
import type { MarkersDrawing } from '../model/markers';

/** v3's edge: white, two reference pixels wide whatever the marker's size (RenderingService.js:2402–2403). */
const EDGE = { colour: '#ffffff', width: 2 };

function dot(context: DrawContext, x: number, y: number, radius: number) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
}

export const MARKER_DRAWINGS: Drawings<MarkersDrawing> = {
  markers(context, { look, markers }, frame) {
    context.fillStyle = look.colour;
    context.strokeStyle = EDGE.colour;
    context.lineWidth = EDGE.width * frame.scale;
    for (const marker of markers) {
      const { x, y } = imageToCanvas(frame.bounds, marker.at);
      const radius = look.size * frame.scale * marker.scale;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !(radius > 0)) continue;
      dot(context, x, y, radius);
    }
  },
};
