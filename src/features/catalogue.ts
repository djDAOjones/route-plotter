// CORE-04: the catalogue (the plan's §8): the two typed, ordered lists of modules, definitions and drawing, safe for
// the player. Their order is the panel's fixed order (Q17) and the drawing order within a layer. The core's own
// modules come first: on a route the line, then the lead (stage 5a), the markers (5b-1), the labels (5b-2) and the
// pauses (5b-3, model only, drawing in no layer);
// on the scene the background, the clock and the export settings, in §8's order, the background first so it is drawn
// first in its layers. The editor's panels are another list, src/features/catalogue.editor.ts, built with the editor.
// A module's model types are in src/core/feature/contract.ts.
import type { Drawings } from '../adapters/render/layers';
import type { RouteFeatureModel, SceneFeatureModel } from '../core/feature/contract';
import type { Fields } from '../core/schema/field';
import { BACKGROUND_DRAWINGS } from './background/draw/background';
import { BACKGROUND } from './background/model/background';
import { CLOCK } from './clock/model/clock';
import { EXPORT } from './export/model/export';
import { LABEL_DRAWINGS } from './labels/draw/labels';
import { LABELS } from './labels/model/labels';
import { LEAD_DRAWINGS } from './lead/draw/lead';
import { LEAD } from './lead/model/lead';
import { LINE_DRAWINGS } from './line/draw/line';
import { LINE } from './line/model/line';
import { MARKER_DRAWINGS } from './markers/draw/markers';
import { MARKERS } from './markers/model/markers';
import { PAUSES } from './pauses/model/pauses';

/** A route module: its model and what it draws, layer by layer. */
export interface RouteFeature<S extends Fields, R> extends RouteFeatureModel<S, R> {
  readonly layers: Drawings<R>;
}

/** A scene module: its model, and what it draws if it draws (the background). */
export interface SceneFeature<S extends Fields, R> extends SceneFeatureModel<S, R> {
  readonly layers?: Drawings<R>;
}

export interface Catalogue {
  readonly route: readonly RouteFeature<Fields, unknown>[];
  readonly scene: readonly SceneFeature<Fields, unknown>[];
}

export const CATALOGUE: Catalogue = {
  route: [
    { ...LINE, layers: LINE_DRAWINGS },
    { ...LEAD, layers: LEAD_DRAWINGS },
    { ...MARKERS, layers: MARKER_DRAWINGS },
    { ...LABELS, layers: LABEL_DRAWINGS },
    { ...PAUSES, layers: {} },
  ],
  scene: [{ ...BACKGROUND, layers: BACKGROUND_DRAWINGS }, CLOCK, EXPORT],
};
