// CORE-04: the line, a route module (the plan's §6 and §8): which part of each of the route's lines shows at a
// moment, and in what style. Ported from v3's RenderingService.js (renderPath :1548, its continuous path :1706,
// applyLineStyle :2657) and MotionVisibilityService.js (getPathVisibleRange :115). The shape is the core's (P1,
// `timeline.shapes`) and the progress is the lead's (P2, `lead.progress`): this module samples no curve and times
// nothing. Each line shows from its own progress alone, so a trunk and a rejoined branch agree at every moment
// (CROWD-07.1), and no clock is read. Its settings are the route's, declared once in src/core/config/settings.ts.
import { LINE_SETTINGS } from '../../../core/config/settings';
import type { Evaluation, RouteFeatureModel, RouteInput } from '../../../core/feature/contract';
import { item } from '../../../core/geometry/item';
import { pointAt } from '../../../core/geometry/path';
import type { ImagePoint } from '../../../core/geometry/units';
import type { Values } from '../../../core/schema/field';

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

/**
 * The share of a line that shows, from the line's progress alone (v3's getPathVisibleRange :127–140): the whole
 * line; from its start to the lead (revealed as the lead passes); from the lead to its end (hidden as it passes).
 */
const SHOWN: Record<'whole' | 'grows' | 'shrinks', (progress: number) => readonly [number, number]> = {
  whole: () => [0, 1],
  grows: (progress) => [0, progress],
  shrinks: (progress) => [progress, 1],
};

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

function evaluate({ settings, route, lead }: RouteInput<Settings>): Evaluation<LineDrawing> {
  const { appearance } = settings;
  if (appearance === 'hidden') return { ok: true, value: { strokes: [] } };
  if (appearance === 'trail') return { ok: false, reason: 'The trail appearance is not built yet (CORE-04 stage 4b).' };
  const shown = SHOWN[appearance];
  const style = styleOf(settings);
  const { timeline } = route;
  const order = [...timeline.lines.map((line) => line.lineId), ...timeline.walk.leftOut];
  const strokes: { points: ImagePoint[]; style: LineStyle }[] = [];
  for (const lineId of order) {
    const shape = timeline.shapes.get(lineId);
    if (shape === undefined) continue;
    // A line the lead never walks is never passed: it shows as every line does before the lead reaches it.
    const [from, to] = shown(lead.progress.get(lineId) ?? 0);
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
  end: () => null,
};
