// CORE-04: the lead's head, a route module (the plan's §7 and §8, P2): where each of the lead's heads is drawn at a
// moment, which way it points and how it looks. Ported from v3's RenderingService.js (renderPathHead :2001 and the
// heading it takes from getHeadDirection :701, with MotionVisibilityService.js's AOV_DIRECTION :315). Where the heads
// are is the core's (P2, `lead.heads`, one for each active branch): this module times nothing and samples no curve,
// and reads no clock. Its settings are the route's lead group, declared once in src/core/config/settings.ts; the
// timing among them is the core's (src/core/timing), which this module leaves as it is.
import { LEAD_SETTINGS } from '../../../core/config/settings';
import type { Evaluation, RouteFeatureModel, RouteInput } from '../../../core/feature/contract';
import type { ImagePoint } from '../../../core/geometry/units';
import type { Values } from '../../../core/schema/field';
import type { Timeline } from '../../../core/timing/timeline';
import { type HeadLook, lookOf } from './presets';

type Settings = Values<typeof LEAD_SETTINGS>;
type Moment = RouteInput<Settings>['lead'];
type LeadHead = Moment['heads'][number];
type Walked = Timeline['lines'][number];

/** v3's thresholds, as shares of the whole walk (D139's one path): approaching a stop, and leaving one. */
const APPROACH = 0.02;
const DEPARTURE = 0.04;
/** Just past a stop, v3 still counts the head as arriving there (getHeadDirection :785). */
const ARRIVING = 0.001;
/** v3's look-back along the samples for the head's own direction (getRawPathDir :763). */
const LOOK_BACK = 3;

/** A direction as two points, from and to: the drawing measures its angle on the canvas, where v3 measured it. */
export type Course = readonly [ImagePoint, ImagePoint];

/** Which way a head points: along `course`, turned toward `toward` by `weight`, 0 to 1 (v3's blend leaving a stop). */
export interface Heading {
  readonly course: Course;
  readonly toward: Course | null;
  readonly weight: number;
}

interface Head {
  readonly at: ImagePoint;
  /** The core's main head, on the line first in walk order: the one a camera follows. */
  readonly main: boolean;
  readonly heading: Heading;
}

/** What the lead draws in a frame: one look, and a head for each place the lead is. */
export interface LeadDrawing {
  readonly look: HeadLook;
  readonly heads: readonly Head[];
}

const along = (course: Course): Heading => ({ course, toward: null, weight: 0 });

/** The head's own direction (v3's getRawPathDir): from a few samples back to where it is, or the line's first step. */
function ownCourse(samples: readonly ImagePoint[], progress: number, at: ImagePoint): Course {
  const index = Math.floor(progress * (samples.length - 1));
  const first = samples[0] ?? at;
  if (index <= 0) return [first, samples[1] ?? at];
  return [samples[Math.max(0, index - LOOK_BACK)] ?? first, at];
}

/** The stop a head last passed whose window still holds, how far back it is and the line that arrived at it. */
interface Behind {
  readonly distance: number;
  readonly arrived: Walked | undefined;
}

/**
 * v3 tries every stop's window in route order and the earliest that holds wins (getHeadDirection :783–808): so of
 * the stops behind a head within the departure window, the one furthest back decides, though a nearer stop was
 * passed since (two stops closer together than the window). Walks back from the line's first stop along the lines
 * that arrived, summing their shares of the walk, while the window still holds. Null when no stop behind is in it.
 */
function behind(timeline: Timeline, line: Walked, since: number, shareOf: (line: Walked) => number): Behind | null {
  if (since > DEPARTURE) return null;
  const arrivingAt = (pointId: string) => timeline.lines.find((each) => each.to === pointId);
  const walked = new Set([line.lineId]);
  let found: Behind = { distance: since, arrived: arrivingAt(line.from) };
  for (let back = found.arrived; back !== undefined && !walked.has(back.lineId); back = found.arrived) {
    const distance = found.distance + shareOf(back);
    if (distance > DEPARTURE) break;
    walked.add(back.lineId);
    found = { distance, arrived: arrivingAt(back.from) };
  }
  return found;
}

/**
 * Which way a head points (v3's getHeadDirection). At rest at a stop, paused, waiting at a join or at the end, along
 * the straight way from the stop it came from; at the start, toward the first stop out. Moving, as the line goes,
 * except just after a stop, where it turns from the way it arrived to the line's own, and just before one, where it
 * points along the straight way to it. Thresholds are shares of the whole walk, converted to the line's own progress.
 */
function headingOf(timeline: Timeline, head: LeadHead, moment: Moment, total: number): Heading {
  const place = (pointId: string) => timeline.places.get(pointId) ?? head.at;
  const chord = (line: Walked): Course => [place(line.from), place(line.to)];
  const shareOf = (each: Walked) => (total > 0 ? (timeline.shapes.get(each.lineId)?.lengthWidths ?? 0) / total : 0);
  const line = timeline.lines.find((each) => each.lineId === head.lineId);
  if (line === undefined) {
    const out = timeline.lines.find((each) => each.from === timeline.start);
    return along(out === undefined ? [head.at, head.at] : chord(out));
  }
  if (head.pointId !== null) return along(chord(line));
  const progress = moment.progress.get(line.lineId) ?? 0;
  const own = ownCourse(timeline.shapes.get(line.lineId)?.samples ?? [], progress, head.at);
  const share = shareOf(line);
  const passed = behind(timeline, line, progress * share, shareOf);
  if (passed !== null) {
    const { distance, arrived } = passed;
    // v3 does not turn the head leaving the route's first stop: there is no way it arrived by (:791).
    if (arrived === undefined) return along(own);
    if (distance <= ARRIVING) return along(chord(arrived));
    return { course: own, toward: chord(arrived), weight: 1 - distance / DEPARTURE };
  }
  return (1 - progress) * share <= APPROACH ? along(chord(line)) : along(own);
}

function evaluate({ settings, route, lead }: RouteInput<Settings>): Evaluation<LeadDrawing> {
  const look = lookOf(settings.headSize);
  const { timeline } = route;
  // v3 draws no head until the lead has set off (renderPathHead :2008), and none for a hidden lead.
  const setOff = [...lead.progress.values()].some((share) => share > 0);
  if (!settings.visible || !setOff) return { ok: true, value: { look, heads: [] } };
  const total = timeline.lines.reduce((sum, each) => sum + (timeline.shapes.get(each.lineId)?.lengthWidths ?? 0), 0);
  const heads = lead.heads.map((head) => ({
    at: head.at,
    main: head === lead.main,
    heading: headingOf(timeline, head, lead, total),
  }));
  return { ok: true, value: { look, heads } };
}

export const LEAD: RouteFeatureModel<typeof LEAD_SETTINGS, LeadDrawing> = {
  id: 'lead',
  title: 'Lead',
  description: 'What travels along the route: its head, how large it is drawn and how it is timed.',
  group: 'core',
  settings: LEAD_SETTINGS,
  select: (settings) => settings.lead,
  evaluate,
  // The lead's walk is already the timeline's, which the core counts in the content's end: its head then rests at
  // the last stop, adding no time of its own (P3).
  end: () => null,
  // Where the lead is, drawn or not: its main head, from the moment the route has one.
  traveller: { positionAt: ({ lead }) => lead.main?.at ?? null },
};
