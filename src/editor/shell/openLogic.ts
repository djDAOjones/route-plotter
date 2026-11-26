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
//    opener says nothing else, ever. A throw from `announce` is caught and dropped: the open has happened and stays
//    opened (point 6). It never pauses through either transport and never skips through the editor's (whose
//    `skipToEnd` says "Skipped to end"): the store's Open writes "paused" at the start (AT_START), which the player's
//    transport's frame already booked meets, saying nothing and booking no more (its claim's point 2), and point 5's
//    seek is the player's own, which says nothing. So nothing says "Animation paused", whether or not something was
//    playing, and nothing is said for the move to the end.
// 5. Criterion 3's open half, and D251's first half (Joe, 26 Nov: "End, plus a guide"; brief 127, BG to BJ): once the
//    store has taken a project, and before "Project opened" is said, the opener seeks the player's transport handed in
//    to its play length, `player.seek(player.length())`, the place End reaches (Hold at start, the content's end with a
//    trail's run-on, Hold at end), as v3 opened at its end. So an opened project waits paused at its end, at normal
//    speed: what was drawn is in view. The length is read after the store has the opened project, so it is built from
//    the opened scene and its picture's size (the inputs read the picture's header as soon as the store holds it:
//    previewLogic.ts's point 2), never a length from before the open. Only an open the store has taken seeks (point
//    6): a refusal, a superseded open and the store's own refusal or throw move nothing. A throw from the seek is
//    caught and dropped, as `announce`'s is. Play after an open plays from 0 at normal speed, the length built from the
//    opened scene: the player's Play at its end restarts from 0 (DEF-62). Opening never starts a playing by itself.
// 6. Only the latest open asked for may reach the store. One for which a later open was asked before it was read (before
//    its project could reach the store) changes nothing, holds nothing and says nothing when it settles, whichever
//    settles first: its caller is given `{ kind: 'superseded' }`. Otherwise its caller is given `{ kind: 'opened' }` or
//    `{ kind: 'refused', refusal }`. An open the store has taken stands as opened, and "Project opened" is said for it,
//    even when a later open is asked for during its completion (by a store subscriber, by `announce`, by a listener);
//    every write of the opener's state at an open's completion is made only while it is still the latest asked for, so
//    `opening` and `refusal` are then the later one's. A refusal so overtaken is given to its caller but not held.
// 7. Whether an open is under way is held in the opener's state (`read().opening`, with a telling when it changes): true
//    from the moment an open is asked for until the latest one asked for settles. Nothing is said or drawn for it here.
//    Each of the opener's listeners is called in its own `try`: a throw is caught and dropped, the others are still told,
//    and `open` neither stops nor rejects (the state is written before anyone is told).
// 8. The opener itself keeps nothing of a file between opens but the refusal of point 2 and its name (point 12): no
//    bytes, no project (the store owns its own copy); what a decoder or a stand-in `openProject` handed in keeps is its
//    own. Its state holds `opening`, `refusal` and `name` only, and is the same frozen object until one of them changes.
//
// 13. `opened()` counts the projects this opener has put in the store: one more each time the store takes one (an open
//    given back as `opened`), counted before "Project opened" is said; a refusal, a superseded open and the store's own
//    refusal or throw count nothing. The timeline reads it, so an edit of the position begun before an open changes
//    nothing after it (PRS2, brief 94; timelineLogic.ts).
//
// `openFile(file)` (brief 75) is one ask, as `open` is: it counts as one, gives the same results and never rejects;
// once the file's bytes are read it is `open`'s own path, so points 1 to 8 hold for it as they stand. `file` is anything
// with a `name`, a `size` and `arrayBuffer()` (a browser's `File` is one; Node's tests make their own).
// 9. A file too large is never read: if `file.size` is over `ARCHIVE_LIMITS.zipBytes` (50 MB), `arrayBuffer` is not
//    called, and the refusal is io's own for that case, in its words (`reason: 'too-large'`, the sentence preflight.ts
//    gives a file over the limit). A file of gigabytes read whole would hang the page before io could refuse it.
// 10. A file that cannot be read (`arrayBuffer()` rejects or throws: the file was moved, or the browser refuses it)
//    changes nothing and is refused in io's words: `{ reason: 'unsafe', message: WORDS.openedUnsafe('it could not be
//    read') }`.
// 11. The latest ask wins across the read too: a file still being read when a later open is asked for is superseded as
//    point 6 has it, whichever settles first; its bytes are not handed to `openProject`. So is an ask made by a
//    listener while it is told of another ask's start (for `open` and `openFile` alike): the later ask is the latest.
// 12. The state's `name` is the name of the file it speaks of (the one being opened, or the one refused), kept and
//    given as it came (it is text a user's file brought: nothing here reads it as markup); null at rest and for
//    `open(bytes)`. `dismiss()` clears a refusal held, and its name, with one telling; while an open is under way, and
//    at rest, it does nothing and tells nobody.
import { openProject as ioOpenProject, type Opened } from '../../adapters/io/open';
import type { Decode } from '../../adapters/io/images';
import type { Project } from '../../adapters/io/format';
import { ARCHIVE_LIMITS } from '../../adapters/io/limits';
import { WORDS as IO_WORDS, type Problem, type Refusal } from '../../adapters/io/words';
import type { Announce } from '../kit/announce';
import type { Store } from '../store/store';
import type { Transport } from '../../player/transport/transport';

/** Every word of Open: the opener says only `opened`; the rest are Open's control and notice's (Open.tsx). A refusal's
 *  own words are io's. */
export const OPEN_WORDS = Object.freeze({
  /** Said once a project is opened: v3's "Project loaded", in the word every v4 refusal uses (provisional). */
  opened: 'Project opened',
  /** The button: v3's "Open project". */
  button: 'Open project',
  /** The busy line: v3's "Opening <name>…"; an open of bytes has no name. */
  opening: (name: string | null) => (name === null ? 'Opening the file…' : `Opening ${name}…`),
  /** A refusal's title: v3's "Could not open <name>". */
  refused: (name: string) => `Could not open ${name}`,
  /** A refusal's title when the state has no name (an open of bytes). */
  refusedNoName: 'Could not open the file',
  /** The refusal's close button's name. */
  close: 'Close',
  /** The refusal's icon's name: said before its title, the one thing beside colour that says what it is. */
  error: 'Error',
});

/** What the page reads: the same frozen object until one field changes. */
interface OpenerState {
  /** Whether an open asked for is still being read (the latest one asked for). */
  readonly opening: boolean;
  /** Why the latest open was refused, as io words it, or null: cleared when a new open is asked for. */
  readonly refusal: Refusal | null;
  /** The name of the file the state speaks of (opening or refused), as it came; null at rest and for `open(bytes)`. */
  readonly name: string | null;
}

/** A file asked for: a browser's `File` is one. */
interface ProjectFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** What `open` gives its caller. */
type OpenResult =
  | { readonly kind: 'opened' }
  | { readonly kind: 'refused'; readonly refusal: Refusal }
  /** A later open was asked for before this one was read, so it never reached the store and changed nothing. An open
   * the store has taken is `opened`, whatever was asked for after. */
  | { readonly kind: 'superseded' };

export interface Opener {
  /** Opens a project file's bytes into the store; never rejects (claim points 4 and 7). */
  open(bytes: Uint8Array): Promise<OpenResult>;
  /** Opens a project file: one ask, as `open` (claim points 9 to 12); never rejects. */
  openFile(file: ProjectFile): Promise<OpenResult>;
  /** Clears a refusal held, and its name; does nothing while an open is under way or at rest (point 12). */
  dismiss(): void;
  read(): OpenerState;
  /** How many projects this opener has put in the store (point 13). */
  opened(): number;
  /** Calls `listener` when the state changes; gives back the call that stops it. */
  subscribe(listener: () => void): () => void;
}

export interface OpenerOptions {
  readonly store: Pick<Store, 'open'>;
  readonly announce: Announce;
  /** The player's transport: an opened project is sought to its play length through it, silently (point 5). */
  readonly player: Pick<Transport, 'seek' | 'length'>;
  /** The page's decoder: the browser's (`createImageBitmap`); a test's own in Node. */
  readonly decode: Decode;
  /** io's Open; handed in only by a test that stands in for it. */
  readonly openProject?: (bytes: Uint8Array, decode: Decode) => Promise<Opened>;
}

const QUIET: OpenerState = Object.freeze({ opening: false, refusal: null, name: null });

/** io's refusal of a file over the limit, in the words preflight.ts gives it (point 9). */
const TOO_LARGE: Refusal = Object.freeze({
  reason: 'too-large',
  message: IO_WORDS.openedTooLarge(`a project file holds at most ${String(ARCHIVE_LIMITS.zipBytes / (1024 * 1024))} MB`),
});

/** A file whose bytes could not be read, in io's words (point 10). */
const UNREADABLE: Refusal = Object.freeze({ reason: 'unsafe', message: IO_WORDS.openedUnsafe('it could not be read') });

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

export function createOpener({ store, announce, player, decode, openProject = ioOpenProject }: OpenerOptions): Opener {
  let state = QUIET;
  /** How many opens have been asked for: an open may act only while it is the latest. */
  let asked = 0;
  /** How many projects the store has taken from this opener (point 13). */
  let taken = 0;
  const listeners = new Set<() => void>();

  const hold = (next: OpenerState): void => {
    if (next.opening === state.opening && next.refusal === state.refusal && next.name === state.name) return;
    state = next.opening || next.refusal !== null ? Object.freeze({ ...next }) : QUIET;
    for (const listener of [...listeners]) {
      // A listener's throw is dropped: the state is written already, the others must still be told, and a rejected
      // open would leave the page saying "opening" for ever (point 7).
      try {
        listener();
      } catch {
        // dropped
      }
    }
  };

  const unpack = async (bytes: Uint8Array): Promise<Opened> => {
    try {
      return await openProject(bytes, decode);
    } catch {
      return { ok: false, refusal: { reason: 'unsafe', message: IO_WORDS.openedUnsafe('it is damaged: part of it could not be unpacked') } };
    }
  };

  /** One ask begins: it is now the latest, under way, any refusal held cleared at once (points 2, 6, 7). */
  const begin = (name: string | null): number => {
    asked += 1;
    // Taken before anyone is told: a listener told of this ask may ask for another, which must then be the latest.
    const mine = asked;
    hold({ opening: true, refusal: null, name });
    return mine;
  };

  /** One ask ends, with what io gave it (points 1 to 7). */
  const settle = (mine: number, name: string | null, opened: Opened): OpenResult => {
    if (mine !== asked) return { kind: 'superseded' };
    const refusal = opened.ok ? intoStore(store, opened.project) : opened.refusal;
    if (refusal !== null) {
      if (mine === asked) hold({ opening: false, refusal, name });
      return { kind: 'refused', refusal };
    }
    // The store holds the opened project, so its length, picture and all, is the one built now (point 5). Dropped if it
    // throws: the open has happened and stays opened.
    try {
      player.seek(player.length());
    } catch {
      // dropped
    }
    taken += 1;
    // The store has taken it: it is opened whatever happens next. A throw from `announce` is dropped, not given back
    // as a refusal (nothing was refused; the page's queue does not throw; a rejected open would leave "opening" held).
    try {
      announce(OPEN_WORDS.opened);
    } catch {
      // dropped
    }
    if (mine === asked) hold({ opening: false, refusal: null, name: null });
    return { kind: 'opened' };
  };

  return Object.freeze({
    open: async (bytes: Uint8Array): Promise<OpenResult> => {
      const mine = begin(null);
      return settle(mine, null, await unpack(bytes));
    },
    openFile: async (file: ProjectFile): Promise<OpenResult> => {
      const { name, size } = file;
      const mine = begin(name);
      if (size > ARCHIVE_LIMITS.zipBytes) return settle(mine, name, { ok: false, refusal: TOO_LARGE });
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await file.arrayBuffer());
      } catch {
        return settle(mine, name, { ok: false, refusal: UNREADABLE });
      }
      if (mine !== asked) return { kind: 'superseded' };
      return settle(mine, name, await unpack(bytes));
    },
    dismiss: (): void => {
      if (!state.opening && state.refusal !== null) hold(QUIET);
    },
    read: () => state,
    opened: () => taken,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
}
