// CORE-04 stage 6: the editor's overlays that follow a line, through the editor's catalogue and the composer. A hidden
// line's faint guide has no v3 figure (v3's editor showed every line, so there is none to port): its look is v4's
// (D157), checked here as src/features/line/draw/overlays.ts states it. Where it runs is checked against the line
// itself, drawn whole by the line's own layer in the same frame, so the guide is on screen where the line would be.
import { expect, test } from 'vitest';
import { unitAt } from '../adapters/render/overlays';
import { Recorder } from '../adapters/render/recorder';
import type { View } from '../core/feature/contract';
import { newLine, newPoint, newRoute, newScene, type Route, type Scene } from '../core/model/scene';
import { CATALOGUE, type Catalogue, type SceneFeature } from '../features/catalogue';
import { OVERLAY_MAKERS } from '../features/catalogue.editor';
import { compose, type FrameRequest } from './compose';

type Appearance = Route['settings']['line']['appearance'];

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

/** A stop, a bend, two stops; a branching route has a fifth point, joined to the third. */
const PLACES = [
  { x: 0.25, y: 0.5, kind: 'stop' },
  { x: 0.4, y: 0.3, kind: 'bend' },
  { x: 0.6, y: 0.55, kind: 'stop' },
  { x: 0.8, y: 0.4, kind: 'stop' },
  { x: 0.7, y: 0.8, kind: 'stop' },
] as const;

function routeOf(nextId: () => string, appearance: Appearance, { shift = 0, count = 4, branch = false } = {}): Route {
  const points = PLACES.slice(0, branch ? 5 : count).map((place) => newPoint(nextId, { ...place, y: place.y + shift }));
  const ids = points.map((point) => point.id);
  const plain = newRoute(nextId);
  const lines = ids.slice(1, Math.min(ids.length, 4)).map((to, i) => newLine(nextId, ids[i] ?? '', to));
  if (branch) lines.push(newLine(nextId, ids[2] ?? '', ids[4] ?? ''));
  return {
    ...plain,
    points,
    leadStart: ids[0] ?? '',
    lines,
    settings: {
      ...plain.settings,
      lead: { ...plain.settings.lead, timing: 'total time', totalTimeMs: 10_000, startsAtMs: 0 },
      line: { ...plain.settings.line, appearance },
    },
  };
}

function sceneOf(appearances: readonly Appearance[], shape: { count?: number; branch?: boolean } = {}): Scene {
  const nextId = counter();
  const scene = newScene(nextId);
  return { ...scene, routes: appearances.map((appearance, i) => routeOf(nextId, appearance, { ...shape, shift: i * 0.1 })) };
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

/** The line alone of the route modules, so every path in a frame is the line's or the guide's. */
function lineOnly(view?: View): Catalogue {
  const scene: SceneFeature<Record<string, never>, unknown>[] = view
    ? [{ id: 'camera', title: 'camera', description: 'camera', group: 'core', settings: {}, select: () => ({}),
        evaluate: () => ({ ok: true, value: null }), end: () => null, refersTo: () => [], view: () => view }]
    : [];
  return { route: CATALOGUE.route.slice(0, 1), scene: [...CATALOGUE.scene, ...scene] };
}

/** Zooms on screen: 1; 3 (a camera and a further zoom, panned); under 1; past 3; a pan not finite (drawn unmoved). */
const VIEWINGS = {
  'a zoom of 1': { catalogue: lineOnly(), viewing: undefined, zoom: 1 },
  'a camera of 2 under a further 1.5, panned': { catalogue: lineOnly({ centre: { x: 0.55, y: 0.45 }, zoom: 2 }), viewing: { zoom: 1.5, panX: 40, panY: -25 }, zoom: 3 },
  'a further zoom of 0.5': { catalogue: lineOnly(), viewing: { zoom: 0.5, panX: 10, panY: 5 }, zoom: 0.5 },
  'a camera of 2 under a further 2.5': { catalogue: lineOnly({ centre: { x: 0.5, y: 0.5 }, zoom: 2 }), viewing: { zoom: 2.5, panX: 0, panY: 0 }, zoom: 5 },
  'a further zoom whose pan is not a number': { catalogue: lineOnly(), viewing: { zoom: 2, panX: Number.NaN, panY: 0 }, zoom: 1 },
};

/** Every place a path goes through, on screen (under the transform the recorder wrote beside it). */
const places = (lines: readonly string[]) =>
  lines
    .filter((line) => /^(moveTo|lineTo) /.test(line))
    .map((line) => {
      const words = line.split(' ');
      const [x = 0, y = 0] = words.slice(1, 3).map(Number);
      const at = words.indexOf('@');
      const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = at < 0 ? [] : words.slice(at + 1, at + 7).map(Number);
      return { x: a * x + c * y + e, y: b * x + d * y + f };
    });

/** Each place of one course lies within 0.1 px of a place of the other, both ways (the recorder rounds before a zoom). */
function sameCourse(guide: readonly { x: number; y: number }[], line: readonly { x: number; y: number }[], name: string): void {
  const near = (from: typeof guide, to: typeof guide) =>
    from.filter(({ x, y }) => !to.some((other) => Math.hypot(other.x - x, other.y - y) <= 0.1));
  expect(near(guide, line), name).toEqual([]);
  expect(near(line, guide), name).toEqual([]);
}
const strokes = (lines: readonly string[]) => lines.filter((line) => line.startsWith('stroke '));

/** The frame without overlays, then with the lines' overlay for the routes handed: the overlay's lines follow the first. */
function both(scene: Scene, viewing: (typeof VIEWINGS)[keyof typeof VIEWINGS], routes: readonly Route[] = scene.routes) {
  const routeIds = routes.map((route) => route.id);
  const plain = draw(request(scene, { viewing: viewing.viewing }), viewing.catalogue);
  const edited = draw(request(scene, { viewing: viewing.viewing, overlays: [OVERLAY_MAKERS.lines(routeIds)] }), viewing.catalogue);
  expect(edited.lines.slice(0, plain.lines.length)).toEqual(plain.lines);
  expect(edited.reports).toEqual([]);
  return { plain, added: edited.lines.slice(plain.lines.length) };
}

test('a hidden line’s guide runs on screen where the line would run, thin, dashed and half see-through, at each zoom', () => {
  for (const [name, viewing] of Object.entries(VIEWINGS)) {
    for (const shape of [{}, { branch: true }]) {
      const hidden = sceneOf(['hidden'], shape);
      const shown = { ...hidden, routes: hidden.routes.map((route) => ({ ...route, settings: { ...route.settings, line: { ...route.settings.line, appearance: 'whole' as const } } })) };
      const { plain, added } = both(hidden, viewing);
      expect(strokes(plain.lines), name).toEqual([]);
      const whole = draw(request(shown, { viewing: viewing.viewing }), viewing.catalogue).lines;
      sameCourse(places(added), places(whole), name);
      expect(places(added).length, name).toBeGreaterThan(20);
      // One stroke for the route, in its colour, by unitAt (D153; D157): 2 wide, dashed 6 on and 4 off, at half alpha.
      const unit = unitAt(viewing.zoom);
      const [stroke, ...more] = strokes(added);
      expect(more, name).toEqual([]);
      expect(Number(/lineWidth=([\d.]+)/.exec(stroke ?? '')?.[1] ?? 1), name).toBe(2 * unit); // 1, the default, is not written
      expect(stroke, name).toContain(`lineDash=${6 * unit},${4 * unit}`);
      expect(stroke, name).toContain('globalAlpha=0.5');
      expect(stroke, name).toContain(hidden.routes[0]?.settings.line.colour ?? 'none');
    }
  }
});

test('no guide for a line that shows, a route not handed, ids that match nothing, or a route of one point', () => {
  const viewing = VIEWINGS['a zoom of 1'];
  for (const appearance of ['whole', 'grows', 'shrinks', 'trail'] as const) {
    expect(strokes(both(sceneOf([appearance]), viewing).added), appearance).toEqual([]);
  }
  // Two routes, the second hidden: a guide for it alone, and none when only the first is handed.
  const two = sceneOf(['whole', 'hidden']);
  const [first, second] = two.routes;
  expect(strokes(both(two, viewing).added)).toHaveLength(1);
  expect(strokes(both(two, viewing, first ? [first] : []).added)).toEqual([]);
  // A hidden route the frame does not hold (another scene's ids), or none handed: nothing.
  expect(both(two, viewing, sceneOf(['hidden', 'hidden']).routes.map((route) => ({ ...route, id: `${route.id}-elsewhere` }))).added.filter((line) => /^(moveTo|lineTo|stroke) /.test(line))).toEqual([]);
  expect(strokes(both(two, viewing, []).added)).toEqual([]);
  expect(second?.settings.line.appearance).toBe('hidden');
  // A hidden route of one point has no line, so no guide.
  expect(strokes(both(sceneOf(['hidden'], { count: 1 }), viewing).added)).toEqual([]);
});

test('a frame asked for without overlays holds no guide; with it, that frame is its beginning; the same moment, the same lines', () => {
  const scene = sceneOf(['hidden', 'whole'], { branch: true });
  for (const [name, { viewing }] of Object.entries(VIEWINGS)) {
    const exported = draw(request(scene, { viewing }));
    const routeIds = scene.routes.map((route) => route.id);
    const overlays = [OVERLAY_MAKERS.lines(routeIds), OVERLAY_MAKERS.points(routeIds, { selected: [] })];
    const edited = draw(request(scene, { viewing, overlays }));
    expect(draw(request(scene, { viewing, overlays: [] })), name).toEqual(exported);
    expect(edited.lines.slice(0, exported.lines.length), name).toEqual(exported.lines);
    expect(edited.reports, name).toEqual([]);
    // No half see-through dashed stroke in the frame an export draws; the guide's is new.
    expect(strokes(exported.lines).filter((line) => /globalAlpha=0\.5/.test(line) && /lineDash=/.test(line)), name).toEqual([]);
    expect(strokes(edited.lines.slice(exported.lines.length)).filter((line) => /lineDash=/.test(line)), name).toHaveLength(1);
    expect(draw(request(scene, { viewing, overlays })), name).toEqual(edited);
  }
});
