/**
 * DEF-52 — a traced crowd network the project cannot reopen.
 *
 * Tracing the route into a crowd copies each leg's minor waypoints into its
 * path as bends. A saved crowd may hold at most 256 bends on a path (the
 * loader's budget), but the trace held none to it: a leg of 257 minors traced
 * and saved, and the project then would not open. The trace is now checked as
 * the loader checks a saved crowd, before it replaces anything, and refused,
 * saying why, when the project could not store it.
 */

import { expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';

/** A route of two majors with `bends` minors between them, in a zig-zag. */
function routeWithBends(bends) {
  const minors = Array.from({ length: bends }, (_, index) => ({
    id: `bend-${index}`,
    imgX: 0.2 + (0.6 * (index + 1)) / (bends + 1),
    imgY: index % 2 ? 0.45 : 0.55,
    isMajor: false,
  }));
  return {
    coordVersion: 9,
    waypoints: [
      { id: 'start', name: 'Main entrance', imgX: 0.2, imgY: 0.5, isMajor: true },
      ...minors,
      { id: 'end', name: 'Library', imgX: 0.8, imgY: 0.5, isMajor: true },
    ],
  };
}

/** An app with that route open and a crowd added, as the author adds one. */
async function withCrowd(bends) {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, routeWithBends(bends))).toBe(true);
  app.addCrowd();
  return { app, layer: app.scene.flowLayers[0] };
}

/** Whether a fresh app opens `snapshot` as saved, crowd and all. */
async function reopens(snapshot) {
  const fresh = await bootApp();
  await fresh.ready;
  const opened = await loadSnapshot(fresh, snapshot);
  return opened && fresh.scene.flowLayers.length === snapshot.scene.flowLayers.length;
}

test('a leg of 256 bends traces into the crowd, and the project reopens with them', async () => {
  const { app, layer } = await withCrowd(256);

  expect(app.traceRouteIntoCrowd(layer)).toBe(true);

  const [path] = layer.graph.getEdges();
  expect(path.controlPoints).toHaveLength(256);
  expect(await reopens(app._buildProjectSnapshot())).toBe(true);
});

test('a leg of 257 bends is not traced: the crowd keeps its network, nothing is recorded, and the author is told why', async () => {
  const { app, layer } = await withCrowd(257);
  const network = JSON.stringify(layer.graph.toJSON());
  const undo = app.undoService.createSnapshot();
  const toast = vi.fn();
  app.eventBus.on('ui:toast', toast);

  expect(app.traceRouteIntoCrowd(layer)).toBe(false);

  expect(JSON.stringify(layer.graph.toJSON())).toBe(network);
  expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(toast).toHaveBeenCalledWith({
    message: 'The leg from Main entrance has 257 bends, more than the 256 a crowd’s path can hold. '
      + 'Remove some of its minor waypoints, then trace again.',
  });
  expect(await reopens(app._buildProjectSnapshot())).toBe(true);
});
