/**
 * TST-11 — the performance harness's safety contracts, pinned by running it.
 *
 * perfHarness.test.js pins three of them by reading scripts/perf-harness.js:
 * autosave is silenced before anything is restored, and never put back; the
 * backup is restored in a `finally`; and nothing in it fails a run on timing.
 * A local renamed, or two independent statements reordered, fails those
 * reads; autosave put back by any spelling but the one they look for passes
 * them. Here the harness runs as its header says to run it, against the
 * editor (booted, as a browser starts it), and what reaches the recovery key
 * is the evidence: the author's backup, restored, and nothing after it, not
 * even when the editor goes on to save.
 *
 * The harness's explanatory text (no pass/fail threshold, by design) has no
 * behaviour, so that read stays with perfHarness.test.js alone.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole, recordedConsole } from './helpers/consoleGuard.js';
import { localStorageMock } from './setup.js';

const harnessSource = readFileSync(resolve(process.cwd(), 'scripts/perf-harness.js'), 'utf8');

/** As its header says: the whole file, pasted into the page's console. */
function loadHarness() {
  delete globalThis.routePlotterBenchmark;
  // eslint-disable-next-line no-new-func
  new Function(harnessSource)();
  return globalThis.routePlotterBenchmark;
}

const AUTOSAVE_KEY = 'routePlotter_autosave';
const AUTHORS_PROJECT = '{"the author":"own project, saved before the benchmark"}';
/** As small a run as the harness takes: every phase, one render each. */
const QUICK = Object.freeze({ samples: 1, warmup: 0 });

afterEach(() => {
  localStorageMock.getItem.mockImplementation(() => null);
  vi.restoreAllMocks();
  delete globalThis.routePlotterBenchmark;
});

/** What was written to the recovery key, in order. */
function recoveryWrites() {
  return localStorageMock.setItem.mock.calls
    .filter(([key]) => key === AUTOSAVE_KEY)
    .map(([, value]) => value);
}

/**
 * The editor with a two-waypoint route, its recovery point holding the
 * author's project, and nothing written yet. From here the clock the harness
 * times renders with is a counter: each reading `msPerReading` after the last.
 */
async function editorWithSavedProject({ msPerReading = 1 } = {}) {
  const app = await bootApp();
  await app.ready;
  // A first run opens Help, whose focus trap holds the keyboard.
  document.getElementById('splash-close').click();
  await vi.waitFor(() => expect(app.background.image).toBeTruthy());
  app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
  app.storageService.flushAutoSave();
  localStorageMock.getItem.mockImplementation(key => (key === AUTOSAVE_KEY ? AUTHORS_PROJECT : null));
  localStorageMock.setItem.mockClear();
  // The harness prints its four tables; this run's numbers are not the point.
  vi.spyOn(console, 'table').mockImplementation(() => {});
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => {
    now += msPerReading;
    return now;
  });
  return app;
}

/**
 * Edit the project the harness left behind, as an author would before
 * reloading, and let every pending save land.
 */
function authorKeepsWorking(app) {
  app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.25, isMajor: true });
  app.autoSave();
  app.storageService.flushAutoSave();
}

describe('the performance harness, run against the editor', () => {
  test('a finished run restores the backup, and the editor saves nothing over it afterwards', async () => {
    allowConsole(/Benchmark finished.*reload the page/i);
    const app = await editorWithSavedProject();
    const ownAutoSave = app.autoSave;

    const results = await loadHarness()(QUICK);

    // It ran every phase, on the synthetic projects it builds.
    expect(results.profiles.map(({ profile }) => profile))
      .toEqual(['Small', 'Typical', 'Large', 'Extreme', 'At every limit']);
    expect(recoveryWrites()).toEqual([AUTHORS_PROJECT]);

    authorKeepsWorking(app);

    // Silenced until a reload.
    expect(recoveryWrites()).toEqual([AUTHORS_PROJECT]);
    expect(app.autoSave).not.toBe(ownAutoSave);
    expect(recordedConsole()).toEqual([expect.stringMatching(/^warn: Benchmark finished.*reload the page/i)]);
  }, 60000);

  test('a run that fails part-way restores the backup, and the editor saves nothing over it afterwards', async () => {
    allowConsole(/Benchmark failed.*reload the page/i);
    const app = await editorWithSavedProject();
    // A failure once the synthetic route is in place: the editor's own crowd
    // command refuses.
    vi.spyOn(app, 'addCrowd').mockImplementation(() => {
      throw new Error('the crowd could not be added');
    });

    await expect(loadHarness()(QUICK)).rejects.toThrow('the crowd could not be added');

    expect(app.waypoints).toHaveLength(12);
    expect(recoveryWrites()).toEqual([AUTHORS_PROJECT]);
    authorKeepsWorking(app);
    expect(recoveryWrites()).toEqual([AUTHORS_PROJECT]);
    expect(recordedConsole()).toEqual([expect.stringMatching(/^warn: Benchmark failed.*reload the page/i)]);
  }, 60000);

  test('no timing fails a run: one where every render takes a second still finishes, and reports it', async () => {
    allowConsole(/Benchmark finished.*reload the page/i);
    const app = await editorWithSavedProject({ msPerReading: 1000 });

    const results = await loadHarness()(QUICK);

    for (const phase of ['waypoints', 'dots', 'image', 'profiles']) {
      expect(results[phase].length).toBeGreaterThan(0);
      for (const row of results[phase]) expect(row.p95Ms).toBeGreaterThanOrEqual(1000);
    }
    expect(results.profiles.map(row => row.holds60fps)).toEqual([false, false, false, false, false]);
    expect(recoveryWrites()).toEqual([AUTHORS_PROJECT]);
    authorKeepsWorking(app);
    expect(recoveryWrites()).toEqual([AUTHORS_PROJECT]);
  }, 60000);
});
