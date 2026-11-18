/**
 * DEF-52 — a trace refused at the file's 2 MB, exactly.
 *
 * The project a trace would make is checked as Save Project would write it,
 * before the trace replaces anything (`traceStorage.test.js` has the rest).
 * Here the file's metadata, `project.json`, is taken to 2 MB exactly, and to
 * a byte more, by the first major's name: with no images, with an image's
 * manifest in the file, and with a background, whose file the metadata
 * names. At 2 MB the route is traced and the file and browser recovery
 * reopen; a byte more, it is refused. Each case builds projects of 2 MB, and
 * together they outgrew one test worker's memory, so they run in a file of
 * their own.
 */

import { expect, test } from 'vitest';
import {
  LARGE, bytesOf, fileMetadata, major, refused, reopened, trace, traced, undrawn, withBackground, withMarkerImage, withRoute
} from './helpers/traceProject.js';

test.each([
  ['exactly 2 MB is traced, and the file and recovery reopen', 0, false, false],
  ['a byte more is not traced', 1, false, false],
  ['exactly 2 MB, its images’ manifest counted, is traced, and the file and recovery reopen', 0, true, false],
  ['a byte more, its images’ manifest counted, is not traced', 1, true, false],
  ['exactly 2 MB, its background’s file name counted, is traced, and the file and recovery reopen', 0, false, true],
  ['a byte more, its background’s file name counted, is not traced', 1, false, true],
])('a trace whose file metadata would be %s', async (_, over, image, background) => {
  const limit = 2 * 1024 * 1024;
  const app = await withRoute(Array.from({ length: 900 }, (_, index) => major(`w${index}`, 'q'.repeat(40))));
  const layer = app.scene.flowLayers[0];
  if (image) withMarkerImage(app);
  const backgroundData = background ? await withBackground(app) : null;
  // Worked out here, and as Save Project's own preparation writes it (the
  // manifest and the background's file name taken from it once, before the
  // names grow)
  const written = project => app.imageAssetService.prepareArchive(project, backgroundData).projectJSON;
  const { assetManifest: manifest, backgroundFile = null } = JSON.parse(written(traced(app, layer)));
  expect([manifest.length, backgroundFile]).toEqual([image ? 1 : 0, background ? 'background.png' : null]);
  const metadata = () => fileMetadata(traced(app, layer), manifest, backgroundFile);
  expect(metadata()).toBe(written(traced(app, layer)));
  const reopensFrom = async zip => (await undrawn()).loadProject(zip);
  expect(await reopensFrom(await app.imageAssetService.exportZip(app._buildProjectSnapshot({ includeAssets: false }), backgroundData))).toBe(true);
  // The first major's name appears twice (the waypoint and its node), the crowd's once: make up the bytes to the limit
  let gap = limit + over - bytesOf(metadata());
  expect(gap).toBeGreaterThan(0);
  if (gap % 2) {
    layer.name += 'x';
    gap -= 1;
  }
  app.waypoints[0].name += 'q'.repeat(gap / 2);
  expect(bytesOf(metadata())).toBe(limit + over);

  if (over) {
    await refused(app, layer, 'This route can’t be traced into a crowd: Project metadata exceeds the 2 MB limit.');
    return;
  }
  expect(trace(app, layer).traced).toBe(true);
  const saved = app._buildProjectSnapshot({ includeAssets: false });
  expect(bytesOf(written(saved))).toBe(limit);
  const fresh = await undrawn();
  expect(await fresh.loadProject(await app.imageAssetService.exportZip(saved, backgroundData))).toBe(true);
  app.storageService.flushAutoSave();
  expect(await reopened(JSON.parse(app.storageService._lastSerialized))).not.toBeNull();
}, LARGE);
