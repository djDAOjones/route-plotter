// CORE-04: the clock, a scene module of the same shape (the plan's §8, P3). It draws nothing. Its settings are the
// scene's length and holds, declared once in src/core/config/settings.ts; what it gives is the scene's length and its
// holds, from the content's end the composer sums once and the core's own clock (src/core/clock), never a second sum.
import { playLength } from '../../../core/clock/clock';
import { CLOCK_SETTINGS } from '../../../core/config/settings';
import type { SceneFeatureModel } from '../../../core/feature/contract';

export interface SceneClock {
  /** The scene's whole length in milliseconds: from its content, holds included, or the author's fixed length. */
  readonly lengthMs: number;
  /** When the content ends, in the content's own time. */
  readonly contentEndMs: number;
  readonly holdAtStartMs: number;
  readonly holdAtEndMs: number;
}

export const CLOCK: SceneFeatureModel<typeof CLOCK_SETTINGS, SceneClock> = {
  id: 'clock',
  title: 'Scene length',
  description: 'How long the scene runs, and how long its first and last frames hold.',
  group: 'core',
  settings: CLOCK_SETTINGS,
  select: (settings) => settings.clock,
  evaluate: ({ settings, contentEndMs }) => ({
    ok: true,
    value: {
      lengthMs: playLength(settings, contentEndMs),
      contentEndMs,
      holdAtStartMs: settings.holdAtStartMs,
      holdAtEndMs: settings.holdAtEndMs,
    },
  }),
  // The holds are scene time around the content, never content: the clock adds no part to the content's end.
  end: () => null,
  refersTo: () => [],
};
