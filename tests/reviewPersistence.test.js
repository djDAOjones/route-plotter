import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { persistenceMixin, PROJECT_MODEL_LIMITS } from '../src/app/persistence.js';
import { undoRedoMixin } from '../src/app/undoRedo.js';
import { Scene } from '../src/models/Scene.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { ImageAssetService } from '../src/services/ImageAssetService.js';
import { STORAGE_LIMITS, StorageService } from '../src/services/StorageService.js';
import { UndoService } from '../src/services/UndoService.js';
import { invalidateProjectOperations } from '../src/app/operationGeneration.js';
import { localStorageMock } from './setup.js';

const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function makeAsset(id, name = `${id}.png`) {
  const { byteLength } = ImageAsset.inspectDataURL(PIXEL_PNG);
  const asset = new ImageAsset({
    id,
    base64: PIXEL_PNG,
    name,
    width: 1,
    height: 1,
    mimeType: 'image/png',
    size: byteLength,
  });
  asset._imageElement = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
  return asset;
}

function makeApp() {
  const imageAssetService = new ImageAssetService();
  const oldAsset = makeAsset('old-asset');
  imageAssetService.addAsset(oldAsset);

  const oldWaypoint = Waypoint.fromJSON({ id: 'old-wp', imgX: 0.1, imgY: 0.2, label: 'Old' });
  const scene = new Scene();
  scene.addFlowLayer({ id: 'old-layer', name: 'Old layer' });
  const undoService = new UndoService({ emit: vi.fn() });
  undoService.saveState({ revision: 1 });
  undoService.saveState({ revision: 2 });

  const storageService = {
    autoSave: vi.fn(() => ({ ok: true, pending: true })),
    cancelAutoSave: vi.fn(),
    saveAutoSave: vi.fn(() => true),
    clearAutoSave: vi.fn(() => true),
    loadAutoSave: vi.fn(),
  };
  const animationState = {
    mode: 'constant-speed', speed: 5, duration: 10, playbackSpeed: 1,
    progress: 0, pathProgress: 0, currentTime: 0, isPlaying: false, isPaused: false,
  };
  const uiController = {
    setPlaybackSpeed: vi.fn(),
    setSelection: vi.fn(),
    setTrailValue: vi.fn(),
    trailFractionToSlider: vi.fn(value => value),
    updateTrailControlVisibility: vi.fn(),
  };

  const app = {
    waypoints: [oldWaypoint],
    waypointsById: new Map([[oldWaypoint.id, oldWaypoint]]),
    scene,
    styles: {
      pathColor: '#111111',
      graphicsScale: 1,
      pathHead: { style: 'arrow', image: null, imageAssetId: null, size: 8 },
    },
    background: { image: null, overlay: 0, fit: 'fit' },
    exportSettings: {
      frameRate: 30, pathOnly: false, resolutionX: 1920, resolutionY: 1080,
      backgroundZoom: 100, includeCamera: true, includeText: true,
    },
    motionSettings: {
      pathVisibility: 'progressive', pathTrail: 1, waypointVisibility: 'show',
      backgroundVisibility: 'always', revealSize: 20, revealFeather: 10,
      aovAngle: 90, aovDistance: 25, aovDropoff: 20,
    },
    imageAssetService,
    storageService,
    undoService,
    uiController,
    interactionHandler: { setSelectedWaypoint: vi.fn() },
    animationEngine: {
      state: animationState,
      _currentPauseState: { isWaiting: false, waypointProgress: 0, elapsed: 0, total: 0 },
      setMode(value) { animationState.mode = value; },
      setSpeed(value) { animationState.speed = value; },
      setDuration(value) { animationState.duration = value; },
      setPlaybackSpeed(value) { animationState.playbackSpeed = value; },
      pause: vi.fn(() => {
        animationState.isPaused = true;
        animationState.playbackSpeed = 1;
      }),
      seekToProgress: vi.fn(progress => {
        animationState.progress = progress;
        animationState.pathProgress = progress;
        animationState.currentTime = progress * animationState.duration;
      }),
      restoreTransportState: vi.fn(snapshot => {
        animationState.progress = snapshot.timelineProgress;
        animationState.pathProgress = snapshot.timelineProgress;
        animationState.currentTime = snapshot.timelineProgress * animationState.duration;
        animationState.isPlaying = snapshot.isPlaying;
        animationState.isPaused = snapshot.isPaused;
        animationState.playbackSpeed = snapshot.playbackSpeed;
      }),
    },
    elements: {},
    selectedWaypoint: oldWaypoint,
    selectedWaypoints: [oldWaypoint],
    selectedCrowd: scene.getFlowLayers()[0],
    pathPoints: [{ x: 1, y: 1 }],
    displayWidth: 1000,
    displayHeight: 600,
    renderReference: { width: 1000, height: 600 },
    _isDirty: true,
    announce: vi.fn(),
    clearAll: vi.fn(),
    updateLayersStrip: vi.fn(),
    _syncGlobalStyleUI: vi.fn(),
    updateWaypointList: vi.fn(),
    updateWaypointEditor: vi.fn(),
    render: vi.fn(),
    calculatePath: vi.fn(),
    updateTitleIndicator: vi.fn(),
    updateImageTransform: vi.fn(),
    updateTimeDisplay: vi.fn(),
    _updatePlayPauseUI: vi.fn(),
    _jklDirection: 0,
    _jklSpeedMultiplier: 1,
    jklDirection: 0,
    jklSpeed: 1,
    _buildProjectSnapshot: persistenceMixin._buildProjectSnapshot,
    _getUndoableState() {
      return undoRedoMixin._getUndoableState.call(this);
    },
    pruneImageAssets() {
      return undoRedoMixin.pruneImageAssets.call(this);
    },
  };
  return app;
}

function validProject(overrides = {}) {
  return {
    coordVersion: 9,
    waypoints: [],
    scene: { flowLayers: [] },
    styles: {},
    animationState: { mode: 'constant-speed', speed: 5, duration: 0 },
    background: { overlay: 0, fit: 'fit' },
    exportSettings: {
      frameRate: 30, pathOnly: false, resolutionX: 1920, resolutionY: 1080,
      backgroundZoom: 100, includeCamera: true, includeText: true,
    },
    motionSettings: {},
    ...overrides,
  };
}

function makeUndoRestoreApp(imageAssetService) {
  const headPreviewImg = document.createElement('img');
  headPreviewImg.src = PIXEL_PNG;
  return {
    waypoints: [],
    waypointsById: new Map(),
    selectedWaypoint: null,
    selectedWaypoints: [],
    styles: {
      graphicsScale: 1,
      pathHead: {
        style: 'custom', image: { old: true }, imageAssetId: 'old-head',
        color: '#111111', size: 8,
      },
    },
    scene: new Scene(),
    imageAssetService,
    elements: {
      headPreview: { style: { display: 'block' } },
      headFilename: { textContent: 'old.png' },
      headPreviewImg,
    },
    pathPoints: [],
    _majorWaypointsCache: null,
    _addWaypointToMap(waypoint) { this.waypointsById.set(waypoint.id, waypoint); },
    uiController: { setSelection: vi.fn() },
    interactionHandler: { setSelectedWaypoint: vi.fn() },
    resolveCrowdSelectionAfterRestore: vi.fn(),
    resolveNetworkAfterRestore: vi.fn(),
    _syncGlobalStyleUI: vi.fn(),
    calculatePath: vi.fn(),
    updateWaypointList: vi.fn(),
    updateWaypointEditor: vi.fn(),
    render: vi.fn(),
    queueRender: vi.fn(),
    autoSave: vi.fn(),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushImageHydration() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  localStorageMock.getItem.mockReset();
  localStorageMock.setItem.mockReset();
  localStorageMock.removeItem.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('StorageService autosave honesty and lifecycle', () => {
  test('a failed delayed write is neither cached nor logged as success and can be retried', () => {
    vi.useFakeTimers();
    const service = new StorageService();
    const results = [];
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(service.autoSave({ revision: 1 }, result => results.push(result)).ok).toBe(true);
    vi.runAllTimers();

    expect(results[0].ok).toBe(false);
    expect(service._lastSerialized).toBe(null);
    expect(debug).not.toHaveBeenCalledWith('Auto-saved state');

    expect(service.autoSave({ revision: 1 }).pending).toBe(true);
    vi.runAllTimers();
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);
    expect(service._lastSerialized).toBe('{"revision":1}');
  });

  test('pending writes can be flushed or cancelled deterministically', () => {
    vi.useFakeTimers();
    const service = new StorageService();

    service.autoSave({ revision: 1 });
    expect(service.cancelAutoSave()).toBe(true);
    vi.runAllTimers();
    expect(localStorageMock.setItem).not.toHaveBeenCalled();

    service.autoSave({ revision: 2 });
    expect(service.flushAutoSave()).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    expect(localStorageMock.setItem.mock.calls[0][1]).toBe('{"revision":2}');
  });

  test('pagehide flushes the latest debounced recovery state', () => {
    vi.useFakeTimers();
    const service = new StorageService();
    const lifecycle = new EventTarget();
    service.attachLifecycle(lifecycle);

    service.autoSave({ revision: 3 });
    lifecycle.dispatchEvent(new Event('pagehide'));

    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    expect(localStorageMock.setItem.mock.calls[0][1]).toBe('{"revision":3}');
    vi.runAllTimers();
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);

    service.detachLifecycle();
  });

  test('clearAutoSave cancels a stale pending write before removing storage', () => {
    vi.useFakeTimers();
    const service = new StorageService();
    service.autoSave({ stale: true });

    expect(service.clearAutoSave()).toBe(true);
    vi.runAllTimers();

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(localStorageMock.removeItem).toHaveBeenCalledTimes(1);
  });
});

describe('transactional project loading', () => {
  test('Open Project resolving after Clear cannot replace the cleared baseline', async () => {
    const app = makeApp();
    const imported = deferred();
    vi.spyOn(app.imageAssetService, 'importZip').mockReturnValue(imported.promise);
    const pending = persistenceMixin.loadProject.call(app, { name: 'slow.zip' });

    invalidateProjectOperations(app); // clearAll() invalidates the open request
    imported.resolve({
      projectData: validProject({
        waypoints: [{ id: 'late', imgX: 0.5, imgY: 0.5 }],
      }),
      backgroundBase64: null,
      imageAssets: [],
    });

    await expect(pending).resolves.toBe(false);
    expect(app.waypoints.map(waypoint => waypoint.id)).toEqual(['old-wp']);
    expect(app.storageService.saveAutoSave).not.toHaveBeenCalled();
  });

  test('the latest of two Open Project operations wins regardless of decode order', async () => {
    const app = makeApp();
    const first = deferred();
    const second = deferred();
    vi.spyOn(app.imageAssetService, 'importZip')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstLoad = persistenceMixin.loadProject.call(app, { name: 'first.zip' });
    const secondLoad = persistenceMixin.loadProject.call(app, { name: 'second.zip' });
    second.resolve({
      projectData: validProject({ waypoints: [{ id: 'second', imgX: 0.2, imgY: 0.3 }] }),
      backgroundBase64: null,
      imageAssets: [],
    });
    await expect(secondLoad).resolves.toBe(true);

    first.resolve({
      projectData: validProject({ waypoints: [{ id: 'first', imgX: 0.7, imgY: 0.8 }] }),
      backgroundBase64: null,
      imageAssets: [],
    });
    await expect(firstLoad).resolves.toBe(false);

    expect(app.waypoints.map(waypoint => waypoint.id)).toEqual(['second']);
    expect(app.storageService.saveAutoSave).toHaveBeenCalledTimes(1);
  });

  test('validation failure leaves live state, assets, autosave and history unchanged', async () => {
    const app = makeApp();
    const prune = vi.spyOn(app, 'pruneImageAssets');
    const before = {
      waypoint: app.waypoints[0],
      scene: app.scene.toJSON(),
      assets: app.imageAssetService.getAssetIds(),
      undo: app.undoService.createSnapshot(),
      dirty: app._isDirty,
    };
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: validProject({
        scene: { flowLayers: [{ emitters: [{ dotCount: Infinity }] }] },
      }),
      backgroundBase64: null,
      imageAssets: [],
    });

    await persistenceMixin.loadProject.call(app, new Blob(['bad']));

    expect(app.waypoints[0]).toBe(before.waypoint);
    expect(app.scene.toJSON()).toEqual(before.scene);
    expect(app.imageAssetService.getAssetIds()).toEqual(before.assets);
    expect(app.undoService.createSnapshot()).toEqual(before.undo);
    expect(app._isDirty).toBe(before.dirty);
    expect(app.storageService.cancelAutoSave).not.toHaveBeenCalled();
    expect(app.storageService.saveAutoSave).not.toHaveBeenCalled();
    expect(app.clearAll).not.toHaveBeenCalled();
    expect(prune).not.toHaveBeenCalled();
  });

  test('legacy projects seed visual sizing from timingReference, while an explicit render reference wins', async () => {
    const app = makeApp();
    vi.spyOn(app.imageAssetService, 'importZip')
      .mockResolvedValueOnce({
        projectData: validProject({ timingReference: { width: 900, height: 500 } }),
        backgroundBase64: null,
        imageAssets: [],
      })
      .mockResolvedValueOnce({
        projectData: validProject({
          timingReference: { width: 900, height: 500 },
          renderReference: { width: 1200, height: 700 },
        }),
        backgroundBase64: null,
        imageAssets: [],
      });

    await expect(persistenceMixin.loadProject.call(app, { name: 'legacy.zip' })).resolves.toBe(true);
    expect(app.renderReference).toEqual({ width: 900, height: 500 });

    await expect(persistenceMixin.loadProject.call(app, { name: 'current.zip' })).resolves.toBe(true);
    expect(app.renderReference).toEqual({ width: 1200, height: 700 });
  });

  test('invalid visual references are rejected before the current project can change', async () => {
    const app = makeApp();
    const beforeReference = app.renderReference;
    const beforeWaypoint = app.waypoints[0];
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: validProject({ renderReference: { width: 0, height: 600 } }),
      backgroundBase64: null,
      imageAssets: [],
    });

    await expect(persistenceMixin.loadProject.call(app, { name: 'bad-reference.zip' }))
      .resolves.toBe(false);

    expect(app.renderReference).toBe(beforeReference);
    expect(app.waypoints[0]).toBe(beforeWaypoint);
    expect(app.storageService.saveAutoSave).not.toHaveBeenCalled();
  });

  test.each([
    ['waypoint', oversizedId => validProject({
      waypoints: [{ id: oversizedId, imgX: 0.2, imgY: 0.3 }],
    })],
    ['flow layer', oversizedId => validProject({
      scene: { flowLayers: [{ id: oversizedId, graph: { nodes: [], edges: [] } }] },
    })],
    ['emitter', oversizedId => validProject({
      scene: { flowLayers: [{
        id: 'layer', graph: { nodes: [], edges: [] }, emitters: [{ id: oversizedId }],
      }] },
    })],
    ['graph node', oversizedId => validProject({
      scene: { flowLayers: [{
        id: 'layer', graph: { nodes: [{ id: oversizedId, x: 0.5, y: 0.5 }], edges: [] },
      }] },
    })],
    ['graph edge', oversizedId => validProject({
      scene: { flowLayers: [{
        id: 'layer',
        graph: {
          nodes: [
            { id: 'source', x: 0.25, y: 0.5 },
            { id: 'target', x: 0.75, y: 0.5 },
          ],
          edges: [{ id: oversizedId, sourceId: 'source', targetId: 'target' }],
        },
      }] },
    })],
  ])('rejects an oversized %s id before replacing live project state', async (_label, makeProject) => {
    const app = makeApp();
    const beforeWaypoint = app.waypoints[0];
    const beforeScene = app.scene.toJSON();
    const oversizedId = 'x'.repeat(PROJECT_MODEL_LIMITS.MAX_ENTITY_ID_LENGTH + 1);
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: makeProject(oversizedId),
      backgroundBase64: null,
      imageAssets: [],
    });

    await expect(persistenceMixin.loadProject.call(app, { name: 'oversized-id.zip' }))
      .resolves.toBe(false);

    expect(app.waypoints[0]).toBe(beforeWaypoint);
    expect(app.scene.toJSON()).toEqual(beforeScene);
    expect(app.storageService.cancelAutoSave).not.toHaveBeenCalled();
    expect(app.storageService.saveAutoSave).not.toHaveBeenCalled();
  });

  test.each([
    {
      label: 'waypoint',
      project: validProject({
        waypoints: [{ id: 'hostile-waypoint', imgX: 0.2, imgY: 0.3, dotColor: 'url(https://example.invalid/waypoint)' }],
      }),
    },
    {
      label: 'route style',
      project: validProject({ styles: { pathColor: 'var(--hostile-colour)' } }),
    },
    {
      label: 'crowd emitter',
      project: validProject({
        scene: {
          flowLayers: [{
            id: 'hostile-layer',
            graph: { nodes: [], edges: [] },
            emitters: [{ id: 'hostile-emitter', dotColor: 'rgb(1, 2, 3)' }],
          }],
        },
      }),
    },
  ])('rejects hostile $label colours before replacing live project state', async ({ project }) => {
    const app = makeApp();
    const beforeWaypoint = app.waypoints[0];
    const beforeAssets = app.imageAssetService.getAssetIds();
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: project,
      backgroundBase64: null,
      imageAssets: [],
    });

    await expect(persistenceMixin.loadProject.call(app, { name: 'hostile.zip' }))
      .resolves.toBe(false);

    expect(app.waypoints[0]).toBe(beforeWaypoint);
    expect(app.imageAssetService.getAssetIds()).toEqual(beforeAssets);
    expect(app.storageService.saveAutoSave).not.toHaveBeenCalled();
  });

  test('reloads the transparent sentinel authored by None-capable swatches', async () => {
    const app = makeApp();
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: validProject({
        waypoints: [{
          id: 'transparent-wp', imgX: 0.2, imgY: 0.3,
          segmentColor: 'transparent',
          dotColor: 'transparent',
          areaHighlight: {
            enabled: true,
            shape: 'circle',
            fillColor: 'transparent',
            borderColor: 'transparent',
          },
        }],
        scene: {
          flowLayers: [{
            id: 'transparent-crowd',
            name: 'Transparent crowd',
            graph: { nodes: [], edges: [] },
            emitters: [{ id: 'transparent-emitter', dotColor: 'transparent' }],
          }],
        },
      }),
      imageAssets: [],
      backgroundBase64: null,
      projectName: 'transparent.zip',
    });

    await expect(persistenceMixin.loadProject.call(app, new Blob(['zip'])))
      .resolves.toBe(true);

    expect(app.waypoints[0]).toMatchObject({
      segmentColor: 'transparent',
      dotColor: 'transparent',
      areaHighlight: expect.objectContaining({
        fillColor: 'transparent',
        borderColor: 'transparent',
      }),
    });
    expect(app.scene.getFlowLayers()[0].emitters[0].dotColor).toBe('transparent');
  });

  test('successful load commits once, hydrates waypoint/head images and resets undo', async () => {
    const app = makeApp();
    app._autosaveAssetWarningShown = true;
    app._autosaveBackgroundWarningShown = true;
    app._autosaveFailureWarningShown = true;
    const newAsset = makeAsset('new-asset', 'marker.png');
    const orphanAsset = makeAsset('orphan-asset', 'orphan.png');
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: validProject({
        waypoints: [{
          id: 'new-wp', imgX: 0.25, imgY: 0.75,
          customImageAssetId: 'new-asset', markerStyle: 'custom',
        }],
        styles: { pathHead: { style: 'custom', imageAssetId: 'new-asset', size: 9 } },
      }),
      backgroundBase64: null,
      imageAssets: [newAsset, orphanAsset],
    });

    await persistenceMixin.loadProject.call(app, new Blob(['good']));

    expect(app.clearAll).not.toHaveBeenCalled();
    expect(app.waypoints.map(waypoint => waypoint.id)).toEqual(['new-wp']);
    expect(app.waypoints[0].customImage).toBe(newAsset._imageElement);
    expect(app.styles.pathHead.image).toBe(newAsset._imageElement);
    expect(app.imageAssetService.getAssetIds()).toEqual(['new-asset']);
    expect(app.undoService.canUndo()).toBe(false);
    expect(app.undoService.createSnapshot().undoStack).toHaveLength(1);
    expect(app.storageService.cancelAutoSave).toHaveBeenCalledTimes(1);
    expect(app.storageService.saveAutoSave).toHaveBeenCalledTimes(1);
    expect(app._isDirty).toBe(false);
    expect(app._autosaveAssetWarningShown).toBe(true);
    expect(app._autosaveBackgroundWarningShown).toBe(false);
    expect(app._autosaveFailureWarningShown).toBe(false);
    expect(app.updateImageTransform).toHaveBeenCalledWith(null);
    expect(app.render).toHaveBeenCalledTimes(1);

    const recovery = app.storageService.saveAutoSave.mock.calls[0][0];
    expect(recovery.imageAssets).toEqual([]);
    expect(recovery.waypoints[0]).toMatchObject({
      markerStyle: 'dot', customImage: null, customImageAssetId: null,
    });
    expect(recovery.styles.pathHead).toMatchObject({
      style: 'arrow', image: null, imageAssetId: null,
    });
    expect(JSON.stringify(recovery)).not.toContain('marker.png');
  });

  test('a prune failure during commit restores the prior model, assets and history', async () => {
    const app = makeApp();
    const priorWaypoint = app.waypoints[0];
    const priorAssets = app.imageAssetService.getAssets();
    const priorHistory = app.undoService.createSnapshot();
    const newAsset = makeAsset('new-asset');
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: validProject({
        waypoints: [{
          id: 'new-wp', imgX: 0.25, imgY: 0.75,
          customImageAssetId: 'new-asset', markerStyle: 'custom',
        }],
      }),
      backgroundBase64: null,
      imageAssets: [newAsset],
    });
    vi.spyOn(app, 'pruneImageAssets').mockImplementation(() => {
      throw new Error('prune failed');
    });

    await expect(persistenceMixin.loadProject.call(app, new Blob(['good'])))
      .resolves.toBe(false);

    expect(app.waypoints[0]).toBe(priorWaypoint);
    expect(app.imageAssetService.getAssets()).toEqual(priorAssets);
    expect(app.undoService.createSnapshot()).toEqual(priorHistory);
    expect(app.storageService.cancelAutoSave).not.toHaveBeenCalled();
    expect(app.storageService.saveAutoSave).not.toHaveBeenCalled();
    expect(app.announce).toHaveBeenLastCalledWith('Failed to load project: prune failed');
  });

  test('an older project uses canonical defaults instead of inheriting the live custom path head', async () => {
    const app = makeApp();
    app.styles.pathHead = {
      style: 'custom', image: { old: true }, imageAssetId: 'old-asset', size: 42,
    };
    app.exportSettings.frameRate = 120;
    app.motionSettings.aovAngle = 175;
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: {
        coordVersion: 7,
        waypoints: [],
        styles: { pathColor: '#abcdef' },
      },
      backgroundBase64: null,
      imageAssets: [],
    });

    await persistenceMixin.loadProject.call(app, new Blob(['legacy']));

    expect(app.styles.pathHead).toMatchObject({
      style: 'arrow', image: null, imageAssetId: null, size: 8,
    });
    expect(app.exportSettings.frameRate).toBe(25);
    expect(app.motionSettings.aovAngle).toBe(60);
    // REVEAL-01: a project authored before the trail control existed must come
    // back with the sentinel, so it still renders as a reveal that never fades.
    expect(app.motionSettings.revealTrail).toBe(100);
    expect(app.imageAssetService.getAssetIds()).toEqual([]);
    expect(app.updateImageTransform).toHaveBeenCalledWith(null);
  });

  test('loaded source bytes stay live for export but immediate recovery redacts them', async () => {
    const app = makeApp();
    const backgroundImage = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
    vi.spyOn(ImageAsset, 'decodeDataURL').mockResolvedValue(backgroundImage);
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: validProject(),
      backgroundBase64: PIXEL_PNG,
      imageAssets: [makeAsset('private-asset', 'private-source-name.png')],
    });

    await expect(persistenceMixin.loadProject.call(app, { name: 'source.zip' }))
      .resolves.toBe(true);

    expect(app._autosaveBackgroundCache).toEqual({
      image: backgroundImage,
      dataURL: PIXEL_PNG,
    });
    const recovery = app.storageService.saveAutoSave.mock.calls[0][0];
    const serialized = JSON.stringify(recovery);
    expect(recovery.imageAssets).toEqual([]);
    expect(recovery).not.toHaveProperty('backgroundImage');
    expect(serialized).not.toContain(PIXEL_PNG);
    expect(serialized).not.toContain('private-source-name.png');
  });

  test('a recovery-write failure remains the final perceivable load message', async () => {
    const app = makeApp();
    app.storageService.saveAutoSave.mockReturnValue(false);
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: validProject(),
      backgroundBase64: null,
      imageAssets: [],
    });

    await persistenceMixin.loadProject.call(app, new Blob(['good']));

    expect(app.storageService.clearAutoSave).toHaveBeenCalledTimes(1);
    expect(app.announce).toHaveBeenLastCalledWith(
      'Project loaded, but browser recovery is unavailable. Save the project file to keep it safe.'
    );
    expect(app.announce).not.toHaveBeenCalledWith('Project loaded');
  });

  test('a commit-time UI failure rolls back model, transform, path, controls and undo', async () => {
    const app = makeApp();
    const previousWaypoint = app.waypoints[0];
    const previousScene = app.scene.toJSON();
    const previousUndo = app.undoService.createSnapshot();
    const previousPath = app.pathPoints;
    const previousBackgroundImage = { width: 10, height: 10 };
    const previousStyles = app.styles;
    app.background.image = previousBackgroundImage;
    Object.assign(app.animationEngine.state, {
      duration: 10000,
      progress: 0.4,
      pathProgress: 0.4,
      currentTime: 4000,
      isPlaying: true,
      isPaused: false,
      playbackSpeed: -4,
    });
    Object.assign(app.animationEngine._currentPauseState, {
      isWaiting: true, waypointProgress: 0.4, elapsed: 250, total: 1000,
    });
    app._jklDirection = -1;
    app._jklSpeedMultiplier = 4;
    app.jklDirection = -1;
    app.jklSpeed = 4;
    app.animationEngine.seekToProgress.mockImplementation(progress => {
      app.animationEngine.state.progress = progress;
      app.animationEngine.state.pathProgress = progress;
      app.animationEngine.state.currentTime = progress * app.animationEngine.state.duration;
      Object.assign(app.animationEngine._currentPauseState, {
        isWaiting: false, waypointProgress: 0, elapsed: 0, total: 0,
      });
    });
    const newAsset = makeAsset('new-asset');
    app.calculatePath.mockImplementation(() => { app.pathPoints = [{ x: 9, y: 9 }]; });
    app.render.mockImplementationOnce(() => { throw new Error('render failed'); });
    vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
      projectData: validProject({
        waypoints: [
          { id: 'new-wp-a', imgX: 0.25, imgY: 0.25 },
          { id: 'new-wp-b', imgX: 0.75, imgY: 0.75 },
        ],
      }),
      backgroundBase64: null,
      imageAssets: [newAsset],
    });

    await persistenceMixin.loadProject.call(app, new Blob(['good']));

    expect(app.waypoints[0]).toBe(previousWaypoint);
    expect(app.scene.toJSON()).toEqual(previousScene);
    expect(app.imageAssetService.getAssetIds()).toEqual(['old-asset']);
    expect(app.undoService.createSnapshot()).toEqual(previousUndo);
    expect(app.styles).toBe(previousStyles);
    expect(app.background.image).toBe(previousBackgroundImage);
    expect(app.pathPoints).toBe(previousPath);
    expect(app.updateImageTransform.mock.calls.map(call => call[0])).toEqual([
      null,
      previousBackgroundImage,
    ]);
    expect(app.updateLayersStrip).toHaveBeenCalledTimes(2);
    expect(app._syncGlobalStyleUI).toHaveBeenCalledTimes(2);
    expect(app.updateWaypointList).toHaveBeenCalledTimes(2);
    expect(app.updateWaypointEditor).toHaveBeenCalledTimes(1);
    expect(app.updateTitleIndicator).toHaveBeenCalledTimes(1);
    expect(app.render).toHaveBeenCalledTimes(2);
    expect(app.animationEngine.restoreTransportState).toHaveBeenCalledWith({
      timelineProgress: 0.4,
      isPlaying: true,
      isPaused: false,
      playbackSpeed: -4,
    });
    expect(app.animationEngine.state).toMatchObject({
      progress: 0.4,
      currentTime: 4000,
      isPlaying: true,
      isPaused: false,
      playbackSpeed: -4,
    });
    expect(app.animationEngine._currentPauseState).toEqual({
      isWaiting: true, waypointProgress: 0.4, elapsed: 250, total: 1000,
    });
    expect([app._jklDirection, app._jklSpeedMultiplier, app.jklDirection, app.jklSpeed])
      .toEqual([-1, 4, -1, 4]);
    expect(app.uiController.setPlaybackSpeed).toHaveBeenLastCalledWith(-4);
    expect(app.uiController.setTrailValue).toHaveBeenLastCalledWith(1);
    expect(app._updatePlayPauseUI).toHaveBeenCalledTimes(1);
    expect(app.updateTimeDisplay).toHaveBeenCalledWith(4000, 10000);
    expect(app.storageService.cancelAutoSave).not.toHaveBeenCalled();
    expect(app.storageService.saveAutoSave).not.toHaveBeenCalled();
    expect(app.announce).toHaveBeenLastCalledWith('Failed to load project: render failed');
  });

  test('autosave is model-only even when custom assets and background bytes fit', () => {
    const app = makeApp();
    const saved = {};
    app.markDirty = vi.fn();
    app.imageAssetService.clear();
    app.imageAssetService.addAsset(makeAsset('marker', 'private-original-filename.png'));
    app.waypoints = [Waypoint.fromJSON({
      id: 'custom-wp', imgX: 0.4, imgY: 0.6,
      markerStyle: 'custom', customImageAssetId: 'marker',
    })];
    app.styles.pathHead = {
      ...app.styles.pathHead,
      style: 'custom', image: { id: 'head-image' }, imageAssetId: 'marker',
    };
    app.background.image = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
    app._autosaveBackgroundCache = { image: app.background.image, dataURL: PIXEL_PNG };
    app.storageService.autoSave.mockImplementation((snapshot) => {
      saved.snapshot = snapshot;
      return { ok: true, pending: true };
    });
    const canvasEncoding = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');
    const assetSerialization = vi.spyOn(app.imageAssetService, 'toJSON');

    persistenceMixin.autoSave.call(app);

    expect(saved.snapshot.imageAssets).toEqual([]);
    expect(saved.snapshot).not.toHaveProperty('backgroundImage');
    expect(saved.snapshot.waypoints[0]).toMatchObject({
      markerStyle: 'dot', customImage: null, customImageAssetId: null,
    });
    expect(saved.snapshot.styles.pathHead).toMatchObject({
      style: 'arrow', image: null, imageAssetId: null,
    });
    const serialized = JSON.stringify(saved.snapshot);
    expect(serialized).not.toContain(PIXEL_PNG);
    expect(serialized).not.toContain('private-original-filename.png');
    expect(canvasEncoding).not.toHaveBeenCalled();
    expect(assetSerialization).not.toHaveBeenCalled();
  });

  test('base64 expansion falls back to a loadable model-only recovery snapshot', async () => {
    const app = makeApp();
    const saved = {};
    const binaryBytesAtOldThreshold = 3 * 1024 * 1024;
    const expandedBase64 = 'A'.repeat(Math.ceil(binaryBytesAtOldThreshold * 4 / 3));
    const waypoint = Waypoint.fromJSON({
      id: 'custom-wp', imgX: 0.4, imgY: 0.6,
      markerStyle: 'custom', customImageAssetId: 'large-asset',
    });
    app.waypoints = [waypoint];
    app.styles.pathHead = {
      ...app.styles.pathHead,
      style: 'custom', image: { old: true }, imageAssetId: 'large-asset',
    };
    app.markDirty = vi.fn();
    app.imageAssetService.clear();
    app.imageAssetService.addAsset(makeAsset('large-asset'));
    vi.spyOn(app.imageAssetService, 'toJSON').mockReturnValue([{
      id: 'large-asset',
      base64: `data:image/png;base64,${expandedBase64}`,
      name: 'large.png',
      width: 1,
      height: 1,
      mimeType: 'image/png',
      size: binaryBytesAtOldThreshold,
    }]);
    app.storageService.autoSave.mockImplementation(snapshot => {
      saved.snapshot = snapshot;
      return { ok: true, pending: true };
    });

    persistenceMixin.autoSave.call(app);
    persistenceMixin.autoSave.call(app);

    expect(new TextEncoder().encode(JSON.stringify(saved.snapshot)).length)
      .toBeLessThanOrEqual(STORAGE_LIMITS.AUTOSAVE_SERIALIZED_MAX);
    expect(saved.snapshot.imageAssets).toEqual([]);
    expect(saved.snapshot.waypoints[0]).toMatchObject({
      markerStyle: 'dot', customImage: null, customImageAssetId: null,
    });
    expect(saved.snapshot.styles.pathHead).toMatchObject({
      style: 'arrow', image: null, imageAssetId: null,
    });
    expect(app.announce.mock.calls.filter(([message]) => message.includes('custom images'))).toHaveLength(1);

    const restoreApp = makeApp();
    restoreApp.storageService.loadAutoSave.mockReturnValue(saved.snapshot);
    await expect(persistenceMixin.loadAutosave.call(restoreApp)).resolves.toBe(true);
    expect(restoreApp.waypoints[0]).toMatchObject({
      markerStyle: 'dot', customImage: null, customImageAssetId: null,
    });
    expect(restoreApp.styles.pathHead).toMatchObject({
      style: 'arrow', image: null, imageAssetId: null,
    });
  });

  test('legacy rich recovery is restored once and immediately rewritten model-only', async () => {
    const app = makeApp();
    const privateAsset = makeAsset('legacy-asset', 'legacy-private-name.png');
    const decodedImage = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
    vi.spyOn(ImageAsset, 'decodeDataURL').mockResolvedValue(decodedImage);
    app.storageService.loadAutoSave.mockReturnValue({
      ...validProject({
        waypoints: [{
          id: 'legacy-wp', imgX: 0.2, imgY: 0.3,
          markerStyle: 'custom', customImageAssetId: 'legacy-asset',
        }],
        styles: {
          pathHead: { style: 'custom', imageAssetId: 'legacy-asset', size: 8 },
        },
      }),
      imageAssets: [privateAsset.toJSON()],
      backgroundImage: PIXEL_PNG,
    });

    await expect(persistenceMixin.loadAutosave.call(app)).resolves.toBe(true);

    // The live restored project still has the explicitly recovered images.
    expect(app.imageAssetService.getAssetIds()).toEqual(['legacy-asset']);
    expect(app.background.image).toBe(decodedImage);
    expect(app._autosaveBackgroundCache?.dataURL).toBe(PIXEL_PNG);

    // The browser record is immediately migrated to the privacy boundary.
    const replacement = app.storageService.saveAutoSave.mock.calls[0][0];
    const serialized = JSON.stringify(replacement);
    expect(replacement.imageAssets).toEqual([]);
    expect(replacement).not.toHaveProperty('backgroundImage');
    expect(replacement.waypoints[0]).toMatchObject({
      markerStyle: 'dot', customImage: null, customImageAssetId: null,
    });
    expect(replacement.styles.pathHead).toMatchObject({
      style: 'arrow', image: null, imageAssetId: null,
    });
    expect(serialized).not.toContain(PIXEL_PNG);
    expect(serialized).not.toContain('legacy-private-name.png');
  });

  test('legacy image bytes use image budgets instead of the metadata text-field cap', async () => {
    const app = makeApp();
    const payload = `iVBORw0KGgo${'A'.repeat(150001)}`;
    const largeDataURL = `data:image/png;base64,${payload}`;
    const { byteLength } = ImageAsset.inspectDataURL(largeDataURL);
    const privateAsset = new ImageAsset({
      id: 'legacy-large-asset',
      base64: largeDataURL,
      name: 'legacy-large-private-name.png',
      width: 1,
      height: 1,
      mimeType: 'image/png',
      size: byteLength,
    });
    const decodedImage = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
    vi.spyOn(ImageAsset, 'decodeDataURL').mockResolvedValue(decodedImage);
    expect(largeDataURL.length).toBeGreaterThan(PROJECT_MODEL_LIMITS.MAX_STRING_LENGTH);

    app.storageService.loadAutoSave.mockReturnValue({
      ...validProject({
        waypoints: [{
          id: 'legacy-large-wp', imgX: 0.2, imgY: 0.3,
          markerStyle: 'custom', customImageAssetId: 'legacy-large-asset',
        }],
      }),
      imageAssets: [privateAsset.toJSON()],
      backgroundImage: largeDataURL,
    });

    await expect(persistenceMixin.loadAutosave.call(app)).resolves.toBe(true);
    expect(app.imageAssetService.getAssetIds()).toEqual(['legacy-large-asset']);
    expect(app._autosaveBackgroundCache?.dataURL).toBe(largeDataURL);

    const replacement = app.storageService.saveAutoSave.mock.calls[0][0];
    const serialized = JSON.stringify(replacement);
    expect(replacement.imageAssets).toEqual([]);
    expect(replacement).not.toHaveProperty('backgroundImage');
    expect(serialized).not.toContain(largeDataURL);
    expect(serialized).not.toContain('legacy-large-private-name.png');
  });

  test('recovery exclusion is size-independent and warns once per image category', () => {
    const app = makeApp();
    const saved = {};
    const payloadLength = Math.floor(2.25 * 1024 * 1024);
    const largeDataURL = `data:image/png;base64,${'A'.repeat(payloadLength)}`;
    app.markDirty = vi.fn();
    app.imageAssetService.clear();
    app.imageAssetService.addAsset(makeAsset('marker'));
    const assetSerialization = vi.spyOn(app.imageAssetService, 'toJSON').mockReturnValue([{
      id: 'marker', base64: largeDataURL, name: 'marker.png',
      width: 1, height: 1, mimeType: 'image/png', size: payloadLength * 3 / 4,
    }]);
    app.background.image = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
    app.storageService.autoSave.mockImplementation(snapshot => {
      saved.snapshot = snapshot;
      return { ok: true, pending: true };
    });
    const canvasEncoding = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');

    persistenceMixin.autoSave.call(app);
    persistenceMixin.autoSave.call(app);

    expect(saved.snapshot.imageAssets).toEqual([]);
    expect(saved.snapshot).not.toHaveProperty('backgroundImage');
    expect(new TextEncoder().encode(JSON.stringify(saved.snapshot)).length)
      .toBeLessThanOrEqual(STORAGE_LIMITS.AUTOSAVE_SERIALIZED_MAX);
    expect(app.announce.mock.calls.filter(([message]) => message.includes('background'))).toHaveLength(1);
    expect(app.announce.mock.calls.filter(([message]) => message.includes('custom images'))).toHaveLength(1);
    expect(assetSerialization).not.toHaveBeenCalled();
    expect(canvasEncoding).not.toHaveBeenCalled();
  });

  test('a synchronous storage rejection is announced only once across callback and return paths', () => {
    const app = makeApp();
    app.markDirty = vi.fn();
    app.imageAssetService.clear();
    app.storageService.autoSave.mockImplementation((_snapshot, onResult) => {
      const result = { ok: false, error: new Error('quota') };
      onResult(result);
      return result;
    });

    persistenceMixin.autoSave.call(app);

    expect(app.announce.mock.calls.filter(([message]) => message.startsWith('Auto-save failed')))
      .toHaveLength(1);
  });
});

describe('project save revision tracking', () => {
  test('ZIP save passes the retained original background data URL unchanged', async () => {
    const app = makeApp();
    const backgroundImage = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
    app.background.image = backgroundImage;
    app._autosaveBackgroundCache = { image: backgroundImage, dataURL: PIXEL_PNG };
    app.imageAssetService.exportZip = vi.fn().mockResolvedValue(new Blob(['archive']));
    app.imageAssetService.downloadZip = vi.fn();
    const canvasEncoding = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');

    await persistenceMixin.saveProject.call(app);

    expect(app.imageAssetService.exportZip).toHaveBeenCalledTimes(1);
    expect(app.imageAssetService.exportZip.mock.calls[0][1]).toBe(PIXEL_PNG);
    expect(canvasEncoding).not.toHaveBeenCalled();
  });

  test('ZIP save fails clearly when live background source bytes are unavailable', async () => {
    const app = makeApp();
    app.background.image = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
    app._autosaveBackgroundCache = null;
    app.imageAssetService.exportZip = vi.fn();

    await persistenceMixin.saveProject.call(app);

    expect(app.imageAssetService.exportZip).not.toHaveBeenCalled();
    expect(app.announce).toHaveBeenLastCalledWith(expect.stringMatching(
      /Failed to save project: Original background bytes are unavailable/
    ));
  });

  test('an edit made while ZIP generation is pending remains dirty', async () => {
    const app = makeApp();
    app._editRevision = 4;
    app._projectGeneration = 2;
    app._isDirty = true;
    const exported = deferred();
    app.imageAssetService.exportZip = vi.fn(() => exported.promise);
    app.imageAssetService.downloadZip = vi.fn();

    const saving = persistenceMixin.saveProject.call(app);
    await Promise.resolve();
    persistenceMixin.markDirty.call(app);
    exported.resolve(new Blob(['snapshot']));
    await saving;

    expect(app.imageAssetService.downloadZip).toHaveBeenCalledTimes(1);
    expect(app._isDirty).toBe(true);
    expect(app.announce).toHaveBeenCalledWith('Project file saved; newer changes remain unsaved.');
  });
});

describe('undo image restoration', () => {
  test('rehydrates every waypoint custom image and the restored path head', async () => {
    const images = {
      'marker-a': { id: 'image-a' },
      'marker-b': { id: 'image-b' },
      'head-a': { id: 'head-image' },
    };
    const assets = {
      'head-a': { id: 'head-a', name: 'head.png', base64: PIXEL_PNG },
    };
    const imageAssetService = {
      getImageElement: vi.fn(id => Promise.resolve(images[id])),
      getAsset: vi.fn(id => assets[id] || null),
    };
    const app = makeUndoRestoreApp(imageAssetService);
    const state = {
      waypoints: [
        { id: 'wp-a', imgX: 0.2, imgY: 0.3, markerStyle: 'custom', customImageAssetId: 'marker-a' },
        { id: 'wp-b', imgX: 0.7, imgY: 0.8, markerStyle: 'custom', customImageAssetId: 'marker-b' },
      ],
      selectedWaypointId: null,
      selectedWaypointIds: [],
      styles: { pathHead: { style: 'custom', imageAssetId: 'head-a' } },
    };

    undoRedoMixin._restoreState.call(app, state);
    expect(app.waypoints.map(waypoint => waypoint.customImage)).toEqual([null, null]);
    expect(app.styles.pathHead.image).toBe(null);
    await flushImageHydration();

    expect(app.waypoints[0].customImage).toBe(images['marker-a']);
    expect(app.waypoints[1].customImage).toBe(images['marker-b']);
    expect(app.styles.pathHead.image).toBe(images['head-a']);
    expect(imageAssetService.getImageElement).toHaveBeenCalledTimes(3);
    expect(app.elements.headPreview.style.display).toBe('block');
    expect(app.elements.headFilename.textContent).toBe('head.png');
  });

  test('a restored null path-head asset clears the old image and preview synchronously', () => {
    const imageAssetService = {
      getImageElement: vi.fn(),
      getAsset: vi.fn(),
    };
    const app = makeUndoRestoreApp(imageAssetService);

    undoRedoMixin._restoreState.call(app, {
      waypoints: [],
      selectedWaypointId: null,
      selectedWaypointIds: [],
      styles: { pathHead: { style: 'arrow', imageAssetId: null } },
    });

    expect(app.styles.pathHead).toMatchObject({ style: 'arrow', image: null, imageAssetId: null });
    expect(app.elements.headPreview.style.display).toBe('none');
    expect(app.elements.headFilename.textContent).toBe('');
    expect(app.elements.headPreviewImg.hasAttribute('src')).toBe(false);
    expect(imageAssetService.getImageElement).not.toHaveBeenCalled();
  });

  test('late image resolutions from an older restore cannot overwrite the newer state', async () => {
    const pending = {
      'marker-a': deferred(),
      'marker-b': deferred(),
      'head-a': deferred(),
      'head-b': deferred(),
    };
    const assets = {
      'head-a': { id: 'head-a', name: 'head-a.png', base64: PIXEL_PNG },
      'head-b': { id: 'head-b', name: 'head-b.png', base64: PIXEL_PNG },
    };
    const imageAssetService = {
      getImageElement: vi.fn(id => pending[id].promise),
      getAsset: vi.fn(id => assets[id] || null),
    };
    const app = makeUndoRestoreApp(imageAssetService);
    const makeState = suffix => ({
      waypoints: [{
        id: 'same-waypoint', imgX: 0.5, imgY: 0.5,
        markerStyle: 'custom', customImageAssetId: `marker-${suffix}`,
      }],
      selectedWaypointId: null,
      selectedWaypointIds: [],
      styles: { pathHead: { style: 'custom', imageAssetId: `head-${suffix}` } },
    });

    undoRedoMixin._restoreState.call(app, makeState('a'));
    await Promise.resolve();
    undoRedoMixin._restoreState.call(app, makeState('b'));
    await Promise.resolve();

    const markerB = { id: 'marker-b-image' };
    const headB = { id: 'head-b-image' };
    pending['marker-b'].resolve(markerB);
    pending['head-b'].resolve(headB);
    await flushImageHydration();
    expect(app.waypoints[0].customImage).toBe(markerB);
    expect(app.styles.pathHead.image).toBe(headB);

    pending['marker-a'].resolve({ id: 'stale-marker' });
    pending['head-a'].resolve({ id: 'stale-head' });
    await flushImageHydration();
    expect(app.waypoints[0].customImage).toBe(markerB);
    expect(app.styles.pathHead.image).toBe(headB);
    expect(app.styles.pathHead.imageAssetId).toBe('head-b');
  });
});
