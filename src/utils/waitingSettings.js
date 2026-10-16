export const WAITING_FIELD_HINT = 'Show every dot in its Start area from the beginning; '
  + 'Apply final whistle accepts this edit';

export const WAITING_HINT = 'When on, dots wait at their seeded Start points, then leave nearest to their Entry first. '
  + 'Ties use dot index. The release window uses the project’s reference timeline; variation changes the spread, '
  + 'while departures stay nearest first. Each dot keeps its own pace and path. Apply final whistle accepts this edit; '
  + 'Cancel edits restores the stored setting. Groups stays stored but inactive while Final whistle is on.';

export const WAITING_RELEASE_HINTS = Object.freeze({
  start: 'When the first dots leave, as a position in the project’s reference timeline; nearest to Entry leaves first',
  length: 'How much of the project’s reference timeline the nearest-first departures are spread across',
  timing: 'How unevenly departures are spread; dots still leave nearest to their Entry first',
  bias: 'Earlier and Later change the departure spread across the window; nearest-first order stays the same',
});

export function assertWaitingSettings(data) {
  if ('waitAtStart' in data && typeof data.waitAtStart !== 'boolean') {
    throw new Error('Final whistle must be on or off.');
  }
}

/** Derive graph prerequisites once per layer pass, never once per dot. */
export function waitingLayerReason(layer) {
  if (layer?.guideType !== 'graph') return 'Choose Custom network to use Final whistle.';
  const nodes = layer.graph.getNodes();
  if (!nodes.length || !layer.graph.getEdges().length) {
    return 'Draw a network with at least one path to use Final whistle.';
  }
  const entries = nodes.filter(node => node.type === 'entry');
  if (!entries.length) return 'Add an Entry node with a Start area to use Final whistle.';
  if (entries.some(node => !node.area)) return 'Give every Entry node a Start area to use Final whistle.';
  return '';
}

export function waitingUnavailableReason(layer, emitter, layerReason = waitingLayerReason(layer)) {
  if (layerReason) return layerReason;
  if (!['disappear', 'collect'].includes(emitter?.lifecycleMode)) {
    return 'Choose Disappear or Collect at the end to use Final whistle.';
  }
  return '';
}

export function waitingActive(layer, emitter, layerReason = waitingLayerReason(layer)) {
  return emitter?.waitAtStart === true && !waitingUnavailableReason(layer, emitter, layerReason);
}
