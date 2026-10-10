/**
 * UI-06 J-01 — Help is a dialog of its own (the owner's pick, 2026-10-08:
 * "A Help dialog of its own (Recommended)": the shortcuts grid open, no "Get
 * started", the splash first-run only). The v3.1.473 audit's N6-4 and N10-1
 * found the Help button opened the first-run splash, with every shortcut
 * folded in an accordion under its welcome, and the splash came back on every
 * start unless "Don't show this again" was ticked.
 *
 * What is pinned here: the Help button, `?`, `help:toggle` and the waypoint
 * list's "View all controls" open `#help-modal`, never the splash; focus
 * moves to its title and comes back to what opened it; the page behind is
 * inert but for the one announcer; its shortcuts grid lists exactly the
 * bindings `getBindingsByCategory({ includeHidden: false, includeMouse: true })`
 * returns, each row carrying its binding's id, in the platform's modifier
 * glyphs; its four sections, in order, with no accordion; About's version,
 * from the app, not a fetch; "Report a bug" and "Show the welcome again" each
 * closing Help before the dialog they open, and focus coming back to the
 * header's Help button. From Help opened over the first start's welcome, the
 * welcome shown again gives focus to the Help button too, and the bug
 * report gives it back to the welcome, still open beneath, its title (the
 * Help button is inert behind it). And the splash: shown on a first start,
 * any way of dismissing it records that it was seen, a second start does not
 * show it, and its checkbox is gone; `?` on it opens Help over it, and
 * closing Help gives focus back to it.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp, tipSeen } from './helpers/bootApp.js';
import { getBindingsByCategory, MODIFIER_DISPLAY } from '../src/config/keybindings.js';

const SPLASH_SHOWN = 'routePlotter_splashShown';

const id = name => document.getElementById(name);
const isOpen = name => id(name).style.display === 'flex';

/**
 * The browser's storage, in memory, kept across the boots of one test: the
 * default test storage discards every write (tests/setup.js), so a second
 * start could not read what the first recorded. The start's tip is seen, so
 * its timer, on the real clock, lands in no test.
 * @returns {Map<string, string>}
 */
function useStorage() {
  const store = new Map();
  localStorage.getItem.mockImplementation(tipSeen(key => (store.has(key) ? store.get(key) : null)));
  localStorage.setItem.mockImplementation((key, value) => { store.set(key, String(value)); });
  localStorage.removeItem.mockImplementation((key) => { store.delete(key); });
  return store;
}

afterEach(() => {
  // An implementation outlives `clearMocks`: the next file's boots read none of this one's storage.
  localStorage.getItem.mockImplementation(() => null);
  localStorage.setItem.mockImplementation(() => {});
  localStorage.removeItem.mockImplementation(() => {});
});

/** A first start, its welcome on screen and holding focus. */
async function firstStart() {
  const app = await bootApp();
  await app.ready;
  await vi.waitFor(() => expect(app._splashFocusTrap.isActive).toBe(true));
  return app;
}

/** The editor once the welcome is put away, as an author meets it after the first start. */
async function editor() {
  const store = useStorage();
  const app = await firstStart();
  id('splash-close').click();
  expect(app._splashFocusTrap.isActive).toBe(false);
  return { app, store };
}

function press(key, target = document.activeElement ?? document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

/** The body's children that are inert, by id or tag. */
const inertChildren = () => [...document.body.children].filter(child => child.hasAttribute('inert'))
  .map(child => child.id || child.className || child.localName);

/** The body's children a dialog leaves alone: itself and the one announcer. */
const notInert = () => [...document.body.children].filter(child => !child.hasAttribute('inert'))
  .map(child => child.id || child.className || child.localName);

/** The ids of the bindings Help means to list, category by category. */
const expectedBindings = () => Object.values(getBindingsByCategory({ includeHidden: false, includeMouse: true }))
  .filter(category => category.bindings.length > 0)
  .map(category => [category.title, category.bindings.map(binding => binding.id)]);

describe('Help opens a dialog of its own (UI-06 J-01)', () => {
  test('the Help button opens #help-modal, not the splash; focus goes to its title, the page behind is inert, and Escape gives focus back to the button', async () => {
    const { app } = await editor();
    const before = inertChildren();
    const button = id('help-btn');
    button.focus();
    button.click();

    expect(isOpen('help-modal')).toBe(true);
    expect(id('splash').style.display).toBe('none');
    expect(app._helpFocusTrap.isActive).toBe(true);
    expect(app._splashFocusTrap.isActive).toBe(false);
    expect(document.activeElement).toBe(id('modal-title-help'));
    expect(id('help-modal').parentElement).toBe(document.body);
    // Everything behind it is inert but the one announcer (DEF-45).
    expect(notInert()).toEqual(['announcer', 'help-modal']);

    press('Escape');
    expect(isOpen('help-modal')).toBe(false);
    expect(app._helpFocusTrap.isActive).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(inertChildren()).toEqual(before);
  });

  test('its close button and its backdrop close it too, and give focus back', async () => {
    const { app } = await editor();
    const before = inertChildren();
    for (const close of [() => id('help-close-x').click(),
      () => id('help-modal').dispatchEvent(new MouseEvent('click', { bubbles: true }))]) {
      id('help-btn').focus();
      id('help-btn').click();
      expect(app._helpFocusTrap.isActive).toBe(true);
      close();
      expect(isOpen('help-modal')).toBe(false);
      expect(app._helpFocusTrap.isActive).toBe(false);
      expect(document.activeElement).toBe(id('help-btn'));
      expect(inertChildren()).toEqual(before);
    }
  });

  test('help:toggle opens it and closes it; `?` opens it, from another control too, and Escape goes back there', async () => {
    const { app } = await editor();
    app.eventBus.emit('help:toggle');
    expect(isOpen('help-modal')).toBe(true);
    expect(id('splash').style.display).toBe('none');
    app.eventBus.emit('help:toggle');
    expect(isOpen('help-modal')).toBe(false);
    expect(app._helpFocusTrap.isActive).toBe(false);

    press('?', document.body);
    expect(isOpen('help-modal')).toBe(true);
    expect(id('splash').style.display).toBe('none');
    press('Escape');
    expect(isOpen('help-modal')).toBe(false);

    const control = id('mode-toggle-btn');
    control.focus();
    expect(document.activeElement).toBe(control);
    expect(press('?').defaultPrevented).toBe(true);
    expect(isOpen('help-modal')).toBe(true);
    expect(document.activeElement).toBe(id('modal-title-help'));
    press('Escape');
    expect(document.activeElement).toBe(control);
  });

  test("the waypoint list's View all controls opens Help", async () => {
    const { app } = await editor();
    const viewAll = document.querySelector('#settings-help-placeholder [data-action="show-help"]');
    expect(viewAll.textContent).toMatch(/View all controls/);
    viewAll.click();
    expect(isOpen('help-modal')).toBe(true);
    expect(app._helpFocusTrap.isActive).toBe(true);
    expect(id('splash').style.display).toBe('none');
  });

  test('its four sections, in order, all open: no accordion, and "Show the welcome again" last', async () => {
    await editor();
    id('help-btn').click();
    const modal = id('help-modal');
    expect([...modal.querySelectorAll('h3')].map(heading => heading.textContent))
      .toEqual(['Keyboard shortcuts and controls', 'Mouse and pen', 'Crowds and networks', 'About']);
    expect(modal.querySelector('details, summary, .controls-accordion')).toBeNull();
    const buttons = [...modal.querySelectorAll('button')];
    expect(buttons.at(-1)).toBe(id('help-show-welcome'));
    expect(id('help-show-welcome').textContent).toBe('Show the welcome again');
    // Help speaks through the one announcer: it adds no live region of its own.
    expect(modal.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')).toHaveLength(0);
  });

  test('the shortcuts grid lists exactly the bindings Help means to list, by id, with their chords and words', async () => {
    await editor();
    id('help-btn').click();
    const grid = id('help-modal');
    const rendered = [...grid.querySelectorAll('.controls-category')].map(category => [
      category.querySelector('h4').textContent,
      [...category.querySelectorAll('.control-item')].map(row => row.dataset.bindingId),
    ]);
    expect(rendered).toEqual(expectedBindings());
    // K is hidden: J and L have rows, and no row groups them.
    expect(grid.querySelector('[data-binding-id="playPauseK"]')).toBeNull();
    for (const binding of Object.values(getBindingsByCategory({ includeHidden: false, includeMouse: true }))
      .flatMap(category => category.bindings)) {
      const row = grid.querySelector(`[data-binding-id="${binding.id}"]`);
      expect([row.querySelector('kbd').textContent, row.querySelector('span').textContent], binding.id)
        .toEqual([binding.formatted, binding.description]);
    }
    // The modifiers as this platform writes them.
    expect(grid.querySelector('[data-binding-id="addMinorWaypoint"] kbd').textContent)
      .toBe(`${MODIFIER_DISPLAY.meta}+Click`);
    expect(grid.querySelector('[data-binding-id="redo"] kbd').textContent)
      .toBe(`${MODIFIER_DISPLAY.meta}+${MODIFIER_DISPLAY.shift}+Z`);
    // `?` is the key that opens it, and says so.
    expect(grid.querySelector('[data-binding-id="showShortcuts"]').textContent).toMatch(/^\?\s*Open help$/);
  });

  test("About gives the app's own version, the licence and notices, the source, and Report a bug", async () => {
    const { app } = await editor();
    id('help-btn').click();
    // The version the build gave the app (`APP_VERSION`): version.json is not
    // published with it, so a fetch would pass here and fail live.
    expect(id('help-version').textContent).toBe(`Version ${app.appVersion}`);
    expect(globalThis.fetch.mock.calls.filter(([url]) => /version\.json/.test(String(url)))).toEqual([]);
    const about = id('help-modal').querySelector('#help-about');
    const notices = about.querySelector('a[href="THIRD_PARTY_NOTICES.txt"]');
    expect([notices.target, notices.rel, notices.textContent])
      .toEqual(['_blank', 'noopener', 'licences and third-party notices (opens in a new tab)']);
    expect(about.textContent).toMatch(/open source under the MIT licence/);
    // Its address set by the app: the shell names no other origin (tests/publicationBoundary.test.js).
    const source = about.querySelector('#help-source[href="https://github.com/djDAOjones/route-plotter"]');
    expect([source.target, source.rel, source.textContent])
      .toEqual(['_blank', 'noopener', 'Route Plotter on GitHub (opens in a new tab)']);
    expect(about.querySelector('#help-report-bug').textContent).toBe('Report a bug');
  });
});

describe("Help's hand-offs: each closes Help first, and focus comes back to the Help button", () => {
  test('Report a bug closes Help, then opens the bug report; closing that gives focus to the Help button', async () => {
    const { app } = await editor();
    const before = inertChildren();
    id('help-btn').focus();
    id('help-btn').click();
    id('help-report-bug').click();
    // Help is gone at once, its trap with it: the report does not open over it.
    expect(isOpen('help-modal')).toBe(false);
    expect(app._helpFocusTrap.isActive).toBe(false);
    await vi.waitFor(() => expect(app._diagnosticsTrap.isActive).toBe(true));
    expect(isOpen('help-modal')).toBe(false);
    expect(app._helpFocusTrap.isActive).toBe(false);
    expect(id('diagnostics-title').textContent).toBe('Report a bug');
    expect(notInert()).toEqual(['announcer', 'diagnostics-modal']);

    id('diagnostics-cancel').click();
    expect(app._diagnosticsTrap.isActive).toBe(false);
    expect(document.activeElement).toBe(id('help-btn'));
    expect(inertChildren()).toEqual(before);
  });

  test.each([
    ['the Help button', () => {
      id('help-btn').focus();
      id('help-btn').click();
    }],
    ['`?` on another control', () => {
      id('mode-toggle-btn').focus();
      press('?');
    }],
  ])('Show the welcome again, from Help opened by %s: Help closes, the welcome opens with the stored flag untouched, and its dismissal gives focus to the Help button', async (_, open) => {
    const { app, store } = await editor();
    const before = inertChildren();
    expect(store.get(SPLASH_SHOWN)).toBe('true');
    const marked = vi.spyOn(app.storageService, 'markSplashShown');
    const stored = new Map(store);
    open();
    expect(isOpen('help-modal')).toBe(true);

    id('help-show-welcome').click();
    expect(isOpen('help-modal')).toBe(false);
    expect(app._helpFocusTrap.isActive).toBe(false);
    expect(isOpen('splash')).toBe(true);
    expect(marked).not.toHaveBeenCalled();
    expect(store).toEqual(stored);
    await vi.waitFor(() => expect(app._splashFocusTrap.isActive).toBe(true));
    expect(document.activeElement).toBe(id('splash-title'));
    expect(notInert()).toEqual(['announcer', 'splash']);

    id('splash-close').click();
    await Promise.resolve();
    expect(id('splash').style.display).toBe('none');
    expect([app._helpFocusTrap.isActive, app._splashFocusTrap.isActive]).toEqual([false, false]);
    expect(document.activeElement).toBe(id('help-btn'));
    expect(inertChildren()).toEqual(before);
    expect(store.get(SPLASH_SHOWN)).toBe('true');
  });
});

describe("Help's hand-offs from Help opened over the first start's welcome (the owner's answer, 2026-10-09: \"Help on top of the welcome\")", () => {
  test("Show the welcome again: the welcome's trap starts afresh with the Help button as its return target, so its dismissal gives focus there, not to the page", async () => {
    // Codex r1 (REAL): the welcome's trap was still active beneath Help, so
    // starting it with the Help button did nothing and focus went to the page.
    const store = useStorage();
    const app = await firstStart();
    const marked = vi.spyOn(app.storageService, 'markSplashShown');
    expect(document.activeElement).toBe(id('splash-title'));
    press('?');
    expect([isOpen('help-modal'), isOpen('splash')]).toEqual([true, true]);
    expect([app._helpFocusTrap.isActive, app._splashFocusTrap.isActive]).toEqual([true, true]);

    id('help-show-welcome').click();
    await Promise.resolve();
    expect(isOpen('help-modal')).toBe(false);
    expect(app._helpFocusTrap.isActive).toBe(false);
    expect(isOpen('splash')).toBe(true);
    expect(app._splashFocusTrap.isActive).toBe(true);
    expect(document.activeElement).toBe(id('splash-title'));
    expect(notInert()).toEqual(['announcer', 'splash']);
    expect(marked).not.toHaveBeenCalled();
    expect(store.has(SPLASH_SHOWN)).toBe(false);

    id('splash-close').click();
    await Promise.resolve();
    expect(id('splash').style.display).toBe('none');
    expect([app._helpFocusTrap.isActive, app._splashFocusTrap.isActive]).toEqual([false, false]);
    expect(document.activeElement).toBe(id('help-btn'));
    expect(inertChildren()).toEqual([]);
    // Dismissed, the first start's welcome is recorded, as any dismissal records it.
    expect(marked).toHaveBeenCalledOnce();
    expect(store.get(SPLASH_SHOWN)).toBe('true');
  });

  test("Report a bug: Cancel gives focus back to the welcome's title, the welcome still open, since the Help button behind it is inert", async () => {
    // Codex r1 (ADVISORY): the one hand-off whose focus does not come back to
    // the header. Pinned as built: the welcome stays beneath, and its title
    // takes focus when no return target can.
    const store = useStorage();
    const app = await firstStart();
    const marked = vi.spyOn(app.storageService, 'markSplashShown');
    press('?');
    expect([app._helpFocusTrap.isActive, app._splashFocusTrap.isActive]).toEqual([true, true]);

    id('help-report-bug').click();
    expect(isOpen('help-modal')).toBe(false);
    expect(app._helpFocusTrap.isActive).toBe(false);
    await vi.waitFor(() => expect(app._diagnosticsTrap.isActive).toBe(true));
    expect(id('diagnostics-title').textContent).toBe('Report a bug');
    expect([isOpen('splash'), app._splashFocusTrap.isActive]).toEqual([true, true]);
    expect(notInert()).toEqual(['announcer', 'diagnostics-modal']);

    id('diagnostics-cancel').click();
    expect(app._diagnosticsTrap.isActive).toBe(false);
    expect([isOpen('splash'), app._splashFocusTrap.isActive]).toEqual([true, true]);
    expect(id('help-btn').closest('[inert]')).not.toBeNull();
    expect(document.activeElement).toBe(id('splash-title'));
    expect(notInert()).toEqual(['announcer', 'splash']);
    expect(marked).not.toHaveBeenCalled();
    expect(store.has(SPLASH_SHOWN)).toBe(false);

    // The welcome then closes as any first start's does: recorded, nothing left inert.
    id('splash-close').click();
    expect(id('splash').style.display).toBe('none');
    expect(app._splashFocusTrap.isActive).toBe(false);
    expect(marked).toHaveBeenCalledOnce();
    expect(inertChildren()).toEqual([]);
  });
});

describe('the welcome is for the first start (UI-06 J-01)', () => {
  test('a first start shows it, with its three short sections and Get started, and no checkbox or shortcuts', async () => {
    useStorage();
    await firstStart();
    const splash = id('splash');
    expect(isOpen('splash')).toBe(true);
    expect([...splash.querySelectorAll('.help-section h3')].map(heading => heading.textContent))
      .toEqual(['Create your route', 'Edit points', 'Preview and export']);
    expect(id('splash-close').textContent).toBe('Get started');
    expect(id('splash-dont-show')).toBeNull();
    expect(splash.querySelector('input[type="checkbox"]')).toBeNull();
    expect(splash.querySelector('details, summary, .controls-accordion, .control-item')).toBeNull();
  });

  test("`?` on the first start's welcome opens Help over it; closing Help gives focus back to the welcome, still open and not yet recorded", async () => {
    // The owner's answer, 2026-10-09: "Help on top of the welcome". The traps stack (PR 4).
    const store = useStorage();
    const app = await firstStart();
    const marked = vi.spyOn(app.storageService, 'markSplashShown');
    expect(document.activeElement).toBe(id('splash-title'));

    expect(press('?').defaultPrevented).toBe(true);
    expect([isOpen('help-modal'), isOpen('splash')]).toEqual([true, true]);
    expect([app._helpFocusTrap.isActive, app._splashFocusTrap.isActive]).toEqual([true, true]);
    expect(document.activeElement).toBe(id('modal-title-help'));
    expect(notInert()).toEqual(['announcer', 'help-modal']);

    press('Escape');
    expect([isOpen('help-modal'), isOpen('splash')]).toEqual([false, true]);
    expect([app._helpFocusTrap.isActive, app._splashFocusTrap.isActive]).toEqual([false, true]);
    expect(document.activeElement).toBe(id('splash-title'));
    expect(notInert()).toEqual(['announcer', 'splash']);
    expect(marked).not.toHaveBeenCalled();
    expect(store.has(SPLASH_SHOWN)).toBe(false);

    // The welcome then closes as any first start's does: recorded, nothing left inert.
    id('splash-close').click();
    expect(id('splash').style.display).toBe('none');
    expect(app._splashFocusTrap.isActive).toBe(false);
    expect(marked).toHaveBeenCalledOnce();
    expect(inertChildren()).toEqual([]);
  });

  test.each([
    ['Get started', () => id('splash-close').click()],
    ['its close button', () => id('splash-close-x').click()],
    ['a click on its backdrop', () => id('splash').dispatchEvent(new MouseEvent('click', { bubbles: true }))],
    ['Escape', () => press('Escape')],
  ])('dismissed by %s, it records that it was seen, and the next start does not show it', async (_, dismiss) => {
    const store = useStorage();
    const first = await firstStart();
    const marked = vi.spyOn(first.storageService, 'markSplashShown');
    dismiss();
    expect(id('splash').style.display).toBe('none');
    expect(marked).toHaveBeenCalledOnce();
    expect(store.get(SPLASH_SHOWN)).toBe('true');

    const second = await bootApp();
    await second.ready;
    await Promise.resolve();
    expect(id('splash').style.display).toBe('none');
    expect(second._splashFocusTrap.isActive).toBe(false);
    expect(inertChildren()).toEqual([]);
  });
});

describe("the grid's modifiers are this platform's (UI-06 J-17)", () => {
  // Last in the file: the content module is loaded afresh for each platform,
  // after every boot here has its own.
  test.each([['MacIntel', '⌘', '⌥'], ['Win32', 'Ctrl', 'Alt']])('on %s, %s and %s', async (platform, meta, alt) => {
    vi.resetModules();
    Object.defineProperty(navigator, 'platform', { value: platform, configurable: true });
    try {
      const { getHelpDialogHTML } = await import('../src/config/helpContent.js');
      const host = document.createElement('div');
      host.innerHTML = getHelpDialogHTML();
      expect(host.querySelector('[data-binding-id="addMinorWaypoint"] kbd').textContent).toBe(`${meta}+Click`);
      expect(host.querySelector('[data-binding-id="forceAddWaypoint"] kbd').textContent).toBe(`${alt}+Click`);
      expect(host.querySelector('[data-binding-id="redo"] kbd').textContent).toBe(`${meta}+⇧+Z`);
    } finally {
      delete navigator.platform;
    }
  });
});
