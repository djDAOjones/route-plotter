// V31-APP-PACK starter — signed 2026-11-11 (P-fast-check): a property test beside the example test.
import fc from 'fast-check';
import { expect, it } from 'vitest';
import { apply, empty, type Item } from './model';

const item: fc.Arbitrary<Item> = fc.record({ id: fc.string(), label: fc.string() });

it('adding then removing any item leaves no item with its id', () => {
  fc.assert(
    fc.property(fc.array(item), item, (items, extra) => {
      const model = items.reduce((m, i) => apply(m, { kind: 'add', item: i }), empty);
      const after = apply(apply(model, { kind: 'add', item: extra }), { kind: 'remove', id: extra.id });
      expect(after.items.some((i) => i.id === extra.id)).toBe(false);
    }),
  );
});
