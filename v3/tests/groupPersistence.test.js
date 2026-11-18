import { afterEach, expect, test, vi } from 'vitest';
import { drawCrowd, settled } from './helpers/noRouteScene.js';
import { recoveryEnvironment, bootWithRecovery, closeApp, writeRecovery, decodeByHeader,
  releaseStatefulStorage } from './helpers/recoveryHarness.js';
import { clearProject } from '../src/app/projectReset.js';
import { setRecoveryImageStoreFactory } from '../src/services/RecoveryImageStore.js';
import { withBackground, withMarkerImage } from './helpers/traceProject.js';
import { Waypoint } from '../src/models/Waypoint.js';

const snapshot = app => app._buildProjectSnapshot({ includeAssets: false });
const formFor = (app, surface) => surface === 'card' ? document.getElementById('crowd-group-form')
  : [...document.querySelectorAll('form[data-outline-action="update-groups"]')]
    .find(form => form.dataset.emitterId === app.scene.getFlowLayers()[0].emitters[0].id);
const select = async app => {
  const layer = app.scene.getFlowLayers()[0];
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: layer.id, emitterId: layer.emitters[0].id });
  await settled();
};
afterEach(() => { setRecoveryImageStoreFactory(null); releaseStatefulStorage(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test.each(['card', 'outline'])('%s min/mid/max/off precision survives two real saved ZIPs and browser-recovery reloads with exact Unicode/image bytes', async surface => {
  decodeByHeader(); const environment = recoveryEnvironment(); let app = await bootWithRecovery(environment);
  clearProject(app); await settled(); const { layer, entry } = drawCrowd(app);
  layer.name = 'Tribune 漢字🙂'; entry.label = 'Market café 🙂'; layer.emitters[0].update({ lifecycleMode: 'collect' });
  app.waypoints = [Waypoint.createMajor(0.3, 0.4)]; app.waypointsById = new Map(app.waypoints.map(w => [w.id, w]));
  withMarkerImage(app); const asset = app.imageAssetService.getAsset('custom'); asset.name = '旗🙂.png';
  const imageBytes = asset.base64, background = await withBackground(app);
  for (const [groups, groupSize, percentage, groupWidth] of [[true, 1, '0', 0], [true, 4, '2', 0.02],
    [true, 5000, '20', 0.2], [false, 17, '12.345678901234567', 0.12345678901234567]]) {
    await select(app); const form = formFor(app, surface);
    form.elements.groups.checked = groups; form.elements.groupSize.value = String(groupSize); form.elements.groupWidth.value = percentage;
    for (const field of [form.elements.groups, form.elements.groupSize, form.elements.groupWidth]) {
      field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const bound = vi.spyOn(app.imageAssetService, 'assertArchiveFitsByBound');
    form.querySelector('[type="submit"]').click(); await settled();
    expect(bound).toHaveBeenCalledTimes(1);
    expect(bound.mock.results[0].value.projectJSON).toBe(app.imageAssetService.prepareArchive(snapshot(app), app._autosaveBackgroundCache.dataURL).projectJSON);
    bound.mockRestore();
    const wanted = snapshot(app).scene;
    expect(app.scene.getFlowLayers()[0].emitters[0]).toMatchObject({ groups, groupSize, groupWidth });
    for (let round = 0; round < 2; round++) {
      let zip; const download = vi.spyOn(app.imageAssetService, 'downloadZip').mockImplementation(blob => { zip = blob; });
      await app.saveProject(); expect(zip).toBeInstanceOf(Blob); expect(zip.size).toBeGreaterThan(1000); download.mockRestore();
      expect(await app.loadProject(zip)).toBe(true); expect(snapshot(app).scene).toEqual(wanted);
      expect(app.imageAssetService.getAsset('custom').base64).toBe(imageBytes);
      expect(app.imageAssetService.getAsset('custom').name).toBe('旗🙂.png');
      expect(app._autosaveBackgroundCache.dataURL).toBe(background);
    }
    app.autoSave(); await writeRecovery(app); await closeApp(app);
    app = await bootWithRecovery(environment); await settled();
    expect(snapshot(app).scene).toEqual(wanted);
    expect(app.imageAssetService.getAsset('custom').base64).toBe(imageBytes);
    expect(app.imageAssetService.getAsset('custom').name).toBe('旗🙂.png');
    expect(app._autosaveBackgroundCache.dataURL).toBe(background);
  }
  await closeApp(app);
}, 60000);
