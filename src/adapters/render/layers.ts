// CORE-04: the fixed layers every frame is drawn in, bottom first (the plan's §8, P4). Within a layer the composer
// draws routes in their list order and, within a route, modules in catalogue order. The background mask is drawn to a
// surface of its own: what reveals uncover there, the background is then drawn through. The editor's overlays are not
// a layer: they are a separate list the editor alone draws, after these and in screen space, so no export or player
// frame can hold one (DEF-99.1).
import type { ImageBounds } from '../../core/geometry/transform';
import type { DrawContext } from './context';

export const LAYERS = [
  'backgroundMask',
  'background',
  'backgroundEffects',
  'highlightedAreas',
  'lines',
  'crowdDots',
  'markers',
  'leadHead',
  'labels',
] as const;

export type Layer = (typeof LAYERS)[number];

/** What every drawing is told of the frame: where the picture lies in it (image to canvas) and the render scale. */
export interface Frame {
  readonly bounds: ImageBounds;
  readonly scale: number;
}

/** One module's drawing in one layer, from its evaluation. Declared as a method, so a list may hold any module's. */
type Drawing<R> = { draw(context: DrawContext, value: R, frame: Frame): void }['draw'];

/** A module's drawings, one for each layer it draws in. */
export type Drawings<R> = { readonly [L in Layer]?: Drawing<R> };
