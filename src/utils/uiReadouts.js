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
 * A waypoint marker's Size, a nominal diameter (DEF-96; the owner's §E.3:
 * the readout is the diameter): twice `dotSize`, the size RenderingService
 * draws from, so the default 8 reads "16 reference px". That is a dot's
 * diameter (its arc's radius is `dotSize`) and the side of a square or a
 * custom image (2 × `dotSize`). A flag is the exception: 3 × `dotSize` tall
 * and 1.5 × wide, 24 × 12 at the default, before stroke and scaling, and it
 * reads 16 too. The slider and the stored value stay `dotSize`.
 * @param {number|string} dotSize - The waypoint's own value, a radius
 * @returns {string}
 */
export function formatMarkerSize(dotSize) {
  return formatRendererPixels(Number(dotSize) * 2);
}

/**
 * A crowd's dot Size as drawn (CROWD-07 F1): the diameter DotRenderer gives
 * `dotSize`, 20 reference px per 1×, so the default 0.40× reads "8 reference
 * px", half a default marker's 16 (DEF-96: both readouts are diameters). Whole
 * at the slider's 0.05× steps; to a tenth for a value set between them in the
 * outline.
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

/**
 * Why a crowd slider, or the Path card's Share, is off: its stored value lies
 * past the slider's ends, and the number field beside it holds it (DEF-86)
 * [Q5]. On, the slider would sit at its end and write that end on the first
 * nudge.
 */
export const SLIDER_REACH_REASON = "Beyond the slider's reach — use the number field";

/**
 * A number as a field shows it (DEF-86): the stored value itself, to fifteen
 * significant figures, so a value round-trips and no binary tail shows (0.07
 * × 100 reads 7, not 7.000000000000001), with no fixed decimals that would
 * round it (0.001 reads 0.001, never 0.00). −0 reads 0.
 * @param {number} value
 * @returns {string}
 */
export function formatFieldNumber(value) {
  const number = Number(Number(value).toPrecision(15));
  return Object.is(number, -0) ? '0' : String(number);
}

/**
 * A value converted between a field's unit and the model's, to the fifteen
 * significant figures a field shows, so the conversion adds no binary tail of
 * its own (8.6 reference px is 0.43×, not 0.42999999999999994).
 * @param {number} value
 * @returns {number}
 */
export function cleanNumber(value) {
  const number = Number(Number(value).toPrecision(15));
  return Object.is(number, -0) ? 0 : number;
}

/**
 * Add `id` to what describes `element`, once: at the end, or first. The
 * tokens already there (a readout, a hint) keep their places.
 * @param {Element} element
 * @param {string} id
 * @param {{first?: boolean}} [options]
 */
export function addDescription(element, id, { first = false } = {}) {
  if (!element || !id) return;
  const tokens = (element.getAttribute('aria-describedby') || '').split(/\s+/).filter(token => token && token !== id);
  if (first) tokens.unshift(id);
  else tokens.push(id);
  element.setAttribute('aria-describedby', tokens.join(' '));
}

/**
 * Take `id` out of what describes `element`, leaving every other token.
 * @param {Element} element
 * @param {string} id
 */
export function removeDescription(element, id) {
  if (!element || !id) return;
  const tokens = (element.getAttribute('aria-describedby') || '').split(/\s+/).filter(token => token && token !== id);
  if (tokens.length) element.setAttribute('aria-describedby', tokens.join(' '));
  else element.removeAttribute('aria-describedby');
}

/**
 * Say why a control is off in its reason line, which it is then described
 * by, or, with no text, empty and hide the line and drop it from the
 * description (a description is read even from a hidden element).
 * @param {Element} control
 * @param {HTMLElement|null} line
 * @param {string} text
 */
export function setControlReason(control, line, text) {
  if (!line) return;
  line.textContent = text;
  line.hidden = !text;
  if (text) addDescription(control, line.id);
  else removeDescription(control, line.id);
}

/**
 * A field whose value cannot be used says so (UI-06 B-30's path-weight
 * pattern): in a line under it, named first among what describes it, and
 * aloud when the line first shows; the typed value stays for the author to
 * fix and the model keeps its own.
 * @param {HTMLInputElement} field
 * @param {HTMLElement|null} line
 * @param {string} message
 * @param {(message: string) => void} [announce]
 */
export function showFieldError(field, line, message, announce) {
  const showing = field.getAttribute('aria-invalid') === 'true' && line?.textContent === message;
  field.setAttribute('aria-invalid', 'true');
  if (line) {
    line.textContent = message;
    line.hidden = false;
    addDescription(field, line.id, { first: true });
  }
  if (!showing) announce?.(message);
}

/**
 * The field's value is good again, or the field is drawn afresh: its error
 * line empties and hides, and no longer describes it.
 * @param {HTMLInputElement|null} field
 * @param {HTMLElement|null} line
 */
export function clearFieldError(field, line) {
  field?.removeAttribute('aria-invalid');
  if (!line) return;
  line.textContent = '';
  line.hidden = true;
  removeDescription(field, line.id);
}
