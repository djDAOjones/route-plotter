import { PathCalculator } from './PathCalculator.js';
import { releaseStartFraction } from '../utils/routeAnchors.js';
import { dotOnsetFraction, dotJourneyMs } from '../utils/crowdArrival.js';
import { getGraphDepartures, normalizeGraphWeights, graphEntryCumulative } from '../utils/graphRouting.js';
import { entryWeightValue } from '../utils/entryWeight.js';
import { groupsActive } from '../utils/groupSettings.js';
import { buildGroupRouting, chooseGroupDeparture } from '../utils/groupRouting.js';
import {
  createGroupArc, traceGroupJourney, sampleGroupJourney, groupNormal, groupOffsets,
} from '../utils/groupJourney.js';
import {
  compileBusynessEnvelope,
  sampleBusynessEnvelope,
} from '../utils/busynessEnvelope.js';
import { clampImageCoordinate } from '../utils/imageCoordinates.js';
import { sampleCrowdArea } from '../utils/crowdArea.js';
import { createFinishPackingContext, packFinishArea } from '../utils/finishArea.js';

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

// A different seed namespace leaves every existing hop/respawn draw intact.
const AREA_SEED_NAMESPACE = 0xA83E92D7;

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
 * Whether a finishing dot's journey of `length` is over at `timelineMs`, by
 * the sum the scene's end is measured with (CROWD-05). The one comparison the
 * evaluator ends such a dot with and `canRelease` admits a Disappear dot by
 * (CROWD-08 part A), so the two cannot drift: at its onset a dot whose finish
 * rounds to the onset is over before it is drawn.
 * @param {number} timelineMs
 * @param {number} onsetMs
 * @param {number} length Normalised distance walked to the end in question
 * @param {Object} emitter Its `speed`
 * @param {number} pace The dot's speed multiplier on its first journey
 * @returns {boolean}
 */
function journeyOverAt(timelineMs, onsetMs, length, emitter, pace) {
  return timelineMs >= onsetMs + dotJourneyMs(length, emitter.speed, pace);
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
  const entryWeights = graph.getNodes().map(node => [node.id, entryWeightValue(node.entryWeight)]);
  return `${nodes.join(';')}#${edges.join(';')}|entries:${JSON.stringify(entryWeights)}`;
}

/** Exact tuples keep new area geometry out of the legacy delimiter signature. */
function startAreaSignature(guide, emitter) {
  if (!finishesJourneys(emitter) || guide.imageAspect === undefined) return '';
  return '|areas:' + JSON.stringify([guide.imageAspect, guide.entries
    .filter(node => node.type === 'entry' && node.area)
    .map(node => [node.id, node.position(), node.area])]);
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
     * Each emitter's first journeys on its network, by model identity. IDs
     * can repeat across layers or loaded projects; each instance keeps its
     * own walks, and replaced models can be collected (CROWD-08 part A).
     * @private @type {WeakMap<Object, WeakMap<Object, Object>>}
     */
    this._journeyCache = new WeakMap();
    // C isolates full-input network geometry from the historical partial
    // PathCalculator key. Geometry survives release/pace edits; allocations do not.
    this._finishGeometryCache = new WeakMap();
    this._finishAllocationCache = new WeakMap();
    this._canonicalEdgeCache = new WeakMap();
    this._groupRoutingCache = new WeakMap();
    this._groupGeometryCache = new WeakMap();
    this._groupAllocationCache = new WeakMap();
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
   * @param {number} [context.imageAspect=1] — Intrinsic background width/height; never the output canvas.
   * @param {Array}  [context.routePathPoints] — Hero-route polyline (normalised),
   *                                             required for guideType 'route'.
   * @returns {Array<{x:number, y:number, size:number, color:string,
   *                  emitterId:string, dotIndex:number}>}
   *          Dots in draw order, positions in normalised image
   *          coordinates (off the image where their guide is).
   */
  evaluate(timelineMs, layer, context = {}) {
    const durationMs = context.durationMs;
    if (!layer) return [];

    const guide = this._guideFor(layer, context);
    if (!guide) return [];

    const finish = this._finishPlans(layer, guide, context);
    if (!(durationMs > 0 && Number.isFinite(durationMs)) && !finish) return [];
    const dots = [];
    const signature = guide.imageAspect === undefined ? null : graphSignature(guide.graph);
    for (const emitter of layer.emitters) {
      const journeys = signature !== null && finishesJourneys(emitter) && !groupsActive(layer, emitter)
        ? this._cachedJourneys(layer, emitter, guide, signature) : null;
      this._evaluateEmitter(timelineMs, durationMs, emitter, guide, dots, context.routeAnchors, journeys, finish);
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
    if (!layer) return [];

    const guide = this._guideFor(layer, context);
    if (!guide) return [];

    const finish = this._finishPlans(layer, guide, context);
    const legacy = durationMs > 0 && Number.isFinite(durationMs);
    if (!legacy && !finish) return [];
    const reaching = endsOnly && guide.type === 'graph' ? this._nodesReachingEnd(guide) : null;
    const schedules = [];
    for (const emitter of layer.emitters) {
      const { dotCount } = emitter;
      const window = this._releaseWindow(emitter, context.routeAnchors);
      // A respawning or looping dot re-enters for ever: it has no arrival to
      // wait for, and saying so is more useful than inventing one.
      const finishes = finishesJourneys(emitter);

      for (let i = 0; i < dotCount; i++) {
        const plan = finish?.byEmitter.get(emitter)?.[i];
        if (plan) {
          schedules.push({ onsetFraction: plan.onsetFraction, onsetMs: plan.onsetMs,
            journeyMs: plan.journeyMs, finishes: plan.group ? plan.ends : true, ends: plan.group ? plan.ends : true });
          continue;
        }
        if (!legacy) continue;
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
    const guide = layer.emitters.some(e => groupsActive(layer, e))
      ? this._indexedGroupGuide(layer) : this._buildGraphGuide(layer.graph);
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
    if (!layer) return 0;
    const finishing = layer.emitters.filter(finishesJourneys);
    if (finishing.length === 0) return 0;
    const guide = this._guideFor(layer, context);
    if (!guide) return 0;
    const signature = guide.type === 'graph' ? graphSignature(guide.graph) : null;

    const finish = this._finishPlans(layer, guide, context);
    let latest = finish?.latest || 0;
    if (!(durationMs > 0 && Number.isFinite(durationMs))) return latest;
    for (const emitter of finishing) {
      if (groupsActive(layer, emitter)) continue;
      const journeys = signature === null ? null : this._cachedJourneys(layer, emitter, guide, signature);
      const window = this._releaseWindow(emitter, context.routeAnchors);
      for (let i = 0; i < emitter.dotCount; i++) {
        if (finish?.byEmitter.get(emitter)?.[i]) continue;
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
   * and a warm one return the same lengths. Kept per layer and emitter
   * instance, so loading a project with reused ids cannot inherit another
   * model's journeys (CROWD-08 part A).
   * `multiLeg` marks a journey of more than one path with length, which the
   * evaluator draws at its onset whatever its finish (`canRelease`).
   * @private
   * @returns {{lengths: Float64Array, ends: Uint8Array, multiLeg: Uint8Array}}
   */
  _cachedJourneys(layer, emitter, guide, signature) {
    const areaSignature = startAreaSignature(guide, emitter);
    const key = `${signature}|${emitter.seed}|${emitter.dotCount}${areaSignature}`;
    let byEmitter = this._journeyCache.get(layer);
    if (!byEmitter) {
      byEmitter = new WeakMap();
      this._journeyCache.set(layer, byEmitter);
    }
    const cached = byEmitter.get(emitter);
    if (cached && cached.key === key) return cached;
    const reaching = this._nodesReachingEnd(guide);
    const lengths = new Float64Array(emitter.dotCount);
    const ends = new Uint8Array(emitter.dotCount);
    const multiLeg = new Uint8Array(emitter.dotCount);
    const areas = areaSignature ? new Array(emitter.dotCount).fill(null) : null;
    for (let i = 0; i < emitter.dotCount; i++) {
      const journey = this._journeyLength(emitter, i, guide, reaching);
      lengths[i] = journey.length;
      ends[i] = journey.ends ? 1 : 0;
      multiLeg[i] = journey.legs > 1 ? 1 : 0;
      if (areas && journey.area) {
        areas[i] = { ...journey.area, totalLength: journey.length, ends: journey.ends };
      }
    }
    const entry = { key, lengths, ends, multiLeg, ...(areas ? { areas } : {}) };
    byEmitter.set(emitter, entry);
    return entry;
  }

  /**
   * Whether the layer's dots can be drawn: whether `evaluate` returns at
   * least one dot at some finite instant of the playback, whatever the
   * layer's visibility (CROWD-08 part A; the lead's settlement of "can
   * release dots"). Play and both exports admit a project with no route by
   * it, so it reads the engine's own guide, walks and arithmetic rather than
   * restate them: a dot is drawn, if ever, at its exact onset (the onset is
   * within the base timeline, and every later instant of a dot not drawn
   * then finds its journey over too).
   *
   * - No base timeline, no guide (`_guideFor`: no route, or a network with
   *   no path or entry), or no emitter with a dot: none.
   * - Collect at the end, Respawn and Repeat journey: every released dot is
   *   drawn, parked where its journey ends or re-entering.
   * - Disappear: a dot whose walk runs out of hops (`!ends`) is parked and
   *   drawn; one whose journey holds more than one path with length is drawn
   *   on its first at its onset, where `_journeyEndAfter` finds more to walk;
   *   one with a single such path is drawn unless its finish is its onset
   *   (`journeyOverAt`, the evaluator's comparison); one with none is not.
   *
   * Walks come from the scene end's cache (`_cachedJourneys`), so a repeated
   * call walks nothing; releases and paces are recomputed from the context,
   * as `crowdFinishMs` does.
   * @param {FlowLayer} layer
   * @param {Object} context Same shape as evaluate()'s
   * @returns {boolean}
   */
  canRelease(layer, context = {}) {
    const durationMs = context.durationMs;
    if (!layer) return false;
    const emitters = (layer.emitters || []).filter(emitter => emitter.dotCount > 0);
    if (emitters.length === 0) return false;
    const guide = this._guideFor(layer, context);
    if (!guide) return false;
    if (this._finishPlans(layer, guide, context)?.active) return true;
    if (!(durationMs > 0 && Number.isFinite(durationMs))) return false;
    const signature = guide.type === 'graph' ? graphSignature(guide.graph) : null;

    for (const emitter of emitters) {
      if (groupsActive(layer, emitter)) continue;
      if (emitter.lifecycleMode !== 'disappear') return true;
      const journeys = signature === null ? null : this._cachedJourneys(layer, emitter, guide, signature);
      const window = this._releaseWindow(emitter, context.routeAnchors);
      for (let i = 0; i < emitter.dotCount; i++) {
        if (journeys) {
          // Active areas have terminal precedence even when a multi-leg
          // journey rounds to its onset. The old tiny-edge rule stays old.
          if (!journeys.ends[i] || (!journeys.areas?.[i] && journeys.multiLeg[i])) return true;
          if (!(journeys.lengths[i] > 0)) continue;
        }
        const length = journeys ? journeys.lengths[i] : guide.length;
        const onsetMs = this._onsetFraction(emitter, i, window) * durationMs;
        if (!journeyOverAt(onsetMs, onsetMs, length, emitter, this._journeyPace(emitter, i, 0))) return true;
      }
    }
    return false;
  }

  /**
   * How far one dot travels through a graph before its first exit or dead
   * end, and whether it gets there: a walk that runs out of hops first gives
   * the distance it walked and `ends: false` (DEF-77). Mirrors the walk in
   * `_walkGraph`, summing lengths instead of stopping at a distance. Given
   * `reaching` (`_nodesReachingEnd`), a walk that stands anywhere else stops
   * there, its length Infinity, since it could only run out of hops. `legs`
   * counts the paths with length it walked (CROWD-08 part A, `canRelease`).
   * @private
   * @returns {{length: number, ends: boolean, legs: number}}
   */
  _journeyLength(emitter, dotIndex, guide, reaching = null) {
    const { graph, entries } = guide;
    const { seed } = emitter;

    let hop = 0;
    let node = this._pickEntry(entries, seed, dotIndex, hop++, guide.entryCumulative);
    let cameFromEdgeId = null;
    const area = this._startArea(node, emitter, dotIndex, guide);
    let total = guide.canonicalGeometry ? 0 : area ? area.length : 0;
    let legs = total > 0 ? 1 : 0;

    for (let step = 0; step < MAX_HOPS; step++) {
      if (reaching && !reaching.has(node.id)) {
        return { length: Infinity, ends: false, legs, ...(area ? { area } : {}) };
      }
      const atExit = this._endsJourney(node, guide, step, step > 0);
      const candidates = atExit ? [] : this._traversableEdges(graph, node.id, cameFromEdgeId);
      if (atExit || candidates.length === 0) {
        return { length: guide.canonicalGeometry ? (area?.length || 0) + total : total,
          ends: true, endId: node.id, legs, ...(area ? { area: { ...area, endId: node.id } } : {}) };
      }

      const traversal = this._pickWeighted(candidates, seed, dotIndex, hop++);
      const edgeLength = this._geometryFor(guide, traversal.edge).length;
      total += edgeLength;
      if (edgeLength > 0) legs += 1;
      node = graph.getNode(traversal.reversed ? traversal.edge.sourceId : traversal.edge.targetId);
      cameFromEdgeId = traversal.edge.id;
      if (!node) break;
    }
    return { length: total, ends: false, legs, ...(area ? { area } : {}) };
  }

  /** An indexed guide is used only on layers with an active group emitter. */
  _indexedGroupGuide(layer) {
    const graph = layer.graph, nodes = graph.getNodes(), edges = graph.getEdges();
    if (!nodes.length || !edges.length) return null;
    const key = JSON.stringify([nodes.map(n => [n.id, n.type, n.position(), entryWeightValue(n.entryWeight)]),
      edges.map(e => [e.id, e.sourceId, e.targetId, e.direction, e.weight, e.controlPoints])]);
    let cache = this._groupRoutingCache.get(layer);
    if (!cache || cache.graph !== graph || cache.key !== key) {
      const routing = buildGroupRouting(graph), leadsFrom = new Map(), reaching = new Set();
      const entryIds = new Set(routing.entries.map(n => n.id));
      for (const node of nodes) {
        const departures = routing.byNode.get(node.id).departures;
        if (node.type === 'exit' || routing.fallbackExits?.has(node.id)
            || (!departures.length && (entryIds.has(node.id) || routing.incidence.has(node.id)))) reaching.add(node.id);
        for (const { edge, reversed } of departures) {
          const to = reversed ? edge.sourceId : edge.targetId;
          if (!leadsFrom.has(to)) leadsFrom.set(to, []);
          leadsFrom.get(to).push(node.id);
        }
      }
      const queue = [...reaching];
      while (queue.length) for (const from of leadsFrom.get(queue.pop()) || []) {
        if (!reaching.has(from)) { reaching.add(from); queue.push(from); }
      }
      routing.reaching = reaching;
      cache = { graph, key, routing };
      this._groupRoutingCache.set(layer, cache);
    }
    return cache.routing.entries.length ? { ...cache.routing, indexedRouting: cache.routing } : null;
  }

  /** F plans rank their actual node arrivals together with the ordinary C journeys. */
  _groupPlans(layer, guide, context) {
    if (guide.type !== 'graph' || !guide.indexedRouting) return null;
    const routing = guide.indexedRouting;
    const aspect = Number.isFinite(context.imageAspect) && context.imageAspect > 0 ? context.imageAspect : 1;
    const canonical = { ...guide, canonicalGeometry: true, imageAspect: aspect };
    const geometryKey = JSON.stringify([aspect,
      guide.graph.getNodes().map(n => [n.id, n.area]),
      layer.emitters.map(e => [e.id, e.seed, e.dotCount, e.lifecycleMode, e.groups,
        e.groupSize, e.groupWidth, e.waitAtStart])]);
    let geometry = this._groupGeometryCache.get(layer);
    if (!geometry || geometry.routing !== routing || geometry.key !== geometryKey
        || layer.emitters.some((e, i) => e !== geometry.emitters[i])) {
      const byEmitter = new Map();
      for (const emitter of layer.emitters) {
        const rows = new Array(emitter.dotCount).fill(null);
        if (groupsActive(layer, emitter)) {
          const count = Math.ceil(emitter.dotCount / emitter.groupSize);
          const offsetsByCount = new Map();
          for (let k = 0; k < count; k++) {
            const entry = this._pickEntry(routing.entries, emitter.seed, k, 0, routing.entryCumulative);
            const journey = traceGroupJourney(routing, entry,
              (pool, from, hop) => chooseGroupDeparture(pool, from, SwarmEngine.hash(emitter.seed, k, hop)),
              ordinal => {
                const edge = routing.edges[ordinal], path = this._geometryFor(canonical, edge).points;
                return createGroupArc(path, guide.graph.getNode(edge.sourceId).position(),
                  guide.graph.getNode(edge.targetId).position());
              });
            const n = Math.min(emitter.groupSize, emitter.dotCount - k * emitter.groupSize);
            if (!offsetsByCount.has(n)) offsetsByCount.set(n, groupOffsets(n, emitter.groupWidth));
            const offsets = offsetsByCount.get(n);
            const group = { journey, width: emitter.groupWidth, k, count, maxApproach: 0, memo: new Map() };
            const terminalNormal = groupNormal(journey, journey.length, group.width);
            for (let member = 0; member < n; member++) {
              const index = k * emitter.groupSize + member, { across, behind } = offsets[member];
              const at = this._groupFormation(group, -behind);
              const staging = { x: at.point.x + across * at.normal.x, y: at.point.y + across * at.normal.y };
              const area = this._startArea(entry, emitter, index, canonical);
              const start = area?.point || staging;
              const approach = area ? Math.hypot(start.x - staging.x, start.y - staging.y) : 0;
              group.maxApproach = Math.max(group.maxApproach, approach);
              const terminal = { x: journey.end.x + across * terminalNormal.x,
                y: journey.end.y + across * terminalNormal.y };
              const collapse = journey.ends ? Math.hypot(terminal.x - journey.end.x, terminal.y - journey.end.y) : 0;
              rows[index] = { group, index, start, staging, approach, across, behind, terminal, collapse,
                journey, endId: journey.terminal?.id };
            }
          }
        } else if (emitter.lifecycleMode === 'collect') {
          for (let i = 0; i < emitter.dotCount; i++) {
            const terminal = this._firstTerminal(emitter, i, guide);
            if (terminal?.type === 'exit' && terminal.area) {
              rows[i] = { journey: this._journeyLength(emitter, i, canonical), index: i, endId: terminal.id };
            }
          }
        }
        byEmitter.set(emitter, rows);
      }
      geometry = { key: geometryKey, routing, emitters: [...layer.emitters], byEmitter };
      this._groupGeometryCache.set(layer, geometry);
    }
    const plane = context.finishPackingContext || createFinishPackingContext(context);
    const clock = context.finishReleaseContext
      || { durationMs: context.durationMs, routeAnchors: context.routeAnchors };
    const duration = Number.isFinite(clock.durationMs) && clock.durationMs >= 0 ? clock.durationMs : 10000;
    const key = JSON.stringify([plane, duration, clock.routeAnchors, layer.emitters.map(e => [e.dotSize,
      e.speed, e.speedVariance, e.releaseStart, e.releaseDuration, e.releaseAnchor,
      e.onsetVariance, e.intensityRamp, e.busynessEnvelope])]);
    const cached = this._groupAllocationCache.get(layer);
    if (cached?.geometry === geometry && cached.key === key) return cached;
    const byEmitter = new Map(), byExit = new Map(), summaries = new Map();
    const allocated = [];
    for (const [emitterOrder, emitter] of layer.emitters.entries()) {
      const rows = new Array(emitter.dotCount).fill(null), window = this._releaseWindow(emitter, clock.routeAnchors);
      byEmitter.set(emitter, rows);
      for (const [index, row] of geometry.byEmitter.get(emitter).entries()) {
        if (!row) continue;
        const role = row.group ? row.group.k : index;
        const roleEmitter = row.group ? { ...emitter, dotCount: row.group.count } : emitter;
        const pace = this._journeyPace(emitter, role, 0);
        const onsetFraction = this._onsetFraction(roleEmitter, role, window);
        const onsetMs = onsetFraction * duration;
        const networkLength = row.group ? row.group.maxApproach + row.journey.length + row.behind : row.journey.length;
        const nodeLength = networkLength + (row.collapse || 0);
        const plan = { ...row, emitter, emitterOrder, index, pace, onsetFraction, onsetMs,
          ends: row.group ? row.journey.ends : true, nodeLength,
          center: row.journey.end || guide.graph.getNode(row.endId).position(),
          arrivalMs: onsetMs + dotJourneyMs(nodeLength, emitter.speed, pace),
          collapseMs: onsetMs + dotJourneyMs(networkLength, emitter.speed, pace) };
        if (row.group) {
          plan.networkMs = onsetMs + dotJourneyMs(row.group.maxApproach, emitter.speed, pace);
          plan.approachMs = onsetMs + dotJourneyMs(row.approach, emitter.speed, pace);
        }
        rows[index] = plan; allocated.push(plan);
        const exit = guide.graph.getNode(row.endId);
        if (plan.ends && emitter.lifecycleMode === 'collect' && exit?.type === 'exit' && exit.area) {
          if (!byExit.has(row.endId)) byExit.set(row.endId, []);
          byExit.get(row.endId).push(plan);
        }
      }
    }
    const largest = Math.max(...layer.emitters.map(e => e.dotSize));
    for (const [exitId, arrivals] of byExit) {
      const exit = guide.graph.getNode(exitId), center = exit.position();
      const packing = packFinishArea(exit.area, center, plane, largest, arrivals.length);
      summaries.set(exitId, { capacity: packing.capacity, exact: packing.exact, arrivals: arrivals.length });
      arrivals.sort((a, b) => a.arrivalMs - b.arrivalMs || a.emitterOrder - b.emitterOrder || a.index - b.index);
      arrivals.forEach((plan, rank) => {
        plan.place = packing.places.length ? packing.places[rank % packing.places.length] : center;
      });
    }
    let latest = 0, active = false;
    for (const plan of allocated) {
      plan.place ??= plan.center;
      plan.finishLength = plan.ends ? Math.hypot(plan.place.x - plan.center.x, plan.place.y - plan.center.y) : 0;
      plan.totalLength = plan.nodeLength + plan.finishLength;
      plan.journeyMs = dotJourneyMs(plan.totalLength, plan.emitter.speed, plan.pace);
      plan.finishMs = plan.onsetMs + plan.journeyMs;
      if (plan.ends) latest = Math.max(latest, plan.finishMs);
      if (!plan.ends || plan.emitter.lifecycleMode === 'collect' || plan.finishMs > plan.onsetMs) active = true;
    }
    const result = { key, geometry, byEmitter, summaries, active, latest, guide: canonical };
    this._groupAllocationCache.set(layer, result);
    return result;
  }

  /** Reuse a row's centre/normal; only the current queried distance is memoised. */
  _groupFormation(group, distance) {
    let sample = group.memo.get(distance);
    if (!sample) {
      sample = { ...sampleGroupJourney(group.journey, distance),
        normal: groupNormal(group.journey, distance, group.width) };
      group.memo.set(distance, sample);
    }
    return sample;
  }

  _walkGroupPlan(time, emitter, plan) {
    const { group, journey, pace } = plan;
    if (plan.ends && time >= plan.finishMs) {
      return emitter.lifecycleMode === 'disappear' ? null : { point: plan.place, tangent: null };
    }
    if (!plan.ends && time >= plan.collapseMs) return { point: plan.terminal, tangent: null };
    if (plan.ends && time >= plan.arrivalMs) {
      const f = time === plan.arrivalMs ? 0
        : Math.min(1, (time - plan.arrivalMs) / 1000 * emitter.speed * pace / plan.finishLength);
      return { point: { x: plan.center.x + (plan.place.x - plan.center.x) * f,
        y: plan.center.y + (plan.place.y - plan.center.y) * f }, tangent: null };
    }
    if (plan.ends && time >= plan.collapseMs) {
      const f = time === plan.collapseMs ? 0
        : Math.min(1, (time - plan.collapseMs) / 1000 * emitter.speed * pace / plan.collapse);
      return { point: { x: plan.terminal.x + (plan.center.x - plan.terminal.x) * f,
        y: plan.terminal.y + (plan.center.y - plan.terminal.y) * f }, tangent: null };
    }
    if (time >= plan.networkMs) {
      const q = Math.min(journey.length + plan.behind, (time - plan.networkMs) / 1000 * emitter.speed * pace);
      if (group.memoQ !== q) { group.memoQ = q; group.memo.clear(); }
      const distance = q - plan.behind, sample = this._groupFormation(group, distance);
      return { point: { x: sample.point.x + plan.across * sample.normal.x,
        y: sample.point.y + plan.across * sample.normal.y }, tangent: sample.tangent,
        wobbleDistance: Math.max(0, distance), journey: 0 };
    }
    if (time >= plan.approachMs) return { point: plan.staging, tangent: null };
    const f = Math.min(1, (time - plan.onsetMs) / 1000 * emitter.speed * pace / plan.approach);
    return { point: { x: plan.start.x + (plan.staging.x - plan.start.x) * f,
      y: plan.start.y + (plan.staging.y - plan.start.y) * f }, tangent: null };
  }

  /** The topology-only first journey chooses C eligibility without warming geometry. */
  _firstTerminal(emitter, dotIndex, guide) {
    let hop = 0;
    let node = this._pickEntry(guide.entries, emitter.seed, dotIndex, hop++, guide.entryCumulative), from = null;
    for (let step = 0; node && step < MAX_HOPS; step++) {
      const atExit = this._endsJourney(node, guide, step, step > 0);
      const choices = atExit ? [] : this._traversableEdges(guide.graph, node.id, from);
      if (!choices.length) return node;
      const walk = this._pickWeighted(choices, emitter.seed, dotIndex, hop++);
      from = walk.edge.id;
      node = guide.graph.getNode(walk.reversed ? walk.edge.sourceId : walk.edge.targetId);
    }
    return null;
  }

  _geometryFor(guide, edge) {
    if (!guide.canonicalGeometry) return this.edgeGeometry(guide.graph, edge);
    let byEdge = this._canonicalEdgeCache.get(guide.graph);
    if (!byEdge) { byEdge = new WeakMap(); this._canonicalEdgeCache.set(guide.graph, byEdge); }
    const from = guide.graph.getNode(edge.sourceId).position(), to = guide.graph.getNode(edge.targetId).position();
    const points = [from, ...edge.controlPoints, to];
    const key = JSON.stringify(points.map(p => [p.x, p.y]));
    const cached = byEdge.get(edge);
    if (cached?.key === key) return cached;
    // A fresh calculator per changed FULL tuple prevents old curvature results
    // surviving an edit/cancel. Ineligible dots deliberately keep the old cache.
    const calculator = new PathCalculator();
    const path = calculator.calculatePath(points.map(p => ({ x: p.x, y: p.y })));
    const result = { key, points: path, length: calculator.calculatePathLength(path) };
    byEdge.set(edge, result);
    return result;
  }

  /** Shared across all emitters: each Exit's seats are ranked by unextended arrival. */
  _finishPlans(layer, guide, context) {
    if (layer.emitters.some(e => groupsActive(layer, e))) return this._groupPlans(layer, guide, context);
    if (guide.type !== 'graph' || !guide.graph.getNodesByType('exit').some(n => n.area)
        || !layer.emitters.some(e => e.lifecycleMode === 'collect' && e.dotCount > 0)) return null;
    const canonical = { ...guide, canonicalGeometry: true };
    const geometryKey = JSON.stringify([
      guide.imageAspect,
      guide.graph.getNodes().map(n => [n.id, n.type, n.position(), n.area, entryWeightValue(n.entryWeight)]),
      guide.graph.getEdges().map(e => [e.id, e.sourceId, e.targetId, e.direction, e.weight, e.controlPoints]),
      layer.emitters.map(e => [e.id, e.seed, e.dotCount, e.lifecycleMode]),
    ]);
    let geometry = this._finishGeometryCache.get(layer);
    if (!geometry || geometry.key !== geometryKey
        || layer.emitters.some((emitter, i) => emitter !== geometry.emitters[i])) {
      const byEmitter = new Map();
      for (const emitter of layer.emitters) {
        if (emitter.lifecycleMode !== 'collect') continue;
        const rows = new Array(emitter.dotCount).fill(null);
        for (let i = 0; i < emitter.dotCount; i++) {
          const terminal = this._firstTerminal(emitter, i, guide);
          if (terminal?.type === 'exit' && terminal.area) rows[i] = this._journeyLength(emitter, i, canonical);
        }
        byEmitter.set(emitter, rows);
      }
      geometry = { key: geometryKey, emitters: [...layer.emitters], byEmitter };
      this._finishGeometryCache.set(layer, geometry);
    }
    const plane = context.finishPackingContext || createFinishPackingContext(context);
    const clock = context.finishReleaseContext
      || { durationMs: context.durationMs, routeAnchors: context.routeAnchors };
    const duration = Number.isFinite(clock.durationMs) && clock.durationMs >= 0 ? clock.durationMs : 10000;
    const key = JSON.stringify([plane, duration, clock.routeAnchors, layer.emitters.map(e => [
      e.dotSize, e.speed, e.speedVariance, e.releaseStart, e.releaseDuration, e.releaseAnchor,
      e.onsetVariance, e.intensityRamp, e.busynessEnvelope,
    ])]);
    const cached = this._finishAllocationCache.get(layer);
    if (cached?.geometry === geometry && cached.key === key) return cached;
    const byEmitter = new Map(), byExit = new Map(), summaries = new Map();
    let active = false, latest = 0;
    for (const [emitterOrder, emitter] of layer.emitters.entries()) {
      const journeys = geometry.byEmitter.get(emitter);
      if (!journeys) continue;
      const window = this._releaseWindow(emitter, clock.routeAnchors), rows = new Array(emitter.dotCount).fill(null);
      byEmitter.set(emitter, rows);
      journeys.forEach((journey, index) => {
        if (!journey) return;
        active = true;
        const pace = this._journeyPace(emitter, index, 0), onsetFraction = this._onsetFraction(emitter, index, window);
        const onsetMs = onsetFraction * duration;
        const plan = { journey, pace, onsetFraction, onsetMs, emitter, emitterOrder, index,
          arrivalMs: onsetMs + dotJourneyMs(journey.length, emitter.speed, pace) };
        rows[index] = plan;
        if (!byExit.has(journey.endId)) byExit.set(journey.endId, []);
        byExit.get(journey.endId).push(plan);
      });
    }
    const largest = Math.max(...layer.emitters.map(e => e.dotSize));
    for (const [exitId, arrivals] of byExit) {
      const exit = guide.graph.getNode(exitId), center = exit.position();
      const packing = packFinishArea(exit.area, center, plane, largest, arrivals.length);
      summaries.set(exitId, { capacity: packing.capacity, exact: packing.exact, arrivals: arrivals.length });
      arrivals.sort((a, b) => a.arrivalMs - b.arrivalMs || a.emitterOrder - b.emitterOrder || a.index - b.index);
      for (const [rank, plan] of arrivals.entries()) {
        const place = packing.places.length ? packing.places[rank % packing.places.length] : center;
        const finishLength = Math.hypot(place.x - center.x, place.y - center.y);
        const totalLength = plan.journey.length + finishLength;
        Object.assign(plan, { center, place, finishLength, totalLength,
          journeyMs: dotJourneyMs(totalLength, plan.emitter.speed, plan.pace) });
        plan.finishMs = plan.onsetMs + plan.journeyMs;
        latest = Math.max(latest, plan.finishMs);
      }
    }
    const result = { key, geometry, byEmitter, summaries, active, latest, guide: canonical };
    this._finishAllocationCache.set(layer, result);
    return result;
  }

  /** Capacity guidance for both authoring surfaces; unvisited areas cost only a centre test. */
  finishAreaSummary(layer, nodeId, context = {}) {
    const guide = layer && this._guideFor(layer, context), node = layer?.graph?.getNode(nodeId);
    if (!guide || node?.type !== 'exit' || !node.area) return null;
    const plans = this._finishPlans(layer, guide, context), summary = plans?.summaries.get(nodeId);
    if (summary) return summary;
    const packing = packFinishArea(node.area, node.position(),
      context.finishPackingContext || createFinishPackingContext(context),
      Math.max(...layer.emitters.map(e => e.dotSize)), 0);
    return { capacity: packing.capacity, exact: packing.exact, arrivals: 0 };
  }

  _walkFinish(time, distance, emitter, index, plan, guide) {
    if (plan.group) return this._walkGroupPlan(time, emitter, plan);
    // Shared terminal sum first, Exit second, Entry third: coincident floating
    // boundaries cannot strand a dot at its old Entry or unextended Exit.
    if (time >= plan.finishMs) return { point: plan.place, tangent: null };
    if (time >= plan.arrivalMs) {
      const fraction = time === plan.arrivalMs ? 0
        : Math.min(1, (time - plan.arrivalMs) / 1000 * emitter.speed * plan.pace / plan.finishLength);
      return { point: { x: plan.center.x + (plan.place.x - plan.center.x) * fraction,
        y: plan.center.y + (plan.place.y - plan.center.y) * fraction }, tangent: null };
    }
    const area = plan.journey.area ? { ...plan.journey.area, totalLength: plan.journey.length, ends: true } : null;
    return this._walkGraph(distance, emitter, index, plan.pace, guide, time, plan.onsetMs, area);
  }

  /** One dot's seeded approach; dormant settings never enter the old walk. */
  _startArea(node, emitter, dotIndex, guide) {
    if (node.type !== 'entry' || !node.area || !finishesJourneys(emitter)) return null;
    const center = node.position();
    const seed = (emitter.seed ^ AREA_SEED_NAMESPACE) >>> 0;
    const point = sampleCrowdArea(node.area, center, [
      SwarmEngine.hash(seed, dotIndex, 0), SwarmEngine.hash(seed, dotIndex, 1),
    ], guide.imageAspect);
    return { point, length: Math.hypot(point.x - center.x, point.y - center.y) };
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
    if (guide.indexedRouting) return guide.indexedRouting.reaching;
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
    const guide = layer.emitters.some(e => groupsActive(layer, e))
      ? this._indexedGroupGuide(layer) : this._buildGraphGuide(layer.graph);
    if (guide?.entries.some(node => node.type === 'entry' && node.area)) {
      guide.imageAspect = Number.isFinite(context.imageAspect) && context.imageAspect > 0 ? context.imageAspect : 1;
    }
    return guide;
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
  _evaluateEmitter(timelineMs, durationMs, emitter, guide, out, routeAnchors = null, journeys = null, finish = null) {
    const { dotCount } = emitter;
    const window = this._releaseWindow(emitter, routeAnchors);

    for (let i = 0; i < dotCount; i++) {
      // Shared with COMPOSE-02's arrival solve and CROWD-05's scene end,
      // which must agree with the dots actually on screen rather than
      // restate their arithmetic.
      const plan = finish?.byEmitter.get(emitter)?.[i];
      if (!plan && !(durationMs > 0 && Number.isFinite(durationMs))) continue;
      const onsetMs = plan ? plan.onsetMs : this._onsetFraction(emitter, i, window) * durationMs;

      const elapsedSec = (timelineMs - onsetMs) / 1000;
      if (elapsedSec < 0) continue; // not yet released

      const speedMultiplier = plan?.group ? plan.pace : this._journeyPace(emitter, i, 0);
      const distance = emitter.speed * speedMultiplier * elapsedSec;

      const sample = plan ? this._walkFinish(timelineMs, distance, emitter, i, plan, finish.guide)
        : guide.type === 'route'
        ? this._walkRoute(distance, emitter, i, speedMultiplier, guide, timelineMs, onsetMs)
        : this._walkGraph(distance, emitter, i, speedMultiplier, guide, timelineMs, onsetMs, journeys?.areas?.[i]);
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
        && journeyOverAt(timelineMs, onsetMs, length, emitter, speedMultiplier))) {
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
    const entryCumulative = entries.length ? graphEntryCumulative(entries) : null;
    if (entries.length === 0) {
      entries = nodes.filter(n => this._traversableEdges(graph, n.id, null).length > 0);
    }
    if (entries.length === 0) return null;

    return { type: 'graph', graph, entries, entryCumulative, fallbackExits: fallbackExitIds(graph, edges) };
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
  _walkGraph(distance, emitter, dotIndex, speedMultiplier, guide, timelineMs = NaN, onsetMs = NaN, area = null) {
    const { graph, entries } = guide;
    const { seed } = emitter;
    const mode = emitter.lifecycleMode;

    if (mode === 'loop') {
      return this._walkLoop(distance, emitter, dotIndex, guide);
    }

    let hop = 0;
    let node = this._pickEntry(entries, seed, dotIndex, hop++, guide.entryCumulative);
    let cameFromEdgeId = null;
    let remaining = distance;
    let travelled = 0;
    let walked = false; // a path walked since the dot last entered
    let journey = 0;
    let pace = speedMultiplier;

    if (area) {
      // Compare the shared total first: it can round to onset, even with
      // several real edges. Never borrow legacy multi-leg admission here.
      if (area.ends && journeyOverAt(timelineMs, onsetMs, area.totalLength, emitter, speedMultiplier)) {
        return mode === 'disappear' ? null : this._sampleNode(graph.getNode(area.endId), area.totalLength);
      }
      const approachEnd = onsetMs + dotJourneyMs(area.length, emitter.speed, speedMultiplier);
      if (timelineMs <= approachEnd) {
        if (timelineMs === approachEnd) return this._sampleNode(node, 0);
        const fraction = Math.max(0, Math.min(1, distance / area.length));
        const center = node.position();
        return { point: {
          x: area.point.x + (center.x - area.point.x) * fraction,
          y: area.point.y + (center.y - area.point.y) * fraction,
        }, tangent: null, wobbleDistance: 0, journey: 0 };
      }
      remaining = Math.max(0, distance - area.length);
      travelled = area.length;
    }

    for (let step = 0; step < MAX_HOPS; step++) {
      const atExit = this._endsJourney(node, guide, step, walked);
      const candidates = atExit ? [] : this._traversableEdges(graph, node.id, cameFromEdgeId);

      if (atExit || candidates.length === 0) {
        if (mode === 'disappear') {
          // Distance arithmetic can reach the node one representable instant
          // early. Active-area terminal state is owned by the time test above.
          return area?.ends ? this._sampleNode(node, travelled, journey) : null;
        }
        if (mode === 'respawn') {
          // The same time left, walked at the new journey's pace; its sway
          // runs from where it re-entered.
          journey += 1;
          const next = this._journeyPace(emitter, dotIndex, journey);
          remaining *= next / pace;
          pace = next;
          travelled = 0;
          walked = false;
          node = this._pickEntry(entries, seed, dotIndex, hop++, guide.entryCumulative);
          cameFromEdgeId = null;
          continue;
        }
        // 'collect' — park at the node. (Also the safe resting behaviour
        // for a respawn walk that lands on an entry with no exits.)
        return this._sampleNode(node, travelled, journey);
      }

      const traversal = this._pickWeighted(candidates, seed, dotIndex, hop++);
      const edgeGeom = this._geometryFor(guide, traversal.edge);
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
        if (!guide.canonicalGeometry && finishesJourneys(emitter)
            && journeyOverAt(timelineMs, onsetMs, journeyLength, emitter, speedMultiplier)) {
          const end = this._journeyEndAfter(
            guide, traversal.reversed ? traversal.edge.sourceId : traversal.edge.targetId,
            traversal.edge.id, step + 1, emitter, dotIndex, hop
          );
          if (end) return mode === 'disappear' ? null : this._sampleNode(end, journeyLength, journey);
        }
        const fraction = remaining / edgeGeom.length;
        const progress = traversal.reversed ? 1 - fraction : fraction;
        const wobbleDistance = area ? travelled + remaining - area.length : travelled + remaining;
        return this._sampleAt(edgeGeom.points, progress, traversal.reversed, wobbleDistance, journey);
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
      if (this._geometryFor(guide, traversal.edge).length > 0) return null;
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
    let node = this._pickEntry(entries, seed, dotIndex, hop++, guide.entryCumulative);
    let cameFromEdgeId = null;
    const journey = [];
    let journeyLength = 0;

    for (let step = 0; step < MAX_HOPS; step++) {
      const atExit = this._endsJourney(node, guide, step, step > 0);
      const candidates = atExit ? [] : this._traversableEdges(graph, node.id, cameFromEdgeId);
      if (atExit || candidates.length === 0) break;

      const traversal = this._pickWeighted(candidates, seed, dotIndex, hop++);
      const edgeGeom = this._geometryFor(guide, traversal.edge);
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

  /** One draw, with exactly the old floor boundary for equal weights and implicit starts. @private */
  _pickEntry(entries, seed, dotIndex, hopIndex, cumulative = null) {
    const r = SwarmEngine.hash(seed, dotIndex, hopIndex);
    if (cumulative) {
      // First bound strictly greater than r, including repeated bounds for
      // tiny shares. Binary search keeps large Entry pools cheap per dot.
      let low = 0, high = entries.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (r < cumulative[middle]) high = middle;
        else low = middle + 1;
      }
      return entries[Math.min(low, entries.length - 1)];
    }
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
