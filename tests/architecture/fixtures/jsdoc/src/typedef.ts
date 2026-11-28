// STACK-07's plant: a type defined in a doc comment's @typedef, which v4's lint must refuse (jsdoc/check-tag-names).

/**
 * A point on the map.
 * @typedef {object} Point
 */

/** The origin, in map units. */
export const ORIGIN = { x: 0, y: 0 };
