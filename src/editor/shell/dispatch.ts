// CORE-05, stage 5: the shell's key dispatch. The one function the page's keydown listener calls: handed a press,
// whether the machine is a Mac, what the page knows of where the key was pressed (plain data: the listener reads the
// DOM, this reads none), whether single-key shortcuts are on, and the functions the key table's actions name. It runs
// at most one action and says whether it took the key. No DOM, no browser global, no React, so it is tested in Node,
// on the real table: every entry, every kind of place, both switch positions. What today's table cannot show: Enter,
// Page Up and Page Down are kept (point 2) for entries the table does not have yet; no entry uses them, so no test on
// the real table fails without them, and they are held by reading, not by a test. The arrows are the nudge's since
// brief 125, and a test holds them kept for a slider and a menu item.
//
// Its claim:
// 1. One key, at most one effect (DEF-13.1). The action the key table names for the press (`actionFor`) runs once, and
//    the key is taken when something ran, and also when a held key's repeat of an action that does not repeat is
//    passed over (point 5: it runs nothing, but the key was the editor's); the listener cancels the key's default only
//    when it was taken. A press another listener already took (`defaultPrevented`) runs nothing.
// 2. A key the focused place uses itself is never taken. In a typing field no key and no chord is (the browser's own
//    undo of typed text stays the field's). A focused button, link or menu item keeps Space and Enter, and a menu item
//    also the arrows, Home and End (ARIA's menus and list boxes move with them); a slider keeps the arrows, Home,
//    End, Page Up and Page Down. Every other key still runs from those places, since a browser leaves focus on a
//    button after a click (DEF-13). While a dialog is open, nothing behind it runs, `?` included. One entry apart,
//    Open project (Cmd or Ctrl+O, D207): the chord is the editor's wherever it is pressed and is always taken, so the
//    browser's own "Open File" never opens over the editor; it opens the chooser from anywhere, a typing field
//    included (a chord types nothing), except while a dialog is open, where it is taken and runs nothing. A held
//    chord's repeat runs nothing (point 5).
// 3. A Playback action calls the editor's transport's function of the same name; Undo and Redo call the store's; Help
//    (`?`) calls what the page hands in to open help, and Open project what it hands in to open the file chooser. A refusal changes nothing (the store's and the transport's own
//    rule) and still counts as taken: the key was the editor's.
// 4. With single-key shortcuts off (D183, WCAG 2.2's 2.1.4), a key that is one printable character other than Space,
//    matched by an entry that asks for no command key, is never taken: `j`, `k`, `l`, `,`, `.`, `<`, `>` and `?` do
//    nothing (Help's own button, coming with its dialog, will not be held off), while Space, Home, End and the command
//    chords (Open project, Undo, Redo) work. It is decided from the press and the
//    entry it matched, not from a second list of keys.
// 5. A held key (`repeat`, D189) runs its action once: a repeated press runs nothing but is still taken wherever its
//    entry would have run (so a held Space does not scroll the page behind), except an entry marked `repeats`, Undo
//    and Redo, which run at each repeat as in every editor, and the frame steps `,` and `.` (D205), which step at
//    each. Decided from the entry, not from a second list of keys; every check of points 1, 2 and 4 comes first, so a
//    repeat is never taken where its first press would not be.
// 6. Escape (brief 115, ruling U) has one path: its entry calls what the page hands in (`escape`: a point's drag
//    cancelled, else the selection cleared), after points 1 and 2's checks (a press already taken, a dialog, typed
//    text), and is taken only when that did something, its repeats too; with nothing to do it is not taken.
// 7. The Editing entries, Delete or Backspace, Cmd or Ctrl+D and Cmd or Ctrl+A (brief 123, ruling AN), call what the
//    page hands in (`edit`, with the action and whether the press is a held key's repeat), after points 1, 2 and 4's
//    checks (a press already taken, a dialog, typed text: Backspace and Cmd or Ctrl+A in a text field stay the
//    field's; none of the three is one printable character without a command key, so the switch leaves all three on).
//    The key is taken exactly when the page says there was something to act on; with nothing, it is left to the
//    browser (Cmd or Ctrl+D with nothing selected still bookmarks the page, Cmd or Ctrl+A still selects its text). A
//    held key's repeat acts no more (the page's rule for an entry that does not repeat, as point 5's) and is taken
//    under the same condition. The nudge (brief 125, ruling AW) is two more Editing entries: an arrow alone, and
//    Shift with an arrow (the further nudge); `edit` is handed the arrow pressed. Both entries repeat, so a held
//    arrow's repeat is handed on as a press, not as a repeat. A slider and a menu item keep the arrows (point 2),
//    typed text and a dialog keep every key, and the arrows are not one printable character, so the switch leaves
//    them on.
// 8. A nudge burst (brief 125, ruling AY: the page's, one undo step for a run of nudges) is ended by any other key
//    before anything of that key runs: every press that is not a nudge, a modifier key pressed alone excepted (so
//    Shift pressed during a run does not split it), calls the page's `endNudge` first, whatever it then does, so Undo
//    or Redo meets the burst closed and puts it back whole. A nudge that is not taken (a slider's arrow, typed text's,
//    nothing to move) ends it too, afterwards.
// It does not claim to withstand code written to break it.
//
// Ported from v3's guard (InteractionHandler.js 890 to 970), and where it differs:
// - v3 counted every INPUT, TEXTAREA, SELECT and editable element as typing, so a range input took no shortcut at
//   all; here a typing field is what the listener says it is, and a slider is its own kind, keeping only its keys.
// - v3 let `?` (help) run inside a dialog; here it does nothing while one is open (Help is open already, or another
//   dialog holds the keys).
// - v3 kept Space for a button, link, disclosure or menu item, and the arrows for a menu item or an option; Enter is
//   kept here too, by name, though no entry has it, so adding one later cannot take a button's own activation; a
//   menu item or an option also keeps Home and End, which v3 let skip the animation.
// - v3's network-edit-mode guard (the pen's `a` and Ctrl+D) has no v4 counterpart yet.
// - v3's handler could be switched off whole (`enabled === false`, line 893); nothing here does that: the listener is
//   added once with the page and removed only with it.
// - v3 asked whether the key's target sat inside an open modal; here a dialog really open anywhere in the document
//   stops every key behind it (the listener's `isOpen`: Carbon's `is-visible`, a native dialog's `open`).
// - v3 answered `,` `.` `j` `k` `l` whatever modifier was held; the table's `matches` asks for no Ctrl, Cmd or Alt
//   (DEF-63), and lets Shift through (`<` and `>` need it).
// - v3 had no guard on a held key: its Space, held, played and paused at the keyboard's repeat rate. Here a held key
//   runs once, Undo, Redo and the frame steps excepted (point 5, D189, D205).
import type { Store } from '../store/store';
import type { EditorTransport } from '../transport/transport';
import { actionFor, KEYS, type ActionId, type ActionIn, type KeyPress } from './keys';

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
  readonly store: Pick<Store, Exclude<ActionIn<'General'>, 'help' | 'openProject' | 'escape'>>;
  readonly transport: Pick<EditorTransport, ActionIn<'Playback'>>;
  /** Opens Help: the page's, handed in. */
  readonly openHelp: () => void;
  /** Opens the file chooser for a project: the Open button's own, handed in by the page. */
  readonly openProject: () => void;
  /** Escape's one path, the page's, handed in (brief 115, ruling U): true when it cancelled a drag or cleared the selection. */
  readonly escape: () => boolean;
  /**
   * The Editing entries' one path, the page's, handed in (brief 123, ruling AN): true when there was something to act
   * on; a held key's repeat (`repeat`) acts no more but says the same. `key` is the key pressed (the nudge reads its
   * arrow); an entry that repeats (the nudges) is never handed a repeat.
   */
  readonly edit: (action: ActionIn<'Editing'>, repeat: boolean, key: string) => boolean;
  /** Ends an open nudge burst at once (point 8), the page's, handed in: nothing when none is open. */
  readonly endNudge: () => void;
}

const ACTIVATION: readonly string[] = [' ', 'Enter'];
/** A modifier key pressed alone: it ends no nudge burst (point 8). */
const MODIFIER_KEYS: readonly string[] = ['Shift', 'Control', 'Meta', 'Alt', 'AltGraph', 'CapsLock', 'Fn'];
const ARROWS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** The keys each kind of control acts on itself, and so keeps (claim point 2). */
const KEPT: Readonly<Record<FocusKind, readonly string[]>> = Object.freeze({
  button: ACTIVATION,
  link: ACTIVATION,
  menuitem: [...ACTIVATION, ...ARROWS, 'Home', 'End'],
  slider: [...ARROWS, 'Home', 'End', 'PageUp', 'PageDown'],
  other: [],
});

/** Runs the action `press` means here, if any; true when one ran or a held repeat was passed over (point 5), and the listener then cancels the key. */
export function dispatchKey(dispatch: KeyDispatch): boolean {
  const { press, mac, endNudge } = dispatch;
  const action = actionFor(press, mac);
  const nudge = action === 'nudge' || action === 'nudgeFurther';
  // Any other key ends a nudge burst before anything of it runs (point 8).
  if (!nudge && !MODIFIER_KEYS.includes(press.key)) endNudge();
  const taken = run(dispatch, action);
  if (nudge && !taken) endNudge();
  return taken;
}

/** Points 1 to 7 for the action `press` means. */
function run({ press, place, singleKeys, store, transport, openHelp, openProject, escape, edit }: KeyDispatch, action: ActionId | null): boolean {
  // Open project's chord is the editor's everywhere (point 2): taken in a dialog, where it runs nothing.
  const everywhere = action === 'openProject';
  if (place.dialogOpen) return everywhere;
  if (!everywhere && (place.typing || KEPT[place.focus].includes(press.key))) return false;
  const entry = KEYS.find((candidate) => candidate.action === action);
  if (entry === undefined) return false;
  const singleKey = press.key.length === 1 && press.key !== ' ' && !entry.modifiers.includes('command');
  if (singleKey && !singleKeys) return false;
  // Escape is taken only when it did something, held or not: with nothing to do it is left to the page (point 6).
  if (entry.action === 'escape') return escape();
  // The Editing entries are taken only when there was something to act on, held or not (point 7).
  if (entry.group === 'Editing') return edit(entry.action, press.repeat && !entry.repeats, press.key);
  if (press.repeat && !entry.repeats) return true;
  if (entry.action === 'help') openHelp();
  else if (entry.action === 'openProject') openProject();
  else if (entry.group === 'Playback') transport[entry.action]();
  else store[entry.action]();
  return true;
}
