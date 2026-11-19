/**
 * Tooltip Component
 * Provides hover/focus tooltips with WCAG AAA compliance.
 * 
 * Features:
 * - Shows on hover (mouse) and focus (keyboard)
 * - Respects prefers-reduced-motion
 * - Positions intelligently to avoid viewport edges
 * - Uses aria-describedby for screen reader support
 * - Auto-hides with configurable delay
 * 
 * @module Tooltip
 */

import { TOOLTIPS } from '../config/tooltips.js';

/** @type {HTMLElement|null} Active tooltip element */
let activeTooltip = null;

/** @type {number|null} Timeout ID for delayed hide */
let hideTimeout = null;

/** @type {number} Delay before showing tooltip (ms) */
const SHOW_DELAY = 300;

/** @type {number} Delay before hiding tooltip (ms) */
const HIDE_DELAY = 100;

/**
 * Creates or returns the shared tooltip container element.
 * @returns {HTMLElement}
 */
function getTooltipContainer() {
  let container = document.getElementById('tooltip-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'tooltip-container';
    container.className = 'tooltip';
    container.setAttribute('role', 'tooltip');
    container.setAttribute('aria-hidden', 'true');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Positions the tooltip relative to the target element.
 * Automatically adjusts to stay within viewport.
 * 
 * @param {HTMLElement} tooltip - The tooltip element
 * @param {HTMLElement} target - The target element to position near
 * @param {string} [preferredPosition='top'] - Preferred position: top, bottom, left, right
 */
function positionTooltip(tooltip, target, preferredPosition = 'top') {
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const padding = 8; // Space between tooltip and target
  const viewportPadding = 16; // Minimum distance from viewport edge
  
  let top, left;
  let actualPosition = preferredPosition;
  
  // Calculate positions for each direction
  const positions = {
    top: {
      top: targetRect.top - tooltipRect.height - padding,
      left: targetRect.left + (targetRect.width - tooltipRect.width) / 2
    },
    bottom: {
      top: targetRect.bottom + padding,
      left: targetRect.left + (targetRect.width - tooltipRect.width) / 2
    },
    left: {
      top: targetRect.top + (targetRect.height - tooltipRect.height) / 2,
      left: targetRect.left - tooltipRect.width - padding
    },
    right: {
      top: targetRect.top + (targetRect.height - tooltipRect.height) / 2,
      left: targetRect.right + padding
    }
  };
  
  // Try preferred position first, fall back if it doesn't fit
  const tryPosition = (pos) => {
    const { top: t, left: l } = positions[pos];
    const fits = 
      t >= viewportPadding &&
      t + tooltipRect.height <= window.innerHeight - viewportPadding &&
      l >= viewportPadding &&
      l + tooltipRect.width <= window.innerWidth - viewportPadding;
    return fits ? pos : null;
  };
  
  // Fallback order based on preferred position
  const fallbackOrder = {
    top: ['top', 'bottom', 'right', 'left'],
    bottom: ['bottom', 'top', 'right', 'left'],
    left: ['left', 'right', 'top', 'bottom'],
    right: ['right', 'left', 'top', 'bottom']
  };
  
  for (const pos of fallbackOrder[preferredPosition]) {
    if (tryPosition(pos)) {
      actualPosition = pos;
      break;
    }
  }
  
  top = positions[actualPosition].top;
  left = positions[actualPosition].left;
  
  // Clamp to viewport bounds
  left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));
  top = Math.max(viewportPadding, Math.min(top, window.innerHeight - tooltipRect.height - viewportPadding));
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  tooltip.dataset.position = actualPosition;
}

/**
 * Shows tooltip for a target element.
 * 
 * @param {HTMLElement} target - Element to show tooltip for
 * @param {string} content - Tooltip text content
 * @param {Object} [options] - Configuration options
 * @param {string} [options.position='top'] - Preferred position
 */
function showTooltip(target, content, options = {}) {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  
  const tooltip = getTooltipContainer();
  tooltip.textContent = content;
  tooltip.setAttribute('aria-hidden', 'false');
  tooltip.classList.add('is-visible');
  
  // Link target to tooltip for screen readers
  const tooltipId = 'tooltip-container';
  target.setAttribute('aria-describedby', tooltipId);
  
  // Position after content is set (needs accurate dimensions)
  requestAnimationFrame(() => {
    positionTooltip(tooltip, target, options.position || 'top');
  });
  
  activeTooltip = tooltip;
}

/**
 * Hides the active tooltip.
 * @param {HTMLElement} [target] - Optional target to unlink aria-describedby
 */
function hideTooltip(target) {
  hideTimeout = setTimeout(() => {
    const tooltip = getTooltipContainer();
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden', 'true');
    
    if (target) {
      target.removeAttribute('aria-describedby');
    }
    
    activeTooltip = null;
    hideTimeout = null;
  }, HIDE_DELAY);
}

/**
 * Attaches tooltip behavior to an element.
 * 
 * @param {HTMLElement} element - Element to attach tooltip to
 * @param {string} tooltipKey - Key in TOOLTIPS config, or direct text
 * @param {Object} [options] - Configuration options
 * @param {string} [options.position='top'] - Preferred position
 */
export function attachTooltip(element, tooltipKey, options = {}) {
  const content = TOOLTIPS[tooltipKey] || tooltipKey;
  let showTimeout = null;
  
  const show = () => {
    showTimeout = setTimeout(() => {
      showTooltip(element, content, options);
    }, SHOW_DELAY);
  };
  
  const hide = () => {
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }
    hideTooltip(element);
  };
  
  // Mouse events
  element.addEventListener('mouseenter', show);
  element.addEventListener('mouseleave', hide);
  
  // Keyboard focus events
  element.addEventListener('focus', show);
  element.addEventListener('blur', hide);
  
  // Store cleanup function
  element._tooltipCleanup = () => {
    element.removeEventListener('mouseenter', show);
    element.removeEventListener('mouseleave', hide);
    element.removeEventListener('focus', show);
    element.removeEventListener('blur', hide);
    hide();
  };
}

/**
 * Removes tooltip behavior from an element.
 * @param {HTMLElement} element - Element to detach tooltip from
 */
export function detachTooltip(element) {
  if (element._tooltipCleanup) {
    element._tooltipCleanup();
    delete element._tooltipCleanup;
  }
}

/**
 * Attaches tooltips to all elements with data-tooltip attribute.
 * Call this after DOM is ready.
 */
export function attachAllTooltips() {
  const elements = document.querySelectorAll('[data-tooltip]');
  elements.forEach(el => {
    const key = el.dataset.tooltip;
    const position = el.dataset.tooltipPosition || 'top';
    attachTooltip(el, key, { position });
  });
}

export default {
  attachTooltip,
  detachTooltip,
  attachAllTooltips
};
