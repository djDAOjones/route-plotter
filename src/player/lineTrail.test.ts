// CORE-04 stage 4b: the line's comet trail, through the real catalogue (and the recorder for what is drawn), against
// v3's numbers (v3/tests/visibilityPathMatrix.test.js :198–262): a trail of 0.2 over a walk that moves for 10 s, so
// the trail's time is 2 s. Each expected end is a share of the way walked, read on the core's own samples.
import { afterEach, expect, test, vi } from "vitest";
import { Recorder } from "../adapters/render/recorder";
import { pointAt } from "../core/geometry/path";
import type { ImagePoint } from "../core/geometry/units";
import {
  newLine,
  newPoint,
  newRoute,
  newScene,
  type Route,
} from "../core/model/scene";
import { composeTimeline, leadAt } from "../core/timing/timeline";
import { CATALOGUE } from "../features/catalogue";
import { compose } from "./compose";

const line = CATALOGUE.route[0];
if (line === undefined) throw new Error("no route module");

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

/**
 * a → b → c on a straight line, two lines of one length that the lead walks in 10 s by total time; b pauses
 * `pauseMs` halfway, c waits `finalMs` at the end. With `branch`, c forks to d and e, which the lead walks together.
 */
function walkOf(
  trailLength: number,
  pauseMs: number,
  finalMs: number,
  branch = false,
): Route {
  const nextId = counter();
  const at = (x: number, y: number, wait = 0) => ({
    ...newPoint(nextId, { x, y, kind: "stop" }),
    pauseMs: wait,
  });
  const [a, b, c] = [
    at(0.1, 0.5),
    at(0.5, 0.5, pauseMs),
    at(0.9, 0.5, finalMs),
  ];
  const points = [a, b, c];
  const lines = [newLine(nextId, a.id, b.id), newLine(nextId, b.id, c.id)];
  if (branch) {
    const [d, e] = [at(0.9, 0.1), at(0.5, 0.9)];
    points.push(d, e);
    lines.push(newLine(nextId, c.id, d.id), newLine(nextId, c.id, e.id));
  }
  const route = { ...newRoute(nextId), points, lines, leadStart: a.id };
  const { settings } = route;
  return {
    ...route,
    settings: {
      ...settings,
      lead: {
        ...settings.lead,
        timing: "total time",
        totalTimeMs: 10_000,
        startsAtMs: 0,
      },
      line: { ...settings.line, appearance: "trail", trailLength },
    },
  };
}

interface Drawing {
  readonly strokes: readonly { readonly points: readonly ImagePoint[] }[];
}
const isDrawing = (value: unknown): value is Drawing =>
  typeof value === "object" &&
  value !== null &&
  "strokes" in value &&
  Array.isArray(value.strokes);

/** The line's strokes for a route at a moment of the content, which is also the module's `timeMs`. */
function drawn(route: Route, ms: number) {
  if (line === undefined) throw new Error("no route module");
  const timeline = composeTimeline(route, 1);
  const shape = {
    points: route.points,
    lines: route.lines,
    leadStart: route.leadStart,
    marks: route.marks,
  };
  const basis = {
    settings: line.select(route.settings),
    route: { shape, timeline },
    seed: 1,
    scale: 1,
  };
  const result = line.evaluate({
    ...basis,
    timeMs: ms,
    lead: leadAt(timeline, ms),
  });
  if (!result.ok) throw new Error(result.reason);
  if (!isDrawing(result.value)) throw new Error("not a line drawing");
  return {
    strokes: result.value.strokes.map((stroke) => stroke.points),
    timeline,
    end: line.end(basis),
  };
}

/** The point a share of the way along a route with no branch, from the lines' lengths in walk order. */
function walkedTo(route: Route, share: number): ImagePoint {
  const { lines, shapes } = composeTimeline(route, 1);
  const lengths = lines.map(
    (each) => shapes.get(each.lineId)?.lengthWidths ?? 0,
  );
  let left = share * lengths.reduce((sum, length) => sum + length, 0);
  for (const [i, each] of lines.entries()) {
    const length = lengths[i] ?? 0;
    const samples = shapes.get(each.lineId)?.samples ?? [];
    if (left <= length || i === lines.length - 1)
      return pointAt(samples, left / length) ?? { x: Number.NaN, y: 0 };
    left -= length;
  }
  throw new Error("no line");
}

/** The comet's one stroke at a moment, as [tail, head] shares of the way walked; null when nothing shows. */
function expectComet(
  route: Route,
  ms: number,
  ends: readonly [number, number] | null,
) {
  const { strokes } = drawn(route, ms);
  if (ends === null) {
    expect(strokes, `at ${ms} ms`).toEqual([]);
    return;
  }
  expect(strokes, `at ${ms} ms`).toHaveLength(1);
  const points = strokes[0] ?? [];
  for (const [point, share] of [
    [points[0], ends[0]],
    [points.at(-1), ends[1]],
  ] as const) {
    const expected = walkedTo(route, share);
    expect(point?.x, `at ${ms} ms, ${share}`).toBeCloseTo(expected.x, 9);
    expect(point?.y, `at ${ms} ms, ${share}`).toBeCloseTo(expected.y, 9);
  }
}

afterEach(() => vi.restoreAllMocks());

test("the comet at the start, part way, over a pause and after it, against v3’s tail and head", () => {
  const route = walkOf(0.2, 1_000, 0);
  // Not yet moved: no tail at all.
  expectComet(route, 0, null);
  // Capped at four fifths of the way walked (v3: 0.1 → 0.02; 0.25 → 0.05), then the whole trail behind the head.
  expectComet(route, 1_000, [0.02, 0.1]);
  expectComet(route, 2_500, [0.05, 0.25]);
  expectComet(route, 4_000, [0.2, 0.4]);
  // b pauses 1 s at 0.5: the tail closes on the head over the trail's 2 s (v3: halfway after 1 s, 0.4).
  expectComet(route, 5_000, [0.3, 0.5]);
  expectComet(route, 5_500, [0.35, 0.5]);
  // After the pause the tail holds at 0.4 until the base tail catches it up (v3's held tail), then leads.
  expectComet(route, 6_000, [0.4, 0.5]);
  expectComet(route, 7_000, [0.4, 0.6]);
  expectComet(route, 8_000, [0.5, 0.7]);
});

test("after the lead’s end the tail closes on it, and the scene waits for that and v3’s half-second handle", () => {
  const route = walkOf(0.2, 1_000, 0);
  // The lead ends at 11 s; a quarter of the trail's time later the tail is a quarter of the way in (v3: 0.85).
  expectComet(route, 11_000, [0.8, 1]);
  expectComet(route, 11_500, [0.85, 1]);
  expectComet(route, 13_000, null);
  expect(drawn(route, 0).end).toEqual({ endsAtMs: 11_000 + 2_000 + 500 });
  // Any other appearance adds no time of its own.
  const grows: Route["settings"]["line"] = {
    ...route.settings.line,
    appearance: "grows",
  };
  expect(
    drawn({ ...route, settings: { ...route.settings, line: grows } }, 0).end,
  ).toBeNull();
});

test("TST-09.3: a stopped comet has no tail, so the trail is empty in a final wait (A25)", () => {
  // Open day's case: a 4.5 s final wait, longer than the trail's time.
  const route = walkOf(0.2, 1_000, 4_500);
  expectComet(route, 11_000, [0.8, 1]);
  expectComet(route, 12_000, [0.9, 1]);
  for (const ms of [13_000, 14_000, 15_499]) expectComet(route, ms, null);
  // The tail has nothing left to close after the wait, yet the scene keeps v3's tail time after the lead's end.
  expectComet(route, 15_500, null);
  expect(drawn(route, 0).end).toEqual({ endsAtMs: 15_500 + 2_000 + 500 });
});

test("TST-03.1: the maximum trail (4.0) shows the last four fifths of the way walked, as v3 draws it", () => {
  const route = walkOf(4, 1_000, 0);
  // v3: at the end the tail is at 0.2, part way at a fifth of the way walked; a trail of 1 draws the same.
  expectComet(route, 4_000, [0.08, 0.4]);
  expectComet(route, 5_000, [0.1, 0.5]);
  expectComet(route, 11_000, [0.2, 1]);
  expectComet(walkOf(1, 1_000, 0), 11_000, [0.2, 1]);
  // Its fade lasts 4 × the 10 s walk, and the scene waits for it.
  expect(drawn(route, 0).end).toEqual({ endsAtMs: 11_000 + 40_000 + 500 });
});

test("on branches the comet trails every head back to one moment", () => {
  const route = walkOf(0.2, 0, 0, true);
  const { timeline } = drawn(route, 0);
  const [, bc, cd, ce] = timeline.lines;
  if (!bc || !cd || !ce) throw new Error("four walked lines");
  expect(cd.departMs).toBe(ce.departMs);
  const samples = (lineId: string) =>
    timeline.shapes.get(lineId)?.samples ?? [];
  const lengths = timeline.lines.map(
    (each) => timeline.shapes.get(each.lineId)?.lengthWidths ?? 0,
  );
  const total = lengths.reduce((sum, length) => sum + length, 0);
  // The share walked at a moment, and by halving, the moment a share was walked: an oracle apart from the module's.
  const walked = (ms: number) => {
    const { progress } = leadAt(timeline, ms);
    return (
      timeline.lines.reduce(
        (sum, each, i) =>
          sum + (lengths[i] ?? 0) * (progress.get(each.lineId) ?? 0),
        0,
      ) / total
    );
  };
  const when = (share: number) => {
    let [low, high] = [0, timeline.endMs];
    for (let i = 0; i < 80; i++)
      [low, high] =
        walked((low + high) / 2) < share
          ? [(low + high) / 2, high]
          : [low, (low + high) / 2];
    return high;
  };
  const at = (lineId: string, ms: number) =>
    pointAt(samples(lineId), leadAt(timeline, ms).progress.get(lineId) ?? 0);
  // A quarter of the way down c → d the tail is still on b → c, so each branch shows from c to its head; three
  // quarters down, the tail is on both branches, each where the lead was at the one moment it had walked it.
  for (const quarter of [0.25, 0.75]) {
    const ms = cd.departMs + quarter * (cd.arriveMs - cd.departMs);
    const { strokes } = drawn(route, ms);
    const tailMs = when(walked(ms) - 0.2);
    expect(strokes).toHaveLength(2);
    const [first, second] = [strokes[0] ?? [], strokes[1] ?? []];
    expect(first.at(-1)).toEqual(at(cd.lineId, ms));
    expect(second.at(-1)).toEqual(at(ce.lineId, ms));
    const tails =
      quarter === 0.25
        ? [at(bc.lineId, tailMs), samples(ce.lineId)[0]]
        : [at(cd.lineId, tailMs), at(ce.lineId, tailMs)];
    for (const [point, expected] of [
      [first[0], tails[0]],
      [second[0], tails[1]],
    ]) {
      expect(point?.x).toBeCloseTo(expected?.x ?? Number.NaN, 6);
      expect(point?.y).toBeCloseTo(expected?.y ?? Number.NaN, 6);
    }
  }
});

test("the same lead at two clock times draws the same, with no clock or random source read", () => {
  const route = walkOf(0.2, 1_000, 0);
  vi.spyOn(Math, "random").mockImplementation(() => {
    throw new Error("random read");
  });
  vi.spyOn(Date, "now").mockReturnValue(1);
  vi.spyOn(performance, "now").mockReturnValue(1);
  const first = drawn(route, 5_500).strokes;
  vi.spyOn(Date, "now").mockReturnValue(9e12);
  vi.spyOn(performance, "now").mockReturnValue(9e6);
  expect(drawn(route, 5_500).strokes).toEqual(first);
});

test("the trail draws at full strength from tail to head through the recorder, as v3 draws it (D138)", () => {
  const route = walkOf(0.2, 1_000, 0);
  const scene = newScene(counter());
  const clock = { ...scene.settings.clock, holdAtStartMs: 0 };
  const recorder = new Recorder();
  const source = { width: 400, height: 400, close() {} };
  const reports = compose(recorder, {
    scene: {
      ...scene,
      settings: { ...scene.settings, clock },
      routes: [route],
    },
    sceneMs: 5_500,
    seed: 7,
    size: { width: 1000, height: 1000 },
    image: { width: 400, height: 400, source },
    surface: () => ({ context: new Recorder(), image: source }),
  });
  expect(reports).toEqual([]);
  const strokes = recorder
    .take()
    .filter((entry) => entry.startsWith("stroke "));
  expect(strokes).toHaveLength(1);
  // The recorder names a style only where it differs from its default, so no `globalAlpha` here is full strength.
  expect(strokes[0]).toMatch(
    /^stroke \| .* strokeStyle=#d55e00 lineWidth=2\.778 /,
  );
  expect(strokes[0]).not.toMatch(/globalAlpha/);
});
