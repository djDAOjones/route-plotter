import { graphEntryCumulative } from './graphRouting.js';

/** Active groups only: one ordered index and one shared sum tree per outgoing node. */
export function buildGroupRouting(graph) {
  const nodes = graph.getNodes(), edges = graph.getEdges();
  const byNode = new Map(nodes.map(node => [node.id, { departures: [], indices: new Map() }]));
  const incidence = new Map();
  const add = (id, edge, ordinal, reversed) => {
    const pool = byNode.get(id);
    if (!pool) return;
    pool.indices.set(edge.id, pool.departures.length);
    pool.departures.push({ edge, ordinal, reversed });
  };
  edges.forEach((edge, ordinal) => {
    incidence.set(edge.sourceId, (incidence.get(edge.sourceId) || 0) + 1);
    incidence.set(edge.targetId, (incidence.get(edge.targetId) || 0) + 1);
    add(edge.sourceId, edge, ordinal, false);
    if (edge.direction === 'two-way' && edge.sourceId !== edge.targetId) add(edge.targetId, edge, ordinal, true);
  });
  for (const pool of byNode.values()) {
    const weights = pool.departures.map(({ edge }) => {
      const value = edge.weight;
      return Number.isFinite(value) && value > 0 ? value : 0.01;
    });
    let max = 0;
    for (const weight of weights) max = Math.max(max, weight);
    let capacity = 1, depth = 0;
    while (capacity < weights.length) { capacity *= 2; depth++; }
    const tree = new Float64Array(weights.length ? capacity * 2 : 0);
    weights.forEach((weight, index) => { tree[capacity + index] = weight / max; });
    for (let index = capacity - 1; index > 0; index--) tree[index] = tree[index * 2] + tree[index * 2 + 1];
    Object.assign(pool, { tree, capacity, depth, scratch: new Float64Array(depth + 1) });
  }
  const explicit = nodes.filter(node => node.type === 'entry');
  const entries = explicit.length ? explicit : nodes.filter(node => byNode.get(node.id).departures.length);
  const fallbackExits = nodes.some(node => node.type === 'exit') ? null
    : new Set([...incidence].filter(([, count]) => count === 1).map(([id]) => id));
  return { type: 'graph', graph, edges, byNode, incidence, entries, fallbackExits,
    entryCumulative: explicit.length ? graphEntryCumulative(explicit) : null };
}

function effectiveMass(pool, index, level, leaf) {
  return leaf !== -1 && index === Math.floor(leaf / 2 ** (pool.depth - level))
    ? pool.scratch[level] : pool.tree[index];
}

/**
 * Rebuild just the excluded root-to-leaf path. Root-minus-weight would erase
 * all tiny eligible masses when the incoming edge has the only huge weight.
 * Scratch is synchronous derived work; no journey retains it.
 */
export function chooseGroupDeparture(pool, fromEdgeId, random) {
  if (!pool?.departures.length) return null;
  const { tree, capacity, depth, scratch, indices, departures } = pool;
  const excluded = departures.length > 1 ? indices.get(fromEdgeId) : undefined;
  const leaf = excluded === undefined ? -1 : capacity + excluded;
  if (leaf !== -1) {
    let child = leaf;
    scratch[depth] = 0;
    for (let level = depth - 1; level >= 0; level--) {
      const sibling = child % 2 ? child - 1 : child + 1;
      scratch[level] = child % 2 ? tree[sibling] + scratch[level + 1] : scratch[level + 1] + tree[sibling];
      child = Math.floor(child / 2);
    }
  }
  const total = effectiveMass(pool, 1, 0, leaf);
  if (!(total > 0)) return null;
  let target = random * total, index = 1;
  const rightmost = !(target < total);
  for (let level = 1; level <= depth; level++) {
    const left = index * 2;
    if (rightmost) index = effectiveMass(pool, left + 1, level, leaf) > 0 ? left + 1 : left;
    else {
      const leftMass = effectiveMass(pool, left, level, leaf);
      if (target < leftMass) index = left;
      else { target -= leftMass; index = left + 1; }
    }
  }
  return departures[index - capacity];
}
