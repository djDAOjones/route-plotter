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
  const restored = await app.loadAutosave();
  if (!restored && !app.background.image) {
    await app.loadDefaultImage();
  }
  return restored;
}
