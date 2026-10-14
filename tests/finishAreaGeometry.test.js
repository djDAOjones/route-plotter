/** CROWD-08 C: independently enumerate small lattices and check full discs. */
import { describe, expect, test } from 'vitest';
import { createFinishPackingContext, packFinishArea } from '../src/utils/finishArea.js';

const reference = { width: 1000, height: 1000 };
const context = createFinishPackingContext({ renderReference: reference });
const center = { x: 0.5, y: 0.5 };
const area = (shape = 'rectangle', extra = {}) => ({ shape, width: 0.1, height: 0.1, turn: 0, ...extra });
const order = i => i === 0 ? 0 : i < 0 ? -2 * i - 1 : 2 * i;

// Independent oracle: distance to the ellipse, minimizing over every bracket
// of a coarse boundary partition, then refining the minimum by golden search.
function boundaryDistance(x, y, a, b) {
  const square = t => (a * Math.cos(t) - Math.abs(x)) ** 2 + (b * Math.sin(t) - Math.abs(y)) ** 2;
  let best = Infinity;
  for (let i = 0; i < 24; i++) {
    let lo = i * Math.PI / 48, hi = (i + 1) * Math.PI / 48;
    for (let k = 0; k < 48; k++) {
      const p = lo + (hi - lo) * 0.3819660112501051, q = hi - (hi - lo) * 0.3819660112501051;
      if (square(p) < square(q)) hi = q; else lo = p;
    }
    best = Math.min(best, square(lo), square(hi), square(i * Math.PI / 48));
  }
  return Math.sqrt(best);
}

function enumerate(spec, origin, plane, size) {
  const a = spec.width * plane.aspect * plane.height / 2, b = spec.height * plane.height / 2;
  const radius = size * 10, step = size * 25, angle = spec.turn * Math.PI / 180;
  const found = [];
  for (let row = -Math.ceil(b / step); row <= Math.ceil(b / step); row++) {
    for (let col = -Math.ceil(a / step); col <= Math.ceil(a / step); col++) {
      const x = col * step, y = row * step;
      const fits = spec.shape === 'rectangle' ? Math.abs(x) + radius <= a + 1e-9
        && Math.abs(y) + radius <= b + 1e-9 : (x / a) ** 2 + (y / b) ** 2 <= 1
        && boundaryDistance(x, y, a, b) >= radius - 1e-9;
      const point = { x: origin.x + (x * Math.cos(angle) - y * Math.sin(angle)) / (plane.aspect * plane.height),
        y: origin.y + (x * Math.sin(angle) + y * Math.cos(angle)) / plane.height };
      if (fits && point.x >= -10 && point.x <= 11 && point.y >= -10 && point.y <= 11) {
        found.push({ row, col, point });
      }
    }
  }
  return found.sort((p, q) => order(p.row) - order(q.row) || order(p.col) - order(q.col)).map(p => p.point);
}

describe('finish packing reference', () => {
  test('uses contained intrinsic image and authored zoom, or the fixed reference plane', () => {
    expect(createFinishPackingContext({})).toMatchObject({ aspect: 1920 / 1080, height: 1080, hasImage: false });
    expect(createFinishPackingContext({ renderReference: reference, imageWidth: 400, imageHeight: 200,
      backgroundZoom: 2 })).toMatchObject({ aspect: 2, height: 1000, hasImage: true });
    expect(createFinishPackingContext({ renderReference: { width: 600, height: 900 },
      backgroundZoom: 10 })).toMatchObject({ aspect: 2 / 3, height: 900, hasImage: false });
  });
  test('centre-first signed row order; diameter plus a quarter and exact capacity', () => {
    const result = packFinishArea(area(), center, context, 1, 20);
    expect(result.capacity).toBe(9);
    expect(result.exact).toBe(true);
    expect(result.places).toEqual([0, -1, 1].flatMap(y => [0, -1, 1].map(x =>
      ({ x: 0.5 + x * 0.025, y: 0.5 + y * 0.025 }))));
    const prefix = packFinishArea(area('rectangle', { width: 0.8, height: 0.8 }), center, context, 1, 2);
    expect(prefix.places).toHaveLength(2);
    expect(prefix.capacity).toBeGreaterThanOrEqual(2);
  });
  test.each(['rectangle', 'ellipse'])('zero capacity, one tangent place and N=0 for %s', shape => {
    expect(packFinishArea(area(shape, { width: 0.01 }), center, context, 1, 10).capacity).toBe(0);
    expect(packFinishArea(area(shape, { width: 0.02, height: 0.02 }), center, context, 1, 10))
      .toMatchObject({ places: [center], capacity: 1, exact: true });
    expect(packFinishArea(area(shape), center, context, 1, 0)).toMatchObject({ places: [], hasPlace: true });
  });
  test('ellipse cusp rejects the subtract-both-radii approximation', () => {
    // a=100,b=10,r=5: x-extreme 86.16844. Step12.5 accepts75, rejects87.5.
    const result = packFinishArea(area('ellipse', { width: 0.2, height: 0.02 }), center, context, 0.5, 100);
    expect(result.capacity).toBe(13);
    expect(result.places).toEqual([0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6]
      .map(i => ({ x: 0.5 + i * 0.0125, y: 0.5 })));
  });
  test.each(['rectangle', 'ellipse'])('matches independent clipped lattice oracle: %s', shape => {
    for (const [width, height] of [[0.1, 0.04], [0.04, 0.1], [0.1, 0.1], [0.08, 0.02]]) {
      for (const turn of [0, 37, 90, -123]) {
        for (const origin of [center, { x: -10, y: -10 }, { x: 11, y: 10.99 }]) {
          const spec = area(shape, { width, height, turn });
          const expected = enumerate(spec, origin, context, 0.5);
          const result = packFinishArea(spec, origin, context, 0.5, 500);
          expect(result.capacity, JSON.stringify({ spec, origin })).toBe(expected.length);
          expect(result.exact).toBe(true);
          expect(result.places).toEqual(expected);
          expect(packFinishArea(spec, origin, context, 0.5, 2).places).toEqual(expected.slice(0, 2));
        }
      }
    }
  });
  test('extreme thin columns reject empty rows analytically', () => {
    const plane = createFinishPackingContext({ renderReference: { width: 16384, height: 16384 },
      imageWidth: 1, imageHeight: 8192, backgroundZoom: 10 });
    const start = performance.now();
    const result = packFinishArea(area('rectangle', { width: 0.02, height: 0.8, turn: 0.0000572957795 }),
      { x: -10, y: -10 }, plane, 0.01, 2);
    expect(result).toMatchObject({ capacity: 1, exact: true, places: [{ x: -10, y: -10 }] });
    expect(performance.now() - start).toBeLessThan(1000);
  });
  test('large theoretical lattices materialise only the requested supported dot count', () => {
    const plane = createFinishPackingContext({ renderReference: { width: 16384, height: 16384 } });
    const start = performance.now();
    const result = packFinishArea(area('ellipse', { width: 0.8, height: 0.8, turn: 43 }), center, plane, 0.01, 20000);
    expect(result.places).toHaveLength(20000);
    expect(result).toMatchObject({ capacity: 20000, exact: false });
    expect(new Set(result.places.map(p => `${p.x},${p.y}`)).size).toBe(20000);
    expect(performance.now() - start).toBeLessThan(2000);
  });
  test('seeded independent oracle spans image proportions, rotations, ellipse cusps and clipping', () => {
    let seed = 20261014;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    for (let i = 0; i < 120; i++) {
      const plane = createFinishPackingContext({ renderReference: { width: 600, height: 900 },
        imageWidth: i % 3 ? 400 : 1200, imageHeight: i % 3 ? 1200 : 400, backgroundZoom: 0.5 + random() * 2 });
      const spec = area(i % 2 ? 'ellipse' : 'rectangle', {
        width: 0.01 + random() * 0.3, height: 0.01 + random() * 0.3, turn: random() * 360 - 180,
      });
      const origin = i % 4 ? center : { x: random() < 0.5 ? -10 : 11, y: random() < 0.5 ? -10 : 11 };
      const size = Math.min(spec.width * plane.aspect, spec.height) * plane.height / (30 + random() * 60);
      const expected = enumerate(spec, origin, plane, size);
      const result = packFinishArea(spec, origin, plane, size, 500);
      expect(result.capacity, JSON.stringify({ i, spec, plane, size })).toBe(expected.length);
      expect(result.exact).toBe(true);
      expect(result.places).toHaveLength(expected.length);
      // Independent physical arithmetic has a different operation order, so
      // compare coordinates within rounding error, retaining exact seat order.
      result.places.forEach((point, index) => {
        expect(point.x).toBeCloseTo(expected[index].x, 12);
        expect(point.y).toBeCloseTo(expected[index].y, 12);
      });
      expect(packFinishArea(spec, origin, plane, size, 2).places).toEqual(result.places.slice(0, 2));
      // Every whole disc is checked above. Independent pair distances ensure
      // the physical quarter-diameter gap survives the normalisation/rotation.
      for (let j = 1; j < result.places.length; j++) {
        const p = result.places[j];
        for (const q of result.places.slice(0, j)) {
          expect(Math.hypot((p.x - q.x) * plane.aspect * plane.height, (p.y - q.y) * plane.height))
            .toBeGreaterThanOrEqual(size * 25 - 1e-9);
        }
      }
    }
  });
  test('relative boundary tolerance admits a numerical tangent but rejects a genuinely undersized area', () => {
    for (const shape of ['rectangle', 'ellipse']) {
      expect(packFinishArea(area(shape, { width: 0.02 - Number.EPSILON, height: 0.02 }), center, context, 1, 3)
        .capacity).toBe(1);
      expect(packFinishArea(area(shape, { width: 0.02 - 1e-12, height: 0.02 }), center, context, 1, 3)
        .capacity).toBe(0);
    }
  });
});
