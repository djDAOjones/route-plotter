// V31-APP-PACK starter: the core is written test-first in Vitest (the test split, signed 2026-11-11). A property test with
// fast-check sits beside this one (signed 2026-11-11, P-fast-check).
import { describe, expect, it } from 'vitest';
import { apply, empty } from './model';

describe('apply', () => {
  it('adds an item once and removes it by id, leaving the input unchanged', () => {
    const item = { id: 'a', label: 'First' };
    const one = apply(empty, { kind: 'add', item });
    expect(one.items).toEqual([item]);
    expect(apply(one, { kind: 'add', item })).toBe(one);
    expect(apply(one, { kind: 'remove', id: 'a' }).items).toEqual([]);
    expect(empty.items).toEqual([]);
  });
});
