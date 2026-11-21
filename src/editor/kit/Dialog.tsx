// CORE-05, stage 5: the one way the editor opens a dialog, over Carbon's `Modal`. It is always handed its opener (the
// element focus goes back to when it closes), its heading and its content, and whether it is open; it says when it
// asks to close. Carbon gives the rest, and it is leaned on as Carbon 1.118 has it:
// - focus moves in when it opens (Modal.js 262 to 275), to what carries `data-modal-primary-focus`: here the start of
//   its content, a wrapper focusable by script only (`tabIndex` -1), not Carbon's default, the close button. That
//   button's tooltip opens with its focus and takes the first Escape for itself (Tooltip.js 76 to 80 stops the key), so
//   one Escape would not close a dialog just opened. From the content's start Tab goes on to its first control and
//   Shift+Tab back to Close; a reader hears the dialog's name, then its content from the top;
// - Tab is kept inside by Carbon's wrap without sentinels (the `enable-focus-wrap-without-sentinels` flag, Modal.js
//   106 and 121), so no hidden "Focus sentinel" link joins the page's reading or Tab order;
// - Escape closes it (Modal.js 211 to 219, a keydown listener on `document` while it is open, which cancels the key);
// - focus goes back to the opener when it closes, and the kit does that itself. Carbon's own return
//   (`launcherButtonRef`) runs by a `setTimeout` only when a mounted modal turns from open to closed (Modal.js 239),
//   and on unmount only when presence is enabled (Modal.js 251), which this kit does not enable. Here a closed dialog
//   is unmounted (below), so Carbon's call does not run: the kit closes it synchronously (`flushSync`; the unmount
//   takes Carbon's blur trap, Modal.js 135, with it) and then focuses the opener at once, never leaving focus on a
//   control that has gone.
// - It does not fade: Carbon's `.cds--modal` fades out over 240 ms with `visibility 0s linear 0.24s`, so for that time
//   after Escape it is still visible to a reader and to the accessibility run's dialog check. Its own transition is
//   switched off here (one rule, `NO_FADE`, on the element Carbon spreads the rest of its props onto, Modal.js 481), so
//   it shows and hides at once; nothing else of Carbon's is changed.
// Closed, it draws nothing: Carbon would keep a closed modal mounted and hidden, and the accessibility run counts a
// control hidden so as one it cannot find again (its state-cue check). Should one be drawn closed, the shell's listener
// still counts it open only by Carbon's `is-visible` (keydown.ts, `isOpen`).
//
// No `<fieldset disabled>` inside a dialog, ever (UI-06.6). Carbon finds where Tab goes by two lists that need not
// agree: the wrap without sentinels uses the `tabbable` package, which leaves out a control inside a disabled
// fieldset, and the blur fallback Carbon's own `selectorTabbable` (internal/keyboard/navigation.js 29 to 34), which
// leaves out only a control that carries `disabled` itself; so the fallback could send focus to a control in such a
// fieldset that cannot take it. A control that is off carries `disabled` itself. Dialog.test.ts holds this for the kit's own
// drawing (a fixture's content); Help's content is held by Help.test.ts.
import { FeatureFlags, Modal } from '@carbon/react';
import { flushSync } from 'react-dom';
import type { CSSProperties, ReactNode, RefObject } from 'react';

export interface DialogProps {
  /** The element that opened it: focus goes back to it on close, however the dialog was opened. */
  readonly opener: RefObject<HTMLElement | null>;
  /** The short heading it shows and is named by. */
  readonly heading: string;
  readonly open: boolean;
  /** Asked to close: by Escape, its close button or a press outside it. */
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/** Carbon's fade switched off: shown and hidden at once (see the header). */
const NO_FADE: CSSProperties = { transition: 'none' };

/** A dialog with a heading, a close button and its content; no buttons of its own beyond closing. */
export function Dialog({ opener, heading, open, onClose, children }: DialogProps) {
  if (!open) return null;
  return (
    <FeatureFlags enableFocusWrapWithoutSentinels>
      <Modal
        style={NO_FADE}
        open={open}
        passiveModal
        modalHeading={heading}
        launcherButtonRef={opener}
        onRequestClose={() => {
          flushSync(onClose);
          opener.current?.focus();
        }}
      >
        <div tabIndex={-1} data-modal-primary-focus>
          {children}
        </div>
      </Modal>
    </FeatureFlags>
  );
}
