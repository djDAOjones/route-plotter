// CORE-05: the editor's store — one gesture is one undo step, never merged by a timer (DEF-92, CROWD-06.2); Undo gives
// back the selection a step found and Redo the one it left (DEF-74), across two controls (CROWD-06.4); v3's
// UndoService cases kept where v4 has them (v3/tests/undoService.test.js); subscribers isolated (the plan's line 986).
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { AT_START } from '../../player/transport/transport';
import { addRoute, movePoint, removeRoute, setRouteSetting, setSceneSetting } from './command';
import { NOTHING_SELECTED } from './selection';
import { MAX_STEPS, createStore, type Store } from './store';

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

function storeOf(project: Project): Store {
  return createStore({ project, nextId: counter('new') });
}

const thickness = (store: Store): number | undefined => store.getState().project.scene.routes[0]?.settings.line.thickness;
const pointAt = (store: Store, id: string) => store.getState().project.scene.routes[0]?.points.find((p) => p.id === id);

afterEach(() => {
  vi.useRealTimers();
});

describe('one gesture is one undo step, never merged by a timer (DEF-92, CROWD-06.2)', () => {
  it('a slider dragged, paused and dragged on in one gesture makes one undo entry', () => {
    vi.useFakeTimers();
    const { project, route } = twoStops();
    const store = storeOf(project);
    const begun = store.begin('Line width');
    if (!begun.ok) throw new Error('the gesture did not open');
    for (const width of [4, 5, 6]) begun.gesture.apply(setRouteSetting(route, 'line', 'thickness', width));
    vi.advanceTimersByTime(10_000);
    for (const width of [7, 8]) begun.gesture.apply(setRouteSetting(route, 'line', 'thickness', width));
    expect(thickness(store)).toBe(8);
    expect(store.getState().undo).toBeNull();
    expect(begun.gesture.commit()).toEqual({ ok: true, changed: true });
    expect(store.getState().undo).toBe('Line width');
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(thickness(store)).toBe(3);
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
  });

  it('two gestures with no time between them stay two steps', () => {
    vi.useFakeTimers();
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    store.dispatch(movePoint(route, a, { x: 0.3, y: 0.4 }));
    expect(store.getState().undo).toBe('Move point');
    store.undo();
    expect(pointAt(store, a)).toMatchObject({ x: 0.2, y: 0.2 });
    expect(thickness(store)).toBe(10);
    store.undo();
    expect(thickness(store)).toBe(3);
  });

  it('a step stays its own however long the next one waits', () => {
    vi.useFakeTimers();
    const { project, route } = twoStops();
    const store = storeOf(project);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    vi.advanceTimersByTime(1);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 11));
    vi.advanceTimersByTime(60_000);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 12));
    const widths = [12];
    while (store.undo().ok) widths.push(thickness(store) ?? -1);
    expect(widths).toEqual([12, 11, 10, 3]);
  });

  it('a gesture that ends where it began makes no step and keeps Redo', () => {
    const { project, route } = twoStops();
    const store = storeOf(project);
    const first = store.getState().project;
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    store.undo();
    const begun = store.begin('Line width');
    if (!begun.ok) throw new Error('the gesture did not open');
    begun.gesture.apply(setRouteSetting(route, 'line', 'thickness', 20));
    begun.gesture.apply(setRouteSetting(route, 'line', 'thickness', 3));
    expect(begun.gesture.commit()).toEqual({ ok: true, changed: false });
    expect(store.getState().project).toBe(first);
    expect(store.getState()).toMatchObject({ undo: null, redo: 'Change the line settings' });
  });

  it('a new step clears Redo', () => {
    const { project, route } = twoStops();
    const store = storeOf(project);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    store.undo();
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 5));
    expect(store.getState().redo).toBeNull();
    expect(store.redo()).toEqual({ ok: false, refusal: { why: 'nothing-to-redo' } });
  });

  it('a cancelled gesture puts back the project and selection it found, and makes no step', () => {
    const { project, route, a, b } = twoStops();
    const store = storeOf(project);
    store.select({ route, points: [a] });
    const begun = store.begin('Move point');
    if (!begun.ok) throw new Error('the gesture did not open');
    store.select({ route, points: [b] });
    begun.gesture.apply(movePoint(route, b, { x: 0.5, y: 0.5 }));
    expect(begun.gesture.cancel()).toEqual({ ok: true, changed: true });
    expect(store.getState()).toMatchObject({ project, selection: { route, points: [a] }, undo: null, gesture: null });
  });

  it('a cancelled gesture that changed nothing says so', () => {
    const { project, route } = twoStops();
    const store = storeOf(project);
    const begun = store.begin('Line width');
    if (!begun.ok) throw new Error('the gesture did not open');
    begun.gesture.apply(setRouteSetting(route, 'line', 'thickness', 3));
    expect(begun.gesture.cancel()).toEqual({ ok: true, changed: false });
    expect(store.getState()).toMatchObject({ project, undo: null, gesture: null });
  });

  it('while a gesture is open, another gesture, a dispatch, Undo and Redo are refused, and nothing changes', () => {
    const { project, route } = twoStops();
    const store = storeOf(project);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    const begun = store.begin('Line width');
    if (!begun.ok) throw new Error('the gesture did not open');
    expect(store.getState().gesture).toBe('Line width');
    const before = store.getState();
    const gestureOpen = { ok: false, refusal: { why: 'gesture-open' } };
    expect(store.begin('Other')).toEqual(gestureOpen);
    expect(store.dispatch(addRoute())).toEqual(gestureOpen);
    expect(store.undo()).toEqual(gestureOpen);
    expect(store.redo()).toEqual(gestureOpen);
    expect(store.getState()).toBe(before);
  });

  it('a closed gesture refuses everything, and a refused command leaves an open gesture open', () => {
    const { project, route } = twoStops();
    const store = storeOf(project);
    const begun = store.begin('Line width');
    if (!begun.ok) throw new Error('the gesture did not open');
    const outcome = begun.gesture.apply(setRouteSetting(route, 'line', 'thickness', 99));
    expect(outcome).toMatchObject({ ok: false, refusal: { why: 'invalid' } });
    expect(store.getState().gesture).toBe('Line width');
    begun.gesture.apply(setRouteSetting(route, 'line', 'thickness', 9));
    begun.gesture.commit();
    const closed = { ok: false, refusal: { why: 'gesture-closed' } };
    expect(begun.gesture.apply(setRouteSetting(route, 'line', 'thickness', 12))).toEqual(closed);
    expect(begun.gesture.commit()).toEqual(closed);
    expect(begun.gesture.cancel()).toEqual(closed);
    expect(thickness(store)).toBe(9);
  });
});

describe('Undo gives back the selection a step found, Redo the one it left (DEF-74, CROWD-06.4)', () => {
  it('Redo restores the selection the action left, and Undo the one it found', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    store.select({ route, points: [a] });
    store.dispatch(addRoute());
    const added = store.getState().selection;
    expect(added).toEqual({ route: 'new-1', points: [] });
    store.select(NOTHING_SELECTED);
    store.undo();
    expect(store.getState().selection).toEqual({ route, points: [a] });
    store.select(NOTHING_SELECTED);
    store.redo();
    expect(store.getState().selection).toBe(added);
  });

  it('a second Undo, then Redo, across two controls', () => {
    const { project, route, a, b } = twoStops();
    const store = storeOf(project);
    store.select({ route, points: [a] });
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 12));
    store.select({ route, points: [b] });
    store.dispatch(setSceneSetting('clock', 'holdAtEndMs', 3_000));
    store.undo();
    store.undo();
    expect(thickness(store)).toBe(3);
    expect(store.getState().project.scene.settings.clock.holdAtEndMs).toBe(project.scene.settings.clock.holdAtEndMs);
    expect(store.getState().selection).toEqual({ route, points: [a] });
    store.redo();
    expect(thickness(store)).toBe(12);
    expect(store.getState().project.scene.settings.clock.holdAtEndMs).toBe(project.scene.settings.clock.holdAtEndMs);
    expect(store.getState().selection).toEqual({ route, points: [a] });
    expect(store.getState()).toMatchObject({ undo: 'Change the line settings', redo: 'Change the clock settings' });
    store.redo();
    expect(store.getState().project.scene.settings.clock.holdAtEndMs).toBe(3_000);
    expect(store.getState().selection).toEqual({ route, points: [b] });
  });

  it('a selection is never a step, and keeps only what the project holds', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    expect(store.select({ route, points: [a, 'gone', a] })).toEqual({ ok: true, changed: true });
    expect(store.getState().selection).toEqual({ route, points: [a] });
    expect(store.getState().undo).toBeNull();
    expect(store.select({ route: 'gone', points: [a] })).toEqual({ ok: true, changed: true });
    expect(store.getState().selection).toBe(NOTHING_SELECTED);
    expect(store.select({ route: null, points: [] })).toEqual({ ok: true, changed: false });
  });

  it('removing the selected route drops it from the selection, and Undo selects it again', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    store.select({ route, points: [a] });
    store.dispatch(removeRoute(route));
    expect(store.getState().selection).toBe(NOTHING_SELECTED);
    store.undo();
    expect(store.getState().selection).toEqual({ route, points: [a] });
  });
});

describe('history, as v3 kept it', () => {
  it('Undo with nothing to undo changes nothing and tells no subscriber', () => {
    const store = storeOf(twoStops().project);
    const before = store.getState();
    const heard = vi.fn();
    store.subscribe(heard);
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
    expect(store.redo()).toEqual({ ok: false, refusal: { why: 'nothing-to-redo' } });
    expect(store.getState()).toBe(before);
    expect(heard).not.toHaveBeenCalled();
  });

  it(`keeps the last ${String(MAX_STEPS)} steps`, () => {
    const { project, route } = twoStops();
    const store = storeOf(project);
    for (let step = 0; step <= MAX_STEPS; step += 1) {
      store.dispatch(setRouteSetting(route, 'line', 'thickness', 4 + (step % 30)));
    }
    let undone = 0;
    while (store.undo().ok) undone += 1;
    expect(undone).toBe(MAX_STEPS);
    expect(thickness(store)).toBe(4);
  });

  it('Undo and Redo give back the very projects they recorded', () => {
    const { project, route } = twoStops();
    const store = storeOf(project);
    const first = store.getState().project;
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    const after = store.getState().project;
    store.undo();
    expect(store.getState().project).toBe(first);
    store.redo();
    expect(store.getState().project).toBe(after);
  });

  it('Open replaces the project: nothing selected, nothing to undo or redo, an open gesture closed', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    store.select({ route, points: [a] });
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    store.undo();
    const begun = store.begin('Move point');
    if (!begun.ok) throw new Error('the gesture did not open');
    const opened = twoStops().project;
    expect(store.open(opened)).toEqual({ ok: true, changed: true });
    expect(store.getState()).toEqual({
      project: opened, selection: NOTHING_SELECTED, undo: null, redo: null, gesture: null, playback: AT_START,
    });
    expect(begun.gesture.apply(movePoint(route, a, { x: 0, y: 0 }))).toEqual({ ok: false, refusal: { why: 'gesture-closed' } });
  });

  it('Open refuses a project its declarations refuse, and changes nothing', () => {
    const { project } = twoStops();
    const store = storeOf(project);
    const before = store.getState();
    const broken = { ...project, scene: { ...project.scene, routes: [...project.scene.routes, ...project.scene.routes] } };
    expect(store.open(broken)).toMatchObject({ ok: false, refusal: { why: 'invalid' } });
    expect(store.getState()).toBe(before);
    expect(() => createStore({ project: broken, nextId: counter('x') })).toThrow(RangeError);
  });

  it('a failed Open, with Redo history and a gesture open, keeps the gesture, the history and the selection', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    store.select({ route, points: [a] });
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 12));
    store.undo();
    const begun = store.begin('Move point');
    if (!begun.ok) throw new Error('the gesture did not open');
    expect(begun.gesture.apply(movePoint(route, a, { x: 0.3, y: 0.3 }))).toEqual({ ok: true, changed: true });
    const before = store.getState();
    const broken = { ...project, scene: { ...project.scene, routes: [...project.scene.routes, ...project.scene.routes] } };
    expect(store.open(broken)).toMatchObject({ ok: false, refusal: { why: 'invalid' } });
    expect(() => store.open({ ...project, images: Object.assign([], { extra: 1 }) })).toThrow(TypeError);
    expect(store.getState()).toBe(before);
    expect(before).toMatchObject({ undo: 'Change the line settings', redo: 'Change the line settings', gesture: 'Move point' });
    expect(before.selection).toEqual({ route, points: [a] });
    expect(begun.gesture.cancel()).toEqual({ ok: true, changed: true });
    expect(store.redo()).toEqual({ ok: true, changed: true });
    expect(thickness(store)).toBe(12);
  });
});

describe('subscribers', () => {
  it('one failing subscriber never stops the others; its error is reported, and the change is kept', () => {
    const { project, route } = twoStops();
    const report = vi.fn();
    const store = createStore({ project, nextId: counter('new'), report });
    const failure = new Error('a broken panel');
    const heard: string[] = [];
    store.subscribe(() => heard.push('first'));
    store.subscribe(() => {
      throw failure;
    });
    store.subscribe(() => heard.push('third'));
    expect(store.dispatch(setRouteSetting(route, 'line', 'thickness', 10))).toEqual({ ok: true, changed: true });
    expect(heard).toEqual(['first', 'third']);
    expect(report).toHaveBeenCalledWith(failure);
    expect(thickness(store)).toBe(10);
    expect(store.getState().undo).toBe('Change the line settings');
    let received: Project | undefined;
    store.dispatch({
      label: 'Look',
      apply: (current) => {
        received = current.project;
        return current;
      },
    });
    expect(received).toBe(store.getState().project);
  });

  it('a failing reporter never stops them either: the dispatch holds, and its failure is thrown again later, on its own', () => {
    const { project, route } = twoStops();
    const broken = new Error('a broken reporter');
    const later: (() => void)[] = [];
    const queued = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => {
      later.push(task);
    });
    try {
      const store = createStore({
        project,
        nextId: counter('new'),
        report: () => {
          throw broken;
        },
      });
      const heard: string[] = [];
      store.subscribe(() => heard.push('first'));
      store.subscribe(() => {
        throw new Error('a broken panel');
      });
      store.subscribe(() => heard.push('third'));
      expect(store.dispatch(setRouteSetting(route, 'line', 'thickness', 10))).toEqual({ ok: true, changed: true });
      expect(heard).toEqual(['first', 'third']);
      expect(thickness(store)).toBe(10);
      expect(later).toHaveLength(1);
      let thrown: unknown;
      try {
        later[0]?.();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toHaveProperty('cause', broken);
    } finally {
      queued.mockRestore();
    }
  });

  it('a subscriber hears each change once, a dispatch once, and nothing after it stops', () => {
    const { project, route } = twoStops();
    const store = storeOf(project);
    const heard = vi.fn();
    const stop = store.subscribe(heard);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    expect(heard).toHaveBeenCalledTimes(1);
    const same = store.getState();
    expect(store.getState()).toBe(same);
    stop();
    store.undo();
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
