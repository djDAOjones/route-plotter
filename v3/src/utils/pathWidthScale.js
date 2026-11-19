/**
 * Path-width slider scale — the one source of truth for the log-scale
 * mapping between the 0–1000 thickness slider and the 1–40px width.
 *
 * Shared by the app's DOM wiring (single-selection edits, editor sync)
 * and UIController (bulk "all waypoints" edits): the two layers may not
 * call each other (EventBus-only rule), and duplicated copies of this
 * maths drifted once already — the review 2026-08-18 found bulk edits
 * writing raw slider integers (e.g. 333) into segmentWidth.
 */

const MIN_WIDTH = 1;
const MAX_WIDTH = 40;

/**
 * Convert slider value (0–1000) to path width (1–40).
 * Log scale for finer control at lower values: 0 → 1, 1000 → 40.
 */
export function sliderToPathWidth(sliderValue) {
  const ratio = sliderValue / 1000;
  const width = MIN_WIDTH * Math.pow(MAX_WIDTH / MIN_WIDTH, ratio);
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
}

/**
 * Convert path width (1–40) to slider value (0–1000). Inverse of
 * sliderToPathWidth.
 */
export function pathWidthToSlider(width) {
  const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
  const ratio = Math.log(clampedWidth / MIN_WIDTH) / Math.log(MAX_WIDTH / MIN_WIDTH);
  return Math.round(ratio * 1000);
}
