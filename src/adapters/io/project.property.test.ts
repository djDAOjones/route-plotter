// CORE-03: Save and Open's properties (brief 17, proof 6). Every value is drawn from the core's own declarations, as
// src/core/model/scene.property.test.ts draws them, so a field added there is covered here without a change; the shape
// (ids, the lines' points, leadStart) is drawn here. Two properties: open after save gives the same project; open then
// save is stable near the limits (CROWD-08.7). And the limits themselves, measured: the binding one is Open's 100,000
// values (v3's MAX_TREE_NODES), about 5,000 points with 10,000 lines, so the core's own counts (10,000 points, 20,000
// lines) cannot be saved; Save refuses such a scene in words, and never writes a file Open would refuse.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../core/config/limits';
import { LINE_FIELDS, POINT_FIELDS, ROUTE_FIELDS, SCENE, checkScene, newLine, newPoint, newRoute, newScene } from '../../core/model/scene';
import type { Scene } from '../../core/model/scene';
import type { Field, Fields } from '../../core/schema/field';
import { decodeHeader, jpeg, png, webpLossy } from './fixtures';
import type { Project } from './format';
import { openProject } from './open';
import { saveProject } from './save';

const RUNS = 60;
const NEAR_RUNS = 6;

/** Any UTF-16 unit, a lone surrogate included, or an emoji: JSON.stringify escapes a lone one, so it saves whole. */
const unit = fc.oneof(fc.integer({ min: 0, max: 0xffff }).map((code) => String.fromCharCode(code)), fc.constant('🙂'));

/** A text up to its full length, mostly short, now and then exactly at `maxLength`; short only, when `full` is false. */
function textOf(maxLength: number, full: boolean): fc.Arbitrary<string> {
  if (!full) return fc.string({ unit, maxLength: 40 });
  const whole = fc.string({ unit, minLength: 1, maxLength: 3 }).map((part) => part.repeat(maxLength).slice(0, maxLength));
  return fc.oneof({ arbitrary: fc.string({ unit, maxLength: 40 }), weight: 30 }, { arbitrary: whole, weight: 1 });
}

const colourOf = fc.integer({ min: 0, max: 0xffffff }).map((rgb) => `#${rgb.toString(16).padStart(6, '0')}`);

/** Any value the field accepts. JSON has no -0, so a drawn -0 is 0: the same place, the same setting. */
function valueOf(field: Field, full: boolean): fc.Arbitrary<unknown> | null {
  switch (field.kind) {
    case 'number':
      return field.integer
        ? fc.integer({ min: Math.ceil(field.min), max: Math.floor(field.max) })
        : fc.double({ min: field.min, max: field.max, noNaN: true, noDefaultInfinity: true }).map((value) => value + 0);
    case 'boolean':
      return fc.boolean();
    case 'choice':
      return fc.constantFrom(...field.choices);
    case 'colour':
      return colourOf;
    case 'text':
      return textOf(field.maxLength, full);
    case 'group':
      return valuesOf(field.of, full);
    default:
      return null;
  }
}

function valuesOf(fields: Fields, full = true): fc.Arbitrary<Record<string, unknown>> {
  const drawn = Object.entries(fields).flatMap(([name, field]) => {
    const value = valueOf(field, full);
    return value === null ? [] : [[name, value] as const];
  });
  return fc.record(Object.fromEntries(drawn));
}

/** A route of up to eight points joined by lines between distinct points. */
function routeOf(r: number) {
  return fc.integer({ min: 0, max: 8 }).chain((size) => {
    const ids = Array.from({ length: size }, (_, p) => `r${r}p${p}`);
    const index = fc.integer({ min: 0, max: Math.max(0, size - 1) });
    const pair = fc.tuple(index, index).filter(([a, b]) => a !== b);
    const kinds = ROUTE_FIELDS.marks.of.end.choices;
    const lines = fc.array(fc.tuple(pair, valuesOf(LINE_FIELDS)), { maxLength: 12 }).map((drawn) =>
      drawn.map(([[a, b], values], l) => ({ id: `r${r}l${l}`, from: `r${r}p${a}`, to: `r${r}p${b}`, ...values })),
    );
    return fc.record({
      id: fc.constant(`r${r}`),
      points: fc.tuple(...ids.map((id) => valuesOf(POINT_FIELDS).map((values) => ({ id, ...values })))),
      lines: size < 2 ? fc.constant([]) : lines,
      marks: fc.subarray(ids.flatMap((point) => kinds.map((end) => ({ point, end })))),
      leadStart: size === 0 ? fc.constant(null) : fc.constantFrom(...ids),
      settings: valuesOf(ROUTE_FIELDS.settings.of),
    });
  });
}

const sceneOf = fc.integer({ min: 0, max: LIMITS.routes }).chain((count) =>
  fc.record({
    routes: fc.tuple(...Array.from({ length: count }, (_, r) => routeOf(r))),
    settings: valuesOf(SCENE.of.settings.of),
  }),
);

/** Up to three images, one of each type the format allows, at small sizes. */
const imagesOf = fc
  .array(fc.tuple(fc.constantFrom(0, 1, 2), fc.integer({ min: 1, max: 64 }), fc.integer({ min: 1, max: 64 })), { maxLength: 3 })
  .map((drawn) =>
    drawn.map(([kind, width, height], index) =>
      kind === 0
        ? { id: `image${index}`, type: 'image/png' as const, bytes: png(width, height) }
        : kind === 1
          ? { id: `image${index}`, type: 'image/jpeg' as const, bytes: jpeg(width, height) }
          : { id: `image${index}`, type: 'image/webp' as const, bytes: webpLossy(width, height) },
    ),
  );

/**
 * A scene of 32 routes holding `points` points and `lines` lines between them, every value at its default, then the
 * settings of each route, point and line taken in turn from the drawn ones.
 */
function sceneAt(points: number, lines: number, drawn?: { route: object[]; point: object[]; line: object[] }): Scene {
  let next = 0;
  const nextId = () => `i${++next}`;
  const scene = newScene(nextId);
  while (scene.routes.length < LIMITS.routes) scene.routes.push(newRoute(nextId));
  const pick = <T,>(list: readonly T[] | undefined, at: number) => (list === undefined ? undefined : list[at % list.length]);
  scene.routes.forEach((route, r) => {
    const count = Math.floor(points / LIMITS.routes) + (r < points % LIMITS.routes ? 1 : 0);
    Object.assign(route.settings, pick(drawn?.route, r));
    for (let p = 0; p < count; p += 1) {
      route.points.push({ ...newPoint(nextId, { x: (p % 100) / 100, y: r / LIMITS.routes, kind: 'stop' }), ...pick(drawn?.point, p) });
    }
    route.leadStart = route.points[0]?.id ?? null;
    const want = Math.floor(lines / LIMITS.routes) + (r < lines % LIMITS.routes ? 1 : 0);
    for (let l = 0; l < want && count > 2; l += 1) {
      const from = route.points[l % count];
      const to = route.points[(l + 1 + Math.floor(l / count)) % count];
      if (from !== undefined && to !== undefined && from !== to) route.lines.push({ ...newLine(nextId, from.id, to.id), ...pick(drawn?.line, l) });
    }
  });
  return scene;
}

async function saved(project: Project): Promise<Uint8Array> {
  const result = await saveProject(project, decodeHeader);
  if (!result.ok) throw new Error(result.refusal.message);
  return result.bytes;
}

describe('Save and Open’s properties', () => {
  it('open after save gives the same project, or Save refuses it as too large and writes nothing', async () => {
    let opened = 0;
    await fc.assert(
      fc.asyncProperty(sceneOf, imagesOf, async (scene, images) => {
        const checked = checkScene(scene);
        if (!checked.ok) throw new Error('the schema refused a drawn scene');
        const project = { scene: checked.value, images };
        const result = await saveProject(project, decodeHeader);
        if (!result.ok) {
          expect(result.refusal.reason).toBe('too-large');
          return;
        }
        expect(await openProject(result.bytes, decodeHeader)).toEqual({ ok: true, project });
        opened += 1;
      }),
      { numRuns: RUNS },
    );
    expect(opened).toBeGreaterThan(RUNS / 2);
  });

  it('open then save is stable near the limits: the same project and the same bytes (CROWD-08.7)', async () => {
    const drawn = fc.record({
      route: fc.array(valuesOf(ROUTE_FIELDS.settings.of, false), { minLength: 1, maxLength: 4 }),
      point: fc.array(valuesOf(POINT_FIELDS, false), { minLength: 1, maxLength: 8 }),
      line: fc.array(valuesOf(LINE_FIELDS, false), { minLength: 1, maxLength: 8 }),
    });
    await fc.assert(
      fc.asyncProperty(drawn, fc.integer({ min: 4_000, max: 4_600 }), async (values, points) => {
        const project = { scene: sceneAt(points, points * 2, values), images: [{ id: 'map', type: 'image/png' as const, bytes: png(8192, 2048) }] };
        const first = await saved(project);
        const opened = await openProject(first, decodeHeader);
        expect(opened).toEqual({ ok: true, project });
        if (!opened.ok) return;
        expect(await saved(opened.project)).toEqual(first);
      }),
      { numRuns: NEAR_RUNS },
    );
  }, 60_000);

  it('saves and opens 5,000 points with 10,000 lines, at every default, in 32 routes', async () => {
    const project = { scene: sceneAt(5_000, 10_000), images: [] };
    expect(await openProject(await saved(project), decodeHeader)).toEqual({ ok: true, project });
  });

  it('refuses, as too large and in words, what Open would refuse: 5,500 points with 11,000 lines hold over 100,000 values', async () => {
    expect(await saveProject({ scene: sceneAt(5_500, 11_000), images: [] }, decodeHeader)).toEqual({
      ok: false,
      refusal: { reason: 'too-large', message: 'This project is too large to save: it holds more than 100,000 values. Nothing was saved.' },
    });
  });

  it('refuses the core’s own limits, 10,000 points with 20,000 lines, as too large to save', async () => {
    const result = await saveProject({ scene: sceneAt(LIMITS.points, LIMITS.lines), images: [] }, decodeHeader);
    expect(result).toMatchObject({ ok: false, refusal: { reason: 'too-large' } });
  });
});
