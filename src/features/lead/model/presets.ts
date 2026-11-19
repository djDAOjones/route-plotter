// CORE-04: the lead's head styles and presets, ported from v3's pathHeadPresets.js and its pathHead defaults
// (v3/src/app/persistence.js:99–107). An image head's picture is not loaded here: the presets name it, and whoever
// asks for the frame hands the decoded picture in under that name (FrameRequest.images), as the background's picture
// is (D132). With none handed in, an image head is drawn as a dot, as v3's was until its image had loaded.

/** v3's head styles: two drawn, one built-in image and the author's own image. */
export type HeadStyle = 'dot' | 'arrow' | 'drone' | 'custom';

/** v3's rotation modes: `auto` turns the head to its heading, `fixed` keeps it upright. */
type Rotation = 'auto' | 'fixed';

/** The built-in image heads (v3's PRESET_DATA_URLS): the name each one's picture is handed in under. */
const BUILT_IN: Partial<Record<HeadStyle, string>> = { drone: 'head:drone' };

/** How every head of a lead is drawn: v3's pathHead, its place and heading apart. */
export interface HeadLook {
  readonly style: HeadStyle;
  readonly colour: string;
  /** In reference pixels: the drawing scales it by the frame's render scale. */
  readonly size: number;
  /** The name of the picture an image head draws (a built-in's, or the custom image's asset), or null. */
  readonly image: string | null;
  readonly rotation: Rotation;
  /** A further turn, in degrees, whatever the mode. */
  readonly offsetDegrees: number;
}

/** The name an image head's picture is handed in under (v3's resolvePathHeadImage, without the loading). */
function imageOf(style: HeadStyle, assetId: string | null): string | null {
  if (style === 'custom') return assetId === null ? null : `asset:${assetId}`;
  return BUILT_IN[style] ?? null;
}

/**
 * The head's look. The model holds its size alone (LEAD_SETTINGS has no style, colour, image or rotation yet), so
 * every head is v3's default, a near-black arrow turned to its heading; the drawing already takes every style (D137).
 * The one place to read those settings once they exist.
 */
export function lookOf(size: number): HeadLook {
  return { style: 'arrow', colour: '#111111', size, image: imageOf('arrow', null), rotation: 'auto', offsetDegrees: 0 };
}
