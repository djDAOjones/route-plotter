// CORE-05, stage 5: a switch for a setting that is on or off, over Carbon's `Toggle` (1.118): a `<button
// role="switch">` with `aria-checked`, named by its visible label, its "On" or "Off" beside it shown and hidden from a
// screen reader. Two things are added:
// - The target. Carbon draws the button visually hidden (one pixel; `_toggle.scss` 43) and lets its label take the
//   press, so the switch's own box is far under the house's 44 CSS px. Here the button is laid, transparent, over the
//   whole switch (label, track and "On"/"Off"), at least 44 px high: the box a pointer presses and the box that has
//   focus are one, and Carbon's focus ring on the track still shows, since it follows the button's focus.
// - Its help: the sentence under it, tied to the button by `aria-describedby`, so it is read with the switch, its lines
//   kept short enough to read (WCAG's 1.4.8 asks for 80 characters at most: `HELP_LINE`).
// It holds no value of its own: it shows `on` and says when it is pressed (`onChange`).
import { Toggle } from '@carbon/react';
import type { CSSProperties } from 'react';

export interface SwitchProps {
  /** The button's id; its help's id is made from it. */
  readonly id: string;
  /** The visible label. */
  readonly labelText: string;
  /** The sentence under it, in plain words: what turning it off stops and what keeps working. */
  readonly help: string;
  readonly on: boolean;
  readonly onChange: (on: boolean) => void;
}

/** The house's target size (CSS px), as the accessibility run's `houseTarget` measures it. */
const TARGET_PX = 44;

const AROUND: CSSProperties = { position: 'relative', display: 'inline-block', minBlockSize: TARGET_PX, minInlineSize: TARGET_PX };
/** The help's longest line: 60 widths of the digit 0, under 80 characters of running text. */
const HELP_LINE: CSSProperties = { maxInlineSize: '60ch' };
/** Over the visually hidden button: the whole switch, transparent, above the label. */
const OVER: CSSProperties = {
  clip: 'auto', margin: 0, inset: 0, inlineSize: '100%', blockSize: '100%', opacity: 0, zIndex: 1, cursor: 'pointer',
};

/** A labelled switch with its help under it. */
export function Switch({ id, labelText, help, on, onChange }: SwitchProps) {
  const helpId = `${id}-help`;
  return (
    <div>
      <div style={AROUND}>
        <Toggle id={id} labelText={labelText} toggled={on} onToggle={onChange} aria-describedby={helpId} style={OVER} />
      </div>
      <p id={helpId} className="cds--form__helper-text" style={HELP_LINE}>{help}</p>
    </div>
  );
}
