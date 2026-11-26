// CORE-06, chat E1 (briefs 109 and 112): the preview's canvas takes the pointer. Three pieces, each proved in Node with
// the DOM stood in for:
// 1. `recordGeometry`: what the frame was drawn with, kept by an overlay that draws nothing (the preview adds it to each
//    request): the image's bounds in canvas pixels, from where the frame's one transform places the image's corners
//    (the scene's camera and any further zoom folded in), its scale, and each route's shape and timeline as the frame
//    held them, with its markers' half-size (`MARKER_HALF × frame.scale × screen.zoom`). The markers' own look is not
//    the editor's to import (the dependency rules refuse it: only the catalogues import a feature, and the editor's
//    catalogue carries no size), so a point is taken as 30 px across at scale 1 (D241, the owner's "Keep 30").
//    `inCssPixels` divides it all by the pixel ratio (the canvas's width over its CSS width), so the
//    hit test and the pointer meet in the pointer's CSS pixels, never device pixels.
// 2. `penTap`: what a tap means for the pen (ruling 7). The pen draws on the scene's first route (the owner's Q11, one
//    route) and stands on that route's single selected point, or on none (D235). A tap on nothing places a stop there
//    (a point's default kind),
//    joined from the pen if it stands on one; a tap on a point of that route joins it from the pen (two points already
//    joined are not joined again), or selects it when the pen stands on nothing. A tap on the "+" of that route's line
//    (the hit test's `plus`, ./hit.ts) inserts a bend at the "+"'s place, never the tap's (`splitLine`; brief 120,
//    ruling Z: v3 inserted a minor waypoint), which the command selects alone, so the pen then stands on it. It does so
//    only where the "+" is drawn (point 4d of ../shell/previewLogic.ts: a hovered line of the selected route): while that route
//    is the selected route, whatever points of it are selected, or none (brief 121, ruling AE, narrowing ruling Z's
//    "whatever the pen stood on"); with nothing selected or another route selected, a tap on the "+"'s place means
//    nothing. A tap on a line off its "+" (D254 asks the owner), on another route's point or line, and every tap with a
//    modifier held, means nothing yet (the modifier taps F's and G's). A place beyond the picture, the tap's or the
//    "+"'s, is held to its edge (D237: the clamp is the page's).
// 3. `bindCanvas`: one `bindPointer` (gesture.ts) on one canvas. Each DOM pointer event is reduced to the machine's
//    `PointerInput` (the place in the canvas's CSS pixels; a down carries what the hit test finds under it in the last
//    frame drawn and the selection now); capture is asked for and released as the effects say. Listened for on the
//    canvas: pointerdown, pointermove, pointerup, pointercancel and lostpointercapture; on the window: pointerup and
//    pointercancel (an up or cancel outside once capture is gone: v3's fallback) and blur. A drag's movement is held to
//    the picture (point 5). No `click` is listened
//    for, so the compatibility click after a tap does nothing and a tap is one point. Before a frame is drawn, a down
//    is not taken. Every down first asks the page to paint now if the store has moved on since the last frame (`refresh`),
//    so a tap never hit-tests geometry older than the store: two quick taps on one empty place make one point, not two
//    (brief 113, ruling K). When that paint did not record (it threw), the geometry is unknown and the down is not taken:
//    nothing placed, nothing joined, never a point on top of one the frame has not drawn yet (brief 114, ruling P). A tap with any modifier held (Shift, Alt, Ctrl or Meta, on every platform) means nothing to
//    the pen, whichever key is the platform's command key (ruling L). What it gives back first ends any press through
//    the machine, as a blur does (a drag's places and selection put back, no step, capture released: ruling J), then
//    removes every listener with its original callback (React's strict mode mounts twice: no second binding is left).
// 4. `escapeClears`: Escape's branch for the selection (ruling 8), last in keydown.ts's order (a drag, typed text, a
//    menu, a dialog, then the selection). While a drag is open on a bound canvas, Escape does nothing here (`cancelDrag`,
//    point 5, has it first); otherwise, with something selected, it clears the selection (never a step), so the next tap on
//    nothing starts a new point joined to nothing.
// 5. A point's drag (brief 115, ruling T). A press on a point that moves more than the machine's threshold drags it
//    (pointer.ts, gesture.ts): one step on the up. Its movement is held so that every point it moves stays on the
//    picture, as the tap's place is (`holdOnPicture`, D237: the clamp is the page's). `cancelDrag` ends every drag open
//    on a bound canvas as a blur does: the places and the selection put back, nothing to undo, capture released, and the
//    pointer's later moves and up do nothing. keydown.ts hands it to the dispatch's Escape, before `escapeClears`.
// 6. The hover (brief 118, ruling S). With a holder handed (`hover`, ./hover.ts), a pointermove on the canvas while the
//    machine is idle (no press open), from a mouse or a pen only (any other pointer type, or none, never hovers), hit-tests the last frame drawn as a down
//    does, but without `refresh()` (a move never books a frame by itself), and hands the holder the point or line
//    under it, or null. A pointerleave on the canvas, every pointerdown, a blur and the removal of the binding clear
//    it; while a press or a drag is open nothing is hovered.
import type { ImageBounds } from '../../core/geometry/transform';
import type { Frame } from '../../adapters/render/layers';
import type { Screen } from '../../adapters/render/overlays';
import type { Command } from '../store/command';
import { NOTHING_SELECTED } from '../store/selection';
import type { Store } from '../store/store';
import { penStep, splitLine } from './commands';
import type { Start } from '../../core/model/commands/editing';
import { bindPointer, type PointerBinding, type Tap } from './gesture';
import { hitTest, type HitRoute } from './hit';
import { hoverOf, type HoverHolder } from './hover';
import type { Modifiers, Pixel, PointerInput } from './pointer';

/** A point's half-size at scale 1, in reference pixels: 30 px across (D241). */
export const MARKER_HALF = 15;

/** What a frame was drawn with, as the hit test needs it: the image's bounds and the routes in the order drawn. */
export interface Geometry {
  readonly bounds: ImageBounds;
  readonly routes: readonly HitRoute[];
}

/** The geometry of the frame an overlay is handed, in canvas pixels (point 1); null when the transform gives no place. */
export function recordGeometry(frame: Pick<Frame, 'bounds' | 'scale'>, screen: Screen): Geometry | null {
  const from = screen.place({ x: 0, y: 0 });
  const to = screen.place({ x: 1, y: 1 });
  if (from === null || to === null) return null;
  const bounds = { x: from.x, y: from.y, width: to.x - from.x, height: to.y - from.y, scale: frame.bounds.scale * screen.zoom };
  const routes = [...screen.routes].map(([id, route]) => ({
    route: { id, points: route.shape.points, lines: route.shape.lines },
    timeline: route.timeline,
    markerHalf: MARKER_HALF * frame.scale * screen.zoom,
  }));
  return { bounds, routes };
}

/** `geometry` in the pointer's CSS pixels: every length divided by `ratio`, the canvas's pixels per CSS pixel. */
export function inCssPixels(geometry: Geometry, ratio: number): Geometry {
  const { bounds } = geometry;
  return {
    bounds: { x: bounds.x / ratio, y: bounds.y / ratio, width: bounds.width / ratio, height: bounds.height / ratio, scale: bounds.scale / ratio },
    routes: geometry.routes.map((each) => ({ ...each, markerHalf: each.markerHalf / ratio })),
  };
}

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

/** The pen's command for `tap` on the store as it is now (point 2), or null for none. */
export function penTap({ project, selection }: Pick<ReturnType<Store['getState']>, 'project' | 'selection'>, tap: Tap): Command | null {
  const route = project.scene.routes[0];
  if (route === undefined) return null;
  const { alt, shift, meta } = tap.modifiers;
  if (alt || shift || meta) return null;
  const pen = selection.route === route.id && selection.points.length === 1 ? (selection.points[0] ?? null) : null;
  const { under } = tap;
  if (under === null) return penStep(route.id, pen, { place: { x: clamp(tap.place.x), y: clamp(tap.place.y), kind: 'stop' } });
  if (under.kind === 'point' && under.route === route.id) return penStep(route.id, pen, { point: under.id });
  if (under.kind === 'line' && under.route === route.id && under.plus !== undefined && selection.route === route.id) {
    return splitLine(route.id, under.id, { x: clamp(under.plus.x), y: clamp(under.plus.y), kind: 'bend' });
  }
  return null;
}

/** What `bindCanvas` reads of a pointer event: a real PointerEvent on the page, a plain object in Node. */
export type PointerFields = Pick<PointerEvent, 'pointerId' | 'isPrimary' | 'button' | 'clientX' | 'clientY' | 'altKey' | 'shiftKey' | 'metaKey' | 'ctrlKey'> &
  Partial<Pick<PointerEvent, 'pointerType'>>;

/** What `bindCanvas` takes of a target it listens on, its events of type `E`. */
interface Listened<E extends PointerFields> {
  addEventListener(type: string, listener: (event: E) => void): void;
  removeEventListener(type: string, listener: (event: E) => void): void;
}

/** What `bindCanvas` takes of the canvas element (the page's, or a stand-in in Node). */
export interface CanvasElement<E extends PointerFields> extends Listened<E> {
  readonly width: number;
  getBoundingClientRect(): { readonly left: number; readonly top: number; readonly width: number };
  setPointerCapture(pointerId: number): void;
  releasePointerCapture(pointerId: number): void;
  hasPointerCapture(pointerId: number): boolean;
}

export interface CanvasBindingOptions<E extends PointerFields> {
  readonly canvas: CanvasElement<E>;
  /** The window: its pointerup, pointercancel and blur. */
  readonly win: Listened<E>;
  readonly store: Store;
  /** The geometry of the last frame drawn on the canvas, in canvas pixels, or null before the first. */
  readonly geometry: () => Geometry | null;
  /**
   * Paints the canvas now if what it shows is older than the store, so that `geometry` is the store's (ruling K); false
   * when the canvas could not be brought to the store (the paint threw), and the down is then not taken (ruling P).
   */
  readonly refresh: () => boolean;
  /** Whether this machine is a Mac: the platform's command key is Cmd there, Ctrl elsewhere. */
  readonly mac: boolean;
  /** Where the point or line under a resting mouse or pen is held (point 6); none, no hover. */
  readonly hover?: Pick<HoverHolder, 'set'>;
}

/** The bindings on the page now, each with what ends its press as a blur does, so that keydown.ts can ask whether a drag is open (point 4) and cancel it (point 5). */
const live = new Map<PointerBinding, () => void>();

/** Whether a drag is open on any bound canvas now. */
export const dragOpen = (): boolean => [...live.keys()].some((binding) => binding.state().phase === 'dragging');

/** Cancels every drag open on a bound canvas (point 5); true when one was open, and Escape is then taken. */
export function cancelDrag(): boolean {
  let cancelled = false;
  for (const [binding, blur] of [...live]) {
    if (binding.state().phase !== 'dragging') continue;
    blur();
    cancelled = true;
  }
  return cancelled;
}

/**
 * A drag's whole movement `dx`, `dy` (image fractions) held so that every point it moves, from `starts`, stays on the
 * picture, each axis on its own, as the tap's place is held to its edge (point 5, D237); the group keeps its shape.
 */
export function holdOnPicture(starts: readonly Start[], dx: number, dy: number): { readonly dx: number; readonly dy: number } {
  if (starts.length === 0) return { dx, dy };
  const held = (move: number, places: readonly number[]): number =>
    Math.min(Math.max(move, -Math.min(...places)), 1 - Math.max(...places));
  return { dx: held(dx, starts.map((start) => start.x)), dy: held(dy, starts.map((start) => start.y)) };
}

type Kind = Exclude<PointerInput['kind'], 'blur'>;

const ON_CANVAS: readonly (readonly [string, Kind])[] = [
  ['pointerdown', 'down'],
  ['pointermove', 'move'],
  ['pointerup', 'up'],
  ['pointercancel', 'cancel'],
  ['lostpointercapture', 'lost-capture'],
];
const ON_WINDOW: readonly (readonly [string, Kind | 'blur'])[] = [
  ['pointerup', 'up'],
  ['pointercancel', 'cancel'],
  ['blur', 'blur'],
];

/** Binds the pen to `canvas` (point 3); gives back what removes every listener it added. */
export function bindCanvas<E extends PointerFields>({ canvas, win, store, geometry, refresh, mac, hover }: CanvasBindingOptions<E>): () => void {
  /** The last frame's geometry in the pointer's CSS pixels, or null before the first. */
  const inCss = (): Geometry | null => {
    const drawn = geometry();
    const cssWidth = canvas.getBoundingClientRect().width;
    if (drawn === null || cssWidth <= 0 || canvas.width <= 0) return null;
    return inCssPixels(drawn, canvas.width / cssWidth);
  };
  /** Whether the event being sent had any modifier held, whichever is the platform's command key (ruling L). */
  let held = false;
  const binding = bindPointer({
    store,
    bounds: () => inCss()?.bounds ?? { x: 0, y: 0, width: 1, height: 1, scale: 1 },
    onTap: (tap) => (held ? null : penTap(store.getState(), tap)),
    limit: holdOnPicture,
  });

  const modifiers = (event: E): Modifiers => ({ alt: event.altKey, shift: event.shiftKey, meta: mac ? event.metaKey : event.ctrlKey });
  const at = (event: E): Pixel => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const send = (input: PointerInput): void => {
    for (const effect of binding.send(input)) {
      if (effect.kind === 'capture') {
        try {
          canvas.setPointerCapture(effect.pointerId);
        } catch {
          // A pointer the browser no longer knows: the window's listeners still end the press.
        }
      } else if (effect.kind === 'release' && canvas.hasPointerCapture(effect.pointerId)) {
        canvas.releasePointerCapture(effect.pointerId);
      }
    }
  };

  live.set(binding, () => {
    send({ kind: 'blur' });
  });

  /** An idle mouse or pen move: what lies under it in the last frame drawn, never a refresh (point 6). */
  const rest = (place: Pixel, event: E): void => {
    if (hover === undefined) return;
    if ((event.pointerType !== 'mouse' && event.pointerType !== 'pen') || binding.state().phase !== 'idle') {
      hover.set(null);
      return;
    }
    const now = inCss();
    hover.set(now === null ? null : hoverOf(hitTest(place, now.bounds, now.routes)));
  };

  const onPointer = (kind: Kind | 'blur', event: E): void => {
    if (kind === 'blur') {
      hover?.set(null);
      send({ kind });
      return;
    }
    const contact = { pointerId: event.pointerId, primary: event.isPrimary, button: event.button, at: at(event), modifiers: modifiers(event) };
    held = event.altKey || event.shiftKey || event.metaKey || event.ctrlKey;
    if (kind !== 'down') {
      send({ ...contact, kind });
      if (kind === 'move') rest(contact.at, event);
      return;
    }
    hover?.set(null);
    if (!refresh()) return;
    const now = inCss();
    if (now === null) return;
    const { selection } = store.getState();
    send({ ...contact, kind, under: hitTest(contact.at, now.bounds, now.routes), selection });
  };

  const listeners = (pairs: readonly (readonly [string, Kind | 'blur'])[]) =>
    pairs.map(([type, kind]) => [type, (event: E) => { onPointer(kind, event); }] as const);
  const onLeave = (): void => {
    hover?.set(null);
  };
  // The leave is listened for only with a holder to clear (point 6).
  const onCanvas = hover === undefined ? listeners(ON_CANVAS) : [...listeners(ON_CANVAS), ['pointerleave', onLeave] as const];
  const onWindow = listeners(ON_WINDOW);
  for (const [type, listener] of onCanvas) canvas.addEventListener(type, listener);
  for (const [type, listener] of onWindow) win.addEventListener(type, listener);
  return () => {
    send({ kind: 'blur' });
    hover?.set(null);
    for (const [type, listener] of onCanvas) canvas.removeEventListener(type, listener);
    for (const [type, listener] of onWindow) win.removeEventListener(type, listener);
    live.delete(binding);
  };
}

/** Where an Escape was pressed, as keydown.ts reads it. */
export interface EscapePlace {
  readonly typing: boolean;
  readonly dialogOpen: boolean;
}

/**
 * Escape's branch for the selection (point 4): true when it cleared the selection and the key is taken. Nothing for a
 * key already taken, typed text, an open dialog or an open drag, or with nothing selected.
 */
export function escapeClears(
  press: { readonly key: string; readonly defaultPrevented: boolean },
  place: EscapePlace,
  drag: boolean,
  store: Pick<Store, 'getState' | 'select'>,
): boolean {
  if (press.key !== 'Escape' || press.defaultPrevented || drag || place.typing || place.dialogOpen) return false;
  const { selection } = store.getState();
  if (selection.route === null && selection.points.length === 0) return false;
  store.select(NOTHING_SELECTED);
  return true;
}
