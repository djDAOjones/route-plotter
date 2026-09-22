import { describe, expect, test, vi } from 'vitest';
import { restoreStartupProject } from '../src/app/startup.js';

describe('startup recovery ordering', () => {
  test('waits for recovery and never launches a default over a restored background', async () => {
    let finishRecovery;
    const restoredImage = { id: 'restored' };
    const app = {
      background: { image: null },
      loadAutosave: vi.fn(() => new Promise(resolve => {
        finishRecovery = () => {
          app.background.image = restoredImage;
          resolve(true);
        };
      })),
      loadDefaultImage: vi.fn(),
    };

    const startup = restoreStartupProject(app);
    expect(app.loadDefaultImage).not.toHaveBeenCalled();

    finishRecovery();
    await expect(startup).resolves.toBe(true);
    expect(app.background.image).toBe(restoredImage);
    expect(app.loadDefaultImage).not.toHaveBeenCalled();
  });

  test('preserves an intentionally backgroundless recovered project', async () => {
    const app = {
      background: { image: null },
      loadAutosave: vi.fn().mockResolvedValue(true),
      loadDefaultImage: vi.fn(),
    };

    await expect(restoreStartupProject(app)).resolves.toBe(true);
    expect(app.background.image).toBeNull();
    expect(app.loadDefaultImage).not.toHaveBeenCalled();
  });

  test('awaits the default image when no recovery background exists', async () => {
    let finishDefault;
    const app = {
      background: { image: null },
      loadAutosave: vi.fn().mockResolvedValue(false),
      loadDefaultImage: vi.fn(() => new Promise(resolve => {
        finishDefault = () => {
          app.background.image = { id: 'default' };
          resolve(app.background.image);
        };
      })),
    };

    const startup = restoreStartupProject(app);
    await Promise.resolve();
    expect(app.loadDefaultImage).toHaveBeenCalledTimes(1);

    finishDefault();
    await expect(startup).resolves.toBe(false);
    expect(app.background.image.id).toBe('default');
  });
});
