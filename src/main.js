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

// ========== DEBUG LOG BUFFER ==========
// Captures console.log, .warn, .error for easy copying to clipboard
const DEBUG_LOG_BUFFER = [];
const DEBUG_LOG_MAX_SIZE = 500; // Keep last 500 log entries

// Intercept console methods to capture debug messages
['log', 'warn', 'error'].forEach(method => {
  const original = console[method].bind(console);
  console[method] = function(...args) {
    original(...args);
    const tag = method === 'log' ? 'LOG' : method === 'warn' ? 'WRN' : 'ERR';
    const message = args.map(arg => {
      if (arg instanceof Error) return `${arg.message}\n${arg.stack}`;
      if (typeof arg === 'object') try { return JSON.stringify(arg); } catch { return String(arg); }
      return String(arg);
    }).join(' ');
    DEBUG_LOG_BUFFER.push(`[${new Date().toISOString().slice(11, 23)}] [${tag}] ${message}`);
    if (DEBUG_LOG_BUFFER.length > DEBUG_LOG_MAX_SIZE) {
      DEBUG_LOG_BUFFER.shift();
    }
  };
});

/**
 * Build the debug log content as a markdown string.
 * Shared by download and copy functions.
 * @returns {string} Formatted markdown debug log
 */
function buildDebugLogContent() {
  const now = new Date();
  const header = [
    `# Route Plotter v${APP_VERSION} — Debug Log`,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| Generated | ${now.toISOString()} |`,
    `| User Agent | ${navigator.userAgent} |`,
    `| Screen | ${screen.width}\u00d7${screen.height} @ ${devicePixelRatio}x |`,
    `| WebCodecs | ${typeof VideoEncoder !== 'undefined' ? 'available' : 'unavailable'} |`,
    '',
    '## Console Log',
    '',
    '```',
  ].join('\n');
  const footer = '\n```\n';
  return header + '\n' + DEBUG_LOG_BUFFER.join('\n') + footer;
}

/**
 * Download debug logs as a .md file with markdown-formatted system info.
 */
function downloadDebugLog() {
  const logText = buildDebugLogContent();
  const blob = new Blob([logText], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  a.download = `route-plotter-debug-${ts}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Copy debug logs to clipboard as markdown.
 * @returns {Promise<boolean>} True if successful
 */
async function copyDebugLog() {
  try {
    await navigator.clipboard.writeText(buildDebugLogContent());
    return true;
  } catch (err) {
    console.error('Failed to copy debug log:', err);
    return false;
  }
}

// Update page title and header with version on load
document.addEventListener('DOMContentLoaded', () => {
  document.title = `Route Plotter v${APP_VERSION}`;
  const h1 = document.getElementById('app-title');
  if (h1) {
    h1.textContent = 'Route Plotter';
    h1.title = `Version ${APP_VERSION}`;
  }
  
  // Min-width warning dismiss handler (R-3)
  const screenWarning = document.getElementById('screen-warning');
  const screenWidthDisplay = document.getElementById('screen-width-display');
  const screenWarningDismiss = document.getElementById('screen-warning-dismiss');
  if (screenWidthDisplay) screenWidthDisplay.textContent = window.innerWidth;
  if (screenWarningDismiss) {
    screenWarningDismiss.addEventListener('click', () => {
      screenWarning?.classList.add('dismissed');
    });
  }
  
  // Setup debug log download button
  const debugBtn = document.getElementById('download-debug-btn');
  if (debugBtn) {
    debugBtn.addEventListener('click', () => downloadDebugLog());
  }
  
  // Setup debug log copy button
  const copyDebugBtn = document.getElementById('copy-debug-btn');
  if (copyDebugBtn) {
    copyDebugBtn.addEventListener('click', async () => {
      const ok = await copyDebugLog();
      const orig = copyDebugBtn.textContent;
      copyDebugBtn.textContent = ok ? 'Copied!' : 'Failed';
      setTimeout(() => { copyDebugBtn.textContent = orig; }, 2000);
    });
  }
});

// Import modular utilities
import { RENDERING, ANIMATION, VIDEO_EXPORT, MOTION, PATH_VISIBILITY, WAYPOINT_VISIBILITY, BACKGROUND_VISIBILITY } from './config/constants.js';
import { MotionVisibilityService } from './services/MotionVisibilityService.js';
import { StorageService } from './services/StorageService.js';
import { CoordinateTransform } from './services/CoordinateTransform.js';
import { PathCalculator } from './services/PathCalculator.js';
import { AnimationEngine } from './services/AnimationEngine.js';
import { RenderingService } from './services/RenderingService.js';
import { EventBus } from './core/EventBus.js';
import { UIController } from './controllers/UIController.js';
import { InteractionHandler } from './handlers/InteractionHandler.js';
import { getSplashHelpHTML } from './config/helpContent.js';
import { UndoService } from './services/UndoService.js';
import { SectionController } from './controllers/SectionController.js';
import { AreaDrawingService } from './services/AreaDrawingService.js';
import { AreaEditService } from './services/AreaEditService.js';
import { getInlineHelpHTML } from './config/helpContent.js';
import { attachSwatchPickers } from './components/SwatchPicker.js';
import { attachAllTooltips } from './components/Tooltip.js';
import { initParamTooltips } from './components/ParamTooltip.js';
import { initAllDropdowns } from './components/Dropdown.js';
import { CameraService } from './services/CameraService.js';
import { ImageAssetService } from './services/ImageAssetService.js';
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

// Main application class for Route Plotter v3
class RoutePlotter {
  constructor() {
    // Services
    this.storageService = new StorageService();
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
    this.pathPoints = [];
    this.selectedWaypoint = null;
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
        style: 'arrow', // dot, arrow, custom, none
        color: '#111111',
        size: 8,
        image: null, // For custom image
        imageAssetId: null, // Asset ID for deduplication
        rotationMode: 'auto', // 'auto' follows path direction, 'fixed' stays upright
        rotationOffset: 0 // Degrees offset added to rotation
      },
      graphicsScale: 1, // Global multiplier for all vector element sizes (0.25–4×)
      showPathCasing: true, // White outline behind path for contrast on busy backgrounds
      // Optional soft halo beneath the path (intensity 0–1; mirrors RENDERING.PATH_GLOW_DEFAULT_INTENSITY)
      pathGlow: { enabled: false, intensity: 0.5 }
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
      // Camera zoom mode toggle (switch version)
      cameraZoomModeToggle: document.getElementById('camera-zoom-mode-toggle'),
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
      splashDontShow: document.getElementById('splash-dont-show'),
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
      labelWidth: document.getElementById('label-width'),
      labelWidthValue: document.getElementById('label-width-value'),
      labelOffsetX: document.getElementById('label-offset-x'),
      labelOffsetXValue: document.getElementById('label-offset-x-value'),
      labelOffsetY: document.getElementById('label-offset-y'),
      labelOffsetYValue: document.getElementById('label-offset-y-value'),
      labelAutoPosition: document.getElementById('label-auto-position'),
      labelColor: document.getElementById('label-color'),
      labelBgColor: document.getElementById('label-bg-color'),
      labelBgOpacity: document.getElementById('label-bg-opacity'),
      labelBgOpacityValue: document.getElementById('label-bg-opacity-value'),
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
      cameraPrevZoomValue: document.getElementById('camera-prev-zoom-value'),
      cameraNextZoomValue: document.getElementById('camera-next-zoom-value'),
      cameraZoomMode: document.getElementById('camera-zoom-mode'),
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
    
    this.init();
  }
  
  init() {
    // Set up canvas with contain-fit sizing
    this.updateCanvasAspectRatio();
    
    // Debounced resize handler to avoid excessive recalculations
    // Path recalculation is expensive, so we wait for resize to settle
    let resizeTimeout = null;
    window.addEventListener('resize', () => {
      // Skip resize handling during animation playback to avoid interrupting zoom transitions
      if (this.animationEngine?.state?.isPlaying) {
        return;
      }
      // Skip resize handling during export to avoid resetting canvas dimensions
      if (this._isExportMode) {
        return;
      }
      
      // Recalculate canvas size with contain-fit for new viewport
      this.updateCanvasAspectRatio();
      
      // Debounce path recalculation (expensive operation)
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        // Recalculate path since pathPoints are in canvas coordinates
        // Waypoints use normalized coords (0-1) so they scale automatically,
        // but pathPoints need recalculation for the new canvas dimensions
        if (this.waypoints.length >= 2) {
          this.calculatePath();
          this.render(); // Re-render with correct path
        }
      }, 100); // 100ms debounce
    });
    
    // Initialize marker style controls
    this.elements.markerStyle.value = this.styles.markerStyle;
    
    // Initialize path shape control
    this.elements.pathShape.value = this.styles.pathShape;
    
    // Initialize path head control values
    this.elements.pathHeadStyle.value = this.styles.pathHead.style;
    this.elements.pathHeadColor.value = this.styles.pathHead.color;
    this.elements.pathHeadSize.value = this.styles.pathHead.size;
    this.elements.pathHeadSizeValue.textContent = this.styles.pathHead.size;
    
    // Show/hide custom image controls based on initial style
    this.elements.customHeadControls.style.display = 
      this.styles.pathHead.style === 'custom' ? 'block' : 'none';
    
    // Initialize animation speed display (right sidebar only - left sidebar Duration removed)
    const defaultDuration = this.animationEngine.state.duration / 1000;
    if (this.elements.animationSpeedValue) {
      this.elements.animationSpeedValue.textContent = defaultDuration + 's';
    }
    if (this.elements.animationSpeedValueRight) {
      this.elements.animationSpeedValueRight.textContent = defaultDuration + 's';
    }
    // Slider value will be set via event after UIController is initialized
    
    // Slider is now properly synchronized after resets
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Set up EventBus listeners for decoupled component communication
    this.setupEventBusListeners();
    
    // Initialize UI Controller and Interaction Handler
    this.uiController = new UIController(this.elements, this.eventBus);
    this.interactionHandler = new InteractionHandler(this.canvas, this.eventBus);
    
    // Initialize Area Drawing Service for polygon draw mode
    this.areaDrawingService = new AreaDrawingService(this.eventBus);
    
    // Initialize Area Edit Service for repositioning/vertex editing
    this.areaEditService = new AreaEditService(this.eventBus);
    
    // Initialize Section Controller for collapsible settings
    this.sectionController = new SectionController(this.eventBus);
    this.sectionController.init();
    this.sectionController.setHelpContent(getInlineHelpHTML());
    
    // Event delegation for data-action buttons (help, shortcuts, etc.)
    document.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      
      const action = actionBtn.dataset.action;
      if (action === 'show-help' || action === 'show-shortcuts') {
        e.preventDefault();
        this.showSplash(); // All help goes through splash modal now
      }
    });
    
    // Initialize Swatch Pickers for colour controls (Okabe-Ito palette)
    attachSwatchPickers();
    
    // Initialize tooltips for all elements with data-tooltip attribute
    attachAllTooltips();
    
    // Initialize parameter definition tooltips (Carbon pattern: click label → description)
    initParamTooltips();
    
    // Initialize dropdown menus
    initAllDropdowns();
    
    // Initialize waypoint list (shows getting started instructions when empty)
    this.updateWaypointList();
    
    // Now that UIController is ready, set the initial slider value
    const defaultSpeed = this.animationEngine.state.speed || ANIMATION.DEFAULT_SPEED;
    this.eventBus.emit('ui:slider:update-speed', defaultSpeed);
    
    // Set up controller event connections
    this.setupControllerEventConnections();
    
    // Show splash on first load
    if (this.storageService.shouldShowSplash()) {
      this.showSplash();
    }
    
    // Load autosave if present
    this.loadAutosave();
    
    // Load default image if no background image is present (for dev testing)
    if (!this.background.image) {
      this.loadDefaultImage();
    }
    
    // Set up AnimationEngine event listeners
    this.setupAnimationEngineListeners();
    
    // Set default animation state: paused at END position
    // This ensures the full path is visible on load for editing
    this.animationEngine.pause();
    this.animationEngine.seekToProgress(1.0);
    
    // Sync UI with initial preview mode and path visibility settings
    this._syncInitialUIState();
    
    // Initial render
    this.render();
    
    // Save initial state so the very first user action is undoable
    this.saveUndoState();
    
    // Start animation loop (runs continuously for rendering)
    this.startRenderLoop();
    
    console.log(`✅ Route Plotter v${APP_VERSION} initialized`);
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
    
    // Sync Trail Size visibility (only shown for comet/instantaneous mode)
    const trailControl = document.getElementById('path-trail-control');
    if (trailControl) {
      trailControl.style.display = (this.motionSettings.pathVisibility === PATH_VISIBILITY.INSTANTANEOUS) ? 'flex' : 'none';
    }
    
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
        this.render();
        this.renderQueued = false;
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
   * Show a toast notification that auto-dismisses
   * @param {string} message - Text to display
   * @param {number} [duration=5000] - Time in ms before auto-dismiss
   */
  showToast(message, duration = 5000) {
    const container = this.elements.toastContainer;
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    const dismiss = document.createElement('button');
    dismiss.className = 'toast-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.textContent = '×';
    toast.appendChild(dismiss);
    
    container.appendChild(toast);
    
    // Trigger enter animation on next frame
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    
    const remove = () => {
      toast.classList.remove('is-visible');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      // Fallback removal if transition doesn't fire
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
    };
    
    dismiss.addEventListener('click', remove);
    if (duration > 0) setTimeout(remove, duration);
  }
  
  deleteWaypoint(waypoint) {
    const index = this.waypoints.indexOf(waypoint);
    if (index > -1) {
      // Remove from array
      this.waypoints.splice(index, 1);
      
      // Remove from ID lookup map
      this._removeWaypointFromMap(waypoint);
      
      // Clear selection if this waypoint was selected
      if (this.selectedWaypoint === waypoint) {
        this.selectedWaypoint = null;
      }
      
      // Emit waypoint deleted event (triggers path recalc, UI update, save)
      // Event-driven approach ensures consistent update sequence
      this.eventBus.emit('waypoint:deleted', index);
      
      this.announce('Waypoint deleted');
    }
  }
  
  /**
   * Clear all waypoints and reset the canvas
   * Resets animation state, clears path data, and triggers a re-render
   */
  clearAll() {
    this.waypoints = []; // Clear Waypoint instances
    this.waypointsById.clear(); // Clear ID lookup map
    this.pathPoints = [];
    this.selectedWaypoint = null;
    
    // Reset animation state via AnimationEngine
    this.animationEngine.reset();
    this.animationEngine.setDuration(0);
    
    this.pause();
    this.updateTimeDisplay();
    this.updateWaypointList();
    
    // Switch to edit mode
    if (this.previewMode) {
      this.previewMode = false;
      this.eventBus.emit('mode:changed', { previewMode: false });
    }
    
    // Emit app:cleared event for SectionController to show help
    this.eventBus.emit('app:cleared');
    
    // Update waypoint editor to show no selection
    if (this.uiController) {
      this.uiController.updateWaypointEditor(null);
    }
    
    // Re-render canvas to clear waypoints visually
    this.render();
    
    console.log('Cleared all waypoints and path');
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
  
  hideSplash() {
    this.elements.splash.style.display = 'none';
    if (this.elements.splashDontShow.checked) {
      this.storageService.markSplashShown();
    }
  }
  
  // ----- Accessibility and persistence helpers -----
  announce(message, priority = 'polite') {
    const el = document.getElementById('announcer');
    if (!el) return;
    el.setAttribute('aria-live', priority);
    el.textContent = message;
    // Clear after a short delay so repeated messages are announced
    setTimeout(() => { el.textContent = ''; }, 2000);
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
      styles: this.styles,
      selectedWaypoint: this.selectedWaypoint,
      
      // Animation state
      animationEngine: this.animationEngine,
      beaconAnimation: this.beaconAnimation,
      
      // Background/overlay (include zoom from export settings)
      background: {
        ...this.background,
        zoom: this.exportSettings.backgroundZoom / 100
      },
      
      // Viewport (zoom/pan)
      viewport: this.viewport,
      
      // Coordinate transform function (bound to this instance)
      imageToCanvas: (x, y, clamp) => this.imageToCanvas(x, y, clamp),
      
      // Coordinate transform service for relative sizing
      coordinateTransform: this.coordinateTransform,
      
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
  loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }
  
  loadDefaultImage() {
    const img = new Image();
    img.onload = () => {
      this.background.image = img;
      this.updateImageTransform(img);
      // Auto-set export resolution to match image
      this.eventBus.emit('video:resolution-native');
      if (this.waypoints.length >= 2) {
        this.calculatePath();
      }
      this.render();
      console.debug('Default image (UoN_map.png) loaded for dev testing');
    };
    img.onerror = (err) => {
      console.warn('Could not load default image:', err);
      // Continue rendering even without image
      this.render();
    };
    img.src = './UoN_map.png';
  }
  
  /**
   * Load an example background image from the images folder
   * @param {string} imagePath - Path to the image (e.g., 'images/Courts.jpg')
   */
  loadExampleImage(imagePath) {
    const img = new Image();
    img.onload = () => {
      this.background.image = img;
      this.updateImageTransform(img);
      // Auto-set export resolution to match image
      this.eventBus.emit('video:resolution-native');
      if (this.waypoints.length >= 2) {
        this.calculatePath();
      }
      this.render();
      this.autoSave();
      console.log(`Example image loaded: ${imagePath}`);
    };
    img.onerror = (err) => {
      console.error(`Failed to load example image: ${imagePath}`, err);
    };
    img.src = imagePath;
  }

  /**
   * Clean up resources and event listeners
   */
  destroy() {
    // Stop animation
    this.animationEngine?.stop();
    
    // Clean up controllers
    this.interactionHandler?.destroy();
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
);

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new RoutePlotter();
});