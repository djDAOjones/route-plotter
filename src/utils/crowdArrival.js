/**
 * When a crowd finishes, computed rather than watched (COMPOSE-02).
 *
 * Every dot's onset and speed are pure functions of (seed, index) — the
 * deterministic-swarm mandate — so "when does the last one arrive?" has a
 * closed-form answer that needs no simulation and no frame loop. That is what
 * lets a route wait be *baked*: the author gets a number now, written into the
 * waypoint as an ordinary authored value, instead of the route acquiring a
 * live dependency on the crowd (which the Phase 5 contract forbids outright —
 * route timing must never be a function of crowd arrival).
 *
 * The onset arithmetic here is the same routine `SwarmEngine` evaluates with,
 * imported rather than restated, because a second copy would drift from the
 * dots actually on screen the first time either changed.
 */

/**
 * One dot's onset, as a fraction of the timeline.
 *
 * @param {Object} params
 * @param {number} params.index Dot index
 * @param {number} params.dotCount
 * @param {number} params.onsetHash Uniform draw for this dot's onset channel
 * @param {number} params.onsetVariance 0 = metronome-even, 1 = fully random
 * @param {number} params.intensityRamp -1 front-loaded … 1 back-loaded
 * @param {Function} params.sampleEnvelope Compiled busyness envelope sampler
 * @param {number} params.windowStart Release window start, 0–1
 * @param {number} params.windowSpan Release window length, 0–1
 * @returns {number} 0–1
 */
export function dotOnsetFraction({
  index, dotCount, onsetHash, onsetVariance, intensityRamp,
  sampleEnvelope, windowStart, windowSpan,
}) {
  const slot = (index + 0.5) / dotCount;
  let u = slot + (onsetHash - slot) * onsetVariance;
  if (intensityRamp > 0) u = Math.pow(u, 1 / (1 + intensityRamp));
  else if (intensityRamp < 0) u = Math.pow(u, 1 - intensityRamp);
  u = sampleEnvelope(u);
  return windowStart + u * windowSpan;
}

/**
 * How long one dot spends travelling, in ms.
 *
 * @param {number} journeyLength Normalised distance the dot covers
 * @param {number} speed Emitter speed, normalised units per second
 * @param {number} speedMultiplier This dot's variance multiplier
 * @returns {number}
 */
export function dotJourneyMs(journeyLength, speed, speedMultiplier) {
  const effective = speed * speedMultiplier;
  if (!(effective > 0) || !(journeyLength > 0)) return 0;
  return (journeyLength / effective) * 1000;
}

/**
 * @typedef {Object} DotSchedule
 * @property {number} onsetFraction When the dot is released, 0–1 of the timeline
 * @property {number} journeyMs How long it then travels
 * @property {boolean} finishes False for a dot that never arrives (loop/respawn)
 */

/**
 * The instant a crowd's last dot arrives, on the current timeline.
 *
 * @param {Array<DotSchedule>} schedules
 * @param {number} durationMs Current total timeline duration
 * @returns {{ms: number, allFinish: boolean, finishingDots: number}}
 */
export function lastArrivalMs(schedules = [], durationMs = 0) {
  let ms = 0;
  let finishingDots = 0;
  let allFinish = true;

  for (const dot of schedules) {
    if (!dot.finishes) { allFinish = false; continue; }
    finishingDots += 1;
    ms = Math.max(ms, dot.onsetFraction * durationMs + dot.journeyMs);
  }
  return { ms, allFinish, finishingDots };
}

/**
 * The wait a waypoint needs so the head does not leave before the crowd has
 * finished — solved, not iterated.
 *
 * Adding a wait `P` at the waypoint lengthens the timeline, which pushes every
 * dot's onset out too (onsets are fractions of the timeline), so a naive
 * "difference between now and then" undershoots and a loop converges only
 * slowly. Per dot, with `A` the head's arrival at the waypoint (unaffected by a
 * wait *at* it), `f` the dot's onset fraction, `J` its journey and `D` the
 * timeline minus this waypoint's current wait:
 *
 *     A + P  ≥  f·(D + P) + J   ⇒   P ≥ (f·D + J − A) / (1 − f)
 *
 * The answer is the largest such `P` over the dots, floored at zero. A dot
 * whose onset fraction is 1 releases exactly at the end of the timeline and
 * can never be waited for — lengthening the route moves its release by the
 * same amount — so that case is reported rather than approximated.
 *
 * @param {Object} options
 * @param {Array<DotSchedule>} options.schedules
 * @param {number} options.arrivalMs Head arrival at the waypoint
 * @param {number} options.durationMs Current total timeline duration
 * @param {number} [options.currentWaitMs=0] The waypoint's existing wait
 * @returns {{waitMs: number, satisfiable: boolean, reason: string|null}}
 */
export function waitForCrowdMs({
  schedules = [], arrivalMs = 0, durationMs = 0, currentWaitMs = 0,
}) {
  const baseDuration = Math.max(0, durationMs - currentWaitMs);
  let waitMs = 0;
  let sawFinisher = false;

  for (const dot of schedules) {
    if (!dot.finishes) continue;
    sawFinisher = true;
    const f = dot.onsetFraction;
    if (f >= 1) {
      return {
        waitMs: 0,
        satisfiable: false,
        reason: 'Some dots are released at the very end of the timeline, so the route can never outlast them',
      };
    }
    const needed = (f * baseDuration + dot.journeyMs - arrivalMs) / (1 - f);
    waitMs = Math.max(waitMs, needed);
  }

  if (!sawFinisher) {
    return {
      waitMs: 0,
      satisfiable: false,
      reason: 'This crowd’s dots never finish their journey — set its lifecycle to disappear or collect first',
    };
  }
  return { waitMs: Math.max(0, waitMs), satisfiable: true, reason: null };
}
