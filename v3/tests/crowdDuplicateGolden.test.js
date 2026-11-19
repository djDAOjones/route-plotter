import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { freezeClock } from './helpers/projectSnapshot.js';
import { settled } from './helpers/noRouteScene.js';
import { snapshot, setupCopy, layerButton, outlineForm } from './helpers/crowdDuplicate.js';

freezeClock();
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.getItem.mockImplementation(() => null); });

test.each(['layers', 'outline'])('%s native duplicate action golden', async surface => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const app = await setupCopy(), source = app.selectedCrowd, before = snapshot(app), lines = [`surface ${surface}`];
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const exportZip = app.imageAssetService.exportZip;
  vi.spyOn(app.imageAssetService, 'exportZip').mockImplementation(async function (...args) {
    await hold; return exportZip.apply(this, args);
  });
  const button = surface === 'layers'
          ? layerButton(app, source) : outlineForm(source).querySelector('[type=submit]');
  const scope = document.getElementById(surface === 'layers' ? 'layers-strip' : 'scene-outline');
  scope.addEventListener('click', event => {
    if (event.target === button) lines.push(`native click ${button.type}`);
  }, true);
  scope.addEventListener('submit', event => lines.push(`native submit ${event.target.dataset.outlineAction}`), true);
  const save = vi.spyOn(app, 'autoSave');
  const semantic = vi.fn(); app.eventBus.on('scene:semantic-changed', semantic);
  const tell = vi.spyOn(app, 'announce');
  button.focus(); button.click(); await Promise.resolve();
  const pending = app._crowdDuplicateJob.promise;
  const loading = surface === 'layers'
          ? layerButton(app, source) : outlineForm(source).querySelector('[type=submit]');
  lines.push(`loading disabled=${loading.disabled} busy=${loading.getAttribute('aria-busy')}`);
  const unchanged = JSON.stringify(snapshot(app)) === JSON.stringify(before);
  lines.push(`before admission unchanged=${unchanged} saves=${save.mock.calls.length}`);
  release(); await pending; await settled();
  const copy = app.selectedCrowd;
  lines.push(`order ${app.scene.getFlowLayers().map(layer => layer.name).join(' | ')}`);
  lines.push(`selected ${copy.name}; original retained=${app.scene.getFlowLayer('source') === source}`);
  lines.push(`fresh seeds ${copy.emitters.map((emitter, i) => emitter.seed !== source.emitters[i].seed).join(',')}`);
  lines.push(`saved ${save.mock.calls.length}; semantic ${semantic.mock.calls.map(([event]) => event.kind).join(',')}`);
  const narration = tell.mock.calls.map(([message]) => message).filter(message => /Checking | duplicated$/.test(message));
  lines.push(`announced ${narration.join(' | ')}`);
  const focused = document.activeElement.classList.contains('layer-row')
    ? 'Layers select' : document.activeElement.dataset.outlineKey;
  lines.push(`focus ${focused}`.replace(copy.id, '<copy-id>'));
  const scene = snapshot(app).scene;
  app.undo(); await settled(); lines.push(`Undo crowds=${app.scene.getFlowLayers().length}`);
  app.redo(); await settled();
  lines.push(`Redo unchanged=${JSON.stringify(snapshot(app).scene) === JSON.stringify(scene)}`);
  const path = join(dirname(fileURLToPath(import.meta.url)), 'goldens', `controls-crowd-duplicate-${surface}.txt`);
  const text = `${lines.join('\n')}\n`;
  if (process.env.UPDATE_DUPLICATE_GOLDENS === '1') writeFileSync(path, text);
  expect(text).toBe(readFileSync(path, 'utf8'));
});
