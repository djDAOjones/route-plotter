import { GraphModel } from './GraphModel.js';
import { Emitter } from './Emitter.js';

/**
 * Model representing one flow layer in the scene: a guide network plus the
 * emitters that release dots onto it. Pure data model — no EventBus
 * dependency.
 *
 * The guide is either the layer's own GraphModel (`guideType: 'graph'`) or
 * the hero route's waypoint chain reused as a guide (`guideType: 'route'`,
 * founding decision 2026-08-17). The layer always owns a GraphModel so a
 * route-guided layer can be switched to graph-guided without data loss;
 * the engine simply ignores the graph while guideType is 'route'.
 */

const VALID_GUIDE_TYPES = ['graph', 'route'];

export const FLOW_LAYER_LIMITS = Object.freeze({
  MAX_EMITTERS: 64,
  MAX_GRAPH_NODES: 2000,
  MAX_GRAPH_EDGES: 4000,
  MAX_CONTROL_POINTS_PER_EDGE: 256,
  MAX_CONTROL_POINTS_TOTAL: 8192,
});

export class FlowLayer {
  /**
   * @param {Object} [options={}]
   * @param {string}  [options.id]                 — Unique identifier (auto-generated if omitted).
   * @param {string}  [options.name='Flow layer']  — Display name for the Phase 4 layer list.
   * @param {boolean} [options.visible=true]       — Whether the layer renders.
   * @param {string}  [options.guideType='graph']  — 'graph' | 'route'.
   * @param {GraphModel|Object} [options.graph]    — GraphModel instance to adopt, or serialised `{nodes, edges}` data.
   * @param {Array<Emitter|Object>} [options.emitters=[]] — Emitter instances or serialised emitter data.
   */
  constructor(options = {}) {
    if (Array.isArray(options.emitters) && options.emitters.length > FLOW_LAYER_LIMITS.MAX_EMITTERS) {
      throw new Error(`Flow layer emitter limit is ${FLOW_LAYER_LIMITS.MAX_EMITTERS}`);
    }
    if (!(options.graph instanceof GraphModel)) {
      FlowLayer.assertValidJSON(options);
    }
    this.id = options.id || FlowLayer._generateId();
    this.name = typeof options.name === 'string' ? options.name : 'Flow layer';
    this.visible = options.visible !== false;
    this.guideType = FlowLayer._validateGuideType(options.guideType);
    this.graph = options.graph instanceof GraphModel
      ? options.graph
      : GraphModel.fromJSON(options.graph || {});
    /** @type {Emitter[]} */
    this.emitters = Array.isArray(options.emitters)
      ? options.emitters.map(e => (e instanceof Emitter ? e : Emitter.fromJSON(e)))
      : [];
  }

  /**
   * Set the guide type, validated.
   * @param {string} t — 'graph' | 'route'
   */
  setGuideType(t) {
    this.guideType = FlowLayer._validateGuideType(t);
  }

  // ── Emitter CRUD ────────────────────────────────────

  /**
   * Create and append an emitter.
   * @param {Object} [options={}] — Passed to the Emitter constructor.
   * @returns {Emitter} The created emitter.
   */
  addEmitter(options = {}) {
    if (this.emitters.length >= FLOW_LAYER_LIMITS.MAX_EMITTERS) {
      throw new Error(`A flow layer supports at most ${FLOW_LAYER_LIMITS.MAX_EMITTERS} emitters`);
    }
    const emitter = new Emitter(options);
    this.emitters.push(emitter);
    return emitter;
  }

  /**
   * Remove an emitter by id.
   * @param {string} id
   * @returns {boolean} True if the emitter existed and was removed.
   */
  removeEmitter(id) {
    const index = this.emitters.findIndex(e => e.id === id);
    if (index === -1) return false;
    this.emitters.splice(index, 1);
    return true;
  }

  /**
   * @param {string} id
   * @returns {Emitter|undefined}
   */
  getEmitter(id) {
    return this.emitters.find(e => e.id === id);
  }

  /**
   * @returns {Emitter[]} All emitters (snapshot array).
   */
  getEmitters() {
    return [...this.emitters];
  }

  // ── Serialisation ───────────────────────────────────────

  /**
   * Serialise to a plain object (layer params + seeds only — runtime dot
   * state never exists on the model, so none is persisted).
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      visible: this.visible,
      guideType: this.guideType,
      graph: this.graph.toJSON(),
      emitters: this.emitters.map(e => e.toJSON()),
    };
  }

  /**
   * Deserialise from a plain object with fallback defaults.
   * @param {Object} data
   * @returns {FlowLayer}
   */
  static fromJSON(data = {}) {
    FlowLayer.assertValidJSON(data);
    return new FlowLayer(data);
  }

  /**
   * Validate persisted layer and graph collections before GraphModel hydrates
   * them. GraphModel remains permissive for authoring; this boundary is strict
   * because each node, edge, control point and emitter adds rendering work.
   * @param {Object} data
   * @throws {Error} If the layer exceeds a budget or contains non-finite data.
   */
  static assertValidJSON(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid flow layer: expected an object');
    }

    const emitters = data.emitters ?? [];
    if (!Array.isArray(emitters)) {
      throw new Error('Invalid flow layer emitters: expected an array');
    }
    if (emitters.length > FLOW_LAYER_LIMITS.MAX_EMITTERS) {
      throw new Error(`Flow layer emitter limit is ${FLOW_LAYER_LIMITS.MAX_EMITTERS}`);
    }
    const emitterIds = new Set();
    emitters.forEach(emitter => {
      Emitter.assertValidJSON(emitter);
      if (emitter.id != null) {
        if (typeof emitter.id !== 'string' || emitter.id.length === 0 || emitterIds.has(emitter.id)) {
          throw new Error('Invalid emitter id: expected a unique non-empty string');
        }
        emitterIds.add(emitter.id);
      }
    });

    const graph = data.graph ?? {};
    if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
      throw new Error('Invalid flow layer graph: expected an object');
    }
    const nodes = graph.nodes ?? [];
    const edges = graph.edges ?? [];
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      throw new Error('Invalid flow layer graph collections');
    }
    if (nodes.length > FLOW_LAYER_LIMITS.MAX_GRAPH_NODES) {
      throw new Error(`Flow layer node limit is ${FLOW_LAYER_LIMITS.MAX_GRAPH_NODES}`);
    }
    if (edges.length > FLOW_LAYER_LIMITS.MAX_GRAPH_EDGES) {
      throw new Error(`Flow layer edge limit is ${FLOW_LAYER_LIMITS.MAX_GRAPH_EDGES}`);
    }

    const nodeIds = new Set();
    for (const node of nodes) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        throw new Error('Invalid graph node: expected an object');
      }
      if (!Number.isFinite(Number(node.x)) || !Number.isFinite(Number(node.y))) {
        throw new Error('Invalid graph node position: expected finite coordinates');
      }
      if (Number(node.x) < 0 || Number(node.x) > 1 || Number(node.y) < 0 || Number(node.y) > 1) {
        throw new Error('Invalid graph node position: expected coordinates from 0 to 1');
      }
      if (node.id != null) {
        if (typeof node.id !== 'string' || node.id.length === 0 || nodeIds.has(node.id)) {
          throw new Error('Invalid graph node id: expected a unique non-empty string');
        }
        nodeIds.add(node.id);
      }
    }

    const edgeIds = new Set();
    let controlPointCount = 0;
    for (const edge of edges) {
      if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
        throw new Error('Invalid graph edge: expected an object');
      }
      if (typeof edge.sourceId !== 'string' || typeof edge.targetId !== 'string') {
        throw new Error('Invalid graph edge endpoints');
      }
      if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) {
        throw new Error('Invalid graph edge: endpoint does not exist');
      }
      if ('weight' in edge && (!Number.isFinite(Number(edge.weight)) || Number(edge.weight) <= 0)) {
        throw new Error('Invalid graph edge weight: expected a finite positive number');
      }
      if (edge.id != null) {
        if (typeof edge.id !== 'string' || edge.id.length === 0 || edgeIds.has(edge.id)) {
          throw new Error('Invalid graph edge id: expected a unique non-empty string');
        }
        edgeIds.add(edge.id);
      }
      const points = edge.controlPoints ?? [];
      if (!Array.isArray(points) || points.length > FLOW_LAYER_LIMITS.MAX_CONTROL_POINTS_PER_EDGE) {
        throw new Error(`Graph edge control-point limit is ${FLOW_LAYER_LIMITS.MAX_CONTROL_POINTS_PER_EDGE}`);
      }
      controlPointCount += points.length;
      if (controlPointCount > FLOW_LAYER_LIMITS.MAX_CONTROL_POINTS_TOTAL) {
        throw new Error(`Flow layer control-point limit is ${FLOW_LAYER_LIMITS.MAX_CONTROL_POINTS_TOTAL}`);
      }
      for (const point of points) {
        if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) {
          throw new Error('Invalid graph control point: expected finite coordinates');
        }
        if (Number(point.x) < 0 || Number(point.x) > 1 || Number(point.y) < 0 || Number(point.y) > 1) {
          throw new Error('Invalid graph control point: expected coordinates from 0 to 1');
        }
      }
    }
  }

  // ── private helpers ──────────────────────────────────

  /** @private */
  static _generateId() {
    return `fl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate a guide type, falling back to 'graph'.
   * @private
   * @param {string} t
   * @returns {string}
   */
  static _validateGuideType(t) {
    return VALID_GUIDE_TYPES.includes(t) ? t : 'graph';
  }
}
