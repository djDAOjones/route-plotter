/**
 * Resolve and apply the project's visual sizing reference.
 *
 * Geometry and timeline calculations deliberately do not use this value.
 * Persisted reference-pixel sizes are converted to render pixels from the
 * short-edge ratio so landscape, portrait and custom exports share one model.
 */

/**
 * Return the first finite, positive width/height candidate, or null.
 * A fresh object prevents callers from mutating persisted input by accident.
 * @param  {...Object} candidates
 * @returns {{width:number,height:number}|null}
 */
export function resolveRenderReference(...candidates) {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const width = Number(candidate.width);
    const height = Number(candidate.height);
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return { width, height };
    }
  }
  return null;
}

/**
 * Convert reference-pixel values to the current render space.
 * @param {Object|null} reference
 * @param {number} width - Current logical render width
 * @param {number} height - Current logical render height
 * @returns {number}
 */
export function renderReferenceScale(reference, width, height) {
  const validReference = resolveRenderReference(reference);
  const current = resolveRenderReference({ width, height });
  if (!validReference || !current) return 1;
  return Math.min(current.width, current.height) /
    Math.min(validReference.width, validReference.height);
}
