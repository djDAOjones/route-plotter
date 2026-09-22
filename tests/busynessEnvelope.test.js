import { describe, expect, test } from 'vitest';
import {
  assertValidBusynessEnvelope,
  busynessAt,
  compileBusynessEnvelope,
  defaultBusynessEnvelope,
  normalizeBusynessEnvelope,
  sampleBusynessEnvelope,
} from '../src/utils/busynessEnvelope.js';

describe('busyness envelope', () => {
  test('default envelope is neutral and returned as a fresh value', () => {
    const first = defaultBusynessEnvelope();
    const second = defaultBusynessEnvelope();
    expect(first).toEqual([
      { time: 0, value: 1, transition: 'gradual' },
      { time: 1, value: 1, transition: 'gradual' },
    ]);
    expect(first).not.toBe(second);
    expect(sampleBusynessEnvelope(compileBusynessEnvelope(first), 0.37)).toBeCloseTo(0.37);
  });

  test('gradual quiet-busy-quiet concentrates release around the midpoint', () => {
    const envelope = [
      { time: 0, value: 0, transition: 'gradual' },
      { time: 0.5, value: 1, transition: 'gradual' },
      { time: 1, value: 0, transition: 'gradual' },
    ];
    const compiled = compileBusynessEnvelope(envelope);
    expect(sampleBusynessEnvelope(compiled, 0.25)).toBeCloseTo(Math.sqrt(0.125), 5);
    expect(sampleBusynessEnvelope(compiled, 0.5)).toBeCloseTo(0.5, 5);
    expect(sampleBusynessEnvelope(compiled, 0.75)).toBeCloseTo(1 - Math.sqrt(0.125), 5);
  });

  test('a sudden span holds its value until the boundary', () => {
    const envelope = [
      { time: 0, value: 0.2, transition: 'step' },
      { time: 0.5, value: 1, transition: 'gradual' },
      { time: 1, value: 1, transition: 'gradual' },
    ];
    expect(busynessAt(envelope, 0.49)).toBe(0.2);
    expect(busynessAt(envelope, 0.5)).toBe(0.2);
    expect(sampleBusynessEnvelope(compileBusynessEnvelope(envelope), 0.05)).toBeCloseTo(0.15);
  });

  test('normalization orders, clamps, completes endpoints and rejects no-area input', () => {
    expect(normalizeBusynessEnvelope([
      { time: 0.8, value: 2, transition: 'nope' },
      { time: 0.2, value: 0.5, transition: 'step' },
    ])).toEqual([
      { time: 0, value: 0.5, transition: 'gradual' },
      { time: 0.2, value: 0.5, transition: 'step' },
      { time: 0.8, value: 1, transition: 'gradual' },
      { time: 1, value: 1, transition: 'gradual' },
    ]);
    expect(normalizeBusynessEnvelope([
      { time: 0, value: 0, transition: 'step' },
      { time: 1, value: 0, transition: 'gradual' },
    ])).toEqual(defaultBusynessEnvelope());
  });

  test('strict persistence validation rejects bad order, endpoints, transitions and empty area', () => {
    expect(() => assertValidBusynessEnvelope(defaultBusynessEnvelope())).not.toThrow();
    expect(() => assertValidBusynessEnvelope([
      { time: 0.2, value: 1, transition: 'gradual' },
      { time: 1, value: 1, transition: 'gradual' },
    ])).toThrow(/endpoints/);
    expect(() => assertValidBusynessEnvelope([
      { time: 0, value: 1, transition: 'gradual' },
      { time: 0, value: 1, transition: 'gradual' },
    ])).toThrow(/increase/);
    expect(() => assertValidBusynessEnvelope([
      { time: 0, value: 1, transition: 'curve' },
      { time: 1, value: 1, transition: 'gradual' },
    ])).toThrow(/transition/);
    expect(() => assertValidBusynessEnvelope([
      { time: 0, value: 0, transition: 'step' },
      { time: 1, value: 0, transition: 'gradual' },
    ])).toThrow(/at least one span/);
  });
});
