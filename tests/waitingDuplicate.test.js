import { afterEach, expect, test, vi } from 'vitest';
import { setupCopy, snapshot, pressCopy, layerButton, outlineForm } from './helpers/crowdDuplicate.js';
import { settled } from './helpers/noRouteScene.js';

const deferred = () => {
  let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve };
};
const waitingForm = (surface, e) => surface === 'card' ? document.getElementById('crowd-wait-form')
  : [...document.querySelectorAll('form[data-outline-action="update-waiting"]')].find(f => f.dataset.emitterId === e.id);
const change = (field, value) => { field.focus(); field.checked = value; field.dispatchEvent(new Event('input', { bubbles: true })); };
const capture = app => ({ json: JSON.stringify(snapshot(app)), undo: app.undoService.createSnapshot(),
  selected: app.selectedCrowd, scope: app._sceneOutlineSelectionKey });
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

test.each(['layers', 'outline'].flatMap(copySurface => ['card', 'outline'].flatMap(waitingSurface =>
  ['before', 'during'].map(when => [copySurface, waitingSurface, when]))))(
  '%s refuses %s waiting draft entered %s checked duplication and preserves focus/history until retry',
  async (copySurface, waitingSurface, when) => {
    const app = await setupCopy(), source = app.selectedCrowd, emitter = source.emitters[0];
    app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: source.id, emitterId: emitter.id });
    await settled();
    const before = capture(app), save = vi.spyOn(app, 'autoSave');
    let pending, hold, exportSpy;
    if (when === 'during') {
      hold = deferred(); exportSpy = vi.spyOn(app.imageAssetService, 'exportZip').mockReturnValue(hold.promise);
      pending = pressCopy(app, copySurface, source); await settled();
    }
    change(waitingForm(waitingSurface, emitter).elements.waitAtStart, true);
    if (when === 'before') await pressCopy(app, copySurface, source);
    else { hold.resolve(new Blob()); await pending; exportSpy.mockRestore(); }
    expect(capture(app)).toEqual(before); expect(save).not.toHaveBeenCalled();
    const copyContainer = copySurface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
    expect(copyContainer.textContent).toMatch(/Apply final whistle.*Cancel edits/);
    expect(waitingForm(waitingSurface, emitter).elements.waitAtStart.checked).toBe(true);
    const cancel = [...waitingForm(waitingSurface, emitter).querySelectorAll('button')].find(b => b.textContent === 'Cancel edits');
    cancel.click(); await settled();
    await pressCopy(app, copySurface, source);
    expect(app.scene.getFlowLayers()).toHaveLength(4); expect(save).toHaveBeenCalledTimes(1);
  });

test.each(['layers', 'outline'])('%s held job cannot accept after a real waiting edit or erase another form error', async surface => {
  const app = await setupCopy(), source = app.selectedCrowd, emitter = source.emitters[0];
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: source.id, emitterId: emitter.id });
  await settled();
  const hold = deferred(); vi.spyOn(app.imageAssetService, 'exportZip').mockReturnValue(hold.promise);
  const pending = pressCopy(app, surface, source); await settled();
  const waiting = waitingForm('card', emitter);
  change(waiting.elements.waitAtStart, true); waiting.querySelector('[type="submit"]').click(); await settled();
  expect(emitter.waitAtStart).toBe(true);
  const ordinary = [...document.querySelectorAll('form[data-outline-action="update-emitter"]')]
    .find(form => form.dataset.emitterId === emitter.id);
  app.eventBus.emit('scene-outline:error', { formKey: ordinary.dataset.outlineFormKey, message: 'Newer ordinary form error' });
  const before = capture(app), save = vi.spyOn(app, 'autoSave');
  hold.resolve(new Blob()); await pending;
  expect(capture(app)).toEqual(before); expect(save).not.toHaveBeenCalled();
  expect([...document.querySelectorAll('.scene-outline-error')].map(n => n.textContent)).toContain('Newer ordinary form error');
  expect(app.scene.getFlowLayers()).toHaveLength(3);
});


test.each(['layers', 'outline'])('%s real copy retains active and inactive waiting flags with new identities', async surface => {
  const app = await setupCopy(), source = app.selectedCrowd;
  source.emitters[0].update({ waitAtStart: true });
  source.emitters[1].update({ waitAtStart: true, lifecycleMode: 'respawn' });
  app.syncCrowdEditor(); app._queueSceneOutlineRefresh(); await settled(); app._flushPendingUndo();
  const before = source.toJSON(), save = vi.spyOn(app, 'autoSave');
  await pressCopy(app, surface, source);
  const copy = app.selectedCrowd;
  expect(copy).not.toBe(source); expect(copy.id).not.toBe(source.id);
  expect(copy.emitters.map(e => e.waitAtStart)).toEqual([true, true]);
  expect(copy.emitters[1].lifecycleMode).toBe('respawn');
  copy.emitters.forEach((e, i) => {
    expect(e.id).not.toBe(source.emitters[i].id); expect(e.seed).not.toBe(source.emitters[i].seed);
  });
  expect(source.toJSON()).toEqual(before); expect(save).toHaveBeenCalledTimes(1);
});
