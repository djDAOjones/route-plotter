// CORE-04 stage 5b-1: when a stop's marker shows, from the plan's P2 alone: when the lead reaches each stop and the
// pauses it takes there. Ported from v3's getWaypointVisibility (v3/src/services/MotionVisibilityService.js:393–553,
// its WAYPOINT_ANIM :288–301) into content ms: v3's path progress times its path duration is the lead's moving time,
// which v4's timeline holds as each line's depart and arrive. It reads no clock and keeps nothing between frames.
import type { Timeline } from '../../../core/timing/timeline';

/** v3's WAYPOINT_ANIM: a grow of 0.25 s, held between 1% and 8% of the walk's moving time; no overshoot. */
const GROW = { targetMs: 250, least: 0.01, most: 0.08 };

/** v3's "at the stop" share of the walk's moving time, just after the lead leaves (phase 3, :533). */
const AT_STOP = 0.001;

/** v3's ease-out with an overshoot of 1.0, a cubic (easeOutBack, MotionVisibilityService.js:570–578). */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** The appearances that change over time; "always" and "never" need no timing. */
export type Timed = 'from arrival' | 'until arrival' | 'at arrival';

type Times = Pick<Timeline, 'start' | 'lines' | 'points'>;
type LineTime = Times['lines'][number];

/** What a stop's grow reads of the walk behind it: the moving time from the stop before, and that stop. */
interface Behind {
  readonly gapMs: number;
  readonly previous: string | null;
}

/** What the walks back and forward read: the timeline, the route's stops, and the line the lead arrives at each by. */
interface Graph {
  readonly times: Times;
  readonly stops: ReadonlySet<string>;
  readonly into: ReadonlyMap<string, LineTime>;
}

/** Back from a stop through bends to the stop before it, or to the start when no stop stands between (v3's -1). */
function behind(graph: Graph, pointId: string, arriveMs: number): Behind {
  const { times, stops, into } = graph;
  if (pointId === times.start) return { gapMs: 0, previous: null };
  const seen = new Set<string>();
  let line = into.get(pointId);
  let leftMs = arriveMs;
  while (line !== undefined && !seen.has(line.from)) {
    seen.add(line.from);
    leftMs = line.departMs;
    if (stops.has(line.from)) return { gapMs: arriveMs - leftMs, previous: line.from };
    if (line.from === times.start) break;
    line = into.get(line.from);
  }
  return { gapMs: arriveMs - leftMs, previous: null };
}

/** Forward from a stop through bends: the least moving time to the next stop, or to a branch's end (v3's 1). */
function ahead(graph: Graph, pointId: string): { readonly aheadMs: number; readonly toStop: boolean } {
  const { times, stops } = graph;
  let best = { aheadMs: Infinity, toStop: false };
  const walk = (from: string, sofarMs: number, seen: ReadonlySet<string>) => {
    const out = times.lines.filter((line) => line.from === from);
    if (out.length === 0 && sofarMs < best.aheadMs && from !== pointId) best = { aheadMs: sofarMs, toStop: false };
    for (const line of out) {
      const ms = sofarMs + line.arriveMs - line.departMs;
      if (stops.has(line.to)) best = ms < best.aheadMs ? { aheadMs: ms, toStop: true } : best;
      else if (!seen.has(line.to)) walk(line.to, ms, new Set([...seen, line.to]));
    }
  };
  walk(pointId, 0, new Set([pointId]));
  return Number.isFinite(best.aheadMs) ? best : { aheadMs: 0, toStop: false };
}

/**
 * How big each stop's marker is at a moment, as a share of its look's size (v3's waypointScale): 0 hides it.
 * `stops` are the route's stops by id. Each stop goes by its own arrival and its own lines, never another branch's
 * progress (DEF-05's marker half); at a join, by the core's arrival, the latest line in.
 */
export function timingOf(times: Times, stops: ReadonlySet<string>) {
  const movingMs = times.lines.reduce((sum, line) => sum + (line.arriveMs - line.departMs), 0);
  const leastMs = GROW.least * movingMs;
  const idealMs = Math.max(leastMs, Math.min(GROW.most * movingMs, GROW.targetMs));
  // The line the lead arrives at each point by: at a join, the latest in, as the point's own arrival is.
  const into = new Map<string, LineTime>();
  for (const line of times.lines) {
    if (!into.has(line.to) && line.arriveMs === times.points.get(line.to)?.arriveMs) into.set(line.to, line);
  }
  const graph: Graph = { times, stops, into };

  /** Before the lead's arrival, hiding before: v3's grow, with its early start in the stop before's pause. */
  function growing(pointId: string, arriveMs: number, t: number): number {
    const { gapMs, previous } = behind(graph, pointId, arriveMs);
    const inMs = Math.max(leastMs, Math.min(idealMs, previous === null ? gapMs : gapMs / 2));
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

  /** After the lead leaves, hiding after: v3's shrink (:537–546), over half the way to the next stop at most. */
  function shrinking(pointId: string, leftMs: number): number {
    const { aheadMs, toStop } = ahead(graph, pointId);
    // v3's window ends with the walk (:436): past a branch's end the marker keeps the size it had there.
    const sinceMs = toStop ? leftMs : Math.min(leftMs, aheadMs);
    if (sinceMs === 0 || sinceMs < AT_STOP * movingMs) return 1;
    const outMs = Math.max(leastMs, Math.min(idealMs, toStop ? aheadMs / 2 : aheadMs));
    return sinceMs < outMs ? 1 - (sinceMs / outMs) ** 3 : 0;
  }

  return (pointId: string, appearance: Timed, t: number): number => {
    const time = times.points.get(pointId);
    // A stop the walk never reaches is as one not yet reached (D136).
    if (time === undefined) return appearance === 'until arrival' ? 1 : 0;
    if (t < time.arriveMs) return appearance === 'until arrival' ? 1 : growing(pointId, time.arriveMs, t);
    // Whole from the lead's arrival and over its pause; then, hiding after, v3's ease-in shrink (easeInBack, :584).
    if (t < time.departMs || appearance === 'from arrival') return 1;
    return shrinking(pointId, t - time.departMs);
  };
}
