// CORE-02: v3's Catmull-Rom curve, ported (v3/src/utils/CatmullRom.js). A uniform cardinal spline in Hermite form;
// at tension 0.5 it is the classic Catmull-Rom, and v3 draws routes at 0.1 (v3/src/config/constants.js:84).
import { item } from './item';
import type { ImagePoint } from './units';

/** The curve's point at `t` (0 to 1) between `p1` and `p2`, `p0` and `p3` the neighbours (CatmullRom.js:16–35). */
export function interpolate(
  p0: ImagePoint,
  p1: ImagePoint,
  p2: ImagePoint,
  p3: ImagePoint,
  t: number,
  tension: number,
): ImagePoint {
  const at = (a: number, b: number, c: number, d: number) => {
    const m1 = tension * (c - a);
    const m2 = tension * (d - b);
    const span = c - b;
    return b + m1 * t + (3 * span - 2 * m1 - m2) * t * t + (-2 * span + m1 + m2) * t * t * t;
  };
  return { x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) };
}

/**
 * The curve through every point, `perSegment` samples to a segment, the ends padded by repeating the end points
 * (CatmullRom.js:44–68). It has `perSegment × (n − 1) + 1` points and ends on a copy of the last point, never the
 * caller's own object. Fewer than two points give no curve.
 */
export function createPath(points: readonly ImagePoint[], perSegment: number, tension: number): ImagePoint[] {
  if (points.length < 2) return [];
  const path: ImagePoint[] = [];
  const last = points.length - 1;
  for (let i = 0; i < last; i += 1) {
    const p0 = item(points, Math.max(i - 1, 0));
    const p1 = item(points, i);
    const p2 = item(points, i + 1);
    const p3 = item(points, Math.min(i + 2, last));
    for (let j = 0; j < perSegment; j += 1) path.push(interpolate(p0, p1, p2, p3, j / perSegment, tension));
  }
  const end = item(points, last);
  path.push({ x: end.x, y: end.y });
  return path;
}
