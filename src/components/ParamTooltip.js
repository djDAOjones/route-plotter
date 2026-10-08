/**
 * ParamTooltip — Carbon Toggletip pattern for parameter labels.
 *
 * Architecture:
 *   - ONE shared tooltip DOM element appended to <body> (avoids sidebar overflow clipping).
 *   - Each hint gets a "?" button of its own beside its label's text (UI-04):
 *     the trigger. Delegated click, pointer, focus and key listeners on the
 *     document serve every trigger.
 *   - Dismiss on click outside, Escape, scroll, or resize.
 *
 * Usage:
 *   1. Add `data-tip="Description text"` to a <label>, or to a <span> inside
 *      one (or inside a fieldset's <legend>). The label names the control the
 *      hint describes: its `for` target, or the control it wraps; a legend
 *      names its fieldset.
 *   2. Call `initParamTooltips()` once after DOM is ready. Hints added to the
 *      page later (the scene outline's forms, the crowd card's busyness rows,
 *      a node's path weights) are wired as they arrive, and a hint taken off
 *      the page takes its trigger, and its popup if it shows, with it.
 *
 * Performance:
 *   - Zero per-element listeners. One screen-reader-only node and one button
 *     per hint.
 *   - Single RAF-batched positioning calculation on show.
 *   - One MutationObserver on the document: its child lists, which the app
 *     rewrites in playback at most once a second, and its `hidden` and
 *     `style` attributes, which wake it more often (a playing transport
 *     restyles its buttons) but cost one WeakSet lookup each. It observes the
 *     document alone: an observer holds what it observes, and one holding
 *     each label would keep every replaced shell alive.
 *
 * Accessibility (A11Y-01, UI-04, WCAG AAA):
 *   The label text is never a trigger. It used to be one, and a click on it
 *   opened the hint and cancelled the click, so a checkbox's label did not
 *   toggle it and no label focused its control (DEF-14). The text now stays
 *   plain label text, with no role, tab stop or listener, and a click on it
 *   does what a click on a label does.
 *
 *   The trigger is a real `<button type="button">` placed beside the label,
 *   never inside it: a button inside a `<label>` is invalid HTML, would join
 *   the control's accessible name, and would take the label's control when
 *   the label has no `for`. CSS anchor positioning (main.css) draws it just
 *   after the label's text, in a 44px slot that text reserves (WCAG 2.5.5),
 *   and it is placed in the DOM where the eye meets it, so the tab order
 *   matches: before the label when the text leads its control, after it when
 *   the control leads (a checkbox). Its name is "Help: <label text>", it is
 *   described by the hint, and `aria-expanded` says whether the hint shows.
 *   While its label is hidden, so is it.
 *
 *   The hint is what it always was — a *description of the control* — and is
 *   attached to that control permanently through `aria-describedby`.
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
 *   Keyboard focus opens the hint: arriving on its trigger, or on the
 *   control it describes (A11Y-01). Enter or Space on the trigger toggles it,
 *   as a click does. Escape dismisses it for as long as focus stays there
 *   (WCAG 1.4.13 Dismissible). Focus is never moved by this module, so
 *   nothing needs restoring on dismiss. A mouse click focuses no hint open:
 *   `:focus-visible` tells a keyboard's arrival from a pointer's.
 *
 *   A mouse resting on a trigger opens its hint after
 *   `INTERACTION.HINT_HOVER_OPEN_DELAY_MS` (UI-03). That hint takes the
 *   pointer, so the pointer can move from the trigger onto the hint and back
 *   without closing it (WCAG 1.4.13 Hoverable); it closes once the pointer has
 *   left both, after a short grace for crossing the gap between them, and
 *   Escape closes it with the pointer still in place (Dismissible). It stays
 *   until then (Persistent). A click on its trigger keeps it open as a
 *   click-opened hint would be; a click on the hint closes it. Every hint is
 *   placed clear of its label, its trigger and the control it describes, so
 *   the grace covers crossing that control. Touch and pen never hover-open:
 *   a tap is still a click.
 *
 *   The visible tooltip stays `aria-hidden`: its text is already exposed as
 *   the control's description, and announcing both would say it twice.
 *
 * @module ParamTooltip
 */

import { INTERACTION } from '../config/constants.js';

/** @type {HTMLElement|null} Shared tooltip element */
let tooltipEl = null;
/** @type {HTMLElement|null} The hint text (`[data-tip]`) whose hint is showing */
let activeTip = null;
/**
 * How the showing hint was opened. A hover-opened hint closes when the
 * pointer leaves; one opened by a click or by focus does not.
 * @type {'click'|'focus'|'hover'|null}
 */
let openedBy = null;
/**
 * The trigger or control the user dismissed the tooltip on with Escape.
 * Cleared when focus leaves it, so the hint returns on the next visit rather
 * than for good.
 * @type {HTMLElement|null}
 */
let escapeDismissed = null;

/** @type {HTMLElement|null} The hint whose trigger a mouse pointer is on, if any */
let hoverTip = null;
/** Whether a mouse pointer is on the visible hint itself. */
let pointerOnHint = false;
/** @type {ReturnType<typeof setTimeout>|null} A resting pointer's pending open */
let openTimer = null;
/** @type {ReturnType<typeof setTimeout>|null} A departed pointer's pending close */
let closeTimer = null;
/** Numbers the descriptions of controls that have no id of their own. */
let anonymousSerial = 0;

/** @type {WeakMap<HTMLElement, HTMLElement>} described control → its hint text */
const tipByControl = new WeakMap();
/** @type {WeakMap<HTMLElement, HTMLElement>} hint text → the control it describes */
const controlByTip = new WeakMap();
/** @type {WeakMap<HTMLElement, HTMLButtonElement>} hint text → its "?" trigger */
const triggerByTip = new WeakMap();
/** @type {WeakMap<HTMLButtonElement, HTMLElement>} "?" trigger → its hint text */
const tipByTrigger = new WeakMap();
/**
 * Documents whose delegated listeners are already bound. Re-initialising
 * (a rebuilt shell, or one jsdom document across several tests) must not stack
 * a second set of handlers, which would toggle every tooltip twice per click.
 * @type {WeakSet<Document>}
 */
const boundDocuments = new WeakSet();
/**
 * The labels (and pickers' fieldsets) a trigger stands beside. The app hides a
 * row by hiding its label (Wait Time, Segment speed, Trail size and more), and
 * the trigger, which sits beside the label rather than in it, must go too.
 * @type {WeakSet<HTMLElement>}
 */
const hosts = new WeakSet();

/** The trigger's class, the hook main.css and the delegated listeners share. */
const TRIGGER_CLASS = 'param-hint-trigger';

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
 * The element that names a hint's control: its <label>, or the <legend>
 * of a fieldset (a swatch picker's group).
 * @param {HTMLElement} tip - Element carrying the data-tip attribute
 * @returns {HTMLElement|null}
 */
function labelOf(tip) {
  return tip.closest('label, legend');
}

/**
 * The element a hint's trigger stands beside: its label, or the fieldset a
 * legend names. Beside the fieldset rather than in it, so a disabled picker
 * does not disable its help and its grid gains no cell.
 * @param {HTMLElement} tip - Element carrying the data-tip attribute
 * @returns {HTMLElement|null}
 */
function hostOf(tip) {
  const label = labelOf(tip);
  return label?.tagName === 'LEGEND' ? label.parentElement : label;
}

/**
 * The control a hint describes: the enclosing label's `for` target, or
 * the control a label wraps (fields built at run time carry no `for`), or a
 * legend's fieldset.
 * @param {HTMLElement} tip - Element carrying the data-tip attribute
 * @returns {HTMLElement|null}
 */
function describedControl(tip) {
  const label = labelOf(tip);
  if (!label) return null;
  if (label.tagName === 'LEGEND') {
    return label.parentElement?.tagName === 'FIELDSET' ? label.parentElement : null;
  }
  const id = label.getAttribute('for');
  if (id) return document.getElementById(id);
  return label.control ?? null;
}

/**
 * Give `control` a permanent description carrying `tip`'s hint text, and the
 * hint its trigger. Returns false when the hint has no resolvable control, so
 * a malformed hint is skipped rather than silently half-wired.
 * @param {HTMLElement} tip - Element carrying the data-tip attribute
 * @returns {boolean}
 */
function describeControl(tip) {
  const text = tip.getAttribute('data-tip');
  const control = describedControl(tip);
  if (!text || !control) return false;
  if (!isDescribed(tip, control)) addDescription(tip, control, text);
  attachTrigger(tip, control);
  return true;
}

/**
 * Whether `tip` is already its control's description, by an earlier init or
 * as it arrived (`followMutations`): describing it again would duplicate the
 * token. A copy of a wired hint (a redrawn row) is remembered as wired.
 * @param {HTMLElement} tip
 * @param {HTMLElement} control
 * @returns {boolean}
 */
function isDescribed(tip, control) {
  const existingId = tip.getAttribute('data-tip-desc');
  if (existingId && controlByTip.get(tip) === control) return true;
  if (existingId && document.getElementById(existingId)) {
    tipByControl.set(control, tip);
    controlByTip.set(tip, control);
    return true;
  }
  return false;
}

/**
 * Insert the description node and append its token to the control's
 * `aria-describedby`.
 * @param {HTMLElement} tip
 * @param {HTMLElement} control
 * @param {string} text
 */
function addDescription(tip, control, text) {
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
  labelOf(tip).insertAdjacentElement('afterend', description);

  const existing = control.getAttribute('aria-describedby');
  // Append: a slider readout already owns the first token and announces first.
  control.setAttribute('aria-describedby', existing ? `${existing} ${id}` : id);
  tip.setAttribute('data-tip-desc', id);

  tipByControl.set(control, tip);
  controlByTip.set(tip, control);
}

/**
 * Build a hint's "?" trigger. Its name uses the label's own words, so the
 * help for Size is "Help: Size"; it is described by the hint, as the control
 * is, so a screen reader arriving on it hears what it would show.
 * @param {HTMLElement} tip
 * @returns {HTMLButtonElement}
 */
function createTrigger(tip) {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = TRIGGER_CLASS;
  trigger.setAttribute('aria-label', `Help: ${tip.textContent.replace(/\s+/g, ' ').trim()}`);
  trigger.setAttribute('aria-describedby', tip.getAttribute('data-tip-desc'));
  trigger.setAttribute('aria-expanded', 'false');
  // The "?" is drawn, not read: the name above says what the button is.
  const glyph = document.createElement('span');
  glyph.className = 'param-hint-glyph';
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = '?';
  trigger.appendChild(glyph);
  return trigger;
}

/**
 * Give `tip` its trigger, or put the one it has back beside its label (a
 * moved row), and tie the two together for main.css's anchor positioning.
 * The anchor's name is the description's id, which the page already holds
 * unique.
 * @param {HTMLElement} tip
 * @param {HTMLElement} control
 */
function attachTrigger(tip, control) {
  let trigger = triggerByTip.get(tip);
  if (!trigger) {
    trigger = createTrigger(tip);
    triggerByTip.set(tip, trigger);
    tipByTrigger.set(trigger, tip);
  }
  const host = hostOf(tip);
  // Where the eye meets it: after the label only when the control comes
  // first (a checkbox), so Tab reaches the "?" where it is seen.
  const after = Boolean(tip.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING)
    && !control.contains(tip);
  if (after ? host.nextElementSibling !== trigger : host.previousElementSibling !== trigger) {
    if (after) host.after(trigger);
    else host.before(trigger);
  }
  const anchor = `--${tip.getAttribute('data-tip-desc').replace(/[^\w-]/g, '_')}`;
  if (tip.style.getPropertyValue('anchor-name') !== anchor) tip.style.setProperty('anchor-name', anchor);
  if (trigger.style.getPropertyValue('position-anchor') !== anchor) {
    trigger.style.setProperty('position-anchor', anchor);
  }
  hosts.add(host);
  syncTrigger(tip);
}

/**
 * Show or hide `tip`'s trigger with its label, and close its hint when the
 * label goes: a hint for a row no longer on screen describes nothing visible.
 * @param {HTMLElement} tip
 */
function syncTrigger(tip) {
  const trigger = triggerByTip.get(tip);
  const host = hostOf(tip);
  if (!trigger || !host) return;
  const hidden = host.hidden || host.style.display === 'none';
  if (trigger.hidden !== hidden) trigger.hidden = hidden;
  if (hidden && activeTip === tip) hideTooltip();
}

/**
 * The hint texts in `node`, itself included.
 * @param {Element} node
 * @returns {HTMLElement[]}
 */
function hintsIn(node) {
  const tips = node.matches('[data-tip]') ? [node] : [];
  tips.push(...node.querySelectorAll('[data-tip]'));
  return tips;
}

/**
 * Wire hints added after `initParamTooltips` ran, as they arrive, and take a
 * hint's trigger off the page with it. A hint that already carries a
 * description (a moved node) keeps it, and its trigger follows it. A hinted
 * label hidden or shown takes its trigger along.
 * @param {MutationRecord[]} records
 */
function followMutations(records) {
  const departed = [];
  for (const record of records) {
    if (record.type === 'attributes') {
      if (hosts.has(record.target)) hintsIn(record.target).forEach(syncTrigger);
      continue;
    }
    for (const node of record.removedNodes) {
      if (node.nodeType === 1) departed.push(...hintsIn(node));
    }
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      for (const tip of hintsIn(node)) describeControl(tip);
    }
  }
  for (const tip of departed) {
    if (tip.isConnected) continue;
    triggerByTip.get(tip)?.remove();
    // A hint whose row went takes its popup, and a pointer's pending open of
    // it, along: nothing on the page is left for either to describe.
    if (tip === activeTip) hideTooltip();
    if (tip === hoverTip) {
      cancelHoverOpen();
      hoverTip = null;
    }
  }
  if (escapeDismissed && !escapeDismissed.isConnected) escapeDismissed = null;
}

/**
 * The hint an element belongs to, and the element focus rests on for it: a
 * trigger is its hint's; a described control, or a swatch radio within its
 * picker's fieldset, is the control's.
 * @param {EventTarget|null} el
 * @returns {{tip: HTMLElement, holder: HTMLElement}|null}
 */
function hintAt(el) {
  if (!el || el.nodeType !== 1) return null;
  if (tipByTrigger.has(el)) return { tip: tipByTrigger.get(el), holder: el };
  if (tipByControl.has(el)) return { tip: tipByControl.get(el), holder: el };
  const group = el.closest('fieldset');
  return group && tipByControl.has(group) ? { tip: tipByControl.get(group), holder: group } : null;
}

/**
 * The box a hint stays clear of: its label text, its trigger and the control
 * it describes together. A hover-opened hint takes the pointer, so placed
 * over its own control (an outline label sits above its input) it would block
 * clicks on the very field it explains. It starts under the trigger.
 * @param {HTMLElement} tip - The [data-tip] element
 * @returns {{top: number, bottom: number, left: number}}
 */
function anchorRect(tip) {
  const trigger = triggerByTip.get(tip);
  const shown = [trigger, tip, controlByTip.get(tip)].filter(el => el?.isConnected && !el.hidden);
  if (!shown.length) return { top: 0, bottom: 0, left: 0 };
  const boxes = shown.map(el => el.getBoundingClientRect());
  return {
    top: Math.min(...boxes.map(box => box.top)),
    bottom: Math.max(...boxes.map(box => box.bottom)),
    // Under the trigger when it is there to start from.
    left: boxes[0].left,
  };
}

/**
 * Position the tooltip below (or above if near bottom) the hint's label text,
 * trigger and control. Uses getBoundingClientRect for viewport-relative
 * placement.
 * @param {HTMLElement} tip - The [data-tip] element whose hint shows
 */
function positionTooltip(tip) {
  const rect = anchorRect(tip);
  const tipRect = tooltipEl.getBoundingClientRect();
  const gap = 6; // px between trigger and tooltip
  const margin = 12; // px from viewport edge

  // Default: below the trigger
  let top = rect.bottom + gap;
  let left = rect.left;

  // Flip above if not enough room below. A control far below its text can
  // leave no room above either: then keep the hint on screen, even over them.
  if (top + tipRect.height > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - tipRect.height - gap);
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

/**
 * Say on a hint's trigger whether its hint shows.
 * @param {HTMLElement|null} tip
 * @param {boolean} expanded
 */
function markExpanded(tip, expanded) {
  const trigger = tip ? triggerByTip.get(tip) : null;
  const value = String(expanded);
  if (trigger && trigger.getAttribute('aria-expanded') !== value) trigger.setAttribute('aria-expanded', value);
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
 * Show the tooltip for a given hint.
 * @param {HTMLElement} tip - Element with data-tip attribute
 * @param {'click'|'focus'|'hover'} how - What opened it
 */
function showTooltip(tip, how) {
  const text = tip.getAttribute('data-tip');
  if (!text) return;

  // A hint shown by any route supersedes a pending hover open: left to fire,
  // it would turn a clicked hint into a hover-opened one that leaving closes.
  cancelHoverOpen();
  cancelHoverClose();

  if (!tooltipEl) {
    tooltipEl = createTooltipElement();
  }

  if (activeTip !== tip) markExpanded(activeTip, false);
  tooltipEl.textContent = text;
  tooltipEl.style.display = 'block';
  activeTip = tip;
  setOpenedBy(how);
  markExpanded(tip, true);

  // Position after content is set (needs layout for tipRect). The frame can
  // land after a rebuilt shell has detached the shared element, so re-check
  // rather than positioning a node that is no longer there.
  requestAnimationFrame(() => {
    if (tooltipEl?.isConnected && activeTip === tip) positionTooltip(tip);
  });
}

/**
 * Toggle the tooltip: clicking the active trigger again closes it.
 * @param {HTMLElement} tip - Element with data-tip attribute
 */
function toggleTooltip(tip) {
  if (activeTip === tip) {
    hideTooltip();
    return;
  }
  showTooltip(tip, 'click');
}

/**
 * Close the showing hint, leaving a pointer's pending open alone: the pointer
 * may already rest on the next trigger.
 */
function closeTooltip() {
  cancelHoverClose();
  if (!tooltipEl) return;
  tooltipEl.style.display = 'none';
  markExpanded(activeTip, false);
  activeTip = null;
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
 * hover-opened hint stays while the pointer is on its trigger, on the control
 * the hint describes or on the hint, and closes after a short grace once it is
 * on none of them. The hint sits clear of trigger and control both, so the
 * pointer may cross the control on its way to the hint (WCAG 1.4.13
 * Hoverable). Only a change of trigger arms a new open, so a hint dismissed
 * with Escape stays closed while the pointer rests where it was.
 * @param {EventTarget|null} target - What the pointer is now over (null: off the page)
 */
function followPointer(target) {
  const element = target?.nodeType === 1 ? target : null;
  const trigger = element?.closest(`.${TRIGGER_CLASS}`) ?? null;
  const tip = trigger ? tipByTrigger.get(trigger) ?? null : null;
  pointerOnHint = Boolean(element && tooltipEl?.contains(element));

  if (tip !== hoverTip) {
    cancelHoverOpen();
    hoverTip = tip;
    if (tip && tip !== activeTip && tip.getAttribute('data-tip')) {
      openTimer = setTimeout(() => {
        openTimer = null;
        // A rebuild (the scene outline redraws its forms) can replace the
        // hint while the pointer rests on its trigger; the old trigger goes
        // with it, but only once the page's mutations have been answered.
        if (trigger.isConnected && tip.isConnected) showTooltip(tip, 'hover');
      }, INTERACTION.HINT_HOVER_OPEN_DELAY_MS);
    }
  }

  if (openedBy !== 'hover') return;
  const control = activeTip ? controlByTip.get(activeTip) : null;
  const pointerOnControl = Boolean(element && control?.contains(element));
  if (hoverTip === activeTip || pointerOnHint || pointerOnControl) {
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
 * Wires every [data-tip] hint as its control's `aria-describedby` description
 * and gives it its trigger, then binds the delegated pointer, focus and
 * keyboard listeners, and watches for hints added later.
 */
export function initParamTooltips() {
  // A replaced shell leaves the old shared element detached; rebuild it.
  if (tooltipEl && !tooltipEl.isConnected) {
    cancelHoverOpen();
    cancelHoverClose();
    tooltipEl = null;
    activeTip = null;
    openedBy = null;
    escapeDismissed = null;
    hoverTip = null;
    pointerOnHint = false;
  }

  document.querySelectorAll('[data-tip]').forEach(describeControl);

  if (boundDocuments.has(document)) return;
  boundDocuments.add(document);

  // Observing the document itself, not <body>, outlives a replaced shell.
  new MutationObserver(followMutations).observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style'],
  });

  // A click on a trigger toggles its hint. Nothing else here is a trigger: a
  // click on a label's text is the label's, so it focuses or toggles its
  // control as any label's would (DEF-14), and closes a showing hint.
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest?.(`.${TRIGGER_CLASS}`);
    const tip = trigger ? tipByTrigger.get(trigger) : null;
    if (tip) {
      // A click on a hint that hovering opened keeps it, as a click opens one:
      // closing it would answer a click asking for the hint by hiding it.
      if (tip === activeTip && openedBy === 'hover') {
        cancelHoverClose();
        setOpenedBy('click');
        return;
      }
      toggleTooltip(tip);
      return;
    }
    // Click outside — dismiss. A hover-opened hint takes the pointer, so a
    // click on the hint itself dismisses it too: the click would otherwise
    // reach nothing, and what the hint covers is then a click away.
    if (activeTip && (openedBy === 'hover' || !tooltipEl?.contains(e.target))) {
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

  // Keyboard arrival on a trigger, or on the control a hint describes,
  // reveals the hint.
  document.addEventListener('focusin', (e) => {
    const at = hintAt(e.target);
    if (!at || escapeDismissed === at.holder) return;
    if (!isKeyboardFocus(e.target)) return;
    showTooltip(at.tip, 'focus');
  });

  document.addEventListener('focusout', (e) => {
    const at = hintAt(e.target);
    // Focus moving within a described group (between swatches) stays put.
    if (!at || at.holder.contains(e.relatedTarget)) return;
    if (escapeDismissed === at.holder) escapeDismissed = null;
    // A hover-opened hint answers to the pointer, not to focus.
    if (activeTip && openedBy !== 'hover' && at.tip === activeTip) {
      closeTooltip();
    }
  });

  // Escape closes, and keeps it closed while focus stays on that trigger or
  // control. Capture phase: a control's own Escape handler (the scene outline
  // resets its form) stops the key before it would bubble here. The key still
  // reaches that handler, as it did before hints opened on hover. Closing the
  // hint uses the key up, so the page's own Escape (which clears the
  // selection) leaves it alone (DEF-13).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !activeTip) return;
    const holders = [triggerByTip.get(activeTip), controlByTip.get(activeTip)];
    e.preventDefault();
    hideTooltip();
    escapeDismissed = holders.find(holder => holder?.contains(document.activeElement)) ?? escapeDismissed;
  }, true);

  // Dismiss on scroll or resize (tooltip position would be stale). A pending
  // hover open goes too: what is under the pointer has moved.
  const dismissOnScroll = () => {
    cancelHoverOpen();
    if (activeTip) hideTooltip();
  };
  document.addEventListener('scroll', dismissOnScroll, true); // capture phase for nested scrollers
  window.addEventListener('resize', dismissOnScroll);
}
