// CORE-06, chat E1 (briefs 109 and 112): the canvas's binding (dom.ts) with the DOM stood in for: the geometry the frame
// was drawn with, in the pointer's CSS pixels; the pen's tap; every listener removed at unmount with its original
// callback (v3's "destroy removes every Pointer Events listener with its original callback",
// v3/tests/interactionPointer.test.js); a tap is one point though a compatibility click follows (v3's "%s tap creates
// one waypoint even if a compatibility click follows"); nothing on the down; and Escape's branch for the selection.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import type { Screen } from '../../adapters/render/overlays';
import { newLine, newPoint, newRoute, newScene, type IdSource, type Route } from '../../core/model/scene';
import { composeTimeline } from '../../core/timing/timeline';
import { NOTHING_SELECTED } from '../store/selection';
import { createStore, type Store } from '../store/store';
import { bindCanvas, dragOpen, escapeClears, inCssPixels, MARKER_HALF, penTap, recordGeometry, type CanvasElement, type Geometry, type PointerFields } from './dom';
import type { Tap } from './gesture';
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

  it('means nothing on a line, on another route\'s point, or with a modifier held', () => {
    const { store, route, other } = scene();
    const line = route.lines[0]?.id ?? '';
    expect(penTap(store.getState(), tap({ kind: 'line', route: route.id, id: line }))).toBeNull();
    expect(penTap(store.getState(), tap({ kind: 'point', route: other.id, id: other.points[0]?.id ?? '' }))).toBeNull();
    for (const held of [{ ...NONE, alt: true }, { ...NONE, shift: true }, { ...NONE, meta: true }]) {
      expect(penTap(store.getState(), tap(null, { x: 0.5, y: 0.5 }, held))).toBeNull();
    }
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

  it('a good frame, a store edit, then a refresh that does not record: the down places nothing and joins nothing; once a paint records, the tap is taken (Codex line 22)', () => {
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
    fail(false);
    canvas.fire('pointerdown', client(0.3, 0.7));
    canvas.fire('pointerup', client(0.3, 0.7));
    const after = routeOf(store);
    expect(after.points).toHaveLength(4);
    expect(after.lines).toHaveLength(1);
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
