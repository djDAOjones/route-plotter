// CORE-04: the module contract's types (the plan's §8), types only and no behaviour. They live in the core, not in
// src/features/catalogue.ts, because a feature's `model/` may reach only the core and its own `model/`
// (.dependency-cruiser.cjs, rule 1): it must be able to name its own contract. What a module draws, and the two lists,
// are in src/adapters/render/layers.ts and src/features/catalogue.ts. Provisional under grant G3 (D128).
import type { ImagePoint } from '../geometry/units';
import type { Route, Scene } from '../model/scene';
import type { Fields, Values } from '../schema/field';
import type { Part } from '../timing/sceneLength';
import type { leadAt, Timeline } from '../timing/timeline';

/** An evaluation that cannot go on, as a domain problem (the abstraction plan's §11.9), never a throw. */
interface Report {
  readonly ok: false;
  readonly reason: string;
}

export type Evaluation<R> = { readonly ok: true; readonly value: R } | Report;

/** What every module has, route or scene: who it is, where it sits in the Add list, its settings' declaration. */
interface FeatureBase<S extends Fields> {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** The Add list's group; the core's own modules are always present. FEAT-01 adds the list's other groups. */
  readonly group: 'core';
  readonly settings: S;
}

/** A route as a module reads it (P1, P2): its points, lines, start and authored marks, and the lead's timeline; none of its settings. */
interface RouteView {
  readonly shape: Pick<Route, 'points' | 'lines' | 'leadStart' | 'marks'>;
  readonly timeline: Timeline;
}

/** What a route module is given that does not change with time: enough to say when it ends. */
interface RouteBasis<V> {
  readonly settings: V;
  readonly route: RouteView;
  /** `hash(seed, route, module)`: the module's own seed, the same every frame. */
  readonly seed: number;
  /** Canvas pixels per reference pixel in this frame (src/adapters/render/scale.ts). */
  readonly scale: number;
}

/** What a route module is given for one moment: the content's time and the lead there (P2). */
export interface RouteInput<V> extends RouteBasis<V> {
  readonly timeMs: number;
  readonly lead: ReturnType<typeof leadAt>;
}

/** A traveller a scene module follows: one route's module that offers a position (the lead, the crowd's centre). */
export interface TravellerRef {
  readonly routeId: string;
  readonly featureId: string;
}

export interface SceneInput<V> {
  readonly settings: V;
  readonly timeMs: number;
  readonly seed: number;
  readonly scale: number;
  /** Where a traveller this module declared through `refersTo` is at a time; null for any other or none. */
  readonly travellerAt: (ref: TravellerRef, timeMs: number) => ImagePoint | null;
}

/** Where the picture is looked at from, and how close: a centre in image coordinates and a zoom (P4). */
export interface View {
  readonly centre: ImagePoint;
  readonly zoom: number;
}

/** A route module's model: evaluated once a route per frame, in catalogue order. */
export interface RouteFeatureModel<S extends Fields, R> extends FeatureBase<S> {
  /** Its own settings, out of the route's: the module names where they are kept, and is given nothing else. */
  select(settings: Route['settings']): Values<S>;
  evaluate(input: RouteInput<Values<S>>): Evaluation<R>;
  /** When it stops changing, or how long it cycles (§4, P3); null when it adds no time of its own. */
  end(input: RouteBasis<Values<S>>): Part | null;
  readonly traveller?: { positionAt(input: RouteInput<Values<S>>): ImagePoint | null };
  /** Per-stop, per-line and per-start settings, composed into the save file (P5). */
  readonly stopSettings?: Fields;
  readonly lineSettings?: Fields;
  readonly startSettings?: Fields;
}

/** A scene module's model: evaluated once a frame, from the travellers it points at and nothing of any route. */
export interface SceneFeatureModel<S extends Fields, R> extends FeatureBase<S> {
  select(settings: Scene['settings']): Values<S>;
  evaluate(input: SceneInput<Values<S>>): Evaluation<R>;
  end(input: Omit<SceneInput<Values<S>>, 'timeMs' | 'travellerAt'>): Part | null;
  /** The routes' travellers its settings point at, so the app can name dependants before a removal. */
  refersTo(settings: Values<S>): readonly TravellerRef[];
  /** The view it gives, from its evaluation: the camera's. */
  view?(value: R): View;
}
