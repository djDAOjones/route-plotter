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
//    A slider's widget that reports only where its thumb now stands (Carbon's does) is read through a press: what it
//    reports while the pointer is down is a position of the drag, or nothing once the drag is given up or was refused;
//    what it reports with no press is a key's nudge; and a report of the position already held is the widget's echo of
//    a change made elsewhere, which begins nothing and makes no step, whatever else is open. A press while one is down
//    (a second finger) is nothing until the release, also after a give-up or a refusal, so one press begins at most
//    one edit. What that costs: if a release is ever lost, the next press is nothing, and its release clears it.
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

/**
 * What a control is handed: the value held, read each time it is asked; how to begin an edit of it; and how a page
 * learns that it may have changed, so that it asks again.
 */
export interface Setting {
  /** The value held now; undefined when there is none to show, such as a setting of a route since removed. */
  read(): number | undefined;
  begin(): Begun;
  /** Calls `listener` after any change that may have changed the value held; gives back the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** How a slider's thumb position stands for a value, and back: a pair from sliderScales.ts, or the identity. */
export interface Scale {
  toPosition(value: number): number;
  toValue(position: number): number;
}

/** A thumb whose position is the value itself. */
export const IDENTITY: Scale = { toPosition: (value) => value, toValue: (position) => position };

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
  /**
   * Whether a drag this slider began still waits for its end (`end()` or `giveUp()`). Its edit may already have been
   * closed elsewhere (Open ends the store's gesture); the drag is still reported until one of those ends it here.
   */
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
  /** Where the thumb shows the value held: its position on the scale; undefined when nothing is held. */
  position(): number | undefined;
  /** The value a thumb at `position` stands for, as read out: the value held, exactly, where the thumb shows it. */
  readout(position: number): number;
  /** Whether the pointer is down on the slider: between `press()` and `release()`, given up or not. */
  pressed(): boolean;
  /**
   * The pointer goes down on the slider: a press, and the drag begun (`start()`); refused, the press changes nothing.
   * While a press is down, given up or refused or not, another is nothing until `release()`.
   */
  press(): Result;
  /**
   * The widget says its thumb now stands at `position`. The position held already is its echo of a change made
   * elsewhere: nothing. During a press, one more position of the drag, or nothing once it is given up or was refused.
   * With no press, a key's nudge.
   */
  report(position: number): Result;
  /** The pointer is let go: the press ends, and so does its drag (`end()`), if one is still open. */
  release(): Result;
}

/**
 * A slider's logic over `setting`, its thumb placed by `scale`. Its state is the edit of a drag it began and has not yet
 * been told the end of, and whether the pointer is down on it.
 */
export function createSlider(setting: Setting, scale: Scale = IDENTITY): Slider {
  let drag: Edit | null = null;
  let down = false;

  const move = (value: number): Result => (drag === null ? NOTHING : drag.set(value));
  const start = (): Result => {
    if (drag !== null) return NOTHING;
    const begun = setting.begin();
    if (!begun.ok) return { ok: false, why: begun.why };
    drag = begun.edit;
    return NOTHING;
  };
  const end = (): Result => {
    if (drag === null) return NOTHING;
    const edit = drag;
    drag = null;
    return edit.commit();
  };
  const position = (): number | undefined => {
    const held = setting.read();
    return held === undefined ? undefined : scale.toPosition(held);
  };
  const nudge = (value: number): Result => (drag === null ? editOfOne(setting, value) : move(value));

  return {
    shown: () => setting.read(),
    dragging: () => drag !== null,
    start,
    move,
    end,
    giveUp: () => {
      if (drag === null) return NOTHING;
      const edit = drag;
      drag = null;
      return edit.cancel();
    },
    nudge,
    position,
    readout: (at) => {
      const held = setting.read();
      return held !== undefined && at === position() ? held : scale.toValue(at);
    },
    pressed: () => down,
    press: () => {
      if (down) return NOTHING;
      down = true;
      return start();
    },
    report: (at) => {
      if (at === position()) return NOTHING;
      return down ? move(scale.toValue(at)) : nudge(scale.toValue(at));
    },
    release: () => {
      down = false;
      return end();
    },
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
  /** What to show; the value held is written with `format` when one is given, else with the field's own. */
  shown(format?: (value: number) => string): FieldView;
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
    shown: (write = format) => {
      if (typed !== null) return { text: typed, typing: true, problem };
      const held = setting.read();
      return { text: held === undefined ? '' : write(held), typing: false, problem: null };
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
