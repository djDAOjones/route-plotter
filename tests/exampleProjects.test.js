/**
 * DEMO-01 — the bundled examples, exercised as living fixtures.
 *
 * "Living" is the whole point: these are not stored snapshots of a format
 * nobody reads any more, they are built from the current models and loaded
 * through the app's own timing path. If the save shape, the branch model, the
 * crowd binding or the timeline maths drift, an example stops resolving and
 * this file says so — which is cheaper than finding out when someone opens one.
 */

import { describe, test, expect } from 'vitest';
import { buildExampleProjects, exampleProjectIds } from '../src/examples/index.js';
import { resolveRouteBranches } from '../src/utils/routeBranches.js';
import { resolveGraphAnchors, normaliseReleaseAnchor } from '../src/utils/routeAnchors.js';
import { pathTimingMixin } from '../src/app/pathTiming.js';
import { viewportMixin } from '../src/app/viewport.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { Scene } from '../src/models/Scene.js';
import { EventBus } from '../src/core/EventBus.js';
import { AnimationEngine } from '../src/services/AnimationEngine.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { CoordinateTransform } from '../src/services/CoordinateTransform.js';
import { CameraService } from '../src/services/CameraService.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';

const CANVAS_W = 1280;
const CANVAS_H = 720;

/** Rehydrate an example the way a load does, then time it the way the app does. */
function hydrate(example) {
  const waypoints = example.project.waypoints.map(data => Waypoint.fromJSON(data));
  const scene = Scene.fromJSON(example.project.scene);

  const app = {
    waypoints,
    scene,
    waypointsById: new Map(waypoints.map(waypoint => [waypoint.id, waypoint])),
    pathPoints: [],
    styles: example.project.styles,
    motionSettings: example.project.motionSettings,
    exportSettings: example.project.exportSettings,
    previewMode: true,
    elements: {},
    displayWidth: CANVAS_W,
    displayHeight: CANVAS_H,
    renderReference: { width: CANVAS_W, height: CANVAS_H },
    _waypointProgressCache: null,
    _majorWaypointsCache: null,
    _durationUpdateTimeout: null,
    queueRender() {},
    updateTimeDisplay() {},
    markDirty() {},
    pathCalculator: new PathCalculator(),
    coordinateTransform: new CoordinateTransform(),
    cameraService: new CameraService(),
    eventBus: new EventBus(),
    announce() {},
  };
  app.animationEngine = new AnimationEngine(app.eventBus);
  app.animationEngine.state.speed = example.project.animationState.speed;
  app.coordinateTransform.setCanvasDimensions(CANVAS_W, CANVAS_H);

  Object.assign(app, {
    calculatePath: pathTimingMixin.calculatePath,
    getWaypointProgressValues: pathTimingMixin.getWaypointProgressValues,
    getMajorWaypointPositions: pathTimingMixin.getMajorWaypointPositions,
    getMajorLegData: pathTimingMixin.getMajorLegData,
    hasSegmentSpeedVariations: pathTimingMixin.hasSegmentSpeedVariations,
    calculatePathDuration: pathTimingMixin.calculatePathDuration,
    getBranchTimeline: pathTimingMixin.getBranchTimeline,
    getRouteArrivalMap: pathTimingMixin.getRouteArrivalMap,
    updateAnimationDuration: pathTimingMixin.updateAnimationDuration,
    imageToCanvas: viewportMixin.imageToCanvas,
  });

  app.calculatePath();
  clearTimeout(app._durationUpdateTimeout);
  app.updateAnimationDuration();
  return app;
}

const examples = buildExampleProjects();
const byId = id => examples.find(example => example.id === id);

describe('the example catalogue', () => {
  test('ships exactly the three approved examples', () => {
    expect(exampleProjectIds())
      .toEqual(['parm-aerial-walk', 'uon-open-day', 'nervous-system-flow']);
  });

  test('every example names itself and an approved background', () => {
    for (const example of examples) {
      expect(example.name.length).toBeGreaterThan(0);
      expect(example.description.length).toBeGreaterThan(0);
      expect(example.backgroundSource).toMatch(/^images\/.+\.(png|jpg|jpeg)$/);
    }
  });

  test('every example is a current-version snapshot', () => {
    for (const example of examples) {
      expect(example.project.coordVersion).toBe(9);
      expect(Array.isArray(example.project.waypoints)).toBe(true);
      expect(example.project.scene).toBeTruthy();
    }
  });

  test('building twice produces identical projects', () => {
    // Reproducibility is what keeps a rebuild from landing a fresh
    // multi-megabyte archive in history for no change at all.
    expect(JSON.stringify(buildExampleProjects()))
      .toBe(JSON.stringify(buildExampleProjects()));
  });

  test('ids are unique and URL-safe', () => {
    const ids = exampleProjectIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('every example rehydrates and times', () => {
  for (const example of examples) {
    describe(example.id, () => {
      test('resolves a valid route structure', () => {
        const app = hydrate(example);
        const structure = resolveRouteBranches(app.waypoints);

        expect(structure.problems).toEqual([]);
      });

      test('builds a path and a positive timeline', () => {
        const app = hydrate(example);

        expect(app.pathPoints.length).toBeGreaterThan(1);
        expect(app.animationEngine.state.duration).toBeGreaterThan(0);
      });

      test('times identically on a second load', () => {
        expect(hydrate(example).animationEngine.state.duration)
          .toBeCloseTo(hydrate(example).animationEngine.state.duration, 9);
      });

      test('gives every waypoint an arrival', () => {
        const app = hydrate(example);
        const arrivals = app.getRouteArrivalMap();

        expect(arrivals).not.toBeNull();
        for (const waypoint of app.waypoints) {
          expect(Number.isFinite(arrivals.arrivalMsById[waypoint.id])).toBe(true);
        }
      });

      test('every crowd binding resolves', () => {
        const app = hydrate(example);
        const report = resolveGraphAnchors(app.scene, app.waypointsById);

        expect(report.broken).toEqual([]);
      });

      test('every crowd evaluates to dots somewhere on its timeline', () => {
        const app = hydrate(example);
        const layers = app.scene.getFlowLayers();
        if (layers.length === 0) return; // the no-crowd example

        const engine = new SwarmEngine();
        const durationMs = app.animationEngine.state.duration;
        const context = {
          durationMs,
          routePathPoints: app.pathPoints,
          routeAnchors: app.getRouteArrivalMap(),
        };
        for (const layer of layers) {
          const seen = [0.25, 0.5, 0.75, 0.95]
            .map(fraction => engine.evaluate(durationMs * fraction, layer, context).length);
          expect(Math.max(...seen)).toBeGreaterThan(0);
        }
      });
    });
  }
});

describe('each example demonstrates what it claims to', () => {
  test('the site walk is a plain unbranched route with no crowd', () => {
    const example = byId('parm-aerial-walk');
    const app = hydrate(example);

    expect(resolveRouteBranches(app.waypoints).isLinear).toBe(true);
    expect(app.scene.getFlowLayers()).toHaveLength(0);
    expect(app.waypoints.some(waypoint => waypoint.isMajor === false)).toBe(true);
  });

  test('the open day route branches, rejoins, and carries a bound crowd', () => {
    const app = hydrate(byId('uon-open-day'));
    const structure = resolveRouteBranches(app.waypoints);

    expect(structure.branches).toHaveLength(1);
    expect(structure.branches[0].terminal).toBe(false);
    expect(structure.branches[0].rejoinAtId).toBe('ex-uon-3');

    const [crowd] = app.scene.getFlowLayers();
    expect(crowd.guideType).toBe('graph');
    // Traced from the route, so every node follows a waypoint…
    expect(crowd.graph.getNodes().every(node => node.anchorWaypointId)).toBe(true);
    // …and the release is pinned to a route moment.
    expect(normaliseReleaseAnchor(crowd.getEmitters()[0].releaseAnchor))
      .toEqual({ waypointId: 'ex-uon-1', at: 'arrival' });
  });

  test('the branch shows up in the composed timeline as a join wait', () => {
    const app = hydrate(byId('uon-open-day'));
    const timeline = app.getBranchTimeline();

    expect(timeline).not.toBeNull();
    expect(Object.keys(timeline.joinWaitsById)).toContain('ex-uon-3');
    expect(timeline.unresolved).toEqual([]);
  });

  test('the signal flow is a weighted network with two streams and no branch', () => {
    const app = hydrate(byId('nervous-system-flow'));
    const [crowd] = app.scene.getFlowLayers();

    expect(resolveRouteBranches(app.waypoints).isLinear).toBe(true);
    expect(crowd.getEmitters()).toHaveLength(2);
    expect(crowd.graph.getEdges().some(edge => edge.weight !== 1)).toBe(true);
    expect(crowd.graph.getNodesByType('entry')).toHaveLength(1);
    expect(crowd.graph.getNodesByType('exit')).toHaveLength(1);
  });
});
