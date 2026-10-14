/** CROWD-08 part A: regressions from the independent code reviews. */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Scene } from '../src/models/Scene.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import {
  HTML_AND_BACKGROUND_REASON, PLAY_OFF, PLAY_ON, VIDEO_REASON,
  blankProject, byId, drawCrowd, exportState, playState, press, settled,
} from './helpers/noRouteScene.js';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.getItem.mockImplementation(() => null);
});

describe('accepted ids cannot alias another crowd\'s cached journeys', () => {
  test.each([false, true])('interleaved cold/warm reads, ambiguous graph signature: %s', (ambiguous) => {
    const common = [
      { id: 'in', type: 'entry', x: 0.1, y: 0.5 },
      { id: 'out', type: 'exit', x: 0.8, y: 0.5 },
    ];
    const scene = Scene.fromJSON({ flowLayers: [
      { id: 'a', emitterId: 'b\u0000c', nodes: [
        ...common, { id: ambiguous ? 'blocked:entry:0.4,0.5;extra' : 'extra', type: 'normal', x: 0.2, y: 0.5 },
      ] },
      { id: 'a\u0000b', emitterId: 'c', nodes: [
        ...common, { id: 'blocked', type: 'entry', x: 0.4, y: 0.5 },
        { id: 'extra', type: 'normal', x: 0.2, y: 0.5 },
      ] },
    ].map(({ id, emitterId, nodes }) => ({
      id, guideType: 'graph', graph: {
        nodes, edges: [{ id: 'path', sourceId: 'in', targetId: 'out', direction: 'one-way' }],
      },
      emitters: [{ id: emitterId, seed: 2, dotCount: 1, lifecycleMode: 'disappear',
        speed: 0.2, speedVariance: 0, releaseStart: 0.5, releaseDuration: 0 }],
    })) });
    const context = { durationMs: 10000 };
    const layers = scene.getFlowLayers();
    const cold = layers.map(layer => {
      const engine = new SwarmEngine();
      return [engine.crowdFinishMs(layer, context), engine.canRelease(layer, context),
        engine.evaluate(5000, layer, context).length];
    });
    expect(cold[0][0]).toBeCloseTo(8500, 8);
    expect(cold[1][0]).toBe(5000);
    expect(cold.map(row => row.slice(1))).toEqual([[true, 1], [false, 0]]);
    const engine = new SwarmEngine();
    const walk = vi.spyOn(engine, '_journeyLength');
    const read = layer => [engine.crowdFinishMs(layer, context), engine.canRelease(layer, context),
      engine.evaluate(5000, layer, context).length];
    expect(layers.map(read)).toEqual(cold);
    expect(walk).toHaveBeenCalledTimes(2);
    walk.mockClear();
    expect([...layers].reverse().map(read)).toEqual([...cold].reverse());
    expect(layers.map(read)).toEqual(cold);
    expect(walk).not.toHaveBeenCalled();
    expect(Scene.fromJSON(scene.toJSON()).toJSON()).toEqual(scene.toJSON());
  });
});

/** Accepted graphs with the same signature, but different entry choices at seed 2. */
function sameIdProjects() {
  const common = [
    { id: 'in', type: 'entry', x: 0.1, y: 0.5 },
    { id: 'out', type: 'exit', x: 0.8, y: 0.5 },
  ];
  return [
    [...common, { id: 'blocked:entry:0.4,0.5;extra', type: 'normal', x: 0.2, y: 0.5 }],
    [...common, { id: 'blocked', type: 'entry', x: 0.4, y: 0.5 },
      { id: 'extra', type: 'normal', x: 0.2, y: 0.5 }],
  ].map(nodes => ({
    coordVersion: 9, waypoints: [],
    animationState: { mode: 'constant-speed', speed: 200, duration: 10000 },
    scene: { flowLayers: [{
      id: 'same-crowd', guideType: 'graph',
      graph: { nodes, edges: [{ id: 'path', sourceId: 'in', targetId: 'out', direction: 'one-way' }] },
      emitters: [{ id: 'same-emitter', seed: 2, dotCount: 1, lifecycleMode: 'disappear',
        speed: 0.2, speedVariance: 0, releaseStart: 0.5, releaseDuration: 0 }],
    }] },
  }));
}

describe('same-id project replacements do not inherit another model\'s journeys', () => {
  test.each([false, true])('instances remain cold-correct and warm, reversed: %s', reversed => {
    const layers = sameIdProjects().map(project => Scene.fromJSON(project.scene).getFlowLayers()[0]);
    const context = { durationMs: 10000 };
    const read = (engine, layer) => [engine.canRelease(layer, context),
      engine.crowdFinishMs(layer, context), engine.evaluate(5000, layer, context).length];
    const cold = layers.map(layer => read(new SwarmEngine(), layer));
    expect(cold.map(row => [row[0], row[2]])).toEqual([[true, 1], [false, 0]]);
    expect(cold[0][1]).toBeCloseTo(8500, 8);
    expect(cold[1][1]).toBe(5000);
    const order = reversed ? [1, 0] : [0, 1];
    const engine = new SwarmEngine();
    const walk = vi.spyOn(engine, '_journeyLength');
    expect(order.map(i => read(engine, layers[i]))).toEqual(order.map(i => cold[i]));
    expect(walk).toHaveBeenCalledTimes(2);
    walk.mockClear();
    expect([...order].reverse().map(i => read(engine, layers[i])))
      .toEqual([...order].reverse().map(i => cold[i]));
    expect(walk).not.toHaveBeenCalled();
  });

  test.each([false, true])('file loads refresh Play and export reasons, reversed: %s', async reversed => {
    const app = await blankProject();
    const engine = app.swarmEngine;
    const projects = sameIdProjects();
    const order = reversed ? [1, 0, 1] : [0, 1, 0];
    for (const i of order) {
      vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValueOnce({
        projectData: projects[i], imageAssets: [], backgroundBase64: null,
      });
      expect(await app.loadProject(new File([''], 'same-ids.zip'))).toBe(true);
      await settled();
      expect(app.swarmEngine).toBe(engine); // replacement keeps the host engine
      const layer = app.scene.getFlowLayers()[0];
      const cold = new SwarmEngine();
      const context = { durationMs: 10000 };
      const playable = i === 0;
      expect(cold.evaluate(5000, layer, context)).toHaveLength(playable ? 1 : 0);
      expect(engine.canRelease(layer, context)).toBe(playable);
      expect(engine.crowdFinishMs(layer, context)).toBe(cold.crowdFinishMs(layer, context));
      expect(playState()).toEqual(playable ? PLAY_ON : PLAY_OFF);
      expect(exportState()).toEqual({
        mp4: !playable, webm: !playable, html: true,
        video: playable ? '' : VIDEO_REASON,
        htmlReason: playable ? 'Export HTML needs a background image.' : HTML_AND_BACKGROUND_REASON,
        lineHidden: false,
      });
      const walk = vi.spyOn(engine, '_journeyLength');
      expect(engine.canRelease(layer, context)).toBe(playable);
      expect(engine.crowdFinishMs(layer, context)).toBe(cold.crowdFinishMs(layer, context));
      expect(walk).not.toHaveBeenCalled();
      walk.mockRestore();
    }
  });
});

async function editableCrowd(kind, playable) {
  const app = await blankProject();
  const { layer, entry, path } = drawCrowd(app, {
    entry: { x: kind === 'node' && playable ? 0.2 : 0.5, y: 0.5 }, exit: { x: 0.5, y: 0.5 },
  });
  layer.emitters[0].update({ lifecycleMode: 'disappear', dotCount: 1, seed: 2,
    speed: 0.02, speedVariance: 0, releaseStart: 0.5, releaseDuration: 0 });
  if (kind === 'control') path.addControlPoint(playable ? 0.2 : 0.5, 0.5);
  app.eventBus.emit('network:changed', { commit: true });
  await settled();
  byId('network-edit-btn').click();
  return { app, layer, entry, path, pen: app.networkEditService };
}

function beginDrag({ pen, entry, path }, kind) {
  if (kind === 'node') pen.beginNodeDrag(entry);
  else if (kind === 'control') pen.beginControlDrag(path, 0);
  else pen.beginEdgeBend(path, { x: 0.2, y: 0.5 }, 0);
}

function expectAvailability(app, playable) {
  expect(app.canPlayScene()).toBe(playable);
  expect(playState()).toEqual(playable ? PLAY_ON : PLAY_OFF);
  expect(byId('export-mp4-btn').getAttribute('aria-disabled')).toBe(playable ? null : 'true');
  expect(byId('crowd-guide-hint').textContent.includes('before previewing or exporting')).toBe(!playable);
}

describe('network drags refresh provisional geometry without committing it', () => {
  test.each(['node', 'control'])('%s drag: both directions and cancellation after measurement', async kind => {
    for (const initiallyPlayable of [false, true]) {
      const fixture = await editableCrowd(kind, initiallyPlayable);
      const { app, pen } = fixture;
      const before = app.scene.toJSON();
      const duration = app.animationEngine.state.duration;
      const save = vi.spyOn(app, 'autoSave');
      const history = vi.spyOn(app, 'saveUndoState');
      expectAvailability(app, initiallyPlayable);
      beginDrag(fixture, kind);
      pen.moveDrag({ x: initiallyPlayable ? 0.5 : 0.2, y: 0.5 });
      expectAvailability(app, !initiallyPlayable);
      await settled();
      expect(app.animationEngine.state.duration).not.toBe(duration);
      pen.cancelDrag();
      expectAvailability(app, initiallyPlayable);
      expect(app.scene.toJSON()).toEqual(before);
      await settled();
      expect(app.animationEngine.state.duration).toBe(duration);
      expect(save).not.toHaveBeenCalled();
      expect(history).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    }
  });

  test('an inserted bend changes eligibility at insertion and cancellation restores it', async () => {
    const fixture = await editableCrowd('insert', false);
    const { app, pen, path } = fixture;
    const duration = app.animationEngine.state.duration;
    const save = vi.spyOn(app, 'autoSave');
    const history = vi.spyOn(app, 'saveUndoState');
    beginDrag(fixture, 'insert');
    expectAvailability(app, true);
    await settled();
    expect(app.animationEngine.state.duration).toBeGreaterThan(duration);
    pen.cancelDrag();
    expect(path.controlPoints).toEqual([]);
    expectAvailability(app, false);
    await settled();
    expect(app.animationEngine.state.duration).toBe(duration);
    expect(save).not.toHaveBeenCalled();
    expect(history).not.toHaveBeenCalled();
  });

  test.each(['node', 'control', 'insert'])('K immediately after a %s drag uses the current scene end', async kind => {
    const fixture = await editableCrowd(kind, false);
    const { app, layer, pen } = fixture;
    beginDrag(fixture, kind);
    if (kind !== 'insert') pen.moveDrag({ x: 0.2, y: 0.5 });
    // Independent uncached schedule, rather than the scene-end cache being tested.
    const [dot] = new SwarmEngine().scheduleDots(layer, { durationMs: 10000 });
    const expected = Math.max(10000, dot.onsetFraction * 10000 + dot.journeyMs) + 2000;
    expect(expected).toBeGreaterThan(12000);
    press('k');
    expect(app.animationEngine.isPlaying()).toBe(true);
    expect(app.animationEngine.state.duration).toBe(expected);
    app.animationEngine.pause();
    pen.cancelDrag();
    press('k');
    expect(app.animationEngine.isPlaying()).toBe(false);
    await settled();
    expectAvailability(app, false);
  });
});

describe('the Duration description follows route presence even when numbers stay the same', () => {
  test.each(['constant-speed', 'constant-time'])('delete, undo and redo across two waypoints (%s)', async mode => {
    const app = await blankProject();
    drawCrowd(app); // Respawn does not extend the timeline.
    app.animationEngine.setMode(mode);
    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.4, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.8, imgY: 0.4, isMajor: true });
    await settled();
    const duration = app.animationEngine.state.duration;
    const base = app.animationEngine.state.baseDuration;
    const label = noun => `Ends at ${(duration / 1000).toFixed(1)} s — ${noun} `
      + `${(base / 1000).toFixed(1)} s, hold at end +2.0 s`;
    expect(byId('pacing-duration-breakdown').textContent).toBe(label('route'));
    app.eventBus.emit('waypoint:delete', app.waypoints[1]);
    expect(byId('pacing-duration-breakdown').textContent).toBe(label('timeline'));
    await settled();
    expect(app.animationEngine.state.duration).toBe(duration);
    expect(byId('pacing-duration-breakdown').textContent).toBe(label('timeline'));
    app.undo();
    await settled();
    expect(app.animationEngine.state.duration).toBe(duration);
    expect(byId('pacing-duration-breakdown').textContent).toBe(label('route'));
    app.redo();
    await settled();
    expect(app.animationEngine.state.duration).toBe(duration);
    expect(byId('pacing-duration-breakdown').textContent).toBe(label('timeline'));
  });
});

describe('portrait fitting accounts for wrapped transport controls', () => {
  test('the reason can wrap again after the first fit; showing and hiding it each fits once', async () => {
    const app = await blankProject();
    const area = app.canvas.closest('.canvas-area');
    const bar = area.querySelector('.controls');
    Object.defineProperties(area, {
      clientWidth: { configurable: true, value: 704 },
      clientHeight: { configurable: true, value: 714 },
    });
    Object.defineProperty(bar, 'offsetHeight', { configurable: true, get() {
      const width = parseFloat(bar.style.width) || 704;
      if (width >= 400) return byId('play-reason').hidden ? 61 : 91;
      return byId('play-reason').hidden ? 121 : width >= 320 ? 166 : 181;
    } });
    app.exportSettings.resolutionX = 1080;
    app.exportSettings.resolutionY = 1920;
    for (const hidden of [false, true, false]) {
      byId('play-reason').hidden = hidden;
      app.updateCanvasAspectRatio();
      const height = hidden ? 593 : 533;
      expect(app.displayHeight).toBe(height);
      expect(app.displayWidth).toBe(height * 9 / 16);
      expect(app.displayHeight + bar.offsetHeight).toBe(714);
      expect(app._fittedRoom).toEqual({ width: 704, height });
    }
    app.exportSettings.resolutionX = 1920;
    app.exportSettings.resolutionY = 1080;
    app.updateCanvasAspectRatio();
    expect(app.displayWidth).toBe(704);
    expect(app.displayHeight).toBe(396);
    expect(bar.offsetHeight).toBe(91);
  });
});
