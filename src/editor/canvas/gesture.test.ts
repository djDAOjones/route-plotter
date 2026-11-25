// CORE-06: the pointer's binding on a real store (`createStore`). v3's interactionPointer.test.js assertions about what
// a drag and a tap do to the project, ported through the store: a tap is at most one undo step, a drag one gesture whose
// places are each point's start place plus the whole movement, committed by its up and put back, project and
// selection, by a cancel, a lost capture or a blur. The held checks DEF-60, DEF-65 and DEF-87 are proved here.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import type { ImageBounds } from '../../core/geometry/transform';
import { newLine, newPoint, newRoute, newScene, type IdSource, type Route } from '../../core/model/scene';
import type { Command } from '../store/command';
import { createStore, type Store } from '../store/store';
import { addPoint, movePoints, penStep } from './commands';
import { bindPointer, type Tap } from './gesture';
import { IDLE, type Modifiers, type Picked, type PointerInput, type Under } from './pointer';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}${String((n += 1))}`;
}

/** v3's harness: image fractions times 1000 by 800 canvas pixels. */
const BOUNDS: ImageBounds = { x: 0, y: 0, width: 1000, height: 800, scale: 1 };
const NONE: Modifiers = { alt: false, shift: false, meta: false };
const stop = (x: number, y: number) => ({ x, y, kind: 'stop' as const });

/** A route a → b → c, with d joined to nothing; a at (0.2, 0.2), b at (0.6, 0.6), c at (0.5, 0.1), d at (0.9, 0.9). */
function scene() {
  const nextId = counter('seed');
  const [a, b, c, d] = [stop(0.2, 0.2), stop(0.6, 0.6), stop(0.5, 0.1), stop(0.9, 0.9)].map((each) => newPoint(nextId, each));
  if (a === undefined || b === undefined || c === undefined || d === undefined) throw new Error('four points');
  const route: Route = {
    ...newRoute(nextId),
    points: [a, b, c, d],
    lines: [newLine(nextId, a.id, b.id), newLine(nextId, b.id, c.id)],
    leadStart: a.id,
  };
  const project: Project = { scene: { ...newScene(nextId), routes: [route] }, images: [] };
  const store = createStore({ project, nextId: counter('new') });
  return { store, route: route.id, a: a.id, b: b.id, c: c.id, d: d.id };
}

const routeIn = (store: Store): Route => {
  const route = store.getState().project.scene.routes[0];
  if (route === undefined) throw new Error('no route');
  return route;
};
const placeOf = (store: Store, id: string) => {
  const point = routeIn(store).points.find((each) => each.id === id);
  return point === undefined ? undefined : { x: point.x, y: point.y };
};

/** A binding on `store` whose taps go to `onTap` (by default, none), and every tap it was told of. */
function bound(store: Store, onTap: (tap: Tap) => Command | null = () => null, bounds: () => ImageBounds = () => BOUNDS) {
  const taps: Tap[] = [];
  const binding = bindPointer({
    store,
    bounds,
    onTap: (tap) => {
      taps.push(tap);
      return onTap(tap);
    },
  });
  const send = (...inputs: PointerInput[]) => inputs.flatMap((input) => binding.send(input));
  return { binding, taps, send };
}

const contact = (x: number, y: number, modifiers: Partial<Modifiers> = {}) => ({
  pointerId: 7,
  primary: true,
  button: 0,
  at: { x, y },
  modifiers: { ...NONE, ...modifiers },
});
const down = (x: number, y: number, under: Under, selection: Picked, modifiers?: Partial<Modifiers>): PointerInput => ({
  kind: 'down',
  ...contact(x, y, modifiers),
  under,
  selection,
});
const move = (x: number, y: number): PointerInput => ({ kind: 'move', ...contact(x, y) });
const up = (x: number, y: number, modifiers?: Partial<Modifiers>): PointerInput => ({ kind: 'up', ...contact(x, y, modifiers) });
const ender = (kind: 'cancel' | 'lost-capture' | 'blur'): PointerInput => (kind === 'blur' ? { kind } : { kind, ...contact(0, 0) });

/** Whatever the store holds now: its project, selection and the words of its next undo and redo. */
const snapshot = (store: Store) => {
  const { project, selection, undo, redo } = store.getState();
  return { project, selection, undo, redo };
};

/** A step to redo: a point added, then undone. */
function withRedo(store: Store, route: string) {
  expect(store.dispatch(addPoint(route, stop(0.4, 0.4))).ok).toBe(true);
  expect(store.undo().ok).toBe(true);
  expect(store.getState().redo).toBe('Add point');
}

describe('a tap through the store', () => {
  // v3: "%s tap creates one waypoint even if a compatibility click follows" — its place and its one step.
  it('hands its place in pixels and image fractions to onTap, and the one command it gives is one undo step', () => {
    const { store, route } = scene();
    const { send, taps } = bound(store, (tap) => (tap.under === null ? addPoint(route, stop(tap.place.x, tap.place.y)) : null));
    send(down(320, 240, null, { route: null, points: [] }), up(320, 240));
    expect(taps).toEqual([{ at: { x: 320, y: 240 }, place: { x: 0.32, y: 0.3 }, under: null, modifiers: NONE }]);
    expect(routeIn(store).points.at(-1)).toMatchObject({ x: 0.32, y: 0.3 });
    expect(store.getState().undo).toBe('Add point');
    expect(store.undo().ok).toBe(true);
    expect(store.getState().undo).toBeNull();
  });

  it('a tap whose onTap gives nothing changes nothing', () => {
    const { store } = scene();
    const before = snapshot(store);
    const { send, taps } = bound(store);
    send(down(10, 10, null, { route: null, points: [] }), up(10, 10, { alt: true }));
    expect(taps).toEqual([{ at: { x: 10, y: 10 }, place: { x: 0.01, y: 0.0125 }, under: null, modifiers: { ...NONE, alt: true } }]);
    expect(snapshot(store)).toEqual(before);
  });

  // DEF-65, "one authoring gesture is one undo step" (v3: "Branch place: two undos").
  it('DEF-65: a pen step that forks from a point with a line out is one undo step, and one Undo gives back the route and selection', () => {
    const { store, route, a } = scene();
    expect(store.select({ route, points: [a] }).ok).toBe(true);
    const before = snapshot(store);
    const { send } = bound(store, (tap) => penStep(route, store.getState().selection.points.at(-1) ?? null, { place: stop(tap.place.x, tap.place.y) }));
    send(down(100, 400, null, before.selection), up(100, 400));
    const after = routeIn(store);
    const added = after.points.at(-1);
    expect(after.points).toHaveLength(5);
    expect(after.lines.filter((line) => line.from === a)).toHaveLength(2);
    expect(after.lines.at(-1)).toMatchObject({ from: a, to: added?.id });
    expect(store.getState().undo).toBe('Add point');
    expect(store.undo().ok).toBe(true);
    expect(store.getState().undo).toBeNull();
    expect(store.getState().project).toEqual(before.project);
    expect(store.getState().selection).toEqual(before.selection);
  });

  // DEF-87, "a drag that moves nothing records no undo step" (v3: "Traced node drag no-op"): its tap half.
  it('DEF-87: a tap whose command changes nothing makes no undo step and keeps Redo', () => {
    const { store, route, a } = scene();
    withRedo(store, route);
    const before = snapshot(store);
    const { send } = bound(store, () => movePoints(route, [a], 0, 0));
    send(down(200, 160, { kind: 'point', route, id: a }, before.selection), up(200, 160));
    expect(snapshot(store)).toEqual(before);
  });
});

describe('a drag through the store', () => {
  // v3: "%s movement of %spx resolves as %s" — through the store: 3 pixels moves nothing, 3.01 is one step.
  it.each([
    [3, 0],
    [3.01, 1],
  ])('a movement of %spx on a point makes %s undo steps', (distance, steps) => {
    const { store, route, a } = scene();
    const { send } = bound(store);
    send(down(200, 160, { kind: 'point', route, id: a }, { route: null, points: [] }), move(200 + distance, 160), up(200 + distance, 160));
    expect(store.getState().undo).toBe(steps === 1 ? 'Move point' : null);
    expect(placeOf(store, a)?.x).toBe(steps === 1 ? 0.2 + ((200 + distance) / 1000 - 200 / 1000) : 0.2);
    // v3: "dragging an otherwise unselected waypoint establishes it as the single selection".
    expect(store.getState().selection.points).toEqual(steps === 1 ? [a] : []);
  });

  // v3: "one move carries immutable group-start snapshots and one aggregate end", and "drag preserves it and promotes
  // the grabbed member".
  it('a group drag moves each member from its start place by the whole movement, as one step, the grabbed member last', () => {
    const { store, route, a, b } = scene();
    expect(store.select({ route, points: [a, b] }).ok).toBe(true);
    const before = snapshot(store);
    const { send, binding } = bound(store);
    send(down(200, 160, { kind: 'point', route, id: a }, before.selection), move(300, 240));
    expect(store.getState().gesture).toBe('Move points');
    send(up(300, 240), up(300, 240), ender('lost-capture'));
    const [dx, dy] = [300 / 1000 - 200 / 1000, 240 / 800 - 160 / 800];
    expect(placeOf(store, a)).toEqual({ x: 0.2 + dx, y: 0.2 + dy });
    expect(placeOf(store, b)).toEqual({ x: 0.6 + dx, y: 0.6 + dy });
    expect(placeOf(store, a)?.x).toBeCloseTo(0.3, 12);
    expect(placeOf(store, b)?.y).toBeCloseTo(0.7, 12);
    expect(store.getState().selection).toEqual({ route, points: [b, a] });
    expect(store.getState().undo).toBe('Move points');
    expect(store.getState().gesture).toBeNull();
    expect(binding.state()).toBe(IDLE);
    expect(store.undo().ok).toBe(true);
    expect(snapshot(store)).toEqual({ ...before, redo: 'Move points' });
  });

  it('after a hundred moves of a third of a pixel the places are exactly those of one move by the total', () => {
    const many = scene();
    const one = scene();
    const grab = (s: ReturnType<typeof scene>) => {
      expect(s.store.select({ route: s.route, points: [s.a, s.b] }).ok).toBe(true);
      return down(200, 160, { kind: 'point', route: s.route, id: s.a }, s.store.getState().selection);
    };
    // The pixels as a device adds them up: each a third of a pixel on from the last.
    const pixels: [number, number][] = [];
    for (let i = 0, [x, y] = [200, 160]; i < 100; i += 1) {
      [x, y] = [x + 1 / 3, y - 1 / 3];
      pixels.push([x, y]);
    }
    const [lastX, lastY] = pixels.at(-1) ?? [200, 160];
    bound(many.store).send(grab(many), ...pixels.map(([x, y]) => move(x, y)), up(lastX, lastY));
    bound(one.store).send(grab(one), move(lastX, lastY), up(lastX, lastY));
    for (const id of [many.a, many.b]) expect(placeOf(many.store, id)).toEqual(placeOf(one.store, id));
    expect(placeOf(many.store, many.b)).not.toEqual({ x: 0.6, y: 0.6 });
    expect(many.store.getState().undo).toBe('Move points');
    expect(many.store.undo().ok).toBe(true);
    expect(many.store.getState().undo).toBeNull();
  });

  it('is unclamped: a drag beyond the image leaves the point beyond it (the clamp is the page’s, D237)', () => {
    const { store, route, a } = scene();
    bound(store).send(down(200, 160, { kind: 'point', route, id: a }, { route: null, points: [] }), move(1200, 900), up(1200, 900));
    expect(placeOf(store, a)).toEqual({ x: 0.2 + (1200 / 1000 - 200 / 1000), y: 0.2 + (900 / 800 - 160 / 800) });
    expect(placeOf(store, a)?.x).toBeGreaterThan(1);
  });

  it('an up the last move did not deliver takes that motion: a drag ending at once is one step at the up’s place', () => {
    const { store, route, a } = scene();
    bound(store).send(down(200, 160, { kind: 'point', route, id: a }, { route: null, points: [] }), up(250, 160));
    expect(placeOf(store, a)?.x).toBe(0.2 + (250 / 1000 - 200 / 1000));
    expect(store.getState().undo).toBe('Move point');
  });

  it('a refused move keeps the last accepted places, and the drag goes on', () => {
    const { store, route, a } = scene();
    let width = 1000;
    const { send } = bound(store, () => null, () => ({ ...BOUNDS, width }));
    send(down(200, 160, { kind: 'point', route, id: a }, { route: null, points: [] }), move(250, 160));
    const accepted = placeOf(store, a);
    width = 1e-9;
    send(move(260, 160));
    expect(placeOf(store, a)).toEqual(accepted);
    width = 1000;
    send(move(300, 160), up(300, 160));
    expect(placeOf(store, a)?.x).toBe(0.2 + (300 / 1000 - 200 / 1000));
    expect(store.getState().undo).toBe('Move point');
  });

  it('when the store will not open the gesture, the drag does nothing to the store and its up commits nothing', () => {
    const { store, route, a } = scene();
    const other = store.begin('Other');
    expect(other.ok).toBe(true);
    const before = snapshot(store);
    const { send, binding } = bound(store);
    send(down(200, 160, { kind: 'point', route, id: a }, { route: null, points: [] }), move(300, 160), up(300, 160));
    expect(snapshot(store)).toEqual(before);
    expect(store.getState().gesture).toBe('Other');
    expect(binding.state()).toBe(IDLE);
  });

  it('a press on nothing or on a line, past the threshold, changes nothing', () => {
    const { store, route } = scene();
    const before = snapshot(store);
    const { send, taps } = bound(store, () => addPoint(route, stop(0, 0)));
    send(down(100, 100, null, before.selection), move(150, 100), up(150, 100));
    send(down(100, 100, { kind: 'line', route, id: 'any' }, before.selection), move(150, 100), up(150, 100));
    expect(taps).toEqual([]);
    expect(snapshot(store)).toEqual(before);
  });

  it('dropping a point onto another moves it and joins nothing (v3’s rejoin is chat F’s)', () => {
    const { store, route, a, d } = scene();
    const lines = routeIn(store).lines;
    // d stands at (900, 720): drag a from (200, 160) onto it.
    bound(store).send(down(200, 160, { kind: 'point', route, id: a }, { route: null, points: [] }), move(900, 720), up(900, 720));
    expect(placeOf(store, a)?.x).toBeCloseTo(0.9, 12);
    expect(routeIn(store).lines).toEqual(lines);
    expect(routeIn(store).points.map((each) => each.id)).toContain(d);
  });

  // DEF-60, "a refused gesture puts back everything it moved, not one point" (v3: "Refused rejoin half-restored").
  it.each(['cancel', 'lost-capture', 'blur'] as const)(
    'DEF-60: a group of three dragged and ended by a %s is all put back, the selection as it was, no step, Redo kept',
    (kind) => {
      const { store, route, a, b, c } = scene();
      withRedo(store, route);
      expect(store.select({ route, points: [c, a, b] }).ok).toBe(true);
      const before = snapshot(store);
      const { send, binding } = bound(store);
      send(down(200, 160, { kind: 'point', route, id: a }, before.selection), move(260, 200), move(320, 260));
      expect(store.getState().selection.points).toEqual([c, b, a]);
      // All three at their moved places before the ending (120 by 100 pixels: 0.12 by 0.125 of the image), so the
      // restore below is proved for each of them, not only for the one the drag happened to move.
      const moved = [
        [a, 0.32, 0.325],
        [b, 0.72, 0.725],
        [c, 0.62, 0.225],
      ] as const;
      for (const [id, x, y] of moved) {
        expect(placeOf(store, id)?.x).toBeCloseTo(x, 12);
        expect(placeOf(store, id)?.y).toBeCloseTo(y, 12);
      }
      send(ender(kind));
      expect(snapshot(store)).toEqual(before);
      expect([placeOf(store, a), placeOf(store, b), placeOf(store, c)]).toEqual([
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.6 },
        { x: 0.5, y: 0.1 },
      ]);
      expect(store.getState().redo).toBe('Add point');
      expect(store.getState().gesture).toBeNull();
      expect(binding.state()).toBe(IDLE);
    },
  );

  // DEF-87, "a drag that moves nothing records no undo step" (v3: "Traced node drag no-op").
  it('DEF-87: a drag past the threshold and back exactly to its down, ended by an up, makes no step and keeps Redo', () => {
    const { store, route, a } = scene();
    withRedo(store, route);
    expect(store.select({ route, points: [a] }).ok).toBe(true);
    const before = snapshot(store);
    const { send } = bound(store);
    send(down(200, 160, { kind: 'point', route, id: a }, before.selection), move(240, 190));
    expect(placeOf(store, a)).not.toEqual({ x: 0.2, y: 0.2 });
    send(move(200, 160), up(200, 160));
    expect(snapshot(store)).toEqual(before);
    expect(store.getState().redo).toBe('Add point');
  });
});
