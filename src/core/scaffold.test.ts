// STACK-02: the core is written test-first in Vitest (the pack's test split, signed 2026-11-11), with a fast-check
// property beside it.
import { describe, expect, it } from 'vitest';
import { clamp } from './scaffold';

describe('clamp', () => {
  it('holds a value within its bounds and leaves one inside them unchanged', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(clamp(Number.NaN, 0, 10)).toBeNaN();
  });
});
