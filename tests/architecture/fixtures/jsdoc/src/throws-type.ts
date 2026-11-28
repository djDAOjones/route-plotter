// STACK-07's plant: a type written in a doc comment's @throws tag, which neither jsdoc/no-types nor
// jsdoc/check-tag-names sees and v4's lint must still refuse (jsdoc/no-restricted-syntax).

/**
 * Refuses a negative value.
 * @throws {RangeError} when the value is negative
 */
export function planted(value: number): number {
  if (value < 0) throw new RangeError('negative');
  return value;
}
