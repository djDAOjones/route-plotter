const SAFE_HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Persisted projects may provide colours to several canvas and DOM sinks.
 * Keep the storage grammar deliberately smaller than CSS: Route Plotter's
 * authoring controls emit hexadecimal colours, and accepting CSS functions or
 * names would add fetch-capable and browser-dependent syntax for no product
 * benefit.
 * @param {unknown} value
 * @param {{allowTransparent?: boolean}} [options]
 * @returns {value is string}
 */
export function isSafeStoredColor(value, { allowTransparent = false } = {}) {
  return typeof value === 'string' &&
    (SAFE_HEX_COLOR.test(value) || (allowTransparent && value === 'transparent'));
}

/**
 * Validate an optional persisted colour with a field-specific error.
 * @param {unknown} value
 * @param {string} label
 * @param {{allowTransparent?: boolean}} [options]
 */
export function assertSafeStoredColor(value, label, { allowTransparent = false } = {}) {
  if (value == null) return;
  if (!isSafeStoredColor(value, { allowTransparent })) {
    const expected = allowTransparent
      ? 'a hexadecimal colour or the transparent sentinel'
      : 'a hexadecimal colour';
    throw new Error(`Invalid ${label}: expected ${expected}`);
  }
}
