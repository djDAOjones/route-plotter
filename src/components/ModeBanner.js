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
 * transition, or reduced motion), otherwise once each of its height-bearing
 * transitions (`min-height`, `max-height`) has ended, with a fallback timer,
 * so the canvas is refitted to the room it has (Codex on 9466a3f: the canvas
 * keeps explicit sizes). A replacement or a count line while an entry or an
 * exit still eases is told at that ease's end, the final height (the lead's
 * settlement on 7a74755: the refit measured a room read mid-ease).
 *
 * A claim made inside another's exit (an `onReplaced` that shows a banner of
 * its own, as a waiting owner may) is reconciled, never overwritten: every
 * holder the incoming owner meets leaves by its own exit, once, and an exit
 * already running further up is not run again (Codex r1 on 7a74755, 3).
 *
 * @module ModeBanner
 */

import { focusLands } from '../utils/focusTrap.js';

/** How long past its transition the slot waits for `transitionend` before it gives up and reports. */
const SETTLE_MARGIN_MS = 100;

/** The banner for each slot element, so every owner on the page shares one. */
const bannerOf = new WeakMap();

/** The properties that bound the slot's height: what an entry or an exit eases. */
const HEIGHT_PROPERTIES = ['min-height', 'max-height', 'height'];

/** How many holders one claim meets before it stops asking them to leave (exits that keep handing the slot on). */
const MAX_HANDOVERS = 8;

/**
 * The slot's height-bearing transitions and how long each takes, delay
 * included, in ms: what its computed style says, its lists matched as CSS
 * matches them (the property list leads; a shorter duration or delay list
 * repeats). Reduced motion (`transition: none`, whatever the page's 0.01 ms
 * rule leaves of the duration) and a page with no stylesheet both have none.
 * @param {Element} element
 * @returns {Map<string, number>} Property → ms, for each that runs 1 ms or more
 */
function heightTransitions(element) {
  const style = window.getComputedStyle(element);
  const list = text => String(text || '').split(',').map(part => part.trim()).filter(Boolean);
  const times = text => list(text || '0s').map(part => {
    const value = parseFloat(part);
    if (!Number.isFinite(value)) return 0;
    return /ms$/.test(part) ? value : value * 1000;
  });
  const properties = list(style.transitionProperty);
  const durations = times(style.transitionDuration);
  const delays = times(style.transitionDelay);
  const waits = new Map();
  properties.forEach((property, index) => {
    const ms = durations[index % durations.length] + delays[index % delays.length];
    const named = property === 'all' ? ['min-height', 'max-height'] : [property];
    for (const name of named) {
      if (!HEIGHT_PROPERTIES.includes(name)) continue;
      // A later entry for the same property is the one in force, as in CSS.
      if (ms >= 1) waits.set(name, ms);
      else waits.delete(name);
    }
  });
  return waits;
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
    /** How deep in `show` calls this is: above 0, a claim is replacing its holders. */
    this._claims = 0;
    /** The owners whose exit is running (`onReplaced`): none is asked twice. */
    this._exiting = new Set();
    this._destroyed = false;
    /** @type {{timer: *, listener: Function, reported: boolean}|null} A settle waiting for the height transitions */
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
   * Show `owner`'s banner. Every other owner holding the slot is replaced
   * first: its `onReplaced()` runs to its end, leaving its mode, and so does
   * that of any owner its exit hands the slot to, each once. The same
   * owner's is redrawn, replacing nothing.
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
    // Only the outermost claim tells the height: a banner shown and replaced
    // inside it is gone before anything is laid out.
    const outermost = this._claims === 0;
    const heightBefore = outermost ? this.slot.offsetHeight : 0;
    const wasEmpty = !this._holder;
    this._claims += 1;
    let drawn;
    try {
      this._replaceHolders(owner);
      drawn = this._draw(owner, { id, title, text, count, actions });
    } finally {
      this._claims -= 1;
    }
    if (outermost) {
      if (wasEmpty) this._heightChanged(true);
      else if (this.slot.offsetHeight !== heightBefore) this._heightChanged(false);
    }
    return drawn;
  }

  /**
   * Ask every holder other than `owner` to leave, by its own exit, each once:
   * one whose exit shows another owner's banner (a claim inside the exit)
   * leaves first, then that owner leaves in turn. A holder whose exit is
   * already running further up (it claimed again before it hid) loses its
   * banner, not a second exit. An owner that leaves its banner up loses it
   * all the same.
   * @param {Object} owner
   * @private
   */
  _replaceHolders(owner) {
    for (let handovers = 0; this._holder && this._holder.owner !== owner; handovers += 1) {
      const current = this._holder;
      if (this._exiting.has(current.owner) || handovers >= MAX_HANDOVERS) {
        this._clear();
        return;
      }
      this._exiting.add(current.owner);
      try {
        current.owner.onReplaced?.();
      } finally {
        this._exiting.delete(current.owner);
      }
      if (this._holder === current) this._clear();
    }
  }

  /**
   * Draw `owner`'s banner in the slot.
   * @returns {{root: HTMLElement, actions: HTMLButtonElement[], count: HTMLElement|null}}
   * @private
   */
  _draw(owner, { id, title, text, count, actions }) {
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
    if (this._claims > 0) return true;
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
   * transition; else once each height-bearing transition has ended, or at
   * its fallback timer. An ease the fallback outran still reports its end:
   * the room is final only then (a throttled pane). A change that eases
   * nothing (a replacement, a count line) while an ease runs is told at that
   * ease's end, never mid-way (the lead's settlement on 7a74755).
   * @param {boolean} animated - Whether the change runs the slot's height transition
   * @private
   */
  _heightChanged(animated) {
    if (this._destroyed) return;
    if (!animated && this._settle && !this._settle.reported) return;
    this._cancelSettle();
    const waits = animated ? heightTransitions(this.slot) : new Map();
    if (waits.size === 0) {
      this.onHeightChange?.();
      return;
    }
    const ending = new Set(waits.keys());
    const settle = { timer: null, listener: null, reported: false };
    const report = () => {
      if (!this._destroyed) this.onHeightChange?.();
    };
    settle.listener = (event) => {
      if (event.target !== this.slot || !ending.delete(event.propertyName) || ending.size > 0) return;
      this._cancelSettle();
      report();
    };
    settle.timer = setTimeout(() => {
      settle.timer = null;
      settle.reported = true;
      report();
    }, Math.max(...waits.values()) + SETTLE_MARGIN_MS);
    this.slot.addEventListener('transitionend', settle.listener);
    this._settle = settle;
  }

  /** @private */
  _cancelSettle() {
    if (!this._settle) return;
    clearTimeout(this._settle.timer);
    this.slot.removeEventListener('transitionend', this._settle.listener);
    this._settle = null;
  }
}
