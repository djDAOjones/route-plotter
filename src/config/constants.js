/**
 * Application-wide constants for Route Plotter v3
 * 
 * Note: APP_VERSION is injected at build time via esbuild's define feature.
 * See build.js for version management. Do not define APP_VERSION here.
 */

// Animation timing and performance
export const ANIMATION = {
  DEFAULT_DURATION: 10000,       // 10 seconds (default duration)
  DEFAULT_SPEED: 200,            // pixels per second (default animation speed - relaxed pace for map viewing)
  TARGET_FPS: 60,
  FRAME_INTERVAL: 1000 / 60,     // ~16.67ms per frame
  MAX_DELTA_TIME: 100,           // Maximum time jump to prevent huge leaps
  DEFAULT_PLAYBACK_SPEED: 1,
  DEFAULT_WAIT_TIME: 1500,       // Default waypoint pause time (1.5 seconds)
  TIMELINE_RESOLUTION: 1000      // Slider steps (0-1000)
};

// Video export settings
export const VIDEO_EXPORT = {
  DEFAULT_FRAME_RATE: 25,        // Default export frame rate (fps)
  MIN_FRAME_RATE: 10,            // Minimum allowed frame rate
  MAX_FRAME_RATE: 60,            // Maximum allowed frame rate
  DEFAULT_BITRATE: 20000000,     // 20 Mbps default video bitrate (high quality)
  START_BUFFER_MS: 2000,         // 2 second static frame at start of all exports
  KEYFRAME_INTERVAL: 60,         // Keyframe every N frames (2.4s at 25fps) — WebCodecs path
  ENCODER_QUEUE_LIMIT: 5         // Max queued frames before backpressure yield — WebCodecs path
};

// Rendering and visual styles. Persisted map-bound sizes are reference pixels;
// RenderingService converts them from the project's reference short edge.
export const RENDERING = {
  DEFAULT_PATH_COLOR: '#D55E00', // Okabe-Ito Vermillion (palette color)
  DEFAULT_PATH_THICKNESS: 3,       // Reference pixels
  DEFAULT_DOT_SIZE: 8,             // Reference pixels
  MINOR_DOT_SIZE: 4,               // Reference pixels
  MINOR_DOT_COLOR: '#000000',      // Black color for minor waypoints
  MINOR_DOT_OPACITY: 0.5,          // 50% opacity for minor waypoints
  HOVER_ACCENT_COLOR: '#0f62fe',   // Canvas hover affordances (rings, leg "+") — matches app accent
  HOVER_ACCENT_GLOW: 'rgba(15, 98, 254, 0.45)', // Hovered-leg glow underlay
  PATH_HEAD_SIZE: 8,               // Reference pixels
  BEACON_PULSE_DURATION: 2000,   // Beacon animation cycle
  BEACON_MAX_RADIUS: 30,
  BEACON_PULSE_SIZE: 10,         // Base size for pulse effect
  BEACON_PULSE_OPACITY: 0.4,     // Opacity for pulse glow
  BEACON_RIPPLE_DURATION: 1500,  // Ripple lifetime in ms
  BEACON_RIPPLE_INTERVAL: 500,   // Time between ripples in ms
  BEACON_RIPPLE_SPEED: 30,       // Ripple expansion speed (pixels per ms)
  LABEL_OFFSET_X: 10,
  LABEL_OFFSET_Y: 5,
  LABEL_FONT_SIZE: 14,
  LABEL_FADE_TIME: 2000,         // Label fade duration in ms
  SQUIGGLE_AMPLITUDE: 0.15,      // Wave amplitude for squiggle paths
  RANDOMISED_JITTER: 3,          // Jitter amount for randomised paths
  CONTROLS_HEIGHT: 80,           // Height of bottom controls panel in pixels

  // Path casing (white contrast outline drawn beneath the coloured path).
  // Named here so RenderingService shares the intent; values unchanged (fold-in B).
  PATH_CASING_COLOR: '#FFFFFF',
  PATH_CASING_EXTRA_WIDTH: 2,    // Extra width in reference pixels per casing stroke

  // Path glow — optional soft halo drawn beneath the casing. Built from layered
  // translucent underlay strokes (widest→narrowest, stacked additively); colour
  // is derived per-segment from the path colour, and intensity (0–1) scales the
  // halo's extra width. Distinct from the beacon "glow" effect (BeaconRenderer).
  PATH_GLOW_LAYERS: 4,           // Concentric underlay strokes per segment
  PATH_GLOW_MAX_EXTRA_WIDTH: 28, // Extra width in reference pixels beyond the path at intensity 1
  PATH_GLOW_LAYER_ALPHA: 0.16,   // Per-layer opacity; additive stacking brightens toward the centre
  PATH_GLOW_DEFAULT_INTENSITY: 0.5
};

// Path calculation parameters
export const PATH = {
  POINTS_PER_SEGMENT: 100,        // Catmull-Rom interpolation density
  DEFAULT_TENSION: 0.1,           // Catmull-Rom tension - lower = tighter curves; higher = looser curves
  TARGET_SPACING: 2,              // Pixels between points after reparameterization
  MAX_CURVATURE: 0.1,             // Threshold for maximum corner slowing
  MIN_CORNER_SPEED: 0.2,          // Minimum 20% speed at tight corners (was 40% - now slows more)
  CORNER_THRESHOLD: 30,           // Degrees for corner detection
  CORNER_SLOW_RADIUS: 15,
  CORNER_SLOW_FACTOR: 0.7
};

// UI interaction thresholds
export const INTERACTION = {
  WAYPOINT_HIT_RADIUS: 15,        // Click detection radius for waypoints (pixels)
  SEGMENT_HIT_RADIUS: 8,          // Hover/click detection radius for route legs (pixels)
  LEG_PLUS_HIT_RADIUS: 12,        // Click radius for the leg midpoint "+" insert handle (pixels)
  NODE_HIT_RADIUS: 12,            // Click radius for network nodes (pixels)
  NETWORK_EDGE_HIT_RADIUS: 8,     // Click radius for network edges (pixels)
  NETWORK_CONTROL_HIT_RADIUS: 10, // Click radius for edge control-point handles (pixels)
  DRAG_THRESHOLD: 3,              // Minimum pixels to consider a drag
  DOUBLE_CLICK_TIME: 300,         // Maximum ms between clicks for double-click
  LONG_PRESS_TIME: 500,           // Time for long press detection
  ZOOM_SENSITIVITY: 0.001,
  PAN_SENSITIVITY: 1
};

// Storage keys for persistence
export const STORAGE = {
  AUTOSAVE_KEY: 'routePlotter_autosave',
  PREFERENCES_KEY: 'routePlotter_preferences',
  SPLASH_SHOWN_KEY: 'routePlotter_splashShown',
  AUTOSAVE_INTERVAL: 1000         // Debounce time for autosave
};

// Z-index layers for rendering order
export const LAYERS = {
  BACKGROUND: 0,
  OVERLAY: 1,
  AREA_HIGHLIGHTS: 2,
  PATH: 3,
  WAYPOINTS: 4,
  LABELS: 5,
  UI_HANDLES: 6,
  PATH_HEAD: 7,
  BEACONS: 8
};

/**
 * Area highlight visibility modes
 * Controls when per-waypoint area highlights appear/disappear during animation
 * Same options as WAYPOINT_VISIBILITY for consistency
 */
export const AREA_VISIBILITY = {
  ALWAYS_SHOW: 'always-show',
  HIDE_BEFORE: 'hide-before',
  HIDE_AFTER: 'hide-after',
  HIDE_BEFORE_AND_AFTER: 'hide-before-and-after',
  ALWAYS_HIDE: 'always-hide'
};

/**
 * Area highlight configuration constants
 * Defines defaults and ranges for area highlight properties
 */
export const AREA_HIGHLIGHT = {
  // Shape types
  SHAPE_NONE: 'none',
  SHAPE_CIRCLE: 'circle',
  SHAPE_RECTANGLE: 'rectangle',
  SHAPE_POLYGON: 'polygon',

  // Size defaults (fraction of image diagonal for circle, fraction of image w/h for rectangle)
  CIRCLE_RADIUS_DEFAULT: 0.05,
  CIRCLE_RADIUS_MIN: 0.01,
  CIRCLE_RADIUS_MAX: 0.5,
  RECT_WIDTH_DEFAULT: 0.1,
  RECT_HEIGHT_DEFAULT: 0.1,
  RECT_SIZE_MIN: 0.01,
  RECT_SIZE_MAX: 0.8,

  // Fill defaults (Okabe-Ito sky blue)
  FILL_COLOR_DEFAULT: '#56B4E9',
  FILL_OPACITY_DEFAULT: 0.3,
  FILL_OPACITY_MIN: 0,
  FILL_OPACITY_MAX: 1,

  // Border defaults (Okabe-Ito blue)
  BORDER_COLOR_DEFAULT: '#0072B2',
  BORDER_WIDTH_DEFAULT: 2,
  BORDER_WIDTH_MIN: 1,
  BORDER_WIDTH_MAX: 10,
  BORDER_STYLE_DEFAULT: 'solid',    // 'solid' | 'dashed' | 'dotted' | 'none'

  // Visibility
  VISIBILITY_DEFAULT: 'hide-before',

  // Fade animation
  FADE_IN_DEFAULT: 500,              // ms
  FADE_OUT_DEFAULT: 500,             // ms
  FADE_MIN: 0,                       // instant
  FADE_MAX: 10000,                   // 10 seconds

  // Drawing mode
  DRAW_VERTEX_HIT_RADIUS: 10,       // px — snap radius for closing polygon
  DRAW_MIN_VERTICES: 3,             // minimum vertices for a valid polygon
  DRAW_CLOSE_THRESHOLD: 0.02        // normalized distance to first vertex to close polygon
};

// ========== MOTION VISIBILITY SETTINGS ==========

/**
 * Motion settings for preview mode and export
 * Controls how path, waypoints, and background are revealed during animation
 */
export const MOTION = {
  // ========== PATH TRAIL SETTINGS ==========
  // Trail length as fraction of path duration (not timeline duration)
  // 
  // UI Mapping (^5 power curve for fine control in lower range):
  //   Slider 0      → OFF (trail disabled entirely)
  //   Slider 1-1000 → 0.04-4.0 fraction (displayed as 1-100%)
  //
  // Examples:
  //   0.20 fraction = 20% of path duration = ~5% on slider
  //   1.0 fraction  = 100% of path duration = ~55% on slider  
  //   4.0 fraction  = 400% of path duration = 100% on slider (full path visible)
  //
  PATH_TRAIL_DEFAULT: 0.20,        // ~5% on slider, good starting point
  PATH_TRAIL_MIN: 0.04,            // 4% of path = 1% on slider (minimum visible trail)
  PATH_TRAIL_MAX: 4.0,             // 400% of path = 100% on slider (full path always visible)
  
  // Spotlight settings (background reveal)
  // Size is % of canvas average dimension, scaled log2 for fine control
  // 100% on slider = 25% of canvas (was 50%)
  SPOTLIGHT_SIZE_DEFAULT: 10,      // Default spotlight radius as % of canvas
  SPOTLIGHT_SIZE_MIN: 1,           // Minimum spotlight size (1% of canvas)
  SPOTLIGHT_SIZE_MAX: 25,          // Maximum spotlight size (25% of canvas)
  // Feather is % of spotlight size (not canvas), scaled log2
  // 100% feather = feather equals spotlight radius (very soft edge)
  SPOTLIGHT_FEATHER_DEFAULT: 0,    // Default feather as % of spotlight size (0 = hard edge)
  SPOTLIGHT_FEATHER_MIN: 1,        // Minimum feather (nearly hard edge)
  SPOTLIGHT_FEATHER_MAX: 100,      // Maximum feather (100% of spotlight size)
  
  // Background tint settings (log2 scaled for fine control near 0)
  TINT_MIN: 1,                     // Minimum tint magnitude (log2 scale starts here)
  TINT_MAX: 100,                   // Maximum tint magnitude (-100 to +100)
  TINT_OPACITY_MAX: 60,            // Renderer alpha cap, as a percentage
  
  // Angle of View settings (triangle cone from path head)
  // Angle is vertex angle in degrees, scaled with tan-based curve for perceptual smoothness
  // Small angles (1-30°) = narrow beam, large angles (90-180°) = wide view
  AOV_ANGLE_DEFAULT: 60,           // Default cone angle in degrees
  AOV_ANGLE_MIN: 1,                // Minimum angle (very narrow beam)
  AOV_ANGLE_MAX: 180,              // Maximum angle (full semicircle)
  // Distance is % of canvas diagonal, scaled log2
  // GUI shows 1-100%, backend calculates as % of diagonal
  AOV_DISTANCE_DEFAULT: 25,        // Default distance as % of canvas diagonal
  AOV_DISTANCE_MIN: 1,             // Minimum distance (1% of diagonal)
  AOV_DISTANCE_MAX: 100,           // Maximum distance (100% of diagonal)
  // Dropoff: 0-99% truncates base (no feather), 100% = full feather from base to vertex
  // At 0% = full cone, at 50% = half cone (truncated), at 100% = full cone with feather
  AOV_DROPOFF_DEFAULT: 50,         // Default: 50% gradient fade from tip to base
  AOV_DROPOFF_MIN: 0,              // Minimum: full cone, no truncation
  AOV_DROPOFF_MAX: 100,            // Maximum: full feather from base to vertex
  
  // Waypoint animation timing
  WAYPOINT_ANIMATION_TIME: 0.5,    // Seconds for waypoint scale animation
  
  // End buffer for effects to complete
  END_BUFFER_SECONDS: 2,           // Extra time at end for trail fade-out
  
  // ========== TIMELINE HANDLES ==========
  // Extra time at start/end of timeline for video export and beacon animations
  // Start handle: Time before path animation begins (static frame)
  // End handle: Time after path + trail complete (allows final beacon animations)
  TIMELINE_START_HANDLE_MS: 2000,  // 2 seconds before animation starts
  TIMELINE_END_HANDLE_MS: 3000     // 3 seconds after animation ends
};

/**
 * Path visibility modes
 * Controls how the path is revealed during animation
 */
export const PATH_VISIBILITY = {
  ALWAYS_SHOW: 'always-show',           // Full path visible at all times
  SHOW_ON_PROGRESSION: 'show-on-progression',  // Path revealed from start to head (default)
  HIDE_ON_PROGRESSION: 'hide-on-progression',  // Full path visible, fades behind head
  INSTANTANEOUS: 'instantaneous',       // Only trail segment visible (comet effect)
  ALWAYS_HIDE: 'always-hide'            // Path never visible, only head marker
};

/**
 * Waypoint visibility modes
 * Controls when waypoints appear/disappear during animation
 */
export const WAYPOINT_VISIBILITY = {
  ALWAYS_SHOW: 'always-show',           // All waypoints visible at all times
  HIDE_BEFORE: 'hide-before',           // Hidden until path reaches them
  HIDE_AFTER: 'hide-after',             // Visible until path passes them
  HIDE_BEFORE_AND_AFTER: 'hide-before-and-after',  // Only visible when path is at them
  ALWAYS_HIDE: 'always-hide'            // Never visible
};

/**
 * Background visibility modes
 * Controls how background image is revealed during animation
 */
export const BACKGROUND_VISIBILITY = {
  ALWAYS_SHOW: 'always-show',           // Background always fully visible
  SPOTLIGHT: 'spotlight',               // Circular spotlight at head position (instant)
  SPOTLIGHT_REVEAL: 'spotlight-reveal', // Spotlight that accumulates (persistent reveal)
  ANGLE_OF_VIEW: 'angle-of-view',       // Future: cone-shaped view from head (disabled)
  ANGLE_OF_VIEW_REVEAL: 'angle-of-view-reveal', // Future: cone that accumulates (disabled)
  ALWAYS_HIDE: 'always-hide'            // Background never visible (transparent)
};

/**
 * Text label visibility modes
 * Controls when waypoint text labels appear during animation
 */
export const TEXT_VISIBILITY = {
  OFF: 'off',                           // Never shown
  ON: 'on',                             // Always shown
  FADE_UP: 'fade-up',                   // Fade in 1s eased, remain visible
  FADE_UP_DOWN: 'fade-up-down'          // Fade in 1s, remain until pause ends, fade out 1s
};

/**
 * Text label configuration constants
 * WCAG 2.2 AAA requires minimum 14px for body text (16px recommended)
 */
export const TEXT_LABEL = {
  // UI/model values are reference pixels. The editor clamps the rendered
  // result for legibility; HTML/video output always uses the exact scale.
  SIZE_PX_MIN: 16,                      // Minimum authored font size
  SIZE_PX_MAX: 48,                      // Maximum authored font size
  SIZE_DEFAULT: 16,                     // Default font size (maps to scale 1)
  EDITOR_RENDER_PX_MIN: 14,             // Interactive legibility floor
  EDITOR_RENDER_PX_MAX: 72,             // Interactive obstruction ceiling
  
  // Text area width (percentage of canvas width)
  WIDTH_MIN: 5,                         // Minimum width (5%)
  WIDTH_DEFAULT: 15,                    // Default width (15%)
  WIDTH_MAX: 50,                        // Maximum width (50%)
  
  // Position offset (percentage of canvas dimension)
  OFFSET_MIN: -50,                      // Minimum offset (-50%)
  OFFSET_MAX: 50,                       // Maximum offset (50%)
  OFFSET_DEFAULT_X: 0,                  // Default X offset (centered)
  OFFSET_DEFAULT_Y: 0,                  // Default Y offset (centered on marker)
  
  // Background
  BG_COLOR_DEFAULT: '#FFFFFF',          // Default background color (white)
  BG_OPACITY_DEFAULT: 0.85,             // Default background opacity
  BG_OPACITY_MIN: 0,                    // Minimum opacity (transparent)
  BG_OPACITY_MAX: 1,                    // Maximum opacity (opaque)
  BG_PADDING: 6,                        // Reference-pixel padding around text
  BG_BORDER_RADIUS: 4,                  // Reference-pixel border radius
  
  // Text color
  COLOR_DEFAULT: '#1a1a1a',             // Default text color (dark gray)
  
  // Animation timing
  FADE_DURATION: 500,                   // Fade in/out duration in ms (0.5s)
  
  // Auto-position
  AUTO_POSITION_DIRECTIONS: 8,          // Number of directions to test (N, NE, E, SE, S, SW, W, NW)
  AUTO_POSITION_DISTANCE: 8             // Distance from marker center (percentage)
};
