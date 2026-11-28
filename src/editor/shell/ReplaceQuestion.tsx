// CORE-06, D276 (a), kept as built: the parent chat's reading of the owner's answer of 2026-11-27, which stands unless
// he objects (brief 145, ruling JC): the page's question before a chosen project replaces a changed
// route, the opener's `confirmReplace` (openLogic.ts point 14). v3 did not ask (it kept a recovery copy instead); v4 has
// no save yet, and an opened project cannot be undone, so the editor asks first.
//
// Its claim (what Node shows; what focus, Escape and a click really do is the journey `open-over-changes`'s to prove):
// 1. `createReplaceAsker` holds at most one question. `ask(name)` is handed to the opener as `confirmReplace`: it shows
//    the question for that file and resolves `true` for "Replace", `false` for "Keep my route". `answer` settles the one
//    shown and clears it; with none shown it does nothing.
// 2. Two asks never leave two questions (ruling JC 2): a new ask while one is shown settles the older as kept (`false`)
//    and shows the new one in its place. The opener has by then superseded the older open, so its answer changes nothing
//    and says nothing (openLogic.ts point 14); only the latest ask can open.
// 3. `ReplaceQuestion` draws the kit's `Dialog` (Help's; no Carbon component imported here), headed
//    `OPEN_WORDS.replaceTitle`, its text `OPEN_WORDS.replaceText(name)` (the file's name drawn as text, never as markup),
//    then two buttons, "Keep my route" first, then "Replace" (Carbon's button look by its classes on plain buttons, as
//    the kit has no button of its own). Closed, it draws nothing.
// 4. Focus goes to "Keep my route" when it opens: Carbon's own focus-on-open (Modal.js 262 to 275) runs in Modal's
//    effect and puts it on the kit's content wrapper; this component's effect runs after its child's, so it moves focus
//    on to "Keep my route" (the safe answer under a stray Enter). It runs again when a new ask replaces the question,
//    even for the same file (Codex on 3491f00, brief 147, ruling KA): the asker's snapshot is one object made once per
//    ask (`AskedQuestion`), not the file's name, so `useSyncExternalStore` reads the same object between asks and a new
//    one on each ask, and the effect, keyed on that object, puts focus back on "Keep my route" whatever had it.
// 5. Escape, the dialog's close button or a press outside it keep the route (the kit's `onClose`), as "Keep my route"
//    does. Every way of closing gives focus back to "Open project" (the kit's own return for its close; the buttons do
//    the same: the question cleared synchronously, then the opener focused).
// 6. It says nothing itself: on keep the opener says "Open cancelled", on replace "Project opened" (openLogic.ts).
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import { Dialog } from "../kit/Dialog";
import { OPEN_WORDS } from "./openLogic";

/** One ask, made once per ask (point 4): its identity is what the focus effect follows; its name is what it shows. */
interface AskedQuestion {
  readonly name: string;
}

/** The page's one question about replacing the route (point 1). */
export interface ReplaceAsker {
  /** Shows the question for `fileName`; `true` means replace. The opener's `confirmReplace`. */
  readonly ask: (fileName: string) => Promise<boolean>;
  /** The question shown (the same object until the next ask or answer), or null when none is shown. */
  readonly read: () => AskedQuestion | null;
  /** Settles the question shown: `true` replaces, `false` keeps. Nothing shown, nothing done. */
  readonly answer: (replace: boolean) => void;
  /** Calls `listener` when the question shown changes; gives back the call that stops it. */
  readonly subscribe: (listener: () => void) => () => void;
}

/** The page's one question before an opened project replaces a changed route: the opener asks it, the page answers. */
export function createReplaceAsker(): ReplaceAsker {
  let shown: {
    readonly question: AskedQuestion;
    readonly settle: (replace: boolean) => void;
  } | null = null;
  const listeners = new Set<() => void>();
  const tell = () => {
    for (const listener of [...listeners]) listener();
  };
  const answer = (replace: boolean) => {
    if (shown === null) return;
    const { settle } = shown;
    shown = null;
    settle(replace);
    tell();
  };
  return Object.freeze({
    ask: (fileName: string) =>
      new Promise<boolean>((resolve) => {
        const older = shown;
        shown = { question: Object.freeze({ name: fileName }), settle: resolve };
        older?.settle(false);
        tell();
      }),
    read: () => shown?.question ?? null,
    answer,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
}

export interface ReplaceQuestionProps {
  readonly asker: Pick<ReplaceAsker, "read" | "answer" | "subscribe">;
  /** "Open project": focus goes back to it however the question closes. */
  readonly opener: RefObject<HTMLElement | null>;
}

/** The two buttons side by side under the text, Keep first. */
const BUTTONS: CSSProperties = {
  display: "flex",
  gap: "1rem",
  marginTop: "1.5rem",
};

/** "Replace your route?": the kit's dialog with "Keep my route" and "Replace", focus on "Keep my route". */
export function ReplaceQuestion({ asker, opener }: ReplaceQuestionProps) {
  const asked = useSyncExternalStore(asker.subscribe, asker.read, asker.read);
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asked !== null) keep.current?.focus();
  }, [asked]);
  const settle = (replace: boolean) => {
    flushSync(() => {
      asker.answer(replace);
    });
    opener.current?.focus();
  };
  return (
    <Dialog
      opener={opener}
      heading={OPEN_WORDS.replaceTitle}
      open={asked !== null}
      onClose={() => {
        asker.answer(false);
      }}
    >
      <p>{OPEN_WORDS.replaceText(asked?.name ?? "")}</p>
      <div style={BUTTONS}>
        <button
          ref={keep}
          type="button"
          className="cds--btn cds--btn--secondary"
          onClick={() => {
            settle(false);
          }}
        >
          {OPEN_WORDS.keep}
        </button>
        <button
          type="button"
          className="cds--btn cds--btn--primary"
          onClick={() => {
            settle(true);
          }}
        >
          {OPEN_WORDS.replace}
        </button>
      </div>
    </Dialog>
  );
}
