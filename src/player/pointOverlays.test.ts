// CORE-04 stage 6: the editor's overlays that follow a point, through the real catalogue's maker and the composer.
// Every figure is v3's (v3/src/services/RenderingService.js at the lines named), read at a zoom of 1, where v3's clamp
// factor is 1; at other zooms v3's gaps and widths go by unitAt (D153) and a ring follows its marker as drawn. The
// lead's head is v3's default arrow (D143), drawn with no arc, so every arc in a frame before the overlays is a marker's.
import { expect, test } from 'vitest';
import { unitAt } from '../adapters/render/overlays';
import { Recorder } from '../adapters/render/recorder';
import type { View } from '../core/feature/contract';
import { newLine, newPoint, newRoute, newScene, type Route, type Scene } from '../core/model/scene';
import { CATALOGUE, type Catalogue, type SceneFeature } from '../features/catalogue';
import { OVERLAY_MAKERS } from '../features/catalogue.editor';
import { compose, type FrameRequest } from './compose';

type Choices = Parameters<typeof OVERLAY_MAKERS.points>[1];
type LookFor = NonNullable<Parameters<typeof OVERLAY_MAKERS.points>[2]>;
type Appearance = Route['settings']['markers']['appearance'];

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

/** A stop, a bend, two stops, walked in 10 s. */
const PLACES = [
  { x: 0.25, y: 0.5, kind: 'stop' },
  { x: 0.4, y: 0.3, kind: 'bend' },
  { x: 0.6, y: 0.55, kind: 'stop' },
  { x: 0.8, y: 0.4, kind: 'stop' },
] as const;

function routeOf(nextId: () => string, appearance: Appearance, shift = 0): Route {
  const points = PLACES.map((place) => newPoint(nextId, { ...place, y: place.y + shift }));
  const ids = points.map((point) => point.id);
  const plain = newRoute(nextId);
  return {
    ...plain,
    points,
    leadStart: ids[0] ?? '',
    lines: ids.slice(1).map((to, i) => newLine(nextId, ids[i] ?? '', to)),
    settings: {
      ...plain.settings,
      lead: { ...plain.settings.lead, timing: 'total time', totalTimeMs: 10_000, startsAtMs: 0 },
      markers: { ...plain.settings.markers, appearance },
    },
  };
}

function sceneOf(appearance: Appearance = 'always', routes = 1): Scene {
  const nextId = counter();
  const scene = newScene(nextId);
  return { ...scene, routes: Array.from({ length: routes }, (_, i) => routeOf(nextId, appearance, i * 0.1)) };
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

/** Each arc on screen: its centre and radius under the transform the recorder wrote beside it (no turn here). */
const circles = (lines: readonly string[]) =>
  lines
    .filter((line) => line.startsWith('arc '))
    .map((line) => {
      const words = line.split(' ').map(Number);
      const [x = 0, y = 0, r = 0] = words.slice(1, 4);
      const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = words.slice(8, 14);
      return { x: a * x + c * y + e, y: b * x + d * y + f, r: r * Math.hypot(a, b) };
    });

/** The numbers of each strokeRect line, and the width of each stroke (1, the canvas's default, is not written). */
const rects = (lines: readonly string[]) =>
  lines.filter((line) => line.startsWith('strokeRect ')).map((line) => line.split(' ').slice(1, 5).map(Number));
const widths = (lines: readonly string[]) =>
  lines.filter((line) => /^stroke(Rect)? /.test(line)).map((line) => Number(/lineWidth=([\d.]+)/.exec(line)?.[1] ?? 1));

/** Zooms on screen: 1; 3 (a camera and a further zoom); under 1; past 3, where v3's figures were held; a pan not finite. */
const VIEWINGS = {
  'a zoom of 1': { catalogue: CATALOGUE, viewing: undefined, zoom: 1 },
  'a camera of 2 under a further 1.5, panned': {
    catalogue: withCamera({ centre: { x: 0.55, y: 0.45 }, zoom: 2 }),
    viewing: { zoom: 1.5, panX: 40, panY: -25 },
    zoom: 3,
  },
  'a further zoom of 0.5': { catalogue: CATALOGUE, viewing: { zoom: 0.5, panX: 10, panY: 5 }, zoom: 0.5 },
  'a camera of 2 under a further 2.5': {
    catalogue: withCamera({ centre: { x: 0.5, y: 0.5 }, zoom: 2 }),
    viewing: { zoom: 2.5, panX: 0, panY: 0 },
    zoom: 5,
  },
  'a further zoom whose pan is not a number': { catalogue: CATALOGUE, viewing: { zoom: 2, panX: Number.NaN, panY: 0 }, zoom: 1 },
};

const refOf = (route: Route | undefined, point: Route['points'][number] | undefined) => ({ routeId: route?.id ?? '', pointId: point?.id ?? '' });

/** Each figure as expected, to two places. */
function near(actual: readonly (number | undefined)[], expected: readonly number[], name: string): void {
  expect(actual, name).toHaveLength(expected.length);
  for (const [i, value] of expected.entries()) expect(actual[i], name).toBeCloseTo(value, 2);
}

/** An overlay's lines without the bends' grey dots (each drawn at alpha 0.5): what a selection alone adds. */
const undotted = (lines: readonly string[]) =>
  lines.filter((line, i) => !/globalAlpha=0\.5/.test(line) && !(line.startsWith('arc ') && /globalAlpha=0\.5/.test(lines[i + 1] ?? '')));

/** The frame without overlays, then with the maker's overlay: the overlay's lines are what follows the first. */
function both(scene: Scene, choices: Choices, viewing: (typeof VIEWINGS)[keyof typeof VIEWINGS], lookFor?: LookFor) {
  const plain = draw(request(scene, { viewing: viewing.viewing }), viewing.catalogue);
  const overlay = OVERLAY_MAKERS.points(scene.routes.map((route) => route.id), choices, lookFor);
  const edited = draw(request(scene, { viewing: viewing.viewing, overlays: [overlay] }), viewing.catalogue);
  expect(edited.lines.slice(0, plain.lines.length)).toEqual(plain.lines);
  expect(edited.reports).toEqual([]);
  const all = edited.lines.slice(plain.lines.length);
  return { plain, all, added: undotted(all) };
}

test('a selected stop is ringed round its marker as v3’s: its half-width + 4, 3 wide (:2484–2486), at every zoom', () => {
  const scene = sceneOf();
  const route = scene.routes[0];
  for (const [name, viewing] of Object.entries(VIEWINGS)) {
    const unit = unitAt(viewing.zoom);
    const { plain, added } = both(scene, { selected: [refOf(route, route?.points[2])] }, viewing);
    // Three stops, three markers; the second stop's is the middle one. At a zoom of 1 the marker is 8 across.
    const markers = circles(plain.lines).filter((at, i, all) => all.findIndex((other) => other.x === at.x && other.y === at.y) === i);
    expect(markers, name).toHaveLength(3);
    const marker = markers[1] ?? { x: Number.NaN, y: Number.NaN, r: Number.NaN };
    if (viewing.zoom === 1) expect(marker.r, name).toBeCloseTo(8, 3);
    const rings = circles(added);
    expect(rings, name).toHaveLength(2);
    for (const ring of rings) {
      expect(ring.x, name).toBeCloseTo(marker.x, 2);
      expect(ring.y, name).toBeCloseTo(marker.y, 2);
      expect(ring.r, name).toBeCloseTo(marker.r + 4 * unit, 2);
    }
    expect(widths(added), name).toEqual([3 * unit, 3 * unit]);
  }
});

test('a picture and a square are boxed as v3’s: the marker’s box and a gap of 2 each side, 3 wide (:2442–2456)', () => {
  const scene = sceneOf();
  const route = scene.routes[0];
  const choices = { selected: [refOf(route, route?.points[0]), refOf(route, route?.points[3])] };
  const lookOf = (style: ReturnType<LookFor>['style'], extra: Partial<ReturnType<LookFor>> = {}): LookFor => () => ({
    style, colour: '#d55e00', size: 8, image: null, rotation: 'fixed', offsetDegrees: 0, ...extra,
  });
  const pin = { image: 'pin' };
  for (const name of ['a zoom of 1', 'a camera of 2 under a further 2.5'] as const) {
    const viewing = VIEWINGS[name];
    const unit = unitAt(viewing.zoom);
    const stops = circles(both(scene, choices, viewing).added).filter((_, i) => i % 2 === 0);
    const half = 8 * viewing.zoom;
    const box = (at: { x: number; y: number }) => [at.x - half - 2 * unit, at.y - half - 2 * unit, 2 * (half + 2 * unit), 2 * (half + 2 * unit)];
    const images = new Map([['pin', source]]);
    for (const [look, withImages] of [[lookOf('square'), false], [lookOf('custom', pin), true]] as const) {
      const plain = draw(request(scene, { viewing: viewing.viewing, images: withImages ? images : undefined }), viewing.catalogue);
      const overlay = OVERLAY_MAKERS.points(scene.routes.map((route) => route.id), choices, look);
      const edited = draw(request(scene, { viewing: viewing.viewing, images: withImages ? images : undefined, overlays: [overlay] }), viewing.catalogue);
      const added = undotted(edited.lines.slice(plain.lines.length));
      expect(circles(added), name).toEqual([]);
      const drawn = rects(added);
      expect(drawn, name).toHaveLength(4);
      for (const [i, at] of stops.entries()) {
        for (const [j, figure] of box(at).entries()) expect(drawn[2 * i]?.[j], name).toBeCloseTo(figure, 2);
      }
      expect(widths(added), name).toEqual([3, 3, 3, 3].map((width) => width * unit));
    }
    // Every other look is ringed: a flag, a dot, a custom marker whose picture is not handed in (drawn as a dot), and
    // a look v3 drew nothing for, `none` or a clear colour (v3 drew no selection there, :2386–2400; v4's is never invisible).
    for (const look of [lookOf('flag'), lookOf('dot'), lookOf('custom', pin), lookOf('none'), lookOf('dot', { colour: 'transparent' })]) {
      const { added } = both(scene, choices, viewing, look);
      expect(rects(added), name).toEqual([]);
      expect(circles(added).map((ring) => ring.r), name).toEqual([1, 2, 3, 4].map(() => half + 4 * unit));
    }
  }
});

test('a stop whose marker is not shown at that moment is still ringed, at its marker’s whole size', () => {
  // Where the last stop's marker stands when it is shown, whole: 8 across at a zoom of 1.
  const shown = circles(draw(request(sceneOf('always'))).lines);
  const last = shown[shown.length - 1] ?? { x: Number.NaN, y: Number.NaN, r: Number.NaN };
  expect(last.r).toBeCloseTo(8, 3);
  for (const appearance of ['from arrival', 'never'] as const) {
    const scene = sceneOf(appearance);
    const route = scene.routes[0];
    // At 1 s the lead has reached no stop but the first: under `from arrival` the last stop has no marker yet.
    const ask = request(scene, { sceneMs: 1_000 });
    const plain = draw(ask);
    expect(circles(plain.lines).some((at) => Math.abs(at.x - last.x) < 1e-6), appearance).toBe(false);
    const edited = draw({ ...ask, overlays: [OVERLAY_MAKERS.points(scene.routes.map((route) => route.id), { selected: [refOf(route, route?.points[3])] })] });
    const rings = circles(undotted(edited.lines.slice(plain.lines.length)));
    expect(rings, appearance).toHaveLength(2);
    for (const ring of rings) {
      near([ring.x, ring.y], [last.x, last.y], appearance);
      expect(ring.r, appearance).toBeCloseTo(last.r + 4, 3);
    }
  }
});

test('ids that match nothing draw nothing and throw nothing, and many selected draw each point once', () => {
  const scene = sceneOf('always', 2);
  const [first, second] = scene.routes;
  const stop = first?.points[2];
  const viewing = VIEWINGS['a zoom of 1'];
  const nothing: Choices = {
    selected: [
      { routeId: 'no such route', pointId: stop?.id ?? '' },
      refOf(first, undefined),
      { routeId: first?.id ?? '', pointId: 'no such point' },
      // Another route's point, under this route's id.
      { routeId: first?.id ?? '', pointId: second?.points[2]?.id ?? '' },
    ],
  };
  expect(both(scene, nothing, viewing).added.filter((line) => /^(arc|stroke)/.test(line))).toEqual([]);
  // A route the maker is handed that the frame does not draw: nothing, though its point is chosen.
  const alone = { ...scene, routes: [first].filter((route) => route !== undefined) };
  const plain = draw(request(alone));
  const elsewhere = OVERLAY_MAKERS.points(second === undefined ? [] : [second.id], { selected: [refOf(second, second?.points[2])] });
  const edited = draw(request(alone, { overlays: [elsewhere] }));
  expect(edited.reports).toEqual([]);
  expect(edited.lines.slice(0, plain.lines.length)).toEqual(plain.lines);
  expect(edited.lines.slice(plain.lines.length)).toEqual(['save', 'beginPath', 'beginPath', 'restore']);
  // The same stop chosen ten thousand times, beside ten thousand ids of nothing, is ringed once; the same moment, the same lines.
  const repeated = Array.from({ length: 10_000 }, () => refOf(first, stop));
  const missing = Array.from({ length: 10_000 }, (_, i) => ({ routeId: first?.id ?? '', pointId: `none${i}` }));
  const many: Choices = { selected: [...repeated, ...missing] };
  const once = both(scene, { selected: [refOf(first, stop)] }, viewing).added;
  expect(both(scene, many, viewing).added).toEqual(once);
  expect(both(scene, many, viewing).added).toEqual(once);
  expect(circles(once)).toHaveLength(2);
});

/** Where an image point of the first route lies on screen, from its first and last stops' markers (each axis is linear). */
function placeBy(markers: readonly { x: number; y: number }[], point: { x: number; y: number }) {
  const [from, to] = [PLACES[0], PLACES[3]];
  const [a = { x: 0, y: 0 }, b = { x: 0, y: 0 }] = [markers[0], markers[markers.length - 1]];
  return { x: a.x + ((point.x - from.x) * (b.x - a.x)) / (to.x - from.x), y: a.y + ((point.y - from.y) * (b.y - a.y)) / (to.y - from.y) };
}

test('every bend of the routes handed in has v3’s grey dot, radius 4 and edge 1 (:2497–2509); selected, a ring + 3, 2 wide', () => {
  const scene = sceneOf('always', 2);
  const [first, second] = scene.routes;
  const bend = first?.points[1];
  for (const [name, viewing] of Object.entries(VIEWINGS)) {
    const unit = unitAt(viewing.zoom);
    const { plain, all: added } = both(scene, { selected: [] }, viewing);
    const at = placeBy(circles(plain.lines).slice(0, 3), bend ?? { x: Number.NaN, y: Number.NaN });
    // One bend a route, two routes: two dots, each at alpha 0.5, the first on the first route's bend.
    const dots = circles(added);
    expect(dots, name).toHaveLength(2);
    near([dots[0]?.x, dots[0]?.y], [at.x, at.y], name);
    for (const dot of dots) expect(dot.r, name).toBeCloseTo(4 * unit, 3);
    expect(widths(added), name).toEqual([unit, unit]);
    expect(added.filter((line) => /^(fill|stroke) .*globalAlpha=0\.5/.test(line)), name).toHaveLength(4);
    // Selected: its dot, then v3's ring at the dot's size + 3, 2 wide, at full alpha.
    const chosen = both(scene, { selected: [refOf(first, bend)] }, viewing).all;
    const rings = circles(chosen).slice(1, 3);
    expect(rings, name).toHaveLength(2);
    for (const ring of rings) near([ring.x, ring.y, ring.r], [at.x, at.y, 7 * unit], name);
    expect(widths(chosen), name).toEqual([unit, 2 * unit, 2 * unit, unit]);
  }
  // Only the routes handed in: one route, one dot.
  const one = draw(request(scene, { overlays: [OVERLAY_MAKERS.points(second === undefined ? [] : [second.id], { selected: [] })] }));
  expect(circles(one.lines).filter((at) => Math.abs(at.r - 4) < 1e-9)).toHaveLength(1);
});

test('the hover ring is v3’s on a stop or a bend, at its size + 6 (:358–383), and none on a selected point (:375)', () => {
  const scene = sceneOf();
  const route = scene.routes[0];
  const [, bend, stop] = route?.points ?? [];
  for (const [name, viewing] of Object.entries(VIEWINGS)) {
    const unit = unitAt(viewing.zoom);
    const marker = circles(both(scene, { selected: [] }, viewing).plain.lines)[1] ?? { x: 0, y: 0, r: 0 };
    const onStop = both(scene, { selected: [], hovered: refOf(route, stop) }, viewing).all;
    // The bend's dot, then the hover ring last: white 4u under the accent 2u, round the marker.
    const hover = circles(onStop).slice(1);
    expect(hover, name).toHaveLength(1);
    near([hover[0]?.x, hover[0]?.y, hover[0]?.r], [marker.x, marker.y, marker.r + 6 * unit], name);
    expect(widths(onStop), name).toEqual([unit, 4 * unit, 2 * unit]);
    expect(onStop.filter((line) => line.includes('#0f62fe')), name).toHaveLength(1);
    const onBend = both(scene, { selected: [], hovered: refOf(route, bend) }, viewing).all;
    near(circles(onBend).map((ring) => ring.r), [4 * unit, 10 * unit], name);
    // Selected and hovered at once, a stop or a bend: the selection alone, as v3's.
    for (const point of [stop, bend]) {
      const selected = { selected: [refOf(route, point)] };
      const both_ = both(scene, { ...selected, hovered: refOf(route, point) }, viewing).all;
      expect(both_, name).toEqual(both(scene, selected, viewing).all);
      expect(both_.filter((line) => line.includes('#0f62fe')), name).toEqual([]);
    }
    // Under the pointer, nothing that is a point of this route: the dot alone.
    for (const hovered of [{ routeId: route?.id ?? '', pointId: 'no such point' }, { routeId: 'no such route', pointId: stop?.id ?? '' }]) {
      expect(both(scene, { selected: [], hovered }, viewing).all, name).toEqual(both(scene, { selected: [] }, viewing).all);
    }
  }
});

test('a frame asked for without overlays holds none: with every point overlay, it is their frame’s beginning', () => {
  const scene = sceneOf('from arrival', 2);
  const [first, second] = scene.routes;
  const choices: Choices = {
    selected: [refOf(first, first?.points[0]), refOf(first, first?.points[1]), refOf(second, second?.points[3])],
    hovered: refOf(second, second?.points[2]),
  };
  const looks: LookFor[] = [
    () => ({ style: 'dot', colour: '#000', size: 8, image: null, rotation: 'fixed', offsetDegrees: 0 }),
    () => ({ style: 'square', colour: '#000', size: 8, image: null, rotation: 'fixed', offsetDegrees: 0 }),
  ];
  for (const [name, { catalogue, viewing }] of Object.entries(VIEWINGS)) {
    for (const lookFor of looks) {
      const exported = draw(request(scene, { viewing }), catalogue);
      const edited = draw(request(scene, { viewing, overlays: [OVERLAY_MAKERS.points(scene.routes.map((route) => route.id), choices, lookFor)] }), catalogue);
      expect(draw(request(scene, { viewing, overlays: [] }), catalogue), name).toEqual(exported);
      expect(edited.lines.slice(0, exported.lines.length), name).toEqual(exported.lines);
      expect(edited.reports, name).toEqual([]);
      // No grey dot, ring, rectangle or hover in the frame an export draws; every drawing line the overlay adds is new.
      expect(exported.lines.filter((line) => /globalAlpha=0\.5|lineDash=|#0f62fe|^strokeRect/.test(line)), name).toEqual([]);
      const added = edited.lines.slice(exported.lines.length).filter((line) => /^(arc|stroke|strokeRect|fill) /.test(line));
      expect(added.length, name).toBeGreaterThan(10);
      for (const line of added) expect(exported.lines, `${name}: ${line}`).not.toContain(line);
      // Drawn twice at the same moment, the same lines.
      expect(draw(request(scene, { viewing, overlays: [OVERLAY_MAKERS.points(scene.routes.map((route) => route.id), choices, lookFor)] }), catalogue), name).toEqual(edited);
    }
  }
  // The composer's own lists hold no maker: only the editor's list of overlays reaches one.
  expect(Object.keys(CATALOGUE)).toEqual(['route', 'scene']);
  const layers = [...CATALOGUE.route, ...CATALOGUE.scene].flatMap((module) => Object.values(module.layers ?? {}));
  expect(layers).not.toContain(OVERLAY_MAKERS.points);
});

// CORE-06, D274 part 1 (brief 142, GC): the guide's dots draw, after a route's dots, v3's glyph on each point the author
// marked (NetworkEditService.js:1236–1259): a start's triangle, an end's square, v3's radius 7 and edge 1.5 (:940) in
// screen pixels by unitAt(zoom), as the guide dot is sized, whatever the frame's size, so a mark is always larger than
// its dot; in the route's colour edged white. Never a worked-out first point.

type Mark = Route['marks'][number];

function marked(scene: Scene, marks: readonly (readonly Mark[])[]): Scene {
  return { ...scene, routes: scene.routes.map((route, i) => ({ ...route, marks: [...(marks[i] ?? [])] })) };
}

/** The frame without overlays, then with the guide's dots of every route: the overlay's lines alone. */
function dotted(scene: Scene, viewing: (typeof VIEWINGS)[keyof typeof VIEWINGS], size = { width: 1920, height: 1080 }) {
  const plain = draw(request(scene, { viewing: viewing.viewing, size }), viewing.catalogue);
  const overlay = OVERLAY_MAKERS.guideDots(scene.routes.map((route) => route.id));
  const edited = draw(request(scene, { viewing: viewing.viewing, size, overlays: [overlay] }), viewing.catalogue);
  expect(edited.lines.slice(0, plain.lines.length)).toEqual(plain.lines);
  expect(edited.reports).toEqual([]);
  return edited.lines.slice(plain.lines.length);
}

/** Each moveTo, lineTo or rect on screen, by its kind and its figures under the transform written beside it. */
const pathsOf = (lines: readonly string[]) =>
  lines
    .filter((line) => /^(moveTo|lineTo|rect) /.test(line))
    .map((line) => {
      const [kind = '', ...rest] = line.split(' ');
      const at = rest.indexOf('@');
      const figures = rest.slice(0, at).map(Number);
      const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = rest.slice(at + 1, at + 7).map(Number);
      const [x = 0, y = 0, w = 0, h = 0] = figures;
      const scale = Math.hypot(a, b);
      return { kind, x: a * x + c * y + e, y: b * x + d * y + f, w: w * scale, h: h * scale };
    });

/** Each fill's and stroke's styles as written. */
const paints = (lines: readonly string[]) => lines.filter((line) => /^(fill|stroke) /.test(line)).map((line) => line.split(' | ')[2] ?? '');

test('a marked start draws v3’s triangle and a marked end its square at the point, after the route’s dots, in its colour edged white; an unmarked point only its dot (D274)', () => {
  const scene = sceneOf();
  const route = scene.routes[0];
  const [first, , , last] = route?.points ?? [];
  const colour = route?.settings.line.colour ?? '';
  const withMarks = marked(scene, [[{ point: last?.id ?? '', end: 'end' }, { point: first?.id ?? '', end: 'start' }]]);
  const sizes = { 'a frame of 1080': { width: 1920, height: 1080 }, 'a frame of 540': { width: 1920, height: 540 } };
  for (const [name, viewing] of Object.entries(VIEWINGS)) {
    for (const [sized, size] of Object.entries(sizes)) {
      const label = `${name}, ${sized}`;
      const unit = unitAt(viewing.zoom);
      const r = 7 * unit;
      const lines = dotted(withMarks, viewing, size);
      // Four dots first, one for each point, marked or not; then the two marks and nothing else.
      const dots = circles(lines);
      expect(dots, label).toHaveLength(4);
      const lastDot = lines.reduce((at, line, i) => (line.startsWith('arc ') ? i : at), -1);
      expect(lines.slice(0, lastDot).some((line) => /^(moveTo|lineTo|rect) /.test(line)), label).toBe(false);
      const [start = { x: 0, y: 0 }, , , end = { x: 0, y: 0 }] = dots;
      const paths = pathsOf(lines);
      // The square first (every end before every start), then the triangle, apex up.
      expect(paths.map((path) => path.kind), label).toEqual(['rect', 'moveTo', 'lineTo', 'lineTo']);
      const [square, apex, right, left] = paths;
      near([square?.x, square?.y, square?.w, square?.h], [end.x - 0.8 * r, end.y - 0.8 * r, 1.6 * r, 1.6 * r], label);
      near([apex?.x, apex?.y], [start.x, start.y - r], label);
      near([right?.x, right?.y], [start.x + 0.87 * r, start.y + 0.5 * r], label);
      near([left?.x, left?.y], [start.x - 0.87 * r, start.y + 0.5 * r], label);
      expect(lines.filter((line) => line.startsWith('closePath')), label).toHaveLength(1);
      // Each dot a fill in the route's colour; each mark a fill in it, then a white stroke 1.5 × unit wide.
      const marks = paints(lines).slice(4);
      expect(marks.map((paint) => paint.replace(/ lineWidth=[\d.]+/, '')), label).toEqual([
        `fillStyle=${colour}`,
        'strokeStyle=#ffffff',
        `fillStyle=${colour}`,
        'strokeStyle=#ffffff',
      ]);
      expect(widths(lines), label).toHaveLength(2);
      for (const width of widths(lines)) expect(width, label).toBeCloseTo(1.5 * unit, 2);
    }
  }
});

test('a route with no marks draws its dots exactly as before; a mark whose point the frame does not hold draws nothing (D274)', () => {
  const scene = sceneOf('always', 2);
  const viewing = VIEWINGS['a zoom of 1'];
  const before = dotted(scene, viewing);
  expect(before.filter((line) => !/^(save|beginPath|restore|arc |fill )/.test(line))).toEqual([]);
  expect(circles(before)).toHaveLength(8);
  // Marks on the first route only: the second route's lines, and the first's dots, are unchanged.
  const [first] = scene.routes;
  const withMarks = marked(scene, [[{ point: first?.points[2]?.id ?? '', end: 'start' }]]);
  const after = dotted(withMarks, viewing);
  const added = after.length - before.length;
  expect(added).toBeGreaterThan(0);
  const firstEnds = before.findIndex((line, i) => i > 0 && line === 'save' && circles(before.slice(0, i)).length === 4);
  expect(after.slice(0, firstEnds)).toEqual(before.slice(0, firstEnds));
  expect(after.slice(firstEnds + added)).toEqual(before.slice(firstEnds));
  // The mark sits between the first route's dots and the second's.
  expect(pathsOf(after.slice(firstEnds, firstEnds + added)).map((path) => path.kind)).toEqual(['moveTo', 'lineTo', 'lineTo']);
  // A mark naming a point the route does not hold: nothing beyond the dots.
  expect(dotted(marked(scene, [[{ point: 'not-a-point', end: 'end' }]]), viewing)).toEqual(before);
});

test('a point marked both as a start and an end draws the square, then the triangle over it (D274)', () => {
  const scene = sceneOf();
  const point = scene.routes[0]?.points[2];
  const both = marked(scene, [[{ point: point?.id ?? '', end: 'start' }, { point: point?.id ?? '', end: 'end' }]]);
  const lines = dotted(both, VIEWINGS['a zoom of 1']);
  const at = circles(lines)[2] ?? { x: 0, y: 0 };
  const paths = pathsOf(lines);
  expect(paths.map((path) => path.kind)).toEqual(['rect', 'moveTo', 'lineTo', 'lineTo']);
  near([paths[0]?.x, paths[0]?.y], [at.x - 5.6, at.y - 5.6], 'square');
  near([paths[1]?.x, paths[1]?.y], [at.x, at.y - 7], 'apex');
});
