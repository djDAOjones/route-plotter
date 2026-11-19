// CORE-02: the lead's exact times on its walk (the plan's §3 and §4, A2a), ported from v3's PlayerCore: legs, pauses
// and branches (v3/src/core/PlayerCore.js:74–104, 233–318, 560–666). Every time is in milliseconds of the scene's
// content, which `src/core/clock` turns into scene time, so the lead's start, a branch's departure and a crowd's
// release share one clock (DEF-12). Every time is keyed by point and line id, never by an index into another list
// (DEF-05's timing half). Every walked line is timed, bends at either end of the walk included (DEF-11), and a join
// waits for its latest arrival, then goes on once (§3, rule 3: v3 recorded that wait but never applied it).
import { pointAt } from '../geometry/path';
import type { ImagePoint } from '../geometry/units';
import type { Route } from '../model/scene';
import { routeShape, type LineShape } from './shape';
import { leadWalk, type Walk } from './walk';

interface LineTime {
  readonly lineId: string;
  /** The end the lead enters the line by, and its other end. */
  readonly from: string;
  readonly to: string;
  /** When the lead enters the line, and when it reaches the other end. */
  readonly departMs: number;
  readonly arriveMs: number;
}

interface PointTime {
  /** The lead's arrival; at a join, the latest of the walked lines in; at the start, the lead's `startsAtMs`. */
  readonly arriveMs: number;
  /** When it goes on, after a stop's pause. The start's own pause is not taken, as in v3 (PlayerCore.js:233–318). */
  readonly departMs: number;
}

export interface Schedule {
  /** The point the lead walks from, or null for a route with no points, which has no lead. */
  readonly start: string | null;
  /** Every walked line's times, in walk order. */
  readonly lines: readonly LineTime[];
  /** Every point the lead reaches, by id. */
  readonly points: ReadonlyMap<string, PointTime>;
  /** When the lead has reached its last end and its last pause there is over (§4); 0 when there is no lead. */
  readonly endMs: number;
}

export interface Timeline extends Schedule {
  readonly walk: Walk;
  readonly shapes: ReadonlyMap<string, LineShape>;
  readonly places: ReadonlyMap<string, ImagePoint>;
}

/** What timing reads of a route: its points, lines, start and the lead's settings. */
type Timed = Pick<Route, 'points' | 'lines' | 'leadStart'> & { readonly settings: Pick<Route['settings'], 'lead'> };

/** A checked read of a map: a miss is a fault in the caller, never a value to carry on with. */
function got<V>(map: ReadonlyMap<string, V>, key: string): V {
  const value = map.get(key);
  if (value === undefined) throw new RangeError(`Nothing is held for ${key}`);
  return value;
}

type WalkedLine = Walk['walked'][number];

/** One pass over the walk: a point goes on once every walked line into it has arrived, so each time is final. */
function pass(
  start: string,
  walk: Walk,
  durationOf: (lineId: string) => number,
  pauseOf: (pointId: string) => number,
  startsAtMs: number,
): Pick<Schedule, 'lines' | 'points'> {
  const outs = new Map<string, WalkedLine[]>();
  const waiting = new Map<string, number>();
  for (const line of walk.walked) {
    const ways = outs.get(line.from);
    if (ways) ways.push(line);
    else outs.set(line.from, [line]);
    waiting.set(line.to, (waiting.get(line.to) ?? 0) + 1);
  }
  const arrivals = new Map<string, number>([[start, startsAtMs]]);
  const points = new Map<string, PointTime>();
  const times = new Map<string, LineTime>();
  const ready = [start];
  for (let at = ready.pop(); at !== undefined; at = ready.pop()) {
    const arriveMs = got(arrivals, at);
    const departMs = arriveMs + (at === start ? 0 : pauseOf(at));
    points.set(at, { arriveMs, departMs });
    for (const line of outs.get(at) ?? []) {
      const reached = departMs + durationOf(line.lineId);
      times.set(line.lineId, { ...line, departMs, arriveMs: reached });
      arrivals.set(line.to, Math.max(arrivals.get(line.to) ?? reached, reached));
      const left = got(waiting, line.to) - 1;
      waiting.set(line.to, left);
      if (left === 0) ready.push(line.to);
    }
  }
  return { lines: walk.walked.map((line) => got(times, line.lineId)), points };
}

const latest = (points: ReadonlyMap<string, PointTime>, of: keyof PointTime) =>
  [...points.values()].reduce((end, point) => Math.max(end, point[of]), 0);

/**
 * The lead's times, given each walked line's length in image widths. By speed, a line takes its length over the
 * lead's speed times its own speed factor (v3's `buildSegments`). By total time, the lines keep those proportions,
 * scaled so the walk without its pauses takes `totalTimeMs`; the stops' pauses come on top.
 */
export function scheduleLead(route: Timed, walk: Walk, lengths: ReadonlyMap<string, number>): Schedule {
  const start = route.leadStart;
  if (start === null) return { start, lines: [], points: new Map(), endMs: 0 };
  const lead = route.settings.lead;
  const factors = new Map(route.lines.map((line) => [line.id, line.speedFactor]));
  const pauses = new Map(route.points.map((point) => [point.id, point.kind === 'stop' ? point.pauseMs : 0]));
  const perWidth = lead.timing === 'speed' ? 1000 / lead.speed : 1000;
  const base = (lineId: string) => (got(lengths, lineId) * perWidth) / got(factors, lineId);
  let scale = 1;
  if (lead.timing === 'total time') {
    const moving = latest(pass(start, walk, base, () => 0, 0).points, 'arriveMs');
    scale = moving > 0 ? lead.totalTimeMs / moving : 0;
  }
  const durationOf = (lineId: string) => base(lineId) * scale;
  const { lines, points } = pass(start, walk, durationOf, (pointId) => got(pauses, pointId), lead.startsAtMs);
  return { start, lines, points, endMs: latest(points, 'departMs') };
}

/** The lead's walk, each line's shape and the lead's times: built in one call, on open and after any edit alike. */
export function composeTimeline(route: Timed, aspect: number): Timeline {
  const walk = leadWalk(route);
  const shapes = routeShape(route, walk, aspect);
  const lengths = new Map([...shapes].map(([lineId, shape]) => [lineId, shape.lengthWidths]));
  const places = new Map(route.points.map((point) => [point.id, { x: point.x, y: point.y }]));
  return { ...scheduleLead(route, walk, lengths), walk, shapes, places };
}

interface Head {
  readonly at: ImagePoint;
  /** The walked line the head came along; null at the start, before the lead goes on. */
  readonly lineId: string | null;
  /** The point the head rests at, or null while it moves along its line. */
  readonly pointId: string | null;
  /** Through a stop's pause: how long the lead has paused there so far, and the whole pause. */
  readonly pause: { readonly elapsedMs: number; readonly totalMs: number } | null;
}

interface LeadMoment {
  /** Each walked line's progress: 0 until the lead enters it, 1 once the lead has reached its other end. */
  readonly progress: ReadonlyMap<string, number>;
  /** One head on each line the lead moves along, and one at each point where it waits, pauses or has ended. */
  readonly heads: readonly Head[];
  /** The head on the line first in walk order, which follows the lines' saved order (§3, rule 5). */
  readonly main: Head | null;
}

function progressOf(line: LineTime, contentMs: number): number {
  if (contentMs <= line.departMs) return 0;
  if (contentMs >= line.arriveMs) return 1;
  return (contentMs - line.departMs) / (line.arriveMs - line.departMs);
}

/**
 * Where the lead is at a moment of the content. Along a line it moves by index on the line's samples, so it slows at
 * corners as v3's head does and reaches the line's last sample at its arrival (TST-09.2). A moment that is not a
 * number reads as 0.
 */
export function leadAt(timeline: Timeline, contentMs: number): LeadMoment {
  const t = Number.isFinite(contentMs) ? contentMs : 0;
  const goesOn = new Set(timeline.lines.map((line) => line.from));
  const heads: Head[] = [];
  const rested = new Set<string>();
  const restAt = (pointId: string, lineId: string | null) => {
    const { arriveMs, departMs } = got(timeline.points, pointId);
    if (rested.has(pointId) || (t > departMs && goesOn.has(pointId))) return;
    rested.add(pointId);
    const pause = t >= arriveMs && t < departMs ? { elapsedMs: t - arriveMs, totalMs: departMs - arriveMs } : null;
    heads.push({ at: got(timeline.places, pointId), lineId, pointId, pause });
  };
  if (timeline.start !== null) restAt(timeline.start, null);
  const progress = new Map<string, number>();
  for (const line of timeline.lines) {
    const share = progressOf(line, t);
    progress.set(line.lineId, share);
    if (share === 1) restAt(line.to, line.lineId);
    const at = share > 0 && share < 1 ? pointAt(got(timeline.shapes, line.lineId).samples, share) : null;
    if (at) heads.push({ at, lineId: line.lineId, pointId: null, pause: null });
  }
  return { progress, heads, main: heads[0] ?? null };
}
