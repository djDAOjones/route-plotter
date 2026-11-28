// CORE-01: the schema helper's declarations (the plan's §13, A12). Every saved field is declared once with these
// constructors: its kind, default, range or grammar, unit and a one-line description. From that one declaration come
// its TypeScript type (`Values`), its default (`defaultsOf`), its check at open (`check`, in check.ts) and the range a
// control offers, so a value that opens is one its control can show (DEF-20.2, INTAKE.29). A control reads `min`,
// `max` and `unit`, or `choices`, or `maxLength`, from the field itself. The project's shape is declared the same way:
// an entity's id, a reference to an item of a list, a field that may be empty, a list of entities, and a group of
// fields saved together; a list or group also carries the rules no single field states, so the check at open is the
// declaration's check and nothing else.

/** What a number measures: shown beside a control, and named in a check's report. */
type Unit =
  | 'count'
  | 'degrees'
  | 'frames per second'
  | 'image fraction'
  | 'image widths per second'
  | 'milliseconds'
  | 'percent'
  | 'pixels'
  | 'times';

interface Declared<K extends string> {
  readonly kind: K;
  /** One line, in the glossary's words: what the field holds. */
  readonly description: string;
}

interface Valued<K extends string, T> extends Declared<K> {
  readonly default: T;
}

/** A finite number from `min` to `max`, both included; whole numbers only where `integer` is true. */
export interface NumberField extends Valued<'number', number> {
  readonly min: number;
  readonly max: number;
  readonly unit: Unit;
  readonly integer: boolean;
}

type BooleanField = Valued<'boolean', boolean>;

/** One of a fixed list of words. */
interface ChoiceField<C extends string = string> extends Valued<'choice', C> {
  readonly choices: readonly C[];
}

/** A colour written `#rrggbb` (v3's safe colour grammar, opaque form). */
type ColourField = Valued<'colour', string>;

/** Text of at most `maxLength` characters. */
interface TextField extends Valued<'text', string> {
  readonly maxLength: number;
}

/** An entity's id: text of 1 to `maxLength` characters, from the caller's id source, used once in what is checked. */
interface IdField extends Declared<'id'> {
  readonly maxLength: number;
}

/** The id of an item of `list`, a list declared on the entity holding this field or on the nearest one around it. */
interface ReferenceField extends Declared<'reference'> {
  readonly list: string;
}

/** A field that may be empty: null, or a value `of` accepts; a new one is null. */
interface OptionalField<O extends Field = Field> extends Declared<'optional'> {
  readonly of: O;
}

/** Where a value breaks a rule: a path inside it (empty for the whole), what the rule expects and what it found. */
export interface Breach {
  readonly at: string;
  readonly rule: 'reference' | 'duplicate' | 'total' | 'count';
  readonly expected: string;
  readonly received: string;
}

/** A rule over an entity or group that no single field states, such as "a line joins two different points". */
export interface Rule<T> {
  /** Every place `value`, whose fields are all sound, breaks the rule; none when it keeps it. */
  breaches(value: T): readonly Breach[];
}

/** Entities of one declaration, at most `max` of them, each keeping `rules`; a new list is empty. */
interface ListField<E extends Fields = Fields> extends Declared<'list'> {
  readonly of: E;
  readonly max: number;
  readonly rules: readonly Rule<Values<E>>[];
}

/** Fields saved together as one object, keeping `rules`, such as a route's line settings; a new one holds defaults. */
export interface GroupField<E extends Fields = Fields> extends Declared<'group'> {
  readonly of: E;
  readonly rules: readonly Rule<Values<E>>[];
}

export type Field =
  | NumberField
  | BooleanField
  | ChoiceField
  | ColourField
  | TextField
  | IdField
  | ReferenceField
  | OptionalField
  | ListField
  | GroupField;

/** The fields of one entity or group, by the name each is saved under. */
export interface Fields {
  readonly [name: string]: Field;
}

type ValueOf<F extends Field> = F extends ChoiceField<infer C>
  ? C
  : F extends NumberField
    ? number
    : F extends BooleanField
      ? boolean
      : F extends OptionalField<infer O>
        ? Field extends O
          ? unknown
          : ValueOf<O> | null
        : F extends ListField<infer E>
          ? Fields extends E
            ? unknown[]
            : Values<E>[]
          : F extends GroupField<infer E>
            ? Fields extends E
              ? Readonly<Record<string, unknown>>
              : Values<E>
            : string;

/**
 * The saved shape of an entity or group: one property per declared field, nothing else. A list, group or optional
 * field declared only as `Fields` or `Field`, as the walker sees every one, stands for any value, so the type ends.
 */
export type Values<G extends Fields> = { -readonly [K in keyof G]: ValueOf<G[K]> };

/** The fields a new entity cannot take from its declaration: its id, and a reference that must name an item. */
type Given<G extends Fields> = {
  [K in keyof G]: G[K] extends IdField | ReferenceField ? K : never;
}[keyof G];

/** A new entity's values, but for its id and the references the caller gives (`Given`). */
type Defaults<G extends Fields> = Omit<Values<G>, Given<G>>;

type Spec<F extends Field> = Omit<F, 'kind'>;

/** Declares a number field: its range, unit and default; whole numbers only when `integer` is set. */
export function number(spec: Omit<Spec<NumberField>, 'integer'> & { readonly integer?: boolean }): NumberField {
  return { kind: 'number', ...spec, integer: spec.integer ?? false };
}

/** Declares an on-or-off field. */
export function boolean(spec: Spec<BooleanField>): BooleanField {
  return { kind: 'boolean', ...spec };
}

/** Declares a field that takes one of a fixed list of words; `const` keeps the words as their own literal types. */
export function choice<const C extends string>(spec: Spec<ChoiceField<C>>): ChoiceField<C> {
  return { kind: 'choice', ...spec };
}

/** Declares a colour field, saved as a six-digit hex colour. */
export function colour(spec: Spec<ColourField>): ColourField {
  return { kind: 'colour', ...spec };
}

/** Declares a text field, its length bounded. */
export function text(spec: Spec<TextField>): TextField {
  return { kind: 'text', ...spec };
}

/** Declares an entity's id: the caller gives it, never a default (`Given`). */
export function id(spec: Spec<IdField>): IdField {
  return { kind: 'id', ...spec };
}

/** Declares a reference to an item of a list, by its id: the caller gives it, and the check at open holds it to one. */
export function reference(spec: Spec<ReferenceField>): ReferenceField {
  return { kind: 'reference', ...spec };
}

/** Declares a field that may be empty, holding the field it wraps when it is not. */
export function optional<O extends Field>(spec: Spec<OptionalField<O>>): OptionalField<O> {
  return { kind: 'optional', ...spec };
}

type Ruled<F extends ListField | GroupField> = Omit<Spec<F>, 'rules'> & { readonly rules?: F['rules'] };

/** Declares a list of entities, with the rules across them that no single field states (none if left out). */
export function list<E extends Fields>(spec: Ruled<ListField<E>>): ListField<E> {
  return { kind: 'list', ...spec, rules: spec.rules ?? [] };
}

/** Declares fields saved together, with the rules across them that no single field states (none if left out). */
export function group<E extends Fields>(spec: Ruled<GroupField<E>>): GroupField<E> {
  return { kind: 'group', ...spec, rules: spec.rules ?? [] };
}

/**
 * A plain object, as JSON makes and the editor writes: its prototype is `Object.prototype` or null. Anything else,
 * an object inheriting a project's fields included, is refused, so only a value's own fields are ever read.
 */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** A plain list, as JSON makes and the editor writes. A hole in it is reported by the check, never skipped. */
export function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

const COLOUR = /^#[0-9a-f]{6}$/i;

/** The rule a value breaks for one field, or null when the field accepts it: the one test behind every check. */
type FieldRule = 'type' | 'range' | 'integer' | 'choice' | 'colour' | 'length' | 'id' | 'reference' | 'count';

/** The rule one value breaks for its field, or null when the field accepts it: every check at open asks this. */
export function ruleBrokenBy(field: Field, value: unknown): FieldRule | null {
  switch (field.kind) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'type';
      if (value < field.min || value > field.max) return 'range';
      return field.integer && !Number.isInteger(value) ? 'integer' : null;
    case 'boolean':
      return typeof value === 'boolean' ? null : 'type';
    case 'choice':
      return typeof value === 'string' && field.choices.includes(value) ? null : 'choice';
    case 'colour':
      return typeof value === 'string' && COLOUR.test(value) ? null : 'colour';
    case 'text':
      if (typeof value !== 'string') return 'type';
      return value.length <= field.maxLength ? null : 'length';
    case 'id':
      return typeof value === 'string' && value.length > 0 && value.length <= field.maxLength ? null : 'id';
    case 'reference':
      return typeof value === 'string' ? null : 'reference';
    case 'optional':
      return value === null ? null : ruleBrokenBy(field.of, value);
    case 'list':
      if (!isList(value)) return 'type';
      return value.length <= field.max ? null : 'count';
    case 'group':
      return isRecord(value) ? null : 'type';
  }
}

/** True when `value` holds, as its own property, a value its field accepts for each declared field, at every depth. */
export function holdsAll(fields: Fields, value: unknown): boolean {
  return isRecord(value) && Object.entries(fields).every(([name, field]) => holdsOwn(field, value, name));
}

/** `holdsAll`, as the proof that `value` is the declaration's Values: how a checked copy is typed without a cast. */
export function holdsValues<G extends Fields>(fields: G, value: unknown): value is Values<G> {
  return holdsAll(fields, value);
}

function holdsOwn(field: Field, value: Readonly<Record<string, unknown>>, name: string): boolean {
  return Object.hasOwn(value, name) && holds(field, value[name]);
}

function holds(field: Field, value: unknown): boolean {
  if (ruleBrokenBy(field, value) !== null) return false;
  if (field.kind === 'optional') return value === null || holds(field.of, value);
  if (field.kind === 'group') return holdsAll(field.of, value);
  if (field.kind !== 'list' || !isList(value)) return true;
  for (let i = 0; i < value.length; i += 1) {
    if (!Object.hasOwn(value, i) || !holdsAll(field.of, value[i])) return false;
  }
  return true;
}

function isGiven(field: Field): boolean {
  return field.kind === 'id' || field.kind === 'reference';
}

function defaultOf(field: Exclude<Field, IdField | ReferenceField>): unknown {
  switch (field.kind) {
    case 'optional':
      return null;
    case 'list':
      return [];
    case 'group':
      return defaultsOf(field.of);
    default:
      return field.default;
  }
}

function holdsDefaults<G extends Fields>(fields: G, value: Readonly<Record<string, unknown>>): value is Defaults<G> {
  return Object.entries(fields).every(([name, field]) => isGiven(field) || holdsOwn(field, value, name));
}

/**
 * A new entity's or group's values from its declaration: each field at its default, a list empty, a group at its
 * fields' defaults, a field that may be empty null. Ids and references are the caller's to give. A default its own
 * field refuses is a fault in the declaration, and throws.
 */
export function defaultsOf<G extends Fields>(fields: G): Defaults<G> {
  const values: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(fields)) {
    if (field.kind !== 'id' && field.kind !== 'reference') values[name] = defaultOf(field);
  }
  if (holdsDefaults(fields, values)) return values;
  const refused = Object.entries(fields).filter(([name, field]) => !isGiven(field) && !holdsOwn(field, values, name));
  throw new Error(`Declared defaults outside their own fields: ${refused.map(([name]) => name).join(', ')}`);
}
