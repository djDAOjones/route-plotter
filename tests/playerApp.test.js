import { describe, test, expect } from 'vitest';
import { PlayerApp } from '../src/player/PlayerApp.js';
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

/**
 * Export-parity golden cross-check (Phase 5).
 *
 * The exported HTML player hydrates a PlayerApp from the embedded
 * coordVersion-9 snapshot. These tests pin the contract that makes that safe:
 * an authored app state, serialised through the persistence mixin's
 * _buildProjectSnapshot and loaded into a PlayerApp, must configure the
 * SAME timeline — duration, segment markers, pause budgets, intro/tail,
 * beacon schedules — as the app's own pathTiming chain produced, and the
 * same deterministic swarm. If PlayerApp.load ever drifts from the app's
 * hydration order or settings overlay, these break.
 *
 * Both sides run headless on identical CoordinateTransform dimensions
 * (jsdom has no layout), so every derived pixel length matches exactly.
 */

const CANVAS_W = 1000;
const CANVAS_H = 800;

/** Authored fixture: pauses, a minor, variable leg speed, beacons, a crowd. */
function buildAuthoredWaypoints() {
  const a = Waypoint.createMajor(0.1, 0.1);
  a.pauseTime = 1200;
  a.beaconStyle = 'ripple';
  const b = Waypoint.createMinor(0.45, 0.2);
  const c = Waypoint.createMajor(0.6, 0.55);
  c.pauseTime = 800;
  c.segmentSpeed = 2.0;
  c.beaconStyle = 'grow';   // grow feeds the early-onset pause budget rule
  const d = Waypoint.createMajor(0.9, 0.85);
  return [a, b, c, d];
}

function buildAuthoredScene() {
  const scene = new Scene();
  const routeLayer = scene.addFlowLayer({ name: 'Crowd 1', guideType: 'route' });
  routeLayer.addEmitter({
    seed: 42,
    dotCount: 24,
    releaseStart: 0.2,
    releaseDuration: 0.5,
    busynessEnvelope: [
      { time: 0, value: 0.1, transition: 'step' },
      { time: 0.5, value: 1, transition: 'gradual' },
      { time: 1, value: 0.2, transition: 'gradual' },
    ],
  });
  const graphLayer = scene.addFlowLayer({ name: 'Crowd 2', guideType: 'graph' });
  const entry = graphLayer.graph.addNode({ x: 0.2, y: 0.3, type: 'entry' });
  const exit = graphLayer.graph.addNode({ x: 0.8, y: 0.7, type: 'exit' });
  graphLayer.graph.addEdge({ sourceId: entry.id, targetId: exit.id });
  graphLayer.addEmitter({ seed: 7, dotCount: 12 });
  return scene;
}

/**
 * Minimal app-side stand-in running the REAL timing chain: real services,
 * the real pathTiming/viewport mixin methods, real snapshot builder — the
 * same pattern as the scenePersistence contract suite.
 */
function makeAuthoredApp({ motionSettings }) {
  const app = {
    waypoints: buildAuthoredWaypoints(),
    scene: buildAuthoredScene(),
    pathPoints: [],
    styles: { pathHead: { style: 'arrow', color: '#111111', size: 8, image: null, imageAssetId: null } },
    background: { overlay: 10, fit: 'fit', image: null },
    motionSettings,
    exportSettings: {
      frameRate: 25, pathOnly: false, resolutionX: 1920, resolutionY: 1080,
      backgroundZoom: 100, includeCamera: true, includeText: true
    },
    previewMode: true,
    elements: {},
    displayWidth: CANVAS_W,
    displayHeight: CANVAS_H,
    _waypointProgressCache: null,
    _segmentLengthsCache: null,
    _majorWaypointsCache: null,
    _durationUpdateTimeout: null,
    queueRender() {},
    updateTimeDisplay() {},
    markDirty() {},
    imageAssetService: { toJSON: () => [], exceedsAutosaveLimit: () => false, getAssetCount: () => 0 },
    pathCalculator: new PathCalculator(),
    coordinateTransform: new CoordinateTransform(),
    cameraService: new CameraService(),
    eventBus: new EventBus()
  };
  app.animationEngine = new AnimationEngine(app.eventBus);
  app.animationEngine.state.speed = 180; // authored base speed, px/s
  app.coordinateTransform.setCanvasDimensions(CANVAS_W, CANVAS_H);

  Object.assign(app, {
    calculatePath: pathTimingMixin.calculatePath,
    getWaypointProgressValues: pathTimingMixin.getWaypointProgressValues,
    getMajorWaypointPositions: pathTimingMixin.getMajorWaypointPositions,
    getMajorLegData: pathTimingMixin.getMajorLegData,
    hasSegmentSpeedVariations: pathTimingMixin.hasSegmentSpeedVariations,
    calculatePathDuration: pathTimingMixin.calculatePathDuration,
    updateAnimationDuration: pathTimingMixin.updateAnimationDuration,
    imageToCanvas: viewportMixin.imageToCanvas,
    _buildProjectSnapshot: persistenceMixin._buildProjectSnapshot
  });

  app.calculatePath();
  clearTimeout(app._durationUpdateTimeout); // assertions drive the update explicitly
  app.updateAnimationDuration();
  return app;
}

/** Hydrate a PlayerApp from a snapshot, headless (no layout, no 2D context).
    load() self-configures its timing space from snapshot.timingReference —
    the authored-timeline preservation rule under test. */
async function makePlayerFromSnapshot(snapshot) {
  const canvas = document.createElement('canvas');
  const player = new PlayerApp(canvas);
  await player.load(JSON.parse(JSON.stringify(snapshot)), null);
  return player;
}

/** Deep copy, dropping Waypoint `modified` stamps — creation-time metadata,
    not timeline state (hydrated instances are stamped at load time). */
function stableCopy(value) {
  return JSON.parse(JSON.stringify(value, (key, v) => (key === 'modified' ? undefined : v)));
}

function timelineFingerprint(engine) {
  return {
    duration: engine.state.duration,
    pathDuration: engine.pathDuration,
    totalPauseTime: engine.totalPauseTime,
    introTime: engine.introTime,
    totalTailTime: engine.totalTailTime,
    hasVariableSpeed: engine.hasVariableSpeed,
    segmentMarkers: stableCopy(engine.segmentMarkers || []),
    pauseMarkers: stableCopy(engine.pauseMarkers || []),
    beaconSchedules: stableCopy(engine.beaconSchedules || [])
  };
}

const BASE_MOTION = {
  pathVisibility: 'show-on-progression',
  pathTrail: 0.2,
  waypointVisibility: 'hide-before',
  backgroundVisibility: 'always-show',
  revealSize: 20,
  revealFeather: 50,
  aovAngle: 60,
  aovDistance: 25,
  aovDropoff: 50
};

describe('PlayerApp export parity (golden cross-check)', () => {

  test('snapshot → PlayerApp reproduces the app timeline exactly', async () => {
    const app = makeAuthoredApp({ motionSettings: { ...BASE_MOTION } });
    const snapshot = app._buildProjectSnapshot();
    expect(snapshot.timingReference).toEqual({ width: CANVAS_W, height: CANVAS_H });

    const player = await makePlayerFromSnapshot(snapshot);

    const appTimeline = timelineFingerprint(app.animationEngine);
    const playerTimeline = timelineFingerprint(player.animationEngine);

    expect(appTimeline.duration).toBeGreaterThan(0);
    expect(appTimeline.totalPauseTime).toBeGreaterThan(0);
    expect(appTimeline.segmentMarkers.length).toBeGreaterThan(0); // 2.0x leg → variable speed
    expect(playerTimeline).toEqual(appTimeline);

    expect(player.getWaypointProgressValues()).toEqual(app.getWaypointProgressValues());

    // Timing derived in the authored space; rendering lives in export-resolution space
    expect(player._timingRef).toEqual({ width: CANVAS_W, height: CANVAS_H });
    expect(player.displayWidth).toBe(snapshot.exportSettings.resolutionX);
    expect(player.displayHeight).toBe(snapshot.exportSettings.resolutionY);
  });

  test('reset restores the authored timeline (engine reset clobbers duration/mode)', async () => {
    const app = makeAuthoredApp({ motionSettings: { ...BASE_MOTION } });
    const player = await makePlayerFromSnapshot(app._buildProjectSnapshot());
    const authoredDuration = player.animationEngine.state.duration;

    player.animationEngine.seekToProgress(0.7);
    player.resetPlayback();

    expect(player.animationEngine.state.currentTime).toBe(0);
    expect(player.animationEngine.state.duration).toBe(authoredDuration);
    expect(player.animationEngine.state.duration).toBe(app.animationEngine.state.duration);
  });

  test('reveal intro and comet tail rules survive the round-trip', async () => {
    const app = makeAuthoredApp({
      motionSettings: { ...BASE_MOTION, backgroundVisibility: 'spotlight-reveal', pathVisibility: 'instantaneous', pathTrail: 0.3 }
    });
    const player = await makePlayerFromSnapshot(app._buildProjectSnapshot());

    const appTimeline = timelineFingerprint(app.animationEngine);
    const playerTimeline = timelineFingerprint(player.animationEngine);

    expect(appTimeline.introTime).toBeGreaterThan(0);     // reveal intro counted
    expect(appTimeline.totalTailTime).toBeGreaterThan(0); // comet trail tail counted
    expect(playerTimeline).toEqual(appTimeline);
  });

  test('scene and emitters survive; the swarm is deterministic across players', async () => {
    const app = makeAuthoredApp({ motionSettings: { ...BASE_MOTION } });
    const snapshot = app._buildProjectSnapshot();
    const player1 = await makePlayerFromSnapshot(snapshot);
    const player2 = await makePlayerFromSnapshot(snapshot);

    const layers1 = player1.scene.getFlowLayers();
    expect(layers1).toHaveLength(2);
    expect(layers1[0].emitters[0].seed).toBe(42);
    expect(layers1[0].emitters[0].busynessEnvelope).toHaveLength(3);
    expect(layers1[1].emitters[0].seed).toBe(7);

    const context1 = {
      durationMs: player1.animationEngine.state.duration,
      routePathPoints: player1.pathPoints
    };
    const context2 = {
      durationMs: player2.animationEngine.state.duration,
      routePathPoints: player2.pathPoints
    };
    // Mid-release-window instant: dots exist and are byte-identical across
    // independent players — hash(seed, dotIndex, hopIndex), no hidden state
    const t = 0.4 * context1.durationMs;
    const dots1 = layers1.map(layer => player1.swarmEngine.evaluate(t, layer, context1));
    const dots2 = player2.scene.getFlowLayers().map(layer => player2.swarmEngine.evaluate(t, layer, context2));

    expect(dots1.some(dotList => dotList.length > 0)).toBe(true);
    expect(JSON.parse(JSON.stringify(dots1))).toEqual(JSON.parse(JSON.stringify(dots2)));
  });

  test('includeText=false flows into the player suppressLabels rule', async () => {
    const app = makeAuthoredApp({ motionSettings: { ...BASE_MOTION } });
    app.exportSettings.includeText = false;
    const player = await makePlayerFromSnapshot(app._buildProjectSnapshot());
    expect(player.exportSettings.includeText).toBe(false);
  });
});
