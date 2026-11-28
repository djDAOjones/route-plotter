// CORE-05, stage 4: the fitting of the store to the control kit. A control is handed a `Setting` (src/editor/kit/
// controls.ts): the value held, read from the store each time it is asked, and an edit scoped to one setting, which is
// the store's gesture with every value set through one command maker. The shell owns this wiring, as it owns dispatch,
// so a feature's panel is handed a `Setting` and never the store (the plan's rule 3). A refusal comes back in words a
// field can show; the model's own problems are passed on in the words its declarations give them.
import type { Project } from '../../adapters/io/format';
import type { Route, Scene } from '../../core/model/scene';
import type { Begun, Result, Setting } from '../kit/controls';
import { setRouteSetting, setSceneSetting, type Command, type Refusal } from '../store/command';
import type { Store } from '../store/store';

type Outcome = ReturnType<Store['dispatch']>;

/** The words a field shows for each refusal the store can give an edit, in the glossary's words. */
export const WORDS = {
  gestureOpen: 'Another change is in progress. Finish it, then try again.',
  gestureClosed: 'That change was ended elsewhere, so nothing was kept.',
  missing: 'This setting is no longer there.',
  nothingToUndo: 'There is nothing to undo.',
  nothingToRedo: 'There is nothing to redo.',
  notAPlayback: 'That is not a position or speed the player can take.',
} as const;

/** The words for `refusal`: the model's problems as its declarations word them, each a value the setting accepts. */
function wordsFor(refusal: Refusal): string {
  switch (refusal.why) {
    case 'invalid':
      return `Enter ${refusal.problems.map((problem) => problem.expected).join('; ')}.`;
    case 'gesture-open':
      return WORDS.gestureOpen;
    case 'gesture-closed':
      return WORDS.gestureClosed;
    case 'missing':
      return WORDS.missing;
    case 'nothing-to-undo':
      return WORDS.nothingToUndo;
    case 'nothing-to-redo':
      return WORDS.nothingToRedo;
    case 'not-a-playback':
      return WORDS.notAPlayback;
    case 'refused-edit':
      // A drawing edit's refusal (CORE-06); the settings never dispatch one. Not in WORDS, which D181 agreed word for word.
      return 'That change cannot be made on this route.';
  }
}

function resultOf(outcome: Outcome): Result {
  return outcome.ok ? outcome : { ok: false, why: wordsFor(outcome.refusal) };
}

/**
 * Whether `value` may stand where `held` stands: so when both are numbers, since a field that holds a number takes any
 * number its command is given, and the model's check (`checkScene`) then holds it to the field's range. A guard and not
 * an assertion, so the types are proved, not claimed.
 */
function standsFor<V>(held: V, value: number): value is V & number {
  return typeof held === typeof value;
}

/**
 * A `Setting` on `store` for one field that holds a number: `read` finds the field's value in the project held now
 * (undefined when it is not there), and `change` makes the command that sets it. An edit begins the store's gesture,
 * named as the command names its step; with no number held, none begins.
 */
function fitSetting<V>(
  store: Store,
  read: (project: Project) => V | undefined,
  change: (value: V) => Command,
): Setting {
  const held = (): number | undefined => {
    const value = read(store.getState().project);
    return typeof value === 'number' ? value : undefined;
  };
  return {
    read: held,
    subscribe: (listener) => store.subscribe(listener),
    begin: (): Begun => {
      const found = read(store.getState().project);
      if (typeof found !== 'number') return { ok: false, why: WORDS.missing };
      const begun = store.begin(change(found).label);
      if (!begun.ok) return { ok: false, why: wordsFor(begun.refusal) };
      const { gesture } = begun;
      return {
        ok: true,
        edit: {
          set: (next) => (standsFor(found, next) ? resultOf(gesture.apply(change(next))) : { ok: false, why: WORDS.missing }),
          commit: () => resultOf(gesture.commit()),
          cancel: () => resultOf(gesture.cancel()),
        },
      };
    },
  };
}

type SceneSettings = Scene['settings'];
type RouteSettings = Route['settings'];
/** The keys of `T` whose values are numbers: the settings a slider or a number field can hold. */
type NumberKey<T> = { [K in keyof T]-?: T[K] extends number ? K : never }[keyof T];

/** One scene setting that is a number, such as the clock's fixed length. */
export function sceneSetting<M extends keyof SceneSettings, K extends NumberKey<SceneSettings[M]>>(
  store: Store,
  module: M,
  key: K,
): Setting {
  return fitSetting(
    store,
    (project) => project.scene.settings[module][key],
    (value) => setSceneSetting(module, key, value),
  );
}

/** One setting that is a number on the route `routeId`, such as its line's thickness; none while that route is gone. */
export function routeSetting<M extends keyof RouteSettings, K extends NumberKey<RouteSettings[M]>>(
  store: Store,
  routeId: string,
  module: M,
  key: K,
): Setting {
  return fitSetting(
    store,
    (project) => project.scene.routes.find((each) => each.id === routeId)?.settings[module][key],
    (value) => setRouteSetting(routeId, module, key, value),
  );
}
