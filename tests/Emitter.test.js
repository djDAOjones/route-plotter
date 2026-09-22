import { describe, test, expect, vi } from 'vitest';
import { Emitter } from '../src/models/Emitter.js';

describe('Emitter', () => {

  describe('constructor defaults', () => {
    test('should create with founding-vocabulary defaults', () => {
      const e = new Emitter();
      expect(e.dotCount).toBe(50);
      expect(e.speed).toBe(0.15);
      expect(e.speedVariance).toBe(0.2);
      expect(e.dotSize).toBe(0.4);
      expect(e.dotColor).toBe('#E69F00');
      expect(e.lifecycleMode).toBe('respawn');
      expect(e.releaseStart).toBe(0);
      expect(e.releaseDuration).toBe(1);
      expect(e.onsetVariance).toBe(0.2);
      expect(e.intensityRamp).toBe(0);
      expect(e.busynessEnvelope).toEqual([
        { time: 0, value: 1, transition: 'gradual' },
        { time: 1, value: 1, transition: 'gradual' },
      ]);
      expect(e.wobble).toBe(0);
    });

    test('should auto-generate an id and a non-negative integer seed', () => {
      const e = new Emitter();
      expect(e.id).toMatch(/^em_/);
      expect(Number.isInteger(e.seed)).toBe(true);
      expect(e.seed).toBeGreaterThanOrEqual(0);
    });

    test('should accept custom options', () => {
      const e = new Emitter({
        dotCount: 200,
        speed: 0.5,
        lifecycleMode: 'disappear',
        releaseStart: 0.25,
        releaseDuration: 0.5,
        wobble: 0.3,
      });
      expect(e.dotCount).toBe(200);
      expect(e.speed).toBe(0.5);
      expect(e.lifecycleMode).toBe('disappear');
      expect(e.releaseStart).toBe(0.25);
      expect(e.releaseDuration).toBe(0.5);
      expect(e.wobble).toBe(0.3);
    });
  });

  describe('validation and clamping', () => {
    test('should clamp 0–1 fields', () => {
      expect(new Emitter({ speedVariance: -0.5 }).speedVariance).toBe(0);
      expect(new Emitter({ speedVariance: 2 }).speedVariance).toBe(1);
      expect(new Emitter({ onsetVariance: 5 }).onsetVariance).toBe(1);
      expect(new Emitter({ wobble: -1 }).wobble).toBe(0);
      expect(new Emitter({ releaseStart: 1.5 }).releaseStart).toBe(1);
      expect(new Emitter({ releaseDuration: -2 }).releaseDuration).toBe(0);
    });

    test('should clamp intensityRamp to -1–1', () => {
      expect(new Emitter({ intensityRamp: -3 }).intensityRamp).toBe(-1);
      expect(new Emitter({ intensityRamp: 3 }).intensityRamp).toBe(1);
      expect(new Emitter({ intensityRamp: 0.5 }).intensityRamp).toBe(0.5);
      expect(new Emitter({ intensityRamp: 'junk' }).intensityRamp).toBe(0);
    });

    test('should keep an overhanging release window as authored (engine clips)', () => {
      const e = new Emitter({ releaseStart: 0.8, releaseDuration: 0.9 });
      expect(e.releaseStart).toBe(0.8);
      expect(e.releaseDuration).toBe(0.9);
    });

    test('should force dotCount to a positive integer', () => {
      expect(new Emitter({ dotCount: 0 }).dotCount).toBe(1);
      expect(new Emitter({ dotCount: -10 }).dotCount).toBe(1);
      expect(new Emitter({ dotCount: 49.6 }).dotCount).toBe(50);
      expect(new Emitter({ dotCount: 'junk' }).dotCount).toBe(1);
    });

    test('should clamp speed and dotSize to positive minimums', () => {
      expect(new Emitter({ speed: 0 }).speed).toBe(0.001);
      expect(new Emitter({ speed: -5 }).speed).toBe(0.001);
      expect(new Emitter({ dotSize: 0 }).dotSize).toBe(0.01);
    });

    test('should reject invalid lifecycle mode', () => {
      expect(new Emitter({ lifecycleMode: 'invalid' }).lifecycleMode).toBe('respawn');
      expect(new Emitter({ lifecycleMode: 'loop' }).lifecycleMode).toBe('loop');
      expect(new Emitter({ lifecycleMode: 'collect' }).lifecycleMode).toBe('collect');
    });

    test('should reject a non-string dotColor', () => {
      expect(new Emitter({ dotColor: 42 }).dotColor).toBe('#E69F00');
    });

    test('should floor a fractional seed and replace an unusable one', () => {
      expect(new Emitter({ seed: 123.9 }).seed).toBe(123);
      const e = new Emitter({ seed: -1 });
      expect(Number.isInteger(e.seed)).toBe(true);
      expect(e.seed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('update', () => {
    test('should validate updated fields like the constructor', () => {
      const e = new Emitter();
      e.update({ speedVariance: 9, lifecycleMode: 'nope', dotCount: -2 });
      expect(e.speedVariance).toBe(1);
      expect(e.lifecycleMode).toBe('respawn');
      expect(e.dotCount).toBe(1);
    });

    test('should leave unsupplied fields untouched and never change id', () => {
      const e = new Emitter({ speed: 0.3 });
      const id = e.id;
      e.update({ wobble: 0.5, id: 'em_hijack' });
      expect(e.speed).toBe(0.3);
      expect(e.wobble).toBe(0.5);
      expect(e.id).toBe(id);
    });
  });

  describe('reseed', () => {
    test('should replace the seed with a fresh non-negative integer', () => {
      const e = new Emitter({ seed: 42 });
      const next = e.reseed();
      expect(next).toBe(e.seed);
      expect(Number.isInteger(e.seed)).toBe(true);
      expect(e.seed).toBeGreaterThanOrEqual(0);
    });

    test('always produces a different seed when the random draw collides', () => {
      const e = new Emitter({ seed: 42 });
      const random = vi.spyOn(Math, 'random').mockReturnValue(42 / 0xFFFFFFFF);
      try {
        expect(e.reseed()).toBe(43);
      } finally {
        random.mockRestore();
      }
    });
  });

  describe('serialisation', () => {
    test('toJSON/fromJSON round-trip should preserve every field', () => {
      const original = new Emitter({
        seed: 987654,
        dotCount: 123,
        speed: 0.25,
        speedVariance: 0.8,
        dotSize: 0.6,
        dotColor: '#0072B2',
        lifecycleMode: 'collect',
        releaseStart: 0.1,
        releaseDuration: 0.4,
        onsetVariance: 0.7,
        intensityRamp: -0.5,
        busynessEnvelope: [
          { time: 0, value: 0.1, transition: 'step' },
          { time: 0.5, value: 1, transition: 'gradual' },
          { time: 1, value: 0.2, transition: 'gradual' },
        ],
        wobble: 0.9,
      });
      const restored = Emitter.fromJSON(original.toJSON());
      expect(restored.toJSON()).toEqual(original.toJSON());
      expect(restored.seed).toBe(987654);
      expect(restored.lifecycleMode).toBe('collect');
      expect(restored.intensityRamp).toBe(-0.5);
      expect(restored.busynessEnvelope).toEqual(original.busynessEnvelope);
    });

    test('toJSON should carry no transient runtime state', () => {
      const json = new Emitter().toJSON();
      expect(Object.keys(json).sort()).toEqual([
        'busynessEnvelope', 'dotColor', 'dotCount', 'dotSize', 'id', 'intensityRamp',
        'lifecycleMode', 'onsetVariance', 'releaseDuration', 'releaseStart',
        'seed', 'speed', 'speedVariance', 'wobble',
      ]);
    });

    test('strictly rejects malformed persisted envelopes while old projects get the neutral default', () => {
      const oldProjectEmitter = Emitter.fromJSON({ seed: 1 });
      expect(oldProjectEmitter.busynessEnvelope).toEqual(new Emitter({ seed: 1 }).busynessEnvelope);

      expect(() => Emitter.fromJSON({ busynessEnvelope: [
        { time: 0, value: 1, transition: 'gradual' },
        { time: 0.5, value: 1, transition: 'gradual' },
        { time: 0.4, value: 1, transition: 'gradual' },
        { time: 1, value: 1, transition: 'gradual' },
      ] })).toThrow(/times must increase/);
    });
  });
});
