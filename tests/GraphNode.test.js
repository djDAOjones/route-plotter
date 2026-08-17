import { describe, test, expect } from 'vitest';
import { GraphNode } from '../src/models/GraphNode.js';

describe('GraphNode', () => {

  // ── Construction ────────────────────────────────────

  test('should create with sensible defaults', () => {
    const node = new GraphNode();
    expect(node.id).toBeDefined();
    expect(node.id).toMatch(/^gn_/);
    expect(node.x).toBe(0.5);
    expect(node.y).toBe(0.5);
    expect(node.type).toBe('normal');
    expect(node.label).toBe('');
  });

  test('should accept all options', () => {
    const node = new GraphNode({
      id: 'test-1',
      x: 0.2,
      y: 0.8,
      type: 'entry',
      label: 'Start',
    });
    expect(node.id).toBe('test-1');
    expect(node.x).toBe(0.2);
    expect(node.y).toBe(0.8);
    expect(node.type).toBe('entry');
    expect(node.label).toBe('Start');
  });

  test('should accept exit type', () => {
    const node = new GraphNode({ type: 'exit' });
    expect(node.type).toBe('exit');
  });

  // ── Type validation ─────────────────────────────────

  test('should fall back to normal for invalid type', () => {
    expect(new GraphNode({ type: 'bogus' }).type).toBe('normal');
    expect(new GraphNode({ type: '' }).type).toBe('normal');
    expect(new GraphNode({ type: undefined }).type).toBe('normal');
    expect(new GraphNode({ type: null }).type).toBe('normal');
    expect(new GraphNode({ type: 42 }).type).toBe('normal');
  });

  // ── Coordinate clamping ─────────────────────────────

  test('should clamp coordinates to 0–1 on construction', () => {
    const node = new GraphNode({ x: -0.5, y: 1.5 });
    expect(node.x).toBe(0);
    expect(node.y).toBe(1);
  });

  test('should handle NaN coordinates gracefully', () => {
    const node = new GraphNode({ x: NaN, y: 'abc' });
    expect(node.x).toBe(0.5);
    expect(node.y).toBe(0.5);
  });

  // ── moveTo ──────────────────────────────────────────

  test('moveTo should update and clamp coordinates', () => {
    const node = new GraphNode({ x: 0.5, y: 0.5 });
    node.moveTo(0.1, 0.9);
    expect(node.x).toBe(0.1);
    expect(node.y).toBe(0.9);
  });

  test('moveTo should clamp out-of-range values', () => {
    const node = new GraphNode();
    node.moveTo(-1, 2);
    expect(node.x).toBe(0);
    expect(node.y).toBe(1);
  });

  test('moveTo should handle NaN gracefully', () => {
    const node = new GraphNode({ x: 0.3, y: 0.7 });
    node.moveTo(NaN, undefined);
    expect(node.x).toBe(0.5);
    expect(node.y).toBe(0.5);
  });

  // ── toJSON / fromJSON round-trip ────────────────────

  test('toJSON should return a plain object with all properties', () => {
    const node = new GraphNode({
      id: 'rt-1',
      x: 0.25,
      y: 0.75,
      type: 'exit',
      label: 'Finish',
    });
    const json = node.toJSON();
    expect(json).toEqual({
      id: 'rt-1',
      x: 0.25,
      y: 0.75,
      type: 'exit',
      label: 'Finish',
    });
  });

  test('fromJSON should reconstruct an equivalent node', () => {
    const original = new GraphNode({
      id: 'rt-2',
      x: 0.1,
      y: 0.9,
      type: 'entry',
      label: 'Gate A',
    });
    const restored = GraphNode.fromJSON(original.toJSON());
    expect(restored.toJSON()).toEqual(original.toJSON());
  });

  test('fromJSON should apply fallback defaults for missing fields', () => {
    const node = GraphNode.fromJSON({ id: 'sparse' });
    expect(node.id).toBe('sparse');
    expect(node.x).toBe(0.5);
    expect(node.y).toBe(0.5);
    expect(node.type).toBe('normal');
    expect(node.label).toBe('');
  });

  test('fromJSON with empty object should produce valid defaults', () => {
    const node = GraphNode.fromJSON({});
    expect(node.id).toMatch(/^gn_/);
    expect(node.x).toBe(0.5);
    expect(node.y).toBe(0.5);
    expect(node.type).toBe('normal');
    expect(node.label).toBe('');
  });

  // ── Unique IDs ──────────────────────────────────────

  test('auto-generated IDs should be unique', () => {
    const ids = new Set(Array.from({ length: 50 }, () => new GraphNode().id));
    expect(ids.size).toBe(50);
  });
});
