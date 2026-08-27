/**
 * NetworkEditService - Modal network (guide graph) editing mode
 *
 * The app's one true tool mode for drawing a crowd's custom network
 * (Phase 4, direction 2026-08-18): while active, canvas input is
 * intercepted (same contract as area polygon draw) and the pen builds
 * GraphNodes/GraphEdges on the bound FlowLayer's own GraphModel.
 *
 * ## Pen gestures (clicks routed here by the network mixin)
 * - Click empty canvas: place a node; with the pen down, it arrives
 *   already linked by an edge from the pen node, and the pen moves on —
 *   successive clicks draw a connected chain, exactly like route drawing.
 * - Click a node: with the pen down, link pen node → node (if no edge
 *   joins them yet) and continue from it; with the pen up, pick the pen
 *   up there. Either way the node becomes the selection (Node card).
 * - Click an edge: select it (Edge card). The pen lifts — inspecting an
 *   edge is not drawing.
 * - Drag a node: move it (Shift = 15° angle snap against its first
 *   neighbour). Drag an edge: bend it — a control point is inserted
 *   under the pointer and dragged. Drag a control handle: move it.
 * - Shift-click node / edge / control handle: delete (undo toast).
 * - Esc: cancel an in-flight drag, else lift the pen, else exit the
 *   mode. Delete/Backspace: delete the selection. T: cycle node type.
 *
 * ## State ownership
 * The service owns mode state (bound layer, pen, selection, hover,
 * drag) and the banner; the network mixin owns coordinate transforms
 * and hit-testing, and answers undo/autosave/render through the
 * `network:changed` pipeline. Model mutations happen here, on the
 * layer's GraphModel — persistence rides the scene machinery that has
 * carried flow layers since Phase 2.
 */

import { snapToAngle } from '../utils/snapToAngle.js';
import { getGraphDepartureShares } from '../utils/graphRouting.js';

/** Node types in T-key cycle order; 'normal' is user-facing "pass-through". */
const NODE_TYPE_CYCLE = ['normal', 'entry', 'exit'];
const SELECTION_OUTER = '#FFFFFF';
const SELECTION_INNER = '#111111';

export class NetworkEditService {
  /**
   * @param {EventBus} eventBus - Application event bus
   */
  constructor(eventBus) {
    /** @type {EventBus} */
    this.eventBus = eventBus;

    /** @type {boolean} Whether network edit mode is active */
    this.active = false;

    /** @type {import('../models/FlowLayer.js').FlowLayer|null} Layer bound for editing or passive inspection */
    this.layer = null;

    /** @type {string|null} Pen node id — the node the next placed node links from (null = pen up) */
    this.penNodeId = null;

    /** @type {{kind: 'node'|'edge', id: string, controlIndex?: number}|null} Inspector selection */
    this.selection = null;

    /** @type {{kind: string, id: string, controlIndex?: number}|null} Hover target (idle pointer) */
    this.hover = null;

    /** @type {{x: number, y: number}|null} Pointer position (normalised) for the pen preview line */
    this.cursorImg = null;

    /**
     * In-flight drag, or null. kind: 'node' | 'control'.
     * Edge bends become 'control' drags the moment the control point is
     * inserted (beginEdgeBend).
     * @type {{kind: string, nodeId?: string, edgeId?: string, controlIndex?: number,
     *         origX: number, origY: number, moved: boolean}|null}
     */
    this.drag = null;

    /** @type {HTMLElement|null} Mode banner element */
    this._banner = null;

    /** @type {Function|null} Capture-phase keydown handler (Esc/Delete/T) */
    this._keyHandler = null;
  }

  // ── mode lifecycle ──────────────────────────────────────

  /**
   * Enter network edit mode for a flow layer's graph.
   * @param {import('../models/FlowLayer.js').FlowLayer} layer
   */
  enter(layer) {
    if (!layer) return;
    if (this.active) this.exit();
    else if (this.layer) this.clearInspection();

    this.active = true;
    this.layer = layer;
    this.penNodeId = null;
    this.selection = null;
    this.hover = null;
    this.cursorImg = null;
    this.drag = null;

    this._showBanner();

    this._keyHandler = (e) => this._handleKeyDown(e);
    document.addEventListener('keydown', this._keyHandler, true); // capture phase

    this.eventBus.emit('network:edit-mode-changed', { active: true, layer });
    this.eventBus.emit('render:request');
  }

  /**
   * Bind a layer for passive node/edge inspection without entering the
   * drawing tool. This deliberately does not show the banner, install the
   * capture-phase key handler, change Preview, or announce edit-mode state.
   * The scene outline calls this before selectNode/selectEdge.
   *
   * @param {import('../models/FlowLayer.js').FlowLayer} layer
   */
  bindForInspection(layer) {
    if (!layer) return;

    // A direct context switch away from an actively edited layer must still
    // perform the full mode cleanup. Re-binding the active layer is a no-op.
    if (this.active) {
      if (this.layer === layer) return;
      this.exit();
    }

    if (this.layer === layer) return;

    const hadSelection = this.selection;
    const previousLayer = this.layer;
    this.layer = layer;
    this.penNodeId = null;
    this.selection = null;
    this.hover = null;
    this.cursorImg = null;
    this.drag = null;

    if (hadSelection) this._emitDeselected(hadSelection, previousLayer);
    this.eventBus.emit('render:request');
  }

  /**
   * Clear passive inspection state. While the drawing tool is active this
   * only clears its inspector selection, preserving the established pen
   * mode lifecycle; context changes continue to call exit().
   */
  clearInspection() {
    if (this.active) {
      if (!this.selection) return;
      this.clearSelection();
      this.eventBus.emit('render:request');
      return;
    }

    const previousLayer = this.layer;
    const hadBinding = !!previousLayer;
    const hadSelection = this.selection;
    this.layer = null;
    this.penNodeId = null;
    this.selection = null;
    this.hover = null;
    this.cursorImg = null;
    this.drag = null;

    if (hadSelection) this._emitDeselected(hadSelection, previousLayer);
    if (hadBinding || hadSelection) this.eventBus.emit('render:request');
  }

  /**
   * Exit the mode. Model state stays as authored (every gesture already
   * committed through network:changed); only tool state is discarded.
   */
  exit() {
    if (!this.active) return;

    // Mode changes can precede the outer pointer handler's cancellation.
    // Restore the model while the bound layer is still available; a later
    // network:drag-cancel is then an idempotent no-op.
    if (this.drag) this.cancelDrag();

    const hadSelection = this.selection;
    const previousLayer = this.layer;
    this.active = false;
    this.layer = null;
    this.penNodeId = null;
    this.selection = null;
    this.hover = null;
    this.cursorImg = null;
    this.drag = null;

    this._hideBanner();

    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }

    if (hadSelection) this._emitDeselected(hadSelection, previousLayer);
    this.eventBus.emit('network:edit-mode-changed', { active: false, layer: null });
    this.eventBus.emit('render:request');
  }

  // ── selection ───────────────────────────────────────────

  /** @returns {import('../models/GraphNode.js').GraphNode|null} */
  selectedNode() {
    if (!this.layer || this.selection?.kind !== 'node') return null;
    return this.layer.graph.getNode(this.selection.id) || null;
  }

  /** @returns {import('../models/GraphEdge.js').GraphEdge|null} */
  selectedEdge() {
    if (!this.layer || this.selection?.kind !== 'edge') return null;
    return this.layer.graph.getEdge(this.selection.id) || null;
  }

  /**
   * Resolve the individually selected bend point, if any.
   * @returns {{edge: import('../models/GraphEdge.js').GraphEdge, index: number, point: {x: number, y: number}}|null}
   */
  selectedControlPoint() {
    const edge = this.selectedEdge();
    const index = this.selection?.controlIndex;
    if (!edge || !Number.isInteger(index) || !edge.controlPoints[index]) return null;
    return { edge, index, point: edge.controlPoints[index] };
  }

  /**
   * Select a node (Node card scope).
   * @param {import('../models/GraphNode.js').GraphNode} node
   */
  selectNode(node) {
    if (!this.layer || !node || !this.layer.graph.getNode(node.id)) return;
    if (this.selection?.kind === 'node' && this.selection.id === node.id) return;
    if (this.selection?.kind === 'edge') this._emitDeselected(this.selection);
    this.selection = { kind: 'node', id: node.id };
    this.eventBus.emit('network:node-selected', { node });
    if (!this.active) this.eventBus.emit('render:request');
  }

  /**
   * Select an edge (Edge card scope). Inspecting an edge lifts the pen.
   * @param {import('../models/GraphEdge.js').GraphEdge} edge
   */
  selectEdge(edge) {
    if (!this.layer || !edge || !this.layer.graph.getEdge(edge.id)) return;
    if (this.selection?.kind === 'edge' && this.selection.id === edge.id) {
      if (!Number.isInteger(this.selection.controlIndex)) return;
      const previous = this.selection;
      this.selection = { kind: 'edge', id: edge.id };
      this._emitControlDeselected(previous);
      this.eventBus.emit('render:request');
      return;
    }
    if (this.selection) this._emitDeselected(this.selection);
    this.selection = { kind: 'edge', id: edge.id };
    this.penNodeId = null;
    this.eventBus.emit('network:edge-selected', { edge });
    if (!this.active) this.eventBus.emit('render:request');
  }

  /**
   * Select one edge control point while retaining Edge-card scope.
   * Scene-outline inspection calls this after bindForInspection().
   * @param {import('../models/GraphEdge.js').GraphEdge} edge
   * @param {number} index
   */
  selectControlPoint(edge, index) {
    if (!this.layer || !edge || !Number.isInteger(index) ||
        !this.layer.graph.getEdge(edge.id)?.controlPoints[index]) return;
    if (this.selection?.kind === 'edge' && this.selection.id === edge.id &&
        this.selection.controlIndex === index) return;

    this.selectEdge(edge);
    this.selection = { kind: 'edge', id: edge.id, controlIndex: index };
    this.eventBus.emit('network:control-selected', { edge, index });
    this.eventBus.emit('render:request');
  }

  /** Clear any node/edge selection (back to Crowd scope). */
  clearSelection() {
    if (!this.selection) return;
    const previous = this.selection;
    this.selection = null;
    this._emitDeselected(previous);
  }

  /** @private */
  _emitDeselected(selection, layer = this.layer) {
    const kind = typeof selection === 'string' ? selection : selection.kind;
    if (typeof selection !== 'string') this._emitControlDeselected(selection, layer);
    this.eventBus.emit(kind === 'node' ? 'network:node-deselected' : 'network:edge-deselected');
  }

  /** @private */
  _emitControlDeselected(selection, layer = this.layer) {
    if (!Number.isInteger(selection?.controlIndex)) return;
    const edge = layer?.graph.getEdge(selection.id);
    this.eventBus.emit('network:control-deselected', edge
      ? { edge, index: selection.controlIndex }
      : { index: selection.controlIndex });
  }

  // ── pen clicks ──────────────────────────────────────────

  /**
   * Place a node at a normalised position; with the pen down it arrives
   * linked from the pen node (Shift = 15° snap against that node).
   * @param {{x: number, y: number}} img - Normalised position
   * @param {boolean} [shift=false]
   * @returns {import('../models/GraphNode.js').GraphNode|null}
   */
  placeNode(img, shift = false) {
    if (!this.active) return null;

    let { x, y } = img;
    const penNode = this.penNodeId ? this.layer.graph.getNode(this.penNodeId) : null;
    if (shift && penNode) {
      ({ x, y } = snapToAngle(penNode.x, penNode.y, x, y));
    }

    const node = this.layer.graph.addNode({ x, y });
    if (penNode) {
      this.layer.graph.addEdge({ sourceId: penNode.id, targetId: node.id });
    }
    this.penNodeId = node.id;
    this.selectNode(node);
    this._updateBannerCount();
    this.eventBus.emit('network:changed', { commit: true });
    return node;
  }

  /**
   * Click on an existing node: link from the pen node (if the pen is
   * down and no edge joins them yet) and continue from it, or just pick
   * the pen up there.
   * @param {import('../models/GraphNode.js').GraphNode} node
   */
  clickNode(node) {
    if (!this.active) return;

    const penNode = this.penNodeId ? this.layer.graph.getNode(this.penNodeId) : null;
    if (penNode && penNode.id !== node.id) {
      const joined = this.layer.graph.getEdgesForNode(node.id).some(
        e => e.sourceId === penNode.id || e.targetId === penNode.id
      );
      if (!joined) {
        this.layer.graph.addEdge({ sourceId: penNode.id, targetId: node.id });
        this._updateBannerCount();
        this.eventBus.emit('network:changed', { commit: true });
      }
    }
    this.penNodeId = node.id;
    this.selectNode(node);
    this.eventBus.emit('render:request');
  }

  // ── deletion ────────────────────────────────────────────

  /**
   * Delete a node (edges cascade in the model).
   * @param {import('../models/GraphNode.js').GraphNode} node
   */
  deleteNode(node) {
    if (!this.layer || !node || !this.layer.graph.getNode(node.id)) return;
    const incidentEdgeIds = new Set(
      this.layer.graph.getEdgesForNode(node.id).map(edge => edge.id)
    );
    const selectionRemoved = (this.selection?.kind === 'node' && this.selection.id === node.id)
      || (this.selection?.kind === 'edge' && incidentEdgeIds.has(this.selection.id));
    if (selectionRemoved) this.clearSelection();
    if (!this.layer.graph.removeNode(node.id)) return;
    if (this.penNodeId === node.id) this.penNodeId = null;
    this.hover = null;
    this._updateBannerCount();
    this.eventBus.emit('network:changed', { commit: true });
  }

  /**
   * Delete an edge. Its nodes stay.
   * @param {import('../models/GraphEdge.js').GraphEdge} edge
   */
  deleteEdge(edge) {
    if (!this.layer || !edge || !this.layer.graph.removeEdge(edge.id)) return;
    if (this.selection?.kind === 'edge' && this.selection.id === edge.id) this.clearSelection();
    this.hover = null;
    this._updateBannerCount();
    this.eventBus.emit('network:changed', { commit: true });
  }

  /**
   * Delete one control point from an edge (un-bend).
   * @param {import('../models/GraphEdge.js').GraphEdge} edge
   * @param {number} index
   */
  deleteControlPoint(edge, index) {
    if (!this.active || !edge.removeControlPoint(index)) return;
    if (this.selection?.kind === 'edge' && this.selection.id === edge.id &&
        Number.isInteger(this.selection.controlIndex)) {
      if (this.selection.controlIndex === index) {
        const previous = this.selection;
        this.selection = { kind: 'edge', id: edge.id };
        this._emitControlDeselected(previous);
      } else if (this.selection.controlIndex > index) {
        this.selection.controlIndex--;
        this.eventBus.emit('network:control-selected', {
          edge, index: this.selection.controlIndex
        });
      }
    }
    this.hover = null;
    this.eventBus.emit('network:changed', { commit: true });
  }

  /** Delete whatever is selected (Delete/Backspace, card buttons). */
  deleteSelection() {
    const node = this.selectedNode();
    if (node) {
      this.deleteNode(node);
      return;
    }
    const edge = this.selectedEdge();
    if (edge) this.deleteEdge(edge);
  }

  // ── node type ───────────────────────────────────────────

  /**
   * Set the selected node's type ('normal' | 'entry' | 'exit').
   * @param {string} type
   */
  setSelectedNodeType(type) {
    const node = this.selectedNode();
    if (!node || !NODE_TYPE_CYCLE.includes(type) || node.type === type) return;
    node.type = type;
    this.eventBus.emit('network:changed', { commit: true });
    // Re-announce so the chip's kind text follows the type
    this.eventBus.emit('network:node-selected', { node });
  }

  /** Cycle the selected node's type (T key — same habit as waypoints). */
  cycleSelectedNodeType() {
    const node = this.selectedNode();
    if (!node) return;
    const next = NODE_TYPE_CYCLE[(NODE_TYPE_CYCLE.indexOf(node.type) + 1) % NODE_TYPE_CYCLE.length];
    this.setSelectedNodeType(next);
  }

  // ── edge params ─────────────────────────────────────────

  /**
   * Set the selected edge's direction ('one-way' | 'two-way').
   * One-way means source → target; Swap reverses that.
   * @param {string} direction
   */
  setSelectedEdgeDirection(direction) {
    const edge = this.selectedEdge();
    if (!edge || edge.direction === direction) return;
    edge.setDirection(direction);
    this.eventBus.emit('network:changed', { commit: true });
    // Re-announce so the chip's kind text follows the direction
    this.eventBus.emit('network:edge-selected', { edge });
    const control = this.selectedControlPoint();
    if (control) {
      this.eventBus.emit('network:control-selected', { edge, index: control.index });
    }
  }

  /** Reverse a one-way edge by swapping its endpoints. */
  swapSelectedEdgeDirection() {
    const edge = this.selectedEdge();
    if (!edge || edge.direction !== 'one-way') return;
    const source = edge.sourceId;
    edge.sourceId = edge.targetId;
    edge.targetId = source;
    edge.controlPoints.reverse();
    if (this.selection?.kind === 'edge' && this.selection.id === edge.id &&
        Number.isInteger(this.selection.controlIndex)) {
      this.selection.controlIndex = edge.controlPoints.length - 1 - this.selection.controlIndex;
      this.eventBus.emit('network:control-selected', {
        edge, index: this.selection.controlIndex
      });
    }
    this.eventBus.emit('network:changed', { commit: true });
  }

  /**
   * Re-bind after a restore rebuilt the scene: adopt the fresh layer
   * object, preserve active or passive state and whatever selection/pen
   * survived (by id), then re-emit selection with fresh model objects.
   * @param {import('../models/FlowLayer.js').FlowLayer} layer
   */
  rebind(layer) {
    if (!this.layer || !layer) return;
    this.layer = layer;
    this.drag = null;
    this.hover = null;

    if (this.penNodeId && !layer.graph.getNode(this.penNodeId)) {
      this.penNodeId = null;
    }

    if (this.selection) {
      const { kind, id, controlIndex } = this.selection;
      const fresh = kind === 'node' ? layer.graph.getNode(id) : layer.graph.getEdge(id);
      if (!fresh) {
        this.clearSelection();
      } else if (kind === 'node') {
        this.eventBus.emit('network:node-selected', { node: fresh });
      } else {
        this.eventBus.emit('network:edge-selected', { edge: fresh });
        if (Number.isInteger(controlIndex)) {
          if (fresh.controlPoints[controlIndex]) {
            this.eventBus.emit('network:control-selected', { edge: fresh, index: controlIndex });
          } else {
            const previous = this.selection;
            this.selection = { kind: 'edge', id };
            this._emitControlDeselected(previous);
          }
        }
      }
    }

    this._updateBannerCount();
    this.eventBus.emit('render:request');
  }

  // ── drags ───────────────────────────────────────────────

  /**
   * Begin dragging a node.
   * @param {import('../models/GraphNode.js').GraphNode} node
   */
  beginNodeDrag(node) {
    if (!this.active) return;
    this.drag = { kind: 'node', nodeId: node.id, origX: node.x, origY: node.y, moved: false };
    this.selectNode(node);
    this.penNodeId = node.id;
  }

  /**
   * Begin dragging an existing control handle of the selected edge.
   * @param {import('../models/GraphEdge.js').GraphEdge} edge
   * @param {number} controlIndex
   */
  beginControlDrag(edge, controlIndex) {
    if (!this.active) return;
    const p = edge.controlPoints[controlIndex];
    if (!p) return;
    this.drag = {
      kind: 'control', edgeId: edge.id, controlIndex,
      origX: p.x, origY: p.y, moved: false, inserted: false,
    };
    this.selectControlPoint(edge, controlIndex);
  }

  /**
   * Begin bending an edge: insert a control point at the grab position
   * (kept in chain order via insertIndex) and drag it.
   * @param {import('../models/GraphEdge.js').GraphEdge} edge
   * @param {{x: number, y: number}} img - Grab position (normalised)
   * @param {number} insertIndex - Position in controlPoints to insert at
   */
  beginEdgeBend(edge, img, insertIndex) {
    if (!this.active) return;
    const index = Math.max(0, Math.min(edge.controlPoints.length, insertIndex));
    edge.controlPoints.splice(index, 0, { x: img.x, y: img.y });
    this.drag = {
      kind: 'control', edgeId: edge.id, controlIndex: index,
      origX: img.x, origY: img.y, moved: false, inserted: true,
    };
    this.selectControlPoint(edge, index);
    this.eventBus.emit('network:changed', { commit: false });
  }

  /**
   * Continue the in-flight drag.
   * @param {{x: number, y: number}} img - Pointer position (normalised)
   * @param {boolean} [shift=false] - 15° angle snap (node drags)
   */
  moveDrag(img, shift = false) {
    if (!this.active || !this.drag) return;

    if (this.drag.kind === 'node') {
      const node = this.layer.graph.getNode(this.drag.nodeId);
      if (!node) { this.drag = null; return; }
      let { x, y } = img;
      if (shift) {
        // Snap against the first connected neighbour, so links land on
        // clean angles — mirrors Shift while dragging a waypoint
        const ref = this._firstNeighbour(node.id);
        if (ref) ({ x, y } = snapToAngle(ref.x, ref.y, x, y));
      }
      node.moveTo(x, y);
      this.drag.moved = node.x !== this.drag.origX || node.y !== this.drag.origY;
    } else {
      const edge = this.layer.graph.getEdge(this.drag.edgeId);
      const p = edge?.controlPoints[this.drag.controlIndex];
      if (!p) { this.drag = null; return; }
      p.x = Math.max(0, Math.min(1, img.x));
      p.y = Math.max(0, Math.min(1, img.y));
      this.drag.moved = p.x !== this.drag.origX || p.y !== this.drag.origY;
    }
    this.eventBus.emit('network:changed', { commit: false });
  }

  /**
   * Finish the drag: one undo entry for the whole gesture (matches
   * waypoint drag-end). A drag that never moved commits nothing.
   */
  endDrag() {
    if (!this.active || !this.drag) return;
    const moved = this.drag.moved;
    const inserted = this.drag.inserted === true;
    this.drag = null;
    if (moved || inserted) {
      this.eventBus.emit('network:changed', { commit: true });
    }
  }

  /** Cancel the drag, restoring the grabbed point (Esc mid-drag). */
  cancelDrag() {
    if (!this.active || !this.drag) return;
    if (this.drag.kind === 'node') {
      const node = this.layer.graph.getNode(this.drag.nodeId);
      if (node) node.moveTo(this.drag.origX, this.drag.origY);
    } else if (this.drag.inserted) {
      const edge = this.layer.graph.getEdge(this.drag.edgeId);
      if (edge) edge.removeControlPoint(this.drag.controlIndex);
      if (edge && this.selection?.kind === 'edge' && this.selection.id === edge.id &&
          this.selection.controlIndex === this.drag.controlIndex) {
        const previous = this.selection;
        this.selection = { kind: 'edge', id: edge.id };
        this._emitControlDeselected(previous);
      }
    } else {
      const edge = this.layer.graph.getEdge(this.drag.edgeId);
      const point = edge?.controlPoints[this.drag.controlIndex];
      if (point) {
        point.x = this.drag.origX;
        point.y = this.drag.origY;
      }
    }
    this.drag = null;
    this.eventBus.emit('render:request');
  }

  /** @private First node connected to nodeId (deterministic reference for snapping). */
  _firstNeighbour(nodeId) {
    const edge = this.layer.graph.getEdgesForNode(nodeId)[0];
    if (!edge) return null;
    const otherId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
    return this.layer.graph.getNode(otherId);
  }

  // ── hover / pen preview ─────────────────────────────────

  /**
   * Record the idle hover target and cursor position (pen preview line).
   * @param {Object|null} hit - Mixin hit-test result
   * @param {{x: number, y: number}|null} img - Pointer position (normalised)
   * @returns {string|null} Hover kind for the cursor
   */
  setHover(hit, img) {
    this.cursorImg = img;
    const next = hit
      ? { kind: hit.kind, id: hit.node?.id || hit.edge?.id, controlIndex: hit.controlIndex }
      : null;
    const changed = (this.hover?.kind !== next?.kind) ||
                    (this.hover?.id !== next?.id) ||
                    (this.hover?.controlIndex !== next?.controlIndex);
    this.hover = next;
    if (changed || this.penNodeId) this.eventBus.emit('render:request');
    return next?.kind || null;
  }

  // ── keys ────────────────────────────────────────────────

  /**
   * Mode keys, on the capture phase so global shortcuts stay out
   * (area draw precedent). Esc: cancel drag → lift pen → exit.
   * @private
   */
  _handleKeyDown(e) {
    if (!this.active) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (this.drag) {
        this.cancelDrag();
      } else if (this.penNodeId) {
        this.penNodeId = null;
        this.eventBus.emit('render:request');
      } else if (this.selection) {
        this.clearSelection();
        this.eventBus.emit('render:request');
      } else {
        this.exit();
      }
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selection) {
      e.preventDefault();
      e.stopPropagation();
      this.deleteSelection();
    } else if (e.key.toLowerCase() === 't' && this.selection?.kind === 'node') {
      e.preventDefault();
      e.stopPropagation();
      this.cycleSelectedNodeType();
    }
  }

  // ── banner ──────────────────────────────────────────────

  /** @private */
  _showBanner() {
    this._hideBanner();

    this._banner = document.createElement('div');
    this._banner.id = 'network-edit-banner';
    this._banner.setAttribute('role', 'status');
    this._banner.setAttribute('aria-live', 'polite');
    this._banner.innerHTML = `
      <span class="banner-text">
        <strong>Drawing network</strong> — click places a linked node,
        click a node to continue from it, drag an edge to bend it.
        <kbd>Esc</kbd> lifts the pen.
        <span class="banner-count"></span>
      </span>
      <button class="banner-done" type="button" aria-label="Finish network editing">Done</button>
    `;

    // Inline styles, same pattern as the area-draw banner (transient element)
    Object.assign(this._banner.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      zIndex: '1000',
      padding: '8px 16px',
      background: 'var(--scope-crowd-fg, #0E4A38)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontFamily: 'var(--font-ui, "IBM Plex Sans", sans-serif)',
      fontSize: '14px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
    });

    const doneBtn = this._banner.querySelector('.banner-done');
    Object.assign(doneBtn.style, {
      background: 'transparent',
      border: '1px solid #fff',
      color: '#fff',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '13px'
    });
    doneBtn.addEventListener('click', () => this.exit());

    document.body.appendChild(this._banner);
    this._updateBannerCount();
  }

  /** @private */
  _updateBannerCount() {
    if (!this._banner || !this.layer) return;
    const countEl = this._banner.querySelector('.banner-count');
    if (!countEl) return;
    const nodes = this.layer.graph.getNodes().length;
    const edges = this.layer.graph.getEdges().length;
    countEl.textContent = nodes === 0
      ? 'Click the map to start.'
      : `${nodes} node${nodes === 1 ? '' : 's'} · ${edges} edge${edges === 1 ? '' : 's'}`;
  }

  /** @private */
  _hideBanner() {
    if (this._banner?.parentNode) {
      this._banner.parentNode.removeChild(this._banner);
    }
    this._banner = null;
  }

  // ── rendering (called from RenderingService.VECTOR_LAYERS) ──

  /**
   * Draw a layer's guide network: edges through the engine's own
   * geometry cache (the drawn curve IS the travelled curve), one-way
   * arrows, and typed node glyphs — triangle in, circle through,
   * square out. Shown whenever a graph-guided crowd is selected, in
   * the crowd's dot colour. Passive inspector selections are emphasised
   * here because the separate pen overlay remains active-mode-only.
   *
   * @param {RenderingService} svc - For scaleSizeClamped sizing
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} state - renderState (imageToCanvas, swarmEngine)
   * @param {import('../models/FlowLayer.js').FlowLayer} layer
   */
  renderGuide(svc, ctx, state, layer) {
    const graph = layer.graph;
    const nodes = graph.getNodes();
    if (nodes.length === 0) return;

    const ink = layer.emitters[0]?.dotColor || '#56B4E9';
    const lineWidth = svc.scaleSizeClamped(2);
    const selectedNodeId = this.layer === layer && this.selection?.kind === 'node'
      ? this.selection.id
      : null;
    const selectedShares = selectedNodeId
      ? getGraphDepartureShares(graph, selectedNodeId)
      : [];
    const shareByEdgeId = selectedShares.length >= 2
      ? new Map(selectedShares.map(({ edge, share }) => [edge.id, share]))
      : new Map();

    ctx.save();

    // Edges
    ctx.strokeStyle = ink;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.55;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const edge of graph.getEdges()) {
      const pts = this._edgeCanvasPoints(state, graph, edge);
      if (pts.length < 2) continue;
      const share = shareByEdgeId.get(edge.id);
      ctx.lineWidth = share === undefined
        ? lineWidth
        : svc.scaleSizeClamped(2 + 6 * Math.sqrt(share));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      if (edge.direction === 'one-way') {
        this._drawArrow(ctx, pts, ink, svc.scaleSizeClamped(7));
      }
    }

    // Nodes
    ctx.globalAlpha = 1;
    const r = svc.scaleSizeClamped(7);
    for (const node of nodes) {
      const p = state.imageToCanvas(node.position().x, node.position().y);
      this._drawNodeGlyph(ctx, p, node.type, r, ink);
    }

    if (!this.active && this.layer === layer) {
      this._drawSelectionAffordances(svc, ctx, state, graph, ink, r);
    }

    ctx.restore();
  }

  /**
   * Draw active-mode affordances: pen ring + dashed preview line, hover,
   * drag handles, and selection. Passive selection is drawn by renderGuide;
   * this guard ensures pen/hover/drag language can never leak into it.
   *
   * @param {RenderingService} svc
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} state - renderState
   */
  renderOverlay(svc, ctx, state) {
    if (!this.active || !this.layer) return;
    const graph = this.layer.graph;
    const ink = this.layer.emitters[0]?.dotColor || '#56B4E9';
    const r = svc.scaleSizeClamped(7);

    ctx.save();

    // Hovered edge: wider glow beneath (leg-hover language)
    if (this.hover?.kind === 'edge' && (!this.drag || this.drag.kind !== 'control')) {
      const edge = graph.getEdge(this.hover.id);
      if (edge) {
        const pts = this._edgeCanvasPoints(state, graph, edge);
        if (pts.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.strokeStyle = ink;
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = svc.scaleSizeClamped(7);
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    this._drawSelectionAffordances(svc, ctx, state, graph, ink, r);
    const selNode = this.selectedNode();

    // Hovered node: solid two-tone ring (hover-affordance language)
    if (this.hover?.kind === 'node') {
      const node = graph.getNode(this.hover.id);
      if (node && node.id !== selNode?.id) {
        const p = state.imageToCanvas(node.position().x, node.position().y);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Pen: ring on the pen node + dashed preview line to the cursor
    const penNode = this.penNodeId ? graph.getNode(this.penNodeId) : null;
    if (penNode) {
      const p = state.imageToCanvas(penNode.x, penNode.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (this.cursorImg && !this.drag) {
        const c = state.imageToCanvas(this.cursorImg.x, this.cursorImg.y);
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(c.x, c.y);
        ctx.strokeStyle = ink;
        ctx.lineWidth = svc.scaleSizeClamped(1.5);
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }

  /**
   * Draw selection-only emphasis shared by active authoring and passive
   * semantic inspection. The selected control point receives a larger,
   * two-tone square while sibling bend points retain ordinary handles.
   * @private
   */
  _drawSelectionAffordances(svc, ctx, state, graph, ink, r) {
    ctx.save();

    const selEdge = this.selectedEdge();
    if (selEdge) {
      const pts = this._edgeCanvasPoints(state, graph, selEdge);
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = SELECTION_OUTER;
        ctx.lineWidth = svc.scaleSizeClamped(4.5);
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.strokeStyle = SELECTION_INNER;
        ctx.lineWidth = svc.scaleSizeClamped(2.5);
        ctx.globalAlpha = 1;
        ctx.stroke();
      }

      const selectedControl = this.selectedControlPoint();
      for (let index = 0; index < selEdge.controlPoints.length; index++) {
        const p = selEdge.controlPoints[index];
        const c = state.imageToCanvas(p.x, p.y);
        const isSelected = selectedControl?.index === index;
        // Ordinary handles imply drag capability, so passive inspection
        // draws only the specifically selected bend point.
        if (!this.active && !isSelected) continue;
        const size = isSelected ? 7 : 5;
        ctx.fillStyle = SELECTION_OUTER;
        ctx.fillRect(c.x - size, c.y - size, size * 2, size * 2);
        ctx.strokeStyle = isSelected ? SELECTION_OUTER : ink;
        ctx.lineWidth = isSelected ? 4 : 1.5;
        ctx.strokeRect(c.x - size, c.y - size, size * 2, size * 2);
        if (isSelected) {
          ctx.strokeStyle = SELECTION_INNER;
          ctx.lineWidth = 2;
          ctx.strokeRect(c.x - size, c.y - size, size * 2, size * 2);
        }
      }
    }

    const selNode = this.selectedNode();
    if (selNode) {
      const p = state.imageToCanvas(selNode.x, selNode.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = SELECTION_OUTER;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = SELECTION_INNER;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  /**
   * An edge's smoothed polyline in canvas coordinates, via the engine's
   * per-edge geometry cache.
   * @private
   * @returns {Array<{x: number, y: number}>}
   */
  _edgeCanvasPoints(state, graph, edge) {
    const geom = state.swarmEngine.edgeGeometry(graph, edge);
    return geom.points.map(p => state.imageToCanvas(p.x, p.y));
  }

  /** @private Direction arrow at the polyline midpoint, along the local tangent. */
  _drawArrow(ctx, pts, ink, size) {
    const mid = Math.floor(pts.length / 2);
    const a = pts[Math.max(0, mid - 1)];
    const b = pts[Math.min(pts.length - 1, mid + 1)];
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const tip = pts[mid];

    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, size * 0.6);
    ctx.lineTo(-size * 0.6, -size * 0.6);
    ctx.closePath();
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.restore();
  }

  /**
   * @private Typed node glyph: entry = triangle, exit = square,
   * pass-through = circle. Filled ink with a white outline so nodes
   * read against any background (waypoint marker language).
   */
  _drawNodeGlyph(ctx, p, type, r, ink) {
    ctx.beginPath();
    if (type === 'entry') {
      ctx.moveTo(p.x, p.y - r);
      ctx.lineTo(p.x + r * 0.87, p.y + r * 0.5);
      ctx.lineTo(p.x - r * 0.87, p.y + r * 0.5);
      ctx.closePath();
    } else if (type === 'exit') {
      const s = r * 0.8;
      ctx.rect(p.x - s, p.y - s, s * 2, s * 2);
    } else {
      ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
    }
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
