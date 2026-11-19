// CORE-04 stage 5a: the lead's head, through the real catalogue and the recorder, and each head style through the
// drawing directly. Where the heads are is the core's (`leadAt`); these check the module draws one at each, as v3.
import { afterEach, expect, test, vi } from 'vitest';
import type { Frame } from '../adapters/render/layers';
import { Recorder } from '../adapters/render/recorder';
import { pointAt } from '../core/geometry/path';
import type { ImagePoint } from '../core/geometry/units';
import { newLine, newPoint, newRoute, newScene, type Route } from '../core/model/scene';
import { composeTimeline, leadAt } from '../core/timing/timeline';
import { CATALOGUE, type Catalogue } from '../features/catalogue';
import { compose } from './compose';

afterEach(() => {
  vi.restoreAllMocks();
});

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

const [line, lead] = CATALOGUE.route;
if (line === undefined || lead === undefined) throw new Error('two route modules');

type Lead = Route['settings']['lead'];

/** What the lead's model gives, as this test reads it: a test reaches a feature only through the catalogue. */
type Course = readonly [ImagePoint, ImagePoint];
interface Heading {
  readonly course: Course;
  readonly toward: Course | null;
  readonly weight: number;
}
interface Look {
  readonly style: 'dot' | 'arrow' | 'drone' | 'custom';
  readonly colour: string;
  readonly size: number;
  readonly image: string | null;
  readonly rotation: 'auto' | 'fixed';
  readonly offsetDegrees: number;
}
interface LeadDrawing {
  readonly look: Look;
  readonly heads: readonly { readonly at: ImagePoint; readonly main: boolean; readonly heading: Heading }[];
}

/** Stops at (x, y), each with its pause, joined by `pairs` of indices from stop 0, walked in 10 s by total time. */
function routeOf(
  stops: readonly (readonly [number, number, number?])[],
  pairs: readonly (readonly [number, number])[],
  settings: Partial<Lead> = {},
): Route {
  const nextId = counter();
  const points = stops.map(([x, y, pauseMs = 0]) => ({ ...newPoint(nextId, { x, y, kind: 'stop' }), pauseMs }));
  const id = (i: number) => points[i]?.id ?? '';
  const plain = { ...newRoute(nextId), points, leadStart: id(0) };
  const timing = { timing: 'total time', totalTimeMs: 10_000, startsAtMs: 0 } as const;
  return {
    ...plain,
    lines: pairs.map(([from, to]) => newLine(nextId, id(from), id(to))),
    settings: { ...plain.settings, lead: { ...plain.settings.lead, ...timing, ...settings } },
  };
}

const isLead = (value: unknown): value is LeadDrawing =>
  typeof value === 'object' && value !== null && 'heads' in value && 'look' in value;

/** The picture every frame here is drawn on, 400 × 300: the core times a route on its aspect, as the composer does. */
const ASPECT = 300 / 400;

/** The lead module's evaluation at a moment of the content, with the core's moment beside it. */
function evaluated(route: Route, ms: number) {
  if (lead === undefined) throw new Error('no lead');
  const timeline = composeTimeline(route, ASPECT);
  const shape = { points: route.points, lines: route.lines, leadStart: route.leadStart, marks: route.marks };
  const basis = { settings: lead.select(route.settings), route: { shape, timeline }, seed: 1, scale: 1 };
  const input = { ...basis, timeMs: ms, lead: leadAt(timeline, ms) };
  const result = lead.evaluate(input);
  if (!result.ok) throw new Error(result.reason);
  if (!isLead(result.value)) throw new Error('not a lead drawing');
  return { ...result.value, timeline, moment: input.lead, end: lead.end(basis), at: lead.traveller?.positionAt(input) };
}

const source = { width: 400, height: 300, close() {} };

/** A frame through the composer, as the recorder writes it, on a 400 × 300 picture (drawn 1,440 × 1,080 at 1080p). */
function framed(route: Route, sceneMs: number, size = { width: 1920, height: 1080 }, catalogue: Catalogue = CATALOGUE) {
  const recorder = new Recorder();
  const scene = { ...newScene(counter()), routes: [route] };
  const image = { width: 400, height: 300, source };
  const surface = () => ({ context: new Recorder(), image: source });
  const reports = compose(recorder, { scene, sceneMs, seed: 7, size, image, surface }, catalogue);
  const entries = recorder.take();
  return { entries, reports, heads: entries.filter((entry) => entry.startsWith('translate ')) };
}

const turned = (entries: readonly string[]) =>
  entries.filter((entry) => entry.startsWith('rotate ')).map((entry) => Number(entry.split(' ')[1]));

/** a → b → c along y = 0.5, b paused 1 s. */
const straight = () =>
  routeOf(
    [
      [0.1, 0.5],
      [0.5, 0.5, 1_000],
      [0.9, 0.5],
    ],
    [
      [0, 1],
      [1, 2],
    ],
  );

test('the lead is second in CATALOGUE.route, draws in the lead’s head layer and adds no time of its own', () => {
  // The lead is second; the modules after it (the markers, from stage 5b-1) are their own tests' to place.
  expect(CATALOGUE.route.map((feature) => feature.id).slice(0, 2)).toEqual(['line', 'lead']);
  expect(Object.keys(lead.layers)).toEqual(['leadHead']);
  expect(evaluated(straight(), 0).end).toBeNull();
});

test('the head at the start, part way, over a pause, at the end and after, where the core puts the lead', () => {
  const route = straight();
  const { timeline } = evaluated(route, 0);
  const [ab, bc] = timeline.lines;
  if (ab === undefined || bc === undefined) throw new Error('two walked lines');
  const placed = (ms: number) => {
    const { heads, moment } = evaluated(route, ms);
    if (ms === 0) expect(moment.heads.map((head) => head.at)).toEqual([{ x: 0.1, y: 0.5 }]);
    else expect(heads.map((head) => [head.at, head.main])).toEqual(moment.heads.map((head) => [head.at, head === moment.main]));
    return heads.map((head) => head.at);
  };
  // v3 draws no head until the lead has set off (renderPathHead :2008); a camera still finds the lead at the start.
  expect(placed(0)).toEqual([]);
  expect(evaluated(route, 0).at).toEqual({ x: 0.1, y: 0.5 });
  const half = (ab.departMs + ab.arriveMs) / 2;
  expect(placed(half)).toEqual([pointAt(timeline.shapes.get(ab.lineId)?.samples ?? [], 0.5)]);
  expect(placed(ab.arriveMs + 500)).toEqual([{ x: 0.5, y: 0.5 }]);
  expect(placed(timeline.endMs)).toEqual([{ x: 0.9, y: 0.5 }]);
  expect(placed(timeline.endMs + 5_000)).toEqual([{ x: 0.9, y: 0.5 }]);
  // Through the composer: one head, where the frame places the picture, part way and after the end.
  expect(framed(route, half).heads).toHaveLength(1);
  expect(framed(route, timeline.endMs + 5_000).heads).toEqual([`translate ${240 + 0.9 * 1440} ${0.5 * 1080}`]);
});

test('one head for each active branch on a fork, the core’s main head, on the line first in walk order, marked', () => {
  const route = routeOf(
    [
      [0.1, 0.5],
      [0.5, 0.5],
      [0.9, 0.1],
      [0.9, 0.9],
    ],
    [
      [0, 1],
      [1, 2],
      [1, 3],
    ],
  );
  const { timeline } = evaluated(route, 0);
  const [, first, second] = timeline.lines;
  if (first === undefined || second === undefined) throw new Error('a fork');
  const ms = first.departMs + 0.5 * (first.arriveMs - first.departMs);
  const { heads, moment } = evaluated(route, ms);
  expect(heads.map((head) => head.main)).toEqual([true, false]);
  expect(heads[0]?.at).toEqual(moment.main?.at);
  expect(moment.main?.lineId).toBe(first.lineId);
  expect(framed(route, ms).heads).toHaveLength(2);
});

test('a hidden lead draws no head, still times its route and is still found, and the line still draws', () => {
  const route = routeOf(
    [
      [0.1, 0.5],
      [0.9, 0.5],
    ],
    [[0, 1]],
    { visible: false },
  );
  const { heads, at, timeline } = evaluated(route, 5_000);
  expect(heads).toEqual([]);
  expect(timeline.endMs).toBe(10_000);
  expect(at?.x).toBeCloseTo(0.5, 6);
  const { entries, heads: drawn, reports } = framed(route, 5_000);
  expect(reports).toEqual([]);
  expect(drawn).toEqual([]);
  // The line's stroke: the markers' white edges (stage 5b-1) are not the line's.
  const lines = entries.filter((entry) => entry.startsWith('stroke ') && !entry.includes('strokeStyle=#ffffff'));
  expect(lines).toHaveLength(1);
});

test('the head’s size is the setting in reference pixels times the frame’s scale, at two frame sizes', () => {
  const tips = (route: Route, size: { width: number; height: number }) =>
    framed(route, 5_000, size).entries.filter((entry) => entry.startsWith('moveTo ') && !entry.endsWith(' 0 0'));
  const route = routeOf(
    [
      [0.1, 0.5],
      [0.9, 0.5],
    ],
    [[0, 1]],
  );
  expect(tips(route, { width: 1920, height: 1080 })).toEqual(['moveTo 8 0 @ 1 0 0 1 960 540']);
  expect(tips(route, { width: 3840, height: 2160 })).toEqual(['moveTo 16 0 @ 1 0 0 1 1920 1080']);
  const large = { ...route, settings: { ...route.settings, lead: { ...route.settings.lead, headSize: 12 } } };
  expect(tips(large, { width: 3840, height: 2160 })).toEqual(['moveTo 24 0 @ 1 0 0 1 1920 1080']);
  expect(evaluated(large, 0).look).toEqual({
    style: 'arrow',
    colour: '#111111',
    size: 12,
    image: null,
    rotation: 'auto',
    offsetDegrees: 0,
  });
});

test('the rotation against v3’s numbers: measured on the canvas, held through a pause, turned leaving a stop', () => {
  // A diagonal on a 4:3 picture: v3 measures in canvas pixels, so it turns by atan2(0.8 × 1,080, 0.8 × 1,440).
  const diagonal = routeOf(
    [
      [0.1, 0.1],
      [0.9, 0.9],
    ],
    [[0, 1]],
  );
  expect(turned(framed(diagonal, 5_000).entries)[0]).toBeCloseTo(Math.atan2(3, 4), 2);
  // An L: a → b along y = 0.5, b paused 2 s, then b → c down x = 0.5.
  const corner = routeOf(
    [
      [0.1, 0.5],
      [0.5, 0.5, 2_000],
      [0.5, 0.9],
    ],
    [
      [0, 1],
      [1, 2],
    ],
  );
  const { timeline } = evaluated(corner, 0);
  const [ab, bc] = timeline.lines;
  if (ab === undefined || bc === undefined) throw new Error('two walked lines');
  const lengths = timeline.lines.map((each) => timeline.shapes.get(each.lineId)?.lengthWidths ?? 0);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const share = (lengths[1] ?? 0) / total;
  const angleAt = (ms: number) => turned(framed(corner, ms).entries)[0] ?? Number.NaN;
  // Approaching b (within 0.02 of the walk) and through its pause: along a → b, as v3 (:709–721, :783–789).
  expect(angleAt(ab.arriveMs - 0.01 * (ab.arriveMs - ab.departMs))).toBeCloseTo(0, 6);
  expect(angleAt(ab.arriveMs + 1_000)).toBeCloseTo(0, 6);
  // Leaving b, 0.02 of the walk on: half-way from a → b's way to the head's own (v3's blend, :795–804), the head's own
  // from three samples back to where it is (v3's getRawPathDir), on the canvas.
  const samples = timeline.shapes.get(bc.lineId)?.samples ?? [];
  const canvas = (point: ImagePoint | null | undefined) => ({ x: 240 + (point?.x ?? 0) * 1440, y: (point?.y ?? 0) * 1080 });
  const ownAt = (progress: number) => {
    const index = Math.floor(progress * (samples.length - 1));
    expect(index).toBeGreaterThan(3);
    const [back, here] = [canvas(samples[index - 3]), canvas(pointAt(samples, progress))];
    return Math.atan2(here.y - back.y, here.x - back.x);
  };
  const onBc = (progress: number) => angleAt(bc.departMs + progress * (bc.arriveMs - bc.departMs));
  expect(onBc(0.02 / share)).toBeCloseTo(ownAt(0.02 / share) / 2, 2);
  // Half-way down b → c, past both thresholds: the head's own way alone, near straight down.
  expect(onBc(0.5)).toBeCloseTo(ownAt(0.5), 2);
  expect(onBc(0.5)).toBeCloseTo(Math.PI / 2, 1);
});

test('each head style, rotation mode and offset through the drawing, an image head a dot until its picture comes', () => {
  const picture = { width: 64, height: 64, close() {} };
  const frame: Frame = {
    size: { width: 200, height: 100 },
    bounds: { x: 0, y: 0, width: 200, height: 100, scale: 1 },
    picture: null,
    scale: 2,
    view: null,
    images: new Map([
      ['head:drone', picture],
      ['asset:a1', picture],
    ]),
  };
  const right = [
    { x: 0, y: 0.5 },
    { x: 1, y: 0.5 },
  ] as const;
  const down = [
    { x: 0.5, y: 0 },
    { x: 0.5, y: 1 },
  ] as const;
  const draw = (look: Partial<Look>, heading: Heading, images = frame.images) => {
    const recorder = new Recorder();
    const value = {
      look: { style: 'arrow', colour: '#0072b2', size: 8, image: null, rotation: 'auto', offsetDegrees: 0, ...look },
      heads: [{ at: { x: 0.5, y: 0.5 }, main: true, heading }],
    } as const;
    lead.layers.leadHead?.(recorder, value, { ...frame, images });
    return recorder.take();
  };
  const plain = { course: right, toward: null, weight: 0 };
  const shapes = (entries: readonly string[]) =>
    entries.filter((entry) => /^(arc|moveTo|drawImage|fill) /.test(entry)).map((entry) => entry.split(' @ ')[0]);
  expect(shapes(draw({ style: 'dot' }, plain))).toEqual(['arc 0 0 8 0 6.283 clockwise', 'fill |']);
  expect(shapes(draw({}, plain))).toEqual(['moveTo 16 0', 'fill |']);
  expect(shapes(draw({ style: 'drone', image: 'head:drone' }, plain))).toEqual(['drawImage image(64x64) -16 -16 32 32 |']);
  expect(shapes(draw({ style: 'custom', image: 'asset:a1' }, plain))).toEqual(['drawImage image(64x64) -16 -16 32 32 |']);
  expect(shapes(draw({ style: 'drone', image: 'head:drone' }, plain, new Map()))).toEqual(['arc 0 0 8 0 6.283 clockwise', 'fill |']);
  expect(shapes(draw({ style: 'custom', image: null }, plain))).toEqual(['arc 0 0 8 0 6.283 clockwise', 'fill |']);
  expect(draw({}, plain).filter((entry) => entry.startsWith('fill '))).toEqual([`fill | @ 1 0 0 1 100 50 | fillStyle=#0072b2`]);
  // Auto turns to the heading, fixed stays upright; the offset turns either (v3's drawPathHead :2083–2092).
  const pointingDown = { course: down, toward: null, weight: 0 };
  expect(turned(draw({}, pointingDown))).toEqual([1.571]);
  expect(turned(draw({ rotation: 'fixed' }, pointingDown))).toEqual([0]);
  expect(turned(draw({ rotation: 'fixed', offsetDegrees: 90 }, pointingDown))).toEqual([1.571]);
  expect(turned(draw({ offsetDegrees: 90 }, pointingDown))).toEqual([3.142]);
  // v3's blend, a quarter of the way from right to down; and the short way round across ±π.
  expect(turned(draw({}, { course: right, toward: down, weight: 0.25 }))).toEqual([0.393]);
  const at = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return [
      { x: 0.5, y: 0.5 },
      { x: 0.5 + Math.cos(radians) / 4, y: 0.5 + Math.sin(radians) / 2 },
    ] as const;
  };
  expect(Math.abs(turned(draw({}, { course: at(170), toward: at(-170), weight: 0.5 }))[0] ?? 0)).toBeCloseTo(Math.PI, 2);
});

test('a lead module that fails is reported, never thrown, and the line still draws', () => {
  const throwing: Catalogue = {
    ...CATALOGUE,
    route: [
      line,
      {
        ...lead,
        evaluate: () => {
          throw new Error('the lead broke');
        },
      },
    ],
  };
  const route = straight();
  const { entries, reports, heads } = framed(route, 2_000, undefined, throwing);
  expect(reports.map((report) => [report.routeId, report.featureId])).toEqual([[route.id, 'lead']]);
  expect(reports[0]?.reason).toMatch(/the lead broke/);
  expect(heads).toEqual([]);
  expect(entries.filter((entry) => entry.startsWith('stroke '))).toHaveLength(1);
});

test('the same moment at two clock times draws the same heads, with no clock or random source read', () => {
  const route = straight();
  const first = framed(route, 3_000).entries;
  const refuse = (name: string) => () => {
    throw new Error(`${name} was read`);
  };
  vi.spyOn(Date, 'now').mockImplementation(refuse('Date.now'));
  vi.spyOn(performance, 'now').mockImplementation(refuse('performance.now'));
  vi.spyOn(Math, 'random').mockImplementation(refuse('Math.random'));
  expect(evaluated(route, 3_000).heads).toHaveLength(1);
  expect(framed(route, 3_000).entries).toEqual(first);
});
