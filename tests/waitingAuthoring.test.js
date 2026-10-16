import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { Emitter } from '../src/models/Emitter.js';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { clearProject } from '../src/app/projectReset.js';
import { sceneOutlineKey } from '../src/utils/sceneSemantics.js';

const snapshot = app => app._buildProjectSnapshot({ includeAssets: false });
const history = app => app.undoService.createSnapshot().undoStack.length;
const change = (input, value) => {
  expect(input).toBeTruthy(); input.focus();
  if (input.type === 'checkbox') input.checked = value; else input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};
const formFor = (surface, emitter) => surface === 'card' ? document.getElementById('crowd-wait-form')
  : [...document.querySelectorAll('form[data-outline-action="update-waiting"]')]
    .find(form => form.dataset.emitterId === emitter.id);
const groupFor = (surface, emitter) => surface === 'card' ? document.getElementById('crowd-group-form')
  : [...document.querySelectorAll('form[data-outline-action="update-groups"]')]
    .find(form => form.dataset.emitterId === emitter.id);
const apply = form => { expect(form).toBeTruthy(); form.querySelector('[type="submit"]').click(); };
const cancel = form => [...form.querySelectorAll('button')].find(b => b.textContent === 'Cancel edits').click();
async function select(app, layer, emitter) {
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: layer.id, emitterId: emitter.id });
  await settled();
}
async function setup(second = false) {
  const app = await blankProject(), { layer, entry } = drawCrowd(app);
  entry.area = { shape: 'ellipse', width: 0.2, height: 0.2, turn: 17 };
  const emitter = layer.emitters[0]; emitter.update({ lifecycleMode: 'collect', dotCount: 7 });
  if (second) layer.emitters.push(new Emitter({ id: 'secondary', seed: 41, lifecycleMode: 'disappear', dotCount: 5 }));
  await select(app, layer, emitter); app._flushPendingUndo(); await settled();
  return { app, layer, entry, emitter };
}
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

test.each(['card', 'outline'])('%s accepts both boolean bounds with one undo/save and exact prepared JSON', async surface => {
  const { app, emitter } = await setup();
  for (const checked of [true, false, true]) {
    const before = history(app), save = vi.spyOn(app, 'autoSave');
    const bound = vi.spyOn(app.imageAssetService, 'assertArchiveFitsByBound');
    const form = formFor(surface, emitter); change(form.elements.waitAtStart, checked); apply(form); await settled();
    expect(emitter.waitAtStart).toBe(checked);
    expect(history(app)).toBe(before + 1); expect(save).toHaveBeenCalledTimes(1);
    expect(bound).toHaveBeenCalledTimes(1);
    expect(bound.mock.results[0].value.projectJSON).toBe(app.imageAssetService.prepareArchive(snapshot(app)).projectJSON);
    save.mockRestore(); bound.mockRestore();
  }
});

test.each(['card', 'outline'])('%s Cancel and corrected no-op preserve stored state and history', async surface => {
  const { app, emitter } = await setup(), before = snapshot(app), undo = history(app), save = vi.spyOn(app, 'autoSave');
  change(formFor(surface, emitter).elements.waitAtStart, true);
  app.syncCrowdEditor(); app._queueSceneOutlineRefresh(); await settled();
  expect(formFor(surface, emitter).elements.waitAtStart.checked).toBe(true);
  cancel(formFor(surface, emitter)); await settled();
  expect(formFor(surface, emitter).elements.waitAtStart.checked).toBe(false);
  apply(formFor(surface, emitter)); await settled();
  expect(snapshot(app)).toEqual(before); expect(history(app)).toBe(undo); expect(save).not.toHaveBeenCalled();
});

test.each(['card', 'outline'])('%s pending-on survives lost prerequisites, refuses Apply and remains clearable', async surface => {
  const { app, entry, emitter } = await setup();
  change(formFor(surface, emitter).elements.waitAtStart, true);
  delete entry.area; app.eventBus.emit('scene:semantic-changed'); app._queueSceneOutlineRefresh(); await settled();
  let form = formFor(surface, emitter);
  expect(form.elements.waitAtStart.checked).toBe(true); expect(form.elements.waitAtStart.disabled).toBe(false);
  const before = snapshot(app), undo = history(app), save = vi.spyOn(app, 'autoSave');
  apply(form); await settled();
  expect(emitter.waitAtStart).toBe(false); expect(snapshot(app)).toEqual(before); expect(history(app)).toBe(undo);
  form = formFor(surface, emitter);
  expect(form.elements.waitAtStart.getAttribute('aria-invalid')).toBe('true');
  expect(form.textContent).toMatch(/every Entry.*Start area/i);
  change(form.elements.waitAtStart, false);
  app.syncCrowdEditor(); app._queueSceneOutlineRefresh(); await settled();
  form = formFor(surface, emitter); expect(form.elements.waitAtStart.disabled).toBe(false);
  apply(form); await settled();
  expect(formFor(surface, emitter).elements.waitAtStart.hasAttribute('aria-invalid')).toBe(false);
  expect(history(app)).toBe(undo); expect(save).not.toHaveBeenCalled();
});

test.each(['card', 'outline'])('%s inactive stored-on can turn off without losing Groups values', async surface => {
  const { app, emitter } = await setup();
  emitter.update({ waitAtStart: true, groups: true, groupSize: 9, groupWidth: 0.13, lifecycleMode: 'respawn' });
  app.syncCrowdEditor(); app._queueSceneOutlineRefresh(); await settled();
  const form = formFor(surface, emitter);
  expect(form.elements.waitAtStart.disabled).toBe(false);
  change(form.elements.waitAtStart, false); apply(form); await settled();
  expect(emitter.waitAtStart).toBe(false);
  expect([emitter.groups, emitter.groupSize, emitter.groupWidth]).toEqual([true, 9, 0.13]);
});

test('the outline edits a secondary emitter; creating waiting tokens does not consume Groups serials', async () => {
  const { app, layer, emitter } = await setup(true), other = layer.emitters[1];
  const token = app._groupContext(layer, emitter), serial = app._groupContextSerial;
  const fresh = new Emitter({ id: 'fresh-wait-context', seed: 91 });
  layer.emitters.push(fresh); app._waitingContext(layer, fresh);
  expect(app._groupContextSerial).toBe(serial);
  layer.emitters.pop();
  app._waitingOutlineContexts(); app._waitingOutlineContexts();
  expect(app._groupContext(layer, emitter)).toBe(token); expect(app._groupContextSerial).toBe(serial);
  await select(app, layer, other); change(formFor('outline', other).elements.waitAtStart, true);
  apply(formFor('outline', other)); await settled();
  expect(other.waitAtStart).toBe(true); expect(emitter.waitAtStart).toBe(false);
  expect(formFor('card', emitter).elements.waitAtStart.checked).toBe(false);
});

test('cross-panel waiting drafts refuse until the opposite panel is cancelled', async () => {
  const { app, emitter } = await setup();
  change(formFor('card', emitter).elements.waitAtStart, true);
  change(formFor('outline', emitter).elements.waitAtStart, true);
  apply(formFor('card', emitter)); await settled();
  expect(document.getElementById('crowd-wait-error').textContent).toMatch(/scene outline.*Apply final whistle.*Cancel edits/);
  apply(formFor('outline', emitter)); await settled();
  expect(document.querySelector('.scene-outline-error')?.textContent).toMatch(/crowd card.*Apply final whistle.*Cancel edits/);
  expect(emitter.waitAtStart).toBe(false);
  cancel(formFor('outline', emitter)); apply(formFor('card', emitter)); await settled();
  expect(emitter.waitAtStart).toBe(true);
});

test.each(['card', 'outline'].flatMap(groupSurface => ['card', 'outline'].flatMap(waitingSurface =>
  ['groups-first', 'waiting-first'].map(order => [groupSurface, waitingSurface, order]))))(
  '%s Groups/%s waiting drafts block %s without dropping either draft', async (groupSurface, waitingSurface, order) => {
  const { app, emitter } = await setup();
  change(groupFor(groupSurface, emitter).elements.groupSize, 19);
  change(formFor(waitingSurface, emitter).elements.waitAtStart, true);
  const error = (form, surface, id) => surface === 'card' ? document.getElementById(id).textContent
    : form.querySelector('.scene-outline-error')?.textContent;
  if (order === 'groups-first') {
    apply(groupFor(groupSurface, emitter)); await settled();
    expect(error(groupFor(groupSurface, emitter), groupSurface, 'crowd-group-error'))
      .toMatch(/Apply final whistle.*Cancel edits/);
    expect(emitter.groupSize).toBe(4); cancel(formFor(waitingSurface, emitter));
    apply(groupFor(groupSurface, emitter)); await settled(); expect(emitter.groupSize).toBe(19);
  } else {
    apply(formFor(waitingSurface, emitter)); await settled();
    expect(error(formFor(waitingSurface, emitter), waitingSurface, 'crowd-wait-error'))
      .toMatch(/Apply groups.*Cancel edits/);
    expect(emitter.waitAtStart).toBe(false); cancel(groupFor(groupSurface, emitter));
    apply(formFor(waitingSurface, emitter)); await settled(); expect(emitter.waitAtStart).toBe(true);
  }
});

test('same-ID replaced waiting commands cannot alter the new model', async () => {
  const { app, layer, emitter } = await setup();
  const form = formFor('outline', emitter), context = form.dataset.waitingContext;
  const command = { ...form.dataset, action: 'update-waiting', waitAtStart: 'on',
    outlineFormKey: `${sceneOutlineKey('emitter', layer.id, emitter.id)}:waiting-apply` };
  const replacement = Emitter.fromJSON(emitter.toJSON()); layer.emitters[0] = replacement;
  app.eventBus.emit('scene-outline:command', command); await settled();
  expect(replacement.waitAtStart).toBe(false);
  expect(() => app._setEmitterWaiting(layer, replacement, true, context, 'outline')).toThrow(/Final whistle changed/);
});

test('a hidden card waiting draft refuses duplication and returns without losing its provisional value', async () => {
  const { app, layer, emitter } = await setup();
  change(formFor('card', emitter).elements.waitAtStart, true);
  app.eventBus.emit('waypoint:deselect'); await settled();
  expect(() => app.duplicateCrowd(layer)).toThrow(/Apply final whistle.*Cancel edits/);
  await select(app, layer, emitter);
  expect(formFor('card', emitter).elements.waitAtStart.checked).toBe(true);
  cancel(formFor('card', emitter)); await settled(); expect(app._hasPendingWaitingDrafts()).toBe(false);
});

test.each(['waiting', 'groups'])('Escape in %s restores only its own draft and preserves a newer form error', async kind => {
  const { app, emitter } = await setup();
  const form = kind === 'waiting' ? formFor('outline', emitter) : groupFor('outline', emitter);
  const field = kind === 'waiting' ? form.elements.waitAtStart : form.elements.groupSize;
  change(field, kind === 'waiting' ? true : 19);
  const other = document.querySelector('form[data-outline-action="update-crowd"]');
  const message = 'Newer label refusal: shorten the name and retry.';
  app.eventBus.emit('scene-outline:error', { formKey: other.dataset.outlineFormKey, message });
  field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await settled();
  expect([...document.querySelectorAll('.scene-outline-error')].map(node => node.textContent)).toContain(message);
  const current = kind === 'waiting' ? formFor('outline', emitter) : groupFor('outline', emitter);
  expect(kind === 'waiting' ? current.elements.waitAtStart.checked : current.elements.groupSize.value)
    .toBe(kind === 'waiting' ? false : '4');
  expect(document.activeElement).toBe(current.querySelector('[type="submit"]'));
});


test.each(['groups', 'waiting'])('a pending other-kind secondary-emitter draft blocks %s acceptance', async kind => {
  const { app, layer, emitter } = await setup(true), other = layer.emitters[1];
  await select(app, layer, other);
  if (kind === 'groups') {
    change(formFor('outline', other).elements.waitAtStart, true);
    change(groupFor('card', emitter).elements.groupSize, 19); apply(groupFor('card', emitter)); await settled();
    expect(document.getElementById('crowd-group-error').textContent).toMatch(/Apply final whistle.*Cancel edits/);
    expect(emitter.groupSize).toBe(4); cancel(formFor('outline', other));
    apply(groupFor('card', emitter)); await settled(); expect(emitter.groupSize).toBe(19);
  } else {
    change(groupFor('outline', other).elements.groupSize, 19);
    change(formFor('card', emitter).elements.waitAtStart, true); apply(formFor('card', emitter)); await settled();
    expect(document.getElementById('crowd-wait-error').textContent).toMatch(/Apply groups.*Cancel edits/);
    expect(emitter.waitAtStart).toBe(false); cancel(groupFor('outline', other));
    apply(formFor('card', emitter)); await settled(); expect(emitter.waitAtStart).toBe(true);
  }
});

test.each(['card', 'outline'].flatMap(surface => ['guide', 'lifecycle'].map(prerequisite => [surface, prerequisite])))(
  '%s pending-on survives %s changes and accepts after prerequisites return', async (surface, prerequisite) => {
  const { app, layer, emitter } = await setup();
  change(formFor(surface, emitter).elements.waitAtStart, true);
  const context = app._waitingContext(layer, emitter);
  if (prerequisite === 'guide') layer.setGuideType('route'); else emitter.update({ lifecycleMode: 'respawn' });
  app.eventBus.emit('crowd:param-changed'); app._queueSceneOutlineRefresh(); await settled();
  expect(app._waitingContext(layer, emitter)).toBe(context);
  expect(formFor(surface, emitter).elements.waitAtStart.checked).toBe(true);
  expect(formFor(surface, emitter).elements.waitAtStart.disabled).toBe(false);
  apply(formFor(surface, emitter)); await settled(); expect(emitter.waitAtStart).toBe(false);
  expect(formFor(surface, emitter).elements.waitAtStart.getAttribute('aria-invalid')).toBe('true');
  if (prerequisite === 'guide') layer.setGuideType('graph'); else emitter.update({ lifecycleMode: 'collect' });
  app.eventBus.emit('crowd:param-changed'); app._queueSceneOutlineRefresh(); await settled(); app._flushPendingUndo();
  expect(app._waitingContext(layer, emitter)).toBe(context);
  const undo = history(app), save = vi.spyOn(app, 'autoSave');
  apply(formFor(surface, emitter)); await settled();
  expect(emitter.waitAtStart).toBe(true); expect(history(app)).toBe(undo + 1); expect(save).toHaveBeenCalledTimes(1);
});


test('Clear All discards waiting card drafts, refusal ownership and retained model references immediately', async () => {
  const { app, emitter } = await setup();
  app.background.image = new Image(); app._autosaveBackgroundCache = null;
  change(formFor('card', emitter).elements.waitAtStart, true); apply(formFor('card', emitter)); await settled();
  expect(document.getElementById('crowd-wait-error').hidden).toBe(false);
  clearProject(app); await settled();
  expect(app._waitingCardRecord).toBeNull(); expect(app._waitingCardDrafts.size).toBe(0);
  expect(document.getElementById('crowd-wait-form').elements.waitAtStart.checked).toBe(false);
  expect(document.getElementById('crowd-wait-error').hidden).toBe(true);
});


test('accepted waiting changes invalidate held old commands before they can undo the new value', async () => {
  const { app, layer, emitter } = await setup();
  const old = formFor('outline', emitter), context = old.dataset.waitingContext;
  const command = { ...old.dataset, action: 'update-waiting' };
  change(formFor('card', emitter).elements.waitAtStart, true); apply(formFor('card', emitter)); await settled();
  expect(emitter.waitAtStart).toBe(true); expect(app._waitingContext(layer, emitter)).not.toBe(context);
  const before = snapshot(app), undo = history(app), save = vi.spyOn(app, 'autoSave');
  app.eventBus.emit('scene-outline:command', command); await settled();
  expect(snapshot(app)).toEqual(before); expect(history(app)).toBe(undo); expect(save).not.toHaveBeenCalled();
  expect(() => app._setEmitterWaiting(layer, emitter, false, context, 'outline')).toThrow(/Final whistle changed/);
});

test('a replaced same-ID layer refuses its old waiting owner without history, save or live mutation', async () => {
  const { app, layer, emitter } = await setup(), context = app._waitingContext(layer, emitter);
  app.scene.flowLayers[0] = FlowLayer.fromJSON(layer.toJSON());
  const before = snapshot(app), undo = history(app), save = vi.spyOn(app, 'autoSave');
  expect(() => app._setEmitterWaiting(layer, emitter, true, context, 'card')).toThrow(/Final whistle changed/);
  expect(snapshot(app)).toEqual(before); expect(history(app)).toBe(undo); expect(save).not.toHaveBeenCalled();
});

test('an empty crowd keeps waiting help usable without borrowing a previous emitter’s refusal or draft', async () => {
  const { app, layer, emitter } = await setup();
  app.background.image = new Image(); app._autosaveBackgroundCache = null;
  change(formFor('card', emitter).elements.waitAtStart, true); apply(formFor('card', emitter)); await settled();
  const message = document.getElementById('crowd-wait-error').textContent;
  expect(message).toMatch(/Final whistle unchanged/);
  const empty = app.scene.addFlowLayer({ id: 'empty-waiting', name: 'Empty', emitters: [] });
  app.eventBus.emit('crowd:selected', empty); await settled();
  const form = document.getElementById('crowd-wait-form');
  expect(form.hidden).toBe(false); expect(form.elements.waitAtStart.disabled).toBe(true);
  expect(document.getElementById('crowd-wait-hint').textContent).toMatch(/Start points/);
  expect(document.getElementById('crowd-wait-error').hidden).toBe(true);
  await select(app, layer, emitter);
  expect(formFor('card', emitter).elements.waitAtStart.checked).toBe(true);
  expect(document.getElementById('crowd-wait-error').hidden).toBe(false);
  expect(document.getElementById('crowd-wait-error').textContent).toBe(message);
});

test('a held waiting capability cannot author after the same emitter moves to another actual layer', async () => {
  const { app, layer, emitter } = await setup();
  const oldContext = app._waitingContext(layer, emitter);
  const moved = FlowLayer.fromJSON(layer.toJSON());
  moved.id = 'moved-waiting-layer';
  moved.emitters = [emitter];
  app.scene.flowLayers[0] = moved;
  const before = snapshot(app), undo = history(app), save = vi.spyOn(app, 'autoSave');
  expect(app._waitingContext(moved, emitter)).not.toBe(oldContext);
  expect(() => app._setEmitterWaiting(moved, emitter, true, oldContext, 'card'))
    .toThrow(/Final whistle changed/);
  expect(snapshot(app)).toEqual(before);
  expect(history(app)).toBe(undo);
  expect(save).not.toHaveBeenCalled();
});
