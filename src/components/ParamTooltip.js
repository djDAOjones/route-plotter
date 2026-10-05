/**
 * ParamTooltip — Carbon Definition Tooltip pattern for parameter labels.
 *
 * Architecture:
 *   - ONE shared tooltip DOM element appended to <body> (avoids sidebar overflow clipping).
 *   - Delegated click, pointer, focus and key listeners on document for any
 *     element with a `data-tip` attribute.
 *   - Dotted underline on [data-tip] labels hints at the help behind them (Carbon convention).
 *   - Dismiss on click outside, Escape, scroll, or resize.
 *
 * Usage:
 *   1. Add `data-tip="Description text"` to a <label>, or to a <span> inside
 *      one (or inside a fieldset's <legend>). The label names the control the
 *      hint describes: its `for` target, or the control it wraps; a legend
 *      names its fieldset.
 *   2. Call `initParamTooltips()` once after DOM is ready. Hints added to the
 *      page later (the scene outline's forms, the crowd card's busyness rows,
 *      a node's path weights) are wired as they arrive.
 *
 * Performance:
 *   - Zero per-element listeners. One screen-reader-only node per hint.
 *   - Single RAF-batched positioning calculation on show.
 *   - One MutationObserver on the document's child lists: the app rewrites
 *     text in playback at most once a second, so it wakes rarely.
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
 *   A mouse resting on a trigger opens its hint after
 *   `INTERACTION.HINT_HOVER_OPEN_DELAY_MS` (UI-03). That hint takes the
 *   pointer, so the pointer can move from the trigger onto the hint and back
 *   without closing it (WCAG 1.4.13 Hoverable); it closes once the pointer has
 *   left both, after a short grace for crossing the gap between them, and
 *   Escape closes it with the pointer still in place (Dismissible). It stays
 *   until then (Persistent). A click on it keeps it open as a click-opened
 *   hint would be. Touch and pen never hover-open: a tap is still a click.
 *
 *   The visible tooltip stays `aria-hidden`: its text is already exposed as
 *   the control's description, and announcing both would say it twice.
 *
 * @module ParamTooltip
 */

import { INTERACTION } from '../config/constants.js';

/** @type {HTMLElement|null} Shared tooltip element */
let tooltipEl = null;
/** @type {HTMLElement|null} Currently active trigger element */
let activeTrigger = null;
/**
 * How the showing hint was opened. A hover-opened hint closes when the
 * pointer leaves; one opened by a click or by focus does not.
 * @type {'click'|'focus'|'hover'|null}
 */
let openedBy = null;
/**
 * Control that the user dismissed the tooltip on with Escape. Cleared when
 * focus leaves it, so the hint returns on the next visit rather than for good.
 * @type {HTMLElement|null}
 */
let escapeDismissedControl = null;

/** @type {HTMLElement|null} The trigger a mouse pointer is on, if any */
let hoverTrigger = null;
/** Whether a mouse pointer is on the visible hint itself. */
let pointerOnHint = false;
/** @type {ReturnType<typeof setTimeout>|null} A resting pointer's pending open */
let openTimer = null;
/** @type {ReturnType<typeof setTimeout>|null} A departed pointer's pending close */
let closeTimer = null;
/** Numbers the descriptions of controls that have no id of their own. */
let anonymousSerial = 0;

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
 * The element that names a trigger's control: its <label>, or the <legend>
 * of a fieldset (a swatch picker's group).
 * @param {HTMLElement} trigger - Element carrying the data-tip attribute
 * @returns {HTMLElement|null}
 */
function labelOf(trigger) {
  return trigger.closest('label, legend');
}

/**
 * The control a trigger describes: the enclosing label's `for` target, or
 * the control a label wraps (fields built at run time carry no `for`), or a
 * legend's fieldset.
 * @param {HTMLElement} trigger - Element carrying the data-tip attribute
 * @returns {HTMLElement|null}
 */
function describedControl(trigger) {
  const label = labelOf(trigger);
  if (!label) return null;
  if (label.tagName === 'LEGEND') {
    return label.parentElement?.tagName === 'FIELDSET' ? label.parentElement : null;
  }
  const id = label.getAttribute('for');
  if (id) return document.getElementById(id);
  return label.control ?? null;
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

  // Already wired, by an earlier init or as it arrived (describeAddedHints):
  // re-appending would duplicate the token.
  const existingId = trigger.getAttribute('data-tip-desc');
  if (existingId && controlByTrigger.get(trigger) === control) return true;
  if (existingId && document.getElementById(existingId)) {
    triggerByControl.set(control, trigger);
    controlByTrigger.set(trigger, control);
    return true;
  }

  let id;
  if (control.id) {
    id = `${control.id}-tip`;
    for (let suffix = 2; document.getElementById(id); suffix += 1) {
      id = `${control.id}-tip-${suffix}`;
    }
  } else {
    // A control built at run time often has no id. A serial under a prefix
    // nothing else uses is unique without asking the page, which matters: a
    // rebuild removes these nodes, and an id the app asked the page for must
    // still be there (tests/elementIds.test.js).
    anonymousSerial += 1;
    id = `param-hint-${anonymousSerial}`;
  }

  const description = document.createElement('span');
  description.id = id;
  description.className = 'sr-only';
  description.textContent = text;

  // After the </label>, never inside it — inside would join the accessible name.
  labelOf(trigger).insertAdjacentElement('afterend', description);

  const existing = control.getAttribute('aria-describedby');
  // Append: a slider readout already owns the first token and announces first.
  control.setAttribute('aria-describedby', existing ? `${existing} ${id}` : id);
  trigger.setAttribute('data-tip-desc', id);

  triggerByControl.set(control, trigger);
  controlByTrigger.set(trigger, control);
  return true;
}

/**
 * Wire hints added after `initParamTooltips` ran, as they arrive. A trigger
 * that already carries a description (a moved node) keeps it.
 * @param {MutationRecord[]} records
 */
function describeAddedHints(records) {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      const triggers = node.matches('[data-tip]') ? [node] : [];
      triggers.push(...node.querySelectorAll('[data-tip]'));
      for (const trigger of triggers) {
        if (!trigger.hasAttribute('data-tip-desc')) describeControl(trigger);
      }
    }
  }
}

/**
 * The described control that `el` is, or belongs to: a swatch radio belongs
 * to its picker's fieldset.
 * @param {EventTarget|null} el
 * @returns {HTMLElement|null}
 */
function describedAt(el) {
  if (!el || el.nodeType !== 1) return null;
  if (triggerByControl.has(el)) return el;
  const group = el.closest('fieldset');
  return group && triggerByControl.has(group) ? group : null;
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
 * Record how the showing hint was opened. Only a hover-opened hint takes the
 * pointer (main.css): the others stay click-through, so a click on whatever
 * they cover still reaches it and dismisses them, as it always has.
 * @param {'click'|'focus'|'hover'|null} how
 */
function setOpenedBy(how) {
  openedBy = how;
  tooltipEl?.classList.toggle('is-hover-open', how === 'hover');
}

/** Forget a resting pointer's pending open. */
function cancelHoverOpen() {
  clearTimeout(openTimer);
  openTimer = null;
}

/** Forget a departed pointer's pending close. */
function cancelHoverClose() {
  clearTimeout(closeTimer);
  closeTimer = null;
}

/**
 * Show the tooltip for a given trigger element.
 * @param {HTMLElement} trigger - Element with data-tip attribute
 * @param {'click'|'focus'|'hover'} how - What opened it
 */
function showTooltip(trigger, how) {
  const text = trigger.getAttribute('data-tip');
  if (!text) return;

  // A hint shown by any route supersedes a pending hover open: left to fire,
  // it would turn a clicked hint into a hover-opened one that leaving closes.
  cancelHoverOpen();
  cancelHoverClose();

  if (!tooltipEl) {
    tooltipEl = createTooltipElement();
  }

  tooltipEl.textContent = text;
  tooltipEl.style.display = 'block';
  activeTrigger = trigger;
  setOpenedBy(how);

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
  showTooltip(trigger, 'click');
}

/**
 * Close the showing hint, leaving a pointer's pending open alone: the pointer
 * may already rest on the next trigger.
 */
function closeTooltip() {
  cancelHoverClose();
  if (!tooltipEl) return;
  tooltipEl.style.display = 'none';
  activeTrigger = null;
  setOpenedBy(null);
}

/**
 * Hide the tooltip, and drop any pending hover open with it.
 */
function hideTooltip() {
  cancelHoverOpen();
  closeTooltip();
}

/**
 * Follow a mouse pointer across triggers and the open hint. Resting on a
 * trigger opens its hint after the delay; leaving first opens nothing. A
 * hover-opened hint stays while the pointer is on its trigger or on the hint,
 * and closes after a short grace once it is on neither, so the pointer can
 * cross the gap between them (WCAG 1.4.13 Hoverable). Only a change of trigger
 * arms a new open, so a hint dismissed with Escape stays closed while the
 * pointer rests where it was.
 * @param {EventTarget|null} target - What the pointer is now over (null: off the page)
 */
function followPointer(target) {
  const element = target?.nodeType === 1 ? target : null;
  const trigger = element?.closest('[data-tip]') ?? null;
  pointerOnHint = Boolean(element && tooltipEl?.contains(element));

  if (trigger !== hoverTrigger) {
    cancelHoverOpen();
    hoverTrigger = trigger;
    if (trigger && trigger !== activeTrigger && trigger.getAttribute('data-tip')) {
      openTimer = setTimeout(() => {
        openTimer = null;
        // A rebuild (the scene outline redraws its forms) can replace the
        // trigger while the pointer rests on it.
        if (trigger.isConnected) showTooltip(trigger, 'hover');
      }, INTERACTION.HINT_HOVER_OPEN_DELAY_MS);
    }
  }

  if (openedBy !== 'hover') return;
  if (hoverTrigger === activeTrigger || pointerOnHint) {
    cancelHoverClose();
  } else if (closeTimer === null) {
    closeTimer = setTimeout(closeTooltip, INTERACTION.HINT_HOVER_CLOSE_DELAY_MS);
  }
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
 * then binds the delegated pointer, focus and keyboard listeners, and watches
 * for hints added later.
 */
export function initParamTooltips() {
  // A replaced shell leaves the old shared element detached; rebuild it.
  if (tooltipEl && !tooltipEl.isConnected) {
    cancelHoverOpen();
    cancelHoverClose();
    tooltipEl = null;
    activeTrigger = null;
    openedBy = null;
    escapeDismissedControl = null;
    hoverTrigger = null;
    pointerOnHint = false;
  }

  document.querySelectorAll('[data-tip]').forEach(describeControl);

  if (boundDocuments.has(document)) return;
  boundDocuments.add(document);

  // Observing the document itself, not <body>, outlives a replaced shell.
  new MutationObserver(describeAddedHints).observe(document, { childList: true, subtree: true });

  // Delegated click handler for [data-tip] elements
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-tip]');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      // A click on a hint that hovering opened keeps it, as a click opens one:
      // closing it would answer a click asking for the hint by hiding it.
      if (trigger === activeTrigger && openedBy === 'hover') {
        cancelHoverClose();
        setOpenedBy('click');
        return;
      }
      toggleTooltip(trigger);
      return;
    }
    // Click outside — dismiss
    if (activeTrigger && !tooltipEl?.contains(e.target)) {
      hideTooltip();
    }
  });

  // Hover is a mouse's alone. A touch or pen tap arrives as a click, which
  // the handler above already answers; arming a hover open as well would
  // change what a tap does.
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'mouse') followPointer(e.target);
  });
  // Off the page entirely: no pointerover follows to say where it went.
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'mouse' && !e.relatedTarget) followPointer(null);
  });

  // Keyboard arrival on the described control reveals the same hint, so
  // losing the label's tab stop does not make it mouse-only.
  document.addEventListener('focusin', (e) => {
    const control = describedAt(e.target);
    if (!control || escapeDismissedControl === control) return;
    if (!isKeyboardFocus(e.target)) return;
    showTooltip(triggerByControl.get(control), 'focus');
  });

  document.addEventListener('focusout', (e) => {
    const control = describedAt(e.target);
    // Focus moving within a described group (between swatches) stays put.
    if (!control || control.contains(e.relatedTarget)) return;
    if (escapeDismissedControl === control) escapeDismissedControl = null;
    // A hover-opened hint answers to the pointer, not to focus.
    if (activeTrigger && openedBy !== 'hover' && triggerByControl.get(control) === activeTrigger) {
      closeTooltip();
    }
  });

  // Escape closes, and keeps it closed while focus stays on that control.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !activeTrigger) return;
    const control = controlByTrigger.get(activeTrigger);
    hideTooltip();
    if (control?.contains(document.activeElement)) {
      escapeDismissedControl = control;
    }
  });

  // Dismiss on scroll or resize (tooltip position would be stale). A pending
  // hover open goes too: what is under the pointer has moved.
  const dismissOnScroll = () => {
    cancelHoverOpen();
    if (activeTrigger) hideTooltip();
  };
  document.addEventListener('scroll', dismissOnScroll, true); // capture phase for nested scrollers
  window.addEventListener('resize', dismissOnScroll);
}
