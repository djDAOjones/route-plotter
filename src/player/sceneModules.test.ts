// CORE-04: the scene's core modules (background, clock, export settings), drawn through the one composer and the real
// catalogue, and recorded. Each test's name is a line the item holds; v3's numbers are worked beside each.
import { describe, expect, test } from 'vitest';
import { Recorder } from '../adapters/render/recorder';
import type { Evaluation } from '../core/feature/contract';
import { imageToCanvas } from '../core/geometry/transform';
import { aspectOf } from '../core/geometry/units';
import { newLine, newPoint, newRoute, newScene, type Scene } from '../core/model/scene';
import { contentEndMs, sceneLength } from '../core/timing/sceneLength';
import type { Fields } from '../core/schema/field';
import { CATALOGUE, type Catalogue, type SceneFeature } from '../features/catalogue';
import { compose, type FrameRequest } from './compose';

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

/** A scene with one route of two stops, so its content has a length of its own. */
function sceneWith(change: (settings: Scene['settings']) => void = () => undefined): Scene {
  const nextId = counter();
  const scene = newScene(nextId);
  const a = newPoint(nextId, { x: 0.2, y: 0.2, kind: 'stop' });
  const b = newPoint(nextId, { x: 0.8, y: 0.8, kind: 'stop' });
  const route = { ...newRoute(nextId), points: [a, b], lines: [newLine(nextId, a.id, b.id)], leadStart: a.id };
  change(scene.settings);
  return { ...scene, routes: [route] };
}

// A browser image stands in by its shape: an ImageBitmap is its size and a close().
const source = { width: 400, height: 300, close() {} };
const IMAGE = { width: 400, height: 300, source };

function request(scene: Scene, extra: Partial<FrameRequest> = {}): FrameRequest {
  const surface = () => ({ context: new Recorder(), image: source });
  return { scene, sceneMs: 1000, seed: 7, size: { width: 1920, height: 1080 }, image: IMAGE, surface, ...extra };
}

function draw(ask: FrameRequest, catalogue: Catalogue = CATALOGUE) {
  const recorder = new Recorder();
  const reports = compose(recorder, ask, catalogue);
  return { lines: recorder.take(), reports };
}

const drawn = (lines: readonly string[], call: string) => lines.filter((line) => line.startsWith(`${call} `));

type Listed = SceneFeature<Fields, unknown>;

/** A scene module as the catalogue lists it: a test reaches a module only there, as the composer does. */
function listed(id: string): Listed {
  const feature = CATALOGUE.scene.find((each) => each.id === id);
  if (feature === undefined) throw new Error(`no scene module ${id}`);
  return feature;
}

/** The same module, its evaluations kept as they are given. */
function kept(feature: Listed, seen: Evaluation<unknown>[]): Listed {
  return {
    ...feature,
    evaluate: (input) => {
      const result = feature.evaluate(input);
      seen.push(result);
      return result;
    },
  };
}

const background = listed('background');
const CLOCK = listed('clock');
const EXPORT = listed('export');

describe('the scene’s core modules', () => {
  test('Show image off draws no image, on draws it, with no knowledge of who asks', () => {
    const extras: Partial<FrameRequest>[] = [{}, { viewing: { zoom: 2, panX: 4, panY: 4 }, overlays: [() => undefined] }];
    for (const extra of extras) {
      const on = draw(request(sceneWith(), extra)).lines;
      expect(drawn(on, 'drawImage')).toHaveLength(1);
      expect(drawn(on, 'drawImage')[0]).toMatch(/^drawImage image\(400x300\) 240 0 1440 1080 /);
      // The white margin about it fills the frame (v3's RenderingService.js:1198).
      expect(drawn(on, 'fillRect')[0]).toBe('fillRect 0 0 1920 1080 | @ 1 0 0 1 0 0 | fillStyle=#ffffff');
      const off = draw(request(sceneWith((settings) => (settings.background.showImage = false)), extra)).lines;
      expect(drawn(off, 'drawImage')).toHaveLength(0);
      expect(drawn(off, 'fillRect')).toHaveLength(0);
    }
    // Without a picture from the caller, nothing is drawn, and the scene still measures by the image's size.
    expect(drawn(draw(request(sceneWith(), { image: { width: 400, height: 300 } })).lines, 'drawImage')).toHaveLength(0);
  });

  test('the tint darkens below 0 and lightens above it over the picture alone, its cover capped at 60%, as v3’s', () => {
    const tinted = (tint: number) =>
      drawn(draw(request(sceneWith((settings) => (settings.background.tint = tint)))).lines, 'fillRect').slice(1);
    // v3's renderOverlay: alpha min(|tint|, 60) / 100, black below 0, white above, over the image's rectangle.
    expect(tinted(-50)).toEqual(['fillRect 240 0 1440 1080 | @ 1 0 0 1 0 0 | fillStyle=#000 globalAlpha=0.5']);
    expect(tinted(80)).toEqual(['fillRect 240 0 1440 1080 | @ 1 0 0 1 0 0 | fillStyle=#fff globalAlpha=0.6']);
    expect(tinted(-100)).toEqual(['fillRect 240 0 1440 1080 | @ 1 0 0 1 0 0 | fillStyle=#000 globalAlpha=0.6']);
    expect(tinted(0)).toEqual([]);
  });

  test('the zoom places the picture and the routes on it together, as v3’s imageRect and coordinate transform do, and leaves sizes alone', () => {
    // v3: min(1920 / 400, 1080 / 300) × 2 = 7.2, so 2880 × 2160 about the frame's centre, at (−480, −540).
    const at = { x: 0.5, y: 0.25 };
    const route = {
      id: 'mark', title: 'mark', description: 'mark', group: 'core' as const, settings: {}, select: () => ({}),
      evaluate: () => ({ ok: true as const, value: null }), end: () => null,
      layers: { lines: (context: Recorder, _value: unknown, frame: { bounds: Parameters<typeof imageToCanvas>[0] }) => {
        const point = imageToCanvas(frame.bounds, at);
        context.fillText('stop', point.x, point.y);
      } },
    };
    const zoomed = draw(request(sceneWith((settings) => (settings.background.zoom = 200))), { route: [route], scene: [background] });
    expect(drawn(zoomed.lines, 'drawImage')[0]).toMatch(/^drawImage image\(400x300\) -480 -540 2880 2160 \| @ 1 0 0 1 0 0/);
    // The stop stays on the same spot of the picture: v3's imageToCanvas, 0.5 × 2880 − 480 and 0.25 × 2160 − 540.
    expect(drawn(zoomed.lines, 'fillText')).toEqual(['fillText "stop" 960 0 | @ 1 0 0 1 0 0']);
    // Hidden, the picture is still placed, so the route stays where it was (v3's UI-08).
    const hidden = draw(
      request(sceneWith((settings) => Object.assign(settings.background, { zoom: 200, showImage: false }))),
      { route: [route], scene: [background] },
    );
    expect(drawn(hidden.lines, 'fillText')).toEqual(['fillText "stop" 960 0 | @ 1 0 0 1 0 0']);
  });

  test('the clock’s end agrees with the core’s own for “from content” and for “fixed”, Holds included', () => {
    const cases: ((settings: Scene['settings']) => void)[] = [
      (settings) => Object.assign(settings.clock, { holdAtStartMs: 500, holdAtEndMs: 1500 }),
      (settings) => Object.assign(settings.clock, { length: 'fixed', fixedLengthMs: 7000, holdAtStartMs: 300 }),
    ];
    for (const change of cases) {
      const scene = sceneWith(change);
      const seen: Evaluation<unknown>[] = [];
      expect(draw(request(scene), { route: [], scene: [kept(CLOCK, seen)] }).reports).toEqual([]);
      const aspect = aspectOf(IMAGE);
      expect(seen).toEqual([{
        ok: true,
        value: {
          lengthMs: sceneLength(scene, aspect),
          contentEndMs: contentEndMs(scene, aspect),
          holdAtStartMs: scene.settings.clock.holdAtStartMs,
          holdAtEndMs: scene.settings.clock.holdAtEndMs,
        },
      }]);
    }
    const fromContent = sceneWith((settings) => Object.assign(settings.clock, { holdAtStartMs: 500, holdAtEndMs: 1500 }));
    expect(sceneLength(fromContent, aspectOf(IMAGE))).toBe(500 + contentEndMs(fromContent, aspectOf(IMAGE)) + 1500);
  });

  test('the export module gives the frame’s size and aspect from its settings', () => {
    const settings = { width: 1280, height: 720, frameRate: 30 };
    expect(EXPORT.evaluate({ settings, timeMs: 0, seed: 0, scale: 1, travellerAt: () => null, contentEndMs: 0 })).toEqual({
      ok: true,
      value: { size: { width: 1280, height: 720 }, aspect: 0.5625, frameRate: 30 },
    });
    const seen: Evaluation<unknown>[] = [];
    draw(request(sceneWith((each) => Object.assign(each.export, { width: 1080, height: 1920 }))), { route: [], scene: [kept(EXPORT, seen)] });
    expect(seen[0]).toEqual({ ok: true, value: { size: { width: 1080, height: 1920 }, aspect: 1920 / 1080, frameRate: 25 } });
  });

  test('one of the three failing is reported, never thrown, and the other two still do their work', () => {
    const scene = sceneWith((settings) => (settings.background.tint = -50));
    const broken = { ...CLOCK, evaluate: (): never => { throw new Error('the clock broke'); } };
    const clocks: Evaluation<unknown>[] = [];
    const exports: Evaluation<unknown>[] = [];
    const { lines, reports } = draw(request(scene), { route: [], scene: [background, broken, kept(EXPORT, exports)] });
    expect(reports).toEqual([{ routeId: null, featureId: 'clock', reason: 'the clock broke' }]);
    expect(drawn(lines, 'drawImage')).toHaveLength(1);
    expect(drawn(lines, 'fillRect')).toHaveLength(2);
    expect(exports).toEqual([{ ok: true, value: { size: { width: 1920, height: 1080 }, aspect: 0.5625, frameRate: 25 } }]);
    // A failing background is reported too; the picture is then placed at 100% and nothing of it is drawn.
    const noBackground = { ...background, evaluate: (): never => { throw new Error('the background broke'); } };
    const second = draw(request(scene), { route: [], scene: [noBackground, kept(CLOCK, clocks)] });
    expect(second.reports).toEqual([{ routeId: null, featureId: 'background', reason: 'the background broke' }]);
    expect(drawn(second.lines, 'drawImage')).toHaveLength(0);
    expect(clocks).toHaveLength(1);
    expect(clocks[0]?.ok).toBe(true);
  });

  test('with the three real modules listed, the same time, state and seed give the same frame, line for line', () => {
    expect(CATALOGUE.scene.map((feature) => feature.id)).toEqual(['background', 'clock', 'export']);
    const scene = sceneWith((settings) => Object.assign(settings.background, { tint: 40, zoom: 150 }));
    const first = draw(request(scene));
    expect(first.reports).toEqual([]);
    expect(draw(request(structuredClone(scene))).lines).toEqual(first.lines);
    expect(drawn(first.lines, 'drawImage')).toHaveLength(1);
    const lighter = sceneWith((settings) => Object.assign(settings.background, { tint: 41, zoom: 150 }));
    expect(draw(request(lighter)).lines).not.toEqual(first.lines);
  });
});
