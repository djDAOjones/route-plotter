// CORE-04 stage 6: the editor's overlays that follow a line (the plan's §6 and §8; DEF-99.1). The editor hands the
// maker the ids of the routes it is editing and puts the overlay it gets back in the request's list; no module ever
// sees them. The overlay reads each route from the frame it draws over (screen.routes: the shape and timeline every
// module was handed, and the settings the frame's scene holds) and draws in screen pixels, after every layer.
//
// A hidden line's guide (§6: "hidden, when the editor draws a faint guide that no export draws"). The line's own
// evaluation draws nothing under `hidden` (../model/line.ts), so the guide is drawn from the very shape each module
// was handed this frame, for each route named whose line the frame holds hidden, line by line in the route's order.
// v3's editor showed every line, so v3 has no figure for it: the look is v4's (D157; its alpha by D266), the route's own
// colour at full alpha (D266's answer, "Full colour, dashed": D157's half alpha read 1.86:1 against the preview box, under
// WCAG 1.4.11's 3:1), still 2 wide, dashed 6 on and 4 off, with round joins, every length in screen pixels by unitAt(screen.zoom) as
// v3's other editor helpers are (D153), so it reads as a guide and never as the line, whatever the line's own
// thickness. Each line is its own run, broken where a place is not a number. A route named twice is drawn once, an
// id the frame does not hold draws nothing; nothing is kept between frames (D147).
//
// The hovered stretch (v3's hovered leg, RenderingService.js:315–350): one line of one route, named by the editor by
// route id and line id, glows as v3's did, a white stroke along its samples at the line's width on screen + 9, then
// v3's accent glow at + 4, round caps and joins. The line's width on screen is what its layer draws, thickness ×
// frame.scale × screen.zoom (./line.ts), from the frame's settings; a hidden line's is the guide's, 2 × unit. v3's 9
// and 4 went by its zoom clamp times its Graphics scale (:331); here by unitAt(screen.zoom) alone, as every editor
// helper's (D153). v3 drew the glow beneath the path (:1319–1328); every overlay is drawn last, so over the glow the
// stretch is redrawn as its own line (D208, the owner's: "Line with a halo"): the route's colour at full alpha, the
// width above, the line's own dash (./line.ts's DASHES, each length × frame.scale × screen.zoom, in step with the
// width; the model holds no dash yet, so solid), round caps and joins; a hidden line's in the guide's look, caps too. The whole
// stretch is redrawn, every sample the glow follows (D253 asks the owner whether only its shown share should be). The
// glow is drawn after the guides, the redraw after the glow, and the "+" after the redraw: the kit's
// plusHandle (v3 :424–450) at the stretch's middle, none where the editor offers no insert (v3 :403), active while the
// pointer is on it (v3's leg-plus, :410). v3's middle is the middle sample by index of its evenly resampled leg
// (segmentHitTest.js:115–128); pointAt reads a line's samples by index as v3 does (core/geometry/path.ts).
//
// The guide while paused (CORE-06, D265, Joe's D251 "End, plus a guide (d)"; brief 128, BP and BQ): `guideOverlay`
// draws the same guide for every line of every route named, whatever the line's look (hidden, trail, shrinks or
// whole), from the shape and timeline each module was handed this frame, with no progress and no time, so the whole
// route shows however far the animation has reached. The editor asks for it, for every route, only while the preview
// is not playing (../../../editor/shell/previewLogic.ts, point 4d), and no longer asks `lineOverlay` for its
// selected-only guide, which this one replaces; `lineOverlay` keeps its guide for a caller that names routes.
import type { DrawContext } from '../../../adapters/render/context';
import type { Frame } from '../../../adapters/render/layers';
import { plusHandle, unitAt, type Overlay, type Place, type Screen } from '../../../adapters/render/overlays';
import { pointAt } from '../../../core/geometry/path';
import type { ImagePoint } from '../../../core/geometry/units';
import type { Dash } from '../model/line';
import { DASHES } from './line';

/** The guide's look (D157; its alpha by D266's answer, full where it was half): alpha, width and dash in screen pixels at a zoom of 1. */
const GUIDE = { alpha: 1, width: 2, dash: [6, 4] } as const;

/** v3's hovered-leg glow (RenderingService.js:343–348): white, then HOVER_ACCENT_GLOW (constants.js:49), each wider than the line by so much at a zoom of 1. */
const GLOW = [
  { colour: 'rgba(255, 255, 255, 0.85)', wider: 9 },
  { colour: 'rgba(15, 98, 254, 0.45)', wider: 4 },
] as const;

/** The stretch under the pointer: one line of one route; `plus` is what the editor says of its "+". */
interface HoveredLine {
  readonly routeId: string;
  readonly lineId: string;
  /** No "+" where no insert is offered (v3 :403); `active` while the pointer is on the "+" itself (v3's leg-plus). */
  readonly plus: 'none' | 'idle' | 'active';
}

/** What the editor chooses besides the routes: plain values, never a module's state. */
interface LineChoices {
  readonly hovered?: HoveredLine | null;
}

/** A line's samples on screen: runs of two places or more, broken where a place is not a number. */
function runsOf(samples: readonly ImagePoint[], screen: Screen): Place[][] {
  const runs: Place[][] = [];
  let run: Place[] = [];
  for (const sample of samples) {
    const at = screen.place(sample);
    if (at !== null) run.push(at);
    else {
      if (run.length > 1) runs.push(run);
      run = [];
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/** The runs as one path. */
function trace(context: DrawContext, runs: readonly Place[][]): void {
  for (const run of runs) {
    for (const [i, at] of run.entries()) {
      if (i === 0) context.moveTo(at.x, at.y);
      else context.lineTo(at.x, at.y);
    }
  }
}

/** The guide: one stroke of the route's runs, with every style it uses set here and put back after. */
function guide(context: DrawContext, runs: readonly Place[][], colour: string, unit: number): void {
  context.save();
  try {
    context.globalAlpha = GUIDE.alpha;
    context.globalCompositeOperation = 'source-over';
    context.setLineDash(GUIDE.dash.map((length) => length * unit));
    context.lineDashOffset = 0;
    context.lineCap = 'butt';
    context.lineJoin = 'round';
    context.lineWidth = GUIDE.width * unit;
    context.strokeStyle = colour;
    context.beginPath();
    trace(context, runs);
    context.stroke();
  } finally {
    context.beginPath();
    context.restore();
  }
}

/** The glow: v3's two strokes along the stretch, wider than the line on screen, with every style it uses set here and put back after. */
function glow(context: DrawContext, runs: readonly Place[][], width: number, unit: number): void {
  context.save();
  try {
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.setLineDash([]);
    context.lineDashOffset = 0;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    trace(context, runs);
    for (const { colour, wider } of GLOW) {
      context.strokeStyle = colour;
      context.lineWidth = width + wider * unit;
      context.stroke();
    }
  } finally {
    context.beginPath();
    context.restore();
  }
}

/** The line's dash: the model holds none yet, so every line is solid as its layer draws it (../model/line.ts, D135). */
const LINE_DASH: Dash = 'solid';

/** The stretch redrawn over its glow as its own line (D208), with every style it uses set here and put back after. */
function redraw(context: DrawContext, runs: readonly Place[][], look: { colour: string; alpha: number; width: number; dash: readonly number[]; cap: 'round' | 'butt' }): void {
  context.save();
  try {
    context.globalAlpha = look.alpha;
    context.globalCompositeOperation = 'source-over';
    context.setLineDash([...look.dash]);
    context.lineDashOffset = 0;
    context.lineCap = look.cap;
    context.lineJoin = 'round';
    context.lineWidth = look.width;
    context.strokeStyle = look.colour;
    context.beginPath();
    trace(context, runs);
    context.stroke();
  } finally {
    context.beginPath();
    context.restore();
  }
}

/** The hovered stretch as the frame holds it: its runs on screen and the line's width there; null where it draws nothing. */
function stretchOf(hovered: HoveredLine, frame: Frame, screen: Screen, unit: number) {
  const route = screen.routes.get(hovered.routeId);
  const samples = route?.timeline.shapes.get(hovered.lineId)?.samples;
  if (route === undefined || samples === undefined) return null;
  const { appearance, thickness, colour } = route.settings.line;
  const hidden = appearance === 'hidden';
  const width = hidden ? GUIDE.width * unit : thickness * frame.scale * screen.zoom;
  const look = hidden
    ? { colour, alpha: GUIDE.alpha, width, dash: GUIDE.dash.map((length) => length * unit), cap: 'butt' as const }
    : { colour, alpha: 1, width, dash: DASHES[LINE_DASH].map((length) => length * frame.scale * screen.zoom), cap: 'round' as const };
  const runs = runsOf(samples, screen);
  return runs.length > 0 && Number.isFinite(width) && width > 0 ? { runs, width, samples, look } : null;
}

/**
 * The guide while paused (D265): every line of each route named, whatever its look, in the guide's look (D157), one
 * stroke a route, in the routes' order. A route named twice is drawn once; an id the frame does not hold draws nothing.
 */
export function guideOverlay(routeIds: readonly string[]): Overlay {
  return (context: DrawContext, _frame: Frame, screen: Screen) => {
    const unit = unitAt(screen.zoom);
    if (!Number.isFinite(unit) || unit <= 0) return;
    for (const id of new Set(routeIds)) {
      const route = screen.routes.get(id);
      if (route === undefined) continue;
      const runs = route.shape.lines.flatMap((line) => runsOf(route.timeline.shapes.get(line.id)?.samples ?? [], screen));
      if (runs.length > 0) guide(context, runs, route.settings.line.colour, unit);
    }
  };
}

/**
 * The overlay that follows the lines of the routes named, as the frame holds each: a hidden line's guide, then
 * the hovered stretch's glow, the stretch redrawn over it as its own line (D208), and its "+". Called with ids alone it draws the guides and nothing more.
 */
export function lineOverlay(routeIds: readonly string[], { hovered = null }: LineChoices = {}): Overlay {
  return (context: DrawContext, frame: Frame, screen: Screen) => {
    const unit = unitAt(screen.zoom);
    if (!Number.isFinite(unit) || unit <= 0) return;
    for (const id of new Set(routeIds)) {
      const route = screen.routes.get(id);
      if (route === undefined || route.settings.line.appearance !== 'hidden') continue;
      const runs = route.shape.lines.flatMap((line) => runsOf(route.timeline.shapes.get(line.id)?.samples ?? [], screen));
      if (runs.length > 0) guide(context, runs, route.settings.line.colour, unit);
    }
    const stretch = hovered === null ? null : stretchOf(hovered, frame, screen, unit);
    if (stretch === null || hovered === null) return;
    glow(context, stretch.runs, stretch.width, unit);
    redraw(context, stretch.runs, stretch.look);
    if (hovered.plus === 'none') return;
    const middle = pointAt(stretch.samples, 0.5);
    const at = middle === null ? null : screen.place(middle);
    if (at !== null) plusHandle(context, at, hovered.plus === 'active', unit);
  };
}
