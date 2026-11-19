// CORE-02: the lead's times, with v3's timing numbers ported (re-based to image widths: a 1,000-pixel leg at 100
// pixels a second is 1 image width at 0.1 widths a second) and the pins of DEF-05, DEF-11 and DEF-12 inverted.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { contentTime, sceneTime } from '../clock/clock';
import { CLOCK_SETTINGS, LEAD_SETTINGS } from '../config/settings';
import type { Route } from '../model/scene';
import { SAMPLE_BUDGET } from '../geometry/path';
import { defaultsOf } from '../schema/field';
import { composeTimeline, leadAt, scheduleLead, type Timeline } from './timeline';
import { leadWalk } from './walk';

type Point = Route['points'][number];
interface Options {
  readonly lead?: Partial<Route['settings']['lead']>;
  readonly pauses?: Readonly<Record<string, number>>;
  readonly bends?: readonly string[];
  readonly factors?: Readonly<Record<string, number>>;
}

/** A route from line specs (`A>B` one way, `A-B` both ways), each line's id its spec; the lead starts at the first. */
function routeOf(specs: readonly string[], options: Options = {}) {
  const lines = specs.map((spec) => {
    const [from = '', to = ''] = spec.split(/[>-]/);
    const direction = spec.includes('>') ? ('one way' as const) : ('both ways' as const);
    return { id: spec, from, to, direction, speedFactor: options.factors?.[spec] ?? 1 };
  });
  const ids = [...new Set(lines.flatMap((line) => [line.from, line.to]))];
  const points = ids.map((id, i): Point => {
    const kind = options.bends?.includes(id) ? 'bend' : 'stop';
    return { id, x: i / 10, y: 0.5, kind, label: '', pauseMs: options.pauses?.[id] ?? 0 };
  });
  const lead = { ...defaultsOf(LEAD_SETTINGS), speed: 0.1, ...options.lead };
  return { points, lines, leadStart: ids[0] ?? null, settings: { lead } };
}

type TestRoute = ReturnType<typeof routeOf>;
const scheduleOf = (route: TestRoute, lengths: Readonly<Record<string, number>>) =>
  scheduleLead(route, leadWalk(route), new Map(Object.entries(lengths)));

/** A timeline over exact lengths, each line drawn straight between its points, so `leadAt` reads exact times. */
function timelineOf(route: TestRoute, lengths: Readonly<Record<string, number>>): Timeline {
  const walk = leadWalk(route);
  const places = new Map(route.points.map((point) => [point.id, { x: point.x, y: point.y }]));
  const placeOf = (id: string) => places.get(id) ?? { x: Number.NaN, y: Number.NaN };
  const shapes = new Map(
    walk.walked.map((line) => {
      const lengthWidths = lengths[line.lineId] ?? 0;
      return [line.lineId, { samples: [placeOf(line.from), placeOf(line.to)], lengthWidths }];
    }),
  );
  return { ...scheduleOf(route, lengths), walk, shapes, places };
}

/** Matches a time to six places, as v3's tests do with `toBeCloseTo(…, 6)`. */
const near = (ms: number): unknown => expect.closeTo(ms, 6);
const arrival = (schedule: ReturnType<typeof scheduleOf>, point: string) => schedule.points.get(point)?.arriveMs;
const departure = (schedule: ReturnType<typeof scheduleOf>, point: string) => schedule.points.get(point)?.departMs;
const LEGS = ['a>b', 'b>c', 'c>d', 'd>e'];
const LEG_LENGTHS = { 'a>b': 0.3, 'b>c': 0.25, 'c>d': 0.25, 'd>e': 0.2 };

describe('v3’s legs and pauses, ported (v3/tests/playerCore.test.js, branchTiming.test.js)', () => {
  it('legs of 300, 250, 250 and 200 px at 100 px/s take 10,000 ms (playerCore.test.js:36)', () => {
    const schedule = scheduleOf(routeOf(LEGS), LEG_LENGTHS);
    expect(schedule.endMs).toBeCloseTo(10_000, 6);
    expect(['b', 'c', 'd', 'e'].map((point) => arrival(schedule, point))).toEqual(
      [3_000, 5_500, 8_000, 10_000].map(near),
    );
  });

  it('speed factors of 0.5 and 2 on the first two legs give 6,000 and 1,250 ms; 11,750 in all (:46–48)', () => {
    const schedule = scheduleOf(routeOf(LEGS, { factors: { 'a>b': 0.5, 'b>c': 2 } }), LEG_LENGTHS);
    const [first, second] = schedule.lines;
    expect((first?.arriveMs ?? 0) - (first?.departMs ?? 0)).toBeCloseTo(6_000, 6);
    expect((second?.arriveMs ?? 0) - (second?.departMs ?? 0)).toBeCloseTo(1_250, 6);
    expect(schedule.endMs).toBeCloseTo(11_750, 6);
  });

  it('a 9,999 ms pause at the start is not taken, and 1,500 ms at the next stop is (:82–83)', () => {
    const schedule = scheduleOf(routeOf(LEGS, { pauses: { a: 9_999, b: 1_500 } }), LEG_LENGTHS);
    expect(departure(schedule, 'a')).toBe(0);
    expect(departure(schedule, 'b')).toBeCloseTo(4_500, 6);
    expect(schedule.endMs).toBeCloseTo(11_500, 6);
  });

  it('pauses of 1,000 ms at b and 2,000 ms at d: d’s pause runs from 9,000 to 11,000 ms (:111–112)', () => {
    const schedule = scheduleOf(routeOf(LEGS, { pauses: { b: 1_000, d: 2_000 } }), LEG_LENGTHS);
    expect(arrival(schedule, 'd')).toBeCloseTo(9_000, 6);
    expect(departure(schedule, 'd')).toBeCloseTo(11_000, 6);
  });

  it('500 ms into a 2,000 ms pause the lead rests at its stop, with 500 ms of the pause gone (:129–131)', () => {
    const timeline = timelineOf(routeOf(LEGS, { pauses: { b: 2_000 } }), LEG_LENGTHS);
    const { main } = leadAt(timeline, (arrival(timeline, 'b') ?? 0) + 500);
    expect(main).toMatchObject({ pointId: 'b', lineId: 'a>b', pause: { elapsedMs: 500, totalMs: 2_000 } });
  });

  it('1,000 px at 100 px/s through a, b and c: arrivals 0, 5,000, 10,000; a pause at b pushes only c (:35–53)', () => {
    const even = { 'a>b': 0.5, 'b>c': 0.5 };
    const plain = scheduleOf(routeOf(['a>b', 'b>c']), even);
    expect(['a', 'b', 'c'].map((point) => arrival(plain, point))).toEqual([0, 5_000, 10_000]);
    const paused = scheduleOf(routeOf(['a>b', 'b>c'], { pauses: { b: 2_000 } }), even);
    expect([arrival(paused, 'b'), arrival(paused, 'c')]).toEqual([5_000, 12_000]);
  });
});

describe('v3’s branches, ported, with the join’s wait applied (branchTiming.test.js, routeBranches.test.js)', () => {
  it('a branch from 5 s that rejoins: it leaves at 5,000; z waits 5,000 ms and goes on at 15,000 (:106–110)', () => {
    const half = { 'a>f': 0.5, 'f>z': 0.5, 'f>b1': 0.5, 'b1>z': 0.5 };
    const schedule = scheduleOf(routeOf(['a>f', 'f>z', 'f>b1', 'b1>z']), half);
    const line = (id: string) => schedule.lines.find((each) => each.lineId === id);
    expect(line('f>b1')?.departMs).toBe(5_000);
    expect(line('f>z')?.arriveMs).toBe(10_000);
    expect(arrival(schedule, 'z')).toBe(15_000);
    expect(schedule.endMs).toBe(15_000);
  });

  it('a branch from the trunk’s end extends the route: 20,000 ms (branchTiming.test.js:119)', () => {
    expect(scheduleOf(routeOf(['a>f', 'f>b1']), { 'a>f': 1, 'f>b1': 1 }).endMs).toBe(20_000);
  });

  it('branches from one fork run at once: 4,000 ms, not 6,500 (routeBranches.test.js:250)', () => {
    const lengths = { 'a>z': 0.1, 'a>l1': 0.4, 'a>r1': 0.25 };
    expect(scheduleOf(routeOf(['a>z', 'a>l1', 'a>r1']), lengths).endMs).toBeCloseTo(4_000, 6);
  });

  it('a join waits for its latest arrival: the trunk at 3,000, the slow branch at 5,000 (:263–264)', () => {
    const specs = ['fork>join', 'fork>s1', 's1>join', 'fork>f1', 'f1>join'];
    const lengths = { 'fork>join': 0.3, 'fork>s1': 0.25, 's1>join': 0.25, 'fork>f1': 0.05, 'f1>join': 0.05 };
    const schedule = scheduleOf(routeOf(specs), lengths);
    expect(schedule.lines.find((line) => line.lineId === 'fork>join')?.arriveMs).toBeCloseTo(3_000, 6);
    expect(arrival(schedule, 'join')).toBeCloseTo(5_000, 6);
    expect(schedule.endMs).toBeCloseTo(5_000, 6);
  });

  it('every branch’s end counts: a 6,000 ms branch from a fork at 1,000 ends the route at 7,000 (:296)', () => {
    const lengths = { 'a>fork': 0.1, 'fork>end': 0.1, 'fork>x': 0.6 };
    expect(scheduleOf(routeOf(['a>fork', 'fork>end', 'fork>x']), lengths).endMs).toBeCloseTo(7_000, 6);
  });

  it('a branch of a branch chains its start through both forks: 1,000 ms; 3,200 in all (:322–323)', () => {
    const lengths = { 'a0>a': 0.02, 'a>t': 0.08, 'a>b1': 0.08, 'b1>b2': 0.22, 'b1>c': 0.05 };
    const schedule = scheduleOf(routeOf(['a0>a', 'a>t', 'a>b1', 'b1>b2', 'b1>c']), lengths);
    expect(schedule.lines.find((line) => line.lineId === 'b1>c')?.departMs).toBeCloseTo(1_000, 6);
    expect(schedule.endMs).toBeCloseTo(3_200, 6);
  });
});

describe('DEF-11: bends at either end of the walk are timed, and the lead reaches the last point', () => {
  // Inverts v3/tests/minorEnd.test.js:123, :194 and :214, which pinned leading and trailing bends as untimed.
  const route = routeOf(['a>b', 'b>c', 'c>d'], { bends: ['a', 'd'], pauses: { c: 1_000 } });
  const lengths = { 'a>b': 0.1, 'b>c': 0.5, 'c>d': 0.2 };

  it('times each line, the leading and trailing bends’ lines included, at the lead’s speed', () => {
    const schedule = scheduleOf(route, lengths);
    expect(schedule.lines.map((line) => line.arriveMs - line.departMs)).toEqual([1_000, 5_000, 2_000]);
    expect(arrival(schedule, 'd')).toBe(9_000);
    expect(schedule.endMs).toBe(9_000);
  });

  it('no stall: at the end the lead is at the last point, and a moment before it is all but there', () => {
    const timeline = timelineOf(route, lengths);
    expect(leadAt(timeline, timeline.endMs).main).toMatchObject({ pointId: 'd', at: timeline.places.get('d') });
    const before = leadAt(timeline, timeline.endMs * (1 - 1e-12));
    expect(before.progress.get('c>d')).toBeCloseTo(1, 9);
  });

  it('on a real curve, the lead’s head at the end is the last point itself (TST-09.2)', () => {
    const timeline = composeTimeline(route, 0.75);
    expect(leadAt(timeline, timeline.endMs).main?.at).toEqual(timeline.places.get('d'));
    const last = timeline.shapes.get('c>d')?.samples.at(-1);
    expect(leadAt(timeline, (arrival(timeline, 'd') ?? 0) - 1e-9).main?.at.x).toBeCloseTo(last?.x ?? Number.NaN, 6);
  });
});

describe('DEF-12: one clock, so a branch leaves exactly when the lead reaches its fork', () => {
  // Inverts v3/tests/timeDomains.test.js:255–256 and the timing half of crowdArrival.test.js:339–395.
  const route = routeOf(['a>f', 'f>z', 'f>b'], { lead: { startsAtMs: 1_000 } });
  const timeline = timelineOf(route, { 'a>f': 0.5, 'f>z': 0.5, 'f>b': 0.5 });
  const branch = (contentMs: number) => leadAt(timeline, contentMs).progress.get('f>b');

  it('under a 1 s start, the fork is reached at 6,000: the branch is at 0 at 5,999 and 6,000, past it at 6,001', () => {
    expect(arrival(timeline, 'f')).toBe(6_000);
    expect([branch(5_999), branch(6_000)]).toEqual([0, 0]);
    expect(branch(6_001)).toBeGreaterThan(0);
  });

  it('through the scene’s clock and Hold at start, the branch is still at exactly 0 when it leaves', () => {
    const clock = { ...defaultsOf(CLOCK_SETTINGS), holdAtStartMs: 500 };
    const leaves = sceneTime(clock, timeline.endMs, 6_000);
    expect(leaves).toBe(6_500);
    expect(branch(contentTime(clock, timeline.endMs, leaves))).toBe(0);
    expect(branch(contentTime(clock, timeline.endMs, leaves + 1))).toBeGreaterThan(0);
  });
});

describe('DEF-05’s timing half: every time is keyed by point and line ids', () => {
  // v3/tests/headDirectionBranchWait.test.js:168 pinned a trunk-run index (2) applied to the whole waypoint list
  // (a, f, x1, x2, m, c). Here the pause belongs to m by id, whatever order the points and lines are listed in.
  const specs = ['a>f', 'f>m', 'm>c', 'f>x1', 'x1>x2', 'x2>m'];
  const lengths = Object.fromEntries(specs.map((spec) => [spec, 0.1]));
  const base = routeOf(specs, { pauses: { m: 1_000 } });
  const order = ['a', 'f', 'x1', 'x2', 'm', 'c'];
  const pointOf = (id: string) => {
    const point = base.points.find((each) => each.id === id);
    if (!point) throw new Error(`No point ${id}`);
    return point;
  };
  const listed = { ...base, points: order.map(pointOf) };

  it('pauses at m, the point it belongs to, and the branch through x1 and x2 never waits', () => {
    const schedule = scheduleOf(listed, lengths);
    expect((departure(schedule, 'm') ?? 0) - (arrival(schedule, 'm') ?? 0)).toBe(1_000);
    for (const point of ['x1', 'x2']) expect(departure(schedule, point)).toBe(arrival(schedule, point));
  });

  it('gives each point and line the same times when the lists are reversed', () => {
    const reversed = { ...listed, points: [...listed.points].reverse(), lines: [...listed.lines].reverse() };
    const timesOf = (route: TestRoute) => {
      const schedule = scheduleOf(route, lengths);
      return { points: new Map(schedule.points), lines: new Map(schedule.lines.map((line) => [line.lineId, line])) };
    };
    expect(timesOf(reversed)).toEqual(timesOf(listed));
  });
});

describe('Total time: the walk, without its pauses, takes the route’s total time', () => {
  const total = (over: Options = {}): Options => ({
    ...over,
    lead: { timing: 'total time', totalTimeMs: 5_000, ...over.lead },
  });
  const even = { 'a>b': 0.3, 'b>c': 0.7 };

  it('keeps the lines’ proportions: 0.3 and 0.7 widths in 5,000 ms arrive at 1,500 and 5,000', () => {
    const schedule = scheduleOf(routeOf(['a>b', 'b>c'], total()), even);
    expect([arrival(schedule, 'b'), arrival(schedule, 'c')]).toEqual([1_500, 5_000].map(near));
  });

  it('puts the stops’ pauses on top, and keeps each line’s speed factor', () => {
    expect(scheduleOf(routeOf(['a>b', 'b>c'], total({ pauses: { b: 1_000 } })), even).endMs).toBeCloseTo(6_000, 6);
    const faster = scheduleOf(routeOf(['a>b', 'b>c'], total({ factors: { 'b>c': 2 } })), even);
    expect(arrival(faster, 'b')).toBeCloseTo((5_000 * 0.3) / 0.65, 6);
    expect(faster.endMs).toBeCloseTo(5_000, 6);
  });

  it('gives the longest branch the whole total time', () => {
    const schedule = scheduleOf(routeOf(['a>b', 'a>c'], total()), { 'a>b': 0.2, 'a>c': 0.6 });
    expect(arrival(schedule, 'b')).toBeCloseTo(5_000 / 3, 6);
    expect(schedule.endMs).toBeCloseTo(5_000, 6);
  });

  it('a walk with no length takes no time, and a route with no points has no lead', () => {
    expect(scheduleOf(routeOf(['a>b'], total({ lead: { startsAtMs: 700 } })), { 'a>b': 0 }).endMs).toBe(700);
    const empty = { ...routeOf([]), leadStart: null };
    expect(scheduleOf(empty, {})).toEqual({ start: null, lines: [], points: new Map(), endMs: 0 });
  });
});

describe('the lead’s place: its heads, and its main head (§3, rule 5)', () => {
  const lengths = { 'a>b': 0.2, 'a>c': 0.4, 'b>d': 0.2, 'c>d': 0.2 };
  const fork = (specs: readonly string[]) => timelineOf(routeOf(specs, { lead: { startsAtMs: 1_000 } }), lengths);

  it('rests at its start until it sets off', () => {
    const moment = leadAt(fork(['a>b', 'a>c']), 500);
    expect(moment.heads).toEqual([{ at: { x: 0, y: 0.5 }, lineId: null, pointId: 'a', pause: null }]);
    expect([...moment.progress.values()]).toEqual([0, 0]);
    expect(leadAt(fork(['a>b', 'a>c']), Number.NaN).main?.pointId).toBe('a');
  });

  it('goes every way at once from a fork; the main head is on the line first in saved order', () => {
    const both = leadAt(fork(['a>b', 'a>c']), 1_500);
    expect(both.heads.map((head) => head.lineId)).toEqual(['a>b', 'a>c']);
    expect(both.main?.lineId).toBe('a>b');
    expect(leadAt(fork(['a>c', 'a>b']), 1_500).main?.lineId).toBe('a>c');
  });

  it('rests at a join on its early branch until the last arrives, then has one head there', () => {
    const timeline = fork(['a>b', 'a>c', 'b>d', 'c>d']);
    expect(arrival(timeline, 'd')).toBe(7_000);
    const waiting = leadAt(timeline, 6_000).heads.map((head) => [head.lineId, head.pointId]);
    expect(waiting).toEqual([['b>d', 'd'], ['c>d', null]]);
    expect(leadAt(timeline, 8_000).heads).toEqual([{ at: { x: 0.3, y: 0.5 }, lineId: 'b>d', pointId: 'd', pause: null }]);
  });

  it('rests at each branch’s end once the walk is over', () => {
    expect(leadAt(fork(['a>b', 'a>c']), 60_000).heads.map((head) => head.pointId)).toEqual(['b', 'c']);
  });

  it('as a property: progress runs from 0 to 1, never back, and the lead always has a head', () => {
    const timeline = fork(['a>b', 'a>c', 'b>d', 'c>d']);
    const moment = fc.double({ min: -1e4, max: 2e4, noNaN: true });
    const step = fc.double({ min: 0, max: 1e4, noNaN: true });
    fc.assert(
      fc.property(moment, step, (t, later) => {
        const [now, next] = [leadAt(timeline, t), leadAt(timeline, t + later)];
        expect(now.heads.length).toBeGreaterThan(0);
        for (const [lineId, share] of now.progress) {
          expect(share >= 0 && share <= 1).toBe(true);
          expect(next.progress.get(lineId)).toBeGreaterThanOrEqual(share);
        }
      }),
    );
  });
});

describe('a stop’s authored point: the lead arrives, pauses and leaves there (Codex, stage 2)', () => {
  it('stays on a stop’s authored point through its pause, and arrives and leaves there (Codex’s case, stage 2)', () => {
    const base = routeOf(['a>b', 'b>c'], { pauses: { b: 1_000 } });
    const where: Readonly<Record<string, { x: number; y: number }>> = {
      a: { x: 0, y: 0 },
      b: { x: 0.3333, y: 0.8 },
      c: { x: 1, y: 0.1 },
    };
    const timeline = composeTimeline({ ...base, points: base.points.map((p) => ({ ...p, ...where[p.id] })) }, 0.75);
    const [arrive = 0, depart = 0] = [arrival(timeline, 'b'), departure(timeline, 'b')];
    expect(depart - arrive).toBeCloseTo(1_000, 6);
    for (const ms of [arrive - 1e-6, arrive, (arrive + depart) / 2, depart, depart + 1e-6]) {
      const at = leadAt(timeline, ms).main?.at;
      expect(at?.x).toBeCloseTo(0.3333, 6);
      expect(at?.y).toBeCloseTo(0.8, 6);
    }
  });
});

describe('a line that takes no time: the lead is at once at its other end (Codex, whole diff)', () => {
  it('a route of one line with no length ends at its last point, on the frame Hold at end keeps', () => {
    const base = routeOf(['a>b']);
    const timeline = composeTimeline({ ...base, points: base.points.map((p) => ({ ...p, x: 0.5, y: 0.5 })) }, 0.75);
    expect(timeline.endMs).toBe(0);
    const end = leadAt(timeline, contentTime({ ...defaultsOf(CLOCK_SETTINGS), holdAtEndMs: 2_000 }, 0, 1_000));
    expect(end.progress.get('a>b')).toBe(1);
    expect(end.heads.map((head) => head.pointId)).toEqual(['b']);
    expect(end.main?.at).toEqual(timeline.places.get('b'));
  });

  it('leaves a point at once when its only line out takes no time, and rests where a line with length goes on', () => {
    const timeline = timelineOf(routeOf(['a>b', 'b>c']), { 'a>b': 0, 'b>c': 0.5 });
    const start = leadAt(timeline, 0);
    expect(start.progress.get('a>b')).toBe(1);
    expect(start.progress.get('b>c')).toBe(0);
    expect(start.heads.map((head) => head.pointId)).toEqual(['b']);
  });
});

describe('a route of 2,000 points, timed end to end (INTAKE.12)', () => {
  it('samples within its budget, times every line and ends at its last point, in under a second', () => {
    const specs = Array.from({ length: 1_999 }, (_, i) => `p${i}>p${i + 1}`);
    const base = routeOf(specs, { lead: { speed: 0.2 } });
    const points = base.points.map((point, i) => ({ ...point, x: i / 2_000, y: i % 2 === 0 ? 0.6 : 0.4 }));
    const started = performance.now();
    const timeline = composeTimeline({ ...base, points }, 0.75);
    const end = leadAt(timeline, timeline.endMs);
    const took = performance.now() - started;
    const shapes = [...timeline.shapes.values()];
    expect(shapes.reduce((sum, shape) => sum + shape.samples.length - 1, 1)).toBeLessThanOrEqual(SAMPLE_BUDGET);
    expect(timeline.lines).toHaveLength(1_999);
    const widths = shapes.reduce((sum, shape) => sum + shape.lengthWidths, 0);
    expect(timeline.endMs).toBeCloseTo((widths / 0.2) * 1_000, 3);
    expect(end.main?.pointId).toBe('p1999');
    expect(took).toBeLessThan(1_000);
  });
});
