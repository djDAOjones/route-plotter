import { offerKeptAutosave } from './unrestoredAutosave.js';

/**
 * Restore browser recovery before choosing a default background. Keeping this
 * sequence separate makes the async startup boundary directly testable.
 * @param {Object} app - RoutePlotter-like app instance
 * @returns {Promise<boolean>} Whether an autosave was restored
 */
export async function restoreStartupProject(app) {
  // A record an earlier start could not restore is offered again, before
  // this start's restore, so what the restore reports can point to it (DEF-28).
  offerKeptAutosave(app);
  // The project this start began with: a project opened, or the project
  // cleared, while recovery was read (its images take a moment, DEF-98) is
  // the author's, and no default map goes in under it (Codex, code review
  // round 1, 5). Nothing restored is not the same as the restore superseded.
  const generation = app._projectGeneration || 0;
  const restored = await app.loadAutosave();
  if (!restored && !app.background.image && (app._projectGeneration || 0) === generation) {
    await app.loadDefaultImage();
  }
  return restored;
}
