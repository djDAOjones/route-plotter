// STACK-07's legal case: each kind of export the rule covers, documented, so a rule that fires too widely fails.

/** A documented function declaration. */
export function documented(value: number): number {
  return value * 2;
}

/** A documented arrow function, exported as a const; the callbacks inside an exported object need none. */
export const arrow = (value: number): number => [value].map((entry) => entry + 1).reduce((a, b) => a + b, 0);

/** A documented class; its methods are covered by this comment. */
export class Documented {
  twice(value: number): number {
    return value * 2;
  }
}

function inside(): number {
  return 1;
}

/** Not a function, so the rule asks nothing of it; its private helper is not exported. */
export const TABLE = { inside: () => inside() };
