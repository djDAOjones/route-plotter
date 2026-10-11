/**
 * Crowd layers: the layers strip, Crowd scope selection, and the card
 * controls that edit a crowd's guide/dots/release/motion (Phase 4).
 *
 * "Crowd" is the user-facing noun (decision 2026-08-18); the internal
 * model stays FlowLayer/Emitter/scene. Each crowd's cards edit the
 * layer's FIRST emitter — the model supports several dot streams per
 * layer, but the UI authors one (console-authored extras keep working;
 * only the first is editable here).
 *
 * RoutePlotter prototype mixin: `this` is the RoutePlotter instance;
 * main.js attaches the group via Object.assign(RoutePlotter.prototype,
 * crowdsMixin). Method names must stay unique across mixins
 * (tests/mixins.test.js).
 */
import { isMac } from '../config/keybindings.js';
import { refreshSwatchPicker } from '../components/SwatchPicker.js';
import {
  busynessAt,
  compileBusynessEnvelope,
  defaultBusynessEnvelope,
  MAX_BUSYNESS_HANDLES,
  normalizeBusynessEnvelope,
} from '../utils/busynessEnvelope.js';
import { traceRouteIntoGraph, applyTraceToLayer } from '../utils/routeTrace.js';
import { FLOW_LAYER_LIMITS } from '../models/FlowLayer.js';
import { GraphModel } from '../models/GraphModel.js';
import { stageProjectModel } from './persistence.js';
import { formatCrowdDotSize } from '../utils/uiReadouts.js';

/** Okabe-Ito sky blue — visually distinct from the vermillion route default. */
const NEW_CROWD_DOT_COLOR = '#56B4E9';
/**
 * A new crowd's Speed (img/s) and Window length (DEF-77). At the model's own
 * 0.15 img/s across the whole timeline, a default crowd's dots rarely reached
 * their journey's end on a canvas narrower than about 1,333 px, so "At journey
 * end" seemed to do nothing. At 0.40 released over the first half, every dot
 * of a default crowd finishes on a canvas 960 px wide or more, and at least
 * nine in ten on one 720 px wide. Only a new crowd takes these: a saved crowd
 * keeps the values it was saved with.
 */
const NEW_CROWD_SPEED = 0.4;
const NEW_CROWD_RELEASE_DURATION = 0.5;
/**
 * Shown under "At journey end" where nothing on the network can end a
 * journey (DEF-77): no pace would help. Since the end waits for every journey
 * that ends (CROWD-05), a slow crowd is no longer cut off, so this is the
 * only case left.
 */
const LIFECYCLE_ENDLESS_HINT = 'No dot’s journey ends on this network. '
  + 'Set a node’s Type to Exit to see this setting act.';
const BUSYNESS_GRAPH = Object.freeze({ width: 300, height: 140, padX: 18, padY: 16 });
const SVG_NS = 'http://www.w3.org/2000/svg';
/**
 * Hints on a busyness handle's fields, by `data-busyness-field` (UI-03). Each
 * sits on its label's text, as the inspector's others do (ParamTooltip).
 */
const BUSYNESS_HINTS = Object.freeze({
  time: 'Where this handle sits in the window: 0% at its start, 100% at its end. '
    + 'The first and last handles stay put',
  value: 'How busy the release is at this handle: higher sets more dots off around it, 0% none',
  transition: 'How busyness changes from this handle to the next: Gradual slides there evenly; '
    + 'Sudden holds this level, then jumps',
});

/** A busyness field's label text, carrying its hint. */
function busynessLabelText(text, hint) {
  const span = document.createElement('span');
  span.textContent = text;
  span.setAttribute('data-tip', hint);
  return span;
}

export function formatCrowdReleaseTiming(percent) {
  const rounded = Math.round(percent);
  return rounded === 0 ? 'Even' : `${rounded}% uneven`;
}

export function formatCrowdReleaseBias(percent) {
  const rounded = Math.round(percent);
  if (rounded === 0) return 'Even';
  return rounded < 0 ? `Earlier ${Math.abs(rounded)}%` : `Later ${rounded}%`;
}

/**
 * Why `project` could not be saved as a file, or opened again, or null: the
 * loader's model checks (`stageProjectModel`), run on its JSON, as a file or
 * recovery holds it (where the model shares a value, its JSON repeats it),
 * and the file's own (`prepareArchive`: the metadata a ZIP of it carries).
 * @param {Object} app
 * @param {Object} project - A project snapshot, built without assets
 * @returns {string|null}
 */
function unstorable(app, project) {
  const cache = app._autosaveBackgroundCache;
  const background = cache && cache.image === app.background?.image ? cache.dataURL : null;
  try {
    stageProjectModel(JSON.parse(JSON.stringify(project)));
    app.imageAssetService.prepareArchive(project, background);
    return null;
  } catch (error) {
    return error.message;
  }
}

/**
 * Why a traced network could not be stored, or null. The project the trace
 * would make is checked as it would be saved and opened (`unstorable`),
 * before the trace replaces anything: a network the loader refuses (a leg
 * with more bends than a path can hold, more nodes than a scene can hold,
 * labels past the project's text budget), or a file too big to save, left a
 * project that could not be saved or would not reopen (DEF-52). A leg with
 * too many bends is named. A reason the project had before the trace refuses
 * it too: the project it would make could not be saved or opened either, and
 * one reason can hide another behind the same words. Browser recovery holds
 * the same model, compact and without its images, so a project whose file
 * metadata fits its 2 MB fits recovery's 4 MB.
 * @param {Object} app
 * @param {FlowLayer} layer
 * @param {{nodes: Array, edges: Array}} trace
 * @returns {string|null}
 */
function traceStorageProblem(app, layer, trace) {
  const limit = FLOW_LAYER_LIMITS.MAX_CONTROL_POINTS_PER_EDGE;
  const crowded = trace.edges.find(edge => edge.controlPoints.length > limit);
  if (crowded) {
    const from = trace.nodes.find(node => node.id === crowded.sourceId)?.label;
    const leg = from ? `The leg from ${from}` : 'A leg of the route';
    return `${leg} has ${crowded.controlPoints.length} bends, more than the ${limit} a crowd’s path can hold. `
      + 'Remove some of its minor waypoints, then trace again.';
  }
  const graph = new GraphModel();
  for (const node of trace.nodes) graph.addNode(node);
  for (const edge of trace.edges) graph.addEdge(edge);
  const project = app._buildProjectSnapshot({ includeAssets: false });
  const traced = { ...layer.toJSON(), guideType: 'graph', graph: graph.toJSON() };
  const reason = unstorable(app, {
    ...project,
    scene: { ...project.scene, flowLayers: project.scene.flowLayers.map(each => (each.id === layer.id ? traced : each)) },
  });
  return reason ? `This route can’t be traced into a crowd: ${reason}.` : null;
}

export const crowdsMixin = {

  /**
   * Wire the layers strip and the Crowd scope card controls.
   * Call once at init, after the static DOM exists.
   */
  setupCrowdControls() {
    this._layersStripEl = document.getElementById('layers-strip');
    this._addCrowdBtn = document.getElementById('add-crowd-btn');

    this._addCrowdBtn?.addEventListener('click', () => this.addCrowd());

    // ── Selection events ────────────────────────────────
    this.eventBus.on('crowd:selected', (layer) => {
      this.selectedCrowd = layer;
      // One selection at a time: entering Crowd scope leaves the
      // waypoint scope through its ordinary event
      if (this.selectedWaypoint) {
        this.eventBus.emit('waypoint:deselected');
      }
      this.updateLayersStrip();
      this.syncCrowdEditor();
    });

    this.eventBus.on('crowd:deselected', () => {
      this.selectedCrowd = null;
      this.updateLayersStrip();
    });

    // Selecting any waypoint (single or multi) leaves Crowd scope
    const leaveCrowdScope = () => {
      if (this.selectedCrowd) {
        this.selectedCrowd = null;
        this.eventBus.emit('crowd:deselected');
      }
    };
    this.eventBus.on('waypoint:selected', leaveCrowdScope);
    this.eventBus.on('waypoint:multi-selected', leaveCrowdScope);
    // Escape backs out of Crowd scope to Route scope
    this.eventBus.on('waypoint:deselect', leaveCrowdScope);

    // Central crowd param pipeline (mirrors waypoint:path-property-changed).
    // An edit that moves no dot's release or journey (its colour, size, sway
    // or what it does at the end) says `journeys: false`, and the "At journey
    // end" hint keeps its answer rather than schedule every dot again (DEF-77).
    // Every one, `journeys: false` too, may change where the scene ends
    // (CROWD-05): the lifecycle decides whether a crowd finishes at all.
    this.eventBus.on('crowd:param-changed', ({ journeys = true } = {}) => {
      this.saveUndoStateDebounced();
      this.autoSave();
      this.queueRender();
      if (journeys) this._syncCrowdLifecycleHint();
      this.scheduleSceneEnd?.();
    });

    // Whether a journey can end turns on the network's shape, so the hint
    // follows it: on each committed change, never per frame. A new timeline
    // no longer changes it (CROWD-05), but a project opened, cleared or put
    // back sets one, and the hint is refreshed with it. The scene's end
    // follows a network change too, as it does a crowd's every other
    // committed change: a seed, its busyness, visibility, a crowd added,
    // deleted or traced.
    this.eventBus.on('animation:durationChange', () => this._syncCrowdLifecycleHint());
    this.eventBus.on('network:changed', ({ commit } = {}) => {
      if (!commit) return;
      this._syncCrowdLifecycleHint();
      this.scheduleSceneEnd?.();
    });
    this.eventBus.on('scene:semantic-changed', () => this.scheduleSceneEnd?.());

    // Route changes update the Add-crowd description: a new crowd follows
    // an existing route or starts an empty custom network.
    this.eventBus.on('waypoint:list-updated', () => this.updateLayersStrip());

    // ── Card controls (single-writer: this is the only wiring) ──
    const emitterOf = () => this.selectedCrowd?.emitters[0];

    document.getElementById('crowd-guide-type')?.addEventListener('change', (e) => {
      if (!this.selectedCrowd) return;
      this.selectedCrowd.setGuideType(e.target.value);
      this.syncCrowdEditor();
      this.eventBus.emit('crowd:param-changed');
      // The network mixin reacts: empty-network crowds go straight into
      // network editing; switching back to route closes the mode
      this.eventBus.emit('network:guide-changed', this.selectedCrowd);
    });

    document.getElementById('crowd-dot-color')?.addEventListener('input', (e) => {
      const em = emitterOf();
      if (!em) return;
      em.update({ dotColor: e.target.value });
      this.updateLayersStrip(); // Row swatch mirrors the dot colour
      this.eventBus.emit('crowd:param-changed', { journeys: false });
    });

    // Read as the diameter drawn, in reference px (CROWD-07 F1); stored in ×.
    this._wireCrowdSlider('crowd-dot-size', (raw) => {
      emitterOf()?.update({ dotSize: raw / 100 });
      return formatCrowdDotSize(raw / 100);
    }, { journeys: false });

    this._wireCrowdSlider('crowd-wobble', (raw) => {
      emitterOf()?.update({ wobble: raw / 100 });
      return `${Math.round(raw)}%`;
    }, { journeys: false });

    this._wireCrowdSlider('crowd-count', (raw) => {
      emitterOf()?.update({ dotCount: raw });
      return `${Math.round(raw)}`;
    });

    this._wireCrowdSlider('crowd-release-start', (raw) => {
      emitterOf()?.update({ releaseStart: raw / 100 });
      return `${Math.round(raw)}%`;
    });

    this._wireCrowdSlider('crowd-release-duration', (raw) => {
      emitterOf()?.update({ releaseDuration: raw / 100 });
      return `${Math.round(raw)}%`;
    });

    this._wireCrowdSlider('crowd-onset-variance', (raw) => {
      emitterOf()?.update({ onsetVariance: raw / 100 });
      return formatCrowdReleaseTiming(raw);
    });

    this._wireCrowdSlider('crowd-intensity-ramp', (raw) => {
      emitterOf()?.update({ intensityRamp: raw / 100 });
      return formatCrowdReleaseBias(raw);
    });

    this._wireCrowdSlider('crowd-speed', (raw) => {
      emitterOf()?.update({ speed: raw / 100 });
      return `${(raw / 100).toFixed(2)} image lengths/s`;
    });

    this._wireCrowdSlider('crowd-speed-variance', (raw) => {
      emitterOf()?.update({ speedVariance: raw / 100 });
      return `${Math.round(raw)}%`;
    });

    document.getElementById('crowd-lifecycle')?.addEventListener('change', (e) => {
      const em = emitterOf();
      if (!em) return;
      em.update({ lifecycleMode: e.target.value });
      this.eventBus.emit('crowd:param-changed', { journeys: false });
    });

    document.getElementById('crowd-reroll-btn')?.addEventListener('click', () => {
      this._rerollCrowdPattern();
    });

    document.getElementById('crowd-busyness-add')?.addEventListener('click', () => {
      this._addCrowdBusynessHandle();
    });
    document.getElementById('crowd-busyness-reset')?.addEventListener('click', () => {
      this._commitCrowdBusynessEnvelope(defaultBusynessEnvelope(), 'Busyness reset to even.');
    });
    document.getElementById('crowd-busyness-handles')?.addEventListener('change', (event) => {
      this._changeCrowdBusynessControl(event.target);
    });

    const busynessGraph = document.getElementById('crowd-busyness-graph');
    busynessGraph?.addEventListener('pointerdown', event => this._startCrowdBusynessDrag(event));
    busynessGraph?.addEventListener('pointermove', event => this._moveCrowdBusynessDrag(event));
    busynessGraph?.addEventListener('pointerup', event => this._finishCrowdBusynessDrag(event, true));
    busynessGraph?.addEventListener('pointercancel', event => this._finishCrowdBusynessDrag(event, false));
  },

  /**
   * Wire one crowd slider: write-through on input (guarded on a crowd
   * being selected), value readout, param-changed pipeline.
   * @param {string} id - Element id; `${id}-value` is the readout span
   * @param {Function} apply - raw slider number → readout string (writes the model)
   * @param {Object} [options]
   * @param {boolean} [options.journeys=true] - False for a slider that moves
   *   no dot's release or journey (crowd:param-changed)
   * @private
   */
  _wireCrowdSlider(id, apply, { journeys = true } = {}) {
    const el = document.getElementById(id);
    const valueEl = document.getElementById(`${id}-value`);
    el?.addEventListener('input', (e) => {
      if (!this.selectedCrowd?.emitters[0]) return;
      const text = apply(parseFloat(e.target.value));
      if (valueEl) valueEl.textContent = text;
      el.setAttribute('aria-valuetext', text);
      this.eventBus.emit('crowd:param-changed', { journeys });
    });
  },

  /**
   * Give the primary emitter a new persisted pattern seed. Randomness happens
   * only at this authoring action; playback remains a pure seeded evaluation.
   * @returns {number|null} New seed, or null when no editable emitter exists
   */
  _rerollCrowdPattern() {
    const layer = this.selectedCrowd;
    const emitter = layer?.emitters[0];
    if (!layer || !emitter) return null;

    this._flushPendingUndo?.();
    const seed = emitter.reseed();
    this.syncCrowdEditor();
    this.saveUndoState();
    this.autoSave();
    this.queueRender();
    this.eventBus.emit('scene:semantic-changed', {
      kind: 'crowd-pattern-seed',
      layerId: layer.id,
      emitterId: emitter.id,
    });
    this.announce(`${layer.name || 'Crowd'} pattern re-rolled. Undo is available.`);
    return seed;
  },

  /**
   * Add one handle at the midpoint of the widest span, preserving the current
   * curve at that point so adding alone does not change playback.
   * @private
   */
  _addCrowdBusynessHandle() {
    const emitter = this.selectedCrowd?.emitters[0];
    if (!emitter || emitter.busynessEnvelope.length >= MAX_BUSYNESS_HANDLES) return;
    const next = emitter.busynessEnvelope.map(handle => ({ ...handle }));
    let widestIndex = 0;
    for (let index = 1; index < next.length - 1; index++) {
      if (next[index + 1].time - next[index].time >
          next[widestIndex + 1].time - next[widestIndex].time) widestIndex = index;
    }
    const left = next[widestIndex];
    const right = next[widestIndex + 1];
    const time = Math.round(((left.time + right.time) / 2) * 100) / 100;
    next.splice(widestIndex + 1, 0, {
      time,
      value: busynessAt(next, time),
      transition: left.transition,
    });
    this._commitCrowdBusynessEnvelope(next, `Busyness handle added at ${Math.round(time * 100)}%.`);
  },

  /** @private */
  _changeCrowdBusynessControl(control) {
    const emitter = this.selectedCrowd?.emitters[0];
    const index = Number(control?.dataset?.busynessIndex);
    const field = control?.dataset?.busynessField;
    if (!emitter || !Number.isInteger(index) || !field || !emitter.busynessEnvelope[index]) return;
    // The rows are rebuilt by the change, taking the focused field with
    // them: focus returns to the same field of the same handle (UI-06 B-28).
    const hadFocus = document.activeElement === control;

    const next = emitter.busynessEnvelope.map(handle => ({ ...handle }));
    if (field === 'time' && index > 0 && index < next.length - 1) {
      const lower = next[index - 1].time + 0.01;
      const upper = next[index + 1].time - 0.01;
      next[index].time = Math.max(lower, Math.min(upper, Number(control.value) / 100));
    } else if (field === 'value') {
      next[index].value = Math.max(0, Math.min(1, Number(control.value) / 100));
    } else if (field === 'transition' && index < next.length - 1) {
      next[index].transition = control.value === 'step' ? 'step' : 'gradual';
    } else if (field === 'remove' && index > 0 && index < next.length - 1) {
      next.splice(index, 1);
    } else {
      return;
    }
    this._commitCrowdBusynessEnvelope(next, 'Busyness pattern updated.');
    if (hadFocus) this._focusCrowdBusynessControl(index, field);
  },

  /**
   * Focus the rebuilt field for a handle: the same field, or, for a handle
   * just removed, the handle now at its index — its Remove, or, for the last
   * handle, which has none, its Busy field.
   * @param {number} index - Handle index
   * @param {string} field - `data-busyness-field`
   * @private
   */
  _focusCrowdBusynessControl(index, field) {
    const controls = document.getElementById('crowd-busyness-handles');
    if (!controls) return;
    const at = (i, name) => controls.querySelector(`[data-busyness-index="${i}"][data-busyness-field="${name}"]`);
    const last = controls.querySelectorAll('.crowd-busyness-handle-row').length - 1;
    const target = at(index, field) ?? at(Math.min(index, last), 'value');
    target?.focus();
  },

  /**
   * Commit one accessible/discrete envelope edit as one undoable transaction.
   * @private
   */
  _commitCrowdBusynessEnvelope(next, announcement) {
    const layer = this.selectedCrowd;
    const emitter = layer?.emitters[0];
    if (!layer || !emitter || compileBusynessEnvelope(next).totalArea <= 0) {
      this.announce?.('Keep at least one busyness span above 0%.');
      this.syncCrowdEditor();
      return false;
    }
    const normalized = normalizeBusynessEnvelope(next);
    if (JSON.stringify(normalized) === JSON.stringify(emitter.busynessEnvelope)) return false;

    this._flushPendingUndo?.();
    emitter.update({ busynessEnvelope: normalized });
    this.syncCrowdEditor();
    this.saveUndoState();
    this.autoSave();
    this.queueRender();
    this.eventBus.emit('scene:semantic-changed', {
      kind: 'crowd-busyness-envelope', layerId: layer.id, emitterId: emitter.id,
    });
    if (announcement) this.announce?.(`${announcement} Undo is available.`);
    return true;
  },

  /** @private */
  _startCrowdBusynessDrag(event) {
    const target = event.target?.closest?.('[data-busyness-handle]');
    const emitter = this.selectedCrowd?.emitters[0];
    if (!target || !emitter) return;
    event.preventDefault();
    this._flushPendingUndo?.();
    this._crowdBusynessDrag = {
      pointerId: event.pointerId,
      index: Number(target.dataset.busynessHandle),
      original: emitter.busynessEnvelope.map(handle => ({ ...handle })),
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  },

  /** @private */
  _moveCrowdBusynessDrag(event) {
    const drag = this._crowdBusynessDrag;
    const emitter = this.selectedCrowd?.emitters[0];
    if (!drag || drag.pointerId !== event.pointerId || !emitter) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const { width, height, padX, padY } = BUSYNESS_GRAPH;
    const x = (event.clientX - rect.left) / rect.width * width;
    const y = (event.clientY - rect.top) / rect.height * height;
    const next = emitter.busynessEnvelope.map(handle => ({ ...handle }));
    const handle = next[drag.index];
    if (!handle) return;

    handle.value = Math.max(0, Math.min(1, (height - padY - y) / (height - 2 * padY)));
    if (drag.index > 0 && drag.index < next.length - 1) {
      const candidate = (x - padX) / (width - 2 * padX);
      handle.time = Math.max(
        next[drag.index - 1].time + 0.01,
        Math.min(next[drag.index + 1].time - 0.01, candidate)
      );
    }
    if (compileBusynessEnvelope(next).totalArea <= 0) return;
    emitter.update({ busynessEnvelope: next });
    drag.moved = true;
    this._syncCrowdBusynessEditor(emitter);
    this.queueRender();
  },

  /** @private */
  _finishCrowdBusynessDrag(event, commit) {
    const drag = this._crowdBusynessDrag;
    const layer = this.selectedCrowd;
    const emitter = layer?.emitters[0];
    if (!drag || drag.pointerId !== event.pointerId || !emitter) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    this._crowdBusynessDrag = null;
    if (!commit) {
      emitter.update({ busynessEnvelope: drag.original });
      this.syncCrowdEditor();
      this.queueRender();
      return;
    }
    if (!drag.moved) return;
    this.saveUndoState();
    this.autoSave();
    this.queueRender();
    this.eventBus.emit('scene:semantic-changed', {
      kind: 'crowd-busyness-envelope', layerId: layer.id, emitterId: emitter.id,
    });
    this.announce?.('Busyness handle moved. Undo is available.');
  },

  /**
   * Render the layers strip: the Route row plus one row per crowd, and
   * the Add crowd button state. Crowds render beneath the route, listed
   * here in scene order.
   */
  updateLayersStrip() {
    const strip = this._layersStripEl;
    if (!strip) return;

    strip.innerHTML = '';
    // Rows contain independent select, visibility, and delete buttons, so
    // native list semantics are more accurate than a partial ARIA listbox.
    strip.removeAttribute('role');
    strip.setAttribute('aria-label', 'Layers');
    strip.removeAttribute('aria-multiselectable');

    // Route row — the hero layer; selected whenever no crowd is
    const routeItem = document.createElement('li');
    routeItem.className = 'layer-item';
    const routeRow = document.createElement('button');
    routeRow.type = 'button';
    routeRow.className = 'layer-row';
    const routeSelected = !this.selectedCrowd;
    routeRow.setAttribute('aria-pressed', routeSelected ? 'true' : 'false');
    if (routeSelected) routeItem.classList.add('selected');

    const routeSwatch = document.createElement('span');
    routeSwatch.className = 'layer-swatch layer-swatch-route';
    // Use the colour-only property: imported project strings must never turn
    // a decorative swatch into a CSS image/network request.
    routeSwatch.style.backgroundColor = this.styles?.pathColor || '#D55E00';
    const routeTitle = document.createElement('span');
    routeTitle.className = 'layer-title';
    routeTitle.textContent = 'Route';
    routeRow.appendChild(routeSwatch);
    routeRow.appendChild(routeTitle);
    routeRow.addEventListener('click', () => {
      if (this.selectedCrowd) {
        this.selectedCrowd = null;
        this.eventBus.emit('crowd:deselected');
      }
    });
    routeItem.appendChild(routeRow);
    strip.appendChild(routeItem);

    // Crowd rows
    for (const layer of this.scene.getFlowLayers()) {
      strip.appendChild(this._buildCrowdRow(layer));
    }

    // A route is optional: without one, Add crowd starts network authoring.
    if (this._addCrowdBtn) {
      const noRoute = this.waypoints.length < 2;
      this._addCrowdBtn.disabled = false;
      // Its hint, not a title: a title is help only a pointer can reach (UI-06 B-07).
      this._addCrowdBtn.setAttribute('data-tip', noRoute
        ? 'Add a crowd and draw the network it follows'
        : 'Add a crowd of dots that follows the route');
    }
  },

  /**
   * Build one crowd row: select button (swatch + name), visibility eye,
   * delete. Double-click the name, or press F2 on the row, to rename inline.
   * @param {FlowLayer} layer
   * @returns {HTMLLIElement}
   * @private
   */
  _buildCrowdRow(layer) {
    const item = document.createElement('li');
    item.className = 'layer-item';
    if (!layer.visible) item.classList.add('layer-hidden');

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'layer-row';
    const selected = this.selectedCrowd === layer;
    row.setAttribute('aria-pressed', selected ? 'true' : 'false');
    if (selected) item.classList.add('selected');

    const swatch = document.createElement('span');
    swatch.className = 'layer-swatch';
    swatch.style.backgroundColor = layer.emitters[0]?.dotColor || NEW_CROWD_DOT_COLOR;

    const title = document.createElement('span');
    title.className = 'layer-title';
    title.textContent = layer.name;
    // The row's own hint: shown on hover, on keyboard focus, and read as its description.
    row.setAttribute('data-tip', 'Double-click or press F2 to rename');

    row.appendChild(swatch);
    row.appendChild(title);
    if (!layer.visible) row.insertAdjacentHTML('beforeend', '<span class="layer-hidden-tag">hidden</span>');
    row.addEventListener('click', () => {
      if (this.selectedCrowd !== layer) {
        this.eventBus.emit('crowd:selected', layer);
      }
    });
    row.addEventListener('dblclick', () => this._startCrowdRename(layer, title));
    // F2 renames too, as a waypoint row's does (UI-06 J-13): the row is
    // selected first, as a double-click's first click selects it.
    row.addEventListener('keydown', (e) => {
      if (e.key !== 'F2') return;
      e.preventDefault();
      this.renameCrowd(layer);
    });

    const visBtn = document.createElement('button');
    visBtn.type = 'button';
    visBtn.className = 'layer-visibility';
    visBtn.setAttribute('aria-pressed', layer.visible ? 'true' : 'false');
    visBtn.setAttribute('aria-label', layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`);
    visBtn.title = layer.visible ? 'Hide crowd' : 'Show crowd';
    visBtn.innerHTML = layer.visible
      ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="2"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" opacity="0.35"/><path d="M2 14L14 2"/></svg>';
    visBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      layer.visible = !layer.visible;
      this.saveUndoState();
      this.autoSave();
      this.updateLayersStrip();
      this.queueRender();
      this.eventBus.emit('scene:semantic-changed', { kind: 'crowd-visibility', layerId: layer.id });
      this.announce(layer.visible ? `${layer.name} shown` : `${layer.name} hidden`);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'layer-delete';
    delBtn.setAttribute('aria-label', `Delete ${layer.name}`);
    delBtn.title = 'Delete crowd';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteCrowd(layer);
    });

    item.appendChild(row);
    item.appendChild(visBtn);
    item.appendChild(delBtn);
    return item;
  },

  /**
   * Select a crowd and open its row's rename field (F2 on the row, UI-06
   * J-13). Selecting rebuilds the strip, so the field opens on the row the
   * rebuild made for the layer: the rows follow the scene's order, after
   * the Route row.
   * @param {FlowLayer} layer
   */
  renameCrowd(layer) {
    if (this.selectedCrowd !== layer) this.eventBus.emit('crowd:selected', layer);
    const title = this._crowdRowOf(layer)?.querySelector('.layer-title');
    if (title) this._startCrowdRename(layer, title);
  },

  /**
   * A crowd's row in the strip as last built: the rows follow the scene's
   * order, after the Route row.
   * @param {FlowLayer} layer
   * @returns {HTMLButtonElement|null}
   * @private
   */
  _crowdRowOf(layer) {
    const index = this.scene.getFlowLayers().indexOf(layer);
    if (index < 0) return null; // not in the scene: no row, not the Route row
    return this._layersStripEl?.children[index + 1]?.querySelector('.layer-row') ?? null;
  },

  /**
   * Inline-rename a crowd row: swap the title span for an input.
   * Enter/blur commits, Escape cancels; Enter and Escape give focus back to
   * the row. Renames are undoable.
   * @param {FlowLayer} layer
   * @param {HTMLElement} titleEl
   * @private
   */
  _startCrowdRename(layer, titleEl) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'layer-rename-input';
    input.value = layer.name;
    input.setAttribute('aria-label', 'Crowd name');
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    // The strip is rebuilt when the field closes, taking the field with it.
    // Closed from the keyboard, focus goes back to the row it came from; a
    // blur is the user going somewhere else, and that is left alone.
    const finish = (fromKeyboard) => {
      this.updateLayersStrip();
      if (fromKeyboard) this._crowdRowOf(layer)?.focus();
    };
    const commit = (fromKeyboard = false) => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (name && name !== layer.name) {
        layer.name = name;
        this.saveUndoState();
        this.autoSave();
        this.eventBus.emit('scene:semantic-changed', { kind: 'crowd-name', layerId: layer.id });
        // Re-announce the selection so the scope chip picks up the new
        // name (renames fire no crowd event of their own)
        if (this.selectedCrowd === layer) {
          this.eventBus.emit('crowd:selected', layer);
        }
      }
      finish(fromKeyboard);
    };
    const cancel = (fromKeyboard = false) => {
      if (done) return;
      done = true;
      finish(fromKeyboard);
    };

    input.addEventListener('blur', () => commit(false));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Keep global shortcuts out of the rename
      if (e.key === 'Enter') { e.preventDefault(); commit(true); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(true); }
    });
  },

  /**
   * Create and select a crowd with one dot stream. An existing route is
   * the guide; otherwise the crowd starts with an empty custom network and
   * the ordinary network event hands authoring to network edit mode.
   */
  addCrowd({ enterNetworkEditor = true } = {}) {
    const hasRoute = this.waypoints.length >= 2;
    const layer = this.scene.addFlowLayer({
      name: this._nextCrowdName(),
      guideType: hasRoute ? 'route' : 'graph',
      emitters: [{
        dotColor: NEW_CROWD_DOT_COLOR,
        speed: NEW_CROWD_SPEED,
        releaseDuration: NEW_CROWD_RELEASE_DURATION,
      }],
    });
    this.saveUndoState();
    this.autoSave();
    this.eventBus.emit('scene:semantic-changed', { kind: 'crowd-added', layerId: layer.id });
    this.eventBus.emit('crowd:selected', layer);
    this.queueRender();
    this.announce(hasRoute
      ? `${layer.name} added — dots follow the route`
      : `${layer.name} added — draw the network its dots will follow`);
    if (!hasRoute && enterNetworkEditor) {
      // crowd:selected must land first so the network mixin edits this layer.
      this.eventBus.emit('network:guide-changed', layer);
    }
  },

  /**
   * Trace the hero route into the selected crowd's guide network (COMPOSE-03).
   *
   * A copy, not a view: the traced network is the author's to reshape, and
   * nothing they do to it moves the route. Each traced node keeps a one-way
   * binding to the waypoint it came from, so moving that waypoint carries the
   * node with it rather than stranding the copy.
   *
   * @param {FlowLayer} [layer=this.selectedCrowd]
   * @returns {boolean} True when the network was replaced
   */
  traceRouteIntoCrowd(layer = this.selectedCrowd) {
    if (!layer) {
      this.eventBus.emit('ui:toast', { message: 'Select a crowd to trace the route into' });
      return false;
    }

    const trace = traceRouteIntoGraph(this.waypoints);
    if (trace.problems.length > 0) {
      this.eventBus.emit('ui:toast', { message: trace.problems[0].detail });
      return false;
    }
    const unstorable = traceStorageProblem(this, layer, trace);
    if (unstorable) {
      this.eventBus.emit('ui:toast', { message: unstorable });
      return false;
    }

    // Put the pen down first: the trace replaces every node, and a half-drawn
    // edge would be left pointing at one that no longer exists.
    if (this.networkEditService?.active) this.networkEditService.exit();

    const applied = applyTraceToLayer(layer, trace);
    // Anchored nodes need their positions resolved before anything renders.
    this.calculatePath();
    this.saveUndoState();
    this.autoSave();
    this.updateLayersStrip();
    this.queueRender();
    this.eventBus.emit('scene:semantic-changed', { kind: 'crowd-network-traced', layerId: layer.id });

    // The toast is the announcement (UI-06 J-05): one message, heard once.
    const message = `Traced the route into ${layer.name} — ${applied.nodes} nodes, ${applied.edges} paths`;
    this.eventBus.emit('ui:toast', { message });
    return true;
  },

  /**
   * Delete a crowd. Instant, with an undo toast (same contract as
   * shift-click waypoint delete).
   * @param {FlowLayer} layer
   */
  deleteCrowd(layer) {
    const wasSelected = this.selectedCrowd === layer;
    if (!this.scene.removeFlowLayer(layer.id)) return;
    if (wasSelected) {
      this.selectedCrowd = null;
      this.eventBus.emit('crowd:deselected');
    }
    this.saveUndoState();
    this.autoSave();
    this.updateLayersStrip();
    this.queueRender();
    this.eventBus.emit('scene:semantic-changed', { kind: 'crowd-deleted', layerId: layer.id });
    this.eventBus.emit('ui:toast', {
      message: `Deleted ${layer.name} — press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`
    });
  },

  /**
   * Push the selected crowd's params into the Crowd scope controls.
   * Called on selection and after restores; safe with no selection.
   */
  syncCrowdEditor() {
    const layer = this.selectedCrowd;
    if (!layer) return;
    const em = layer.emitters[0];

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
      const control = id.endsWith('-value')
        ? document.getElementById(id.slice(0, -'-value'.length))
        : null;
      control?.setAttribute('aria-valuetext', text);
    };

    set('crowd-guide-type', layer.guideType);
    this.updateGuideCard?.(); // Network mixin's Edit-network button + hint
    this._syncCrowdLifecycleHint(); // Before the emitter guard: no dots, no hint
    this._syncCrowdEmptyState(Boolean(em)); // The cards say why they are off (UI-06 B-31)
    if (!em) return;

    set('crowd-dot-color', em.dotColor);
    refreshSwatchPicker('#crowd-dot-color'); // Sync the swatch grid's radios
    set('crowd-dot-size', Math.round(em.dotSize * 100));
    setText('crowd-dot-size-value', formatCrowdDotSize(em.dotSize));
    set('crowd-wobble', Math.round(em.wobble * 100));
    setText('crowd-wobble-value', `${Math.round(em.wobble * 100)}%`);
    set('crowd-count', em.dotCount);
    setText('crowd-count-value', `${em.dotCount}`);
    set('crowd-release-start', Math.round(em.releaseStart * 100));
    setText('crowd-release-start-value', `${Math.round(em.releaseStart * 100)}%`);
    set('crowd-release-duration', Math.round(em.releaseDuration * 100));
    setText('crowd-release-duration-value', `${Math.round(em.releaseDuration * 100)}%`);
    set('crowd-onset-variance', Math.round(em.onsetVariance * 100));
    setText(
      'crowd-onset-variance-value',
      formatCrowdReleaseTiming(em.onsetVariance * 100)
    );
    set('crowd-intensity-ramp', Math.round(em.intensityRamp * 100));
    setText(
      'crowd-intensity-ramp-value',
      formatCrowdReleaseBias(em.intensityRamp * 100)
    );
    set('crowd-speed', Math.round(em.speed * 100));
    setText('crowd-speed-value', `${em.speed.toFixed(2)} image lengths/s`);
    set('crowd-speed-variance', Math.round(em.speedVariance * 100));
    setText('crowd-speed-variance-value', `${Math.round(em.speedVariance * 100)}%`);
    set('crowd-lifecycle', em.lifecycleMode);
    setText('crowd-seed-value', String(em.seed));
    this._syncCrowdBusynessEditor(em);

    const hint = document.getElementById('crowd-pattern-hint');
    if (hint) {
      hint.textContent = layer.guideType === 'graph'
        ? 'Path shares set the route proportions. Re-roll changes which dots take each path, plus individual walking and set-off variation.'
        : 'Re-roll changes individual walking and set-off variation. Custom networks also re-roll which dots take each path.';
    }

    // Chip text follows crowd selection/name via the UIController's own
    // crowd listeners; nothing to do here beyond the controls.
  },

  /**
   * A crowd with no emitter has nothing for the Dots, Release and Motion
   * cards to edit (UI-06 B-31): they are disabled under a line that says so,
   * which their headers are described by, and the previous crowd's values are
   * cleared from the parts that are built, not set. Their hints' "?" triggers
   * stay enabled, so what each control does can still be read (Codex r3), as
   * a disabled control keeps its help (ParamTooltip.js). A crowd with an
   * emitter has them back; the busyness editor then sets its own buttons'
   * state.
   * @param {boolean} hasEmitter
   * @private
   */
  _syncCrowdEmptyState(hasEmitter) {
    const line = document.getElementById('crowd-no-emitter');
    if (line) line.hidden = hasEmitter;
    const scope = document.getElementById('crowd-scope');
    for (const name of ['dots', 'release', 'motion']) {
      const section = scope?.querySelector(`.settings-section[data-section="${name}"]`);
      if (!section) continue;
      const header = section.querySelector('.section-header');
      if (hasEmitter) header?.removeAttribute('aria-describedby');
      else header?.setAttribute('aria-describedby', 'crowd-no-emitter');
      for (const control of section.querySelectorAll('.section-content input, .section-content select, .section-content button:not(.param-hint-trigger)')) {
        control.disabled = !hasEmitter;
      }
      // The swatches' own fieldset too, so they look it (the lead's pane
      // finding, round 2): .swatch-fieldset:disabled is what greys them.
      for (const fieldset of section.querySelectorAll('.section-content .swatch-fieldset')) {
        fieldset.disabled = !hasEmitter;
      }
    }
    if (hasEmitter) return;
    document.getElementById('crowd-busyness-graph')?.replaceChildren();
    document.getElementById('crowd-busyness-handles')?.replaceChildren();
  },

  /**
   * Show the hint under "At journey end" only where no dot of the selected
   * crowd can reach a journey end, when the setting has nothing to act on
   * (DEF-77): no end lies on a path from an entry its dots are released at.
   * The end waits for every journey that ends (CROWD-05), so a slow crowd is
   * no longer cut off and its pace never shows it; nor does a crowd with no
   * dots, nor a walk that only runs out of hops. Read from the network
   * alone, without scheduling a dot, on each edit that can change it, never
   * per frame. The select is described by the hint, so it is emptied as well
   * as hidden: a description is read even from a hidden element.
   * @private
   */
  _syncCrowdLifecycleHint() {
    const hint = document.getElementById('crowd-lifecycle-hint');
    if (!hint) return;
    const layer = this.selectedCrowd;
    // null: no network to release dots onto
    const endless = layer?.emitters.length > 0 && this.swarmEngine?.hasJourneyEnd(layer) === false;
    const message = endless ? LIFECYCLE_ENDLESS_HINT : '';
    hint.hidden = !message;
    hint.textContent = message;
  },

  /**
   * Redraw the busyness graph and its equivalent exact controls from model
   * state. Rebuilding from authored data also keeps undo/project restores
   * from leaving stale control rows behind.
   * @private
   */
  _syncCrowdBusynessEditor(emitter) {
    const graph = document.getElementById('crowd-busyness-graph');
    const controls = document.getElementById('crowd-busyness-handles');
    if (!graph || !controls) return;
    const handles = emitter.busynessEnvelope;
    const { width, height, padX, padY } = BUSYNESS_GRAPH;
    const x = time => padX + time * (width - 2 * padX);
    const y = value => height - padY - value * (height - 2 * padY);

    graph.replaceChildren();
    const baseline = document.createElementNS(SVG_NS, 'path');
    baseline.setAttribute('class', 'crowd-busyness-axis');
    baseline.setAttribute('d', `M ${padX} ${height - padY} H ${width - padX} M ${padX} ${padY} V ${height - padY}`);
    graph.appendChild(baseline);

    const pieces = [`M ${x(handles[0].time)} ${y(handles[0].value)}`];
    for (let index = 0; index < handles.length - 1; index++) {
      const current = handles[index];
      const next = handles[index + 1];
      if (current.transition === 'step') pieces.push(`H ${x(next.time)} V ${y(next.value)}`);
      else pieces.push(`L ${x(next.time)} ${y(next.value)}`);
    }
    const curve = document.createElementNS(SVG_NS, 'path');
    curve.setAttribute('class', 'crowd-busyness-line');
    curve.setAttribute('d', pieces.join(' '));
    graph.appendChild(curve);

    handles.forEach((handle, index) => {
      const target = document.createElementNS(SVG_NS, 'circle');
      target.setAttribute('class', 'crowd-busyness-handle-target');
      target.setAttribute('cx', String(x(handle.time)));
      target.setAttribute('cy', String(y(handle.value)));
      target.setAttribute('r', '22');
      target.setAttribute('data-busyness-handle', String(index));
      target.setAttribute('aria-hidden', 'true');
      graph.appendChild(target);
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('class', 'crowd-busyness-handle');
      circle.setAttribute('cx', String(x(handle.time)));
      circle.setAttribute('cy', String(y(handle.value)));
      circle.setAttribute('r', '8');
      circle.setAttribute('aria-hidden', 'true');
      graph.appendChild(circle);
    });

    const description = handles.length === 2 && handles.every(handle => handle.value === 1)
      ? 'Even busyness across the release window'
      : `${handles.length} busyness handles across the release window`;
    graph.setAttribute('aria-label', description);
    const summary = document.getElementById('crowd-busyness-summary');
    if (summary) summary.textContent = description.startsWith('Even') ? 'Even' : `${handles.length} handles`;

    controls.replaceChildren();
    handles.forEach((handle, index) => {
      const row = document.createElement('div');
      row.className = 'crowd-busyness-handle-row';
      const title = document.createElement('span');
      title.className = 'crowd-busyness-handle-title';
      title.textContent = `Handle ${index + 1}`;
      row.appendChild(title);
      row.appendChild(this._crowdBusynessNumberControl('Time', index, 'time', handle.time * 100, {
        readOnly: index === 0 || index === handles.length - 1,
      }));
      row.appendChild(this._crowdBusynessNumberControl('Busy', index, 'value', handle.value * 100));

      if (index < handles.length - 1) {
        const label = document.createElement('label');
        label.appendChild(busynessLabelText('Change', BUSYNESS_HINTS.transition));
        const select = document.createElement('select');
        select.dataset.busynessIndex = String(index);
        select.dataset.busynessField = 'transition';
        for (const [value, text] of [['gradual', 'Gradual'], ['step', 'Sudden']]) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = text;
          option.selected = handle.transition === value;
          select.appendChild(option);
        }
        label.appendChild(select);
        row.appendChild(label);
      }
      if (index > 0 && index < handles.length - 1) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-ghost crowd-busyness-remove';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove busyness handle ${index + 1}`);
        remove.dataset.busynessIndex = String(index);
        remove.dataset.busynessField = 'remove';
        remove.addEventListener('click', event => this._changeCrowdBusynessControl(event.currentTarget));
        row.appendChild(remove);
      }
      controls.appendChild(row);
    });

    const add = document.getElementById('crowd-busyness-add');
    const addReason = document.getElementById('crowd-busyness-add-reason');
    if (add) {
      add.disabled = handles.length >= MAX_BUSYNESS_HANDLES;
      // Disabled, it cannot be focused, so its hint cannot be reached: the
      // reason is a line under the row that it is described by (UI-06 B-07).
      if (addReason) {
        addReason.textContent = add.disabled ? `Maximum ${MAX_BUSYNESS_HANDLES} handles.` : '';
        addReason.hidden = !add.disabled;
      }
    }
    const reset = document.getElementById('crowd-busyness-reset');
    if (reset) {
      reset.disabled = JSON.stringify(handles) === JSON.stringify(defaultBusynessEnvelope());
    }
  },

  /** @private */
  _crowdBusynessNumberControl(labelText, index, field, value, { readOnly = false } = {}) {
    const label = document.createElement('label');
    label.appendChild(busynessLabelText(labelText, BUSYNESS_HINTS[field]));
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.step = '0.1';
    input.value = String(Math.round(value * 10) / 10);
    input.readOnly = readOnly;
    input.inputMode = 'decimal';
    input.dataset.busynessIndex = String(index);
    input.dataset.busynessField = field;
    input.setAttribute('aria-label', `${labelText} for busyness handle ${index + 1}, percent`);
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || input.readOnly) return;
      event.preventDefault();
      this._changeCrowdBusynessControl(input);
    });
    const unit = document.createElement('span');
    unit.textContent = '%';
    label.appendChild(input);
    label.appendChild(unit);
    return label;
  },

  /**
   * After a restore (undo/redo, project load) rebuilt the scene, the
   * selected crowd reference is stale. Re-resolve it by id; deselect if
   * the layer no longer exists.
   */
  resolveCrowdSelectionAfterRestore() {
    if (!this.selectedCrowd) {
      this.updateLayersStrip();
      return;
    }
    const fresh = this.scene.getFlowLayer(this.selectedCrowd.id);
    if (fresh) {
      this.selectedCrowd = fresh;
      this.updateLayersStrip();
      this.syncCrowdEditor();
    } else {
      this.selectedCrowd = null;
      this.eventBus.emit('crowd:deselected');
    }
  },

  /**
   * First unused "Crowd N" name.
   * @returns {string}
   * @private
   */
  _nextCrowdName() {
    const names = new Set(this.scene.getFlowLayers().map(l => l.name));
    let n = 1;
    while (names.has(`Crowd ${n}`)) n++;
    return `Crowd ${n}`;
  }
};
