import { describe, expect, test, vi } from 'vitest';
import { loadBackgroundFile, loadExampleBackground } from '../src/app/backgroundLoading.js';
import {
  beginAsyncProjectOperation,
  invalidateProjectOperations,
  isAsyncProjectOperationCurrent,
} from '../src/app/operationGeneration.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeBackgroundApp(loadImageFile = vi.fn()) {
  return {
    background: { image: null },
    exportSettings: { resolutionX: 0, resolutionY: 0 },
    elements: {},
    waypoints: [],
    loadImageFile,
    updateImageTransform: vi.fn(),
    updateCanvasAspectRatio: vi.fn(),
    calculatePath: vi.fn(),
    autoSave: vi.fn(),
    announce: vi.fn(),
    render: vi.fn(),
    eventBus: { emit: vi.fn() },
  };
}

describe('async project operation generations', () => {
  test('newer same-channel work and project replacement invalidate older tokens', () => {
    const app = {};
    const first = beginAsyncProjectOperation(app, 'background');
    const second = beginAsyncProjectOperation(app, 'background');
    const marker = beginAsyncProjectOperation(app, 'marker');

    expect(isAsyncProjectOperationCurrent(app, first)).toBe(false);
    expect(isAsyncProjectOperationCurrent(app, second)).toBe(true);
    expect(isAsyncProjectOperationCurrent(app, marker)).toBe(true);

    invalidateProjectOperations(app);
    expect(isAsyncProjectOperationCurrent(app, second)).toBe(false);
    expect(isAsyncProjectOperationCurrent(app, marker)).toBe(false);
  });

  test('a background upload resolving after Clear cannot repopulate or autosave', async () => {
    const decode = deferred();
    const app = makeBackgroundApp(vi.fn(() => decode.promise));
    const pending = loadBackgroundFile(app, { name: 'slow.png' });

    invalidateProjectOperations(app); // clearAll() establishes a new baseline
    decode.resolve({ naturalWidth: 640, naturalHeight: 480 });

    await expect(pending).resolves.toBe(false);
    expect(app.background.image).toBeNull();
    expect(app.updateImageTransform).not.toHaveBeenCalled();
    expect(app.autoSave).not.toHaveBeenCalled();
  });

  test('only the latest background request may commit', async () => {
    const firstDecode = deferred();
    const secondDecode = deferred();
    const app = makeBackgroundApp(vi.fn()
      .mockReturnValueOnce(firstDecode.promise)
      .mockReturnValueOnce(secondDecode.promise));
    const first = loadBackgroundFile(app, { name: 'first.png' });
    const second = loadBackgroundFile(app, { name: 'second.png' });
    const firstImage = { naturalWidth: 100, naturalHeight: 100 };
    const secondImage = { naturalWidth: 800, naturalHeight: 600 };

    firstDecode.resolve(firstImage);
    await expect(first).resolves.toBe(false);
    secondDecode.resolve(secondImage);
    await expect(second).resolves.toBe(true);

    expect(app.background.image).toBe(secondImage);
    expect(app.updateImageTransform).toHaveBeenCalledTimes(1);
    expect(app.autoSave).toHaveBeenCalledTimes(1);
  });

  test('a bundled example resolving after project replacement stays detached', async () => {
    const loaded = deferred();
    const app = makeBackgroundApp();
    const pending = loadExampleBackground(app, 'images/Court.png', {
      loadAsset: () => loaded.promise,
    });

    invalidateProjectOperations(app);
    loaded.resolve({
      base64: 'data:image/jpeg;base64,/9j/2Q==',
      getImageElement: vi.fn().mockResolvedValue({ naturalWidth: 100, naturalHeight: 80 }),
    });

    await expect(pending).resolves.toBe(false);
    expect(app.background.image).toBeNull();
    expect(app.eventBus.emit).not.toHaveBeenCalled();
    expect(app.autoSave).not.toHaveBeenCalled();
  });

  test('direct and bundled backgrounds retain original compressed bytes for durable saves', async () => {
    const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
    const directImage = { naturalWidth: 3371, naturalHeight: 2651 };
    const direct = makeBackgroundApp();
    direct.loadImageFileAsset = vi.fn().mockResolvedValue({
      base64: jpeg,
      getImageElement: vi.fn().mockResolvedValue(directImage),
    });

    await expect(loadBackgroundFile(direct, { name: 'large.jpg' })).resolves.toBe(true);
    expect(direct._autosaveBackgroundCache).toEqual({ image: directImage, dataURL: jpeg });

    const bundledImage = { naturalWidth: 3371, naturalHeight: 2651 };
    const bundled = makeBackgroundApp();
    await expect(loadExampleBackground(bundled, 'images/PARM_Aerial.jpg', {
      loadAsset: vi.fn().mockResolvedValue({
        base64: jpeg,
        getImageElement: vi.fn().mockResolvedValue(bundledImage),
      }),
    })).resolves.toBe(true);
    expect(bundled._autosaveBackgroundCache).toEqual({ image: bundledImage, dataURL: jpeg });
  });
});
