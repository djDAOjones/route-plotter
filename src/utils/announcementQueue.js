/**
 * The editor's one writer for the `#announcer` live region (DEF-45).
 *
 * The region is atomic and holds one message. Writing a second replaced the
 * first in the same task, before a screen reader had read it, so a recovery
 * warning announced just before "Previous session restored" or "Project
 * loaded" was never heard. Each message also set a 2 s clear that nothing
 * cancelled, so an earlier message's clear could blank a later one early.
 *
 * Messages are now read in turn. One announced while the region is idle is
 * written at once, so code that reads the region straight after announcing
 * still sees it; one announced while another shows waits. Each keeps the
 * region for `ANNOUNCEMENTS.HOLD_MS`, and the region is cleared only once
 * nothing waits, so a repeated message still reads as a change. There is one
 * timer at a time, so no clear can land on a later message.
 *
 * - An assertive message waits ahead of the polite ones, but never cuts short
 *   the message showing: that would lose it, the fault this fixes. The region
 *   is assertive only while it shows one.
 * - A message identical to the one it would follow is dropped: the region
 *   already says it, and the same text written again is not read again.
 * - At most `ANNOUNCEMENTS.MAX_WAITING` wait. Beyond that the oldest polite one
 *   gives way, so a burst of toggles ends on the latest state and falls no
 *   further behind.
 *
 * @module utils/announcementQueue
 */

import { ANNOUNCEMENTS } from '../config/constants.js';

/**
 * Create the queue that writes a live region.
 *
 * @param {HTMLElement|null} region - The live region; without one, announcing does nothing
 * @returns {{announce: (message: string, priority?: string) => void}}
 */
export function createAnnouncementQueue(region) {
  const waiting = [];
  let showing = null;

  const show = (entry) => {
    showing = entry;
    region.setAttribute('aria-live', entry.priority);
    region.textContent = entry.message;
    setTimeout(showNext, ANNOUNCEMENTS.HOLD_MS);
  };

  // The message showing has had its time: the next replaces it, or, with
  // none waiting, the region is cleared.
  const showNext = () => {
    const entry = waiting.shift();
    if (entry) {
      show(entry);
      return;
    }
    showing = null;
    region.textContent = '';
  };

  return {
    /**
     * Announce a message: at once if the region is idle, otherwise in turn.
     *
     * @param {string} message
     * @param {string} [priority='polite'] - 'assertive' waits ahead of polite messages
     */
    announce(message, priority = 'polite') {
      // A blank message has nothing to read and would only hold the region.
      if (!region || !message) return;
      const entry = { message, priority };
      if (!showing) {
        show(entry);
        return;
      }
      const firstPolite = waiting.findIndex(each => each.priority !== 'assertive');
      const at = priority === 'assertive' && firstPolite !== -1 ? firstPolite : waiting.length;
      if ((at > 0 ? waiting[at - 1] : showing).message === message) return;
      waiting.splice(at, 0, entry);
      if (waiting.length > ANNOUNCEMENTS.MAX_WAITING) {
        const oldestPolite = waiting.findIndex(each => each.priority !== 'assertive');
        waiting.splice(oldestPolite === -1 ? 0 : oldestPolite, 1);
      }
    },
  };
}
