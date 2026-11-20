// CORE-04: the export settings, a scene module of the same shape (the plan's §8). It draws nothing. What it gives is
// a video frame's size, aspect and rate from its settings, declared once in src/core/config/settings.ts: a video
// export asks the composer for a frame this size, and the composer fits the picture to whatever size it is asked for,
// so the export's framing is its size (DEF-99: a video frames at its own size, with no editor zoom).
import { EXPORT_SETTINGS } from '../../../core/config/settings';
import type { SceneFeatureModel } from '../../../core/feature/contract';
import type { Size } from '../../../core/geometry/transform';
import { aspectOf } from '../../../core/geometry/units';

export interface VideoFraming {
  /** The video's frame in pixels. */
  readonly size: Size;
  /** Its height over its width, as the core measures every aspect. */
  readonly aspect: number;
  readonly frameRate: number;
}

export const EXPORT: SceneFeatureModel<typeof EXPORT_SETTINGS, VideoFraming> = {
  id: 'export',
  title: 'Video export',
  description: 'The video’s frame size and frames a second.',
  group: 'core',
  settings: EXPORT_SETTINGS,
  select: (settings) => settings.export,
  evaluate: ({ settings }) => {
    const size = { width: settings.width, height: settings.height };
    return { ok: true, value: { size, aspect: aspectOf(size), frameRate: settings.frameRate } };
  },
  end: () => null,
  refersTo: () => [],
};
