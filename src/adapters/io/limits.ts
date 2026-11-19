// CORE-03: v3's limits on a project file, carried into v4 (the plan's §15, file safety). Each names where it stands in
// frozen v3, under v3/. The limits of the scene itself are the core's (src/core/config/limits.ts); these bound the file.

export const ARCHIVE_LIMITS = Object.freeze({
  /** A project file, compressed (v3/src/services/ImageAssetService.js:18–22, SIZE_LIMITS.ZIP_MAX). */
  zipBytes: 50 * 1024 * 1024,
  /** Entries in the ZIP (v3/src/services/ImageAssetService.js:24–32, MAX_ENTRIES). */
  entries: 256,
  /** project.json, as bytes (MAX_PROJECT_JSON_BYTES, ibid.). */
  projectJsonBytes: 2 * 1024 * 1024,
  /** Everything in the ZIP once inflated (MAX_DECOMPRESSED_BYTES, ibid.). */
  inflatedBytes: 64 * 1024 * 1024,
});

export const IMAGE_LIMITS = Object.freeze({
  /** Images in a project (v3/src/services/ImageAssetService.js:24–32, MAX_ASSETS). */
  count: 128,
  /** One image's bytes (v3/src/models/ImageAsset.js:5–12, MAX_BYTES). */
  bytes: 16 * 1024 * 1024,
  /** All images' bytes together (MAX_ASSET_BYTES_TOTAL, v3/src/services/ImageAssetService.js:24–32). */
  totalBytes: 40 * 1024 * 1024,
  /** An image's width or height (v3/src/models/ImageAsset.js:5–12, MAX_DIMENSION). */
  dimension: 8192,
  /** One image's pixels (MAX_PIXELS, ibid.). */
  pixels: 24 * 1000 * 1000,
  /** All images' pixels together (MAX_IMAGE_PIXELS_TOTAL, v3/src/services/ImageAssetService.js:24–32). */
  totalPixels: 48 * 1000 * 1000,
});

/** project.json once parsed, before any field is checked (v3/src/app/persistence.js:63–78, PROJECT_MODEL_LIMITS). */
export const TREE_LIMITS = Object.freeze({
  /** Objects, lists and values, all counted (MAX_TREE_NODES). */
  values: 100_000,
  /** Nesting, the whole file at depth 0 (MAX_TREE_DEPTH). */
  depth: 64,
  /** One text, in UTF-16 units (MAX_STRING_LENGTH). */
  textLength: 100_000,
  /** All texts and keys together, as UTF-8 bytes (MAX_STRING_BYTES_TOTAL). */
  textBytes: 2 * 1024 * 1024,
});
