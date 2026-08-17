/**
 * Camera keyframing UI + camera state evaluation and zoom-transition validation warnings.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, cameraMixin).
 */
import { CameraService, CAMERA_DEFAULTS } from '../services/CameraService.js';

export const cameraMixin = {
  
  /**
   * Update camera controls to reflect the given waypoint's settings.
   * Syncs "This Zoom" slider with waypoint.camera.zoom and "Next Zoom" 
   * slider with the next major waypoint's camera.zoom.
   * 
   * @param {Waypoint} waypoint - The waypoint to update controls for
   * @private
   */
  _updateCameraControls(waypoint) {
    if (!waypoint) return;
    
    // Ensure camera object exists (lazy initialization)
    if (!waypoint.camera) {
      waypoint.camera = { zoom: CAMERA_DEFAULTS.ZOOM, zoomMode: CAMERA_DEFAULTS.ZOOM_MODE };
    }
    
    // Get major waypoints for index lookup (UI only shows major waypoints)
    const majorWps = this.waypoints.filter(wp => wp.isMajor !== false);
    const majorIndex = majorWps.indexOf(waypoint);
    
    // Update "Prev Zoom" display (read-only)
    const prevMajorWp = (majorIndex > 0) ? majorWps[majorIndex - 1] : null;
    if (this.elements.cameraPrevZoomValue) {
      if (prevMajorWp) {
        const prevZoom = prevMajorWp.camera?.zoom ?? CAMERA_DEFAULTS.ZOOM;
        this.elements.cameraPrevZoomValue.textContent = CameraService.formatZoom(prevZoom);
      } else {
        // First waypoint - no previous
        this.elements.cameraPrevZoomValue.textContent = '—';
      }
    }
    
    // Update "This Zoom" slider
    const zoom = waypoint.camera.zoom ?? CAMERA_DEFAULTS.ZOOM;
    const sliderValue = CameraService.zoomToSlider(zoom);
    if (this.elements.cameraZoom) {
      this.elements.cameraZoom.value = sliderValue;
    }
    if (this.elements.cameraZoomValue) {
      this.elements.cameraZoomValue.textContent = CameraService.formatZoom(zoom);
    }
    
    // Update zoom mode dropdown and toggle switch
    const zoomMode = waypoint.camera?.zoomMode ?? CAMERA_DEFAULTS.ZOOM_MODE;
    if (this.elements.cameraZoomMode) {
      this.elements.cameraZoomMode.value = zoomMode;
    }
    // Sync toggle switch state
    if (this.elements.cameraZoomModeToggle) {
      const isContinuous = zoomMode === 'continuous';
      this.elements.cameraZoomModeToggle.setAttribute('aria-checked', isContinuous);
      const labels = this.elements.cameraZoomModeToggle.parentElement?.querySelectorAll('.mode-label');
      labels?.forEach(label => {
        label.classList.toggle('active', label.dataset.value === zoomMode);
      });
    }
    
    // Update "Next Zoom" display (read-only)
    const nextMajorWp = (majorIndex >= 0 && majorIndex < majorWps.length - 1)
      ? majorWps[majorIndex + 1]
      : null;
    
    if (this.elements.cameraNextZoomValue) {
      if (nextMajorWp) {
        const nextZoom = nextMajorWp.camera?.zoom ?? CAMERA_DEFAULTS.ZOOM;
        this.elements.cameraNextZoomValue.textContent = CameraService.formatZoom(nextZoom);
      } else {
        // Last waypoint - no next
        this.elements.cameraNextZoomValue.textContent = '—';
      }
    }
  },
  
  /**
   * Update camera controls visibility based on selection mode.
   * Shows "Selected Zooms" when multiple waypoints are selected,
   * shows "This Zoom" / "Next Zoom" for single selection.
   * 
   * @param {boolean} isMultiSelect - True if multiple waypoints are selected
   * @private
   */
  _updateCameraControlsVisibility(isMultiSelect) {
    if (this.elements.cameraSingleControls) {
      this.elements.cameraSingleControls.style.display = isMultiSelect ? 'none' : 'block';
    }
    if (this.elements.cameraMultiControls) {
      this.elements.cameraMultiControls.style.display = isMultiSelect ? 'block' : 'none';
    }
  },
  
  /**
   * Validate zoom transitions and show UI warnings if rate limit will be triggered
   * Called when zoom values or segment durations change
   */
  validateZoomTransitions() {
    const segmentDurations = this.getSegmentDurations();
    if (!segmentDurations || this.waypoints.length < 2) {
      this._clearZoomWarning();
      return;
    }
    
    // Zoom is keyframed over majors only (see _calculateCameraState), so the
    // rate-limit check must run on major→major transitions with durations
    // aggregated across any minors between them. Checking raw adjacent pairs
    // would warn on short minor sub-segments (4x→1x→4x) that no longer happen.
    // segmentDurations[i] is the time from waypoint i to waypoint i+1.
    const majorWaypoints = [];
    const majorSegmentDurations = [];
    let runningSinceLastMajor = 0;
    this.waypoints.forEach((wp, i) => {
      if (wp.isMajor !== false) {
        // Close the segment from the previous major to this one.
        if (majorWaypoints.length > 0) {
          majorSegmentDurations.push(runningSinceLastMajor);
        }
        majorWaypoints.push(wp);
        runningSinceLastMajor = 0;
      }
      if (i < segmentDurations.length) {
        runningSinceLastMajor += segmentDurations[i] ?? 0;
      }
    });
    
    if (majorWaypoints.length < 2) {
      this._clearZoomWarning();
      return;
    }
    
    const warnings = CameraService.validateZoomTransitions(majorWaypoints, majorSegmentDurations);
    
    if (warnings.length > 0) {
      this._showZoomWarning(warnings);
    } else {
      this._clearZoomWarning();
    }
  },
  
  /**
   * Show zoom rate limit warning in UI
   * @param {Array} warnings - Array of warning objects from CameraService.validateZoomTransitions
   * @private
   */
  _showZoomWarning(warnings) {
    // Build warning message
    const messages = warnings.map(w => {
      const fromLabel = `WP${w.fromWpIndex + 1}`;
      const toLabel = `WP${w.toWpIndex + 1}`;
      const zoomChange = w.fromZoom < w.toZoom 
        ? `${CameraService.formatZoom(w.fromZoom)}→${CameraService.formatZoom(w.toZoom)}`
        : `${CameraService.formatZoom(w.fromZoom)}→${CameraService.formatZoom(w.toZoom)}`;
      const segmentSec = (w.segmentDurationMs / 1000).toFixed(1);
      const requiredSec = (w.requiredDurationMs / 1000).toFixed(1);
      return `${fromLabel}→${toLabel}: zoom ${zoomChange} needs ${requiredSec}s (segment is ${segmentSec}s)`;
    });
    
    const warningText = `⚠️ Zoom rate limited: ${messages.join('; ')}`;
    
    // Show in camera section (create warning element if needed)
    let warningEl = document.getElementById('camera-zoom-warning');
    if (!warningEl) {
      warningEl = document.createElement('div');
      warningEl.id = 'camera-zoom-warning';
      warningEl.className = 'zoom-warning';
      warningEl.style.cssText = 'color: var(--warning-color, #f59e0b); font-size: 0.75rem; margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: var(--warning-bg, rgba(245, 158, 11, 0.1)); border-radius: 4px;';
      
      // Insert after camera controls
      const cameraSection = document.querySelector('.camera-controls') || 
                           this.elements.cameraZoom?.closest('.control-group');
      if (cameraSection) {
        cameraSection.appendChild(warningEl);
      }
    }
    
    warningEl.textContent = warningText;
    warningEl.style.display = 'block';
  },
  
  /**
   * Clear zoom rate limit warning from UI
   * @private
   */
  _clearZoomWarning() {
    const warningEl = document.getElementById('camera-zoom-warning');
    if (warningEl) {
      warningEl.style.display = 'none';
    }
  },

  // NOTE: Rendering methods (getVectorCanvas, renderBackground, renderOverlay, 
  // renderVectorLayerTo, renderLabel, applyLineStyle, drawPathHead, drawBeacon)
  // have been moved to RenderingService for better modularity.
  // The render() method above now delegates to renderingService.render().

  /**
   * Calculate camera state for current animation frame
   * Uses CameraService to interpolate zoom based on per-waypoint settings
   * 
   * @private
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @returns {Object} Camera state {zoom, centerX, centerY, enabled}
   */
  _calculateCameraState(canvasWidth, canvasHeight) {
    // Only apply camera in preview mode, and only when the export "Camera movement" toggle is on.
    // includeCamera=false → identity transform in preview and export (flat, fixed view).
    if (!this.previewMode || !this.exportSettings.includeCamera) {
      return { zoom: 1, centerX: canvasWidth / 2, centerY: canvasHeight / 2, enabled: false };
    }
    
    // Get head position for camera center
    const progress = this.animationEngine.getPathProgress();
    let headPosition = { x: canvasWidth / 2, y: canvasHeight / 2 };
    
    if (this.pathPoints && this.pathPoints.length > 0) {
      const totalPoints = this.pathPoints.length;
      const exactPosition = totalPoints * progress;
      const pointIndex = Math.min(Math.floor(exactPosition), totalPoints - 1);
      const fraction = exactPosition - pointIndex;
      
      if (pointIndex < totalPoints - 1) {
        const p1 = this.pathPoints[pointIndex];
        const p2 = this.pathPoints[pointIndex + 1];
        const normX = p1.x + (p2.x - p1.x) * fraction;
        const normY = p1.y + (p2.y - p1.y) * fraction;
        headPosition = this.imageToCanvas(normX, normY);
      } else {
        const lastPoint = this.pathPoints[totalPoints - 1];
        headPosition = this.imageToCanvas(lastPoint.x, lastPoint.y);
      }
    }
    
    // Keyframe zoom over MAJOR waypoints only — minors shape path geometry,
    // not zoom. Without this, a minor's default camera.zoom=1 injects a 1x
    // keyframe and the zoom dips toward 1x at the minor. The head position
    // (above) still follows the full path, so panning is unaffected.
    const { waypoints: cameraWaypoints, progressValues: cameraProgressValues } =
      CameraService.toMajorKeyframes(this.waypoints, this.getWaypointProgressValues());

    // Calculate camera state using CameraService
    return this.cameraService.calculateCameraState({
      progress,
      waypoints: cameraWaypoints,
      waypointProgressValues: cameraProgressValues,
      headPosition,
      canvasWidth,
      canvasHeight,
      animationDuration: this.animationEngine.state.duration
    });
  }
};
