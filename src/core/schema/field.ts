// CORE-01: the schema helper's declarations (the plan's §13, A12). Each saved field is declared once, here or in a
// file that uses these constructors, with its kind, default, range or grammar, unit and a one-line description. Its
// TypeScript type (`ValueOf`, `Values`), its default (`defaultsOf`), its check at open (`checkFields`) and the range a
// control offers all come from that one declaration, so a value that opens is one its control can show (DEF-20.2,
// INTAKE.29). A control reads `min`, `max` and `unit`, or `choices`, or `maxLength`, from the field itself.

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

interface Declared<K extends string, T> {
  readonly kind: K;
  readonly default: T;
  /** One line, in the glossary's words: what the field sets. */
  readonly description: string;
}

/** A finite number from `min` to `max`, both included; whole numbers only where `integer` is true. */
export interface NumberField extends Declared<'number', number> {
  readonly min: number;
  readonly max: number;
  readonly unit: Unit;
  readonly integer: boolean;
}

export type BooleanField = Declared<'boolean', boolean>;

/** One of a fixed list of words. */
export interface ChoiceField<C extends string = string> extends Declared<'choice', C> {
  readonly choices: readonly C[];
}

/** A colour written `#rrggbb` (v3's safe colour grammar, opaque form). */
export type ColourField = Declared<'colour', string>;

/** Text of at most `maxLength` characters. */
export interface TextField extends Declared<'text', string> {
  readonly maxLength: number;
}

export type Field = NumberField | BooleanField | ChoiceField | ColourField | TextField;

/** A group of fields saved together as one object, such as a route's line settings. */
export type Fields = Readonly<Record<string, Field>>;

type ValueOf<F extends Field> = F extends ChoiceField<infer C>
  ? C
  : F extends NumberField
    ? number
    : F extends BooleanField
      ? boolean
      : string;

/** The saved shape of a group of fields: one property per declared field, nothing else. */
export type Values<G extends Fields> = { -readonly [K in keyof G]: ValueOf<G[K]> };

type Spec<F extends Field> = Omit<F, 'kind'>;

export function number(spec: Omit<Spec<NumberField>, 'integer'> & { readonly integer?: boolean }): NumberField {
  return { kind: 'number', ...spec, integer: spec.integer ?? false };
}

export function boolean(spec: Spec<BooleanField>): BooleanField {
  return { kind: 'boolean', ...spec };
}

export function choice<const C extends string>(spec: Spec<ChoiceField<C>>): ChoiceField<C> {
  return { kind: 'choice', ...spec };
}

export function colour(spec: Spec<ColourField>): ColourField {
  return { kind: 'colour', ...spec };
}

export function text(spec: Spec<TextField>): TextField {
  return { kind: 'text', ...spec };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const COLOUR = /^#[0-9a-f]{6}$/i;

/** The rule a value breaks for one field, or null when the field accepts it: the one test behind every check. */
type FieldRule = 'type' | 'range' | 'integer' | 'choice' | 'colour' | 'length';

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
  }
}

/** True when `value` holds an accepted value for every field of the group. */
export function holdsValues<G extends Fields>(fields: G, value: Readonly<Record<string, unknown>>): value is Values<G> {
  return Object.entries(fields).every(
    ([name, field]) => Object.hasOwn(value, name) && ruleBrokenBy(field, value[name]) === null,
  );
}

/** True when `value` holds every group, each as `holdsValues` requires. */
export function holdsGroupValues<S extends Groups>(
  groups: S,
  value: Readonly<Record<string, unknown>>,
): value is GroupValues<S> {
  return Object.entries(groups).every(([name, fields]) => {
    const group = value[name];
    return isRecord(group) && holdsValues(fields, group);
  });
}

/** Every field of a group at its declared default. A default its own field refuses is a fault in the declaration. */
export function defaultsOf<G extends Fields>(fields: G): Values<G> {
  const values: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(fields)) values[name] = field.default;
  if (holdsValues(fields, values)) return values;
  const broken = Object.entries(fields).filter(([name, field]) => ruleBrokenBy(field, values[name]) !== null);
  throw new Error(`Declared defaults outside their own fields: ${broken.map(([name]) => name).join(', ')}`);
}

/** Groups of fields saved together, such as a route's settings: its line, lead, markers and labels. */
export type Groups = Readonly<Record<string, Fields>>;

export type GroupValues<S extends Groups> = { -readonly [K in keyof S]: Values<S[K]> };

/** Every group at its declared defaults. */
export function defaultsOfGroups<S extends Groups>(groups: S): GroupValues<S> {
  const values: Record<string, unknown> = {};
  for (const [name, fields] of Object.entries(groups)) values[name] = defaultsOf(fields);
  if (holdsGroupValues(groups, values)) return values;
  throw new Error('Declared defaults outside their own fields');
}
