/**
 * ParamTooltip — Carbon Definition Tooltip pattern for parameter labels.
 *
 * Architecture:
 *   - ONE shared tooltip DOM element appended to <body> (avoids sidebar overflow clipping).
 *   - Delegated click listener on document for any element with a `data-tip` attribute.
 *   - Dotted underline on [data-tip] labels hints at clickability (Carbon convention).
 *   - Keyboard accessible: Enter/Space opens, Escape closes.
 *   - Dismiss on click outside, Escape, scroll, or resize.
 *
 * Usage:
 *   1. Add `data-tip="Description text"` to any <span> inside a <label>.
 *   2. Call `initParamTooltips()` once after DOM is ready.
 *
 * Performance:
 *   - Zero per-element listeners or DOM nodes.
 *   - Single RAF-batched positioning calculation on show.
 *
 * Accessibility (WCAG AAA):
 *   - role="tooltip", aria-hidden toggled.
 *   - 7:1+ contrast ratio (white on #161616).
 *   - Focus returned to trigger on dismiss.
 *   - Labels get role="button" and tabindex="0" automatically.
 *
 * @module ParamTooltip
 */

/** @type {HTMLElement|null} Shared tooltip element */
let tooltipEl = null;
/** @type {HTMLElement|null} Currently active trigger element */
let activeTrigger = null;

/**
 * Create the shared tooltip DOM element (called once).
 * @returns {HTMLElement}
 */
function createTooltipElement() {
  const el = document.createElement('div');
  el.className = 'param-tooltip';
  el.setAttribute('role', 'tooltip');
  el.setAttribute('aria-hidden', 'true');
  el.id = 'param-tooltip';
  document.body.appendChild(el);
  return el;
}

/**
 * Position the tooltip below (or above if near bottom) the trigger element.
 * Uses getBoundingClientRect for viewport-relative placement.
 * @param {HTMLElement} trigger - The [data-tip] element that was clicked
 */
function positionTooltip(trigger) {
  const rect = trigger.getBoundingClientRect();
  const tipRect = tooltipEl.getBoundingClientRect();
  const gap = 6; // px between trigger and tooltip
  const margin = 12; // px from viewport edge

  // Default: below the trigger
  let top = rect.bottom + gap;
  let left = rect.left;

  // Flip above if not enough room below
  if (top + tipRect.height > window.innerHeight - margin) {
    top = rect.top - tipRect.height - gap;
  }

  // Clamp horizontal to viewport
  if (left + tipRect.width > window.innerWidth - margin) {
    left = window.innerWidth - tipRect.width - margin;
  }
  if (left < margin) {
    left = margin;
  }

  tooltipEl.style.top = `${top + window.scrollY}px`;
  tooltipEl.style.left = `${left + window.scrollX}px`;
}

/**
 * Show the tooltip for a given trigger element.
 * @param {HTMLElement} trigger - Element with data-tip attribute
 */
function showTooltip(trigger) {
  if (activeTrigger === trigger) {
    // Toggle off if clicking same trigger
    hideTooltip();
    return;
  }

  const text = trigger.getAttribute('data-tip');
  if (!text) return;

  if (!tooltipEl) {
    tooltipEl = createTooltipElement();
  }

  tooltipEl.textContent = text;
  tooltipEl.style.display = 'block';
  tooltipEl.setAttribute('aria-hidden', 'false');
  activeTrigger = trigger;
  trigger.setAttribute('aria-describedby', 'param-tooltip');

  // Position after content is set (needs layout for tipRect)
  requestAnimationFrame(() => positionTooltip(trigger));
}

/**
 * Hide the tooltip and clean up ARIA state.
 */
function hideTooltip() {
  if (!tooltipEl) return;
  tooltipEl.style.display = 'none';
  tooltipEl.setAttribute('aria-hidden', 'true');
  if (activeTrigger) {
    activeTrigger.removeAttribute('aria-describedby');
    activeTrigger = null;
  }
}

/**
 * Initialize the parameter tooltip system.
 * Call once after DOMContentLoaded.
 *
 * Enhances all [data-tip] elements with:
 *   - role="button" and tabindex="0" for keyboard access
 *   - Delegated click and keydown listeners
 *   - Dismiss on outside click, Escape, scroll, resize
 */
export function initParamTooltips() {
  // Enhance all [data-tip] elements for keyboard access
  document.querySelectorAll('[data-tip]').forEach(el => {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.getAttribute('role')) el.setAttribute('role', 'button');
  });

  // Delegated click handler for [data-tip] elements
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-tip]');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      showTooltip(trigger);
      return;
    }
    // Click outside — dismiss
    if (activeTrigger && !tooltipEl?.contains(e.target)) {
      hideTooltip();
    }
  });

  // Keyboard: Enter/Space to open, Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeTrigger) {
      const returnFocus = activeTrigger;
      hideTooltip();
      returnFocus.focus(); // Return focus to trigger (WCAG)
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.hasAttribute('data-tip')) {
      e.preventDefault();
      showTooltip(e.target);
    }
  });

  // Dismiss on scroll or resize (tooltip position would be stale)
  const dismissOnScroll = () => { if (activeTrigger) hideTooltip(); };
  document.addEventListener('scroll', dismissOnScroll, true); // capture phase for nested scrollers
  window.addEventListener('resize', dismissOnScroll);
}
