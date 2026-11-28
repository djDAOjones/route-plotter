// STACK-07's plant: an arrow function exported by reference with no doc comment, which v4's lint must refuse
// (jsdoc/require-jsdoc).
const viaReference = (value: number): number => value + 1;

export { viaReference };
