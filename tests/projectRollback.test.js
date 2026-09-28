/**
 * DEF-49 — a load that fails late keeps rolling back when a step of the
 * rollback fails.
 *
 * A project load commits the staged project, and if anything in the commit
 * fails it puts the previous one back (`restoreLiveState`). The code promises
 * that each surface is restored independently, "so one secondary rollback
 * error never hides the load error or prevents the remaining surfaces from
 * being repaired". The image assets and the undo history were restored
 * inline, early, so a failure in either skipped everything after it: the
 * previous waypoints came back beside the failed project's styles, settings,
 * transport and controls, and the next edit saved that mixture.
 *
 * What this does not cover: a failed load leaves the candidate's route
 * caches and its pending timing work in place (DEF-51).
 */

import { afterEach, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole, recordedConsole } from './helpers/consoleGuard.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { authoredExtrasProject } from './fixtures/authoredExtras.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * What these tests compare after a rollback: the waypoints, the Graphics
 * scale as the model, the renderer and its control hold it, the timing mode,
 * the image assets with their contents, and the whole undo history.
 */
function stateOf(app) {
  return {
    waypointIds: app.waypoints.map(waypoint => waypoint.id),
    graphicsScale: app.styles.graphicsScale,
    rendererScale: app.renderingService._graphicsScale,
    scaleControl: app.elements.graphicsScale.value,
    mode: app.animationEngine.state.mode,
    assets: JSON.stringify(app.imageAssetService.toJSON()),
    history: app.undoService.createSnapshot(),
  };
}

/**
 * An app with a project of its own (custom images; two edits, one undone, so
 * there is history to undo and to redo), and a project file that differs
 * from it in each surface `stateOf` compares.
 */
async function appAndIncomingProject() {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, authoredExtrasProject())).toBe(true);
  app.eventBus.emit('waypoint:add', { imgX: 0.4, imgY: 0.5, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.6, imgY: 0.5, isMajor: true });
  const redone = app.waypoints.map(waypoint => waypoint.id);
  app.undo();
  const before = stateOf(app);
  expect(app.imageAssetService.getAssetIds().length).toBeGreaterThan(0);
  expect(before.history.undoStack.length).toBeGreaterThan(0);
  expect(before.history.redoStack.length).toBeGreaterThan(0);

  const incoming = app._buildProjectSnapshot({ includeAssets: false });
  incoming.imageAssets = [];
  incoming.styles = {
    ...incoming.styles,
    graphicsScale: before.graphicsScale * 2,
    pathHead: { ...incoming.styles.pathHead, style: 'arrow', image: null, imageAssetId: null },
  };
  incoming.waypoints = [{ id: 'incoming', imgX: 0.2, imgY: 0.3, isMajor: true }];
  incoming.scene = { flowLayers: [] };
  incoming.animationState = {
    ...incoming.animationState,
    mode: before.mode === 'constant-time' ? 'constant-speed' : 'constant-time',
  };
  vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
    projectData: incoming, imageAssets: [], backgroundBase64: null,
  });
  return { app, before, redone };
}

/**
 * Make the commit fail late: after the model, the controls and the undo
 * history have all switched to the new project.
 */
function failLate(app) {
  vi.spyOn(app, 'pruneImageAssets').mockImplementationOnce(() => {
    throw new Error('the commit failed after the project switched');
  });
}

/** Make the n-th call to a method fail. */
function failCall(target, method, n) {
  const original = target[method].bind(target);
  let calls = 0;
  vi.spyOn(target, method).mockImplementation((...args) => {
    calls += 1;
    if (calls === n) throw new Error(`${method} failed during the rollback`);
    return original(...args);
  });
}

test('a failed load with no failing rollback step gives back what these tests compare, and the edit undone can be redone', async () => {
  allowConsole(/Failed to load project/);
  const { app, before, redone } = await appAndIncomingProject();
  failLate(app);

  const prune = vi.spyOn(app, 'pruneImageAssets');

  expect(await app.loadProject(new File([''], 'incoming.zip'))).toBe(false);

  // The commit reached its last step, so everything had switched before it rolled back.
  expect(prune).toHaveBeenCalled();
  expect(stateOf(app)).toEqual(before);
  app.redo();
  expect(app.waypoints.map(waypoint => waypoint.id)).toEqual(redone);
});

test('a rollback whose image-asset step fails still restores the rest: model, history, renderer and controls (DEF-49)', async () => {
  allowConsole(/Failed to load project/, /Project rollback could not restore the image assets/);
  const { app, before, redone } = await appAndIncomingProject();
  failLate(app);
  // The commit replaces the assets first (call 1); the rollback's is call 2.
  failCall(app.imageAssetService, 'replaceAssets', 2);

  expect(await app.loadProject(new File([''], 'incoming.zip'))).toBe(false);

  const after = stateOf(app);
  expect({ ...after, assets: before.assets }).toEqual(before);
  expect(recordedConsole()).toContainEqual(expect.stringMatching(/Project rollback could not restore the image assets/));
  app.redo();
  expect(app.waypoints.map(waypoint => waypoint.id)).toEqual(redone);
});

test('a rollback whose undo step fails still restores the rest: model, assets, transport, renderer and controls (DEF-49)', async () => {
  allowConsole(/Failed to load project/, /Project rollback could not restore the undo history/);
  const { app, before } = await appAndIncomingProject();
  failLate(app);
  failCall(app.undoService, 'restoreSnapshot', 1);

  expect(await app.loadProject(new File([''], 'incoming.zip'))).toBe(false);

  const after = stateOf(app);
  expect({ ...after, history: before.history }).toEqual(before);
  expect(recordedConsole()).toContainEqual(expect.stringMatching(/Project rollback could not restore the undo history/));
});
