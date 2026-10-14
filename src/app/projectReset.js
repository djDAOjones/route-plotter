import { invalidateProjectOperations } from './operationGeneration.js';
import { releaseBackgroundBusy } from './backgroundLoading.js';
import { beginStatusEpisode } from './persistence.js';
import { resolveRenderReference } from '../utils/renderReference.js';
import { isBuiltInPathHeadStyle } from '../utils/pathHeadPresets.js';
import { discardForClearAll } from './unrestoredAutosave.js';
import { ANIMATION } from '../config/constants.js';
import { regionOperation } from './regionLines.js';
import { clearRecoveryImages } from './recoveryImages.js';

/**
 * Establish a new, empty, non-undoable project baseline.
 * Kept outside the orchestrator so the destructive reset contract can be
 * exercised without constructing every browser controller.
 * @param {Object} app
 */
export function clearProject(app) {
  // One operation: "Project cleared" says the change, so the chip and the
  // empty list it moves are not said again; the warning that recovery could
  // not be cleared does not say it, and they are (UI-06 PR 6; Codex r2 on
  // 753f93f, 3).
  regionOperation(app, cover => clearProjectSaying(app, cover));
}

/**
 * Clear All's work and its message, `cover` called beside a message that
 * says the clear (`clearProject`).
 * @param {Object} app
 * @param {Function} cover
 */
function clearProjectSaying(app, cover) {
  // Clear establishes a new project baseline. Any background/custom-image
  // decode or Open Project operation started against the prior baseline is
  // no longer allowed to commit when it eventually resolves.
  invalidateProjectOperations(app);
  releaseBackgroundBusy();
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
  // The Duration thumb where the empty timeline is, and what can play: nothing
  // (CROWD-08 part A).
  app.syncDurationThumb?.();
  app.refreshPlayAvailability?.();
  // A new project's Hold at end (CROWD-06), once the cleared timeline is in
  // place: an empty project has no end to hold after, so it stays at nothing.
  app.styles.holdAtEndMs = ANIMATION.HOLD_AT_END_DEFAULT_MS;
  app.syncHoldAtEndControl?.();

  app.pause();
  app.updateTimeDisplay();
  app.updateWaypointList();

  app.eventBus.emit('app:cleared');
  // Back to Edit through the one mode setter, so the header switch says so
  // and the mode's listeners hear it; the event this sent had none (DEF-20).
  // Only after app:cleared: a gesture still held ends there without being
  // put back, where a mode change first would restore the deleted waypoint's
  // drag and selection.
  app._setPreviewMode(false);
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
  // The images recovery kept go with the record, their names, the prompt for
  // a background and every write of them still pending: after the writes
  // already issued, before any of the new project's (DEF-98).
  const imagesCleared = clearRecoveryImages(app);
  app._isDirty = false;
  app.updateTitleIndicator();
  // A new project: its first change is heard (UI-06 B-17).
  beginStatusEpisode(app);
  if (!recoveryCleared || unrestored.failed) {
    app.announce(
      'Browser recovery could not be cleared; reload may restore old work.',
      'assertive'
    );
  } else {
    let message = 'Project cleared';
    if (unrestored.discarded > 1) {
      message = `Project cleared, and the ${unrestored.discarded} sessions that couldn't be restored were discarded`;
    } else if (unrestored.discarded === 1) {
      message = "Project cleared, and the session that couldn't be restored was discarded";
    }
    if (imagesCleared) {
      // Said once the images are gone, never before (Codex, brief round 1,
      // 3); a removal that fails is said, and how to try again.
      imagesCleared.then(result => {
        if (result.ok) app.announce(message);
        else {
          app.announce(
            'Project cleared, but browser recovery could not remove its images. Choose Clear all again to remove them.',
            'assertive'
          );
        }
      });
    } else {
      app.announce(message);
    }
    cover();
  }

  console.log('Cleared all waypoints and path');
}
