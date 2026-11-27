// CORE-06, chat G1 (brief 130, rulings CC and CE; D267 (a)): the point's menu as one pure list, proved on a real store.
// Its words and enabled state for a plain point, a marked start, a marked end, the lead's start, a stop and a bend; an
// item that cannot run listed disabled with its reason; each item run as its built command, one undo step under the
// command's words; Delete on a point inside the selection deleting the selection; and how the menu selects its point.
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { newLine, newPoint, newRoute, newScene, type IdSource, type Route } from '../../core/model/scene';
import { createStore, type Store } from '../store/store';
import { NOTHING_SELECTED } from '../store/selection';
import { deletePoints } from './commands';
import { itemReason, menuSelection, pointMenu, runItem, type MenuItem } from './menu';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}${String((n += 1))}`;
}

/** A route a → b → c, the lead from a; c a bend, b marked as the end, a as the start; and a second route. */
function scene() {
  const nextId = counter('seed');
  const a = newPoint(nextId, { x: 0.2, y: 0.2, kind: 'stop' });
  const b = newPoint(nextId, { x: 0.6, y: 0.6, kind: 'stop' });
  const c = newPoint(nextId, { x: 0.9, y: 0.1, kind: 'bend' });
  const d = newPoint(nextId, { x: 0.5, y: 0.9, kind: 'stop' });
  const lines = [newLine(nextId, a.id, b.id), newLine(nextId, b.id, c.id)];
  const marks: Route['marks'] = [{ point: a.id, end: 'start' }, { point: b.id, end: 'end' }];
  const route: Route = { ...newRoute(nextId), points: [a, b, c, d], lines, marks, leadStart: a.id };
  const lone = newPoint(nextId, { x: 0.4, y: 0.8, kind: 'stop' });
  const other: Route = { ...newRoute(nextId), points: [lone], lines: [], leadStart: lone.id };
  const project: Project = { scene: { ...newScene(nextId), routes: [route, other] }, images: [] };
  const store = createStore({ project, nextId: counter('new') });
  return { store, route: route.id, a: a.id, b: b.id, c: c.id, d: d.id };
}

const routeOf = (store: Store): Route => {
  const route = store.getState().project.scene.routes[0];
  if (route === undefined) throw new Error('a route');
  return route;
};

/** Each item as words, whether it runs, and a separator before it. */
const shape = (items: readonly MenuItem[]) => items.map((item) => [item.label, item.reason === null, item.apart] as const);

const menuOf = (store: Store, route: string, point: string) => {
  const menu = pointMenu(store.getState(), route, point);
  if (menu === null) throw new Error('a menu');
  return menu;
};

const item = (store: Store, route: string, point: string, label: string): MenuItem => {
  const found = menuOf(store, route, point).items.find((each) => each.label === label);
  if (found === undefined) throw new Error(`no item ${label}`);
  return found;
};

describe('the point\'s menu, its items (CC, D267 (a))', () => {
  it('a plain stop: both marks to add, the lead\'s start to set, made a bend, then Delete set apart', () => {
    const { store, route, d } = scene();
    expect(shape(menuOf(store, route, d).items)).toEqual([
      ['Mark as start', true, false],
      ['Mark as end', true, false],
      ['Set lead start', true, false],
      ['Make bend', true, false],
      ['Move', true, false],
      ['Delete', true, true],
    ]);
  });

  it('a marked start that is the lead\'s start: its mark to remove, and "Set lead start" disabled with its reason', () => {
    const { store, route, a } = scene();
    const items = menuOf(store, route, a).items;
    expect(shape(items)).toEqual([
      ['Remove start mark', true, false],
      ['Mark as end', true, false],
      ['Set lead start', false, false],
      ['Make bend', true, false],
      ['Move', true, false],
      ['Delete', true, true],
    ]);
    expect(items[2]?.reason).toBe('This point is already where the lead starts.');
  });

  it('a marked end: its mark to remove; a bend: made a stop', () => {
    const { store, route, b, c } = scene();
    expect(menuOf(store, route, b).items.map((each) => each.label)).toEqual(['Mark as start', 'Remove end mark', 'Set lead start', 'Make bend', 'Move', 'Delete']);
    expect(menuOf(store, route, c).items.map((each) => each.label)).toEqual(['Mark as start', 'Mark as end', 'Set lead start', 'Make stop', 'Move', 'Delete']);
  });

  it('every item\'s words are its command\'s undo words, Delete\'s excepted ("Delete point" or "Delete points"); Move has no command', () => {
    const { store, route, d } = scene();
    for (const each of menuOf(store, route, d).items) {
      if (each.label === 'Move') expect(each.command).toBeNull();
      else expect(each.command?.label).toBe(each.label === 'Delete' ? 'Delete point' : each.label);
    }
  });

  it('a point or route the project does not hold has no menu', () => {
    const { store, route } = scene();
    expect(pointMenu(store.getState(), route, 'nowhere')).toBeNull();
    expect(pointMenu(store.getState(), 'nowhere', 'nowhere')).toBeNull();
  });

  it('an item whose command would be refused is disabled with the refusal\'s reason, and run late it changes nothing (CE (b))', () => {
    const { store, route, d } = scene();
    const stale = menuOf(store, route, d).items;
    // The point taken away under the open menu: each built command would now refuse it.
    store.dispatch(deletePoints(route, [d]));
    for (const each of stale) if (each.command !== null) expect(itemReason(store.getState(), each.command, 'unused')).toBe('This point is no longer on the route.');
    const before = store.getState();
    for (const each of stale) expect(runItem(store, each)).toBe(false);
    expect(store.getState().project).toBe(before.project);
    expect(store.getState().undo).toBe('Delete point');
  });
});

describe('running an item (CE (c), (d))', () => {
  it('each item changes the route as its command does, one undo step under the command\'s words, undone by one Undo', () => {
    const cases: readonly [string, (route: Route, point: string) => unknown][] = [
      ['Mark as start', (r, p) => r.marks.some((m) => m.point === p && m.end === 'start')],
      ['Mark as end', (r, p) => r.marks.some((m) => m.point === p && m.end === 'end')],
      ['Set lead start', (r, p) => r.leadStart === p],
      ['Make bend', (r, p) => r.points.find((each) => each.id === p)?.kind === 'bend'],
      ['Delete', (r, p) => !r.points.some((each) => each.id === p)],
    ];
    for (const [label, holds] of cases) {
      const { store, route, d } = scene();
      const before = routeOf(store);
      expect(holds(before, d)).toBe(false);
      expect(runItem(store, item(store, route, d, label))).toBe(true);
      expect(holds(routeOf(store), d)).toBe(true);
      expect(store.getState().undo).toBe(label === 'Delete' ? 'Delete point' : label);
      expect(store.undo()).toEqual({ ok: true, changed: true });
      expect(routeOf(store)).toEqual(before);
      expect(store.getState().undo).toBeNull();
    }
  });

  // Codex's finding 2 on brief 130: each of these three alone, from a scene of its own, so that each is held to its own
  // change, its own words and exactly one step that one Undo takes back in full.
  /** One undo step under `label`: one Undo gives back `before` in full, and a second has nothing to undo. */
  const oneStep = (store: Store, before: Route, label: string) => {
    expect(store.getState().undo).toBe(label);
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect(routeOf(store)).toEqual(before);
    expect(store.getState().undo).toBeNull();
    expect(store.undo()).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
  };

  it('"Remove start mark" takes the start mark off, and nothing else, as one step under its words', () => {
    const { store, route, a, b } = scene();
    const before = routeOf(store);
    expect(runItem(store, item(store, route, a, 'Remove start mark'))).toBe(true);
    expect(routeOf(store)).toEqual({ ...before, marks: [{ point: b, end: 'end' }] });
    oneStep(store, before, 'Remove start mark');
  });

  it('"Remove end mark" takes the end mark off, and nothing else, as one step under its words', () => {
    const { store, route, a, b } = scene();
    const before = routeOf(store);
    expect(runItem(store, item(store, route, b, 'Remove end mark'))).toBe(true);
    expect(routeOf(store)).toEqual({ ...before, marks: [{ point: a, end: 'start' }] });
    oneStep(store, before, 'Remove end mark');
  });

  it('"Make stop" makes a bend a stop, and nothing else, as one step under its words', () => {
    const { store, route, c } = scene();
    const before = routeOf(store);
    expect(runItem(store, item(store, route, c, 'Make stop'))).toBe(true);
    expect(routeOf(store)).toEqual({
      ...before,
      points: before.points.map((each) => (each.id === c ? { ...each, kind: 'stop' } : each)),
    });
    oneStep(store, before, 'Make stop');
  });

  it('a disabled item runs nothing: no command reaches the store, no change, no step, and says so', () => {
    const { store, route, a } = scene();
    const disabled = item(store, route, a, 'Set lead start');
    const before = store.getState();
    // Codex's finding 3 on brief 130: the store alone would make no step here either (the lead's start set again is
    // unchanged), so the guard is proved by no command reaching the store at all.
    const dispatch = vi.spyOn(store, 'dispatch');
    expect(runItem(store, disabled)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
    expect(store.getState().undo).toBeNull();
  });

  it('Delete on a point inside the selection deletes the whole selection as one step; outside it, the point alone', () => {
    const { store, route, b, c, d } = scene();
    store.select({ route, points: [c, d] });
    runItem(store, item(store, route, d, 'Delete'));
    expect(routeOf(store).points.map((each) => each.id).filter((id) => [c, d].includes(id))).toEqual([]);
    expect(store.getState().undo).toBe('Delete points');
    store.undo();
    store.select({ route, points: [c, d] });
    runItem(store, item(store, route, b, 'Delete'));
    expect(routeOf(store).points.map((each) => each.id)).toContain(c);
    expect(routeOf(store).points.map((each) => each.id)).not.toContain(b);
    expect(store.getState().undo).toBe('Delete point');
  });
});

describe('"Move" (brief 138, DA; D242, D250 (a), D270)', () => {
  it('stands after "Make stop" or "Make bend" and before Delete, not set apart; the others\' order unchanged', () => {
    const { store, route, a, d } = scene();
    for (const point of [a, d]) {
      const labels = menuOf(store, route, point).items.map((each) => each.label);
      expect(labels.indexOf('Move')).toBe(4);
      expect(labels.at(-1)).toBe('Delete');
      expect(labels).toHaveLength(6);
    }
    expect(item(store, route, d, 'Move').apart).toBe(false);
    expect(item(store, route, d, 'Move').reason).toBeNull();
  });

  it('is no store command: `runItem` never dispatches it, and nothing changes; its move names the route, the point and its points', () => {
    const { store, route, d } = scene();
    const dispatch = vi.spyOn(store, 'dispatch');
    const move = item(store, route, d, 'Move');
    expect(move.command).toBeNull();
    expect(move.move).toEqual({ route, point: d, points: [d] });
    const before = store.getState();
    expect(runItem(store, move)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
    for (const each of menuOf(store, route, d).items) if (each.label !== 'Move') expect(each.move).toBeNull();
  });

  it('its points: the whole selection when the point is in it, in the selection\'s order; else the point alone', () => {
    const { store, route, b, c, d } = scene();
    store.select({ route, points: [c, d] });
    expect(item(store, route, d, 'Move').move).toEqual({ route, point: d, points: [c, d] });
    expect(item(store, route, b, 'Move').move).toEqual({ route, point: b, points: [b] });
  });
});

describe('the selection the menu opens with (CB)', () => {
  it('a point outside the selection is selected alone; a point inside it keeps the selection as it is', () => {
    const { store, route, b, c, d } = scene();
    expect(menuSelection(NOTHING_SELECTED, route, d)).toEqual({ route, points: [d] });
    const held = { route, points: [c, d] };
    expect(menuSelection(held, route, d)).toBe(held);
    expect(menuSelection(held, route, b)).toEqual({ route, points: [b] });
    expect(menuSelection({ route: 'elsewhere', points: [d] }, route, d)).toEqual({ route, points: [d] });
    void store;
  });
});
