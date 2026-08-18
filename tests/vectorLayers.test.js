/**
 * RenderingService.VECTOR_LAYERS registry (Phase 1 renderer layer registry).
 *
 * The vector draw order used to be hard-coded inside renderVectorLayerTo();
 * it is now data-driven so future scene layers (Phase 2 flow layers) insert
 * by adding a registry entry. These tests pin the canonical order and prove
 * renderVectorLayerTo() dispatches through the registry with its per-layer
 * visibility guards intact.
 */

import { RenderingService } from '../src/services/RenderingService.js';
import { Waypoint } from '../src/models/Waypoint.js';

/** Minimal render state accepted by renderVectorLayerTo. */
function makeState(overrides = {}) {
  return {
    waypoints: [],
    pathPoints: [],
    styles: {},
    animationEngine: { getPathProgress: () => 0, state: { duration: 1 } },
    selectedWaypoint: null,
    imageToCanvas: () => ({ x: 0, y: 0 }),
    displayWidth: 100,
    displayHeight: 100,
    previewMode: false,
    motionSettings: null,
    motionVisibilityService: null,
    waypointProgressValues: null,
    suppressLabels: false,
    viewport: { zoom: 1 },
    areaEditService: null,
    areaDrawingService: null,
    ...overrides,
  };
}

/** Fake service recording which render* methods the registry dispatches. */
function makeRecordingService(calls) {
  return {
    renderLegHover: () => calls.push('leg-hover'),
    renderPath: () => calls.push('path'),
    renderPathHead: () => calls.push('path-head'),
    renderBeacons: () => calls.push('beacons'),
    renderWaypoints: () => calls.push('waypoints'),
    renderHoverAffordances: () => calls.push('hover-affordances'),
  };
}

describe('RenderingService.VECTOR_LAYERS', () => {
  test('pins the canonical bottom-to-top draw order', () => {
    expect(RenderingService.VECTOR_LAYERS.map(l => l.name)).toEqual([
      'area-highlights',
      'network-guide',
      'flow-layers',
      'leg-hover',
      'path',
      'path-head',
      'beacons',
      'waypoints',
      'area-edit-handles',
      'hover-affordances',
      'network-edit-overlay',
      'area-draw-preview',
    ]);
    for (const layer of RenderingService.VECTOR_LAYERS) {
      expect(typeof layer.draw).toBe('function');
    }
  });

  test('renderVectorLayerTo dispatches layers in registry order', () => {
    const calls = [];
    const svc = makeRecordingService(calls);
    const state = makeState({
      // Two waypoints + path points make the path layers eligible; real
      // Waypoints (no area highlight) keep the area layer a safe no-op.
      waypoints: [Waypoint.createMajor(0.1, 0.1), Waypoint.createMajor(0.9, 0.9)],
      pathPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    });

    RenderingService.prototype.renderVectorLayerTo.call(svc, {}, state);

    expect(calls).toEqual(['path', 'path-head', 'beacons', 'waypoints']);
  });

  test('path and path head honour the ALWAYS_HIDE visibility guard', () => {
    const calls = [];
    const svc = makeRecordingService(calls);
    const state = makeState({
      waypoints: [Waypoint.createMajor(0.1, 0.1), Waypoint.createMajor(0.9, 0.9)],
      pathPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      previewMode: true,
      // ALWAYS_HIDE for the path; waypoints stay visible so later layers run.
      motionSettings: { pathVisibility: 'always-hide', waypointVisibility: 'always-show' },
    });

    RenderingService.prototype.renderVectorLayerTo.call(svc, {}, state);

    expect(calls).toEqual(['beacons', 'waypoints']);
  });

  test('an empty route draws only beacons and waypoint markers', () => {
    const calls = [];
    const svc = makeRecordingService(calls);

    RenderingService.prototype.renderVectorLayerTo.call(svc, {}, makeState());

    expect(calls).toEqual(['beacons', 'waypoints']);
  });

  test('hover layers draw in edit mode: leg glow under the path, affordances above waypoints', () => {
    const calls = [];
    const svc = makeRecordingService(calls);
    const waypoints = [Waypoint.createMajor(0.1, 0.1), Waypoint.createMajor(0.9, 0.9)];
    const state = makeState({
      waypoints,
      pathPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      hover: { type: 'leg', waypoint: waypoints[0], waypointIndex: 0 },
    });

    RenderingService.prototype.renderVectorLayerTo.call(svc, {}, state);

    expect(calls).toEqual(['leg-hover', 'path', 'path-head', 'beacons', 'waypoints', 'hover-affordances']);
  });

  test('hover layers stay silent in preview mode', () => {
    const calls = [];
    const svc = makeRecordingService(calls);
    const waypoints = [Waypoint.createMajor(0.1, 0.1), Waypoint.createMajor(0.9, 0.9)];
    const state = makeState({
      waypoints,
      pathPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      previewMode: true,
      motionSettings: { pathVisibility: 'always-show', waypointVisibility: 'always-show' },
      hover: { type: 'waypoint', waypoint: waypoints[0] },
    });

    RenderingService.prototype.renderVectorLayerTo.call(svc, {}, state);

    expect(calls).toEqual(['path', 'path-head', 'beacons', 'waypoints']);
  });
});
