import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { Emitter } from '../src/models/Emitter.js';
import { sceneOutlineKey } from '../src/utils/sceneSemantics.js';

const groupForm = emitter => [...document.querySelectorAll('form[data-outline-action="update-groups"]')]
  .find(form => form.dataset.emitterId === emitter.id) || null;
const feedback = form => form.querySelector('.scene-outline-error');
const change = (field, value) => {
  field.value = String(value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
};
async function toggle(key) {
  document.querySelector(`summary[data-outline-key="${key}:summary"]`).click();
  await settled();
}
async function refusedAndHidden(secondary = false) {
  const app = await blankProject(), { layer } = drawCrowd(app);
  if (secondary) layer.emitters.push(new Emitter({ id: 'secondary-feedback', dotCount: 3 }));
  const emitter = layer.emitters[secondary ? 1 : 0];
  emitter.update({ lifecycleMode: 'collect' });
  app.eventBus.emit('scene-outline:command', {
    action: 'select', kind: 'emitter', layerId: layer.id, emitterId: emitter.id,
  });
  await settled(); app._flushPendingUndo(); await settled();
  // A present image without retained source bytes triggers the real checked owner.
  app.background.image = new Image(); app._autosaveBackgroundCache = null;
  const before = app.scene.toJSON(), undo = app.undoService.createSnapshot(), save = vi.spyOn(app, 'autoSave');
  const form = groupForm(emitter), context = form.dataset.groupsContext;
  change(form.elements.groupSize, 3); form.querySelector('[type="submit"]').click(); await settled();
  const message = feedback(groupForm(emitter))?.textContent;
  expect(message).toMatch(/Groups unchanged: Original background bytes are unavailable.*Reload the PNG/);
  expect(app.scene.toJSON()).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(save).not.toHaveBeenCalled();
  const key = sceneOutlineKey('emitter', layer.id, emitter.id);
  await toggle(key); expect(groupForm(emitter)).toBeNull();
  expect(document.activeElement.dataset.outlineKey).toBe(`${key}:summary`);
  return { app, layer, emitter, key, context, message, before, undo, save };
}
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

test.each([['cancel', false], ['accept', false], ['cancel', true], ['accept', true]])(
  'a real Groups refusal returns after collapse and clears only on %s (secondary=%s)', async (resolution, secondary) => {
  const { app, emitter, key, context, message, before, undo, save } = await refusedAndHidden(secondary);
  await toggle(key);
  const form = groupForm(emitter), error = feedback(form);
  expect(form.dataset.groupsContext).toBe(context); expect(form.elements.groupSize.value).toBe('3');
  expect(error?.textContent).toBe(message);
  for (const field of form.querySelectorAll('input')) {
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby').split(/\s+/)).toContain(error.id);
  }
  expect(app.scene.toJSON()).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(save).not.toHaveBeenCalled();
  if (resolution === 'cancel') {
    [...form.querySelectorAll('button')].find(button => button.textContent === 'Cancel edits').click();
    await settled(); expect(groupForm(emitter).elements.groupSize.value).toBe('4');
    expect(app.scene.toJSON()).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo);
    expect(save).not.toHaveBeenCalled();
  } else {
    app.background.image = null;
    form.querySelector('[type="submit"]').click(); await settled();
    expect(emitter.groupSize).toBe(3); expect(save).toHaveBeenCalledTimes(1);
    expect(app.undoService.createSnapshot().undoStack).toHaveLength(undo.undoStack.length + 1);
  }
  expect(feedback(groupForm(emitter))).toBeNull(); expect(app._hasPendingGroupDrafts()).toBe(false);
  await toggle(key); await toggle(key);
  expect(feedback(groupForm(emitter))).toBeNull();
});

test('same-ID replacement while hidden cannot inherit the old Groups error or draft', async () => {
  const { app, layer, emitter, key, context, undo, save } = await refusedAndHidden();
  const replacement = Emitter.fromJSON(emitter.toJSON()); layer.emitters[0] = replacement;
  app._queueSceneOutlineRefresh(); await settled(); expect(groupForm(emitter)).toBeNull();
  await toggle(key);
  expect(groupForm(emitter).dataset.groupsContext).not.toBe(context);
  expect(groupForm(emitter).elements.groupSize.value).toBe('4'); expect(feedback(groupForm(emitter))).toBeNull();
  expect(replacement.groupSize).toBe(4); expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(save).not.toHaveBeenCalled();
});

test('a newer unrelated error owns feedback when a hidden Groups draft returns and is cancelled', async () => {
  const { app, emitter, key, undo, save } = await refusedAndHidden();
  const other = document.querySelector('form[data-outline-action="update-crowd"]');
  const message = 'A newer crowd label error; shorten the label and try again.';
  app.eventBus.emit('scene-outline:error', { formKey: other.dataset.outlineFormKey, message });
  await toggle(key);
  expect(groupForm(emitter).elements.groupSize.value).toBe('3'); expect(feedback(groupForm(emitter))).toBeNull();
  expect(feedback(document.querySelector('form[data-outline-action="update-crowd"]'))?.textContent).toBe(message);
  [...groupForm(emitter).querySelectorAll('button')].find(button => button.textContent === 'Cancel edits').click();
  await settled();
  expect(feedback(document.querySelector('form[data-outline-action="update-crowd"]'))?.textContent).toBe(message);
  expect(app.undoService.createSnapshot()).toEqual(undo); expect(save).not.toHaveBeenCalled();
});
