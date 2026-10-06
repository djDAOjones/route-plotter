/**
 * CROWD-06 — Hold at end: the animation carries on after everything that
 * finishes has finished.
 *
 * One project-wide setting in Pacing, under Duration: 0–10 s, 2 s for a new
 * project, none for a project saved without it. It lengthens the playback
 * duration, F, by exactly its value and never the base timeline, B, so
 * nothing timed as a fraction of the timeline moves. Time keeps running
 * through it: a looping crowd keeps moving, while the route head and what
 * concluded hold their final state. These pin it in the booted editor, on
 * play, on a seek, in a video export's samples and in the HTML player (one
 * evaluation path), across saving, reopening, autosave, undo and Clear All,
 * and in the Duration readout. "Wait here for this crowd" is retired.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { clearProject } from '../src/app/projectReset.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import { VideoExporter, createVideoFramePlan } from '../src/services/VideoExporter.js';
import { Scene } from '../src/models/Scene.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { ANIMATION, VIDEO_EXPORT } from '../src/config/constants.js';
import { computeSceneEnd, describeSceneEnd, resolveHoldAtEndMs } from '../src/utils/sceneEnd.js';
import { formatHoldAtEnd } from '../src/utils/uiReadouts.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Past the 50 ms the app waits before it measures timing again. */
const settled = () => new Promise(resolve => setTimeout(resolve, 120));
/** One frame of a 25 fps export. */
const FRAME_MS = 40;
/** A crowd on the route too slow to finish before the route does (CROWD-05's). */
const SLOW_CROWD = { seed: 21, speed: 0.05, speedVariance: 0.3, releaseDuration: 0.5, onsetVariance: 0.4 };

const holdSlider = () => document.getElementById('hold-at-end');

/** The thumb moved to `ms` as a browser moves it: the value, then `input`. */
function moveHold(ms) {
  const slider = holdSlider();
  slider.value = String(ms);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The gesture let go (the pointer up, or the end of a keyboard step): `change`. */
function commitHold() {
  holdSlider().dispatchEvent(new Event('change', { bubbles: true }));
}

/** One complete change, as a click on the track or one arrow key gives: `input`, then `change`. */
function setHold(ms) {
  moveHold(ms);
  commitHold();
}

const durations = host => ({
  B: host.animationEngine.state.baseDuration,
  F: host.animationEngine.state.duration,
  parts: host.animationEngine.sceneEndParts,
});

/** The shipped editor, splash closed, a two-click route and a crowd on it. */
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

/** What the renderer draws of the crowds at `ms` (read off the evaluator it calls), and where the head is. */
function frameAt(host, ms) {
  const evaluate = vi.spyOn(host.swarmEngine, 'evaluate');
  try {
    host.animationEngine.seekToTime(ms);
    host.render();
    return {
      ms: host.animationEngine.state.currentTime,
      head: host.animationEngine.state.pathProgress,
      dots: evaluate.mock.results.flatMap(result => result.value),
    };
  } finally {
    evaluate.mockRestore();
  }
}

/** Dot positions only, for comparing frames drawn by different hosts. */
const positions = dots => dots.map(dot => [dot.emitterId, dot.dotIndex, dot.x, dot.y]);

describe('the Hold at end control', () => {
  test('sits in Pacing under Duration: 0–10 s, 2 s, its readout and hint wired', async () => {
    const app = await bootApp();
    await app.ready;
    const slider = holdSlider();
    const duration = document.getElementById('animation-speed-right');
    const readout = document.getElementById('hold-at-end-value');

    expect(document.getElementById('section-pacing-content').contains(slider)).toBe(true);
    expect(duration.compareDocumentPosition(slider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(slider.type).toBe('range');
    expect([slider.min, slider.max, slider.step, slider.value]).toEqual(['0', '10000', '100', '2000']);
    expect(ANIMATION.HOLD_AT_END_DEFAULT_MS).toBe(2000);
    expect(ANIMATION.HOLD_AT_END_MAX_MS).toBe(10000);

    // The visible label names the control, and its hint is the label's own.
    const label = slider.closest('label');
    expect(label.getAttribute('for')).toBe('hold-at-end');
    const hint = label.querySelector('[data-tip]');
    expect(hint.textContent).toBe('Hold at end');
    expect(hint.dataset.tip).toBe('Keeps the animation going after everything that finishes has finished: '
      + 'looping crowds keep moving and the final frame holds');

    // The readout is described first, as every range's is; the hint after it.
    const described = slider.getAttribute('aria-describedby').split(' ');
    expect(described[0]).toBe('hold-at-end-value');
    expect(described).toContain('hold-at-end-tip');
    expect(readout.textContent).toBe('2s');
    expect(slider.getAttribute('aria-valuetext')).toBe('2s');

    const sent = vi.fn();
    app.eventBus.on('animation:hold-at-end-change', sent);
    setHold(3500);
    expect(sent.mock.calls).toEqual([[{ holdMs: 3500, commit: false }], [{ holdMs: 3500, commit: true }]]);
    expect(app.styles.holdAtEndMs).toBe(3500);
    expect(readout.textContent).toBe('3.5s');
    expect(slider.getAttribute('aria-valuetext')).toBe('3.5s');
  });

  test('its slider is a 44 px target (WCAG 2.5.5), and only it: its rail and thumb look as the others do', async () => {
    await bootApp();
    const style = document.createElement('style');
    style.textContent = readFileSync(resolve(process.cwd(), 'styles/main.css'), 'utf8');
    document.head.append(style);
    try {
      const slider = holdSlider();
      expect(slider.classList.contains('range-hit-target')).toBe(true);
      expect(getComputedStyle(slider).height).toBe('2.75rem');
      expect(getComputedStyle(slider).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      // The other section ranges keep their 4 px rail.
      for (const id of ['graphics-scale', 'animation-speed-right', 'path-head-size']) {
        expect(document.getElementById(id).classList.contains('range-hit-target'), id).toBe(false);
        expect(getComputedStyle(document.getElementById(id)).height, id).toBe('4px');
      }
      // Its rail is drawn on the track instead, as the others' is on the input, and the thumb sits on it.
      const rules = [...style.sheet.cssRules].filter(rule => rule.selectorText?.includes('.range-hit-target'));
      const rule = pseudo => rules.find(each => each.selectorText.endsWith(pseudo)).style;
      const rail = rule('::-webkit-slider-runnable-track');
      const plain = [...style.sheet.cssRules]
        .find(each => each.selectorText === '.section-content input[type="range"]').style;
      for (const property of ['height', 'background', 'border', 'border-radius']) {
        expect(rail.getPropertyValue(property), property).toBe(plain.getPropertyValue(property));
      }
      expect(rule('::-webkit-slider-thumb').getPropertyValue('margin-top')).toBe('-5px');
    } finally {
      style.remove();
    }
  });

  test('the readout writes seconds as Duration does, and a hold is kept within 0–10 s', () => {
    expect([0, 2000, 3500, 10000].map(formatHoldAtEnd)).toEqual(['0s', '2s', '3.5s', '10s']);
    expect([undefined, null, 'x', -5, 0, 2500, 25000].map(resolveHoldAtEndMs)).toEqual([0, 0, 0, 0, 0, 2500, 10000]);
  });
});

describe('the hold lengthens playback only', () => {
  test('F grows by exactly the hold; B, the crowd\'s end and its releases do not move', async () => {
    const { app, layer } = await editorWithCrowd('disappear');
    setHold(0);
    const none = durations(app);
    const context = () => ({
      durationMs: app.animationEngine.state.baseDuration,
      routePathPoints: app.pathPoints,
      routeAnchors: app.getRouteArrivalMap(),
    });
    const releases = () => app.swarmEngine.scheduleDots(layer, context())
      .map(dot => dot.onsetFraction * app.animationEngine.state.baseDuration);
    const releasedAt = releases();
    expect(none.F).toBe(none.parts.crowdsMs);
    expect(none.F).toBeGreaterThan(none.B);

    setHold(3500);
    const held = durations(app);
    expect(held.F).toBe(none.F + 3500);
    expect(held.B).toBe(none.B);
    expect(held.parts).toEqual({ ...none.parts, holdMs: 3500 });
    expect(releases()).toEqual(releasedAt);
    // What concluded stays concluded through the hold: no Disappear dot comes back.
    for (const ms of [none.F, none.F + 1000, held.F]) {
      const frame = frameAt(app, ms);
      expect(frame.dots, `${ms} ms`).toEqual([]);
      expect(frame.head).toBe(1);
    }
    expect(frameAt(app, none.F - FRAME_MS).dots.length).toBeGreaterThan(0);
  });

  test('a looping crowd keeps moving through the hold, and the route head stays at its end', async () => {
    const { app } = await editorWithCrowd('respawn');
    setHold(4000);
    const { B, F, parts } = durations(app);
    expect(F).toBe(B + 4000);
    expect(parts).toEqual({ routeMs: B, crowdsMs: 0, beaconsMs: 0, holdMs: 4000 });

    const frames = [B + 1000, B + 2000, B + 3000, F].map(ms => frameAt(app, ms));
    for (const frame of frames) {
      expect(frame.head).toBe(1);
      expect(frame.dots.length).toBeGreaterThan(0);
    }
    const seen = new Set(frames.map(frame => JSON.stringify(positions(frame.dots))));
    expect(seen.size).toBe(frames.length);
    // The transport stops at F, with the hold played, not at B.
    frameAt(app, F + 1000);
    expect(app.animationEngine.state.currentTime).toBe(F);
  });

  test('play, a seek and a video export\'s samples draw the same frames through the hold', async () => {
    const { app } = await editorWithCrowd('respawn');
    setHold(2000);
    // Preview, as an export draws it; set rather than toggled, so the route keeps its timing.
    app.previewMode = true;
    const { B, F } = durations(app);
    const engine = app.animationEngine;

    // Play: frames from B to F as the transport steps them.
    const played = [];
    engine.seekToTime(B);
    app.play();
    while (engine.state.currentTime < F) {
      engine.updateAnimation(FRAME_MS, 0);
      const evaluate = vi.spyOn(app.swarmEngine, 'evaluate');
      app.render();
      played.push({ ms: engine.state.currentTime, head: engine.state.pathProgress,
        dots: positions(evaluate.mock.results.flatMap(result => result.value)) });
      evaluate.mockRestore();
    }
    expect(played.at(-1).ms).toBe(F);
    expect(played.length).toBeGreaterThan(40);
    app.pause();
    // A seek to each played instant draws what play drew.
    for (const frame of played) {
      const sought = frameAt(app, frame.ms);
      expect({ ms: sought.ms, head: sought.head, dots: positions(sought.dots) }, `${frame.ms} ms`).toEqual(frame);
    }

    // The export: its samples run to F, and each one in the hold draws what a seek draws.
    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    vi.stubGlobal('alert', vi.fn());
    const exported = [];
    let plan;
    app.videoExporter = {
      cancel() {},
      async export({ frameRate, duration, startBuffer, renderFrame }) {
        plan = { frameRate, duration, startBuffer };
        for (const sample of createVideoFramePlan(plan).samples()) {
          if (sample.progress * duration < B) continue;
          const evaluate = vi.spyOn(app.swarmEngine, 'evaluate');
          await renderFrame(sample.progress);
          exported.push({ ms: app.animationEngine.state.currentTime, head: app.animationEngine.state.pathProgress,
            dots: positions(evaluate.mock.results.flatMap(result => result.value)) });
          evaluate.mockRestore();
        }
        return new Blob(['video'], { type: 'video/mp4' });
      },
    };
    await app.exportVideo();
    // The hold is in the export's own length; its 2 s start buffer stays apart.
    expect(plan.duration).toBe(F);
    expect(plan.startBuffer).toBe(VIDEO_EXPORT.START_BUFFER_MS);
    expect(exported.at(-1).ms).toBe(F);
    expect(exported.length).toBeGreaterThanOrEqual(Math.floor((F - B) / FRAME_MS));
    for (const frame of exported) {
      const sought = frameAt(app, frame.ms);
      expect({ ms: sought.ms, head: sought.head, dots: positions(sought.dots) }, `${frame.ms} ms`).toEqual(frame);
    }
    expect(new Set(exported.map(frame => JSON.stringify(frame.dots))).size).toBeGreaterThan(1);
  });

  test('the Duration readout includes the hold, and its breakdown names it', async () => {
    const app = await bootApp();
    await app.ready;
    app.eventBus.emit('waypoint:add', { imgX: 0.1, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.5, isMajor: true });
    await settled();
    const value = document.getElementById('animation-speed-value-right');
    const breakdown = document.getElementById('pacing-duration-breakdown');
    const { B, F } = durations(app);
    const seconds = ms => `${(ms / 1000).toFixed(1)} s`;

    // A new project's 2 s, after the route alone.
    expect(F).toBe(B + 2000);
    expect(value.textContent).toBe(`${Math.round(F / 100) / 10}s`);
    expect(breakdown.hidden).toBe(false);
    expect(breakdown.textContent).toBe(`Ends at ${seconds(F)} — route ${seconds(B)}, hold at end +2.0 s`);

    // No hold: the route alone sets the end, and the line goes.
    setHold(0);
    expect(durations(app).F).toBe(B);
    expect(value.textContent).toBe(`${Math.round(B / 100) / 10}s`);
    expect(breakdown.hidden).toBe(true);
    expect(breakdown.textContent).toBe('');

    // After a crowd that finishes, in that order.
    expect(describeSceneEnd({ routeMs: 12000, crowdsMs: 16500, beaconsMs: 12800, holdMs: 2000 }, 18500))
      .toBe('Ends at 18.5 s — route 12.0 s, crowds finish +4.5 s, beacon ends +0.8 s, hold at end +2.0 s');
  });

  test('the scene end adds the hold after the last end, and holds nothing where nothing ends', () => {
    expect(computeSceneEnd({ baseMs: 12000, holdMs: 2500 }))
      .toEqual({ endMs: 14500, parts: { routeMs: 12000, crowdsMs: 0, beaconsMs: 0, holdMs: 2500 } });
    expect(computeSceneEnd({ baseMs: 12000 }))
      .toEqual({ endMs: 12000, parts: { routeMs: 12000, crowdsMs: 0, beaconsMs: 0, holdMs: 0 } });
    expect(computeSceneEnd({ baseMs: 0, holdMs: 2500 }))
      .toEqual({ endMs: 0, parts: { routeMs: 0, crowdsMs: 0, beaconsMs: 0, holdMs: 0 } });
    expect(computeSceneEnd({ baseMs: 12000, holdMs: 60000 }).endMs).toBe(22000);
  });
});

describe('the HTML player honours the hold', () => {
  test('the same B, F and parts as the editor, and the same frames through the hold', async () => {
    const { app } = await editorWithCrowd('respawn');
    setHold(3000);
    app._setPreviewMode(true);
    app.invalidateAnimationTiming();
    const editor = durations(app);
    expect(editor.F).toBe(editor.B + 3000);
    const snapshot = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
    expect(snapshot.styles.holdAtEndMs).toBe(3000);
    expect(snapshot.animationState.duration).toBe(editor.B);

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const player = new PlayerApp(canvas);
    await player.load(snapshot, app.background.image);
    expect(durations(player)).toEqual(editor);

    for (const ms of [editor.B + 500, editor.B + 2000, editor.F]) {
      const inPlayer = frameAt(player, ms);
      const inEditor = frameAt(app, ms);
      expect(inPlayer.head, `${ms} ms`).toBe(1);
      expect(inPlayer.dots.length, `${ms} ms`).toBe(inEditor.dots.length);
      expect(inPlayer.dots.length).toBeGreaterThan(0);
    }

    player.animationEngine.seekToProgress(0.6);
    player.resetPlayback();
    expect(durations(player)).toEqual(editor);
  });

  test('on a branched route, the player draws the editor\'s dots, place for place, and they keep moving through the hold',
    async () => {
      // The open day's route branches, so its crowd's bound moments are the
      // same in the player's space (DEF-79 moves them only on a linear route).
      const app = await bootApp();
      await app.ready;
      document.getElementById('splash-close').click();
      const example = buildExampleProjects().find(each => each.id === 'uon-open-day');
      expect(await loadSnapshot(app, structuredClone(example.project))).toBe(true);
      await settled();
      const [crowd] = app.scene.getFlowLayers();
      crowd.emitters[0].update({ lifecycleMode: 'respawn' });
      app.eventBus.emit('crowd:param-changed');
      setHold(3000);
      app._setPreviewMode(true);
      app.invalidateAnimationTiming();
      const editor = durations(app);
      expect(editor.F).toBe(editor.B + 3000);
      expect(editor.parts.crowdsMs).toBe(0);

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const player = new PlayerApp(canvas);
      await player.load(JSON.parse(JSON.stringify(app._buildProjectSnapshot())), app.background.image);
      expect(durations(player)).toEqual(editor);

      const instants = [editor.B + 500, editor.B + 1500, editor.B + 2500, editor.F];
      const drawn = instants.map(ms => {
        const inEditor = frameAt(app, ms);
        const inPlayer = frameAt(player, ms);
        expect(inPlayer.head, `${ms} ms`).toBe(1);
        expect(inEditor.head, `${ms} ms`).toBe(1);
        expect(inPlayer.dots.length, `${ms} ms`).toBeGreaterThan(0);
        expect(positions(inPlayer.dots), `${ms} ms`).toEqual(positions(inEditor.dots));
        return JSON.stringify(positions(inPlayer.dots));
      });
      expect(new Set(drawn).size).toBe(instants.length);
    });

  test('a snapshot saved without a hold plays in the player with none', async () => {
    const { app } = await editorWithCrowd('disappear');
    const held = durations(app);
    expect(held.parts.holdMs).toBe(2000);
    const snapshot = JSON.parse(JSON.stringify(app._buildProjectSnapshot()));
    delete snapshot.styles.holdAtEndMs;

    const player = new PlayerApp(document.createElement('canvas'));
    await player.load(snapshot, null);
    expect(durations(player).B).toBe(held.B);
    expect(durations(player).parts.holdMs).toBe(0);
    expect(durations(player).F).toBe(durations(player).parts.crowdsMs);
  });
});

describe('the hold is the project\'s', () => {
  test('saved, reopened and autosaved with the project, its F unchanged', async () => {
    const { app } = await editorWithCrowd('disappear');
    setHold(4500);
    const first = durations(app);
    const saved = app._buildProjectSnapshot();
    expect(saved.styles.holdAtEndMs).toBe(4500);

    const autoSave = vi.spyOn(app.storageService, 'autoSave');
    app.autoSave();
    expect(autoSave.mock.calls.at(-1)[0].styles.holdAtEndMs).toBe(4500);

    setHold(0);
    expect(await loadSnapshot(app, saved)).toBe(true);
    await settled();
    expect(durations(app)).toEqual(first);
    expect(app.styles.holdAtEndMs).toBe(4500);
    expect(holdSlider().value).toBe('4500');
    expect(document.getElementById('hold-at-end-value').textContent).toBe('4.5s');
  });

  test('a project saved without the setting opens with no hold; a new project starts at 2 s', async () => {
    const app = await bootApp();
    await app.ready;
    expect(app.styles.holdAtEndMs).toBe(2000);
    expect(holdSlider().value).toBe('2000');

    const scene = new Scene();
    scene.addFlowLayer({ name: 'Crowd 1', guideType: 'route' })
      .addEmitter({ ...SLOW_CROWD, dotCount: 30, lifecycleMode: 'disappear' });
    expect(await loadSnapshot(app, {
      coordVersion: 9,
      waypoints: [
        { id: 'one', imgX: 0.1, imgY: 0.5, isMajor: true, pauseMode: 'none', pauseTime: 0 },
        { id: 'two', imgX: 0.9, imgY: 0.5, isMajor: true, pauseMode: 'none', pauseTime: 0 },
      ],
      scene: scene.toJSON(),
      styles: { pathColor: '#D55E00' },
      animationState: { mode: 'constant-speed', speed: 200, duration: 0 },
    })).toBe(true);
    await settled();
    expect(app.styles.holdAtEndMs).toBe(0);
    expect(holdSlider().value).toBe('0');
    expect(document.getElementById('hold-at-end-value').textContent).toBe('0s');
    const { F, parts } = durations(app);
    expect(parts.holdMs).toBe(0);
    expect(F).toBe(Math.max(parts.routeMs, parts.crowdsMs, parts.beaconsMs));

    // Clear All starts a new project: 2 s, with no end yet to hold after.
    clearProject(app);
    await settled();
    expect(app.styles.holdAtEndMs).toBe(2000);
    expect(holdSlider().value).toBe('2000');
    expect(document.getElementById('hold-at-end-value').textContent).toBe('2s');
    expect(durations(app)).toEqual({ B: 0, F: 0, parts: null });
  });

  test('a hold outside 0–10 s is refused on load', async () => {
    const app = await bootApp();
    await app.ready;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const holdAtEndMs of [-1, 10001, 'soon']) {
      expect(await loadSnapshot(app, { coordVersion: 9, waypoints: [], styles: { holdAtEndMs } }), String(holdAtEndMs))
        .toBe(false);
    }
    expect(warn).toHaveBeenCalled();
  });

  test('history follows the gesture: a drag paused half-way is one entry; undo and redo put the hold and F back',
    async () => {
      const { app } = await editorWithCrowd('disappear');
      setHold(2000);
      app.saveUndoState();
      const before = { hold: app.styles.holdAtEndMs, ...durations(app) };
      const entries = app.undoService._undoStack.length;

      // 2 s → 3 s, held past the 400 ms other sliders wait, then on to 5 s and let go.
      moveHold(2600);
      moveHold(3000);
      await new Promise(done => setTimeout(done, 450));
      expect(app.undoService._undoStack.length).toBe(entries);
      moveHold(4100);
      moveHold(5000);
      commitHold();
      await new Promise(done => setTimeout(done, 450));
      expect(app.undoService._undoStack.length).toBe(entries + 1);
      const after = { hold: app.styles.holdAtEndMs, ...durations(app) };
      expect(after.hold).toBe(5000);
      expect(after.F).toBe(before.F + 3000);

      app.undo();
      await settled();
      expect({ hold: app.styles.holdAtEndMs, ...durations(app) }).toEqual(before);
      expect(holdSlider().value).toBe('2000');
      app.redo();
      await settled();
      expect({ hold: app.styles.holdAtEndMs, ...durations(app) }).toEqual(after);
      expect(holdSlider().value).toBe('5000');
      expect(document.getElementById('hold-at-end-value').textContent).toBe('5s');
    });

  test('two separate changes in quick succession are two entries, each undone on its own', async () => {
    const { app } = await editorWithCrowd('disappear');
    setHold(2000);
    app.saveUndoState();
    const entries = app.undoService._undoStack.length;

    setHold(3000);
    setHold(4500);
    expect(app.undoService._undoStack.length).toBe(entries + 2);

    app.undo();
    await settled();
    expect(app.styles.holdAtEndMs).toBe(3000);
    app.undo();
    await settled();
    expect(app.styles.holdAtEndMs).toBe(2000);
  });

  test('keyboard steps: each arrow press is one step, one entry; a pending edit elsewhere keeps its own', async () => {
    const { app } = await editorWithCrowd('disappear');
    setHold(2000);
    app.saveUndoState();
    const entries = app.undoService._undoStack.length;

    // Chromium sends `input` then `change` for each step of an arrow key.
    for (const ms of [2100, 2200, 2300]) setHold(ms);
    expect(app.undoService._undoStack.length).toBe(entries + 3);
    app.undo();
    await settled();
    expect(app.styles.holdAtEndMs).toBe(2200);

    // Graphics scale's own entry waits on its timer; moving the hold first keeps it apart.
    const scale = document.getElementById('graphics-scale');
    scale.value = '50';
    scale.dispatchEvent(new Event('input', { bubbles: true }));
    const scaled = app.styles.graphicsScale;
    setHold(4000);
    app.undo();
    await settled();
    expect([app.styles.holdAtEndMs, app.styles.graphicsScale]).toEqual([2200, scaled]);
  });
});

describe('"Wait here for this crowd" is retired', () => {
  test('no button and no handler; a wait it wrote is a waypoint pause, kept as authored', async () => {
    const app = await bootApp();
    await app.ready;
    expect(document.getElementById('crowd-fit-wait-btn')).toBeNull();
    expect(app.fitRouteWaitToCrowd).toBeUndefined();

    expect(await loadSnapshot(app, {
      coordVersion: 9,
      waypoints: [
        { id: 'one', imgX: 0.1, imgY: 0.5, isMajor: true, pauseMode: 'none', pauseTime: 0 },
        { id: 'two', imgX: 0.9, imgY: 0.5, isMajor: true, pauseMode: 'timed', pauseTime: 27161 },
      ],
      animationState: { mode: 'constant-speed', speed: 200, duration: 0 },
    })).toBe(true);
    await settled();
    expect(app.waypoints[1]).toMatchObject({ pauseMode: 'timed', pauseTime: 27161 });
    expect(app.animationEngine.totalPauseTime).toBeGreaterThanOrEqual(27161);
    expect(app._buildProjectSnapshot().waypoints[1].pauseTime).toBe(27161);
  });
});
