// CORE-06, chat F1 (brief 118, ruling S): what the pointer rests on over the preview, held for the page. `bindCanvas`
// (./dom.ts) sets it from an idle mouse or pen move (a hit test of the last frame drawn, as a press's) and clears it
// on a pointerleave, a press, a blur and the binding's removal; the drawer (../shell/previewLogic.ts) reads it and
// draws the hovered point's ring or the hovered stretch with its halo (D208). It is not the store: a hover is no
// step, never saved and never undone. Its subscribers are told only when the value changes, compared by value as the
// store's `sameValue` compares, so the same point or line under a moving pointer tells no one twice.
import { sameValue } from '../store/sameValue';
import type { Under } from './pointer';

/** A point or a line of a route, by id, under a resting pointer; null for nothing. */
export type Hover =
  | { readonly routeId: string; readonly pointId: string }
  | { readonly routeId: string; readonly lineId: string }
  | null;

export interface HoverHolder {
  /** The last value set. */
  held(): Hover;
  /** Holds `next`; tells the subscribers only when it differs by value from what is held. */
  set(next: Hover): void;
  /** Called after each change; gives back the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** A hit test's answer as a hover. */
export function hoverOf(under: Under): Hover {
  if (under === null) return null;
  return under.kind === 'point' ? { routeId: under.route, pointId: under.id } : { routeId: under.route, lineId: under.id };
}

/** A holder beginning at nothing hovered. */
export function createHover(): HoverHolder {
  let value: Hover = null;
  const listeners = new Set<() => void>();
  return Object.freeze({
    held: () => value,
    set: (next: Hover): void => {
      if (sameValue(next, value)) return;
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
