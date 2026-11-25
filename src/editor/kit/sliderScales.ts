// CORE-05, stage 4: the slider scales, v3's `src/utils/sliderScales.js` (the plan's line 1005). The six mappings between
// a slider's position (0 to 1000, or -1000 to 1000 for a bipolar one) and the value it means are ported as they are,
// and pinned by v3's own tables value for value. The readout, `formatUIValue`, is rewritten (D180): v3 rounded a value
// of 10 or more up (10.2 read "11"), a negative one away from zero, and chose the format on the unrounded value, so
// -9.99 read "-10.0". Which of the scales v4's sliders keep is each feature's to say. This module imports nothing.

/** A slider's whole travel: positions run 0 to `TRAVEL`, or -`TRAVEL` to `TRAVEL` for a bipolar slider. */
const TRAVEL = 1000;

/** A bipolar slider's centre: positions within this of 0 mean exactly 0. */
const DEAD_ZONE = 50;

/**
 * A slider position (0 to 1000) as a value on a log2 scale from `min` (above 0) to `max`: fine control at low values,
 * coarser at high ones. `value = min * 2^(position / 1000 * log2(max / min))`; a position outside the travel clamps.
 */
export function sliderToLog2Value(sliderValue: number, min: number, max: number): number {
  if (sliderValue <= 0) return min;
  if (sliderValue >= TRAVEL) return max;
  const normalized = sliderValue / TRAVEL;
  const log2Range = Math.log2(max / min);
  return min * Math.pow(2, normalized * log2Range);
}

/** A value on that log2 scale as the whole slider position nearest it (0 to 1000); a value outside the range clamps. */
export function log2ValueToSlider(value: number, min: number, max: number): number {
  if (value <= min) return 0;
  if (value >= max) return TRAVEL;
  const log2Range = Math.log2(max / min);
  const normalized = Math.log2(value / min) / log2Range;
  return Math.round(normalized * TRAVEL);
}

/**
 * A bipolar slider position (-1000 to 1000) as a value from -`max` to `max` on the log2 scale, each side from `min` in
 * size. Positions within the dead zone (±50) mean exactly 0; past it, the rest of each side is the whole log2 scale.
 */
export function bipolarSliderToLog2Value(sliderValue: number, min: number, max: number): number {
  if (Math.abs(sliderValue) <= DEAD_ZONE) return 0;
  const sign = sliderValue > 0 ? 1 : -1;
  const absSlider = Math.abs(sliderValue) - DEAD_ZONE;
  const remapped = (absSlider / (TRAVEL - DEAD_ZONE)) * TRAVEL;
  return sign * sliderToLog2Value(remapped, min, max);
}

/** A value on the bipolar log2 scale as its slider position, past the dead zone; 0 is the centre. Not rounded. */
export function bipolarLog2ValueToSlider(value: number, min: number, max: number): number {
  if (value === 0) return 0;
  const sign = value > 0 ? 1 : -1;
  const sliderPos = log2ValueToSlider(Math.abs(value), min, max);
  const remapped = (sliderPos / TRAVEL) * (TRAVEL - DEAD_ZONE) + DEAD_ZONE;
  return sign * remapped;
}

/** The angle scale's curve at the end of the travel: `t + t³/3` at t = 1. */
const MAX_CURVED = 1 + 1 / 3;

/**
 * A slider position (0 to 1000) as an angle in degrees from `min` to `max`, on the curve `t + t³/3` (close to tan at
 * small angles): fine control at narrow angles, coarser at wide ones. A position outside the travel clamps.
 */
export function sliderToAngle(sliderValue: number, min: number, max: number): number {
  if (sliderValue <= 0) return min;
  if (sliderValue >= TRAVEL) return max;
  const t = sliderValue / TRAVEL;
  const curved = t + (t * t * t) / 3;
  return min + (curved / MAX_CURVED) * (max - min);
}

/**
 * An angle as the whole slider position nearest it (0 to 1000), the inverse of `sliderToAngle` by five Newton steps;
 * an angle outside the range clamps. Loading a project needs it to put a thumb where the project's angle is (DEF-20).
 */
export function angleToSlider(angle: number, min: number, max: number): number {
  if (angle <= min) return 0;
  if (angle >= max) return TRAVEL;
  const normalized = (angle - min) / (max - min);
  const curved = normalized * MAX_CURVED;
  let t = normalized;
  for (let i = 0; i < 5; i++) {
    const f = t + (t * t * t) / 3 - curved;
    const fPrime = 1 + t * t;
    t = t - f / fPrime;
  }
  t = Math.max(0, Math.min(1, t));
  return Math.round(t * TRAVEL);
}

/**
 * A slider's readout (D180): one decimal place below 10 in size, whole numbers from 10, each rounded to the nearest with
 * a half rounded away from zero. The format is chosen on the value rounded to one place, so a value that rounds to 10
 * reads "10" and "10.0" is never shown. Zero reads "0.0", never "-0.0", however small the negative it was rounded from.
 * `suffix` follows the number, as in "50%". Rounding works on the value as stored: 1.25 is a true half and reads "1.3",
 * while 9.95 is stored just below 9.95 and reads "9.9" (`toFixed` rounds the stored value exactly).
 */
export function formatUIValue(value: number, suffix = ''): string {
  const size = Math.abs(value);
  const tenths = size.toFixed(1);
  const digits = Number(tenths) >= 10 ? size.toFixed(0) : tenths;
  const sign = value < 0 && Number(digits) !== 0 ? '-' : '';
  return `${sign}${digits}${suffix}`;
}
