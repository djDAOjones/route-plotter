import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { LAYERS } from './layers';
import { REFERENCE_SHORT_EDGE, renderScale } from './scale';

describe('reference scaling', () => {
  test('a frame with the reference short edge draws reference pixels as they are, times the Graphics scale', () => {
    expect(REFERENCE_SHORT_EDGE).toBe(1080);
    expect(renderScale({ width: 1920, height: 1080 }, 1)).toBe(1);
    expect(renderScale({ width: 1920, height: 1080 }, 2.5)).toBe(2.5);
  });

  test('the short edge decides, so a portrait and a landscape frame of one short edge draw alike', () => {
    expect(renderScale({ width: 1080, height: 1920 }, 1)).toBe(1);
    expect(renderScale({ width: 3840, height: 2160 }, 1)).toBe(2);
    expect(renderScale({ width: 1280, height: 720 }, 1)).toBeCloseTo(2 / 3, 12);
  });

  test('a frame with no area, or sizes that are not numbers, draws at the Graphics scale alone', () => {
    expect(renderScale({ width: 0, height: 1080 }, 2)).toBe(2);
    expect(renderScale({ width: Number.NaN, height: 1080 }, 2)).toBe(2);
    expect(renderScale({ width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY }, 0.5)).toBe(0.5);
    expect(renderScale({ width: -5, height: 10 }, 1)).toBe(1);
  });

  test('a Graphics scale that is not a positive number draws at 1, never at 0, which a canvas would ignore', () => {
    expect(renderScale({ width: 1920, height: 1080 }, 0)).toBe(1);
    expect(renderScale({ width: 1920, height: 1080 }, Number.NaN)).toBe(1);
  });

  test('a picture keeps its proportions at any frame size: a size scales with the short edge', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8000 }),
        fc.integer({ min: 1, max: 8000 }),
        fc.double({ min: 0.25, max: 4, noNaN: true }),
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        (width, height, graphics, factor) => {
          const scale = renderScale({ width, height }, graphics);
          const scaled = renderScale({ width: width * factor, height: height * factor }, graphics);
          expect(scaled / scale).toBeCloseTo(factor, 9);
        },
      ),
    );
  });
});

describe('the layers', () => {
  test('are P4’s, bottom first, and the editor’s overlays are not among them', () => {
    expect(LAYERS).toEqual([
      'backgroundMask',
      'background',
      'backgroundEffects',
      'highlightedAreas',
      'lines',
      'crowdDots',
      'markers',
      'leadHead',
      'labels',
    ]);
    expect(LAYERS.some((layer) => /overlay|editor|select/i.test(layer))).toBe(false);
  });
});
