/**
 * Focus Trap Utility - MOD-02
 * Traps focus within a modal dialog for accessibility.
 * 
 * @module utils/focusTrap
 */

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
  let inertSiblings = [];

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

  const makeBackgroundInert = () => {
    inertSiblings = [...document.body.children]
      .filter(element => element !== modal)
      .map(element => ({ element, wasInert: element.hasAttribute('inert') }));
    inertSiblings.forEach(({ element }) => element.setAttribute('inert', ''));
  };

  const restoreBackground = () => {
    inertSiblings.forEach(({ element, wasInert }) => {
      if (!wasInert) element.removeAttribute('inert');
    });
    inertSiblings = [];
  };
  
  /**
   * Handle keydown events for focus trapping
   * @param {KeyboardEvent} e 
   */
  function handleKeyDown(e) {
    if (!isActive) return;
    
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
    if (!isActive || modal.contains(e.target)) return;
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

    // Inert background content enforces the aria-modal promise for pointer,
    // keyboard, and assistive-technology users while the dialog is open.
    makeBackgroundInert();
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    focusInitialElement(initialFocus);
  }
  
  /**
   * Deactivate the focus trap and restore previous focus
   */
  function deactivate() {
    if (!isActive) return;
    
    isActive = false;
    window.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('focusin', handleFocusIn, true);
    restoreBackground();

    if (temporaryFocusTarget) {
      if (previousTabindex === null) {
        temporaryFocusTarget.removeAttribute('tabindex');
      } else {
        temporaryFocusTarget.setAttribute('tabindex', previousTabindex);
      }
      temporaryFocusTarget = null;
      previousTabindex = null;
    }

    // Restore focus to previously focused element
    if (previouslyFocused?.isConnected && previouslyFocused.focus) {
      previouslyFocused.focus();
    }
    previouslyFocused = null;
  }
  
  return {
    activate,
    deactivate,
    get isActive() { return isActive; }
  };
}
