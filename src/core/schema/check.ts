// CORE-01: the check at open, from the declarations in field.ts. A failure never throws: it is a list of problems,
// each naming the field's full path, the rule it broke, what the field accepts and what it was given. Only declared
// fields are copied into the checked value, so an unknown or forbidden key (`__proto__`) never reaches the project;
// it is reported, never silently kept or dropped (INTAKE.13).
import {
  holdsGroupValues,
  holdsValues,
  isRecord,
  ruleBrokenBy,
  type Field,
  type Fields,
  type GroupValues,
  type Groups,
  type Values,
} from './field';

type Rule =
  | 'missing'
  | 'unknown'
  | 'type'
  | 'range'
  | 'integer'
  | 'choice'
  | 'colour'
  | 'length'
  | 'count'
  | 'total'
  | 'id'
  | 'duplicate'
  | 'reference';

export interface Problem {
  /** Where the value sits in the project, such as `routes[0].settings.line.thickness`. */
  readonly path: string;
  /** The rule it broke. */
  readonly rule: Rule;
  /** What the field accepts, in words, such as `a number from 1 to 40 pixels`. */
  readonly expected: string;
  /** What it was given, shortened. */
  readonly received: string;
}

export type Checked<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problems: readonly Problem[] };

/** A short, safe description of any value, for a report. */
export function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
    return String(value);
  }
  return Array.isArray(value) ? `a list of ${value.length}` : `a ${typeof value}`;
}

/** What one field accepts, in words: the range or grammar a control offers. */
function accepts(field: Field): string {
  switch (field.kind) {
    case 'number':
      return `${field.integer ? 'a whole number' : 'a number'} from ${field.min} to ${field.max} ${field.unit}`;
    case 'boolean':
      return 'true or false';
    case 'choice':
      return `one of ${field.choices.join(', ')}`;
    case 'colour':
      return 'a colour written #rrggbb';
    case 'text':
      return `text of at most ${field.maxLength} characters`;
  }
}

/** One field's problem, or none. */
function checkField(field: Field, value: unknown, path: string): Problem | null {
  const rule = ruleBrokenBy(field, value);
  return rule === null ? null : { path, rule, expected: accepts(field), received: describe(value) };
}

/**
 * A group of fields, checked against its declarations. Every problem is listed, not only the first. `extra` names
 * keys the caller checks itself (an entity's id, a route's lists), which are neither copied nor reported here.
 */
export function checkFields<G extends Fields>(
  fields: G,
  value: unknown,
  path: string,
  extra: readonly string[] = [],
): Checked<Values<G>> {
  if (!isRecord(value)) {
    return { ok: false, problems: [{ path, rule: 'type', expected: 'an object', received: describe(value) }] };
  }
  const problems: Problem[] = [];
  const checked: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(fields)) {
    const at = `${path}.${name}`;
    if (!Object.hasOwn(value, name)) {
      problems.push({ path: at, rule: 'missing', expected: accepts(field), received: 'nothing' });
      continue;
    }
    const problem = checkField(field, value[name], at);
    if (problem) problems.push(problem);
    else checked[name] = value[name];
  }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(fields, key) && !extra.includes(key)) {
      const received = describe(value[key]);
      problems.push({ path: `${path}.${key}`, rule: 'unknown', expected: 'no such field', received });
    }
  }
  return problems.length === 0 && holdsValues(fields, checked) ? { ok: true, value: checked } : { ok: false, problems };
}

/** Groups of fields, each checked as `checkFields` does; an unknown group is reported. */
export function checkGroups<S extends Groups>(groups: S, value: unknown, path: string): Checked<GroupValues<S>> {
  if (!isRecord(value)) {
    return { ok: false, problems: [{ path, rule: 'type', expected: 'an object', received: describe(value) }] };
  }
  const problems: Problem[] = [];
  const checked: Record<string, unknown> = {};
  for (const [name, fields] of Object.entries(groups)) {
    const result = checkFields(fields, value[name], `${path}.${name}`);
    if (result.ok) checked[name] = result.value;
    else problems.push(...result.problems);
  }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(groups, key)) {
      const received = describe(value[key]);
      problems.push({ path: `${path}.${key}`, rule: 'unknown', expected: 'no such group', received });
    }
  }
  if (problems.length === 0 && holdsGroupValues(groups, checked)) return { ok: true, value: checked };
  return { ok: false, problems };
}
