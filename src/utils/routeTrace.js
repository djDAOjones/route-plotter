/**
 * Tracing the hero route into a crowd guide network (COMPOSE-03).
 *
 * The result is a **copy**, not a view: once traced, the network is the
 * author's to reshape — add nodes, retune weights, draw shortcuts — and the
 * route is unaffected by any of it. What the copy keeps is a one-way binding
 * per node (`anchorWaypointId`, COMPOSE-01), so moving a waypoint carries its
 * traced node along instead of stranding it. Editing the network never moves
 * the route; that is the whole point of the one-way rule.
 *
 * Shape of the trace:
 * - one node per **major** waypoint — majors are the route's timing keyframes,
 *   and a node between them would be a junction the route does not have;
 * - one edge per leg, carrying that leg's **minors as control points**, so the
 *   guide curve is the route's own curve rather than a straight chord;
 * - branches trace as edges leaving the fork node and returning to the rejoin
 *   node, so a crowd can split exactly where the route splits;
 * - edges are `one-way`: a guide traced from a route inherits the route's
 *   direction of travel.
 */

import { resolveRouteBranches } from './routeBranches.js';

/** Why a route could not be traced. */
export const TRACE_PROBLEM = {
  TOO_SHORT: 'route-too-short',
  BRANCH_UNRESOLVED: 'branch-unresolved',
};

/**
 * Build the node and edge descriptions for a guide network mirroring a route.
 *
 * Pure: returns plain option objects for `GraphModel.addNode`/`addEdge` and
 * never touches a waypoint or an existing graph.
 *
 * @param {Array<Object>} waypoints Full route, majors and minors
 * @returns {{nodes: Array<Object>, edges: Array<Object>,
 *            problems: Array<{code: string, detail: string}>}}
 */
export function traceRouteIntoGraph(waypoints = []) {
  const list = Array.isArray(waypoints) ? waypoints : [];
  const problems = [];
  const structure = resolveRouteBranches(list);

  // A branch whose fork or rejoin cannot be resolved would trace into an edge
  // with no endpoint, so the trace is refused rather than half-built.
  if (structure.problems.length > 0) {
    problems.push({
      code: TRACE_PROBLEM.BRANCH_UNRESOLVED,
      detail: 'Fix the route’s branch structure before tracing it into a crowd',
    });
    return { nodes: [], edges: [], problems };
  }

  const runs = [structure.trunk, ...structure.branches];
  const nodeIdByWaypointId = new Map();
  const nodes = [];

  // Nodes first, so an edge can always resolve both endpoints — including a
  // branch edge that reaches back to a trunk waypoint.
  for (const run of runs) {
    for (const waypoint of run.waypoints) {
      if (waypoint.isMajor === false) continue;
      const nodeId = `gn_trace_${waypoint.id}`;
      nodeIdByWaypointId.set(waypoint.id, nodeId);
      nodes.push({
        id: nodeId,
        x: waypoint.imgX,
        y: waypoint.imgY,
        type: 'normal',
        label: waypoint.name || '',
        anchorWaypointId: waypoint.id,
      });
    }
  }

  if (nodes.length < 2) {
    problems.push({
      code: TRACE_PROBLEM.TOO_SHORT,
      detail: 'Add at least two waypoints before tracing the route into a crowd',
    });
    return { nodes: [], edges: [], problems };
  }

  const edges = [];
  for (const run of runs) {
    // A branch starts at its fork, which belongs to another run.
    const opening = run.id === null ? null : run.forkFromId;
    const chain = buildChain(run, opening, list);
    for (const link of chain) {
      const sourceId = nodeIdByWaypointId.get(link.fromId);
      const targetId = nodeIdByWaypointId.get(link.toId);
      if (!sourceId || !targetId || sourceId === targetId) continue;
      edges.push({
        id: `ge_trace_${link.fromId}__${link.toId}`,
        sourceId,
        targetId,
        weight: 1,
        direction: 'one-way',
        controlPoints: link.minors.map(minor => ({ x: minor.imgX, y: minor.imgY })),
      });
    }
    // …and a rejoining branch closes back onto the trunk.
    if (run.id !== null && run.rejoinAtId) {
      const lastMajor = [...run.waypoints].reverse().find(waypoint => waypoint.isMajor !== false);
      const sourceId = lastMajor && nodeIdByWaypointId.get(lastMajor.id);
      const targetId = nodeIdByWaypointId.get(run.rejoinAtId);
      if (sourceId && targetId && sourceId !== targetId) {
        edges.push({
          id: `ge_trace_${lastMajor.id}__${run.rejoinAtId}`,
          sourceId,
          targetId,
          weight: 1,
          direction: 'one-way',
          controlPoints: [],
        });
      }
    }
  }

  markEntriesAndExits(nodes, edges);
  return { nodes, edges, problems };
}

/**
 * Major-to-major links across one run, each carrying the minors between them.
 * `openingId` is the waypoint the run leaves (a branch's fork), or null for
 * the trunk, which opens at its own first major.
 */
function buildChain(run, openingId, allWaypoints) {
  const links = [];
  let fromId = openingId;
  let minors = [];

  for (const waypoint of run.waypoints) {
    if (waypoint.isMajor === false) {
      // Minors before the run's first major shape the fork's approach.
      if (fromId !== null) minors.push(waypoint);
      continue;
    }
    if (fromId !== null) {
      links.push({ fromId, toId: waypoint.id, minors });
    }
    fromId = waypoint.id;
    minors = [];
  }

  // A trailing run of minors shapes nothing without a major to close on.
  void allWaypoints;
  return links;
}

/**
 * A node with no incoming edge is where crowds enter; one with no outgoing
 * edge is where they leave. Deriving this from the traced topology means a
 * branched route yields several exits without the caller reasoning about it.
 */
function markEntriesAndExits(nodes, edges) {
  const hasIncoming = new Set(edges.map(edge => edge.targetId));
  const hasOutgoing = new Set(edges.map(edge => edge.sourceId));
  for (const node of nodes) {
    if (!hasIncoming.has(node.id)) node.type = 'entry';
    else if (!hasOutgoing.has(node.id)) node.type = 'exit';
  }
}

/**
 * Write a traced network into a flow layer's graph, replacing whatever it
 * held.
 *
 * @param {Object} layer FlowLayer with a `graph`
 * @param {{nodes: Array, edges: Array}} trace
 * @returns {{nodes: number, edges: number}}
 */
export function applyTraceToLayer(layer, trace) {
  const graph = layer?.graph;
  if (!graph) return { nodes: 0, edges: 0 };

  for (const node of graph.getNodes()) graph.removeNode(node.id);
  for (const node of trace.nodes) graph.addNode(node);
  for (const edge of trace.edges) graph.addEdge(edge);
  layer.guideType = 'graph';

  return { nodes: trace.nodes.length, edges: trace.edges.length };
}
