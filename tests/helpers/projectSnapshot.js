/**
 * Shared vocabulary for the save-shape tests (TST-06).
 *
 * `_buildProjectSnapshot` is the one save shape — autosave, the ZIP export and
 * the HTML export all serialise through it — and `loadAutosave` is the
 * shortest real path back in: it runs `stageProject` and commits the result
 * onto the live app, exactly as browser recovery does. Going through the app
 * rather than calling the staging function directly is the point: a shape that
 * only a fixture agrees with is not the shape the product ships.
 */

import { afterEach, beforeEach, vi } from 'vitest';

/** The instant the goldens are taken at. Any fixed past date would do. */
export const FIXED_NOW = Date.parse('2026-09-23T09:00:00Z');

/**
 * Freeze the clock for a golden (§17 asks for fake timers).
 *
 * Only `Date` is faked: the app's own debounces and animation frames still run
 * on real timers, so boot behaves normally, while `Date.now()` — which stamps
 * every waypoint's `created`/`modified` — becomes a fixed, diffable number
 * instead of the reason a golden could never be written.
 */
export function freezeClock(at = FIXED_NOW) {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

/**
 * Load a snapshot back into the app through the real recovery path.
 *
 * `loadAutosave` reports a refusal as `false` plus a `console.warn`, so a
 * caller that expects the refusal must declare that warning.
 *
 * @param {Object} app - A booted RoutePlotter
 * @param {Object} snapshot - A project snapshot
 * @returns {Promise<boolean>} True when the project loaded
 */
export function loadSnapshot(app, snapshot) {
  // A fresh parse each call: the loader keeps references into what it is
  // given, so handing it the live object would let a load mutate its source.
  app.storageService.loadAutoSave = () => JSON.parse(JSON.stringify(snapshot));
  return app.loadAutosave();
}

/** The warning `loadAutosave` prints when it refuses a project. */
export const LOAD_REFUSED = /Autosave was not restored/;

/**
 * A snapshot in comparable form: a deep copy with every finite number rounded.
 *
 * The render and timing references are derived canvas sizes whose exact binary
 * expansion is uninteresting (1173.3333333333333 px). Six decimal places is
 * far finer than any authored control, and leaves the goldens byte-stable.
 *
 * @param {Object} snapshot
 * @returns {Object} A normalised deep copy
 */
export function comparableSnapshot(snapshot) {
  return roundNumbers(JSON.parse(JSON.stringify(snapshot)));
}

function roundNumbers(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
  if (Array.isArray(value)) return value.map(roundNumbers);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, each]) => [key, roundNumbers(each)]));
  }
  return value;
}
