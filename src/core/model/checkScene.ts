// CORE-01: the scene's check at open. Fields are checked by the schema helper from their one declaration; this adds
// what no single field can say: ids (present, at most LIMITS.idLength characters, unique in the scene), lines and marks
// that name points of their own route, `leadStart`, and v3's counts and totals. It never throws: every problem is
// reported with the path of what broke, and the checked scene holds declared keys only.
import { LIMITS } from '../config/limits';
import { checkFields, checkGroups, describe, type Checked, type Problem } from '../schema/check';
import { isRecord } from '../schema/field';
import {
  LINE_FIELDS,
  MARK_FIELDS,
  POINT_FIELDS,
  ROUTE_SETTINGS,
  SCENE_SETTINGS,
  type Line,
  type Mark,
  type Point,
  type Route,
  type Scene,
} from './scene';

/** What a route's check knows of the whole scene: the problems so far and every id seen. */
interface Seen {
  readonly problems: Problem[];
  readonly ids: Set<string>;
}

function problem(seen: Seen, path: string, rule: Problem['rule'], expected: string, value: unknown): void {
  seen.problems.push({ path, rule, expected, received: describe(value) });
}

function checkId(seen: Seen, value: unknown, path: string): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > LIMITS.idLength) {
    problem(seen, path, 'id', `text of 1 to ${LIMITS.idLength} characters`, value);
    return null;
  }
  if (seen.ids.has(value)) {
    problem(seen, path, 'duplicate', 'an id used nowhere else in the scene', value);
    return null;
  }
  seen.ids.add(value);
  return value;
}

function listAt(seen: Seen, value: unknown, path: string): readonly unknown[] {
  if (Array.isArray(value)) return value;
  problem(seen, path, 'type', 'a list', value);
  return [];
}

/** A key of `value` that must name a point of this route. */
function checkReference(seen: Seen, value: unknown, path: string, points: ReadonlySet<string>): string | null {
  if (typeof value === 'string' && points.has(value)) return value;
  problem(seen, path, 'reference', 'the id of a point on this route', value);
  return null;
}

function checkPoint(seen: Seen, item: unknown, at: string): Point | null {
  const fields = checkFields(POINT_FIELDS, item, at, ['id']);
  if (!fields.ok) seen.problems.push(...fields.problems);
  const id = isRecord(item) ? checkId(seen, item.id, `${at}.id`) : null;
  return fields.ok && id !== null ? { id, ...fields.value } : null;
}

function checkPoints(seen: Seen, value: unknown, path: string): Point[] {
  const points = listAt(seen, value, path)
    .map((item, i) => checkPoint(seen, item, `${path}[${i}]`))
    .filter((point) => point !== null);
  const pauses = points.reduce((sum, point) => sum + (point.kind === 'stop' ? point.pauseMs : 0), 0);
  if (pauses > LIMITS.routePausesMs) {
    problem(seen, path, 'total', `stops' pauses of at most ${LIMITS.routePausesMs} milliseconds in all`, pauses);
  }
  return points;
}

function checkLine(seen: Seen, item: unknown, at: string, points: ReadonlySet<string>): Line | null {
  const fields = checkFields(LINE_FIELDS, item, at, ['id', 'from', 'to']);
  if (!fields.ok) seen.problems.push(...fields.problems);
  if (!isRecord(item)) return null;
  const id = checkId(seen, item.id, `${at}.id`);
  const from = checkReference(seen, item.from, `${at}.from`, points);
  const to = checkReference(seen, item.to, `${at}.to`, points);
  if (from !== null && from === to) problem(seen, `${at}.to`, 'reference', 'a point other than `from`', to);
  const joined = id !== null && from !== null && to !== null && from !== to;
  return fields.ok && joined ? { id, from, to, ...fields.value } : null;
}

function checkLines(seen: Seen, value: unknown, path: string, points: ReadonlySet<string>): Line[] {
  return listAt(seen, value, path)
    .map((item, i) => checkLine(seen, item, `${path}[${i}]`, points))
    .filter((line) => line !== null);
}

function checkMarks(seen: Seen, value: unknown, path: string, points: ReadonlySet<string>): Mark[] {
  const marks: Mark[] = [];
  const marked = new Set<string>();
  listAt(seen, value, path).forEach((item, i) => {
    const at = `${path}[${i}]`;
    const mark = checkFields(MARK_FIELDS, item, at, ['point']);
    if (!mark.ok) seen.problems.push(...mark.problems);
    const point = checkReference(seen, isRecord(item) ? item.point : undefined, `${at}.point`, points);
    if (point === null) return;
    if (mark.ok && marked.has(`${mark.value.end} ${point}`)) {
      problem(seen, at, 'duplicate', 'one mark of each kind on a point', point);
    } else if (mark.ok) {
      marked.add(`${mark.value.end} ${point}`);
      marks.push({ point, ...mark.value });
    }
  });
  return marks;
}

function checkLeadStart(seen: Seen, value: unknown, path: string, points: readonly Point[]): string | null {
  if (points.length === 0 && value === null) return null;
  if (typeof value === 'string' && points.some((point) => point.id === value)) return value;
  const expected = points.length === 0 ? 'null, as the route has no points' : 'the id of a point on this route';
  problem(seen, path, 'reference', expected, value);
  return null;
}

const ROUTE_KEYS = ['id', 'points', 'lines', 'marks', 'leadStart', 'settings'];

function checkRoute(seen: Seen, value: unknown, path: string): Route | null {
  if (!isRecord(value)) {
    problem(seen, path, 'type', 'an object', value);
    return null;
  }
  for (const key of Object.keys(value)) {
    if (!ROUTE_KEYS.includes(key)) problem(seen, `${path}.${key}`, 'unknown', 'no such field', value[key]);
  }
  const id = checkId(seen, value.id, `${path}.id`);
  const points = checkPoints(seen, value.points, `${path}.points`);
  const ids = new Set(points.map((point) => point.id));
  const lines = checkLines(seen, value.lines, `${path}.lines`, ids);
  const marks = checkMarks(seen, value.marks, `${path}.marks`, ids);
  const leadStart = checkLeadStart(seen, value.leadStart, `${path}.leadStart`, points);
  const settings = checkGroups(ROUTE_SETTINGS, value.settings, `${path}.settings`);
  if (!settings.ok) seen.problems.push(...settings.problems);
  return id && settings.ok ? { id, points, lines, marks, leadStart, settings: settings.value } : null;
}

function checkCounts(seen: Seen, routes: readonly unknown[], checked: readonly Route[]): void {
  if (routes.length > LIMITS.routes) problem(seen, 'routes', 'count', `at most ${LIMITS.routes} routes`, routes);
  const points = checked.reduce((sum, route) => sum + route.points.length, 0);
  if (points > LIMITS.points) problem(seen, 'routes', 'count', `at most ${LIMITS.points} points in all`, points);
  const lines = checked.reduce((sum, route) => sum + route.lines.length, 0);
  if (lines > LIMITS.lines) problem(seen, 'routes', 'count', `at most ${LIMITS.lines} lines in all`, lines);
}

/** The whole scene, as an open checks it: the scene itself, or every problem found. */
export function checkScene(value: unknown): Checked<Scene> {
  const seen: Seen = { problems: [], ids: new Set() };
  if (!isRecord(value)) {
    return { ok: false, problems: [{ path: 'scene', rule: 'type', expected: 'an object', received: describe(value) }] };
  }
  for (const key of Object.keys(value)) {
    if (key !== 'routes' && key !== 'settings') problem(seen, key, 'unknown', 'no such field', value[key]);
  }
  const listed = listAt(seen, value.routes, 'routes');
  const routes = listed.map((route, i) => checkRoute(seen, route, `routes[${i}]`)).filter((route) => route !== null);
  checkCounts(seen, listed, routes);
  const settings = checkGroups(SCENE_SETTINGS, value.settings, 'settings');
  if (!settings.ok) seen.problems.push(...settings.problems);
  return seen.problems.length > 0 || !settings.ok
    ? { ok: false, problems: seen.problems }
    : { ok: true, value: { routes, settings: settings.value } };
}
