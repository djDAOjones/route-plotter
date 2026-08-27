/**
 * UI-02: the sidebar waypoint list shows the whole route.
 *
 * Contract under test:
 * - every waypoint gets a row, minors indented under the major whose leg
 *   they shape, numbered `major.minor` by the shared route numbering
 * - a minor is selectable and renameable exactly like a major
 * - a minor is reorder-*visible*, not reorder-*able*: it owns no ▲/▼ and is
 *   not draggable, because reorderWaypointBlocks moves it with its major
 *   (the 2026-08-18 data bug — rebuilding majors in place silently
 *   reattached minors to different legs)
 * - the majors-only `waypoints:reordered` payload is unchanged
 *
 * Drag-and-drop itself is jsdom-hostile (no real DataTransfer geometry), so
 * the block helpers are exercised directly and the gesture is live-verified.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { UIController } from '../src/controllers/UIController.js';

function inspectorMarkup() {
  document.body.innerHTML = `
    <div id="scope-chip" data-scope="route">
      <button id="scope-prev-btn" type="button"></button>
      <span id="scope-chip-text">Editing · Route</span>
      <button id="scope-route-btn" type="button"></button>
      <button id="scope-next-btn" type="button"></button>
    </div>
    <h2 id="leg-section-title">Leg</h2>
    <ul id="waypoint-list"></ul>
  `;
}

const major = name => Object.assign(Waypoint.createMajor(0.5, 0.5), name ? { name } : {});
const minor = name => Object.assign(Waypoint.createMinor(0.5, 0.5), name ? { name } : {});

describe('UI-02 waypoint list', () => {
  let listEl;
  let bus;
  let ui;
  let route;

  beforeEach(() => {
    inspectorMarkup();
    listEl = document.getElementById('waypoint-list');
    bus = new EventBus();
    ui = new UIController({ waypointList: listEl }, bus);
    // Waypoint 1 · minor 1.1 · minor 1.2 · Waypoint 2 · minor 2.1 · Waypoint 3
    route = [major(), minor(), minor(), major(), minor(), major()];
  });

  const rows = () => [...listEl.querySelectorAll('.waypoint-item')]
    .filter(item => !item.querySelector('.waypoint-add-btn'));
  const titles = () => rows().map(item => item.querySelector('.waypoint-title').textContent);

  test('renders a row for every waypoint, not just the majors', () => {
    ui.updateWaypointList(route);

    expect(rows()).toHaveLength(6);
    expect(titles()).toEqual([
      'Waypoint 1', 'Waypoint 1.1', 'Waypoint 1.2',
      'Waypoint 2', 'Waypoint 2.1',
      'Waypoint 3',
    ]);
  });

  test('minor rows are marked as minors and majors are not', () => {
    ui.updateWaypointList(route);

    expect(rows().map(item => item.classList.contains('waypoint-item-minor')))
      .toEqual([false, true, true, false, true, false]);
  });

  test('the minor hierarchy is written out, not left to the indent', () => {
    ui.updateWaypointList(route);
    const minorRow = rows()[1];

    // Visible tag …
    expect(minorRow.querySelector('.waypoint-minor-tag').textContent).toBe('minor');
    // … plus the relationship for anyone who cannot perceive the indent
    expect(minorRow.querySelector('.waypoint-row .sr-only').textContent)
      .toContain('minor waypoint shaping the leg after waypoint 1');
  });

  test('a minor stranded before every major names its position honestly', () => {
    ui.updateWaypointList([minor(), major()]);

    expect(titles()).toEqual(['Waypoint 0.1', 'Waypoint 1']);
    expect(rows()[0].querySelector('.waypoint-row .sr-only').textContent)
      .toContain('before waypoint 1');
  });

  test('an authored name replaces the numbered default on a minor', () => {
    ui.updateWaypointList([major(), minor('Curve point')]);

    expect(titles()).toEqual(['Waypoint 1', 'Curve point']);
  });

  test('clicking a minor row selects it like any other waypoint', () => {
    ui.updateWaypointList(route);
    const selected = [];
    bus.on('waypoint:selected', wp => selected.push(wp));

    rows()[1].querySelector('.waypoint-row')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selected).toEqual([route[1]]);
    expect(rows()[1].classList.contains('is-selected')).toBe(true);
    expect(rows()[1].querySelector('.waypoint-row').getAttribute('aria-pressed')).toBe('true');
  });

  test('shift-click ranges over the displayed route, minors included', () => {
    ui.updateWaypointList(route);
    const multi = [];
    bus.on('waypoint:multi-selected', payload => multi.push(payload));

    rows()[0].querySelector('.waypoint-row')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    rows()[3].querySelector('.waypoint-row')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));

    expect(multi).toHaveLength(1);
    // Rows 0..3 as the user sees them: major, minor, minor, major
    expect(multi[0].waypoints).toEqual(route.slice(0, 4));
    expect(multi[0].primary).toBe(route[3]);
  });

  test('setSelection anchors a later shift-range on the displayed row', () => {
    ui.updateWaypointList(route);
    // The app decided this selection elsewhere (canvas click, undo restore)
    ui.setSelection([route[1]], route[1]);
    const multi = [];
    bus.on('waypoint:multi-selected', payload => multi.push(payload));

    rows()[4].querySelector('.waypoint-row')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));

    expect(multi[0].waypoints).toEqual(route.slice(1, 5));
  });

  test('a minor renames inline through the shared rename path', () => {
    ui.updateWaypointList(route);
    ui.startRenameFor(route[1]);

    const input = rows()[1].querySelector('.waypoint-rename-input');
    expect(input).not.toBeNull();
    expect(input.placeholder).toBe('Waypoint 1.1');

    const renames = [];
    bus.on('waypoint:name-changed', payload => renames.push(payload));
    input.value = 'Bend';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(route[1].name).toBe('Bend');
    expect(renames).toEqual([{ waypoint: route[1], name: 'Bend' }]);
    expect(rows()[1].querySelector('.waypoint-title').textContent).toBe('Bend');
    expect(rows()[1].querySelector('.waypoint-delete').getAttribute('aria-label'))
      .toBe('Delete Bend');
  });

  test('committing a rename with Enter does not throw on the follow-up blur', () => {
    // Enter detaches the input, which then fires its own blur handler. The
    // second pass used to call replaceWith on a parentless node and throw
    // NotFoundError into the console on every successful rename.
    ui.updateWaypointList(route);
    ui.startRenameFor(route[0]);
    const input = rows()[0].querySelector('.waypoint-rename-input');

    input.value = 'Start';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(() => input.dispatchEvent(new FocusEvent('blur'))).not.toThrow();

    expect(route[0].name).toBe('Start');
    expect(rows()[0].querySelector('.waypoint-title').textContent).toBe('Start');
  });

  test('a minor is reorder-visible, not reorder-able', () => {
    ui.updateWaypointList(route);
    const [majorRow, minorRow] = rows();

    expect(majorRow.draggable).toBe(true);
    expect(minorRow.draggable).toBe(false);
    expect(majorRow.querySelectorAll('.waypoint-move-btn')).toHaveLength(2);
    expect(minorRow.querySelectorAll('.waypoint-move-btn')).toHaveLength(0);
    expect(minorRow.querySelector('.waypoint-row .sr-only').textContent)
      .toContain('reorders with it');
  });

  test('a minor still deletes from its own row', () => {
    ui.updateWaypointList(route);
    const deleted = [];
    bus.on('waypoint:delete', wp => deleted.push(wp));

    rows()[1].querySelector('.waypoint-delete')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(deleted).toEqual([route[1]]);
  });

  test('▲/▼ still emit the majors-only reorder payload', () => {
    ui.updateWaypointList(route);
    const orders = [];
    bus.on('waypoints:reordered', order => orders.push(order));

    // Second major's ▲ — index 3 in the displayed route, index 1 in the majors
    rows()[3].querySelectorAll('.waypoint-move-btn')[0]
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(orders).toHaveLength(1);
    expect(orders[0]).toEqual([route[3], route[0], route[5]]);
    expect(orders[0].every(wp => wp.isMajor)).toBe(true);
  });

  test('▲/▼ disable at the ends of the majors, not of the displayed rows', () => {
    ui.updateWaypointList(route);
    const moveBtns = item => [...item.querySelectorAll('.waypoint-move-btn')];

    expect(moveBtns(rows()[0]).map(b => b.disabled)).toEqual([true, false]);
    expect(moveBtns(rows()[3]).map(b => b.disabled)).toEqual([false, false]);
    expect(moveBtns(rows()[5]).map(b => b.disabled)).toEqual([false, true]);
  });

  test('a leg block is the major row plus its trailing minor rows', () => {
    ui.updateWaypointList(route);
    const listed = rows();

    expect(ui._legBlockRows(listed[0])).toEqual([listed[0], listed[1], listed[2]]);
    expect(ui._legBlockRows(listed[3])).toEqual([listed[3], listed[4]]);
    expect(ui._legBlockRows(listed[5])).toEqual([listed[5]]);
  });

  test('a drop onto a minor resolves to the major that owns it', () => {
    ui.updateWaypointList(route);
    const listed = rows();

    expect(ui._legBlockAnchor(listed[2])).toBe(listed[0]);
    expect(ui._legBlockAnchor(listed[4])).toBe(listed[3]);
    expect(ui._legBlockAnchor(listed[5])).toBe(listed[5]);
  });

  test('a minor before every major has no owning block anchor', () => {
    ui.updateWaypointList([minor(), major()]);

    expect(ui._legBlockAnchor(rows()[0])).toBeNull();
  });

  test('an all-minor route still renders rather than showing the empty state', () => {
    ui.updateWaypointList([minor(), minor()]);

    expect(listEl.textContent).not.toContain('No waypoints yet');
    expect(titles()).toEqual(['Waypoint 0.1', 'Waypoint 0.2']);
  });

  test('an empty route keeps the empty state', () => {
    ui.updateWaypointList([]);

    expect(listEl.textContent).toContain('No waypoints yet');
    expect(rows()).toHaveLength(0);
  });
});
