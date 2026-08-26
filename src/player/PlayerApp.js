/**
 * PlayerApp - headless application core for the exported HTML player.
 *
 * Phase 5 unification: the exported player runs the SAME modules as the app —
 * PlayerCore timeline math (via AnimationEngine), SwarmEngine dots,
 * RenderingService and its child renderers (beacons, areas, labels, dots) —
 * instead of the former hand-written template player with its own mapping
 * copy and delta-time beacons. Play == scrub == export == exported file, by
 * construction (deterministic-timeline mandate, decision-log 2026-08-17).
 *
 * PlayerApp mirrors the RoutePlotter orchestrator shape closely enough to
 * adopt its prototype mixins verbatim (same `this` contract):
 * - pathTimingMixin wholesale — calculatePath / getWaypointProgressValues /
 *   updateAnimationDuration keep their single source, so segment markers,
 *   pause budgets, intro and tail rules can never drift from the app.
 * - Cherry-picked viewport methods (imageToCanvas, visible bounds, image
 *   transform) and cameraMixin._calculateCameraState.
 * Editing-only services (area draw/edit, network edit) stay null; every
 * RenderingService edit layer already guards on previewMode/null.
 *
 * Import discipline: nothing here may reach ImageAssetService (pulls jszip)
 * or the exporting mixin (pulls VideoExporter → mediabunny). Custom image
 * assets hydrate through the bare ImageAsset model instead.
 */

import { EventBus } from '../core/EventBus.js';
import { AnimationEngine } from '../services/AnimationEngine.js';
import { PathCalculator } from '../services/PathCalculator.js';
import { RenderingService } from '../services/RenderingService.js';
import { MotionVisibilityService } from '../services/MotionVisibilityService.js';
import { CameraService } from '../services/CameraService.js';
import { CoordinateTransform } from '../services/CoordinateTransform.js';
import { SwarmEngine } from '../services/SwarmEngine.js';
import { Waypoint } from '../models/Waypoint.js';
import { Scene } from '../models/Scene.js';
import { ImageAsset } from '../models/ImageAsset.js';
import { VIDEO_EXPORT, PATH_VISIBILITY, WAYPOINT_VISIBILITY, BACKGROUND_VISIBILITY, MOTION, RENDERING } from '../config/constants.js';
import { pathTimingMixin } from '../app/pathTiming.js';
import { cameraMixin } from '../app/camera.js';
import { viewportMixin } from '../app/viewport.js';

export class PlayerApp {
  /**
   * @param {HTMLCanvasElement} canvas - Target canvas inside the exported page
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Services — the same instances-per-app shape as RoutePlotter's constructor
    this.eventBus = new EventBus();
    this.coordinateTransform = new CoordinateTransform();
    this.pathCalculator = new PathCalculator();
    this.renderingService = new RenderingService();
    this.animationEngine = new AnimationEngine(this.eventBus);
    this.motionVisibilityService = new MotionVisibilityService();
    this.cameraService = new CameraService();
    this.swarmEngine = new SwarmEngine();

    // Model state (defaults mirror RoutePlotter; hydrate() overlays the export)
    this.waypoints = [];
    this.scene = new Scene();
    this.pathPoints = [];
    this.styles = {};              // fully provided by the embedded project data
    this.background = { image: null, overlay: 0, fit: 'fit' };
    this.motionSettings = {
      pathVisibility: PATH_VISIBILITY.SHOW_ON_PROGRESSION,
      pathTrail: MOTION.PATH_TRAIL_DEFAULT,
      waypointVisibility: WAYPOINT_VISIBILITY.HIDE_BEFORE,
      backgroundVisibility: BACKGROUND_VISIBILITY.ALWAYS_SHOW,
      revealSize: MOTION.SPOTLIGHT_SIZE_DEFAULT,
      revealFeather: MOTION.SPOTLIGHT_FEATHER_DEFAULT,
      aovAngle: MOTION.AOV_ANGLE_DEFAULT,
      aovDistance: MOTION.AOV_DISTANCE_DEFAULT,
      aovDropoff: MOTION.AOV_DROPOFF_DEFAULT
    };
    this.exportSettings = {
      frameRate: VIDEO_EXPORT.DEFAULT_FRAME_RATE,
      resolutionX: 1920,
      resolutionY: 1080,
      backgroundZoom: 100,
      includeCamera: true,
      includeText: true
    };

    // Playback-only presentation state. Editing concepts stay empty/null so the
    // adopted mixins and every RenderingService edit layer take their guarded
    // preview-mode paths.
    this.previewMode = true;
    this.selectedWaypoint = null;
    this.selectedWaypoints = [];
    this.canvasHover = null;
    this.selectedCrowd = null;
    this.networkEditService = null;
    this.areaDrawingService = null;
    this.areaEditService = null;
    this.beaconAnimation = { pulsePhase: 0, ripples: [] };
    this.viewport = { zoom: 1, panX: 0, panY: 0, minZoom: 1, maxZoom: 48 };

    // pathTimingMixin contract: guarded UI writes + caches + render scheduling
    this.elements = {};
    this.renderQueued = false;
    this._waypointProgressCache = null;
    this._segmentLengthsCache = null;
    this._majorWaypointsCache = null;
    this._durationUpdateTimeout = null;
    this._lastDisplayedSecond = -1;

    this.displayWidth = canvas.width;
    this.displayHeight = canvas.height;

    // Custom image assets by id (ImageAsset model only — never ImageAssetService)
    this._assets = new Map();

    /** Hook for the page shell: called as (currentMs, durationMs) whenever the readout should update. */
    this.onTimeDisplay = null;
  }

  /**
   * Hydrate the player from an exported project payload (the coordVersion-9
   * autosave/project shape) plus the decoded background image, then configure
   * the timeline through the app's own pathTiming chain.
   *
   * Order mirrors persistence.loadAutosave: assets → waypoints → scene →
   * styles (path head image) → export/motion settings → path + timeline.
   * @param {Object} data - Embedded project data (coordVersion 9 shape)
   * @param {HTMLImageElement|null} backgroundImage - Decoded background image
   */
  async load(data, backgroundImage) {
    if (Array.isArray(data.imageAssets)) {
      for (const assetData of data.imageAssets) {
        const asset = ImageAsset.fromJSON(assetData);
        this._assets.set(asset.id, asset);
      }
    }

    this.waypoints = (data.waypoints || [])
      .map(wpData => (Waypoint.validate(wpData) ? Waypoint.fromJSON(wpData) : null))
      .filter(wp => wp !== null);

    if (data.scene) {
      this.scene.fromJSON(data.scene);
    }

    this.styles = { ...this.styles, ...data.styles };
    if (data.motionSettings) {
      this.motionSettings = { ...this.motionSettings, ...data.motionSettings };
    }
    if (data.exportSettings) {
      this.exportSettings = { ...this.exportSettings, ...data.exportSettings };
    }
    this.background = {
      image: backgroundImage || null,
      overlay: data.background?.overlay ?? 0,
      fit: data.background?.fit ?? 'fit'
    };
    this.coordinateTransform.setBackgroundZoom(this.exportSettings.backgroundZoom / 100);

    // Custom images must finish decoding before the first frame — the exported
    // page has no later user interaction to trigger a corrective render.
    await this._restoreCustomImages();

    if (data.animationState) {
      if (data.animationState.mode) {
        this.animationEngine.state.mode = data.animationState.mode;
      }
      if (data.animationState.speed) {
        this.animationEngine.state.speed = data.animationState.speed;
      }
      if (data.animationState.duration) {
        this.animationEngine.state.duration = data.animationState.duration;
      }
    }

    // --- Timing space: reproduce the authored timeline exactly. ---
    // Speed is px/s against the on-screen path, so duration and markers
    // depend on canvas dimensions. Compute them ONCE in the app's recorded
    // timing-reference space, exactly as the app had them at export time —
    // the same preservation rule as video export (_enterExportMode never
    // recomputes timing at the export canvas).
    this._timingRef = data.timingReference
      || { width: this.exportSettings.resolutionX, height: this.exportSettings.resolutionY };
    this.displayWidth = this._timingRef.width;
    this.displayHeight = this._timingRef.height;
    this.coordinateTransform.setCanvasDimensions(this._timingRef.width, this._timingRef.height);
    if (this.background.image) {
      this.updateImageTransform(this.background.image);
    }
    if (this.waypoints.length >= 2) {
      this.calculatePath();          // pathTimingMixin — same spline + caches as the app
      // Kill calculatePath's debounced duration recompute: timing must never
      // be re-derived after the render-space switch below.
      clearTimeout(this._durationUpdateTimeout);
      this.updateAnimationDuration(); // markers, pauses, intro, tail, duration
      clearTimeout(this._durationUpdateTimeout);
    }
    this._authoredTimeline = {
      duration: this.animationEngine.state.duration,
      mode: this.animationEngine.state.mode
    };

    // --- Render space: the export resolution, like an exported video frame.
    // pathPoints are normalised, so only the coordinate mapping changes; the
    // engine's timeline (ms values + progress fractions) is untouched.
    this.displayWidth = this.exportSettings.resolutionX;
    this.displayHeight = this.exportSettings.resolutionY;
    this.coordinateTransform.setCanvasDimensions(this.displayWidth, this.displayHeight);
    if (this.background.image) {
      this.updateImageTransform(this.background.image);
    }

    this.animationEngine.reset();
    this._restoreAuthoredTimeline();
    this.resize();
  }

  /**
   * Reset playback to the start. Mirrors the app's `animation:reset` bus
   * handler (wiringBus.js) for renderer state, but instead of recomputing the
   * timeline (which would re-derive it from the CURRENT canvas space), the
   * player restores the authored values captured at load — nothing about the
   * project can change after load, so restore is exact by construction.
   */
  resetPlayback() {
    this.animationEngine.reset();
    this.motionVisibilityService.resetTrailState();
    this.motionVisibilityService.resetRevealMask();
    this.renderingService.resetBeacons();
    this.cameraService.resetRateLimiter?.();
    this._restoreAuthoredTimeline();
  }

  /** AnimationState.reset() clobbers duration and mode; put the authored ones back. */
  _restoreAuthoredTimeline() {
    if (!this._authoredTimeline) return;
    this.animationEngine.state.duration = this._authoredTimeline.duration;
    this.animationEngine.state.mode = this._authoredTimeline.mode;
  }

  /**
   * Fit the canvas into its wrapper at the export aspect ratio and map the
   * fixed render space (export resolution) onto device pixels.
   *
   * The logical coordinate space NEVER changes here — displayWidth/Height
   * stay at the export resolution and the coordinate transform is untouched,
   * so resizing the viewer's window can never re-derive timing or layout
   * (the video-export rule). Only the ctx transform scales the fixed space
   * up or down to the CSS size the window allows.
   */
  resize() {
    const wrapper = this.canvas.parentElement;
    if (!wrapper) return;

    const targetAspect = this.exportSettings.resolutionX / this.exportSettings.resolutionY;
    const availableWidth = wrapper.clientWidth;
    const availableHeight = wrapper.clientHeight;
    if (availableWidth <= 0 || availableHeight <= 0) return;

    const containerAspect = availableWidth / availableHeight;
    let cssWidth, cssHeight;
    if (targetAspect > containerAspect) {
      cssWidth = availableWidth;
      cssHeight = availableWidth / targetAspect;
    } else {
      cssHeight = availableHeight;
      cssWidth = availableHeight * targetAspect;
    }

    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);

    // Device pixels per render-space unit — the whole scene draws in export-
    // resolution coordinates and this transform puts it on screen
    this._renderScale = this.canvas.width / this.exportSettings.resolutionX;
    this.ctx.setTransform(this._renderScale, 0, 0, this._renderScale, 0, 0);
    // Bilinear/bicubic background scaling; nearest-neighbour looks blocky when zoomed
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    this.queueRender();
  }

  /** Start the shared engine loop; the same conditional-render gate as the app's startRenderLoop. */
  start(onFrame = null) {
    let lastProgress = -1;
    let lastWaitingState = false;
    this.animationEngine.start((state) => {
      const progressChanged = Math.abs(state.progress - lastProgress) > 0.0001;
      const waitingChanged = state.isWaitingAtWaypoint !== lastWaitingState;
      const zoomTransitioning = this.cameraService.isZoomTransitioning(this.displayWidth, this.displayHeight);
      if (this.animationEngine.isPlaying() || progressChanged || waitingChanged || zoomTransitioning) {
        if (onFrame) onFrame(state);
        this.render();
        lastProgress = state.progress;
        lastWaitingState = state.isWaitingAtWaypoint;
      }
    });
  }

  /** rAF-batched render, same contract the adopted mixins expect from the app. */
  queueRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  /**
   * Assemble the preview-mode renderState and delegate to RenderingService —
   * the same field set as RoutePlotter.render(), with editing services null.
   */
  render() {
    const cw = this.displayWidth;
    const ch = this.displayHeight;
    if (cw <= 0 || ch <= 0) return;

    const renderState = {
      waypoints: this.waypoints,
      pathPoints: this.pathPoints,
      styles: this.styles,
      selectedWaypoint: null,
      selectedWaypoints: [],
      hover: null,

      scene: this.scene,
      swarmEngine: this.swarmEngine,
      selectedCrowd: null,
      networkEditService: null,

      animationEngine: this.animationEngine,
      beaconAnimation: this.beaconAnimation,

      background: {
        ...this.background,
        zoom: this.exportSettings.backgroundZoom / 100
      },

      viewport: this.viewport,
      imageToCanvas: (x, y, clamp) => this.imageToCanvas(x, y, clamp),
      coordinateTransform: this.coordinateTransform,
      visibleBounds: this.getVisibleBounds(),
      displayWidth: cw,
      displayHeight: ch,

      motionSettings: this.motionSettings,
      previewMode: true,
      // Same rule as the app in preview/export: the toggle blanks all labels
      suppressLabels: !this.exportSettings.includeText,
      motionVisibilityService: this.motionVisibilityService,

      waypointProgressValues: this.getWaypointProgressValues(),
      cameraState: this._calculateCameraState(cw, ch), // cameraMixin cherry-pick
      // Vector layers rasterise at device density: render-space units × this
      // scale = device px (the app passes DPR here; same idea, offline canvas)
      pixelScale: Math.min(this._renderScale || 1, 3),

      areaDrawingService: null,
      areaEditService: null
    };

    this.renderingService.render(this.ctx, cw, ch, renderState);
  }

  /**
   * pathTimingMixin calls this after every duration rebuild; playback wiring
   * calls it per displayed second. Forwards to the page shell's readout hook.
   */
  updateTimeDisplay(currentTime = null, duration = null) {
    if (!this.onTimeDisplay) return;
    const current = currentTime !== null ? currentTime : this.animationEngine.state.currentTime;
    const total = duration !== null ? duration : this.animationEngine.state.duration;
    this.onTimeDisplay(current, total);
  }

  /**
   * Hydrate custom waypoint marker images and the custom path head from the
   * embedded assets. Same recipe as the app's restore, via the ImageAsset
   * model (getImageElement decodes the base64 payload).
   */
  async _restoreCustomImages() {
    for (const wp of this.waypoints) {
      if (wp.customImageAssetId && this._assets.has(wp.customImageAssetId)) {
        try {
          wp.customImage = await this._assets.get(wp.customImageAssetId).getImageElement();
        } catch (err) {
          console.warn(`Failed to restore custom image for waypoint ${wp.id}:`, err);
        }
      }
    }
    const headAssetId = this.styles.pathHead?.imageAssetId;
    if (headAssetId && this._assets.has(headAssetId)) {
      try {
        this.styles.pathHead.image = await this._assets.get(headAssetId).getImageElement();
      } catch (err) {
        console.warn('Failed to restore path head image:', err);
      }
    }
  }
}

// Adopt the app's own method groups (see RoutePlotter in main.js). pathTiming
// comes over wholesale — it is the single source of the timeline handshake.
// viewport and camera contribute only their pure coordinate/camera pieces;
// the rest of those mixins is editor UI the player must not carry.
Object.assign(PlayerApp.prototype, pathTimingMixin);
Object.assign(PlayerApp.prototype, {
  getVisibleImageBounds: viewportMixin.getVisibleImageBounds,
  getVisibleBounds: viewportMixin.getVisibleBounds,
  updateImageTransform: viewportMixin.updateImageTransform,
  imageToCanvas: viewportMixin.imageToCanvas,
  _calculateCameraState: cameraMixin._calculateCameraState
});
