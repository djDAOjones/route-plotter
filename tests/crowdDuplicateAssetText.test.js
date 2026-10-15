import { afterEach, expect, test, vi } from 'vitest';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { createCrowdCopy } from '../src/utils/crowdCopy.js';
import { freezeClock } from './helpers/projectSnapshot.js';
import { settled } from './helpers/noRouteScene.js';
import { snapshot, setupCopy, pressCopy, layerButton, outlineForm } from './helpers/crowdDuplicate.js';

freezeClock();
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });
const name = '🙂.png';
const png = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const asset = app => app.imageAssetService.getAssets().find(each => each.id === 'unicode-marker');
function proposed(app) {
  const data = snapshot(app), layers = data.scene.flowLayers;
  const ids = [...app.waypoints.map(w => w.id), ...app.imageAssetService.getAssetIds(),
    ...layers.flatMap(l => [l.id, ...l.emitters.map(e => e.id), ...l.graph.nodes.map(n => n.id),
      ...l.graph.edges.map(e => e.id)])];
  layers.splice(2, 0, createCrowdCopy(layers[1], ids)); return data;
}

test.each(['layers', 'outline'])('%s checks prepared manifest text and preserves the original image name and bytes',
  async surface => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const app = await setupCopy();
    app.imageAssetService.addAsset(new ImageAsset({ id: 'unicode-marker', name, base64: png,
      mimeType: 'image/png', width: 1, height: 1, size: 68 }));
    app.waypoints = [Waypoint.fromJSON({ id: 'unicode-waypoint', imgX: 0.1, imgY: 0.2,
      isMajor: true, markerStyle: 'custom', customImageAssetId: 'unicode-marker' })];
    app.waypointsById.clear(); app.waypointsById.set(app.waypoints[0].id, app.waypoints[0]);
    expect(await app.loadProject(await app.imageAssetService.exportZip(snapshot(app)))).toBe(true);
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('source')); await settled();
    app.styles.zipPadding = '';
    const prepared = data => app.imageAssetService.prepareArchive(data).projectJSON;
    const index = prepared(proposed(app)).indexOf(name); expect(index).toBeGreaterThan(0);
    // The name is owned by the asset store, not the model-only snapshot.
    expect(JSON.stringify(proposed(app))).not.toContain(name);
    app.styles.zipPadding = 'a'.repeat((16383 - index % 16384 + 16384) % 16384);
    const original = await app.imageAssetService.exportZip(snapshot(app));
    expect(await app.loadProject(original)).toBe(true); expect(asset(app).name).toBe(name);
    expect(asset(app).base64).toBe(png);
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('source')); await settled();
    app.storageService.flushAutoSave();
    const candidate = proposed(app); expect(prepared(candidate).indexOf(name) % 16384).toBe(16383);
    const bad = await app.imageAssetService.exportZip(candidate);
    let corruptName = null;
    try { corruptName = (await app.imageAssetService.importZip(bad)).imageAssets[0].name; }
    catch { /* A loader refusal also demonstrates that text did not survive. */ }
    expect(corruptName).not.toBe(name);
    const before = snapshot(app), undo = app.undoService.createSnapshot(), source = app.selectedCrowd;
    const saved = localStorage.setItem.mock.calls.slice(), save = vi.spyOn(app, 'autoSave');
    await pressCopy(app, surface, source);
    let exactName = null;
    try {
      const after = await app.imageAssetService.importZip(await app.imageAssetService.exportZip(snapshot(app)));
      exactName = after.imageAssets[0].name;
    } catch { /* The exact-name assertion also rejects a generated ZIP that will not load. */ }
    expect(exactName).toBe(name);
    expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo);
    expect(app.selectedCrowd).toBe(source); expect(save).not.toHaveBeenCalled();
    expect(localStorage.setItem.mock.calls).toEqual(saved);
    const container = surface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
    expect(container.textContent).toContain('Project text cannot be saved intact');
    const form = document.querySelector('form[data-outline-action="update-crowd"][data-layer-id="source"]');
    form.elements.name.value = 'Standx'; form.elements.name.dispatchEvent(new Event('input', { bubbles: true }));
    form.querySelector('[type=submit]').click(); await settled(); save.mockClear();
    await pressCopy(app, surface, source); expect(app.scene.getFlowLayers()).toHaveLength(4);
    expect(save).toHaveBeenCalledOnce(); expect(app.waypoints).toHaveLength(1);
    expect(app.imageAssetService.getAssetCount()).toBe(1);
    for (let i = 0; i < 2; i++) {
      expect(await app.loadProject(await app.imageAssetService.exportZip(snapshot(app)))).toBe(true);
      expect(asset(app).name).toBe(name); expect(asset(app).base64).toBe(png);
      expect(app.waypoints[0].customImageAssetId).toBe('unicode-marker');
    }
  });
