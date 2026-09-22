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
