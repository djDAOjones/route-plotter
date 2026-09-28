/**
 * DEF-48 — the preview tip's storage access is guarded, as every other is.
 *
 * The one-time "check your sequence in Preview mode" tip read and wrote its
 * flag in `localStorage` with no guard: the only unguarded storage access on
 * a path the app reaches (the unused `resetToDefaults` helper's removal is
 * the other). Where a browser blocks site storage, reading it throws, and the
 * app stopped starting ("Route Plotter could not finish starting"); where
 * storage is full, writing it threw from the tip's timer. Editing works
 * either way now; what storage keeps (preferences, recovery) cannot be kept.
 */

import { afterEach, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole, recordedConsole } from './helpers/consoleGuard.js';

const TIP = 'routePlotter_previewTipDismissed';
const TIP_TEXT = 'Tip: Check your sequence in Preview mode before exporting';

// A browser that blocks site storage may throw on the property itself, not
// only on its methods; both places the global lives are restored after.
const storage = localStorage;
const storageHolders = [...new Set([globalThis, window])]
  .map(holder => [holder, Object.getOwnPropertyDescriptor(holder, 'localStorage')]);

afterEach(() => {
  vi.useRealTimers();
  for (const [holder, descriptor] of storageHolders) Object.defineProperty(holder, 'localStorage', descriptor);
  storage.getItem.mockImplementation(() => null);
  storage.setItem.mockImplementation(() => {});
  storage.removeItem.mockImplementation(() => {});
});

const blocked = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };

/** Boot, then let the tip's 1.5 s pass; what the tip showed. */
async function bootAndWaitForTheTip() {
  const app = await bootApp();
  // Starting waits on a timer of its own, which the fake clock must run.
  await vi.advanceTimersByTimeAsync(50);
  const ready = await app.ready;
  const toast = vi.spyOn(app, 'showToast');
  await vi.advanceTimersByTimeAsync(1500);
  return { app, ready, shown: toast.mock.calls.some(([text]) => text === TIP_TEXT) };
}

test('the app starts, and the tip shows, where every storage call is blocked (DEF-48)', async () => {
  allowConsole(/localStorage|section states|preview tip|keybindings/i);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  storage.getItem.mockImplementation(blocked);
  storage.setItem.mockImplementation(blocked);
  storage.removeItem.mockImplementation(blocked);

  const { ready, shown } = await bootAndWaitForTheTip();

  expect(ready).toBe(true);
  expect(shown).toBe(true);
  expect(recordedConsole().filter(line => /failed to initialize/i.test(line))).toEqual([]);
  expect(recordedConsole()).toContainEqual(expect.stringMatching(/Could not read whether the preview tip was seen/));
});

test('the app starts where even reaching localStorage throws (DEF-48)', async () => {
  allowConsole(/localStorage|section states|preview tip|keybindings/i);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  for (const [holder] of storageHolders) {
    Object.defineProperty(holder, 'localStorage', { configurable: true, get: blocked });
  }

  const { ready, shown } = await bootAndWaitForTheTip();

  expect(ready).toBe(true);
  expect(shown).toBe(true);
});

test('a full store does not throw from the preview tip, which still shows (DEF-48)', async () => {
  allowConsole(/Could not remember that the preview tip was seen/);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  storage.setItem.mockImplementation((key) => {
    if (key === TIP) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  });
  const app = await bootApp();
  const toast = vi.spyOn(app, 'showToast');

  expect(() => vi.advanceTimersByTime(1500)).not.toThrow();

  expect(toast).toHaveBeenCalledWith(TIP_TEXT, 8000);
  expect(recordedConsole()).toContainEqual(expect.stringMatching(/Could not remember that the preview tip was seen/));
});

test('a tip shown once is remembered, and not shown at the next visit', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const stored = new Map();
  storage.getItem.mockImplementation(key => stored.get(key) ?? null);
  storage.setItem.mockImplementation((key, value) => { stored.set(key, String(value)); });

  const first = await bootAndWaitForTheTip();
  const next = await bootAndWaitForTheTip();

  expect(first.shown).toBe(true);
  expect(stored.get(TIP)).toBe('true');
  expect(next.shown).toBe(false);
});
