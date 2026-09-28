/**
 * DEF-49 — a load that fails late is rolled back in full, even when a step of
 * the rollback fails.
 *
 * A project load commits the staged project, and if anything in the commit
 * fails it puts the previous one back (`restoreLiveState`). The code promises
 * that each surface is restored independently, "so one secondary rollback
 * error never hides the load error or prevents the remaining surfaces from
 * being repaired". The image assets and the undo history were restored
 * inline, early, so a failure in either skipped everything after it: the
 * previous waypoints came back beside the failed project's styles, and the
 * next edit saved that mixture.
 */

import { afterEach, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { allowConsole, recordedConsole } from './helpers/consoleGuard.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** An app with one waypoint of its own, and a project file that differs from it. */
async function appAndIncomingProject() {
  const app = await bootApp();
  await app.ready;
  app.eventBus.emit('waypoint:add', { imgX: 0.4, imgY: 0.5, isMajor: true });
  const incoming = app._buildProjectSnapshot();
  incoming.styles.graphicsScale = app.styles.graphicsScale + 1;
  incoming.waypoints = [{ id: 'incoming', imgX: 0.2, imgY: 0.3, isMajor: true }];
  const mode = app.animationEngine.state.mode;
  incoming.animationState = { ...incoming.animationState, mode: mode === 'constant-time' ? 'constant-speed' : 'constant-time' };
  vi.spyOn(app.imageAssetService, 'importZip').mockResolvedValue({
    projectData: incoming, imageAssets: [], backgroundBase64: null,
  });
  return { app, before: { waypointId: app.waypoints[0].id, graphicsScale: app.styles.graphicsScale, mode } };
}

/** Make the commit fail late, after the model has switched to the new project. */
function failLate(app) {
  vi.spyOn(app, 'updateWaypointList').mockImplementationOnce(() => {
    throw new Error('the commit failed after the model switched');
  });
}

/** Make the n-th call to a method fail: a step of the rollback. */
function failCall(target, method, n) {
  const original = target[method].bind(target);
  let calls = 0;
  vi.spyOn(target, method).mockImplementation((...args) => {
    calls += 1;
    if (calls === n) throw new Error(`${method} failed during the rollback`);
    return original(...args);
  });
}

test('a rollback whose image-asset step fails still restores the model and settings (DEF-49)', async () => {
  allowConsole(/Failed to load project/, /Project rollback could not restore the image assets/);
  const { app, before } = await appAndIncomingProject();
  failLate(app);
  // The commit replaces the assets first (call 1); the rollback's is call 2.
  failCall(app.imageAssetService, 'replaceAssets', 2);

  expect(await app.loadProject(new File([''], 'incoming.zip'))).toBe(false);

  expect(app.waypoints.map(waypoint => waypoint.id)).toEqual([before.waypointId]);
  expect(app.styles.graphicsScale).toBe(before.graphicsScale);
  expect(recordedConsole()).toContainEqual(expect.stringMatching(/Project rollback could not restore the image assets/));
});

test('a rollback whose undo step fails still restores the transport and the controls (DEF-49)', async () => {
  allowConsole(/Failed to load project/, /Project rollback could not restore the undo history/);
  const { app, before } = await appAndIncomingProject();
  failLate(app);
  failCall(app.undoService, 'restoreSnapshot', 1);

  expect(await app.loadProject(new File([''], 'incoming.zip'))).toBe(false);

  expect(app.styles.graphicsScale).toBe(before.graphicsScale);
  // What is restored after the undo history is restored too.
  expect(app.animationEngine.state.mode).toBe(before.mode);
  expect(recordedConsole()).toContainEqual(expect.stringMatching(/Project rollback could not restore the undo history/));
});
