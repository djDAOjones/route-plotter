import { IMAGE_COORDINATES } from '../config/constants.js';
import { CoordinateTransform } from '../services/CoordinateTransform.js';
import { DOT_BASE_RADIUS_PX } from '../services/DotRenderer.js';
import { resolveRenderReference } from './renderReference.js';

/** C-bearing projects without either reference migrate identically in both hosts. */
export const FINISH_REFERENCE = Object.freeze({ width: 1920, height: 1080 });

/** Authored image information, never current canvas bounds or drawing suppression. */
export function createFinishPackingContext({ renderReference, imageWidth, imageHeight, backgroundZoom = 1 } = {}) {
  const reference = resolveRenderReference(renderReference, FINISH_REFERENCE);
  const transform = new CoordinateTransform();
  transform.setCanvasDimensions(reference.width, reference.height);
  const hasImage = Number.isFinite(imageWidth) && imageWidth > 0 && Number.isFinite(imageHeight) && imageHeight > 0;
  if (hasImage) {
    transform.setImageDimensions(imageWidth, imageHeight);
    transform.setBackgroundZoom(backgroundZoom);
  }
  return {
    reference, hasImage,
    aspect: hasImage ? imageWidth / imageHeight : reference.width / reference.height,
    height: hasImage ? transform.imageBounds.h : reference.height,
  };
}

/** First-quadrant boundary of the circle inset, with fixed bounded solves. */
function insetBoundary(a, b, radius, tolerance) {
  if (radius > Math.min(a, b) + tolerance) return () => -Infinity;
  const r = Math.min(radius, a, b);
  if (a === b) return y => Math.abs(y) <= a - r + tolerance
    ? Math.sqrt(Math.max(0, (a - r) ** 2 - Math.min(Math.abs(y), a - r) ** 2)) : -Infinity;
  const major = Math.max(a, b), minor = Math.min(a, b), swapped = a < b;
  if (r === minor) return y => Math.abs(y) <= tolerance ? 0 : -Infinity;
  const q = theta => Math.hypot(minor * Math.cos(theta), major * Math.sin(theta));
  const bisect = (lo, hi, greater) => {
    for (let i = 0; i < 64; i++) {
      const mid = (lo + hi) / 2;
      if (mid === lo || mid === hi) break;
      if (greater(mid)) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  };
  // Above the cusp threshold the retained curve starts at the POSITIVE root.
  const theta0 = r <= minor * minor / major ? 0
    : bisect(0, Math.PI / 2, theta => q(theta) >= r * major / minor);
  const point = theta => {
    const cosine = Math.cos(theta), sine = Math.sin(theta), normal = q(theta);
    return { x: major * cosine - r * minor * cosine / normal,
      y: minor * sine - r * major * sine / normal };
  };
  const xMax = point(theta0).x, yMax = minor - r;
  return fixed => {
    const value = Math.abs(fixed), max = swapped ? xMax : yMax;
    if (value > max + tolerance) return -Infinity;
    if (!swapped && value <= tolerance) return xMax;
    if (swapped && value <= tolerance) return yMax;
    const target = Math.min(value, max);
    const theta = bisect(theta0, Math.PI / 2, t => swapped ? point(t).x <= target : point(t).y >= target);
    return Math.max(0, swapped ? point(theta).y : point(theta).x);
  };
}

function* signedIndices(lo, hi) {
  if (lo <= 0 && hi >= 0) yield 0;
  let negative = Math.max(1, -hi), positive = Math.max(1, lo);
  while (-negative >= lo || positive <= hi) {
    if (-negative >= lo && (positive > hi || negative <= positive)) yield -negative++;
    else yield positive++;
  }
}
const order = i => i === 0 ? 0 : i < 0 ? -2 * i - 1 : 2 * i;

/** Small merge heap: one lazy row iterator per narrow column, never per seat. */
class RowHeap {
  constructor() { this.items = []; }
  before(a, b) { return order(a.row) < order(b.row) || (a.row === b.row && order(a.col) < order(b.col)); }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(item, a[parent])) break;
      a[i] = a[parent]; i = parent;
    }
    a[i] = item;
  }
  pop() {
    const a = this.items, result = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (2 * i + 1 < a.length) {
        let child = 2 * i + 1;
        if (child + 1 < a.length && this.before(a[child + 1], a[child])) child++;
        if (!this.before(a[child], last)) break;
        a[i] = a[child]; i = child;
      }
      a[i] = last;
    }
    return result;
  }
}

/**
 * Materialise the first N seats, not the complete potentially enormous grid.
 * Narrow-axis intervals count exact capacity in O(N); narrow columns merge in
 * O(N log(N+1)). Otherwise a disc inside the inset guarantees N seats in the
 * first 2N+1 signed rows, even at the stored-coordinate bounds (C brief §3).
 * All lengths here are reference pixels. Circle containment uses one relative
 * tolerance; coordinate clipping is strict and never clamps/merges seats.
 */
export function packFinishArea(area, center, plane, dotSize, count) {
  const a = area.width * plane.aspect * plane.height / 2, b = area.height * plane.height / 2;
  const r = dotSize * DOT_BASE_RADIUS_PX, step = 2 * r * 1.25;
  const tolerance = 64 * Number.EPSILON * Math.max(1, a, b, r);
  const hasPlace = r <= Math.min(a, b) + tolerance;
  const places = [];
  if (!hasPlace || count === 0) return { places, capacity: hasPlace ? 1 : 0, exact: !hasPlace, hasPlace };
  const angle = area.turn * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle);
  const point = (col, row) => ({
    x: center.x + (col * step * cosine - row * step * sine) / (plane.aspect * plane.height),
    y: center.y + (col * step * sine + row * step * cosine) / plane.height,
  });
  const rowExtent = area.shape === 'ellipse' ? insetBoundary(a, b, r, tolerance)
    : y => Math.abs(y) <= b - r + tolerance ? Math.max(0, a - r) : -Infinity;
  const colExtent = area.shape === 'ellipse' ? insetBoundary(b, a, r, tolerance)
    : x => Math.abs(x) <= a - r + tolerance ? Math.max(0, b - r) : -Infinity;
  const interval = (fixed, columns) => {
    const extent = (columns ? colExtent : rowExtent)(fixed * step);
    if (extent < 0) return null;
    let lo = Math.ceil((-extent - tolerance) / step) - 1;
    let hi = Math.floor((extent + tolerance) / step) + 1;
    const shapeFits = index => columns
      ? Math.abs(fixed * step) <= rowExtent(index * step) + tolerance
      : Math.abs(index * step) <= rowExtent(fixed * step) + tolerance;
    while (lo <= hi && !shapeFits(lo)) lo++;
    while (hi >= lo && !shapeFits(hi)) hi--;
    // Each rotated-box inequality is monotone in the free integer index.
    // Solve its inclusive interval with bounded binary searches of the actual
    // normalised calculation. Near 90 degrees, dividing by cos(theta) loses
    // seats which round exactly onto the coordinate boundary; probing that
    // same calculation handles these without scanning a long empty interval.
    const lowerBound = (low, high, predicate) => {
      for (let i = 0; i < 64 && low < high; i++) {
        const mid = low + Math.floor((high - low) / 2);
        if (predicate(mid)) high = mid; else low = mid + 1;
      }
      return low;
    };
    for (const [axis, coefficient] of [['x', columns ? -sine : cosine], ['y', columns ? cosine : sine]]) {
      if (lo > hi) return null;
      const coordinate = index => (columns ? point(fixed, index) : point(index, fixed))[axis];
      const ascending = coefficient >= 0;
      const afterLow = index => ascending ? coordinate(index) >= IMAGE_COORDINATES.MIN
        : coordinate(index) <= IMAGE_COORDINATES.MAX;
      const pastHigh = index => ascending ? coordinate(index) > IMAGE_COORDINATES.MAX
        : coordinate(index) < IMAGE_COORDINATES.MIN;
      lo = lowerBound(lo, hi + 1, afterLow);
      hi = lowerBound(lo, hi + 1, pastHigh) - 1;
    }
    return lo <= hi ? { lo, hi } : null;
  };
  const k = Math.floor((Math.min(a, b) - r + tolerance) / step);
  if (k <= count) {
    const columns = a < b, heap = new RowHeap();
    let capacity = 0;
    for (const fixed of signedIndices(-Math.max(0, k + 1), Math.max(0, k + 1))) {
      const bounds = interval(fixed, columns);
      if (!bounds) continue;
      capacity += bounds.hi - bounds.lo + 1;
      const indices = signedIndices(bounds.lo, bounds.hi);
      if (columns) heap.push({ col: fixed, row: indices.next().value, indices });
      else for (const col of indices) {
        if (places.length === count) break;
        places.push(point(col, fixed));
      }
    }
    while (columns && heap.items.length && places.length < count) {
      const item = heap.pop();
      places.push(point(item.col, item.row));
      const next = item.indices.next();
      if (!next.done) { item.row = next.value; heap.push(item); }
    }
    return { places, capacity, exact: true, hasPlace };
  }
  for (const row of signedIndices(-count, count)) {
    const bounds = interval(row, false);
    if (!bounds) continue;
    for (const col of signedIndices(bounds.lo, bounds.hi)) {
      places.push(point(col, row));
      if (places.length === count) return { places, capacity: count, exact: false, hasPlace };
    }
  }
  throw new Error('Finish area packing failed its bounded-grid invariant.');
}
