// CORE-01: the model's properties (the plan's §19 checks), each drawn from the schema's own declarations, so a field
// added to a declaration is covered without a test changing: every scene the schema allows opens, unchanged; the
// defaults are valid; and any one number pushed past its range is refused, the report naming that field.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkFields } from '../schema/check';
import { defaultsOf, type Field, type Fields, type Groups } from '../schema/field';
import { checkScene } from './checkScene';
import { LINE_FIELDS, MARK_FIELDS, POINT_FIELDS, ROUTE_SETTINGS, SCENE_SETTINGS, newScene } from './scene';

const RUNS = 100;

function valueOf(field: Field): fc.Arbitrary<unknown> {
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
      return fc.stringMatching(/^#[0-9a-fA-F]{6}$/);
    case 'text':
      return fc.string({ maxLength: Math.min(field.maxLength, 40) });
  }
}

const fieldsOf = (fields: Fields) =>
  fc.record(Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, valueOf(field)])));
const groupsOf = (groups: Groups) =>
  fc.record(Object.fromEntries(Object.entries(groups).map(([name, fields]) => [name, fieldsOf(fields)])));

function linesOf(r: number, pair: fc.Arbitrary<[number, number]>) {
  return fc.array(fc.tuple(pair, fieldsOf(LINE_FIELDS)), { maxLength: 12 }).map((lines) =>
    lines.map(([[a, b], fields], l) => ({ id: `r${r}l${l}`, from: `r${r}p${a}`, to: `r${r}p${b}`, ...fields })),
  );
}

/** A route of up to eight points joined by any lines between distinct points: forks, joins, loops, two ways. */
function routeOf(r: number) {
  return fc.integer({ min: 0, max: 8 }).chain((size) => {
    const ids = Array.from({ length: size }, (_, p) => `r${r}p${p}`);
    const last = Math.max(0, size - 1);
    const index = fc.integer({ min: 0, max: last });
    const pair = fc.tuple(index, index).filter(([a, b]) => a !== b);
    const kinds = MARK_FIELDS.end.choices;
    return fc.record({
      id: fc.constant(`r${r}`),
      points: fc.tuple(...ids.map((id) => fieldsOf(POINT_FIELDS).map((fields) => ({ id, ...fields })))),
      lines: size < 2 ? fc.constant([]) : linesOf(r, pair),
      marks: fc.subarray(ids.flatMap((point) => kinds.map((end) => ({ point, end })))),
      leadStart: size === 0 ? fc.constant(null) : fc.constantFrom(...ids),
      settings: groupsOf(ROUTE_SETTINGS),
    });
  });
}

const sceneOf = fc
  .integer({ min: 0, max: 3 })
  .chain((count) =>
    fc.record({
      routes: fc.tuple(...Array.from({ length: count }, (_, r) => routeOf(r))),
      settings: groupsOf(SCENE_SETTINGS),
    }),
  );

const EVERY_GROUP: readonly Fields[] = [
  POINT_FIELDS,
  LINE_FIELDS,
  MARK_FIELDS,
  ...Object.values(ROUTE_SETTINGS),
  ...Object.values(SCENE_SETTINGS),
];

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
    for (const fields of EVERY_GROUP) expect(checkFields(fields, defaultsOf(fields), 'g').ok).toBe(true);
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 256 }), (id) => {
        expect(checkScene(newScene(() => id)).ok).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it('any number pushed past its range is refused, the report naming that field', () => {
    const distance = fc.double({ min: 1e-6, max: 1e9, noNaN: true });
    const numbers = EVERY_GROUP.flatMap((fields) =>
      Object.entries(fields).flatMap(([name, field]) => (field.kind === 'number' ? [{ fields, name, field }] : [])),
    );
    fc.assert(
      fc.property(fc.constantFrom(...numbers), fc.boolean(), distance, (one, up, by) => {
        const { fields, name, field } = one;
        const past = (end: number) => by * Math.max(1, Math.abs(end));
        const value = up ? field.max + past(field.max) : field.min - past(field.min);
        const result = checkFields(fields, { ...defaultsOf(fields), [name]: value }, 'g');
        expect(result).toMatchObject({ ok: false, problems: [{ path: `g.${name}`, rule: 'range' }] });
      }),
      { numRuns: RUNS },
    );
  });
});
