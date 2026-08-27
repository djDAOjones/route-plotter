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
