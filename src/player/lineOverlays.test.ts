// CORE-04 stage 6: the editor's overlays that follow a line, through the editor's catalogue and the composer. A hidden
// line's faint guide has no v3 figure (v3's editor showed every line, so there is none to port): its look is v4's
// (D157), checked here as src/features/line/draw/overlays.ts states it. Where it runs is checked against the line
// itself, drawn whole by the line's own layer in the same frame, so the guide is on screen where the line would be.
import { expect, test } from 'vitest';
import { unitAt, type Overlay, type Screen } from '../adapters/render/overlays';
import { Recorder } from '../adapters/render/recorder';
import type { View } from '../core/feature/contract';
import { newLine, newPoint, newRoute, newScene, type Route, type Scene } from '../core/model/scene';
import { CATALOGUE, type Catalogue, type SceneFeature } from '../features/catalogue';
import { OVERLAY_MAKERS } from '../features/catalogue.editor';
import { compose, type FrameRequest } from './compose';

type Appearance = Route['settings']['line']['appearance'];
type Choices = NonNullable<Parameters<typeof OVERLAY_MAKERS.lines>[1]>;
type Hovered = NonNullable<Choices['hovered']>;

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
const widthOf = (stroke: string | undefined) => Number(/lineWidth=([\d.]+)/.exec(stroke ?? '')?.[1] ?? 1); // 1, the default, is not written

/** A route's line, by their places in the scene, under the pointer. */
function hover(scene: Scene, plus: Hovered['plus'] = 'none', lineAt = 1, routeAt = 0): Hovered {
  const route = scene.routes[routeAt];
  return { routeId: route?.id ?? '', lineId: route?.lines[lineAt]?.id ?? '', plus };
}

/** The frame without overlays, then with the lines' overlay for the routes handed: the overlay's lines follow the first. */
function both(scene: Scene, viewing: (typeof VIEWINGS)[keyof typeof VIEWINGS], routes: readonly Route[] = scene.routes, choices?: Choices) {
  const routeIds = routes.map((route) => route.id);
  const plain = draw(request(scene, { viewing: viewing.viewing }), viewing.catalogue);
  const edited = draw(request(scene, { viewing: viewing.viewing, overlays: [OVERLAY_MAKERS.lines(routeIds, choices)] }), viewing.catalogue);
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
      expect(widthOf(stroke), name).toBe(2 * unit);
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
    const overlays = [OVERLAY_MAKERS.lines(routeIds, { hovered: hover(scene, 'active', 2, 1) }), OVERLAY_MAKERS.points(routeIds, { selected: [] })];
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

test('the hovered stretch glows as v3’s: white at the line’s width + 9, then the accent at + 4, along that line alone (:333–349)', () => {
  for (const [name, viewing] of Object.entries(VIEWINGS)) {
    const scene = sceneOf(['whole']);
    const { plain, added } = both(scene, viewing, scene.routes, { hovered: hover(scene) });
    const [white, accent, ...more] = strokes(added);
    expect(more, name).toEqual([]);
    // The line's width on screen is its layer's: thickness 3 × frame.scale (1 at 1080p) × the zoom; 9 and 4 by unitAt (D153).
    const line = 3 * viewing.zoom;
    const unit = unitAt(viewing.zoom);
    expect(white, name).toContain('rgba(255, 255, 255, 0.85)');
    expect(widthOf(white), name).toBeCloseTo(line + 9 * unit, 6);
    expect(accent, name).toContain('rgba(15, 98, 254, 0.45)'); // v3's HOVER_ACCENT_GLOW, constants.js:49
    expect(widthOf(accent), name).toBeCloseTo(line + 4 * unit, 6);
    expect(white, name).toContain('lineCap=round');
    // Along the line where its own layer draws it (within 0.1 px), and the hovered line alone, not the route's other two.
    const glow = places(added);
    const drawn = places(plain.lines);
    expect(glow.filter(({ x, y }) => !drawn.some((at) => Math.hypot(at.x - x, at.y - y) <= 0.1)), name).toEqual([]);
    expect(glow.length, name).toBeGreaterThan(5);
    expect(glow.length, name).toBeLessThan(drawn.length / 2);
    if (name !== 'a zoom of 1') continue;
    // From the line's first point to its last: (0.4, 0.3) and (0.6, 0.55) of the picture drawn 1,440 wide from x = 240.
    const ends = [glow[0], glow[glow.length - 1]].map((at) => [Math.round(at?.x ?? 0), Math.round(at?.y ?? 0)]);
    expect(ends).toEqual([[816, 324], [1104, 594]]);
  }
});

test('a hidden line hovered glows round its guide; no glow for none hovered, ids that match nothing, or another route’s line', () => {
  const viewing = VIEWINGS['a zoom of 1'];
  const hidden = sceneOf(['hidden']);
  const [guide, white, accent, ...more] = strokes(both(hidden, viewing, hidden.routes, { hovered: hover(hidden) }).added);
  expect(guide).toContain('lineDash=');
  expect(more).toEqual([]);
  // The guide's 2 wide, not the hidden line's thickness, under v3's 9 and 4.
  expect([white, accent].map(widthOf)).toEqual([2 + 9, 2 + 4]);
  const two = sceneOf(['whole', 'whole']);
  const [first, second] = two.routes;
  const glows = (hovered: Hovered | null, routes: readonly Route[] = two.routes) => strokes(both(two, viewing, routes, { hovered }).added);
  expect(glows(null)).toEqual([]);
  expect(glows({ routeId: 'no-such-route', lineId: first?.lines[0]?.id ?? '', plus: 'idle' })).toEqual([]);
  expect(glows({ routeId: first?.id ?? '', lineId: 'no-such-line', plus: 'idle' })).toEqual([]);
  expect(glows({ routeId: first?.id ?? '', lineId: second?.lines[0]?.id ?? '', plus: 'idle' })).toEqual([]);
  // The stretch names its own route: it glows whether or not its route is among those whose guides are asked for.
  expect(glows(hover(two, 'none', 0, 1), [])).toHaveLength(2);
  // A thickness not a number gives no width: nothing drawn, nothing thrown.
  const odd = { ...two, routes: two.routes.map((route) => ({ ...route, settings: { ...route.settings, line: { ...route.settings.line, thickness: Number.NaN } } })) };
  const plain = draw(request(odd), viewing.catalogue);
  const edited = draw(request(odd, { overlays: [OVERLAY_MAKERS.lines([], { hovered: hover(odd) })] }), viewing.catalogue);
  expect(strokes(edited.lines.slice(plain.lines.length))).toEqual([]);
  expect(edited.reports).toEqual(plain.reports);
});

test('the "+" sits at the hovered stretch’s middle, after the glow: radius 9, 11 with the pointer on it, none with no insert (:401–450)', () => {
  for (const [name, viewing] of Object.entries(VIEWINGS)) {
    const scene = sceneOf(['whole']);
    const unit = unitAt(viewing.zoom);
    const drawn = (plus: Hovered['plus']) => both(scene, viewing, scene.routes, { hovered: hover(scene, plus) }).added;
    const arcs = (lines: readonly string[]) => lines.filter((line) => line.startsWith('arc '));
    expect(arcs(drawn('none')), name).toEqual([]);
    for (const [plus, radius] of [['idle', 9], ['active', 11]] as const) {
      const added = drawn(plus);
      const [arc, ...others] = arcs(added);
      expect(others, name).toEqual([]);
      const first = added.indexOf(arc ?? '');
      // The glow's two strokes come first; the "+" is its disc, then its arms.
      expect(strokes(added.slice(0, first)), name).toHaveLength(2);
      expect(Number(arc?.split(' ')[3]), name).toBeCloseTo(radius * unit, 6);
      // The middle by index of the stretch's samples, as placed on screen (the glow's own places).
      const glow = places(added.slice(0, first));
      const [a, b] = [glow[Math.floor((glow.length - 1) / 2)], glow[Math.ceil((glow.length - 1) / 2)]];
      const [centre] = places([(arc ?? '').replace(/^arc /, 'moveTo ')]);
      expect(Math.hypot(((a?.x ?? 0) + (b?.x ?? 0)) / 2 - (centre?.x ?? 0), ((a?.y ?? 0) + (b?.y ?? 0)) / 2 - (centre?.y ?? 0)), name).toBeLessThan(0.1);
      // v3's accent fills the disc while the pointer is on it; white otherwise (the kit's plusHandle, v3 :424–450).
      expect(added.slice(first).find((line) => line.startsWith('fill')), name).toContain(plus === 'active' ? '#0f62fe' : 'rgba(255, 255, 255, 0.95)');
    }
  }
});

/** The frame and screen the composer hands each overlay for `scene` at 1080p and a zoom of 1. */
function handed(scene: Scene): Parameters<Overlay> extends [unknown, ...infer Rest] ? Rest : never {
  const seen: Parameters<Overlay>[] = [];
  draw(request(scene, { overlays: [(...args) => void seen.push(args)] }));
  const [, frame, screen] = seen[0] ?? [];
  if (frame === undefined || screen === undefined) throw new Error('no overlay was handed a frame');
  return [frame, screen];
}

test('drawn straight onto a dirtied canvas, the lines’ overlay sets every style it uses and leaves the state and no path behind', () => {
  const scene = sceneOf(['hidden', 'whole'], { branch: true });
  const [frame, screen] = handed(scene);
  const overlay = OVERLAY_MAKERS.lines(scene.routes.map((route) => route.id), { hovered: hover(scene, 'active', 3, 1) });
  const onto = (context: Recorder, on: Screen = screen) => (overlay(context, frame, on), context.take());
  // As careless drawing would leave it: faint, multiplied, dashed, offset, square-capped, bevelled, wide, coloured, a path open.
  const context = new Recorder();
  Object.assign(context, { globalAlpha: 0.3, globalCompositeOperation: 'multiply', lineDashOffset: 3, lineCap: 'square', lineJoin: 'bevel', lineWidth: 7, strokeStyle: 'red', fillStyle: 'green' });
  context.setLineDash([5, 7]);
  context.moveTo(1, 2);
  context.lineTo(3, 4);
  context.take();
  const before = context.state();
  expect(before.path.length).toBeGreaterThan(0);
  const clean = onto(new Recorder());
  expect(strokes(clean)).toHaveLength(5); // the guide, the glow's two, the "+"'s edge and arms
  expect(onto(context)).toEqual(clean);
  expect(context.state()).toEqual({ ...before, path: [] });
  // A hovered line of no sample or one: neither glow nor "+" (no guide is asked for).
  const alone = OVERLAY_MAKERS.lines([], { hovered: hover(scene, 'active', 3, 1) });
  const id = scene.routes[1]?.id ?? '';
  const view = screen.routes.get(id);
  for (const count of [0, 1]) {
    const shapes = new Map([...(view?.timeline.shapes ?? [])].map(([key, shape]) => [key, { ...shape, samples: shape.samples.slice(0, count) }]));
    const thin = view === undefined ? [] : [[id, { ...view, timeline: { ...view.timeline, shapes } }] as const];
    const recorder = new Recorder();
    alone(recorder, frame, { ...screen, routes: new Map([...screen.routes, ...thin]) });
    expect(recorder.take().filter((line) => /^(stroke|fill|arc) /.test(line)), String(count)).toEqual([]);
  }
});

test('a branch hovered glows along the branch alone; the line’s width is its layer’s, frame.scale included (2 at 2160p)', () => {
  const viewing = VIEWINGS['a zoom of 1'];
  const scene = sceneOf(['whole'], { branch: true });
  const { plain, added } = both(scene, viewing, scene.routes, { hovered: hover(scene, 'none', 3) });
  const glow = places(added);
  const drawn = places(plain.lines);
  expect(glow.filter(({ x, y }) => !drawn.some((at) => Math.hypot(at.x - x, at.y - y) <= 0.1))).toEqual([]);
  // From the third point (0.6, 0.55) to the fifth (0.7, 0.8), on the picture drawn 1,440 wide from x = 240.
  const ends = [glow[0], glow[glow.length - 1]].map((at) => [Math.round(at?.x ?? 0), Math.round(at?.y ?? 0)]);
  expect(ends).toEqual([[1104, 594], [1248, 864]]);
  // At 2160p the line's own stroke is thickness 3 × frame.scale 2; the glow is that + 9 and + 4.
  const size = { width: 3840, height: 2160 };
  const big = draw(request(scene, { size }), viewing.catalogue);
  const edited = draw(request(scene, { size, overlays: [OVERLAY_MAKERS.lines([], { hovered: hover(scene) })] }), viewing.catalogue);
  const line = widthOf(strokes(big.lines)[0]);
  expect(line).toBe(6);
  expect(strokes(edited.lines.slice(big.lines.length)).map(widthOf)).toEqual([line + 9, line + 4]);
});
