import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import { getFinishContexts, finishRenderReference } from '../src/app/finishContexts.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { areaImageAspect } from '../src/utils/crowdArea.js';
import { VideoExporter } from '../src/services/VideoExporter.js';

const bitmap = (width, height) => Object.assign(new Image(), { naturalWidth: width, naturalHeight: height, width, height });
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });
async function setup() {
  const app = await blankProject(), { layer } = drawCrowd(app);
  app.renderReference = { width: 1000, height: 500 };
  layer.emitters[0].update({ groups: true, groupSize: 3, groupWidth: 0.03, dotCount: 7, lifecycleMode: 'collect',
    seed: 7, releaseStart: 0.25, releaseDuration: 0.5 });
  app.waypoints = [0.1, 0.5, 0.9].map((x, i) => Object.assign(Waypoint.createMajor(x, 0.5), { id: `w${i}`, beaconStyle: 'none' }));
  app.waypointsById = new Map(app.waypoints.map(w => [w.id, w]));
  app.animationEngine.setSpeed(100); app.animationEngine.setMode('constant-time'); app.animationEngine.setDuration(12000);
  app.calculatePath(); await settled();
  return { app, layer };
}
const read = app => {
  const layer = app.scene.getFlowLayers()[0], ctx = { durationMs: app.animationEngine.state.baseDuration,
    routeAnchors: app.getRouteArrivalMap(), imageAspect: areaImageAspect(app.coordinateTransform), ...getFinishContexts(app) };
  return { frames: [0, 2500, 5000, 10000, 15000].map(t => app.swarmEngine.evaluate(t, layer, ctx)),
    rows: app.swarmEngine.scheduleDots(layer, ctx), end: app.swarmEngine.crowdFinishMs(layer, ctx) };
};

test('active groups without Exit areas share frozen reference contexts across editor, player and dimensions', async () => {
  const { app } = await setup(), before = read(app), reference = getFinishContexts(app);
  expect(reference.finishReleaseContext).toBeDefined();
  expect(reference.finishReleaseContext.durationMs).not.toBe(12000);
  for (const [width, height] of [[200, 400], [1200, 600], [1080, 1920]]) {
    app.coordinateTransform.setCanvasDimensions(width, height); app.displayWidth = width; app.displayHeight = height;
    app.styles.graphicsScale = 2; app.calculatePath(); await settled();
    expect(read(app)).toEqual(before);
  }
  const snapshot = app._buildProjectSnapshot({ includeAssets: false });
  const player = new PlayerApp(document.createElement('canvas'));
  await player.load(snapshot, null);
  expect(read(player)).toEqual(before);
  player.animationEngine.destroy();
  expect(await loadCurrentSnapshot(app, snapshot)).toBe(true);
  expect(read(app)).toEqual(before);
});

test('path-only video freezes original group contexts while background is suppressed', async () => {
  const { app } = await setup();
  const image = bitmap(1600, 800); app.background.image = image; app.updateImageTransform(image);
  app.exportSettings.backgroundZoom = 175;
  const before = read(app), original = getFinishContexts(app);
  expect(original.finishReleaseContext).toBeDefined();
  vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
  app.videoExporter = { async export({ renderFrame }) {
    expect(app.background).toMatchObject({ image, hidden: true }); expect(getFinishContexts(app)).toBe(original);
    // The kept image changes no input (UI-08); a zoom meanwhile would, and the frozen contexts stand.
    const zoom = app.exportSettings.backgroundZoom; app.exportSettings.backgroundZoom = zoom * 2;
    expect(getFinishContexts(app)).toBe(original); app.exportSettings.backgroundZoom = zoom;
    await renderFrame(0.5); expect(read(app)).toEqual(before);
    return new Blob(['video'], { type: 'video/mp4' });
  } };
  app.background.hidden = true; app.exportSettings.resolutionX = 1080; app.exportSettings.resolutionY = 1920;
  await app.exportVideo({ format: 'mp4' });
  expect(app.background.image).toBe(image); expect(app._finishExportContexts).toBeNull(); expect(read(app)).toEqual(before);
});

test('migration uses the same fallback only for effective groups with a guide; ordinary/off/size1 remain old', async () => {
  const { app, layer } = await setup();
  expect(finishRenderReference(app.scene, null, null)).toEqual({ width: 1920, height: 1080 });
  for (const partial of [{ groups: false }, { groups: true, groupSize: 1 },
    { groups: true, groupSize: 4, lifecycleMode: 'respawn' }]) {
    layer.emitters[0].update(partial);
    expect(finishRenderReference(app.scene, null, null)).toBeNull();
    expect(getFinishContexts(app)).toEqual({});
  }
});


test('B starts on a nonsquare image retain the group clock in both hosts, resized output and path-only export', async () => {
  const { app, layer } = await setup();
  layer.graph.getNodes()[0].area = { shape: 'ellipse', width: 0.3, height: 0.2, turn: 37 };
  const image = bitmap(1600, 800); app.background.image = image; app.updateImageTransform(image);
  app.calculatePath(); await settled();
  const before = read(app), data = app._buildProjectSnapshot({ includeAssets: false });
  for (const [width, height] of [[1920, 1080], [1080, 1920]]) {
    app.coordinateTransform.setCanvasDimensions(width, height); app.styles.graphicsScale = 2;
    app.calculatePath(); await settled(); expect(read(app)).toEqual(before);
    const player = new PlayerApp(document.createElement('canvas'));
    data.exportSettings.resolutionX = width; data.exportSettings.resolutionY = height;
    await player.load(data, image); expect(read(player)).toEqual(before);
    player.animationEngine.destroy();
  }
  const frozen = getFinishContexts(app);
  vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
  app.videoExporter = { async export({ renderFrame }) {
    expect(app.background).toMatchObject({ image, hidden: true }); expect(getFinishContexts(app)).toBe(frozen);
    // The kept image changes no input (UI-08); a zoom meanwhile would, and the frozen contexts stand.
    const zoom = app.exportSettings.backgroundZoom; app.exportSettings.backgroundZoom = zoom * 2;
    expect(getFinishContexts(app)).toBe(frozen); app.exportSettings.backgroundZoom = zoom;
    await renderFrame(0.4); expect(read(app)).toEqual(before);
    return new Blob(['video'], { type: 'video/mp4' });
  } };
  app.background.hidden = true;
  await app.exportVideo({ format: 'mp4' }); expect(read(app)).toEqual(before);
});

test('a late failed open restores active group reference contexts even without a C area', async () => {
  const { app } = await setup();
  app.background.image = bitmap(1600, 800); app.updateImageTransform(app.background.image);
  const before = read(app), data = app._buildProjectSnapshot({ includeAssets: false });
  data.renderReference = { width: 900, height: 1600 }; data.exportSettings.backgroundZoom = 225;
  vi.spyOn(ImageAsset, 'decodeDataURL').mockResolvedValue(bitmap(800, 400));
  vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({ projectData: data,
    imageAssets: [], backgroundBase64: 'data:image/png;base64,iVBORw0KGgo=' });
  let failedContext;
  vi.spyOn(app, 'pruneImageAssets').mockImplementationOnce(() => {
    failedContext = getFinishContexts(app); throw new Error('late group load failure');
  });
  allowConsole(/Failed to load project/);
  expect(await app.loadProject(new File([''], 'changed.zip'))).toBe(false);
  expect(failedContext.finishPackingContext).toMatchObject({ aspect: 2, height: 1012.5 });
  await settled(); expect(read(app)).toEqual(before);
  expect(app.exportSettings.backgroundZoom).toBe(100);
});
