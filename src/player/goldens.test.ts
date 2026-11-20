// CORE-04 stage 7, first step: v4's own goldens. Each scene below is drawn through the real catalogue and the real
// composer, without overlays (the frame a video holds), at the size the export module gives as its framing, found in the
// catalogue and evaluated as a video export will reach it (1920 × 1080 by default, so the render scale is 1, D126), with
// seed 7, at five moments of its length as the composer measures it, holds included: the start, a quarter, the middle,
// three quarters and the end; `grows` at two more, worked out from its own timeline: inside the pause at "Middle", and
// halfway through Middle's label fading in. The recorder's text of the moments is compared line for line with
// `src/player/goldens/<scene>.txt`.
//
// A missing golden fails, as v3's do (v3/tests/goldenDrawLogs.test.js:128–132), and so does a golden no scene draws.
// A plain run, here or in CI, never writes one: the writer is reached only under UPDATE_GOLDENS=1. To regenerate them on
// purpose, after a change meant to change what is drawn, run
//   UPDATE_GOLDENS=1 npx vitest run src/player/goldens.test.ts --update
// (UPDATE_GOLDENS=1 alone writes a missing golden outside CI, never a stale one), delete any golden whose scene is gone,
// and then read the diff of every golden, line by line, before committing it: a golden is only as good as that reading.
//
// Each scene is one route on one picture with v3's default looks but for the line's appearance, so that it is one a v3
// project can also hold and can be compared with v3's frame of the same scene. The hidden line is v4's own (v3's editor
// had none) and has a scene of its own.
import { expect, test } from 'vitest';
import { Recorder } from '../adapters/render/recorder';
import { playLength, sceneTime } from '../core/clock/clock';
import type { Size } from '../core/geometry/transform';
import { newLine, newPoint, newRoute, newScene, type Route, type Scene } from '../core/model/scene';
import type { Timeline } from '../core/timing/timeline';
import { CATALOGUE, type RouteFeature, type SceneFeature } from '../features/catalogue';
import { compose, type FrameRequest } from './compose';

type Appearance = Route['settings']['line']['appearance'];
type Place = Parameters<typeof newPoint>[1] & { readonly label?: string };

const UPDATE = import.meta.env.UPDATE_GOLDENS === '1';
const GOLDENS = import.meta.glob<string>('./goldens/*.txt', { query: '?raw', import: 'default', eager: true });

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

/** A scene, every setting at its default, of one route through `places`: its lead from the first, a line for each pair `joins` names. */
function sceneOf(places: readonly Place[], joins: readonly (readonly [number, number])[], appearance: Appearance): Scene {
  const nextId = counter();
  const scene = newScene(nextId);
  const points = places.map(({ label = '', ...at }) => ({ ...newPoint(nextId, at), label }));
  const id = (at: number) => points[at]?.id ?? '';
  const plain = newRoute(nextId);
  const lines = joins.map(([from, to]) => newLine(nextId, id(from), id(to)));
  const settings = { ...plain.settings, line: { ...plain.settings.line, appearance } };
  return { ...scene, routes: [{ ...plain, points, leadStart: id(0), lines, settings }] };
}

/** A stop, a bend, two stops, each stop labelled. */
const STOPS: readonly Place[] = [
  { x: 0.2, y: 0.7, kind: 'stop', label: 'Start' }, { x: 0.35, y: 0.3, kind: 'bend' },
  { x: 0.55, y: 0.5, kind: 'stop', label: 'Middle' }, { x: 0.8, y: 0.35, kind: 'stop', label: 'End' },
];
const ALONG = [[0, 1], [1, 2], [2, 3]] as const;

/** Each scene by the name of its golden. */
const SCENES: Record<string, () => Scene> = {
  grows: () => sceneOf(STOPS, ALONG, 'grows'),
  shrinks: () => sceneOf(STOPS, ALONG, 'shrinks'),
  trail: () => sceneOf(STOPS, ALONG, 'trail'),
  // A stop, a bend, a stop where the route forks, then a stop each way; drawn whole.
  'branch-whole': () => sceneOf([
    { x: 0.15, y: 0.5, kind: 'stop' }, { x: 0.4, y: 0.3, kind: 'bend' }, { x: 0.55, y: 0.5, kind: 'stop' },
    { x: 0.85, y: 0.3, kind: 'stop' }, { x: 0.8, y: 0.75, kind: 'stop' },
  ], [[0, 1], [1, 2], [2, 3], [2, 4]], 'whole'),
  hidden: () => sceneOf(STOPS, ALONG, 'hidden'),
};

const PICTURE = { width: 400, height: 300 };
const MOMENTS = ['the start', 'a quarter', 'the middle', 'three quarters', 'the end'];
const source = { ...PICTURE, close() {} };

/** A framing's size, read from the export module's evaluation, which the catalogue holds untyped. */
function sizeOf(framing: unknown): Size | null {
  if (typeof framing !== 'object' || framing === null || !('size' in framing)) return null;
  const { size } = framing;
  if (typeof size !== 'object' || size === null || !('width' in size) || !('height' in size)) return null;
  const { width, height } = size;
  return typeof width === 'number' && typeof height === 'number' ? { width, height } : null;
}

/**
 * The frame's size as a video export reaches it: the export module, found in the real catalogue by its id, evaluated on
 * the scene's settings. Its framing reads its own settings alone, so the moment, the content's end and the scale it is
 * handed change nothing. A failure it reports, or a framing with no size, fails the test.
 */
function frameSizeOf(scene: Scene): Size {
  const exporter = CATALOGUE.scene.find((feature) => feature.id === 'export');
  if (exporter === undefined) throw new Error('the catalogue holds no export module');
  const framing = exporter.evaluate({ settings: exporter.select(scene.settings), timeMs: 0, seed: 7, scale: 1,
    travellerAt: () => null, contentEndMs: 0 });
  if (!framing.ok) throw new Error(`the export module reports: ${framing.reason}`);
  const size = sizeOf(framing.value);
  if (size === null) throw new Error(`the export module's framing has no size: ${JSON.stringify(framing.value)}`);
  return size;
}

function request(scene: Scene, sceneMs: number): FrameRequest {
  const surface = () => ({ context: new Recorder(), image: source });
  return { scene, sceneMs, seed: 7, size: frameSizeOf(scene), image: { ...PICTURE, source }, surface };
}

/** The scene's timing as the composer hands it to every module: the content's end and the one route's timeline. */
interface Timing {
  readonly contentEndMs: number;
  readonly timeline: Timeline;
}

function timingOf(scene: Scene): Timing {
  const ends: number[] = [];
  const timelines: Timeline[] = [];
  const named = { title: 'probe', description: 'probe', group: 'core', settings: {}, select: () => ({}), end: () => null } as const;
  const sceneProbe: SceneFeature<Record<string, never>, unknown> = { ...named, id: 'probe', refersTo: () => [],
    evaluate: (input) => (ends.push(input.contentEndMs), { ok: true, value: null }) };
  const routeProbe: RouteFeature<Record<string, never>, unknown> = { ...named, id: 'probe', layers: {},
    evaluate: (input) => (timelines.push(input.route.timeline), { ok: true, value: null }) };
  compose(new Recorder(), request(scene, 0), { route: [...CATALOGUE.route, routeProbe], scene: [...CATALOGUE.scene, sceneProbe] });
  const [contentEndMs] = ends;
  const [timeline] = timelines;
  expect([ends.length, timelines.length]).toEqual([1, 1]);
  if (contentEndMs === undefined || timeline === undefined) throw new Error('the probes were not evaluated');
  return { contentEndMs, timeline };
}

/** A moment to record: its heading's name, and the scene's ms. */
interface Moment {
  readonly name: string;
  readonly sceneMs: number;
}

/** v3's label fade, TEXT_LABEL.FADE_DURATION (v3/src/config/constants.js:410), as labels/model/timing.ts ports it (D151). */
const FADE_MS = 500;

/**
 * Two moments of the stop labelled "Middle", from the scene's own timeline: halfway through its pause, and halfway
 * through its label fading in. The fade is v3's 500 ms as a share of the base timeline, the lead's walk with its pauses
 * in, so on one straight route its window is 500 ms × the walk's moving time ÷ the walk's whole time, ending at the
 * arrival; halfway through it the label is cubicOut(½) = 0.875 solid.
 */
function middleMoments(scene: Scene, { contentEndMs, timeline }: Timing): Moment[] {
  const middle = scene.routes[0]?.points.find((point) => point.label === 'Middle');
  const at = middle === undefined ? undefined : timeline.points.get(middle.id);
  const startAt = timeline.start === null ? undefined : timeline.points.get(timeline.start);
  if (at === undefined || startAt === undefined) throw new Error('grows has no stop "Middle" on its timeline');
  expect(at.departMs - at.arriveMs, 'the lead pauses at Middle').toBeGreaterThan(0);
  const movingMs = timeline.lines.reduce((sum, line) => sum + line.arriveMs - line.departMs, 0);
  const windowMs = (FADE_MS * movingMs) / (timeline.endMs - startAt.arriveMs);
  const shownAt = (contentMs: number) => Math.round(sceneTime(scene.settings.clock, contentEndMs, contentMs));
  return [
    { name: 'inside the pause at Middle', sceneMs: shownAt((at.arriveMs + at.departMs) / 2) },
    { name: 'halfway through Middle’s label fading in', sceneMs: shownAt(at.arriveMs - windowMs / 2) },
  ];
}

/** The scene drawn at its five moments and any more, each under a heading naming it, any module's report after its frame. */
function recordOf(scene: Scene, more: (scene: Scene, timing: Timing) => Moment[] = () => []): string {
  const timing = timingOf(scene);
  const length = playLength(scene.settings.clock, timing.contentEndMs);
  const shares = MOMENTS.map((name, i) => ({ name, sceneMs: Math.round((length * i) / (MOMENTS.length - 1)) }));
  const lines = [...shares, ...more(scene, timing)].flatMap(({ name, sceneMs }) => {
    const recorder = new Recorder();
    const reports = compose(recorder, request(scene, sceneMs));
    return [`# ${name}: ${sceneMs} ms of ${Math.round(length)}`, ...recorder.take(), ...reports.map((report) => `report ${JSON.stringify(report)}`)];
  });
  return `${lines.join('\n')}\n`;
}

/** The scenes recorded at more than the five moments, by name. */
const MORE: Record<string, (scene: Scene, timing: Timing) => Moment[]> = { grows: middleMoments };

test('every golden is a scene’s, and every scene has its golden', () => {
  const named = Object.keys(SCENES).map((name) => `./goldens/${name}.txt`);
  expect(Object.keys(GOLDENS).sort()).toEqual(UPDATE ? Object.keys(GOLDENS).sort() : named.sort());
});

for (const [name, make] of Object.entries(SCENES)) {
  test(`${name} draws as its golden, line for line`, async () => {
    const drawn = recordOf(make(), MORE[name]);
    const path = `./goldens/${name}.txt`;
    if (UPDATE) {
      await expect(drawn).toMatchFileSnapshot(path);
      return;
    }
    const golden = GOLDENS[path];
    expect(golden, `${path} is missing: a golden is written only on purpose (this file's heading says how)`).toBeDefined();
    expect(drawn.split('\n')).toEqual((golden ?? '').split('\n'));
  });
}
