/** CROWD-08 B: independent geometry and sampling oracles. */
import { describe, expect, test } from 'vitest';
import { areaImageAspect, areaPoint, sampleCrowdArea } from '../src/utils/crowdArea.js';
import { IMAGE_COORDINATES } from '../src/config/constants.js';

const center = { x: 0.4, y: 0.6 };
const rectangle = { shape: 'rectangle', width: 0.4, height: 0.2, turn: 0 };
const near = (actual, expected) => {
  expect(actual.x).toBeCloseTo(expected.x, 13);
  expect(actual.y).toBeCloseTo(expected.y, 13);
};

describe('area geometry in the image plane', () => {
  test.each([0.5, 1, 2])('a 90-degree turn uses intrinsic image aspect %s', aspect => {
    near(areaPoint({ ...rectangle, turn: 90 }, center, 0.5, 0.5, aspect), {
      x: center.x - 0.1 / aspect, y: center.y + 0.2 * aspect,
    });
    near(areaPoint({ ...rectangle, turn: 0 }, center, -0.5, 0.5, aspect), { x: 0.2, y: 0.7 });
  });

  test.each([-180, -37, 0, 73, 180])('physical axes remain perpendicular after turn %s', turn => {
    const a = areaPoint({ ...rectangle, turn }, center, 0.5, 0, 2.5);
    const b = areaPoint({ ...rectangle, turn }, center, 0, 0.5, 2.5);
    const ax = (a.x - center.x) * 2.5, ay = a.y - center.y;
    const bx = (b.x - center.x) * 2.5, by = b.y - center.y;
    expect(ax * bx + ay * by).toBeCloseTo(0, 14);
    expect(Math.hypot(ax, ay)).toBeCloseTo(0.5, 14);
    expect(Math.hypot(bx, by)).toBeCloseTo(0.1, 14);
  });

  test('aspect reads only intrinsic image dimensions; absent and invalid dimensions mean square', () => {
    expect(areaImageAspect({ imageWidth: 400, imageHeight: 200, canvasWidth: 300, canvasHeight: 900 })).toBe(2);
    for (const transform of [null, {}, { canvasWidth: 200, canvasHeight: 900 },
      { imageWidth: 0, imageHeight: 20 }, { imageWidth: Infinity, imageHeight: 20 }]) {
      expect(areaImageAspect(transform)).toBe(1);
    }
  });

  test('rectangle uses both independent draws directly', () => {
    near(sampleCrowdArea(rectangle, center, [0.25, 0.75], 1), { x: 0.3, y: 0.65 });
    near(sampleCrowdArea(rectangle, center, [0.75, 0.25], 1), { x: 0.5, y: 0.55 });
  });

  test('ellipse radius is sqrt(draw), not draw: independent fixed fractions', () => {
    const ellipse = { ...rectangle, shape: 'ellipse' };
    near(sampleCrowdArea(ellipse, center, [0.25, 0], 1), { x: 0.5, y: 0.6 });
    near(sampleCrowdArea(ellipse, center, [0.81, 0.25], 1), { x: 0.4, y: 0.69 });
    near(sampleCrowdArea(ellipse, center, [0, 0.8], 1), center);
  });

  test.each(['rectangle', 'ellipse'])('sampling is inside the turned %s, including extreme anchors', shape => {
    const spec = { shape, width: 0.8, height: 0.03, turn: 37 };
    const angle = 37 * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle), aspect = 2;
    for (const origin of [center, { x: IMAGE_COORDINATES.MIN, y: IMAGE_COORDINATES.MAX },
      { x: IMAGE_COORDINATES.MAX - 0.001, y: IMAGE_COORDINATES.MIN + 0.001 }]) {
      for (let i = 0; i < 100; i++) {
        const point = sampleCrowdArea(spec, origin, [(i + 0.5) / 100, ((i * 37) % 100 + 0.5) / 100], aspect);
        expect(point.x).toBeGreaterThanOrEqual(IMAGE_COORDINATES.MIN);
        expect(point.x).toBeLessThanOrEqual(IMAGE_COORDINATES.MAX);
        expect(point.y).toBeGreaterThanOrEqual(IMAGE_COORDINATES.MIN);
        expect(point.y).toBeLessThanOrEqual(IMAGE_COORDINATES.MAX);
        const dx = (point.x - origin.x) * aspect, dy = point.y - origin.y;
        const u = (dx * cosine + dy * sine) / (aspect * spec.width / 2);
        const v = (-dx * sine + dy * cosine) / (spec.height / 2);
        if (shape === 'ellipse') expect(u * u + v * v).toBeLessThanOrEqual(1 + 1e-10);
        else expect(Math.max(Math.abs(u), Math.abs(v))).toBeLessThanOrEqual(1 + 1e-10);
      }
    }
  });
});
