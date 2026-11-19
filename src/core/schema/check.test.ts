// CORE-01: the schema helper's check, from one declaration: each failure is a structured report naming the field.
import { describe, expect, it } from 'vitest';
import { check } from './check';
import { boolean, choice, colour, defaultsOf, group, id, isRecord, list, number, reference, text } from './field';

const FIELDS = {
  width: number({ default: 3, min: 1, max: 40, unit: 'pixels', description: 'A width.' }),
  count: number({ default: 2, min: 0, max: 10, unit: 'count', integer: true, description: 'A count.' }),
  shown: boolean({ default: true, description: 'Whether it shows.' }),
  mode: choice({ choices: ['a', 'b'], default: 'a', description: 'A mode.' }),
  tint: colour({ default: '#d55e00', description: 'A colour.' }),
  note: text({ default: '', maxLength: 5, description: 'A note.' }),
};

const ITEM = { id: id({ maxLength: 4, description: 'An id.' }), size: FIELDS.count };
const LINK = {
  id: id({ maxLength: 4, description: 'An id.' }),
  to: reference({ list: 'items', nullWhenEmpty: false, description: 'An item.' }),
};
const BOX = {
  items: list({ of: ITEM, max: 3, description: 'Items.' }),
  links: list({ of: LINK, max: 3, description: 'Links.' }),
  first: reference({ list: 'items', nullWhenEmpty: true, description: 'The first item, while there is one.' }),
  style: group({ of: { shown: FIELDS.shown }, description: 'A group.' }),
};

/** A sound box: two items, a link to the second, the first marked. */
function box(): Record<string, unknown> {
  return {
    items: [
      { id: 'a', size: 1 },
      { id: 'b', size: 2 },
    ],
    links: [{ id: 'l', to: 'b' }],
    first: 'a',
    style: { shown: false },
  };
}

/** Each problem as `path rule`, or `opens` when there is none. */
function rulesBroken(value: unknown, fields: Parameters<typeof check>[0] = BOX): string[] {
  const result = check(fields, value);
  return result.ok ? ['opens'] : result.problems.map(({ path, rule }) => `${path} ${rule}`);
}

describe('check, field by field', () => {
  it('accepts the defaults, and returns exactly the declared fields', () => {
    expect(check(FIELDS, defaultsOf(FIELDS), 'here')).toEqual({ ok: true, value: defaultsOf(FIELDS) });
  });

  it('refuses a value outside a field’s range with a structured report naming the field', () => {
    const result = check(FIELDS, { ...defaultsOf(FIELDS), width: 41 }, 'routes[0].settings.line');
    expect(result).toEqual({
      ok: false,
      problems: [
        {
          path: 'routes[0].settings.line.width',
          rule: 'range',
          expected: 'a number from 1 to 40 pixels',
          received: '41',
        },
      ],
    });
  });

  it('takes both ends of a range, and refuses what lies just past them', () => {
    for (const width of [1, 40]) expect(check(FIELDS, { ...defaultsOf(FIELDS), width }).ok).toBe(true);
    for (const width of [0.999, 40.001]) {
      const refused = { ok: false, problems: [{ rule: 'range' }] };
      expect(check(FIELDS, { ...defaultsOf(FIELDS), width })).toMatchObject(refused);
    }
  });

  it('names each broken rule: type, integer, choice, colour, missing and unknown', () => {
    const value = { width: Number.NaN, count: 2.5, shown: 'yes', mode: 'c', tint: '#abc', extra: 1 };
    expect(rulesBroken(value, FIELDS)).toEqual([
      'width type',
      'count integer',
      'shown type',
      'mode choice',
      'tint colour',
      'note missing',
      'extra unknown',
    ]);
  });

  it('names a text past its length, saying what it accepts', () => {
    expect(check(FIELDS, { ...defaultsOf(FIELDS), note: 'too long' }, 'g')).toMatchObject({
      problems: [{ path: 'g.note', rule: 'length', expected: 'text of at most 5 characters' }],
    });
  });

  it('reports a key such as __proto__ from a file and never copies it (INTAKE.13)', () => {
    const parsed: unknown = JSON.parse(`{"__proto__": {"polluted": true}, "width": 3}`);
    if (!isRecord(parsed)) throw new Error('an object');
    const result = check(FIELDS, { ...defaultsOf(FIELDS), ...parsed }, 'g');
    expect(result).toMatchObject({ ok: false, problems: [{ path: 'g.__proto__', rule: 'unknown' }] });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('refuses something that is not a plain object, saying so', () => {
    expect(check(FIELDS, [1], 'g')).toEqual({
      ok: false,
      problems: [{ path: 'g', rule: 'type', expected: 'an object', received: 'a list of 1' }],
    });
  });
});

describe('check, the shape: ids, references, lists and groups', () => {
  it('opens a sound value as a copy holding its declared fields', () => {
    const value = box();
    const result = check(BOX, value);
    expect(result).toEqual({ ok: true, value });
    expect(result.ok && result.value).not.toBe(value);
  });

  it('ids are unique across everything checked, and of 1 to maxLength characters', () => {
    const items = [
      { id: 'a', size: 1 },
      { id: 'b', size: 2 },
      { id: '', size: 3 },
    ];
    const value = { ...box(), links: [{ id: 'a', to: 'b' }], items };
    expect(rulesBroken(value)).toEqual(['items[2].id id', 'links[0].id duplicate']);
    const long = { ...box(), items: [{ id: 'abcde', size: 1 }, { id: 'b', size: 2 }], first: 'b' };
    expect(rulesBroken(long)).toEqual(['items[0].id id']);
  });

  it('a reference names an item of its list on the nearest entity, and is null only while that list is empty', () => {
    expect(rulesBroken({ ...box(), links: [{ id: 'l', to: 'gone' }] })).toEqual(['links[0].to reference']);
    expect(rulesBroken({ ...box(), links: [{ id: 'l', to: null }] })).toEqual(['links[0].to reference']);
    expect(rulesBroken({ ...box(), first: null })).toEqual(['first reference']);
    expect(rulesBroken({ ...box(), items: [], links: [], first: null })).toEqual(['opens']);
    expect(rulesBroken({ ...box(), items: [], links: [], first: 'a' })).toEqual(['first reference']);
  });

  it('a list longer than its declaration allows is refused whole, its items unread', () => {
    const items = Array.from({ length: 4 }, (_, i) => ({ id: `i${i}`, size: 99 }));
    expect(check(BOX, { ...box(), items, first: 'i0', links: [] })).toMatchObject({
      ok: false,
      problems: [{ path: 'items', rule: 'count', expected: 'a list of at most 3', received: 'a list of 4' }],
    });
  });

  it('a group is checked field by field, by its full path', () => {
    const style = { shown: 1, more: true };
    expect(rulesBroken({ ...box(), style })).toEqual(['style.shown type', 'style.more unknown']);
    expect(rulesBroken({ ...box(), style: 'plain' })).toEqual(['style type']);
  });
});

describe('check reads only a value’s own fields, in plain objects and lists', () => {
  it('an object inheriting a sound value is refused, not read through', () => {
    expect(check(BOX, Object.create(box()))).toEqual({
      ok: false,
      problems: [{ path: '', rule: 'type', expected: 'an object', received: 'an object of another kind' }],
    });
  });

  it('an item inheriting its id is refused, and an own field missing is reported missing', () => {
    const inherits: unknown = Object.create({ id: 'a' }, { size: { value: 1, enumerable: true } });
    expect(rulesBroken({ ...box(), items: [inherits, { id: 'b', size: 2 }], first: 'b' })).toEqual(['items[0] type']);
    const bare: unknown = Object.create(null, { size: { value: 1, enumerable: true } });
    expect(rulesBroken({ ...box(), items: [bare, { id: 'b', size: 2 }], first: 'b' })).toEqual(['items[0].id missing']);
  });

  it('a hole in a list is reported, never skipped', () => {
    const items: unknown[] = [];
    items[1] = { id: 'b', size: 2 };
    expect(check(BOX, { ...box(), items, first: 'b' })).toEqual({
      ok: false,
      problems: [{ path: 'items[0]', rule: 'missing', expected: 'an object', received: 'a hole' }],
    });
  });
});

describe('defaultsOf', () => {
  it('gives each field its default, a list empty, a group its defaults and a reference that may be null null', () => {
    expect(defaultsOf(BOX)).toEqual({ items: [], links: [], first: null, style: { shown: true } });
    expect(check(BOX, defaultsOf(BOX)).ok).toBe(true);
  });

  it('leaves out the ids and references the caller must give', () => {
    expect(defaultsOf(ITEM)).toEqual({ size: 2 });
    expect(defaultsOf(LINK)).toEqual({});
  });

  it('throws on a default its own field refuses: a fault in the declaration', () => {
    const wrong = { width: number({ default: 50, min: 1, max: 40, unit: 'pixels', description: 'Too wide.' }) };
    expect(() => defaultsOf(wrong)).toThrow('Declared defaults outside their own fields: width');
  });
});
