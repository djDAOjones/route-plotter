/**
 * Model representing a node in the crowd-flow graph.
 * Pure data model — no EventBus dependency.
 *
 * Positions are normalised image coordinates (0–1).
 * Canvas pixel coordinates are derived at render time
 * via CoordinateTransform.
 */

const VALID_TYPES = ['normal', 'entry', 'exit'];

export class GraphNode {
  /**
   * @param {Object} [options={}]
   * @param {string}  [options.id]    — Unique identifier (auto-generated if omitted).
   * @param {number}  [options.x=0.5] — Normalised x position (0–1).
   * @param {number}  [options.y=0.5] — Normalised y position (0–1).
   * @param {string}  [options.type='normal'] — 'normal' | 'entry' | 'exit'.
   * @param {string}  [options.label=''] — Display label text.
   */
  constructor(options = {}) {
    this.id = options.id || GraphNode._generateId();
    this.x = GraphNode._clamp01(options.x ?? 0.5);
    this.y = GraphNode._clamp01(options.y ?? 0.5);
    this.type = GraphNode._validateType(options.type);
    this.label = options.label ?? '';
  }

  /**
   * Move the node to a new normalised position, clamped to 0–1.
   * @param {number} x
   * @param {number} y
   */
  moveTo(x, y) {
    this.x = GraphNode._clamp01(x);
    this.y = GraphNode._clamp01(y);
  }

  /**
   * Serialise to a plain object.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      type: this.type,
      label: this.label,
    };
  }

  /**
   * Deserialise from a plain object with fallback defaults.
   * @param {Object} data
   * @returns {GraphNode}
   */
  static fromJSON(data = {}) {
    return new GraphNode(data);
  }

  // ── private helpers ──────────────────────────────────

  /** @private */
  static _generateId() {
    return `gn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clamp a value to the 0–1 range.
   * @private
   * @param {number} v
   * @returns {number}
   */
  static _clamp01(v) {
    const n = Number(v);
    if (Number.isNaN(n)) return 0.5;
    return Math.max(0, Math.min(1, n));
  }

  /**
   * Validate and return a node type, falling back to 'normal'.
   * @private
   * @param {string} t
   * @returns {string}
   */
  static _validateType(t) {
    return VALID_TYPES.includes(t) ? t : 'normal';
  }
}
