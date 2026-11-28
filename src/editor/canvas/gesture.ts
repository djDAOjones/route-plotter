// CORE-06: the pointer transaction bound to the editor's store (the plan's §15, line 1058; v3's drag through its bus,
// InteractionHandler.js :440–545 and wiringBus.js :259–267). `bindPointer` holds the machine's state (pointer.ts), steps
// it with each event the page reduces to a `PointerInput`, and does what each effect asks of the store; it gives the
// effects back so that the page asks for capture and releases it. A drag is one store gesture: opened at the drag's
// start under movePoints' words, with the group selected and the grabbed point last; at every move each point is set
// to its place at the drag's start plus the whole movement since the down (pixels made image fractions on the image's
// bounds, which the caller gives), never a sum of steps, and unclamped unless the caller hands in its `limit` (D237: the
// clamp is the page's; dom.ts hands one in, brief 115); the up commits,
// and a cancel, a lost capture or a blur puts back the project and the selection the gesture found. A tap is handed to
// the caller's `onTap`, which gives at most one command, dispatched as one step. Dropping a point onto another does not
// join them (v3's rejoin, wiringBus.js :54–60, is the page's to weigh: chat F).
import type { Start } from '../../core/model/commands/editing';
import { canvasToImage, type ImageBounds } from '../../core/geometry/transform';
import type { ImagePoint } from '../../core/geometry/units';
import type { Command } from '../store/command';
import type { Store } from '../store/store';
import { placePoints } from './commands';
import { IDLE, step, type Effect, type Modifiers, type Pixel, type PointerInput, type PointerState, type Under } from './pointer';

/** What the caller's `onTap` is told: where the tap was, in canvas pixels and image fractions, and what lay under it. */
export interface Tap {
  readonly at: Pixel;
  readonly place: ImagePoint;
  readonly under: Under;
  readonly modifiers: Modifiers;
}

export interface PointerBindingOptions {
  readonly store: Store;
  /** Where the image is drawn on the canvas now (transform.ts's `imageBounds`), read at each move and each tap. */
  readonly bounds: () => ImageBounds;
  /** What a tap means for the tool in hand: at most one command, or null for none (chat E's). */
  readonly onTap: (tap: Tap) => Command | null;
  /**
   * The page's clamp (D237), if any: the whole movement since the down, in image fractions, as it may be applied to
   * points that started at `starts`. Without it a drag is unclamped.
   */
  readonly limit?: (starts: readonly Start[], dx: number, dy: number) => { readonly dx: number; readonly dy: number };
}

export interface PointerBinding {
  /** Steps the machine with `input`, does what its effects ask of the store, and gives the effects back. */
  send(input: PointerInput): readonly Effect[];
  /** The machine's state now. */
  state(): PointerState;
}

type Gesture = Extract<ReturnType<Store['begin']>, { ok: true }>['gesture'];

interface Drag {
  readonly gesture: Gesture;
  readonly route: string;
  readonly starts: readonly Start[];
}

/**
 * Binds the pointer's state machine to the store: each input steps it, its effects act on the store (a drag is one
 * store gesture), and the effects come back so the page can take and release pointer capture.
 */
export function bindPointer({ store, bounds, onTap, limit }: PointerBindingOptions): PointerBinding {
  let state: PointerState = IDLE;
  let drag: Drag | null = null;

  /** Opens the drag's gesture and selects its group; when the store refuses (another gesture open), the drag is inert. */
  function start(effect: Extract<Effect, { kind: 'drag-start' }>): void {
    const begun = store.begin(effect.group.length === 1 ? 'Move point' : 'Move points');
    if (!begun.ok) return;
    const route = store.getState().project.scene.routes.find((each) => each.id === effect.route);
    const starts = effect.group.flatMap((id) => {
      const point = route?.points.find((each) => each.id === id);
      return point === undefined ? [] : [{ id, x: point.x, y: point.y }];
    });
    store.select({ route: effect.route, points: effect.group });
    drag = { gesture: begun.gesture, route: effect.route, starts };
  }

  /** Every point at its start place plus the whole movement; a refused apply leaves the last accepted places. */
  function place(effect: Extract<Effect, { kind: 'drag-move' }>): void {
    if (drag === null) return;
    const on = bounds();
    const from = canvasToImage(on, effect.from);
    const to = canvasToImage(on, effect.to);
    const moved = { dx: to.x - from.x, dy: to.y - from.y };
    const { dx, dy } = limit?.(drag.starts, moved.dx, moved.dy) ?? moved;
    drag.gesture.apply(placePoints(drag.route, drag.starts, dx, dy));
  }

  function end(how: 'commit' | 'cancel'): void {
    if (drag === null) return;
    const { gesture } = drag;
    drag = null;
    if (how === 'commit') gesture.commit();
    else gesture.cancel();
  }

  function perform(effect: Effect): void {
    switch (effect.kind) {
      case 'drag-start':
        start(effect);
        return;
      case 'drag-move':
        place(effect);
        return;
      case 'tap': {
        const { at, under, modifiers } = effect;
        const command = onTap({ at, place: canvasToImage(bounds(), at), under, modifiers });
        if (command !== null) store.dispatch(command);
        return;
      }
      case 'finish':
        end('commit');
        return;
      case 'cancel':
        end('cancel');
        return;
      case 'capture':
      case 'release':
        return;
    }
  }

  return {
    send: (input) => {
      const next = step(state, input);
      state = next.state;
      for (const effect of next.effects) perform(effect);
      return next.effects;
    },
    state: () => state,
  };
}
