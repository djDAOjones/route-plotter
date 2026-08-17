/**
 * BeaconRenderer - Modular beacon effect system for waypoint animations
 * 
 * ## Architecture
 * Each beacon type is a separate class implementing a common interface:
 * - update(deltaTime, phase, pauseProgress) - Update animation state
 * - render(ctx, x, y, markerSize, color, markerScale) - Draw the effect
 * - reset() - Reset animation state
 * 
 * ## Beacon Types
 * - **none**: No beacon effect
 * - **ripple**: Concentric rings radiating outward (4 rings, 1s apart)
 * - **glow**: Box shadow that builds up then fades
 * - **pop**: Quick scale 100%→200%→100% (or 0%→200%→0% with hide-before/after)
 * - **grow**: Smooth scale to 200%, hold during pause, then back to 100%
 * - **pulse**: Oscillating scale 200%↔50% during pause
 * 
 * ## Phases
 * - `onset`: Animation building up (approaching waypoint)
 * - `hold`: Holding at waypoint (during pause)
 * - `offset`: Animation winding down (leaving waypoint)
 * - `inactive`: Beacon not active
 * 
 * ## Integration with Waypoint Visibility
 * Pop, grow, and pulse beacons can override waypoint visibility animations
 * when hide-before or hide-after modes are active.
 * 
 * @module BeaconRenderer
 */

import { Easing } from '../utils/Easing.js';

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
    /** @type {number} Current animation time in seconds */
    this.time = 0;
    /** @type {string} Current phase: 'inactive', 'onset', 'hold', 'offset' */
    this.phase = 'inactive';
    /** @type {boolean} Whether beacon has completed its animation */
    this.completed = false;
  }
  
  /**
   * Update beacon animation state
   * @param {number} deltaTime - Time elapsed in seconds
   * @param {string} phase - Current animation phase
   * @param {number} pauseProgress - Progress through pause (0-1), -1 if not pausing
   * @param {Object} options - Additional options (hidesBefore, hidesAfter, etc.)
   */
  update(deltaTime, phase, pauseProgress, options = {}) {
    this.time += deltaTime;
    this.phase = phase;
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
 * Phase Handling:
 * - During 'hold' phase: time is synchronized with pauseElapsedMs from AnimationEngine
 * - During 'onset'/'offset': time accumulates via deltaTime
 * - Rings spawn during 'onset', 'hold', or 'offset' (if already started)
 * - This synchronization ensures beacon animation matches actual pause duration
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
  
  update(deltaTime, phase, pauseProgress, options = {}) {
    // Don't call super.update() - we manage time ourselves for synchronization
    this.phase = phase;
    
    // Update settings from options
    this.thickness = options.rippleThickness || 2;
    const newMaxScale = options.rippleMaxScale || 1000;
    const pauseElapsedMs = options.pauseElapsedMs || 0;
    
    // Detect maxScale change and reset if needed to prevent visual glitches
    if (newMaxScale !== this.maxScale && this.rings.length > 0) {
      // MaxScale changed mid-animation - reset to start fresh
      this.rings = [];
      this.allSpawned = false;
      this.spawnCount = 0;
      this.time = 0;
      this._lastPhase = null;
    }
    this.maxScale = newMaxScale;
    
    // Synchronize beacon time with pause elapsed time during hold phase
    // This ensures the beacon animation matches the actual pause duration
    if (phase === 'hold' && pauseElapsedMs > 0) {
      // Use pause elapsed time directly (convert ms to seconds)
      this.time = pauseElapsedMs / 1000;
      // Remember the hold time so we can continue from it in offset phase
      this._lastHoldTime = this.time;
    } else if (phase === 'onset') {
      // During onset, accumulate time normally
      this.time += deltaTime;
    } else if (phase === 'offset') {
      // During offset, continue from where hold phase left off
      // This ensures rings spawned during hold continue their animation
      if (this._lastHoldTime !== undefined && this._lastHoldTime > this.time) {
        this.time = this._lastHoldTime;
      }
      this.time += deltaTime;
    }
    // During inactive phase, don't accumulate time
    
    // Track phase transitions for debugging (controlled by static flag)
    if (RippleBeacon.DEBUG && phase !== this._lastPhase) {
      console.log(`🔔 [Ripple] Phase transition: ${this._lastPhase || 'none'} → ${phase} at t=${this.time.toFixed(2)}s pauseEl:${pauseElapsedMs}ms`);
    }
    this._lastPhase = phase;
    
    const T = BEACON_TIMING;
    // Duration and interval scale with maxScale for constant visual speed
    const ringDuration = this.calculateDuration(this.maxScale);
    const spawnInterval = ringDuration; // Each ring spawns as previous completes
    
    // Debug logging (throttled, controlled by static flag)
    if (RippleBeacon.DEBUG && (!this._lastDebugTime || this.time - this._lastDebugTime > 0.25)) {
      const nextSpawnTime = this.spawnCount * spawnInterval;
      const timeUntilNextSpawn = nextSpawnTime - this.time;
      console.log(`🔔 [Ripple] t:${this.time.toFixed(2)}s scale:${this.maxScale}% dur:${ringDuration.toFixed(2)}s rings:${this.rings.length} spawned:${this.spawnCount}/${T.RIPPLE_COUNT} phase:${phase} pauseEl:${pauseElapsedMs}ms nextSpawn:${timeUntilNextSpawn.toFixed(2)}s`);
      this._lastDebugTime = this.time;
    }
    
    // Spawn new rings during onset/hold phases, OR continue spawning in offset if already started
    // This ensures all rings spawn even if the wait ends slightly early due to timing
    const canSpawn = (phase === 'onset' || phase === 'hold') || 
                     (phase === 'offset' && this.spawnCount > 0 && !this.allSpawned);
    
    if (canSpawn && !this.allSpawned) {
      // Calculate how many rings should exist based on elapsed time
      const targetRingCount = Math.min(
        T.RIPPLE_COUNT,
        Math.floor(this.time / spawnInterval) + 1
      );
      
      // Spawn rings to catch up to target count
      while (this.spawnCount < targetRingCount) {
        this.rings.push({
          startTime: this.spawnCount * spawnInterval,
          opacity: 1.0
        });
        this.spawnCount++;
        if (RippleBeacon.DEBUG) {
          console.log(`🔔 [Ripple] Spawned ring ${this.spawnCount} at t=${((this.spawnCount-1) * spawnInterval).toFixed(2)}s (phase:${phase})`);
        }
        
        if (this.spawnCount >= T.RIPPLE_COUNT) {
          this.allSpawned = true;
          if (RippleBeacon.DEBUG) {
            console.log(`🔔 [Ripple] All ${T.RIPPLE_COUNT} rings spawned`);
          }
        }
      }
    }
    
    // Update ring opacities and remove completed rings
    // Opacity held at 100% for RIPPLE_FADE_START fraction, then fades to 0%
    const fadeStartTime = ringDuration * T.RIPPLE_FADE_START;
    
    this.rings = this.rings.filter(ring => {
      const age = this.time - ring.startTime;
      
      // Calculate opacity: 100% until fadeStart, then smooth fade to 0%
      if (age >= fadeStartTime) {
        const fadeProgress = (age - fadeStartTime) / (ringDuration - fadeStartTime);
        ring.opacity = 1.0 - BeaconEasing.smoothStep(Math.min(1, fadeProgress));
      } else {
        ring.opacity = 1.0; // Full opacity before fade starts
      }
      
      // Keep ring if still visible
      return age < ringDuration && ring.opacity > 0.01;
    });
    
    // Mark as completed when all rings are done
    if (this.allSpawned && this.rings.length === 0) {
      this.completed = true;
    }
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
    this._lastPhase = null;
    this._lastDebugTime = null;
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
  
  update(deltaTime, phase, pauseProgress, options = {}) {
    super.update(deltaTime, phase, pauseProgress, options);
    
    // Start animation when we first reach the waypoint
    if (phase !== 'inactive' && !this.started) {
      this.started = true;
      this.elapsedTime = 0;
    }
    
    // Don't animate if not started
    if (!this.started) return;
    
    // Accumulate time (continuous animation, ignores phase)
    this.elapsedTime += deltaTime;
    
    const T = BEACON_TIMING;
    const totalDuration = T.GLOW_ONSET_DURATION + T.GLOW_FADE_DURATION; // 3s total
    
    if (this.elapsedTime <= T.GLOW_ONSET_DURATION) {
      // Phase 1: 0s-1s - Radius eases in, opacity at 100%
      const progress = this.elapsedTime / T.GLOW_ONSET_DURATION;
      this.radius = BeaconEasing.easeIn(progress);
      this.opacity = 1.0;
    } else if (this.elapsedTime <= totalDuration) {
      // Phase 2: 1s-3s - Radius at max, opacity fades linearly
      this.radius = 1.0;
      const fadeProgress = (this.elapsedTime - T.GLOW_ONSET_DURATION) / T.GLOW_FADE_DURATION;
      this.opacity = 1.0 - fadeProgress; // Linear fade
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
  
  update(deltaTime, phase, pauseProgress, options = {}) {
    super.update(deltaTime, phase, pauseProgress, options);
    
    this.hidesBefore = options.hidesBefore || false;
    this.hidesAfter = options.hidesAfter || false;
    
    const T = BEACON_TIMING;
    const startScale = this.hidesBefore ? T.POP_MIN_SCALE : T.POP_BASE_SCALE;
    
    // Start animation when beacon phase becomes active
    // For scale-controlling beacons with hidesBefore, the beacon takes over EARLY
    // (during the visibility animation window) so it controls the full 0%→200%→100%
    // animation as a single coherent gesture
    if (phase !== 'inactive' && !this.started) {
      this.started = true;
      this.elapsedTime = 0;
      this.scale = startScale; // 0% if hidesBefore, 100% otherwise
    }
    
    // Don't animate if not started
    if (!this.started) return;
    
    // If intro animation not complete, run it regardless of phase
    if (!this.introComplete) {
      this.elapsedTime += deltaTime;
      
      if (this.elapsedTime <= T.POP_SCALE_UP_DURATION) {
        // Phase 1: 0s-0.5s - Scale up to 200%
        const progress = this.elapsedTime / T.POP_SCALE_UP_DURATION;
        const eased = BeaconEasing.easeInOut(progress);
        this.scale = startScale + eased * (T.POP_PEAK_SCALE - startScale);
      } else if (this.elapsedTime <= T.POP_SCALE_UP_DURATION + T.POP_SCALE_DOWN_DURATION) {
        // Phase 2: 0.5s-1s - Scale down to 100%
        const progress = (this.elapsedTime - T.POP_SCALE_UP_DURATION) / T.POP_SCALE_DOWN_DURATION;
        const eased = BeaconEasing.easeInOut(progress);
        this.scale = T.POP_PEAK_SCALE - eased * (T.POP_PEAK_SCALE - T.POP_BASE_SCALE);
      } else {
        // Intro complete, hold at 100%
        this.introComplete = true;
        this.scale = T.POP_BASE_SCALE;
      }
      return;
    }
    
    // Intro complete - handle hold and offset phases
    if (phase === 'hold' || phase === 'onset') {
      // Hold at 100%
      this.scale = T.POP_BASE_SCALE;
      this.offsetTime = 0;
    } else if (phase === 'offset') {
      if (this.hidesAfter) {
        // Scale down to 0%
        this.offsetTime += deltaTime;
        const progress = Math.min(1, this.offsetTime / T.POP_SCALE_DOWN_DURATION);
        const eased = BeaconEasing.easeInOut(progress);
        this.scale = T.POP_BASE_SCALE - eased * T.POP_BASE_SCALE;
        
        if (progress >= 1) {
          this.completed = true;
        }
      } else {
        // Stay at 100%
        this.scale = T.POP_BASE_SCALE;
        // Mark complete after brief hold
        this.offsetTime += deltaTime;
        if (this.offsetTime > 0.5) {
          this.completed = true;
        }
      }
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
  
  update(deltaTime, phase, pauseProgress, options = {}) {
    super.update(deltaTime, phase, pauseProgress, options);
    
    this.hidesBefore = options.hidesBefore || false;
    this.hidesAfter = options.hidesAfter || false;
    
    const T = BEACON_TIMING;
    const startScale = this.hidesBefore ? 0 : T.GROW_BASE_SCALE;
    const endScale = this.hidesAfter ? 0 : T.GROW_BASE_SCALE;
    
    // Fixed hold duration at peak scale (1 second)
    // The AnimationEngine extends the pause to accommodate grow-up + hold + scale-down
    // So we use a fixed hold time here, not the user's pauseTime
    const HOLD_DURATION_SEC = 1.0;
    
    // Start animation when beacon phase becomes active
    if (phase !== 'inactive' && !this.started) {
      this.started = true;
      this.onsetTime = 0;
      this.holdTime = 0;
      this.scaleDownTime = 0;
      this.scale = startScale;
    }
    
    if (!this.started) return;
    
    // PHASE 1: Grow-up animation (2 seconds)
    if (!this.growUpComplete) {
      this.onsetTime += deltaTime;
      const progress = Math.min(1, this.onsetTime / T.GROW_SCALE_UP_DURATION);
      const eased = BeaconEasing.easeInOut(progress);
      this.scale = startScale + eased * (T.GROW_PEAK_SCALE - startScale);
      
      if (progress >= 1) {
        this.growUpComplete = true;
        this.scale = T.GROW_PEAK_SCALE;
        this.holdTime = 0;
      }
      return;
    }
    
    // PHASE 2: Hold at peak for fixed duration (1 second)
    if (!this.scaleDownComplete && this.holdTime < HOLD_DURATION_SEC) {
      this.holdTime += deltaTime;
      this.scale = T.GROW_PEAK_SCALE;
      return;
    }
    
    // PHASE 3: Scale-down animation (1 second)
    if (!this.scaleDownComplete) {
      this.scaleDownTime += deltaTime;
      const progress = Math.min(1, this.scaleDownTime / T.GROW_SCALE_DOWN_DURATION);
      const eased = BeaconEasing.easeInOut(progress);
      this.scale = T.GROW_PEAK_SCALE - eased * (T.GROW_PEAK_SCALE - endScale);
      
      if (progress >= 1) {
        this.scaleDownComplete = true;
        this.scale = endScale;
      }
      return;
    }
    
    // PHASE 4: Hold at end scale to override visibility animation
    this.scale = endScale;
    this.offsetTime += deltaTime;
    
    // Only mark completed after holding for 0.5s in offset phase
    // This ensures we override the visibility animation's scale-down
    if (phase === 'offset' && this.offsetTime > 0.5) {
      this.completed = true;
    }
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
  
  update(deltaTime, phase, pauseProgress, options = {}) {
    super.update(deltaTime, phase, pauseProgress, options);
    
    this.hidesBefore = options.hidesBefore || false;
    this.hidesAfter = options.hidesAfter || false;
    
    // Update amplitude and cycle duration from waypoint options
    const amplitude = options.pulseAmplitude !== undefined ? options.pulseAmplitude : 1.0;
    this.cycleDuration = options.pulseCycleSpeed !== undefined ? options.pulseCycleSpeed : 4.0;
    this._updateScaleRange(amplitude);
    
    // Quarter cycle duration (used for onset/exit transitions)
    const quarterCycle = this.cycleDuration / 4;
    
    // Get pause elapsed time for syncing animation during pauses
    const pauseElapsedMs = options.pauseElapsedMs || 0;
    const pauseElapsedSec = pauseElapsedMs / 1000;
    
    if (phase === 'onset') {
      // Onset phase uses this.time (accumulated via deltaTime) for smooth animation
      // We do NOT use pauseElapsedSec here because:
      // 1. pauseElapsedSec starts at 0 when pause begins, but this.time has already accumulated
      // 2. Switching to pauseElapsedSec would cause a visual jump/restart
      // 3. The onset animation should continue smoothly regardless of pause state
      
      if (this.hidesBefore) {
        // With hide-before: fade in 0%→100%, then 100%→maxScale
        if (this.subPhase !== 'fade-in' && this.subPhase !== 'initial') {
          this.subPhase = 'fade-in';
          this.subPhaseTime = 0;
        }
        
        if (this.subPhase === 'fade-in') {
          this.subPhaseTime += deltaTime;
          const progress = Math.min(1, this.subPhaseTime / quarterCycle);
          const eased = BeaconEasing.easeInOut(progress);
          this.scale = eased; // 0→1
          
          if (progress >= 1) {
            this.subPhase = 'initial';
            this.subPhaseTime = 0;
          }
        } else {
          // initial: 100%→maxScale
          this.subPhaseTime += deltaTime;
          const progress = Math.min(1, this.subPhaseTime / quarterCycle);
          const eased = BeaconEasing.easeInOut(progress);
          this.scale = 1 + eased * (this._maxScale - 1);
        }
      } else {
        // Normal: 100%→maxScale
        this.subPhase = 'initial';
        const progress = Math.min(1, this.time / quarterCycle);
        const eased = BeaconEasing.easeInOut(progress);
        this.scale = 1 + eased * (this._maxScale - 1);
      }
      
      this.loopTime = 0;
      this.exiting = false;
    } else if (phase === 'hold') {
      this.subPhase = 'loop';
      
      // Sync loop time with pause elapsed time for smooth animation during pause
      // This ensures the pulse continues animating even when the path is waiting
      // (pauseElapsedMs already extracted at top of method)
      if (pauseElapsedMs > 0) {
        // Subtract onset duration from pauseElapsedMs since onset happens first
        // Onset duration is quarterCycle (1s for 4s cycle)
        const onsetDurationMs = quarterCycle * 1000;
        const holdElapsedMs = Math.max(0, pauseElapsedMs - onsetDurationMs);
        this.loopTime = holdElapsedMs / 1000;
      } else {
        this.loopTime += deltaTime;
      }
      // Remember the loop time so we can continue from it in offset phase
      this._lastLoopTime = this.loopTime;
      
      // Calculate position in loop cycle (0-1 for full cycle)
      const cycleProgress = (this.loopTime % this.cycleDuration) / this.cycleDuration;
      this.scale = this._calculateLoopScale(cycleProgress);
    } else if (phase === 'offset') {
      if (!this.exiting) {
        // Continue loop until we reach 100% (base scale)
        // Ensure we continue from where hold phase left off
        if (this._lastLoopTime !== undefined && this._lastLoopTime > this.loopTime) {
          this.loopTime = this._lastLoopTime;
        }
        this.loopTime += deltaTime;
        const cycleProgress = (this.loopTime % this.cycleDuration) / this.cycleDuration;
        
        // Find when we cross 100% (happens at ~25% and ~75% of cycle)
        // We want to exit when going UP through 100% (at ~75% of cycle)
        const crossingPoint = 0.75;
        const tolerance = 0.05;
        
        if (cycleProgress >= crossingPoint - tolerance && cycleProgress <= crossingPoint + tolerance) {
          this.exiting = true;
          this.scale = 1.0; // Snap to 100%
          this.subPhaseTime = 0;
          this.subPhase = this.hidesAfter ? 'fade-out' : 'exit-to-base';
        } else {
          // Continue loop until we can exit
          this.scale = this._calculateLoopScale(cycleProgress);
        }
      } else {
        // Exit animation
        this.subPhaseTime += deltaTime;
        
        if (this.subPhase === 'fade-out') {
          // Fade out: 100%→0%
          const progress = Math.min(1, this.subPhaseTime / quarterCycle);
          const eased = BeaconEasing.easeInOut(progress);
          this.scale = 1 - eased; // 1→0
          
          if (progress >= 1) {
            this.completed = true;
          }
        } else {
          // Already at 100%, just mark complete
          this.scale = 1.0;
          this.completed = true;
        }
      }
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
    this._lastLoopTime = undefined;
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
    
    // Completed beacons are preserved until animation reset
    // This prevents infinite recreation at 100% progress
    if (beacon && beacon.completed) {
      return beacon;
    }
    
    // Create new beacon if needed or if style changed
    // Use beacon.type property instead of constructor.name (survives minification)
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
  getBeaconPhase(waypoint, waypointIndex, animationEngine, waypointPathProgress, currentPathProgress, beacon, options = {}) {
    const state = animationEngine.state;
    const { hidesBefore = false, prevWaypointProgress = -1 } = options;
    
    // Check if waiting at this waypoint
    const isWaitingHere = state.isWaitingAtWaypoint && state.pauseWaypointIndex === waypointIndex;
    
    // Check position relative to waypoint
    const reachedWaypoint = currentPathProgress >= waypointPathProgress - 0.001;
    const pastWaypoint = currentPathProgress > waypointPathProgress + 0.001 && !isWaitingHere;
    
    // Scale-controlling beacons (pop, grow, pulse) need to start earlier when hidesBefore
    // is active, so they can control the full scale animation from 0% instead of clashing
    // with the visibility animation
    const beaconStyle = waypoint.beaconStyle || 'none';
    const isScaleControllingBeacon = beaconStyle === 'pop' || beaconStyle === 'grow' || beaconStyle === 'pulse';
    
    // Calculate early onset for scale-controlling beacons
    // - Pop/Pulse with hidesBefore: 0.25s early (matches visibility animation)
    // - Grow: Always 2s early (full grow-up animation completes before waypoint)
    const needsEarlyOnset = (isScaleControllingBeacon && hidesBefore) || beaconStyle === 'grow';
    
    if (needsEarlyOnset && !reachedWaypoint) {
      const pathDuration = animationEngine.state.duration || 10000;
      
      // Grow beacon needs 2 second lead time for full scale-up animation (2s grow-up)
      // Pop/Pulse with hidesBefore use 0.25s to match visibility animation
      const targetAnimMs = beaconStyle === 'grow' ? 2000 : 250;
      
      let idealAnimProgress = pathDuration > 0 ? targetAnimMs / pathDuration : 0.01;
      // For grow, allow up to 50% of path progress; for others, 8%
      const maxProgress = beaconStyle === 'grow' ? 0.50 : 0.08;
      idealAnimProgress = Math.max(0.01, Math.min(maxProgress, idealAnimProgress));
      
      // Constrain to available space before waypoint
      const availableBefore = prevWaypointProgress >= 0 
        ? (waypointPathProgress - prevWaypointProgress) / 2
        : waypointPathProgress;
      const animInProgress = Math.max(0.01, Math.min(idealAnimProgress, availableBefore));
      const animInStart = Math.max(0, waypointPathProgress - animInProgress);
      
      // If we're in the animation window, start onset phase early
      if (currentPathProgress >= animInStart) {
        return { phase: 'onset', pauseProgress: -1, pauseElapsedMs: 0 };
      }
    }
    
    // Standard logic for all other cases
    
    // If we haven't reached the waypoint yet
    if (!reachedWaypoint) {
      return { phase: 'inactive', pauseProgress: -1, pauseElapsedMs: 0 };
    }
    
    // If we're waiting at this waypoint (paused)
    if (isWaitingHere) {
      const pauseProgress = state.waitProgress || 0;
      // Calculate elapsed time in ms for beacon synchronization
      const pauseElapsedMs = this._getPauseElapsed(animationEngine, waypointIndex);
      
      // For Pulse beacons, stay in onset phase until onset animation completes
      // Onset duration is quarterCycle (cycleDuration / 4)
      // This ensures smooth transition from onset to hold during pause
      if (beaconStyle === 'pulse') {
        const cycleDuration = waypoint.pulseCycleSpeed || 4.0; // seconds
        const quarterCycle = cycleDuration / 4;
        const onsetDurationMs = quarterCycle * 1000;
        
        // If we're still in onset phase, return onset with pauseElapsedMs
        if (pauseElapsedMs < onsetDurationMs) {
          return { phase: 'onset', pauseProgress, pauseElapsedMs };
        }
      }
      
      return { phase: 'hold', pauseProgress, pauseElapsedMs };
    }
    
    // If we've passed the waypoint and are no longer waiting
    if (pastWaypoint) {
      return { phase: 'offset', pauseProgress: -1, pauseElapsedMs: 0 };
    }
    
    // Special case: at 100% progress (end of timeline), check if beacon is complete
    // This prevents infinite spawning at the final waypoint
    // Only transition to offset if the beacon has actually completed (all rings faded out)
    if (currentPathProgress >= 0.999 && beacon && beacon.completed) {
      return { phase: 'offset', pauseProgress: -1, pauseElapsedMs: 0 };
    }
    
    // We're at the waypoint but not yet in hold phase
    // This is the onset phase - beacon is starting up
    return { phase: 'onset', pauseProgress: -1, pauseElapsedMs: 0 };
  }
  
  /**
   * Get elapsed time within current waypoint pause.
   * @param {Object} animationEngine - Animation engine instance
   * @param {number} waypointIndex - Index of the waypoint
   * @returns {number} Elapsed pause time in ms, or 0 if not paused
   * @private
   */
  _getPauseElapsed(animationEngine, waypointIndex) {
    if (!animationEngine.pauseMarkers) return 0;
    
    const marker = animationEngine.pauseMarkers.find(m => m.waypointIndex === waypointIndex);
    if (!marker) return 0;
    
    // Use absolute time (timelineStartMs) instead of percentage
    // Subtract startHandleTime since marker times are relative to animation start (after handle)
    const timelineTime = animationEngine.state.progress * animationEngine.state.duration;
    const adjustedTime = timelineTime - (animationEngine.startHandleTime || 0);
    return Math.max(0, adjustedTime - marker.timelineStartMs);
  }
  
  /**
   * Enable/disable debug logging for beacon effects
   * @type {boolean}
   */
  static DEBUG_BEACONS = false;
  
  /**
   * Update all active beacons
   * @param {number} deltaTime - Time elapsed in seconds
   * @param {Array} waypoints - Array of waypoints
   * @param {Object} animationEngine - Animation engine instance
   * @param {Object} motionSettings - Motion visibility settings
   * @param {Array} waypointProgressValues - Pre-calculated waypoint progress values
   */
  update(deltaTime, waypoints, animationEngine, motionSettings, waypointProgressValues = null) {
    if (!waypoints || !animationEngine) return;
    
    const currentPathProgress = animationEngine.getPathProgress();
    const { waypointVisibility } = motionSettings || {};
    
    // Determine hide-before/after from motion settings
    const hidesBefore = waypointVisibility === 'hide-before' || 
                        waypointVisibility === 'hide-before-and-after';
    const hidesAfter = waypointVisibility === 'hide-after' || 
                       waypointVisibility === 'hide-before-and-after';
    
    // Build list of major waypoint progress values for prev/next lookups
    const majorWaypointProgresses = [];
    waypoints.forEach((wp, idx) => {
      if (wp.isMajor) {
        const progress = waypointProgressValues?.[idx] ?? idx / Math.max(1, waypoints.length - 1);
        majorWaypointProgresses.push({ index: idx, progress });
      }
    });
    
    waypoints.forEach((waypoint, index) => {
      if (!waypoint.isMajor) return;
      
      const beacon = this.getBeacon(waypoint);
      if (!beacon) return;
      
      // Get waypoint progress
      const waypointPathProgress = waypointProgressValues?.[index] ?? 
        index / Math.max(1, waypoints.length - 1);
      
      // Find previous major waypoint progress for animation window calculation
      const majorIdx = majorWaypointProgresses.findIndex(m => m.index === index);
      const prevWaypointProgress = majorIdx > 0 
        ? majorWaypointProgresses[majorIdx - 1].progress 
        : -1;
      
      // Get beacon phase (pass options for early onset of scale-controlling beacons)
      const { phase, pauseProgress, pauseElapsedMs } = this.getBeaconPhase(
        waypoint, index, animationEngine, waypointPathProgress, currentPathProgress, beacon,
        { hidesBefore, prevWaypointProgress }
      );
      
      // Pass waypoint-specific beacon settings
      const options = { 
        hidesBefore, 
        hidesAfter,
        // Ripple settings
        rippleThickness: waypoint.rippleThickness,
        rippleMaxScale: waypoint.rippleMaxScale,
        // Pulse settings
        pulseAmplitude: waypoint.pulseAmplitude,
        pulseCycleSpeed: waypoint.pulseCycleSpeed,
        // Timing info for synchronization
        pauseElapsedMs
      };
      
      // Skip update if beacon has completed its animation cycle
      // Completed beacons remain in the map to prevent recreation
      if (beacon.completed) return;
      
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
      
      // Update beacon state (time accumulation, ring spawning, opacity fading, etc.)
      beacon.update(deltaTime, phase, pauseProgress, options);
      
      // Debug logging (disabled by default for performance)
      if (BeaconRenderer.DEBUG_BEACONS && phase !== 'inactive' && !beacon.completed) {
        const beaconType = waypoint.beaconStyle;
        const scale = beacon.scale !== undefined ? beacon.scale.toFixed(2) : 'N/A';
        const subPhase = beacon.subPhase || 'N/A';
        console.log(`🔔 [Beacon] wp${index} ${beaconType} phase:${phase} subPhase:${subPhase} scale:${scale} time:${beacon.time.toFixed(2)}s`);
      }
    });
    
    // Completed beacons stay in map until animation reset (via reset())
    // This is more efficient than delete/recreate cycles
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
  
  /**
   * Enable or disable debug logging
   * Can be called from console: window.routePlotter.renderingService.beaconRenderer.setDebug(true)
   * @param {boolean} enabled - Whether to enable debug logging
   */
  setDebug(enabled) {
    BeaconRenderer.DEBUG_BEACONS = enabled;
    console.log(`🔔 [Beacon] Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Check if a Grow beacon is still animating (scale-down not complete)
   * Used by AnimationEngine to dynamically extend pause duration
   * @param {Object} waypoint - Waypoint object
   * @returns {boolean} True if Grow beacon is still animating
   */
  isGrowBeaconAnimating(waypoint) {
    if (!waypoint || waypoint.beaconStyle !== 'grow') return false;
    const beacon = this.beacons.get(waypoint.id);
    if (!beacon) return false;
    // Grow beacon is animating if it has started but scale-down is not complete
    return beacon.started && !beacon.scaleDownComplete;
  }
}

// Export beacon types for testing
export { RippleBeacon, GlowBeacon, PopBeacon, GrowBeacon, PulseBeacon, BaseBeacon, BeaconEasing };
