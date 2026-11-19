// CORE-02: a checked read of a list's entry, for indices the caller has already bounded. A miss is a fault in the
// caller, so it throws rather than letting `undefined` flow on as a point or a number.

export function item<T>(list: ArrayLike<T>, index: number): T {
  const value = list[index];
  if (value === undefined) throw new RangeError(`No entry at ${index} of ${list.length}`);
  return value;
}
