/**
 * Semantic scene outline integration.
 *
 * The controller emits stable-ID commands; this RoutePlotter mixin resolves
 * them against the current canonical models and owns every mutation/undo/
 * autosave transaction. Outline disclosure and focus are transient UI state
 * and never enter project persistence.
 */

import { SceneOutlineController } from '../controllers/SceneOutlineController.js';
import {
  buildSceneOutlineSnapshot,
  sceneOutlineKey,
} from '../utils/sceneSemantics.js';
import { FLOW_LAYER_LIMITS } from '../models/FlowLayer.js';
import { SCENE_LIMITS } from '../models/Scene.js';
import { EMITTER_LIMITS } from '../models/Emitter.js';
import { PROJECT_MODEL_LIMITS } from './persistence.js';
import { assertSafeStoredColor } from '../utils/safeColor.js';

const NODE_TYPES = new Set(['normal', 'entry', 'exit']);
const EDGE_DIRECTIONS = new Set(['one-way', 'two-way']);
const GUIDE_TYPES = new Set(['route', 'graph']);
const LIFECYCLE_MODES = new Set(['disappear', 'respawn', 'loop', 'collect']);

function numberBetween(value, label, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return number;
}

function percent(value, label) {
  return numberBetween(value, label, 0, 100) / 100;
}

function originalStoredValue(command, field) {
  const original = command?.outlineOriginalValues?.[field];
  if (!original || String(command[field]) !== String(original.display)) {
    return { matches: false, value: null };
  }
  return { matches: true, value: original.canonical };
}

function originalCanonical(command, field) {
  const original = originalStoredValue(command, field);
  if (!original.matches) return null;
  const value = Number(original.value);
  return Number.isFinite(value) ? value : null;
}

function percentDraft(command, field, label) {
  return originalCanonical(command, field) ?? percent(command[field], label);
}

function secondsDraft(command, field, label) {
  const canonicalMs = originalCanonical(command, field);
  return canonicalMs ?? numberBetween(command[field], label, 0, 600) * 1000;
}

function positiveInteger(value, label, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new Error(`${label} must be a whole number between 1 and ${max}.`);
  }
  return number;
}

function shortText(value, label, { required = false } = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new Error(`${label} cannot be empty.`);
  if (text.length > 200) throw new Error(`${label} must be 200 characters or fewer.`);
  return text;
}

function textDraft(command, field, label, options = {}) {
  const original = originalStoredValue(command, field);
  return original.matches
    ? original.value
    : shortText(command[field], label, options);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export const sceneOutlineMixin = {
  setupSceneOutline() {
    const container = document.getElementById('scene-outline');
    if (!container) return;
    this.sceneOutlineController = new SceneOutlineController(container, this.eventBus);
    this._sceneOutlineSelectionKey = null;
    this._sceneOutlineFocusKey = null;
    this._sceneOutlineRefreshQueued = false;
    this._sceneOutlineDeferredRefreshTimer = null;

    this.eventBus.on('scene-outline:command', command => this._handleSceneOutlineCommand(command));

    const refresh = () => this._queueSceneOutlineRefresh();
    const refreshDeferred = () => this._queueSceneOutlineDeferredRefresh();
    this.eventBus.on('waypoint:list-updated', refresh);
    this.eventBus.on('waypoint:name-changed', refresh);
    this.eventBus.on('waypoint:pause-changed', refreshDeferred);
    this.eventBus.on('waypoint:speed-changed', refreshDeferred);
    this.eventBus.on('crowd:param-changed', refreshDeferred);
    this.eventBus.on('scene:semantic-changed', ({ kind } = {}) => {
      if (kind === 'waypoint-label') refreshDeferred();
      else refresh();
    });
    // Pointer drags emit transient network frames. Rebuilding the semantic DOM
    // for each frame is both noisy for assistive technology and unnecessary;
    // the committed model event is the synchronization boundary.
    this.eventBus.on('network:changed', ({ commit } = {}) => {
      if (commit) refresh();
    });
    this.eventBus.on('area:changed', refreshDeferred);
    this.eventBus.on('area:draw-completed', ({ waypoint } = {}) => {
      if (waypoint?.areaHighlight?.shape === 'polygon') {
        this._sceneOutlineSelectionKey = sceneOutlineKey('polygon', waypoint.id);
      }
      refresh();
    });
    this.eventBus.on('area:vertex-selected', ({ waypoint, index } = {}) => {
      if (waypoint && Number.isInteger(index)) {
        this._sceneOutlineSelectionKey = sceneOutlineKey('vertex', waypoint.id, index);
      }
      refresh();
    });

    this.eventBus.on('waypoint:selected', waypoint => {
      this._sceneOutlineSelectionKey = waypoint ? sceneOutlineKey('waypoint', waypoint.id) : null;
      refresh();
    });
    this.eventBus.on('waypoint:multi-selected', ({ primary }) => {
      this._sceneOutlineSelectionKey = primary ? sceneOutlineKey('waypoint', primary.id) : null;
      refresh();
    });
    this.eventBus.on('waypoint:deselected', () => {
      if (/^(waypoint|polygon|vertex):/.test(this._sceneOutlineSelectionKey || '')) {
        this._sceneOutlineSelectionKey = null;
      }
      refresh();
    });
    this.eventBus.on('crowd:selected', layer => {
      this._sceneOutlineSelectionKey = layer ? sceneOutlineKey('crowd', layer.id) : null;
      refresh();
    });
    this.eventBus.on('crowd:deselected', () => {
      if (/^(crowd|emitter|network|node|edge|control):/.test(this._sceneOutlineSelectionKey || '')) {
        this._sceneOutlineSelectionKey = null;
      }
      refresh();
    });
    this.eventBus.on('network:node-selected', ({ node }) => {
      const layerId = this.networkEditService?.layer?.id;
      if (layerId && node) this._sceneOutlineSelectionKey = sceneOutlineKey('node', layerId, node.id);
      refresh();
    });
    this.eventBus.on('network:edge-selected', ({ edge }) => {
      const layerId = this.networkEditService?.layer?.id;
      if (layerId && edge) this._sceneOutlineSelectionKey = sceneOutlineKey('edge', layerId, edge.id);
      refresh();
    });
    this.eventBus.on('network:control-selected', ({ edge, index } = {}) => {
      const layerId = this.networkEditService?.layer?.id;
      if (layerId && edge && Number.isInteger(index)) {
        this._sceneOutlineSelectionKey = sceneOutlineKey('control', layerId, edge.id, index);
      }
      refresh();
    });
    this.eventBus.on('network:control-deselected', ({ edge } = {}) => {
      const layerId = this.networkEditService?.layer?.id;
      if (layerId && edge) this._sceneOutlineSelectionKey = sceneOutlineKey('edge', layerId, edge.id);
      refresh();
    });
    this.eventBus.on('network:node-deselected', () => {
      if (this._sceneOutlineSelectionKey?.startsWith('node:')) {
        this._sceneOutlineSelectionKey = null;
      }
      refresh();
    });
    this.eventBus.on('network:edge-deselected', () => {
      if (/^(edge|control):/.test(this._sceneOutlineSelectionKey || '')) {
        this._sceneOutlineSelectionKey = null;
      }
      refresh();
    });
    const resetProjectScope = () => {
      this._sceneOutlineSelectionKey = null;
      this._sceneOutlineFocusKey = null;
      refresh();
    };
    this.eventBus.on('project:replaced', resetProjectScope);
    this.eventBus.on('app:cleared', resetProjectScope);

    this._refreshSceneOutline();
  },

  _queueSceneOutlineRefresh(focusKey = null) {
    if (focusKey) this._sceneOutlineFocusKey = focusKey;
    if (this._sceneOutlineDeferredRefreshTimer !== null) {
      clearTimeout(this._sceneOutlineDeferredRefreshTimer);
      this._sceneOutlineDeferredRefreshTimer = null;
    }
    if (this._sceneOutlineRefreshQueued) return;
    this._sceneOutlineRefreshQueued = true;
    queueMicrotask(() => {
      this._sceneOutlineRefreshQueued = false;
      this._refreshSceneOutline();
    });
  },

  _queueSceneOutlineDeferredRefresh() {
    if (this._sceneOutlineDeferredRefreshTimer !== null) {
      clearTimeout(this._sceneOutlineDeferredRefreshTimer);
    }
    this._sceneOutlineDeferredRefreshTimer = setTimeout(() => {
      this._sceneOutlineDeferredRefreshTimer = null;
      this._queueSceneOutlineRefresh();
    }, 75);
  },

  _refreshSceneOutline() {
    if (!this.sceneOutlineController || !this.waypoints || !this.scene) return;
    const snapshot = buildSceneOutlineSnapshot({
      waypoints: this.waypoints,
      scene: this.scene,
      selectionKey: this._sceneOutlineSelectionKey,
      focusKey: this._sceneOutlineFocusKey,
    });
    this._sceneOutlineSelectionKey = snapshot.selectionKey;
    this._sceneOutlineFocusKey = null;
    this.eventBus.emit('scene-outline:update', snapshot);
  },

  _syncSceneOutlineSelectionAfterRestore() {
    let key = this.selectedWaypoint
      ? sceneOutlineKey('waypoint', this.selectedWaypoint.id)
      : null;
    const service = this.networkEditService;
    const layer = service?.layer;
    const selection = service?.selection;
    if (!key && layer && selection && this.selectedCrowd === layer) {
      if (selection.kind === 'node' && layer.graph.getNode(selection.id)) {
        key = sceneOutlineKey('node', layer.id, selection.id);
      } else if (selection.kind === 'edge' && layer.graph.getEdge(selection.id)) {
        const control = service.selectedControlPoint();
        key = control
          ? sceneOutlineKey('control', layer.id, selection.id, control.index)
          : sceneOutlineKey('edge', layer.id, selection.id);
      }
    }
    if (!key && this.selectedCrowd) key = sceneOutlineKey('crowd', this.selectedCrowd.id);
    this._sceneOutlineSelectionKey = key;
    this._queueSceneOutlineRefresh();
  },

  _handleSceneOutlineCommand(command = {}) {
    try {
      let result;
      switch (command.action) {
        case 'select': result = this._selectFromSceneOutline(command); break;
        case 'add-waypoint': result = this._outlineAddWaypoint(command); break;
        case 'update-waypoint': result = this._outlineUpdateWaypoint(command); break;
        case 'delete-waypoint': result = this._outlineDeleteWaypoint(command); break;
        case 'add-crowd': result = this._outlineAddCrowd(); break;
        case 'update-crowd': result = this._outlineUpdateCrowd(command); break;
        case 'delete-crowd': result = this._outlineDeleteCrowd(command); break;
        case 'update-emitter': result = this._outlineUpdateEmitter(command); break;
        case 'add-node': result = this._outlineAddNode(command); break;
        case 'update-node': result = this._outlineUpdateNode(command); break;
        case 'delete-node': result = this._outlineDeleteNode(command); break;
        case 'connect-nodes': result = this._outlineConnectNodes(command); break;
        case 'update-edge': result = this._outlineUpdateEdge(command); break;
        case 'delete-edge': result = this._outlineDeleteEdge(command); break;
        case 'add-control': result = this._outlineAddControl(command); break;
        case 'update-control': result = this._outlineUpdateControl(command); break;
        case 'delete-control': result = this._outlineDeleteControl(command); break;
        case 'create-polygon': result = this._outlineCreatePolygon(command); break;
        case 'update-polygon-timing': result = this._outlineUpdatePolygonTiming(command); break;
        case 'add-vertex': result = this._outlineAddVertex(command); break;
        case 'update-vertex': result = this._outlineUpdateVertex(command); break;
        case 'delete-vertex': result = this._outlineDeleteVertex(command); break;
        case 'delete-polygon': result = this._outlineDeletePolygon(command); break;
        default: throw new Error('That scene-outline command is not available.');
      }
      if (command.outlineFormKey) {
        this.eventBus.emit('scene-outline:accepted', { formKey: command.outlineFormKey });
      }
      return result;
    } catch (error) {
      const message = error?.message || 'The scene change could not be applied.';
      if (command.outlineFormKey) {
        this.eventBus.emit('scene-outline:error', {
          formKey: command.outlineFormKey,
          message,
        });
      } else {
        this.announce(message, 'assertive');
        this._queueSceneOutlineRefresh();
      }
    }
  },

  _outlineWaypoint(id) {
    const waypoint = this.getWaypointById(id);
    if (!waypoint) throw new Error('That waypoint no longer exists.');
    return waypoint;
  },

  _outlineLayer(id) {
    const layer = this.scene.getFlowLayer(id);
    if (!layer) throw new Error('That crowd no longer exists.');
    return layer;
  },

  _outlineNode(layer, id) {
    const node = layer.graph.getNode(id);
    if (!node) throw new Error('That node no longer exists.');
    return node;
  },

  _outlineEdge(layer, id) {
    const edge = layer.graph.getEdge(id);
    if (!edge) throw new Error('That edge no longer exists.');
    return edge;
  },

  _selectFromSceneOutline(command) {
    switch (command.kind) {
      case 'waypoint': {
        const waypoint = this._outlineWaypoint(command.waypointId);
        this.eventBus.emit('waypoint:selected', waypoint);
        this._queueSceneOutlineRefresh(`${sceneOutlineKey('waypoint', waypoint.id)}:select`);
        return;
      }
      case 'polygon':
      case 'vertex': {
        const waypoint = this._outlineWaypoint(command.waypointId);
        this.eventBus.emit('waypoint:selected', waypoint);
        const key = command.kind === 'polygon'
          ? sceneOutlineKey('polygon', waypoint.id)
          : sceneOutlineKey('vertex', waypoint.id, Number(command.index));
        this._sceneOutlineSelectionKey = key;
        this._queueSceneOutlineRefresh(`${key}:select`);
        return;
      }
      case 'crowd': {
        const layer = this._outlineLayer(command.layerId);
        if (this.networkEditService.layer === layer && this.networkEditService.selection) {
          this.networkEditService.clearInspection();
        }
        this.eventBus.emit('crowd:selected', layer);
        this._queueSceneOutlineRefresh(`${sceneOutlineKey('crowd', layer.id)}:select`);
        return;
      }
      case 'emitter': {
        const layer = this._outlineLayer(command.layerId);
        if (!layer.getEmitter(command.emitterId)) throw new Error('That emitter no longer exists.');
        if (this.networkEditService.layer === layer && this.networkEditService.selection) {
          this.networkEditService.clearInspection();
        }
        this.eventBus.emit('crowd:selected', layer);
        const key = sceneOutlineKey('emitter', layer.id, command.emitterId);
        this._sceneOutlineSelectionKey = key;
        this._queueSceneOutlineRefresh(`${key}:select`);
        return;
      }
      case 'node':
      case 'edge':
      case 'control': {
        const layer = this._outlineLayer(command.layerId);
        if (this.networkEditService.active && this.networkEditService.layer !== layer) {
          this.networkEditService.exit();
        }
        this.eventBus.emit('crowd:selected', layer);
        this.networkEditService.bindForInspection(layer);
        if (command.kind === 'node') {
          const node = this._outlineNode(layer, command.nodeId);
          this.networkEditService.selectNode(node);
          const key = sceneOutlineKey('node', layer.id, node.id);
          this._sceneOutlineSelectionKey = key;
          this._queueSceneOutlineRefresh(`${key}:select`);
        } else {
          const edge = this._outlineEdge(layer, command.edgeId);
          if (command.kind === 'control') {
            const index = Number(command.index);
            if (!Number.isInteger(index) || !edge.controlPoints[index]) {
              throw new Error('That bend point no longer exists.');
            }
            this.networkEditService.selectControlPoint(edge, index);
          } else {
            this.networkEditService.selectEdge(edge);
          }
          const key = command.kind === 'control'
            ? sceneOutlineKey('control', layer.id, edge.id, Number(command.index))
            : sceneOutlineKey('edge', layer.id, edge.id);
          this._sceneOutlineSelectionKey = key;
          this._queueSceneOutlineRefresh(`${key}:select`);
        }
        return;
      }
      default:
        throw new Error('That scene item cannot be selected.');
    }
  },

  _outlineAddWaypoint(command) {
    if (this.waypoints.length >= PROJECT_MODEL_LIMITS.MAX_WAYPOINTS) {
      throw new Error(`The route supports at most ${PROJECT_MODEL_LIMITS.MAX_WAYPOINTS} waypoints.`);
    }
    const isMajor = command.kind === 'major';
    if (!isMajor && command.kind !== 'minor') throw new Error('Choose a major or minor waypoint.');
    if (!isMajor && this.waypoints.length === 0) {
      throw new Error('Add a major waypoint before adding a minor geometry point.');
    }
    const x = percentDraft(command, 'x', 'Horizontal position');
    const y = percentDraft(command, 'y', 'Vertical position');
    const hasExplicitInsertion = Object.prototype.hasOwnProperty.call(command, 'afterWaypointId');
    const afterWaypointId = hasExplicitInsertion ? String(command.afterWaypointId || '') : null;
    const afterWaypoint = afterWaypointId ? this._outlineWaypoint(afterWaypointId) : null;
    const priorIds = new Set(this.waypoints.map(waypoint => waypoint.id));
    const addRequest = { imgX: x, imgY: y, isMajor };
    if (hasExplicitInsertion) addRequest.insertAfterId = afterWaypoint?.id ?? null;
    this.eventBus.emit('waypoint:add', addRequest);
    const waypoint = this.waypoints.find(candidate => !priorIds.has(candidate.id));
    if (!waypoint) throw new Error('The waypoint could not be created.');
    // waypoint:add updates the model, but the canonical selection event owns
    // every editor/service hand-off for both major and minor waypoints.
    this.eventBus.emit('waypoint:selected', waypoint);
    const waypointKey = sceneOutlineKey('waypoint', waypoint.id);
    this._sceneOutlineSelectionKey = waypointKey;
    this._queueSceneOutlineRefresh(`${waypointKey}:select`);
    const index = this.waypoints.indexOf(waypoint);
    const placement = index === 0
      ? 'at the start of the route'
      : `after route waypoint ${index}`;
    this.announce(
      `${isMajor ? 'Major' : 'Minor'} waypoint added ${placement}, at ${command.x}%, ${command.y}%.`
    );
  },

  _outlineUpdateWaypoint(command) {
    const waypoint = this._outlineWaypoint(command.waypointId);
    const x = percentDraft(command, 'x', 'Horizontal position');
    const y = percentDraft(command, 'y', 'Vertical position');
    let waitMs = waypoint.pauseTime;
    let speed = waypoint.segmentSpeed;
    if (waypoint.isMajor) {
      waitMs = secondsDraft(command, 'waitSeconds', 'Wait');
      speed = numberBetween(command.segmentSpeed, 'Outgoing leg speed', 0.1, 10);
      const prospectivePause = this.waypoints.reduce(
        (sum, item) => sum + Number(item.pauseTime || 0),
        0
      ) - Number(waypoint.pauseTime || 0) + waitMs;
      if (prospectivePause > PROJECT_MODEL_LIMITS.MAX_TOTAL_PAUSE_MS) {
        throw new Error('The project pause-time budget has been reached.');
      }
    }
    const unchanged = waypoint.imgX === x && waypoint.imgY === y
      && (!waypoint.isMajor || (waypoint.pauseTime === waitMs && waypoint.segmentSpeed === speed));
    if (unchanged) return;

    waypoint.setPosition(x, y);
    if (waypoint.isMajor) {
      waypoint.pauseTime = waitMs;
      waypoint.pauseMode = waitMs > 0 ? 'timed' : 'none';
      waypoint.segmentSpeed = speed;
    }
    this._majorWaypointsCache = null;
    if (this.waypoints.length >= 2) this.calculatePath();
    else this.pathPoints = [];
    this.updateAnimationDuration();
    this.saveUndoState();
    this.updateWaypointList();
    if (this.selectedWaypoint === waypoint) {
      this.uiController?.updateWaypointEditor(waypoint);
      this.updateWaypointEditor();
    }
    this.autoSave();
    this.queueRender();
    this._queueSceneOutlineRefresh(`${sceneOutlineKey('waypoint', waypoint.id)}:apply`);
    this.announce(`${waypoint.isMajor ? 'Major' : 'Minor'} waypoint updated.`);
  },

  _outlineDeleteWaypoint(command) {
    const waypoint = this._outlineWaypoint(command.waypointId);
    const index = this.waypoints.indexOf(waypoint);
    const fallback = this.waypoints[index + 1] || this.waypoints[index - 1] || null;
    const wasSelected = this.selectedWaypoints?.includes(waypoint) || this.selectedWaypoint === waypoint;
    const previousOutlineSelection = this._sceneOutlineSelectionKey;
    this.eventBus.emit('waypoint:delete', waypoint);
    if (wasSelected) {
      if (this.selectedWaypoint && this.selectedWaypoints.length > 1) {
        this.eventBus.emit('waypoint:multi-selected', {
          waypoints: this.selectedWaypoints,
          primary: this.selectedWaypoint,
        });
      } else if (this.selectedWaypoint) {
        this.eventBus.emit('waypoint:selected', this.selectedWaypoint);
      } else {
        this.eventBus.emit('waypoint:deselected');
      }
    } else {
      this._sceneOutlineSelectionKey = previousOutlineSelection;
    }
    this._queueSceneOutlineRefresh(
      fallback ? `${sceneOutlineKey('waypoint', fallback.id)}:select` : 'route:summary'
    );
  },

  _outlineAddCrowd() {
    const layers = this.scene.getFlowLayers();
    if (layers.length >= SCENE_LIMITS.MAX_FLOW_LAYERS) {
      throw new Error(`The scene supports at most ${SCENE_LIMITS.MAX_FLOW_LAYERS} crowds.`);
    }
    const totals = layers.reduce((result, layer) => ({
      emitters: result.emitters + layer.emitters.length,
      dots: result.dots + layer.emitters.reduce((sum, emitter) => sum + emitter.dotCount, 0),
    }), { emitters: 0, dots: 0 });
    if (totals.emitters + 1 > SCENE_LIMITS.MAX_EMITTERS_TOTAL) {
      throw new Error('The project emitter limit has been reached.');
    }
    if (totals.dots + 50 > SCENE_LIMITS.MAX_DOTS_TOTAL) {
      throw new Error('The project dot budget has been reached.');
    }
    const before = new Set(this.scene.getFlowLayers().map(layer => layer.id));
    this.addCrowd({ enterNetworkEditor: false });
    const layer = this.scene.getFlowLayers().find(candidate => !before.has(candidate.id));
    if (!layer) throw new Error('The crowd could not be created.');
    const key = sceneOutlineKey('crowd', layer.id);
    this._sceneOutlineSelectionKey = key;
    this._queueSceneOutlineRefresh(`${key}:select`);
  },

  _outlineUpdateCrowd(command) {
    const layer = this._outlineLayer(command.layerId);
    const name = textDraft(command, 'name', 'Crowd name', { required: true });
    if (!GUIDE_TYPES.has(command.guideType)) throw new Error('Choose Route or Custom network.');
    const visible = command.visible === 'shown';
    const changedGuide = layer.guideType !== command.guideType;
    if (layer.name === name && layer.visible === visible && !changedGuide) return;
    layer.name = name;
    layer.visible = visible;
    layer.setGuideType(command.guideType);
    if (changedGuide && command.guideType === 'route'
        && this.networkEditService.layer === layer) {
      if (this.networkEditService.active) this.networkEditService.exit();
      else this.networkEditService.clearInspection();
    }
    this.saveUndoState();
    this.autoSave();
    this.updateLayersStrip();
    if (this.selectedCrowd === layer) {
      this.syncCrowdEditor();
      if (changedGuide) this.eventBus.emit('crowd:selected', layer);
    }
    this.updateGuideCard?.();
    this.queueRender();
    this._queueSceneOutlineRefresh(`${sceneOutlineKey('crowd', layer.id)}:apply`);
    const layerNumber = this.scene.getFlowLayers().indexOf(layer) + 1;
    const displayName = typeof layer.name === 'string' && layer.name.trim()
      ? layer.name
      : `Crowd ${layerNumber}`;
    this.announce(`${displayName} updated.`);
  },

  _outlineDeleteCrowd(command) {
    const layer = this._outlineLayer(command.layerId);
    const layers = this.scene.getFlowLayers();
    const index = layers.indexOf(layer);
    const fallback = layers[index + 1] || layers[index - 1] || null;
    const wasSelected = this.selectedCrowd === layer;
    const previousOutlineSelection = this._sceneOutlineSelectionKey;
    this.deleteCrowd(layer);
    if (!wasSelected) this._sceneOutlineSelectionKey = previousOutlineSelection;
    this._queueSceneOutlineRefresh(
      fallback ? `${sceneOutlineKey('crowd', fallback.id)}:select` : 'crowds:add'
    );
  },

  _outlineUpdateEmitter(command) {
    const layer = this._outlineLayer(command.layerId);
    const emitter = layer.getEmitter(command.emitterId);
    if (!emitter) throw new Error('That emitter no longer exists.');
    if (layer.emitters[0] !== emitter) {
      throw new Error('Additional emitters are read-only until multi-emitter controls are designed.');
    }
    if (!LIFECYCLE_MODES.has(command.lifecycleMode)) throw new Error('Choose a valid lifecycle.');
    assertSafeStoredColor(command.dotColor, 'emitter dot colour', { allowTransparent: true });
    const dotCount = positiveInteger(command.dotCount, 'Dots', EMITTER_LIMITS.MAX_DOT_COUNT);
    const totalDots = this.scene.getFlowLayers().reduce((sum, candidate) =>
      sum + candidate.emitters.reduce((layerSum, item) => layerSum + item.dotCount, 0), 0
    ) - emitter.dotCount + dotCount;
    if (totalDots > SCENE_LIMITS.MAX_DOTS_TOTAL) {
      throw new Error(`The whole scene supports at most ${SCENE_LIMITS.MAX_DOTS_TOTAL} configured dots.`);
    }
    const updates = {
      dotCount,
      releaseStart: percentDraft(command, 'releaseStart', 'Release start'),
      releaseDuration: percentDraft(command, 'releaseDuration', 'Release length'),
      onsetVariance: percentDraft(command, 'onsetVariance', 'Onset variation'),
      intensityRamp: originalCanonical(command, 'intensityRamp')
        ?? numberBetween(command.intensityRamp, 'Intensity ramp', -100, 100) / 100,
      speed: numberBetween(command.speed, 'Speed', 0.001, EMITTER_LIMITS.MAX_SPEED),
      speedVariance: percentDraft(command, 'speedVariance', 'Speed variation'),
      dotSize: numberBetween(command.dotSize, 'Dot size', 0.01, EMITTER_LIMITS.MAX_DOT_SIZE),
      wobble: percentDraft(command, 'wobble', 'Walking variation'),
      dotColor: command.dotColor,
      lifecycleMode: command.lifecycleMode,
    };
    if (Object.entries(updates).every(([key, value]) => emitter[key] === value)) return;
    emitter.update(updates);
    this.saveUndoState();
    this.autoSave();
    this.updateLayersStrip();
    if (this.selectedCrowd === layer) this.syncCrowdEditor();
    this.queueRender();
    const key = sceneOutlineKey('emitter', layer.id, emitter.id);
    this._queueSceneOutlineRefresh(`${key}:apply`);
    this.announce('Primary emitter updated.');
  },

  _outlineGraphCounts() {
    return this.scene.getFlowLayers().reduce((totals, layer) => ({
      nodes: totals.nodes + layer.graph.getNodes().length,
      edges: totals.edges + layer.graph.getEdges().length,
    }), { nodes: 0, edges: 0 });
  },

  _outlineAddNode(command) {
    const layer = this._outlineLayer(command.layerId);
    const totals = this._outlineGraphCounts();
    if (layer.graph.getNodes().length >= FLOW_LAYER_LIMITS.MAX_GRAPH_NODES
        || totals.nodes >= SCENE_LIMITS.MAX_GRAPH_NODES_TOTAL) {
      throw new Error('The project node limit has been reached.');
    }
    if (!NODE_TYPES.has(command.type)) throw new Error('Choose a valid node type.');
    const node = layer.graph.addNode({
      x: percentDraft(command, 'x', 'Horizontal position'),
      y: percentDraft(command, 'y', 'Vertical position'),
      type: command.type,
      label: shortText(command.label, 'Node label'),
    });
    this.eventBus.emit('network:changed', { commit: true });
    this.eventBus.emit('crowd:selected', layer);
    this.networkEditService.bindForInspection(layer);
    this.networkEditService.selectNode(node);
    const key = sceneOutlineKey('node', layer.id, node.id);
    this._sceneOutlineSelectionKey = key;
    this._queueSceneOutlineRefresh(`${key}:select`);
    this.announce(`Node added at ${command.x}%, ${command.y}%.`);
  },

  _outlineUpdateNode(command) {
    const layer = this._outlineLayer(command.layerId);
    const node = this._outlineNode(layer, command.nodeId);
    if (!NODE_TYPES.has(command.type)) throw new Error('Choose a valid node type.');
    const x = percentDraft(command, 'x', 'Horizontal position');
    const y = percentDraft(command, 'y', 'Vertical position');
    const label = textDraft(command, 'label', 'Node label');
    if (node.x === x && node.y === y && node.type === command.type && node.label === label) return;
    node.moveTo(x, y);
    node.type = command.type;
    node.label = label;
    this.eventBus.emit('network:changed', { commit: true });
    if (this.networkEditService.layer === layer
        && this.networkEditService.selection?.kind === 'node'
        && this.networkEditService.selection.id === node.id) {
      this.eventBus.emit('network:node-selected', { node });
    }
    const key = sceneOutlineKey('node', layer.id, node.id);
    this._queueSceneOutlineRefresh(`${key}:apply`);
    this.announce('Node updated.');
  },

  _outlineDeleteNode(command) {
    const layer = this._outlineLayer(command.layerId);
    const node = this._outlineNode(layer, command.nodeId);
    const cascadedEdges = layer.graph.getEdgesForNode(node.id);
    const cascaded = cascadedEdges.length;
    const selected = this.networkEditService.layer === layer
      ? this.networkEditService.selection
      : null;
    const selectionRemoved = (selected?.kind === 'node' && selected.id === node.id)
      || (selected?.kind === 'edge' && cascadedEdges.some(edge => edge.id === selected.id));
    const previousOutlineSelection = this._sceneOutlineSelectionKey;
    if (!layer.graph.removeNode(node.id)) return;
    if (selectionRemoved) {
      this.networkEditService.clearSelection();
    }
    this.eventBus.emit('network:changed', { commit: true });
    this._sceneOutlineSelectionKey = selectionRemoved
      ? sceneOutlineKey('crowd', layer.id)
      : previousOutlineSelection;
    this._queueSceneOutlineRefresh(`${sceneOutlineKey('network', layer.id)}:summary`);
    this.announce(`Node deleted${cascaded ? ` with ${plural(cascaded, 'connected edge')}` : ''}. Undo available.`);
  },

  _outlineConnectNodes(command) {
    const layer = this._outlineLayer(command.layerId);
    const source = this._outlineNode(layer, command.sourceId);
    const target = this._outlineNode(layer, command.targetId);
    if (source.id === target.id) throw new Error('Choose two different nodes.');
    if (!EDGE_DIRECTIONS.has(command.direction)) throw new Error('Choose a valid edge direction.');
    const joined = layer.graph.getEdgesForNode(source.id).some(edge =>
      edge.sourceId === target.id || edge.targetId === target.id
    );
    if (joined) throw new Error('Those nodes are already connected.');
    const totals = this._outlineGraphCounts();
    if (layer.graph.getEdges().length >= FLOW_LAYER_LIMITS.MAX_GRAPH_EDGES
        || totals.edges >= SCENE_LIMITS.MAX_GRAPH_EDGES_TOTAL) {
      throw new Error('The project edge limit has been reached.');
    }
    const edge = layer.graph.addEdge({
      sourceId: source.id,
      targetId: target.id,
      direction: command.direction,
      weight: numberBetween(command.weight, 'Path weight', 0.01, Number.MAX_SAFE_INTEGER),
    });
    this.eventBus.emit('network:changed', { commit: true });
    this.eventBus.emit('crowd:selected', layer);
    this.networkEditService.bindForInspection(layer);
    this.networkEditService.selectEdge(edge);
    const key = sceneOutlineKey('edge', layer.id, edge.id);
    this._sceneOutlineSelectionKey = key;
    this._queueSceneOutlineRefresh(`${key}:select`);
    this.announce('Nodes connected.');
  },

  _outlineUpdateEdge(command) {
    const layer = this._outlineLayer(command.layerId);
    const edge = this._outlineEdge(layer, command.edgeId);
    if (!EDGE_DIRECTIONS.has(command.direction)) throw new Error('Choose a valid edge direction.');
    const weight = originalCanonical(command, 'weight')
      ?? numberBetween(command.weight, 'Path weight', 0.01, Number.MAX_SAFE_INTEGER);
    if (edge.direction === command.direction && edge.weight === weight) return;
    edge.setDirection(command.direction);
    edge.setWeight(weight);
    this.eventBus.emit('network:changed', { commit: true });
    if (this.networkEditService.layer === layer
        && this.networkEditService.selection?.kind === 'edge'
        && this.networkEditService.selection.id === edge.id) {
      this.eventBus.emit('network:edge-selected', { edge });
      const selectedControl = this.networkEditService.selectedControlPoint();
      if (selectedControl) {
        this.eventBus.emit('network:control-selected', {
          edge,
          index: selectedControl.index,
        });
      }
    }
    const key = sceneOutlineKey('edge', layer.id, edge.id);
    this._queueSceneOutlineRefresh(`${key}:apply`);
    this.announce('Edge updated.');
  },

  _outlineDeleteEdge(command) {
    const layer = this._outlineLayer(command.layerId);
    const edge = this._outlineEdge(layer, command.edgeId);
    const previousOutlineSelection = this._sceneOutlineSelectionKey;
    const selectionRemoved = this.networkEditService.layer === layer
      && this.networkEditService.selection?.kind === 'edge'
      && this.networkEditService.selection.id === edge.id;
    layer.graph.removeEdge(edge.id);
    if (selectionRemoved) {
      this.networkEditService.clearSelection();
    }
    this.eventBus.emit('network:changed', { commit: true });
    this._sceneOutlineSelectionKey = selectionRemoved
      ? sceneOutlineKey('crowd', layer.id)
      : previousOutlineSelection;
    this._queueSceneOutlineRefresh(`${sceneOutlineKey('network', layer.id)}:summary`);
    this.announce('Edge deleted. Undo available.');
  },

  _outlineAddControl(command) {
    const layer = this._outlineLayer(command.layerId);
    const edge = this._outlineEdge(layer, command.edgeId);
    const layerControlCount = layer.graph.getEdges().reduce(
      (sum, candidate) => sum + candidate.controlPoints.length,
      0
    );
    if (edge.controlPoints.length >= FLOW_LAYER_LIMITS.MAX_CONTROL_POINTS_PER_EDGE
        || layerControlCount >= FLOW_LAYER_LIMITS.MAX_CONTROL_POINTS_TOTAL) {
      throw new Error('The project bend-point limit has been reached.');
    }
    const index = edge.addControlPoint(
      percent(command.x, 'Horizontal position'),
      percent(command.y, 'Vertical position')
    );
    this.eventBus.emit('network:changed', { commit: true });
    this.eventBus.emit('crowd:selected', layer);
    this.networkEditService.bindForInspection(layer);
    this.networkEditService.selectControlPoint(edge, index);
    const key = sceneOutlineKey('control', layer.id, edge.id, index);
    this._sceneOutlineSelectionKey = key;
    this._queueSceneOutlineRefresh(`${key}:select`);
    this.announce('Bend point added.');
  },

  _outlineUpdateControl(command) {
    const layer = this._outlineLayer(command.layerId);
    const edge = this._outlineEdge(layer, command.edgeId);
    const index = Number(command.index);
    if (!Number.isInteger(index) || !edge.controlPoints[index]) throw new Error('That bend point no longer exists.');
    const point = {
      x: percentDraft(command, 'x', 'Horizontal position'),
      y: percentDraft(command, 'y', 'Vertical position'),
    };
    if (edge.controlPoints[index].x === point.x && edge.controlPoints[index].y === point.y) return;
    edge.controlPoints[index] = point;
    this.eventBus.emit('network:changed', { commit: true });
    const key = sceneOutlineKey('control', layer.id, edge.id, index);
    this._queueSceneOutlineRefresh(`${key}:apply`);
    this.announce(`Bend point ${index + 1} updated.`);
  },

  _outlineDeleteControl(command) {
    const layer = this._outlineLayer(command.layerId);
    const edge = this._outlineEdge(layer, command.edgeId);
    const index = Number(command.index);
    const previousOutlineSelection = this._sceneOutlineSelectionKey;
    const selectionPrefix = `${sceneOutlineKey('control', layer.id, edge.id)}:`;
    const selectedOutlineIndex = previousOutlineSelection?.startsWith(selectionPrefix)
      ? Number(previousOutlineSelection.slice(selectionPrefix.length))
      : null;
    const selectedServiceControl = this.networkEditService.layer === layer
      && this.networkEditService.selection?.id === edge.id
      ? this.networkEditService.selectedControlPoint()
      : null;
    if (!Number.isInteger(index) || !edge.removeControlPoint(index)) {
      throw new Error('That bend point no longer exists.');
    }
    this.eventBus.emit('network:changed', { commit: true });
    const fallbackIndex = Math.min(index, edge.controlPoints.length - 1);
    const fallbackKey = fallbackIndex >= 0
      ? `${selectionPrefix}${fallbackIndex}`
      : sceneOutlineKey('edge', layer.id, edge.id);

    if (selectedServiceControl) {
      const nextIndex = selectedServiceControl.index === index
        ? fallbackIndex
        : selectedServiceControl.index - (selectedServiceControl.index > index ? 1 : 0);
      if (nextIndex >= 0) this.networkEditService.selectControlPoint(edge, nextIndex);
      else this.networkEditService.selectEdge(edge);
    }

    if (Number.isInteger(selectedOutlineIndex)) {
      const nextIndex = selectedOutlineIndex === index
        ? fallbackIndex
        : selectedOutlineIndex - (selectedOutlineIndex > index ? 1 : 0);
      this._sceneOutlineSelectionKey = nextIndex >= 0
        ? `${selectionPrefix}${nextIndex}`
        : sceneOutlineKey('edge', layer.id, edge.id);
    } else {
      this._sceneOutlineSelectionKey = previousOutlineSelection;
    }
    this._queueSceneOutlineRefresh(`${fallbackKey}:${fallbackIndex >= 0 ? 'select' : 'summary'}`);
    this.announce('Bend point deleted. Undo available.');
  },

  _commitOutlineArea(waypoint, focusKey, message) {
    this.saveUndoState();
    this.autoSave();
    if (this.selectedWaypoint === waypoint) this.uiController?.updateWaypointEditor(waypoint);
    this.queueRender();
    this._queueSceneOutlineRefresh(focusKey);
    this.announce(message);
  },

  _outlineCreatePolygon(command) {
    const waypoint = this._outlineWaypoint(command.waypointId);
    if (waypoint.areaHighlight.shape !== 'none') {
      throw new Error('Change or remove the existing area shape in the waypoint inspector first.');
    }
    if (this._outlinePolygonPointCount() + 3 > PROJECT_MODEL_LIMITS.MAX_AREA_POINTS_TOTAL) {
      throw new Error('The project polygon-vertex limit has been reached.');
    }
    const x = waypoint.imgX;
    const y = waypoint.imgY;
    waypoint.areaHighlight.enabled = true;
    waypoint.areaHighlight.shape = 'polygon';
    waypoint.areaHighlight.points = [
      { x: clamp01(x), y: clamp01(y - 0.04) },
      { x: clamp01(x - 0.04), y: clamp01(y + 0.04) },
      { x: clamp01(x + 0.04), y: clamp01(y + 0.04) },
    ];
    this.eventBus.emit('waypoint:selected', waypoint);
    const key = sceneOutlineKey('vertex', waypoint.id, 0);
    this._sceneOutlineSelectionKey = key;
    this._commitOutlineArea(waypoint, `${key}:select`, 'Polygon created with three vertices.');
  },

  _outlineUpdatePolygonTiming(command) {
    const waypoint = this._outlineWaypoint(command.waypointId);
    if (waypoint.areaHighlight.shape !== 'polygon') throw new Error('That polygon no longer exists.');
    const fadeInMs = secondsDraft(command, 'fadeInSeconds', 'Fade in');
    const fadeOutMs = secondsDraft(command, 'fadeOutSeconds', 'Fade out');
    if (waypoint.areaHighlight.fadeInMs === fadeInMs
        && waypoint.areaHighlight.fadeOutMs === fadeOutMs) return;
    waypoint.areaHighlight.fadeInMs = fadeInMs;
    waypoint.areaHighlight.fadeOutMs = fadeOutMs;
    const key = sceneOutlineKey('polygon', waypoint.id);
    this._commitOutlineArea(waypoint, `${key}:timing`, 'Polygon timing updated.');
  },

  _outlinePolygonPointCount() {
    return this.waypoints.reduce((sum, waypoint) =>
      sum + (Array.isArray(waypoint.areaHighlight?.points) ? waypoint.areaHighlight.points.length : 0), 0
    );
  },

  _outlineAddVertex(command) {
    const waypoint = this._outlineWaypoint(command.waypointId);
    const points = waypoint.areaHighlight.points;
    if (waypoint.areaHighlight.shape !== 'polygon' || !Array.isArray(points)) {
      throw new Error('That polygon no longer exists.');
    }
    if (points.length >= PROJECT_MODEL_LIMITS.MAX_AREA_POINTS_PER_WAYPOINT
        || this._outlinePolygonPointCount() >= PROJECT_MODEL_LIMITS.MAX_AREA_POINTS_TOTAL) {
      throw new Error('The project polygon-vertex limit has been reached.');
    }
    points.push({
      x: percentDraft(command, 'x', 'Horizontal position'),
      y: percentDraft(command, 'y', 'Vertical position'),
    });
    waypoint.areaHighlight.enabled = points.length >= 3;
    const index = points.length - 1;
    this.eventBus.emit('waypoint:selected', waypoint);
    const key = sceneOutlineKey('vertex', waypoint.id, index);
    this._sceneOutlineSelectionKey = key;
    this._commitOutlineArea(waypoint, `${key}:select`, `Vertex ${index + 1} added.`);
  },

  _outlineUpdateVertex(command) {
    const waypoint = this._outlineWaypoint(command.waypointId);
    const points = waypoint.areaHighlight.points;
    const index = Number(command.index);
    if (waypoint.areaHighlight.shape !== 'polygon' || !Number.isInteger(index) || !points?.[index]) {
      throw new Error('That polygon vertex no longer exists.');
    }
    const point = {
      x: percentDraft(command, 'x', 'Horizontal position'),
      y: percentDraft(command, 'y', 'Vertical position'),
    };
    if (points[index].x === point.x && points[index].y === point.y) return;
    points[index] = point;
    const key = sceneOutlineKey('vertex', waypoint.id, index);
    this._commitOutlineArea(waypoint, `${key}:apply`, `Vertex ${index + 1} updated.`);
  },

  _outlineDeleteVertex(command) {
    const waypoint = this._outlineWaypoint(command.waypointId);
    const points = waypoint.areaHighlight.points;
    const index = Number(command.index);
    if (waypoint.areaHighlight.shape !== 'polygon' || !Number.isInteger(index) || !points?.[index]) {
      throw new Error('That polygon vertex no longer exists.');
    }
    if (points.length <= 3) {
      throw new Error('A polygon needs at least three vertices. Delete the polygon instead.');
    }
    const previousOutlineSelection = this._sceneOutlineSelectionKey;
    const selectionPrefix = `${sceneOutlineKey('vertex', waypoint.id)}:`;
    const selectedIndex = previousOutlineSelection?.startsWith(selectionPrefix)
      ? Number(previousOutlineSelection.slice(selectionPrefix.length))
      : null;
    points.splice(index, 1);
    const fallback = Math.min(index, points.length - 1);
    const key = sceneOutlineKey('vertex', waypoint.id, fallback);
    if (Number.isInteger(selectedIndex)) {
      const nextIndex = selectedIndex === index
        ? fallback
        : selectedIndex - (selectedIndex > index ? 1 : 0);
      this._sceneOutlineSelectionKey = sceneOutlineKey('vertex', waypoint.id, nextIndex);
    } else {
      this._sceneOutlineSelectionKey = previousOutlineSelection;
    }
    this._commitOutlineArea(waypoint, `${key}:select`, 'Vertex deleted. Undo available.');
  },

  _outlineDeletePolygon(command) {
    const waypoint = this._outlineWaypoint(command.waypointId);
    if (waypoint.areaHighlight.shape !== 'polygon') throw new Error('That polygon no longer exists.');
    const previousOutlineSelection = this._sceneOutlineSelectionKey;
    const deletingSelected = previousOutlineSelection === sceneOutlineKey('polygon', waypoint.id)
      || previousOutlineSelection?.startsWith(`${sceneOutlineKey('vertex', waypoint.id)}:`);
    waypoint.areaHighlight.enabled = false;
    waypoint.areaHighlight.shape = 'none';
    waypoint.areaHighlight.points = [];
    const key = sceneOutlineKey('waypoint', waypoint.id);
    this._sceneOutlineSelectionKey = deletingSelected ? key : previousOutlineSelection;
    this._commitOutlineArea(waypoint, `${key}:select`, 'Polygon deleted. Undo available.');
  },
};

function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}
