// CORE-05, stage 5: what the kit's dialog and switch draw, through react-dom/server (no page: focus and events are the
// accessibility run's). The dialog: named by its heading, modal, a close button, no hidden focus sentinel, no disabled
// fieldset (UI-06.6). The switch: a switch named by its label, its state, its help tied to it.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Dialog } from './Dialog';
import { Switch } from './Switch';

const opener = { current: null };
const nothing = (): void => undefined;
const dialog = (open: boolean) =>
  renderToStaticMarkup(createElement(Dialog, { opener, heading: 'Help', open, onClose: nothing, children: createElement('p', null, 'Inside') }));

describe('the kit’s dialog', () => {
  it('draws a modal dialog named by its heading, with its content and a close button', () => {
    const html = dialog(true);
    expect(html).toMatch(/role="dialog"[^>]*aria-label="Help"[^>]*aria-modal="true"/);
    expect(html).toMatch(/<h2[^>]*>Help<\/h2>/);
    expect(html).toContain('<p>Inside</p>');
    // Focus lands on the content's start, not on Close, whose tooltip takes the first Escape (Dialog.tsx's header).
    expect(html).toMatch(/<div tabindex="-1" data-modal-primary-focus="true"><p>Inside<\/p>/);
    expect(html).toMatch(/<button[^>]*aria-label="Close"/);
    expect(html).toMatch(/class="[^"]*cds--modal is-visible/);
    expect(html).toMatch(/class="[^"]*cds--modal is-visible[^"]*"[^>]*style="transition:none"|style="transition:none"[^>]*class="[^"]*cds--modal is-visible/);
  });

  // Changed with Help on the page: closed, Carbon's modal stayed drawn and hidden, which the accessibility run's
  // state-cue check cannot find again; now nothing is drawn.
  it('closed, draws nothing', () => {
    expect(dialog(false)).toBe('');
  });

  it('draws no hidden focus sentinel and no disabled fieldset (UI-06.6)', () => {
    for (const open of [true, false]) {
      const html = dialog(open);
      expect(html).not.toContain('Focus sentinel');
      expect(html).not.toMatch(/<fieldset[^>]*disabled/);
    }
  });
});

describe('the kit’s switch', () => {
  const draw = (on: boolean) =>
    renderToStaticMarkup(createElement(Switch, { id: 's', labelText: 'A setting', help: 'What it does.', on, onChange: nothing }));

  it('is a switch named by its visible label, its help tied to it, its state as given', () => {
    for (const on of [true, false]) {
      const html = draw(on);
      expect(html).toMatch(new RegExp(`<button[^>]*role="switch"[^>]*aria-checked="${String(on)}"`));
      expect(html).toMatch(/aria-labelledby="s_label"/);
      expect(html).toMatch(/id="s_label"[^>]*>.*A setting/);
      expect(html).toMatch(/aria-describedby="s-help"/);
      expect(html).toMatch(/<p id="s-help"[^>]*>What it does\.<\/p>/);
      expect(html).toMatch(/<p id="s-help"[^>]*style="max-inline-size:60ch"/);
    }
  });

  it('lays its button over the whole switch, at least the house’s 44 px', () => {
    const html = draw(true);
    expect(html).toMatch(/min-block-size:44px/);
    expect(html).toMatch(/<button[^>]*style="[^"]*clip:auto[^"]*inline-size:100%;block-size:100%;opacity:0/);
  });
});
