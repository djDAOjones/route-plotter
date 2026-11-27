// CORE-05, stage 6: Open's control and its notice (brief 75, ruling 3), drawn from the opener (openLogic.ts) and from
// nothing else; not on the page yet (the next chat puts them in the frame's two places, Frame.tsx). v3 had a "File"
// menu holding "Open project" over a hidden file input (v3/index.html 49 to 61); v4's shell has nothing else to put in a
// menu yet, so the button stands alone in the header, before Help.
//
// Its claim (what the markup and the opener's tests show; what a click, a choice, Close and focus really do is the
// page's to prove):
// 1. `OpenButton` draws one control: the kit's `FileButton`, a Carbon button `id="open-project"` named by its word,
//    "Open project" (v3's), the same kind as Help's, never disabled (a later choice supersedes one under way: the
//    opener's point 11). Its file input is `hidden`, so it is no control of its own, takes one file, not many, and
//    offers `.zip` first, as v3's did; a file of another name chosen through "All files" is opened or refused by io all
//    the same (it is judged by what it holds). The button never turns into the file's name.
// 2. A choice hands the first file chosen to `opener.openFile`, then clears the input, so the same file chosen again is
//    a new choice (as v3 did). The clearing is proved in Node on a stand-in input (`takeChoice`); that the browser's
//    input meets it is read, not proved, until the page chat's journey.
// 3. `OpenNotice` draws nothing at all at rest: no element, no live region left behind.
// 4. While an open is under way it draws one visible line, Carbon's `InlineLoading`, its words "Opening <name>…" (v3's;
//    "Opening the file…" for an open of bytes, which has no name), in Carbon's own live region made polite. Carbon
//    nests inside it its spinner's own region, `aria-live="assertive"`, holding an image named "loading": that is
//    Carbon's, not changed here. Whether a region inserted with its words already in it is heard at once differs
//    between screen readers; hearing it is A11Y-03's.
// 5. With a refusal held it draws Carbon's `InlineNotification`, kind "error", `role="alert"`, its title "Could not open
//    <name>" (v3's; "Could not open the file" when the state has no name), its words the refusal's `message` exactly as
//    held, and one close button named "Close", handed `opener.dismiss` (read: pressing it is the page's to prove). It
//    never closes by itself (an inline notification has no timer) and never hides itself: Carbon's own closing is
//    refused (`onClose` gives false), so what shows is always the opener's state. No loading line with it. Its error
//    icon is named "Error" (ours, not Carbon's "error icon"), said before the title.
// 6. How it is spoken (ruled by brief 75): the open itself through the queue ("Project opened", openLogic.ts); a refusal
//    by its own `role="alert"`, never through the queue as well; the opening line by its polite live region.
// 7. A file's name is text a user's file brought: it is drawn as text, never as markup.
// 8. Each is drawn from the opener's state by `useSyncExternalStore`, with the same `read` for the server's render, so
//    Node draws them; every word is in `OPEN_WORDS` (openLogic.ts).
// 9. D276 (a), kept as built: the parent chat's reading of the owner's answer of 2026-11-27, which stands unless he
//    objects (brief 145): when the session's opener carries its `question` (ReplaceQuestion.tsx), the
//    button draws that question beside it, closed until the opener asks; its focus goes back to this button, found by
//    its id. Without a `question` the button is as it was.
import { InlineLoading, InlineNotification } from '@carbon/react';
import { useMemo, useSyncExternalStore, type RefObject } from 'react';
import { FileButton } from '../kit/FileButton';
import { OPEN_WORDS, type Opener } from './openLogic';
import { ReplaceQuestion, type ReplaceAsker } from './ReplaceQuestion';

/** The button's id. */
const OPEN_ID = 'open-project';
/** The kinds of file the chooser offers first: v3's. */
const ACCEPT = ['.zip'];

export interface OpenProps {
  /** The page's one opener, made by the session. */
  readonly opener: Pick<Opener, 'read' | 'subscribe' | 'openFile' | 'dismiss'> & {
    /** D276 (a): the question the opener asks before replacing a changed route (point 9). */
    readonly question?: Pick<ReplaceAsker, 'read' | 'answer' | 'subscribe'>;
  };
}

/** The button itself, found by its id when the question gives focus back (point 9). */
const openButton = (): RefObject<HTMLElement | null> => ({
  get current() {
    return typeof document === 'undefined' ? null : document.getElementById(OPEN_ID);
  },
});

/** "Open project": a button that asks for one project file and hands it to the opener. */
export function OpenButton({ opener }: OpenProps) {
  const back = useMemo(() => openButton(), []);
  return (
    <>
      <FileButton
        id={OPEN_ID}
        accept={ACCEPT}
        onChoose={(file) => {
          void opener.openFile(file);
        }}
      >
        {OPEN_WORDS.button}
      </FileButton>
      {opener.question === undefined ? null : <ReplaceQuestion asker={opener.question} opener={back} />}
    </>
  );
}

/** What the opener holds, shown: nothing at rest, a busy line while opening, a refusal until it is closed. */
export function OpenNotice({ opener }: OpenProps) {
  const { opening, refusal, name } = useSyncExternalStore(opener.subscribe, opener.read, opener.read);
  if (opening) return <InlineLoading description={OPEN_WORDS.opening(name)} aria-live="polite" />;
  if (refusal === null) return null;
  return (
    <InlineNotification
      kind="error"
      role="alert"
      title={name === null ? OPEN_WORDS.refusedNoName : OPEN_WORDS.refused(name)}
      subtitle={refusal.message}
      aria-label={OPEN_WORDS.close}
      statusIconDescription={OPEN_WORDS.error}
      onClose={() => {
        opener.dismiss();
        return false;
      }}
    />
  );
}
