/**
 * The one rule for where a stored point may sit (DEF-03).
 *
 * Load checks waypoints and polygon vertices against it, and the authoring
 * paths that can leave the image stop at it, so a point the UI can place is
 * always a point a project can reopen. The range is `IMAGE_COORDINATES`.
 */

import { IMAGE_COORDINATES } from '../config/constants.js';

/**
 * True for a normalised image coordinate a project may store.
 * @param {*} value
 * @returns {boolean}
 */
export function isImageCoordinateInRange(value) {
  return typeof value === 'number' && Number.isFinite(value) &&
    value >= IMAGE_COORDINATES.MIN && value <= IMAGE_COORDINATES.MAX;
}

/**
 * Pull an authored coordinate back inside the range load accepts.
 * @param {number} value
 * @returns {number}
 */
export function clampImageCoordinate(value) {
  return Math.max(IMAGE_COORDINATES.MIN, Math.min(IMAGE_COORDINATES.MAX, value));
}
