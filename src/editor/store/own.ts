// CORE-05: what the store holds cannot be written to, so nothing changes the state or the history but a command
// (Codex's first finding on stage 1). Every project is frozen deeply as it comes in (`createStore`, `open`) and as a
// command gives it; ES modules are strict, so a write to a frozen object throws. The walk stops at any object the store
// froze already, never at one merely frozen by someone else, so a command pays only for the objects it made new.
//
// Image bytes: a `Uint8Array` cannot be frozen. Each image the store has not held before is given its own copy of its
// bytes as it comes in, so bytes the caller still holds are never the store's; an image already held is not copied
// again. What is left: the store's own copy can still be reached, and written, through `getState()`; no command reads
// or writes image bytes; a holder that cannot be written is for the item that sets images (CORE-12).
import type { Project } from '../../adapters/io/format';

/** Every object the store has frozen deeply. */
const owned = new WeakSet<object>();

/** `value` frozen deeply, in place: every object under it but a typed array, whose contents cannot be frozen. */
function freezeDeep<T>(value: T): T {
  if (typeof value !== 'object' || value === null || ArrayBuffer.isView(value) || owned.has(value)) return value;
  Object.freeze(value);
  owned.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const child: unknown = Reflect.get(value, key);
    freezeDeep(child);
  }
  return value;
}

/** `project` as the store keeps it: frozen deeply, each image it did not hold already with its own copy of its bytes. */
export function own(project: Project): Project {
  if (owned.has(project.images)) return freezeDeep(project);
  const images = project.images.map((image) => (owned.has(image) ? image : { ...image, bytes: new Uint8Array(image.bytes) }));
  const copied = images.some((image, index) => image !== project.images[index]);
  return freezeDeep(copied ? { ...project, images } : project);
}
