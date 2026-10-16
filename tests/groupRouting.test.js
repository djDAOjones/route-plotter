import { expect, test, vi } from 'vitest';
import { GraphModel } from '../src/models/GraphModel.js';
import { getGraphDepartures } from '../src/utils/graphRouting.js';
import { buildGroupRouting, chooseGroupDeparture } from '../src/utils/groupRouting.js';

const graph = () => {
  const g = new GraphModel();
  for (const id of ['a', 'b', 'c', 'isolated']) g.addNode({ id });
  return g;
};
const edge = (g, id, sourceId, targetId, weight = 1, direction = 'two-way') =>
  g.addEdge({ id, sourceId, targetId, weight, direction });

test('indexed order/direction/bounce matches old departures; loop has one departure but two incidences', () => {
  const g = graph();
  edge(g, 'loop', 'a', 'a'); edge(g, 'incoming', 'b', 'a', 1, 'one-way');
  edge(g, 'ab', 'a', 'b'); edge(g, 'ca', 'c', 'a');
  const r = buildGroupRouting(g);
  for (const node of g.getNodes()) {
    const pool = r.byNode.get(node.id);
    expect(pool.departures.map(({ edge: e, reversed }) => [e.id, reversed]))
      .toEqual(getGraphDepartures(g, node.id).map(({ edge: e, reversed }) => [e.id, reversed]));
  }
  expect(r.byNode.get('a').departures.filter(d => d.edge.id === 'loop')).toHaveLength(1);
  expect(r.incidence.get('a')).toBe(5);
  expect(r.byNode.get('a').departures.some(d => d.edge.id === 'incoming')).toBe(false);
  expect(r.entries.map(n => n.id)).toEqual(['a', 'b', 'c']);
  expect([...r.fallbackExits]).toEqual(['c']);
  const single = graph(); edge(single, 'only', 'a', 'b');
  const bounced = chooseGroupDeparture(buildGroupRouting(single).byNode.get('b'), 'only', 0.9);
  expect(bounced).not.toBeNull(); expect(bounced.edge.id).toBe('only');
});

test('explicit Entry order/stranded nodes and explicit Exits retain existing fallback rules', () => {
  const g = graph(); g.getNode('isolated').type = 'entry'; g.getNode('a').type = 'entry';
  g.getNode('b').type = 'exit'; edge(g, 'ab', 'a', 'b');
  const r = buildGroupRouting(g);
  expect(r.entries.map(n => n.id)).toEqual(['a', 'isolated']);
  expect(r.fallbackExits).toBeNull();
  expect(chooseGroupDeparture(r.byNode.get('isolated'), null, 0.5)).toBeNull();
});

test('tree thresholds use an independent exact binary oracle, including exclusion at leaf zero and padded leaves', () => {
  const g = graph(); edge(g, 'one', 'a', 'b', 1); edge(g, 'three', 'a', 'c', 3); edge(g, 'four', 'a', 'a', 4);
  const p = buildGroupRouting(g).byNode.get('a');
  for (const [r, expected] of [[0, 'one'], [0.12499999, 'one'], [0.125, 'three'], [0.49999999, 'three'], [0.5, 'four'], [1, 'four']]) {
    const chosen = chooseGroupDeparture(p, null, r); expect(chosen).toBeTruthy();
    expect(chosen.edge.id).toBe(expected);
  }
  expect(chooseGroupDeparture(p, 'one', 0).edge.id).toBe('three');
  expect(chooseGroupDeparture(p, 'one', 3 / 7).edge.id).toBe('four');
  expect(chooseGroupDeparture(p, 'four', 0.25).edge.id).toBe('three');
  expect(chooseGroupDeparture(p, 'not-present', 0).edge.id).toBe('one');
  expect(chooseGroupDeparture(p, 'four', 1).edge.id).toBe('three');
});

test('excluding the sole huge weight retains tiny eligible mass without root subtraction', () => {
  const g = graph(); edge(g, 'huge', 'a', 'b', 1e308); edge(g, 'tiny1', 'a', 'c', 0.01); edge(g, 'tiny2', 'a', 'a', 0.02);
  const p = buildGroupRouting(g).byNode.get('a');
  const tiny = chooseGroupDeparture(p, 'huge', 0.1); expect(tiny).not.toBeNull();
  expect(tiny.edge.id).toBe('tiny1');
  expect(chooseGroupDeparture(p, 'huge', 0.9).edge.id).toBe('tiny2');
  expect(chooseGroupDeparture(p, 'huge', 1).edge.id).toBe('tiny2');
});

test('4000-loop cache-churn choices read O(log degree) cached sums and no raw weights/whole-edge queries', () => {
  const g = graph(); let rawReads = 0;
  for (let i = 0; i < 4000; i++) {
    const e = edge(g, `loop${i}`, 'a', 'a');
    Object.defineProperty(e, 'weight', { get() { rawReads++; return 1; } });
  }
  const whole = vi.spyOn(g, 'getEdgesForNode').mockImplementation(() => { throw new Error('whole-edge scan'); });
  const r = buildGroupRouting(g), p = r.byNode.get('a');
  expect(rawReads).toBeLessThanOrEqual(8000); const builtReads = rawReads;
  let reads = 0;
  p.tree = new Proxy(p.tree, { get(target, key) { if (/^\d+$/.test(String(key))) reads++; return Reflect.get(target, key, target); } });
  for (let i = 0; i < 4096; i++) {
    const before = reads, from = `loop${i % 4000}`;
    const chosen = chooseGroupDeparture(p, from, ((i * 271) % 4096) / 4096);
    expect(chosen.edge.id).not.toBe(from);
    expect(reads - before).toBeLessThanOrEqual(4 * 12 + 4);
  }
  expect(rawReads).toBe(builtReads); expect(whole).not.toHaveBeenCalled();
  expect(r.entries.map(n => n.id)).toEqual(['a']);
  expect(r.incidence.get('a')).toBe(8000); expect(r.fallbackExits.size).toBe(0);
});
