// CORE-04: the one composer (the plan's §8, four stages), shared by every frame that is drawn. It is given the scene,
// a time, a seed, the frame's size and a few neutral extras (a further zoom and pan, overlays, a blank surface); it
// is never told who asks, so whoever does gets the same picture of the same moment. A frame is a function of the
// time, the scene and the seed: no clock is read, nothing random is drawn, nothing is kept from an earlier frame.
// A module whose evaluation fails or throws draws nothing that frame; its report is passed on, never thrown.
import { isolated, type DrawContext } from '../adapters/render/context';
import { LAYERS, type Drawings, type Frame, type Layer } from '../adapters/render/layers';
import { renderScale } from '../adapters/render/scale';
import { contentTime } from '../core/clock/clock';
import type { Evaluation, TravellerRef, View } from '../core/feature/contract';
import { imageBounds, imageToCanvas, type Size } from '../core/geometry/transform';
import { aspectOf, type ImagePoint } from '../core/geometry/units';
import type { Scene } from '../core/model/scene';
import { contentEndMs, type Part } from '../core/timing/sceneLength';
import { composeTimeline, leadAt } from '../core/timing/timeline';
import { CATALOGUE, type Catalogue } from '../features/catalogue';

/** A blank surface the frame's size, and the same surface as an image to draw from: the background mask's. */
export interface Surface {
  readonly context: DrawContext;
  readonly image: CanvasImageSource;
}

/** A further zoom about the frame's centre, then a pan in canvas pixels, after the scene's own view. */
interface Viewing {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

/** A drawing over the finished frame, in screen space. */
type Overlay = (context: DrawContext, frame: Frame) => void;

export interface FrameRequest {
  readonly scene: Scene;
  /** The scene's time, holds included (src/core/clock). */
  readonly sceneMs: number;
  readonly seed: number;
  /** The frame in canvas pixels. */
  readonly size: Size;
  /** The background image's size; with none, the scene measures as a square. */
  readonly image: Size | null;
  readonly surface: (size: Size) => Surface;
  readonly viewing?: Viewing;
  readonly overlays?: readonly Overlay[];
}

/** A module that drew nothing this frame, and why. */
export interface FrameReport {
  readonly routeId: string | null;
  readonly featureId: string;
  readonly reason: string;
}

interface Evaluated {
  readonly routeId: string | null;
  readonly featureId: string;
  readonly layers: Drawings<unknown> | undefined;
  readonly value: unknown;
}

const SQUARE: Size = { width: 1, height: 1 };
const NO_VIEWING: Viewing = { zoom: 1, panX: 0, panY: 0 };

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function attempt<R>(run: () => Evaluation<R>): Evaluation<R> {
  try {
    return run();
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
}

/** `hash(seed, route, module)` by FNV-1a: each module's own seed, the same every frame. */
function seedFor(seed: number, routeId: string, featureId: string): number {
  let hash = 0x811c9dc5;
  for (const char of `${seed}\u0000${routeId}\u0000${featureId}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const sound = (n: number, least: number): boolean => Number.isFinite(n) && n > least;

/** Draw the scene at its time onto `context`; returns what could not be drawn. */
export function compose(context: DrawContext, request: FrameRequest, catalogue: Catalogue = CATALOGUE): FrameReport[] {
  const { scene, size } = request;
  const reports: FrameReport[] = [];
  const fail = (routeId: string | null, featureId: string, reason: string) => reports.push({ routeId, featureId, reason });
  const aspect = aspectOf(request.image);
  const scale = renderScale(size, scene.settings.graphics.scale);
  const bounds = imageBounds(size, request.image ?? SQUARE, 1);

  // 1. Routes: each route's view, then its modules in catalogue order, first for their ends (the content's length).
  const routes = scene.routes.map((route) => {
    const timeline = composeTimeline(route, aspect);
    const shape = { points: route.points, lines: route.lines, leadStart: route.leadStart, marks: route.marks };
    const view = { shape, timeline };
    const modules = catalogue.route.flatMap((feature) => {
      const basis = attempt(() => {
        const settings = feature.select(route.settings);
        return { ok: true, value: { settings, route: view, seed: seedFor(request.seed, route.id, feature.id), scale } };
      });
      if (!basis.ok) {
        fail(route.id, feature.id, basis.reason);
        return [];
      }
      return [{ feature, basis: basis.value }];
    });
    return { route, timeline, modules };
  });
  const scenes = catalogue.scene.flatMap((feature) => {
    const basis = attempt(() => {
      const settings = feature.select(scene.settings);
      return { ok: true, value: { settings, seed: seedFor(request.seed, '', feature.id), scale } };
    });
    if (!basis.ok) {
        fail(null, feature.id, basis.reason);
        return [];
      }
    return [{ feature, basis: basis.value }];
  });

  const parts: Part[] = [];
  const ended = new Set<object>();
  const endOf = (routeId: string | null, featureId: string, entry: object, run: () => Part | null) => {
    const end = attempt(() => ({ ok: true, value: run() }));
    if (!end.ok) return fail(routeId, featureId, end.reason);
    ended.add(entry);
    if (end.value !== null) parts.push(end.value);
  };
  for (const { route, modules } of routes) {
    for (const entry of modules) endOf(route.id, entry.feature.id, entry, () => entry.feature.end(entry.basis));
  }
  for (const entry of scenes) endOf(null, entry.feature.id, entry, () => entry.feature.end(entry.basis));
  const contentMs = contentTime(scene.settings.clock, contentEndMs(scene, aspect, parts), request.sceneMs);

  const evaluated: Evaluated[] = [];
  const routeEvaluated: Evaluated[] = [];
  for (const { route, timeline, modules } of routes) {
    const lead = leadAt(timeline, contentMs);
    for (const { feature, basis } of modules.filter((entry) => ended.has(entry))) {
      const result = attempt(() => feature.evaluate({ ...basis, timeMs: contentMs, lead }));
      if (!result.ok) fail(route.id, feature.id, result.reason);
      else routeEvaluated.push({ routeId: route.id, featureId: feature.id, layers: feature.layers, value: result.value });
    }
  }

  // 2. The scene: each scene module, given where the travellers it declared are, and nothing of any route's settings.
  const travellerAt = (allowed: readonly TravellerRef[]) => (ref: TravellerRef, timeMs: number): ImagePoint | null => {
    if (!allowed.some((each) => each.routeId === ref.routeId && each.featureId === ref.featureId)) return null;
    const owner = routes.find((each) => each.route.id === ref.routeId);
    const entry = owner?.modules.find((each) => each.feature.id === ref.featureId);
    if (owner === undefined || entry?.feature.traveller === undefined) return null;
    const input = { ...entry.basis, timeMs, lead: leadAt(owner.timeline, timeMs) };
    const at = attempt(() => ({ ok: true, value: entry.feature.traveller?.positionAt(input) ?? null }));
    return at.ok ? at.value : null;
  };
  let view: View | null = null;
  for (const { feature, basis } of scenes.filter((entry) => ended.has(entry))) {
    const result = attempt(() => {
      const input = { ...basis, timeMs: contentMs, travellerAt: travellerAt(feature.refersTo(basis.settings)) };
      return feature.evaluate(input);
    });
    if (!result.ok) {
      fail(null, feature.id, result.reason);
      continue;
    }
    evaluated.push({ routeId: null, featureId: feature.id, layers: feature.layers, value: result.value });
    const given = feature.view === undefined ? null : attempt(() => ({ ok: true, value: feature.view?.(result.value) }));
    if (given?.ok === false) fail(null, feature.id, given.reason);
    else if (given?.value !== undefined && view === null) view = given.value;
  }
  evaluated.push(...routeEvaluated);

  // 3. The view: the scene's (the whole picture, without one), then the further zoom and pan, as one transform.
  const centre = { x: size.width / 2, y: size.height / 2 };
  const camera = view !== null && sound(view.zoom, 0) ? { zoom: view.zoom, at: imageToCanvas(bounds, view.centre) } : null;
  const further = request.viewing !== undefined && sound(request.viewing.zoom, 0) ? request.viewing : NO_VIEWING;
  const zoom = further.zoom * (camera?.zoom ?? 1);
  const at = camera?.at ?? centre;
  const matrix = [zoom, 0, 0, zoom, centre.x + further.panX - zoom * at.x, centre.y + further.panY - zoom * at.y] as const;

  const frame: Frame = { bounds, scale, view: camera === null ? null : view };

  // 4. Drawing: layer by layer; within a layer the scene's modules, then routes in list order, each module isolated.
  const failed = new Set<Evaluated>();
  const drawLayer = (onto: DrawContext, layer: Layer) => {
    for (const each of evaluated) {
      const drawing = each.layers?.[layer];
      if (drawing === undefined || failed.has(each)) continue;
      try {
        isolated(onto, (guarded) => drawing(guarded, each.value, frame));
      } catch (error) {
        failed.add(each);
        fail(each.routeId, each.featureId, reasonOf(error));
      }
    }
  };
  context.resetTransform();
  context.clearRect(0, 0, size.width, size.height);
  context.save();
  context.setTransform(...matrix);
  let mask: Surface | null = null;
  for (const layer of LAYERS) {
    if (layer === 'backgroundMask') {
      if (!evaluated.some((each) => each.layers?.backgroundMask !== undefined)) continue;
      // A module that draws in the mask is a reveal: drawing nothing there means it has uncovered nothing yet, so the
      // background is hidden; it is drawn whole only when no such module evaluated, or every one failed this frame.
      mask = request.surface(size);
      mask.context.setTransform(...matrix);
      drawLayer(mask.context, layer);
      if (!evaluated.some((each) => each.layers?.backgroundMask !== undefined && !failed.has(each))) mask = null;
      continue;
    }
    drawLayer(context, layer);
    if (layer === 'background' && mask !== null) {
      const { image } = mask;
      isolated(context, (guarded) => {
        guarded.resetTransform();
        guarded.globalCompositeOperation = 'destination-in';
        guarded.drawImage(image, 0, 0, size.width, size.height);
      });
    }
  }
  context.restore();

  // Overlays, last and in screen space, only when the request holds some.
  for (const overlay of request.overlays ?? []) {
    try {
      isolated(context, (guarded) => overlay(guarded, frame));
    } catch (error) {
      fail(null, 'overlay', reasonOf(error));
    }
  }
  return reports;
}
