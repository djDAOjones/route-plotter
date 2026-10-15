import { afterEach, expect, test, vi } from 'vitest';
import { Scene } from '../src/models/Scene.js';
import { stageProjectModel } from '../src/app/persistence.js';
import { createCrowdCopy } from '../src/utils/crowdCopy.js';
import { blankProject, settled } from './helpers/noRouteScene.js';
import { loadCurrentSnapshot, freezeClock } from './helpers/projectSnapshot.js';
import { snapshot, pressCopy, layerButton, outlineForm } from './helpers/crowdDuplicate.js';

freezeClock();
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.getItem.mockImplementation(() => null); });
const treeSize = value => 1 + (value && typeof value === 'object'
  ? Object.values(value).reduce((sum, child) => sum + treeSize(child), 0) : 0);
const bytes = text => new TextEncoder().encode(text).length;
const archive = app => app.imageAssetService.prepareArchive(snapshot(app));
const candidate = app => {
  const data = snapshot(app), layers = data.scene.flowLayers;
  const used = layers.flatMap(layer => [layer.id, ...layer.emitters.map(e => e.id),
    ...layer.graph.nodes.map(n => n.id), ...layer.graph.edges.map(e => e.id)]);
  layers.splice(1, 0, createCrowdCopy(layers[0], used));
  return data;
};

function limitScene(budget, total) {
  const source = { id: 'source', name: 'Stand', emitters: [], graph: { nodes: [], edges: [] } };
  const layers = [source];
  if (budget === 'crowds') {
    while (layers.length < total) layers.push({ id: `layer-${layers.length}`, emitters: [] });
  } else if (budget === 'emitters') {
    source.emitters = [{ id: 'source-emitter', dotCount: 1, seed: 11 }];
    let remaining = total - 1;
    while (remaining) {
      const count = Math.min(64, remaining), id = `layer-${layers.length}`;
      layers.push({ id, emitters: Array.from({ length: count }, (_, i) => ({ id: `${id}-e${i}`, dotCount: 1 })) });
      remaining -= count;
    }
  } else if (budget === 'dots') {
    source.emitters = [{ id: 'source-emitter', dotCount: 1, seed: 11 }];
    let remaining = total - 1;
    while (remaining) {
      const count = Math.min(5000, remaining), id = `layer-${layers.length}`;
      layers.push({ id, emitters: [{ id: `${id}-e`, dotCount: count }] }); remaining -= count;
    }
  } else if (budget === 'nodes') {
    source.graph.nodes = [{ id: 'source-node', x: 0.5, y: 0.5 }];
    let remaining = total - 1;
    while (remaining) {
      const count = Math.min(2000, remaining), id = `layer-${layers.length}`;
      layers.push({ id, emitters: [], graph: { nodes: Array.from({ length: count }, (_, i) => ({
        id: `${id}-n${i}`, x: 0.5, y: 0.5,
      })) } });
      remaining -= count;
    }
  } else if (budget === 'paths') {
    source.graph.nodes = [{ id: 'a', x: 0.2, y: 0.5 }, { id: 'b', x: 0.8, y: 0.5 }];
    source.graph.edges = [{ id: 'source-edge', sourceId: 'a', targetId: 'b' }];
    let remaining = total - 1;
    while (remaining) {
      const count = Math.min(4000, remaining), id = `layer-${layers.length}`;
      layers.push({ id, emitters: [], graph: { nodes: [{ id: 'a', x: 0.2, y: 0.5 }, { id: 'b', x: 0.8, y: 0.5 }],
        edges: Array.from({ length: count }, (_, i) => ({ id: `${id}-p${i}`, sourceId: 'a', targetId: 'b' })) } });
      remaining -= count;
    }
  }
  return { flowLayers: layers };
}

const limits = { crowds: 32, emitters: 256, dots: 20000, nodes: 10000, paths: 20000 };
test.each(Object.keys(limits))('%s exact and over budgets use the real Scene validator', budget => {
  expect(() => Scene.assertValidJSON(limitScene(budget, limits[budget]))).not.toThrow();
  expect(() => Scene.assertValidJSON(limitScene(budget, limits[budget] + 1))).toThrow(/limit|budget/);
});

async function openScene(app, scene) {
  const project = snapshot(app); project.scene = scene;
  expect(await loadCurrentSnapshot(app, project)).toBe(true);
  const zip = await app.imageAssetService.exportZip(snapshot(app));
  expect(await app.loadProject(zip)).toBe(true);
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'crowd', layerId: 'source' });
  await settled(); app.storageService.flushAutoSave();
}

const cases = ['layers', 'outline'].flatMap(surface => ['crowds', 'emitters', 'dots', 'nodes']
  .flatMap(budget => [false, true].map(fits => [surface, budget, fits])));
test.each(cases)('%s %s whole-project duplication fits=%s', async (surface, budget, fits) => {
  const app = await blankProject();
  vi.spyOn(app, 'render').mockImplementation(() => {});
  await openScene(app, limitScene(budget, limits[budget] - (fits ? 1 : 0)));
  const source = app.selectedCrowd, before = snapshot(app), undo = app.undoService.createSnapshot();
  const selected = app.selectedCrowd, saved = localStorage.setItem.mock.calls.slice();
  const save = vi.spyOn(app, 'autoSave'), flush = vi.spyOn(app, '_flushPendingUndo');
  await pressCopy(app, surface, source);
  if (fits) {
    expect(app.scene.getFlowLayers()).toHaveLength(before.scene.flowLayers.length + 1);
    expect(save).toHaveBeenCalledOnce();
    const scene = snapshot(app).scene;
    const first = await app.imageAssetService.exportZip(snapshot(app));
    expect(await app.loadProject(first)).toBe(true); expect(snapshot(app).scene).toEqual(scene);
    const second = await app.imageAssetService.exportZip(snapshot(app));
    expect(await app.loadProject(second)).toBe(true); expect(snapshot(app).scene).toEqual(scene);
  } else {
    expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo);
    expect(app.selectedCrowd).toBe(selected); expect(localStorage.setItem.mock.calls).toEqual(saved);
    expect(save).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
    const container = surface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
    expect(container.textContent).toMatch(/limit|budget/);
  }
}, 60000);

test.each(['layers', 'outline'].flatMap(surface => ['tree', 'metadata'].flatMap(budget =>
  [false, true].map(fits => [surface, budget, fits]))))(
  '%s %s boundary fits=%s is measured after real ZIP normalization', async (surface, budget, fits) => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const app = await blankProject(); vi.spyOn(app, 'render').mockImplementation(() => {});
    const scene = limitScene('emitters', 1);
    scene.flowLayers.push({ id: 'padding', emitters: [], graph: { nodes:
      Array.from({ length: 24 }, (_, i) => ({ id: `pad-${i}`, x: 0.5, y: 0.5, label: '' })) } });
    await openScene(app, scene);
    const metric = project => budget === 'tree' ? treeSize(project) :
      bytes(app.imageAssetService.prepareArchive(project).projectJSON);
    const delta = metric(candidate(app)) - metric(snapshot(app));
    const ceiling = budget === 'tree' ? 100000 : 2097152;
    if (budget === 'tree') {
      app.styles.copyFixture = [];
      app.styles.copyFixture = new Array(ceiling - (fits ? delta : 0) - treeSize(snapshot(app))).fill(0);
    } else {
      let remaining = ceiling - (fits ? delta : 0) - bytes(archive(app).projectJSON);
      for (const node of app.scene.getFlowLayer('padding').graph.getNodes()) {
        const count = Math.min(100000, remaining); node.label = 'x'.repeat(count); remaining -= count;
      }
      expect(remaining).toBe(0);
    }
    const normalized = archive(app).projectJSON;
    const original = await app.imageAssetService.exportZip(snapshot(app));
    expect(await app.loadProject(original)).toBe(true); expect(archive(app).projectJSON).toBe(normalized);
    app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'crowd', layerId: 'source' });
    await settled(); app.storageService.flushAutoSave();
    const before = snapshot(app), undo = app.undoService.createSnapshot(), save = vi.spyOn(app, 'autoSave');
    await pressCopy(app, surface, app.selectedCrowd);
    if (fits) {
      expect(metric(snapshot(app))).toBe(ceiling); expect(save).toHaveBeenCalledOnce();
      const accepted = archive(app).projectJSON;
      for (let i = 0; i < 2; i++) {
        const zip = await app.imageAssetService.exportZip(snapshot(app));
        expect(await app.loadProject(zip)).toBe(true); expect(archive(app).projectJSON).toBe(accepted);
      }
    } else {
      expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo);
      expect(save).not.toHaveBeenCalled();
    }
  }, 60000
);

test('Scene path cap is masked by the complete canonical tree cap, not claimed reopenable', () => {
  const scene = Scene.fromJSON(limitScene('paths', 20000));
  expect(() => Scene.assertValidJSON(scene.toJSON())).not.toThrow();
  expect(treeSize(scene.toJSON())).toBeGreaterThan(100000);
  expect(() => stageProjectModel({ coordVersion: 9, waypoints: [], scene: scene.toJSON() }))
    .toThrow(/too deeply nested or complex/);
});

test.each(['layers', 'outline'])('%s refuses paths at the earlier archive cap from an actually storable original',
  async surface => {
    const app = await blankProject(); vi.spyOn(app, 'render').mockImplementation(() => {});
    const graph = () => ({ nodes: [{ id: 'a', x: 0.2, y: 0.5 }, { id: 'b', x: 0.8, y: 0.5 }],
      edges: Array.from({ length: 4000 }, (_, i) => ({ id: `p${i}`, sourceId: 'a', targetId: 'b' })) });
    await openScene(app, { flowLayers: ['source', 'other'].map(id =>
      ({ id, name: id, emitters: [], graph: graph() })) });
    const proposed = candidate(app);
    expect(() => Scene.assertValidJSON(proposed.scene)).not.toThrow();
    expect(() => stageProjectModel(proposed)).not.toThrow();
    expect(() => app.imageAssetService.prepareArchive(proposed)).toThrow('metadata exceeds the 2 MB limit');
    const before = snapshot(app), undo = app.undoService.createSnapshot(), selected = app.selectedCrowd;
    const save = vi.spyOn(app, 'autoSave'), flush = vi.spyOn(app, '_flushPendingUndo');
    await pressCopy(app, surface, selected);
    expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo);
    expect(app.selectedCrowd).toBe(selected); expect(save).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
  }, 30000);
