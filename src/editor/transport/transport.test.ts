// CORE-05, stage 3: the editor's own transport, over the player's transport made on the store with a frame source run
// by hand. One function per command, called by every way of asking: Space, K and the Play button all reach
// `playPause`, which plays from the start on the end (DEF-62); End, `.`, `>` and the button all reach `skipToEnd`,
// which says so (INTAKE.26). J and L as v3's live handler; a scrub that says nothing.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { RETIRED_WORDS } from '../../adapters/io/fixtures';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { createTransport, FIRST_FRAME_MS, type FrameSource, type Transport } from '../../player/transport/transport';
import type { Announce } from '../kit/announce';
import { createStore } from '../store/store';
import { createEditorTransport, hasSomethingToPlay, JKL_FASTEST, WORDS } from './transport';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

/** One route, two stops joined by a line, the lead starting at the first. */
function twoStops(): Project {
  const nextId = counter('seed');
  const a = newPoint(nextId, { x: 0.2, y: 0.2, kind: 'stop' });
  const b = newPoint(nextId, { x: 0.8, y: 0.8, kind: 'stop' });
  const route = { ...newRoute(nextId), points: [a, b], lines: [newLine(nextId, a.id, b.id)], leadStart: a.id };
  return { scene: { ...newScene(nextId), routes: [route] }, images: [] };
}

/** A frame source a test runs by hand: `run` calls the frames booked now, at the time it is given. */
function handMade() {
  let next = 0;
  const booked = new Map<number, (timeMs: number) => void>();
  const source: FrameSource<number> = {
    request: (callback) => {
      next += 1;
      booked.set(next, callback);
      return next;
    },
    cancel: (handle) => {
      booked.delete(handle);
    },
  };
  return {
    source,
    booked: () => booked.size,
    run(timeMs: number) {
      const due = [...booked.values()];
      booked.clear();
      for (const callback of due) callback(timeMs);
    },
  };
}

/** The same with nothing to play: an empty scene. */
function empty(): Project {
  return { scene: newScene(counter('empty')), images: [] };
}

/**
 * The editor's transport on a store, the player's transport made on it, and what it said: put together as the
 * session puts them (`canPlay` read from the store's scene at each ask, `ended` saying `WORDS.complete`).
 */
function editorOf(project: Project = twoStops()) {
  const store = createStore({ project, nextId: counter('new') });
  const frames = handMade();
  const reports: unknown[] = [];
  const player = createTransport({
    frames: frames.source,
    holder: store,
    inputs: () => ({ scene: store.getState().project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
    report: (error) => reports.push(error),
    ended: () => {
      announce(WORDS.complete);
    },
  });
  const said: string[] = [];
  const announce: Announce = (message) => said.push(message);
  const editor = createEditorTransport({
    transport: player,
    playback: () => store.playback(),
    announce,
    canPlay: () => hasSomethingToPlay(store.getState().project.scene),
  });
  return { store, frames, player, editor, said, reports };
}

describe('the editor’s transport: play or pause (the Play button, Space and K)', () => {
  it('plays when paused, saying so, and pauses when playing, back at normal speed, saying so', () => {
    const { store, frames, editor, said } = editorOf();
    editor.playPause();
    expect(store.playback()).toEqual({ playing: true, atMs: 0, speed: 1 });
    expect(frames.booked()).toBe(1);
    frames.run(1000);
    frames.run(1040);
    editor.forward();
    expect(store.playback().speed).toBe(2);
    editor.playPause();
    expect(store.playback()).toEqual({ playing: false, atMs: FIRST_FRAME_MS + 40, speed: 1 });
    expect(frames.booked()).toBe(0);
    expect(said).toEqual([WORDS.playing, WORDS.paused]);
  });

  it('DEF-62: on the end, it plays from the start, as the Play button does', () => {
    const { store, frames, player, editor, said } = editorOf();
    const lengthMs = player.length();
    editor.playPause();
    frames.run(0);
    for (let time = 100; store.playback().playing; time += 100) frames.run(time);
    expect(store.playback()).toEqual({ playing: false, atMs: lengthMs, speed: 1 });
    said.length = 0;
    editor.playPause();
    expect(store.playback()).toEqual({ playing: true, atMs: 0, speed: 1 });
    expect(frames.booked()).toBe(1);
    frames.run(5000);
    expect(store.playback().atMs).toBeCloseTo(FIRST_FRAME_MS);
    expect(said).toEqual([WORDS.playing]);
  });
});

describe('the editor’s transport: J and L, as v3’s live handler', () => {
  it('L plays forwards at normal speed, then twice as fast at each press, 4 times at most; Playing is said once', () => {
    const { store, editor, said } = editorOf();
    const speeds: number[] = [];
    for (let press = 0; press < 4; press += 1) {
      editor.forward();
      speeds.push(store.playback().speed);
      expect(store.playback().playing).toBe(true);
    }
    expect(speeds).toEqual([1, 2, 4, JKL_FASTEST]);
    expect(said).toEqual([WORDS.playing]);
  });

  it('J turns a forward playing round at normal speed, then doubles, 4 times at most, and L turns it back', () => {
    const { store, frames, editor, said } = editorOf();
    editor.forward();
    frames.run(0);
    frames.run(50);
    editor.forward();
    editor.forward();
    expect(store.playback().speed).toBe(4);
    const speeds: number[] = [];
    for (let press = 0; press < 4; press += 1) {
      editor.reverse();
      speeds.push(store.playback().speed);
    }
    expect(speeds).toEqual([-1, -2, -4, -4]);
    editor.forward();
    expect(store.playback()).toMatchObject({ playing: true, speed: 1 });
    expect(said).toEqual([WORDS.playing]);
  });

  it('J from a pause plays backwards at normal speed, from where it is', () => {
    const { store, editor, said } = editorOf();
    editor.scrub(300);
    editor.reverse();
    expect(store.playback()).toEqual({ playing: true, atMs: 300, speed: -1 });
    expect(said).toEqual([WORDS.playing]);
  });

  it('D179: after a pause, a stop on an end or a skip to the start, J and L begin again at normal speed', () => {
    const { store, frames, editor } = editorOf();
    editor.forward();
    editor.forward();
    editor.playPause();
    editor.forward();
    expect(store.playback().speed).toBe(1);

    editor.reverse();
    editor.reverse();
    expect(store.playback().speed).toBe(-2);
    frames.run(0);
    for (let time = 100; store.playback().playing; time += 100) frames.run(time);
    expect(store.playback()).toEqual({ playing: false, atMs: 0, speed: 1 });
    editor.reverse();
    expect(store.playback().speed).toBe(-1);

    editor.forward();
    editor.forward();
    editor.skipToStart();
    editor.forward();
    expect(store.playback()).toEqual({ playing: true, atMs: 0, speed: 1 });
  });

  it('D177: L after the Play button doubles at once, as after K or Space (v3’s first L after its button did not)', () => {
    const { store, editor, said } = editorOf();
    editor.playPause();
    editor.forward();
    expect(store.playback()).toMatchObject({ playing: true, speed: 2 });
    expect(said).toEqual([WORDS.playing]);
  });

  it('L on the end plays from the start at normal speed, as the player’s Play does', () => {
    const { store, player, editor } = editorOf();
    editor.skipToEnd();
    expect(store.playback().atMs).toBe(player.length());
    editor.forward();
    expect(store.playback()).toEqual({ playing: true, atMs: 0, speed: 1 });
  });
});

describe('the editor’s transport: the two skips', () => {
  it('skip to start stops at the start at normal speed, books no frame and says so once (v3’s reset)', () => {
    const { store, frames, editor, said } = editorOf();
    editor.forward();
    editor.forward();
    frames.run(0);
    frames.run(80);
    said.length = 0;
    editor.skipToStart();
    expect(store.playback()).toEqual({ playing: false, atMs: 0, speed: 1 });
    expect(frames.booked()).toBe(0);
    expect(said).toEqual([WORDS.skippedToStart]);
  });

  it('INTAKE.26: skip to end moves to the end and says so, once, through announce', () => {
    const { store, player, editor, said } = editorOf();
    editor.skipToEnd();
    expect(store.playback()).toEqual({ playing: false, atMs: player.length(), speed: 1 });
    expect(said).toEqual([WORDS.skippedToEnd]);
  });

  it('skip to end leaves a forward playing as it was, which stops on the end at its next frame, which says “Animation complete” (v3’s seek)', () => {
    const { store, frames, player, editor, said } = editorOf();
    editor.playPause();
    frames.run(0);
    said.length = 0;
    editor.skipToEnd();
    expect(store.playback()).toEqual({ playing: true, atMs: player.length(), speed: 1 });
    frames.run(16);
    expect(store.playback()).toEqual({ playing: false, atMs: player.length(), speed: 1 });
    expect(frames.booked()).toBe(0);
    expect(said).toEqual([WORDS.skippedToEnd, WORDS.complete]);
  });
});

describe('the editor’s transport: scrub', () => {
  it('moves to a position in ms, held to the scene, saying nothing and leaving playing as it was', () => {
    const { store, player, editor, said } = editorOf();
    editor.scrub(250);
    expect(store.playback()).toEqual({ playing: false, atMs: 250, speed: 1 });
    editor.scrub(-50);
    expect(store.playback().atMs).toBe(0);
    editor.scrub(Number.MAX_SAFE_INTEGER);
    expect(store.playback().atMs).toBe(player.length());
    editor.playPause();
    said.length = 0;
    editor.scrub(100);
    expect(store.playback()).toEqual({ playing: true, atMs: 100, speed: 1 });
    expect(said).toEqual([]);
  });

  it('goes through the player’s seek alone and never reads the length (DEF-42.1: the reader’s half is stage 6’s)', () => {
    const calls: string[] = [];
    const spy: Transport = {
      play: () => calls.push('play'),
      pause: () => calls.push('pause'),
      seek: (ms) => calls.push(`seek ${String(ms)}`),
      setSpeed: (speed) => calls.push(`setSpeed ${String(speed)}`),
      length: () => {
        calls.push('length');
        return 1000;
      },
    };
    const said: string[] = [];
    const editor = createEditorTransport({
      transport: spy,
      playback: () => ({ playing: false, atMs: 0, speed: 1 }),
      announce: (message) => said.push(message),
      canPlay: () => true,
    });
    editor.scrub(420);
    expect(calls).toEqual(['seek 420']);
    expect(said).toEqual([]);
  });
});

describe('the editor’s transport: its words', () => {
  it('use none of the glossary’s retired words', () => {
    for (const [name, words] of Object.entries(WORDS)) expect(words, name).not.toMatch(RETIRED_WORDS);
  });

  it('are all it says: every command, from playing and from paused, with and without anything to play, says only these', () => {
    const said: string[] = [];
    for (const project of [twoStops(), empty()]) {
      const { frames, editor, said: saidHere } = editorOf(project);
      const commands = [
      () => editor.playPause(),
      () => editor.reverse(),
      () => editor.forward(),
      () => editor.skipToStart(),
      () => editor.skipToEnd(),
      () => editor.scrub(200),
      ];
      for (const first of commands) {
        for (const then of commands) {
          first();
          frames.run(0);
          then();
          for (let time = 100; time < 100_000 && frames.booked() > 0; time += 100) frames.run(time);
        }
      }
      said.push(...saidHere);
    }
    expect(said.length).toBeGreaterThan(0);
    const words: readonly string[] = Object.values(WORDS);
    for (const message of said) expect(words, message).toContain(message);
    expect(new Set(said)).toEqual(new Set(words));
  });

  it('are frozen, as is the transport', () => {
    expect(Object.isFrozen(WORDS)).toBe(true);
    expect(Object.isFrozen(editorOf().editor)).toBe(true);
  });
});

describe('the editor’s transport: nothing to play (v3’s refusal, the claim’s point 2)', () => {
  it('hasSomethingToPlay: some route with two or more points, and nothing less', () => {
    const nextId = counter('rule');
    const one = { ...newRoute(nextId), points: [newPoint(nextId, { x: 0.5, y: 0.5, kind: 'stop' })] };
    const scene = newScene(nextId);
    expect(hasSomethingToPlay(scene)).toBe(false);
    expect(hasSomethingToPlay({ ...scene, routes: [newRoute(nextId)] })).toBe(false);
    expect(hasSomethingToPlay({ ...scene, routes: [one, { ...one, id: 'other' }] })).toBe(false);
    expect(hasSomethingToPlay(twoStops().scene)).toBe(true);
    expect(hasSomethingToPlay({ ...scene, routes: [one, ...twoStops().scene.routes] })).toBe(true);
  });

  it('Play or pause, J and L each say why and change nothing: no play, no speed written, no frame', () => {
    for (const command of ['playPause', 'reverse', 'forward'] as const) {
      const { store, frames, player, editor, said } = editorOf(empty());
      player.setSpeed(-2);
      const before = store.playback();
      editor[command]();
      expect(store.playback(), command).toBe(before);
      expect(frames.booked(), command).toBe(0);
      expect(said, command).toEqual([WORDS.nothingToPlay]);
    }
  });

  it('asks only when nothing plays, and at each ask: a scene that gains two points plays', () => {
    let asks = 0;
    let can = false;
    const store = createStore({ project: twoStops(), nextId: counter('new') });
    const frames = handMade();
    const player = createTransport({
      frames: frames.source,
      holder: store,
      inputs: () => ({ scene: store.getState().project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
      report: () => undefined,
    });
    const said: string[] = [];
    const editor = createEditorTransport({
      transport: player,
      playback: () => store.playback(),
      announce: (message) => said.push(message),
      canPlay: () => {
        asks += 1;
        return can;
      },
    });
    editor.playPause();
    expect(store.playback().playing).toBe(false);
    can = true;
    editor.playPause();
    expect(store.playback().playing).toBe(true);
    expect(asks).toBe(2);
    can = false;
    editor.forward();
    editor.reverse();
    editor.skipToEnd();
    editor.scrub(10);
    editor.playPause();
    expect(asks).toBe(2);
    expect(said).toEqual([WORDS.nothingToPlay, WORDS.playing, WORDS.skippedToEnd, WORDS.paused]);
  });

  it('a pause, the two skips and a scrub are never refused and never ask', () => {
    let asks = 0;
    const { store, said } = editorOf(empty());
    const refusing = createEditorTransport({
      transport: createTransport({
        frames: handMade().source,
        holder: store,
        inputs: () => ({ scene: store.getState().project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
        report: () => undefined,
      }),
      playback: () => store.playback(),
      announce: (message) => said.push(message),
      canPlay: () => {
        asks += 1;
        return false;
      },
    });
    refusing.skipToEnd();
    refusing.skipToStart();
    refusing.scrub(0);
    expect(asks).toBe(0);
    expect(said).toEqual([WORDS.skippedToEnd, WORDS.skippedToStart]);
  });
});

describe('the editor’s transport: “Animation complete”, said by the player’s `ended` as the session hands it in', () => {
  it('is said once when a playing reaches the end by itself, either way, and not by Pause or a skip', () => {
    const { store, frames, player, editor, said } = editorOf();
    editor.playPause();
    frames.run(0);
    for (let time = 100; store.playback().playing; time += 100) frames.run(time);
    expect(store.playback()).toEqual({ playing: false, atMs: player.length(), speed: 1 });
    expect(said).toEqual([WORDS.playing, WORDS.complete]);
    said.length = 0;
    editor.reverse();
    frames.run(0);
    for (let time = 100; store.playback().playing; time += 100) frames.run(time);
    expect(store.playback()).toEqual({ playing: false, atMs: 0, speed: 1 });
    expect(said).toEqual([WORDS.playing, WORDS.complete]);
    said.length = 0;
    editor.playPause();
    frames.run(0);
    editor.playPause();
    editor.skipToEnd();
    editor.skipToStart();
    frames.run(16);
    expect(said).toEqual([WORDS.playing, WORDS.paused, WORDS.skippedToEnd, WORDS.skippedToStart]);
  });
});
