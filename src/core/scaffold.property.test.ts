// STACK-02: a property test beside the example test (the pack's P-fast-check, signed 2026-11-11).
import fc from 'fast-check';
import { expect, it } from 'vitest';
import { clamp } from './scaffold';

it('any number clamped into any bounds lands within them, and clamping twice changes nothing', () => {
  const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
  fc.assert(
    fc.property(finite, finite, finite, (value, a, b) => {
      const [min, max] = a <= b ? [a, b] : [b, a];
      const once = clamp(value, min, max);
      expect(once).toBeGreaterThanOrEqual(min);
      expect(once).toBeLessThanOrEqual(max);
      expect(clamp(once, min, max)).toBe(once);
    }),
  );
});
