import { describe, expect, test } from 'vitest';
import { GraphModel } from '../src/models/GraphModel.js';
import { getGraphDepartures, getGraphDepartureShares } from '../src/utils/graphRouting.js';

function addNode(graph, id) {
  return graph.addNode({ id, x: 0.5, y: 0.5 });
}

describe('getGraphDepartures', () => {
  test('honours direction and preserves authored edge order', () => {
    const graph = new GraphModel();
    const incoming = addNode(graph, 'incoming');
    const junction = addNode(graph, 'junction');
    const exitA = addNode(graph, 'exit-a');
    const exitB = addNode(graph, 'exit-b');
    graph.addEdge({ id: 'incoming-only', sourceId: incoming.id, targetId: junction.id, direction: 'one-way' });
    graph.addEdge({ id: 'outgoing', sourceId: junction.id, targetId: exitA.id, direction: 'one-way' });
    graph.addEdge({ id: 'reversible', sourceId: exitB.id, targetId: junction.id, direction: 'two-way' });

    expect(getGraphDepartures(graph, junction.id).map(({ edge, reversed }) => [edge.id, reversed]))
      .toEqual([
        ['outgoing', false],
        ['reversible', true],
      ]);
  });

  test('avoids the arrival edge unless it is the only way onward', () => {
    const graph = new GraphModel();
    const junction = addNode(graph, 'junction');
    const a = addNode(graph, 'a');
    const b = addNode(graph, 'b');
    graph.addEdge({ id: 'arrival', sourceId: a.id, targetId: junction.id, direction: 'two-way' });
    graph.addEdge({ id: 'onward', sourceId: junction.id, targetId: b.id, direction: 'one-way' });

    expect(getGraphDepartures(graph, junction.id, { cameFromEdgeId: 'arrival' })
      .map(({ edge }) => edge.id)).toEqual(['onward']);

    graph.removeEdge('onward');
    expect(getGraphDepartures(graph, junction.id, { cameFromEdgeId: 'arrival' })
      .map(({ edge }) => edge.id)).toEqual(['arrival']);
  });
});

describe('getGraphDepartureShares', () => {
  test('returns exact relative shares and whole percentages totalling 100', () => {
    const graph = new GraphModel();
    const junction = addNode(graph, 'junction');
    const a = addNode(graph, 'a');
    const b = addNode(graph, 'b');
    graph.addEdge({ id: 'heavy', sourceId: junction.id, targetId: a.id, direction: 'one-way', weight: 3 });
    graph.addEdge({ id: 'light', sourceId: junction.id, targetId: b.id, direction: 'one-way', weight: 1 });

    const shares = getGraphDepartureShares(graph, junction.id);
    expect(shares.map(({ share }) => share)).toEqual([0.75, 0.25]);
    expect(shares.map(({ percent }) => percent)).toEqual([75, 25]);
    expect(shares.reduce((sum, { percent }) => sum + percent, 0)).toBe(100);
  });

  test('largest-remainder ties resolve in stable authored order', () => {
    const graph = new GraphModel();
    const junction = addNode(graph, 'junction');
    for (let i = 1; i <= 3; i++) {
      const destination = addNode(graph, `destination-${i}`);
      graph.addEdge({
        id: `edge-${i}`,
        sourceId: junction.id,
        targetId: destination.id,
        direction: 'one-way',
        weight: 1,
      });
    }

    expect(getGraphDepartureShares(graph, junction.id).map(({ percent }) => percent))
      .toEqual([34, 33, 33]);
  });

  test('finite weights remain proportional when their direct sum would overflow', () => {
    const graph = new GraphModel();
    const junction = addNode(graph, 'junction');
    const a = addNode(graph, 'a');
    const b = addNode(graph, 'b');
    graph.addEdge({ id: 'huge', sourceId: junction.id, targetId: a.id, direction: 'one-way', weight: 1e308 });
    graph.addEdge({ id: 'half-huge', sourceId: junction.id, targetId: b.id, direction: 'one-way', weight: 5e307 });

    const shares = getGraphDepartureShares(graph, junction.id);
    expect(shares.map(({ share }) => share)).toEqual([2 / 3, 1 / 3]);
    expect(shares.map(({ percent }) => percent)).toEqual([67, 33]);
  });
});
