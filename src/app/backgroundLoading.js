import {
  beginAsyncProjectOperation,
  isAsyncProjectOperationCurrent,
} from './operationGeneration.js';
import { ImageAsset } from '../models/ImageAsset.js';

const MIME_BY_EXTENSION = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
});

async function loadBundledImageAsset(imagePath) {
  const response = await fetch(imagePath);
  if (!response.ok) throw new Error(`Background request failed (${response.status})`);
  const blob = await response.blob();
  const name = decodeURIComponent(imagePath.split('/').pop() || 'background');
  const extension = name.split('.').pop()?.toLowerCase();
  const mimeType = blob.type || MIME_BY_EXTENSION[extension];
  const file = new File([blob], name, { type: mimeType });
  return ImageAsset.fromFile(file);
}

/**
 * Validate/decode a user-selected background off to the side, then commit it
 * only if no newer background request or project replacement superseded it.
 */
export async function loadBackgroundFile(app, file) {
  const token = beginAsyncProjectOperation(app, 'background');
  try {
    const asset = app.loadImageFileAsset
      ? await app.loadImageFileAsset(file)
      : null;
    const img = asset ? await asset.getImageElement() : await app.loadImageFile(file);
    if (!isAsyncProjectOperationCurrent(app, token)) return false;

    app.background.image = img;
    // Historical field name: this retains the validated original source data
    // URL for explicit ZIP/HTML export. Browser autosave never serialises it.
    app._autosaveBackgroundCache = asset?.base64
      ? { image: img, dataURL: asset.base64 }
      : null;
    app.updateImageTransform(img);
    app.exportSettings.resolutionX = img.naturalWidth;
    app.exportSettings.resolutionY = img.naturalHeight;
    if (app.elements.exportResX) app.elements.exportResX.value = img.naturalWidth;
    if (app.elements.exportResY) app.elements.exportResY.value = img.naturalHeight;
    console.debug(`📐 [Resolution] Set to image native size: ${img.naturalWidth}×${img.naturalHeight}`);

    app.updateCanvasAspectRatio();
    if (app.waypoints.length >= 2) app.calculatePath();
    app.autoSave();
    return true;
  } catch (error) {
    if (!isAsyncProjectOperationCurrent(app, token)) return false;
    console.error('Background upload rejected:', error);
    app.announce(`Background not loaded: ${error.message}`);
    return false;
  }
}

/**
 * Load a bundled example with the same latest-request/project-generation rule.
 * Resolves false for stale or failed requests so callers can test completion.
 */
export async function loadExampleBackground(app, imagePath, {
  autoSave = true,
  loadAsset = loadBundledImageAsset,
} = {}) {
  const token = beginAsyncProjectOperation(app, 'background');
  try {
    const asset = await loadAsset(imagePath);
    const img = await asset.getImageElement();
    if (!isAsyncProjectOperationCurrent(app, token)) return false;

    app.background.image = img;
    // See loadBackgroundFile: source bytes are export-only, not recovery data.
    app._autosaveBackgroundCache = { image: img, dataURL: asset.base64 };
    app.updateImageTransform(img);
    app.eventBus.emit('video:resolution-native');
    if (app.waypoints.length >= 2) app.calculatePath();
    app.render();
    if (autoSave) app.autoSave();
    console.log(`Example image loaded: ${imagePath}`);
    return true;
  } catch (error) {
    if (isAsyncProjectOperationCurrent(app, token)) {
      console.error(`Failed to load example image: ${imagePath}`, error);
    }
    return false;
  }
}
