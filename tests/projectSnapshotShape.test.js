/**
 * TST-06 — the save shape, pinned to a file (part 1 of 2).
 *
 * `_buildProjectSnapshot` is the single save shape: browser recovery, the ZIP
 * project file and the standalone HTML export all serialise through it. Until
 * now nothing held its *whole* output to anything — `scenePersistence.test.js`
 * checks the coordVersion, the scene block and that nine keys exist — so a
 * field could be dropped, renamed or silently redefined and every artefact
 * would change together, which is the shape of a drift nobody notices until a
 * project will not reopen.
 *
 * A file golden per project turns that into a reviewable diff. The three
 * bundled examples are the realistic fixtures — the plain chain, a branched
 * route with an anchored traced crowd, a guide network — and precisely because
 * they are realistic they leave most fields at their defaults, so a serialiser
 * that dropped one could still match. `authoredExtras` exists for that: it
 * leaves nothing at its default, and the last test here keeps it that way.
 *
 * Regenerate deliberately, never reflexively: `UPDATE_SNAPSHOT_GOLDENS=1 npx
 * vitest run tests/projectSnapshotShape.test.js`, then read the diff.
 *
 * Part 2 is `tests/authorableLoadable.test.js`.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { comparableSnapshot, freezeClock, loadSnapshot, FIXED_NOW } from './helpers/projectSnapshot.js';
import { authoredExtrasProject } from './fixtures/authoredExtras.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { Waypoint } from '../src/models/Waypoint.js';

const goldenDir = join(dirname(fileURLToPath(import.meta.url)), 'goldens');
const UPDATING = process.env.UPDATE_SNAPSHOT_GOLDENS === '1';

/** Every project that gets a golden: the shipped examples, plus the extras. */
function goldenProjects() {
  return [
    ...buildExampleProjects().map(example => ({ id: example.id, project: example.project })),
    { id: 'authored-extras', project: authoredExtrasProject() },
  ];
}

/** Boot an app with one project loaded through the real staging path. */
async function appWithProject(project) {
  const app = await bootApp();
  await app.ready;
  const loaded = await loadSnapshot(app, project);
  expect(loaded).toBe(true);
  return app;
}

/**
 * Compare against the stored golden, or write it when regenerating.
 * A missing golden is a failure, not a silent pass: a deleted file would
 * otherwise disable the check it exists to make.
 */
function expectGolden(id, actual) {
  const path = join(goldenDir, `project-snapshot-${id}.json`);
  if (UPDATING) {
    writeFileSync(path, `${JSON.stringify(actual, null, 2)}\n`, 'utf8');
    return;
  }
  expect(existsSync(path), `Missing golden ${path}`).toBe(true);
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(actual);
}

describe('the project snapshot shape (TST-06)', () => {

  freezeClock();

  for (const { id, project } of goldenProjects()) {
    describe(id, () => {

      test('the saved snapshot matches its golden file', async () => {
        const app = await appWithProject(project);

        expectGolden(id, comparableSnapshot(app._buildProjectSnapshot()));
      });

      test('loading what it saved leaves the snapshot unchanged', async () => {
        const app = await appWithProject(project);
        const saved = app._buildProjectSnapshot();

        expect(await loadSnapshot(app, saved)).toBe(true);

        // `load(save(x)) == save(x)`: a reload must not move the model. With
        // the clock frozen this holds exactly, restamped `modified` included.
        expect(comparableSnapshot(app._buildProjectSnapshot()))
          .toEqual(comparableSnapshot(saved));
      });

    });
  }

  test('a recovery snapshot keeps the shape and drops only the asset bytes', async () => {
    const app = await appWithProject(authoredExtrasProject());

    const full = app._buildProjectSnapshot();
    const recovery = app._buildProjectSnapshot({ includeAssets: false });

    // `includeAssets: false` is what autosave uses; `prepareAutosaveSnapshot`
    // then strips the now-unusable custom-image references separately
    // (`persistence.js:1093-1095`), which is why this is not simply the full
    // snapshot minus bytes.
    expect(Object.keys(recovery)).toEqual(Object.keys(full));
    expect(full.imageAssets.map(asset => asset.id)).toHaveLength(2);
    expect(recovery.imageAssets).toEqual([]);
    expect({ ...recovery, imageAssets: null }).toEqual({ ...full, imageAssets: null });
  });

  test('a load restamps every waypoint `modified`, and keeps `created`', async () => {
    // The `Waypoint` constructor sets `modified = Date.now()` unconditionally
    // (`Waypoint.js:173`), so `fromJSON` discards the persisted value: after a
    // round trip the field records when the project was last *opened*, not
    // when it was last edited. The plan already owns this — §13 ⑬ and §20 Q12,
    // whose answer is to restore it in W8 — so it is characterised here, not
    // fixed.
    const app = await appWithProject(buildExampleProjects()[0].project);
    const saved = app._buildProjectSnapshot();
    expect(saved.waypoints.every(waypoint => waypoint.modified === FIXED_NOW)).toBe(true);

    const later = FIXED_NOW + 60_000;
    vi.setSystemTime(later);
    expect(await loadSnapshot(app, saved)).toBe(true);
    const reloaded = app._buildProjectSnapshot();

    expect(reloaded.waypoints.map(waypoint => waypoint.modified))
      .toEqual(saved.waypoints.map(() => later));
    expect(reloaded.waypoints.map(waypoint => waypoint.created))
      .toEqual(saved.waypoints.map(waypoint => waypoint.created));
  });

  test('every waypoint field of the save shape is moved off its default by a golden', async () => {
    // The guard that keeps the goldens worth having. A field that no golden
    // ever moves is a field a serialiser could drop for nothing, so adding one
    // to `Waypoint.toJSON` fails here until a fixture exercises it.
    const app = await appWithProject(authoredExtrasProject());
    const saved = app._buildProjectSnapshot();
    const defaults = Waypoint.createMajor(0.5, 0.5).toJSON();

    // Identity and position are per-waypoint by nature; `customImage` is an
    // HTMLImageElement the shape deliberately never serialises (`Waypoint.js:422`).
    const exempt = new Set(['id', 'imgX', 'imgY', 'created', 'modified', 'customImage']);
    const unexercised = Object.keys(defaults)
      .filter(field => !exempt.has(field))
      .filter(field => saved.waypoints.every(waypoint =>
        JSON.stringify(waypoint[field]) === JSON.stringify(defaults[field])));

    expect(unexercised).toEqual([]);
  });

  test('the bundled examples are built beside the save shape, not through it', () => {
    // `src/examples/index.js` writes its snapshots by hand rather than through
    // `_buildProjectSnapshot`, so the two shapes can drift apart. They have:
    // an example omits `renderReference`, `timingReference` and
    // `motionSettings.revealTrail`, which the loader then defaults. That is
    // survivable, and it is why every golden above is taken *after* a load
    // rather than from the example object.
    const example = buildExampleProjects()[0];

    expect(Object.keys(example.project)).not.toContain('renderReference');
    expect(Object.keys(example.project)).not.toContain('timingReference');
    expect(example.project.motionSettings).not.toHaveProperty('revealTrail');
  });

});
