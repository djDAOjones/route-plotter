import { afterEach, describe, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { getFinishContexts } from '../src/app/finishContexts.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { Emitter } from '../src/models/Emitter.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { VideoExporter } from '../src/services/VideoExporter.js';

afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });
const PNG = 'data:image/png;base64,'
  + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const bitmap = (width, height) => Object.assign(new Image(), {
  naturalWidth: width, naturalHeight: height, width, height,
});
async function setup(routed = false) {
  const app = await blankProject(), { layer, exit } = drawCrowd(app, { exit: { x: 0.4, y: 0.5 } });
  exit.area = { shape: 'rectangle', width: 0.2, height: 0.2, turn: 37 };
  app.renderReference = { width: 1000, height: 500 };
  layer.emitters[0].update({ dotCount: 2, seed: 7, speed: 0.1, releaseStart: 0.2, releaseDuration: 0,
    lifecycleMode: 'collect', speedVariance: 0, onsetVariance: 0, wobble: 0, dotSize: 1 });
  layer.emitters.push(new Emitter({ ...layer.emitters[0].toJSON(), id: 'second', speed: 0.2, releaseStart: 0.4 }));
  if (routed) {
    app.waypoints = [0.1, 0.5, 0.9].map((x, i) => Object.assign(Waypoint.createMajor(x, 0.5), {
      id: `w${i}`, pauseMode: i === 1 ? 'timed' : 'none', pauseTime: i === 1 ? 1000 : 0, beaconStyle: 'none',
    }));
    app.waypointsById = new Map(app.waypoints.map(w => [w.id, w]));
    app.animationEngine.setSpeed(100);
    app.animationEngine.setMode('constant-time');
    app.animationEngine.setDuration(12000);
    app.calculatePath();
  }
  app.eventBus.emit('network:changed', { commit: true });
  await settled();
  return { app, layer };
}
function read(host) {
  const layer = host.scene.getFlowLayers()[0], ctx = { ...getFinishContexts(host),
    durationMs: host.animationEngine.state.baseDuration, routeAnchors: host.getRouteArrivalMap() };
  const spy = vi.spyOn(host.swarmEngine, 'evaluate');
  const frames = [0, 2500, 5000, 9000, 11000].map(t => {
    spy.mockClear(); host.animationEngine.seekToTime(t); host.render();
    return spy.mock.results.flatMap(r => r.value);
  });
  spy.mockRestore();
  return { frames, schedules: host.swarmEngine.scheduleDots(layer, ctx),
    end: host.swarmEngine.crowdFinishMs(layer, ctx) };
}

describe('finish-area context across real hosts', () => {
  test.each(['success', 'cancel', 'failure'])('path-only video keeps context and restores: %s', async outcome => {
    const { app } = await setup(true);
    const image = bitmap(1600, 800);
    app.background.image = image; app.updateImageTransform(image);
    app.exportSettings.backgroundZoom = 175;
    const baseline = read(app), original = getFinishContexts(app);
    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    let during, rendered;
    app.videoExporter = { cancel() {}, async export({ renderFrame }) {
      during = getFinishContexts(app);
      expect(app.background.image).toBeNull();
      expect(during).toBe(original);
      await renderFrame(0.5);
      rendered = read(app);
      if (outcome === 'cancel') return null;
      if (outcome === 'failure') throw new Error('forced finishing-video failure');
      return new Blob(['video'], { type: 'video/mp4' });
    } };
    app.exportSettings.pathOnly = true;
    app.exportSettings.resolutionX = 1080; app.exportSettings.resolutionY = 1920;
    app.styles.graphicsScale = 2;
    if (outcome === 'failure') allowConsole(/forced finishing-video failure/);
    await app.exportVideo({ format: 'mp4' });
    expect(during).toBeDefined();
    expect(rendered).toEqual(baseline);
    expect(app.background.image).toBe(image);
    expect(app._finishExportContexts).toBeNull();
    expect(read(app)).toEqual(baseline);
  });
  test.each([false, true])('refits, Preview and imported players keep exact results (anchored=%s)', async anchored => {
    const { app, layer } = await setup(true);
    if (anchored) layer.emitters[0].releaseAnchor = { waypointId: 'w1', at: 'arrival' };
    const before = read(app), stable = getFinishContexts(app).finishReleaseContext;
    expect(stable.durationMs).toBeCloseTo(9000, 8);
    for (const duration of [3000, 11000, 12000]) {
      app.animationEngine.setDuration(duration);
      app.refreshSceneEnd(); await settled();
      expect(read(app)).toEqual(before);
    }
    for (const [width, height] of [[200, 400], [1200, 600], [1080, 1920]]) {
      app.coordinateTransform.setCanvasDimensions(width, height);
      app.displayWidth = width; app.displayHeight = height;
      app.calculatePath(); await settled();
      expect(read(app)).toEqual(before);
      expect(getFinishContexts(app).finishReleaseContext).toBe(stable);
    }
    app._setPreviewMode(true); await settled();
    expect(read(app)).toEqual(before);
    const snapshot = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
    snapshot.animationState = { ...snapshot.animationState, mode: 'constant-time', speed: 101, duration: 12000 };
    for (const [w, h, scale] of [[1920, 1080, 1], [1080, 1920, 2]]) {
      snapshot.exportSettings = { ...snapshot.exportSettings, resolutionX: w, resolutionY: h };
      snapshot.styles.graphicsScale = scale;
      const player = new PlayerApp(document.createElement('canvas'));
      await player.load(snapshot, null);
      expect(read(player)).toEqual(before);
      player.animationEngine.destroy();
    }
  });
  test('C-bearing missing references use timingReference then fixed1920x1080 in editor and player', async () => {
    const { app } = await setup();
    const data = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
    delete data.renderReference; delete data.timingReference;
    data.exportSettings.resolutionX = 500; data.exportSettings.resolutionY = 800;
    expect(await loadCurrentSnapshot(app, data)).toBe(true); await settled();
    expect(app.renderReference).toEqual({ width: 1920, height: 1080 });
    const player = new PlayerApp(document.createElement('canvas'));
    await player.load(data, null);
    expect(player.renderReference).toEqual(app.renderReference);
    expect(read(player)).toEqual(read(app));
    player.animationEngine.destroy();
    data.timingReference = { width: 800, height: 600 };
    expect(await loadCurrentSnapshot(app, data)).toBe(true); await settled();
    expect(app.renderReference).toEqual(data.timingReference);
  });
  test('changed zoom/reference installs coherently; late failure restores the previous contexts', async () => {
    const { app } = await setup(true);
    app.background.image = bitmap(1600, 800); app.updateImageTransform(app.background.image);
    const before = read(app), data = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
    data.renderReference = { width: 900, height: 1600 }; data.exportSettings.backgroundZoom = 225;
    vi.spyOn(ImageAsset, 'decodeDataURL').mockResolvedValue(bitmap(800, 400));
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({ projectData: data,
      imageAssets: [], backgroundBase64: PNG });
    let failedContext;
    vi.spyOn(app, 'pruneImageAssets').mockImplementationOnce(() => {
      failedContext = getFinishContexts(app); throw new Error('late C load failure');
    });
    allowConsole(/Failed to load project/);
    expect(await app.loadProject(new File([''], 'changed.zip'))).toBe(false);
    expect(failedContext.finishPackingContext).toMatchObject({ aspect: 2, height: 1012.5 });
    await settled();
    expect(read(app)).toEqual(before);
    expect(app.exportSettings.backgroundZoom).toBe(100);
  });
  test('zero-length routed clock still renders and waits for a positive finishing walk', async () => {
    const { app, layer } = await setup(true);
    app.waypoints.forEach(w => { w.imgX = 0.5; w.imgY = 0.5; w.pauseMode = 'none'; });
    const [entry, exit] = layer.graph.getNodes(); entry.x = exit.x; entry.y = exit.y;
    app.motionSettings.pathVisibility = 'instantaneous'; app.motionSettings.pathTrail = 0.5;
    app.calculatePath(); app.updateAnimationDuration(); await settled();
    expect(getFinishContexts(app).finishReleaseContext.durationMs).toBe(0);
    expect(app.animationEngine.state.baseDuration).toBe(0);
    expect(app.animationEngine.sceneEndParts.crowdsMs).toBeGreaterThan(0);
    const state = read(app);
    expect(state.frames[0]).toHaveLength(4);
    expect(state.schedules.every(row => row.onsetMs === 0)).toBe(true);
  });
});
