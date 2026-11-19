// CORE-04 stage 6: what the composer hands an overlay, and the proof that a frame asked for without overlays holds
// none, through the real catalogue and the recorder. A test reaches a feature only through the catalogue. The lead's
// head is v3's default arrow (D143), drawn with no arc, so every arc in a frame here before the overlays is a marker's.
import { expect, test } from 'vitest';
import type { DrawContext } from '../adapters/render/context';
import { hoverRing, plusHandle, selectionRect, selectionRing, unitAt, type Overlay, type Screen } from '../adapters/render/overlays';
import { Recorder } from '../adapters/render/recorder';
import type { RouteInput, View } from '../core/feature/contract';
import { newLine, newPoint, newRoute, newScene, type Route, type Scene } from '../core/model/scene';
import { CATALOGUE, type Catalogue, type RouteFeature, type SceneFeature } from '../features/catalogue';
import { compose, type FrameRequest } from './compose';

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

/** Three stops and a bend in a row, walked in 10 s, every stop's marker shown whole. */
function sceneOf(): Scene {
  const nextId = counter();
  const places = [
    { x: 0.25, y: 0.5, kind: 'stop' },
    { x: 0.4, y: 0.3, kind: 'bend' },
    { x: 0.6, y: 0.55, kind: 'stop' },
    { x: 0.8, y: 0.4, kind: 'stop' },
  ] as const;
  const points = places.map((place) => newPoint(nextId, place));
  const ids = points.map((point) => point.id);
  const plain = newRoute(nextId);
  const route: Route = {
    ...plain,
    points,
    leadStart: ids[0] ?? '',
    lines: ids.slice(1).map((to, i) => newLine(nextId, ids[i] ?? '', to)),
    settings: {
      ...plain.settings,
      lead: { ...plain.settings.lead, timing: 'total time', totalTimeMs: 10_000, startsAtMs: 0 },
      markers: { ...plain.settings.markers, appearance: 'always' },
    },
  };
  return { ...newScene(nextId), routes: [route] };
}

const source = { width: 400, height: 300, close() {} };

function request(scene: Scene, extra: Partial<FrameRequest> = {}): FrameRequest {
  const image = { width: 400, height: 300, source };
  const surface = () => ({ context: new Recorder(), image: source });
  return { scene, sceneMs: 4_000, seed: 7, size: { width: 1920, height: 1080 }, image, surface, ...extra };
}

function draw(ask: FrameRequest, catalogue: Catalogue = CATALOGUE) {
  const recorder = new Recorder();
  const reports = compose(recorder, ask, catalogue);
  return { lines: recorder.take(), reports };
}

function withCamera(view: View): Catalogue {
  const camera: SceneFeature<Record<string, never>, unknown> = {
    id: 'camera',
    title: 'camera',
    description: 'camera',
    group: 'core',
    settings: {},
    select: () => ({}),
    evaluate: () => ({ ok: true, value: null }),
    end: () => null,
    refersTo: () => [],
    view: () => view,
  };
  return { route: CATALOGUE.route, scene: [...CATALOGUE.scene, camera] };
}

/** Each arc's centre on screen: its place under the transform the recorder wrote beside it. */
const centres = (lines: readonly string[]) =>
  lines
    .filter((line) => line.startsWith('arc '))
    .map((line) => {
      const words = line.split(' ').map(Number);
      const [x = 0, y = 0] = words.slice(1, 3);
      const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = words.slice(8, 14);
      return { x: a * x + c * y + e, y: b * x + d * y + f };
    });

/** An overlay's maker, handed a plain point id: a selection ring on that point, found through what it is handed. */
const ringOn = (pointId: string): Overlay => (context, _frame, screen) => {
  for (const [, route] of screen.routes) {
    const point = route.shape.points.find((each) => each.id === pointId);
    const at = point === undefined ? null : screen.place(point);
    if (at !== null) selectionRing(context, at, 12 * unitAt(screen.zoom));
  }
};

const VIEWINGS = {
  'neither a camera nor a further zoom': { catalogue: CATALOGUE, viewing: undefined },
  'a camera’s view and a further zoom and pan together': {
    catalogue: withCamera({ centre: { x: 0.55, y: 0.45 }, zoom: 2 }),
    viewing: { zoom: 1.5, panX: 40, panY: -25 },
  },
};

test('a ring an overlay places on a stop lands on screen where the markers’ layer drew that stop’s marker', () => {
  const scene = sceneOf();
  const stop = scene.routes[0]?.points[2]?.id ?? '';
  for (const [name, { catalogue, viewing }] of Object.entries(VIEWINGS)) {
    const plain = draw(request(scene, { viewing }), catalogue);
    const ringed = draw(request(scene, { viewing, overlays: [ringOn(stop)] }), catalogue);
    // Three stops, three markers; the bend has none. The ring's two arcs come after every line of the plain frame.
    const markers = centres(plain.lines).filter((at, i, all) => all.findIndex((other) => other.x === at.x && other.y === at.y) === i);
    expect(markers, name).toHaveLength(3);
    const rings = centres(ringed.lines.slice(plain.lines.length));
    expect(rings, name).toHaveLength(2);
    for (const ring of rings) {
      expect(ring.x, name).toBeCloseTo(markers[1]?.x ?? Number.NaN, 2);
      expect(ring.y, name).toBeCloseTo(markers[1]?.y ?? Number.NaN, 2);
    }
    expect(ringed.lines.slice(plain.lines.length).filter((line) => line.startsWith('arc ')).every((line) => line.endsWith('@ 1 0 0 1 0 0'))).toBe(true);
  }
});

test('an overlay is handed the frame’s one zoom, and each route as the modules saw it; a place not a number is none', () => {
  const scene = sceneOf();
  const seen: RouteInput<unknown>['route'][] = [];
  const capture: RouteFeature<Record<string, never>, unknown> = {
    id: 'capture',
    title: 'capture',
    description: 'capture',
    group: 'core',
    settings: {},
    select: () => ({}),
    evaluate: (input) => (seen.push(input.route), { ok: true, value: null }),
    end: () => null,
    layers: {},
  };
  const screens: Screen[] = [];
  const keep: Overlay = (_context, _frame, screen) => void screens.push(screen);
  const camera = withCamera({ centre: { x: 0.5, y: 0.5 }, zoom: 2 });
  draw(request(scene, { overlays: [keep] }), { route: [capture], scene: [] });
  draw(request(scene, { overlays: [keep], viewing: { zoom: 1.5, panX: 0, panY: 0 } }), { route: [capture], scene: camera.scene });
  expect(screens.map((screen) => screen.zoom)).toEqual([1, 3]);
  const route = scene.routes[0];
  expect(screens[0]?.routes.size).toBe(1);
  expect(screens[0]?.routes.get(route?.id ?? '')).toBe(seen[0]);
  expect(seen[0]?.shape.points).toBe(route?.points);
  const place = screens[0]?.place ?? (() => null);
  // The 400 × 300 picture is drawn 1,440 × 1,080 from x = 240 at 1080p; a point off the picture is still placed.
  expect(place({ x: 0.5, y: 0.5 })).toEqual({ x: 960, y: 540 });
  expect(place({ x: -0.5, y: 1.5 })).toEqual({ x: -480, y: 1620 });
  expect([Number.NaN, Number.POSITIVE_INFINITY].map((x) => place({ x, y: 0.5 }))).toEqual([null, null]);
});

test('the same moment draws the same overlay lines, and an overlay that throws is reported while the next still draws', () => {
  const scene = sceneOf();
  const stop = scene.routes[0]?.points[0]?.id ?? '';
  const ask = request(scene, { viewing: { zoom: 2, panX: 10, panY: 10 }, overlays: [ringOn(stop)] });
  const once = draw(ask);
  expect(draw(ask)).toEqual(once);
  // One that throws inside a save of its own, having changed its alpha, dash and transform.
  const careless: Overlay = (context: DrawContext) => {
    context.save();
    context.globalAlpha = 0.2;
    context.setLineDash([3, 3]);
    context.translate(50, 50);
    throw new Error('the overlay broke');
  };
  const after = draw({ ...ask, overlays: [careless, ringOn(stop)] });
  expect(after.reports).toEqual([{ routeId: null, featureId: 'overlay', reason: 'the overlay broke' }]);
  expect(once.reports).toEqual([]);
  // The ring draws line for line as it does alone: at full opacity, solid but for its own dash, in screen space.
  const frame = draw({ ...ask, overlays: undefined }).lines.length;
  const ring = once.lines.slice(frame);
  expect(ring.filter((line) => line.startsWith('arc '))).toHaveLength(2);
  expect(after.lines.slice(0, frame)).toEqual(once.lines.slice(0, frame));
  expect(after.lines.slice(-ring.length)).toEqual(ring);
  expect(after.lines.slice(frame, -ring.length)).toContain('translate 50 50');
});

test('a frame asked for without overlays holds none: with v3’s four shapes on real stops, it is their frame’s beginning', () => {
  const scene = sceneOf();
  const [first, bend, second, third] = scene.routes[0]?.points ?? [];
  const at = (id: string | undefined, screen: Screen) => {
    const point = scene.routes[0]?.points.find((each) => each.id === id);
    return point === undefined ? null : screen.place(point);
  };
  const shapes: Overlay[] = [
    ringOn(first?.id ?? ''),
    (context, _frame, screen) => {
      const place = at(second?.id, screen);
      if (place !== null) selectionRect(context, { x: place.x - 10, y: place.y - 10, width: 20, height: 20 });
    },
    (context, _frame, screen) => {
      const place = at(third?.id, screen);
      if (place !== null) hoverRing(context, place, 14, unitAt(screen.zoom));
    },
    (context, _frame, screen) => {
      const place = at(bend?.id, screen);
      if (place !== null) plusHandle(context, place, true, unitAt(screen.zoom));
    },
  ];
  for (const [name, { catalogue, viewing }] of Object.entries(VIEWINGS)) {
    const exported = draw(request(scene, { viewing }), catalogue);
    const edited = draw(request(scene, { viewing, overlays: shapes }), catalogue);
    expect(draw(request(scene, { viewing, overlays: [] }), catalogue), name).toEqual(exported);
    expect(edited.lines.slice(0, exported.lines.length), name).toEqual(exported.lines);
    const added = edited.lines.slice(exported.lines.length).filter((line) => /^(arc|stroke|strokeRect|fill|moveTo|lineTo) /.test(line));
    expect(added.filter((line) => line.startsWith('strokeRect')), name).toHaveLength(2);
    expect(added.filter((line) => line.startsWith('arc')), name).toHaveLength(4);
    expect(added.filter((line) => line.startsWith('stroke ')), name).toHaveLength(6);
    for (const line of added) expect(exported.lines, `${name}: ${line}`).not.toContain(line);
    expect(exported.reports, name).toEqual([]);
    expect(edited.reports, name).toEqual([]);
  }
});
