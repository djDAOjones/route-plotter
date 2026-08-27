/**
 * ParamTooltip — Carbon Definition Tooltip pattern for parameter labels.
 *
 * Architecture:
 *   - ONE shared tooltip DOM element appended to <body> (avoids sidebar overflow clipping).
 *   - Delegated click listener on document for any element with a `data-tip` attribute.
 *   - Dotted underline on [data-tip] labels hints at clickability (Carbon convention).
 *   - Dismiss on click outside, Escape, scroll, or resize.
 *
 * Usage:
 *   1. Add `data-tip="Description text"` to a <label for="…">, or to a <span>
 *      inside one. The label's `for` names the control the hint describes.
 *   2. Call `initParamTooltips()` once after DOM is ready.
 *
 * Performance:
 *   - Zero per-element listeners. One screen-reader-only node per hint.
 *   - Single RAF-batched positioning calculation on show.
 *
 * Accessibility (A11Y-01, WCAG AAA):
 *   A trigger is a <label>, or a <span> inside one — never an interactive
 *   element. It therefore gets no `role="button"` and no `tabindex`. It used
 *   to get both, which made ~74 hint labels announce as buttons that performed
 *   no action and owe a 44px target they do not meet; on a <label>,
 *   `role="button"` is invalid ARIA outright.
 *
 *   The hint is instead what it always was — a *description of the control* —
 *   and is attached to that control permanently through `aria-describedby`.
 *   Two consequences worth knowing before editing:
 *
 *   - The description node is inserted AFTER the </label>, never inside it.
 *     Text inside a `<label for>` joins the control's accessible *name*, and
 *     the visible label has to keep matching that name for speech input
 *     (WCAG 2.5.3). It is `.sr-only` rather than `aria-hidden`, so the
 *     description is exposed by the plainest, best-supported route available.
 *   - Existing `aria-describedby` tokens are appended to, never replaced.
 *     Slider readouts already own a token there (UI-STANDARDS § Recognition
 *     over recall) and must keep announcing first — the value, then the hint.
 *
 *   Dropping the trigger's tab stop must not make the visible hint mouse-only
 *   (WCAG 2.1.1), so keyboard focus on the described control shows the same
 *   tooltip. Escape dismisses it for as long as focus stays there
 *   (WCAG 1.4.13 Dismissible). Focus is never moved by this module, so
 *   nothing needs restoring on dismiss.
 *
 *   The visible tooltip stays `aria-hidden`: its text is already exposed as
 *   the control's description, and announcing both would say it twice.
 *
 * @module ParamTooltip
 */

/** @type {HTMLElement|null} Shared tooltip element */
let tooltipEl = null;
/** @type {HTMLElement|null} Currently active trigger element */
let activeTrigger = null;
/**
 * Control that the user dismissed the tooltip on with Escape. Cleared when
 * focus leaves it, so the hint returns on the next visit rather than for good.
 * @type {HTMLElement|null}
 */
let escapeDismissedControl = null;

/** @type {WeakMap<HTMLElement, HTMLElement>} described control → its trigger */
const triggerByControl = new WeakMap();
/** @type {WeakMap<HTMLElement, HTMLElement>} trigger → the control it describes */
const controlByTrigger = new WeakMap();
/**
 * Documents whose delegated listeners are already bound. Re-initialising
 * (a rebuilt shell, or one jsdom document across several tests) must not stack
 * a second set of handlers, which would toggle every tooltip twice per click.
 * @type {WeakSet<Document>}
 */
const boundDocuments = new WeakSet();

/**
 * Create the shared tooltip DOM element (called once).
 * @returns {HTMLElement}
 */
function createTooltipElement() {
  const el = document.createElement('div');
  el.className = 'param-tooltip';
  el.setAttribute('role', 'tooltip');
  // Permanently hidden from assistive tech: the same string is already the
  // described control's `aria-describedby` target. See the module header.
  el.setAttribute('aria-hidden', 'true');
  el.id = 'param-tooltip';
  document.body.appendChild(el);
  return el;
}

/**
 * The control a trigger describes: the enclosing label's `for` target.
 * @param {HTMLElement} trigger - Element carrying the data-tip attribute
 * @returns {HTMLElement|null}
 */
function describedControl(trigger) {
  const label = trigger.tagName === 'LABEL' ? trigger : trigger.closest('label');
  const id = label?.getAttribute('for');
  return id ? document.getElementById(id) : null;
}

/**
 * Give `control` a permanent description carrying `trigger`'s hint text.
 * Returns false when the trigger has no resolvable control, so a malformed
 * hint is skipped rather than silently half-wired.
 * @param {HTMLElement} trigger - Element carrying the data-tip attribute
 * @returns {boolean}
 */
function describeControl(trigger) {
  const text = trigger.getAttribute('data-tip');
  const control = describedControl(trigger);
  if (!text || !control) return false;

  // Already wired by an earlier init: re-appending would duplicate the token.
  const existingId = trigger.getAttribute('data-tip-desc');
  if (existingId && document.getElementById(existingId)) {
    triggerByControl.set(control, trigger);
    controlByTrigger.set(trigger, control);
    return true;
  }

  let id = `${control.id}-tip`;
  for (let suffix = 2; document.getElementById(id); suffix += 1) {
    id = `${control.id}-tip-${suffix}`;
  }

  const description = document.createElement('span');
  description.id = id;
  description.className = 'sr-only';
  description.textContent = text;

  // After the </label>, never inside it — inside would join the accessible name.
  const label = trigger.tagName === 'LABEL' ? trigger : trigger.closest('label');
  label.insertAdjacentElement('afterend', description);

  const existing = control.getAttribute('aria-describedby');
  // Append: a slider readout already owns the first token and announces first.
  control.setAttribute('aria-describedby', existing ? `${existing} ${id}` : id);
  trigger.setAttribute('data-tip-desc', id);

  triggerByControl.set(control, trigger);
  controlByTrigger.set(trigger, control);
  return true;
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
  const text = trigger.getAttribute('data-tip');
  if (!text) return;

  if (!tooltipEl) {
    tooltipEl = createTooltipElement();
  }

  tooltipEl.textContent = text;
  tooltipEl.style.display = 'block';
  activeTrigger = trigger;

  // Position after content is set (needs layout for tipRect). The frame can
  // land after a rebuilt shell has detached the shared element, so re-check
  // rather than positioning a node that is no longer there.
  requestAnimationFrame(() => {
    if (tooltipEl?.isConnected && activeTrigger === trigger) positionTooltip(trigger);
  });
}

/**
 * Toggle the tooltip: clicking the active trigger again closes it.
 * @param {HTMLElement} trigger - Element with data-tip attribute
 */
function toggleTooltip(trigger) {
  if (activeTrigger === trigger) {
    hideTooltip();
    return;
  }
  showTooltip(trigger);
}

/**
 * Hide the tooltip.
 */
function hideTooltip() {
  if (!tooltipEl) return;
  tooltipEl.style.display = 'none';
  activeTrigger = null;
}

/**
 * Whether this focus arrival should reveal the hint. `:focus-visible` is what
 * separates tabbing to a control from clicking it, so a mouse user's click
 * does not pop a tooltip they did not ask for. jsdom implements no such
 * pseudo-class; treat an unsupported selector as a keyboard arrival so the
 * behaviour stays testable rather than silently untested.
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isKeyboardFocus(el) {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * Initialize the parameter tooltip system.
 * Call once after DOMContentLoaded.
 *
 * Wires every [data-tip] hint as its control's `aria-describedby` description,
 * then binds the delegated pointer, focus and keyboard listeners.
 */
export function initParamTooltips() {
  // A replaced shell leaves the old shared element detached; rebuild it.
  if (tooltipEl && !tooltipEl.isConnected) {
    tooltipEl = null;
    activeTrigger = null;
    escapeDismissedControl = null;
  }

  document.querySelectorAll('[data-tip]').forEach(describeControl);

  if (boundDocuments.has(document)) return;
  boundDocuments.add(document);

  // Delegated click handler for [data-tip] elements
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-tip]');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      toggleTooltip(trigger);
      return;
    }
    // Click outside — dismiss
    if (activeTrigger && !tooltipEl?.contains(e.target)) {
      hideTooltip();
    }
  });

  // Keyboard arrival on the described control reveals the same hint, so
  // losing the label's tab stop does not make it mouse-only.
  document.addEventListener('focusin', (e) => {
    const trigger = triggerByControl.get(e.target);
    if (!trigger || escapeDismissedControl === e.target) return;
    if (!isKeyboardFocus(e.target)) return;
    showTooltip(trigger);
  });

  document.addEventListener('focusout', (e) => {
    if (escapeDismissedControl === e.target) escapeDismissedControl = null;
    if (activeTrigger && triggerByControl.get(e.target) === activeTrigger) {
      hideTooltip();
    }
  });

  // Escape closes, and keeps it closed while focus stays on that control.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !activeTrigger) return;
    const control = controlByTrigger.get(activeTrigger);
    hideTooltip();
    if (control && control === document.activeElement) {
      escapeDismissedControl = control;
    }
  });

  // Dismiss on scroll or resize (tooltip position would be stale)
  const dismissOnScroll = () => { if (activeTrigger) hideTooltip(); };
  document.addEventListener('scroll', dismissOnScroll, true); // capture phase for nested scrollers
  window.addEventListener('resize', dismissOnScroll);
}
