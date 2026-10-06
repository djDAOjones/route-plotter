/**
 * Where the scene ends (CROWD-05).
 *
 * The owner's rule, 2026-10-05: "all animations that do conclude should be
 * taken into account with the procedurally generated duration, so that
 * animations never end before any animation that will end does end."
 *
 * Two durations follow from it. The base timeline, B, is the duration as the
 * route composes it (path, start handle, intro, waits, the Preview comet tail,
 * the longest branch); everything timed as a fraction of the timeline (crowd
 * releases, route anchors, label fades, the camera's transitions) keeps
 * measuring against it, so nothing already authored moves. The playback
 * duration, F, is the latest of B and every end that comes after it:
 *
 * - crowds: the last Disappear or Collect dot to finish a journey that ends
 *   (`SwarmEngine.crowdFinishMs`). Respawn and Repeat journey never finish;
 *   a walk that runs out of hops round a loop has no end to wait for.
 * - beacons: the last instant any scheduled beacon is still changing, from
 *   the timing constants `BeaconRenderer` draws with (`beaconEndMs`).
 *
 * Not counted, because nothing about them concludes: labels and areas hold
 * at the end (their final fade never runs), spotlight and angle-of-view
 * reveals have no time tail, and the camera's last ease is per-frame
 * smoothing with no timeline end.
 *
 * Then the project's Hold at end (CROWD-06): the animation carries on for
 * that long after the last end, so F grows by exactly the hold and B does
 * not. Time keeps running through it, so a looping crowd keeps moving, while
 * the route head and everything that concluded show their final state.
 *
 * A pure function of (project state, B, seeds): the same answer in the
 * editor, on scrub, in a video export and in the HTML player.
 */

import { BEACON_TIMING } from '../services/BeaconRenderer.js';
import { ANIMATION, WAYPOINT_VISIBILITY } from '../config/constants.js';

/** GrowBeacon's fixed hold at peak scale (s), `GrowBeacon.HOLD_DURATION_SEC`. */
const GROW_HOLD_SEC = 1.0;
/** PulseBeacon's cycle when a waypoint sets none (s). */
const PULSE_DEFAULT_CYCLE_SEC = 4.0;

/**
 * Seconds after its clock starts that one beacon stops changing, mirroring
 * each beacon class's `sync`. Null for a style with no end.
 * @param {string} style
 * @param {Object} waypoint
 * @param {number} holdEndSec The pause window's end on the beacon's own clock
 * @param {{hidesBefore: boolean, hidesAfter: boolean}} visibility
 * @returns {number|null}
 */
function beaconSettlesSec(style, waypoint, holdEndSec, { hidesBefore, hidesAfter }) {
  const T = BEACON_TIMING;
  switch (style) {
    case 'ripple': {
      // RippleBeacon: rings one after another, each scaled by the max scale.
      const maxScale = waypoint.rippleMaxScale || 1000;
      return T.RIPPLE_COUNT * T.RIPPLE_BASE_DURATION * (maxScale / T.RIPPLE_REFERENCE_SCALE);
    }
    case 'glow':
      return T.GLOW_ONSET_DURATION + T.GLOW_FADE_DURATION;
    case 'pop': {
      // PopBeacon: the intro, then, only under hide-after, a wind-down from
      // the end of the pause window (or of the intro, if later).
      const introSec = T.POP_SCALE_UP_DURATION + T.POP_SCALE_DOWN_DURATION;
      if (!hidesAfter) return introSec;
      return Math.max(introSec, holdEndSec) + T.POP_SCALE_DOWN_DURATION;
    }
    case 'grow':
      // GrowBeacon: up, hold, down; then it rests at its end scale.
      return T.GROW_SCALE_UP_DURATION + GROW_HOLD_SEC + T.GROW_SCALE_DOWN_DURATION;
    case 'pulse': {
      // PulseBeacon: the onset, the loop to its first upward crossing of
      // 100% at or after the pause window ends, then, under hide-after, a
      // quarter-cycle fade.
      const cycle = waypoint.pulseCycleSpeed !== undefined ? waypoint.pulseCycleSpeed : PULSE_DEFAULT_CYCLE_SEC;
      const quarter = cycle / 4;
      const onsetSec = hidesBefore ? quarter * 2 : quarter;
      const holdEndLoopSec = Math.max(0, holdEndSec - onsetSec);
      const k = Math.max(0, Math.ceil((holdEndLoopSec - 0.75 * cycle) / cycle));
      return onsetSec + (k + 0.75) * cycle + (hidesAfter ? quarter : 0);
    }
    default:
      return null;
  }
}

/**
 * The last instant any scheduled beacon is still changing, on the raw
 * timeline, or 0 when there is none. Every major waypoint's beacon counts,
 * not only the last one's: a beacon whose waypoint the head leaves early can
 * still be changing when the route ends. Read whatever the viewer's reduced
 * motion setting, as a video export reads it, so the length is the project's.
 *
 * @param {Array} schedules `AnimationEngine.beaconSchedules` (pause-marker axis)
 * @param {Array} waypoints The project's waypoints (beacon settings by id)
 * @param {Object} [options]
 * @param {string|null} [options.waypointVisibility] The motion setting the
 *   beacons are drawn under: Preview's, or null in Edit, which applies none
 * @param {number} [options.offsetMs=0] Start handle plus reveal intro: where the
 *   pause-marker axis starts on the raw timeline
 * @returns {number}
 */
export function beaconEndMs(schedules = [], waypoints = [], { waypointVisibility = null, offsetMs = 0 } = {}) {
  // Waypoints hidden throughout draw no beacon (RenderingService's beacon layer).
  if (!schedules?.length || waypointVisibility === WAYPOINT_VISIBILITY.ALWAYS_HIDE) return 0;
  const visibility = {
    hidesBefore: waypointVisibility === WAYPOINT_VISIBILITY.HIDE_BEFORE
      || waypointVisibility === WAYPOINT_VISIBILITY.HIDE_BEFORE_AND_AFTER,
    hidesAfter: waypointVisibility === WAYPOINT_VISIBILITY.HIDE_AFTER
      || waypointVisibility === WAYPOINT_VISIBILITY.HIDE_BEFORE_AND_AFTER,
  };
  const byId = new Map((waypoints || []).map(waypoint => [waypoint.id, waypoint]));
  let latest = 0;
  for (const schedule of schedules) {
    const waypoint = byId.get(schedule.waypointId);
    if (!waypoint || !waypoint.isMajor) continue;
    // The clock BeaconRenderer.update starts the beacon on.
    const early = schedule.style === 'grow'
      || ((schedule.style === 'pop' || schedule.style === 'pulse') && visibility.hidesBefore);
    const clockStartMs = early ? schedule.earlyOnsetStartMs : schedule.arrivalMs;
    const holdEndSec = (schedule.holdEndMs - clockStartMs) / 1000;
    const settlesSec = beaconSettlesSec(schedule.style, waypoint, holdEndSec, visibility);
    if (settlesSec === null) continue;
    const endMs = offsetMs + clockStartMs + settlesSec * 1000;
    if (Number.isFinite(endMs) && endMs > latest) latest = endMs;
  }
  return latest;
}

/**
 * The Hold at end a project's styles ask for, in ms (CROWD-06): within the
 * control's 0–10 s, and none where the value is missing or not a number, as
 * in a project saved before the control existed.
 * @param {*} value `styles.holdAtEndMs`
 * @returns {number}
 */
export function resolveHoldAtEndMs(value) {
  const ms = Number(value);
  if (value === null || value === undefined || !Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(ms, ANIMATION.HOLD_AT_END_MAX_MS);
}

/**
 * @typedef {Object} SceneEndParts
 * @property {number} routeMs The base timeline, B
 * @property {number} crowdsMs When the last finishing crowd dot finishes, or 0
 * @property {number} beaconsMs When the last beacon stops changing, or 0
 * @property {number} holdMs The Hold at end after the last of those, or 0
 */

/**
 * The scene's end: the base timeline and every concluding end measured
 * against it. Journeys are walked by the swarm engine, which caches them;
 * releases are recomputed here from B on every call.
 *
 * @param {Object} input
 * @param {number} input.baseMs B
 * @param {Array} [input.layers] The scene's flow layers
 * @param {Object} [input.swarmEngine] Answers `crowdFinishMs(layer, context)`
 * @param {Object} [input.swarmContext] `{routePathPoints, routeAnchors}`, as rendering passes them
 * @param {Array} [input.beaconSchedules]
 * @param {Array} [input.waypoints]
 * @param {Object|null} [input.motionSettings] The settings beacons are drawn
 *   under: Preview's, or null in Edit
 * @param {number} [input.beaconOffsetMs=0]
 * @param {number} [input.holdMs=0] The Hold at end (`styles.holdAtEndMs`):
 *   added after the last end, never to B; nothing to hold when there is no end
 * @returns {{endMs: number, parts: SceneEndParts}}
 */
export function computeSceneEnd({
  baseMs,
  layers = [],
  swarmEngine = null,
  swarmContext = {},
  beaconSchedules = [],
  waypoints = [],
  motionSettings = null,
  beaconOffsetMs = 0,
  holdMs = 0,
}) {
  const routeMs = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : 0;
  let crowdsMs = 0;
  if (routeMs > 0 && swarmEngine) {
    const context = { ...swarmContext, durationMs: routeMs };
    for (const layer of layers) {
      // A hidden crowd is not drawn, so nothing of it is left to wait for.
      if (!layer?.visible) continue;
      crowdsMs = Math.max(crowdsMs, swarmEngine.crowdFinishMs(layer, context));
    }
  }
  const beaconsMs = routeMs > 0
    ? beaconEndMs(beaconSchedules, waypoints, {
      waypointVisibility: motionSettings?.waypointVisibility,
      offsetMs: beaconOffsetMs,
    })
    : 0;
  const concludesMs = Math.max(routeMs, crowdsMs, beaconsMs);
  const hold = concludesMs > 0 ? resolveHoldAtEndMs(holdMs) : 0;
  return {
    endMs: concludesMs + hold,
    parts: { routeMs, crowdsMs, beaconsMs, holdMs: hold },
  };
}

/** Seconds to one decimal, as the readout writes them. */
const seconds = ms => `${(ms / 1000).toFixed(1)} s`;

/**
 * The Duration readout's breakdown, e.g. "Ends at 18.5 s — route 12.0 s,
 * crowds finish +4.5 s, hold at end +2.0 s", or '' when the route alone sets
 * the end: the Duration value is then the full length and the line would
 * repeat it. Crowds and beacons are measured from the route's end; the hold
 * comes after the last of them, and is named as its control is.
 * @param {SceneEndParts|null} parts
 * @param {number} endMs F
 * @returns {string}
 */
export function describeSceneEnd(parts, endMs) {
  if (!parts || !(endMs > parts.routeMs)) return '';
  const past = [];
  if (parts.crowdsMs > parts.routeMs) past.push(`crowds finish +${seconds(parts.crowdsMs - parts.routeMs)}`);
  if (parts.beaconsMs > parts.routeMs) past.push(`beacon ends +${seconds(parts.beaconsMs - parts.routeMs)}`);
  if (parts.holdMs > 0) past.push(`hold at end +${seconds(parts.holdMs)}`);
  return `Ends at ${seconds(endMs)} — route ${seconds(parts.routeMs)}, ${past.join(', ')}`;
}
