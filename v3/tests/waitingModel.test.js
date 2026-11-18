import { expect, test } from 'vitest';
import { Emitter } from '../src/models/Emitter.js';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { Scene } from '../src/models/Scene.js';
import { groupsActive } from '../src/utils/groupSettings.js';
import { waitingUnavailableReason, waitingActive } from '../src/utils/waitingSettings.js';

test('Final whistle defaults false and omits false from the exact old emitter JSON', () => {
  const old = new Emitter({ id: 'e', seed: 7 });
  const explicit = new Emitter({ id: 'e', seed: 7, waitAtStart: false });
  expect(old.waitAtStart).toBe(false);
  expect(explicit.waitAtStart).toBe(false);
  expect(explicit.toJSON()).toEqual(old.toJSON());
  expect(old.toJSON()).not.toHaveProperty('waitAtStart');
});

test.each([null, undefined, 0, 1, 'true', 'false', [], {}])('strict optional waiting refuses %j before any write', value => {
  const emitter = new Emitter({ id: 'e', seed: 7 });
  const before = emitter.toJSON();
  expect(() => new Emitter({ waitAtStart: value })).toThrow(/Final whistle/);
  expect(() => Emitter.assertValidJSON({ waitAtStart: value })).toThrow(/Final whistle/);
  expect(() => emitter.update({ seed: 81, dotCount: 99, waitAtStart: value })).toThrow(/Final whistle/);
  expect(emitter.toJSON()).toEqual(before);
});

test.each(['collect', 'disappear', 'respawn', 'loop'])('stored %s waiting survives strict scene round trip and excludes F', lifecycleMode => {
  const layer = new FlowLayer({ id: 'l', guideType: 'graph', emitters: [{ id: 'e', seed: 7,
    groups: true, groupSize: 4, groupWidth: 0.13, waitAtStart: true, lifecycleMode }] });
  const data = { flowLayers: [layer.toJSON()] };
  expect(() => Scene.assertValidJSON(data)).not.toThrow();
  const reopened = Scene.fromJSON(data).getFlowLayers()[0], emitter = reopened.emitters[0];
  expect(emitter.waitAtStart).toBe(true);
  expect(emitter.toJSON().waitAtStart).toBe(true);
  expect(groupsActive(reopened, emitter)).toBe(false);
  emitter.update({ waitAtStart: false });
  expect(emitter.toJSON()).not.toHaveProperty('waitAtStart');
  expect([emitter.groups, emitter.groupSize, emitter.groupWidth]).toEqual([true, 4, 0.13]);
  expect(groupsActive(reopened, emitter)).toBe(['collect', 'disappear'].includes(lifecycleMode));
});

test('whole scene strict validation refuses a malformed waiting flag', () => {
  const data = { flowLayers: [{ id: 'l', emitters: [{ id: 'e', waitAtStart: 'on' }] }] };
  expect(() => Scene.assertValidJSON(data)).toThrow(/Final whistle/);
});


test.each([
  ['route', /Custom network/], ['respawn', /Disappear or Collect/], ['loop', /Disappear or Collect/],
  ['no-nodes', /Draw a network/], ['no-edges', /Draw a network/],
  ['no-entry', /Add an Entry/], ['missing-area', /every Entry/],
])('stored-on %s is inactive with a specific reason and still excludes Groups', (kind, reason) => {
  const area = { shape: 'ellipse', width: 0.2, height: 0.2, turn: 0 };
  const data = { id: 'eligibility', guideType: 'graph', graph: {
    nodes: [{ id: 'a', type: 'entry', x: 0.2, y: 0.5, area },
      { id: 'b', type: 'entry', x: 0.2, y: 0.7, area }, { id: 'z', type: 'exit', x: 0.8, y: 0.5 }],
    edges: [{ id: 'az', sourceId: 'a', targetId: 'z', direction: 'one-way' }],
  }, emitters: [{ id: 'e', seed: 7, waitAtStart: true, groups: true, lifecycleMode: 'collect' }] };
  if (kind === 'route') data.guideType = 'route';
  if (['respawn', 'loop'].includes(kind)) data.emitters[0].lifecycleMode = kind;
  if (kind === 'no-nodes') data.graph.nodes = [];
  if (['no-nodes', 'no-edges'].includes(kind)) data.graph.edges = [];
  if (kind === 'no-entry') data.graph.nodes.forEach(node => { if (node.type === 'entry') node.type = 'normal'; });
  if (kind === 'missing-area') delete data.graph.nodes[1].area;
  const layer = new FlowLayer(data), emitter = layer.emitters[0];
  expect(waitingActive(layer, emitter)).toBe(false);
  expect(waitingUnavailableReason(layer, emitter)).toMatch(reason);
  expect(groupsActive(layer, emitter)).toBe(false);
  expect(emitter.toJSON().waitAtStart).toBe(true);
});


test.each([false, true])('a complete zero-length network activates only the authored waiting flag=%s', value => {
  const layer = new FlowLayer({ id: 'complete', guideType: 'graph', graph: {
    nodes: [{ id: 'a', type: 'entry', x: 0.5, y: 0.5,
      area: { shape: 'rectangle', width: 0.01, height: 0.01, turn: 0 } },
    { id: 'z', type: 'exit', x: 0.5, y: 0.5 }],
    edges: [{ id: 'az', sourceId: 'a', targetId: 'z', direction: 'one-way' }],
  }, emitters: [{ id: 'e', waitAtStart: value, lifecycleMode: 'collect' }] });
  expect(waitingUnavailableReason(layer, layer.emitters[0])).toBe('');
  expect(waitingActive(layer, layer.emitters[0])).toBe(value);
});
