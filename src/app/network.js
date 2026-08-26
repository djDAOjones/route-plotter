/**
 * Network editing glue (Phase 4): the Guide card's Edit-network entry
 * point, canvas pointer routing into NetworkEditService, node/edge
 * hit-testing on the engine's own edge geometry, and the Node/Edge
 * inspector cards.
 *
 * Division of labour: NetworkEditService owns tool state and model
 * mutations; this mixin owns coordinate transforms, hit-testing, the
 * cards, and the undo/autosave/render answer to `network:changed` —
 * the same seams the crowds mixin uses.
 *
 * RoutePlotter prototype mixin: `this` is the RoutePlotter instance;
 * main.js attaches the group via Object.assign(RoutePlotter.prototype,
 * networkMixin). Method names must stay unique across mixins
 * (tests/mixins.test.js).
 */
import { INTERACTION } from '../config/constants.js';
import { isMac } from '../config/keybindings.js';
import { getGraphDepartureShares } from '../utils/graphRouting.js';
import { nearestOnPolyline } from '../utils/segmentHitTest.js';

const NODE_TYPE_LABELS = {
  normal: 'pass-through',
  entry: 'entry',
  exit: 'exit',
};

/** Compact author-facing weight text without losing useful decimals. */
function formatWeight(weight) {
  return Number(weight.toFixed(2)).toString();
}

export const networkMixin = {

  /**
   * Wire the Guide card entry point, the pointer events InteractionHandler
   * forwards during the mode, and the Node/Edge card controls.
   * Call once at init, after the static DOM exists.
   */
  setupNetworkControls() {
    this._editNetworkBtn = document.getElementById('network-edit-btn');
    this._guideHintEl = document.getElementById('crowd-guide-hint');

    this._editNetworkBtn?.addEventListener('click', () => this.enterNetworkEditMode());

    // ── Guide changes (emitted by the crowds mixin's select wiring) ──
    // Switching an empty-network crowd to Custom network hands the user
    // the pen immediately; switching back to route while drawing exits.
    this.eventBus.on('network:guide-changed', (layer) => {
      if (layer.guideType === 'graph' && layer.graph.getNodes().length === 0) {
        this.enterNetworkEditMode();
      } else if (layer.guideType === 'route' && this.networkEditService.active) {
        this.networkEditService.exit();
      }
      this.updateGuideCard();
    });

    // ── Mode exits on scope/context changes ─────────────────
    // The mode edits the selected crowd's network; when that stops being
    // true (deselect, other crowd, preview, crowd deleted) it closes.
    this.eventBus.on('crowd:deselected', () => {
      if (this.networkEditService.active) this.networkEditService.exit();
    });
    this.eventBus.on('crowd:selected', (layer) => {
      if (this.networkEditService.active && this.networkEditService.layer !== layer) {
        this.networkEditService.exit();
      }
      this.updateGuideCard();
    });
    this.eventBus.on('motion:preview-mode-change', (previewMode) => {
      if (previewMode && this.networkEditService.active) this.networkEditService.exit();
    });
    // Keep the Guide card's button state in step with the mode itself
    // (Done button and Esc exit without passing through this mixin)
    this.eventBus.on('network:edit-mode-changed', () => this.updateGuideCard());

    // ── Central change pipeline ─────────────────────────────
    // Gesture commits snapshot immediately (like waypoint edits); mid-drag
    // frames only render. Slider-y card edits use crowd:param-changed for
    // its debounced undo instead.
    this.eventBus.on('network:changed', ({ commit } = {}) => {
      if (commit) {
        this.saveUndoState();
        this.autoSave();
        this.updateGuideCard();
        this.syncNetworkCards();
      }
      this.queueRender();
    });

    // ── Pointer events from InteractionHandler (mode only) ──
    this.eventBus.on('network:click', ({ x, y, shiftKey }) => {
      this._handleNetworkClick(x, y, shiftKey);
    });
    this.eventBus.on('network:drag-start', ({ x, y }) => {
      this._handleNetworkDragStart(x, y);
    });
    this.eventBus.on('network:drag-move', ({ x, y, shiftKey }) => {
      const svc = this.networkEditService;
      if (!svc.active || !svc.drag) return;
      svc.moveDrag(this._networkImgPos(x, y), shiftKey);
    });
    this.eventBus.on('network:drag-end', () => {
      this.networkEditService.endDrag();
    });
    this.eventBus.on('network:hover-move', ({ x, y }, callback) => {
      const svc = this.networkEditService;
      if (!svc.active) {
        if (callback) callback(null);
        return;
      }
      const hit = this.findNetworkTargetAt(x, y);
      const kind = svc.setHover(hit, this._networkImgPos(x, y));
      if (callback) callback(kind);
    });
    this.eventBus.on('network:hover-clear', () => {
      if (this.networkEditService.active) this.networkEditService.setHover(null, null);
    });

    // ── Selection → cards ───────────────────────────────────
    this.eventBus.on('network:node-selected', () => this.syncNetworkCards());
    this.eventBus.on('network:edge-selected', () => this.syncNetworkCards());
    this.eventBus.on('network:node-deselected', () => this._syncNodePathWeights(null));

    // ── Node card (single-writer wiring) ────────────────────
    document.getElementById('network-node-type')?.addEventListener('change', (e) => {
      this.networkEditService.setSelectedNodeType(e.target.value);
    });
    document.getElementById('network-node-delete')?.addEventListener('click', () => {
      this._deleteNetworkSelection('node');
    });

    // ── Edge card ───────────────────────────────────────────
    document.getElementById('network-edge-direction')?.addEventListener('change', (e) => {
      this.networkEditService.setSelectedEdgeDirection(e.target.value);
    });
    document.getElementById('network-edge-swap')?.addEventListener('click', () => {
      this.networkEditService.swapSelectedEdgeDirection();
    });
    document.getElementById('network-edge-delete')?.addEventListener('click', () => {
      this._deleteNetworkSelection('edge');
    });
    document.getElementById('network-edge-weight')?.addEventListener('input', (e) => {
      const edge = this.networkEditService.selectedEdge();
      if (!edge) return;
      edge.setWeight(parseFloat(e.target.value) / 10);
      this._updateEdgeShareReadout(edge);
      // Debounced undo + autosave + render — the crowd param pipeline
      this.eventBus.emit('crowd:param-changed');
    });
  },

  /**
   * Enter network edit mode for the selected crowd (Guide card button,
   * or automatically when an empty-network crowd switches to Custom
   * network).
   */
  enterNetworkEditMode() {
    const layer = this.selectedCrowd;
    if (!layer) return;
    const svc = this.networkEditService;
    if (svc.active && svc.layer === layer) return;
    // Drawing a network is editing: leave Preview through the canonical
    // switch (flipping back to Preview later closes the mode)
    this._setPreviewMode(false);
    svc.enter(layer);
    this.updateGuideCard();
    this.announce('Network editing — click the map to place linked nodes. Escape lifts the pen.');
  },

  /**
   * Delete the network selection from a card button, with the standard
   * delete toast (shift-click's sibling).
   * @param {string} kind - 'node' | 'edge' (for the toast noun)
   * @private
   */
  _deleteNetworkSelection(kind) {
    this.networkEditService.deleteSelection();
    this.eventBus.emit('ui:toast', {
      message: `Deleted ${kind} — press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`
    });
  },

  // ── pointer routing ───────────────────────────────────────

  /**
   * A network click: control > node > edge > empty canvas, mirroring
   * the mousedown cascade order everywhere else in the app.
   * @private
   */
  _handleNetworkClick(x, y, shiftKey) {
    const svc = this.networkEditService;
    if (!svc.active) return;

    const hit = this.findNetworkTargetAt(x, y);

    if (!hit) {
      // Empty canvas: place a node (within the image, like waypoints)
      if (!this.isWithinImageBounds(x, y)) return;
      svc.placeNode(this._networkImgPos(x, y), shiftKey);
      this.announce('Node placed');
      return;
    }

    if (shiftKey) {
      // Shift-click deletes, with the standard undo toast
      if (hit.kind === 'node') {
        svc.deleteNode(hit.node);
        this.eventBus.emit('ui:toast', {
          message: `Deleted node — press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`
        });
      } else if (hit.kind === 'control') {
        svc.deleteControlPoint(hit.edge, hit.controlIndex);
      } else {
        svc.deleteEdge(hit.edge);
        this.eventBus.emit('ui:toast', {
          message: `Deleted edge — press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`
        });
      }
      return;
    }

    if (hit.kind === 'node') {
      svc.clickNode(hit.node);
    } else if (hit.kind === 'edge' || hit.kind === 'control') {
      svc.selectEdge(hit.edge);
    }
  },

  /**
   * A drag passed the movement threshold: grab what was under the
   * pointer at mousedown — control handle, node, or edge (bend).
   * @private
   */
  _handleNetworkDragStart(x, y) {
    const svc = this.networkEditService;
    if (!svc.active) return;
    const hit = this.findNetworkTargetAt(x, y);
    if (!hit) return;

    if (hit.kind === 'control') {
      svc.beginControlDrag(hit.edge, hit.controlIndex);
    } else if (hit.kind === 'node') {
      svc.beginNodeDrag(hit.node);
    } else {
      svc.beginEdgeBend(hit.edge, this._networkImgPos(x, y), hit.insertIndex);
    }
  },

  /** @private Screen → normalised image position, clamped to the image. */
  _networkImgPos(screenX, screenY) {
    const img = this.screenToImage(screenX, screenY);
    return { x: Math.max(0, Math.min(1, img.x)), y: Math.max(0, Math.min(1, img.y)) };
  },

  // ── hit-testing ───────────────────────────────────────────

  /**
   * What the pointer is over in the active network: a control handle of
   * the selected edge, a node, or an edge. Radii are screen-constant
   * (divide by zoom — findWaypointAt's rule); edges hit-test on the
   * engine's smoothed polyline, so the curve you see is the curve you
   * grab. Edge hits carry the controlPoints insertion index for bends,
   * from the nearest gap in the straight anchor chain.
   *
   * @param {number} screenX - X in screen space (CSS pixels)
   * @param {number} screenY - Y in screen space (CSS pixels)
   * @returns {{kind: 'node'|'edge'|'control', node?: Object, edge?: Object,
   *            controlIndex?: number, insertIndex?: number}|null}
   */
  findNetworkTargetAt(screenX, screenY) {
    const svc = this.networkEditService;
    if (!svc.active) return null;
    const graph = svc.layer.graph;

    const click = this.screenToCanvas(screenX, screenY);
    const zoom = this.viewport?.zoom || 1;

    // Control handles of the selected edge sit on top
    const selEdge = svc.selectedEdge();
    if (selEdge) {
      const threshold = INTERACTION.NETWORK_CONTROL_HIT_RADIUS / zoom;
      for (let i = 0; i < selEdge.controlPoints.length; i++) {
        const p = this.imageToCanvas(selEdge.controlPoints[i].x, selEdge.controlPoints[i].y);
        if (Math.hypot(click.x - p.x, click.y - p.y) <= threshold) {
          return { kind: 'control', edge: selEdge, controlIndex: i };
        }
      }
    }

    // Nodes next (closest within the radius, not first-match)
    const nodeThreshold = INTERACTION.NODE_HIT_RADIUS / zoom;
    let bestNode = null;
    let bestNodeDist = Infinity;
    for (const node of graph.getNodes()) {
      const p = this.imageToCanvas(node.x, node.y);
      const dist = Math.hypot(click.x - p.x, click.y - p.y);
      if (dist <= nodeThreshold && dist < bestNodeDist) {
        bestNode = node;
        bestNodeDist = dist;
      }
    }
    if (bestNode) return { kind: 'node', node: bestNode };

    // Edges: nearest smoothed polyline within the radius
    const edgeThreshold = INTERACTION.NETWORK_EDGE_HIT_RADIUS / zoom;
    let bestEdge = null;
    let bestEdgeDist = Infinity;
    for (const edge of graph.getEdges()) {
      const geom = this.swarmEngine.edgeGeometry(graph, edge);
      const pts = geom.points.map(p => this.imageToCanvas(p.x, p.y));
      const nearest = nearestOnPolyline(pts, click.x, click.y);
      if (nearest && nearest.dist <= edgeThreshold && nearest.dist < bestEdgeDist) {
        bestEdge = edge;
        bestEdgeDist = nearest.dist;
      }
    }
    if (bestEdge) {
      // Insertion index for bends: nearest straight gap in the anchor
      // chain source → controls → target (the smoothed curve passes
      // through every anchor, so the nearest gap is the grabbed span)
      const source = graph.getNode(bestEdge.sourceId);
      const target = graph.getNode(bestEdge.targetId);
      const chain = [
        this.imageToCanvas(source.x, source.y),
        ...bestEdge.controlPoints.map(p => this.imageToCanvas(p.x, p.y)),
        this.imageToCanvas(target.x, target.y),
      ];
      const onChain = nearestOnPolyline(chain, click.x, click.y);
      return { kind: 'edge', edge: bestEdge, insertIndex: Math.floor(onChain.index) };
    }

    return null;
  },

  // ── cards ─────────────────────────────────────────────────

  /**
   * Sync the Guide card's network row: the Edit-network button shows for
   * graph-guided crowds, and the hint names the state (no network yet /
   * node-edge counts / route following).
   */
  updateGuideCard() {
    const layer = this.selectedCrowd;
    if (this._editNetworkBtn) {
      const graphGuided = !!layer && layer.guideType === 'graph';
      this._editNetworkBtn.hidden = !graphGuided;
      this._editNetworkBtn.disabled = this.networkEditService.active;
      this._editNetworkBtn.textContent =
        this.networkEditService.active ? 'Editing network…' : 'Edit network';
    }
    if (this._guideHintEl && layer) {
      if (layer.guideType !== 'graph') {
        this._guideHintEl.textContent = 'Dots follow your route. Custom network lets you draw paths of their own.';
      } else {
        const nodes = layer.graph.getNodes().length;
        const edges = layer.graph.getEdges().length;
        const networkHint = nodes === 0
          ? 'No network yet — Edit network hands you the pen.'
          : `Dots walk this crowd's own network (${nodes} node${nodes === 1 ? '' : 's'}, `
            + `${edges} edge${edges === 1 ? '' : 's'}).`;
        const timingHint = this.waypoints?.length < 2
          ? ' Add at least two route waypoints to set the master timing before previewing or exporting.'
          : '';
        this._guideHintEl.textContent = networkHint + timingHint;
      }
    }
  },

  /**
   * Push the selected node/edge into the Node/Edge card controls.
   * Safe with no selection (cards are hidden then anyway).
   */
  syncNetworkCards() {
    const svc = this.networkEditService;

    const node = svc.selectedNode();
    if (node) {
      const typeEl = document.getElementById('network-node-type');
      if (typeEl) typeEl.value = node.type;
    }
    this._syncNodePathWeights(node);

    const edge = svc.selectedEdge();
    if (edge) {
      const dirEl = document.getElementById('network-edge-direction');
      if (dirEl) dirEl.value = edge.direction;
      const swapBtn = document.getElementById('network-edge-swap');
      if (swapBtn) swapBtn.hidden = edge.direction !== 'one-way';
      const weightEl = document.getElementById('network-edge-weight');
      if (weightEl) weightEl.value = Math.round(edge.weight * 10);
      this._updateEdgeShareReadout(edge);
    }
  },

  /**
   * Build the selected junction's relative-weight rows. The visible rows are
   * the exact directionally valid departures used by SwarmEngine; a single
   * path has no choice to weight, so the fieldset stays hidden.
   * @param {Object|null} node
   * @private
   */
  _syncNodePathWeights(node) {
    const fieldset = document.getElementById('network-path-weights');
    const rowsEl = document.getElementById('network-path-weight-rows');
    if (!fieldset || !rowsEl) return;

    rowsEl.replaceChildren();
    const svc = this.networkEditService;
    if (!node || !svc.active) {
      fieldset.hidden = true;
      return;
    }

    const graph = svc.layer.graph;
    const departures = getGraphDepartureShares(graph, node.id);
    if (departures.length < 2) {
      fieldset.hidden = true;
      return;
    }

    const nodes = graph.getNodes();
    departures.forEach((departure, index) => {
      const destinationId = departure.reversed
        ? departure.edge.sourceId
        : departure.edge.targetId;
      const destination = graph.getNode(destinationId);
      const type = destination?.type || 'normal';
      const ordinal = Math.max(1,
        nodes.filter(candidate => candidate.type === type)
          .findIndex(candidate => candidate.id === destinationId) + 1
      );
      const inputId = `network-path-weight-${index + 1}`;
      const nameId = `${inputId}-name`;
      const outputId = `${inputId}-value`;

      const row = document.createElement('label');
      row.className = 'network-path-weight-row';
      row.dataset.edgeId = departure.edge.id;

      const name = document.createElement('span');
      name.id = nameId;
      name.className = 'network-path-weight-name';
      name.textContent = `Path ${index + 1} to ${NODE_TYPE_LABELS[type]} ${ordinal}`;

      const input = document.createElement('input');
      input.id = inputId;
      input.type = 'number';
      input.min = '0.01';
      input.step = '0.01';
      input.value = formatWeight(departure.edge.weight);
      input.setAttribute('aria-labelledby', nameId);
      input.setAttribute('aria-describedby', `${outputId} network-path-weights-help`);
      input.addEventListener('input', () => {
        const weight = Number(input.value);
        if (!Number.isFinite(weight) || weight < 0.01) {
          input.setCustomValidity('Enter a weight of 0.01 or more.');
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        input.setCustomValidity('');
        input.removeAttribute('aria-invalid');
        departure.edge.setWeight(weight);
        this._updateNodePathWeightReadouts(node.id);
        // crowd:param-changed → crowds mixin → debounced undo/autosave/render.
        this.eventBus.emit('crowd:param-changed');
      });
      input.addEventListener('change', () => {
        if (input.validity.valid) return;
        input.value = formatWeight(departure.edge.weight);
        input.setCustomValidity('');
        input.removeAttribute('aria-invalid');
      });

      const output = document.createElement('output');
      output.id = outputId;
      output.className = 'network-path-weight-value';
      output.setAttribute('for', inputId);

      row.append(name, input, output);
      rowsEl.appendChild(row);
    });

    fieldset.hidden = false;
    this._updateNodePathWeightReadouts(node.id);
  },

  /** Update every displayed percentage after one relative weight changes. */
  _updateNodePathWeightReadouts(nodeId) {
    const rowsEl = document.getElementById('network-path-weight-rows');
    const graph = this.networkEditService.layer?.graph;
    if (!rowsEl || !graph) return;
    const shares = new Map(
      getGraphDepartureShares(graph, nodeId).map(share => [share.edge.id, share])
    );
    for (const row of rowsEl.querySelectorAll('.network-path-weight-row')) {
      const share = shares.get(row.dataset.edgeId);
      const output = row.querySelector('.network-path-weight-value');
      if (share && output) {
        output.textContent = `Weight ${formatWeight(share.edge.weight)} · ${share.percent}%`;
      }
    }
  },

  /**
   * Configured junction shares for the selected edge. Actual choices can be
   * renormalised by arrival path because the walk avoids an immediate U-turn
   * whenever another departure exists.
   * @param {Object} edge
   * @private
   */
  _updateEdgeShareReadout(edge) {
    const valueEl = document.getElementById('network-edge-weight-value');
    const svc = this.networkEditService;
    if (!valueEl || !svc.active) return;
    const graph = svc.layer.graph;

    const shareFrom = (nodeId) =>
      getGraphDepartureShares(graph, nodeId)
        .find(share => share.edge.id === edge.id)?.percent ?? 0;

    valueEl.textContent = edge.direction === 'one-way'
      ? `${shareFrom(edge.sourceId)}% configured share`
      : `${shareFrom(edge.sourceId)}% · ${shareFrom(edge.targetId)}% configured shares`;
  },

  /**
   * After a restore (undo/redo) rebuilt the scene, the mode's layer and
   * selection references are stale. Re-bind by id; if the layer is gone
   * or no longer the selected crowd, the mode closes.
   */
  resolveNetworkAfterRestore() {
    const svc = this.networkEditService;
    if (!svc.active) return;
    const fresh = this.scene.getFlowLayer(svc.layer.id);
    if (!fresh || this.selectedCrowd !== fresh) {
      svc.exit();
    } else {
      svc.rebind(fresh);
      this.syncNetworkCards();
    }
    this.updateGuideCard();
  }
};
