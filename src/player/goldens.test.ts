// CORE-04 stage 7, first step: v4's own goldens. Each scene below is drawn through the real catalogue and the real
// composer, without overlays (the frame a video holds), at the scene's export size (1920 × 1080 by default, so the render
// scale is 1, D126) with seed 7, at five moments of its length as the composer measures it, holds included: the start,
// a quarter, the middle, three quarters and the end. The recorder's text of the five is compared line for line with
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
import { playLength } from '../core/clock/clock';
import { newLine, newPoint, newRoute, newScene, type Route, type Scene } from '../core/model/scene';
import { CATALOGUE, type SceneFeature } from '../features/catalogue';
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

function request(scene: Scene, sceneMs: number): FrameRequest {
  const surface = () => ({ context: new Recorder(), image: source });
  const size = { width: scene.settings.export.width, height: scene.settings.export.height };
  return { scene, sceneMs, seed: 7, size, image: { ...PICTURE, source }, surface };
}

/** The scene's length, holds included, from the content's end as the composer hands it to every scene module. */
function lengthOf(scene: Scene): number {
  const ends: number[] = [];
  const probe: SceneFeature<Record<string, never>, unknown> = { id: 'probe', title: 'probe', description: 'probe', group: 'core',
    settings: {}, select: () => ({}), evaluate: (input) => (ends.push(input.contentEndMs), { ok: true, value: null }), end: () => null, refersTo: () => [] };
  compose(new Recorder(), request(scene, 0), { ...CATALOGUE, scene: [...CATALOGUE.scene, probe] });
  expect(ends).toHaveLength(1);
  return playLength(scene.settings.clock, ends[0] ?? 0);
}

/** The scene drawn at its five moments, each under a heading naming it, any module's report after its frame. */
function recordOf(scene: Scene): string {
  const length = lengthOf(scene);
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
