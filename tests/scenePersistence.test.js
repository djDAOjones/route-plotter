import { describe, test, expect } from 'vitest';
import { persistenceMixin } from '../src/app/persistence.js';
import { undoRedoMixin } from '../src/app/undoRedo.js';
import { Scene } from '../src/models/Scene.js';

/**
 * Persistence contract for the coordVersion 9 layered-scene format
 * (decision-log 2026-08-17): v9 = v7 + additive `scene` block, 8 skipped.
 * The mixins run bound to the RoutePlotter instance, so these tests bind
 * them to a minimal fake app exposing just the state each path touches.
 * Full-app behaviour is covered by the interactive browser pass.
 */

/** Serialised scene fixture: one graph-guided layer, one seeded emitter. */
function buildSceneData() {
  const scene = new Scene();
  const layer = scene.addFlowLayer({ name: 'Crowd' });
  const entry = layer.graph.addNode({ x: 0.1, y: 0.5, type: 'entry' });
  const exit = layer.graph.addNode({ x: 0.9, y: 0.5, type: 'exit' });
  layer.graph.addEdge({ sourceId: entry.id, targetId: exit.id });
  layer.addEmitter({
    seed: 42,
    dotCount: 30,
    speedVariance: 0.75,
    onsetVariance: 0.8,
    intensityRamp: -0.4,
    busynessEnvelope: [
      { time: 0, value: 0.1, transition: 'step' },
      { time: 0.5, value: 1, transition: 'gradual' },
      { time: 1, value: 0.2, transition: 'gradual' },
    ],
    wobble: 0.6,
  });
  return scene.toJSON();
}

/** Minimal RoutePlotter stand-in for binding the persistence mixin. */
function makeFakeApp() {
  const captured = { autosaved: null, cleared: false, zipped: null };
  const app = {
    scene: new Scene(),
    waypoints: [],
    waypointsById: new Map(),
    styles: {},
    background: { overlay: 0, fit: 'fit', image: null },
    exportSettings: {
      frameRate: 30, pathOnly: false, resolutionX: 1920, resolutionY: 1080,
      backgroundZoom: 100, includeCamera: true, includeText: true,
    },
    motionSettings: {},
    elements: {},
    selectedWaypoint: null,
    animationEngine: {
      state: { mode: 'constant-speed', speed: 5, duration: 10 },
      pause() {}, seekToProgress() {}, setMode() {}, setSpeed() {},
      setDuration() {}, setPlaybackSpeed() {},
    },
    storageService: {
      autoSave(data) { captured.autosaved = data; },
      loadAutoSave() { return app._autosavePayload; },
      clearAutoSave() { captured.cleared = true; },
    },
    imageAssetService: {
      exceedsAutosaveLimit() { return false; },
      getAssetCount() { return 0; },
      getFormattedTotalSize() { return '0 B'; },
      toJSON() { return []; },
      fromJSON() {},
      async exportZip(projectData) { captured.zipped = projectData; return new Blob(); },
      async importZip() { return { projectData: app._zipPayload, backgroundBase64: null }; },
      downloadZip() {},
    },
    _autosavePayload: null,
    _zipPayload: null,
    // App methods the load/save paths call — no-ops for the contract tests
    markDirty() {}, updateTitleDirtyState() {}, updateTitleIndicator() {},
    announce() {}, calculatePath() {}, updateWaypointList() {}, render() {},
    queueRender() {}, beginBatch() {}, endBatch() {},
    _addWaypointToMap() {}, _restoreWaypointCustomImages() {},
    _syncGlobalStyleUI() {},
    // Real mixin method, not a stub: autoSave/export both build the snapshot
    // through it (Phase 5), so the contract keeps pinning the real shape
    _buildProjectSnapshot: persistenceMixin._buildProjectSnapshot,
    clearAll() { app.waypoints = []; app.scene.clear(); },
    _captured: captured,
  };
  return app;
}

describe('coordVersion 9 scene persistence', () => {

  describe('autoSave', () => {
    test('should write coordVersion 9 with an additive scene block, legacy keys intact', () => {
      const app = makeFakeApp();
      app.scene.fromJSON(buildSceneData());

      persistenceMixin.autoSave.call(app);

      const data = app._captured.autosaved;
      expect(data.coordVersion).toBe(9);
      expect(data.scene.flowLayers).toHaveLength(1);
      expect(data.scene.flowLayers[0].emitters[0]).toMatchObject({
        seed: 42,
        speedVariance: 0.75,
        onsetVariance: 0.8,
        intensityRamp: -0.4,
        busynessEnvelope: [
          { time: 0, value: 0.1, transition: 'step' },
          { time: 0.5, value: 1, transition: 'gradual' },
          { time: 1, value: 0.2, transition: 'gradual' },
        ],
        wobble: 0.6,
      });
      // Additive: every v7 top-level key survives
      for (const key of ['waypoints', 'styles', 'animationState', 'background',
        'exportSettings', 'motionSettings', 'imageAssets']) {
        expect(data).toHaveProperty(key);
      }
    });

    test('an empty scene should serialise as an empty flowLayers list', () => {
      const app = makeFakeApp();
      persistenceMixin.autoSave.call(app);
      expect(app._captured.autosaved.scene).toEqual({ flowLayers: [] });
    });
  });

  describe('saveProject (ZIP)', () => {
    test('should write coordVersion 9 and the scene block into the project file', async () => {
      const app = makeFakeApp();
      app.scene.fromJSON(buildSceneData());

      await persistenceMixin.saveProject.call(app);

      expect(app._captured.zipped.coordVersion).toBe(9);
      expect(app._captured.zipped.scene.flowLayers[0].name).toBe('Crowd');
    });
  });

  describe('loadAutosave backward compatibility', () => {
    test('a v7 autosave (no scene block) should load with an empty scene', async () => {
      const app = makeFakeApp();
      app._autosavePayload = { coordVersion: 7, waypoints: [] };

      await persistenceMixin.loadAutosave.call(app);

      expect(app.scene.isEmpty()).toBe(true);
      expect(app._captured.cleared).toBe(false);
    });

    test('a v9 autosave should hydrate the scene', async () => {
      const app = makeFakeApp();
      app._autosavePayload = { coordVersion: 9, waypoints: [], scene: buildSceneData() };

      await persistenceMixin.loadAutosave.call(app);

      expect(app.scene.getFlowLayers()).toHaveLength(1);
      const layer = app.scene.getFlowLayers()[0];
      expect(layer.graph.getNodes()).toHaveLength(2);
      expect(layer.emitters[0]).toMatchObject({
        seed: 42,
        speedVariance: 0.75,
        onsetVariance: 0.8,
        intensityRamp: -0.4,
        busynessEnvelope: [
          { time: 0, value: 0.1, transition: 'step' },
          { time: 0.5, value: 1, transition: 'gradual' },
          { time: 1, value: 0.2, transition: 'gradual' },
        ],
        wobble: 0.6,
      });
    });

    test('a pre-v6 autosave should still be cleared by the version gate', async () => {
      const app = makeFakeApp();
      app._autosavePayload = { coordVersion: 5 };

      await persistenceMixin.loadAutosave.call(app);

      expect(app._captured.cleared).toBe(true);
      expect(app.scene.isEmpty()).toBe(true);
    });
  });

  describe('loadProject backward compatibility', () => {
    test('a v7 project ZIP should load with an empty scene', async () => {
      const app = makeFakeApp();
      app.scene.addFlowLayer({ name: 'Stale layer' }); // must not survive the load
      app._zipPayload = { coordVersion: 7, waypoints: [] };

      await persistenceMixin.loadProject.call(app, new Blob());

      expect(app.scene.isEmpty()).toBe(true);
    });

    test('a v9 project ZIP should hydrate the scene', async () => {
      const app = makeFakeApp();
      app._zipPayload = { coordVersion: 9, waypoints: [], scene: buildSceneData() };

      await persistenceMixin.loadProject.call(app, new Blob());

      expect(app.scene.getFlowLayers().map(l => l.name)).toEqual(['Crowd']);
    });
  });

  describe('undo snapshot', () => {
    test('should include the scene so Phase 4 editing undoes by construction', () => {
      const app = makeFakeApp();
      app.scene.fromJSON(buildSceneData());

      const snapshot = undoRedoMixin._getUndoableState.call(app);

      expect(snapshot.scene.flowLayers).toHaveLength(1);
      expect(snapshot.scene.flowLayers[0].emitters[0].seed).toBe(42);
      // Snapshot is serialised data, not live references
      app.scene.clear();
      expect(snapshot.scene.flowLayers).toHaveLength(1);
    });
  });
});
