/**
 * PlayerCore - pure timeline mathematics for the deterministic animation core.
 *
 * The deterministic-timeline mandate (decision-log 2026-08-17): the scene is a
 * pure function of (timelineMs, projectState, seed). PlayerCore is where that
 * function lives. It builds an immutable timeline description from project
 * state (segment timing, pause windows, beacon schedules) and evaluates any
 * timeline instant against it — with no wall-clock reads, no accumulation, and
 * no mutation of the timeline during evaluation.
 *
 * AnimationEngine owns playback state (current time, playing/paused) and event
 * emission; play advances time, scrub sets time, export steps time — all three
 * resolve frames through the same functions in this module, which is what
 * makes them agree by construction.
 *
 * Grow-beacon pauses are EXACT here: the same early-onset window feeds both
 * the pause duration and the beacon schedule, so the beacon always completes
 * inside its precomputed pause and the v2 "dynamically extend the pause while
 * the beacon is still animating" mutation is gone entirely.
 *
 * Marker shapes match the pre-PlayerCore engine fields verbatim — the HTML
 * export player (HTMLExportService) serialises `segments`/`pauses` as
 * `segmentMarkers`/`pauseMarkers` and replays them with its own copy of this
 * mapping (unified in Phase 5).
 */

import { BEACON_TIMING } from '../services/BeaconRenderer.js';

/** Fixed hold at grow peak, matching GrowBeacon's internal hold (ms). */
const GROW_HOLD_MS = 1000;
/** Visual settle margin after a grow scale-down completes (ms). */
const GROW_PAUSE_BUFFER_MS = 750;
/** Margin after the last ripple ring fades (ms). */
const RIPPLE_PAUSE_BUFFER_MS = 500;
/** Margin after a pulse cycle for a smooth exit (ms). */
const PULSE_PAUSE_BUFFER_MS = 500;
/** Early-onset lead for grow beacons: the full grow-up animation (ms). */
const GROW_EARLY_ONSET_MS = BEACON_TIMING.GROW_SCALE_UP_DURATION * 1000;
/** Early-onset lead for pop/pulse beacons under hide-before (ms). */
const SCALE_BEACON_EARLY_ONSET_MS = 250;

export const PlayerCore = {
  /**
   * Build segment timing markers for variable-speed playback.
   *
   * @param {Array<number>} segmentLengths - Length of each major leg in pixels
   * @param {Array<number>} waypointProgressValues - Path progress (0-1) per major waypoint
   * @param {Array} waypoints - Major waypoints carrying segmentSpeed
   * @param {number} baseSpeed - Base speed in px/s
   * @returns {{segments: Array, hasVariableSpeed: boolean, pathDuration: number}}
   */
  buildSegments(segmentLengths, waypointProgressValues, waypoints, baseSpeed) {
    const segments = [];
    let hasVariableSpeed = false;

    if (!segmentLengths || segmentLengths.length === 0 ||
        !waypointProgressValues || waypointProgressValues.length < 2 ||
        !waypoints || waypoints.length < 2) {
      return { segments, hasVariableSpeed, pathDuration: 0 };
    }

    let cumulativePathTime = 0;
    for (let i = 0; i < segmentLengths.length; i++) {
      const segmentSpeed = waypoints[i]?.segmentSpeed || 1.0;
      if (segmentSpeed !== 1.0) hasVariableSpeed = true;

      // Duration = length / (baseSpeed * segmentSpeed); >1 = faster leg
      const duration = (segmentLengths[i] / (baseSpeed * segmentSpeed)) * 1000;
      segments.push({
        startPathProgress: waypointProgressValues[i],
        endPathProgress: waypointProgressValues[i + 1],
        startPathTime: cumulativePathTime,
        endPathTime: cumulativePathTime + duration,
        segmentSpeed,
        duration,
        waypointIndex: i,
      });
      cumulativePathTime += duration;
    }

    return { segments, hasVariableSpeed, pathDuration: cumulativePathTime };
  },

  /**
   * Convert path time (ms, pauses excluded) to path progress (0-1).
   * Non-linear when segments carry speed multipliers.
   */
  pathTimeToProgress(pathTime, segments, pathDuration, hasVariableSpeed) {
    if (pathTime <= 0) return 0;
    if (pathTime >= pathDuration) return 1;

    if (!hasVariableSpeed || segments.length === 0) {
      const progress = pathDuration > 0 ? pathTime / pathDuration : 0;
      return Math.max(0, Math.min(1, progress));
    }

    // Linear search: typical paths have 2-10 legs
    let segment = segments[0];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (pathTime >= s.startPathTime && pathTime < s.endPathTime) {
        segment = s;
        break;
      }
      if (pathTime >= s.endPathTime) segment = s;
    }

    if (pathTime >= segment.endPathTime) return segment.endPathProgress;

    const timeInSegment = Math.max(0, pathTime - segment.startPathTime);
    const fraction = segment.duration > 0 ? timeInSegment / segment.duration : 0;
    const clamped = Math.max(0, Math.min(1, fraction));
    return segment.startPathProgress + clamped * (segment.endPathProgress - segment.startPathProgress);
  },

  /**
   * Convert path progress (0-1) to path time (ms, pauses excluded).
   * Inverse of pathTimeToProgress.
   */
  pathProgressToTime(pathProgress, segments, pathDuration, hasVariableSpeed) {
    if (!hasVariableSpeed || segments.length === 0) {
      return pathProgress * pathDuration;
    }
    if (pathProgress <= 0) return 0;
    if (pathProgress >= 1) return pathDuration;

    let segment = segments[0];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (pathProgress >= s.startPathProgress && pathProgress < s.endPathProgress) {
        segment = s;
        break;
      }
      if (pathProgress >= s.endPathProgress) segment = s;
    }

    if (pathProgress >= segment.endPathProgress) return segment.endPathTime;

    const progressInSegment = Math.max(0, pathProgress - segment.startPathProgress);
    const range = segment.endPathProgress - segment.startPathProgress;
    const fraction = range > 0 ? progressInSegment / range : 0;
    return segment.startPathTime + Math.max(0, Math.min(1, fraction)) * segment.duration;
  },

  /**
   * How early a beacon's clock starts before its waypoint arrival (ms).
   *
   * One formula for both the pause budget and the beacon schedule — this
   * single source of truth is what lets grow pauses be exact instead of
   * runtime-extended. The lead is capped so the beacon never starts before
   * the path start or before the midpoint back to the previous major.
   *
   * @param {string} style - Beacon style
   * @param {number} arrivalPathTime - Path time (ms) at the beacon's waypoint
   * @param {number} prevMajorPathTime - Path time (ms) at the previous major (0 if none)
   * @returns {number} Early-onset lead in ms (0 for overlay beacons)
   */
  beaconEarlyOnsetMs(style, arrivalPathTime, prevMajorPathTime) {
    const target = style === 'grow' ? GROW_EARLY_ONSET_MS
      : (style === 'pop' || style === 'pulse') ? SCALE_BEACON_EARLY_ONSET_MS
      : 0;
    if (target <= 0) return 0;
    const gap = Math.max(0, arrivalPathTime - Math.max(0, prevMajorPathTime));
    return Math.max(0, Math.min(target, gap / 2, arrivalPathTime));
  },

  /**
   * Effective pause duration for a waypoint (ms), beacon minimums included.
   *
   * Grow: remaining grow-up (after early onset) + hold + scale-down + buffer —
   * exact, so the runtime never needs to extend it.
   * Ripple: all rings spawn and fade (scales with rippleMaxScale) + buffer.
   * Pulse: at least one full cycle + buffer.
   *
   * @returns {number} Duration in ms (0 = no pause)
   */
  effectivePauseDuration(wp, earlyOnsetMs) {
    const T = BEACON_TIMING;
    let duration = (wp.pauseMode === 'timed' && wp.pauseTime > 0) ? wp.pauseTime : 0;

    if (wp.beaconStyle === 'grow') {
      const remainingGrowUp = Math.max(0, GROW_EARLY_ONSET_MS - earlyOnsetMs);
      const scaleDownMs = T.GROW_SCALE_DOWN_DURATION * 1000;
      duration = remainingGrowUp + GROW_HOLD_MS + scaleDownMs + GROW_PAUSE_BUFFER_MS;
    }

    if (wp.beaconStyle === 'ripple') {
      const maxScale = wp.rippleMaxScale || wp.beaconScale || 1000;
      const perRingSec = T.RIPPLE_BASE_DURATION * (maxScale / T.RIPPLE_REFERENCE_SCALE);
      const minMs = perRingSec * T.RIPPLE_COUNT * 1000 + RIPPLE_PAUSE_BUFFER_MS;
      duration = Math.max(duration, minMs);
    }

    if (wp.beaconStyle === 'pulse') {
      const cycleSec = wp.pulseCycleSpeed || T.PULSE_CYCLE_DURATION;
      duration = Math.max(duration, cycleSec * 1000 + PULSE_PAUSE_BUFFER_MS);
    }

    return duration;
  },

  /**
   * Build pause markers with absolute timeline times (ms, post-start-handle).
   *
   * Shape matches the legacy AnimationEngine.pauseMarkers exactly (the HTML
   * export serialises these). Pause at 0% is skipped (nothing would move);
   * a pause at 100% is honoured for beacon completion.
   *
   * @returns {{pauses: Array, totalPauseTime: number}}
   */
  buildPauses(waypoints, pathDuration, waypointProgressValues, introAnimationMs, segments, hasVariableSpeed) {
    const pauses = [];
    let totalPauseTime = 0;

    if (!waypoints || waypoints.length < 2 || pathDuration <= 0) {
      return { pauses, totalPauseTime };
    }

    const totalSegments = waypoints.length - 1;
    const raw = [];

    // Optional intro pause at the very start (reveal-mode cone growth)
    if (introAnimationMs > 0) {
      raw.push({
        pathProgress: 0,
        duration: introAnimationMs,
        originalPauseTime: introAnimationMs,
        waypointIndex: 0,
        waypoint: waypoints[0],
        isIntroAnimation: true,
      });
      totalPauseTime += introAnimationMs;
    }

    const progressAt = (i) =>
      (waypointProgressValues && waypointProgressValues[i] !== undefined)
        ? waypointProgressValues[i]
        : i / totalSegments;

    // Previous MAJOR arrival path-time, tracked for early-onset constraints
    let prevMajorPathTime = 0;

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const pathProgress = progressAt(i);
      const arrivalPathTime = this.pathProgressToTime(pathProgress, segments, pathDuration, hasVariableSpeed);

      const hasExplicitPause = wp.pauseMode === 'timed' && wp.pauseTime > 0;
      const isLastWaypoint = pathProgress >= 0.999;
      const needsBeaconPause = wp.beaconStyle === 'ripple' || wp.beaconStyle === 'pulse' ||
        (isLastWaypoint && wp.beaconStyle === 'grow');

      const isMajor = wp.isMajor !== false;
      const currentPrevMajorPathTime = prevMajorPathTime;
      if (isMajor) prevMajorPathTime = arrivalPathTime;

      if (!hasExplicitPause && !needsBeaconPause) continue;
      // A pause at the very start means nothing moves — skip
      if (pathProgress <= 0.001) continue;

      const earlyOnsetMs = this.beaconEarlyOnsetMs(wp.beaconStyle, arrivalPathTime, currentPrevMajorPathTime);
      const duration = this.effectivePauseDuration(wp, earlyOnsetMs);
      if (duration <= 0) continue;

      raw.push({
        pathProgress,
        duration,
        originalPauseTime: wp.pauseTime,
        waypointIndex: i,
        waypoint: wp,
      });
      totalPauseTime += duration;
    }

    raw.sort((a, b) => a.pathProgress - b.pathProgress);

    // Absolute timeline times: arrival path time plus pauses already passed
    let accumulated = 0;
    for (const marker of raw) {
      const pathTimeAtWaypoint = this.pathProgressToTime(marker.pathProgress, segments, pathDuration, hasVariableSpeed);
      const timelineStartMs = pathTimeAtWaypoint + accumulated;
      pauses.push({
        pathProgress: marker.pathProgress,
        timelineStartMs,
        timelineEndMs: timelineStartMs + marker.duration,
        duration: marker.duration,
        originalPauseTime: marker.originalPauseTime,
        waypointIndex: marker.waypointIndex,
        waypoint: marker.waypoint,
        ...(marker.isIntroAnimation ? { isIntroAnimation: true } : {}),
      });
      accumulated += marker.duration;
    }

    return { pauses, totalPauseTime };
  },

  /**
   * Build per-beacon clock schedules: when each beacon's animation clock
   * starts and how its hold window sits on the (post-start-handle) timeline.
   *
   * Every value is derived from the same pause/segment data the path mapping
   * uses, which is what makes beacon phases a closed-form function of
   * timeline time.
   *
   * @returns {Array<{waypointIndex, waypointId, style, arrivalMs, holdEndMs,
   *                  earlyOnsetMs, earlyOnsetStartMs, pauseDurationMs, originalPauseTime}>}
   */
  buildBeaconSchedules(waypoints, waypointProgressValues, pauses, segments, pathDuration, hasVariableSpeed) {
    const schedules = [];
    if (!waypoints || waypoints.length === 0) return schedules;

    const totalSegments = Math.max(1, waypoints.length - 1);
    const progressAt = (i) =>
      (waypointProgressValues && waypointProgressValues[i] !== undefined)
        ? waypointProgressValues[i]
        : i / totalSegments;

    let prevMajorPathTime = 0;
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const isMajor = wp.isMajor !== false;
      const pathProgress = progressAt(i);
      const arrivalPathTime = this.pathProgressToTime(pathProgress, segments, pathDuration, hasVariableSpeed);
      const currentPrevMajorPathTime = prevMajorPathTime;
      if (isMajor) prevMajorPathTime = arrivalPathTime;

      if (!isMajor) continue;
      const style = wp.beaconStyle || 'none';
      if (style === 'none') continue;

      // Pauses strictly before this waypoint shift its arrival on the timeline;
      // its own pause (same waypointIndex) starts AT arrival.
      let pausesBefore = 0;
      let ownPause = 0;
      for (const p of pauses) {
        if (p.waypointIndex === i && !p.isIntroAnimation) {
          ownPause = p.duration;
        } else if (p.pathProgress < pathProgress || p.isIntroAnimation) {
          pausesBefore += p.duration;
        }
      }

      const arrivalMs = arrivalPathTime + pausesBefore;
      const earlyOnsetMs = this.beaconEarlyOnsetMs(style, arrivalPathTime, currentPrevMajorPathTime);

      schedules.push({
        waypointIndex: i,
        waypointId: wp.id,
        style,
        arrivalMs,
        holdEndMs: arrivalMs + ownPause,
        earlyOnsetMs,
        // The early window sits inside a pause-free span (capped at the
        // half-gap to the previous major), so path-time lead == timeline lead.
        earlyOnsetStartMs: arrivalMs - earlyOnsetMs,
        pauseDurationMs: ownPause,
        originalPauseTime: wp.pauseTime || 0,
      });
    }

    return schedules;
  },

  /**
   * Map a raw timeline time (ms, includes start handle) to scene time state.
   *
   * Pure: no events, no mutation, no beacon consultation — the exact same
   * result for the same inputs whether reached by playing, scrubbing,
   * stepping backwards, or exporting.
   *
   * @param {number} timelineMs - Raw timeline time in ms (0..durationMs)
   * @param {Object} tl - Timeline: {segments, hasVariableSpeed, pathDuration,
   *                      totalPauseTime, pauses}
   * @param {Object} live - {durationMs, startHandleMs, introMs, totalTailMs, endHandleMs}
   * @returns {{pathProgress: number, waitingIndex: number, waitElapsedMs: number,
   *            waitTotalMs: number, waitPathProgress: number, adjustedMs: number,
   *            inStartHandle: boolean, inIntro: boolean, inTail: boolean,
   *            inEndHandle: boolean, complete: boolean}}
   */
  timelineToPath(timelineMs, tl, live) {
    const none = {
      waitingIndex: -1, waitElapsedMs: 0, waitTotalMs: 0, waitPathProgress: 0,
      inStartHandle: false, inIntro: false, inTail: false, inEndHandle: false,
      complete: false,
    };
    const { durationMs, startHandleMs, introMs, totalTailMs, endHandleMs } = live;

    // Fast path: plain linear timeline
    if ((tl.pauses.length === 0 || tl.totalPauseTime === 0) &&
        !tl.hasVariableSpeed && totalTailMs === 0 &&
        startHandleMs === 0 && endHandleMs === 0 && introMs === 0) {
      const progress = durationMs > 0 ? timelineMs / durationMs : 0;
      return { ...none, pathProgress: Math.max(0, Math.min(1, progress)), adjustedMs: timelineMs, complete: progress >= 1 };
    }

    if (tl.pathDuration <= 0) {
      const progress = durationMs > 0 ? timelineMs / durationMs : 0;
      return { ...none, pathProgress: Math.max(0, Math.min(1, progress)), adjustedMs: timelineMs, complete: progress >= 1 };
    }

    if (durationMs > 0 && timelineMs >= durationMs) {
      return { ...none, pathProgress: 1, adjustedMs: timelineMs - startHandleMs - introMs, complete: true };
    }

    if (startHandleMs > 0 && timelineMs < startHandleMs) {
      return { ...none, pathProgress: 0, adjustedMs: 0, inStartHandle: true };
    }
    let adjustedMs = timelineMs - startHandleMs;

    if (introMs > 0 && adjustedMs < introMs) {
      return { ...none, pathProgress: 0, adjustedMs: 0, inIntro: true };
    }
    adjustedMs -= introMs;

    const tailStart = tl.pathDuration + tl.totalPauseTime;
    if (totalTailMs > 0 && adjustedMs >= tailStart) {
      const inEnd = endHandleMs > 0 && adjustedMs >= tailStart + totalTailMs;
      return { ...none, pathProgress: 1, adjustedMs, inTail: !inEnd, inEndHandle: inEnd };
    }
    if (endHandleMs > 0 && adjustedMs >= tailStart + totalTailMs) {
      return { ...none, pathProgress: 1, adjustedMs, inEndHandle: true };
    }

    // Scan pause windows (sorted by time); [start, end) is "waiting"
    let accumulatedPauseTime = 0;
    for (const marker of tl.pauses) {
      if (adjustedMs < marker.timelineStartMs) break;
      if (adjustedMs < marker.timelineEndMs) {
        return {
          ...none,
          pathProgress: marker.pathProgress,
          waitingIndex: marker.waypointIndex,
          waitElapsedMs: adjustedMs - marker.timelineStartMs,
          waitTotalMs: marker.duration,
          waitPathProgress: marker.pathProgress,
          adjustedMs,
        };
      }
      accumulatedPauseTime += marker.duration;
    }

    const pathTime = adjustedMs - accumulatedPauseTime;
    const pathProgress = this.pathTimeToProgress(pathTime, tl.segments, tl.pathDuration, tl.hasVariableSpeed);
    return { ...none, pathProgress: Math.max(0, Math.min(1, pathProgress)), adjustedMs };
  },

  /**
   * Map path progress (0-1) back to timeline progress (0-1).
   * Inverse of timelineToPath for the path-travel region. A pause AT the
   * given position counts as already elapsed (matching the legacy engine),
   * so seeking to a waypoint's progress lands just after its wait.
   *
   * Unlike the legacy version this includes the start-handle and intro
   * offsets, making it a true inverse of timelineToPath under export
   * handles and reveal-mode intros.
   */
  pathToTimelineProgress(pathProgress, tl, live) {
    const { durationMs, startHandleMs, introMs } = live;
    if ((tl.pauses.length === 0 || tl.totalPauseTime === 0) && !tl.hasVariableSpeed &&
        startHandleMs === 0 && introMs === 0) {
      return pathProgress;
    }
    if (tl.pathDuration <= 0) return pathProgress;

    const pathTime = this.pathProgressToTime(pathProgress, tl.segments, tl.pathDuration, tl.hasVariableSpeed);

    let accumulated = 0;
    for (const marker of tl.pauses) {
      const markerPathTime = this.pathProgressToTime(marker.pathProgress, tl.segments, tl.pathDuration, tl.hasVariableSpeed);
      if (pathTime >= markerPathTime) {
        accumulated += marker.duration;
      } else {
        break;
      }
    }

    const timelineMs = startHandleMs + introMs + pathTime + accumulated;
    return Math.max(0, Math.min(1, durationMs > 0 ? timelineMs / durationMs : 0));
  },
};
