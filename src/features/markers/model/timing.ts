// CORE-04 stage 5b-1: when a stop's marker shows, from the plan's P2 alone: when the lead reaches each stop and the
// pauses it takes there. Ported from v3's getWaypointVisibility (v3/src/services/MotionVisibilityService.js:393–553,
// its WAYPOINT_ANIM :288–301) into content ms: v3's path progress times its path duration is the lead's moving time,
// which v4's timeline holds as each line's depart and arrive. It reads no clock and keeps nothing between frames.
import type { Timeline } from '../../../core/timing/timeline';

/** v3's WAYPOINT_ANIM: a grow of 0.25 s, held between 1% and 8% of the walk's moving time; no overshoot. */
const GROW = { targetMs: 250, least: 0.01, most: 0.08 };

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

  /** Back from a stop through bends to the stop before it, or to the start when no stop stands between (v3's -1). */
  function behind(pointId: string, arriveMs: number): Behind {
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

  /** Before the lead's arrival, hiding before: v3's grow, with its early start in the stop before's pause. */
  function growing(pointId: string, arriveMs: number, t: number): number {
    const { gapMs, previous } = behind(pointId, arriveMs);
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

  return (pointId: string, appearance: Timed, t: number): number => {
    const time = times.points.get(pointId);
    // A stop the walk never reaches is as one not yet reached (D136).
    if (time === undefined) return appearance === 'until arrival' ? 1 : 0;
    if (t < time.arriveMs) return appearance === 'until arrival' ? 1 : growing(pointId, time.arriveMs, t);
    // From the lead's arrival on, whole. Until arrival and at arrival shrink away after it leaves in the next step.
    return 1;
  };
}
