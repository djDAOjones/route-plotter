import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, byId, settled } from './helpers/noRouteScene.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import { stageProjectModel } from '../src/app/persistence.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { withBackground, withMarkerImage } from './helpers/traceProject.js';

const area = { shape: 'rectangle', width: 0.1, height: 0.1, turn: 0 };
const snapshot = app => app._buildProjectSnapshot({ includeAssets: false });
const treeSize = value => 1 + (value && typeof value === 'object'
  ? Object.values(value).reduce((sum, child) => sum + treeSize(child), 0) : 0);
const bytes = text => new TextEncoder().encode(text).length;
const control = key => byId(`network-node-area-${key}`);

afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

async function setup(type, budget, room = 0, assets = false, initialArea = null) {
  const app = await blankProject();
  vi.spyOn(app, 'render').mockImplementation(() => {});
  const layer = app.scene.addFlowLayer({ id: 'primary', emitters: [] });
  const node = layer.graph.addNode({ id: 'target', type });
  if (initialArea) node.area = { ...initialArea };
  let background = null;
  if (assets) {
    app.waypoints = [Waypoint.fromJSON({ id: 'image-waypoint', imgX: 0.5, imgY: 0.5, isMajor: true })];
    withMarkerImage(app);
    background = await withBackground(app);
  }
  if (budget === 'tree') {
    // Unknown style extensions are retained by the real loader and canonical
    // writer. A compact retained array reaches the model-tree ceiling while
    // still fitting the independent pretty-printed archive byte ceiling.
    app.styles.retainedExtension = [];
    app.styles.retainedExtension = new Array(100000 - room - treeSize(snapshot(app))).fill(0);
    expect(treeSize(snapshot(app))).toBe(100000 - room);
    expect(await loadCurrentSnapshot(app, snapshot(app))).toBe(true);
    expect(treeSize(snapshot(app))).toBe(100000 - room);
    expect(Array.isArray(app.styles.retainedExtension)).toBe(true);
    expect(bytes(app.imageAssetService.prepareArchive(snapshot(app)).projectJSON)).toBeLessThan(2097152);
  } else {
    for (let n = 0; n < 22; n++) layer.graph.addNode({ id: `label${n}` });
    let remaining = 2097152 - room - bytes(app.imageAssetService.prepareArchive(snapshot(app), background).projectJSON);
    for (const filler of layer.graph.getNodes()) {
      const length = Math.min(100000, remaining);
      filler.label = 'x'.repeat(length); remaining -= length;
    }
    expect(remaining).toBe(0);
    expect(bytes(app.imageAssetService.prepareArchive(snapshot(app), background).projectJSON)).toBe(2097152 - room);
  }
  expect(() => stageProjectModel(JSON.parse(JSON.stringify(snapshot(app))))).not.toThrow();
  const activeLayer = app.scene.getFlowLayer(layer.id), activeNode = activeLayer.graph.getNode(node.id);
  app.selectedCrowd = activeLayer;
  app.networkEditService.bindForInspection(activeLayer);
  app.networkEditService.selectNode(activeNode);
  app._flushPendingUndo(); await settled();
  return { app, layer: activeLayer, node: activeNode, background };
}

function edit(app, layer, node, surface, shape = 'rectangle') {
  if (surface === 'card') {
    control('shape').value = shape;
    control('shape').dispatchEvent(new Event('change', { bubbles: true }));
  } else app.eventBus.emit('scene-outline:command', {
    action: 'update-node-area', layerId: layer.id, nodeId: node.id,
    shape, width: 10, height: 10, turn: 0, outlineFormKey: 'budget-area-form',
  });
}

test.each([
  ['tree', 'card', 'entry', false], ['tree', 'outline', 'exit', false],
  ['archive', 'card', 'exit', true], ['archive', 'outline', 'entry', false],
])('%s budget refuses a %s %s area before any durable change', async (budget, surface, type, assets) => {
  const { app, layer, node, background } = await setup(type, budget, 0, assets);
  if (assets) {
    // Leave room for every new area byte except one. Omitting either the
    // real image manifest or background filename would wrongly accept it.
    const written = app.imageAssetService.prepareArchive(snapshot(app), background).projectJSON;
    const proposed = JSON.parse(written);
    proposed.scene.flowLayers[0].graph.nodes[0].area = area;
    const delta = bytes(JSON.stringify(proposed, null, 2)) - bytes(written);
    node.label = node.label.slice(0, -(delta - 1));
    expect(bytes(app.imageAssetService.prepareArchive(snapshot(app), background).projectJSON))
      .toBe(2097152 - delta + 1);
    expect(app._autosaveBackgroundCache.dataURL).toBe(background);
    expect(app._autosaveBackgroundCache.image).toBe(app.background.image);
  }
  const before = JSON.stringify(snapshot(app)), undo = app.undoService.createSnapshot();
  const saved = localStorage.getItem('routePlotter_autosave');
  const selection = { ...app.networkEditService.selection };
  const flush = vi.spyOn(app, '_flushPendingUndo'), save = vi.spyOn(app, 'autoSave');
  const changed = vi.fn(), errors = vi.fn(), announce = vi.spyOn(app, 'announce');
  app.eventBus.on('network:changed', changed); app.eventBus.on('scene-outline:error', errors);
  edit(app, layer, node, surface);
  expect(node.area).toBeUndefined();
  expect(JSON.stringify(snapshot(app))).toBe(before);
  expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(app.networkEditService.selection).toEqual(selection);
  expect(localStorage.getItem('routePlotter_autosave')).toBe(saved);
  expect(flush).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  const reason = budget === 'tree' ? /too deeply nested or complex/ : /metadata exceeds the 2 MB limit/;
  if (surface === 'card') {
    expect(control('shape-error').hidden).toBe(false);
    expect(control('shape-error').textContent).toMatch(reason);
    expect(control('shape').getAttribute('aria-describedby')).toContain('network-node-area-shape-error');
    expect(control('shape').getAttribute('aria-invalid')).toBe('true');
    expect(control('shape').value).toBe('rectangle');
    app._syncNodeAreaCard();
    expect(control('shape').value).toBe('rectangle');
    expect(announce.mock.calls.some(([message]) => reason.test(message))).toBe(true);
    edit(app, layer, node, surface, 'none');
    expect(control('shape-error').hidden).toBe(true);
    expect(control('shape').hasAttribute('aria-invalid')).toBe(false);
  } else expect(errors.mock.calls[0][0]).toMatchObject({
    formKey: 'budget-area-form', message: expect.stringMatching(reason),
  });
  expect(() => stageProjectModel(JSON.parse(before))).not.toThrow();
  expect(() => app.imageAssetService.prepareArchive(JSON.parse(before), background)).not.toThrow();
}, 30000);

test('an area fitting exactly at the tree boundary is saved; None removes it in one undo step', async () => {
  const { app, layer, node } = await setup('exit', 'tree', 5);
  const before = app.undoService.createSnapshot().undoStack.length;
  edit(app, layer, node, 'card');
  expect(node.area).toEqual(area);
  expect(treeSize(snapshot(app))).toBe(100000);
  expect(() => stageProjectModel(JSON.parse(JSON.stringify(snapshot(app))))).not.toThrow();
  expect(app.undoService.createSnapshot().undoStack).toHaveLength(before + 1);
  edit(app, layer, node, 'outline', 'none');
  expect(node.toJSON()).not.toHaveProperty('area');
  expect(app.undoService.createSnapshot().undoStack).toHaveLength(before + 2);
}, 30000);


test('an area fitting exactly in the archive, including images, saves and reopens', async () => {
  const { app, layer, node, background } = await setup('entry', 'archive', 0, true);
  const written = app.imageAssetService.prepareArchive(snapshot(app), background).projectJSON;
  const candidate = JSON.parse(written);
  candidate.scene.flowLayers[0].graph.nodes[0].area = area;
  const delta = bytes(JSON.stringify(candidate, null, 2)) - bytes(written);
  node.label = node.label.slice(0, -delta);
  edit(app, layer, node, 'outline');
  expect(node.area).toEqual(area);
  const saved = snapshot(app);
  expect(bytes(app.imageAssetService.prepareArchive(saved, background).projectJSON)).toBe(2097152);
  const zip = await app.imageAssetService.exportZip(saved, background);
  expect(await app.loadProject(zip)).toBe(true);
  expect(app.scene.getFlowLayer(layer.id).graph.getNode(node.id).area).toEqual(area);
}, 30000);

test('a numeric edit over the archive limit keeps its draft and clears an error on correction', async () => {
  const { app, layer, node, background } = await setup('exit', 'archive', 0, false, area);
  const before = JSON.stringify(snapshot(app)), undo = app.undoService.createSnapshot();
  const flush = vi.spyOn(app, '_flushPendingUndo'), save = vi.spyOn(app, 'autoSave');
  const width = control('width');
  width.value = '11.123456789';
  width.dispatchEvent(new Event('change', { bubbles: true }));
  expect(JSON.stringify(snapshot(app))).toBe(before);
  expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(flush).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  expect(width.value).toBe('11.123456789');
  expect(width.getAttribute('aria-invalid')).toBe('true');
  expect(control('width-error').textContent).toMatch(/metadata exceeds the 2 MB limit/);
  app._syncNodeAreaCard();
  expect(width.value).toBe('11.123456789');
  width.value = '10'; width.dispatchEvent(new Event('change', { bubbles: true }));
  expect(control('width-error').hidden).toBe(true);
  expect(width.hasAttribute('aria-invalid')).toBe(false);
  expect(flush).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  // Once space is available the same real edit is accepted and persists.
  node.label = node.label.slice(0, -64);
  width.value = '11.123456789'; width.dispatchEvent(new Event('change', { bubbles: true }));
  expect(node.area.width).toBe(0.11123456789);
  expect(app.undoService.createSnapshot().undoStack).toHaveLength(undo.undoStack.length + 1);
  expect(() => app.imageAssetService.prepareArchive(snapshot(app), background)).not.toThrow();
}, 30000);
