/**
 * GraphInteractionHandler — mouse and keyboard input for graph editing.
 *
 * Responsibilities:
 * - Click on empty canvas → add node
 * - Click on existing node → select it
 * - Click + drag on node → move it
 * - Click on edge → select it
 * - Shift-click node while another node is selected → create edge between them
 * - Delete/Backspace → delete selected node (cascade edges) or edge
 * - Escape → deselect
 * - Double-click node → cycle type (normal → entry → exit → normal)
 *
 * Emits events via EventBus. Never mutates GraphModel directly — all
 * mutations go through the model's own methods, triggered by events.
 *
 * Coordinate pipeline: screen → canvas → image (normalised 0–1).
 * Uses the app's screenToImage / imageToCanvas helpers.
 */

import { EventBus } from '../core/EventBus.js';
import { INTERACTION } from '../config/constants.js';

/** @constant {number} Radius in canvas px for node hit-testing */
const NODE_HIT_RADIUS = 12;

/** @constant {number} Distance in canvas px for edge hit-testing */
const EDGE_HIT_DISTANCE = 8;

export class GraphInteractionHandler {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {EventBus} eventBus
   * @param {Object} app — reference to DotCrowdNavigator for coord helpers
   */
  constructor(canvas, eventBus, app) {
    this._canvas = canvas;
    this._eventBus = eventBus;
    this._app = app;

    // Interaction state
    this._isDragging = false;
    this._hasMoved = false;
    this._dragNodeId = null;
    this._dragStartImage = null; // normalised coords at drag start
    this._mouseDownPos = null;   // screen coords at mousedown
    this._selectedNodeId = null;
    this._selectedEdgeId = null;

    this._bindEvents();
  }

  // ── Public API ──────────────────────────────────────────

  /** Currently selected node id (or null) */
  get selectedNodeId() { return this._selectedNodeId; }

  /** Currently selected edge id (or null) */
  get selectedEdgeId() { return this._selectedEdgeId; }

  /** Deselect everything and notify */
  deselect() {
    this._selectedNodeId = null;
    this._selectedEdgeId = null;
    this._eventBus.emit('graph:selection:changed', { nodeId: null, edgeId: null });
  }

  /** Clean up all listeners */
  destroy() {
    this._canvas.removeEventListener('mousedown', this._onMouseDown);
    this._canvas.removeEventListener('mousemove', this._onMouseMove);
    this._canvas.removeEventListener('mouseup', this._onMouseUp);
    this._canvas.removeEventListener('dblclick', this._onDblClick);
    document.removeEventListener('keydown', this._onKeyDown);
  }

  // ── Private: event binding ──────────────────────────────

  _bindEvents() {
    // Bind handlers so we can remove them later
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onDblClick = this._handleDblClick.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);

    this._canvas.addEventListener('mousedown', this._onMouseDown);
    this._canvas.addEventListener('mousemove', this._onMouseMove);
    this._canvas.addEventListener('mouseup', this._onMouseUp);
    this._canvas.addEventListener('dblclick', this._onDblClick);
    document.addEventListener('keydown', this._onKeyDown);

    // Drag & drop background image
    this._canvas.addEventListener('dragover', (e) => e.preventDefault());
    this._canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this._eventBus.emit('app:background:drop', { file });
      }
    });

    // Wheel zoom (centered on mouse position)
    this._canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const viewport = this._app.viewport;
      const screen = this._screenPos(e);
      const canvasBefore = this._app.screenToCanvas(screen.x, screen.y);

      // Zoom factor: scroll up = zoom in, scroll down = zoom out
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(viewport.minZoom, Math.min(viewport.maxZoom, viewport.zoom * factor));

      if (newZoom === viewport.zoom) return;

      // Adjust pan so the point under the mouse stays fixed
      viewport.panX = canvasBefore.x - screen.x / newZoom;
      viewport.panY = canvasBefore.y - screen.y / newZoom;
      viewport.zoom = newZoom;

      this._eventBus.emit('viewport:changed');
    }, { passive: false });

    // Middle-button pan (or Cmd/Ctrl+left-drag)
    this._onMiddleDown = (e) => {
      if (e.button === 1 || (e.button === 0 && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        this._isPanning = true;
        this._panStart = this._screenPos(e);
        this._panOrigin = { x: this._app.viewport.panX, y: this._app.viewport.panY };
      }
    };
    this._onPanMove = (e) => {
      if (!this._isPanning) return;
      const screen = this._screenPos(e);
      const dx = screen.x - this._panStart.x;
      const dy = screen.y - this._panStart.y;
      const viewport = this._app.viewport;
      viewport.panX = this._panOrigin.x - dx / viewport.zoom;
      viewport.panY = this._panOrigin.y - dy / viewport.zoom;
      this._eventBus.emit('viewport:changed');
    };
    this._onPanUp = () => {
      this._isPanning = false;
    };
    this._canvas.addEventListener('mousedown', this._onMiddleDown);
    window.addEventListener('mousemove', this._onPanMove);
    window.addEventListener('mouseup', this._onPanUp);
  }

  // ── Private: coordinate helpers ─────────────────────────

  /** Get mouse position relative to canvas element (screen coords) */
  _screenPos(e) {
    const rect = this._canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Screen coords → normalised image coords (0–1) */
  _toImage(screenX, screenY) {
    return this._app.screenToImage(screenX, screenY);
  }

  /** Normalised image coords → canvas coords (for hit-testing) */
  _toCanvas(imageX, imageY) {
    return this._app.imageToCanvas(imageX, imageY);
  }

  // ── Private: hit-testing ────────────────────────────────

  /**
   * Find the node under the given screen position.
   * @returns {import('../models/GraphNode.js').GraphNode|null}
   */
  _hitTestNode(screenX, screenY) {
    const graphModel = this._app.graphModel;
    const nodes = graphModel.getNodes();
    const canvasPos = this._app.screenToCanvas(screenX, screenY);

    let closest = null;
    let closestDist = Infinity;

    for (const node of nodes) {
      const nodeCanvas = this._toCanvas(node.x, node.y);
      const dx = canvasPos.x - nodeCanvas.x;
      const dy = canvasPos.y - nodeCanvas.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < NODE_HIT_RADIUS && dist < closestDist) {
        closest = node;
        closestDist = dist;
      }
    }
    return closest;
  }

  /**
   * Find the edge nearest to the given screen position.
   * Simple point-to-line-segment distance (straight edges only for now).
   * @returns {import('../models/GraphEdge.js').GraphEdge|null}
   */
  _hitTestEdge(screenX, screenY) {
    const graphModel = this._app.graphModel;
    const edges = graphModel.getEdges();
    const canvasPos = this._app.screenToCanvas(screenX, screenY);

    let closest = null;
    let closestDist = Infinity;

    for (const edge of edges) {
      const srcNode = graphModel.getNode(edge.sourceId);
      const tgtNode = graphModel.getNode(edge.targetId);
      if (!srcNode || !tgtNode) continue;

      const a = this._toCanvas(srcNode.x, srcNode.y);
      const b = this._toCanvas(tgtNode.x, tgtNode.y);
      const dist = this._pointToSegmentDist(canvasPos.x, canvasPos.y, a.x, a.y, b.x, b.y);

      if (dist < EDGE_HIT_DISTANCE && dist < closestDist) {
        closest = edge;
        closestDist = dist;
      }
    }
    return closest;
  }

  /** Point-to-line-segment distance */
  _pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  // ── Private: mouse handlers ─────────────────────────────

  _handleMouseDown(e) {
    if (e.button !== 0) return; // left button only
    const screen = this._screenPos(e);
    this._mouseDownPos = screen;
    this._hasMoved = false;

    // Hit-test nodes first
    const hitNode = this._hitTestNode(screen.x, screen.y);
    if (hitNode) {
      // Shift-click: create edge from selected node to this node
      if (e.shiftKey && this._selectedNodeId && this._selectedNodeId !== hitNode.id) {
        this._createEdge(this._selectedNodeId, hitNode.id);
        return;
      }

      // Start drag
      this._isDragging = true;
      this._dragNodeId = hitNode.id;
      this._dragStartImage = { x: hitNode.x, y: hitNode.y };

      // Select this node
      this._selectNode(hitNode.id);
      return;
    }

    // Hit-test edges
    const hitEdge = this._hitTestEdge(screen.x, screen.y);
    if (hitEdge) {
      this._selectEdge(hitEdge.id);
      return;
    }

    // Clicked empty space — will add node on mouseup if no drag
  }

  _handleMouseMove(e) {
    if (!this._isDragging || !this._dragNodeId) return;

    const screen = this._screenPos(e);
    const threshold = INTERACTION.DRAG_THRESHOLD || 3;

    // Check if we've moved enough to count as a drag
    if (!this._hasMoved) {
      const dx = screen.x - this._mouseDownPos.x;
      const dy = screen.y - this._mouseDownPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) return;
      this._hasMoved = true;
    }

    // Move node to new position (normalised coords)
    const imagePos = this._toImage(screen.x, screen.y);
    const graphModel = this._app.graphModel;
    const node = graphModel.getNode(this._dragNodeId);
    if (node) {
      node.x = Math.max(0, Math.min(1, imagePos.x));
      node.y = Math.max(0, Math.min(1, imagePos.y));
      this._eventBus.emit('graph:node:moved', { node });
    }
  }

  _handleMouseUp(e) {
    if (e.button !== 0) return;
    const screen = this._screenPos(e);

    if (this._isDragging && this._hasMoved && this._dragNodeId) {
      // Drag completed — emit for undo
      this._eventBus.emit('graph:node:move:complete', {
        nodeId: this._dragNodeId,
        from: this._dragStartImage,
        to: { x: this._app.graphModel.getNode(this._dragNodeId)?.x, y: this._app.graphModel.getNode(this._dragNodeId)?.y }
      });
    } else if (!this._hasMoved && !this._isDragging) {
      // Click on empty space → add node (only if no node/edge was hit on mousedown)
      if (!this._hitTestNode(screen.x, screen.y) && !this._hitTestEdge(screen.x, screen.y)) {
        this._addNode(screen.x, screen.y);
      }
    }

    // Reset drag state
    this._isDragging = false;
    this._hasMoved = false;
    this._dragNodeId = null;
    this._dragStartImage = null;
    this._mouseDownPos = null;
  }

  _handleDblClick(e) {
    const screen = this._screenPos(e);
    const hitNode = this._hitTestNode(screen.x, screen.y);
    if (hitNode) {
      // Cycle type: normal → entry → exit → normal
      const types = ['normal', 'entry', 'exit'];
      const currentIndex = types.indexOf(hitNode.type);
      const nextType = types[(currentIndex + 1) % types.length];
      hitNode.type = nextType;
      this._selectNode(hitNode.id);
      this._eventBus.emit('graph:node:updated', { node: hitNode });
    }
  }

  // ── Private: keyboard ───────────────────────────────────

  _handleKeyDown(e) {
    // Don't intercept when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Escape') {
      this.deselect();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (this._selectedNodeId) {
        this._deleteNode(this._selectedNodeId);
      } else if (this._selectedEdgeId) {
        this._deleteEdge(this._selectedEdgeId);
      }
      return;
    }

    // Reset view (F key — fit/frame)
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      this._app.viewport.zoom = 1;
      this._app.viewport.panX = 0;
      this._app.viewport.panY = 0;
      this._eventBus.emit('viewport:changed');
      return;
    }

    // Space toggles simulation play/pause
    if (e.key === ' ' && this._app.simState) {
      e.preventDefault();
      this._app.simState.isPlaying = !this._app.simState.isPlaying;
      this._app._updateSimButtons();
      return;
    }

    const mod = e.metaKey || e.ctrlKey;

    // Save / Open project
    if (mod && e.key === 's') {
      e.preventDefault();
      this._app.saveProject();
      return;
    }
    if (mod && e.key === 'o') {
      e.preventDefault();
      document.getElementById('load-project-input')?.click();
      return;
    }

    // Undo/Redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this._eventBus.emit('app:undo');
    } else if (mod && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      this._eventBus.emit('app:redo');
    }
  }

  // ── Private: actions ────────────────────────────────────

  _addNode(screenX, screenY) {
    const imagePos = this._toImage(screenX, screenY);
    // Clamp to image bounds
    const x = Math.max(0, Math.min(1, imagePos.x));
    const y = Math.max(0, Math.min(1, imagePos.y));

    const node = this._app.graphModel.addNode({ x, y, type: 'normal' });
    this._selectNode(node.id);
    this._eventBus.emit('graph:node:added', { node });
  }

  _deleteNode(nodeId) {
    const graphModel = this._app.graphModel;
    const node = graphModel.getNode(nodeId);
    if (!node) return;

    graphModel.removeNode(nodeId); // cascade-deletes connected edges
    this.deselect();
    this._eventBus.emit('graph:node:deleted', { nodeId });
  }

  _deleteEdge(edgeId) {
    const graphModel = this._app.graphModel;
    graphModel.removeEdge(edgeId);
    this.deselect();
    this._eventBus.emit('graph:edge:deleted', { edgeId });
  }

  _createEdge(sourceId, targetId) {
    const graphModel = this._app.graphModel;
    // Check if edge already exists between these nodes
    const existing = graphModel.getEdges().find(
      e => (e.sourceId === sourceId && e.targetId === targetId) ||
           (e.sourceId === targetId && e.targetId === sourceId)
    );
    if (existing) return;

    try {
      const edge = graphModel.addEdge({ sourceId, targetId, weight: 1 });
      this._selectEdge(edge.id);
      this._eventBus.emit('graph:edge:added', { edge });
    } catch (err) {
      console.warn('Could not create edge:', err.message);
    }
  }

  _selectNode(nodeId) {
    this._selectedNodeId = nodeId;
    this._selectedEdgeId = null;
    this._eventBus.emit('graph:selection:changed', { nodeId, edgeId: null });
  }

  _selectEdge(edgeId) {
    this._selectedNodeId = null;
    this._selectedEdgeId = edgeId;
    this._eventBus.emit('graph:selection:changed', { nodeId: null, edgeId });
  }
}
