// STACK-07's legal case: each kind of export the rule covers, documented, so a rule that fires too widely fails.

/**
 * A documented function declaration, with untyped tags, which are accepted.
 * @param value The value to double.
 * @returns The value doubled.
 * @throws When the value is not finite.
 */
export function documented(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('not finite');
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

/** A documented arrow function, exported by reference. */
const byReference = (value: number): number => value + 1;

/** A documented function expression, exported by reference. */
const expression = function (value: number): number {
  return value + 2;
};

// Exported by reference, but not a function: its callback is not asked for, as one inside an exported object is not.
const HANDLERS = { onPick: (value: number): number => value };

export { byReference, expression, HANDLERS };
