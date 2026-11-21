// CORE-05, stage 5: the shell's key dispatch. The one function the page's keydown listener calls: handed a press,
// whether the machine is a Mac, what the page knows of where the key was pressed (plain data: the listener reads the
// DOM, this reads none), whether single-key shortcuts are on, and the functions the key table's actions name. It runs
// at most one action and says whether it took the key. No DOM, no browser global, no React: every rule is proved in Node.
//
// Its claim:
// 1. One key, at most one effect (DEF-13.1). The action the key table names for the press (`actionFor`) runs once, and
//    the key is taken exactly when something ran; the listener cancels the key's default only when it was taken. A
//    press another listener already took (`defaultPrevented`) runs nothing.
// 2. A key the focused place uses itself is never taken. In a typing field no key and no chord is (the browser's own
//    undo of typed text stays the field's). A focused button, link or menu item keeps Space and Enter, and a menu item
//    also the arrows; a slider keeps the arrows, Home, End, Page Up and Page Down. Every other key still runs from
//    those places, since a browser leaves focus on a button after a click (DEF-13). While a dialog is open, nothing
//    behind it runs.
// 3. A Playback action calls the editor's transport's function of the same name; Undo and Redo call the store's. A
//    refusal changes nothing (the store's and the transport's own rule) and still counts as taken: the key was the
//    editor's.
// 4. With single-key shortcuts off (D183, WCAG 2.2's 2.1.4), a key that is one printable character other than Space,
//    matched by an entry that asks for no command key, is never taken: `j`, `k`, `l`, `,`, `.`, `<` and `>` do nothing,
//    while Space, Home, End and the command chords (Undo, Redo) work as before. It is decided from the press and the
//    entry it matched, not from a second list of keys.
// It does not claim to withstand code written to break it.
//
// Ported from v3's guard (InteractionHandler.js 890 to 970), and where it differs:
// - v3 counted every INPUT, TEXTAREA, SELECT and editable element as typing, so a range input took no shortcut at
//   all; here a typing field is what the listener says it is, and a slider is its own kind, keeping only its keys.
// - v3 let `?` (help) run inside a dialog; help has no key yet (it comes with its dialog), so nothing runs in one.
// - v3 kept Space for a button, link, disclosure or menu item, and the arrows for a menu item or an option; Enter is
//   kept here too, by name, though no entry has it, so adding one later cannot take a button's own activation.
// - v3's network-edit-mode guard (the pen's `a` and Ctrl+D) has no v4 counterpart yet.
// - v3 answered `,` `.` `j` `k` `l` whatever modifier was held; the table's `matches` asks for none (DEF-63).
import type { Store } from '../store/store';
import type { EditorTransport } from '../transport/transport';
import { actionFor, KEYS, type ActionIn, type KeyPress } from './keys';

/** What kind of control has focus, as far as which keys it keeps. */
export type FocusKind = 'button' | 'link' | 'menuitem' | 'slider' | 'other';

/** What the page knows of where a key was pressed: plain data, read from the DOM by the listener alone. */
export interface PressPlace {
  /** The target takes typed text: a text field, a text area, a list box, an editable element. */
  readonly typing: boolean;
  /** A dialog is open: the editor behind it is inert. */
  readonly dialogOpen: boolean;
  readonly focus: FocusKind;
}

export interface KeyDispatch {
  readonly press: KeyPress;
  readonly mac: boolean;
  readonly place: PressPlace;
  /** Whether keys of one printable character are shortcuts (D183); the page holds them off until their switch. */
  readonly singleKeys: boolean;
  readonly store: Pick<Store, 'undo' | 'redo'>;
  readonly transport: Pick<EditorTransport, ActionIn<'Playback'>>;
}

const ACTIVATION: readonly string[] = [' ', 'Enter'];
const ARROWS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** The keys each kind of control acts on itself, and so keeps (claim point 2). */
const KEPT: Readonly<Record<FocusKind, readonly string[]>> = Object.freeze({
  button: ACTIVATION,
  link: ACTIVATION,
  menuitem: [...ACTIVATION, ...ARROWS],
  slider: [...ARROWS, 'Home', 'End', 'PageUp', 'PageDown'],
  other: [],
});

/** Runs the action `press` means here, if any; true exactly when one ran (the listener then cancels the key). */
export function dispatchKey({ press, mac, place, singleKeys, store, transport }: KeyDispatch): boolean {
  if (place.typing || place.dialogOpen || KEPT[place.focus].includes(press.key)) return false;
  const action = actionFor(press, mac);
  const entry = KEYS.find((candidate) => candidate.action === action);
  if (entry === undefined) return false;
  const singleKey = press.key.length === 1 && press.key !== ' ' && !entry.modifiers.includes('command');
  if (singleKey && !singleKeys) return false;
  if (entry.group === 'Playback') transport[entry.action]();
  else store[entry.action]();
  return true;
}
