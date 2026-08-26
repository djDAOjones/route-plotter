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

/** Okabe-Ito sky blue — visually distinct from the vermillion route default. */
const NEW_CROWD_DOT_COLOR = '#56B4E9';

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

    // Central crowd param pipeline (mirrors waypoint:path-property-changed)
    this.eventBus.on('crowd:param-changed', () => {
      this.saveUndoStateDebounced();
      this.autoSave();
      this.queueRender();
    });

    // The Add-crowd gate follows route existence (crowds need a route
    // to follow until network editing ships)
    this.eventBus.on('waypoint:list-updated', () => this.updateLayersStrip());

    // ── Card controls (single-writer: this is the only wiring) ──
    const emitterOf = () => this.selectedCrowd?.emitters[0];

    document.getElementById('crowd-guide-type')?.addEventListener('change', (e) => {
      if (!this.selectedCrowd) return;
      this.selectedCrowd.setGuideType(e.target.value);
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
      this.eventBus.emit('crowd:param-changed');
    });

    this._wireCrowdSlider('crowd-dot-size', (raw) => {
      emitterOf()?.update({ dotSize: raw / 100 });
      return `${(raw / 100).toFixed(2)}×`;
    });

    this._wireCrowdSlider('crowd-wobble', (raw) => {
      emitterOf()?.update({ wobble: raw / 100 });
      return `${Math.round(raw)}%`;
    });

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

    this._wireCrowdSlider('crowd-speed', (raw) => {
      emitterOf()?.update({ speed: raw / 100 });
      return `${(raw / 100).toFixed(2)} img/s`;
    });

    this._wireCrowdSlider('crowd-speed-variance', (raw) => {
      emitterOf()?.update({ speedVariance: raw / 100 });
      return `${Math.round(raw)}%`;
    });

    document.getElementById('crowd-lifecycle')?.addEventListener('change', (e) => {
      const em = emitterOf();
      if (!em) return;
      em.update({ lifecycleMode: e.target.value });
      this.eventBus.emit('crowd:param-changed');
    });
  },

  /**
   * Wire one crowd slider: write-through on input (guarded on a crowd
   * being selected), value readout, param-changed pipeline.
   * @param {string} id - Element id; `${id}-value` is the readout span
   * @param {Function} apply - raw slider number → readout string (writes the model)
   * @private
   */
  _wireCrowdSlider(id, apply) {
    const el = document.getElementById(id);
    const valueEl = document.getElementById(`${id}-value`);
    el?.addEventListener('input', (e) => {
      if (!this.selectedCrowd?.emitters[0]) return;
      const text = apply(parseFloat(e.target.value));
      if (valueEl) valueEl.textContent = text;
      this.eventBus.emit('crowd:param-changed');
    });
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

    // Add crowd needs a route for dots to follow (route guide is the
    // only guide until network editing ships)
    if (this._addCrowdBtn) {
      const noRoute = this.waypoints.length < 2;
      this._addCrowdBtn.disabled = noRoute;
      this._addCrowdBtn.title = noRoute
        ? 'Crowds follow the route — draw a route first'
        : 'Add a crowd of dots that follows the route';
    }
  },

  /**
   * Build one crowd row: select button (swatch + name), visibility eye,
   * delete. Double-click the name to rename inline.
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
    title.title = 'Double-click to rename';

    row.appendChild(swatch);
    row.appendChild(title);
    row.addEventListener('click', () => {
      if (this.selectedCrowd !== layer) {
        this.eventBus.emit('crowd:selected', layer);
      }
    });
    row.addEventListener('dblclick', () => this._startCrowdRename(layer, title));

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
   * Inline-rename a crowd row: swap the title span for an input.
   * Enter/blur commits, Escape cancels. Renames are undoable.
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
    const commit = () => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (name && name !== layer.name) {
        layer.name = name;
        this.saveUndoState();
        this.autoSave();
        // Re-announce the selection so the scope chip picks up the new
        // name (renames fire no crowd event of their own)
        if (this.selectedCrowd === layer) {
          this.eventBus.emit('crowd:selected', layer);
        }
      }
      this.updateLayersStrip();
    };
    const cancel = () => {
      if (done) return;
      done = true;
      this.updateLayersStrip();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Keep global shortcuts out of the rename
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
  },

  /**
   * Create a crowd that follows the route, with one dot stream, and
   * select it. Dots are flowing as soon as the timeline moves — no
   * graph UI involved.
   */
  addCrowd() {
    if (this.waypoints.length < 2) {
      this.announce('Crowds follow the route — draw a route first');
      return;
    }
    const layer = this.scene.addFlowLayer({
      name: this._nextCrowdName(),
      guideType: 'route',
      emitters: [{ dotColor: NEW_CROWD_DOT_COLOR }],
    });
    this.saveUndoState();
    this.autoSave();
    this.eventBus.emit('crowd:selected', layer);
    this.queueRender();
    this.announce(`${layer.name} added — dots follow the route`);
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
    };

    set('crowd-guide-type', layer.guideType);
    this.updateGuideCard?.(); // Network mixin's Edit-network button + hint
    if (!em) return;

    set('crowd-dot-color', em.dotColor);
    refreshSwatchPicker('#crowd-dot-color'); // Sync the swatch grid's radios
    set('crowd-dot-size', Math.round(em.dotSize * 100));
    setText('crowd-dot-size-value', `${em.dotSize.toFixed(2)}×`);
    set('crowd-wobble', Math.round(em.wobble * 100));
    setText('crowd-wobble-value', `${Math.round(em.wobble * 100)}%`);
    set('crowd-count', em.dotCount);
    setText('crowd-count-value', `${em.dotCount}`);
    set('crowd-release-start', Math.round(em.releaseStart * 100));
    setText('crowd-release-start-value', `${Math.round(em.releaseStart * 100)}%`);
    set('crowd-release-duration', Math.round(em.releaseDuration * 100));
    setText('crowd-release-duration-value', `${Math.round(em.releaseDuration * 100)}%`);
    set('crowd-speed', Math.round(em.speed * 100));
    setText('crowd-speed-value', `${em.speed.toFixed(2)} img/s`);
    set('crowd-speed-variance', Math.round(em.speedVariance * 100));
    setText('crowd-speed-variance-value', `${Math.round(em.speedVariance * 100)}%`);
    set('crowd-lifecycle', em.lifecycleMode);

    // Chip text follows crowd selection/name via the UIController's own
    // crowd listeners; nothing to do here beyond the controls.
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
