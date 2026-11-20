// CORE-05, stage 4: the slider scales, pinned by v3's tables value for value (v3/tests/sliderScales.test.js, its first
// six tests), and the readout as D180 rules it, which replaces v3's pinned quirks (that test's line 129).
import { describe, expect, it } from 'vitest';
import {
  angleToSlider,
  bipolarLog2ValueToSlider,
  bipolarSliderToLog2Value,
  formatUIValue,
  log2ValueToSlider,
  sliderToAngle,
  sliderToLog2Value,
} from './sliderScales';

type Table = readonly (readonly [number, number])[];

describe('the slider scales, as v3 has them', () => {
  it('the bipolar scale maps a ±50 dead zone to exactly 0', () => {
    expect([-1000, -51, -50, 0, 50, 51, 1000].map((slider) => bipolarSliderToLog2Value(slider, 0.25, 4))).toEqual([
      -4, -0.2507306943634884, 0, 0, 0, 0.2507306943634884, 4,
    ]);
    const table: Table = [
      [-1000, -100], [-951, -78.85733669774899], [-500, -8.858667904100825],
      [-51, -1.0048593159311134], [-50, 0], [-1, 0],
      [0, 0], [1, 0], [50, 0],
      [51, 1.0048593159311134], [500, 8.858667904100825], [951, 78.85733669774899],
      [1000, 100],
    ];
    for (const [slider, value] of table) expect(bipolarSliderToLog2Value(slider, 1, 100), `slider ${slider}`).toBe(value);
  });

  it('the bipolar inverse places a value past the dead zone, and round-trips within a slider unit', () => {
    const table: Table = [
      [-100, -1000], [-37.5, -797.65], [-10, -525],
      [-2.5, -239.05], [-1, -50], [0, 0],
      [1, 50], [2.5, 239.05], [10, 525],
      [37.5, 797.65], [100, 1000],
    ];
    for (const [value, slider] of table) expect(bipolarLog2ValueToSlider(value, 1, 100), `value ${value}`).toBe(slider);
    for (const slider of [-1000, -951, -500, -200, -51, 51, 200, 500, 951, 1000]) {
      const back = bipolarLog2ValueToSlider(bipolarSliderToLog2Value(slider, 1, 100), 1, 100);
      expect(Math.abs(back - slider), `slider ${slider}`).toBeLessThan(1);
    }
  });

  it('the log2 scale clamps outside 0 to 1000 and is exact between', () => {
    const tables: readonly (readonly [number, number, Table])[] = [
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
      for (const [slider, value] of table) expect(sliderToLog2Value(slider, min, max), `${min}–${max} at ${slider}`).toBe(value);
    }
  });

  it('the log2 inverse rounds to a whole slider position and round-trips within one', () => {
    const tables: readonly (readonly [number, number, Table])[] = [
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
      for (const [value, slider] of table) expect(log2ValueToSlider(value, min, max), `${min}–${max} at ${value}`).toBe(slider);
      for (let slider = 0; slider <= 1000; slider += 37) {
        const back = log2ValueToSlider(sliderToLog2Value(slider, min, max), min, max);
        expect(Math.abs(back - slider), `${min}–${max} at ${slider}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the angle scale follows its tan-like curve from 1° to 180°', () => {
    const table: Table = [
      [-5, 1], [0, 1], [100, 14.469750000000001],
      [250, 35.26171875], [500, 73.71875], [750, 120.56640625],
      [900, 154.44775], [1000, 180], [1005, 180],
    ];
    for (const [slider, angle] of table) expect(sliderToAngle(slider, 1, 180), `slider ${slider}`).toBe(angle);
  });

  it('the angle inverse clamps and gives back every position (DEF-20)', () => {
    const table: Table = [
      [-5, 0], [1, 0], [1.5, 4], [14.469750000000001, 100],
      [35.26171875, 250], [60, 416], [73.71875, 500], [95, 621],
      [120.56640625, 750], [154.44775, 900], [179.9, 1000], [180, 1000],
      [200, 1000],
    ];
    for (const [angle, slider] of table) expect(angleToSlider(angle, 1, 180), `angle ${angle}`).toBe(slider);
    for (let slider = 0; slider <= 1000; slider += 1) {
      expect(angleToSlider(sliderToAngle(slider, 1, 180), 1, 180), `slider ${slider}`).toBe(slider);
    }
  });
});

describe('the readout (D180)', () => {
  // One decimal place below 10 in size, whole numbers from 10, each rounded to the nearest with a half rounded away from
  // zero, the format chosen on the value rounded to one place, so "10.0" is never shown and zero is never "-0.0".
  // Rounding is of the value as stored. 1.25, -1.25, 10.5 and -10.5 are stored exactly, so each is a true half and goes
  // away from zero. 9.95 is stored as 9.9499999999999993, just below the half, so it reads "9.9"; 9.96 rounds to 10.0
  // at one place, so it is shown whole, as "10". v3 read 10.2 as "11" (rounded up) and -9.99 as "-10.0".
  it('rounds to the nearest, switches at 10 on the rounded value, and never shows -0.0', () => {
    const table: readonly (readonly [number, string])[] = [
      [-12.7, '-13'],
      [-10.5, '-11'],
      [-10.4, '-10'],
      [-10, '-10'],
      [-9.99, '-10'],
      [-9.94, '-9.9'],
      [-1.25, '-1.3'],
      [-0.04, '0.0'],
      [-0, '0.0'],
      [0, '0.0'],
      [1.25, '1.3'],
      [9.94, '9.9'],
      [9.95, '9.9'],
      [9.96, '10'],
      [9.99, '10'],
      [10, '10'],
      [10.2, '10'],
      [10.5, '11'],
      [12.7, '13'],
      [100, '100'],
    ];
    for (const [value, plain] of table) {
      expect(formatUIValue(value), `${value}`).toBe(plain);
      expect(formatUIValue(value, '%'), `${value}%`).toBe(`${plain}%`);
    }
  });
});
