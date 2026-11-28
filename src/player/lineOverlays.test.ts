// CORE-04 stage 6: the editor's overlays that follow a line, through the editor's catalogue and the composer. A hidden
// line's faint guide has no v3 figure (v3's editor showed every line, so there is none to port): its look is v4's
// (D157), checked here as src/features/line/draw/overlays.ts states it. Where it runs is checked against the line
// itself, drawn whole by the line's own layer in the same frame, so the guide is on screen where the line would be.
import { expect, test } from 'vitest';
import { unitAt, type Overlay, type Screen } from '../adapters/render/overlays';
import { Recorder } from '../adapters/render/recorder';
import { pointAt } from '../core/geometry/path';
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

test('a hidden line’s guide runs on screen where the line would run, thin and dashed, at full alpha (D266), at each zoom', () => {
  for (const [name, viewing] of Object.entries(VIEWINGS)) {
    for (const shape of [{}, { branch: true }]) {
      const hidden = sceneOf(['hidden'], shape);
      const shown = { ...hidden, routes: hidden.routes.map((route) => ({ ...route, settings: { ...route.settings, line: { ...route.settings.line, appearance: 'whole' as const } } })) };
      const { plain, added } = both(hidden, viewing);
      expect(strokes(plain.lines), name).toEqual([]);
      const whole = draw(request(shown, { viewing: viewing.viewing }), viewing.catalogue).lines;
      sameCourse(places(added), places(whole), name);
      expect(places(added).length, name).toBeGreaterThan(20);
      // One stroke for the route, in its colour, by unitAt (D153; D157): 2 wide, dashed 6 on and 4 off, at full alpha
      // (D266's answer; the recorder writes no alpha at 1).
      const unit = unitAt(viewing.zoom);
      const [stroke, ...more] = strokes(added);
      expect(more, name).toEqual([]);
      expect(widthOf(stroke), name).toBe(2 * unit);
      expect(stroke, name).toContain(`lineDash=${6 * unit},${4 * unit}`);
      expect(stroke, name).not.toContain('globalAlpha=');
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
    const [white, accent, , ...more] = strokes(added); // the third is the redraw (D208), its own test below
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
    const glow = places(added.slice(0, added.indexOf(white ?? '')));
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
  const [guide, white, accent, , ...more] = strokes(both(hidden, viewing, hidden.routes, { hovered: hover(hidden) }).added); // then the redraw (D208)
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
  expect(glows(hover(two, 'none', 0, 1), [])).toHaveLength(3); // the glow's two and the redraw (D208)
  // A thickness not a number gives no width: nothing drawn, nothing thrown.
  const odd = { ...two, routes: two.routes.map((route) => ({ ...route, settings: { ...route.settings, line: { ...route.settings.line, thickness: Number.NaN } } })) };
  const plain = draw(request(odd), viewing.catalogue);
  const edited = draw(request(odd, { overlays: [OVERLAY_MAKERS.lines([], { hovered: hover(odd) })] }), viewing.catalogue);
  expect(strokes(edited.lines.slice(plain.lines.length))).toEqual([]);
  expect(edited.reports).toEqual(plain.reports);
});

test('D208: over its glow the hovered stretch is redrawn whole as its own line: the route’s colour, full alpha, its width and dash on screen, round', () => {
  for (const [name, viewing] of Object.entries(VIEWINGS)) {
    const scene = sceneOf(['whole']);
    const colour = scene.routes[0]?.settings.line.colour ?? 'none';
    const { plain, added } = both(scene, viewing, scene.routes, { hovered: hover(scene, 'idle') });
    const [white, accent, line, ...more] = strokes(added);
    expect([white?.includes('rgba(255, 255, 255, 0.85)'), accent?.includes('rgba(15, 98, 254, 0.45)')], name).toEqual([true, true]);
    // The redraw comes after the glow and before the "+" (its edge and arms the two strokes left).
    expect(more, name).toHaveLength(2);
    expect(added.indexOf(line ?? ''), name).toBeLessThan(added.findIndex((call) => call.startsWith('arc ')));
    // The line's own look: its colour at full alpha, its layer's width on screen (thickness 3 × frame.scale 1 × the zoom),
    // solid as its layer draws it (the model holds no dash yet: no lineDash), round caps and joins.
    const own = strokes(plain.lines)[0] ?? '';
    expect(line, name).toContain(colour);
    expect(line, name).not.toContain('globalAlpha=');
    expect(widthOf(line), name).toBeCloseTo(3 * viewing.zoom, 6);
    expect([own.includes('lineDash='), line?.includes('lineDash=')], name).toEqual([false, false]);
    expect(line, name).toContain('lineCap=round');
    expect(line, name).toContain('lineJoin=round');
    // The whole stretch (D253): the redraw's course is the glow's, place by place.
    const glowed = places(added.slice(0, added.indexOf(white ?? '')));
    const redrawn = places(added.slice(added.indexOf(accent ?? '') + 1, added.indexOf(line ?? '')));
    expect(glowed.length, name).toBeGreaterThan(5);
    alongside(redrawn, glowed, name);
    // A line shown only in part (it grows, and the lead is part way along the stretch at this moment) is still redrawn
    // whole (Codex list line 30): its redraw goes through every place of the same stretch redrawn where the line shows whole.
    const growing = sceneOf(['grows']);
    const shownWhole = { ...growing, routes: growing.routes.map((route) => ({ ...route, settings: { ...route.settings, line: { ...route.settings.line, appearance: 'whole' as const } } })) };
    const redrawOf = (made: Scene) => {
      const ask = (extra: Partial<FrameRequest>) => draw(request(made, { sceneMs: 5_000, viewing: viewing.viewing, ...extra }), viewing.catalogue);
      const bare = ask({});
      const lines = ask({ overlays: [OVERLAY_MAKERS.lines([], { hovered: hover(made) })] }).lines.slice(bare.lines.length);
      const [, glowTop, own] = strokes(lines);
      return { bare: places(bare.lines), redrawn: places(lines.slice(lines.indexOf(glowTop ?? '') + 1, lines.indexOf(own ?? ''))) };
    };
    const whole = redrawOf(shownWhole).redrawn;
    const part = redrawOf(growing);
    const shown = whole.filter(({ x, y }) => part.bare.some((at) => Math.hypot(at.x - x, at.y - y) <= 0.1));
    // The frame draws the stretch only in part: some of its places, not all.
    expect([shown.length > 0, shown.length < whole.length], name).toEqual([true, true]);
    expect(whole.length, name).toBeGreaterThan(5);
    alongside(part.redrawn, whole, name);
  }
  // A hidden line's stretch is redrawn in the guide's look, over its halo: 2 wide, dashed 6 on and 4 off, full alpha (D266).
  const viewing = VIEWINGS['a zoom of 1'];
  const hidden = sceneOf(['hidden']);
  const [, , , again, ...rest] = strokes(both(hidden, viewing, hidden.routes, { hovered: hover(hidden) }).added);
  expect(rest).toEqual([]);
  expect(widthOf(again)).toBe(2);
  expect(again).toContain('lineDash=6,4');
  expect(again).not.toContain('globalAlpha=');
  expect(again).not.toContain('lineCap=round');
  expect(again).toContain(hidden.routes[0]?.settings.line.colour ?? 'none');
  // Nothing hovered: no redraw, as no glow.
  const scene = sceneOf(['whole']);
  expect(strokes(both(scene, viewing, scene.routes, { hovered: null }).added)).toEqual([]);
  expect(strokes(both(scene, viewing).added)).toEqual([]);
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
      // The glow's two strokes come first, then the redraw (D208); the "+" is its disc, then its arms.
      expect(strokes(added.slice(0, first)), name).toHaveLength(3);
      expect(Number(arc?.split(' ')[3]), name).toBeCloseTo(radius * unit, 6);
      // The middle by index of the stretch's samples, as placed on screen (the glow's own places).
      const glow = places(added.slice(0, added.indexOf(strokes(added)[0] ?? '')));
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

/** A recorder that also keeps the path each stroke strokes, which the recorder's text alone does not say. */
class Watching extends Recorder {
  readonly stroked: string[][] = [];
  override stroke(): void {
    this.stroked.push([...this.state().path]);
    super.stroke();
  }
}

/** The glow alone of a route's line (no ids, so no guide; `'none'`, so no "+"), onto `context` as the composer hands it a frame,
 *  with the course it should take: that line's own samples, as the frame holds them, placed on screen. */
function glowOnto(context: Watching, scene: Scene, lineAt: number, routeAt: number) {
  const [frame, screen] = handed(scene);
  OVERLAY_MAKERS.lines([], { hovered: hover(scene, 'none', lineAt, routeAt) })(context, frame, screen);
  const route = scene.routes[routeAt];
  const samples = screen.routes.get(route?.id ?? '')?.timeline.shapes.get(route?.lines[lineAt]?.id ?? '')?.samples ?? [];
  return { stroked: context.stroked, left: context.state().path, course: samples.map((sample) => screen.place(sample)) };
}

/** The same course, place by place and in order, to within 0.01 px (the recorder rounds to a thousandth). */
function alongside(drawn: readonly { x: number; y: number }[], course: readonly ({ x: number; y: number } | null)[], name: string): void {
  expect(drawn, name).toHaveLength(course.length);
  const off = drawn.filter((at, i) => {
    const want = course[i];
    return want === null || want === undefined || Math.hypot(want.x - at.x, want.y - at.y) > 0.01;
  });
  expect(off, name).toEqual([]);
}

/** A stroked path that is the course and nothing more: one moveTo, a lineTo for each further place, no other command. */
function strokesAlong(path: readonly string[], course: Parameters<typeof alongside>[1], name: string): void {
  expect(path.map((call) => call.split(' ')[0]), name).toEqual(course.map((_, i) => (i === 0 ? 'moveTo' : 'lineTo')));
  alongside(places(path), course, name);
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
  expect(strokes(clean)).toHaveLength(6); // the guide, the glow's two, the redraw (D208), the "+"'s edge and arms
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

test('the glow alone, onto a canvas with a path left open, strokes the stretch and nothing else, twice, then the redraw, and leaves no path', () => {
  // No guide clears the open path before the glow and no "+" clears it after: the glow's and the redraw's own beginPath() calls alone.
  const scene = sceneOf(['hidden', 'whole'], { branch: true });
  for (const open of [false, true]) {
    const context = new Watching();
    if (open) {
      context.moveTo(1, 2);
      context.lineTo(3, 4);
    }
    const { stroked, left, course } = glowOnto(context, scene, 3, 1);
    expect(course.length, String(open)).toBeGreaterThan(1);
    expect(stroked, String(open)).toHaveLength(3); // the glow's two, the redraw (D208)
    for (const [i, path] of stroked.entries()) strokesAlong(path, course, `${open ? 'a path open' : 'clean'}, stroke ${i}`);
    expect(left, String(open)).toEqual([]);
  }
});

test('a branch hovered glows along the branch alone; the line’s width is its layer’s, frame.scale included (2 at 2160p)', () => {
  const viewing = VIEWINGS['a zoom of 1'];
  const scene = sceneOf(['whole'], { branch: true });
  const { plain, added } = both(scene, viewing, scene.routes, { hovered: hover(scene, 'none', 3) });
  const glow = places(added.slice(0, added.indexOf(strokes(added)[0] ?? '')));
  const drawn = places(plain.lines);
  expect(glow.filter(({ x, y }) => !drawn.some((at) => Math.hypot(at.x - x, at.y - y) <= 0.1))).toEqual([]);
  // Its whole course is the branch's own line (index 3), place by place: nothing of the trunk, between the ends or beyond.
  const { stroked, course } = glowOnto(new Watching(), scene, 3, 0);
  alongside(glow, course, 'through the composer');
  // Its two strokes, white at the line's 3 + 9, then blue at + 4, each of that course alone.
  const [white, blue] = strokes(added);
  expect([white, blue].map(widthOf)).toEqual([12, 7]);
  expect([white?.includes('rgba(255, 255, 255, 0.85)'), blue?.includes('rgba(15, 98, 254, 0.45)')]).toEqual([true, true]);
  expect(stroked).toHaveLength(3); // the glow's two, the redraw (D208), each along that course
  for (const [i, path] of stroked.entries()) strokesAlong(path, course, `stroke ${i}`);
  // From the third point (0.6, 0.55) to the fifth (0.7, 0.8), on the picture drawn 1,440 wide from x = 240.
  const ends = [glow[0], glow[glow.length - 1]].map((at) => [Math.round(at?.x ?? 0), Math.round(at?.y ?? 0)]);
  expect(ends).toEqual([[1104, 594], [1248, 864]]);
  // At 2160p the line's own stroke is thickness 3 × frame.scale 2; the glow is that + 9 and + 4.
  const size = { width: 3840, height: 2160 };
  const big = draw(request(scene, { size }), viewing.catalogue);
  const edited = draw(request(scene, { size, overlays: [OVERLAY_MAKERS.lines([], { hovered: hover(scene) })] }), viewing.catalogue);
  const line = widthOf(strokes(big.lines)[0]);
  expect(line).toBe(6);
  expect(strokes(edited.lines.slice(big.lines.length)).map(widthOf)).toEqual([line + 9, line + 4, line]); // the redraw at the line's own
});

/** The guide while paused (D265) for every route of the scene, as the editor asks for it: the lines it adds to the frame. */
function guided(scene: Scene, viewing: (typeof VIEWINGS)[keyof typeof VIEWINGS]): string[] & { line: { x: number; y: number }[] } {
  const ids = scene.routes.map((route) => route.id);
  const plain = draw(request(scene, { viewing: viewing.viewing }), viewing.catalogue);
  const edited = draw(request(scene, { viewing: viewing.viewing, overlays: [OVERLAY_MAKERS.guideLines(ids)] }), viewing.catalogue);
  expect(edited.lines.slice(0, plain.lines.length)).toEqual(plain.lines);
  expect(edited.reports).toEqual([]);
  // The scene's routes are drawn `whole`, so the frame without overlays holds every line where it runs.
  return Object.assign(edited.lines.slice(plain.lines.length), { line: places(plain.lines) });
}

/** Each stroke of `lines` with the places of the path it strokes. */
function sections(lines: readonly string[]): { stroke: string; at: { x: number; y: number }[] }[] {
  const out: { stroke: string; at: { x: number; y: number }[] }[] = [];
  let path: string[] = [];
  for (const line of lines) {
    if (line.startsWith('stroke ')) {
      out.push({ stroke: line, at: places(path) });
      path = [];
    } else path.push(line);
  }
  return out;
}

/** The guide's own strokes, dashed or dotted, leaving out the way arrows' white edges (D275), which carry no dash. */
const guideStrokes = (lines: readonly string[]) => sections(lines).filter((each) => each.stroke.includes('lineDash='));

/** The way arrows among `lines` (D275): each fill, the corners of the path it fills on screen, and the stroke that edges it. */
function arrowsIn(lines: readonly string[]): { corners: { x: number; y: number }[]; fill: string; edge: string }[] {
  const out: { corners: { x: number; y: number }[]; fill: string; edge: string }[] = [];
  let path: string[] = [];
  for (const [i, line] of lines.entries()) {
    if (line === 'beginPath') path = [];
    else if (line.startsWith('fill ')) out.push({ corners: places(path), fill: line, edge: lines[i + 1] ?? '' });
    else path.push(line);
  }
  return out;
}

/** The scene's one route (a stop, a bend, two stops, and a fifth point off the third), its lead start set to the point at `startAt` (none for null). */
function ledFrom(startAt: number | null): Scene {
  const scene = sceneOf(['whole'], { branch: true });
  return { ...scene, routes: scene.routes.map((route) => ({ ...route, leadStart: startAt === null ? null : (route.points[startAt]?.id ?? '') })) };
}

test('paused, the lines the lead does not walk are drawn dotted at the route’s full colour, the walked ones dashed as before (D273 part 1)', () => {
  for (const [name, viewing] of Object.entries(VIEWINGS)) {
    const unit = unitAt(viewing.zoom);
    const colour = ledFrom(0).routes[0]?.settings.line.colour ?? 'none';
    // Led from the second point, the one-way first line points back at it: the lead cannot reach it.
    const route = ledFrom(1).routes[0];
    expect(route?.lines.length, name).toBe(4);
    const [walked, dotted, ...more] = guideStrokes(guided(ledFrom(1), viewing));
    expect(more, name).toEqual([]);
    // The walked lines: one stroke in the guide's look, as before (2 wide, dashed 6 on and 4 off, butt caps).
    expect(widthOf(walked?.stroke), name).toBe(2 * unit);
    expect(walked?.stroke, name).toContain(`lineDash=${6 * unit},${4 * unit}`);
    expect(walked?.stroke, name).not.toContain('lineCap=');
    expect(walked?.stroke, name).toContain(colour);
    // The left-out line: one stroke, 3 wide, round dots every 8, round joins, the route's colour at full alpha.
    expect(widthOf(dotted?.stroke), name).toBe(3 * unit);
    expect(dotted?.stroke, name).toContain(`lineDash=0,${8 * unit}`);
    expect(dotted?.stroke, name).toContain('lineCap=round');
    expect(dotted?.stroke, name).toContain('lineJoin=round');
    expect(dotted?.stroke, name).not.toContain('globalAlpha=');
    expect(dotted?.stroke, name).toContain(colour);
    // Together they run where the route's lines run, drawn whole by the line's own layer in the same frame.
    sameCourse([...(walked?.at ?? []), ...(dotted?.at ?? [])], guided(ledFrom(1), viewing).line, name);
    expect(dotted?.at.length, name).toBeGreaterThan(1);
    expect(walked?.at.length, name).toBeGreaterThan(dotted?.at.length ?? 0);
  }
  // At a zoom of 1 the dotted course is the first line's (it lies left of the second point; every walked line right of it).
  const [walked, dotted] = guideStrokes(guided(ledFrom(1), VIEWINGS['a zoom of 1']));
  const left = Math.max(...(dotted?.at ?? []).map(({ x }) => x));
  expect(left).toBeLessThanOrEqual(Math.min(...(walked?.at ?? []).map(({ x }) => x)) + 0.5);
});

test('a route the lead walks whole draws one dashed stroke as before; a loop’s closing line is dotted; with no lead start every line is dotted', () => {
  const viewing = VIEWINGS['a zoom of 1'];
  const unit = unitAt(viewing.zoom);
  const plainly = guided(ledFrom(0), viewing);
  const whole = guideStrokes(plainly);
  expect(whole).toHaveLength(1);
  sameCourse(whole[0]?.at ?? [], plainly.line, 'the lead walks every line');
  expect(whole[0]?.stroke).toContain(`lineDash=${6 * unit},${4 * unit}`);
  expect(whole[0]?.stroke).not.toContain('lineCap=');
  // A loop: the last stop joined back to the first by a one-way line; the lead walks round and leaves that line out.
  const plain = ledFrom(0);
  const closed = { ...plain, routes: plain.routes.map((route) => ({ ...route, lines: [...route.lines, newLine(() => 'closer', route.points[3]?.id ?? '', route.points[0]?.id ?? '')] })) };
  const looped = guided(closed, viewing);
  const [walked, closer, ...more] = guideStrokes(looped);
  expect(more).toEqual([]);
  sameCourse([...(walked?.at ?? []), ...(closer?.at ?? [])], looped.line, 'the loop');
  expect(walked?.stroke).toContain(`lineDash=${6 * unit},${4 * unit}`);
  expect(closer?.stroke).toContain(`lineDash=0,${8 * unit}`);
  expect(closer?.at.length).toBeGreaterThan(1);
  // No lead start: the lead walks nothing, so the one stroke is dotted.
  const unled = guided(ledFrom(null), viewing);
  const none = guideStrokes(unled);
  expect(none).toHaveLength(1);
  expect(none[0]?.stroke).toContain(`lineDash=0,${8 * unit}`);
  expect(none[0]?.stroke).toContain('lineCap=round');
  sameCourse(none[0]?.at ?? [], unled.line, 'no lead start');
});

test('a hidden line’s guide (lineOverlay) stays one dashed stroke when the lead leaves a line out: the dots are the paused guide’s alone', () => {
  const led = ledFrom(1);
  const hidden = { ...led, routes: led.routes.map((route) => ({ ...route, settings: { ...route.settings, line: { ...route.settings.line, appearance: 'hidden' as const } } })) };
  const [stroke, ...more] = strokes(both(hidden, VIEWINGS['a zoom of 1']).added);
  expect(more).toEqual([]);
  expect(stroke).toContain(`lineDash=${6 * unitAt(1)},${4 * unitAt(1)}`);
  expect(stroke).not.toContain('lineCap=');
});

/** The frame and screen the composer hands each overlay for `scene` under a viewing. */
function handedUnder(scene: Scene, viewing: (typeof VIEWINGS)[keyof typeof VIEWINGS]): Parameters<Overlay> extends [unknown, ...infer Rest] ? Rest : never {
  const seen: Parameters<Overlay>[] = [];
  draw(request(scene, { viewing: viewing.viewing, overlays: [(...args) => void seen.push(args)] }), viewing.catalogue);
  const [, frame, screen] = seen[0] ?? [];
  if (frame === undefined || screen === undefined) throw new Error('no overlay was handed a frame');
  return [frame, screen];
}

/** An arrow's middle and way from its corners (the kit's wayArrow): tip = at + way × size, back = at − way × 0.6 × size. The recorder writes places to a few decimals, so read to 0.01. */
function arrowOf(corners: readonly { x: number; y: number }[]) {
  const [tip, one, two] = corners;
  if (tip === undefined || one === undefined || two === undefined) throw new Error('an arrow of fewer than three corners');
  const back = { x: (one.x + two.x) / 2, y: (one.y + two.y) / 2 };
  const reach = Math.hypot(tip.x - back.x, tip.y - back.y);
  const way = { x: (tip.x - back.x) / reach, y: (tip.y - back.y) / reach };
  return { at: { x: tip.x - (tip.x - back.x) / 1.6, y: tip.y - (tip.y - back.y) / 1.6 }, way, size: reach / 1.6 };
}

test('paused, every one-way line carries one arrow two thirds along, pointing from its first point to its second; a two-way line none (D275)', () => {
  for (const [name, viewing] of Object.entries(VIEWINGS)) {
    const unit = unitAt(viewing.zoom);
    const led = ledFrom(0);
    // The third line runs both ways: no arrow on it.
    const scene = { ...led, routes: led.routes.map((route) => ({ ...route, lines: route.lines.map((line, i) => (i === 2 ? { ...line, direction: 'both ways' as const } : line)) })) };
    const route = scene.routes[0];
    if (route === undefined) throw new Error('no route');
    const [, screen] = handedUnder(scene, viewing);
    const held = screen.routes.get(route.id);
    if (held === undefined) throw new Error('the frame holds no route');
    const oneWay = route.lines.filter((line) => line.direction === 'one way');
    expect(oneWay, name).toHaveLength(3);
    const arrows = arrowsIn(guided(scene, viewing));
    expect(arrows, name).toHaveLength(oneWay.length);
    for (const [i, line] of oneWay.entries()) {
      const arrow = arrows[i];
      if (arrow === undefined) throw new Error(`no arrow for line ${i}`);
      const { at, way, size } = arrowOf(arrow.corners);
      // v3's size 7 and edge 1.5, by unitAt(zoom); the route's colour at full alpha, edged white.
      expect(size, name).toBeCloseTo(7 * unit, 2);
      expect(arrow.fill, name).toContain(`fillStyle=${route.settings.line.colour}`);
      expect(arrow.fill, name).not.toContain('globalAlpha=');
      expect(arrow.edge, name).toContain('strokeStyle=#ffffff');
      expect(arrow.edge, name).toContain(`lineWidth=${1.5 * unit}`);
      // Two thirds along the line's samples by index, as the frame holds them.
      const samples = held.timeline.shapes.get(line.id)?.samples ?? [];
      const middle = pointAt(samples, 2 / 3);
      const expected = middle === null ? null : screen.place(middle);
      expect(expected, name).not.toBeNull();
      expect(at.x, name).toBeCloseTo(expected?.x ?? Number.NaN, 2);
      expect(at.y, name).toBeCloseTo(expected?.y ?? Number.NaN, 2);
      // Pointing from the line's first point to its second, and nearer its second (the "+" sits at the middle).
      const [from, to] = [line.from, line.to].map((id) => route.points.find((point) => point.id === id)).map((point) => (point ? screen.place(point) : null));
      if (!from || !to) throw new Error('a line’s point is not on screen');
      expect(way.x * (to.x - from.x) + way.y * (to.y - from.y), name).toBeGreaterThan(0);
      expect(Math.hypot(at.x - to.x, at.y - to.y), name).toBeLessThan(Math.hypot(at.x - from.x, at.y - from.y));
    }
  }
  // `guided` checks that the frame asked for without the overlay (a video, the player, the editor while playing) is the
  // beginning of the frame asked for with it: the arrows are the overlay's alone, asked for only while paused
  // (previewLogic.test.ts holds that the editor asks for the guide only while not playing).
});

test('a one-way line the lead does not walk points its own way, from its first point to its second (D275)', () => {
  const viewing = VIEWINGS['a zoom of 1'];
  // Led from the second point, the one-way first line points back at it: the lead cannot reach it.
  const scene = ledFrom(1);
  const route = scene.routes[0];
  const first = route?.lines[0];
  if (route === undefined || first === undefined) throw new Error('no route');
  const [, screen] = handedUnder(scene, viewing);
  expect(screen.routes.get(route.id)?.timeline.walk.leftOut).toEqual([first.id]);
  const arrows = arrowsIn(guided(scene, viewing));
  expect(arrows).toHaveLength(route.lines.length);
  const { way } = arrowOf(arrows[0]?.corners ?? []);
  const [from, to] = [first.from, first.to].map((id) => route.points.find((point) => point.id === id)).map((point) => (point ? screen.place(point) : null));
  if (!from || !to) throw new Error('a line’s point is not on screen');
  expect(way.x * (to.x - from.x) + way.y * (to.y - from.y)).toBeGreaterThan(0);
});
