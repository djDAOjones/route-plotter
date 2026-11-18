/**
 * CROWD-08: shared node-area data and image-plane geometry. Width and height
 * are image fractions; turns use the bitmap's proportions, never a viewport
 * or visual scaling. Finish packing supplies its own reference plane (C);
 * Entry sampling keeps its square no-image fallback (B).
 */
import { CROWD_AREA, IMAGE_COORDINATES } from '../config/constants.js';
import { clampImageCoordinate } from './imageCoordinates.js';

const SHAPES = new Set(['rectangle', 'ellipse']);

/** Strict additive load boundary; absence is the historical single node. */
export function assertCrowdArea(area) {
  if (area == null) return;
  if (typeof area !== 'object' || Array.isArray(area) || !SHAPES.has(area.shape)) {
    throw new Error('Invalid node area: choose Rectangle or Ellipse.');
  }
  for (const key of ['width', 'height']) {
    if (typeof area[key] !== 'number' || !Number.isFinite(area[key])
        || area[key] < CROWD_AREA.SIZE_MIN || area[key] > CROWD_AREA.SIZE_MAX) {
      throw new Error('Invalid node area ' + key + ': use 1–80% of the image.');
    }
  }
  if (typeof area.turn !== 'number' || !Number.isFinite(area.turn)
      || area.turn < CROWD_AREA.TURN_MIN || area.turn > CROWD_AREA.TURN_MAX) {
    throw new Error('Invalid node area turn: use -180–180 degrees.');
  }
}

/** Models and snapshots must not share a mutable area object. */
export function copyCrowdArea(area) {
  assertCrowdArea(area);
  return area == null ? null : { shape: area.shape, width: area.width, height: area.height, turn: area.turn };
}

export function createCrowdArea(shape = 'rectangle') {
  return copyCrowdArea({ shape, width: CROWD_AREA.SIZE_DEFAULT, height: CROWD_AREA.SIZE_DEFAULT, turn: 0 });
}

/** Without a bitmap, the fixed square plane keeps geometry independent of resizing. */
export function areaImageAspect(transform) {
  const width = transform?.imageWidth;
  const height = transform?.imageHeight;
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
    ? validAspect(width / height) : 1;
}

function validAspect(aspect) {
  return Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

/**
 * Local coordinates span -0.5…0.5. Rotate in image-height units, then return
 * to normalised image coordinates. The guide can use the unbounded outline;
 * sampling clips the centre-to-point ray to the common stored-point bounds.
 */
export function areaPoint(area, center, u, v, imageAspect = 1) {
  const aspect = validAspect(imageAspect);
  const angle = area.turn * Math.PI / 180;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const x = u * area.width * aspect, y = v * area.height;
  return { x: center.x + (x * cosine - y * sine) / aspect, y: center.y + x * sine + y * cosine };
}

/**
 * Uniform samples before clipping: sqrt(radius) is essential for an ellipse.
 * At the outer coordinate bounds, shrinking the ray preserves containment in
 * either convex shape. Clipped samples can coincide at the centre (MVP call).
 */
export function sampleCrowdArea(area, center, draws, imageAspect = 1) {
  let u = draws[0] - 0.5, v = draws[1] - 0.5;
  if (area.shape === 'ellipse') {
    const radius = Math.sqrt(draws[0]) / 2;
    const angle = draws[1] * 2 * Math.PI;
    u = radius * Math.cos(angle);
    v = radius * Math.sin(angle);
  }
  const point = areaPoint(area, center, u, v, imageAspect);
  const dx = point.x - center.x, dy = point.y - center.y;
  let fraction = 1;
  for (const [origin, delta] of [[center.x, dx], [center.y, dy]]) {
    if (delta > 0) fraction = Math.min(fraction, (IMAGE_COORDINATES.MAX - origin) / delta);
    else if (delta < 0) fraction = Math.min(fraction, (IMAGE_COORDINATES.MIN - origin) / delta);
  }
  return {
    x: clampImageCoordinate(center.x + dx * fraction),
    y: clampImageCoordinate(center.y + dy * fraction),
  };
}
