/**
 * Help: a dialog of its own (UI-06 J-01; the owner's pick, 2026-10-08, "A
 * Help dialog of its own (Recommended)"). Until then the Help button, `?` and
 * `help:toggle` all opened the first-run splash, with every shortcut folded in
 * an accordion under its welcome (the v3.1.473 audit's N6-4 and N10-1).
 *
 * The dialog is the Clear dialog's pattern: one focus trap, so the page
 * behind is inert but for the announcer, Escape closes it, and focus goes back
 * to what opened it. Its two hand-offs close it first, trap and all, and then
 * open what they offer, so no dialog opens over it: "Report a bug" the bug
 * report, "Show the welcome again" the welcome, without touching the flag
 * that says the welcome was seen. Each of those gives focus back to the
 * header's Help button when it closes, a control that is always there, rather
 * than to whatever opened Help. The one exception: the bug report, from Help
 * opened over the first start's welcome, gives it to the welcome's title,
 * since the welcome is still open beneath and the Help button inert behind it.
 *
 * RoutePlotter prototype mixin: every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, helpDialogMixin).
 */
import { createFocusTrap } from '../utils/focusTrap.js';
import { getHelpDialogHTML } from '../config/helpContent.js';
import { GITHUB_REPOSITORY_URL } from './privacy.js';

export const helpDialogMixin = {
  /** Write Help's content once, from the one source, and wire its controls. */
  setupHelpDialog() {
    const modal = document.getElementById('help-modal');
    if (!modal) return;
    this._helpModal = modal;
    this._helpFocusTrap = createFocusTrap(modal);
    document.getElementById('help-sections').innerHTML = getHelpDialogHTML();
    // The version the build gave the app (APP_VERSION): version.json is not
    // published with it, so a fetch of that file would fail live.
    document.getElementById('help-version').textContent = `Version ${this.appVersion}`;
    // Set here, as the bug report's Issues link is: the shell itself names no other origin.
    document.getElementById('help-source').href = GITHUB_REPOSITORY_URL;

    // The header's Help button opens it, as Report a bug beside it opens its
    // dialog (privacy.js); `?` and `help:toggle` come by the bus.
    this.elements.helpBtn?.addEventListener('click', () => this.showHelp());
    document.getElementById('help-close-x').addEventListener('click', () => this.hideHelp());
    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.hideHelp();
    });
    // The trap has already let go and given focus back.
    modal.addEventListener('focustrap:escape', () => this.hideHelp());
    document.getElementById('help-report-bug').addEventListener('click', () => this._reportBugFromHelp());
    document.getElementById('help-show-welcome').addEventListener('click', () => this._showWelcomeAgain());
  },

  /** @returns {boolean} Whether Help is on screen. */
  isHelpOpen() {
    return this._helpModal?.style.display === 'flex';
  },

  /** Open Help, focus on its title; focus goes back to what had it when Help closes. */
  showHelp() {
    if (!this._helpModal || this.isHelpOpen()) return;
    this._helpModal.style.display = 'flex';
    this._helpFocusTrap.activate();
  },

  /** Close Help and give focus back. */
  hideHelp() {
    if (!this.isHelpOpen()) return;
    this._helpModal.style.display = 'none';
    this._helpFocusTrap.deactivate();
  },

  /** `help:toggle`: open Help, or close it when it is open. */
  toggleHelp() {
    if (this.isHelpOpen()) this.hideHelp();
    else this.showHelp();
  },

  /**
   * Close Help, then open the bug report, whose closing gives focus to the
   * Help button (the owner's pick, 2026-10-09, "Close Help, then open it").
   * @private
   */
  _reportBugFromHelp() {
    this.hideHelp();
    this._openDiagnosticsPreview(null, this.elements.helpBtn, 'bug-report');
  },

  /**
   * Close Help, then show the welcome as a first start does, the flag left as
   * it is. Its trap starts here rather than from its observer, a microtask
   * later, so that it returns focus to the Help button: the observer's would
   * return it to whatever opened Help. Help opened over the first start's
   * welcome leaves the welcome's trap active beneath it, and starting an
   * active trap does nothing, so that trap stops first and starts afresh
   * (Codex r1): otherwise the welcome's dismissal gives focus to the page.
   * @private
   */
  _showWelcomeAgain() {
    this.hideHelp();
    this._splashFocusTrap?.deactivate();
    this.showSplash();
    this._splashFocusTrap?.activate(null, this.elements.helpBtn);
  },
};
