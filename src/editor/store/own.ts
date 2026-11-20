// CORE-05: what the store holds cannot be written to, so nothing changes the state or the history but a command
// (Codex's first finding on stage 1). Every project is frozen deeply as it comes in (`createStore`, `open`) and as a
// command gives it, before it is checked; ES modules are strict, so a write to a frozen object throws. Only plain data
// is taken: arrays and records whose prototype is Array's, Object's or none, every property a value, never a getter.
// Anything else is refused with a TypeError before the store changes, so no getter, class or wrapper can change what
// the store holds later. Each object is read after it is frozen, so what is checked is what is kept. The walk stops at
// any object the store has taken already, never at one merely frozen by someone else, so a command pays only for the
// objects it made new; and an object is marked as taken only once the whole project it came in has passed.
//
// Image bytes: a `Uint8Array` cannot be frozen. Each image no store has taken before is given its own copy of its bytes
// as it comes in, so bytes a caller made are never the store's. An image a store has taken already (one read from a
// store's state and handed back, to Open or to another store) is not copied again: it shares the bytes it had. What is
// left: those bytes can still be reached, and written, through `getState()`; no command reads or writes image bytes; a
// holder that cannot be written is for the item that sets images (CORE-12).
import type { Project } from '../../adapters/io/format';

/** Every object the store has frozen deeply and taken. */
const owned = new WeakSet<object>();

const NOT_PLAIN = 'The editor’s store takes plain data only: arrays and records of values, no getter and no class.';

/** Freezes every object under `value` that the store has not taken yet, adding each to `found`; refuses all but plain data. */
function freezeNew(value: unknown, found: Set<object>): void {
  if (typeof value !== 'object' || value === null || ArrayBuffer.isView(value) || owned.has(value) || found.has(value)) return;
  Object.freeze(value);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) throw new TypeError(NOT_PLAIN);
  found.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (property === undefined || !('value' in property)) throw new TypeError(NOT_PLAIN);
    freezeNew(property.value, found);
  }
}

/**
 * `project` as the store keeps it: frozen deeply, each image no store has taken before with its own copy of its bytes.
 * Throws a TypeError, marking nothing as taken, when any part of it is not plain data.
 */
export function own(project: Project): Project {
  const images = owned.has(project.images)
    ? project.images
    : project.images.map((image) => (owned.has(image) ? image : { ...image, bytes: new Uint8Array(image.bytes) }));
  const copied = images.some((image, index) => image !== project.images[index]);
  const kept = copied ? { ...project, images } : project;
  const found = new Set<object>();
  freezeNew(kept, found);
  for (const each of found) owned.add(each);
  return kept;
}
