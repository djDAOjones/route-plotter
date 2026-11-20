// CORE-05: the store's commands — every change is a command, checked by CORE-01's declarations (nothing declared twice),
// ids injected, and a project that never depends on the order of its edits (DEF-10's lesson). A scene setting with a
// route makes its own undo entry, as v3's Duration did not (CROWD-06.3).
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { LIMITS } from '../../core/config/limits';
import { addRoute, movePoint, removeRoute, setRouteSetting, setSceneSetting, type Command } from './command';
import { createStore, type Store } from './store';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

function oneStop(): { project: Project; route: string; a: string } {
  const nextId = counter('seed');
  const a = newPoint(nextId, { x: 0.5, y: 0.5, kind: 'stop' });
  const route = { ...newRoute(nextId), points: [a], leadStart: a.id };
  return { project: { scene: { ...newScene(nextId), routes: [route] }, images: [] }, route: route.id, a: a.id };
}

const storeOf = (project: Project, nextId: IdSource = counter('new')): Store => createStore({ project, nextId });

describe('every change is a command, checked by the declarations', () => {
  it('each scene setting with a route makes its own undo entry (CROWD-06.3)', () => {
    const { project } = oneStop();
    const store = storeOf(project);
    const first = store.getState().project;
    const clock = () => store.getState().project.scene.settings.clock;
    const fixedLengthMs = project.scene.settings.clock.fixedLengthMs;
    expect(store.dispatch(setSceneSetting('clock', 'length', 'fixed'))).toEqual({ ok: true, changed: true });
    expect(store.dispatch(setSceneSetting('clock', 'fixedLengthMs', 12_000))).toEqual({ ok: true, changed: true });
    expect(clock()).toMatchObject({ length: 'fixed', fixedLengthMs: 12_000 });
    expect(store.getState().undo).toBe('Change the clock settings');
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(clock()).toMatchObject({ length: 'fixed', fixedLengthMs });
    expect(store.getState().undo).toBe('Change the clock settings');
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(store.getState().project).toBe(first);
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
  });

  it('a value outside its declared range is refused, naming the field, and nothing changes', () => {
    const { project, route } = oneStop();
    const store = storeOf(project);
    const before = store.getState();
    expect(store.dispatch(setRouteSetting(route, 'line', 'thickness', 41))).toMatchObject({
      ok: false,
      refusal: { why: 'invalid', problems: [{ path: 'routes[0].settings.line.thickness', rule: 'range' }] },
    });
    expect(store.dispatch(setSceneSetting('clock', 'holdAtEndMs', -1))).toMatchObject({
      ok: false,
      refusal: { why: 'invalid', problems: [{ path: 'settings.clock.holdAtEndMs', rule: 'range' }] },
    });
    expect(store.dispatch(movePoint(route, oneStop().a, { x: 12, y: 0.5 }))).toMatchObject({
      ok: false,
      refusal: { why: 'invalid', problems: [{ path: 'routes[0].points[0].x', rule: 'range' }] },
    });
    expect(store.getState()).toBe(before);
  });

  it('a command naming what the project does not hold is refused', () => {
    const { project, route } = oneStop();
    const store = storeOf(project);
    const missing = (what: string) => ({ ok: false, refusal: { why: 'missing', what } });
    expect(store.dispatch(setRouteSetting('nope', 'lead', 'speed', 2))).toEqual(missing('route nope'));
    expect(store.dispatch(movePoint(route, 'nope', { x: 0.1, y: 0.1 }))).toEqual(missing('point nope'));
    expect(store.dispatch(removeRoute('nope'))).toEqual(missing('route nope'));
  });

  it('a new route takes its id from the injected source, and an id already used is refused', () => {
    const { project } = oneStop();
    const store = storeOf(project, counter('fresh'));
    store.dispatch(addRoute());
    expect(store.getState().project.scene.routes.map((route) => route.id)).toEqual(['seed-2', 'fresh-1']);
    const stuck = storeOf(project, () => 'seed-2');
    const first = stuck.getState().project;
    expect(stuck.dispatch(addRoute())).toMatchObject({ ok: false, refusal: { why: 'invalid' } });
    expect(stuck.getState().project).toBe(first);
  });

  it(`refuses a route past the limit of ${String(LIMITS.routes)}`, () => {
    const { project } = oneStop();
    const store = storeOf(project);
    for (let n = 1; n < LIMITS.routes; n += 1) expect(store.dispatch(addRoute()).ok).toBe(true);
    expect(store.dispatch(addRoute())).toMatchObject({ ok: false, refusal: { why: 'invalid' } });
    expect(store.getState().project.scene.routes).toHaveLength(LIMITS.routes);
  });

  it('a command changes only what it names', () => {
    const { project, route } = oneStop();
    const store = storeOf(project);
    const first = store.getState().project;
    store.dispatch(setRouteSetting(route, 'lead', 'speed', 2));
    const after = store.getState().project;
    expect(after.images).toBe(first.images);
    expect(after.scene.settings).toBe(first.scene.settings);
    const [was, now] = [first.scene.routes[0], after.scene.routes[0]];
    expect(now?.points).toBe(was?.points);
    expect(now?.settings.line).toBe(was?.settings.line);
    expect(now?.settings.lead).toEqual({ ...was?.settings.lead, speed: 2 });
  });
});

describe('the project never depends on the order of its edits (DEF-10)', () => {
  it('independent edits in either order give the same project, key for key', () => {
    const { project, route, a } = oneStop();
    const edits: readonly Command[] = [
      setRouteSetting(route, 'line', 'thickness', 7),
      setRouteSetting(route, 'line', 'colour', '#0072b2'),
      setSceneSetting('clock', 'holdAtStartMs', 500),
      movePoint(route, a, { x: 0.25, y: 0.75 }),
    ];
    const forward = storeOf(project);
    const backward = storeOf(project);
    const done = { ok: true, changed: true };
    for (const edit of edits) expect(forward.dispatch(edit)).toEqual(done);
    for (const edit of [...edits].reverse()) expect(backward.dispatch(edit)).toEqual(done);
    const edited = forward.getState().project;
    expect(edited.scene.routes[0]?.settings.line).toMatchObject({ thickness: 7, colour: '#0072b2' });
    expect(edited.scene.settings.clock.holdAtStartMs).toBe(500);
    expect(edited.scene.routes[0]?.points[0]).toMatchObject({ x: 0.25, y: 0.75 });
    expect(JSON.stringify(backward.getState().project)).toBe(JSON.stringify(forward.getState().project));
    expect(JSON.stringify(Object.keys(forward.getState().project.scene.routes[0]?.settings.line ?? {}))).toBe(
      JSON.stringify(Object.keys(project.scene.routes[0]?.settings.line ?? {})),
    );
  });
});
