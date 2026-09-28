import { offerParkedAutosave } from './unrestoredAutosave.js';

/**
 * Restore browser recovery before choosing a default background. Keeping this
 * sequence separate makes the async startup boundary directly testable.
 * @param {Object} app - RoutePlotter-like app instance
 * @returns {Promise<boolean>} Whether an autosave was restored
 */
export async function restoreStartupProject(app) {
  const restored = await app.loadAutosave();
  // A record an earlier session could not restore is offered again (DEF-28).
  offerParkedAutosave(app);
  if (!restored && !app.background.image) {
    await app.loadDefaultImage();
  }
  return restored;
}
