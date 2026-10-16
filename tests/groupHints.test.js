import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { Emitter } from '../src/models/Emitter.js';
import { GROUP_HINT, GROUP_FIELD_HINTS } from '../src/utils/groupSettings.js';

const entryHint = 'Relative weights set each Entry’s chance of releasing a dot. Percentages are rounded, not fixed counts. Very small weights may never be chosen.';
const labelTip = id => document.getElementById(id).getAttribute('data-tip');
const describedTip = id => {
  const tip = document.getElementById(id), desc = tip.getAttribute('data-tip-desc');
  return desc ? document.getElementById(desc)?.textContent : '';
};
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });
async function setup() {
  const app = await blankProject(), f = drawCrowd(app); f.layer.emitters[0].update({ lifecycleMode: 'collect' });
  f.layer.graph.addNode({ id: 'fork-exit', type: 'exit', x: 0.7, y: 0.3 });
  f.layer.graph.addEdge({ id: 'fork-path', sourceId: f.entry.id, targetId: 'fork-exit' });
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: f.layer.id, emitterId: f.layer.emitters[0].id });
  await settled(); return { app, ...f, emitter: f.layer.emitters[0] };
}
async function on(app, emitter, value) {
  const form = document.getElementById('crowd-group-form');
  form.elements.groups.checked = value; form.elements.groups.dispatchEvent(new Event('input', { bubbles: true }));
  form.querySelector('[type="submit"]').click(); await settled(); expect(emitter.groups).toBe(value);
}

test('active group release/Pace hints actually reach descriptions and restore literal old copy at size1/off', async () => {
  const { app, emitter } = await setup();
  const ids = ['crowd-release-start-label', 'crowd-release-duration-label', 'crowd-speed-variance-label', 'crowd-onset-variance-label'];
  const old = ids.map(labelTip);
  await on(app, emitter, true);
  for (const id of ids) expect(labelTip(id)).toMatch(/group/i);
  expect(labelTip(ids[0])).toMatch(/reference/i);
  expect(describedTip('crowd-speed-variance-label')).toMatch(/group/i);
  expect(document.getElementById('crowd-busyness-hint').textContent).toMatch(/groups/);
  const form = document.getElementById('crowd-group-form'); form.elements.groupSize.value = '1';
  form.querySelector('[type="submit"]').click(); await settled();
  expect(ids.map(labelTip)).toEqual(old);
  expect(describedTip('crowd-speed-variance-label')).toBe(old[2]);
  await on(app, emitter, false); expect(ids.map(labelTip)).toEqual(old);
});

test('Entry and junction help names group choices, mixed roles and restored independent choices', async () => {
  const { app, layer, entry, emitter } = await setup();
  await on(app, emitter, true);
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'node', layerId: layer.id, nodeId: entry.id });
  await settled();
  expect(document.getElementById('network-entry-weights-help').textContent).toMatch(/releasing a group/);
  expect(document.querySelector('#network-path-weight-rows [data-tip]').getAttribute('data-tip')).toMatch(/groups/);
  const weight = [...document.querySelectorAll('form[data-outline-action="update-entry-weight"]')]
    .find(form => form.dataset.nodeId === entry.id);
  expect(weight.querySelector('output').textContent).toMatch(/Entry choices/);
  layer.emitters.push(new Emitter({ id: 'ordinary', lifecycleMode: 'collect', dotCount: 1 }));
  app.syncNetworkCards(); app._queueSceneOutlineRefresh(); await settled();
  expect(document.getElementById('network-entry-weights-help').textContent).toMatch(/group or individual dot/);
  expect(document.querySelector('#network-path-weight-rows [data-tip]').getAttribute('data-tip')).toMatch(/groups and individual dots/);
  emitter.groups = false; app.syncCrowdEditor(); app.syncNetworkCards(); app._queueSceneOutlineRefresh(); await settled();
  expect(document.getElementById('network-entry-weights-help').textContent).toBe(entryHint);
});


test.each(['card', 'outline'])('%s Groups fields keep their own hint descriptions through a refresh', async surface => {
  const { app } = await setup();
  const current = () => surface === 'card' ? document.getElementById('crowd-group-form')
    : document.querySelector('form[data-outline-action="update-groups"]');
  const check = () => {
    const form = current();
    for (const name of ['groups', 'groupSize', 'groupWidth']) {
      const field = form.elements[name];
      const hint = [...field.labels].map(label => label.querySelector('[data-tip]')).find(Boolean);
      expect(hint, name).toBeTruthy();
      const text = hint.getAttribute('data-tip');
      expect(text).toBe(GROUP_FIELD_HINTS[name]);
      const descriptions = field.getAttribute('aria-describedby').split(/\s+/)
        .map(id => document.getElementById(id)?.textContent || '').join(' ');
      expect(descriptions, name).toContain(text); expect(descriptions, name).toContain(GROUP_HINT);
    }
  };
  check(); app.syncCrowdEditor(); app._queueSceneOutlineRefresh(); await settled(); check();
});
