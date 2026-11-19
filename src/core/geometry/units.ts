// CORE-02: distances in image widths (the plan's §4, A22). A point stands at image fractions, across and down; a
// distance is measured in image widths in both directions, so a tall image's height counts by its true proportion.
// Nothing here is in canvas pixels, which made v3's timing depend on the window (DEF-79).

export interface ImagePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * The image's height over its width. A scene without an image measures as a square, so its timing is still defined;
 * a size that is not a positive finite number is read the same way.
 */
export function aspectOf(size: { readonly width: number; readonly height: number } | null): number {
  if (!size) return 1;
  const ratio = size.height / size.width;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

/** The distance between two points, in image widths. */
export function widthsBetween(a: ImagePoint, b: ImagePoint, aspect: number): number {
  return Math.hypot(b.x - a.x, (b.y - a.y) * aspect);
}
