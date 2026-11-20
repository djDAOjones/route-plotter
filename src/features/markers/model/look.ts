// CORE-04: how a stop's marker looks, from v3's renderWaypoints (v3/src/services/RenderingService.js:2318–2486). v3
// reads, for each stop, its dotSize, markerStyle, dotColor (then its stretch's segmentColor) and a custom image with its
// rotation; and a route-wide markerStyle. v4 declares none of those yet (MARKER_SETTINGS holds the route's size and
// colour alone), so every marker takes v3's default look, a dot, until a small item of its own adds them (D137); the
// drawing already takes every style.

/** v3's marker styles: three drawn, the author's own picture, and none. */
export type MarkerStyle = 'dot' | 'square' | 'flag' | 'custom' | 'none';

/** v3's rotation modes for a marker's picture: `auto` turns it toward the next point, `fixed` keeps it upright. */
type Rotation = 'auto' | 'fixed';

/** How every marker of a route is drawn, its place and its appearance apart. */
export interface MarkerLook {
  readonly style: MarkerStyle;
  /** v3 draws nothing for a colour of `transparent`. */
  readonly colour: string;
  /** v3's dotSize, the dot's radius, in reference pixels: the drawing scales it by the frame's render scale. */
  readonly size: number;
  /** The name a custom marker's picture is handed in under (FrameRequest.images), or null. */
  readonly image: string | null;
  readonly rotation: Rotation;
  /** A further turn of the picture, in degrees, read only under `auto` (v3's markers; the head's reads it in both). */
  readonly offsetDegrees: number;
}

/**
 * The marker's look: the one place to read a marker's look settings once they exist. Until then, v3's defaults
 * (v3/src/models/Waypoint.js:130–131 for the rotation): a dot, no picture, `fixed`, no offset (D144).
 */
export function lookOf(settings: { readonly size: number; readonly colour: string }): MarkerLook {
  return { style: 'dot', colour: settings.colour, size: settings.size, image: null, rotation: 'fixed', offsetDegrees: 0 };
}
