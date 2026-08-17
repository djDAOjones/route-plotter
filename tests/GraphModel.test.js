import { describe, test, expect } from 'vitest';
import { GraphModel } from '../src/models/GraphModel.js';

describe('GraphModel', () => {

  // ── Empty graph ─────────────────────────────────────

  test('new model should be empty', () => {
    const m = new GraphModel();
    expect(m.getNodes()).toEqual([]);
    expect(m.getEdges()).toEqual([]);
  });

  // ── Node CRUD ───────────────────────────────────────

  test('addNode should return a GraphNode and store it', () => {
    const m = new GraphModel();
    const n = m.addNode({ x: 0.1, y: 0.2, type: 'entry', label: 'A' });
    expect(n.id).toBeDefined();
    expect(n.x).toBe(0.1);
    expect(n.type).toBe('entry');
    expect(m.getNode(n.id)).toBe(n);
    expect(m.getNodes()).toHaveLength(1);
  });

  test('addNode with explicit id should preserve it', () => {
    const m = new GraphModel();
    const n = m.addNode({ id: 'fixed', x: 0, y: 0 });
    expect(n.id).toBe('fixed');
    expect(m.getNode('fixed')).toBe(n);
  });

  test('removeNode should return true and remove the node', () => {
    const m = new GraphModel();
    const n = m.addNode();
    expect(m.removeNode(n.id)).toBe(true);
    expect(m.getNode(n.id)).toBeUndefined();
    expect(m.getNodes()).toHaveLength(0);
  });

  test('removeNode should return false for unknown id', () => {
    const m = new GraphModel();
    expect(m.removeNode('nope')).toBe(false);
  });

  test('getNodesByType should filter correctly', () => {
    const m = new GraphModel();
    m.addNode({ type: 'entry' });
    m.addNode({ type: 'exit' });
    m.addNode({ type: 'normal' });
    m.addNode({ type: 'entry' });
    expect(m.getNodesByType('entry')).toHaveLength(2);
    expect(m.getNodesByType('exit')).toHaveLength(1);
    expect(m.getNodesByType('normal')).toHaveLength(1);
  });

  // ── Edge CRUD ───────────────────────────────────────

  test('addEdge should return a GraphEdge between existing nodes', () => {
    const m = new GraphModel();
    const a = m.addNode({ id: 'a' });
    const b = m.addNode({ id: 'b' });
    const e = m.addEdge({ sourceId: 'a', targetId: 'b', weight: 3 });
    expect(e.sourceId).toBe('a');
    expect(e.targetId).toBe('b');
    expect(e.weight).toBe(3);
    expect(m.getEdge(e.id)).toBe(e);
    expect(m.getEdges()).toHaveLength(1);
  });

  test('addEdge should throw if sourceId does not exist', () => {
    const m = new GraphModel();
    m.addNode({ id: 'b' });
    expect(() => m.addEdge({ sourceId: 'x', targetId: 'b' })).toThrow('sourceId');
  });

  test('addEdge should throw if targetId does not exist', () => {
    const m = new GraphModel();
    m.addNode({ id: 'a' });
    expect(() => m.addEdge({ sourceId: 'a', targetId: 'x' })).toThrow('targetId');
  });

  test('removeEdge should return true and remove the edge', () => {
    const m = new GraphModel();
    m.addNode({ id: 'a' });
    m.addNode({ id: 'b' });
    const e = m.addEdge({ sourceId: 'a', targetId: 'b' });
    expect(m.removeEdge(e.id)).toBe(true);
    expect(m.getEdge(e.id)).toBeUndefined();
    expect(m.getEdges()).toHaveLength(0);
  });

  test('removeEdge should return false for unknown id', () => {
    const m = new GraphModel();
    expect(m.removeEdge('nope')).toBe(false);
  });

  test('getEdgesForNode should return all connected edges', () => {
    const m = new GraphModel();
    m.addNode({ id: 'a' });
    m.addNode({ id: 'b' });
    m.addNode({ id: 'c' });
    m.addEdge({ sourceId: 'a', targetId: 'b' });
    m.addEdge({ sourceId: 'c', targetId: 'a' });
    m.addEdge({ sourceId: 'b', targetId: 'c' });

    const aEdges = m.getEdgesForNode('a');
    expect(aEdges).toHaveLength(2);
    expect(aEdges.every(e => e.sourceId === 'a' || e.targetId === 'a')).toBe(true);
  });

  test('getEdgesForNode for unconnected node returns empty', () => {
    const m = new GraphModel();
    m.addNode({ id: 'a' });
    m.addNode({ id: 'b' });
    m.addNode({ id: 'c' });
    m.addEdge({ sourceId: 'a', targetId: 'b' });
    expect(m.getEdgesForNode('c')).toHaveLength(0);
  });

  // ── Referential integrity ───────────────────────────

  test('removeNode should cascade-delete connected edges', () => {
    const m = new GraphModel();
    m.addNode({ id: 'a' });
    m.addNode({ id: 'b' });
    m.addNode({ id: 'c' });
    const e1 = m.addEdge({ sourceId: 'a', targetId: 'b' });
    const e2 = m.addEdge({ sourceId: 'b', targetId: 'c' });
    const e3 = m.addEdge({ sourceId: 'a', targetId: 'c' });

    m.removeNode('a');

    expect(m.getNodes()).toHaveLength(2);
    expect(m.getEdge(e1.id)).toBeUndefined(); // a→b gone
    expect(m.getEdge(e3.id)).toBeUndefined(); // a→c gone
    expect(m.getEdge(e2.id)).toBe(e2);        // b→c survives
    expect(m.getEdges()).toHaveLength(1);
  });

  test('removeNode with no edges should not affect other edges', () => {
    const m = new GraphModel();
    m.addNode({ id: 'a' });
    m.addNode({ id: 'b' });
    m.addNode({ id: 'c' });
    const e = m.addEdge({ sourceId: 'a', targetId: 'b' });

    m.removeNode('c');

    expect(m.getEdges()).toHaveLength(1);
    expect(m.getEdge(e.id)).toBe(e);
  });

  // ── toJSON / fromJSON round-trip ────────────────────

  test('toJSON should produce nodes and edges arrays', () => {
    const m = new GraphModel();
    m.addNode({ id: 'n1', x: 0.1, y: 0.2, type: 'entry', label: 'Start' });
    m.addNode({ id: 'n2', x: 0.9, y: 0.8 });
    m.addEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2', weight: 2 });

    const json = m.toJSON();
    expect(json.nodes).toHaveLength(2);
    expect(json.edges).toHaveLength(1);
    expect(json.nodes[0].id).toBe('n1');
    expect(json.edges[0].id).toBe('e1');
  });

  test('fromJSON should reconstruct an equivalent graph', () => {
    const m = new GraphModel();
    m.addNode({ id: 'n1', x: 0.1, y: 0.2, type: 'entry', label: 'A' });
    m.addNode({ id: 'n2', x: 0.9, y: 0.8, type: 'exit', label: 'B' });
    m.addEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2', weight: 4, direction: 'one-way' });

    const restored = GraphModel.fromJSON(m.toJSON());
    expect(restored.toJSON()).toEqual(m.toJSON());
  });

  test('fromJSON with empty object should produce empty graph', () => {
    const m = GraphModel.fromJSON({});
    expect(m.getNodes()).toHaveLength(0);
    expect(m.getEdges()).toHaveLength(0);
  });

  test('fromJSON should silently drop edges with dangling references', () => {
    const data = {
      nodes: [{ id: 'n1', x: 0.5, y: 0.5 }],
      edges: [
        { id: 'e1', sourceId: 'n1', targetId: 'n2', weight: 1 }, // n2 missing
        { id: 'e2', sourceId: 'gone', targetId: 'n1', weight: 1 }, // gone missing
      ],
    };
    const m = GraphModel.fromJSON(data);
    expect(m.getNodes()).toHaveLength(1);
    expect(m.getEdges()).toHaveLength(0);
  });

  test('fromJSON with no edges key should produce nodes only', () => {
    const data = { nodes: [{ id: 'n1' }, { id: 'n2' }] };
    const m = GraphModel.fromJSON(data);
    expect(m.getNodes()).toHaveLength(2);
    expect(m.getEdges()).toHaveLength(0);
  });

  // ── Snapshot isolation ──────────────────────────────

  test('getNodes returns a snapshot, not the live collection', () => {
    const m = new GraphModel();
    m.addNode({ id: 'a' });
    const snap = m.getNodes();
    m.addNode({ id: 'b' });
    expect(snap).toHaveLength(1);
    expect(m.getNodes()).toHaveLength(2);
  });

  test('getEdges returns a snapshot, not the live collection', () => {
    const m = new GraphModel();
    m.addNode({ id: 'a' });
    m.addNode({ id: 'b' });
    m.addEdge({ sourceId: 'a', targetId: 'b' });
    const snap = m.getEdges();
    m.addNode({ id: 'c' });
    m.addEdge({ sourceId: 'a', targetId: 'c' });
    expect(snap).toHaveLength(1);
    expect(m.getEdges()).toHaveLength(2);
  });

  // ── clear() ───────────────────────────────────────────

  test('clear should remove all nodes and edges', () => {
    const m = new GraphModel();
    m.addNode({ id: 'a', x: 0.1, y: 0.2 });
    m.addNode({ id: 'b', x: 0.3, y: 0.4 });
    m.addEdge({ sourceId: 'a', targetId: 'b' });
    expect(m.getNodes()).toHaveLength(2);
    expect(m.getEdges()).toHaveLength(1);

    m.clear();
    expect(m.getNodes()).toHaveLength(0);
    expect(m.getEdges()).toHaveLength(0);
  });

  // ── instance fromJSON ─────────────────────────────────

  test('instance fromJSON should replace existing data', () => {
    const m = new GraphModel();
    m.addNode({ id: 'old1', x: 0, y: 0 });
    m.addNode({ id: 'old2', x: 1, y: 1 });
    m.addEdge({ sourceId: 'old1', targetId: 'old2' });
    expect(m.getNodes()).toHaveLength(2);

    // Replace with new data
    m.fromJSON({
      nodes: [
        { id: 'new1', x: 0.5, y: 0.5, type: 'entry' },
        { id: 'new2', x: 0.6, y: 0.6, type: 'exit' },
        { id: 'new3', x: 0.7, y: 0.7 },
      ],
      edges: [
        { sourceId: 'new1', targetId: 'new2', weight: 3 },
      ],
    });

    expect(m.getNodes()).toHaveLength(3);
    expect(m.getEdges()).toHaveLength(1);
    expect(m.getNode('old1')).toBeUndefined();
    expect(m.getNode('new1').type).toBe('entry');
    expect(m.getEdges()[0].weight).toBe(3);
  });

  test('instance fromJSON with empty data should clear the model', () => {
    const m = new GraphModel();
    m.addNode({ id: 'a' });
    m.fromJSON({});
    expect(m.getNodes()).toHaveLength(0);
    expect(m.getEdges()).toHaveLength(0);
  });
});
