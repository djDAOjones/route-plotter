/**
 * BeaconRenderer - Modular beacon effect system for waypoint animations
 *
 * ## Architecture (deterministic-timeline mandate)
 * Every beacon's visual state is a CLOSED-FORM function of its local clock:
 * `localSec = (timelineMs - clockStartMs) / 1000`, where clockStartMs comes
 * from the per-waypoint schedule PlayerCore precomputes (arrival time, or the
 * early-onset window start for scale-controlling beacons). There is no
 * delta-time accumulation and no per-phase memory — evaluating any timeline
 * instant yields the same beacon state whether reached by playing, scrubbing
 * (forwards or backwards), or export stepping.
 *
 * Each beacon type is a separate class implementing a common interface:
 * - sync(localSec, win, options) - Derive full state from the local clock
 * - render(ctx, x, y, markerSize, color, markerScale) - Draw the effect
 * - reset() - Clear cached state (config changes, project reload)
 *
 * `win` carries the schedule windows in local seconds:
 * - win.arrivalSec - when the path head reaches the waypoint
 * - win.holdEndSec - when its pause window ends (== arrivalSec if no pause)
 *
 * ## Beacon Types
 * - **none**: No beacon effect
 * - **ripple**: Concentric rings radiating outward (4 rings, 1s apart)
 * - **glow**: Box shadow that builds up then fades
 * - **pop**: Quick scale 100%→200%→100% (or 0%→200%→0% with hide-before/after)
 * - **grow**: Smooth scale to 200%, hold during pause, then back to 100%
 * - **pulse**: Oscillating scale 200%↔50% during pause
 *
 * ## Phases (derived, kept for renderer queries)
 * - `onset`: local clock running, path head not yet at the waypoint
 * - `hold`: inside the pause window
 * - `offset`: past the pause window, winding down
 * - `inactive`: local clock has not started (localSec < 0)
 *
 * ## Integration with Waypoint Visibility
 * Pop, grow, and pulse beacons can override waypoint visibility animations
 * when hide-before or hide-after modes are active.
 *
 * @module BeaconRenderer
 */

// ============================================================================
// BEACON TIMING CONSTANTS
// ============================================================================

/**
 * Timing constants for beacon animations (in seconds)
 * @constant
 */
export const BEACON_TIMING = {
  // Ripple - constant expansion speed model
  // Ring duration and spawn interval scale linearly with maxScale to maintain constant visual speed
  // At 1000% scale: duration = 1s, interval = 1s (reference point)
  // At 2000% scale: duration = 2s, interval = 2s (same visual speed, larger distance)
  RIPPLE_REFERENCE_SCALE: 1000,   // Reference scale for timing calculations (1000%)
  RIPPLE_BASE_DURATION: 1.0,      // Duration at reference scale (seconds)
  RIPPLE_COUNT: 4,                // Number of rings to spawn
  RIPPLE_FADE_START: 0.5,         // Opacity held at 100% for this fraction of duration
  RIPPLE_THICKNESS_RATIO: 0.2,    // Ring thickness as ratio of dot size
  
  // Glow (single animation cycle, no looping)
  // 0s-1s: Radius eases in from 0 to max
  // 1s-3s: Opacity fades out linearly (radius stays at max)
  GLOW_ONSET_DURATION: 1.0,       // Time for radius to ease in (0s-1s)
  GLOW_FADE_DURATION: 2.0,        // Time for opacity to fade out (1s-3s)
  GLOW_RADIUS_RATIO: 8.0,         // Glow radius as ratio of dot size (4x increase for visibility)
  GLOW_PEAK_OPACITY: 0.8,         // Peak opacity for glow effect
  
  // Pop
  POP_SCALE_UP_DURATION: 0.5,     // Time to scale 100%→200%
  POP_SCALE_DOWN_DURATION: 0.5,   // Time to scale 200%→100%
  POP_PEAK_SCALE: 2.0,            // 200%
  POP_BASE_SCALE: 1.0,            // 100%
  POP_MIN_SCALE: 0.0,             // 0% (for hide-before/after)
  
  // Grow
  GROW_SCALE_UP_DURATION: 2.0,    // Time to scale 100%→200%
  GROW_SCALE_DOWN_DURATION: 1.0,  // Time to scale 200%→100%
  GROW_PEAK_SCALE: 2.0,           // 200%
  GROW_BASE_SCALE: 1.0,           // 100%
  
  // Pulse
  PULSE_INITIAL_SCALE_UP: 1.0,    // Time for initial 100%→200% (or 2s if hide-before)
  PULSE_HIDE_BEFORE_DURATION: 2.0,// Time for 0%→200% with hide-before
  PULSE_CYCLE_DURATION: 4.0,      // Full cycle: 200%→50%→200%
  PULSE_HALF_CYCLE: 2.0,          // Half cycle duration
  PULSE_MAX_SCALE: 2.0,           // 200%
  PULSE_MIN_SCALE: 0.5,           // 50%
  PULSE_BASE_SCALE: 1.0,          // 100%
  PULSE_HIDE_AFTER_DURATION: 2.0  // Time for scale down to 0% with hide-after
};

// ============================================================================
// EASING UTILITIES
// ============================================================================

/**
 * Easing functions for smooth beacon animations
 * @namespace BeaconEasing
 */
const BeaconEasing = {
  /**
   * Ease in-out for smooth transitions
   * @param {number} t - Progress 0-1
   * @returns {number} Eased value
   */
  easeInOut(t) {
    return t < 0.5 
      ? 2 * t * t 
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },
  
  /**
   * Ease in for accelerating animations
   * @param {number} t - Progress 0-1
   * @returns {number} Eased value
   */
  easeIn(t) {
    return t * t;
  },
  
  /**
   * Ease out for decelerating animations
   * @param {number} t - Progress 0-1
   * @returns {number} Eased value
   */
  easeOut(t) {
    return 1 - (1 - t) * (1 - t);
  },
  
  /**
   * Ease in-out with slight overshoot for "juicy" feel
   * @param {number} t - Progress 0-1
   * @param {number} overshoot - Overshoot amount (default 1.1)
   * @returns {number} Eased value
   */
  easeInOutBack(t, overshoot = 1.1) {
    const c1 = 1.70158 * overshoot;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  
  /**
   * Smooth step for opacity fades
   * @param {number} t - Progress 0-1
   * @returns {number} Smoothed value
   */
  smoothStep(t) {
    return t * t * (3 - 2 * t);
  }
};

// ============================================================================
// BASE BEACON CLASS
// ============================================================================

/**
 * Base class for all beacon types
 * @abstract
 */
class BaseBeacon {
  constructor() {
    /** @type {number} Local clock in seconds (negative = not started) */
    this.time = 0;
    /** @type {string} Derived phase: 'inactive', 'onset', 'hold', 'offset' */
    this.phase = 'inactive';
    /** @type {boolean} Whether beacon has completed its animation */
    this.completed = false;
    /** @type {boolean} Whether the local clock has started (localSec >= 0) */
    this.started = false;
  }

  /**
   * Derive the shared clock/phase state from the local clock. Subclasses call
   * this first, then compute their visuals closed-form from `this.time`.
   * @param {number} localSec - Seconds since this beacon's clock start (can be < 0)
   * @param {{arrivalSec: number, holdEndSec: number}} win - Schedule windows, local seconds
   * @param {Object} options - hidesBefore/hidesAfter + per-style settings
   */
  sync(localSec, win, options = {}) {
    this.time = localSec;
    this.started = localSec >= 0;
    if (localSec < 0) {
      this.phase = 'inactive';
    } else if (localSec < win.arrivalSec) {
      this.phase = 'onset';
    } else if (localSec < win.holdEndSec) {
      this.phase = 'hold';
    } else {
      this.phase = 'offset';
    }
    this.completed = false; // Subclasses derive their own completion time
  }

  /**
   * Render the beacon effect
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Center X coordinate
   * @param {number} y - Center Y coordinate
   * @param {number} markerSize - Base marker size in pixels
   * @param {string} color - Marker color (hex)
   * @param {number} markerScale - Current marker scale from visibility animation
   * @returns {{scale: number}|null} Scale override for marker, or null if no override
   */
  render(ctx, x, y, markerSize, color, markerScale) {
    return null; // No scale override by default
  }

  /**
   * Reset beacon to initial state
   */
  reset() {
    this.time = 0;
    this.phase = 'inactive';
    this.completed = false;
    this.started = false;
  }

  /**
   * Check if beacon is currently active
   * @returns {boolean}
   */
  isActive() {
    return this.phase !== 'inactive' && !this.completed;
  }
}

// ============================================================================
// RIPPLE BEACON
// ============================================================================

/**
 * Ripple beacon - Concentric rings radiating outward at constant visual speed
 * 
 * Constant Speed Model:
 * - Ring duration scales linearly with maxScale to maintain constant expansion speed
 * - Formula: duration = baseDuration * (maxScale / referenceScale)
 * - Spawn interval equals duration (each ring spawns as previous completes)
 * 
 * Timing (scales with maxScale):
 * - At 1000% (reference): duration = 1s, interval = 1s
 * - At 2000%: duration = 2s, interval = 2s
 * - At 500%: duration = 0.5s, interval = 0.5s
 * 
 * Ring Animation:
 * - Scale: Linear growth from 0% to maxScale% over full duration
 * - Opacity: 100% for first 50% of duration, then fades to 0% over remaining 50%
 *
 * Ring state is rebuilt closed-form from the local clock on every sync:
 * ring k exists from k*interval, ages linearly, and fades on schedule —
 * the pause window (precomputed by PlayerCore) is sized so all rings
 * complete inside it.
 *
 * Timeline Example (1000% scale, 4 rings):
 * - Ring 0: spawns t=0s, full opacity 0-0.5s, fades 0.5-1s
 * - Ring 1: spawns t=1s, full opacity 1-1.5s, fades 1.5-2s
 * - Ring 2: spawns t=2s, full opacity 2-2.5s, fades 2.5-3s
 * - Ring 3: spawns t=3s, full opacity 3-3.5s, fades 3.5-4s
 * - Total animation: 4s (RIPPLE_COUNT * duration)
 * 
 * Completion:
 * - `allSpawned` = true when all 4 rings created
 * - `completed` = true when all rings faded out
 * 
 * Configuration (via waypoint properties):
 * - rippleThickness: Ring stroke width in pixels (default: 2)
 * - rippleMaxScale: Maximum ring size as % of marker (default: 1000 = 10x)
 */
class RippleBeacon extends BaseBeacon {
  /** @type {boolean} Enable debug logging for ripple beacon */
  static DEBUG = false;
  /** @type {string} Beacon type identifier (survives minification) */
  static TYPE = 'ripple';
  
  constructor() {
    super();
    /** @type {string} Instance type identifier */
    this.type = 'ripple';
    /** @type {Array<{startTime: number, opacity: number}>} Active rings */
    this.rings = [];
    /** @type {boolean} Whether all rings have been spawned */
    this.allSpawned = false;
    /** @type {number} Number of rings spawned */
    this.spawnCount = 0;
    /** @type {number} Ring thickness in pixels */
    this.thickness = 2;
    /** @type {number} Max scale percentage (1000 = 1000%) */
    this.maxScale = 1000;
  }
  
  /**
   * Calculate ring duration based on maxScale for constant visual speed
   * @param {number} maxScalePercent - Max scale in percent (e.g., 1000 for 1000%)
   * @returns {number} Duration in seconds
   */
  calculateDuration(maxScalePercent) {
    const T = BEACON_TIMING;
    return T.RIPPLE_BASE_DURATION * (maxScalePercent / T.RIPPLE_REFERENCE_SCALE);
  }
  
  sync(localSec, win, options = {}) {
    super.sync(localSec, win, options);

    this.thickness = options.rippleThickness || 2;
    this.maxScale = options.rippleMaxScale || 1000;

    const T = BEACON_TIMING;
    const ringDuration = this.calculateDuration(this.maxScale);
    const spawnInterval = ringDuration; // Each ring spawns as previous completes
    const fadeStartTime = ringDuration * T.RIPPLE_FADE_START;

    // Rebuild ring state closed-form: ring k spawns at k*interval, grows for
    // ringDuration, holds opacity then fades. No spawn/fade bookkeeping to
    // carry between frames — scrubbing backwards revives rings correctly.
    this.rings = [];
    this.spawnCount = 0;
    if (localSec >= 0) {
      this.spawnCount = Math.min(T.RIPPLE_COUNT, Math.floor(localSec / spawnInterval) + 1);
      for (let k = 0; k < this.spawnCount; k++) {
        const startTime = k * spawnInterval;
        const age = localSec - startTime;
        if (age >= ringDuration) continue;
        let opacity = 1.0;
        if (age >= fadeStartTime) {
          const fadeProgress = (age - fadeStartTime) / (ringDuration - fadeStartTime);
          opacity = 1.0 - BeaconEasing.smoothStep(Math.min(1, fadeProgress));
        }
        if (opacity > 0.01) this.rings.push({ startTime, opacity });
      }
    }
    this.allSpawned = this.spawnCount >= T.RIPPLE_COUNT;
    this.completed = localSec >= T.RIPPLE_COUNT * ringDuration;
  }
  
  render(ctx, x, y, markerSize, color, markerScale, sizeScale = 1) {
    if (this.rings.length === 0) return null;
    
    // If ctx is null, we're just being queried for scale override
    if (!ctx) return null;
    
    // Use dynamic duration based on maxScale
    const ringDuration = this.calculateDuration(this.maxScale);
    
    ctx.save();
    ctx.strokeStyle = color;
    // Scale thickness based on image dimensions
    ctx.lineWidth = this.thickness * sizeScale;
    
    this.rings.forEach(ring => {
      const age = this.time - ring.startTime;
      // Linear growth from 0% to maxScale% over ring duration
      const scaleProgress = Math.min(1, age / ringDuration);
      const radius = markerSize * scaleProgress * (this.maxScale / 100);
      
      if (radius > 0 && ring.opacity > 0.01) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.globalAlpha = ring.opacity;
        ctx.stroke();
      }
    });
    
    ctx.restore();
    return null; // Ripple doesn't affect marker scale
  }
  
  reset() {
    super.reset();
    this.rings = [];
    this.allSpawned = false;
    this.spawnCount = 0;
  }
}

// ============================================================================
// GLOW BEACON
// ============================================================================

/**
 * Glow beacon - Single-cycle glow effect (no looping)
 * 
 * Timeline (continuous, ignores phase boundaries):
 * - 0s to 1s: Radius eases in from 0% to 100%, opacity at 100%
 * - 1s to 3s: Radius stays at 100%, opacity fades linearly to 0%
 * - After 3s: Animation complete
 */
class GlowBeacon extends BaseBeacon {
  /** @type {string} Beacon type identifier (survives minification) */
  static TYPE = 'glow';
  
  constructor() {
    super();
    /** @type {string} Instance type identifier */
    this.type = 'glow';
    /** @type {number} Current glow radius (0-1) */
    this.radius = 0;
    /** @type {number} Current glow opacity (0-1) */
    this.opacity = 0;
    /** @type {boolean} Whether animation has started */
    this.started = false;
    /** @type {number} Total elapsed time since animation started */
    this.elapsedTime = 0;
  }
  
  sync(localSec, win, options = {}) {
    super.sync(localSec, win, options);

    const T = BEACON_TIMING;
    const totalDuration = T.GLOW_ONSET_DURATION + T.GLOW_FADE_DURATION; // 3s total
    this.elapsedTime = Math.max(0, localSec);

    if (localSec < 0) {
      this.radius = 0;
      this.opacity = 0;
    } else if (localSec <= T.GLOW_ONSET_DURATION) {
      // Phase 1: 0s-1s - Radius eases in, opacity at 100%
      this.radius = BeaconEasing.easeIn(localSec / T.GLOW_ONSET_DURATION);
      this.opacity = 1.0;
    } else if (localSec <= totalDuration) {
      // Phase 2: 1s-3s - Radius at max, opacity fades linearly
      this.radius = 1.0;
      this.opacity = 1.0 - (localSec - T.GLOW_ONSET_DURATION) / T.GLOW_FADE_DURATION;
    } else {
      // Animation complete
      this.radius = 1.0;
      this.opacity = 0;
      this.completed = true;
    }
  }
  
  render(ctx, x, y, markerSize, color, markerScale, sizeScale = 1) {
    if (this.opacity <= 0.01) return null;
    
    // If ctx is null, we're just being queried for scale override
    if (!ctx) return null;
    
    const glowRadius = markerSize * BEACON_TIMING.GLOW_RADIUS_RATIO * this.radius;
    
    ctx.save();
    
    // Create radial gradient for glow effect
    const gradient = ctx.createRadialGradient(x, y, markerSize * 0.5, x, y, markerSize + glowRadius);
    
    // Use configurable peak opacity for stronger glow
    const alpha = this.opacity * BEACON_TIMING.GLOW_PEAK_OPACITY;
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.3, this.hexToRgba(color, alpha));
    gradient.addColorStop(0.6, this.hexToRgba(color, alpha * 0.5));
    gradient.addColorStop(1, this.hexToRgba(color, 0));
    
    ctx.beginPath();
    ctx.arc(x, y, markerSize + glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.restore();
    return null; // Glow doesn't affect marker scale
  }
  
  /**
   * Convert hex color to rgba string
   * @param {string} hex - Hex color
   * @param {number} alpha - Alpha value 0-1
   * @returns {string} RGBA color string
   */
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  reset() {
    super.reset();
    this.radius = 0;
    this.opacity = 0;
    this.started = false;
    this.elapsedTime = 0;
  }
}

// ============================================================================
// POP BEACON
// ============================================================================

/**
 * Pop beacon - Single-cycle scale animation (no looping)
 * 
 * This is a scale-controlling beacon that OVERRIDES the visibility animation
 * when hidesBefore is active. The beacon starts early (when entering the
 * visibility animation window) to control the full animation as one gesture.
 * 
 * Timeline (continuous from beacon onset):
 * - 0s to 0.5s: Scale from start (0% if hide-before, else 100%) to 200%
 * - 0.5s to 1s: Scale from 200% to 100% (ease in-out)
 * - During pause: Hold at 100%
 * - On leaving: Stay at 100%, OR scale to 0% if hide-after
 * 
 * Key behavior: When hidesBefore is true, the beacon's 'onset' phase starts
 * BEFORE the path reaches the waypoint (when entering the animation window),
 * so the beacon controls the full 0%→200%→100% animation instead of clashing
 * with the visibility animation.
 */
class PopBeacon extends BaseBeacon {
  /** @type {string} Beacon type identifier (survives minification) */
  static TYPE = 'pop';
  
  constructor() {
    super();
    /** @type {string} Instance type identifier */
    this.type = 'pop';
    /** @type {number} Current scale (0-2) */
    this.scale = 1.0;
    /** @type {boolean} Whether animation has started */
    this.started = false;
    /** @type {number} Total elapsed time since animation started */
    this.elapsedTime = 0;
    /** @type {boolean} Whether hide-before is active */
    this.hidesBefore = false;
    /** @type {boolean} Whether hide-after is active */
    this.hidesAfter = false;
    /** @type {boolean} Whether the intro animation (0-1s) is complete */
    this.introComplete = false;
    /** @type {number} Time spent in offset phase for hide-after animation */
    this.offsetTime = 0;
  }
  
  sync(localSec, win, options = {}) {
    super.sync(localSec, win, options);

    this.hidesBefore = options.hidesBefore || false;
    this.hidesAfter = options.hidesAfter || false;

    const T = BEACON_TIMING;
    const startScale = this.hidesBefore ? T.POP_MIN_SCALE : T.POP_BASE_SCALE;
    const introDur = T.POP_SCALE_UP_DURATION + T.POP_SCALE_DOWN_DURATION; // 1s
    // The intro always runs to completion once the clock starts; the
    // wind-down begins after the pause window (or after the intro when the
    // window is shorter than the intro itself).
    const offsetStart = Math.max(introDur, win.holdEndSec);

    this.elapsedTime = Math.max(0, localSec);
    this.introComplete = localSec > introDur;
    this.offsetTime = Math.max(0, localSec - offsetStart);

    if (localSec < 0) {
      this.scale = startScale;
      return;
    }
    if (localSec <= T.POP_SCALE_UP_DURATION) {
      // 0s-0.5s: scale up to 200%
      const eased = BeaconEasing.easeInOut(localSec / T.POP_SCALE_UP_DURATION);
      this.scale = startScale + eased * (T.POP_PEAK_SCALE - startScale);
      return;
    }
    if (localSec <= introDur) {
      // 0.5s-1s: scale down to 100%
      const eased = BeaconEasing.easeInOut((localSec - T.POP_SCALE_UP_DURATION) / T.POP_SCALE_DOWN_DURATION);
      this.scale = T.POP_PEAK_SCALE - eased * (T.POP_PEAK_SCALE - T.POP_BASE_SCALE);
      return;
    }
    if (localSec <= offsetStart) {
      // Hold at 100% through the pause window
      this.scale = T.POP_BASE_SCALE;
      return;
    }
    // Past the pause window: wind down
    if (this.hidesAfter) {
      const progress = Math.min(1, (localSec - offsetStart) / T.POP_SCALE_DOWN_DURATION);
      this.scale = T.POP_BASE_SCALE - BeaconEasing.easeInOut(progress) * T.POP_BASE_SCALE;
      this.completed = progress >= 1;
    } else {
      this.scale = T.POP_BASE_SCALE;
      this.completed = (localSec - offsetStart) > 0.5;
    }
  }
  
  render(ctx, x, y, markerSize, color, markerScale, sizeScale = 1) {
    // Pop overrides marker scale
    return { scale: this.scale };
  }
  
  reset() {
    super.reset();
    this.scale = 1.0;
    this.started = false;
    this.elapsedTime = 0;
    this.hidesBefore = false;
    this.hidesAfter = false;
    this.introComplete = false;
    this.offsetTime = 0;
  }
}

// ============================================================================
// GROW BEACON
// ============================================================================

/**
 * Grow beacon - Smooth scale to 200%, hold during pause, then back to 100%
 * 
 * This is a scale-controlling beacon that OVERRIDES the visibility animation
 * when hidesBefore is active. The beacon starts 2s early (before waypoint)
 * so the grow-up animation completes exactly when reaching the waypoint.
 * 
 * Animation phases (all timed internally using deltaTime):
 * 1. GROW-UP: 2s scale from startScale to 200% (completes at waypoint arrival)
 * 2. HOLD: Hold at 200% for user's configured pause time
 * 3. SCALE-DOWN: 1s scale from 200% to endScale (ease in-out)
 * 4. OFFSET-HOLD: Hold at endScale to override visibility animation
 * 
 * Timing:
 * - Beacon starts 2s before waypoint (early onset)
 * - Grow-up completes exactly at waypoint arrival
 * - Pause duration = user's pauseTime + 1s (for scale-down)
 * 
 * Behavior (with hide-before):
 * - startScale = 0% (beacon controls full 0%→200%→100% animation)
 * 
 * Behavior (with hide-after):
 * - endScale = 0% (beacon scales down to 0% instead of 100%)
 */
class GrowBeacon extends BaseBeacon {
  /** @type {string} Beacon type identifier (survives minification) */
  static TYPE = 'grow';
  
  constructor() {
    super();
    /** @type {string} Instance type identifier */
    this.type = 'grow';
    /** @type {number} Current scale (0-2) */
    this.scale = 1.0;
    /** @type {boolean} Whether animation has started */
    this.started = false;
    /** @type {boolean} Whether the grow-up animation is complete */
    this.growUpComplete = false;
    /** @type {boolean} Whether the scale-down animation is complete */
    this.scaleDownComplete = false;
    /** @type {number} Time spent in onset/grow-up phase (seconds) */
    this.onsetTime = 0;
    /** @type {number} Time spent holding at peak after grow-up (seconds) */
    this.holdTime = 0;
    /** @type {number} Time spent in scale-down animation (seconds) */
    this.scaleDownTime = 0;
    /** @type {number} Time spent in offset phase after scale-down (seconds) */
    this.offsetTime = 0;
    /** @type {boolean} Whether hide-before is active */
    this.hidesBefore = false;
    /** @type {boolean} Whether hide-after is active */
    this.hidesAfter = false;
  }
  
  /** Fixed hold at peak scale (seconds) — the pause budget in PlayerCore
   *  (remaining grow-up + this hold + scale-down + buffer) is sized to it. */
  static HOLD_DURATION_SEC = 1.0;

  sync(localSec, win, options = {}) {
    super.sync(localSec, win, options);

    this.hidesBefore = options.hidesBefore || false;
    this.hidesAfter = options.hidesAfter || false;

    const T = BEACON_TIMING;
    const startScale = this.hidesBefore ? 0 : T.GROW_BASE_SCALE;
    const endScale = this.hidesAfter ? 0 : T.GROW_BASE_SCALE;

    // Fixed local milestones: up 0-2s, hold 2-3s, down 3-4s, then rest at
    // endScale. The early-onset schedule aims the grow-up completion at the
    // waypoint arrival; whatever lead was unavailable spills into the pause,
    // whose PlayerCore budget covers exactly that spill.
    const upEnd = T.GROW_SCALE_UP_DURATION;
    const holdEnd = upEnd + GrowBeacon.HOLD_DURATION_SEC;
    const downEnd = holdEnd + T.GROW_SCALE_DOWN_DURATION;
    const restEnd = Math.max(downEnd, win.holdEndSec);

    this.onsetTime = Math.min(Math.max(0, localSec), upEnd);
    this.holdTime = Math.min(Math.max(0, localSec - upEnd), GrowBeacon.HOLD_DURATION_SEC);
    this.scaleDownTime = Math.min(Math.max(0, localSec - holdEnd), T.GROW_SCALE_DOWN_DURATION);
    this.growUpComplete = localSec >= upEnd;
    this.scaleDownComplete = localSec >= downEnd;
    this.offsetTime = Math.max(0, localSec - restEnd);

    if (localSec < 0) {
      this.scale = startScale;
      return;
    }
    if (localSec <= upEnd) {
      const eased = BeaconEasing.easeInOut(localSec / upEnd);
      this.scale = startScale + eased * (T.GROW_PEAK_SCALE - startScale);
      return;
    }
    if (localSec <= holdEnd) {
      this.scale = T.GROW_PEAK_SCALE;
      return;
    }
    if (localSec <= downEnd) {
      const eased = BeaconEasing.easeInOut((localSec - holdEnd) / T.GROW_SCALE_DOWN_DURATION);
      this.scale = T.GROW_PEAK_SCALE - eased * (T.GROW_PEAK_SCALE - endScale);
      return;
    }
    // Rest at end scale to override the visibility animation, then complete
    // half a second after the pause window releases the path.
    this.scale = endScale;
    this.completed = this.offsetTime > 0.5;
  }
  
  render(ctx, x, y, markerSize, color, markerScale, sizeScale = 1) {
    // Grow overrides marker scale
    return { scale: this.scale };
  }
  
  reset() {
    super.reset();
    this.scale = 1.0;
    this.started = false;
    this.growUpComplete = false;
    this.scaleDownComplete = false;
    this.onsetTime = 0;
    this.holdTime = 0;
    this.scaleDownTime = 0;
    this.offsetTime = 0;
    this.hidesBefore = false;
    this.hidesAfter = false;
  }
}

// ============================================================================
// PULSE BEACON
// ============================================================================

/**
 * Pulse beacon - Oscillating scale during pause with configurable amplitude and speed
 * 
 * This is a scale-controlling beacon that OVERRIDES the visibility animation
 * when hidesBefore is active. The beacon starts early (when entering the
 * visibility animation window) to control the full animation as one gesture.
 * 
 * ## Amplitude
 * Controls the scale range around 100%:
 * - 0: No change (always 100%)
 * - 1: 200% max, 50% min (default)
 * - 2: 300% max, 33% min
 * - 3: 400% max, 25% min
 * 
 * Formula: maxScale = 1 + amplitude, minScale = 1 / (1 + amplitude)
 * 
 * ## Cycle Speed
 * Duration of one full oscillation (max→min→max) in seconds.
 * Default: 4 seconds
 * 
 * ## Behavior (normal - always visible):
 * - Onset: 1/4 cycle from 100%→maxScale
 * - Loop: maxScale→minScale→maxScale (repeating)
 * - Exit: Loop ends at 100%, then 1/4 cycle from 100%→100% (no change needed)
 * 
 * ## Behavior (with hide-before):
 * - Beacon starts EARLY (in visibility animation window)
 * - Onset: 1/4 cycle from 0%→100%, then 1/4 cycle from 100%→maxScale
 * - Pulse takes over visibility animation entirely
 * 
 * ## Behavior (with hide-after):
 * - Exit: Loop ends at 100%, then 1/4 cycle from 100%→0%
 * - Pulse takes over visibility animation entirely
 */
class PulseBeacon extends BaseBeacon {
  /** @type {string} Beacon type identifier (survives minification) */
  static TYPE = 'pulse';
  
  constructor() {
    super();
    /** @type {string} Instance type identifier */
    this.type = 'pulse';
    /** @type {number} Current scale */
    this.scale = 1.0;
    /** @type {string} Sub-phase: 'fade-in', 'initial', 'loop', 'exit-to-base', 'fade-out' */
    this.subPhase = 'initial';
    /** @type {number} Time in current sub-phase */
    this.subPhaseTime = 0;
    /** @type {number} Time in loop phase */
    this.loopTime = 0;
    /** @type {boolean} Whether we're exiting the loop */
    this.exiting = false;
    /** @type {boolean} Whether hide-before is active */
    this.hidesBefore = false;
    /** @type {boolean} Whether hide-after is active */
    this.hidesAfter = false;
    /** @type {number} Amplitude (0-3) */
    this.amplitude = 1.0;
    /** @type {number} Cycle duration in seconds */
    this.cycleDuration = 4.0;
    /** @type {number} Cached max scale based on amplitude */
    this._maxScale = 2.0;
    /** @type {number} Cached min scale based on amplitude */
    this._minScale = 0.5;
  }
  
  /**
   * Calculate max and min scale from amplitude
   * @param {number} amplitude - Amplitude value (0-3)
   */
  _updateScaleRange(amplitude) {
    this.amplitude = Math.max(0, Math.min(3, amplitude));
    // maxScale = 1 + amplitude (e.g., amplitude 1 = 200%)
    this._maxScale = 1 + this.amplitude;
    // minScale = 1 / (1 + amplitude) (e.g., amplitude 1 = 50%)
    this._minScale = this.amplitude > 0 ? 1 / (1 + this.amplitude) : 1;
  }
  
  /**
   * Calculate scale for current position in loop cycle
   * Extracted to avoid duplication between hold and offset phases
   * @param {number} cycleProgress - Position in cycle (0-1)
   * @returns {number} Scale value
   * @private
   */
  _calculateLoopScale(cycleProgress) {
    // First half: maxScale→minScale, Second half: minScale→maxScale
    if (cycleProgress < 0.5) {
      const halfProgress = cycleProgress * 2;
      const eased = BeaconEasing.easeInOut(halfProgress);
      return this._maxScale - eased * (this._maxScale - this._minScale);
    } else {
      const halfProgress = (cycleProgress - 0.5) * 2;
      const eased = BeaconEasing.easeInOut(halfProgress);
      return this._minScale + eased * (this._maxScale - this._minScale);
    }
  }
  
  sync(localSec, win, options = {}) {
    super.sync(localSec, win, options);

    this.hidesBefore = options.hidesBefore || false;
    this.hidesAfter = options.hidesAfter || false;

    // Amplitude and cycle duration from waypoint options
    const amplitude = options.pulseAmplitude !== undefined ? options.pulseAmplitude : 1.0;
    this.cycleDuration = options.pulseCycleSpeed !== undefined ? options.pulseCycleSpeed : 4.0;
    this._updateScaleRange(amplitude);

    const quarterCycle = this.cycleDuration / 4;
    // Onset: rise to maxScale over a quarter cycle; with hide-before a
    // fade-in quarter (0%→100%) precedes it.
    const onsetDur = this.hidesBefore ? quarterCycle * 2 : quarterCycle;

    if (localSec < 0) {
      this.scale = this.hidesBefore ? 0 : BEACON_TIMING.PULSE_BASE_SCALE;
      this.subPhase = 'initial';
      this.subPhaseTime = 0;
      this.loopTime = 0;
      this.exiting = false;
      return;
    }

    if (localSec < onsetDur) {
      if (this.hidesBefore && localSec < quarterCycle) {
        // Fade in 0%→100%
        this.subPhase = 'fade-in';
        this.subPhaseTime = localSec;
        this.scale = BeaconEasing.easeInOut(localSec / quarterCycle);
      } else {
        // Rise 100%→maxScale
        this.subPhase = 'initial';
        const riseSec = this.hidesBefore ? localSec - quarterCycle : localSec;
        this.subPhaseTime = riseSec;
        const progress = Math.min(1, riseSec / quarterCycle);
        this.scale = 1 + BeaconEasing.easeInOut(progress) * (this._maxScale - 1);
      }
      this.loopTime = 0;
      this.exiting = false;
      return;
    }

    // Loop: maxScale→minScale→maxScale from the end of onset. The exit point
    // is the first upward 100%-crossing (~75% of a cycle) at or after the
    // pause window ends — computed directly, no per-frame crossing detection.
    const loopTime = localSec - onsetDur;
    this.loopTime = loopTime;
    const holdEndLoopTime = Math.max(0, win.holdEndSec - onsetDur);
    const k = Math.max(0, Math.ceil((holdEndLoopTime - 0.75 * this.cycleDuration) / this.cycleDuration));
    const exitLoopTime = (k + 0.75) * this.cycleDuration;

    if (loopTime < exitLoopTime) {
      this.subPhase = 'loop';
      this.subPhaseTime = 0;
      this.exiting = false;
      this.scale = this._calculateLoopScale((loopTime % this.cycleDuration) / this.cycleDuration);
      return;
    }

    // Exit: snap to 100% at the crossing, then fade out if hide-after
    this.exiting = true;
    const sinceExit = loopTime - exitLoopTime;
    this.subPhaseTime = sinceExit;
    if (this.hidesAfter) {
      this.subPhase = 'fade-out';
      const progress = Math.min(1, sinceExit / quarterCycle);
      this.scale = 1 - BeaconEasing.easeInOut(progress);
      this.completed = progress >= 1;
    } else {
      this.subPhase = 'exit-to-base';
      this.scale = BEACON_TIMING.PULSE_BASE_SCALE;
      this.completed = true;
    }
  }
  
  render(ctx, x, y, markerSize, color, markerScale, sizeScale = 1) {
    // Pulse overrides marker scale
    return { scale: this.scale };
  }
  
  reset() {
    super.reset();
    this.scale = 1.0;
    this.subPhase = 'initial';
    this.subPhaseTime = 0;
    this.loopTime = 0;
    this.exiting = false;
    this.hidesBefore = false;
    this.hidesAfter = false;
    this.amplitude = 1.0;
    this.cycleDuration = 4.0;
    this._maxScale = 2.0;
    this._minScale = 0.5;
  }
}

// ============================================================================
// BEACON RENDERER (MAIN CLASS)
// ============================================================================

/**
 * BeaconRenderer - Manages beacon effects for all waypoints
 * 
 * Usage:
 * ```js
 * const renderer = new BeaconRenderer();
 * 
 * // In animation loop:
 * renderer.update(deltaTime, waypoints, animationEngine, motionSettings);
 * 
 * // In render loop:
 * const scaleOverride = renderer.renderBeacon(ctx, waypoint, x, y, markerSize, color, markerScale);
 * if (scaleOverride) {
 *   // Use scaleOverride.scale instead of markerScale
 * }
 * ```
 */
export class BeaconRenderer {
  /**
   * Check if user prefers reduced motion (AAA accessibility)
   * Cached on first access, listens for changes
   * @type {boolean}
   */
  static prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  
  // Listen for changes to reduced motion preference
  static {
    window.matchMedia?.('(prefers-reduced-motion: reduce)')
      .addEventListener?.('change', (e) => {
        BeaconRenderer.prefersReducedMotion = e.matches;
      });
  }
  
  constructor() {
    /**
     * Map of waypoint ID to beacon instance
     * @type {Map<string, BaseBeacon>}
     */
    this.beacons = new Map();
    
    /**
     * Factory for creating beacon instances
     * @type {Object<string, function(): BaseBeacon>}
     */
    this.beaconFactory = {
      'none': () => null,
      'ripple': () => new RippleBeacon(),
      'glow': () => new GlowBeacon(),
      'pop': () => new PopBeacon(),
      'grow': () => new GrowBeacon(),
      'pulse': () => new PulseBeacon()
    };
  }
  
  /**
   * Get or create beacon for a waypoint
   * 
   * Beacon Lifecycle:
   * 1. Created on first access when waypoint has a beacon style
   * 2. Cached in this.beacons Map by waypoint ID for O(1) lookup
   * 3. Marked `completed` when animation finishes (e.g., all ripple rings faded)
   * 4. Completed beacons are preserved (not recreated) until animation reset
   * 5. Cleared via reset() when animation restarts
   * 
   * @param {Object} waypoint - Waypoint object with id and beaconStyle
   * @returns {BaseBeacon|null} Beacon instance or null if style is 'none'
   */
  getBeacon(waypoint) {
    const style = waypoint.beaconStyle || 'none';
    if (style === 'none') return null;

    const id = waypoint.id;
    let beacon = this.beacons.get(id);

    // Create new beacon if needed or if style changed
    // Use beacon.type property instead of constructor.name (survives minification)
    // (Completed beacons need no special casing: state is re-derived from the
    // local clock each sync, so scrubbing backwards simply revives them.)
    if (!beacon || beacon.type !== style) {
      const factory = this.beaconFactory[style];
      if (factory) {
        beacon = factory();
        if (beacon) {
          this.beacons.set(id, beacon);
        }
      }
    }

    return beacon;
  }
  
  /**
   * Determine beacon phase based on animation state
   * 
   * Phase logic:
   * - inactive: Before reaching waypoint (or before animation window for scale beacons)
   * - onset: Beacon starting up (at waypoint for ripple/glow, or in animation window for pop/grow/pulse)
   * - hold: Pausing at waypoint, beacon at full effect
   * - offset: Left waypoint, beacon winding down
   * 
   * Scale-controlling beacons (pop, grow, pulse) with hidesBefore start their 'onset' phase
   * earlier - when entering the visibility animation window - so they can control the full
   * 0% → peak → 100% animation instead of clashing with the visibility animation.
   * 
   * Overlay beacons (ripple, glow) layer on top of the visibility animation, so they
   * only activate when the path actually reaches the waypoint.
   * 
   * @param {Object} waypoint - Waypoint object (includes beaconStyle)
   * @param {number} waypointIndex - Index in waypoints array
   * @param {Object} animationEngine - Animation engine instance
   * @param {number} waypointPathProgress - Waypoint's position in path (0-1)
   * @param {number} currentPathProgress - Current animation progress (0-1)
   * @param {BaseBeacon} beacon - The beacon instance (to check its current state)
   * @param {Object} options - Additional options
   * @param {boolean} options.hidesBefore - Whether hidesBefore visibility mode is active
   * @param {number} options.prevWaypointProgress - Previous waypoint's progress (-1 if first)
   * @returns {{phase: string, pauseProgress: number, pauseElapsedMs: number}}
   */
  /**
   * Sync all beacons to a timeline instant.
   *
   * Each beacon's local clock and phase windows come from the schedules
   * PlayerCore precomputed (animationEngine.beaconSchedules) — the same data
   * that sized the pause windows — so beacon phases are closed-form in
   * timeline time and identical for play, scrub, and export.
   *
   * @param {number} adjustedTimelineMs - Timeline time in ms on the pause-marker
   *   axis (raw time minus start handle and intro)
   * @param {Array} waypoints - Array of waypoints
   * @param {Object} animationEngine - Animation engine instance (schedule source)
   * @param {Object} motionSettings - Motion visibility settings
   * @param {Array} waypointProgressValues - Unused; kept for call-site stability
   */
  update(adjustedTimelineMs, waypoints, animationEngine, motionSettings, waypointProgressValues = null) {
    if (!waypoints || !animationEngine) return;

    const { waypointVisibility } = motionSettings || {};
    const hidesBefore = waypointVisibility === 'hide-before' ||
                        waypointVisibility === 'hide-before-and-after';
    const hidesAfter = waypointVisibility === 'hide-after' ||
                       waypointVisibility === 'hide-before-and-after';
    const schedules = animationEngine.beaconSchedules || [];

    waypoints.forEach((waypoint) => {
      if (!waypoint.isMajor) return;

      const beacon = this.getBeacon(waypoint);
      if (!beacon) return;

      const sched = schedules.find(s => s.waypointId === waypoint.id);
      if (!sched) return; // Timeline not built yet (e.g. before first path calc)

      // Scale-controlling beacons take over early when they own the reveal
      // (hide-before); grow always leads by its grow-up window. Overlay
      // beacons (ripple, glow) start at waypoint arrival.
      const useEarly = sched.style === 'grow' ||
        ((sched.style === 'pop' || sched.style === 'pulse') && hidesBefore);
      const clockStartMs = useEarly ? sched.earlyOnsetStartMs : sched.arrivalMs;
      const localSec = (adjustedTimelineMs - clockStartMs) / 1000;
      const win = {
        arrivalSec: (sched.arrivalMs - clockStartMs) / 1000,
        holdEndSec: (sched.holdEndMs - clockStartMs) / 1000,
      };

      // AAA (WCAG 2.3.3 / motion discipline): suppress animated beacons under
      // prefers-reduced-motion. pulse/ripple loop continuously and glow is a
      // ~3s radial bloom — all skipped (marker held static). pop/grow are brief
      // one-shot reveal transitions and remain.
      if (BeaconRenderer.prefersReducedMotion) {
        const beaconType = waypoint.beaconStyle;
        if (beaconType === 'pulse' || beaconType === 'ripple' || beaconType === 'glow') {
          beacon.scale = 1.0; // Hold marker at normal scale; skip the animated effect
          return;
        }
      }

      beacon.sync(localSec, win, {
        hidesBefore,
        hidesAfter,
        // Ripple settings
        rippleThickness: waypoint.rippleThickness,
        rippleMaxScale: waypoint.rippleMaxScale,
        // Pulse settings
        pulseAmplitude: waypoint.pulseAmplitude,
        pulseCycleSpeed: waypoint.pulseCycleSpeed,
      });
    });
  }
  
  /**
   * Render beacon for a waypoint
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} waypoint - Waypoint object
   * @param {number} x - Center X coordinate
   * @param {number} y - Center Y coordinate
   * @param {number} markerSize - Base marker size in pixels
   * @param {number} markerScale - Current marker scale from visibility animation
   * @param {number} sizeScale - Scale factor for sizes based on image dimensions (default 1)
   * @returns {{scale: number}|null} Scale override for marker, or null if no override
   */
  renderBeacon(ctx, waypoint, x, y, markerSize, markerScale, sizeScale = 1) {
    const beacon = this.beacons.get(waypoint.id);
    if (!beacon || !beacon.isActive()) return null;
    
    // Use marker color (dotColor) for beacon — skip if transparent (None swatch)
    const color = waypoint.dotColor || waypoint.segmentColor || '#D55E00';
    if (color === 'transparent') return null;
    
    return beacon.render(ctx, x, y, markerSize, color, markerScale, sizeScale);
  }
  
  /**
   * Reset all beacons - clears the beacon cache
   * 
   * Called when animation resets to allow beacons to play again.
   * This is more efficient than resetting each beacon individually
   * because new beacons are created lazily on first access.
   * 
   * @see RenderingService.resetBeacons() - wrapper that also resets frame timing
   */
  reset() {
    this.beacons.clear();
  }
  
  /**
   * Reset beacon for a specific waypoint
   * 
   * Used when changing beacon style on a single waypoint.
   * The beacon will be recreated with the new style on next access.
   * 
   * @param {string} waypointId - Waypoint ID
   */
  resetBeacon(waypointId) {
    const beacon = this.beacons.get(waypointId);
    if (beacon) {
      beacon.reset();
    }
  }
  
}

// Export beacon types for testing
export { RippleBeacon, GlowBeacon, PopBeacon, GrowBeacon, PulseBeacon, BaseBeacon, BeaconEasing };
