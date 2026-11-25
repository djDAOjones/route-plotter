// CORE-06: the drawing commands on a real store (`createStore`). Each command dispatched is one undo step that Undo
// takes back, project and selection as found, and Redo makes again; a refused edit and an edit that changes nothing
// make no step; the limits are the store's check (the 10,001st point is `invalid`); three pen steps inside one
// gesture are one step, and `cancel` puts all three back. A point the pen adds or reaches is selected alone; every
// other edit keeps the selection.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { LIMITS } from '../../core/config/limits';
import { newLine, newPoint, newRoute, newScene, type IdSource, type Route } from '../../core/model/scene';
import type { Command } from '../store/command';
import { createStore, type Store } from '../store/store';
import {
  addPoint,
  deleteLine,
  deletePoints,
  duplicatePoints,
  joinPoints,
  markPoint,
  movePoints,
  penStep,
  reverseLine,
  setDirection,
  setKind,
  setLeadStart,
  splitLine,
  unmarkPoint,
} from './commands';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}${String((n += 1))}`;
}

const stop = (x: number, y: number) => ({ x, y, kind: 'stop' as const });

/** A route of three points chained a → b → c, its start marked on a, and the store holding it with b selected. */
function chain() {
  const nextId = counter('seed');
  const [a, b, c] = [newPoint(nextId, stop(0.1, 0.1)), newPoint(nextId, stop(0.5, 0.1)), newPoint(nextId, stop(0.9, 0.1))];
  const lines = [newLine(nextId, a.id, b.id), newLine(nextId, b.id, c.id)];
  const route: Route = {
    ...newRoute(nextId),
    points: [a, b, c],
    lines,
    marks: [{ point: a.id, end: 'start' }],
    leadStart: a.id,
  };
  const project: Project = { scene: { ...newScene(nextId), routes: [route] }, images: [] };
  const store = createStore({ project, nextId: counter('new') });
  expect(store.select({ route: route.id, points: [b.id] }).ok).toBe(true);
  return { store, route: route.id, a: a.id, b: b.id, c: c.id, ab: lineOf(lines, 0), bc: lineOf(lines, 1) };
}

function lineOf(lines: readonly Route['lines'][number][], i: number): string {
  const line = lines[i];
  if (line === undefined) throw new Error(`no line ${String(i)}`);
  return line.id;
}

const routeIn = (store: Store): Route => {
  const route = store.getState().project.scene.routes[0];
  if (route === undefined) throw new Error('no route');
  return route;
};

describe('the drawing commands, each one undo step', () => {
  const cases: [string, (ids: ReturnType<typeof chain>) => Command, string][] = [
    ['addPoint', ({ route }) => addPoint(route, stop(0.3, 0.6)), 'Add point'],
    ['joinPoints', ({ route, c, a }) => joinPoints(route, c, a), 'Join points'],
    ['penStep to a place', ({ route, c }) => penStep(route, c, { place: stop(0.9, 0.9) }), 'Add point'],
    ['penStep to a point', ({ route, c, a }) => penStep(route, c, { point: a }), 'Join points'],
    ['setDirection', ({ route, ab }) => setDirection(route, ab, 'both ways'), 'Make line two-way'],
    ['reverseLine', ({ route, ab }) => reverseLine(route, ab), 'Reverse line'],
    ['deletePoints, one point', ({ route, b }) => deletePoints(route, [b]), 'Delete point'],
    ['deletePoints, two points', ({ route, b, c }) => deletePoints(route, [b, c]), 'Delete points'],
    ['deleteLine', ({ route, bc }) => deleteLine(route, bc), 'Delete line'],
    ['splitLine', ({ route, ab }) => splitLine(route, ab, { x: 0.3, y: 0.2, kind: 'bend' }), 'Insert point'],
    ['movePoints, one point', ({ route, a }) => movePoints(route, [a], 0.005, 0), 'Move point'],
    ['movePoints, two points', ({ route, a, b }) => movePoints(route, [a, b], 0, -0.02), 'Move points'],
    ['duplicatePoints', ({ route, a, b }) => duplicatePoints(route, [a, b]), 'Duplicate'],
    ['setLeadStart', ({ route, c }) => setLeadStart(route, c), 'Set lead start'],
    ['markPoint', ({ route, c }) => markPoint(route, c, 'end'), 'Mark as end'],
    ['unmarkPoint', ({ route, a }) => unmarkPoint(route, a, 'start'), 'Remove start mark'],
    ['setKind', ({ route, b }) => setKind(route, b, 'bend'), 'Make bend'],
  ];

  for (const [name, make, label] of cases) {
    it(`${name}: one step named “${label}”; Undo gives back the project and selection as found, Redo makes it again`, () => {
      const ids = chain();
      const { store } = ids;
      const before = store.getState();
      expect(store.dispatch(make(ids))).toEqual({ ok: true, changed: true });
      const after = store.getState();
      expect(after.project).not.toEqual(before.project);
      expect(after.undo).toBe(label);
      expect(store.undo()).toEqual({ ok: true, changed: true });
      expect(store.getState().project).toEqual(before.project);
      expect(store.getState().selection).toEqual(before.selection);
      expect(store.getState().undo).toBeNull();
      expect(store.redo()).toEqual({ ok: true, changed: true });
      expect(store.getState().project).toEqual(after.project);
      expect(store.getState().selection).toEqual(after.selection);
    });
  }

  it('the other labels: one way, mark as start, remove end mark, make stop', () => {
    const ids = chain();
    expect(setDirection(ids.route, ids.ab, 'one way').label).toBe('Make line one way');
    expect(markPoint(ids.route, ids.a, 'start').label).toBe('Mark as start');
    expect(unmarkPoint(ids.route, ids.a, 'end').label).toBe('Remove end mark');
    expect(setKind(ids.route, ids.a, 'stop').label).toBe('Make stop');
  });
});

describe('the selection after a drawing command', () => {
  it('a point the pen adds is selected alone, so the pen is the selection’s last point', () => {
    const { store, route, c } = chain();
    expect(store.dispatch(penStep(route, c, { place: stop(0.9, 0.9) })).ok).toBe(true);
    const added = routeIn(store).points.at(-1)?.id;
    expect(store.getState().selection).toEqual({ route, points: [added] });
    expect(routeIn(store).lines.at(-1)).toMatchObject({ from: c, to: added });
  });

  it('a point the pen reaches is selected alone, even when nothing is added, and that makes no step', () => {
    const { store, route, a, b } = chain();
    const project = store.getState().project;
    expect(store.dispatch(penStep(route, a, { point: b }))).toEqual({ ok: true, changed: false });
    expect(store.getState().project).toBe(project);
    expect(store.getState().selection).toEqual({ route, points: [b] });
    expect(store.dispatch(penStep(route, b, { point: a })).ok).toBe(true);
    expect(store.getState().selection).toEqual({ route, points: [a] });
    expect(store.getState().undo).toBeNull();
  });

  it('a point added is selected alone; every other edit keeps the selection', () => {
    const { store, route, a, b, c, ab } = chain();
    expect(store.dispatch(addPoint(route, stop(0.2, 0.8))).ok).toBe(true);
    const added = routeIn(store).points.at(-1)?.id;
    expect(store.getState().selection).toEqual({ route, points: [added] });
    expect(store.select({ route, points: [a, b] }).ok).toBe(true);
    const kept = store.getState().selection;
    for (const command of [
      joinPoints(route, c, a),
      setDirection(route, ab, 'both ways'),
      reverseLine(route, ab),
      setLeadStart(route, c),
      markPoint(route, c, 'end'),
      unmarkPoint(route, c, 'end'),
      setKind(route, b, 'bend'),
    ]) {
      expect(store.dispatch(command)).toEqual({ ok: true, changed: true });
      expect(store.getState().selection).toBe(kept);
    }
  });
});

describe('the selection after a delete', () => {
  it('is kept, less what went; the closed-up chain a → c; Undo gives back both', () => {
    const { store, route, a, b, c, ab } = chain();
    expect(store.select({ route, points: [a, b] }).ok).toBe(true);
    const before = store.getState();
    expect(store.dispatch(deletePoints(route, [b]))).toEqual({ ok: true, changed: true });
    expect(store.getState().selection).toEqual({ route, points: [a] });
    expect(routeIn(store).lines).toEqual([{ ...before.project.scene.routes[0]?.lines[0], to: c }]);
    expect(routeIn(store).lines[0]?.id).toBe(ab);
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(store.getState().project).toEqual(before.project);
    expect(store.getState().selection).toEqual(before.selection);
  });

  it('a deleted node drops out of the selection (v3 :600), and the route stays selected', () => {
    const { store, route, b } = chain();
    expect(store.dispatch(deletePoints(route, [b]))).toEqual({ ok: true, changed: true });
    expect(store.getState().selection).toEqual({ route, points: [] });
  });

  it('no points named makes no step', () => {
    const { store, route } = chain();
    const before = store.getState();
    expect(store.dispatch(deletePoints(route, []))).toEqual({ ok: true, changed: false });
    expect(store.getState()).toBe(before);
  });
});

describe('the selection after an insert, a move or a duplicate', () => {
  it('a point inserted on a line is selected alone; a move keeps the selection', () => {
    const { store, route, a, b, ab } = chain();
    expect(store.dispatch(splitLine(route, ab, { x: 0.3, y: 0.2, kind: 'bend' })).ok).toBe(true);
    const inserted = routeIn(store).points.at(-1)?.id;
    expect(store.getState().selection).toEqual({ route, points: [inserted] });
    expect(routeIn(store).lines.slice(0, 2)).toMatchObject([
      { id: ab, from: a, to: inserted },
      { from: inserted, to: b },
    ]);
    expect(store.select({ route, points: [a, b] }).ok).toBe(true);
    const kept = store.getState().selection;
    expect(store.dispatch(movePoints(route, [a, b], 0.01, 0.01))).toEqual({ ok: true, changed: true });
    expect(store.getState().selection).toBe(kept);
  });

  it('the copies are selected, the last copy last, with the line between them copied', () => {
    const { store, route, a, b } = chain();
    expect(store.dispatch(duplicatePoints(route, [b, a])).ok).toBe(true);
    const [copyB, copyA] = routeIn(store).points.slice(3).map((point) => point.id);
    expect(store.getState().selection).toEqual({ route, points: [copyB, copyA] });
    expect(routeIn(store).lines.at(-1)).toMatchObject({ from: copyA, to: copyB });
  });

  it('a drag of three moves inside one gesture is one step, which Undo takes back whole', () => {
    const { store, route, b } = chain();
    const before = store.getState();
    const begun = store.begin('Move point');
    if (!begun.ok) throw new Error('no gesture');
    for (let i = 0; i < 3; i += 1) expect(begun.gesture.apply(movePoints(route, [b], 0.01, 0))).toEqual({ ok: true, changed: true });
    expect(begun.gesture.commit()).toEqual({ ok: true, changed: true });
    expect(routeIn(store).points[1]?.x).toBeCloseTo(0.53, 10);
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(store.getState().project).toEqual(before.project);
    expect(store.getState().undo).toBeNull();
  });
});

describe('refusals and edits that change nothing make no step', () => {
  it('a refused edit makes no step and changes nothing, carrying the core’s refusal', () => {
    const { store, route, a, b, ab } = chain();
    const before = store.getState();
    const refusals: [Command, unknown][] = [
      [joinPoints(route, a, b), { refused: 'already-joined', id: ab }],
      [joinPoints(route, a, a), { refused: 'same-point', id: a }],
      [penStep(route, 'nope', { point: a }), { refused: 'no-such-point', id: 'nope' }],
      [setDirection(route, 'nope', 'both ways'), { refused: 'no-such-line', id: 'nope' }],
      [reverseLine(route, 'nope'), { refused: 'no-such-line', id: 'nope' }],
      [deletePoints(route, [a, 'nope']), { refused: 'no-such-point', id: 'nope' }],
      [deleteLine(route, 'nope'), { refused: 'no-such-line', id: 'nope' }],
      [splitLine(route, 'nope', stop(0.5, 0.5)), { refused: 'no-such-line', id: 'nope' }],
      [movePoints(route, ['nope'], 0.1, 0), { refused: 'no-such-point', id: 'nope' }],
      [duplicatePoints(route, [a, 'nope']), { refused: 'no-such-point', id: 'nope' }],
      [setLeadStart(route, 'nope'), { refused: 'no-such-point', id: 'nope' }],
      [markPoint(route, 'nope', 'end'), { refused: 'no-such-point', id: 'nope' }],
      [setKind(route, 'nope', 'bend'), { refused: 'no-such-point', id: 'nope' }],
    ];
    for (const [command, refusal] of refusals) {
      expect(store.dispatch(command)).toEqual({ ok: false, refusal: { why: 'refused-edit', refusal } });
      expect(store.getState()).toBe(before);
    }
    expect(store.dispatch(addPoint('nope', stop(0.5, 0.5)))).toEqual({
      ok: false,
      refusal: { why: 'missing', what: 'route nope' },
    });
    expect(store.getState()).toBe(before);
  });

  it('an edit that changes nothing makes no step', () => {
    const { store, route, a, ab } = chain();
    const before = store.getState();
    for (const command of [
      setDirection(route, ab, 'one way'),
      setLeadStart(route, a),
      markPoint(route, a, 'start'),
      unmarkPoint(route, a, 'end'),
      setKind(route, a, 'stop'),
      movePoints(route, [a], 0, 0),
      duplicatePoints(route, []),
    ]) {
      expect(store.dispatch(command)).toEqual({ ok: true, changed: false });
      expect(store.getState()).toBe(before);
    }
  });

  it(`the ${String(LIMITS.points + 1)}th point is refused as invalid by the store`, () => {
    const nextId = counter('big');
    const points = Array.from({ length: LIMITS.points }, (_, i) => newPoint(nextId, stop((i % 100) / 100, 0.5)));
    const full: Route = { ...newRoute(nextId), points, leadStart: points[0]?.id ?? null };
    const project: Project = { scene: { ...newScene(nextId), routes: [full] }, images: [] };
    const store = createStore({ project, nextId: counter('new') });
    const before = store.getState();
    const outcome = store.dispatch(addPoint(full.id, stop(0.5, 0.5)));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.refusal.why).toBe('invalid');
    expect(store.getState()).toBe(before);
  });
});

describe('three pen steps in one gesture', () => {
  function threeSteps(store: Store, route: string, from: string) {
    const begun = store.begin('Draw');
    if (!begun.ok) throw new Error('no gesture');
    let pen = from;
    for (const place of [stop(0.2, 0.9), stop(0.5, 0.9), stop(0.8, 0.9)]) {
      expect(begun.gesture.apply(penStep(route, pen, { place }))).toEqual({ ok: true, changed: true });
      pen = store.getState().selection.points.at(-1) ?? '';
    }
    return begun.gesture;
  }

  it('are one step, which Undo takes back whole', () => {
    const { store, route, c } = chain();
    const before = store.getState();
    const gesture = threeSteps(store, route, c);
    expect(routeIn(store).points).toHaveLength(6);
    expect(routeIn(store).lines).toHaveLength(5);
    expect(gesture.commit()).toEqual({ ok: true, changed: true });
    expect(store.getState().undo).toBe('Draw');
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(store.getState().project).toEqual(before.project);
    expect(store.getState().selection).toEqual(before.selection);
    expect(store.getState().undo).toBeNull();
  });

  it('and cancel puts all three back', () => {
    const { store, route, c } = chain();
    const before = store.getState();
    const gesture = threeSteps(store, route, c);
    expect(gesture.cancel()).toEqual({ ok: true, changed: true });
    expect(store.getState().project).toBe(before.project);
    expect(store.getState().selection).toBe(before.selection);
    expect(store.getState().undo).toBeNull();
  });
});
