// CORE-04 stage 5b-1: the stops' markers, through the real catalogue and the composer, as the recorder writes them.
// A test reaches a feature only through the catalogue. The lead's head is v3's default arrow (D143), drawn with no arc,
// so every arc in a frame here is a marker's.
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

type Markers = Route['settings']['markers'];
type Place = readonly [x: number, y: number, kind?: 'stop' | 'bend', pauseMs?: number];

/** Points joined in a row, the first the lead's start, walked in 10 s by total time; the markers' settings as given. */
function routeOf(places: readonly Place[], markers: Partial<Markers> = {}): Route {
  const nextId = counter();
  const points = places.map(([x, y, kind = 'stop', pauseMs = 0]) => ({ ...newPoint(nextId, { x, y, kind }), pauseMs }));
  const ids = points.map((point) => point.id);
  const plain = { ...newRoute(nextId), points, leadStart: ids[0] ?? '' };
  const timing = { timing: 'total time', totalTimeMs: 10_000, startsAtMs: 0 } as const;
  return {
    ...plain,
    lines: ids.slice(1).map((to, i) => newLine(nextId, ids[i] ?? '', to)),
    settings: {
      ...plain.settings,
      lead: { ...plain.settings.lead, ...timing },
      markers: { ...plain.settings.markers, ...markers },
    },
  };
}

const source = { width: 400, height: 300, close() {} };
const HD = { width: 1920, height: 1080 };

/** A frame through the composer on a 400 × 300 picture (drawn 1,440 × 1,080 at 1080p, from x = 240). */
function framed(route: Route, sceneMs: number, size = HD, catalogue: Catalogue = CATALOGUE) {
  const recorder = new Recorder();
  const scene = { ...newScene(counter()), routes: [route] };
  const image = { width: 400, height: 300, source };
  const surface = () => ({ context: new Recorder(), image: source });
  const reports = compose(recorder, { scene, sceneMs, seed: 7, size, image, surface }, catalogue);
  const entries = recorder.take();
  const dots = entries
    .filter((entry) => entry.startsWith('arc '))
    .map((entry) => entry.split(' ').slice(1, 4).map(Number));
  return { entries, reports, dots };
}

const ROW: readonly Place[] = [
  [0.25, 0.5],
  [0.5, 0.25, 'bend'],
  [0.75, 0.5],
];

test('the markers come after the lead in the route’s list and are drawn under its head', () => {
  const ids = CATALOGUE.route.map((feature) => feature.id);
  expect(ids.indexOf('markers')).toBeGreaterThan(ids.indexOf('lead'));
  expect(LAYERS.indexOf('markers')).toBeLessThan(LAYERS.indexOf('leadHead'));
  const { entries } = framed(routeOf(ROW, { appearance: 'always' }), 5_000);
  const lastMarker = Math.max(...entries.flatMap((entry, i) => (entry.startsWith('arc ') ? [i] : [])));
  const firstHead = entries.findIndex((entry) => entry.startsWith('translate '));
  expect(lastMarker).toBeGreaterThan(-1);
  expect(firstHead).toBeGreaterThan(lastMarker);
});

test('a marker for each stop, where it stands, and none for a bend', () => {
  expect(framed(routeOf(ROW, { appearance: 'always' }), 5_000).dots).toEqual([
    [600, 540, 8],
    [1320, 540, 8],
  ]);
});

test('a marker’s size is its radius in reference pixels, scaled once with the frame', () => {
  const route = routeOf(ROW, { appearance: 'always', size: 12 });
  expect(framed(route, 5_000).dots[0]).toEqual([600, 540, 12]);
  // At 4K the picture is drawn 2,880 × 2,160 from x = 480: twice the size, its edge twice as wide.
  const { dots, entries } = framed(route, 5_000, { width: 3840, height: 2160 });
  expect(dots[0]).toEqual([1200, 1080, 24]);
  expect(entries).toContain('stroke | @ 1 0 0 1 0 0 | strokeStyle=#ffffff lineWidth=4');
});

test('a marker is filled in the route’s marker colour, with v3’s white edge', () => {
  const { entries } = framed(routeOf(ROW, { appearance: 'always', colour: '#0072b2' }), 5_000);
  const marker = entries.findIndex((entry) => entry.startsWith('arc '));
  expect(entries.slice(marker + 1, marker + 3)).toEqual([
    'fill | @ 1 0 0 1 0 0 | fillStyle=#0072b2',
    'stroke | @ 1 0 0 1 0 0 | strokeStyle=#ffffff lineWidth=2',
  ]);
});

test('“always” shows every stop’s marker whole at every moment, and “never” shows none', () => {
  for (const ms of [0, 2_500, 5_000, 10_000, 12_000]) {
    expect(framed(routeOf(ROW, { appearance: 'always' }), ms).dots.map(([, , radius]) => radius)).toEqual([8, 8]);
    expect(framed(routeOf(ROW, { appearance: 'never' }), ms).dots).toEqual([]);
  }
});

test('a markers module that fails is reported, never thrown, and the line and the head still draw', () => {
  const throwing: Catalogue = {
    ...CATALOGUE,
    route: CATALOGUE.route.map((feature) =>
      feature.id === 'markers'
        ? {
            ...feature,
            evaluate: () => {
              throw new Error('the markers broke');
            },
          }
        : feature,
    ),
  };
  const route = routeOf(ROW, { appearance: 'always' });
  const { entries, reports, dots } = framed(route, 5_000, HD, throwing);
  expect(reports.map((report) => [report.routeId, report.featureId])).toEqual([[route.id, 'markers']]);
  expect(reports[0]?.reason).toMatch(/the markers broke/);
  expect(dots).toEqual([]);
  expect(entries.filter((entry) => entry.startsWith('stroke | @ 1 0 0 1 0 0 | strokeStyle=#d55e00'))).toHaveLength(1);
  expect(entries.filter((entry) => entry.startsWith('translate '))).toHaveLength(1);
});

test('the same moment draws the same markers, with no clock or random source read', () => {
  const route = routeOf(ROW, { appearance: 'always' });
  const first = framed(route, 4_000).entries;
  const refuse = (name: string) => () => {
    throw new Error(`${name} was read`);
  };
  vi.spyOn(Date, 'now').mockImplementation(refuse('Date.now'));
  vi.spyOn(performance, 'now').mockImplementation(refuse('performance.now'));
  vi.spyOn(Math, 'random').mockImplementation(refuse('Math.random'));
  expect(framed(route, 4_000).entries).toEqual(first);
});

/** The markers' drawing, taken from the catalogue, called below with hand-made values (as leadModule.test.ts does). */
const markersLayer = CATALOGUE.route.find((feature) => feature.id === 'markers')?.layers.markers;

/** What the markers' model gives, as these tests read it. */
interface Look {
  readonly style: 'dot' | 'square' | 'flag' | 'custom' | 'none';
  readonly colour: string;
  readonly size: number;
  readonly image: string | null;
  readonly rotation: 'auto' | 'fixed';
  readonly offsetDegrees: number;
}

const pin = { width: 64, height: 64, close() {} };

/** A 200 × 100 canvas showing the whole picture at render scale 2, with a picture handed in as `asset:pin`. */
const FRAME: Frame = {
  size: { width: 200, height: 100 },
  bounds: { x: 0, y: 0, width: 200, height: 100, scale: 1 },
  picture: null,
  scale: 2,
  view: null,
  images: new Map([['asset:pin', pin]]),
};

/** A marker's course as the model gives it: two places on the picture, from and to. */
type Course = readonly [{ readonly x: number; readonly y: number }, { readonly x: number; readonly y: number }];

interface Drawn {
  readonly scale?: number;
  readonly images?: Frame['images'];
  readonly course?: Course | null;
}

/** One marker in the middle, (100, 50) on the canvas, of look size 5 (10 there at scale 1), straight through the layer. */
function drawn(look: Partial<Look>, { scale = 1, images = FRAME.images, course = null }: Drawn = {}) {
  const recorder = new Recorder();
  const value = {
    look: { style: 'dot', colour: '#0072b2', size: 5, image: null, rotation: 'fixed', offsetDegrees: 0, ...look },
    markers: [{ pointId: 'p', at: { x: 0.5, y: 0.5 }, scale, course }],
  } as const;
  markersLayer?.(recorder, value, { ...FRAME, images });
  return recorder.take();
}

/** Each call the recorder wrote, its matrix and styles left off. */
const calls = (entries: readonly string[]) => entries.map((entry) => entry.split(' @ ')[0]);

test('the square and the flag at v3’s coordinates (RenderingService.js:2443–2468), half the size at a scale of 0.5', () => {
  expect(markersLayer).toBeDefined();
  // The square: from (x − size, y − size), twice the size each way. At (100, 50), size 10, then 5.
  expect(calls(drawn({ style: 'square' }))).toEqual(['beginPath', 'rect 90 40 20 20', 'fill |', 'stroke |']);
  expect(calls(drawn({ style: 'square' }, { scale: 0.5 }))).toEqual(['beginPath', 'rect 95 45 10 10', 'fill |', 'stroke |']);
  // The flag: flagY = y − size; the pole from flagY − 2 × size down to the stop; the pennant from the pole's top to
  // (x + 1.5 size, flagY − 1.3 size), (x + 1.2 size, flagY − size), (x, flagY − 0.7 size), closed.
  expect(calls(drawn({ style: 'flag' }))).toEqual([
    'beginPath',
    'moveTo 100 20',
    'lineTo 100 50',
    'moveTo 100 20',
    'lineTo 115 27',
    'lineTo 112 30',
    'lineTo 100 33',
    'closePath',
    'fill |',
    'stroke |',
  ]);
  expect(calls(drawn({ style: 'flag' }, { scale: 0.5 })).slice(1, 7)).toEqual([
    'moveTo 100 35',
    'lineTo 100 50',
    'moveTo 100 35',
    'lineTo 107.5 38.5',
    'lineTo 106 40',
    'lineTo 100 41.5',
  ]);
  // Each filled in the colour with v3's white edge, two reference pixels wide (4 at render scale 2).
  for (const style of ['square', 'flag'] as const) {
    expect(drawn({ style }).filter((entry) => /^(fill|stroke) /.test(entry))).toEqual([
      'fill | @ 1 0 0 1 0 0 | fillStyle=#0072b2',
      'stroke | @ 1 0 0 1 0 0 | strokeStyle=#ffffff lineWidth=4',
    ]);
    expect(drawn({ style }, { scale: 0 })).toEqual([]);
  }
});

test('“none” and a transparent colour draw nothing, whatever the style (v3’s RenderingService.js:2393–2400)', () => {
  expect(drawn({ style: 'none' })).toEqual([]);
  for (const style of ['dot', 'square', 'flag'] as const) expect(drawn({ style, colour: 'transparent' })).toEqual([]);
  expect(drawn({ style: 'custom', image: 'asset:pin', colour: 'transparent' })).toEqual([]);
});

test('a picture handed in is drawn twice the size, centred, unfilled and unedged; with none to draw, a dot', () => {
  expect(calls(drawn({ style: 'custom', image: 'asset:pin' }))).toEqual([
    'save',
    'translate 100 50',
    'drawImage image(64x64) -10 -10 20 20 |',
    'restore',
  ]);
  expect(calls(drawn({ style: 'custom', image: 'asset:pin' }, { scale: 0.5 }))).toContain(
    'drawImage image(64x64) -5 -5 10 10 |',
  );
  const aDot = ['beginPath', 'arc 100 50 10 0 6.283 clockwise', 'fill |', 'stroke |'];
  // A picture's name with nothing handed in under it, and a custom marker naming none: v3's dot (:2477–2482).
  expect(calls(drawn({ style: 'custom', image: 'asset:pin' }, { images: new Map() }))).toEqual(aDot);
  expect(calls(drawn({ style: 'custom', image: null }))).toEqual(aDot);
  expect(calls(drawn({}))).toEqual(aDot);
});

const turned = (entries: readonly string[]) =>
  entries.filter((entry) => entry.startsWith('rotate ')).map((entry) => Number(entry.split(' ')[1]));

test('a picture under “auto” turns to its course on the canvas, then by the offset; under “fixed”, not at all', () => {
  const pictured = { style: 'custom', image: 'asset:pin' } as const;
  // Toward (1, 1) from the middle of a 200 × 100 canvas: atan2(50, 100), not the picture's 45°.
  const diagonal: Course = [
    { x: 0.5, y: 0.5 },
    { x: 1, y: 1 },
  ];
  expect(turned(drawn({ ...pictured, rotation: 'auto' }, { course: diagonal }))).toEqual([0.464]);
  expect(turned(drawn({ ...pictured, rotation: 'auto', offsetDegrees: 90 }, { course: diagonal }))).toEqual([2.034]);
  // A stop on no line: v3's angle 0, the offset still added (:2420, :2431–2432).
  expect(turned(drawn({ ...pictured, rotation: 'auto', offsetDegrees: 90 }))).toEqual([1.571]);
  // Fixed, v3's default: no turn, the offset not read (v3's markers; the head reads it in both modes).
  expect(turned(drawn({ ...pictured, offsetDegrees: 90 }, { course: diagonal }))).toEqual([]);
  // Only a picture turns: a square under auto records none.
  expect(turned(drawn({ style: 'square', rotation: 'auto' }, { course: diagonal }))).toEqual([]);
});

/** The value's markers, if it is the markers' drawing: the catalogue's modules give `unknown`. */
const isDrawing = (value: unknown): value is { readonly markers: readonly unknown[] } =>
  typeof value === 'object' && value !== null && 'markers' in value && Array.isArray(value.markers);

/** The real catalogue with the markers' look made a picture under “auto”, which no setting can ask for yet (D144). */
const picturing: Catalogue = {
  ...CATALOGUE,
  route: CATALOGUE.route.map((feature) => {
    if (feature.id !== 'markers') return feature;
    const look = { style: 'custom', colour: '#0072b2', size: 8, image: 'asset:pin', rotation: 'auto', offsetDegrees: 0 };
    const wrapped: Catalogue['route'][number] = {
      ...feature,
      evaluate: (input) => {
        const result = feature.evaluate(input);
        return result.ok && isDrawing(result.value) ? { ok: true, value: { ...result.value, look } } : result;
      },
    };
    return wrapped;
  }),
};

test('each stop’s course through the model: its first line out’s end, else from its first line in; a fork’s first', () => {
  const turns = (route: Route) => {
    const recorder = new Recorder();
    const scene = { ...newScene(counter()), routes: [route] };
    const image = { width: 400, height: 300, source };
    const surface = () => ({ context: new Recorder(), image: source });
    const images = new Map([['asset:pin', pin]]);
    compose(recorder, { scene, sceneMs: 0, seed: 7, size: HD, image, surface, images }, picturing);
    return turned(recorder.take());
  };
  // On the 1,440 × 1,080 drawing: the first stop toward the bend, atan2(−270, 360); the last on from it, atan2(270, 360).
  // At 0 ms the lead has no head yet, so every turn recorded is a marker's.
  expect(turns(routeOf(ROW, { appearance: 'always' }))).toEqual([-0.644, 0.644]);
  // A fork from the first stop: it points along its first line out in the route's saved order.
  const fork = routeOf(
    [
      [0.25, 0.5],
      [0.5, 0.25],
      [0.5, 0.75],
    ],
    { appearance: 'always' },
  );
  const [a, b, c] = fork.points.map((point) => point.id);
  const lines = (order: readonly (readonly [string | undefined, string | undefined])[]) =>
    order.map(([from = '', to = ''], i) => ({ ...newLine(counter(), from, to), id: `line${i}` }));
  expect(turns({ ...fork, lines: lines([[a, b], [a, c]]) })).toEqual([-0.644, -0.644, 0.644]);
  expect(turns({ ...fork, lines: lines([[a, c], [a, b]]) })).toEqual([0.644, -0.644, 0.644]);
});
