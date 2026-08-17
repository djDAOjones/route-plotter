/**
 * CameraService - Manages virtual camera zoom and positioning
 * 
 * Provides smooth zoom transitions between waypoints with two modes:
 * - IMMEDIATE: Quick 0.5s ease to target zoom, then hold
 * - CONTINUOUS: Smooth log2 interpolation across entire segment
 * 
 * The camera centers on the path head position, creating a "follow cam" effect.
 * Zoom values use logarithmic scale for perceptual consistency (2x feels like
 * the same "step" as 1x→2x and 4x→8x).
 * 
 * @module CameraService
 */

// Zoom mode constants
export const ZOOM_MODE = {
  IMMEDIATE: 'immediate',   // Quick ease to target, then hold
  CONTINUOUS: 'continuous'  // Smooth interpolation across segment
};

// Camera defaults
export const CAMERA_DEFAULTS = {
  ZOOM: 1,              // Default 1x zoom (no zoom)
  ZOOM_MIN: 1,          // Minimum zoom (native size)
  ZOOM_MAX: 16,         // Maximum zoom
  ZOOM_MODE: ZOOM_MODE.CONTINUOUS,
  IMMEDIATE_DURATION_MS: 500,  // 0.5s for immediate mode transitions
  // Momentum/smoothing settings (exponential smoothing)
  SMOOTHING_FACTOR: 0.08,     // Lower = more momentum (0.05-0.15 typical)
  ZOOM_SMOOTHING: 0.06,       // Slightly slower zoom smoothing for gentle feel
  // Zoom rate limiting (max 2x change per 0.5s = 4x per second)
  ZOOM_RATE_LIMIT_FACTOR: 2,  // Max zoom change factor per rate period
  ZOOM_RATE_LIMIT_PERIOD_MS: 500   // Rate limit period in ms
};

/**
 * CameraService class
 * Calculates camera transform based on animation progress and waypoint settings
 */
export class CameraService {
  constructor() {
    this._currentZoom = 1;  // Interpolated zoom value
    
    // Smoothed camera state (for momentum effect)
    this._smoothedZoom = 1;
    this._smoothedCenterX = 0;
    this._smoothedCenterY = 0;
    this._lastProgress = -1;  // Track progress for reset detection
    
    // Rate-limited zoom state
    this._rateLimitedZoom = 1;  // Current rate-limited zoom value
    this._lastZoomUpdateTime = 0;  // Last time zoom was updated (for rate limiting)
  }

  /**
   * Calculate the current camera state based on animation progress
   * 
   * @param {Object} params - Calculation parameters
   * @param {number} params.progress - Animation progress (0-1)
   * @param {Array} params.waypoints - Array of waypoints with camera settings
   * @param {Array} params.waypointProgressValues - Progress value for each waypoint
   * @param {Object} params.headPosition - Current path head position {x, y} in canvas coords
   * @param {number} params.canvasWidth - Canvas width in pixels
   * @param {number} params.canvasHeight - Canvas height in pixels
   * @param {number} params.animationDuration - Total animation duration in ms
   * @returns {Object} Camera state {zoom, centerX, centerY, enabled}
   */
  calculateCameraState({
    progress,
    waypoints,
    waypointProgressValues,
    headPosition,
    canvasWidth,
    canvasHeight,
    animationDuration
  }) {
    // If no waypoints, return identity transform
    if (!waypoints || waypoints.length === 0) {
      return {
        zoom: 1,
        centerX: canvasWidth / 2,
        centerY: canvasHeight / 2,
        enabled: false
      };
    }

    // Calculate target zoom based on current segment and waypoint settings
    const targetZoom = this._calculateTargetZoom(
      progress,
      waypoints,
      waypointProgressValues,
      animationDuration
    );
    
    // Apply rate limiting to zoom changes
    // The rate limiter smoothly transitions toward the target, preventing visual jumps
    const zoom = this._applyZoomRateLimit(targetZoom);

    // If zoom is effectively 1x, smoothly transition both zoom AND center to final values
    // This prevents a visual jump when the rate-limited zoom reaches 1x but smoothed zoom is still catching up
    const isEffectively1x = Math.abs(zoom - 1) < 0.001;
    if (isEffectively1x) {
      // Continue smoothing zoom toward 1.0 (don't snap!)
      const zoomSmooth = CAMERA_DEFAULTS.ZOOM_SMOOTHING;
      const posSmooth = CAMERA_DEFAULTS.SMOOTHING_FACTOR;
      
      this._smoothedZoom += (1 - this._smoothedZoom) * zoomSmooth;
      this._smoothedCenterX += (canvasWidth / 2 - this._smoothedCenterX) * posSmooth;
      this._smoothedCenterY += (canvasHeight / 2 - this._smoothedCenterY) * posSmooth;
      
      // Check if both zoom and center are close enough to snap to final values
      const zoomDist = Math.abs(this._smoothedZoom - 1);
      const centerDist = Math.abs(this._smoothedCenterX - canvasWidth / 2) + 
                         Math.abs(this._smoothedCenterY - canvasHeight / 2);
      
      if (zoomDist < 0.001 && centerDist < 1) {
        // Fully settled - no camera transform needed
        this._smoothedZoom = 1;
        this._smoothedCenterX = canvasWidth / 2;
        this._smoothedCenterY = canvasHeight / 2;
        return {
          zoom: 1,
          centerX: canvasWidth / 2,
          centerY: canvasHeight / 2,
          enabled: false
        };
      }
      
      // Still transitioning - keep camera enabled with smoothed values
      return {
        zoom: this._smoothedZoom,
        centerX: this._smoothedCenterX,
        centerY: this._smoothedCenterY,
        enabled: true
      };
    }

    // Center on path head position, but clamp to canvas boundaries
    // At zoom Z, the visible area is (canvasWidth/Z, canvasHeight/Z)
    // Camera center must stay within bounds so edges don't show empty space
    const halfVisibleW = canvasWidth / (2 * zoom);
    const halfVisibleH = canvasHeight / (2 * zoom);
    
    // Clamp center so the zoomed view doesn't exceed canvas bounds
    const minX = halfVisibleW;
    const maxX = canvasWidth - halfVisibleW;
    const minY = halfVisibleH;
    const maxY = canvasHeight - halfVisibleH;
    
    let targetCenterX = headPosition?.x ?? canvasWidth / 2;
    let targetCenterY = headPosition?.y ?? canvasHeight / 2;
    
    // Clamp to boundaries
    targetCenterX = Math.max(minX, Math.min(maxX, targetCenterX));
    targetCenterY = Math.max(minY, Math.min(maxY, targetCenterY));

    this._currentZoom = zoom;
    
    // Detect scrubbing/reset (large progress jump) - snap immediately
    const progressDelta = Math.abs(progress - this._lastProgress);
    const isJump = this._lastProgress < 0 || progressDelta > 0.05;
    this._lastProgress = progress;
    
    if (isJump) {
      // Snap to target on scrub/reset
      this._smoothedZoom = zoom;
      this._smoothedCenterX = targetCenterX;
      this._smoothedCenterY = targetCenterY;
    } else {
      // Apply exponential smoothing for gentle momentum
      const zoomSmooth = CAMERA_DEFAULTS.ZOOM_SMOOTHING;
      const posSmooth = CAMERA_DEFAULTS.SMOOTHING_FACTOR;
      
      this._smoothedZoom += (zoom - this._smoothedZoom) * zoomSmooth;
      this._smoothedCenterX += (targetCenterX - this._smoothedCenterX) * posSmooth;
      this._smoothedCenterY += (targetCenterY - this._smoothedCenterY) * posSmooth;
    }
    
    // Also clamp smoothed values to ensure boundaries during transitions
    const smoothHalfW = canvasWidth / (2 * this._smoothedZoom);
    const smoothHalfH = canvasHeight / (2 * this._smoothedZoom);
    this._smoothedCenterX = Math.max(smoothHalfW, Math.min(canvasWidth - smoothHalfW, this._smoothedCenterX));
    this._smoothedCenterY = Math.max(smoothHalfH, Math.min(canvasHeight - smoothHalfH, this._smoothedCenterY));

    return {
      zoom: this._smoothedZoom,
      centerX: this._smoothedCenterX,
      centerY: this._smoothedCenterY,
      enabled: true
    };
  }

  /**
   * Calculate target zoom value at current progress
   * Handles segment interpolation, final segment logic, and zoom modes
   * 
   * @private
   * @param {number} progress - Animation progress (0-1)
   * @param {Array} waypoints - Array of waypoints
   * @param {Array} waypointProgressValues - Progress value for each waypoint
   * @param {number} animationDuration - Total animation duration in ms
   * @returns {number} Target zoom value
   */
  _calculateTargetZoom(progress, waypoints, waypointProgressValues, animationDuration) {
    if (!waypointProgressValues || waypointProgressValues.length === 0) {
      return 1;
    }

    // Find current and next waypoint based on progress
    const { prevIndex, nextIndex, segmentProgress } = this._findWaypointSegment(
      progress,
      waypointProgressValues
    );

    // Get waypoints
    const prevWp = waypoints[prevIndex];
    const nextWp = waypoints[nextIndex];
    
    // Calculate effective zoom for each waypoint (respecting enabled flag)
    const prevEffectiveZoom = this._getEffectiveZoom(prevWp);
    const nextEffectiveZoom = this._getEffectiveZoom(nextWp);
    const zoomMode = nextWp?.camera?.zoomMode ?? CAMERA_DEFAULTS.ZOOM_MODE;

    // Before first waypoint: transition from 1x to first waypoint's effective zoom
    if (prevIndex === -1) {
      const firstWp = waypoints[0];
      const firstEffectiveZoom = this._getEffectiveZoom(firstWp);
      const firstWpProgress = waypointProgressValues[0] || 0;
      
      if (progress < firstWpProgress) {
        const transitionProgress = this._calculateImmediateProgress(
          progress, 0, firstWpProgress, animationDuration
        );
        return this._interpolateZoomLog(1, firstEffectiveZoom, transitionProgress);
      }
      return firstEffectiveZoom;
    }

    // At or after last waypoint: return final waypoint's zoom
    // The rate limiter will smoothly transition to it
    if (nextIndex >= waypoints.length) {
      return prevEffectiveZoom;
    }

    // For final segment approaching 1x zoom, hold previous zoom
    // and let rate limiter handle smooth transition
    const isFinalSegment = nextIndex >= waypoints.length - 1;
    if (isFinalSegment && Math.abs(nextEffectiveZoom - 1) < 0.01) {
      return prevEffectiveZoom;
    }
    
    // Between waypoints: apply zoom mode
    if (zoomMode === ZOOM_MODE.IMMEDIATE) {
      return this._calculateImmediateZoom(
        prevEffectiveZoom, nextEffectiveZoom, segmentProgress,
        waypointProgressValues[prevIndex], waypointProgressValues[nextIndex],
        animationDuration
      );
    }
    
    // CONTINUOUS mode: smooth log interpolation across entire segment
    return this._interpolateZoomLog(prevEffectiveZoom, nextEffectiveZoom, this._easeInOut(segmentProgress));
  }
  
  /**
   * Get effective zoom for a waypoint
   * @private
   * @param {Object} waypoint - Waypoint object
   * @returns {number} Waypoint's zoom value (defaults to 1x)
   */
  _getEffectiveZoom(waypoint) {
    if (!waypoint) return 1;
    return waypoint.camera?.zoom ?? 1;
  }

  /**
   * Find which waypoint segment we're in based on progress
   * @private
   */
  _findWaypointSegment(progress, waypointProgressValues) {
    let prevIndex = -1;
    let nextIndex = 0;

    for (let i = 0; i < waypointProgressValues.length; i++) {
      if (progress >= waypointProgressValues[i]) {
        prevIndex = i;
        nextIndex = i + 1;
      } else {
        break;
      }
    }

    // Calculate progress within segment
    let segmentProgress = 0;
    if (prevIndex >= 0 && nextIndex < waypointProgressValues.length) {
      const segmentStart = waypointProgressValues[prevIndex];
      const segmentEnd = waypointProgressValues[nextIndex];
      const segmentLength = segmentEnd - segmentStart;
      if (segmentLength > 0) {
        segmentProgress = (progress - segmentStart) / segmentLength;
      }
    }

    return { prevIndex, nextIndex, segmentProgress };
  }

  /**
   * Calculate zoom for IMMEDIATE mode
   * Quick 0.5s ease to target, then hold until next waypoint
   * @private
   */
  _calculateImmediateZoom(prevZoom, nextZoom, segmentProgress, prevProgress, nextProgress, animationDuration) {
    // Calculate what fraction of the segment 0.5s represents
    const segmentDuration = (nextProgress - prevProgress) * animationDuration;
    const transitionDuration = Math.min(CAMERA_DEFAULTS.IMMEDIATE_DURATION_MS, segmentDuration);
    const transitionFraction = segmentDuration > 0 ? transitionDuration / segmentDuration : 1;

    if (segmentProgress <= transitionFraction) {
      // During transition: ease to target
      const t = segmentProgress / transitionFraction;
      return this._interpolateZoomLog(prevZoom, nextZoom, this._easeOut(t));
    } else {
      // After transition: hold at target
      return nextZoom;
    }
  }

  /**
   * Calculate progress for immediate transitions at start/end
   * @private
   */
  _calculateImmediateProgress(progress, startProgress, endProgress, animationDuration) {
    const segmentDuration = (endProgress - startProgress) * animationDuration;
    const transitionDuration = Math.min(CAMERA_DEFAULTS.IMMEDIATE_DURATION_MS, segmentDuration);
    const transitionFraction = segmentDuration > 0 ? transitionDuration / segmentDuration : 1;
    
    const segmentProgress = (progress - startProgress) / (endProgress - startProgress);
    if (segmentProgress <= transitionFraction) {
      return this._easeOut(segmentProgress / transitionFraction);
    }
    return 1;
  }

  /**
   * Interpolate between two zoom values using log2 scale
   * This ensures perceptual consistency (1x→2x feels same as 2x→4x)
   * @private
   */
  _interpolateZoomLog(fromZoom, toZoom, t) {
    // Convert to log2 space, interpolate, convert back
    const fromLog = Math.log2(Math.max(fromZoom, 0.001));
    const toLog = Math.log2(Math.max(toZoom, 0.001));
    const interpolatedLog = fromLog + (toLog - fromLog) * t;
    return Math.pow(2, interpolatedLog);
  }

  /**
   * Ease-out function for smooth deceleration
   * @private
   */
  _easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Ease-in-out function for smooth acceleration and deceleration
   * @private
   */
  _easeInOut(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Apply rate limiting to zoom changes
   * Limits zoom change to max 2x (doubling/halving) per specified period
   * 
   * @param {number} targetZoom - The desired zoom value
   * @param {number} [ratePeriodMs] - Rate limit period in ms (default: ZOOM_RATE_LIMIT_PERIOD_MS)
   * @returns {number} Rate-limited zoom value
   * @private
   */
  _applyZoomRateLimit(targetZoom, ratePeriodMs = CAMERA_DEFAULTS.ZOOM_RATE_LIMIT_PERIOD_MS) {
    const now = performance.now();
    const deltaTime = now - this._lastZoomUpdateTime;
    this._lastZoomUpdateTime = now;
    
    // On first call or after long pause, snap to target
    if (deltaTime > 1000 || this._rateLimitedZoom <= 0) {
      this._rateLimitedZoom = targetZoom;
      return targetZoom;
    }
    
    // Calculate max allowed zoom change for this time delta
    // Rate: 2x per ratePeriodMs = log2(2) per ratePeriodMs = 1 octave per ratePeriodMs
    const maxOctavesPerMs = Math.log2(CAMERA_DEFAULTS.ZOOM_RATE_LIMIT_FACTOR) / ratePeriodMs;
    const maxOctaveChange = maxOctavesPerMs * deltaTime;
    
    // Calculate current and target in log2 space (octaves)
    const currentOctave = Math.log2(Math.max(this._rateLimitedZoom, 0.001));
    const targetOctave = Math.log2(Math.max(targetZoom, 0.001));
    const octaveDelta = targetOctave - currentOctave;
    
    // Clamp the change to the max allowed
    const clampedOctaveDelta = Math.max(-maxOctaveChange, Math.min(maxOctaveChange, octaveDelta));
    const newOctave = currentOctave + clampedOctaveDelta;
    
    this._rateLimitedZoom = Math.pow(2, newOctave);
    return this._rateLimitedZoom;
  }

  /**
   * Reset rate limiter state (call on animation reset/scrub)
   */
  resetRateLimiter() {
    this._rateLimitedZoom = 1;
    this._lastZoomUpdateTime = 0;
  }
  
  /**
   * Check if camera is still transitioning (zoom or center position)
   * Used to keep rendering while camera transition completes
   * @param {number} canvasWidth - Canvas width for center check
   * @param {number} canvasHeight - Canvas height for center check
   * @returns {boolean} True if camera is still transitioning
   */
  isZoomTransitioning(canvasWidth = 0, canvasHeight = 0) {
    // Check if zoom is still transitioning
    const zoomTransitioning = Math.abs(this._rateLimitedZoom - 1) > 0.001;
    
    // Check if center position is still transitioning toward canvas center
    let centerTransitioning = false;
    if (canvasWidth > 0 && canvasHeight > 0) {
      const centerDist = Math.abs(this._smoothedCenterX - canvasWidth / 2) + 
                         Math.abs(this._smoothedCenterY - canvasHeight / 2);
      centerTransitioning = centerDist > 1;
    }
    
    return zoomTransitioning || centerTransitioning;
  }

  /**
   * Convert a linear slider value (0-1) to log zoom (1-16)
   * @param {number} sliderValue - Linear value 0-1
   * @returns {number} Zoom value 1-16
   */
  static sliderToZoom(sliderValue) {
    // Map 0-1 to 1-16 using log scale
    // 0 → 1x, 0.25 → 2x, 0.5 → 4x, 0.75 → 8x, 1 → 16x
    const minLog = Math.log2(CAMERA_DEFAULTS.ZOOM_MIN);
    const maxLog = Math.log2(CAMERA_DEFAULTS.ZOOM_MAX);
    const logValue = minLog + sliderValue * (maxLog - minLog);
    return Math.pow(2, logValue);
  }

  /**
   * Convert a zoom value (1-16) to linear slider value (0-1)
   * @param {number} zoom - Zoom value 1-16
   * @returns {number} Linear slider value 0-1
   */
  static zoomToSlider(zoom) {
    const minLog = Math.log2(CAMERA_DEFAULTS.ZOOM_MIN);
    const maxLog = Math.log2(CAMERA_DEFAULTS.ZOOM_MAX);
    const logValue = Math.log2(Math.max(zoom, CAMERA_DEFAULTS.ZOOM_MIN));
    return (logValue - minLog) / (maxLog - minLog);
  }

  /**
   * Format zoom value for display (e.g., "2.0x")
   * @param {number} zoom - Zoom value
   * @returns {string} Formatted string
   */
  static formatZoom(zoom) {
    return `${zoom.toFixed(1)}x`;
  }

  /**
   * Reduce a full waypoint list to MAJOR-only camera keyframes.
   *
   * Zoom is keyframed over major waypoints only — minors shape path geometry,
   * not zoom. Feeding the full list lets each minor (whose camera.zoom defaults
   * to 1) inject a 1x keyframe, so the zoom dips toward 1x at minors. Filtering
   * here leaves the interpolation maths untouched while aligning the engine with
   * the major-only camera UI ("This/Next Zoom" read the next major).
   * See decision-log 2026-06-16.
   *
   * @param {Array} waypoints - Full waypoint list (majors + minors)
   * @param {Array<number>} progressValues - Path progress (0-1) per waypoint,
   *   index-aligned to `waypoints`
   * @returns {{waypoints: Array, progressValues: Array<number>}} Major-only,
   *   still index-aligned to each other
   */
  static toMajorKeyframes(waypoints, progressValues) {
    const majorWaypoints = [];
    const majorProgressValues = [];
    if (Array.isArray(waypoints)) {
      waypoints.forEach((wp, i) => {
        // isMajor !== false treats a missing flag as major (defensive default)
        if (wp && wp.isMajor !== false) {
          majorWaypoints.push(wp);
          majorProgressValues.push(progressValues?.[i] ?? 0);
        }
      });
    }
    return { waypoints: majorWaypoints, progressValues: majorProgressValues };
  }

  /**
   * Validate zoom transitions for rate limit warnings
   * Checks all waypoint pairs and returns warnings for any that exceed rate limit
   * 
   * @param {Array} waypoints - Array of waypoints with camera settings
   * @param {Array} segmentDurations - Duration in ms for each segment (waypoint to next waypoint)
   * @returns {Array} Array of warning objects: {fromWpIndex, toWpIndex, fromZoom, toZoom, segmentDurationMs, requiredDurationMs}
   */
  static validateZoomTransitions(waypoints, segmentDurations) {
    const warnings = [];
    if (!waypoints || waypoints.length < 2 || !segmentDurations) {
      return warnings;
    }

    const rateFactor = CAMERA_DEFAULTS.ZOOM_RATE_LIMIT_FACTOR;
    const ratePeriodMs = CAMERA_DEFAULTS.ZOOM_RATE_LIMIT_PERIOD_MS;
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const fromWp = waypoints[i];
      const toWp = waypoints[i + 1];
      const fromZoom = fromWp?.camera?.zoom ?? 1;
      const toZoom = toWp?.camera?.zoom ?? 1;
      const segmentDurationMs = segmentDurations[i] || 0;
      
      // Calculate zoom change in octaves (log2 space)
      const octaveChange = Math.abs(Math.log2(toZoom) - Math.log2(fromZoom));
      
      // Calculate required duration at rate limit
      // Rate: rateFactor per ratePeriodMs = log2(rateFactor) octaves per ratePeriodMs
      const octavesPerMs = Math.log2(rateFactor) / ratePeriodMs;
      const requiredDurationMs = octaveChange / octavesPerMs;
      
      // Add warning if segment is too short
      if (requiredDurationMs > segmentDurationMs && octaveChange > 0.01) {
        warnings.push({
          fromWpIndex: i,
          toWpIndex: i + 1,
          fromZoom,
          toZoom,
          segmentDurationMs,
          requiredDurationMs: Math.ceil(requiredDurationMs)
        });
      }
    }
    
    return warnings;
  }
}

export default CameraService;
