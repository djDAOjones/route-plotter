import { CROWD_ENTRY_WEIGHT } from '../config/constants.js';

export const ENTRY_WEIGHT_HINT = 'Relative weights set each Entry’s chance of releasing a dot. '
  + 'Percentages are rounded, not fixed counts. Very small weights may never be chosen.';

/** Strict additive boundary: only absence takes the historical default. */
export function entryWeightValue(value) {
  if (value === undefined) return CROWD_ENTRY_WEIGHT.DEFAULT;
  if (typeof value !== 'number' || !Number.isFinite(value)
      || value < CROWD_ENTRY_WEIGHT.MIN || value > CROWD_ENTRY_WEIGHT.MAX) {
    throw new Error('Invalid Entry weight: enter a finite number from 0.01 to 1.7976931348623157e+308.');
  }
  return value;
}
