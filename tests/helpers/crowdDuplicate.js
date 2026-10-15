import { expect } from 'vitest';
import { blankProject, settled } from './noRouteScene.js';
import { loadCurrentSnapshot } from './projectSnapshot.js';

export const snapshot = app => app._buildProjectSnapshot({ includeAssets: false });
export const history = app => app.undoService.createSnapshot().undoStack.length;
export const outlineForm = source => [...document.querySelectorAll('form[data-outline-action="duplicate-crowd"]')]
  .find(form => form.dataset.layerId === source.id);
export const layerButton = (app, source) => app._crowdRowOf(source)?.closest('li').querySelector('.layer-duplicate');

export async function setupCopy() {
  const app = await blankProject();
  app.scene.fromJSON({ flowLayers: [
    { id: 'below', name: 'Below', emitters: [{ id: 'below-dots', seed: 1, dotCount: 1 }] },
    { id: 'source', name: 'Stand', graph: {
      nodes: [{ id: 'entry', type: 'entry', x: 0.2, y: 0.5, entryWeight: 3,
        area: { shape: 'ellipse', width: 0.12, height: 0.1, turn: 13 } },
      { id: 'exit', type: 'exit', x: 0.8, y: 0.5,
        area: { shape: 'rectangle', width: 0.2, height: 0.3, turn: -9 } }],
      edges: [{ id: 'street', sourceId: 'entry', targetId: 'exit', direction: 'one-way', weight: 2.75,
        controlPoints: [{ x: 0.4, y: 0.3 }] }],
    }, emitters: [{ id: 'fans', seed: 7, dotCount: 4, lifecycleMode: 'collect' },
      { id: 'others', seed: 19, dotCount: 3, lifecycleMode: 'disappear' }] },
    { id: 'above', name: 'Above', emitters: [{ id: 'above-dots', seed: 2, dotCount: 1 }] },
  ] });
  expect(await loadCurrentSnapshot(app, snapshot(app))).toBe(true);
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'crowd', layerId: 'source' });
  await settled();
  app.storageService.flushAutoSave();
  return app;
}

export async function pressCopy(app, surface, source) {
  const button = surface === 'layers'
    ? layerButton(app, source) : outlineForm(source)?.querySelector('[type="submit"]');
  expect(button, `${surface} has a native Duplicate crowd action`).toBeTruthy();
  button.focus(); button.click();
  await app._crowdDuplicateJob?.promise?.catch(() => {});
  await settled();
}

