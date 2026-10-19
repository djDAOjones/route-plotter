/**
 * Route Plotter v3 - Main Application Entry Point
 * 
 * ## Version Management
 * 
 * APP_VERSION is injected at build time via esbuild's define feature.
 * Format: major.minor.build (e.g., "3.1.76")
 * 
 * Sources:
 * - package.json: major.minor (manually updated)
 * - version.json: build number (auto-incremented on every build)
 * 
 * Increment Guidelines:
 * - major: Breaking changes, major rewrites (v2 → v3)
 * - minor: New features, significant improvements (v3.0 → v3.1)
 * - build: Auto-incremented on every build (v3.1.75 → v3.1.76)
 * 
 * See build.js for implementation details.
 */
console.log(`🚀 Route Plotter v${APP_VERSION} loaded`);

// Update page title and header with version on load
document.addEventListener('DOMContentLoaded', () => {
  document.title = `Route Plotter v${APP_VERSION}`;
  const h1 = document.getElementById('app-title');
  // No title: Help shows the version, by keyboard too (UI-06 G-10)
  if (h1) h1.textContent = 'Route Plotter';
});

// Import modular utilities
import { getFinishContexts } from './app/finishContexts.js';
import { RENDERING, ANIMATION, VIDEO_EXPORT, MOTION, PATH_VISIBILITY, WAYPOINT_VISIBILITY, BACKGROUND_VISIBILITY } from './config/constants.js';
import { Scene } from './models/Scene.js';
import { MotionVisibilityService } from './services/MotionVisibilityService.js';
import { formatRendererPixels, setRangeReadout } from './utils/uiReadouts.js';
import { StorageService } from './services/StorageService.js';
import { CoordinateTransform } from './services/CoordinateTransform.js';
import { PathCalculator } from './services/PathCalculator.js';
import { AnimationEngine } from './services/AnimationEngine.js';
import { RenderingService } from './services/RenderingService.js';
import { SwarmEngine } from './services/SwarmEngine.js';
import { EventBus } from './core/EventBus.js';
import { UIController } from './controllers/UIController.js';
import { InteractionHandler } from './handlers/InteractionHandler.js';
import { getSplashHelpHTML } from './config/helpContent.js';
import { UndoService } from './services/UndoService.js';
import { SectionController } from './controllers/SectionController.js';
import { AreaDrawingService } from './services/AreaDrawingService.js';
import { NetworkEditService } from './services/NetworkEditService.js';
import { AreaEditService } from './services/AreaEditService.js';
import { getInlineHelpHTML } from './config/helpContent.js';
import { attachSwatchPickers } from './components/SwatchPicker.js';
import { ModeBanner } from './components/ModeBanner.js';
import { attachAllTooltips } from './components/Tooltip.js';
import { initParamTooltips } from './components/ParamTooltip.js';
import { initAllDropdowns } from './components/Dropdown.js';
import { CameraService } from './services/CameraService.js';
import { ImageAssetService } from './services/ImageAssetService.js';
import { ImageAsset } from './models/ImageAsset.js';
import { HTMLExportService } from './services/HTMLExportService.js';

// RoutePlotter prototype mixins (Phase 1 split) — attached below the class.
import { wiringDomMixin } from './app/wiringDom.js';
import { wiringBusMixin } from './app/wiringBus.js';
import { wiringControllersMixin } from './app/wiringControllers.js';
import { undoRedoMixin } from './app/undoRedo.js';
import { playbackMixin } from './app/playback.js';
import { cameraMixin } from './app/camera.js';
import { viewportMixin } from './app/viewport.js';
import { pathTimingMixin } from './app/pathTiming.js';
import { persistenceMixin } from './app/persistence.js';
import { exportingMixin } from './app/exporting.js';
import { editorPanelMixin } from './app/editorPanel.js';
import { pointerMixin } from './app/pointer.js';
import { crowdsMixin } from './app/crowds.js';
import { crowdWaitingMixin } from './app/crowdWaiting.js';
import { networkMixin } from './app/network.js';
import { sceneOutlineMixin } from './app/sceneOutline.js';
import { privacyMixin } from './app/privacy.js';
import { helpDialogMixin } from './app/helpDialog.js';
import { restoreStartupProject } from './app/startup.js';
import { setupUnrestoredNotice } from './app/unrestoredAutosave.js';
import { loadExampleBackground } from './app/backgroundLoading.js';
import { isMac } from './config/keybindings.js';
import { clearProject } from './app/projectReset.js';
import { pathHeadStyleUsesImageControls } from './utils/pathHeadPresets.js';
import { boundEntryWaypointIds } from './utils/routeAnchors.js';
import { createAnnouncementQueue } from './utils/announcementQueue.js';
import { focusLands } from './utils/focusTrap.js';
import { createRecoveryImageStore } from './services/RecoveryImageStore.js';
import { stopRecoveryImages } from './app/recoveryImages.js';

/** Toasts on their way out, which focus is never given to (UI-06 B-35). */
const leavingToasts = new WeakSet();

/** The gap between the toasts and what they stand above: `--space-2`, the stylesheet's (UI-06 J-12). */
const TOAST_GAP_PX = 8;

/**
 * Where the toast stack stands where the transport is in the page's flow
 * (UI-06 J-12; Codex r2 on 753f93f, 2). Its bottom is `lift` px, plus the
 * gap, above the viewport's: 0 is the viewport's bottom, the viewport's
 * height less the controls' top just above them. It covers none of the
 * controls in view: wholly above them where the room between their top and
 * the viewport's takes it; else wholly below them, at the viewport's bottom,
 * where the room under them does, or they are out of view; else capped
 * (`room`) to the larger of the two rooms, below them where neither has any.
 * With them out of view, a stack taller than the viewport less its gap is
 * capped to that (Codex r3 on bc2d3a4, 4: it ran off the viewport's top).
 * @param {{top: number, bottom: number}} controls - Their edges, in the viewport
 * @param {number} height - The stack's own height
 * @param {number} viewport - The viewport's height
 * @returns {{lift: number, room: (number|null)}} room: the cap, null for none
 */
function toastPlacement({ top, bottom }, height, viewport) {
  if (bottom <= 0 || top >= viewport) {
    const room = Math.max(0, viewport - TOAST_GAP_PX);
    return { lift: 0, room: height <= room ? null : room };
  }
  const above = { lift: viewport - top, room: Math.max(0, top - TOAST_GAP_PX) };
  const below = { lift: 0, room: Math.max(0, viewport - bottom - 2 * TOAST_GAP_PX) };
  if (height <= above.room) return { lift: above.lift, room: null };
  if (height <= below.room) return { lift: below.lift, room: null };
  const side = above.room > below.room ? above : below;
  return { lift: side.lift, room: side.room };
}

// Main application class for Route Plotter v3
class RoutePlotter {
  constructor() {
    this.appVersion = APP_VERSION;

    // Services
    this.storageService = new StorageService();
    this.storageService.attachLifecycle(window);
    // The images browser recovery keeps (DEF-98): made before start-up, whose
    // restore reads them.
    this.recoveryImageStore = createRecoveryImageStore();
    this.coordinateTransform = new CoordinateTransform();
    this.pathCalculator = new PathCalculator(); // Catmull-Rom + corner-slowing reparam, main thread
    this.renderingService = new RenderingService();
    this.eventBus = new EventBus(); // Event-driven architecture for decoupled communication
    this.animationEngine = new AnimationEngine(this.eventBus); // Animation loop management
    this.videoExporter = null; // Initialized after canvas is available
    this.motionVisibilityService = new MotionVisibilityService(); // Motion visibility calculations
    this.undoService = new UndoService(this.eventBus); // Undo/redo with 150-step history
    this._undoDebounceTimer = null; // Timer for debounced undo saves (sliders, arrow keys)
    this.cameraService = new CameraService(); // Camera zoom/pan effects
    this.imageAssetService = new ImageAssetService(); // Custom image asset management
    this.htmlExportService = new HTMLExportService(); // HTML export for interactive animations
    
    // JKL playback state (video editor style controls)
    this._jklSpeedMultiplier = 1; // Current speed multiplier (1, 2, 4, 8, 16)
    this._jklDirection = 0; // -1 = reverse, 0 = stopped, 1 = forward
    
    // Video export settings
    this.exportSettings = {
      frameRate: VIDEO_EXPORT.DEFAULT_FRAME_RATE,
      format: 'mp4',    // 'mp4' (H.264, fast) or 'webm' (VP9, supports transparency)
      pathOnly: false,  // false = with image, true = path only (transparent)
      resolutionX: 1920,  // Export width in pixels
      resolutionY: 1080,  // Export height in pixels
      backgroundZoom: 100, // Background zoom percentage (100 = no zoom)
      includeCamera: true, // false = preview/export ignore per-waypoint camera zoom/pan (flat view)
      includeText: true    // false = preview/export omit waypoint text labels
    };
    
    // Motion visibility settings (affects preview mode and export)
    // Defaults: path reveals as you progress, waypoints appear when reached
    this.motionSettings = {
      pathVisibility: PATH_VISIBILITY.SHOW_ON_PROGRESSION,
      pathTrail: MOTION.PATH_TRAIL_DEFAULT,
      waypointVisibility: WAYPOINT_VISIBILITY.HIDE_BEFORE,
      backgroundVisibility: BACKGROUND_VISIBILITY.ALWAYS_SHOW,
      revealSize: MOTION.SPOTLIGHT_SIZE_DEFAULT,
      revealFeather: MOTION.SPOTLIGHT_FEATHER_DEFAULT,
      revealTrail: MOTION.SPOTLIGHT_TRAIL_DEFAULT,
      // Angle of View settings
      aovAngle: MOTION.AOV_ANGLE_DEFAULT,
      aovDistance: MOTION.AOV_DISTANCE_DEFAULT,
      aovDropoff: MOTION.AOV_DROPOFF_DEFAULT
    };
    
    // Preview mode: false = edit mode (everything visible), true = apply motion settings
    // Default to preview mode for debugging
    this.previewMode = true;
    
    // Unsaved changes indicator (per UI spec §2.1)
    this._isDirty = false;
    this._editRevision = 0;
    this._projectGeneration = 0;
    this._asyncProjectOperations = new Map();
    
    // Render optimization - batch multiple render requests into single frame
    this.renderQueued = false;
    
    // Batch mode for loading operations (prevents redundant calculations)
    this._batchMode = false;
    
    // Performance optimizations for Phase 7
    this._lastDisplayedSecond = -1; // Throttle time display updates
    this._majorWaypointsCache = null; // Cache major waypoint positions
    this._durationUpdateTimeout = null; // Debounce duration calculations
    
    // DOM Elements
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Waypoints and path data
    this.waypoints = []; // Will hold Waypoint model instances
    this.waypointsById = new Map(); // O(1) lookup by waypoint ID
    this.scene = new Scene(); // Flow layers (guide graphs + emitters), drawn beneath the hero route
    this.swarmEngine = new SwarmEngine(); // Deterministic dot evaluator — pure fn(timelineMs, layer, seed)
    this.pathPoints = [];
    // Stable project-owned visual sizing space. Seeded from the first authored
    // canvas, or replaced transactionally when an existing project loads.
    this.renderReference = null;
    this.selectedWaypoint = null; // Primary selection (last interacted)
    this.selectedWaypoints = []; // Full selection in route order — [wp] when single, [] when none
    this.canvasHover = null; // Idle-hover target for canvas affordances (edit mode)
    this.selectedCrowd = null; // Selected crowd layer (FlowLayer) — Crowd scope
    this.isDragging = false;
    this.hasDragged = false; // Track if mouse actually moved during drag
    this.dragOffset = { x: 0, y: 0 };
    
    // Animation state now managed by AnimationEngine service
    // Access via: this.animationEngine.state
    
    // Style settings
    this.styles = {
      pathColor: '#D55E00', // Okabe-Ito Vermillion (palette color)
      pathThickness: 3,
      pathStyle: 'solid', // solid, dashed, dotted
      pathShape: 'line', // line, squiggle, randomised
      markerStyle: 'dot', // dot, square, flag, none
      dotColor: '#D55E00', // Okabe-Ito Vermillion (palette color)
      dotSize: RENDERING.DEFAULT_DOT_SIZE,
      beaconStyle: 'none', // none, ripple, glow, pop, grow, pulse
      // Note: beaconColor removed - beacons now use marker color (dotColor)
      labelMode: 'fade-up', // off, on, fade-up, fade-up-down
      pathHead: {
        style: 'arrow', // dot, arrow, drone, custom, none
        color: '#111111',
        size: 8,
        image: null, // Decoded built-in preset or custom image
        imageAssetId: null, // Asset ID for deduplication
        rotationMode: 'auto', // 'auto' follows path direction, 'fixed' stays upright
        rotationOffset: 0 // Degrees offset added to rotation
      },
      graphicsScale: 1, // Global multiplier for all vector element sizes (0.25–4×)
      showPathCasing: true, // White outline behind path for contrast on busy backgrounds
      // Optional soft halo beneath the path (intensity 0–1; mirrors RENDERING.PATH_GLOW_DEFAULT_INTENSITY)
      pathGlow: { enabled: false, intensity: 0.5 },
      // How long the animation carries on after everything that finishes has
      // finished (CROWD-06): a new project's; one saved without it holds none
      holdAtEndMs: ANIMATION.HOLD_AT_END_DEFAULT_MS
    };
    
    // Beacon animation state
    this.beaconAnimation = {
      pulsePhase: 0,
      ripples: []
    };
    
    // Background layer state
    this.background = {
      image: null,
      overlay: 0,        // -100 (black) .. 0 (none) .. 100 (white)
      fit: 'fit'         // 'fit' | 'fill'
    };
    
    // Zoom/pan state for canvas navigation
    // Zoom levels: 1x → 48x (1.5× steps)
    this.viewport = {
      zoom: 1,           // Current zoom level (1-48)
      panX: 0,           // Pan offset in canvas pixels
      panY: 0,           // Pan offset in canvas pixels
      minZoom: 1,
      maxZoom: 48
    };
    
    // Offscreen canvas for vector layer compositing
    this.vectorCanvas = null;
    
    // Label management
    this.labels = {
      active: [],       // Currently visible labels
      fadeTime: RENDERING.LABEL_FADE_TIME    // Fade duration in ms for 'fade' mode
    };
    
    // UI Elements
    this.elements = {
      canvas: document.getElementById('canvas'),
      // Section elements (replaced tabs)
      settingsSections: document.getElementById('settings-sections'),
      settingsHelpPlaceholder: document.getElementById('settings-help-placeholder'),
      editingSubheading: document.getElementById('editing-subheading'),
      editingName: document.getElementById('editing-name'),
      waypointList: document.getElementById('waypoint-list'),
      bgUploadBtn: document.getElementById('bg-upload-btn'),
      bgUpload: document.getElementById('bg-upload'),
      bgOverlay: document.getElementById('bg-overlay'),
      bgOverlayValue: document.getElementById('bg-overlay-value'),
      bgFitToggle: document.getElementById('bg-fit-toggle'),
      playBtn: document.getElementById('play-btn'),
      pauseBtn: document.getElementById('pause-btn'),
      skipStartBtn: document.getElementById('skip-start-btn'),
      skipEndBtn: document.getElementById('skip-end-btn'),
      timelineSlider: document.getElementById('timeline-slider'),
      currentTime: document.getElementById('current-time'),
      totalTime: document.getElementById('total-time'),
      // animationMode: document.getElementById('animation-mode'), // Removed from UI
      animationSpeed: document.getElementById('animation-speed'),
      animationSpeedValue: document.getElementById('animation-speed-value'),
      // Right sidebar Duration control (synced with left sidebar)
      animationSpeedRight: document.getElementById('animation-speed-right'),
      animationSpeedValueRight: document.getElementById('animation-speed-value-right'),
      // What makes up the Duration when the scene runs past the route (CROWD-05)
      durationBreakdown: document.getElementById('pacing-duration-breakdown'),
      // Hold at end (CROWD-06)
      holdAtEnd: document.getElementById('hold-at-end'),
      holdAtEndValue: document.getElementById('hold-at-end-value'),
      speedControl: document.getElementById('speed-control'),
      // durationControl: document.getElementById('duration-control'), // Removed from UI
      // Note: waypointEditor and waypointEditorPlaceholder removed - now using collapsible sections
      waypointPauseTime: document.getElementById('waypoint-pause-time'),
      waypointPauseTimeValue: document.getElementById('waypoint-pause-time-value'),
      pauseTimeControl: document.getElementById('pause-time-control'),
      waypointSegmentSpeed: document.getElementById('waypoint-segment-speed'),
      waypointSegmentSpeedValue: document.getElementById('waypoint-segment-speed-value'),
      segmentSpeedControl: document.getElementById('segment-speed-control'),
      splash: document.getElementById('splash'),
      splashClose: document.getElementById('splash-close'),
      splashCloseX: document.getElementById('splash-close-x'), // MOD-01
      segmentColor: document.getElementById('segment-color'),
      segmentWidth: document.getElementById('segment-width'),
      segmentWidthValue: document.getElementById('segment-width-value'),
      segmentStyle: document.getElementById('segment-style'),
      dotColor: document.getElementById('dot-color'),
      dotSize: document.getElementById('dot-size'),
      dotSizeValue: document.getElementById('dot-size-value'),
      markerStyle: document.getElementById('marker-style'),
      pathShape: document.getElementById('path-shape'),
      shapeParamsControls: document.getElementById('shape-params-controls'),
      shapeAmplitude: document.getElementById('shape-amplitude'),
      shapeAmplitudeValue: document.getElementById('shape-amplitude-value'),
      shapeFrequency: document.getElementById('shape-frequency'),
      shapeFrequencyValue: document.getElementById('shape-frequency-value'),
      editorBeaconStyle: document.getElementById('editor-beacon-style'),
      waypointLabel: document.getElementById('waypoint-label'),
      labelMode: document.getElementById('label-mode'),
      labelSize: document.getElementById('label-size'),
      labelSizeValue: document.getElementById('label-size-value'),
      labelSizeWarning: document.getElementById('label-size-warning'),
      labelColor: document.getElementById('label-color'),
      labelBgColor: document.getElementById('label-bg-color'),
      labelBgOpacity: document.getElementById('label-bg-opacity'),
      labelBgOpacityValue: document.getElementById('label-bg-opacity-value'),
      labelWidth: document.getElementById('label-width'),
      labelWidthValue: document.getElementById('label-width-value'),
      labelOffsetX: document.getElementById('label-offset-x'),
      labelOffsetXValue: document.getElementById('label-offset-x-value'),
      labelOffsetY: document.getElementById('label-offset-y'),
      labelOffsetYValue: document.getElementById('label-offset-y-value'),
      labelAutoPosition: document.getElementById('label-auto-position'),
      helpBtn: document.getElementById('help-btn'),
      clearBtn: document.getElementById('clear-btn'),
      exportMp4Btn: document.getElementById('export-mp4-btn'),
      exportWebmBtn: document.getElementById('export-webm-btn'),
      exportHtmlBtn: document.getElementById('export-html-btn'),
      exportSummary: document.getElementById('export-summary'),
      // Save/Load controls (removed old JSON save/load, now using ZIP-based project save/load)
      exportFrameRate: document.getElementById('export-frame-rate'),
      exportIncludeImage: document.getElementById('export-include-image'),
      exportIncludeCamera: document.getElementById('export-include-camera'),
      exportIncludeText: document.getElementById('export-include-text'),
      exportResX: document.getElementById('export-res-x'),
      exportResY: document.getElementById('export-res-y'),
      presetBtnNative: document.getElementById('preset-native'),
      presetBtn16_9: document.getElementById('preset-16-9'),
      presetBtn1_1: document.getElementById('preset-1-1'),
      presetBtn9_16: document.getElementById('preset-9-16'),
      backgroundZoom: document.getElementById('background-zoom'),
      backgroundZoomValue: document.getElementById('background-zoom-value'),
      // Camera controls
      cameraZoom: document.getElementById('camera-zoom'),
      cameraZoomValue: document.getElementById('camera-zoom-value'),
      cameraZoomMode: document.getElementById('camera-zoom-mode'),
      cameraPrevZoomValue: document.getElementById('camera-prev-zoom-value'),
      cameraNextZoomValue: document.getElementById('camera-next-zoom-value'),
      // Camera multi-select controls
      cameraSingleControls: document.getElementById('camera-single-controls'),
      cameraMultiControls: document.getElementById('camera-multi-controls'),
      cameraSelectedZoom: document.getElementById('camera-selected-zoom'),
      cameraSelectedZoomValue: document.getElementById('camera-selected-zoom-value'),
      // Mode switch elements (header) - toggle switch style
      modeToggleBtn: document.getElementById('mode-toggle-btn'),
      modeLabelEdit: document.querySelector('.mode-label-edit'),
      modeLabelPreview: document.querySelector('.mode-label-preview'),
      // Toast container
      toastContainer: document.getElementById('toast-container'),
      // The one banner slot below the header (UI-06 J-12)
      modeBanner: document.getElementById('mode-banner'),
      // Preview mode's badge, on the canvas's own corner: shown in Preview alone (UI-06 J-12, Codex r1 2)
      previewBadge: document.getElementById('preview-badge'),
      // Ripple controls
      rippleControls: document.getElementById('ripple-controls'),
      rippleThickness: document.getElementById('ripple-thickness'),
      rippleThicknessValue: document.getElementById('ripple-thickness-value'),
      rippleMaxScale: document.getElementById('ripple-max-scale'),
      rippleMaxScaleValue: document.getElementById('ripple-max-scale-value'),
      rippleWait: document.getElementById('ripple-wait'),
      // Pulse controls
      pulseControls: document.getElementById('pulse-controls'),
      pulseAmplitude: document.getElementById('pulse-amplitude'),
      pulseAmplitudeValue: document.getElementById('pulse-amplitude-value'),
      pulseCycleSpeed: document.getElementById('pulse-cycle-speed'),
      pulseCycleSpeedValue: document.getElementById('pulse-cycle-speed-value'),
      // Motion visibility elements
      pathVisibility: document.getElementById('path-visibility'),
      pathTrail: document.getElementById('path-trail'),
      pathTrailValue: document.getElementById('path-trail-value'),
      waypointVisibility: document.getElementById('waypoint-visibility'),
      backgroundVisibility: document.getElementById('background-visibility'),
      revealSize: document.getElementById('reveal-size'),
      revealSizeValue: document.getElementById('reveal-size-value'),
      revealFeather: document.getElementById('reveal-feather'),
      revealFeatherValue: document.getElementById('reveal-feather-value'),
      revealTrail: document.getElementById('reveal-trail'),
      revealTrailValue: document.getElementById('reveal-trail-value'),
      // Angle of View elements
      aovAngle: document.getElementById('aov-angle'),
      aovAngleValue: document.getElementById('aov-angle-value'),
      aovDistance: document.getElementById('aov-distance'),
      aovDistanceValue: document.getElementById('aov-distance-value'),
      aovDropoff: document.getElementById('aov-dropoff'),
      aovDropoffValue: document.getElementById('aov-dropoff-value'),
      announcer: document.getElementById('announcer'),
      // Path head elements
      pathHeadStyle: document.getElementById('path-head-style'),
      pathHeadColor: document.getElementById('path-head-color'),
      pathHeadSize: document.getElementById('path-head-size'),
      pathHeadSizeValue: document.getElementById('path-head-size-value'),
      customHeadControls: document.getElementById('custom-head-controls'),
      customHeadUploadControls: document.getElementById('custom-head-upload-controls'),
      headUploadBtn: document.getElementById('head-upload-btn'),
      headUpload: document.getElementById('head-upload'),
      headPreview: document.getElementById('head-preview'),
      headFilename: document.getElementById('head-filename'),
      headPreviewImg: document.getElementById('head-preview-img'),
      headRotationMode: document.getElementById('head-rotation-mode'),
      headRotationOffsetControl: document.getElementById('head-rotation-offset-control'),
      headRotationOffset: document.getElementById('head-rotation-offset'),
      headRotationOffsetValue: document.getElementById('head-rotation-offset-value'),
      // Custom marker elements
      customMarkerControls: document.getElementById('custom-marker-controls'),
      markerUploadBtn: document.getElementById('marker-upload-btn'),
      markerUpload: document.getElementById('marker-upload'),
      markerPreview: document.getElementById('marker-preview'),
      markerFilename: document.getElementById('marker-filename'),
      markerPreviewImg: document.getElementById('marker-preview-img'),
      // Undo/Redo buttons
      undoBtn: document.getElementById('undo-btn'),
      redoBtn: document.getElementById('redo-btn'),
      // Example Backgrounds menu (inside File dropdown)
      exampleBackgroundsMenu: document.getElementById('example-backgrounds-menu'),
      // Graphics Scale
      graphicsScale: document.getElementById('graphics-scale'),
      graphicsScaleValue: document.getElementById('graphics-scale-value'),
      graphicsScaleLabel: document.getElementById('graphics-scale-label'),
      pathCasingToggle: document.getElementById('path-casing-toggle'),
      pathGlowToggle: document.getElementById('path-glow-toggle'),
      pathGlowIntensity: document.getElementById('path-glow-intensity'),
      pathGlowValue: document.getElementById('path-glow-value'),
      // Project save/load
      saveProjectBtn: document.getElementById('save-project-btn'),
      loadProjectBtn: document.getElementById('load-project-btn'),
      loadProjectInput: document.getElementById('load-project-input'),
      // Area highlight controls
      areaShape: document.getElementById('area-shape'),
      areaDrawControls: document.getElementById('area-draw-controls'),
      areaDrawBtn: document.getElementById('area-draw-btn'),
      areaCircleControls: document.getElementById('area-circle-controls'),
      areaCircleRadius: document.getElementById('area-circle-radius'),
      areaCircleRadiusValue: document.getElementById('area-circle-radius-value'),
      areaRectControls: document.getElementById('area-rect-controls'),
      areaRectWidth: document.getElementById('area-rect-width'),
      areaRectWidthValue: document.getElementById('area-rect-width-value'),
      areaRectHeight: document.getElementById('area-rect-height'),
      areaRectHeightValue: document.getElementById('area-rect-height-value'),
      areaFillControls: document.getElementById('area-fill-controls'),
      areaFillColor: document.getElementById('area-fill-color'),
      areaFillOpacity: document.getElementById('area-fill-opacity'),
      areaFillOpacityValue: document.getElementById('area-fill-opacity-value'),
      areaBorderControls: document.getElementById('area-border-controls'),
      areaBorderColor: document.getElementById('area-border-color'),
      areaBorderStyle: document.getElementById('area-border-style'),
      areaBorderWidth: document.getElementById('area-border-width'),
      areaBorderWidthValue: document.getElementById('area-border-width-value'),
      areaVisibilityControls: document.getElementById('area-visibility-controls'),
      areaVisibility: document.getElementById('area-visibility'),
      areaFadeIn: document.getElementById('area-fade-in'),
      areaFadeInValue: document.getElementById('area-fade-in-value'),
      areaFadeOut: document.getElementById('area-fade-out'),
      areaFadeOutValue: document.getElementById('area-fade-out-value'),
      areaDeleteControls: document.getElementById('area-delete-controls'),
      areaDeleteBtn: document.getElementById('area-delete-btn')
    };

    // The one writer for the editor's #announcer live region: every
    // announcement, a component's too (`ui:announce`), is written in turn
    // (DEF-45).
    this._announcements = createAnnouncementQueue(this.elements.announcer);
    
    this.ready = this.init().catch(error => {
      const appRoot = document.getElementById('app');
      appRoot?.removeAttribute('inert');
      appRoot?.removeAttribute('aria-busy');
      console.error('Route Plotter failed to initialize:', error);
      this.announce?.('Route Plotter could not finish starting. Reload the page and check the console.');
      return false;
    });
  }
  
  async init() {
    // Persistence hydration may decode several bitmaps. Keep the editor inert
    // until that transaction finishes so a late restore cannot replace edits
    // made during startup.
    const appRoot = document.getElementById('app');
    appRoot?.setAttribute('inert', '');
    appRoot?.setAttribute('aria-busy', 'true');

    // Set up canvas with contain-fit sizing
    this.updateCanvasAspectRatio();
    
    // Debounced resize handler to avoid excessive recalculations
    // Path recalculation is expensive, so we wait for resize to settle
    window.addEventListener('resize', () => {
      // Skip resize handling during animation playback to avoid interrupting zoom transitions
      if (this.animationEngine?.state?.isPlaying) {
        return;
      }
      // Skip resize handling during export to avoid resetting canvas dimensions
      if (this._isExportMode) {
        return;
      }
      this._refitCanvasToArea();
    });

    // The one banner slot below the header (UI-06 J-12): a mode's banner or
    // the first-start tip. The canvas area gives up the slot's height, so the
    // canvas is refitted each time that settles (Codex on 9466a3f).
    this.modeBanner = this.elements.modeBanner
      ? new ModeBanner(this.elements.modeBanner, { onHeightChange: () => this._refitAfterModeBanner() })
      : null;
    // A refit held back while playing runs once playback stops (Codex's recheck: Pause leaves `isPlaying` set).
    for (const event of ['animation:pause', 'animation:complete', 'animation:reset']) {
      this.eventBus.on(event, () => this._drainModeBannerRefit());
    }
    
    // Initialize marker style controls
    this.elements.markerStyle.value = this.styles.markerStyle;
    
    // Initialize path shape control
    this.elements.pathShape.value = this.styles.pathShape;
    
    // Initialize path head control values
    this.elements.pathHeadStyle.value = this.styles.pathHead.style;
    this.elements.pathHeadColor.value = this.styles.pathHead.color;
    this.elements.pathHeadSize.value = this.styles.pathHead.size;
    setRangeReadout(
      this.elements.pathHeadSize,
      this.elements.pathHeadSizeValue,
      formatRendererPixels(this.styles.pathHead.size)
    );
    
    // Show/hide custom image controls based on initial style
    this.elements.customHeadControls.style.display =
      pathHeadStyleUsesImageControls(this.styles.pathHead.style) ? 'block' : 'none';
    this.elements.customHeadUploadControls.style.display =
      this.styles.pathHead.style === 'custom' ? 'block' : 'none';
    
    // Initialize animation speed display (right sidebar only - left sidebar Duration removed)
    const defaultDuration = this.animationEngine.state.duration / 1000;
    if (this.elements.animationSpeedValue) {
      this.elements.animationSpeedValue.textContent = defaultDuration + 's';
    }
    if (this.elements.animationSpeedValueRight) {
      setRangeReadout(this.elements.animationSpeedRight, this.elements.animationSpeedValueRight, defaultDuration + 's');
    }
    // Slider value will be set via event after UIController is initialized

    this.syncHoldAtEndControl();
    
    // Slider is now properly synchronized after resets
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Set up EventBus listeners for decoupled component communication
    this.setupEventBusListeners();
    
    // Initialize UI Controller and Interaction Handler
    this.uiController = new UIController(this.elements, this.eventBus);
    // Whose a control of the Layers strip is, which this app builds (crowds.js): the chip's
    // line is not said where focus is on the row of what it now names (UI-06 PR 6, Codex r1 5).
    this.uiController.stripControlOf = element => this._stripControls?.().get(element);
    this.interactionHandler = new InteractionHandler(this.canvas, this.eventBus);
    this.interactionHandler.setEnabled(false);
    
    // Initialize Area Drawing Service for polygon draw mode
    this.areaDrawingService = new AreaDrawingService(this.eventBus);

    // Initialize Network Edit Service for crowd guide-network editing
    this.networkEditService = new NetworkEditService(this.eventBus);
    
    // Initialize Area Edit Service for repositioning/vertex editing
    this.areaEditService = new AreaEditService(this.eventBus);
    
    // Initialize Section Controller for collapsible settings
    this.sectionController = new SectionController(this.eventBus);
    this.sectionController.init();
    this.sectionController.setHelpContent(getInlineHelpHTML());
    
    // Where a toast that goes gives focus back (UI-06 B-35)
    this._trackFocusBeforeToasts();
    // Toasts kept in view, clear of the transport, where it is in the page's flow (UI-06 J-12, Q5)
    this._placeToastsOnScroll();

    // Event delegation for data-action buttons (help, shortcuts, etc.)
    document.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      
      const action = actionBtn.dataset.action;
      if (action === 'show-help' || action === 'show-shortcuts') {
        e.preventDefault();
        this.showHelp(); // Help's own dialog (UI-06 J-01); the splash is the first-run welcome
      }
    });
    
    // Initialize Swatch Pickers for colour controls (Okabe-Ito palette)
    attachSwatchPickers();

    // Layers strip + Crowd scope wiring (Phase 4)
    this.setupCrowdControls();
    this.updateLayersStrip();

    // Network edit mode wiring (Phase 4)
    this.setupNetworkControls();

    // Complete keyboard/non-visual view of the canonical route + scene.
    this.setupSceneOutline();
    
    // Initialize tooltips for all elements with data-tooltip attribute
    attachAllTooltips();
    
    // Initialize parameter definition tooltips (Carbon pattern: click label → description)
    initParamTooltips();
    
    // Initialize dropdown menus
    initAllDropdowns();

    // Manual file and diagnostics sharing pauses at a disclosure/preview.
    this.setupPrivacyControls();

    // Help, a dialog of its own; its Report a bug opens the preview above (UI-06 J-01).
    this.setupHelpDialog();

    // A recovery record that could not be restored waits for a choice (DEF-28).
    setupUnrestoredNotice(this);
    
    // Initialize waypoint list (shows getting started instructions when empty)
    this.updateWaypointList();
    
    // Now that UIController is ready, set the initial slider value
    const defaultSpeed = this.animationEngine.state.speed || ANIMATION.DEFAULT_SPEED;
    this.eventBus.emit('ui:slider:update-speed', defaultSpeed);
    
    // Set up controller event connections
    this.setupControllerEventConnections();
    
    // Finish recovery before choosing a default image or opening interaction.
    // This prevents the default image's later onload from replacing a restored
    // background, and prevents user edits from being overwritten by hydration.
    await restoreStartupProject(this);
    
    // Set default animation state: paused at END position
    // This ensures the full path is visible on load for editing. It happens
    // before the transport listeners below exist, so a load announces no pause
    // to a screen reader (DEF-33); the shell already shows Play and hides Pause.
    this.animationEngine.pause();
    this.animationEngine.seekToProgress(1.0);
    
    // Set up AnimationEngine event listeners
    this.setupAnimationEngineListeners();
    
    // Sync UI with initial preview mode and path visibility settings
    this._syncInitialUIState();
    // Play, the export items and Duration as the project at start allows: a
    // blank one has nothing to play (CROWD-08 part A).
    this.refreshPlayAvailability();
    
    // Initial render
    this.render();
    
    // Save initial state so the very first user action is undoable
    this.saveUndoState();
    
    // Start animation loop (runs continuously for rendering)
    this.startRenderLoop();

    this.interactionHandler.setEnabled(true);
    appRoot?.removeAttribute('aria-busy');
    appRoot?.removeAttribute('inert');

    // The first-run welcome opens only after the application transaction has
    // reached a stable state; its focus trap will inert the app again while visible.
    if (this.storageService.shouldShowSplash()) {
      this.showSplash();
    }
    
    console.log(`✅ Route Plotter v${APP_VERSION} initialized`);
    return true;
  }
  
  /**
   * Fit the canvas to the room the canvas area has now (contain-fit), then,
   * once that settles, recalculate the path: a window resize's work, and the
   * banner slot's (UI-06 J-12). Path recalculation is expensive, so it waits.
   * @private
   */
  _refitCanvasToArea() {
    // Recalculate canvas size with contain-fit for new viewport
    this.updateCanvasAspectRatio();
    // A rebuild held back for an earlier fit is this one's now: the fit has
    // rebuilt the path, and its debounce below is the one to follow (Codex r2
    // on 753f93f, 7: a pause ran both, three rebuilds to a resize's two).
    this._fittedPathPending = false;

    // Debounce path recalculation (expensive operation)
    if (this._resizeTimeout) {
      clearTimeout(this._resizeTimeout);
    }
    this._resizeTimeout = setTimeout(() => {
      this._resizeTimeout = null;
      this._recalculateFittedPath();
    }, 100); // 100ms debounce
  }

  /**
   * The refit's path recalculation, once its debounce has run: pathPoints
   * are in canvas coordinates, so the new canvas size needs them rebuilt
   * (waypoints are normalised and scale by themselves). Never inside a video
   * export: it draws at its own size, and its exit refits and rebuilds the
   * path for the display (`_exitExportMode`; an export cancels the debounce
   * as it starts). Not while playback runs, which a rebuild would retime: it
   * is held and runs once playback pauses, completes or resets (Codex r1 on
   * 7a74755, 1).
   * @private
   */
  _recalculateFittedPath() {
    if (this._isExportMode) return;
    if (this.animationEngine?.state?.isActivelyPlaying?.()) {
      this._fittedPathPending = true;
      return;
    }
    this._fittedPathPending = false;
    if (this.waypoints?.length >= 2) {
      this.calculatePath();
      this.render(); // Re-render with correct path
    }
  }

  /**
   * An export starts: the refit's recalculation still to come is dropped,
   * its exit's refit standing for it (UI-06 PR 6, Codex r1 on 7a74755, 1).
   * @private
   */
  _cancelFittedPathRecalculation() {
    if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
    this._resizeTimeout = null;
    this._fittedPathPending = false;
  }

  /**
   * A fit about to be made stands for every refit still held or due: the
   * slot's refit and a refit's rebuild held while playing, and the resize's
   * debounce, are dropped. A project's commit, before the pause that would
   * run them: it fits once (Codex r3 on bc2d3a4, 5: three rebuilds).
   * @private
   */
  _supersedeRefitWork() {
    this._modeBannerRefitPending = false;
    this._cancelFittedPathRecalculation();
  }

  /**
   * The banner slot's height has settled: refit the canvas to what is left
   * (UI-06 J-12), where that room has changed since the canvas was last
   * fitted (a slot replaced by one as tall, or shown and gone while playing,
   * leaves nothing to do). Not while the animation actively plays, as a
   * resize waits too; held, it runs once when playback pauses, completes or
   * resets (`_drainModeBannerRefit`). A video export keeps its own canvas,
   * and its exit refits, so nothing is held for it (DEF-53).
   * @private
   */
  _refitAfterModeBanner() {
    if (this._isExportMode) return;
    const room = this._canvasAreaRoom();
    const fitted = this._fittedRoom;
    if (fitted && fitted.width === room.width && fitted.height === room.height) {
      this._modeBannerRefitPending = false;
      return;
    }
    if (this.animationEngine?.state?.isActivelyPlaying?.()) {
      this._modeBannerRefitPending = true;
      return;
    }
    this._modeBannerRefitPending = false;
    this._refitCanvasToArea();
  }

  /**
   * Run a refit the slot held back while playing (`_refitAfterModeBanner`),
   * and a refit's path recalculation held back the same way
   * (`_recalculateFittedPath`).
   * @private
   */
  _drainModeBannerRefit() {
    if (this._modeBannerRefitPending) this._refitAfterModeBanner();
    if (this._fittedPathPending) this._recalculateFittedPath();
  }

  /**
   * Stop what the banner slot and its owners wait on or keep running: the
   * first-start tip's timers and waits, the slot's settle, an armed branch's
   * focus step, the refit and its path recalculation held back, the resize's
   * debounce, and the regions' lines waiting for their turn's end, none of
   * which is said after this (Codex r1 on 7a74755, 7). `destroy()` runs it,
   * and so does a test's teardown (UI-06 PR 6).
   * @private
   */
  _stopModeBannerWork() {
    this._stopPreviewTip?.();
    // The background prompt's wait, and the pins on the live project's
    // images, which a page lets go of as it unloads (DEF-98).
    stopRecoveryImages(this);
    this._stopBranchFocus?.();
    this.modeBanner?.destroy();
    this._modeBannerRefitPending = false;
    this._cancelFittedPathRecalculation();
    this._stopRegionLines();
  }

  /**
   * Sync UI controls with initial state on load.
   * Called after init to ensure UI reflects default preview mode and visibility settings.
   * 
   * DEBUG MODE: Forces preview mode with instantaneous visibility for trail debugging.
   * Remove or comment out the DEBUG section for production.
   * @private
   */
  _syncInitialUIState() {
    // Sync mode switch (header toggle)
    this._updateModeSwitch();
    
    // Sync path visibility dropdown
    if (this.elements.pathVisibility) {
      this.elements.pathVisibility.value = this.motionSettings.pathVisibility;
    }
    
    // Sync waypoint visibility dropdown
    if (this.elements.waypointVisibility) {
      this.elements.waypointVisibility.value = this.motionSettings.waypointVisibility;
    }
    
    // Sync background visibility dropdown
    if (this.elements.backgroundVisibility) {
      this.elements.backgroundVisibility.value = this.motionSettings.backgroundVisibility;
    }
    
    // Sync the comet-only trail control and its Pacing explanation.
    this.uiController?.updateTrailControlVisibility?.(this.motionSettings.pathVisibility);
    
    // Reveal sliders and their containers, which follow backgroundVisibility.
    this.uiController?.syncRevealControls?.(this.motionSettings);
    
    console.debug(`🎛️ [Init] UI synced: previewMode=${this.previewMode}, pathVisibility=${this.motionSettings.pathVisibility}`);
  }
  
  /**
   * Queue a render operation to be executed on next animation frame
   * Prevents multiple renders in same frame for better performance
   * Example: Changing 3 waypoint properties = 1 render instead of 3
   */
  queueRender() {
    if (!this.renderQueued) {
      this.renderQueued = true;
      // Store the frame id so teardown (destroy) can cancel a pending render.
      this._renderRafId = requestAnimationFrame(() => {
        try {
          this.render();
        } finally {
          // Cleared even when the frame throws: a flag left set would make
          // every later queueRender return early, so edits stopped redrawing
          // until reload (DEF-26).
          this.renderQueued = false;
        }
      });
    }
  }
  
  /**
   * Begin batch mode - prevents redundant calculations during bulk operations
   * Use when adding/loading multiple waypoints at once
   */
  beginBatch() {
    this._batchMode = true;
  }
  
  /**
   * End batch mode and trigger single update
   * Calculates path once for all batched changes
   */
  endBatch() {
    this._batchMode = false;
    // Trigger single update for all batched changes
    if (this.waypoints.length >= 2) {
      this.calculatePath();
    }
    this.updateWaypointList();
    this.autoSave();
    this.queueRender();
  }
  
  /**
   * Get waypoint by ID with O(1) lookup
   * @param {string} id - Waypoint ID
   * @returns {Waypoint|undefined} Waypoint instance or undefined
   */
  getWaypointById(id) {
    return this.waypointsById.get(id);
  }
  
  /**
   * Add waypoint to ID lookup map
   * @private
   * @param {Waypoint} waypoint - Waypoint to add
   */
  _addWaypointToMap(waypoint) {
    this.waypointsById.set(waypoint.id, waypoint);
  }
  
  /**
   * Remove waypoint from ID lookup map
   * @private
   * @param {Waypoint} waypoint - Waypoint to remove
   */
  _removeWaypointFromMap(waypoint) {
    this.waypointsById.delete(waypoint.id);
  }
  
  /**
   * Show a toast notification that auto-dismisses, unless it is an error.
   * The container is not a live region: the toast's words are announced
   * once, through the queue, so nothing is read twice (UI-06 J-05, C-5).
   * @param {string} message - Text to display
   * @param {number} [duration] - Time in ms before auto-dismiss; 0 never.
   *   Left out, 5000; for an assertive toast, an error, 0: it stays until it
   *   is dismissed (UI-06 B-16, WCAG 2.2.3)
   * @param {{label: string, onClick: Function}} [action] - Optional offer the
   *   toast carries (LABEL-01). It is only ever an offer: the same action must
   *   remain reachable elsewhere, because a toast fades and can be missed.
   * @param {{priority?: 'polite'|'assertive', whenIdle?: boolean, essential?: boolean}} [options] -
   *   assertive for an error the author must hear; `whenIdle` for the start's
   *   tip, read once nothing else shows or waits, so it never cuts in on what
   *   the author must hear (DEF-45; the owner, 2026-10-09); `essential` for
   *   a message routine ones never displace, what browser recovery could not
   *   keep (DEF-98), announced once, here
   * @returns {Function|undefined} Take the toast away, as its × does
   */
  showToast(message, duration, action = null, { priority = 'polite', whenIdle = false, essential = false } = {}) {
    const lifetime = duration ?? (priority === 'assertive' ? 0 : 5000);
    if (whenIdle) this.announce(message, priority, { whenIdle });
    else if (essential) this.announce(message, priority, { essential: true });
    else this.announce(message, priority);
    const container = this.elements.toastContainer;
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    if (action && typeof action.onClick === 'function') {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'toast-action';
      actionBtn.type = 'button';
      actionBtn.textContent = action.label;
      actionBtn.addEventListener('click', () => {
        action.onClick();
        remove();
      });
      toast.appendChild(actionBtn);
    }
    
    const dismiss = document.createElement('button');
    dismiss.className = 'toast-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.textContent = '×';
    toast.appendChild(dismiss);
    
    container.appendChild(toast);
    this._placeToasts({ added: toast });
    
    // Trigger enter animation on next frame
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    
    const remove = () => {
      // Focus in the toast (its Dismiss or action, or held there when its
      // timer runs) would go with it: it moves first (UI-06 B-35).
      leavingToasts.add(toast);
      if (toast.contains(document.activeElement)) this._focusOffToast(toast);
      toast.classList.remove('is-visible');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      // Fallback removal if transition doesn't fire
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
    };
    
    dismiss.addEventListener('click', remove);
    if (lifetime > 0) setTimeout(remove, lifetime);
    return remove;
  }
  
  /**
   * Remember the last control focused outside the toasts, from the start
   * (UI-06 B-35); `destroy()` stops it.
   * @private
   */
  _trackFocusBeforeToasts() {
    const container = this.elements.toastContainer;
    if (!container || this._toastFocusListener) return;
    this._focusBeforeToast = null;
    this._toastFocusListener = (event) => {
      if (!container.contains(event.target)) this._focusBeforeToast = event.target;
    };
    document.addEventListener('focusin', this._toastFocusListener);
  }

  /**
   * Keep the toasts in view where the transport is in the page's flow (at
   * 64 rem and below it scrolls with the page, UI-06 J-12), and over none of
   * its controls: the container is fixed to the viewport there, and stands
   * wholly above the controls where the room between their top and the
   * viewport's takes the stack, else wholly below them, at the viewport's
   * bottom, where that room does (or the controls are out of view); where
   * neither does, the stack is capped to the larger room and scrolls inside
   * itself, its newest toast in view (Codex r2 on 753f93f, 2). Measured as a
   * toast shows, and on each scroll and resize while one shows (the lead's
   * Q5). At full width the container stands on the sticky transport, as
   * built, and nothing is written.
   * @param {{added?: HTMLElement}} [change] - The toast just added, if one was
   * @private
   */
  _placeToasts({ added = null } = {}) {
    const container = this.elements.toastContainer;
    const controls = container?.parentElement;
    if (!container || !controls) return;
    const inFlow = window.matchMedia?.('(max-width: 64rem)').matches ?? false;
    if (!inFlow) {
      if (container.style.getPropertyValue('--toast-lift')) container.style.removeProperty('--toast-lift');
      this._capToasts(container, null);
      return;
    }
    const { top, bottom } = controls.getBoundingClientRect();
    // The stack's own height: a capped one's content (scrollHeight), not its cap.
    const { lift, room } = toastPlacement({ top, bottom }, Math.max(container.offsetHeight, container.scrollHeight),
      window.innerHeight);
    container.style.setProperty('--toast-lift', `${Math.round(lift)}px`);
    this._capToasts(container, room, added);
  }

  /**
   * Cap the toast stack to `room` px, or lift the cap (null). Capped, it
   * scrolls only as a toast is added: to that toast, the newest, unless
   * focus is in an older one, which is kept in view instead. Otherwise its
   * scroll is the author's, or the browser's revealing a focused control,
   * and is left as it is (Codex r3 on bc2d3a4, 3).
   * @param {HTMLElement} container
   * @param {number|null} room
   * @param {HTMLElement|null} [added] - The toast just added
   * @private
   */
  _capToasts(container, room, added = null) {
    if (room === null) {
      if (container.style.getPropertyValue('--toast-room')) container.style.removeProperty('--toast-room');
      container.classList.remove('is-capped');
      return;
    }
    const shown = Math.floor(room);
    container.style.setProperty('--toast-room', `${shown}px`);
    container.classList.add('is-capped');
    if (!added) return;
    const focused = document.activeElement?.closest?.('.toast');
    if (!focused || focused.parentElement !== container) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    const top = focused.offsetTop;
    const bottom = top + focused.offsetHeight;
    if (top < container.scrollTop) container.scrollTop = top;
    else if (bottom > container.scrollTop + shown) container.scrollTop = bottom - shown;
  }

  /**
   * Place the toasts again on every scroll, of the page or of any part of
   * it but the stack itself, and every resize, while one shows
   * (`_placeToasts`); `destroy()` stops it.
   * @private
   */
  _placeToastsOnScroll() {
    if (this._toastPlacement) return;
    this._toastPlacement = (event) => {
      const container = this.elements.toastContainer;
      // The stack's own scroll (the author's, or the browser revealing a
      // focused toast) moves nothing: placing it then scrolled it back to
      // the newest toast (Codex r3 on bc2d3a4, 3).
      if (event?.target === container) return;
      if (container?.querySelector('.toast')) this._placeToasts();
    };
    window.addEventListener('scroll', this._toastPlacement, { capture: true, passive: true });
    window.addEventListener('resize', this._toastPlacement);
  }

  /** Stop placing the toasts on scroll and resize. @private */
  _stopPlacingToasts() {
    if (!this._toastPlacement) return;
    window.removeEventListener('scroll', this._toastPlacement, { capture: true });
    window.removeEventListener('resize', this._toastPlacement);
    this._toastPlacement = null;
  }

  /** Stop remembering where focus was before the toasts. @private */
  _stopTrackingFocusBeforeToasts() {
    if (this._toastFocusListener) document.removeEventListener('focusin', this._toastFocusListener);
    this._toastFocusListener = null;
    this._focusBeforeToast = null;
  }

  /**
   * Give focus held in a leaving toast to the control focused before it
   * [Q2], where a browser would let it land (PR 7's checks: in the page,
   * enabled, in no hidden container, fieldset or closed dialog); else to
   * the next toast still showing, then an earlier one; else to the
   * container, the end of the focus-return rule.
   * @param {HTMLElement} toast
   * @private
   */
  _focusOffToast(toast) {
    if (focusLands(this._focusBeforeToast)) return;
    const container = this.elements.toastContainer;
    const showing = [...container.querySelectorAll('.toast')].filter(other => !leavingToasts.has(other));
    const after = showing.filter(other => toast.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING);
    const before = showing.filter(other => !after.includes(other)).reverse();
    for (const other of [...after, ...before]) {
      if (focusLands(other.querySelector('button'))) return;
    }
    container.focus();
  }

  deleteWaypoint(waypoint) {
    const index = this.waypoints.indexOf(waypoint);
    if (index === -1) return;
    // One operation, its toast the message that says it (UI-06 PR 6)
    this.regionOperation(cover => {
      // Remove from array
      this.waypoints.splice(index, 1);
      
      // Remove from ID lookup map
      this._removeWaypointFromMap(waypoint);

      // Drop it from the selection; if it was the primary, promote the
      // last remaining selected waypoint (multi-select survives deletes)
      this.selectedWaypoints = this.selectedWaypoints.filter(wp => wp !== waypoint);
      if (this.selectedWaypoint === waypoint) {
        this.selectedWaypoint = this.selectedWaypoints.length > 0
          ? this.selectedWaypoints[this.selectedWaypoints.length - 1]
          : null;
      }
      this.uiController?.setSelection(this.selectedWaypoints, this.selectedWaypoint);
      if (this.interactionHandler?.setSelection) {
        this.interactionHandler.setSelection(this.selectedWaypoints, this.selectedWaypoint);
      } else {
        this.interactionHandler?.setSelectedWaypoint?.(this.selectedWaypoint);
      }
      
      // Emit waypoint deleted event (triggers path recalc, UI update, save)
      // Event-driven approach ensures consistent update sequence
      this.eventBus.emit('waypoint:deleted', index);
      
      // The standard delete toast (a crowd's, a node's and a path's sibling),
      // whichever route asked: it advertises the undo, and its announcement is
      // the one the author hears (UI-06 J-05, C-5).
      this.eventBus.emit('ui:toast', {
        message: `Deleted ${waypoint.name || 'waypoint'} — press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`
      });
      // It says the change: the chip and the empty list it moves are not said again (UI-06 PR 6)
      cover();
    });
  }
  
  /**
   * Clear all waypoints and reset the canvas
   * Resets animation state, clears path data, and triggers a re-render
   */
  clearAll() {
    clearProject(this);
  }
  
  showSplash() {
    // Populate help content from centralized source
    const helpContainer = document.getElementById('splash-help');
    if (helpContainer) {
      helpContainer.innerHTML = getSplashHelpHTML();
    } else {
      console.warn('📖 [Splash] Help container not found!');
    }
    
    this.elements.splash.style.display = 'flex';
  }
  
  /**
   * The welcome is for the first start (UI-06 J-01, the owner's pick): any
   * dismissal — Get started, its close button, its backdrop, Escape —
   * records that it was seen, so the next start does not show it. Help's
   * "Show the welcome again" shows it without reading the flag.
   */
  hideSplash() {
    this.elements.splash.style.display = 'none';
    this.storageService.markSplashShown();
  }
  
  // ----- Accessibility and persistence helpers -----
  /**
   * Announce a message to screen readers. Messages are written to the live
   * region in turn, each for its own time, so one announced just before
   * another is not lost (DEF-45; the rules are in utils/announcementQueue.js).
   * @param {string} message
   * @param {'polite'|'assertive'} [priority='polite'] - Assertive waits ahead of polite messages
   * @param {{essential?: boolean, whenIdle?: boolean, key?: *}} [options] - essential: the author
   *   must hear it, so a burst of routine messages never displaces it; key: whose it is, so
   *   `withdrawAnnouncements` can take it out while it waits
   */
  announce(message, priority = 'polite', options) {
    this._announcements.announce(message, priority, options);
  }

  /**
   * Say `message`, what a region that was live used to say alone (the scope
   * chip's words, the network's count, the empty list), once the turn that
   * changed it is over (a timer's: the task, and what it awaited in
   * microtasks). It is not said when the operation that changed the region
   * says the change in its own message (`regionOperation`), nor when focus
   * already names what the region now shows (`heard`). Nothing else covers
   * it — not the status line ("Unsaved changes"), a notice, the start's tip
   * waiting its turn, or another operation near it — so the count, the scope
   * and the type are still heard beside them, and two such lines of one turn
   * are both said (UI-06 PR 6, item 6; Codex r1 on 7a74755, 4; Codex r2 on
   * 753f93f, 3). A region's later change in the same turn replaces its line,
   * or cancels it where that change is covered or heard: what the region
   * shows at the turn's end is what is said, or nothing, never a state it
   * passed through (Q2; Codex r2 on 753f93f, 4).
   * @param {string} message
   * @param {string} [region] - Whose line it is (`scope-chip`, …); each message its own by default
   * @param {{heard?: boolean}} [options] - heard: focus names the change already
   */
  announceUnlessSaid(message, region = message, { heard = false } = {}) {
    const operation = this._regionOperations?.at(-1);
    if (operation) operation.lines.set(region, heard ? null : message);
    else this._regionLineTurn()?.set(region, heard ? null : message);
  }

  /**
   * Run `work`, one operation that changes regions, synchronously, and keep
   * the region lines it writes as its own. Where it says its change in its
   * own message ("Undo", "Redo", a deletion's toast, "Selection cleared",
   * "Node placed", a crowd added, a minor waypoint added to a leg, a project
   * opened, cleared or restored), it calls the `cover` it is handed beside
   * that message: then none of its lines is said, and each cancels its
   * region's line still waiting, the message having said what the region
   * now shows. Otherwise they wait for the turn's end as any other. The
   * operation is over when `work` returns, never across an await: an
   * asynchronous continuation of the same change runs `regionOperation`
   * again around what it changes, and anything else meanwhile (a selection
   * made while a load waits) is said (Codex r2 on 753f93f, 3).
   * @param {function(Function): *} work - Handed `cover`
   * @returns {*} What `work` returns
   */
  regionOperation(work) {
    const operation = { lines: new Map(), covered: false };
    const operations = (this._regionOperations ??= []);
    operations.push(operation);
    try {
      return work(() => { operation.covered = true; });
    } finally {
      operations.splice(operations.lastIndexOf(operation), 1);
      // Into the operation it ran inside, if any, else into the turn.
      const outer = operations.at(-1);
      for (const [region, line] of operation.lines) {
        const next = operation.covered ? null : line;
        if (outer) outer.lines.set(region, next);
        else this._regionLineTurn()?.set(region, next);
      }
    }
  }

  /**
   * This turn's region lines, made as its first one comes, and ended by a
   * timer once the task is over: each region's last line is said, a region
   * whose last change was covered or heard says none. None after
   * `_stopRegionLines`.
   * @returns {{set: Function}|null}
   * @private
   */
  _regionLineTurn() {
    if (this._regionLinesStopped) return null;
    if (!this._regionLines) {
      const turn = { lines: new Map(), timer: null };
      turn.set = (region, line) => {
        if (line === null) turn.lines.delete(region);
        else turn.lines.set(region, line);
      };
      turn.timer = setTimeout(() => {
        if (this._regionLines !== turn) return;
        this._regionLines = null;
        for (const line of turn.lines.values()) this.announce(line);
      }, 0);
      this._regionLines = turn;
    }
    return this._regionLines;
  }

  /** No region line waiting is said, and none is taken from now on (`_stopModeBannerWork`). @private */
  _stopRegionLines() {
    this._regionLinesStopped = true;
    if (this._regionLines) clearTimeout(this._regionLines.timer);
    this._regionLines = null;
  }

  /**
   * Take the messages announced under `key` that still wait out of the queue
   * (an export's progress once it has ended: UI-06, Codex r2).
   * @param {*} key - The `key` they were announced with
   */
  withdrawAnnouncements(key) {
    this._announcements.withdraw(key);
  }
  
  /**
   * Main render method - delegates to RenderingService
   * 
   * Builds a state object containing all data needed for rendering,
   * then passes it to the centralized RenderingService for actual drawing.
   */
  render() {
    const cw = this.displayWidth || this.canvas.width;
    const ch = this.displayHeight || this.canvas.height;
    
    // Safety check - ensure canvas has valid dimensions
    if (cw <= 0 || ch <= 0) {
      console.warn('Cannot render to canvas with invalid dimensions:', { width: cw, height: ch });
      return;
    }
    
    // Build state object for RenderingService
    // This centralizes all rendering data in one place
    const renderState = {
      // Core data
      waypoints: this.waypoints,
      pathPoints: this.pathPoints,
      // Branch geometry and the composed master timeline (ROUTE-01b). Both
      // stay null/empty on a linear route, so its render path is untouched.
      branchPaths: this.branchPaths,
      branchTimeline: this.getBranchTimeline?.() || null,
      // Route moments a bound crowd reads (COMPOSE-01), one way only.
      routeAnchors: this.getRouteArrivalMap?.() || null,
      ...getFinishContexts(this),
      // Waypoints a bound crowd enters from carry a branch handle (COMPOSE-04)
      branchHandleWaypoints: boundEntryWaypointIds(this.scene),
      branchHandleAt: (waypoint) => this.waypointBranchHandleAt(waypoint),
      styles: this.styles,
      selectedWaypoint: this.selectedWaypoint,
      selectedWaypoints: this.selectedWaypoints,
      hover: this.canvasHover,

      // Flow layers + their deterministic evaluator (drawn beneath the hero route)
      scene: this.scene,
      swarmEngine: this.swarmEngine,
      selectedCrowd: this.selectedCrowd,
      networkEditService: this.networkEditService,
      
      // Animation state
      animationEngine: this.animationEngine,
      beaconAnimation: this.beaconAnimation,
      
      // Background/overlay (include zoom from export settings)
      background: {
        ...this.background,
        zoom: this.exportSettings.backgroundZoom / 100
      },
      
      // Viewport (zoom/pan): the editor's own. A video export draws none, as
      // the HTML export's player never zooms: its pan is in display pixels,
      // so on the export's canvas it framed another part of the map (DEF-99).
      viewport: this._isExportMode ? null : this.viewport,
      
      // Coordinate transform function (bound to this instance)
      imageToCanvas: (x, y, clamp) => this.imageToCanvas(x, y, clamp),
      
      // Coordinate transform service for relative sizing
      coordinateTransform: this.coordinateTransform,

      // Stable visual sizing reference, separate from timingReference.
      renderReference: this.renderReference,
      interactiveLabels: !this._isExportMode,
      // A video export bakes beacons as authored, ignoring the author's
      // reduced-motion setting; the editor and the player honour it (DEF-29)
      exportingVideo: this._isExportMode,
      
      // Visible bounds for clipping (normalized 0-1 coordinates)
      visibleBounds: this.getVisibleBounds(),
      
      // Display dimensions
      displayWidth: cw,
      displayHeight: ch,
      
      // Motion visibility settings
      motionSettings: this.motionSettings,
      previewMode: this.previewMode,
      // Suppress waypoint text labels when the export "Text labels" toggle is off.
      // Applies in Preview (WYSIWYG) and during export; plain Edit mode still shows labels.
      suppressLabels: !this.exportSettings.includeText && (this.previewMode || this._isExportMode),
      motionVisibilityService: this.motionVisibilityService,
      
      // Waypoint progress values for accurate animation timing
      waypointProgressValues: this.getWaypointProgressValues(),
      
      // Camera state for zoom/pan effect (calculated from CameraService)
      cameraState: this._calculateCameraState(cw, ch),
      
      // Pixel scale for vector canvas: 1 during export (identity), DPR otherwise
      pixelScale: this._isExportMode ? 1 : Math.min(window.devicePixelRatio || 1, 3),
      
      // Area drawing service for polygon draw preview
      areaDrawingService: this.areaDrawingService,
      
      // Area edit service for handle rendering
      areaEditService: this.areaEditService
    };
    
    // Delegate all rendering to the service
    this.renderingService.render(this.ctx, cw, ch, renderState);
  }

  // ----- Assets -----
  async loadImageFileAsset(file) {
    return ImageAsset.fromFile(file);
  }

  async loadImageFile(file) {
    const validated = await this.loadImageFileAsset(file);
    return validated.getImageElement();
  }
  
  loadDefaultImage() {
    return loadExampleBackground(this, './images/UoN_map.png', { autoSave: false })
      .then(loaded => {
        if (loaded) console.debug('Default image (images/UoN_map.png) loaded for dev testing');
        else this.render();
        return loaded ? this.background.image : null;
      });
  }
  
  /**
   * Load an example background image from the images folder
   * @param {string} imagePath - Path to the image (e.g., 'images/Court.png')
   */
  loadExampleImage(imagePath) {
    return loadExampleBackground(this, imagePath);
  }

  /**
   * Clean up resources and event listeners
   */
  destroy() {
    // What waits on the banner slot first: stopping the animation would run
    // a refit it held back while playing (UI-06 PR 6)
    this._stopModeBannerWork();
    // Stop animation
    this.animationEngine?.stop();
    this.storageService?.detachLifecycle();
    this._stopTrackingFocusBeforeToasts();
    this._stopPlacingToasts();
    
    // Clean up controllers
    this.interactionHandler?.destroy();
    this.sceneOutlineController?.destroy();
    if (this._sceneOutlineDeferredRefreshTimer !== null) {
      clearTimeout(this._sceneOutlineDeferredRefreshTimer);
      this._sceneOutlineDeferredRefreshTimer = null;
    }
    this.pathCalculator?.clearCache(); // PathCalculator exposes clearCache(), not destroy()
    
    // Remove all event listeners
    this.eventBus?.destroy(); // EventBus exposes destroy()/removeAllListeners(), not removeAll()
    
    // Clear render queue (renderQueued is a boolean guard; cancel the stored frame id)
    if (this.renderQueued) {
      cancelAnimationFrame(this._renderRafId);
      this.renderQueued = false;
    }
    
    // Clear timeouts
    if (this._durationUpdateTimeout) {
      clearTimeout(this._durationUpdateTimeout);
    }
    // The scene's end, queued by a path rebuild: a banner's refit runs one (UI-06 PR 6)
    if (this._sceneEndTimeout) {
      clearTimeout(this._sceneEndTimeout);
      this._sceneEndTimeout = null;
    }
    
    // Clear canvases
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.vectorCanvas) {
      const vctx = this.vectorCanvas.getContext('2d');
      vctx?.clearRect(0, 0, this.vectorCanvas.width, this.vectorCanvas.height);
    }
    
    // Nullify references for garbage collection
    this.waypoints = null;
    this.pathPoints = null;
    this.selectedWaypoint = null;
    this.selectedWaypoints = null;
    this.waypointsById = null;
    this.background = null;
    this.elements = null;
    
    console.log('Route Plotter destroyed');
  }
}

// The class body above holds only the app core (state, init, model
// bookkeeping, render). Every other method group lives in src/app/*
// prototype mixins — moved verbatim, `this` still the RoutePlotter
// instance. Method names must stay unique across all mixins.
Object.assign(
  RoutePlotter.prototype,
  wiringDomMixin,
  wiringBusMixin,
  wiringControllersMixin,
  undoRedoMixin,
  playbackMixin,
  cameraMixin,
  viewportMixin,
  pathTimingMixin,
  persistenceMixin,
  exportingMixin,
  editorPanelMixin,
  pointerMixin,
  crowdsMixin,
  crowdWaitingMixin,
  networkMixin,
  sceneOutlineMixin,
  privacyMixin,
  helpDialogMixin,
);

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new RoutePlotter();
});
