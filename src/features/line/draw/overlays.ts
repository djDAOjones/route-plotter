// CORE-04 stage 6: the editor's overlays that follow a line (the plan's §6 and §8; DEF-99.1). The editor hands the
// maker the ids of the routes it is editing and puts the overlay it gets back in the request's list; no module ever
// sees them. The overlay reads each route from the frame it draws over (screen.routes: the shape and timeline every
// module was handed, and the settings the frame's scene holds) and draws in screen pixels, after every layer.
//
// A hidden line's faint guide (§6: "hidden, when the editor draws a faint guide that no export draws"). The line's own
// evaluation draws nothing under `hidden` (../model/line.ts), so the guide is drawn from the very shape each module
// was handed this frame, for each route named whose line the frame holds hidden, line by line in the route's order.
// v3's editor showed every line, so v3 has no figure for it: the look is v4's (D157), the route's own colour at half
// alpha, 2 wide, dashed 6 on and 4 off, with round joins, every length in screen pixels by unitAt(screen.zoom) as
// v3's other editor helpers are (D153), so it reads as a guide and never as the line, whatever the line's own
// thickness. Each line is its own run, broken where a place is not a number. A route named twice is drawn once, an
// id the frame does not hold draws nothing; nothing is kept between frames (D147).
import type { DrawContext } from '../../../adapters/render/context';
import type { Frame } from '../../../adapters/render/layers';
import { unitAt, type Overlay, type Place, type Screen } from '../../../adapters/render/overlays';

/** The guide's look (D157): alpha, width and dash in screen pixels at a zoom of 1. */
const GUIDE = { alpha: 0.5, width: 2, dash: [6, 4] } as const;

type ScreenRoute = NonNullable<ReturnType<Screen['routes']['get']>>;

/** A route's lines on screen, in the route's order: runs of two places or more, broken where a place is not a number. */
function runsOf(route: ScreenRoute, screen: Screen): Place[][] {
  const runs: Place[][] = [];
  for (const line of route.shape.lines) {
    let run: Place[] = [];
    for (const sample of route.timeline.shapes.get(line.id)?.samples ?? []) {
      const at = screen.place(sample);
      if (at !== null) run.push(at);
      else {
        if (run.length > 1) runs.push(run);
        run = [];
      }
    }
    if (run.length > 1) runs.push(run);
  }
  return runs;
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
    for (const run of runs) {
      for (const [i, at] of run.entries()) {
        if (i === 0) context.moveTo(at.x, at.y);
        else context.lineTo(at.x, at.y);
      }
    }
    context.stroke();
  } finally {
    context.beginPath();
    context.restore();
  }
}

/** The overlay that follows the lines of the routes named: a hidden line's faint guide, as the frame holds each route. */
export function lineOverlay(routeIds: readonly string[]): Overlay {
  return (context: DrawContext, frame: Frame, screen: Screen) => {
    const unit = unitAt(screen.zoom);
    if (!Number.isFinite(unit) || unit <= 0) return;
    for (const id of new Set(routeIds)) {
      const route = screen.routes.get(id);
      if (route === undefined || route.settings.line.appearance !== 'hidden') continue;
      const runs = runsOf(route, screen);
      if (runs.length > 0) guide(context, runs, route.settings.line.colour, unit);
    }
  };
}
