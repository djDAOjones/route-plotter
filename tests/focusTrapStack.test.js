/**
 * UI-06 (Codex r1, blocking) — open dialogs' focus traps stack.
 *
 * Every active trap listens for `focusin` on the document and `keydown` on
 * the window, and each pulled focus into its own dialog whenever it landed
 * outside. Two active at once — a codec probe that answers while the
 * Discard dialog asks — handed focus back and forth until the stack
 * overflowed (CI's "Maximum call stack size exceeded" and source-map
 * "Stack overflow" errors). The traps are a stack now: only the top one takes
 * focus, Tab and Escape; closing it resumes the one below with its own focus
 * return; and `inert` follows the stack, so the dialog on top is never inert
 * and the one beneath is while it is covered. The announcements' live region
 * is never inert, so what is said while a dialog is open is heard.
 */

import { afterEach, describe, expect, test } from 'vitest';
import { createFocusTrap } from '../src/utils/focusTrap.js';

/**
 * The page: the announcer and the app beside two dialogs, as index.html has
 * them (each dialog a child of the body), and one element the page made
 * inert itself before any dialog opened.
 */
function page() {
  document.body.innerHTML = `
    <div id="announcer" role="status" aria-live="polite"></div>
    <main id="app"><button id="opener" type="button">Open</button><button id="other" type="button">Other</button></main>
    <div id="parked" inert><button type="button">Parked</button></div>
    <div id="lower" role="dialog" aria-modal="true" style="display:flex">
      <h2 id="modal-title-lower">Discard?</h2>
      <button id="lower-cancel" type="button">Cancel</button>
      <button id="lower-confirm" type="button">Discard</button>
    </div>
    <div id="upper" role="dialog" aria-modal="true" style="display:flex">
      <h2 id="modal-title-upper">MP4 export unavailable</h2>
      <button id="upper-webm" type="button">Export as WebM</button>
      <button id="upper-cancel" type="button">Cancel</button>
    </div>
  `;
  const byId = id => document.getElementById(id);
  return {
    byId,
    lower: byId('lower'),
    upper: byId('upper'),
    inert: () => [...document.body.children].filter(each => each.hasAttribute('inert')).map(each => each.id),
  };
}

/**
 * Errors thrown by listeners while focus moves (jsdom reports them on the
 * window rather than to the caller): recorded, and kept from the console.
 */
function recordListenerErrors() {
  const errors = [];
  const onError = (event) => {
    errors.push(event.error ?? event.message);
    event.preventDefault();
  };
  window.addEventListener('error', onError);
  return { errors, stop: () => window.removeEventListener('error', onError) };
}

const press = (target, key, flags = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...flags });
  target.dispatchEvent(event);
  return event;
};

const traps = [];
const trapFor = (modal) => {
  const trap = createFocusTrap(modal);
  traps.push(trap);
  return trap;
};

afterEach(() => {
  // Topmost first, as dialogs close.
  for (const trap of traps.splice(0).reverse()) trap.deactivate();
});

describe('two dialogs open at once (UI-06, Codex r1)', () => {
  test('focus that lands outside goes to the top dialog, once, with no recursion', () => {
    const { byId, upper } = page();
    const listenerErrors = recordListenerErrors();
    const focusMoves = [];
    // Ahead of the traps' own capture listeners, so each move is recorded as it happens.
    const onFocus = event => focusMoves.push(event.target.id);
    document.addEventListener('focusin', onFocus, true);
    try {
      byId('opener').focus();
      trapFor(byId('lower')).activate(byId('lower-cancel'));
      focusMoves.length = 0;
      trapFor(upper).activate();
      expect(document.activeElement).toBe(byId('modal-title-upper'));

      // Focus sent to the app, or to the dialog beneath, comes to the top dialog.
      byId('other').focus();
      expect(upper.contains(document.activeElement)).toBe(true);
      byId('lower-confirm').focus();
      expect(upper.contains(document.activeElement)).toBe(true);
    } finally {
      document.removeEventListener('focusin', onFocus, true);
      listenerErrors.stop();
    }
    expect(listenerErrors.errors).toEqual([]);
    // Opening: the top dialog's title. Each stray focus: there, then back to the title.
    expect(focusMoves).toEqual([
      'modal-title-upper', 'other', 'modal-title-upper', 'lower-confirm', 'modal-title-upper',
    ]);
  });

  test('Tab and Escape act on the top dialog only', () => {
    const { byId, lower, upper } = page();
    const lowerTrap = trapFor(lower);
    const upperTrap = trapFor(upper);
    const escaped = [];
    lower.addEventListener('focustrap:escape', () => escaped.push('lower'));
    upper.addEventListener('focustrap:escape', () => escaped.push('upper'));
    byId('opener').focus();
    lowerTrap.activate(byId('lower-cancel'));
    upperTrap.activate();

    // From the title, Tab enters the top dialog's sequence; it wraps there.
    expect(press(document.activeElement, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('upper-webm'));
    byId('upper-cancel').focus();
    expect(press(document.activeElement, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('upper-webm'));
    expect(press(document.activeElement, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('upper-cancel'));

    // Escape closes the top dialog alone.
    expect(press(document.activeElement, 'Escape').defaultPrevented).toBe(true);
    expect(escaped).toEqual(['upper']);
    expect(upperTrap.isActive).toBe(false);
    expect(lowerTrap.isActive).toBe(true);

    // The dialog beneath has Tab and Escape back.
    expect(document.activeElement).toBe(byId('lower-cancel'));
    byId('lower-confirm').focus();
    expect(press(document.activeElement, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('lower-cancel'));
    press(document.activeElement, 'Escape');
    expect(escaped).toEqual(['upper', 'lower']);
    expect(lowerTrap.isActive).toBe(false);
    expect(document.activeElement).toBe(byId('opener'));
  });

  test('the top dialog is never inert, the one beneath is while covered, and closing each restores what it changed', () => {
    const { byId, lower, upper, inert } = page();
    const lowerTrap = trapFor(lower);
    const upperTrap = trapFor(upper);
    byId('opener').focus();

    lowerTrap.activate(byId('lower-cancel'));
    expect(inert()).toEqual(['app', 'parked', 'upper']);

    upperTrap.activate();
    expect(inert()).toEqual(['app', 'parked', 'lower']);
    expect(upper.contains(document.activeElement)).toBe(true);

    upper.style.display = 'none';
    upperTrap.deactivate();
    expect(inert()).toEqual(['app', 'parked', 'upper']);
    expect(document.activeElement).toBe(byId('lower-cancel'));

    lower.style.display = 'none';
    lowerTrap.deactivate();
    // As the page had it: only what it made inert itself.
    expect(inert()).toEqual(['parked']);
    expect(document.activeElement).toBe(byId('opener'));
  });

  test('a dialog closed while another is over it leaves the top one as it is', () => {
    const { byId, lower, upper, inert } = page();
    const lowerTrap = trapFor(lower);
    const upperTrap = trapFor(upper);
    byId('opener').focus();
    lowerTrap.activate(byId('lower-cancel'));
    upperTrap.activate();
    byId('upper-webm').focus();

    lower.style.display = 'none';
    lowerTrap.deactivate();
    expect(upperTrap.isActive).toBe(true);
    expect(document.activeElement).toBe(byId('upper-webm'));
    expect(inert()).toEqual(['app', 'parked', 'lower']);
    byId('other').focus();
    expect(upper.contains(document.activeElement)).toBe(true);

    upper.style.display = 'none';
    upperTrap.deactivate();
    expect(inert()).toEqual(['parked']);
  });

  test('the announcer stays out of the inert background, so what is said while a dialog is open is heard', () => {
    const { byId, lower, upper } = page();
    trapFor(lower).activate();
    expect(byId('announcer').hasAttribute('inert')).toBe(false);
    expect(byId('app').hasAttribute('inert')).toBe(true);
    trapFor(upper).activate();
    expect(byId('announcer').hasAttribute('inert')).toBe(false);
  });
});
