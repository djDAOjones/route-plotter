import { ANIMATION, MOTION } from '../config/constants.js';
import { AnimationState } from '../models/AnimationState.js';
import { PlayerCore } from '../core/PlayerCore.js';

/**
 * Service for managing animation playback
 * Handles timing, waypoint waits, segment speeds, and frame rate control
 * 
 * ## Timeline Architecture
 * 
 * The animation uses a timeline-based system where:
 * - `timelineProgress` (0-1): Progress through total animation time (including pauses)
 * - `pathProgress` (0-1): Progress along the physical path
 * 
 * These are NOT the same when:
 * 1. Waypoint pauses exist (timeline continues, path stays fixed)
 * 2. Segment speeds vary (non-linear time-to-distance mapping)
 * 
 * ## Segment Speed System
 * 
 * Each major-to-major leg can have a speed multiplier (0.1x to 10x); minor
 * waypoints are geometry only and never split a leg (see decision-log:
 * major-leg keyframing). This affects how timeline time maps to path progress:
 * - segmentSpeed > 1.0: Faster traversal (less time for same distance)
 * - segmentSpeed < 1.0: Slower traversal (more time for same distance)
 * 
 * The mapping is handled by `segmentMarkers` which store pre-calculated
 * timing information for each segment. Lookups use linear search which is
 * efficient for the typical 2-10 segments per path.
 */
export class AnimationEngine {
  constructor(eventBus = null) {
    this.eventBus = eventBus;
    this.state = new AnimationState();
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    this.onUpdate = null; // Callback for animation updates

    // Timeline-based waypoint pauses
    // Pauses are baked into the timeline - total duration includes pause times
    // Timeline progress continues during pauses, path progress stays fixed
    this.pauseMarkers = [];      // {pathProgress, timelineStart, timelineEnd, duration, waypointIndex}
    this.totalPauseTime = 0;     // Sum of all pause durations
    this.pathDuration = 0;       // Duration for path travel only (without pauses)
    
    // Segment speed markers for variable-speed animation
    // Each segment has timing info for non-linear time-to-path mapping
    // Structure: {startPathProgress, endPathProgress, startPathTime, endPathTime, segmentSpeed, duration}
    this.segmentMarkers = [];
    this.hasVariableSpeed = false;  // Quick check to skip segment calculations when all speeds are 1.0

    // Per-beacon clock schedules derived from the same timeline data
    // (built in setPauseMarkers; read by BeaconRenderer for closed-form phases)
    this.beaconSchedules = [];
    
    // ========== TIMELINE HANDLES ==========
    // Handle times extend the timeline at start/end for video export and beacon animations
    // Start handle: Static frame before path animation begins (EXPORT ONLY)
    // End handle: Time after path + trail complete (allows final beacon animations to finish)
    
    /** @type {number} Start handle time in ms (time before animation starts) - ONLY used during export */
    this.startHandleTimeExport = MOTION.TIMELINE_START_HANDLE_MS || 2000;
    
    /** @type {number} End handle time in ms (time after animation ends) - ONLY used during export */
    this.endHandleTimeExport = MOTION.TIMELINE_END_HANDLE_MS || 3000;
    
    /** @type {number} Active start handle time (0 for preview, full value for export) */
    this.startHandleTime = 0; // Default to 0 for preview mode
    
    /** @type {number} Active end handle time (0 for preview, full value for export) */
    this.endHandleTime = 0; // Default to 0 for preview mode
    
    /** @type {boolean} Whether we're in export mode (affects handles) */
    this.isExportMode = false;
    
    // ========== INTRO TIME ==========
    // Intro time prepends the animation timeline for AOV/Spotlight intro animations
    // During intro time, path progress stays at 0 while the cone/spotlight grows
    // This makes the intro SEQUENTIAL (before path movement) rather than PARALLEL
    
    /** @type {number} Intro animation time in ms (time before path starts moving) */
    this.introTime = 0;
    
    // ========== TAIL TIME ==========
    // Tail time extends the animation timeline after path completion
    // to allow the trail to fully fade out before animation ends
    
    /** @type {number} Trail duration in ms (how long the trail takes to fade) */
    this.tailTimeDuration = 0;
    
    /** @type {number} Handle time in ms (extra buffer after trail fades) */
    this.tailTimeHandle = 0;
    
    /** @type {number} Total tail time (duration + handle) */
    this.totalTailTime = 0;
    
    /** @type {number} Cached value to prevent redundant updates */
    this._lastTailTimeValue = 0;
    
    // ========== PAUSE STATE FOR VISIBILITY SERVICE ==========
    // Tracks current pause details so MotionVisibilityService can compute
    // time-based pre-animation for upcoming waypoints during pauses.
    // Updated each frame in timelineToPathProgress().
    
    /** @private @type {{isWaiting: boolean, waypointProgress: number, elapsed: number, total: number}} */
    this._currentPauseState = { isWaiting: false, waypointProgress: 0, elapsed: 0, total: 0 };

    // Reused render input: immutable marker arrays plus the current absolute
    // scene time let MotionVisibilityService derive comet state without history.
    this._trailVisibilityContext = {
      timelineMs: 0,
      pauseMarkers: this.pauseMarkers,
      tailStartMs: 0,
      tailEndMs: 0
    };
  }
  
  /**
   * Get the current pause state for visibility calculations.
   * Used by MotionVisibilityService to start upcoming waypoint animations
   * during the tail end of a pause (time-based pre-animation).
   * 
   * @returns {{isWaiting: boolean, waypointProgress: number, elapsed: number, total: number}}
   */
  getPauseState() {
    return this._currentPauseState;
  }

  /**
   * Return the deterministic timeline context needed to evaluate a comet tail.
   * The object is reused per frame; consumers must treat it and marker arrays as
   * read-only. Times exclude export/start handles and reveal intro, matching the
   * pause marker domain built by PlayerCore.
   * @returns {{timelineMs: number, pauseMarkers: Array, tailStartMs: number, tailEndMs: number}}
   */
  getTrailVisibilityContext() {
    const context = this._trailVisibilityContext;
    context.timelineMs = Math.max(0, this.state.currentTime - this.startHandleTime - this.introTime);
    context.pauseMarkers = this.pauseMarkers;
    context.tailStartMs = this.pathDuration + this.totalPauseTime;
    context.tailEndMs = context.tailStartMs + this.totalTailTime;
    return context;
  }
  
  /**
   * Start the animation render loop (does not start playback)
   * Call play() separately to begin animation playback
   * @param {Function} onUpdate - Callback function called on each frame
   */
  start(onUpdate) {
    if (this.animationFrameId) {
      this.stop();
    }
    
    this.onUpdate = onUpdate;
    // Don't auto-play - let user explicitly call play()
    this.lastFrameTime = 0;
    
    const loop = (timestamp) => {
      this.animationFrameId = requestAnimationFrame(loop);
      
      // Calculate time since last frame
      const elapsed = timestamp - this.lastFrameTime;
      
      // Only update at target frame rate
      if (elapsed > ANIMATION.FRAME_INTERVAL) {
        // Adjust for frame interval to prevent lag accumulation
        this.lastFrameTime = timestamp - (elapsed % ANIMATION.FRAME_INTERVAL);
        
        if (this.state.isActivelyPlaying()) {
          // Cap deltaTime to prevent huge jumps
          const deltaTime = Math.min(elapsed, ANIMATION.MAX_DELTA_TIME) * this.state.playbackSpeed;
          
          // Update animation state
          this.updateAnimation(deltaTime, timestamp);
        }
        
        // Call update callback
        if (this.onUpdate) {
          this.onUpdate(this.state);
        }
        
        // Emit update event
        this.emit('update', this.state);
      }
    };
    
    requestAnimationFrame(loop);
  }
  
  /**
   * Update animation state
   * Timeline continues during pauses - path progress is computed separately
   * Supports reverse playback (negative deltaTime from negative playbackSpeed)
   * @private
   * @param {number} deltaTime - Time since last update in milliseconds (can be negative for reverse)
   * @param {number} timestamp - Current timestamp
   */
  updateAnimation(deltaTime, timestamp) {
    // Advance animation time (can go backwards for reverse playback)
    this.state.currentTime += deltaTime;
    
    // Clamp to valid range
    if (this.state.currentTime < 0) {
      this.state.currentTime = 0;
      this.state.progress = 0;
      this.state.pathProgress = 0;
      // Don't pause at start during reverse - let user continue
      return;
    }
    
    // Check for animation end
    if (this.state.currentTime >= this.state.duration) {
      this.state.currentTime = this.state.duration;
      this.state.progress = 1;
      this.state.pathProgress = 1;
      this.pause();
      this.emit('complete');
    } else {
      // Update timeline progress (0-1 over total duration including pauses)
      this.state.progress = this.state.currentTime / this.state.duration;
      
      // Calculate path progress from timeline progress
      // Path progress stays fixed during pause periods
      this.state.pathProgress = this.timelineToPathProgress(this.state.progress);
    }
  }
  
  /**
   * Convert timeline progress to path progress
   * 
   * This is the core method for animation playback. It handles:
   * 1. Waypoint pauses (timeline continues, path stays fixed)
   * 2. Variable segment speeds (non-linear time-to-distance mapping)
   * 3. Tail time (path stays at 1.0 while trail fades out)
   * 
   * ## Algorithm
   * 1. Convert timeline progress to timeline time
   * 2. Check if we're in tail time → return 1.0
   * 3. Check if we're in a pause period → return fixed path progress
   * 4. Calculate path time by subtracting accumulated pause time
   * 5. Convert path time to path progress (using segment markers if variable speed)
   * 
   * ## Example with pauses
   * - Path duration: 10s, Pause: 2s at middle, Total: 12s
   * - Timeline 0.0-0.417 (0-5s): Path 0.0-0.5 (traveling to middle)
   * - Timeline 0.417-0.583 (5-7s): Path stays at 0.5 (pausing)
   * - Timeline 0.583-1.0 (7-12s): Path 0.5-1.0 (traveling to end)
   * 
   * ## Example with segment speeds
   * - Segment 1: 0.5x speed → takes 2x longer for same distance
   * - Segment 2: 2.0x speed → takes 0.5x time for same distance
   * - Path progress advances slower in segment 1, faster in segment 2
   * 
   * ## Example with tail time
   * - Path + pauses: 12s, Tail time: 5s, Total: 17s
   * - Timeline 0.0-0.706 (0-12s): Normal path progress
   * - Timeline 0.706-1.0 (12-17s): Path stays at 1.0 (tail time)
   * 
   * @param {number} timelineProgress - Progress through total timeline (0-1)
   * @returns {number} Progress along the path (0-1)
   */
  timelineToPathProgress(timelineProgress) {
    const result = PlayerCore.timelineToPath(
      timelineProgress * this.state.duration,
      this.getTimeline(),
      this.getLiveTiming()
    );
    this._applyWaitState(result);
    return result.pathProgress;
  }

  /**
   * The immutable timeline description PlayerCore evaluates against.
   * Assembled from the marker fields so it can never go stale; the arrays
   * themselves are only replaced by setSegmentMarkers/setPauseMarkers.
   */
  getTimeline() {
    return {
      segments: this.segmentMarkers,
      hasVariableSpeed: this.hasVariableSpeed,
      pathDuration: this.pathDuration,
      totalPauseTime: this.totalPauseTime,
      pauses: this.pauseMarkers,
    };
  }

  /**
   * Live timing context: pieces that vary with mode (export handles,
   * reveal intro, preview tail) rather than with project geometry.
   */
  getLiveTiming() {
    return {
      durationMs: this.state.duration,
      startHandleMs: this.startHandleTime,
      introMs: this.introTime,
      totalTailMs: this.totalTailTime,
      endHandleMs: this.endHandleTime,
    };
  }

  /**
   * Edge-detect wait transitions from a pure evaluation result: state flags,
   * waypointWaitStart/End events, and the pause state the visibility service
   * polls. Evaluation itself (PlayerCore) never touches state — this is the
   * one place derived wait state lands.
   * @private
   */
  _applyWaitState(result) {
    if (result.waitingIndex >= 0) {
      if (!this.state.isWaitingAtWaypoint || this.state.pauseWaypointIndex !== result.waitingIndex) {
        this.state.isWaitingAtWaypoint = true;
        this.state.pauseWaypointIndex = result.waitingIndex;
        this.emit('waypointWaitStart', {
          index: result.waitingIndex,
          duration: result.waitTotalMs,
          progress: result.waitPathProgress,
        });
      }
      this._currentPauseState.isWaiting = true;
      this._currentPauseState.waypointProgress = result.waitPathProgress;
      this._currentPauseState.elapsed = result.waitElapsedMs;
      this._currentPauseState.total = result.waitTotalMs;
    } else {
      if (this.state.isWaitingAtWaypoint) {
        const completedIndex = this.state.pauseWaypointIndex;
        this.state.isWaitingAtWaypoint = false;
        this.state.pauseWaypointIndex = -1;
        this.emit('waypointWaitEnd', completedIndex);
      }
      this._currentPauseState.isWaiting = false;
    }
  }
  
  /**
   * Pause the animation
   * Resets playback speed to 1x (JKL speeds are temporary review aids)
   */
  pause() {
    this.state.pause();
    this._resetPlaybackSpeed();
    this.emit('pause');
  }
  
  /**
   * Resume the animation
   */
  play() {
    this.state.play();
    // Debug: dump segment state on play if variable speed is active
    if (this.hasVariableSpeed) {
      console.debug(`▶️ [Play] Starting with variable speed. currentTime=${(this.state.currentTime/1000).toFixed(3)}s pathProgress=${this.state.pathProgress.toFixed(4)}`);
      this.dumpSegmentState();
    }
    this.emit('play');
  }
  
  /**
   * Toggle play/pause
   */
  togglePlayPause() {
    if (this.state.isActivelyPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Freeze timeline advancement without emitting user-facing pause events or
   * resetting review speed. Export uses this reversible boundary while it
   * steps the same engine through deterministic frame seeks.
   * @returns {{timelineProgress: number, isPlaying: boolean, isPaused: boolean, playbackSpeed: number}}
   */
  suspendTransport() {
    const snapshot = this.state.captureTransportState();
    this.state.isPaused = true;
    return snapshot;
  }

  /**
   * Restore a suspendTransport() snapshot after the caller has restored the
   * original timeline shape. Derived path and wait state are evaluated through
   * PlayerCore, while the active/paused latch and speed return byte-for-byte.
   * @param {{timelineProgress: number, isPlaying: boolean, isPaused: boolean, playbackSpeed: number}} snapshot
   */
  restoreTransportState(snapshot) {
    this.state.restoreTransportState(snapshot);
    this.state.pathProgress = this.timelineToPathProgress(this.state.progress);
    this.emit('seek', this.state.currentTime);
  }
  
  /**
   * Stop the animation completely
   * Resets playback speed to 1x (JKL speeds are temporary review aids)
   */
  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.state.stop();
    this._resetPlaybackSpeed();
    this.emit('stop');
  }
  
  /**
   * Reset animation to beginning
   * Also resets pause marker tracking so pauses trigger again on replay
   * Resets playback speed to 1x (JKL speeds are temporary review aids)
   */
  reset() {
    this.state.reset();
    this.nextPauseIndex = 0; // Reset to check all pause markers again
    this._resetPlaybackSpeed();
    this.emit('reset');
  }
  
  /**
   * Reset playback speed to 1x
   * Called on pause, stop, and reset - JKL speeds are temporary review aids
   * @private
   */
  _resetPlaybackSpeed() {
    if (this.state.playbackSpeed !== 1) {
      this.state.playbackSpeed = 1;
      this.emit('playbackSpeedChange', 1);
    }
  }
  
  /**
   * Set pause markers for waypoint waits and calculate timeline positions
   * Called when waypoints change or duration changes
   * 
   * Pause markers include timeline positions so the slider continues during pauses.
   * Total duration is automatically extended to include pause times.
   * 
   * @param {Array} waypoints - Array of waypoint objects with pauseMode and pauseTime
   * @param {number} pathDuration - Duration for path travel only (without pauses)
   * @param {Array} waypointProgressValues - Optional array of actual progress values for each waypoint
   */
  setPauseMarkers(waypoints, pathDuration = null, waypointProgressValues = null, introAnimationMs = 0) {
    // Use provided path duration or current duration
    if (pathDuration !== null) {
      this.pathDuration = pathDuration;
    }

    if (!waypoints || waypoints.length < 2 || this.pathDuration <= 0) {
      this.pauseMarkers = [];
      this.totalPauseTime = 0;
      this.beaconSchedules = [];
      console.debug('📍 [AnimationEngine] setPauseMarkers: Not enough waypoints or invalid duration');
      return;
    }

    // Pause durations, beacon minimums, and grow early-onset all come from
    // PlayerCore so the pause budget and the beacon schedules share one
    // formula — grow pauses are exact and never extended at runtime.
    const { pauses, totalPauseTime } = PlayerCore.buildPauses(
      waypoints, this.pathDuration, waypointProgressValues,
      introAnimationMs, this.segmentMarkers, this.hasVariableSpeed
    );
    this.pauseMarkers = pauses;
    this.totalPauseTime = totalPauseTime;
    this.beaconSchedules = PlayerCore.buildBeaconSchedules(
      waypoints, waypointProgressValues, pauses,
      this.segmentMarkers, this.pathDuration, this.hasVariableSpeed
    );

    // Update the total duration to include pauses
    if (this.totalPauseTime > 0) {
      this.state.duration = this.pathDuration + this.totalPauseTime;
      console.debug(`📍 [AnimationEngine] Duration extended: ${(this.pathDuration/1000).toFixed(1)}s path + ${(this.totalPauseTime/1000).toFixed(1)}s pauses = ${(this.state.duration/1000).toFixed(1)}s total`);
    }

    console.debug(`📍 [AnimationEngine] Set ${this.pauseMarkers.length} pause markers:`,
      this.pauseMarkers.map(m => `wp${m.waypointIndex}@path${(m.pathProgress*100).toFixed(0)}%/${m.timelineStartMs.toFixed(0)}-${m.timelineEndMs.toFixed(0)}ms=${m.duration}ms`).join(', ') || 'none');
  }
  
  /**
   * Clear all pause markers and reset pause time tracking
   */
  clearPauseMarkers() {
    this.pauseMarkers = [];
    this.totalPauseTime = 0;
    this.beaconSchedules = [];
  }

  /**
   * Clear segment markers and reset variable speed flag
   */
  clearSegmentMarkers() {
    this.segmentMarkers = [];
    this.hasVariableSpeed = false;
  }
  
  /**
   * Dump full segment speed state to console for diagnostics.
   * Call this after setSegmentMarkers or on speed change to get a
   * complete picture of the timing structure.
   */
  dumpSegmentState() {
    const lines = [`📊 [SegSpeed] === SEGMENT STATE DUMP ===`];
    lines.push(`  hasVariableSpeed: ${this.hasVariableSpeed}`);
    lines.push(`  pathDuration: ${(this.pathDuration/1000).toFixed(3)}s`);
    lines.push(`  totalPauseTime: ${(this.totalPauseTime/1000).toFixed(3)}s`);
    lines.push(`  totalDuration: ${(this.state.duration/1000).toFixed(3)}s`);
    lines.push(`  currentTime: ${(this.state.currentTime/1000).toFixed(3)}s`);
    lines.push(`  progress: ${this.state.progress.toFixed(4)}`);
    lines.push(`  pathProgress: ${this.state.pathProgress.toFixed(4)}`);
    lines.push(`  segments (${this.segmentMarkers.length}):`);
    for (let i = 0; i < this.segmentMarkers.length; i++) {
      const m = this.segmentMarkers[i];
      lines.push(`    seg${i}: path[${m.startPathProgress.toFixed(4)}..${m.endPathProgress.toFixed(4)}] time[${(m.startPathTime/1000).toFixed(3)}s..${(m.endPathTime/1000).toFixed(3)}s] dur=${(m.duration/1000).toFixed(3)}s speed=${m.segmentSpeed}x wp=${m.waypointIndex}`);
    }
    // Verify consistency: last segment endPathTime should equal pathDuration
    if (this.segmentMarkers.length > 0) {
      const last = this.segmentMarkers[this.segmentMarkers.length - 1];
      const drift = Math.abs(last.endPathTime - this.pathDuration);
      if (drift > 1) {
        lines.push(`  ⚠️  DRIFT: last seg endPathTime=${(last.endPathTime/1000).toFixed(3)}s vs pathDuration=${(this.pathDuration/1000).toFixed(3)}s (diff=${drift.toFixed(1)}ms)`);
      }
    }
    console.debug(lines.join('\n'));
  }
  
  /**
   * Set tail time for trail fade-out after path completion
   * 
   * Tail time extends the animation timeline to allow the trail to fully
   * fade out before the animation ends. This prevents abrupt cutoff.
   * 
   * ## Timeline Structure with Tail Time
   * ```
   * |--- Path Duration ---|--- Pause Time ---|--- Tail Time ---|
   *                                          ^                  ^
   *                                     pathProgress=1     animation ends
   * ```
   * 
   * During tail time:
   * - pathProgress stays at 1.0 (head at end of path)
   * - Trail continues to shrink using pause logic
   * - pauseElapsed = time since path reached end
   * 
   * @param {number} trailDurationMs - Trail duration in milliseconds
   * @param {number} handleMs - Extra buffer time after trail fades (default 2000ms)
   */
  setTailTime(trailDurationMs, handleMs = 2000) {
    const newTotalTailTime = trailDurationMs + handleMs;
    
    // Only update if value changed (prevents redundant logging)
    if (newTotalTailTime === this._lastTailTimeValue) {
      return;
    }
    
    this.tailTimeDuration = trailDurationMs;
    this.tailTimeHandle = handleMs;
    this.totalTailTime = newTotalTailTime;
    this._lastTailTimeValue = newTotalTailTime;
    
    console.debug(`⏱️ [AnimationEngine] Tail time set: ${(trailDurationMs/1000).toFixed(1)}s trail + ${(handleMs/1000).toFixed(1)}s handle = ${(newTotalTailTime/1000).toFixed(1)}s total`);
  }
  
  /**
   * Clear tail time (for edit mode or when trail is disabled)
   */
  clearTailTime() {
    if (this.totalTailTime === 0) return;
    
    this.tailTimeDuration = 0;
    this.tailTimeHandle = 0;
    this.totalTailTime = 0;
    this._lastTailTimeValue = 0;
    
    console.debug('⏱️ [AnimationEngine] Tail time cleared');
  }
  
  /**
   * Set intro time for sequential AOV/Spotlight intro animation
   * During intro time, the cone/spotlight grows while path stays at 0
   * 
   * @param {number} introTimeMs - Intro animation duration in milliseconds
   */
  setIntroTime(introTimeMs) {
    if (introTimeMs === this.introTime) return;
    
    this.introTime = introTimeMs;
    console.debug(`⏱️ [AnimationEngine] Intro time set: ${(introTimeMs/1000).toFixed(1)}s`);
  }
  
  /**
   * Clear intro time (for edit mode or when AOV/Spotlight is disabled)
   */
  clearIntroTime() {
    if (this.introTime === 0) return;
    
    this.introTime = 0;
    console.debug('⏱️ [AnimationEngine] Intro time cleared');
  }
  
  /**
   * Check if animation is currently in intro time
   * @returns {boolean} True if in intro time (cone/spotlight growing, path at 0)
   */
  isInIntroTime() {
    if (this.introTime <= 0) return false;
    const adjustedTime = this.state.currentTime - this.startHandleTime;
    return adjustedTime >= 0 && adjustedTime < this.introTime;
  }
  
  /**
   * Get the intro animation progress (0-1) for scaling the cone/spotlight
   * @returns {number} Progress through intro animation (0 at start, 1 when complete)
   */
  getIntroProgress() {
    if (this.introTime <= 0) return 1;
    const adjustedTime = this.state.currentTime - this.startHandleTime;
    if (adjustedTime <= 0) return 0;
    if (adjustedTime >= this.introTime) return 1;
    return adjustedTime / this.introTime;
  }
  
  /**
   * Check if animation is currently in start handle time
   * @returns {boolean} True if in start handle (before animation begins)
   */
  isInStartHandle() {
    if (this.startHandleTime <= 0) return false;
    return this.state.currentTime < this.startHandleTime;
  }
  
  /**
   * Check if animation is currently in tail time
   * @returns {boolean} True if in tail time (path complete, trail fading)
   */
  isInTailTime() {
    if (this.totalTailTime <= 0) return false;
    
    // Calculate when tail time starts (after handles, intro, path and pauses)
    const tailTimeStart = this.startHandleTime + this.introTime + this.pathDuration + this.totalPauseTime;
    const currentTime = this.state.currentTime;
    const tailTimeEnd = tailTimeStart + this.totalTailTime;
    
    return currentTime >= tailTimeStart && currentTime < tailTimeEnd;
  }
  
  /**
   * Check if animation is currently in end handle time
   * @returns {boolean} True if in end handle (after tail time, static end frame)
   */
  isInEndHandle() {
    if (this.endHandleTime <= 0) return false;
    
    // End handle starts after start handle + intro + path + pauses + tail time
    const endHandleStart = this.startHandleTime + this.introTime + this.pathDuration +
      this.totalPauseTime + this.totalTailTime;
    return this.state.currentTime >= endHandleStart;
  }
  
  /**
   * Get elapsed time within tail time period
   * @returns {number} Milliseconds elapsed since tail time started (0 if not in tail time)
   */
  getTailTimeElapsed() {
    if (!this.isInTailTime()) return 0;
    
    const tailTimeStart = this.startHandleTime + this.introTime + this.pathDuration + this.totalPauseTime;
    return Math.max(0, this.state.currentTime - tailTimeStart);
  }
  
  /**
   * Get the total timeline duration including all handles
   * @returns {number} Total duration in ms
   */
  getTotalTimelineDuration() {
    return this.startHandleTime + this.introTime + this.pathDuration + this.totalPauseTime +
      this.totalTailTime + this.endHandleTime;
  }
  
  /**
   * Set export mode - enables start/end handles for video export
   * In preview mode (default), handles are 0 for immediate playback
   * In export mode, handles provide padding at the beginning and end
   * @param {boolean} enabled - Whether export mode is enabled
   */
  setExportMode(enabled) {
    this.isExportMode = enabled;
    this.startHandleTime = enabled ? this.startHandleTimeExport : 0;
    this.endHandleTime = enabled ? this.endHandleTimeExport : 0;
    console.debug(`🎬 [AnimationEngine] Export mode: ${enabled ? 'ON' : 'OFF'}, startHandle: ${this.startHandleTime}ms, endHandle: ${this.endHandleTime}ms`);
  }
  
  /**
   * Set up segment markers for variable-speed animation
   * 
   * This method calculates timing information for each segment between waypoints,
   * enabling non-linear time-to-path mapping during playback.
   * 
   * ## Segment Marker Structure
   * Each marker contains:
   * - `startPathProgress` / `endPathProgress`: Path progress bounds (0-1)
   * - `startPathTime` / `endPathTime`: Cumulative path time at segment bounds (ms)
   * - `segmentSpeed`: Speed multiplier for this segment
   * - `duration`: Time to traverse this segment (ms)
   * - `waypointIndex`: Index of the starting waypoint
   * 
   * ## Time-to-Path Conversion
   * During playback, we use these markers to convert path time to path progress:
   * 1. Find which segment contains the current path time (binary search)
   * 2. Interpolate within that segment to get exact path progress
   * 
   * @param {Array} segmentLengths - Length of each segment in pixels
   * @param {Array} waypointProgressValues - Path progress (0-1) for each waypoint
   * @param {Array} waypoints - Waypoints with segmentSpeed property
   * @param {number} baseSpeed - Base animation speed in pixels/second
   * @returns {number} Total path duration in milliseconds
   */
  setSegmentMarkers(segmentLengths, waypointProgressValues, waypoints, baseSpeed) {
    const { segments, hasVariableSpeed, pathDuration } = PlayerCore.buildSegments(
      segmentLengths, waypointProgressValues, waypoints, baseSpeed
    );
    this.segmentMarkers = segments;
    this.hasVariableSpeed = hasVariableSpeed;

    // Always log segment info for debugging (useful even when all 1.0x)
    console.debug(`🏃 [SegSpeed] setSegmentMarkers: ${this.segmentMarkers.length} segs, baseSpeed=${baseSpeed}px/s, hasVariable=${this.hasVariableSpeed}, totalDuration=${(pathDuration/1000).toFixed(3)}s`);
    for (const m of this.segmentMarkers) {
      console.debug(`  seg${m.waypointIndex}: path[${(m.startPathProgress*100).toFixed(1)}%-${(m.endPathProgress*100).toFixed(1)}%] time[${(m.startPathTime/1000).toFixed(3)}s-${(m.endPathTime/1000).toFixed(3)}s] len=${segmentLengths[m.waypointIndex]?.toFixed(0)}px dur=${(m.duration/1000).toFixed(3)}s @${m.segmentSpeed}x`);
    }

    return pathDuration;
  }
  
  /**
   * Calculate total path duration accounting for per-segment speed multipliers
   * 
   * @param {Array} segmentLengths - Length of each segment in pixels (from PathCalculator)
   * @param {Array} waypoints - Waypoints with segmentSpeed property
   * @param {number} baseSpeed - Base animation speed in pixels/second
   * @returns {number} Total path duration in milliseconds
   * @deprecated Use setSegmentMarkers() instead - this method doesn't set up timing markers
   */
  calculateDurationWithSegmentSpeeds(segmentLengths, waypoints, baseSpeed) {
    if (!segmentLengths || segmentLengths.length === 0 || !waypoints || waypoints.length < 2) {
      return 0;
    }
    
    let totalDuration = 0;
    
    for (let i = 0; i < segmentLengths.length; i++) {
      const segmentLength = segmentLengths[i];
      const segmentSpeed = waypoints[i]?.segmentSpeed || 1.0;
      
      // Duration = length / (baseSpeed * segmentSpeed)
      const segmentDuration = (segmentLength / (baseSpeed * segmentSpeed)) * 1000;
      totalDuration += segmentDuration;
    }
    
    return totalDuration;
  }
  
  /**
   * Convert path time (ms) to path progress (0-1) using segment markers
   * 
   * This handles the non-linear mapping when segments have different speeds.
   * Uses linear search through segments (typically 2-10 segments, so O(n) is efficient).
   * 
   * @param {number} pathTime - Time in milliseconds (excluding pauses)
   * @returns {number} Path progress (0-1)
   */
  pathTimeToPathProgress(pathTime) {
    return PlayerCore.pathTimeToProgress(
      pathTime, this.segmentMarkers, this.pathDuration, this.hasVariableSpeed
    );
  }
  
  /**
   * Convert path progress (0-1) to path time (ms) using segment markers
   * 
   * Inverse of pathTimeToPathProgress.
   * 
   * @param {number} pathProgress - Path progress (0-1)
   * @returns {number} Path time in milliseconds (excluding pauses)
   */
  pathProgressToPathTime(pathProgress) {
    return PlayerCore.pathProgressToTime(
      pathProgress, this.segmentMarkers, this.pathDuration, this.hasVariableSpeed
    );
  }
  
  /**
   * Seek to specific time
   * @param {number} time - Time in milliseconds
   */
  seekToTime(time) {
    this.state.setTime(time);
    this.state.pathProgress = this.timelineToPathProgress(this.state.progress);
    this.emit('seek', this.state.currentTime);
  }
  
  /**
   * Seek to specific timeline progress
   * @param {number} progress - Progress from 0 to 1
   */
  seekToProgress(progress) {
    this.state.setProgress(progress);
    // Also update pathProgress
    this.state.pathProgress = this.timelineToPathProgress(progress);
    this.emit('seek', progress * this.state.duration);
  }
  
  /**
   * Seek to specific path progress (position along the path)
   * Calculates the corresponding timeline progress accounting for pauses
   * @param {number} pathProgress - Path progress from 0 to 1
   */
  seekToPathProgress(pathProgress) {
    // Convert path progress to timeline progress
    const timelineProgress = this.pathToTimelineProgress(pathProgress);
    this.state.setProgress(timelineProgress);
    this.state.pathProgress = pathProgress;
    this.emit('seek', timelineProgress * this.state.duration);
  }
  
  /**
   * Convert path progress to timeline progress
   * 
   * Inverse of timelineToPathProgress. Handles:
   * 1. Variable segment speeds (non-linear path-to-time mapping)
   * 2. Waypoint pauses (adds accumulated pause time)
   * 
   * @param {number} pathProgress - Progress along the path (0-1)
   * @returns {number} Timeline progress (0-1)
   */
  pathToTimelineProgress(pathProgress) {
    return PlayerCore.pathToTimelineProgress(
      pathProgress, this.getTimeline(), this.getLiveTiming()
    );
  }
  
  /**
   * Set animation duration
   * @param {number} duration - Duration in milliseconds
   */
  setDuration(duration) {
    const currentProgress = this.state.progress;
    console.debug('⏱️  [AnimationEngine.setDuration()] duration:', duration, 'ms (', (duration/1000).toFixed(1), 's), progress:', currentProgress);
    this.state.duration = duration;
    this.state.setProgress(currentProgress); // Maintain progress
    this.emit('durationChange', duration);
  }
  
  /**
   * Set animation speed in pixels per second (for constant-speed mode)
   * Rounds to nearest step value (5) to match slider constraints
   * @param {number} speed - Speed in pixels per second
   */
  setSpeed(speed) {
    // Round to nearest step value (5) to match slider
    // Ensure minimum speed of 1 to prevent division by zero (Infinity duration)
    const step = 5;
    const roundedSpeed = Math.max(1, Math.round(speed / step) * step);
    console.debug('🏃 [AnimationEngine.setSpeed()] speed:', roundedSpeed, 'px/s (was:', this.state.speed, ', raw:', speed, ')');
    this.state.speed = roundedSpeed;
    this.emit('speedChange', roundedSpeed);
  }
  
  /**
   * Set playback speed multiplier
   * Supports negative values for reverse playback (JKL controls)
   * @param {number} speed - Playback speed (-16 to 16, negative = reverse)
   */
  setPlaybackSpeed(speed) {
    // Clamp to -16 to 16 range, but not to 0
    const absSpeed = Math.max(0.1, Math.min(16, Math.abs(speed)));
    this.state.playbackSpeed = speed < 0 ? -absSpeed : absSpeed;
    this.emit('playbackSpeedChange', this.state.playbackSpeed);
  }
  
  /**
   * Set animation mode
   * @param {string} mode - 'constant-speed' or 'constant-time'
   */
  setMode(mode) {
    this.state.setMode(mode);
    this.emit('modeChange', mode);
  }
  
  /**
   * Start waiting at a waypoint
   * @param {number} waypointIndex - Index of the waypoint
   * @param {number} waitDuration - Duration to wait in milliseconds
   */
  startWaypointWait(waypointIndex, waitDuration) {
    const progressSnapshot = this.state.progress;
    this.state.startWaypointWait(waypointIndex, waitDuration, progressSnapshot);
    this.emit('waypointWaitStart', { index: waypointIndex, duration: waitDuration });
  }
  
  /**
   * Check if animation is playing
   * @returns {boolean}
   */
  isPlaying() {
    return this.state.isActivelyPlaying();
  }
  
  /**
   * Check if animation is complete
   * @returns {boolean}
   */
  isComplete() {
    return this.state.progress >= 1;
  }
  
  /**
   * Get current state
   * @returns {AnimationState}
   */
  getState() {
    return this.state;
  }
  
  /**
   * Get current timeline progress (includes pause time)
   * Use this for timeline slider position
   * @returns {number} Progress from 0 to 1
   */
  getProgress() {
    return this.state.progress;
  }
  
  /**
   * Get current path progress (position along the path)
   * Use this for rendering the path head and determining position
   * Path progress stays fixed during pauses while timeline continues
   * @returns {number} Progress from 0 to 1
   */
  getPathProgress() {
    // If pathProgress is set, use it; otherwise fall back to timeline progress
    return this.state.pathProgress !== undefined ? this.state.pathProgress : this.state.progress;
  }
  
  /**
   * Get current time
   * @returns {number} Time in milliseconds
   */
  getTime() {
    return this.state.currentTime;
  }
  
  /**
   * Calculate duration based on path length and speed
   * @param {number} pathLength - Total path length in pixels
   * @returns {number} Duration in milliseconds
   */
  calculateDurationFromSpeed(pathLength) {
    if (this.state.mode === 'constant-speed' && this.state.speed > 0) {
      return (pathLength / this.state.speed) * 1000;
    }
    return this.state.duration;
  }
  
  /**
   * Emit event through event bus
   * @private
   */
  emit(eventName, data) {
    if (this.eventBus) {
      this.eventBus.emit(`animation:${eventName}`, data);
    }
  }
  
  /**
   * Destroy the animation engine
   */
  destroy() {
    this.stop();
    this.onUpdate = null;
    this.waypointCheckCallback = null;
    this.eventBus = null;
  }
}
