// CORE-02: the scene's one clock (the plan's §4, A2b; TST-03.6's one pause clock). The editor, video export and the
// player all read a moment of the scene through these functions, so Preview shows what an export shows.
import type { Scene } from '../model/scene';

export type ClockSettings = Scene['settings']['clock'];

/**
 * The scene's whole length in milliseconds. From the content: Hold at start, then until all the content has ended,
 * then Hold at end. Fixed: the author's length, Hold at start included; anything past it is cut, nothing stretched.
 */
export function playLength(clock: ClockSettings, contentEndMs: number): number {
  if (clock.length === 'fixed') return clock.fixedLengthMs;
  return clock.holdAtStartMs + Math.max(0, contentEndMs) + clock.holdAtEndMs;
}

/**
 * The content's time at a moment of the scene: still at 0 through Hold at start, then running with the scene until
 * the content ends or the scene does, whichever is first, then still on that last moment through Hold at end. A moment
 * before the scene, or one that is not a number, reads as its first.
 */
export function contentTime(clock: ClockSettings, contentEndMs: number, sceneMs: number): number {
  const length = playLength(clock, contentEndMs);
  const at = Number.isFinite(sceneMs) ? Math.min(Math.max(sceneMs, 0), length) : 0;
  return Math.min(Math.max(0, at - clock.holdAtStartMs), Math.max(0, contentEndMs));
}

/** The first moment of the scene at which a content time is shown: the inverse of `contentTime` within the content. */
export function sceneTime(clock: ClockSettings, contentEndMs: number, contentMs: number): number {
  const shown = Math.min(Math.max(contentMs, 0), Math.max(0, contentEndMs));
  return Math.min(shown + clock.holdAtStartMs, playLength(clock, contentEndMs));
}
