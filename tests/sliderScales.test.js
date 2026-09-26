/**
 * SPL-01 — the slider scales, pinned value for value (plan §14.4).
 *
 * These pure functions turn a slider position (0 to 1000, or ±1000) into the
 * value a control means, a value back into a position, and a value into its
 * readout. They lived in MotionVisibilityService although only the sidebar
 * and project load use them. The tables were taken from that code before the
 * move, so the move is proved bit for bit.
 *
 * Two quirks of `formatUIValue` are pinned as they behave, not fixed: from
 * ±10 outwards a negative rounds away from zero (the old comment said "toward
 * zero"), and the format changes abruptly at ±10 ("-10.0", then "-11").
 */

import { describe, expect, test } from 'vitest';
import * as scales from '../src/utils/sliderScales.js';

describe('the slider scales (SPL-01)', () => {
  test('the bipolar scale maps a ±50 dead zone to exactly 0', () => {
    // The plan's own measurement, at 0.25 to 4
    expect([-1000, -51, -50, 0, 50, 51, 1000].map(slider => scales.bipolarSliderToLog2Value(slider, 0.25, 4)))
      .toEqual([-4, -0.2507306943634884, 0, 0, 0, 0.2507306943634884, 4]);
    // The background tint's range, 1 to 100
    const table = [
      [-1000, -100], [-951, -78.85733669774899], [-500, -8.858667904100825],
      [-51, -1.0048593159311134], [-50, 0], [-1, 0],
      [0, 0], [1, 0], [50, 0],
      [51, 1.0048593159311134], [500, 8.858667904100825], [951, 78.85733669774899],
      [1000, 100],
    ];
    for (const [slider, value] of table) {
      expect(scales.bipolarSliderToLog2Value(slider, 1, 100), `slider ${slider}`).toBe(value);
    }
  });

  test('the bipolar inverse places a value past the dead zone, and round-trips within a slider unit', () => {
    const table = [
      [-100, -1000], [-37.5, -797.65], [-10, -525],
      [-2.5, -239.05], [-1, -50], [0, 0],
      [1, 50], [2.5, 239.05], [10, 525],
      [37.5, 797.65], [100, 1000],
    ];
    for (const [value, slider] of table) {
      expect(scales.bipolarLog2ValueToSlider(value, 1, 100), `value ${value}`).toBe(slider);
    }
    for (const slider of [-1000, -951, -500, -200, -51, 51, 200, 500, 951, 1000]) {
      const back = scales.bipolarLog2ValueToSlider(scales.bipolarSliderToLog2Value(slider, 1, 100), 1, 100);
      expect(Math.abs(back - slider), `slider ${slider}`).toBeLessThan(1);
    }
  });

  test('the log2 scale clamps outside 0 to 1000 and is exact between', () => {
    const tables = [
      [1, 25, [
        [-5, 1], [0, 1], [1, 1.003224061968681],
        [50, 1.174618943088019], [100, 1.379729661461215], [250, 2.2360679774997894],
        [333, 2.920882070731394], [500, 4.999999999999999], [667, 8.559058323686434],
        [750, 11.180339887498949], [900, 18.11949159194239], [999, 24.919657480046023],
        [1000, 25], [1005, 25],
      ]],
      [1, 100, [
        [-5, 1], [0, 1], [1, 1.0046157902783952],
        [50, 1.2589254117941673], [100, 1.5848931924611136], [250, 3.162277660168379],
        [333, 4.63446919736288], [500, 9.999999999999998], [667, 21.57744409152666],
        [750, 31.622776601683793], [900, 63.09573444801932], [999, 99.54054173515269],
        [1000, 100], [1005, 100],
      ]],
    ];
    for (const [min, max, table] of tables) {
      for (const [slider, value] of table) {
        expect(scales.sliderToLog2Value(slider, min, max), `${min}–${max} at ${slider}`).toBe(value);
      }
    }
  });

  test('the log2 inverse rounds to a whole slider position and round-trips within one', () => {
    const tables = [
      [1, 25, [
        [0.5, 0], [1, 0], [1.5, 126],
        [3, 341], [7.25, 615], [10, 715],
        [12.5, 785], [24.9, 999], [25, 1000],
        [26, 1000],
      ]],
      [1, 100, [
        [0.5, 0], [1, 0], [2, 151],
        [5, 349], [12.5, 548], [33, 759],
        [50, 849], [99.9, 1000], [100, 1000],
        [250, 1000],
      ]],
    ];
    for (const [min, max, table] of tables) {
      for (const [value, slider] of table) {
        expect(scales.log2ValueToSlider(value, min, max), `${min}–${max} at ${value}`).toBe(slider);
      }
      for (let slider = 0; slider <= 1000; slider += 37) {
        const back = scales.log2ValueToSlider(scales.sliderToLog2Value(slider, min, max), min, max);
        expect(Math.abs(back - slider), `${min}–${max} at ${slider}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test('the angle scale follows its tan-like curve from 1° to 180°', () => {
    const table = [
      [-5, 1], [0, 1], [100, 14.469750000000001],
      [250, 35.26171875], [500, 73.71875], [750, 120.56640625],
      [900, 154.44775], [1000, 180], [1005, 180],
    ];
    for (const [slider, angle] of table) {
      expect(scales.sliderToAngle(slider, 1, 180), `slider ${slider}`).toBe(angle);
    }
  });

  test('readouts keep one decimal below 10 and whole numbers from 10, rounding away from zero', () => {
    const table = [
      [-12.7, '-13', '-13%'],
      [-10.5, '-11', '-11%'],
      [-10, '-10', '-10%'],
      [-9.99, '-10.0', '-10.0%'],
      [-1.25, '-1.3', '-1.3%'],
      [0, '0.0', '0.0%'],
      [1.25, '1.3', '1.3%'],
      [9.94, '9.9', '9.9%'],
      [9.95, '9.9', '9.9%'],
      [9.99, '10.0', '10.0%'],
      [10, '10', '10%'],
      [10.5, '11', '11%'],
      [12.7, '13', '13%'],
      [100, '100', '100%'],
    ];
    for (const [value, plain, percent] of table) {
      expect(scales.formatUIValue(value), `${value}`).toBe(plain);
      expect(scales.formatUIValue(value, '%'), `${value}%`).toBe(percent);
    }
  });
});
