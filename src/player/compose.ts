// CORE-04: the one composer (the plan's §8, four stages), shared by every frame that is drawn. It is given the scene,
// a time, a seed, the frame's size and a few neutral extras (the picture, a further zoom and pan, overlays, a blank
// surface); it is never told who asks, so whoever does gets the same picture of the same moment. A frame is a function
// of the time, the scene and the seed: no clock is read, nothing random is drawn, nothing is kept from an earlier
// frame. A module whose evaluation fails or throws draws nothing that frame; its report is passed on, never thrown.
import { isolated, type DrawContext } from '../adapters/render/context';
import { LAYERS, type Drawings, type Frame, type Layer } from '../adapters/render/layers';
import type { Overlay, Screen } from '../adapters/render/overlays';
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

/** The background image: its size, by which the scene measures, and what to draw, when the caller has it. */
interface Picture extends Size {
  /** A browser image the caller supplies; with none, the picture is placed but not drawn. */
  readonly source?: CanvasImageSource;
}

/** A further zoom about the frame's centre, then a pan in canvas pixels, after the scene's own view. */
interface Viewing {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export interface FrameRequest {
  readonly scene: Scene;
  /** The scene's time, holds included (src/core/clock). */
  readonly sceneMs: number;
  readonly seed: number;
  /** The frame in canvas pixels. */
  readonly size: Size;
  /** The background image; with none, the scene measures as a square. */
  readonly image: Picture | null;
  readonly surface: (size: Size) => Surface;
  readonly viewing?: Viewing;
  readonly overlays?: readonly Overlay[];
  /** The pictures modules draw besides the background, by the name a module gives (an image head's), decoded. */
  readonly images?: ReadonlyMap<string, CanvasImageSource>;
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

type Fail = (routeId: string | null, featureId: string, reason: string) => void;

/** What every stage shares: the request, the modules, the frame's render scale and the image's aspect. */
interface Run {
  readonly request: FrameRequest;
  readonly catalogue: Catalogue;
  readonly scale: number;
  readonly aspect: number;
  readonly fail: Fail;
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

/** Each module's own settings, seed and scale, or a report for one that cannot name its settings. */
function basesOf<F extends { readonly id: string }, B>(routeId: string | null, features: readonly F[], fail: Fail, base: (feature: F) => B) {
  return features.flatMap((feature) => {
    const basis = attempt(() => ({ ok: true, value: base(feature) }));
    if (!basis.ok) {
      fail(routeId, feature.id, basis.reason);
      return [];
    }
    return [{ feature, basis: basis.value }];
  });
}

/** 1. Routes: each route's view and its modules; every module's end (the content's length); the routes' evaluations. */
function routesStage(run: Run) {
  const { request, catalogue, scale, aspect, fail } = run;
  const { scene } = request;
  const routes = scene.routes.map((route) => {
    const timeline = composeTimeline(route, aspect);
    const shape = { points: route.points, lines: route.lines, leadStart: route.leadStart, marks: route.marks };
    const view = { shape, timeline };
    const modules = basesOf(route.id, catalogue.route, fail, (feature) => {
      const settings = feature.select(route.settings);
      return { settings, route: view, seed: seedFor(request.seed, route.id, feature.id), scale };
    });
    return { route, timeline, view, modules };
  });
  const scenes = basesOf(null, catalogue.scene, fail, (feature) => {
    return { settings: feature.select(scene.settings), seed: seedFor(request.seed, '', feature.id), scale };
  });

  const parts: Part[] = [];
  const ended = new Set<object>();
  const endOf = (routeId: string | null, featureId: string, entry: object, end: () => Part | null) => {
    const result = attempt(() => ({ ok: true, value: end() }));
    if (!result.ok) return fail(routeId, featureId, result.reason);
    ended.add(entry);
    if (result.value !== null) parts.push(result.value);
  };
  for (const { route, modules } of routes) {
    for (const entry of modules) endOf(route.id, entry.feature.id, entry, () => entry.feature.end(entry.basis));
  }
  for (const entry of scenes) endOf(null, entry.feature.id, entry, () => entry.feature.end(entry.basis));
  const contentEnd = contentEndMs(scene, aspect, parts);
  const contentMs = contentTime(scene.settings.clock, contentEnd, request.sceneMs);

  const evaluated: Evaluated[] = [];
  for (const { route, timeline, modules } of routes) {
    const lead = leadAt(timeline, contentMs);
    for (const { feature, basis } of modules.filter((entry) => ended.has(entry))) {
      const result = attempt(() => feature.evaluate({ ...basis, timeMs: contentMs, lead }));
      if (!result.ok) fail(route.id, feature.id, result.reason);
      else evaluated.push({ routeId: route.id, featureId: feature.id, layers: feature.layers, value: result.value });
    }
  }
  return { routes, scenes: scenes.filter((entry) => ended.has(entry)), contentEnd, contentMs, evaluated };
}

/**
 * 2. The scene: each scene module, given where the travellers it declared are and nothing of any route's settings.
 * The first view given is the view; the first placement given places the picture.
 */
function sceneStage(run: Run, { routes, scenes, contentEnd, contentMs }: ReturnType<typeof routesStage>) {
  const travellerAt = (allowed: readonly TravellerRef[]) => (ref: TravellerRef, timeMs: number): ImagePoint | null => {
    if (!allowed.some((each) => each.routeId === ref.routeId && each.featureId === ref.featureId)) return null;
    const owner = routes.find((each) => each.route.id === ref.routeId);
    const entry = owner?.modules.find((each) => each.feature.id === ref.featureId);
    if (owner === undefined || entry?.feature.traveller === undefined) return null;
    const input = { ...entry.basis, timeMs, lead: leadAt(owner.timeline, timeMs) };
    const at = attempt(() => ({ ok: true, value: entry.feature.traveller?.positionAt(input) ?? null }));
    return at.ok ? at.value : null;
  };
  /** What a module gives from its evaluation, or a report when giving it throws. */
  const given = <T>(featureId: string, give: () => T | undefined): T | undefined => {
    const result = attempt(() => ({ ok: true, value: give() }));
    if (!result.ok) run.fail(null, featureId, result.reason);
    return result.ok ? result.value : undefined;
  };
  const evaluated: Evaluated[] = [];
  let view: View | undefined;
  let placement: number | undefined;
  for (const { feature, basis } of scenes) {
    const result = attempt(() => {
      const refs = feature.refersTo(basis.settings);
      return feature.evaluate({ ...basis, timeMs: contentMs, travellerAt: travellerAt(refs), contentEndMs: contentEnd });
    });
    if (!result.ok) {
      run.fail(null, feature.id, result.reason);
      continue;
    }
    const { value } = result;
    evaluated.push({ routeId: null, featureId: feature.id, layers: feature.layers, value });
    // Every module's offer is asked for, so a later one that throws is still reported; the first given is kept.
    const offered = feature.view === undefined ? undefined : given(feature.id, () => feature.view?.(value));
    const placed = feature.placement === undefined ? undefined : given(feature.id, () => feature.placement?.(value));
    view ??= offered;
    placement ??= placed;
  }
  return { evaluated, view: view ?? null, placement: placement !== undefined && sound(placement, 0) ? placement : 1 };
}

const NO_IMAGES: ReadonlyMap<string, CanvasImageSource> = new Map();

/** 3. The view: the picture placed, the scene's view (the whole picture, without one), then the further zoom and pan. */
function viewStage(run: Run, view: View | null, placement: number) {
  const { size, image, viewing, images = NO_IMAGES } = run.request;
  const bounds = imageBounds(size, image ?? SQUARE, placement);
  const centre = { x: size.width / 2, y: size.height / 2 };
  const camera = view !== null && sound(view.zoom, 0) ? { zoom: view.zoom, at: imageToCanvas(bounds, view.centre) } : null;
  const further = viewing !== undefined && sound(viewing.zoom, 0) ? viewing : NO_VIEWING;
  const zoom = further.zoom * (camera?.zoom ?? 1);
  const at = camera?.at ?? centre;
  const matrix = [zoom, 0, 0, zoom, centre.x + further.panX - zoom * at.x, centre.y + further.panY - zoom * at.y] as const;
  const frame: Frame = {
    size,
    bounds,
    picture: image?.source ?? null,
    scale: run.scale,
    view: camera === null ? null : view,
    images,
  };
  return { frame, matrix };
}

/** 4. Drawing: layer by layer; within a layer the scene's modules, then routes in list order, each module isolated. */
function drawStage(context: DrawContext, run: Run, evaluated: readonly Evaluated[], { frame, matrix }: ReturnType<typeof viewStage>) {
  const { size } = frame;
  const failed = new Set<Evaluated>();
  const drawLayer = (onto: DrawContext, layer: Layer) => {
    for (const each of evaluated) {
      const drawing = each.layers?.[layer];
      if (drawing === undefined || failed.has(each)) continue;
      try {
        isolated(onto, (guarded) => drawing(guarded, each.value, frame));
      } catch (error) {
        failed.add(each);
        run.fail(each.routeId, each.featureId, reasonOf(error));
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
      mask = run.request.surface(size);
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
}

/**
 * What each overlay is handed besides the frame: the frame's one transform (the scene's view, then the further zoom
 * and pan), to place an image point on screen by, and each route as every module saw it, by its id.
 */
function screenOf({ frame, matrix }: ReturnType<typeof viewStage>, routes: ReturnType<typeof routesStage>['routes']): Screen {
  const [zoom, , , , dx, dy] = matrix;
  const place: Screen['place'] = (point) => {
    const at = imageToCanvas(frame.bounds, point);
    const x = zoom * at.x + dx;
    const y = zoom * at.y + dy;
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  };
  return { zoom, place, routes: new Map(routes.map((each) => [each.route.id, each.view])) };
}

/** Draw the scene at its time onto `context`; returns what could not be drawn. */
export function compose(context: DrawContext, request: FrameRequest, catalogue: Catalogue = CATALOGUE): FrameReport[] {
  const reports: FrameReport[] = [];
  const fail: Fail = (routeId, featureId, reason) => reports.push({ routeId, featureId, reason });
  const scale = renderScale(request.size, request.scene.settings.graphics.scale);
  const run: Run = { request, catalogue, scale, aspect: aspectOf(request.image), fail };

  const routes = routesStage(run);
  const scene = sceneStage(run, routes);
  const placed = viewStage(run, scene.view, scene.placement);
  drawStage(context, run, [...scene.evaluated, ...routes.evaluated], placed);

  // Overlays, last and in screen space, only when the request holds some.
  const overlays = request.overlays ?? [];
  if (overlays.length === 0) return reports;
  const screen = screenOf(placed, routes.routes);
  for (const overlay of overlays) {
    try {
      isolated(context, (guarded) => overlay(guarded, placed.frame, screen));
    } catch (error) {
      fail(null, 'overlay', reasonOf(error));
    }
  }
  return reports;
}
