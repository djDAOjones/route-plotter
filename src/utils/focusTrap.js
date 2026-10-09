/**
 * Focus Trap Utility - MOD-02
 * Traps focus within a modal dialog for accessibility.
 *
 * Open dialogs stack (UI-06, Codex r1). A dialog can open over another — a
 * codec probe that answers while Discard's dialog asks — and every active
 * trap listens on the window and the document, so only the top one acts: it
 * takes focus, Tab and Escape, and when it closes the one below resumes, its
 * own focus return intact. Two traps that each pulled focus into their own
 * dialog handed it back and forth until the stack overflowed. `inert`
 * follows the stack: everything but the top dialog is inert while any is
 * open, except the live region announcements are written to, and once the
 * last closes every element is as it was before the first opened.
 *
 * Focus goes back along a chain (UI-06, Codex r2). A dialog closed beneath
 * another hands its return target to the one directly over it, after that
 * one's own, so a dialog whose own target was inside the one closed beneath
 * it gives focus back where that one would have: in the end, the control
 * that opened the first. A target is used only if focus can land there: in
 * the page, not disabled (by its own attribute or its fieldset's), hidden or
 * inert, and not inside a closed dialog; and only if focus is then on it
 * (Codex r3). Otherwise the next in the chain is tried, then the start of the
 * dialog beneath, if one is open, else the page's first control that takes
 * focus: in the app, the skip link.
 * 
 * @module utils/focusTrap
 */

/** The active traps, the one opened last on top. */
const openTraps = [];

/** Every dialog a trap was made for: a control in one whose trap is closed cannot take focus back. */
const trappedModals = new WeakSet();

/** What can take focus in a dialog, and in the page when nothing else can. */
const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  'summary',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

/**
 * Each element's `inert` as it was before the first open trap changed it, so
 * the last to close restores exactly that.
 * @type {Map<Element, boolean>}
 */
const inertBefore = new Map();

/**
 * The editor's live region (DEF-45): never inert, so what is announced while
 * a dialog is open is still heard.
 */
const NEVER_INERT = '#announcer';

/** The trap on top: the last opened whose dialog is still in the page. */
function topTrap() {
  for (let index = openTraps.length - 1; index >= 0; index -= 1) {
    if (openTraps[index].modal.isConnected) return openTraps[index];
  }
  return null;
}

/**
 * Whether focus given back to `target` lands there, as a browser decides: it
 * is in the page and can be focused, is not disabled (`:disabled`, so a
 * control in a disabled fieldset is too: Codex r3), hidden (`hidden`, or
 * `display: none` on it or a container, or `visibility: hidden`) or inert,
 * and is not inside a dialog whose trap is closed (Codex r2). jsdom focuses
 * any of these, so the trap does not ask it.
 * @param {Element|null} target
 * @returns {boolean}
 */
function canTakeFocus(target) {
  if (!target?.isConnected || typeof target.focus !== 'function' || target.matches(':disabled')) return false;
  if (target.closest('[inert]') || window.getComputedStyle(target).visibility === 'hidden') return false;
  for (let node = target; node && node !== document.documentElement; node = node.parentElement) {
    if (node.hidden || window.getComputedStyle(node).display === 'none') return false;
    if (trappedModals.has(node) && !openTraps.some(open => open.modal === node)) return false;
  }
  return true;
}

/**
 * Give focus to `target` if it can take it, and say whether it did: a target
 * that passes every check can still refuse focus (a tabindex taken away), and
 * the next must then be tried rather than focus left in the closed dialog
 * (Codex r3).
 * @param {Element|null} target
 * @returns {boolean}
 */
function focusLands(target) {
  if (!canTakeFocus(target)) return false;
  target.focus();
  return document.activeElement === target;
}

/**
 * Make every child of the body inert but the top dialog and the live region;
 * with no dialog open, put back what each was before the first opened.
 */
function syncInert() {
  const top = topTrap();
  if (!top) {
    for (const [element, wasInert] of inertBefore) {
      if (element.hasAttribute('inert') !== wasInert) element.toggleAttribute('inert', wasInert);
    }
    inertBefore.clear();
    return;
  }
  for (const element of document.body.children) {
    if (element.matches(NEVER_INERT)) continue;
    if (!inertBefore.has(element)) inertBefore.set(element, element.hasAttribute('inert'));
    const inert = element !== top.modal;
    if (element.hasAttribute('inert') !== inert) element.toggleAttribute('inert', inert);
  }
}

/**
 * Create a focus trap for a modal element.
 * @param {HTMLElement} modal - The modal container element
 * @returns {Object} Focus trap controller with activate/deactivate methods
 */
export function createFocusTrap(modal) {
  trappedModals.add(modal);
  let isActive = false;
  let temporaryFocusTarget = null;
  let previousTabindex = null;

  const getFocusableElements = () => [...modal.querySelectorAll(FOCUSABLE_SELECTORS)]
    .filter(element => {
      if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

  const focusInitialElement = (preferred = null) => {
    if (preferred && modal.contains(preferred) && !preferred.disabled) {
      preferred.focus();
      return;
    }

    const titleElement = modal.querySelector('[id^="modal-title"], [id^="splash-title"], h2, h3');
    if (titleElement) {
      if (temporaryFocusTarget !== titleElement) {
        temporaryFocusTarget = titleElement;
        previousTabindex = titleElement.getAttribute('tabindex');
      }
      titleElement.setAttribute('tabindex', '-1');
      titleElement.focus();
      return;
    }

    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
      return;
    }

    if (temporaryFocusTarget !== modal) {
      temporaryFocusTarget = modal;
      previousTabindex = modal.getAttribute('tabindex');
    }
    modal.setAttribute('tabindex', '-1');
    modal.focus();
  };

  /**
   * This trap's place in the stack. `returnTargets` is where focus goes back
   * to, in order: its own opener first, then what it inherits from dialogs
   * closed beneath it.
   */
  const trap = { modal, focusInitialElement: () => focusInitialElement(), returnTargets: [] };
  const isOnTop = () => topTrap() === trap;

  /**
   * Handle keydown events for focus trapping
   * @param {KeyboardEvent} e 
   */
  function handleKeyDown(e) {
    // A dialog beneath another leaves its keys to the one on top.
    if (!isActive || !isOnTop()) return;
    
    // ESC closes modal (unless it's a destructive confirm - handled by caller)
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      deactivate();
      modal.dispatchEvent(new CustomEvent('focustrap:escape'));
      return;
    }
    
    // Tab trapping
    if (e.key === 'Tab') {
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      // Dialog headings may receive initial programmatic focus with
      // tabindex="-1". From there, Tab and Shift+Tab must enter the modal's
      // forward or reverse sequence rather than briefly escaping it.
      if (!modal.contains(activeElement) || !focusableElements.includes(activeElement)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        (e.shiftKey ? lastElement : firstElement).focus();
        return;
      }
      
      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (activeElement === firstElement) {
          e.preventDefault();
          e.stopImmediatePropagation();
          lastElement.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (activeElement === lastElement) {
          e.preventDefault();
          e.stopImmediatePropagation();
          firstElement.focus();
        }
      }
    }
  }

  function handleFocusIn(e) {
    // Only the top dialog takes focus back: two that each did would hand it to
    // each other until the stack overflowed.
    if (!isActive || !isOnTop() || modal.contains(e.target)) return;
    focusInitialElement();
  }
  
  /**
   * Activate the focus trap
   */
  function activate(initialFocus = null, returnFocus = null) {
    if (isActive) return;
    
    // A menu item that launches a dialog may be hidden as part of the same
    // click. Callers can name the stable control that should receive focus
    // when the dialog closes instead of restoring to that hidden item.
    trap.returnTargets = [returnFocus || document.activeElement];
    isActive = true;
    openTraps.push(trap);

    // Inert background content enforces the aria-modal promise for pointer,
    // keyboard, and assistive-technology users while the dialog is open; a
    // dialog this one opens over is background now too.
    syncInert();
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    focusInitialElement(initialFocus);
  }
  
  /**
   * Deactivate the focus trap and restore previous focus
   */
  function deactivate() {
    if (!isActive) return;
    
    // Closed beneath another dialog, this one leaves the top one as it is:
    // its focus, and what it makes inert. The dialog directly over it takes
    // its return targets after its own (Codex r2).
    const wasOnTop = isOnTop();
    isActive = false;
    const place = openTraps.indexOf(trap);
    openTraps.splice(place, 1);
    openTraps[place]?.returnTargets.push(...trap.returnTargets);
    window.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('focusin', handleFocusIn, true);
    syncInert();

    // Give focus back to the first target in the chain that takes it, trying
    // each in turn (Codex r3); the dialog beneath, if any, resumes, and focus
    // that did not come back into it goes to its start. With none open, the
    // page's first control that takes it: the skip link (Codex r3, 2-1).
    if (wasOnTop) {
      const target = trap.returnTargets.find(each => (each === document.body ? canTakeFocus(each) : focusLands(each)));
      if (target === document.body && !canTakeFocus(document.activeElement)) {
        // Nothing had focus when it opened, and nothing has now: what still
        // holds it in the closed dialog lets go, as a browser's focus fix-up
        // would once the dialog hides.
        document.activeElement?.blur?.();
      }
      const below = topTrap();
      if (below) {
        if (!below.modal.contains(document.activeElement)) below.focusInitialElement();
      } else if (!target) {
        [...document.body.querySelectorAll(FOCUSABLE_SELECTORS)].find(focusLands);
      }
    }
    trap.returnTargets = [];

    // The title focused on opening gets its tabindex back once focus has
    // left it, not before: an element that can no longer take focus cannot
    // be blurred.
    if (temporaryFocusTarget) {
      if (previousTabindex === null) {
        temporaryFocusTarget.removeAttribute('tabindex');
      } else {
        temporaryFocusTarget.setAttribute('tabindex', previousTabindex);
      }
      temporaryFocusTarget = null;
      previousTabindex = null;
    }
  }
  
  return {
    activate,
    deactivate,
    get isActive() { return isActive; }
  };
}
