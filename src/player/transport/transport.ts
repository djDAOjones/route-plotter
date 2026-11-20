// CORE-05: the player's transport (the plan's line 984: v3's AnimationEngine.js split, its play, pause, speed and frame
// loop here, its evaluation the core's timeline). It moves a position through the scene, in scene time with the holds
// (what a frame is asked to draw, compose.ts's `FrameRequest.sceneMs`), from 0 to the scene's play length. It names no
// browser global and imports nothing of the editor (rule 6): the frame source is handed in (in a test, the test's own),
// and so is where the playback is kept, a `PlaybackHolder`: the editor's store's slice, or `heldPlayback` for a player
// with no store. The play length comes from compose.ts's own sum (D174), built when a frame runs or a command needs it
// and the inputs are not those it was built from: never on a timer, never later (REL-698.1, REL-703.2, DEF-42.1).
// DEF-42.1 has two halves. The transport's: nothing is built until the length is read, and a frame builds it once
// however many changes came before. The reader's, carried to stage 6 (the preview and Open), which proves it with the
// real play bar on the real store: an interface reads `length()` only when it draws, and draws at most once a frame
// (the transport builds once per changed scene, however often it is read).
//
// The transport's claim (Codex's findings B and C on a3ced7d, T1 on 6ba74e8; every command and frame ends in `follow()`):
// 1. When any of its commands (play, pause, seek, setSpeed) returns or throws, and when any frame it runs ends, a frame
//    is booked if and only if what the holder holds is playing: whatever a subscriber did while it was told, and
//    whether or not the telling threw.
// 2. A "paused" written to the holder by someone else (the store's Open) is met by the frame already booked, which says
//    nothing and books no more (TST-04.2); until that frame, one frame may be booked.
// 3. Playing begins only through the transport's own commands. A "playing" written to the holder by anyone else,
//    outside a telling the transport is in the middle of, is not followed until the next command or frame. (The
//    editor's transport, stage 3, is the only thing that plays.)
// 4. It does not claim to withstand code written to break it.
import { playLength } from '../../core/clock/clock';
import type { Scene } from '../../core/model/scene';
import { CATALOGUE, type Catalogue } from '../../features/catalogue';
import { contentEnd, type ContentRequest } from '../compose';

/** What an interface shows of the transport. */
export interface Playback {
  readonly playing: boolean;
  /** The position: the scene's time in ms, holds included, from 0 to the play length. */
  readonly atMs: number;
  /** How fast it plays: 0.1 to 16 times normal, forwards or, below 0, backwards; never 0. */
  readonly speed: number;
}

/** At the start, paused, at normal speed: where a held playback and an opened project begin. */
export const AT_START: Playback = Object.freeze({ playing: false, atMs: 0, speed: 1 });

/**
 * Where the transport keeps its playback: `playback` gives what is held; `setPlayback` keeps a new one and tells. The
 * editor's store is one by shape (its slice); `heldPlayback` is one for a player with no store.
 */
export interface PlaybackHolder {
  playback(): Playback;
  setPlayback(next: Playback): void;
}

/** The frame source: books `callback` for the next frame, which it gives that frame's time in ms; cancels a booking. */
export interface FrameSource<H> {
  request(callback: (timeMs: number) => void): H;
  cancel(handle: H): void;
}

interface TransportOptions<H> {
  readonly frames: FrameSource<H>;
  readonly holder: PlaybackHolder;
  /** What the length is built from: read when a frame runs or a command needs the length, never kept beyond that. */
  readonly inputs: () => ContentRequest;
  /** Where an error thrown in a frame goes; the next frame is booked all the same (DEF-26). */
  readonly report: (error: unknown) => void;
  readonly catalogue?: Catalogue;
}

export interface Transport {
  /** Plays on from the position; on the end, going forwards, from the start at normal speed (v3's playback.js:405). */
  play(): void;
  /** Stops where it is, back at normal speed (DEF-15), with no frame booked (TST-04.2). */
  pause(): void;
  /** Moves the position to `ms`, held between 0 and the length; one that is not a number reads as 0 (clock.ts). */
  seek(ms: number): void;
  /** v3's clamp (AnimationEngine.js:948): 0.1 to 16 times, either way, never 0; one that is not a number is ignored. */
  setSpeed(speed: number): void;
  /** The scene's play length, built now if the inputs are not those it was last built from. */
  length(): number;
}

/** v3's MAX_DELTA_TIME (constants.js:14): one long gap between frames, a hidden tab's, moves no further than this. */
export const MAX_GAP_MS = 100;
/** The first frame after Play moves as far as one frame at sixty a second (v3, lines 175 to 179): never a jump. */
export const FIRST_FRAME_MS = 1000 / 60;
/** The slowest and fastest a playback plays, either way (v3's clamp): what the store's slice accepts. */
export const SLOWEST = 0.1;
export const FASTEST = 16;

/** What a length is built from, by value: the scene as the object itself (the store's are frozen), then numbers. */
type Key = readonly [Scene, number, number, number, number | null, number | null];
const keyOf = ({ scene, seed, size, image }: ContentRequest): Key => [
  scene, seed, size.width, size.height, image?.width ?? null, image?.height ?? null,
];
const sameKey = (a: Key, b: Key): boolean => a.every((value, i) => Object.is(value, b[i]));

const samePlayback = (a: Playback, b: Playback): boolean =>
  a.playing === b.playing && Object.is(a.atMs, b.atMs) && Object.is(a.speed, b.speed);

export function createTransport<H>({ frames, holder, inputs, report, catalogue = CATALOGUE }: TransportOptions<H>): Transport {
  let built: { readonly key: Key; readonly lengthMs: number } | null = null;
  /** The frame booked now and its ticket: a callback carrying any other ticket, one cancelled, does nothing. */
  let booked: { readonly handle: H; readonly ticket: object } | null = null;
  /** The last frame's time while playing; null until the first frame after Play, which moves as one frame would. */
  let lastMs: number | null = null;

  function lengthNow(): number {
    const from = inputs();
    const key = keyOf(from);
    if (built === null || !sameKey(built.key, key)) {
      built = { key, lengthMs: playLength(from.scene.settings.clock, contentEnd(from, catalogue)) };
    }
    return built.lengthMs;
  }

  /** Keeps `next` unless it is what is held already, so a change that changes nothing tells no one. */
  function write(playing: boolean, atMs: number, speed: number): void {
    const next: Playback = Object.freeze({ playing, atMs, speed });
    if (!samePlayback(holder.playback(), next)) holder.setPlayback(next);
  }

  function book(): void {
    if (booked !== null) return;
    const ticket = {};
    const handle = frames.request((timeMs) => {
      if (booked?.ticket === ticket) frame(timeMs);
    });
    booked = { ticket, handle };
  }

  function unbook(): void {
    if (booked === null) return;
    const { handle } = booked;
    booked = null;
    frames.cancel(handle);
  }

  /**
   * The claim's point 1, in one place: a frame booked while what is held plays, none while it is paused, and the last
   * frame's time forgotten, so a later resume moves as a first frame would, never by a stale gap. Every command and
   * every frame ends here however it ended: a subscriber told may have paused or played (findings B and T1), and a
   * write whose telling threw has still been kept (finding C).
   */
  function follow(): void {
    if (holder.playback().playing) {
      book();
    } else {
      lastMs = null;
      unbook();
    }
  }

  /** A command: `body`, then `follow()` however it ended. */
  function settled<A extends unknown[]>(body: (...args: A) => void): (...args: A) => void {
    return (...args) => {
      try {
        body(...args);
      } finally {
        follow();
      }
    };
  }

  /** One frame: moves the position by the time since the last, times the speed; stops on an end, as Pause does. */
  function advance(timeMs: number): void {
    const now = holder.playback();
    if (!now.playing) {
      lastMs = null;
      return;
    }
    const gapMs = lastMs === null ? FIRST_FRAME_MS : timeMs - lastMs;
    lastMs = timeMs;
    const lengthMs = lengthNow();
    const atMs = now.atMs + (Number.isFinite(gapMs) ? Math.min(Math.max(gapMs, 0), MAX_GAP_MS) : 0) * now.speed;
    if (atMs >= lengthMs || (now.speed < 0 && atMs <= 0)) {
      lastMs = null;
      write(false, atMs >= lengthMs ? lengthMs : 0, 1);
    } else {
      write(true, atMs, now.speed);
    }
  }

  function frame(timeMs: number): void {
    booked = null;
    try {
      advance(timeMs);
    } catch (error) {
      report(error);
    } finally {
      follow();
    }
  }

  return {
    play: settled(() => {
      const now = holder.playback();
      if (now.playing) return;
      const lengthMs = lengthNow();
      lastMs = null;
      if (now.speed > 0 && now.atMs >= lengthMs) write(true, 0, 1);
      else write(true, Math.min(Math.max(now.atMs, 0), lengthMs), now.speed);
    }),
    pause: settled(() => {
      lastMs = null;
      write(false, holder.playback().atMs, 1);
    }),
    seek: settled((ms: number) => {
      const lengthMs = lengthNow();
      const now = holder.playback();
      write(now.playing, Number.isNaN(ms) ? 0 : Math.min(Math.max(ms, 0), lengthMs), now.speed);
    }),
    setSpeed: settled((speed: number) => {
      if (Number.isNaN(speed)) return;
      const size = Math.min(Math.max(Math.abs(speed), SLOWEST), FASTEST);
      const now = holder.playback();
      write(now.playing, now.atMs, speed < 0 ? -size : size);
    }),
    length: lengthNow,
  };
}

interface HeldPlayback extends PlaybackHolder {
  /** Calls `listener` after every change; gives back the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/**
 * A playback of its own, for a player with no store. Subscribers are told after a change is kept: one that throws is
 * reported and never stops the others being told, nor the playing (D173). A `report` that throws is thrown again
 * once all have been told.
 */
export function heldPlayback(report: (error: unknown) => void): HeldPlayback {
  let held = AT_START;
  const listeners = new Set<{ readonly call: () => void }>();
  return {
    playback: () => held,
    setPlayback: (next) => {
      held = Object.freeze({ playing: next.playing, atMs: next.atMs, speed: next.speed });
      let lost: { readonly error: unknown } | null = null;
      for (const listener of [...listeners]) {
        try {
          listener.call();
        } catch (error) {
          try {
            report(error);
          } catch (failure) {
            lost ??= { error: failure };
          }
        }
      }
      if (lost !== null) throw lost.error;
    },
    subscribe: (call) => {
      const listener = { call };
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
