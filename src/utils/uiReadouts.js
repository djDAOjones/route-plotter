import { MOTION } from '../config/constants.js';

/**
 * Format the reference-pixel values consumed by RenderingService. They are
 * scaled at render time with the source image, viewport and global graphics
 * scale; SCALE-01 owns any future change to that sizing model.
 */
export function formatRendererPixels(value, fractionDigits = 0) {
  return `${Number(value).toFixed(fractionDigits)} px`;
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

/** Keep the visible readout and the range input's accessible value in sync. */
export function setRangeReadout(input, output, text) {
  if (output) output.textContent = text;
  input?.setAttribute?.('aria-valuetext', text);
}
