// CORE-02: a route's shape by runs within one budget (§6, INTAKE.12), the allowance for animation that cycles, and the
// scene's length under §4, with v3's Hold at end numbers ported.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CLOCK_SETTINGS } from '../config/settings';
import { calculatePath } from '../geometry/path';
import { newLine, newPoint, newRoute, newScene, type IdSource, type Route, type Scene } from '../model/scene';
import { cycleAllowanceMs, contentEndMs, sceneLength } from './sceneLength';
import { routeShape } from './shape';
import { leadWalk } from './walk';

const counter = (): IdSource => {
  let n = 0;
  return () => `id${(n += 1)}`;
};

/** A route from line specs (`A>B` one way, `A-B` both ways), each line's id its spec, its points on a zig-zag. */
function routeOf(specs: readonly string[]): Route {
  const nextId = counter();
  const route = newRoute(nextId);
  const lines = specs.map((spec) => {
    const [from = '', to = ''] = spec.split(/[>-]/);
    const direction = spec.includes('>') ? ('one way' as const) : ('both ways' as const);
    return { ...newLine(nextId, from, to), id: spec, direction };
  });
  const ids = [...new Set(lines.flatMap((line) => [line.from, line.to]))];
  const points = ids.map((id, i) => ({ ...newPoint(nextId, { x: i / 8, y: i % 2 === 0 ? 0.3 : 0.6, kind: 'stop' }), id }));
  return { ...route, points, lines, leadStart: ids[0] ?? null };
}

const shapeOf = (route: Route, aspect = 0.75, budget?: number) => routeShape(route, leadWalk(route), aspect, budget);
const placesOf = (route: Route, ids: readonly string[]) =>
  ids.map((id) => route.points.find((point) => point.id === id) ?? { x: Number.NaN, y: Number.NaN });

describe('a route’s shape, run by run (§6)', () => {
  it('a chain of stops is one curve through them all, as v3 draws its route', () => {
    const route = routeOf(['a>b', 'b>c', 'c>d']);
    const path = calculatePath(placesOf(route, ['a', 'b', 'c', 'd']), 0.75);
    const shapes = shapeOf(route);
    const [k0, k1, k2, k3] = path.knots;
    expect(shapes.get('a>b')?.samples).toEqual(path.points.slice(k0, (k1 ?? 0) + 1));
    expect(shapes.get('b>c')?.samples).toEqual(path.points.slice(k1, (k2 ?? 0) + 1));
    expect(shapes.get('c>d')?.samples).toEqual(path.points.slice(k2, (k3 ?? 0) + 1));
    const widths = [...shapes.values()].reduce((sum, shape) => sum + shape.lengthWidths, 0);
    expect(widths).toBeCloseTo(path.length, 9);
  });

  it('the lead’s start, a fork and a join begin or end a run: a fork that rejoins (§3)', () => {
    const route = routeOf(['A>B', 'B>C', 'B>D', 'C>E', 'D>E', 'E>F']);
    const shapes = shapeOf(route);
    expect(shapes.get('A>B')?.samples).toEqual(calculatePath(placesOf(route, ['A', 'B']), 0.75).points);
    const upper = calculatePath(placesOf(route, ['B', 'C', 'E']), 0.75);
    expect(shapes.get('B>C')?.samples.at(-1)).toEqual(upper.points[upper.knots[1] ?? 0]);
    expect(shapes.get('E>F')?.samples).toEqual(calculatePath(placesOf(route, ['E', 'F']), 0.75).points);
  });

  it('a line the lead leaves out is a run of its own, in its saved direction: a loop (§3)', () => {
    const route = routeOf(['A>B', 'B>C', 'C>D', 'D>B']);
    expect(shapeOf(route).get('D>B')?.samples).toEqual(calculatePath(placesOf(route, ['D', 'B']), 0.75).points);
  });

  it('INTAKE.12: never passes the route’s budget, however many runs it has', () => {
    const chains = fc.array(fc.integer({ min: 1, max: 40 }), { minLength: 1, maxLength: 30 });
    fc.assert(
      fc.property(chains, (lengths) => {
        const specs = lengths.flatMap((length, c) =>
          Array.from({ length }, (_, i) => `${i === 0 ? 's' : `c${c}p${i}`}>c${c}p${i + 1}`),
        );
        const budget = 2 * specs.length;
        const shapes = [...shapeOf(routeOf(specs), 0.75, budget).values()];
        const samples = shapes.reduce((sum, shape) => sum + shape.samples.length - 1, 0) + lengths.length;
        expect(samples).toBeLessThanOrEqual(budget);
      }),
    );
  });
});

describe('the allowance for animation that cycles (§4): every line a dot can reach, once, at its speed', () => {
  const route = routeOf(['A>B', 'B>C', 'C>A', 'D>E', 'F>A', 'C-G']);
  const widthsOf = (ids: readonly string[]) =>
    ids.reduce((sum, id) => sum + (shapeOf(route, 1).get(id)?.lengthWidths ?? 0), 0);

  it('covers a loop and a two-way line once, and leaves out what the dots cannot reach', () => {
    const expected = (widthsOf(['A>B', 'B>C', 'C>A', 'C-G']) / 0.25) * 1_000;
    expect(cycleAllowanceMs(route, 1, 0.25, ['A'])).toBeCloseTo(expected, 9);
    expect(cycleAllowanceMs(route, 1, 0.25, ['D'])).toBeCloseTo((widthsOf(['D>E']) / 0.25) * 1_000, 9);
  });

  it('is finite on a loop, and a speed that moves nothing asks for no time', () => {
    expect(Number.isFinite(cycleAllowanceMs(route, 1, 0.001, ['B']))).toBe(true);
    for (const speed of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(cycleAllowanceMs(route, 1, speed, ['A'])).toBe(0);
    }
  });
});

/** A scene whose routes' leads each walk one line in a total time, from a start time, with no pause at the end. */
function sceneOf(leads: readonly { readonly totalTimeMs: number; readonly startsAtMs?: number }[], end = 0): Scene {
  const nextId = counter();
  const scene = newScene(nextId);
  const routes = leads.map(({ totalTimeMs, startsAtMs = 0 }) => {
    const route = newRoute(nextId);
    const a = newPoint(nextId, { x: 0.1, y: 0.5, kind: 'stop' });
    const b = { ...newPoint(nextId, { x: 0.7, y: 0.5, kind: 'stop' }), pauseMs: end };
    const lead = { ...route.settings.lead, timing: 'total time' as const, totalTimeMs, startsAtMs };
    const lines = [newLine(nextId, a.id, b.id)];
    return { ...route, points: [a, b], lines, leadStart: a.id, settings: { ...route.settings, lead } };
  });
  return { ...scene, routes };
}

const withClock = (scene: Scene, clock: Partial<Scene['settings']['clock']>): Scene => ({
  ...scene,
  settings: { ...scene.settings, clock: { ...scene.settings.clock, holdAtStartMs: 0, ...clock } },
});

describe('the scene’s length (§4, T1)', () => {
  it('runs to the latest lead’s end, plus Hold at start and Hold at end', () => {
    const scene = sceneOf([{ totalTimeMs: 12_000 }, { totalTimeMs: 3_000, startsAtMs: 5_000 }]);
    expect(contentEndMs(scene, 0.75)).toBe(12_000);
    expect(sceneLength(withClock(scene, { holdAtStartMs: 500, holdAtEndMs: 2_000 }), 0.75)).toBe(14_500);
  });

  it('v3’s numbers: 12,000 ms and Hold at end of 2,500 is 14,500; Hold at end at its most, 10 s, is 22,000', () => {
    // v3/tests/holdAtEnd.test.js:325, :330 and sceneEnd.test.js:267–268; v3 clamped Hold at end to 10 s, and v4's
    // field refuses more at open (CORE-01).
    const scene = sceneOf([{ totalTimeMs: 12_000 }]);
    expect(sceneLength(withClock(scene, { holdAtEndMs: 2_500 }), 0.75)).toBe(14_500);
    expect(CLOCK_SETTINGS.holdAtEndMs.max).toBe(10_000);
    expect(sceneLength(withClock(scene, { holdAtEndMs: 10_000 }), 0.75)).toBe(22_000);
  });

  it('counts the lead’s pause at its last stop: it ends when its last pause there is over', () => {
    expect(contentEndMs(sceneOf([{ totalTimeMs: 12_000 }], 1_500), 0.75)).toBe(13_500);
  });

  it('runs to a part that finishes, when it finishes last', () => {
    expect(contentEndMs(sceneOf([{ totalTimeMs: 12_000 }]), 0.75, [{ endsAtMs: 20_000 }])).toBe(20_000);
  });
});

describe('the bound on animation that cycles: the grace period and the author’s fixed length', () => {
  const crowd = routeOf(['A>B', 'B>C', 'C>A']);
  const allowanceMs = cycleAllowanceMs(crowd, 0.75, 0.1, ['A']);

  it('a cycling part lasts its release end plus its allowance', () => {
    const scene = sceneOf([{ totalTimeMs: 4_000 }]);
    const parts = [{ cycles: { releaseEndMs: 9_000, allowanceMs } }];
    expect(contentEndMs(scene, 0.75, parts)).toBeCloseTo(9_000 + allowanceMs, 9);
  });

  it('a scene of only cycling animation is that long, unless the author fixes a length, which cuts it', () => {
    const empty = newScene(counter());
    const parts = [{ cycles: { releaseEndMs: 3_000, allowanceMs: 4_000 } }];
    expect(sceneLength(withClock(empty, { holdAtEndMs: 0 }), 0.75, parts)).toBe(7_000);
    expect(sceneLength(withClock(empty, { length: 'fixed', fixedLengthMs: 5_000 }), 0.75, parts)).toBe(5_000);
  });

  it('no part can make the scene endless, or end before it starts', () => {
    const scene = sceneOf([{ totalTimeMs: 1_000 }]);
    const parts = [
      { endsAtMs: Number.POSITIVE_INFINITY },
      { endsAtMs: Number.NaN },
      { endsAtMs: -5 },
      { cycles: { releaseEndMs: 2_000, allowanceMs: Number.POSITIVE_INFINITY } },
    ];
    expect(contentEndMs(scene, 0.75, parts)).toBe(2_000);
  });
});
