// STACK-07's plant: a function expression exported by reference with no doc comment, which v4's lint must refuse
// (jsdoc/require-jsdoc).
const viaReference = function (value: number): number {
  return value + 2;
};

export { viaReference };
