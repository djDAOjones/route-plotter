import { invalidateProjectOperations } from './operationGeneration.js';

/**
 * Establish a new, empty, non-undoable project baseline.
 * Kept outside the orchestrator so the destructive reset contract can be
 * exercised without constructing every browser controller.
 * @param {Object} app
 */
export function clearProject(app) {
  // Clear establishes a new project baseline. Any background/custom-image
  // decode or Open Project operation started against the prior baseline is
  // no longer allowed to commit when it eventually resolves.
  invalidateProjectOperations(app);
  app._editRevision += 1;
  app.waypoints = [];
  app.waypointsById.clear();
  app.scene.clear();
  app.pathPoints = [];
  app.selectedWaypoint = null;
  app.selectedWaypoints = [];
  app.imageAssetService.clear();
  app.background.image = null;
  app.updateImageTransform(null);
  app._autosaveBackgroundCache = null;
  app._autosaveAssetWarningShown = false;
  app._autosaveBackgroundWarningShown = false;
  app._autosaveFailureWarningShown = false;
  if (app.styles.pathHead) {
    app.styles.pathHead.image = null;
    app.styles.pathHead.imageAssetId = null;
  }
  if (app.elements.headPreview) app.elements.headPreview.style.display = 'none';
  if (app.elements.headFilename) app.elements.headFilename.textContent = '';
  if (app.elements.headPreviewImg) app.elements.headPreviewImg.removeAttribute('src');
  app.uiController?.setSelection([], null);
  if (app.selectedCrowd) {
    app.selectedCrowd = null;
    app.eventBus.emit('crowd:deselected');
  }
  app.updateLayersStrip();
  if (app.interactionHandler?.setSelection) app.interactionHandler.setSelection([], null);
  else app.interactionHandler?.setSelectedWaypoint?.(null);

  app.animationEngine.reset();
  app.animationEngine.setDuration(0);

  app.pause();
  app.updateTimeDisplay();
  app.updateWaypointList();

  if (app.previewMode) {
    app.previewMode = false;
    app.eventBus.emit('mode:changed', { previewMode: false });
  }

  app.eventBus.emit('app:cleared');
  app.uiController?.updateWaypointEditor(null);
  app.render();

  // Cancel pending writers before resetting recovery and history so old work
  // cannot reappear after the confirmation has completed.
  if (app._undoDebounceTimer) {
    clearTimeout(app._undoDebounceTimer);
    app._undoDebounceTimer = null;
  }
  app.undoService.reset(app._getUndoableState());
  const recoveryCleared = app.storageService.clearAutoSave();
  app._isDirty = false;
  app.updateTitleIndicator();
  if (!recoveryCleared) {
    app.announce(
      'Browser recovery could not be cleared; reload may restore old work.',
      'assertive'
    );
  } else {
    app.announce('Project cleared');
  }

  console.log('Cleared all waypoints and path');
}
