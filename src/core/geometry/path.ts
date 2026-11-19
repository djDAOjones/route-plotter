// CORE-02: a run of points as a sampled curve, ported from v3's PathCalculator (v3/src/services/PathCalculator.js).
// Two changes, each a held check: a budget caps the samples for a whole run, however many points it has (INTAKE.12);
// and nothing is cached, so the shape is a function of its inputs alone and never of edit history (DEF-10,
// CROWD-08.4: v3's cache key, first|middle|last|count, ignored most moves). Distances are in image widths (A22).
import { createPath } from './catmullRom';
import { item } from './item';
import type { ImagePoint } from './units';

/** v3's curve settings (v3/src/config/constants.js:83–84) and its spacing of 2 thousandths (PathCalculator.js:93). */
const PER_SEGMENT = 100;
const TENSION = 0.1;
const SPACING = 0.002;

/**
 * The most samples one run may hold, before and after spacing (INTAKE.12). It is above the most points a scene may
 * hold (`LIMITS.points`), so every run the model allows keeps each of its points as a sample.
 */
export const SAMPLE_BUDGET = 50_000;

export interface Path {
  /** The samples, at image fractions; dense at corners, so the lead slows through them (index-linear progress). */
  readonly points: readonly ImagePoint[];
  /** For each point given, the index of its sample. */
  readonly knots: readonly number[];
  /** The curve's length in image widths. */
  readonly length: number;
}

/** How much a corner slows the lead: v3's speed factor for a curvature (PathCalculator.js:127–137). */
function slowing(curvature: number): number {
  return Math.max(0.2, 1 - Math.min(curvature / 0.1, 1) ** 2 * 0.8);
}

/** v3's fast curvature at each sample, 0 at both ends (PathCalculator.js:527–556). */
function curvatures(path: readonly ImagePoint[]): Float64Array {
  const out = new Float64Array(path.length);
  for (let i = 1; i < path.length - 1; i += 1) {
    const [a, b, c] = [item(path, i - 1), item(path, i), item(path, i + 1)];
    const cross = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    const mean = (Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - b.x, c.y - b.y)) / 2;
    out[i] = mean > 0 ? cross / (mean * mean) : 0;
  }
  return out;
}

/** The first index whose table value is at least `target`, less one: the span `target` falls in. */
function spanOf(table: Float64Array, target: number): number {
  let low = 0;
  let high = table.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (item(table, mid) <= target) low = mid;
    else high = mid;
  }
  return low;
}

/** The curve's length: the sum of its samples' steps, in the units they are given in. */
export function polylineLength(points: readonly ImagePoint[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [a, b] = [item(points, i - 1), item(points, i)];
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

/**
 * The curve through `points` (image fractions) on an image `aspect` (height over width) tall, respaced so corners are
 * dense, as v3's `calculatePath` does (PathCalculator.js:23–120), within `budget` samples at both stages. The budget
 * must be a whole number no smaller than the points given, or it throws a RangeError: a fault in the caller. An
 * aspect that is not a positive finite number is read as 1, as `aspectOf` reads a size it cannot use.
 */
export function calculatePath(points: readonly ImagePoint[], aspect: number, budget = SAMPLE_BUDGET): Path {
  if (!Number.isInteger(budget) || budget < Math.max(2, points.length)) {
    throw new RangeError(`A budget of ${budget} samples cannot hold ${points.length} points`);
  }
  if (!(Number.isFinite(aspect) && aspect > 0)) return calculatePath(points, 1, budget);
  if (points.length < 2) return { points: [], knots: points.map(() => 0), length: 0 };
  const segments = points.length - 1;
  const perSegment = Math.max(1, Math.min(PER_SEGMENT, Math.floor((budget - 1) / segments)));
  const rough = createPath(points.map((p) => ({ x: p.x, y: p.y * aspect })), perSegment, TENSION);
  const bends = curvatures(rough);
  const table = new Float64Array(rough.length);
  for (let i = 1; i < rough.length; i += 1) {
    const [a, b] = [item(rough, i - 1), item(rough, i)];
    table[i] = item(table, i - 1) + Math.hypot(b.x - a.x, b.y - a.y) / slowing(item(bends, i));
  }
  const total = item(table, rough.length - 1);
  const count = Math.max(1, Math.min(Math.max(rough.length, Math.floor(total / SPACING)), budget - 1));
  const out: ImagePoint[] = [];
  for (let i = 0; i <= count; i += 1) {
    const target = total > 0 ? (i / count) * total : 0;
    const j = Math.min(spanOf(table, target), rough.length - 2);
    const [a, b] = [item(rough, j), item(rough, j + 1)];
    const span = item(table, j + 1) - item(table, j);
    const t = span > 0 ? Math.min(Math.max((target - item(table, j)) / span, 0), 1) : 0;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  const knots = points.map((_, k) => (total > 0 ? Math.round((item(table, k * perSegment) / total) * count) : 0));
  return { points: out.map((p) => ({ x: p.x, y: p.y / aspect })), knots, length: polylineLength(out) };
}

/** The point at `progress` (0 to 1) along the samples, by index as v3 reads it (PathCalculator.js:413–432). */
export function pointAt(points: readonly ImagePoint[], progress: number): ImagePoint | null {
  if (points.length === 0) return null;
  const at = Math.min(Math.max(Number.isFinite(progress) ? progress : 0, 0), 1) * (points.length - 1);
  const i = Math.floor(at);
  const a = item(points, i);
  const b = item(points, Math.min(i + 1, points.length - 1));
  const t = at - i;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
