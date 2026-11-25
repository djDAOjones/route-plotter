// CORE-06: what the drawing commands make, Save keeps and Open gives back (v3's authorable-is-loadable,
// `authorableLoadable.test.js`). Any sequence of the store's drawing commands, from a route whose stops carry labels
// and pauses, gives after every step a project that `saveProject` saves and `openProject` opens to the same project.
// v3's two boundary cases, ported by their meaning: a point authored outside the image loads again
// (`authorableLoadable.test.js` :232: here the coordinates' own edges), and what the editor takes at the limit reopens
// (`networkBudget.test.js` :132: a path at its limit takes one more by the pen, and the project reopens with it). The
// limit (the stage plan's ruling 6): the binding one is Open's 100,000 values, measured by
// src/adapters/io/project.property.test.ts — 5,000 points with 10,000 lines save, 5,500 with 11,000 do not — so a
// scene at the model's own limits (10,000 points, 20,000 lines) is one the store accepts and Save refuses, in words.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodeHeader } from '../../adapters/io/fixtures';
import type { Project } from '../../adapters/io/format';
import { openProject } from '../../adapters/io/open';
import { saveProject } from '../../adapters/io/save';
import { LIMITS } from '../../core/config/limits';
import { newLine, newPoint, newRoute, newScene, type IdSource, type Route } from '../../core/model/scene';
import type { Command } from '../store/command';
import { createStore, type Store } from '../store/store';
import * as commands from './commands';

const RUNS = 100;

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}${String((n += 1))}`;
}

/** A store holding one route: `points` stops, labelled, the first three pausing, joined by one-way lines; a start marked. */
function storeOf(points: number, lines = points - 1): Store {
  const nextId = counter('seed');
  const made = Array.from({ length: points }, (_, i) => ({
    ...newPoint(nextId, { x: (i % 100) / 100, y: 0.5, kind: 'stop' }),
    label: `Stop ${String(i)} 🙂`,
    pauseMs: i < 3 ? 250 : 0,
  }));
  const joined = Array.from({ length: Math.max(0, lines) }, (_, l) => {
    const from = made[l % points]?.id ?? '';
    const to = made[(l + 1 + Math.floor(l / points)) % points]?.id ?? '';
    return newLine(nextId, from, to);
  });
  const first = made[0]?.id ?? null;
  const marks = first === null ? [] : [{ point: first, end: 'start' as const }];
  const route: Route = { ...newRoute(nextId), points: made, lines: joined, marks, leadStart: first };
  const project: Project = { scene: { ...newScene(nextId), routes: [route] }, images: [] };
  return createStore({ project, nextId: counter('new') });
}

const routeIn = (store: Store): Route => {
  const route = store.getState().project.scene.routes[0];
  if (route === undefined) throw new Error('no route');
  return route;
};

/** The project saved and opened again, or why either refused. */
async function reopened(project: Project) {
  const saved = await saveProject(project, decodeHeader);
  if (!saved.ok) return saved;
  return openProject(saved.bytes, decodeHeader);
}

const at = fc.nat(30);
const ats = fc.array(at, { maxLength: 3 });
const coordinateOf = fc.oneof(
  fc.constantFrom(LIMITS.coordinateMin, LIMITS.coordinateMax),
  fc.double({ min: LIMITS.coordinateMin, max: LIMITS.coordinateMax, noNaN: true }).map((value) => value + 0),
);
const placeOf = fc.record({ x: coordinateOf, y: coordinateOf, kind: fc.constantFrom('stop' as const, 'bend' as const) });
const shiftOf = fc.oneof(fc.constant(0), fc.double({ min: -1, max: 1, noNaN: true }).map((value) => value + 0));
const endOf = fc.constantFrom('start' as const, 'end' as const);

const intentOf = fc.oneof(
  fc.record({ c: fc.constant('add' as const), place: placeOf }),
  fc.record({ c: fc.constant('pen' as const), target: fc.oneof(fc.record({ place: placeOf }), fc.record({ point: at })) }),
  fc.record({ c: fc.constant('join' as const), from: at, to: at }),
  fc.record({ c: fc.constant('direction' as const), line: at, to: fc.constantFrom('one way' as const, 'both ways' as const) }),
  fc.record({ c: fc.constant('reverse' as const), line: at }),
  fc.record({ c: fc.constant('leadStart' as const), point: at }),
  fc.record({ c: fc.constant('mark' as const), point: at, end: endOf }),
  fc.record({ c: fc.constant('unmark' as const), point: at, end: endOf }),
  fc.record({ c: fc.constant('kind' as const), point: at, kind: fc.constantFrom('stop' as const, 'bend' as const) }),
  fc.record({ c: fc.constant('delete' as const), points: ats }),
  fc.record({ c: fc.constant('deleteLine' as const), line: at }),
  fc.record({ c: fc.constant('split' as const), line: at, place: placeOf }),
  fc.record({ c: fc.constant('move' as const), points: ats, dx: shiftOf, dy: shiftOf }),
  fc.record({ c: fc.constant('duplicate' as const), points: ats }),
);
type Intent = typeof intentOf extends fc.Arbitrary<infer T> ? T : never;

const idAt = (items: readonly { readonly id: string }[], i: number) => items[i % Math.max(1, items.length)]?.id ?? 'none';

/** The store's command for `intent`, its targets taken from what the route holds now. */
function commandFor(store: Store, intent: Intent): Command {
  const route = routeIn(store);
  const point = (i: number) => idAt(route.points, i);
  const line = (i: number) => idAt(route.lines, i);
  const r = route.id;
  switch (intent.c) {
    case 'add':
      return commands.addPoint(r, intent.place);
    case 'pen': {
      const pen = store.getState().selection.points.at(-1) ?? null;
      const { target } = intent;
      return commands.penStep(r, pen, 'place' in target ? target : { point: point(target.point) });
    }
    case 'join':
      return commands.joinPoints(r, point(intent.from), point(intent.to));
    case 'direction':
      return commands.setDirection(r, line(intent.line), intent.to);
    case 'reverse':
      return commands.reverseLine(r, line(intent.line));
    case 'leadStart':
      return commands.setLeadStart(r, point(intent.point));
    case 'mark':
      return commands.markPoint(r, point(intent.point), intent.end);
    case 'unmark':
      return commands.unmarkPoint(r, point(intent.point), intent.end);
    case 'kind':
      return commands.setKind(r, point(intent.point), intent.kind);
    case 'delete':
      return commands.deletePoints(r, intent.points.map(point));
    case 'deleteLine':
      return commands.deleteLine(r, line(intent.line));
    case 'split':
      return commands.splitLine(r, line(intent.line), intent.place);
    case 'move':
      return commands.movePoints(r, intent.points.map(point), intent.dx, intent.dy);
    case 'duplicate':
      return commands.duplicatePoints(r, intent.points.map(point));
  }
}

describe('what the drawing commands make, Save keeps and Open gives back', () => {
  it('any sequence of drawing commands gives, after every step, a project that saves and opens the same', async () => {
    const stepped = new Set<Intent['c']>();
    await fc.assert(
      fc.asyncProperty(fc.array(intentOf, { minLength: 1, maxLength: 20, size: 'max' }), async (intents) => {
        const store = storeOf(4);
        for (const intent of intents) {
          const outcome = store.dispatch(commandFor(store, intent));
          if (outcome.ok && outcome.changed) stepped.add(intent.c);
          const { project } = store.getState();
          expect(await reopened(project)).toEqual({ ok: true, project });
        }
      }),
      { numRuns: RUNS },
    );
    // Every command made a step at least once, so the property cannot pass by refusing them all.
    expect(stepped.size).toBe(14);
  });

  it('a point at the coordinates’ edges, outside the image, saves and opens again (v3 authorableLoadable :232)', async () => {
    const store = storeOf(2);
    for (const place of [
      { x: LIMITS.coordinateMin, y: LIMITS.coordinateMax, kind: 'stop' as const },
      { x: LIMITS.coordinateMax, y: LIMITS.coordinateMin, kind: 'bend' as const },
    ])
      expect(store.dispatch(commands.penStep(routeIn(store).id, null, { place })).ok).toBe(true);
    const { project } = store.getState();
    expect(routeIn(store).points.slice(-2).map((p) => [p.x, p.y])).toEqual([
      [LIMITS.coordinateMin, LIMITS.coordinateMax],
      [LIMITS.coordinateMax, LIMITS.coordinateMin],
    ]);
    expect(await reopened(project)).toEqual({ ok: true, project });
  });

  it('a route of 5,000 points with 10,000 lines takes one more by the pen, and reopens with it (v3 networkBudget :132)', async () => {
    const store = storeOf(5_000, 10_000);
    const last = routeIn(store).points.at(-1)?.id ?? null;
    expect(store.dispatch(commands.penStep(routeIn(store).id, last, { place: { x: 0.5, y: 0.9, kind: 'stop' } }))).toEqual({
      ok: true,
      changed: true,
    });
    expect(routeIn(store).points).toHaveLength(5_001);
    expect(routeIn(store).lines).toHaveLength(10_001);
    const { project } = store.getState();
    expect(await reopened(project)).toEqual({ ok: true, project });
  });

  it('a route at the model’s own limits takes a command, which the store accepts, and Save refuses it in words', async () => {
    const store = storeOf(LIMITS.points, LIMITS.lines);
    const route = routeIn(store);
    expect(store.dispatch(commands.setKind(route.id, route.points[1]?.id ?? '', 'bend'))).toEqual({ ok: true, changed: true });
    // As the existing test expects: too large. With every stop labelled, the file's 2 MB binds before the 100,000 values.
    const saved = await saveProject(store.getState().project, decodeHeader);
    expect(saved).toMatchObject({ ok: false, refusal: { reason: 'too-large' } });
    if (!saved.ok) expect(saved.refusal.message).toMatch(/^This project is too large to save: .* Nothing was saved\.$/);
  });
});
