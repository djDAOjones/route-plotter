// CORE-05: what the store takes is its own copy (Codex's findings on stage 1). The claim, no more and no less:
// 1. What the store keeps and hands out is its own frozen copy of plain data. Nothing a caller holds is ever the
//    store's, and the store never freezes or changes what a caller handed in.
// 2. What is taken is what a saved project can hold: records and arrays made of their own, enumerable, string-keyed data
//    properties, holding null, booleans, numbers, strings, records and arrays; and each image's bytes, copied. Anything
//    else is refused with a TypeError before the store changes, whatever else the project holds: an accessor, a symbol
//    key, a property that is not enumerable, a class instance or any other prototype, a function, an array with a hole
//    or an extra property, and `undefined` (the model's optional fields hold null, never undefined).
// 3. Image bytes are the one exception: a `Uint8Array` cannot be frozen. Each image no store has taken before is given
//    its own copy of its bytes as it comes in; an image a store has taken already (read from a store's state and handed
//    back, to Open or to another store) is kept as it is and shares its bytes. Those bytes can still be written through
//    `getState()`; no command reads or writes them; a holder that cannot be written is CORE-12's.
// 4. (store.ts) Commands, the id source, the reporter and subscribers are the editor's own code. A command and the id
//    source are called, and all the store reads from a command is read, before anything changes: one that throws leaves
//    the state and the history as they were before the call. Subscribers and the reporter are called after a change is
//    kept, to be told of it: one that throws never undoes the change, never stops the others being told, and is
//    reported. Either way, what `getState()` shows is always what the next command receives. The store does not claim
//    to withstand code written to break it.
//
// How: each object the store has not taken yet is read through its own property descriptors, so no getter runs and a
// proxy gives only what it says it owns; a fresh record or array is built from those values and frozen. Objects already
// taken are kept by reference, so a command pays only for the objects it made new. The copies are marked as taken only
// once the whole project has been copied. The project's `scene` and `images`, and each image's `bytes`, must be its own:
// they are what the store reads and copies, so none may be inherited.
import type { Project } from '../../adapters/io/format';

/** Every object the store has made and frozen: its own, kept by reference when it comes back. */
const owned = new WeakSet<object>();

/** Marks an object while its copy is being made, so a cycle is refused rather than walked for ever. */
const COPYING = Symbol('copying');

/** Each object met in one walk and its copy, so an object met twice is copied once. */
type Made = Map<object, object | typeof COPYING>;

/** How the value under each key of a record or array is taken. */
type Inner = (key: string, item: unknown) => unknown;

const NOT_PLAIN =
  'The editor’s store takes plain data only: arrays and records of their own values — null, booleans, numbers, strings, ' +
  'records and arrays — and image bytes; no getter, symbol, hidden property, class, function, hole or undefined.';

function refuse(): never {
  throw new TypeError(NOT_PLAIN);
}

/** The value of `value`'s own, enumerable data property `key`, read by its descriptor so that no getter runs. */
function dataOf(value: object, key: string): unknown {
  const property = Reflect.getOwnPropertyDescriptor(value, key);
  if (property === undefined || !('value' in property) || property.enumerable !== true) refuse();
  return property.value;
}

/** A fresh array of `value`'s items: every index its own, nothing else but `length`. */
function arrayFrom(value: object, inner: Inner): unknown[] {
  if (Object.getPrototypeOf(value) !== Array.prototype) refuse();
  const length: unknown = Reflect.getOwnPropertyDescriptor(value, 'length')?.value;
  if (typeof length !== 'number' || Reflect.ownKeys(value).length !== length + 1) refuse();
  return Array.from({ length }, (_, index) => inner(String(index), dataOf(value, String(index))));
}

/** A fresh record of `value`'s own, enumerable, string-keyed data properties, in their order. */
function recordFrom(value: object, inner: Inner): Record<string, unknown> {
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) refuse();
  return Object.fromEntries(
    Reflect.ownKeys(value).map((key) => {
      if (typeof key !== 'string') refuse();
      return [key, inner(key, dataOf(value, key))];
    }),
  );
}

/** `value` as the store keeps it: itself when a primitive the model holds or already taken, else a frozen copy. */
function take(value: unknown, made: Made, inner: Inner = (_, item) => take(item, made)): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value !== 'object' || ArrayBuffer.isView(value)) refuse();
  if (owned.has(value)) return value;
  const known = made.get(value);
  if (known === COPYING) refuse();
  if (known !== undefined) return known;
  made.set(value, COPYING);
  const copy = Object.freeze(Array.isArray(value) ? arrayFrom(value, inner) : recordFrom(value, inner));
  made.set(value, copy);
  return copy;
}

/** An image's bytes, copied: a `Uint8Array` and nothing else. */
function bytesOf(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array) || !ArrayBuffer.isView(value) || Object.getPrototypeOf(value) !== Uint8Array.prototype) {
    refuse();
  }
  return new Uint8Array(value);
}

/** Whether `value` is a record whose `keys` are all its own: the store reads them, so none may be inherited. */
function ownsAll(value: unknown, keys: readonly string[]): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && keys.every((key) => Object.hasOwn(value, key));
}

/** Whether `value` holds its own `scene` and `images`; the store checks the scene next, with `checkScene`. */
const isProject = (value: unknown): value is Project => ownsAll(value, ['scene', 'images']);

/**
 * `project` as the store keeps it: its own frozen copy, sharing every object the store has taken already, each image no
 * store has taken before with its own copy of its bytes. Throws a TypeError, marking nothing as taken and changing
 * nothing it was given, when any part of it is not plain data.
 */
export function own(project: Project): Project {
  const made: Made = new Map();
  const image: Inner = (key, item) => (key === 'bytes' ? bytesOf(item) : take(item, made));
  const images: Inner = (_, item) => {
    const taken = take(item, made, image);
    return ownsAll(taken, ['bytes']) ? taken : refuse();
  };
  const part: Inner = (key, item) =>
    key === 'images' ? take(Array.isArray(item) ? item : refuse(), made, images) : take(item, made);
  const kept = take(project, made, part);
  if (!isProject(kept)) refuse();
  for (const copy of made.values()) if (copy !== COPYING) owned.add(copy);
  return kept;
}
