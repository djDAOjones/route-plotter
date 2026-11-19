/**
 * Persisted entity identifiers are structural references, not display text.
 * Keep them compact so a valid high-cardinality project cannot multiply one
 * pathological ID across maps, semantic keys, DOM attributes, and exports.
 */
export const ENTITY_ID_LIMITS = Object.freeze({
  MAX_LENGTH: 256,
});

/**
 * Validate an optional persisted entity identifier without normalising it.
 * Legacy IDs may contain punctuation or lone UTF-16 surrogates, so only the
 * structural requirements needed for safe lookup and bounded fan-out apply.
 *
 * @param {*} value
 * @param {string} label
 * @returns {string|undefined|null}
 */
export function assertPersistedEntityId(value, label) {
  if (value == null) return value;
  if (typeof value !== 'string' || value.length === 0 ||
      value.length > ENTITY_ID_LIMITS.MAX_LENGTH) {
    throw new Error(
      `Invalid ${label}: expected a non-empty string of at most ${ENTITY_ID_LIMITS.MAX_LENGTH} characters`
    );
  }
  return value;
}

/**
 * Fit an id built from other ids into the persisted limit (DEF-31).
 *
 * An id that already fits is returned unchanged, so no id in a saved project
 * ever moves. A longer one keeps its readable start and ends in a hash of the
 * whole, so it stays deterministic, and two ids that differ only past the
 * cut stay distinct.
 *
 * @param {string} id
 * @returns {string}
 */
export function boundedEntityId(id) {
  if (id.length <= ENTITY_ID_LIMITS.MAX_LENGTH) return id;
  const suffix = `_${hash53(id).toString(36)}`;
  return id.slice(0, ENTITY_ID_LIMITS.MAX_LENGTH - suffix.length) + suffix;
}

/**
 * cyrb53, a small well-mixed 53-bit string hash. It is not cryptographic: it
 * only has to keep derived ids apart, deterministically, on every platform.
 */
function hash53(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
