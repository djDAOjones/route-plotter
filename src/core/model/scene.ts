// CORE-01: v4's project model (the plan's §3, A1). One scene holds routes; a route is points joined by lines, and a
// line runs one way or both ways, so a route may fork, join, start in several places and loop. Starts and ends are
// worked out from the lines; only a point the author marks as a start or an end is saved. `leadStart` is the point the
// lead walks from. Every saved field, the ids, references and lists included, is declared once, here or in
// src/core/config/settings.ts, with the few rules no single field states beside the entity they constrain; the types,
// a new scene and the check at open (`checkScene`) all come from those declarations. The model is pure: ids come from
// the caller's `IdSource`, never from a clock or a random number.
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
import { check, describe, type Checked } from '../schema/check';
import {
  choice,
  defaultsOf,
  group,
  id,
  list,
  number,
  optional,
  reference,
  text,
  type Breach,
  type Rule,
  type Values,
} from '../schema/field';

/** Gives a new id each call; the editor supplies one, a test a counter. Never `Date.now` or `Math.random`. */
export type IdSource = () => string;

const idOf = (what: string) =>
  id({ maxLength: LIMITS.idLength, description: `The ${what}’s id, used by nothing else in the scene.` });

const coordinate = (axis: string) =>
  number({
    default: 0.5,
    min: LIMITS.coordinateMin,
    max: LIMITS.coordinateMax,
    unit: 'image fraction',
    description: `Where the point stands ${axis}, as a share of the image (0 to 1 on the image).`,
  });

/** A point of this route, by its id. */
const onRoute = (description: string) => reference({ list: 'points', description });

export const POINT_FIELDS = {
  id: idOf('point'),
  x: coordinate('across'),
  y: coordinate('down'),
  // v3's majors and minors (v3/src/models/Waypoint.js): a stop may pause and carry a label; a bend shapes the line.
  kind: choice({ choices: ['stop', 'bend'], default: 'stop', description: 'Whether the point is a stop or a bend.' }),
  label: text({ default: '', maxLength: LIMITS.textLength, description: 'The stop’s label.' }),
  pauseMs: PAUSE_SETTINGS.pauseMs,
};

export const LINE_FIELDS = {
  id: idOf('line'),
  from: onRoute('The point the line leaves.'),
  to: onRoute('The point the line reaches; one way, the lead goes from `from` to `to`.'),
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

type Line = Values<typeof LINE_FIELDS>;

/** A line joins two different points: a line from a point to itself has no length to walk. */
const JOINS_TWO_POINTS: Rule<Line> = {
  breaches: (line) => {
    const expected = 'a point other than the line’s `from`';
    return line.from === line.to ? [{ at: 'to', rule: 'reference', expected, received: describe(line.to) }] : [];
  },
};

const MARK_FIELDS = {
  point: onRoute('The point marked.'),
  end: choice({
    choices: ['start', 'end'],
    default: 'start',
    description: 'Whether the marked point is a start or an end.',
  }),
};

const ROUTE_SETTINGS = {
  line: group({ of: LINE_SETTINGS, description: 'How the route’s line is drawn.' }),
  lead: group({ of: LEAD_SETTINGS, description: 'How the lead moves along the route and is drawn.' }),
  markers: group({ of: MARKER_SETTINGS, description: 'How the stops’ markers show.' }),
  labels: group({ of: LABEL_SETTINGS, description: 'How the stops’ labels show.' }),
};

export const ROUTE_FIELDS = {
  id: idOf('route'),
  points: list({ of: POINT_FIELDS, max: LIMITS.points, description: 'The route’s stops and bends.' }),
  lines: list({
    of: LINE_FIELDS,
    max: LIMITS.lines,
    rules: [JOINS_TWO_POINTS],
    description: 'The lines joining the route’s points.',
  }),
  // One start and one end at most on each point (ONE_MARK_OF_EACH_KIND), so never more than twice the points.
  marks: list({ of: MARK_FIELDS, max: 2 * LIMITS.points, description: 'The points marked as a start or an end.' }),
  leadStart: optional({
    of: onRoute('The point the lead walks from.'),
    description: 'The point the lead walks from: the first point drawn until the author picks another; none yet.',
  }),
  settings: group({ of: ROUTE_SETTINGS, description: 'The route’s settings, module by module.' }),
};

export type Route = Values<typeof ROUTE_FIELDS>;

/** A point carries at most one start mark and one end mark. */
const ONE_MARK_OF_EACH_KIND: Rule<Route> = {
  breaches: (route) => {
    const marked = new Set<string>();
    return route.marks.flatMap((mark, i): Breach[] => {
      const key = `${mark.end} ${mark.point}`;
      const seen = marked.has(key);
      marked.add(key);
      const expected = 'one mark of each kind on a point';
      return seen ? [{ at: `marks[${i}]`, rule: 'duplicate', expected, received: key }] : [];
    });
  },
};

/** The lead has a point to walk from as soon as the route has one (the plan's §3: the first point drawn). */
const LEAD_STARTS_ON_A_POINT: Rule<Route> = {
  breaches: (route) => {
    const expected = 'the id of a point, as the route has points';
    const missing = route.leadStart === null && route.points.length > 0;
    return missing ? [{ at: 'leadStart', rule: 'reference', expected, received: 'null' }] : [];
  },
};

/** v3's limit on a route's pauses together (LIMITS.routePausesMs); a bend's pause is not used. */
const PAUSES_IN_ALL: Rule<Route> = {
  breaches: (route) => {
    const pauses = route.points.reduce((sum, point) => sum + (point.kind === 'stop' ? point.pauseMs : 0), 0);
    const expected = `stops’ pauses of at most ${LIMITS.routePausesMs} milliseconds in all`;
    return pauses > LIMITS.routePausesMs ? [{ at: 'points', rule: 'total', expected, received: `${pauses}` }] : [];
  },
};

const SCENE_SETTINGS = {
  background: group({ of: BACKGROUND_SETTINGS, description: 'How the background image shows.' }),
  graphics: group({ of: GRAPHICS_SETTINGS, description: 'How large everything is drawn.' }),
  clock: group({ of: CLOCK_SETTINGS, description: 'How long the scene runs, and its holds.' }),
  export: group({ of: EXPORT_SETTINGS, description: 'How a video export is made.' }),
};

const SCENE_FIELDS = {
  routes: list({
    of: ROUTE_FIELDS,
    max: LIMITS.routes,
    rules: [ONE_MARK_OF_EACH_KIND, LEAD_STARTS_ON_A_POINT, PAUSES_IN_ALL],
    description: 'The scene’s routes, in drawing order.',
  }),
  settings: group({ of: SCENE_SETTINGS, description: 'The scene’s settings, module by module.' }),
};

export type Scene = Values<typeof SCENE_FIELDS>;

/** v3's limits on points and lines in all routes together (LIMITS.points, LIMITS.lines). */
const IN_ALL_ROUTES: Rule<Scene> = {
  breaches: ({ routes }) => {
    const totals = [
      ['points', routes.reduce((sum, route) => sum + route.points.length, 0), LIMITS.points],
      ['lines', routes.reduce((sum, route) => sum + route.lines.length, 0), LIMITS.lines],
    ] as const;
    return totals.flatMap(([what, count, limit]): Breach[] => {
      const expected = `at most ${limit} ${what} in all`;
      return count > limit ? [{ at: 'routes', rule: 'count', expected, received: `${count}` }] : [];
    });
  },
};

/** The whole project, as saved: its routes and settings, and the rules across them. */
export const SCENE = group({ of: SCENE_FIELDS, rules: [IN_ALL_ROUTES], description: 'The project’s one scene.' });

type Point = Values<typeof POINT_FIELDS>;

/** The scene as an open checks it: the scene itself, holding declared fields only, or every problem found. */
export function checkScene(value: unknown): Checked<Scene> {
  return check(SCENE, value);
}

/** A route with no points yet, at its default settings. */
export function newRoute(nextId: IdSource): Route {
  return { ...defaultsOf(ROUTE_FIELDS), id: nextId() };
}

/** A new project's scene: one empty route, every setting at its default. */
export function newScene(nextId: IdSource): Scene {
  return { ...defaultsOf(SCENE.of), routes: [newRoute(nextId)] };
}

export function newPoint(nextId: IdSource, at: Pick<Point, 'x' | 'y' | 'kind'>): Point {
  return { ...defaultsOf(POINT_FIELDS), ...at, id: nextId() };
}

export function newLine(nextId: IdSource, from: string, to: string): Line {
  return { ...defaultsOf(LINE_FIELDS), id: nextId(), from, to };
}
