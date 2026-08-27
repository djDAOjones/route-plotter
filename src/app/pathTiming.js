/**
 * Path calculation + timeline duration: spline recalc, easing, segment/leg timing, duration updates.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, pathTimingMixin).
 */
import { Easing } from '../utils/Easing.js';
import { ANIMATION, PATH_VISIBILITY } from '../config/constants.js';
import { MotionVisibilityService } from '../services/MotionVisibilityService.js';
import { CameraService } from '../services/CameraService.js';
import { resolveRouteBranches, branchPathWaypoints, trunkWaypoints } from '../utils/routeBranches.js';
import { composeRouteTimeline } from '../utils/branchTiming.js';
import { resolveGraphAnchors } from '../utils/routeAnchors.js';

/**
 * The waypoints `pathPoints` was built from — `waypoints` itself on a linear
 * route, the trunk once the route has been split (ROUTE-01b).
 *
 * A module helper rather than a mixin method because PlayerApp borrows only
 * part of this mixin: a `routeOf(this)` call would be undefined there.
 * @param {Object} app RoutePlotter or PlayerApp
 * @returns {Array<Object>}
 */
function routeOf(app) {
  if (app._trunkWaypoints && app._trunkWaypoints.length) return app._trunkWaypoints;
  return trunkWaypoints(app.waypoints || []);
}

/**
 * Tell the author when a crowd binding breaks — once per change, not once per
 * path rebuild, which runs on every drag frame. The node keeps its binding and
 * falls back to where it was authored; this is the "explicit fallback and
 * author-visible warning" half of that rule (COMPOSE-01).
 *
 * @param {Object} app RoutePlotter
 * @param {{broken: Array}} report
 */
function announceBrokenAnchors(app, report) {
  const signature = report.broken.map(item => `${item.layerId}:${item.nodeId}`).sort().join('|');
  if (signature === app._lastBrokenAnchorSignature) return;
  app._lastBrokenAnchorSignature = signature;
  if (report.broken.length === 0) return;

  const layers = [...new Set(report.broken.map(item => item.layerName))];
  const subject = report.broken.length === 1
    ? 'A crowd node'
    : `${report.broken.length} crowd nodes`;
  app.eventBus?.emit?.('ui:toast', {
    message: `${subject} lost the waypoint it followed (${layers.join(', ')}) — back at its own position`
  });
  app.announce?.(`${subject} lost the waypoint it followed and is back at its own position.`);
}

/**
 * Each waypoint's effective wait, read off the legs' own pause markers so a
 * beacon's early-onset budget is included exactly as the timeline sees it.
 * @param {Object} legsById
 * @returns {Object<string, number>}
 */
function pauseMsByWaypoint(legsById = {}) {
  const waits = {};
  for (const leg of Object.values(legsById)) {
    for (const pause of leg?.timeline?.pauses || []) {
      const id = pause.waypoint?.id;
      if (id === undefined) continue;
      waits[id] = (waits[id] || 0) + pause.duration;
    }
  }
  return waits;
}

/** The subset of a waypoint PathCalculator needs to build a spline. */
const splineInput = wp => ({
  x: wp.imgX,
  y: wp.imgY,
  isMajor: wp.isMajor,
  pathShape: wp.pathShape,
  shapeAmplitude: wp.shapeAmplitude,
  shapeFrequency: wp.shapeFrequency,
});

export const pathTimingMixin = {
  
  calculatePath() {
    // Synchronous path generation on the main thread. The former async Web
    // Worker path was removed: it never initialised under the esbuild build
    // (import.meta.url resolved invalid for the legacy browser targets), so the
    // main-thread corner-slowing calculator was always the real code path.
    // pathPoints is reassigned atomically below, so we never expose an empty
    // array mid-update.
    
    // Invalidate cached waypoint progress; it is recalculated on next access.
    this._waypointProgressCache = null;
    this.routeStructure = resolveRouteBranches(this.waypoints);
    this.branchPaths = [];
    this.branchTimeline = null;

    // Rebind anchored crowd nodes: the graph follows the route, so a moved or
    // deleted waypoint must update bound evaluation on the same pass that
    // rebuilt the geometry (COMPOSE-01). Ahead of the early returns below —
    // deleting a route down to one waypoint breaks every binding, and that is
    // exactly when a stale resolution would be worst.
    this.anchorReport = resolveGraphAnchors(this.scene, this.waypointsById);
    announceBrokenAnchors(this, this.anchorReport);

    if (this.waypoints.length < 2) {
      this.pathPoints = [];
      return;
    }

    // The trunk owns `pathPoints` and the AnimationEngine's transport. On a
    // linear route trunkWaypoints() returns the same array, so nothing about
    // an unsplit project changes (ROUTE-01b).
    const trunkRoute = trunkWaypoints(this.waypoints);
    if (trunkRoute.length < 2) {
      this.pathPoints = [];
      return;
    }

    // Use normalized image coordinates (0-1) for path calculation
    // Path points will be transformed to canvas coords during rendering via imageToCanvas
    // Note: Don't spread wp as Waypoint class may have getters that don't spread correctly
    // Just pass the essential properties needed by PathCalculator
    const normalizedWaypoints = trunkRoute.map(splineInput);

    this.pathPoints = this.pathCalculator.calculatePath(normalizedWaypoints);
    this._trunkWaypoints = trunkRoute;

    // Each branch gets its own spline, anchored at its fork (and rejoin) so it
    // visibly meets the trunk at both ends.
    for (const branch of this.routeStructure.branches) {
      const runWaypoints = branchPathWaypoints(this.routeStructure, branch.id, this.waypoints);
      if (runWaypoints.length < 2) continue;
      const pathPoints = this.pathCalculator.calculatePath(runWaypoints.map(splineInput));
      this.branchPaths.push({
        id: branch.id,
        waypoints: runWaypoints,
        anchorIds: [branch.forkFromId, branch.rejoinAtId].filter(Boolean),
        forkFromId: branch.forkFromId,
        rejoinAtId: branch.rejoinAtId,
        pathPoints,
        progressValues: pathPoints.length
          ? this.pathCalculator.calculateWaypointProgress(
              pathPoints, runWaypoints.map(wp => ({ x: wp.imgX, y: wp.imgY }))
            )
          : [],
      });
    }
    
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
  },
  
  /**
   * Get positions of major waypoints as normalized progress values (0-1)
   * Performance optimization: Results are cached and only recalculated when waypoints change
   * Reduces ~99% of waypoint position calculations (was every frame → once per change)
   */
  getMajorWaypointPositions() {
    const route = routeOf(this);
    if (route.length < 2) return [];
    
    // Return cached result if available (99% of calls hit cache)
    if (this._majorWaypointsCache) {
      return this._majorWaypointsCache;
    }
    
    // Calculate fresh (only when waypoints change)
    const majorWaypoints = [];
    let totalSegments = route.length - 1;
    
    for (let i = 0; i < route.length; i++) {
      if (route[i].isMajor) {
        // Calculate position as progress (0-1) along the path
        const progress = i / totalSegments;
        majorWaypoints.push({ 
          index: i, 
          progress: progress,
          waypoint: route[i]
        });
      }
    }
    
    // Cache the result for subsequent calls
    this._majorWaypointsCache = majorWaypoints;
    return majorWaypoints;
  },
  
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
  },
  
  // Find which segment of the path we're currently in based on progress
  findSegmentIndexForProgress(progress) {
    const route = routeOf(this);
    if (route.length < 2) return -1;
    
    const totalSegments = route.length - 1;
    // Clamp progress between 0 and 1
    const clampedProgress = Math.max(0, Math.min(1, progress));
    
    // Convert progress to segment index
    const segmentPosition = clampedProgress * totalSegments;
    const segmentIndex = Math.floor(segmentPosition);
    
    return Math.min(segmentIndex, totalSegments - 1);
  },
  
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
  /**
   * Compose the branched master timeline from current geometry (ROUTE-01b).
   *
   * Derived data, cached per path recalculation. Returns null on a linear
   * route so every existing caller keeps its single-transport fast path — the
   * AnimationEngine remains the sole authority for an unsplit project.
   *
   * @returns {Object|null} Composed timeline plus `legsById`, or null
   */
  getBranchTimeline() {
    if (!this.routeStructure || this.routeStructure.isLinear) return null;
    // Cached per path recalculation AND per base speed: the composition is a
    // function of both, and a stale cache would report a branch's duration at
    // the previous speed.
    const baseSpeedNow = this.animationEngine?.state?.speed || ANIMATION.DEFAULT_SPEED;
    if (this.branchTimeline && this._branchTimelineSpeed === baseSpeedNow) {
      return this.branchTimeline;
    }
    if (!this.branchPaths || this.branchPaths.length === 0) return null;

    const baseSpeed = baseSpeedNow;
    const lengthOf = points => this.pathCalculator.calculatePathLength(
      points.map(point => this.imageToCanvas(point.x, point.y))
    );

    const trunkProgress = this.getWaypointProgressValues();
    if (!trunkProgress) return null;

    const runs = [{
      id: null,
      waypoints: routeOf(this),
      progressValues: trunkProgress,
      pathLengthPx: lengthOf(this.pathPoints),
      forkFromId: null,
      rejoinAtId: null,
    }];

    for (const branch of this.branchPaths) {
      if (!branch.pathPoints || branch.pathPoints.length === 0) continue;
      runs.push({
        id: branch.id,
        waypoints: branch.waypoints,
        progressValues: branch.progressValues,
        pathLengthPx: lengthOf(branch.pathPoints),
        forkFromId: branch.forkFromId,
        rejoinAtId: branch.rejoinAtId,
        anchorIds: branch.anchorIds,
      });
    }

    this.branchTimeline = composeRouteTimeline(runs, baseSpeed);
    this._branchTimelineSpeed = baseSpeed;
    return this.branchTimeline;
  },

  /**
   * Master-time arrival of every waypoint, plus each one's effective wait and
   * the route's completion time (COMPOSE-01).
   *
   * Works for any route: a branched one reads the composed timeline, a linear
   * one composes its single trunk leg through the same routine, so a bound
   * crowd reads the same arithmetic either way. Route timing never depends on
   * this — it is computed from the route and read by the crowd, one way only.
   *
   * @returns {{arrivalMsById: Object<string, number>,
   *            pauseMsById: Object<string, number>,
   *            totalDurationMs: number}|null}
   */
  getRouteArrivalMap() {
    const branched = this.getBranchTimeline?.();
    if (branched) {
      return {
        arrivalMsById: branched.arrivalMsById,
        pauseMsById: pauseMsByWaypoint(branched.legsById),
        totalDurationMs: branched.totalDurationMs,
      };
    }

    const route = routeOf(this);
    const progressValues = this.getWaypointProgressValues();
    if (route.length < 2 || !progressValues) return null;

    const baseSpeed = this.animationEngine?.state?.speed || ANIMATION.DEFAULT_SPEED;
    const canvasPathPoints = this.pathPoints.map(point => this.imageToCanvas(point.x, point.y));
    const composed = composeRouteTimeline([{
      id: null,
      waypoints: route,
      progressValues,
      pathLengthPx: this.pathCalculator.calculatePathLength(canvasPathPoints),
      forkFromId: null,
      rejoinAtId: null,
    }], baseSpeed);

    return {
      arrivalMsById: composed.arrivalMsById,
      pauseMsById: pauseMsByWaypoint(composed.legsById),
      totalDurationMs: composed.totalDurationMs,
    };
  },

  getWaypointProgressValues() {
    const route = routeOf(this);
    if (!this.pathPoints || this.pathPoints.length === 0 || route.length < 2) {
      return null;
    }
    
    // Return cached values if available (cache invalidated in calculatePath)
    if (this._waypointProgressCache) {
      return this._waypointProgressCache;
    }
    
    // Use normalized image coordinates (0-1) to match path points
    // Path points are stored in normalized coords, so waypoints must match
    const normalizedWaypoints = route.map(wp => ({
      x: wp.imgX,
      y: wp.imgY
    }));
    
    // Calculate and cache the result
    this._waypointProgressCache = this.pathCalculator.calculateWaypointProgress(this.pathPoints, normalizedWaypoints);
    return this._waypointProgressCache;
  },
  
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
      CameraService.toMajorKeyframes(routeOf(this), waypointProgress);
    if (majorWaypoints.length < 2) return null;
    
    // Progress-span timing basis (not summed pixel lengths) preserves
    // corner-slowing and keeps all-1.0x identical to the uniform path.
    const canvasPathPoints = this.pathPoints.map(p => this.imageToCanvas(p.x, p.y));
    const totalLength = this.pathCalculator.calculatePathLength(canvasPathPoints);
    const legTimingLengths = this.pathCalculator.legTimingLengths(majorProgress, totalLength);
    
    return { majorWaypoints, majorProgress, legTimingLengths };
  },
  
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
    return routeOf(this).some(wp =>
      wp.isMajor !== false && wp.segmentSpeed !== undefined && wp.segmentSpeed !== 1.0
    );
  },
  
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
    const route = routeOf(this);
    let currentLegSpeed = 1.0;
    for (let i = 0; i < waypointProgress.length - 1; i++) {
      const wp = route[i];
      if (wp && wp.isMajor !== false) {
        currentLegSpeed = wp.segmentSpeed ?? 1.0;
      }
      const spanLength = Math.max(0, waypointProgress[i + 1] - waypointProgress[i]) * totalLength;
      const effectiveSpeed = baseSpeed * currentLegSpeed;
      durations.push((spanLength / effectiveSpeed) * 1000); // Convert to ms
    }
    return durations;
  },
  
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
  },

  /**
   * Immediately rebuild every derived timeline field after a setting that
   * changes intro or comet-tail time. Clearing the path debounce prevents an
   * older scheduled calculation from overwriting the canonical result later.
   * @param {number|null} baseSpeed - Optional px/s override
   * @returns {number} Current total timeline duration in milliseconds
   */
  invalidateAnimationTiming(baseSpeed = null) {
    if (this._durationUpdateTimeout) {
      clearTimeout(this._durationUpdateTimeout);
      this._durationUpdateTimeout = null;
    }
    this.updateAnimationDuration(baseSpeed);
    return this.animationEngine.state.duration;
  },
  
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
   * @returns {number|undefined} Total timeline duration, or undefined when no path exists
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
    this.animationEngine.setPauseMarkers(routeOf(this), pathDuration, waypointProgress, 0); // No intro in pause markers
    totalDuration += this.animationEngine.totalPauseTime;
    
    // Set tail time for trail fade-out (preview mode only)
    // pathTrail is now a fraction (0-1) of the sequence
    // Tail time = trail duration (as fraction of path) + small handle.
    // The trail only renders in comet mode ('instantaneous'); gating on
    // pathTrail alone counted tail for every scene, so the duration
    // readout changed between edit and preview with identical data
    // (review 2026-08-18: the 8.6s vs 7.7s discrepancy).
    const isCometMode = this.motionSettings.pathVisibility === PATH_VISIBILITY.INSTANTANEOUS;
    if (this.previewMode && isCometMode) {
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
      // Edit mode or no trail rendering: no tail time needed
      this.animationEngine.clearTailTime();
    }
    
    // End handle time is only added during export (not in edit/preview mode)
    // This is handled by the export functions which add VIDEO_EXPORT.START_BUFFER_MS

    // A branch that outlives the trunk extends the timeline (ROUTE-01d).
    // Completion means every terminal endpoint is complete, so cutting the
    // route at the trunk's end would truncate a longer branch mid-animation.
    // The composed timeline is computed against the same base duration, so
    // handles, intro and tail still sit outside it exactly as before.
    // Optional call: a host that assembles only part of this mixin has no
    // branch data either, so linear behaviour is the correct degradation.
    const branchTimeline = this.getBranchTimeline?.();
    if (branchTimeline && branchTimeline.totalDurationMs > 0) {
      const branchTotal = branchTimeline.totalDurationMs
        + startHandleTime
        + this.animationEngine.introTime
        + this.animationEngine.totalTailTime;
      totalDuration = Math.max(totalDuration, branchTotal);
    }

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
    return finalDuration;
  },
  
  /**
   * Recalculate animation duration accounting for per-segment speed multipliers
   * @deprecated Use updateAnimationDuration() instead - kept for backwards compatibility
   */
  recalculateDurationWithSegmentSpeeds() {
    this.updateAnimationDuration();
  }
};
