/**
 * The app, route and project helpers the DEF-52 trace tests share
 * (`traceStorage.test.js` and `traceStorageLimits.test.js`): apps that do not
 * draw, routes of majors, a trace and a refused one, and a project's file
 * metadata worked out as Save Project writes it.
 */

import { expect, vi } from 'vitest';
import { bootApp } from './bootApp.js';
import { loadSnapshot } from './projectSnapshot.js';
import { loadBackgroundFile } from '../../src/app/backgroundLoading.js';
import { applyTraceToLayer, traceRouteIntoGraph } from '../../src/utils/routeTrace.js';
import { ImageAsset } from '../../src/models/ImageAsset.js';

export const major = (id, name = id, extra = {}) => ({ id, name, imgX: 0.2, imgY: 0.3, isMajor: true, ...extra });

/** Hundreds of majors take a while to trace, check and reopen, more under load. */
export const LARGE = 30000;

/**
 * A booted app that does not draw. These routes are as large as a project may
 * hold, the harness keeps every canvas call, and the editor draws frame after
 * frame while a test waits: gigabytes, for nothing these tests read (the
 * worker ran out of memory at 4 GB).
 */
export async function undrawn() {
  const app = await bootApp();
  await app.ready;
  vi.spyOn(app, 'render').mockImplementation(() => {});
  return app;
}

/** An app with `waypoints` open, and a crowd added, as the author adds one, unless `scene` has crowds. */
export async function withRoute(waypoints, scene = null) {
  const app = await undrawn();
  expect(await loadSnapshot(app, { coordVersion: 9, waypoints, ...(scene ? { scene } : {}) })).toBe(true);
  if (!scene) app.addCrowd();
  return app;
}

/** A fresh app with `snapshot` open as saved, or null when the loader refuses it. */
export async function reopened(snapshot) {
  const fresh = await undrawn();
  return (await loadSnapshot(fresh, snapshot)) ? fresh : null;
}

/** Trace the route into `layer`, and hear what the author is told. */
export function trace(app, layer) {
  const toast = vi.fn();
  app.eventBus.on('ui:toast', toast);
  const traced = app.traceRouteIntoCrowd(layer);
  return { traced, told: toast.mock.calls.map(([{ message }]) => message) };
}

/**
 * Refused: the crowd keeps its network, nothing is recorded or saved, the
 * author is told `message`, once, and the project still reopens as it was
 * (unless it never did: `reopens: false`). `unchanged` is checked before the
 * reopening, which boots another app.
 */
export async function refused(app, layer, message, unchanged = () => {}, { reopens = true } = {}) {
  const network = JSON.stringify(layer.graph.toJSON());
  const undo = app.undoService.createSnapshot();
  const saving = vi.spyOn(app, 'autoSave');

  const { traced, told } = trace(app, layer);

  expect(traced).toBe(false);
  expect(told).toEqual([message]);
  expect(JSON.stringify(layer.graph.toJSON())).toBe(network);
  expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(saving).not.toHaveBeenCalled();
  unchanged();
  if (reopens) expect(await reopened(app._buildProjectSnapshot())).not.toBeNull();
}

/** What a string takes in a file: its UTF-8 bytes. */
export const bytesOf = text => new TextEncoder().encode(text).length;

/**
 * A project's file metadata as Save Project writes it: `project.json`, the
 * background file it names (if it has one), and its images' manifest.
 */
export const fileMetadata = (project, manifest = [], backgroundFile = null) => JSON.stringify(
  { ...project, ...(backgroundFile ? { backgroundFile } : {}), assetManifest: manifest }, null, 2);

/** A background, as the author loads one: Save Project then carries it, and `project.json` names its file. */
export async function withBackground(app) {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const image = Object.assign(new Image(), { naturalWidth: 1, naturalHeight: 1, width: 1, height: 1 });
  vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: png, getImageElement: async () => image });
  expect(await loadBackgroundFile(app, new File(['x'], 'background.png', { type: 'image/png' }))).toBe(true);
  return png;
}

/** A custom marker image on the first waypoint, as the author adds one: a file then carries it, and its manifest names it. */
export function withMarkerImage(app) {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const asset = new ImageAsset({
    id: 'custom', name: 'icon.png', base64: png, width: 1, height: 1, mimeType: 'image/png', size: ImageAsset.inspectDataURL(png).byteLength,
  });
  app.imageAssetService.addAsset(asset);
  app.waypoints[0].customImageAssetId = asset.id;
  app.waypoints[0].markerStyle = 'custom';
}

/** The project the trace would make, worked out here: the project as saved, the crowd's network the trace's. */
export function traced(app, layer) {
  const project = app._buildProjectSnapshot({ includeAssets: false });
  const network = { graph: new layer.graph.constructor() };
  applyTraceToLayer(network, traceRouteIntoGraph(app.waypoints));
  project.scene.flowLayers = project.scene.flowLayers.map(each => (each.id === layer.id
    ? { ...layer.toJSON(), guideType: 'graph', graph: network.graph.toJSON() } : each));
  return project;
}
