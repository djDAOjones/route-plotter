// CORE-01: the model's examples, the held lines INTAKE.29 and DEF-20.2, what no declaration says, and v3's limits at
// their boundaries. Every field the scene declares is found by walking its declarations, so a field added to one is
// covered here without this file changing.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../config/limits';
import { isList, isRecord, type Fields, type NumberField } from '../schema/field';
import { checkScene } from './checkScene';
import { SCENE_FIELDS, newLine, newPoint, newRoute, newScene, type Scene } from './scene';

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

/** A route of three stops, A→B→C, its lead starting at A, A marked as a start. */
function chainScene(): Scene {
  const nextId = counter();
  const scene = newScene(nextId);
  const route = itemAt(scene.routes, 0);
  const [a, b, c] = [0.1, 0.5, 0.9].map((x) => newPoint(nextId, { x, y: 0.5, kind: 'stop' }));
  if (!a || !b || !c) throw new Error('three points');
  route.points.push(a, b, c);
  route.lines.push(newLine(nextId, a.id, b.id), newLine(nextId, b.id, c.id));
  route.marks.push({ point: a.id, end: 'start' });
  route.leadStart = a.id;
  return scene;
}

/** Routes of `points[r]` bends each, with `lines[r]` lines between their first two points. */
function sized(points: readonly number[], lines: readonly number[] = []): Scene {
  const nextId = counter();
  const scene = newScene(nextId);
  scene.routes = points.map((count, r) => {
    const route = newRoute(nextId);
    route.points = Array.from({ length: count }, () => newPoint(nextId, { x: 0, y: 0, kind: 'bend' }));
    const [a, b] = route.points;
    if (a && b) route.lines = Array.from({ length: lines[r] ?? 0 }, () => newLine(nextId, a.id, b.id));
    route.leadStart = a?.id ?? null;
    return route;
  });
  return scene;
}

/** Each problem as `path rule`, or `opens` when there is none. */
function rulesBroken(value: unknown): string[] {
  const result = checkScene(value);
  return result.ok ? ['opens'] : result.problems.map(({ path, rule }) => `${path} ${rule}`);
}

const join = (where: string, name: string) => (where === '' ? name : `${where}.${name}`);

/** Every group of fields the scene declares, with where its first one sits in a chain scene. */
function groupsIn(fields: Fields, where: string): [string, Fields][] {
  const inner = Object.entries(fields).flatMap(([name, field]) => {
    if (field.kind === 'list') return groupsIn(field.of, `${join(where, name)}[0]`);
    return field.kind === 'group' ? groupsIn(field.of, join(where, name)) : [];
  });
  return [[where, fields], ...inner];
}

const numberFields = groupsIn(SCENE_FIELDS, '').flatMap(([where, fields]) =>
  Object.entries(fields)
    .filter((entry): entry is [string, NumberField] => entry[1].kind === 'number')
    .map(([name, field]) => ({ where, name, field })),
);

/** What a chain scene opens as, with one field set to `value` where the field sits. */
function placed(where: string, name: string, value: number): string[] {
  const scene = chainScene();
  let at: unknown = scene;
  for (const step of where.split(/[.[\]]+/).filter((part) => part !== '')) {
    at = isList(at) ? at[Number(step)] : isRecord(at) ? at[step] : undefined;
  }
  if (typeof at !== 'object' || at === null) throw new Error(`nothing at ${where}`);
  Object.assign(at, { [name]: value });
  return rulesBroken(scene);
}

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

  it('a chain of three stops opens as it was made, as a copy', () => {
    const scene = chainScene();
    const result = checkScene(scene);
    expect(result).toEqual({ ok: true, value: scene });
    expect(result.ok && result.value).not.toBe(scene);
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

  it.each(numberFields)('DEF-20.2: $where.$name opens exactly within its control’s range', ({ where, name, field }) => {
    expect(placed(where, name, field.min)).toEqual(['opens']);
    expect(placed(where, name, field.max)).toEqual(['opens']);
    const below = field.min - Math.max(1, Math.abs(field.min)) * 1e-6;
    const above = field.max + Math.max(1, Math.abs(field.max)) * 1e-6;
    for (const value of [below, above]) expect(placed(where, name, value)).toEqual([`${join(where, name)} range`]);
    for (const value of [Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(placed(where, name, value)).toEqual([`${join(where, name)} type`]);
    }
  });

  it('DEF-20.2: any number pushed past its range, wherever it sits, is refused, the report naming that field', () => {
    const distance = fc.double({ min: 1e-6, max: 1e9, noNaN: true });
    fc.assert(
      fc.property(fc.constantFrom(...numberFields), fc.boolean(), distance, ({ where, name, field }, up, by) => {
        const past = (end: number) => by * Math.max(1, Math.abs(end));
        const value = up ? field.max + past(field.max) : field.min - past(field.min);
        expect(placed(where, name, value)).toEqual([`${join(where, name)} range`]);
      }),
      { numRuns: 100 },
    );
  });
});

describe('the scene’s shape: ids, references, lists', () => {
  it('a line joins two points of its own route, never a point to itself', () => {
    const scene = chainScene();
    const route = itemAt(scene.routes, 0);
    const [a, b] = [itemAt(route.points, 0).id, itemAt(route.points, 1).id];
    route.lines.push(newLine(counter('x'), 'nowhere', a));
    expect(rulesBroken(scene)).toEqual(['routes[0].lines[2].from reference']);
    const other = newRoute(counter('r'));
    other.points.push(newPoint(counter('q'), { x: 0, y: 0, kind: 'stop' }));
    other.leadStart = itemAt(other.points, 0).id;
    scene.routes.push(other);
    route.lines[2] = newLine(counter('x'), a, itemAt(other.points, 0).id);
    expect(rulesBroken(scene)).toEqual(['routes[0].lines[2].to reference']);
    route.lines[2] = newLine(counter('x'), b, b);
    expect(checkScene(scene)).toMatchObject({
      ok: false,
      problems: [
        { path: 'routes[0].lines[2].to', rule: 'reference', expected: 'a point other than the line’s `from`' },
      ],
    });
  });

  it('ids are unique across the whole scene, and of 1 to 256 characters', () => {
    const scene = chainScene();
    const route = itemAt(scene.routes, 0);
    const twin = newRoute(counter('r'));
    twin.points.push({ ...newPoint(counter('q'), { x: 0, y: 0, kind: 'bend' }), id: itemAt(route.lines, 0).id });
    twin.leadStart = itemAt(route.lines, 0).id;
    scene.routes.push(twin);
    route.id = 'r'.repeat(LIMITS.idLength + 1);
    expect(rulesBroken(scene)).toEqual(['routes[0].id id', 'routes[1].points[0].id duplicate']);
  });

  it('leadStart names a point of its route, and is null exactly while the route has none', () => {
    const scene = chainScene();
    const route = itemAt(scene.routes, 0);
    for (const leadStart of ['gone', null]) {
      route.leadStart = leadStart;
      expect(rulesBroken(scene)).toEqual(['routes[0].leadStart reference']);
    }
    const empty = newScene(counter());
    itemAt(empty.routes, 0).leadStart = 'anything';
    expect(rulesBroken(empty)).toEqual(['routes[0].leadStart reference']);
  });

  it('a mark names a point of its route, once for each kind; several starts, two-way lines and loops open (A1)', () => {
    const scene = chainScene();
    const route = itemAt(scene.routes, 0);
    const [a, c] = [itemAt(route.points, 0).id, itemAt(route.points, 2).id];
    route.marks.push({ point: c, end: 'start' }, { point: c, end: 'end' });
    route.lines.push({ ...newLine(counter('l'), c, a), direction: 'both ways' });
    expect(rulesBroken(scene)).toEqual(['opens']);
    route.marks.push({ point: 'gone', end: 'start' });
    expect(rulesBroken(scene)).toEqual(['routes[0].marks[3].point reference']);
    route.marks[3] = { point: c, end: 'end' };
    expect(rulesBroken(scene)).toEqual(['routes[0].marks[3] duplicate']);
  });

  it('an unknown field anywhere is reported, never kept or dropped silently (INTAKE.13)', () => {
    const scene = { ...chainScene(), extra: true, routes: [{ ...chainScene().routes[0], colourful: 1 }] };
    expect(rulesBroken(scene)).toEqual(['routes[0].colourful unknown', 'extra unknown']);
  });

  it('only the scene’s own fields are read: an inherited scene or id is refused, a hole in a list reported', () => {
    const whole = { ok: false, problems: [{ path: '', rule: 'type' }] };
    expect(checkScene(Object.create(chainScene()))).toMatchObject(whole);
    const scene = chainScene();
    const { id, ...rest } = itemAt(scene.routes, 0);
    const inherits: unknown = Object.create({ id }, Object.getOwnPropertyDescriptors(rest));
    expect(rulesBroken({ ...scene, routes: [inherits] })).toEqual(['routes[0] type']);
    const holed = chainScene();
    holed.routes.length = 2;
    expect(rulesBroken(holed)).toEqual(['routes[1] missing']);
  });
});

describe('v3’s limits on counts and totals, at each boundary: the limit opens, one past is refused', () => {
  it(`routes in a scene: ${LIMITS.routes}`, () => {
    expect(rulesBroken(sized(Array.from({ length: LIMITS.routes }, () => 1)))).toEqual(['opens']);
    expect(rulesBroken(sized(Array.from({ length: LIMITS.routes + 1 }, () => 1)))).toEqual(['routes count']);
  });

  it(`points in all routes together: ${LIMITS.points}`, () => {
    const half = LIMITS.points / 2;
    expect(rulesBroken(sized([half, half]))).toEqual(['opens']);
    const expected = 'at most 10000 points in all';
    const refused = { ok: false, problems: [{ path: 'routes', rule: 'count', expected }] };
    expect(checkScene(sized([half, half + 1]))).toMatchObject(refused);
    expect(rulesBroken(sized([LIMITS.points + 1]))).toEqual(['routes[0].points count']);
  });

  it(`lines in all routes together: ${LIMITS.lines}`, () => {
    const half = LIMITS.lines / 2;
    expect(rulesBroken(sized([2, 2], [half, half]))).toEqual(['opens']);
    const expected = 'at most 20000 lines in all';
    const refused = { ok: false, problems: [{ path: 'routes', rule: 'count', expected }] };
    expect(checkScene(sized([2, 2], [half, half + 1]))).toMatchObject(refused);
    expect(rulesBroken(sized([2], [LIMITS.lines + 1]))).toEqual(['routes[0].lines count']);
  });

  it(`a route’s stops’ pauses together: ${LIMITS.routePausesMs} ms, a bend’s pause not counted`, () => {
    const scene = sized([LIMITS.routePausesMs / LIMITS.pauseMs + 1]);
    const [bend, ...stops] = itemAt(scene.routes, 0).points;
    for (const point of stops) Object.assign(point, { kind: 'stop', pauseMs: LIMITS.pauseMs });
    Object.assign(bend ?? {}, { pauseMs: LIMITS.pauseMs });
    expect(rulesBroken(scene)).toEqual(['opens']);
    Object.assign(bend ?? {}, { kind: 'stop', pauseMs: 1 });
    expect(rulesBroken(scene)).toEqual(['routes[0].points total']);
  });

  it(`marks on a route: at most ${2 * LIMITS.points}, one of each kind on each point`, () => {
    const scene = sized([1]);
    const route = itemAt(scene.routes, 0);
    route.marks = Array.from({ length: 2 * LIMITS.points + 1 }, () => ({ point: route.leadStart ?? '', end: 'start' }));
    expect(rulesBroken(scene)).toEqual(['routes[0].marks count']);
  });
});
