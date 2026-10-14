/**
 * CROWD-08 part A — the base timeline with no route, and the Duration
 * control that sets it.
 *
 * A project with no route keeps a positive base timeline: Clear All sets it
 * to zero, and an authored edit that leaves a crowd, fewer than two route
 * waypoints and none (adding a crowd, deleting route waypoints below two,
 * opening a project) gives it `ANIMATION.DEFAULT_DURATION`, in that edit's
 * undo step; a positive one is kept, undo and redo restore what they kept.
 * With no route the Duration slider sets it directly, 1 s to 5 min on a log
 * scale (the owner's "1 s to 5 min (Recommended)"), one history entry per
 * committed gesture, its hint saying so; with a route it is the route speed,
 * exactly as before. Expected values here are worked out by hand, never read
 * back from the mapping under test.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { allowConsole } from './helpers/consoleGuard.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import {
  PLAY_OFF, PLAY_ON, blankProject, byId, drawCrowd, editor, playState, press, settled,
} from './helpers/noRouteScene.js';
import { clearProject } from '../src/app/projectReset.js';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.getItem.mockImplementation(() => null);
});

const base = app => app.animationEngine.state.baseDuration;
const slider = () => byId('animation-speed-right');
/** Past the 400 ms a card's history entry waits for. */
const committed = () => new Promise(resolve => setTimeout(resolve, 450));

/** Move the Duration thumb as the pointer does (`input`), and let it go (`change`). */
function moveDuration(position) {
  slider().value = String(position);
  slider().dispatchEvent(new Event('input', { bubbles: true }));
}
function letGoDuration() {
  slider().dispatchEvent(new Event('change', { bubbles: true }));
}

/** A crowd on one waypoint: a two-node network the dots walk, saved with `duration` as its base. */
function crowdProject(duration, { waypoints = [{ id: 'w1', imgX: 0.5, imgY: 0.5, isMajor: true }] } = {}) {
  return {
    coordVersion: 9,
    waypoints,
    animationState: { mode: 'constant-speed', speed: 200, duration },
    scene: {
      flowLayers: [{
        id: 'crowd', name: 'Fans', guideType: 'graph',
        graph: {
          nodes: [{ id: 'in', x: 0.2, y: 0.5, type: 'entry' }, { id: 'out', x: 0.8, y: 0.5, type: 'exit' }],
          edges: [{ id: 'p', sourceId: 'in', targetId: 'out', direction: 'one-way' }],
        },
        emitters: [{ id: 'e', seed: 4, dotCount: 10, lifecycleMode: 'collect' }],
      }],
    },
  };
}

/** Open `project` as a file (its archive read as the app reads one). */
async function openFile(app, project) {
  vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValueOnce({
    projectData: project, imageAssets: [], backgroundBase64: null,
  });
  return app.loadProject(new File([''], 'project.zip'));
}

describe('the base timeline (§3.3, §5.2, §12.1)', () => {
  test('Clear All → 0; a crowd added → 10 s in its own undo step; undone → no crowd and 0; redone → 10 s', async () => {
    const app = await blankProject();
    expect(base(app)).toBe(0);
    byId('add-crowd-btn').click();
    expect(base(app)).toBe(10000);
    app.undo();
    expect(app.scene.getFlowLayers()).toEqual([]);
    expect(base(app)).toBe(0);
    app.redo();
    expect(app.scene.getFlowLayers()).toHaveLength(1);
    expect(base(app)).toBe(10000);
  });

  test('a crowd added to a project whose base is already positive keeps it', async () => {
    const app = await blankProject();
    moveDuration(2256); // 25.0 s, worked out below
    letGoDuration();
    expect(base(app)).toBe(25000);
    byId('add-crowd-btn').click();
    expect(base(app)).toBe(25000);
    // The new project at start-up has the default already: kept as it is.
    const started = await editor();
    expect(started.waypoints).toHaveLength(0);
    expect(base(started)).toBe(10000);
    byId('add-crowd-btn').click();
    expect(base(started)).toBe(10000);
  });

  test.each([
    ['a file', openFile],
    ['browser recovery', (app, project) => loadCurrentSnapshot(app, project)],
    ['a built-in example', async (app, project) => {
      // Examples open through the file path (`loadExampleProject` → `loadProject`); its archive stands in.
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => new Blob(['zip']) });
      vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValueOnce({
        projectData: project, imageAssets: [], backgroundBase64: null,
      });
      return app.loadExampleProject('uon-open-day');
    }],
  ])('opened from %s: a crowd, one waypoint and no base → 10 s, unchanged otherwise, and not marked changed',
    async (name, open) => {
      const app = await editor();
      // Whether opening marks a project changed is the path's own; the default alone adds nothing to it.
      expect(await open(app, crowdProject(25000))).toBe(true);
      const dirtyAsOpened = app._isDirty;
      expect(await open(app, crowdProject(0))).toBe(true);
      expect(base(app)).toBe(10000);
      expect(app._isDirty).toBe(dirtyAsOpened);
      if (name !== 'browser recovery') expect(app._isDirty).toBe(false); // a file is marked clean as it opens
      expect(app.undoService._undoStack).toHaveLength(1);
      expect(JSON.parse(app.undoService._undoStack[0]).baseDurationMs).toBe(10000);
      await settled();
      expect(playState()).toEqual(PLAY_ON);

      expect(await open(app, crowdProject(25000))).toBe(true);
      expect(base(app)).toBe(25000);
      // With no crowd there is nothing to time: a project of one waypoint opens with what it saved.
      const empty = crowdProject(0);
      empty.scene.flowLayers = [];
      expect(await open(app, empty)).toBe(true);
      expect(base(app)).toBe(0);
      // With a route the route times it, as before.
      expect(await open(app, crowdProject(0, { waypoints: [
        { id: 'a', imgX: 0.2, imgY: 0.3, isMajor: true }, { id: 'b', imgX: 0.7, imgY: 0.6, isMajor: true },
      ] }))).toBe(true);
      expect(base(app)).toBe(0); // until the route's own rebuild, 50 ms on
      await settled();
      expect(base(app)).toBeGreaterThan(0);
    });

  test('undoing back to an opened crowd-only project restores its base; a failed open leaves the base as it was', async () => {
    const app = await editor();
    expect(await openFile(app, crowdProject(25000))).toBe(true);
    moveDuration(1001); // 4.2 s
    letGoDuration();
    expect(base(app)).toBe(4200);
    app.undo();
    expect(base(app)).toBe(25000);
    expect(slider().value).toBe('2256');
    app.redo();
    expect(base(app)).toBe(4200);

    // A load whose commit fails late rolls back: the base, the thumb and Play as they were.
    allowConsole(/Failed to load project/);
    vi.spyOn(app, 'pruneImageAssets').mockImplementationOnce(() => {
      throw new Error('the commit failed after the project switched');
    });
    expect(await openFile(app, crowdProject(0, { waypoints: [] }))).toBe(false);
    expect(base(app)).toBe(4200);
    // The thumb put back where 4.2 s sits: 1 + 3995 × ln 4.2 / ln 300 = 1006.18 → 1 + 5 × 201 = 1006.
    expect(slider().value).toBe('1006');
    await settled();
    expect(playState()).toEqual(PLAY_ON);
  });

  test.each(['constant-speed', 'constant-time'])(
    'two coincident waypoints (no base) with a crowd, one deleted → 10 s in the deletion\'s step; Play and export at once (%s)',
    async (mode) => {
      const app = await blankProject();
      const { layer } = drawCrowd(app);
      await settled();
      app.animationEngine.setMode(mode);
      app.eventBus.emit('waypoint:add', { imgX: 0.4, imgY: 0.4, isMajor: true });
      app.eventBus.emit('waypoint:add', { imgX: 0.4, imgY: 0.4, isMajor: true });
      app.invalidateAnimationTiming();
      expect(base(app)).toBe(0);
      expect(layer.graph.getEdges()).toHaveLength(1);

      app.eventBus.emit('waypoint:delete', app.waypoints[1]);
      expect(base(app)).toBe(10000);
      expect(JSON.parse(app.undoService._undoStack.at(-1)).baseDurationMs).toBe(10000);
      // Straight after, before the 50 ms the scene end waits: both play.
      press(' ');
      expect(app.animationEngine.isPlaying()).toBe(true);
      expect(app.animationEngine.state.duration).toBe(12000);
      app.animationEngine.pause();
      expect(byId('export-mp4-btn').getAttribute('aria-disabled')).toBeNull();

      app.undo();
      expect(app.waypoints).toHaveLength(2);
      app.invalidateAnimationTiming();
      expect(base(app)).toBe(0);
      app.redo();
      expect(app.waypoints).toHaveLength(1);
      expect(base(app)).toBe(10000);
      await settled();
      expect(playState()).toEqual(PLAY_ON);
    });

  test.each(['constant-speed', 'constant-time'])(
    'through two waypoints and back, each way, undone and redone: the route times it, the no-route base comes back (%s)',
    async (mode) => {
      const app = await editor();
      expect(await openFile(app, { ...crowdProject(25000), animationState: { mode, speed: 200, duration: 25000 } }))
        .toBe(true);
      expect(base(app)).toBe(25000);
      app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.9, isMajor: true });
      await settled(); // the route's rebuild, 50 ms on
      const routed = base(app);
      // Constant speed rebuilds the base from the route; constant time keeps the author's (DEF-06).
      if (mode === 'constant-speed') expect(routed).not.toBe(25000);
      else expect(routed).toBe(25000);
      expect(JSON.parse(app.undoService._undoStack.at(-1)).baseDurationMs).toBeUndefined();

      app.undo();
      expect(app.waypoints).toHaveLength(1);
      expect(base(app)).toBe(25000);
      expect(slider().value).toBe('2256');
      app.redo();
      await settled();
      expect(base(app)).toBe(routed);

      // Down from two to one: the route's base stays as the crowds' timeline, in the deletion's entry.
      app.eventBus.emit('waypoint:delete', app.waypoints[1]);
      expect(base(app)).toBe(routed);
      expect(JSON.parse(app.undoService._undoStack.at(-1)).baseDurationMs).toBe(routed);
      app.undo();
      await settled();
      app.redo();
      expect(base(app)).toBe(routed);
    });
});

describe('the Duration control with no route (§4.3, §9.3, §10.6)', () => {
  /*
   * Worked out by hand, p the slider position (1 … 3996 reachable), the base
   * 1 s × 300^((p − 1) / 3995), rounded to 0.1 s:
   *   p = 1    → 300^0 = 1                         → 1.0 s
   *   p = 3996 → 300^1                             → 300.0 s
   *   p = 1001 → 300^(1000/3995) = e^(0.250313 × 5.703782) = e^1.427731 = 4.1692 → 4.2 s
   *   p = 2001 → 300^(2000/3995) = e^(0.500626 × 5.703782) = e^2.855462 = 17.3824 → 17.4 s
   * and back, to the nearest position the slider takes (1 + 5k):
   *   10 s → 1 + 3995 × ln 10 / ln 300 = 1 + 3995 × 0.403694 = 1613.76 → k = 322.55 → 323 → 1616
   *   25 s → 1 + 3995 × ln 25 / ln 300 = 1 + 3995 × 0.564338 = 2255.54 → k = 450.91 → 451 → 2256
   */
  // Reopened, the thumb is where the saved base sits: 4.2 s at 1006 (1 + 3995 × ln 4.2 / ln 300 = 1006.18), not
  // 1001, since 0.1 s is coarser there than one step of the slider.
  test.each([[1, 1000, 1], [3996, 300000, 3996], [1001, 4200, 1006], [2001, 17400, 2001]])(
    'position %i sets %i ms, which saves, reopens and puts the thumb at %i', async (position, ms, reopened) => {
      const app = await blankProject();
      drawCrowd(app);
      await settled();
      moveDuration(position);
      letGoDuration();
      expect(base(app)).toBe(ms);
      const saved = app._buildProjectSnapshot({ includeAssets: false });
      expect(saved.animationState.duration).toBe(ms);

      const other = await editor();
      expect(await loadCurrentSnapshot(other, saved)).toBe(true);
      expect(base(other)).toBe(ms);
      expect(slider().value).toBe(String(reopened));
    });

  test('10 s and 25 s put the thumb at 1616 and 2256; the readout shows the playback time', async () => {
    const app = await blankProject();
    byId('add-crowd-btn').click();
    expect(base(app)).toBe(10000);
    expect(slider().value).toBe('1616');
    const opened = await editor();
    expect(await openFile(opened, crowdProject(25000))).toBe(true);
    expect(slider().value).toBe('2256');
    await settled();
    // Collect dots finish after the timeline, so the readout (the playback time) is past 25 s.
    expect(opened.animationEngine.state.duration).toBeGreaterThan(25000);
    expect(byId('animation-speed-value-right').textContent)
      .toBe(`${Math.round(opened.animationEngine.state.duration / 100) / 10}s`);
  });

  test.each([[500, '1'], [500000, '3996']])(
    'a stored base of %i ms, past the slider\'s reach, is kept and played; the thumb sits at the end; a move rewrites it',
    async (ms, end) => {
      const app = await editor();
      expect(await openFile(app, crowdProject(ms))).toBe(true);
      await settled();
      expect(base(app)).toBe(ms);
      expect(slider().value).toBe(end);
      expect(app.animationEngine.sceneEndParts.routeMs).toBe(ms);
      app.syncDurationThumb();
      app.eventBus.emit('animation:reset');
      expect(base(app)).toBe(ms); // syncing the thumb never rewrites it
      moveDuration(Number(end));
      letGoDuration();
      expect(base(app)).toBe(end === '1' ? 1000 : 300000);
    });

  test('one history entry per committed gesture; input alone makes none; undo and redo; autosaved', async () => {
    const app = await blankProject();
    drawCrowd(app);
    await committed();
    const entries = app.undoService._undoStack.length;
    const save = vi.spyOn(app, 'autoSave');
    moveDuration(1001);
    moveDuration(2001);
    await committed();
    expect(app.undoService._undoStack.length).toBe(entries);
    expect(base(app)).toBe(17400);
    expect(save).toHaveBeenCalledTimes(2);
    letGoDuration();
    expect(app.undoService._undoStack.length).toBe(entries + 1);
    // A keyboard step is one gesture: input then change.
    moveDuration(2006);
    letGoDuration();
    expect(app.undoService._undoStack.length).toBe(entries + 2);
    const keyed = base(app);
    expect(keyed).toBe(17500);
    app.undo();
    expect(base(app)).toBe(17400);
    expect(slider().value).toBe('2001');
    app.undo();
    expect(base(app)).toBe(10000);
    app.redo();
    app.redo();
    expect(base(app)).toBe(keyed);
    // The end is measured again with each move: the timeline and the hold, for a crowd that never finishes.
    expect(app.animationEngine.state.duration).toBe(keyed + 2000);
  });

  test('with a route, the slider is the route speed exactly as before: no timeline event, no change history', async () => {
    const app = await editor();
    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
    const sent = [];
    app.eventBus.on('animation:speed-change', speed => sent.push(['speed', speed]));
    app.eventBus.on('animation:base-duration-change', change => sent.push(['base', change]));
    const entries = app.undoService._undoStack.length;
    moveDuration(1001);
    letGoDuration();
    // sliderToSpeed(1001): 1 × 4000^(1 − 1000/3999) = 4000^0.749937
    //   = e^(0.749937 × 8.294050) = e^6.220014 = 502.7 → 503.
    expect(sent).toEqual([['speed', 503]]);
    expect(app.undoService._undoStack.length).toBe(entries);
    expect(app.animationEngine.state.speed).toBe(505); // the engine's step of 5
  });

  test('its hint says what it sets, swapped as the route crosses two waypoints; the description follows', async () => {
    const ROUTED = 'Total animation playback time. Changing it speeds up or slows down every leg alike. '
      + 'The end waits for crowds and beacons that are still finishing';
    const ROUTELESS = 'Sets the timeline the crowds release across. Dots keep their own speed. '
      + 'The time shown includes crowds still finishing and Hold at end';
    const app = await blankProject();
    const tip = byId('animation-speed-right').closest('label').querySelector('[data-tip]');
    const description = () => byId(tip.getAttribute('data-tip-desc')).textContent;
    expect(tip.getAttribute('data-tip')).toBe(ROUTELESS);
    await Promise.resolve();
    expect(description()).toBe(ROUTELESS);
    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
    expect(tip.getAttribute('data-tip')).toBe(ROUTELESS);
    app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
    expect(tip.getAttribute('data-tip')).toBe(ROUTED);
    await Promise.resolve();
    expect(description()).toBe(ROUTED);
    app.eventBus.emit('waypoint:delete', app.waypoints[1]);
    expect(tip.getAttribute('data-tip')).toBe(ROUTELESS);
    await Promise.resolve();

    // Open, by the keyboard on its "?", it follows the swap too.
    const descriptionId = tip.getAttribute('data-tip-desc');
    const trigger = document.querySelector(`.param-hint-trigger[aria-describedby="${descriptionId}"]`);
    const popup = () => byId('param-tooltip');
    const shown = () => (popup()?.style.display === 'block' ? popup().textContent : null);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    trigger.focus();
    expect(shown()).toBe(ROUTELESS);
    app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.9, isMajor: true });
    await Promise.resolve();
    expect(shown()).toBe(ROUTED);
    trigger.blur();
  });

  test('the Comet trail line shows in comet mode with a route only, and comes back when the route does', async () => {
    const app = await editor();
    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
    const visibility = byId('path-visibility');
    visibility.value = 'instantaneous';
    visibility.dispatchEvent(new Event('change', { bubbles: true }));
    const line = byId('pacing-comet-hint');
    expect(line.hidden).toBe(false);
    expect(line.textContent.trim()).toBe(
      'In Preview, a non-zero Comet trail extends Duration while the tail clears after the route head reaches the end.');
    app.eventBus.emit('waypoint:delete', app.waypoints[1]);
    expect(line.hidden).toBe(true);
    app.undo();
    expect(line.hidden).toBe(false);
    // And out of comet mode, hidden by its own rule, as before.
    visibility.value = 'always-show';
    visibility.dispatchEvent(new Event('change', { bubbles: true }));
    expect(line.hidden).toBe(true);
  });

  test('the thumb follows the project: on Clear All, on an animation reset, and as the route crosses two waypoints', async () => {
    const app = await blankProject();
    expect(slider().value).toBe('1'); // no timeline: the near end
    byId('add-crowd-btn').click();
    expect(slider().value).toBe('1616');
    app.eventBus.emit('animation:reset');
    expect(slider().value).toBe('1616');
    app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
    // The route's speed, by the route's own inverse: 1 + 3999 × (1 − ln speed / ln 4000), rounded.
    const speed = app.animationEngine.state.speed;
    expect(slider().value).toBe(String(Math.round(1 + 3999 * (1 - Math.log(speed) / Math.log(4000)))));
    app.eventBus.emit('waypoint:delete', app.waypoints[1]);
    expect(slider().value).toBe(String(baseToPosition(base(app))));
    clearProject(app);
    expect(slider().value).toBe('1');
  });

  test('the no-route Duration can flip a dot whose finish rounds to its onset, and Play follows', async () => {
    const app = await blankProject();
    const { layer, entry, exit } = drawCrowd(app, { entry: { x: 0.5, y: 0.5 }, exit: { x: 0.6, y: 0.5 } });
    // The Exit moved to 4e-13 past the Entry, its one dot released at the window's middle.
    exit.x = 0.5 + 4e-13;
    layer.graph.getEdges()[0].setDirection('one-way');
    void entry;
    const length = app.swarmEngine.edgeGeometry(layer.graph, layer.graph.getEdges()[0]).length;
    // A journey of 6.8e-13 ms: past half the spacing of doubles at 5,000 ms, short of it at 10,000 ms.
    layer.emitters[0].update({
      lifecycleMode: 'disappear', dotCount: 1, speedVariance: 0, onsetVariance: 0,
      releaseStart: 0.5, releaseDuration: 0, speed: (length * 1000) / 6.8e-13,
    });
    app.eventBus.emit('network:changed', { commit: true });
    await settled();
    expect(base(app)).toBe(10000);
    expect(playState()).toEqual(PLAY_ON);
    // About 20 s: released past 8,192 ms, where the spacing of doubles (1.8e-12 ms) swallows its journey.
    const position = baseToPosition(20000);
    moveDuration(position);
    letGoDuration();
    expect(base(app)).toBe(positionToBase(position));
    expect(base(app)).toBeGreaterThanOrEqual(16384);
    expect(playState()).toEqual(PLAY_OFF);
    app.undo();
    expect(playState()).toEqual(PLAY_ON);
  });
});

/** The base for a thumb position, worked out as above: 1 s × 300^((p − 1) / 3995), to 0.1 s. */
function positionToBase(position) {
  return Math.round(Math.pow(300, (position - 1) / 3995) * 10) * 100;
}

/** The thumb position for a base, worked out as above: 1 + 5k nearest 1 + 3995 × ln(s) / ln 300. */
function baseToPosition(ms) {
  const exact = 1 + 3995 * Math.log(Math.min(300, Math.max(1, ms / 1000))) / Math.log(300);
  return 1 + 5 * Math.round((exact - 1) / 5);
}
