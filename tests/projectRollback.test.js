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

/** What a rollback must give back, and how the renderer and controls show it. */
function stateOf(app) {
  return {
    waypointIds: app.waypoints.map(waypoint => waypoint.id),
    graphicsScale: app.styles.graphicsScale,
    rendererScale: app.renderingService._graphicsScale,
    scaleControl: app.elements.graphicsScale.value,
    mode: app.animationEngine.state.mode,
    assetIds: [...app.imageAssetService.getAssetIds()].sort(),
    undo: { canUndo: app.undoService.canUndo(), canRedo: app.undoService.canRedo() },
  };
}

/**
 * An app with a project of its own (custom images, an edit to undo), and a
 * project file that differs from it in every surface a rollback restores.
 */
async function appAndIncomingProject() {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, authoredExtrasProject())).toBe(true);
  app.eventBus.emit('waypoint:add', { imgX: 0.4, imgY: 0.5, isMajor: true });
  const before = stateOf(app);
  expect(before.assetIds.length).toBeGreaterThan(0);
  expect(before.undo.canUndo).toBe(true);

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
  return { app, before };
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

test('a failed load with no failing rollback step gives every surface back', async () => {
  allowConsole(/Failed to load project/);
  const { app, before } = await appAndIncomingProject();
  failLate(app);

  const prune = vi.spyOn(app, 'pruneImageAssets');

  expect(await app.loadProject(new File([''], 'incoming.zip'))).toBe(false);

  // The commit reached its last step, so everything had switched before it rolled back.
  expect(prune).toHaveBeenCalled();
  expect(stateOf(app)).toEqual(before);
});

test('a rollback whose image-asset step fails still restores the rest: model, history, renderer and controls (DEF-49)', async () => {
  allowConsole(/Failed to load project/, /Project rollback could not restore the image assets/);
  const { app, before } = await appAndIncomingProject();
  failLate(app);
  // The commit replaces the assets first (call 1); the rollback's is call 2.
  failCall(app.imageAssetService, 'replaceAssets', 2);

  expect(await app.loadProject(new File([''], 'incoming.zip'))).toBe(false);

  const after = stateOf(app);
  expect({ ...after, assetIds: before.assetIds }).toEqual(before);
  expect(recordedConsole()).toContainEqual(expect.stringMatching(/Project rollback could not restore the image assets/));
});

test('a rollback whose undo step fails still restores the rest: model, assets, transport, renderer and controls (DEF-49)', async () => {
  allowConsole(/Failed to load project/, /Project rollback could not restore the undo history/);
  const { app, before } = await appAndIncomingProject();
  failLate(app);
  failCall(app.undoService, 'restoreSnapshot', 1);

  expect(await app.loadProject(new File([''], 'incoming.zip'))).toBe(false);

  const after = stateOf(app);
  expect({ ...after, undo: before.undo }).toEqual(before);
  expect(recordedConsole()).toContainEqual(expect.stringMatching(/Project rollback could not restore the undo history/));
});
