// CORE-04 stage 5b-2: how solid a stop's label is under `fade in`, from the plan's P2 alone: when the lead walks each
// line and the pauses it takes. Ported from v3's getTextVisibility (v3/src/services/TextLabelService.js:319–383), as
// renderLabel hands it its figures (v3/src/services/RenderingService.js:2536–2556): the lead's progress along the path
// against the stop's, which stands still in a pause, and a fade of 500 ms as a share of the base timeline. Progress
// times the way's moving time is the lead's moving ms, which v4's timeline holds as each line's depart and arrive, so
// the fade is worked in content ms. It reads no clock and keeps nothing between frames: each frame works out every
// point's figures in one pass each way over the points, in the order the core's timing reaches them, and each stop's
// opacity is then read off them. Written for the labels alone: one feature never reaches another's code (D148).
import type { Timeline } from '../../../core/timing/timeline';

/** v3's TEXT_LABEL.FADE_DURATION (v3/src/config/constants.js:410), a share of the base timeline. */
const FADE_MS = 500;

/** v3's base timeline when there is none (RenderingService.js:2546). */
const NO_BASE_MS = 10_000;

/** v3's first stop: one whose progress is at most this share of the way (TextLabelService.js:341). */
const FIRST = 0.001;

/** v3's Easing.cubicOut (v3/src/utils/Easing.js:30–33). */
const cubicOut = (t: number) => (t - 1) ** 3 + 1;

type Times = Pick<Timeline, 'start' | 'lines' | 'points' | 'endMs'>;
type LineTime = Times['lines'][number];
type Outs = ReadonlyMap<string, readonly LineTime[]>;

const durationOf = (line: LineTime) => line.arriveMs - line.departMs;

/** How far into a line the lead is at `t`, in moving ms: none before it departs, the whole line once it arrives. */
const intoLine = (line: LineTime, t: number) => Math.min(Math.max(0, t - line.departMs), durationOf(line));

/** A point's figures back along the lines it is reached by, at the frame's moment. */
interface Behind {
  /** The moving time back to the start, along the line the lead arrives by at each point: v3's stop progress. */
  readonly backMs: number;
  /** How much of that the lead has walked at `t`: v3's progress, standing still in a pause. */
  readonly walkedMs: number;
}

/** Each point's lines: the one the lead arrives by (at a join the latest in, as its own arrival is), and those out. */
function linesOf(times: Times) {
  const into = new Map<string, LineTime>();
  const outs = new Map<string, LineTime[]>();
  for (const line of times.lines) {
    if (!into.has(line.to) && line.arriveMs === times.points.get(line.to)?.arriveMs) into.set(line.to, line);
    const out = outs.get(line.from);
    if (out === undefined) outs.set(line.from, [line]);
    else out.push(line);
  }
  return { into, outs };
}

/**
 * The points in the order the core's timing reaches them, each after every line into it (as `pass` in
 * src/core/timing/timeline.ts), whatever the walk's depth-first order of lines: so a join comes after its every line
 * in, and what follows it after the join. A point on a loop, which the core never times, is left out.
 */
function orderOf(times: Times, outs: Outs): string[] {
  const waiting = new Map<string, number>();
  for (const line of times.lines) waiting.set(line.to, (waiting.get(line.to) ?? 0) + 1);
  const ends = new Set([...times.points.keys(), ...times.lines.map((line) => line.from)]);
  const ready = [...ends].filter((id) => !waiting.has(id));
  const order: string[] = [];
  for (let at = ready.pop(); at !== undefined; at = ready.pop()) {
    order.push(at);
    for (const line of outs.get(at) ?? []) {
      const left = (waiting.get(line.to) ?? 1) - 1;
      waiting.set(line.to, left);
      if (left === 0) ready.push(line.to);
    }
  }
  return order;
}

/** Forward over the points: each one's moving time back, and how much of it the lead has walked at `t`. */
function behindOf(times: Times, into: ReadonlyMap<string, LineTime>, order: readonly string[], t: number) {
  const behind = new Map<string, Behind>();
  for (const id of order) {
    const line = id === times.start ? undefined : into.get(id);
    if (line === undefined) {
      behind.set(id, { backMs: 0, walkedMs: 0 });
      continue;
    }
    const from = behind.get(line.from);
    const backMs = (from?.backMs ?? 0) + durationOf(line);
    behind.set(id, { backMs, walkedMs: (from?.walkedMs ?? 0) + intoLine(line, t) });
  }
  return behind;
}

/** Back over the points: each one's moving time on, along its first lines out to their end. */
function aheadOf(outs: Outs, order: readonly string[]) {
  const onMs = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const first = outs.get(id)?.[0];
    onMs.set(id, first === undefined ? 0 : durationOf(first) + (onMs.get(first.to) ?? 0));
  }
  return onMs;
}

/**
 * Each stop's label opacity at `t`, from 0 to 1, under a fade. Set up once a frame; then a stop's opacity is a few
 * reads of what was set up.
 */
export function fadesOf(times: Times, t: number) {
  const { into, outs } = linesOf(times);
  const order = orderOf(times, outs);
  const behind = behindOf(times, into, order, t);
  const ahead = aheadOf(outs, order);
  // v3's base timeline: the lead's own walk, its pauses in (v3/src/utils/branchTiming.js:107), what the scene waits
  // for after it out (RenderingService.js:2543–2546).
  const startMs = times.start === null ? 0 : (times.points.get(times.start)?.arriveMs ?? 0);
  const baseMs = times.endMs - startMs > 0 ? times.endMs - startMs : NO_BASE_MS;
  return (pointId: string): number => {
    const back = behind.get(pointId);
    // A stop the walk never reaches is as one not yet reached (D136): hidden.
    if (back === undefined) return 0;
    // The moving time of the stop's own way, v3's path duration: on a straight route, the whole walk's.
    const wayMs = back.backMs + (ahead.get(pointId) ?? 0);
    // v3's first stop shows from the start (:344–347).
    if (back.backMs <= FIRST * wayMs) return 1;
    const windowMs = (FADE_MS * wayMs) / baseMs;
    const toGoMs = back.backMs - back.walkedMs;
    // Hidden before the window, then the fade in (:349–356), then whole once the lead is there.
    if (toGoMs >= windowMs) return 0;
    if (toGoMs > 0) return cubicOut(1 - toGoMs / windowMs);
    return 1;
  };
}
