// CORE-02: the lead's walk on a route's graph (the plan's §3, A1). It is worked out from the route alone, never from
// what happened on screen: a depth-first search from `leadStart` that follows lines in their saved order.
import type { Route } from '../model/scene';

/** A line as the lead walks it: `from` is where the lead enters it, whatever way the line was drawn. */
interface WalkedLine {
  readonly lineId: string;
  readonly from: string;
  readonly to: string;
}

export interface Walk {
  /** The lines the lead walks, in the order the search reaches them, which follows the lines' saved order. */
  readonly walked: readonly WalkedLine[];
  /** Lines the lead never walks: those that close a loop and those it cannot reach. A crowd may still use them. */
  readonly leftOut: readonly string[];
  /** Points two or more walked lines enter: the lead waits there for its latest arrival, then goes on once. */
  readonly joins: ReadonlySet<string>;
}

/** One way out of a point: along `lineId` to `to`, `forward` when that is the line's saved direction. */
interface Step {
  readonly lineId: string;
  readonly to: string;
  readonly forward: boolean;
}

type Line = Route['lines'][number];

/** Each point's ways out, in the lines' saved order: a one-way line from its `from`, a two-way line from either end. */
export function waysOut(lines: readonly Line[]): Map<string, Step[]> {
  const ways = new Map<string, Step[]>();
  const add = (at: string, step: Step) => {
    const list = ways.get(at);
    if (list) list.push(step);
    else ways.set(at, [step]);
  };
  for (const line of lines) {
    add(line.from, { lineId: line.id, to: line.to, forward: true });
    if (line.direction === 'both ways') add(line.to, { lineId: line.id, to: line.from, forward: false });
  }
  return ways;
}

/**
 * The lead's walk. A line that leads back to a point on the search's current path closes a loop and is left out;
 * every other line reached is walked, so the walk has joins but never a cycle, and no line is walked twice. The
 * search keeps its own stack, so a route of the most points the model allows cannot overflow the call stack.
 */
export function leadWalk(route: Pick<Route, 'lines' | 'leadStart'>): Walk {
  const walked: WalkedLine[] = [];
  const met = new Set<string>();
  const entered = new Map<string, number>();
  const ways = waysOut(route.lines);
  const start = route.leadStart;
  if (start !== null) {
    const onPath = new Set<string>([start]);
    const visited = new Set<string>([start]);
    const stack: { at: string; next: number }[] = [{ at: start, next: 0 }];
    for (let frame = stack.at(-1); frame; frame = stack.at(-1)) {
      const step = ways.get(frame.at)?.[frame.next];
      if (!step) {
        onPath.delete(frame.at);
        stack.pop();
        continue;
      }
      frame.next += 1;
      if (met.has(step.lineId)) continue;
      met.add(step.lineId);
      if (onPath.has(step.to)) continue;
      walked.push({ lineId: step.lineId, from: frame.at, to: step.to });
      entered.set(step.to, (entered.get(step.to) ?? 0) + 1);
      if (visited.has(step.to)) continue;
      visited.add(step.to);
      onPath.add(step.to);
      stack.push({ at: step.to, next: 0 });
    }
  }
  const walkedIds = new Set(walked.map((line) => line.lineId));
  const leftOut = route.lines.filter((line) => !walkedIds.has(line.id)).map((line) => line.id);
  const joins = new Set([...entered].filter(([, count]) => count > 1).map(([point]) => point));
  return { walked, leftOut, joins };
}
