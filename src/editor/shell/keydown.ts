// CORE-05, stage 5: the page's one keydown listener. A page file: `placeOf` is the only place the DOM is read for a
// key, turning the event's target into the dispatch's plain data; `dispatchKey` (dispatch.ts, proved in Node) decides.
//
// The listener sits on `document` in the bubble phase, never capture: the kit's slider and number field stop Escape
// with React's `stopPropagation`, which stops the native event at React's root, so they win over the editor.
import { dispatchKey, type FocusKind, type PressPlace } from './dispatch';
import type { PageSession } from './session';

/**
 * Whether keys of one printable character (J, K, L, comma, full stop, < and >) are shortcuts. Held off (D183, WCAG
 * 2.2's 2.1.4) until the switch that turns them on is on the page; it comes with the help dialog.
 */
const SINGLE_KEYS = false;

const MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);

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

/** Listens for the editor's keys on `document`; gives back the call that stops listening (React's effect cleanup). */
export function listenForKeys({ store, transport }: PageSession): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    const place = placeOf(event.target);
    if (dispatchKey({ press: event, mac: MAC, place, singleKeys: SINGLE_KEYS, store, transport })) event.preventDefault();
  };
  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
  };
}
