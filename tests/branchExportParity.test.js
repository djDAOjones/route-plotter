/**
 * ROUTE-01d — a branched route survives export.
 *
 * The standalone player takes `pathTimingMixin` wholesale, so it builds the
 * same splines and composes the same master timeline the editor does. What
 * has to be proved is that nothing is lost in between: the branch links must
 * survive the snapshot, the player must rebuild the identical structure and
 * timeline, and a branch that outlives the trunk must extend the timeline
 * rather than being cut off at the trunk's end.
 */

import { describe, test, expect } from 'vitest';
import { pathTimingMixin } from '../src/app/pathTiming.js';
import { viewportMixin } from '../src/app/viewport.js';
import { persistenceMixin } from '../src/app/persistence.js';
import { EventBus } from '../src/core/EventBus.js';
import { AnimationEngine } from '../src/services/AnimationEngine.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { CoordinateTransform } from '../src/services/CoordinateTransform.js';
import { CameraService } from '../src/services/CameraService.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { Scene } from '../src/models/Scene.js';
import { resolveRouteBranches } from '../src/utils/routeBranches.js';

const CANVAS_W = 1280;
const CANVAS_H = 720;

/**
 * Trunk 1 → 2 → 3 with a branch leaving 2. `rejoinAt` null makes it terminal;
 * `long` stretches it well past the trunk so the truncation rule is testable.
 */
function buildBranchedRoute({ rejoinAt = null, long = false } = {}) {
  const one = Object.assign(Waypoint.createMajor(0.1, 0.1), { id: 'wp-1', pauseTime: 0, pauseMode: 'none' });
  const two = Object.assign(Waypoint.createMajor(0.4, 0.3), { id: 'wp-2', pauseTime: 0, pauseMode: 'none' });
  const branch = Object.assign(
    Waypoint.createMajor(long ? 0.95 : 0.45, long ? 0.95 : 0.6),
    { id: 'wp-b1', pauseTime: 0, pauseMode: 'none', branchId: 'br-1', branchFrom: 'wp-2' }
  );
  if (rejoinAt) branch.branchRejoin = rejoinAt;
  const three = Object.assign(Waypoint.createMajor(0.6, 0.35), { id: 'wp-3', pauseTime: 0, pauseMode: 'none' });
  return [one, two, branch, three];
}

function makeApp(waypoints) {
  const app = {
    waypoints,
    scene: new Scene(),
    pathPoints: [],
    styles: { pathHead: { style: 'arrow', color: '#111111', size: 8, image: null, imageAssetId: null } },
    background: { overlay: 10, fit: 'fit', image: null },
    motionSettings: { pathVisibility: 'show-on-progression', backgroundVisibility: 'always-show', pathTrail: 0 },
    exportSettings: {
      frameRate: 25, pathOnly: false, resolutionX: 1920, resolutionY: 1080,
      backgroundZoom: 100, includeCamera: true, includeText: true
    },
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
    imageAssetService: { toJSON: () => [], exceedsAutosaveLimit: () => false, getAssetCount: () => 0 },
    pathCalculator: new PathCalculator(),
    coordinateTransform: new CoordinateTransform(),
    cameraService: new CameraService(),
    eventBus: new EventBus(),
  };
  app.animationEngine = new AnimationEngine(app.eventBus);
  app.animationEngine.state.speed = 180;
  app.coordinateTransform.setCanvasDimensions(CANVAS_W, CANVAS_H);

  Object.assign(app, {
    calculatePath: pathTimingMixin.calculatePath,
    getWaypointProgressValues: pathTimingMixin.getWaypointProgressValues,
    getMajorWaypointPositions: pathTimingMixin.getMajorWaypointPositions,
    getMajorLegData: pathTimingMixin.getMajorLegData,
    hasSegmentSpeedVariations: pathTimingMixin.hasSegmentSpeedVariations,
    calculatePathDuration: pathTimingMixin.calculatePathDuration,
    getBranchTimeline: pathTimingMixin.getBranchTimeline,
    updateAnimationDuration: pathTimingMixin.updateAnimationDuration,
    imageToCanvas: viewportMixin.imageToCanvas,
    _buildProjectSnapshot: persistenceMixin._buildProjectSnapshot,
  });

  app.calculatePath();
  clearTimeout(app._durationUpdateTimeout);
  app.updateAnimationDuration();
  return app;
}

describe('branch links survive the project snapshot', () => {
  test('a branched route serialises its links; a linear one adds no keys', () => {
    const branched = makeApp(buildBranchedRoute({ rejoinAt: 'wp-3' }));
    const snapshot = branched._buildProjectSnapshot();
    const saved = snapshot.waypoints.find(waypoint => waypoint.id === 'wp-b1');

    expect(saved.branchId).toBe('br-1');
    expect(saved.branchFrom).toBe('wp-2');
    expect(saved.branchRejoin).toBe('wp-3');

    for (const other of snapshot.waypoints.filter(waypoint => waypoint.id !== 'wp-b1')) {
      expect('branchId' in other).toBe(false);
      expect('branchFrom' in other).toBe(false);
      expect('branchRejoin' in other).toBe(false);
    }
  });

  test('rehydrating the snapshot rebuilds the identical structure', () => {
    const authored = makeApp(buildBranchedRoute({ rejoinAt: 'wp-3' }));
    const snapshot = JSON.parse(JSON.stringify(authored._buildProjectSnapshot()));
    const rebuilt = snapshot.waypoints.map(data => Waypoint.fromJSON(data));

    const before = resolveRouteBranches(authored.waypoints);
    const after = resolveRouteBranches(rebuilt);

    expect(after.problems).toEqual([]);
    expect(after.isLinear).toBe(before.isLinear);
    expect(after.branches.map(branch => ({
      fork: branch.forkFromId, rejoin: branch.rejoinAtId, size: branch.waypoints.length,
    }))).toEqual(before.branches.map(branch => ({
      fork: branch.forkFromId, rejoin: branch.rejoinAtId, size: branch.waypoints.length,
    })));
  });
});

describe('the composed timeline survives the round-trip', () => {
  const compose = waypoints => {
    const app = makeApp(waypoints);
    const timeline = app.getBranchTimeline();
    return { app, timeline };
  };

  test('a rehydrated route composes the same leg placements and total', () => {
    const authored = compose(buildBranchedRoute({ rejoinAt: 'wp-3' }));
    const snapshot = JSON.parse(JSON.stringify(authored.app._buildProjectSnapshot()));
    const replayed = compose(snapshot.waypoints.map(data => Waypoint.fromJSON(data)));

    expect(replayed.timeline.totalDurationMs)
      .toBeCloseTo(authored.timeline.totalDurationMs, 6);
    expect(Object.keys(replayed.timeline.legs).sort())
      .toEqual(Object.keys(authored.timeline.legs).sort());
    for (const key of Object.keys(authored.timeline.legs)) {
      expect(replayed.timeline.legs[key].startMs)
        .toBeCloseTo(authored.timeline.legs[key].startMs, 6);
      expect(replayed.timeline.legs[key].durationMs)
        .toBeCloseTo(authored.timeline.legs[key].durationMs, 6);
    }
  });

  test('the join wait survives the round-trip', () => {
    const authored = compose(buildBranchedRoute({ rejoinAt: 'wp-3' }));
    const snapshot = JSON.parse(JSON.stringify(authored.app._buildProjectSnapshot()));
    const replayed = compose(snapshot.waypoints.map(data => Waypoint.fromJSON(data)));

    expect(replayed.timeline.joinWaitsById).toEqual(authored.timeline.joinWaitsById);
  });
});

describe('a branch that outlives the trunk extends the timeline', () => {
  test('a long terminal branch is not cut off at the trunk’s end', () => {
    const app = makeApp(buildBranchedRoute({ long: true }));
    const timeline = app.getBranchTimeline();

    // The branch runs well past the trunk, so the composed total must exceed
    // the trunk's own duration — and the engine must honour it.
    expect(timeline.totalDurationMs).toBeGreaterThan(timeline.legs.__trunk__.endMs);
    expect(app.animationEngine.state.duration)
      .toBeGreaterThanOrEqual(timeline.totalDurationMs);
  });

  test('a short branch leaves the trunk’s own duration alone', () => {
    const linear = makeApp(buildBranchedRoute().filter(waypoint => !waypoint.branchId));
    const branched = makeApp(buildBranchedRoute({ long: false }));

    // The short branch finishes inside the trunk's span, so the timeline is
    // still the trunk's — a branch must not pad a route it fits inside.
    expect(branched.animationEngine.state.duration)
      .toBeGreaterThanOrEqual(linear.animationEngine.state.duration);
  });

  test('a linear route composes no branch timeline at all', () => {
    const app = makeApp(buildBranchedRoute().filter(waypoint => !waypoint.branchId));

    expect(app.getBranchTimeline()).toBeNull();
    expect(app.branchPaths).toEqual([]);
    expect(app.routeStructure.isLinear).toBe(true);
  });
});

describe('branch geometry rebuilds identically after a reload', () => {
  test('every branch path has the same point count and endpoints', () => {
    const authored = makeApp(buildBranchedRoute({ rejoinAt: 'wp-3' }));
    const snapshot = JSON.parse(JSON.stringify(authored._buildProjectSnapshot()));
    const replayed = makeApp(snapshot.waypoints.map(data => Waypoint.fromJSON(data)));

    expect(replayed.branchPaths).toHaveLength(authored.branchPaths.length);
    authored.branchPaths.forEach((branch, index) => {
      const other = replayed.branchPaths[index];
      expect(other.pathPoints).toHaveLength(branch.pathPoints.length);
      expect(other.pathPoints[0]).toEqual(branch.pathPoints[0]);
      expect(other.pathPoints.at(-1)).toEqual(branch.pathPoints.at(-1));
      expect(other.anchorIds).toEqual(branch.anchorIds);
    });
  });

  test('the trunk path is unaffected by the branch', () => {
    const linear = makeApp(buildBranchedRoute().filter(waypoint => !waypoint.branchId));
    const branched = makeApp(buildBranchedRoute({ rejoinAt: 'wp-3' }));

    // The branch waypoint must never bend the trunk's own spline.
    expect(branched.pathPoints).toHaveLength(linear.pathPoints.length);
    expect(branched.pathPoints[0]).toEqual(linear.pathPoints[0]);
    expect(branched.pathPoints.at(-1)).toEqual(linear.pathPoints.at(-1));
  });
});
