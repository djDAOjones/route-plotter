/**
 * EventBus + AnimationEngine subscription wiring: how model/services events reach the orchestrator.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, wiringBusMixin).
 */
import { Waypoint } from '../models/Waypoint.js';
import { refreshSwatchPicker } from '../components/SwatchPicker.js';
import { snapToAngle } from '../utils/snapToAngle.js';
import { branchEndInfo } from '../utils/routeBranches.js';

/**
 * Resolve a drag that ended on top of another waypoint as a branch rejoin.
 *
 * Only a branch's LAST waypoint carries the rejoin link, so only it can make
 * the gesture. The drop restores the dragged waypoint's start position — the
 * author was pointing at a target, not moving a point — and hands the link
 * change to `route:branch-rejoin`, which owns the validation and the undo
 * entry. Dropping on the current target clears the rejoin, so one gesture both
 * makes and unmakes it.
 *
 * A module helper rather than a mixin method: test harnesses and PlayerApp
 * host only part of this mixin, and a `this._method()` call is undefined there
 * (the same lesson as `routeOf` in pathTiming).
 *
 * @param {Object} app RoutePlotter
 * @param {Object} data `waypoint:drag-ended` payload
 * @returns {boolean} True when the drop was consumed as a rejoin
 */
function resolveBranchRejoinDrop(app, data) {
  const waypoint = data?.waypoint;
  if (!waypoint || data.dropX === undefined || data.dropY === undefined) return false;
  if (typeof app.findWaypointAt !== 'function') return false;

  const info = branchEndInfo(app.waypoints, waypoint);
  if (!info || !info.isEnd) return false;

  // Skip the whole drag group, not just the dragged point: a group drag lands
  // several waypoints under the cursor at once.
  const dragged = new Set(
    (data.dragGroup || []).map(item => item?.waypoint).filter(Boolean)
  );
  dragged.add(waypoint);
  const target = app.findWaypointAt(data.dropX, data.dropY, dragged);
  if (!target) return false;

  // Put it back: this gesture aimed at a target, it did not move a point.
  const start = (data.dragGroup || []).find(item => item?.waypoint === waypoint);
  if (start) {
    waypoint.imgX = start.imgX;
    waypoint.imgY = start.imgY;
  }

  app.eventBus.emit('route:branch-rejoin', { waypoint, targetId: target.id });
  return true;
}

export const wiringBusMixin = {

  
  /**
   * Set up EventBus listeners for decoupled component communication
   * Uses event-driven architecture to reduce tight coupling between methods
   * Events are categorized by change type for optimal performance:
   * - position-changed: Requires path recalculation (expensive)
   * - style-changed: Only visual update needed (cheap)
   * - path-property-changed: Affects path generation (medium cost)
   */
  setupEventBusListeners() {
    // ========== WAYPOINT LIFECYCLE EVENTS ==========
    
    /**
     * waypoint:added - New waypoint created
     * Triggers: Full update pipeline (path, list, save, render)
     * Skipped during batch mode for performance
     */
    this.eventBus.on('waypoint:added', (waypoint) => {
      // Validate waypoint instance
      if (!(waypoint instanceof Waypoint)) {
        console.error('Invalid waypoint: not a Waypoint instance', waypoint);
        return;
      }
      
      // Add to ID lookup map for O(1) access
      this._addWaypointToMap(waypoint);
      
      // Invalidate major waypoints cache
      this._majorWaypointsCache = null;
      
      // Skip individual updates during batch operations
      if (this._batchMode) return;
      
      // Save state for undo (after waypoint is added)
      this.saveUndoState();
      
      if (this.waypoints.length >= 2) {
        this.calculatePath(); // Only calculate if we have enough waypoints for a path
      }
      this.updateWaypointList();
      this.autoSave();
      this.queueRender(); // Batched render
    });
    
    /**
     * waypoint:deleted - Waypoint removed
     * Triggers: Full update pipeline
     */
    this.eventBus.on('waypoint:deleted', (index) => {
      // Invalidate major waypoints cache
      this._majorWaypointsCache = null;
      
      // Save state for undo (after waypoint is deleted)
      this.saveUndoState();
      
      if (this.waypoints.length >= 2) {
        this.calculatePath();
      } else {
        this.pathPoints = []; // Clear path if too few waypoints
      }
      this.updateWaypointList();
      this.updateWaypointEditor();
      this.autoSave();
      this.queueRender();
    });
    
    // NOTE: waypoint:selected is handled in _setupWaypointEvents() in main.js
    // to ensure this.selectedWaypoint is set BEFORE updateWaypointEditor() is called
    
    // ========== WAYPOINT PROPERTY CHANGE EVENTS ==========
    
    /**
     * waypoint:position-changed - Waypoint moved/dragged
     * MOST EXPENSIVE: Requires full path recalculation
     * Fired on every pointermove during drag (with isDragging=true) and
     * on each arrow key nudge. Undo is NOT saved here — instead:
     * - Drag completion: saved by waypoint:drag-ended (immediate)
     * - Arrow key nudge: saved by debounced timer (groups key repeats)
     */
    this.eventBus.on('waypoint:position-changed', (data) => {
      // InteractionHandler passes {waypoint, imgX, imgY, dragGroup,
      // isDragging}. dragGroup holds immutable gesture-start coordinates so
      // all selected points can be derived from one shared delta per frame.
      const waypoint = data?.waypoint || data;
      const isDragging = data?.isDragging || false;
      
      // Apply position if provided by InteractionHandler
      if (data?.imgX !== undefined) {
        let newX = data.imgX;
        let newY = data.imgY;
        
        // 15° angle snapping when Shift is held
        if (data.shiftKey) {
          const wpIndex = this.waypoints.indexOf(waypoint);
          if (wpIndex > 0) {
            const ref = this.waypoints[wpIndex - 1];
            const snapped = snapToAngle(ref.imgX, ref.imgY, newX, newY);
            newX = snapped.x;
            newY = snapped.y;
          }
        }
        
        const zoom = this.exportSettings.backgroundZoom / 100;
        const dragGroup = Array.isArray(data.dragGroup)
          ? data.dragGroup.filter(item => item?.waypoint && this.waypoints.includes(item.waypoint))
          : [];
        const primaryStart = dragGroup.find(item => item.waypoint === waypoint);

        if (primaryStart && dragGroup.length > 0) {
          let dx = newX - primaryStart.imgX;
          let dy = newY - primaryStart.imgY;
          if (zoom >= 1) {
            const minDx = Math.max(...dragGroup.map(item => -item.imgX));
            const maxDx = Math.min(...dragGroup.map(item => 1 - item.imgX));
            const minDy = Math.max(...dragGroup.map(item => -item.imgY));
            const maxDy = Math.min(...dragGroup.map(item => 1 - item.imgY));
            dx = minDx <= maxDx ? Math.max(minDx, Math.min(maxDx, dx)) : 0;
            dy = minDy <= maxDy ? Math.max(minDy, Math.min(maxDy, dy)) : 0;
          }
          for (const item of dragGroup) {
            item.waypoint.imgX = item.imgX + dx;
            item.waypoint.imgY = item.imgY + dy;
          }
        } else if (this.waypoints.includes(waypoint)) {
          if (zoom < 1) {
            // Zoomed out: allow waypoints outside image bounds (coords outside 0-1)
            waypoint.imgX = newX;
            waypoint.imgY = newY;
          } else {
            // Zoomed in or 100%: clamp to image bounds
            waypoint.imgX = Math.max(0, Math.min(1, newX));
            waypoint.imgY = Math.max(0, Math.min(1, newY));
          }
        }
      }
      
      this.calculatePath(); // Recalculate path with new position
      this.queueRender();
      
      // Only save and update list on completed actions, not mid-drag
      if (!isDragging) {
        this.saveUndoStateDebounced(); // Groups arrow key repeats
        this.updateWaypointList();
        this.autoSave();
      }
    });
    
    /**
     * waypoint:drag-ended - Drag operation completed (mouseup)
     * Saves undo state once for the entire drag operation.
     */
    this.eventBus.on('waypoint:drag-ended', (data) => {
      // A branch END dropped on another waypoint is a rejoin gesture, not a
      // move: restore where it was and set the link instead (ROUTE-01c).
      if (resolveBranchRejoinDrop(this, data)) return;

      const dragGroup = Array.isArray(data?.dragGroup) ? data.dragGroup : null;
      if (dragGroup && !dragGroup.some(item =>
        item?.waypoint && (item.waypoint.imgX !== item.imgX || item.waypoint.imgY !== item.imgY)
      )) {
        return;
      }
      this.saveUndoState(); // Immediate — one entry per drag
      this.updateWaypointList();
      this.autoSave();
    });

    /** Restore a cancelled single/group drag without creating history. */
    this.eventBus.on('waypoint:drag-cancelled', ({ positions } = {}) => {
      const restored = (positions || []).filter(item =>
        item?.waypoint && this.waypoints.includes(item.waypoint)
      );
      if (restored.length === 0) return;
      for (const item of restored) {
        item.waypoint.imgX = item.imgX;
        item.waypoint.imgY = item.imgY;
      }
      this.calculatePath();
      this.updateWaypointList();
      this.updateWaypointEditor();
      this.queueRender();
    });
    
    /**
     * waypoint:style-changed - Visual properties changed
     * LEAST EXPENSIVE: Only re-render, no path calculation needed
     * Examples: dot color, dot size, marker style, beacon color, label
     */
    this.eventBus.on('waypoint:style-changed', (_waypoint, { historyAlreadySaved = false } = {}) => {
      this.queueRender(); // Visual update only
      this.uiController.updateWaypointList(this.waypoints); // Sync sidebar dots/labels
      this._syncWaypointCardActions?.();
      if (!historyAlreadySaved) {
        this.saveUndoStateDebounced(); // Groups slider drags into single undo entry
      }
      this.autoSave();
    });
    
    /**
     * area:changed - Area highlight properties changed
     * LEAST EXPENSIVE: Only re-render, no path calculation needed
     */
    this.eventBus.on('area:changed', ({ waypoint }) => {
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    /**
     * area:draw-mode-changed - Auto-switch to edit mode when entering draw mode
     * Drawing in preview mode is confounding because area highlights may be
     * hidden by visibility rules. Switch to edit mode so all areas are visible.
     */
    this.eventBus.on('area:draw-mode-changed', ({ active }) => {
      if (active) {
        this._previewModeBeforeDraw = this.previewMode;
        if (this.previewMode) {
          this._setPreviewMode(false);
        }
      } else if (this._previewModeBeforeDraw !== undefined) {
        this._setPreviewMode(this._previewModeBeforeDraw);
        delete this._previewModeBeforeDraw;
      }
    });
    
    /**
     * render:request - Generic render request from any service
     * Used by AreaDrawingService during polygon draw mode for live preview
     */
    this.eventBus.on('render:request', () => {
      this.queueRender();
    });
    
    /**
     * area:draw-completed - Polygon drawing finished, refresh sidebar controls
     */
    this.eventBus.on('area:draw-completed', ({ waypoint }) => {
      if (this.selectedWaypoint === waypoint) {
        this.uiController.updateWaypointEditor(waypoint);
      }
    });
    
    /**
     * ui:refresh-swatches - Refresh swatch picker visual state
     * Called by UIController when waypoint selection changes
     */
    this.eventBus.on('ui:refresh-swatches', ({ targets }) => {
      if (targets && Array.isArray(targets)) {
        targets.forEach(selector => refreshSwatchPicker(selector));
      }
    });
    
    /**
     * waypoint:path-property-changed - Properties affecting path generation
     * MEDIUM EXPENSE: Requires path recalculation
     * Examples: segment color, segment width, segment style, path shape
     */
    this.eventBus.on('waypoint:path-property-changed', (waypoint) => {
      this.calculatePath(); // Path appearance changed
      this._syncWaypointCardActions?.();
      this.saveUndoStateDebounced(); // Groups slider drags into single undo entry
      this.autoSave();
      this.queueRender();
    });
    
    /**
     * waypoint:pause-changed - Waypoint pause time changed
     * Updates AnimationEngine pause markers for timeline-based pausing
     * Also updates total duration to include pause times
     */
    this.eventBus.on('waypoint:pause-changed', ({ waypoint, pauseTime, pauseMode }) => {
      console.debug(`⏸️ [Event] waypoint:pause-changed - wp${this.waypoints.indexOf(waypoint)}: ${pauseTime}ms, mode: ${pauseMode}`);
      
      // Use unified duration update (accounts for segment speeds and pauses)
      this.updateAnimationDuration();
      this._syncWaypointCardActions?.();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    /**
     * Handle waypoint segment speed changes
     * Recalculates path duration based on segment speeds
     */
    this.eventBus.on('waypoint:speed-changed', ({ waypoint, segmentSpeed }) => {
      const wpIdx = this.waypoints.indexOf(waypoint);
      const allSpeeds = this.waypoints.map((wp, i) => `wp${i}=${wp.segmentSpeed ?? 1.0}x`).join(', ');
      console.log(`🏃 [Event] waypoint:speed-changed - wp${wpIdx}: ${segmentSpeed}x | all speeds: [${allSpeeds}]`);
      
      // Recalculate path duration with segment speeds
      if (this.pathPoints && this.pathPoints.length > 0) {
        this.recalculateDurationWithSegmentSpeeds();
        // Dump full segment state after recalculation
        this.animationEngine.dumpSegmentState();
      }
      this._syncWaypointCardActions?.();
      
      this.saveUndoStateDebounced();
      this.autoSave();
    });
  },
  
  /**
   * Set up AnimationEngine event listeners
   * AnimationEngine emits events through EventBus with 'animation:' prefix
   * Provides event-driven updates for animation state changes
   * Performance optimization: React to engine events instead of polling
   */
  setupAnimationEngineListeners() {
    // Animation playback events - listen via EventBus
    this.eventBus.on('animation:play', () => {
      // Toggle button visibility: hide Play, show Pause
      this.elements.playBtn.style.display = 'none';
      this.elements.pauseBtn.style.display = 'inline-block';
      this.announce('Playing animation');
    });
    
    this.eventBus.on('animation:pause', () => {
      // Toggle button visibility: show Play, hide Pause
      this.elements.playBtn.style.display = 'inline-block';
      this.elements.pauseBtn.style.display = 'none';
      // Reset JKL state - speed multipliers are temporary review aids
      this._resetJKLState();
      this.announce('Animation paused');
    });
    
    this.eventBus.on('animation:complete', () => {
      // Show Play button when complete
      this.elements.playBtn.style.display = 'inline-block';
      this.elements.pauseBtn.style.display = 'none';
      // Reset JKL state - speed multipliers are temporary review aids
      this._resetJKLState();
      this.announce('Animation complete');
    });
    
    this.eventBus.on('animation:reset', () => {
      // Show Play button when reset
      this.elements.playBtn.style.display = 'inline-block';
      this.elements.pauseBtn.style.display = 'none';
      // Reset JKL state - speed multipliers are temporary review aids
      this._resetJKLState();
      this.announce('Animation reset');
      
      // Note: AnimationEngine.reset() automatically resets nextPauseIndex
      // so pause markers will trigger again on replay
      
      // Reset trail state for fresh animation
      // This clears the hybrid state tracking so trail starts from scratch
      this.motionVisibilityService.resetTrailState();
      
      // Reset reveal mask for fresh animation
      this.motionVisibilityService.resetRevealMask();
      
      // Reset beacon renderer so beacons can play again
      // Beacons are marked 'completed' after their animation finishes to prevent
      // infinite recreation at 100% progress. Clearing them here allows fresh playback.
      this.renderingService.resetBeacons();
      
      // Reset camera zoom rate limiter for fresh animation
      this.cameraService?.resetRateLimiter();
      
      const preservedSpeed = this.animationEngine.state.speed;
      
      // Recalculate duration using unified method (accounts for segment speeds)
      this.updateAnimationDuration(preservedSpeed);
      
      // Use event to avoid feedback loop
      this.eventBus.emit('ui:slider:update-speed', preservedSpeed);
    });
    
    // Waypoint wait events
    this.eventBus.on('animation:waypointWaitEnd', (waypointIndex) => {
      console.debug('Wait complete at waypoint', waypointIndex);
      this.announce('Continuing animation');
    });
  }
};
