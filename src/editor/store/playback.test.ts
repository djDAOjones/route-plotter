// CORE-05, stage 2: the transport's slice in the editor's store. What an interface shows of the player's transport
// (playing or not, the position, the speed) lives beside the project, outside the undo history: a change to it is
// never a step, never clears Redo, is taken while a gesture is open and tells subscribers as any change does; Open puts
// it back to the start; Undo, Redo and a gesture leave it. The store is a PlaybackHolder by shape: a transport is made
// on it.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { AT_START, createTransport, FIRST_FRAME_MS, type FrameSource, type Playback } from '../../player/transport/transport';
import { setRouteSetting } from './command';
import { createStore, type Store } from './store';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

/** One route, two stops joined by a line, the lead starting at the first. */
function twoStops(): { project: Project; route: string } {
  const nextId = counter('seed');
  const a = newPoint(nextId, { x: 0.2, y: 0.2, kind: 'stop' });
  const b = newPoint(nextId, { x: 0.8, y: 0.8, kind: 'stop' });
  const route = { ...newRoute(nextId), points: [a, b], lines: [newLine(nextId, a.id, b.id)], leadStart: a.id };
  return { project: { scene: { ...newScene(nextId), routes: [route] }, images: [] }, route: route.id };
}

function storeOf(reports: unknown[] = []): { store: Store; project: Project; route: string } {
  const { project, route } = twoStops();
  return { store: createStore({ project, nextId: counter('new'), report: (error) => reports.push(error) }), project, route };
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

const PLAYING: Playback = Object.freeze({ playing: true, atMs: 1200, speed: 2 });
const PAUSED_LATER: Playback = Object.freeze({ playing: false, atMs: 3400, speed: -0.5 });

/** What untyped code might hand in: any object, typed as a playback, so the store itself must check it. */
const handedIn = (value: unknown): value is Playback => typeof value === 'object' && value !== null;

function asPlayback(value: unknown): Playback {
  if (!handedIn(value)) throw new Error('a playback is an object');
  return value;
}

describe('the transport’s slice in the store', () => {
  it('starts at the start, paused, at normal speed, and getState shows what playback() gives', () => {
    const { store } = storeOf();
    expect(store.playback()).toEqual(AT_START);
    expect(store.getState().playback).toBe(store.playback());
  });

  it('a change to it makes no step, keeps Redo and tells subscribers with a new state, the project the same object', () => {
    const { store, route } = storeOf();
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    store.undo();
    const before = store.getState();
    expect(before.redo).not.toBeNull();
    let told = 0;
    store.subscribe(() => {
      told += 1;
    });
    expect(store.setPlayback(PLAYING)).toEqual({ ok: true, changed: true });
    const after = store.getState();
    expect(after).not.toBe(before);
    expect(Object.isFrozen(after)).toBe(true);
    expect([after.project, after.selection, after.undo, after.redo, after.gesture]).toEqual([
      before.project, before.selection, before.undo, before.redo, before.gesture,
    ]);
    expect(after.project).toBe(before.project);
    expect(after.playback).toEqual(PLAYING);
    expect(Object.isFrozen(after.playback)).toBe(true);
    expect(told).toBe(1);
    expect(store.setPlayback({ ...PLAYING })).toEqual({ ok: true, changed: false });
    expect(store.getState()).toBe(after);
    expect(told).toBe(1);
    expect(store.redo()).toEqual({ ok: true, changed: true });
    expect(store.playback()).toEqual(PLAYING);
  });

  it('is taken while a gesture is open, and dispatch, begin, apply, commit and cancel leave it', () => {
    const { store, route } = storeOf();
    store.setPlayback(PLAYING);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    expect(store.playback()).toEqual(PLAYING);
    const first = store.begin('Thickness');
    if (!first.ok) throw new Error('the gesture was refused');
    first.gesture.apply(setRouteSetting(route, 'line', 'thickness', 12));
    expect(store.setPlayback(PAUSED_LATER)).toEqual({ ok: true, changed: true });
    expect(store.getState().gesture).toBe('Thickness');
    first.gesture.apply(setRouteSetting(route, 'line', 'thickness', 14));
    expect(first.gesture.cancel()).toEqual({ ok: true, changed: true });
    expect(store.playback()).toEqual(PAUSED_LATER);
    const second = store.begin('Thickness');
    if (!second.ok) throw new Error('the gesture was refused');
    expect(store.playback()).toEqual(PAUSED_LATER);
    second.gesture.apply(setRouteSetting(route, 'line', 'thickness', 16));
    store.setPlayback(PLAYING);
    expect(second.gesture.commit()).toEqual({ ok: true, changed: true });
    expect(store.playback()).toEqual(PLAYING);
    expect(store.getState().undo).toBe('Thickness');
  });

  it('Undo and Redo leave it', () => {
    const { store, route } = storeOf();
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    store.setPlayback(PLAYING);
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(store.playback()).toEqual(PLAYING);
    store.setPlayback(PAUSED_LATER);
    expect(store.redo()).toEqual({ ok: true, changed: true });
    expect(store.playback()).toEqual(PAUSED_LATER);
  });

  it('Open puts it back to the start, paused, at normal speed, in the one change it tells of', () => {
    const { store, project } = storeOf();
    store.setPlayback(PLAYING);
    let told = 0;
    store.subscribe(() => {
      told += 1;
    });
    expect(store.open(project)).toEqual({ ok: true, changed: true });
    expect(store.getState().playback).toEqual(AT_START);
    expect(told).toBe(1);
  });

  it('one that is not a whole, finite playback is refused before anything changes, and nothing is told', () => {
    const { store } = storeOf();
    store.setPlayback(PLAYING);
    const before = store.getState();
    let told = 0;
    store.subscribe(() => {
      told += 1;
    });
    const wrong: unknown[] = [
      {}, { playing: 'yes', atMs: 0, speed: 1 }, { playing: true, speed: 1 }, { ...PLAYING, atMs: Number.NaN },
      { ...PLAYING, atMs: Infinity }, { ...PLAYING, atMs: -1 }, { ...PLAYING, speed: 0 }, { ...PLAYING, speed: Number.NaN },
      { ...PLAYING, speed: 17 }, { ...PLAYING, speed: -0.05 },
    ];
    for (const next of wrong) {
      expect(store.setPlayback(asPlayback(next))).toEqual({ ok: false, refusal: { why: 'not-a-playback' } });
      expect(store.getState()).toBe(before);
    }
    const failing = Object.defineProperty({ ...PLAYING }, 'speed', {
      get: () => {
        throw new Error('a field that fails');
      },
    });
    expect(() => store.setPlayback(failing)).toThrow('a field that fails');
    expect(store.getState()).toBe(before);
    expect(told).toBe(0);
  });

  it('reads each field of what it is given once, before anything changes, and keeps its own frozen copy', () => {
    const { store } = storeOf();
    const reads: string[] = [];
    let atMs = 500;
    const given = {
      get playing() {
        reads.push('playing');
        return true;
      },
      get atMs() {
        reads.push('atMs');
        atMs += 1;
        return atMs;
      },
      get speed() {
        reads.push('speed');
        return 1.5;
      },
    };
    expect(store.setPlayback(given)).toEqual({ ok: true, changed: true });
    expect(reads).toEqual(['playing', 'atMs', 'speed']);
    expect(store.playback()).toEqual({ playing: true, atMs: 501, speed: 1.5 });
    expect(store.playback()).not.toBe(given);
    expect(Object.isFrozen(store.playback())).toBe(true);
  });

  it('a subscriber that throws on a playback change is reported, the others are told, and the change is kept', () => {
    const reports: unknown[] = [];
    const { store } = storeOf(reports);
    const failure = new Error('a subscriber that fails');
    store.subscribe(() => {
      throw failure;
    });
    let told = 0;
    store.subscribe(() => {
      told += 1;
    });
    expect(store.setPlayback(PLAYING)).toEqual({ ok: true, changed: true });
    expect(store.playback()).toEqual(PLAYING);
    expect(told).toBe(1);
    expect(reports).toEqual([failure]);
  });

  it('drives and follows a transport made on it: Play, a frame, Pause, and an Open while playing', () => {
    const { store, project } = storeOf();
    const frames = handMade();
    const reports: unknown[] = [];
    const transport = createTransport({
      frames: frames.source,
      holder: store,
      inputs: () => ({ scene: store.getState().project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
      report: (error) => reports.push(error),
    });
    const seen: Playback[] = [];
    store.subscribe(() => seen.push(store.getState().playback));
    expect(transport.length()).toBeGreaterThan(100);
    transport.play();
    expect(store.getState().playback).toEqual({ playing: true, atMs: 0, speed: 1 });
    expect(frames.booked()).toBe(1);
    frames.run(1000);
    expect(store.getState().playback.atMs).toBeCloseTo(FIRST_FRAME_MS);
    frames.run(1050);
    expect(store.getState().playback.atMs).toBeCloseTo(FIRST_FRAME_MS + 50);
    transport.pause();
    expect(store.getState().playback.playing).toBe(false);
    expect(store.getState().playback.atMs).toBeCloseTo(FIRST_FRAME_MS + 50);
    expect(frames.booked()).toBe(0);
    expect(seen.map(({ playing }) => playing)).toEqual([true, true, true, false]);
    expect(store.getState().undo).toBeNull();
    transport.play();
    frames.run(2000);
    expect(store.open(project)).toEqual({ ok: true, changed: true });
    expect(store.playback()).toEqual(AT_START);
    frames.run(2016);
    expect(frames.booked()).toBe(0);
    expect(store.playback()).toEqual(AT_START);
    expect(reports).toEqual([]);
  });
});
