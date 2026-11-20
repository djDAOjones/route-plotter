// CORE-04 stage 5b-1: when a stop's marker shows, through the real catalogue's markers module and, last, the composer
// and the recorder. Kept apart from markersModule.test.ts, which would pass 400 lines (measure M8). Each figure marked
// "v3" is its frozen getWaypointVisibility (MotionVisibilityService.js:393–553) run in a scratch script outside the
// repository on the same walk, v3's path progress being the lead's moving ms over the walk's moving time.
import { afterEach, expect, test, vi } from 'vitest';
import { Recorder } from '../adapters/render/recorder';
import { newLine, newPoint, newRoute, newScene, type Route } from '../core/model/scene';
import { composeTimeline, leadAt } from '../core/timing/timeline';
import { CATALOGUE } from '../features/catalogue';
import { compose } from './compose';

afterEach(() => {
  vi.restoreAllMocks();
});

type Appearance = Route['settings']['markers']['appearance'];
/** A line the lead walks, by its ends' letters, entered and reached at these content ms. */
type Walked = readonly [from: string, to: string, departMs: number, arriveMs: number];
/** Each reached point's arrive and depart, by letter; a letter left out is never reached. */
type Reached = Readonly<Record<string, readonly [arriveMs: number, departMs: number]>>;

const isDrawing = (value: unknown): value is { readonly markers: readonly { pointId: string; scale: number }[] } =>
  typeof value === 'object' && value !== null && 'markers' in value;

/** Stops A, B, … in a row, the lead starting at A; `authored` gives a stop's authored pause. */
function rowRoute(letters: string, appearance: Appearance, authored: Readonly<Record<string, number>> = {}): Route {
  const list = [...letters];
  const points = list.map((letter, i) => ({
    ...newPoint(() => letter, { x: (i + 1) / 10, y: 0.5, kind: 'stop' }),
    pauseMs: authored[letter] ?? 0,
  }));
  const plain = { ...newRoute(() => 'route'), points, leadStart: 'A' };
  const lines = list.slice(1).map((to, i) => newLine(() => `row${i}`, list[i] ?? '', to));
  return { ...plain, lines, settings: { ...plain.settings, markers: { ...plain.settings.markers, appearance } } };
}

/**
 * Each stop's marker scale at `t` (0 when none is drawn), on a walk whose times are set by hand: a real route's
 * timeline with its lines and points replaced, as leadClose.test.ts does, through the catalogue's markers module.
 */
function scales(letters: string, lines: readonly Walked[], reached: Reached, t: number, appearance?: Appearance) {
  const markers = CATALOGUE.route.find((each) => each.id === 'markers');
  if (markers === undefined) throw new Error('a markers module');
  const route = rowRoute(letters, appearance ?? 'from arrival');
  const real = composeTimeline(route, 1);
  const timeline = {
    ...real,
    lines: lines.map(([from, to, departMs, arriveMs], i) => ({ lineId: `L${i}`, from, to, departMs, arriveMs })),
    points: new Map(Object.entries(reached).map(([id, [arriveMs, departMs]]) => [id, { arriveMs, departMs }])),
  };
  const shape = { points: route.points, lines: route.lines, leadStart: route.leadStart, marks: route.marks };
  const settings = markers.select(route.settings);
  const input = { settings, route: { shape, timeline }, seed: 1, scale: 1, timeMs: t, lead: leadAt(real, 0) };
  const result = markers.evaluate(input);
  if (!result.ok || !isDrawing(result.value)) throw new Error('a markers drawing');
  const drawn = new Map(result.value.markers.map((marker) => [marker.pointId, marker.scale]));
  return Object.fromEntries([...letters].map((letter) => [letter, drawn.get(letter) ?? 0]));
}

test('“from arrival”: hidden until the lead nears a stop, growing in as v3, whole from arrival and over its pause', () => {
  // A walk of 10 s moving time: B reached at 4 s and left at 5 s, C at 11 s. v3's grow is 250 ms here.
  const lines: Walked[] = [
    ['A', 'B', 0, 4_000],
    ['B', 'C', 5_000, 11_000],
  ];
  const reached: Reached = { A: [0, 0], B: [4_000, 5_000], C: [11_000, 11_000] };
  const at = (t: number) => scales('ABC', lines, reached, t);
  expect(at(0)).toEqual({ A: 1, B: 0, C: 0 });
  expect(at(3_700).B).toBe(0); // v3: hidden
  expect(at(3_875).B).toBeCloseTo(0.875, 6); // v3: 0.875
  expect([at(4_000).B, at(4_500).B, at(6_000).B, at(20_000).B]).toEqual([1, 1, 1, 1]);
  // C's grow counts moving time only: B's pause is not in it. v3: 0.936.
  expect(at(10_900).C).toBeCloseTo(0.936, 6);
});

test('a stop close after another starts growing in that stop’s pause, and goes on after it, as v3', () => {
  // C is 70 ms of travel past B, under a grow's 250 ms: v3 starts the missing 180 ms in B's 2 s pause.
  const lines: Walked[] = [
    ['A', 'B', 0, 1_000],
    ['B', 'C', 3_000, 3_070],
    ['C', 'D', 3_070, 10_000],
  ];
  const reached: Reached = { A: [0, 0], B: [1_000, 3_000], C: [3_070, 3_070], D: [10_000, 10_000] };
  const at = (t: number) => scales('ABCD', lines, reached, t).C;
  expect(at(2_800)).toBe(0); // v3: hidden, 180 ms before the pause ends not yet reached
  expect(at(2_900)).toBeCloseTo(0.685568, 6); // v3: 0.685568, growing in the pause
  expect(at(3_000)).toBeCloseTo(0.978048, 6); // v3: 0.978048, the pause just over
  expect(at(3_035)).toBeCloseTo(0.997256, 6); // v3: 0.997256
  expect(at(3_070)).toBe(1);
});

test('TST-03.2: a stop just after the first grows in from nothing, for the lead never waits at the first (D145)', () => {
  // v3's case: A authored with 1.5 s, B 60 ms of travel in, C at 10 s. v4's lead never takes the first stop's pause.
  const authored = composeTimeline(rowRoute('ABC', 'from arrival', { A: 1_500, B: 0, C: 0 }), 1).points.get('A');
  expect(authored?.departMs).toBe(authored?.arriveMs);
  const lines: Walked[] = [
    ['A', 'B', 0, 60],
    ['B', 'C', 60, 10_000],
  ];
  const reached: Reached = { A: [0, 0], B: [60, 60], C: [10_000, 10_000] };
  // v3 shows B at 0.986176 on its first frame, reading A's authored pause as a head start; v4 reads the pause taken.
  expect(scales('ABC', lines, reached, 0).B).toBe(0);
  expect(scales('ABC', lines, reached, 30).B).toBeCloseTo(0.875, 6); // v3 with no pause authored on A: 0.875
});

test('a stop the walk never reaches shows as one not yet reached (D136)', () => {
  const lines: Walked[] = [['A', 'B', 0, 5_000]];
  const reached: Reached = { A: [0, 0], B: [5_000, 5_000] };
  for (const t of [0, 5_000, 20_000]) expect(scales('ABC', lines, reached, t).C).toBe(0);
});

test('on a fork each stop goes by its own arrival and its own lines, never the trunk’s progress (DEF-05)', () => {
  const lines: Walked[] = [
    ['A', 'B', 0, 2_000],
    ['B', 'C', 2_000, 4_000],
    ['B', 'D', 2_000, 8_000],
  ];
  const reached: Reached = { A: [0, 0], B: [2_000, 2_000], C: [4_000, 4_000], D: [8_000, 8_000] };
  const at = (t: number) => scales('ABCD', lines, reached, t);
  expect(at(3_900).C).toBeCloseTo(0.936, 6); // v3 on C's own branch: 0.936
  expect(at(3_900).D).toBe(0); // v3 on D's own branch: hidden
  expect(at(7_875).C).toBe(1);
  expect(at(7_875).D).toBeCloseTo(0.875, 6); // v3 on D's own branch: 0.875
});

test('at a join a stop goes by the core’s arrival, the latest line in, not the first head’s (D146)', () => {
  const lines: Walked[] = [
    ['A', 'B', 0, 2_000],
    ['A', 'C', 0, 3_000],
    ['C', 'D', 3_000, 4_000],
    ['B', 'D', 2_000, 5_000],
  ];
  const reached: Reached = { A: [0, 0], B: [2_000, 2_000], C: [3_000, 3_000], D: [5_000, 5_000] };
  const at = (t: number) => scales('ABCD', lines, reached, t).D;
  expect(at(4_000)).toBe(0); // the first head is there; the core's arrival is not yet
  expect(at(4_875)).toBeCloseTo(0.875, 6); // v3 on the latest line in, from B: 0.875
  expect(at(5_000)).toBe(1);
});

test('“until arrival” is whole until the lead leaves, then shrinks away as v3; “at arrival” does both', () => {
  // The first test's walk: B reached at 4 s, left at 5 s, C 6 s on. v3's shrink is 250 ms here, after 10 ms at the stop.
  const lines: Walked[] = [
    ['A', 'B', 0, 4_000],
    ['B', 'C', 5_000, 11_000],
  ];
  const reached: Reached = { A: [0, 0], B: [4_000, 5_000], C: [11_000, 11_000] };
  const until = (t: number) => scales('ABC', lines, reached, t, 'until arrival');
  const only = (t: number) => scales('ABC', lines, reached, t, 'at arrival');
  expect(until(0)).toEqual({ A: 1, B: 1, C: 1 });
  expect(until(125).A).toBeCloseTo(0.875, 6); // v3: 0.875, the start shrinking as the lead sets off
  expect([until(3_875).B, until(4_500).B, until(5_005).B]).toEqual([1, 1, 1]); // v3: approaching, at the stop
  expect(until(5_125).B).toBeCloseTo(0.875, 6); // v3: 0.875
  expect(until(5_250).B).toBe(0); // v3: scale 0
  expect(until(20_000)).toEqual({ A: 0, B: 0, C: 1 }); // v3: the last stop stays whole at the walk's end
  expect(only(0)).toEqual({ A: 1, B: 0, C: 0 });
  expect(only(3_875).B).toBeCloseTo(0.875, 6); // v3: 0.875 growing
  expect([only(4_000).B, only(4_500).B]).toEqual([1, 1]);
  expect(only(5_125).B).toBeCloseTo(0.875, 6); // v3: 0.875 shrinking
  expect(only(20_000)).toEqual({ A: 0, B: 0, C: 1 });
  // A stop never reached: hidden under "at arrival", whole under "until arrival" (D136).
  const short: Walked[] = [['A', 'B', 0, 4_000]];
  expect(scales('ABC', short, { A: [0, 0], B: [4_000, 4_000] }, 9_000, 'until arrival').C).toBe(1);
  expect(scales('ABC', short, { A: [0, 0], B: [4_000, 4_000] }, 9_000, 'at arrival').C).toBe(0);
});

test('Codex 33’s cases: a long run of bends, a shrink over the next pause, a branch’s end, an unrelated branch', () => {
  // A stop before 9,999 bends: the walk forward needs no call stack of its own. v3: 0.875.
  const ids = ['A', ...Array.from({ length: 9_999 }, (_, i) => `b${i}`)];
  const run: Walked[] = ids.slice(1).map((to, i) => [ids[i] ?? '', to, i, i + 1]);
  const runReached: Reached = Object.fromEntries(ids.map((id, i) => [id, [i, i]]));
  expect(scales('A', run, runReached, 125, 'until arrival').A).toBeCloseTo(0.875, 6);
  // B shrinks over C 50 ms on and stands still through C's 1 s pause, in moving time. v3: 0.875 at 1,100 and 2,000.
  const paused: Walked[] = [
    ['A', 'B', 0, 1_000],
    ['B', 'C', 1_000, 1_050],
    ['C', 'D', 2_050, 11_000],
  ];
  const pausedReached: Reached = { A: [0, 0], B: [1_000, 1_000], C: [1_050, 2_050], D: [11_000, 11_000] };
  const shrink = (t: number) => scales('ABCD', paused, pausedReached, t, 'until arrival').B;
  expect(shrink(1_100)).toBeCloseTo(0.875, 6);
  expect(shrink(2_000)).toBeCloseTo(0.875, 6);
  expect(shrink(2_100)).toBe(0); // v3: hidden
  // B 50 ms before a branch's end at a bend: v3's window ends with the walk. v3: 0.984375 at 9,975, then hidden.
  const ending: Walked[] = [
    ['A', 'B', 0, 9_950],
    ['B', 'X', 9_950, 10_000],
  ];
  const endingReached: Reached = { A: [0, 0], B: [9_950, 9_950], X: [10_000, 10_000] };
  expect(scales('AB', ending, endingReached, 9_975, 'until arrival').B).toBeCloseTo(0.984375, 6);
  expect(scales('AB', ending, endingReached, 12_000, 'until arrival').B).toBe(0);
  // A branch B is not on leaves B's grow alone: v3 on A to B alone, 1 s, gives hidden at 900 and 0.875 at 960.
  const forked: Walked[] = [
    ['A', 'B', 0, 1_000],
    ['A', 'C', 0, 100_000],
  ];
  const forkedReached: Reached = { A: [0, 0], B: [1_000, 1_000], C: [100_000, 100_000] };
  expect(scales('ABC', forked, forkedReached, 900).B).toBe(0);
  expect(scales('ABC', forked, forkedReached, 960).B).toBeCloseTo(0.875, 6);
});

test('Codex 33’s second round: a final stop ends the shrink of the stop before it, as the walk’s end does in v3', () => {
  // A, B, C reached at 0, 9,950 and 10,000 ms, no pauses: B's window would run 100 ms on, past C, where the walk ends.
  // v3 (animOutEnd = min(1, …)): 0.984375 at 9,975, hidden from 10,000 on, both hiding after and before and after.
  const lines: Walked[] = [
    ['A', 'B', 0, 9_950],
    ['B', 'C', 9_950, 10_000],
  ];
  const reached: Reached = { A: [0, 0], B: [9_950, 9_950], C: [10_000, 10_000] };
  for (const appearance of ['until arrival', 'at arrival'] as const) {
    const at = (t: number) => scales('ABC', lines, reached, t, appearance).B;
    expect(at(9_975)).toBeCloseTo(0.984375, 6);
    expect(at(10_000)).toBe(0);
    expect(at(12_000)).toBe(0); // was 0.875, held for ever
  }
});

test('Codex 33’s second round: after a join each way runs back by the latest line in, whatever the walk’s order', () => {
  // The core walks depth first: A to B, B to J, J to D, then A to C and C to J, the latest line into J. So D's way
  // and C's are both A, C, J, D: 1,100 ms. v3 on that way: D 0.488 at 1,060 (was 0); C 0.90608565 at 460 growing
  // (was 0.875) and 0.875 at 544 shrinking (was 0.833625).
  const lines: Walked[] = [
    ['A', 'B', 0, 100],
    ['B', 'J', 100, 200],
    ['J', 'D', 1_000, 1_100],
    ['A', 'C', 0, 500],
    ['C', 'J', 500, 1_000],
  ];
  const reached: Reached = { A: [0, 0], B: [100, 100], C: [500, 500], J: [1_000, 1_000], D: [1_100, 1_100] };
  expect(scales('ABCJD', lines, reached, 1_060).D).toBeCloseTo(0.488, 6);
  expect(scales('ABCJD', lines, reached, 460).C).toBeCloseTo(0.90608565, 6);
  expect(scales('ABCJD', lines, reached, 544, 'until arrival').C).toBeCloseTo(0.875, 6);
});

/** `count` stops in a row, s0 to s9999 for 10,000, the lead starting at s0, hiding after. */
function stopsRoute(count: number): Route {
  const ids = Array.from({ length: count }, (_, i) => `s${i}`);
  const points = ids.map((id, i) => ({ ...newPoint(() => id, { x: i / count, y: 0.5, kind: 'stop' }), pauseMs: 0 }));
  const plain = { ...newRoute(() => 'route'), points, leadStart: 's0' };
  const markers = { ...plain.settings.markers, appearance: 'until arrival' } as const;
  return { ...plain, settings: { ...plain.settings, markers } };
}

/**
 * Each stop's marker scale at `t` through the catalogue's markers module, stop i reached from stop i − 1 by a line of
 * `legMs(i)`, no pauses, and how many times the frame read a line's or a point's time: a count of steps, not a clock.
 */
function manyStops(count: number, legMs: (i: number) => number, t: number) {
  const markers = CATALOGUE.route.find((each) => each.id === 'markers');
  if (markers === undefined) throw new Error('a markers module');
  const route = stopsRoute(count);
  const real = composeTimeline(route, 1);
  let reads = 0;
  const read = (ms: number) => {
    reads += 1;
    return ms;
  };
  const at = [0];
  for (let i = 1; i < count; i += 1) at.push((at[i - 1] ?? 0) + legMs(i));
  const ids = route.points.map((point) => point.id);
  const lines = ids.slice(1).map((to, i) => {
    const [departMs, arriveMs] = [at[i] ?? 0, at[i + 1] ?? 0];
    return { lineId: `L${i}`, from: ids[i] ?? '', to, get departMs() { return read(departMs); }, get arriveMs() { return read(arriveMs); } };
  });
  const points = new Map(
    ids.map((id, i) => {
      const ms = at[i] ?? 0;
      return [id, { get arriveMs() { return read(ms); }, get departMs() { return read(ms); } }];
    }),
  );
  const shape = { points: route.points, lines: route.lines, leadStart: route.leadStart, marks: route.marks };
  const timeline = { ...real, lines, points };
  const input = { settings: markers.select(route.settings), route: { shape, timeline }, seed: 1, scale: 1, timeMs: t };
  const result = markers.evaluate({ ...input, lead: leadAt(real, 0) });
  if (!result.ok || !isDrawing(result.value)) throw new Error('a markers drawing');
  return { scales: new Map(result.value.markers.map((marker) => [marker.pointId, marker.scale])), reads };
}

test('Codex 33’s second round: a frame’s work grows with the stops, not their square, each stop keeping v3’s figure', () => {
  // Codex's case: 10,000 stops, 9,998 lines of no moving time, then one of 10 s; each stop walked on alone, some 5 s
  // a frame. The bound is a count of reads of the lines' and points' times, about 15 a stop now and some 20,000 a stop
  // before, so it cannot fail by chance in CI as a time could.
  const count = 10_000;
  const still = (i: number) => (i === count - 1 ? 10_000 : 0);
  expect(manyStops(count, still, 20_000).reads).toBeLessThan(40 * count);
  // Every line 1 ms, which took some 100 ms a frame before: each stop walked on 100 lines.
  expect(manyStops(count, () => 1, 20_000).reads).toBeLessThan(40 * count);
  // v3 on the same walk: a stop with its next no moving time on 0.875 at 50 ms and hidden at 125; s9998, 10 s from
  // the last, 0.992 at 50; the last, not yet reached, whole.
  const early = manyStops(count, still, 50).scales;
  expect(early.get('s0')).toBeCloseTo(0.875, 6);
  expect(early.get('s5000')).toBeCloseTo(0.875, 6);
  expect(early.get('s9998')).toBeCloseTo(0.992, 6);
  expect(early.get('s9999')).toBe(1);
  expect(manyStops(count, still, 125).scales.get('s0') ?? 0).toBe(0);
});

/** A, a bend, C, walked in 10 s by total time; each frame through the composer at 1080p, its markers' arcs. */
function framed(sceneMs: number) {
  let n = 0;
  const nextId = () => `id${++n}`;
  const places = [
    [0.25, 0.5, 'stop'],
    [0.5, 0.25, 'bend'],
    [0.75, 0.5, 'stop'],
  ] as const;
  const points = places.map(([x, y, kind]) => ({ ...newPoint(nextId, { x, y, kind }), pauseMs: 0 }));
  const ids = points.map((point) => point.id);
  const plain = { ...newRoute(nextId), points, leadStart: ids[0] ?? '' };
  const lead = { ...plain.settings.lead, timing: 'total time', totalTimeMs: 10_000, startsAtMs: 0 } as const;
  const lines = ids.slice(1).map((to, i) => newLine(nextId, ids[i] ?? '', to));
  const route = { ...plain, lines, settings: { ...plain.settings, lead } };
  const source = { width: 400, height: 300, close() {} };
  const recorder = new Recorder();
  const scene = { ...newScene(nextId), routes: [route] };
  const surface = () => ({ context: new Recorder(), image: source });
  const size = { width: 1920, height: 1080 };
  compose(recorder, { scene, sceneMs, seed: 7, size, image: { width: 400, height: 300, source }, surface }, CATALOGUE);
  const entries = recorder.take();
  const dots = entries.filter((each) => each.startsWith('arc ')).map((each) => each.split(' ').slice(1, 4).map(Number));
  return { entries, dots };
}

test('through the composer, the default “from arrival” draws each stop as it grows, reading no clock or random', () => {
  // The first stop is whole from the start; the last, reached at 10 s, grows over v3's 250 ms before it.
  expect(framed(0).dots).toEqual([[600, 540, 8]]);
  expect(framed(9_700).dots).toEqual([[600, 540, 8]]);
  const growing = framed(9_875).dots;
  expect(growing.map(([x, y]) => [x, y])).toEqual([
    [600, 540],
    [1320, 540],
  ]);
  expect(growing[1]?.[2]).toBeCloseTo(8 * 0.875, 3);
  expect(framed(10_000).dots).toEqual([
    [600, 540, 8],
    [1320, 540, 8],
  ]);
  const first = framed(9_875).entries;
  const refuse = (name: string) => () => {
    throw new Error(`${name} was read`);
  };
  vi.spyOn(Date, 'now').mockImplementation(refuse('Date.now'));
  vi.spyOn(performance, 'now').mockImplementation(refuse('performance.now'));
  vi.spyOn(Math, 'random').mockImplementation(refuse('Math.random'));
  expect(framed(9_875).entries).toEqual(first);
});
