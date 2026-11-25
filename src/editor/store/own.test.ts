// CORE-05: nothing changes the store's state or history but a command (Codex's first finding on stage 1). What the
// store hands out and what it is handed cannot be written to, or is the store's own copy; a write throws (modules are
// strict) or changes nothing the store holds, and every undo and redo step stays as it was. The core only reads what
// it is given: `checkScene` and `composeTimeline` run on the store's frozen project.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { checkScene, newLine, newPoint, newRoute, newScene, type IdSource, type Route } from '../../core/model/scene';
import { composeTimeline } from '../../core/timing/timeline';
import { addRoute, movePoint, setRouteSetting, type Command, type Current, type Refusal } from './command';
import { NOTHING_SELECTED } from './selection';
import { createStore, type Store } from './store';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

/** One route, two stops joined by a line, the lead starting at the first. */
function twoStops(): { project: Project; route: string; a: string; b: string } {
  const nextId = counter('seed');
  const a = newPoint(nextId, { x: 0.2, y: 0.2, kind: 'stop' });
  const b = newPoint(nextId, { x: 0.8, y: 0.8, kind: 'stop' });
  const route = { ...newRoute(nextId), points: [a, b], lines: [newLine(nextId, a.id, b.id)], leadStart: a.id };
  return { project: { scene: { ...newScene(nextId), routes: [route] }, images: [] }, route: route.id, a: a.id, b: b.id };
}

const storeOf = (project: Project): Store => createStore({ project, nextId: counter('new') });

function firstRoute(project: Project): Route {
  const route = project.scene.routes[0];
  if (route === undefined) throw new Error('the project has no route');
  return route;
}

const thickness = (store: Store): number => firstRoute(store.getState().project).settings.line.thickness;

/** Every state the history holds, oldest first: the line's width and the selected points at each. */
function history(store: Store): readonly (readonly [number, readonly string[]])[] {
  let undone = store.undo();
  while (undone.ok) undone = store.undo();
  const seen = [[thickness(store), store.getState().selection.points] as const];
  while (store.redo().ok) seen.push([thickness(store), store.getState().selection.points]);
  return seen;
}

/** Two steps, the second undone: width 3 with a selected, 10 with a selected, 12 with b selected. */
function withHistory(): { store: Store; route: string; a: string; b: string } {
  const { project, route, a, b } = twoStops();
  const store = storeOf(project);
  store.select({ route, points: [a] });
  store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
  store.select({ route, points: [b] });
  store.dispatch(setRouteSetting(route, 'line', 'thickness', 12));
  store.undo();
  return { store, route, a, b };
}

describe('nothing changes the state or the history but a command', () => {
  it('what getState gives cannot be written to', () => {
    const { store, a, b } = withHistory();
    const state = store.getState();
    expect(() => {
      firstRoute(state.project).settings.line.thickness = 999;
    }).toThrow(TypeError);
    expect(() => firstRoute(state.project).points.pop()).toThrow(TypeError);
    expect(() => Object.assign(state.selection.points, ['gone'])).toThrow(TypeError);
    expect(() => Object.assign(state, { project: twoStops().project })).toThrow(TypeError);
    expect(store.getState()).toBe(state);
    expect(history(store)).toEqual([
      [3, [a]],
      [10, [a]],
      [12, [b]],
    ]);
  });

  it('the project handed to createStore or to Open is never the store’s: the store keeps its own frozen copy, and writing the caller’s changes nothing', () => {
    const { project } = twoStops();
    const store = storeOf(project);
    const first = store.getState().project;
    expect(first).not.toBe(project);
    expect(first).toEqual(project);
    expect(Object.isFrozen(project)).toBe(false);
    expect(Object.isFrozen(firstRoute(project).points)).toBe(false);
    expect(() => {
      firstRoute(first).settings.line.thickness = 999;
    }).toThrow(TypeError);
    firstRoute(project).settings.line.thickness = 999;
    expect(thickness(store)).toBe(3);
    const opened = twoStops().project;
    expect(store.open(opened)).toEqual({ ok: true, changed: true });
    expect(store.getState().project).not.toBe(opened);
    expect(() => firstRoute(store.getState().project).points.splice(0)).toThrow(TypeError);
    firstRoute(opened).points.splice(0);
    expect(firstRoute(store.getState().project).points).toHaveLength(2);
  });

  it('image bytes the caller still holds are never the store’s: each image is copied once, as it comes in', () => {
    const { project, route } = twoStops();
    const bytes = new Uint8Array([1, 2, 3]);
    const store = storeOf({ ...project, images: [{ id: 'image-1', type: 'image/png', bytes }] });
    bytes[0] = 9;
    const held = store.getState().project.images;
    expect(held[0]?.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(Object.isFrozen(held[0])).toBe(true);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    expect(store.getState().project.images).toBe(held);
    const later = new Uint8Array([4, 5]);
    store.open({ ...twoStops().project, images: [{ id: 'image-2', type: 'image/webp', bytes: later }] });
    later.fill(0);
    expect(store.getState().project.images[0]?.bytes).toEqual(new Uint8Array([4, 5]));
  });

  it('a selection handed to select is the caller’s still: changing it later changes nothing, and Undo gives back the true one', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    const chosen: { route: string | null; points: string[] } = { route, points: [a] };
    store.select(chosen);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    chosen.route = 'gone';
    chosen.points.push('gone');
    expect(store.getState().selection).toEqual({ route, points: [a] });
    expect(Object.isFrozen(store.getState().selection)).toBe(true);
    store.select(NOTHING_SELECTED);
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(store.getState().selection).toEqual({ route, points: [a] });
  });

  it('what a command receives cannot be written to, whether it then gives back what it found, a refusal or throws, alone or in a gesture', () => {
    const { store, a, b } = withHistory();
    const vandal = (then: (current: Current) => Current | Refusal): Command => ({
      label: 'Vandal',
      apply: (current) => {
        expect(() => {
          firstRoute(current.project).settings.line.thickness = 999;
        }).toThrow(TypeError);
        expect(() => Object.assign(current.selection.points, ['gone'])).toThrow(TypeError);
        expect(() => Object.assign(current, { selection: NOTHING_SELECTED })).toThrow(TypeError);
        return then(current);
      },
    });
    const before = store.getState();
    expect(store.dispatch(vandal((current) => current))).toEqual({ ok: true, changed: false });
    expect(store.dispatch(vandal(() => ({ why: 'missing', what: 'nothing' })))).toMatchObject({ ok: false });
    expect(() =>
      store.dispatch(
        vandal(() => {
          throw new Error('a broken command');
        }),
      ),
    ).toThrow('a broken command');
    expect(store.getState()).toBe(before);
    const begun = store.begin('Vandal');
    if (!begun.ok) throw new Error('the gesture did not open');
    expect(begun.gesture.apply(vandal((current) => current))).toEqual({ ok: true, changed: false });
    expect(begun.gesture.apply(vandal(() => ({ why: 'missing', what: 'nothing' })))).toMatchObject({ ok: false });
    expect(() =>
      begun.gesture.apply(
        vandal(() => {
          throw new Error('a broken command');
        }),
      ),
    ).toThrow('a broken command');
    expect(store.getState().gesture).toBe('Vandal');
    expect(begun.gesture.commit()).toEqual({ ok: true, changed: false });
    expect(store.getState()).toMatchObject({ project: before.project, selection: before.selection, redo: before.redo });
    expect(history(store)).toEqual([
      [3, [a]],
      [10, [a]],
      [12, [b]],
    ]);
  });

  it('what a command makes new is copied as the store keeps it: the copy is frozen, and the command’s own object, changed later, changes nothing', () => {
    const { project } = twoStops();
    const store = storeOf(project);
    let made: Route | undefined;
    const widen: Command = {
      label: 'Widen',
      apply: (current) => {
        const was = firstRoute(current.project);
        made = { ...was, settings: { ...was.settings, line: { ...was.settings.line, thickness: 11 } } };
        const scene = { ...current.project.scene, routes: [made] };
        return { project: { ...current.project, scene }, selection: current.selection };
      },
    };
    expect(store.dispatch(widen)).toEqual({ ok: true, changed: true });
    expect(() => {
      firstRoute(store.getState().project).settings.line.thickness = 30;
    }).toThrow(TypeError);
    expect(made !== undefined && Object.isFrozen(made)).toBe(false);
    if (made !== undefined) made.settings.line.thickness = 30;
    expect(thickness(store)).toBe(11);
  });
});

describe('only plain data is taken, and a refusal changes nothing (Codex’s second round)', () => {
  it('a project with a getter, or in a class, is refused, at createStore and at Open, and nothing changes', () => {
    const { project, route } = twoStops();
    const live = { scene: project.scene };
    const withGetter = {
      get scene() {
        return live.scene;
      },
      images: [],
    };
    class Wrapper {
      readonly images = [];
      get scene() {
        return live.scene;
      }
    }
    const image = { id: 'image-1', type: 'image/png' as const, bytes: new Uint8Array([1]) };
    const withGetterAndImage = {
      get scene() {
        return live.scene;
      },
      images: [image],
    };
    expect(() => storeOf(withGetter)).toThrow(TypeError);
    expect(() => storeOf(withGetterAndImage)).toThrow(TypeError);
    expect(() => storeOf(new Wrapper())).toThrow(TypeError);
    const store = storeOf(twoStops().project);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    const before = store.getState();
    expect(() => store.open(withGetter)).toThrow(TypeError);
    expect(() => store.open(withGetterAndImage)).toThrow(TypeError);
    expect(() => store.open(new Wrapper())).toThrow(TypeError);
    expect(store.getState()).toBe(before);
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(thickness(store)).toBe(3);
  });

  it('a project refused partway leaves nothing of it taken: its parts are walked, and refused, again', () => {
    const { project } = twoStops();
    const bend = newPoint(counter('bend'), { x: 0.5, y: 0.5, kind: 'bend' });
    Object.defineProperty(bend, 'x', { enumerable: true, get: () => 0.5 });
    const route = firstRoute(project);
    const scene = { ...project.scene, routes: [{ ...route, points: [...route.points, bend] }] };
    expect(() => storeOf({ scene, images: [] })).toThrow(TypeError);
    expect(() => storeOf({ scene, images: [] })).toThrow(TypeError);
    const store = storeOf(twoStops().project);
    const smuggle: Command = { label: 'Smuggle', apply: (current) => ({ ...current, project: { scene, images: [] } }) };
    expect(() => store.dispatch(smuggle)).toThrow(TypeError);
    expect(store.getState().undo).toBeNull();
  });
});

/** Any object, let through as a project so a test can hand the store what the types refuse and prove it refuses it too. */
const handedIn = (value: unknown): value is Project => typeof value === 'object' && value !== null;

function asProject(value: unknown): Project {
  if (!handedIn(value)) throw new Error('a project is an object');
  return value;
}

/** `twoStops`'s project with its first point, or its list of points, replaced by what `change` makes of it. */
function withPoints(change: (points: readonly object[]) => unknown): { project: Project; bad: unknown } {
  const { project } = twoStops();
  const route = firstRoute(project);
  const bad = change(route.points);
  return { project: asProject({ ...project, scene: { ...project.scene, routes: [{ ...route, points: bad }] } }), bad };
}

const point = (points: readonly object[]): object => ({ ...points[0] });
const [first, second] = [(p: readonly object[]) => p[0], (p: readonly object[]) => p[1]];

/** Each kind of value the claim's point 2 refuses, placed where a command could put it. */
const NOT_PLAIN: readonly (readonly [string, (points: readonly object[]) => unknown])[] = [
  ['an accessor', (p) => [Object.defineProperty(point(p), 'x', { enumerable: true, get: () => 0.2 }), second(p)]],
  ['a symbol key', (p) => [{ ...point(p), [Symbol('extra')]: 1 }, second(p)]],
  ['a property that is not enumerable', (p) => [Object.defineProperty(point(p), 'note', { value: 'hidden' }), second(p)]],
  ['a class instance', (p) => [Object.assign(new (class Point {})(), first(p)), second(p)]],
  [
    'another prototype',
    (p) => {
      const other = point(p);
      Reflect.setPrototypeOf(other, { kind: 'stop' });
      return [other, second(p)];
    },
  ],
  ['a function', (p) => [{ ...point(p), x: () => 0.2 }, second(p)]],
  ['undefined', (p) => [{ ...point(p), x: undefined }, second(p)]],
  ['bytes outside an image', (p) => [{ ...point(p), x: new Uint8Array(1) }, second(p)]],
  [
    'an array with a hole',
    (p) => {
      const holed: unknown[] = [];
      holed[1] = second(p);
      return holed;
    },
  ],
  ['an array with an extra property', (p) => Object.assign([first(p), second(p)], { extra: 1 })],
  [
    'a cycle',
    (p) => {
      const looped: Record<string, unknown> = { ...point(p) };
      looped['self'] = looped;
      return [looped, second(p)];
    },
  ],
];

describe('the claim’s point 2: anything but plain data is refused with a TypeError before the store changes', () => {
  it.each(NOT_PLAIN)('%s is refused at createStore, at Open and from a command; nothing changes, and nothing handed in is frozen', (_, change) => {
    const { project, bad } = withPoints(change);
    expect(() => storeOf(project)).toThrow(TypeError);
    const { store } = withHistory();
    const before = store.getState();
    expect(() => store.open(project)).toThrow(TypeError);
    const smuggle: Command = { label: 'Smuggle', apply: (current) => ({ ...current, project }) };
    expect(() => store.dispatch(smuggle)).toThrow(TypeError);
    expect(store.getState()).toBe(before);
    expect(Object.isFrozen(project)).toBe(false);
    expect(Object.isFrozen(bad)).toBe(false);
  });

  it('a proxy gives only what it says it owns: one over {} that supplies scene and images through get is refused, and one over a project is copied, never read through get', () => {
    const live = { scene: twoStops().project.scene };
    const handler = { get: (_: object, key: string | symbol) => (key === 'scene' ? live.scene : key === 'images' ? [] : undefined) };
    const empty = asProject(new Proxy({}, handler));
    expect(() => storeOf(empty)).toThrow(TypeError);
    const { store } = withHistory();
    const before = store.getState();
    expect(() => store.open(empty)).toThrow(TypeError);
    expect(store.getState()).toBe(before);
    const target = twoStops().project;
    const liar = new Proxy(target, {
      get: () => {
        throw new Error('read through get');
      },
    });
    const copied = storeOf(liar);
    firstRoute(target).settings.line.thickness = 99;
    expect(thickness(copied)).toBe(3);
  });

  it('a project that inherits its scene is refused: from another prototype, or from Object.prototype itself', () => {
    const { scene } = twoStops().project;
    const { store } = withHistory();
    const before = store.getState();
    const inheriting = asProject(Object.create({ scene, images: [] }));
    expect(() => storeOf(inheriting)).toThrow(TypeError);
    expect(() => store.open(inheriting)).toThrow(TypeError);
    Object.defineProperty(Object.prototype, 'scene', { value: scene, configurable: true, writable: true });
    try {
      expect(() => storeOf(asProject({ images: [] }))).toThrow(TypeError);
      expect(() => store.open(asProject({ images: [] }))).toThrow(TypeError);
    } finally {
      Reflect.deleteProperty(Object.prototype, 'scene');
    }
    expect(store.getState()).toBe(before);
  });

  it('an image is taken with its own bytes, a Uint8Array, and nothing else', () => {
    const { project } = twoStops();
    const image = (bytes: unknown) => asProject({ ...project, images: [{ id: 'image-1', type: 'image/png', bytes }] });
    expect(() => storeOf(image([1, 2, 3]))).toThrow(TypeError);
    expect(() => storeOf(image(new Uint16Array(2)))).toThrow(TypeError);
    expect(() => storeOf(asProject({ ...project, images: [{ id: 'image-1', type: 'image/png' }] }))).toThrow(TypeError);
    expect(() => storeOf(asProject({ ...project, images: {} }))).toThrow(TypeError);
  });
});

describe('the claim’s point 4: a command that throws, wherever the store reads it, leaves everything as it was', () => {
  it('a throwing label, apply or result, or a throwing id source, changes nothing, and the next command receives what getState shows', () => {
    const { store, route, a, b } = withHistory();
    const before = store.getState();
    const widen = setRouteSetting(route, 'line', 'thickness', 20);
    const brokenLabel: Command = {
      get label(): string {
        throw new Error('a broken label');
      },
      apply: widen.apply,
    };
    const brokenApply = {
      label: 'Broken',
      get apply(): Command['apply'] {
        throw new Error('a broken apply');
      },
    };
    const brokenResult: Command = {
      label: 'Broken',
      apply: (current) => ({
        get project(): Project {
          throw new Error('a broken result');
        },
        selection: current.selection,
      }),
    };
    expect(() => store.dispatch(brokenLabel)).toThrow('a broken label');
    expect(() => store.dispatch(brokenApply)).toThrow('a broken apply');
    expect(() => store.dispatch(brokenResult)).toThrow('a broken result');
    expect(store.getState()).toBe(before);
    let received: Current | undefined;
    const look: Command = {
      label: 'Look',
      apply: (current) => {
        received = current;
        return current;
      },
    };
    expect(store.dispatch(look)).toEqual({ ok: true, changed: false });
    expect(received?.project).toBe(before.project);
    expect(received?.selection).toBe(before.selection);
    expect(history(store)).toEqual([
      [3, [a]],
      [10, [a]],
      [12, [b]],
    ]);
    const noIds = createStore({
      project: twoStops().project,
      nextId: () => {
        throw new Error('no id');
      },
    });
    const empty = noIds.getState();
    expect(() => noIds.dispatch(addRoute())).toThrow('no id');
    expect(noIds.getState()).toBe(empty);
  });
});

describe('a command pays only for what it made new', () => {
  it('a movePoint on a route of 2,000 points copies the moved point, its list and their parents, and no other object', () => {
    const nextId = counter('big');
    const points = Array.from({ length: 2000 }, (_, i) => newPoint(nextId, { x: (i % 50) / 50, y: Math.floor(i / 50) / 50, kind: 'stop' }));
    const big = { ...newRoute(nextId), points, leadStart: points[0]?.id ?? null };
    const scene = newScene(nextId);
    const store = storeOf({ scene: { ...scene, routes: [big, ...scene.routes] }, images: [] });
    const held = new Set(objectsOf(store.getState().project));
    const moved = points[1000]?.id ?? '';
    expect(store.dispatch(movePoint(big.id, moved, { x: 0.5, y: 0.25 }))).toEqual({ ok: true, changed: true });
    const after = store.getState().project;
    const route = firstRoute(after);
    const made = objectsOf(after).filter((each) => !held.has(each));
    expect(made).toHaveLength(6);
    for (const each of [after, after.scene, after.scene.routes, route, route.points, route.points[1000]]) expect(made).toContain(each);
  });
});

/** Every record and array under `value`, each once. */
function objectsOf(value: unknown, seen: Set<object> = new Set()): object[] {
  if (typeof value !== 'object' || value === null || ArrayBuffer.isView(value) || seen.has(value)) return [...seen];
  seen.add(value);
  for (const item of Object.values(value)) objectsOf(item, seen);
  return [...seen];
}

describe('the core only reads what it is given', () => {
  it('checkScene and composeTimeline run on the store’s frozen project', () => {
    const store = storeOf(twoStops().project);
    const held = store.getState().project;
    expect(Object.isFrozen(firstRoute(held).points[0])).toBe(true);
    expect(checkScene(held.scene).ok).toBe(true);
    for (const route of held.scene.routes) expect(composeTimeline(route, 16 / 9).endMs).toBeGreaterThan(0);
  });
});
