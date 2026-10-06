/**
 * Fixtures and golden files for the TST-09 domain characterisations: the
 * camera, golden dot positions, the curvature cache, minor-waypoint ends and
 * the intro/tail time domains.
 *
 * Each of those suites pins what the code does today, including what the
 * defects it gates (DEF-05, DEF-07, DEF-10, DEF-11, DEF-12) make it do, so a
 * fix moves a named baseline on purpose rather than by accident. The numbers
 * live in one JSON file per suite, `tests/goldens/domains-<suite>.json`, one
 * key per case, so a fix's diff reads case by case.
 *
 * Regenerate deliberately, a whole file at a time, and read the diff:
 * `UPDATE_DOMAIN_GOLDENS=1 npx vitest run tests/<suite>.test.js --pool=threads --no-file-parallelism`.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, expect } from 'vitest';
import { bootApp } from './bootApp.js';
import { loadSnapshot } from './projectSnapshot.js';
import { buildExampleProjects } from '../../src/examples/index.js';

const goldenDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'goldens');

/** Set to rewrite the domain goldens instead of comparing against them. */
export const UPDATING_DOMAINS = process.env.UPDATE_DOMAIN_GOLDENS === '1';

/**
 * Round every finite number in a value, deeply. Six places is a millionth of
 * a millisecond, a pixel or an image: far below anything the code decides,
 * far above the last bits of a floating-point sum.
 * @param {*} value
 * @param {number} [places=6]
 * @returns {*} A rounded deep copy
 */
export function rounded(value, places = 6) {
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(places)) + 0 : value;
  if (Array.isArray(value)) return value.map(each => rounded(each, places));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, each]) => [key, rounded(each, places)]));
  }
  return value;
}

/** JSON with each array of plain values on one line, so a golden stays short and diffs by row. */
function format(value, indent = '') {
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.every(each => each === null || typeof each !== 'object')) return JSON.stringify(value);
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
 * @param {string} suite - `camera`, `dots`, `curvature`, `minor-end` or `time`
 * @returns {(key: string, actual: *) => void}
 */
export function domainGolden(suite) {
  const path = join(goldenDir, `domains-${suite}.json`);
  const stored = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  const written = {};
  if (UPDATING_DOMAINS) {
    afterAll(() => {
      const sorted = Object.fromEntries(Object.keys(written).sort().map(key => [key, written[key]]));
      writeFileSync(path, `${format(sorted)}\n`, 'utf8');
    });
  }
  return (key, actual) => {
    const value = JSON.parse(JSON.stringify(actual));
    if (UPDATING_DOMAINS) {
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
 * A copy of a bundled example's project. `uon-open-day` is the branched one:
 * its trunk runs 1 → 2 → 2a → 2b → 3 (2a and 2b minor) and its branch b1
 * leaves 2 and rejoins at 3, and it carries a traced network crowd.
 * @param {string} id
 * @returns {Object}
 */
export function exampleProject(id) {
  const example = buildExampleProjects().find(each => each.id === id);
  if (!example) throw new Error(`No example ${id}`);
  return JSON.parse(JSON.stringify(example.project));
}

/** Past the 50 ms the app waits before it measures timing again. */
export const settled = () => new Promise(resolve => setTimeout(resolve, 120));

/**
 * The booted app with a project loaded through browser recovery, in Preview
 * or Edit, its timing rebuilt for that mode. The default background has
 * loaded by `app.ready`, so the canvas (660 × 660 in jsdom) and with it the
 * route's timing are fixed before the project arrives.
 * @param {Object} project
 * @param {{preview?: boolean}} [options]
 */
export async function openProject(project, { preview = true } = {}) {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, project)).toBe(true);
  await settled();
  app._setPreviewMode(preview);
  app.invalidateAnimationTiming();
  return app;
}

/** B, F and what made up the end (CROWD-05). */
export function durationsOf(host) {
  const engine = host.animationEngine;
  return { B: engine.state.baseDuration, F: engine.state.duration, parts: engine.sceneEndParts };
}
