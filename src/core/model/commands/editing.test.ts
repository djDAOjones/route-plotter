// CORE-06: the route's editing half. Deleting a point is tested shape by shape (D229, the owner's "Depends on shape"):
// a point between one line in and one line out closes up, keeping the line that reached it; every other shape takes
// the point's lines with it. v3's `networkEdit.test.js` :600 (a deleted node cascades its edges) is ported; its pen
// and selection are the store's (commands.test.ts). Every result is checked inside a scene by `checkScene`.
import { describe, expect, it } from 'vitest';
import { checkScene, newRoute, newScene, type IdSource, type Route } from '../scene';
import { deleteLine, deletePoints } from './editing';
import { isRefusal, type EditRefusal } from './graph';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}${String((n += 1))}`;
}

function frozen<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const inner of Object.values(value)) frozen(inner);
    Object.freeze(value);
  }
  return value;
}

function done<T extends object>(result: T | EditRefusal): T {
  if (isRefusal(result)) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result;
}

const checked = (route: Route) => checkScene({ ...newScene(counter('s')), routes: [route] }).ok;

/**
 * A route of the named points (ids as given, x by place) and lines given as `'A>B'` (one way) or `'A=B'` (both ways),
 * ids `l1`, `l2`, … in the order given; the first point is the lead's start unless `leadStart` says otherwise.
 */
function drawn(points: string, lines: string[], leadStart?: string): Route {
  const ids = points.split(' ');
  const route = newRoute(counter('r'));
  return frozen({
    ...route,
    points: ids.map((id, i) => ({ id, x: i / 10, y: 0.5, kind: 'stop' as const, label: id, pauseMs: 0 })),
    lines: lines.map((line, i) => {
      const [from = '', to = ''] = line.split(/[>=]/);
      return { id: `l${String(i + 1)}`, from, to, direction: line.includes('=') ? 'both ways' : 'one way', speedFactor: 1 };
    }),
    leadStart: leadStart ?? ids[0] ?? null,
  });
}

/** The route's lines as `id:from>to`, `=` for both ways. */
const shape = (route: Route) =>
  route.lines.map((line) => `${line.id}:${line.from}${line.direction === 'both ways' ? '=' : '>'}${line.to}`);
const pointIds = (route: Route) => route.points.map((point) => point.id);

describe('deleting a point, shape by shape (D229: “Depends on shape”)', () => {
  it('A → P → B closes up to A → B: the line that reached P keeps its id, place, direction and speed', () => {
    const before = drawn('X A P B', ['X>A', 'A=P', 'P>B']);
    const slow = frozen({ ...before, lines: before.lines.map((l) => (l.id === 'l2' ? { ...l, speedFactor: 0.5 } : l)) });
    const after = done(deletePoints(slow, ['P']));
    expect(shape(after)).toEqual(['l1:X>A', 'l2:A=B']);
    expect(after.lines[1]).toEqual({ ...slow.lines[1], to: 'B' });
    expect(after.lines[0]).toBe(slow.lines[0]);
    expect(pointIds(after)).toEqual(['X', 'A', 'B']);
    for (const key of ['marks', 'leadStart', 'settings', 'id'] as const) expect(after[key]).toBe(slow[key]);
    expect(checked(after)).toBe(true);
  });

  const cascades: [string, string, string[], string[]][] = [
    ['a fork: P has one line in and two out', 'A P B C', ['A>P', 'P>B', 'P>C', 'B>C'], ['l4:B>C']],
    ['a join: two lines into P and one out', 'A C P B', ['A>P', 'C>P', 'P>B', 'A>C'], ['l4:A>C']],
    ['the last point: one line into P', 'A B P', ['A>B', 'B>P'], ['l1:A>B']],
    ['two lines both into P', 'A P B', ['A>P', 'B>P'], []],
    ['two lines both out of P', 'A P B', ['P>A', 'P>B'], []],
    ['neighbours already joined, A → B', 'A P B', ['A>P', 'P>B', 'A>B'], ['l3:A>B']],
    ['neighbours already joined the other way, B → A', 'A P B', ['A>P', 'P>B', 'B>A'], ['l3:B>A']],
    ['A → P → A: its far ends are one point', 'A P', ['A>P', 'P>A'], []],
    ['a point joined to nothing', 'A P B', ['A>B'], ['l1:A>B']],
  ];
  for (const [name, points, lines, left] of cascades) {
    it(`${name}: P’s lines go with it, the rest as they were`, () => {
      const after = done(deletePoints(drawn(points, lines), ['P']));
      expect(shape(after)).toEqual(left);
      expect(pointIds(after)).toEqual(points.split(' ').filter((id) => id !== 'P'));
      expect(checked(after)).toBe(true);
    });
  }

  it('the first point, the lead’s start, with one line out: the line goes, and the lead starts at its far end', () => {
    const after = done(deletePoints(drawn('P A B', ['P>A', 'A>B']), ['P']));
    expect(shape(after)).toEqual(['l2:A>B']);
    expect(after.leadStart).toBe('A');
    expect(checked(after)).toBe(true);
  });

  it('two consecutive points of a chain close up to one line, in either order', () => {
    const chain = drawn('A P Q B', ['A>P', 'P>Q', 'Q>B']);
    for (const order of [
      ['P', 'Q'],
      ['Q', 'P'],
    ]) {
      const after = done(deletePoints(chain, order));
      expect(shape(after)).toEqual(['l1:A>B']);
      expect(pointIds(after)).toEqual(['A', 'B']);
    }
  });

  it('a deleted node cascades its lines (v3 :600): of A → B, deleting B leaves A alone', () => {
    const after = done(deletePoints(drawn('A B', ['A>B']), ['B']));
    expect(pointIds(after)).toEqual(['A']);
    expect(after.lines).toEqual([]);
    expect(after.leadStart).toBe('A');
  });

  it('a deleted point’s marks go, and the other marks stay the same objects', () => {
    const route = frozen({
      ...drawn('A P B', ['A>P', 'P>B']),
      marks: [
        { point: 'P', end: 'start' as const },
        { point: 'B', end: 'end' as const },
        { point: 'P', end: 'end' as const },
      ],
    });
    const after = done(deletePoints(route, ['P']));
    expect(after.marks).toEqual([{ point: 'B', end: 'end' }]);
    expect(after.marks[0]).toBe(route.marks[1]);
    expect(checked(after)).toBe(true);
  });
});

describe('the lead’s start left on a deleted point moves on (the stage plan’s ruling 4)', () => {
  it('when P closed up, to the far end of the line that left it', () => {
    expect(done(deletePoints(drawn('A P B', ['A>P', 'P>B'], 'P'), ['P'])).leadStart).toBe('B');
  });

  it('else to the far end of the first line in `lines` leaving P', () => {
    expect(done(deletePoints(drawn('A B P C', ['A>B', 'P>C', 'P>A'], 'P'), ['P'])).leadStart).toBe('C');
  });

  it('else to the first point left, and with none left, to nothing', () => {
    expect(done(deletePoints(drawn('A B P', ['A>P', 'B>P'], 'P'), ['P'])).leadStart).toBe('A');
    const none = done(deletePoints(drawn('P', []), ['P']));
    expect(none.leadStart).toBeNull();
    expect(none.points).toEqual([]);
    expect(checked(none)).toBe(true);
  });

  it('a start elsewhere is kept', () => {
    expect(done(deletePoints(drawn('A P B', ['A>P', 'P>B'], 'B'), ['P', 'A'])).leadStart).toBe('B');
  });
});

describe('deleting refused or changing nothing', () => {
  it('an id the route does not hold refuses the whole delete, before anything changes', () => {
    const route = drawn('A P B', ['A>P', 'P>B']);
    expect(deletePoints(route, ['P', 'nope'])).toEqual({ refused: 'no-such-point', id: 'nope' });
    expect(deletePoints(route, ['l1'])).toEqual({ refused: 'no-such-point', id: 'l1' });
  });

  it('no ids gives back the same route; an id named twice is deleted once', () => {
    const route = drawn('A P B', ['A>P', 'P>B']);
    expect(deletePoints(route, [])).toBe(route);
    expect(done(deletePoints(route, ['P', 'P']))).toEqual(done(deletePoints(route, ['P'])));
  });
});

describe('deleting a line', () => {
  it('the line goes; its points, the marks, the lead’s start and the other lines stay as they were', () => {
    const route = frozen({ ...drawn('A B C', ['A>B', 'B>C']), marks: [{ point: 'B', end: 'end' as const }] });
    const after = done(deleteLine(route, 'l1'));
    expect(shape(after)).toEqual(['l2:B>C']);
    expect(after.lines[0]).toBe(route.lines[1]);
    for (const key of ['points', 'marks', 'leadStart', 'settings', 'id'] as const) expect(after[key]).toBe(route[key]);
    expect(checked(after)).toBe(true);
  });

  it('a line the route does not hold is refused', () => {
    const route = drawn('A B', ['A>B']);
    expect(deleteLine(route, 'nope')).toEqual({ refused: 'no-such-line', id: 'nope' });
    expect(deleteLine(route, 'A')).toEqual({ refused: 'no-such-line', id: 'A' });
  });
});
