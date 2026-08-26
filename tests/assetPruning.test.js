import { describe, expect, test, vi } from 'vitest';

import { undoRedoMixin } from '../src/app/undoRedo.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import {
  ImageAssetService,
  PROJECT_ARCHIVE_LIMITS,
} from '../src/services/ImageAssetService.js';
import { UndoService } from '../src/services/UndoService.js';
import { collectImageAssetReferences } from '../src/utils/assetReferences.js';

const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function makeAsset(id) {
  const { byteLength } = ImageAsset.inspectDataURL(PIXEL_PNG);
  const asset = new ImageAsset({
    id,
    base64: PIXEL_PNG,
    name: `${id}.png`,
    width: 1,
    height: 1,
    mimeType: 'image/png',
    size: byteLength,
  });
  asset._imageElement = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
  return asset;
}

describe('image asset reference collection', () => {
  test('collects live and serialized history references but ignores asset inventories', () => {
    const references = collectImageAssetReferences([
      {
        waypoints: [{ customImageAssetId: 'live-marker', label: '{not JSON' }],
        styles: { pathHead: { imageAssetId: 'live-head' } },
        imageAssets: [{ id: 'unreferenced-inventory-entry' }],
      },
      JSON.stringify({
        waypoints: [{ customImageAssetId: 'undo-marker' }],
        assetManifest: [{ id: 'unreferenced-manifest-entry' }],
      }),
    ]);

    expect([...references].sort()).toEqual([
      'live-head',
      'live-marker',
      'undo-marker',
    ]);
  });

  test('an invalid serialized history root fails closed before any sweep', () => {
    expect(() => collectImageAssetReferences(['{"waypoints":']))
      .toThrow(SyntaxError);
  });
});

describe('ImageAssetService deterministic sweep', () => {
  test('removes only unreferenced assets and updates the byte total', () => {
    const service = new ImageAssetService();
    const keep = makeAsset('keep');
    const removeA = makeAsset('remove-a');
    const removeB = makeAsset('remove-b');
    [keep, removeA, removeB].forEach(asset => service.addAsset(asset));

    expect(service.pruneUnreferenced(new Set(['keep']))).toEqual(['remove-a', 'remove-b']);
    expect(service.getAssetIds()).toEqual(['keep']);
    expect(service.getTotalSize()).toBe(keep.size);
  });

  test('validates the complete retained-ID input before deleting anything', () => {
    const service = new ImageAssetService();
    service.addAsset(makeAsset('safe'));

    expect(() => service.pruneUnreferenced(['safe', null])).toThrow(/non-empty string IDs/);
    expect(service.getAssetIds()).toEqual(['safe']);
  });

  test('frees stale capacity before a replacement asset is admitted', () => {
    const service = new ImageAssetService();
    for (let index = 0; index < PROJECT_ARCHIVE_LIMITS.MAX_ASSETS; index++) {
      service.addAsset(makeAsset(`asset-${index}`));
    }
    expect(service.getAssetCount()).toBe(PROJECT_ARCHIVE_LIMITS.MAX_ASSETS);

    const removed = service.pruneUnreferenced(new Set(['asset-0']));
    expect(removed).toHaveLength(PROJECT_ARCHIVE_LIMITS.MAX_ASSETS - 1);
    expect(() => service.addAsset(makeAsset('replacement'))).not.toThrow();
    expect(service.getAssetIds()).toEqual(['asset-0', 'replacement']);
  });
});

describe('live plus undo/redo reachability', () => {
  test('a redo-only asset survives until a new action invalidates that redo root', () => {
    const imageAssetService = new ImageAssetService();
    ['older', 'redo-only', 'new-live'].forEach(id => imageAssetService.addAsset(makeAsset(id)));
    const undoService = new UndoService({ emit: vi.fn() });
    undoService.saveState({ waypoints: [{ customImageAssetId: 'older' }] });
    undoService.saveState({ waypoints: [{ customImageAssetId: 'redo-only' }] });
    undoService.undo();

    const app = {
      imageAssetService,
      undoService,
      _getUndoableState: () => ({ waypoints: [{ customImageAssetId: 'older' }] }),
    };
    expect(undoRedoMixin.pruneImageAssets.call(app)).toEqual(['new-live']);
    expect(imageAssetService.getAssetIds()).toEqual(['older', 'redo-only']);

    imageAssetService.addAsset(makeAsset('new-live'));
    undoService.saveState({ waypoints: [{ customImageAssetId: 'new-live' }] });
    app._getUndoableState = () => ({ waypoints: [{ customImageAssetId: 'new-live' }] });
    expect(undoRedoMixin.pruneImageAssets.call(app)).toEqual(['redo-only']);
    expect(imageAssetService.getAssetIds()).toEqual(['older', 'new-live']);
  });
});

function makeAdmissionApp(assetIds, initialAssetId) {
  const imageAssetService = new ImageAssetService();
  for (const id of assetIds) imageAssetService.addAsset(makeAsset(id));
  const eventBus = { emit: vi.fn() };
  const undoService = new UndoService(eventBus);
  const live = { assetId: initialAssetId, revision: 0 };
  const app = {
    imageAssetService,
    undoService,
    eventBus,
    announce: vi.fn(),
    _undoDebounceTimer: null,
    _flushPendingUndo: undoRedoMixin._flushPendingUndo,
    _getUndoableState: () => ({
      revision: live.revision,
      waypoints: [{ customImageAssetId: live.assetId }],
    }),
  };
  return { app, eventBus, imageAssetService, live, undoService };
}

function commitAdmission(app, live, candidate, { throwDuringApply = false } = {}) {
  const previous = { ...live };
  return undoRedoMixin.commitImageAssetEdit.call(app, {
    candidate,
    apply: asset => {
      live.assetId = asset.id;
      live.revision += 1;
      if (throwDuringApply) throw new Error('apply failed');
    },
    rollback: () => Object.assign(live, previous),
  });
}

describe('transactional interactive image admission', () => {
  test('drops the minimum one-state prefix at the 128-asset boundary and announces it once', () => {
    const assetIds = Array.from(
      { length: PROJECT_ARCHIVE_LIMITS.MAX_ASSETS },
      (_, index) => `asset-${index}`
    );
    const { app, eventBus, imageAssetService, live, undoService } =
      makeAdmissionApp(assetIds, assetIds.at(-1));
    for (const [revision, assetId] of assetIds.entries()) {
      live.assetId = assetId;
      live.revision = revision;
      undoService.saveState(app._getUndoableState());
    }

    const outcome = commitAdmission(app, live, makeAsset('candidate'));

    expect(outcome.historyShortenedBy).toBe(1);
    expect(imageAssetService.getAssetCount()).toBe(PROJECT_ARCHIVE_LIMITS.MAX_ASSETS);
    expect(imageAssetService.getAssetIds()).not.toContain('asset-0');
    expect(imageAssetService.getAssetIds()).toContain('candidate');
    expect(undoService.getRetainedSerializedStates().some(state => state.includes('asset-0')))
      .toBe(false);
    expect(eventBus.emit.mock.calls.filter(([name]) => name === 'ui:toast')).toHaveLength(1);
    expect(app.announce).not.toHaveBeenCalled();
  });

  test('ordinary 150-state rollover frees capacity without a special history warning', () => {
    const assetIds = Array.from(
      { length: PROJECT_ARCHIVE_LIMITS.MAX_ASSETS },
      (_, index) => `asset-${index}`
    );
    const { app, eventBus, imageAssetService, live, undoService } =
      makeAdmissionApp(assetIds, assetIds.at(-1));
    for (let revision = 0; revision < 150; revision += 1) {
      live.assetId = assetIds[Math.min(revision, assetIds.length - 1)];
      live.revision = revision;
      undoService.saveState(app._getUndoableState());
    }

    const outcome = commitAdmission(app, live, makeAsset('candidate'));

    expect(outcome.historyShortenedBy).toBe(0);
    expect(imageAssetService.getAssetCount()).toBe(PROJECT_ARCHIVE_LIMITS.MAX_ASSETS);
    expect(imageAssetService.getAssetIds()).not.toContain('asset-0');
    expect(eventBus.emit.mock.calls.filter(([name]) => name === 'ui:toast')).toHaveLength(0);
    expect(app.announce).not.toHaveBeenCalled();
  });

  test('a successful new image branch clears redo and sweeps its now-unreachable asset', () => {
    const { app, imageAssetService, live, undoService } =
      makeAdmissionApp(['older', 'redo-only'], 'older');
    live.revision = 1;
    undoService.saveState(app._getUndoableState());
    live.assetId = 'redo-only';
    live.revision = 2;
    undoService.saveState(app._getUndoableState());
    undoService.undo();
    live.assetId = 'older';
    live.revision = 1;

    const outcome = commitAdmission(app, live, makeAsset('candidate'));

    expect(outcome.historyShortenedBy).toBe(0);
    expect(undoService.canRedo()).toBe(false);
    expect(imageAssetService.getAssetIds()).toEqual(['older', 'candidate']);
  });

  test('reselecting the current image preserves redo and creates no history entry', () => {
    const { app, live, undoService } = makeAdmissionApp(['current', 'redo-only'], 'current');
    live.revision = 1;
    undoService.saveState(app._getUndoableState());
    live.assetId = 'redo-only';
    live.revision = 2;
    undoService.saveState(app._getUndoableState());
    undoService.undo();
    live.assetId = 'current';
    live.revision = 1;
    const historyBefore = undoService.createSnapshot();

    const outcome = undoRedoMixin.commitImageAssetEdit.call(app, {
      candidate: makeAsset('current'),
      apply: () => {},
      rollback: () => {},
    });

    expect(outcome).toMatchObject({ isNew: false, historyShortenedBy: 0 });
    expect(undoService.createSnapshot()).toEqual(historyBefore);
    expect(undoService.canRedo()).toBe(true);
  });

  test.each([
    ['asset replacement', 'replaceAssets'],
    ['history assignment', 'saveState'],
  ])('rolls model, assets and history back exactly when %s fails', (_label, failingMethod) => {
    const { app, eventBus, imageAssetService, live, undoService } =
      makeAdmissionApp(['older'], 'older');
    live.revision = 1;
    undoService.saveState(app._getUndoableState());
    const historyBefore = undoService.createSnapshot();
    const assetsBefore = imageAssetService.getAssets();
    vi.spyOn(failingMethod === 'replaceAssets' ? imageAssetService : undoService, failingMethod)
      .mockImplementationOnce(() => {
        throw new Error(`${failingMethod} failed`);
      });

    expect(() => commitAdmission(app, live, makeAsset('candidate')))
      .toThrow(`${failingMethod} failed`);
    expect(live).toEqual({ assetId: 'older', revision: 1 });
    expect(imageAssetService.getAssets()).toEqual(assetsBefore);
    expect(undoService.createSnapshot()).toEqual(historyBefore);
    expect(eventBus.emit.mock.calls.filter(([name]) => name === 'ui:toast')).toHaveLength(0);
    expect(app.announce).not.toHaveBeenCalled();
  });

  test('rolls back a partially applied live-model callback before any admission', () => {
    const { app, imageAssetService, live, undoService } =
      makeAdmissionApp(['older'], 'older');
    live.revision = 1;
    undoService.saveState(app._getUndoableState());
    const historyBefore = undoService.createSnapshot();

    expect(() => commitAdmission(app, live, makeAsset('candidate'), { throwDuringApply: true }))
      .toThrow('apply failed');
    expect(live).toEqual({ assetId: 'older', revision: 1 });
    expect(imageAssetService.getAssetIds()).toEqual(['older']);
    expect(undoService.createSnapshot()).toEqual(historyBefore);
  });

  test('attempts history restoration even when asset rollback itself fails', () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app, imageAssetService, live, undoService } =
      makeAdmissionApp(['older'], 'older');
    live.revision = 1;
    undoService.saveState(app._getUndoableState());
    const historyBefore = undoService.createSnapshot();
    const originalReplaceAssets = imageAssetService.replaceAssets.bind(imageAssetService);
    vi.spyOn(imageAssetService, 'replaceAssets')
      .mockImplementationOnce(originalReplaceAssets)
      .mockImplementationOnce(() => {
        throw new Error('asset rollback failed');
      });
    vi.spyOn(undoService, 'saveState').mockImplementationOnce(() => {
      throw new Error('history assignment failed');
    });
    const historyRestore = vi.spyOn(undoService, 'restoreSnapshot');

    expect(() => commitAdmission(app, live, makeAsset('candidate')))
      .toThrow('Image edit failed and rollback was incomplete');
    expect(historyRestore).toHaveBeenCalledWith(historyBefore);
    expect(undoService.createSnapshot()).toEqual(historyBefore);
    expect(errorLog).toHaveBeenCalledWith('Image asset rollback failed:', expect.any(Error));
  });

  test('surfaces a live-model rollback failure after restoring assets and history', () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app, imageAssetService, live, undoService } =
      makeAdmissionApp(['older'], 'older');
    live.revision = 1;
    undoService.saveState(app._getUndoableState());
    const historyBefore = undoService.createSnapshot();
    const assetsBefore = imageAssetService.getAssets();

    expect(() => undoRedoMixin.commitImageAssetEdit.call(app, {
      candidate: makeAsset('candidate'),
      apply: () => {
        live.assetId = 'candidate';
        throw new Error('apply failed');
      },
      rollback: () => {
        throw new Error('live rollback failed');
      },
    })).toThrow('Image edit failed and rollback was incomplete');
    expect(imageAssetService.getAssets()).toEqual(assetsBefore);
    expect(undoService.createSnapshot()).toEqual(historyBefore);
    expect(errorLog).toHaveBeenCalledWith('Image reference rollback failed:', expect.any(Error));
  });
});
