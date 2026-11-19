// CORE-04: how a stop's marker looks, from v3's renderWaypoints (v3/src/services/RenderingService.js:2318–2486). v3
// reads, for each stop, its dotSize, markerStyle, dotColor (then its stretch's segmentColor) and a custom image with its
// rotation; and a route-wide markerStyle. v4 declares none of those yet (MARKER_SETTINGS holds the route's size and
// colour alone), so every marker takes v3's default look, a dot, until a small item of its own adds them (D137).

/** How every marker of a route is drawn, its place and its appearance apart. */
export interface MarkerLook {
  readonly colour: string;
  /** v3's dotSize, the dot's radius, in reference pixels: the drawing scales it by the frame's render scale. */
  readonly size: number;
}

/** The marker's look: the one place to read a marker's look settings once they exist. */
export function lookOf(settings: { readonly size: number; readonly colour: string }): MarkerLook {
  return { colour: settings.colour, size: settings.size };
}
