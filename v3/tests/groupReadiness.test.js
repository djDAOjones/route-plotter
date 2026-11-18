import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';

const snapshot = app => app._buildProjectSnapshot({ includeAssets: false });
const change = (field, value) => {
  field.value = String(value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
};
async function setup() {
  const app = await blankProject(), { layer } = drawCrowd(app);
  const emitter = layer.emitters[0]; emitter.update({ lifecycleMode: 'collect' });
  app.eventBus.emit('scene-outline:command', {
    action: 'select', kind: 'emitter', layerId: layer.id, emitterId: emitter.id,
  });
  await settled(); app._flushPendingUndo();
  return { app, layer, emitter };
}
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

test.each(['card', 'outline'])('%s Apply groups names its own action when an ordinary draft blocks it', async surface => {
  const { app, emitter } = await setup();
  const currentForm = () => surface === 'card' ? document.getElementById('crowd-group-form')
    : document.querySelector('form[data-outline-action="update-groups"]');
  let form = currentForm();
  const speed = document.getElementById('crowd-speed-field');
  change(speed, -1); change(form.elements.groupSize, 3);
  const before = snapshot(app), undo = app.undoService.createSnapshot();
  const save = vi.spyOn(app, 'autoSave'), flush = vi.spyOn(app, '_flushPendingUndo');
  form.querySelector('[type="submit"]').click(); await settled(); form = currentForm();
  expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(save).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
  const error = surface === 'card' ? document.getElementById('crowd-group-error')
    : form.querySelector('.scene-outline-error');
  expect(error.textContent).toContain('before applying groups');
  expect(error.textContent).not.toContain('duplicating');
  expect(form.elements.groupSize.value).toBe('3'); expect(speed.value).toBe('-1');
  expect(form.elements.groupSize.getAttribute('aria-describedby').split(/\s+/)).toContain(error.id);
  change(speed, emitter.speed); form = currentForm(); save.mockClear(); flush.mockClear();
  form.querySelector('[type="submit"]').click(); await settled();
  expect(emitter.groupSize).toBe(3); expect(save).toHaveBeenCalledTimes(1);
  expect(app.undoService.createSnapshot().undoStack.length).toBe(undo.undoStack.length + 1);
});

const blockers = [
  ['opening', app => { app._openingLabel = 'Loading'; },
    'Wait for the project to open before duplicating this crowd.'],
  ['rename', app => {
    const field = document.createElement('input'); field.className = 'layer-rename-input';
    app._layersStripEl.append(field);
  }, 'Finish renaming the crowd before duplicating. Then try again.'],
  ['network drag', app => { app.networkEditService.drag = {}; },
    'Finish moving the network before duplicating this crowd.'],
  ['pointer', app => { app.interactionHandler.activePointer = {}; },
    'Finish or cancel the current map edit before duplicating this crowd.'],
  ['area drawing', app => { app.areaDrawingService.isDrawing = true; },
    'Finish or cancel the current map edit before duplicating this crowd.'],
  ['area drag', app => { app.areaEditService.isDragging = true; },
    'Finish or cancel the current map edit before duplicating this crowd.'],
  ['Busyness drag', app => { app._crowdBusynessDrag = {}; },
    'Finish or cancel the current map edit before duplicating this crowd.'],
  ['network field', app => { vi.spyOn(app, '_hasPendingNetworkCardDrafts').mockReturnValue(true); },
    'Finish editing the current network field before duplicating.'],
];
test.each(blockers)('readiness for %s preserves literal copy feedback and names the Groups action',
  async (_name, block, original) => {
    const { app, layer, emitter } = await setup(); block(app);
    try {
      expect(() => app._assertCrowdDuplicateReady()).toThrow(original);
      expect(() => app._assertCrowdDuplicateReady({ layer, emitter, surface: 'card' }))
        .toThrow(original.replace(/duplicating(?: this crowd)?/g, 'applying groups'));
    } finally {
      app._openingLabel = null; app.networkEditService.drag = null;
      app.interactionHandler.activePointer = null; app.areaDrawingService.isDrawing = false;
      app.areaEditService.isDragging = false; app._crowdBusynessDrag = null;
      app._layersStripEl.querySelector('.layer-rename-input')?.remove();
    }
  });
