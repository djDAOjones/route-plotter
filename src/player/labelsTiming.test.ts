// CORE-04 stage 5b-2: how solid a stop's label is under the fades, through the real catalogue's labels module and, last,
// the composer and the recorder. Each figure marked "v3" is its frozen getTextVisibility (TextLabelService.js:319–428)
// run in a scratch script outside the repository on the same walk: v3's progress the lead's moving ms on the stop's
// way over the way's moving ms, the stop's progress its moving ms back over the same, and the base timeline the lead's
// own walk, its pauses in. A fade is 500 ms of that base timeline, so 500 moving ms on a row with no pause.
import { afterEach, expect, test, vi } from 'vitest';
import { Recorder } from '../adapters/render/recorder';
import { newLine, newPoint, newRoute, newScene, type Route } from '../core/model/scene';
import { composeTimeline, leadAt } from '../core/timing/timeline';
import { CATALOGUE } from '../features/catalogue';
import { compose } from './compose';

afterEach(() => {
  vi.restoreAllMocks();
});

type Appearance = Route['settings']['labels']['appearance'];
/** A line the lead walks, by its ends' letters, entered and reached at these content ms. */
type Walked = readonly [from: string, to: string, departMs: number, arriveMs: number];
/** Each reached point's arrive and depart, by letter; a letter left out is never reached. */
type Reached = Readonly<Record<string, readonly [arriveMs: number, departMs: number]>>;

const isDrawing = (value: unknown): value is { readonly labels: readonly { pointId: string; opacity: number }[] } =>
  typeof value === 'object' && value !== null && 'labels' in value;

const labelsModule = () => {
  const labels = CATALOGUE.route.find((each) => each.id === 'labels');
  if (labels === undefined) throw new Error('a labels module');
  return labels;
};

/** Stops A, B, … in a row, each labelled with its letter, the lead starting at A. */
function rowRoute(letters: string, appearance: Appearance): Route {
  const list = [...letters];
  const points = list.map((letter, i) => ({
    ...newPoint(() => letter, { x: (i + 1) / 10, y: 0.5, kind: 'stop' }),
    label: letter,
  }));
  const plain = { ...newRoute(() => 'route'), points, leadStart: 'A' };
  const lines = list.slice(1).map((to, i) => newLine(() => `row${i}`, list[i] ?? '', to));
  return { ...plain, lines, settings: { ...plain.settings, labels: { ...plain.settings.labels, appearance } } };
}

/**
 * Each stop's label opacity at `t` (0 when none is drawn), on a walk whose times are set by hand: a real route's
 * timeline with its lines, points and end replaced, as markersTiming.test.ts does, through the catalogue's module.
 */
function opacities(letters: string, walk: readonly Walked[], reached: Reached, t: number, appearance: Appearance) {
  const labels = labelsModule();
  const route = rowRoute(letters, appearance);
  const real = composeTimeline(route, 1);
  const timeline = {
    ...real,
    lines: walk.map(([from, to, departMs, arriveMs], i) => ({ lineId: `L${i}`, from, to, departMs, arriveMs })),
    points: new Map(Object.entries(reached).map(([id, [arriveMs, departMs]]) => [id, { arriveMs, departMs }])),
    endMs: Math.max(...Object.values(reached).map(([, departMs]) => departMs)),
  };
  const shape = { points: route.points, lines: route.lines, leadStart: route.leadStart, marks: route.marks };
  const input = { settings: labels.select(route.settings), route: { shape, timeline }, seed: 1, scale: 1, timeMs: t };
  const result = labels.evaluate({ ...input, lead: leadAt(real, 0) });
  if (!result.ok || !isDrawing(result.value)) throw new Error('a labels drawing');
  const drawn = new Map(result.value.labels.map((label) => [label.pointId, label.opacity]));
  return Object.fromEntries([...letters].map((letter) => [letter, drawn.get(letter) ?? 0]));
}

/** A, B, C in a row, 2 s a line, no pause: the base timeline and the way 4 s. */
const ROW: readonly Walked[] = [
  ['A', 'B', 0, 2_000],
  ['B', 'C', 2_000, 4_000],
];
const ROW_AT: Reached = { A: [0, 0], B: [2_000, 2_000], C: [4_000, 4_000] };

test('“fade in”: hidden before the window, easing in over the last 500 moving ms, whole from arrival on', () => {
  const b = (t: number) => opacities('ABC', ROW, ROW_AT, t, 'fade in').B;
  // v3: 0 at 1,400 and at the window's start, 1,500; 0.875 at 1,750; 0.992 at 1,900; 1 at 2,000 and after.
  expect(b(1_400)).toBe(0);
  expect(b(1_500)).toBe(0);
  expect(b(1_750)).toBeCloseTo(0.875, 9);
  expect(b(1_900)).toBeCloseTo(0.992, 9);
  expect(b(2_000)).toBe(1);
  expect(b(3_000)).toBe(1);
  // v3: the first stop whole from the start; the last fading in as any other, 0.936 at 3,800.
  expect(opacities('ABC', ROW, ROW_AT, 0, 'fade in')).toEqual({ A: 1, B: 0, C: 0 });
  expect(opacities('ABC', ROW, ROW_AT, 3_800, 'fade in').C).toBeCloseTo(0.936, 9);
  // `on` whole at every moment; `off` none.
  expect(opacities('ABC', ROW, ROW_AT, 0, 'on')).toEqual({ A: 1, B: 1, C: 1 });
  expect(opacities('ABC', ROW, ROW_AT, 3_000, 'off')).toEqual({ A: 0, B: 0, C: 0 });
});

test('“fade in”: whole over a pause, which stands still, the base timeline counting it', () => {
  // B pauses 1 s: base 5 s, way 4 s moving, so a window of 400 moving ms (v3: 500 ms of a 5 s base).
  const walk: Walked[] = [
    ['A', 'B', 0, 2_000],
    ['B', 'C', 3_000, 5_000],
  ];
  const reached: Reached = { A: [0, 0], B: [2_000, 3_000], C: [5_000, 5_000] };
  const at = (t: number) => opacities('ABC', walk, reached, t, 'fade in');
  // v3: B whole in its pause; C 0 at 4,500 (500 moving ms to go) and 0.578125 at 4,700.
  expect(at(2_500).B).toBe(1);
  expect(at(4_500).C).toBe(0);
  expect(at(4_700).C).toBeCloseTo(0.578125, 9);
});

test('“fade in”: a stop closer after another than the fade starts in the other’s pause, and holds still there', () => {
  // A→B 2 s, B pauses 1 s, B→C 200 ms, C→D 2 s: base 5.2 s, way 4.2 s. C is 200 moving ms on from B.
  const walk: Walked[] = [
    ['A', 'B', 0, 2_000],
    ['B', 'C', 3_000, 3_200],
    ['C', 'D', 3_200, 5_200],
  ];
  const reached: Reached = { A: [0, 0], B: [2_000, 3_000], C: [3_200, 3_200], D: [5_200, 5_200] };
  const c = (t: number) => opacities('ABCD', walk, reached, t, 'fade in').C;
  // v3: 0.8785375 all through B's pause (progress stands still), 0.9848172 at 3,100, whole at 3,200.
  expect(c(2_000)).toBeCloseTo(0.8785375229456858, 9);
  expect(c(2_500)).toBeCloseTo(0.8785375229456858, 9);
  expect(c(3_100)).toBeCloseTo(0.9848171903682107, 9);
  expect(c(3_200)).toBe(1);
});

test('“fade in”: on a fork each stop by its own lines; at a join, by the latest line in (D146)', () => {
  // A fork at A: A→B→D, 1 s each; A→C 4 s, C→E 1 s. Base 5 s; D's way 2 s moving, E's 5 s, B's 2 s (on by B→D).
  const fork: Walked[] = [
    ['A', 'B', 0, 1_000],
    ['B', 'D', 1_000, 2_000],
    ['A', 'C', 0, 4_000],
    ['C', 'E', 4_000, 5_000],
  ];
  const forked: Reached = { A: [0, 0], B: [1_000, 1_000], D: [2_000, 2_000], C: [4_000, 4_000], E: [5_000, 5_000] };
  // v3, each on its own way: 0.875 a quarter of the window before arrival (200 ms windows for B and D, 500 for E).
  expect(opacities('ABCDE', fork, forked, 1_900, 'fade in').D).toBeCloseTo(0.875, 9);
  expect(opacities('ABCDE', fork, forked, 4_750, 'fade in').E).toBeCloseTo(0.875, 9);
  expect(opacities('ABCDE', fork, forked, 900, 'fade in').B).toBeCloseTo(0.875, 9);
  // Two ways meet at J, walked in an order other than the walk's: A→B→J in by 2 s, A→C→J in by 3 s, the latest.
  const join: Walked[] = [
    ['A', 'B', 0, 1_000],
    ['B', 'J', 1_000, 2_000],
    ['J', 'D', 3_000, 4_000],
    ['A', 'C', 0, 500],
    ['C', 'J', 500, 3_000],
  ];
  const joined: Reached = { A: [0, 0], B: [1_000, 1_000], C: [500, 500], J: [3_000, 3_000], D: [4_000, 4_000] };
  // v3 on J's way by C: hidden at 2,100 though the first line in has arrived; 0.875 at 2,750.
  expect(opacities('ABCJD', join, joined, 2_100, 'fade in').J).toBe(0);
  expect(opacities('ABCJD', join, joined, 2_750, 'fade in').J).toBeCloseTo(0.875, 9);
});

test('“fade in”: a stop the walk never reaches is as one not yet reached, hidden (D136)', () => {
  // E has no line and no time: hidden at every moment, the others as on the row.
  expect(opacities('ABCE', ROW, ROW_AT, 1_750, 'fade in').E).toBe(0);
  expect(opacities('ABCE', ROW, ROW_AT, 9_000, 'fade in')).toEqual({ A: 1, B: 1, C: 1, E: 0 });
});

/** `count` stops in a row, s0 to s9999 for 10,000, each labelled, the lead starting at s0, fading in. */
function stopsRoute(count: number): Route {
  const ids = Array.from({ length: count }, (_, i) => `s${i}`);
  const points = ids.map((id, i) => ({ ...newPoint(() => id, { x: i / count, y: 0.5, kind: 'stop' }), label: id }));
  const plain = { ...newRoute(() => 'route'), points, leadStart: 's0' };
  const labels = { ...plain.settings.labels, appearance: 'fade in' } as const;
  return { ...plain, settings: { ...plain.settings, labels } };
}

/**
 * Each stop's label opacity at `t` through the catalogue's labels module, stop i reached from stop i − 1 by a line
 * of `legMs(i)`, no pauses, and how many times the frame read a line's or a point's time: a count of steps, not a clock.
 */
function manyStops(count: number, legMs: (i: number) => number, t: number) {
  const labels = labelsModule();
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
  const timeline = { ...real, lines, points, endMs: at[count - 1] ?? 0 };
  const input = { settings: labels.select(route.settings), route: { shape, timeline }, seed: 1, scale: 1, timeMs: t };
  const result = labels.evaluate({ ...input, lead: leadAt(real, 0) });
  if (!result.ok || !isDrawing(result.value)) throw new Error('a labels drawing');
  return { opacities: new Map(result.value.labels.map((label) => [label.pointId, label.opacity])), reads };
}

test('10,000 stops: a frame’s work grows with the stops, not their square, each stop keeping v3’s figure', () => {
  // 9,998 lines of no moving time, then one of 10 s; and every line 1 ms. The bound is a count of reads of the lines'
  // and points' times, some 10 a stop, so it cannot fail by chance in CI as a time could.
  const count = 10_000;
  const still = (i: number) => (i === count - 1 ? 10_000 : 0);
  expect(manyStops(count, still, 9_750).reads).toBeLessThan(40 * count);
  expect(manyStops(count, () => 1, 5_000).reads).toBeLessThan(40 * count);
  // v3 on the same walk: every stop but the last at progress 0, the first stop, whole; the last 0.875 at 9,750.
  const late = manyStops(count, still, 9_750).opacities;
  expect(late.get('s0')).toBe(1);
  expect(late.get('s5000')).toBe(1);
  expect(late.get('s9999')).toBeCloseTo(0.875, 9);
  // Every line 1 ms (base 9,999 ms), v3: at 5,000, s5000 whole, s5300 0.784, s5600 hidden; at 0, s9 (progress under
  // 0.001) whole as a first stop, s10 0.999992.
  const even = manyStops(count, () => 1, 5_000).opacities;
  expect(even.get('s5000')).toBe(1);
  expect(even.get('s5300')).toBeCloseTo(0.784, 9);
  expect(even.has('s5600')).toBe(false);
  const start = manyStops(count, () => 1, 0).opacities;
  expect(start.get('s9')).toBe(1);
  expect(start.get('s10')).toBeCloseTo(0.999992, 9);
});

/** A, B, C in a row, labelled, no pauses, walked in 10 s by total time, fading in; each frame through the composer at 1080p. */
function framed(sceneMs: number) {
  let n = 0;
  const nextId = () => `id${++n}`;
  const points = ['A', 'B', 'C'].map((label, i) => ({
    ...newPoint(nextId, { x: 0.2 + 0.3 * i, y: 0.5, kind: 'stop' }),
    label,
    pauseMs: 0,
  }));
  const ids = points.map((point) => point.id);
  const plain = { ...newRoute(nextId), points, leadStart: ids[0] ?? '' };
  const lead = { ...plain.settings.lead, timing: 'total time', totalTimeMs: 10_000, startsAtMs: 0 } as const;
  const labels = { ...plain.settings.labels, appearance: 'fade in' } as const;
  const lines = ids.slice(1).map((to, i) => newLine(nextId, ids[i] ?? '', to));
  const route = { ...plain, lines, settings: { ...plain.settings, lead, labels } };
  const scene = { ...newScene(nextId), routes: [route] };
  const source = { width: 400, height: 300, close() {} };
  const recorder = new Recorder();
  const surface = () => ({ context: new Recorder(), image: source });
  const request = { scene, sceneMs, seed: 7, size: { width: 1920, height: 1080 }, image: { ...source, source }, surface };
  compose(recorder, request, CATALOGUE);
  return recorder.take().filter((entry) => entry.startsWith('fillText '));
}

test('through the composer: the label drawn at v3’s opacity, the same moment the same, no clock or random read', () => {
  // v3 on a 10 s row of two 5 s lines: at 4,750 A whole, B at 0.875, C not drawn.
  const texts = framed(4_750);
  expect(texts.map((entry) => [entry.split(' ')[1], /globalAlpha=(\S+)/.exec(entry)?.[1] ?? '1'])).toEqual([
    ['"A"', '1'],
    ['"B"', '0.875'],
  ]);
  const refuse = (name: string) => () => {
    throw new Error(`${name} was read`);
  };
  vi.spyOn(Date, 'now').mockImplementation(refuse('Date.now'));
  vi.spyOn(performance, 'now').mockImplementation(refuse('performance.now'));
  vi.spyOn(Math, 'random').mockImplementation(refuse('Math.random'));
  expect(framed(4_750)).toEqual(texts);
});
