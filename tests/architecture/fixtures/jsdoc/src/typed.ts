// STACK-07's plant: a type written inside a doc comment, which v4's lint must refuse (jsdoc/no-types).

/**
 * Halves a value.
 * @param {number} value the value to halve
 */
export function typed(value: number): number {
  return value / 2;
}
