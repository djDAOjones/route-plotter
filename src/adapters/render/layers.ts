// CORE-04: the fixed layers every frame is drawn in, bottom first (the plan's §8, P4). Within a layer the composer
// draws routes in their list order and, within a route, modules in catalogue order. The background mask is drawn to a
// surface of its own: what reveals uncover there, the background is then drawn through. The editor's overlays are not
// a layer: they are a separate list the editor alone draws, after these and in screen space, so no export or player
// frame can hold one (DEF-99.1).
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
