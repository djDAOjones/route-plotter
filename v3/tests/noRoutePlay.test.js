/**
 * CROWD-08 part A (closes DEF-84 by playing) — Play with no route.
 *
 * With fewer than two route waypoints and a crowd the engine can draw, Play
 * (the button, Space, K, J and L) plays the crowds over the base timeline,
 * and the end waits for those that finish (CROWD-05). With nothing to play,
 * Play is disabled and described by a visible line in the owner's words, and
 * every keyboard start is refused once, aloud, changing nothing; a pause is
 * never refused. The state follows every edit that can change it, without a
 * reload, and the Guide card's sentence says the same thing Play does.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  PLAY_OFF, PLAY_ON, PLAY_REASON, announcements, blankProject, byId, drawCrowd, editor, playState, press, settled,
} from './helpers/noRouteScene.js';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.getItem.mockImplementation(() => null);
});

/** Past the 400 ms a card's history entry waits for (`saveUndoStateDebounced`). */
const committed = () => new Promise(resolve => setTimeout(resolve, 450));

/** The engine's transport, as the listeners leave it. */
const transport = app => ({
  playing: app.animationEngine.isPlaying(),
  speed: app.animationEngine.state.playbackSpeed,
  jklDirection: app.jklDirection,
  jklSpeed: app.jklSpeed,
});

/** The latest instant a crowd dot finishes, from the engine's schedule (CROWD-05's sum), or 0. */
function lastFinish(app, layer) {
  const base = app.animationEngine.state.baseDuration;
  return Math.max(0, ...app.swarmEngine.scheduleDots(layer, { durationMs: base })
    .filter(dot => dot.finishes && dot.ends)
    .map(dot => dot.onsetFraction * base + dot.journeyMs));
}

describe('a crowd drawn with no route plays (§5.1)', () => {
  test('from a blank project: Play on, its line gone; the button, Space, K, L and J each start it', async () => {
    const app = await blankProject();
    expect(playState()).toEqual(PLAY_OFF);
    drawCrowd(app);
    await settled();
    expect(playState()).toEqual(PLAY_ON);
    expect(app.animationEngine.state.baseDuration).toBe(10000);

    const starts = {
      button: () => byId('play-btn').click(),
      Space: () => press(' '),
      K: () => press('k'),
      L: () => press('l'),
      J: () => { app.animationEngine.seekToProgress(0.5); press('j'); },
    };
    const started = {};
    for (const [name, start] of Object.entries(starts)) {
      app.animationEngine.pause();
      start();
      started[name] = app.animationEngine.isPlaying();
    }
    app.animationEngine.pause();
    expect(started).toEqual({ button: true, Space: true, K: true, L: true, J: true });
  });

  test('the end waits for the crowd\'s last finish, then Hold at end: max(base, finish, beacons) plus the hold', async () => {
    const app = await blankProject();
    const { layer } = drawCrowd(app);
    layer.emitters[0].update({ lifecycleMode: 'disappear', speed: 0.05 });
    app.eventBus.emit('crowd:param-changed', { journeys: false });
    await settled();
    const engine = app.animationEngine;
    const finish = lastFinish(app, layer);
    expect(finish).toBeGreaterThan(engine.state.baseDuration); // slow: it finishes after the timeline
    const holdMs = app.styles.holdAtEndMs;
    expect(holdMs).toBe(2000); // a new project's
    expect(engine.state.duration).toBe(Math.max(engine.state.baseDuration, finish) + holdMs);
    expect(engine.sceneEndParts).toEqual({
      routeMs: engine.state.baseDuration, crowdsMs: finish, beaconsMs: 0, holdMs,
    });
    // The breakdown names the timeline, not a route it does not have (§9.4).
    expect(byId('pacing-duration-breakdown').textContent).toBe(
      `Ends at ${(engine.state.duration / 1000).toFixed(1)} s — timeline 10.0 s, `
      + `crowds finish +${((finish - 10000) / 1000).toFixed(1)} s, hold at end +2.0 s`);

    // Played to its end: the transport stops there, at the scene's end.
    engine.seekToTime(engine.state.duration - 30);
    byId('play-btn').click();
    engine.updateAnimation(60);
    expect(engine.isPlaying()).toBe(false);
    expect(engine.state.currentTime).toBe(engine.state.duration);
  });

  test('with no crowd that finishes, the end is the timeline and the hold, and the line names the timeline', async () => {
    const app = await blankProject();
    drawCrowd(app); // Respawn, a new crowd's
    await settled();
    expect(app.animationEngine.state.duration).toBe(12000);
    expect(byId('pacing-duration-breakdown').textContent)
      .toBe('Ends at 12.0 s — timeline 10.0 s, hold at end +2.0 s');
  });
});

describe('the transport with no route (§9.7)', () => {
  let frames;
  let originals;
  beforeEach(() => {
    originals = [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame];
    let nextId = 1;
    let now = 0;
    const pending = new Map();
    frames = {
      pending,
      request: vi.fn(callback => { const id = nextId++; pending.set(id, callback); return id; }),
      cancel: vi.fn(id => { pending.delete(id); }),
      run(count) {
        for (let ran = 0; ran < count && pending.size > 0; ran += 1) {
          const [id, callback] = pending.entries().next().value;
          pending.delete(id);
          now += 20;
          callback(now);
        }
      },
      settle(limit = 50) {
        let ran = 0;
        while (pending.size > 0 && ran < limit) { frames.run(1); ran += 1; }
        return ran;
      },
    };
    globalThis.requestAnimationFrame = frames.request;
    globalThis.cancelAnimationFrame = frames.cancel;
  });
  afterEach(() => {
    [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = originals;
  });

  test('L plays forward, time advancing; K pauses; J from mid-timeline runs back; nothing stays queued after', async () => {
    const app = await blankProject();
    drawCrowd(app);
    await settled();
    const engine = app.animationEngine;
    frames.settle();

    engine.seekToTime(2000);
    press('l');
    frames.run(5);
    expect(engine.isPlaying()).toBe(true);
    expect(engine.state.currentTime).toBeGreaterThan(2000);
    press('k');
    expect(engine.isPlaying()).toBe(false);
    frames.settle();
    expect(frames.pending.size).toBe(0);

    engine.seekToTime(6000);
    press('j');
    frames.run(5);
    expect(engine.isPlaying()).toBe(true);
    expect(engine.state.playbackSpeed).toBe(-1);
    expect(engine.state.currentTime).toBeLessThan(6000);
    press('k');
    expect(engine.isPlaying()).toBe(false);
    frames.settle();
    expect(frames.pending.size).toBe(0);

    // A forward run to the end stops there, and queues nothing more.
    engine.seekToTime(engine.state.duration - 100);
    press('l');
    frames.run(20);
    expect(engine.isPlaying()).toBe(false);
    expect(engine.state.currentTime).toBe(engine.state.duration);
    frames.settle();
    expect(frames.pending.size).toBe(0);
  });
});

describe('nothing to play: Play off with its reason, every start refused once (§5.4)', () => {
  /** The four projects with nothing to play. */
  const NOTHING = {
    'a blank project': async () => blankProject(),
    'a crowd with an empty network': async () => {
      const app = await blankProject();
      byId('add-crowd-btn').click();
      return app;
    },
    'a crowd with nodes but no path': async () => {
      const app = await blankProject();
      byId('add-crowd-btn').click();
      byId('network-edit-btn').click();
      const pen = app.networkEditService;
      pen.placeNode({ x: 0.2, y: 0.5 });
      pen.placeNode({ x: 0.8, y: 0.5 }); // linked from the first
      pen.deleteEdge(app.selectedCrowd.graph.getEdges()[0]);
      pen.exit();
      return app;
    },
    'a Follow route crowd with no route': async () => {
      const app = await blankProject();
      byId('add-crowd-btn').click();
      const guide = byId('crowd-guide-type');
      guide.value = 'route';
      guide.dispatchEvent(new Event('change', { bubbles: true }));
      return app;
    },
  };

  test.each(Object.keys(NOTHING))('%s', async (name) => {
    const app = await NOTHING[name]();
    if (name === 'a crowd with nodes but no path') {
      expect(app.selectedCrowd.graph.getNodes()).toHaveLength(2);
      expect(app.selectedCrowd.graph.getEdges()).toEqual([]);
    }
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    expect(byId('play-reason').closest('.controls')).not.toBeNull(); // under the playbar
    const described = byId('play-btn').getAttribute('aria-describedby').split(' ')
      .map(id => byId(id)?.textContent);
    expect(described).toEqual([PLAY_REASON]);

    const before = transport(app);
    const { said, spy } = announcements(app);
    const presses = [
      () => press(' '), () => press('k'), () => press('j'), () => press('l'),
      () => app.eventBus.emit('ui:animation:play'),
    ];
    presses.forEach((start, index) => {
      start();
      expect(app.animationEngine.isPlaying(), `press ${index}`).toBe(false);
      expect(said(PLAY_REASON), `press ${index}`).toBe(index + 1);
      expect(transport(app), `press ${index}`).toEqual(before);
    });
    // One announcement per refused press, through the announcer, and no toast.
    expect(spy).toHaveBeenCalledTimes(presses.length);
  });

  test('with Help open, Space announces nothing: the dialog\'s guard stands first (PR 7)', async () => {
    const app = await blankProject();
    const { spy } = announcements(app);
    app.showHelp();
    press(' ');
    expect(spy).not.toHaveBeenCalled();
    expect(app.animationEngine.isPlaying()).toBe(false);
  });

  test('a pause is never refused: playing, the scene made unplayable through the model, Space pauses', async () => {
    const app = await blankProject();
    const { layer, path } = drawCrowd(app);
    await settled();
    press(' ');
    expect(app.animationEngine.isPlaying()).toBe(true);
    layer.graph.removeEdge(path.id);
    app.eventBus.emit('network:changed', { commit: true });
    expect(app.canPlayScene()).toBe(false);
    const { said } = announcements(app);
    press(' ');
    expect(app.animationEngine.isPlaying()).toBe(false);
    expect(said(PLAY_REASON)).toBe(0);
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
  });
});

describe('Play follows every change, without a reload (§5.5, §9.8, §11.4)', () => {
  test('the path drawn and deleted, two route waypoints added and one deleted, each undone and redone', async () => {
    const app = await blankProject();
    byId('add-crowd-btn').click();
    byId('network-edit-btn').click();
    const pen = app.networkEditService;
    pen.placeNode({ x: 0.2, y: 0.5 });
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    pen.placeNode({ x: 0.8, y: 0.5 }); // linked from the first: the path
    await settled();
    expect(playState()).toEqual(PLAY_ON);
    pen.deleteEdge(app.selectedCrowd.graph.getEdges()[0]);
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    app.undo();
    await settled();
    expect(playState()).toEqual(PLAY_ON);
    app.redo();
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    pen.exit();

    // A route: two waypoints play whatever the crowds, one does not.
    const route = await blankProject();
    route.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.3, isMajor: true });
    expect(playState()).toEqual(PLAY_OFF);
    route.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.6, isMajor: true });
    expect(playState()).toEqual(PLAY_ON);
    route.eventBus.emit('waypoint:delete', route.waypoints[1]);
    expect(playState()).toEqual(PLAY_OFF);
    route.undo();
    expect(playState()).toEqual(PLAY_ON);
    route.redo();
    expect(playState()).toEqual(PLAY_OFF);
  });

  test('a hidden crowd still plays (§4.1), is not drawn, and does not extend the end', async () => {
    const app = await blankProject();
    const { layer } = drawCrowd(app);
    layer.emitters[0].update({ lifecycleMode: 'disappear', speed: 0.05 });
    app.eventBus.emit('crowd:param-changed', { journeys: false });
    await settled();
    const shown = app.animationEngine.state.duration;
    expect(shown).toBeGreaterThan(12000);

    layer.visible = false;
    app.eventBus.emit('scene:semantic-changed', { kind: 'crowd-visibility', layerId: layer.id });
    await settled();
    expect(playState()).toEqual(PLAY_ON);
    expect(app.canPlayScene()).toBe(true);
    expect(app.animationEngine.state.duration).toBe(12000); // the timeline and the hold, no wait for it
    const evaluate = vi.spyOn(app.swarmEngine, 'evaluate');
    app.animationEngine.seekToTime(6000);
    app.render();
    expect(evaluate).not.toHaveBeenCalled();
    press(' ');
    expect(app.animationEngine.isPlaying()).toBe(true);
  });

  test('several crowds and emitters: Play stays on until the last one that can be drawn goes', async () => {
    const app = await blankProject();
    const first = drawCrowd(app);
    const second = drawCrowd(app, { entry: { x: 0.3, y: 0.2 }, exit: { x: 0.3, y: 0.8 } });
    second.layer.addEmitter({ dotCount: 3, lifecycleMode: 'collect' });
    app.eventBus.emit('crowd:param-changed');
    await settled();
    expect(playState()).toEqual(PLAY_ON);
    app.deleteCrowd(first.layer);
    await settled();
    expect(playState()).toEqual(PLAY_ON);
    app.deleteCrowd(second.layer);
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    app.undo();
    await settled();
    expect(playState()).toEqual(PLAY_ON);
  });

  test('switching a crowd between Follow route and Custom network', async () => {
    const app = await blankProject();
    drawCrowd(app);
    await settled();
    const guide = byId('crowd-guide-type');
    guide.value = 'route';
    guide.dispatchEvent(new Event('change', { bubbles: true }));
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    guide.value = 'graph';
    guide.dispatchEvent(new Event('change', { bubbles: true }));
    await settled();
    expect(playState()).toEqual(PLAY_ON);
  });

  test('a node\'s type and a path\'s direction: the Entry made unable to leave refuses a Disappear crowd', async () => {
    const app = await blankProject();
    const { layer, entry, exit, path } = drawCrowd(app);
    layer.emitters[0].update({ lifecycleMode: 'disappear' });
    app.eventBus.emit('crowd:param-changed', { journeys: false });
    await settled();
    expect(playState()).toEqual(PLAY_ON);

    // One way, from the Exit to the Entry: no dot can leave the Entry.
    byId('network-edit-btn').click();
    const pen = app.networkEditService;
    pen.selectEdge(path);
    pen.setSelectedEdgeDirection('one-way');
    if (path.sourceId === entry.id) pen.swapSelectedEdgeDirection();
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    pen.swapSelectedEdgeDirection();
    await settled();
    expect(playState()).toEqual(PLAY_ON);

    // The two nodes' types traded: the one-way path now leads into the Entry, so no dot can leave it.
    pen.selectNode(entry);
    pen.setSelectedNodeType('exit');
    pen.selectNode(exit);
    pen.setSelectedNodeType('entry');
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    // Undone once, the far node is an Exit again: with no Entry, dots set off from the node a path leaves.
    app.undo();
    await settled();
    expect(playState()).toEqual(PLAY_ON);
    pen.exit();
  });

  test('Play pressed at once after an edit, before the 50 ms scene-end debounce, plays the scene as it stands', async () => {
    const app = await blankProject();
    byId('add-crowd-btn').click();
    byId('network-edit-btn').click();
    const pen = app.networkEditService;
    pen.placeNode({ x: 0.2, y: 0.5 });
    pen.placeNode({ x: 0.8, y: 0.5 });
    pen.exit();
    // No wait: the scene end is still queued, and Play's button not yet refreshed.
    expect(app._sceneEndTimeout).toBeTruthy();
    press(' ');
    expect(app.animationEngine.isPlaying()).toBe(true);
    expect(app._sceneEndTimeout).toBeNull();
    expect(app.animationEngine.state.duration).toBe(12000);
    expect(playState()).toEqual(PLAY_ON);
  });
});

describe('edits that change what can be drawn without changing the network\'s shape (§11.4)', () => {
  /** A Disappear crowd on a network with a blocked Entry beside a productive one. */
  async function mixedCrowd() {
    const app = await blankProject();
    const { layer, entry, exit } = drawCrowd(app);
    // A second Entry with no way out, after the first: dots split between them by seed.
    const blocked = layer.graph.addNode({ x: 0.5, y: 0.9, type: 'entry' });
    layer.graph.addEdge({ sourceId: exit.id, targetId: blocked.id, direction: 'one-way' });
    layer.emitters[0].update({ lifecycleMode: 'disappear', dotCount: 1 });
    app.eventBus.emit('network:changed', { commit: true });
    await settled();
    return { app, layer, entry, blocked };
  }
  /** A seed whose one dot picks `which` Entry, read off the evaluator at its onset. */
  function seedFor(app, layer, productive) {
    const emitter = layer.emitters[0];
    const kept = emitter.seed;
    for (let seed = 1; seed < 500; seed += 1) {
      emitter.update({ seed });
      if (app.canPlayScene() === productive) {
        emitter.update({ seed: kept });
        return seed;
      }
    }
    throw new Error('no seed found');
  }

  test('At journey end: blocked Disappear → Collect is drawn (parked) and back; undone and redone', async () => {
    const { app, layer } = await mixedCrowd();
    const blockedSeed = seedFor(app, layer, false);
    byId('crowd-seed-value').value = String(blockedSeed);
    byId('crowd-seed-value').dispatchEvent(new Event('change', { bubbles: true }));
    await settled();
    expect(playState()).toEqual(PLAY_OFF);

    const select = byId('crowd-lifecycle');
    select.value = 'collect';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await committed(); // the select's history entry is debounced (400 ms)
    expect(playState()).toEqual(PLAY_ON);
    select.value = 'disappear';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await committed();
    expect(playState()).toEqual(PLAY_OFF);
    app.undo();
    await settled();
    expect(playState()).toEqual(PLAY_ON);
    app.redo();
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
  });

  test('a typed seed and Re-roll move the dot between the Entries; the export items follow', async () => {
    const { app, layer } = await mixedCrowd();
    const [blockedSeed, productiveSeed] = [seedFor(app, layer, false), seedFor(app, layer, true)];
    const field = byId('crowd-seed-value');
    const type = seed => {
      field.value = String(seed);
      field.dispatchEvent(new Event('change', { bubbles: true }));
    };
    type(blockedSeed);
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    expect(byId('export-mp4-btn').getAttribute('aria-disabled')).toBe('true');
    type(productiveSeed);
    await settled();
    expect(playState()).toEqual(PLAY_ON);
    expect(byId('export-mp4-btn').getAttribute('aria-disabled')).toBeNull();
    app.undo();
    await settled();
    expect(byId('export-mp4-btn').getAttribute('aria-disabled')).toBe('true');
    app.redo();
    await settled();
    expect(byId('export-mp4-btn').getAttribute('aria-disabled')).toBeNull();

    // Re-roll draws a seed: whichever Entry it lands on, Play and the export item agree with the engine.
    for (let roll = 0; roll < 6; roll += 1) {
      byId('crowd-reroll-btn').click();
      await settled();
      const playable = app.canPlayScene();
      expect(playState()).toEqual(playable ? PLAY_ON : PLAY_OFF);
      expect(byId('export-mp4-btn').getAttribute('aria-disabled')).toBe(playable ? null : 'true');
    }
  });

  test('a path weight: every dot sent down a path of no length to a dead end, then back to the Exit\'s', async () => {
    const app = await blankProject();
    const { layer, entry, path: toExit } = drawCrowd(app);
    layer.emitters[0].update({ lifecycleMode: 'disappear', dotCount: 1, seed: 1 });
    // A second path from the Entry, to a node on the Entry's own spot that no path leaves: a journey of no length.
    const spot = entry.position();
    const deadEnd = layer.graph.addNode({ x: spot.x, y: spot.y });
    const nowhere = layer.graph.addEdge({ sourceId: entry.id, targetId: deadEnd.id, direction: 'one-way' });
    app.eventBus.emit('network:changed', { commit: true });
    await settled();
    // Weighted as the Path card weights them (crowd:param-changed, network.js).
    const weigh = (exitWeight, nowhereWeight) => {
      toExit.setWeight(exitWeight);
      nowhere.setWeight(nowhereWeight);
      app.eventBus.emit('crowd:param-changed');
    };
    weigh(0.01, 1e6);
    await committed();
    expect(playState()).toEqual(PLAY_OFF);
    weigh(1e6, 0.01);
    await committed();
    expect(playState()).toEqual(PLAY_ON);
    app.undo();
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    app.redo();
    await settled();
    expect(playState()).toEqual(PLAY_ON);
  });

  test('the same through the scene outline: its emitter form\'s journey end', async () => {
    const { app, layer } = await mixedCrowd();
    const blockedSeed = seedFor(app, layer, false);
    const field = byId('crowd-seed-value');
    field.value = String(blockedSeed);
    field.dispatchEvent(new Event('change', { bubbles: true })); // its own history entry
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    const emitter = layer.emitters[0];
    const command = {
      action: 'update-emitter', layerId: layer.id, emitterId: emitter.id,
      dotCount: String(emitter.dotCount), releaseStart: String(emitter.releaseStart * 100),
      releaseDuration: String(emitter.releaseDuration * 100), onsetVariance: String(emitter.onsetVariance * 100),
      intensityRampDirection: 'even', intensityRampAmount: '0', speed: String(emitter.speed),
      speedVariance: String(emitter.speedVariance * 100), dotSize: String(emitter.dotSize),
      wobble: String(emitter.wobble * 100), dotColor: emitter.dotColor, lifecycleMode: 'collect',
    };
    app._handleSceneOutlineCommand(command);
    await settled();
    expect(emitter.lifecycleMode).toBe('collect');
    expect(playState()).toEqual(PLAY_ON);
    app.undo();
    await settled();
    expect(playState()).toEqual(PLAY_OFF);
    app.redo();
    await settled();
    expect(playState()).toEqual(PLAY_ON);
  });
});

describe('the Guide card\'s sentence says what Play says (§3.6, §5.7)', () => {
  const SENTENCE = ' It takes at least two route waypoints, or a crowd\'s network, before previewing or exporting.';
  const hint = () => byId('crowd-guide-hint').textContent;

  test('shown on a blank project\'s crowd with an empty network, gone once any crowd can be drawn; Trace\'s reason kept', async () => {
    const app = await blankProject();
    byId('add-crowd-btn').click();
    await settled();
    expect(hint().endsWith(SENTENCE)).toBe(true);
    const reason = byId('crowd-trace-route-reason');
    expect([reason.hidden, reason.textContent]).toEqual([false, 'Add at least two route waypoints first.']);

    // Another crowd, drawn: the first crowd's card no longer says it, though its own network is empty.
    const drawn = drawCrowd(app);
    await settled();
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayers()[0]);
    expect(hint()).not.toContain('It takes at least');
    expect([reason.hidden, reason.textContent]).toEqual([false, 'Add at least two route waypoints first.']);

    // And back when it goes.
    app.deleteCrowd(drawn.layer);
    await settled();
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayers()[0]);
    expect(hint().endsWith(SENTENCE)).toBe(true);
    // Said once in the Guide card: the Play reason sits under the playbar, outside it.
    const lines = [...document.querySelectorAll('#section-guide-content .section-hint')]
      .filter(line => !line.hidden).map(line => line.textContent).join(' ');
    expect(lines.match(/Add at least two route waypoints/g)).toHaveLength(1);
    expect(byId('section-guide-content').contains(byId('play-reason'))).toBe(false);
  });
});
