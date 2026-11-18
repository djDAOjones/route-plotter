/**
 * REVEAL-01 — the spotlight reveal fades out behind the head.
 *
 * Before this, `buildSpotlightRevealMask` repainted every passed path point at
 * full opacity on every frame, so revealed stayed revealed — uniformly and
 * permanently. The owner's ask was that the reveal fade out over time, and
 * their call was that the fade is authorable per project rather than a fixed
 * constant.
 *
 * The weighting lives in a pure static so it can be tested without a canvas,
 * and so the property that matters most is checkable directly: the fade is a
 * function of *position*, never an accumulation. That is what keeps scrubbing
 * bidirectional and keeps export identical to preview.
 */

import { describe, test, expect } from 'vitest';
import { MotionVisibilityService } from '../src/services/MotionVisibilityService.js';
import { MOTION } from '../src/config/constants.js';

const alpha = (i, head, total, trail) =>
  MotionVisibilityService.revealTrailAlpha(i, head, total, trail);

describe('reveal trail weighting', () => {
  test('the maximum means no fade, which is what every older project looks like', () => {
    // The default is the sentinel, so a project authored before this control
    // existed must render exactly as it always did.
    expect(MOTION.SPOTLIGHT_TRAIL_DEFAULT).toBe(MOTION.SPOTLIGHT_TRAIL_MAX);

    // At the sentinel the mask builder skips weighting altogether; the helper
    // still answers 1 for the whole travelled path.
    for (const i of [0, 25, 50, 99]) {
      expect(alpha(i, 100, 100, MOTION.SPOTLIGHT_TRAIL_MAX)).toBe(1);
    }
  });

  test('the head is fully lit and the far end of the trail is gone', () => {
    const total = 100;
    const head = 100; // progress 1

    expect(alpha(100, head, total, 50)).toBe(1);   // at the head
    expect(alpha(75, head, total, 50)).toBeCloseTo(0.5, 6); // half a 50% trail
    expect(alpha(50, head, total, 50)).toBe(0);    // exactly one trail behind
    expect(alpha(10, head, total, 50)).toBe(0);    // long gone
  });

  test('the fade is linear across the trail', () => {
    const total = 100;
    const head = 80;
    const quarter = alpha(70, head, total, 40);
    const half = alpha(60, head, total, 40);
    const threeQuarters = alpha(50, head, total, 40);

    expect(quarter).toBeCloseTo(0.75, 6);
    expect(half).toBeCloseTo(0.5, 6);
    expect(threeQuarters).toBeCloseTo(0.25, 6);
  });

  test('trail length is read as a fraction of the path, not a point count', () => {
    // The same relative position in a dense path and a sparse one must fade
    // identically, or the effect would drift with path resolution.
    const sparse = alpha(30, 60, 60, 25);
    const dense = alpha(300, 600, 600, 25);

    expect(sparse).toBeCloseTo(dense, 12);
    // Half a path behind a 25% trail is long gone in both, so that pair
    // compares two zeros (TST-16). A point a sixth of the path behind is lit,
    // at a third, in both.
    expect(sparse).toBe(0);
    const sparseLit = alpha(50, 60, 60, 25);
    const denseLit = alpha(500, 600, 600, 25);
    expect(sparseLit).toBeCloseTo(1 / 3, 12);
    expect(denseLit).toBeCloseTo(sparseLit, 12);
  });

  test('it is a pure function of position, not an accumulation', () => {
    // Scrubbing backwards must land on the same value as arriving forwards.
    const forwards = [40, 60, 80].map(h => alpha(30, h, 100, 30));
    const backwards = [80, 60, 40].map(h => alpha(30, h, 100, 30)).reverse();

    expect(forwards).toEqual(backwards);
    // And repeated evaluation never drifts.
    expect(alpha(30, 60, 100, 30)).toBe(alpha(30, 60, 100, 30));
    // Two of those three values, and the repeated one, are zero, which an
    // accumulation would leave at zero too (TST-16): the same, over lit points.
    expect(forwards).toEqual([expect.closeTo(2 / 3, 12), 0, 0]);
    const litForwards = [35, 40, 45].map(h => alpha(30, h, 100, 30));
    const litBackwards = [45, 40, 35].map(h => alpha(30, h, 100, 30)).reverse();
    expect(litForwards).toEqual([expect.closeTo(5 / 6, 12), expect.closeTo(2 / 3, 12), expect.closeTo(1 / 2, 12)]);
    expect(litBackwards).toEqual(litForwards);
    expect(alpha(30, 40, 100, 30)).toBe(alpha(30, 40, 100, 30));
  });

  test('a point at or ahead of the head is fully lit', () => {
    expect(alpha(50, 50, 100, 20)).toBe(1);
    expect(alpha(60, 50, 100, 20)).toBe(1);
  });

  test('degenerate inputs fade to nothing rather than throwing', () => {
    expect(alpha(0, 0, 0, 50)).toBe(0);
    expect(alpha(10, 50, 100, 0)).toBe(0);
  });
});

describe('spotlight inner radius (BUG-02)', () => {
  // A radial gradient whose two radii are equal paints nothing at all. Feather
  // 0 is SPOTLIGHT_FEATHER_DEFAULT, so every new project started with an
  // entirely invisible spotlight — including anyone switching on the reveal to
  // try REVEAL-01. Measured in Chromium before the fix: peak mask alpha 0 at
  // feather 0, 255 at feather 1.
  const inner = (r, f) => MotionVisibilityService.spotlightInnerRadius(r, f);

  test('a zero feather still leaves a paintable gap', () => {
    expect(MOTION.SPOTLIGHT_FEATHER_DEFAULT).toBe(0); // the shape of the bug
    // Exactly half a pixel inside the outer radius: a hard edge that paints.
    // Anything between 0 and 24 passed the range this replaced (TST-16).
    expect(inner(24, 0)).toBe(23.5);
  });

  test('a real feather is honoured unchanged', () => {
    expect(inner(24, 6)).toBe(18);
    expect(inner(100, 40)).toBe(60);
  });

  test('a feather wider than the spotlight clamps to the centre', () => {
    expect(inner(24, 100)).toBe(0);
    // A negative feather is read as none: the same half-pixel hard edge, not a
    // gradient five pixels wide (TST-16; it was only held below 24).
    expect(inner(24, -5)).toBe(23.5);
  });

  test('a zero-radius spotlight has nothing to paint', () => {
    expect(inner(0, 0)).toBe(0);
  });
});
