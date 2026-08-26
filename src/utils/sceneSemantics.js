/**
 * Pure semantic projection of the canonical RoutePlotter project.
 *
 * The canvas remains the visual renderer. This module creates a bounded,
 * DOM-free view model for the keyboard/non-visual scene outline. It never
 * mutates models and never copies image bytes or other private metadata.
 */

const round = (value, places = 3) => {
  const factor = 10 ** places;
  return Math.round(Number(value) * factor) / factor;
};

// Keep authoring values lossless. Human-facing summaries use the rounded
// companion labels, while number inputs receive the full JS round-trip value.
const percent = value => Number(value) * 100;
const percentLabel = value => round(Number(value) * 100, 2);

/**
 * Build an injective semantic key from a typed tuple. Encoding every part
 * keeps the colon separator structural: IDs containing colons or percent-like
 * text cannot impersonate a different tuple or one of the controller suffixes.
 * Existing generated IDs remain human-readable. A persisted lone UTF-16
 * surrogate is escaped with a reserved `%uXXXX` form: ordinary percent signs
 * become `%25`, so malformed-but-accepted legacy IDs remain distinct without
 * making `encodeURIComponent` throw and disable the whole outline.
 *
 * @param {string} kind
 * @param {...(string|number)} parts
 * @returns {string}
 */
export function sceneOutlineKey(kind, ...parts) {
  return [kind, ...parts].map(encodeSceneKeyPart).join(':');
}

function encodeSceneKeyPart(part) {
  const value = String(part);
  let encoded = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const next = value.charCodeAt(index + 1);
    if (code >= 0xD800 && code <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) {
      encoded += encodeURIComponent(value.slice(index, index + 2));
      index += 1;
    } else if (code >= 0xD800 && code <= 0xDFFF) {
      encoded += `%u${code.toString(16).toUpperCase().padStart(4, '0')}`;
    } else {
      encoded += encodeURIComponent(value[index]);
    }
  }
  return encoded;
}

function waypointName(waypoint, majorNumber, routeNumber) {
  const authored = typeof waypoint.name === 'string' && waypoint.name.trim()
    ? waypoint.name.trim()
    : (typeof waypoint.label === 'string' ? waypoint.label.trim() : '');
  const base = waypoint.isMajor
    ? `Major waypoint ${majorNumber}`
    : `Minor waypoint ${routeNumber}`;
  return authored ? `${base} — ${authored}` : base;
}

function nodeName(node, index) {
  const authored = typeof node.label === 'string' ? node.label.trim() : '';
  const type = node.type === 'normal' ? 'pass-through' : node.type;
  const base = `Node ${index + 1} — ${type}`;
  return authored ? `${base} — ${authored}` : base;
}

function emitterDescriptor(emitter, index, layerId) {
  return {
    key: sceneOutlineKey('emitter', layerId, emitter.id),
    id: emitter.id,
    index,
    primary: index === 0,
    dotCount: emitter.dotCount,
    speed: emitter.speed,
    speedVariance: percent(emitter.speedVariance),
    speedVarianceCanonical: emitter.speedVariance,
    dotSize: emitter.dotSize,
    dotColor: emitter.dotColor,
    lifecycleMode: emitter.lifecycleMode,
    releaseStart: percent(emitter.releaseStart),
    releaseStartCanonical: emitter.releaseStart,
    releaseDuration: percent(emitter.releaseDuration),
    releaseDurationCanonical: emitter.releaseDuration,
    onsetVariance: percent(emitter.onsetVariance),
    onsetVarianceCanonical: emitter.onsetVariance,
    intensityRamp: percent(emitter.intensityRamp),
    intensityRampCanonical: emitter.intensityRamp,
    busynessEnvelope: emitter.busynessEnvelope.map(handle => ({
      time: percent(handle.time),
      timeCanonical: handle.time,
      value: percent(handle.value),
      valueCanonical: handle.value,
      transition: handle.transition,
    })),
    wobble: percent(emitter.wobble),
    wobbleCanonical: emitter.wobble,
    seed: emitter.seed,
  };
}

function graphDescriptor(layer) {
  const nodes = layer.graph.getNodes();
  const nodeNumber = new Map(nodes.map((node, index) => [node.id, index + 1]));
  const edges = layer.graph.getEdges().map((edge, index) => ({
    key: sceneOutlineKey('edge', layer.id, edge.id),
    id: edge.id,
    index,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    sourceName: `Node ${nodeNumber.get(edge.sourceId) ?? '?'}`,
    targetName: `Node ${nodeNumber.get(edge.targetId) ?? '?'}`,
    direction: edge.direction,
    weight: edge.weight,
    controlPoints: edge.controlPoints.map((point, controlIndex) => ({
      key: sceneOutlineKey('control', layer.id, edge.id, controlIndex),
      index: controlIndex,
      x: percent(point.x),
      y: percent(point.y),
      xLabel: percentLabel(point.x),
      yLabel: percentLabel(point.y),
      xCanonical: point.x,
      yCanonical: point.y,
    })),
  }));

  return {
    key: sceneOutlineKey('network', layer.id),
    active: layer.guideType === 'graph',
    nodes: nodes.map((node, index) => ({
      key: sceneOutlineKey('node', layer.id, node.id),
      id: node.id,
      index,
      name: nodeName(node, index),
      x: percent(node.x),
      y: percent(node.y),
      xLabel: percentLabel(node.x),
      yLabel: percentLabel(node.y),
      xCanonical: node.x,
      yCanonical: node.y,
      type: node.type,
      label: node.label ?? '',
      connectedEdges: layer.graph.getEdgesForNode(node.id).length,
    })),
    edges,
  };
}

function containsSelectionKey(route, crowds, selectionKey) {
  if (!selectionKey) return false;
  for (const waypoint of route) {
    if (selectionKey === waypoint.key) return true;
    if (waypoint.area.shape !== 'polygon') continue;
    if (selectionKey === waypoint.area.key) return true;
    if (waypoint.area.points.some(point => selectionKey === point.key)) return true;
  }
  for (const crowd of crowds) {
    if (selectionKey === crowd.key || selectionKey === crowd.graph.key) return true;
    if (crowd.emitters.some(emitter => selectionKey === emitter.key)) return true;
    if (crowd.graph.nodes.some(node => selectionKey === node.key)) return true;
    for (const edge of crowd.graph.edges) {
      if (selectionKey === edge.key) return true;
      if (edge.controlPoints.some(point => selectionKey === point.key)) return true;
    }
  }
  return false;
}

/**
 * Build the plain scene-outline view model.
 * @param {Object} options
 * @param {Array<Object>} options.waypoints
 * @param {import('../models/Scene.js').Scene} options.scene
 * @param {string|null} [options.selectionKey]
 * @param {string|null} [options.focusKey]
 */
export function buildSceneOutlineSnapshot({
  waypoints = [],
  scene,
  selectionKey = null,
  focusKey = null,
} = {}) {
  let majorNumber = 0;
  const route = waypoints.map((waypoint, routeIndex) => {
    if (waypoint.isMajor) majorNumber += 1;
    const points = Array.isArray(waypoint.areaHighlight?.points)
      ? waypoint.areaHighlight.points
      : [];
    const area = waypoint.areaHighlight || {};
    return {
      key: sceneOutlineKey('waypoint', waypoint.id),
      id: waypoint.id,
      routeIndex,
      majorNumber: waypoint.isMajor ? majorNumber : null,
      isMajor: Boolean(waypoint.isMajor),
      name: waypointName(waypoint, majorNumber, routeIndex + 1),
      x: percent(waypoint.imgX),
      y: percent(waypoint.imgY),
      xLabel: percentLabel(waypoint.imgX),
      yLabel: percentLabel(waypoint.imgY),
      xCanonical: waypoint.imgX,
      yCanonical: waypoint.imgY,
      pauseSeconds: Number(waypoint.pauseTime || 0) / 1000,
      pauseMsCanonical: Number(waypoint.pauseTime || 0),
      segmentSpeed: Number(waypoint.segmentSpeed ?? 1),
      area: {
        key: sceneOutlineKey('polygon', waypoint.id),
        enabled: Boolean(area.enabled),
        shape: area.shape || 'none',
        fadeInSeconds: Number(area.fadeInMs || 0) / 1000,
        fadeOutSeconds: Number(area.fadeOutMs || 0) / 1000,
        fadeInMsCanonical: Number(area.fadeInMs || 0),
        fadeOutMsCanonical: Number(area.fadeOutMs || 0),
        points: points.map((point, index) => ({
          key: sceneOutlineKey('vertex', waypoint.id, index),
          index,
          x: percent(point.x),
          y: percent(point.y),
          xLabel: percentLabel(point.x),
          yLabel: percentLabel(point.y),
          xCanonical: point.x,
          yCanonical: point.y,
        })),
      },
    };
  });

  const layers = scene?.getFlowLayers?.() || [];
  const crowds = layers.map((layer, index) => ({
    key: sceneOutlineKey('crowd', layer.id),
    id: layer.id,
    index,
    name: layer.name,
    displayName: typeof layer.name === 'string' && layer.name.trim()
      ? layer.name
      : `Crowd ${index + 1}`,
    visible: layer.visible,
    guideType: layer.guideType,
    emitters: layer.getEmitters().map((emitter, emitterIndex) =>
      emitterDescriptor(emitter, emitterIndex, layer.id)
    ),
    graph: graphDescriptor(layer),
  }));

  return {
    route,
    crowds,
    majorCount: route.filter(waypoint => waypoint.isMajor).length,
    minorCount: route.filter(waypoint => !waypoint.isMajor).length,
    selectionKey: containsSelectionKey(route, crowds, selectionKey) ? selectionKey : null,
    focusKey,
  };
}
