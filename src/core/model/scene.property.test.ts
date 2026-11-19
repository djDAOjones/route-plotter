// CORE-01: the model's properties (the plan's §19 checks). Every value is drawn from the schema's own declarations, so
// a setting added to one is covered without a test changing; the shape (ids, the lines' and marks' points, leadStart)
// is drawn here, and a structural field added to a declaration fails the first property until it is drawn too. The
// draws reach v3's limits where a run can afford it: up to 32 routes, and a label at its full length at times. The
// totals' exact boundaries are in scene.test.ts.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../config/limits';
import { check } from '../schema/check';
import { defaultsOf, type Field, type Fields } from '../schema/field';
import { checkScene } from './checkScene';
import { LINE_FIELDS, MARK_FIELDS, POINT_FIELDS, ROUTE_FIELDS, SCENE_FIELDS, newScene } from './scene';

const RUNS = 100;

/** A text up to its full length, mostly short, now and then exactly at `maxLength`. */
function textOf(maxLength: number): fc.Arbitrary<string> {
  const full = fc.string({ minLength: 1, maxLength: 3 }).map((unit) => unit.repeat(maxLength).slice(0, maxLength));
  return fc.oneof({ arbitrary: fc.string({ maxLength: 40 }), weight: 30 }, { arbitrary: full, weight: 1 });
}

/** A colour in v3's grammar, `#rrggbb`, each digit in either case; drawn from numbers, a pattern is slow. */
const colourOf = fc.tuple(fc.integer({ min: 0, max: 0xffffff }), fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }))
  .map(([rgb, upper]) => [...rgb.toString(16).padStart(6, '0')].map((d, i) => (upper[i] ? d.toUpperCase() : d)))
  .map((digits) => `#${digits.join('')}`);

/** Any value the field accepts, for a field holding a value or a group of them; the shape is drawn by hand. */
function valueOf(field: Field): fc.Arbitrary<unknown> | null {
  switch (field.kind) {
    case 'number':
      return field.integer
        ? fc.integer({ min: Math.ceil(field.min), max: Math.floor(field.max) })
        : fc.double({ min: field.min, max: field.max, noNaN: true, noDefaultInfinity: true });
    case 'boolean':
      return fc.boolean();
    case 'choice':
      return fc.constantFrom(...field.choices);
    case 'colour':
      return colourOf;
    case 'text':
      return textOf(field.maxLength);
    case 'group':
      return valuesOf(field.of);
    default:
      return null;
  }
}

/** Every value field of `fields`, each drawn as `valueOf` draws it. */
function valuesOf(fields: Fields): fc.Arbitrary<Record<string, unknown>> {
  const drawn = Object.entries(fields).flatMap(([name, field]) => {
    const value = valueOf(field);
    return value === null ? [] : [[name, value] as const];
  });
  return fc.record(Object.fromEntries(drawn));
}

function linesOf(r: number, pair: fc.Arbitrary<[number, number]>) {
  return fc.array(fc.tuple(pair, valuesOf(LINE_FIELDS)), { maxLength: 12 }).map((lines) =>
    lines.map(([[a, b], values], l) => ({ id: `r${r}l${l}`, from: `r${r}p${a}`, to: `r${r}p${b}`, ...values })),
  );
}

/** A route of up to eight points joined by any lines between distinct points: forks, joins, loops, two ways. */
function routeOf(r: number) {
  return fc.integer({ min: 0, max: 8 }).chain((size) => {
    const ids = Array.from({ length: size }, (_, p) => `r${r}p${p}`);
    const index = fc.integer({ min: 0, max: Math.max(0, size - 1) });
    const pair = fc.tuple(index, index).filter(([a, b]) => a !== b);
    const kinds = MARK_FIELDS.end.choices;
    return fc.record({
      id: fc.constant(`r${r}`),
      points: fc.tuple(...ids.map((id) => valuesOf(POINT_FIELDS).map((values) => ({ id, ...values })))),
      lines: size < 2 ? fc.constant([]) : linesOf(r, pair),
      marks: fc.subarray(ids.flatMap((point) => kinds.map((end) => ({ point, end })))),
      leadStart: size === 0 ? fc.constant(null) : fc.constantFrom(...ids),
      settings: valuesOf(ROUTE_FIELDS.settings.of),
    });
  });
}

const sceneOf = fc.integer({ min: 0, max: LIMITS.routes }).chain((count) =>
  fc.record({
    routes: fc.tuple(...Array.from({ length: count }, (_, r) => routeOf(r))),
    settings: valuesOf(SCENE_FIELDS.settings.of),
  }),
);

describe('the model’s properties', () => {
  it('every scene the schema allows is valid, and opens unchanged', () => {
    fc.assert(
      fc.property(sceneOf, (scene) => {
        expect(checkScene(scene)).toEqual({ ok: true, value: scene });
      }),
      { numRuns: RUNS },
    );
  });

  it('the defaults are valid: every group’s, and a new scene’s with any ids', () => {
    for (const fields of [ROUTE_FIELDS.settings.of, SCENE_FIELDS.settings.of]) {
      expect(check(fields, defaultsOf(fields)).ok).toBe(true);
    }
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: LIMITS.idLength }), (id) => {
        expect(checkScene(newScene(() => id)).ok).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });
});
