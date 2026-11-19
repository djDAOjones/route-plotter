// CORE-02: the scene's length (the plan's §4, T1, A2b): from its content unless the author fixes it, through the one
// clock, so the editor, a video export and the player all read the same length. Each part of the content says when it
// ends, and the content runs to the latest end. Animation that cycles never ends by itself, so it is bounded twice:
// by a grace period, its release end plus the time its slowest dot takes to cover every line it can reach once (§4);
// and by the author's control, the fixed length the clock already holds, which cuts it. No new saved field (D-number
// in the pull request, provisional under the owner's grant G3).
import { playLength } from '../clock/clock';
import { LIMITS } from '../config/limits';
import type { Route, Scene } from '../model/scene';
import { routeShape } from './shape';
import { composeTimeline } from './timeline';
import { leadWalk, waysOut } from './walk';

/** A part of the scene besides the routes' leads, as its feature reports it, in milliseconds of the content. */
export type Part =
  /** A part that finishes: a crowd whose dots finish, an arrival effect once settled, a label once faded. */
  | { readonly endsAtMs: number }
  /** Animation that cycles, such as a crowd that repeats or respawns: it lasts its allowance past its release end. */
  | { readonly cycles: { readonly releaseEndMs: number; readonly allowanceMs: number } };

/**
 * A time a feature reports, read so that no part can make the scene endless or run before it starts: a time that is
 * not a number counts as 0, and none runs past the longest time a scene may hold (LIMITS.timeMs), sums included.
 */
const bounded = (ms: number) => (Number.isFinite(ms) ? Math.min(Math.max(0, ms), LIMITS.timeMs) : 0);

function endOf(part: Part): number {
  if ('endsAtMs' in part) return bounded(part.endsAtMs);
  return bounded(bounded(part.cycles.releaseEndMs) + bounded(part.cycles.allowanceMs));
}

/** When the content has ended: the latest of each route's lead and each part. `aspect` is the image's height / width. */
export function contentEndMs(scene: Pick<Scene, 'routes'>, aspect: number, parts: readonly Part[] = []): number {
  const leads = scene.routes.map((route) => composeTimeline(route, aspect).endMs);
  return Math.max(0, ...leads, ...parts.map(endOf));
}

/** The scene's whole length: Hold at start, the content, Hold at end; or the author's fixed length, which trims. */
export function sceneLength(scene: Pick<Scene, 'routes' | 'settings'>, aspect: number, parts: readonly Part[] = []) {
  return playLength(scene.settings.clock, contentEndMs(scene, aspect, parts));
}

/**
 * The grace period for animation that cycles on a route (§4): the time a dot at `speed` image widths a second takes to
 * cover, once, every line it can reach from the points it sets off from, each line in the ways it runs. Finite on any
 * route, loops included; it shows the crowd moving over all its lines, without promising that every dot completes a
 * journey. A speed that is not a positive number moves nothing, so asks for no time; a speed so slow that the time
 * would pass the longest a scene may hold (LIMITS.timeMs) asks for that.
 */
export function cycleAllowanceMs(
  route: Pick<Route, 'points' | 'lines' | 'leadStart'>,
  aspect: number,
  speed: number,
  from: readonly string[],
): number {
  if (!(Number.isFinite(speed) && speed > 0)) return 0;
  const ways = waysOut(route.lines);
  const reached = new Set<string>();
  const seen = new Set(from);
  const next = [...seen];
  for (let at = next.pop(); at !== undefined; at = next.pop()) {
    for (const step of ways.get(at) ?? []) {
      reached.add(step.lineId);
      if (!seen.has(step.to)) {
        seen.add(step.to);
        next.push(step.to);
      }
    }
  }
  const shapes = routeShape(route, leadWalk(route), aspect);
  const widths = [...reached].reduce((sum, lineId) => sum + (shapes.get(lineId)?.lengthWidths ?? 0), 0);
  return Math.min((widths / speed) * 1000, LIMITS.timeMs);
}
