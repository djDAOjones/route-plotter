// CORE-01: v4's project model (the plan's §3, A1). One scene holds routes; a route is points joined by lines, and a
// line runs one way or both ways, so a route may fork, join, start in several places and loop. Starts and ends are
// worked out from the lines; only a point the author marks as a start or an end is saved. `leadStart` is the point the
// lead walks from. Every saved field is declared once, here or in src/core/config/settings.ts. The model is pure:
// ids come from the caller's `IdSource`, never from a clock or a random number.
import { LIMITS } from '../config/limits';
import {
  BACKGROUND_SETTINGS,
  CLOCK_SETTINGS,
  EXPORT_SETTINGS,
  GRAPHICS_SETTINGS,
  LABEL_SETTINGS,
  LEAD_SETTINGS,
  LINE_SETTINGS,
  MARKER_SETTINGS,
  PAUSE_SETTINGS,
} from '../config/settings';
import { choice, defaultsOf, defaultsOfGroups, number, text, type GroupValues, type Values } from '../schema/field';

/** Gives a new id each call; the editor supplies one, a test a counter. Never `Date.now` or `Math.random`. */
export type IdSource = () => string;

const coordinate = (axis: string) =>
  number({
    default: 0.5,
    min: LIMITS.coordinateMin,
    max: LIMITS.coordinateMax,
    unit: 'image fraction',
    description: `Where the point stands ${axis}, as a share of the image (0 to 1 on the image).`,
  });

export const POINT_FIELDS = {
  x: coordinate('across'),
  y: coordinate('down'),
  // v3's majors and minors (v3/src/models/Waypoint.js): a stop may pause and carry a label; a bend shapes the line.
  kind: choice({ choices: ['stop', 'bend'], default: 'stop', description: 'Whether the point is a stop or a bend.' }),
  label: text({ default: '', maxLength: LIMITS.textLength, description: 'The stop’s label.' }),
  pauseMs: PAUSE_SETTINGS.pauseMs,
};

export const LINE_FIELDS = {
  direction: choice({
    choices: ['one way', 'both ways'],
    default: 'one way',
    description: 'Whether the line runs from its first point to its second, or both ways.',
  }),
  // v3's per-leg speed, 0.1 to 10 times (v3/src/controllers/UIController.js:63–64).
  speedFactor: number({
    default: 1,
    min: 0.1,
    max: 10,
    unit: 'times',
    description: 'How much faster or slower than the route’s speed the lead takes this line.',
  }),
};

export const MARK_FIELDS = {
  end: choice({
    choices: ['start', 'end'],
    default: 'start',
    description: 'Whether the marked point is a start or an end.',
  }),
};

export const ROUTE_SETTINGS = {
  line: LINE_SETTINGS,
  lead: LEAD_SETTINGS,
  markers: MARKER_SETTINGS,
  labels: LABEL_SETTINGS,
};

export const SCENE_SETTINGS = {
  background: BACKGROUND_SETTINGS,
  graphics: GRAPHICS_SETTINGS,
  clock: CLOCK_SETTINGS,
  export: EXPORT_SETTINGS,
};

export type Point = { id: string } & Values<typeof POINT_FIELDS>;
/** Joins two points of the same route, `from` and `to`, by their ids. */
export type Line = { id: string; from: string; to: string } & Values<typeof LINE_FIELDS>;
/** A point the author marked as a start or an end, by its id. */
export type Mark = { point: string } & Values<typeof MARK_FIELDS>;

export interface Route {
  id: string;
  points: Point[];
  lines: Line[];
  marks: Mark[];
  /** The point the lead walks from: the first point drawn until the author picks another; null while there is none. */
  leadStart: string | null;
  settings: GroupValues<typeof ROUTE_SETTINGS>;
}

export interface Scene {
  /** In drawing order. */
  routes: Route[];
  settings: GroupValues<typeof SCENE_SETTINGS>;
}

/** A route with no points yet, at its default settings. */
export function newRoute(nextId: IdSource): Route {
  const settings = defaultsOfGroups(ROUTE_SETTINGS);
  return { id: nextId(), points: [], lines: [], marks: [], leadStart: null, settings };
}

/** A new project's scene: one empty route, every setting at its default. */
export function newScene(nextId: IdSource): Scene {
  return { routes: [newRoute(nextId)], settings: defaultsOfGroups(SCENE_SETTINGS) };
}

export function newPoint(nextId: IdSource, at: Pick<Point, 'x' | 'y' | 'kind'>): Point {
  return { id: nextId(), ...defaultsOf(POINT_FIELDS), ...at };
}

export function newLine(nextId: IdSource, from: string, to: string): Line {
  return { id: nextId(), from, to, ...defaultsOf(LINE_FIELDS) };
}
