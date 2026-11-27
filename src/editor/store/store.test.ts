// CORE-05: the editor's store — one gesture is one undo step, never merged by a timer (DEF-92, CROWD-06.2); Undo gives
// back the selection a step found and Redo the one it left (DEF-74), across two controls (CROWD-06.4); v3's
// UndoService cases kept where v4 has them (v3/tests/undoService.test.js); subscribers isolated (the plan's line 986).
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { AT_START } from '../../player/transport/transport';
import { addRoute, movePoint, removeRoute, setRouteSetting, setSceneSetting } from './command';
import { NOTHING_SELECTED } from './selection';
import { MAX_STEPS, createStore, type Store, type Stepped } from './store';

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

describe('stepped: each step told once (CORE-06, brief 133, ruling CS)', () => {
  /** A store whose `stepped` records what it hears, with the reporter `report`. */
  function told(report: (error: unknown) => void = () => undefined) {
    const { project, route, a, b } = twoStops();
    const heard: Stepped[] = [];
    const store = createStore({ project, nextId: counter('new'), report, stepped: (step) => heard.push(step) });
    return { store, route, a, b, heard };
  }

  it('a dispatch and a gesture’s commit each tell it once, after the change, with the label, what it found and what it left; the gesture’s moves never', () => {
    const { store, route, a, heard } = told();
    const first = store.getState();
    store.dispatch(movePoint(route, a, { x: 0.3, y: 0.3 }));
    expect(heard).toHaveLength(1);
    expect(heard[0]).toEqual({ label: 'Move point', before: { project: first.project, selection: first.selection }, after: { project: store.getState().project, selection: store.getState().selection }, kind: 'commit' });
    const begun = store.begin('Move point');
    if (!begun.ok) throw new Error('begin was refused');
    const found = store.getState().project;
    begun.gesture.apply(movePoint(route, a, { x: 0.4, y: 0.4 }));
    begun.gesture.apply(movePoint(route, a, { x: 0.5, y: 0.5 }));
    expect(heard).toHaveLength(1);
    expect(begun.gesture.commit()).toEqual({ ok: true, changed: true });
    expect(heard).toHaveLength(2);
    expect(heard[1]?.label).toBe('Move point');
    expect(heard[1]?.kind).toBe('commit');
    expect(heard[1]?.before.project).toBe(found);
    expect(heard[1]?.after.project).toBe(store.getState().project);
  });

  it('never for a gesture that ends as it began, a dispatch that changes nothing, or one refused', () => {
    const { store, route, a, heard } = told();
    const begun = store.begin('Move point');
    if (!begun.ok) throw new Error('begin was refused');
    begun.gesture.apply(movePoint(route, a, { x: 0.4, y: 0.4 }));
    begun.gesture.apply(movePoint(route, a, { x: 0.2, y: 0.2 }));
    expect(begun.gesture.commit()).toEqual({ ok: true, changed: false });
    expect(store.dispatch({ label: 'Nothing', apply: (current) => current })).toEqual({ ok: true, changed: false });
    expect(store.dispatch({ label: 'Refused', apply: () => ({ why: 'missing', what: 'a point' }) })).toEqual({ ok: false, refusal: { why: 'missing', what: 'a point' } });
    expect(heard).toEqual([]);
  });

  it('never on a cancel, a selection, Open or the transport’s slice', () => {
    const { store, route, a, b, heard } = told();
    const begun = store.begin('Move point');
    if (!begun.ok) throw new Error('begin was refused');
    begun.gesture.apply(movePoint(route, a, { x: 0.4, y: 0.4 }));
    expect(begun.gesture.cancel()).toEqual({ ok: true, changed: true });
    expect(store.select({ route, points: [a, b] })).toEqual({ ok: true, changed: true });
    expect(store.setPlayback({ ...AT_START, atMs: 10 })).toEqual({ ok: true, changed: true });
    expect(store.open(twoStops().project)).toEqual({ ok: true, changed: true });
    expect(heard).toEqual([]);
  });

  it('once for each Undo and each Redo, the step’s label with what it found and what it left; never for one refused', () => {
    const { store, route, a, heard } = told();
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
    expect(store.redo()).toEqual({ ok: false, refusal: { why: 'nothing-to-redo' } });
    expect(heard).toEqual([]);
    const first = store.getState().project;
    store.dispatch(movePoint(route, a, { x: 0.3, y: 0.3 }));
    const moved = store.getState().project;
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(heard).toHaveLength(2);
    expect(heard[1]).toMatchObject({ label: 'Move point', kind: 'undo' });
    expect(heard[1]?.before.project).toBe(moved);
    expect(heard[1]?.after.project).toBe(first);
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
    expect(heard).toHaveLength(2);
    expect(store.redo()).toEqual({ ok: true, changed: true });
    expect(heard).toHaveLength(3);
    expect(heard[2]).toMatchObject({ label: 'Move point', kind: 'redo' });
    expect(heard[2]?.before.project).toBe(first);
    expect(heard[2]?.after.project).toBe(moved);
    expect(store.redo()).toEqual({ ok: false, refusal: { why: 'nothing-to-redo' } });
    const begun = store.begin('Open');
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'gesture-open' } });
    if (begun.ok) begun.gesture.cancel();
    expect(heard).toHaveLength(3);
  });

  it('one that throws keeps the step: the subscribers were told first, the error goes to the reporter, and Undo still takes it back', () => {
    const report = vi.fn();
    const { project, route, a } = twoStops();
    const order: string[] = [];
    const failure = new Error('a broken status area');
    const store = createStore({
      project,
      nextId: counter('new'),
      report,
      stepped: () => {
        order.push('stepped');
        throw failure;
      },
    });
    store.subscribe(() => order.push('subscriber'));
    expect(store.dispatch(movePoint(route, a, { x: 0.3, y: 0.3 }))).toEqual({ ok: true, changed: true });
    expect(order).toEqual(['subscriber', 'stepped']);
    expect(report).toHaveBeenCalledWith(failure);
    expect(pointAt(store, a)).toMatchObject({ x: 0.3, y: 0.3 });
    expect(store.getState().undo).toBe('Move point');
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(report).toHaveBeenCalledTimes(2);
    expect(pointAt(store, a)).toMatchObject({ x: 0.2, y: 0.2 });
  });
});

describe('changed: whether the project differs from the one the store started with or last opened (D276 (a), brief 144)', () => {
  it('a fresh store is unchanged; a step changes it; Undo back to the baseline is unchanged; Redo changed again', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    expect(store.changed()).toBe(false);
    store.dispatch(movePoint(route, a, { x: 0.3, y: 0.4 }));
    expect(store.changed()).toBe(true);
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 10));
    store.undo();
    expect(store.changed()).toBe(true);
    store.undo();
    expect(store.changed()).toBe(false);
    store.redo();
    expect(store.changed()).toBe(true);
    store.undo();
    expect(store.changed()).toBe(false);
  });

  it('a successful Open makes the opened project the baseline: unchanged at once, changed by a step, unchanged again by Undo', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    store.dispatch(movePoint(route, a, { x: 0.3, y: 0.4 }));
    expect(store.changed()).toBe(true);
    const next = twoStops();
    expect(store.open(next.project).ok).toBe(true);
    expect(store.changed()).toBe(false);
    store.dispatch(movePoint(next.route, next.a, { x: 0.6, y: 0.1 }));
    expect(store.changed()).toBe(true);
    store.undo();
    expect(store.changed()).toBe(false);
  });

  it('an Open the store refuses leaves it as it was, changed or not', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    const broken = { ...project, scene: { ...project.scene, routes: [...project.scene.routes, ...project.scene.routes] } };
    expect(store.open(broken).ok).toBe(false);
    expect(store.changed()).toBe(false);
    store.dispatch(movePoint(route, a, { x: 0.3, y: 0.4 }));
    expect(store.open(broken).ok).toBe(false);
    expect(store.changed()).toBe(true);
  });

  it('never changed by a selection, the transport’s slice, a refused edit or one that changes nothing', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    store.select({ route, points: [a] });
    expect(store.setPlayback({ playing: true, atMs: 500, speed: 2 }).ok).toBe(true);
    expect(store.dispatch(movePoint(route, 'no-such-point', { x: 0.3, y: 0.4 })).ok).toBe(false);
    expect(store.dispatch(movePoint(route, a, { x: 0.2, y: 0.2 }))).toEqual({ ok: true, changed: false });
    expect(store.changed()).toBe(false);
  });

  it('never changed by a gesture’s begin, its moves before the commit, a cancel or a commit that ends as it began; changed by a commit that moved', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    const first = store.begin('Move point');
    if (!first.ok) throw new Error('begin was refused');
    expect(store.changed()).toBe(false);
    first.gesture.apply(movePoint(route, a, { x: 0.5, y: 0.5 }));
    expect(store.getState().project).not.toBe(project);
    expect(store.changed()).toBe(false);
    first.gesture.cancel();
    expect(store.changed()).toBe(false);
    const second = store.begin('Move point');
    if (!second.ok) throw new Error('begin was refused');
    second.gesture.apply(movePoint(route, a, { x: 0.5, y: 0.5 }));
    second.gesture.apply(movePoint(route, a, { x: 0.2, y: 0.2 }));
    expect(second.gesture.commit()).toEqual({ ok: true, changed: false });
    expect(store.changed()).toBe(false);
    const third = store.begin('Move point');
    if (!third.ok) throw new Error('begin was refused');
    third.gesture.apply(movePoint(route, a, { x: 0.5, y: 0.5 }));
    expect(store.changed()).toBe(false);
    expect(third.gesture.commit()).toEqual({ ok: true, changed: true });
    expect(store.changed()).toBe(true);
    const fourth = store.begin('Move point');
    if (!fourth.ok) throw new Error('begin was refused');
    expect(store.changed()).toBe(true);
    fourth.gesture.cancel();
    expect(store.changed()).toBe(true);
  });

  it('Undo hands back the very project the baseline holds, so the comparison is by identity', () => {
    const { project, route, a } = twoStops();
    const store = storeOf(project);
    const baseline = store.getState().project;
    store.select({ route, points: [a] });
    store.dispatch(movePoint(route, a, { x: 0.3, y: 0.4 }));
    store.undo();
    expect(store.getState().project).toBe(baseline);
  });
});
