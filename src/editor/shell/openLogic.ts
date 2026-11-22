// CORE-05, stage 6: Open's rule, as logic with no page. A project file's bytes are opened into the editor's store, so
// an opened project plays at once with its timing built (the item's third criterion, its open half) and the open is
// announced, not a pause nobody asked for (DEF-67, the stock-take's lines 185 to 186). v3 said "Project loaded"
// (persistence.js:1376); every v4 refusal ends "Nothing was opened.", so the open says "Project opened".
// Nothing here names a browser global: the store, the queue's `announce`, the decoder and, for a test, `openProject`
// itself are handed in, so Node proves it with a store, both transports and a queue that records. The page hands in the
// browser's decoder and draws what the opener holds (the next chat's).
//
// Its claim (one opener made once a session, `createOpener`; `open(bytes)` once for each file asked for):
// 1. A file's bytes are opened through `openProject(bytes, decode)` and nothing else, with the decoder handed in; on a
//    project, `store.open(project)`, once.
// 2. A refusal changes nothing: the store is not called, so its state is the same object as before, a playing goes on
//    playing and no undo step is lost. The refusal is given back as `openProject` gave it, its `message` as it stands,
//    and held in the opener's state (`read().refusal`, with a telling when it changes). It is not said through the
//    queue: how a refusal is shown and spoken is the page's. A new open asked for clears the refusal held, at once.
// 3. If the store refuses what `openProject` passed, or throws on it, nothing changes and no error escapes: it is
//    given back and held as a refusal of io's own kind (`reason: 'invalid'`), in io's words (`WORDS.openedInvalid`).
//    The store's own problems are kept, their paths put under `scene` as io's are (`scene.routes[0]...`); a throw, or a
//    refusal with no problems, is one problem for the whole project. A stand-in `openProject` that throws is given back
//    as io's own catch-all is (`WORDS.openedUnsafe`, "it is damaged").
// 4. DEF-67: when a project opens, `announce` is handed `OPEN_WORDS.opened`, once, after the store has taken it; the
//    opener says nothing else, ever. It neither pauses nor touches either transport: the store's Open writes "paused"
//    at the start (AT_START), which the player's transport's frame already booked meets, saying nothing and booking no
//    more (its claim's point 2). So nothing says "Animation paused", whether or not something was playing.
// 5. Criterion 3's open half: the store's Open puts the playback at the start, at normal speed, not playing; so once
//    the open's promise settles, the editor's transport's `play()` plays at once from 0 at normal speed, the length
//    built from the opened scene (the player's transport builds it when its inputs, the store's scene, are not those
//    it last built from). Opening never starts a playing by itself.
// 6. Only the latest open asked for may reach the store. An earlier one still being read when a later one is asked for
//    changes nothing, holds nothing and says nothing when it settles, whichever settles first: its caller is given
//    `{ kind: 'superseded' }`. The latest's caller is given `{ kind: 'opened' }` or `{ kind: 'refused', refusal }`.
// 7. Whether an open is under way is held in the opener's state (`read().opening`, with a telling when it changes): true
//    from the moment an open is asked for until the latest one asked for settles. Nothing is said or drawn for it here.
// 8. It keeps nothing of a file between opens but the refusal of point 2: no bytes, no project (the store owns its own
//    copy). Its state holds `opening` and `refusal` only, and is the same frozen object until one of them changes.
import { openProject as ioOpenProject, type Opened } from '../../adapters/io/open';
import type { Decode } from '../../adapters/io/images';
import type { Project } from '../../adapters/io/format';
import { WORDS as IO_WORDS, type Problem, type Refusal } from '../../adapters/io/words';
import type { Announce } from '../kit/announce';
import type { Store } from '../store/store';

/** Every word the opener says: only the open itself (a refusal's words are io's, shown by the page). */
export const OPEN_WORDS = Object.freeze({
  /** Said once a project is opened: v3's "Project loaded", in the word every v4 refusal uses (provisional). */
  opened: 'Project opened',
});

/** What the page reads: the same frozen object until one field changes. */
interface OpenerState {
  /** Whether an open asked for is still being read (the latest one asked for). */
  readonly opening: boolean;
  /** Why the latest open was refused, as io words it, or null: cleared when a new open is asked for. */
  readonly refusal: Refusal | null;
}

/** What `open` gives its caller. */
type OpenResult =
  | { readonly kind: 'opened' }
  | { readonly kind: 'refused'; readonly refusal: Refusal }
  /** A later open was asked for before this one settled: this one changed nothing. */
  | { readonly kind: 'superseded' };

export interface Opener {
  /** Opens a project file's bytes into the store; never rejects. */
  open(bytes: Uint8Array): Promise<OpenResult>;
  read(): OpenerState;
  /** Calls `listener` when the state changes; gives back the call that stops it. */
  subscribe(listener: () => void): () => void;
}

export interface OpenerOptions {
  readonly store: Pick<Store, 'open'>;
  readonly announce: Announce;
  /** The page's decoder: the browser's (`createImageBitmap`); a test's own in Node. */
  readonly decode: Decode;
  /** io's Open; handed in only by a test that stands in for it. */
  readonly openProject?: (bytes: Uint8Array, decode: Decode) => Promise<Opened>;
}

const QUIET: OpenerState = Object.freeze({ opening: false, refusal: null });

/** The store's refusal or throw, as io words a refusal: the store's problems under `scene`, or one for the whole. */
function storeRefusal(problems: readonly Problem[] | null): Refusal {
  const listed: readonly Problem[] =
    problems !== null && problems.length > 0
      ? problems.map((problem) => ({ ...problem, path: problem.path === '' ? 'scene' : `scene.${problem.path}` }))
      : [{ path: '', rule: 'type', expected: 'a project the editor can hold', received: 'one it could not take' }];
  return { reason: 'invalid', message: IO_WORDS.openedInvalid(listed), problems: listed };
}

/** The store's Open, never throwing: null when it took the project, else why not, as io words it. */
function intoStore(store: Pick<Store, 'open'>, project: Project): Refusal | null {
  try {
    const outcome = store.open(project);
    if (outcome.ok) return null;
    return storeRefusal('problems' in outcome.refusal ? outcome.refusal.problems : null);
  } catch {
    return storeRefusal(null);
  }
}

export function createOpener({ store, announce, decode, openProject = ioOpenProject }: OpenerOptions): Opener {
  let state = QUIET;
  /** How many opens have been asked for: an open may act only while it is the latest. */
  let asked = 0;
  const listeners = new Set<() => void>();

  const hold = (next: OpenerState): void => {
    if (next.opening === state.opening && next.refusal === state.refusal) return;
    state = next.opening || next.refusal !== null ? Object.freeze({ ...next }) : QUIET;
    for (const listener of [...listeners]) listener();
  };

  const read = async (bytes: Uint8Array): Promise<Opened> => {
    try {
      return await openProject(bytes, decode);
    } catch {
      return { ok: false, refusal: { reason: 'unsafe', message: IO_WORDS.openedUnsafe('it is damaged: part of it could not be unpacked') } };
    }
  };

  return Object.freeze({
    open: async (bytes: Uint8Array): Promise<OpenResult> => {
      asked += 1;
      const mine = asked;
      hold({ opening: true, refusal: null });
      const opened = await read(bytes);
      if (mine !== asked) return { kind: 'superseded' };
      const refusal = opened.ok ? intoStore(store, opened.project) : opened.refusal;
      if (refusal === null) {
        announce(OPEN_WORDS.opened);
        hold({ opening: false, refusal: null });
        return { kind: 'opened' };
      }
      hold({ opening: false, refusal });
      return { kind: 'refused', refusal };
    },
    read: () => state,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
}
