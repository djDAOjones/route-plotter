import { describe, test, expect } from 'vitest';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { Emitter } from '../src/models/Emitter.js';
import { GraphModel } from '../src/models/GraphModel.js';

/** Build a layer with a small entry → exit graph and one emitter. */
function buildTestLayer() {
  const layer = new FlowLayer({ name: 'Test flow' });
  const entry = layer.graph.addNode({ x: 0.1, y: 0.5, type: 'entry' });
  const exit = layer.graph.addNode({ x: 0.9, y: 0.5, type: 'exit' });
  layer.graph.addEdge({ sourceId: entry.id, targetId: exit.id, weight: 2 });
  layer.addEmitter({ seed: 7, dotCount: 10 });
  return layer;
}

describe('FlowLayer', () => {

  describe('constructor', () => {
    test('should create with defaults: visible graph-guided layer, empty graph, no emitters', () => {
      const layer = new FlowLayer();
      expect(layer.id).toMatch(/^fl_/);
      expect(layer.name).toBe('Flow layer');
      expect(layer.visible).toBe(true);
      expect(layer.guideType).toBe('graph');
      expect(layer.graph).toBeInstanceOf(GraphModel);
      expect(layer.graph.getNodes()).toHaveLength(0);
      expect(layer.emitters).toHaveLength(0);
    });

    test('should adopt a GraphModel instance without copying', () => {
      const graph = new GraphModel();
      graph.addNode({ type: 'entry' });
      const layer = new FlowLayer({ graph });
      expect(layer.graph).toBe(graph);
      expect(layer.graph.getNodes()).toHaveLength(1);
    });

    test('should hydrate graph and emitters from plain data', () => {
      const layer = new FlowLayer({
        graph: { nodes: [{ id: 'n1', x: 0.2, y: 0.3, type: 'entry' }], edges: [] },
        emitters: [{ seed: 5, dotCount: 3 }],
      });
      expect(layer.graph.getNode('n1')).toBeDefined();
      expect(layer.emitters[0]).toBeInstanceOf(Emitter);
      expect(layer.emitters[0].seed).toBe(5);
      expect(layer.emitters[0].dotCount).toBe(3);
    });

    test('should fall back to graph guideType on invalid input and validate via setter', () => {
      expect(new FlowLayer({ guideType: 'nonsense' }).guideType).toBe('graph');
      const layer = new FlowLayer();
      layer.setGuideType('route');
      expect(layer.guideType).toBe('route');
      layer.setGuideType('bad');
      expect(layer.guideType).toBe('graph');
    });

    test('route-guided layer should still own its graph (switchable without loss)', () => {
      const layer = buildTestLayer();
      layer.setGuideType('route');
      expect(layer.graph.getNodes()).toHaveLength(2);
    });
  });

  describe('emitter CRUD', () => {
    test('addEmitter should create, append, and return the emitter', () => {
      const layer = new FlowLayer();
      const e = layer.addEmitter({ dotCount: 25 });
      expect(e).toBeInstanceOf(Emitter);
      expect(e.dotCount).toBe(25);
      expect(layer.getEmitters()).toHaveLength(1);
    });

    test('removeEmitter should remove by id and report a miss', () => {
      const layer = new FlowLayer();
      const e = layer.addEmitter();
      expect(layer.removeEmitter(e.id)).toBe(true);
      expect(layer.getEmitters()).toHaveLength(0);
      expect(layer.removeEmitter('em_missing')).toBe(false);
    });

    test('getEmitter should find by id; getEmitters should return a snapshot', () => {
      const layer = new FlowLayer();
      const e = layer.addEmitter();
      expect(layer.getEmitter(e.id)).toBe(e);
      const snapshot = layer.getEmitters();
      snapshot.pop();
      expect(layer.getEmitters()).toHaveLength(1);
    });
  });

  describe('serialisation', () => {
    test('toJSON/fromJSON round-trip should preserve graph, emitters, and layer fields', () => {
      const original = buildTestLayer();
      original.visible = false;
      original.setGuideType('route');

      const restored = FlowLayer.fromJSON(original.toJSON());
      expect(restored.toJSON()).toEqual(original.toJSON());
      expect(restored.name).toBe('Test flow');
      expect(restored.visible).toBe(false);
      expect(restored.guideType).toBe('route');
      expect(restored.graph.getNodes()).toHaveLength(2);
      expect(restored.graph.getEdges()).toHaveLength(1);
      expect(restored.emitters[0].seed).toBe(7);
    });

    test('fromJSON should tolerate missing collections', () => {
      const layer = FlowLayer.fromJSON({ name: 'Sparse' });
      expect(layer.graph.getNodes()).toHaveLength(0);
      expect(layer.emitters).toHaveLength(0);
    });
  });
});
