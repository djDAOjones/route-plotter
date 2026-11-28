// CORE-05: every change to the project is a command (the plan's §8, A19): a typed value with the words of its undo step
// and a pure `apply` from what is now to what comes next. There is no string-event bus and no setter round the store:
// the store runs a command, then checks the scene it gives with CORE-01's declarations (`checkScene`), so no range,
// choice or rule is declared twice. A command reads no clock and no random source; a new id comes from the injected
// `nextId` (CORE-01's hand-over). A command changes only what it names, keeping every other value and key order as it
// was, so the project after a set of edits never depends on their order (DEF-10's lesson).
import type { Project } from '../../adapters/io/format';
import type { EditRefusal } from '../../core/model/commands/graph';
import type { Checked } from '../../core/schema/check';
import { newRoute, type IdSource, type Route, type Scene } from '../../core/model/scene';
import type { Selection } from './selection';

/** What a command reads and gives: the project and the selection. */
export interface Current {
  readonly project: Project;
  readonly selection: Selection;
}

type Problems = Extract<Checked<Scene>, { ok: false }>['problems'];

/** Why the store changed nothing. */
export type Refusal =
  | { readonly why: 'gesture-open' | 'gesture-closed' | 'nothing-to-undo' | 'nothing-to-redo' | 'not-a-playback' }
  | { readonly why: 'missing'; readonly what: string }
  | { readonly why: 'invalid'; readonly problems: Problems }
  /** A drawing edit the route could not take (CORE-06): the core's own refusal, naming what it refused. */
  | { readonly why: 'refused-edit'; readonly refusal: EditRefusal };

interface CommandContext {
  readonly nextId: IdSource;
}

export interface Command {
  /** The undo step's words when the command is dispatched alone, such as "Move point". */
  readonly label: string;
  readonly apply: (current: Current, context: CommandContext) => Current | Refusal;
}

type SceneSettings = Scene['settings'];
type RouteSettings = Route['settings'];
type Point = Route['points'][number];

/** `record` with `key` set to `value`, every other key kept in its place. */
function withKey<T extends object, K extends keyof T>(record: T, key: K, value: T[K]): T {
  return { ...record, [key]: value };
}

function withScene(current: Current, scene: Scene): Current {
  return { project: { ...current.project, scene }, selection: current.selection };
}

function changeRoute(current: Current, routeId: string, change: (route: Route) => Route | Refusal): Current | Refusal {
  const routes = current.project.scene.routes;
  const route = routes.find((each) => each.id === routeId);
  if (route === undefined) return { why: 'missing', what: `route ${routeId}` };
  const changed = change(route);
  if ('why' in changed) return changed;
  return withScene(current, { ...current.project.scene, routes: routes.map((each) => (each === route ? changed : each)) });
}

/** One scene setting, such as the clock's fixed length: one module's one field. */
export function setSceneSetting<M extends keyof SceneSettings, K extends keyof SceneSettings[M]>(
  module: M,
  key: K,
  value: SceneSettings[M][K],
): Command {
  return {
    label: `Change the ${module} settings`,
    apply: (current) => {
      const settings = current.project.scene.settings;
      const scene = { ...current.project.scene, settings: withKey(settings, module, withKey(settings[module], key, value)) };
      return withScene(current, scene);
    },
  };
}

/** One route setting, such as the line's width: one module's one field on one route. */
export function setRouteSetting<M extends keyof RouteSettings, K extends keyof RouteSettings[M]>(
  routeId: string,
  module: M,
  key: K,
  value: RouteSettings[M][K],
): Command {
  return {
    label: `Change the ${module} settings`,
    apply: (current) =>
      changeRoute(current, routeId, (route) => {
        const settings = route.settings;
        return { ...route, settings: withKey(settings, module, withKey(settings[module], key, value)) };
      }),
  };
}

/** A new, empty route at the end of the list, at its default settings, and selected. */
export function addRoute(): Command {
  return {
    label: 'Add route',
    apply: (current, { nextId }) => {
      const route = newRoute(nextId);
      const scene = { ...current.project.scene, routes: [...current.project.scene.routes, route] };
      return { project: { ...current.project, scene }, selection: { route: route.id, points: [] } };
    },
  };
}

/** The route gone, with its points and lines; the store drops it from the selection. */
export function removeRoute(routeId: string): Command {
  return {
    label: 'Remove route',
    apply: (current) => {
      const routes = current.project.scene.routes;
      if (!routes.some((route) => route.id === routeId)) return { why: 'missing', what: `route ${routeId}` };
      return withScene(current, { ...current.project.scene, routes: routes.filter((route) => route.id !== routeId) });
    },
  };
}

/** One point moved to `at`, in image fractions: a drag applies one of these per move, inside one gesture. */
export function movePoint(routeId: string, pointId: string, at: Pick<Point, 'x' | 'y'>): Command {
  return {
    label: 'Move point',
    apply: (current) =>
      changeRoute(current, routeId, (route) => {
        const point = route.points.find((each) => each.id === pointId);
        if (point === undefined) return { why: 'missing', what: `point ${pointId}` };
        const moved = { ...point, x: at.x, y: at.y };
        return { ...route, points: route.points.map((each) => (each === point ? moved : each)) };
      }),
  };
}
