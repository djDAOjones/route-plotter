// CORE-05: the player's transport, driven by a hand-made frame source whose times are the test's own: no test reads a
// clock or waits. Five tests are named for v3's held lines (DEF-15, TST-04.2, REL-698.1, REL-703.2, DEF-42.1).
import { describe, expect, test } from 'vitest';
import { Recorder } from '../../adapters/render/recorder';
import { playLength } from '../../core/clock/clock';
import type { RouteFeature, SceneFeature, Catalogue } from '../../features/catalogue';
import { newLine, newPoint, newRoute, newScene, type Route, type Scene } from '../../core/model/scene';
import { compose, contentEnd, type ContentRequest } from '../compose';
import {
  AT_START,
  createTransport,
  FIRST_FRAME_MS,
  heldPlayback,
  MAX_GAP_MS,
  type FrameSource,
  type Playback,
  type Transport,
} from './transport';

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

function twoStopRoute(nextId: () => string, x: number): Route {
  const a = newPoint(nextId, { x, y: 0.2, kind: 'stop' });
  const b = newPoint(nextId, { x, y: 0.8, kind: 'stop' });
  return { ...newRoute(nextId), points: [a, b], lines: [newLine(nextId, a.id, b.id)], leadStart: a.id };
}

function sceneOf(routes = 1): Scene {
  const nextId = counter();
  const scene = newScene(nextId);
  return { ...scene, routes: Array.from({ length: routes }, (_, i) => twoStopRoute(nextId, 0.2 + i * 0.3)) };
}

/** A frame source a test runs by hand: `run` calls the frames booked now, at the time it is given. */
function handMade() {
  let next = 1;
  const booked = new Map<number, (timeMs: number) => void>();
  const ever: ((timeMs: number) => void)[] = [];
  const source: FrameSource<number> = {
    request: (callback) => {
      const handle = next++;
      booked.set(handle, callback);
      ever.push(callback);
      return handle;
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
    /** Every callback ever booked, cancelled ones too: what a source that missed a cancel would call. */
    runEvery(timeMs: number) {
      for (const callback of ever) callback(timeMs);
    },
  };
}

/** A catalogue whose one scene module ends at `endsAtMs` and counts each time it is asked: once a build. */
function counting(endsAtMs = 10_000, timesSeen: number[] = []) {
  const count = { builds: 0 };
  const scene: SceneFeature<Record<string, never>, unknown> = {
    id: 'count', title: 'count', description: 'count', group: 'core', settings: {}, select: () => ({}),
    evaluate: () => ({ ok: true, value: null }),
    end: () => {
      count.builds += 1;
      return { endsAtMs };
    },
    refersTo: () => [],
  };
  const route: RouteFeature<Record<string, never>, unknown> = {
    id: 'seen', title: 'seen', description: 'seen', group: 'core', settings: {}, select: () => ({}),
    evaluate: (input) => {
      timesSeen.push(input.timeMs);
      return { ok: true, value: null };
    },
    end: () => null,
    layers: {},
  };
  const catalogue: Catalogue = { route: [route], scene: [scene] };
  return { count, catalogue };
}

function rig(scene: Scene = sceneOf(), endsAtMs = 10_000, ended?: () => void) {
  const frames = handMade();
  const reports: unknown[] = [];
  const holder = heldPlayback((error) => reports.push(error));
  const seen: Playback[] = [];
  holder.subscribe(() => seen.push(holder.playback()));
  const { count, catalogue } = counting(endsAtMs);
  let inputs: ContentRequest = { scene, seed: 7, size: { width: 1920, height: 1080 }, image: { width: 400, height: 300 } };
  let unreadable = false;
  const read = (): ContentRequest => {
    if (unreadable) throw new Error('a frame that fails');
    return inputs;
  };
  const transport = createTransport({
    frames: frames.source, holder, inputs: read, report: (error) => reports.push(error), catalogue, ended,
  });
  return {
    frames, holder, seen, reports, count, catalogue, transport,
    inputs: () => inputs,
    change: (next: Partial<ContentRequest>) => {
      inputs = { ...inputs, ...next };
    },
    /** While on, reading the inputs throws: every frame fails. */
    breakFrames: (on: boolean) => {
      unreadable = on;
    },
  };
}

/** A rig whose holder's reporter throws: while `failing` is on, each write tells a subscriber that throws, and throws. */
function throwingRig() {
  const frames = handMade();
  const reports: unknown[] = [];
  let on = false;
  const holder = heldPlayback((error) => {
    throw error;
  });
  holder.subscribe(() => {
    if (on) throw new Error('a subscriber that fails');
  });
  const { catalogue } = counting();
  const inputs: ContentRequest = { scene: sceneOf(), seed: 7, size: { width: 1920, height: 1080 }, image: null };
  const transport = createTransport({
    frames: frames.source, holder, inputs: () => inputs, report: (error) => reports.push(error), catalogue,
  });
  return {
    frames, holder, reports, transport,
    failing: (failing: boolean) => {
      on = failing;
    },
  };
}

/**
 * A rig whose holder throws again what a subscriber threw, once all are told; `once(act)` runs `act` in the next
 * telling only, so a subscriber can write to the holder (a nested telling it then sits out) and throw.
 */
function onceRig() {
  const frames = handMade();
  const reports: unknown[] = [];
  const holder = heldPlayback((error) => {
    throw error;
  });
  let armed: (() => void) | null = null;
  holder.subscribe(() => {
    const act = armed;
    armed = null;
    act?.();
  });
  const { catalogue } = counting();
  const inputs: ContentRequest = { scene: sceneOf(), seed: 7, size: { width: 1920, height: 1080 }, image: null };
  const transport = createTransport({
    frames: frames.source, holder, inputs: () => inputs, report: (error) => reports.push(error), catalogue,
  });
  return {
    frames, holder, reports, transport,
    once: (act: () => void) => {
      armed = act;
    },
  };
}

const failure = () => new Error('a subscriber that fails');

describe('the transport', () => {
  test('starts at the start, paused, at normal speed, with nothing booked and nothing built', () => {
    const { frames, holder, count } = rig();
    expect(holder.playback()).toEqual(AT_START);
    expect(frames.booked()).toBe(0);
    expect(count.builds).toBe(0);
  });

  test('plays by the time between frames times the speed', () => {
    const { frames, holder, transport } = rig();
    transport.play();
    frames.run(1000);
    expect(holder.playback()).toEqual({ playing: true, atMs: FIRST_FRAME_MS, speed: 1 });
    frames.run(1040);
    expect(holder.playback().atMs).toBeCloseTo(FIRST_FRAME_MS + 40);
    transport.setSpeed(2);
    frames.run(1050);
    expect(holder.playback().atMs).toBeCloseTo(FIRST_FRAME_MS + 40 + 20);
    transport.setSpeed(-0.5);
    frames.run(1070);
    expect(holder.playback().atMs).toBeCloseTo(FIRST_FRAME_MS + 40 + 20 - 10);
    expect(frames.booked()).toBe(1);
  });

  test('the first frame after Play or a resume never jumps, and one long gap is capped', () => {
    const { frames, holder, transport } = rig();
    transport.play();
    frames.run(50_000);
    expect(holder.playback().atMs).toBe(FIRST_FRAME_MS);
    frames.run(90_000);
    expect(holder.playback().atMs).toBe(FIRST_FRAME_MS + MAX_GAP_MS);
    transport.pause();
    transport.play();
    frames.run(200_000);
    expect(holder.playback().atMs).toBe(2 * FIRST_FRAME_MS + MAX_GAP_MS);
    frames.run(199_000);
    expect(holder.playback().atMs).toBe(2 * FIRST_FRAME_MS + MAX_GAP_MS);
  });

  test('stops exactly on the length, paused, at normal speed, with nothing booked; Play there starts again', () => {
    const { frames, holder, transport } = rig();
    const length = transport.length();
    transport.seek(length - 30);
    transport.setSpeed(4);
    transport.play();
    frames.run(0);
    frames.run(100);
    expect(holder.playback()).toEqual({ playing: false, atMs: length, speed: 1 });
    expect(frames.booked()).toBe(0);
    transport.play();
    expect(holder.playback()).toEqual({ playing: true, atMs: 0, speed: 1 });
    expect(frames.booked()).toBe(1);
  });

  test('going backwards stops on 0, paused', () => {
    const { frames, holder, transport } = rig();
    transport.seek(30);
    transport.setSpeed(-2);
    transport.play();
    frames.run(0);
    frames.run(100);
    expect(holder.playback()).toEqual({ playing: false, atMs: 0, speed: 1 });
    expect(frames.booked()).toBe(0);
  });

  test('seek holds the position between 0 and the length and tells subscribers once', () => {
    const { holder, seen, transport } = rig();
    const length = transport.length();
    transport.seek(length + 5000);
    expect(seen).toEqual([{ playing: false, atMs: length, speed: 1 }]);
    transport.seek(length + 9000);
    expect(seen).toHaveLength(1);
    transport.seek(-3);
    transport.seek(Number.NaN);
    expect(seen.map((playback) => playback.atMs)).toEqual([length, 0]);
    expect(holder.playback().atMs).toBe(0);
  });

  test('speed is held at 0.1 to 16 either way, never 0, and one that is not a number is ignored', () => {
    const { holder, transport } = rig();
    const speeds = [0, -0, 0.01, -0.01, 40, -40, Number.POSITIVE_INFINITY, 3].map((speed) => {
      transport.setSpeed(speed);
      return holder.playback().speed;
    });
    expect(speeds).toEqual([0.1, 0.1, 0.1, -0.1, 16, -16, 16, 3]);
    transport.setSpeed(Number.NaN);
    expect(holder.playback().speed).toBe(3);
  });

  test('a subscriber that throws is reported and stops neither the others nor the playing', () => {
    const { frames, holder, reports, transport } = rig();
    const told: number[] = [];
    holder.subscribe(() => {
      throw new Error('a broken subscriber');
    });
    holder.subscribe(() => told.push(holder.playback().atMs));
    transport.play();
    frames.run(0);
    frames.run(10);
    expect(told).toEqual([0, FIRST_FRAME_MS, FIRST_FRAME_MS + 10]);
    expect(reports).toHaveLength(3);
    expect(holder.playback().playing).toBe(true);
    expect(frames.booked()).toBe(1);
  });

  test('a frame that throws is reported and still books the next (DEF-26)', () => {
    const { frames, holder, reports, transport, breakFrames } = rig();
    transport.play();
    frames.run(0);
    breakFrames(true);
    frames.run(10);
    expect(reports).toHaveLength(1);
    expect(frames.booked()).toBe(1);
    breakFrames(false);
    frames.run(20);
    expect(holder.playback().atMs).toBeCloseTo(FIRST_FRAME_MS + 10);
    expect(holder.playback().playing).toBe(true);
  });

  test('DEF-15: resuming play starts at normal speed', () => {
    const { frames, holder, transport } = rig();
    transport.play();
    transport.setSpeed(4);
    frames.run(0);
    frames.run(10);
    expect(holder.playback().atMs).toBeCloseTo(4 * FIRST_FRAME_MS + 40);
    transport.pause();
    expect(holder.playback().speed).toBe(1);
    transport.play();
    frames.run(500);
    frames.run(510);
    expect(holder.playback().atMs).toBeCloseTo(4 * FIRST_FRAME_MS + 40 + FIRST_FRAME_MS + 10);
  });

  test('TST-04.2: after a pause, no event says the animation is playing', () => {
    const { frames, holder, seen, transport } = rig();
    transport.play();
    frames.run(0);
    expect(frames.booked()).toBe(1);
    transport.pause();
    const paused = seen.length;
    expect(frames.booked()).toBe(0);
    // Even a frame source that missed the cancel and calls every callback it was ever given changes nothing.
    frames.runEvery(16);
    frames.runEvery(32);
    expect(seen.slice(paused - 1).every((playback) => !playback.playing)).toBe(true);
    expect(seen).toHaveLength(paused);
    expect(holder.playback().playing).toBe(false);
    expect(frames.booked()).toBe(0);
    // A pause written by someone else (an Open, in the store) is met by the frame booked already: it says nothing.
    transport.play();
    frames.run(48);
    const told = seen.length;
    holder.setPlayback(AT_START);
    frames.run(64);
    expect(seen).toHaveLength(told + 1);
    expect(holder.playback()).toEqual(AT_START);
    expect(frames.booked()).toBe(0);
  });

  test('REL-698.1: Play straight after Open never meets duration 0', () => {
    // What was held before the Open is an empty scene with no holds: a length of 0, as v3's before its re-timing.
    const empty = sceneOf(0);
    const none = { ...empty, settings: { ...empty.settings, clock: { ...empty.settings.clock, holdAtStartMs: 0, holdAtEndMs: 0 } } };
    const { frames, holder, count, transport, change } = rig(none, 0);
    expect(transport.length()).toBe(0);
    const opened = sceneOf(2);
    change({ scene: opened });
    transport.play();
    expect(count.builds).toBe(2);
    expect(transport.length()).toBeGreaterThan(FIRST_FRAME_MS);
    frames.run(0);
    expect(holder.playback()).toEqual({ playing: true, atMs: FIRST_FRAME_MS, speed: 1 });
    expect(frames.booked()).toBe(1);
  });

  test('REL-703.2: the timeline on open equals the one after a rebuild', () => {
    const { count, transport, change, inputs, catalogue } = rig(sceneOf(2));
    const onOpen = transport.length();
    change({ scene: structuredClone(inputs().scene) });
    const rebuilt = transport.length();
    expect(count.builds).toBe(2);
    expect(rebuilt).toBe(onOpen);
    // The same size and image as new objects build nothing: a length is keyed on what it is built from, by value.
    change({ size: { width: 1920, height: 1080 }, image: { width: 400, height: 300 } });
    expect(transport.length()).toBe(onOpen);
    expect(count.builds).toBe(2);
    expect(onOpen).toBe(playLength(inputs().scene.settings.clock, contentEnd(inputs(), catalogue)));
  });

  // DEF-42.1, the transport's half (Codex's finding A on a3ced7d): the drag never reads the length, so this proves only
  // that the transport builds nothing until it is read and once at a frame. The reader's half is the next test's.
  test('DEF-42.1, the transport’s half: nothing is built until the length is read, and a frame builds once', () => {
    const { frames, count, transport, change, inputs } = rig(sceneOf(2));
    const drag = () => {
      for (let i = 0; i < 20; i += 1) change({ scene: { ...inputs().scene } });
    };
    drag();
    expect(count.builds).toBe(0);
    transport.play();
    expect(count.builds).toBe(1);
    frames.run(0);
    expect(count.builds).toBe(1);
    drag();
    frames.run(16);
    expect(count.builds).toBe(2);
    frames.run(32);
    expect(count.builds).toBe(2);
    transport.pause();
    drag();
    expect(count.builds).toBe(2);
    expect(frames.booked()).toBe(0);
  });

  // DEF-42.1, the reader's half. The length is built on demand, once per scene object, never deferred: paused there is
  // no frame to wait for, and a stale length is what REL-698.1 forbids. So a reader that reads it on every change builds
  // on every change, and coalescing is the reader's duty: an interface reads `length()` only when it draws, and draws
  // at most once a frame. Stage 6 (the preview and Open) proves that with the real play bar on the real store.
  test('DEF-42.1, the reader’s half: each changed scene is built once, however often its length is read', () => {
    const { count, transport, change, inputs } = rig(sceneOf(2));
    const lengths = new Set<number>();
    for (let i = 0; i < 20; i += 1) {
      change({ scene: { ...inputs().scene } });
      for (let read = 0; read < 3; read += 1) lengths.add(transport.length());
    }
    expect(count.builds).toBe(20);
    expect(lengths.size).toBe(1);
  });

  test('Play books a frame only if what is held still plays after its write (finding B)', () => {
    const { frames, holder, transport } = rig();
    holder.subscribe(() => {
      if (holder.playback().playing) transport.pause();
    });
    transport.play();
    expect(holder.playback()).toEqual(AT_START);
    expect(frames.booked()).toBe(0);
  });

  test('a write whose telling throws never strands the playback: Play still books, and the error is thrown on (finding C)', () => {
    const { frames, holder, transport, failing } = throwingRig();
    failing(true);
    expect(() => transport.play()).toThrow('a subscriber that fails');
    expect(holder.playback().playing).toBe(true);
    expect(frames.booked()).toBe(1);
    failing(false);
    frames.run(0);
    expect(holder.playback().atMs).toBeCloseTo(FIRST_FRAME_MS);
    expect(frames.booked()).toBe(1);
  });

  // Every other place the transport writes and then acts already goes by what is held: Pause cancels before it writes,
  // seek and setSpeed keep `playing` as it is, and a frame books in its `finally` only if what is held plays. This
  // guards that each still holds when the write throws: playing with one frame booked, or paused with none.
  test('a throwing write leaves a frame booked exactly while playing: pause, seek, speed and both of a frame’s stops', () => {
    const { frames, holder, transport, failing, reports } = throwingRig();
    const booked = () => expect(frames.booked()).toBe(holder.playback().playing ? 1 : 0);
    const throwing = (act: () => void) => {
      failing(true);
      expect(act).toThrow('a subscriber that fails');
      failing(false);
      booked();
    };
    transport.play();
    throwing(() => transport.seek(500));
    throwing(() => transport.setSpeed(2));
    throwing(() => transport.pause());
    expect(holder.playback().playing).toBe(false);
    throwing(() => transport.seek(700));
    transport.seek(transport.length() - 50);
    transport.play();
    frames.run(0);
    failing(true);
    frames.run(100);
    failing(false);
    expect(holder.playback()).toEqual({ playing: false, atMs: transport.length(), speed: 1 });
    booked();
    transport.setSpeed(-1);
    transport.seek(50);
    transport.play();
    frames.run(200);
    failing(true);
    frames.run(300);
    failing(false);
    expect(holder.playback()).toEqual(AT_START);
    booked();
    expect(reports).toHaveLength(2);
  });

  // Codex's T1 on 6ba74e8: a subscriber that changes what is held during a telling and throws. Every command and every
  // frame ends in `follow()` (the claim's point 1), so the booking goes by what is finally held.
  test('a subscriber that plays during Pause’s telling and throws leaves a frame booked, which moves it on (T1)', () => {
    const { frames, holder, transport, once } = onceRig();
    transport.play();
    frames.run(0);
    once(() => {
      holder.setPlayback(Object.freeze({ playing: true, atMs: 300, speed: 1 }));
      throw failure();
    });
    expect(() => transport.pause()).toThrow('a subscriber that fails');
    expect(holder.playback()).toEqual({ playing: true, atMs: 300, speed: 1 });
    expect(frames.booked()).toBe(1);
    frames.run(5000);
    expect(holder.playback().atMs).toBeCloseTo(300 + FIRST_FRAME_MS);
    expect(frames.booked()).toBe(1);
  });

  test('a subscriber that pauses during seek’s or setSpeed’s telling and throws leaves no frame booked (T1)', () => {
    for (const act of [(t: Transport) => t.seek(500), (t: Transport) => t.setSpeed(2)]) {
      const { frames, holder, transport, once } = onceRig();
      transport.play();
      frames.run(0);
      once(() => {
        holder.setPlayback(Object.freeze({ playing: false, atMs: 200, speed: 1 }));
        throw failure();
      });
      expect(() => act(transport)).toThrow('a subscriber that fails');
      expect(holder.playback()).toEqual({ playing: false, atMs: 200, speed: 1 });
      expect(frames.booked()).toBe(0);
    }
  });

  test('a subscriber that plays, then puts the start back, during a frame’s stop at the end and throws leaves no frame booked (T1)', () => {
    const { frames, holder, transport, once, reports } = onceRig();
    transport.seek(transport.length() - 10);
    transport.play();
    once(() => {
      transport.play();
      expect(frames.booked()).toBe(1);
      holder.setPlayback(AT_START);
      throw failure();
    });
    frames.run(0);
    expect(holder.playback()).toEqual(AT_START);
    expect(frames.booked()).toBe(0);
    expect(reports).toHaveLength(1);
  });

  test('a frame that follow() cancels forgets the last frame’s time: a resume after it moves as a first frame would', () => {
    const { frames, holder, transport } = rig();
    transport.play();
    frames.run(0);
    // Someone else pauses (the store's Open): the frame booked stays until it runs or a command comes (point 2).
    holder.setPlayback(Object.freeze({ playing: false, atMs: 500, speed: 1 }));
    expect(frames.booked()).toBe(1);
    transport.seek(1000);
    expect(frames.booked()).toBe(0);
    // Someone else plays: not followed until the next command, here one that writes nothing (point 3).
    holder.setPlayback(Object.freeze({ playing: true, atMs: 1000, speed: 1 }));
    expect(frames.booked()).toBe(0);
    transport.setSpeed(1);
    expect(frames.booked()).toBe(1);
    frames.run(5000);
    expect(holder.playback().atMs).toBeCloseTo(1000 + FIRST_FRAME_MS);
  });

  test('a frame and the transport read the content’s end from the one sum (D174)', () => {
    const timesSeen: number[] = [];
    const { catalogue } = counting(7000, timesSeen);
    const frames = handMade();
    const holder = heldPlayback(() => undefined);
    const inputs: ContentRequest = { scene: sceneOf(1), seed: 7, size: { width: 800, height: 600 }, image: null };
    const transport = createTransport({ frames: frames.source, holder, inputs: () => inputs, report: () => undefined, catalogue });
    const length = transport.length();
    const { clock } = inputs.scene.settings;
    expect(length).toBe(playLength(clock, contentEnd(inputs, catalogue)));
    for (const sceneMs of [length, length - clock.holdAtEndMs, length + 1000]) {
      compose(new Recorder(), { ...inputs, sceneMs, surface: () => ({ context: new Recorder(), image: { width: 800, height: 600, close() {} } }) }, catalogue);
    }
    expect(timesSeen).toEqual([contentEnd(inputs, catalogue), contentEnd(inputs, catalogue), contentEnd(inputs, catalogue)]);
  });
});

describe('the transport’s `ended` (the claim’s point 4: “Animation complete”)', () => {
  /** A rig that counts each call of `ended`, with what was held when it was called. */
  function endedRig(throws = false) {
    const calls: Playback[] = [];
    let holderOf: () => Playback = () => AT_START;
    const made = rig(sceneOf(), 10_000, () => {
      calls.push(holderOf());
      if (throws) throw new Error('an ended that fails');
    });
    holderOf = () => made.holder.playback();
    return { ...made, calls };
  }

  test('a frame that stops a forward playing on the end calls it once, after the stop is kept', () => {
    const { frames, transport, calls } = endedRig();
    const length = transport.length();
    transport.seek(length - 30);
    transport.play();
    frames.run(0);
    expect(calls).toEqual([]);
    frames.run(100);
    expect(calls).toEqual([{ playing: false, atMs: length, speed: 1 }]);
    frames.run(200);
    expect(calls).toHaveLength(1);
  });

  test('a frame that stops a backward playing on 0 calls it once', () => {
    const { frames, transport, calls } = endedRig();
    transport.seek(30);
    transport.setSpeed(-2);
    transport.play();
    frames.run(0);
    frames.run(100);
    expect(calls).toEqual([{ playing: false, atMs: 0, speed: 1 }]);
  });

  test('nothing else calls it: pause, seek to either end, a speed, Play on the end, nor a paused written by someone else', () => {
    const { frames, holder, transport, calls } = endedRig();
    const length = transport.length();
    transport.play();
    frames.run(0);
    transport.pause();
    transport.seek(length);
    transport.seek(0);
    transport.setSpeed(-1);
    transport.setSpeed(1);
    transport.seek(length);
    transport.play();
    frames.run(16);
    holder.setPlayback(AT_START);
    frames.run(32);
    expect(holder.playback()).toEqual(AT_START);
    expect(calls).toEqual([]);
  });

  test('one that throws is reported as a frame’s error, and leaves no frame booked while paused (point 1)', () => {
    const { frames, holder, transport, calls, reports } = endedRig(true);
    const length = transport.length();
    transport.seek(length - 30);
    transport.play();
    frames.run(0);
    frames.run(100);
    expect(calls).toHaveLength(1);
    expect(reports).toEqual([new Error('an ended that fails')]);
    expect(holder.playback()).toEqual({ playing: false, atMs: length, speed: 1 });
    expect(frames.booked()).toBe(0);
    transport.play();
    expect(frames.booked()).toBe(1);
  });

  test('one that plays again and throws leaves a frame booked while playing, which moves it on (point 1)', () => {
    const made = rig(sceneOf(), 10_000, () => {
      made.transport.play();
      throw new Error('an ended that plays and fails');
    });
    const { frames, holder, transport, reports } = made;
    transport.seek(transport.length() - 30);
    transport.play();
    frames.run(0);
    frames.run(100);
    expect(reports).toEqual([new Error('an ended that plays and fails')]);
    expect(holder.playback()).toEqual({ playing: true, atMs: 0, speed: 1 });
    expect(frames.booked()).toBe(1);
    frames.run(200);
    expect(holder.playback().atMs).toBeCloseTo(FIRST_FRAME_MS);
  });
});
