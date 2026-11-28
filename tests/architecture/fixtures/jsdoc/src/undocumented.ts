// STACK-07's plant: an export with no doc comment, which v4's lint must refuse (jsdoc/require-jsdoc).
const half = 2;

export function planted(value: number): number {
  return value / half;
}
