// CORE-04 stage 5b-1: the stops' markers, through the real catalogue and the composer, as the recorder writes them.
// A test reaches a feature only through the catalogue. The lead's head is v3's default arrow (D143), drawn with no arc,
// so every arc in a frame here is a marker's.
import { afterEach, expect, test, vi } from 'vitest';
import { LAYERS } from '../adapters/render/layers';
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
