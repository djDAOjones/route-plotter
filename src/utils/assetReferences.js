/**
 * Collect custom-image IDs from serialisable model/history roots.
 *
 * Asset collections themselves are deliberately skipped: possessing bytes is
 * not evidence that the current model or retained undo history still needs
 * them. New reference fields must use one of the explicit keys below.
 */
const ASSET_REFERENCE_KEYS = new Set([
  'customImageAssetId',
  'imageAssetId',
]);

const ASSET_COLLECTION_KEYS = new Set([
  'assetManifest',
  'imageAssets',
]);

/**
 * @param {Array<Object|string>|Object|string} roots
 * @returns {Set<string>}
 */
export function collectImageAssetReferences(roots) {
  const references = new Set();
  const visited = new WeakSet();

  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if (ASSET_REFERENCE_KEYS.has(key)) {
        if (typeof child === 'string' && child.length > 0) references.add(child);
        continue;
      }
      if (!ASSET_COLLECTION_KEYS.has(key)) visit(child);
    }
  };

  const rootList = Array.isArray(roots) ? roots : [roots];
  for (const root of rootList) {
    // UndoService exposes immutable JSON strings; strings nested inside a
    // model are ordinary labels/names and are never parsed as hidden roots.
    visit(typeof root === 'string' ? JSON.parse(root) : root);
  }
  return references;
}

function assetMetrics(asset, label) {
  if (!asset || typeof asset !== 'object' || typeof asset.id !== 'string' || asset.id.length === 0) {
    throw new Error(`${label} must have a non-empty string ID`);
  }
  const bytes = Number(asset.size);
  const width = Number(asset.width);
  const height = Number(asset.height);
  if (!Number.isFinite(bytes) || bytes < 0 || !Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(height) || height <= 0) {
    throw new Error(`${label} must have finite byte and pixel metrics`);
  }
  return { bytes, pixels: width * height };
}

function admissionError(metrics, limits) {
  if (metrics.count > limits.MAX_ASSETS) {
    return `Project image-asset limit is ${limits.MAX_ASSETS}`;
  }
  if (metrics.bytes > limits.MAX_ASSET_BYTES_TOTAL) {
    return 'Project image assets exceed the 40 MB total limit';
  }
  if (metrics.pixels > limits.MAX_IMAGE_PIXELS_TOTAL) {
    return 'Project image assets exceed the decoded pixel budget';
  }
  return null;
}

/**
 * Plan an interactive image admission against the exact history a successful
 * new state would retain. Oldest snapshots are considered only as a strict
 * prefix, making the first successful plan the unique minimum history loss.
 * Generic imports never call this planner; they remain detached transactions.
 *
 * @param {Object} options
 * @param {Object[]} options.assets - Validated live ImageAsset objects/descriptors.
 * @param {Object} options.candidate - Validated decoded candidate asset.
 * @param {string[]} options.prospectiveUndoStates - Oldest-to-newest serialized states after normal save rollover.
 * @param {Object} options.limits - Project asset count/byte/pixel ceilings.
 * @returns {{fits: boolean, additionalDiscardCount: number, nextAssets: Object[], removedIds: string[], metrics: Object, error: string|null}}
 */
export function planImageAssetAdmission({ assets, candidate, prospectiveUndoStates, limits }) {
  if (!Array.isArray(assets) || !Array.isArray(prospectiveUndoStates) || prospectiveUndoStates.length === 0) {
    throw new Error('Image admission requires assets and prospective undo states');
  }
  if (!limits || !Number.isFinite(limits.MAX_ASSETS) ||
      !Number.isFinite(limits.MAX_ASSET_BYTES_TOTAL) ||
      !Number.isFinite(limits.MAX_IMAGE_PIXELS_TOTAL)) {
    throw new Error('Image admission requires finite project limits');
  }

  const candidateMetric = assetMetrics(candidate, 'Candidate image asset');
  const assetsById = new Map();
  const metricsById = new Map();
  for (const asset of assets) {
    const metrics = assetMetrics(asset, 'Image asset');
    if (assetsById.has(asset.id)) throw new Error(`Duplicate image asset id: ${asset.id}`);
    assetsById.set(asset.id, asset);
    metricsById.set(asset.id, metrics);
  }

  const referencesByState = prospectiveUndoStates.map(state => collectImageAssetReferences([state]));
  if (!referencesByState.at(-1).has(candidate.id)) {
    throw new Error('Prospective image state does not reference the candidate asset');
  }
  const allReferences = new Set(referencesByState.flatMap(references => [...references]));
  for (const id of allReferences) {
    if (id !== candidate.id && !assetsById.has(id)) {
      throw new Error(`Retained undo history references missing image asset: ${id}`);
    }
  }

  const retainedCandidate = assetsById.get(candidate.id) || candidate;
  const retainedCandidateMetric = assetsById.has(candidate.id)
    ? metricsById.get(candidate.id)
    : candidateMetric;
  let lastError = null;
  let lastMetrics = { count: 0, bytes: 0, pixels: 0 };

  // Keep at least the prospective current state (the newest root).
  for (let discardCount = 0; discardCount < prospectiveUndoStates.length; discardCount++) {
    const references = new Set();
    for (const stateReferences of referencesByState.slice(discardCount)) {
      for (const id of stateReferences) references.add(id);
    }
    references.add(candidate.id);

    const nextAssets = [];
    let bytes = 0;
    let pixels = 0;
    for (const asset of assets) {
      if (!references.has(asset.id) || asset.id === candidate.id) continue;
      const metrics = metricsById.get(asset.id);
      nextAssets.push(asset);
      bytes += metrics.bytes;
      pixels += metrics.pixels;
    }
    nextAssets.push(retainedCandidate);
    bytes += retainedCandidateMetric.bytes;
    pixels += retainedCandidateMetric.pixels;

    const metrics = { count: nextAssets.length, bytes, pixels };
    const error = admissionError(metrics, limits);
    if (!error) {
      const retainedIds = new Set(nextAssets.map(asset => asset.id));
      return {
        fits: true,
        additionalDiscardCount: discardCount,
        nextAssets,
        removedIds: assets.filter(asset => !retainedIds.has(asset.id)).map(asset => asset.id),
        metrics,
        error: null,
      };
    }
    lastError = error;
    lastMetrics = metrics;
  }

  return {
    fits: false,
    additionalDiscardCount: 0,
    nextAssets: [...assets],
    removedIds: [],
    metrics: lastMetrics,
    error: lastError || 'Project image assets exceed the project limits',
  };
}
