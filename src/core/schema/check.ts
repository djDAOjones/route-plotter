// CORE-01: the check at open, from one declaration all the way down: fields, ids, references, optional fields, lists,
// groups and the rules they carry. A failure never throws: it is a list of problems, each naming the field's full
// path, the rule it broke, what the field accepts and what it was given. Each own property is read once, by its
// descriptor, so no getter runs; only plain objects and lists are accepted; every own key that is not declared,
// hidden or symbol keys included, is reported, never silently kept or dropped (INTAKE.13); and only declared fields
// are copied into the checked value, so an inherited field or a forbidden key (`__proto__`) never reaches the
// project. References are resolved against the checked copy, never against a second read of the input.
import {
  holdsAll,
  holdsValues,
  isList,
  isRecord,
  ruleBrokenBy,
  type Field,
  type Fields,
  type GroupField,
  type Rule,
  type Values,
} from './field';

const UNREADABLE = 'something that could not be read';

type Broken =
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

interface Problem {
  /** Where the value sits in what was checked, such as `routes[0].settings.line.thickness`; empty for the whole. */
  readonly path: string;
  /** The rule it broke. */
  readonly rule: Broken;
  /** What the field accepts, in words, such as `a number from 1 to 40 pixels`. */
  readonly expected: string;
  /** What it was given, shortened. */
  readonly received: string;
}

export type Checked<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problems: readonly Problem[] };

/** A short, safe description of any value, for a report; never a throw, whatever the value. */
export function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
    return String(value);
  }
  try {
    if (Array.isArray(value)) return `a list of ${value.length}`;
    if (typeof value === 'object') return isRecord(value) ? 'an object' : 'an object of another kind';
  } catch {
    return UNREADABLE;
  }
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
      return `the id of an item in ${field.list}`;
    case 'optional':
      return `${accepts(field.of)}, or null`;
    case 'list':
      return `a list of at most ${field.max}`;
    case 'group':
      return 'an object';
  }
}

/**
 * An entity's or group's fields and the rules it keeps. A rule is declared for its entity's Values; the walker holds
 * it as a rule over any record (a method's parameter is bivariant) and calls it only once `holdsAll` has proved the
 * copy is that entity's Values.
 */
interface Declaration {
  readonly of: Fields;
  readonly rules: readonly Rule<Readonly<Record<string, unknown>>>[];
}

/** The ids of each list an entity declares, once checked, or null for a list refused whole. */
type Frame = Map<string, ReadonlySet<string> | null>;

interface Reference {
  readonly frames: readonly Frame[];
  readonly list: string;
  readonly id: string;
  readonly path: string;
  readonly expected: string;
}

/** What one check has seen: its problems, every id so far, the references to resolve, and where it is reading. */
interface Walk {
  readonly problems: Problem[];
  readonly ids: Set<string>;
  readonly references: Reference[];
  at: string;
}

/** Marks a value refused, so it is never copied. */
const REFUSED = Symbol('refused');

function report(walk: Walk, path: string, rule: Broken, expected: string, received: string): void {
  walk.problems.push({ path, rule, expected, received });
}

const join = (path: string, name: string) => (path === '' ? name : `${path}.${name}`);

type Own = { readonly found: 'value'; readonly value: unknown } | { readonly found: 'none' | 'accessor' };

/** An own data property, read by its descriptor so that no getter runs. */
function own(value: object, key: string | number | symbol): Own {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) return { found: 'none' };
  return 'value' in descriptor ? { found: 'value', value: descriptor.value } : { found: 'accessor' };
}

/** Reports each own key of `value`, hidden and symbol keys included, that `known` does not accept, by its own path. */
function reportUnknownKeys(walk: Walk, value: object, path: string, known: (key: string) => boolean): void {
  for (const key of [...Object.getOwnPropertyNames(value), ...Object.getOwnPropertySymbols(value)]) {
    const name = typeof key === 'string' ? key : String(key);
    if (typeof key === 'string' && known(key)) continue;
    walk.at = join(path, name);
    const read = own(value, key);
    report(walk, walk.at, 'unknown', 'no such field', read.found === 'value' ? describe(read.value) : 'a getter');
  }
}

function idsOf(fields: Fields, items: unknown): ReadonlySet<string> | null {
  if (!Array.isArray(items)) return null;
  const key = Object.keys(fields).find((name) => fields[name]?.kind === 'id');
  const ids = new Set<string>();
  for (const item of items) {
    const id = key !== undefined && isRecord(item) ? item[key] : undefined;
    if (typeof id === 'string') ids.add(id);
  }
  return ids;
}

function checkRecord(declared: Declaration, value: unknown, path: string, walk: Walk, frames: readonly Frame[]) {
  walk.at = path;
  const copy: Record<string, unknown> = {};
  if (!isRecord(value)) {
    report(walk, path, 'type', 'an object', describe(value));
    return copy;
  }
  const frame: Frame = new Map();
  for (const [name, field] of Object.entries(declared.of)) {
    const at = join(path, name);
    walk.at = at;
    const read = own(value, name);
    const checked = read.found === 'value' ? checkValue(field, read.value, at, walk, [...frames, frame]) : REFUSED;
    if (read.found === 'none') report(walk, at, 'missing', accepts(field), 'nothing');
    if (read.found === 'accessor') report(walk, at, 'type', accepts(field), 'a getter');
    if (checked !== REFUSED) copy[name] = checked;
    if (field.kind === 'list') frame.set(name, idsOf(field.of, copy[name]));
  }
  reportUnknownKeys(walk, value, path, (key) => Object.hasOwn(declared.of, key));
  if (!holdsAll(declared.of, copy)) return copy;
  for (const breach of declared.rules.flatMap((rule) => rule.breaches(copy))) {
    report(walk, join(path, breach.at), breach.rule, breach.expected, breach.received);
  }
  return copy;
}

function checkList(declared: Declaration & { readonly max: number }, value: readonly unknown[], path: string,
  walk: Walk, frames: readonly Frame[]): unknown[] | typeof REFUSED {
  walk.at = path;
  const { length } = value;
  if (length > declared.max) {
    report(walk, path, 'count', `a list of at most ${declared.max}`, `a list of ${length}`);
    return REFUSED;
  }
  const copy: unknown[] = [];
  for (let i = 0; i < length; i += 1) {
    walk.at = `${path}[${i}]`;
    const read = own(value, i);
    if (read.found === 'value') copy.push(checkRecord(declared, read.value, `${path}[${i}]`, walk, frames));
    else report(walk, `${path}[${i}]`, 'missing', 'an object', read.found === 'none' ? 'a hole' : 'a getter');
  }
  const item = (key: string) => /^(0|[1-9]\d*)$/.test(key) && Number(key) < length;
  reportUnknownKeys(walk, value, path, (key) => key === 'length' || item(key));
  return copy;
}

function checkValue(field: Field, value: unknown, path: string, walk: Walk, frames: readonly Frame[]): unknown {
  const rule = ruleBrokenBy(field, value);
  if (rule !== null) {
    report(walk, path, rule, accepts(field), describe(value));
    return REFUSED;
  }
  if (field.kind === 'optional') return value === null ? null : checkValue(field.of, value, path, walk, frames);
  if (field.kind === 'group') return checkRecord(field, value, path, walk, frames);
  if (field.kind === 'list') return isList(value) ? checkList(field, value, path, walk, frames) : REFUSED;
  if (field.kind === 'reference' && typeof value === 'string') {
    walk.references.push({ frames, list: field.list, id: value, path, expected: accepts(field) });
  }
  if (field.kind === 'id' && typeof value === 'string') {
    if (walk.ids.has(value)) report(walk, path, 'duplicate', 'an id used nowhere else', describe(value));
    walk.ids.add(value);
  }
  return value;
}

/** Each reference, against the checked ids of its list on the nearest entity declaring one. */
function resolve(walk: Walk): void {
  for (const { frames, list, id, path, expected } of walk.references) {
    let ids: ReadonlySet<string> | null | undefined;
    for (let i = frames.length - 1; ids === undefined && i >= 0; i -= 1) ids = frames[i]?.get(list);
    if (ids !== null && ids?.has(id) !== true) report(walk, path, 'reference', expected, describe(id));
  }
}

/**
 * A value checked against its declaration: every problem is listed, not only the first. Ids are unique across
 * everything checked in one call; a reference names a checked item of its list on the nearest entity declaring one;
 * each rule is kept once the fields it reads are sound. Anything that cannot be read as plain data is refused.
 */
export function check<E extends Fields>(declared: GroupField<E>, value: unknown, path = ''): Checked<Values<E>> {
  const walk: Walk = { problems: [], ids: new Set(), references: [], at: path };
  try {
    const copy = checkRecord(declared, value, path, walk, []);
    resolve(walk);
    if (walk.problems.length === 0 && holdsValues(declared.of, copy)) return { ok: true, value: copy };
  } catch {
    report(walk, walk.at, 'type', 'plain data', UNREADABLE);
  }
  return { ok: false, problems: walk.problems };
}
