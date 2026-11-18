/** CROWD-08 B: optional area data stays strict, additive and independently owned. */
import { describe, expect, test } from 'vitest';
import { GraphNode } from '../src/models/GraphNode.js';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { Scene } from '../src/models/Scene.js';

const area = (extra = {}) => ({ shape: 'rectangle', width: 0.1, height: 0.1, turn: 0, ...extra });
const data = value => ({ id: 'crowd', graph: {
  nodes: [{ id: 'entry', x: 0.5, y: 0.5, type: 'entry', area: value }], edges: [],
}, emitters: [] });

describe('optional node areas', () => {
  test('absent and None retain historical serialised bytes', () => {
    const old = { id: 'n', x: 0.2, y: 0.7, type: 'entry', label: 'Station' };
    for (const extra of [{}, { area: null }, { area: undefined }]) {
      const node = new GraphNode({ ...old, ...extra });
      expect(JSON.stringify(node.toJSON())).toBe(JSON.stringify(old));
      expect(node).not.toHaveProperty('area'); // legacy events carry the node itself
    }
  });

  test.each(['rectangle', 'ellipse'])('all bounds and a fractional middle round trip: %s', shape => {
    for (const value of [
      area({ shape, width: 0.01, height: 0.01, turn: -180 }),
      area({ shape, width: 0.305, height: 0.615, turn: 37.25 }),
      area({ shape, width: 0.8, height: 0.8, turn: 180 }),
    ]) {
      const scene = Scene.fromJSON({ flowLayers: [data(value)] });
      const json = scene.toJSON();
      expect(json.flowLayers[0].graph.nodes[0].area).toEqual(value);
      expect(Scene.fromJSON(json).toJSON()).toEqual(json);
    }
  });

  test('constructor, JSON output and restored nodes each own their area', () => {
    const input = area();
    const first = new GraphNode({ id: 'one', area: input });
    const second = GraphNode.fromJSON(first.toJSON());
    input.width = 0.8;
    expect(first.area.width).toBe(0.1);
    const saved = first.toJSON();
    saved.area.height = 0.8;
    first.area.turn = 90;
    expect(first.area.height).toBe(0.1);
    expect(second.area).toEqual(area());
  });

  test('an inactive node type retains its area and its authored fallback position', () => {
    const node = new GraphNode({ id: 'anchored', x: 0.2, y: 0.3, type: 'entry', area: area() });
    node.anchorWaypointId = 'route-node';
    node.applyAnchor(-2, 3);
    for (const type of ['normal', 'exit', 'entry']) {
      node.type = type;
      const saved = node.toJSON();
      expect(saved.area).toEqual(area());
      expect([saved.x, saved.y]).toEqual([0.2, 0.3]);
      expect(node.position()).toEqual({ x: -2, y: 3 });
    }
  });

  const bad = [[], 'rectangle', 1, true, {}, area({ shape: 'circle' }),
    area({ width: undefined }), area({ height: undefined }), area({ turn: undefined }),
    ...['width', 'height'].flatMap(key => [-1, 0, 0.009, 0.801, Infinity, NaN, '0.1', null]
      .map(value => area({ [key]: value }))),
    ...[-181, 181, Infinity, NaN, '90', null].map(turn => area({ turn })),
  ];
  test.each(bad.map((value, index) => [index, value]))('invalid area %i is rejected before hydration', (_, value) => {
    expect(() => FlowLayer.assertValidJSON(data(value))).toThrow(/area/i);
    expect(() => Scene.fromJSON({ flowLayers: [data(value)] })).toThrow(/area/i);
    expect(() => new GraphNode({ area: value })).toThrow(/area/i);
  });
});
