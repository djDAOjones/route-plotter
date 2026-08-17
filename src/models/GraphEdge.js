/**
 * Model representing a directed or bidirectional edge in the crowd-flow graph.
 * Pure data model — no EventBus dependency.
 *
 * Control-point positions are normalised image coordinates (0–1).
 */

const VALID_DIRECTIONS = ['one-way', 'two-way'];
const MIN_WEIGHT = 0.01;

export class GraphEdge {
  /**
   * @param {Object} options
   * @param {string}  options.sourceId           — ID of the source GraphNode (required).
   * @param {string}  options.targetId           — ID of the target GraphNode (required).
   * @param {string}  [options.id]               — Unique identifier (auto-generated if omitted).
   * @param {number}  [options.weight=1]         — Positive edge weight.
   * @param {string}  [options.direction='two-way'] — 'one-way' | 'two-way'.
   * @param {Array<{x:number, y:number}>} [options.controlPoints=[]] — Intermediate curve points (normalised 0–1).
   * @throws {Error} If sourceId or targetId is missing.
   */
  constructor(options = {}) {
    if (!options.sourceId) throw new Error('GraphEdge requires a sourceId');
    if (!options.targetId) throw new Error('GraphEdge requires a targetId');

    this.id = options.id || GraphEdge._generateId();
    this.sourceId = options.sourceId;
    this.targetId = options.targetId;
    this.weight = GraphEdge._clampWeight(options.weight ?? 1);
    this.direction = GraphEdge._validateDirection(options.direction);
    this.controlPoints = Array.isArray(options.controlPoints)
      ? options.controlPoints.map(GraphEdge._clampPoint)
      : [];
  }

  /**
   * Set the edge weight, clamped to a positive minimum.
   * @param {number} w
   */
  setWeight(w) {
    this.weight = GraphEdge._clampWeight(w);
  }

  /**
   * Set the edge direction, validated.
   * @param {string} d — 'one-way' | 'two-way'
   */
  setDirection(d) {
    this.direction = GraphEdge._validateDirection(d);
  }

  /**
   * Append a control point (normalised 0–1).
   * @param {number} x
   * @param {number} y
   * @returns {number} Index of the new control point.
   */
  addControlPoint(x, y) {
    this.controlPoints.push(GraphEdge._clampPoint({ x, y }));
    return this.controlPoints.length - 1;
  }

  /**
   * Remove a control point by index.
   * @param {number} index
   * @returns {boolean} True if a point was removed.
   */
  removeControlPoint(index) {
    if (index < 0 || index >= this.controlPoints.length) return false;
    this.controlPoints.splice(index, 1);
    return true;
  }

  /**
   * Serialise to a plain object.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      sourceId: this.sourceId,
      targetId: this.targetId,
      weight: this.weight,
      direction: this.direction,
      controlPoints: this.controlPoints.map(p => ({ x: p.x, y: p.y })),
    };
  }

  /**
   * Deserialise from a plain object with fallback defaults.
   * sourceId and targetId are still required.
   * @param {Object} data
   * @returns {GraphEdge}
   */
  static fromJSON(data = {}) {
    return new GraphEdge(data);
  }

  // ── private helpers ──────────────────────────────────

  /** @private */
  static _generateId() {
    return `ge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clamp weight to a positive minimum.
   * @private
   * @param {number} w
   * @returns {number}
   */
  static _clampWeight(w) {
    const n = Number(w);
    if (Number.isNaN(n) || n < MIN_WEIGHT) return MIN_WEIGHT;
    return n;
  }

  /**
   * Validate direction, falling back to 'two-way'.
   * @private
   * @param {string} d
   * @returns {string}
   */
  static _validateDirection(d) {
    return VALID_DIRECTIONS.includes(d) ? d : 'two-way';
  }

  /**
   * Clamp a {x, y} point to 0–1 on both axes.
   * @private
   * @param {{x: number, y: number}} p
   * @returns {{x: number, y: number}}
   */
  static _clampPoint(p) {
    const clamp = (v) => {
      const n = Number(v);
      if (Number.isNaN(n)) return 0.5;
      return Math.max(0, Math.min(1, n));
    };
    return { x: clamp(p.x), y: clamp(p.y) };
  }
}
