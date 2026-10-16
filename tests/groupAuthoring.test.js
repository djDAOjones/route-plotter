import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { Emitter } from '../src/models/Emitter.js';
import { sceneOutlineKey } from '../src/utils/sceneSemantics.js';

const snapshot = app => app._buildProjectSnapshot({ includeAssets: false });
const history = app => app.undoService.createSnapshot().undoStack.length;
const change = (input, value) => {
  expect(input).toBeTruthy(); input.focus();
  if (input.type === 'checkbox') input.checked = value; else input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
};
const formFor = (surface, emitter) => surface === 'card' ? document.getElementById('crowd-group-form')
  : [...document.querySelectorAll('form[data-outline-action="update-groups"]')].find(form => form.dataset.emitterId === emitter.id);
async function select(app, layer, emitter) {
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: layer.id, emitterId: emitter.id });
  await settled();
}
async function setup(second = false) {
  const app = await blankProject(), { layer } = drawCrowd(app);
  layer.emitters[0].update({ lifecycleMode: 'collect', dotCount: 8 });
  if (second) layer.emitters.push(new Emitter({ id: 'secondary', seed: 55, lifecycleMode: 'collect', dotCount: 5 }));
  await select(app, layer, layer.emitters[0]); app._flushPendingUndo(); await settled();
  return { app, layer, emitter: layer.emitters[0] };
}
function author(form, groups, size, width) {
  expect(form).toBeTruthy(); change(form.elements.groups, groups);
  if (!form.elements.groupSize.disabled) change(form.elements.groupSize, size);
  if (!form.elements.groupWidth.disabled) change(form.elements.groupWidth, width);
  form.querySelector('[type="submit"]').click();
}
const cancel = form => [...form.querySelectorAll('button')].find(button => button.textContent === 'Cancel edits').click();
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

test.each(['card', 'outline'])('%s authors min/mid/max with one undo/save and exact checked prepared JSON', async surface => {
  const { app, layer, emitter } = await setup();
  for (const [size, width, expectedWidth] of [[1, 0, 0], [4, 2, 0.02], [5000, 20, 0.2], [17, '12.345678901234567', 0.12345678901234567]]) {
    const before = history(app), save = vi.spyOn(app, 'autoSave'), bound = vi.spyOn(app.imageAssetService, 'assertArchiveFitsByBound');
    author(formFor(surface, emitter), true, size, width); await settled();
    expect([emitter.groups, emitter.groupSize, emitter.groupWidth]).toEqual([true, size, expectedWidth]);
    expect(history(app)).toBe(before + 1); expect(save).toHaveBeenCalledTimes(1);
    expect(bound).toHaveBeenCalledTimes(1);
    expect(bound.mock.results[0].value.projectJSON).toBe(app.imageAssetService.prepareArchive(snapshot(app)).projectJSON);
    expect(app.scene.getFlowLayer(layer.id)).toBe(layer); save.mockRestore(); bound.mockRestore();
  }
});

test('outline edits secondary emitters while the card keeps owning primary', async () => {
  const { app, layer, emitter } = await setup(true), other = layer.emitters[1];
  await select(app, layer, other);
  const before = emitter.toJSON(); author(formFor('outline', other), true, 2, 13.5); await settled();
  expect([other.groups, other.groupSize, other.groupWidth]).toEqual([true, 2, 0.135]);
  expect(emitter.toJSON()).toEqual(before);
  expect(document.getElementById('crowd-group-size').value).toBe('4');
});

test.each(['card', 'outline'])('%s Cancel edits only restores its draft; no-op has no history/save', async surface => {
  const { app, emitter } = await setup(), before = snapshot(app), undo = history(app), save = vi.spyOn(app, 'autoSave');
  let form = formFor(surface, emitter); change(form.elements.groupSize, 19); change(form.elements.groupWidth, '12.345678901234567');
  app._queueSceneOutlineRefresh(); app._syncCrowdGroupControls(); await settled();
  form = formFor(surface, emitter); expect(form.elements.groupSize.value).toBe('19');
  cancel(form); await settled(); form = formFor(surface, emitter);
  expect(form.elements.groupSize.value).toBe('4'); expect(form.elements.groupWidth.value).toBe('2');
  form.querySelector('[type="submit"]').click(); await settled();
  expect(snapshot(app)).toEqual(before); expect(history(app)).toBe(undo); expect(save).not.toHaveBeenCalled();
});

test.each(['card', 'outline'])('%s inactive-on offers a usable off escape and keeps configured values', async surface => {
  const { app, layer, emitter } = await setup();
  emitter.update({ groups: true, groupSize: 9, groupWidth: 0.13, lifecycleMode: 'respawn' });
  app.syncCrowdEditor(); app._queueSceneOutlineRefresh(); await settled();
  let form = formFor(surface, emitter);
  expect(form.elements.groups.disabled).toBe(false); expect(form.elements.groupSize.disabled).toBe(true);
  expect(form.elements.groupWidth.disabled).toBe(true); expect(form.querySelector('[type="submit"]').disabled).toBe(false);
  author(form, false, 2, 3); await settled();
  expect([emitter.groups, emitter.groupSize, emitter.groupWidth]).toEqual([false, 9, 0.13]);
  form = formFor(surface, emitter); expect(form.elements.groups.disabled).toBe(true);
  expect(form.querySelector('[type="submit"]').disabled).toBe(true);
  expect(app.scene.getFlowLayer(layer.id)).toBe(layer);
});

test('cross-panel pending drafts refuse both Apply actions until either panel Cancel edits breaks the conflict', async () => {
  const { app, emitter } = await setup(), before = snapshot(app), undo = history(app);
  change(formFor('card', emitter).elements.groupSize, 19);
  change(formFor('outline', emitter).elements.groupWidth, 13);
  formFor('card', emitter).querySelector('[type="submit"]').click(); await settled();
  expect(document.getElementById('crowd-group-error').textContent).toMatch(/scene outline.*Apply groups.*Cancel edits/i);
  formFor('outline', emitter).querySelector('[type="submit"]').click(); await settled();
  expect(document.querySelector('.scene-outline-error')?.textContent).toMatch(/crowd card.*Apply groups.*Cancel edits/i);
  expect(snapshot(app)).toEqual(before); expect(history(app)).toBe(undo);
  cancel(formFor('outline', emitter)); formFor('card', emitter).querySelector('[type="submit"]').click(); await settled();
  expect(emitter.groupSize).toBe(19); expect(emitter.groupWidth).toBe(0.02); expect(history(app)).toBe(undo + 1);
});

test('a retained hidden card draft blocks duplication and survives scope changes until Cancel edits', async () => {
  const { app, layer, emitter } = await setup();
  change(formFor('card', emitter).elements.groupSize, 19);
  app.eventBus.emit('waypoint:deselect'); await settled();
  expect(() => app.duplicateCrowd(layer)).toThrow(/Apply groups.*Cancel edits/i);
  await select(app, layer, emitter);
  expect(formFor('card', emitter).elements.groupSize.value).toBe('19');
  cancel(formFor('card', emitter)); await settled();
  expect(app._hasPendingGroupDrafts()).toBe(false);
});

test('stale same-ID group form commands cannot mutate replacements', async () => {
  const { app, layer, emitter } = await setup();
  const form = formFor('outline', emitter), command = { action: 'update-groups', ...form.dataset,
    groups: 'on', groupSize: '19', groupWidth: '13', outlineFormKey: `${sceneOutlineKey('emitter', layer.id, emitter.id)}:groups-apply` };
  const replacement = Emitter.fromJSON(emitter.toJSON()); layer.emitters[0] = replacement;
  app.eventBus.emit('scene-outline:command', command); await settled();
  expect(replacement.groups).toBe(false); expect(replacement.groupSize).toBe(4);
  expect(() => app._setEmitterGroups(layer, replacement, { groups: true, groupSize: 19, groupWidth: 0.13 },
    command.groupsContext, 'outline')).toThrow(/Groups changed/);
  expect(replacement.groups).toBe(false); expect(replacement.groupSize).toBe(4);
});

test.each(['card', 'outline'])('%s preserves an untouched imported width whose percentage does not invert exactly', async surface => {
  const { app, emitter } = await setup();
  for (const width of [0.052871860004961496, 0.16188585730269553, 0.10384036381728948]) {
    emitter.update({ groups: false, groupWidth: width });
    app.syncCrowdEditor(); app._queueSceneOutlineRefresh(); await settled();
    expect(app._hasPendingGroupDrafts()).toBe(false);
    const form = formFor(surface, emitter); change(form.elements.groups, true);
    form.querySelector('[type="submit"]').click(); await settled();
    expect(emitter.groups).toBe(true); expect(emitter.groupWidth).toBe(width);
  }
});


test.each(['card', 'outline'])('%s group acceptance and Cancel preserve a newer unrelated form error', async surface => {
  const { app, emitter } = await setup();
  const ordinary = [...document.querySelectorAll('form[data-outline-action="update-emitter"]')]
    .find(form => form.dataset.emitterId === emitter.id);
  const message = 'Newer ordinary form error';
  app.eventBus.emit('scene-outline:error', { formKey: ordinary.dataset.outlineFormKey, message });
  author(formFor(surface, emitter), true, 3, 4); await settled();
  expect(emitter.groups).toBe(true); expect(emitter.groupSize).toBe(3);
  expect([...document.querySelectorAll('.scene-outline-error')].map(node => node.textContent)).toContain(message);
  change(formFor(surface, emitter).elements.groupSize, 19); cancel(formFor(surface, emitter)); await settled();
  expect(formFor(surface, emitter).elements.groupSize.value).toBe('3');
  expect([...document.querySelectorAll('.scene-outline-error')].map(node => node.textContent)).toContain(message);
});

test('an empty crowd keeps Groups help available without borrowing another crowd’s error or draft', async () => {
  const { app, layer, emitter } = await setup();
  const empty = app.scene.addFlowLayer({ id: 'empty-groups', name: 'Empty', emitters: [] });
  const bound = vi.spyOn(app.imageAssetService, 'assertArchiveFitsByBound').mockImplementation(() => {
    throw new Error('Project metadata exceeds the 2 MB limit');
  });
  const form = formFor('card', emitter); change(form.elements.groupSize, 3);
  form.querySelector('[type="submit"]').click(); await settled(); bound.mockRestore();
  const error = document.getElementById('crowd-group-error'), message = error.textContent;
  expect(error.hidden).toBe(false); expect(message).toMatch(/Groups unchanged/);
  app.eventBus.emit('crowd:selected', empty); await settled();
  expect(document.getElementById('crowd-group-form').hidden).toBe(false);
  expect(error.hidden).toBe(true); expect(document.getElementById('crowd-group-reason').textContent).toBe('');
  app.eventBus.emit('crowd:selected', layer); await settled();
  expect(formFor('card', emitter).elements.groupSize.value).toBe('3');
  expect(error.hidden).toBe(false); expect(error.textContent).toBe(message);
  expect(emitter.groupSize).toBe(4);
});
