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
    return new FlowLayer(data);
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
