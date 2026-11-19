// CORE-04: the line, a route module, through the real catalogue and the recorder. Each test's name is a line the item
// holds. A test reaches the module only through the catalogue, as the composer does (.dependency-cruiser.cjs, rule 4).
import { afterEach, expect, test, vi } from 'vitest';
import type { Frame } from '../adapters/render/layers';
import { Recorder } from '../adapters/render/recorder';
import { pointAt } from '../core/geometry/path';
import type { ImagePoint } from '../core/geometry/units';
import { newLine, newPoint, newRoute, newScene, type Route, type Scene } from '../core/model/scene';
import { composeTimeline, leadAt } from '../core/timing/timeline';
import { CATALOGUE, type Catalogue } from '../features/catalogue';
import { compose, type FrameRequest } from './compose';

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

type Appearance = Route['settings']['line']['appearance'];
type Line = Route['settings']['line'];

/** A route a → b → c through a bend at b, one curve; with `branch`, a fork at c to d and e that rejoins at f. */
function routeOf(line: Partial<Line> = {}, branch = false): Route {
  const nextId = counter();
  const at = (x: number, y: number, kind: 'stop' | 'bend' = 'stop') => newPoint(nextId, { x, y, kind });
  const [a, b, c] = [at(0.2, 0.2), at(0.5, 0.8, 'bend'), at(0.8, 0.2)];
  const points = [a, b, c];
  const lines = [newLine(nextId, a.id, b.id), newLine(nextId, b.id, c.id)];
  if (branch) {
    const [d, e, f] = [at(0.9, 0.5), at(0.7, 0.6), at(0.8, 0.9)];
    points.push(d, e, f);
    // c → d → f and c → e → f rejoin at f; f → a closes a loop, so the lead never walks it.
    const pairs = [[c, d], [c, e], [d, f], [e, f], [f, a]] as const;
    for (const [from, to] of pairs) lines.push(newLine(nextId, from.id, to.id));
  }
  const route = { ...newRoute(nextId), points, lines, leadStart: a.id };
  return { ...route, settings: { ...route.settings, line: { ...route.settings.line, ...line } } };
}

const line = CATALOGUE.route[0];
if (line === undefined) throw new Error('no route module');

interface Drawing {
  readonly strokes: readonly { readonly points: readonly ImagePoint[] }[];
}

const isDrawing = (value: unknown): value is Drawing =>
  typeof value === 'object' && value !== null && 'strokes' in value && Array.isArray(value.strokes);

/** The line's evaluation of a route at a content time, its clock time given as `timeMs` (never read). */
function evaluated(route: Route, contentMs: number | 'end', timeMs = Number.NaN) {
  const timeline = composeTimeline(route, 1);
  const lead = leadAt(timeline, contentMs === 'end' ? timeline.endMs : contentMs);
  const shape = { points: route.points, lines: route.lines, leadStart: route.leadStart, marks: route.marks };
  if (line === undefined) throw new Error('no route module');
  const settings = line.select(route.settings);
  const result = line.evaluate({ settings, route: { shape, timeline }, seed: 1, scale: 1, timeMs, lead });
  if (!result.ok) throw new Error(result.reason);
  if (!isDrawing(result.value)) throw new Error('not a line drawing');
  const samples = (lineId: string) => timeline.shapes.get(lineId)?.samples ?? [];
  return { drawing: result.value, lead, timeline, samples };
}

const key = (point: ImagePoint) => `${point.x},${point.y}`;

afterEach(() => vi.restoreAllMocks());

test('the line is first in CATALOGUE.route and draws in the lines layer', () => {
  expect(line.id).toBe('line');
  expect(Object.keys(line.layers)).toEqual(['lines']);
});

test('each appearance at a line’s start, part way and end, from progress alone, with no clock read', () => {
  const refuse = () => {
    throw new Error('a clock was read');
  };
  for (const clock of [Date, performance]) vi.spyOn(clock, 'now').mockImplementation(refuse);
  const route = (appearance: Appearance) => routeOf({ appearance });
  const { timeline, samples } = evaluated(route('whole'), 0);
  const [first, second] = timeline.lines;
  if (!first || !second) throw new Error('two walked lines');
  const whole = [...samples(first.lineId), ...samples(second.lineId).slice(1)];
  const partWay = (first.departMs + first.arriveMs) / 2;
  const strokes = (appearance: Appearance, at: number | 'end') => evaluated(route(appearance), at).drawing.strokes;
  for (const at of [0, partWay, 'end'] as const) {
    expect(strokes('whole', at)).toEqual([expect.objectContaining({ points: whole })]);
    expect(strokes('hidden', at)).toEqual([]);
  }
  expect(strokes('grows', 0)).toEqual([]);
  expect(strokes('shrinks', 0)).toEqual([expect.objectContaining({ points: whole })]);
  expect(strokes('grows', 'end')).toEqual([expect.objectContaining({ points: whole })]);
  expect(strokes('shrinks', 'end')).toEqual([]);
  // Part way, the line meets the lead's head exactly, revealed behind it or hidden behind it.
  const { lead } = evaluated(route('grows'), partWay);
  const head = pointAt(samples(first.lineId), lead.progress.get(first.lineId) ?? Number.NaN);
  expect(head).toEqual(lead.main?.at);
  const [grown] = strokes('grows', partWay);
  const [shrunk] = strokes('shrinks', partWay);
  expect([grown?.points[0], grown?.points.at(-1)]).toEqual([whole[0], head]);
  expect([shrunk?.points[0], shrunk?.points.at(-1)]).toEqual([head, whole.at(-1)]);
  expect((grown?.points.length ?? 0) + (shrunk?.points.length ?? 0)).toBeLessThanOrEqual(whole.length + 2);
  // The clock's time is not read: the same lead at any time draws the same.
  expect(evaluated(route('grows'), partWay, 0).drawing).toEqual(evaluated(route('grows'), partWay, 9e9).drawing);
});

test('CROWD-07.1: at 0 a trunk and a rejoined branch show alike, as does a line the lead never walks', () => {
  for (const appearance of ['whole', 'grows', 'shrinks'] as const) {
    const { drawing, timeline, samples } = evaluated(routeOf({ appearance }, true), 0);
    expect(timeline.walk.leftOut).toHaveLength(1);
    const drawn = new Set(drawing.strokes.flatMap((stroke) => stroke.points.map(key)));
    const inner = (lineId: string) => samples(lineId).slice(1, -1);
    const shown = [...timeline.shapes.keys()].map((lineId) => inner(lineId).every((p) => drawn.has(key(p))));
    expect(shown).toEqual(Array.from({ length: 7 }, () => appearance !== 'grows'));
    if (appearance === 'grows') expect(drawn.size).toBe(0);
  }
});

test('the style’s colour and width at two frame sizes, drawn where the frame places the picture', () => {
  const route = routeOf({ appearance: 'whole', colour: '#0072b2', thickness: 6 });
  const scene: Scene = { ...newScene(counter()), routes: [route] };
  const source = { width: 400, height: 300, close() {} };
  const surface = () => ({ context: new Recorder(), image: source });
  const strokesAt = (width: number, height: number) => {
    const recorder = new Recorder();
    const image = { width: 400, height: 300, source };
    const ask: FrameRequest = { scene, sceneMs: 0, seed: 7, size: { width, height }, image, surface };
    expect(compose(recorder, ask)).toEqual([]);
    return recorder.take().filter((entry) => /^(moveTo|stroke) /.test(entry));
  };
  const [moveTo, stroke] = strokesAt(1920, 1080);
  // The picture fits 1920 × 1080 at x 240, 1440 wide and 1080 high: a at (0.2, 0.2) is (528, 216).
  expect(moveTo).toMatch(/^moveTo 528 216 @ /);
  expect(stroke).toMatch(/strokeStyle=#0072b2/);
  expect(stroke).toMatch(/lineWidth=6\b/);
  expect(stroke).toMatch(/lineCap=round lineJoin=round|lineJoin=round lineCap=round/);
  expect(stroke).not.toMatch(/lineDash/);
  const [halfMove, halfStroke] = strokesAt(960, 540);
  expect(halfMove).toMatch(/^moveTo 264 108 @ /);
  expect(halfStroke).toMatch(/lineWidth=3\b/);
});

test('the drawing takes each dash and a per-line style, scaled by the frame (the model gives solid: D135)', () => {
  const size = { width: 200, height: 200 };
  const frame: Frame = { size, bounds: { x: 0, y: 0, ...size, scale: 1 }, picture: null, scale: 2, view: null };
  const stroke = (dash: string, colour: string, width: number) => ({
    points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }],
    style: { colour, width, dash },
  });
  const strokes3 = [stroke('solid', '#d55e00', 3), stroke('dashed', '#0072b2', 5), stroke('dotted', '#009e73', 1)];
  const value = { strokes: strokes3 };
  const recorder = new Recorder();
  line.layers.lines?.(recorder, value, frame);
  const strokes = recorder.take().filter((entry) => entry.startsWith('stroke '));
  expect(strokes).toHaveLength(3);
  expect(strokes[0]).toMatch(/strokeStyle=#d55e00.*lineWidth=6\b/);
  expect(strokes[0]).not.toMatch(/lineDash/);
  expect(strokes[1]).toMatch(/strokeStyle=#0072b2.*lineWidth=10\b.*lineDash=20,10$/);
  expect(strokes[2]).toMatch(/strokeStyle=#009e73.*lineWidth=2\b.*lineDash=4,12$/);
});

test('a line module that fails is reported, never thrown, and the scene’s modules still draw', () => {
  const throwing: Catalogue = {
    ...CATALOGUE,
    route: [
      {
        ...line,
        evaluate: () => {
          throw new Error('the line broke');
        },
      },
    ],
  };
  const source = { width: 400, height: 300, close() {} };
  const surface = () => ({ context: new Recorder(), image: source });
  const ask = (route: Route): FrameRequest => ({
    scene: { ...newScene(counter()), routes: [route] },
    sceneMs: 0,
    seed: 7,
    size: { width: 1920, height: 1080 },
    image: { width: 400, height: 300, source },
    surface,
  });
  for (const [request, catalogue, reason] of [
    [ask(routeOf({ appearance: 'whole' })), throwing, /the line broke/],
    // Until stage 4b the trail is a structured report too, and draws nothing.
    [ask(routeOf({ appearance: 'trail' })), CATALOGUE, /stage 4b/],
  ] as const) {
    const recorder = new Recorder();
    const reports = compose(recorder, request, catalogue);
    const routeId = request.scene.routes[0]?.id;
    expect(reports.map((report) => [report.routeId, report.featureId])).toEqual([[routeId, 'line']]);
    expect(reports[0]?.reason).toMatch(reason);
    const entries = recorder.take();
    expect(entries.filter((entry) => entry.startsWith('stroke '))).toEqual([]);
    expect(entries.filter((entry) => entry.startsWith('drawImage '))).toHaveLength(1);
  }
});
