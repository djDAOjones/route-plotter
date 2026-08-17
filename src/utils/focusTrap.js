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
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');
  
  let previouslyFocused = null;
  let isActive = false;
  
  /**
   * Handle keydown events for focus trapping
   * @param {KeyboardEvent} e 
   */
  function handleKeyDown(e) {
    if (!isActive) return;
    
    // ESC closes modal (unless it's a destructive confirm - handled by caller)
    if (e.key === 'Escape') {
      e.preventDefault();
      deactivate();
      modal.dispatchEvent(new CustomEvent('focustrap:escape'));
      return;
    }
    
    // Tab trapping
    if (e.key === 'Tab') {
      const focusableElements = modal.querySelectorAll(FOCUSABLE_SELECTORS);
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }
  
  /**
   * Activate the focus trap
   */
  function activate() {
    if (isActive) return;
    
    // Store currently focused element
    previouslyFocused = document.activeElement;
    isActive = true;
    
    // Add event listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Focus first focusable element or the modal title
    const titleElement = modal.querySelector('[id^="modal-title"], [id^="splash-title"], h2, h3');
    const focusableElements = modal.querySelectorAll(FOCUSABLE_SELECTORS);
    
    if (titleElement) {
      // Make title focusable temporarily for screen readers
      titleElement.setAttribute('tabindex', '-1');
      titleElement.focus();
    } else if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }
  
  /**
   * Deactivate the focus trap and restore previous focus
   */
  function deactivate() {
    if (!isActive) return;
    
    isActive = false;
    document.removeEventListener('keydown', handleKeyDown);
    
    // Restore focus to previously focused element
    if (previouslyFocused && previouslyFocused.focus) {
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
