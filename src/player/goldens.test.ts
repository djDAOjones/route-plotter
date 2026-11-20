// CORE-04 stage 7, first step: v4's own goldens. Each scene below is drawn through the real catalogue and the real
// composer, without overlays (the frame a video holds), at 1920 × 1080 (render scale 1, D126) with seed 7, at five
// moments of its length, holds included: the start, a quarter, the middle, three quarters and the end. The recorder's
// text of the five is compared line for line with `src/player/goldens/<scene>.txt`.
//
// A missing golden fails, as v3's do (v3/tests/goldenDrawLogs.test.js:128–132), and so does a golden no scene draws.
// A plain run never writes one. To regenerate them on purpose, after a change meant to change what is drawn, run
//   UPDATE_GOLDENS=1 npx vitest run src/player/goldens.test.ts --update
// and then read the diff of every golden, line by line, before committing it: a golden is only as good as that reading.
//
// The scenes are ones a v3 project can also hold (stops and bends on one picture, v3's default looks), so that each can
// be compared with v3's frame of the same scene. The hidden line in the third is v4's own: v3's editor had none.
import { expect, test } from 'vitest';
import { Recorder } from '../adapters/render/recorder';
import { playLength } from '../core/clock/clock';
import { newLine, newPoint, newRoute, newScene, type Route, type Scene } from '../core/model/scene';
import { contentEndMs } from '../core/timing/sceneLength';
import { compose, type FrameRequest } from './compose';

type Appearance = Route['settings']['line']['appearance'];
type Place = Parameters<typeof newPoint>[1] & { readonly label?: string };

const UPDATE = import.meta.env.UPDATE_GOLDENS === '1';
const GOLDENS = import.meta.glob<string>('./goldens/*.txt', { query: '?raw', import: 'default', eager: true });

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

/** A route through `places`, its lead starting at the first, a line for each pair of places `joins` names. */
function routeOf(nextId: () => string, places: readonly Place[], joins: readonly (readonly [number, number])[], appearance: Appearance): Route {
  const points = places.map(({ label = '', ...at }) => ({ ...newPoint(nextId, at), label }));
  const id = (at: number) => points[at]?.id ?? '';
  const plain = newRoute(nextId);
  const lines = joins.map(([from, to]) => newLine(nextId, id(from), id(to)));
  return { ...plain, points, leadStart: id(0), lines, settings: { ...plain.settings, line: { ...plain.settings.line, appearance } } };
}

/** A new scene, every setting at its default, holding the routes `make` builds. */
function sceneOf(make: (nextId: () => string) => Route[]): Scene {
  const nextId = counter();
  return { ...newScene(nextId), routes: make(nextId) };
}

/** Each scene by the name of its golden. Every route keeps v3's default looks but for the line's appearance named. */
const SCENES: Record<string, () => Scene> = {
  // A stop, a bend, two stops, each stop labelled; the line grows (the default).
  'one-route': () => sceneOf((nextId) => [routeOf(nextId, [
    { x: 0.2, y: 0.7, kind: 'stop', label: 'Start' }, { x: 0.35, y: 0.3, kind: 'bend' },
    { x: 0.55, y: 0.5, kind: 'stop', label: 'Middle' }, { x: 0.8, y: 0.35, kind: 'stop', label: 'End' },
  ], [[0, 1], [1, 2], [2, 3]], 'grows')]),
  // Three routes of a stop, a bend and a stop, one above another: the line whole, shrinking, a trail.
  'three-looks': () => sceneOf((nextId) => (['whole', 'shrinks', 'trail'] as const).map((appearance, i) => routeOf(nextId, [
    { x: 0.15, y: 0.25 + i * 0.25, kind: 'stop' }, { x: 0.5, y: 0.15 + i * 0.25, kind: 'bend' }, { x: 0.85, y: 0.25 + i * 0.25, kind: 'stop' },
  ], [[0, 1], [1, 2]], appearance))),
  // A route that forks at its third place (a stop, a bend, a stop, then two stops, one each way), drawn whole; below
  // it a route of two stops whose line is hidden (v4's own), so only its lead and markers show.
  'branch-and-hidden': () => sceneOf((nextId) => [
    routeOf(nextId, [
      { x: 0.15, y: 0.5, kind: 'stop' }, { x: 0.4, y: 0.3, kind: 'bend' }, { x: 0.55, y: 0.5, kind: 'stop' },
      { x: 0.85, y: 0.3, kind: 'stop' }, { x: 0.8, y: 0.75, kind: 'stop' },
    ], [[0, 1], [1, 2], [2, 3], [2, 4]], 'whole'),
    routeOf(nextId, [{ x: 0.1, y: 0.9, kind: 'stop' }, { x: 0.45, y: 0.85, kind: 'stop' }], [[0, 1]], 'hidden'),
  ]),
};

const PICTURE = { width: 400, height: 300 };
const MOMENTS = ['the start', 'a quarter', 'the middle', 'three quarters', 'the end'];
const source = { ...PICTURE, close() {} };

function request(scene: Scene, sceneMs: number): FrameRequest {
  const surface = () => ({ context: new Recorder(), image: source });
  return { scene, sceneMs, seed: 7, size: { width: 1920, height: 1080 }, image: { ...PICTURE, source }, surface };
}

/** The scene drawn at its five moments, each under a heading naming it, any module's report after its frame. */
function recordOf(scene: Scene): string {
  const length = playLength(scene.settings.clock, contentEndMs(scene, PICTURE.width / PICTURE.height));
  const lines = MOMENTS.flatMap((moment, i) => {
    const sceneMs = Math.round((length * i) / (MOMENTS.length - 1));
    const recorder = new Recorder();
    const reports = compose(recorder, request(scene, sceneMs));
    return [`# ${moment}: ${sceneMs} ms of ${Math.round(length)}`, ...recorder.take(), ...reports.map((report) => `report ${JSON.stringify(report)}`)];
  });
  return `${lines.join('\n')}\n`;
}

test('every golden is a scene’s, and every scene has its golden', () => {
  const named = Object.keys(SCENES).map((name) => `./goldens/${name}.txt`);
  expect(Object.keys(GOLDENS).sort()).toEqual(UPDATE ? Object.keys(GOLDENS).sort() : named.sort());
});

for (const [name, make] of Object.entries(SCENES)) {
  test(`${name} draws as its golden, line for line`, async () => {
    const drawn = recordOf(make());
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
