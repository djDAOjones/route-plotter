/**
 * A11Y-01 — parameter hints describe their control instead of pretending to
 * be buttons.
 *
 * The shell is mounted from the real `index.html` rather than a fixture: the
 * defect this guards was a property of the actual sidebar markup (74 hint
 * labels), and a fixture would have let it pass. What a jsdom run can settle
 * here is semantics — roles, tab stops, `aria-describedby` wiring and the
 * focus/Escape contract. It cannot settle how NVDA or VoiceOver read the
 * result; that stays owner-run evidence on REV-05.
 *
 * jsdom does model the pointer-versus-keyboard heuristic behind
 * `:focus-visible`, so both halves of the focus contract are testable here —
 * but only because the arrangement is honest about which one it is staging.
 * A stray synthetic click leaves the document in "last interaction was
 * pointer" state and silently suppresses the keyboard path, so the tests
 * below arrange focus explicitly rather than inheriting it from a hook.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test, expect, beforeEach } from 'vitest';
import { initParamTooltips } from '../src/components/ParamTooltip.js';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

function mountShell() {
  document.documentElement.innerHTML = indexHtml
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<\/?html[^>]*>/gi, '');
}

/** The control a hint describes: its enclosing label's `for` target. */
function controlFor(trigger) {
  const label = trigger.tagName === 'LABEL' ? trigger : trigger.closest('label');
  return document.getElementById(label.getAttribute('for'));
}

/** The text `aria-describedby` actually resolves to, in announcement order. */
function describedText(control) {
  return (control.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(id => document.getElementById(id)?.textContent?.trim() ?? null);
}

function triggers() {
  return [...document.querySelectorAll('[data-tip]')];
}

/**
 * A real pointer click is cancelable. A synthetic one that is not lets jsdom
 * run the label's default activation, which forwards a second click to the
 * control and dismisses the very tooltip under test.
 */
function clickEvent() {
  return new window.MouseEvent('click', { bubbles: true, cancelable: true });
}

describe('parameter hints as control descriptions', () => {
  beforeEach(() => {
    mountShell();
    initParamTooltips();
  });

  test('the shell really does carry the hints this guards', () => {
    // A selector that quietly matched nothing would pass every other test here.
    expect(triggers().length).toBeGreaterThan(50);
  });

  test('no hint trigger claims a role or a tab stop', () => {
    const offenders = triggers()
      .filter(el => el.hasAttribute('role') || el.hasAttribute('tabindex'))
      .map(el => `${el.tagName}[${el.getAttribute('role')}/${el.getAttribute('tabindex')}]`);

    expect(offenders).toEqual([]);
  });

  test('every hint is exposed as its control’s description', () => {
    const unwired = triggers()
      .filter(el => !describedText(controlFor(el)).includes(el.getAttribute('data-tip').trim()))
      .map(el => el.getAttribute('data-tip').slice(0, 40));

    expect(unwired).toEqual([]);
  });

  test('an existing readout keeps its token, and keeps announcing first', () => {
    // Slider readouts own the first token by UI-STANDARDS; the hint appends.
    const slider = document.getElementById('dot-size');
    const tokens = (slider.getAttribute('aria-describedby') || '').split(/\s+/);

    expect(tokens[0]).toBe('dot-size-value');
    expect(tokens).toContain('dot-size-tip');
    expect(describedText(slider)).toEqual([
      '8 reference px',
      slider.closest('label').querySelector('[data-tip]').getAttribute('data-tip'),
    ]);
  });

  test('description nodes sit outside the label, leaving the name intact', () => {
    const leaked = triggers()
      .map(el => (el.tagName === 'LABEL' ? el : el.closest('label')))
      .filter(label => label.querySelector('.sr-only[id$="-tip"]'))
      .map(label => label.getAttribute('for'));

    expect(leaked).toEqual([]);

    // The visible label text must still be the whole accessible name.
    const iconLabel = document.querySelector('label[for="marker-style"]');
    expect(iconLabel.textContent).not.toContain('Shape of the waypoint marker');
  });

  test('generated description ids stay unique across the document', () => {
    const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test('re-initialising does not duplicate a description token', () => {
    initParamTooltips();
    initParamTooltips();

    const slider = document.getElementById('dot-size');
    const tokens = (slider.getAttribute('aria-describedby') || '').split(/\s+/);

    expect(tokens).toEqual(['dot-size-value', 'dot-size-tip']);
    expect(document.querySelectorAll('#dot-size-tip').length).toBe(1);
  });
});

describe('the visible tooltip stays reachable without a tab stop', () => {
  let trigger;
  let control;

  beforeEach(() => {
    mountShell();
    initParamTooltips();
    control = document.getElementById('dot-size');
    trigger = control.closest('label').querySelector('[data-tip]');
  });

  /** The shared element is created lazily on first show. */
  const tooltip = () => document.getElementById('param-tooltip');

  /** Arrive the way a keyboard user does, so `:focus-visible` is genuine. */
  function tabTo(el) {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    el.focus();
  }

  test('clicking the hint shows it, and clicking again closes it', () => {
    trigger.dispatchEvent(clickEvent());
    expect(tooltip().style.display).toBe('block');
    expect(tooltip().textContent).toBe(trigger.getAttribute('data-tip'));

    trigger.dispatchEvent(clickEvent());
    expect(tooltip().style.display).toBe('none');
  });

  test('it never competes with the description it duplicates', () => {
    trigger.dispatchEvent(clickEvent());

    // Announcing both the tooltip and the description would say it twice.
    expect(tooltip().getAttribute('aria-hidden')).toBe('true');
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
  });

  test('clicking the control it describes dismisses the hint', () => {
    trigger.dispatchEvent(clickEvent());
    expect(tooltip().style.display).toBe('block');

    control.dispatchEvent(clickEvent());
    expect(tooltip().style.display).toBe('none');
  });

  test('keyboard focus on the control reveals the same hint', () => {
    tabTo(control);

    expect(tooltip().style.display).toBe('block');
    expect(tooltip().textContent).toBe(trigger.getAttribute('data-tip'));
  });

  test('a mouse click on the control does not reveal it', () => {
    // The whole point of gating on :focus-visible: a mouse user who never
    // asked for the hint does not get one thrown over the sidebar.
    control.dispatchEvent(clickEvent());
    control.focus();

    expect(tooltip()?.style.display ?? 'none').toBe('none');
  });

  test('leaving the control hides it again', () => {
    tabTo(control);
    expect(tooltip().style.display).toBe('block');

    control.blur();
    expect(tooltip().style.display).toBe('none');
  });

  test('Escape dismisses it for as long as focus stays put', () => {
    tabTo(control);
    expect(tooltip().style.display).toBe('block');

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tooltip().style.display).toBe('none');

    // Still focused: a dismissed hint must not reappear on its own.
    control.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
    expect(tooltip().style.display).toBe('none');

    // Leaving and coming back is a new visit, so the hint returns.
    control.blur();
    tabTo(control);
    expect(tooltip().style.display).toBe('block');
  });
});

describe('hints that cannot be resolved are skipped, not half-wired', () => {
  beforeEach(mountShell);

  test('a label pointing at nothing leaves no marker and breaks no sibling', () => {
    const orphan = document.createElement('label');
    orphan.setAttribute('for', 'no-such-control');
    orphan.innerHTML = '<span data-tip="Describes a control that is not here">Orphan</span>';
    document.body.appendChild(orphan);

    expect(() => initParamTooltips()).not.toThrow();

    expect(orphan.querySelector('[data-tip]').hasAttribute('data-tip-desc')).toBe(false);
    expect(orphan.nextElementSibling).toBeNull();
    // The rest of the sidebar is still wired.
    expect(document.getElementById('dot-size').getAttribute('aria-describedby'))
      .toContain('dot-size-tip');
  });

  test('an empty hint gets no description node', () => {
    const label = document.createElement('label');
    label.setAttribute('for', 'dot-size');
    label.innerHTML = '<span data-tip="">Empty</span>';
    document.body.appendChild(label);

    initParamTooltips();

    expect(label.querySelector('[data-tip]').hasAttribute('data-tip-desc')).toBe(false);
    expect(label.nextElementSibling).toBeNull();
  });
});
