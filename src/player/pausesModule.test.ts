// CORE-04 stage 5b-3: the stops' pauses, model only, through the real catalogue and the composer. A test reaches a
// feature only through the catalogue: the pauses' windows are read by wrapping its own evaluation, unchanged.
import { afterEach, expect, test, vi } from 'vitest';
import { Recorder } from '../adapters/render/recorder';
import { PAUSE_SETTINGS } from '../core/config/settings';
import { newLine, newPoint, newRoute, newScene, POINT_FIELDS, type Route } from '../core/model/scene';
import { CATALOGUE, type Catalogue } from '../features/catalogue';
import { compose } from './compose';

afterEach(() => {
  vi.restoreAllMocks();
});

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

type Place = readonly [x: number, y: number, kind: 'stop' | 'bend', pauseMs: number];

/** Points from the first, the lead's start, joined by `pairs` of indices, walked in 10 s by total time. */
function routeOf(places: readonly Place[], pairs: readonly (readonly [number, number])[]): Route {
  const nextId = counter();
  const points = places.map(([x, y, kind, pauseMs]) => ({ ...newPoint(nextId, { x, y, kind }), pauseMs }));
  const id = (i: number) => points[i]?.id ?? '';
  const plain = { ...newRoute(nextId), points, leadStart: id(0) };
  const timing = { timing: 'total time', totalTimeMs: 10_000, startsAtMs: 0 } as const;
  return {
    ...plain,
    lines: pairs.map(([from, to]) => newLine(nextId, id(from), id(to))),
    settings: { ...plain.settings, lead: { ...plain.settings.lead, ...timing } },
  };
}

const source = { width: 400, height: 300, close() {} };

/** A frame through the composer: what it drew, what it reported, and what each pauses module gave. */
function framed(route: Route, sceneMs: number, catalogue: Catalogue = CATALOGUE) {
  const given: unknown[] = [];
  const watched: Catalogue = {
    ...catalogue,
    route: catalogue.route.map((feature) => {
      if (feature.id !== 'pauses') return feature;
      const wrapped: Catalogue['route'][number] = {
        ...feature,
        evaluate: (input) => {
          const result = feature.evaluate(input);
          given.push(result.ok ? result.value : result);
          return result;
        },
      };
      return wrapped;
    }),
  };
  const recorder = new Recorder();
  const scene = { ...newScene(counter()), routes: [route] };
  const image = { width: 400, height: 300, source };
  const surface = () => ({ context: new Recorder(), image: source });
  const size = { width: 1920, height: 1080 };
  const reports = compose(recorder, { scene, sceneMs, seed: 7, size, image, surface }, watched);
  return { entries: recorder.take(), reports, given };
}

/** The stops pausing at each tenth of a second from 0 to 12 s: [ms, pointId, elapsedMs, totalMs]. */
function pausing(route: Route) {
  return Array.from({ length: 121 }, (_, i) => i * 100).flatMap((ms) =>
    framed(route, ms).given.flatMap((value) =>
      typeof value === 'object' && value !== null && 'windows' in value && Array.isArray(value.windows)
        ? value.windows.map((window: { pointId: string; elapsedMs: number; totalMs: number }) => [
            ms,
            window.pointId,
            window.elapsedMs,
            window.totalMs,
          ])
        : [],
    ),
  );
}

test('the pauses come after the markers in the route’s list, draw in no layer and declare no field twice', () => {
  const ids = CATALOGUE.route.map((feature) => feature.id);
  expect(ids.indexOf('pauses')).toBeGreaterThan(ids.indexOf('markers'));
  const pauses = CATALOGUE.route.find((feature) => feature.id === 'pauses');
  expect(Object.keys(pauses?.layers ?? { missing: true })).toEqual([]);
  expect(Object.keys(pauses?.settings ?? { missing: true })).toEqual([]);
  expect(pauses?.stopSettings).toBe(PAUSE_SETTINGS);
  expect(POINT_FIELDS.pauseMs).toBe(PAUSE_SETTINGS.pauseMs);
  // A frame draws the same with the pauses and without them.
  const route = routeOf(ROW, [
    [0, 1],
    [1, 2],
    [2, 3],
  ]);
  const without = { ...CATALOGUE, route: CATALOGUE.route.filter((feature) => feature.id !== 'pauses') };
  for (const ms of [0, 4_000, 5_000, 12_000]) expect(framed(route, ms).entries).toEqual(framed(route, ms, without).entries);
});

/** The start, a bend and a stop, each with a pause of 1 s, then a last stop. */
const ROW: readonly Place[] = [
  [0.2, 0.5, 'stop', 1_000],
  [0.4, 0.5, 'bend', 1_000],
  [0.6, 0.5, 'stop', 1_000],
  [0.8, 0.5, 'stop', 0],
];

test('a stop’s window before, through and after its pause; none at the route’s start and none at a bend', () => {
  const route = routeOf(ROW, [
    [0, 1],
    [1, 2],
    [2, 3],
  ]);
  const windows = pausing(route);
  const third = route.points[2]?.id;
  // Only the third point, a stop, ever pauses; the start's and the bend's pauses are never taken.
  expect(new Set(windows.map(([, pointId]) => pointId))).toEqual(new Set([third]));
  expect(windows.every(([, , , totalMs]) => totalMs === 1_000)).toBe(true);
  // A second of frames a tenth apart, then none: its time paused starts within the first tenth and counts with the clock.
  expect(windows).toHaveLength(10);
  const [ms0 = 0, , elapsed0 = 0] = (windows[0] ?? []).map(Number);
  expect(elapsed0).toBeGreaterThanOrEqual(0);
  expect(elapsed0).toBeLessThan(100);
  const steps = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  expect(windows.map(([ms]) => Number(ms) - ms0)).toEqual(steps);
  expect(windows.map(([, , elapsedMs]) => Math.round(Number(elapsedMs) - elapsed0))).toEqual(steps);
});

test('two stops pausing at once on a fork each give a window', () => {
  const fork = routeOf(
    [
      [0.25, 0.5, 'stop', 0],
      [0.5, 0.25, 'stop', 1_000],
      [0.5, 0.75, 'stop', 1_000],
    ],
    [
      [0, 1],
      [0, 2],
    ],
  );
  const [, b, c] = fork.points.map((point) => point.id);
  const windows = pausing(fork);
  const both = windows.filter(([ms]) => windows.filter(([other]) => other === ms).length === 2);
  expect(both.length).toBeGreaterThan(0);
  expect(new Set(both.map(([, pointId]) => pointId))).toEqual(new Set([b, c]));
});

test('a pauses module that fails is reported, never thrown, and the other modules still draw', () => {
  const throwing: Catalogue = {
    ...CATALOGUE,
    route: CATALOGUE.route.map((feature) =>
      feature.id === 'pauses'
        ? {
            ...feature,
            evaluate: () => {
              throw new Error('the pauses broke');
            },
          }
        : feature,
    ),
  };
  const route = routeOf(ROW, [
    [0, 1],
    [1, 2],
    [2, 3],
  ]);
  const { entries, reports } = framed(route, 5_000, throwing);
  expect(reports.map((report) => [report.routeId, report.featureId])).toEqual([[route.id, 'pauses']]);
  expect(reports[0]?.reason).toMatch(/the pauses broke/);
  expect(entries).toEqual(framed(route, 5_000).entries);
});

test('the same moment gives the same windows, with no clock or random source read', () => {
  const route = routeOf(ROW, [
    [0, 1],
    [1, 2],
    [2, 3],
  ]);
  const first = pausing(route);
  const refuse = (name: string) => () => {
    throw new Error(`${name} was read`);
  };
  vi.spyOn(Date, 'now').mockImplementation(refuse('Date.now'));
  vi.spyOn(performance, 'now').mockImplementation(refuse('performance.now'));
  vi.spyOn(Math, 'random').mockImplementation(refuse('Math.random'));
  expect(pausing(route)).toEqual(first);
});
