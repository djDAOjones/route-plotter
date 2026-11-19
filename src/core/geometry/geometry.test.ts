// CORE-02: the geometry ports' tests (§15, A18). v3's assertions kept are cited by file and line under v3/tests; the
// curvature cache's pins (DEF-10, CROWD-08.4) are inverted to assert the fix.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createPath, interpolate } from './catmullRom';
import { LIMITS } from '../config/limits';
import { cubicInOut, cubicOut, quadIn } from './easing';
import { SAMPLE_BUDGET, calculatePath, pointAt, polylineLength } from './path';
import { canvasToImage, imageBounds, imageToCanvas, isOnImage } from './transform';
import { aspectOf, widthsBetween } from './units';

const p = (x: number, y: number) => ({ x, y });

describe('Catmull-Rom (v3/tests/example.test.js:377–401)', () => {
  it('interpolates halfway exactly as the formula gives', () => {
    expect(interpolate(p(0, 0), p(100, 0), p(200, 100), p(300, 100), 0.5, 0.5)).toEqual(p(150, 50));
  });

  it('makes perSegment × (n − 1) + 1 points from the first point to a copy of the last', () => {
    const points = [p(0, 0), p(50, 50), p(100, 0)];
    const path = createPath(points, 10, 0.5);
    expect(path).toHaveLength(21);
    expect(path[0]).toEqual(points[0]);
    expect(path[20]).toEqual(points[2]);
    expect(path[20]).not.toBe(points[2]);
    expect(createPath([p(0, 0)], 10, 0.5)).toEqual([]);
  });
});

describe('easing (v3/tests/example.test.js:353–371)', () => {
  it('maps 0 to 0 and 1 to 1, each with its own shape', () => {
    for (const ease of [quadIn, cubicOut, cubicInOut]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
    }
    expect(quadIn(0.5)).toBeLessThan(0.5);
    expect(cubicOut(0.5)).toBeGreaterThan(0.5);
    expect(cubicInOut(0.5)).toBeCloseTo(0.5, 10);
  });
});

describe('image fractions and canvas pixels (v3/tests/units.test.js:89–140, :565–607; example.test.js:226–258)', () => {
  it('fits the image as v3 did, zoom about the canvas’s centre included', () => {
    const cases: [number, number, number, number, number, [number, number, number, number]][] = [
      [806, 570, 1612, 1140, 0.5, [201.5, 142.5, 403, 285]],
      [1280, 720, 1600, 1200, 1, [160, 0, 960, 720]],
      [1280, 720, 1280, 960, 2, [-320, -360, 1920, 1440]],
      [1920, 1080, 1000, 1500, 0.25, [870, 405, 180, 270]],
      [800, 800, 1600, 900, 1.5, [-200, 62.5, 1200, 675]],
    ];
    for (const [cw, ch, iw, ih, zoom, [x, y, width, height]] of cases) {
      const bounds = imageBounds({ width: cw, height: ch }, { width: iw, height: ih }, zoom);
      expect([bounds.x, bounds.y, bounds.width, bounds.height]).toEqual([x, y, width, height]);
    }
  });

  it('maps the image’s centre to the canvas’s centre and round-trips, on the image and off it', () => {
    const bounds = imageBounds({ width: 800, height: 600 }, { width: 1000, height: 1000 }, 1);
    expect(imageToCanvas(bounds, p(0.5, 0.5))).toEqual(p(400, 300));
    expect(isOnImage(bounds, p(400, 300))).toBe(true);
    expect(isOnImage(bounds, p(0, 0))).toBe(false);
    const back = canvasToImage(bounds, imageToCanvas(bounds, p(0.25, 0.75)));
    expect(back.x).toBeCloseTo(0.25, 12);
    expect(back.y).toBeCloseTo(0.75, 12);
    // With no image, v3 maps to the canvas itself (units.test.js:130–140): the canvas's own size stands in.
    const none = imageBounds({ width: 800, height: 600 }, { width: 800, height: 600 }, 1);
    expect(imageToCanvas(none, p(0.25, 0.75))).toEqual(p(200, 450));
  });

  it('fills the canvas when asked, and an image the canvas’s own size maps one to one', () => {
    expect(imageBounds({ width: 800, height: 600 }, { width: 1000, height: 1000 }, 1, 'fill').width).toBe(800);
    const same = imageBounds({ width: 640, height: 360 }, { width: 640, height: 360 }, 1);
    expect(canvasToImage(same, p(640, 360))).toEqual(p(1, 1));
  });
});

describe('distances in image widths (A22, DEF-79)', () => {
  it('counts a tall image’s height by its true proportion, and never reads the canvas', () => {
    expect(widthsBetween(p(0, 0), p(0, 1), aspectOf({ width: 1000, height: 2000 }))).toBe(2);
    expect(widthsBetween(p(0, 0), p(0.3, 0.2), 2)).toBeCloseTo(0.5, 12);
    expect(aspectOf(null)).toBe(1);
    expect(aspectOf({ width: 0, height: 10 })).toBe(1);
  });
});

/** v3's curvature fixture's trunk (v3/src/examples/index.js:79–99): 1, 2, 2a, 2b, 3. */
const TRUNK = [p(0.16, 0.63), p(0.4, 0.47), p(0.52, 0.58), p(0.63, 0.55), p(0.78, 0.42)];
const moved = (points: readonly { x: number; y: number }[], i: number, dx: number, dy: number) =>
  points.map((q, k) => (k === i ? p(q.x + dx, q.y + dy) : q));

describe('the path (v3/tests/units.test.js:144–204, example.test.js:159–221)', () => {
  it('needs two points, measures its length, and reads a point by progress', () => {
    expect(calculatePath([], 1).points).toEqual([]);
    expect(calculatePath([p(0.5, 0.5)], 1).points).toEqual([]);
    expect(polylineLength([p(0, 0), p(3, 4), p(3, 8)])).toBe(9);
    expect(pointAt([p(0, 0), p(10, 0)], 0)).toEqual(p(0, 0));
    expect(pointAt([p(0, 0), p(10, 0)], 1)).toEqual(p(10, 0));
    expect(pointAt([p(0, 0), p(10, 0)], 0.5)?.x).toBeCloseTo(5, 12);
    expect(pointAt([], 0.5)).toBeNull();
    const path = calculatePath([p(0, 0), p(0.5, 0.5), p(1, 0.25)], 1);
    expect(path.points.length).toBeGreaterThan(3);
    expect(path.points[0]).toEqual(p(0, 0));
  });

  it('matches v3’s fresh golden for the curvature fixture (v3/tests/goldens/domains-curvature.json)', () => {
    const fresh = calculatePath(TRUNK, 1);
    expect(fresh.points).toHaveLength(402);
    expect(fresh.length * 1000).toBeCloseTo(764.882002, 4);
    const afterMove = calculatePath(moved(TRUNK, 3, 0.08, -0.16), 1);
    expect(afterMove.points).toHaveLength(413);
    expect(afterMove.length * 1000).toBeCloseTo(798.285616, 4);
    expect(fresh.knots[0]).toBe(0);
    expect(fresh.knots[4]).toBe(401);
  });

  it('DEF-10, CROWD-08.4: the shape never depends on edit history; each edit gives what a fresh path gives', () => {
    // Inverts v3/tests/curvatureCache.test.js:120–131, which pinned steps 2, 4 and 6 disagreeing (408 vs 413 points).
    const edits = [
      TRUNK,
      moved(TRUNK, 3, 0.08, -0.16),
      [...TRUNK.slice(0, 2), p(0.46, 0.52), ...TRUNK.slice(2)],
      TRUNK.filter((_, k) => k !== 2),
      moved(moved(TRUNK, 3, 0.08, -0.16), 2, 0.02, 0),
      TRUNK,
    ];
    const warm = edits.map((points) => calculatePath(points, 1));
    for (const [i, points] of edits.entries()) expect(warm[i]).toEqual(calculatePath(points, 1));
    expect(warm[1]?.points).toHaveLength(413);
  });

  it('DEF-10, as a property: any sequence of drags gives at each step exactly the fresh path', () => {
    const drag = fc.tuple(fc.integer({ min: 0, max: 4 }), fc.double({ min: -0.2, max: 0.2, noNaN: true }));
    fc.assert(
      fc.property(fc.array(drag, { maxLength: 8 }), (drags) => {
        let points = TRUNK;
        calculatePath(points, 1.5);
        for (const [i, d] of drags) {
          points = moved(points, i, d, -d);
          expect(calculatePath(points, 1.5)).toEqual(calculatePath(points.map((q) => ({ ...q })), 1.5));
        }
      }),
      { numRuns: 25 },
    );
  });
});

describe('the sample budget for a whole run (INTAKE.12)', () => {
  const zigzag = (n: number) => Array.from({ length: n }, (_, i) => p((i % 50) / 50, Math.floor(i / 50) / 40));

  it('never passes its budget, however many points or corners a run has', () => {
    for (const n of [2, 300, 2_000, 10_000]) {
      const path = calculatePath(zigzag(n), 0.75);
      expect(path.points.length).toBeLessThanOrEqual(SAMPLE_BUDGET);
      expect(path.knots).toHaveLength(n);
      expect(path.knots.at(-1)).toBe(path.points.length - 1);
    }
    expect(calculatePath(zigzag(500), 1, 1_000).points.length).toBeLessThanOrEqual(1_000);
    const tight = calculatePath(zigzag(500), 1, 500);
    expect(tight.points.length).toBeLessThanOrEqual(500);
    expect(tight.knots.at(-1)).toBe(tight.points.length - 1);
    expect(SAMPLE_BUDGET).toBeGreaterThan(LIMITS.points);
  });

  it('refuses a budget that is not a whole number or cannot hold the points, and reads a bad aspect as 1', () => {
    for (const budget of [1, 3.5, Number.NaN, 499]) {
      expect(() => calculatePath(zigzag(500), 1, budget)).toThrow(RangeError);
    }
    const square = calculatePath([p(0, 0), p(1, 1)], 1, 100);
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(calculatePath([p(0, 0), p(1, 1)], aspect, 100)).toEqual(square);
    }
    expect(square.points.at(-1)).toEqual(p(1, 1));
  });

  it('samples a run of 2,000 points within its budget, in under a second', () => {
    const points = zigzag(2_000);
    const started = performance.now();
    const path = calculatePath(points, 0.75);
    const took = performance.now() - started;
    expect(path.points.length).toBeLessThanOrEqual(SAMPLE_BUDGET);
    expect(took).toBeLessThan(1_000);
  });
});
