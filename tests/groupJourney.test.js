import { expect, test } from 'vitest';
import { GraphModel } from '../src/models/GraphModel.js';
import { buildGroupRouting, chooseGroupDeparture } from '../src/utils/groupRouting.js';
import { createGroupArc, traceGroupJourney, sampleGroupJourney, groupNormal, groupOffsets } from '../src/utils/groupJourney.js';

const near = (actual, expected, places = 13) => {
  expect(actual.x).toBeCloseTo(expected.x, places); expect(actual.y).toBeCloseTo(expected.y, places);
};
const make = (nodes, edges) => {
  const graph = new GraphModel();
  nodes.forEach(n => graph.addNode(n)); edges.forEach(e => graph.addEdge(e));
  const routing = buildGroupRouting(graph);
  routing.arcs = routing.edges.map(e => createGroupArc([graph.getNode(e.sourceId).position(),
    ...e.controlPoints, graph.getNode(e.targetId).position()],
  graph.getNode(e.sourceId).position(), graph.getNode(e.targetId).position()));
  return routing;
};
const trace = (routing, pick = () => 0) => traceGroupJourney(routing, routing.entries[0],
  (pool, from, hop) => chooseGroupDeparture(pool, from, pick(hop)), ordinal => routing.arcs[ordinal]);

test('true arc length, pinned endpoints, nonuniform segments and zero segments have independent expected samples', () => {
  const diagonal = createGroupArc([{ x: 0, y: 0 }, { x: 0.3, y: 0.4 }], { x: 0, y: 0 }, { x: 0.3, y: 0.4 });
  expect(diagonal.length).toBe(0.5);
  expect(diagonal.sample(0.25).point).toEqual({ x: 0.15, y: 0.2 });
  const arc = createGroupArc([{ x: -9, y: -9 }, { x: 0.1, y: 0 }, { x: 0.1, y: 0 }, { x: 9, y: 9 }],
    { x: 0, y: 0 }, { x: 0.1, y: 0.3 });
  expect(arc.length).toBe(0.4);
  near(arc.sample(0.05).point, { x: 0.05, y: 0 });
  near(arc.sample(0.25).point, { x: 0.1, y: 0.15 });
  expect(arc.sample(0.1).tangent).toMatchObject({ x: 0, y: 1 });
  expect(arc.sample(0.4).point).toEqual({ x: 0.1, y: 0.3 });
  const tiny = createGroupArc([{ x: 0, y: 0 }, { x: Number.MIN_VALUE, y: 0 }],
    { x: 0, y: 0 }, { x: Number.MIN_VALUE, y: 0 });
  expect(tiny.length).toBe(Number.MIN_VALUE);
  expect(tiny.sample(0).tangent).toMatchObject({ x: 1, y: 0 });
});

test('row-major partial grid fixes across/behind places and both width boundaries', () => {
  expect(groupOffsets(5, 0.2)).toEqual([
    { across: -0.1, behind: 0 }, { across: 0, behind: 0 }, { across: 0.1, behind: 0 },
    { across: -0.1, behind: 0.2 }, { across: 0.1, behind: 0.2 },
  ]);
  expect(groupOffsets(1, 0.2)).toEqual([{ across: 0, behind: 0 }]);
  expect(groupOffsets(4, 0)).toEqual(Array.from({ length: 4 }, () => ({ across: 0, behind: 0 })));
});

test('reversed joins, endpoint extensions and a U-turn have bounded continuous chord normals', () => {
  const r = make([{ id: 'a', x: 0, y: 0, type: 'entry' }, { id: 'b', x: 1, y: 0 },
    { id: 'c', x: 1, y: 1, type: 'exit' }],
  [{ id: 'ab', sourceId: 'b', targetId: 'a' }, { id: 'bc', sourceId: 'b', targetId: 'c' }]);
  const j = trace(r);
  expect(j.ends).toBe(true); expect(j.length).toBe(2); expect(j.hops).toBe(2);
  expect(j.codes).toEqual(new Uint16Array([1, 2]));
  near(sampleGroupJourney(j, -0.1).point, { x: -0.1, y: 0 });
  near(sampleGroupJourney(j, 1).point, { x: 1, y: 0 });
  expect(sampleGroupJourney(j, 1).tangent).toMatchObject({ x: 0, y: 1 });
  near(sampleGroupJourney(j, 2.1).point, { x: 1, y: 1.1 });
  near(groupNormal(j, 1, 0.2), { x: -0.5, y: 0.5 });
  near(groupNormal(j, 1 - 1e-7, 0.2), { x: -0.4999995, y: 0.5000005 }, 8);
  expect(groupNormal(j, 1, Number.MIN_VALUE)).toEqual({ x: 0, y: 0 });
  expect(groupNormal(j, 1, 0)).toEqual({ x: 0, y: 0 });
  const u = make([{ id: 'a', x: 0, y: 0, type: 'entry' }, { id: 'b', x: 1, y: 0 },
    { id: 'c', x: 0, y: 0, type: 'exit' }],
  [{ id: 'ab', sourceId: 'a', targetId: 'b' }, { id: 'bc', sourceId: 'b', targetId: 'c' }]);
  expect(groupNormal(trace(u), 1, 0.25)).toEqual({ x: 0, y: 0 });
});

test('coincident geometry has a deterministic extension but no sway tangent', () => {
  const r = make([{ id: 'a', x: 0.4, y: 0.5, type: 'entry' }, { id: 'b', x: 0.4, y: 0.5, type: 'exit' }],
    [{ id: 'ab', sourceId: 'a', targetId: 'b' }]);
  const j = trace(r); expect(j.length).toBe(0); expect(j.ends).toBe(true);
  expect(sampleGroupJourney(j, 0)).toEqual({ point: { x: 0.4, y: 0.5 }, tangent: null });
  near(sampleGroupJourney(j, -0.1).point, { x: 0.3, y: 0.5 });
  near(groupNormal(j, 0, 0.2), { x: 0, y: 1 });
});

test('2048-hop nonending loop uses trimmed packed arrays and exact sequential checkpoints; every sample matches linear oracle', () => {
  const r = make([{ id: 'a', x: 0, y: 0, type: 'entry' }, { id: 'b', x: 0.003, y: 0 }],
    [{ id: 'ab', sourceId: 'a', targetId: 'b' }, { id: 'ba', sourceId: 'b', targetId: 'a' }]);
  const j = trace(r);
  expect(j.ends).toBe(false); expect(j.hops).toBe(2048);
  expect(j.codes).toBeInstanceOf(Uint16Array); expect(j.codes.byteLength).toBe(4096);
  expect(j.checkpoints).toBeInstanceOf(Float64Array); expect(j.checkpoints.byteLength).toBe(520);
  let total = 0; const prefix = [0];
  for (let i = 0; i < 2048; i++) { total += 0.003; prefix.push(total); }
  expect(j.length).toBe(total);
  for (let i = 0; i <= 64; i++) expect(j.checkpoints[i]).toBe(prefix[i * 32]);
  for (let i = 0; i < 100; i++) {
    const distance = total * i / 100;
    let k = 0; while (prefix[k + 1] <= distance) k++;
    const fraction = (distance - prefix[k]) / (prefix[k + 1] - prefix[k]);
    near(sampleGroupJourney(j, distance).point, { x: k % 2 ? 0.003 * (1 - fraction) : 0.003 * fraction, y: 0 });
  }
  const second = trace(r); expect(second.codes).toEqual(j.codes);
  expect(second.codes.buffer).not.toBe(j.codes.buffer);
  expect(r.arcs).toHaveLength(2);
  const short = make([{ id: 'a', type: 'entry' }, { id: 'b', x: 0.5, type: 'exit' }],
    [{ id: 'ab', sourceId: 'a', targetId: 'b' }]);
  const sj = trace(short);
  expect(sj.codes.byteLength).toBe(2); expect(sj.checkpoints.byteLength).toBe(16);
});

test('raw graphs above the Uint16 packing range use Uint32 without truncating ordinals', () => {
  const graph = new GraphModel(); graph.addNode({ id: 'a', type: 'entry', x: 0, y: 0 });
  for (let i = 0; i < 33000; i++) graph.addEdge({ id: `e${i}`, sourceId: 'a', targetId: 'a' });
  const routing = buildGroupRouting(graph), ordinal = 32999;
  const arc = createGroupArc([{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0, y: 0 }], { x: 0, y: 0 }, { x: 0, y: 0 });
  const journey = traceGroupJourney(routing, graph.getNode('a'), () => routing.byNode.get('a').departures[ordinal], () => arc);
  expect(journey.codes).toBeInstanceOf(Uint32Array); expect(journey.codes[0]).toBe(65998);
  expect(journey.codes[2047]).toBe(65998); expect(journey.ends).toBe(false);
});

test('zero-length duplicate checkpoint blocks still sample the next real segment and exact joins', () => {
  const graph = new GraphModel();
  for (let i = 0; i <= 80; i++) graph.addNode({ id: `n${i}`, type: i === 0 ? 'entry' : i === 80 ? 'exit' : 'normal',
    x: i <= 40 ? 0 : (i - 40) / 128, y: 0 });
  for (let i = 0; i < 80; i++) graph.addEdge({ id: `e${i}`, sourceId: `n${i}`, targetId: `n${i + 1}`, direction: 'one-way' });
  const routing = buildGroupRouting(graph);
  const journey = traceGroupJourney(routing, graph.getNode('n0'), pool => pool.departures[0], ordinal => {
    const edge = routing.edges[ordinal], a = graph.getNode(edge.sourceId).position(), b = graph.getNode(edge.targetId).position();
    return createGroupArc([a, b], a, b);
  });
  expect(journey.checkpoints[0]).toBe(0); expect(journey.checkpoints[1]).toBe(0);
  expect(journey.checkpoints[2]).toBe(24 / 128); expect(journey.hops).toBe(80); expect(journey.ends).toBe(true);
  for (const d of [0, 1 / 128, 23 / 128, 24 / 128, 25 / 128, 40 / 128]) {
    near(sampleGroupJourney(journey, d).point, { x: d, y: 0 });
  }
});

test('zero-width and radius-underflow normals need no geometry reads', () => {
  for (const width of [0, Number.MIN_VALUE]) {
    let reads = 0;
    const journey = new Proxy({ length: 0, start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }, {
      get(target, key) { reads++; return target[key]; },
    });
    expect(groupNormal(journey, 0, width)).toEqual({ x: 0, y: 0 }); expect(reads).toBe(0);
  }
});
