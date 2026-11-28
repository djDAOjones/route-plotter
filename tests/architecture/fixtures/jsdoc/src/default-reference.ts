// STACK-07's plant: an arrow function made the default export by reference with no doc comment, which v4's lint must
// refuse (jsdoc/require-jsdoc).
const byDefault = (value: number): number => value + 3;

export default byDefault;
