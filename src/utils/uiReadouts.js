import { MOTION } from '../config/constants.js';
import { DOT_BASE_RADIUS_PX } from '../services/DotRenderer.js';

/**
 * Format the project reference-pixel values consumed by RenderingService.
 * They scale at render time from the project's stable reference short edge.
 */
export function formatRendererPixels(value, fractionDigits = 0) {
  return `${Number(value).toFixed(fractionDigits)} reference px`;
}

/**
 * A crowd's dot Size as drawn (CROWD-07 F1): the diameter DotRenderer gives
 * `dotSize`, 20 reference px per 1×, so the default 0.40× reads "8 reference
 * px" as the marker's default does. Whole at the slider's 0.05× steps; to a
 * tenth for a value set between them in the outline.
 * @param {number} dotSize - The emitter's own unit (×)
 * @returns {string}
 */
export function formatCrowdDotSize(dotSize) {
  const diameter = Math.round(Number(dotSize) * DOT_BASE_RADIUS_PX * 2 * 10) / 10;
  return formatRendererPixels(diameter, Number.isInteger(diameter) ? 0 : 1);
}

/** Legacy shapeAmplitude stores five units for each effective image percent. */
export function formatShapeAmplitude(value) {
  const percent = Number(value) / 5;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

/** Describe the opacity and direction the renderer actually draws. */
export function formatBackgroundOverlay(value) {
  const numericValue = Number(value);
  if (numericValue === 0) return 'None';
  const effectivePercent = Math.min(
    Math.abs(numericValue),
    MOTION.TINT_OPACITY_MAX
  );
  const formatted = Number.isInteger(effectivePercent)
    ? effectivePercent.toFixed(0)
    : effectivePercent.toFixed(1);
  return `${formatted}% ${numericValue < 0 ? 'darker' : 'lighter'}`;
}

/**
 * The Hold at end readout (CROWD-06), written as the Duration readout above
 * it writes seconds: to a tenth, e.g. "2s" or "3.5s".
 * @param {number} ms
 * @returns {string}
 */
export function formatHoldAtEnd(ms) {
  return `${Math.round(Number(ms) / 100) / 10}s`;
}

/** Keep the visible readout and the range input's accessible value in sync. */
export function setRangeReadout(input, output, text) {
  if (output) output.textContent = text;
  input?.setAttribute?.('aria-valuetext', text);
}

/**
 * The transport's readout is two times, the playhead's and the whole length;
 * its slider says both, "0:05 of 0:30", as the exported player's does
 * (playerEntry.js), not the slider's per-mille position. Playback writes this
 * every frame, so the attribute is set only when it changes.
 */
export function setTimelineReadout(input, currentOutput, totalOutput, current, total) {
  if (currentOutput) currentOutput.textContent = current;
  if (totalOutput) totalOutput.textContent = total;
  const text = `${current} of ${total}`;
  if (input && input.getAttribute('aria-valuetext') !== text) input.setAttribute('aria-valuetext', text);
}
