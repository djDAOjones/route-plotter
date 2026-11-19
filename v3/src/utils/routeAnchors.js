/**
 * Binding crowds to route moments (COMPOSE-01).
 *
 * Ownership is strictly one-way: the graph follows the route, and nothing here
 * ever moves a waypoint. Route timing is never a function of crowd arrival
 * either — a bound emitter reads *when the head got somewhere*, which is
 * already decided before any dot is evaluated.
 *
 * Both bindings are resolved at evaluation time from live route state rather
 * than baked into the model, so editing the route updates them without
 * rewriting the graph's authored intent. A broken reference falls back to that
 * intent and is reported, never silently repaired.
 */

/** Route moments an emitter's release can be pinned to. */
export const RELEASE_AT = Object.freeze({
  /** The instant the head reaches the waypoint. */
  ARRIVAL: 'arrival',
  /** The instant the head leaves it again — arrival plus its wait. */
  PAUSE_END: 'pause-end',
  /** The instant the whole route completes, branches included. */
  ROUTE_END: 'route-end',
});

const RELEASE_AT_VALUES = new Set(Object.values(RELEASE_AT));

/**
 * Normalise an authored release anchor, or null when it is not one.
 *
 * Named moments rather than a normalised offset into the pause: an author can
 * reason about "when the head gets there" and "when it moves off again", both
 * survive retiming, and an offset into a pause means nothing when the pause is
 * zero (the open question on the COMPOSE-01 ticket).
 *
 * @param {*} value
 * @returns {{waypointId: string, at: string}|null}
 */
export function normaliseReleaseAnchor(value) {
  if (!value || typeof value !== 'object') return null;
  const waypointId = typeof value.waypointId === 'string' && value.waypointId
    ? value.waypointId
    : null;
  if (!waypointId) return null;
  const at = RELEASE_AT_VALUES.has(value.at) ? value.at : RELEASE_AT.ARRIVAL;
  return { waypointId, at };
}

/**
 * Bind every anchored node in a scene to its waypoint's position.
 *
 * Mutates only the nodes' derived resolution, never their authored `x`/`y`.
 *
 * @param {Object|null} scene
 * @param {Map<string, Object>|null} waypointsById
 * @returns {{bound: number, broken: Array<{layerId: string, layerName: string,
 *            nodeId: string, waypointId: string}>}}
 */
export function resolveGraphAnchors(scene, waypointsById) {
  const broken = [];
  let bound = 0;

  const layers = scene?.getFlowLayers?.() || [];
  for (const layer of layers) {
    const nodes = layer.graph?.getNodes?.() || [];
    for (const node of nodes) {
      if (!node.anchorWaypointId) {
        node.clearAnchorResolution?.();
        continue;
      }
      const waypoint = waypointsById?.get?.(node.anchorWaypointId);
      if (!waypoint) {
        // Fall back to where the node was authored and say so. Deleting the
        // node or freezing the crowd would both destroy work the author did
        // not ask to lose (the ticket's fallback question).
        node.clearAnchorResolution?.();
        broken.push({
          layerId: layer.id,
          layerName: layer.name,
          nodeId: node.id,
          waypointId: node.anchorWaypointId,
        });
        continue;
      }
      node.applyAnchor?.(waypoint.imgX, waypoint.imgY);
      bound += 1;
    }
  }

  return { bound, broken };
}

/**
 * Resolve a release anchor to a master-timeline instant.
 *
 * @param {{waypointId: string, at: string}|null} anchor
 * @param {Object} context
 * @param {Object<string, number>} context.arrivalMsById
 * @param {Object<string, number>} [context.pauseMsById] Effective wait per waypoint
 * @param {number} context.totalDurationMs
 * @returns {{ms: number, resolved: boolean, reason: string|null}}
 */
export function resolveReleaseAnchor(anchor, context = {}) {
  const normalised = normaliseReleaseAnchor(anchor);
  if (!normalised) return { ms: 0, resolved: false, reason: null };

  const total = Number(context.totalDurationMs) || 0;
  if (normalised.at === RELEASE_AT.ROUTE_END) {
    return { ms: total, resolved: true, reason: null };
  }

  const arrival = context.arrivalMsById?.[normalised.waypointId];
  if (!Number.isFinite(arrival)) {
    return {
      ms: 0,
      resolved: false,
      reason: 'That waypoint is no longer on the route',
    };
  }

  if (normalised.at === RELEASE_AT.PAUSE_END) {
    const wait = Number(context.pauseMsById?.[normalised.waypointId]) || 0;
    return { ms: arrival + wait, resolved: true, reason: null };
  }
  return { ms: arrival, resolved: true, reason: null };
}

/**
 * The release-window start an emitter should use, as a timeline fraction.
 *
 * An unanchored emitter returns its authored `releaseStart` untouched — which
 * is what keeps every existing swarm hash byte-for-byte identical, since the
 * onset arithmetic downstream is unchanged and only its window start moves.
 *
 * @param {Object} emitter
 * @param {Object} context See resolveReleaseAnchor
 * @returns {number} 0–1
 */
export function releaseStartFraction(emitter, context = {}) {
  const anchor = normaliseReleaseAnchor(emitter?.releaseAnchor);
  if (!anchor) return emitter?.releaseStart ?? 0;

  const resolved = resolveReleaseAnchor(anchor, context);
  // A broken anchor falls back to the authored window rather than dumping the
  // whole crowd at t=0.
  if (!resolved.resolved) return emitter?.releaseStart ?? 0;

  const total = Number(context.totalDurationMs) || 0;
  if (total <= 0) return emitter?.releaseStart ?? 0;
  return Math.max(0, Math.min(1, resolved.ms / total));
}

/**
 * Waypoints that a crowd enters the scene from (COMPOSE-04).
 *
 * A traced or hand-bound `entry` node sitting on a waypoint means "this is
 * where a crowd joins the story". That is exactly the place an author is most
 * likely to want the route to fork too — the hero peels off while the crowd
 * arrives — so those waypoints are the ones offered a branch handle.
 *
 * Entry nodes only: a pass-through or exit node marks somewhere a crowd is
 * already moving through, not a moment the story opens at.
 *
 * @param {Object|null} scene
 * @returns {Set<string>} Waypoint ids
 */
export function boundEntryWaypointIds(scene) {
  const ids = new Set();
  for (const layer of scene?.getFlowLayers?.() || []) {
    if (!layer.visible) continue;
    for (const node of layer.graph?.getNodes?.() || []) {
      if (node.type !== 'entry' || !node.anchorWaypointId) continue;
      if (!node.isAnchorResolved?.()) continue; // a broken binding offers nothing
      ids.add(node.anchorWaypointId);
    }
  }
  return ids;
}
