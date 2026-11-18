import { describe, test, expect } from 'vitest';
import { Scene } from '../src/models/Scene.js';
import { FlowLayer } from '../src/models/FlowLayer.js';

/** Build a scene with two named layers, the first carrying a graph + emitter. */
function buildTestScene() {
  const scene = new Scene();
  const back = scene.addFlowLayer({ name: 'Back crowd' });
  const entry = back.graph.addNode({ x: 0.1, y: 0.5, type: 'entry' });
  const exit = back.graph.addNode({ x: 0.9, y: 0.5, type: 'exit' });
  back.graph.addEdge({ sourceId: entry.id, targetId: exit.id });
  back.addEmitter({ seed: 11, dotCount: 20 });
  scene.addFlowLayer({ name: 'Front crowd' });
  return scene;
}

describe('Scene', () => {

  test('should start empty', () => {
    const scene = new Scene();
    expect(scene.isEmpty()).toBe(true);
    expect(scene.getFlowLayers()).toHaveLength(0);
  });

  describe('flow layer CRUD', () => {
    test('addFlowLayer should create, append, and return the layer', () => {
      const scene = new Scene();
      const layer = scene.addFlowLayer({ name: 'Crowd' });
      expect(layer).toBeInstanceOf(FlowLayer);
      expect(layer.name).toBe('Crowd');
      expect(scene.isEmpty()).toBe(false);
    });

    test('removeFlowLayer should remove by id and report a miss', () => {
      const scene = new Scene();
      const layer = scene.addFlowLayer();
      expect(scene.removeFlowLayer(layer.id)).toBe(true);
      expect(scene.isEmpty()).toBe(true);
      expect(scene.removeFlowLayer('fl_missing')).toBe(false);
    });

    test('getFlowLayer should find by id; getFlowLayers should return a snapshot', () => {
      const scene = new Scene();
      const layer = scene.addFlowLayer();
      expect(scene.getFlowLayer(layer.id)).toBe(layer);
      const snapshot = scene.getFlowLayers();
      snapshot.pop();
      expect(scene.getFlowLayers()).toHaveLength(1);
    });

    test('layers should keep insertion order (render order, bottom first)', () => {
      const scene = buildTestScene();
      expect(scene.getFlowLayers().map(l => l.name)).toEqual(['Back crowd', 'Front crowd']);
    });
  });

  describe('moveFlowLayer', () => {
    test('should reorder layers and clamp the target index', () => {
      const scene = buildTestScene();
      const [back] = scene.getFlowLayers();

      expect(scene.moveFlowLayer(back.id, 1)).toBe(true);
      expect(scene.getFlowLayers().map(l => l.name)).toEqual(['Front crowd', 'Back crowd']);

      expect(scene.moveFlowLayer(back.id, -5)).toBe(true);
      expect(scene.getFlowLayers()[0].name).toBe('Back crowd');

      expect(scene.moveFlowLayer(back.id, 99)).toBe(true);
      expect(scene.getFlowLayers()[1].name).toBe('Back crowd');
    });

    test('should report a miss for an unknown id', () => {
      expect(buildTestScene().moveFlowLayer('fl_missing', 0)).toBe(false);
    });
  });

  describe('clear', () => {
    test('should remove all layers', () => {
      const scene = buildTestScene();
      scene.clear();
      expect(scene.isEmpty()).toBe(true);
    });
  });

  describe('serialisation', () => {
    test('toJSON/fromJSON round-trip should preserve layers deeply and in order', () => {
      const original = buildTestScene();
      const restored = Scene.fromJSON(original.toJSON());

      expect(restored.toJSON()).toEqual(original.toJSON());
      expect(restored.getFlowLayers().map(l => l.name)).toEqual(['Back crowd', 'Front crowd']);
      const back = restored.getFlowLayers()[0];
      expect(back.graph.getNodes()).toHaveLength(2);
      expect(back.emitters[0].seed).toBe(11);
    });

    test('instance fromJSON should replace existing contents', () => {
      const scene = buildTestScene();
      scene.fromJSON({ flowLayers: [{ name: 'Only layer' }] });
      expect(scene.getFlowLayers().map(l => l.name)).toEqual(['Only layer']);
    });

    test('fromJSON should tolerate missing or invalid data', () => {
      expect(Scene.fromJSON().isEmpty()).toBe(true);
      expect(Scene.fromJSON({ flowLayers: 'junk' }).isEmpty()).toBe(true);
    });
  });
});
