import { invalidateProjectOperations } from './operationGeneration.js';
import { resolveRenderReference } from '../utils/renderReference.js';
import { isBuiltInPathHeadStyle } from '../utils/pathHeadPresets.js';
import { discardForClearAll } from './unrestoredAutosave.js';

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
  // With no waypoints, this clears everything the route fed: its path and
  // branches, its structure, its anchors and its timeline (DEF-06).
  app.calculatePath();
  app.renderReference = resolveRenderReference(
    { width: app.displayWidth, height: app.displayHeight },
    { width: app.exportSettings?.resolutionX, height: app.exportSettings?.resolutionY }
  );
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
    // Bundled presets are not part of the asset service being cleared. Keep
    // their decoded image available when the user's route-wide style remains.
    if (!isBuiltInPathHeadStyle(app.styles.pathHead.style)) app.styles.pathHead.image = null;
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
  // Both durations to nothing, and nothing past them: the scene end the
  // empty route queued above has nothing to measure (CROWD-05).
  app.animationEngine.setDuration(0);
  if (app._sceneEndTimeout) {
    clearTimeout(app._sceneEndTimeout);
    app._sceneEndTimeout = null;
  }
  app.updateDurationReadout?.();

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
  // Clear All discards what was kept because it could not be restored too,
  // as its dialog says, so cleared work cannot come back on reload (DEF-28).
  // First: a record held in the recovery key keeps it from being cleared.
  const unrestored = discardForClearAll(app);
  const recoveryCleared = app.storageService.clearAutoSave();
  app._isDirty = false;
  app.updateTitleIndicator();
  if (!recoveryCleared || unrestored.failed) {
    app.announce(
      'Browser recovery could not be cleared; reload may restore old work.',
      'assertive'
    );
  } else if (unrestored.discarded > 1) {
    app.announce(`Project cleared, and the ${unrestored.discarded} sessions that couldn't be restored were discarded`);
  } else if (unrestored.discarded === 1) {
    app.announce("Project cleared, and the session that couldn't be restored was discarded");
  } else {
    app.announce('Project cleared');
  }

  console.log('Cleared all waypoints and path');
}
