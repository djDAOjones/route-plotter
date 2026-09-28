/**
 * Slider scales — the pure mappings between a slider's position (0–1000, or
 * ±1000 for a bipolar one) and the value it means, and the readout format
 * shared by those sliders.
 *
 * They lived in MotionVisibilityService, although only the sidebar and project
 * load use them (SPL-01, plan §14). `tests/sliderScales.test.js` pins them
 * value for value, including two quirks of `formatUIValue` that are recorded,
 * not fixed.
 */

/**
 * Convert linear slider value (0-1000) to log2 scaled value
 * Provides fine control at lower values, coarser at higher values
 * 
 * Formula: value = min * 2^(slider/1000 * log2(max/min))
 * 
 * @param {number} sliderValue - Linear slider position (0-1000)
 * @param {number} min - Minimum output value (must be > 0)
 * @param {number} max - Maximum output value
 * @returns {number} Log2 scaled value between min and max
 */
export function sliderToLog2Value(sliderValue, min, max) {
  if (sliderValue <= 0) return min;
  if (sliderValue >= 1000) return max;
  const normalized = sliderValue / 1000;
  const log2Range = Math.log2(max / min);
  return min * Math.pow(2, normalized * log2Range);
}

/**
 * Convert log2 scaled value back to linear slider position (0-1000)
 * 
 * @param {number} value - Log2 scaled value
 * @param {number} min - Minimum value (must be > 0)
 * @param {number} max - Maximum value
 * @returns {number} Linear slider position (0-1000)
 */
export function log2ValueToSlider(value, min, max) {
  if (value <= min) return 0;
  if (value >= max) return 1000;
  const log2Range = Math.log2(max / min);
  const normalized = Math.log2(value / min) / log2Range;
  return Math.round(normalized * 1000);
}

/**
 * Format a value for UI display
 * Values >= 10 are rounded UP to integers, values < 10 show 1 decimal place
 * 
 * @param {number} value - Value to format
 * @param {string} [suffix=''] - Optional suffix (e.g., '%', 's')
 * @returns {string} Formatted string
 */
export function formatUIValue(value, suffix = '') {
  const absValue = Math.abs(value);
  if (absValue >= 10) {
    // Round up for positive, round down (toward zero) for negative
    const rounded = value >= 0 ? Math.ceil(value) : Math.floor(value);
    return `${rounded}${suffix}`;
  }
  return `${value.toFixed(1)}${suffix}`;
}

/**
 * Convert bipolar slider (-1000 to 1000) to log2 scaled value (-max to max)
 * Has a dead zone at center (±50) that maps to exactly 0
 * Provides fine control near 0, coarser at extremes
 * 
 * @param {number} sliderValue - Slider position (-1000 to 1000)
 * @param {number} min - Minimum magnitude (must be > 0)
 * @param {number} max - Maximum magnitude
 * @returns {number} Log2 scaled value between -max and max, or 0
 */
export function bipolarSliderToLog2Value(sliderValue, min, max) {
  const DEAD_ZONE = 50; // ±50 slider units = 0 value
  if (Math.abs(sliderValue) <= DEAD_ZONE) return 0;
  
  const sign = sliderValue > 0 ? 1 : -1;
  // Remap slider from (DEAD_ZONE to 1000) to (0 to 1000)
  const absSlider = Math.abs(sliderValue) - DEAD_ZONE;
  const remapped = (absSlider / (1000 - DEAD_ZONE)) * 1000;
  const value = sliderToLog2Value(remapped, min, max);
  return sign * value;
}

/**
 * Convert log2 scaled bipolar value back to slider position (-1000 to 1000)
 * Accounts for dead zone at center
 * 
 * @param {number} value - Log2 scaled value (-max to max)
 * @param {number} min - Minimum magnitude (must be > 0)
 * @param {number} max - Maximum magnitude
 * @returns {number} Slider position (-1000 to 1000)
 */
export function bipolarLog2ValueToSlider(value, min, max) {
  const DEAD_ZONE = 50;
  if (value === 0) return 0;
  
  const sign = value > 0 ? 1 : -1;
  const absValue = Math.abs(value);
  const sliderPos = log2ValueToSlider(absValue, min, max);
  // Remap from (0 to 1000) back to (DEAD_ZONE to 1000)
  const remapped = (sliderPos / 1000) * (1000 - DEAD_ZONE) + DEAD_ZONE;
  return sign * remapped;
}

/**
 * Convert slider (0-1000) to angle using tan-based curve for perceptual smoothness
 * Uses approximation tan(x) ≈ x + x³/3 for smooth feel at small angles
 * 
 * The curve provides fine control at narrow angles (1-30°) where small changes
 * are perceptually significant, and coarser control at wide angles (90-180°)
 * 
 * @param {number} sliderValue - Slider position (0-1000)
 * @param {number} min - Minimum angle in degrees (e.g., 1)
 * @param {number} max - Maximum angle in degrees (e.g., 180)
 * @returns {number} Angle in degrees
 */
export function sliderToAngle(sliderValue, min, max) {
  if (sliderValue <= 0) return min;
  if (sliderValue >= 1000) return max;
  
  // Normalize slider to 0-1
  const t = sliderValue / 1000;
  
  // Apply tan-based curve: f(t) = t + t³/3
  // This gives more resolution at lower values (narrow angles)
  const curved = t + (t * t * t) / 3;
  
  // Normalize the curve output (at t=1, curved = 1 + 1/3 = 4/3)
  const maxCurved = 1 + 1/3;
  const normalized = curved / maxCurved;
  
  // Map to angle range
  return min + normalized * (max - min);
}
