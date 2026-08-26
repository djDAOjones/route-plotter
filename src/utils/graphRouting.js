/**
 * Pure graph-routing helpers shared by the deterministic swarm evaluator and
 * network authoring UI. Keeping direction filtering and display shares here
 * prevents the inspector from promising choices the engine cannot make.
 */

/**
 * Return edges that can be traversed away from a node in graph insertion
 * order. The arrival edge is avoided when another onward path exists, matching
 * natural walking without turning a single two-way edge into a dead end.
 *
 * @param {import('../models/GraphModel.js').GraphModel} graph
 * @param {string} nodeId
 * @param {{cameFromEdgeId?: string|null}} [options]
 * @returns {Array<{edge: import('../models/GraphEdge.js').GraphEdge, reversed: boolean}>}
 */
export function getGraphDepartures(graph, nodeId, { cameFromEdgeId = null } = {}) {
  const departures = [];
  for (const edge of graph.getEdgesForNode(nodeId)) {
    if (edge.sourceId === nodeId) {
      departures.push({ edge, reversed: false });
    } else if (edge.direction === 'two-way') {
      departures.push({ edge, reversed: true });
    }
  }

  if (!cameFromEdgeId) return departures;
  const onward = departures.filter(({ edge }) => edge.id !== cameFromEdgeId);
  return onward.length > 0 ? onward : departures;
}

/**
 * Normalize positive relative weights without overflowing their sum. Scaling
 * by the largest weight preserves every ratio while keeping the accumulator
 * bounded by the number of candidates.
 *
 * @param {number[]} values
 * @returns {number[]}
 */
export function normalizeGraphWeights(values) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const weights = values.map(value =>
    Number.isFinite(value) && value > 0 ? value : 0.01
  );
  const scale = Math.max(...weights);
  const scaled = weights.map(weight => weight / scale);
  const total = scaled.reduce((sum, weight) => sum + weight, 0);
  return scaled.map(weight => weight / total);
}

/**
 * Add exact shares and stable whole-number display percentages to a node's
 * departures. Largest-remainder rounding guarantees the displayed rows total
 * 100%; equal remainders resolve in authored edge order.
 *
 * @param {import('../models/GraphModel.js').GraphModel} graph
 * @param {string} nodeId
 * @param {{cameFromEdgeId?: string|null}} [options]
 * @returns {Array<{edge: import('../models/GraphEdge.js').GraphEdge,
 *                  reversed: boolean, share: number, percent: number}>}
 */
export function getGraphDepartureShares(graph, nodeId, options = {}) {
  const departures = getGraphDepartures(graph, nodeId, options);
  if (departures.length === 0) return [];

  const shares = normalizeGraphWeights(departures.map(({ edge }) => edge.weight));
  const exactPercents = shares.map(share => share * 100);
  const percents = exactPercents.map(Math.floor);
  const remainder = 100 - percents.reduce((sum, percent) => sum + percent, 0);

  const ranked = exactPercents
    .map((exact, index) => ({ index, fraction: exact - percents[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i++) {
    percents[ranked[i].index]++;
  }

  return departures.map((departure, index) => ({
    ...departure,
    share: shares[index],
    percent: percents[index],
  }));
}
