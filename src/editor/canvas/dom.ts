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
//    nothing. A tap on a line off its "+" (D254 asks the owner), or on another route's point or line, means nothing yet.
//    A place beyond the picture, the tap's or the "+"'s, is held to its edge (D237: the clamp is the page's).
//    A tap with a modifier held is never the pen's. `toggleTap` (brief 122, ruling AH; v3's Cmd/Ctrl+click,
//    InteractionHandler.js:668-672): a tap on a point of the first route with the platform's command key held (Cmd on a
//    Mac, Ctrl elsewhere) and no Alt and no Shift changes the selection, never a step, never the project. That route
//    selected, the point in the selection: taken out, the others' order kept, and with none left nothing is selected (as
//    Escape leaves it); that route selected, the point not in it: added at the end; nothing selected, or another route:
//    that point alone. It says nothing aloud (the pen's silence, A6). Every other tap with a modifier held means nothing:
//    the command key on nothing, on a line or its "+", or on another route's point; any tap with Alt or Shift held (D257
//    asks the owner whether v3's Shift+click delete comes back; Alt is G's branch); Ctrl on a Mac. A press with a
//    modifier held never drags (pointer.ts, `pressed`), so a selection made this way is dragged by a plain press.
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
//    the pen, whichever key is the platform's command key (ruling L); it goes to `toggleTap` (point 2), whose selection,
//    if any, is selected with no command, so nothing is added to the history. What it gives back first ends any press through
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
// 7. The Editing keys (brief 123, ruling AO; v3's Delete or Backspace, Cmd or Ctrl+D and Cmd or Ctrl+A): `editKey` is
//    what keydown.ts hands the dispatch, each action a function of the store and whether a drag is open, true exactly
//    when there was something to act on (the key is then taken), and never while a drag is open. "The route" is the
//    scene's first route, as the pen's. `deleteSelected`: the selection on that route holds a point, and they are
//    deleted as one step (a point between one line in and one line out closes up; the store keeps the route
//    selected and drops the deleted points). `duplicateSelected`: the selection on that route holds a point, and they
//    are copied in one gesture labelled Duplicate, one step: the copies stand 2% right and down and become the
//    selection (D238, answered 25 Nov: "Copies, then carry on"), held on the picture as a group keeping its shape, as
//    a drag is (`holdOnPicture`, D237); a refusal cancels the gesture and the key is still taken. `selectAll`: the
//    route holds a point, and every point of it is selected in the route's order, never a step. A held key's repeat
//    acts no more and says the same. Select all hands a `say` its one line when it changes the selection (brief 133,
//    CT; ./words.ts); the page gives it nothing yet, so none says anything aloud (D263's answer, wired in stage 2).
// 8. The nudge (brief 125, rulings AX and AY; v3's InteractionHandler.js 970 to 992, wiringControllers.js 295 to 327,
//    app/undoRedo.js 99 to 107): `editKey` with `nudge` or `nudgeFurther` and the arrow pressed moves the selected
//    points of the route by 0.5% of the picture (`NUDGE`), or 2% (`NUDGE_FURTHER`), along the arrow (up is minus y),
//    divided by the zoom of the frame a bound canvas last drew (`zoomNow`: the screen's zoom, 1 with none drawn), in
//    image fractions for `movePoints`. The group moves whole, held on the picture as a drag is (`holdOnPicture`, D237),
//    its spacing kept; a press that would move nothing (held at the edge) changes nothing and makes no step, and the
//    key is still taken, an open burst kept open as by any press. A burst is one undo step, as v3's 400 ms debounce
//    made it: the first press begins a store gesture labelled Nudge, each further press within `NUDGE_QUIET_MS` of the
//    last (a held key's repeats included) moves within it, and it is committed `NUDGE_QUIET_MS` after the last press,
//    or at once by `endNudge`: the dispatch calls it for any other key before that key runs (so Undo or Redo meets it
//    closed), the bound canvas for a pointer press and the window's blur, and keydown.ts for the focus leaving where it
//    was and any pointer press on the page; a press on another store commits the old store's burst there first.
//    Another gesture owning the store (a begin it would refuse) is left alone, and the key is not taken, at the edge
//    too; nothing is taken with nothing selected on the route or while a drag is open. Nothing is said aloud (D263).
// 9. The point's menu's opener (brief 130, ruling CB; D267 (a)). With a `menu` handed, a `contextmenu` on the canvas
//    hit-tests the last frame drawn as a down does (points before lines, ./hit.ts); on a point it cancels the browser's
//    own menu, selects the point (kept as it is when the point is already in the selection: ./menu.ts `menuSelection`,
//    never a step) and hands the page the point and the pointer's place on the page. On empty picture, a line or its
//    "+", nothing is done and the browser's menu is left alone (a line's menu is G2's). `openMenuByKey` is keydown.ts's
//    for Shift+F10 and the ContextMenu key (`isMenuKey`) with focus in the preview: with a point selected it hands the
//    page the last-selected point, placed on the page just right of its marker; with none, nothing. Neither opens while
//    a drag is open or the store's gesture is (a nudge burst is ended first, by the down or by keydown.ts), as the
//    Editing keys refuse; both open while the pen draws (the pen is always on). The `contextmenu` is listened for only
//    with a `menu` to hand it to.
import { imageToCanvas, type ImageBounds } from '../../core/geometry/transform';
import type { Frame } from '../../adapters/render/layers';
import type { Screen } from '../../adapters/render/overlays';
import type { Command } from '../store/command';
import { NOTHING_SELECTED, type Selection } from '../store/selection';
import type { Store } from '../store/store';
import { deletePoints, duplicatePoints, movePoints, penStep, splitLine } from './commands';
import { DUPLICATE_OFFSET, type Start } from '../../core/model/commands/editing';
import { bindPointer, type PointerBinding, type Tap } from './gesture';
import { hitTest, type HitRoute } from './hit';
import { hoverOf, type HoverHolder } from './hover';
import { menuSelection } from './menu';
import type { Modifiers, Pixel, PointerInput } from './pointer';
import { allSelected } from './words';

/** A point's half-size at scale 1, in reference pixels: 30 px across (D241). */
export const MARKER_HALF = 15;

/** What a frame was drawn with, as the hit test needs it: the image's bounds and the routes in the order drawn. */
export interface Geometry {
  readonly bounds: ImageBounds;
  readonly routes: readonly HitRoute[];
  /** The screen's zoom the frame was drawn at (the scene's view times any further zoom; 1 with neither): the nudge's divisor. */
  readonly zoom: number;
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
  return { bounds, routes, zoom: screen.zoom };
}

/** `geometry` in the pointer's CSS pixels: every length divided by `ratio`, the canvas's pixels per CSS pixel. */
export function inCssPixels(geometry: Geometry, ratio: number): Geometry {
  const { bounds } = geometry;
  return {
    zoom: geometry.zoom,
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

/** The selection a tap with the platform's command key held leaves (point 2), or null where it means nothing. */
export function toggleTap({ project, selection }: Pick<ReturnType<Store['getState']>, 'project' | 'selection'>, tap: Tap): Selection | null {
  const route = project.scene.routes[0];
  const { alt, shift, meta } = tap.modifiers;
  const { under } = tap;
  if (route === undefined || !meta || alt || shift || under?.kind !== 'point' || under.route !== route.id) return null;
  if (selection.route !== route.id) return { route: route.id, points: [under.id] };
  if (!selection.points.includes(under.id)) return { route: route.id, points: [...selection.points, under.id] };
  const points = selection.points.filter((id) => id !== under.id);
  return points.length === 0 ? NOTHING_SELECTED : { route: route.id, points };
}

/** What `bindCanvas` reads of a pointer event: a real PointerEvent on the page, a plain object in Node. */
export type PointerFields = Pick<PointerEvent, 'pointerId' | 'isPrimary' | 'button' | 'clientX' | 'clientY' | 'altKey' | 'shiftKey' | 'metaKey' | 'ctrlKey'> &
  Partial<Pick<PointerEvent, 'pointerType' | 'preventDefault'>>;

/** What the point's menu opens on (point 9): the route, the point, and where on the page, in CSS pixels. */
export interface MenuOpen {
  readonly route: string;
  readonly point: string;
  readonly at: { readonly x: number; readonly y: number };
}

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
  /** What opens the point's menu (point 9); none, no menu. */
  readonly menu?: (open: MenuOpen) => void;
}

/**
 * The bindings on the page now, each with what ends its press as a blur does, so that keydown.ts can ask whether a drag
 * is open (point 4) and cancel it (point 5), and with the zoom of the frame its canvas last drew (point 8).
 */
const live = new Map<PointerBinding, { readonly blur: () => void; readonly zoom: () => number | undefined; readonly menu: () => boolean }>();

/** The zoom of the frame the first bound canvas last drew, the nudge's divisor (point 8); 1 with none drawn or bound. */
export const zoomNow = (): number => [...live.values()][0]?.zoom() ?? 1;

/** Whether a drag is open on any bound canvas now. */
export const dragOpen = (): boolean => [...live.keys()].some((binding) => binding.state().phase === 'dragging');

/** Whether a key press is the menu's key (point 9): the ContextMenu key, or Shift+F10 with no other modifier. */
export function isMenuKey(press: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>): boolean {
  if (press.key === 'ContextMenu') return true;
  return press.key === 'F10' && press.shiftKey && !press.altKey && !press.ctrlKey && !press.metaKey;
}

/** Opens the point's menu on the last-selected point from the keyboard (point 9); true when a bound canvas opened it. */
export function openMenuByKey(): boolean {
  return [...live.values()].some(({ menu }) => menu());
}

/** Cancels every drag open on a bound canvas (point 5); true when one was open, and Escape is then taken. */
export function cancelDrag(): boolean {
  let cancelled = false;
  for (const [binding, { blur }] of [...live]) {
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
export function bindCanvas<E extends PointerFields>({ canvas, win, store, geometry, refresh, mac, hover, menu }: CanvasBindingOptions<E>): () => void {
  /** The last frame's geometry in the pointer's CSS pixels, or null before the first. */
  const inCss = (): Geometry | null => {
    const drawn = geometry();
    const cssWidth = canvas.getBoundingClientRect().width;
    if (drawn === null || cssWidth <= 0 || canvas.width <= 0) return null;
    return inCssPixels(drawn, canvas.width / cssWidth);
  };
  /** Whether the event being sent had any modifier held, whichever is the platform's command key (ruling L): the toggle's tap, not the pen's. */
  let held = false;
  const binding = bindPointer({
    store,
    bounds: () => inCss()?.bounds ?? { x: 0, y: 0, width: 1, height: 1, scale: 1 },
    onTap: (tap) => {
      if (!held) return penTap(store.getState(), tap);
      const picked = toggleTap(store.getState(), tap);
      if (picked !== null) store.select(picked);
      return null;
    },
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

  /** Whether the menu may open now (point 9): one is handed, and no drag nor other gesture is open. */
  const menuMay = (): boolean => menu !== undefined && binding.state().phase !== 'dragging' && store.getState().gesture === null;
  /** Opens the menu on a point (point 9), selecting it first as `menuSelection` says. */
  const openOn = (route: string, point: string, place: MenuOpen['at']): void => {
    const { selection } = store.getState();
    const next = menuSelection(selection, route, point);
    if (next !== selection) store.select(next);
    menu?.({ route, point, at: place });
  };

  live.set(binding, {
    blur: () => {
      send({ kind: 'blur' });
    },
    zoom: () => geometry()?.zoom,
    menu: () => {
      // As a down does, the canvas is first brought to the store, so the point is placed where it is now (ruling K).
      if (!menuMay() || !refresh()) return false;
      const now = inCss();
      if (now === null) return false;
      const { selection } = store.getState();
      const last = selection.points[selection.points.length - 1];
      const drawn = now.routes.find((each) => each.route.id === selection.route);
      const point = drawn?.route.points.find((each) => each.id === last);
      if (drawn === undefined || point === undefined) return false;
      const rect = canvas.getBoundingClientRect();
      const place = imageToCanvas(now.bounds, point);
      openOn(drawn.route.id, point.id, { x: rect.left + place.x + drawn.markerHalf, y: rect.top + place.y });
      return true;
    },
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
    // A press on the preview or the window's blur ends a nudge burst at once (point 8).
    if (kind === 'down' || kind === 'blur') endNudge();
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
  /** A right-click or the like on the canvas (point 9): the menu on a point hit, else nothing and the browser's own. */
  const onMenu = (event: E): void => {
    if (!menuMay() || !refresh()) return;
    const now = inCss();
    if (now === null) return;
    const under = hitTest(at(event), now.bounds, now.routes);
    if (under?.kind !== 'point') return;
    event.preventDefault?.();
    openOn(under.route, under.id, { x: event.clientX, y: event.clientY });
  };
  // The leave is listened for only with a holder to clear (point 6), the menu's event only with a menu (point 9).
  const withLeave = hover === undefined ? listeners(ON_CANVAS) : [...listeners(ON_CANVAS), ['pointerleave', onLeave] as const];
  const onCanvas = menu === undefined ? withLeave : [...withLeave, ['contextmenu', onMenu] as const];
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

/** The Editing keys' actions (points 7 and 8), as the key table names them. */
export type EditAction = 'deleteSelection' | 'duplicate' | 'selectAll' | 'nudge' | 'nudgeFurther';

/** What the Editing keys read and change of the store. */
type EditStore = Pick<Store, 'getState' | 'dispatch' | 'begin' | 'select'>;

/** The scene's first route and the points of it selected now (none when another route, or nothing, is selected). */
function selectedOnRoute(store: EditStore) {
  const { project, selection } = store.getState();
  const route = project.scene.routes[0];
  const points = route !== undefined && selection.route === route.id ? selection.points : [];
  return { route, points };
}

/** Delete or Backspace (point 7): the selected points of the route deleted as one step; true when there were some. */
export function deleteSelected(store: EditStore, drag: boolean, repeat = false): boolean {
  const { route, points } = selectedOnRoute(store);
  if (drag || route === undefined || points.length === 0) return false;
  if (!repeat) store.dispatch(deletePoints(route.id, points));
  return true;
}

/**
 * Cmd or Ctrl+D (point 7): the selected points of the route copied, held on the picture as a group, in one gesture,
 * one step; true when there were some, a refusal included.
 */
export function duplicateSelected(store: EditStore, drag: boolean, repeat = false): boolean {
  const { route, points } = selectedOnRoute(store);
  if (drag || route === undefined || points.length === 0) return false;
  if (repeat) return true;
  const begun = store.begin('Duplicate');
  if (!begun.ok) return true;
  const { gesture } = begun;
  if (!gesture.apply(duplicatePoints(route.id, points)).ok) {
    gesture.cancel();
    return true;
  }
  const originals = route.points.filter((point) => points.includes(point.id));
  const held = holdOnPicture(originals, DUPLICATE_OFFSET, DUPLICATE_OFFSET);
  if (held.dx !== DUPLICATE_OFFSET || held.dy !== DUPLICATE_OFFSET) {
    const copies = store.getState().selection.points;
    if (!gesture.apply(movePoints(route.id, copies, held.dx - DUPLICATE_OFFSET, held.dy - DUPLICATE_OFFSET)).ok) {
      gesture.cancel();
      return true;
    }
  }
  gesture.commit();
  return true;
}

/** Where a line for the page's one status area goes (point 7: select all's); by default, nowhere. */
export type Say = (words: string) => void;
const silent: Say = () => undefined;

/**
 * Cmd or Ctrl+A (point 7): every point of the route selected, in the route's order, never a step; true when it has one.
 * When the press changes the selection, `say` is handed its one line (./words.ts `allSelected`); a repeat says nothing.
 */
export function selectAll(store: EditStore, drag: boolean, repeat = false, say: Say = silent): boolean {
  const route = store.getState().project.scene.routes[0];
  if (drag || route === undefined || route.points.length === 0) return false;
  if (repeat) return true;
  const done = store.select({ route: route.id, points: route.points.map((point) => point.id) });
  if (done.ok && done.changed) say(allSelected(store.getState().selection.points.length));
  return true;
}

/** A nudge's step, 0.5% of the picture, and the further nudge's, 2% (v3's; point 8), before the zoom divides them. */
export const NUDGE = 0.005;
export const NUDGE_FURTHER = 0.02;
/** How long after the last nudge a burst stays open, in ms (v3's debounce; point 8). */
export const NUDGE_QUIET_MS = 400;
/** The label of a burst's gesture, and so of its undo step. */
const NUDGE_LABEL = 'Nudge';

/** Each arrow's direction in image fractions: up is minus y. */
const DIRECTIONS: Readonly<Record<string, { readonly x: number; readonly y: number }>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

type Begun = Extract<ReturnType<Store['begin']>, { readonly ok: true }>;

/** The burst open now (point 8): its store, its gesture and the timer that closes it. */
let burst: { readonly store: EditStore; readonly gesture: Begun['gesture']; timer: ReturnType<typeof setTimeout> } | null = null;

/** Ends the open nudge burst at once, one step if it moved anything (point 8); true when one was open. */
export function endNudge(): boolean {
  if (burst === null) return false;
  const { gesture, timer } = burst;
  burst = null;
  clearTimeout(timer);
  gesture.commit();
  return true;
}

/**
 * An arrow (point 8): the selected points of the route moved by the step along it, divided by `zoom`, held on the
 * picture as a group, within the open burst or a new one; true when there were some to move and the store let it.
 */
function nudgeSelected(store: EditStore, drag: boolean, key: string, further: boolean, zoom: number): boolean {
  const direction = DIRECTIONS[key];
  const { route, points } = selectedOnRoute(store);
  if (direction === undefined || drag || route === undefined || points.length === 0) return false;
  // A burst whose gesture the store no longer holds (an opened project closed it), or another store's, is over: it
  // is committed, and the gesture's own commit tells a live one (one step there) from one already closed (refused,
  // so the other store's gesture open now is left alone).
  if (burst !== null && (burst.store !== store || store.getState().gesture !== NUDGE_LABEL)) endNudge();
  // With no burst of ours open, another gesture owning the store leaves the key untaken, at the edge too.
  if (burst === null && store.getState().gesture !== null) return false;
  const step = (further ? NUDGE_FURTHER : NUDGE) / zoom;
  const starts = route.points.filter((point) => points.includes(point.id));
  const held = holdOnPicture(starts, direction.x * step, direction.y * step);
  if (held.dx === 0 && held.dy === 0) {
    // Held at the edge: nothing applied, no gesture begun, but an open burst stays open 400 ms more.
    if (burst !== null) quietFromNow(burst);
    return true;
  }
  if (burst === null) {
    const begun = store.begin(NUDGE_LABEL);
    if (!begun.ok) return false;
    burst = { store, gesture: begun.gesture, timer: setTimeout(endNudge, NUDGE_QUIET_MS) };
  }
  burst.gesture.apply(movePoints(route.id, points, held.dx, held.dy));
  quietFromNow(burst);
  return true;
}

/** Restarts a burst's timer: it closes `NUDGE_QUIET_MS` from now. */
function quietFromNow(open: NonNullable<typeof burst>): void {
  clearTimeout(open.timer);
  open.timer = setTimeout(endNudge, NUDGE_QUIET_MS);
}

/**
 * The Editing keys' one path (points 7 and 8), as keydown.ts hands it to the dispatch: true when the key is taken.
 * `say` is select all's (point 7).
 */
export function editKey(action: EditAction, repeat: boolean, store: EditStore, drag: boolean, key = '', zoom = zoomNow(), say: Say = silent): boolean {
  if (action === 'nudge' || action === 'nudgeFurther') return nudgeSelected(store, drag, key, action === 'nudgeFurther', zoom);
  if (action === 'deleteSelection') return deleteSelected(store, drag, repeat);
  if (action === 'duplicate') return duplicateSelected(store, drag, repeat);
  return selectAll(store, drag, repeat, say);
}
