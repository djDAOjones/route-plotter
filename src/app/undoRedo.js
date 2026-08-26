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
import { PROJECT_ARCHIVE_LIMITS, SIZE_LIMITS } from '../services/ImageAssetService.js';
import { collectImageAssetReferences, planImageAssetAdmission } from '../utils/assetReferences.js';
import { formatRendererPixels, setRangeReadout } from '../utils/uiReadouts.js';

function updatePathHeadPreview(app, asset = null) {
  if (app.elements?.headPreview) app.elements.headPreview.style.display = asset ? 'block' : 'none';
  if (app.elements?.headFilename) app.elements.headFilename.textContent = asset?.name || '';
  if (app.elements?.headPreviewImg) {
    if (asset?.base64) app.elements.headPreviewImg.src = asset.base64;
    else if (app.elements.headPreviewImg.removeAttribute) app.elements.headPreviewImg.removeAttribute('src');
    else app.elements.headPreviewImg.src = '';
  }
}

function pruneUnreferencedImageAssets(app) {
  if (!app.imageAssetService?.pruneUnreferenced ||
      !app.undoService?.getRetainedSerializedStates ||
      typeof app._getUndoableState !== 'function') return [];
  const references = collectImageAssetReferences([
    app._getUndoableState(),
    ...app.undoService.getRetainedSerializedStates(),
  ]);
  return app.imageAssetService.pruneUnreferenced(references);
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
    pruneUnreferencedImageAssets(this);
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
      pruneUnreferencedImageAssets(this);
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
      pruneUnreferencedImageAssets(this);
    }
  },

  /**
   * Sweep assets that are unreachable from both the live model and every
   * retained undo/redo snapshot. If reference collection fails, no service
   * mutation is attempted.
   * @returns {string[]} Removed asset IDs
   */
  pruneImageAssets() {
    return pruneUnreferencedImageAssets(this);
  },

  /**
   * Commit one interactive marker/head image edit as a synchronous model,
   * asset, and history transaction. Imports deliberately bypass this path and
   * retain their detached stage/commit boundary.
   *
   * @param {Object} options
   * @param {import('../models/ImageAsset.js').ImageAsset} options.candidate
   * @param {Function} options.apply - Apply the candidate ID/image to live model state.
   * @param {Function} options.rollback - Restore the prior live model fields.
   * @returns {{asset: Object, isNew: boolean, warning: string|null, historyShortenedBy: number, removedIds: string[]}}
   */
  commitImageAssetEdit({ candidate, apply, rollback }) {
    if (!candidate || typeof apply !== 'function' || typeof rollback !== 'function') {
      throw new Error('Image asset edit requires a candidate, apply, and rollback');
    }

    // A prior debounced action must become a real root before this discrete
    // image action plans any history loss.
    this._flushPendingUndo();
    const historyBefore = this.undoService.createSnapshot();
    const assetsBefore = this.imageAssetService.getAssets();
    const existedBefore = Boolean(this.imageAssetService.getAsset(candidate.id));
    let liveApplied = false;
    let outcome;

    try {
      // Treat the callback as having entered the live-model transaction before
      // invoking it. A callback that mutates one target and then throws must
      // still restore every target through the caller's rollback closure.
      liveApplied = true;
      apply(candidate);
      const nextState = this._getUndoableState();
      const preview = this.undoService.previewSaveState(nextState);

      if (!preview.saved) {
        // Re-selecting the identical image is not a new branch and must not
        // invalidate redo or shorten history.
        const result = this.imageAssetService.addAsset(candidate);
        outcome = {
          ...result,
          historyShortenedBy: 0,
          removedIds: [],
        };
      } else {
        const plan = planImageAssetAdmission({
          assets: assetsBefore,
          candidate,
          prospectiveUndoStates: preview.undoStack,
          limits: PROJECT_ARCHIVE_LIMITS,
        });
        if (!plan.fits) throw new Error(plan.error);

        // No event/render/await occurs between the validated asset replacement
        // and the one history assignment, so observers never see mismatched
        // model references and bytes.
        this.imageAssetService.replaceAssets(plan.nextAssets);
        const saved = this.undoService.saveState(nextState, {
          discardOldest: plan.additionalDiscardCount,
        });
        if (!saved.saved) throw new Error('Image edit did not create an undo state');

        const asset = this.imageAssetService.getAsset(candidate.id);
        const warning = asset.size > SIZE_LIMITS.SINGLE_IMAGE_WARN
          ? `Image "${asset.name}" is ${asset.getFormattedSize()}. Large images may slow down the app.`
          : null;
        outcome = {
          asset,
          isNew: !existedBefore,
          warning,
          historyShortenedBy: saved.additionalDiscardCount,
          removedIds: plan.removedIds,
        };
      }
    } catch (error) {
      const rollbackErrors = [];
      if (liveApplied) {
        try {
          rollback();
        } catch (rollbackError) {
          console.error('Image reference rollback failed:', rollbackError);
          rollbackErrors.push(rollbackError);
        }
      }
      try {
        this.imageAssetService.replaceAssets(assetsBefore);
      } catch (rollbackError) {
        console.error('Image asset rollback failed:', rollbackError);
        rollbackErrors.push(rollbackError);
      }
      try {
        this.undoService.restoreSnapshot(historyBefore);
      } catch (rollbackError) {
        console.error('Image history rollback failed:', rollbackError);
        rollbackErrors.push(rollbackError);
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [error, ...rollbackErrors],
          'Image edit failed and rollback was incomplete'
        );
      }
      throw error;
    }

    if (outcome.historyShortenedBy > 0) {
      const count = outcome.historyShortenedBy;
      const message = `Image added. Undo history was shortened by ${count} additional ${count === 1 ? 'step' : 'steps'} to stay within project image limits.`;
      this.eventBus?.emit('ui:toast', { message, duration: 8000 });
    }
    return outcome;
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
    if (this.interactionHandler?.setSelection) {
      this.interactionHandler.setSelection(this.selectedWaypoints, this.selectedWaypoint);
    } else {
      this.interactionHandler?.setSelectedWaypoint?.(this.selectedWaypoint);
    }
    if (this.selectedWaypoint && this.selectedCrowd) {
      this.selectedCrowd = null;
      this.eventBus?.emit('crowd:deselected');
    }

    // Restore flow-layer scene (if present in snapshot); the rebuilt
    // layers are new objects, so re-resolve the crowd selection by id
    if (state.scene) {
      this.scene.fromJSON(state.scene);
    }
    this.resolveCrowdSelectionAfterRestore();
    this.resolveNetworkAfterRestore();
    this._syncSceneOutlineSelectionAfterRestore?.();

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
    pruneUnreferencedImageAssets(this);
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
      setRangeReadout(
        this.elements.pathHeadSize,
        this.elements.pathHeadSizeValue,
        formatRendererPixels(ph.size)
      );
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
