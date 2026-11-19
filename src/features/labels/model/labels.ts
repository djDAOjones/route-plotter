// CORE-04: the stops' labels, a route module (the plan's §7 and §8, P1 and P2): each stop's own text near where it
// stands, none for a bend or an empty label, shown as the route's appearance says. Ported from v3's renderLabel
// (v3/src/services/RenderingService.js:2534–2651). Its settings are the route's labels group, declared once in
// src/core/config/settings.ts; the text is each stop's own (POINT_FIELDS.label). It reads no clock and keeps nothing
// between frames.
import { LABEL_SETTINGS } from '../../../core/config/settings';
import type { Evaluation, RouteFeatureModel, RouteInput } from '../../../core/feature/contract';
import type { ImagePoint } from '../../../core/geometry/units';
import type { Values } from '../../../core/schema/field';

type Settings = Values<typeof LABEL_SETTINGS>;

/**
 * How every label of a route is drawn, its place, text and opacity apart. v3 read each of these per stop (labelSize,
 * labelWidth, labelOffsetX, labelOffsetY, labelColor, labelBgColor, labelBgOpacity, :2562–2570); v4 holds them for the
 * whole route until a small item of its own adds them per stop (D137).
 */
export interface LabelLook {
  /** The type size in reference pixels: the drawing scales it by the frame's render scale. */
  readonly size: number;
  /** The widest a line may run, in percent of the frame's width (v3's displayWidth, :2568). */
  readonly width: number;
  /** How far right of its stop the label's centre sits, in percent of the frame's width (:2569). */
  readonly offsetX: number;
  /** How far below its stop the label's centre sits, in percent of the frame's height (:2570). */
  readonly offsetY: number;
  readonly textColour: string;
  readonly backgroundColour: string;
  /** From 0 to 1; v3 draws no box at 0 (:2614). */
  readonly backgroundOpacity: number;
}

/** One stop's label in a frame: where its stop stands, its text, and how solid it is (v3's fade opacity). */
interface Label {
  readonly pointId: string;
  readonly at: ImagePoint;
  readonly text: string;
  readonly opacity: number;
}

/** What the labels draw in a frame: one look, and a label for each stop whose label shows. */
export interface LabelsDrawing {
  readonly look: LabelLook;
  readonly labels: readonly Label[];
}

/** The labels' look: the one place to read the route's label settings. */
function lookOf(settings: Settings): LabelLook {
  const { size, width, offsetX, offsetY, textColour, backgroundColour, backgroundOpacity } = settings;
  return { size, width, offsetX, offsetY, textColour, backgroundColour, backgroundOpacity };
}

function evaluate({ settings, route }: RouteInput<Settings>): Evaluation<LabelsDrawing> {
  const look = lookOf(settings);
  // v3 draws nothing under `off` or for a stop with no text (:2536).
  if (settings.appearance === 'off') return { ok: true, value: { look, labels: [] } };
  const labels = route.shape.points
    .filter((point) => point.kind === 'stop' && point.label !== '')
    .map((point) => ({
      pointId: point.id,
      at: { x: point.x, y: point.y },
      text: point.label,
      // Whole under `on`. Until the fades are built (CORE-04 stage 5b-2's second piece), `fade in` and `fade in and
      // out` show whole too, at every moment.
      opacity: 1,
    }));
  return { ok: true, value: { look, labels } };
}

export const LABELS: RouteFeatureModel<typeof LABEL_SETTINGS, LabelsDrawing> = {
  id: 'labels',
  title: 'Labels',
  description: 'Each stop’s own text, near where it stands, and when it shows.',
  group: 'core',
  settings: LABEL_SETTINGS,
  select: (settings) => settings.labels,
  evaluate,
  // A label fades around the lead's arrival, inside the lead's own walk (v3 measures it in the lead's progress), which
  // the core already counts in the content's end (P3; the plan's §8 table: route, per stop, core).
  end: () => null,
};
