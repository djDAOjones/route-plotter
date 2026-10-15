import { ImageAsset } from '../src/models/ImageAsset.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { retireApp } from './helpers/bootApp.js';
import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, settled } from './helpers/noRouteScene.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import { sceneOutlineKey } from '../src/utils/sceneSemantics.js';

import { snapshot, history, outlineForm, layerButton, setupCopy, pressCopy } from './helpers/crowdDuplicate.js';

afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.getItem.mockImplementation(() => null);
});

test.each(['layers', 'outline'])('%s duplicates the middle crowd with one reversible save and fresh identity',
  async surface => {
    const app = await setupCopy(), source = app.scene.getFlowLayer('source');
    const before = source.toJSON(), layers = app.scene.getFlowLayers(), undo = history(app);
    const save = vi.spyOn(app, 'autoSave');
    await pressCopy(app, surface, source);
    const copy = app.scene.getFlowLayers()[2];
    expect(app.scene.getFlowLayers().map(layer => layer.id)).toEqual(['below', 'source', copy.id, 'above']);
    expect(copy.id).not.toBe('source'); expect(copy.name).toBe('Stand copy');
    expect(app.selectedCrowd).toBe(copy); expect(history(app)).toBe(undo + 1); expect(save).toHaveBeenCalledOnce();
    expect(app.scene.getFlowLayer('source')).toBe(source);
    expect(source.toJSON()).toEqual(before);
    expect(app.scene.getFlowLayer('below')).toBe(layers[0]); expect(app.scene.getFlowLayer('above')).toBe(layers[2]);
    expect(copy.emitters).toHaveLength(2);
    for (let i = 0; i < copy.emitters.length; i++) {
      expect(copy.emitters[i].id).not.toBe(source.emitters[i].id);
      expect(copy.emitters[i].seed).not.toBe(source.emitters[i].seed);
    }
    const saved = copy.toJSON(), scene = snapshot(app).scene;
    document.getElementById('undo-btn').click(); await settled();
    expect(app.scene.getFlowLayers().map(layer => layer.id)).toEqual(['below', 'source', 'above']);
    expect(app.scene.getFlowLayer('source').toJSON()).toEqual(before);
    document.getElementById('redo-btn').click(); await settled();
    expect(app.scene.getFlowLayer(copy.id).toJSON()).toEqual(saved);
    expect(snapshot(app).scene).toEqual(scene);
    const zip = await app.imageAssetService.exportZip(snapshot(app));
    expect(await app.loadProject(zip)).toBe(true); expect(snapshot(app).scene).toEqual(scene);
    expect(app.scene.getFlowLayer(copy.id).toJSON()).toEqual(saved);
    expect(sceneOutlineKey('crowd', copy.id)).not.toBe(sceneOutlineKey('crowd', source.id));
  });

function holdExport(app) {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  const exporter = vi.spyOn(app.imageAssetService, 'exportZip').mockReturnValue(promise);
  return { resolve, reject, exporter };
}

test.each(['layers', 'outline'])('%s shows loading and admits only one held copy', async surface => {
  const app = await setupCopy(), source = app.selectedCrowd, before = snapshot(app), undo = history(app);
  const held = holdExport(app), save = vi.spyOn(app, 'autoSave'), flush = vi.spyOn(app, '_flushPendingUndo');
  const pending = pressCopy(app, surface, source);
  await Promise.resolve();
  expect(layerButton(app, source).disabled).toBe(true);
  expect(outlineForm(source).querySelector('[type="submit"]').disabled).toBe(true);
  expect(snapshot(app)).toEqual(before); expect(history(app)).toBe(undo);
  expect(save).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
  const second = app.duplicateCrowd(source);
  expect(held.exporter).toHaveBeenCalledOnce();
  held.resolve(new Blob()); await second; await pending;
  expect(app.scene.getFlowLayers()).toHaveLength(4); expect(save).toHaveBeenCalledOnce();
  expect(layerButton(app, source).disabled).toBe(false);
});

test.each(['layers', 'outline'])('%s refuses a provisional network drag and retries without committing it',
  async surface => {
    const app = await setupCopy(), source = app.selectedCrowd, before = snapshot(app), undo = history(app);
    const drag = { kind: 'node' }; app.networkEditService.drag = drag;
    const save = vi.spyOn(app, 'autoSave'), flush = vi.spyOn(app, '_flushPendingUndo');
    await pressCopy(app, surface, source);
    expect(snapshot(app)).toEqual(before); expect(history(app)).toBe(undo);
    expect(app.networkEditService.drag).toBe(drag);
    expect(save).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
    const error = surface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
    expect(error.textContent).toContain('Finish moving the network');
    app.networkEditService.drag = null; await pressCopy(app, surface, source);
    expect(app.scene.getFlowLayers()).toHaveLength(4);
  });

test.each([false, true])('delayed duplicate feedback preserves another form error (reject=%s)', async fail => {
  const app = await setupCopy(), source = app.selectedCrowd, held = holdExport(app);
  const pending = pressCopy(app, 'outline', source);
  await Promise.resolve();
  const other = document.querySelector('form[data-outline-action="update-crowd"][data-layer-id="source"]');
  other.elements.name.value = 'x'.repeat(201);
  other.elements.name.dispatchEvent(new Event('input', { bubbles: true }));
  other.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const before = other.querySelector('.scene-outline-error')?.textContent;
  expect(before).toContain('200 characters');
  if (fail) held.reject(new Error('Archive is full. Remove an image and retry.'));
  else held.resolve(new Blob());
  await pending;
  const after = document.querySelector('form[data-outline-action="update-crowd"][data-layer-id="source"]');
  expect(after.querySelector('.scene-outline-error')?.textContent).toBe(before);
});

const invariant = app => ({ project: snapshot(app), undo: app.undoService.createSnapshot(),
  selected: app.selectedCrowd, waypoint: app.selectedWaypoint, scope: app._sceneOutlineSelectionKey,
  recovery: localStorage.setItem.mock.calls.slice() });

test.each(['layers', 'outline'])('%s stale completion never adds to an intervening user action', async surface => {
  const cases = [
    ['authoring revision only', app => { app.markDirty(); }],
    ['accepted edit', app => { app.selectedCrowd.name = 'Edited'; app.saveUndoState(); app.autoSave(); }],
    ['unrecorded canonical edit', app => { app.selectedCrowd.emitters[0].speed = 0.45; }],
    ['selection', app => { app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('below')); }],
    ['same-ID replacement', app => { app.scene.fromJSON(app.scene.toJSON()); app.updateLayersStrip(); }],
    ['source deletion', app => { app.deleteCrowd(app.selectedCrowd); }],
    ['background cache', app => { app._autosaveBackgroundCache = { image: null, dataURL: 'different' }; }],
    ['undo owner', app => { app.undoService = Object.create(app.undoService); }],
    ['new field draft', () => { document.getElementById('crowd-seed-value').value = '12345'; }],
    ['pointer started', app => { app.interactionHandler.activePointer = { mode: 'canvas' }; }],
    ['Open begins', app => {
      app._projectGeneration = (app._projectGeneration || 0) + 1; app._openingLabel = 'Opening…';
    }],
  ];
  for (const [name, intervene] of cases) {
    const app = await setupCopy(), source = app.selectedCrowd, held = holdExport(app);
    const pending = pressCopy(app, surface, source); await Promise.resolve();
    intervene(app); await settled();
    app.storageService.flushAutoSave();
    const before = invariant(app), focus = document.activeElement;
    const save = vi.spyOn(app, 'autoSave'), flush = vi.spyOn(app, '_flushPendingUndo');
    held.resolve(new Blob()); await pending;
    expect(invariant(app), name).toEqual(before);
    expect(save, name).not.toHaveBeenCalled(); expect(flush, name).not.toHaveBeenCalled();
    if (focus !== document.body && focus.isConnected) expect(document.activeElement, name).toBe(focus);
    held.exporter.mockRestore(); save.mockRestore(); flush.mockRestore();
    app.interactionHandler.activePointer = null; retireApp(app);
  }
});

test.each(['layers', 'outline'])('%s refuses unsubmitted range and seed fields, preserves errors and retries',
  async surface => {
    for (const id of ['crowd-count-field', 'crowd-seed-value']) {
      const app = await setupCopy(), source = app.selectedCrowd;
      const field = document.getElementById(id); expect(field).toBeTruthy();
      for (const draft of ['123', '']) {
        field.value = draft;
        const before = invariant(app), save = vi.spyOn(app, 'autoSave');
        await pressCopy(app, surface, source);
        expect(invariant(app)).toEqual(before); expect(save).not.toHaveBeenCalled();
        expect(field.value).toBe(draft);
        app.updateLayersStrip(); app._refreshSceneOutline();
        const container = surface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
        const error = container.querySelector(surface === 'layers' ? '.layer-copy-reason' : '.scene-outline-error');
        expect(error.textContent).toContain('Finish editing the current crowd field');
        const button = surface === 'layers'
          ? layerButton(app, source) : outlineForm(source).querySelector('[type=submit]');
        expect(button.getAttribute('aria-describedby').split(/\s+/)).toContain(error.id);
        expect(button.hasAttribute('aria-invalid')).toBe(false); save.mockRestore();
      }
      app.syncCrowdEditor(); await settled();
      await pressCopy(app, surface, source); expect(app.scene.getFlowLayers()).toHaveLength(4);
      retireApp(app);
    }
  });

test.each(['layers', 'outline'])('%s failure restores dropped focus but preserves deliberate focus elsewhere',
  async surface => {
    const app = await setupCopy(), source = app.selectedCrowd;
    for (const elsewhere of [false, true]) {
      const held = holdExport(app), pending = pressCopy(app, surface, source); await Promise.resolve();
      const other = document.getElementById('help-btn'); expect(other).toBeTruthy();
      if (elsewhere) other.focus();
      held.reject(new Error('Archive is full. Remove an image and retry.')); await pending;
      const button = surface === 'layers'
          ? layerButton(app, source) : outlineForm(source).querySelector('[type=submit]');
      expect(document.activeElement).toBe(elsewhere ? other : button);
      const described = button.getAttribute('aria-describedby').split(/\s+/);
      expect(described.every(id => document.getElementById(id))).toBe(true);
      expect(button.hasAttribute('aria-invalid')).toBe(false); held.exporter.mockRestore();
    }
  });

test.each(['layers', 'outline'])('%s resolves copied waypoint anchors before first render and retains recovery',
  async surface => {
    const app = await setupCopy();
    const data = snapshot(app);
    data.waypoints = [{ id: 'waypoint', isMajor: true, imgX: 0.63, imgY: 0.41 }];
    const sourceData = data.scene.flowLayers[1];
    sourceData.graph.nodes[0].anchorWaypointId = 'waypoint';
    sourceData.graph.nodes[1].anchorWaypointId = 'missing-waypoint';
    sourceData.emitters[0].releaseAnchor = { waypointId: 'waypoint', at: 'pause-end' };
    expect(await loadCurrentSnapshot(app, data)).toBe(true);
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('source')); await settled();
    const source = app.selectedCrowd, before = source.toJSON(), frames = [];
    const queue = app.queueRender;
    vi.spyOn(app, 'queueRender').mockImplementation(function () {
      const copy = this.scene.getFlowLayers().find(layer => !['below', 'source', 'above'].includes(layer.id));
      if (copy) frames.push(copy.graph.getNodes().map(node => node.position()));
      return queue.call(this);
    });
    await pressCopy(app, surface, source);
    const copy = app.selectedCrowd, nodes = copy.graph.getNodes();
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0]).toEqual([{ x: 0.63, y: 0.41 }, { x: 0.8, y: 0.5 }]);
    expect(nodes[0].x).toBe(0.2); expect(nodes[0].y).toBe(0.5);
    expect(nodes[0].anchorWaypointId).toBe('waypoint');
    expect(copy.emitters[0].releaseAnchor).toEqual({ waypointId: 'waypoint', at: 'pause-end' });
    expect(source.toJSON()).toEqual(before);
    app.waypoints[0].imgX = 0.71; app.calculatePath(); await settled();
    expect(nodes[0].position()).toEqual({ x: 0.71, y: 0.41 });
    expect(nodes[0].x).toBe(0.2);
    app.saveRecovery(); app.storageService.flushAutoSave();
    const text = localStorage.setItem.mock.calls.filter(([key]) => key === 'routePlotter_autosave').at(-1)[1];
    const scene = snapshot(app).scene;
    app.storageService.loadAutoSaveText = () => text;
    expect(await app.loadAutosave()).toBe(true); expect(snapshot(app).scene).toEqual(scene);
  });

test.each(['layers', 'outline'].flatMap(surface => ['empty', 'hidden-route'].map(kind => [surface, kind])))(
  '%s copies %s through the native action without changing unrelated settings', async (surface, kind) => {
    const app = await setupCopy(), data = snapshot(app), sourceData = data.scene.flowLayers[1];
    if (kind === 'empty') { sourceData.emitters = []; sourceData.graph = { nodes: [], edges: [] }; }
    else { sourceData.visible = false; sourceData.guideType = 'route'; }
    expect(await loadCurrentSnapshot(app, data)).toBe(true);
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('source')); await settled();
    const source = app.selectedCrowd, before = source.toJSON();
    await pressCopy(app, surface, source);
    const copy = app.selectedCrowd;
    expect(copy).not.toBe(source); expect(copy.visible).toBe(source.visible);
    expect(copy.guideType).toBe(source.guideType); expect(copy.emitters).toHaveLength(source.emitters.length);
    expect(copy.graph.getNodes()).toHaveLength(source.graph.getNodes().length);
    expect(source.toJSON()).toEqual(before);
    copy.name = 'Independent';
    if (copy.graph.getNodes().length) copy.graph.getNodes()[0].area.width = 0.3;
    expect(source.toJSON()).toEqual(before);
  });

test('copied patterns agree after warm/cold/backward seeks, Undo/Redo and leave paused RAF empty', async () => {
  let nextId = 0, now = 0;
  const pending = new Map();
  vi.stubGlobal('requestAnimationFrame', callback => { const id = ++nextId; pending.set(id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', id => pending.delete(id));
  const drain = () => {
    for (let i = 0; i < 100 && pending.size; i++) {
      const [id, callback] = pending.entries().next().value; pending.delete(id); callback(now += 20);
    }
    expect(pending.size).toBe(0);
  };
  const app = await setupCopy(); drain();
  await pressCopy(app, 'layers', app.selectedCrowd); drain();
  const copy = app.selectedCrowd, data = copy.toJSON(), context = { durationMs: 10000, imageAspect: 1 };
  const cold = () => new SwarmEngine();
  const expected = new Map([0, 1000, 7000, 15000, 50000].map(time =>
    [time, cold().evaluate(time, FlowLayer.fromJSON(data), context)]));
  for (const time of [0, 7000, 50000, 15000, 1000, 0, 7000]) {
    expect(app.swarmEngine.evaluate(time, copy, context)).toEqual(expected.get(time));
  }
  expect(app.swarmEngine.scheduleDots(copy, context)).toEqual(cold().scheduleDots(FlowLayer.fromJSON(data), context));
  const finish = app.swarmEngine.crowdFinishMs(copy, context);
  app.undo(); await settled(); drain(); app.redo(); await settled(); drain();
  const restored = app.scene.getFlowLayer(copy.id);
  expect(restored.toJSON()).toEqual(data);
  for (const [time, dots] of expected) expect(app.swarmEngine.evaluate(time, restored, context)).toEqual(dots);
  expect(app.swarmEngine.crowdFinishMs(restored, context)).toBe(finish);
  expect(app.animationEngine.isPlaying()).toBe(false); drain();
});

test.each(['layers', 'outline'])('%s requires retained original background bytes and permits a corrected retry',
  async surface => {
    const app = await setupCopy(), source = app.selectedCrowd;
    app.background.image = new Image(); app._autosaveBackgroundCache = null;
    const before = invariant(app), save = vi.spyOn(app, 'autoSave');
    const exporter = vi.spyOn(app.imageAssetService, 'exportZip');
    await pressCopy(app, surface, source);
    expect(invariant(app)).toEqual(before); expect(save).not.toHaveBeenCalled();
    expect(exporter).not.toHaveBeenCalled();
    const container = surface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
    expect(container.textContent).toContain('Original background bytes are unavailable');
    app.background.image = null;
    await pressCopy(app, surface, source); expect(app.scene.getFlowLayers()).toHaveLength(4);
  });


test.each(['layers', 'outline'])('%s reserves image asset IDs in the complete new identity inventory', async surface => {
  const app = await setupCopy(), source = app.selectedCrowd;
  const base64 = 'data:image/png;base64,' +
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const asset = new ImageAsset({ id: 'copy-1', name: 'marker.png', base64,
    width: 1, height: 1, mimeType: 'image/png', size: ImageAsset.inspectDataURL(base64).byteLength });
  app.imageAssetService.addAsset(asset); app.styles.pathHead.imageAssetId = asset.id;
  await pressCopy(app, surface, source);
  const copy = app.selectedCrowd;
  expect(copy).not.toBe(source);
  const identities = [copy.id, ...copy.emitters.map(emitter => emitter.id),
    ...copy.graph.getNodes().map(node => node.id), ...copy.graph.getEdges().map(edge => edge.id)];
  expect(identities).not.toContain(asset.id);
  expect(app.imageAssetService.getAsset(asset.id)).toBe(asset);
  expect(app.styles.pathHead.imageAssetId).toBe(asset.id);
});
