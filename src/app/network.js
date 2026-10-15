/**
 * Network editing glue (Phase 4): the Guide card's Edit-network entry
 * point, canvas pointer routing into NetworkEditService, node/edge
 * hit-testing on the engine's own edge geometry, and the Node/Edge
 * inspector cards.
 *
 * Division of labour: NetworkEditService owns tool state and legacy pen
 * mutations; this mixin owns area edits, coordinate transforms, hit-testing,
 * the cards, and the undo/autosave/render answer to `network:changed` —
 * the same seams the crowds mixin uses.
 *
 * RoutePlotter prototype mixin: `this` is the RoutePlotter instance;
 * main.js attaches the group via Object.assign(RoutePlotter.prototype,
 * networkMixin). Method names must stay unique across mixins
 * (tests/mixins.test.js).
 */
import { getNodeAreaDescription } from './finishContexts.js';
import { stageProjectModel } from './persistence.js';
import { INTERACTION, CROWD_ENTRY_WEIGHT } from '../config/constants.js';
import { isMac } from '../config/keybindings.js';
import { getGraphDepartureShares, getGraphEntryShares } from '../utils/graphRouting.js';
import { entryWeightValue, ENTRY_WEIGHT_HINT } from '../utils/entryWeight.js';
import { encodeSceneKeyPart } from '../utils/sceneSemantics.js';
import { nearestOnPolyline } from '../utils/segmentHitTest.js';
import {
  changedSinceShown, clearFieldError, draftOwner, formatFieldNumber, noteShownValue, setControlReason, setRangeReadout,
  shiftDecimal, showFieldError, SLIDER_REACH_REASON,
} from '../utils/uiReadouts.js';
import { regionOperation } from './regionLines.js';
import { copyCrowdArea, createCrowdArea } from '../utils/crowdArea.js';

const AREA_FIELDS = ['width', 'height', 'turn'];
const areaControl = key => document.getElementById(`network-node-area-${key}`);

const NODE_TYPE_LABELS = {
  normal: 'pass-through',
  entry: 'entry',
  exit: 'exit',
};

const NETWORK_CARD_HINTS = {
  passive: {
    node: 'Dots appear at entries and finish at exits. Use Type to change this node, or Delete node to remove it. Choose Edit network to move nodes.',
    edge: 'Share of the dots leaving each end. Use Direction and Share to edit this path, or Delete path to remove it. Choose Edit network to bend paths.',
  },
  active: {
    node: 'Dots appear at entries and finish at exits. T cycles the type; drag to move; Shift-click deletes.',
    edge: 'Share of the dots leaving each end. Arriving dots avoid turning straight back when another path is available. Drag the path to bend it; Shift-click deletes.',
  },
};

/**
 * The Guide hint's line on where a custom network's journeys start and end
 * (CROWD-07 F14): what "At journey end" acts on is a node's Type, set in Node
 * scope. Both fallbacks as the engine has them: with no Exit, a journey ends
 * at a node with one path; with no Entry, dots set off from every node with a
 * path they can take (SwarmEngine `_buildGraphGuide`, `fallbackExitIds`).
 */
const GUIDE_JOURNEY_HINT = "Journeys start at entry nodes and end at exit nodes (a node's Type). "
  + 'With no exit, they end at nodes with one path; with no entry, dots set off from any node they can leave.';

/** A node's path-weight row hint (UI-03), worded as the Path card's Share hint. */
const PATH_WEIGHT_HINT = 'How strongly dots leaving this node prefer this path, '
  + 'shown as the share of them that take it. Arriving dots avoid turning straight back when another path is available';

/** The Path card's Share row (DEF-86): its slider, the weight's field, the slider's reason and the field's error. */
function edgeWeightParts() {
  return {
    slider: document.getElementById('network-edge-weight'),
    field: document.getElementById('network-edge-weight-field'),
    reason: document.getElementById('network-edge-weight-reason'),
    error: document.getElementById('network-edge-weight-field-error'),
  };
}

/** Compact author-facing weight text without losing useful decimals. */
function formatWeight(weight) {
  return Number(weight.toFixed(2)).toString();
}

/** What an invalid weight is told, and what the path keeps meanwhile (UI-06 B-30). */
function weightMessage(edge) {
  return `Enter a weight of 0.01 or more; the path keeps ${formatWeight(edge.weight)} until you do.`;
}

/** A weight off the field's step (1.001 on steps of 0.01): the increment, and what the path keeps. */
function weightStepMessage(edge) {
  return `Use steps of 0.01, from 0.01 up; the path keeps ${formatWeight(edge.weight)} until you do.`;
}

export const networkMixin = {

  /**
   * Wire the Guide card entry point, the pointer events InteractionHandler
   * forwards during the mode, and the Node/Edge card controls.
   * Call once at init, after the static DOM exists.
   */
  setupNetworkControls() {
    this._editNetworkBtn = document.getElementById('network-edit-btn');
    this._traceRouteBtn = document.getElementById('crowd-trace-route-btn');
    this._guideHintEl = document.getElementById('crowd-guide-hint');

    this._editNetworkBtn?.addEventListener('click', () => this.enterNetworkEditMode());
    this._traceRouteBtn?.addEventListener('click', () => this.traceRouteIntoCrowd());

    // ── Guide changes (emitted by the crowds mixin's select wiring) ──
    // Custom network is a setting, not a mode (CROWD-07 X-02): choosing it
    // refreshes the Guide card, and Edit network is the request. Switching
    // back to route while drawing exits.
    this.eventBus.on('network:guide-changed', (layer) => {
      if (layer.guideType === 'route') {
        const svc = this.networkEditService;
        if (svc.active) svc.exit();
        else if (svc.layer === layer) svc.clearInspection();
      }
      this.updateGuideCard();
    });

    // ── Bound-network cleanup on scope/context changes ──────
    // Active authoring closes fully; passive inspection simply unbinds.
    this.eventBus.on('crowd:deselected', () => {
      const svc = this.networkEditService;
      if (svc.active) svc.exit();
      else svc.clearInspection();
    });
    this.eventBus.on('crowd:selected', (layer) => {
      const svc = this.networkEditService;
      if (svc.layer && svc.layer !== layer) {
        if (svc.active) svc.exit();
        else svc.clearInspection();
      }
      this.updateGuideCard();
    });
    this.eventBus.on('motion:preview-mode-change', (previewMode) => {
      if (previewMode && this.networkEditService.active) this.networkEditService.exit();
    });
    const clearProjectNetworkScope = () => {
      const service = this.networkEditService;
      if (service.active) service.exit();
      else service.clearInspection();
      this.updateGuideCard();
    };
    this.eventBus.on('project:replaced', clearProjectNetworkScope);
    this.eventBus.on('app:cleared', clearProjectNetworkScope);
    // Keep the Guide card's button state in step with the mode itself
    // (Done button and Esc exit without passing through this mixin)
    this.eventBus.on('network:edit-mode-changed', () => this.updateGuideCard());

    // ── Central change pipeline ─────────────────────────────
    // Gesture commits snapshot immediately (like waypoint edits); provisional
    // edits render here and retime through the crowds mixin. Slider-y card
    // edits use crowd:param-changed for its debounced undo instead.
    this.eventBus.on('network:changed', ({ commit } = {}) => {
      if (commit) {
        this.saveUndoState();
        this.autoSave();
        this.updateGuideCard();
        this.syncNetworkCards();
      }
      this.queueRender();
    });

    // The scene's crowds, for the pen's budgets (DEF-59): a synchronous
    // query, answered through the callback.
    this.eventBus.on('scene:flow-layers', (_, callback) => {
      callback?.(this.scene?.getFlowLayers?.() ?? []);
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
    this.eventBus.on('network:drag-cancel', () => {
      this.networkEditService.cancelDrag();
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
    this.eventBus.on('network:node-deselected', () => {
      this._commitNodeAreaDrafts();
      this._syncNodeAreaCard();
      this._syncNodePathWeights(null);
    });
    // The Path card closes with its path: a weight typed there goes to that path (Codex r1 #4).
    this.eventBus.on('network:edge-deselected', () => this._commitEdgeWeightDraft());

    // ── Node card (single-writer wiring) ────────────────────
    document.getElementById('network-node-type')?.addEventListener('change', (e) => {
      this.networkEditService.setSelectedNodeType(e.target.value);
    });
    document.getElementById('network-node-delete')?.addEventListener('click', () => {
      this._deleteNetworkSelection('node');
    });
    areaControl('shape')?.addEventListener('change', () => {
      const control = areaControl('shape'), error = areaControl('shape-error');
      if (!changedSinceShown(control)) {
        clearFieldError(control, error);
        return;
      }
      const node = draftOwner(control);
      const layer = this._nodeAreaLayer(node);
      if (!layer || !['entry', 'exit'].includes(node.type)) return;
      const shape = control.value;
      this._commitNodeAreaDrafts();
      const area = shape === 'none' ? null : { ...(node.area || createCrowdArea()), shape };
      try {
        this._setNodeArea(layer, node, area);
        clearFieldError(control, error);
        this._syncNodeAreaCard();
      } catch (failure) {
        // Keep a rejected choice as a draft. Resetting the native select to
        // its stored value would prevent choosing that value from firing a
        // change event, so the author could not clear the error by correcting it.
        control.value = shape;
        showFieldError(control, error, failure.message, text => this.announce(text));
      }
    });
    for (const key of AREA_FIELDS) {
      areaControl(key)?.addEventListener('change', () => this._commitNodeAreaField(key));
    }

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
    const weight = edgeWeightParts();
    weight.slider?.addEventListener('input', (e) => {
      const edge = this.networkEditService.selectedEdge();
      if (!edge) return;
      // Off for a weight past its ends, or not moved from the step a weight
      // between its steps put it at, it writes nothing: the weight stays (DEF-86).
      if (weight.slider.disabled || !changedSinceShown(weight.slider)) {
        this._syncEdgeWeight(edge);
        return;
      }
      edge.setWeight(shiftDecimal(Number(e.target.value), -1));
      // The field shows the weight the slider set: whatever was wrong with what was typed there is gone.
      clearFieldError(weight.field, weight.error);
      this._syncEdgeWeight(edge);
      // Debounced undo + autosave + render — the crowd param pipeline
      this.eventBus.emit('crowd:param-changed');
    });
    // The raw weight, typed (DEF-86): any weight of 0.01 or more, with no
    // top, as the model takes it; the slider follows within its reach.
    weight.field?.addEventListener('change', () => {
      const edge = this.networkEditService.selectedEdge();
      if (edge) this._commitEdgeWeightField(edge);
    });
  },

  /**
   * Commit the weight field to `edge`, the path it was typed for (DEF-86):
   * a weight of 0.01 or more is written; anything else is refused in the
   * field's error line, said aloud, and the path keeps its weight. A field
   * committed as it was shown writes nothing.
   * @param {Object} edge
   * @private
   */
  _commitEdgeWeightField(edge) {
    const { field, error } = edgeWeightParts();
    if (!field) return;
    if (!changedSinceShown(field)) {
      clearFieldError(field, error);
      return;
    }
    const typed = Number(field.value);
    if (field.value.trim() === '' || !Number.isFinite(typed) || typed < 0.01) {
      showFieldError(field, error, weightMessage(edge), message => this.announce?.(message));
      return;
    }
    clearFieldError(field, error);
    edge.setWeight(typed);
    this._syncEdgeWeight(edge);
    this.eventBus.emit('crowd:param-changed');
  },

  /**
   * Commit a weight typed and not committed to the path it was typed for,
   * before the Path card shows another path or closes (Codex r1 #4). A press
   * on the canvas keeps focus in the field, so no `change` commits it first,
   * and by the time the card hears of a new selection the service has made
   * it: the field remembers its path from when it was shown. A path gone
   * from the scene (deleted, or put back by Undo) takes nothing.
   * @private
   */
  _commitEdgeWeightDraft() {
    const edge = draftOwner(edgeWeightParts().field);
    if (!edge) return;
    const inScene = this.scene.getFlowLayers().some(layer => layer.graph?.getEdge?.(edge.id) === edge);
    if (inScene) this._commitEdgeWeightField(edge);
  },

  /**
   * Enter network edit mode for the selected crowd: the Guide card's Edit
   * network button, the one request for it (CROWD-07 X-02).
   */
  enterNetworkEditMode() {
    const layer = this.selectedCrowd;
    if (!layer) return;
    const svc = this.networkEditService;
    if (svc.active && svc.layer === layer) return;
    // Entering disables the Edit network button, which takes focus from it
    // (UI-06 B-34): from that button, or from nowhere, focus goes to the
    // banner's Done [Q2]. Anywhere else keeps it.
    const from = document.activeElement;
    const focusToBanner = from === this._editNetworkBtn || !from || from === document.body
      || from === document.documentElement || !from.isConnected;
    // Its own session on another crowd ends first; then the banner slot is
    // claimed, so a mode whose banner is up has ended, an area's Preview
    // restore included, before this entry leaves Preview (UI-06 PR 6; Codex
    // on 9466a3f, blocking 1).
    if (svc.active) svc.exit();
    // Refused (claimed inside a replacement's exits, past the slot's bound),
    // nothing here changes (Codex r2 on 753f93f, 6).
    if (!svc.claimBanner(layer)) return;
    // Drawing a network is editing: leave Preview through the canonical
    // switch (flipping back to Preview later closes the mode)
    this._setPreviewMode(false);
    svc.enter(layer, { returnFocusTo: this._editNetworkBtn });
    this.updateGuideCard();
    if (focusToBanner) svc.focusBanner();
    this.announce('Editing the network — click the map to place linked nodes. Escape lifts the pen.');
  },

  /**
   * Delete the network selection from a card button, with the standard
   * delete toast (shift-click's sibling).
   * @param {string} kind - 'node' | 'edge' (for the toast noun)
   * @private
   */
  _deleteNetworkSelection(kind) {
    // It says the change: the network's count and the chip are not said again (UI-06 PR 6)
    regionOperation(this, cover => {
      this.networkEditService.deleteSelection();
      this.eventBus.emit('ui:toast', {
        message: `Deleted ${kind === 'edge' ? 'path' : kind} — press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`
      });
      cover();
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
      // It says the change: the network's count is not said again (UI-06 PR 6)
      regionOperation(this, cover => {
        if (!svc.placeNode(this._networkImgPos(x, y), shiftKey)) return;
        this.announce('Node placed');
        cover();
      });
      return;
    }

    if (shiftKey) {
      // Shift-click deletes, with the standard undo toast
      if (hit.kind === 'node') {
        regionOperation(this, cover => {
          svc.deleteNode(hit.node);
          this.eventBus.emit('ui:toast', {
            message: `Deleted node — press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`
          });
          cover();
        });
      } else if (hit.kind === 'control') {
        svc.deleteControlPoint(hit.edge, hit.controlIndex);
      } else {
        regionOperation(this, cover => {
          svc.deleteEdge(hit.edge);
          this.eventBus.emit('ui:toast', {
            message: `Deleted path — press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`
          });
          cover();
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
      const p = this.imageToCanvas(node.position().x, node.position().y);
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
        this.imageToCanvas(source.position().x, source.position().y),
        ...bestEdge.controlPoints.map(p => this.imageToCanvas(p.x, p.y)),
        this.imageToCanvas(target.position().x, target.position().y),
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
   * node-edge counts / route following) and, on a custom network, where
   * journeys start and end (CROWD-07 F14).
   */
  updateGuideCard() {
    const layer = this.selectedCrowd;
    if (this._editNetworkBtn) {
      const graphGuided = !!layer && layer.guideType === 'graph';
      this._editNetworkBtn.hidden = !graphGuided;
      this._editNetworkBtn.disabled = this.networkEditService.active;
    }
    if (this._traceRouteBtn) {
      // Tracing needs a graph-guided crowd to write into and a route worth
      // copying. It stays available while the pen is live: drawing a network
      // is exactly the moment "or just trace the route" is most useful
      // (COMPOSE-03).
      const graphGuided = !!layer && layer.guideType === 'graph';
      const hasRoute = (this.waypoints?.length || 0) >= 2;
      this._traceRouteBtn.hidden = !graphGuided;
      this._traceRouteBtn.disabled = !hasRoute;
      // Disabled, it cannot be focused, so its hint cannot be reached: the
      // reason is a line under it that it is described by (UI-06 B-07).
      const reason = document.getElementById('crowd-trace-route-reason');
      if (reason) {
        const shown = graphGuided && !hasRoute;
        reason.textContent = shown ? 'Add at least two route waypoints first.' : '';
        reason.hidden = !shown;
      }
    }
    if (this._guideHintEl && layer) {
      if (layer.guideType !== 'graph') {
        this._guideHintEl.textContent = 'Dots follow your route. Custom network lets you draw paths of their own.';
      } else {
        const nodes = layer.graph.getNodes().length;
        const edges = layer.graph.getEdges().length;
        const networkHint = nodes === 0
          ? 'No network yet — press Edit network to draw one, or Trace route into network.'
          : `Dots walk this crowd's own network (${nodes} node${nodes === 1 ? '' : 's'}, `
            + `${edges} path${edges === 1 ? '' : 's'}).`;
        // The Trace reason above asks for the waypoints (UI-06 B-07); this says what needs them, so the ask is said once.
        // Only while nothing can play: a crowd that can be drawn plays and exports with no route (CROWD-08 part A).
        const playable = typeof this.canPlayScene === 'function'
          ? this.canPlayScene()
          : (this.waypoints?.length || 0) >= 2;
        const timingHint = !playable
          ? ' It takes at least two route waypoints, or a crowd\'s network, before previewing or exporting.'
          : '';
        this._guideHintEl.textContent = `${networkHint} ${GUIDE_JOURNEY_HINT}${timingHint}`;
      }
    }
  },

  /**
   * Push the selected node/edge into the Node/Edge card controls.
   * Safe with no selection (cards are hidden then anyway).
   */
  syncNetworkCards() {
    // A weight typed for the path shown before goes to it first (Codex r1 #4).
    this._commitEdgeWeightDraft();
    const svc = this.networkEditService;
    const hints = svc.active ? NETWORK_CARD_HINTS.active : NETWORK_CARD_HINTS.passive;
    const nodeHint = document.getElementById('network-node-hint');
    const edgeHint = document.getElementById('network-edge-hint');
    if (nodeHint) nodeHint.textContent = hints.node;
    if (edgeHint) edgeHint.textContent = hints.edge;

    const node = svc.selectedNode();
    if (node) {
      const typeEl = document.getElementById('network-node-type');
      if (typeEl) typeEl.value = node.type;
    }
    this._syncNodeCardTitle(node);
    this._syncNodePathWeights(node);
    this._syncNodeEntryWeights(node);
    this._syncNodeAreaCard();

    const edge = svc.selectedEdge();
    if (edge) {
      const dirEl = document.getElementById('network-edge-direction');
      if (dirEl) dirEl.value = edge.direction;
      const swapBtn = document.getElementById('network-edge-swap');
      if (swapBtn) swapBtn.hidden = edge.direction !== 'one-way';
      const { field, error } = edgeWeightParts();
      clearFieldError(field, error);
      this._syncEdgeWeight(edge);
    }
  },

  /** Resolve by object identity: Undo/load can replace a node while retaining its id. */
  _nodeAreaLayer(node) {
    return node && this.scene.getFlowLayers().find(layer => layer.guideType === 'graph'
      && layer.graph.getNode(node.id) === node);
  },

  /** Plain transient token for forms; a same-id replacement never inherits an old draft. */
  _entryWeightContext(layer, node) {
    this._entryWeightContexts ??= new WeakMap();
    const state = JSON.stringify([layer.guideType, node.type, entryWeightValue(node.entryWeight)]);
    let record = this._entryWeightContexts.get(node);
    if (!record || record.state !== state) {
      this._entryWeightContextSerial = (this._entryWeightContextSerial || 0) + 1;
      record = { state, token: String(this._entryWeightContextSerial) };
      this._entryWeightContexts.set(node, record);
    }
    return record.token;
  },

  /** Both surfaces preflight the complete saved candidate before touching history or live data. */
  _setNodeEntryWeight(layer, node, value) {
    if (this._nodeAreaLayer(node) !== layer || node.type !== 'entry') {
      throw new Error('Choose Entry in Type on a custom network to edit its weight.');
    }
    const weight = entryWeightValue(value);
    if (weight === entryWeightValue(node.entryWeight)) return false;
    const candidate = this._buildProjectSnapshot({ includeAssets: false });
    const saved = candidate.scene.flowLayers.find(each => each.id === layer.id)
      .graph.nodes.find(each => each.id === node.id);
    if (weight === CROWD_ENTRY_WEIGHT.DEFAULT) delete saved.entryWeight;
    else saved.entryWeight = weight;
    try {
      stageProjectModel(JSON.parse(JSON.stringify(candidate)));
      const cache = this._autosaveBackgroundCache;
      const background = cache && cache.image === this.background?.image ? cache.dataURL : null;
      this.imageAssetService.prepareArchive(candidate, background);
    } catch (failure) {
      throw new Error(`Entry weight unchanged: ${failure.message}. `
        + 'Shorten labels or remove unused nodes and paths, then try again.');
    }
    this._flushPendingUndo?.();
    if (weight === CROWD_ENTRY_WEIGHT.DEFAULT) delete node.entryWeight;
    else node.entryWeight = weight;
    this.eventBus.emit('network:changed', { commit: true });
    return true;
  },

  _syncNodeEntryWeights(selected) {
    const fieldset = document.getElementById('network-entry-weights');
    const rows = document.getElementById('network-entry-weight-rows');
    if (!fieldset || !rows) return;
    const layer = this.networkEditService.layer;
    // Observe transitions even when the fieldset is hidden, so Entry→normal→Entry drops old drafts.
    if (layer) for (const node of layer.graph.getNodes()) this._entryWeightContext(layer, node);
    fieldset.hidden = !selected || selected.type !== 'entry' || layer?.guideType !== 'graph';
    this._entryWeightRows ??= new Map();
    if (fieldset.hidden) {
      rows.replaceChildren(); this._entryWeightRows.clear();
      return;
    }
    document.getElementById('network-entry-weights-help').textContent = ENTRY_WEIGHT_HINT;
    const shares = getGraphEntryShares(layer.graph);
    const current = new Set(shares.map(({ node }) => node));
    for (const [id, row] of this._entryWeightRows) {
      if (row.layer !== layer || !current.has(row.node)) {
        row.root.remove(); this._entryWeightRows.delete(id);
      }
    }
    shares.forEach(({ node, percent }, index) => {
      let row = this._entryWeightRows.get(node.id);
      if (!row) {
        const root = document.createElement('div');
        root.className = 'network-path-weight-row network-entry-weight-row';
        root.dataset.nodeId = node.id;
        const input = document.createElement('input');
        input.type = 'number'; input.required = true;
        input.min = String(CROWD_ENTRY_WEIGHT.MIN); input.max = String(CROWD_ENTRY_WEIGHT.MAX); input.step = 'any';
        input.id = `network-entry-weight-${encodeSceneKeyPart(node.id)}`;
        const label = document.createElement('label'), name = document.createElement('span');
        label.htmlFor = input.id; name.className = 'network-path-weight-name'; label.appendChild(name);
        const output = document.createElement('output');
        output.id = `${input.id}-value`; output.className = 'network-path-weight-value';
        output.setAttribute('for', input.id);
        const error = document.createElement('span');
        error.id = `${input.id}-error`; error.className = 'network-path-weight-error'; error.hidden = true;
        input.setAttribute('aria-describedby', `${output.id} network-entry-weights-help`);
        root.append(label, input, output, error);
        row = { root, input, name, output, error, node, layer, context: null };
        this._entryWeightRows.set(node.id, row);
        input.addEventListener('change', () => {
          if (!root.isConnected || fieldset.hidden || this._nodeAreaLayer(node) !== layer
              || node.type !== 'entry' || row.context !== this._entryWeightContext(layer, node)) return;
          if (!changedSinceShown(input)) { clearFieldError(input, error); return; }
          try {
            this._setNodeEntryWeight(layer, node, input.value.trim() ? Number(input.value) : NaN);
            clearFieldError(input, error); noteShownValue(input, node);
          } catch (failure) {
            showFieldError(input, error, failure.message, text => this.announce(text));
          }
        });
      }
      const context = this._entryWeightContext(layer, node);
      if (row.context !== context || draftOwner(row.input) !== node) {
        row.input.value = formatFieldNumber(entryWeightValue(node.entryWeight));
        noteShownValue(row.input, node); clearFieldError(row.input, row.error);
      }
      row.context = context;
      row.name.textContent = `Entry ${index + 1}${node.label ? ` — ${node.label}` : ''}`;
      row.output.textContent = `${percent}%`;
      // Reuse nodes on ordinary refreshes: a focused input must not leave the DOM.
      if (rows.children[index] !== row.root) rows.insertBefore(row.root, rows.children[index] || null);
    });
  },

  /** The one durable owner for both authoring surfaces, outside the pen's legacy exception. */
  _setNodeArea(layer, node, area) {
    if (this._nodeAreaLayer(node) !== layer || !['entry', 'exit'].includes(node.type)) {
      throw new Error('Choose Entry or Exit in Type to edit a node area.');
    }
    const next = copyCrowdArea(area);
    if (JSON.stringify(next) === JSON.stringify(node.area ?? null)) return false;
    // An additive field can pass every scene limit but exceed the loader's
    // tree budget or the ZIP's metadata budget. Validate the detached saved
    // shape, including its asset manifest, before flushing undo or writing.
    const candidate = this._buildProjectSnapshot({ includeAssets: false });
    const savedNode = candidate.scene.flowLayers.find(each => each.id === layer.id)
      .graph.nodes.find(each => each.id === node.id);
    if (next) savedNode.area = next;
    else delete savedNode.area;
    try {
      stageProjectModel(JSON.parse(JSON.stringify(candidate)));
      const cache = this._autosaveBackgroundCache;
      const background = cache && cache.image === this.background?.image ? cache.dataURL : null;
      this.imageAssetService.prepareArchive(candidate, background);
    } catch (failure) {
      throw new Error(`Area unchanged: ${failure.message}. `
        + 'Shorten labels or remove unused nodes and paths, then try again.');
    }
    this._flushPendingUndo?.();
    if (next) node.area = next;
    else delete node.area;
    this.eventBus.emit('network:changed', { commit: true });
    return true;
  },

  _commitNodeAreaField(key) {
    const control = areaControl(key);
    const error = areaControl(`${key}-error`);
    // Restoring the shown value corrects an invalid draft without an edit;
    // draftOwner deliberately returns null in that case.
    if (!changedSinceShown(control)) {
      clearFieldError(control, error);
      return;
    }
    const node = draftOwner(control);
    const layer = this._nodeAreaLayer(node);
    if (!layer || !['entry', 'exit'].includes(node.type) || !node.area) return;
    const number = Number(control.value);
    if (!control.value.trim() || !Number.isFinite(number)
        || number < Number(control.min) || number > Number(control.max)) {
      const message = key === 'turn' ? 'Enter a turn from -180 to 180 degrees.' : 'Enter a size from 1 to 80%.';
      showFieldError(control, error, message, text => this.announce(text));
      return;
    }
    try {
      this._setNodeArea(layer, node, { ...node.area, [key]: key === 'turn' ? number : shiftDecimal(number, -2) });
      clearFieldError(control, error);
      noteShownValue(control, node);
    } catch (failure) {
      showFieldError(control, error, failure.message, text => this.announce(text));
    }
  },

  _commitNodeAreaDrafts() {
    if (this._committingNodeAreaDrafts) return;
    this._committingNodeAreaDrafts = true;
    try {
      for (const key of AREA_FIELDS) this._commitNodeAreaField(key);
    } finally {
      this._committingNodeAreaDrafts = false;
    }
  },

  _syncNodeAreaCard() {
    if (this._committingNodeAreaDrafts) return;
    const card = areaControl('card');
    if (!card) return;
    const node = this.networkEditService?.selectedNode();
    if (this._shownNodeAreaNode !== node) this._commitNodeAreaDrafts();
    card.hidden = !node || (!['entry', 'exit'].includes(node.type) && !node.area);
    const area = node?.area;
    const inactive = node && !['entry', 'exit'].includes(node.type);
    const shape = areaControl('shape');
    if (this._shownNodeAreaNode !== node || this._shownNodeArea !== area) {
      clearFieldError(shape, areaControl('shape-error'));
    }
    const keepShapeDraft = this._shownNodeAreaNode === node && this._shownNodeArea === area
      && draftOwner(shape) === node && changedSinceShown(shape);
    if (!keepShapeDraft) {
      shape.value = area?.shape || 'none';
      noteShownValue(shape, node);
    }
    shape.disabled = !node || inactive;
    const description = getNodeAreaDescription(this, this._nodeAreaLayer(node), node);
    card.querySelector('.section-header').firstChild.textContent = description.label;
    areaControl('label').textContent = description.label;
    card.querySelector('.param-hint-trigger[aria-describedby~="network-node-area-shape-tip"]')
      ?.setAttribute('aria-label', `Help: ${description.label}`);
    areaControl('hint').textContent = description.hint;
    const reason = description.reason;
    setControlReason(shape, areaControl('reason'), reason);
    areaControl('size').hidden = !area;
    areaControl('more').hidden = !area;
    for (const key of AREA_FIELDS) {
      const control = areaControl(key);
      // Retain drafts through unrelated viewport/timing sync, but an accepted
      // edit from the outline supersedes the old card's values for this area.
      const keepDraft = this._shownNodeArea === area && draftOwner(control) === node && changedSinceShown(control);
      if (!keepDraft) {
        const value = area?.[key] ?? (key === 'turn' ? 0 : 0.1);
        control.value = formatFieldNumber(key === 'turn' ? value : shiftDecimal(value, 2));
        noteShownValue(control, node);
        clearFieldError(control, areaControl(`${key}-error`));
      }
      control.disabled = !area || inactive;
      setControlReason(control, areaControl('reason'), reason);
    }
    this._shownNodeArea = area;
    this._shownNodeAreaNode = node;
    setControlReason(areaControl('turn'), areaControl('image-hint'), description.imageHint);
    for (const control of [shape, ...AREA_FIELDS.map(areaControl)]) {
      const ids = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      ids.add('network-node-area-hint');
      control.setAttribute('aria-describedby', [...ids].join(' '));
    }
  },

  /**
   * Show a path's weight (DEF-86): the field holds it as stored, shown for
   * that path; the Share slider, the weight × 10 from 0.1 to 5, sits there,
   * at its nearest step for a weight between its steps, or, for a weight
   * past its ends, at its nearer end and off, saying why; it writes nothing
   * until the author moves it, so the first nudge never rewrites a weight
   * they did not set on it; the readout says the share it gives.
   * @param {Object} edge
   * @private
   */
  _syncEdgeWeight(edge) {
    const { slider, field, reason } = edgeWeightParts();
    if (field) {
      field.value = formatFieldNumber(edge.weight);
      noteShownValue(field, edge);
    }
    if (slider) {
      const position = shiftDecimal(edge.weight, 1);
      const min = Number(slider.min);
      const max = Number(slider.max);
      const reachable = position >= min && position <= max;
      slider.value = String(Math.round(Math.min(max, Math.max(min, position))));
      noteShownValue(slider, edge); // where its step put it: until moved from there, it writes nothing
      slider.disabled = !reachable;
      setControlReason(slider, reason, reachable ? '' : SLIDER_REACH_REASON);
    }
    this._updateEdgeShareReadout(edge);
  },

  /**
   * Head the Node card with the node it edits (CROWD-07 X-05): "Node · Main
   * entrance · entry", the name a traced node keeps from its waypoint, or
   * "Node 3 · entry", its number in the network, for a node with no name
   * [Q8]. The header button holds the span, as the Leg card's does.
   * @param {Object|null} node
   * @private
   */
  _syncNodeCardTitle(node) {
    const title = document.getElementById('node-section-title');
    if (!title) return;
    if (!node) {
      title.textContent = 'Node';
      return;
    }
    const name = typeof node.label === 'string' ? node.label.trim() : '';
    const number = this.networkEditService.layer?.graph.getNodes().indexOf(node) ?? -1;
    const subject = name ? `Node · ${name}` : `Node ${number + 1}`;
    title.textContent = `${subject} · ${NODE_TYPE_LABELS[node.type] ?? node.type}`;
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
    if (!node || !svc.layer) {
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
      const errorId = `${inputId}-error`;

      const row = document.createElement('div');
      row.className = 'network-path-weight-row';
      row.dataset.edgeId = departure.edge.id;

      // The label wraps the name alone and names the field by `for` (and the
      // field says so by `aria-labelledby`), so the readout and the error are
      // the label's siblings, outside it: inside, they would join the name
      // (UI-STANDARDS; UI-06 B-30).
      const label = document.createElement('label');
      label.htmlFor = inputId;
      const name = document.createElement('span');
      name.id = nameId;
      name.className = 'network-path-weight-name';
      name.textContent = `Path ${index + 1} to ${NODE_TYPE_LABELS[type]} ${ordinal}`;
      name.setAttribute('data-tip', PATH_WEIGHT_HINT);
      label.appendChild(name);

      const input = document.createElement('input');
      input.id = inputId;
      input.type = 'number';
      input.min = '0.01';
      input.step = '0.01';
      input.value = formatWeight(departure.edge.weight);
      input.setAttribute('aria-labelledby', nameId);
      // The error first, when there is one, then the readout and the help.
      input.setAttribute('aria-describedby', `${errorId} ${outputId} network-path-weights-help`);

      // An invalid weight is told what is wrong, in view and aloud, and the
      // typed value stays for the author to fix: silently putting the old
      // weight back said nothing (UI-06 B-30).
      const error = document.createElement('span');
      error.id = errorId;
      error.className = 'network-path-weight-error';
      error.hidden = true;
      const setInvalid = (message) => {
        const was = input.validity.customError;
        input.setCustomValidity(message);
        input.setAttribute('aria-invalid', 'true');
        error.textContent = message;
        error.hidden = false;
        if (!was) this.announce(message);
      };
      const setValid = () => {
        input.setCustomValidity('');
        input.removeAttribute('aria-invalid');
        error.textContent = '';
        error.hidden = true;
      };
      input.addEventListener('input', () => {
        const weight = Number(input.value);
        if (input.value.trim() === '' || !Number.isFinite(weight) || weight < 0.01) {
          setInvalid(weightMessage(departure.edge));
          return;
        }
        // A weight off the step (1.001) is a native validity error the field
        // would otherwise swallow into the model: refused, with the increment.
        if (input.validity.stepMismatch) {
          setInvalid(weightStepMessage(departure.edge));
          return;
        }
        setValid();
        departure.edge.setWeight(weight);
        this._updateNodePathWeightReadouts(node.id);
        // crowd:param-changed → crowds mixin → debounced undo/autosave/render.
        this.eventBus.emit('crowd:param-changed');
      });

      const output = document.createElement('output');
      output.id = outputId;
      output.className = 'network-path-weight-value';
      output.setAttribute('for', inputId);

      row.append(label, input, output, error);
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
    if (!valueEl || !svc.layer) return;
    const graph = svc.layer.graph;

    const shareFrom = (nodeId) =>
      getGraphDepartureShares(graph, nodeId)
        .find(share => share.edge.id === edge.id)?.percent ?? 0;

    // The readout sits beside the weight slider's label, not in it (UI-06 B-06).
    setRangeReadout(document.getElementById('network-edge-weight'), valueEl, edge.direction === 'one-way'
      ? `${shareFrom(edge.sourceId)}% of departures`
      : `${shareFrom(edge.sourceId)}% · ${shareFrom(edge.targetId)}% of departures`);
  },

  /**
   * After a restore (undo/redo) rebuilt the scene, the bound layer and
   * selection references are stale. Re-bind active or passive state by id;
   * if the layer is gone or no longer selected, clear the matching state.
   */
  resolveNetworkAfterRestore() {
    const svc = this.networkEditService;
    if (!svc.layer) return;
    const fresh = this.scene.getFlowLayer(svc.layer.id);
    if (!fresh || this.selectedCrowd !== fresh) {
      if (svc.active) svc.exit();
      else svc.clearInspection();
    } else {
      svc.rebind(fresh);
      this.syncNetworkCards();
    }
    this.updateGuideCard();
  }
};
