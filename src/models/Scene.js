import { FlowLayer } from './FlowLayer.js';

export const SCENE_LIMITS = Object.freeze({
  MAX_FLOW_LAYERS: 32,
  MAX_EMITTERS_TOTAL: 256,
  MAX_DOTS_TOTAL: 20000,
  MAX_GRAPH_NODES_TOTAL: 10000,
  MAX_GRAPH_EDGES_TOTAL: 20000,
});

/**
 * Model owning the ordered flow layers of the layered scene. Pure data
 * model — no EventBus dependency.
 *
 * Layer order is render order: index 0 draws first (bottom), and every
 * flow layer draws beneath the hero route (the Waypoint chain), which is
 * not part of this model — it remains RoutePlotter's `waypoints` array.
 * The scene serialises additively into the coordVersion 9 project format;
 * a project without a scene block is simply an empty scene.
 */
export class Scene {
  constructor() {
    /** @type {FlowLayer[]} */
    this.flowLayers = [];
  }

  // ── FlowLayer CRUD ──────────────────────────────────

  /**
   * Create and append a flow layer (top of the flow stack, still beneath
   * the hero route).
   * @param {Object} [options={}] — Passed to the FlowLayer constructor.
   * @returns {FlowLayer} The created layer.
   */
  addFlowLayer(options = {}) {
    if (this.flowLayers.length >= SCENE_LIMITS.MAX_FLOW_LAYERS) {
      throw new Error(`A scene supports at most ${SCENE_LIMITS.MAX_FLOW_LAYERS} flow layers`);
    }
    const layer = new FlowLayer(options);
    this.flowLayers.push(layer);
    return layer;
  }

  /**
   * Remove a flow layer by id.
   * @param {string} id
   * @returns {boolean} True if the layer existed and was removed.
   */
  removeFlowLayer(id) {
    const index = this.flowLayers.findIndex(l => l.id === id);
    if (index === -1) return false;
    this.flowLayers.splice(index, 1);
    return true;
  }

  /**
   * @param {string} id
   * @returns {FlowLayer|undefined}
   */
  getFlowLayer(id) {
    return this.flowLayers.find(l => l.id === id);
  }

  /**
   * @returns {FlowLayer[]} All flow layers in render order (snapshot array).
   */
  getFlowLayers() {
    return [...this.flowLayers];
  }

  /**
   * Move a flow layer to a new position in the render order.
   * @param {string} id
   * @param {number} newIndex — Clamped to the valid range.
   * @returns {boolean} True if the layer existed and was moved.
   */
  moveFlowLayer(id, newIndex) {
    const index = this.flowLayers.findIndex(l => l.id === id);
    if (index === -1) return false;
    const clamped = Math.max(0, Math.min(this.flowLayers.length - 1, Math.round(Number(newIndex) || 0)));
    const [layer] = this.flowLayers.splice(index, 1);
    this.flowLayers.splice(clamped, 0, layer);
    return true;
  }

  // ── Bulk operations ─────────────────────────────────────

  /**
   * Remove all flow layers.
   */
  clear() {
    this.flowLayers = [];
  }

  /**
   * @returns {boolean} True if the scene has no flow layers.
   */
  isEmpty() {
    return this.flowLayers.length === 0;
  }

  // ── Serialisation ───────────────────────────────────────

  /**
   * Serialise the scene to a plain object.
   * @returns {{ flowLayers: Object[] }}
   */
  toJSON() {
    return {
      flowLayers: this.flowLayers.map(l => l.toJSON()),
    };
  }

  /**
   * Replace this scene's contents from serialised data (instance method).
   * Clears existing state first.
   * @param {Object} data — `{ flowLayers: [...] }`
   */
  fromJSON(data = {}) {
    const layers = Array.isArray(data.flowLayers) ? data.flowLayers : [];
    Scene.assertValidJSON({ flowLayers: layers });

    // Hydrate into a detached array first. A bad later layer must not leave an
    // existing Scene partially cleared or replaced.
    const stagedLayers = layers.map(ld => FlowLayer.fromJSON(ld));
    this.flowLayers = stagedLayers;
  }

  /**
   * Reconstruct a Scene from serialised data (static factory).
   * @param {Object} data — `{ flowLayers: [...] }`
   * @returns {Scene}
   */
  static fromJSON(data = {}) {
    const scene = new Scene();
    scene.fromJSON(data);
    return scene;
  }

  /**
   * Validate aggregate per-project scene budgets.
   * @param {Object} data
   * @throws {Error} If the scene is invalid or too expensive to render.
   */
  static assertValidJSON(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid scene: expected an object');
    }
    const layers = data.flowLayers ?? [];
    if (!Array.isArray(layers)) {
      throw new Error('Invalid scene flowLayers: expected an array');
    }
    if (layers.length > SCENE_LIMITS.MAX_FLOW_LAYERS) {
      throw new Error(`Scene flow-layer limit is ${SCENE_LIMITS.MAX_FLOW_LAYERS}`);
    }

    const layerIds = new Set();
    let emitterCount = 0;
    let dotCount = 0;
    let nodeCount = 0;
    let edgeCount = 0;

    for (const layer of layers) {
      FlowLayer.assertValidJSON(layer);
      if (layer.id != null) {
        if (typeof layer.id !== 'string' || layer.id.length === 0 || layerIds.has(layer.id)) {
          throw new Error('Invalid flow layer id: expected a unique non-empty string');
        }
        layerIds.add(layer.id);
      }
      const emitters = layer.emitters ?? [];
      emitterCount += emitters.length;
      for (const emitter of emitters) {
        dotCount += Number(emitter.dotCount ?? 50);
      }
      nodeCount += (layer.graph?.nodes ?? []).length;
      edgeCount += (layer.graph?.edges ?? []).length;
    }

    if (emitterCount > SCENE_LIMITS.MAX_EMITTERS_TOTAL) {
      throw new Error(`Scene emitter limit is ${SCENE_LIMITS.MAX_EMITTERS_TOTAL}`);
    }
    if (dotCount > SCENE_LIMITS.MAX_DOTS_TOTAL) {
      throw new Error(`Scene dot budget is ${SCENE_LIMITS.MAX_DOTS_TOTAL}`);
    }
    if (nodeCount > SCENE_LIMITS.MAX_GRAPH_NODES_TOTAL) {
      throw new Error(`Scene graph-node limit is ${SCENE_LIMITS.MAX_GRAPH_NODES_TOTAL}`);
    }
    if (edgeCount > SCENE_LIMITS.MAX_GRAPH_EDGES_TOTAL) {
      throw new Error(`Scene graph-edge limit is ${SCENE_LIMITS.MAX_GRAPH_EDGES_TOTAL}`);
    }
  }
}
