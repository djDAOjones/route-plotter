// CORE-06: the graph's edits as a property (the pattern of scene.property.test.ts). Any sequence of stage 1's and
// stage 2's edits from a new scene's route, with targets drawn from what the route holds and now and then from what it
// does not, and places anywhere in the coordinate range, its edges included, gives after every step either a refusal
// that changed nothing (the route is frozen, so a change would throw) or a route that `checkScene` accepts. The draws
// are counted, and the test proves at its end they reached every refusal, both coordinate edges, every edit changing
// a route at least once, and edits that change nothing, so the property cannot pass by never refusing.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../config/limits';
import { checkScene, newRoute, newScene, type IdSource, type Route } from '../scene';
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
  type Place,
} from './graph';

const RUNS = 300;
const MISSING = 'missing';

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

/** Something the route holds, by its place in the list (wrapped), or an id it does not hold. */
type Target = { readonly at: number } | { readonly missing: true };
const targetOf: fc.Arbitrary<Target> = fc.oneof(
  { arbitrary: fc.nat(40).map((at) => ({ at })), weight: 8 },
  { arbitrary: fc.constant({ missing: true as const }), weight: 2 },
);

const coordinateOf = fc.oneof(
  { arbitrary: fc.constantFrom(LIMITS.coordinateMin, LIMITS.coordinateMax), weight: 2 },
  { arbitrary: fc.double({ min: LIMITS.coordinateMin, max: LIMITS.coordinateMax, noNaN: true }), weight: 4 },
);
const placeOf: fc.Arbitrary<Place> = fc.record({
  x: coordinateOf,
  y: coordinateOf,
  kind: fc.constantFrom('stop' as const, 'bend' as const),
});
const endOf = fc.constantFrom('start' as const, 'end' as const);

const editOf = fc.oneof(
  { arbitrary: fc.record({ edit: fc.constant('add' as const), place: placeOf }), weight: 3 },
  { arbitrary: fc.record({ edit: fc.constant('join' as const), from: targetOf, to: targetOf }), weight: 3 },
  {
    arbitrary: fc.record({
      edit: fc.constant('pen' as const),
      pen: fc.oneof(fc.constant('kept' as const), fc.constant('lifted' as const), targetOf),
      target: fc.oneof(fc.record({ place: placeOf }), fc.record({ point: targetOf })),
    }),
    weight: 4,
  },
  {
    arbitrary: fc.record({
      edit: fc.constant('direction' as const),
      line: targetOf,
      to: fc.constantFrom('one way' as const, 'both ways' as const),
    }),
    weight: 2,
  },
  { arbitrary: fc.record({ edit: fc.constant('leadStart' as const), point: targetOf }), weight: 2 },
  { arbitrary: fc.record({ edit: fc.constant('mark' as const), point: targetOf, end: endOf }), weight: 2 },
  { arbitrary: fc.record({ edit: fc.constant('unmark' as const), point: targetOf, end: endOf }), weight: 2 },
  {
    arbitrary: fc.record({
      edit: fc.constant('kind' as const),
      point: targetOf,
      kind: fc.constantFrom('stop' as const, 'bend' as const),
    }),
    weight: 2,
  },
);
type Edit = typeof editOf extends fc.Arbitrary<infer T> ? T : never;

function idOf(items: readonly { readonly id: string }[], target: Target): string {
  if ('missing' in target || items.length === 0) return MISSING;
  return items[target.at % items.length]?.id ?? MISSING;
}

/** One edit on `route`, with the pen standing on `pen`: the route and pen after it, or the refusal. */
function apply(route: Route, pen: string | null, edit: Edit, nextId: IdSource) {
  const point = (target: Target) => idOf(route.points, target);
  switch (edit.edit) {
    case 'add': {
      const added = addPoint(route, nextId, edit.place);
      return { route: added.route, pen };
    }
    case 'join':
      return wrap(joinPoints(route, nextId, point(edit.from), point(edit.to)), pen);
    case 'pen': {
      const from = edit.pen === 'kept' ? pen : edit.pen === 'lifted' ? null : point(edit.pen);
      const target = 'place' in edit.target ? { place: edit.target.place } : { point: point(edit.target.point) };
      return penStep(route, nextId, from, target);
    }
    case 'direction':
      return wrap(setDirection(route, idOf(route.lines, edit.line), edit.to), pen);
    case 'leadStart':
      return wrap(setLeadStart(route, point(edit.point)), pen);
    case 'mark':
      return wrap(markPoint(route, point(edit.point), edit.end), pen);
    case 'unmark':
      return wrap(unmarkPoint(route, point(edit.point), edit.end), pen);
    case 'kind':
      return wrap(setKind(route, point(edit.point), edit.kind), pen);
  }
}

function wrap(result: Route | EditRefusal, pen: string | null) {
  return isRefusal(result) ? result : { route: result, pen };
}

describe('the graph’s edits, as a property', () => {
  it('any sequence of edits gives, at every step, a refusal that changed nothing or a scene checkScene accepts', () => {
    // What the draws reached, over every run: proved at the end, so the property cannot pass by never refusing.
    const reached = { refusals: new Set<EditRefusal['refused']>(), edges: new Set<number>(), unchanged: 0, changed: 0 };
    const changedBy = new Set<Edit['edit']>();
    fc.assert(
      fc.property(fc.array(editOf, { minLength: 1, maxLength: 40 }), (edits) => {
        const nextId = counter('id');
        const scene = newScene(counter('s'));
        let route = frozen(newRoute(nextId));
        let pen: string | null = null;
        for (const edit of edits) {
          const result = apply(route, pen, edit, nextId);
          if (isRefusal(result)) {
            reached.refusals.add(result.refused);
            continue;
          }
          if (result.route === route) reached.unchanged += 1;
          else {
            reached.changed += 1;
            changedBy.add(edit.edit);
          }
          expect(checkScene({ ...scene, routes: [result.route] }).ok).toBe(true);
          for (const each of result.route.points)
            for (const value of [each.x, each.y])
              if (value === LIMITS.coordinateMin || value === LIMITS.coordinateMax) reached.edges.add(value);
          route = frozen(result.route);
          pen = result.pen;
        }
      }),
      { numRuns: RUNS },
    );
    expect([...reached.refusals].sort()).toEqual(['already-joined', 'no-such-line', 'no-such-point', 'same-point']);
    expect([...reached.edges].sort((a, b) => a - b)).toEqual([LIMITS.coordinateMin, LIMITS.coordinateMax]);
    expect(reached.unchanged).toBeGreaterThan(0);
    expect(reached.changed).toBeGreaterThan(0);
    expect([...changedBy].sort()).toEqual(['add', 'direction', 'join', 'kind', 'leadStart', 'mark', 'pen', 'unmark']);
  });
});
