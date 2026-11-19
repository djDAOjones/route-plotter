// CORE-04: the background, a scene module (the plan's §8): the picture under Show image, its tint as v3's darken and
// lighten, and its zoom, which places the picture and the routes on it together (D131). Ported from v3's
// RenderingService.js (renderBackground :1190, renderOverlay :1243, imageRect :1134). Its settings are the scene's,
// declared once in src/core/config/settings.ts.
import { BACKGROUND_SETTINGS } from '../../../core/config/settings';
import type { SceneFeatureModel } from '../../../core/feature/contract';

/** The tint's strongest cover, as a percentage of opacity (v3/src/config/constants.js:296, TINT_OPACITY_MAX). */
const TINT_COVER_MAX = 60;

interface Tint {
  /** Black darkens, white lightens. */
  readonly colour: '#000' | '#fff';
  /** How much of the picture it covers, 0 to 0.6. */
  readonly alpha: number;
}

export interface Background {
  /** Whether the picture shows: Show image. Hidden, it is still placed, so everything else stays where it was. */
  readonly shown: boolean;
  /** Its tint, or null with none. */
  readonly tint: Tint | null;
  /** How large the picture is placed: a factor on the image fitted to the frame (1 is 100%). */
  readonly zoom: number;
}

/** v3's tint: below 0 darker, above 0 lighter, its cover capped (RenderingService.js:1263–1272). */
function tintOf(tint: number): Tint | null {
  if (tint === 0) return null;
  return { colour: tint < 0 ? '#000' : '#fff', alpha: Math.min(Math.abs(tint), TINT_COVER_MAX) / 100 };
}

export const BACKGROUND: SceneFeatureModel<typeof BACKGROUND_SETTINGS, Background> = {
  id: 'background',
  title: 'Background',
  description: 'The background image: whether it shows, its tint and how large it is drawn.',
  group: 'core',
  settings: BACKGROUND_SETTINGS,
  select: (settings) => settings.background,
  evaluate: ({ settings }) => ({
    ok: true,
    value: { shown: settings.showImage, tint: tintOf(settings.tint), zoom: settings.zoom / 100 },
  }),
  end: () => null,
  refersTo: () => [],
  placement: (value) => value.zoom,
};
