/**
 * CROWD-05 in the shipped editor, its video export and the HTML player: the
 * animation runs until every concluding animation has finished.
 *
 * The base timeline, B, is the duration the route composes; the playback
 * duration, F, waits after it for a crowd whose dots finish. These pin, in
 * the booted app: a crowd that finishes after the route has its last dot
 * drawn a frame before F and gone (Disappear) or parked (Collect) at F, on
 * play, on a seek, in a video export's samples and in the player, with one F;
 * releases keep their absolute instants; a constant-time route plays over B;
 * B and F survive saving, reopening, autosave and undo without drift; and the
 * Duration readout says what makes up the end.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { clearProject } from '../src/app/projectReset.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { VideoExporter, createVideoFramePlan } from '../src/services/VideoExporter.js';
import { Scene } from '../src/models/Scene.js';
import { computeSceneEnd, describeSceneEnd } from '../src/utils/sceneEnd.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { TextLabelService } from '../src/services/TextLabelService.js';
import { AreaHighlightRenderer } from '../src/services/AreaHighlightRenderer.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Past the 50 ms the app waits before it measures timing again. */
const settled = () => new Promise(resolve => setTimeout(resolve, 120));
/** One frame of a 25 fps export. */
const FRAME_MS = 40;

/** A crowd on the route too slow to finish before the route does. */
const SLOW_CROWD = { seed: 21, speed: 0.05, speedVariance: 0.3, releaseDuration: 0.5, onsetVariance: 0.4 };

/** The shipped editor, a two-click route and a crowd on it with `lifecycleMode`. */
async function editorWithCrowd(lifecycleMode = 'disappear') {
  const app = await bootApp();
  await app.ready;
  document.getElementById('splash-close').click();
  await settled();
  app.eventBus.emit('waypoint:add', { imgX: 0.1, imgY: 0.5, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.5, isMajor: true });
  app.addCrowd();
  const layer = app.selectedCrowd;
  layer.emitters[0].update({ ...SLOW_CROWD, lifecycleMode });
  app.eventBus.emit('crowd:param-changed');
  await settled();
  return { app, layer };
}

/** What the renderer draws of the crowds at `ms`, read off the evaluator it calls. */
function dotsDrawnAt(host, ms) {
  const evaluate = vi.spyOn(host.swarmEngine, 'evaluate');
  try {
    host.animationEngine.seekToTime(ms);
    host.render();
    return {
      dots: evaluate.mock.results.flatMap(result => result.value),
      durations: evaluate.mock.calls.map(call => call[2].durationMs),
    };
  } finally {
    evaluate.mockRestore();
  }
}

const durations = app => ({
  B: app.animationEngine.state.baseDuration,
  F: app.animationEngine.state.duration,
  parts: app.animationEngine.sceneEndParts,
});

describe('a crowd that finishes after the route', () => {
  test('the timeline waits for it: F is its last finish, B the route\'s own, and the readout says so', async () => {
    const { app } = await editorWithCrowd('respawn');
    const routeOnly = durations(app);
    expect(routeOnly.F).toBe(routeOnly.B); // a respawning crowd never concludes

    app.selectedCrowd.emitters[0].update({ lifecycleMode: 'disappear' });
    app.eventBus.emit('crowd:param-changed', { journeys: false }); // as the select does
    await settled();
    const { B, F, parts } = durations(app);

    expect(B).toBe(routeOnly.B);
    expect(F).toBeGreaterThan(B + 1000);
    expect(parts).toEqual({ routeMs: B, crowdsMs: F, beaconsMs: 0 });
    expect(F).toBe(app.swarmEngine.crowdFinishMs(app.selectedCrowd, {
      durationMs: B, routePathPoints: app.pathPoints, routeAnchors: app.getRouteArrivalMap(),
    }));

    const breakdown = document.getElementById('pacing-duration-breakdown');
    expect(document.getElementById('animation-speed-right').getAttribute('aria-describedby').split(' '))
      .toContain('pacing-duration-breakdown');
    expect(breakdown.hidden).toBe(false);
    expect(breakdown.textContent).toBe(describeSceneEnd(parts, F));
    expect(breakdown.textContent).toMatch(/^Ends at \d+\.\d s — route \d+\.\d s, crowds finish \+\d+\.\d s$/);
    expect(document.getElementById('animation-speed-value-right').textContent).toBe(`${Math.round(F / 100) / 10}s`);

    // Back to a crowd that never concludes: the line goes, emptied as well as hidden.
    app.selectedCrowd.emitters[0].update({ lifecycleMode: 'loop' });
    app.eventBus.emit('crowd:param-changed', { journeys: false });
    await settled();
    expect(durations(app).F).toBe(B);
    expect(breakdown.hidden).toBe(true);
    expect(breakdown.textContent).toBe('');
  });

  test('releases keep their absolute instants: the renderer measures them against B', async () => {
    const { app, layer } = await editorWithCrowd('respawn');
    const before = durations(app);
    const onsets = app.swarmEngine.scheduleDots(layer, {
      durationMs: before.F, routePathPoints: app.pathPoints, routeAnchors: app.getRouteArrivalMap(),
    }).map(dot => dot.onsetFraction * before.F);
    const first = Math.min(...onsets);

    layer.emitters[0].update({ lifecycleMode: 'disappear' });
    app.eventBus.emit('crowd:param-changed', { journeys: false });
    await settled();
    const after = durations(app);
    expect(after.F).toBeGreaterThan(before.F);

    const atFirst = dotsDrawnAt(app, first);
    expect(atFirst.durations).toEqual([before.F]);
    expect(atFirst.dots.length).toBeGreaterThan(0);
    expect(dotsDrawnAt(app, first - 1).dots).toHaveLength(0);
    expect(app.swarmEngine.scheduleDots(layer, {
      durationMs: after.B, routePathPoints: app.pathPoints, routeAnchors: app.getRouteArrivalMap(),
    }).map(dot => dot.onsetFraction * after.B)).toEqual(onsets);
  });

  test.each(['disappear', 'collect'])(
    '%s: its last dot is drawn a frame before F, and finished at F and after, on a seek',
    async (mode) => {
      const { app } = await editorWithCrowd(mode);
      const { B, F } = durations(app);
      const end = app.pathPoints.at(-1);
      const atEnd = dot => dot.x === end.x && dot.y === end.y;

      const before = dotsDrawnAt(app, F - FRAME_MS).dots;
      expect(before.some(dot => !atEnd(dot))).toBe(true);
      for (const ms of [F, F + 1000]) {
        const { dots } = dotsDrawnAt(app, ms);
        expect(app.animationEngine.state.currentTime).toBe(F);
        if (mode === 'disappear') expect(dots).toEqual([]);
        else expect(dots.length > 0 && dots.every(atEnd)).toBe(true);
      }
      // The route itself ended at B and holds there.
      app.animationEngine.seekToTime(B);
      expect(app.animationEngine.state.pathProgress).toBe(1);
    });

  test('on play: the transport runs to F, not B, and the last frame has no dot left', async () => {
    const { app } = await editorWithCrowd('disappear');
    const { B, F } = durations(app);
    const engine = app.animationEngine;
    const completed = vi.fn();
    app.eventBus.on('animation:complete', completed);

    engine.seekToTime(B - FRAME_MS);
    app.play();
    engine.updateAnimation(FRAME_MS * 2, 0); // past B: still playing
    expect(engine.isPlaying()).toBe(true);
    expect(completed).not.toHaveBeenCalled();

    engine.seekToTime(F - 2 * FRAME_MS);
    engine.updateAnimation(FRAME_MS, 0);
    app.render();
    expect(dotsDrawnAt(app, engine.state.currentTime).dots.length).toBeGreaterThan(0);
    engine.updateAnimation(FRAME_MS * 2, 0);
    expect(engine.state.currentTime).toBe(F);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(dotsDrawnAt(app, engine.state.currentTime).dots).toEqual([]);
  });

  test('a video export samples to F: its last frame has no dot left, the one before still has one', async () => {
    const { app } = await editorWithCrowd('disappear');
    app._setPreviewMode(true);
    app.invalidateAnimationTiming();
    const { F } = durations(app);
    app._setPreviewMode(false);
    app.invalidateAnimationTiming();

    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    vi.stubGlobal('alert', vi.fn());
    const sampled = [];
    app.videoExporter = {
      cancel() {},
      async export({ frameRate, duration, startBuffer, renderFrame }) {
        const samples = [...createVideoFramePlan({ frameRate, duration, startBuffer }).samples()];
        for (const sample of samples.slice(-2)) {
          const evaluate = vi.spyOn(app.swarmEngine, 'evaluate');
          await renderFrame(sample.progress);
          sampled.push({
            duration, ms: app.animationEngine.state.currentTime,
            dots: evaluate.mock.results.flatMap(result => result.value).length,
          });
          evaluate.mockRestore();
        }
        return new Blob(['video'], { type: 'video/mp4' });
      },
    };
    await app.exportVideo();

    expect(sampled).toHaveLength(2);
    expect(sampled.every(sample => sample.duration === F)).toBe(true);
    expect(sampled[0].ms).toBeLessThan(F);
    expect(sampled[0].dots).toBeGreaterThan(0);
    expect(sampled[1]).toMatchObject({ ms: F, dots: 0 });
  });

  test('the HTML player has the same B, F and parts, and ends its dots at F', async () => {
    const { app } = await editorWithCrowd('disappear');
    app._setPreviewMode(true);
    app.invalidateAnimationTiming();
    const editor = durations(app);
    const snapshot = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
    expect(snapshot.animationState.duration).toBe(editor.B);

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const player = new PlayerApp(canvas);
    await player.load(snapshot, app.background.image);
    expect(durations(player)).toEqual(editor);

    expect(dotsDrawnAt(player, editor.F - FRAME_MS).dots.length).toBeGreaterThan(0);
    expect(dotsDrawnAt(player, editor.F).dots).toEqual([]);

    player.animationEngine.seekToProgress(0.6);
    player.resetPlayback();
    expect(durations(player)).toEqual(editor);
  });
});

/**
 * A project opened with a crowd that finishes after its route: by default a
 * constant-time route the author timed at 12 s, never rebuilt, so it has no
 * path clock. `extras` adds a middle waypoint, and on every waypoint a label
 * that fades, a camera zoom eased in at once and a fading area.
 */
async function openedProject({ mode = 'constant-time', extras = false } = {}) {
  const app = await bootApp();
  await app.ready;
  const scene = new Scene();
  scene.addFlowLayer({ name: 'Crowd 1', guideType: 'route' })
    .addEmitter({ ...SLOW_CROWD, dotCount: 30, lifecycleMode: 'disappear' });
  const stops = extras ? [[0.1, 0.5], [0.5, 0.3], [0.9, 0.5]] : [[0.1, 0.5], [0.9, 0.5]];
  const waypoints = stops.map(([imgX, imgY], index) => ({
    id: `stop-${index}`, imgX, imgY, isMajor: true, pauseMode: 'none', pauseTime: 0,
    ...(extras ? {
      label: `Stop ${index + 1}`, labelMode: 'fade-up-down',
      camera: { zoom: [1, 2.5, 1.5][index], zoomMode: 'immediate' },
      areaHighlight: { enabled: true, shape: 'circle', centerX: imgX, centerY: imgY, fadeInMs: 800, fadeOutMs: 800 },
    } : {}),
  }));
  expect(await loadSnapshot(app, {
    coordVersion: 9,
    waypoints,
    scene: scene.toJSON(),
    animationState: { mode, speed: 200, duration: 12000 },
  })).toBe(true);
  await settled();
  return app;
}

describe('a constant-time route the author timed', () => {
  const constantTimeProject = () => openedProject();

  test('plays its route over B, holding through what the scene waits for; a seek finds the same instants', async () => {
    const app = await constantTimeProject();
    const engine = app.animationEngine;
    const { B, F } = durations(app);
    expect(app._timingDerived).toBe(false);
    expect(engine.pathDuration).toBe(0);
    expect(B).toBe(12000);
    expect(F).toBeGreaterThan(B);

    for (const [ms, progress] of [[3000, 0.25], [6000, 0.5], [12000, 1], [(B + F) / 2, 1], [F, 1]]) {
      engine.seekToTime(ms);
      expect(engine.state.pathProgress, `${ms} ms`).toBeCloseTo(progress, 12);
    }
    engine.seekToPathProgress(0.5);
    expect(engine.state.currentTime).toBeCloseTo(6000, 9);

    // Measured again, and after a crowd edit, the author's B holds.
    app.refreshSceneEnd();
    app.refreshSceneEnd();
    app.scene.getFlowLayers()[0].emitters[0].update({ speed: 0.03 });
    app.eventBus.emit('crowd:param-changed');
    await settled();
    expect(durations(app).B).toBe(12000);
    expect(durations(app).F).toBeGreaterThan(F);
    engine.seekToTime(6000);
    expect(engine.state.pathProgress).toBeCloseTo(0.5, 12);
    expect(app._buildProjectSnapshot().animationState.duration).toBe(12000);
  });
});

describe('what is timed as a fraction of the timeline measures against B', () => {
  test.each([
    ['a route with a path clock', 'constant-speed'],
    ['a constant-time route with none', 'constant-time'],
  ])('%s: camera transitions, label fades, area fades and reveal ranges read B, never F', async (name, mode) => {
    const app = await openedProject({ mode, extras: true });
    // Preview, as playback draws it. Set rather than toggled: toggling
    // rebuilds the timing, which would give the constant-time route a path clock.
    app.previewMode = true;
    const engine = app.animationEngine;
    const { B, F } = durations(app);
    expect(F).toBeGreaterThan(B);
    expect(engine.pathDuration > 0).toBe(mode === 'constant-speed');
    const pathClock = engine.pathDuration || B;
    const reads = {
      camera: vi.spyOn(app.cameraService, 'calculateCameraState'),
      label: vi.spyOn(TextLabelService, 'getTextVisibility'),
      area: vi.spyOn(AreaHighlightRenderer, '_getVisibilityOpacity'),
      path: vi.spyOn(app.motionVisibilityService, 'getPathVisibleRange'),
      waypoint: vi.spyOn(app.motionVisibilityService, 'getWaypointVisibility'),
    };

    for (const fraction of [0.2, 0.45, 0.7, 0.95]) {
      engine.seekToTime(fraction * B);
      app.render();
    }

    for (const spy of Object.values(reads)) expect(spy).toHaveBeenCalled();
    expect(new Set(reads.camera.mock.calls.map(([params]) => params.animationDuration))).toEqual(new Set([B]));
    expect(new Set(reads.label.mock.calls.map(([params]) => params.animationDuration))).toEqual(new Set([B]));
    expect(new Set(reads.area.mock.calls.map(args => args[3]))).toEqual(new Set([pathClock]));
    expect(new Set(reads.path.mock.calls.map(args => args[2]))).toEqual(new Set([pathClock]));
    expect(new Set(reads.waypoint.mock.calls.map(args => args[4]))).toEqual(new Set([pathClock]));
  });
});

describe('B and F across saving, reopening, undo and reset', () => {
  test('save → reopen → save keeps B and F, and autosave writes B', async () => {
    const { app } = await editorWithCrowd('disappear');
    const first = durations(app);
    const saved = app._buildProjectSnapshot();
    expect(saved.animationState.duration).toBe(first.B);

    const autoSave = vi.spyOn(app.storageService, 'autoSave');
    app.autoSave();
    expect(autoSave.mock.calls.at(-1)[0].animationState.duration).toBe(first.B);

    for (let round = 0; round < 2; round++) {
      expect(await loadSnapshot(app, app._buildProjectSnapshot())).toBe(true);
      await settled();
      expect(durations(app)).toEqual(first);
    }
    expect(app._buildProjectSnapshot().animationState.duration).toBe(first.B);
  });

  test('crowd-only undo and redo measure the end again', async () => {
    const { app } = await editorWithCrowd('disappear');
    const slow = durations(app);
    const speed = document.getElementById('crowd-speed');
    app.saveUndoState();
    speed.value = '12'; // 0.12 img/s
    speed.dispatchEvent(new Event('input', { bubbles: true }));
    app.saveUndoState();
    await settled();
    const fast = durations(app);
    expect(fast.F).toBeLessThan(slow.F);
    expect(fast.B).toBe(slow.B);

    app.undo();
    await settled();
    expect(durations(app)).toEqual(slow);
    app.redo();
    await settled();
    expect(durations(app)).toEqual(fast);
  });

  test('a route taken away leaves no crowd on it to wait for', async () => {
    const { app } = await editorWithCrowd('disappear');
    const { B } = durations(app);
    for (const waypoint of [...app.waypoints]) app.eventBus.emit('waypoint:delete', waypoint);
    await settled();
    expect(durations(app)).toEqual({ B, F: B, parts: { routeMs: B, crowdsMs: 0, beaconsMs: 0 } });
  });

  test('clearing the project clears both durations and what made up the end, and nothing comes back', async () => {
    const { app } = await editorWithCrowd('disappear');
    app.scheduleSceneEnd(); // pending work a reset must cancel
    clearProject(app);
    await settled();
    expect(durations(app)).toEqual({ B: 0, F: 0, parts: null });
    const breakdown = document.getElementById('pacing-duration-breakdown');
    expect(breakdown.hidden).toBe(true);
    expect(breakdown.textContent).toBe('');
  });

  test('"Wait here for this crowd" reads B: fitted twice, the same wait; undo puts both durations back', async () => {
    const { app, layer } = await editorWithCrowd('disappear');
    app.saveUndoState(); // what the crowd edit's debounce does 400 ms later
    const unfitted = durations(app);
    const last = app.waypoints.at(-1);
    const pauseBefore = last.pauseTime;

    expect(app.fitRouteWaitToCrowd(layer, last)).toBe(true);
    await settled();
    const fittedWait = last.pauseTime;
    const fitted = durations(app);
    expect(fittedWait).toBeGreaterThan(pauseBefore);
    // The route now waits for the crowd: its own end is where the crowd's is, to the millisecond it was rounded to.
    expect(fitted.B).toBeGreaterThanOrEqual(fitted.parts.crowdsMs);
    expect(fitted.F).toBe(fitted.B);

    expect(app.fitRouteWaitToCrowd(layer, last)).toBe(true);
    await settled();
    expect(last.pauseTime).toBe(fittedWait);
    expect(durations(app)).toEqual(fitted);

    app.undo();
    await settled();
    expect(app.waypoints.at(-1).pauseTime).toBe(pauseBefore);
    expect(durations(app)).toEqual(unfitted);
  });
});

describe('the route\'s own part is the base timeline, whatever composes it', () => {
  test('waits and a longer branch included, the route ends at B exactly, and a crowd edit never moves it', async () => {
    // The open day branches and rejoins, waits at its majors, and carries a
    // crowd that finishes after the route.
    const example = buildExampleProjects().find(each => each.id === 'uon-open-day');
    const app = await bootApp();
    await app.ready;
    expect(await loadSnapshot(app, example.project)).toBe(true);
    await settled();
    const engine = app.animationEngine;
    const { B, F, parts } = durations(app);
    const branched = app.getBranchTimeline();

    expect(engine.totalPauseTime).toBeGreaterThan(0);
    expect(branched.totalDurationMs).toBeGreaterThan(engine.pathDuration);
    expect(B).toBeCloseTo(engine.introTime + engine.totalTailTime
      + Math.max(engine.pathDuration + engine.totalPauseTime, branched.totalDurationMs), 6);
    expect(parts.routeMs).toBe(B);
    expect(F).toBeGreaterThan(B);

    // At B itself the head is at its end, not where the pause scan's
    // rounding would leave it a hair short.
    engine.seekToTime(B);
    expect(engine.state.pathProgress).toBe(1);

    // A crowd edit moves the end, never the route: the head keeps its instant.
    engine.seekToTime(B / 2);
    const { pathProgress } = engine.state;
    app.scene.getFlowLayers()[0].emitters[0].update({ speed: 0.04 });
    app.eventBus.emit('crowd:param-changed');
    await settled();
    expect(durations(app).F).toBeGreaterThan(F);
    expect(engine.state.currentTime).toBe(B / 2);
    expect(engine.state.pathProgress).toBe(pathProgress);
  });

  test('Preview\'s comet tail is part of the route, and is what ends it there', async () => {
    const app = await bootApp();
    await app.ready;
    app.eventBus.emit('waypoint:add', { imgX: 0.1, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.5, isMajor: true });
    await settled();
    app.motionSettings.pathVisibility = 'instantaneous';
    app.motionSettings.pathTrail = 0.4;
    const edit = durations(app);
    app._setPreviewMode(true);
    app.invalidateAnimationTiming();
    const preview = durations(app);

    expect(app.animationEngine.totalTailTime).toBeGreaterThan(0);
    expect(preview.B).toBe(edit.B + app.animationEngine.totalTailTime);
    expect(preview).toEqual({ B: preview.B, F: preview.B, parts: { routeMs: preview.B, crowdsMs: 0, beaconsMs: 0 } });
  });
});

describe('what else concludes after the route', () => {
  test('a glow at the last waypoint is waited for, and the slider still sets the route\'s pace', async () => {
    const app = await bootApp();
    await app.ready;
    app.eventBus.emit('waypoint:add', { imgX: 0.1, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.5, isMajor: true });
    await settled();
    const last = app.waypoints.at(-1);
    last.pauseMode = 'none';
    last.pauseTime = 0;
    last.beaconStyle = 'glow';
    app.invalidateAnimationTiming();
    const { B, F, parts } = durations(app);
    const glow = app.animationEngine.beaconSchedules.find(each => each.waypointId === last.id);

    expect(F).toBe(glow.arrivalMs + 3000);
    expect(F).toBeGreaterThan(B);
    expect(parts).toEqual({ routeMs: B, crowdsMs: 0, beaconsMs: F });
    expect(document.getElementById('pacing-duration-breakdown').textContent).toBe(describeSceneEnd(parts, F));

    app.eventBus.emit('animation:speed-change', app.animationEngine.state.speed * 2);
    const faster = durations(app);
    expect(faster.B).toBeLessThan(B);
    expect(faster.F).toBe(computeSceneEnd({
      baseMs: faster.B,
      beaconSchedules: app.animationEngine.beaconSchedules,
      waypoints: app.waypoints,
    }).endMs);
  });
});

describe('the "At journey end" hint\'s cases', () => {
  async function graphCrowd(build) {
    const app = await bootApp();
    await app.ready;
    const scene = new Scene();
    const layer = scene.addFlowLayer({ name: 'Crowd 1', guideType: 'graph' });
    build(layer);
    expect(await loadSnapshot(app, { coordVersion: 9, waypoints: [], scene: scene.toJSON() })).toBe(true);
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayers()[0]);
    return { app, hint: document.getElementById('crowd-lifecycle-hint') };
  }
  /** Entry → a, and an Exit on a path of its own, reached from the entry or not. */
  const network = (reachable, emitter = true) => (layer) => {
    const entry = layer.graph.addNode({ x: 0.1, y: 0.1, type: 'entry' });
    const a = layer.graph.addNode({ x: 0.4, y: 0.1 });
    const b = layer.graph.addNode({ x: 0.6, y: 0.6 });
    const exit = layer.graph.addNode({ x: 0.9, y: 0.6, type: 'exit' });
    layer.graph.addEdge({ sourceId: entry.id, targetId: a.id, direction: 'one-way' });
    layer.graph.addEdge({ sourceId: a.id, targetId: entry.id, direction: 'one-way' });
    layer.graph.addEdge({ sourceId: b.id, targetId: exit.id, direction: 'one-way' });
    if (reachable) layer.graph.addEdge({ sourceId: a.id, targetId: b.id, direction: 'one-way' });
    if (emitter) layer.addEmitter({ seed: 3, dotCount: 10, lifecycleMode: 'disappear' });
  };

  test('shown where no journey can end: an Exit no entry leads to ends none', async () => {
    const { hint } = await graphCrowd(network(false));
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toMatch(/^No dot’s journey ends on this network\./);
  });

  test('hidden where a journey can end', async () => {
    const { hint } = await graphCrowd(network(true));
    expect(hint.hidden).toBe(true);
    expect(hint.textContent).toBe('');
  });

  test('hidden for a crowd with no dots, whatever its network', async () => {
    const { hint } = await graphCrowd(network(false, false));
    expect(hint.hidden).toBe(true);
    expect(hint.textContent).toBe('');
  });
});
