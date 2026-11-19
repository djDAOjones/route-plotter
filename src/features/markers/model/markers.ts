// CORE-04: the stops' markers, a route module (the plan's §7 and §8, P2): a marker where each stop stands, none for a
// bend, shown as the route's appearance says. Ported from v3's renderWaypoints (RenderingService.js:2265–2486). Its
// settings are the route's markers group, declared once in src/core/config/settings.ts. It reads no clock and keeps
// nothing between frames.
import { MARKER_SETTINGS } from '../../../core/config/settings';
import type { Evaluation, RouteFeatureModel, RouteInput } from '../../../core/feature/contract';
import type { ImagePoint } from '../../../core/geometry/units';
import type { Values } from '../../../core/schema/field';
import { lookOf, type MarkerLook } from './look';
import { timingOf } from './timing';

type Settings = Values<typeof MARKER_SETTINGS>;

/** One stop's marker in a frame: where it stands, and its size as a share of the look's (v3's waypointScale). */
interface Marker {
  readonly pointId: string;
  readonly at: ImagePoint;
  readonly scale: number;
}

/** What the markers draw in a frame: one look, and a marker for each stop shown. */
export interface MarkersDrawing {
  readonly look: MarkerLook;
  readonly markers: readonly Marker[];
}

function evaluate({ settings, route, timeMs }: RouteInput<Settings>): Evaluation<MarkersDrawing> {
  const look = lookOf(settings);
  const { appearance } = settings;
  if (appearance === 'never') return { ok: true, value: { look, markers: [] } };
  const stops = route.shape.points.filter((point) => point.kind === 'stop');
  const scaleOf = timingOf(route.timeline, new Set(stops.map((point) => point.id)));
  // "until arrival" and "at arrival" show as always until their shrinking after the lead leaves is built (5b-1).
  const markers = stops
    .map((point) => ({
      pointId: point.id,
      at: { x: point.x, y: point.y },
      scale: appearance === 'from arrival' ? scaleOf(point.id, appearance, timeMs) : 1,
    }))
    .filter((marker) => marker.scale > 0);
  return { ok: true, value: { look, markers } };
}

export const MARKERS: RouteFeatureModel<typeof MARKER_SETTINGS, MarkersDrawing> = {
  id: 'markers',
  title: 'Markers',
  description: 'A mark where each stop stands, and when it shows.',
  group: 'core',
  settings: MARKER_SETTINGS,
  select: (settings) => settings.markers,
  evaluate,
  // A marker shows or hides with the lead's arrivals, which the core already counts in the content's end (P3).
  end: () => null,
};
