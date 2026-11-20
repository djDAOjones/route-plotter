// CORE-04 stage 7: what v3's own frames of a scene and v4's golden of the same scene agree on, pinned. Each scene's two
// files are read as they are, v3's under `src/player/goldens/v3/` (v3's unchanged code in export mode, a fixture nothing
// regenerates) and v4's under `src/player/goldens/`; this test never writes either. At the five moments both hold (the
// start, a quarter, the middle, three quarters and the end) it pins only what agrees:
// - the line's drawn course: every point of one side's line lies within a pixel of the other side's line, both ways,
//   over the five moments together (each side's sizes, pieces and progression differ: D126, D104, D163); for a comet,
//   which never shows the whole line, within a pixel of the other side's whole course instead (the orchestrator's
//   ruling, brief 45); for a hidden line, no line on either side; for branch-whole, left out by name (below);
// - each stop marker's place: every marker either side shows whole, the other side shows at that moment too;
// - each label's text and place, the same way. (A mark part grown or faded in shows where a moment falls a little
//   before a stop's arrival on one side only, because the moments fall at different places: D104; trail's list.)
// Every other difference is named in the scene's list (hand-overs 44 and 45), with the decision that explains it.
import { expect, test } from 'vitest';

const V4 = import.meta.glob<string>('./goldens/*.txt', { query: '?raw', import: 'default', eager: true });
const V3 = import.meta.glob<string>('./goldens/v3/*.txt', { query: '?raw', import: 'default', eager: true });

const SHARED = ['the start', 'a quarter', 'the middle', 'three quarters', 'the end'] as const;
/** The route's colour in every scene (v3's default, Okabe-Ito vermillion); v3 writes it in capitals. */
const LINE_COLOUR = '#d55e00';
const PIXEL = 1;

interface Point {
  readonly x: number;
  readonly y: number;
}
type Segment = readonly [Point, Point];

/** A marker (its place) or a label (its text and place), with how far it has grown or faded in: radius, opacity. */
interface Mark {
  readonly key: string;
  readonly size: number;
}
type Kind = 'markers' | 'labels';

interface Moment {
  readonly lines: Point[][];
  readonly markers: Mark[];
  readonly labels: Mark[];
}

/**
 * How a scene's course is pinned, where not both ways: a comet (trail), no line at all (hidden), or left out by name.
 * branch-whole's is left out (sub-chat 46; a ruling for the orchestrator): v3 shapes the trunk as one curve through the
 * fork, while v4 ends a run of its curve at a fork (src/core/timing/shape.ts:1–5, the plan's §6), so from just past the
 * bend to the trunk's end the two lines part by up to 6.86 px. Its branch agrees within a pixel; markers stay checked.
 */
const COURSE: Readonly<Record<string, 'comet' | 'no line' | 'left out'>> = { trail: 'comet', hidden: 'no line', 'branch-whole': 'left out' };

const NUMBER = String.raw`(-?\d+(?:\.\d+)?(?:e-?\d+)?)`;
const PATH_CALL = new RegExp(`^(moveTo|lineTo) ${NUMBER} ${NUMBER} @`);
const ARC = new RegExp(`^arc ${NUMBER} ${NUMBER} ${NUMBER} `);
const ALPHA = new RegExp(`globalAlpha=${NUMBER}`);
const TEXT = new RegExp(`^fillText (?:"((?:[^"\\\\]|\\\\.)*)"|(\\S+)) ${NUMBER} ${NUMBER} `);
const MOMENT = /^# ([^:]+): .*\d+ ms of \d+$/;
const MATRIX = new RegExp(`@ ${NUMBER} ${NUMBER} ${NUMBER} ${NUMBER} ${NUMBER} ${NUMBER}`);

/** A recorded place through the transform recorded with it (`@ a b c d e f`), so a moved transform moves the place. */
function placed(call: string, x: number, y: number): Point {
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = MATRIX.exec(call)?.slice(1).map(Number) ?? [];
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { x: round(a * x + c * y + e), y: round(b * x + d * y + f) };
}

/** The calls one recorded line makes, without v3's surface name ("main", "vector"). */
const callOf = (line: string) => line.replace(/^(?:main|vector) /, '');

/** Read one moment's line: a path call, a stroke in the route's colour, a marker's circle or a label's text. */
function readCall(call: string, moment: Moment, path: Point[][]): void {
  if (call === 'beginPath') path.length = 0;
  const step = PATH_CALL.exec(call);
  if (step) {
    const point = placed(call, Number(step[2]), Number(step[3]));
    if (step[1] === 'moveTo' || path.length === 0) path.push([point]);
    else path[path.length - 1]?.push(point);
  }
  if (/^stroke\b/.test(call) && call.toLowerCase().includes(`strokestyle=${LINE_COLOUR}`)) {
    moment.lines.push(...path.map((piece) => [...piece]));
  }
  const arc = ARC.exec(call);
  if (arc) {
    const at = placed(call, Number(arc[1]), Number(arc[2]));
    moment.markers.push({ key: `${at.x} ${at.y}`, size: Number(arc[3]) });
  }
  const text = TEXT.exec(call);
  if (text) {
    const at = placed(call, Number(text[3]), Number(text[4]));
    moment.labels.push({ key: `${text[1] ?? text[2]} ${at.x} ${at.y}`, size: Number(ALPHA.exec(call)?.[1] ?? 1) });
  }
}

/** Each moment of a recording by its name: the pieces of line stroked in the route's colour, the markers, the labels. */
function momentsOf(recording: string): Map<string, Moment> {
  const moments = new Map<string, Moment>();
  let moment: Moment | null = null;
  const path: Point[][] = [];
  for (const line of recording.split('\n')) {
    const heading = MOMENT.exec(line);
    if (heading) {
      moment = { lines: [], markers: [], labels: [] };
      moments.set(heading[1] ?? '', moment);
      path.length = 0;
    } else if (moment) readCall(callOf(line), moment, path);
  }
  return moments;
}

function distanceToSegment(point: Point, [a, b]: Segment): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

const pointsOf = (moments: readonly Moment[]) => moments.flatMap((moment) => moment.lines.flat());
const segmentsOf = (moments: readonly Moment[]): Segment[] =>
  moments.flatMap((moment) => moment.lines.flatMap((piece) => piece.slice(1).map((to, i): Segment => [piece[i] ?? to, to])));

/** How far, at most, any point of `points` lies from the line `segments` draws; 0 when neither draws a line. */
function courseGap(points: readonly Point[], segments: readonly Segment[]): number {
  if (points.length === 0) return segments.length === 0 ? 0 : Number.POSITIVE_INFINITY;
  if (segments.length === 0) return Number.POSITIVE_INFINITY;
  let gap = 0;
  for (const point of points) {
    let nearest = Number.POSITIVE_INFINITY;
    for (const segment of segments) nearest = Math.min(nearest, distanceToSegment(point, segment));
    gap = Math.max(gap, nearest);
  }
  return gap;
}

const sceneName = (path: string) => /([^/]+)\.txt$/.exec(path)?.[1] ?? path;
const SCENES = Object.entries(V3).map(([path, recording]) => ({ name: sceneName(path), v3: recording, v4: V4[`./goldens/${sceneName(path)}.txt`] }));

/** Both sides' five shared moments, in order; a moment either file lacks fails. */
function shared(v3: string, v4: string): { readonly v3: Moment[]; readonly v4: Moment[] } {
  const ours = momentsOf(v4);
  const theirs = momentsOf(v3);
  const pick = (moments: Map<string, Moment>, name: string) => {
    const moment = moments.get(name);
    if (!moment) throw new Error(`no moment “${name}”`);
    return moment;
  };
  return { v3: SHARED.map((name) => pick(theirs, name)), v4: SHARED.map((name) => pick(ours, name)) };
}

/** The marks at each moment grown or faded in whole: as large as that side draws them (a marker's radius, opacity 1). */
function wholeOf(side: readonly Moment[], kind: Kind): string[][] {
  const largest = Math.max(...side.flatMap((moment) => moment[kind].map((mark) => mark.size)));
  return side.map((moment) => moment[kind].filter((mark) => mark.size >= largest - 0.001).map((mark) => mark.key).sort());
}

/** At each moment, each mark side `a` shows whole that side `b` does not show at all. */
function unmatched(a: readonly Moment[], b: readonly Moment[], kind: Kind): string[][] {
  const shown = b.map((moment) => moment[kind].map((mark) => mark.key));
  return wholeOf(a, kind).map((keys, i) => keys.filter((key) => !shown[i]?.includes(key)));
}

const GROWS = SCENES.find((scene) => scene.name === 'grows');

/** A comet's gaps: from each side's points to the other side's whole course, its grows at the end ([v3's, v4's]). */
function cometGaps(v3: readonly Moment[], v4: readonly Moment[]): [number, number] {
  const whole = shared(GROWS?.v3 ?? '', GROWS?.v4 ?? '');
  return [courseGap(pointsOf(v3), segmentsOf(whole.v4.slice(4))), courseGap(pointsOf(v4), segmentsOf(whole.v3.slice(4)))];
}

/** Strokes in the route's colour anywhere in a recording, read from its lines as they stand. */
const strokesInColour = (recording: string) =>
  recording.split('\n').filter((line) => /^(?:(?:main|vector) )?stroke\b/.test(line) && line.toLowerCase().includes(`strokestyle=${LINE_COLOUR}`)).length;

test('every v3 recording is of a scene v4 has a golden of', () => {
  expect(SCENES.map(({ name }) => name)).toContain('grows');
  for (const { name, v4 } of SCENES) expect(v4, name).toBeTypeOf('string');
});

for (const { name, v3, v4 } of SCENES) {
  const moments = shared(v3, v4 ?? '');
  const none = SHARED.map(() => []);

  if (COURSE[name] === undefined) {
    test(`${name}: the line's drawn course agrees within a pixel, both ways, over the five moments`, () => {
      expect(courseGap(pointsOf(moments.v3), segmentsOf(moments.v4))).toBeLessThanOrEqual(PIXEL);
      expect(courseGap(pointsOf(moments.v4), segmentsOf(moments.v3))).toBeLessThanOrEqual(PIXEL);
    });
  }
  if (COURSE[name] === 'comet') {
    test(`${name}: each side draws some line, every point of it within a pixel of the other side's whole course (its grows at the end)`, () => {
      expect([pointsOf(moments.v3).length > 0, pointsOf(moments.v4).length > 0]).toEqual([true, true]);
      for (const gap of cometGaps(moments.v3, moments.v4)) expect(gap).toBeLessThanOrEqual(PIXEL);
    });
  }
  if (COURSE[name] === 'no line') {
    test(`${name}: neither side strokes the line at any moment, though both draw in its colour`, () => {
      expect([pointsOf(moments.v3).length, pointsOf(moments.v4).length]).toEqual([0, 0]);
      expect([strokesInColour(v3), strokesInColour(v4 ?? '')]).toEqual([0, 0]);
      expect([v3, v4 ?? ''].map((recording) => recording.toLowerCase().includes(LINE_COLOUR))).toEqual([true, true]);
    });
  }

  test(`${name}: every marker either side shows whole shows on the other at each moment, at the same place`, () => {
    expect(unmatched(moments.v3, moments.v4, 'markers')).toEqual(none);
    expect(unmatched(moments.v4, moments.v3, 'markers')).toEqual(none);
  });

  test(`${name}: every label either side shows whole shows on the other at each moment, same text, same place`, () => {
    expect(unmatched(moments.v3, moments.v4, 'labels')).toEqual(none);
    expect(unmatched(moments.v4, moments.v3, 'labels')).toEqual(none);
  });
}

test('grows’ checks hold something, and fail when either side’s line moves by more than a pixel, by its points or its transform', () => {
  const moments = shared(GROWS?.v3 ?? '', GROWS?.v4 ?? '');
  const moved = (points: readonly Point[]) => points.map(({ x, y }) => ({ x: x + 0.8, y: y + 0.8 }));
  const v3 = pointsOf(moments.v3);
  const v4 = pointsOf(moments.v4);
  expect(v4.length).toBeGreaterThan(100);
  const end = (side: readonly Moment[]) => [side[4]?.markers.length, side[4]?.labels.length];
  expect([end(moments.v3), end(moments.v4)]).toEqual([[3, 3], [3, 3]]);
  // Every mark grows shows at the five moments is whole on both sides, so there the mark checks are equality.
  for (const side of [moments.v3, moments.v4]) {
    for (const kind of ['markers', 'labels'] as const) expect(wholeOf(side, kind)).toEqual(side.map((moment) => moment[kind].map((mark) => mark.key).sort()));
  }
  expect(courseGap(moved(v3), segmentsOf(moments.v4))).toBeGreaterThan(PIXEL);
  expect(courseGap(moved(v4), segmentsOf(moments.v3))).toBeGreaterThan(PIXEL);
  // Codex (sub-chat 44's last round): a recorded transform moved by 20 pixels must move the course, markers and labels.
  const shifted = shared(GROWS?.v3 ?? '', (GROWS?.v4 ?? '').split('@ 1 0 0 1 0 0').join('@ 1 0 0 1 20 20'));
  expect(courseGap(pointsOf(shifted.v4), segmentsOf(moments.v3))).toBeGreaterThan(PIXEL);
  expect(unmatched(shifted.v4, moments.v3, 'markers')[4]).toHaveLength(3);
  expect(unmatched(shifted.v4, moments.v3, 'labels')[4]).toHaveLength(3);
  expect(courseGap([], [])).toBe(0);
  expect(courseGap(v4, [])).toBe(Number.POSITIVE_INFINITY);
});

test('trail’s comet check holds something: it fails when either side’s line moves, by its points or its transform', () => {
  const trail = SCENES.find((scene) => scene.name === 'trail');
  const moments = shared(trail?.v3 ?? '', trail?.v4 ?? '');
  const lowered = moments.v3.map((moment) => ({ ...moment, lines: moment.lines.map((piece) => piece.map(({ x, y }) => ({ x, y: y + 2 }))) }));
  expect(cometGaps(lowered, moments.v4)[0]).toBeGreaterThan(PIXEL);
  const shifted = shared(trail?.v3 ?? '', (trail?.v4 ?? '').split('@ 1 0 0 1 0 0').join('@ 1 0 0 1 20 20'));
  expect(cometGaps(moments.v3, shifted.v4)[1]).toBeGreaterThan(PIXEL);
});
