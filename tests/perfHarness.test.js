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
import { allowConsole, recordedConsole } from './helpers/consoleGuard.js';

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

  test('it refuses an empty project and leaves the recovery point alone', async () => {
    const fn = loadHarness();
    globalThis.app = {
      waypoints: [],
      canvas: {},
      coordinateTransform: { setCanvasDimensions() {} },
      autoSave() {},
    };

    await expect(fn()).rejects.toThrow(/at least one waypoint/i);
    // It must never write the recovery point: an early return here used to
    // restore an `undefined` over the real save.
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  test('a refusal leaves autosave and the canvas as they were (DEF-30)', async () => {
    // It used to silence autosave and resize the canvas before it checked
    // for a waypoint, so a refused run left the page not saving, and said
    // nothing about it.
    const fn = loadHarness();
    const autoSave = () => {};
    globalThis.app = {
      waypoints: [],
      canvas: { width: 800, height: 450 },
      displayWidth: 800,
      displayHeight: 450,
      coordinateTransform: { setCanvasDimensions() { throw new Error('the surface was resized'); } },
      autoSave,
    };

    await expect(fn()).rejects.toThrow(/at least one waypoint/i);
    expect(globalThis.app.autoSave).toBe(autoSave);
    expect(globalThis.app.canvas).toEqual({ width: 800, height: 450 });
    expect([globalThis.app.displayWidth, globalThis.app.displayHeight]).toEqual([800, 450]);
  });

  test('a run that fails part-way says autosave stays off until a reload (DEF-30)', async () => {
    // Autosave stays silenced once a run has started, so a failed run must say
    // so, as a finished one does; it used to say nothing.
    allowConsole(/reload the page/i);
    const fn = loadHarness();
    globalThis.app = {
      waypoints: [{}], // no `createMajor` on its class, so the first route throws
      canvas: {},
      coordinateTransform: { setCanvasDimensions() {} },
      autoSave() {},
    };

    await expect(fn()).rejects.toThrow(/createMajor/);
    expect(recordedConsole()).toEqual([expect.stringMatching(/^warn: Benchmark failed.*reload the page/i)]);
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
