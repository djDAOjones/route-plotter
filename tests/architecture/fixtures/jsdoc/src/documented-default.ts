// STACK-07's legal case for a default export by reference: documented, so accepted.

/** A documented arrow function, made the default export by reference. */
const byDefault = (value: number): number => value + 3;

export default byDefault;
