/**
 * CROWD-08 part A — a crowd with no route exports, and its exported player
 * plays it as the editor does.
 *
 * Export MP4, WebM and HTML admit a project with no route whose crowds can be
 * drawn, by the same test as Play; with nothing to play they stay off, each
 * with the owner's reason. A video export of such a project runs its one
 * synchronous frame plan from 0 to the playback duration and draws the dots;
 * its HTML export's data plays in `PlayerApp` with the editor's duration and
 * the editor's dots. A lone waypoint still binds the crowd nodes anchored to
 * it, in the editor and the player alike, and when it moves (a nudge, a drag
 * and its rollback, the outline, the zoom clamp) what can play moves with it.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  HTML_AND_BACKGROUND_REASON, HTML_REASON, PLAY_OFF, PLAY_ON, VIDEO_REASON,
  blankProject, byId, drawCrowd, editor, exportState, playState, settled,
} from './helpers/noRouteScene.js';
import { loadBackgroundFile } from '../src/app/backgroundLoading.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { VideoExporter, createVideoFramePlan } from '../src/services/VideoExporter.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.getItem.mockImplementation(() => null);
});

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Give the project a background whose bytes it keeps, as an upload does (an HTML export carries it). */
async function withBackground(app) {
  const image = Object.assign(new Image(), { naturalWidth: 1600, naturalHeight: 900, width: 1600, height: 900 });
  vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: PNG, getImageElement: async () => image });
  expect(await loadBackgroundFile(app, new File(['x'], 'background.png', { type: 'image/png' }))).toBe(true);
}

/** What the renderer draws of the crowds at `ms` in `host`, read off the evaluator it calls. */
function dotsAt(host, ms) {
  const evaluate = vi.spyOn(host.swarmEngine, 'evaluate');
  try {
    host.animationEngine.seekToTime(ms);
    host.render();
    return evaluate.mock.results.flatMap(result => result.value)
      .map(({ x, y, emitterId, dotIndex }) => ({ x, y, emitterId, dotIndex }));
  } finally {
    evaluate.mockRestore();
  }
}

/** Run Export HTML and return the project data it embeds. */
async function exportedData(app) {
  let embedded = null;
  vi.spyOn(app.htmlExportService, 'estimateSize').mockResolvedValue({ formatted: '1 KB' });
  vi.spyOn(app.htmlExportService, 'exportHTML').mockImplementation(async ({ projectData }) => {
    embedded = projectData;
    return new Blob(['<html>'], { type: 'text/html' });
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await app.exportHTML();
  expect(download).toHaveBeenCalledTimes(1); // a file was produced
  return JSON.parse(JSON.stringify(embedded));
}

/** The exported data, played in the HTML player. */
async function playerOf(app, data) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const player = new PlayerApp(canvas);
  await player.load(data, app.background.image);
  return player;
}

const durations = host => ({
  B: host.animationEngine.state.baseDuration,
  F: host.animationEngine.state.duration,
  parts: host.animationEngine.sceneEndParts,
});

describe('the export items (§3.4, §5.6)', () => {
  test('a crowd-only project with a background: all three on, no reason; blank: the owner\'s reasons', async () => {
    const app = await editor(); // started: a background, no waypoint, no crowd
    expect(app.waypoints).toHaveLength(0);
    expect(app.background.image).not.toBeNull();
    expect(exportState()).toEqual({
      mp4: true, webm: true, html: true, video: VIDEO_REASON, htmlReason: HTML_REASON, lineHidden: false,
    });
    drawCrowd(app);
    await settled();
    expect(exportState()).toEqual({
      mp4: false, webm: false, html: false, video: '', htmlReason: '', lineHidden: true,
    });

    // The network edited so nothing can play, and back: the items follow the edit.
    const { graph } = app.selectedCrowd;
    const [path] = graph.getEdges();
    app.networkEditService.bindForInspection(app.selectedCrowd);
    app.networkEditService.deleteEdge(path);
    await settled();
    expect(exportState().mp4).toBe(true);
    app.undo();
    await settled();
    expect(exportState().mp4).toBe(false);

    // With no background as well (Clear All takes it): HTML says both.
    const cleared = await blankProject();
    expect(cleared.background.image).toBeNull();
    expect(exportState()).toEqual({
      mp4: true, webm: true, html: true, video: VIDEO_REASON, htmlReason: HTML_AND_BACKGROUND_REASON, lineHidden: false,
    });
  });

  test('a request by another route is refused with the same words', async () => {
    const app = await editor();
    const told = [];
    app.eventBus.on('ui:toast', toast => told.push(toast.message));
    await app.exportVideo({ format: 'mp4' });
    await app.exportHTML();
    expect(told).toEqual([VIDEO_REASON, HTML_REASON]);
  });
});

describe('a video export of a crowd with no route (§3.4, §9.9)', () => {
  test('its one frame plan runs from 0 to the playback duration, every frame rendered, the dots drawn mid-way', async () => {
    const app = await editor();
    const { layer } = drawCrowd(app);
    layer.emitters[0].update({ lifecycleMode: 'disappear', speed: 0.3 });
    app.eventBus.emit('crowd:param-changed', { journeys: false });
    await settled();
    const { F } = durations(app);
    expect(F).toBeGreaterThan(10000);

    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    const frames = [];
    let plan = null;
    app.videoExporter = {
      cancel() {},
      async export({ frameRate, duration, startBuffer, renderFrame }) {
        plan = createVideoFramePlan({ frameRate, duration, startBuffer });
        for (const sample of plan.samples()) {
          const evaluate = vi.spyOn(app.swarmEngine, 'evaluate');
          const render = vi.spyOn(app, 'render');
          await renderFrame(sample.progress);
          frames.push({
            ms: app.animationEngine.state.currentTime,
            rendered: render.mock.calls.length,
            dots: evaluate.mock.results.flatMap(result => result.value).length,
          });
          evaluate.mockRestore();
          render.mockRestore();
        }
        return new Blob(['video'], { type: 'video/mp4' });
      },
    };
    await app.exportVideo({ format: 'mp4' });

    expect(plan.duration ?? F).toBe(F);
    expect(frames.length).toBe([...plan.samples()].length);
    expect(frames[0].ms).toBe(0);
    expect(frames.at(-1).ms).toBe(F);
    expect(frames.every(frame => frame.rendered === 1)).toBe(true);
    expect(frames.some(frame => frame.ms > 0 && frame.ms < F && frame.dots > 0)).toBe(true);
    expect(frames.at(-1).dots).toBe(0); // Disappear: all gone at the end
    expect(VideoExporter.downloadBlob).toHaveBeenCalledTimes(1);
  });

  test('pressed at once after the edit that made it playable, before the 50 ms debounce, it exports the scene as it stands', async () => {
    const app = await blankProject();
    byId('add-crowd-btn').click();
    byId('network-edit-btn').click();
    app.networkEditService.placeNode({ x: 0.2, y: 0.5 });
    app.networkEditService.placeNode({ x: 0.8, y: 0.5 });
    app.networkEditService.exit();
    expect(app._sceneEndTimeout).toBeTruthy();
    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    let exported = null;
    app.videoExporter = {
      cancel() {},
      async export({ duration }) {
        exported = duration;
        return new Blob(['video']);
      },
    };
    await app.exportVideo({ format: 'mp4' });
    expect(exported).toBe(12000); // the default 10 s and a new project's 2 s hold
  });
});

describe('the HTML export plays in the player as in the editor (§3.4)', () => {
  test('a crowd-only project: a file, the editor\'s duration, the editor\'s dots at 0, mid-release and after the last finish', async () => {
    const app = await editor();
    await withBackground(app);
    const { layer } = drawCrowd(app);
    layer.emitters[0].update({ lifecycleMode: 'disappear', speed: 0.3, dotCount: 30 });
    app.eventBus.emit('crowd:param-changed', { journeys: false });
    await settled();
    const editorTimes = durations(app);
    const data = await exportedData(app);
    expect(data.waypoints).toEqual([]);
    expect(data.animationState.duration).toBe(editorTimes.B);

    const player = await playerOf(app, data);
    expect(durations(player)).toEqual(editorTimes);
    const lastFinish = editorTimes.parts.crowdsMs;
    for (const ms of [0, editorTimes.B * 0.3, editorTimes.B * 0.6, lastFinish + 1, editorTimes.F]) {
      expect(dotsAt(player, ms), `at ${ms}`).toEqual(dotsAt(app, ms));
    }
    expect(dotsAt(app, editorTimes.B * 0.6).length).toBeGreaterThan(0);
  });

  test('a node anchored to the one waypoint follows it there, in the player too; a missing anchor falls back alike', async () => {
    const app = await editor();
    await withBackground(app);
    app.eventBus.emit('waypoint:add', { imgX: 0.3, imgY: 0.7, isMajor: true });
    const waypoint = app.waypoints[0];
    const { layer, entry } = drawCrowd(app);
    layer.emitters[0].update({ lifecycleMode: 'collect', speed: 0.2, dotCount: 12 });
    // The Entry bound to the waypoint, its own stored place left elsewhere.
    entry.anchorWaypointId = waypoint.id;
    app.calculatePath();
    app.eventBus.emit('network:changed', { commit: true });
    await settled();
    expect(entry.position()).toEqual({ x: 0.3, y: 0.7 });
    expect({ x: entry.x, y: entry.y }).toEqual({ x: 0.2, y: 0.5 });

    const data = await exportedData(app);
    const player = await playerOf(app, data);
    const playerEntry = player.scene.getFlowLayers()[0].graph.getNode(entry.id);
    expect(playerEntry.position()).toEqual({ x: 0.3, y: 0.7 });
    for (const ms of [1000, 4000, 9000]) expect(dotsAt(player, ms), `at ${ms}`).toEqual(dotsAt(app, ms));

    // Bound to a waypoint that is not there: both fall back to the node's own place.
    const broken = JSON.parse(JSON.stringify(data));
    broken.scene.flowLayers[0].graph.nodes.find(node => node.id === entry.id).anchorWaypointId = 'gone';
    const fallback = await playerOf(app, broken);
    expect(fallback.scene.getFlowLayers()[0].graph.getNode(entry.id).position()).toEqual({ x: 0.2, y: 0.5 });
    entry.anchorWaypointId = 'gone';
    app.calculatePath();
    expect(entry.position()).toEqual({ x: 0.2, y: 0.5 });
    for (const ms of [1000, 4000]) expect(dotsAt(fallback, ms), `at ${ms}`).toEqual(dotsAt(app, ms));
  });
});

describe('a lone waypoint moves what can play with it (§10.3, §12.2)', () => {
  /**
   * One waypoint, and a Disappear crowd whose Entry is anchored to it and
   * whose Exit stands at (0.6, 0.5): with the waypoint on the Exit, every
   * journey has no length and nothing is drawn; off it, the dots walk.
   */
  async function anchoredCrowd(at) {
    const app = await editor();
    app.eventBus.emit('waypoint:add', { imgX: at.x, imgY: at.y, isMajor: true });
    const waypoint = app.waypoints[0];
    const { layer, entry, exit } = drawCrowd(app, { entry: { x: 0.2, y: 0.5 }, exit: { x: 0.6, y: 0.5 } });
    layer.graph.getEdges()[0].setDirection('one-way');
    layer.emitters[0].update({ lifecycleMode: 'disappear' });
    entry.anchorWaypointId = waypoint.id;
    app.calculatePath();
    app.eventBus.emit('network:changed', { commit: true });
    await settled();
    return { app, waypoint, layer, entry, exit };
  }

  test('a keyboard nudge off the Exit and back (undone): positive, then no length', async () => {
    const { app, waypoint } = await anchoredCrowd({ x: 0.6, y: 0.5 });
    expect(playState()).toEqual(PLAY_OFF);
    app.eventBus.emit('waypoint:selected', waypoint);
    app.eventBus.emit('waypoint:nudge', { waypoint, dxFraction: 0.05, dyFraction: 0 });
    // At once: the nudge's path rebuild resolves the anchor, and what can play with it.
    expect(playState()).toEqual(PLAY_ON);
    await new Promise(resolve => setTimeout(resolve, 450)); // the nudge's grouped history entry
    expect(playState()).toEqual(PLAY_ON);
    app.undo();
    await settled();
    expect(app.waypoints[0].imgX).toBe(0.6);
    expect(playState()).toEqual(PLAY_OFF);
  });

  test('a drag onto the Exit, and its rollback', async () => {
    const { app, waypoint } = await anchoredCrowd({ x: 0.3, y: 0.5 });
    expect(playState()).toEqual(PLAY_ON);
    app.eventBus.emit('waypoint:position-changed', { waypoint, imgX: 0.6, imgY: 0.5, isDragging: true });
    expect(playState()).toEqual(PLAY_OFF); // at once, as the drag frame rebuilds the path
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    app.eventBus.emit('waypoint:drag-cancelled', { positions: [{ waypoint, imgX: 0.3, imgY: 0.5 }] });
    await settled();
    expect(waypoint.imgX).toBe(0.3);
    expect(playState()).toEqual(PLAY_ON);
  });

  test('the scene outline\'s coordinates', async () => {
    const { app, waypoint } = await anchoredCrowd({ x: 0.3, y: 0.5 });
    app._handleSceneOutlineCommand({
      action: 'update-waypoint', waypointId: waypoint.id, x: '60', y: '50',
      name: waypoint.name ?? '', waitSeconds: String((waypoint.pauseTime ?? 0) / 1000),
      segmentSpeed: String(waypoint.segmentSpeed ?? 1),
    });
    await settled();
    expect(app.waypoints[0].imgX).toBeCloseTo(0.6, 12);
    expect(playState()).toEqual(PLAY_OFF);
  });

  test('the zoom clamp: an anchored waypoint off the image brought back to its edge, in play, video and player alike', async () => {
    const app = await editor();
    await withBackground(app);
    app.eventBus.emit('background:zoom-change', 50); // zoomed out: a waypoint may leave the image
    app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.5, isMajor: true });
    const waypoint = app.waypoints[0];
    waypoint.imgX = 1.3;
    const { layer, entry, exit } = drawCrowd(app, { entry: { x: 0.2, y: 0.5 }, exit: { x: 1, y: 0.5 } });
    layer.graph.getEdges()[0].setDirection('one-way');
    layer.emitters[0].update({ lifecycleMode: 'disappear', speed: 0.2, dotCount: 8 });
    entry.anchorWaypointId = waypoint.id;
    app.calculatePath();
    app.eventBus.emit('network:changed', { commit: true });
    await settled();
    expect(entry.position().x).toBe(1.3);
    expect(playState()).toEqual(PLAY_ON);

    // Back to 100%: the waypoint is clamped onto the Exit, and its anchored Entry with it.
    app.eventBus.emit('background:zoom-change', 100);
    await settled();
    expect(waypoint.imgX).toBe(1);
    expect(entry.position()).toEqual({ x: 1, y: 0.5 });
    expect(exit.position()).toEqual({ x: 1, y: 0.5 });
    expect(playState()).toEqual(PLAY_OFF);

    // The same anchored network, now playable again on a Collect crowd: play, a video frame and the player agree.
    layer.emitters[0].update({ lifecycleMode: 'collect' });
    exit.x = 0.4;
    app.eventBus.emit('network:changed', { commit: true });
    await settled();
    expect(playState()).toEqual(PLAY_ON);
    const instants = [2000, 6000];
    const played = instants.map(ms => dotsAt(app, ms));
    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    const filmed = [];
    app.videoExporter = {
      cancel() {},
      async export({ duration, renderFrame }) {
        for (const ms of instants) {
          const evaluate = vi.spyOn(app.swarmEngine, 'evaluate');
          await renderFrame(ms / duration);
          filmed.push(evaluate.mock.results.flatMap(result => result.value)
            .map(({ x, y, emitterId, dotIndex }) => ({ x, y, emitterId, dotIndex })));
          evaluate.mockRestore();
        }
        return new Blob(['video']);
      },
    };
    await app.exportVideo({ format: 'mp4' });
    expect(filmed).toEqual(played);
    const player = await playerOf(app, await exportedData(app));
    expect(instants.map(ms => dotsAt(player, ms))).toEqual(played);
    expect(played.flat().length).toBeGreaterThan(0);
    // The player resolves the Entry where the editor does: on the clamped waypoint.
    expect(player.scene.getFlowLayers()[0].graph.getNode(entry.id).position()).toEqual({ x: 1, y: 0.5 });
  });
});
