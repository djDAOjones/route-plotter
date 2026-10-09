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
  if (!response.ok) throw new Error(`the file could not be fetched (HTTP ${response.status})`);
  const blob = await response.blob();
  const name = decodeURIComponent(imagePath.split('/').pop() || 'background');
  const extension = name.split('.').pop()?.toLowerCase();
  const mimeType = blob.type || MIME_BY_EXTENSION[extension];
  const file = new File([blob], name, { type: mimeType });
  return ImageAsset.fromFile(file);
}

/**
 * Why a background was not loaded, in the author's words (UI-06 B-16,
 * DEF-91): a file the decoder refuses, whatever the refusal, is "unsupported";
 * any other reason (a fetch, a size) is said as the loader said it.
 * @param {Error|string} error
 * @returns {string}
 */
function describeBackgroundFailure(error) {
  const message = String(error?.message ?? error ?? '');
  if (/Unsupported or oversized|Choose a PNG|do not match the declared|Failed to load image|Invalid image|does not match its data URL/.test(message)) {
    return 'unsupported file. Use PNG, JPEG or WebP';
  }
  return message ? message.charAt(0).toLowerCase() + message.slice(1) : 'unknown reason';
}

/**
 * A background that did not load is said, as a toast the author must hear,
 * and the reason with it (UI-06 B-16, DEF-91): never silent, never only a
 * console line. The toast is announced once through the queue (J-05); a host
 * with no toast hears the announcement alone.
 * @param {Object} app
 * @param {Error|string} error
 */
function reportBackgroundFailure(app, error) {
  const message = `Background not loaded: ${describeBackgroundFailure(error)}`;
  if (app.eventBus?.emit) app.eventBus.emit('ui:toast', { message, priority: 'assertive' });
  else app.announce?.(message, 'assertive');
}

/** The canvas area is busy while a background decodes (UI-06 B-16). */
function setCanvasBusy(busy) {
  document.getElementById('canvas-area')?.setAttribute('aria-busy', busy ? 'true' : 'false');
}

/**
 * A project replacement (Open, Clear) supersedes every background request
 * made for the project it replaces: none of them can commit now, so the
 * canvas area is not busy for them (UI-06 B-16, Codex r1). A request started
 * after it sets the flag again and owns it; one it superseded, settling
 * later, is no longer current and leaves the flag alone.
 */
export function releaseBackgroundBusy() {
  setCanvasBusy(false);
}

/**
 * Validate/decode a user-selected background off to the side, then commit it
 * only if no newer background request or project replacement superseded it.
 */
export async function loadBackgroundFile(app, file) {
  const token = beginAsyncProjectOperation(app, 'background');
  setCanvasBusy(true);
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
    app.updateExportAvailability?.();
    app.autoSave();
    return true;
  } catch (error) {
    if (!isAsyncProjectOperationCurrent(app, token)) return false;
    console.error('Background upload rejected:', error);
    reportBackgroundFailure(app, error);
    return false;
  } finally {
    // A newer request owns the flag now; this one leaves it alone.
    if (isAsyncProjectOperationCurrent(app, token)) setCanvasBusy(false);
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
  setCanvasBusy(true);
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
    app.updateExportAvailability?.();
    app.render();
    if (autoSave) app.autoSave();
    console.log(`Example image loaded: ${imagePath}`);
    return true;
  } catch (error) {
    if (isAsyncProjectOperationCurrent(app, token)) {
      console.error(`Failed to load example image: ${imagePath}`, error);
      // Never silent (DEF-91): the author chose this image and hears why it is not there.
      reportBackgroundFailure(app, error);
    }
    return false;
  } finally {
    if (isAsyncProjectOperationCurrent(app, token)) setCanvasBusy(false);
  }
}
