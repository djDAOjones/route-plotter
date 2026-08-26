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

function updatePathHeadPreview(app, asset = null) {
  if (app.elements?.headPreview) app.elements.headPreview.style.display = asset ? 'block' : 'none';
  if (app.elements?.headFilename) app.elements.headFilename.textContent = asset?.name || '';
  if (app.elements?.headPreviewImg) {
    if (asset?.base64) app.elements.headPreviewImg.src = asset.base64;
    else if (app.elements.headPreviewImg.removeAttribute) app.elements.headPreviewImg.removeAttribute('src');
    else app.elements.headPreviewImg.src = '';
  }
}

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
      selectedWaypointIds: (this.selectedWaypoints || []).map(wp => wp.id),
      styles: stylesCopy,
      scene: this.scene.toJSON()
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
    // Each restore invalidates image work started by an older undo/redo. Image
    // decoding is asynchronous and may otherwise resolve out of order.
    const imageRestoreGeneration = (this._undoImageRestoreGeneration || 0) + 1;
    this._undoImageRestoreGeneration = imageRestoreGeneration;

    // Clear waypoint map
    this.waypointsById.clear();
    
    // Restore waypoints
    this.waypoints = state.waypoints.map(wpData => Waypoint.fromJSON(wpData));
    this.waypoints.forEach(wp => this._addWaypointToMap(wp));

    // Waypoint snapshots store only asset IDs. Rehydrate every referenced
    // custom marker without allowing a slow, superseded restore to overwrite a
    // newer undo/redo result.
    for (const waypoint of this.waypoints) {
      waypoint.customImage = null;
      const assetId = waypoint.customImageAssetId;
      if (!assetId || !this.imageAssetService?.getImageElement) continue;
      Promise.resolve()
        .then(() => this.imageAssetService.getImageElement(assetId))
        .then(image => {
          if (this._undoImageRestoreGeneration !== imageRestoreGeneration) return;
          if (this.waypointsById.get(waypoint.id) !== waypoint) return;
          if (waypoint.customImageAssetId !== assetId) return;
          waypoint.customImage = image || null;
          this.queueRender?.();
        })
        .catch(error => {
          if (this._undoImageRestoreGeneration === imageRestoreGeneration) {
            console.warn(`Could not restore custom image for waypoint ${waypoint.id}:`, error);
          }
        });
    }
    
    // Restore selection — the rebuilt waypoints are new objects, so
    // re-resolve both the primary and the multi-selection by id, and
    // hand the result to the UI layers that keep their own copies
    this.selectedWaypoint = state.selectedWaypointId
      ? this.waypointsById.get(state.selectedWaypointId) || null
      : null;
    this.selectedWaypoints = (state.selectedWaypointIds || [])
      .map(id => this.waypointsById.get(id))
      .filter(Boolean);
    if (this.selectedWaypoints.length === 0 && this.selectedWaypoint) {
      this.selectedWaypoints = [this.selectedWaypoint];
    }
    this.uiController?.setSelection(this.selectedWaypoints, this.selectedWaypoint);
    this.interactionHandler?.setSelectedWaypoint(this.selectedWaypoint);

    // Restore flow-layer scene (if present in snapshot); the rebuilt
    // layers are new objects, so re-resolve the crowd selection by id
    if (state.scene) {
      this.scene.fromJSON(state.scene);
    }
    this.resolveCrowdSelectionAfterRestore();
    this.resolveNetworkAfterRestore();

    // Restore global styles (if present in snapshot)
    if (state.styles) {
      const currentPathHead = this.styles?.pathHead;
      const hasRestoredPathHead = Object.prototype.hasOwnProperty.call(state.styles, 'pathHead');
      this.styles = { ...(this.styles || {}), ...state.styles };
      if (currentPathHead || hasRestoredPathHead) {
        const restoredPathHead = state.styles.pathHead && typeof state.styles.pathHead === 'object'
          ? state.styles.pathHead
          : {};
        const restoredAssetId = restoredPathHead.imageAssetId || null;
        this.styles.pathHead = {
          ...(currentPathHead || {}),
          ...restoredPathHead,
          imageAssetId: restoredAssetId,
          // Clear synchronously. Keeping the prior Image here makes restoring a
          // null or changed ID display the wrong path head until decoding ends.
          image: null,
        };
        updatePathHeadPreview(this);

        if (restoredAssetId && this.imageAssetService?.getImageElement) {
          Promise.resolve()
            .then(() => this.imageAssetService.getImageElement(restoredAssetId))
            .then(image => {
              if (this._undoImageRestoreGeneration !== imageRestoreGeneration) return;
              if (this.styles.pathHead?.imageAssetId !== restoredAssetId) return;
              this.styles.pathHead.image = image || null;
              const asset = image ? this.imageAssetService.getAsset?.(restoredAssetId) : null;
              updatePathHeadPreview(this, asset || null);
              this.queueRender?.();
            })
            .catch(error => {
              if (this._undoImageRestoreGeneration === imageRestoreGeneration) {
                console.warn('Could not restore the custom path-head image:', error);
              }
            });
        }
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
    this.uiController?.updateWaypointEditor?.(
      this.selectedWaypoint,
      this.selectedWaypoints.length > 1 ? this.selectedWaypoints : null
    );
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
