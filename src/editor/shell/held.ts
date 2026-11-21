// CORE-05, stage 5: a value held for the visit only, read at any moment and watched by React. The switch for
// single-key shortcuts (D183) is one: the listener reads it at each key, Help shows and sets it. It is not a scene
// setting and makes no undo step; it is not stored, so a new visit begins from its first value (storing it is
// CORE-09's, a wish).

export interface Held<T> {
  readonly read: () => T;
  readonly set: (value: T) => void;
  /** Called after each change; gives back the call that stops it (React's `useSyncExternalStore`). */
  readonly subscribe: (listener: () => void) => () => void;
}

/** A value held for the visit, beginning at `first`; setting the value it already has tells no one. */
export function holdForVisit<T>(first: T): Held<T> {
  let value = first;
  const listeners = new Set<() => void>();
  return Object.freeze({
    read: () => value,
    set: (next: T): void => {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
}
