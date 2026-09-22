/**
 * Accessibility helpers for the standalone exported player.
 *
 * The scene summary is intentionally aggregate-only: it describes authored
 * structure without copying project names, labels, coordinates, identifiers,
 * or asset metadata into another surface. It is computed once after PlayerApp
 * has hydrated the canonical models, never from rendered frames.
 *
 * Transport announcements are similarly action-driven. The render loop and
 * raw seek events must not call this module; only committed user actions and
 * the autonomous completion event should reach the live region.
 */

export const KEYBOARD_SEEK_ANNOUNCEMENT_DELAY_MS = 300;

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function collectionFrom(owner, methodName, propertyName) {
  if (typeof owner?.[methodName] === 'function') {
    const collection = owner[methodName]();
    return Array.isArray(collection) ? collection : [];
  }
  return Array.isArray(owner?.[propertyName]) ? owner[propertyName] : [];
}

/**
 * Return privacy-preserving aggregate counts for a hydrated PlayerApp.
 * Graph data retained by a route-guided layer is deliberately excluded: it
 * is dormant authoring data, not part of the scene the exported player shows.
 *
 * @param {{waypoints?: Array, scene?: Object}} player
 * @returns {{route: Object, crowds: Object, networks: Object, highlights: Object}}
 */
export function summarizePlayerScene(player) {
  const waypoints = Array.isArray(player?.waypoints) ? player.waypoints : [];
  const layers = collectionFrom(player?.scene, 'getFlowLayers', 'flowLayers')
    .filter(layer => layer?.visible !== false);
  const rawDuration = Number(player?.animationEngine?.state?.duration);
  const durationMs = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;

  let majorWaypoints = 0;
  let areas = 0;
  let polygons = 0;
  let polygonVertices = 0;

  for (const waypoint of waypoints) {
    if (Boolean(waypoint?.isMajor)) majorWaypoints += 1;

    const hasArea = typeof waypoint?.hasAreaHighlight === 'function'
      ? waypoint.hasAreaHighlight()
      : waypoint?.areaHighlight?.enabled === true && waypoint.areaHighlight.shape !== 'none';
    if (!hasArea) continue;

    areas += 1;
    if (waypoint.areaHighlight?.shape === 'polygon') {
      polygons += 1;
      const points = waypoint.areaHighlight.points;
      polygonVertices += Array.isArray(points) ? points.length : 0;
    }
  }

  let emitters = 0;
  let configuredDots = 0;
  let customNetworks = 0;
  let graphNodes = 0;
  let graphEdges = 0;

  for (const layer of layers) {
    const layerEmitters = collectionFrom(layer, 'getEmitters', 'emitters');
    emitters += layerEmitters.length;
    for (const emitter of layerEmitters) {
      const dotCount = Number(emitter?.dotCount);
      if (Number.isSafeInteger(dotCount) && dotCount >= 0) configuredDots += dotCount;
    }

    if (layer?.guideType !== 'graph') continue;
    customNetworks += 1;
    graphNodes += collectionFrom(layer.graph, 'getNodes', 'nodes').length;
    graphEdges += collectionFrom(layer.graph, 'getEdges', 'edges').length;
  }

  return {
    timeline: { durationMs },
    route: {
      waypoints: waypoints.length,
      majorWaypoints,
      minorWaypoints: waypoints.length - majorWaypoints,
    },
    crowds: {
      layers: layers.length,
      emitters,
      configuredDots,
    },
    networks: {
      customNetworks,
      nodes: graphNodes,
      edges: graphEdges,
    },
    highlights: {
      areas,
      polygons,
      polygonVertices,
    },
  };
}

/**
 * Format the aggregate summary as one concise paragraph.
 * @param {ReturnType<summarizePlayerScene>} summary
 * @returns {string}
 */
export function formatPlayerSceneSummary(summary) {
  const { timeline, route, crowds, networks, highlights } = summary;
  return [
    timeline.durationMs > 0
      ? `Timeline: ${formatPlayerTime(timeline.durationMs)}.`
      : 'Timeline: no playable route timeline.',
    `Route: ${countLabel(route.waypoints, 'waypoint')} ` +
      `(${route.majorWaypoints} major, ${route.minorWaypoints} minor).`,
    `Crowds: ${countLabel(crowds.layers, 'layer')}, ` +
      `${countLabel(crowds.emitters, 'emitter')}, ${countLabel(crowds.configuredDots, 'configured dot')}.`,
    `Custom networks: ${countLabel(networks.customNetworks, 'network')}, ` +
      `${countLabel(networks.nodes, 'node')}, ${countLabel(networks.edges, 'edge')}.`,
    `Highlights: ${countLabel(highlights.areas, 'area')}, ` +
      `${countLabel(highlights.polygons, 'polygon')}, ` +
      `${countLabel(highlights.polygonVertices, 'polygon vertex', 'polygon vertices')}.`,
  ].join(' ');
}

/**
 * Render the summary through textContent so authored strings cannot become
 * markup. Returns the count object to aid deterministic testing/inspection.
 * @param {HTMLElement|null} element
 * @param {Object} player
 */
export function renderPlayerSceneSummary(element, player) {
  const summary = summarizePlayerScene(player);
  if (element) element.textContent = formatPlayerSceneSummary(summary);
  return summary;
}

/** Format a non-negative millisecond value as m:ss. */
export function formatPlayerTime(ms) {
  const safeMs = Number.isFinite(Number(ms)) ? Math.max(0, Number(ms)) : 0;
  const seconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function positionSnapshot(state) {
  return {
    currentTime: Number.isFinite(Number(state?.currentTime)) ? Number(state.currentTime) : 0,
    duration: Number.isFinite(Number(state?.duration)) ? Number(state.duration) : 0,
  };
}

/**
 * Create the sole writer for the standalone player's polite live region.
 * No engine event is subscribed here; playerEntry opts into completion only.
 *
 * @param {HTMLElement|null} element
 * @param {Object} [options]
 * @returns {Object} Explicit, discrete announcement methods.
 */
export function createTransportAnnouncer(element, options = {}) {
  const delayMs = options.keyboardSeekDelayMs ?? KEYBOARD_SEEK_ANNOUNCEMENT_DELAY_MS;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  let keyboardSeekTimer = null;

  const cancelKeyboardSeek = () => {
    if (keyboardSeekTimer === null) return;
    clearTimer(keyboardSeekTimer);
    keyboardSeekTimer = null;
  };

  const writeNow = (message) => {
    cancelKeyboardSeek();
    if (element) element.textContent = message;
  };

  const movedMessage = (state) => {
    const position = positionSnapshot(state);
    return `Moved to ${formatPlayerTime(position.currentTime)} of ${formatPlayerTime(position.duration)}.`;
  };

  return {
    ready(summary) {
      const timeline = summary?.timeline?.durationMs > 0
        ? `${formatPlayerTime(summary.timeline.durationMs)} timeline`
        : 'No playable route timeline';
      writeNow(
        `Ready. ${timeline}, ` +
        `${countLabel(summary?.route?.majorWaypoints ?? 0, 'major waypoint')}, ` +
        `${countLabel(summary?.crowds?.layers ?? 0, 'crowd layer')}.`
      );
    },
    play(state) {
      writeNow(`Playing from ${formatPlayerTime(positionSnapshot(state).currentTime)}.`);
    },
    pause(state) {
      writeNow(`Paused at ${formatPlayerTime(positionSnapshot(state).currentTime)}.`);
    },
    reset() {
      writeNow('Reset to start, 0:00.');
    },
    end(state) {
      writeNow(`Moved to end, ${formatPlayerTime(positionSnapshot(state).duration)}.`);
    },
    committedSeek(state) {
      writeNow(movedMessage(state));
    },
    scheduleKeyboardSeek(state) {
      if (!element) return;
      const message = movedMessage(positionSnapshot(state));
      cancelKeyboardSeek();
      keyboardSeekTimer = setTimer(() => {
        keyboardSeekTimer = null;
        element.textContent = message;
      }, delayMs);
    },
    speed(speed) {
      const numericSpeed = Number(speed);
      if (!Number.isFinite(numericSpeed)) return;
      const message = numericSpeed === 1
        ? 'Playback speed set to normal.'
        : `Playback speed set to ${numericSpeed} times normal.`;
      writeNow(message);
    },
    complete(state) {
      writeNow(`Playback complete at ${formatPlayerTime(positionSnapshot(state).duration)}.`);
    },
    cancel: cancelKeyboardSeek,
  };
}
