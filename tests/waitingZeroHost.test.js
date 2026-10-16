import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { withBackground } from './helpers/traceProject.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { getFinishContexts } from '../src/app/finishContexts.js';
import { resolveGraphAnchors } from '../src/utils/routeAnchors.js';

afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

test('the actual zero-duration hosts define their initial G frame and retain visible video/HTML refusals', async () => {
  const app = await blankProject(), { layer, entry, exit } = drawCrowd(app);
  await withBackground(app);
  app.waypoints = [0, 1].map(i => Object.assign(Waypoint.createMajor(11, 11),
    { id: `zero-${i}`, imgX: 11, imgY: 11, pauseMode: 'none', beaconStyle: 'none' }));
  app.waypointsById = new Map(app.waypoints.map(w => [w.id, w]));
  entry.anchorWaypointId = 'zero-0'; exit.anchorWaypointId = 'zero-1';
  entry.area = { shape: 'rectangle', width: 0.01, height: 0.01, turn: 0 };
  layer.emitters[0].update({ seed: 0, dotCount: 1, waitAtStart: true, lifecycleMode: 'disappear',
    releaseStart: 0, releaseDuration: 0, speed: 1, speedVariance: 0, wobble: 1 });
  resolveGraphAnchors(app.scene, app.waypointsById);
  app.calculatePath(); app.updateAnimationDuration(); await settled(); app.refreshSceneEnd();
  expect(app.animationEngine.state.duration).toBe(0);
  expect(getFinishContexts(app).finishReleaseContext.durationMs).toBe(0);
  expect(app.canPlayScene()).toBe(true);
  const ctx = { durationMs: 0, imageAspect: 1, ...getFinishContexts(app) };
  expect(app.swarmEngine.evaluate(0, layer, ctx)).toMatchObject([{ x: 11, y: 11 }]);
  expect(app.swarmEngine.evaluate(Number.MIN_VALUE, layer, ctx)).toEqual([]);
  const player = new PlayerApp(document.createElement('canvas'));
  await player.load(app._buildProjectSnapshot({ includeAssets: false }), app.background.image);
  expect(player.animationEngine.state.duration).toBe(0);
  expect(player.swarmEngine.evaluate(0, player.scene.getFlowLayers()[0],
    { durationMs: 0, imageAspect: 1, ...getFinishContexts(player) })).toMatchObject([{ x: 11, y: 11 }]);
  const messages = [];
  app.eventBus.on('ui:toast', ({ message }) => messages.push(message));
  const video = vi.fn(); app.videoExporter = { export: video, cancel: vi.fn() };
  const html = vi.spyOn(app.htmlExportService, 'exportHTML');
  await app.exportVideo({ format: 'mp4' }); await app.exportHTML();
  expect(messages.filter(message => message === 'Nothing to export: the animation has no duration.')).toHaveLength(2);
  expect(video).not.toHaveBeenCalled(); expect(html).not.toHaveBeenCalled();
  // The exported entry starts the player loop after loading; load alone does not start transport.
  player.start();
  app.animationEngine.play(); player.animationEngine.play(); await settled();
  expect(app.animationEngine.isPlaying()).toBe(false); expect(player.animationEngine.isPlaying()).toBe(false);
  expect(app.animationEngine.animationFrameId).toBeNull(); expect(player.animationEngine.animationFrameId).toBeNull();
  player.animationEngine.destroy();
});
