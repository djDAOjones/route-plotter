/**
 * UIController/InteractionHandler event connections (waypoint add/select/drag, sliders, editor controls).
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, wiringControllersMixin).
 */
import { PATH_VISIBILITY } from '../config/constants.js';
import { Waypoint } from '../models/Waypoint.js';
import { refreshSwatchPicker } from '../components/SwatchPicker.js';
import { ContextMenu } from '../components/ContextMenu.js';
import { snapToAngle } from '../utils/snapToAngle.js';

/**
 * Reorder waypoints to a new major order, each major carrying its
 * trailing minors — a minor shapes the leg from the major before it, so
 * the pair must move together. Minors before the first major keep their
 * place at the front. Majors missing from newMajorOrder (e.g. a filtered
 * drag-and-drop payload) are appended in their original order rather
 * than dropped. Pure: returns a new array, mutates nothing.
 */
export function reorderWaypointBlocks(waypoints, newMajorOrder) {
  const blocks = new Map(); // major → [major, ...its trailing minors]
  const prefix = [];
  let block = null;
  waypoints.forEach(wp => {
    if (wp.isMajor) {
      block = [wp];
      blocks.set(wp, block);
    } else if (block) {
      block.push(wp);
    } else {
      prefix.push(wp);
    }
  });

  const reordered = [...prefix];
  newMajorOrder.forEach(major => {
    const b = blocks.get(major);
    if (b) {
      reordered.push(...b);
      blocks.delete(major);
    }
  });
  blocks.forEach(b => reordered.push(...b));
  return reordered;
}

export const wiringControllersMixin = {
  
  /**
   * Set up event connections for UI Controller and Interaction Handler
   */
  setupControllerEventConnections() {
    // Background events from UIController
    this.eventBus.on('background:upload', (file) => {
      this.loadImageFile(file).then(img => {
        this.background.image = img;
        this.updateImageTransform(img);
        
        // Set export resolution to match native image dimensions
        this.exportSettings.resolutionX = img.naturalWidth;
        this.exportSettings.resolutionY = img.naturalHeight;
        if (this.elements.exportResX) {
          this.elements.exportResX.value = img.naturalWidth;
        }
        if (this.elements.exportResY) {
          this.elements.exportResY.value = img.naturalHeight;
        }
        console.debug(`📐 [Resolution] Set to image native size: ${img.naturalWidth}×${img.naturalHeight}`);
        
        // Resize canvas to match new aspect ratio
        this.updateCanvasAspectRatio();
        
        if (this.waypoints.length >= 2) {
          this.calculatePath();
        }
        this.autoSave();
      });
    });
    
    this.eventBus.on('background:overlay-change', (value) => {
      this.background.overlay = value;
      this.render();
      this.autoSave();
    });
    
    this.eventBus.on('background:mode-change', (mode) => {
      this.background.fit = mode;
      this.coordinateTransform.fitMode = mode;
      this.updateImageTransform(this.background.image);
      this.render();
      this.autoSave();
    });
    
    // Animation control events from UIController
    // NOTE: These are command events from UI, NOT the state events emitted by AnimationEngine
    // AnimationEngine emits 'play', 'pause', etc. internally - we listen to those in setupAnimationEngineListeners()
    // These listeners are for UI button clicks, keyboard shortcuts, etc.
    this.eventBus.on('ui:animation:play', () => {
      // If animation is at 100%, restart from beginning
      if (this.animationEngine.getProgress() >= 1.0) {
        this.animationEngine.reset();
      }
      this.animationEngine.play();
    });
    this.eventBus.on('ui:animation:pause', () => this.animationEngine.pause());
    this.eventBus.on('ui:animation:skip-start', () => {
      this.animationEngine.reset();
    });
    this.eventBus.on('ui:animation:skip-end', () => this.animationEngine.seekToProgress(1.0));
    this.eventBus.on('ui:animation:seek', (progress) => this.animationEngine.seekToProgress(progress));
    this.eventBus.on('animation:speed-change', (speed) => {
      // Save current path progress before changing speed
      const currentPathProgress = this.animationEngine.getPathProgress();
      
      this.animationEngine.setSpeed(speed);
      
      // Use unified duration update (accounts for segment speeds)
      if (this.pathPoints && this.pathPoints.length > 0) {
        this.updateAnimationDuration(speed);
        
        // Restore path progress by calculating new timeline position
        // This ensures the animation doesn't jump when speed changes
        if (currentPathProgress > 0 && currentPathProgress < 1) {
          this.animationEngine.seekToPathProgress(currentPathProgress);
        }
      }
      
      // Validate zoom transitions (speed affects segment durations)
      this.validateZoomTransitions();
      
      this.autoSave();
    });
    
    /**
     * JKL Video Editor Style Playback Controls
     * 
     * J: Reverse playback, speed doubles with each press (-1x, -2x, -4x)
     * K: Play/pause toggle (handled by ui:animation:toggle)
     * L: Forward playback, speed doubles with each press (1x, 2x, 4x)
     * 
     * State tracking: jklDirection tracks current direction (1=forward, -1=reverse, 0=stopped)
     */
    this.jklDirection = 0; // Track JKL state: -1=reverse, 0=stopped, 1=forward
    this.jklSpeed = 1;     // Current JKL speed multiplier (1, 2, 4)
    
    this.eventBus.on('animation:jkl-reverse', () => {
      if (this.jklDirection === -1) {
        // Already reversing: double speed (max 4x)
        this.jklSpeed = Math.min(4, this.jklSpeed * 2);
      } else {
        // Start reverse at 1x
        this.jklDirection = -1;
        this.jklSpeed = 1;
      }
      this.animationEngine.setPlaybackSpeed(-this.jklSpeed);
      if (!this.animationEngine.state.isPlaying) {
        this.animationEngine.play();
      }
      console.debug(`⏪ JKL Reverse: ${-this.jklSpeed}x`);
    });
    
    this.eventBus.on('animation:jkl-forward', () => {
      if (this.jklDirection === 1) {
        // Already forward: double speed (max 4x)
        this.jklSpeed = Math.min(4, this.jklSpeed * 2);
      } else {
        // Start forward at 1x
        this.jklDirection = 1;
        this.jklSpeed = 1;
      }
      this.animationEngine.setPlaybackSpeed(this.jklSpeed);
      if (!this.animationEngine.state.isPlaying) {
        this.animationEngine.play();
      }
      console.debug(`⏩ JKL Forward: ${this.jklSpeed}x`);
    });
    
    // Reset JKL state when animation is toggled via K or space
    this.eventBus.on('ui:animation:toggle', () => {
      if (this.animationEngine.state.isPlaying) {
        this.animationEngine.pause();
        this.jklDirection = 0;
        this.jklSpeed = 1;
      } else {
        // Resume at normal speed
        this.animationEngine.setPlaybackSpeed(1.0);
        this.jklDirection = 1;
        this.jklSpeed = 1;
        this.animationEngine.play();
      }
    });
    
    /**
     * waypoint:nudge - Move waypoint by fraction of canvas dimension
     * More intuitive than pixel-based movement as it scales with canvas size.
     * When the nudged waypoint is part of a multi-selection, the whole
     * selection moves together by the same canvas-pixel delta.
     */
    this.eventBus.on('waypoint:nudge', (data) => {
      const { waypoint, dxFraction, dyFraction } = data;

      // Calculate pixel movement based on canvas dimensions
      const dx = dxFraction * this.displayWidth;
      const dy = dyFraction * this.displayHeight;

      const movers = this.selectedWaypoints.length > 1 && this.selectedWaypoints.includes(waypoint)
        ? this.selectedWaypoints
        : [waypoint];
      const zoom = this.exportSettings.backgroundZoom / 100;

      for (const wp of movers) {
        // Convert current position to canvas coords, apply offset, convert back
        const currentCanvas = this.imageToCanvas(wp.imgX, wp.imgY);
        const newCanvas = { x: currentCanvas.x + dx, y: currentCanvas.y + dy };
        const newImg = this.canvasToImage(newCanvas.x, newCanvas.y);

        // Update waypoint position (clamped to image bounds unless zoomed out)
        if (zoom < 1) {
          wp.imgX = newImg.x;
          wp.imgY = newImg.y;
        } else {
          wp.imgX = Math.max(0, Math.min(1, newImg.x));
          wp.imgY = Math.max(0, Math.min(1, newImg.y));
        }
      }

      // Trigger updates
      this.calculatePath();
      this.render();
      this.saveUndoStateDebounced(); // Groups rapid key repeats into single undo entry
      this.autoSave();
    });
    
    /**
     * waypoint:add - Add a new waypoint from InteractionHandler
     * 
     * Major waypoints: Added at end, become selected
     * Minor waypoints: Inserted after selected waypoint, then after each other
     * 
     * Ordering logic:
     * - Click Major A → selected = A, insert at end
     * - Shift+click Minor 1 → insert after A (index of A + 1)
     * - Shift+click Minor 2 → insert after Minor 1 (find last consecutive minor after A)
     * - Click Major B → selected = B, insert at end
     * 
     * This creates: Major A → Minor 1 → Minor 2 → Major B
     * 
     * Note: Bounds checking is done in InteractionHandler before emitting this event
     */
    this.eventBus.on('waypoint:add', (data) => {
      let addX = data.imgX;
      let addY = data.imgY;
      
      // Determine insertion index first (needed for angle snap reference)
      let insertIndex = this.waypoints.length; // Default: append to end
      
      if (!data.isMajor && this.selectedWaypoint) {
        // Minor waypoints: find insertion point after selected waypoint
        const selectedIndex = this.waypoints.indexOf(this.selectedWaypoint);
        if (selectedIndex !== -1) {
          // Find the last consecutive minor waypoint after the selected one
          // This ensures new minors append to the sequence, not insert at the start
          insertIndex = selectedIndex + 1;
          while (insertIndex < this.waypoints.length && !this.waypoints[insertIndex].isMajor) {
            insertIndex++;
          }
        }
      }
      
      // 15° angle snapping when Shift is held
      if (data.shiftKey && insertIndex > 0) {
        const ref = this.waypoints[insertIndex - 1];
        const snapped = snapToAngle(ref.imgX, ref.imgY, addX, addY);
        addX = snapped.x;
        addY = snapped.y;
      }
      
      const waypoint = data.isMajor ? 
        Waypoint.createMajor(addX, addY) : 
        Waypoint.createMinor(addX, addY);
      
      // Copy properties from appropriate source waypoint
      const sourceWaypoint = insertIndex > 0 
        ? this.waypoints[insertIndex - 1] 
        : (this.waypoints.length > 0 ? this.waypoints[0] : null);
      
      if (sourceWaypoint) {
        waypoint.copyPropertiesFrom(sourceWaypoint);
      }
      
      // Insert waypoint at calculated position
      this.waypoints.splice(insertIndex, 0, waypoint);
      this._addWaypointToMap(waypoint);
      
      // Major waypoints become selected (so subsequent minor waypoints follow them)
      if (data.isMajor) {
        this.selectedWaypoint = waypoint;
        this.selectedWaypoints = [waypoint];
        this.uiController?.setSelection([waypoint], waypoint);
      }

      this.eventBus.emit('waypoint:added', waypoint);
    });
    
    // Note: waypoint:position-changed is handled in _setupEventBusListeners()
    // which applies position, recalculates path, and manages undo saves.
    
    this.eventBus.on('waypoint:selected', (waypoint) => {
      this.selectedWaypoint = waypoint;
      this.selectedWaypoints = [waypoint];
      this.interactionHandler?.setSelectedWaypoint(waypoint);
      this.uiController?.setSelection([waypoint], waypoint);
      this.uiController?.updateWaypointEditor(waypoint);
      this.updateWaypointList();
      this.updateWaypointEditor(); // Update RoutePlotter's editor (includes camera controls)
      this._updateCameraControlsVisibility(false); // Single selection mode

      // Sync swatch picker radios with updated hidden input values
      // Without this, clicking a swatch already checked from a previous waypoint
      // won't fire a change event (radio state out of sync with hidden input)
      refreshSwatchPicker('#dot-color');
      refreshSwatchPicker('#segment-color');
      refreshSwatchPicker('#path-head-color');

      this.queueRender(); // Highlight selection
    });

    // waypoint:multi-selected - Multiple waypoints selected via
    // shift/cmd-click (list), cmd-click (canvas), or Cmd/Ctrl+A.
    // The selection is normalised to route order so bulk operations and
    // the chip's counts are stable regardless of click order.
    this.eventBus.on('waypoint:multi-selected', ({ waypoints, primary }) => {
      const inSelection = new Set(waypoints);
      this.selectedWaypoints = this.waypoints.filter(wp => inSelection.has(wp));
      this.selectedWaypoint = primary;
      this.interactionHandler?.setSelectedWaypoint(primary);
      this.uiController?.setSelection(this.selectedWaypoints, primary);
      // Inspector shows the primary's values; edits write to the whole selection
      this.uiController?.updateWaypointEditor(primary, this.selectedWaypoints);
      this.updateWaypointList();
      this.updateWaypointEditor(); // Sync RoutePlotter's editor (camera controls etc.)
      this._updateCameraControlsVisibility(true); // Multi-select mode
      refreshSwatchPicker('#dot-color');
      refreshSwatchPicker('#segment-color');
      this.queueRender();
    });

    // waypoint:toggle-select - Cmd/Ctrl+click on a waypoint (canvas):
    // grow or shrink the multi-selection one waypoint at a time
    this.eventBus.on('waypoint:toggle-select', (waypoint) => {
      const current = this.selectedWaypoints.length
        ? [...this.selectedWaypoints]
        : (this.selectedWaypoint ? [this.selectedWaypoint] : []);
      const index = current.indexOf(waypoint);

      if (index === -1) {
        const next = [...current, waypoint];
        if (next.length === 1) {
          this.eventBus.emit('waypoint:selected', waypoint);
        } else {
          this.eventBus.emit('waypoint:multi-selected', { waypoints: next, primary: waypoint });
        }
        return;
      }

      current.splice(index, 1);
      if (current.length === 0) {
        this.eventBus.emit('waypoint:deselected');
      } else if (current.length === 1) {
        this.eventBus.emit('waypoint:selected', current[0]);
      } else {
        const primary = this.selectedWaypoint === waypoint
          ? current[current.length - 1]
          : this.selectedWaypoint;
        this.eventBus.emit('waypoint:multi-selected', { waypoints: current, primary });
      }
    });

    // waypoint:deselected - All waypoints deselected
    this.eventBus.on('waypoint:deselected', () => {
      this.selectedWaypoint = null;
      this.selectedWaypoints = [];
      this.interactionHandler?.setSelectedWaypoint(null);
      this.uiController?.setSelection([], null);
      this.uiController?.updateWaypointEditor(null);
      this.updateWaypointList();
      this.queueRender(); // Clear selection rings
    });
    
    // waypoint:delete - Request to delete a specific waypoint (from InteractionHandler)
    this.eventBus.on('waypoint:delete', (waypoint) => {
      this.deleteWaypoint(waypoint);
    });
    
    this.eventBus.on('waypoint:delete-selected', () => {
      // Multi-selection deletes as one gesture: every selected waypoint
      // goes in a single pass with a single undo entry (the per-waypoint
      // deleteWaypoint path would snapshot and recalc once per waypoint)
      if (this.selectedWaypoints.length > 1) {
        const doomed = [...this.selectedWaypoints];
        const firstIndex = this.waypoints.indexOf(doomed[0]);
        for (const wp of doomed) {
          const index = this.waypoints.indexOf(wp);
          if (index > -1) {
            this.waypoints.splice(index, 1);
            this._removeWaypointFromMap(wp);
          }
        }
        this.selectedWaypoint = null;
        this.selectedWaypoints = [];
        this.interactionHandler?.setSelectedWaypoint(null);
        this.uiController?.setSelection([], null);
        // One pass through the shared deleted pipeline: one undo
        // snapshot, one path recalc, one autosave. The deselected event
        // then walks SectionController back to Route scope.
        this.eventBus.emit('waypoint:deleted', firstIndex);
        this.eventBus.emit('waypoint:deselected');
        this.announce(`${doomed.length} waypoints deleted`);
        return;
      }

      if (this.selectedWaypoint) {
        this.deleteWaypoint(this.selectedWaypoint);
        this.selectedWaypoint = null;
      }
    });
    
    this.eventBus.on('waypoints:clear-all', () => {
      this.clearAll();
    });
    
    // Project save/load buttons
    this.elements.saveProjectBtn?.addEventListener('click', () => this.saveProject());
    this.elements.loadProjectBtn?.addEventListener('click', () => this.elements.loadProjectInput?.click());
    this.elements.loadProjectInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        this.loadProject(file);
        e.target.value = ''; // Reset input for re-selection
      }
    });
    
    // waypoint:add-at-center - Add new waypoint at center of visible canvas (AAA keyboard access)
    this.eventBus.on('waypoint:add-at-center', () => {
      if (!this.backgroundImage) return;
      
      // Calculate center of image in image coordinates
      const centerX = this.backgroundImage.width / 2;
      const centerY = this.backgroundImage.height / 2;
      
      // Create new waypoint at center
      const lastMajor = this.waypoints.filter(wp => wp.isMajor).pop();
      const newWaypoint = Waypoint.createMajor(centerX, centerY);
      if (lastMajor) {
        newWaypoint.copyPropertiesFrom(lastMajor);
      }
      
      this.waypoints.push(newWaypoint);
      this._addWaypointToMap(newWaypoint);
      
      // Select the new waypoint
      this.selectedWaypoint = newWaypoint;
      this.selectedWaypoints = [newWaypoint];
      this.uiController?.setSelection([newWaypoint], newWaypoint);
      this.interactionHandler?.setSelectedWaypoint(newWaypoint);
      
      // Update path and UI
      this.generatePathData();
      this.queueRender();
      this.uiController.updateWaypointList(this.waypoints);
      this.uiController.updateWaypointEditor(newWaypoint);
      this.autoSave();
      
      this.uiController.announce('Waypoint added at center of map');
    });
    
    // waypoint:name-changed - Waypoint renamed in list
    this.eventBus.on('waypoint:name-changed', ({ waypoint, name }) => {
      // Name is already set on waypoint by the rename input
      this.saveUndoStateDebounced(); // Renames were not undoable before 2026-08-18
      this.autoSave();
    });
    
    // (waypoint:all-change is gone — the "All Waypoints" bulk mode
    // dissolved into ordinary multi-select. Cards write to every
    // selected waypoint through the normal single-change pipelines.)

    // ========== CANVAS CONTEXT MENU (review 2026-08-18) ==========
    // InteractionHandler has emitted these since v2 with no listener —
    // right-click was suppressed but dead. One ContextMenu instance
    // serves both menus.

    this.eventBus.on('waypoint:show-context-menu', ({ waypoint, x, y }) => {
      // Select first so the menu visibly acts on this waypoint — unless
      // it's already part of a multi-selection, which right-click keeps
      if (this.selectedWaypoint !== waypoint && !this.selectedWaypoints.includes(waypoint)) {
        this.eventBus.emit('waypoint:selected', waypoint);
      }

      const majorsCount = this.waypoints.filter(wp => wp.isMajor).length;
      const lastMajor = waypoint.isMajor && majorsCount <= 1;
      const items = [];

      if (waypoint.isMajor) {
        items.push({
          label: 'Rename',
          action: () => this.eventBus.emit('waypoint:request-rename', waypoint)
        });
      }
      items.push({
        label: waypoint.isMajor ? 'Convert to minor waypoint' : 'Convert to major waypoint',
        disabled: lastMajor,
        disabledReason: lastMajor ? 'The route needs at least one major waypoint' : undefined,
        action: () => this.eventBus.emit('waypoint:toggle-type', waypoint)
      });
      items.push({
        label: 'Insert waypoint before',
        action: () => this.eventBus.emit('waypoint:insert-adjacent', { waypoint, where: 'before' })
      });
      items.push({
        label: 'Insert waypoint after',
        action: () => this.eventBus.emit('waypoint:insert-adjacent', { waypoint, where: 'after' })
      });
      items.push({
        label: 'Delete waypoint',
        danger: true,
        separatorBefore: true,
        action: () => this.eventBus.emit('waypoint:delete', waypoint)
      });

      this._contextMenu ||= new ContextMenu();
      this._contextMenu.show({ x, y, items, ariaLabel: 'Waypoint actions' });
    });

    this.eventBus.on('canvas:show-context-menu', ({ x, y, canvasX, canvasY }) => {
      // Same bounds rule as click-to-add (coordinate:check-bounds above)
      const zoom = this.exportSettings.backgroundZoom / 100;
      let within;
      if (zoom < 1) {
        const canvas = this.screenToCanvas(canvasX, canvasY);
        within = this.coordinateTransform.isWithinCanvasBounds(canvas.x, canvas.y);
      } else {
        within = this.isWithinImageBounds(canvasX, canvasY);
      }
      if (!within || !this.background.image) return;

      const img = this.screenToImage(canvasX, canvasY);
      const noRoute = this.waypoints.length === 0;
      const items = [
        {
          label: 'Add waypoint here',
          action: () => this.eventBus.emit('waypoint:add', { imgX: img.x, imgY: img.y, isMajor: true })
        },
        {
          label: 'Add minor waypoint here',
          disabled: noRoute,
          disabledReason: noRoute ? 'Minor waypoints shape a leg — add a waypoint first' : undefined,
          action: () => this.eventBus.emit('waypoint:add', { imgX: img.x, imgY: img.y, isMajor: false })
        }
      ];

      this._contextMenu ||= new ContextMenu();
      this._contextMenu.show({ x, y, items, ariaLabel: 'Canvas actions' });
    });

    /**
     * waypoint:toggle-type - Convert major ↔ minor. Emitted by the T key
     * since v2 but never handled until the 2026-08-18 context menu work.
     * Type changes move pauses/labels/beacons in or out of the timeline,
     * so duration must be recalculated alongside the path.
     */
    this.eventBus.on('waypoint:toggle-type', (waypoint) => {
      if (!waypoint) return;
      const majorsCount = this.waypoints.filter(wp => wp.isMajor).length;
      if (waypoint.isMajor && majorsCount <= 1) {
        this.announce('Cannot convert the only major waypoint to minor');
        return;
      }

      waypoint.isMajor = !waypoint.isMajor;
      this._majorWaypointsCache = null;
      this.saveUndoState();

      if (this.waypoints.length >= 2) {
        this.calculatePath();
      }
      this.updateAnimationDuration();
      // Re-run the selection pipeline so editor, list, and canvas all
      // reflect the new type
      this.eventBus.emit('waypoint:selected', waypoint);
      this.autoSave();
      this.queueRender();
      this.announce(waypoint.isMajor ? 'Converted to major waypoint' : 'Converted to minor waypoint');
    });

    /**
     * waypoint:insert-adjacent - Insert a new major waypoint next to an
     * existing one (context menu). Positioned at the midpoint toward the
     * neighbour on that side, or extended past the endpoint when there
     * is none. waypoint:added handles undo/path/list/save.
     */
    this.eventBus.on('waypoint:insert-adjacent', ({ waypoint, where }) => {
      const index = this.waypoints.indexOf(waypoint);
      if (index === -1) return;

      const neighbour = this.waypoints[where === 'before' ? index - 1 : index + 1];
      let imgX, imgY;
      if (neighbour) {
        imgX = (waypoint.imgX + neighbour.imgX) / 2;
        imgY = (waypoint.imgY + neighbour.imgY) / 2;
      } else {
        // Endpoint: continue the route's direction by ~8% of the image,
        // clamped inside it; a single-waypoint route offsets rightward
        const ref = this.waypoints[where === 'before' ? index + 1 : index - 1];
        const dx = ref ? waypoint.imgX - ref.imgX : 1;
        const dy = ref ? waypoint.imgY - ref.imgY : 0;
        const len = Math.hypot(dx, dy) || 1;
        const step = 0.08;
        imgX = Math.min(1, Math.max(0, waypoint.imgX + (dx / len) * step));
        imgY = Math.min(1, Math.max(0, waypoint.imgY + (dy / len) * step));
      }

      const newWp = Waypoint.createMajor(imgX, imgY);
      newWp.copyPropertiesFrom(waypoint);
      this.waypoints.splice(where === 'before' ? index : index + 1, 0, newWp);

      this.eventBus.emit('waypoint:added', newWp);
      this.eventBus.emit('waypoint:selected', newWp);
      this.announce(where === 'before' ? 'Waypoint inserted before' : 'Waypoint inserted after');
    });

    /**
     * waypoint:request-rename - Focus the waypoint's list row and start
     * inline rename (context menu). Selection rebuilds the list, so the
     * rename call is deferred a frame to target the fresh row.
     */
    this.eventBus.on('waypoint:request-rename', (waypoint) => {
      if (this.selectedWaypoint !== waypoint) {
        this.eventBus.emit('waypoint:selected', waypoint);
      }
      requestAnimationFrame(() => this.uiController?.startRenameFor(waypoint));
    });

    // ========== VIDEO EXPORT EVENTS ==========
    
    /**
     * video:frame-rate-change - Update export frame rate setting
     */
    this.eventBus.on('video:frame-rate-change', (frameRate) => {
      this.exportSettings.frameRate = frameRate;
      console.debug(`🎬 [VideoExport] Frame rate set to ${frameRate} fps`);
    });
    
    /**
     * video:layers-change - Toggle between path with image and path only (transparent)
     */
    this.eventBus.on('video:layers-change', (pathOnly) => {
      this.exportSettings.pathOnly = pathOnly;
      this.autoSave(); // parity with include camera/text — persist the image toggle immediately
      console.debug(`🎬 [VideoExport] Layers set to ${pathOnly ? 'path only (transparent)' : 'path with image'}`);
    });
    
    /**
     * video:camera-change - Toggle whether preview/export applies per-waypoint camera zoom/pan.
     * Reflects live in Preview mode (WYSIWYG); Edit mode is unaffected. Persisted via autoSave.
     * emits from UIController checkbox → here → _calculateCameraState reads exportSettings.includeCamera
     */
    this.eventBus.on('video:camera-change', (includeCamera) => {
      this.exportSettings.includeCamera = includeCamera;
      this.autoSave();
      if (this.previewMode) this.queueRender(); // WYSIWYG: reflect toggle on the live canvas
    });
    
    /**
     * video:text-change - Toggle whether preview/export shows waypoint text labels.
     * Reflects live in Preview mode (WYSIWYG); Edit mode is unaffected. Persisted via autoSave.
     * emits from UIController checkbox → here → renderState.suppressLabels in render()
     */
    this.eventBus.on('video:text-change', (includeText) => {
      this.exportSettings.includeText = includeText;
      this.autoSave();
      if (this.previewMode) this.queueRender(); // WYSIWYG: reflect toggle on the live canvas
    });
    
    /**
     * video:resolution-change - Update export resolution and canvas aspect ratio
     * @param {Object} resolution - { width, height } - null values are ignored
     */
    this.eventBus.on('video:resolution-change', ({ width, height }) => {
      if (width !== null) {
        this.exportSettings.resolutionX = width;
      }
      if (height !== null) {
        this.exportSettings.resolutionY = height;
      }
      console.debug(`🎬 [VideoExport] Resolution set to ${this.exportSettings.resolutionX}×${this.exportSettings.resolutionY}`);
      
      // Update canvas aspect ratio to match export resolution
      this.updateCanvasAspectRatio();
    });
    
    /**
     * video:resolution-native - Set resolution to loaded image's native dimensions
     */
    this.eventBus.on('video:resolution-native', () => {
      if (this.background.image) {
        const width = this.background.image.naturalWidth;
        const height = this.background.image.naturalHeight;
        this.exportSettings.resolutionX = width;
        this.exportSettings.resolutionY = height;
        if (this.elements.exportResX) {
          this.elements.exportResX.value = width;
        }
        if (this.elements.exportResY) {
          this.elements.exportResY.value = height;
        }
        this.updateCanvasAspectRatio();
        console.debug(`📐 [Resolution] Set to native: ${width}×${height}`);
      } else {
        console.warn('📐 [Resolution] No image loaded for native resolution');
      }
    });
    
    /**
     * background:zoom-change - Update background zoom level
     * Zoom affects how the background is displayed and waypoint positions
     * @param {number} zoom - Zoom percentage (100 = no zoom, 200 = 2x zoom)
     */
    this.eventBus.on('background:zoom-change', (zoom) => {
      this.exportSettings.backgroundZoom = zoom;
      // Update coordinate transform with new zoom factor
      this.coordinateTransform.setBackgroundZoom(zoom / 100);
      // Clamp waypoints that may now be out of bounds
      this.clampWaypointsToCanvas();
      this.render();
      this.autoSave();
      console.debug(`🔍 [Zoom] Background zoom set to ${zoom}%`);
    });
    
    /**
     * video:export-request - Start video export process
     * Uses frame-by-frame capture for consistent output
     */
    this.eventBus.on('video:export-request', (format) => {
      if (!this.previewMode) {
        this.showToast('Tip: Switch to Preview mode to see exactly how the export will look', 6000);
      }
      this.exportSettings.format = format || 'mp4';
      this.exportVideo();
    });
    
    /**
     * html:export-request - Export as interactive HTML file
     * Creates a self-contained HTML file with embedded player
     */
    this.eventBus.on('html:export-request', () => {
      if (!this.previewMode) {
        this.showToast('Tip: Switch to Preview mode to see exactly how the export will look', 6000);
      }
      this.exportHTML();
    });
    
    // ========== MOTION VISIBILITY EVENTS ==========
    
    /**
     * motion:preview-mode-change - Toggle between edit and preview mode
     * Edit mode: everything visible for editing
     * Preview mode: applies motion visibility settings
     */
    this.eventBus.on('motion:preview-mode-change', (previewMode) => {
      this.previewMode = previewMode;
      console.debug(`👁️ [Motion] ${previewMode ? 'Preview' : 'Edit'} mode`);
      // Recalculate duration to add/remove end buffer
      this.updateAnimationDuration();
      this.render();
    });
    
    /**
     * motion:path-visibility-change - Update path visibility mode
     * Also toggles Trail Size control visibility (only shown for comet/instantaneous mode)
     */
    this.eventBus.on('motion:path-visibility-change', (mode) => {
      console.debug('[Motion] pathVisibility changed:', this.motionSettings.pathVisibility, '→', mode);
      this.motionSettings.pathVisibility = mode;
      
      // Show/hide Trail Size control based on mode
      const trailControl = document.getElementById('path-trail-control');
      if (trailControl) {
        trailControl.style.display = (mode === PATH_VISIBILITY.INSTANTANEOUS) ? 'flex' : 'none';
      }
      
      this.autoSave();
      if (this.previewMode) this.render();
    });
    
    /**
     * motion:path-trail-change - Update path trail fraction
     * @param {number} trailFraction - Trail as fraction of sequence (0=off, 0.01-1.0)
     */
    this.eventBus.on('motion:path-trail-change', (trailFraction) => {
      this.motionSettings.pathTrail = trailFraction;
      // Recalculate duration since tail time depends on trail
      this.updateAnimationDuration();
      this.autoSave();
      if (this.previewMode) this.render();
    });
    
    /**
     * motion:waypoint-visibility-change - Update waypoint visibility mode
     */
    this.eventBus.on('motion:waypoint-visibility-change', (mode) => {
      this.motionSettings.waypointVisibility = mode;
      this.autoSave();
      if (this.previewMode) this.render();
    });
    
    /**
     * motion:background-visibility-change - Update background visibility mode
     */
    this.eventBus.on('motion:background-visibility-change', (mode) => {
      this.motionSettings.backgroundVisibility = mode;
      // Reset reveal mask when switching to reveal modes
      if (mode === 'spotlight-reveal' || mode === 'angle-of-view-reveal') {
        this.motionVisibilityService.resetRevealMask();
      }
      this.autoSave();
      if (this.previewMode) this.render();
    });
    
    /**
     * motion:reveal-size-change - Update reveal circle size
     */
    this.eventBus.on('motion:reveal-size-change', (sizePercent) => {
      this.motionSettings.revealSize = sizePercent;
      this.autoSave();
      if (this.previewMode) this.render();
    });
    
    /**
     * motion:reveal-feather-change - Update reveal feather width
     */
    this.eventBus.on('motion:reveal-feather-change', (featherPercent) => {
      this.motionSettings.revealFeather = featherPercent;
      this.autoSave();
      if (this.previewMode) this.render();
    });
    
    /**
     * motion:aov-angle-change - Update angle of view cone angle
     */
    this.eventBus.on('motion:aov-angle-change', (angleDegrees) => {
      this.motionSettings.aovAngle = angleDegrees;
      this.autoSave();
      if (this.previewMode) this.render();
    });
    
    /**
     * motion:aov-distance-change - Update angle of view distance
     */
    this.eventBus.on('motion:aov-distance-change', (distancePercent) => {
      this.motionSettings.aovDistance = distancePercent;
      this.autoSave();
      if (this.previewMode) this.render();
    });
    
    /**
     * motion:aov-dropoff-change - Update angle of view dropoff
     */
    this.eventBus.on('motion:aov-dropoff-change', (dropoffPercent) => {
      this.motionSettings.aovDropoff = dropoffPercent;
      this.autoSave();
      if (this.previewMode) this.render();
    });
    
    // Waypoint reordering from UIController drag-and-drop
    this.eventBus.on('waypoints:reordered', (newOrder) => {
      // Each major moves as a block with its trailing minors. Rebuilding
      // majors in place while minors kept their array slots silently
      // reattached minors to different legs (data bug, review 2026-08-18).
      this.waypoints = reorderWaypointBlocks(this.waypoints, newOrder);

      // Cached major positions are index-derived — stale after reorder
      this._majorWaypointsCache = null;
      this.saveUndoState();

      // Recalculate path and update
      if (this.waypoints.length >= 2) {
        this.calculatePath();
      }
      this.updateWaypointList();
      this.autoSave();
      this.queueRender();
    });
    
    // Coordinate conversion callbacks
    // All mouse event coordinates are in SCREEN space (CSS pixels relative to canvas element)
    // These events handle the full pipeline: Screen ↔ Canvas ↔ Image
    
    this.eventBus.on('coordinate:canvas-to-image', (data, callback) => {
      // Input: screen coords (despite legacy name "canvasX/Y")
      // Output: normalized image coords (0-1)
      const result = this.screenToImage(data.canvasX, data.canvasY);
      if (callback) callback(result);
    });
    
    this.eventBus.on('coordinate:image-to-canvas', (data, callback) => {
      // Input: normalized image coords (0-1)
      // Output: screen coords (for comparison with mouse events)
      // Note: Returns SCREEN coords so drag offsets work correctly when zoomed
      const result = this.imageToScreen(data.imgX, data.imgY);
      if (callback) callback(result);
    });
    
    this.eventBus.on('coordinate:check-bounds', (data, callback) => {
      // Input: screen coords
      // Output: boolean (is click within allowable area)
      const zoom = this.exportSettings.backgroundZoom / 100;
      let isWithin;
      if (zoom < 1) {
        // Zoomed out: allow waypoints anywhere on the canvas surface
        const canvas = this.screenToCanvas(data.canvasX, data.canvasY);
        isWithin = this.coordinateTransform.isWithinCanvasBounds(canvas.x, canvas.y);
      } else {
        // Zoomed in or 100%: restrict to image bounds
        isWithin = this.isWithinImageBounds(data.canvasX, data.canvasY);
      }
      if (callback) callback(isWithin);
    });
    
    this.eventBus.on('waypoint:check-at-position', (pos, callback) => {
      const waypoint = this.findWaypointAt(pos.x, pos.y);
      if (callback) callback(waypoint);
    });
    
    // Area highlight handle hit test (for edit dragging)
    this.eventBus.on('area:check-handle', ({ screenX, screenY }, callback) => {
      if (!this.selectedWaypoint || !this.areaEditService) {
        if (callback) callback(null);
        return;
      }
      const imageToCanvas = (x, y) => this.imageToCanvas(x, y);
      const hit = this.areaEditService.hitTest(
        this.selectedWaypoint, screenX, screenY,
        imageToCanvas, this.canvas.width, this.canvas.height
      );
      if (hit) {
        if (callback) callback({ ...hit, waypoint: this.selectedWaypoint, imageToCanvas });
      } else {
        if (callback) callback(null);
      }
    });

    // ========== CANVAS HOVER AFFORDANCES (Phase 4) ==========

    /**
     * canvas:hover-move - Idle pointer moved (rAF-throttled by
     * InteractionHandler). Cascades hit-tests in the same priority order
     * as mousedown — area handle, waypoint, leg midpoint "+", leg — and
     * stores the result on this.canvasHover for the hover render layers.
     * Calls back with the hover kind so the cursor can react.
     */
    this.eventBus.on('canvas:hover-move', ({ x, y }, callback) => {
      let hover = null;

      if (!this.previewMode && !this.areaDrawingService?.isDrawing) {
        // Area handles first (they sit above waypoints when editing)
        if (this.selectedWaypoint && this.areaEditService) {
          const handleHit = this.areaEditService.hitTest(
            this.selectedWaypoint, x, y,
            (ix, iy) => this.imageToCanvas(ix, iy),
            this.canvas.width, this.canvas.height
          );
          if (handleHit) {
            hover = { type: 'area-handle', waypoint: this.selectedWaypoint, handle: handleHit };
          }
        }

        if (!hover) {
          const waypoint = this.findWaypointAt(x, y);
          if (waypoint) {
            hover = { type: 'waypoint', waypoint };
          }
        }

        if (!hover) {
          const segmentHit = this.findSegmentAt(x, y);
          if (segmentHit) {
            hover = {
              type: segmentHit.onPlus ? 'leg-plus' : 'leg',
              waypoint: segmentHit.waypoint,
              waypointIndex: segmentHit.waypointIndex
            };
          }
        }
      }

      const prev = this.canvasHover;
      const changed = (prev?.type !== hover?.type) ||
                      (prev?.waypoint !== hover?.waypoint) ||
                      (prev?.waypointIndex !== hover?.waypointIndex) ||
                      (prev?.handle?.type !== hover?.handle?.type) ||
                      (prev?.handle?.vertexIndex !== hover?.handle?.vertexIndex);
      if (changed) {
        this.canvasHover = hover;
        this.queueRender();
      }
      if (callback) callback(hover?.type || null);
    });

    /**
     * canvas:hover-clear - Pointer left the canvas or a drag started.
     */
    this.eventBus.on('canvas:hover-clear', () => {
      if (this.canvasHover) {
        this.canvasHover = null;
        this.queueRender();
      }
    });

    /**
     * segment:check-at-position - Leg hit test for clicks (edit mode only;
     * findSegmentAt guards preview itself).
     */
    this.eventBus.on('segment:check-at-position', (pos, callback) => {
      if (callback) callback(this.findSegmentAt(pos.x, pos.y));
    });

    /**
     * segment:clicked - A leg was clicked: select the waypoint that owns
     * it and flash the inspector's Leg card, teaching the ownership rule
     * the card header names ("Leg → Waypoint 3").
     */
    this.eventBus.on('segment:clicked', ({ waypoint }) => {
      if (!waypoint) return;
      this.eventBus.emit('waypoint:selected', waypoint);
      this.eventBus.emit('section:flash', { section: 'leg' });
    });

    /**
     * waypoint:insert-on-leg - The leg midpoint "+" handle: insert a
     * minor waypoint exactly between the leg's endpoints (array index
     * owner+1), positioned on the path midpoint, so the leg gains a
     * shaping point without visually moving. waypoint:added handles
     * undo/path/list/save; the fresh minor becomes the selection (same
     * rule as insert-adjacent).
     */
    this.eventBus.on('waypoint:insert-on-leg', ({ waypointIndex, imgX, imgY }) => {
      const owner = this.waypoints[waypointIndex];
      if (!owner || waypointIndex >= this.waypoints.length - 1) return;

      const newWp = Waypoint.createMinor(imgX, imgY);
      newWp.copyPropertiesFrom(owner);
      this.waypoints.splice(waypointIndex + 1, 0, newWp);

      // Leg geometry changed under the pointer; next mousemove re-tests
      this.canvasHover = null;

      this.eventBus.emit('waypoint:added', newWp);
      this.eventBus.emit('waypoint:selected', newWp);
      this.announce('Minor waypoint added to leg');
    });

    // Help events
    this.eventBus.on('help:toggle', () => {
      if (this.elements.splash.style.display === 'none' || 
          this.elements.splash.style.display === '') {
        this.showSplash();
      } else {
        this.hideSplash();
      }
    });
    
    this.eventBus.on('help:show-shortcuts', () => {
      this.showSplash(); // Consolidated into splash modal with accordion
    });
    
    // ========== WAYPOINT KEYBOARD EVENTS ==========
    
    this.eventBus.on('waypoint:add-at-center', () => {
      // Add waypoint at canvas center (or end of path if waypoints exist)
      const centerX = 0.5;
      const centerY = 0.5;
      this.eventBus.emit('waypoint:add', {
        imgX: centerX,
        imgY: centerY,
        isMajor: true
      });
      this.announce('Waypoint added at center');
    });
    
    this.eventBus.on('waypoint:deselect', () => {
      // `this.selectWaypoint(null)` here threw since the mixin split (no
      // such method survives on the prototype; the bus swallowed the
      // error), so Escape never cleared waypoint selection through this
      // handler. Route through the canonical deselected pipeline.
      if (this.selectedWaypoint) {
        this.eventBus.emit('waypoint:deselected');
        this.announce('Selection cleared');
      }
    });
    
    this.eventBus.on('waypoint:duplicate', () => {
      if (!this.selectedWaypoint) {
        this.announce('No waypoint selected');
        return;
      }
      // Create duplicate offset slightly from original
      const offset = 0.02; // 2% offset
      const newX = Math.min(1, this.selectedWaypoint.imgX + offset);
      const newY = Math.min(1, this.selectedWaypoint.imgY + offset);
      
      this.eventBus.emit('waypoint:add', {
        imgX: newX,
        imgY: newY,
        isMajor: this.selectedWaypoint.isMajor
      });
      this.announce('Waypoint duplicated');
    });
    
    /**
     * waypoint:select-all - Cmd/Ctrl+A selects the whole route as an
     * ordinary multi-select, minors included. (The old handler called a
     * UIController method that never existed — the bus swallowed the
     * TypeError, so Cmd+A was dead until the Phase 4 multi-select work.)
     */
    this.eventBus.on('waypoint:select-all', () => {
      if (this.waypoints.length === 0) return;
      if (this.waypoints.length === 1) {
        this.eventBus.emit('waypoint:selected', this.waypoints[0]);
      } else {
        // Keep the current primary when it's part of the route
        const primary = this.selectedWaypoint && this.waypoints.includes(this.selectedWaypoint)
          ? this.selectedWaypoint
          : this.waypoints[0];
        this.eventBus.emit('waypoint:multi-selected', {
          waypoints: [...this.waypoints],
          primary
        });
      }
      this.announce('All waypoints selected');
    });

    // Generic toast request from components (e.g. shift-delete undo hint)
    this.eventBus.on('ui:toast', ({ message, duration }) => {
      this.showToast(message, duration);
    });
    
    // Path head (route-global) is wired directly in setupEventListeners;
    // the old pathhead:* event pair duplicated every mutation, undo
    // snapshot, and autosave, and forced a second synchronous render
    // per input event (removed 2026-08-18).

    // ========== ZOOM/PAN EVENTS ==========
    
    this.eventBus.on('canvas:zoom-in', () => {
      this.zoomIn();
    });
    
    this.eventBus.on('canvas:zoom-out', () => {
      this.zoomOut();
    });
    
    this.eventBus.on('canvas:zoom-reset', () => {
      this.resetZoom();
    });
    
    // ========== UNDO/REDO EVENTS ==========
    
    this.eventBus.on('undo:state-change', ({ canUndo, canRedo }) => {
      if (this.elements.undoBtn) {
        this.elements.undoBtn.disabled = !canUndo;
      }
      if (this.elements.redoBtn) {
        this.elements.redoBtn.disabled = !canRedo;
      }
    });
    
    // Undo/Redo button click handlers
    this.elements.undoBtn?.addEventListener('click', () => this.undo());
    this.elements.redoBtn?.addEventListener('click', () => this.redo());
    
    // ========== KEYBOARD SHORTCUTS ==========
    // Centralized keyboard handler for global shortcuts
    // Delegates to specific handlers for modularity
    
    document.addEventListener('keydown', (e) => this._handleKeyDown(e));
  }
};
