// CORE-05, stage 5: the play bar's timeline, v3's scrub slider ported (v3/index.html 1481 to 1486, UIController.js 970
// to 973 and 2624 to 2641), as logic with no page. Nothing here names a browser global: the frame source is handed in,
// so Node proves it with frames run by hand.
//
// - The length reader is DEF-42.1's reader's half: the length is read through it alone, at most once a frame. It reads
//   the player's `length()` the first time it is asked, and again only at a frame it books when the store tells of a
//   change and the scene is no longer the object the length was read for: one frame however many changes came before
//   it, none for a change of the playback alone, none on a still page. A length one frame old after a scene change is
//   accepted. It tells its own listeners when the length it holds changes, so a timeline drawn before that frame draws
//   again after it.
// - The timeline's `Setting` holds v3's thousandths of the length, a whole number from 0 to 1000 (0 while the length is
//   0). An edit's `set(p)` scrubs to p / 1000 of the length; `commit` keeps nothing and makes no undo step (the playback
//   is outside undo); `cancel` scrubs back to the position the edit began at, in ms, exactly. A scrub is never refused
//   and never stops or starts a playing: a drag while playing moves the position and the playing goes on from there.
// - An edit begun before a project is opened changes nothing after the open (PRS2, brief 94): its `set` and its `cancel`
//   scrub nothing and answer "nothing changed"; its `commit` answers as before. The timeline is told of an open through
//   `opened`, an option that must be given: the opener's count of projects put in the store, which an edit remembers
//   at `begin`; it never guesses one from what the store holds, so Undo or Redo in the middle of an edit leaves it alive
//   (its cancel still scrubs back). An Open so closes the timeline's edit as it closes a store gesture. What it costs:
//   a drag in hand when a project opens moves nothing more until the pointer is let go and pressed again.
// - Its words are v3's: the time now and the whole time, in whole seconds as m:ss, rounded down ("0:01 of 0:02").
import type { Scene } from '../../core/model/scene';
import type { Begun, Result, Setting } from '../kit/controls';
import type { FrameSource } from '../../player/transport/transport';
import type { Store } from '../store/store';
import type { EditorTransport } from '../transport/transport';

/** v3's ANIMATION.TIMELINE_RESOLUTION: the timeline's range is 0 to this, step 1. */
export const THOUSANDTHS = 1000;

/** The length of the scene, read at most once a frame. */
export interface LengthReader {
  /** The length last read, in ms: read now the first time it is asked, then only at a frame booked after a change. */
  held(): number;
  /** Calls `listener` when the length held changes; gives back the call that stops it. */
  subscribe(listener: () => void): () => void;
}

export interface LengthReaderOptions<H> {
  readonly store: Pick<Store, 'getState' | 'subscribe'>;
  /** The player's transport's `length()`, which builds the timing when the scene has changed. */
  readonly length: () => number;
  readonly frames: FrameSource<H>;
}

export function createLengthReader<H>({ store, length, frames }: LengthReaderOptions<H>): LengthReader {
  /** The scene the length held was read for; null until it is first asked. */
  let readFor: Scene | null = null;
  let held = 0;
  let booked = false;
  const listeners = new Set<() => void>();

  const read = (): void => {
    readFor = store.getState().project.scene;
    held = length();
  };

  store.subscribe(() => {
    if (readFor === null || booked || store.getState().project.scene === readFor) return;
    booked = true;
    frames.request(() => {
      booked = false;
      if (store.getState().project.scene === readFor) return;
      const was = held;
      read();
      if (held !== was) for (const listener of [...listeners]) listener();
    });
  });

  return {
    held: () => {
      if (readFor === null) read();
      return held;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** v3's formatTime (UIController.js 2637 to 2641): whole seconds, rounded down, as m:ss. */
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Which end of the range a label stands at: the time now before the slider, the whole time after it (v3's row). */
type End = 'start' | 'end';

export interface Timeline {
  /** The thousandths of the length the position stands at, and the scrub an edit makes. */
  readonly setting: Setting;
  /** The words for a thumb at `value` ("0:01 of 0:02"), or with `end`, the time that end's label shows. */
  readonly readout: (value: number, end?: End) => string;
  /** The words read out now: a snapshot that changes whenever the time now or the whole time does. */
  readonly words: () => string;
}

export interface TimelineOptions {
  readonly store: Pick<Store, 'playback' | 'subscribe'>;
  /** The editor's transport: its `scrub` holds the position between 0 and the length and says nothing. */
  readonly transport: Pick<EditorTransport, 'scrub'>;
  readonly length: LengthReader;
  /**
   * How many projects have been opened into the store (the opener's `opened`): an edit begun before the count changes
   * changes nothing after. It must be given, so the typecheck refuses a session that forgets it; a test of the
   * timeline alone, with no opener, gives `() => 0` (no open is ever counted).
   */
  readonly opened: () => number;
}

const NOTHING: Result = { ok: true, changed: false };

export function createTimeline({ store, transport, length, opened }: TimelineOptions): Timeline {
  const atMs = () => store.playback().atMs;
  const read = (): number => {
    const whole = length.held();
    if (whole <= 0) return 0;
    return Math.min(THOUSANDTHS, Math.max(0, Math.round((atMs() / whole) * THOUSANDTHS)));
  };
  const scrubTo = (ms: number): Result => {
    const was = atMs();
    transport.scrub(ms);
    return { ok: true, changed: atMs() !== was };
  };

  const setting: Setting = {
    read,
    subscribe: (listener) => {
      const fromStore = store.subscribe(listener);
      const fromLength = length.subscribe(listener);
      return () => {
        fromStore();
        fromLength();
      };
    },
    begin: (): Begun => {
      const from = atMs();
      /** The opens counted when the edit began: a project opened since closes the edit (PRS2). */
      const begunAt = opened();
      let open = true;
      const live = (): boolean => open && opened() === begunAt;
      return {
        ok: true,
        edit: {
          set: (value) => (live() ? scrubTo((value / THOUSANDTHS) * length.held()) : NOTHING),
          commit: () => {
            open = false;
            return NOTHING;
          },
          cancel: () => {
            if (!live()) {
              open = false;
              return NOTHING;
            }
            open = false;
            return scrubTo(from);
          },
        },
      };
    },
  };

  const readout = (value: number, end?: End): string => {
    const whole = length.held();
    if (end === 'start') return formatTime(atMs());
    if (end === 'end') return formatTime(whole);
    const now = value === read() ? atMs() : (value / THOUSANDTHS) * whole;
    return `${formatTime(now)} of ${formatTime(whole)}`;
  };

  return Object.freeze({ setting, readout, words: () => readout(read()) });
}
