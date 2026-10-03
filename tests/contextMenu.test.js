/**
 * TST-14 — the context menu's contract, pinned as it stands.
 *
 * `ContextMenu` is the canvas's right-click menu (a waypoint's actions, and
 * adding a waypoint on the map), and it had no test. Its header promises
 * Carbon's menu anatomy, keyboard navigation, closing on a press outside, a
 * scroll, a resize or the window losing focus, disabled items a screen reader
 * can still reach, focus given back on close, and a position clamped into the
 * viewport. Each is checked here on the component itself, and then through a
 * right-click on the booted app's canvas, the only way the app opens it.
 *
 * jsdom lays nothing out, and does not turn Enter or Space on a focused button
 * into a click as a browser does. So where placement is the question the menu
 * is given the size a browser would measure, and keyboard activation is pinned
 * as far as it is the menu's own: its items are native buttons, it leaves
 * Enter and Space uncancelled so the browser's activation runs, and a click
 * activates. That a real Enter or Space reaches the click stays browser
 * evidence.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { ContextMenu } from '../src/components/ContextMenu.js';

const menus = [];
const cleanups = [];

afterEach(() => {
  // A menu left open keeps its listeners on the shared document and would
  // swallow the next test's keys, so every one is closed.
  for (const menu of menus.splice(0)) {
    menu.hide({ restoreFocus: false });
    menu.menu.remove();
  }
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.innerHTML = '';
});

function newMenu() {
  const menu = new ContextMenu();
  menus.push(menu);
  return menu;
}

/** The waypoint menu as the app builds it, with a spy for each action. */
function waypointItems() {
  const actions = { rename: vi.fn(), convert: vi.fn(), insert: vi.fn(), remove: vi.fn() };
  const items = [
    { label: 'Rename', action: actions.rename },
    {
      label: 'Convert to minor waypoint',
      disabled: true,
      disabledReason: 'The route needs at least one major waypoint',
      action: actions.convert
    },
    { label: 'Insert waypoint after', action: actions.insert },
    { label: 'Delete waypoint', danger: true, separatorBefore: true, action: actions.remove }
  ];
  return { items, actions };
}

/** A control holding focus before the menu opens, as the author's last one would. */
function focusedControl() {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = 'Last control used';
  document.body.appendChild(control);
  control.focus();
  return control;
}

/** The waypoint menu, opened over a focused control. */
function openWaypointMenu() {
  const before = focusedControl();
  const menu = newMenu();
  const { items, actions } = waypointItems();
  menu.show({ x: 40, y: 60, items, ariaLabel: 'Waypoint actions' });
  return { menu, before, actions };
}

const itemsOf = menu => [...menu.menu.querySelectorAll('[role="menuitem"]')];
const labelsOf = menu => itemsOf(menu).map(item => item.textContent);
const itemCalled = (menu, label) => itemsOf(menu).find(item => item.textContent === label);
const focusedLabel = () => document.activeElement?.textContent;

/** A key pressed on whatever has focus, as a browser dispatches it. */
function press(key, init = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  document.activeElement.dispatchEvent(event);
  return event;
}

/** The keys that reach the page's shortcuts, which listen on the document as a key bubbles. */
function keysReachingThePage() {
  const seen = [];
  const listener = event => seen.push(event.key);
  document.addEventListener('keydown', listener);
  cleanups.push(() => document.removeEventListener('keydown', listener));
  return seen;
}

/** A scrolling panel, such as the sidebar. Its scroll events do not bubble. */
function scrollingPanel() {
  const panel = document.createElement('div');
  document.body.appendChild(panel);
  return panel;
}

/** jsdom lays nothing out: the menu measures as a browser would, and records when. */
function measureAs(menu, width, height) {
  const measured = [];
  const spy = vi.spyOn(menu.menu, 'getBoundingClientRect').mockImplementation(() => {
    measured.push({ display: menu.menu.style.display, visibility: menu.menu.style.visibility });
    return { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0 };
  });
  cleanups.push(() => spy.mockRestore());
  return measured;
}

/** The viewport the menu is clamped into, put back after the test. */
function setViewport(width, height) {
  for (const [name, value] of [['innerWidth', width], ['innerHeight', height]]) {
    const original = Object.getOwnPropertyDescriptor(window, name);
    Object.defineProperty(window, name, { configurable: true, writable: true, value });
    cleanups.push(() => {
      if (original) Object.defineProperty(window, name, original);
      else delete window[name];
    });
  }
}

/**
 * What is listening to the page: the listeners added to the document and the
 * window since this was called, less those removed. A listener added twice is
 * one, as in the DOM.
 */
function watchPageListeners() {
  const live = [];
  const inCapture = options => (typeof options === 'boolean' ? options : Boolean(options?.capture));
  for (const [name, target] of [['document', document], ['window', window]]) {
    const add = target.addEventListener;
    const remove = target.removeEventListener;
    const entryFor = (type, listener, options) => ({ name, type, listener, capture: inCapture(options) });
    const same = (a, b) => a.name === b.name && a.type === b.type && a.listener === b.listener && a.capture === b.capture;
    const addSpy = vi.spyOn(target, 'addEventListener').mockImplementation(function (type, listener, options) {
      const entry = entryFor(type, listener, options);
      if (!live.some(other => same(other, entry))) live.push(entry);
      return add.call(this, type, listener, options);
    });
    const removeSpy = vi.spyOn(target, 'removeEventListener').mockImplementation(function (type, listener, options) {
      const entry = entryFor(type, listener, options);
      const index = live.findIndex(other => same(other, entry));
      if (index !== -1) live.splice(index, 1);
      return remove.call(this, type, listener, options);
    });
    cleanups.push(() => {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  }
  return () => live.map(({ name, type, capture }) => `${name} ${type}${capture ? ' (capture)' : ''}`).sort();
}

/** While open: presses and keys, caught on the document before their target sees them, and the window's blur, scroll and resize. */
const OPEN_LISTENERS = [
  'document keydown (capture)',
  'document pointerdown (capture)',
  'window blur',
  'window resize',
  'window scroll (capture)'
];

/** Every way the menu closes, short of choosing an item or a call to hide(). */
const CLOSINGS = [
  ['a press outside', () => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))],
  ['a scroll of the page', () => window.dispatchEvent(new Event('scroll'))],
  ['a scroll inside a panel', () => scrollingPanel().dispatchEvent(new Event('scroll'))],
  ['a resize', () => window.dispatchEvent(new Event('resize'))],
  ['the window losing focus', () => window.dispatchEvent(new Event('blur'))],
  ['Escape', () => press('Escape')],
  ['Tab', () => press('Tab')]
];

describe('the menu\'s anatomy', () => {
  test('one hidden list with role=menu is made once and kept on the page', () => {
    const menu = newMenu();

    expect(menu.menu.tagName).toBe('UL');
    expect(menu.menu.getAttribute('role')).toBe('menu');
    expect(menu.menu.className).toBe('context-menu');
    expect(menu.menu.parentElement).toBe(document.body);
    expect(menu.menu.style.display).toBe('none');
    expect(menu.isOpen).toBe(false);
  });

  test('each item is a native button with role=menuitem, in a list item that is only presentation', () => {
    const { menu } = openWaypointMenu();

    expect([...menu.menu.children].map(row => row.getAttribute('role')))
      .toEqual(['presentation', 'presentation', 'presentation', 'separator', 'presentation']);
    expect(labelsOf(menu)).toEqual(['Rename', 'Convert to minor waypoint', 'Insert waypoint after', 'Delete waypoint']);
    for (const item of itemsOf(menu)) {
      expect(item.tagName).toBe('BUTTON');
      expect(item.type).toBe('button');
      expect(item.classList.contains('context-menu-item')).toBe(true);
      expect(item.parentElement.getAttribute('role')).toBe('presentation');
    }
  });

  test('a separator comes before the item that asks for one, and only the dangerous item is marked', () => {
    const { menu } = openWaypointMenu();
    const remove = itemCalled(menu, 'Delete waypoint');
    const separator = remove.parentElement.previousElementSibling;

    expect(separator.getAttribute('role')).toBe('separator');
    expect(separator.className).toBe('context-menu-separator');
    expect(itemsOf(menu).filter(item => item.classList.contains('is-danger'))).toEqual([remove]);
  });

  test('the menu is named by the label it is given, or "Context menu" without one', () => {
    const { menu } = openWaypointMenu();
    expect(menu.menu.getAttribute('aria-label')).toBe('Waypoint actions');

    menu.show({ x: 40, y: 60, items: [{ label: 'Add waypoint here' }] });
    expect(menu.menu.getAttribute('aria-label')).toBe('Context menu');
  });

  test('a label is shown as text, never read as markup', () => {
    const menu = newMenu();
    const label = '<img src="x" onerror="window.menuLabelRan = true">Rename';

    menu.show({ x: 40, y: 60, items: [{ label }] });

    expect(itemsOf(menu)[0].textContent).toBe(label);
    expect(menu.menu.querySelector('img')).toBeNull();
  });
});

describe('where the menu opens', () => {
  test('it opens at the pointer when it fits, measured while invisible and then shown', () => {
    setViewport(800, 600);
    const menu = newMenu();
    const measured = measureAs(menu, 200, 150);

    menu.show({ x: 100, y: 120, items: waypointItems().items });

    expect([menu.menu.style.left, menu.menu.style.top]).toEqual(['100px', '120px']);
    expect(measured).toEqual([{ display: 'block', visibility: 'hidden' }]);
    expect([menu.menu.style.display, menu.menu.style.visibility]).toEqual(['block', '']);
  });

  test('near the right and bottom edges it is pulled back to 8px inside the viewport', () => {
    setViewport(800, 600);
    const menu = newMenu();
    measureAs(menu, 200, 150);

    menu.show({ x: 700, y: 500, items: waypointItems().items });

    // 800 - 200 - 8 across, and 600 - 150 - 8 down.
    expect([menu.menu.style.left, menu.menu.style.top]).toEqual(['592px', '442px']);
  });

  test('it never starts within 8px of the left or top edge, even when taller than the viewport', () => {
    setViewport(800, 600);
    const menu = newMenu();
    measureAs(menu, 200, 150);
    menu.show({ x: 3, y: 5, items: waypointItems().items });
    expect([menu.menu.style.left, menu.menu.style.top]).toEqual(['8px', '8px']);

    // Too tall to fit, it keeps its top edge in view and runs off the bottom.
    const tall = newMenu();
    measureAs(tall, 200, 700);
    tall.show({ x: 100, y: 300, items: waypointItems().items });
    expect([tall.menu.style.left, tall.menu.style.top]).toEqual(['100px', '8px']);
  });
});

describe('the keyboard', () => {
  test('opening puts focus on the first item', () => {
    openWaypointMenu();

    expect(focusedLabel()).toBe('Rename');
  });

  test('the arrow keys move through every item, a disabled one too, and wrap at both ends', () => {
    const { menu } = openWaypointMenu();
    const visited = [];
    for (let step = 0; step < 4; step += 1) {
      press('ArrowDown');
      visited.push(focusedLabel());
    }
    expect(visited).toEqual(['Convert to minor waypoint', 'Insert waypoint after', 'Delete waypoint', 'Rename']);

    press('ArrowUp');
    expect(focusedLabel()).toBe('Delete waypoint');
    press('ArrowUp');
    expect(focusedLabel()).toBe('Insert waypoint after');
    expect(menu.isOpen).toBe(true);
  });

  test('Home and End go to the first and the last item', () => {
    openWaypointMenu();

    press('End');
    expect(focusedLabel()).toBe('Delete waypoint');
    press('Home');
    expect(focusedLabel()).toBe('Rename');
  });

  test('the keys that move through the menu neither scroll the page nor reach its shortcuts', () => {
    openWaypointMenu();
    const page = keysReachingThePage();

    const cancelled = ['ArrowDown', 'ArrowUp', 'Home', 'End'].map(key => press(key).defaultPrevented);

    expect(cancelled).toEqual([true, true, true, true]);
    expect(page).toEqual([]);
  });

  test('Escape closes the menu, gives focus back, and does not reach the page', () => {
    const { menu, before } = openWaypointMenu();
    const page = keysReachingThePage();

    const escape = press('Escape');

    expect(menu.isOpen).toBe(false);
    expect(document.activeElement).toBe(before);
    expect(escape.defaultPrevented).toBe(true);
    expect(page).toEqual([]);
  });

  test('Enter and Space are left for the browser to activate the focused button, and do not reach the page', () => {
    const { menu } = openWaypointMenu();
    const page = keysReachingThePage();

    // A native button turns an uncancelled Enter or Space into a click.
    expect(document.activeElement.tagName).toBe('BUTTON');
    expect(press('Enter').defaultPrevented).toBe(false);
    expect(press(' ').defaultPrevented).toBe(false);
    expect(page).toEqual([]);
    expect(menu.isOpen).toBe(true);
  });

  test('any other key is kept from the page\'s shortcuts but not cancelled', () => {
    const { menu } = openWaypointMenu();
    const page = keysReachingThePage();

    const events = [press('Delete'), press('k'), press('z', { metaKey: true })];

    expect(events.map(event => event.defaultPrevented)).toEqual([false, false, false]);
    expect(page).toEqual([]);
    expect(menu.isOpen).toBe(true);
  });

  test('Tab closes the menu instead of trapping focus, and leaves the browser to move focus on', () => {
    const { menu, before } = openWaypointMenu();

    const tab = press('Tab');

    expect(menu.isOpen).toBe(false);
    expect(document.activeElement).toBe(before);
    expect(tab.defaultPrevented).toBe(false);
  });
});

describe('choosing an item', () => {
  test('a click closes the menu, then runs the item\'s action once', () => {
    const { menu, actions } = openWaypointMenu();
    let openDuringAction = null;
    actions.insert.mockImplementation(() => { openDuringAction = menu.isOpen; });

    itemCalled(menu, 'Insert waypoint after').click();

    expect(actions.insert).toHaveBeenCalledTimes(1);
    expect(openDuringAction).toBe(false);
    expect(menu.isOpen).toBe(false);
    expect(menu.menu.children).toHaveLength(0);
    expect([actions.rename, actions.convert, actions.remove].map(action => action.mock.calls.length)).toEqual([0, 0, 0]);
  });

  test('a disabled item stays focusable and says why, and a click on it does nothing', () => {
    const { menu, actions } = openWaypointMenu();
    const convert = itemCalled(menu, 'Convert to minor waypoint');

    expect(convert.getAttribute('aria-disabled')).toBe('true');
    expect(convert.hasAttribute('disabled')).toBe(false);
    expect(convert.title).toBe('The route needs at least one major waypoint');
    convert.focus();
    expect(document.activeElement).toBe(convert);

    convert.click();

    expect(actions.convert).not.toHaveBeenCalled();
    expect(menu.isOpen).toBe(true);
  });

  test('choosing an item does not give focus back, so an action that moves none leaves it on the page', () => {
    const { menu, before } = openWaypointMenu();
    // Pinned as it stands. The header's "focus returns on close" holds for
    // every other way of closing; a chosen item closes the menu without it,
    // and goes with the menu, so focus falls to the page.
    itemCalled(menu, 'Insert waypoint after').click();
    expect(document.activeElement).toBe(document.body);

    const elsewhere = focusedControl();
    before.focus();
    menu.show({ x: 40, y: 60, items: [{ label: 'Rename', action: () => elsewhere.focus() }] });
    itemsOf(menu)[0].click();
    expect(document.activeElement).toBe(elsewhere);
  });
});

describe('closing', () => {
  test.each(CLOSINGS)('%s closes the menu and gives focus back', (_, close) => {
    const { menu, before } = openWaypointMenu();

    close();

    expect(menu.isOpen).toBe(false);
    expect(document.activeElement).toBe(before);
  });

  test('a press inside the menu leaves it open, so the click that follows can land', () => {
    const { menu } = openWaypointMenu();

    itemCalled(menu, 'Rename').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(menu.isOpen).toBe(true);
  });

  test('after a press outside, the next menu still gives focus back to where it was before the first', () => {
    const { menu, before } = openWaypointMenu();

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    menu.show({ x: 300, y: 200, items: waypointItems().items });
    press('Escape');

    expect(document.activeElement).toBe(before);
  });

  test('focus is not forced back to a control that has left the page', () => {
    const { menu, before } = openWaypointMenu();
    before.remove();

    expect(() => press('Escape')).not.toThrow();
    expect(menu.isOpen).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });
});

describe('what the menu listens to', () => {
  const allClosings = [
    ...CLOSINGS,
    ['choosing an item', menu => itemCalled(menu, 'Rename').click()],
    ['hide()', menu => menu.hide()]
  ];

  test.each(allClosings)('closing by %s leaves nothing listening to the page', (_, close) => {
    const listening = watchPageListeners();
    const { menu } = openWaypointMenu();
    expect(listening()).toEqual(OPEN_LISTENERS);

    close(menu);

    expect(menu.isOpen).toBe(false);
    expect(listening()).toEqual([]);
  });

  test('a menu opened again, or over itself, moves one item per arrow key and listens once', () => {
    const listening = watchPageListeners();
    const { menu } = openWaypointMenu();

    press('Escape');
    menu.show({ x: 40, y: 60, items: waypointItems().items });
    press('ArrowDown');
    expect(focusedLabel()).toBe('Convert to minor waypoint');

    menu.show({ x: 80, y: 90, items: waypointItems().items });
    expect(labelsOf(menu)).toEqual(['Rename', 'Convert to minor waypoint', 'Insert waypoint after', 'Delete waypoint']);
    press('ArrowDown');
    expect(focusedLabel()).toBe('Convert to minor waypoint');
    expect(listening()).toEqual(OPEN_LISTENERS);
  });

  test('once the menu has closed, keys reach the page again', () => {
    openWaypointMenu();
    const page = keysReachingThePage();

    press('k');
    expect(page).toEqual([]);
    press('Escape');
    press('k');
    expect(page).toEqual(['k']);
  });
});

describe('the menu in the booted app', () => {
  const booted = [];

  afterEach(() => {
    // An app's keyboard handler stays on the shared document after its test,
    // and would take the next app's keys first.
    for (const app of booted.splice(0)) app.interactionHandler.destroy();
  });

  /** Booted, with its background in and the first-run splash, which traps focus, closed. */
  async function bootedApp() {
    const app = await bootApp();
    booted.push(app);
    await app.ready;
    await vi.waitFor(() => expect(app.background.image).toBeTruthy());
    document.getElementById('splash-close').click();
    return app;
  }

  /** A right-click at an image position, delivered to the canvas as a browser delivers it. */
  function rightClick(app, imgX, imgY) {
    const { x, y } = app.imageToScreen(imgX, imgY);
    const event = new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, button: 2, clientX: x, clientY: y
    });
    app.canvas.dispatchEvent(event);
    return event;
  }

  /** The app's one menu, closed after the test like the others. */
  function appMenu(app) {
    const menu = app._contextMenu;
    if (menu && !menus.includes(menu)) menus.push(menu);
    return menu;
  }

  async function appWithTwoWaypoints() {
    const app = await bootedApp();
    app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
    return app;
  }

  test('a right-click on a waypoint selects it and opens its actions, holding back the browser\'s own menu', async () => {
    const app = await appWithTwoWaypoints();
    const [first] = app.waypoints;

    const event = rightClick(app, first.imgX, first.imgY);
    const menu = appMenu(app);

    expect(event.defaultPrevented).toBe(true);
    expect(menu.isOpen).toBe(true);
    expect(menu.menu.getAttribute('aria-label')).toBe('Waypoint actions');
    expect(labelsOf(menu)).toEqual([
      'Rename', 'Convert to minor waypoint', 'Insert waypoint before', 'Insert waypoint after', 'Delete waypoint'
    ]);
    expect(itemsOf(menu).filter(item => item.classList.contains('is-danger')).map(item => item.textContent))
      .toEqual(['Delete waypoint']);
    expect(focusedLabel()).toBe('Rename');
    expect(app.selectedWaypoint).toBe(first);
  });

  test('while the menu is open the app\'s shortcuts wait, and Escape closes it without deselecting', async () => {
    const app = await appWithTwoWaypoints();
    const [first, second] = app.waypoints;
    rightClick(app, first.imgX, first.imgY);
    const menu = appMenu(app);

    // Delete, convert, add at the centre, undo: none may act under the menu.
    for (const [key, init] of [['Delete'], ['Backspace'], ['t'], ['a'], ['z', { metaKey: true }]]) press(key, init);

    expect(app.waypoints).toEqual([first, second]);
    expect(app.waypoints.map(waypoint => waypoint.isMajor)).toEqual([true, true]);
    expect(menu.isOpen).toBe(true);

    press('Escape');
    expect(menu.isOpen).toBe(false);
    expect(app.selectedWaypoint).toBe(first);

    // Closed, the same key reaches the app again, so the wait above was real.
    press('Delete');
    expect(app.waypoints).toEqual([second]);
  });

  test('Delete waypoint, reached with End, deletes the waypoint that was right-clicked', async () => {
    const app = await appWithTwoWaypoints();
    const [first, second] = app.waypoints;
    rightClick(app, first.imgX, first.imgY);
    const menu = appMenu(app);

    press('End');
    expect(focusedLabel()).toBe('Delete waypoint');
    // What Enter on the focused button does in a browser.
    document.activeElement.click();

    expect(menu.isOpen).toBe(false);
    expect(app.waypoints).toEqual([second]);
  });

  test('a right-click on the map offers to add a waypoint there, and a minor one only once a route exists', async () => {
    const app = await bootedApp();

    // Off the centre, with x and y apart, so a waypoint put anywhere but where
    // the right-click landed shows.
    rightClick(app, 0.3, 0.7);
    const menu = appMenu(app);
    expect(menu.menu.getAttribute('aria-label')).toBe('Canvas actions');
    expect(labelsOf(menu)).toEqual(['Add waypoint here', 'Add minor waypoint here']);
    const minor = itemCalled(menu, 'Add minor waypoint here');
    expect(minor.getAttribute('aria-disabled')).toBe('true');
    expect(minor.title).toBe('Minor waypoints shape a leg — add a waypoint first');
    minor.click();
    expect(app.waypoints).toEqual([]);
    expect(menu.isOpen).toBe(true);

    itemCalled(menu, 'Add waypoint here').click();
    expect(menu.isOpen).toBe(false);
    expect(app.waypoints).toHaveLength(1);
    const [first] = app.waypoints;
    expect(first.isMajor).toBe(true);
    expect(first.imgX).toBeCloseTo(0.3, 3);
    expect(first.imgY).toBeCloseTo(0.7, 3);

    // The route's only major waypoint cannot be made minor from its own menu.
    rightClick(app, first.imgX, first.imgY);
    expect(menu.menu.getAttribute('aria-label')).toBe('Waypoint actions');
    const convert = itemCalled(menu, 'Convert to minor waypoint');
    expect(convert.getAttribute('aria-disabled')).toBe('true');
    expect(convert.title).toBe('The route needs at least one major waypoint');
    convert.click();
    expect(first.isMajor).toBe(true);
    expect(menu.isOpen).toBe(true);
    press('Escape');

    // With a route, the map's menu offers a minor waypoint too, and puts it
    // where the right-click landed.
    rightClick(app, 0.8, 0.25);
    expect(menu.menu.getAttribute('aria-label')).toBe('Canvas actions');
    const enabledMinor = itemCalled(menu, 'Add minor waypoint here');
    expect(enabledMinor.getAttribute('aria-disabled')).toBeNull();
    expect(enabledMinor.title).toBe('');
    enabledMinor.click();
    expect(menu.isOpen).toBe(false);
    expect(app.waypoints).toHaveLength(2);
    const added = app.waypoints.find(waypoint => waypoint !== first);
    expect(added.isMajor).toBe(false);
    expect(added.imgX).toBeCloseTo(0.8, 3);
    expect(added.imgY).toBeCloseTo(0.25, 3);
  });

  test('the waypoint menu\'s other items act on the waypoint that was right-clicked', async () => {
    const app = await appWithTwoWaypoints();
    const [first, second] = app.waypoints;

    // Insert before the second: a major waypoint halfway back to the first.
    rightClick(app, second.imgX, second.imgY);
    const menu = appMenu(app);
    itemCalled(menu, 'Insert waypoint before').click();
    expect(app.waypoints).toHaveLength(3);
    const middle = app.waypoints[1];
    expect(app.waypoints).toEqual([first, middle, second]);
    expect(middle.isMajor).toBe(true);
    expect(middle.imgX).toBeCloseTo(0.5, 3);
    expect(middle.imgY).toBeCloseTo(0.5, 3);

    // Insert after the first: halfway on to the waypoint after it.
    rightClick(app, first.imgX, first.imgY);
    itemCalled(menu, 'Insert waypoint after').click();
    expect(app.waypoints).toHaveLength(4);
    const early = app.waypoints[1];
    expect(app.waypoints).toEqual([first, early, middle, second]);
    expect(early.isMajor).toBe(true);
    expect(early.imgX).toBeCloseTo(0.375, 3);
    expect(early.imgY).toBeCloseTo(0.5, 3);

    // With other major waypoints left, conversion is offered, and converts
    // only this one.
    rightClick(app, middle.imgX, middle.imgY);
    const convert = itemCalled(menu, 'Convert to minor waypoint');
    expect(convert.getAttribute('aria-disabled')).toBeNull();
    convert.click();
    expect(app.waypoints.map(waypoint => waypoint.isMajor)).toEqual([true, true, false, true]);

    // Rename opens this waypoint's name for editing, in its row of the list,
    // a frame later.
    rightClick(app, second.imgX, second.imgY);
    itemCalled(menu, 'Rename').click();
    await vi.waitFor(
      () => expect(document.activeElement.classList.contains('waypoint-rename-input')).toBe(true),
      { timeout: 3000 }
    );
    const row = document.activeElement.closest('.waypoint-item');
    expect(row.dataset.routeIndex).toBe(String(app.waypoints.indexOf(second)));
    press('Escape');
  });
});
