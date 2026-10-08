/**
 * DEF-32 — activating a waypoint row keeps keyboard focus on that row.
 *
 * A row is a native button, so Enter and Space on a focused row send it a
 * click, as a mouse does. The click selects the row's waypoint through the
 * bus; the app answers by rebuilding the list, which takes the focused row
 * away, and gives focus back to the selected waypoint's new row a frame
 * later. The row then rebuilt the list a second time itself: that replaced the
 * row the frame was to focus, and, finding focus already gone from the list,
 * queued no frame of its own, so focus fell to the page after every
 * activation (WCAG 2.2 2.4.3 Focus Order; a keyboard user lost their place).
 *
 * Booted as a user meets the editor; the route is authored through the bus,
 * and only the activation goes through the DOM.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { localStorageMock } from './setup.js';

const running = [];

beforeEach(() => {
  localStorageMock.getItem.mockImplementation(() => null);
});

afterEach(() => {
  // bootApp stops each app, but its key listener stays on `document`.
  for (const app of running.splice(0)) app.interactionHandler.destroy();
  vi.restoreAllMocks();
});

/** A booted editor, Help closed, with a three-major route and nothing selected. */
async function editor() {
  const app = await bootApp();
  running.push(app);
  await app.ready;
  // A first run opens Help, whose focus trap holds the keyboard.
  document.getElementById('splash-close').click();
  await vi.waitFor(() => expect(app.background.image).toBeTruthy());
  for (const imgX of [0.25, 0.5, 0.75]) app.eventBus.emit('waypoint:add', { imgX, imgY: 0.5, isMajor: true });
  app.eventBus.emit('waypoint:deselected');
  document.activeElement?.blur();
  return app;
}

/** The row button standing for the waypoint at `index` in the route now. */
const row = index =>
  document.querySelector(`#waypoint-list .waypoint-item[data-route-index="${index}"] .waypoint-row`);

/** Wait one animation frame, as the list's focus restore does. */
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));

/** Where focus is, by the route row it is on, or `the page`. */
function focusName() {
  const active = document.activeElement;
  if (!active || active === document.body) return 'the page';
  const item = active.closest('#waypoint-list .waypoint-item');
  return item && active.classList.contains('waypoint-row')
    ? `row ${Number(item.dataset.routeIndex) + 1}` : (active.id ? `#${active.id}` : active.tagName);
}

describe('activating a waypoint row (DEF-32)', () => {
  test('Enter or Space on a focused row selects its waypoint and leaves focus on that row', async () => {
    const app = await editor();
    const steps = [];
    // No row twice in a row: two clicks on one row within 400 ms rename it.
    for (const index of [0, 2, 1]) {
      const pressed = row(index);
      pressed.focus();
      // What Enter and Space send a focused button.
      pressed.click();
      await frame();
      const selected = app.waypoints.indexOf(app.selectedWaypoint) + 1;
      steps.push(`row ${index + 1}: selected ${selected}, pressed ${row(index).getAttribute('aria-pressed')}, ` +
        `focus on ${focusName()}${document.activeElement === pressed ? ' (the row as pressed)' : ''}`);
    }
    // The row pressed is rebuilt, so focus is on its replacement.
    expect(steps).toEqual([
      'row 1: selected 1, pressed true, focus on row 1',
      'row 3: selected 3, pressed true, focus on row 3',
      'row 2: selected 2, pressed true, focus on row 2'
    ]);
  });

  test('focus the user moves out of the list before the frame stays where they put it', async () => {
    await editor();
    row(2).focus();
    row(2).click();
    // The inspector opened for the waypoint; the user moves on at once.
    const field = document.getElementById('dot-size');
    field.focus();
    await frame();
    expect(document.activeElement).toBe(field);
  });
});
