/**
 * COMPOSE-04 — the branch handle beside a waypoint a crowd enters from.
 *
 * The handle is an *offer*, not a second mechanism: clicking it arms the same
 * fork gesture Alt+click arms, so there is one branch path through the code.
 * What is tested here is which waypoints get the offer, where the handle sits,
 * and that it stops being offered when the binding that justified it goes.
 */

import { describe, test, expect } from 'vitest';
import { boundEntryWaypointIds, resolveGraphAnchors } from '../src/utils/routeAnchors.js';
import { pointerMixin } from '../src/app/pointer.js';
import { RenderingService } from '../src/services/RenderingService.js';
import { Scene } from '../src/models/Scene.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { INTERACTION } from '../src/config/constants.js';

const waypointAt = (id, x, y) => Object.assign(Waypoint.createMajor(x, y), { id });

function sceneBoundTo(waypoints, { type = 'entry', visible = true } = {}) {
  const scene = new Scene();
  const layer = scene.addFlowLayer({ name: 'Crowd 1', guideType: 'graph' });
  layer.visible = visible;
  for (const waypoint of waypoints) {
    layer.graph.addNode({ x: 0.1, y: 0.1, type, anchorWaypointId: waypoint.id });
  }
  resolveGraphAnchors(scene, new Map(waypoints.map(each => [each.id, each])));
  return { scene, layer };
}

describe('which waypoints are offered a branch handle', () => {
  test('a waypoint a bound entry node sits on', () => {
    const waypoint = waypointAt('wp-1', 0.5, 0.5);
    const { scene } = sceneBoundTo([waypoint]);

    expect([...boundEntryWaypointIds(scene)]).toEqual(['wp-1']);
  });

  test('a pass-through or exit node is not an offer', () => {
    const waypoint = waypointAt('wp-1', 0.5, 0.5);

    // A crowd already moving through is not a moment the story opens at.
    expect(boundEntryWaypointIds(sceneBoundTo([waypoint], { type: 'normal' }).scene).size).toBe(0);
    expect(boundEntryWaypointIds(sceneBoundTo([waypoint], { type: 'exit' }).scene).size).toBe(0);
  });

  test('an entry node that is not bound to anything offers nothing', () => {
    const scene = new Scene();
    const layer = scene.addFlowLayer({ name: 'Crowd 1', guideType: 'graph' });
    layer.graph.addNode({ x: 0.1, y: 0.1, type: 'entry' });

    expect(boundEntryWaypointIds(scene).size).toBe(0);
  });

  test('a binding whose waypoint was deleted stops offering', () => {
    const waypoint = waypointAt('wp-1', 0.5, 0.5);
    const { scene } = sceneBoundTo([waypoint]);
    expect(boundEntryWaypointIds(scene).size).toBe(1);

    resolveGraphAnchors(scene, new Map()); // the waypoint is gone

    expect(boundEntryWaypointIds(scene).size).toBe(0);
  });

  test('a hidden crowd makes no offer', () => {
    const waypoint = waypointAt('wp-1', 0.5, 0.5);
    const { scene } = sceneBoundTo([waypoint], { visible: false });

    expect(boundEntryWaypointIds(scene).size).toBe(0);
  });

  test('several bound entries offer several handles', () => {
    const waypoints = [waypointAt('wp-1', 0.2, 0.2), waypointAt('wp-2', 0.8, 0.8)];
    const { scene } = sceneBoundTo(waypoints);

    expect([...boundEntryWaypointIds(scene)].sort()).toEqual(['wp-1', 'wp-2']);
  });

  test('a scene with no crowds is not an error', () => {
    expect(boundEntryWaypointIds(new Scene()).size).toBe(0);
    expect(boundEntryWaypointIds(null).size).toBe(0);
  });
});

describe('where the branch handle sits', () => {
  const app = {
    viewport: { zoom: 1 },
    screenToCanvas: (x, y) => ({ x, y }),
    imageToCanvas: (x, y) => ({ x: x * 100, y: y * 100 }),
    waypointBranchHandleAt: pointerMixin.waypointBranchHandleAt,
    isOnWaypointBranchHandle: pointerMixin.isOnWaypointBranchHandle,
  };
  const waypoint = waypointAt('wp-1', 0.5, 0.5); // canvas (50, 50)

  test('up and to the right of the marker, clear of the route line', () => {
    const handle = app.waypointBranchHandleAt(waypoint);
    const offset = INTERACTION.WAYPOINT_HIT_RADIUS;

    expect(handle).toEqual({ x: 50 + offset, y: 50 - offset, radius: offset * 0.75 });
  });

  test('the hit-test accepts its centre and rejects the marker itself', () => {
    const handle = app.waypointBranchHandleAt(waypoint);

    expect(app.isOnWaypointBranchHandle(waypoint, handle.x, handle.y)).toBe(true);
    expect(app.isOnWaypointBranchHandle(waypoint, 50, 50)).toBe(false);
  });

  test('a point just outside the handle is not on it', () => {
    const handle = app.waypointBranchHandleAt(waypoint);

    expect(app.isOnWaypointBranchHandle(waypoint, handle.x + handle.radius + 1, handle.y))
      .toBe(false);
  });

  test('no waypoint is never on a handle', () => {
    expect(app.isOnWaypointBranchHandle(null, 0, 0)).toBe(false);
  });
});

describe('the handle is reachable without hovering first', () => {
  // A touch or pen tap never hovers, so a hover-gated handle would be dead on
  // exactly the devices REV-03 unified the pointer transaction for. The click
  // path hit-tests the handle itself; hover is only the visual affordance.
  const app = {
    waypoints: [],
    viewport: { zoom: 1 },
    screenToCanvas: (x, y) => ({ x, y }),
    imageToCanvas: (x, y) => ({ x: x * 100, y: y * 100 }),
    waypointBranchHandleAt: pointerMixin.waypointBranchHandleAt,
    isOnWaypointBranchHandle: pointerMixin.isOnWaypointBranchHandle,
    findBranchHandleAt: pointerMixin.findBranchHandleAt,
  };

  test('finds the waypoint whose handle is under the point', () => {
    const waypoint = waypointAt('wp-1', 0.5, 0.5);
    app.waypoints = [waypoint];
    const handle = app.waypointBranchHandleAt(waypoint);

    expect(app.findBranchHandleAt(handle.x, handle.y, new Set(['wp-1']))).toBe(waypoint);
  });

  test('ignores waypoints that carry no handle', () => {
    const waypoint = waypointAt('wp-1', 0.5, 0.5);
    app.waypoints = [waypoint];
    const handle = app.waypointBranchHandleAt(waypoint);

    expect(app.findBranchHandleAt(handle.x, handle.y, new Set())).toBeNull();
    expect(app.findBranchHandleAt(handle.x, handle.y, null)).toBeNull();
  });

  test('a point on the marker itself is not the handle', () => {
    const waypoint = waypointAt('wp-1', 0.5, 0.5);
    app.waypoints = [waypoint];

    expect(app.findBranchHandleAt(50, 50, new Set(['wp-1']))).toBeNull();
  });

  test('a minor never carries a handle', () => {
    const minorWaypoint = Object.assign(Waypoint.createMinor(0.5, 0.5), { id: 'wp-m' });
    app.waypoints = [minorWaypoint];
    const handle = app.waypointBranchHandleAt(minorWaypoint);

    expect(app.findBranchHandleAt(handle.x, handle.y, new Set(['wp-m']))).toBeNull();
  });
});

describe('the shared "+" affordance', () => {
  test('the leg handle and the waypoint handle draw through one routine', () => {
    const svc = new RenderingService();

    // One routine means the two offers cannot drift into looking different.
    expect(typeof svc._drawPlusHandle).toBe('function');
  });

  test('the hover cascade distinguishes the handle from the waypoint', () => {
    // 'waypoint-plus' is what the click handler keys on to arm a fork rather
    // than select; a plain 'waypoint' hover must keep selecting.
    const svc = new RenderingService();
    const calls = [];
    svc._drawPlusHandle = (...args) => calls.push(args.at(-1));
    svc.drawHoverRing = () => {};
    svc.scaleSizeClamped = () => 8;

    const waypoint = waypointAt('wp-1', 0.5, 0.5);
    const state = {
      waypoints: [waypoint],
      styles: { dotSize: 8 },
      imageToCanvas: (x, y) => ({ x: x * 100, y: y * 100 }),
      selectedWaypoint: null,
      branchHandleWaypoints: new Set(['wp-1']),
      branchHandleAt: () => ({ x: 60, y: 40, radius: 6 }),
    };

    svc.renderHoverAffordances({}, { ...state, hover: { type: 'waypoint', waypoint } });
    svc.renderHoverAffordances({}, { ...state, hover: { type: 'waypoint-plus', waypoint } });

    expect(calls).toEqual([false, true]);
  });

  test('a waypoint with no bound crowd draws no handle', () => {
    const svc = new RenderingService();
    const calls = [];
    svc._drawPlusHandle = () => calls.push('drawn');
    svc.drawHoverRing = () => {};
    svc.scaleSizeClamped = () => 8;

    const waypoint = waypointAt('wp-1', 0.5, 0.5);
    svc.renderHoverAffordances({}, {
      waypoints: [waypoint],
      styles: { dotSize: 8 },
      imageToCanvas: (x, y) => ({ x, y }),
      selectedWaypoint: null,
      branchHandleWaypoints: new Set(),
      branchHandleAt: () => ({ x: 0, y: 0, radius: 6 }),
      hover: { type: 'waypoint', waypoint },
    });

    expect(calls).toEqual([]);
  });
});
