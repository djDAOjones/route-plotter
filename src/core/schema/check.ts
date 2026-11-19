// CORE-01: the check at open, from the declarations in field.ts, all the way down: fields, ids, references, lists and
// groups. A failure never throws: it is a list of problems, each naming the field's full path, the rule it broke, what
// the field accepts and what it was given. Only a value's own fields are read, only plain objects and lists are
// accepted, and only declared fields are copied into the checked value, so an inherited field or a forbidden key
// (`__proto__`) never reaches the project; an unknown key is reported, never silently kept or dropped (INTAKE.13).
import { holdsValues, isList, isRecord, ruleBrokenBy, type Field, type Fields, type Values } from './field';

type Rule =
  | 'missing'
  | 'unknown'
  | 'type'
  | 'range'
  | 'integer'
  | 'choice'
  | 'colour'
  | 'length'
  | 'id'
  | 'duplicate'
  | 'reference'
  | 'count'
  | 'total';

export interface Problem {
  /** Where the value sits in what was checked, such as `routes[0].settings.line.thickness`; empty for the whole. */
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
  if (Array.isArray(value)) return `a list of ${value.length}`;
  if (typeof value === 'object') return isRecord(value) ? 'an object' : 'an object of another kind';
  return `a ${typeof value}`;
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
    case 'id':
      return `text of 1 to ${field.maxLength} characters`;
    case 'reference':
      return `the id of an item in ${field.list}${field.nullWhenEmpty ? `, or null while ${field.list} is empty` : ''}`;
    case 'list':
      return `a list of at most ${field.max}`;
    case 'group':
      return 'an object';
  }
}

/** What one check has seen: its problems, every id so far, and the ids in each list around the value it is at. */
interface Walk {
  readonly problems: Problem[];
  readonly ids: Set<string>;
  readonly lists: ReadonlyMap<string, ReadonlySet<string>>[];
}

function report(walk: Walk, path: string, rule: Rule, expected: string, value: unknown): void {
  walk.problems.push({ path, rule, expected, received: describe(value) });
}

const join = (path: string, name: string) => (path === '' ? name : `${path}.${name}`);

/** The own ids of a list's items, read before the items are checked, so a reference may name a later item. */
function idsIn(fields: Fields, items: unknown): Set<string> {
  const ids = new Set<string>();
  const key = Object.keys(fields).find((name) => fields[name]?.kind === 'id');
  if (key === undefined || !isList(items)) return ids;
  for (const item of items) {
    const named = isRecord(item) && Object.hasOwn(item, key) ? item[key] : undefined;
    if (typeof named === 'string') ids.add(named);
  }
  return ids;
}

/** The ids in each list `fields` declares, by the list's name: what a reference on or inside `value` may name. */
function listsIn(fields: Fields, value: Readonly<Record<string, unknown>>): Map<string, Set<string>> {
  const lists = new Map<string, Set<string>>();
  for (const [name, field] of Object.entries(fields)) {
    if (field.kind === 'list') lists.set(name, idsIn(field.of, Object.hasOwn(value, name) ? value[name] : undefined));
  }
  return lists;
}

/** The ids of `list` on the nearest entity around the value being checked that declares a list of that name. */
function nearest(walk: Walk, list: string): ReadonlySet<string> | undefined {
  for (let i = walk.lists.length - 1; i >= 0; i -= 1) {
    const ids = walk.lists[i]?.get(list);
    if (ids !== undefined) return ids;
  }
  return undefined;
}

function checkRecord(fields: Fields, value: unknown, path: string, walk: Walk): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  if (!isRecord(value)) {
    report(walk, path, 'type', 'an object', value);
    return copy;
  }
  walk.lists.push(listsIn(fields, value));
  for (const [name, field] of Object.entries(fields)) {
    if (Object.hasOwn(value, name)) copy[name] = checkValue(field, value[name], join(path, name), walk);
    else walk.problems.push({ path: join(path, name), rule: 'missing', expected: accepts(field), received: 'nothing' });
  }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(fields, key)) report(walk, join(path, key), 'unknown', 'no such field', value[key]);
  }
  walk.lists.pop();
  return copy;
}

function checkList(fields: Fields, value: readonly unknown[], path: string, walk: Walk): unknown[] {
  const copy: unknown[] = [];
  for (let i = 0; i < value.length; i += 1) {
    if (Object.hasOwn(value, i)) copy.push(checkRecord(fields, value[i], `${path}[${i}]`, walk));
    else walk.problems.push({ path: `${path}[${i}]`, rule: 'missing', expected: 'an object', received: 'a hole' });
  }
  return copy;
}

function checkReference(list: string, value: unknown, path: string, walk: Walk, expected: string): void {
  const ids = nearest(walk, list);
  const empty = ids === undefined || ids.size === 0;
  if (value === null ? !empty : typeof value !== 'string' || ids?.has(value) !== true) {
    report(walk, path, 'reference', expected, value);
  }
}

function checkValue(field: Field, value: unknown, path: string, walk: Walk): unknown {
  const rule = ruleBrokenBy(field, value);
  if (rule !== null) {
    report(walk, path, rule, accepts(field), value);
    return value;
  }
  if (field.kind === 'group') return checkRecord(field.of, value, path, walk);
  if (field.kind === 'list') return isList(value) ? checkList(field.of, value, path, walk) : value;
  if (field.kind === 'reference') checkReference(field.list, value, path, walk, accepts(field));
  if (field.kind === 'id' && typeof value === 'string') {
    if (walk.ids.has(value)) report(walk, path, 'duplicate', 'an id used nowhere else', value);
    walk.ids.add(value);
  }
  return value;
}

/**
 * A value checked against its declarations: every problem is listed, not only the first. Ids are unique across
 * everything checked in one call, and a reference names an item of its list on the nearest entity declaring one.
 */
export function check<G extends Fields>(fields: G, value: unknown, path = ''): Checked<Values<G>> {
  const walk: Walk = { problems: [], ids: new Set(), lists: [] };
  const copy = checkRecord(fields, value, path, walk);
  if (walk.problems.length === 0 && holdsValues(fields, copy)) return { ok: true, value: copy };
  return { ok: false, problems: walk.problems };
}
