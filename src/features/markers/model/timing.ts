// CORE-04 stage 5b-1: when a stop's marker shows, from the plan's P2 alone: when the lead reaches each stop and the
// pauses it takes there. Ported from v3's getWaypointVisibility (v3/src/services/MotionVisibilityService.js:393–553,
// its WAYPOINT_ANIM :288–301) into content ms: v3's path progress times its path duration is the lead's moving time,
// which v4's timeline holds as each line's depart and arrive. It reads no clock and keeps nothing between frames.
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

const durationOf = (line: LineTime) => line.arriveMs - line.departMs;

/** What the walks back and forward read: the timeline, the route's stops, and its lines by point. */
interface Graph {
  readonly times: Times;
  readonly stops: ReadonlySet<string>;
  /** The line the lead arrives at each point by: at a join, the latest in, as the point's own arrival is. */
  readonly into: ReadonlyMap<string, LineTime>;
  /** Each point's lines out, in walk order. */
  readonly outs: ReadonlyMap<string, readonly LineTime[]>;
}

function graphOf(times: Times, stops: ReadonlySet<string>): Graph {
  const into = new Map<string, LineTime>();
  const outs = new Map<string, LineTime[]>();
  for (const line of times.lines) {
    if (!into.has(line.to) && line.arriveMs === times.points.get(line.to)?.arriveMs) into.set(line.to, line);
    const out = outs.get(line.from);
    if (out === undefined) outs.set(line.from, [line]);
    else out.push(line);
  }
  return { times, stops, into, outs };
}

/**
 * The moving time of each point's own way, v3's path duration: back along the lines the lead arrives by, then on
 * along each first line out to an end. On a straight route, the whole walk's; a branch the point is not on leaves it
 * alone (DEF-05). Each line is passed once in walk order and once back.
 */
function waysOf({ times, into, outs }: Graph): ReadonlyMap<string, number> {
  const back = new Map<string, number>();
  for (const line of times.lines) {
    if (into.get(line.to) === line) back.set(line.to, (back.get(line.from) ?? 0) + durationOf(line));
  }
  const on = new Map<string, number>();
  for (const line of [...times.lines].reverse()) {
    if (outs.get(line.from)?.[0] === line) on.set(line.from, durationOf(line) + (on.get(line.to) ?? 0));
  }
  return new Map([...times.points.keys()].map((id) => [id, (back.get(id) ?? 0) + (on.get(id) ?? 0)]));
}

/** Back from a stop through bends to the stop before it, or to the start when no stop stands between (v3's -1). */
function behind({ times, stops, into }: Graph, pointId: string, arriveMs: number) {
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

/** Forward from a stop through bends, with no recursion: the least moving time to a next stop or a branch's end. */
function ahead({ stops, outs }: Graph, pointId: string) {
  let best = { aheadMs: Infinity, toStop: false };
  const least = new Map([[pointId, 0]]);
  const queue: [string, number][] = [[pointId, 0]];
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    const [from, sofarMs] = next;
    const lines = outs.get(from) ?? [];
    if (lines.length === 0 && from !== pointId && sofarMs < best.aheadMs) best = { aheadMs: sofarMs, toStop: false };
    for (const line of lines) {
      const ms = sofarMs + durationOf(line);
      if (stops.has(line.to)) {
        if (ms < best.aheadMs) best = { aheadMs: ms, toStop: true };
      } else if (ms < (least.get(line.to) ?? Infinity)) {
        least.set(line.to, ms);
        queue.push([line.to, ms]);
      }
    }
  }
  // No line out: v3's last stop, whose window ends where it stands.
  return Number.isFinite(best.aheadMs) ? best : { aheadMs: 0, toStop: false };
}

/** Moving time since the lead left a point, on along its first lines out, up to `capMs`: a pause stands still. */
function movedSince({ outs }: Graph, pointId: string, t: number, capMs: number): number {
  let movedMs = 0;
  const seen = new Set([pointId]);
  for (let line = outs.get(pointId)?.[0]; line !== undefined; line = outs.get(line.to)?.[0]) {
    movedMs += Math.min(Math.max(0, t - line.departMs), durationOf(line));
    if (t < line.arriveMs || movedMs >= capMs || seen.has(line.to)) break;
    seen.add(line.to);
  }
  return movedMs;
}

/** The ideal grow for a way: v3's 250 ms, held between 1% and 8% of the way's moving time. */
const idealOf = (wayMs: number) => Math.max(GROW.least * wayMs, Math.min(GROW.most * wayMs, GROW.targetMs));

/** Before the lead's arrival, hiding before: v3's grow, with its early start in the stop before's pause. */
function growing(graph: Graph, pointId: string, arriveMs: number, t: number, wayMs: number): number {
  const { gapMs, previous } = behind(graph, pointId, arriveMs);
  const inMs = Math.max(GROW.least * wayMs, Math.min(idealOf(wayMs), previous === null ? gapMs : gapMs / 2));
  // v3 never starts a grow before the stop before: the window is clamped to the gap (:434–439).
  const windowMs = Math.min(inMs, gapMs);
  // Stops closer than a grow's 250 ms start it in the stop before's pause (:457–505). The pause read is the one the
  // lead takes, so the route's first stop, where it never waits, gives no head start (TST-03.2, D145).
  const deficitMs = previous === null ? 0 : Math.max(0, GROW.targetMs - gapMs);
  const before = previous === null ? undefined : graph.times.points.get(previous);
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
function shrinking(graph: Graph, pointId: string, t: number, wayMs: number): number {
  const { aheadMs, toStop } = ahead(graph, pointId);
  const outMs = Math.max(GROW.least * wayMs, Math.min(idealOf(wayMs), toStop ? aheadMs / 2 : aheadMs));
  // v3's window ends with the walk (animOutEnd ≤ 1, :436): at a branch's end the marker is gone.
  const endMs = toStop ? outMs : Math.min(outMs, aheadMs);
  const sinceMs = movedSince(graph, pointId, t, endMs);
  if (sinceMs === 0 || sinceMs < AT_STOP * wayMs) return 1;
  return sinceMs < endMs ? 1 - (sinceMs / outMs) ** 3 : 0;
}

/**
 * How big each stop's marker is at a moment, as a share of its look's size (v3's waypointScale): 0 hides it.
 * `stops` are the route's stops by id. Each stop goes by its own arrival, its own lines and its own way's moving
 * time, never another branch's (DEF-05's marker half); at a join, by the core's arrival, the latest line in (D146).
 */
export function timingOf(times: Times, stops: ReadonlySet<string>) {
  const graph = graphOf(times, stops);
  const ways = waysOf(graph);
  return (pointId: string, appearance: Timed, t: number): number => {
    const time = times.points.get(pointId);
    // A stop the walk never reaches is as one not yet reached (D136).
    if (time === undefined) return appearance === 'until arrival' ? 1 : 0;
    const wayMs = ways.get(pointId) ?? 0;
    if (t < time.arriveMs) return appearance === 'until arrival' ? 1 : growing(graph, pointId, time.arriveMs, t, wayMs);
    // Whole from the lead's arrival and over its pause; then, hiding after, the shrink.
    if (t < time.departMs || appearance === 'from arrival') return 1;
    return shrinking(graph, pointId, t, wayMs);
  };
}
