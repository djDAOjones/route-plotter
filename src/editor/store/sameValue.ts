// CORE-05: whether two of the store's values hold the same thing, so a gesture that ends where it began makes no undo
// step (v3's UndoService kept no duplicate state and kept Redo then, undoService.test "a duplicate save preserves redo").
// Lists and plain records compare by content, whatever the order of a record's keys; anything else by identity, so two
// copies of an image's bytes count as different and a step is kept: the safe side.

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Whether two of the store's values hold the same thing, so a gesture that ends where it began leaves no undo step. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }
  if (isPlainRecord(a) && isPlainRecord(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
  }
  return false;
}
