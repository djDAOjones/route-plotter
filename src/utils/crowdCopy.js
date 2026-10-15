import { Emitter } from '../models/Emitter.js';

/** Detached canonical copy; only identity, display name and authoring-time seeds change. */
export function createCrowdCopy(source, usedIds = []) {
  const copy = JSON.parse(JSON.stringify(source));
  const used = new Set([...usedIds, source.id, ...source.emitters.map(emitter => emitter.id),
    ...source.graph.nodes.map(node => node.id), ...source.graph.edges.map(edge => edge.id)]);
  let serial = 0;
  const nextId = () => {
    let id;
    do { id = `copy-${++serial}`; } while (used.has(id));
    used.add(id);
    return id;
  };
  const sourceName = source.name.trim();
  let name = sourceName.slice(0, 195);
  // Avoid creating a lone surrogate when a long valid name crosses the UTF-16 limit.
  if (/[\uD800-\uDBFF]$/.test(name) && /^[\uDC00-\uDFFF]/.test(sourceName.slice(195))) name = name.slice(0, -1);
  copy.name = sourceName ? `${name} copy` : 'Crowd copy';
  copy.id = nextId();
  const nodes = new Map();
  for (const node of copy.graph.nodes) {
    const id = nextId();
    nodes.set(node.id, id);
    node.id = id;
  }
  for (const edge of copy.graph.edges) {
    edge.id = nextId();
    edge.sourceId = nodes.get(edge.sourceId);
    edge.targetId = nodes.get(edge.targetId);
  }
  for (const data of copy.emitters) {
    data.id = nextId();
    const emitter = Emitter.fromJSON(data);
    data.seed = emitter.reseed();
  }
  return copy;
}
