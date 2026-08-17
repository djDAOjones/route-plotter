import { describe, test, expect } from 'vitest';
import { SimulationState } from '../src/models/SimulationState.js';

describe('SimulationState', () => {

  test('should create with sensible defaults', () => {
    const s = new SimulationState();
    expect(s.dotCount).toBe(50);
    expect(s.releasePeriod).toBe(3000);
    expect(s.speed).toBe(0.15);
    expect(s.speedVariance).toBe(0.2);
    expect(s.dotSize).toBe(0.4);
    expect(s.dotColor).toBe('#E69F00');
    expect(s.lifecycleMode).toBe('respawn');
    expect(s.isPlaying).toBe(false);
    expect(s.elapsedTime).toBe(0);
  });

  test('should accept custom options', () => {
    const s = new SimulationState({
      dotCount: 100,
      speed: 0.3,
      lifecycleMode: 'disappear',
    });
    expect(s.dotCount).toBe(100);
    expect(s.speed).toBe(0.3);
    expect(s.lifecycleMode).toBe('disappear');
  });

  test('should clamp speedVariance to 0–1', () => {
    expect(new SimulationState({ speedVariance: -0.5 }).speedVariance).toBe(0);
    expect(new SimulationState({ speedVariance: 2.0 }).speedVariance).toBe(1);
    expect(new SimulationState({ speedVariance: 0.5 }).speedVariance).toBe(0.5);
  });

  test('should reject invalid lifecycle mode', () => {
    const s = new SimulationState({ lifecycleMode: 'invalid' });
    expect(s.lifecycleMode).toBe('respawn'); // fallback to default
  });

  test('toJSON should exclude transient state', () => {
    const s = new SimulationState();
    s.isPlaying = true;
    s.elapsedTime = 5000;
    const json = s.toJSON();
    expect(json.isPlaying).toBeUndefined();
    expect(json.elapsedTime).toBeUndefined();
    expect(json.dotCount).toBe(50);
  });

  test('instance fromJSON should restore parameters and reset transient', () => {
    const s = new SimulationState();
    s.isPlaying = true;
    s.elapsedTime = 9999;
    s.fromJSON({
      dotCount: 200,
      speed: 0.5,
      lifecycleMode: 'loop',
    });
    expect(s.dotCount).toBe(200);
    expect(s.speed).toBe(0.5);
    expect(s.lifecycleMode).toBe('loop');
    expect(s.isPlaying).toBe(false);
    expect(s.elapsedTime).toBe(0);
  });

  test('static fromJSON should create a new instance', () => {
    const s = SimulationState.fromJSON({ dotCount: 75, dotColor: '#FF0000' });
    expect(s).toBeInstanceOf(SimulationState);
    expect(s.dotCount).toBe(75);
    expect(s.dotColor).toBe('#FF0000');
  });

  test('toJSON/fromJSON round-trip should preserve all persistent fields', () => {
    const original = new SimulationState({
      dotCount: 123,
      releasePeriod: 5000,
      speed: 0.25,
      speedVariance: 0.8,
      dotSize: 0.6,
      dotColor: '#00FF00',
      lifecycleMode: 'collect',
    });
    const json = original.toJSON();
    const restored = SimulationState.fromJSON(json);
    expect(restored.dotCount).toBe(123);
    expect(restored.releasePeriod).toBe(5000);
    expect(restored.speed).toBe(0.25);
    expect(restored.speedVariance).toBe(0.8);
    expect(restored.dotSize).toBe(0.6);
    expect(restored.dotColor).toBe('#00FF00');
    expect(restored.lifecycleMode).toBe('collect');
  });

  test('reset should clear playback state', () => {
    const s = new SimulationState();
    s.isPlaying = true;
    s.elapsedTime = 3000;
    s.reset();
    expect(s.isPlaying).toBe(false);
    expect(s.elapsedTime).toBe(0);
    // Parameters should be unchanged
    expect(s.dotCount).toBe(50);
  });
});
