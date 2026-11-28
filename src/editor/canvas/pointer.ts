// CORE-06: the pointer transaction (the plan's §15, line 1058: v3's InteractionHandler.js split), as a pure state
// machine. One pointer owns a gesture from its down to its up; it is a tap until it has gone strictly beyond
// DRAG_THRESHOLD CSS pixels from where it went down, and then a drag (a press on a point with no modifier held) or a
// "moved" press that does nothing (v3: no tap, no drag). It ends in exactly one `finish` (by its up) or one `cancel`
// (a pointer cancel, a lost capture or a blur). `step` is a function of a state and an event giving the next state and
// the effects as plain values: no DOM, no store, no clock and no hit testing. The caller reduces each DOM event to a
// `PointerInput` (the platform's "meta" already resolved: Cmd on a Mac, Ctrl elsewhere) and gives, on a down, what lies
// under the pointer and the selection; it then performs the effects (gesture.ts for the store, the page for capture).
// v3's behaviour, not its code: InteractionHandler.js :210–300 (down), :335–380 (the threshold), :440–545 (up, cancel,
// lost capture), and interactionPointer.test.js, ported in pointer.test.ts.
import type { ImagePoint } from '../../core/geometry/units';

/** v3's INTERACTION.DRAG_THRESHOLD (constants.js:115): a press is a drag only beyond this many CSS pixels. */
export const DRAG_THRESHOLD = 3;

/** A place on the canvas, in CSS pixels. */
export interface Pixel {
  readonly x: number;
  readonly y: number;
}

/** The modifiers held, `meta` already the platform's (Cmd on a Mac, Ctrl elsewhere). */
export interface Modifiers {
  readonly alt: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
}

/** What lay under the pointer when it went down, as the caller's hit test found it. */
export type Under =
  | { readonly kind: 'point'; readonly route: string; readonly id: string }
  | {
      readonly kind: 'line';
      readonly route: string;
      readonly id: string;
      /** The line's "+" place in image fractions, when the pointer was on it (./hit.ts); absent off the "+". */
      readonly plus?: ImagePoint;
    }
  | null;

/** The selection when the pointer went down: a route and some of its points, the last picked last. */
export interface Picked {
  readonly route: string | null;
  readonly points: readonly string[];
}

interface Contact {
  readonly pointerId: number;
  /** The Pointer Events `isPrimary`: a second finger is not primary. */
  readonly primary: boolean;
  /** The Pointer Events `button`: 0 is the main button. */
  readonly button: number;
  readonly at: Pixel;
  readonly modifiers: Modifiers;
}

/** A DOM pointer event reduced to plain values. A blur (the window losing focus) names no pointer. */
export type PointerInput =
  | (Contact & { readonly kind: 'down'; readonly under: Under; readonly selection: Picked })
  | (Contact & { readonly kind: 'move' | 'up' | 'cancel' | 'lost-capture' })
  | { readonly kind: 'blur' };

/** What the caller does. Every down taken gives `capture`, and later exactly one `finish` or one `cancel`. */
export type Effect =
  | { readonly kind: 'capture'; readonly pointerId: number }
  | { readonly kind: 'release'; readonly pointerId: number }
  /** The press became a drag of `group` (the grabbed point last), in `route`, from `from`. */
  | {
      readonly kind: 'drag-start';
      readonly route: string;
      readonly grabbed: string;
      readonly group: readonly string[];
      readonly from: Pixel;
    }
  /** The drag is now at `to`: the whole movement is `to` less the drag's `from`, never a sum of steps. */
  | { readonly kind: 'drag-move'; readonly from: Pixel; readonly to: Pixel }
  /** The press ended within the threshold: a tap at `at`, with the up's modifiers and what lay under the down. */
  | { readonly kind: 'tap'; readonly at: Pixel; readonly under: Under; readonly modifiers: Modifiers }
  /** The gesture ended by its up: a drag's places are kept. */
  | { readonly kind: 'finish' }
  /** The gesture was ended by a pointer cancel, a lost capture or a blur: a drag's places are put back. */
  | { readonly kind: 'cancel' };

interface Owned {
  readonly pointerId: number;
  readonly down: Pixel;
  readonly last: Pixel;
  readonly modifiers: Modifiers;
  readonly under: Under;
  /** A press on a point with no modifier held: it drags once past the threshold. */
  readonly draggable: boolean;
  /** The points a drag would move, the grabbed point last. */
  readonly group: readonly string[];
}

/** No gesture; a press within the threshold; one past it that does nothing; a drag. */
export type PointerState =
  | { readonly phase: 'idle' }
  | (Owned & { readonly phase: 'pressed' | 'moved' | 'dragging' });

export const IDLE: PointerState = Object.freeze({ phase: 'idle' });

interface Stepped {
  readonly state: PointerState;
  readonly effects: readonly Effect[];
}

const unchanged = (state: PointerState): Stepped => ({ state, effects: [] });

/**
 * The group a drag of `under`'s point moves (v3, InteractionHandler.js :256–259): the selection's points when the
 * grabbed point is one of a selection of more than one, else the grabbed point alone; the grabbed point last.
 */
function groupOf(under: Under, selection: Picked): readonly string[] {
  if (under?.kind !== 'point') return [];
  const shared = selection.route === under.route && selection.points.length > 1 && selection.points.includes(under.id);
  return shared ? [...selection.points.filter((id) => id !== under.id), under.id] : [under.id];
}

function pressed(input: Extract<PointerInput, { kind: 'down' }>): Owned {
  const { alt, shift, meta } = input.modifiers;
  return {
    pointerId: input.pointerId,
    down: input.at,
    last: input.at,
    modifiers: input.modifiers,
    under: input.under,
    draggable: input.under?.kind === 'point' && !alt && !shift && !meta,
    group: groupOf(input.under, input.selection),
  };
}

/** The owning pointer now at `at` (v3's _processActivePointerMotion, :335–380): the threshold, then the drag. */
function moved(state: Extract<PointerState, { phase: 'pressed' | 'moved' | 'dragging' }>, at: Pixel, modifiers: Modifiers): Stepped {
  const next = { ...state, last: at, modifiers };
  if (state.phase === 'moved') return { state: next, effects: [] };
  if (state.phase === 'dragging') return { state: next, effects: [{ kind: 'drag-move', from: state.down, to: at }] };
  if (Math.hypot(at.x - state.down.x, at.y - state.down.y) <= DRAG_THRESHOLD) return { state: next, effects: [] };
  if (!state.draggable || state.under?.kind !== 'point') return { state: { ...next, phase: 'moved' }, effects: [] };
  const start: Effect = {
    kind: 'drag-start',
    route: state.under.route,
    grabbed: state.under.id,
    group: state.group,
    from: state.down,
  };
  return { state: { ...next, phase: 'dragging' }, effects: [start, { kind: 'drag-move', from: state.down, to: at }] };
}

/** The next state, and what the caller does, after `input`. */
export function step(state: PointerState, input: PointerInput): Stepped {
  if (input.kind === 'blur') {
    if (state.phase === 'idle') return unchanged(state);
    return { state: IDLE, effects: [{ kind: 'cancel' }, { kind: 'release', pointerId: state.pointerId }] };
  }
  if (input.kind === 'down') {
    if (state.phase !== 'idle' || !input.primary || input.button !== 0) return unchanged(state);
    return { state: { ...pressed(input), phase: 'pressed' }, effects: [{ kind: 'capture', pointerId: input.pointerId }] };
  }
  if (state.phase === 'idle' || input.pointerId !== state.pointerId) return unchanged(state);
  const release: Effect = { kind: 'release', pointerId: state.pointerId };
  switch (input.kind) {
    case 'move':
      return moved(state, input.at, input.modifiers);
    case 'up': {
      // An up at a place the last move did not deliver first takes that motion (v3 :445–451): it may cross the
      // threshold, making a drag that ends at once.
      const same = input.at.x === state.last.x && input.at.y === state.last.y;
      const motion = same ? { state: { ...state, modifiers: input.modifiers }, effects: [] } : moved(state, input.at, input.modifiers);
      const ended = motion.state;
      const tap: Effect[] =
        ended.phase === 'pressed' ? [{ kind: 'tap', at: ended.last, under: ended.under, modifiers: ended.modifiers }] : [];
      return { state: IDLE, effects: [...motion.effects, ...tap, { kind: 'finish' }, release] };
    }
    case 'cancel':
      return { state: IDLE, effects: [{ kind: 'cancel' }, release] };
    case 'lost-capture':
      // Capture is gone already: nothing to release (v3 :484–487).
      return { state: IDLE, effects: [{ kind: 'cancel' }] };
  }
}
