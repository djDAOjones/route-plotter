/**
 * Per-run timing for a branched hero route (ROUTE-01b).
 *
 * Deliberately pure and deliberately separate from `AnimationEngine`. The
 * engine owns ONE authoritative transport — the trunk's — and that stays true:
 * branches never install segment markers, never touch engine state and never
 * read the clock. This module turns already-computed geometry into the leg
 * descriptions `PlayerCore.composeBranchTimeline` needs, and the composed
 * result is derived data the renderer reads.
 *
 * Keeping it out of the engine is what preserves the deterministic-timeline
 * mandate: the scene is still a pure function of (timelineMs, projectState,
 * seed), because every branch position is computed from master timeline time
 * rather than accumulated per branch.
 */

import { PlayerCore } from '../core/PlayerCore.js';

/**
 * Build one leg description from a run's geometry.
 *
 * Uses the same major-leg keyframing the trunk uses: minors bend the path but
 * never split a leg or act as a timing keyframe, and each leg carries its
 * opening major's `segmentSpeed`.
 *
 * @param {Object} run
 * @param {string|null} run.id Branch id; null for the trunk
 * @param {Array<Object>} run.waypoints Spline order, majors and minors
 * @param {Array<number>} run.progressValues Path progress (0-1) per waypoint
 * @param {number} run.pathLengthPx Total drawn length of this run, in canvas px
 * @param {string|null} [run.forkFromId]
 * @param {string|null} [run.rejoinAtId]
 * @param {boolean} [run.enabled=true]
 * @param {number} [run.introAnimationMs=0] Only the trunk ever has an intro
 * @param {number} baseSpeed px/s
 * @returns {{id, durationMs, forkFromId, rejoinAtId, enabled,
 *            arrivalOffsetsById: Object<string, number>,
 *            pathDurationMs: number, totalPauseMs: number}}
 */
export function buildRunLeg(run, baseSpeed) {
  const waypoints = Array.isArray(run.waypoints) ? run.waypoints : [];
  const progressValues = Array.isArray(run.progressValues) ? run.progressValues : [];
  const speed = baseSpeed > 0 ? baseSpeed : 1;
  const introAnimationMs = Math.max(0, Number(run.introAnimationMs) || 0);

  const empty = {
    id: run.id ?? null,
    durationMs: introAnimationMs,
    forkFromId: run.forkFromId ?? null,
    rejoinAtId: run.rejoinAtId ?? null,
    enabled: run.enabled !== false,
    arrivalOffsetsById: {},
    pathDurationMs: 0,
    totalPauseMs: introAnimationMs,
  };
  if (waypoints.length < 2 || progressValues.length !== waypoints.length) return empty;

  // Major keyframes and the leg lengths between them, as progress spans of the
  // run's own drawn length. Progress-span timing (not summed pixel lengths)
  // is what keeps corner-slowing and an all-1.0x route identical to uniform.
  const majorIndices = [];
  for (let index = 0; index < waypoints.length; index += 1) {
    if (waypoints[index]?.isMajor !== false) majorIndices.push(index);
  }
  if (majorIndices.length < 2) return empty;

  const majorWaypoints = majorIndices.map(index => waypoints[index]);
  const majorProgress = majorIndices.map(index => progressValues[index]);
  const pathLengthPx = Math.max(0, Number(run.pathLengthPx) || 0);
  const legLengths = [];
  for (let index = 0; index < majorProgress.length - 1; index += 1) {
    legLengths.push(Math.max(0, majorProgress[index + 1] - majorProgress[index]) * pathLengthPx);
  }

  const { segments, hasVariableSpeed, pathDuration } =
    PlayerCore.buildSegments(legLengths, majorProgress, majorWaypoints, speed);

  const { pauses, totalPauseTime } = PlayerCore.buildPauses(
    waypoints, pathDuration, progressValues, introAnimationMs, segments, hasVariableSpeed
  );

  // Arrival offset of every waypoint from this run's own start: its path time
  // plus the pauses that complete before it.
  const arrivalOffsetsById = {};
  for (let index = 0; index < waypoints.length; index += 1) {
    const waypoint = waypoints[index];
    if (!waypoint || waypoint.id === undefined) continue;
    const pathTime = PlayerCore.pathProgressToTime(
      progressValues[index], segments, pathDuration, hasVariableSpeed
    );
    let accumulated = 0;
    for (const pause of pauses) {
      const pausePathTime = PlayerCore.pathProgressToTime(
        pause.pathProgress, segments, pathDuration, hasVariableSpeed
      );
      if (pausePathTime < pathTime || pause.isIntroAnimation) accumulated += pause.duration;
    }
    // A branch's anchors (its fork and rejoin waypoints) belong to another
    // run, which owns their arrival. Recording them here would let a branch
    // overwrite the trunk's timing for a waypoint it merely touches.
    if (run.anchorIds && run.anchorIds.includes(waypoint.id)) continue;
    arrivalOffsetsById[waypoint.id] = pathTime + accumulated;
  }

  return {
    id: run.id ?? null,
    durationMs: pathDuration + totalPauseTime,
    forkFromId: run.forkFromId ?? null,
    rejoinAtId: run.rejoinAtId ?? null,
    enabled: run.enabled !== false,
    arrivalOffsetsById,
    pathDurationMs: pathDuration,
    totalPauseMs: totalPauseTime,
    // The run's own timeline, in exactly the shape PlayerCore.timelineToPath
    // consumes. Branches resolve their position through the same function the
    // trunk does, so an interleaved pause holds a branch head still for the
    // same reason and by the same arithmetic.
    timeline: {
      segments,
      pauses,
      pathDuration,
      totalPauseTime,
      hasVariableSpeed,
    },
  };
}

/**
 * Compose a whole branched route: build every run's leg, then place them on
 * the one master timeline.
 *
 * @param {Array<Object>} runs Trunk first (id null), then branches
 * @param {number} baseSpeed px/s
 * @returns {ReturnType<typeof PlayerCore.composeBranchTimeline> & {legsById: Object}}
 */
export function composeRouteTimeline(runs = [], baseSpeed = 1) {
  const legs = runs.map(run => buildRunLeg(run, baseSpeed));
  const composed = PlayerCore.composeBranchTimeline(legs);
  const legsById = {};
  for (const leg of legs) legsById[leg.id ?? '__trunk__'] = leg;
  return { ...composed, legsById };
}

/**
 * A branch's own path progress (0-1) at a master timeline instant.
 *
 * Before the fork the branch has not started, so it sits at 0; after it
 * finishes it holds at 1 — a branch that reached its end stays drawn there
 * rather than disappearing or looping.
 *
 * @param {number} timelineMs Master timeline time
 * @param {{startMs: number, endMs: number, durationMs: number}} placement
 * @param {{timeline: Object, pathDurationMs: number}} leg From buildRunLeg
 * @returns {number}
 */
export function branchPathProgressAt(timelineMs, placement, leg) {
  if (!placement || !leg || !leg.timeline) return 0;
  const local = timelineMs - placement.startMs;
  if (local <= 0) return 0;
  if (!(placement.durationMs > 0)) return 1;
  if (local >= placement.durationMs) return 1;

  const resolved = PlayerCore.timelineToPath(local, leg.timeline, {
    durationMs: placement.durationMs,
    startHandleMs: 0,
    introMs: 0,
    totalTailMs: 0,
    endHandleMs: 0,
  });
  return resolved.pathProgress;
}
