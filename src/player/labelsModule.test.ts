// CORE-04 stage 5b-2: the stops' labels, through the real catalogue and the composer, as the recorder writes them.
// A test reaches a feature only through the catalogue. Every expected figure is worked from v3's renderLabel
// (v3/src/services/RenderingService.js:2534–2651) with the recorder's measure of text, half the type size a character:
// the box is the widest line plus 6 reference pixels each side (:2604–2613), lines 1.3 times the type size apart
// (:2603), the first line's middle half a line below the text's top (:2643), corners rounded by 4 (:2617).
import { afterEach, expect, test, vi } from 'vitest';
import { LAYERS, type Frame } from '../adapters/render/layers';
import { Recorder } from '../adapters/render/recorder';
import { newLine, newPoint, newRoute, newScene, type Route } from '../core/model/scene';
import { CATALOGUE, type Catalogue } from '../features/catalogue';
import { compose } from './compose';

afterEach(() => {
  vi.restoreAllMocks();
});

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

type Labels = Route['settings']['labels'];
type Place = readonly [x: number, y: number, label: string, kind?: 'stop' | 'bend'];

/** Points joined in a row, the first the lead's start, walked in 10 s; the labels' settings as given. */
function routeOf(places: readonly Place[], labels: Partial<Labels> = {}): Route {
  const nextId = counter();
  const points = places.map(([x, y, label, kind = 'stop']) => ({ ...newPoint(nextId, { x, y, kind }), label }));
  const ids = points.map((point) => point.id);
  const plain = { ...newRoute(nextId), points, leadStart: ids[0] ?? '' };
  const timing = { timing: 'total time', totalTimeMs: 10_000, startsAtMs: 0 } as const;
  return {
    ...plain,
    lines: ids.slice(1).map((to, i) => newLine(nextId, ids[i] ?? '', to)),
    settings: {
      ...plain.settings,
      lead: { ...plain.settings.lead, ...timing },
      labels: { ...plain.settings.labels, appearance: 'on', ...labels },
    },
  };
}

const source = { width: 400, height: 300, close() {} };
const HD = { width: 1920, height: 1080 };

/** A text the recorder wrote: its words, where its middle is, and the styles it was drawn with. */
interface Written {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly styles: string;
}

function writtenIn(entries: readonly string[]): Written[] {
  return entries.flatMap((entry) => {
    const found = /^fillText ("(?:[^"\\]|\\.)*") (\S+) (\S+) \| @ \S+ \S+ \S+ \S+ \S+ \S+ \| (.*)$/.exec(entry);
    if (found === null) return [];
    const [, text = '""', x, y, styles = ''] = found;
    return [{ text: String(JSON.parse(text)), x: Number(x), y: Number(y), styles }];
  });
}

/** Each label's box, read from its four rounded corners: left, top, right, bottom and the corners' radius. */
function boxesIn(entries: readonly string[]): number[][] {
  const corners = entries
    .filter((entry) => entry.startsWith('quadraticCurveTo '))
    .map((entry) => entry.split(' ').slice(1, 5).map(Number));
  const boxes: number[][] = [];
  for (let i = 0; i + 3 < corners.length; i += 4) {
    const [[right = 0, top = 0, , topEnd = 0] = [], , [left = 0, bottom = 0] = []] = corners.slice(i, i + 4);
    boxes.push([left, top, right, bottom, topEnd - top].map((n) => Math.round(n * 1000) / 1000));
  }
  return boxes;
}

/** A frame through the composer on a 400 × 300 picture (drawn 1,440 × 1,080 at 1080p, from x = 240). */
function framed(route: Route, sceneMs = 5_000, size = HD, catalogue: Catalogue = CATALOGUE) {
  const recorder = new Recorder();
  const scene = { ...newScene(counter()), routes: [route] };
  const image = { width: 400, height: 300, source };
  const surface = () => ({ context: new Recorder(), image: source });
  const reports = compose(recorder, { scene, sceneMs, seed: 7, size, image, surface }, catalogue);
  const entries = recorder.take();
  return { entries, reports, written: writtenIn(entries), boxes: boxesIn(entries) };
}

const PAIR: readonly Place[] = [
  [0.25, 0.5, 'Start'],
  [0.75, 0.5, 'B'],
];

test('the labels come between the markers and the pauses, drawn in the top layer, over the head', () => {
  expect(CATALOGUE.route.map((feature) => feature.id)).toEqual(['line', 'lead', 'markers', 'labels', 'pauses']);
  const labels = CATALOGUE.route.find((feature) => feature.id === 'labels');
  expect(Object.keys(labels?.layers ?? {})).toEqual(['labels']);
  expect(LAYERS[LAYERS.length - 1]).toBe('labels');
  // The lead stands on the last stop at the end: its head is drawn (translated there) before the label over it.
  const { entries } = framed(routeOf(PAIR), 12_000);
  const head = entries.findIndex((entry) => entry.startsWith('translate 1320 540'));
  expect(head).toBeGreaterThan(-1);
  expect(entries.findIndex((entry) => entry.startsWith('fillText "B"'))).toBeGreaterThan(head);
});

test('a label for each stop with text, where it stands, and none for a bend or an empty label', () => {
  const route = routeOf([
    [0.25, 0.5, 'A'],
    [0.5, 0.25, 'a bend', 'bend'],
    [0.5, 0.75, ''],
    [0.75, 0.5, 'C'],
  ]);
  // (0.25, 0.5) on the picture drawn from x = 240, 1,440 wide: (240 + 360, 540).
  expect(framed(route).written.map(({ text, x, y }) => [text, x, y])).toEqual([
    ['A', 600, 540],
    ['C', 1320, 540],
  ]);
});

test('“off” draws no label at any moment, and “on” draws each one whole at every moment', () => {
  for (const ms of [0, 2_500, 5_000, 10_000, 12_000]) {
    expect(framed(routeOf(PAIR, { appearance: 'off' }), ms).written).toEqual([]);
    const whole = framed(routeOf(PAIR), ms).written;
    expect(whole.map(({ text }) => text)).toEqual(['Start', 'B']);
    expect(whole.every(({ styles }) => !styles.includes('globalAlpha'))).toBe(true);
  }
});

test('the type is v3’s size scaled once with the frame, and the box’s padding and corners with it', () => {
  const font = (written: readonly Written[]) => written.map(({ styles }) => /font=(\S+)/.exec(styles)?.[1]);
  // 1080p: render scale 1. "B" is 8 wide at 16 px; the box 8 + 2 × 6 = 20 wide and 20.8 + 12 = 32.8 tall about
  // (1320, 540).
  const hd = framed(routeOf(PAIR));
  expect(font(hd.written)).toEqual(['16px', '16px']);
  expect(hd.boxes[1]).toEqual([1310, 523.6, 1330, 556.4, 4]);
  expect(hd.written[0]?.styles).toContain("font=16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
  expect(hd.written[0]?.styles).toContain('textAlign=center textBaseline=middle');
  // 960 × 540: render scale 0.5; the picture 720 wide from x = 120, so the stop at (660, 270). "B" is 4 wide at 8 px;
  // the box 4 + 2 × 3 = 10 wide and 10.4 + 6 = 16.4 tall, its corners 2.
  const half = framed(routeOf(PAIR), 5_000, { width: 960, height: 540 });
  expect(font(half.written)).toEqual(['8px', '8px']);
  expect(half.boxes[1]).toEqual([655, 261.8, 665, 278.2, 2]);
  // A 32 px label at 1080p is drawn at 32 px: scaled once, by the frame alone.
  expect(font(framed(routeOf(PAIR, { size: 32 })).written)).toEqual(['32px', '32px']);
});

test('the offsets are shares of the frame’s width and height, about the stop', () => {
  // 10 % of 1,920 is 192 right; −20 % of 1,080 is 216 up (:2569–2574).
  const { written, boxes } = framed(routeOf(PAIR, { offsetX: 10, offsetY: -20 }));
  expect(written.map(({ x, y }) => [x, y])).toEqual([
    [792, 324],
    [1512, 324],
  ]);
  expect(boxes[1]).toEqual([1502, 307.6, 1522, 340.4, 4]);
});

test('a long label wraps at spaces to the width, a single long word stays whole, and the box fits the widest line', () => {
  // The width is 5 % of 1,920, 96 px: twelve characters at 16 px. "aaaa bbbb cccc" is 112 wide, so "cccc" wraps
  // (:2589–2595). Two lines 20.8 apart about y = 540: their middles at 529.6 and 550.4 (:2643).
  const wrapped = framed(routeOf([[0.25, 0.5, 'aaaa bbbb cccc']], { width: 5 }));
  expect(wrapped.written.map(({ text, x, y }) => [text, x, y])).toEqual([
    ['aaaa bbbb', 600, 529.6],
    ['cccc', 600, 550.4],
  ]);
  // The widest line, 72, plus 12: 84 wide; two lines, 41.6 + 12 = 53.6 tall.
  expect(wrapped.boxes).toEqual([[558, 513.2, 642, 566.8, 4]]);
  // A word wider than the width is a line of its own, never broken (:2592); the box is as wide as it, 34 × 8 + 12.
  const word = 'Supercalifragilisticexpialidocious';
  const long = framed(routeOf([[0.25, 0.5, `${word} end`]], { width: 5 }));
  expect(long.written.map(({ text }) => text)).toEqual([word, 'end']);
  expect(long.boxes[0]?.slice(0, 3)).toEqual([458, 513.2, 742]);
});

test('the box is drawn in the background’s colour at its opacity, and not at all at 0', () => {
  const fills = (entries: readonly string[]) => entries.filter((entry) => entry.includes('fillStyle=#336699'));
  const drawn = framed(routeOf(PAIR, { backgroundColour: '#336699', backgroundOpacity: 0.5 }));
  expect(fills(drawn.entries)).toEqual([
    'fill | @ 1 0 0 1 0 0 | fillStyle=#336699 globalAlpha=0.5',
    'fill | @ 1 0 0 1 0 0 | fillStyle=#336699 globalAlpha=0.5',
  ]);
  expect(framed(routeOf(PAIR)).entries.filter((entry) => entry.endsWith('fillStyle=#ffffff globalAlpha=0.85'))).toHaveLength(2);
  const none = framed(routeOf(PAIR, { backgroundColour: '#336699', backgroundOpacity: 0 }));
  expect(fills(none.entries)).toEqual([]);
  expect(none.boxes).toEqual([]);
  expect(none.written.map(({ text }) => text)).toEqual(['Start', 'B']);
  // The text in its own colour, whole.
  const coloured = framed(routeOf(PAIR, { textColour: '#0072b2' })).written;
  expect(coloured.every(({ styles }) => styles.startsWith('fillStyle=#0072b2 font='))).toBe(true);
});

test('a labels module that fails is reported, never thrown, and the markers and the head still draw', () => {
  const throwing: Catalogue = {
    ...CATALOGUE,
    route: CATALOGUE.route.map((feature) =>
      feature.id === 'labels'
        ? {
            ...feature,
            evaluate: () => {
              throw new Error('the labels broke');
            },
          }
        : feature,
    ),
  };
  const plain = routeOf(PAIR);
  const markers = { ...plain.settings.markers, appearance: 'always' } as const;
  const route = { ...plain, settings: { ...plain.settings, markers } };
  const { entries, reports, written } = framed(route, 5_000, HD, throwing);
  expect(reports.map((report) => [report.routeId, report.featureId])).toEqual([[route.id, 'labels']]);
  expect(reports[0]?.reason).toMatch(/the labels broke/);
  expect(written).toEqual([]);
  expect(entries.filter((entry) => entry.startsWith('arc '))).toHaveLength(2);
  expect(entries.filter((entry) => entry.startsWith('translate '))).toHaveLength(1);
});

test('the same moment draws the same labels, with no clock or random source read', () => {
  const route = routeOf(PAIR);
  const first = framed(route, 4_000).entries;
  const refuse = (name: string) => () => {
    throw new Error(`${name} was read`);
  };
  vi.spyOn(Date, 'now').mockImplementation(refuse('Date.now'));
  vi.spyOn(performance, 'now').mockImplementation(refuse('performance.now'));
  vi.spyOn(Math, 'random').mockImplementation(refuse('Math.random'));
  expect(framed(route, 4_000).entries).toEqual(first);
});

/** The labels' drawing, taken from the catalogue, called below with hand-made values (as markersModule.test.ts does). */
const labelsLayer = CATALOGUE.route.find((feature) => feature.id === 'labels')?.layers.labels;

/** A 200 × 100 canvas showing the whole picture at render scale 2. */
const FRAME: Frame = {
  size: { width: 200, height: 100 },
  bounds: { x: 0, y: 0, width: 200, height: 100, scale: 1 },
  picture: null,
  scale: 2,
  view: null,
  images: new Map(),
};

const LOOK = {
  size: 16,
  width: 50,
  offsetX: 0,
  offsetY: 0,
  textColour: '#1a1a1a',
  backgroundColour: '#ffffff',
  backgroundOpacity: 0.5,
};

function drawn(labels: readonly { at: { x: number; y: number }; text: string; opacity: number }[]) {
  const recorder = new Recorder();
  const value = { look: LOOK, labels: labels.map((label, i) => ({ pointId: `p${i}`, ...label })) };
  labelsLayer?.(recorder, value, FRAME);
  return recorder.take();
}

test('a label below full opacity is drawn at it, its box at that times the background’s, and none at 0', () => {
  expect(labelsLayer).toBeDefined();
  // At render scale 2 the type is 32 px: "Hi" is 32 wide, the box 32 + 24 = 56 by 41.6 + 24 = 65.6 about (100, 50).
  const entries = drawn([{ at: { x: 0.5, y: 0.5 }, text: 'Hi', opacity: 0.5 }]);
  expect(entries.filter((entry) => entry.startsWith('fill |'))).toEqual([
    'fill | @ 1 0 0 1 0 0 | fillStyle=#ffffff globalAlpha=0.25',
  ]);
  expect(boxesIn(entries)).toEqual([[72, 17.2, 128, 82.8, 8]]);
  expect(writtenIn(entries).map(({ text, x, y, styles }) => [text, x, y, /globalAlpha=\S+/.exec(styles)?.[0]])).toEqual([
    ['Hi', 100, 50, 'globalAlpha=0.5'],
  ]);
  expect(drawn([{ at: { x: 0.5, y: 0.5 }, text: 'Hi', opacity: 0 }])).toEqual([]);
  expect(drawn([{ at: { x: Number.NaN, y: 0.5 }, text: 'Hi', opacity: 1 }])).toEqual([]);
});
