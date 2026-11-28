// CORE-06, D273 part 2 (iii), the owner's answer of 2026-11-27 ("Appear at either end"): under the line appearance
// `grows`, a line the lead never walks appears whole once the lead arrives at either of its ends along a walked line,
// and stays whole. The lead start is not arrived at, so a loop's closing line shows when the loop is closed. Read
// through the line module's own `evaluate`, at moments the lead's own timeline gives.
import { describe, expect, test } from 'vitest';
import { newLine, newPoint, newRoute, type Route } from '../../../core/model/scene';
import { composeTimeline, leadAt, type Timeline } from '../../../core/timing/timeline';
import { LINE } from './line';

type Appearance = Route['settings']['line']['appearance'];

/** A route of stops at (x, y), the lines `[from, to]` by index (one way, as the pen draws them), the lead start by index. */
function routeOf(places: readonly (readonly [number, number])[], pairs: readonly (readonly [number, number])[], start: number | null, appearance: Appearance = 'grows'): Route {
  let n = 0;
  const nextId = () => `id${++n}`;
  const points = places.map(([x, y]) => newPoint(nextId, { x, y, kind: 'stop' }));
  const idOf = (i: number) => points[i]?.id ?? '';
  const plain = { ...newRoute(nextId), points, leadStart: start === null ? null : idOf(start) };
  return {
    ...plain,
    lines: pairs.map(([from, to]) => newLine(nextId, idOf(from), idOf(to))),
    settings: {
      ...plain.settings,
      lead: { ...plain.settings.lead, timing: 'total time', totalTimeMs: 9_000, startsAtMs: 0 },
      line: { ...plain.settings.line, appearance },
    },
  };
}

/** Every point the line draws at a moment, through the module's own `evaluate`. */
function drawnAt(route: Route, timeline: Timeline, ms: number) {
  const shape = { points: route.points, lines: route.lines, leadStart: route.leadStart, marks: route.marks };
  const input = { route: { shape, timeline }, seed: 1, scale: 1, timeMs: ms, lead: leadAt(timeline, ms) };
  const result = LINE.evaluate({ ...input, settings: LINE.select(route.settings) });
  if (!result.ok) throw new Error(result.reason);
  return result.value.strokes.flatMap((stroke) => stroke.points);
}

const samplesOf = (timeline: Timeline, lineId: string) => timeline.shapes.get(lineId)?.samples ?? [];
const onAny = (drawn: ReturnType<typeof drawnAt>) => (sample: { x: number; y: number }) => drawn.some((point) => point.x === sample.x && point.y === sample.y);

/** Whether the line is drawn whole at a moment: every one of its samples lies on a drawn stroke. */
function wholeAt(route: Route, timeline: Timeline, lineId: string, ms: number): boolean {
  const samples = samplesOf(timeline, lineId);
  if (samples.length < 3) throw new Error(`too few samples for ${lineId}`);
  return samples.every(onAny(drawnAt(route, timeline, ms)));
}

/** Whether any of the line's inner samples is drawn: a line not shown draws none (its ends may be its neighbours'). */
const anyAt = (route: Route, timeline: Timeline, lineId: string, ms: number) => samplesOf(timeline, lineId).slice(1, -1).some(onAny(drawnAt(route, timeline, ms)));

const arrival = (timeline: Timeline, pointId: string) => {
  const time = timeline.points.get(pointId);
  if (time === undefined) throw new Error(`the lead never arrives at ${pointId}`);
  return time.arriveMs;
};

/** Three stops: with lines A → B → C → A and the lead start at A, the walk leaves out the closing line C → A. */
const LOOP = [
  [0.2, 0.7],
  [0.5, 0.2],
  [0.8, 0.7],
] as const;
const ROUND: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [2, 0],
];

describe('a line the lead never walks, under grows (D273 part 2 (iii))', () => {
  test('a loop’s closing line is absent until the lead arrives at C, then whole from then on', () => {
    const route = routeOf(LOOP, ROUND, 0);
    const timeline = composeTimeline(route, 1);
    const closing = route.lines[2]?.id ?? '';
    expect(timeline.walk.leftOut).toEqual([closing]);
    const atC = arrival(timeline, route.points[2]?.id ?? '');
    expect(atC).toBeGreaterThan(0);
    // The lead start is not arrived at: at the start, and all the way to C, the closing line shows nothing.
    for (const ms of [0, atC / 3, atC - 1]) expect(anyAt(route, timeline, closing, ms)).toBe(false);
    for (const ms of [atC, atC + 1, timeline.endMs, timeline.endMs + 5_000]) expect(wholeAt(route, timeline, closing, ms)).toBe(true);
  });

  test('a one-way line pointing back into the route shows once the lead arrives at either end, here its `to`', () => {
    // A → B → C, and C → B, which points back into the route: the lead reaches B (its `to`) before C (its `from`).
    const route = routeOf(LOOP, [...ROUND.slice(0, 2), [2, 1]], 0);
    const timeline = composeTimeline(route, 1);
    const back = route.lines[2]?.id ?? '';
    expect(timeline.walk.leftOut).toEqual([back]);
    const atB = arrival(timeline, route.points[1]?.id ?? '');
    const atC = arrival(timeline, route.points[2]?.id ?? '');
    expect(atB).toBeLessThan(atC);
    expect(anyAt(route, timeline, back, atB - 1)).toBe(false);
    for (const ms of [atB, (atB + atC) / 2, timeline.endMs]) expect(wholeAt(route, timeline, back, ms)).toBe(true);
  });

  test('a line no end of which the lead reaches never shows', () => {
    // A → B, and D → C: neither C nor D is ever arrived at.
    const route = routeOf([...LOOP, [0.1, 0.1]], [ROUND[0] ?? [0, 1], [3, 2]], 0);
    const timeline = composeTimeline(route, 1);
    const apart = route.lines[1]?.id ?? '';
    expect(timeline.walk.leftOut).toEqual([apart]);
    for (const ms of [0, timeline.endMs / 2, timeline.endMs, timeline.endMs + 5_000]) expect(anyAt(route, timeline, apart, ms)).toBe(false);
  });

  test('with no lead start nothing is reached, so nothing shows', () => {
    const route = routeOf(LOOP, ROUND, null);
    const timeline = composeTimeline(route, 1);
    expect(timeline.walk.leftOut).toHaveLength(3);
    for (const line of route.lines) for (const ms of [0, 1_000, 60_000]) expect(anyAt(route, timeline, line.id, ms)).toBe(false);
  });
});

describe('the other appearances keep their way with a left-out line (D282)', () => {
  test('under trail the loop’s closing line still never shows; under whole it is whole throughout', () => {
    const trail = routeOf(LOOP, ROUND, 0, 'trail');
    const trailTimeline = composeTimeline(trail, 1);
    const closing = trail.lines[2]?.id ?? '';
    for (const ms of [0, trailTimeline.endMs, trailTimeline.endMs + 5_000]) expect(anyAt(trail, trailTimeline, closing, ms)).toBe(false);
    const whole = routeOf(LOOP, ROUND, 0, 'whole');
    const wholeTimeline = composeTimeline(whole, 1);
    for (const ms of [0, wholeTimeline.endMs]) expect(wholeAt(whole, wholeTimeline, closing, ms)).toBe(true);
  });
});
