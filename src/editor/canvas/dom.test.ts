// CORE-06, chat E1 (briefs 109 and 112): the canvas's binding (dom.ts) with the DOM stood in for: the geometry the frame
// was drawn with, in the pointer's CSS pixels; the pen's tap; every listener removed at unmount with its original
// callback (v3's "destroy removes every Pointer Events listener with its original callback",
// v3/tests/interactionPointer.test.js); a tap is one point though a compatibility click follows (v3's "%s tap creates
// one waypoint even if a compatibility click follows"); nothing on the down; and Escape's branch for the selection.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../adapters/io/format';
import type { Screen } from '../../adapters/render/overlays';
import { newLine, newPoint, newRoute, newScene, type IdSource, type Route } from '../../core/model/scene';
import { composeTimeline } from '../../core/timing/timeline';
import { NOTHING_SELECTED } from '../store/selection';
import { movePoints, penStep } from './commands';
import { createStore, type Store } from '../store/store';
import { bindCanvas, cancelDrag, deleteSelected, dragOpen, duplicateSelected, editKey, endNudge, escapeClears, holdOnPicture, selectAll, inCssPixels, MARKER_HALF, NUDGE, NUDGE_FURTHER, NUDGE_QUIET_MS, penTap, recordGeometry, toggleTap, zoomNow, type CanvasElement, type Geometry, type PointerFields } from './dom';
import type { Tap } from './gesture';
import { createHover, type Hover } from './hover';
import type { Modifiers, Under } from './pointer';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}${String((n += 1))}`;
}

const NONE: Modifiers = { alt: false, shift: false, meta: false };
const stop = (x: number, y: number) => ({ x, y, kind: 'stop' as const });

/** A route a → b, with c joined to nothing; a at (0.2, 0.2), b at (0.6, 0.6), c at (0.9, 0.1); and a second route. */
function scene() {
  const nextId = counter('seed');
  const [a, b, c] = [stop(0.2, 0.2), stop(0.6, 0.6), stop(0.9, 0.1)].map((each) => newPoint(nextId, each));
  if (a === undefined || b === undefined || c === undefined) throw new Error('three points');
  const route: Route = { ...newRoute(nextId), points: [a, b, c], lines: [newLine(nextId, a.id, b.id)], leadStart: a.id };
  const lone = newPoint(nextId, stop(0.4, 0.8));
  const other: Route = { ...newRoute(nextId), points: [lone], lines: [], leadStart: lone.id };
  const project: Project = { scene: { ...newScene(nextId), routes: [route, other] }, images: [] };
  const store = createStore({ project, nextId: counter('new') });
  return { store, route, other, a: a.id, b: b.id, c: c.id };
}

const routeOf = (store: Store, index = 0): Route => {
  const found = store.getState().project.scene.routes[index];
  if (found === undefined) throw new Error('no route');
  return found;
};

const tap = (under: Under, place = { x: 0.3, y: 0.7 }, modifiers = NONE): Tap => ({ at: { x: 0, y: 0 }, place, under, modifiers });

describe('the geometry the frame was drawn with', () => {
  const { route } = scene();
  const timeline = composeTimeline(route, 1000 / 800);
  const screen: Screen = {
    zoom: 2,
    place: (point) => ({ x: 100 + point.x * 800, y: 50 + point.y * 600 }),
    routes: new Map([[route.id, { shape: route, timeline, settings: route.settings }]]),
  };

  it('takes the image\'s bounds from where the frame\'s transform places its corners, its scale with the zoom, and each route as drawn', () => {
    const geometry = recordGeometry({ bounds: { x: 0, y: 0, width: 1, height: 1, scale: 0.5 }, scale: 1.5 }, screen);
    expect(geometry?.bounds).toEqual({ x: 100, y: 50, width: 800, height: 600, scale: 1 });
    expect(geometry?.routes).toHaveLength(1);
    expect(geometry?.routes[0]?.route).toEqual({ id: route.id, points: route.points, lines: route.lines });
    expect(geometry?.routes[0]?.timeline).toBe(timeline);
    expect(geometry?.routes[0]?.markerHalf).toBe(MARKER_HALF * 1.5 * 2);
    expect(MARKER_HALF * 2).toBe(30);
    // The screen's zoom is kept as it is, for the nudge (point 8): its step is divided by it.
    expect(geometry?.zoom).toBe(2);
  });

  it('is nothing when the transform places no corner', () => {
    expect(recordGeometry({ bounds: { x: 0, y: 0, width: 1, height: 1, scale: 1 }, scale: 1 }, { ...screen, place: () => null })).toBeNull();
  });

  it('is divided by the pixel ratio for the pointer\'s CSS pixels', () => {
    const geometry = recordGeometry({ bounds: { x: 0, y: 0, width: 1, height: 1, scale: 0.5 }, scale: 1.5 }, screen);
    if (geometry === null) throw new Error('a geometry');
    const css = inCssPixels(geometry, 2);
    expect(css.bounds).toEqual({ x: 50, y: 25, width: 400, height: 300, scale: 0.5 });
    expect(css.routes[0]?.markerHalf).toBe(22.5);
    expect(css.routes[0]?.timeline).toBe(timeline);
    expect(css.zoom).toBe(2);
  });
});

describe('the pen\'s tap', () => {
  it('on nothing with nothing selected places one point, joined to nothing, and selects it', () => {
    const { store, route } = scene();
    store.select(NOTHING_SELECTED);
    const command = penTap(store.getState(), tap(null));
    expect(command).not.toBeNull();
    if (command) expect(store.dispatch(command).ok).toBe(true);
    const after = routeOf(store);
    expect(after.points).toHaveLength(4);
    expect(after.points[3]).toMatchObject({ x: 0.3, y: 0.7, kind: 'stop' });
    expect(after.lines).toHaveLength(1);
    expect(store.getState().selection).toEqual({ route: route.id, points: [after.points[3]?.id] });
  });

  it('on nothing with one point selected places a point joined from it, and selects the new point alone', () => {
    const { store, route, c } = scene();
    store.select({ route: route.id, points: [c] });
    const command = penTap(store.getState(), tap(null));
    if (command) store.dispatch(command);
    const after = routeOf(store);
    const added = after.points[3]?.id;
    expect(after.lines.at(-1)).toMatchObject({ from: c, to: added });
    expect(store.getState().selection).toEqual({ route: route.id, points: [added] });
  });

  it('two taps on nothing: two points and one line, the second selected', () => {
    const { store, route } = scene();
    store.select(NOTHING_SELECTED);
    for (const place of [{ x: 0.1, y: 0.9 }, { x: 0.3, y: 0.9 }]) {
      const command = penTap(store.getState(), tap(null, place));
      if (command) store.dispatch(command);
    }
    const after = routeOf(store);
    const [first, second] = [after.points[3]?.id, after.points[4]?.id];
    expect(after.points).toHaveLength(5);
    expect(after.lines).toHaveLength(2);
    expect(after.lines[1]).toMatchObject({ from: first, to: second });
    expect(store.getState().selection).toEqual({ route: route.id, points: [second] });
  });

  it('with two points selected stands on none: the point placed is joined to nothing', () => {
    const { store, route, a, c } = scene();
    store.select({ route: route.id, points: [a, c] });
    const command = penTap(store.getState(), tap(null));
    if (command) store.dispatch(command);
    expect(routeOf(store).lines).toHaveLength(1);
  });

  it('on a point joins it from the pen, and selects it; on a point with no pen selects it; two joined points are not joined again', () => {
    const { store, route, a, b, c } = scene();
    store.select({ route: route.id, points: [c] });
    const join = penTap(store.getState(), tap({ kind: 'point', route: route.id, id: a }));
    if (join) store.dispatch(join);
    expect(routeOf(store).lines.at(-1)).toMatchObject({ from: c, to: a });
    expect(store.getState().selection).toEqual({ route: route.id, points: [a] });

    store.select(NOTHING_SELECTED);
    const pick = penTap(store.getState(), tap({ kind: 'point', route: route.id, id: b }));
    if (pick) store.dispatch(pick);
    expect(routeOf(store).lines).toHaveLength(2);
    expect(store.getState().selection).toEqual({ route: route.id, points: [b] });

    const again = penTap(store.getState(), tap({ kind: 'point', route: route.id, id: a }));
    if (again) store.dispatch(again);
    expect(routeOf(store).lines).toHaveLength(2);
    expect(store.getState().selection).toEqual({ route: route.id, points: [a] });
  });

  it('means nothing on a line off its "+", on another route\'s point, or with a modifier held', () => {
    const { store, route, other } = scene();
    const line = route.lines[0]?.id ?? '';
    expect(penTap(store.getState(), tap({ kind: 'line', route: route.id, id: line }))).toBeNull();
    expect(penTap(store.getState(), tap({ kind: 'point', route: other.id, id: other.points[0]?.id ?? '' }))).toBeNull();
    for (const held of [{ ...NONE, alt: true }, { ...NONE, shift: true }, { ...NONE, meta: true }]) {
      expect(penTap(store.getState(), tap(null, { x: 0.5, y: 0.5 }, held))).toBeNull();
    }
  });

  // Brief 120, ruling Z: a tap on the "+" of the first route's line inserts a bend there (v3's minor waypoint), selected
  // alone, one step; a, b and their line a → b, its "+" at (0.4, 0.4) by the hit test.
  it('on a line\'s "+" inserts a bend at the "+"\'s place, not the tap\'s, selected alone, one undo step, whatever the pen stood on', () => {
    const { store, route, a, b, c } = scene();
    store.select({ route: route.id, points: [c] });
    const line = route.lines[0]?.id ?? '';
    const command = penTap(store.getState(), tap({ kind: 'line', route: route.id, id: line, plus: { x: 0.4, y: 0.4 } }, { x: 0.41, y: 0.42 }));
    expect(command).not.toBeNull();
    if (command) expect(store.dispatch(command).ok).toBe(true);
    const after = routeOf(store);
    expect(after.points).toHaveLength(4);
    const added = after.points.find((point) => ![a, b, c].includes(point.id));
    expect(added).toMatchObject({ x: 0.4, y: 0.4, kind: 'bend' });
    expect(after.lines.map(({ from, to }) => [from, to])).toEqual([[a, added?.id], [added?.id, b]]);
    expect(store.getState().selection).toEqual({ route: route.id, points: [added?.id] });
    expect(store.undo().ok).toBe(true);
    expect(routeOf(store)).toEqual(route);
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
  });

  // Brief 121, ruling AE (CODEX-LIST-CORE-06 line 33): the "+" inserts only where it is drawn, on the selected route
  // (point 4d draws it for a hovered line of the selected route only): any points of it selected, or none.
  it('on a line\'s "+" inserts while its route is selected, with several of its points selected or none', () => {
    for (const picked of ['several', 'none'] as const) {
      const { store, route, a, b, c } = scene();
      store.select({ route: route.id, points: picked === 'several' ? [a, c] : [] });
      const line = route.lines[0]?.id ?? '';
      const command = penTap(store.getState(), tap({ kind: 'line', route: route.id, id: line, plus: { x: 0.4, y: 0.4 } }, { x: 0.4, y: 0.4 }));
      expect(command, picked).not.toBeNull();
      if (command) expect(store.dispatch(command).ok).toBe(true);
      const added = routeOf(store).points.find((point) => ![a, b, c].includes(point.id));
      expect(added, picked).toMatchObject({ x: 0.4, y: 0.4, kind: 'bend' });
      expect(store.getState().selection).toEqual({ route: route.id, points: [added?.id] });
    }
  });

  it('on a line\'s "+" means nothing with nothing selected, or with another route selected', () => {
    const { store, route, other } = scene();
    const line = route.lines[0]?.id ?? '';
    const plus = { x: 0.4, y: 0.4 };
    const onPlus = tap({ kind: 'line', route: route.id, id: line, plus }, plus);
    store.select(NOTHING_SELECTED);
    expect(penTap(store.getState(), onPlus)).toBeNull();
    store.select({ route: other.id, points: [other.points[0]?.id ?? ''] });
    expect(penTap(store.getState(), onPlus)).toBeNull();
    store.select({ route: other.id, points: [] });
    expect(penTap(store.getState(), onPlus)).toBeNull();
  });

  it('on a line\'s "+" with a modifier held, or on another route\'s line, means nothing', () => {
    const { store, route, other } = scene();
    const line = route.lines[0]?.id ?? '';
    const plus = { x: 0.4, y: 0.4 };
    for (const held of [{ ...NONE, alt: true }, { ...NONE, shift: true }, { ...NONE, meta: true }]) {
      expect(penTap(store.getState(), tap({ kind: 'line', route: route.id, id: line, plus }, plus, held))).toBeNull();
    }
    expect(penTap(store.getState(), tap({ kind: 'line', route: other.id, id: line, plus }, plus))).toBeNull();
  });

  it('holds a "+" place beyond the picture to its edge (D237)', () => {
    const { store, route } = scene();
    store.select({ route: route.id, points: [] });
    const line = route.lines[0]?.id ?? '';
    const command = penTap(store.getState(), tap({ kind: 'line', route: route.id, id: line, plus: { x: -0.1, y: 1.2 } }, { x: 0.5, y: 0.5 }));
    if (command) store.dispatch(command);
    expect(routeOf(store).points[3]).toMatchObject({ x: 0, y: 1, kind: 'bend' });
  });

  it('holds a place beyond the picture to its edge (D237)', () => {
    const { store } = scene();
    store.select(NOTHING_SELECTED);
    const command = penTap(store.getState(), tap(null, { x: -0.2, y: 1.3 }));
    if (command) store.dispatch(command);
    expect(routeOf(store).points[3]).toMatchObject({ x: 0, y: 1 });
  });

  it('draws on the scene\'s first route, and means nothing on a scene with none', () => {
    const { store } = scene();
    const empty = { ...store.getState(), project: { ...store.getState().project, scene: { ...store.getState().project.scene, routes: [] } } };
    expect(penTap(empty, tap(null))).toBeNull();
  });
});

type Listener = (event: PointerFields) => void;

/** A stand-in event target: every listener added and removed, by type and callback. */
function target() {
  const added: [string, Listener][] = [];
  const removed: [string, Listener][] = [];
  const live = new Map<string, Set<Listener>>();
  return {
    added,
    removed,
    live,
    addEventListener(type: string, listener: Listener) {
      added.push([type, listener]);
      live.set(type, (live.get(type) ?? new Set()).add(listener));
    },
    removeEventListener(type: string, listener: Listener) {
      removed.push([type, listener]);
      live.get(type)?.delete(listener);
    },
    fire(type: string, event: Partial<PointerFields> = {}) {
      const full: PointerFields = { pointerId: 1, isPrimary: true, button: 0, clientX: 0, clientY: 0, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false, ...event };
      for (const listener of [...(live.get(type) ?? [])]) listener(full);
    },
    count: () => [...live.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

/** A canvas 2000 device pixels wide drawn 1000 CSS pixels wide (ratio 2), its top left at (10, 20) on the page. */
function canvasStandIn() {
  const events = target();
  const captured = new Set<number>();
  const canvas: CanvasElement<PointerFields> & typeof events & { captured: Set<number> } = {
    ...events,
    captured,
    width: 2000,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 1000 }),
    setPointerCapture: (id) => captured.add(id),
    releasePointerCapture: (id) => captured.delete(id),
    hasPointerCapture: (id) => captured.has(id),
  };
  return canvas;
}

/** The frame drawn over the whole canvas: the image 2000 by 1600 canvas pixels, so 1000 by 800 CSS pixels. */
function drawnOf(store: Store): Geometry {
  const route = routeOf(store);
  return {
    bounds: { x: 0, y: 0, width: 2000, height: 1600, scale: 2 },
    routes: [{ route, timeline: composeTimeline(route, 1000 / 800), markerHalf: 30 }],
    zoom: 1,
  };
}

function bound(geometry: (store: Store) => Geometry | null = drawnOf, mac = true) {
  const made = scene();
  const canvas = canvasStandIn();
  const win = target();
  const unbind = bindCanvas({ canvas, win, store: made.store, geometry: () => geometry(made.store), refresh: () => true, mac });
  return { ...made, canvas, win, unbind };
}

/**
 * Bound to a frame held as it was painted (Codex line 18): the geometry is what the last paint recorded, and only
 * `refresh` (the page's paint now) records it again, so a tap before the next frame sees the frame, not the store.
 */
function boundHeld() {
  const made = scene();
  const canvas = canvasStandIn();
  const win = target();
  let painted = drawnOf(made.store);
  let paints = 0;
  let failing = false;
  const refresh = () => {
    paints += 1;
    if (failing) return false;
    painted = drawnOf(made.store);
    return true;
  };
  const unbind = bindCanvas({ canvas, win, store: made.store, geometry: () => painted, refresh, mac: true });
  return { ...made, canvas, win, unbind, paints: () => paints, fail: (now: boolean) => { failing = now; } };
}

/** The page's place of an image point: CSS pixels plus the canvas's offset. */
const client = (x: number, y: number) => ({ clientX: 10 + x * 1000, clientY: 20 + y * 800 });

describe('the canvas\'s binding', () => {
  it('listens on the canvas for the five pointer events and on the window for up, cancel and blur, and no click', () => {
    const { canvas, win, unbind } = bound();
    expect(canvas.added.map(([type]) => type)).toEqual(['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']);
    expect(win.added.map(([type]) => type)).toEqual(['pointerup', 'pointercancel', 'blur']);
    expect([...canvas.added, ...win.added].some(([type]) => type === 'click')).toBe(false);
    unbind();
  });

  it('removes every listener at unmount with its original callback; mounted twice (strict mode), one binding is left', () => {
    const { canvas, win, unbind, store } = bound();
    unbind();
    for (const each of [canvas, win]) {
      expect(each.removed).toEqual(each.added);
      expect(each.count()).toBe(0);
    }
    const again = bindCanvas({ canvas, win, store, geometry: () => drawnOf(store), refresh: () => true, mac: true });
    expect(canvas.count()).toBe(5);
    expect(win.count()).toBe(3);
    again();
    expect(canvas.count() + win.count()).toBe(0);
  });

  it('a tap on nothing places one point on the up, none on the down, though a compatibility click follows', () => {
    const { canvas, store, unbind } = bound();
    store.select(NOTHING_SELECTED);
    canvas.fire('pointerdown', client(0.3, 0.7));
    expect(routeOf(store).points).toHaveLength(3);
    expect(canvas.captured.has(1)).toBe(true);
    canvas.fire('pointerup', client(0.3, 0.7));
    canvas.fire('click', client(0.3, 0.7));
    const after = routeOf(store);
    expect(after.points).toHaveLength(4);
    expect(after.points[3]?.x).toBeCloseTo(0.3);
    expect(after.points[3]?.y).toBeCloseTo(0.7);
    expect(canvas.captured.has(1)).toBe(false);
    unbind();
  });

  it('the up the canvas heard and the window heard again places one point, not two', () => {
    const { canvas, win, store, unbind } = bound();
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointerup', client(0.3, 0.7));
    win.fire('pointerup', client(0.3, 0.7));
    expect(routeOf(store).points).toHaveLength(4);
    unbind();
  });

  it('a press moved past the threshold and released places nothing; an up beyond the canvas\'s box, heard only by the window, ends the press', () => {
    const { canvas, win, store, unbind } = bound();
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointermove', { clientX: 10 + 300 + 40, clientY: 20 + 560 });
    canvas.fire('pointerup', { clientX: 10 + 300 + 40, clientY: 20 + 560 });
    expect(routeOf(store).points).toHaveLength(3);
    // The canvas's box is (10, 20) to (1010, 820) on the page: this up is beyond its right edge and below it.
    canvas.fire('pointerdown', client(0.3, 0.7));
    win.fire('pointerup', { clientX: 1010 + 50, clientY: 820 + 50 });
    expect(routeOf(store).points).toHaveLength(3);
    expect(canvas.captured.size).toBe(0);
    expect(store.getState().gesture).toBeNull();
    // The press is over: the next tap is heard as a tap.
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointerup', client(0.3, 0.7));
    expect(routeOf(store).points).toHaveLength(4);
    unbind();
  });

  it('hit-tests the down in CSS pixels against the frame drawn: a tap on a point selects it, a tap beside it adds one', () => {
    const { canvas, store, unbind, c, route } = bound();
    store.select(NOTHING_SELECTED);
    canvas.fire('pointerdown', client(0.9, 0.1));
    canvas.fire('pointerup', client(0.9, 0.1));
    expect(routeOf(store).points).toHaveLength(3);
    expect(store.getState().selection).toEqual({ route: route.id, points: [c] });
    // c is drawn at (900, 80) CSS pixels, its marker 15 CSS pixels from its centre: 40 to its right is beside it.
    canvas.fire('pointerdown', { clientX: 10 + 940, clientY: 20 + 80 });
    canvas.fire('pointerup', { clientX: 10 + 940, clientY: 20 + 80 });
    const after = routeOf(store);
    expect(after.points).toHaveLength(4);
    const added = after.points[3];
    expect(added?.x).toBeCloseTo(0.94);
    expect(added?.y).toBeCloseTo(0.1);
    expect(after.lines.some((line) => line.from === c && line.to === added?.id)).toBe(true);
    expect(store.getState().selection).toEqual({ route: route.id, points: [added?.id] });
    unbind();
  });

  it('takes no down before a frame is drawn', () => {
    const { canvas, store, unbind } = bound(() => null);
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointerup', client(0.3, 0.7));
    expect(routeOf(store).points).toHaveLength(3);
    expect(canvas.captured.size).toBe(0);
    unbind();
  });

  it('a cancel or a blur during a press places nothing', () => {
    const { canvas, win, store, unbind } = bound();
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointercancel', client(0.3, 0.7));
    canvas.fire('pointerup', client(0.3, 0.7));
    canvas.fire('pointerdown', client(0.3, 0.7));
    win.fire('blur');
    canvas.fire('pointerup', client(0.3, 0.7));
    expect(routeOf(store).points).toHaveLength(3);
    unbind();
  });

  it('unbound mid-drag, cancels the drag first: nothing moved, no gesture open, no step, capture released; bound again, an edit is taken (Codex line 17)', () => {
    const { canvas, win, store, unbind } = bound();
    store.select(NOTHING_SELECTED);
    const before = store.getState().project;
    canvas.fire('pointerdown', client(0.6, 0.6));
    canvas.fire('pointermove', { clientX: 10 + 600 + 20, clientY: 20 + 480 });
    expect(dragOpen()).toBe(true);
    expect(store.getState().gesture).toBe('Move point');
    unbind();
    expect(dragOpen()).toBe(false);
    expect(store.getState().gesture).toBeNull();
    expect(store.getState().project).toEqual(before);
    expect(canvas.captured.size).toBe(0);
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
    const again = bindCanvas({ canvas, win, store, geometry: () => drawnOf(store), refresh: () => true, mac: true });
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointerup', client(0.3, 0.7));
    expect(routeOf(store).points).toHaveLength(4);
    again();
  });

  it('two taps on the same empty place before the next frame: one point, the second tap on it (Codex line 18)', () => {
    const { canvas, store, unbind, paints } = boundHeld();
    store.select(NOTHING_SELECTED);
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointerup', client(0.3, 0.7));
    expect(routeOf(store).points).toHaveLength(4);
    // No frame between the taps: only the binding's own refresh may record the store's point.
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointerup', client(0.3, 0.7));
    const after = routeOf(store);
    expect(after.points).toHaveLength(4);
    expect(after.lines).toHaveLength(1);
    expect(paints()).toBeGreaterThan(0);
    unbind();
  });

  it('a good frame, a store edit, then a refresh that does not record: the down places nothing and joins nothing; once a paint records, a tap on another empty place adds its point and line (Codex lines 22 and 27)', () => {
    const { canvas, store, unbind, fail } = boundHeld();
    store.select(NOTHING_SELECTED);
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointerup', client(0.3, 0.7));
    expect(routeOf(store).points).toHaveLength(4);
    fail(true);
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointerup', client(0.3, 0.7));
    expect(routeOf(store).points).toHaveLength(4);
    expect(routeOf(store).lines).toHaveLength(1);
    expect(canvas.captured.size).toBe(0);
    const placed = routeOf(store).points[3];
    expect(placed).toMatchObject({ x: 0.3, y: 0.7 });
    fail(false);
    canvas.fire('pointerdown', client(0.5, 0.3));
    canvas.fire('pointerup', client(0.5, 0.3));
    const after = routeOf(store);
    expect(after.points).toHaveLength(5);
    const added = after.points[4];
    expect(added).toMatchObject({ x: 0.5, y: 0.3 });
    expect(after.lines).toHaveLength(2);
    expect(after.lines[1]).toMatchObject({ from: placed?.id, to: added?.id });
    expect(store.getState().selection.points).toEqual([added?.id]);
    unbind();
  });

  for (const mac of [true, false]) {
    it(`a tap with any modifier held places nothing, ${mac ? 'on a Mac' : 'elsewhere'}: Ctrl, Meta, Alt or Shift (Codex line 19)`, () => {
      const { canvas, store, unbind } = bound(drawnOf, mac);
      store.select(NOTHING_SELECTED);
      for (const held of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
        canvas.fire('pointerdown', { ...client(0.3, 0.7), ...held });
        canvas.fire('pointerup', { ...client(0.3, 0.7), ...held });
        expect(routeOf(store).points, JSON.stringify(held)).toHaveLength(3);
      }
      canvas.fire('pointerdown', client(0.3, 0.7));
      canvas.fire('pointerup', client(0.3, 0.7));
      expect(routeOf(store).points).toHaveLength(4);
      unbind();
    });
  }
});

/** Where a point of the first route is now. */
const placeOf = (store: Store, id: string) => {
  const point = routeOf(store).points.find((each) => each.id === id);
  return point === undefined ? undefined : { x: point.x, y: point.y };
};

describe('a point\'s drag (point 5; brief 115, ruling T)', () => {
  it('a press on a point moved and released moves it there, selected, as one step; no point placed, nothing joined', () => {
    const { canvas, store, unbind, route, b } = bound();
    store.select(NOTHING_SELECTED);
    canvas.fire('pointerdown', client(0.6, 0.6));
    canvas.fire('pointermove', client(0.62, 0.58));
    canvas.fire('pointermove', client(0.7, 0.45));
    canvas.fire('pointerup', client(0.7, 0.45));
    const after = placeOf(store, b);
    expect(after?.x).toBeCloseTo(0.7, 9);
    expect(after?.y).toBeCloseTo(0.45, 9);
    expect(routeOf(store).points).toHaveLength(3);
    expect(routeOf(store).lines).toHaveLength(1);
    expect(store.getState().selection).toEqual({ route: route.id, points: [b] });
    expect(store.getState().gesture).toBeNull();
    expect(canvas.captured.size).toBe(0);
    expect(store.getState().undo).toBe('Move point');
    expect(store.undo().ok).toBe(true);
    expect(placeOf(store, b)).toEqual({ x: 0.6, y: 0.6 });
    unbind();
  });

  it('Escape mid-drag (`cancelDrag`): the place and the selection put back, nothing to undo, capture released, and the later move and up do nothing', () => {
    const { canvas, store, unbind, route, a, b } = bound();
    const picked = { route: route.id, points: [a] };
    store.select(picked);
    const before = store.getState().project;
    expect(cancelDrag()).toBe(false);
    canvas.fire('pointerdown', client(0.6, 0.6));
    canvas.fire('pointermove', client(0.7, 0.45));
    expect(dragOpen()).toBe(true);
    expect(placeOf(store, b)?.x).toBeCloseTo(0.7, 9);
    expect(canvas.captured.size).toBe(1);
    expect(cancelDrag()).toBe(true);
    expect(dragOpen()).toBe(false);
    expect(store.getState().project).toEqual(before);
    expect(store.getState().selection).toEqual(picked);
    expect(store.getState().gesture).toBeNull();
    expect(canvas.captured.size).toBe(0);
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
    canvas.fire('pointermove', client(0.8, 0.3));
    canvas.fire('pointerup', client(0.8, 0.3));
    expect(store.getState().project).toEqual(before);
    expect(store.getState().selection).toEqual(picked);
    expect(cancelDrag()).toBe(false);
    unbind();
  });

  it('is held to the picture as the tap\'s place is (D237): a point dragged beyond an edge stops at it', () => {
    const { canvas, store, unbind, b } = bound();
    store.select(NOTHING_SELECTED);
    canvas.fire('pointerdown', client(0.6, 0.6));
    canvas.fire('pointermove', client(1.3, -0.2));
    canvas.fire('pointerup', client(1.3, -0.2));
    expect(placeOf(store, b)).toEqual({ x: 1, y: 0 });
    unbind();
  });

  it('holds a group\'s whole movement so every point stays on the picture, each axis on its own, the group keeping its shape', () => {
    const starts = [{ id: 'p', x: 0.2, y: 0.5 }, { id: 'q', x: 0.9, y: 0.4 }];
    const right = holdOnPicture(starts, 0.3, 0.1);
    expect(right.dx).toBeCloseTo(0.1, 12);
    expect(right.dy).toBe(0.1);
    expect(holdOnPicture(starts, -0.5, -0.6)).toEqual({ dx: -0.2, dy: -0.4 });
    expect(holdOnPicture(starts, 0.05, 0.7)).toEqual({ dx: 0.05, dy: 0.5 });
    expect(holdOnPicture([], 3, -3)).toEqual({ dx: 3, dy: -3 });
  });
});

// Brief 122, ruling AH: a tap on a point of the first route with the platform's command key held, and no Alt and no
// Shift, toggles it in or out of the selection (v3's Cmd/Ctrl+click, InteractionHandler.js:668-672); never a step.
describe('the command key\'s toggle (point 2; brief 122, ruling AH)', () => {
  const COMMAND: Modifiers = { ...NONE, meta: true };
  const on = (route: string, id: string, modifiers = COMMAND) => tap({ kind: 'point', route, id }, { x: 0.5, y: 0.5 }, modifiers);

  it('adds a point of the selected route at the end', () => {
    const { store, route, a, b } = scene();
    store.select({ route: route.id, points: [a] });
    expect(toggleTap(store.getState(), on(route.id, b))).toEqual({ route: route.id, points: [a, b] });
    store.select({ route: route.id, points: [] });
    expect(toggleTap(store.getState(), on(route.id, b))).toEqual({ route: route.id, points: [b] });
  });

  it('takes a selected point out, the others\' order kept', () => {
    const { store, route, a, b, c } = scene();
    store.select({ route: route.id, points: [c, b, a] });
    expect(toggleTap(store.getState(), on(route.id, b))).toEqual({ route: route.id, points: [c, a] });
  });

  it('takes out the last selected point: nothing selected, as Escape leaves it', () => {
    const { store, route, b } = scene();
    store.select({ route: route.id, points: [b] });
    expect(toggleTap(store.getState(), on(route.id, b))).toEqual(NOTHING_SELECTED);
  });

  it('with nothing selected, or another route selected, selects that point alone', () => {
    const { store, route, other, b } = scene();
    store.select(NOTHING_SELECTED);
    expect(toggleTap(store.getState(), on(route.id, b))).toEqual({ route: route.id, points: [b] });
    store.select({ route: other.id, points: [other.points[0]?.id ?? ''] });
    expect(toggleTap(store.getState(), on(route.id, b))).toEqual({ route: route.id, points: [b] });
  });

  it('means nothing with Shift or Alt held beside the command key, or with no command key', () => {
    const { store, route, a, b } = scene();
    store.select({ route: route.id, points: [a] });
    for (const held of [{ ...COMMAND, shift: true }, { ...COMMAND, alt: true }, { ...NONE, shift: true }, { ...NONE, alt: true }, NONE]) {
      expect(toggleTap(store.getState(), on(route.id, b, held)), JSON.stringify(held)).toBeNull();
    }
  });

  it('means nothing on nothing, on a line, on its "+", or on another route\'s point', () => {
    const { store, route, other, a } = scene();
    store.select({ route: route.id, points: [a] });
    const line = route.lines[0]?.id ?? '';
    const plus = { x: 0.4, y: 0.4 };
    expect(toggleTap(store.getState(), tap(null, plus, COMMAND))).toBeNull();
    expect(toggleTap(store.getState(), tap({ kind: 'line', route: route.id, id: line }, plus, COMMAND))).toBeNull();
    expect(toggleTap(store.getState(), tap({ kind: 'line', route: route.id, id: line, plus }, plus, COMMAND))).toBeNull();
    expect(toggleTap(store.getState(), on(other.id, other.points[0]?.id ?? ''))).toBeNull();
  });

  for (const mac of [true, false]) {
    const command = mac ? { metaKey: true } : { ctrlKey: true };
    const notCommand = mac ? { ctrlKey: true } : { metaKey: true };
    it(`on the page ${mac ? 'on a Mac, Cmd' : 'elsewhere, Ctrl'} toggles a point with no step; ${mac ? 'Ctrl' : 'Meta'}, Shift and Alt beside it, and taps off a point, do nothing`, () => {
      const { canvas, store, unbind, route, a, b } = bound(drawnOf, mac);
      store.select({ route: route.id, points: [a] });
      const project = store.getState().project;
      const tapAt = (x: number, y: number, held: Partial<PointerFields>) => {
        canvas.fire('pointerdown', { ...client(x, y), ...held });
        canvas.fire('pointerup', { ...client(x, y), ...held });
      };
      for (const held of [notCommand, { ...command, shiftKey: true }, { ...command, altKey: true }]) {
        tapAt(0.6, 0.6, held);
        expect(store.getState().selection, JSON.stringify(held)).toEqual({ route: route.id, points: [a] });
      }
      tapAt(0.3, 0.7, command);
      tapAt(0.4, 0.4, command);
      expect(store.getState().selection).toEqual({ route: route.id, points: [a] });
      tapAt(0.6, 0.6, command);
      expect(store.getState().selection).toEqual({ route: route.id, points: [a, b] });
      tapAt(0.2, 0.2, command);
      expect(store.getState().selection).toEqual({ route: route.id, points: [b] });
      tapAt(0.6, 0.6, command);
      expect(store.getState().selection).toEqual(NOTHING_SELECTED);
      expect(store.getState().project).toBe(project);
      expect(store.getState().undo).toBeNull();
      unbind();
    });
  }

  it('two points picked by the command key move together under a plain drag of one, as one step that one Undo puts back', () => {
    const { canvas, store, unbind, route, a, b } = bound();
    store.select(NOTHING_SELECTED);
    for (const [x, y] of [[0.2, 0.2], [0.6, 0.6]] as const) {
      canvas.fire('pointerdown', { ...client(x, y), metaKey: true });
      canvas.fire('pointerup', { ...client(x, y), metaKey: true });
    }
    expect(store.getState().selection).toEqual({ route: route.id, points: [a, b] });
    expect(store.getState().undo).toBeNull();
    canvas.fire('pointerdown', client(0.6, 0.6));
    canvas.fire('pointermove', client(0.65, 0.55));
    canvas.fire('pointermove', client(0.7, 0.5));
    canvas.fire('pointerup', client(0.7, 0.5));
    expect(placeOf(store, b)?.x).toBeCloseTo(0.7, 9);
    expect(placeOf(store, b)?.y).toBeCloseTo(0.5, 9);
    expect(placeOf(store, a)?.x).toBeCloseTo(0.3, 9);
    expect(placeOf(store, a)?.y).toBeCloseTo(0.1, 9);
    expect(routeOf(store).points).toHaveLength(3);
    expect(store.getState().undo).toBe('Move points');
    expect(store.undo().ok).toBe(true);
    expect(placeOf(store, a)).toEqual({ x: 0.2, y: 0.2 });
    expect(placeOf(store, b)).toEqual({ x: 0.6, y: 0.6 });
    expect(store.getState().undo).toBeNull();
    unbind();
  });
});

describe('Escape', () => {
  const escape = { key: 'Escape', defaultPrevented: false };
  const free = { typing: false, dialogOpen: false };

  it('with something selected clears the selection and is taken; with nothing selected is not', () => {
    const { store, route, b } = scene();
    store.select({ route: route.id, points: [b] });
    expect(escapeClears(escape, free, false, store)).toBe(true);
    expect(store.getState().selection).toEqual(NOTHING_SELECTED);
    expect(escapeClears(escape, free, false, store)).toBe(false);
  });

  it('does nothing for typed text, an open dialog, an open drag, a key already taken or another key', () => {
    const { store, route, b } = scene();
    const picked = { route: route.id, points: [b] };
    store.select(picked);
    expect(escapeClears(escape, { ...free, typing: true }, false, store)).toBe(false);
    expect(escapeClears(escape, { ...free, dialogOpen: true }, false, store)).toBe(false);
    expect(escapeClears(escape, free, true, store)).toBe(false);
    expect(escapeClears({ ...escape, defaultPrevented: true }, free, false, store)).toBe(false);
    expect(escapeClears({ ...escape, key: 'Enter' }, free, false, store)).toBe(false);
    expect(store.getState().selection).toEqual(picked);
  });

  it('after Escape the next tap on nothing starts a new point joined to nothing', () => {
    const { canvas, store, unbind, route, b } = bound();
    store.select({ route: route.id, points: [b] });
    escapeClears(escape, free, dragOpen(), store);
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointerup', client(0.3, 0.7));
    expect(routeOf(store).lines).toHaveLength(1);
    unbind();
  });

  it('a drag of a point is open while it moves: Escape leaves the selection to it', () => {
    const { canvas, store, unbind, route, b } = bound();
    store.select(NOTHING_SELECTED);
    canvas.fire('pointerdown', client(0.6, 0.6));
    canvas.fire('pointermove', { clientX: 10 + 600 + 20, clientY: 20 + 480 });
    expect(dragOpen()).toBe(true);
    expect(escapeClears(escape, free, dragOpen(), store)).toBe(false);
    expect(store.getState().selection).toEqual({ route: route.id, points: [b] });
    canvas.fire('pointerup', { clientX: 10 + 600 + 20, clientY: 20 + 480 });
    expect(dragOpen()).toBe(false);
    unbind();
  });
});

describe('the Editing keys (point 7; brief 123, ruling AO)', () => {
  /** A store whose project's scene holds `routes` (none, or one empty route). */
  const bare = (routes: 'none' | 'empty') => {
    const nextId = counter('bare');
    const made = newScene(nextId);
    const project: Project = { scene: { ...made, routes: routes === 'none' ? [] : made.routes }, images: [] };
    return createStore({ project, nextId: counter('new') });
  };
  const at = (store: Store, id: string) => placeOf(store, id) ?? { x: Number.NaN, y: Number.NaN };

  it('Delete: the selected points of the route deleted as one step, the route kept selected; one Undo puts them back with their lines', () => {
    const { store, route, a, b, c } = scene();
    store.select({ route: route.id, points: [a] });
    const before = store.getState().project;
    expect(editKey('deleteSelection', false, store, false)).toBe(true);
    expect(routeOf(store).points.map(({ id }) => id)).toEqual([b, c]);
    expect(routeOf(store).lines).toHaveLength(0);
    expect(store.getState().selection).toEqual({ route: route.id, points: [] });
    expect(store.getState().undo).toBe('Delete point');
    expect(store.undo().ok).toBe(true);
    expect(store.getState().project).toEqual(before);
  });

  it('Delete of a point between two lines closes them up (the command’s own rule)', () => {
    const { store, route, a, b, c } = scene();
    expect(store.dispatch(penStep(route.id, b, { point: c })).ok).toBe(true);
    store.select({ route: route.id, points: [b] });
    expect(editKey('deleteSelection', false, store, false)).toBe(true);
    expect(routeOf(store).lines.map(({ from, to }) => [from, to])).toEqual([[a, c]]);
  });

  it('Delete of several: one step, "Delete points"', () => {
    const { store, route, a, b } = scene();
    store.select({ route: route.id, points: [a, b] });
    expect(editKey('deleteSelection', false, store, false)).toBe(true);
    expect(routeOf(store).points).toHaveLength(1);
    expect(store.getState().undo).toBe('Delete points');
    expect(store.undo().ok).toBe(true);
    expect(routeOf(store).points).toHaveLength(3);
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
  });

  it('Duplicate: copies 2% right and down, with the lines between them, become the selection; one gesture, one step, one Undo', () => {
    const { store, route, a, b } = scene();
    store.select({ route: route.id, points: [a, b] });
    const before = store.getState().project;
    expect(editKey('duplicate', false, store, false)).toBe(true);
    const copies = store.getState().selection.points;
    expect(store.getState().selection.route).toBe(route.id);
    expect(copies).toHaveLength(2);
    expect(routeOf(store).points).toHaveLength(5);
    expect(routeOf(store).lines.map(({ from, to }) => [from, to])).toContainEqual([copies[0], copies[1]]);
    expect(at(store, copies[0] ?? '').x).toBeCloseTo(0.22, 9);
    expect(at(store, copies[0] ?? '').y).toBeCloseTo(0.22, 9);
    expect(at(store, copies[1] ?? '').x).toBeCloseTo(0.62, 9);
    expect(store.getState().gesture).toBeNull();
    expect(store.getState().undo).toBe('Duplicate');
    expect(store.undo().ok).toBe(true);
    expect(store.getState().project).toEqual(before);
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
  });

  it('Duplicate at the picture’s edge: a copy of a point at x 0.99 is held at 1, not 1.01; still one step, one Undo', () => {
    const { store, route, c } = scene();
    expect(store.dispatch(movePoints(route.id, [c], 0.09, 0)).ok).toBe(true);
    store.select({ route: route.id, points: [c] });
    const before = store.getState().project;
    expect(editKey('duplicate', false, store, false)).toBe(true);
    const [copy] = store.getState().selection.points;
    expect(at(store, copy ?? '').x).toBeCloseTo(1, 9);
    expect(at(store, copy ?? '').y).toBeCloseTo(0.12, 9);
    expect(store.getState().undo).toBe('Duplicate');
    expect(store.undo().ok).toBe(true);
    expect(store.getState().project).toEqual(before);
    expect(store.getState().undo).toBe('Move point');
  });

  it('Duplicate of a group of two at the right edge keeps their spacing (held as a group, D237)', () => {
    const { store, route, b, c } = scene();
    expect(store.dispatch(movePoints(route.id, [c], 0.09, 0)).ok).toBe(true);
    store.select({ route: route.id, points: [b, c] });
    expect(editKey('duplicate', false, store, false)).toBe(true);
    const [copyB, copyC] = store.getState().selection.points;
    expect(at(store, copyC ?? '').x).toBeCloseTo(1, 9);
    expect(at(store, copyB ?? '').x).toBeCloseTo(0.61, 9);
    expect(at(store, copyB ?? '').y).toBeCloseTo(0.62, 9);
    expect(at(store, copyC ?? '').y).toBeCloseTo(0.12, 9);
  });

  it('Duplicate while a gesture is open: begin is refused, nothing changes, and the key is still taken', () => {
    const { store, route, a } = scene();
    store.select({ route: route.id, points: [a] });
    const begun = store.begin('Other');
    const before = store.getState().project;
    expect(editKey('duplicate', false, store, false)).toBe(true);
    expect(store.getState().project).toBe(before);
    expect(store.getState().gesture).toBe('Other');
    if (begun.ok) begun.gesture.cancel();
  });

  it('Select all: every point of the route selected in its order, never a step; taken again when all are selected', () => {
    const { store, route, a, b, c } = scene();
    store.select(NOTHING_SELECTED);
    expect(editKey('selectAll', false, store, false)).toBe(true);
    expect(store.getState().selection).toEqual({ route: route.id, points: [a, b, c] });
    expect(editKey('selectAll', false, store, false)).toBe(true);
    expect(store.getState().selection).toEqual({ route: route.id, points: [a, b, c] });
    expect(store.getState().undo).toBeNull();
  });

  it('Select all from a selection on another route moves it to the first route', () => {
    const { store, route, other, a, b, c } = scene();
    store.select({ route: other.id, points: [other.points[0]?.id ?? ''] });
    expect(selectAll(store, false)).toBe(true);
    expect(store.getState().selection).toEqual({ route: route.id, points: [a, b, c] });
  });

  it('with nothing selected, or only another route’s point, Delete and Duplicate are not taken and nothing changes', () => {
    const { store, other } = scene();
    for (const selection of [NOTHING_SELECTED, { route: other.id, points: [other.points[0]?.id ?? ''] }]) {
      store.select(selection);
      const before = store.getState();
      expect(editKey('deleteSelection', false, store, false)).toBe(false);
      expect(editKey('duplicate', false, store, false)).toBe(false);
      expect(store.getState()).toBe(before);
    }
  });

  it('the route selected with none of its points: Delete and Duplicate are not taken', () => {
    const { store, route } = scene();
    store.select({ route: route.id, points: [] });
    expect(deleteSelected(store, false)).toBe(false);
    expect(duplicateSelected(store, false)).toBe(false);
    expect(store.getState().undo).toBeNull();
  });

  it('Select all is not taken when the scene has no route or its route no point', () => {
    for (const routes of ['none', 'empty'] as const) {
      const store = bare(routes);
      const before = store.getState();
      expect(editKey('selectAll', false, store, false)).toBe(false);
      expect(store.getState()).toBe(before);
    }
  });

  it('none acts while a drag is open, and none is taken then', () => {
    const { canvas, store, unbind, route, a, b } = bound();
    store.select({ route: route.id, points: [a, b] });
    canvas.fire('pointerdown', client(0.6, 0.6));
    canvas.fire('pointermove', client(0.7, 0.45));
    expect(dragOpen()).toBe(true);
    const during = store.getState();
    for (const action of ['deleteSelection', 'duplicate', 'selectAll'] as const) {
      expect(editKey(action, false, store, dragOpen()), action).toBe(false);
    }
    expect(store.getState()).toBe(during);
    canvas.fire('pointerup', client(0.7, 0.45));
    unbind();
  });

  it('a held key’s repeat acts no more, and is taken exactly when its first press would be', () => {
    const { store, route, a } = scene();
    store.select({ route: route.id, points: [a] });
    const before = store.getState();
    for (const action of ['deleteSelection', 'duplicate', 'selectAll'] as const) expect(editKey(action, true, store, false), action).toBe(true);
    expect(store.getState()).toBe(before);
    store.select(NOTHING_SELECTED);
    expect(editKey('deleteSelection', true, store, false)).toBe(false);
    expect(editKey('duplicate', true, store, false)).toBe(false);
    expect(editKey('selectAll', true, store, false)).toBe(true);
    expect(store.getState().selection).toEqual(NOTHING_SELECTED);
  });
});

describe('the nudge (point 8; brief 125, rulings AX and AY)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    endNudge();
    vi.useRealTimers();
  });
  const at = (store: Store, id: string) => placeOf(store, id) ?? { x: Number.NaN, y: Number.NaN };
  const nudge = (store: Store, key: string, { further = false, zoom = 1, drag = false, repeat = false } = {}) =>
    editKey(further ? 'nudgeFurther' : 'nudge', repeat, store, drag, key, zoom);

  it('v3’s sizes: 0.5% of the picture a press, 2% with Shift, up minus y, the selected points moved as a group', () => {
    expect([NUDGE, NUDGE_FURTHER, NUDGE_QUIET_MS]).toEqual([0.005, 0.02, 400]);
    const { store, route, a, b, c } = scene();
    store.select({ route: route.id, points: [a, b] });
    expect(nudge(store, 'ArrowRight')).toBe(true);
    expect(at(store, a).x).toBeCloseTo(0.205, 10);
    expect(at(store, b).x).toBeCloseTo(0.605, 10);
    expect(nudge(store, 'ArrowUp', { further: true })).toBe(true);
    expect(at(store, a).y).toBeCloseTo(0.18, 10);
    expect(at(store, b).y).toBeCloseTo(0.58, 10);
    expect(nudge(store, 'ArrowLeft', { further: true })).toBe(true);
    expect(nudge(store, 'ArrowDown')).toBe(true);
    expect(at(store, a).x).toBeCloseTo(0.185, 10);
    expect(at(store, a).y).toBeCloseTo(0.185, 10);
    expect(at(store, b).x - at(store, a).x).toBeCloseTo(0.4, 10);
    expect(at(store, b).y - at(store, a).y).toBeCloseTo(0.4, 10);
    expect(at(store, c)).toEqual({ x: 0.9, y: 0.1 });
    expect(store.getState().selection).toEqual({ route: route.id, points: [a, b] });
  });

  it('divides the step by the screen’s zoom (v3’s), and reads the zoom of the frame a bound canvas last drew, 1 with none', () => {
    const { store, route, a } = scene();
    store.select({ route: route.id, points: [a] });
    nudge(store, 'ArrowRight', { zoom: 2 });
    expect(at(store, a).x).toBeCloseTo(0.2025, 10);
    nudge(store, 'ArrowDown', { further: true, zoom: 0.5 });
    expect(at(store, a).y).toBeCloseTo(0.24, 10);
    expect(zoomNow()).toBe(1);
    const zoomed = bound((each) => ({ ...drawnOf(each), zoom: 4 }));
    expect(zoomNow()).toBe(4);
    zoomed.unbind();
    expect(zoomNow()).toBe(1);
  });

  it('holds the group on the picture as a drag is (D237): at the edge it stops, the spacing kept', () => {
    const { store, route, a, c } = scene();
    store.select({ route: route.id, points: [a, c] });
    for (let n = 0; n < 8; n += 1) nudge(store, 'ArrowRight', { further: true });
    expect(at(store, c).x).toBe(1);
    expect(at(store, a).x).toBeCloseTo(0.3, 10);
    for (let n = 0; n < 8; n += 1) nudge(store, 'ArrowUp', { further: true });
    expect(at(store, c).y).toBe(0);
    expect(at(store, a).y).toBeCloseTo(0.1, 10);
  });

  it('a press that would move nothing (held at the edge) changes nothing and makes no step, but is taken', () => {
    const { store, route, c } = scene();
    store.dispatch(movePoints(route.id, [c], 0.1, 0));
    store.select({ route: route.id, points: [c] });
    const before = store.getState();
    expect(nudge(store, 'ArrowRight')).toBe(true);
    expect(nudge(store, 'ArrowRight', { further: true })).toBe(true);
    expect(store.getState()).toBe(before);
    vi.advanceTimersByTime(NUDGE_QUIET_MS);
    expect(store.getState()).toBe(before);
    expect(store.getState().gesture).toBeNull();
  });

  it('three quick presses are one step, "Nudge", open until 400 ms after the last; one Undo puts back all three', () => {
    const { store, route, a } = scene();
    store.select({ route: route.id, points: [a] });
    const before = store.getState().project;
    const undoBefore = store.getState().undo;
    for (let n = 0; n < 3; n += 1) {
      expect(nudge(store, 'ArrowRight')).toBe(true);
      vi.advanceTimersByTime(NUDGE_QUIET_MS - 1);
    }
    expect(store.getState().gesture).toBe('Nudge');
    expect(store.getState().undo).toBe(undoBefore);
    vi.advanceTimersByTime(1);
    expect(store.getState().gesture).toBeNull();
    expect(store.getState().undo).toBe('Nudge');
    expect(at(store, a).x).toBeCloseTo(0.215, 10);
    expect(store.undo().ok).toBe(true);
    expect(store.getState().project).toEqual(before);
    expect(store.getState().undo).toBe(undoBefore);
  });

  it('a held key’s repeats move within the burst, as presses do', () => {
    const { store, route, a } = scene();
    store.select({ route: route.id, points: [a] });
    nudge(store, 'ArrowDown');
    nudge(store, 'ArrowDown', { repeat: true });
    nudge(store, 'ArrowDown', { repeat: true });
    expect(at(store, a).y).toBeCloseTo(0.215, 10);
    vi.advanceTimersByTime(NUDGE_QUIET_MS);
    expect(store.undo().ok).toBe(true);
    expect(at(store, a)).toEqual({ x: 0.2, y: 0.2 });
  });

  it('two presses 500 ms apart are two steps', () => {
    const { store, route, a } = scene();
    store.select({ route: route.id, points: [a] });
    nudge(store, 'ArrowRight');
    vi.advanceTimersByTime(500);
    expect(store.getState().gesture).toBeNull();
    nudge(store, 'ArrowRight');
    vi.advanceTimersByTime(500);
    expect(at(store, a).x).toBeCloseTo(0.21, 10);
    store.undo();
    expect(at(store, a).x).toBeCloseTo(0.205, 10);
    store.undo();
    expect(at(store, a).x).toBe(0.2);
  });

  it('Undo during a burst: the store refuses it while the burst is open, so the burst is closed first (`endNudge`), and Undo puts back the whole burst', () => {
    const { store, route, a } = scene();
    store.select({ route: route.id, points: [a] });
    nudge(store, 'ArrowRight');
    nudge(store, 'ArrowRight');
    expect(store.undo().ok).toBe(false);
    expect(endNudge()).toBe(true);
    expect(store.getState().gesture).toBeNull();
    expect(store.undo().ok).toBe(true);
    expect(at(store, a)).toEqual({ x: 0.2, y: 0.2 });
    expect(endNudge()).toBe(false);
    // The timer of the closed burst closes nothing later.
    nudge(store, 'ArrowLeft');
    vi.advanceTimersByTime(NUDGE_QUIET_MS - 1);
    expect(store.getState().gesture).toBe('Nudge');
  });

  it('a blur of the window closes the burst at once, and so does a pointer press on the preview', () => {
    const { store, route, a, win, canvas, unbind } = bound();
    store.select({ route: route.id, points: [a] });
    nudge(store, 'ArrowRight');
    expect(store.getState().gesture).toBe('Nudge');
    win.fire('blur');
    expect(store.getState().gesture).toBeNull();
    expect(store.getState().undo).toBe('Nudge');
    nudge(store, 'ArrowRight');
    expect(store.getState().gesture).toBe('Nudge');
    canvas.fire('pointerdown', client(0.5, 0.95));
    expect(store.getState().gesture).toBeNull();
    canvas.fire('pointerup', client(0.5, 0.95));
    expect(at(store, a).x).toBeCloseTo(0.21, 10);
    unbind();
  });

  it('is not taken, and changes nothing, with nothing selected on the route, while a drag is open, or when the store refuses to begin', () => {
    const { store, route, other, a } = scene();
    const before = store.getState();
    expect(nudge(store, 'ArrowRight')).toBe(false);
    store.select({ route: other.id, points: [other.points[0]?.id ?? ''] });
    expect(nudge(store, 'ArrowRight')).toBe(false);
    store.select({ route: route.id, points: [] });
    expect(nudge(store, 'ArrowRight')).toBe(false);
    store.select({ route: route.id, points: [a] });
    const selected = store.getState();
    expect(nudge(store, 'ArrowRight', { drag: true })).toBe(false);
    expect(store.getState()).toBe(selected);
    const begun = store.begin('Other');
    expect(nudge(store, 'ArrowRight')).toBe(false);
    expect(store.getState().gesture).toBe('Other');
    expect(at(store, a)).toEqual({ x: 0.2, y: 0.2 });
    if (begun.ok) begun.gesture.cancel();
    expect(before.project).toBe(store.getState().project);
  });

  it('a press held at the edge still keeps an open burst open 400 ms more, applying nothing (Codex on c3ce190, 1)', () => {
    const { store, route, c } = scene();
    store.dispatch(movePoints(route.id, [c], 0.095, 0));
    store.select({ route: route.id, points: [c] });
    const undoBefore = store.getState().undo;
    expect(nudge(store, 'ArrowRight')).toBe(true);
    expect(at(store, c).x).toBe(1);
    vi.advanceTimersByTime(300);
    const held = store.getState();
    expect(nudge(store, 'ArrowRight')).toBe(true);
    expect(store.getState()).toBe(held);
    vi.advanceTimersByTime(200);
    expect(store.getState().gesture).toBe('Nudge');
    expect(nudge(store, 'ArrowLeft', { further: true })).toBe(true);
    expect(at(store, c).x).toBeCloseTo(0.98, 10);
    vi.advanceTimersByTime(NUDGE_QUIET_MS);
    expect(store.getState().gesture).toBeNull();
    expect(store.getState().undo).toBe('Nudge');
    expect(store.undo().ok).toBe(true);
    expect(at(store, c).x).toBeCloseTo(0.995, 10);
    expect(store.getState().undo).toBe(undoBefore);
  });

  it('at the edge, with another gesture open, the arrow is not taken; with none open it is taken and makes no step (Codex on c3ce190, 2)', () => {
    const { store, route, c } = scene();
    store.dispatch(movePoints(route.id, [c], 0.1, 0));
    store.select({ route: route.id, points: [c] });
    const begun = store.begin('Other');
    const before = store.getState();
    expect(nudge(store, 'ArrowRight')).toBe(false);
    expect(store.getState()).toBe(before);
    if (begun.ok) begun.gesture.cancel();
    expect(nudge(store, 'ArrowRight')).toBe(true);
    expect(store.getState().gesture).toBeNull();
  });

  it('a nudge on another store first commits the old store’s live burst there, one step (Codex on c3ce190, 3)', () => {
    const one = scene();
    const two = scene();
    one.store.select({ route: one.route.id, points: [one.a] });
    two.store.select({ route: two.route.id, points: [two.a] });
    nudge(one.store, 'ArrowRight');
    nudge(two.store, 'ArrowDown');
    expect(one.store.getState().gesture).toBeNull();
    expect(one.store.getState().undo).toBe('Nudge');
    expect(two.store.getState().gesture).toBe('Nudge');
    vi.advanceTimersByTime(NUDGE_QUIET_MS);
    expect(two.store.getState().gesture).toBeNull();
    expect(one.store.undo().ok).toBe(true);
    expect(at(one.store, one.a)).toEqual({ x: 0.2, y: 0.2 });
    expect(two.store.undo().ok).toBe(true);
    expect(at(two.store, two.a)).toEqual({ x: 0.2, y: 0.2 });
  });

  it('a nudge on another store leaves alone that store’s gesture when its burst was already closed there (Codex on c3ce190, 3)', () => {
    const one = scene();
    const two = scene();
    one.store.select({ route: one.route.id, points: [one.a] });
    two.store.select({ route: two.route.id, points: [two.a] });
    nudge(one.store, 'ArrowRight');
    one.store.open(one.store.getState().project);
    const begun = one.store.begin('Other');
    const held = one.store.getState();
    expect(nudge(two.store, 'ArrowDown')).toBe(true);
    expect(one.store.getState()).toBe(held);
    expect(one.store.getState().gesture).toBe('Other');
    expect(two.store.getState().gesture).toBe('Nudge');
    if (begun.ok) begun.gesture.cancel();
  });
});

/** Bound with a hover holder (point 6): what it is told, and how often the page was asked to paint. */
function hovering(geometry: (store: Store) => Geometry | null = drawnOf) {
  const made = scene();
  const canvas = canvasStandIn();
  const win = target();
  const hover = createHover();
  const told: Hover[] = [];
  hover.subscribe(() => told.push(hover.held()));
  let paints = 0;
  const refresh = () => ((paints += 1), true);
  const unbind = bindCanvas({ canvas, win, store: made.store, geometry: () => geometry(made.store), refresh, mac: true, hover });
  return { ...made, canvas, win, hover, told, unbind, paints: () => paints };
}

const mouse = (x: number, y: number) => ({ ...client(x, y), pointerType: 'mouse' });

describe('the hover (point 6; brief 118, ruling S)', () => {
  it('an idle mouse or pen move holds the point, the line or nothing under it, and asks for no paint and no step', () => {
    const { canvas, store, hover, route, a, paints, unbind } = hovering();
    const before = store.getState();
    canvas.fire('pointermove', mouse(0.2, 0.2));
    expect(hover.held()).toEqual({ routeId: route.id, pointId: a });
    canvas.fire('pointermove', mouse(0.4, 0.4));
    // (0.4, 0.4) is the line's middle, where its "+" stands (brief 120).
    expect(hover.held()).toEqual({ routeId: route.id, lineId: route.lines[0]?.id, onPlus: true });
    canvas.fire('pointermove', mouse(0.8, 0.3));
    expect(hover.held()).toBeNull();
    canvas.fire('pointermove', { ...client(0.2, 0.2), pointerType: 'pen' });
    expect(hover.held()).toEqual({ routeId: route.id, pointId: a });
    expect(paints()).toBe(0);
    expect(store.getState()).toBe(before);
    unbind();
  });

  it('the same point or line under a moving pointer tells the subscribers once', () => {
    const { canvas, told, route, unbind } = hovering();
    // Along the line, off its "+" at (0.4, 0.4).
    canvas.fire('pointermove', mouse(0.3, 0.3));
    canvas.fire('pointermove', mouse(0.31, 0.31));
    canvas.fire('pointermove', mouse(0.32, 0.32));
    expect(told).toEqual([{ routeId: route.id, lineId: route.lines[0]?.id, onPlus: false }]);
    canvas.fire('pointermove', mouse(0.8, 0.3));
    canvas.fire('pointermove', mouse(0.85, 0.3));
    expect(told).toHaveLength(2);
    unbind();
  });

  it('a pointerleave on the canvas, a blur and the binding\'s removal each clear it', () => {
    const { canvas, win, hover, told, unbind } = hovering();
    expect(canvas.added.map(([type]) => type)).toContain('pointerleave');
    canvas.fire('pointermove', mouse(0.4, 0.4));
    canvas.fire('pointerleave', mouse(1.2, 0.4));
    expect(hover.held()).toBeNull();
    canvas.fire('pointermove', mouse(0.4, 0.4));
    win.fire('blur');
    expect(hover.held()).toBeNull();
    canvas.fire('pointermove', mouse(0.4, 0.4));
    unbind();
    expect(hover.held()).toBeNull();
    expect(told.filter((each) => each === null)).toHaveLength(3);
    expect(canvas.count()).toBe(0);
  });

  it('nothing is hovered while a press or a drag is open; after the up, an idle move hovers again', () => {
    const { canvas, hover, route, a, c, unbind } = hovering();
    canvas.fire('pointermove', mouse(0.2, 0.2));
    expect(hover.held()).toEqual({ routeId: route.id, pointId: a });
    canvas.fire('pointerdown', mouse(0.2, 0.2));
    expect(hover.held()).toBeNull();
    // Over the line, then far enough to drag the point: still nothing hovered.
    canvas.fire('pointermove', mouse(0.4, 0.4));
    expect(hover.held()).toBeNull();
    canvas.fire('pointermove', mouse(0.3, 0.25));
    expect(hover.held()).toBeNull();
    canvas.fire('pointerup', mouse(0.3, 0.25));
    canvas.fire('pointermove', mouse(0.9, 0.1));
    expect(hover.held()).toEqual({ routeId: route.id, pointId: c });
    unbind();
  });

  it('a touch never hovers, and before a frame is drawn nothing is hovered', () => {
    const touched = hovering();
    touched.canvas.fire('pointermove', { ...client(0.2, 0.2), pointerType: 'touch' });
    expect(touched.hover.held()).toBeNull();
    expect(touched.told).toEqual([]);
    touched.unbind();
    const early = hovering(() => null);
    early.canvas.fire('pointermove', mouse(0.2, 0.2));
    expect(early.hover.held()).toBeNull();
    expect(early.told).toEqual([]);
    early.unbind();
  });

  it('only a mouse or a pen hovers: an empty, a missing or any other pointer type never does (Codex list line 29)', () => {
    for (const event of [{ ...client(0.2, 0.2), pointerType: '' }, client(0.2, 0.2), { ...client(0.2, 0.2), pointerType: 'stylus' }]) {
      const made = hovering();
      made.canvas.fire('pointermove', event);
      expect(made.hover.held()).toBeNull();
      expect(made.told).toEqual([]);
      made.unbind();
    }
  });
});
