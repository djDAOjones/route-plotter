// CORE-05: the editor's store (the plan's §8 and §19). It holds the project and the selection, runs every change as a
// command (command.ts), and keeps undo and redo. v3's UndoService and undoRedo mixin, rewritten small (§15, line 1051):
// one gesture is one undo step. A gesture is opened and closed by its caller — a drag from pointer down to pointer up, a
// slider from its first move to its release, a typed value at its commit — and never by a timer: the store reads no
// clock to decide what a step is (DEF-92, CROWD-06.2), where v3 merged saves by a debounce (undoRedo.js:99). A step
// records the selection it found and the one it left, so Undo gives back the first and Redo the second (DEF-74). An
// error in one subscriber never stops the others (the plan's §15, line 986, kept from v3's EventBus). What the store
// holds and hands out is its own frozen copy (own.ts): of a project as it comes in and as a command gives it, of a
// selection, and so what `getState()` gives and what a command receives. The claim's point 4: commands, the id source,
// the reporter and subscribers are the editor's own code. A command and the id source are called, and everything the
// store reads from a command (its label, its `apply` and what that gives) is read, before `current` changes: one that
// throws leaves the state and the history as they were before the call. Subscribers and the reporter are called after
// a change is kept, to be told of it: one that throws never undoes the change, never stops the others being told, and
// is reported. Either way, what `getState()` shows is always what the next command receives. The store does not claim
// to withstand code written to break it.
//
// Beside the project, outside the undo history, the store holds the player's transport's slice (stage 2): what an
// interface shows of it, playing or not, the position and the speed. A change to it is never a step, never clears
// Redo, is taken while a gesture is open and tells subscribers as any change does, with a new state whose project is
// the same object; Open puts it back to `AT_START`; Undo, Redo and a gesture leave it, since a step and a gesture's
// start record only the project and the selection. The store is thus a `PlaybackHolder` by shape, and a transport is
// made on it (`createTransport({ holder: store, … })`); the transport never imports the store (rule 6). The claim holds
// for the slice: `setPlayback` reads each of its argument's fields once, before anything changes, and refuses one that
// is not a whole, finite playback with nothing told; a subscriber told of the change that throws never undoes it.
import type { Project } from '../../adapters/io/format';
import { checkScene, type IdSource } from '../../core/model/scene';
import { AT_START, FASTEST, SLOWEST, type Playback, type PlaybackHolder } from '../../player/transport/transport';
import type { Command, Current, Refusal } from './command';
import { own } from './own';
import { sameValue } from './sameValue';
import { NOTHING_SELECTED, repairSelection, type Selection } from './selection';

/** v3's depth (UndoService.js:20): the oldest step goes when a new one would make more. */
export const MAX_STEPS = 150;

/**
 * `changed`: for `dispatch` and `commit`, whether an undo step was made; for `cancel`, whether it put back a project or
 * selection that the gesture had changed; for the rest, whether the state changed.
 */
type Outcome = { readonly ok: true; readonly changed: boolean } | { readonly ok: false; readonly refusal: Refusal };

/** What a subscriber reads: the same object until something changes. */
interface StoreState {
  readonly project: Project;
  readonly selection: Selection;
  /** The words of the step Undo would take back, or null when there is none. */
  readonly undo: string | null;
  /** The words of the step Redo would make again, or null when there is none. */
  readonly redo: string | null;
  /** The words of the open gesture, or null when none is open. */
  readonly gesture: string | null;
  /** The transport's slice: playing or not, the position and the speed; outside the undo history. */
  readonly playback: Playback;
}

/** An open gesture: what it applies shows at once; `commit` makes it one step, `cancel` puts back what it found. */
interface Gesture {
  apply(command: Command): Outcome;
  commit(): Outcome;
  cancel(): Outcome;
}

type Begun = { readonly ok: true; readonly gesture: Gesture } | { readonly ok: false; readonly refusal: Refusal };

export interface Store extends PlaybackHolder {
  getState(): StoreState;
  /** The transport's slice, as `getState().playback` shows it. */
  playback(): Playback;
  /**
   * Keeps `next` as the transport's slice: never a step, Redo kept, taken while a gesture is open. One that is not a
   * whole, finite playback is refused before anything changes; one the same as what is held changes nothing.
   */
  setPlayback(next: Playback): Outcome;
  /** Calls `listener` after every change; gives back the call that stops it. */
  subscribe(listener: () => void): () => void;
  /** One command as one step: a gesture opened, applied and committed at once. */
  dispatch(command: Command): Outcome;
  /** Opens a gesture named `label`; refused while another is open. */
  begin(label: string): Begun;
  /** Selects what `selection` names that the project holds; never a step. */
  select(selection: Selection): Outcome;
  undo(): Outcome;
  redo(): Outcome;
  /**
   * An opened project replaces the one held: nothing selected, no steps to undo or redo, any open gesture closed. One
   * that is not plain data throws a TypeError, and one its declarations refuse is refused, before anything changes.
   */
  open(project: Project): Outcome;
}

export interface StoreOptions {
  readonly project: Project;
  readonly nextId: IdSource;
  /** Where an error a subscriber throws goes; by default it is thrown again on its own, after the others have run. */
  readonly report?: (error: unknown) => void;
}

interface Step {
  readonly label: string;
  readonly before: Current;
  readonly after: Current;
}

interface Opened {
  readonly label: string;
  readonly before: Current;
}

const refused = (refusal: Refusal): Outcome => ({ ok: false, refusal });

/** What a command receives and a step records: frozen, its project and selection the store's own already. */
const currentOf = (project: Project, selection: Selection): Current => Object.freeze({ project, selection });

function rethrowLater(error: unknown): void {
  queueMicrotask(() => {
    throw new Error('A subscriber to the editor’s store failed.', { cause: error });
  });
}

/**
 * What `setPlayback` keeps: each field of `next` read once, then frozen; null when it is not a whole, finite playback
 * (transport.ts's `Playback`: a position from 0, a speed of 0.1 to 16 times either way).
 */
function playbackOf(next: Playback): Playback | null {
  const { playing, atMs, speed } = next;
  const size = Math.abs(speed);
  const whole = typeof playing === 'boolean' && Number.isFinite(atMs) && atMs >= 0 && size >= SLOWEST && size <= FASTEST;
  return whole ? Object.freeze({ playing, atMs, speed }) : null;
}

/** The scene's problems, or null when CORE-01's declarations hold for it. */
function problemsOf(project: Project): Refusal | null {
  const verdict = checkScene(project.scene);
  return verdict.ok ? null : { why: 'invalid', problems: verdict.problems };
}

/** Throws a TypeError on a project that is not plain data (own.ts), a RangeError on one its declarations refuse. */
export function createStore({ project, nextId, report = rethrowLater }: StoreOptions): Store {
  const held = own(project);
  const invalid = problemsOf(held);
  if (invalid !== null) throw new RangeError('The editor’s store was given a project its declarations refuse.');

  let current = currentOf(held, NOTHING_SELECTED);
  let undoSteps: readonly Step[] = [];
  let redoSteps: readonly Step[] = [];
  let opened: Opened | null = null;
  let playback = AT_START;
  const listeners = new Set<{ readonly call: () => void }>();

  const stateNow = (): StoreState =>
    Object.freeze({
      project: current.project,
      selection: current.selection,
      undo: undoSteps.at(-1)?.label ?? null,
      redo: redoSteps.at(-1)?.label ?? null,
      gesture: opened?.label ?? null,
      playback,
    });
  let state = stateNow();

  function publish(): void {
    state = stateNow();
    for (const listener of [...listeners]) {
      try {
        listener.call();
      } catch (error) {
        try {
          report(error);
        } catch (failure) {
          rethrowLater(failure);
        }
      }
    }
  }

  /** Runs `command` on what is now and checks what it gives; changes `current` only when both hold. */
  function run(command: Command): Outcome {
    const next = command.apply(current, Object.freeze({ nextId }));
    if ('why' in next) return refused(next);
    const project = own(next.project);
    const invalidNext = problemsOf(project);
    if (invalidNext !== null) return refused(invalidNext);
    const selection = repairSelection(project, next.selection);
    const sameSelection = sameValue(selection, current.selection);
    const changed = project !== current.project || !sameSelection;
    if (changed) current = currentOf(project, sameSelection ? current.selection : selection);
    return { ok: true, changed };
  }

  /** Ends the open gesture: one step when the project changed, none (and Redo kept) when it ends as it began. */
  function close(gesture: Opened): Outcome {
    opened = null;
    const made = !sameValue(gesture.before.project, current.project);
    if (made) {
      undoSteps = [...undoSteps, { label: gesture.label, before: gesture.before, after: current }].slice(-MAX_STEPS);
      redoSteps = [];
    } else {
      current = currentOf(gesture.before.project, current.selection);
    }
    publish();
    return { ok: true, changed: made };
  }

  function begin(label: string): Begun {
    if (opened !== null) return { ok: false, refusal: { why: 'gesture-open' } };
    const gesture: Opened = { label, before: current };
    opened = gesture;
    publish();
    const live = (): boolean => opened === gesture;
    return {
      ok: true,
      gesture: {
        apply: (command) => {
          if (!live()) return refused({ why: 'gesture-closed' });
          const outcome = run(command);
          if (outcome.ok && outcome.changed) publish();
          return outcome;
        },
        commit: () => (live() ? close(gesture) : refused({ why: 'gesture-closed' })),
        cancel: () => {
          if (!live()) return refused({ why: 'gesture-closed' });
          opened = null;
          const changed = !sameValue(current, gesture.before);
          current = gesture.before;
          publish();
          return { ok: true, changed };
        },
      },
    };
  }

  function travel(from: readonly Step[], to: readonly Step[], toward: 'before' | 'after'): Outcome | null {
    const step = from.at(-1);
    if (step === undefined) return null;
    current = step[toward];
    const rest = from.slice(0, -1);
    const added = [...to, step];
    if (toward === 'before') [undoSteps, redoSteps] = [rest, added];
    else [redoSteps, undoSteps] = [rest, added];
    publish();
    return { ok: true, changed: true };
  }

  return {
    getState: () => state,
    playback: () => playback,
    setPlayback: (next) => {
      const kept = playbackOf(next);
      if (kept === null) return refused({ why: 'not-a-playback' });
      if (sameValue(kept, playback)) return { ok: true, changed: false };
      playback = kept;
      publish();
      return { ok: true, changed: true };
    },
    subscribe: (call) => {
      const listener = { call };
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (command) => {
      if (opened !== null) return refused({ why: 'gesture-open' });
      const { label } = command;
      const before = current;
      const outcome = run(command);
      return outcome.ok && outcome.changed ? close({ label, before }) : outcome;
    },
    begin,
    select: (selection) => {
      const repaired = repairSelection(current.project, selection);
      if (sameValue(repaired, current.selection)) return { ok: true, changed: false };
      current = currentOf(current.project, repaired);
      publish();
      return { ok: true, changed: true };
    },
    undo: () => {
      if (opened !== null) return refused({ why: 'gesture-open' });
      return travel(undoSteps, redoSteps, 'before') ?? refused({ why: 'nothing-to-undo' });
    },
    redo: () => {
      if (opened !== null) return refused({ why: 'gesture-open' });
      return travel(redoSteps, undoSteps, 'after') ?? refused({ why: 'nothing-to-redo' });
    },
    open: (next) => {
      const project = own(next);
      const invalidNext = problemsOf(project);
      if (invalidNext !== null) return refused(invalidNext);
      opened = null;
      undoSteps = [];
      redoSteps = [];
      current = currentOf(project, NOTHING_SELECTED);
      playback = AT_START;
      publish();
      return { ok: true, changed: true };
    },
  };
}
