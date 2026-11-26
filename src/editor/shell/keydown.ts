// CORE-05, stage 5: the page's one keydown listener. A page file: `placeOf` is the only place the DOM is read for a
// key, turning the event's target into the dispatch's plain data; `dispatchKey` (dispatch.ts, proved in Node) decides.
//
// The listener sits on `document` in the bubble phase, never capture: the kit's slider and number field stop Escape
// with React's `stopPropagation`, which stops the native event at React's root, so they win over the editor.
//
// Who owns Escape, in order: the kit's controls' typed text (they stop it there), then a menu, then a dialog, then an
// open drag, then the selection. On this page only the dialog exists: Carbon's `Modal` closes on Escape by its own
// listener on `document` (on its Close button the kit's dialog takes the key first, D206) and focus goes back to its
// opener (kit/Dialog.tsx). CORE-06 (brief 112): the selection's branch, last, is this listener's (`escapeClears`,
// src/editor/canvas/dom.ts): Escape with something selected, and no drag open, no typed text and no dialog, clears the
// selection, so the pen's next tap starts afresh. Brief 115 (ruling U): Escape has one path, the key table's entry,
// through the dispatch (which keeps typed text and a dialog's Escape out first): this listener hands it
// `cancelDrag() || escapeClears(…)`, so an open drag is cancelled (its places and selection put back, nothing to undo)
// and otherwise the selection cleared; the key is taken only when one of them did something.
//
// Brief 123 (ruling AN): the Editing keys, Delete or Backspace, Cmd or Ctrl+D and Cmd or Ctrl+A, go through the
// dispatch (which keeps typed text and a dialog's keys out first) to `editKey` (src/editor/canvas/dom.ts, point 7),
// handed whether a drag is open; the key is taken only when there was something to act on.
//
// Brief 125 (rulings AW and AY): the arrows, alone or with Shift, go the same way to `editKey` with the arrow pressed
// (the nudge, dom.ts point 8). A run of nudges is one undo step, ended at once by anything else: the dispatch ends it
// for any other key (its point 8), the canvas's binding for a press on the preview and the window's blur, and this
// listener for any pointer press on the page (heard first, in the capture phase, so an Undo button's press meets the
// burst closed) and for the focus leaving where it was (`focusout`).
//
// A held key (`event.repeat`) is passed on as the press's `repeat`: the dispatch runs it once (its point 5, D189).
//
// Single-key shortcuts (D183, WCAG 2.2's 2.1.4) are read at each key from the session's switch, on to begin with and
// held for the visit; Help shows and sets it.
import { cancelDrag, dragOpen, editKey, endNudge, escapeClears } from '../canvas/dom';
import { dispatchKey, type FocusKind, type KeyDispatch, type PressPlace } from './dispatch';
import type { PageSession } from './session';

/** Whether this machine is a Mac: Undo is Cmd+Z here, and Help spells the chords so. */
export const MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Input types that take no typed text: each acts on a key as a button or a slider does. */
const UNTYPED = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);
const TYPING = 'textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"]';

/** Each kind of control by the elements and roles it covers, the nearest first in this order. */
const KINDS: readonly (readonly [string, FocusKind])[] = [
  ['[role="slider"], input[type="range"]', 'slider'],
  ['[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"]', 'menuitem'],
  ['a[href], [role="link"]', 'link'],
  [
    'button, summary, input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], ' +
      'input[type="radio"], [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"]',
    'button',
  ],
];

/**
 * Whether a dialog marked modal is really open. Carbon's `Modal` keeps `aria-modal="true"` on its inner box while it is
 * mounted and closed (Modal.js 404), and shows it open by `is-visible` on its outer `cds--modal` (line 160); a native
 * `<dialog>` is open only when its `open` attribute is set.
 */
function isOpen(dialog: Element): boolean {
  if (dialog instanceof HTMLDialogElement) return dialog.open;
  const carbon = dialog.closest('.cds--modal');
  return carbon === null || carbon.classList.contains('is-visible');
}

/** Where a key was pressed, as the dispatch reads it. */
function placeOf(target: EventTarget | null): PressPlace {
  const dialogOpen = [...document.querySelectorAll('dialog, [aria-modal="true"]')].some(isOpen);
  if (!(target instanceof Element)) return { typing: false, dialogOpen, focus: 'other' };
  const typing =
    (target instanceof HTMLInputElement && !UNTYPED.has(target.type)) ||
    (target instanceof HTMLElement && target.isContentEditable) ||
    target.closest(TYPING) !== null;
  const focus = KINDS.find(([selector]) => target.closest(selector) !== null)?.[1] ?? 'other';
  return { typing, dialogOpen, focus };
}

/**
 * Listens for the editor's keys on `document`, `openHelp` being what `?` calls and `openProject` what Cmd or Ctrl+O
 * calls; gives back the call that stops listening (React's effect cleanup).
 */
export function listenForKeys(
  { store, transport, singleKeys }: PageSession,
  openHelp: () => void,
  openProject: () => void,
): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    const place = placeOf(event.target);
    const escape = () => cancelDrag() || escapeClears(event, place, dragOpen(), store);
    const edit: KeyDispatch['edit'] = (action, repeat, key) => editKey(action, repeat, store, dragOpen(), key);
    const taken = dispatchKey({ press: event, mac: MAC, place, singleKeys: singleKeys.read(), store, transport, openHelp, openProject, escape, edit, endNudge });
    if (taken) event.preventDefault();
  };
  const onElse = (): void => {
    endNudge();
  };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', onElse, true);
  document.addEventListener('focusout', onElse);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('pointerdown', onElse, true);
    document.removeEventListener('focusout', onElse);
    endNudge();
  };
}
