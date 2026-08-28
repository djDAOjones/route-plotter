/**
 * MotionVisibilityService - Computes visibility states for path, waypoints, and background
 * 
 * This service handles all motion-related visibility calculations for preview mode and export.
 * In edit mode, everything is always visible. In preview/export mode, visibility is computed
 * based on the current animation progress and motion settings.
 * 
 * ## Architecture
 * 
 * Trail and waypoint visibility are pure functions of their inputs. Reveal masks reuse an
 * off-screen canvas, but rebuild its pixels for each requested timeline instant.
 * 
 * ## Performance Considerations
 * 
 * - Fast paths for static visibility modes (no calculations)
 * - No allocations during animation (reuses cached values)
 * - Debug logging is throttled to significant changes only
 * 
 * ## Key Concepts
 * 
 * ### Path Visibility Modes
 * - ALWAYS_SHOW: Full path visible at all times
 * - SHOW_ON_PROGRESSION: Path revealed from start to head (drawing effect)
 * - HIDE_ON_PROGRESSION: Path visible ahead of head, hidden behind (erasing effect, no trail)
 * - INSTANTANEOUS: Only trail segment visible (comet effect with fade)
 * - ALWAYS_HIDE: Path never visible, only head marker
 * 
 * ### Path Trail (Fraction-Based)
 * - Measured as fraction of path duration (0-4.0, displayed as 0-100%)
 * - Trail = 0 means OFF (trail disabled entirely)
 * - Trail continues to shrink during waypoint pauses (time-based, not progress-based)
 * - Uses ^5 power curve for UI slider (more control in lower range)
 * 
 * ### Waypoint Visibility Modes
 * - ALWAYS_SHOW: All waypoints visible at all times (no animation)
 * - HIDE_BEFORE: Hidden until path reaches, then scale 0→1 animation
 * - HIDE_AFTER: Visible until path leaves, then scale 1→0 animation
 * - HIDE_BEFORE_AND_AFTER: Scale in on approach, scale out on departure
 * - ALWAYS_HIDE: Never visible
 * 
 * ### Waypoint Animation
 * - Target duration: ~0.25s (fast, snappy animations)
 * - Clamped to 1-8% of path progress for consistent feel
 * - Uses easeOutBack for appear (slight overshoot available)
 * - Uses easeInBack for disappear
 * - Scale parameters exposed via WAYPOINT_ANIM static object
 * - Minor waypoints: always hidden in export, always visible in edit
 * 
 * ### Close Waypoint Handling
 * - animInStart clamped to prevWaypointProgress (can't animate before prev waypoint)
 * - Deficit-gated: pre-animation only when travel time < target animation duration
 * - During prev waypoint's pause: time-based pre-animation covers the deficit portion
 * - After pause: progress-based animation offset by preAnimFraction for seamless blend
 * - Animation window shrinks to fit available space (speeds up if needed)
 * - Prevents animation freeze/overlap when waypoints are close together
 * 
 * ### Background Reveal
 * - Circular mask centered on path head
 * - Accumulates over time (revealed areas stay revealed)
 * - Size and feather are % of canvas average dimension
 * 
 * @example
 * const motionService = new MotionVisibilityService();
 * const pathRange = motionService.getPathVisibleRange(0.5, settings, 10000);
 * const wpState = motionService.getWaypointVisibility(waypoint, 0.3, 0.5, settings, 10000);
 */

import { MOTION, PATH_VISIBILITY, WAYPOINT_VISIBILITY } from '../config/constants.js';

export class MotionVisibilityService {
  constructor() {
    // Reveal mask canvas for background accumulation
    this.revealMaskCanvas = null;
    this.revealMaskCtx = null;
    this.lastCanvasSize = { width: 0, height: 0 };
    
    // ========== AOV REVEAL STATE MANAGEMENT ==========
    /** @type {number} Last progress value for AOV reveal mask (for scrub detection) */
    this._lastAOVProgress = 0;
    
    /** @type {number} Last path point index drawn for incremental rendering */
    this._lastAOVPointIndex = -1;
    
    /** @type {Object|null} Last cone drawn for smooth corner interpolation */
    this._lastAOVCone = null;
  }
  
  /**
   * Compatibility reset used by playback reset callers. Comet trails are now
   * stateless; only reveal traversal caches need clearing.
   */
  resetTrailState() {
    this._lastAOVProgress = 0;
    this._lastAOVPointIndex = -1;
    this._lastAOVCone = null;
  }

  // ========== PATH VISIBILITY ==========

  /**
   * Calculate the visible range of the path based on current progress and settings.
   * 
   * Trail length is calculated using pathDuration (excluding pauses) to ensure
   * consistent trail length regardless of waypoint pauses. The result depends
   * only on the requested instant, so direct seeks and sequential playback agree.
   * 
   * @param {number} pathProgress - Current path progress (0-1), pauses during waypoint waits
   * @param {Object} settings - Motion settings with pathVisibility and pathTrail
   * @param {number} pathDuration - Path duration in ms (excludes pauses)
   * @param {boolean} [isWaiting=false] - Whether currently paused at a waypoint
   * @param {number} [pauseElapsed=0] - Time elapsed in current pause (ms)
   * @param {boolean} [isInTailTime=false] - Whether in tail time (path complete, trail fading)
   * @param {Object|null} [trailContext=null] - Absolute timeline context from AnimationEngine
   * @returns {{startProgress: number, endProgress: number, fadeStartProgress: number}}
   */
  getPathVisibleRange(
    pathProgress,
    settings,
    pathDuration,
    isWaiting = false,
    pauseElapsed = 0,
    isInTailTime = false,
    trailContext = null
  ) {
    const { pathVisibility, pathTrail } = settings;

    // Fast paths for static visibility modes (no calculations needed)
    if (pathVisibility === PATH_VISIBILITY.ALWAYS_SHOW) {
      return { startProgress: 0, endProgress: 1, fadeStartProgress: 0 };
    }
    if (pathVisibility === PATH_VISIBILITY.ALWAYS_HIDE) {
      return { startProgress: 0, endProgress: 0, fadeStartProgress: 0 };
    }
    if (pathVisibility === PATH_VISIBILITY.SHOW_ON_PROGRESSION) {
      // Path revealed from start to head (drawing effect)
      return { startProgress: 0, endProgress: pathProgress, fadeStartProgress: 0 };
    }
    if (pathVisibility === PATH_VISIBILITY.HIDE_ON_PROGRESSION) {
      // Path visible ahead of head, hidden behind (erasing effect)
      // No trail/fade - instant cutoff at head position
      return { startProgress: pathProgress, endProgress: 1, fadeStartProgress: pathProgress };
    }

    // Calculate trail fade start position from this timeline instant only
    // Only used for INSTANTANEOUS mode (comet effect with trail)
    const fadeStart = this._calculateTrailFadeStart(
      pathProgress, pathTrail, pathDuration, isWaiting, pauseElapsed, isInTailTime, trailContext
    );

    // Instantaneous: only trail segment visible (comet effect)
    if (pathVisibility === PATH_VISIBILITY.INSTANTANEOUS) {
      return { startProgress: fadeStart, endProgress: pathProgress, fadeStartProgress: fadeStart };
    }

    // Fallback to show on progression
    return { startProgress: 0, endProgress: pathProgress, fadeStartProgress: 0 };
  }

  /**
   * Calculate a comet tail from the requested timeline instant.
   *
   * The base tail keeps the established 80% early-progress cap. During a
   * waypoint wait or final tail period it moves linearly toward the head over
   * the authored trail duration. No prior render is consulted, which is the
   * deterministic-timeline requirement for play, scrub and export parity.
   * 
   * @param {number} pathProgress - Current path progress (0-1)
   * @param {number} pathTrail - Trail as fraction of sequence (0=off, 0.04-4.0)
   * @param {number} pathDuration - Path duration in ms (excludes pauses)
   * @param {boolean} isWaiting - Whether paused at a waypoint
   * @param {number} pauseElapsed - Time elapsed in current pause (ms)
   * @param {boolean} isInTailTime - Whether in tail time (path complete)
   * @param {Object|null} trailContext - Absolute timeline context from AnimationEngine
   * @returns {number} Fade start position (0-1), clamped to [0, pathProgress]
   * @private
   */
  _calculateTrailFadeStart(
    pathProgress,
    pathTrail,
    pathDuration,
    isWaiting,
    pauseElapsed,
    isInTailTime,
    trailContext
  ) {
    if (pathTrail <= 0 || pathDuration <= 0) return pathProgress;
    const head = Math.max(0, Math.min(1, pathProgress));
    const baseTail = this._calculateBaseTrailTail(head, pathTrail);
    const trailDurationMs = pathTrail * pathDuration;

    if (trailContext) {
      const timelineMs = Math.max(0, trailContext.timelineMs || 0);
      let heldTail = 0;

      // Each completed pause leaves a deterministic held tail. Between pauses,
      // the normal base tail catches up with it; the maximum recreates the old
      // no-snap transition without consulting a previously rendered frame.
      for (const marker of trailContext.pauseMarkers || []) {
        if (timelineMs < marker.timelineStartMs) break;
        const pauseHead = Math.max(0, Math.min(1, marker.pathProgress));
        const pauseStartTail = Math.max(heldTail, this._calculateBaseTrailTail(pauseHead, pathTrail));
        const pauseElapsedMs = Math.min(marker.duration, Math.max(0, timelineMs - marker.timelineStartMs));
        const fadeRatio = Math.min(1, pauseElapsedMs / trailDurationMs);
        const pauseTail = pauseStartTail + (pauseHead - pauseStartTail) * fadeRatio;

        if (timelineMs < marker.timelineEndMs) return pauseTail;
        heldTail = pauseTail;
      }

      const currentTail = Math.max(heldTail, baseTail);
      const hasTailPeriod = trailContext.tailEndMs > trailContext.tailStartMs;
      if (hasTailPeriod && timelineMs >= trailContext.tailStartMs) {
        const tailElapsedMs = Math.max(0, timelineMs - trailContext.tailStartMs);
        const fadeRatio = Math.min(1, tailElapsedMs / trailDurationMs);
        return currentTail + (head - currentTail) * fadeRatio;
      }

      return currentTail;
    }

    if (!isWaiting && !isInTailTime) return baseTail;

    const elapsedMs = Number.isFinite(pauseElapsed) ? Math.max(0, pauseElapsed) : 0;
    const fadeRatio = Math.min(1, elapsedMs / trailDurationMs);
    return baseTail + (head - baseTail) * fadeRatio;
  }

  /** @private */
  _calculateBaseTrailTail(pathProgress, pathTrail) {
    const trailFraction = Math.min(pathTrail, pathProgress * 0.8);
    return Math.max(0, pathProgress - trailFraction);
  }

  /**
   * Calculate opacity for a point on the path based on trail fade
   * 
   * @param {number} pointProgress - Progress position of the point (0-1)
   * @param {number} fadeStartProgress - Where fade begins
   * @param {number} endProgress - Where visible path ends
   * @param {number} trailProgress - Trail duration as progress fraction
   * @returns {number} Opacity (0-1)
   */
  getPathPointOpacity(pointProgress, fadeStartProgress, endProgress, trailProgress) {
    // If no trail, it's either fully visible or not
    if (trailProgress <= 0) {
      return (pointProgress >= fadeStartProgress && pointProgress <= endProgress) ? 1 : 0;
    }

    // Point is before fade start - not visible
    if (pointProgress < fadeStartProgress) {
      return 0;
    }

    // Point is after end - not visible
    if (pointProgress > endProgress) {
      return 0;
    }

    // Calculate fade based on distance from fade start
    const fadeRange = endProgress - fadeStartProgress;
    if (fadeRange <= 0) return 1;

    const distanceFromEnd = endProgress - pointProgress;
    const fadePosition = distanceFromEnd / fadeRange;
    
    // Fade from 0 (at fadeStart) to 1 (at endProgress)
    return Math.min(1, Math.max(0, fadePosition));
  }

  // ========== WAYPOINT VISIBILITY ==========
  
  /**
   * Waypoint animation parameters.
   * Exposed for potential customization (e.g., pop effects with overshoot).
   * 
   * ## Easing Functions
   * - **Appear**: easeOutBack (cubic ease-out with optional overshoot)
   * - **Disappear**: easeInBack (cubic ease-in with optional overshoot)
   * - Easing provides smooth acceleration/deceleration for natural feel
   * 
   * ## Close Waypoint Handling
   * When waypoints are close together, animations are constrained:
   * - animInStart clamped to prevWaypointProgress (can't start before prev waypoint)
   * - Time-based pre-animation during prev waypoint's pause (smooth appear)
   * - Progress-based phase offsets by preAnimFraction for seamless blend
   * - Animation window shrinks to fit available space (speeds up animation)
   * - Minimum animation window ensures animation is still visible
   */
  static WAYPOINT_ANIM = {
    /** Target animation duration in seconds */
    TARGET_DURATION_S: 0.25,
    /** Minimum animation duration as path progress fraction */
    MIN_PROGRESS: 0.01,
    /** Maximum animation duration as path progress fraction */
    MAX_PROGRESS: 0.08,
    /** Scale at full visibility */
    SCALE_MAX: 1.0,
    /** Scale when hidden */
    SCALE_MIN: 0.0,
    /** Overshoot for pop effect (1.0 = cubic ease, >1.0 = back ease with overshoot) */
    SCALE_OVERSHOOT: 1.0
  };

  /**
   * AOV (Angle of View) direction calculation parameters.
   * 
   * These control how the AOV cone direction is calculated to ensure smooth
   * turns and prevent premature direction changes at waypoints.
   * 
   * @property {number} SMOOTHING_LOOKBACK - Number of path points to look back for direction smoothing.
   *   Higher values = smoother turns but more "delayed" feeling. Lower = more responsive but jerkier.
   * @property {number} APPROACH_THRESHOLD - Path progress threshold for waypoint approach detection.
   *   When within this distance of a waypoint, use waypoint-to-waypoint direction instead of
   *   spline-interpolated direction. This prevents premature turning from Catmull-Rom curves.
   */
  static AOV_DIRECTION = {
    /** 
     * Number of path points to look back for direction smoothing.
     * Higher = smoother turns but more "delayed" feeling.
     * Lower = more responsive but jerkier.
     * Recommended range: 8-50. Default: 25 for smooth turns.
     */
    SMOOTHING_LOOKBACK: 25,
    /** Path progress threshold for waypoint approach detection (default: 0.02 = 2%) */
    APPROACH_THRESHOLD: 0.02,
    /** 
     * Path progress threshold for post-waypoint transition zone.
     * After leaving a waypoint, blend from waypoint direction to path direction
     * over this distance. Prevents instant 90°+ turns after pause ends.
     * Default: 0.04 = 4% of path progress.
     */
    DEPARTURE_THRESHOLD: 0.04
  };
  
  /**
   * Intro animation settings for Spotlight and AOV reveal modes.
   * The reveal effect scales from 0 to full size over this duration.
   */
  static INTRO_ANIMATION = {
    /** Duration of intro animation in milliseconds */
    DURATION_MS: 1000,
    /** Easing function: 'ease-out' for natural deceleration */
    EASING: 'ease-out'
  };

  /**
   * Calculate waypoint visibility state including scale for animation.
   * 
   * ## Animation Phases (for modes that animate)
   * 
   * 1. **Before** (t < animInStart): Hidden or visible based on mode
   * 2. **Pre-Animate In** (during previous waypoint's pause): Time-based scale 0 → partial
   * 3. **Animate In** (animInStart → waypointProgress): Scale partial → 1 (progress-based)
   * 4. **At Waypoint** (waypointProgress): Fully visible, scale 1
   * 5. **Animate Out** (waypointProgress → animOutEnd): Scale 1 → 0
   * 6. **After** (t > animOutEnd): Hidden or visible based on mode
   * 
   * ## Close Waypoint Handling
   * 
   * When waypoints are close together, the "next" waypoint's animation could
   * previously begin before (or freeze during) the "previous" waypoint's pause.
   * 
   * ### Clamp Fix
   * `animInStart` is clamped to never precede `prevWaypointProgress`. Since
   * pathProgress freezes during pauses, this guarantees the next waypoint
   * cannot start animating until after the previous waypoint's pause ends.
   * 
   * ### Time-Based Pre-Animation
   * During the tail end of the previous waypoint's pause, this waypoint can
   * begin a time-based animation (driven by pause elapsed, not path progress).
   * This gives close waypoints a smooth appear animation even when the
   * travel time between them is very short.
   * 
   * After the pause ends, the progress-based animation picks up from where
   * the time-based phase left off, using `preAnimFraction` to offset the
   * animation curve. The two phases blend seamlessly because `combinedT`
   * starts at `preAnimFraction` exactly when progress-based begins.
   * 
   * ## Performance
   * - O(1) time complexity
   * - No allocations (returns object literals)
   * 
   * @param {Object} waypoint - Waypoint object (pauseTime not used here, handled by engine)
   * @param {number} waypointPathProgress - Path progress when head reaches this waypoint (0-1)
   * @param {number} currentPathProgress - Current path progress (0-1)
   * @param {Object} settings - Motion settings with waypointVisibility
   * @param {number} pathDuration - Path duration in ms (excludes pauses)
   * @param {number} [prevWaypointProgress=-1] - Previous waypoint's progress (-1 if none/first)
   * @param {number} [nextWaypointProgress=2] - Next waypoint's progress (2 if none/last)
   * @param {Object|null} [pauseState=null] - Current pause state from AnimationEngine.getPauseState()
   * @param {number} [prevWaypointPauseMs=0] - Previous waypoint's authored pause duration in ms
   * @returns {{visible: boolean, scale: number, opacity: number, phase: string}}
   */
  getWaypointVisibility(waypoint, waypointPathProgress, currentPathProgress, settings, pathDuration,
                        prevWaypointProgress = -1, nextWaypointProgress = 2,
                        pauseState = null, prevWaypointPauseMs = 0) {
    const { waypointVisibility } = settings;
    const ANIM = MotionVisibilityService.WAYPOINT_ANIM;
    
    // Fast paths for static modes
    if (waypointVisibility === WAYPOINT_VISIBILITY.ALWAYS_SHOW) {
      return { visible: true, scale: ANIM.SCALE_MAX, opacity: 1, phase: 'always-show' };
    }
    if (waypointVisibility === WAYPOINT_VISIBILITY.ALWAYS_HIDE) {
      return { visible: false, scale: ANIM.SCALE_MIN, opacity: 0, phase: 'always-hide' };
    }

    // Calculate ideal animation window as path progress fraction
    // Target ~0.25s animation, clamped to reasonable progress range
    const targetAnimMs = ANIM.TARGET_DURATION_S * 1000;
    let idealAnimProgress = pathDuration > 0 ? targetAnimMs / pathDuration : ANIM.MIN_PROGRESS;
    idealAnimProgress = Math.max(ANIM.MIN_PROGRESS, Math.min(ANIM.MAX_PROGRESS, idealAnimProgress));
    
    // Calculate available space before this waypoint (constrained by previous waypoint).
    // Use half the gap so animations don't overlap with the previous waypoint's out-animation.
    // The clamp below provides an additional hard floor at prevWaypointProgress.
    const availableBefore = prevWaypointProgress >= 0 
      ? (waypointPathProgress - prevWaypointProgress) / 2
      : waypointPathProgress;  // First waypoint: use full distance from start
    
    // Calculate available space after this waypoint (constrained by next waypoint)
    const availableAfter = nextWaypointProgress <= 1
      ? (nextWaypointProgress - waypointPathProgress) / 2  // Use half the gap
      : 1 - waypointPathProgress;  // Last waypoint: use full distance to end
    
    // Constrain animation windows to available space (speeds up animation if needed)
    const animInProgress = Math.max(ANIM.MIN_PROGRESS, Math.min(idealAnimProgress, availableBefore));
    const animOutProgress = Math.max(ANIM.MIN_PROGRESS, Math.min(idealAnimProgress, availableAfter));
    
    // Animation window positions (in path progress space).
    // CLAMP: animInStart can never precede prevWaypointProgress.
    // Since pathProgress freezes during pauses, this guarantees the next waypoint's
    // animation cannot begin until after the previous waypoint's pause has ended
    // and the path head has actually moved past the previous waypoint.
    const prevClamp = prevWaypointProgress >= 0 ? prevWaypointProgress : 0;
    const animInStart = Math.max(prevClamp, waypointPathProgress - animInProgress);
    const animOutEnd = Math.min(1, waypointPathProgress + animOutProgress);
    
    // Effective animate-in distance (may be less than animInProgress due to clamp)
    const effectiveAnimIn = waypointPathProgress - animInStart;
    
    const t = currentPathProgress;
    
    // Determine behavior based on mode
    const hidesBefore = waypointVisibility === WAYPOINT_VISIBILITY.HIDE_BEFORE || 
                        waypointVisibility === WAYPOINT_VISIBILITY.HIDE_BEFORE_AND_AFTER;
    const hidesAfter = waypointVisibility === WAYPOINT_VISIBILITY.HIDE_AFTER || 
                       waypointVisibility === WAYPOINT_VISIBILITY.HIDE_BEFORE_AND_AFTER;
    
    // ── Deficit calculation: do close waypoints need pre-animation? ─────
    // Pre-animation is ONLY needed when the travel time from A → B is
    // shorter than targetAnimMs. In that case the animation can't fully
    // unfold during travel, so we start it during A's pause.
    // deficitMs = how much animation time is missing from the travel phase.
    // When deficitMs === 0 the animation fits entirely during travel and
    // both the time-based block and preAnimFraction are skipped — this
    // prevents the regression where distant waypoints flash prematurely.
    const travelTimeMs = prevWaypointProgress >= 0
      ? (waypointPathProgress - prevWaypointProgress) * pathDuration
      : Infinity;  // First waypoint: no constraint
    const deficitMs = Math.max(0, targetAnimMs - travelTimeMs);
    
    // ── Time-based pre-animation during previous waypoint's pause ────────
    // When the engine is paused at the previous waypoint AND the waypoints
    // are close (deficitMs > 0), begin this waypoint's appear animation
    // during the tail end of that pause. The animation covers only the
    // deficit portion of the full animation curve; the remainder plays out
    // during the progress-based travel phase after the pause ends.
    if (deficitMs > 0 && hidesBefore && pauseState?.isWaiting && prevWaypointProgress >= 0) {
      // Check if the pause is at the previous waypoint (within tolerance for float comparison)
      const isPausedAtPrev = Math.abs(pauseState.waypointProgress - prevWaypointProgress) < 0.0001;
      
      if (isPausedAtPrev && pauseState.total > 0) {
        // Pre-animation starts deficitMs before the pause ends
        const animStartInPause = Math.max(0, pauseState.total - deficitMs);
        
        if (pauseState.elapsed >= animStartInPause) {
          // B is pre-animating during A's pause.
          // Map elapsed time to the first portion (0 → deficitMs/targetAnimMs)
          // of the full animation curve so easing stays consistent.
          const timeInAnim = pauseState.elapsed - animStartInPause;
          const timeBasedAnimT = Math.min(deficitMs / targetAnimMs, timeInAnim / targetAnimMs);
          const easedT = this.easeOutBack(timeBasedAnimT, ANIM.SCALE_OVERSHOOT);
          const scale = ANIM.SCALE_MIN + easedT * (ANIM.SCALE_MAX - ANIM.SCALE_MIN);
          return { visible: true, scale: Math.max(0, scale), opacity: 1, phase: 'pre-animating-in' };
        }
        
        // Not yet in pre-animation window — still hidden
        return { visible: false, scale: ANIM.SCALE_MIN, opacity: 0, phase: 'before-hidden' };
      }
    }
    
    // ── Pre-animation head start for progress-based phase ────────────────
    // After a pause at the previous waypoint, account for the time-based
    // pre-animation that already happened. Only relevant when waypoints
    // are close (deficitMs > 0). preAnimFraction represents how far
    // through the animation curve the time-based phase reached, so the
    // progress-based phase can continue from that point seamlessly.
    //
    // preAnimFraction: 0 (no deficit or no pause) to 1 (fully animated during pause)
    let preAnimFraction = 0;
    if (deficitMs > 0 && hidesBefore && prevWaypointPauseMs > 0 && prevWaypointProgress >= 0) {
      // The actual pre-animation time is capped by both the deficit and the pause duration
      const actualPreAnimMs = Math.min(deficitMs, prevWaypointPauseMs);
      preAnimFraction = actualPreAnimMs / targetAnimMs;
    }

    // Phase 1: Before animation window
    if (t < animInStart) {
      if (hidesBefore) {
        return { visible: false, scale: ANIM.SCALE_MIN, opacity: 0, phase: 'before-hidden' };
      }
      return { visible: true, scale: ANIM.SCALE_MAX, opacity: 1, phase: 'before-visible' };
    }

    // Phase 2: Animating in (approaching waypoint)
    if (t >= animInStart && t < waypointPathProgress) {
      if (hidesBefore) {
        // Progress-based animation with head start from pre-animation.
        // combinedT blends the time-based portion (preAnimFraction) with
        // the remaining progress-based portion, ensuring a smooth curve
        // from where the pre-animation left off to full scale.
        const progressT = effectiveAnimIn > 0 ? (t - animInStart) / effectiveAnimIn : 1;
        const combinedT = preAnimFraction + progressT * (1 - preAnimFraction);
        const easedT = this.easeOutBack(Math.min(1, combinedT), ANIM.SCALE_OVERSHOOT);
        const scale = ANIM.SCALE_MIN + easedT * (ANIM.SCALE_MAX - ANIM.SCALE_MIN);
        return { visible: true, scale: Math.max(0, scale), opacity: 1, phase: 'animating-in' };
      }
      return { visible: true, scale: ANIM.SCALE_MAX, opacity: 1, phase: 'approaching' };
    }

    // Phase 3: At waypoint (path progress equals waypoint progress)
    // This phase is extended by pauses (path progress stays constant)
    if (t >= waypointPathProgress && t < waypointPathProgress + 0.001) {
      return { visible: true, scale: ANIM.SCALE_MAX, opacity: 1, phase: 'at-waypoint' };
    }

    // Phase 4: Animating out (leaving waypoint)
    if (t >= waypointPathProgress && t < animOutEnd) {
      if (hidesAfter) {
        const animT = animOutProgress > 0 ? (t - waypointPathProgress) / animOutProgress : 1;
        const easedT = this.easeInBack(animT, ANIM.SCALE_OVERSHOOT);
        const scale = ANIM.SCALE_MAX - easedT * (ANIM.SCALE_MAX - ANIM.SCALE_MIN);
        return { visible: true, scale: Math.max(0, scale), opacity: 1, phase: 'animating-out' };
      }
      return { visible: true, scale: ANIM.SCALE_MAX, opacity: 1, phase: 'leaving' };
    }

    // Phase 5: After animation window
    if (hidesAfter) {
      return { visible: false, scale: ANIM.SCALE_MIN, opacity: 0, phase: 'after-hidden' };
    }
    return { visible: true, scale: ANIM.SCALE_MAX, opacity: 1, phase: 'after-visible' };
  }

  // ========== EASING FUNCTIONS ==========
  // Used for smooth waypoint scale animations
  // O(1) time complexity - pure mathematical functions
  
  /**
   * Ease-out with optional overshoot (for waypoint appear animation).
   * 
   * ## Curve Behavior
   * - Starts fast, decelerates to stop
   * - With overshoot: slightly exceeds target then settles back
   * - Creates natural "pop in" effect
   * 
   * @param {number} t - Progress (0-1)
   * @param {number} [overshoot=1.0] - Overshoot multiplier (1.0 = cubic, >1.0 = back ease)
   * @returns {number} Eased value (0-1, may exceed 1 with overshoot)
   */
  easeOutBack(t, overshoot = 1.0) {
    if (overshoot <= 1.0) {
      // Cubic ease-out: f(t) = 1 - (1-t)³
      return 1 - Math.pow(1 - t, 3);
    }
    // Back ease-out with overshoot (based on Penner equations)
    const c1 = 1.70158 * (overshoot - 1);
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /**
   * Ease-in with optional overshoot (for waypoint disappear animation).
   * 
   * ## Curve Behavior
   * - Starts slow, accelerates to end
   * - With overshoot: pulls back slightly before moving forward
   * - Creates natural "shrink away" effect
   * 
   * @param {number} t - Progress (0-1)
   * @param {number} [overshoot=1.0] - Overshoot multiplier (1.0 = cubic, >1.0 = back ease)
   * @returns {number} Eased value (0-1, may go negative with overshoot)
   */
  easeInBack(t, overshoot = 1.0) {
    if (overshoot <= 1.0) {
      // Cubic ease-in: f(t) = t³
      return Math.pow(t, 3);
    }
    // Back ease-in with overshoot (based on Penner equations)
    const c1 = 1.70158 * (overshoot - 1);
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  }

  /**
   * Cubic ease-in-out function for smooth animations
   * @param {number} t - Progress (0-1)
   * @returns {number} Eased value (0-1)
   */
  easeInOutCubic(t) {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ========== BACKGROUND REVEAL ==========

  /**
   * Initialize or resize the reveal mask canvas
   * 
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @private
   */
  initRevealMask(width, height) {
    this.revealMaskCanvas = document.createElement('canvas');
    this.revealMaskCanvas.width = width;
    this.revealMaskCanvas.height = height;
    this.revealMaskCtx = this.revealMaskCanvas.getContext('2d');
    this.lastCanvasSize = { width, height };
    
    // Start with fully transparent (alpha = 0 = hidden)
    // destination-in composite uses alpha channel, not color
    this.revealMaskCtx.clearRect(0, 0, width, height);
  }

  /**
   * Reset the reveal mask (for new export or animation reset)
   */
  resetRevealMask() {
    if (this.revealMaskCanvas && this.revealMaskCtx) {
      const { width, height } = this.revealMaskCanvas;
      // Clear to transparent (alpha = 0 = hidden)
      this.revealMaskCtx.clearRect(0, 0, width, height);
    }
  }

  /**
   * Ease-in quadratic function for gentle acceleration at start, linear finish
   * @param {number} t - Progress from 0 to 1
   * @returns {number} Eased value from 0 to 1
   */
  static easeInQuad(t) {
    return t * t;
  }
  
  /**
   * Calculate intro animation scale factor based on current time
   * @param {number} currentTimeMs - Current animation time in milliseconds
   * @returns {number} Scale factor from 0 to 1
   */
  static getIntroScale(currentTimeMs) {
    const { DURATION_MS } = MotionVisibilityService.INTRO_ANIMATION;
    if (currentTimeMs >= DURATION_MS) return 1;
    if (currentTimeMs <= 0) return 0;
    const t = currentTimeMs / DURATION_MS;
    return MotionVisibilityService.easeInQuad(t);
  }

  /**
   * Build the reveal mask by walking the path from start to current progress
   * This approach supports bidirectional scrubbing - mask is rebuilt each frame
   * 
   * @param {Array} pathPoints - Array of path points
   * @param {number} progress - Current animation progress (0-1)
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {Object} settings - Motion settings
   * @param {number} settings.revealSize - Reveal radius as % of canvas
   * @param {number} settings.revealFeather - Feather width as % of spotlight radius
   * @param {number} [settings.revealTrail] - REVEAL-01: how much of the path
   *   behind the head stays revealed, as a % of the whole path. At
   *   SPOTLIGHT_TRAIL_MAX the reveal never fades, which is the pre-REVEAL-01
   *   behaviour and the default.
   * @param {Function} imageToCanvas - Coordinate transform function (imgX, imgY) => {x, y}
   * @param {number} currentTimeMs - Current animation time in milliseconds (for intro animation)
   * @returns {HTMLCanvasElement} The reveal mask canvas
   */
  buildSpotlightRevealMask(pathPoints, progress, canvasWidth, canvasHeight, settings, imageToCanvas = null, currentTimeMs = Infinity) {
    const { revealSize, revealFeather } = settings;
    const revealTrail = settings.revealTrail ?? MOTION.SPOTLIGHT_TRAIL_DEFAULT;
    
    // Apply intro animation scale (0→1 over first second)
    const introScale = MotionVisibilityService.getIntroScale(currentTimeMs);

    // Initialize or resize mask if needed
    if (!this.revealMaskCanvas || 
        this.lastCanvasSize.width !== canvasWidth ||
        this.lastCanvasSize.height !== canvasHeight) {
      this.initRevealMask(canvasWidth, canvasHeight);
    } else {
      // Clear the mask for rebuild
      this.revealMaskCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    if (!pathPoints || pathPoints.length === 0 || progress <= 0) {
      return this.revealMaskCanvas;
    }

    // Calculate spotlight radius in pixels, scaled by intro animation
    const avgSize = (canvasWidth + canvasHeight) / 2;
    const baseRadius = (revealSize / 100) * avgSize;
    const radius = baseRadius * introScale; // Scale from 0 to full during intro
    const feather = (revealFeather / 100) * radius;
    const innerRadius = MotionVisibilityService.spotlightInnerRadius(radius, feather);

    const ctx = this.revealMaskCtx;
    ctx.globalCompositeOperation = 'source-over';

    // Calculate how many points to process based on progress
    const totalPoints = pathPoints.length;
    const endIndex = Math.min(Math.floor(totalPoints * progress), totalPoints - 1);
    
    // Sample rate: draw at every point for smooth coverage (no stepping)
    const sampleRate = 1;

    // REVEAL-01: the reveal fades out behind the head rather than staying lit
    // for good. Each passed point is weighted by how far behind the head it
    // is, measured as a fraction of the whole path so the fade reads the same
    // regardless of path length or point density. The mask is still rebuilt
    // from scratch every frame — that full rebuild is what makes scrubbing
    // bidirectional, so the fade must stay a pure function of position, never
    // an accumulated decay.
    const headIndex = totalPoints * progress;
    // Pure fast path: at the sentinel every point is fully lit, so skip the
    // per-point weighting entirely rather than calling it 1,000 times to be
    // told 1. The sentinel's meaning itself lives in revealTrailAlpha.
    const fades = revealTrail < MOTION.SPOTLIGHT_TRAIL_MAX;

    // Walk the path and draw reveals at every point for smooth coverage
    for (let i = 0; i <= endIndex; i += sampleRate) {
      const alpha = fades
        ? MotionVisibilityService.revealTrailAlpha(i, headIndex, totalPoints, revealTrail)
        : 1;
      // Fully faded points contribute nothing; skip the draw entirely.
      if (alpha <= 0) continue;

      const pointRaw = pathPoints[i];
      // Transform from normalized to canvas coords
      const point = imageToCanvas ? imageToCanvas(pointRaw.x, pointRaw.y) : pointRaw;
      
      // Create radial gradient for this point
      const gradient = ctx.createRadialGradient(
        point.x, point.y, innerRadius,
        point.x, point.y, radius
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Always draw at the exact current position for smooth edge
    const exactIndex = totalPoints * progress;
    const pointIndex = Math.min(Math.floor(exactIndex), totalPoints - 1);
    const fraction = exactIndex - pointIndex;
    
    let currentPosNorm;
    if (pointIndex >= totalPoints - 1) {
      currentPosNorm = pathPoints[totalPoints - 1];
    } else {
      const p1 = pathPoints[pointIndex];
      const p2 = pathPoints[pointIndex + 1];
      currentPosNorm = {
        x: p1.x + (p2.x - p1.x) * fraction,
        y: p1.y + (p2.y - p1.y) * fraction
      };
    }
    
    // Transform from normalized to canvas coords
    const currentPos = imageToCanvas ? imageToCanvas(currentPosNorm.x, currentPosNorm.y) : currentPosNorm;

    const gradient = ctx.createRadialGradient(
      currentPos.x, currentPos.y, innerRadius,
      currentPos.x, currentPos.y, radius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(currentPos.x, currentPos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    return this.revealMaskCanvas;
  }

  /**
   * Build the AOV reveal mask by walking the path from start to current progress
   * This approach supports bidirectional scrubbing - mask is rebuilt each frame
   * 
   * During waypoint pauses, uses waypoint-to-waypoint direction to prevent
   * premature turning caused by Catmull-Rom spline interpolation.
   * 
   * @param {Array} pathPoints - Array of path points
   * @param {number} progress - Current animation progress (0-1)
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {Object} settings - Motion settings
   * @param {number} settings.aovAngle - Cone angle in degrees
   * @param {number} settings.aovDistance - Distance as % of canvas
   * @param {number} settings.aovDropoff - Dropoff as % of distance
   * @param {Array} waypoints - Optional array of waypoint objects with x,y positions
   * @param {Array} waypointProgressValues - Optional array of waypoint progress values
   * @param {Object} animationEngine - Optional animation engine for pause state detection
   * @param {Function} imageToCanvas - Coordinate transform function (imgX, imgY) => {x, y}
   * @param {number} currentTimeMs - Current animation time in milliseconds (for intro animation)
   * @returns {HTMLCanvasElement} The reveal mask canvas
   */
  buildAOVRevealMask(pathPoints, progress, canvasWidth, canvasHeight, settings, waypoints = null, waypointProgressValues = null, animationEngine = null, imageToCanvas = null, currentTimeMs = Infinity) {
    const { aovAngle, aovDistance } = settings;
    // Default aovDropoff to 50% if null/undefined/NaN
    const aovDropoff = (settings.aovDropoff == null || isNaN(settings.aovDropoff)) ? 50 : settings.aovDropoff;
    
    // Get intro animation scale from AnimationEngine (sequential intro)
    // If AnimationEngine has intro time set, use its progress; otherwise fall back to time-based
    let introScale = 1;
    if (animationEngine && animationEngine.introTime > 0) {
      // Sequential intro: use AnimationEngine's intro progress with easing
      const introProgress = animationEngine.getIntroProgress();
      introScale = MotionVisibilityService.easeInQuad(introProgress);
    } else {
      // Fallback: parallel intro based on currentTimeMs (legacy behavior)
      introScale = MotionVisibilityService.getIntroScale(currentTimeMs);
    }
    
    // DEBUG: Log intro animation state (throttled to avoid spam)
    if (introScale < 1 && Math.floor(currentTimeMs / 100) !== this._lastIntroLogTime) {
      this._lastIntroLogTime = Math.floor(currentTimeMs / 100);
      console.debug(`🎬 [AOV Intro] time=${currentTimeMs.toFixed(0)}ms, scale=${introScale.toFixed(3)}, progress=${progress.toFixed(4)}, sequential=${animationEngine?.introTime > 0}`);
    }
    
    // DEBUG: Set to true to store cone info for visualization on main canvas
    const DEBUG_DRAW_CONE_OUTLINES = true;
    
    // Store debug cone info for rendering on main canvas (not the mask)
    this._debugCurrentCone = null;

    // Initialize or resize mask if needed
    if (!this.revealMaskCanvas || 
        this.lastCanvasSize.width !== canvasWidth ||
        this.lastCanvasSize.height !== canvasHeight) {
      this.initRevealMask(canvasWidth, canvasHeight);
      console.debug(`🔧 [AOV] Initialized mask: ${canvasWidth}x${canvasHeight}`);
    }
    
    // FULL REBUILD APPROACH: Clear and rebuild every frame
    // This ensures correct direction calculation and works in both temporal directions
    // Performance is acceptable since we're only drawing ~400 cones per frame
    this.revealMaskCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!pathPoints || pathPoints.length < 2) {
      return this.revealMaskCanvas;
    }
    
    // During intro animation (progress = 0), we still need to draw the cone at the start
    // Only skip if progress is negative (shouldn't happen) or no intro animation
    if (progress <= 0 && introScale <= 0) {
      return this.revealMaskCanvas;
    }

    // Calculate cone dimensions - distance is % of canvas diagonal, scaled by intro animation
    const diagonal = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
    const baseDistance = (aovDistance / 100) * diagonal;
    const distance = baseDistance * introScale; // Scale from 0 to full during intro
    const halfAngleRad = (aovAngle / 2) * (Math.PI / 180);
    
    // Dropoff controls the gradient fade, not the cone size
    // 0% = hard edge (no gradient), 100% = full feather (gradient across entire distance)
    // The cone geometry always uses full distance; dropoff only affects the gradient
    const featherFraction = aovDropoff / 100; // 0 = hard edge, 1 = full feather
    
    // DEBUG: Log dropoff values (throttled)
    if (!this._lastDropoffLogTime || Date.now() - this._lastDropoffLogTime > 500) {
      this._lastDropoffLogTime = Date.now();
      console.debug(`🎚️ [AOV Dropoff] aovDropoff=${aovDropoff}, featherFraction=${featherFraction}, isNaN=${isNaN(featherFraction)}`);
    }

    const ctx = this.revealMaskCtx;
    // Use 'source-over' (default) to paint cones on top of each other
    // This ensures consistent coverage without over-saturation from 'lighter' mode
    ctx.globalCompositeOperation = 'source-over';

    // Calculate how many points to process based on progress
    const totalPoints = pathPoints.length;
    const endIndex = Math.min(Math.floor(totalPoints * progress), totalPoints - 1);
    
    // Cone geometry always uses full distance - dropoff only affects gradient
    const effectiveDistance = distance;

    // Helper to get cone vertices at a position with direction
    const getConeVertices = (tipX, tipY, direction) => ({
      tip: { x: tipX, y: tipY },
      left: {
        x: tipX + Math.cos(direction - halfAngleRad) * effectiveDistance,
        y: tipY + Math.sin(direction - halfAngleRad) * effectiveDistance
      },
      right: {
        x: tipX + Math.cos(direction + halfAngleRad) * effectiveDistance,
        y: tipY + Math.sin(direction + halfAngleRad) * effectiveDistance
      },
      direction
    });

    // Helper to draw a single cone with gradient based on dropoff
    // Uses arc() for smooth curved outer edge instead of straight line
    const drawCone = (cone, isCurrentCone = false) => {
      // Use radial gradient from tip for proper cone coverage
      // featherFraction controls where the fade starts:
      // 0% = hard edge (solid white, no fade)
      // 50% = fade covers last 50% of distance (solid for first 50%)
      // 100% = full gradient from tip (100% opaque) to base (0% opaque)
      
      if (featherFraction <= 0) {
        // Hard edge - solid white, no gradient needed
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      } else {
        // Radial gradient from tip - properly covers the entire cone shape
        const gradient = ctx.createRadialGradient(
          cone.tip.x, cone.tip.y, 0,
          cone.tip.x, cone.tip.y, effectiveDistance
        );
        // At 100% dropoff: gradient goes from 100% opaque at tip to 0% opaque at base
        // At 50% dropoff: solid white for first 50%, then fade to 0% at base
        // At 0% dropoff: solid white all the way (handled above)
        const solidStop = Math.max(0, 1 - featherFraction);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // Tip is always fully opaque
        if (solidStop > 0.001) {
          gradient.addColorStop(solidStop, 'rgba(255, 255, 255, 1)');
        }
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Base fades to transparent
        ctx.fillStyle = gradient;
      }
      
      // Draw pie slice with arc for smooth outer edge
      const startAngle = cone.direction - halfAngleRad;
      const endAngle = cone.direction + halfAngleRad;
      
      ctx.beginPath();
      ctx.moveTo(cone.tip.x, cone.tip.y);
      ctx.arc(cone.tip.x, cone.tip.y, effectiveDistance, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
      
      // DEBUG: Store cone info for rendering on main canvas (not the mask)
      if (DEBUG_DRAW_CONE_OUTLINES && isCurrentCone) {
        // Store for external rendering - don't draw on mask canvas
        this._debugCurrentCone = { ...cone };
      }
    };

    // Helper to draw the swept area between two consecutive cones
    // Uses a filled quadrilateral connecting the tips and following the path
    // This fills gaps between cones without creating angular artifacts
    // NOTE: Uses same gradient as cones for consistent dropoff effect
    const drawSweptArea = (cone1, cone2) => {
      // Only draw if tips are different positions (not the same point)
      const dx = cone2.tip.x - cone1.tip.x;
      const dy = cone2.tip.y - cone1.tip.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) return; // Skip if cones are at same position
      
      // Apply same gradient logic as cones for consistent dropoff
      if (featherFraction <= 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      } else {
        // Use linear gradient along the path direction for swept area
        // This approximates the radial gradient effect between cones
        const midX = (cone1.tip.x + cone2.tip.x) / 2;
        const midY = (cone1.tip.y + cone2.tip.y) / 2;
        const gradient = ctx.createRadialGradient(
          midX, midY, 0,
          midX, midY, effectiveDistance
        );
        const solidStop = Math.max(0, 1 - featherFraction);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        if (solidStop > 0.001) {
          gradient.addColorStop(solidStop, 'rgba(255, 255, 255, 1)');
        }
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
      }
      
      // Draw a filled region that connects the two cones
      // Use a simple quadrilateral from tip1 to tip2 with width based on the cone angle
      // This creates a "corridor" between the two cone tips
      
      // Calculate perpendicular direction to the path between tips
      const pathAngle = Math.atan2(dy, dx);
      const perpAngle = pathAngle + Math.PI / 2;
      
      // Width of the corridor should be minimal - just enough to fill gaps between cones
      // Using a fixed small width prevents sudden jumps at sharp turns
      // The cones themselves provide the main coverage; this just fills seams
      const corridorHalfWidth = Math.min(dist * 0.3, 10);
      
      ctx.beginPath();
      ctx.moveTo(
        cone1.tip.x + Math.cos(perpAngle) * corridorHalfWidth,
        cone1.tip.y + Math.sin(perpAngle) * corridorHalfWidth
      );
      ctx.lineTo(
        cone2.tip.x + Math.cos(perpAngle) * corridorHalfWidth,
        cone2.tip.y + Math.sin(perpAngle) * corridorHalfWidth
      );
      ctx.lineTo(
        cone2.tip.x - Math.cos(perpAngle) * corridorHalfWidth,
        cone2.tip.y - Math.sin(perpAngle) * corridorHalfWidth
      );
      ctx.lineTo(
        cone1.tip.x - Math.cos(perpAngle) * corridorHalfWidth,
        cone1.tip.y - Math.sin(perpAngle) * corridorHalfWidth
      );
      ctx.closePath();
      ctx.fill();
    };

    // Check if we're at a waypoint pause - if so, we'll use waypoint-based direction
    const isWaiting = animationEngine?.state?.isWaitingAtWaypoint;
    const pauseWaypointIndex = animationEngine?.state?.pauseWaypointIndex ?? -1;
    
    // Helper to get waypoint canvas coordinates (waypoints use imgX/imgY normalized 0-1)
    // Uses imageToCanvas for proper coordinate transformation
    const getWaypointCanvasPos = (wp) => {
      if (imageToCanvas) {
        return imageToCanvas(wp.imgX, wp.imgY);
      }
      // Fallback to simple scaling
      return { x: wp.imgX * canvasWidth, y: wp.imgY * canvasHeight };
    };
    
    // Get waypoint-based FORWARD direction (from current waypoint to next)
    // This is used for AOV reveal to show what's ahead
    const getWaypointDirection = (waypointIndex) => {
      if (!waypoints || waypoints.length < 2 || waypointIndex < 0) return null;
      
      // Look FORWARD: from current waypoint to next waypoint
      if (waypointIndex < waypoints.length - 1) {
        const currWp = getWaypointCanvasPos(waypoints[waypointIndex]);
        const nextWp = getWaypointCanvasPos(waypoints[waypointIndex + 1]);
        return Math.atan2(nextWp.y - currWp.y, nextWp.x - currWp.x);
      }
      
      // Last waypoint - use direction from previous (we're at the end, look back for final direction)
      const prevWp = getWaypointCanvasPos(waypoints[waypointIndex - 1]);
      const currWp = getWaypointCanvasPos(waypoints[waypointIndex]);
      return Math.atan2(currWp.y - prevWp.y, currWp.x - prevWp.x);
    };
    
    // Helper to check if we're approaching OR departing a waypoint
    // Returns {waypointIndex, shouldUseWaypointDir, blendFactor}
    // blendFactor: 1.0 = use full waypoint direction, 0.0 = use full path direction
    // Uses AOV_DIRECTION constants for consistent configuration
    const { APPROACH_THRESHOLD, SMOOTHING_LOOKBACK, DEPARTURE_THRESHOLD } = MotionVisibilityService.AOV_DIRECTION;
    const getApproachingWaypoint = (pointProgress) => {
      if (!waypointProgressValues || !waypoints || waypoints.length < 2) {
        return { waypointIndex: -1, shouldUseWaypointDir: false, blendFactor: 0 };
      }
      for (let i = 0; i < waypointProgressValues.length; i++) {
        const wpProgress = waypointProgressValues[i];
        
        // Check if we're approaching this waypoint (within threshold and not past it)
        if (pointProgress >= wpProgress - APPROACH_THRESHOLD && pointProgress <= wpProgress) {
          return { waypointIndex: i, shouldUseWaypointDir: true, blendFactor: 1.0 };
        }
        
        // Check if we're exactly at the waypoint
        if (Math.abs(pointProgress - wpProgress) < 0.001) {
          return { waypointIndex: i, shouldUseWaypointDir: true, blendFactor: 1.0 };
        }
        
        // Check if we're in the DEPARTURE zone (just left waypoint)
        // Blend from waypoint direction to path direction over DEPARTURE_THRESHOLD
        if (pointProgress > wpProgress && pointProgress <= wpProgress + DEPARTURE_THRESHOLD) {
          // Calculate blend factor: 1.0 at waypoint, 0.0 at end of departure zone
          const departureProgress = (pointProgress - wpProgress) / DEPARTURE_THRESHOLD;
          const blendFactor = 1.0 - departureProgress; // Smooth linear blend
          return { waypointIndex: i, shouldUseWaypointDir: true, blendFactor };
        }
      }
      return { waypointIndex: -1, shouldUseWaypointDir: false, blendFactor: 0 };
    };

    // Helper to blend two angles smoothly (handles wraparound at ±PI)
    const blendAngles = (angle1, angle2, t) => {
      // Normalize angles to [-PI, PI]
      const normalize = (a) => {
        while (a > Math.PI) a -= 2 * Math.PI;
        while (a < -Math.PI) a += 2 * Math.PI;
        return a;
      };
      const a1 = normalize(angle1);
      const a2 = normalize(angle2);
      
      // Find shortest path between angles
      let diff = a2 - a1;
      if (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff < -Math.PI) diff += 2 * Math.PI;
      
      return normalize(a1 + diff * t);
    };
    
    // Helper to find the next waypoint path index after a given index
    // Returns totalPoints if no waypoint ahead (i.e., we're past all waypoints)
    const getNextWaypointPathIndex = (fromIndex) => {
      if (!waypointProgressValues || waypointProgressValues.length === 0) {
        return totalPoints; // No waypoints, no boundary
      }
      const fromProgress = fromIndex / (totalPoints - 1);
      for (let i = 0; i < waypointProgressValues.length; i++) {
        const wpProgress = waypointProgressValues[i];
        if (wpProgress > fromProgress + 0.001) { // Small epsilon to avoid self-match
          return Math.round(wpProgress * (totalPoints - 1));
        }
      }
      return totalPoints; // No waypoint ahead
    };
    
    // Helper to get FORWARD path-based direction (where we're going, not where we came from)
    // AOV reveal should show what's ahead, so we look forward along the path
    // Uses canvas coords for accurate angle calculation
    // 
    // KEY: Lookahead is LIMITED to not cross waypoint boundaries.
    // This prevents the direction from changing before reaching a waypoint.
    const getForwardPathDirection = (index) => {
      // Safety check for empty or single-point paths
      if (totalPoints <= 1) {
        return 0; // Default direction (pointing right)
      }
      
      // Clamp index to valid range
      const safeIndex = Math.max(0, Math.min(index, totalPoints - 1));
      
      // Helper to transform path point to canvas coords
      const toCanvas = (pt) => imageToCanvas ? imageToCanvas(pt.x, pt.y) : pt;
      
      // If we're at or near the end, use the last segment direction
      if (safeIndex >= totalPoints - 1) {
        const prevPt = toCanvas(pathPoints[totalPoints - 2]);
        const curr = toCanvas(pathPoints[totalPoints - 1]);
        return Math.atan2(curr.y - prevPt.y, curr.x - prevPt.x);
      }
      
      // Find the next waypoint - don't look past it
      const nextWpIndex = getNextWaypointPathIndex(safeIndex);
      
      // Limit lookahead to not cross the next waypoint
      // This prevents direction from changing before we reach the waypoint
      const maxLookahead = Math.min(
        totalPoints - 1,
        safeIndex + SMOOTHING_LOOKBACK,
        nextWpIndex // Don't look past the next waypoint
      );
      
      // If we're right at or very close to the waypoint, use minimal lookahead
      const lookaheadEnd = Math.max(safeIndex + 1, maxLookahead);
      
      const curr = toCanvas(pathPoints[safeIndex]);
      const endPt = toCanvas(pathPoints[Math.min(lookaheadEnd, totalPoints - 1)]);
      
      return Math.atan2(endPt.y - curr.y, endPt.x - curr.x);
    };
    
    // Helper to get forward-looking direction with smoothing
    // Uses a lookahead segment (SMOOTHING_LOOKBACK points) for smoother turns
    // 
    // KEY FIX: At waypoints, use INCOMING direction (from previous segment)
    // The direction should only change to outgoing AFTER the pause completes.
    // This prevents the rotation from appearing before the pause phase.
    // SMOOTHING_LOOKBACK is destructured from AOV_DIRECTION above
    
    const getForwardDirection = (index) => {
      // Check if this point is at or very near a waypoint
      const wpIndex = getWaypointAtIndex(index);
      
      if (wpIndex >= 0 && wpIndex > 0) {
        // At a waypoint (not the first one) - use INCOMING direction
        // This is the direction from the previous waypoint TO this waypoint
        const prevWp = getWaypointCanvasPos(waypoints[wpIndex - 1]);
        const currWp = getWaypointCanvasPos(waypoints[wpIndex]);
        return Math.atan2(currWp.y - prevWp.y, currWp.x - prevWp.x);
      }
      
      // Check if we're APPROACHING a waypoint - also use incoming direction
      // This prevents the Catmull-Rom spline curvature from causing premature rotation
      const approachingWpIdx = isApproachingWaypoint(index);
      if (approachingWpIdx >= 0 && approachingWpIdx > 0) {
        // Approaching a waypoint - use incoming direction (from previous waypoint to this one)
        const prevWp = getWaypointCanvasPos(waypoints[approachingWpIdx - 1]);
        const currWp = getWaypointCanvasPos(waypoints[approachingWpIdx]);
        return Math.atan2(currWp.y - prevWp.y, currWp.x - prevWp.x);
      }
      
      // Not at or approaching a waypoint - use forward path direction
      return getForwardPathDirection(index);
    };
    
    // Helper to check if a path point index is at or near a waypoint
    // Returns the waypoint index if at a waypoint, -1 otherwise
    const getWaypointAtIndex = (pointIndex) => {
      if (!waypointProgressValues || !waypoints) return -1;
      const pointProgress = pointIndex / (totalPoints - 1);
      for (let i = 0; i < waypointProgressValues.length; i++) {
        if (Math.abs(pointProgress - waypointProgressValues[i]) < 0.001) {
          return i;
        }
      }
      return -1;
    };
    
    // Helper to check if we're approaching a waypoint (within a threshold)
    // Returns the waypoint index if approaching, -1 otherwise
    // This is used to prevent direction blending when nearing a waypoint
    const isApproachingWaypoint = (pointIndex) => {
      if (!waypointProgressValues || !waypoints) return -1;
      const pointProgress = pointIndex / (totalPoints - 1);
      // Use a larger threshold to catch the approach zone
      // APPROACH_THRESHOLD is typically 0.02 (2% of path)
      for (let i = 0; i < waypointProgressValues.length; i++) {
        const wpProgress = waypointProgressValues[i];
        // Check if we're approaching (within threshold and before the waypoint)
        if (pointProgress < wpProgress && wpProgress - pointProgress < APPROACH_THRESHOLD) {
          return i;
        }
      }
      return -1;
    };

    // Helper to normalize angle difference to [-PI, PI]
    const normalizeAngle = (angle) => {
      while (angle > Math.PI) angle -= 2 * Math.PI;
      while (angle < -Math.PI) angle += 2 * Math.PI;
      return angle;
    };

    // Rate-limited turning: maximum angle change per path point (in radians)
    // This creates smoother visual transitions at sharp turns
    // ~5 degrees per point = smooth turning that doesn't jump
    const MAX_TURN_RATE = Math.PI / 36; // 5 degrees per step
    let rateLimitedDirection = null; // Track the smoothed direction
    
    // Apply rate limiting to direction changes
    const applyTurnRateLimit = (targetDirection, prevDirection) => {
      if (prevDirection === null) {
        return targetDirection; // First point, no limiting
      }
      
      const diff = normalizeAngle(targetDirection - prevDirection);
      
      // If the change is within the limit, use target directly
      if (Math.abs(diff) <= MAX_TURN_RATE) {
        return targetDirection;
      }
      
      // Otherwise, limit the change to MAX_TURN_RATE
      const limitedDiff = Math.sign(diff) * MAX_TURN_RATE;
      return normalizeAngle(prevDirection + limitedDiff);
    };

    // Helper to interpolate between two cones for smooth corners
    // Draws swept area corridor AND intermediate cones for complete coverage
    const drawInterpolatedCones = (cone1, cone2) => {
      // Always draw the corridor between consecutive cones to fill the path
      drawSweptArea(cone1, cone2);
      
      const angleDiff = Math.abs(normalizeAngle(cone2.direction - cone1.direction));
      
      // For very small angle changes, the corridor + arc overlap is sufficient
      if (angleDiff < Math.PI / 180) { // Less than 1 degree
        return;
      }
      
      // Calculate number of intermediate steps based on angle change
      // Use finer steps (2 degrees) for smooth rotation coverage
      const steps = Math.max(2, Math.ceil(angleDiff / (Math.PI / 90)));
      
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        // Interpolate position
        const interpX = cone1.tip.x + (cone2.tip.x - cone1.tip.x) * t;
        const interpY = cone1.tip.y + (cone2.tip.y - cone1.tip.y) * t;
        // Interpolate direction (handle angle wrapping)
        const interpDir = cone1.direction + normalizeAngle(cone2.direction - cone1.direction) * t;
        
        const interpCone = getConeVertices(interpX, interpY, interpDir);
        drawCone(interpCone);
      }
    };

    // ========== FULL REBUILD EACH FRAME ==========
    // Draw all cones from start to current progress
    // This ensures correct forward direction and works in both temporal directions
    
    let prevCone = null;
    
    // Draw all cones from index 0 to endIndex
    for (let i = 0; i <= endIndex; i++) {
      const pointRaw = pathPoints[i];
      // Transform from normalized to canvas coords
      const point = imageToCanvas ? imageToCanvas(pointRaw.x, pointRaw.y) : pointRaw;
      
      // Get target direction and apply rate limiting for smooth turns
      const targetDirection = getForwardDirection(i);
      const direction = applyTurnRateLimit(targetDirection, rateLimitedDirection);
      rateLimitedDirection = direction; // Update for next iteration
      
      const cone = getConeVertices(point.x, point.y, direction);
      
      // Draw the cone itself
      drawCone(cone);
      
      // Draw interpolated cones between this and previous for smooth corners
      if (prevCone) {
        drawInterpolatedCones(prevCone, cone);
      }
      
      prevCone = cone;
    }

    // Always draw at the exact current position for smooth edge
    const exactIndex = totalPoints * progress;
    const pointIndex = Math.min(Math.floor(exactIndex), totalPoints - 1);
    const fraction = exactIndex - pointIndex;
    
    let direction;
    let currentPosNorm;
    
    // If waiting at a waypoint, use the INCOMING direction (from previous waypoint to this one)
    // This prevents the cone from "peeking" into the next segment during the pause
    if (isWaiting && pauseWaypointIndex >= 0 && pauseWaypointIndex < waypoints.length) {
      // Use waypoint position
      const wp = waypoints[pauseWaypointIndex];
      currentPosNorm = { x: wp.imgX, y: wp.imgY };
      
      // Get INCOMING direction (from previous waypoint to this one)
      const wpDir = getWaypointDirection(pauseWaypointIndex);
      if (wpDir !== null) {
        // For waypoints after the first, use incoming direction
        if (pauseWaypointIndex > 0) {
          const prevWp = getWaypointCanvasPos(waypoints[pauseWaypointIndex - 1]);
          const currWp = getWaypointCanvasPos(waypoints[pauseWaypointIndex]);
          direction = Math.atan2(currWp.y - prevWp.y, currWp.x - prevWp.x);
        } else {
          // First waypoint - use outgoing direction
          direction = wpDir;
        }
      } else {
        direction = getForwardDirection(pointIndex);
      }
    } else if (pointIndex >= totalPoints - 1) {
      currentPosNorm = pathPoints[totalPoints - 1];
      // Use forward-looking direction for final position
      direction = getForwardDirection(totalPoints - 1);
    } else {
      const p1 = pathPoints[pointIndex];
      const p2 = pathPoints[pointIndex + 1];
      currentPosNorm = {
        x: p1.x + (p2.x - p1.x) * fraction,
        y: p1.y + (p2.y - p1.y) * fraction
      };
      
      // Check if we're approaching a waypoint - if so, don't blend toward outgoing direction
      // The direction should stay as incoming until AFTER the pause at that waypoint
      const approachingWpIndex = isApproachingWaypoint(pointIndex);
      const nextWpIndex = getWaypointAtIndex(pointIndex + 1);
      
      if ((approachingWpIndex >= 0 && approachingWpIndex > 0) || (nextWpIndex >= 0 && nextWpIndex > 0)) {
        // Approaching or at a waypoint - use current direction only (no blending toward outgoing)
        direction = getForwardDirection(pointIndex);
      } else {
        // Normal case: interpolate direction between current and next point for smooth turns
        const dir1 = getForwardDirection(pointIndex);
        const dir2 = getForwardDirection(Math.min(pointIndex + 1, totalPoints - 1));
        direction = blendAngles(dir1, dir2, fraction);
      }
    }
    
    // Transform from normalized to canvas coords
    const currentPos = imageToCanvas ? imageToCanvas(currentPosNorm.x, currentPosNorm.y) : currentPosNorm;

    // Apply rate limiting to the final cone direction as well
    const rateLimitedFinalDirection = applyTurnRateLimit(direction, rateLimitedDirection);
    
    const finalCone = getConeVertices(currentPos.x, currentPos.y, rateLimitedFinalDirection);
    drawCone(finalCone, true); // true = current cone, show debug
    if (prevCone) {
      drawInterpolatedCones(prevCone, finalCone);
    }

    return this.revealMaskCanvas;
  }

  /**
   * Get the current reveal mask canvas
   * @returns {HTMLCanvasElement|null}
   */
  getRevealMask() {
    return this.revealMaskCanvas;
  }

  /**
   * Check if reveal mask needs to be applied (for spotlight-reveal or aov-reveal mode)
   * @param {Object} settings - Motion settings
   * @returns {boolean}
   */
  shouldApplyRevealMask(settings) {
    return settings.backgroundVisibility === 'spotlight-reveal' || 
           settings.backgroundVisibility === 'angle-of-view-reveal';
  }

  /**
   * Draw debug visualization showing background mode info
   * Call this AFTER applying the reveal mask
   * @param {CanvasRenderingContext2D} ctx - The main canvas context to draw on
   * @param {Object} settings - Motion settings containing backgroundVisibility
   */
  drawDebugOverlay(ctx, settings) {
    if (!settings) return;
    
    const mode = settings.backgroundVisibility || 'unknown';
    const dropdownEl = document.getElementById('background-visibility');
    const dropdownValue = dropdownEl?.value || 'not found';
    const dropdownDisabled = dropdownEl?.disabled ? 'YES' : 'no';
    
    // Draw semi-transparent background for readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 280, 80);
    
    // Draw debug info
    ctx.fillStyle = 'rgba(255, 255, 0, 1)';
    ctx.font = '12px monospace';
    ctx.fillText(`Background Mode Debug`, 20, 28);
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillText(`Settings value: ${mode}`, 20, 45);
    ctx.fillText(`Dropdown value: ${dropdownValue}`, 20, 60);
    ctx.fillText(`Dropdown disabled: ${dropdownDisabled}`, 20, 75);
  }

  // ========== UTILITY METHODS ==========

  /**
   * BUG-02 — the inner radius of a spotlight's feather gradient.
   *
   * A radial gradient whose two radii are equal paints *nothing*, so a feather
   * of 0 — which is `SPOTLIGHT_FEATHER_DEFAULT`, and therefore what every new
   * project starts with — made the whole spotlight invisible rather than
   * hard-edged. Keeping the inner circle strictly inside the outer one gives
   * the hard edge the default always claimed to mean.
   *
   * @param {number} radius - Outer spotlight radius in px
   * @param {number} feather - Feather width in px (0 = hard edge)
   * @returns {number} Inner radius, always strictly less than `radius`
   */
  static spotlightInnerRadius(radius, feather) {
    if (!(radius > 0)) return 0;
    const HARD_EDGE_PX = 0.5; // sub-pixel: reads as hard, still paints
    const inner = radius - Math.max(feather, 0);
    return Math.max(0, Math.min(inner, radius - HARD_EDGE_PX));
  }

  /**
   * REVEAL-01 — how strongly a passed path point is still revealed.
   *
   * Weighted purely by how far behind the head the point sits, as a fraction
   * of the whole path, so the fade reads the same whatever the path's length
   * or point density. It is a pure function of position and never an
   * accumulated decay: the mask is rebuilt from scratch every frame, and that
   * rebuild is exactly what lets the reveal scrub backwards as well as
   * forwards.
   *
   * @param {number} pointIndex - Index of the path point being drawn
   * @param {number} headIndex - Fractional index of the head (totalPoints * progress)
   * @param {number} totalPoints - Number of points in the path
   * @param {number} revealTrail - Trail length as a % of the whole path.
   *   SPOTLIGHT_TRAIL_MAX is the sentinel for "never fades"; that rule lives
   *   here rather than in the caller so there is exactly one copy of it.
   * @returns {number} Alpha in 0..1; 0 means fully faded, skip the draw
   */
  static revealTrailAlpha(pointIndex, headIndex, totalPoints, revealTrail) {
    if (!(totalPoints > 0)) return 0;
    if (revealTrail >= MOTION.SPOTLIGHT_TRAIL_MAX) return 1;
    const trailFraction = revealTrail / 100;
    if (!(trailFraction > 0)) return 0;
    const behindFraction = (headIndex - pointIndex) / totalPoints;
    // A point at or ahead of the head is fully lit; nothing is "negatively"
    // behind, and clamping here keeps the caller free of edge handling.
    if (behindFraction <= 0) return 1;
    const alpha = 1 - (behindFraction / trailFraction);
    return alpha > 0 ? Math.min(alpha, 1) : 0;
  }

  /**
   * Convert linear slider value (0-1000) to log2 scaled value
   * Provides fine control at lower values, coarser at higher values
   * 
   * Formula: value = min * 2^(slider/1000 * log2(max/min))
   * 
   * @param {number} sliderValue - Linear slider position (0-1000)
   * @param {number} min - Minimum output value (must be > 0)
   * @param {number} max - Maximum output value
   * @returns {number} Log2 scaled value between min and max
   */
  static sliderToLog2Value(sliderValue, min, max) {
    if (sliderValue <= 0) return min;
    if (sliderValue >= 1000) return max;
    const normalized = sliderValue / 1000;
    const log2Range = Math.log2(max / min);
    return min * Math.pow(2, normalized * log2Range);
  }

  /**
   * Convert log2 scaled value back to linear slider position (0-1000)
   * 
   * @param {number} value - Log2 scaled value
   * @param {number} min - Minimum value (must be > 0)
   * @param {number} max - Maximum value
   * @returns {number} Linear slider position (0-1000)
   */
  static log2ValueToSlider(value, min, max) {
    if (value <= min) return 0;
    if (value >= max) return 1000;
    const log2Range = Math.log2(max / min);
    const normalized = Math.log2(value / min) / log2Range;
    return Math.round(normalized * 1000);
  }

  /**
   * Format a value for UI display
   * Values >= 10 are rounded UP to integers, values < 10 show 1 decimal place
   * 
   * @param {number} value - Value to format
   * @param {string} [suffix=''] - Optional suffix (e.g., '%', 's')
   * @returns {string} Formatted string
   */
  static formatUIValue(value, suffix = '') {
    const absValue = Math.abs(value);
    if (absValue >= 10) {
      // Round up for positive, round down (toward zero) for negative
      const rounded = value >= 0 ? Math.ceil(value) : Math.floor(value);
      return `${rounded}${suffix}`;
    }
    return `${value.toFixed(1)}${suffix}`;
  }

  /**
   * Convert bipolar slider (-1000 to 1000) to log2 scaled value (-max to max)
   * Has a dead zone at center (±50) that maps to exactly 0
   * Provides fine control near 0, coarser at extremes
   * 
   * @param {number} sliderValue - Slider position (-1000 to 1000)
   * @param {number} min - Minimum magnitude (must be > 0)
   * @param {number} max - Maximum magnitude
   * @returns {number} Log2 scaled value between -max and max, or 0
   */
  static bipolarSliderToLog2Value(sliderValue, min, max) {
    const DEAD_ZONE = 50; // ±50 slider units = 0 value
    if (Math.abs(sliderValue) <= DEAD_ZONE) return 0;
    
    const sign = sliderValue > 0 ? 1 : -1;
    // Remap slider from (DEAD_ZONE to 1000) to (0 to 1000)
    const absSlider = Math.abs(sliderValue) - DEAD_ZONE;
    const remapped = (absSlider / (1000 - DEAD_ZONE)) * 1000;
    const value = this.sliderToLog2Value(remapped, min, max);
    return sign * value;
  }

  /**
   * Convert log2 scaled bipolar value back to slider position (-1000 to 1000)
   * Accounts for dead zone at center
   * 
   * @param {number} value - Log2 scaled value (-max to max)
   * @param {number} min - Minimum magnitude (must be > 0)
   * @param {number} max - Maximum magnitude
   * @returns {number} Slider position (-1000 to 1000)
   */
  static bipolarLog2ValueToSlider(value, min, max) {
    const DEAD_ZONE = 50;
    if (value === 0) return 0;
    
    const sign = value > 0 ? 1 : -1;
    const absValue = Math.abs(value);
    const sliderPos = this.log2ValueToSlider(absValue, min, max);
    // Remap from (0 to 1000) back to (DEAD_ZONE to 1000)
    const remapped = (sliderPos / 1000) * (1000 - DEAD_ZONE) + DEAD_ZONE;
    return sign * remapped;
  }

  /**
   * Convert slider (0-1000) to angle using tan-based curve for perceptual smoothness
   * Uses approximation tan(x) ≈ x + x³/3 for smooth feel at small angles
   * 
   * The curve provides fine control at narrow angles (1-30°) where small changes
   * are perceptually significant, and coarser control at wide angles (90-180°)
   * 
   * @param {number} sliderValue - Slider position (0-1000)
   * @param {number} min - Minimum angle in degrees (e.g., 1)
   * @param {number} max - Maximum angle in degrees (e.g., 180)
   * @returns {number} Angle in degrees
   */
  static sliderToAngle(sliderValue, min, max) {
    if (sliderValue <= 0) return min;
    if (sliderValue >= 1000) return max;
    
    // Normalize slider to 0-1
    const t = sliderValue / 1000;
    
    // Apply tan-based curve: f(t) = t + t³/3
    // This gives more resolution at lower values (narrow angles)
    const curved = t + (t * t * t) / 3;
    
    // Normalize the curve output (at t=1, curved = 1 + 1/3 = 4/3)
    const maxCurved = 1 + 1/3;
    const normalized = curved / maxCurved;
    
    // Map to angle range
    return min + normalized * (max - min);
  }

  /**
   * Convert angle back to slider position (0-1000)
   * Inverse of sliderToAngle
   * 
   * @param {number} angle - Angle in degrees
   * @param {number} min - Minimum angle in degrees
   * @param {number} max - Maximum angle in degrees
   * @returns {number} Slider position (0-1000)
   */
  static angleToSlider(angle, min, max) {
    if (angle <= min) return 0;
    if (angle >= max) return 1000;
    
    // Normalize angle to 0-1 in curved space
    const maxCurved = 1 + 1/3;
    const normalized = (angle - min) / (max - min);
    const curved = normalized * maxCurved;
    
    // Solve t + t³/3 = curved for t using Newton-Raphson
    // f(t) = t + t³/3 - curved
    // f'(t) = 1 + t²
    let t = normalized; // Initial guess
    for (let i = 0; i < 5; i++) {
      const f = t + (t * t * t) / 3 - curved;
      const fPrime = 1 + t * t;
      t = t - f / fPrime;
    }
    
    // Clamp and convert to slider range
    t = Math.max(0, Math.min(1, t));
    return Math.round(t * 1000);
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.revealMaskCanvas = null;
    this.revealMaskCtx = null;
  }
}
