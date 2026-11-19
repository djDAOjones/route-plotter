// CORE-04: the line, a route module (the plan's §6 and §8): which part of each of the route's lines shows at a
// moment, and in what style. Ported from v3's RenderingService.js (renderPath :1548, its continuous path :1706,
// applyLineStyle :2657) and MotionVisibilityService.js (getPathVisibleRange :115, the comet's tail :158–232). The
// shape is the core's (P1, `timeline.shapes`) and the progress is the lead's (P2, `lead.progress`): this module
// samples no curve and times nothing. Each line shows from its own progress, or for the comet from the lead's
// progress at one earlier moment, so a trunk and a rejoined branch agree at every moment (CROWD-07.1), and no clock is
// read. Its settings are the route's, declared once in src/core/config/settings.ts.
import { LINE_SETTINGS } from '../../../core/config/settings';
import type { Evaluation, RouteFeatureModel, RouteInput } from '../../../core/feature/contract';
import { item } from '../../../core/geometry/item';
import { pointAt } from '../../../core/geometry/path';
import type { ImagePoint } from '../../../core/geometry/units';
import type { Values } from '../../../core/schema/field';
import type { Part } from '../../../core/timing/sceneLength';
import { leadAt, type Timeline } from '../../../core/timing/timeline';

/** A line's dash, as v3's line styles (RenderingService.js:2657–2671). */
export type Dash = 'solid' | 'dashed' | 'dotted';

interface LineStyle {
  readonly colour: string;
  /** In reference pixels: the drawing scales it by the frame's render scale. */
  readonly width: number;
  readonly dash: Dash;
}

/** One stroke: a polyline at image fractions, drawn in one style. */
interface Stroke {
  readonly points: readonly ImagePoint[];
  readonly style: LineStyle;
}

/** What the line draws in a frame: its strokes, in the lead's walk order, then the lines the lead leaves out. */
export interface LineDrawing {
  readonly strokes: readonly Stroke[];
}

type Settings = Values<typeof LINE_SETTINGS>;

/** Which share of a line shows, from its progress and its id: [from, to], nothing when `to` is not past `from`. */
type Shown = (progress: number, lineId: string) => readonly [number, number];

/**
 * The share of a line that shows, from the line's progress alone (v3's getPathVisibleRange :127–140): the whole
 * line; from its start to the lead (revealed as the lead passes); from the lead to its end (hidden as it passes).
 */
const SHOWN: Record<'whole' | 'grows' | 'shrinks', Shown> = {
  whole: () => [0, 1],
  grows: (progress) => [0, progress],
  shrinks: (progress) => [progress, 1],
};

/** v3's cap on the comet: its trail is at most four fifths of the way walked, whatever its length (TST-03.1). */
const TRAIL_CAP = 0.8;
/** v3's time after the comet has closed on the lead's end, before the scene ends (v3/src/app/pathTiming.js:812). */
const TRAIL_HANDLE_MS = 500;

interface Walked {
  readonly lineId: string;
  readonly departMs: number;
  readonly arriveMs: number;
  /** In image widths, as the core measures it. */
  readonly length: number;
}

/**
 * The lead's walk read as v3's one path (D139): the share walked is the walked lines' length behind the lead over
 * their whole length, in walk order, so on a route with no branch it is v3's path progress.
 */
interface Course {
  readonly lines: readonly Walked[];
  readonly total: number;
  /** The share walked at every moment a walked line starts or ends, and at the lead's end, in order. */
  readonly marks: readonly { readonly ms: number; readonly share: number }[];
  /** How long the walked share grows for (v3's pathDuration, the walk without its rests). */
  readonly movingMs: number;
  /** Where the whole lead rests before its end, a stop's pause or the final wait (v3's pause markers). */
  readonly rests: readonly { readonly startMs: number; readonly endMs: number; readonly share: number }[];
}

/** A walked line's progress at a moment, by the core's rule (`leadAt`): 1 once arrived, even when it takes no time. */
function progressAt(line: Walked, ms: number): number {
  if (ms >= line.arriveMs) return 1;
  if (ms <= line.departMs) return 0;
  return (ms - line.departMs) / (line.arriveMs - line.departMs);
}

function courseOf(timeline: Timeline): Course | null {
  const lines = timeline.lines.map(({ lineId, departMs, arriveMs }) => ({
    lineId,
    departMs,
    arriveMs,
    length: timeline.shapes.get(lineId)?.lengthWidths ?? 0,
  }));
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  if (!(total > 0)) return null;
  const walked = (ms: number) => lines.reduce((sum, line) => sum + line.length * progressAt(line, ms), 0) / total;
  const times = [...new Set([...lines.flatMap((line) => [line.departMs, line.arriveMs]), timeline.endMs])];
  const marks = times.sort((a, b) => a - b).map((ms) => ({ ms, share: walked(ms) }));
  let movingMs = 0;
  const rests: { startMs: number; endMs: number; share: number }[] = [];
  for (let i = 1; i < marks.length; i++) {
    const [before, after] = [item(marks, i - 1), item(marks, i)];
    if (after.share > before.share) movingMs += after.ms - before.ms;
    else if (before.share > 0) {
      const last = rests.at(-1);
      if (last?.endMs === before.ms) last.endMs = after.ms;
      else rests.push({ startMs: before.ms, endMs: after.ms, share: before.share });
    }
  }
  return { lines, total, marks, movingMs, rests };
}

/** v3's base tail (MotionVisibilityService.js:228–231): the trail behind the head, at most four fifths of it. */
const baseTail = (head: number, trail: number) => Math.max(0, head - Math.min(trail, TRAIL_CAP * head));

/**
 * The comet's tail as a share walked, from the moment alone (v3's _calculateTrailFadeStart with its timeline
 * context, :178–223): through a rest the tail closes on the lead over the trail's time (its length times the time
 * the lead moves), and holds there after it until the base tail catches it up; after the lead's end it closes again.
 */
function tailOf(course: Course, trail: number, head: number, ms: number, endMs: number): number {
  const fadeMs = trail * course.movingMs;
  if (!(fadeMs > 0)) return head;
  const closing = (from: number, to: number, elapsedMs: number) => from + (to - from) * Math.min(1, elapsedMs / fadeMs);
  let held = 0;
  for (const rest of course.rests) {
    if (ms < rest.startMs) break;
    const from = Math.max(held, baseTail(rest.share, trail));
    const tail = closing(from, rest.share, Math.min(rest.endMs, ms) - rest.startMs);
    if (ms < rest.endMs) return tail;
    held = tail;
  }
  const current = Math.max(held, baseTail(head, trail));
  return ms >= endMs ? closing(current, head, ms - endMs) : current;
}

/** The moment the lead had walked a share: the earliest, as nothing moves while the share stands still. */
function momentAt(course: Course, share: number): number {
  const { marks } = course;
  const k = marks.findIndex((mark) => mark.share >= share);
  if (k < 0) return item(marks, marks.length - 1).ms;
  if (k === 0) return item(marks, 0).ms;
  const [a, b] = [item(marks, k - 1), item(marks, k)];
  return a.ms + ((share - a.share) * (b.ms - a.ms)) / (b.share - a.share);
}

/**
 * The comet (v3's instantaneous appearance): each line from the lead's progress when it had walked the tail's share,
 * to its progress now, so on a route with no branch it is v3's range [tail, head], and on branches the lead's every
 * head trails back to one moment. v3 draws it at full strength: its fade from tail to head (RenderingService.js
 * :1648–1657) sits in `drawSegment`, which nothing calls (D138).
 */
function comet(trail: number, timeline: Timeline, lead: RouteInput<Settings>['lead'], timeMs: number): Shown {
  const course = courseOf(timeline);
  if (course === null) return () => [0, 0];
  const ms = Number.isFinite(timeMs) ? timeMs : 0;
  const ahead = (sum: number, line: Walked) => sum + line.length * (lead.progress.get(line.lineId) ?? 0);
  const head = course.lines.reduce(ahead, 0) / course.total;
  const tail = tailOf(course, trail, head, ms, timeline.endMs);
  if (!(tail < head)) return () => [0, 0];
  const since = leadAt(timeline, momentAt(course, tail)).progress;
  return (progress, lineId) => [since.get(lineId) ?? 0, progress];
}

/** How long the comet adds after the lead's end (v3's tail time, pathTiming.js:809–818): its fade and a handle. */
function trailEnd(settings: Settings, timeline: Timeline): Part | null {
  if (settings.appearance !== 'trail') return null;
  const course = courseOf(timeline);
  const fadeMs = course === null ? 0 : settings.trailLength * course.movingMs;
  return fadeMs > 0 ? { endsAtMs: timeline.endMs + fadeMs + TRAIL_HANDLE_MS } : null;
}

/**
 * The samples between two shares of a line, read by index as the lead's head is (`pointAt`), so a line revealed to
 * the lead ends exactly under its head. Fewer than two points when nothing shows.
 */
function between(samples: readonly ImagePoint[], from: number, to: number): ImagePoint[] {
  if (to <= from || samples.length < 2) return [];
  const last = samples.length - 1;
  const start = pointAt(samples, from);
  const end = pointAt(samples, to);
  if (start === null || end === null) return [];
  const inner = samples.slice(Math.floor(from * last) + 1, Math.ceil(to * last));
  return [start, ...inner, end];
}

const meets = (a: ImagePoint, b: ImagePoint | undefined) => b !== undefined && a.x === b.x && a.y === b.y;
const alike = (a: LineStyle, b: LineStyle) => a.colour === b.colour && a.width === b.width && a.dash === b.dash;

/**
 * The route's style for every line. The model holds no dash and no per-line style yet (LINE_SETTINGS has colour and
 * thickness alone), so every line is solid in the route's colour and width; the drawing already takes either (D135).
 */
const styleOf = ({ colour, thickness }: Settings): LineStyle => ({ colour, width: thickness, dash: 'solid' });

function evaluate({ settings, route, lead, timeMs }: RouteInput<Settings>): Evaluation<LineDrawing> {
  const { appearance } = settings;
  if (appearance === 'hidden') return { ok: true, value: { strokes: [] } };
  const { timeline } = route;
  const shown = appearance === 'trail' ? comet(settings.trailLength, timeline, lead, timeMs) : SHOWN[appearance];
  const style = styleOf(settings);
  const order = [...timeline.lines.map((line) => line.lineId), ...timeline.walk.leftOut];
  const strokes: { points: ImagePoint[]; style: LineStyle }[] = [];
  for (const lineId of order) {
    const shape = timeline.shapes.get(lineId);
    if (shape === undefined) continue;
    // A line the lead never walks is never passed: it shows as every line does before the lead reaches it.
    const [from, to] = shown(lead.progress.get(lineId) ?? 0, lineId);
    const points = between(shape.samples, from, to);
    if (points.length < 2) continue;
    const previous = strokes.at(-1);
    // Pieces that touch, in one style, are one stroke, so a dash runs on through a bend as v3's did (:1704–1779).
    if (previous && alike(previous.style, style) && meets(item(points, 0), previous.points.at(-1))) {
      previous.points.push(...points.slice(1));
    } else strokes.push({ points, style });
  }
  return { ok: true, value: { strokes } };
}

export const LINE: RouteFeatureModel<typeof LINE_SETTINGS, LineDrawing> = {
  id: 'line',
  title: 'Line',
  description: 'The route’s line: its colour, how thick it is drawn and how it appears as the lead moves.',
  group: 'core',
  settings: LINE_SETTINGS,
  select: (settings) => settings.line,
  evaluate,
  end: ({ settings, route }) => trailEnd(settings, route.timeline),
};
