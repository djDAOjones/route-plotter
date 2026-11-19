// CORE-01: the schema helper's check, field by field: each failure is a structured report naming the field.
import { describe, expect, it } from 'vitest';
import { checkFields, checkGroups } from './check';
import { boolean, choice, colour, defaultsOf, defaultsOfGroups, isRecord, number, text } from './field';

const FIELDS = {
  width: number({ default: 3, min: 1, max: 40, unit: 'pixels', description: 'A width.' }),
  count: number({ default: 2, min: 0, max: 10, unit: 'count', integer: true, description: 'A count.' }),
  shown: boolean({ default: true, description: 'Whether it shows.' }),
  mode: choice({ choices: ['a', 'b'], default: 'a', description: 'A mode.' }),
  tint: colour({ default: '#d55e00', description: 'A colour.' }),
  note: text({ default: '', maxLength: 5, description: 'A note.' }),
};

describe('checkFields', () => {
  it('accepts the defaults, and returns exactly the declared fields', () => {
    expect(checkFields(FIELDS, defaultsOf(FIELDS), 'here')).toEqual({ ok: true, value: defaultsOf(FIELDS) });
  });

  it('refuses a value outside a field’s range with a structured report naming the field', () => {
    const result = checkFields(FIELDS, { ...defaultsOf(FIELDS), width: 41 }, 'routes[0].settings.line');
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
    for (const width of [1, 40]) expect(checkFields(FIELDS, { ...defaultsOf(FIELDS), width }, 'x').ok).toBe(true);
    for (const width of [0.999, 40.001]) {
      const result = checkFields(FIELDS, { ...defaultsOf(FIELDS), width }, 'x');
      expect(result).toMatchObject({ ok: false, problems: [{ rule: 'range' }] });
    }
  });

  it('names each broken rule: type, integer, choice, colour, length, missing and unknown', () => {
    const value = { width: Number.NaN, count: 2.5, shown: 'yes', mode: 'c', tint: '#abc', extra: 1 };
    const result = checkFields(FIELDS, value, 'g');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map(({ path, rule }) => `${path} ${rule}`)).toEqual([
      'g.width type',
      'g.count integer',
      'g.shown type',
      'g.mode choice',
      'g.tint colour',
      'g.note missing',
      'g.extra unknown',
    ]);
    expect(checkFields(FIELDS, { ...defaultsOf(FIELDS), note: 'too long' }, 'g')).toMatchObject({
      problems: [{ path: 'g.note', rule: 'length', expected: 'text of at most 5 characters' }],
    });
  });

  it('reports a key such as __proto__ from a file and never copies it (INTAKE.13)', () => {
    const parsed: unknown = JSON.parse(`{"__proto__": {"polluted": true}, "width": 3}`);
    if (!isRecord(parsed)) throw new Error('an object');
    const result = checkFields(FIELDS, { ...defaultsOf(FIELDS), ...parsed }, 'g');
    expect(result).toMatchObject({ ok: false, problems: [{ path: 'g.__proto__', rule: 'unknown' }] });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('refuses something that is not an object, saying so', () => {
    expect(checkFields(FIELDS, [1], 'g')).toEqual({
      ok: false,
      problems: [{ path: 'g', rule: 'type', expected: 'an object', received: 'a list of 1' }],
    });
  });
});

describe('checkGroups', () => {
  const GROUPS = { first: FIELDS, second: { on: boolean({ default: false, description: 'On.' }) } };

  it('accepts every group at its defaults, and reports a group it does not know', () => {
    expect(checkGroups(GROUPS, defaultsOfGroups(GROUPS), 's')).toEqual({ ok: true, value: defaultsOfGroups(GROUPS) });
    expect(checkGroups(GROUPS, { ...defaultsOfGroups(GROUPS), third: {} }, 's')).toMatchObject({
      ok: false,
      problems: [{ path: 's.third', rule: 'unknown' }],
    });
  });

  it('lists the problems of every group, each by its full path', () => {
    const value = { first: { ...defaultsOf(FIELDS), count: 11 }, second: { on: 1 } };
    expect(checkGroups(GROUPS, value, 's')).toMatchObject({
      ok: false,
      problems: [
        { path: 's.first.count', rule: 'range' },
        { path: 's.second.on', rule: 'type' },
      ],
    });
  });
});
