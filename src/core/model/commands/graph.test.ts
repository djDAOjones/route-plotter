// CORE-06: the pen's edits on one route's graph. v3's assertions are ported by the plan's rules (A18), assertion by
// assertion: `v3/tests/networkEdit.test.js` :506 (successive clicks chain), :533 (an existing node closes loops but
// never duplicates a link) and :546 (with the pen up a click picks the pen up there); stage 2's :569 (T cycles a
// node's type: v4's start and end marks) and :580's direction (a direction set as it is changes nothing). The plan's three worked examples
// (§3) are drawn by pen steps alone and walked by the lead's walk; every result is checked inside a scene by
// `checkScene`, which alone holds the limits.
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../config/limits';
import { leadWalk } from '../../timing/walk';
import { checkScene, newPoint, newRoute, newScene, type IdSource, type Route } from '../scene';
import {
  addPoint,
  isRefusal,
  joinPoints,
  markPoint,
  penStep,
  setDirection,
  setKind,
  setLeadStart,
  unmarkPoint,
  type EditRefusal,
  type PenTarget,
  type Place,
} from './graph';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}${String((n += 1))}`;
}

/** `value` frozen all the way down, so an edit that changed what it was given would throw. */
function frozen<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const inner of Object.values(value)) frozen(inner);
    Object.freeze(value);
  }
  return value;
}

const stop = (x: number, y: number): Place => ({ x, y, kind: 'stop' });

/** The route inside a new scene, as the store would check it. */
function checked(route: Route) {
  return checkScene({ ...newScene(counter('s')), routes: [route] });
}

/** A pen that steps on a route, keeping the route and the point it stands on; every step's route is checked. */
function pen(nextId: IdSource = counter('id')) {
  let route = frozen(newRoute(nextId));
  let at: string | null = null;
  const step = (target: PenTarget): string => {
    const result = penStep(route, nextId, at, target);
    if (isRefusal(result)) throw new Error(`refused: ${JSON.stringify(result)}`);
    expect(checked(result.route).ok).toBe(true);
    route = frozen(result.route);
    at = result.pen;
    return result.pen;
  };
  return {
    place: (x: number, y: number) => step({ place: stop(x, y) }),
    to: (point: string) => step({ point }),
    lift: () => {
      at = null;
    },
    route: () => route,
    pen: () => at,
  };
}

/** What an edit gave, which the test knows it took. */
function done<T extends object>(result: T | EditRefusal): T {
  if (isRefusal(result)) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result;
}

/** The `i`th item, which the test knows is there. */
function nth<T>(items: readonly T[], i: number): T {
  const item = items[i];
  if (item === undefined) throw new Error(`no item ${String(i)}`);
  return item;
}

type Line = Route['lines'][number];
const lineId = (route: Route, i: number): string => nth(route.lines, i).id;

const pairs = (route: Route) => route.lines.map((line) => [line.from, line.to]);

describe('the pen chains, joins, forks and closes loops (v3 networkEdit :506, :533, :546)', () => {
  it('successive places chain points with lines, the pen moving along (v3 :506)', () => {
    const p = pen();
    const a = p.place(0.1, 0.1);
    const b = p.place(0.5, 0.1);
    const c = p.place(0.9, 0.1);
    expect(pairs(p.route())).toEqual([
      [a, b],
      [b, c],
    ]);
    expect(p.pen()).toBe(c);
    expect(p.route().leadStart).toBe(a);
    expect(p.route().lines.every((line) => line.direction === 'one way' && line.speedFactor === 1)).toBe(true);
  });

  it('an existing point closes a loop but is never joined twice; the pen still moves there (v3 :533)', () => {
    const p = pen();
    const a = p.place(0.1, 0.1);
    const b = p.place(0.5, 0.1);
    p.place(0.3, 0.4);
    p.to(a); // c → a closes the triangle
    expect(p.route().lines).toHaveLength(3);
    expect(p.pen()).toBe(a);
    const before = p.route();
    p.to(b); // a and b are joined already
    expect(p.route()).toBe(before);
    expect(p.pen()).toBe(b);
  });

  it('with no pen point, a point of the route is where the pen is put down, and nothing is added (v3 :546)', () => {
    const p = pen();
    const a = p.place(0.1, 0.1);
    p.lift();
    const before = p.route();
    p.to(a);
    expect(p.route()).toBe(before);
    expect(p.route().lines).toHaveLength(0);
    expect(p.pen()).toBe(a);
  });

  it('the point the pen stands on, as a target, changes nothing', () => {
    const p = pen();
    const a = p.place(0.1, 0.1);
    const before = p.route();
    p.to(a);
    expect(p.route()).toBe(before);
    expect(p.pen()).toBe(a);
  });

  it('a line to an existing point from a point a line already leaves is a fork', () => {
    const p = pen();
    const a = p.place(0.1, 0.1);
    const b = p.place(0.5, 0.1);
    const c = p.place(0.5, 0.5);
    p.to(a);
    p.to(c); // a and c are joined (c → a): nothing added
    p.lift();
    p.to(a);
    const d = p.place(0.9, 0.9); // a → b and a → d: a fork by a new point
    p.lift();
    const e = p.place(0.9, 0.1); // e alone, joined to nothing
    p.lift();
    p.to(a);
    p.to(e); // a → e: a fork by an existing, unconnected point
    expect(p.pen()).toBe(e);
    expect(pairs(p.route())).toEqual([
      [a, b],
      [b, c],
      [c, a],
      [a, d],
      [a, e],
    ]);
  });
});

describe('the plan’s worked examples, drawn by the pen and walked by the lead (§3)', () => {
  it('a fork that rejoins: the walk’s order, E its one join, and nothing left out', () => {
    const p = pen();
    const [A, B, C] = [p.place(0.1, 0.5), p.place(0.3, 0.5), p.place(0.5, 0.3)];
    p.lift();
    p.to(B);
    const D = p.place(0.5, 0.7);
    p.lift();
    p.to(C);
    const E = p.place(0.7, 0.5);
    p.lift();
    p.to(D);
    p.to(E);
    const F = p.place(0.9, 0.5);
    const route = p.route();
    const ids = route.lines.map((line) => line.id);
    expect(pairs(route)).toEqual([
      [A, B],
      [B, C],
      [B, D],
      [C, E],
      [D, E],
      [E, F],
    ]);
    const walk = leadWalk(route);
    expect(walk.leftOut).toEqual([]);
    expect([...walk.joins]).toEqual([E]);
    expect(walk.walked.map((line) => line.lineId)).toEqual([ids[0], ids[1], ids[3], ids[5], ids[2], ids[4]]);
  });

  it('a loop: the closing line D → B is left out, and the lead’s branch ends at D', () => {
    const p = pen();
    const [A, B, C, D] = [p.place(0.1, 0.5), p.place(0.3, 0.5), p.place(0.5, 0.3), p.place(0.5, 0.7)];
    p.to(B);
    const route = p.route();
    expect(pairs(route)).toEqual([
      [A, B],
      [B, C],
      [C, D],
      [D, B],
    ]);
    const walk = leadWalk(route);
    expect(walk.leftOut).toEqual([lineId(route, 3)]);
    expect(walk.walked.at(-1)).toEqual({ lineId: lineId(route, 2), from: C, to: D });
  });

  it('two starts: S2 → J is not walked from S1, and J is no join', () => {
    const p = pen();
    const S1 = p.place(0.1, 0.3);
    const J = p.place(0.5, 0.5);
    p.lift();
    const S2 = p.place(0.1, 0.7);
    p.to(J);
    const E = p.place(0.9, 0.5);
    const route = p.route();
    expect(route.leadStart).toBe(S1);
    expect(pairs(route)).toEqual([
      [S1, J],
      [S2, J],
      [J, E],
    ]);
    const walk = leadWalk(route);
    expect(walk.leftOut).toEqual([lineId(route, 1)]);
    expect(walk.joins.size).toBe(0);
  });

  it('a route with two-way lines and several starts: a two-way line is not joined again from its far end', () => {
    const p = pen();
    const a = p.place(0.1, 0.1);
    const b = p.place(0.5, 0.1);
    const twoWay: Line = { ...nth(p.route().lines, 0), direction: 'both ways' as const };
    const nextId = counter('two');
    const route = frozen({ ...p.route(), lines: [twoWay] });
    const back = done(penStep(route, nextId, b, { point: a }));
    expect(back).toEqual({ route, pen: a });
    expect(back.route).toBe(route);
    const s2 = done(penStep(route, nextId, null, { place: stop(0.9, 0.9) }));
    const joined = done(penStep(s2.route, nextId, s2.pen, { point: b }));
    expect(pairs(joined.route)).toEqual([
      [a, b],
      [s2.pen, b],
    ]);
    expect(joined.route.leadStart).toBe(a);
    expect(checked(joined.route).ok).toBe(true);
    expect(leadWalk(joined.route).leftOut).toEqual([lineId(joined.route, 1)]);
  });
});

describe('an edit changes only what it names, and a refusal changes nothing', () => {
  function threeInChain() {
    const p = pen();
    const ids = [p.place(0.1, 0.1), p.place(0.5, 0.1), p.place(0.9, 0.1)] as const;
    return { route: p.route(), ids };
  }

  it('a point is added at the end; everything else is the same object, in the same order', () => {
    const { route } = threeInChain();
    const { route: after, point } = addPoint(route, counter('n'), { x: -10, y: 11, kind: 'bend' });
    expect(Object.keys(after)).toEqual(Object.keys(route));
    expect(after.points.slice(0, 3).every((each, i) => each === route.points[i])).toBe(true);
    expect(after.points[3]).toEqual(newPoint(() => point, { x: -10, y: 11, kind: 'bend' }));
    for (const key of ['lines', 'marks', 'leadStart', 'settings', 'id'] as const) expect(after[key]).toBe(route[key]);
    expect(checked(after).ok).toBe(true);
  });

  it('a line is added at the end, one way at the default speed; everything else is the same object', () => {
    const { route, ids } = threeInChain();
    const after = done(joinPoints(route, counter('n'), ids[2], ids[0]));
    expect(Object.keys(after)).toEqual(Object.keys(route));
    expect(after.lines.slice(0, 2).every((each, i) => each === route.lines[i])).toBe(true);
    expect(after.lines[2]).toEqual({ id: 'n1', from: ids[2], to: ids[0], direction: 'one way', speedFactor: 1 });
    for (const key of ['points', 'marks', 'leadStart', 'settings', 'id'] as const) expect(after[key]).toBe(route[key]);
  });

  it('the lead’s start is the first point added, and no later point moves it', () => {
    const empty = frozen(newRoute(counter('r')));
    const first = addPoint(empty, counter('n'), stop(0.2, 0.2));
    expect(first.route.leadStart).toBe(first.point);
    const second = addPoint(frozen(first.route), counter('m'), stop(0.4, 0.4));
    expect(second.route.leadStart).toBe(first.point);
  });

  it('each refusal names what it refused, and leaves the route as it was', () => {
    const { route, ids } = threeInChain();
    const copy = structuredClone(route);
    const nextId = counter('n');
    expect(joinPoints(route, nextId, 'nope', ids[0])).toEqual({ refused: 'no-such-point', id: 'nope' });
    expect(joinPoints(route, nextId, ids[0], 'nope')).toEqual({ refused: 'no-such-point', id: 'nope' });
    expect(joinPoints(route, nextId, ids[1], ids[1])).toEqual({ refused: 'same-point', id: ids[1] });
    const ab = lineId(route, 0);
    expect(joinPoints(route, nextId, ids[0], ids[1])).toEqual({ refused: 'already-joined', id: ab });
    expect(joinPoints(route, nextId, ids[1], ids[0])).toEqual({ refused: 'already-joined', id: ab });
    expect(penStep(route, nextId, 'nope', { point: ids[0] })).toEqual({ refused: 'no-such-point', id: 'nope' });
    expect(penStep(route, nextId, 'nope', { place: stop(0, 0) })).toEqual({ refused: 'no-such-point', id: 'nope' });
    expect(penStep(route, nextId, ids[0], { point: 'nope' })).toEqual({ refused: 'no-such-point', id: 'nope' });
    expect(penStep(route, nextId, null, { point: 'nope' })).toEqual({ refused: 'no-such-point', id: 'nope' });
    expect(route).toEqual(copy);
  });
});

describe('the limits are checkScene’s, not the edits’', () => {
  it('a route at the most points takes one more by the pen, and checkScene refuses the scene', () => {
    const nextId = counter('big');
    const points = Array.from({ length: LIMITS.points }, (_, i) => newPoint(nextId, stop((i % 100) / 100, 0.5)));
    const full: Route = { ...newRoute(nextId), points, leadStart: nth(points, 0).id };
    expect(checked(full).ok).toBe(true);
    const step = done(penStep(full, nextId, null, { place: stop(0.5, 0.5) }));
    expect(step.route.points).toHaveLength(LIMITS.points + 1);
    const result = checked(step.route);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.some((problem) => problem.rule === 'count')).toBe(true);
  });

  it('a point at the coordinates’ edges is taken; one past them is refused by checkScene', () => {
    const empty = frozen(newRoute(counter('r')));
    const edge = penStep(empty, counter('n'), null, { place: stop(LIMITS.coordinateMin, LIMITS.coordinateMax) });
    expect(checked(done(edge).route).ok).toBe(true);
    const past = penStep(empty, counter('n'), null, { place: stop(LIMITS.coordinateMin - 0.001, 0.5) });
    expect(checked(done(past).route).ok).toBe(false);
  });
});

describe('stage 2: a line’s direction, the lead’s start, marks and a point’s kind', () => {
  function abc() {
    const p = pen();
    const ids = [p.place(0.1, 0.1), p.place(0.5, 0.1), p.place(0.9, 0.1)] as const;
    return { route: frozen(p.route()), ids };
  }

  it('a line set both ways keeps its ends and its place, and the lead may then walk it from its far end', () => {
    const { route, ids } = abc();
    const fromB = done(setLeadStart(route, ids[1]));
    expect(leadWalk(fromB).walked.map((line) => [line.from, line.to])).toEqual([[ids[1], ids[2]]]);
    const both = done(setDirection(fromB, lineId(route, 0), 'both ways'));
    expect(both.lines[0]).toEqual({ ...nth(route.lines, 0), direction: 'both ways' });
    expect(both.lines[1]).toBe(route.lines[1]);
    for (const key of ['points', 'marks', 'leadStart', 'settings', 'id'] as const) expect(both[key]).toBe(fromB[key]);
    expect(leadWalk(both).walked.map((line) => [line.from, line.to])).toEqual([
      [ids[1], ids[0]],
      [ids[1], ids[2]],
    ]);
    expect(checked(both).ok).toBe(true);
    const back = done(setDirection(frozen(both), lineId(route, 0), 'one way'));
    expect(back).toEqual(fromB);
  });

  it('a direction set as it is gives back the same route (v3 :584, the direction kept)', () => {
    const { route } = abc();
    expect(setDirection(route, lineId(route, 0), 'one way')).toBe(route);
  });

  it('the lead’s start set to another point of the route, and to the same one, which changes nothing', () => {
    const { route, ids } = abc();
    const moved = done(setLeadStart(route, ids[2]));
    expect(moved.leadStart).toBe(ids[2]);
    for (const key of ['points', 'lines', 'marks', 'settings', 'id'] as const) expect(moved[key]).toBe(route[key]);
    expect(setLeadStart(frozen(moved), ids[2])).toBe(moved);
  });

  it('a point marked as a start, then an end, then neither, as v3’s T cycles it (v3 :569)', () => {
    const { route, ids } = abc();
    const start = done(markPoint(route, ids[1], 'start'));
    expect(start.marks).toEqual([{ point: ids[1], end: 'start' }]);
    const end = done(markPoint(frozen(done(unmarkPoint(frozen(start), ids[1], 'start'))), ids[1], 'end'));
    expect(end.marks).toEqual([{ point: ids[1], end: 'end' }]);
    const none = done(unmarkPoint(frozen(end), ids[1], 'end'));
    expect(none.marks).toEqual([]);
    for (const each of [start, end, none]) expect(checked(each).ok).toBe(true);
  });

  it('a mark goes after the others, which stay the same objects; one point may carry both kinds', () => {
    const { route, ids } = abc();
    const one = done(markPoint(route, ids[0], 'end'));
    const two = done(markPoint(frozen(one), ids[0], 'start'));
    expect(two.marks).toEqual([
      { point: ids[0], end: 'end' },
      { point: ids[0], end: 'start' },
    ]);
    expect(two.marks[0]).toBe(one.marks[0]);
    for (const key of ['points', 'lines', 'leadStart', 'settings', 'id'] as const) expect(two[key]).toBe(route[key]);
    expect(checked(two).ok).toBe(true);
  });

  it('marking twice, or taking off a mark the point lacks, gives back the same route', () => {
    const { route, ids } = abc();
    const marked = frozen(done(markPoint(route, ids[2], 'end')));
    expect(markPoint(marked, ids[2], 'end')).toBe(marked);
    expect(unmarkPoint(marked, ids[2], 'start')).toBe(marked);
    expect(unmarkPoint(marked, ids[0], 'end')).toBe(marked);
  });

  it('a point made a bend keeps its label and pause, and a stop again is as it was', () => {
    const { route: base, ids } = abc();
    const labelled: Route = frozen({
      ...base,
      points: base.points.map((each) => (each.id === ids[1] ? { ...each, label: 'Bridge', pauseMs: 4_000 } : each)),
    });
    const bend = done(setKind(labelled, ids[1], 'bend'));
    expect(bend.points[1]).toEqual({ ...nth(labelled.points, 1), kind: 'bend' });
    expect(bend.points[0]).toBe(labelled.points[0]);
    for (const key of ['lines', 'marks', 'leadStart', 'settings', 'id'] as const) expect(bend[key]).toBe(labelled[key]);
    expect(checked(bend).ok).toBe(true);
    expect(setKind(frozen(bend), ids[1], 'bend')).toBe(bend);
    expect(done(setKind(frozen(bend), ids[1], 'stop'))).toEqual(labelled);
  });

  it('each stage 2 refusal names what it refused, and leaves the route as it was', () => {
    const { route, ids } = abc();
    const copy = structuredClone(route);
    expect(setDirection(route, 'nope', 'both ways')).toEqual({ refused: 'no-such-line', id: 'nope' });
    expect(setDirection(route, ids[0], 'both ways')).toEqual({ refused: 'no-such-line', id: ids[0] });
    expect(setLeadStart(route, 'nope')).toEqual({ refused: 'no-such-point', id: 'nope' });
    expect(setLeadStart(route, lineId(route, 0))).toEqual({ refused: 'no-such-point', id: lineId(route, 0) });
    expect(markPoint(route, 'nope', 'start')).toEqual({ refused: 'no-such-point', id: 'nope' });
    expect(unmarkPoint(route, 'nope', 'end')).toEqual({ refused: 'no-such-point', id: 'nope' });
    expect(setKind(route, 'nope', 'bend')).toEqual({ refused: 'no-such-point', id: 'nope' });
    expect(route).toEqual(copy);
  });
});
