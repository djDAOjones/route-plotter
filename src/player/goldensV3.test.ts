// CORE-04 stage 7: what v3's own frames of a scene and v4's golden of the same scene agree on, pinned. Each scene's two
// files are read as they are, v3's under `src/player/goldens/v3/` (v3's unchanged code in export mode, a fixture nothing
// regenerates) and v4's under `src/player/goldens/`; this test never writes either. At the five moments both hold (the
// start, a quarter, the middle, three quarters and the end) it pins only what agrees:
// - the line's drawn course: every point of one side's line lies within a pixel of the other side's line, both ways,
//   over the five moments together (each side's sizes, pieces and progression differ: D126, D104, D163);
// - each stop marker's place, and which show at each moment;
// - each label's text and place, and which show at each moment.
// Every other difference is named in the scene's list (hand-over 44), with the decision that explains it.
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

interface Moment {
  readonly lines: Point[][];
  readonly markers: string[];
  readonly labels: string[];
}

const NUMBER = String.raw`(-?\d+(?:\.\d+)?(?:e-?\d+)?)`;
const PATH_CALL = new RegExp(`^(moveTo|lineTo) ${NUMBER} ${NUMBER} @`);
const ARC = new RegExp(`^arc ${NUMBER} ${NUMBER} `);
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
    moment.markers.push(`${at.x} ${at.y}`);
  }
  const text = TEXT.exec(call);
  if (text) {
    const at = placed(call, Number(text[3]), Number(text[4]));
    moment.labels.push(`${text[1] ?? text[2]} ${at.x} ${at.y}`);
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

test('every v3 recording is of a scene v4 has a golden of', () => {
  expect(SCENES.map(({ name }) => name)).toContain('grows');
  for (const { name, v4 } of SCENES) expect(v4, name).toBeTypeOf('string');
});

for (const { name, v3, v4 } of SCENES) {
  const moments = shared(v3, v4 ?? '');

  test(`${name}: the line's drawn course agrees within a pixel, both ways, over the five moments`, () => {
    expect(courseGap(pointsOf(moments.v3), segmentsOf(moments.v4))).toBeLessThanOrEqual(PIXEL);
    expect(courseGap(pointsOf(moments.v4), segmentsOf(moments.v3))).toBeLessThanOrEqual(PIXEL);
  });

  test(`${name}: the same markers show at each moment, each at the same place`, () => {
    const places = (side: readonly Moment[]) => side.map((moment) => [...moment.markers].sort());
    expect(places(moments.v3)).toEqual(places(moments.v4));
  });

  test(`${name}: the same labels show at each moment, each with the same text at the same place`, () => {
    const labels = (side: readonly Moment[]) => side.map((moment) => [...moment.labels].sort());
    expect(labels(moments.v3)).toEqual(labels(moments.v4));
  });
}

test('grows’ checks hold something, and fail when either side’s line moves by more than a pixel, by its points or its transform', () => {
  const grows = SCENES.find((scene) => scene.name === 'grows');
  const moments = shared(grows?.v3 ?? '', grows?.v4 ?? '');
  const moved = (points: readonly Point[]) => points.map(({ x, y }) => ({ x: x + 0.8, y: y + 0.8 }));
  const v3 = pointsOf(moments.v3);
  const v4 = pointsOf(moments.v4);
  expect(v4.length).toBeGreaterThan(100);
  const end = (side: readonly Moment[]) => [side[4]?.markers.length, side[4]?.labels.length];
  expect([end(moments.v3), end(moments.v4)]).toEqual([[3, 3], [3, 3]]);
  expect(courseGap(moved(v3), segmentsOf(moments.v4))).toBeGreaterThan(PIXEL);
  expect(courseGap(moved(v4), segmentsOf(moments.v3))).toBeGreaterThan(PIXEL);
  // Codex (sub-chat 44's last round): a recorded transform moved by 20 pixels must move the course, markers and labels.
  const shifted = shared(grows?.v3 ?? '', (grows?.v4 ?? '').split('@ 1 0 0 1 0 0').join('@ 1 0 0 1 20 20'));
  expect(courseGap(pointsOf(shifted.v4), segmentsOf(moments.v3))).toBeGreaterThan(PIXEL);
  expect(shifted.v4[4]?.markers).not.toEqual(moments.v4[4]?.markers);
  expect(shifted.v4[4]?.labels).not.toEqual(moments.v4[4]?.labels);
  expect(courseGap([], [])).toBe(0);
  expect(courseGap(v4, [])).toBe(Number.POSITIVE_INFINITY);
});
