// CORE-05: nothing changes the store's state or history but a command (Codex's first finding on stage 1). What the
// store hands out and what it is handed cannot be written to, or is the store's own copy; a write throws (modules are
// strict) or changes nothing the store holds, and every undo and redo step stays as it was. The core only reads what
// it is given: `checkScene` and `composeTimeline` run on the store's frozen project.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { checkScene, newLine, newPoint, newRoute, newScene, type IdSource, type Route } from '../../core/model/scene';
import { composeTimeline } from '../../core/timing/timeline';
import { setRouteSetting, type Command, type Current, type Refusal } from './command';
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

  it('the project handed to createStore or to Open cannot be written to', () => {
    const { project } = twoStops();
    const store = storeOf(project);
    expect(() => {
      firstRoute(project).settings.line.thickness = 999;
    }).toThrow(TypeError);
    expect(thickness(store)).toBe(3);
    const opened = twoStops().project;
    expect(store.open(opened)).toEqual({ ok: true, changed: true });
    expect(() => firstRoute(opened).points.splice(0)).toThrow(TypeError);
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

  it('what a command makes new is frozen once the store keeps it', () => {
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
      if (made !== undefined) made.settings.line.thickness = 30;
    }).toThrow(TypeError);
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
    expect(() => storeOf(withGetter)).toThrow(TypeError);
    expect(() => storeOf(new Wrapper())).toThrow(TypeError);
    const store = storeOf(twoStops().project);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    const before = store.getState();
    expect(() => store.open(withGetter)).toThrow(TypeError);
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

describe('the core only reads what it is given', () => {
  it('checkScene and composeTimeline run on the store’s frozen project', () => {
    const store = storeOf(twoStops().project);
    const held = store.getState().project;
    expect(Object.isFrozen(firstRoute(held).points[0])).toBe(true);
    expect(checkScene(held.scene).ok).toBe(true);
    for (const route of held.scene.routes) expect(composeTimeline(route, 16 / 9).endMs).toBeGreaterThan(0);
  });
});
