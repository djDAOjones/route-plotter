import { afterEach, expect, test, vi } from 'vitest';
import { clearProject } from '../src/app/projectReset.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { settled } from './helpers/noRouteScene.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import { snapshot, setupCopy, pressCopy, layerButton, outlineForm } from './helpers/crowdDuplicate.js';

const png = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const capture = app => ({ json: JSON.stringify(snapshot(app)), undo: app.undoService.createSnapshot(),
  selected: app.selectedCrowd, scope: app._sceneOutlineSelectionKey, saved: localStorage.setItem.mock.calls.slice() });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.getItem.mockImplementation(() => null); });

test.each(['layers', 'outline'].flatMap(surface => ['clear', 'undo', 'redo', 'load-start', 'asset', 'background']
  .map(action => [surface, action])))(
  '%s completion after real %s adds no changes or feedback', async (surface, action) => {
  const app = await setupCopy(), source = app.selectedCrowd;
  const original = await app.imageAssetService.exportZip(snapshot(app));
  const imported = await app.imageAssetService.importZip(original);
  if (['undo', 'redo'].includes(action)) {
    app.selectedCrowd.name = 'Renamed'; app.saveUndoState();
    if (action === 'redo') app.undo();
    await settled();
  }
  const currentSource = app.scene.getFlowLayer(source.id);
  app.eventBus.emit('crowd:selected', currentSource); await settled();
  const hold = deferred(); vi.spyOn(app.imageAssetService, 'exportZip').mockReturnValue(hold.promise);
  const pending = pressCopy(app, surface, currentSource); await Promise.resolve();
  let load, importHold;
  if (action === 'clear') clearProject(app);
  if (action === 'undo') { app.undo(); expect(app.scene.getFlowLayer('source').name).toBe('Stand'); }
  if (action === 'redo') app.redo();
  if (action === 'load-start') {
    importHold = deferred(); vi.spyOn(app.imageAssetService, 'importZip').mockReturnValue(importHold.promise);
    load = app.loadProject(original);
  }
  if (action === 'asset') app.imageAssetService.addAsset(new ImageAsset({ id: 'new-image', base64: png,
    name: 'different.png', width: 1, height: 1, mimeType: 'image/png', size: 68 }));
  if (action === 'background') app.background.image = new Image();
  await settled(); app.storageService.flushAutoSave();
  const before = capture(app), save = vi.spyOn(app, 'autoSave'), announce = vi.spyOn(app, 'announce');
  const focus = document.activeElement;
  hold.resolve(new Blob()); await pending;
  expect(capture(app)).toEqual(before); expect(save).not.toHaveBeenCalled();
  expect(announce).not.toHaveBeenCalledWith(expect.stringMatching(/duplicated$/));
  if (['clear', 'undo', 'redo', 'load-start'].includes(action)) expect(announce).not.toHaveBeenCalled();
  if (focus.isConnected && focus !== document.body) expect(document.activeElement).toBe(focus);
  if (importHold) { importHold.resolve(imported); expect(await load).toBe(true); }
});

test.each(['layers', 'outline'])('%s old cleanup cannot clear a newer project duplication job', async surface => {
  const app = await setupCopy(), first = deferred(), second = deferred(), source = app.selectedCrowd;
  const original = snapshot(app);
  vi.spyOn(app.imageAssetService, 'exportZip').mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const older = pressCopy(app, surface, source); await Promise.resolve();
  clearProject(app); expect(await loadCurrentSnapshot(app, original)).toBe(true);
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'crowd', layerId: 'source' });
  await settled();
  const nextSource = app.selectedCrowd;
  const newer = pressCopy(app, surface, nextSource); await Promise.resolve();
  const nextJob = app._crowdDuplicateJob, before = capture(app);
  first.resolve(new Blob()); await older;
  expect(app._crowdDuplicateJob).toBe(nextJob); expect(capture(app)).toEqual(before);
  expect(layerButton(app, nextSource).disabled).toBe(true);
  expect(outlineForm(nextSource).querySelector('[type=submit]').disabled).toBe(true);
  second.resolve(new Blob()); await newer;
  expect(app.scene.getFlowLayers()).toHaveLength(4); expect(app._crowdDuplicateJob).toBeNull();
});

test('a stale detached Layers button and same-ID outline command cannot duplicate a replacement', async () => {
  const app = await setupCopy(), source = app.selectedCrowd, oldButton = layerButton(app, source);
  const form = outlineForm(source), command = { action: 'duplicate-crowd', ...form.dataset };
  expect(await loadCurrentSnapshot(app, snapshot(app))).toBe(true);
  const before = capture(app), save = vi.spyOn(app, 'autoSave');
  oldButton.click(); app.eventBus.emit('scene-outline:command', command); await settled();
  expect(capture(app)).toEqual(before); expect(save).not.toHaveBeenCalled();
});

test('playback position alone does not invalidate admission and paused settlement remains idle', async () => {
  const app = await setupCopy(), hold = deferred();
  vi.spyOn(app.imageAssetService, 'exportZip').mockReturnValue(hold.promise);
  const pending = pressCopy(app, 'layers', app.selectedCrowd); await Promise.resolve();
  app.animationEngine.state.currentTime = 4000;
  hold.resolve(new Blob()); await pending;
  expect(app.scene.getFlowLayers()).toHaveLength(4);
  expect(app.animationEngine.state.isPlaying).toBe(false);
});

const networkDraftCases = ['width', 'height', 'turn', 'path-weight', 'entry-weight', 'node-path-weight'].flatMap(kind =>
  ['layers', 'outline'].flatMap(surface => [false, true].flatMap(active =>
    ['before', 'during'].flatMap(when => ['30', ''].map(value => [kind, surface, active, when, value])))));

test.each(networkDraftCases)(
  '%s draft %s active=%s entered %s (%s) refuses without source/history changes and retries',
  async (kind, surface, active, when, value) => {
    const app = await setupCopy(), source = app.selectedCrowd, service = app.networkEditService;
    if (kind === 'entry-weight') {
      source.graph.addNode({ id: 'other-entry', type: 'entry', x: 0.2, y: 0.8, entryWeight: 7 });
    }
    if (kind === 'node-path-weight') {
      source.graph.addNode({ id: 'exit-two', type: 'exit', x: 0.8, y: 0.8 });
      source.graph.addEdge({ id: 'second-street', sourceId: 'entry', targetId: 'exit-two', direction: 'one-way' });
    }
    if (active) app.enterNetworkEditMode();
    else service.bindForInspection(source);
    if (kind === 'path-weight') service.selectEdge(source.graph.getEdge('street'));
    else service.selectNode(source.graph.getNode('entry'));
    await settled(); app._flushPendingUndo(); app.storageService.flushAutoSave();
    const field = kind === 'node-path-weight' ? document.querySelector('#network-path-weight-rows input')
      : kind === 'entry-weight' ? document.querySelector('#network-entry-weight-rows .network-entry-weight-row:last-child input')
      : document.getElementById(kind === 'path-weight' ? 'network-edge-weight-field' : `network-node-area-${kind}`);
    expect(field).toBeTruthy(); expect(field.disabled).toBe(false);
    const shown = field.value, original = source.toJSON();
    const hold = when === 'during' ? deferred() : null;
    const exporter = hold ? vi.spyOn(app.imageAssetService, 'exportZip').mockReturnValue(hold.promise)
      : vi.spyOn(app.imageAssetService, 'exportZip');
    let pending;
    if (hold) {
      pending = pressCopy(app, surface, source); await Promise.resolve();
      expect(exporter).toHaveBeenCalledOnce();
    }
    field.value = value; field.focus();
    const before = capture(app), selection = { ...service.selection }, mode = service.active;
    const save = vi.spyOn(app, 'autoSave'), undo = vi.spyOn(app, 'saveUndoState');
    const flush = vi.spyOn(app, '_flushPendingUndo');
    if (hold) { hold.resolve(new Blob()); await pending; }
    else await pressCopy(app, surface, source);
    expect(capture(app)).toEqual(before); expect(source.toJSON()).toEqual(original);
    expect(service.selection).toEqual(selection); expect(service.layer).toBe(source); expect(service.active).toBe(mode);
    expect(field.value).toBe(value); expect(save).not.toHaveBeenCalled(); expect(undo).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
    if (!hold) expect(exporter).not.toHaveBeenCalled();
    const container = surface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
    expect(container.textContent).toContain('Finish editing the current network field');
    exporter.mockRestore(); field.value = shown;
    await pressCopy(app, surface, source);
    expect(source.toJSON()).toEqual(original); expect(app.scene.getFlowLayers()).toHaveLength(4);
    expect(save).toHaveBeenCalledOnce(); expect(undo).toHaveBeenCalledOnce(); expect(flush).toHaveBeenCalledOnce();
    expect(app.selectedCrowd.graph.getNodes()[0].area).toEqual(source.graph.getNodes()[0].area);
    expect(app.selectedCrowd.graph.getEdges()[0].weight).toBe(source.graph.getEdges()[0].weight);
    expect(app.selectedCrowd.graph.getNodes()[0].entryWeight).toBe(source.graph.getNodes()[0].entryWeight);
  });
