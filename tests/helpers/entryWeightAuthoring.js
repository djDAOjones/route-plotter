import { expect } from 'vitest';
import { blankProject, drawCrowd, settled } from './noRouteScene.js';

export const snapshot = app => app._buildProjectSnapshot({ includeAssets: false });
export const history = app => app.undoService.createSnapshot().undoStack.length;
export const selectedLayer = app => app.scene.getFlowLayers()[0];
export const entry = app => selectedLayer(app).graph.getNodesByType('entry')[0];
export const selectEntry = (app, node = entry(app)) => app.eventBus.emit('scene-outline:command', {
  action: 'select', kind: 'node', layerId: selectedLayer(app).id, nodeId: node.id,
});
export const cardField = node => [...document.querySelectorAll('#network-entry-weight-rows [data-node-id]')]
  .find(row => row.dataset.nodeId === node.id)?.querySelector('input');
export const weightForm = node => [...document.querySelectorAll('form[data-outline-action="update-entry-weight"]')]
  .find(form => form.dataset.nodeId === node.id);
export function change(field, value) {
  expect(field).toBeTruthy();
  field.focus(); field.value = String(value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}
export async function editWeight(app, surface, value, node = entry(app)) {
  if (surface === 'card') change(cardField(node), value);
  else {
    const form = weightForm(node);
    expect(form).toBeTruthy();
    change(form.elements.entryWeight, value);
    form.querySelector('[type="submit"]').click();
  }
  await settled();
}
export async function setupWeights() {
  const app = await blankProject(), drawn = drawCrowd(app);
  drawn.layer.graph.addNode({ id: 'second-entry', type: 'entry', x: 0.2, y: 0.2 });
  drawn.layer.graph.addEdge({ id: 'second-path', sourceId: 'second-entry', targetId: drawn.exit.id });
  drawn.layer.emitters[0].update({ lifecycleMode: 'collect', dotCount: 10, wobble: 0 });
  app.eventBus.emit('network:changed', { commit: true });
  selectEntry(app); app._flushPendingUndo(); await settled();
  return app;
}
