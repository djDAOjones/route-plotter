import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { clearProject } from '../src/app/projectReset.js';
import { undoRedoMixin } from '../src/app/undoRedo.js';
import {
  beginAsyncProjectOperation,
  isAsyncProjectOperationCurrent,
} from '../src/app/operationGeneration.js';
import { EventBus } from '../src/core/EventBus.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { Scene } from '../src/models/Scene.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { ImageAssetService } from '../src/services/ImageAssetService.js';
import { StorageService } from '../src/services/StorageService.js';
import { UndoService } from '../src/services/UndoService.js';
import { localStorageMock } from './setup.js';

const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function makeAsset() {
  const { byteLength } = ImageAsset.inspectDataURL(PIXEL_PNG);
  return new ImageAsset({
    id: 'marker',
    base64: PIXEL_PNG,
    name: 'marker.png',
    width: 1,
    height: 1,
    mimeType: 'image/png',
    size: byteLength,
  });
}

function makeApp() {
  const waypoint = Waypoint.fromJSON({
    id: 'waypoint',
    imgX: 0.25,
    imgY: 0.5,
    markerStyle: 'custom',
    customImageAssetId: 'marker',
  });
  const scene = new Scene();
  const crowd = scene.addFlowLayer({ id: 'crowd', name: 'Crowd' });
  const eventBus = new EventBus();
  const imageAssetService = new ImageAssetService();
  imageAssetService.addAsset(makeAsset());
  const storageService = new StorageService();
  const undoService = new UndoService(eventBus);
  const headPreviewImg = document.createElement('img');
  headPreviewImg.src = PIXEL_PNG;
  const app = {
    _editRevision: 3,
    _isDirty: true,
    waypoints: [waypoint],
    waypointsById: new Map([[waypoint.id, waypoint]]),
    scene,
    pathPoints: [{ x: 1, y: 1 }],
    selectedWaypoint: waypoint,
    selectedWaypoints: [waypoint],
    selectedCrowd: crowd,
    previewMode: true,
    imageAssetService,
    storageService,
    undoService,
    eventBus,
    background: { image: { width: 1, height: 1 } },
    displayWidth: 1000,
    displayHeight: 600,
    renderReference: { width: 400, height: 300 },
    exportSettings: { resolutionX: 1920, resolutionY: 1080 },
    styles: {
      pathHead: {
        style: 'custom',
        imageAssetId: 'marker',
        image: { width: 1, height: 1 },
      },
    },
    elements: {
      headPreview: { style: { display: 'block' } },
      headFilename: { textContent: 'marker.png' },
      headPreviewImg,
    },
    uiController: {
      setSelection: vi.fn(),
      updateWaypointEditor: vi.fn(),
    },
    animationEngine: {
      reset: vi.fn(),
      setDuration: vi.fn(),
    },
    updateImageTransform: vi.fn(),
    updateLayersStrip: vi.fn(),
    pause: vi.fn(),
    updateTimeDisplay: vi.fn(),
    updateWaypointList: vi.fn(),
    render: vi.fn(),
    updateTitleIndicator: vi.fn(),
    announce: vi.fn(),
  };
  app._getUndoableState = () => undoRedoMixin._getUndoableState.call(app);
  undoService.saveState(app._getUndoableState());
  waypoint.label = 'changed';
  undoService.saveState(app._getUndoableState());
  return app;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorageMock.getItem.mockReset();
  localStorageMock.setItem.mockReset();
  localStorageMock.removeItem.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Clear All project reset', () => {
  test('cancels stale writers and leaves one empty, asset-free baseline', () => {
    const app = makeApp();
    const pendingUndo = vi.fn();
    app._undoDebounceTimer = setTimeout(pendingUndo, 400);
    app.storageService.autoSave({ revision: 'stale' });
    const pendingMarker = beginAsyncProjectOperation(app, 'marker-image');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    clearProject(app);
    vi.runAllTimers();

    expect(isAsyncProjectOperationCurrent(app, pendingMarker)).toBe(false);
    expect(pendingUndo).not.toHaveBeenCalled();
    expect(app._undoDebounceTimer).toBeNull();
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(localStorageMock.removeItem).toHaveBeenCalledTimes(1);
    expect(app.waypoints).toEqual([]);
    expect(app.waypointsById.size).toBe(0);
    expect(app.scene.getFlowLayers()).toEqual([]);
    expect(app.pathPoints).toEqual([]);
    expect(app.renderReference).toEqual({ width: 1000, height: 600 });
    expect(app.selectedWaypoint).toBeNull();
    expect(app.selectedWaypoints).toEqual([]);
    expect(app.selectedCrowd).toBeNull();
    expect(app.imageAssetService.getAssetIds()).toEqual([]);
    expect(app.background.image).toBeNull();
    expect(app.styles.pathHead).toMatchObject({ image: null, imageAssetId: null });
    expect(app.undoService.canUndo()).toBe(false);
    expect(app.undoService.canRedo()).toBe(false);
    expect(app.undoService.createSnapshot().undoStack).toHaveLength(1);
    expect(app._getUndoableState()).toEqual(JSON.parse(app.undoService.createSnapshot().lastState));
    expect(app._isDirty).toBe(false);
    expect(app.announce).toHaveBeenCalledWith('Project cleared');
    expect(log).toHaveBeenCalledWith('Cleared all waypoints and path');
  });
});
