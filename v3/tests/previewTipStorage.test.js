/**
 * DEF-48 — the preview tip's storage access is guarded.
 *
 * The one-time "check your sequence in Preview mode" tip read and wrote its
 * flag in `localStorage` with no guard: the only unguarded storage access on
 * a path the app reaches (the unused `resetToDefaults` helper's removal is
 * the other). Where a browser blocks site storage, reading it throws, and the
 * app stopped starting ("Route Plotter could not finish starting"); where
 * storage is full, writing it threw from the tip's timer. Editing works
 * either way now; what storage keeps (preferences, recovery) cannot be kept.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole, recordedConsole } from './helpers/consoleGuard.js';
import { playbackMixin } from '../src/app/playback.js';

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

/** The tip as the banner slot shows it (UI-06 PR 6: it was a toast). */
const tipBanner = () => document.querySelector('#mode-banner #preview-tip-banner');

/** Boot, then let the tip's 1.5 s pass; what the tip showed. */
async function bootAndWaitForTheTip() {
  const app = await bootApp();
  // Starting waits on a timer of its own, which the fake clock must run.
  await vi.advanceTimersByTimeAsync(50);
  const ready = await app.ready;
  // The welcome closed: the tip waits while a dialog is open (UI-06 PR 6, proposal (a), the owner's).
  document.getElementById('splash-close').click();
  await vi.advanceTimersByTimeAsync(1500);
  return { app, ready, shown: Boolean(tipBanner()?.textContent.includes('Check your sequence in Preview mode')) };
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
  const said = vi.spyOn(app, 'announce');
  await vi.advanceTimersByTimeAsync(50);
  await app.ready;
  // The welcome closed: the tip waits while a dialog is open (UI-06 PR 6, proposal (a), the owner's).
  document.getElementById('splash-close').click();

  expect(() => vi.advanceTimersByTime(1500)).not.toThrow();
  // Shown once the start has settled, and read once nothing else is said (the owner, 2026-10-09): in the
  // banner slot now, said as it was (UI-06 PR 6, item 7; it was a toast for its 8 s).
  await vi.waitFor(() => expect(said).toHaveBeenCalledWith(TIP_TEXT, 'polite', { whenIdle: true }));
  expect(tipBanner()).not.toBeNull();
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

describe('the tip as it was before DEF-48, kept as it was', () => {
  /**
   * The tip's own methods, on a stand-in with only what they use: a banner
   * slot that is free (UI-06 PR 6: the tip shows there, where it was a toast).
   */
  function showTipOn(events) {
    const receiver = {
      _offerPreviewTip: playbackMixin._offerPreviewTip,
      _endPreviewTip: playbackMixin._endPreviewTip,
      announce: vi.fn(),
      modeBanner: {
        isShowing: () => false,
        holdsFocus: () => false,
        show: vi.fn((_owner, { text }) => events.push(`show ${`Tip:${text}` === TIP_TEXT ? 'tip' : text}`)),
        hide: vi.fn(),
      },
    };
    playbackMixin._showPreviewTip.call(receiver);
    return receiver;
  }

  function useStoredFlag(value, events = []) {
    const stored = new Map(value === null ? [] : [[TIP, value]]);
    storage.getItem.mockImplementation(key => stored.get(key) ?? null);
    storage.setItem.mockImplementation((key, written) => {
      events.push(`write ${key}=${written}`);
      stored.set(key, String(written));
    });
    return stored;
  }

  test('the tip shows after 1.5 s, and is marked seen only once it has shown', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const events = [];
    const stored = useStoredFlag(null, events);
    const receiver = showTipOn(events);

    vi.advanceTimersByTime(1499);
    // A visit that ends now has not seen the tip, and must not be marked so.
    expect(receiver.modeBanner.show).not.toHaveBeenCalled();
    expect(stored.has(TIP)).toBe(false);

    vi.advanceTimersByTime(1);
    expect(events).toEqual(['show tip', `write ${TIP}=true`]);
  });

  test.each([
    ['nothing stored', 'shows', null],
    ['an empty flag', 'shows', ''],
    ['"false" stored', 'shows', 'false'],
    ['anything else stored', 'shows', 'garbage'],
    ['"true" stored', 'stays hidden', 'true'],
  ])('with %s, the tip %s', (_label, outcome, value) => {
    const shows = outcome === 'shows';
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    useStoredFlag(value);
    const receiver = showTipOn([]);

    vi.advanceTimersByTime(1500);

    expect(receiver.modeBanner.show.mock.calls.length).toBe(shows ? 1 : 0);
  });
});
