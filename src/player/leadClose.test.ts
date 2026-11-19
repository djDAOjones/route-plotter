// CORE-04 stage 5a, the case Codex's round left: stops closer together than v3's departure window. v3 tries every
// stop's window in route order and the earliest that holds wins (getHeadDirection, RenderingService.js:783–808), so
// the stop furthest back whose window holds turns the head. Each figure here is v3's: its frozen getHeadDirection run
// in a scratch script outside the repository on the same walk, 1,000 path points to a share, as Codex's round did.
// Kept apart from leadModule.test.ts, which would pass 400 lines (measure M8). Through the real catalogue's lead.
import { expect, test } from 'vitest';
import type { ImagePoint } from '../core/geometry/units';
import { newLine, newPoint, newRoute } from '../core/model/scene';
import { composeTimeline, leadAt } from '../core/timing/timeline';
import { CATALOGUE } from '../features/catalogue';

const lead = CATALOGUE.route.find((each) => each.id === 'lead');
if (lead === undefined) throw new Error('a lead module');

type Course = readonly [ImagePoint, ImagePoint];
interface Heading {
  readonly course: Course;
  readonly toward: Course | null;
  readonly weight: number;
}
/** What the lead's model gives, as this test reads it: a test reaches a feature only through the catalogue. */
const isDrawing = (value: unknown): value is { readonly heads: readonly { readonly heading: Heading }[] } =>
  typeof value === 'object' && value !== null && 'heads' in value;

const between = (a: ImagePoint, b: ImagePoint, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * The head's angle in degrees where v3's whole-walk progress is `share`, on a walk of straight lines joining `places`
 * with the given lengths in widths, measured on a square canvas as v3's frozen calculation was. A real route's lines
 * are smoothed through its stops, which bends the line between two stops this close: so the walk is a real route's
 * timeline with its shapes made straight, and the moment the core's, its head moved to that share.
 */
function degreesAt(places: readonly ImagePoint[], lengths: readonly number[], share: number): number {
  let n = 0;
  const points = places.map((place) => ({ ...newPoint(() => `id${++n}`, { ...place, kind: 'stop' }), pauseMs: 0 }));
  const plain = { ...newRoute(() => `id${++n}`), points, leadStart: points[0]?.id ?? '' };
  const ids = points.map((point) => point.id);
  const route = { ...plain, lines: ids.slice(1).map((to, i) => newLine(() => `id${++n}`, ids[i] ?? '', to)) };
  const real = composeTimeline(route, 1);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let walked = 0;
  const index = lengths.findIndex((length) => share <= (walked += length / total));
  const local = 1 - (walked - share) / ((lengths[index] ?? 0) / total);
  const [line, from, to] = [real.lines[index], places[index], places[index + 1]];
  if (line === undefined || from === undefined || to === undefined || lead === undefined) throw new Error('a line');
  const straight = real.lines.map((each, i) => {
    const shape = real.shapes.get(each.lineId);
    if (shape === undefined) throw new Error('a shape for each line');
    const [a, b] = [places[i] ?? from, places[i + 1] ?? to];
    const samples = Array.from({ length: 101 }, (_, j) => between(a, b, j / 100));
    return [each.lineId, { ...shape, samples, lengthWidths: lengths[i] ?? 0 }] as const;
  });
  const timeline = { ...real, shapes: new Map(straight), places: new Map(ids.map((id, i) => [id, places[i] ?? from])) };
  const head = { lineId: line.lineId, pointId: null, at: between(from, to, local), pause: null };
  const progress = new Map(real.lines.map((each, i) => [each.lineId, i < index ? 1 : i === index ? local : 0]));
  const moment = { ...leadAt(real, line.departMs), progress, heads: [head], main: head };
  const shape = { points: route.points, lines: route.lines, leadStart: route.leadStart, marks: route.marks };
  const basis = { settings: lead.select(route.settings), route: { shape, timeline }, seed: 1, scale: 1, timeMs: 0 };
  const result = lead.evaluate({ ...basis, lead: moment });
  const heading = result.ok && isDrawing(result.value) ? result.value.heads[0]?.heading : undefined;
  if (heading === undefined) throw new Error('a head with a heading');
  const angle = ([a, b]: Course) => Math.atan2(b.y - a.y, b.x - a.x);
  const turn = heading.toward === null ? 0 : (angle(heading.toward) - angle(heading.course)) * heading.weight;
  return ((angle(heading.course) + turn) * 180) / Math.PI;
}

test('stops closer together than v3’s window: the stop furthest back whose window holds turns the head, as v3', () => {
  // Codex's case: stops at shares 1/3 and 0.34, a level line in, upright after. At 0.3405 both stops' windows hold;
  // the earlier, at 1/3, wins: its blend, 0.82 of the way from upright to level. v4 gave 90° before this fix (the
  // nearer stop's "arriving" chord, upright). v3: 16.125°.
  const corner = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0 },
    { x: 0.5, y: 0.01 },
    { x: 0.5, y: 1 },
  ];
  expect(degreesAt(corner, [0.5, 0.01, 0.99], 0.3405)).toBeCloseTo(16.125, 6);
  // Past the earlier stop's window, the nearer one's alone: its blend toward its own upright way. v3: 90°.
  expect(degreesAt(corner, [0.5, 0.01, 0.99], 1 / 3 + 0.045)).toBeCloseTo(90, 6);
  // The route's first stop 0.039 back, a second stop 0.009 back: v3 tries the first stop's window first, which holds,
  // and keeps the head's own way (its `break`, :791) rather than turning from the short level line. v3: 90°; v4 gave
  // 20.25° before this fix (the second stop's blend).
  const shortStart = [
    { x: 0, y: 0 },
    { x: 0.03, y: 0 },
    { x: 0.03, y: 0.97 },
  ];
  expect(degreesAt(shortStart, [0.03, 0.97], 0.039)).toBeCloseTo(90, 6);
});
