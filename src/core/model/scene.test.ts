// CORE-01: the model's examples, the held lines INTAKE.29 and DEF-20.2, and what no single field can check.
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../config/limits';
import { checkFields } from '../schema/check';
import { defaultsOf, type Field, type Fields } from '../schema/field';
import { checkScene } from './checkScene';
import {
  LINE_FIELDS,
  MARK_FIELDS,
  POINT_FIELDS,
  ROUTE_SETTINGS,
  SCENE_SETTINGS,
  newLine,
  newPoint,
  newRoute,
  newScene,
  type Scene,
} from './scene';

/** Ids from a counter: what a test injects in place of the editor's ids. */
function counter(prefix = 'id'): () => string {
  let next = 0;
  return () => `${prefix}${(next += 1)}`;
}

/** The item at `index`, which the test knows is there. */
function itemAt<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`no item at ${index}`);
  return item;
}

/** A route of three stops, A→B→C, its lead starting at A. */
function chainScene(): Scene {
  const nextId = counter();
  const scene = newScene(nextId);
  const route = itemAt(scene.routes, 0);
  const [a, b, c] = [0.1, 0.5, 0.9].map((x) => newPoint(nextId, { x, y: 0.5, kind: 'stop' }));
  if (!a || !b || !c) throw new Error('three points');
  route.points.push(a, b, c);
  route.lines.push(newLine(nextId, a.id, b.id), newLine(nextId, b.id, c.id));
  route.leadStart = a.id;
  return scene;
}

const EVERY_GROUP: readonly [string, Fields][] = [
  ['point', POINT_FIELDS],
  ['line', LINE_FIELDS],
  ['mark', MARK_FIELDS],
  ...Object.entries(ROUTE_SETTINGS).map(([name, fields]): [string, Fields] => [`route.${name}`, fields]),
  ...Object.entries(SCENE_SETTINGS).map(([name, fields]): [string, Fields] => [`scene.${name}`, fields]),
];

const numberFields = EVERY_GROUP.flatMap(([group, fields]) =>
  Object.entries(fields)
    .filter((entry): entry is [string, Extract<Field, { kind: 'number' }>] => entry[1].kind === 'number')
    .map(([name, field]) => ({ group, name, fields, field })),
);

describe('a new scene', () => {
  it('holds one empty route at default settings, every id from the injected source', () => {
    const ids: string[] = [];
    const scene = newScene(() => {
      const id = `made${ids.length}`;
      ids.push(id);
      return id;
    });
    expect(ids).toEqual(['made0']);
    const empty = { id: 'made0', points: [], lines: [], marks: [], leadStart: null };
    expect(scene.routes).toEqual([expect.objectContaining(empty)]);
    expect(checkScene(scene)).toEqual({ ok: true, value: scene });
  });

  it('a second route, made new, opens beside the first with ids of its own', () => {
    const nextId = counter();
    const scene = newScene(nextId);
    scene.routes.push(newRoute(nextId));
    expect(scene.routes.map((route) => route.id)).toEqual(['id1', 'id2']);
    expect(checkScene(scene)).toEqual({ ok: true, value: scene });
  });

  it('a chain of three stops opens as it was made', () => {
    const scene = chainScene();
    expect(checkScene(scene)).toEqual({ ok: true, value: scene });
  });
});

describe('INTAKE.29 and DEF-20.2: a value that opens is always one its control can show', () => {
  it('INTAKE.29: graphics scale opens from 0.25 to 4, the range drawn, and 16 is refused, naming the field', () => {
    const scene = chainScene();
    for (const scale of [0.25, 1, 4]) {
      scene.settings.graphics.scale = scale;
      expect(checkScene(scene).ok).toBe(true);
    }
    for (const scale of [16, 0.2]) {
      scene.settings.graphics.scale = scale;
      expect(checkScene(scene)).toEqual({
        ok: false,
        problems: [
          {
            path: 'settings.graphics.scale',
            rule: 'range',
            expected: 'a number from 0.25 to 4 times',
            received: String(scale),
          },
        ],
      });
    }
  });

  it('DEF-20.2: a frame rate past the control’s reach, which v3 opened (120), is refused', () => {
    const scene = chainScene();
    scene.settings.export.frameRate = 120;
    const refused = { ok: false, problems: [{ path: 'settings.export.frameRate', rule: 'range' }] };
    expect(checkScene(scene)).toMatchObject(refused);
  });

  it.each(numberFields)('DEF-20.2: $group.$name opens exactly within its control’s range', (one) => {
    const { fields, name, field } = one;
    const at = (value: number) => checkFields(fields, { ...defaultsOf(fields), [name]: value }, 'g');
    expect(at(field.min).ok).toBe(true);
    expect(at(field.max).ok).toBe(true);
    const below = field.min - Math.max(1, Math.abs(field.min)) * 1e-6;
    const above = field.max + Math.max(1, Math.abs(field.max)) * 1e-6;
    for (const value of [below, above, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(at(value)).toMatchObject({ ok: false, problems: [{ path: `g.${name}` }] });
    }
  });
});

describe('what no single field can check', () => {
  it('a line must join two points of its own route', () => {
    const scene = chainScene();
    const route = itemAt(scene.routes, 0);
    route.lines.push({ ...newLine(counter('x'), 'nowhere', itemAt(route.points, 0).id) });
    route.lines.push({ ...newLine(counter('y'), itemAt(route.points, 1).id, itemAt(route.points, 1).id) });
    expect(checkScene(scene)).toMatchObject({
      ok: false,
      problems: [
        { path: 'routes[0].lines[2].from', rule: 'reference' },
        { path: 'routes[0].lines[3].to', rule: 'reference' },
      ],
    });
  });

  it('ids are unique across the scene, and of 1 to 256 characters', () => {
    const scene = chainScene();
    const route = itemAt(scene.routes, 0);
    itemAt(route.points, 1).id = itemAt(route.points, 0).id;
    route.id = 'r'.repeat(LIMITS.idLength + 1);
    const result = checkScene(scene);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map(({ path, rule }) => `${path} ${rule}`)).toEqual(
      expect.arrayContaining(['routes[0].id id', 'routes[0].points[1].id duplicate']),
    );
  });

  it('leadStart names a point of the route, or is null while the route has none', () => {
    const scene = chainScene();
    const route = itemAt(scene.routes, 0);
    route.leadStart = 'gone';
    const refused = { ok: false, problems: [{ path: 'routes[0].leadStart', rule: 'reference' }] };
    expect(checkScene(scene)).toMatchObject(refused);
    const empty = newScene(counter());
    itemAt(empty.routes, 0).leadStart = 'anything';
    expect(checkScene(empty)).toMatchObject(refused);
  });

  it('a mark names a point of the route, once for each kind; several starts, two-way lines and loops open (A1)', () => {
    const scene = chainScene();
    const route = itemAt(scene.routes, 0);
    const [a, c] = [itemAt(route.points, 0).id, itemAt(route.points, 2).id];
    route.marks.push({ point: a, end: 'start' }, { point: c, end: 'start' }, { point: c, end: 'end' });
    route.lines.push({ ...newLine(counter('l'), c, a), direction: 'both ways' });
    expect(checkScene(scene).ok).toBe(true);
    route.marks.push({ point: c, end: 'end' }, { point: 'gone', end: 'start' });
    expect(checkScene(scene)).toMatchObject({
      ok: false,
      problems: [
        { path: 'routes[0].marks[3]', rule: 'duplicate' },
        { path: 'routes[0].marks[4].point', rule: 'reference' },
      ],
    });
  });

  it('v3’s limits on counts and totals hold: routes, and a route’s pauses together', () => {
    const scene = newScene(counter());
    const route = itemAt(scene.routes, 0);
    scene.routes = Array.from({ length: LIMITS.routes + 1 }, (_, i) => ({ ...route, id: `route${i}` }));
    expect(checkScene(scene)).toMatchObject({ ok: false, problems: [{ path: 'routes', rule: 'count' }] });
    const paused = chainScene();
    for (const point of itemAt(paused.routes, 0).points) point.pauseMs = LIMITS.pauseMs;
    const stop = (i: number) => newPoint(counter(`p${i}-`), { x: 0, y: 0, kind: 'stop' });
    const many = Array.from({ length: 150 }, (_, i) => ({ ...stop(i), pauseMs: LIMITS.pauseMs }));
    itemAt(paused.routes, 0).points.push(...many);
    expect(checkScene(paused)).toMatchObject({ ok: false, problems: [{ path: 'routes[0].points', rule: 'total' }] });
  });

  it('an unknown field anywhere is reported, never kept or dropped silently (INTAKE.13)', () => {
    const scene = { ...chainScene(), extra: true, routes: [{ ...chainScene().routes[0], colourful: 1 }] };
    expect(checkScene(scene)).toMatchObject({
      ok: false,
      problems: [
        { path: 'extra', rule: 'unknown' },
        { path: 'routes[0].colourful', rule: 'unknown' },
      ],
    });
  });
});
