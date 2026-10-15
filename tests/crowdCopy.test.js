import { afterEach, expect, test, vi } from 'vitest';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { createCrowdCopy } from '../src/utils/crowdCopy.js';

function rich() {
  return new FlowLayer({ id: 'source', name: ' Stand ', visible: false, guideType: 'route', graph: {
    nodes: [{ id: 'entry', type: 'entry', x: 0.2, y: 0.3, label: 'Origin', anchorWaypointId: 'waypoint',
      entryWeight: Number.MAX_VALUE, area: { shape: 'ellipse', width: 0.13, height: 0.17, turn: 43 } },
    { id: 'exit', type: 'exit', x: 0.8, y: 0.7,
      area: { shape: 'rectangle', width: 0.29, height: 0.31, turn: -51 } }],
    edges: [{ id: 'edge', sourceId: 'exit', targetId: 'entry', direction: 'two-way', weight: 0.010000000000000002,
      controlPoints: [{ x: 0.37, y: 0.29 }, { x: 0.61, y: 0.47 }] }],
  }, emitters: ['collect', 'disappear', 'respawn', 'loop'].map((lifecycleMode, i) => ({
    id: `emitter-${i}`, seed: i, dotCount: i + 1, speed: 0.123456789, speedVariance: 0.37,
    dotSize: 0.43, dotColor: '#56B4E9', wobble: 0.13, onsetVariance: 0.17, intensityRamp: -0.23,
    releaseStart: 0.31, releaseDuration: 0.41, releaseAnchor: { waypointId: 'waypoint', at: 'pause-end' },
    busynessEnvelope: [{ time: 0, value: 0.3, transition: 'step' },
      { time: 0.7, value: 0.8, transition: 'gradual' }, { time: 1, value: 0.2, transition: 'gradual' }],
    lifecycleMode,
  })) }).toJSON();
}
const entityIds = data => [data.id, ...data.emitters.map(e => e.id),
  ...data.graph.nodes.map(n => n.id), ...data.graph.edges.map(e => e.id)];
afterEach(() => vi.restoreAllMocks());

test('copy preserves every canonical setting, remaps only owned IDs and changes every seed', () => {
  const source = rich(), before = JSON.stringify(source), copy = createCrowdCopy(source, entityIds(source));
  expect(() => FlowLayer.fromJSON(copy)).not.toThrow();
  expect(FlowLayer.fromJSON(copy).toJSON()).toEqual(copy);
  expect(copy.name).toBe('Stand copy'); expect(copy.visible).toBe(false); expect(copy.guideType).toBe('route');
  const ids = entityIds(copy);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 256)).toBe(true);
  expect(ids.some(id => entityIds(source).includes(id))).toBe(false);
  const reverse = new Map(copy.graph.nodes.map((node, i) => [node.id, source.graph.nodes[i].id]));
  const normalized = JSON.parse(JSON.stringify(copy)); normalized.id = source.id; normalized.name = source.name;
  normalized.graph.nodes.forEach((node, i) => { node.id = source.graph.nodes[i].id; });
  normalized.graph.edges.forEach((edge, i) => {
    expect(edge.sourceId).toBe(copy.graph.nodes[1].id); expect(edge.targetId).toBe(copy.graph.nodes[0].id);
    edge.id = source.graph.edges[i].id;
    edge.sourceId = reverse.get(edge.sourceId); edge.targetId = reverse.get(edge.targetId);
  });
  normalized.emitters.forEach((emitter, i) => {
    expect(emitter.seed).not.toBe(source.emitters[i].seed);
    emitter.id = source.emitters[i].id; emitter.seed = source.emitters[i].seed;
  });
  expect(normalized).toEqual(source); expect(JSON.stringify(source)).toBe(before);
  copy.graph.nodes[0].area.width = 0.9; copy.graph.edges[0].controlPoints[0].x = 0.9;
  copy.emitters[0].busynessEnvelope[0].value = 0.9; copy.emitters[0].releaseAnchor.at = 'arrival';
  expect(JSON.stringify(source)).toBe(before);
});

test('frozen randomness and existing copy-style IDs cannot reuse identities or source seeds', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const source = rich(), used = [...entityIds(source), ...Array.from({ length: 40 }, (_, i) => `copy-${i + 1}`)];
  const first = createCrowdCopy(source, used), second = createCrowdCopy(source, [...used, ...entityIds(first)]);
  expect(new Set([...used, ...entityIds(first), ...entityIds(second)]).size)
    .toBe(used.length + entityIds(first).length + entityIds(second).length);
  expect(first.emitters[0].seed).toBe(1); expect(first.emitters[1].seed).toBe(0);
  expect(first.emitters.every((e, i) => e.seed !== source.emitters[i].seed)).toBe(true);
});

test.each(['', '   ', '😀'.repeat(150)])('copy bounds its display name without changing source %j', name => {
  const source = new FlowLayer({ id: 'empty', name, emitters: [] }).toJSON();
  const copy = createCrowdCopy(source, ['empty']);
  expect(copy.name.isWellFormed()).toBe(true);
  expect(copy.name.length).toBeLessThanOrEqual(200);
  expect(copy.name.endsWith(' copy')).toBe(true);
  expect(name.trim() ? copy.name.includes('\uFFFD') : copy.name === 'Crowd copy').toBe(name.trim() ? false : true);
  expect(source.name).toBe(name); expect(copy.emitters).toEqual([]); expect(copy.graph).toEqual(source.graph);
});

test('source copy-style IDs are reserved even without a supplied project inventory', () => {
  const source = new FlowLayer({ id: 'copy-1', emitters: [{ id: 'copy-2' }] }).toJSON();
  expect(entityIds(createCrowdCopy(source)).some(id => entityIds(source).includes(id))).toBe(false);
});
