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
import { CatmullRom } from './utils/CatmullRom.js';
import { Easing } from './utils/Easing.js';
import { RENDERING, ANIMATION, INTERACTION, PATH, VIDEO_EXPORT, MOTION, PATH_VISIBILITY, WAYPOINT_VISIBILITY, BACKGROUND_VISIBILITY, TEXT_LABEL, TEXT_VISIBILITY } from './config/constants.js';
import { TextLabelService } from './services/TextLabelService.js';
import { MotionVisibilityService } from './services/MotionVisibilityService.js';
import { StorageService } from './services/StorageService.js';
import { CoordinateTransform } from './services/CoordinateTransform.js';
import { PathCalculator } from './services/PathCalculator.js';
import { AnimationEngine } from './services/AnimationEngine.js';
import { RenderingService } from './services/RenderingService.js';
import { VideoExporter } from './services/VideoExporter.js';
import { EventBus } from './core/EventBus.js';
import { Waypoint } from './models/Waypoint.js';
import { UIController } from './controllers/UIController.js';
import { InteractionHandler } from './handlers/InteractionHandler.js';
import { getSplashHelpHTML } from './config/helpContent.js';
import { UndoService } from './services/UndoService.js';
import { BEACON_TIMING } from './services/BeaconRenderer.js';
import { SectionController } from './controllers/SectionController.js';
import { AreaDrawingService } from './services/AreaDrawingService.js';
import { AreaEditService } from './services/AreaEditService.js';
import { getInlineHelpHTML } from './config/helpContent.js';
import { attachSwatchPickers, setSwatchPickerEnabled, refreshSwatchPicker } from './components/SwatchPicker.js';
import { attachAllTooltips } from './components/Tooltip.js';
import { initParamTooltips } from './components/ParamTooltip.js';
import { initAllDropdowns } from './components/Dropdown.js';
import { CameraService, CAMERA_DEFAULTS, ZOOM_MODE } from './services/CameraService.js';
import { ImageAssetService, SIZE_LIMITS } from './services/ImageAssetService.js';
import { HTMLExportService } from './services/HTMLExportService.js';

/**
 * Snap a target point to the nearest multiple of snapDeg degrees from a reference point.
 * Preserves the distance between reference and target, only adjusts the angle.
 * @param {number} refX - Reference point X (normalized image coords)
 * @param {number} refY - Reference point Y (normalized image coords)
 * @param {number} targetX - Target point X
 * @param {number} targetY - Target point Y
 * @param {number} [snapDeg=15] - Snap increment in degrees
 * @returns {{x: number, y: number}} Snapped target coordinates
 */
function snapToAngle(refX, refY, targetX, targetY, snapDeg = 15) {
  const dx = targetX - refX;
  const dy = targetY - refY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1e-9) return { x: targetX, y: targetY }; // Same point, nothing to snap
  
  const angle = Math.atan2(dy, dx);
  const snapRad = snapDeg * Math.PI / 180;
  const snappedAngle = Math.round(angle / snapRad) * snapRad;
  
  return {
    x: refX + dist * Math.cos(snappedAngle),
    y: refY + dist * Math.sin(snappedAngle)
  };
}

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
    // Wire up callback for dynamic Grow beacon pause extension
    this.animationEngine.isGrowBeaconAnimating = (waypoint) => 
      this.renderingService.beaconRenderer.isGrowBeaconAnimating(waypoint);
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
   * Update canvas size to match export aspect ratio using contain-fit.
   * Maximizes canvas within available space while maintaining aspect ratio.
   * Called on export resolution change and window resize.
   */
  updateCanvasAspectRatio() {
    const targetAspect = this.exportSettings.resolutionX / this.exportSettings.resolutionY;
    
    // Get available space in canvas-area
    const container = this.canvas.parentElement;
    const playbar = container.querySelector('.controls');
    const playbarHeight = playbar ? playbar.offsetHeight : 60;
    const availableWidth = container.clientWidth;
    const availableHeight = container.clientHeight - playbarHeight;
    const containerAspect = availableWidth / availableHeight;
    
    // Contain fit: use whichever dimension is the constraint
    let canvasWidth, canvasHeight;
    if (targetAspect > containerAspect) {
      // Width-constrained (canvas is wider than container)
      canvasWidth = availableWidth;
      canvasHeight = availableWidth / targetAspect;
    } else {
      // Height-constrained (canvas is taller than container)
      canvasHeight = availableHeight;
      canvasWidth = availableHeight * targetAspect;
    }
    
    // Apply explicit dimensions
    this.canvas.style.width = `${canvasWidth}px`;
    this.canvas.style.height = `${canvasHeight}px`;
    this.canvas.style.aspectRatio = '';
    this.canvas.style.margin = '0';
    
    // Match playbar width to canvas for clean layout
    if (playbar) {
      playbar.style.width = `${canvasWidth}px`;
    }
    
    // Update backing store for HiDPI
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(dpr, 3);
    this.canvasScale = scale;
    this.canvas.width = Math.round(canvasWidth * scale);
    this.canvas.height = Math.round(canvasHeight * scale);
    
    // Reset transform and apply scale
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(scale, scale);
    // Smooth interpolation for background image scaling (bilinear/bicubic).
    // Without this, zoomed raster images use nearest-neighbor (blocky pixels).
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    
    // Update display dimensions
    this.displayWidth = canvasWidth;
    this.displayHeight = canvasHeight;
    
    // Update coordinate transform service
    this.coordinateTransform.setCanvasDimensions(this.displayWidth, this.displayHeight);
    
    // Recalculate image bounds
    if (this.background.image) {
      this.updateImageTransform(this.background.image);
    }
    
    // Recalculate path and render
    if (this.waypoints.length >= 2) {
      this.calculatePath();
    }
    this.render();
    
    console.debug(`📐 [AspectRatio] Canvas set to ${Math.round(canvasWidth)}×${Math.round(canvasHeight)} (${targetAspect.toFixed(2)}:1)`);
  }
  
  /**
   * Calculate the visible image bounds in normalized coordinates (0-1)
   * Accounts for both canvas aspect ratio (cover mode) and zoom level.
   * 
   * Cover mode: image fills canvas, cropping the dimension that overflows.
   * Zoom > 1: crops further into the center
   * Zoom < 1: shrinks image with padding (all of cover-visible area is shown)
   * 
   * @returns {{minX: number, maxX: number, minY: number, maxY: number}} Visible bounds in image coords
   */
  getVisibleImageBounds() {
    // With contain mode rendering, the full image is always visible (no cropping)
    // Waypoint coordinates are stored in normalized image space (0-1)
    // The entire image is always accessible regardless of aspect ratio
    return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  }
  
  /**
   * Clamp all waypoints to stay within the visible canvas bounds
   * Called when zoom changes to prevent waypoints from going out of view
   * Waypoints are clamped to the edge of the visible area
   */
  clampWaypointsToCanvas() {
    const zoom = this.exportSettings.backgroundZoom / 100;
    
    // When zoomed out, waypoints are allowed outside image bounds
    if (zoom < 1) return;
    
    // Clamp waypoints to image bounds (0-1 normalized)
    let clampedCount = 0;
    for (const wp of this.waypoints) {
      if (wp.imgX < 0) { wp.imgX = 0; clampedCount++; }
      else if (wp.imgX > 1) { wp.imgX = 1; clampedCount++; }
      if (wp.imgY < 0) { wp.imgY = 0; clampedCount++; }
      else if (wp.imgY > 1) { wp.imgY = 1; clampedCount++; }
    }
    
    if (clampedCount > 0) {
      if (this.waypoints.length >= 2) {
        this.calculatePath();
      }
      this.showToast(`${clampedCount} waypoint(s) moved to fit within the image at this zoom level`, 4000);
    }
  }
  
  /**
   * Check if a waypoint is visible at the current zoom level
   * @param {Object} waypoint - Waypoint with imgX, imgY normalized coordinates
   * @returns {boolean} True if waypoint is within visible bounds
   */
  isWaypointVisible(waypoint) {
    const bounds = this.getVisibleImageBounds();
    return waypoint.imgX >= bounds.minX && waypoint.imgX <= bounds.maxX &&
           waypoint.imgY >= bounds.minY && waypoint.imgY <= bounds.maxY;
  }
  
  /**
   * Get the visible bounds in normalized coordinates at current zoom
   * @returns {{minX: number, maxX: number, minY: number, maxY: number}} Visible bounds
   */
  getVisibleBounds() {
    return this.getVisibleImageBounds();
  }
  
  setupEventListeners() {
    // Mode switch toggle (header)
    this.elements.modeToggleBtn?.addEventListener('click', () => {
      this._togglePreviewMode();
    });
    
    // Show one-time toast tip (replaces old tip banner)
    this._showPreviewTipToast();
    
    // Example Backgrounds dropdown - handle menu item clicks to load images
    // (Dropdown open/close is handled by initAllDropdowns() in Dropdown.js)
    this.elements.exampleBackgroundsMenu?.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const imagePath = e.target.dataset.image;
        if (imagePath) {
          this.loadExampleImage(imagePath);
        }
      });
    });
    
    // Sidebar tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
      });
    });
    
    // ===== SPLASH SCREEN EVENT LISTENERS =====
    if (this.elements.splashClose) {
      this.elements.splashClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideSplash();
      });
    } else {
      console.error('❌ [Splash] Close button element not found!');
    }
    
    // MOD-01: Close × button in top-right corner
    if (this.elements.splashCloseX) {
      this.elements.splashCloseX.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideSplash();
      });
    }
    
    if (this.elements.splash) {
      this.elements.splash.addEventListener('click', (e) => {
        if (e.target === this.elements.splash) {
          this.hideSplash();
        }
      });
    } else {
      console.error('❌ [Splash] Splash element not found!');
    }
    
    /* Canvas events now handled by InteractionHandler
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    // Drag & drop background image
    this.canvas.addEventListener('dragover', (e) => { e.preventDefault(); });
    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.loadImageFile(file).then((img) => {
          this.background.image = img;
          this.updateImageTransform(img);
          // Auto-set export resolution to match image
          this.eventBus.emit('video:resolution-native');
          // Recalculate path with proper image bounds
          if (this.waypoints.length >= 2) {
            this.calculatePath();
          }
          this.render();
          this.autoSave();
          this.announce('Background image loaded');
        });
      }
    });
    */
    
    /* Header and transport controls now handled by UIController
    this.elements.helpBtn.addEventListener('click', () => this.showSplash());
    this.elements.clearBtn.addEventListener('click', () => this.clearAll());
    
    // Transport controls
    this.elements.playBtn.addEventListener('click', () => this.play());
    this.elements.pauseBtn.addEventListener('click', () => this.pause());
    this.elements.skipStartBtn.addEventListener('click', () => this.skipToStart());
    this.elements.skipEndBtn.addEventListener('click', () => this.skipToEnd());
    
    // Timeline slider - now handled by UIController
    */
    
    // ========== WAYPOINT EDITOR CONTROLS ==========
    // These controls modify per-waypoint style and path properties
    // Style changes: visual only, no path recalculation needed
    // Path property changes: require path recalculation
    
    // Waypoint editor controls
    // Segment color affects path rendering (requires recalculation)
    this.elements.segmentColor.addEventListener('input', (e) => {
      if (this.selectedWaypoint) {
        this.selectedWaypoint.segmentColor = e.target.value;
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });
    
    // Segment width affects path rendering (requires recalculation)
    // Uses log scale: slider 0-1000 → width 1-40 (4x original range)
    this.elements.segmentWidth.addEventListener('input', (e) => {
      if (this.selectedWaypoint) {
        const width = this._sliderToPathWidth(parseFloat(e.target.value));
        this.selectedWaypoint.segmentWidth = width;
        this.elements.segmentWidthValue.textContent = width.toFixed(1);
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });
    
    // Segment style affects path rendering (requires recalculation)
    this.elements.segmentStyle.addEventListener('change', (e) => {
      if (this.selectedWaypoint) {
        this.selectedWaypoint.segmentStyle = e.target.value;
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });
    
    // Path shape control (line, squiggle, randomised) - affects path generation
    this.elements.pathShape.addEventListener('change', (e) => {
      if (this.selectedWaypoint) {
        this.selectedWaypoint.pathShape = e.target.value;
        // Show/hide shape parameter controls
        this._updateShapeParamsVisibility(e.target.value);
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });
    
    // Shape amplitude control (for squiggle/randomised)
    this.elements.shapeAmplitude?.addEventListener('input', (e) => {
      if (this.selectedWaypoint) {
        this.selectedWaypoint.shapeAmplitude = parseInt(e.target.value);
        this.elements.shapeAmplitudeValue.textContent = e.target.value;
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });
    
    // Shape frequency control (for squiggle/randomised)
    this.elements.shapeFrequency?.addEventListener('input', (e) => {
      if (this.selectedWaypoint) {
        this.selectedWaypoint.shapeFrequency = parseInt(e.target.value);
        this.elements.shapeFrequencyValue.textContent = e.target.value;
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });
    
    // Marker style control (dot, square, flag, custom, none) - visual only
    this.elements.markerStyle.addEventListener('change', (e) => {
      if (this.selectedWaypoint) {
        this.selectedWaypoint.markerStyle = e.target.value;
        
        // Show/hide custom marker controls
        if (this.elements.customMarkerControls) {
          this.elements.customMarkerControls.style.display = 
            e.target.value === 'custom' ? 'block' : 'none';
        }
        
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Custom Marker Image Upload
    this.elements.markerUploadBtn?.addEventListener('click', () => {
      this.elements.markerUpload?.click();
    });
    
    this.elements.markerUpload?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file && this.selectedWaypoint) {
        try {
          // Add to asset service (handles deduplication)
          const { asset, isNew, warning } = await this.imageAssetService.addFromFile(file);
          
          if (warning) {
            console.warn(warning);
          }
          
          // Store asset ID on waypoint
          this.selectedWaypoint.customImageAssetId = asset.id;
          this.selectedWaypoint.customImage = await asset.getImageElement();
          
          // Update preview
          if (this.elements.markerPreview) {
            this.elements.markerPreview.style.display = 'block';
            this.elements.markerFilename.textContent = asset.name;
            this.elements.markerPreviewImg.src = asset.base64;
          }
          
          this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
          this.autoSave();
          
          console.log(`📷 Waypoint marker image ${isNew ? 'added' : 'reused'}: ${asset.name} (${asset.getFormattedSize()})`);
        } catch (err) {
          console.error('Failed to load marker image:', err);
          this.announce('Failed to load image');
        }
      }
    });
    
    // Dot color and size controls - visual only, no path recalculation
    this.elements.dotColor.addEventListener('input', (e) => {
      if (this.selectedWaypoint) {
        this.selectedWaypoint.dotColor = e.target.value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Per-waypoint beacon edits (only apply to major waypoints) - visual only
    this.elements.editorBeaconStyle.addEventListener('change', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        const newStyle = e.target.value;
        this.selectedWaypoint.beaconStyle = newStyle;
        
        // Show/hide ripple controls
        this._updateRippleControlsVisibility(newStyle);
        
        // Reset beacon renderer for this waypoint
        this.renderingService.beaconRenderer.resetBeacon(this.selectedWaypoint.id);
        
        // When ripple is selected, ensure rippleWait defaults to true and update pause time
        if (newStyle === 'ripple') {
          // Default rippleWait to true for newly selected ripple effects
          if (this.selectedWaypoint.rippleWait === undefined) {
            this.selectedWaypoint.rippleWait = true;
          }
          // Update the checkbox UI
          if (this.elements.rippleWait) {
            this.elements.rippleWait.checked = this.selectedWaypoint.rippleWait;
          }
          // Recalculate pause time if ripple wait is enabled
          if (this.selectedWaypoint.rippleWait) {
            this._updateRippleWaitTime();
          }
        }
        
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Ripple thickness control
    this.elements.rippleThickness?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.elements.rippleThicknessValue.textContent = `${value}px`;
      if (this.selectedWaypoint) {
        this.selectedWaypoint.rippleThickness = value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Ripple max scale control
    this.elements.rippleMaxScale?.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.elements.rippleMaxScaleValue.textContent = `${value}%`;
      if (this.selectedWaypoint) {
        this.selectedWaypoint.rippleMaxScale = value;
        // Update wait time if ripple wait is enabled
        if (this.selectedWaypoint.rippleWait) {
          this._updateRippleWaitTime();
        }
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Ripple wait checkbox - adds ripple animation time to pause
    this.elements.rippleWait?.addEventListener('change', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        this.selectedWaypoint.rippleWait = e.target.checked;
        this._updateRippleWaitTime();
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });
    
    // Pulse amplitude control
    this.elements.pulseAmplitude?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.elements.pulseAmplitudeValue.textContent = value.toFixed(1);
      if (this.selectedWaypoint) {
        this.selectedWaypoint.pulseAmplitude = value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Pulse cycle speed control
    this.elements.pulseCycleSpeed?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.elements.pulseCycleSpeedValue.textContent = `${value}s`;
      if (this.selectedWaypoint) {
        this.selectedWaypoint.pulseCycleSpeed = value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Note: Beacon color removed - beacons now use marker color (dotColor)
    
    // Label controls (only enabled for major waypoints) - visual only.
    // Auto-names the waypoint from label text when no custom name has been set,
    // so the waypoint list shows meaningful names by default (N6-3: recognition).
    this.elements.waypointLabel.addEventListener('input', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        const text = e.target.value;
        this.selectedWaypoint.label = text;
        // Auto-name: populate waypoint name from label text when no custom name exists
        if (!this.selectedWaypoint.name) {
          this.selectedWaypoint._autoNamed = true;
        }
        if (this.selectedWaypoint._autoNamed) {
          this.selectedWaypoint.name = text;
        }
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    // Label display mode - visual only
    this.elements.labelMode.addEventListener('change', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        this.selectedWaypoint.labelMode = e.target.value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    // Label size with WCAG warning
    this.elements.labelSize?.addEventListener('input', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        const scale = parseInt(e.target.value);
        // Convert 1-10 scale to 16-48px: size = 16 + (scale - 1) * (48 - 16) / 9
        const sizePx = Math.round(TEXT_LABEL.SIZE_PX_MIN + (scale - 1) * (TEXT_LABEL.SIZE_PX_MAX - TEXT_LABEL.SIZE_PX_MIN) / 9);
        this.selectedWaypoint.labelSize = sizePx;
        this.elements.labelSizeValue.textContent = scale;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Label width
    this.elements.labelWidth?.addEventListener('input', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        const width = parseInt(e.target.value);
        this.selectedWaypoint.labelWidth = width;
        this.elements.labelWidthValue.textContent = `${width}%`;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Label X offset
    this.elements.labelOffsetX?.addEventListener('input', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        const offset = parseInt(e.target.value);
        this.selectedWaypoint.labelOffsetX = offset;
        this.elements.labelOffsetXValue.textContent = `${offset}%`;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Label Y offset
    this.elements.labelOffsetY?.addEventListener('input', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        const offset = parseInt(e.target.value);
        this.selectedWaypoint.labelOffsetY = offset;
        this.elements.labelOffsetYValue.textContent = `${offset}%`;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Label auto-position button
    this.elements.labelAutoPosition?.addEventListener('click', () => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor && this.selectedWaypoint.label) {
        const waypointIndex = this.waypoints.indexOf(this.selectedWaypoint);
        const result = TextLabelService.autoPosition({
          waypoint: this.selectedWaypoint,
          waypointIndex,
          waypoints: this.waypoints,
          pathPoints: this.pathPoints,
          canvasWidth: this.canvas.width,
          canvasHeight: this.canvas.height,
          imageToCanvas: (x, y) => this.coordinateTransform.imageToCanvas(x, y)
        });
        
        // Update waypoint and UI
        this.selectedWaypoint.labelOffsetX = Math.round(result.offsetX);
        this.selectedWaypoint.labelOffsetY = Math.round(result.offsetY);
        this.elements.labelOffsetX.value = this.selectedWaypoint.labelOffsetX;
        this.elements.labelOffsetXValue.textContent = `${this.selectedWaypoint.labelOffsetX}%`;
        this.elements.labelOffsetY.value = this.selectedWaypoint.labelOffsetY;
        this.elements.labelOffsetYValue.textContent = `${this.selectedWaypoint.labelOffsetY}%`;
        
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
        console.debug(`Auto-positioned label to (${result.offsetX.toFixed(1)}%, ${result.offsetY.toFixed(1)}%)`);
      }
    });
    
    // Label text color
    this.elements.labelColor?.addEventListener('input', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        this.selectedWaypoint.labelColor = e.target.value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Label background color
    this.elements.labelBgColor?.addEventListener('input', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        this.selectedWaypoint.labelBgColor = e.target.value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Label background opacity
    this.elements.labelBgOpacity?.addEventListener('input', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        const opacity = parseInt(e.target.value) / 100;
        this.selectedWaypoint.labelBgOpacity = opacity;
        this.elements.labelBgOpacityValue.textContent = `${e.target.value}%`;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Path Head Style Controls - global settings (not per-waypoint)
    this.elements.pathHeadStyle.addEventListener('change', (e) => {
      this.styles.pathHead.style = e.target.value;
      
      // Show/hide custom image controls based on style selection
      this.elements.customHeadControls.style.display = 
        e.target.value === 'custom' ? 'block' : 'none';
      
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    this.elements.pathHeadColor.addEventListener('input', (e) => {
      this.styles.pathHead.color = e.target.value;
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    this.elements.pathHeadSize.addEventListener('input', (e) => {
      this.styles.pathHead.size = parseInt(e.target.value);
      this.elements.pathHeadSizeValue.textContent = e.target.value;
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    // Custom Path Head Image Upload
    this.elements.headUploadBtn.addEventListener('click', () => {
      this.elements.headUpload.click();
    });
    
    this.elements.headUpload.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          // Add to asset service (handles deduplication)
          const { asset, isNew, warning } = await this.imageAssetService.addFromFile(file);
          
          if (warning) {
            console.warn(warning);
          }
          
          // Store asset ID and get cached image element
          this.styles.pathHead.imageAssetId = asset.id;
          this.styles.pathHead.image = await asset.getImageElement();
          
          // Update preview
          this.elements.headPreview.style.display = 'block';
          this.elements.headFilename.textContent = asset.name;
          this.elements.headPreviewImg.src = asset.base64;
          
          this.queueRender();
          this.saveUndoState(); // Discrete action — immediate save
          this.autoSave();
          
          console.log(`📷 Path head image ${isNew ? 'added' : 'reused'}: ${asset.name} (${asset.getFormattedSize()})`);
        } catch (err) {
          console.error('Failed to load path head image:', err);
          this.announce('Failed to load image');
        }
      }
    });
    
    // Path head rotation mode (auto follows path direction, fixed stays upright)
    this.elements.headRotationMode?.addEventListener('change', (e) => {
      this.styles.pathHead.rotationMode = e.target.value;
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    // Path head rotation offset (degrees added to auto-rotation)
    this.elements.headRotationOffset?.addEventListener('input', (e) => {
      this.styles.pathHead.rotationOffset = parseInt(e.target.value);
      if (this.elements.headRotationOffsetValue) {
        this.elements.headRotationOffsetValue.textContent = `${e.target.value}°`;
      }
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    // ===== GRAPHICS SCALE SLIDER =====
    // Logarithmic curve: slider (-200..200) → multiplier (0.25..4)
    // Formula: scale = 2^(sliderValue / 100) → center (0) = 1×
    // -200 → 0.25×, -100 → 0.5×, 0 → 1×, +100 → 2×, +200 → 4×
    this.elements.graphicsScale?.addEventListener('input', (e) => {
      const sliderVal = parseInt(e.target.value);
      const scale = Math.pow(2, sliderVal / 100);
      this.styles.graphicsScale = scale;
      this.renderingService.setGraphicsScale(scale);
      
      // Format display: "0.5×", "1×", "2.3×" etc.
      this.elements.graphicsScaleValue.textContent =
        (scale >= 1 ? scale.toFixed(scale === Math.round(scale) ? 0 : 1)
                     : scale.toFixed(2).replace(/0$/, '')) + '×';
      
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    // Double-click to reset to 1× (Nielsen N7: flexibility)
    this.elements.graphicsScale?.addEventListener('dblclick', () => {
      this.elements.graphicsScale.value = 0;
      this.elements.graphicsScale.dispatchEvent(new Event('input'));
    });
    // Tooltip for Graphics Scale label is handled by ParamTooltip (data-tip attr)
    
    // ===== PATH CASING TOGGLE =====
    this.elements.pathCasingToggle?.addEventListener('change', (e) => {
      this.styles.showPathCasing = e.target.checked;
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    // ===== PATH GLOW (toggle + intensity) =====
    // Soft halo beneath the path; visual style only (no path recalc) → queueRender
    // + autoSave, mirroring the casing toggle. Intensity slider 0–100 maps to 0–1.
    this.elements.pathGlowToggle?.addEventListener('change', (e) => {
      this.styles.pathGlow.enabled = e.target.checked;
      if (this.elements.pathGlowIntensity) {
        this.elements.pathGlowIntensity.disabled = !e.target.checked;
      }
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    this.elements.pathGlowIntensity?.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value);
      this.styles.pathGlow.intensity = pct / 100;
      if (this.elements.pathGlowValue) this.elements.pathGlowValue.textContent = pct + '%';
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    // Double-click resets glow intensity to default (Nielsen N7: flexibility)
    this.elements.pathGlowIntensity?.addEventListener('dblclick', () => {
      this.elements.pathGlowIntensity.value = 50;
      this.elements.pathGlowIntensity.dispatchEvent(new Event('input'));
    });
    
    // Dot size - visual only
    this.elements.dotSize.addEventListener('input', (e) => {
      if (this.selectedWaypoint) {
        this.selectedWaypoint.dotSize = parseInt(e.target.value);
        this.elements.dotSizeValue.textContent = e.target.value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Always use constant-speed mode now (animation mode dropdown removed)
    // Animation speed now handled by UIController -> EventBus -> animation:speed-change event
    // Waypoint pause time now handled by UIController -> EventBus -> waypoint:pause-changed event
    
    // Background controls
    this.elements.bgUploadBtn.addEventListener('click', () => this.elements.bgUpload.click());
    this.elements.bgUpload.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        this.loadImageFile(file).then((img) => {
          this.background.image = img;
          this.updateImageTransform(img);
          // Auto-set export resolution to match image
          this.eventBus.emit('video:resolution-native');
          if (this.waypoints.length >= 2) {
            this.calculatePath();
          }
          this.render();
          this.autoSave();
          this.announce('Background image loaded');
        });
      }
    });
    this.elements.bgOverlay.addEventListener('input', (e) => {
      this.background.overlay = parseInt(e.target.value);
      this.elements.bgOverlayValue.textContent = e.target.value;
      this.render();
      this.autoSave();
    });
    // Toggle fit/fill button (deferred — element may not exist)
    this.elements.bgFitToggle?.addEventListener('click', (e) => {
      const currentMode = this.background.fit;
      const newMode = currentMode === 'fit' ? 'fill' : 'fit';
      this.background.fit = newMode;
      
      // Update coordinateTransform with new fit mode
      if (this.background.image) {
        this.updateImageTransform(this.background.image);
      }
      
      // Update button text and data attribute
      e.target.textContent = newMode === 'fit' ? 'Fit' : 'Fill';
      e.target.dataset.mode = newMode;
      
      console.debug('Fit mode changed to:', newMode);
      // Recalculate path since waypoints need to be repositioned
      if (this.waypoints.length >= 2) {
        this.calculatePath();
      }
      this.render();
      this.autoSave();
    });
    
    // ===== CAMERA CONTROLS =====
    // "This Zoom" slider - updates current waypoint's camera.zoom (log scale: 0-1 → 1x-16x)
    this.elements.cameraZoom?.addEventListener('input', (e) => {
      const sliderValue = parseFloat(e.target.value);
      const zoom = CameraService.sliderToZoom(sliderValue);
      
      // Update display immediately for responsive feel
      if (this.elements.cameraZoomValue) {
        this.elements.cameraZoomValue.textContent = CameraService.formatZoom(zoom);
      }
      
      // Update selected waypoint's camera.zoom
      if (this.selectedWaypoint) {
        if (!this.selectedWaypoint.camera) {
          this.selectedWaypoint.camera = { zoom: CAMERA_DEFAULTS.ZOOM, zoomMode: CAMERA_DEFAULTS.ZOOM_MODE };
        }
        this.selectedWaypoint.camera.zoom = zoom;
        this.validateZoomTransitions(); // Check for rate limit warnings
        this.autoSave();
        if (this.previewMode) this.render();
      }
    });
    
    // Camera zoom mode selector (hidden select for backward compatibility)
    this.elements.cameraZoomMode?.addEventListener('change', (e) => {
      if (this.selectedWaypoint) {
        this.selectedWaypoint.camera.zoomMode = e.target.value;
        this.autoSave();
        if (this.previewMode) this.render();
      }
    });
    
    // Camera zoom mode toggle switch (syncs with hidden select)
    this.elements.cameraZoomModeToggle?.addEventListener('click', () => {
      const toggle = this.elements.cameraZoomModeToggle;
      const select = this.elements.cameraZoomMode;
      const isCurrentlyContinuous = toggle.getAttribute('aria-checked') === 'true';
      
      // Toggle state
      const newValue = isCurrentlyContinuous ? 'immediate' : 'continuous';
      toggle.setAttribute('aria-checked', !isCurrentlyContinuous);
      
      // Update labels
      const labels = toggle.parentElement.querySelectorAll('.mode-label');
      labels.forEach(label => {
        label.classList.toggle('active', label.dataset.value === newValue);
      });
      
      // Sync hidden select and trigger change
      if (select) {
        select.value = newValue;
        select.dispatchEvent(new Event('change'));
      }
    });
    
    /**
     * Multi-select zoom slider - updates camera.zoom on all selected waypoints
     * Uses same log scale as single-select: 0-1 → 1x-16x
     */
    this.elements.cameraSelectedZoom?.addEventListener('input', (e) => {
      const sliderValue = parseFloat(e.target.value);
      const zoom = CameraService.sliderToZoom(sliderValue);
      
      // Update display immediately
      if (this.elements.cameraSelectedZoomValue) {
        this.elements.cameraSelectedZoomValue.textContent = CameraService.formatZoom(zoom);
      }
      
      // Get selected waypoints from UIController
      const selectedWaypoints = this.uiController?.selectedWaypoints;
      if (selectedWaypoints && selectedWaypoints.size > 0) {
        // Update zoom on all selected waypoints
        for (const wp of selectedWaypoints) {
          if (!wp.camera) wp.camera = {};
          wp.camera.zoom = zoom;
        }
        this.autoSave();
        if (this.previewMode) this.queueRender();
      }
    });
    
    /* Keyboard shortcuts now handled by InteractionHandler
    document.addEventListener('keydown', (e) => {
      const nudgeAmount = e.shiftKey ? 0.05 : 0.01; // 5% or 1%
      const canvasWidth = this.canvas.width;
      const canvasHeight = this.canvas.height;
      
      switch(e.code) {
        case 'Space':
          e.preventDefault();
          if (this.animationEngine.state.isPlaying && !this.animationEngine.state.isPaused) {
            this.pause();
          } else {
            this.play();
          }
          break;
          
        case 'KeyJ': // 0.5x speed
          this.animationEngine.setPlaybackSpeed(0.5);
          this.announce('Playback speed: 0.5x');
          break;
          
        case 'KeyK': // 1x speed
          this.animationEngine.setPlaybackSpeed(1);
          this.announce('Playback speed: 1x');
          break;
          
        case 'KeyL': // 2x speed
          this.animationEngine.setPlaybackSpeed(2);
          this.announce('Playback speed: 2x');
          break;
          
        case 'ArrowLeft':
          if (this.selectedWaypoint) {
            e.preventDefault();
            // Convert current position to canvas, nudge, then back to image coords (clamped)
            const canvasPos = this.imageToCanvas(this.selectedWaypoint.imgX, this.selectedWaypoint.imgY);
            const newCanvasX = canvasPos.x - nudgeAmount * canvasWidth;
            const newImgPos = this.canvasToImage(newCanvasX, canvasPos.y);
            this.selectedWaypoint.imgX = Math.max(0, Math.min(1, newImgPos.x));
            this.selectedWaypoint.imgY = Math.max(0, Math.min(1, newImgPos.y));
            // Emit position changed event for consistent updates
            this.eventBus.emit('waypoint:position-changed', this.selectedWaypoint);
          }
          break;
          
        case 'ArrowRight':
          if (this.selectedWaypoint) {
            e.preventDefault();
            const canvasPos = this.imageToCanvas(this.selectedWaypoint.imgX, this.selectedWaypoint.imgY);
            const newCanvasX = canvasPos.x + nudgeAmount * canvasWidth;
            const newImgPos = this.canvasToImage(newCanvasX, canvasPos.y);
            this.selectedWaypoint.imgX = Math.max(0, Math.min(1, newImgPos.x));
            this.selectedWaypoint.imgY = Math.max(0, Math.min(1, newImgPos.y));
            // Emit position changed event
            this.eventBus.emit('waypoint:position-changed', this.selectedWaypoint);
          }
          break;
          
        case 'ArrowUp':
          if (this.selectedWaypoint) {
            e.preventDefault();
            const canvasPos = this.imageToCanvas(this.selectedWaypoint.imgX, this.selectedWaypoint.imgY);
            const newCanvasY = canvasPos.y - nudgeAmount * canvasHeight;
            const newImgPos = this.canvasToImage(canvasPos.x, newCanvasY);
            this.selectedWaypoint.imgX = Math.max(0, Math.min(1, newImgPos.x));
            this.selectedWaypoint.imgY = Math.max(0, Math.min(1, newImgPos.y));
            // Emit position changed event
            this.eventBus.emit('waypoint:position-changed', this.selectedWaypoint);
          }
          break;
          
        case 'ArrowDown':
          if (this.selectedWaypoint) {
            e.preventDefault();
            const canvasPos = this.imageToCanvas(this.selectedWaypoint.imgX, this.selectedWaypoint.imgY);
            const newCanvasY = canvasPos.y + nudgeAmount * canvasHeight;
            const newImgPos = this.canvasToImage(canvasPos.x, newCanvasY);
            this.selectedWaypoint.imgX = Math.max(0, Math.min(1, newImgPos.x));
            this.selectedWaypoint.imgY = Math.max(0, Math.min(1, newImgPos.y));
            // Emit position changed event
            this.eventBus.emit('waypoint:position-changed', this.selectedWaypoint);
          }
          break;
          
        case 'Escape':
          if (this.isDragging) {
            this.isDragging = false;
            this.canvas.classList.remove('dragging');
          }
          this.selectedWaypoint = null;
          this.updateWaypointList();
          this.updateWaypointEditor();
          break;
      }
    });
    */
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
     * Fired on every mousemove during drag (with isDragging=true) and
     * on each arrow key nudge. Undo is NOT saved here — instead:
     * - Drag completion: saved by waypoint:drag-ended (immediate)
     * - Arrow key nudge: saved by debounced timer (groups key repeats)
     */
    this.eventBus.on('waypoint:position-changed', (data) => {
      // InteractionHandler passes {waypoint, imgX, imgY, isDragging}
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
    this.eventBus.on('waypoint:drag-ended', (waypoint) => {
      this.saveUndoState(); // Immediate — one entry per drag
      this.updateWaypointList();
      this.autoSave();
    });
    
    /**
     * waypoint:style-changed - Visual properties changed
     * LEAST EXPENSIVE: Only re-render, no path calculation needed
     * Examples: dot color, dot size, marker style, beacon color, label
     */
    this.eventBus.on('waypoint:style-changed', (waypoint) => {
      this.queueRender(); // Visual update only
      this.uiController.updateWaypointList(this.waypoints); // Sync sidebar dots/labels
      this.saveUndoStateDebounced(); // Groups slider drags into single undo entry
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
      
      this.saveUndoStateDebounced();
      this.autoSave();
    });
  }
  
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
     * More intuitive than pixel-based movement as it scales with canvas size
     */
    this.eventBus.on('waypoint:nudge', (data) => {
      const { waypoint, dxFraction, dyFraction } = data;
      
      // Calculate pixel movement based on canvas dimensions
      const dx = dxFraction * this.displayWidth;
      const dy = dyFraction * this.displayHeight;
      
      // Convert current position to canvas coords, apply offset, convert back
      const currentCanvas = this.imageToCanvas(waypoint.imgX, waypoint.imgY);
      const newCanvas = { x: currentCanvas.x + dx, y: currentCanvas.y + dy };
      const newImg = this.canvasToImage(newCanvas.x, newCanvas.y);
      
      // Update waypoint position (clamped to image bounds unless zoomed out)
      const zoom = this.exportSettings.backgroundZoom / 100;
      if (zoom < 1) {
        waypoint.imgX = newImg.x;
        waypoint.imgY = newImg.y;
      } else {
        waypoint.imgX = Math.max(0, Math.min(1, newImg.x));
        waypoint.imgY = Math.max(0, Math.min(1, newImg.y));
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
      }
      
      this.eventBus.emit('waypoint:added', waypoint);
    });
    
    // Note: waypoint:position-changed is handled in _setupEventBusListeners()
    // which applies position, recalculates path, and manages undo saves.
    
    this.eventBus.on('waypoint:selected', (waypoint) => {
      this.selectedWaypoint = waypoint;
      this.interactionHandler?.setSelectedWaypoint(waypoint);
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
    
    // waypoint:multi-selected - Multiple waypoints selected via shift-click or cmd/ctrl-click
    this.eventBus.on('waypoint:multi-selected', ({ waypoints, primary }) => {
      this.selectedWaypoint = primary;
      this.interactionHandler?.setSelectedWaypoint(primary);
      // Show "Multiple Waypoints" mode in editor (similar to "All Waypoints" but for subset)
      this.uiController?.updateWaypointEditor(primary, false, waypoints);
      this.updateWaypointList();
      this._updateCameraControlsVisibility(true); // Multi-select mode
      this.queueRender();
    });
    
    // waypoint:deselected - All waypoints deselected
    this.eventBus.on('waypoint:deselected', () => {
      this.selectedWaypoint = null;
      this.interactionHandler?.setSelectedWaypoint(null);
      this.uiController?.updateWaypointEditor(null);
      this.updateWaypointList();
    });
    
    // waypoint:delete - Request to delete a specific waypoint (from InteractionHandler)
    this.eventBus.on('waypoint:delete', (waypoint) => {
      this.deleteWaypoint(waypoint);
    });
    
    this.eventBus.on('waypoint:delete-selected', () => {
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
    
    // waypoint:all-selected - "All Waypoints" selected in list
    this.eventBus.on('waypoint:all-selected', () => {
      this.selectedWaypoint = null;
      this.interactionHandler?.setSelectedWaypoint(null);
      this.queueRender();
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
      // Name is already set on waypoint, just save
      this.autoSave();
    });
    
    /**
     * waypoint:all-change - Apply property change to all major waypoints
     * 
     * Performance: O(n) where n = number of waypoints
     * - Single pass through waypoints array
     * - Path recalculation only for path-affecting properties
     * - Batched render via queueRender()
     */
    this.eventBus.on('waypoint:all-change', ({ property, value }) => {
      // Properties that require path recalculation
      const PATH_PROPERTIES = new Set(['segmentColor', 'segmentWidth', 'segmentStyle', 'pathShape']);
      // Properties that require animation duration recalculation
      const DURATION_PROPERTIES = new Set(['pauseTime', 'segmentSpeed']);
      
      // Single pass: apply to all major waypoints
      let needsPathRecalc = PATH_PROPERTIES.has(property);
      let needsDurationRecalc = DURATION_PROPERTIES.has(property);
      
      for (const wp of this.waypoints) {
        if (wp.isMajor) {
          wp[property] = value;
          // Also update pauseMode when pauseTime changes
          if (property === 'pauseTime') {
            wp.pauseMode = value > 0 ? 'timed' : 'none';
          }
        }
      }
      
      // Recalculate path only if property affects path rendering
      if (needsPathRecalc) {
        this.calculatePath();
      }
      
      // Recalculate animation duration if pause time or segment speed changed
      if (needsDurationRecalc) {
        this.updateAnimationDuration();
      }
      
      this.autoSave();
      this.queueRender();
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
      // Find all major waypoints and update their order
      const allWaypoints = [...this.waypoints];
      const minorWaypoints = allWaypoints.filter(wp => !wp.isMajor);
      
      // Rebuild waypoints array with new major order, keeping minors in place
      this.waypoints = [];
      let majorIndex = 0;
      
      allWaypoints.forEach(wp => {
        if (wp.isMajor) {
          this.waypoints.push(newOrder[majorIndex]);
          majorIndex++;
        } else {
          this.waypoints.push(wp);
        }
      });
      
      // Recalculate path and update
      if (this.waypoints.length >= 2) {
        this.calculatePath();
      }
      this.updateWaypointList();
      this.autoSave();
      this.render();
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
      this.selectWaypoint(null);
      this.announce('Selection cleared');
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
    
    this.eventBus.on('waypoint:select-all', () => {
      // Select "All Waypoints" option in UI
      this.uiController?.selectAllWaypoints();
      this.announce('All waypoints selected');
    });
    
    // Path head style events
    this.eventBus.on('pathhead:style-changed', (style) => {
      this.styles.pathHead.style = style;
      this.render();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    this.eventBus.on('pathhead:color-changed', (color) => {
      this.styles.pathHead.color = color;
      this.render();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    this.eventBus.on('pathhead:size-changed', (size) => {
      this.styles.pathHead.size = size;
      this.render();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
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
  
  /**
   * Global keyboard shortcut handler
   * 
   * ## Shortcuts
   * | Key | Action |
   * |-----|--------|
   * | Cmd/Ctrl+Z | Undo |
   * | Cmd/Ctrl+Shift+Z | Redo |
   * | Ctrl+Y | Redo (Windows) |
   * | Space | Play/Pause toggle |
   * | K | Pause (JKL style) |
   * | L | Play forward, 2x/4x/8x/16x on repeat |
   * | J | Play reverse, 2x/4x/8x/16x on repeat |
   * 
   * @param {KeyboardEvent} e - Keyboard event
   * @private
   */
  _handleKeyDown(e) {
    // Skip if user is typing in an input field
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }
    
    const key = e.key.toLowerCase();
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
    
    // Undo: Cmd+Z (Mac) or Ctrl+Z (Windows/Linux)
    if (cmdOrCtrl && !e.shiftKey && key === 'z') {
      e.preventDefault();
      this.undo();
      return;
    }
    
    // Redo: Cmd+Shift+Z (Mac) or Ctrl+Shift+Z / Ctrl+Y (Windows/Linux)
    if (cmdOrCtrl && ((e.shiftKey && key === 'z') || key === 'y')) {
      e.preventDefault();
      this.redo();
      return;
    }
    
    // JKL video editor style playback controls
    switch (key) {
      case 'k':
        e.preventDefault();
        this._handleJKL_K();
        return;
      case 'l':
        e.preventDefault();
        this._handleJKL_L();
        return;
      case 'j':
        e.preventDefault();
        this._handleJKL_J();
        return;
      case ' ':
        e.preventDefault();
        this.animationEngine.togglePlayPause();
        this._updatePlayPauseUI();
        return;
    }
  }
  
  // ========== UNDO/REDO METHODS ==========
  
  /**
   * Get current undoable state snapshot.
   * Includes waypoints (with all per-waypoint properties) and global styles.
   * @returns {Object} State object for undo history
   * @private
   */
  _getUndoableState() {
    // Serialize global styles without non-serializable Image objects
    const stylesCopy = { ...this.styles };
    if (stylesCopy.pathHead) {
      stylesCopy.pathHead = { ...stylesCopy.pathHead, image: null };
    }
    return {
      waypoints: this.waypoints.map(wp => wp.toJSON()),
      selectedWaypointId: this.selectedWaypoint?.id || null,
      styles: stylesCopy
    };
  }
  
  /**
   * Save current state to undo history immediately.
   * Use for discrete, non-repeating actions (add/delete waypoint).
   */
  saveUndoState() {
    // Cancel any pending debounced save to avoid duplicates
    if (this._undoDebounceTimer) {
      clearTimeout(this._undoDebounceTimer);
      this._undoDebounceTimer = null;
    }
    this.undoService.saveState(this._getUndoableState());
  }
  
  /**
   * Save current state to undo history after a debounce delay.
   * Groups rapid-fire changes (slider drags, arrow key holds) into a single
   * undo entry. The 400ms window naturally collapses continuous interactions.
   * Discrete changes (dropdown, checkbox) also use this — the brief delay
   * is imperceptible to users.
   */
  saveUndoStateDebounced() {
    if (this._undoDebounceTimer) {
      clearTimeout(this._undoDebounceTimer);
    }
    this._undoDebounceTimer = setTimeout(() => {
      this._undoDebounceTimer = null;
      this.undoService.saveState(this._getUndoableState());
    }, 400);
  }
  
  /**
   * Flush any pending debounced undo save immediately.
   * Called before undo/redo to ensure the current state is captured.
   * @private
   */
  _flushPendingUndo() {
    if (this._undoDebounceTimer) {
      clearTimeout(this._undoDebounceTimer);
      this._undoDebounceTimer = null;
      this.undoService.saveState(this._getUndoableState());
    }
  }
  
  /**
   * Undo the last action
   */
  undo() {
    this._flushPendingUndo();
    const state = this.undoService.undo();
    if (state) {
      this._restoreState(state);
      this.announce('Undo');
    }
  }
  
  /**
   * Redo the last undone action
   */
  redo() {
    this._flushPendingUndo();
    const state = this.undoService.redo();
    if (state) {
      this._restoreState(state);
      this.announce('Redo');
    }
  }
  
  /**
   * Restore application state from undo/redo.
   * Restores waypoints, selection, and global styles, then syncs all UI.
   * @param {Object} state - State snapshot to restore
   * @private
   */
  _restoreState(state) {
    // Clear waypoint map
    this.waypointsById.clear();
    
    // Restore waypoints
    this.waypoints = state.waypoints.map(wpData => Waypoint.fromJSON(wpData));
    this.waypoints.forEach(wp => this._addWaypointToMap(wp));
    
    // Restore selection
    this.selectedWaypoint = state.selectedWaypointId 
      ? this.waypointsById.get(state.selectedWaypointId) || null
      : null;
    
    // Restore global styles (if present in snapshot)
    if (state.styles) {
      // Preserve non-serializable Image reference
      const currentImage = this.styles.pathHead?.image;
      this.styles = { ...this.styles, ...state.styles };
      if (this.styles.pathHead) {
        this.styles.pathHead.image = currentImage;
      }
      // Restore path head image from asset if ID changed
      if (state.styles.pathHead?.imageAssetId) {
        this.imageAssetService.getImageElement(state.styles.pathHead.imageAssetId)
          .then(img => {
            if (img) this.styles.pathHead.image = img;
            this.queueRender();
          });
      }
      // Sync global style UI controls
      this._syncGlobalStyleUI();
    }
    
    // Invalidate caches
    this._majorWaypointsCache = null;
    
    // Recalculate and render
    if (this.waypoints.length >= 2) {
      this.calculatePath();
    } else {
      this.pathPoints = [];
    }
    this.updateWaypointList();
    this.updateWaypointEditor();
    
    // Sync swatch pickers to restored waypoint colors
    refreshSwatchPicker('#dot-color');
    refreshSwatchPicker('#segment-color');
    refreshSwatchPicker('#path-head-color');
    
    this.render();
    this.autoSave();
  }
  
  /**
   * Sync global style UI controls with current this.styles values.
   * Called after undo/redo restores global styles.
   * @private
   */
  _syncGlobalStyleUI() {
    const ph = this.styles.pathHead;
    if (this.elements.pathHeadStyle) this.elements.pathHeadStyle.value = ph.style;
    if (this.elements.pathHeadColor) this.elements.pathHeadColor.value = ph.color;
    if (this.elements.pathHeadSize) {
      this.elements.pathHeadSize.value = ph.size;
      if (this.elements.pathHeadSizeValue) this.elements.pathHeadSizeValue.textContent = ph.size;
    }
    if (this.elements.customHeadControls) {
      this.elements.customHeadControls.style.display = ph.style === 'custom' ? 'block' : 'none';
    }
    if (this.elements.headRotationMode) this.elements.headRotationMode.value = ph.rotationMode || 'auto';
    if (this.elements.headRotationOffset) {
      this.elements.headRotationOffset.value = ph.rotationOffset || 0;
      if (this.elements.headRotationOffsetValue) {
        this.elements.headRotationOffsetValue.textContent = `${ph.rotationOffset || 0}°`;
      }
    }
    // Sync graphics scale slider and RenderingService
    const gs = this.styles.graphicsScale ?? 1;
    this.renderingService.setGraphicsScale(gs);
    if (this.elements.graphicsScale) {
      // Inverse of scale = 2^(v/100) → v = log2(scale) * 100
      this.elements.graphicsScale.value = Math.round(Math.log2(gs) * 100);
    }
    if (this.elements.graphicsScaleValue) {
      this.elements.graphicsScaleValue.textContent =
        (gs >= 1 ? gs.toFixed(gs === Math.round(gs) ? 0 : 1)
                  : gs.toFixed(2).replace(/0$/, '')) + '×';
    }
    // Sync path casing toggle
    if (this.elements.pathCasingToggle) {
      this.elements.pathCasingToggle.checked = this.styles.showPathCasing !== false;
    }
    // Sync path glow toggle + intensity (older saves without pathGlow default to off)
    const glow = this.styles.pathGlow || { enabled: false, intensity: 0.5 };
    const glowPct = Math.round((glow.intensity ?? 0.5) * 100);
    if (this.elements.pathGlowToggle) {
      this.elements.pathGlowToggle.checked = glow.enabled === true;
    }
    if (this.elements.pathGlowIntensity) {
      this.elements.pathGlowIntensity.value = glowPct;
      this.elements.pathGlowIntensity.disabled = glow.enabled !== true;
    }
    if (this.elements.pathGlowValue) {
      this.elements.pathGlowValue.textContent = glowPct + '%';
    }
  }
  
  // ========== JKL PLAYBACK METHODS ==========
  // Video editor style playback controls (like Premiere Pro, Final Cut, etc.)
  // State tracked via: _jklDirection (-1=reverse, 0=stopped, 1=forward)
  //                    _jklSpeedMultiplier (1, 2, 4, 8, 16)
  // These are temporary playback speeds, not saved to settings
  
  /** @constant {number} Maximum JKL speed multiplier (4 doublings from 1x) */
  static JKL_MAX_SPEED = 16;
  
  /**
   * Reset JKL playback state to defaults
   * Called on pause, stop, reset, and complete events
   * Ensures next L/J press starts fresh at 1x speed
   * @private
   */
  _resetJKLState() {
    this._jklSpeedMultiplier = 1;
    this._jklDirection = 0;
  }
  
  /**
   * K key: Pause playback and reset JKL state
   * Resets speed multiplier to 1x for next L/J press
   * @private
   */
  _handleJKL_K() {
    this.animationEngine.pause();
    // Note: _resetJKLState() will be called by animation:pause event handler
    this._updatePlayPauseUI();
  }
  
  /**
   * L key: Play forward with speed doubling
   * - First press: Play at 1x
   * - Subsequent presses: Double speed (2x → 4x → 8x → 16x)
   * - At 16x: No further effect
   * @private
   */
  _handleJKL_L() {
    const isPlaying = this.animationEngine.state.isPlaying && !this.animationEngine.state.isPaused;
    const wasForward = this._jklDirection === 1;
    
    if (!isPlaying || !wasForward) {
      // Start playing forward at 1x
      this._jklSpeedMultiplier = 1;
      this._jklDirection = 1;
      this.animationEngine.setPlaybackSpeed(1);
      this.animationEngine.play();
    } else if (this._jklSpeedMultiplier < RoutePlotter.JKL_MAX_SPEED) {
      // Double the speed
      this._jklSpeedMultiplier *= 2;
      this.animationEngine.setPlaybackSpeed(this._jklSpeedMultiplier);
    }
    
    this._updatePlayPauseUI();
    console.debug(`▶️ [JKL] Forward ${this._jklSpeedMultiplier}x`);
  }
  
  /**
   * J key: Play reverse with speed doubling
   * - First press: Play reverse at 1x
   * - Subsequent presses: Double speed (-2x → -4x → -8x → -16x)
   * - At -16x: No further effect
   * @private
   */
  _handleJKL_J() {
    const isPlaying = this.animationEngine.state.isPlaying && !this.animationEngine.state.isPaused;
    const wasReverse = this._jklDirection === -1;
    
    if (!isPlaying || !wasReverse) {
      // Start playing reverse at 1x
      this._jklSpeedMultiplier = 1;
      this._jklDirection = -1;
      this.animationEngine.setPlaybackSpeed(-1);
      this.animationEngine.play();
    } else if (this._jklSpeedMultiplier < RoutePlotter.JKL_MAX_SPEED) {
      // Double the reverse speed
      this._jklSpeedMultiplier *= 2;
      this.animationEngine.setPlaybackSpeed(-this._jklSpeedMultiplier);
    }
    
    this._updatePlayPauseUI();
    console.debug(`◀️ [JKL] Reverse ${this._jklSpeedMultiplier}x`);
  }
  
  /**
   * Update play/pause button visibility based on animation state
   * Called after any playback state change
   * @private
   */
  _updatePlayPauseUI() {
    const isPlaying = this.animationEngine.state.isPlaying && !this.animationEngine.state.isPaused;
    if (this.elements.playBtn) {
      this.elements.playBtn.style.display = isPlaying ? 'none' : '';
    }
    if (this.elements.pauseBtn) {
      this.elements.pauseBtn.style.display = isPlaying ? '' : 'none';
    }
  }
  
  /**
   * Update the mode switch UI to reflect current preview mode state
   * @private
   */
  _updateModeSwitch() {
    if (this.elements.modeToggleBtn) {
      this.elements.modeToggleBtn.setAttribute('aria-checked', this.previewMode);
    }
    if (this.elements.modeLabelEdit) {
      this.elements.modeLabelEdit.classList.toggle('active', !this.previewMode);
    }
    if (this.elements.modeLabelPreview) {
      this.elements.modeLabelPreview.classList.toggle('active', this.previewMode);
    }
  }
  
  /**
   * Set preview mode to a specific value
   * HDR-05: Replaces toggle for segmented control
   * @param {boolean} isPreview - Whether to enable preview mode
   * @private
   */
  _setPreviewMode(isPreview) {
    if (this.previewMode === isPreview) return; // No change
    this.previewMode = isPreview;
    this._updateModeSwitch();
    this.eventBus.emit('motion:preview-mode-change', this.previewMode);
    console.debug(`👁️ [Mode] Switched to ${this.previewMode ? 'Preview' : 'Edit'} mode`);
  }
  
  /**
   * Toggle preview mode and update UI
   * @deprecated Use _setPreviewMode instead
   * @private
   */
  _togglePreviewMode() {
    this._setPreviewMode(!this.previewMode);
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
  
  /**
   * Show one-time preview tip as a toast (replaces old tip banner)
   * @private
   */
  _showPreviewTipToast() {
    const STORAGE_KEY = 'routePlotter_previewTipDismissed';
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    
    // Show after a brief delay so UI settles first
    setTimeout(() => {
      this.showToast('Tip: Check your sequence in Preview mode before exporting', 8000);
      localStorage.setItem(STORAGE_KEY, 'true');
    }, 1500);
  }
  
  /**
   * Show/hide ripple-specific controls based on beacon style
   * @param {string} beaconStyle - Current beacon style
   * @private
   */
  _updateBeaconControlsVisibility(beaconStyle) {
    // Show/hide ripple controls
    if (this.elements.rippleControls) {
      this.elements.rippleControls.style.display = beaconStyle === 'ripple' ? 'block' : 'none';
    }
    // Show/hide pulse controls
    if (this.elements.pulseControls) {
      this.elements.pulseControls.style.display = beaconStyle === 'pulse' ? 'block' : 'none';
    }
  }
  
  /**
   * @deprecated Use _updateBeaconControlsVisibility instead
   */
  _updateRippleControlsVisibility(beaconStyle) {
    this._updateBeaconControlsVisibility(beaconStyle);
  }
  
  /**
   * Convert slider value (0-1000) to path width (1-40)
   * Uses logarithmic scale for finer control at lower values
   * @param {number} sliderValue - Slider position 0-1000
   * @returns {number} Path width 1-40
   * @private
   */
  _sliderToPathWidth(sliderValue) {
    const minWidth = 1;
    const maxWidth = 40;
    // Log scale: width = minWidth * (maxWidth/minWidth)^(slider/1000)
    // This gives: 0 -> 1, 1000 -> 40
    const ratio = sliderValue / 1000;
    const width = minWidth * Math.pow(maxWidth / minWidth, ratio);
    return Math.max(minWidth, Math.min(maxWidth, width));
  }
  
  /**
   * Convert path width (1-40) to slider value (0-1000)
   * Inverse of _sliderToPathWidth
   * @param {number} width - Path width 1-40
   * @returns {number} Slider position 0-1000
   * @private
   */
  _pathWidthToSlider(width) {
    const minWidth = 1;
    const maxWidth = 40;
    // Clamp width to valid range
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, width));
    // Inverse of log scale: slider = 1000 * log(width/minWidth) / log(maxWidth/minWidth)
    const ratio = Math.log(clampedWidth / minWidth) / Math.log(maxWidth / minWidth);
    return Math.round(ratio * 1000);
  }
  
  /**
   * Show/hide shape parameter controls based on selected shape
   * @param {string} shape - The path shape (line, squiggle, randomised)
   * @private
   */
  _updateShapeParamsVisibility(shape) {
    if (this.elements.shapeParamsControls) {
      const showParams = shape === 'squiggle' || shape === 'randomised';
      this.elements.shapeParamsControls.style.display = showParams ? 'block' : 'none';
    }
  }
  
  /**
   * Update pause time based on ripple animation duration
   * 
   * Formula: totalTime = (maxScale / 1000) × RIPPLE_COUNT seconds
   * - Each ring takes (maxScale / 1000) seconds to complete its full animation
   * - Rings spawn at intervals equal to their duration
   * - Wait until the LAST ring has FINISHED (not just started)
   * - Example: 4 rings at 1000% scale = 4 × 1s = 4s total
   * 
   * @private
   */
  _updateRippleWaitTime() {
    if (!this.selectedWaypoint) return;
    
    const maxScale = this.selectedWaypoint.rippleMaxScale || 1000;
    
    if (this.selectedWaypoint.rippleWait && this.selectedWaypoint.beaconStyle === 'ripple') {
      // Calculate total ripple animation time using constants
      // Each ring takes (maxScale / 1000) seconds to complete its growth and fade
      // Rings spawn at intervals equal to their duration
      // Wait until the LAST ring has FINISHED (not just started)
      // Formula: (RIPPLE_COUNT rings × durationPerRing) = time when last ring finishes
      const durationPerRing = maxScale / 1000; // seconds (1000% = 1s)
      const totalRippleTime = durationPerRing * BEACON_TIMING.RIPPLE_COUNT; // All rings complete
      
      // Set pause time to match ripple animation
      this.selectedWaypoint.pauseTime = totalRippleTime * 1000; // convert to ms
      this.selectedWaypoint.pauseMode = 'timed';
      
      // Update UI via UIController
      if (this.uiController && this.elements.waypointPauseTime) {
        this.elements.waypointPauseTime.value = this.uiController.pauseTimeToSlider(totalRippleTime);
        this.elements.waypointPauseTimeValue.textContent = `${totalRippleTime.toFixed(1)}s`;
      }
      
      console.debug(`🔔 [Beacon] Ripple wait enabled - set pause time to ${totalRippleTime.toFixed(1)}s`);
    }
    
    // Trigger animation duration recalculation
    this.updateAnimationDuration();
  }
  
  /* Mouse handlers now managed by InteractionHandler
  handleMouseDown(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if clicking on existing waypoint
    const clickedWaypoint = this.findWaypointAt(x, y);
    
    if (clickedWaypoint) {
      this.selectedWaypoint = clickedWaypoint;
      this.isDragging = true;
      this.hasDragged = false; // Reset drag flag
      // Store canvas offset for smooth dragging
      const wpCanvas = this.imageToCanvas(clickedWaypoint.imgX, clickedWaypoint.imgY);
      this.dragOffset.x = x - wpCanvas.x;
      this.dragOffset.y = y - wpCanvas.y;
      this.canvas.classList.add('dragging');
      
      // Emit selection event (updates editor UI)
      this.eventBus.emit('waypoint:selected', clickedWaypoint);
      this.updateWaypointList(); // Update list to show selection
      event.preventDefault();
    }
  }
  
  handleMouseMove(event) {
    if (this.isDragging && this.selectedWaypoint) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Convert canvas position to image coordinates (clamped to bounds)
      const canvasX = x - this.dragOffset.x;
      const canvasY = y - this.dragOffset.y;
      const imgPos = this.canvasToImage(canvasX, canvasY);
      this.selectedWaypoint.imgX = Math.max(0, Math.min(1, imgPos.x));
      this.selectedWaypoint.imgY = Math.max(0, Math.min(1, imgPos.y));
      this.hasDragged = true; // Mark that actual dragging occurred
      
      // Update path immediately for smooth visual feedback during drag
      this.calculatePath();
      // Batch render calls to prevent excessive rendering (60fps → ~2-3fps)
      this.queueRender();
    }
  }
  
  handleMouseUp(event) {
    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.classList.remove('dragging');
      
      // Emit position changed event if waypoint was actually moved
      // This triggers single auto-save instead of 60+ during drag
      if (this.hasDragged && this.selectedWaypoint) {
        this.eventBus.emit('waypoint:position-changed', this.selectedWaypoint);
        this.hasDragged = false;
        this.announce('Waypoint moved');
      }
      
      this.updateWaypointList();
    }
  }
  
  handleCanvasClick(event) {
    // Don't add waypoint if we actually dragged
    if (this.hasDragged) {
      this.hasDragged = false; // Reset for next time
      return;
    }
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if clicking on existing waypoint for selection
    const clickedWaypoint = this.findWaypointAt(x, y);
    if (clickedWaypoint) {
      this.selectedWaypoint = clickedWaypoint;
      this.updateWaypointList();
      this.updateWaypointEditor();
      return;
    }
    
    // Determine if major or minor waypoint (Shift+Click for minor)
    const isMajor = !event.shiftKey;
    
    // Convert canvas coordinates to normalized image coordinates
    const imgPos = this.canvasToImage(x, y);
    
    // Create waypoint using factory method
    // Waypoint model handles default properties and validation
    const waypoint = isMajor
      ? Waypoint.createMajor(imgPos.x, imgPos.y)
      : Waypoint.createMinor(imgPos.x, imgPos.y);
    
    // Set default label for major waypoints
    if (isMajor) {
      waypoint.label = `Waypoint ${this.waypoints.length + 1}`;
    }
    
    // Inherit properties from previous waypoint if exists
    // This ensures consistent styling across the route
    if (this.waypoints.length > 0) {
      const previousWaypoint = this.waypoints[this.waypoints.length - 1];
      waypoint.copyPropertiesFrom(previousWaypoint);
    }
    
    // Add waypoint to array
    this.waypoints.push(waypoint);
    
    // Emit waypoint added event (triggers path calculation, save, render)
    // Decoupled approach prevents tight coupling to specific update sequence
    this.eventBus.emit('waypoint:added', waypoint);
    
    this.announce(`${isMajor ? 'Major' : 'Minor'} waypoint added`);
    console.log(`Added ${isMajor ? 'major' : 'minor'} waypoint at (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }
  */ // End of mouse/keyboard handlers now managed by InteractionHandler
  
  /**
   * Find waypoint at screen coordinates (from mouse click)
   * 
   * @param {number} screenX - X coordinate in screen space (CSS pixels)
   * @param {number} screenY - Y coordinate in screen space (CSS pixels)
   * @returns {Waypoint|undefined} Waypoint at position, or undefined
   */
  findWaypointAt(screenX, screenY) {
    // Convert screen coords to canvas coords (inverse viewport transform)
    const click = this.screenToCanvas(screenX, screenY);
    
    // Zoom-aware hit radius: constant in screen space, shrinks in canvas space when zoomed
    const zoom = this.viewport?.zoom || 1;
    const threshold = INTERACTION.WAYPOINT_HIT_RADIUS / zoom;
    
    // Find the closest waypoint within the threshold (not first-match)
    let closest = null;
    let closestDist = Infinity;
    
    for (const wp of this.waypoints) {
      const wpCanvas = this.imageToCanvas(wp.imgX, wp.imgY);
      const dx = wpCanvas.x - click.x;
      const dy = wpCanvas.y - click.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= threshold && dist < closestDist) {
        closest = wp;
        closestDist = dist;
      }
    }
    
    return closest;
  }
  
  updateWaypointList() {
    // Set display indices for waypoints (1-based, major only)
    let majorIndex = 1;
    this.waypoints.forEach(wp => {
      if (wp.isMajor) {
        wp._displayIndex = majorIndex++;
      }
    });
    
    // Emit event for SectionController to update UI state
    this.eventBus.emit('waypoint:list-updated', this.waypoints);
    
    // Delegate to UIController
    if (this.uiController) {
      this.uiController.updateWaypointList(this.waypoints);
      return;
    }
    
    // Fallback if UIController not initialized
    this.elements.waypointList.innerHTML = '';
    const majorWaypoints = this.waypoints.filter(wp => wp.isMajor);
    
    majorWaypoints.forEach((waypoint, index) => {
      const item = document.createElement('div');
      item.className = 'waypoint-item';
      if (waypoint === this.selectedWaypoint) {
        item.classList.add('selected');
      }
      
      // Header row
      const handle = document.createElement('span');
      handle.className = 'waypoint-item-handle';
      handle.textContent = '☰';
      const label = document.createElement('span');
      label.className = 'waypoint-item-label';
      label.textContent = `Waypoint ${index + 1}`;
      const delBtn = document.createElement('button');
      delBtn.className = 'waypoint-item-delete';
      delBtn.textContent = '×';
      
      item.appendChild(handle);
      item.appendChild(label);
      item.appendChild(delBtn);
      
      // Selection by clicking header bits
      const selectWaypoint = (e) => {
        e.stopPropagation();
        this.selectedWaypoint = waypoint;
        this.updateWaypointList();
        this.updateWaypointEditor();
      };
      label.addEventListener('click', selectWaypoint);
      handle.addEventListener('click', selectWaypoint);
      item.addEventListener('click', selectWaypoint);
      
      // Delete button
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteWaypoint(waypoint);
      });
      
      this.elements.waypointList.appendChild(item);
    });
  }
  
  updateWaypointEditor() {
    if (this.selectedWaypoint) {
      // Note: Section visibility now handled by SectionController via events
      
      // Path properties
      this.elements.segmentColor.value = this.selectedWaypoint.segmentColor;
      // Use log scale conversion for segment width
      const width = this.selectedWaypoint.segmentWidth || 3;
      this.elements.segmentWidth.value = this._pathWidthToSlider(width);
      this.elements.segmentWidthValue.textContent = width.toFixed(1);
      this.elements.segmentStyle.value = this.selectedWaypoint.segmentStyle || 'solid';
      this.elements.pathShape.value = this.selectedWaypoint.pathShape || 'line';
      
      // Shape parameters (amplitude/frequency for squiggle/randomised)
      const shapeAmplitude = this.selectedWaypoint.shapeAmplitude !== undefined ? this.selectedWaypoint.shapeAmplitude : 10;
      const shapeFrequency = this.selectedWaypoint.shapeFrequency !== undefined ? this.selectedWaypoint.shapeFrequency : 5;
      if (this.elements.shapeAmplitude) {
        this.elements.shapeAmplitude.value = shapeAmplitude;
        this.elements.shapeAmplitudeValue.textContent = shapeAmplitude;
      }
      if (this.elements.shapeFrequency) {
        this.elements.shapeFrequency.value = shapeFrequency;
        this.elements.shapeFrequencyValue.textContent = shapeFrequency;
      }
      this._updateShapeParamsVisibility(this.selectedWaypoint.pathShape || 'line');
      
      // Marker properties
      this.elements.markerStyle.value = this.selectedWaypoint.markerStyle || 'dot';
      this.elements.dotColor.value = this.selectedWaypoint.dotColor || this.selectedWaypoint.segmentColor || this.styles.dotColor;
      this.elements.dotSize.value = this.selectedWaypoint.dotSize || this.styles.dotSize;
      this.elements.dotSizeValue.textContent = this.elements.dotSize.value;
      
      // Custom marker controls visibility
      const markerStyle = this.selectedWaypoint.markerStyle || 'dot';
      if (this.elements.customMarkerControls) {
        this.elements.customMarkerControls.style.display = markerStyle === 'custom' ? 'block' : 'none';
      }
      
      // Update custom marker preview if asset exists
      if (this.selectedWaypoint.customImageAssetId && this.elements.markerPreview) {
        const asset = this.imageAssetService.getAsset(this.selectedWaypoint.customImageAssetId);
        if (asset) {
          this.elements.markerPreview.style.display = 'block';
          this.elements.markerFilename.textContent = asset.name;
          this.elements.markerPreviewImg.src = asset.base64;
        }
      } else if (this.elements.markerPreview) {
        this.elements.markerPreview.style.display = 'none';
      }
      
      // Path head properties
      this.elements.pathHeadStyle.value = this.selectedWaypoint.pathHeadStyle || this.styles.pathHead.style;
      this.elements.pathHeadColor.value = this.selectedWaypoint.pathHeadColor || this.styles.pathHead.color;
      this.elements.pathHeadSize.value = this.selectedWaypoint.pathHeadSize || this.styles.pathHead.size;
      this.elements.pathHeadSizeValue.textContent = this.elements.pathHeadSize.value;
      this.elements.customHeadControls.style.display = 
        (this.selectedWaypoint.pathHeadStyle || this.styles.pathHead.style) === 'custom' ? 'block' : 'none';
      // Beacon editor fields
      if (this.selectedWaypoint.isMajor) {
        // Enable dot & beacon controls for major
        this.elements.dotColor.disabled = false;
        this.elements.dotSize.disabled = false;
        this.elements.editorBeaconStyle.disabled = false;
        this.elements.editorBeaconStyle.value = this.selectedWaypoint.beaconStyle || 'none';
        
        // Show/hide ripple controls and sync values
        const beaconStyle = this.selectedWaypoint.beaconStyle || 'none';
        this._updateRippleControlsVisibility(beaconStyle);
        if (this.elements.rippleThickness) {
          this.elements.rippleThickness.value = this.selectedWaypoint.rippleThickness || 2;
          this.elements.rippleThicknessValue.textContent = `${this.elements.rippleThickness.value}px`;
        }
        if (this.elements.rippleMaxScale) {
          this.elements.rippleMaxScale.value = this.selectedWaypoint.rippleMaxScale || 1000;
          this.elements.rippleMaxScaleValue.textContent = `${this.elements.rippleMaxScale.value}%`;
        }
        if (this.elements.rippleWait) {
          this.elements.rippleWait.checked = this.selectedWaypoint.rippleWait !== undefined 
            ? this.selectedWaypoint.rippleWait 
            : true; // Default to checked
        }
        
        // Sync pulse controls
        if (this.elements.pulseAmplitude) {
          const amplitude = this.selectedWaypoint.pulseAmplitude !== undefined 
            ? this.selectedWaypoint.pulseAmplitude 
            : 1.0;
          this.elements.pulseAmplitude.value = amplitude;
          this.elements.pulseAmplitudeValue.textContent = amplitude.toFixed(1);
        }
        if (this.elements.pulseCycleSpeed) {
          const cycleSpeed = this.selectedWaypoint.pulseCycleSpeed !== undefined 
            ? this.selectedWaypoint.pulseCycleSpeed 
            : 4.0;
          this.elements.pulseCycleSpeed.value = cycleSpeed;
          this.elements.pulseCycleSpeedValue.textContent = `${cycleSpeed}s`;
        }
        
        // Label controls
        this.elements.waypointLabel.disabled = false;
        this.elements.labelMode.disabled = false;
        this.elements.waypointLabel.value = this.selectedWaypoint.label || '';
        this.elements.labelMode.value = this.selectedWaypoint.labelMode || TEXT_VISIBILITY.FADE_UP;
        
        // Label size (convert px to 1-10 scale)
        if (this.elements.labelSize) {
          const sizePx = this.selectedWaypoint.labelSize || TEXT_LABEL.SIZE_DEFAULT;
          // Convert 16-48px to 1-10 scale: scale = 1 + (sizePx - 16) * 9 / (48 - 16)
          const scale = Math.round(1 + (sizePx - TEXT_LABEL.SIZE_PX_MIN) * 9 / (TEXT_LABEL.SIZE_PX_MAX - TEXT_LABEL.SIZE_PX_MIN));
          this.elements.labelSize.value = Math.max(1, Math.min(10, scale));
          this.elements.labelSizeValue.textContent = scale;
        }
        
        // Label width
        if (this.elements.labelWidth) {
          const width = this.selectedWaypoint.labelWidth || TEXT_LABEL.WIDTH_DEFAULT;
          this.elements.labelWidth.value = width;
          this.elements.labelWidthValue.textContent = `${width}%`;
        }
        
        // Label offsets
        if (this.elements.labelOffsetX) {
          const offsetX = this.selectedWaypoint.labelOffsetX !== undefined ? this.selectedWaypoint.labelOffsetX : TEXT_LABEL.OFFSET_DEFAULT_X;
          this.elements.labelOffsetX.value = offsetX;
          this.elements.labelOffsetXValue.textContent = `${offsetX}%`;
        }
        if (this.elements.labelOffsetY) {
          const offsetY = this.selectedWaypoint.labelOffsetY !== undefined ? this.selectedWaypoint.labelOffsetY : TEXT_LABEL.OFFSET_DEFAULT_Y;
          this.elements.labelOffsetY.value = offsetY;
          this.elements.labelOffsetYValue.textContent = `${offsetY}%`;
        }
        
        // Label colors
        if (this.elements.labelColor) {
          this.elements.labelColor.value = this.selectedWaypoint.labelColor || TEXT_LABEL.COLOR_DEFAULT;
        }
        if (this.elements.labelBgColor) {
          this.elements.labelBgColor.value = this.selectedWaypoint.labelBgColor || TEXT_LABEL.BG_COLOR_DEFAULT;
        }
        
        // Label background opacity
        if (this.elements.labelBgOpacity) {
          const opacity = this.selectedWaypoint.labelBgOpacity !== undefined ? this.selectedWaypoint.labelBgOpacity : TEXT_LABEL.BG_OPACITY_DEFAULT;
          this.elements.labelBgOpacity.value = Math.round(opacity * 100);
          this.elements.labelBgOpacityValue.textContent = `${Math.round(opacity * 100)}%`;
        }
        
        // Enable pause controls for major waypoints
        this.elements.waypointPauseTime.disabled = false;
        const pauseTimeSec = (this.selectedWaypoint.pauseTime || 0) / 1000;
        this.elements.waypointPauseTime.value = pauseTimeSec;
        this.elements.waypointPauseTimeValue.textContent = pauseTimeSec + 's';
        this.elements.pauseTimeControl.style.display = 'flex';
      } else {
        // Minor waypoint - disable features that don't apply
        this.elements.dotColor.disabled = true;
        this.elements.dotSize.disabled = true;
        this.elements.editorBeaconStyle.disabled = true;
        this.elements.editorBeaconStyle.value = 'none';
        this._updateRippleControlsVisibility('none'); // Hide ripple controls
        
        // Disable label controls for minor waypoints
        this.elements.waypointLabel.disabled = true;
        this.elements.labelMode.disabled = true;
        this.elements.waypointLabel.value = '';
        this.elements.labelMode.value = 'off';
        
        // Disable pause controls for minor waypoints
        this.elements.waypointPauseTime.disabled = true;
        this.elements.waypointPauseTime.value = 0;
        this.elements.waypointPauseTimeValue.textContent = '0s';
        this.elements.pauseTimeControl.style.display = 'none';
      }
      
      // Camera controls (apply to all waypoints)
      this._updateCameraControls(this.selectedWaypoint);
    }
    // Note: Section visibility handled by SectionController which listens to
    // the same waypoint:selected/deselected events that trigger this method.
  }
  
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
  }
  
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
   * Update coordinateTransform service when image changes
   * @param {HTMLImageElement} img - The loaded image
   */
  updateImageTransform(img) {
    if (!img) {
      // No image - coordinateTransform will use normalized coordinates
      return;
    }
    
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    // Always use 'fit' mode for contain rendering (full image visible with letterboxing)
    this.coordinateTransform.setImageDimensions(width, height, 'fit');
  }
  
  // ========== COORDINATE TRANSFORM PIPELINE ==========
  // 
  // Three coordinate spaces:
  //   1. Screen coords  - CSS pixels from mouse events (relative to canvas element)
  //   2. Canvas coords  - Unzoomed canvas space (CSS pixels, what CoordinateTransform uses)
  //   3. Image coords   - Normalized 0-1 coordinates within the image
  //
  // The viewport (zoom/pan) transforms between Screen and Canvas.
  // CoordinateTransform handles Canvas ↔ Image (letterboxing, aspect ratio).
  //
  // Pipeline:
  //   Screen → screenToCanvas() → Canvas → canvasToImage() → Image
  //   Image  → imageToCanvas()  → Canvas → canvasToScreen() → Screen
  // ========================================================
  
  /**
   * Convert screen coordinates to canvas coordinates (inverse viewport transform)
   * 
   * Screen coords are CSS pixels from mouse events (e.g., clientX - rect.left).
   * Canvas coords are the unzoomed coordinate space used by CoordinateTransform.
   * 
   * The viewport renders with: ctx.scale(zoom) → ctx.translate(-panX, -panY)
   * This means canvas point (x,y) appears on screen at ((x - panX) * zoom, (y - panY) * zoom)
   * So to reverse: canvasX = screenX / zoom + panX
   * 
   * @param {number} screenX - X coordinate in screen space (CSS pixels)
   * @param {number} screenY - Y coordinate in screen space (CSS pixels)
   * @returns {{x: number, y: number}} Canvas coordinates (unzoomed space)
   */
  screenToCanvas(screenX, screenY) {
    if (this.viewport && this.viewport.zoom !== 1) {
      return {
        x: screenX / this.viewport.zoom + this.viewport.panX,
        y: screenY / this.viewport.zoom + this.viewport.panY
      };
    }
    return { x: screenX, y: screenY };
  }
  
  /**
   * Convert canvas coordinates to screen coordinates (forward viewport transform)
   * 
   * Canvas coords are the unzoomed coordinate space used by CoordinateTransform.
   * Screen coords are where things appear on screen after viewport zoom/pan.
   * 
   * @param {number} canvasX - X coordinate in canvas space (unzoomed)
   * @param {number} canvasY - Y coordinate in canvas space (unzoomed)
   * @returns {{x: number, y: number}} Screen coordinates (CSS pixels)
   */
  canvasToScreen(canvasX, canvasY) {
    if (this.viewport && this.viewport.zoom !== 1) {
      return {
        x: (canvasX - this.viewport.panX) * this.viewport.zoom,
        y: (canvasY - this.viewport.panY) * this.viewport.zoom
      };
    }
    return { x: canvasX, y: canvasY };
  }
  
  /**
   * Convert screen coordinates to normalized image coordinates (0-1)
   * Combines screenToCanvas + CoordinateTransform.canvasToImage
   * 
   * @param {number} screenX - X coordinate in screen space (CSS pixels from click)
   * @param {number} screenY - Y coordinate in screen space (CSS pixels from click)
   * @returns {{x: number, y: number}} Normalized image coordinates (0-1, clamped)
   */
  screenToImage(screenX, screenY) {
    // Convert screen → canvas (inverse viewport)
    const canvas = this.screenToCanvas(screenX, screenY);
    
    // Convert canvas → image (CoordinateTransform handles letterboxing)
    const result = this.coordinateTransform.canvasToImage(canvas.x, canvas.y);
    
    // When zoomed out, allow coords outside 0-1 (outside image area)
    // Downstream handlers (waypoint:position-changed, waypoint:add) handle clamping
    const zoom = this.exportSettings.backgroundZoom / 100;
    if (zoom < 1) {
      return result;
    }
    
    // Clamp to valid image bounds (0-1) when at or above 100% zoom
    return {
      x: Math.max(0, Math.min(1, result.x)),
      y: Math.max(0, Math.min(1, result.y))
    };
  }
  
  /**
   * Convert normalized image coordinates (0-1) to screen coordinates
   * Combines CoordinateTransform.imageToCanvas + canvasToScreen
   * 
   * @param {number} imageX - Normalized X coordinate (0-1)
   * @param {number} imageY - Normalized Y coordinate (0-1)
   * @returns {{x: number, y: number}} Screen coordinates (CSS pixels)
   */
  imageToScreen(imageX, imageY) {
    // Convert image → canvas (CoordinateTransform handles letterboxing)
    const canvas = this.coordinateTransform.imageToCanvas(imageX, imageY);
    
    // Convert canvas → screen (forward viewport)
    return this.canvasToScreen(canvas.x, canvas.y);
  }
  
  /**
   * Convert screen coordinates to canvas coordinates, then to image coordinates
   * DEPRECATED: Use screenToImage() for clarity. This alias exists for backwards compatibility.
   * 
   * @param {number} screenX - X coordinate in screen space (CSS pixels from click)
   * @param {number} screenY - Y coordinate in screen space (CSS pixels from click)
   * @returns {{x: number, y: number}} Normalized image coordinates (0-1)
   */
  canvasToImage(screenX, screenY) {
    // Note: Despite the name, this actually takes screen coords (for backwards compat)
    return this.screenToImage(screenX, screenY);
  }
  
  /**
   * Convert normalized image coordinates (0-1) to canvas coordinates (unzoomed space)
   * Accounts for letterboxing when image aspect ratio differs from canvas.
   * 
   * Note: Returns CANVAS coords, not screen coords. Use imageToScreen() if you need
   * screen coordinates that account for viewport zoom/pan.
   * 
   * @param {number} imageX - Normalized X coordinate (0-1)
   * @param {number} imageY - Normalized Y coordinate (0-1)
   * @param {boolean} clamp - If true, clamp result to canvas bounds (default: false)
   * @returns {{x: number, y: number}} Canvas coordinates (unzoomed space)
   */
  imageToCanvas(imageX, imageY, clamp = false) {
    // Use CoordinateTransform service for contain mode rendering
    // This accounts for letterboxing when image aspect ratio differs from canvas
    const result = this.coordinateTransform.imageToCanvas(imageX, imageY);
    
    // Optionally clamp to canvas boundaries
    if (clamp) {
      return {
        x: Math.max(0, Math.min(this.displayWidth, result.x)),
        y: Math.max(0, Math.min(this.displayHeight, result.y))
      };
    }
    
    return result;
  }
  
  /**
   * Check if screen coordinates are within the image bounds
   * Converts screen → canvas before checking bounds.
   * 
   * @param {number} screenX - X coordinate in screen space (CSS pixels)
   * @param {number} screenY - Y coordinate in screen space (CSS pixels)
   * @returns {boolean} True if coordinates are within image bounds
   */
  isWithinImageBounds(screenX, screenY) {
    // Convert screen → canvas first (inverse viewport)
    const canvas = this.screenToCanvas(screenX, screenY);
    return this.coordinateTransform.isWithinImageBounds(canvas.x, canvas.y);
  }
  
  // ========== ZOOM/PAN METHODS ==========
  
  /**
   * Zoom in by 1.5x, centered on selected waypoint
   * 
   * Zoom levels compound: 1x → 1.5x → 2.25x → 3.375x → ... → 32x max
   * If no waypoint is selected, shows a prompt to select one.
   */
  zoomIn() {
    if (!this.selectedWaypoint) {
      this.showSelectWaypointPrompt();
      return;
    }
    
    const newZoom = Math.min(this.viewport.zoom * 1.5, this.viewport.maxZoom);
    if (newZoom !== this.viewport.zoom) {
      this.setZoom(newZoom, this.selectedWaypoint);
    }
  }
  
  /**
   * Zoom out by 1.5x, centered on selected waypoint
   * 
   * Zoom levels compound: ... → 2.25x → 1.5x → 1x min
   * If no waypoint is selected, shows a prompt to select one.
   */
  zoomOut() {
    if (!this.selectedWaypoint) {
      this.showSelectWaypointPrompt();
      return;
    }
    
    const newZoom = Math.max(this.viewport.zoom / 1.5, this.viewport.minZoom);
    if (newZoom !== this.viewport.zoom) {
      this.setZoom(newZoom, this.selectedWaypoint);
    }
  }
  
  /**
   * Reset zoom to 1x and clear pan offset
   */
  resetZoom() {
    this.viewport.zoom = 1;
    this.viewport.panX = 0;
    this.viewport.panY = 0;
    
    // Update InteractionHandler for proportional nudge
    this.interactionHandler?.setZoomLevel(1);
    
    this.render();
    console.debug('🔍 Zoom reset to 1x');
  }
  
  /**
   * Set zoom level centered on a specific waypoint
   * 
   * The pan offset is calculated so the waypoint appears at the center
   * of the canvas after zooming.
   * 
   * @param {number} newZoom - Target zoom level (1-32)
   * @param {Waypoint} centerWaypoint - Waypoint to center zoom on
   */
  setZoom(newZoom, centerWaypoint) {
    // Get waypoint position in canvas coordinates (unzoomed)
    const waypointCanvas = this.imageToCanvas(centerWaypoint.imgX, centerWaypoint.imgY);
    
    // Canvas center in screen coordinates
    const canvasCenterX = this.displayWidth / 2;
    const canvasCenterY = this.displayHeight / 2;
    
    // Update zoom
    const oldZoom = this.viewport.zoom;
    this.viewport.zoom = newZoom;
    
    // Update InteractionHandler for proportional nudge
    this.interactionHandler?.setZoomLevel(newZoom);
    
    // Calculate pan offset to center the waypoint on screen
    // The transform is: screenPos = (canvasPos - panOffset) * zoom
    // We want the waypoint at canvas center, so:
    // canvasCenter = (waypointCanvas - panOffset) * zoom
    // panOffset = waypointCanvas - canvasCenter / zoom
    this.viewport.panX = waypointCanvas.x - canvasCenterX / newZoom;
    this.viewport.panY = waypointCanvas.y - canvasCenterY / newZoom;
    
    this.render();
    console.debug(`🔍 Zoom: ${oldZoom.toFixed(2)}x → ${newZoom.toFixed(2)}x (centered on waypoint at ${waypointCanvas.x.toFixed(0)}, ${waypointCanvas.y.toFixed(0)})`);
  }
  
  /**
   * Show a brief prompt asking user to select a waypoint for zoom
   */
  showSelectWaypointPrompt() {
    // Create or reuse prompt element
    let prompt = document.getElementById('zoom-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.id = 'zoom-prompt';
      prompt.className = 'zoom-prompt';
      prompt.innerHTML = '<span>Select a waypoint to zoom</span>';
      document.body.appendChild(prompt);
    }
    
    // Show prompt
    prompt.classList.add('visible');
    
    // Auto-hide after 2 seconds
    clearTimeout(this._zoomPromptTimeout);
    this._zoomPromptTimeout = setTimeout(() => {
      prompt.classList.remove('visible');
    }, 2000);
  }
  
  calculatePath() {
    // Synchronous path generation on the main thread. The former async Web
    // Worker path was removed: it never initialised under the esbuild build
    // (import.meta.url resolved invalid for the legacy browser targets), so the
    // main-thread corner-slowing calculator was always the real code path.
    // pathPoints is reassigned atomically below, so we never expose an empty
    // array mid-update.
    
    // Invalidate caches - will be recalculated on next access
    this._waypointProgressCache = null;
    this._segmentLengthsCache = null;
    
    if (this.waypoints.length < 2) {
      this.pathPoints = [];
      return;
    }
    
    // Use normalized image coordinates (0-1) for path calculation
    // Path points will be transformed to canvas coords during rendering via imageToCanvas
    // Note: Don't spread wp as Waypoint class may have getters that don't spread correctly
    // Just pass the essential properties needed by PathCalculator
    const normalizedWaypoints = this.waypoints.map(wp => ({
      x: wp.imgX,
      y: wp.imgY,
      isMajor: wp.isMajor,
      pathShape: wp.pathShape,
      shapeAmplitude: wp.shapeAmplitude,
      shapeFrequency: wp.shapeFrequency,
      segmentTension: wp.segmentTension
    }));
    
    this.pathPoints = this.pathCalculator.calculatePath(normalizedWaypoints);
    
    // Some callers invoke calculatePath() without a following render(), so queue
    // one here to keep the vector layer current.
    this.queueRender();
    
    // Performance optimization: Debounce duration calculation
    // Prevents redundant calculations during multi-waypoint operations
    if (this._durationUpdateTimeout) {
      clearTimeout(this._durationUpdateTimeout);
    }
    
    this._durationUpdateTimeout = setTimeout(() => {
      // Calculate duration based on animation mode
      if (this.animationEngine.state.mode === 'constant-speed') {
        const currentSpeed = this.animationEngine.state.speed;
        // Convert normalized path points to canvas coords for length calculation
        const canvasPathPoints = this.pathPoints.map(p => this.imageToCanvas(p.x, p.y));
        const totalLength = this.pathCalculator.calculatePathLength(canvasPathPoints);
        console.debug('🛤️  [calculatePath] Updating path duration - speed:', currentSpeed, 'px/s, length:', totalLength.toFixed(1), 'px');
        
        // Use unified duration update (accounts for segment speeds)
        this.updateAnimationDuration(currentSpeed);
      }
      // For constant-time mode, duration is already set by the slider
    }, 50); // Wait 50ms for batch changes
  }
  
  /**
   * Get positions of major waypoints as normalized progress values (0-1)
   * Performance optimization: Results are cached and only recalculated when waypoints change
   * Reduces ~99% of waypoint position calculations (was every frame → once per change)
   */
  getMajorWaypointPositions() {
    if (this.waypoints.length < 2) return [];
    
    // Return cached result if available (99% of calls hit cache)
    if (this._majorWaypointsCache) {
      return this._majorWaypointsCache;
    }
    
    // Calculate fresh (only when waypoints change)
    const majorWaypoints = [];
    let totalSegments = this.waypoints.length - 1;
    
    for (let i = 0; i < this.waypoints.length; i++) {
      if (this.waypoints[i].isMajor) {
        // Calculate position as progress (0-1) along the path
        const progress = i / totalSegments;
        majorWaypoints.push({ 
          index: i, 
          progress: progress,
          waypoint: this.waypoints[i]
        });
      }
    }
    
    // Cache the result for subsequent calls
    this._majorWaypointsCache = majorWaypoints;
    return majorWaypoints;
  }
  
  // Apply smooth easing to entire animation with EXACT waypoint positioning
  // Gives professional smooth start/stop while preserving waypoint pause precision
  applyEasing(rawProgress, majorWaypoints) {
    // Check if we should be EXACTLY at a waypoint with pause
    for (const wp of majorWaypoints) {
      // If we're very close to the waypoint's progress and it has a pause setting
      if (wp.waypoint && 
          wp.waypoint.pauseMode === 'timed' && 
          Math.abs(rawProgress - wp.progress) < 0.001) {
        // Force exact position at waypoint - no easing
        return wp.progress;
      }
    }
    
    // Apply smooth cubic ease-in-out for professional animation feel
    return Easing.cubicInOut(rawProgress);
  }
  
  // Find which segment of the path we're currently in based on progress
  findSegmentIndexForProgress(progress) {
    if (this.waypoints.length < 2) return -1;
    
    const totalSegments = this.waypoints.length - 1;
    // Clamp progress between 0 and 1
    const clampedProgress = Math.max(0, Math.min(1, progress));
    
    // Convert progress to segment index
    const segmentPosition = clampedProgress * totalSegments;
    const segmentIndex = Math.floor(segmentPosition);
    
    return Math.min(segmentIndex, totalSegments - 1);
  }
  
  // Waypoint pause detection is now handled by AnimationEngine.checkPauseMarkers()
  // using pre-computed timeline markers set via animationEngine.setPauseMarkers()
  // This is more reliable and efficient than runtime detection
  
  /**
   * Get the actual progress values for each waypoint in the current path
   * Uses PathCalculator to find where waypoints fall in the path points
   * 
   * Performance: Results are cached and only recalculated when path changes.
   * Cache is invalidated when calculatePath() is called.
   * 
   * @returns {Array} Array of progress values (0-1) for each waypoint, or null if invalid
   */
  getWaypointProgressValues() {
    if (!this.pathPoints || this.pathPoints.length === 0 || !this.waypoints || this.waypoints.length < 2) {
      return null;
    }
    
    // Return cached values if available (cache invalidated in calculatePath)
    if (this._waypointProgressCache) {
      return this._waypointProgressCache;
    }
    
    // Use normalized image coordinates (0-1) to match path points
    // Path points are stored in normalized coords, so waypoints must match
    const normalizedWaypoints = this.waypoints.map(wp => ({
      x: wp.imgX,
      y: wp.imgY
    }));
    
    // Calculate and cache the result
    this._waypointProgressCache = this.pathCalculator.calculateWaypointProgress(this.pathPoints, normalizedWaypoints);
    return this._waypointProgressCache;
  }
  
  /**
   * Get cached segment lengths, calculating if needed
   * Cache is invalidated when path changes (in calculatePath)
   * 
   * @returns {Array} Array of segment lengths in pixels, or null if invalid
   */
  getSegmentLengths() {
    if (!this.pathPoints || this.pathPoints.length < 2 || !this.waypoints || this.waypoints.length < 2) {
      return null;
    }
    
    // Return cached values if available
    if (this._segmentLengthsCache) {
      return this._segmentLengthsCache;
    }
    
    const waypointProgress = this.getWaypointProgressValues();
    if (!waypointProgress) return null;
    
    // Convert normalized path points to canvas coords for length calculation
    const canvasPathPoints = this.pathPoints.map(p => this.imageToCanvas(p.x, p.y));
    
    // Delegate to PathCalculator for segment length calculation
    this._segmentLengthsCache = this.pathCalculator.calculateSegmentLengths(canvasPathPoints, waypointProgress);
    return this._segmentLengthsCache;
  }
  
  /**
   * Aggregate waypoints into major-to-major legs for variable-speed timing.
   *
   * Timing is keyframed on majors only: minor waypoints are geometry (they
   * bend the path) but never split a leg or act as a timing keyframe. Each
   * leg starts at a major, spans any minors up to the next major, and carries
   * that major's segmentSpeed across the whole leg. Mirrors
   * CameraService.toMajorKeyframes (camera zoom is keyframed the same way).
   * See decision-log: major-leg keyframing.
   *
   * @returns {{majorWaypoints: Array, majorProgress: Array<number>, legTimingLengths: Array<number>}|null}
   *          Major-leg timing data, or null if no path / fewer than 2 majors
   */
  getMajorLegData() {
    const waypointProgress = this.getWaypointProgressValues();
    if (!waypointProgress) return null;
    
    const { waypoints: majorWaypoints, progressValues: majorProgress } =
      CameraService.toMajorKeyframes(this.waypoints, waypointProgress);
    if (majorWaypoints.length < 2) return null;
    
    // Progress-span timing basis (not summed pixel lengths) preserves
    // corner-slowing and keeps all-1.0x identical to the uniform path.
    const canvasPathPoints = this.pathPoints.map(p => this.imageToCanvas(p.x, p.y));
    const totalLength = this.pathCalculator.calculatePathLength(canvasPathPoints);
    const legTimingLengths = this.pathCalculator.legTimingLengths(majorProgress, totalLength);
    
    return { majorWaypoints, majorProgress, legTimingLengths };
  }
  
  /**
   * Check if any MAJOR waypoint has a non-default segment speed.
   *
   * Only majors carry timing speed; minors are geometry-only and their
   * segmentSpeed (including legacy saved values) is ignored. When this returns
   * false the uniform fast-path is used. See decision-log: major-leg keyframing.
   *
   * @returns {boolean} True if any major leg has speed != 1.0
   */
  hasSegmentSpeedVariations() {
    return this.waypoints.some(wp =>
      wp.isMajor !== false && wp.segmentSpeed !== undefined && wp.segmentSpeed !== 1.0
    );
  }
  
  /**
   * Get segment durations in milliseconds for each waypoint-to-waypoint segment
   * Used for zoom rate limit validation
   * 
   * @returns {Array<number>|null} Array of segment durations in ms, or null if invalid
   */
  getSegmentDurations() {
    const waypointProgress = this.getWaypointProgressValues();
    if (!waypointProgress || waypointProgress.length < 2) return null;
    
    const canvasPathPoints = this.pathPoints.map(p => this.imageToCanvas(p.x, p.y));
    const totalLength = this.pathCalculator.calculatePathLength(canvasPathPoints);
    const baseSpeed = this.animationEngine.state.speed || ANIMATION.DEFAULT_SPEED;
    
    // Per-segment durations consistent with the major-leg timing model: each
    // global segment is timed by its progress span (× totalLength) under the
    // speed of the leg it belongs to. A major opens a new leg; minors inherit
    // the current leg's speed. validateZoomTransitions() re-aggregates these
    // into major→major totals, so this stays per-global-segment.
    const durations = [];
    let currentLegSpeed = 1.0;
    for (let i = 0; i < waypointProgress.length - 1; i++) {
      const wp = this.waypoints[i];
      if (wp && wp.isMajor !== false) {
        currentLegSpeed = wp.segmentSpeed ?? 1.0;
      }
      const spanLength = Math.max(0, waypointProgress[i + 1] - waypointProgress[i]) * totalLength;
      const effectiveSpeed = baseSpeed * currentLegSpeed;
      durations.push((spanLength / effectiveSpeed) * 1000); // Convert to ms
    }
    return durations;
  }
  
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
  }
  
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
  }
  
  /**
   * Clear zoom rate limit warning from UI
   * @private
   */
  _clearZoomWarning() {
    const warningEl = document.getElementById('camera-zoom-warning');
    if (warningEl) {
      warningEl.style.display = 'none';
    }
  }
  
  /**
   * Calculate path duration and set up segment markers for variable-speed animation
   * 
   * This method:
   * 1. Calculates total path duration accounting for segment speeds
   * 2. Sets up segment markers in AnimationEngine for non-linear time-to-path mapping
   * 
   * @param {number} baseSpeed - Base animation speed in px/s
   * @returns {number} Path duration in milliseconds
   */
  calculatePathDuration(baseSpeed) {
    if (!this.pathPoints || this.pathPoints.length < 2) {
      this.animationEngine.clearSegmentMarkers();
      return 0;
    }
    
    // Convert normalized path points to canvas coords for length calculation
    const canvasPathPoints = this.pathPoints.map(p => this.imageToCanvas(p.x, p.y));
    
    // If no major leg has a custom speed, use the simple uniform calculation
    // and clear markers (minors' segmentSpeed is ignored — geometry only).
    if (!this.hasSegmentSpeedVariations()) {
      this.animationEngine.clearSegmentMarkers();
      const totalLength = this.pathCalculator.calculatePathLength(canvasPathPoints);
      return (totalLength / baseSpeed) * 1000;
    }
    
    // Use major-leg timing: minors are geometry only and never split a leg.
    const legData = this.getMajorLegData();
    if (!legData) {
      this.animationEngine.clearSegmentMarkers();
      const totalLength = this.pathCalculator.calculatePathLength(canvasPathPoints);
      return (totalLength / baseSpeed) * 1000;
    }
    
    // Set up segment markers (one per major leg) and get total duration.
    // This enables non-linear time-to-path mapping during playback while
    // keeping perceived speed coherent across any minors within a leg.
    return this.animationEngine.setSegmentMarkers(
      legData.legTimingLengths,
      legData.majorProgress,
      legData.majorWaypoints,
      baseSpeed
    );
  }
  
  /**
   * Update animation duration, segment markers, pause markers, and tail time
   * 
   * This is the central method for all animation timing updates.
   * It ensures segment speeds, pauses, and tail time are always properly configured.
   * 
   * ## Update Flow
   * 1. Calculate path duration (sets up segment markers if variable speeds)
   * 2. Set base duration in AnimationEngine
   * 3. Set pause markers (extends total duration if pauses exist)
   * 4. Set tail time for trail fade-out (preview mode only)
   * 5. Update UI to reflect final duration
   * 
   * ## Tail Time
   * In preview mode, tail time extends the timeline after path completion:
   * - Trail duration: Time for trail to fully fade out (pathTrail setting)
   * - Handle: Extra 2 seconds buffer to prevent abrupt ending
   * - Total tail time = trail duration + handle
   * 
   * @param {number} baseSpeed - Base animation speed in px/s (optional, uses current if not provided)
   */
  updateAnimationDuration(baseSpeed = null) {
    if (!this.pathPoints || this.pathPoints.length < 2) return;
    
    const speed = baseSpeed || this.animationEngine.state.speed;
    
    // IMPORTANT: Preserve the current path position before recalculating
    // When segment speeds change, the timeline structure changes but we want
    // the animation head to stay at the same physical position on the path
    const currentPathProgress = this.animationEngine.state.pathProgress;
    
    // Calculate duration and set up segment markers
    const pathDuration = this.calculatePathDuration(speed);
    
    // Store path duration in animation engine (used for timeline calculations)
    this.animationEngine.pathDuration = pathDuration;
    
    // Start with path duration as base
    let totalDuration = pathDuration;
    
    // Add start handle time (time before animation begins)
    const startHandleTime = this.animationEngine.startHandleTime;
    totalDuration += startHandleTime;
    
    // Set intro time for reveal modes (Spotlight Reveal, AOV Reveal)
    // Intro time is SEQUENTIAL - cone/spotlight grows BEFORE path starts moving
    const bgMode = this.motionSettings?.backgroundVisibility;
    const isRevealMode = bgMode === 'spotlight-reveal' || bgMode === 'angle-of-view-reveal';
    const introAnimationMs = isRevealMode ? MotionVisibilityService.INTRO_ANIMATION.DURATION_MS : 0;
    
    if (introAnimationMs > 0) {
      this.animationEngine.setIntroTime(introAnimationMs);
      totalDuration += introAnimationMs;
    } else {
      this.animationEngine.clearIntroTime();
    }
    
    // Set pause markers (this calculates total pause time)
    const waypointProgress = this.getWaypointProgressValues();
    this.animationEngine.setPauseMarkers(this.waypoints, pathDuration, waypointProgress, 0); // No intro in pause markers
    totalDuration += this.animationEngine.totalPauseTime;
    
    // Set tail time for trail fade-out (preview mode only)
    // pathTrail is now a fraction (0-1) of the sequence
    // Tail time = trail duration (as fraction of path) + small handle
    if (this.previewMode) {
      // Convert trail fraction to duration in ms
      const trailDurationMs = this.motionSettings.pathTrail * pathDuration;
      const handleMs = 500; // 0.5 second handle for clean ending
      
      // Only add tail time if trail is enabled (pathTrail > 0)
      if (trailDurationMs > 0) {
        this.animationEngine.setTailTime(trailDurationMs, handleMs);
        totalDuration += trailDurationMs + handleMs;
      } else {
        // No trail, clear tail time
        this.animationEngine.clearTailTime();
      }
    } else {
      // Edit mode: no tail time needed
      this.animationEngine.clearTailTime();
    }
    
    // End handle time is only added during export (not in edit/preview mode)
    // This is handled by the export functions which add VIDEO_EXPORT.START_BUFFER_MS
    
    // Set the final total duration
    this.animationEngine.setDuration(totalDuration);
    
    // Log timeline breakdown
    console.debug(`📍 [AnimationEngine] Timeline: ${(startHandleTime/1000).toFixed(1)}s start + ${(this.animationEngine.introTime/1000).toFixed(1)}s intro + ${(pathDuration/1000).toFixed(1)}s path + ${(this.animationEngine.totalPauseTime/1000).toFixed(1)}s pauses + ${(this.animationEngine.totalTailTime/1000).toFixed(1)}s tail = ${(totalDuration/1000).toFixed(1)}s total`);
    
    // Restore the path position by seeking to the equivalent timeline position
    // This ensures the animation head doesn't jump when segment speeds change
    if (currentPathProgress > 0 && currentPathProgress < 1) {
      this.animationEngine.seekToPathProgress(currentPathProgress);
    }
    
    // Update UI with final duration (including pauses and tail time) - right sidebar only
    const finalDuration = this.animationEngine.state.duration;
    const durationSec = Math.round(finalDuration / 100) / 10;
    if (this.elements.animationSpeedValue) {
      this.elements.animationSpeedValue.textContent = durationSec + 's';
    }
    if (this.elements.animationSpeedValueRight) {
      this.elements.animationSpeedValueRight.textContent = durationSec + 's';
    }
    this.updateTimeDisplay();
  }
  
  /**
   * Recalculate animation duration accounting for per-segment speed multipliers
   * @deprecated Use updateAnimationDuration() instead - kept for backwards compatibility
   */
  recalculateDurationWithSegmentSpeeds() {
    this.updateAnimationDuration();
  }
  
  /**
   * Play the animation
   * Delegates to AnimationEngine for state management
   */
  play() {
    if (this.waypoints.length < 2) return;
    
    // If animation is finished (at 100%), reset to beginning
    if (this.animationEngine.state.progress >= 1.0) {
      this.animationEngine.reset();
    }
    
    // Delegate to AnimationEngine
    this.animationEngine.play();
    
    // UI update handled by AnimationEngine event listeners
  }
  
  /**
   * Pause the animation
   * Delegates to AnimationEngine for state management
   */
  pause() {
    // Delegate to AnimationEngine
    this.animationEngine.pause();
    
    // UI update handled by AnimationEngine event listeners
  }
  
  /**
   * Skip to start of animation
   * Delegates to AnimationEngine for state management
   */
  skipToStart() {
    this.animationEngine.reset();
    this.announce('Skipped to start');
  }
  
  /**
   * Skip to end of animation
   * Delegates to AnimationEngine for state management
   */
  skipToEnd() {
    this.animationEngine.seekToProgress(1.0);
    this.announce('Skipped to end');
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
  
  /**
   * Save project as ZIP file (includes all images and settings)
   */
  async saveProject() {
    try {
      this.announce('Saving project...');
      
      // Create a clean copy of styles without the pathHead image object
      const stylesCopy = { ...this.styles };
      if (stylesCopy.pathHead) {
        stylesCopy.pathHead = { ...stylesCopy.pathHead, image: null };
      }
      
      // Build project data (same structure as autosave)
      const projectData = {
        coordVersion: 7,
        waypoints: this.waypoints.map(wp => wp.toJSON()),
        styles: stylesCopy,
        animationState: {
          mode: this.animationEngine.state.mode,
          speed: this.animationEngine.state.speed,
          duration: this.animationEngine.state.duration
        },
        background: {
          overlay: this.background.overlay,
          fit: this.background.fit
        },
        exportSettings: {
          frameRate: this.exportSettings.frameRate,
          pathOnly: this.exportSettings.pathOnly,
          resolutionX: this.exportSettings.resolutionX,
          resolutionY: this.exportSettings.resolutionY,
          backgroundZoom: this.exportSettings.backgroundZoom,
          includeCamera: this.exportSettings.includeCamera,
          includeText: this.exportSettings.includeText
        },
        motionSettings: { ...this.motionSettings }
      };
      
      // Get background image as base64 if present
      let backgroundBase64 = null;
      if (this.background.image) {
        const canvas = document.createElement('canvas');
        canvas.width = this.background.image.width;
        canvas.height = this.background.image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.background.image, 0, 0);
        backgroundBase64 = canvas.toDataURL('image/png');
      }
      
      // Export as ZIP
      const zipBlob = await this.imageAssetService.exportZip(projectData, backgroundBase64, 'route-project');
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `route-project-${timestamp}.zip`;
      
      // Download
      this.imageAssetService.downloadZip(zipBlob, filename);
      
      // Mark as clean (saved)
      this._isDirty = false;
      this.updateTitleDirtyState();
      
      this.announce('Project saved');
      console.log(`📦 Project saved: ${filename}`);
    } catch (err) {
      console.error('Failed to save project:', err);
      this.announce('Failed to save project');
    }
  }
  
  /**
   * Load project from ZIP file
   * @param {File} file - ZIP file to load
   */
  async loadProject(file) {
    try {
      this.announce('Loading project...');
      
      // Import from ZIP
      const { projectData, backgroundBase64 } = await this.imageAssetService.importZip(file);
      
      // Clear existing state
      this.clearAll();
      
      // Load background image if present
      if (backgroundBase64) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = backgroundBase64;
        });
        this.background.image = img;
        this.updateImageTransform(img);
      }
      
      // Load waypoints
      if (projectData.waypoints && Array.isArray(projectData.waypoints)) {
        this.beginBatch();
        this.waypoints = projectData.waypoints
          .map(wpData => Waypoint.validate(wpData) ? Waypoint.fromJSON(wpData) : null)
          .filter(wp => wp !== null);
        this.waypoints.forEach(wp => this._addWaypointToMap(wp));
        this.endBatch();
      }
      
      // Load styles
      if (projectData.styles) {
        this.styles = { ...this.styles, ...projectData.styles };
        
        // Restore path head image from asset service
        if (this.styles.pathHead?.imageAssetId) {
          const img = await this.imageAssetService.getImageElement(this.styles.pathHead.imageAssetId);
          if (img) {
            this.styles.pathHead.image = img;
            const asset = this.imageAssetService.getAsset(this.styles.pathHead.imageAssetId);
            if (asset && this.elements.headPreview) {
              this.elements.headPreview.style.display = 'block';
              this.elements.headFilename.textContent = asset.name;
              this.elements.headPreviewImg.src = asset.base64;
            }
          }
        }
        // Sync graphics scale to RenderingService and slider
        this._syncGlobalStyleUI();
      }
      
      // Load other settings
      if (projectData.background) {
        this.background.overlay = projectData.background.overlay ?? 0;
        this.background.fit = projectData.background.fit ?? 'fit';
      }
      
      if (projectData.exportSettings) {
        Object.assign(this.exportSettings, projectData.exportSettings);
        // Object.assign restores state but not the checkbox UI — sync the inclusion toggles.
        // `!== false` so older projects without these keys default to checked (included).
        if (this.elements.exportIncludeImage) {
          // checked = include image; older projects without pathOnly default to included
          this.elements.exportIncludeImage.checked = this.exportSettings.pathOnly !== true;
        }
        if (this.elements.exportIncludeCamera) {
          this.elements.exportIncludeCamera.checked = this.exportSettings.includeCamera !== false;
        }
        if (this.elements.exportIncludeText) {
          this.elements.exportIncludeText.checked = this.exportSettings.includeText !== false;
        }
      }
      
      if (projectData.motionSettings) {
        Object.assign(this.motionSettings, projectData.motionSettings);
      }
      
      if (projectData.animationState) {
        this.animationEngine.setSpeed(projectData.animationState.speed);
        this.animationEngine.setDuration(projectData.animationState.duration);
      }
      
      // Calculate path and render
      if (this.waypoints.length >= 2) {
        this.calculatePath();
      }
      
      this.updateWaypointList();
      this.render();
      
      // Mark as clean (just loaded)
      this._isDirty = false;
      this.updateTitleDirtyState();
      
      this.announce('Project loaded');
      console.log(`📦 Project loaded: ${file.name} (${this.waypoints.length} waypoints, ${this.imageAssetService.getAssetCount()} assets)`);
    } catch (err) {
      console.error('Failed to load project:', err);
      this.announce('Failed to load project: ' + err.message);
    }
  }
  
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
  }

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
  }

  /**
   * Export animation as video file
   * Uses frame-by-frame capture for consistent output regardless of system performance
   * 
   * Process:
   * 1. Check browser support
   * 2. Pause current playback
   * 3. Resize canvas to export resolution
   * 4. Initialize VideoExporter
   * 5. Step through animation, rendering each frame
   * 6. Capture frames and encode to video
   * 7. Download result
   * 8. Restore canvas to display resolution
   */
  async exportVideo() {
    // Check browser support first
    const support = VideoExporter.checkSupport();
    if (!support.supported) {
      alert(`Video export not supported in this browser: ${support.reason}`);
      return;
    }
    
    // Validate we have something to export
    if (this.waypoints.length < 2) {
      alert('Please add at least 2 waypoints before exporting.');
      return;
    }
    
    const duration = this.animationEngine.state.duration;
    if (duration <= 0) {
      alert('Animation duration is zero. Please check your waypoints.');
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
    
    // Pause playback during export
    const wasPlaying = this.animationEngine.state.isPlaying;
    this.animationEngine.pause();
    
    // Store original state to restore after export
    const originalProgress = this.animationEngine.getPathProgress();
    
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
    const originalBackgroundImage = pathOnly ? this.background.image : null;
    
    if (pathOnly) {
      // Temporarily hide background for transparent export
      this.background.image = null;
    }
    
    // Force preview mode during export to apply motion visibility settings
    const wasPreviewMode = this.previewMode;
    this.previewMode = true;
    
    // Reset reveal mask for fresh export
    this.motionVisibilityService.resetRevealMask();
    
    // Resize canvas to export resolution so captureStream captures at the
    // correct pixel dimensions (not screen size × DPR)
    this._enterExportMode(this.exportSettings.resolutionX, this.exportSettings.resolutionY);
    
    try {
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
      if (pathOnly && originalBackgroundImage) {
        this.background.image = originalBackgroundImage;
      }
      
      // Restore preview mode
      this.previewMode = wasPreviewMode;
      
      // Restore button state
      exportDropdownBtn.disabled = false;
      exportDropdownBtn.textContent = originalText;
      if (this.elements.exportMp4Btn) this.elements.exportMp4Btn.disabled = false;
      if (this.elements.exportWebmBtn) this.elements.exportWebmBtn.disabled = false;
      if (this.elements.exportHtmlBtn) this.elements.exportHtmlBtn.disabled = false;
      
      // Restore original animation state
      this.animationEngine.seekToProgress(originalProgress);
      this.render();
      
      if (wasPlaying) {
        this.animationEngine.play();
      }
    }
  }
  
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
      // Estimate file size first
      const sizeEstimate = await this.htmlExportService.estimateSize(this.background.image);
      console.log(`📦 Estimated HTML export size: ${sizeEstimate.formatted}`);
      
      // Build timeline data from AnimationEngine for accurate pause/speed playback
      const ae = this.animationEngine;
      const timelineData = {
        pathDuration: ae.pathDuration || 0,
        totalPauseTime: ae.totalPauseTime || 0,
        totalDuration: ae.state?.duration || 0,
        introTime: ae.introTime || 0,
        totalTailTime: ae.totalTailTime || 0,
        hasVariableSpeed: ae.hasVariableSpeed || false,
        pauseMarkers: (ae.pauseMarkers || []).map(m => ({
          pathProgress: m.pathProgress,
          timelineStartMs: m.timelineStartMs,
          timelineEndMs: m.timelineEndMs,
          duration: m.duration,
          waypointIndex: m.waypointIndex
        })),
        segmentMarkers: (ae.segmentMarkers || []).map(m => ({
          startPathProgress: m.startPathProgress,
          endPathProgress: m.endPathProgress,
          startPathTime: m.startPathTime,
          endPathTime: m.endPathTime,
          segmentSpeed: m.segmentSpeed
        }))
      };

      // Export HTML with full feature parity data
      const blob = await this.htmlExportService.exportHTML({
        waypoints: this.waypoints.map(wp => wp.toJSON()),
        styles: this.styles,
        background: this.background,
        backgroundImage: this.background.image,
        motionSettings: this.motionSettings,
        animationState: {
          speed: this.animationEngine.state.speed,
          duration: this.animationEngine.state.duration
        },
        pathLength: this.pathCalculator.calculatePathLength(this.pathPoints),
        pathPoints: this.pathPoints,
        waypointProgressValues: this.waypointProgressValues,
        cameraSettings: this.cameraSettings || null,
        includeCamera: this.exportSettings.includeCamera, // false → flat view in exported HTML
        includeText: this.exportSettings.includeText,     // false → no labels in exported HTML
        displayDimensions: {
          width: this.displayWidth,
          height: this.displayHeight
        },
        timeline: timelineData,
        title: 'Route Animation'
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
  }
  
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
  }
  
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
   * Mark the project as having unsaved changes and update title indicator
   * Per UI spec §2.1: Append ● dot to title when dirty
   */
  markDirty() {
    if (!this._isDirty) {
      this._isDirty = true;
      this.updateTitleIndicator();
    }
  }
  
  /**
   * Mark the project as saved (no unsaved changes)
   */
  markClean() {
    if (this._isDirty) {
      this._isDirty = false;
      this.updateTitleIndicator();
    }
  }
  
  /**
   * Update the title to show/hide unsaved changes indicator
   * Per UI spec §2.1: "Route Plotter v3.1.9 ●" when dirty
   */
  updateTitleIndicator() {
    const titleEl = document.getElementById('app-title');
    if (!titleEl) return;
    
    const baseTitle = 'Route Plotter';
    titleEl.textContent = this._isDirty ? `${baseTitle} ●` : baseTitle;
    titleEl.title = this._isDirty ? `Version ${APP_VERSION} · Unsaved changes` : `Version ${APP_VERSION}`;
  }

  autoSave() {
    // Mark as dirty when changes are made
    this.markDirty();
    
    try {
      // Create a clean copy of styles without the pathHead image object (but keep imageAssetId)
      const stylesCopy = { ...this.styles };
      if (stylesCopy.pathHead) {
        stylesCopy.pathHead = { ...stylesCopy.pathHead, image: null };
      }
      
      // Check if image assets exceed autosave limit (5MB)
      const includeAssets = !this.imageAssetService.exceedsAutosaveLimit();
      if (!includeAssets && this.imageAssetService.getAssetCount() > 0) {
        console.warn(`⚠️ Image assets (${this.imageAssetService.getFormattedTotalSize()}) exceed autosave limit. Use Export Project to save with images.`);
      }
      
      const data = {
        coordVersion: 7, // v7: Added image asset support
        waypoints: this.waypoints.map(wp => wp.toJSON()), // Serialize Waypoint instances
        styles: stylesCopy,
        animationState: {
          mode: this.animationEngine.state.mode,
          speed: this.animationEngine.state.speed,
          duration: this.animationEngine.state.duration
          // Note: playbackSpeed intentionally NOT saved - resets to 1x on each session
        },
        background: {
          overlay: this.background.overlay,
          fit: this.background.fit
        },
        exportSettings: {
          frameRate: this.exportSettings.frameRate,
          pathOnly: this.exportSettings.pathOnly,
          resolutionX: this.exportSettings.resolutionX,
          resolutionY: this.exportSettings.resolutionY,
          backgroundZoom: this.exportSettings.backgroundZoom,
          includeCamera: this.exportSettings.includeCamera,
          includeText: this.exportSettings.includeText
        },
        motionSettings: {
          pathVisibility: this.motionSettings.pathVisibility,
          pathTrail: this.motionSettings.pathTrail,
          waypointVisibility: this.motionSettings.waypointVisibility,
          backgroundVisibility: this.motionSettings.backgroundVisibility,
          revealSize: this.motionSettings.revealSize,
          revealFeather: this.motionSettings.revealFeather,
          aovAngle: this.motionSettings.aovAngle,
          aovDistance: this.motionSettings.aovDistance,
          aovDropoff: this.motionSettings.aovDropoff
        },
        // Include image assets if under size limit
        imageAssets: includeAssets ? this.imageAssetService.toJSON() : []
        // Note: Camera settings are per-waypoint, saved in waypoint.camera
      };
      
      // Use StorageService with debounced auto-save
      this.storageService.autoSave(data);
    } catch (e) {
      console.error('Error saving state:', e);
    }
  }
  
  loadAutosave() {
    console.debug('📥 [loadAutosave] Loading saved state...');
    try {
      const data = this.storageService.loadAutoSave();
      if (!data) return;
      
      // Check version - v6 and v7 are compatible (v7 adds imageAssets)
      const MIN_COORD_VERSION = 6;
      if (!data.coordVersion || data.coordVersion < MIN_COORD_VERSION) {
        console.log('Old data version detected (v' + (data.coordVersion || 1) + '), clearing saved data for v' + MIN_COORD_VERSION);
        this.storageService.clearAutoSave();
        return;
      }
      
      // Load image assets first (so they're available when loading styles)
      if (data.imageAssets && Array.isArray(data.imageAssets)) {
        this.imageAssetService.fromJSON(data.imageAssets);
        console.debug(`📷 Loaded ${this.imageAssetService.getAssetCount()} image assets (${this.imageAssetService.getFormattedTotalSize()})`);
      }
      
      // Hydrate waypoints from plain objects to Waypoint instances
      if (data.waypoints && Array.isArray(data.waypoints)) {
        // Use batch mode to prevent redundant calculations during loading
        this.beginBatch();
        
        // Convert plain objects to Waypoint instances with validation
        this.waypoints = data.waypoints
          .map(wpData => {
            // Validate waypoint data before hydration
            if (!Waypoint.validate(wpData)) {
              console.warn('Invalid waypoint data, skipping:', wpData);
              return null;
            }
            return Waypoint.fromJSON(wpData);
          })
          .filter(wp => wp !== null); // Remove invalid waypoints
        
        // Populate ID lookup map
        this.waypoints.forEach(wp => this._addWaypointToMap(wp));
        
        // End batch mode - triggers single path calculation
        this.endBatch();
        
        // Restore custom images for waypoints from asset service
        this._restoreWaypointCustomImages();
        
        console.debug('Loaded waypoints:', this.waypoints.length);
      }
      if (data.styles) {
        this.styles = { ...this.styles, ...data.styles };
        
        // Restore path head image from asset service
        if (this.styles.pathHead?.imageAssetId) {
          this.imageAssetService.getImageElement(this.styles.pathHead.imageAssetId)
            .then(img => {
              if (img) {
                this.styles.pathHead.image = img;
                // Update preview UI
                const asset = this.imageAssetService.getAsset(this.styles.pathHead.imageAssetId);
                if (asset && this.elements.headPreview) {
                  this.elements.headPreview.style.display = 'block';
                  this.elements.headFilename.textContent = asset.name;
                  this.elements.headPreviewImg.src = asset.base64;
                }
                this.queueRender();
              }
            })
            .catch(err => console.warn('Failed to restore path head image:', err));
        }
        // Sync graphics scale and other global style UI from autosave
        this._syncGlobalStyleUI();
      }
      if (data.exportSettings) {
        if (data.exportSettings.frameRate) {
          this.exportSettings.frameRate = data.exportSettings.frameRate;
          if (this.elements.exportFrameRate) {
            this.elements.exportFrameRate.value = data.exportSettings.frameRate;
          }
        }
        if (data.exportSettings.format) {
          this.exportSettings.format = data.exportSettings.format;
        }
        if (data.exportSettings.pathOnly !== undefined) {
          this.exportSettings.pathOnly = data.exportSettings.pathOnly;
          if (this.elements.exportIncludeImage) {
            // checkbox checked = include image = NOT path-only
            this.elements.exportIncludeImage.checked = !data.exportSettings.pathOnly;
          }
        }
        if (data.exportSettings.resolutionX) {
          this.exportSettings.resolutionX = data.exportSettings.resolutionX;
          if (this.elements.exportResX) {
            this.elements.exportResX.value = data.exportSettings.resolutionX;
          }
        }
        if (data.exportSettings.resolutionY) {
          this.exportSettings.resolutionY = data.exportSettings.resolutionY;
          if (this.elements.exportResY) {
            this.elements.exportResY.value = data.exportSettings.resolutionY;
          }
        }
        if (data.exportSettings.backgroundZoom) {
          this.exportSettings.backgroundZoom = data.exportSettings.backgroundZoom;
          // Update coordinate transform with loaded zoom factor
          this.coordinateTransform.setBackgroundZoom(data.exportSettings.backgroundZoom / 100);
          if (this.elements.backgroundZoom) {
            this.elements.backgroundZoom.value = data.exportSettings.backgroundZoom;
          }
          if (this.elements.backgroundZoomValue) {
            this.elements.backgroundZoomValue.textContent = `${data.exportSettings.backgroundZoom}%`;
          }
        }
        // Booleans: guard with !== undefined so a saved `false` restores correctly.
        if (data.exportSettings.includeCamera !== undefined) {
          this.exportSettings.includeCamera = data.exportSettings.includeCamera;
          if (this.elements.exportIncludeCamera) {
            this.elements.exportIncludeCamera.checked = data.exportSettings.includeCamera;
          }
        }
        if (data.exportSettings.includeText !== undefined) {
          this.exportSettings.includeText = data.exportSettings.includeText;
          if (this.elements.exportIncludeText) {
            this.elements.exportIncludeText.checked = data.exportSettings.includeText;
          }
        }
      }
      
      // Load motion visibility settings
      if (data.motionSettings) {
        const ms = data.motionSettings;
        if (ms.pathVisibility) {
          console.debug('[loadAutosave] Setting pathVisibility:', ms.pathVisibility);
          this.motionSettings.pathVisibility = ms.pathVisibility;
          if (this.elements.pathVisibility) {
            this.elements.pathVisibility.value = ms.pathVisibility;
          }
        }
        if (ms.pathTrail !== undefined) {
          this.motionSettings.pathTrail = ms.pathTrail;
          if (this.elements.pathTrail && this.uiController) {
            // Use UIController's conversion method for slider value
            const sliderValue = this.uiController.trailFractionToSlider(ms.pathTrail);
            this.elements.pathTrail.value = sliderValue;
          }
          // Update UIController's trail display
          this.uiController?.setTrailValue(ms.pathTrail);
        }
        if (ms.waypointVisibility) {
          this.motionSettings.waypointVisibility = ms.waypointVisibility;
          if (this.elements.waypointVisibility) {
            this.elements.waypointVisibility.value = ms.waypointVisibility;
          }
        }
        if (ms.backgroundVisibility) {
          this.motionSettings.backgroundVisibility = ms.backgroundVisibility;
          if (this.elements.backgroundVisibility) {
            this.elements.backgroundVisibility.value = ms.backgroundVisibility;
          }
          // Show/hide controls based on mode
          const spotlightControls = document.getElementById('spotlight-controls');
          const aovControls = document.getElementById('aov-controls');
          const isSpotlight = ms.backgroundVisibility === 'spotlight' || ms.backgroundVisibility === 'spotlight-reveal';
          const isAOV = ms.backgroundVisibility === 'angle-of-view' || ms.backgroundVisibility === 'angle-of-view-reveal';
          if (spotlightControls) spotlightControls.style.display = isSpotlight ? 'block' : 'none';
          if (aovControls) aovControls.style.display = isAOV ? 'block' : 'none';
        }
        if (ms.revealSize !== undefined) {
          this.motionSettings.revealSize = ms.revealSize;
          if (this.elements.revealSize && this.elements.revealSizeValue) {
            const sliderValue = MotionVisibilityService.log2ValueToSlider(
              ms.revealSize, MOTION.SPOTLIGHT_SIZE_MIN, MOTION.SPOTLIGHT_SIZE_MAX
            );
            this.elements.revealSize.value = sliderValue;
            this.elements.revealSizeValue.textContent = MotionVisibilityService.formatUIValue(ms.revealSize, '%');
          }
        }
        if (ms.revealFeather !== undefined) {
          this.motionSettings.revealFeather = ms.revealFeather;
          if (this.elements.revealFeather && this.elements.revealFeatherValue) {
            const sliderValue = MotionVisibilityService.log2ValueToSlider(
              ms.revealFeather, MOTION.SPOTLIGHT_FEATHER_MIN, MOTION.SPOTLIGHT_FEATHER_MAX
            );
            this.elements.revealFeather.value = sliderValue;
            this.elements.revealFeatherValue.textContent = MotionVisibilityService.formatUIValue(ms.revealFeather, '%');
          }
        }
        // Load AOV settings
        if (ms.aovAngle !== undefined) {
          this.motionSettings.aovAngle = ms.aovAngle;
          if (this.elements.aovAngle && this.elements.aovAngleValue) {
            const sliderValue = MotionVisibilityService.angleToSlider(
              ms.aovAngle, MOTION.AOV_ANGLE_MIN, MOTION.AOV_ANGLE_MAX
            );
            this.elements.aovAngle.value = sliderValue;
            this.elements.aovAngleValue.textContent = MotionVisibilityService.formatUIValue(ms.aovAngle, '°');
          }
        }
        if (ms.aovDistance !== undefined) {
          this.motionSettings.aovDistance = ms.aovDistance;
          if (this.elements.aovDistance && this.elements.aovDistanceValue) {
            const sliderValue = MotionVisibilityService.log2ValueToSlider(
              ms.aovDistance, MOTION.AOV_DISTANCE_MIN, MOTION.AOV_DISTANCE_MAX
            );
            this.elements.aovDistance.value = sliderValue;
            this.elements.aovDistanceValue.textContent = MotionVisibilityService.formatUIValue(ms.aovDistance, '%');
          }
        }
        if (ms.aovDropoff != null && !isNaN(ms.aovDropoff)) {
          this.motionSettings.aovDropoff = ms.aovDropoff;
          if (this.elements.aovDropoff && this.elements.aovDropoffValue) {
            // Linear mapping: value 0-100% → slider 0-1000
            const sliderValue = Math.round((ms.aovDropoff / MOTION.AOV_DROPOFF_MAX) * 1000);
            this.elements.aovDropoff.value = sliderValue;
            this.elements.aovDropoffValue.textContent = MotionVisibilityService.formatUIValue(ms.aovDropoff, '%');
          }
        } else {
          // Use default if saved value is null/undefined/NaN
          this.motionSettings.aovDropoff = MOTION.AOV_DROPOFF_DEFAULT;
          if (this.elements.aovDropoff && this.elements.aovDropoffValue) {
            const sliderValue = Math.round((MOTION.AOV_DROPOFF_DEFAULT / MOTION.AOV_DROPOFF_MAX) * 1000);
            this.elements.aovDropoff.value = sliderValue;
            this.elements.aovDropoffValue.textContent = MotionVisibilityService.formatUIValue(MOTION.AOV_DROPOFF_DEFAULT, '%');
          }
        }
      }
      
      // IMPORTANT: Load animation state BEFORE calculating path
      // This ensures path calculation uses the correct saved speed
      if (data.animationState) {
        const savedState = data.animationState;
        
        // Restore animation state to AnimationEngine
        this.animationEngine.setMode(savedState.mode || 'constant-speed');
        this.animationEngine.setSpeed(savedState.speed || ANIMATION.DEFAULT_SPEED);
        // Note: playbackSpeed always starts at 1x - not restored from saved state
        // This is intentional: JKL speed multipliers are temporary review aids
        this.animationEngine.setPlaybackSpeed(1);
        this.uiController?.setPlaybackSpeed(1);
        // Don't restore duration yet - will be recalculated from path length + speed
        
        // Update UI to match loaded values
        if (this.elements.animationSpeed) {
          const loadedSpeed = savedState.speed || ANIMATION.DEFAULT_SPEED;
          console.debug('🎯 [loadAutosave] Setting slider to:', loadedSpeed, '(from savedState.speed:', savedState.speed, ')');
          // Use event to avoid feedback loop
          this.eventBus.emit('ui:slider:update-speed', loadedSpeed);
          // Duration display will be updated after path calculation
        }
        
        // Always show speed control
        if (this.elements.speedControl) {
          this.elements.speedControl.style.display = 'flex';
        }
      }
      
      if (data.background) {
        this.background.overlay = data.background.overlay ?? this.background.overlay;
        this.background.fit = data.background.fit ?? this.background.fit;
        
        // Update toggle button to match loaded state
        if (this.elements.bgFitToggle) {
          this.elements.bgFitToggle.textContent = this.background.fit === 'fit' ? 'Fit' : 'Fill';
          this.elements.bgFitToggle.dataset.mode = this.background.fit;
        }
        // Reflect overlay in UI if controls exist (log2 scaled)
        if (this.elements.bgOverlay) {
          const sliderValue = MotionVisibilityService.bipolarLog2ValueToSlider(
            this.background.overlay, MOTION.TINT_MIN, MOTION.TINT_MAX
          );
          this.elements.bgOverlay.value = String(sliderValue);
          this.elements.bgOverlayValue.textContent = MotionVisibilityService.formatUIValue(this.background.overlay);
        }
      }
      
      // Note: Camera settings are per-waypoint, loaded via Waypoint.fromJSON
      
      // Calculate path with loaded speed - this will recalculate correct duration
      this.calculatePath();
      this.updateWaypointList();
      
      // Set animation to start position (paused)
      this.animationEngine.pause();
      this.animationEngine.seekToProgress(0);
      
      this.announce('Previous session restored');
    } catch (e) {
      console.warn('No autosave found or failed to load');
    }
  }
  
  /**
   * Start the render loop using AnimationEngine
   * Performance optimizations:
   * - Conditional rendering: Only renders when state changes (~90% CPU reduction when paused)
   * - Throttled time display: Updates only when seconds change (~98% fewer DOM updates)
   * - Delegates animation logic to AnimationEngine service
   */
  startRenderLoop() {
    // Track state changes for conditional rendering
    let lastProgress = -1;
    let lastWaitingState = false;
    
    // Start AnimationEngine with update callback
    this.animationEngine.start((state) => {
      // Performance optimization: Only render when animation state changes
      const progressChanged = Math.abs(state.progress - lastProgress) > 0.0001;
      const waitingChanged = state.isWaitingAtWaypoint !== lastWaitingState;
      // Also continue rendering while camera is transitioning (zoom or center position)
      const zoomTransitioning = this.cameraService?.isZoomTransitioning(this.displayWidth, this.displayHeight) ?? false;
      const shouldRender = state.isPlaying || progressChanged || waitingChanged || zoomTransitioning;
      
      if (shouldRender) {
        // Sync UI with animation state (minimal updates)
        this.syncUIWithAnimationState(state);
        
        // Render canvas
        this.render();
        
        // Update tracking for next frame
        lastProgress = state.progress;
        lastWaitingState = state.isWaitingAtWaypoint;
      }
    });
  }
  
  /**
   * Synchronize UI elements with AnimationEngine state
   * Performance optimization: Throttles time display updates to once per second
   */
  syncUIWithAnimationState(state) {
    // Update timeline slider (needs high precision)
    const timelineProgress = state.currentTime / state.duration;
    this.elements.timelineSlider.value = timelineProgress * ANIMATION.TIMELINE_RESOLUTION;
    
    // Update time display only when seconds change (98% fewer DOM updates)
    const currentSeconds = Math.floor(state.currentTime / 1000);
    if (currentSeconds !== this._lastDisplayedSecond) {
      this.updateTimeDisplay(state.currentTime, state.duration);
      this._lastDisplayedSecond = currentSeconds;
    }
  }
  
  /**
   * Update time display with current and total time
   * @param {number} currentTime - Current time in milliseconds (optional, uses engine state if not provided)
   * @param {number} duration - Total duration in milliseconds (optional, uses engine state if not provided)
   */
  updateTimeDisplay(currentTime = null, duration = null) {
    const formatTime = (ms) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Use provided values or fall back to AnimationEngine state
    const current = currentTime !== null ? currentTime : this.animationEngine.state.currentTime;
    const total = duration !== null ? duration : this.animationEngine.state.duration;
    
    this.elements.currentTime.textContent = formatTime(current);
    this.elements.totalTime.textContent = formatTime(total);
    
    // Also update export summary
    this.updateExportSummary();
  }
  
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new RoutePlotter();
});
