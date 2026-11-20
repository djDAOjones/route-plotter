// CORE-04 stage 5b-1: when a stop's marker shows, from the plan's P2 alone: when the lead reaches each stop and the
// pauses it takes there. Ported from v3's getWaypointVisibility (v3/src/services/MotionVisibilityService.js:393–553,
// its WAYPOINT_ANIM :288–301) into content ms: v3's path progress times its path duration is the lead's moving time,
// which v4's timeline holds as each line's depart and arrive. It reads no clock and keeps nothing between frames: each
// frame works out every point's figures in one pass each way over the points, in the order the core's timing reaches
// them, and each stop's scale is then read off them.
import type { Timeline } from '../../../core/timing/timeline';

/** v3's WAYPOINT_ANIM: a grow of 0.25 s, held between 1% and 8% of the way's moving time; no overshoot. */
const GROW = { targetMs: 250, least: 0.01, most: 0.08 };

/** v3's "at the stop" share of the way's moving time, just after the lead leaves (phase 3, :533). */
const AT_STOP = 0.001;

/** v3's ease-out with an overshoot of 1.0, a cubic (easeOutBack, MotionVisibilityService.js:570–578). */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** The appearances that change over time; "always" and "never" need no timing. */
export type Timed = 'from arrival' | 'until arrival' | 'at arrival';

type Times = Pick<Timeline, 'start' | 'lines' | 'points'>;
type LineTime = Times['lines'][number];
type Outs = ReadonlyMap<string, readonly LineTime[]>;

const durationOf = (line: LineTime) => line.arriveMs - line.departMs;

/** What a stop's walk on meets: a next stop, or a branch's end, no moving time on. */
const AT_A_STOP = { aheadMs: 0, toStop: true };
const AT_AN_END = { aheadMs: 0, toStop: false };

/** A point's figures back along the lines it is reached by. */
interface Behind {
  /** The moving time back to the start, along the line the lead arrives by at each point. */
  readonly backMs: number;
  /** When the lead left the stop before, through bends, or the start when no stop stands between (v3's -1). */
  readonly leftMs: number;
  readonly previous: string | null;
}

/** A point's figures on along its lines out, at the frame's moment. */
interface Ahead {
  /** The moving time on along its first lines out to their end: v3's window never ends past it (animOutEnd ≤ 1). */
  readonly onMs: number;
  /** The least moving time on to a next stop or a branch's end, through bends, and whether it is a stop. */
  readonly aheadMs: number;
  readonly toStop: boolean;
  /** The moving time since the lead left it, on along its first lines out: a pause stands still. */
  readonly movedMs: number;
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

/** Forward over the points: each one's moving time back, and the stop before it, from the point it is reached from. */
function behindOf(times: Times, stops: ReadonlySet<string>, into: ReadonlyMap<string, LineTime>, order: string[]) {
  const behind = new Map<string, Behind>();
  for (const id of order) {
    const line = into.get(id);
    if (line === undefined || id === times.start) {
      behind.set(id, { backMs: 0, leftMs: times.points.get(id)?.arriveMs ?? 0, previous: null });
      continue;
    }
    const from = behind.get(line.from);
    const backMs = (from?.backMs ?? 0) + durationOf(line);
    // Back through a bend the lead arrives at by a line, to the stop before; a stop, the start or a point reached by
    // no line ends the walk back at the line out of it.
    const bend = !stops.has(line.from) && line.from !== times.start && into.has(line.from);
    if (bend && from !== undefined) behind.set(id, { backMs, leftMs: from.leftMs, previous: from.previous });
    else behind.set(id, { backMs, leftMs: line.departMs, previous: stops.has(line.from) ? line.from : null });
  }
  return behind;
}

/** Back over the points: each one's moving time on, its least time ahead and its moving time since it was left at `t`. */
function aheadOf(stops: ReadonlySet<string>, outs: Outs, order: readonly string[], t: number) {
  const ahead = new Map<string, Ahead>();
  for (const id of [...order].reverse()) {
    const lines = outs.get(id) ?? [];
    const first = lines[0];
    const next = first === undefined ? undefined : ahead.get(first.to);
    const onMs = first === undefined ? 0 : durationOf(first) + (next?.onMs ?? 0);
    const sinceMs = first === undefined ? 0 : Math.min(Math.max(0, t - first.departMs), durationOf(first));
    const movedMs = first !== undefined && t >= first.arriveMs ? sinceMs + (next?.movedMs ?? 0) : sinceMs;
    // No line out: v3's last stop, or a branch's end, whose window ends where it stands.
    let least = lines.length === 0 ? AT_AN_END : { aheadMs: Infinity, toStop: false };
    for (const line of lines) {
      const beyond = stops.has(line.to) ? AT_A_STOP : (ahead.get(line.to) ?? AT_AN_END);
      const ms = durationOf(line) + beyond.aheadMs;
      if (ms < least.aheadMs) least = { aheadMs: ms, toStop: beyond.toStop };
    }
    ahead.set(id, { onMs, movedMs, ...least });
  }
  return ahead;
}

/** The ideal grow for a way: v3's 250 ms, held between 1% and 8% of the way's moving time. */
const idealOf = (wayMs: number) => Math.max(GROW.least * wayMs, Math.min(GROW.most * wayMs, GROW.targetMs));

/** Before the lead's arrival, hiding before: v3's grow, with its early start in the stop before's pause. */
function growing(times: Times, behind: Behind, arriveMs: number, t: number, wayMs: number): number {
  const { previous } = behind;
  const gapMs = arriveMs - behind.leftMs;
  const inMs = Math.max(GROW.least * wayMs, Math.min(idealOf(wayMs), previous === null ? gapMs : gapMs / 2));
  // v3 never starts a grow before the stop before: the window is clamped to the gap (:434–439).
  const windowMs = Math.min(inMs, gapMs);
  // Stops closer than a grow's 250 ms start it in the stop before's pause (:457–505). The pause read is the one the
  // lead takes, so the route's first stop, where it never waits, gives no head start (TST-03.2, D145).
  const deficitMs = previous === null ? 0 : Math.max(0, GROW.targetMs - gapMs);
  const before = previous === null ? undefined : times.points.get(previous);
  const pauseMs = before === undefined ? 0 : before.departMs - before.arriveMs;
  if (before !== undefined && deficitMs > 0 && pauseMs > 0 && t >= before.arriveMs && t < before.departMs) {
    const startsMs = Math.max(0, pauseMs - deficitMs);
    const elapsedMs = t - before.arriveMs;
    if (elapsedMs < startsMs) return 0;
    return easeOut(Math.min(deficitMs / GROW.targetMs, (elapsedMs - startsMs) / GROW.targetMs));
  }
  const headStart = deficitMs > 0 && pauseMs > 0 ? Math.min(deficitMs, pauseMs) / GROW.targetMs : 0;
  const remainingMs = arriveMs - t;
  if (remainingMs > windowMs) return 0;
  if (windowMs <= 0) return 1;
  return easeOut(Math.min(1, headStart + ((windowMs - remainingMs) / windowMs) * (1 - headStart)));
}

/** After the lead leaves, hiding after: v3's cubic shrink (easeInBack, :537–546, :584), in moving time. */
function shrinking({ onMs, aheadMs, toStop, movedMs }: Ahead, wayMs: number): number {
  const outMs = Math.max(GROW.least * wayMs, Math.min(idealOf(wayMs), toStop ? aheadMs / 2 : aheadMs));
  // v3's window ends with the walk (animOutEnd = min(1, …), :436), a next stop or not: never past the end of the
  // stop's own lines on, and at a branch's end nearer still, the marker is gone.
  const endMs = Math.min(outMs, toStop ? onMs : aheadMs);
  if (movedMs === 0 || movedMs < AT_STOP * wayMs) return 1;
  return movedMs < endMs ? 1 - (movedMs / outMs) ** 3 : 0;
}

/**
 * How big each stop's marker is at the moment `t`, as a share of its look's size (v3's waypointScale): 0 hides it.
 * `stops` are the route's stops by id. Each stop goes by its own arrival, its own lines and its own way's moving
 * time, never another branch's (DEF-05's marker half); at a join, by the core's arrival, the latest line in (D146).
 * The set-up is one pass each way over the points, so a frame's work grows with the points, not their square.
 */
export function timingOf(times: Times, stops: ReadonlySet<string>, t: number) {
  const { into, outs } = linesOf(times);
  const order = orderOf(times, outs);
  const behind = behindOf(times, stops, into, order);
  const ahead = aheadOf(stops, outs, order, t);
  return (pointId: string, appearance: Timed): number => {
    const time = times.points.get(pointId);
    // A stop the walk never reaches is as one not yet reached (D136).
    if (time === undefined) return appearance === 'until arrival' ? 1 : 0;
    const back = behind.get(pointId) ?? { backMs: 0, leftMs: time.arriveMs, previous: null };
    const on = ahead.get(pointId) ?? { onMs: 0, aheadMs: 0, toStop: false, movedMs: 0 };
    // The moving time of the stop's own way, v3's path duration: on a straight route, the whole walk's.
    const wayMs = back.backMs + on.onMs;
    if (t < time.arriveMs) return appearance === 'until arrival' ? 1 : growing(times, back, time.arriveMs, t, wayMs);
    // Whole from the lead's arrival and over its pause; then, hiding after, the shrink.
    if (t < time.departMs || appearance === 'from arrival') return 1;
    return shrinking(on, wayMs);
  };
}
