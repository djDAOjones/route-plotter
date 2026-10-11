/**
 * Dropdown Component
 * Provides accessible dropdown menus with WCAG AAA compliance.
 * 
 * Features:
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Focus trap within menu
 * - Click outside to close
 * - ARIA attributes for screen readers
 * - Respects prefers-reduced-motion
 * 
 * @module Dropdown
 */

/** @type {HTMLElement|null} Currently open dropdown */
let openDropdown = null;

/**
 * Closes any currently open dropdown.
 */
function closeOpenDropdown() {
  if (openDropdown) {
    const menu = openDropdown.querySelector('.dropdown-menu');
    const trigger = openDropdown.querySelector('.dropdown-trigger') || openDropdown.querySelector('.dropdown-toggle');
    if (menu) {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
    }
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }
    openDropdown = null;
  }
}

/**
 * Opens a dropdown menu.
 * @param {HTMLElement} dropdown - The dropdown container element
 */
function openDropdownMenu(dropdown) {
  closeOpenDropdown();
  
  const menu = dropdown.querySelector('.dropdown-menu');
  const trigger = dropdown.querySelector('.dropdown-trigger') || dropdown.querySelector('.dropdown-toggle');
  
  if (menu && trigger) {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    openDropdown = dropdown;
    
    // Focus the first item. One disabled by aria-disabled is focusable and
    // read with its reason (UI-06 B-18 follow-up), as the arrow keys reach
    // it; only a natively disabled one, which cannot take focus, is skipped.
    const firstItem = menu.querySelector('[role="menuitem"]:not([disabled])');
    if (firstItem) {
      firstItem.focus();
    }
  }
}

/**
 * Toggles a dropdown menu open/closed.
 * @param {HTMLElement} dropdown - The dropdown container element
 */
function toggleDropdown(dropdown) {
  const menu = dropdown.querySelector('.dropdown-menu');
  if (menu && menu.classList.contains('is-open')) {
    closeOpenDropdown();
  } else {
    openDropdownMenu(dropdown);
  }
}

/**
 * Handles keyboard navigation within dropdown.
 * @param {KeyboardEvent} e - The keyboard event
 * @param {HTMLElement} dropdown - The dropdown container
 */
function handleDropdownKeyboard(e, dropdown) {
  const menu = dropdown.querySelector('.dropdown-menu');
  if (!menu) return;
  
  const items = [...menu.querySelectorAll('[role="menuitem"]:not([disabled])')];
  const currentIndex = items.indexOf(document.activeElement);
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (currentIndex < items.length - 1) {
        items[currentIndex + 1].focus();
      } else {
        items[0].focus(); // Wrap to top
      }
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      if (currentIndex > 0) {
        items[currentIndex - 1].focus();
      } else {
        items[items.length - 1].focus(); // Wrap to bottom
      }
      break;
      
    case 'Home':
      e.preventDefault();
      items[0]?.focus();
      break;
      
    case 'End':
      e.preventDefault();
      items[items.length - 1]?.focus();
      break;
      
    case 'Escape':
      e.preventDefault();
      closeOpenDropdown();
      (dropdown.querySelector('.dropdown-trigger') || dropdown.querySelector('.dropdown-toggle'))?.focus();
      break;
      
    case 'Tab':
      // Allow Tab to close and move focus naturally
      closeOpenDropdown();
      break;
  }
}

/**
 * Initializes a dropdown element with event handlers.
 * 
 * @param {HTMLElement} dropdown - Element with class 'dropdown'
 */
export function initDropdown(dropdown) {
  // Support both .dropdown-trigger and .dropdown-toggle class names
  const trigger = dropdown.querySelector('.dropdown-trigger') || dropdown.querySelector('.dropdown-toggle');
  const menu = dropdown.querySelector('.dropdown-menu');
  
  if (!trigger || !menu) {
    console.warn('Dropdown missing trigger or menu:', dropdown);
    return;
  }
  
  // Set up ARIA attributes. The menu's role="menu" and the trigger's
  // aria-haspopup="menu" are the markup's, written once there (UI-06 J-20).
  const menuId = menu.id || `dropdown-menu-${Date.now()}`;
  menu.id = menuId;
  menu.setAttribute('aria-hidden', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', menuId);
  
  // Trigger click toggles menu
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(dropdown);
  });
  
  // Trigger keyboard: Enter/Space opens, ArrowDown opens and focuses first item
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDropdownMenu(dropdown);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      openDropdownMenu(dropdown);
    }
  });
  
  // Menu keyboard navigation
  menu.addEventListener('keydown', (e) => {
    handleDropdownKeyboard(e, dropdown);
  });

  // An aria-disabled item is focusable, so a click reaches it: from the
  // pointer, from Enter or Space (the button's own activation) or from a
  // script. Refused here, before the item's own listeners, and the menu stays
  // open on it (UI-06 B-18 follow-up).
  menu.addEventListener('click', (e) => {
    if (!e.target.closest?.('[role="menuitem"][aria-disabled="true"]')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  
  // Menu item click closes dropdown
  menu.querySelectorAll('[role="menuitem"]').forEach(item => {
    item.addEventListener('click', () => {
      closeOpenDropdown();
      trigger.focus();
    });
  });
}

/**
 * Initializes all dropdowns on the page.
 */
export function initAllDropdowns() {
  document.querySelectorAll('.dropdown').forEach(initDropdown);
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (openDropdown && !openDropdown.contains(e.target)) {
    closeOpenDropdown();
  }
});

// Close dropdown on Escape anywhere
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openDropdown) {
    closeOpenDropdown();
  }
});

export default {
  initDropdown,
  initAllDropdowns,
  closeOpenDropdown
};
