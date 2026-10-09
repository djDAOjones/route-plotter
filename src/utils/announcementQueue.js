/**
 * The editor's one writer for the `#announcer` live region (DEF-45).
 *
 * The region is atomic and holds one message. Writing a second replaced the
 * first in the same task, before a screen reader had read it, so a recovery
 * warning announced just before "Previous session restored" or "Project
 * loaded" was never heard. Each message also set a 2 s clear that nothing
 * cancelled, so an earlier message's clear could blank a later one early.
 *
 * Messages are now written to the region in turn. One announced while the
 * region is idle is written at once, so code that reads the region straight
 * after announcing still sees it; one announced while another shows waits.
 * Each one written keeps the region for `ANNOUNCEMENTS.HOLD_MS`, and only
 * once nothing waits is the region cleared and made polite again, so a
 * repeated message still reads as a change. There is one timer at a time, so
 * no clear can land on a later message.
 *
 * - A message the author must hear never gives way: one its caller marks
 *   essential (what browser recovery did or could not do, which nothing says
 *   again) and every assertive one. Only routine messages, which confirm what
 *   the author has just done, ever give way. Any message can merge, below.
 * - An assertive message waits ahead of the polite ones, but never cuts short
 *   the message showing. The region is assertive only while it shows one.
 * - A message identical to the one it would follow is merged into it: the
 *   region already says it, or will next, and the same text written again is
 *   not read again. The merged message keeps the stronger protection, and the
 *   higher priority: a waiting copy an assertive request merges into becomes
 *   assertive and moves ahead of the polite messages waiting (UI-06, Codex
 *   r1). The message showing keeps its hold.
 * - A message the author must hear whose text already waits, anywhere in the
 *   queue, is merged into that waiting copy instead: the copy is written after
 *   this request, so it tells the author what this one would. So the same
 *   notice said again and again (an omission warning for each project opened)
 *   waits once. The message showing is not such a copy, unless it is the one
 *   followed: it was written before this request, so the same text after
 *   other messages is written again. Routine messages merge only into the one
 *   they would follow.
 * - At most `ANNOUNCEMENTS.MAX_WAITING` routine messages wait. Beyond that the
 *   oldest gives way, so a burst of toggles falls no further behind; messages
 *   the author must hear do not count.
 * - So what waits is bounded however long input goes on: at most
 *   `MAX_WAITING` routine messages, one of each text the author must hear
 *   (the app's are fixed texts) and one of each tip (`whenIdle`, below). Once
 *   input stops, the region clears within one hold for the message showing,
 *   one for each message waiting and one for each tip waiting. Not bounded:
 *   how long a polite message waits while assertive ones keep coming.
 * - A message marked `whenIdle` (a tip: help, not status) waits until nothing
 *   else shows or waits, and is written then: it never cuts in, never
 *   displaces a message and does not count towards the cap, and every message
 *   announced while it waits goes ahead of it (UI-06; the owner, 2026-10-09:
 *   tips "queued after the start-up recovery messages so they never cut in").
 * - A blank or whitespace-only message has nothing to read and is ignored.
 *   Text is written as text, never parsed as markup.
 *
 * @module utils/announcementQueue
 */

import { ANNOUNCEMENTS } from '../config/constants.js';

/**
 * Create the queue that writes a live region.
 *
 * @param {HTMLElement|null} region - The live region; without one, announcing does nothing
 * @returns {{announce: (message: string, priority?: string, options?: {essential?: boolean}) => void}}
 */
export function createAnnouncementQueue(region) {
  const waiting = [];
  /** Messages that wait for the region to be idle (`whenIdle`), in turn. */
  const whenIdle = [];
  let showing = null;

  const show = (entry) => {
    showing = entry;
    region.setAttribute('aria-live', entry.priority);
    region.textContent = entry.message;
    setTimeout(showNext, ANNOUNCEMENTS.HOLD_MS);
  };

  // The message showing has had its time: the next replaces it, or, with
  // none waiting, the region is cleared and left polite, as the shell has it.
  const showNext = () => {
    const entry = waiting.shift() ?? whenIdle.shift();
    if (entry) {
      show(entry);
      return;
    }
    showing = null;
    region.setAttribute('aria-live', 'polite');
    region.textContent = '';
  };

  return {
    /**
     * Announce a message: at once if the region is idle, otherwise in turn.
     *
     * @param {string} message
     * @param {string} [priority='polite'] - 'assertive' waits ahead of polite messages
     * @param {Object} [options]
     * @param {boolean} [options.essential=false] - The author must hear it, so it never gives way
     * @param {boolean} [options.whenIdle=false] - It waits until nothing else shows or waits
     */
    announce(message, priority = 'polite', { essential = false, whenIdle: idle = false } = {}) {
      if (!region || !String(message ?? '').trim()) return;
      const entry = { message, priority, kept: essential || priority === 'assertive' };
      if (!showing) {
        show(entry);
        return;
      }
      if (idle) {
        if (showing.message !== message && !whenIdle.some(each => each.message === message)) whenIdle.push(entry);
        return;
      }
      const firstPolite = waiting.findIndex(each => each.priority !== 'assertive');
      const at = priority === 'assertive' && firstPolite !== -1 ? firstPolite : waiting.length;
      const before = at > 0 ? waiting[at - 1] : showing;
      const copy = entry.kept ? waiting.find(each => each.message === message) : undefined;
      const same = copy ?? (before.message === message ? before : undefined);
      if (same) {
        same.kept ||= entry.kept;
        if (same !== showing && priority === 'assertive' && same.priority !== 'assertive') {
          waiting.splice(waiting.indexOf(same), 1);
          same.priority = 'assertive';
          const ahead = waiting.findIndex(each => each.priority !== 'assertive');
          waiting.splice(ahead === -1 ? waiting.length : ahead, 0, same);
        }
        return;
      }
      waiting.splice(at, 0, entry);
      const routine = waiting.filter(each => !each.kept);
      if (routine.length > ANNOUNCEMENTS.MAX_WAITING) waiting.splice(waiting.indexOf(routine[0]), 1);
    },
  };
}
