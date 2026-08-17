/**
 * Undo/redo: snapshot shape, debounced saves, restore, and post-restore global-style UI sync.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, undoRedoMixin).
 */
import { Waypoint } from '../models/Waypoint.js';
import { refreshSwatchPicker } from '../components/SwatchPicker.js';

export const undoRedoMixin = {
  
  // ========== UNDO/REDO METHODS ==========
  
  /**
   * Get current undoable state snapshot.
   * Includes waypoints (with all per-waypoint properties) and global styles.
   * @returns {Object} State object for undo history
   * @private
   */
  _getUndoableState() {
    // Serialize global styles without non-serializable Image objects
    const stylesCopy = { ...this.styles };
    if (stylesCopy.pathHead) {
      stylesCopy.pathHead = { ...stylesCopy.pathHead, image: null };
    }
    return {
      waypoints: this.waypoints.map(wp => wp.toJSON()),
      selectedWaypointId: this.selectedWaypoint?.id || null,
      styles: stylesCopy
    };
  },
  
  /**
   * Save current state to undo history immediately.
   * Use for discrete, non-repeating actions (add/delete waypoint).
   */
  saveUndoState() {
    // Cancel any pending debounced save to avoid duplicates
    if (this._undoDebounceTimer) {
      clearTimeout(this._undoDebounceTimer);
      this._undoDebounceTimer = null;
    }
    this.undoService.saveState(this._getUndoableState());
  },
  
  /**
   * Save current state to undo history after a debounce delay.
   * Groups rapid-fire changes (slider drags, arrow key holds) into a single
   * undo entry. The 400ms window naturally collapses continuous interactions.
   * Discrete changes (dropdown, checkbox) also use this — the brief delay
   * is imperceptible to users.
   */
  saveUndoStateDebounced() {
    if (this._undoDebounceTimer) {
      clearTimeout(this._undoDebounceTimer);
    }
    this._undoDebounceTimer = setTimeout(() => {
      this._undoDebounceTimer = null;
      this.undoService.saveState(this._getUndoableState());
    }, 400);
  },
  
  /**
   * Flush any pending debounced undo save immediately.
   * Called before undo/redo to ensure the current state is captured.
   * @private
   */
  _flushPendingUndo() {
    if (this._undoDebounceTimer) {
      clearTimeout(this._undoDebounceTimer);
      this._undoDebounceTimer = null;
      this.undoService.saveState(this._getUndoableState());
    }
  },
  
  /**
   * Undo the last action
   */
  undo() {
    this._flushPendingUndo();
    const state = this.undoService.undo();
    if (state) {
      this._restoreState(state);
      this.announce('Undo');
    }
  },
  
  /**
   * Redo the last undone action
   */
  redo() {
    this._flushPendingUndo();
    const state = this.undoService.redo();
    if (state) {
      this._restoreState(state);
      this.announce('Redo');
    }
  },
  
  /**
   * Restore application state from undo/redo.
   * Restores waypoints, selection, and global styles, then syncs all UI.
   * @param {Object} state - State snapshot to restore
   * @private
   */
  _restoreState(state) {
    // Clear waypoint map
    this.waypointsById.clear();
    
    // Restore waypoints
    this.waypoints = state.waypoints.map(wpData => Waypoint.fromJSON(wpData));
    this.waypoints.forEach(wp => this._addWaypointToMap(wp));
    
    // Restore selection
    this.selectedWaypoint = state.selectedWaypointId 
      ? this.waypointsById.get(state.selectedWaypointId) || null
      : null;
    
    // Restore global styles (if present in snapshot)
    if (state.styles) {
      // Preserve non-serializable Image reference
      const currentImage = this.styles.pathHead?.image;
      this.styles = { ...this.styles, ...state.styles };
      if (this.styles.pathHead) {
        this.styles.pathHead.image = currentImage;
      }
      // Restore path head image from asset if ID changed
      if (state.styles.pathHead?.imageAssetId) {
        this.imageAssetService.getImageElement(state.styles.pathHead.imageAssetId)
          .then(img => {
            if (img) this.styles.pathHead.image = img;
            this.queueRender();
          });
      }
      // Sync global style UI controls
      this._syncGlobalStyleUI();
    }
    
    // Invalidate caches
    this._majorWaypointsCache = null;
    
    // Recalculate and render
    if (this.waypoints.length >= 2) {
      this.calculatePath();
    } else {
      this.pathPoints = [];
    }
    this.updateWaypointList();
    this.updateWaypointEditor();
    
    // Sync swatch pickers to restored waypoint colors
    refreshSwatchPicker('#dot-color');
    refreshSwatchPicker('#segment-color');
    refreshSwatchPicker('#path-head-color');
    
    this.render();
    this.autoSave();
  },
  
  /**
   * Sync global style UI controls with current this.styles values.
   * Called after undo/redo restores global styles.
   * @private
   */
  _syncGlobalStyleUI() {
    const ph = this.styles.pathHead;
    if (this.elements.pathHeadStyle) this.elements.pathHeadStyle.value = ph.style;
    if (this.elements.pathHeadColor) this.elements.pathHeadColor.value = ph.color;
    if (this.elements.pathHeadSize) {
      this.elements.pathHeadSize.value = ph.size;
      if (this.elements.pathHeadSizeValue) this.elements.pathHeadSizeValue.textContent = ph.size;
    }
    if (this.elements.customHeadControls) {
      this.elements.customHeadControls.style.display = ph.style === 'custom' ? 'block' : 'none';
    }
    if (this.elements.headRotationMode) this.elements.headRotationMode.value = ph.rotationMode || 'auto';
    if (this.elements.headRotationOffset) {
      this.elements.headRotationOffset.value = ph.rotationOffset || 0;
      if (this.elements.headRotationOffsetValue) {
        this.elements.headRotationOffsetValue.textContent = `${ph.rotationOffset || 0}°`;
      }
    }
    // Sync graphics scale slider and RenderingService
    const gs = this.styles.graphicsScale ?? 1;
    this.renderingService.setGraphicsScale(gs);
    if (this.elements.graphicsScale) {
      // Inverse of scale = 2^(v/100) → v = log2(scale) * 100
      this.elements.graphicsScale.value = Math.round(Math.log2(gs) * 100);
    }
    if (this.elements.graphicsScaleValue) {
      this.elements.graphicsScaleValue.textContent =
        (gs >= 1 ? gs.toFixed(gs === Math.round(gs) ? 0 : 1)
                  : gs.toFixed(2).replace(/0$/, '')) + '×';
    }
    // Sync path casing toggle
    if (this.elements.pathCasingToggle) {
      this.elements.pathCasingToggle.checked = this.styles.showPathCasing !== false;
    }
    // Sync path glow toggle + intensity (older saves without pathGlow default to off)
    const glow = this.styles.pathGlow || { enabled: false, intensity: 0.5 };
    const glowPct = Math.round((glow.intensity ?? 0.5) * 100);
    if (this.elements.pathGlowToggle) {
      this.elements.pathGlowToggle.checked = glow.enabled === true;
    }
    if (this.elements.pathGlowIntensity) {
      this.elements.pathGlowIntensity.value = glowPct;
      this.elements.pathGlowIntensity.disabled = glow.enabled !== true;
    }
    if (this.elements.pathGlowValue) {
      this.elements.pathGlowValue.textContent = glowPct + '%';
    }
  }
};
