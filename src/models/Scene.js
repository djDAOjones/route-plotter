import { FlowLayer } from './FlowLayer.js';

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
    this.clear();
    const layers = Array.isArray(data.flowLayers) ? data.flowLayers : [];
    for (const ld of layers) {
      this.addFlowLayer(ld);
    }
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
}
