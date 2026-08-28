/**
 * ICE-03 — the performance harness stays runnable.
 *
 * This asserts nothing about *timings*. A committed frame-time threshold would
 * pass on one machine and fail on another with identical code, and a red that
 * means nothing is worse than no check at all — so the harness is deliberately
 * outside the quality gate's judgement. What is guarded here is that it still
 * loads, still exposes one entry point, and still refuses safely when the app
 * is not there. Those are the ways a console tool silently rots.
 *
 * The one behavioural contract it *does* pin is the safety one, because it was
 * learned the hard way: the first version restored the autosave and the
 * still-running app immediately saved the synthetic benchmark project over it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test, expect, beforeEach } from 'vitest';

const harnessSource = readFileSync(resolve(process.cwd(), 'scripts/perf-harness.js'), 'utf8');

function loadHarness() {
  delete globalThis.routePlotterBenchmark;
  // eslint-disable-next-line no-new-func
  new Function(harnessSource)();
  return globalThis.routePlotterBenchmark;
}

describe('the performance harness', () => {
  beforeEach(() => { delete globalThis.app; });

  test('it loads and exposes exactly one entry point', () => {
    const fn = loadHarness();
    expect(typeof fn).toBe('function');
    expect(fn.name).toBe('routePlotterBenchmark');
  });

  test('it refuses clearly when Route Plotter is not on the page', async () => {
    const fn = loadHarness();
    await expect(fn()).rejects.toThrow(/not loaded/i);
  });

  test('it refuses before touching storage when there is no project', async () => {
    const fn = loadHarness();
    globalThis.app = {
      waypoints: [],
      canvas: {},
      coordinateTransform: { setCanvasDimensions() {} },
      autoSave() {},
    };

    await expect(fn()).rejects.toThrow(/at least one waypoint/i);
  });

  test('it silences autosave, and keeps it silenced afterwards', () => {
    // The defect this pins: restoring the backup is not enough on its own,
    // because the live app will autosave the synthetic project straight over
    // it. Suppression has to outlive the run, until the page is reloaded.
    expect(harnessSource).toMatch(/app\.autoSave\s*=\s*function benchmarkAutoSaveSuppressed/);

    const suppressionIndex = harnessSource.indexOf('benchmarkAutoSaveSuppressed');
    const restoreIndex = harnessSource.indexOf('const restore =');
    expect(suppressionIndex).toBeGreaterThan(-1);
    expect(suppressionIndex).toBeLessThan(restoreIndex);

    // Nothing may put the real autoSave back — that is the whole point.
    expect(harnessSource).not.toMatch(/app\.autoSave\s*=\s*realAutoSave/);
  });

  test('it carries no pass/fail threshold', () => {
    // If a threshold ever appears here, it belongs in a conversation first:
    // these numbers are machine-dependent by nature.
    expect(harnessSource).not.toMatch(/expect\(|assert\(|process\.exit|throw new Error\('.*too slow/i);
    expect(harnessSource).toMatch(/no pass\/fail threshold/i);
  });

  test('it restores the backup even when a measurement throws', () => {
    // The restore has to be in a finally, or a mid-run failure leaves the
    // author's project replaced by a 2,000-waypoint sine wave.
    expect(harnessSource).toMatch(/\}\s*finally\s*\{\s*[\s\S]*restore\(\);/);
  });
});
