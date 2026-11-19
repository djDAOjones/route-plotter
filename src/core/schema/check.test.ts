// CORE-01: the schema helper's check, from one declaration: each failure is a structured report naming the field.
import { describe, expect, it } from 'vitest';
import { check } from './check';
import {
  boolean,
  choice,
  colour,
  defaultsOf,
  group,
  id,
  isRecord,
  list,
  number,
  optional,
  reference,
  text,
  type Fields,
  type Rule,
} from './field';

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
  to: reference({ list: 'items', description: 'An item.' }),
};
const BOX_FIELDS = {
  items: list({ of: ITEM, max: 3, description: 'Items.' }),
  links: list({ of: LINK, max: 3, description: 'Links.' }),
  first: optional({ of: reference({ list: 'items', description: 'An item.' }), description: 'An item, or none.' }),
  style: group({ of: { shown: FIELDS.shown }, description: 'A group.' }),
};

/** A rule over the whole box: its items' sizes never go down. */
const ASCENDING: Rule<{ items: { size: number }[] }> = {
  breaches: ({ items }) =>
    items.flatMap((item, i) => {
      const before = items[i - 1];
      const expected = 'a size no smaller than the item before';
      return before && item.size < before.size
        ? [{ at: `items[${i}].size`, rule: 'total' as const, expected, received: `${item.size}` }]
        : [];
    }),
};

const BOX = group({ of: BOX_FIELDS, rules: [ASCENDING], description: 'A box.' });

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

const checked = (fields: Fields, value: unknown, path?: string) =>
  check(group({ of: fields, description: 'Checked.' }), value, path);

/** Each problem as `path rule`, or `opens` when there is none. */
function rulesBroken(value: unknown): string[] {
  const result = check(BOX, value);
  return result.ok ? ['opens'] : result.problems.map(({ path, rule }) => `${path} ${rule}`);
}

describe('check, field by field', () => {
  it('accepts the defaults, and returns exactly the declared fields', () => {
    expect(checked(FIELDS, defaultsOf(FIELDS), 'here')).toEqual({ ok: true, value: defaultsOf(FIELDS) });
  });

  it('refuses a value outside a field’s range with a structured report naming the field', () => {
    const result = checked(FIELDS, { ...defaultsOf(FIELDS), width: 41 }, 'routes[0].settings.line');
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
    for (const width of [1, 40]) expect(checked(FIELDS, { ...defaultsOf(FIELDS), width }).ok).toBe(true);
    for (const width of [0.999, 40.001]) {
      const refused = { ok: false, problems: [{ rule: 'range' }] };
      expect(checked(FIELDS, { ...defaultsOf(FIELDS), width })).toMatchObject(refused);
    }
  });
});

describe('check names each broken rule', () => {
  it('type, integer, choice, colour, missing and unknown', () => {
    const value = { width: Number.NaN, count: 2.5, shown: 'yes', mode: 'c', tint: '#abc', extra: 1 };
    const result = checked(FIELDS, value);
    expect(result.ok ? [] : result.problems.map(({ path, rule }) => `${path} ${rule}`)).toEqual([
      'width type',
      'count integer',
      'shown type',
      'mode choice',
      'tint colour',
      'note missing',
      'extra unknown',
    ]);
  });

  it('a text past its length, saying what it accepts', () => {
    expect(checked(FIELDS, { ...defaultsOf(FIELDS), note: 'too long' }, 'g')).toMatchObject({
      problems: [{ path: 'g.note', rule: 'length', expected: 'text of at most 5 characters' }],
    });
  });

  it('a key such as __proto__ from a file, which is never copied (INTAKE.13)', () => {
    const parsed: unknown = JSON.parse(`{"__proto__": {"polluted": true}, "width": 3}`);
    if (!isRecord(parsed)) throw new Error('an object');
    const result = checked(FIELDS, { ...defaultsOf(FIELDS), ...parsed }, 'g');
    expect(result).toMatchObject({ ok: false, problems: [{ path: 'g.__proto__', rule: 'unknown' }] });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('something that is not a plain object', () => {
    expect(checked(FIELDS, [1], 'g')).toEqual({
      ok: false,
      problems: [{ path: 'g', rule: 'type', expected: 'an object', received: 'a list of 1' }],
    });
  });
});

describe('check, the shape: ids, references, optional fields, lists, groups and rules', () => {
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
    const twice = { ...box(), links: [{ id: 'a', to: 'b' }], items };
    expect(rulesBroken(twice)).toEqual(['items[2].id id', 'links[0].id duplicate']);
    const long = { ...box(), items: [{ id: 'abcde', size: 1 }, { id: 'b', size: 2 }], first: 'b' };
    expect(rulesBroken(long)).toEqual(['items[0].id id']);
  });

  it('a reference names a checked item of its list on the nearest entity; an optional one may be null', () => {
    expect(rulesBroken({ ...box(), links: [{ id: 'l', to: 'gone' }] })).toEqual(['links[0].to reference']);
    expect(rulesBroken({ ...box(), links: [{ id: 'l', to: null }] })).toEqual(['links[0].to reference']);
    expect(rulesBroken({ ...box(), first: null })).toEqual(['opens']);
    expect(rulesBroken({ ...box(), items: [], links: [], first: 'a' })).toEqual(['first reference']);
  });

  it('a list longer than its declaration allows is refused whole, its items never read', () => {
    const unread = Object.defineProperty({}, 'id', { get: () => { throw new Error('read'); }, enumerable: true });
    const items = Array.from({ length: 4 }, () => unread);
    expect(check(BOX, { ...box(), items, first: null, links: [] })).toEqual({
      ok: false,
      problems: [{ path: 'items', rule: 'count', expected: 'a list of at most 3', received: 'a list of 4' }],
    });
  });

  it('a group is checked field by field, by its full path', () => {
    const style = { shown: 1, more: true };
    expect(rulesBroken({ ...box(), style })).toEqual(['style.shown type', 'style.more unknown']);
    expect(rulesBroken({ ...box(), style: 'plain' })).toEqual(['style type']);
  });

  it('a group’s rules are kept once its fields are sound, and named by path', () => {
    const items = [
      { id: 'a', size: 2 },
      { id: 'b', size: 1 },
    ];
    expect(rulesBroken({ ...box(), items })).toEqual(['items[1].size total']);
    expect(rulesBroken({ ...box(), items: [...items, { id: 'c', size: 'x' }] })).toEqual(['items[2].size type']);
  });
});

describe('check reads each own data property once, in plain objects and lists only', () => {
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

  it('a getter never runs: a declared field or an unknown key held by one is refused', () => {
    const ran = () => {
      throw new Error('ran');
    };
    const value = Object.defineProperty(box(), 'first', { get: ran, enumerable: true });
    Object.defineProperty(value, 'more', { get: ran });
    expect(rulesBroken(value)).toEqual(['first type', 'more unknown']);
  });

  it('hidden and symbol keys are reported, on objects and lists alike', () => {
    expect(rulesBroken(Object.defineProperty(box(), 'hidden', { value: 1 }))).toEqual(['hidden unknown']);
    const items = Object.assign([{ id: 'a', size: 1 }], { extra: 1, [Symbol('tag')]: 2 });
    expect(rulesBroken({ ...box(), items, links: [] })).toEqual(['items.extra unknown', 'items.Symbol(tag) unknown']);
  });

  it('a list’s own iterator cannot forge what a reference may name', () => {
    const items = [{ id: 'a', size: 1 }];
    Object.defineProperty(items, Symbol.iterator, { value: () => [{ id: 'ghost', size: 1 }][Symbol.iterator]() });
    const result = rulesBroken({ ...box(), items, links: [], first: 'ghost' });
    expect(result).toEqual(['items.Symbol(Symbol.iterator) unknown', 'first reference']);
  });

  it('an unknown field whose value cannot be read is still reported by its own path', () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(check(BOX, { ...box(), extra: revoked.proxy })).toEqual({
      ok: false,
      problems: [
        { path: 'extra', rule: 'unknown', expected: 'no such field', received: 'something that could not be read' },
      ],
    });
  });

  it('what cannot be read as plain data is refused with a report, never thrown', () => {
    const trap = new Proxy({}, { getPrototypeOf: () => { throw new Error('trap'); } });
    const unreadable = { ok: false, problems: [{ path: 'style', rule: 'type', expected: 'plain data' }] };
    expect(check(BOX, { ...box(), style: trap })).toMatchObject(unreadable);
  });
});

describe('defaultsOf', () => {
  it('gives each field its default, a list empty, a group its defaults and an optional field null', () => {
    expect(defaultsOf(BOX_FIELDS)).toEqual({ items: [], links: [], first: null, style: { shown: true } });
    expect(check(BOX, defaultsOf(BOX_FIELDS)).ok).toBe(true);
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
