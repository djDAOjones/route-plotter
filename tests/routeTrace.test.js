/**
 * COMPOSE-03 — tracing the hero route into a crowd guide network.
 *
 * The trace is a copy, so the two things worth defending are that the copy is
 * *faithful* — same shape, same branching, same direction of travel — and that
 * it is genuinely a copy: reshaping the network must never reach back into the
 * route, and the route must survive the trace untouched.
 */

import { describe, test, expect } from 'vitest';
import { traceRouteIntoGraph, applyTraceToLayer, TRACE_PROBLEM } from '../src/utils/routeTrace.js';
import { resolveGraphAnchors } from '../src/utils/routeAnchors.js';
import { Scene } from '../src/models/Scene.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { ENTITY_ID_LIMITS, boundedEntityId } from '../src/utils/entityId.js';

const major = (id, x, y, extra = {}) =>
  Object.assign(Waypoint.createMajor(x, y), { id }, extra);
const minor = (id, x, y, extra = {}) =>
  Object.assign(Waypoint.createMinor(x, y), { id }, extra);

const linearRoute = () => [major('a', 0.1, 0.1), major('b', 0.5, 0.5), major('c', 0.9, 0.9)];

const branchedRoute = () => [
  major('a', 0.1, 0.1),
  major('f', 0.4, 0.4),
  major('b1', 0.4, 0.8, { branchId: 'B', branchFrom: 'f', branchRejoin: 'z' }),
  major('z', 0.9, 0.5),
];

describe('traceRouteIntoGraph', () => {
  test('a linear route traces to a node per major and an edge per leg', () => {
    const { nodes, edges, problems } = traceRouteIntoGraph(linearRoute());

    expect(problems).toEqual([]);
    expect(nodes.map(node => node.anchorWaypointId)).toEqual(['a', 'b', 'c']);
    expect(edges).toHaveLength(2);
    expect(edges.every(edge => edge.direction === 'one-way')).toBe(true);
  });

  test('every traced node is bound to the waypoint it came from', () => {
    const { nodes } = traceRouteIntoGraph(linearRoute());

    expect(nodes[0]).toMatchObject({ x: 0.1, y: 0.1, anchorWaypointId: 'a' });
    expect(nodes[2]).toMatchObject({ x: 0.9, y: 0.9, anchorWaypointId: 'c' });
  });

  test('minors become the edge’s control points, not nodes of their own', () => {
    const route = [major('a', 0, 0), minor('m1', 0.3, 0.1), minor('m2', 0.6, 0.2), major('b', 1, 1)];
    const { nodes, edges } = traceRouteIntoGraph(route);

    // A minor is geometry, not a junction: a node there would be a decision
    // point the route does not have.
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
    expect(edges[0].controlPoints).toEqual([{ x: 0.3, y: 0.1 }, { x: 0.6, y: 0.2 }]);
  });

  test('the first node is an entry and the last an exit', () => {
    const { nodes } = traceRouteIntoGraph(linearRoute());

    expect(nodes.map(node => node.type)).toEqual(['entry', 'normal', 'exit']);
  });

  test('a branch traces as edges leaving the fork and returning to the rejoin', () => {
    const { nodes, edges } = traceRouteIntoGraph(branchedRoute());
    const idOf = waypointId => nodes.find(node => node.anchorWaypointId === waypointId).id;
    const pairs = edges.map(edge => [edge.sourceId, edge.targetId]);

    expect(nodes).toHaveLength(4);
    // Trunk a→f→z, plus the branch f→b1→z: the crowd can split where the
    // route splits and rejoin where it rejoins.
    expect(pairs).toContainEqual([idOf('a'), idOf('f')]);
    expect(pairs).toContainEqual([idOf('f'), idOf('z')]);
    expect(pairs).toContainEqual([idOf('f'), idOf('b1')]);
    expect(pairs).toContainEqual([idOf('b1'), idOf('z')]);
  });

  test('a terminal branch gives the network a second exit', () => {
    const route = [
      major('a', 0.1, 0.1), major('f', 0.4, 0.4),
      major('b1', 0.4, 0.9, { branchId: 'B', branchFrom: 'f' }),
      major('z', 0.9, 0.5),
    ];
    const { nodes } = traceRouteIntoGraph(route);

    expect(nodes.filter(node => node.type === 'exit').map(node => node.anchorWaypointId).sort())
      .toEqual(['b1', 'z']);
  });

  test('outgoing edges at a fork share weight, so crowds split evenly by default', () => {
    const { nodes, edges } = traceRouteIntoGraph(branchedRoute());
    const forkId = nodes.find(node => node.anchorWaypointId === 'f').id;
    const outgoing = edges.filter(edge => edge.sourceId === forkId);

    expect(outgoing).toHaveLength(2);
    expect(new Set(outgoing.map(edge => edge.weight))).toEqual(new Set([1]));
  });

  test('a route of fewer than two majors is refused with a usable reason', () => {
    const { nodes, edges, problems } = traceRouteIntoGraph([major('a', 0, 0)]);

    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
    expect(problems[0].code).toBe(TRACE_PROBLEM.TOO_SHORT);
  });

  test('a broken branch structure is refused rather than half-traced', () => {
    const broken = [major('a', 0, 0), major('b1', 1, 1, { branchId: 'B', branchFrom: 'gone' })];
    const { nodes, problems } = traceRouteIntoGraph(broken);

    expect(nodes).toEqual([]);
    expect(problems[0].code).toBe(TRACE_PROBLEM.BRANCH_UNRESOLVED);
  });

  test('an empty route traces to nothing without throwing', () => {
    expect(traceRouteIntoGraph([]).problems[0].code).toBe(TRACE_PROBLEM.TOO_SHORT);
    expect(traceRouteIntoGraph().nodes).toEqual([]);
  });

  test('tracing never mutates the route', () => {
    const route = branchedRoute();
    const before = route.map(waypoint => waypoint.toJSON());

    traceRouteIntoGraph(route);

    expect(route.map(waypoint => waypoint.toJSON())).toEqual(before);
  });
});

describe('applyTraceToLayer', () => {
  const layerWithTrace = (route) => {
    const scene = new Scene();
    const layer = scene.addFlowLayer({ name: 'Crowd 1', guideType: 'route' });
    const applied = applyTraceToLayer(layer, traceRouteIntoGraph(route));
    return { scene, layer, applied };
  };

  test('writes the network and switches the layer to it', () => {
    const { layer, applied } = layerWithTrace(linearRoute());

    expect(applied).toEqual({ nodes: 3, edges: 2 });
    expect(layer.guideType).toBe('graph');
    expect(layer.graph.getNodes()).toHaveLength(3);
    expect(layer.graph.getEdges()).toHaveLength(2);
  });

  test('replaces whatever the layer held, rather than merging into it', () => {
    const { layer } = layerWithTrace(linearRoute());
    applyTraceToLayer(layer, traceRouteIntoGraph(branchedRoute()));

    expect(layer.graph.getNodes()).toHaveLength(4);
    expect(layer.graph.getNodes().every(node => node.anchorWaypointId)).toBe(true);
  });

  test('the traced network survives a save/load round-trip', () => {
    const { scene } = layerWithTrace(branchedRoute());
    const restored = Scene.fromJSON(JSON.parse(JSON.stringify(scene.toJSON())));
    const layer = restored.getFlowLayers()[0];

    expect(layer.graph.getNodes().map(node => node.anchorWaypointId).sort())
      .toEqual(['a', 'b1', 'f', 'z']);
    expect(layer.graph.getEdges()).toHaveLength(4);
  });

  test('traced nodes follow the route once resolved, keeping their own coords', () => {
    const route = linearRoute();
    const { scene, layer } = layerWithTrace(route);
    const node = layer.graph.getNodes().find(each => each.anchorWaypointId === 'b');

    route[1].setPosition(0.75, 0.25);
    resolveGraphAnchors(scene, new Map(route.map(waypoint => [waypoint.id, waypoint])));

    expect(node.position()).toEqual({ x: 0.75, y: 0.25 });
    expect([node.x, node.y]).toEqual([0.5, 0.5]);
  });

  test('reshaping the traced network never reaches back into the route', () => {
    const route = linearRoute();
    const before = route.map(waypoint => waypoint.toJSON());
    const { layer } = layerWithTrace(route);

    layer.graph.getEdges()[0].setWeight(4);
    layer.graph.addNode({ x: 0.3, y: 0.7 });

    expect(route.map(waypoint => waypoint.toJSON())).toEqual(before);
  });

  test('a layer with no graph is a no-op, not a throw', () => {
    expect(applyTraceToLayer(null, { nodes: [], edges: [] })).toEqual({ nodes: 0, edges: 0 });
  });
});

describe('traced ids fit the persisted id limit (DEF-31)', () => {
  // Waypoint ids up to the limit load, and the trace used to build on them
  // verbatim: `gn_trace_<id>` reached 265 characters and
  // `ge_trace_<from>__<to>` 523, which the loader refuses.
  const { MAX_LENGTH } = ENTITY_ID_LIMITS;
  /** A waypoint id of exactly the limit, ending in `tail`. */
  const longestId = (fill, tail = '') => `wp_${fill.repeat(MAX_LENGTH - 3 - tail.length)}${tail}`;
  const idsOf = ({ nodes, edges }) => [...nodes, ...edges].map(each => each.id);

  test('ids that fit are kept verbatim, so every existing trace keeps its ids', () => {
    const { nodes, edges } = traceRouteIntoGraph(linearRoute());

    expect(nodes.map(node => node.id)).toEqual(['gn_trace_a', 'gn_trace_b', 'gn_trace_c']);
    expect(edges.map(edge => edge.id)).toEqual(['ge_trace_a__b', 'ge_trace_b__c']);
  });

  test('the longest legitimate waypoint ids trace to ids that fit and still connect', () => {
    const route = [
      major(longestId('a'), 0.1, 0.1), major(longestId('b'), 0.5, 0.5), major(longestId('c'), 0.9, 0.9),
    ];
    expect(route.map(waypoint => waypoint.id.length)).toEqual([MAX_LENGTH, MAX_LENGTH, MAX_LENGTH]);
    const trace = traceRouteIntoGraph(route);

    expect(idsOf(trace).every(id => id.length <= MAX_LENGTH)).toBe(true);
    expect(new Set(idsOf(trace)).size).toBe(idsOf(trace).length);
    // The mapping is carried by the anchor, not by the id, and is untouched.
    expect(trace.nodes.map(node => node.anchorWaypointId)).toEqual(route.map(waypoint => waypoint.id));
    const nodeIds = new Set(trace.nodes.map(node => node.id));
    expect(trace.edges.every(edge => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))).toBe(true);

    // And the network reloads, which it could not: the layer validates every
    // node and edge id against the same limit.
    const scene = new Scene();
    applyTraceToLayer(scene.addFlowLayer({ name: 'Crowd 1', guideType: 'route' }), trace);
    const restored = Scene.fromJSON(JSON.parse(JSON.stringify(scene.toJSON()))).getFlowLayers()[0];
    expect(restored.graph.getNodes().map(node => node.id)).toEqual(trace.nodes.map(node => node.id));
    expect(restored.graph.getEdges()).toHaveLength(2);
  });

  test('a branched route of the longest ids fits too, rejoin edge included', () => {
    const [a, f, b, z] = ['a', 'f', 'b', 'z'].map(fill => longestId(fill));
    const route = [
      major(a, 0.1, 0.1),
      major(f, 0.4, 0.4),
      major(b, 0.4, 0.8, { branchId: 'B', branchFrom: f, branchRejoin: z }),
      major(z, 0.9, 0.5),
    ];
    const trace = traceRouteIntoGraph(route);

    expect(trace.problems).toEqual([]);
    expect(trace.edges).toHaveLength(4);
    expect(idsOf(trace).every(id => id.length <= MAX_LENGTH)).toBe(true);
    expect(new Set(idsOf(trace)).size).toBe(idsOf(trace).length);
  });

  test('an id of exactly the limit is kept verbatim', () => {
    const route = [
      major('x'.repeat(MAX_LENGTH - 'gn_trace_'.length), 0.1, 0.1),
      major('p'.repeat(122), 0.5, 0.5),
      major('q'.repeat(123), 0.9, 0.9),
    ];
    const { nodes, edges } = traceRouteIntoGraph(route);

    expect(nodes[0].id).toBe(`gn_trace_${route[0].id}`);
    expect(edges[1].id).toBe(`ge_trace_${route[1].id}__${route[2].id}`);
    expect([nodes[0].id.length, edges[1].id.length]).toEqual([MAX_LENGTH, MAX_LENGTH]);
  });

  test('a shortened id is pinned, so it cannot drift between versions', () => {
    expect(boundedEntityId(`gn_trace_${'a'.repeat(MAX_LENGTH)}`))
      .toBe(`gn_trace_${'a'.repeat(236)}_bpp9kfrr7v`);
  });

  test('ids that would clash are kept apart, so no node or leg is lost', () => {
    // Codex's crafted cases from the DEF-31 review: a waypoint id chosen to
    // equal another's shortened node id, and one that makes two legs spell the
    // same edge id; and the older ambiguity of `__` inside a waypoint id.
    const longest = 'a'.repeat(MAX_LENGTH);
    const nodeLookalike = boundedEntityId(`gn_trace_${longest}`).slice('gn_trace_'.length);
    const nodeClash = traceRouteIntoGraph([
      major(longest, 0.1, 0.1), major(nodeLookalike, 0.5, 0.5), major('z', 0.9, 0.9),
    ]);
    expect(new Set(nodeClash.nodes.map(node => node.id)).size).toBe(3);
    expect(nodeClash.edges).toHaveLength(2);

    const far = 'b'.repeat(MAX_LENGTH);
    const edgeLookalike = boundedEntityId(`ge_trace_a__${far}`).slice('ge_trace_a__'.length);
    const edgeClash = traceRouteIntoGraph([
      major('a', 0.1, 0.1), major(far, 0.5, 0.5), major('z', 0.9, 0.9),
      major(edgeLookalike, 0.3, 0.8, { branchId: 'B', branchFrom: 'a' }),
    ]);
    expect(edgeClash.problems).toEqual([]);
    expect(new Set(edgeClash.edges.map(edge => edge.id)).size).toBe(3);

    const underscored = traceRouteIntoGraph([
      major('a__b', 0.1, 0.1), major('c', 0.3, 0.3), major('a', 0.6, 0.6), major('b__c', 0.9, 0.9),
    ]);
    expect(underscored.edges.map(edge => edge.id))
      .toEqual(['ge_trace_a__b__c', 'ge_trace_c__a', 'ge_trace_a__b__c~2']);

    // The graph keeps every one of them: it would silently drop a duplicate.
    for (const trace of [nodeClash, edgeClash, underscored]) {
      const layer = new Scene().addFlowLayer({ name: 'Crowd 1', guideType: 'route' });
      applyTraceToLayer(layer, trace);
      expect(layer.graph.getNodes()).toHaveLength(trace.nodes.length);
      expect(layer.graph.getEdges()).toHaveLength(trace.edges.length);
    }
  });

  test('ids that differ only past the cut stay distinct, and a trace is repeatable', () => {
    const route = [
      major(longestId('x', '1'), 0.1, 0.1), major(longestId('x', '2'), 0.5, 0.5), major(longestId('x', '3'), 0.9, 0.9),
    ];
    const ids = idsOf(traceRouteIntoGraph(route));

    expect(new Set(ids).size).toBe(ids.length);
    expect(idsOf(traceRouteIntoGraph(route))).toEqual(ids);
  });
});
