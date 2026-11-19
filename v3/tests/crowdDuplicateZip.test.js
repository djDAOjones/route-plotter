import { afterEach, expect, test, vi } from 'vitest';
import JSZip from 'jszip';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { createCrowdCopy } from '../src/utils/crowdCopy.js';
import { stageProjectModel } from '../src/app/persistence.js';
import { freezeClock } from './helpers/projectSnapshot.js';
import { settled } from './helpers/noRouteScene.js';
import { incompressiblePng } from './helpers/incompressiblePng.js';
import { snapshot, setupCopy, pressCopy, layerButton, outlineForm } from './helpers/crowdDuplicate.js';

freezeClock();
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.getItem.mockImplementation(() => null); });
const ceiling = 50 * 1024 * 1024;
const mib = 1024 * 1024;
const bg = app => app._autosaveBackgroundCache.dataURL;
function proposed(app) {
  const data = snapshot(app), layers = data.scene.flowLayers;
  const ids = layers.flatMap(layer => [layer.id, ...layer.emitters.map(e => e.id),
    ...layer.graph.nodes.map(n => n.id), ...layer.graph.edges.map(e => e.id)]);
  layers.splice(2, 0, createCrowdCopy(layers[1], ids)); return data;
}

// Fixture calibration uses the same real JSZip format, without the post-size refusal, only
// to measure how many random bytes to remove. The action itself always uses exportZip.
async function measure(app, data) {
  const prepared = app.imageAssetService.prepareArchive(data, bg(app)), zip = new JSZip();
  const assets = zip.folder('assets');
  for (const item of prepared.images) assets.file(item.filename, item.base64Data, { base64: true });
  zip.file(prepared.background.filename, prepared.background.base64Data, { base64: true });
  zip.file('project.json', prepared.projectJSON);
  return (await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })).size;
}

async function nearLimit() {
  const ImageBase = globalThis.Image;
  vi.stubGlobal('Image', class extends ImageBase { width = 1; height = 1; naturalWidth = 1; naturalHeight = 1; });
  const app = await setupCopy(); vi.spyOn(app, 'render').mockImplementation(() => {});
  app.waypoints = [];
  for (let i = 0; i < 3; i++) {
    const id = `asset-${i}`, base64 = incompressiblePng(13 * mib, i + 17);
    app.imageAssetService.addAsset(new ImageAsset({ id, base64, name: `${id}.png`,
      width: 1, height: 1, mimeType: 'image/png', size: 13 * mib }));
    app.waypoints.push(Waypoint.fromJSON({ id: `marker-${i}`, imgX: 0.1 + i * 0.2, imgY: 0.3,
      isMajor: true, markerStyle: 'custom', customImageAssetId: id }));
  }
  app.waypointsById.clear();
  app.waypoints.forEach(waypoint => app.waypointsById.set(waypoint.id, waypoint));
  const image = new Image(); image.src = incompressiblePng(100, 31); await settled();
  app.background.image = image;
  let size = 11 * mib;
  const setBackground = () => { app._autosaveBackgroundCache = { image, dataURL: incompressiblePng(size, 83) }; };
  setBackground();
  const first = await measure(app, snapshot(app)), copySize = await measure(app, proposed(app));
  const delta = copySize - first; expect(delta).toBeGreaterThan(4);
  const target = ceiling - Math.floor(delta / 2);
  for (let i = 0; i < 4; i++) {
    const actual = await measure(app, snapshot(app));
    if (actual <= ceiling && await measure(app, proposed(app)) > ceiling) break;
    size += target - actual; setBackground();
  }
  expect(() => stageProjectModel(proposed(app))).not.toThrow();
  expect(() => app.imageAssetService.prepareArchive(proposed(app), bg(app))).not.toThrow();
  const original = await app.imageAssetService.exportZip(snapshot(app), bg(app));
  expect(original.size).toBeLessThanOrEqual(ceiling);
  expect(await app.loadProject(original)).toBe(true);
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'crowd', layerId: 'source' });
  await settled(); app.storageService.flushAutoSave();
  await expect(app.imageAssetService.exportZip(proposed(app), bg(app))).rejects.toThrow('50 MB limit');
  return app;
}

test.each(['layers', 'outline'])('%s refuses a real completed ZIP crossing and succeeds after reducing content',
  async surface => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const app = await nearLimit(), source = app.selectedCrowd;
    const before = snapshot(app), undo = app.undoService.createSnapshot(), selected = app.selectedCrowd;
    const saved = localStorage.setItem.mock.calls.slice(), save = vi.spyOn(app, 'autoSave');
    const flush = vi.spyOn(app, '_flushPendingUndo');
    await pressCopy(app, surface, source);
    expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo);
    expect(app.selectedCrowd).toBe(selected); expect(localStorage.setItem.mock.calls).toEqual(saved);
    expect(save).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
    const container = surface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
    expect(container.textContent).toContain('50 MB limit');
    app._autosaveBackgroundCache.dataURL = incompressiblePng(1 * mib, 83);
    await pressCopy(app, surface, source);
    expect(app.scene.getFlowLayers()).toHaveLength(4); expect(save).toHaveBeenCalledOnce();
    const accepted = snapshot(app).scene;
    for (let i = 0; i < 2; i++) {
      const zip = await app.imageAssetService.exportZip(snapshot(app), bg(app));
      expect(await app.loadProject(zip)).toBe(true); expect(snapshot(app).scene).toEqual(accepted);
    }
  }, 180000);
