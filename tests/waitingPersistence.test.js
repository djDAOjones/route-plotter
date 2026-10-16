import { afterEach, expect, test, vi } from 'vitest';
import { drawCrowd, settled } from './helpers/noRouteScene.js';
import { recoveryEnvironment, bootWithRecovery, closeApp, writeRecovery, decodeByHeader,
  releaseStatefulStorage } from './helpers/recoveryHarness.js';
import { clearProject } from '../src/app/projectReset.js';
import { setRecoveryImageStoreFactory } from '../src/services/RecoveryImageStore.js';
import { withBackground, withMarkerImage } from './helpers/traceProject.js';
import { Waypoint } from '../src/models/Waypoint.js';

const snapshot = app => app._buildProjectSnapshot({ includeAssets: false });
const currentForm = (surface, emitter) => surface === 'card' ? document.getElementById('crowd-wait-form')
  : [...document.querySelectorAll('form[data-outline-action="update-waiting"]')]
    .find(form => form.dataset.emitterId === emitter.id);
async function select(app) {
  const layer = app.scene.getFlowLayers()[0], emitter = layer.emitters[0];
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: layer.id, emitterId: emitter.id });
  await settled(); return emitter;
}
afterEach(() => { setRecoveryImageStoreFactory(null); releaseStatefulStorage(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test.each(['card', 'outline'])('%s on/off survives two saved ZIPs, Undo/Redo and real browser recovery with exact images', async surface => {
  decodeByHeader(); const environment = recoveryEnvironment(); let app = await bootWithRecovery(environment);
  clearProject(app); await settled(); const { layer, entry } = drawCrowd(app);
  entry.area = { shape: 'ellipse', width: 0.2, height: 0.2, turn: 17 };
  layer.name = 'Tribune 漢字🙂'; entry.label = 'Stand café 🙂'; layer.emitters[0].update({ lifecycleMode: 'collect' });
  app.waypoints = [Waypoint.createMajor(0.3, 0.4)]; app.waypointsById = new Map(app.waypoints.map(w => [w.id, w]));
  withMarkerImage(app); const asset = app.imageAssetService.getAsset('custom'); asset.name = '旗🙂.png';
  const bytes = asset.base64, background = await withBackground(app);
  for (const value of [true, false, true]) {
    const emitter = await select(app), before = emitter.waitAtStart;
    app._flushPendingUndo(); app.saveUndoState();
    const form = currentForm(surface, emitter); form.elements.waitAtStart.checked = value;
    form.elements.waitAtStart.dispatchEvent(new Event('input', { bubbles: true }));
    const bound = vi.spyOn(app.imageAssetService, 'assertArchiveFitsByBound');
    form.querySelector('[type="submit"]').click(); await settled();
    expect(emitter.waitAtStart).toBe(value); expect(bound).toHaveBeenCalledTimes(1);
    expect(bound.mock.results[0].value.projectJSON).toBe(app.imageAssetService.prepareArchive(
      snapshot(app), app._autosaveBackgroundCache.dataURL).projectJSON);
    bound.mockRestore();
    const wanted = snapshot(app).scene;
    app.undo(); await settled(); expect(app.scene.getFlowLayers()[0].emitters[0].waitAtStart).toBe(before);
    app.redo(); await settled(); expect(snapshot(app).scene).toEqual(wanted);
    for (let round = 0; round < 2; round++) {
      let zip; const download = vi.spyOn(app.imageAssetService, 'downloadZip').mockImplementation(blob => { zip = blob; });
      await app.saveProject(); expect(zip).toBeInstanceOf(Blob); expect(zip.size).toBeGreaterThan(1000); download.mockRestore();
      expect(await app.loadProject(zip)).toBe(true); expect(snapshot(app).scene).toEqual(wanted);
      expect(app.imageAssetService.getAsset('custom').base64).toBe(bytes);
      expect(app.imageAssetService.getAsset('custom').name).toBe('旗🙂.png');
      expect(app._autosaveBackgroundCache.dataURL).toBe(background);
    }
    app.autoSave(); await writeRecovery(app); await closeApp(app);
    app = await bootWithRecovery(environment); await settled();
    expect(snapshot(app).scene).toEqual(wanted); expect(app.imageAssetService.getAsset('custom').base64).toBe(bytes);
    expect(app.imageAssetService.getAsset('custom').name).toBe('旗🙂.png');
    expect(app._autosaveBackgroundCache.dataURL).toBe(background);
  }
  await closeApp(app);
}, 60000);
