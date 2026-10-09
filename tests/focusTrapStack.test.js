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
 * inert itself before any dialog opened. The opener is not the page's first
 * control, so focus that falls back to the page is told from focus given back.
 */
function page() {
  document.body.innerHTML = `
    <div id="announcer" role="status" aria-live="polite"></div>
    <main id="app"><button id="first" type="button">Menu</button><button id="opener" type="button">Open</button><button id="other" type="button">Other</button></main>
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
    // The top dialog's own return target is in the hidden dialog beneath; it
    // gives focus back where that one would have: the opener (Codex r2).
    expect(document.activeElement).toBe(byId('opener'));
  });

  test('closed out of order, the return chain leads to the first opener that can take focus: never a hidden, inert or closed dialog\'s control (Codex r2)', () => {
    const { byId, lower, upper } = page();
    const middle = document.createElement('div');
    middle.id = 'middle';
    middle.setAttribute('role', 'dialog');
    middle.setAttribute('aria-modal', 'true');
    middle.innerHTML = '<h2 id="modal-title-middle">Share</h2><button id="middle-ok" type="button">OK</button>';
    upper.before(middle);
    const lowerTrap = trapFor(lower);
    const middleTrap = trapFor(middle);
    const upperTrap = trapFor(upper);

    // Closed beneath the top one but left on screen: still a closed dialog.
    byId('opener').focus();
    lowerTrap.activate(byId('lower-cancel'));
    upperTrap.activate();
    lowerTrap.deactivate();
    upperTrap.deactivate();
    expect(document.activeElement).toBe(byId('opener'));

    // Three deep, the two beneath closed first, the lowest left on screen:
    // the chain runs through both to the opener.
    byId('opener').focus();
    lowerTrap.activate(byId('lower-cancel'));
    middleTrap.activate(byId('middle-ok'));
    upperTrap.activate();
    lowerTrap.deactivate();
    middle.style.display = 'none';
    middleTrap.deactivate();
    expect(upper.contains(document.activeElement)).toBe(true);
    upperTrap.deactivate();
    expect(document.activeElement).toBe(byId('opener'));
    middle.style.display = '';

    // The opener gone from view meanwhile: the page's first control that can take focus.
    lowerTrap.activate(byId('lower-cancel'));
    upperTrap.activate();
    lowerTrap.deactivate();
    byId('opener').hidden = true;
    upperTrap.deactivate();
    expect(document.activeElement).toBe(byId('first'));
    byId('opener').hidden = false;

    // In the order they opened, nothing changes: each gives focus back to its own opener.
    byId('opener').focus();
    lowerTrap.activate(byId('lower-cancel'));
    upperTrap.activate();
    upperTrap.deactivate();
    expect(document.activeElement).toBe(byId('lower-cancel'));
    lowerTrap.deactivate();
    expect(document.activeElement).toBe(byId('opener'));
  });

  /**
   * The app's skip link, its page's first control (index.html): where focus
   * goes when nothing in the chain takes it and no dialog is open beneath
   * (Codex r3's answer to question 2-1).
   */
  const skipLink = () => {
    const link = document.createElement('a');
    link.id = 'skip';
    link.className = 'skip-link';
    link.href = '#app';
    link.textContent = 'Skip to main content';
    document.body.prepend(link);
    return link;
  };

  test('a target disabled through its fieldset is passed over: the next in the chain has focus, else the skip link, never the closed dialog\'s heading (Codex r3)', () => {
    const { byId, lower, upper } = page();
    const skip = skipLink();
    // The opener and Other in one group, as a toolbar's buttons are; Other
    // keeps the roving tabindex a toolbar gives its buttons.
    const group = document.createElement('fieldset');
    group.id = 'group';
    byId('opener').before(group);
    group.append(byId('opener'), byId('other'));
    byId('other').tabIndex = -1;
    const lowerTrap = trapFor(lower);
    const upperTrap = trapFor(upper);

    // Codex's reproduction: the opener's group disabled while the dialog was open.
    byId('opener').focus();
    lowerTrap.activate();
    expect(document.activeElement).toBe(byId('modal-title-lower'));
    group.disabled = true;
    lower.style.display = 'none';
    lowerTrap.deactivate();
    expect(document.activeElement).toBe(skip);
    group.disabled = false;
    lower.style.display = 'flex';

    // A named target disabled through its group: the next in the chain, the
    // opener of the dialog closed beneath, has it. Other's tabindex would let
    // jsdom focus it, disabled or not; a browser would not, and nor does the trap.
    byId('first').focus();
    lowerTrap.activate();
    upperTrap.activate(null, byId('other'));
    lowerTrap.deactivate();
    group.disabled = true;
    upper.style.display = 'none';
    upperTrap.deactivate();
    expect(document.activeElement).toBe(byId('first'));
    upper.style.display = 'flex';

    // The whole chain disabled through the group: the skip link.
    group.disabled = false;
    byId('opener').focus();
    lowerTrap.activate();
    upperTrap.activate(null, byId('other'));
    lowerTrap.deactivate();
    group.disabled = true;
    upperTrap.deactivate();
    expect(document.activeElement).toBe(skip);
  });

  test('a target that passes every check but does not take focus is passed over: the next in the chain, the skip link, or the page\'s next control has it (Codex r3)', () => {
    const { byId, lower, upper } = page();
    const skip = skipLink();
    // A card focusable by its tabindex alone; the tabindex goes while a dialog is open.
    const card = document.createElement('div');
    card.id = 'card';
    card.textContent = 'Card';
    byId('other').after(card);
    const lowerTrap = trapFor(lower);
    const upperTrap = trapFor(upper);

    // Its own opener refuses focus: the skip link.
    card.tabIndex = 0;
    card.focus();
    expect(document.activeElement).toBe(card);
    lowerTrap.activate();
    card.removeAttribute('tabindex');
    lower.style.display = 'none';
    lowerTrap.deactivate();
    expect(document.activeElement).toBe(skip);
    lower.style.display = 'flex';

    // Its named target refuses: the next in the chain, the opener of the dialog closed beneath.
    card.tabIndex = 0;
    byId('opener').focus();
    lowerTrap.activate();
    upperTrap.activate(null, card);
    lowerTrap.deactivate();
    card.removeAttribute('tabindex');
    upper.style.display = 'none';
    upperTrap.deactivate();
    expect(document.activeElement).toBe(byId('opener'));
    upper.style.display = 'flex';

    // The page's first control refuses too (a tabindex that is not a number,
    // which no browser focuses): the next, the skip link.
    const stray = document.createElement('span');
    stray.id = 'stray';
    stray.setAttribute('tabindex', '');
    document.body.prepend(stray);
    card.tabIndex = 0;
    card.focus();
    lowerTrap.activate();
    card.removeAttribute('tabindex');
    lowerTrap.deactivate();
    expect(document.activeElement).toBe(skip);
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
