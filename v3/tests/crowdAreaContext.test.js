import { afterEach, describe, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import { loadBackgroundFile } from '../src/app/backgroundLoading.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { PlayerApp } from '../src/player/PlayerApp.js';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.getItem.mockImplementation(() => null);
});

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const bitmap = (width, height) => Object.assign(new Image(), {
  naturalWidth: width, naturalHeight: height, width, height,
});

async function scene() {
  const app = await blankProject();
  const { layer, entry } = drawCrowd(app);
  entry.area = { shape: 'rectangle', width: 0.6, height: 0.2, turn: 73 };
  layer.emitters[0].update({ dotCount: 1, seed: 7, speed: 0.02, releaseStart: 0, releaseDuration: 0,
    lifecycleMode: 'collect', speedVariance: 0, onsetVariance: 0, wobble: 0 });
  app.styles.holdAtEndMs = 500;
  app.eventBus.emit('network:changed', { commit: true });
  await settled();
  return { app, layer };
}

function expected(app, layer, aspect) {
  const cold = new SwarmEngine();
  const context = { durationMs: app.animationEngine.state.baseDuration, imageAspect: aspect };
  return { finish: cold.crowdFinishMs(layer, context), dots: cold.evaluate(0, layer, context) };
}

function rendered(host) {
  const spy = vi.spyOn(host.swarmEngine, 'evaluate');
  host.animationEngine.seekToTime(0);
  host.render();
  const dots = spy.mock.results.flatMap(result => result.value);
  spy.mockRestore();
  return dots;
}

describe('start-area image context in the real editor and player', () => {
  test('image replacement refreshes crowd-only end and renderer immediately; resize does no extra timing work', async () => {
    const { app, layer } = await scene();
    const upload = vi.spyOn(app, 'loadImageFileAsset');
    const refresh = vi.spyOn(app, 'refreshSceneEnd');
    for (const [width, height] of [[1600, 800], [800, 1600]]) {
      const image = bitmap(width, height);
      upload.mockResolvedValueOnce({ base64: PNG, getImageElement: async () => image });
      expect(await loadBackgroundFile(app, new File(['x'], 'map.png', { type: 'image/png' }))).toBe(true);
      const want = expected(app, layer, width / height);
      expect(app.animationEngine.state.duration).toBe(want.finish + 500);
      expect(rendered(app)).toEqual(want.dots);
      expect(app.canPlayScene()).toBe(true);
      const count = refresh.mock.calls.length;
      app.coordinateTransform.setCanvasDimensions(height, width);
      app.updateImageTransform(image);
      expect(refresh).toHaveBeenCalledTimes(count);
      expect(rendered(app)).toEqual(want.dots);
    }
    app.background.image = null;
    app.updateImageTransform(null);
    expect(app.animationEngine.state.duration).toBe(expected(app, layer, 1).finish + 500);
    expect(rendered(app)).toEqual(expected(app, layer, 1).dots);
  });

  test('admission receives the intrinsic aspect, with no canvas or render-reference substitution', async () => {
    const { app } = await scene();
    app.updateImageTransform(bitmap(3000, 1000));
    app.renderReference = { width: 100, height: 900 };
    const spy = vi.spyOn(app.swarmEngine, 'canRelease');
    expect(app.canPlayScene()).toBe(true);
    expect(spy).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ imageAspect: 3 }));
  });

  test('recovery and the exported player agree across output sizes and Graphics scale', async () => {
    const { app, layer } = await scene();
    const image = bitmap(1600, 800);
    app.background.image = image;
    app.updateImageTransform(image);
    const data = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
    const want = expected(app, layer, 2);
    for (const [width, height, scale] of [[1920, 1080, 1], [1080, 1920, 2]]) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      data.exportSettings = { ...data.exportSettings, resolutionX: width, resolutionY: height };
      data.styles.graphicsScale = scale;
      const player = new PlayerApp(canvas);
      await player.load(data, image);
      expect(player.animationEngine.state.duration).toBe(want.finish + 500);
      expect(rendered(player)).toEqual(want.dots);
      player.animationEngine.destroy();
    }
    // The real recovery path decodes the embedded background before installing the scene.
    vi.spyOn(ImageAsset, 'decodeDataURL').mockResolvedValue(image);
    data.backgroundImage = PNG;
    expect(await loadCurrentSnapshot(app, data)).toBe(true);
    await settled();
    expect(app.animationEngine.state.duration).toBe(want.finish + 500);
    expect(rendered(app)).toEqual(want.dots);
  });

  test('a late failed load restores image context, duration, admission and dots after the new aspect was installed', async () => {
    const { app, layer } = await scene();
    app.background.image = bitmap(1600, 800);
    app.updateImageTransform(app.background.image);
    const want = expected(app, layer, 2);
    const snapshot = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
    vi.spyOn(ImageAsset, 'decodeDataURL').mockResolvedValue(bitmap(800, 1600));
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: snapshot, imageAssets: [], backgroundBase64: PNG,
    });
    let failedAtAspect;
    vi.spyOn(app, 'pruneImageAssets').mockImplementationOnce(() => {
      failedAtAspect = app.coordinateTransform.imageWidth / app.coordinateTransform.imageHeight;
      throw new Error('late load failure after image installation');
    });
    allowConsole(/Failed to load project/);
    expect(await app.loadProject(new File([''], 'different-image.zip'))).toBe(false);
    expect(failedAtAspect).toBe(0.5);
    await settled();
    expect(app.coordinateTransform.imageWidth / app.coordinateTransform.imageHeight).toBe(2);
    expect(app.animationEngine.state.duration).toBe(want.finish + 500);
    expect(app.canPlayScene()).toBe(true);
    expect(rendered(app)).toEqual(want.dots);
  });
});
