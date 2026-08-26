import droneHeadDataURL from '../assets/drone-head.png';

const PRESET_DATA_URLS = Object.freeze({
  drone: droneHeadDataURL,
});

const presetImagePromises = new Map();

/**
 * Built-in image heads are bundled into both runtimes rather than stored as
 * project assets, so saved projects remain small and standalone exports do not
 * acquire an external file dependency.
 */
export function isBuiltInPathHeadStyle(style) {
  return Object.prototype.hasOwnProperty.call(PRESET_DATA_URLS, style);
}

export function pathHeadStyleUsesImageControls(style) {
  return style === 'custom' || isBuiltInPathHeadStyle(style);
}

/**
 * Decode a built-in image once and share it across editor renders or player
 * instances. A rejected decode is evicted so a later retry remains possible.
 * @param {string} style
 * @returns {Promise<HTMLImageElement|null>}
 */
export function loadPathHeadPresetImage(style) {
  const dataURL = PRESET_DATA_URLS[style];
  if (!dataURL) return Promise.resolve(null);
  if (presetImagePromises.has(style)) return presetImagePromises.get(style);

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not decode the ${style} path-head preset`));
    image.src = dataURL;
  });
  presetImagePromises.set(style, promise);
  promise.catch(() => {
    if (presetImagePromises.get(style) === promise) presetImagePromises.delete(style);
  });
  return promise;
}

/**
 * Resolve the rendered image for either a bundled preset or the selected
 * custom asset while keeping their ownership and persistence paths separate.
 * @param {Object} pathHead
 * @param {(assetId: string) => Promise<HTMLImageElement|null>} [loadCustomImage]
 * @returns {Promise<HTMLImageElement|null>}
 */
export function resolvePathHeadImage(pathHead, loadCustomImage) {
  if (isBuiltInPathHeadStyle(pathHead?.style)) {
    return loadPathHeadPresetImage(pathHead.style);
  }
  if (pathHead?.style === 'custom' && pathHead.imageAssetId && loadCustomImage) {
    return Promise.resolve(loadCustomImage(pathHead.imageAssetId));
  }
  return Promise.resolve(null);
}
