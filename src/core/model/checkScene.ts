// CORE-01: the scene's check at open. The schema helper checks everything declared in scene.ts and settings.ts: every
// field, id (unique in the scene), reference (to a point of its own route), list and its count. Once that holds, this
// adds what no declaration says: a line joins two different points, a point carries at most one mark of each kind, and
// v3's totals: a route's pauses together, and points and lines in all routes together. It never throws: every problem
// is reported with the path of what broke, and the checked scene holds declared fields only.
import { LIMITS } from '../config/limits';
import { check, describe, type Checked, type Problem } from '../schema/check';
import { SCENE_FIELDS, type Route, type Scene } from './scene';

function routeProblems(route: Route, path: string): Problem[] {
  const problems: Problem[] = [];
  route.lines.forEach((line, i) => {
    if (line.from !== line.to) return;
    const expected = 'a point other than the line’s `from`';
    problems.push({ path: `${path}.lines[${i}].to`, rule: 'reference', expected, received: describe(line.to) });
  });
  const marked = new Set<string>();
  route.marks.forEach((mark, i) => {
    const key = `${mark.end} ${mark.point}`;
    const expected = 'one mark of each kind on a point';
    if (marked.has(key)) problems.push({ path: `${path}.marks[${i}]`, rule: 'duplicate', expected, received: key });
    marked.add(key);
  });
  const pauses = route.points.reduce((sum, point) => sum + (point.kind === 'stop' ? point.pauseMs : 0), 0);
  if (pauses > LIMITS.routePausesMs) {
    const expected = `stops’ pauses of at most ${LIMITS.routePausesMs} milliseconds in all`;
    problems.push({ path: `${path}.points`, rule: 'total', expected, received: String(pauses) });
  }
  return problems;
}

function sceneProblems(scene: Scene): Problem[] {
  const problems = scene.routes.flatMap((route, i) => routeProblems(route, `routes[${i}]`));
  const totals = [
    ['points', scene.routes.reduce((sum, route) => sum + route.points.length, 0), LIMITS.points],
    ['lines', scene.routes.reduce((sum, route) => sum + route.lines.length, 0), LIMITS.lines],
  ] as const;
  for (const [what, count, limit] of totals) {
    if (count > limit) {
      const expected = `at most ${limit} ${what} in all`;
      problems.push({ path: 'routes', rule: 'count', expected, received: `${count}` });
    }
  }
  return problems;
}

/** The whole scene, as an open checks it: the scene itself, holding declared fields only, or every problem found. */
export function checkScene(value: unknown): Checked<Scene> {
  const checked = check(SCENE_FIELDS, value);
  if (!checked.ok) return checked;
  const problems = sceneProblems(checked.value);
  return problems.length === 0 ? checked : { ok: false, problems };
}
