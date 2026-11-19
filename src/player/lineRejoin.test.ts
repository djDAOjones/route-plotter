// CORE-04 stage 4b, the case Codex's round left (D139): a fork that rejoins, with a pause at the join, rests the
// whole lead only once both branches have arrived. Checked against lineTrail.test.ts's halving oracle, written apart
// from the module's own course, through the real catalogue's line.
import { expect, test } from 'vitest';
import { pointAt } from '../core/geometry/path';
import type { ImagePoint } from '../core/geometry/units';
import { newLine, newPoint, newRoute, type Route } from '../core/model/scene';
import { composeTimeline, leadAt, type Timeline } from '../core/timing/timeline';
import { CATALOGUE } from '../features/catalogue';

const line = CATALOGUE.route[0];
if (line === undefined) throw new Error('no route module');

/** a → b forks to c and d, which rejoin at e (paused 2 s), then e → f: walked in 10 s by total time, a fifth's trail. */
function rejoin(): Route {
  let n = 0;
  const nextId = () => `id${++n}`;
  const at = (x: number, y: number, wait = 0) => ({ ...newPoint(nextId, { x, y, kind: 'stop' }), pauseMs: wait });
  const [a, b, c, d, e, f] = [at(0.1, 0.5), at(0.3, 0.5), at(0.5, 0.3), at(0.5, 0.8), at(0.7, 0.5, 2_000), at(0.9, 0.5)];
  const pairs = [
    [a, b],
    [b, c],
    [b, d],
    [c, e],
    [d, e],
    [e, f],
  ] as const;
  const plain = { ...newRoute(nextId), points: [a, b, c, d, e, f], leadStart: a.id };
  return {
    ...plain,
    lines: pairs.map(([from, to]) => newLine(nextId, from.id, to.id)),
    settings: {
      ...plain.settings,
      lead: { ...plain.settings.lead, timing: 'total time', totalTimeMs: 10_000, startsAtMs: 0 },
      line: { ...plain.settings.line, appearance: 'trail', trailLength: 0.2 },
    },
  };
}

const isStrokes = (value: unknown): value is { strokes: readonly { points: readonly ImagePoint[] }[] } =>
  typeof value === 'object' && value !== null && 'strokes' in value && Array.isArray(value.strokes);

/** The line's strokes at a moment of the content, which is also the module's `timeMs`. */
function strokesAt(route: Route, timeline: Timeline, ms: number): (readonly ImagePoint[])[] {
  if (line === undefined) throw new Error('no route module');
  const shape = { points: route.points, lines: route.lines, leadStart: route.leadStart, marks: route.marks };
  const settings = line.select(route.settings);
  const result = line.evaluate({ settings, route: { shape, timeline }, seed: 1, scale: 1, timeMs: ms, lead: leadAt(timeline, ms) });
  if (!result.ok) throw new Error(result.reason);
  if (!isStrokes(result.value)) throw new Error('not a line drawing');
  return result.value.strokes.map((stroke) => stroke.points);
}

/** The oracle: each line's progress, the share of the whole length walked at a moment and, by halving, when a share was. */
function oracleOf(timeline: Timeline) {
  const lengths = timeline.lines.map((each) => timeline.shapes.get(each.lineId)?.lengthWidths ?? 0);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const progressAt = (lineId: string, ms: number) => leadAt(timeline, ms).progress.get(lineId) ?? 0;
  const walked = (ms: number) =>
    timeline.lines.reduce((sum, each, i) => sum + (lengths[i] ?? 0) * progressAt(each.lineId, ms), 0) / total;
  const when = (share: number) => {
    let [low, high] = [0, timeline.endMs];
    for (let i = 0; i < 80; i++)
      [low, high] = walked((low + high) / 2) < share ? [(low + high) / 2, high] : [low, (low + high) / 2];
    return high;
  };
  const place = (lineId: string, ms: number) =>
    pointAt(timeline.shapes.get(lineId)?.samples ?? [], progressAt(lineId, ms));
  return { progressAt, walked, when, place };
}

test('a fork that rejoins rests the whole lead only once both branches have arrived (D139)', () => {
  const route = rejoin();
  const timeline = composeTimeline(route, 1);
  const into = (to: string) => timeline.lines.filter((each) => each.to === to).map((each) => each.arriveMs);
  const [first, both] = into(route.points[4]?.id ?? '').sort((x, y) => x - y);
  if (first === undefined || both === undefined) throw new Error('two branches into e');
  expect(first).toBeLessThan(both);
  const { progressAt, walked, when, place } = oracleOf(timeline);
  // Nothing moves only through e's pause, so the lead moves for all the time but that; the trail closes over a fifth
  // of it (v3's trail × pathDuration), from a fifth behind the share walked when both branches had arrived.
  const movingMs = timeline.endMs - 2_000;
  const tailOf = (ms: number) =>
    ms < both ? walked(ms) - 0.2 : walked(both) - 0.2 * (1 - Math.min(1, (ms - both) / (0.2 * movingMs)));
  // c's head waits at e while d's moves (no rest yet: a whole trail); half-way through the fade, in e's pause; near
  // its end, when only the d branch still shows.
  for (const [ms, count] of [
    [(first + both) / 2, 2],
    [both + 1_000, 2],
    [both + 1_900, 1],
  ] as const) {
    const tailMs = when(tailOf(ms));
    const expected = timeline.lines
      .filter((each) => progressAt(each.lineId, tailMs) < progressAt(each.lineId, ms))
      .map((each) => [place(each.lineId, tailMs), place(each.lineId, ms)]);
    const strokes = strokesAt(route, timeline, ms);
    expect(expected).toHaveLength(count);
    expect(strokes).toHaveLength(count);
    expected.forEach(([start, end], i) => {
      const stroke = strokes[i] ?? [];
      expect(stroke[0]?.x).toBeCloseTo(start?.x ?? Number.NaN, 6);
      expect(stroke[0]?.y).toBeCloseTo(start?.y ?? Number.NaN, 6);
      expect(stroke.at(-1)).toEqual(end);
    });
  }
});
