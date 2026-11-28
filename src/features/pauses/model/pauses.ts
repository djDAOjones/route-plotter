// CORE-04: the stops' pauses, a route module (the plan's §7 and §8, P2), model only: it draws in no layer. A pause is
// a stop's own setting, `pauseMs`, declared once in src/core/config/settings.ts (PAUSE_SETTINGS) and carried by each
// point as that same declaration (POINT_FIELDS.pauseMs): this module names it as its per-stop settings, so no field is
// declared twice, and has no route-wide settings. Its evaluation gives P2's pause windows at the moment, read from the
// lead's heads as the core's timing gives them (the start's own pause is never taken; a bend's is none). It reads no
// clock and keeps nothing between frames.
import { PAUSE_SETTINGS } from '../../../core/config/settings';
import type { Evaluation, RouteFeatureModel, RouteInput } from '../../../core/feature/contract';
import type { Fields, Values } from '../../../core/schema/field';

/** No route-wide settings: a pause belongs to its stop. */
const NO_SETTINGS = {} satisfies Fields;

type Settings = Values<typeof NO_SETTINGS>;

/** A stop the lead is pausing at in this frame: how long it has paused there so far, and the whole pause. */
interface PauseWindow {
  readonly pointId: string;
  readonly elapsedMs: number;
  readonly totalMs: number;
}

/** What the pauses give in a frame: a window for each stop the lead is pausing at, and nothing drawn. */
interface Pauses {
  readonly windows: readonly PauseWindow[];
}

/** The module's evaluation, once a route a frame: each head held at a stop, how long it has waited and for how long. */
function evaluate({ lead }: RouteInput<Settings>): Evaluation<Pauses> {
  const windows = lead.heads.flatMap(({ pointId, pause }) =>
    pointId === null || pause === null ? [] : [{ pointId, elapsedMs: pause.elapsedMs, totalMs: pause.totalMs }],
  );
  return { ok: true, value: { windows } };
}

export const PAUSES: RouteFeatureModel<typeof NO_SETTINGS, Pauses> = {
  id: 'pauses',
  title: 'Pauses',
  description: 'How long the lead waits at each stop.',
  group: 'core',
  settings: NO_SETTINGS,
  select: () => ({}),
  evaluate,
  // The core's timeline already counts every stop's pause in the content's end (P3): a pause adds no time of its own.
  end: () => null,
  stopSettings: PAUSE_SETTINGS,
};
