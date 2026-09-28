/**
 * DEF-48 — the preview tip's storage access is guarded, as every other is.
 *
 * The one-time "check your sequence in Preview mode" tip read and wrote its
 * flag in `localStorage` with no guard. Where a browser blocks site storage,
 * reading it throws, and the app stopped starting ("Route Plotter could not
 * finish starting"); where storage is full, writing it threw from the tip's
 * timer. Every other storage access in the app is guarded
 * (`StorageService`, the section states, the keybindings).
 */

import { afterEach, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole, recordedConsole } from './helpers/consoleGuard.js';

const TIP = 'routePlotter_previewTipDismissed';

afterEach(() => {
  vi.useRealTimers();
  localStorage.getItem.mockImplementation(() => null);
  localStorage.setItem.mockImplementation(() => {});
  localStorage.removeItem.mockImplementation(() => {});
});

const blocked = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };

test('the app starts in a browser that blocks site storage (DEF-48)', async () => {
  allowConsole(/localStorage|section states|preview tip|keybindings/i);
  localStorage.getItem.mockImplementation(blocked);
  localStorage.setItem.mockImplementation(blocked);
  localStorage.removeItem.mockImplementation(blocked);

  const app = await bootApp();

  expect(await app.ready).not.toBe(false);
  expect(recordedConsole().filter(line => /failed to initialize/i.test(line))).toEqual([]);
  expect(recordedConsole()).toContainEqual(expect.stringMatching(/Could not read whether the preview tip was seen/));
});

test('a full store does not throw from the preview tip, which still shows (DEF-48)', async () => {
  allowConsole(/Could not remember that the preview tip was seen/);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  localStorage.setItem.mockImplementation((key) => {
    if (key === TIP) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  });
  const app = await bootApp();
  const toast = vi.spyOn(app, 'showToast');

  expect(() => vi.advanceTimersByTime(1500)).not.toThrow();

  expect(toast).toHaveBeenCalledWith('Tip: Check your sequence in Preview mode before exporting', 8000);
  expect(recordedConsole()).toContainEqual(expect.stringMatching(/Could not remember that the preview tip was seen/));
});

test('a tip already seen is not shown again', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  localStorage.getItem.mockImplementation(key => (key === TIP ? 'true' : null));
  const app = await bootApp();
  const toast = vi.spyOn(app, 'showToast');

  vi.advanceTimersByTime(1500);

  expect(toast).not.toHaveBeenCalledWith('Tip: Check your sequence in Preview mode before exporting', 8000);
});
