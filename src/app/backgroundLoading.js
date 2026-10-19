import {
  beginAsyncProjectOperation,
  isAsyncProjectOperationCurrent,
} from './operationGeneration.js';
import { ImageAsset } from '../models/ImageAsset.js';
import { primeRecoveryImages, resolveBackgroundPrompt } from './recoveryImages.js';

const MIME_BY_EXTENSION = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
});

/**
 * A bundled image the browser could not download: what happened, in the
 * author's words, with the status when the site answered one, and what to do
 * next (UI-06 B-16, the owner's words).
 * @param {number} [status]
 * @returns {Error}
 */
function downloadFailure(status) {
  const error = new Error(`the image could not be downloaded${status ? ` (HTTP ${status})` : ''}`);
  error.nextStep = 'Check your connection and choose it again, or use Choose image.';
  return error;
}

async function loadBundledImageAsset(imagePath) {
  // A fetch that rejects (offline) has no status to give.
  const response = await fetch(imagePath).catch(() => { throw downloadFailure(); });
  if (!response.ok) throw downloadFailure(response.status);
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
 * console line; a download that failed says what to do next too. The toast
 * is announced once through the queue (J-05); a host with no toast hears the
 * announcement alone.
 * @param {Object} app
 * @param {Error|string} error
 */
function reportBackgroundFailure(app, error) {
  const nextStep = error?.nextStep ? `. ${error.nextStep}` : '';
  const message = `Background not loaded: ${describeBackgroundFailure(error)}${nextStep}`;
  if (app.eventBus?.emit) app.eventBus.emit('ui:toast', { message, priority: 'assertive' });
  else app.announce?.(message, 'assertive');
}

/**
 * Background → Show image and Include in export → Background image are one
 * setting (UI-08): both are ticked as the project's background is shown.
 * @param {Object} app
 * @param {Object} [background] - The background they follow, the app's by default
 */
export function syncShowImageControls(app, background = app.background) {
  const shown = background?.hidden !== true;
  if (app.elements?.bgShowImage) app.elements.bgShowImage.checked = shown;
  if (app.elements?.exportIncludeImage) app.elements.exportIncludeImage.checked = shown;
}

/**
 * Show or hide the background image (UI-08). Hidden, it is drawn nowhere,
 * while editing, in playback or in any export, but kept and saved, so showing
 * it again needs no upload. One change is one undo step.
 * @param {Object} app
 * @param {boolean} hidden
 * @param {Object} [options]
 * @param {boolean} [options.autoSave=true] - Save to browser recovery too
 * @returns {boolean} Whether the setting changed
 */
export function setBackgroundHidden(app, hidden, { autoSave = true } = {}) {
  const next = hidden === true;
  if ((app.background.hidden === true) === next) {
    syncShowImageControls(app);
    return false;
  }
  // A slider edit still inside its undo debounce is a step of its own, before this one
  app._flushPendingUndo?.();
  app.background.hidden = next;
  syncShowImageControls(app);
  app.queueRender?.();
  app.saveUndoState?.();
  if (autoSave) app.autoSave?.();
  return true;
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
    // Historical field name: this holds the validated original source data
    // URL, for explicit ZIP/HTML export and for browser recovery, which keeps
    // those bytes in its image store and its record names them (DEF-98).
    app._autosaveBackgroundCache = asset?.base64
      ? { image: img, dataURL: asset.base64 }
      : null;
    // Its file name, kept with it in recovery (DEF-98).
    app._backgroundName = typeof file?.name === 'string' && file.name ? file.name : null;
    app.updateImageTransform(img);
    app.exportSettings.resolutionX = img.naturalWidth;
    app.exportSettings.resolutionY = img.naturalHeight;
    if (app.elements.exportResX) app.elements.exportResX.value = img.naturalWidth;
    if (app.elements.exportResY) app.elements.exportResY.value = img.naturalHeight;
    console.debug(`📐 [Resolution] Set to image native size: ${img.naturalWidth}×${img.naturalHeight}`);

    app.updateCanvasAspectRatio();
    if (app.waypoints.length >= 2) app.calculatePath();
    app.updateExportAvailability?.();
    // A background that did not come back is no longer missing; and this
    // one is stored at once, so the record seldom finds it in flight (DEF-98).
    resolveBackgroundPrompt(app);
    primeRecoveryImages(app);
    // Chosen while hidden, it is shown, one undo step (UI-08, the owner's
    // pick); the save below covers it
    setBackgroundHidden(app, false, { autoSave: false });
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
    // See loadBackgroundFile: the source bytes, for export and recovery alike.
    app._autosaveBackgroundCache = { image: img, dataURL: asset.base64 };
    // A bundled image's file name (DEF-98).
    app._backgroundName = typeof asset.name === 'string' && asset.name
      ? asset.name
      : decodeURIComponent(String(imagePath).split('/').pop() || '') || null;
    app.updateImageTransform(img);
    app.eventBus.emit('video:resolution-native');
    if (app.waypoints.length >= 2) app.calculatePath();
    app.updateExportAvailability?.();
    // As loadBackgroundFile: the prompt is answered, and the image stored at
    // once, the default map's too (DEF-98).
    resolveBackgroundPrompt(app);
    primeRecoveryImages(app);
    // As loadBackgroundFile: chosen while hidden, it is shown (UI-08)
    setBackgroundHidden(app, false, { autoSave: false });
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
