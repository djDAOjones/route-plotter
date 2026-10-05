import { PathCalculator } from './PathCalculator.js';
import { releaseStartFraction } from '../utils/routeAnchors.js';
import { dotOnsetFraction, dotJourneyMs } from '../utils/crowdArrival.js';
import { getGraphDepartures, normalizeGraphWeights } from '../utils/graphRouting.js';
import {
  compileBusynessEnvelope,
  sampleBusynessEnvelope,
} from '../utils/busynessEnvelope.js';
import { clampImageCoordinate } from '../utils/imageCoordinates.js';

/**
 * Deterministic swarm evaluator for flow layers (Phase 3).
 *
 * The engine is a pure function of its inputs: `evaluate(timelineMs, layer,
 * context)` returns every visible dot's position for that exact timeline
 * instant, computed from scratch — no dot state is ever stored between
 * frames (deterministic-timeline mandate, decision-log 2026-08-17). Play,
 * scrub, reverse and export all agree by construction because there is
 * nothing to accumulate.
 *
 * Per-dot variation comes from `SwarmEngine.hash(seed, dotIndex, hopIndex)`:
 * hop indices ≥ 0 drive the walk (0 = entry choice, then one per junction);
 * negative hop indices are reserved channels for per-dot constants
 * (onset jitter, speed multiplier, wobble phase/frequency), and below them
 * for each respawned journey's own pace and sway (DEF-77).
 *
 * Geometry: everything is in normalised image coordinates, the same
 * space as GraphNode positions and hero-route path points. Each graph edge
 * gets its own PathCalculator instance (backlog Phase 3) whose polyline is
 * cached against a signature of the edge's geometry, so authoring edits
 * invalidate exactly the edges they touch. The corner-slowing spacing that
 * PathCalculator applies to the hero route is deliberately kept for edge
 * paths: dots ease through sharp corners with the same motion language as
 * the hero head.
 *
 * 0–1 spans the image, but a route or an anchored node may run off it
 * (DEF-03), so a dot is held only to the range a project can store a point
 * in, never to the image's edge (DEF-35).
 *
 * The caches hold derived geometry only — two calls with identical inputs
 * return identical outputs whether or not the cache was warm.
 */

/** Reserved hash channels (hopIndex values < 0). */
const CHANNEL_ONSET = -1;
const CHANNEL_SPEED = -2;
const CHANNEL_WOBBLE_PHASE = -3;
const CHANNEL_WOBBLE_FREQ = -4;

/**
 * Respawned journeys (DEF-77, the owner's "Make Respawn vary"): journey k ≥ 1
 * sways (wobble phase and frequency) by its own block of channels, so no two
 * passes along the guide sway alike, and takes its pace from block
 * ((k − 1) mod JOURNEY_PACE_CYCLE) + 1, so paces repeat every
 * JOURNEY_PACE_CYCLE journeys; journey 0 keeps the dot's founding draws
 * above. A late journey's channels lie far below zero, and `hash` reads them
 * modulo 2³², so they stay distinct draws for the first 1.4 billion journeys.
 * 'loop' never reads these, which is what keeps Repeat journey an exact replay.
 */
const CHANNEL_JOURNEY_BASE = -5;
const JOURNEY_CHANNELS = 3;
const JOURNEY_PACE = 0;
const JOURNEY_WOBBLE_PHASE = 1;
const JOURNEY_WOBBLE_FREQ = 2;

/**
 * How many pace draws a dot's respawned journeys cycle through (DEF-77).
 * Because the paces repeat, a respawning route dot skips whole cycles and
 * walks at most two cycles' journeys to find where it is, however long it
 * has respawned: an exact answer for a bounded frame. Probed for 500 dots
 * respawning about 100 times a second (a route a hundredth of the image
 * long, at Speed 1): about 0.4 ms a frame at 64, against 10 ms at 2,048.
 * At ordinary speeds a dot's paces come round again only after minutes.
 */
export const JOURNEY_PACE_CYCLE = 64;

/** Bound on walk length per dot per evaluation (keeps a frame O(dots × hops)). */
const MAX_HOPS = 2048;

/** Wobble amplitude at wobble=1, in normalised image units (2% of the image). */
const WOBBLE_MAX_AMPLITUDE = 0.02;

/** Wobble frequency range in full waves per normalised unit travelled. */
const WOBBLE_FREQ_MIN = 4;
const WOBBLE_FREQ_SPAN = 8;

/** Slowest allowed per-dot speed multiplier at speedVariance=1. */
const MIN_SPEED_MULTIPLIER = 0.05;

/** The hash channel of one of journey k's draws (k ≥ 1). */
function journeyChannel(journey, draw) {
  return CHANNEL_JOURNEY_BASE - (journey - 1) * JOURNEY_CHANNELS - draw;
}

/**
 * Nodes with exactly one path, which end a journey on a network that has no
 * Exit (DEF-77), or null when the network has an Exit and so ends journeys
 * only there. Mirrors the entry fallback: a pen-drawn network types nothing,
 * and its two-way paths turn a dot back at every end, so without this its
 * dots walk for ever and "At journey end" never acts.
 * @param {import('../models/GraphModel.js').GraphModel} graph
 * @param {Array} edges
 * @returns {Set<string>|null}
 */
function fallbackExitIds(graph, edges) {
  if (graph.getNodesByType('exit').length > 0) return null;
  const paths = new Map();
  for (const edge of edges) {
    paths.set(edge.sourceId, (paths.get(edge.sourceId) || 0) + 1);
    paths.set(edge.targetId, (paths.get(edge.targetId) || 0) + 1);
  }
  const ends = new Set();
  for (const [nodeId, count] of paths) {
    if (count === 1) ends.add(nodeId);
  }
  return ends;
}

/** Whether an emitter's dots finish their journey: Disappear and Collect do. */
function finishesJourneys(emitter) {
  return emitter.lifecycleMode === 'disappear' || emitter.lifecycleMode === 'collect';
}

/**
 * Everything a network walk reads, as one string (CROWD-05): each node's
 * type and resolved position, and each path's ends, direction, weight and
 * bends, in the order the walk meets them.
 * @param {import('../models/GraphModel.js').GraphModel} graph
 * @returns {string}
 */
function graphSignature(graph) {
  const nodes = graph.getNodes().map(node => {
    const { x, y } = node.position ? node.position() : node;
    return `${node.id}:${node.type}:${x},${y}`;
  });
  const edges = graph.getEdges().map(edge => [
    edge.id, edge.sourceId, edge.targetId, edge.direction, edge.weight,
    ...edge.controlPoints.flatMap(point => [point.x, point.y]),
  ].join(','));
  return `${nodes.join(';')}#${edges.join(';')}`;
}

export class SwarmEngine {
  constructor() {
    /**
     * Per-edge derived geometry: edgeId → {sig, calc, points, length}.
     * @private @type {Map<string, Object>}
     */
    this._edgeCache = new Map();
    /**
     * Hero-route polyline lengths, keyed by the points array itself.
     * @private @type {WeakMap<Array, number>}
     */
    this._routeLengthCache = new WeakMap();
    /** @private — shared calculator for route-guide length/interpolation. */
    this._routeCalc = new PathCalculator();
    /**
     * Each finishing emitter's first journeys on its network, by emitter id
     * (`_cachedJourneys`, CROWD-05).
     * @private @type {Map<string, {key: string, lengths: Float64Array, ends: Uint8Array}>}
     */
    this._journeyCache = new Map();
  }

  /**
   * Deterministic hash → [0, 1). FNV-style combine of the three inputs,
   * finished with the murmur3 fmix32 avalanche so consecutive indices
   * decorrelate. Integer maths only — identical on every platform.
   * @param {number} seed     — Emitter seed (non-negative integer).
   * @param {number} dotIndex — Dot index within the emitter.
   * @param {number} hopIndex — Walk hop (≥ 0) or reserved channel (< 0).
   * @returns {number} Uniform value in [0, 1).
   */
  static hash(seed, dotIndex, hopIndex) {
    // FNV offset basis keeps tiny seeds (incl. 0) well mixed.
    let h = (seed ^ 0x811C9DC5) >>> 0;
    h = (Math.imul(h, 0x01000193) ^ (dotIndex >>> 0)) >>> 0;
    h = (Math.imul(h, 0x01000193) ^ (hopIndex >>> 0)) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85EBCA6B) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xC2B2AE35) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 0x100000000;
  }

  /**
   * Evaluate every dot on a flow layer at one timeline instant.
   *
   * @param {number} timelineMs — Master-timeline time in milliseconds.
   * @param {import('../models/FlowLayer.js').FlowLayer} layer
   * @param {Object} context
   * @param {number} context.durationMs      — Master-timeline duration in ms (> 0).
   * @param {Array}  [context.routePathPoints] — Hero-route polyline (normalised),
   *                                             required for guideType 'route'.
   * @returns {Array<{x:number, y:number, size:number, color:string,
   *                  emitterId:string, dotIndex:number}>}
   *          Dots in draw order, positions in normalised image
   *          coordinates (off the image where their guide is).
   */
  evaluate(timelineMs, layer, context = {}) {
    const durationMs = context.durationMs;
    if (!layer || !Number.isFinite(durationMs) || durationMs <= 0) return [];

    const guide = this._guideFor(layer, context);
    if (!guide) return [];

    const dots = [];
    for (const emitter of layer.emitters) {
      this._evaluateEmitter(timelineMs, durationMs, emitter, guide, dots, context.routeAnchors);
    }
    return dots;
  }

  /**
   * Every dot's release and journey, without evaluating a single frame
   * (COMPOSE-02).
   *
   * Same guide resolution and same onset arithmetic `evaluate` uses, so the
   * answer describes the dots that will actually be on screen. Journey length
   * is the dot's own distance to its first exit or dead end — which differs
   * per dot on a graph, since the walk is hash-driven. A walk that runs out
   * of hops first, round a loop with no end on it, gives the distance it
   * walked and `ends: false` (DEF-77); a route dot's journey always ends.
   *
   * @param {FlowLayer} layer
   * @param {Object} context Same shape as evaluate()'s
   * @param {Object} [options]
   * @param {boolean} [options.endsOnly=false] For a caller that reads only
   *   which dots reach their journey end (DEF-77; the scene end's cached
   *   journeys are walked this way, CROWD-05):
   *   a dot standing where no path leads on to an end is not walked further,
   *   since it could only run out of hops, and gives `ends: false` with a
   *   `journeyMs` of Infinity. The crowd wait reads every finishing dot's
   *   `journeyMs`, so it leaves this off.
   * @returns {Array<import('../utils/crowdArrival.js').DotSchedule>}
   */
  scheduleDots(layer, context = {}, { endsOnly = false } = {}) {
    const durationMs = context.durationMs;
    if (!layer || !Number.isFinite(durationMs) || durationMs <= 0) return [];

    const guide = this._guideFor(layer, context);
    if (!guide) return [];

    const reaching = endsOnly && guide.type === 'graph' ? this._nodesReachingEnd(guide) : null;
    const schedules = [];
    for (const emitter of layer.emitters) {
      const { dotCount } = emitter;
      const window = this._releaseWindow(emitter, context.routeAnchors);
      // A respawning or looping dot re-enters for ever: it has no arrival to
      // wait for, and saying so is more useful than inventing one.
      const finishes = finishesJourneys(emitter);

      for (let i = 0; i < dotCount; i++) {
        const onsetFraction = this._onsetFraction(emitter, i, window);
        const speedMultiplier = this._journeyPace(emitter, i, 0);
        const { length, ends } = guide.type === 'route'
          ? { length: guide.length, ends: guide.length > 0 }
          : this._journeyLength(emitter, i, guide, reaching);
        schedules.push({
          onsetFraction,
          journeyMs: dotJourneyMs(length, emitter.speed, speedMultiplier),
          finishes: finishes && length > 0,
          ends,
        });
      }
    }
    return schedules;
  }

  /**
   * Whether a dot's journey can end on the layer's guide (DEF-77). A route
   * always ends. A network ends at an Exit, at a one-path node when it has no
   * Exit, or at a node no path leaves; a closed loop of two-way paths has
   * none of these, and no Speed makes its dots finish. Since the end waits
   * for every journey that ends (CROWD-05), what is asked is only whether
   * such an end lies on a path from an entry the dots are released at: an
   * end on a part of the network no dot can reach ends no journey. Read from
   * the network alone, so it costs no walk, and generous where a dot's own
   * walk could not take a path (`_nodesReachingEnd`): it answers false only
   * where no journey can end.
   * @param {FlowLayer} layer
   * @returns {boolean|null} Null where the layer has no network to release
   *   dots onto (no layer, or a network with no paths)
   */
  hasJourneyEnd(layer) {
    if (!layer) return null;
    if (layer.guideType === 'route') return true;
    const guide = this._buildGraphGuide(layer.graph);
    if (!guide) return null;
    const reaching = this._nodesReachingEnd(guide);
    return guide.entries.some(entry => reaching.has(entry.id));
  }

  /**
   * When the last dot on the layer finishes a journey that ends (CROWD-05):
   * the latest release plus journey of any Disappear or Collect dot whose
   * walk reaches an end. The arithmetic is `scheduleDots`'s, and `evaluate`
   * ends such a dot by the same sum, so at that instant none of them is
   * still travelling. Respawn and Repeat journey never finish and are
   * skipped before any walk; a walk that runs out of hops round a loop has
   * no end to wait for and is not counted.
   *
   * Journeys are walked once and cached (`_cachedJourneys`); releases are
   * recomputed on every call from the context, which walks nothing, so a
   * colour, size, release or pace edit costs no walk.
   *
   * @param {FlowLayer} layer
   * @param {Object} context Same shape as evaluate()'s; `durationMs` is the
   *   base timeline the releases measure against
   * @returns {number} ms on the timeline, or 0 when no dot finishes
   */
  crowdFinishMs(layer, context = {}) {
    const durationMs = context.durationMs;
    if (!layer || !Number.isFinite(durationMs) || durationMs <= 0) return 0;
    const finishing = layer.emitters.filter(finishesJourneys);
    if (finishing.length === 0) return 0;
    const guide = this._guideFor(layer, context);
    if (!guide) return 0;
    const signature = guide.type === 'graph' ? graphSignature(guide.graph) : null;

    let latest = 0;
    for (const emitter of finishing) {
      const journeys = signature === null ? null : this._cachedJourneys(emitter, guide, signature);
      const window = this._releaseWindow(emitter, context.routeAnchors);
      for (let i = 0; i < emitter.dotCount; i++) {
        const length = journeys ? journeys.lengths[i] : guide.length;
        if (!(journeys ? journeys.ends[i] : length > 0)) continue;
        const finishMs = this._onsetFraction(emitter, i, window) * durationMs
          + dotJourneyMs(length, emitter.speed, this._journeyPace(emitter, i, 0));
        if (finishMs > latest) latest = finishMs;
      }
    }
    return latest;
  }

  /**
   * Every dot's first journey on a network, walked once per change to what
   * the walk reads (CROWD-05): the network's shape, node types, path
   * directions, weights and order (`graphSignature`), the emitter's seed and
   * its dot count. Speed, pace variation and releases are not in the walk, so
   * an edit to them is answered from here. Cached geometry only: a cold call
   * and a warm one return the same lengths.
   * @private
   * @returns {{lengths: Float64Array, ends: Uint8Array}}
   */
  _cachedJourneys(emitter, guide, signature) {
    const key = `${signature}|${emitter.seed}|${emitter.dotCount}`;
    const cached = this._journeyCache.get(emitter.id);
    if (cached && cached.key === key) return cached;
    const reaching = this._nodesReachingEnd(guide);
    const lengths = new Float64Array(emitter.dotCount);
    const ends = new Uint8Array(emitter.dotCount);
    for (let i = 0; i < emitter.dotCount; i++) {
      const journey = this._journeyLength(emitter, i, guide, reaching);
      lengths[i] = journey.length;
      ends[i] = journey.ends ? 1 : 0;
    }
    const entry = { key, lengths, ends };
    this._journeyCache.set(emitter.id, entry);
    return entry;
  }

  /**
   * How far one dot travels through a graph before its first exit or dead
   * end, and whether it gets there: a walk that runs out of hops first gives
   * the distance it walked and `ends: false` (DEF-77). Mirrors the walk in
   * `_walkGraph`, summing lengths instead of stopping at a distance. Given
   * `reaching` (`_nodesReachingEnd`), a walk that stands anywhere else stops
   * there, its length Infinity, since it could only run out of hops.
   * @private
   * @returns {{length: number, ends: boolean}}
   */
  _journeyLength(emitter, dotIndex, guide, reaching = null) {
    const { graph, entries } = guide;
    const { seed } = emitter;

    let hop = 0;
    let node = this._pickEntry(entries, seed, dotIndex, hop++);
    let cameFromEdgeId = null;
    let total = 0;

    for (let step = 0; step < MAX_HOPS; step++) {
      if (reaching && !reaching.has(node.id)) return { length: Infinity, ends: false };
      const atExit = this._endsJourney(node, guide, step, step > 0);
      const candidates = atExit ? [] : this._traversableEdges(graph, node.id, cameFromEdgeId);
      if (atExit || candidates.length === 0) return { length: total, ends: true };

      const traversal = this._pickWeighted(candidates, seed, dotIndex, hop++);
      total += this.edgeGeometry(graph, traversal.edge).length;
      node = graph.getNode(traversal.reversed ? traversal.edge.sourceId : traversal.edge.targetId);
      cameFromEdgeId = traversal.edge.id;
      if (!node) break;
    }
    return { length: total, ends: false };
  }

  /**
   * Ids of the nodes a journey can end at (DEF-77): an Exit, a fallback exit
   * on a network with no Exit, or a node no path leaves that a dot can stand
   * on (an entry, or the end of a path).
   * @private
   * @returns {Set<string>}
   */
  _journeyEndIds(guide) {
    const { graph, entries, fallbackExits } = guide;
    const entryIds = new Set(entries.map(node => node.id));
    const ids = new Set();
    for (const node of graph.getNodes()) {
      const deadEnd = (entryIds.has(node.id) || graph.getEdgesForNode(node.id).length > 0)
        && this._traversableEdges(graph, node.id, null).length === 0;
      if (node.type === 'exit' || fallbackExits?.has(node.id) || deadEnd) ids.add(node.id);
    }
    return ids;
  }

  /**
   * Ids of the nodes from which paths, taken the way a dot may take them,
   * lead to a journey end (DEF-77). A dot anywhere else can only run out of
   * hops. Read node by node, so it may count a node that a dot's own walk,
   * which turns back only where there is no other way on, cannot leave for
   * an end; never the reverse.
   * @private
   * @returns {Set<string>}
   */
  _nodesReachingEnd(guide) {
    const { graph } = guide;
    const leadsFrom = new Map(); // node id → ids of the nodes a path leads to it from
    for (const node of graph.getNodes()) {
      for (const { edge, reversed } of this._traversableEdges(graph, node.id, null)) {
        const to = reversed ? edge.sourceId : edge.targetId;
        if (!leadsFrom.has(to)) leadsFrom.set(to, []);
        leadsFrom.get(to).push(node.id);
      }
    }
    const reaching = this._journeyEndIds(guide);
    const queue = [...reaching];
    while (queue.length > 0) {
      for (const from of leadsFrom.get(queue.pop()) || []) {
        if (reaching.has(from)) continue;
        reaching.add(from);
        queue.push(from);
      }
    }
    return reaching;
  }

  // ── emitter evaluation ─────────────────────────────────────────

  /**
   * The walkable guide a layer releases its dots onto, or null where it can
   * release none: the hero route's polyline, or the layer's own network.
   * @private
   */
  _guideFor(layer, context) {
    if (layer.guideType === 'route') {
      const points = context.routePathPoints;
      if (!Array.isArray(points) || points.length < 2) return null;
      const guide = { type: 'route', points, length: this._routeLength(points) };
      return guide.length > 0 ? guide : null;
    }
    return this._buildGraphGuide(layer.graph);
  }

  /**
   * Effective release window, clipped to the timeline (the model keeps
   * overhanging windows as authored; clipping happens here). A bound
   * emitter starts at a route moment instead of its authored fraction
   * (COMPOSE-01); an unbound one returns releaseStart untouched, which is
   * what keeps every existing swarm hash byte-for-byte identical.
   * @private
   */
  _releaseWindow(emitter, routeAnchors = null) {
    const windowStart = Math.min(releaseStartFraction(emitter, routeAnchors || {}), 1);
    const windowEnd = Math.min(windowStart + emitter.releaseDuration, 1);
    return {
      windowStart,
      windowSpan: Math.max(0, windowEnd - windowStart),
      busynessEnvelope: compileBusynessEnvelope(emitter.busynessEnvelope),
    };
  }

  /**
   * One dot's onset, as a fraction of the timeline. Blends the dot's
   * even-spread slot with a uniform draw by onsetVariance (0 = metronome-even,
   * 1 = fully random), then biases the result by intensityRamp (-1
   * front-loaded … 1 back-loaded), then inverts the authored busyness
   * density. A flat envelope is neutral, so historical projects retain the
   * exact founding release schedule.
   * @private
   */
  _onsetFraction(emitter, index, window) {
    const { windowStart, windowSpan, busynessEnvelope } = window;
    return dotOnsetFraction({
      index,
      dotCount: emitter.dotCount,
      onsetHash: SwarmEngine.hash(emitter.seed, index, CHANNEL_ONSET),
      onsetVariance: emitter.onsetVariance,
      intensityRamp: emitter.intensityRamp,
      sampleEnvelope: value => sampleBusynessEnvelope(busynessEnvelope, value),
      windowStart,
      windowSpan,
    });
  }

  /**
   * Append one emitter's live dots to `out`.
   * @private
   */
  _evaluateEmitter(timelineMs, durationMs, emitter, guide, out, routeAnchors = null) {
    const { dotCount } = emitter;
    const window = this._releaseWindow(emitter, routeAnchors);

    for (let i = 0; i < dotCount; i++) {
      // Shared with COMPOSE-02's arrival solve and CROWD-05's scene end,
      // which must agree with the dots actually on screen rather than
      // restate their arithmetic.
      const onsetMs = this._onsetFraction(emitter, i, window) * durationMs;

      const elapsedSec = (timelineMs - onsetMs) / 1000;
      if (elapsedSec < 0) continue; // not yet released

      const speedMultiplier = this._journeyPace(emitter, i, 0);
      const distance = emitter.speed * speedMultiplier * elapsedSec;

      const sample = guide.type === 'route'
        ? this._walkRoute(distance, emitter, i, speedMultiplier, guide, timelineMs, onsetMs)
        : this._walkGraph(distance, emitter, i, speedMultiplier, guide, timelineMs, onsetMs);
      if (!sample) continue; // lifecycle 'disappear' completed

      let { x, y } = sample.point;
      if (emitter.wobble > 0 && sample.tangent) {
        const offset = this._wobbleOffset(emitter, i, sample.wobbleDistance, sample.journey);
        x += sample.tangent.perpX * offset;
        y += sample.tangent.perpY * offset;
      }

      out.push({
        x: clampImageCoordinate(x),
        y: clampImageCoordinate(y),
        size: emitter.dotSize,
        color: emitter.dotColor,
        emitterId: emitter.id,
        dotIndex: i,
      });
    }
  }

  /**
   * Perpendicular wobble displacement for a dot at a given travelled
   * distance. Pure function of distance — no per-frame accumulation. A
   * respawned journey (k ≥ 1) sways with its own phase and frequency.
   * @private
   */
  _wobbleOffset(emitter, dotIndex, wobbleDistance, journey = 0) {
    const { seed } = emitter;
    const freqChannel = journey > 0 ? journeyChannel(journey, JOURNEY_WOBBLE_FREQ) : CHANNEL_WOBBLE_FREQ;
    const phaseChannel = journey > 0 ? journeyChannel(journey, JOURNEY_WOBBLE_PHASE) : CHANNEL_WOBBLE_PHASE;
    const frequency = WOBBLE_FREQ_MIN +
      WOBBLE_FREQ_SPAN * SwarmEngine.hash(seed, dotIndex, freqChannel);
    const phase0 = SwarmEngine.hash(seed, dotIndex, phaseChannel);
    const phase = 2 * Math.PI * (wobbleDistance * frequency + phase0);
    return Math.sin(phase) * emitter.wobble * WOBBLE_MAX_AMPLITUDE;
  }

  /**
   * A dot's speed multiplier on one journey: journey 0 is the dot's own pace,
   * and each respawned journey draws afresh from the same Pace variation
   * (DEF-77), so a crowd at 0% Pace variation still moves as one. Respawned
   * journeys cycle through JOURNEY_PACE_CYCLE draws: journey k ≥ 1 takes
   * draw ((k − 1) mod JOURNEY_PACE_CYCLE) + 1.
   * @private
   */
  _journeyPace(emitter, dotIndex, journey) {
    const channel = journey > 0
      ? journeyChannel(((journey - 1) % JOURNEY_PACE_CYCLE) + 1, JOURNEY_PACE)
      : CHANNEL_SPEED;
    return Math.max(
      MIN_SPEED_MULTIPLIER,
      1 + emitter.speedVariance * (2 * SwarmEngine.hash(emitter.seed, dotIndex, channel) - 1)
    );
  }

  // ── route guide ────────────────────────────────────────────────

  /**
   * Position a dot on the hero-route polyline. 'loop' wraps by the route
   * length, replaying the first journey exactly; 'respawn' re-enters at the
   * start with each journey's own pace and sway (DEF-77), which on a
   * single-path guide is the only way the two can differ.
   * @private
   * @returns {{point, tangent, wobbleDistance, journey}|null}
   */
  _walkRoute(distance, emitter, dotIndex, speedMultiplier, guide, timelineMs = NaN, onsetMs = NaN) {
    const { points, length } = guide;
    const mode = emitter.lifecycleMode;

    // A journey that ends is over at its own finish, by the sum the scene's
    // end is measured with (CROWD-05), whatever rounding left of `distance`.
    if (distance >= length || (finishesJourneys(emitter)
        && timelineMs >= onsetMs + dotJourneyMs(length, emitter.speed, speedMultiplier))) {
      if (mode === 'disappear') return null;
      if (mode === 'collect') {
        return this._sampleAt(points, 1, false, length);
      }
      if (mode === 'respawn') {
        return this._respawnOnRoute(distance - length, emitter, dotIndex, speedMultiplier, guide);
      }
      distance = distance % length; // loop
    }
    return this._sampleAt(points, distance / length, false, distance);
  }

  /**
   * A respawned route dot `beyond` units past its first journey's end, in
   * its first journey's units (distance at `firstPace`): journey k takes
   * `length × firstPace / pace(k)` of them. The time left is walked journey
   * by journey, each at its own pace. Paces repeat every JOURNEY_PACE_CYCLE
   * journeys, so past the first cycle whatever whole cycles remain are
   * skipped (the rest is reduced modulo one cycle's total) and only the last
   * is walked: the answer is exact, still a pure function of the instant, and
   * costs at most two cycles' steps however long the dot has respawned. The
   * sample carries the true journey index, so its sway never repeats.
   * @private
   */
  _respawnOnRoute(beyond, emitter, dotIndex, firstPace, guide) {
    const { points, length } = guide;
    const span = journey => (length * firstPace) / this._journeyPace(emitter, dotIndex, journey);
    const at = (fraction, journey) => this._sampleAt(points, fraction, false, fraction * length, journey);

    let remaining = beyond;
    let cycle = 0;
    let journey = 1;
    for (; journey <= JOURNEY_PACE_CYCLE; journey++) {
      const units = span(journey);
      if (remaining < units) return at(remaining / units, journey);
      remaining -= units;
      cycle += units;
    }

    // Journey JOURNEY_PACE_CYCLE + 1 onwards repeats the cycle's paces.
    journey += JOURNEY_PACE_CYCLE * Math.floor(remaining / cycle);
    remaining %= cycle;
    for (let left = JOURNEY_PACE_CYCLE; left > 1; left--, journey++) {
      const units = span(journey);
      if (remaining < units) break;
      remaining -= units;
    }
    // Rounding can leave the cycle's last journey a hair past its end.
    return at(Math.min(1, remaining / span(journey)), journey);
  }

  /** Route polyline length, cached by array identity. @private */
  _routeLength(points) {
    let length = this._routeLengthCache.get(points);
    if (length === undefined) {
      length = this._routeCalc.calculatePathLength(points);
      this._routeLengthCache.set(points, length);
    }
    return length;
  }

  // ── graph guide ────────────────────────────────────────────────

  /**
   * Resolve a layer's graph into a walkable guide, or null if it cannot
   * release dots. Entry nodes are `type: 'entry'`; a graph authored without
   * explicit entries falls back to every node with a traversable edge, so
   * quick console/authoring experiments still flow. Likewise a graph without
   * an Exit ends journeys at its one-path nodes (`fallbackExitIds`).
   * @private
   */
  _buildGraphGuide(graph) {
    if (!graph) return null;
    const nodes = graph.getNodes();
    const edges = graph.getEdges();
    if (nodes.length === 0 || edges.length === 0) return null;

    let entries = graph.getNodesByType('entry');
    if (entries.length === 0) {
      entries = nodes.filter(n => this._traversableEdges(graph, n.id, null).length > 0);
    }
    if (entries.length === 0) return null;

    return { type: 'graph', graph, entries, fallbackExits: fallbackExitIds(graph, edges) };
  }

  /**
   * Whether arriving at `node` ends the dot's journey. An Exit does from the
   * walk's second step on, exactly as before DEF-77. A fallback exit does
   * once the dot has walked a path since it last entered, so a respawn that
   * lands on one sets off from it rather than ending again at once.
   * @private
   */
  _endsJourney(node, guide, step, walked) {
    if (node.type === 'exit') return step > 0;
    return walked && guide.fallbackExits !== null && guide.fallbackExits.has(node.id);
  }

  /**
   * Walk a dot `distance` normalised units through the graph.
   *
   * The walk is fully re-derived every evaluation from the hash sequence:
   * hop 0 picks the entry node, each junction consumes the next hop index.
   * On reaching an exit node (or a dead end, which behaves as one):
   * 'disappear' ends the dot, 'collect' parks it there, 'respawn' teleports
   * it to a freshly hashed entry and keeps walking at that journey's own pace
   * (from `_journeyPace`'s cycle) and sway (DEF-77), and 'loop' replays the
   * dot's own first journey cyclically. `distance` is measured at the first
   * journey's pace, `speedMultiplier`, so a respawn rescales what is left of it.
   * @private
   * @returns {{point, tangent, wobbleDistance, journey}|null}
   */
  _walkGraph(distance, emitter, dotIndex, speedMultiplier, guide, timelineMs = NaN, onsetMs = NaN) {
    const { graph, entries } = guide;
    const { seed } = emitter;
    const mode = emitter.lifecycleMode;

    if (mode === 'loop') {
      return this._walkLoop(distance, emitter, dotIndex, guide);
    }

    let hop = 0;
    let node = this._pickEntry(entries, seed, dotIndex, hop++);
    let cameFromEdgeId = null;
    let remaining = distance;
    let travelled = 0;
    let walked = false; // a path walked since the dot last entered
    let journey = 0;
    let pace = speedMultiplier;

    for (let step = 0; step < MAX_HOPS; step++) {
      const atExit = this._endsJourney(node, guide, step, walked);
      const candidates = atExit ? [] : this._traversableEdges(graph, node.id, cameFromEdgeId);

      if (atExit || candidates.length === 0) {
        if (mode === 'disappear') return null;
        if (mode === 'respawn') {
          // The same time left, walked at the new journey's pace; its sway
          // runs from where it re-entered.
          journey += 1;
          const next = this._journeyPace(emitter, dotIndex, journey);
          remaining *= next / pace;
          pace = next;
          travelled = 0;
          walked = false;
          node = this._pickEntry(entries, seed, dotIndex, hop++);
          cameFromEdgeId = null;
          continue;
        }
        // 'collect' — park at the node. (Also the safe resting behaviour
        // for a respawn walk that lands on an entry with no exits.)
        return this._sampleNode(node, travelled, journey);
      }

      const traversal = this._pickWeighted(candidates, seed, dotIndex, hop++);
      const edgeGeom = this.edgeGeometry(graph, traversal.edge);
      if (edgeGeom.length <= 0) {
        node = graph.getNode(traversal.reversed ? traversal.edge.sourceId : traversal.edge.targetId);
        cameFromEdgeId = traversal.edge.id;
        walked = true;
        continue;
      }

      if (remaining <= edgeGeom.length) {
        // On a journey's last path, the dot is over at its finish, by the sum
        // the scene's end is measured with (CROWD-05): rounding can leave
        // `remaining` a hair short of the path's end at that very instant.
        // Only a dot at the end of its path is checked for being on its last.
        const journeyLength = travelled + edgeGeom.length;
        if (finishesJourneys(emitter)
            && timelineMs >= onsetMs + dotJourneyMs(journeyLength, emitter.speed, speedMultiplier)) {
          const end = this._journeyEndAfter(
            guide, traversal.reversed ? traversal.edge.sourceId : traversal.edge.targetId,
            traversal.edge.id, step + 1, emitter, dotIndex, hop
          );
          if (end) return mode === 'disappear' ? null : this._sampleNode(end, journeyLength, journey);
        }
        const fraction = remaining / edgeGeom.length;
        const progress = traversal.reversed ? 1 - fraction : fraction;
        return this._sampleAt(edgeGeom.points, progress, traversal.reversed, travelled + remaining, journey);
      }

      remaining -= edgeGeom.length;
      travelled += edgeGeom.length;
      node = graph.getNode(traversal.reversed ? traversal.edge.sourceId : traversal.edge.targetId);
      cameFromEdgeId = traversal.edge.id;
      walked = true;
      if (!node) return null; // referential integrity guards this; belt-and-braces
    }

    // Hop cap reached — park the dot where the budget ran out.
    return this._sampleNode(node, travelled, journey);
  }

  /**
   * The node a dot's journey ends at once it reaches `nodeId`, following any
   * paths of no length from there as `_walkGraph` would, or null when a path
   * with length lies ahead (or the walk would run out of hops first, as
   * `_journeyLength` counts it).
   * @private
   */
  _journeyEndAfter(guide, nodeId, cameFromEdgeId, step, emitter, dotIndex, hop) {
    const { graph } = guide;
    let node = graph.getNode(nodeId);
    for (; node && step < MAX_HOPS; step++) {
      const atExit = this._endsJourney(node, guide, step, true);
      const candidates = atExit ? [] : this._traversableEdges(graph, node.id, cameFromEdgeId);
      if (atExit || candidates.length === 0) return node;
      const traversal = this._pickWeighted(candidates, emitter.seed, dotIndex, hop++);
      if (this.edgeGeometry(graph, traversal.edge).length > 0) return null;
      node = graph.getNode(traversal.reversed ? traversal.edge.sourceId : traversal.edge.targetId);
      cameFromEdgeId = traversal.edge.id;
    }
    return null;
  }

  /**
   * 'loop' lifecycle: derive the dot's first journey (entry → first exit
   * event), then replay it with distance modulo journey length so the dot
   * cycles its own route forever.
   * @private
   */
  _walkLoop(distance, emitter, dotIndex, guide) {
    const { graph, entries } = guide;
    const { seed } = emitter;

    let hop = 0;
    let node = this._pickEntry(entries, seed, dotIndex, hop++);
    let cameFromEdgeId = null;
    const journey = [];
    let journeyLength = 0;

    for (let step = 0; step < MAX_HOPS; step++) {
      const atExit = this._endsJourney(node, guide, step, step > 0);
      const candidates = atExit ? [] : this._traversableEdges(graph, node.id, cameFromEdgeId);
      if (atExit || candidates.length === 0) break;

      const traversal = this._pickWeighted(candidates, seed, dotIndex, hop++);
      const edgeGeom = this.edgeGeometry(graph, traversal.edge);
      if (edgeGeom.length > 0) {
        journey.push({ points: edgeGeom.points, length: edgeGeom.length, reversed: traversal.reversed });
        journeyLength += edgeGeom.length;
      }
      node = graph.getNode(traversal.reversed ? traversal.edge.sourceId : traversal.edge.targetId);
      cameFromEdgeId = traversal.edge.id;
      if (!node) break;
    }

    if (journeyLength <= 0) return this._sampleNode(node, 0);

    let remaining = distance % journeyLength;
    for (const leg of journey) {
      if (remaining <= leg.length) {
        const fraction = remaining / leg.length;
        const progress = leg.reversed ? 1 - fraction : fraction;
        // Wobble phase runs on total distance so it stays continuous
        // across the loop wrap.
        return this._sampleAt(leg.points, progress, leg.reversed, distance);
      }
      remaining -= leg.length;
    }
    const last = journey[journey.length - 1];
    return this._sampleAt(last.points, last.reversed ? 0 : 1, last.reversed, distance);
  }

  /** Weighted-uniform entry choice. @private */
  _pickEntry(entries, seed, dotIndex, hopIndex) {
    const r = SwarmEngine.hash(seed, dotIndex, hopIndex);
    return entries[Math.min(entries.length - 1, Math.floor(r * entries.length))];
  }

  /**
   * Edges leaving `nodeId`, honouring direction, each tagged with its
   * traversal orientation. The edge the dot arrived on is excluded unless
   * it is the only way onward (dead-end bounce on a two-way edge).
   * @private
   * @returns {Array<{edge, reversed:boolean}>}
   */
  _traversableEdges(graph, nodeId, cameFromEdgeId) {
    return getGraphDepartures(graph, nodeId, { cameFromEdgeId });
  }

  /** Weight-proportional traversal choice via one hash draw. @private */
  _pickWeighted(candidates, seed, dotIndex, hopIndex) {
    const shares = normalizeGraphWeights(candidates.map(candidate => candidate.edge.weight));
    let target = SwarmEngine.hash(seed, dotIndex, hopIndex);
    for (let index = 0; index < candidates.length; index++) {
      target -= shares[index];
      if (target < 0) return candidates[index];
    }
    return candidates[candidates.length - 1];
  }

  // ── geometry ───────────────────────────────────────────────────

  /**
   * Derived polyline for a graph edge — one PathCalculator instance per
   * edge (backlog Phase 3), rebuilt only when the edge's geometry
   * signature changes. Public since Phase 4: network editing renders and
   * hit-tests edges through the same cache, so the drawn curve is exactly
   * the curve dots travel.
   * @returns {{points: Array, length: number}}
   */
  edgeGeometry(graph, edge) {
    const source = graph.getNode(edge.sourceId);
    const target = graph.getNode(edge.targetId);
    // Resolved positions, so an anchored node's drawn curve is the curve dots
    // travel (COMPOSE-01). Including them in the signature is what makes a
    // route edit invalidate the cached geometry.
    const from = source.position ? source.position() : source;
    const to = target.position ? target.position() : target;
    const sig = [
      from.x, from.y, to.x, to.y,
      ...edge.controlPoints.flatMap(p => [p.x, p.y]),
    ].join(',');

    let entry = this._edgeCache.get(edge.id);
    if (!entry || entry.sig !== sig) {
      const calc = entry?.calc || new PathCalculator();
      const pseudoWaypoints = [
        { x: from.x, y: from.y },
        ...edge.controlPoints.map(p => ({ x: p.x, y: p.y })),
        { x: to.x, y: to.y },
      ];
      const points = calc.calculatePath(pseudoWaypoints);
      entry = { sig, calc, points, length: calc.calculatePathLength(points) };
      this._edgeCache.set(edge.id, entry);
    }
    return entry;
  }

  /**
   * Sample a polyline at `progress`, with the local tangent's
   * perpendicular for wobble displacement.
   * @private
   */
  _sampleAt(points, progress, reversed, wobbleDistance, journey = 0) {
    const point = this._routeCalc.getPointAtProgress(points, progress);
    if (!point) return null;

    const delta = 0.01;
    const ahead = this._routeCalc.getPointAtProgress(points, Math.min(1, progress + delta));
    const behind = this._routeCalc.getPointAtProgress(points, Math.max(0, progress - delta));
    let tangent = null;
    const dx = ahead.x - behind.x;
    const dy = ahead.y - behind.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      tangent = { perpX: -dy / len, perpY: dx / len };
    }
    return { point, tangent, wobbleDistance, journey };
  }

  /** A dot parked on a node (collect / dead end / hop cap). @private */
  _sampleNode(node, wobbleDistance, journey = 0) {
    if (!node) return null;
    return {
      point: node.position ? node.position() : { x: node.x, y: node.y },
      tangent: null, // parked dots don't wobble — the phase would be frozen anyway
      wobbleDistance,
      journey,
    };
  }
}
