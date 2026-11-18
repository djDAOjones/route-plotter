/**
 * Golden files for the TST-03 visibility mode matrix: every path visibility
 * mode, every waypoint visibility mode and both reveal-mask builders of
 * `MotionVisibilityService`, sampled at the instants that sit on each of
 * their boundaries.
 *
 * The discipline is TST-09's (`domainGoldens.js`): one JSON file per suite,
 * `tests/goldens/visibility-<suite>.json`, one key per case so a fix's diff
 * reads case by case, numbers rounded so no floating-point noise reaches the
 * file, and a missing file or case fails rather than passing. It has its own
 * flag because these goldens and the domain ones move for different reasons.
 *
 * Regenerate deliberately, a whole file at a time, and read the diff:
 * `UPDATE_VISIBILITY_GOLDENS=1 npx vitest run tests/<suite>.test.js --pool=threads --no-file-parallelism`.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, expect } from 'vitest';
import { rounded } from './domainGoldens.js';

export { rounded };

const goldenDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'goldens');

/** Set to rewrite the visibility goldens instead of comparing against them. */
export const UPDATING_VISIBILITY = process.env.UPDATE_VISIBILITY_GOLDENS === '1';

/** A row of plain values this short stays on one line; a longer one (a draw transcript) takes a line per entry. */
const ONE_LINE = 120;

/** JSON with short rows on one line and long ones a line per entry, so a golden diffs by row. */
function format(value, indent = '') {
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    const plain = value.every(each => each === null || typeof each !== 'object');
    const line = plain ? JSON.stringify(value) : null;
    if (line !== null && line.length <= ONE_LINE) return line;
    if (value.length === 0) return '[]';
    return `[\n${value.map(each => inner + format(each, inner)).join(',\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    return `{\n${entries.map(([key, each]) => `${inner}${JSON.stringify(key)}: ${format(each, inner)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

/**
 * The golden file for one suite. Returns `pin(key, actual)`, which compares
 * `actual` with the stored case, or records it when updating. A missing file
 * or case fails: deleting a golden must not disable the check it makes.
 * Callers round before pinning; the stored value is what JSON makes of it.
 * @param {string} suite - `path`, `waypoints` or `masks`
 * @returns {(key: string, actual: *) => void}
 */
export function visibilityGolden(suite) {
  const path = join(goldenDir, `visibility-${suite}.json`);
  const stored = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  const written = {};
  if (UPDATING_VISIBILITY) {
    afterAll(() => {
      const sorted = Object.fromEntries(Object.keys(written).sort().map(key => [key, written[key]]));
      writeFileSync(path, `${format(sorted)}\n`, 'utf8');
    });
  }
  return (key, actual) => {
    const value = JSON.parse(JSON.stringify(actual));
    if (UPDATING_VISIBILITY) {
      expect(Object.hasOwn(written, key), `golden case "${key}" is pinned twice`).toBe(false);
      written[key] = value;
      return;
    }
    expect(stored, `Missing golden ${path}`).not.toBeNull();
    expect(Object.hasOwn(stored, key), `${path} has no case "${key}"`).toBe(true);
    expect(value, `golden case "${key}"`).toEqual(stored[key]);
  };
}

/**
 * The same instants evaluated three ways, for the seek == sequential checks:
 * each on a fresh evaluator (a cold seek), all in order on one, and all in
 * reverse and then in a scrambled order on one more, so a value that depends
 * on what was evaluated before shows up as a difference at some instant.
 * The order is fixed, never random.
 * @param {Array} instants
 * @param {() => *} fresh - Makes a new evaluator
 * @param {(evaluator: *, instant: *) => *} evaluate - Its rounded output at an instant
 * @returns {{cold: Array, forwards: Array, backwards: Array, scrambled: Array}}
 */
export function seekOrders(instants, fresh, evaluate) {
  const cold = instants.map(instant => evaluate(fresh(), instant));
  const played = fresh();
  const forwards = instants.map(instant => evaluate(played, instant));
  const reversed = fresh();
  const backwards = [...instants].reverse().map(instant => evaluate(reversed, instant)).reverse();
  const order = scramble(instants.length);
  const scrambledOut = new Array(instants.length);
  for (const index of order) scrambledOut[index] = evaluate(reversed, instants[index]);
  return { cold, forwards, backwards, scrambled: scrambledOut };
}

/** A fixed permutation of `0..n-1` that is neither in order nor reversed (stride 7, coprime with most lengths, then any left over). */
function scramble(n) {
  const seen = new Set();
  const order = [];
  for (let step = 0, index = 0; step < n; step += 1, index = (index + 7) % n) {
    if (!seen.has(index)) {
      seen.add(index);
      order.push(index);
    }
  }
  for (let index = 0; index < n; index += 1) if (!seen.has(index)) order.push(index);
  return order;
}
