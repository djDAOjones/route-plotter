// CORE-02: image fractions to canvas pixels and back, ported from v3's CoordinateTransform
// (v3/src/services/CoordinateTransform.js). A pure function of the sizes, so its bounds can never go stale, as v3's
// did when the canvas changed size (:23–26). Nothing is saved in canvas pixels (the rules file's first invariant).
import type { ImagePoint } from './units';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Where the image is drawn on the canvas, in canvas pixels, and its scale. */
export interface ImageBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

/**
 * The image fitted inside the canvas (`fit`) or covering it (`fill`), scaled by the background's zoom about the
 * canvas's centre (CoordinateTransform.js:66–155).
 */
export function imageBounds(canvas: Size, image: Size, zoom: number, mode: 'fit' | 'fill' = 'fit'): ImageBounds {
  const wider = image.width / image.height > canvas.width / canvas.height;
  const byWidth = canvas.width / image.width;
  const byHeight = canvas.height / image.height;
  const scale = (mode === 'fit' ? (wider ? byWidth : byHeight) : wider ? byHeight : byWidth) * zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (canvas.width - width) / 2, y: (canvas.height - height) / 2, width, height, scale };
}

/** A point at image fractions, in canvas pixels (CoordinateTransform.js:244). */
export function imageToCanvas(bounds: ImageBounds, point: ImagePoint): ImagePoint {
  return { x: point.x * bounds.width + bounds.x, y: point.y * bounds.height + bounds.y };
}

/** A canvas pixel, in image fractions; not held to the image (CoordinateTransform.js:164). */
export function canvasToImage(bounds: ImageBounds, pixel: ImagePoint): ImagePoint {
  return { x: (pixel.x - bounds.x) / bounds.width, y: (pixel.y - bounds.y) / bounds.height };
}

/** Whether a canvas pixel falls on the image (CoordinateTransform.js:206). */
export function isOnImage(bounds: ImageBounds, pixel: ImagePoint): boolean {
  const { x, y } = canvasToImage(bounds, pixel);
  return x >= 0 && x <= 1 && y >= 0 && y <= 1;
}
