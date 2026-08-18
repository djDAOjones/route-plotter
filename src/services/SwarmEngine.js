import { PathCalculator } from './PathCalculator.js';

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
 * (onset jitter, speed multiplier, wobble phase/frequency).
 *
 * Geometry: everything is in normalised image coordinates (0–1), the same
 * space as GraphNode positions and hero-route path points. Each graph edge
 * gets its own PathCalculator instance (backlog Phase 3) whose polyline is
 * cached against a signature of the edge's geometry, so authoring edits
 * invalidate exactly the edges they touch. The corner-slowing spacing that
 * PathCalculator applies to the hero route is deliberately kept for edge
 * paths: dots ease through sharp corners with the same motion language as
 * the hero head.
 *
 * The caches hold derived geometry only — two calls with identical inputs
 * return identical outputs whether or not the cache was warm.
 */

/** Reserved hash channels (hopIndex values < 0). */
const CHANNEL_ONSET = -1;
const CHANNEL_SPEED = -2;
const CHANNEL_WOBBLE_PHASE = -3;
const CHANNEL_WOBBLE_FREQ = -4;

/** Bound on walk length per dot per evaluation (keeps a frame O(dots × hops)). */
const MAX_HOPS = 2048;

/** Wobble amplitude at wobble=1, in normalised image units (2% of the image). */
const WOBBLE_MAX_AMPLITUDE = 0.02;

/** Wobble frequency range in full waves per normalised unit travelled. */
const WOBBLE_FREQ_MIN = 4;
const WOBBLE_FREQ_SPAN = 8;

/** Slowest allowed per-dot speed multiplier at speedVariance=1. */
const MIN_SPEED_MULTIPLIER = 0.05;

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
   *          Dots in draw order, positions normalised 0–1.
   */
  evaluate(timelineMs, layer, context = {}) {
    const durationMs = context.durationMs;
    if (!layer || !Number.isFinite(durationMs) || durationMs <= 0) return [];

    let guide = null;
    if (layer.guideType === 'route') {
      const points = context.routePathPoints;
      if (!Array.isArray(points) || points.length < 2) return [];
      guide = { type: 'route', points, length: this._routeLength(points) };
      if (guide.length <= 0) return [];
    } else {
      guide = this._buildGraphGuide(layer.graph);
      if (!guide) return [];
    }

    const dots = [];
    for (const emitter of layer.emitters) {
      this._evaluateEmitter(timelineMs, durationMs, emitter, guide, dots);
    }
    return dots;
  }

  // ── emitter evaluation ─────────────────────────────────────────

  /**
   * Append one emitter's live dots to `out`.
   * @private
   */
  _evaluateEmitter(timelineMs, durationMs, emitter, guide, out) {
    const { seed, dotCount } = emitter;

    // Effective release window, clipped to the timeline (the model keeps
    // overhanging windows as authored; clipping happens here).
    const windowStart = Math.min(emitter.releaseStart, 1);
    const windowEnd = Math.min(emitter.releaseStart + emitter.releaseDuration, 1);
    const windowSpan = Math.max(0, windowEnd - windowStart);

    for (let i = 0; i < dotCount; i++) {
      // Onset: blend the dot's even-spread slot with a uniform draw by
      // onsetVariance (0 = metronome-even, 1 = fully random), then bias
      // the result by intensityRamp (-1 front-loaded … 1 back-loaded).
      const slot = (i + 0.5) / dotCount;
      const uniform = SwarmEngine.hash(seed, i, CHANNEL_ONSET);
      let u = slot + (uniform - slot) * emitter.onsetVariance;
      const ramp = emitter.intensityRamp;
      if (ramp > 0) u = Math.pow(u, 1 / (1 + ramp));
      else if (ramp < 0) u = Math.pow(u, 1 - ramp);
      const onsetMs = (windowStart + u * windowSpan) * durationMs;

      const elapsedSec = (timelineMs - onsetMs) / 1000;
      if (elapsedSec < 0) continue; // not yet released

      const speedMultiplier = Math.max(
        MIN_SPEED_MULTIPLIER,
        1 + emitter.speedVariance * (2 * SwarmEngine.hash(seed, i, CHANNEL_SPEED) - 1)
      );
      const distance = emitter.speed * speedMultiplier * elapsedSec;

      const sample = guide.type === 'route'
        ? this._walkRoute(distance, emitter, guide)
        : this._walkGraph(distance, emitter, i, guide);
      if (!sample) continue; // lifecycle 'disappear' completed

      let { x, y } = sample.point;
      if (emitter.wobble > 0 && sample.tangent) {
        const offset = this._wobbleOffset(emitter, i, sample.wobbleDistance);
        x += sample.tangent.perpX * offset;
        y += sample.tangent.perpY * offset;
      }

      out.push({
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        size: emitter.dotSize,
        color: emitter.dotColor,
        emitterId: emitter.id,
        dotIndex: i,
      });
    }
  }

  /**
   * Perpendicular wobble displacement for a dot at a given travelled
   * distance. Pure function of distance — no per-frame accumulation.
   * @private
   */
  _wobbleOffset(emitter, dotIndex, wobbleDistance) {
    const { seed } = emitter;
    const frequency = WOBBLE_FREQ_MIN +
      WOBBLE_FREQ_SPAN * SwarmEngine.hash(seed, dotIndex, CHANNEL_WOBBLE_FREQ);
    const phase0 = SwarmEngine.hash(seed, dotIndex, CHANNEL_WOBBLE_PHASE);
    const phase = 2 * Math.PI * (wobbleDistance * frequency + phase0);
    return Math.sin(phase) * emitter.wobble * WOBBLE_MAX_AMPLITUDE;
  }

  // ── route guide ────────────────────────────────────────────────

  /**
   * Position a dot on the hero-route polyline. 'respawn' and 'loop'
   * coincide on a single-path guide: both wrap by the route length.
   * @private
   * @returns {{point, tangent, wobbleDistance}|null}
   */
  _walkRoute(distance, emitter, guide) {
    const { points, length } = guide;
    const mode = emitter.lifecycleMode;

    if (distance >= length) {
      if (mode === 'disappear') return null;
      if (mode === 'collect') {
        return this._sampleAt(points, 1, false, length);
      }
      distance = distance % length; // respawn | loop
    }
    return this._sampleAt(points, distance / length, false, distance);
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
   * quick console/authoring experiments still flow.
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

    return { type: 'graph', graph, entries };
  }

  /**
   * Walk a dot `distance` normalised units through the graph.
   *
   * The walk is fully re-derived every evaluation from the hash sequence:
   * hop 0 picks the entry node, each junction consumes the next hop index.
   * On reaching an exit node (or a dead end, which behaves as one):
   * 'disappear' ends the dot, 'collect' parks it there, 'respawn' teleports
   * it to a freshly hashed entry and keeps walking, and 'loop' replays the
   * dot's own first journey cyclically.
   * @private
   * @returns {{point, tangent, wobbleDistance}|null}
   */
  _walkGraph(distance, emitter, dotIndex, guide) {
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

    for (let step = 0; step < MAX_HOPS; step++) {
      const atExit = node.type === 'exit' && step > 0;
      const candidates = atExit ? [] : this._traversableEdges(graph, node.id, cameFromEdgeId);

      if (atExit || candidates.length === 0) {
        if (mode === 'disappear') return null;
        if (mode === 'respawn') {
          node = this._pickEntry(entries, seed, dotIndex, hop++);
          cameFromEdgeId = null;
          continue;
        }
        // 'collect' — park at the node. (Also the safe resting behaviour
        // for a respawn walk that lands on an entry with no exits.)
        return this._sampleNode(node, travelled);
      }

      const traversal = this._pickWeighted(candidates, seed, dotIndex, hop++);
      const edgeGeom = this._edgeGeometry(graph, traversal.edge);
      if (edgeGeom.length <= 0) {
        node = graph.getNode(traversal.reversed ? traversal.edge.sourceId : traversal.edge.targetId);
        cameFromEdgeId = traversal.edge.id;
        continue;
      }

      if (remaining <= edgeGeom.length) {
        const fraction = remaining / edgeGeom.length;
        const progress = traversal.reversed ? 1 - fraction : fraction;
        return this._sampleAt(edgeGeom.points, progress, traversal.reversed, travelled + remaining);
      }

      remaining -= edgeGeom.length;
      travelled += edgeGeom.length;
      node = graph.getNode(traversal.reversed ? traversal.edge.sourceId : traversal.edge.targetId);
      cameFromEdgeId = traversal.edge.id;
      if (!node) return null; // referential integrity guards this; belt-and-braces
    }

    // Hop cap reached — park the dot where the budget ran out.
    return this._sampleNode(node, travelled);
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
      const atExit = node.type === 'exit' && step > 0;
      const candidates = atExit ? [] : this._traversableEdges(graph, node.id, cameFromEdgeId);
      if (atExit || candidates.length === 0) break;

      const traversal = this._pickWeighted(candidates, seed, dotIndex, hop++);
      const edgeGeom = this._edgeGeometry(graph, traversal.edge);
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
    const all = [];
    for (const edge of graph.getEdgesForNode(nodeId)) {
      if (edge.sourceId === nodeId) {
        all.push({ edge, reversed: false });
      } else if (edge.direction === 'two-way') {
        all.push({ edge, reversed: true });
      }
    }
    const onward = all.filter(t => t.edge.id !== cameFromEdgeId);
    return onward.length > 0 ? onward : all;
  }

  /** Weight-proportional traversal choice via one hash draw. @private */
  _pickWeighted(candidates, seed, dotIndex, hopIndex) {
    let total = 0;
    for (const c of candidates) total += c.edge.weight;
    let target = SwarmEngine.hash(seed, dotIndex, hopIndex) * total;
    for (const c of candidates) {
      target -= c.edge.weight;
      if (target < 0) return c;
    }
    return candidates[candidates.length - 1];
  }

  // ── geometry ───────────────────────────────────────────────────

  /**
   * Derived polyline for a graph edge — one PathCalculator instance per
   * edge (backlog Phase 3), rebuilt only when the edge's geometry
   * signature changes.
   * @private
   * @returns {{points: Array, length: number}}
   */
  _edgeGeometry(graph, edge) {
    const source = graph.getNode(edge.sourceId);
    const target = graph.getNode(edge.targetId);
    const sig = [
      source.x, source.y, target.x, target.y,
      ...edge.controlPoints.flatMap(p => [p.x, p.y]),
    ].join(',');

    let entry = this._edgeCache.get(edge.id);
    if (!entry || entry.sig !== sig) {
      const calc = entry?.calc || new PathCalculator();
      const pseudoWaypoints = [
        { x: source.x, y: source.y },
        ...edge.controlPoints.map(p => ({ x: p.x, y: p.y })),
        { x: target.x, y: target.y },
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
  _sampleAt(points, progress, reversed, wobbleDistance) {
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
    return { point, tangent, wobbleDistance };
  }

  /** A dot parked on a node (collect / dead end / hop cap). @private */
  _sampleNode(node, wobbleDistance) {
    if (!node) return null;
    return {
      point: { x: node.x, y: node.y },
      tangent: null, // parked dots don't wobble — the phase would be frozen anyway
      wobbleDistance,
    };
  }
}
