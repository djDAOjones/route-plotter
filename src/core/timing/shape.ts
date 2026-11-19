// CORE-02: a route's shape, line by line (the plan's §6). A run is a chain of walked lines whose inner points, stops
// or bends, each have one walked line in and one out; it is one Catmull-Rom curve through its stops and bends, as v3's
// PathCalculator draws its route. The lead's start, forks, joins and each branch's end begin or end a run, and a line
// the lead does not walk is a run of its own, in its saved direction. The route's runs share one sample budget
// (INTAKE.12); each line's samples and length come from its run, in image widths (A22).
import { item } from '../geometry/item';
import { calculatePath, SAMPLE_BUDGET } from '../geometry/path';
import type { ImagePoint } from '../geometry/units';
import type { Route } from '../model/scene';
import type { Walk } from './walk';

export interface LineShape {
  /**
   * The line's samples at image fractions, from the end the lead enters it by (or its `from`, if not walked). The first
   * and last are its two authored points exactly, so a line ends where the next begins and the lead never steps off a
   * stop while it pauses there; between them, the run's curve.
   */
  readonly samples: readonly ImagePoint[];
  /**
   * Its length in image widths: its share of its run's samples times the run's length, as v3 times a leg
   * (v3/src/services/PathCalculator.js:392–404). Samples are dense at corners, so a corner lengthens the line's time
   * and the lead moves through its run at an even rate of samples, slowing at corners without a jump at a stop.
   */
  readonly lengthWidths: number;
}

interface Run {
  readonly points: string[];
  readonly lines: string[];
}

type WalkedLine = Walk['walked'][number];

/** The walk's runs in walk order, then each line the walk leaves out as a run of its own. */
function runsOf(walk: Walk, lines: Route['lines']): Run[] {
  const outs = new Map<string, WalkedLine[]>();
  const ins = new Map<string, number>();
  for (const line of walk.walked) {
    const ways = outs.get(line.from);
    if (ways) ways.push(line);
    else outs.set(line.from, [line]);
    ins.set(line.to, (ins.get(line.to) ?? 0) + 1);
  }
  const onlyWayOn = (point: string): WalkedLine | null => {
    const ways = outs.get(point) ?? [];
    return ins.get(point) === 1 && ways.length === 1 ? item(ways, 0) : null;
  };
  const runs: Run[] = [];
  for (const first of walk.walked) {
    if (onlyWayOn(first.from)) continue;
    const run: Run = { points: [first.from, first.to], lines: [first.lineId] };
    for (let next = onlyWayOn(first.to); next; next = onlyWayOn(next.to)) {
      run.points.push(next.to);
      run.lines.push(next.lineId);
    }
    runs.push(run);
  }
  const left = new Set(walk.leftOut);
  for (const line of lines) if (left.has(line.id)) runs.push({ points: [line.from, line.to], lines: [line.id] });
  return runs;
}

/**
 * Each line's samples and length. A run of `n` lines may hold `budget × n / lines` samples, never fewer than its
 * points: its curve is sampled within that share less `n − 1`, room for a line whose slice of the curve is a single
 * sample yet which keeps both its authored ends. So the route never passes `budget` while it has at most half as many
 * lines, as every route the model allows has (LIMITS.lines is 20,000 against SAMPLE_BUDGET's 50,000). A point the route
 * does not hold is a fault in the caller, so it throws: a scene that has passed its open check never has one.
 */
export function routeShape(
  route: Pick<Route, 'points' | 'lines'>,
  walk: Walk,
  aspect: number,
  budget = SAMPLE_BUDGET,
): ReadonlyMap<string, LineShape> {
  const places = new Map(route.points.map((point) => [point.id, { x: point.x, y: point.y }]));
  const placeOf = (id: string): ImagePoint => {
    const place = places.get(id);
    if (!place) throw new RangeError(`The route has no point ${id}`);
    return place;
  };
  const shapes = new Map<string, LineShape>();
  for (const run of runsOf(walk, route.lines)) {
    const n = run.lines.length;
    const share = Math.max(n + 1, Math.floor((budget * n) / route.lines.length));
    const ends = run.points.map(placeOf);
    const path = calculatePath(ends, aspect, Math.max(n + 1, share - n + 1));
    const last = path.points.length - 1;
    run.lines.forEach((lineId, k) => {
      const [from, to] = [item(path.knots, k), item(path.knots, k + 1)];
      const lengthWidths = last > 0 ? ((to - from) / last) * path.length : 0;
      const samples = [item(ends, k), ...path.points.slice(from + 1, to), item(ends, k + 1)];
      shapes.set(lineId, { samples, lengthWidths });
    });
  }
  return shapes;
}
