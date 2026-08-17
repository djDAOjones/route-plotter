import { RENDERING, ANIMATION, PATH, TEXT_LABEL, TEXT_VISIBILITY, AREA_HIGHLIGHT, AREA_VISIBILITY } from '../config/constants.js';
import { CAMERA_DEFAULTS, ZOOM_MODE } from '../services/CameraService.js';

/**
 * Model representing a waypoint on the route
 * Encapsulates waypoint properties and provides methods for manipulation
 */
export class Waypoint {
  constructor(options = {}) {
    // Position (normalized image coordinates 0-1)
    this.imgX = options.imgX || 0;
    this.imgY = options.imgY || 0;
    
    // Type
    this.isMajor = options.isMajor !== undefined ? options.isMajor : true;
    
    // Property change tracking for performance optimization
    this._dirtyProps = new Set();
    
    // Visual properties
    this.segmentColor = options.segmentColor || RENDERING.DEFAULT_PATH_COLOR;
    this.segmentWidth = options.segmentWidth || RENDERING.DEFAULT_PATH_THICKNESS;
    this.segmentStyle = options.segmentStyle || 'solid'; // solid, dashed, dotted
    this.segmentTension = options.segmentTension || PATH.DEFAULT_TENSION;
    
    // Path shape for segments starting from this waypoint
    this.pathShape = options.pathShape || 'line'; // line, squiggle, randomised
    
    // Squiggle/Random shape parameters
    // Amplitude: perpendicular displacement as percentage of segment length (0-100)
    this.shapeAmplitude = options.shapeAmplitude !== undefined ? options.shapeAmplitude : 10;
    // Frequency: number of wave cycles per 100 path points (1-20)
    this.shapeFrequency = options.shapeFrequency !== undefined ? options.shapeFrequency : 5;
    
    // Marker properties
    this.markerStyle = options.markerStyle || 'dot'; // dot, square, flag, none
    this.dotColor = options.dotColor || RENDERING.DEFAULT_PATH_COLOR;
    this.dotSize = options.dotSize || (this.isMajor ? RENDERING.DEFAULT_DOT_SIZE : RENDERING.MINOR_DOT_SIZE);
    
    // Beacon effect (uses marker color - dotColor)
    // Types: none, ripple, glow, pop, grow, pulse
    this.beaconStyle = options.beaconStyle || 'none';
    
    // Ripple-specific settings
    this.rippleThickness = options.rippleThickness || 2; // Ring thickness in pixels
    this.rippleMaxScale = options.rippleMaxScale || 1000; // Max scale percentage (1000 = 1000%)
    this.rippleWait = options.rippleWait !== undefined ? options.rippleWait : true; // Wait during ripple (default: true)
    
    // Pulse-specific settings
    this.pulseAmplitude = options.pulseAmplitude !== undefined ? options.pulseAmplitude : 1.0; // 0-3, affects scale range
    this.pulseCycleSpeed = options.pulseCycleSpeed !== undefined ? options.pulseCycleSpeed : 4.0; // Seconds per full cycle
    
    // Name (for waypoint list UI - separate from label)
    // Empty string = use default "Waypoint N" display
    // Custom name persists across sessions
    /** @type {string} Custom name for waypoint list (empty = default) */
    this.name = options.name || '';
    
    // Label (displayed on canvas during animation)
    /** @type {string} Text label shown on canvas */
    this.label = options.label || '';
    /** @type {string} Visibility mode: off, on, fade-up, fade-up-down */
    // Normalise the legacy 'none' sentinel (older saves) to the canonical OFF
    // mode so the render path never has to special-case it.
    const labelMode = options.labelMode || TEXT_VISIBILITY.FADE_UP;
    this.labelMode = labelMode === 'none' ? TEXT_VISIBILITY.OFF : labelMode;
    /** @type {number} X offset from marker center (percentage of canvas width, -50 to 50) */
    this.labelOffsetX = options.labelOffsetX !== undefined ? options.labelOffsetX : TEXT_LABEL.OFFSET_DEFAULT_X;
    /** @type {number} Y offset from marker center (percentage of canvas height, -50 to 50) */
    this.labelOffsetY = options.labelOffsetY !== undefined ? options.labelOffsetY : TEXT_LABEL.OFFSET_DEFAULT_Y;
    /** @type {number} Text area width (percentage of canvas width, 5-50) */
    this.labelWidth = options.labelWidth !== undefined ? options.labelWidth : TEXT_LABEL.WIDTH_DEFAULT;
    /** @type {number} Font size in pixels (10-48, WCAG minimum 14) */
    this.labelSize = options.labelSize !== undefined ? options.labelSize : TEXT_LABEL.SIZE_DEFAULT;
    /** @type {string} Text color (hex) */
    this.labelColor = options.labelColor || TEXT_LABEL.COLOR_DEFAULT;
    /** @type {string} Background color (hex) */
    this.labelBgColor = options.labelBgColor || TEXT_LABEL.BG_COLOR_DEFAULT;
    /** @type {number} Background opacity (0-1) */
    this.labelBgOpacity = options.labelBgOpacity !== undefined ? options.labelBgOpacity : TEXT_LABEL.BG_OPACITY_DEFAULT;
    
    // Animation pause
    this.pauseTime = options.pauseTime !== undefined ? options.pauseTime : ANIMATION.DEFAULT_WAIT_TIME;
    // Default pauseMode to 'timed' if pauseTime > 0, otherwise 'none'
    this.pauseMode = options.pauseMode || (this.pauseTime > 0 ? 'timed' : 'none');
    
    // Segment speed multiplier (0.1x to 10x, default 1.0x). Honoured only on
    // major waypoints: it sets the speed of the major-to-major leg starting
    // here. Minors keep the property but it is ignored during playback — they
    // are geometry only (see decision-log: major-leg keyframing).
    this.segmentSpeed = options.segmentSpeed !== undefined ? options.segmentSpeed : 1.0;
    
    // Path head style for when animation reaches this waypoint
    this.pathHeadStyle = options.pathHeadStyle || 'arrow'; // dot, arrow, custom, none
    this.pathHeadColor = options.pathHeadColor || '#111111';
    this.pathHeadSize = options.pathHeadSize || RENDERING.PATH_HEAD_SIZE;
    this.pathHeadImage = options.pathHeadImage || null;
    
    // Custom image (for custom marker)
    this.customImage = options.customImage || null;
    this.customImageAssetId = options.customImageAssetId || null;
    this.customImageRotation = options.customImageRotation || 'fixed'; // 'fixed' or 'auto'
    this.customImageRotationOffset = options.customImageRotationOffset ?? 0; // degrees
    
    // Camera settings (per-waypoint zoom control)
    // zoom: Target zoom level at this waypoint (1x-16x, log scale)
    // zoomMode: How to transition to this zoom (immediate or continuous)
    this.camera = {
      zoom: options.camera?.zoom ?? CAMERA_DEFAULTS.ZOOM,
      zoomMode: options.camera?.zoomMode ?? CAMERA_DEFAULTS.ZOOM_MODE
    };
    
    // Area highlight (per-waypoint overlay region)
    // Free-placed on canvas, associated with this waypoint for visibility timing
    const ah = options.areaHighlight;
    this.areaHighlight = {
      enabled: ah?.enabled ?? false,
      shape: ah?.shape ?? AREA_HIGHLIGHT.SHAPE_NONE,
      // Position (normalized 0-1 image coords — free placement, not anchored to waypoint)
      centerX: ah?.centerX ?? 0.5,
      centerY: ah?.centerY ?? 0.5,
      // Circle geometry
      radius: ah?.radius ?? AREA_HIGHLIGHT.CIRCLE_RADIUS_DEFAULT,
      // Rectangle geometry
      width: ah?.width ?? AREA_HIGHLIGHT.RECT_WIDTH_DEFAULT,
      height: ah?.height ?? AREA_HIGHLIGHT.RECT_HEIGHT_DEFAULT,
      // Polygon geometry (click-to-place vertices, normalized image coords)
      points: ah?.points ? ah.points.map(p => ({ x: p.x, y: p.y })) : [],
      // Fill
      fillColor: ah?.fillColor ?? AREA_HIGHLIGHT.FILL_COLOR_DEFAULT,
      fillOpacity: ah?.fillOpacity ?? AREA_HIGHLIGHT.FILL_OPACITY_DEFAULT,
      // Border
      borderColor: ah?.borderColor ?? AREA_HIGHLIGHT.BORDER_COLOR_DEFAULT,
      borderWidth: ah?.borderWidth ?? AREA_HIGHLIGHT.BORDER_WIDTH_DEFAULT,
      borderStyle: ah?.borderStyle ?? AREA_HIGHLIGHT.BORDER_STYLE_DEFAULT,
      // Visibility (per-waypoint, same modes as marker visibility)
      visibility: ah?.visibility ?? AREA_HIGHLIGHT.VISIBILITY_DEFAULT,
      // Fade animation
      fadeInMs: ah?.fadeInMs ?? AREA_HIGHLIGHT.FADE_IN_DEFAULT,
      fadeOutMs: ah?.fadeOutMs ?? AREA_HIGHLIGHT.FADE_OUT_DEFAULT,
    };
    
    // Metadata
    this.id = options.id || this.generateId();
    this.created = options.created || Date.now();
    this.modified = Date.now();
  }
  
  /**
   * Generate unique ID for waypoint
   * @private
   * @returns {string} Unique identifier
   */
  generateId() {
    return `wp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Update waypoint properties
   * Tracks which properties changed for smart event emission
   * @param {Object} updates - Properties to update
   */
  update(updates) {
    Object.keys(updates).forEach(key => {
      if (key in this && key !== 'id' && key !== 'created') {
        // Track changes for smart event emissions
        if (this[key] !== updates[key]) {
          this[key] = updates[key];
          this._dirtyProps.add(key);
        }
      }
    });
    this.modified = Date.now();
  }
  
  /**
   * Set position
   * @param {number} x - X coordinate (normalized 0-1)
   * @param {number} y - Y coordinate (normalized 0-1)
   */
  setPosition(x, y) {
    this.imgX = Math.max(0, Math.min(1, x));
    this.imgY = Math.max(0, Math.min(1, y));
    this.modified = Date.now();
  }
  
  /**
   * Toggle between major and minor waypoint
   */
  toggleType() {
    this.isMajor = !this.isMajor;
    
    // Adjust properties based on type
    if (!this.isMajor) {
      // Minor waypoints have simpler properties.
      // Use the canonical TEXT_VISIBILITY.OFF value to match createMinor() and
      // copyPropertiesFrom(); 'none' is a legacy sentinel, not a valid
      // TEXT_VISIBILITY mode (off | on | fade-up | fade-up-down).
      this.labelMode = TEXT_VISIBILITY.OFF;
      this.beaconStyle = 'none';
      this.pauseMode = 'none';
      this.dotSize = RENDERING.MINOR_DOT_SIZE;
    } else {
      this.dotSize = RENDERING.DEFAULT_DOT_SIZE;
    }
    
    this.modified = Date.now();
  }
  
  /**
   * Check if waypoint should pause animation
   * @returns {boolean} True if waypoint has pause time
   */
  shouldPause() {
    return this.isMajor && 
           this.pauseMode === 'timed' && 
           this.pauseTime > 0;
  }
  
  /**
   * Get pause duration in milliseconds
   * @returns {number} Pause duration
   */
  getPauseDuration() {
    return this.shouldPause() ? this.pauseTime : 0;
  }
  
  /**
   * Check if waypoint has a label
   * @returns {boolean} True if waypoint has a label to display
   */
  hasLabel() {
    // A label is shown only when it has text and a non-off visibility mode.
    return this.label.trim().length > 0 && this.labelMode !== TEXT_VISIBILITY.OFF;
  }
  
  /**
   * Check if waypoint has beacon effect
   * @returns {boolean} True if waypoint has beacon effect
   */
  hasBeacon() {
    return this.beaconStyle !== 'none';
  }
  
  /**
   * Check if waypoint has an active area highlight
   * @returns {boolean} True if waypoint has an enabled area highlight with a shape
   */
  hasAreaHighlight() {
    return this.areaHighlight.enabled && this.areaHighlight.shape !== 'none';
  }
  
  /**
   * Check if waypoint is visible
   * @returns {boolean} True if waypoint marker is visible
   */
  isVisible() {
    return this.markerStyle !== 'none';
  }
  
  /**
   * Copy properties from another waypoint (for inheritance)
   * Useful when creating new waypoints that should inherit style from previous
   * @param {Waypoint} source - Waypoint to copy properties from
   * @param {Array<string>} exclude - Properties to exclude from copying
   * @returns {Waypoint} This waypoint (for chaining)
   */
  copyPropertiesFrom(source, exclude = ['id', 'imgX', 'imgY', 'created', 'modified', 'name', 'label', 'pauseMode', 'pauseTime']) {
    // Properties to copy (style and path properties)
    // Note: pauseMode and pauseTime are excluded by default so each waypoint gets its own default pause
    const copyProps = [
      'segmentColor', 'segmentWidth', 'segmentStyle', 'segmentTension',
      'segmentSpeed',
      'pathShape', 'markerStyle', 'dotColor', 'dotSize',
      'beaconStyle', 'labelMode',
      'labelOffsetX', 'labelOffsetY', 'labelWidth', 'labelSize',
      'labelColor', 'labelBgColor', 'labelBgOpacity',
      'pathHeadStyle', 'pathHeadColor',
      'pathHeadSize', 'pathHeadImage', 'customImage'
    ];
    
    copyProps.forEach(prop => {
      if (!exclude.includes(prop) && prop in source) {
        this[prop] = source[prop];
      }
    });
    
    // Adjust for waypoint type differences
    if (!this.isMajor && source.isMajor) {
      // Minor waypoints don't have labels, beacons, or pauses
      this.labelMode = TEXT_VISIBILITY.OFF;
      this.beaconStyle = 'none';
      this.pauseMode = 'none';
    }
    
    this.modified = Date.now();
    return this; // Chainable
  }
  
  /**
   * Get list of properties that have changed since last clear
   * @returns {Array<string>} Array of property names that changed
   */
  getDirtyProps() {
    return Array.from(this._dirtyProps);
  }
  
  /**
   * Clear the dirty properties tracker
   */
  clearDirtyProps() {
    this._dirtyProps.clear();
  }
  
  /**
   * Check if recent changes are style-only (no path recalculation needed)
   * @returns {boolean} True if only style properties changed
   */
  isStyleChange() {
    const styleProps = ['dotColor', 'dotSize', 'markerStyle', 'beaconStyle', 'label', 'labelMode',
      'labelOffsetX', 'labelOffsetY', 'labelWidth', 'labelSize', 'labelColor', 'labelBgColor', 'labelBgOpacity'];
    return this._dirtyProps.size > 0 &&
           Array.from(this._dirtyProps).every(p => styleProps.includes(p));
  }
  
  /**
   * Check if recent changes affect path generation
   * @returns {boolean} True if path properties changed
   */
  isPathChange() {
    const pathProps = ['segmentColor', 'segmentWidth', 'segmentStyle', 'pathShape', 'segmentTension'];
    return Array.from(this._dirtyProps).some(p => pathProps.includes(p));
  }
  
  /**
   * Check if position changed
   * @returns {boolean} True if position changed
   */
  isPositionChange() {
    return this._dirtyProps.has('imgX') || this._dirtyProps.has('imgY');
  }
  
  /**
   * Clone the waypoint
   * @returns {Waypoint} New waypoint with same properties
   */
  clone() {
    return new Waypoint(this.toJSON());
  }
  
  /**
   * Convert to plain object for serialization
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      imgX: this.imgX,
      imgY: this.imgY,
      isMajor: this.isMajor,
      segmentColor: this.segmentColor,
      segmentWidth: this.segmentWidth,
      segmentStyle: this.segmentStyle,
      segmentTension: this.segmentTension,
      segmentSpeed: this.segmentSpeed,
      pathShape: this.pathShape,
      shapeAmplitude: this.shapeAmplitude,
      shapeFrequency: this.shapeFrequency,
      markerStyle: this.markerStyle,
      dotColor: this.dotColor,
      dotSize: this.dotSize,
      beaconStyle: this.beaconStyle,
      rippleThickness: this.rippleThickness,
      rippleMaxScale: this.rippleMaxScale,
      rippleWait: this.rippleWait,
      pulseAmplitude: this.pulseAmplitude,
      pulseCycleSpeed: this.pulseCycleSpeed,
      name: this.name,
      label: this.label,
      labelMode: this.labelMode,
      labelOffsetX: this.labelOffsetX,
      labelOffsetY: this.labelOffsetY,
      labelWidth: this.labelWidth,
      labelSize: this.labelSize,
      labelColor: this.labelColor,
      labelBgColor: this.labelBgColor,
      labelBgOpacity: this.labelBgOpacity,
      pauseMode: this.pauseMode,
      pauseTime: this.pauseTime,
      pathHeadStyle: this.pathHeadStyle,
      pathHeadColor: this.pathHeadColor,
      pathHeadSize: this.pathHeadSize,
      pathHeadImage: this.pathHeadImage,
      customImage: null, // Don't serialize HTMLImageElement
      customImageAssetId: this.customImageAssetId,
      customImageRotation: this.customImageRotation,
      customImageRotationOffset: this.customImageRotationOffset,
      camera: {
        zoom: this.camera.zoom,
        zoomMode: this.camera.zoomMode
      },
      areaHighlight: {
        enabled: this.areaHighlight.enabled,
        shape: this.areaHighlight.shape,
        centerX: this.areaHighlight.centerX,
        centerY: this.areaHighlight.centerY,
        radius: this.areaHighlight.radius,
        width: this.areaHighlight.width,
        height: this.areaHighlight.height,
        points: this.areaHighlight.points.map(p => ({ x: p.x, y: p.y })),
        fillColor: this.areaHighlight.fillColor,
        fillOpacity: this.areaHighlight.fillOpacity,
        borderColor: this.areaHighlight.borderColor,
        borderWidth: this.areaHighlight.borderWidth,
        borderStyle: this.areaHighlight.borderStyle,
        visibility: this.areaHighlight.visibility,
        fadeInMs: this.areaHighlight.fadeInMs,
        fadeOutMs: this.areaHighlight.fadeOutMs,
      },
      created: this.created,
      modified: this.modified
    };
  }
  
  /**
   * Create waypoint from plain object
   * @param {Object} data - Plain object with waypoint data
   * @returns {Waypoint} New waypoint instance
   */
  static fromJSON(data) {
    return new Waypoint(data);
  }
  
  /**
   * Create default major waypoint
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Waypoint} New major waypoint
   */
  static createMajor(x, y) {
    return new Waypoint({
      imgX: x,
      imgY: y,
      isMajor: true
    });
  }
  
  /**
   * Create default minor waypoint
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Waypoint} New minor waypoint
   */
  static createMinor(x, y) {
    return new Waypoint({
      imgX: x,
      imgY: y,
      isMajor: false,
      labelMode: TEXT_VISIBILITY.OFF,
      beaconStyle: 'none',
      pauseMode: 'none',
      dotSize: RENDERING.MINOR_DOT_SIZE
    });
  }
  
  /**
   * Validate waypoint data
   * @param {Object} data - Data to validate
   * @returns {boolean} True if data is valid
   */
  static validate(data) {
    if (!data || typeof data !== 'object') return false;
    
    // Required properties - only validate position
    if (typeof data.imgX !== 'number' || data.imgX < 0 || data.imgX > 1) return false;
    if (typeof data.imgY !== 'number' || data.imgY < 0 || data.imgY > 1) return false;
    
    // Note: Optional properties are NOT validated here - invalid values will be
    // handled by the constructor defaults or TextLabelService fallbacks.
    // This ensures old saved data with legacy values (like labelMode: 'none') 
    // can still be loaded.
    
    return true;
  }
}
