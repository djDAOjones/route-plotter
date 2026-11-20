// CORE-05, stage 3: the editor's one writer for its live region, v3's announcementQueue.js (DEF-45) ported whole (the
// plan's line 1059). It names nothing of the browser: the region is handed in as the two things the queue does to it
// (sets `aria-live`, sets the text), so an element fits it by shape, and so is the timer (in the browser `setTimeout`;
// in a test the test's own, run by hand). A feature's editor part reaches this kit and nothing else of the editor.
//
// The region is atomic and holds one message. Writing a second replaced the first in the same task, before a screen
// reader had read it, so a message announced just before another was never heard; and each message set a clear that
// nothing cancelled, so an earlier message's clear could blank a later one early. So messages are written to the
// region in turn. One announced while the region is idle is written at once, so code that reads the region straight
// after announcing still sees it; one announced while another shows waits. Each one written keeps the region for
// `HOLD_MS`, and only once nothing waits is the region cleared and made polite again, so a repeated message still
// reads as a change. There is one timer at a time, so no clear can land on a later message.
//
// - A message the author must hear never gives way: one its caller marks essential (what recovery did or could not
//   do, which nothing says again) and every assertive one. Only routine messages, which confirm what the author has
//   just done, ever give way. Any message can merge, below.
// - An assertive message waits ahead of the polite ones, but never cuts short the message showing. The region is
//   assertive only while it shows one.
// - A message identical to the one it would follow is merged into it: the region already says it, or will next, and
//   the same text written again is not read again. The merged message keeps the stronger protection, and the higher
//   priority: a waiting copy an assertive request merges into becomes assertive and moves ahead of the polite messages
//   waiting. The message showing keeps its hold.
// - A message the author must hear whose text already waits, anywhere in the queue, is merged into that waiting copy
//   instead: the copy is written after this request, so it tells the author what this one would. So the same notice
//   said again and again waits once. The message showing is not such a copy, unless it is the one followed: it was
//   written before this request, so the same text after other messages is written again. Routine messages merge only
//   into the one they would follow.
// - At most `MAX_WAITING` routine messages wait. Beyond that the oldest gives way, so a burst of toggles falls no
//   further behind; messages the author must hear do not count.
// - So what waits is bounded however long input goes on: at most `MAX_WAITING` routine messages, one of each text the
//   author must hear (the editor's are fixed texts) and one of each tip (`whenIdle`, below). Once input stops, the
//   region clears within one hold for the message showing, one for each message waiting and one for each tip waiting.
//   Not bounded: how long a polite message waits while assertive ones keep coming.
// - A message marked `whenIdle` (a tip: help, not status) waits until nothing else shows or waits, and is written
//   then: it never cuts in, never displaces a message and does not count towards the cap, and every message announced
//   while it waits goes ahead of it.
// - A message announced under a `key` belongs to whoever holds the key, and `withdraw(key)` takes every such message
//   still waiting its turn out of the queue (a tip waiting for the region to be idle is not, as in v3): an export's
//   progress, once that export has ended. The message showing has been written already, so it keeps its hold; one
//   that another request merged into is that request's too, and is not withdrawn.
// - A blank or whitespace-only message has nothing to read and is ignored. Text is written as text, never parsed as
//   markup.

/** How a message is read: polite waits for the reader to pause; assertive is read at once. */
export type Priority = 'polite' | 'assertive';

/** v3's ANNOUNCEMENTS (constants.js:136): how long each message keeps the region before the next, or the clear. */
export const HOLD_MS = 2000;
/** v3's ANNOUNCEMENTS: routine messages that may wait; must-hear ones do not count, and never give way. */
export const MAX_WAITING = 3;

/** The live region, as the two things the queue does to it: an element fits it by shape. */
interface Region {
  setAttribute(name: 'aria-live', value: Priority): void;
  textContent: string | null;
}

interface AnnounceOptions {
  /** The author must hear it, so it never gives way. */
  readonly essential?: boolean;
  /** A tip: it waits until nothing else shows or waits. */
  readonly whenIdle?: boolean;
  /** Whose it is: `withdraw(key)` takes it out while it waits. */
  readonly key?: unknown;
}

/** Announces a message: at once if the region is idle, otherwise in turn; 'assertive' waits ahead of polite ones. */
export type Announce = (message: string, priority?: Priority, options?: AnnounceOptions) => void;

interface AnnouncementQueue {
  readonly announce: Announce;
  /** Takes every message announced under `key` that still waits out of the queue; the one showing keeps its hold. */
  readonly withdraw: (key: unknown) => void;
}

interface Entry {
  readonly message: string;
  priority: Priority;
  /** Never gives way: essential or assertive, or merged with one that is. */
  kept: boolean;
  key: unknown;
}

/** Makes the queue that writes `region`; `later` calls back once after `ms` (in the browser, `setTimeout`). */
export function createAnnouncementQueue(
  region: Region,
  later: (callback: () => void, ms: number) => unknown,
): AnnouncementQueue {
  const waiting: Entry[] = [];
  /** Messages that wait for the region to be idle (`whenIdle`), in turn. */
  const idleWaiting: Entry[] = [];
  let showing: Entry | null = null;

  const show = (entry: Entry): void => {
    showing = entry;
    region.setAttribute('aria-live', entry.priority);
    region.textContent = entry.message;
    later(showNext, HOLD_MS);
  };

  // The message showing has had its time: the next replaces it, or, with none waiting, the region is cleared and left
  // polite, as the shell has it.
  const showNext = (): void => {
    const entry = waiting.shift() ?? idleWaiting.shift();
    if (entry) {
      show(entry);
      return;
    }
    showing = null;
    region.setAttribute('aria-live', 'polite');
    region.textContent = '';
  };

  return {
    announce: (message, priority = 'polite', { essential = false, whenIdle = false, key } = {}) => {
      if (!message.trim()) return;
      const entry: Entry = { message, priority, kept: essential || priority === 'assertive', key };
      if (showing === null) {
        show(entry);
        return;
      }
      if (whenIdle) {
        if (showing.message !== message && !idleWaiting.some((each) => each.message === message)) idleWaiting.push(entry);
        return;
      }
      const firstPolite = waiting.findIndex((each) => each.priority !== 'assertive');
      const at = priority === 'assertive' && firstPolite !== -1 ? firstPolite : waiting.length;
      const before = at > 0 ? waiting[at - 1] : showing;
      const copy = entry.kept ? waiting.find((each) => each.message === message) : undefined;
      const same = copy ?? (before?.message === message ? before : undefined);
      if (same) {
        same.kept ||= entry.kept;
        // Asked for by another request too, it is no longer one owner's alone.
        if (same.key !== entry.key) same.key = undefined;
        if (same !== showing && priority === 'assertive' && same.priority !== 'assertive') {
          waiting.splice(waiting.indexOf(same), 1);
          same.priority = 'assertive';
          const ahead = waiting.findIndex((each) => each.priority !== 'assertive');
          waiting.splice(ahead === -1 ? waiting.length : ahead, 0, same);
        }
        return;
      }
      waiting.splice(at, 0, entry);
      const routine = waiting.filter((each) => !each.kept);
      const oldest = routine[0];
      if (routine.length > MAX_WAITING && oldest) waiting.splice(waiting.indexOf(oldest), 1);
    },
    withdraw: (key) => {
      if (key === undefined) return;
      for (let index = waiting.length - 1; index >= 0; index -= 1) {
        if (waiting[index]?.key === key) waiting.splice(index, 1);
      }
    },
  };
}
