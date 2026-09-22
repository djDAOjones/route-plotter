/**
 * ROUTE-01c — branch authoring: numbering, list rows, the model helpers behind
 * the two gestures, and the drag-to-rejoin resolution.
 *
 * The gestures themselves (Alt+click to fork, drag a branch end onto a
 * waypoint to rejoin) run through InteractionHandler's captured pointer
 * transaction and are live-verified; what is unit-tested here is every
 * decision those gestures delegate to — which is where the rules actually
 * live, and where a wrong answer would corrupt the route.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  branchInsertIndex, canForkFrom, canRejoinBranch, branchEndInfo,
  resolveRouteBranches,
} from '../src/utils/routeBranches.js';
import { buildRouteNumbering } from '../src/utils/waypointNaming.js';
import { buildSceneOutlineSnapshot } from '../src/utils/sceneSemantics.js';
import { EventBus } from '../src/core/EventBus.js';
import { UIController } from '../src/controllers/UIController.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { pointerMixin } from '../src/app/pointer.js';

const major = (id, extra = {}) => Object.assign(Waypoint.createMajor(0.5, 0.5), { id }, extra);
const minor = (id, extra = {}) => Object.assign(Waypoint.createMinor(0.5, 0.5), { id }, extra);

describe('branch numbering', () => {
  test('a branch waypoint numbers fork·letter·position', () => {
    const route = [
      major('a'), major('f'),
      major('b1', { branchId: 'B', branchFrom: 'f' }),
      major('b2', { branchId: 'B' }),
      major('z'),
    ];

    expect(buildRouteNumbering(route).map(entry => entry.displayNumber))
      .toEqual(['1', '2', '2·B1', '2·B2', '3']);
  });

  test('a second branch off the same fork continues the alphabet', () => {
    const route = [
      major('f'),
      major('b1', { branchId: 'B', branchFrom: 'f' }),
      major('c1', { branchId: 'C', branchFrom: 'f' }),
    ];

    expect(buildRouteNumbering(route).map(entry => entry.displayNumber))
      .toEqual(['1', '1·B1', '1·C1']);
  });

  test('a minor inside a branch appends its own position', () => {
    const route = [
      major('f'),
      major('b1', { branchId: 'B', branchFrom: 'f' }),
      minor('bm', { branchId: 'B' }),
    ];

    expect(buildRouteNumbering(route)[2].displayNumber).toBe('1·B1.1');
  });

  test('a branch forking from another branch names its parent letter', () => {
    const route = [
      major('f'),
      major('b1', { branchId: 'B', branchFrom: 'f' }),
      major('c1', { branchId: 'C', branchFrom: 'b1' }),
    ];

    expect(buildRouteNumbering(route)[2].displayNumber).toBe('B·B1');
  });

  test('trunk numbering is untouched by the presence of branches', () => {
    const linear = [major('a'), minor('m'), major('b')];
    const branched = [
      major('a'), minor('m'), major('b'),
      major('x', { branchId: 'B', branchFrom: 'a' }),
    ];

    expect(buildRouteNumbering(branched).slice(0, 3).map(e => e.displayNumber))
      .toEqual(buildRouteNumbering(linear).map(e => e.displayNumber));
  });

  test('the outline says which branch a waypoint is on', () => {
    const route = [
      major('f'),
      Object.assign(major('b1', { branchId: 'B', branchFrom: 'f' }), { name: 'Detour' }),
    ];
    const snapshot = buildSceneOutlineSnapshot({ waypoints: route, scene: null });

    expect(snapshot.route[0].name).toBe('Major waypoint 1');
    expect(snapshot.route[1].name).toBe('Branch B waypoint 1·B1 — Detour');
    expect(snapshot.route[1].branchLetter).toBe('B');
  });
});

describe('branchInsertIndex', () => {
  test('a branch lands after its fork', () => {
    const route = [major('a'), major('f'), major('z')];

    expect(branchInsertIndex(route, 'f')).toBe(2);
  });

  test('a branch lands after the fork’s own trailing minors', () => {
    const route = [major('f'), minor('m1'), minor('m2'), major('z')];

    expect(branchInsertIndex(route, 'f')).toBe(3);
  });

  test('a second branch lands after the first, so letters follow array order', () => {
    const route = [
      major('f'),
      major('b1', { branchId: 'B', branchFrom: 'f' }),
      major('z'),
    ];

    expect(branchInsertIndex(route, 'f')).toBe(2);
  });

  test('an unknown fork appends rather than corrupting the order', () => {
    const route = [major('a'), major('b')];

    expect(branchInsertIndex(route, 'gone')).toBe(2);
  });
});

describe('canForkFrom', () => {
  test('a major may be forked from', () => {
    expect(canForkFrom(major('a'))).toEqual({ ok: true, reason: null });
  });

  test('a minor may not: it carries no timing of its own', () => {
    const verdict = canForkFrom(minor('m'));

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('major waypoint');
  });

  test('nothing selected is refused with a usable reason', () => {
    expect(canForkFrom(null).ok).toBe(false);
  });
});

describe('canRejoinBranch', () => {
  const route = () => [
    major('a'), major('f'),
    major('b1', { branchId: 'B', branchFrom: 'f' }),
    major('b2', { branchId: 'B' }),
    major('z'),
  ];

  test('a downstream trunk major is a valid target', () => {
    expect(canRejoinBranch(route(), 'B', 'z')).toEqual({ ok: true, reason: null });
  });

  test('clearing the rejoin is always valid', () => {
    expect(canRejoinBranch(route(), 'B', null)).toEqual({ ok: true, reason: null });
  });

  test('a branch may not rejoin one of its own waypoints', () => {
    const verdict = canRejoinBranch(route(), 'B', 'b1');

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('its own waypoints');
  });

  test('a minor is not a rejoin target', () => {
    const withMinor = [...route(), minor('m')];
    const verdict = canRejoinBranch(withMinor, 'B', 'm');

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('minors carry no timing');
  });

  test('a vanished target is refused rather than silently dropped', () => {
    expect(canRejoinBranch(route(), 'B', 'gone').ok).toBe(false);
  });

  test('an unknown branch is refused', () => {
    expect(canRejoinBranch(route(), 'NOPE', 'z').ok).toBe(false);
  });
});

describe('branchEndInfo', () => {
  const route = [
    major('f'),
    major('b1', { branchId: 'B', branchFrom: 'f' }),
    major('b2', { branchId: 'B' }),
  ];

  test('only the last waypoint of a branch is its end', () => {
    expect(branchEndInfo(route, route[1])).toEqual({ branchId: 'B', isEnd: false });
    expect(branchEndInfo(route, route[2])).toEqual({ branchId: 'B', isEnd: true });
  });

  test('a trunk waypoint is not a branch end at all', () => {
    expect(branchEndInfo(route, route[0])).toBeNull();
  });

  test('a single-waypoint branch is its own end', () => {
    const single = [major('f'), major('b1', { branchId: 'B', branchFrom: 'f' })];

    expect(branchEndInfo(single, single[1])).toEqual({ branchId: 'B', isEnd: true });
  });
});

describe('the branch row in the waypoint list', () => {
  let listEl;
  let ui;
  let route;

  beforeEach(() => {
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
    listEl = document.getElementById('waypoint-list');
    ui = new UIController({ waypointList: listEl }, new EventBus());
    route = [
      major('a'), major('f'),
      major('b1', { branchId: 'B', branchFrom: 'f', branchRejoin: 'z' }),
      major('z'),
    ];
  });

  const rows = () => [...listEl.querySelectorAll('.waypoint-item')]
    .filter(item => !item.querySelector('.waypoint-add-btn'));

  test('a branch waypoint gets an indented row tagged "branch"', () => {
    ui.updateWaypointList(route);
    const branchRow = rows()[2];

    expect(branchRow.classList.contains('waypoint-item-branch')).toBe(true);
    expect(branchRow.classList.contains('waypoint-item-minor')).toBe(true);
    expect(branchRow.querySelector('.waypoint-minor-tag').textContent).toBe('branch');
    expect(branchRow.querySelector('.waypoint-title').textContent).toBe('Waypoint 2·B1');
  });

  test('the branch row says where it leaves and where it rejoins', () => {
    ui.updateWaypointList(route);

    expect(rows()[2].querySelector('.waypoint-row .sr-only').textContent)
      .toBe(', branch B leaving waypoint 2, rejoins at Waypoint 3');
  });

  test('a terminal branch says it ends there', () => {
    route[2].branchRejoin = null;
    ui.updateWaypointList(route);

    expect(rows()[2].querySelector('.waypoint-row .sr-only').textContent)
      .toContain('ends the branch here');
  });

  test('the fork row is marked, visibly and for a screen reader', () => {
    ui.updateWaypointList(route);
    const forkRow = rows()[1];

    expect(forkRow.querySelector('.waypoint-fork-mark').textContent).toBe('⑂');
    expect(forkRow.querySelector('.waypoint-fork-mark').getAttribute('aria-hidden')).toBe('true');
    expect(forkRow.querySelector('.waypoint-row .sr-only').textContent)
      .toBe(', a branch leaves here');
  });

  test('a branch waypoint never joins the majors-only reorder payload', () => {
    ui.updateWaypointList(route);
    const branchRow = rows()[2];

    expect(branchRow.draggable).toBe(false);
    expect(branchRow.querySelectorAll('.waypoint-move-btn')).toHaveLength(0);
    // Three trunk majors, so the last one's ▼ is the disabled end
    expect([...rows()[3].querySelectorAll('.waypoint-move-btn')].map(b => b.disabled))
      .toEqual([false, true]);
  });

  test('a branch waypoint is still selectable and deletable from its row', () => {
    ui.updateWaypointList(route);
    const selected = [];
    const deleted = [];
    ui.eventBus.on('waypoint:selected', wp => selected.push(wp));
    ui.eventBus.on('waypoint:delete', wp => deleted.push(wp));

    rows()[2].querySelector('.waypoint-row')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    rows()[2].querySelector('.waypoint-delete')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selected).toEqual([route[2]]);
    expect(deleted).toEqual([route[2]]);
  });

  test('the scope chip numbers a branch waypoint the way its row does', () => {
    ui.updateWaypointList(route);
    ui.updateWaypointEditor(route[2]);

    expect(document.getElementById('scope-chip-text').textContent)
      .toBe('Editing · Waypoint 2·B1 · branch B');
  });

  test('the chip still numbers a trunk major as before', () => {
    ui.updateWaypointList(route);
    ui.updateWaypointEditor(route[3]);

    expect(document.getElementById('scope-chip-text').textContent)
      .toBe('Editing · Waypoint 3 · major');
  });

  test('a linear route grows no fork marks and no branch rows', () => {
    ui.updateWaypointList([major('a'), minor('m'), major('b')]);

    expect(listEl.querySelectorAll('.waypoint-fork-mark')).toHaveLength(0);
    expect(listEl.querySelectorAll('.waypoint-item-branch')).toHaveLength(0);
    expect([...listEl.querySelectorAll('.waypoint-minor-tag')].map(t => t.textContent))
      .toEqual(['minor']);
  });
});

describe('the drop hit-test skips what is being dragged', () => {
  // Found live: at drop time the dragged waypoint sits under the cursor, on
  // top of the target, so an unfiltered hit-test always found itself and the
  // rejoin never fired.
  const app = {
    viewport: { zoom: 1 },
    screenToCanvas: (x, y) => ({ x, y }),
    imageToCanvas: (x, y) => ({ x: x * 100, y: y * 100 }),
  };

  const findWaypointAt = pointerMixin.findWaypointAt.bind(app);

  beforeEach(() => {
    app.waypoints = [
      Object.assign(Waypoint.createMajor(0.5, 0.5), { id: 'target' }),
      Object.assign(Waypoint.createMajor(0.5, 0.5), { id: 'dragged' }),
    ];
  });

  test('without an exclusion the dragged waypoint can win the hit-test', () => {
    expect(findWaypointAt(50, 50)).not.toBeNull();
  });

  test('excluding the dragged waypoint finds the one underneath', () => {
    const dragged = app.waypoints[1];

    expect(findWaypointAt(50, 50, dragged).id).toBe('target');
  });

  test('a whole drag group can be excluded at once', () => {
    const group = new Set(app.waypoints);

    expect(findWaypointAt(50, 50, group)).toBeNull();
  });

  test('an exclusion never changes an ordinary hit-test', () => {
    expect(findWaypointAt(50, 50, null).id).toBe('target');
  });
});

describe('the authored structure resolves cleanly', () => {
  test('a branch created at the computed insert index is contiguous and valid', () => {
    const route = [major('a'), major('f'), minor('m'), major('z')];
    const created = major('b1', { branchId: 'br_b1', branchFrom: 'f' });
    route.splice(branchInsertIndex(route, 'f'), 0, created);

    const structure = resolveRouteBranches(route);
    expect(structure.problems).toEqual([]);
    expect(structure.branches).toHaveLength(1);
    expect(structure.branches[0].forkFromId).toBe('f');
    expect(route.map(w => w.id)).toEqual(['a', 'f', 'm', 'b1', 'z']);
  });

  test('rejoining that branch keeps the structure valid', () => {
    const route = [major('a'), major('f'), major('b1', { branchId: 'B', branchFrom: 'f' }), major('z')];
    expect(canRejoinBranch(route, 'B', 'z').ok).toBe(true);

    route[2].branchRejoin = 'z';
    const structure = resolveRouteBranches(route);
    expect(structure.problems).toEqual([]);
    expect(structure.branches[0].rejoinAtId).toBe('z');
    expect(structure.branches[0].terminal).toBe(false);
  });
});
