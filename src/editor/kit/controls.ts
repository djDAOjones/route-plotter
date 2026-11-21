// CORE-05, stage 4: the logic of a slider and of a number field, with no page. A React component is thin over it: it
// asks what to show, and passes on what the user did. The control is handed a `Setting`: the value held, read when
// asked, and an edit scoped to that one setting. It never reaches the store, the shell or the transport (the plan's
// rule 3: a feature's panel reaches the kit, never the store); the shell fits the store's gesture to this shape
// (src/editor/shell/settings.ts). Nothing here reads a clock, sets a timer or names anything of the browser.
//
// The claim, which the code is held to:
//
// 1. What a control shows is worked out from the value held, each time it is asked. A control keeps no copy of the
//    held value, so there is nothing to bring into step at start-up, after Open or after Undo (DEF-20.1). The one thing
//    it keeps is text being typed, and an edit it has begun and not yet ended.
// 2. Text typed into a number field is kept exactly as typed until the user commits it (Enter, or leaving the field)
//    or gives it up (Escape). No change to the held value from elsewhere, no refused commit and no re-reading replaces
//    it (DEF-97). A commit that is not a number, or that the edit refuses (the model's check; another change in
//    progress), changes nothing held, keeps the text, and gives back why in words a field can show. A commit that is
//    taken shows the held value again. Committing text that means the value already held changes nothing and makes no
//    step.
// 3. A slider's drag is one edit: begun at its start, each position set at once, committed once at its end. A pause in
//    the middle is nothing, since no timer exists to see it. So one drag is one undo step, and a drag that ends where it
//    began is none (the store's own rule, D170). Given up (Escape, the pointer lost), the edit is cancelled and the
//    held value is as before. A key's nudge is an edit of one: begun, set and committed at once; during a drag it is
//    one more position of that drag.
// 4. A refused begin changes nothing: the control shows what is held, and says why and that nothing held changed. A
//    control never sets, commits or cancels an edit it did not begin, and never leaves one open: every edit it begins
//    ends in exactly one commit or one cancel, whatever order the events come in (a move with no start, two starts,
//    two ends, an end after a give-up).
//
// It does not claim to withstand code written to break it, nor a `Setting` that breaks the contract below.

/** What an edit gives back: taken, and whether anything held changed; or refused, with words a field can show. */
export type Result = { readonly ok: true; readonly changed: boolean } | { readonly ok: false; readonly why: string };

/**
 * An open edit of one setting. `set` shows its value at once (or is refused, the edit still open); `commit` keeps what
 * was set as one step, none when the value ends as it began; `cancel` puts back what was held at the begin. Either of
 * `commit` and `cancel` ends the edit, taken or refused.
 */
interface Edit {
  set(value: number): Result;
  commit(): Result;
  cancel(): Result;
}

/** A begun edit, or why none could begin (another change in progress; the setting no longer there). */
export type Begun = { readonly ok: true; readonly edit: Edit } | { readonly ok: false; readonly why: string };

/** What a control is handed: the value held, read each time it is asked, and how to begin an edit of it. */
export interface Setting {
  /** The value held now; undefined when there is none to show, such as a setting of a route since removed. */
  read(): number | undefined;
  begin(): Begun;
}

/** What a field says when the text it commits is not a number. */
export const NOT_A_NUMBER = 'Enter a number in figures, such as 12 or 0.5.';

const NOTHING: Result = { ok: true, changed: false };

/** A number in figures: an optional sign, digits with at most one decimal point, and nothing else. */
const FIGURES = /^[-+]?(\d+\.?\d*|\.\d+)$/;

/** The number `text` means, or null when it is not one written in figures. Spaces around it are allowed. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  return FIGURES.test(trimmed) ? Number(trimmed) : null;
}

export interface Slider {
  /** The value to show: the value held, read now. */
  shown(): number | undefined;
  /** Whether a drag this slider began is still open. */
  dragging(): boolean;
  /** A drag starts (pointer down on the thumb or track): begins an edit; refused, it changes nothing. */
  start(): Result;
  /** The drag moves to `value`: shown at once. With no drag open, nothing. */
  move(value: number): Result;
  /** The drag ends (pointer up): one commit, so one undo step, or none if it ends where it began. */
  end(): Result;
  /** The drag is given up (Escape, the pointer lost): the edit is cancelled, the held value as before. */
  giveUp(): Result;
  /** A key moves the slider to `value`: an edit of one, or one more position of the drag open. */
  nudge(value: number): Result;
}

/** A slider's logic over `setting`. Its one state is the edit of a drag it began and has not ended. */
export function createSlider(setting: Setting): Slider {
  let drag: Edit | null = null;

  const move = (value: number): Result => (drag === null ? NOTHING : drag.set(value));

  return {
    shown: () => setting.read(),
    dragging: () => drag !== null,
    start: () => {
      if (drag !== null) return NOTHING;
      const begun = setting.begin();
      if (!begun.ok) return { ok: false, why: begun.why };
      drag = begun.edit;
      return NOTHING;
    },
    move,
    end: () => {
      if (drag === null) return NOTHING;
      const edit = drag;
      drag = null;
      return edit.commit();
    },
    giveUp: () => {
      if (drag === null) return NOTHING;
      const edit = drag;
      drag = null;
      return edit.cancel();
    },
    nudge: (value) => (drag === null ? editOfOne(setting, value) : move(value)),
  };
}

/** One edit begun, set to `value` and committed; a refused set is cancelled. */
function editOfOne(setting: Setting, value: number): Result {
  const begun = setting.begin();
  if (!begun.ok) return { ok: false, why: begun.why };
  const set = begun.edit.set(value);
  if (!set.ok) {
    begun.edit.cancel();
    return set;
  }
  return begun.edit.commit();
}

/** What a number field shows: its text, whether that is text being typed, and why its last commit was refused. */
interface FieldView {
  readonly text: string;
  readonly typing: boolean;
  readonly problem: string | null;
}

export interface NumberField {
  shown(): FieldView;
  /** The text in the field is now `text`: kept exactly as typed. */
  type(text: string): void;
  /** Enter, or leaving the field: the text typed becomes the value held, or stays with why it could not. */
  commit(): Result;
  /** Escape: the text typed is given up, and the field shows the value held. */
  escape(): Result;
}

/**
 * A number field's logic over `setting`; `format` writes the value held as the field shows it. Its one state is the
 * text being typed, null while none is, and why that text's last commit was refused.
 */
export function createNumberField(setting: Setting, format: (value: number) => string = String): NumberField {
  let typed: string | null = null;
  let problem: string | null = null;

  const refuse = (why: string): Result => {
    problem = why;
    return { ok: false, why };
  };
  const done = (result: Result): Result => {
    typed = null;
    problem = null;
    return result;
  };

  return {
    shown: () => {
      if (typed !== null) return { text: typed, typing: true, problem };
      const held = setting.read();
      return { text: held === undefined ? '' : format(held), typing: false, problem: null };
    },
    type: (text) => {
      typed = text;
      problem = null;
    },
    commit: () => {
      if (typed === null) return NOTHING;
      const value = parseNumber(typed);
      if (value === null) return refuse(NOT_A_NUMBER);
      if (value === setting.read()) return done(NOTHING);
      const result = editOfOne(setting, value);
      return result.ok ? done(result) : refuse(result.why);
    },
    escape: () => done(NOTHING),
  };
}
