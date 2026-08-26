import { describe, expect, test } from 'vitest';
import { assertSafeStoredColor, isSafeStoredColor } from '../src/utils/safeColor.js';

describe('persisted colour grammar', () => {
  test.each(['#123', '#1234', '#112233', '#11223344', '#D55E00'])('%s is accepted', color => {
    expect(isSafeStoredColor(color)).toBe(true);
    expect(() => assertSafeStoredColor(color, 'test colour')).not.toThrow();
  });

  test.each([
    'red',
    'rgb(1, 2, 3)',
    'var(--control-accent)',
    'url(https://example.invalid/probe)',
    '#12',
    '#12345g',
    '',
  ])('%s is rejected', color => {
    expect(isSafeStoredColor(color)).toBe(false);
    expect(() => assertSafeStoredColor(color, 'test colour')).toThrow(/hexadecimal colour/);
  });

  test('the exact transparent sentinel is opt-in for None-capable controls', () => {
    expect(isSafeStoredColor('transparent')).toBe(false);
    expect(isSafeStoredColor('transparent', { allowTransparent: true })).toBe(true);
    expect(() => assertSafeStoredColor(
      'transparent',
      'None-capable colour',
      { allowTransparent: true }
    )).not.toThrow();
    expect(isSafeStoredColor('Transparent', { allowTransparent: true })).toBe(false);
  });

  test('an omitted legacy field remains optional', () => {
    expect(() => assertSafeStoredColor(undefined, 'test colour')).not.toThrow();
    expect(() => assertSafeStoredColor(null, 'test colour')).not.toThrow();
  });
});
