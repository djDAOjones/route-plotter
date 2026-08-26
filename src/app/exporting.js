/**
 * Video/HTML export flows: export mode enter/exit, exporters, summary UI.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, exportingMixin).
 */
import { VIDEO_EXPORT } from '../config/constants.js';
import { VideoExporter } from '../services/VideoExporter.js';
import { getRetainedBackgroundDataURL } from './persistence.js';

export const exportingMixin = {
  
  /**
   * Enter export mode: temporarily resize canvas to the configured export
   * resolution so that captureStream captures at the correct pixel dimensions.
   *
   * During export the canvas backing store is set to exactly resolutionX × resolutionY
   * with an identity transform (no DPR scaling — 1 drawing unit = 1 export pixel).
   * All dependent systems (CoordinateTransform, vector canvas, reveal masks) adapt
   * automatically because they key off displayWidth / displayHeight.
   *
   * Call _exitExportMode() in a finally block to guarantee restoration.
   *
   * @private
   * @param {number} width  - Export width in pixels (e.g. 1920)
   * @param {number} height - Export height in pixels (e.g. 1080)
   */
  _enterExportMode(width, height) {
    // Round to even dimensions — H.264 requires multiples of 2 (4:2:0 chroma)
    width  = width  & ~1;
    height = height & ~1;

    this._isExportMode = true;

    // Resize backing store to export resolution
    this.canvas.width = width;
    this.canvas.height = height;

    // Identity transform — 1 drawing unit = 1 export pixel (no DPR scaling)
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Update logical dimensions so all coordinate math adapts
    this.displayWidth = width;
    this.displayHeight = height;
    this.coordinateTransform.setCanvasDimensions(width, height);

    // Recalculate image bounds for the new coordinate space
    if (this.background.image) {
      this.updateImageTransform(this.background.image);
    }
    // NOTE: calculatePath() is intentionally NOT called here.
    // Path points are stored in normalized (0-1) coordinates and do not change
    // with canvas dimensions — imageToCanvas handles the mapping at render time.
    // Calling calculatePath would also trigger a debounced duration recalculation
    // based on the (larger) export canvas, incorrectly changing animation speed.

    console.log(`🎬 [ExportMode] Entered: ${width}×${height} (identity transform)`);
  },

  /**
   * Exit export mode: restore the canvas to its display size with DPR scaling.
   * Safe to call even if _enterExportMode was never called (no-op).
   * @private
   */
  _exitExportMode() {
    if (!this._isExportMode) return;
    this._isExportMode = false;

    // updateCanvasAspectRatio resets canvas.width/height, ctx transform,
    // displayWidth/Height, coordinate transform, image bounds, and re-renders
    this.updateCanvasAspectRatio();

    console.log(`🎬 [ExportMode] Exited: restored display resolution`);
  },

  /**
   * Export animation as video file
   * Uses frame-by-frame capture for consistent output regardless of system performance
   * 
   * Process:
   * 1. Validate the export request
   * 2. Pause current playback
   * 3. Resize canvas to export resolution
   * 4. Initialize VideoExporter
   * 5. Step through animation, rendering each frame
   * 6. Capture frames and encode to video
   * 7. Download result
   * 8. Restore canvas to display resolution
   */
  async exportVideo() {
    // Validate we have something to export
    if (this.waypoints.length < 2) {
      alert('Please add at least 2 waypoints before exporting.');
      return;
    }
    
    // Show warning if exporting in Edit mode (non-blocking)
    if (!this.previewMode) {
      this.showExportModeWarning();
    }
    
    // Initialize exporter if needed
    if (!this.videoExporter) {
      this.videoExporter = new VideoExporter(this.canvas, this.eventBus);
    }

    // Export steps the shared engine, so suspend it without changing the
    // user's latched play/pause state or temporary review speed. Progress is
    // captured in timeline space and restored only after the old mode returns.
    const transportState = this.animationEngine.suspendTransport();
    const wasPreviewMode = this.previewMode;
    
    // Disable all export buttons and show progress on the dropdown toggle
    const exportDropdownBtn = document.getElementById('export-dropdown-btn');
    const originalText = exportDropdownBtn.textContent;
    exportDropdownBtn.textContent = 'Exporting... 0%';
    exportDropdownBtn.disabled = true;
    if (this.elements.exportMp4Btn) this.elements.exportMp4Btn.disabled = true;
    if (this.elements.exportWebmBtn) this.elements.exportWebmBtn.disabled = true;
    if (this.elements.exportHtmlBtn) this.elements.exportHtmlBtn.disabled = true;
    
    this.announce('Starting video export — press Esc to cancel');
    
    // Capture-phase Escape handler — cancels export and blocks other keydown listeners
    const onEscapeKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this.videoExporter) {
          this.videoExporter.cancel();
        }
      }
    };
    window.addEventListener('keydown', onEscapeKey, true); // capture phase
    
    // Listen for visibility-aware pause/resume (MediaRecorder fallback only)
    const onExportPaused = () => {
      exportDropdownBtn.textContent = 'Export paused — return to tab';
      this.announce('Video export paused. Return to this tab to resume.');
    };
    const onExportResumed = () => {
      exportDropdownBtn.textContent = 'Exporting...';
      this.announce('Video export resumed');
    };
    this.eventBus.on('video:export-paused', onExportPaused);
    this.eventBus.on('video:export-resumed', onExportResumed);
    
    // Store original background state for path-only export
    const pathOnly = this.exportSettings.pathOnly;
    const originalBackgroundImage = this.background.image;

    try {
      // Use the same mode transition as the UI. Its event chain rebuilds the
      // preview timeline; the explicit invalidation also covers exports that
      // begin while Preview is already selected.
      this._setPreviewMode(true);
      const duration = this.invalidateAnimationTiming();
      if (duration <= 0) {
        alert('Animation duration is zero. Please check your waypoints.');
        return;
      }

      if (pathOnly) {
        // Temporarily hide background for transparent export
        this.background.image = null;
      }

      // Reset reveal mask for fresh export
      this.motionVisibilityService.resetRevealMask();

      // Resize canvas to export resolution so captureStream captures at the
      // correct pixel dimensions (not screen size × DPR)
      this._enterExportMode(this.exportSettings.resolutionX, this.exportSettings.resolutionY);

      const blob = await this.videoExporter.export({
        frameRate: this.exportSettings.frameRate,
        duration: duration,
        format: this.exportSettings.format,
        startBuffer: VIDEO_EXPORT.START_BUFFER_MS,
        
        // Render function called for each frame
        renderFrame: async (progress) => {
          // Seek animation to this progress point
          this.animationEngine.seekToProgress(progress);
          // Render the frame (with or without background based on pathOnly)
          this.render();
        },
        
        // Progress callback
        onProgress: (percent) => {
          exportDropdownBtn.textContent = `Exporting... ${percent}% · Esc to cancel`;
        }
      });
      
      // Download the video
      VideoExporter.downloadBlob(blob);
      this.announce('Video export complete');
      
    } catch (error) {
      if (error.message === 'Export cancelled') {
        console.log('🛑 [Export] Cancelled by user');
        this.announce('Video export cancelled');
      } else {
        console.error('Video export failed:', error);
        alert(`Export failed: ${error.message}`);
        this.announce('Video export failed');
      }
      
    } finally {
      // Clean up listeners
      window.removeEventListener('keydown', onEscapeKey, true);
      this.eventBus.off('video:export-paused', onExportPaused);
      this.eventBus.off('video:export-resumed', onExportResumed);
      
      // Restore canvas to display resolution (must happen before render)
      this._exitExportMode();
      
      // Restore background if it was hidden for path-only export
      if (pathOnly) {
        this.background.image = originalBackgroundImage;
      }

      // Restore the original timeline shape before feeding its timeline
      // progress back into the engine, then restore transport flags and speed.
      this._setPreviewMode(wasPreviewMode);
      this.animationEngine.restoreTransportState(transportState);

      // Restore button state
      exportDropdownBtn.disabled = false;
      exportDropdownBtn.textContent = originalText;
      if (this.elements.exportMp4Btn) this.elements.exportMp4Btn.disabled = false;
      if (this.elements.exportWebmBtn) this.elements.exportWebmBtn.disabled = false;
      if (this.elements.exportHtmlBtn) this.elements.exportHtmlBtn.disabled = false;

      this.queueRender();
    }
  },
  
  /**
   * Export the animation as a self-contained HTML file
   * Creates an interactive player with embedded background and path data
   */
  async exportHTML() {
    // Validate we have something to export
    if (this.waypoints.length < 2) {
      alert('Please add at least 2 waypoints before exporting.');
      return;
    }
    
    if (!this.background.image) {
      alert('Please add a background image before exporting HTML.');
      return;
    }
    
    const duration = this.animationEngine.state.duration;
    if (duration <= 0) {
      alert('Animation duration is zero. Please check your waypoints.');
      return;
    }
    
    // Update button to show progress
    const exportBtn = this.elements.exportHtmlBtn;
    const originalText = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    
    this.announce('Starting HTML export');
    
    try {
      // Standalone exports preserve the exact validated source data URL. Never
      // draw the live image to a canvas or silently change its format/bytes.
      const backgroundDataURL = getRetainedBackgroundDataURL(this, 'exporting HTML');

      // Estimate file size first
      const sizeEstimate = await this.htmlExportService.estimateSize(backgroundDataURL);
      console.log(`📦 Estimated HTML export size: ${sizeEstimate.formatted}`);

      // Phase 5: embed the canonical project snapshot (persistence mixin's
      // single save shape) — the exported PlayerApp rebuilds path, timeline,
      // camera, labels, areas and swarm layers from it with the app's own
      // modules. includeCamera/includeText travel inside exportSettings.
      const blob = await this.htmlExportService.exportHTML({
        projectData: this._buildProjectSnapshot(),
        backgroundDataURL,
        title: 'Route animation'
      });
      
      // Download the HTML file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'route-animation.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      const actualSize = (blob.size / 1024).toFixed(1);
      console.log(`✅ HTML export complete: ${actualSize} KB`);
      this.announce(`HTML export complete (${actualSize} KB)`);
      
    } catch (error) {
      console.error('HTML export failed:', error);
      alert(`Export failed: ${error.message}`);
      this.announce('HTML export failed');
      
    } finally {
      // Restore button state
      exportBtn.disabled = false;
      exportBtn.textContent = originalText;
    }
  },
  
  /**
   * Show export mode warning tooltip when exporting in Edit mode
   * Warning appears near the Edit/Preview toggle and can be dismissed by clicking anywhere
   */
  showExportModeWarning() {
    const warning = document.getElementById('export-mode-warning');
    const modeSwitch = document.getElementById('mode-switch');
    if (!warning || !modeSwitch) return;
    
    // Show warning and highlight mode switch
    warning.classList.add('visible');
    modeSwitch.classList.add('highlight-warning');
    
    // Dismiss handler - click anywhere to dismiss
    const dismissWarning = () => {
      warning.classList.remove('visible');
      modeSwitch.classList.remove('highlight-warning');
      document.removeEventListener('click', dismissWarning);
    };
    
    // Add dismiss listener after a brief delay (so the export click doesn't immediately dismiss)
    setTimeout(() => {
      document.addEventListener('click', dismissWarning);
    }, 100);
    
    console.debug('⚠️ [Export] Showing Edit mode warning');
  },
  
  /**
   * Restore custom images for waypoints from the asset service
   * Called after loading waypoints to hydrate HTMLImageElement references
   */
  async _restoreWaypointCustomImages() {
    let anyRestored = false;
    for (const wp of this.waypoints) {
      if (wp.customImageAssetId) {
        try {
          const img = await this.imageAssetService.getImageElement(wp.customImageAssetId);
          if (img) {
            wp.customImage = img;
            anyRestored = true;
          }
        } catch (err) {
          console.warn(`Failed to restore custom image for waypoint ${wp.id}:`, err);
        }
      }
    }
    // Re-render so restored custom images become visible immediately.
    // This method is async and callers don't await it, so without this
    // the images would only appear on the next user-triggered render.
    if (anyRestored) {
      this.queueRender();
    }
  },
  
  /**
   * Update export summary text near Export button
   * Per UI spec §2.3: Shows resolution, fps, and duration
   * Example: "1920 × 1080 · 25 fps · 8.5 s"
   */
  updateExportSummary() {
    if (!this.elements.exportSummary) return;
    
    const resX = this.exportSettings.resolutionX;
    const resY = this.exportSettings.resolutionY;
    const fps = this.exportSettings.frameRate;
    const durationMs = this.animationEngine.state.duration || 0;
    const durationSec = (durationMs / 1000).toFixed(1);
    
    // Format: "1920 × 1080 · 25 fps · 8.5 s"
    this.elements.exportSummary.textContent = `${resX} × ${resY} · ${fps} fps · ${durationSec} s`;
  }
};
