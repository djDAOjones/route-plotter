import { describe, test, expect } from 'vitest';
import { GraphEdge } from '../src/models/GraphEdge.js';

describe('GraphEdge', () => {

  // ── Construction ────────────────────────────────────

  test('should create with required ids and sensible defaults', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b' });
    expect(edge.id).toMatch(/^ge_/);
    expect(edge.sourceId).toBe('a');
    expect(edge.targetId).toBe('b');
    expect(edge.weight).toBe(1);
    expect(edge.direction).toBe('two-way');
    expect(edge.controlPoints).toEqual([]);
  });

  test('should accept all options', () => {
    const edge = new GraphEdge({
      id: 'e-1',
      sourceId: 'n1',
      targetId: 'n2',
      weight: 5,
      direction: 'one-way',
      controlPoints: [{ x: 0.3, y: 0.7 }],
    });
    expect(edge.id).toBe('e-1');
    expect(edge.weight).toBe(5);
    expect(edge.direction).toBe('one-way');
    expect(edge.controlPoints).toEqual([{ x: 0.3, y: 0.7 }]);
  });

  // ── Required sourceId / targetId ────────────────────

  test('should throw if sourceId is missing', () => {
    expect(() => new GraphEdge({ targetId: 'b' })).toThrow('sourceId');
  });

  test('should throw if targetId is missing', () => {
    expect(() => new GraphEdge({ sourceId: 'a' })).toThrow('targetId');
  });

  test('should throw if both ids are missing', () => {
    expect(() => new GraphEdge()).toThrow();
  });

  // ── Weight validation ───────────────────────────────

  test('should clamp weight to minimum for zero', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b', weight: 0 });
    expect(edge.weight).toBe(0.01);
  });

  test('should clamp weight to minimum for negative', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b', weight: -5 });
    expect(edge.weight).toBe(0.01);
  });

  test('should clamp weight to minimum for NaN', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b', weight: NaN });
    expect(edge.weight).toBe(0.01);
  });

  test('should accept large weight', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b', weight: 1000 });
    expect(edge.weight).toBe(1000);
  });

  // ── Direction validation ────────────────────────────

  test('should fall back to two-way for invalid direction', () => {
    expect(new GraphEdge({ sourceId: 'a', targetId: 'b', direction: 'bogus' }).direction).toBe('two-way');
    expect(new GraphEdge({ sourceId: 'a', targetId: 'b', direction: '' }).direction).toBe('two-way');
    expect(new GraphEdge({ sourceId: 'a', targetId: 'b', direction: null }).direction).toBe('two-way');
  });

  // ── setWeight ───────────────────────────────────────

  test('setWeight should update and clamp', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b' });
    edge.setWeight(3);
    expect(edge.weight).toBe(3);
    edge.setWeight(-1);
    expect(edge.weight).toBe(0.01);
    edge.setWeight(NaN);
    expect(edge.weight).toBe(0.01);
  });

  // ── setDirection ────────────────────────────────────

  test('setDirection should update and validate', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b' });
    expect(edge.direction).toBe('two-way');
    edge.setDirection('one-way');
    expect(edge.direction).toBe('one-way');
    edge.setDirection('invalid');
    expect(edge.direction).toBe('two-way');
  });

  // ── Control points ──────────────────────────────────

  test('addControlPoint should append and return index', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b' });
    const idx = edge.addControlPoint(0.2, 0.8);
    expect(idx).toBe(0);
    expect(edge.controlPoints).toEqual([{ x: 0.2, y: 0.8 }]);
    const idx2 = edge.addControlPoint(0.5, 0.5);
    expect(idx2).toBe(1);
    expect(edge.controlPoints.length).toBe(2);
  });

  test('addControlPoint should clamp coordinates', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b' });
    edge.addControlPoint(-1, 2);
    expect(edge.controlPoints[0]).toEqual({ x: 0, y: 1 });
  });

  test('addControlPoint should handle NaN gracefully', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b' });
    edge.addControlPoint(NaN, 'abc');
    expect(edge.controlPoints[0]).toEqual({ x: 0.5, y: 0.5 });
  });

  test('removeControlPoint should remove by index and return true', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b' });
    edge.addControlPoint(0.1, 0.1);
    edge.addControlPoint(0.9, 0.9);
    expect(edge.removeControlPoint(0)).toBe(true);
    expect(edge.controlPoints).toEqual([{ x: 0.9, y: 0.9 }]);
  });

  test('removeControlPoint should return false for out-of-range index', () => {
    const edge = new GraphEdge({ sourceId: 'a', targetId: 'b' });
    expect(edge.removeControlPoint(0)).toBe(false);
    expect(edge.removeControlPoint(-1)).toBe(false);
  });

  test('constructor should clamp control points from options', () => {
    const edge = new GraphEdge({
      sourceId: 'a',
      targetId: 'b',
      controlPoints: [{ x: -1, y: 2 }, { x: NaN, y: 0.5 }],
    });
    expect(edge.controlPoints[0]).toEqual({ x: 0, y: 1 });
    expect(edge.controlPoints[1]).toEqual({ x: 0.5, y: 0.5 });
  });

  // ── toJSON / fromJSON round-trip ────────────────────

  test('toJSON should return a plain object with all properties', () => {
    const edge = new GraphEdge({
      id: 'rt-e1',
      sourceId: 'n1',
      targetId: 'n2',
      weight: 3.5,
      direction: 'one-way',
      controlPoints: [{ x: 0.4, y: 0.6 }],
    });
    expect(edge.toJSON()).toEqual({
      id: 'rt-e1',
      sourceId: 'n1',
      targetId: 'n2',
      weight: 3.5,
      direction: 'one-way',
      controlPoints: [{ x: 0.4, y: 0.6 }],
    });
  });

  test('fromJSON should reconstruct an equivalent edge', () => {
    const original = new GraphEdge({
      id: 'rt-e2',
      sourceId: 'a',
      targetId: 'b',
      weight: 7,
      direction: 'one-way',
      controlPoints: [{ x: 0.1, y: 0.9 }],
    });
    const restored = GraphEdge.fromJSON(original.toJSON());
    expect(restored.toJSON()).toEqual(original.toJSON());
  });

  test('fromJSON should apply fallback defaults for optional fields', () => {
    const edge = GraphEdge.fromJSON({ sourceId: 's', targetId: 't' });
    expect(edge.sourceId).toBe('s');
    expect(edge.targetId).toBe('t');
    expect(edge.weight).toBe(1);
    expect(edge.direction).toBe('two-way');
    expect(edge.controlPoints).toEqual([]);
    expect(edge.id).toMatch(/^ge_/);
  });

  test('fromJSON should still throw if sourceId or targetId missing', () => {
    expect(() => GraphEdge.fromJSON({ sourceId: 'a' })).toThrow('targetId');
    expect(() => GraphEdge.fromJSON({})).toThrow('sourceId');
  });

  // ── Unique IDs ──────────────────────────────────────

  test('auto-generated IDs should be unique', () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => new GraphEdge({ sourceId: 'a', targetId: 'b' }).id)
    );
    expect(ids.size).toBe(50);
  });
});
