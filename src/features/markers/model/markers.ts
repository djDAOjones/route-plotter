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
type Shape = RouteInput<Settings>['route']['shape'];

/** Two places on the picture, from and to: the drawing measures the course's angle on the canvas, as the head's does. */
export type Course = readonly [ImagePoint, ImagePoint];

/** One stop's marker in a frame: where it stands, its size as a share of the look's (v3's waypointScale), its course. */
interface Marker {
  readonly pointId: string;
  readonly at: ImagePoint;
  readonly scale: number;
  /** The way a picture turned under `auto` points, or null for a stop on no line. */
  readonly course: Course | null;
}

/** What the markers draw in a frame: one look, and a marker for each stop shown. */
export interface MarkersDrawing {
  readonly look: MarkerLook;
  readonly markers: readonly Marker[];
}

/**
 * Each stop's course, where v3's renderWaypoints (:2414–2427) took it from its list of waypoints: toward the point at
 * the other end of the stop's first line out, in the route's saved order of lines (on a straight route v3's next
 * waypoint, a bend counting); with no line out, on from the point its first line in comes from (v3's one before); on
 * no line, none. On a fork a stop points along its first line out. Once a frame, over the lines once.
 */
function coursesOf({ points, lines }: Shape): (point: Shape['points'][number]) => Course | null {
  const placeOf = new Map(points.map((point) => [point.id, { x: point.x, y: point.y }]));
  const out = new Map<string, ImagePoint>();
  const into = new Map<string, ImagePoint>();
  for (const line of lines) {
    const [from, to] = [placeOf.get(line.from), placeOf.get(line.to)];
    if (from === undefined || to === undefined) continue;
    if (!out.has(line.from)) out.set(line.from, to);
    if (!into.has(line.to)) into.set(line.to, from);
  }
  return ({ id, x, y }) => {
    const [next, before] = [out.get(id), into.get(id)];
    if (next !== undefined) return [{ x, y }, next];
    return before === undefined ? null : [before, { x, y }];
  };
}

/** The module's evaluation, once a route a frame: the stops' markers now; none when the settings say never. */
function evaluate({ settings, route, timeMs }: RouteInput<Settings>): Evaluation<MarkersDrawing> {
  const look = lookOf(settings);
  const { appearance } = settings;
  if (appearance === 'never') return { ok: true, value: { look, markers: [] } };
  const stops = route.shape.points.filter((point) => point.kind === 'stop');
  const scaleOf = timingOf(route.timeline, new Set(stops.map((point) => point.id)), timeMs);
  const courseOf = coursesOf(route.shape);
  const markers = stops
    .map((point) => ({
      pointId: point.id,
      at: { x: point.x, y: point.y },
      scale: appearance === 'always' ? 1 : scaleOf(point.id, appearance),
      course: courseOf(point),
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
