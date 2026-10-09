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
 * @module utils/focusTrap
 */

/** The active traps, the one opened last on top. */
const openTraps = [];

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
  const FOCUSABLE_SELECTORS = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    'summary',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');
  
  let previouslyFocused = null;
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

  /** This trap's place in the stack. */
  const trap = { modal, focusInitialElement: () => focusInitialElement() };
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
    previouslyFocused = returnFocus || document.activeElement;
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
    // its focus, and what it makes inert.
    const wasOnTop = isOnTop();
    isActive = false;
    openTraps.splice(openTraps.indexOf(trap), 1);
    window.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('focusin', handleFocusIn, true);
    syncInert();

    if (temporaryFocusTarget) {
      if (previousTabindex === null) {
        temporaryFocusTarget.removeAttribute('tabindex');
      } else {
        temporaryFocusTarget.setAttribute('tabindex', previousTabindex);
      }
      temporaryFocusTarget = null;
      previousTabindex = null;
    }

    // Restore focus to previously focused element; the dialog beneath, if
    // any, resumes, and focus that did not come back into it goes to its start.
    if (wasOnTop) {
      if (previouslyFocused?.isConnected && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
      const below = topTrap();
      if (below && !below.modal.contains(document.activeElement)) below.focusInitialElement();
    }
    previouslyFocused = null;
  }
  
  return {
    activate,
    deactivate,
    get isActive() { return isActive; }
  };
}
