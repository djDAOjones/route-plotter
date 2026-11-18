/** CROWD-08 D: weights are strict, optional data, never rounded display percentages. */
import { describe, expect, test } from 'vitest';
import { GraphNode } from '../src/models/GraphNode.js';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { Scene } from '../src/models/Scene.js';

const old = { id: 'station', x: 0.2, y: 0.7, type: 'entry', label: 'Station' };
const data = extra => ({ id: 'crowd', graph: { nodes: [{ ...old, ...extra }], edges: [] }, emitters: [] });

describe('optional Entry weights', () => {
  test('absence and explicit default keep old JSON and event payload own properties', () => {
    for (const extra of [{}, { entryWeight: undefined }, { entryWeight: 1 }]) {
      const node = new GraphNode({ ...old, ...extra });
      expect(JSON.stringify(node.toJSON())).toBe(JSON.stringify(old));
      expect(node).not.toHaveProperty('entryWeight');
    }
    const node = new GraphNode({ ...old, entryWeight: 2 });
    node.entryWeight = 1;
    expect(JSON.stringify(node.toJSON())).toBe(JSON.stringify(old));
  });

  test.each([0.01, 0.010000000000000002, 1.2345678901234567, 2, Number.MAX_VALUE])(
    '%s survives model, JSON, scene and Type round trips exactly', value => {
      const scene = Scene.fromJSON({ flowLayers: [data({ entryWeight: value })] });
      const node = scene.getFlowLayers()[0].graph.getNode(old.id);
      expect(node.entryWeight).toBe(value);
      for (const type of ['normal', 'exit', 'entry']) {
        node.type = type;
        const json = JSON.parse(JSON.stringify(scene.toJSON()));
        expect(json.flowLayers[0].graph.nodes[0].entryWeight).toBe(value);
        expect(Scene.fromJSON(json).toJSON()).toEqual(json);
      }
    }
  );

  const bad = [null, false, true, '', '2', [], [2], {}, NaN, Infinity, -Infinity, -1, 0, 0.009999999999];
  test.each(bad.map((value, index) => [index, value]))('invalid value %i is refused at every boundary', (_, value) => {
    expect(() => new GraphNode({ ...old, entryWeight: value })).toThrow(/entry weight/i);
    expect(() => GraphNode.fromJSON({ ...old, entryWeight: value })).toThrow(/entry weight/i);
    expect(() => FlowLayer.assertValidJSON(data({ entryWeight: value }))).toThrow(/entry weight/i);
    expect(() => Scene.fromJSON({ flowLayers: [data({ entryWeight: value })] })).toThrow(/entry weight/i);
    const node = new GraphNode(old);
    node.entryWeight = value;
    expect(() => node.toJSON()).toThrow(/entry weight/i);
  });
});
