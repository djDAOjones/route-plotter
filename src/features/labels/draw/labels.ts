// CORE-04: what the labels draw (the plan's §8, P4): each stop's label in the labels layer, the top one, over the
// markers and the lead's head. Ported from v3's renderLabel (v3/src/services/RenderingService.js:2534–2651): the
// words wrapped at spaces to the label's width, centred about a point offset from the stop, on a box with rounded
// corners, the whole label at its opacity. Every size is in reference pixels times the frame's render scale; the width
// and the offsets are shares of the frame, as v3's displayWidth and displayHeight are of the frame it exports
// (v3/src/app/exporting.js:150–151). v3's editor-only legibility clamp (scaleLabelSize with _interactiveLabels) and
// its zoom factor (_zoomClampFactor, :2567) are left out: one composer draws every frame and may not know who asks,
// so a label is drawn at its size times the frame's scale, no more.
import type { DrawContext } from '../../../adapters/render/context';
import type { Drawings } from '../../../adapters/render/layers';
import { imageToCanvas } from '../../../core/geometry/transform';
import type { LabelLook, LabelsDrawing } from '../model/labels';

/** v3's type face (:2580). */
const FACE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** v3's lines, 1.3 times the type size apart (:2603). */
const LINE_SPACING = 1.3;

/** v3's box about the text, in reference pixels: padding and corner radius (TEXT_LABEL, constants.js:404–405). */
const BOX = { padding: 6, radius: 4 };

/**
 * v3's word wrap (:2585–2600): words split at each space, each added to the line while the line still fits the width,
 * a word that does not fit starting a new line; a single word wider than the width stays whole on its own line.
 */
function wrap(text: string, width: number, measure: (line: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const tried = line === '' ? word : `${line} ${word}`;
    if (measure(tried) > width && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = tried;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** v3's box (:2618–2636): from (x, y), `w` by `h`, its corners rounded by `r` with quadratic curves. */
function box(context: DrawContext, [x, y, w, h]: readonly [number, number, number, number], r: number) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.quadraticCurveTo(x + w, y, x + w, y + r);
  context.lineTo(x + w, y + h - r);
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  context.lineTo(x + r, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

/** The label's measures on this frame, worked out once for every label. */
interface Measures {
  readonly size: number;
  readonly width: number;
  readonly offset: { readonly x: number; readonly y: number };
  readonly padding: number;
  readonly radius: number;
}

/** Where a label's centre falls on the canvas, and how solid it is. */
interface Placed {
  readonly x: number;
  readonly y: number;
  readonly opacity: number;
}

/** One label centred at (x, y) on the canvas (:2576–2650), at its opacity. */
function label(context: DrawContext, look: LabelLook, [at, text]: readonly [Placed, string], measures: Measures) {
  const { size, width, padding, radius } = measures;
  context.save();
  context.globalAlpha = at.opacity;
  context.font = `${size}px ${FACE}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const lines = wrap(text, width, (line) => context.measureText(line).width);
  const lineHeight = size * LINE_SPACING;
  const textHeight = lines.length * lineHeight;
  const widest = Math.max(0, ...lines.map((line) => context.measureText(line).width));
  const [boxWidth, boxHeight] = [widest + padding * 2, textHeight + padding * 2];
  if (look.backgroundOpacity > 0) {
    context.save();
    context.globalAlpha = at.opacity * look.backgroundOpacity;
    context.fillStyle = look.backgroundColour;
    box(context, [at.x - boxWidth / 2, at.y - boxHeight / 2, boxWidth, boxHeight], radius);
    context.fill();
    context.restore();
  }
  context.fillStyle = look.textColour;
  const top = at.y - textHeight / 2 + lineHeight / 2;
  lines.forEach((line, i) => context.fillText(line, at.x, top + i * lineHeight));
  context.restore();
}

export const LABEL_DRAWINGS: Drawings<LabelsDrawing> = {
  labels(context, { look, labels }, frame) {
    // v3's label chrome scales with the type (labelChromeScale, :2605), which here is the frame's render scale.
    const size = look.size * frame.scale;
    if (!(size > 0)) return;
    const measures: Measures = {
      size,
      width: (look.width / 100) * frame.size.width,
      offset: { x: (look.offsetX / 100) * frame.size.width, y: (look.offsetY / 100) * frame.size.height },
      padding: BOX.padding * frame.scale,
      radius: BOX.radius * frame.scale,
    };
    for (const shown of labels) {
      const { x, y } = imageToCanvas(frame.bounds, shown.at);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !(shown.opacity > 0)) continue;
      const at = { x: x + measures.offset.x, y: y + measures.offset.y, opacity: shown.opacity };
      label(context, look, [at, shown.text], measures);
    }
  },
};
