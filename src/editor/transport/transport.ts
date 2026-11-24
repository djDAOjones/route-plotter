// CORE-05, stage 3: the editor's own transport. The editor's commands over the player's transport, one function per
// command, each called by every way of asking for it: the shell binds a button and the key table's action of the same
// name to the one function (the key table's ids, src/editor/shell/keys.ts; this module does not import it). So Space,
// K and the Play button cannot differ (DEF-62), nor End, `>` and the skip button (INTAKE.26).
//
// It is handed the player's transport, where the playback is read (the store's `playback`), the announcement queue's
// `announce` and `canPlay`, whether the scene has anything to play (the session's, `hasSomethingToPlay` on the store's
// scene, read at each ask and never kept). It names no browser global, no React, no Carbon, no DOM: the frame source behind the player's
// transport and the binding of keys and buttons are the shell's (stage 5).
//
// Ported from v3, and what each leaves:
// - Play or pause (wiringControllers.js 273 to 288, `ui:animation:toggle`, Space and K): pause if playing; else back
//   to normal speed and play. The player's `pause` puts the speed back to normal (DEF-15) and its `play` plays from the
//   start when on the end going forwards (DEF-62).
// - Reverse (J) and forward (L), v3's live handler (wiringControllers.js 238 to 271): already playing that way, twice
//   as fast, 4 times at most; else that way at normal speed; and play if not playing. v3 kept a direction and a size
//   of its own (`jklDirection`, `jklSpeed`, line 235), which only its toggle reset; its reset on a pause, an end and a
//   reset (wiringBus.js 410 to 438, playback.js 151) cleared two other fields, so after any of those its L could resume
//   at the old speed. Here both are read from what is held (playing, the speed's sign and size), and the player's
//   pause and its stops on an end leave the speed at 1: J and L begin again at normal speed after each (D179), as
//   v3's own comment says they should ("speed multipliers are temporary review aids"). D177: L while playing forwards
//   doubles however the playing began; v3's first L after its Play button did not.
// - Skip to start (v3's `reset()`, wiringControllers.js 162 to 164): it stops, at the start, at normal speed
//   (AnimationEngine.js 483 to 497, AnimationState.js 22: playing false). Skip to end (`seekToProgress(1.0)`, line 165):
//   it moves to the end and leaves playing as it was; a forward playing then stops on the end at its next frame, as
//   the player's transport stops on any end, and that frame says "Animation complete" (below): the playing reached
//   the end by a frame of its own (ruling 3, brief 63). Each says so in v3's words (playback.js 430 to 442), through every way
//   of asking (INTAKE.26: v3's End, `.` and `>` said nothing).
// - Step back and step forward one frame (`,` and `.`, D205: what v3's table called them, which its handler never did).
//   A frame is 1000 ms over the scene's export frame rate (`frameRate`, handed in and read at each step, never kept;
//   the export model and the player count no frames of their own, so this is the one count). Frames are counted from
//   the scene's start: a step goes to the nearest whole frame strictly before, or strictly after, the position, held
//   between 0 and the length by the player's `seek`. A step pauses a playing scene first (the player's `pause`, which
//   puts the speed back to normal) and then says "Animation paused", Play or pause's words; a step from a pause says
//   nothing, as a scrub says nothing (the timeline's own value carries it). A step is never refused: with nothing to
//   play it still moves, as a skip does.
// - Scrub (`ui:animation:seek`, line 166): to a position in ms through the player's `seek`; it says nothing (a slider
//   says its own value) and leaves playing as it was. It never reads the length (DEF-42.1's other half is stage 6's).
// - The words (wiringBus.js 410 to 438), v3's own: "Playing animation" when a command starts the playing, "Animation
//   paused" when Play or pause stops it. v3's "Animation reset" is folded into the skip to start's "Skipped to start",
//   said once (v3 said both from the button). v3's "Animation complete" (wiringBus.js 422 to 429), said when a playing
//   reaches an end by itself, is not this module's: no command does that. The player's transport's frame that stops
//   on the end calls its `ended`, and the session hands in the saying of `WORDS.complete` there.
//
// Its claim:
// 1. One function per command, whichever way it was asked for (DEF-62, INTAKE.26).
// 2. Nothing to play (v3's playback.js 50 to 61): a start, by Play or pause, J or L, asks `canPlay` only when nothing
//    is playing; if it says no, the command says `WORDS.nothingToPlay` and changes nothing (no speed written, no
//    play). A pause, a skip, a step and a scrub are never refused and never ask. The rule (`hasSomethingToPlay`): some route
//    has two or more points; crowds join it with their own item.
// 3. It says only `WORDS`, through `announce`, and at most once a command.
import { EXPORT_SETTINGS } from '../../core/config/settings';
import type { Scene } from '../../core/model/scene';
import type { Announce } from '../kit/announce';
import type { Playback, Transport } from '../../player/transport/transport';

/** The fastest J and L play, either way: v3's 4 times. */
export const JKL_FASTEST = 4;

/** Every word the editor's transport says. */
export const WORDS = Object.freeze({
  playing: 'Playing animation',
  paused: 'Animation paused',
  skippedToStart: 'Skipped to start',
  skippedToEnd: 'Skipped to end',
  /** Said when a start is refused: v3's sentence cut to what v4 has (D190, provisional). */
  nothingToPlay: 'Add at least two points to a route to play.',
  /** Said when a playing reaches an end by itself (v3's words); the session hands it to the player's `ended`. */
  complete: 'Animation complete',
});

/** Whether `scene` has anything to play: some route with two or more points (the claim's point 2). */
export function hasSomethingToPlay(scene: Scene): boolean {
  return scene.routes.some((route) => route.points.length >= 2);
}

interface EditorTransportOptions {
  /** The player's transport, made on the store (`holder: store`). */
  readonly transport: Transport;
  /** Where the playback is read: the store's `playback`. */
  readonly playback: () => Playback;
  readonly announce: Announce;
  /** Whether the scene has anything to play now: asked at each start, never kept. */
  readonly canPlay: () => boolean;
  /**
   * The scene's export frame rate, frames a second: read at each step, never kept. The session hands the scene's own;
   * left out (a test that steps nothing), the setting's declared default is read, never a second number.
   */
  readonly frameRate?: () => number;
}

/** The editor's transport commands, each named as the key table's action it answers; `scrub` has no key. */
export interface EditorTransport {
  playPause(): void;
  reverse(): void;
  forward(): void;
  skipToStart(): void;
  skipToEnd(): void;
  /** To the nearest whole frame before the position, pausing a playing scene first. */
  stepBack(): void;
  /** To the nearest whole frame after the position, pausing a playing scene first. */
  stepForward(): void;
  /** To `ms` (held between 0 and the length by the player's transport), saying nothing. */
  scrub(ms: number): void;
}

export function createEditorTransport({
  transport, playback, announce, canPlay, frameRate = () => EXPORT_SETTINGS.frameRate.default,
}: EditorTransportOptions): EditorTransport {
  /** Runs `body`, then says so if it started the playing; from a pause with nothing to play, says why and runs nothing. */
  function starting(body: () => void): void {
    const was = playback().playing;
    if (!was && !canPlay()) {
      announce(WORDS.nothingToPlay);
      return;
    }
    body();
    if (!was && playback().playing) announce(WORDS.playing);
  }

  /** J (-1) and L (1): that way, twice as fast if already playing that way, 4 times at most; and play. */
  function jkl(way: 1 | -1): void {
    starting(() => {
      const { playing, speed } = playback();
      const size = playing && Math.sign(speed) === way ? Math.min(JKL_FASTEST, Math.abs(speed) * 2) : 1;
      transport.setSpeed(way * size);
      if (!playback().playing) transport.play();
    });
  }

  /** One frame back (-1) or forward (1) on the frames counted from the start; a playing scene is paused first. */
  function step(way: 1 | -1): void {
    if (playback().playing) {
      transport.pause();
      if (!playback().playing) announce(WORDS.paused);
    }
    const frame = 1000 / frameRate();
    const at = playback().atMs / frame;
    const near = Math.round(at);
    // A position within a millionth of a frame of a whole one counts as on it: 40 ms over 40 is 1, but 3 frames' worth
    // of ms read back may be 2.9999999999999996 frames.
    const on = Math.abs(at - near) < 1e-6 ? near : at;
    transport.seek((way === 1 ? Math.floor(on) + 1 : Math.ceil(on) - 1) * frame);
  }

  return Object.freeze({
    playPause: () => {
      if (playback().playing) {
        transport.pause();
        if (!playback().playing) announce(WORDS.paused);
        return;
      }
      starting(() => {
        transport.setSpeed(1);
        transport.play();
      });
    },
    reverse: () => {
      jkl(-1);
    },
    forward: () => {
      jkl(1);
    },
    skipToStart: () => {
      transport.pause();
      transport.seek(0);
      announce(WORDS.skippedToStart);
    },
    skipToEnd: () => {
      transport.seek(transport.length());
      announce(WORDS.skippedToEnd);
    },
    stepBack: () => {
      step(-1);
    },
    stepForward: () => {
      step(1);
    },
    scrub: (ms: number) => {
      transport.seek(ms);
    },
  });
}
