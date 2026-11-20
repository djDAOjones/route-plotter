// CORE-04 stage 6: the editor's overlays' makers are handed ids and read each route from the frame they draw over
// (Screen.routes: the shape and timeline every module saw, and the settings the frame's scene holds). One overlay,
// made once, drawn over two frames whose scenes differ in a route's settings, follows each frame.
import { expect, test } from 'vitest';
import { Recorder } from '../adapters/render/recorder';
import { newLine, newPoint, newRoute, newScene, type Route, type Scene } from '../core/model/scene';
import type { Overlay } from '../adapters/render/overlays';
import { OVERLAY_MAKERS } from '../features/catalogue.editor';
import { compose, type FrameRequest } from './compose';

type Settings = Route['settings'];

/** One route of a stop, a bend and two stops, walked in 10 s, its settings changed by `change`. */
function sceneOf(change: (settings: Settings) => Settings = (settings) => settings): Scene {
  let n = 0;
  const nextId = () => `id${++n}`;
  const scene = newScene(nextId);
  const places = [[0.25, 0.5, 'stop'], [0.4, 0.3, 'bend'], [0.6, 0.55, 'stop'], [0.8, 0.4, 'stop']] as const;
  const points = places.map(([x, y, kind]) => newPoint(nextId, { x, y, kind }));
  const ids = points.map((point) => point.id);
  const plain = newRoute(nextId);
  const lead = { ...plain.settings.lead, timing: 'total time', totalTimeMs: 10_000, startsAtMs: 0 } as const;
  const lines = ids.slice(1).map((to, i) => newLine(nextId, ids[i] ?? '', to));
  const route = { ...plain, points, leadStart: ids[0] ?? '', lines, settings: change({ ...plain.settings, lead }) };
  return { ...scene, routes: [route] };
}

const source = { width: 400, height: 300, close() {} };

/** The lines an overlay adds to the frame of `scene` (that frame drawn without it is their beginning). */
function added(scene: Scene, overlay: Overlay): string[] {
  const request = (overlays?: readonly Overlay[]): FrameRequest => ({
    scene, sceneMs: 4_000, seed: 7, size: { width: 1920, height: 1080 }, overlays,
    image: { width: 400, height: 300, source }, surface: () => ({ context: new Recorder(), image: source }),
  });
  const draw = (ask: FrameRequest) => {
    const recorder = new Recorder();
    expect(compose(recorder, ask)).toEqual([]);
    return recorder.take();
  };
  const plain = draw(request());
  const edited = draw(request([overlay]));
  expect(edited.slice(0, plain.length)).toEqual(plain);
  return edited.slice(plain.length);
}

const withLine = (appearance: Settings['line']['appearance']) => (settings: Settings) => ({ ...settings, line: { ...settings.line, appearance } });
const withSize = (size: number) => (settings: Settings) => ({ ...settings, markers: { ...settings.markers, size } });
/** What an overlay draws: the composer's own save and restore round it are not drawing. */
const drawn = (lines: readonly string[]) => lines.filter((line) => /^(moveTo|lineTo|arc|stroke|fill|strokeRect)\b/.test(line));
const guides = (lines: readonly string[]) => lines.filter((line) => line.startsWith('stroke ') && /lineDash=/.test(line));
/** The radius of each arc, on screen (the recorder writes the transform beside it; the overlays draw unmoved). */
const radii = (lines: readonly string[]) => lines.filter((line) => line.startsWith('arc ')).map((line) => Number(line.split(' ')[3]));

test('the lines’ overlay, made once from ids, draws a guide in the frame whose route is hidden and none where it shows', () => {
  const hidden = sceneOf(withLine('hidden'));
  const shown = sceneOf(withLine('whole'));
  expect(hidden.routes[0]?.id).toBe(shown.routes[0]?.id);
  const overlay = OVERLAY_MAKERS.lines(hidden.routes.map((route) => route.id));
  expect(guides(added(hidden, overlay))).toHaveLength(1);
  expect(drawn(added(shown, overlay))).toEqual([]);
  // A route named twice is drawn once; an id the frame does not hold draws nothing.
  const id = hidden.routes[0]?.id ?? '';
  expect(added(hidden, OVERLAY_MAKERS.lines([id, id]))).toEqual(added(hidden, overlay));
  expect(drawn(added(hidden, OVERLAY_MAKERS.lines(['no-such-route', `${id}-elsewhere`])))).toEqual([]);
});

test('the points’ overlay, made once from ids, rings a selected stop round its marker as each frame sizes it', () => {
  const small = sceneOf(withSize(8));
  const large = sceneOf(withSize(16));
  const route = small.routes[0];
  const id = route?.id ?? '';
  const selected = [{ routeId: id, pointId: route?.points[0]?.id ?? '' }];
  const overlay = OVERLAY_MAKERS.points([id], { selected });
  // At 1080p and a zoom of 1 a marker of size s is s across its half on screen; v3's ring is that + 4 (:2465–2486),
  // drawn in its two strokes; the bend's grey dot is 4.
  const ring = (lines: readonly string[]) => radii(lines).filter((radius) => radius > 5);
  expect(ring(added(small, overlay))).toEqual([12, 12]);
  expect(ring(added(large, overlay))).toEqual([20, 20]);
  // A route named twice is drawn once; an id the frame does not hold draws nothing.
  expect(added(small, OVERLAY_MAKERS.points([id, id], { selected }))).toEqual(added(small, overlay));
  expect(drawn(added(small, OVERLAY_MAKERS.points(['no-such-route'], { selected: [{ routeId: 'no-such-route', pointId: 'x' }] })))).toEqual([]);
});
