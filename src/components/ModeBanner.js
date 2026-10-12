/**
 * ModeBanner — the one banner slot below the header (UI-06 J-12; wish-list
 * 22: the area draw and the network edit each inline-styled a banner of
 * their own, fixed over the header's controls).
 *
 * `#mode-banner` is its own row of the page, between the header and the main
 * area: empty, it takes no room; while a banner shows, one line (3 rem), two
 * where the width wraps it, and the canvas area below gives up that height
 * (the lead's settled policy, the owner's "Proceed as per your
 * recommendations", 2026-10-10). One banner at a time: a mode's (drawing an
 * area, editing the network, placing a branch) or the first-start tip.
 *
 * Owners: each `show` names an owner, an object with `onReplaced()`. When
 * another owner's banner is up, that `onReplaced()` runs to its end first,
 * and it must leave its mode by the path its Escape takes, so a mode is never
 * left running behind a banner that is gone. An owner claims the slot as the
 * first step of its entry, before it changes anything of its own (Codex on
 * 9466a3f, blocking 1: the outgoing mode's exit, a Preview restore among
 * what it does, then cannot reach the incoming one). `hide` and `update` act
 * only for the owner holding the slot, so a timer of an owner replaced since
 * changes nothing of its successor's.
 *
 * The slot is not a live region: an owner says its entry, and what its count
 * line says, once through the app's announcer (UI-06 J-05). Its actions are
 * real buttons named by their visible words, handed back to the owner, whose
 * own listeners they run; Escape stays with the owner too.
 *
 * Its height changes when a banner shows or goes, or when a replacement or a
 * new count line changes how many lines it takes: `onHeightChange` is told
 * once the height has settled, at once when the slot does not animate (no
 * transition, or reduced motion), at the end of its height transition
 * otherwise, with a fallback timer, so the canvas is refitted to the room it
 * has (Codex on 9466a3f: the canvas keeps explicit sizes).
 *
 * @module ModeBanner
 */

import { focusLands } from '../utils/focusTrap.js';

/** How long past its transition the slot waits for `transitionend` before it gives up and reports. */
const SETTLE_MARGIN_MS = 100;

/** The banner for each slot element, so every owner on the page shares one. */
const bannerOf = new WeakMap();

/**
 * The longest transition the element runs, delay included, in ms: what its
 * computed style says, so reduced motion (`transition: none`, whatever the
 * page's 0.01 ms rule leaves of the duration) and a page with no stylesheet
 * both read 0.
 * @param {Element} element
 * @returns {number}
 */
function transitionMs(element) {
  const style = window.getComputedStyle(element);
  if (/^\s*none\s*$/.test(style.transitionProperty || '')) return 0;
  const times = text => String(text || '0s').split(',').map(part => {
    const value = parseFloat(part);
    if (!Number.isFinite(value)) return 0;
    return /ms\s*$/.test(part) ? value : value * 1000;
  });
  const durations = times(style.transitionDuration);
  const delays = times(style.transitionDelay);
  const longest = Math.max(0, ...durations.map((duration, index) => duration + (delays[index % delays.length] ?? 0)));
  return longest < 1 ? 0 : longest;
}

/**
 * The control to give focus to, or, when the card holding it is collapsed
 * (its content is display:none, so a browser cannot focus it), the card's
 * header button: the visible control that reveals it. The card is not
 * opened: leaving the mode is no reason to change the layout the user set.
 * Decided by the header's `aria-expanded` (jsdom lays nothing out). When
 * that target is itself inside something hidden — the mode left with the
 * crowd deselected, so SectionController has already hidden the Crowd scope
 * group — the scope chip's Route button, always shown and never disabled,
 * takes the focus instead. (Done's rule, UI-06 B-29; shared by every banner
 * that takes its own control away, PR 6.)
 * @param {HTMLElement} control
 * @returns {HTMLElement}
 */
export function visibleFocusTarget(control) {
  const header = control.closest('.settings-section')?.querySelector('.section-header');
  const target = !header || header.getAttribute('aria-expanded') === 'true' ? control : header;
  if (!target.closest('[hidden]')) return target;
  return routeScopeButton() ?? target;
}

/** The scope chip's Route button: always shown, never disabled, focus's last stop. */
function routeScopeButton() {
  return document.getElementById('scope-route-btn');
}

/**
 * Give focus to the first of `targets` it lands on (PR 7's checks, through
 * `focusLands`: one removed, hidden or disabled since is passed over), else
 * to the scope chip's Route button, so focus held in a banner that goes is
 * never lost (UI-06: focus is never lost). The page itself is no target.
 * @param {...(Element|null|undefined)} targets
 * @returns {Element|null} Where focus went
 */
export function returnFocus(...targets) {
  for (const target of targets) {
    if (!target || target === document.body || target === document.documentElement) continue;
    if (focusLands(target)) return target;
  }
  const route = routeScopeButton();
  return focusLands(route) ? route : null;
}

/**
 * The page's banner slot, `#mode-banner`, and the banner that runs it: the
 * app's, made at start-up, or a plain one for a page that has none yet.
 * @returns {ModeBanner|null} null on a page with no slot
 */
export function pageModeBanner() {
  const slot = document.getElementById('mode-banner');
  if (!slot) return null;
  return bannerOf.get(slot) ?? new ModeBanner(slot);
}

export class ModeBanner {
  /**
   * @param {HTMLElement} slot - The page's `#mode-banner`
   * @param {{onHeightChange?: Function}} [options] - Told once the slot's height has settled after a change
   */
  constructor(slot, { onHeightChange = null } = {}) {
    this.slot = slot;
    this.onHeightChange = onHeightChange;
    /** @type {{owner: Object, root: HTMLElement, count: HTMLElement|null}|null} */
    this._holder = null;
    this._replacing = false;
    this._destroyed = false;
    /** @type {{timer: *, listener: Function}|null} A settle waiting for the height transition */
    this._settle = null;
    /** @type {Set<Function>} Waiting for the slot to be free (the first-start tip) */
    this._freeWaiters = new Set();
    /** The control focused before focus entered the slot (PR 8's toast rule, B-35). */
    this._focusBefore = null;
    this._onFocusIn = (event) => {
      if (!this.slot.contains(event.relatedTarget)) this._focusBefore = event.relatedTarget ?? null;
    };
    this.slot.addEventListener('focusin', this._onFocusIn);
    bannerOf.set(slot, this);
  }

  /**
   * Show `owner`'s banner. Another owner's is replaced first: its
   * `onReplaced()` runs to its end, leaving its mode. The same owner's is
   * redrawn, replacing nothing.
   * @param {{onReplaced?: Function}} owner
   * @param {Object} spec
   * @param {string} spec.id - The banner's own id (`network-edit-banner`, …)
   * @param {string} [spec.title] - Its lead words, in bold
   * @param {Array<string|{kbd: string}>|string} [spec.text] - What follows, a key named as `{kbd}`
   * @param {string|null} [spec.count] - The line `update` rewrites; null for none
   * @param {Array<{label: string, className?: string, onClick: Function}>} [spec.actions] - Its buttons
   * @returns {{root: HTMLElement, actions: HTMLButtonElement[], count: HTMLElement|null}|null}
   */
  show(owner, { id, title = '', text = [], count = null, actions = [] } = {}) {
    if (this._destroyed || !this.slot) return null;
    const heightBefore = this.slot.offsetHeight;
    const before = this._holder;
    if (before && before.owner !== owner) {
      this._replacing = true;
      try {
        before.owner.onReplaced?.();
      } finally {
        this._replacing = false;
      }
      // An owner that left its banner up loses it all the same.
      if (this._holder === before) this._clear();
    }

    const root = document.createElement('div');
    root.id = id;
    root.className = 'mode-banner-item';
    const words = document.createElement('span');
    words.className = 'banner-text';
    if (title) {
      const strong = document.createElement('strong');
      strong.textContent = title;
      words.append(strong);
    }
    for (const part of [].concat(text)) {
      if (part && typeof part === 'object' && 'kbd' in part) {
        const key = document.createElement('kbd');
        key.textContent = part.kbd;
        words.append(key);
      } else if (part) {
        words.append(document.createTextNode(String(part)));
      }
    }
    let countEl = null;
    if (count !== null) {
      countEl = document.createElement('span');
      countEl.className = 'banner-count';
      countEl.textContent = count;
      words.append(countEl);
    }
    root.append(words);
    const buttons = actions.map(({ label, className = '', onClick }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = ['mode-banner-action', className].filter(Boolean).join(' ');
      // Named by its visible words (UI-STANDARDS: label in name; F9/B-04): no aria-label.
      button.textContent = label;
      if (typeof onClick === 'function') button.addEventListener('click', onClick);
      root.append(button);
      return button;
    });

    this.slot.replaceChildren(root);
    this.slot.classList.add('is-showing');
    this._holder = { owner, root, count: countEl };
    if (!before) this._heightChanged(true);
    else if (this.slot.offsetHeight !== heightBefore) this._heightChanged(false);
    return { root, actions: buttons, count: countEl };
  }

  /**
   * Rewrite the holder's count line. Another owner's call does nothing.
   * @param {Object} owner
   * @param {{count: string}} change
   * @returns {boolean} Whether it was written
   */
  update(owner, { count } = {}) {
    if (!this._holder || this._holder.owner !== owner || !this._holder.count) return false;
    const heightBefore = this.slot.offsetHeight;
    this._holder.count.textContent = count ?? '';
    if (this.slot.offsetHeight !== heightBefore) this._heightChanged(false);
    return true;
  }

  /**
   * Take `owner`'s banner away. Another owner's call does nothing (a timer of
   * an owner replaced since leaves its successor's banner up).
   * @param {Object} owner
   * @returns {boolean} Whether it was the holder's
   */
  hide(owner) {
    if (!this._holder || this._holder.owner !== owner) return false;
    this._clear();
    // Replaced: the incoming banner takes the slot in the same call, so the
    // slot is not free and its height is told once, by `show`.
    if (this._replacing) return true;
    for (const waiter of [...this._freeWaiters]) {
      this._freeWaiters.delete(waiter);
      waiter();
      if (this._holder) break;
    }
    if (!this._holder) this._heightChanged(true);
    return true;
  }

  /**
   * Whether a banner shows: any, or `owner`'s.
   * @param {Object} [owner]
   * @returns {boolean}
   */
  isShowing(owner) {
    if (owner === undefined) return this._holder !== null;
    return this._holder?.owner === owner;
  }

  /** The owner holding the slot, or null. */
  get holder() {
    return this._holder?.owner ?? null;
  }

  /**
   * Whether focus is in `owner`'s banner (its button pressed, or held there).
   * @param {Object} owner
   * @returns {boolean}
   */
  holdsFocus(owner) {
    return this._holder?.owner === owner && this._holder.root.contains(document.activeElement);
  }

  /** The control focused before focus entered the slot, or null. */
  get focusBefore() {
    return this._focusBefore;
  }

  /**
   * Run `callback` once the slot is free, when a banner goes and none takes
   * its place (the first-start tip waits for a mode to end).
   * @param {Function} callback
   * @returns {Function} Stop waiting
   */
  whenFree(callback) {
    const waiter = () => callback();
    this._freeWaiters.add(waiter);
    return () => this._freeWaiters.delete(waiter);
  }

  /**
   * Stop: no settle, no waiter and no focus tracking runs after this; the
   * slot keeps what it shows.
   */
  destroy() {
    this._destroyed = true;
    this._cancelSettle();
    this._freeWaiters.clear();
    this.slot?.removeEventListener('focusin', this._onFocusIn);
    if (this.slot && bannerOf.get(this.slot) === this) bannerOf.delete(this.slot);
  }

  /** Empty the slot. @private */
  _clear() {
    this._holder = null;
    this.slot.replaceChildren();
    this.slot.classList.remove('is-showing');
    this._focusBefore = null;
  }

  /**
   * Tell `onHeightChange` once the height has settled: at once with no
   * transition, else at its end, with a fallback timer.
   * @param {boolean} animated - Whether the change runs the slot's height transition
   * @private
   */
  _heightChanged(animated) {
    this._cancelSettle();
    if (this._destroyed) return;
    const duration = animated ? transitionMs(this.slot) : 0;
    if (duration <= 0) {
      this.onHeightChange?.();
      return;
    }
    const settled = () => {
      this._cancelSettle();
      if (!this._destroyed) this.onHeightChange?.();
    };
    const listener = (event) => {
      if (event.target === this.slot) settled();
    };
    this.slot.addEventListener('transitionend', listener);
    this._settle = { listener, timer: setTimeout(settled, duration + SETTLE_MARGIN_MS) };
  }

  /** @private */
  _cancelSettle() {
    if (!this._settle) return;
    clearTimeout(this._settle.timer);
    this.slot.removeEventListener('transitionend', this._settle.listener);
    this._settle = null;
  }
}
