/**
 * Context Menu Component
 * Right-click menu for canvas waypoints and empty canvas, WCAG AAA.
 *
 * Carbon menu anatomy implemented in project code (Carbon is a spec
 * reference, not a dependency): role=menu with role=menuitem entries,
 * 44px touch targets, tokens for all colours.
 *
 * Features:
 * - Keyboard navigation (Arrow keys wrap, Home/End, Enter/Space, Escape)
 * - Click outside, scroll, resize, or window blur to close
 * - Disabled items stay focusable (aria-disabled) so their presence is
 *   perceivable to screen reader users
 * - Focus returns to the previously focused element on close
 * - Viewport-clamped positioning
 *
 * @module ContextMenu
 */

export class ContextMenu {
  constructor() {
    this.menu = document.createElement('ul');
    this.menu.className = 'context-menu';
    this.menu.setAttribute('role', 'menu');
    this.menu.style.display = 'none';
    document.body.appendChild(this.menu);

    this._previousFocus = null;

    // All bound once so add/removeEventListener pairs match
    this._onDocPointerDown = (e) => {
      if (!this.menu.contains(e.target)) this.hide();
    };
    this._onDocKeyDown = (e) => this._handleKeyDown(e);
    this._onWindowBlurOrScroll = () => this.hide();
  }

  /**
   * Show the menu at a viewport position.
   * @param {Object} opts
   * @param {number} opts.x - clientX anchor
   * @param {number} opts.y - clientY anchor
   * @param {Array<Object>} opts.items - [{label, action, disabled, danger, separatorBefore}]
   * @param {string} [opts.ariaLabel] - Accessible name for the menu
   */
  show({ x, y, items, ariaLabel }) {
    this.hide({ restoreFocus: false }); // Only one menu at a time
    this._previousFocus = document.activeElement;

    this.menu.setAttribute('aria-label', ariaLabel || 'Context menu');
    this.menu.innerHTML = '';

    items.forEach((item) => {
      if (item.separatorBefore) {
        const sep = document.createElement('li');
        sep.className = 'context-menu-separator';
        sep.setAttribute('role', 'separator');
        this.menu.appendChild(sep);
      }

      const li = document.createElement('li');
      li.setAttribute('role', 'presentation');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'context-menu-item' + (item.danger ? ' is-danger' : '');
      btn.setAttribute('role', 'menuitem');
      btn.textContent = item.label;
      if (item.disabled) {
        btn.setAttribute('aria-disabled', 'true');
        if (item.disabledReason) btn.title = item.disabledReason;
      }

      btn.addEventListener('click', () => {
        if (item.disabled) return;
        this.hide({ restoreFocus: false });
        item.action?.();
      });

      li.appendChild(btn);
      this.menu.appendChild(li);
    });

    // Render invisibly to measure, then clamp within the viewport
    this.menu.style.visibility = 'hidden';
    this.menu.style.display = 'block';
    const rect = this.menu.getBoundingClientRect();
    const pad = 8;
    const left = Math.min(x, window.innerWidth - rect.width - pad);
    const top = Math.min(y, window.innerHeight - rect.height - pad);
    this.menu.style.left = `${Math.max(pad, left)}px`;
    this.menu.style.top = `${Math.max(pad, top)}px`;
    this.menu.style.visibility = '';

    this._items()[0]?.focus();

    // Capture phase so a click that opens another element still closes us
    document.addEventListener('pointerdown', this._onDocPointerDown, true);
    document.addEventListener('keydown', this._onDocKeyDown, true);
    window.addEventListener('blur', this._onWindowBlurOrScroll);
    window.addEventListener('scroll', this._onWindowBlurOrScroll, true);
    window.addEventListener('resize', this._onWindowBlurOrScroll);
  }

  /** @param {Object} [opts] @param {boolean} [opts.restoreFocus=true] */
  hide({ restoreFocus = true } = {}) {
    if (this.menu.style.display === 'none') return;
    this.menu.style.display = 'none';
    this.menu.innerHTML = '';

    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    document.removeEventListener('keydown', this._onDocKeyDown, true);
    window.removeEventListener('blur', this._onWindowBlurOrScroll);
    window.removeEventListener('scroll', this._onWindowBlurOrScroll, true);
    window.removeEventListener('resize', this._onWindowBlurOrScroll);

    if (restoreFocus && this._previousFocus?.isConnected) {
      this._previousFocus.focus();
    }
    this._previousFocus = null;
  }

  get isOpen() {
    return this.menu.style.display !== 'none';
  }

  _items() {
    return Array.from(this.menu.querySelectorAll('[role="menuitem"]'));
  }

  _handleKeyDown(e) {
    if (!this.isOpen) return;

    const items = this._items();
    const currentIndex = items.indexOf(document.activeElement);

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        break;
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        items[(currentIndex + 1) % items.length]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        items[(currentIndex - 1 + items.length) % items.length]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        e.stopPropagation();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        e.stopPropagation();
        items[items.length - 1]?.focus();
        break;
      case 'Tab':
        // Menus close on tab-out rather than trapping focus
        this.hide();
        break;
      default:
        // Swallow other keys so global shortcuts don't fire under the menu
        e.stopPropagation();
    }
  }
}
