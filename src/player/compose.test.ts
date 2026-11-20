// CORE-04: the composer, tested with fake modules through the draw recorder. Each test's name is a line the item holds.
import { describe, expect, test } from 'vitest';
import type { DrawContext } from '../adapters/render/context';
import type { Drawings, Frame } from '../adapters/render/layers';
import { Recorder } from '../adapters/render/recorder';
import type { Evaluation, RouteInput, SceneInput, View } from '../core/feature/contract';
import { newLine, newPoint, newRoute, newScene, type Route, type Scene } from '../core/model/scene';
import type { Catalogue, RouteFeature, SceneFeature } from '../features/catalogue';
import { compose, type FrameRequest, type Surface } from './compose';

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

function twoStopRoute(nextId: () => string, x: number): Route {
  const a = newPoint(nextId, { x, y: 0.2, kind: 'stop' });
  const b = newPoint(nextId, { x, y: 0.8, kind: 'stop' });
  return { ...newRoute(nextId), points: [a, b], lines: [newLine(nextId, a.id, b.id)], leadStart: a.id };
}

function sceneOf(routes: number): Scene {
  const nextId = counter();
  const scene = newScene(nextId);
  return { ...scene, routes: Array.from({ length: routes }, (_, i) => twoStopRoute(nextId, 0.2 + i * 0.3)) };
}

type Draw = (context: DrawContext, value: unknown, frame: Frame) => void;

/** A fake route module: by default it evaluates to its time and seed, which `tag` writes in each layer it is given. */
function routeModule(
  id: string,
  layers: Partial<Record<keyof Drawings<unknown>, Draw>>,
  evaluate: (input: RouteInput<unknown>) => Evaluation<unknown> = (input) => ({ ok: true, value: `t=${input.timeMs} seed=${input.seed}` }),
): RouteFeature<Record<string, never>, unknown> {
  return {
    id,
    title: id,
    description: id,
    group: 'core',
    settings: {},
    select: () => ({}),
    evaluate: (input) => evaluate(input),
    end: () => null,
    layers,
  };
}

function sceneModule(id: string, extra: Partial<SceneFeature<Record<string, never>, unknown>>): SceneFeature<Record<string, never>, unknown> {
  return {
    id,
    title: id,
    description: id,
    group: 'core',
    settings: {},
    select: () => ({}),
    evaluate: (input: SceneInput<unknown>) => ({ ok: true, value: input }),
    end: () => null,
    refersTo: () => [],
    ...extra,
  };
}

const tag = (name: string): Draw => (context, value) => {
  context.fillText(`${name} ${typeof value === 'string' ? value : ''}`, 0, 0);
};

const image = { width: 400, height: 300, close() {} };
const blank = (): Surface & { recorder: Recorder } => {
  const recorder = new Recorder();
  return { recorder, context: recorder, image };
};

function request(scene: Scene, extra: Partial<FrameRequest> = {}): FrameRequest {
  return { scene, sceneMs: 1000, seed: 7, size: { width: 1920, height: 1080 }, image: { width: 400, height: 300 }, surface: blank, ...extra };
}

function draw(catalogue: Catalogue, ask: FrameRequest) {
  const recorder = new Recorder();
  const reports = compose(recorder, ask, catalogue);
  return { lines: recorder.take(), reports };
}

const texts = (lines: readonly string[]) => lines.filter((line) => line.startsWith('fillText')).map((line) => line.split(' | ')[0] ?? '');

describe('compose', () => {
  test('nothing in the composer knows whether the preview, the video export or the player is asking', () => {
    // What it is asked with names no asker: a field added to the request fails to compile here.
    const asked: Record<keyof FrameRequest, true> = {
      scene: true, sceneMs: true, seed: true, size: true, image: true, surface: true, viewing: true, overlays: true,
      images: true,
    };
    expect(Object.keys(asked)).toHaveLength(9);
    // What it gives each module names none either, whether the frame has a further zoom and overlays or not.
    const given: string[][] = [];
    const catalogue = {
      route: [routeModule('r', {}, (input) => (given.push(Object.keys(input).sort(), Object.keys(input.route.shape).sort()), { ok: true, value: null }))],
      scene: [sceneModule('s', { evaluate: (input) => (given.push(Object.keys(input).sort()), { ok: true, value: null }) })],
    };
    draw(catalogue, request(sceneOf(1), { viewing: { zoom: 2, panX: 5, panY: 5 }, overlays: [() => undefined] }));
    draw(catalogue, request(sceneOf(1)));
    const route = ['lead', 'route', 'scale', 'seed', 'settings', 'timeMs'];
    const shape = ['leadStart', 'lines', 'marks', 'points'];
    const scene = ['contentEndMs', 'scale', 'seed', 'settings', 'timeMs', 'travellerAt'];
    expect(given).toEqual([route, shape, scene, route, shape, scene]);
  });

  test('the same time, state and seed give the same frame, line for line', () => {
    const catalogue = { route: [routeModule('a', { lines: tag('a') }), routeModule('b', { markers: tag('b') })], scene: [] };
    const scene = sceneOf(2);
    const first = draw(catalogue, request(scene));
    const again = draw(catalogue, request(structuredClone(scene)));
    expect(again.lines).toEqual(first.lines);
    expect(texts(first.lines)).toHaveLength(4);
    expect(draw(catalogue, request(scene, { seed: 8 })).lines).not.toEqual(first.lines);
    expect(draw(catalogue, request(scene, { sceneMs: 2000 })).lines).not.toEqual(first.lines);
  });

  test('a module whose evaluation fails or throws draws nothing that frame, its report is passed on, and every other module still draws', () => {
    const catalogue = {
      route: [
        routeModule('fails', { lines: tag('fails') }, () => ({ ok: false, reason: 'no shape to draw' })),
        routeModule('throws', { lines: tag('throws') }, () => {
          throw new Error('broken');
        }),
        routeModule('draws', { lines: tag('draws') }),
        routeModule('drawFails', {
          lines: () => {
            throw new Error('mid-draw');
          },
          labels: tag('drawFails'),
        }),
      ],
      scene: [],
    };
    const scene = sceneOf(1);
    const routeId = scene.routes[0]?.id ?? '';
    const { lines, reports } = draw(catalogue, request(scene));
    expect(texts(lines).map((text) => text.split(' ')[1] ?? '')).toEqual(['"draws']);
    expect(reports).toEqual([
      { routeId, featureId: 'fails', reason: 'no shape to draw' },
      { routeId, featureId: 'throws', reason: 'broken' },
      { routeId, featureId: 'drawFails', reason: 'mid-draw' },
    ]);
    expect(lines.at(-1)).toMatch(/^restore/);
  });

  test('layers are drawn in P4’s order; within one, routes in list order and modules in catalogue order', () => {
    const catalogue = {
      route: [routeModule('x', { labels: tag('x-labels'), lines: tag('x-lines') }), routeModule('y', { lines: tag('y-lines') })],
      scene: [sceneModule('bg', { layers: { background: (context) => context.fillText('bg', 0, 0) } })],
    };
    const order = texts(draw(catalogue, request(sceneOf(2))).lines).map((text) => text.split(' ')[1] ?? '');
    expect(order).toEqual(['"bg"', '"x-lines', '"y-lines', '"x-lines', '"y-lines', '"x-labels', '"x-labels']);
  });

  test('the background is drawn through the mask when a module drew into it, and whole when none did', () => {
    const shown = (label: string) => (context: DrawContext) => context.fillText(label, 0, 0);
    const mask = blank();
    const masked = {
      route: [routeModule('reveal', { backgroundMask: shown('uncovered') })],
      scene: [sceneModule('bg', { layers: { background: shown('bg') } })],
    };
    const { lines } = draw(masked, request(sceneOf(1), { surface: () => mask }));
    expect(texts(mask.recorder.take())).toEqual(['fillText "uncovered" 0 0']);
    const through = lines.findIndex((line) => line.startsWith('drawImage image(400x300) 0 0 1920 1080'));
    expect(through).toBeGreaterThan(lines.findIndex((line) => line.startsWith('fillText "bg"')));
    expect(lines[through]).toMatch(/@ 1 0 0 1 0 0 .*globalCompositeOperation=destination-in/);

    const whole = { route: [], scene: masked.scene };
    const surfaces: Surface[] = [];
    const plain = draw(whole, request(sceneOf(1), { surface: () => (surfaces.push(blank()), blank()) }));
    expect(surfaces).toHaveLength(0);
    expect(plain.lines.some((line) => line.startsWith('drawImage'))).toBe(false);
  });

  test('every picture in a frame is smoothed as v3’s (imageSmoothingQuality high), and the caller’s context is left as it was', () => {
    const picture = (context: DrawContext) => context.drawImage(image, 0, 0, 40, 30);
    const catalogue = { route: [], scene: [sceneModule('bg', { layers: { background: picture } })] };
    const recorder = new Recorder();
    recorder.imageSmoothingEnabled = false;
    const before = recorder.state();
    compose(recorder, request(sceneOf(1)), catalogue);
    const drawn = recorder.take().filter((line) => line.startsWith('drawImage'));
    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toMatch(/^drawImage image\(400x300\) 0 0 40 30 \| @ [^|]+ \| imageSmoothingQuality=high$/);
    expect(recorder.state()).toEqual(before);
    expect([recorder.imageSmoothingEnabled, recorder.imageSmoothingQuality]).toEqual([false, 'low']);
  });

  test('the scene’s view and the further zoom and pan are one transform; the overlays come last, in screen space', () => {
    const camera: View = { centre: { x: 0.5, y: 0.5 }, zoom: 2 };
    const catalogue = {
      route: [routeModule('line', { lines: (context, _value, frame) => context.fillText(`line ${JSON.stringify(frame.view)}`, 0, 0) })],
      scene: [sceneModule('camera', { view: () => camera })],
    };
    const viewing = { zoom: 1.5, panX: 10, panY: -20 };
    const overlay = (context: DrawContext) => context.fillText('ring', 0, 0);
    const { lines } = draw(catalogue, request(sceneOf(1), { viewing, overlays: [overlay] }));
    const drawn = lines.filter((line) => line.startsWith('fillText'));
    // The picture's centre is the frame's (960, 540): zoom 3 about it, then the pan.
    expect(drawn[0]).toContain('| @ 3 0 0 3 -1910 -1100');
    expect(drawn[0]).toContain(JSON.stringify(JSON.stringify(camera)).slice(1, -1));
    expect(drawn[1]).toBe('fillText "ring" 0 0 | @ 1 0 0 1 0 0');
    expect(lines.slice(lines.indexOf(drawn[1] ?? '') + 1).every((line) => /^(beginPath|restore)\b/.test(line))).toBe(true);
  });

  test('every view and placement offered is asked for: the first given is kept, and a later one that throws is reported', () => {
    const catalogue = {
      route: [routeModule('line', { lines: (context, _value, frame) => context.fillText(`zoom${frame.view?.zoom} width${frame.bounds.width}`, 0, 0) })],
      scene: [
        sceneModule('a', { view: () => ({ centre: { x: 0.5, y: 0.5 }, zoom: 2 }), placement: () => 2 }),
        sceneModule('b', { view: () => { throw new Error('no view'); }, placement: () => { throw new Error('no placement'); } }),
      ],
    };
    const { lines, reports } = draw(catalogue, request(sceneOf(1)));
    expect(reports).toEqual([
      { routeId: null, featureId: 'b', reason: 'no view' },
      { routeId: null, featureId: 'b', reason: 'no placement' },
    ]);
    // 400 × 300 fitted to 1920 × 1080 is 1440 wide; placed at 2, 2880.
    expect(texts(lines)[0]).toContain('zoom2 width2880');
  });

  test('an export frame holds no overlay: with none in the request, none is drawn', () => {
    const catalogue = { route: [routeModule('line', { lines: tag('line') })], scene: [] };
    const scene = sceneOf(1);
    const exported = draw(catalogue, request(scene)).lines;
    const edited = draw(catalogue, request(scene, { overlays: [(context) => context.fillText('ring', 0, 0)] })).lines;
    expect(exported.some((line) => line.includes('"ring"'))).toBe(false);
    expect(edited.slice(0, exported.length)).toEqual(exported);
  });

  test('a scene module is told where only the travellers it declared are', () => {
    const seen: (string | null)[] = [];
    const lead = routeModule('lead', {});
    const follower = sceneModule('follower', {
      refersTo: () => [{ routeId: scene.routes[0]?.id ?? '', featureId: 'lead' }],
      evaluate: (input) => {
        for (const featureId of ['lead', 'other']) {
          const at = input.travellerAt({ routeId: scene.routes[0]?.id ?? '', featureId }, input.timeMs);
          seen.push(at === null ? null : `${at.x},${at.y}`);
        }
        return { ok: true, value: null };
      },
    });
    const scene = sceneOf(1);
    const withTraveller = { ...lead, traveller: { positionAt: () => ({ x: 0.25, y: 0.75 }) } };
    draw({ route: [withTraveller, routeModule('other', {})], scene: [follower] }, request(scene));
    expect(seen).toEqual(['0.25,0.75', null]);
  });
});
