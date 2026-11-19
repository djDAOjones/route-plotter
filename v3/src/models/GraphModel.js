import { GraphNode } from './GraphNode.js';
import { GraphEdge } from './GraphEdge.js';

/**
 * Collection class owning all nodes and edges in the crowd-flow graph.
 * Pure data model — no EventBus dependency.
 *
 * Enforces referential integrity:
 *  - Edges can only be created between existing nodes.
 *  - Deleting a node cascades to delete all connected edges.
 */
export class GraphModel {
  constructor() {
    /** @type {Map<string, GraphNode>} */
    this._nodes = new Map();
    /** @type {Map<string, GraphEdge>} */
    this._edges = new Map();
  }

  // ── Node CRUD ───────────────────────────────────────

  /**
   * Add a node to the graph.
   * @param {Object} [options={}] — Passed to the GraphNode constructor.
   * @returns {GraphNode} The created node.
   */
  addNode(options = {}) {
    const node = new GraphNode(options);
    this._nodes.set(node.id, node);
    return node;
  }

  /**
   * Remove a node and all edges connected to it.
   * @param {string} id
   * @returns {boolean} True if the node existed and was removed.
   */
  removeNode(id) {
    if (!this._nodes.has(id)) return false;

    // Cascade: delete every edge that references this node
    const toDelete = [];
    this._edges.forEach((edge, edgeId) => {
      if (edge.sourceId === id || edge.targetId === id) {
        toDelete.push(edgeId);
      }
    });
    for (const edgeId of toDelete) {
      this._edges.delete(edgeId);
    }

    this._nodes.delete(id);
    return true;
  }

  /**
   * @param {string} id
   * @returns {GraphNode|undefined}
   */
  getNode(id) {
    return this._nodes.get(id);
  }

  /**
   * @returns {GraphNode[]} All nodes (snapshot array).
   */
  getNodes() {
    return [...this._nodes.values()];
  }

  /**
   * @param {string} type — 'normal' | 'entry' | 'exit'
   * @returns {GraphNode[]}
   */
  getNodesByType(type) {
    return this.getNodes().filter(n => n.type === type);
  }

  // ── Edge CRUD ───────────────────────────────────────

  /**
   * Add an edge between two existing nodes.
   * @param {Object} options — Must include `sourceId` and `targetId`.
   * @returns {GraphEdge} The created edge.
   * @throws {Error} If sourceId or targetId do not reference existing nodes.
   */
  addEdge(options = {}) {
    if (!this._nodes.has(options.sourceId)) {
      throw new Error(`addEdge: sourceId "${options.sourceId}" does not exist in the graph`);
    }
    if (!this._nodes.has(options.targetId)) {
      throw new Error(`addEdge: targetId "${options.targetId}" does not exist in the graph`);
    }
    const edge = new GraphEdge(options);
    this._edges.set(edge.id, edge);
    return edge;
  }

  /**
   * Remove an edge by id.
   * @param {string} id
   * @returns {boolean} True if the edge existed and was removed.
   */
  removeEdge(id) {
    return this._edges.delete(id);
  }

  /**
   * @param {string} id
   * @returns {GraphEdge|undefined}
   */
  getEdge(id) {
    return this._edges.get(id);
  }

  /**
   * @returns {GraphEdge[]} All edges (snapshot array).
   */
  getEdges() {
    return [...this._edges.values()];
  }

  /**
   * Get all edges connected to a node (as source or target).
   * @param {string} nodeId
   * @returns {GraphEdge[]}
   */
  getEdgesForNode(nodeId) {
    return this.getEdges().filter(
      e => e.sourceId === nodeId || e.targetId === nodeId
    );
  }

  // ── Bulk operations ─────────────────────────────────────

  /**
   * Remove all nodes and edges.
   */
  clear() {
    this._nodes.clear();
    this._edges.clear();
  }

  // ── Serialisation ───────────────────────────────────────

  /**
   * Serialise the full graph to a plain object.
   * @returns {{ nodes: Object[], edges: Object[] }}
   */
  toJSON() {
    return {
      nodes: this.getNodes().map(n => n.toJSON()),
      edges: this.getEdges().map(e => e.toJSON()),
    };
  }

  /**
   * Replace this model's contents from serialised data (instance method).
   * Clears existing state first.
   * @param {Object} data — `{ nodes: [...], edges: [...] }`
   */
  fromJSON(data = {}) {
    this.clear();
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    const edges = Array.isArray(data.edges) ? data.edges : [];

    for (const nd of nodes) {
      this.addNode(nd);
    }
    for (const ed of edges) {
      if (this._nodes.has(ed.sourceId) && this._nodes.has(ed.targetId)) {
        this.addEdge(ed);
      }
    }
  }

  /**
   * Reconstruct a GraphModel from serialised data (static factory).
   * Nodes are restored first so edge referential integrity holds.
   * Edges whose source or target no longer exist are silently dropped.
   * @param {Object} data — `{ nodes: [...], edges: [...] }`
   * @returns {GraphModel}
   */
  static fromJSON(data = {}) {
    const model = new GraphModel();
    model.fromJSON(data);
    return model;
  }
}
