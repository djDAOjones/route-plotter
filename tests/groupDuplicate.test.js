import { afterEach, expect, test, vi } from 'vitest';
import { setupCopy, snapshot, pressCopy, layerButton, outlineForm } from './helpers/crowdDuplicate.js';
import { settled } from './helpers/noRouteScene.js';

const deferred = () => {
  let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve };
};
const groupForm = (surface, e) => surface === 'card' ? document.getElementById('crowd-group-form')
  : [...document.querySelectorAll('form[data-outline-action="update-groups"]')].find(f => f.dataset.emitterId === e.id);
const change = (field, value) => { field.focus(); field.value = String(value); field.dispatchEvent(new Event('input', { bubbles: true })); };
const capture = app => ({ json: JSON.stringify(snapshot(app)), undo: app.undoService.createSnapshot(),
  selected: app.selectedCrowd, scope: app._sceneOutlineSelectionKey });
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

test.each(['layers', 'outline'].flatMap(copySurface => ['card', 'outline'].flatMap(groupSurface =>
  ['before', 'during'].map(when => [copySurface, groupSurface, when]))))(
  '%s refuses %s group draft entered %s checked duplication and preserves focus/history until retry',
  async (copySurface, groupSurface, when) => {
    const app = await setupCopy(), source = app.selectedCrowd, emitter = source.emitters[0];
    app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: source.id, emitterId: emitter.id });
    await settled();
    const before = capture(app), save = vi.spyOn(app, 'autoSave');
    let pending, hold, exportSpy;
    if (when === 'during') {
      hold = deferred(); exportSpy = vi.spyOn(app.imageAssetService, 'exportZip').mockReturnValue(hold.promise);
      pending = pressCopy(app, copySurface, source); await settled();
    }
    change(groupForm(groupSurface, emitter).elements.groupSize, 19);
    if (when === 'before') await pressCopy(app, copySurface, source);
    else { hold.resolve(new Blob()); await pending; exportSpy.mockRestore(); }
    expect(capture(app)).toEqual(before); expect(save).not.toHaveBeenCalled();
    const copyContainer = copySurface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
    expect(copyContainer.textContent).toMatch(/Apply groups.*Cancel edits/);
    expect(groupForm(groupSurface, emitter).elements.groupSize.value).toBe('19');
    const cancel = [...groupForm(groupSurface, emitter).querySelectorAll('button')].find(b => b.textContent === 'Cancel edits');
    cancel.click(); await settled();
    await pressCopy(app, copySurface, source);
    expect(app.scene.getFlowLayers()).toHaveLength(4); expect(save).toHaveBeenCalledTimes(1);
  });

test.each(['layers', 'outline'])('%s held job cannot accept after a real group edit or erase another form error', async surface => {
  const app = await setupCopy(), source = app.selectedCrowd, emitter = source.emitters[0];
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: source.id, emitterId: emitter.id });
  await settled();
  const hold = deferred(); vi.spyOn(app.imageAssetService, 'exportZip').mockReturnValue(hold.promise);
  const pending = pressCopy(app, surface, source); await settled();
  const group = groupForm('card', emitter); group.elements.groups.checked = true;
  change(group.elements.groupSize, 2); group.querySelector('[type="submit"]').click(); await settled();
  expect(emitter.groups).toBe(true); expect(emitter.groupSize).toBe(2);
  const ordinary = [...document.querySelectorAll('form[data-outline-action="update-emitter"]')]
    .find(form => form.dataset.emitterId === emitter.id);
  app.eventBus.emit('scene-outline:error', { formKey: ordinary.dataset.outlineFormKey, message: 'Newer ordinary form error' });
  const before = capture(app), save = vi.spyOn(app, 'autoSave');
  hold.resolve(new Blob()); await pending;
  expect(capture(app)).toEqual(before); expect(save).not.toHaveBeenCalled();
  expect([...document.querySelectorAll('.scene-outline-error')].map(n => n.textContent)).toContain('Newer ordinary form error');
  expect(app.scene.getFlowLayers()).toHaveLength(3);
});
