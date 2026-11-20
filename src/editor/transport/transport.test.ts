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
import { createEditorTransport, JKL_FASTEST, WORDS } from './transport';

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

/** The editor's transport on a store, the player's transport made on it, and what it said. */
function editorOf() {
  const store = createStore({ project: twoStops(), nextId: counter('new') });
  const frames = handMade();
  const reports: unknown[] = [];
  const player = createTransport({
    frames: frames.source,
    holder: store,
    inputs: () => ({ scene: store.getState().project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
    report: (error) => reports.push(error),
  });
  const said: string[] = [];
  const announce: Announce = (message) => said.push(message);
  const editor = createEditorTransport({ transport: player, playback: () => store.playback(), announce });
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

  it('after a pause, a stop on an end or a skip to the start, J and L begin again at normal speed (v3 reset its own)', () => {
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

  it('skip to end leaves a forward playing as it was, which stops on the end at its next frame (v3’s seek)', () => {
    const { store, frames, player, editor, said } = editorOf();
    editor.playPause();
    frames.run(0);
    said.length = 0;
    editor.skipToEnd();
    expect(store.playback()).toEqual({ playing: true, atMs: player.length(), speed: 1 });
    frames.run(16);
    expect(store.playback()).toEqual({ playing: false, atMs: player.length(), speed: 1 });
    expect(frames.booked()).toBe(0);
    expect(said).toEqual([WORDS.skippedToEnd]);
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

  it('are all it says: every command, from playing and from paused, says only these', () => {
    const { frames, editor, said } = editorOf();
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
      }
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
