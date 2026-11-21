// CORE-05, stage 3: the editor's key table. One table, read both by dispatch (which action a key press means) and by
// help (the rows it shows), so the two cannot differ: v3's did (its table called `,` and `.` "step", which nothing
// did; its handler skipped with them, D175). The entries are v3's live keys (InteractionHandler.js 940 to 968 and 1034
// to 1041; Undo and Redo, keybindings.js 295 to 308) and help's `?` (keybindings.js 316 to 322, "Open help"), and
// nothing else yet: Escape and the canvas's keys come with the stages that give them something to do.
//
// A press is given by shape (a real KeyboardEvent fits; a test needs none), and whether the machine is a Mac is handed
// in: the module names no browser global. The shell binds each action's id to a function of the same name (the
// editor's transport's, the store's Undo and Redo); the transport does not import the table.
//
// How a press is matched:
// - An entry with no modifier (every playback key) matches only when Ctrl, Cmd and Alt are all up, so no shortcut
//   takes a browser chord such as Ctrl or Cmd with L (DEF-63; v3 answered `l` whatever was held). Shift is not asked:
//   `<` and `>` need it on most keyboards, and v3 let Shift with any of these through.
// - `command` is Cmd on a Mac and Ctrl elsewhere (v3's `meta`); an entry that declares it matches only when exactly
//   that key is held, the other and Alt up, and Shift as the entry declares it (Undo without, Redo with).
// - Letters match whatever their case (Caps Lock, Shift), as v3's lower-casing did.
// - A press another listener has already taken (`defaultPrevented`) means no action (DEF-13.1, the table's half).
// - A held key repeats its press (`repeat`); the table does not decide on it, the dispatch does, by the entry's
//   `repeats` (D189): on for Undo and Redo alone, which repeat as in every editor; off for every other entry.
//
// Not ported: v3's mouse bindings, the stored custom bindings, the categories' icons and `formatBinding`'s symbols;
// a help row spells a chord in words ("Cmd+Shift+Z", "Ctrl+Shift+Z"), which is all a row needs.

/** `command` is Cmd on a Mac and Ctrl elsewhere. */
type Modifier = 'command' | 'shift';

/** Where help lists an action. */
type Group = 'Playback' | 'General';

interface KeyEntry<A extends string = ActionId, G extends Group = Group> {
  readonly action: A;
  /** The keys, as a KeyboardEvent's `key` names them; a letter in lower case. */
  readonly keys: readonly string[];
  readonly modifiers: readonly Modifier[];
  /** The words help shows for it, in the glossary's words. */
  readonly words: string;
  readonly group: G;
  /** Whether a held key runs it again at each repeat (D189): Undo and Redo only. */
  readonly repeats: boolean;
}

/** A key press, by the fields of a KeyboardEvent that dispatch reads. */
export interface KeyPress {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly defaultPrevented: boolean;
  /** The key is held down and this press is its repeat. */
  readonly repeat: boolean;
}

/** One row of help: the keys as they are shown, and what they do. */
interface HelpRow {
  readonly action: ActionId;
  readonly group: Group;
  readonly keys: readonly string[];
  readonly words: string;
}

/** One entry, its action's name and its group kept as written, so a type read from the table sees each row. */
const entry = <A extends string, G extends Group>(
  action: A, keys: readonly string[], words: string, group: G, modifiers: readonly Modifier[] = [], repeats = false,
): KeyEntry<A, G> =>
  Object.freeze({ action, keys: Object.freeze([...keys]), modifiers: Object.freeze([...modifiers]), words, group, repeats });

/** The table: one entry per action. */
export const KEYS = Object.freeze([
  entry('playPause', [' ', 'k'], 'Play/pause', 'Playback'),
  entry('reverse', ['j'], 'Play reverse', 'Playback'),
  entry('forward', ['l'], 'Play forward', 'Playback'),
  entry('skipToStart', ['Home', ',', '<'], 'Skip to start', 'Playback'),
  entry('skipToEnd', ['End', '.', '>'], 'Skip to end', 'Playback'),
  entry('undo', ['z'], 'Undo', 'General', ['command'], true),
  entry('redo', ['z'], 'Redo', 'General', ['command', 'shift'], true),
  entry('help', ['?'], 'Open help', 'General'),
]);

/** Every action a key may ask for, read from the table: the shell binds each to a function of the same name. */
export type ActionId = (typeof KEYS)[number]['action'];

/** The actions help lists in `group`, read from the table's rows. */
export type ActionIn<G extends Group> = Extract<(typeof KEYS)[number], { readonly group: G }>['action'];

/** Whether `entry` takes `press` on this machine; dispatch gives the first that does. */
export function matches({ keys, modifiers }: KeyEntry, press: KeyPress, mac: boolean): boolean {
  const key = press.key.length === 1 ? press.key.toLowerCase() : press.key;
  if (!keys.includes(key) || press.altKey) return false;
  if (!modifiers.includes('command')) return !press.ctrlKey && !press.metaKey;
  const [held, other] = mac ? [press.metaKey, press.ctrlKey] : [press.ctrlKey, press.metaKey];
  return held && !other && press.shiftKey === modifiers.includes('shift');
}

/** The action a press means, or null: none for a press already taken, or one no entry matches. */
export function actionFor(press: KeyPress, mac: boolean): ActionId | null {
  if (press.defaultPrevented) return null;
  return KEYS.find((candidate) => matches(candidate, press, mac))?.action ?? null;
}

const SHOWN: Readonly<Record<string, string>> = { ' ': 'Space' };

function shown(key: string, modifiers: readonly Modifier[], mac: boolean): string {
  const name = SHOWN[key] ?? (key.length === 1 ? key.toUpperCase() : key);
  const held = [
    ...(modifiers.includes('command') ? [mac ? 'Cmd' : 'Ctrl'] : []),
    ...(modifiers.includes('shift') ? ['Shift'] : []),
  ];
  return [...held, name].join('+');
}

/** The rows help shows, in the table's order, each key spelled as this machine's keyboard has it. */
export function helpRows(mac: boolean): readonly HelpRow[] {
  return KEYS.map(({ action, group, keys, modifiers, words }) =>
    Object.freeze({ action, group, keys: Object.freeze(keys.map((key) => shown(key, modifiers, mac))), words }),
  );
}
