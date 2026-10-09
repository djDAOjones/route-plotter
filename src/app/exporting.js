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
import { measureSceneEnd, settleSavedTiming } from './pathTiming.js';

/**
 * One video export at a time. A request while one runs (a double click on
 * Export MP4, whose codec probe answers later, can ask twice before the
 * buttons are disabled) is refused before it touches anything: its format or
 * size would change the running export's canvas, and its setup and clean-up
 * the running export's mode and buttons (DEF-46). A module helper, so a host
 * that borrows `exportVideo` alone keeps it.
 * @param {Object} app
 * @returns {boolean} Whether an export is running, and the request was refused
 */
export function refuseWhileExporting(app) {
  if (!app._videoExportRunning) return false;
  app.announce('A video export is already running.');
  return true;
}

/**
 * Disable the export controls (the menu's toggle, MP4, WebM, HTML) while an
 * export is the app's; `release()`, when it has let go, enables the toggle
 * and gives each item back the state the project allows it, whatever part of
 * the clean-up failed (DEF-46). The toggle keeps its words throughout: the
 * export's progress is the status line's (UI-06 J-18). A module helper, so a
 * host that borrows `exportVideo` alone keeps it.
 * @param {Object} app
 * @returns {{release: function(): void}}
 */
function holdExportControls(app) {
  const menu = document.getElementById('export-dropdown-btn');
  const buttons = [menu, app.elements?.exportMp4Btn, app.elements?.exportWebmBtn, app.elements?.exportHtmlBtn].filter(Boolean);
  for (const button of buttons) button.disabled = true;
  return {
    release() {
      if (menu) menu.disabled = false;
      if (app.updateExportAvailability) app.updateExportAvailability();
      else for (const button of buttons) button.disabled = false;
    },
  };
}

/**
 * Tell the author an export was refused or failed: a toast the author must
 * hear, where a browser dialog stood (UI-06 B-18). The status line says so too.
 * @param {Object} app
 * @param {string} message
 * @param {string} [status]
 */
function refuseExport(app, message, status = 'Export not started') {
  app.setStatus?.(status);
  app.eventBus.emit('ui:toast', { message, priority: 'assertive' });
}

const VIDEO_REASON = 'Export MP4 and WebM need at least 2 waypoints.';
const FORMAT_LABELS = { mp4: 'MP4', webm: 'WebM' };

/** Write a reason span's words: the author is reading them. */
function setReason(span, text) {
  if (span) span.textContent = text;
}

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
   * @param {{format?: string, resolution?: {width: number, height: number}}} [request] -
   *   The format and size to export at, if not the ones set: applied once the
   *   export is this app's, so no request made meanwhile can change them
   */
  async exportVideo({ format, resolution } = {}) {
    if (refuseWhileExporting(this)) return;
    // The export is this app's from here to the end of its clean-up. What it
    // does on the way can call back at once (closing a codec dialog gives
    // focus back; a size, a mode or a seek emits; the download clicks a
    // link), and a request made then is refused, not run inside this one;
    // the export controls hear of it first, so Export MP4 starts no probe
    // meanwhile. It is let go last, even if the clean-up throws, and the
    // controls with it, so no later export is refused for good (DEF-46).
    this._videoExportRunning = true;
    let controls = null;
    try {
      this.uiController?.exportRunning?.(true);
      // This is the export the author now asks for, by whatever route: a codec
      // probe or dialog from an earlier request asks for nothing.
      this.uiController?.exportRequested?.();
      // The export controls disabled while it is the app's (closing a codec
      // dialog, just now, gave focus back to one of them first).
      controls = holdExportControls(this);
      // The size and format asked for with it, now that no other can start.
      if (resolution) this.eventBus.emit('video:resolution-change', resolution);
      if (format) this.exportSettings.format = format;

      // Validate we have something to export (the items are disabled meanwhile;
      // a request by another route is refused the same way, UI-06 B-18)
      if (this.waypoints.length < 2) {
        refuseExport(this, VIDEO_REASON);
        return;
      }

      // Initialize exporter if needed
      if (!this.videoExporter) {
        this.videoExporter = new VideoExporter(this.canvas, this.eventBus);
      }

      // Progress goes to the status line, an enabled element in the header,
      // never into the disabled toggle (UI-06 J-18)
      const label = FORMAT_LABELS[this.exportSettings.format] ?? String(this.exportSettings.format ?? '').toUpperCase();
      let percent = 0;
      const showProgress = () => this.setStatus?.(`Exporting ${label} ${percent}% · Esc to cancel`);
      showProgress();
      // Heard at 25, 50 and 75 %, once each, in the line's words (the owner,
      // 2026-10-09); progress that jumps is heard at the furthest mark passed.
      // It is this export's: what of it still waits is withdrawn when the
      // export ends, however it ends, so none is read after (Codex r2).
      let spokenMark = 0;
      const progressKey = Symbol('this export\'s progress');
      const speakProgress = () => {
        const mark = VIDEO_EXPORT.SPOKEN_PROGRESS.filter(each => percent >= each).at(-1) ?? 0;
        if (mark <= spokenMark) return;
        spokenMark = mark;
        this.announce(`Exporting ${label} ${mark}%`, 'polite', { key: progressKey });
      };
      // Before the end is said, so the end never waits behind, or pushes out a
      // message for, progress that is over.
      const endProgress = () => this.withdrawAnnouncements?.(progressKey);

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
      // Visibility-aware pause/resume (MediaRecorder fallback only)
      const onExportPaused = () => {
        this.setStatus?.('Export paused — return to this tab');
        this.announce('Video export paused. Return to this tab to resume.');
      };
      const onExportResumed = () => {
        showProgress();
        this.announce('Video export resumed');
      };

      // Store original background state for path-only export
      const pathOnly = this.exportSettings.pathOnly;
      const originalBackgroundImage = this.background.image;
      const wasPreviewMode = this.previewMode;

      // Export steps the shared engine, so suspend it without changing the
      // user's latched play/pause state or temporary review speed. Progress is
      // captured in timeline space and restored only after the old mode returns.
      // From here every change is put back, each part whether or not another
      // part of the putting back fails.
      const transportState = this.animationEngine.suspendTransport();
      try {
        this.announce('Starting video export — press Esc to cancel');
        window.addEventListener('keydown', onEscapeKey, true); // capture phase
        this.eventBus.on('video:export-paused', onExportPaused);
        this.eventBus.on('video:export-resumed', onExportResumed);

        // Use the same mode transition as the UI. Its event chain rebuilds the
        // preview timeline; the explicit invalidation also covers exports that
        // begin while Preview is already selected.
        this._setPreviewMode(true);
        let duration = this.invalidateAnimationTiming();
        if (duration <= 0) {
          refuseExport(this, 'Nothing to export: the animation has no duration.');
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
        // The scene's end, measured again in the space the export draws in
        // (CROWD-05): a crowd bound to a route moment reads that moment there,
        // so its dots finish where the export draws them finish. The base is
        // kept; the editor's end is measured back after the export.
        duration = measureSceneEnd(this);

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
          onProgress: (done) => {
            percent = done;
            showProgress();
            speakProgress();
          }
        });

        // Download the video
        VideoExporter.downloadBlob(blob);
        endProgress();
        this.setStatus?.('Export complete');
        this.announce('Video export complete');

      } catch (error) {
        endProgress();
        if (error.message === 'Export cancelled') {
          console.log('🛑 [Export] Cancelled by user');
          this.setStatus?.('Export cancelled');
          this.announce('Video export cancelled');
        } else {
          console.error('Video export failed:', error);
          refuseExport(this, `Export failed: ${error.message}`, 'Export failed');
        }

      } finally {
        const failures = [];
        const putBack = (step) => {
          try {
            step();
          } catch (error) {
            failures.push(error);
          }
        };
        // Clean up listeners
        putBack(() => window.removeEventListener('keydown', onEscapeKey, true));
        putBack(() => this.eventBus.off('video:export-paused', onExportPaused));
        putBack(() => this.eventBus.off('video:export-resumed', onExportResumed));
        // Restore background if it was hidden for path-only export: before the
        // display size, which places the image on the canvas, and, with the
        // image hidden, left the place it had at the size the export began
        // with, stale after a size chosen during the export (DEF-53).
        putBack(() => {
          if (pathOnly) this.background.image = originalBackgroundImage;
        });
        // Restore canvas to display resolution (must happen before render)
        putBack(() => this._exitExportMode());
        // Restore the original timeline shape before feeding its timeline
        // progress back into the engine, then restore transport flags and speed.
        putBack(() => this._setPreviewMode(wasPreviewMode));
        // The editor's end, in the editor's space, before its timeline
        // progress is fed back (CROWD-05), however the export ended.
        putBack(() => measureSceneEnd(this));
        putBack(() => this.animationEngine.restoreTransportState(transportState));
        putBack(() => this.queueRender());
        if (failures.length > 0) {
          throw failures.length === 1 ? failures[0] : new AggregateError(failures, 'The display could not be put back in full after the export');
        }
      }
    } finally {
      this._videoExportRunning = false;
      controls?.release();
      this.uiController?.exportRunning?.(false);
    }
  },
  
  /**
   * Export the animation as a self-contained HTML file
   * Creates an interactive player with embedded background and path data
   */
  async exportHTML() {
    // Validate we have something to export (the item is disabled meanwhile;
    // a request by another route is refused the same way, UI-06 B-18)
    if (this.waypoints.length < 2) {
      refuseExport(this, 'Export HTML needs at least 2 waypoints.');
      return;
    }
    
    if (!this.background.image) {
      refuseExport(this, 'Export HTML needs a background image.');
      return;
    }
    
    const duration = this.animationEngine.state.duration;
    if (duration <= 0) {
      refuseExport(this, 'Nothing to export: the animation has no duration.');
      return;
    }
    
    // The item is disabled while it works; the progress is the status
    // line's, not words written into a closed menu (UI-06 J-07, J-18)
    const exportBtn = this.elements.exportHtmlBtn;
    if (exportBtn) exportBtn.disabled = true;
    this.setStatus?.('Exporting HTML…');
    
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
      settleSavedTiming(this);
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
      this.setStatus?.('Export complete');
      this.announce(`HTML export complete (${actualSize} KB)`);
      
    } catch (error) {
      console.error('HTML export failed:', error);
      refuseExport(this, `Export failed: ${error.message}`, 'Export failed');
      
    } finally {
      // The item gets back the state the project allows it
      this.updateExportAvailability();
    }
  },

  /**
   * Disable the export items that cannot work, each described by a reason
   * line under them (UI-06 B-18): MP4 and WebM need a route of two; HTML a
   * background as well. Called on every route change and background change,
   * and once an export has let the controls go. The names never change with
   * the state (J-21): the reason is the description.
   */
  updateExportAvailability() {
    const { exportMp4Btn, exportWebmBtn, exportHtmlBtn } = this.elements ?? {};
    const few = this.waypoints.length < 2;
    const noBackground = !this.background?.image;
    const running = Boolean(this._videoExportRunning);
    for (const item of [exportMp4Btn, exportWebmBtn]) if (item) item.disabled = running || few;
    if (exportHtmlBtn) exportHtmlBtn.disabled = running || few || noBackground;
    const videoReason = document.getElementById('export-video-reason');
    const htmlReason = document.getElementById('export-html-reason');
    setReason(videoReason, few ? VIDEO_REASON : '');
    setReason(htmlReason, few && noBackground ? 'Export HTML needs at least 2 waypoints and a background image.'
      : few ? 'Export HTML needs at least 2 waypoints.'
        : noBackground ? 'Export HTML needs a background image.' : '');
    const line = document.getElementById('export-menu-reason');
    if (line) line.hidden = !(videoReason?.textContent || htmlReason?.textContent);
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
