/**
 * Service for managing image assets (custom path heads, waypoint markers, background)
 * Handles storage, deduplication, caching, and ZIP export/import
 * 
 * Features:
 * - Hash-based deduplication (same image = same ID)
 * - Lazy loading of HTMLImageElement instances
 * - Size limits for autosave (3MB binary images) vs ZIP export (50MB)
 * - ZIP export includes all assets + project JSON
 */

import { ImageAsset, IMAGE_LIMITS } from '../models/ImageAsset.js';
import JSZip from 'jszip';

// Size limits in bytes
export const SIZE_LIMITS = Object.freeze({
  AUTOSAVE_MAX: 3 * 1024 * 1024,      // Leaves room for base64 + project JSON in common 5MB localStorage quotas
  ZIP_MAX: 50 * 1024 * 1024,          // 50MB for ZIP export
  SINGLE_IMAGE_WARN: 2 * 1024 * 1024  // 2MB warning threshold per image
});

export const PROJECT_ARCHIVE_LIMITS = Object.freeze({
  MAX_ENTRIES: 256,
  MAX_PROJECT_JSON_BYTES: 2 * 1024 * 1024,
  MAX_DECOMPRESSED_BYTES: 64 * 1024 * 1024,
  MAX_ASSETS: 128,
  MAX_ASSET_BYTES_TOTAL: 40 * 1024 * 1024,
  MAX_IMAGE_PIXELS_TOTAL: 48 * 1000 * 1000,
  MAX_BACKGROUND_BYTES: IMAGE_LIMITS.MAX_BYTES,
});

function getInputByteLength(input) {
  const length = input?.size ?? input?.byteLength;
  return Number.isFinite(Number(length)) ? Number(length) : null;
}

const ZIP_SIGNATURES = Object.freeze({
  CENTRAL_DIRECTORY: 0x02014b50,
  END_OF_CENTRAL_DIRECTORY: 0x06054b50,
  ZIP64_END_OF_CENTRAL_DIRECTORY: 0x06064b50,
  ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR: 0x07064b50,
});

const ZIP_EOCD_MIN_BYTES = 22;

function malformedZip(detail) {
  return new Error(`Project ZIP is malformed or truncated: ${detail}`);
}

function zipEntryLimitError() {
  return new Error(`Project ZIP entry limit is ${PROJECT_ARCHIVE_LIMITS.MAX_ENTRIES}`);
}

async function readZipInputBytes(input) {
  if (input instanceof Uint8Array) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (typeof input?.arrayBuffer === 'function') {
    const buffer = await input.arrayBuffer();
    if (!(buffer instanceof ArrayBuffer)) throw malformedZip('input bytes are unavailable');
    return new Uint8Array(buffer);
  }
  throw malformedZip('input bytes are unavailable');
}

function readUint64LE(view, offset) {
  const low = BigInt(view.getUint32(offset, true));
  const high = BigInt(view.getUint32(offset + 4, true));
  return (high << 32n) | low;
}

function toSafeZipOffset(value, label) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw malformedZip(`${label} is too large`);
  return Number(value);
}

function findEndOfCentralDirectory(bytes, view) {
  if (bytes.length < ZIP_EOCD_MIN_BYTES) throw malformedZip('end record is missing');
  // JSZip selects the last raw EOCD signature, even if it occurs in a ZIP
  // comment. Validate that exact record so preflight cannot approve an earlier
  // EOCD while JSZip parses a later, attacker-controlled directory.
  let foundOffset = -1;
  for (let offset = bytes.length - 4; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_SIGNATURES.END_OF_CENTRAL_DIRECTORY) {
      foundOffset = offset;
      break;
    }
  }
  if (foundOffset === -1) throw malformedZip('end record is missing');
  if (foundOffset + ZIP_EOCD_MIN_BYTES > bytes.length) {
    throw malformedZip('end record is truncated');
  }
  const commentLength = view.getUint16(foundOffset + 20, true);
  if (foundOffset + ZIP_EOCD_MIN_BYTES + commentLength !== bytes.length) {
    throw malformedZip('end record has an invalid comment length');
  }
  return foundOffset;
}

function readZip64DirectoryMetadata(bytes, view, eocdOffset, classic) {
  const locatorOffset = eocdOffset - 20;
  if (locatorOffset < 0 ||
      view.getUint32(locatorOffset, true) !== ZIP_SIGNATURES.ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR) {
    throw malformedZip('ZIP64 locator is missing');
  }

  const locatorDisk = view.getUint32(locatorOffset + 4, true);
  const recordOffsetValue = readUint64LE(view, locatorOffset + 8);
  const diskCount = view.getUint32(locatorOffset + 16, true);
  if (locatorDisk !== 0 || diskCount !== 1) throw malformedZip('multi-disk ZIP64 archives are unsupported');

  const recordOffset = toSafeZipOffset(recordOffsetValue, 'ZIP64 end-record offset');
  if (recordOffset < 0 || recordOffset + 56 > locatorOffset ||
      view.getUint32(recordOffset, true) !== ZIP_SIGNATURES.ZIP64_END_OF_CENTRAL_DIRECTORY) {
    throw malformedZip('ZIP64 end record is missing');
  }
  const recordSizeValue = readUint64LE(view, recordOffset + 4);
  const recordSize = toSafeZipOffset(recordSizeValue, 'ZIP64 end-record size');
  if (recordSize < 44 || recordOffset + 12 + recordSize !== locatorOffset) {
    throw malformedZip('ZIP64 end record has an invalid size');
  }

  const diskNumber = view.getUint32(recordOffset + 16, true);
  const directoryDisk = view.getUint32(recordOffset + 20, true);
  const entriesOnDisk = readUint64LE(view, recordOffset + 24);
  const totalEntries = readUint64LE(view, recordOffset + 32);
  const directorySizeValue = readUint64LE(view, recordOffset + 40);
  const directoryOffsetValue = readUint64LE(view, recordOffset + 48);
  if (diskNumber !== 0 || directoryDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw malformedZip('multi-disk ZIP64 archives are unsupported');
  }
  if (totalEntries > BigInt(PROJECT_ARCHIVE_LIMITS.MAX_ENTRIES)) throw zipEntryLimitError();

  if (classic.entriesOnDisk !== 0xffff && BigInt(classic.entriesOnDisk) !== entriesOnDisk) {
    throw malformedZip('ZIP64 entry counts disagree');
  }
  if (classic.totalEntries !== 0xffff && BigInt(classic.totalEntries) !== totalEntries) {
    throw malformedZip('ZIP64 entry counts disagree');
  }
  if (classic.directorySize !== 0xffffffff && BigInt(classic.directorySize) !== directorySizeValue) {
    throw malformedZip('ZIP64 directory sizes disagree');
  }
  if (classic.directoryOffset !== 0xffffffff && BigInt(classic.directoryOffset) !== directoryOffsetValue) {
    throw malformedZip('ZIP64 directory offsets disagree');
  }

  return {
    declaredEntries: totalEntries,
    directorySize: toSafeZipOffset(directorySizeValue, 'ZIP64 central-directory size'),
    directoryOffset: toSafeZipOffset(directoryOffsetValue, 'ZIP64 central-directory offset'),
    directoryBoundary: recordOffset,
  };
}

function validateCentralDirectory(bytes, view, metadata) {
  const { directoryOffset, directorySize, directoryBoundary, declaredEntries } = metadata;
  if (directoryOffset < 0 || directorySize < 0 ||
      directoryOffset + directorySize > directoryBoundary || directoryBoundary > bytes.length) {
    throw malformedZip('central-directory bounds are invalid');
  }

  // JSZip permits a prepended executable/prefix and rebases stored offsets by
  // the bytes between the declared directory end and the EOCD boundary.
  const prefixLength = directoryBoundary - directoryOffset - directorySize;
  const directoryStart = directoryOffset + prefixLength;
  const directoryEnd = directoryStart + directorySize;
  let cursor = directoryStart;
  let entryCount = 0;
  while (cursor < directoryEnd) {
    if (directoryEnd - cursor < 46 ||
        view.getUint32(cursor, true) !== ZIP_SIGNATURES.CENTRAL_DIRECTORY) {
      throw malformedZip('central-directory record is invalid');
    }
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const recordLength = 46 + nameLength + extraLength + commentLength;
    if (recordLength > directoryEnd - cursor) {
      throw malformedZip('central-directory record is truncated');
    }
    entryCount += 1;
    if (entryCount > PROJECT_ARCHIVE_LIMITS.MAX_ENTRIES) throw zipEntryLimitError();
    cursor += recordLength;
  }
  if (cursor !== directoryEnd || BigInt(entryCount) !== declaredEntries) {
    throw malformedZip('central-directory entry count is inconsistent');
  }
}

/**
 * Preflight central-directory metadata before JSZip allocates one ZipEntry per
 * record. Counting raw central records (rather than names) closes the duplicate
 * filename case that later collapses into JSZip's name-keyed files map.
 */
function preflightProjectZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(bytes, view);
  const classic = {
    diskNumber: view.getUint16(eocdOffset + 4, true),
    directoryDisk: view.getUint16(eocdOffset + 6, true),
    entriesOnDisk: view.getUint16(eocdOffset + 8, true),
    totalEntries: view.getUint16(eocdOffset + 10, true),
    directorySize: view.getUint32(eocdOffset + 12, true),
    directoryOffset: view.getUint32(eocdOffset + 16, true),
  };
  const isZip64 = classic.diskNumber === 0xffff || classic.directoryDisk === 0xffff ||
    classic.entriesOnDisk === 0xffff || classic.totalEntries === 0xffff ||
    classic.directorySize === 0xffffffff || classic.directoryOffset === 0xffffffff;

  let metadata;
  if (isZip64) {
    metadata = readZip64DirectoryMetadata(bytes, view, eocdOffset, classic);
  } else {
    if (classic.diskNumber !== 0 || classic.directoryDisk !== 0 ||
        classic.entriesOnDisk !== classic.totalEntries) {
      throw malformedZip('multi-disk archives are unsupported');
    }
    if (classic.totalEntries > PROJECT_ARCHIVE_LIMITS.MAX_ENTRIES) throw zipEntryLimitError();
    metadata = {
      declaredEntries: BigInt(classic.totalEntries),
      directorySize: classic.directorySize,
      directoryOffset: classic.directoryOffset,
      directoryBoundary: eocdOffset,
    };
  }
  validateCentralDirectory(bytes, view, metadata);
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/**
 * Read a JSZip entry incrementally so an inflated entry cannot be retained
 * past its individual or aggregate budget.
 */
function readEntryBytes(entry, maxBytes, budget) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let entryBytes = 0;
    let settled = false;
    const stream = entry.internalStream('uint8array');

    const fail = error => {
      if (settled) return;
      settled = true;
      stream.pause();
      reject(error);
    };

    stream.on('data', chunk => {
      if (settled) return;
      entryBytes += chunk.length;
      if (entryBytes > maxBytes || budget.used + chunk.length > budget.max) {
        fail(new Error(`Project entry exceeds its decompressed size limit: ${entry.name}`));
        return;
      }
      budget.used += chunk.length;
      chunks.push(chunk);
    });
    stream.on('error', fail);
    stream.on('end', () => {
      if (settled) return;
      settled = true;
      const bytes = new Uint8Array(entryBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(bytes);
    });
    stream.resume();
  });
}

/**
 * ImageAssetService - Centralized image asset management
 */
export class ImageAssetService {
  constructor() {
    // Map of asset ID -> ImageAsset
    this._assets = new Map();
    
    // Track total size for limit checking
    this._totalSize = 0;
  }
  
  /**
   * Add an image asset from a File (deduplicates by hash)
   * @param {File} file - Image file to add
   * @returns {Promise<{asset: ImageAsset, isNew: boolean, warning: string|null}>}
   */
  async addFromFile(file) {
    const asset = await ImageAsset.fromFile(file);
    return this.addAsset(asset);
  }
  
  /**
   * Add an image asset from base64 data URL
   * @param {string} base64 - Base64 data URL
   * @param {string} name - Original filename
   * @returns {Promise<{asset: ImageAsset, isNew: boolean, warning: string|null}>}
   */
  async addFromBase64(base64, name = 'image') {
    const metadata = ImageAsset.inspectDataURL(base64);
    if (!IMAGE_LIMITS.ALLOWED_MIME_TYPES.includes(metadata.mimeType) || metadata.byteLength > IMAGE_LIMITS.MAX_BYTES) {
      throw new Error('Choose a PNG, JPEG, or WebP image within the 16 MB image limit');
    }
    
    // Generate hash for deduplication
    const id = await ImageAsset.generateHash(base64);
    
    // Check if already exists
    if (this._assets.has(id)) {
      return { 
        asset: this._assets.get(id), 
        isNew: false, 
        warning: null 
      };
    }
    
    // Decode before retaining bytes so invalid or dimension-heavy images do
    // not enter the asset collection.
    const img = await ImageAsset.decodeDataURL(base64, name);
    const asset = new ImageAsset({
      id,
      base64,
      name,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      mimeType: metadata.mimeType,
      size: metadata.byteLength
    });
    asset._imageElement = img;
    return this.addAsset(asset);
  }
  
  /**
   * Add an ImageAsset (deduplicates by ID/hash)
   * @param {ImageAsset} asset
   * @returns {{asset: ImageAsset, isNew: boolean, warning: string|null}}
   */
  addAsset(asset) {
    if (!(asset instanceof ImageAsset)) {
      throw new Error('Expected an ImageAsset');
    }
    const metadata = ImageAsset.assertValidSerialized(asset);
    let warning = null;
    
    // Check for size warning
    if (asset.size > SIZE_LIMITS.SINGLE_IMAGE_WARN) {
      warning = `Image "${asset.name}" is ${asset.getFormattedSize()}. Large images may slow down the app.`;
    }
    
    // Check if already exists (deduplication)
    if (this._assets.has(asset.id)) {
      return { 
        asset: this._assets.get(asset.id), 
        isNew: false, 
        warning 
      };
    }

    if (this._assets.size >= PROJECT_ARCHIVE_LIMITS.MAX_ASSETS) {
      throw new Error(`Project image-asset limit is ${PROJECT_ARCHIVE_LIMITS.MAX_ASSETS}`);
    }
    if (this._totalSize + metadata.byteLength > PROJECT_ARCHIVE_LIMITS.MAX_ASSET_BYTES_TOTAL) {
      throw new Error('Project image assets exceed the 40 MB total limit');
    }
    const currentPixels = Array.from(this._assets.values())
      .reduce((total, current) => total + current.width * current.height, 0);
    if (currentPixels + asset.width * asset.height > PROJECT_ARCHIVE_LIMITS.MAX_IMAGE_PIXELS_TOTAL) {
      throw new Error('Project image assets exceed the decoded pixel budget');
    }
    
    // Add new asset
    asset.size = metadata.byteLength;
    this._assets.set(asset.id, asset);
    this._totalSize += asset.size;
    
    return { asset, isNew: true, warning };
  }
  
  /**
   * Get an asset by ID
   * @param {string} id
   * @returns {ImageAsset|null}
   */
  getAsset(id) {
    return this._assets.get(id) || null;
  }
  
  /**
   * Get HTMLImageElement for an asset (cached)
   * @param {string} id
   * @returns {Promise<HTMLImageElement|null>}
   */
  async getImageElement(id) {
    const asset = this._assets.get(id);
    if (!asset) return null;
    return asset.getImageElement();
  }
  
  /**
   * Remove an asset by ID
   * @param {string} id
   * @returns {boolean} True if removed
   */
  removeAsset(id) {
    const asset = this._assets.get(id);
    if (asset) {
      this._totalSize -= asset.size;
      this._assets.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Remove only assets absent from the caller's complete live/history root
   * set. Validation happens before mutation so a malformed collector result
   * cannot turn into a partial destructive sweep.
   * @param {Iterable<string>} referencedIds
   * @returns {string[]} Removed IDs in stable asset insertion order
   */
  pruneUnreferenced(referencedIds) {
    if (!referencedIds || typeof referencedIds === 'string' ||
        typeof referencedIds[Symbol.iterator] !== 'function') {
      throw new Error('Image asset references must be an iterable of IDs');
    }
    const retained = new Set(referencedIds);
    if ([...retained].some(id => typeof id !== 'string' || id.length === 0)) {
      throw new Error('Image asset references must contain non-empty string IDs');
    }

    const removed = [];
    for (const id of this.getAssetIds()) {
      if (retained.has(id)) continue;
      this.removeAsset(id);
      removed.push(id);
    }
    return removed;
  }
  
  /**
   * Clear all assets
   */
  clear() {
    this._assets.clear();
    this._totalSize = 0;
  }
  
  /**
   * Get total size of all assets
   * @returns {number} Size in bytes
   */
  getTotalSize() {
    return this._totalSize;
  }
  
  /**
   * Get formatted total size
   * @returns {string}
   */
  getFormattedTotalSize() {
    const size = this._totalSize;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  
  /**
   * Check if total size exceeds autosave limit
   * @returns {boolean}
   */
  exceedsAutosaveLimit() {
    return this._totalSize > SIZE_LIMITS.AUTOSAVE_MAX;
  }
  
  /**
   * Check if total size exceeds ZIP limit
   * @returns {boolean}
   */
  exceedsZipLimit() {
    return this._totalSize > SIZE_LIMITS.ZIP_MAX;
  }
  
  /**
   * Get all asset IDs
   * @returns {string[]}
   */
  getAssetIds() {
    return Array.from(this._assets.keys());
  }

  /**
   * Get asset object references as a snapshot array. Used only to roll back a
   * failed project commit without re-decoding the current project's images.
   * @returns {ImageAsset[]}
   */
  getAssets() {
    return Array.from(this._assets.values());
  }
  
  /**
   * Get count of assets
   * @returns {number}
   */
  getAssetCount() {
    return this._assets.size;
  }
  
  /**
   * Serialize all assets to JSON
   * @returns {Object[]}
   */
  toJSON() {
    return Array.from(this._assets.values()).map(asset => asset.toJSON());
  }
  
  /**
   * Load assets from JSON data
   * @param {Object[]} data - Array of serialized ImageAsset objects
   */
  fromJSON(data) {
    if (!Array.isArray(data)) return false;
    const assets = data.map(assetData => ImageAsset.fromJSON(assetData));
    this.replaceAssets(assets);
    return true;
  }

  /**
   * Validate and decode a serialised asset collection without changing this
   * service. The returned assets are ready for an atomic replaceAssets call.
   * @param {Object[]} data
   * @returns {Promise<ImageAsset[]>}
   */
  async stageFromJSON(data) {
    if (data == null) return [];
    if (!Array.isArray(data)) {
      throw new Error('Invalid image asset collection');
    }
    if (data.length > PROJECT_ARCHIVE_LIMITS.MAX_ASSETS) {
      throw new Error(`Project image-asset limit is ${PROJECT_ARCHIVE_LIMITS.MAX_ASSETS}`);
    }

    const staged = [];
    const ids = new Set();
    let totalBytes = 0;
    let totalPixels = 0;
    for (const assetData of data) {
      const metadata = ImageAsset.assertValidSerialized(assetData);
      if (ids.has(assetData.id)) {
        throw new Error(`Duplicate image asset id: ${assetData.id}`);
      }
      ids.add(assetData.id);
      totalBytes += metadata.byteLength;
      if (totalBytes > PROJECT_ARCHIVE_LIMITS.MAX_ASSET_BYTES_TOTAL) {
        throw new Error('Project image assets exceed the 40 MB total limit');
      }
      const asset = ImageAsset.fromJSON({ ...assetData, size: metadata.byteLength });
      const image = await asset.getImageElement();
      asset.width = image.naturalWidth || image.width;
      asset.height = image.naturalHeight || image.height;
      totalPixels += asset.width * asset.height;
      if (totalPixels > PROJECT_ARCHIVE_LIMITS.MAX_IMAGE_PIXELS_TOTAL) {
        throw new Error('Project image assets exceed the decoded pixel budget');
      }
      staged.push(asset);
    }
    return staged;
  }

  /**
   * Atomically replace all assets after validating the complete collection.
   * @param {ImageAsset[]} assets
   */
  replaceAssets(assets) {
    if (!Array.isArray(assets) || assets.length > PROJECT_ARCHIVE_LIMITS.MAX_ASSETS) {
      throw new Error('Invalid or oversized image asset collection');
    }

    const nextAssets = new Map();
    let totalBytes = 0;
    let totalPixels = 0;
    for (const asset of assets) {
      if (!(asset instanceof ImageAsset)) {
        throw new Error('Expected an ImageAsset');
      }
      const metadata = ImageAsset.assertValidSerialized(asset);
      if (nextAssets.has(asset.id)) {
        throw new Error(`Duplicate image asset id: ${asset.id}`);
      }
      totalBytes += metadata.byteLength;
      if (totalBytes > PROJECT_ARCHIVE_LIMITS.MAX_ASSET_BYTES_TOTAL) {
        throw new Error('Project image assets exceed the 40 MB total limit');
      }
      totalPixels += asset.width * asset.height;
      if (totalPixels > PROJECT_ARCHIVE_LIMITS.MAX_IMAGE_PIXELS_TOTAL) {
        throw new Error('Project image assets exceed the decoded pixel budget');
      }
      asset.size = metadata.byteLength;
      nextAssets.set(asset.id, asset);
    }

    this._assets = nextAssets;
    this._totalSize = totalBytes;
  }
  
  /**
   * Export project as ZIP file
   * Includes: project.json, background image, all custom assets
   * 
   * @param {Object} projectData - Project data to include
   * @param {string|null} backgroundBase64 - Background image as base64 (if available)
   * @param {string} projectName - Name for the ZIP file
   * @returns {Promise<Blob>} ZIP file blob
   */
  async exportZip(projectData, backgroundBase64 = null, projectName = 'route-project') {
    if (this.exceedsZipLimit() || this._assets.size > PROJECT_ARCHIVE_LIMITS.MAX_ASSETS) {
      throw new Error('Project images exceed the export limits');
    }
    const zip = new JSZip();
    const archivedProjectData = { ...projectData };
    
    // Create assets folder
    const assetsFolder = zip.folder('assets');
    
    // Add all image assets to assets folder
    const assetManifest = [];
    for (const [id, asset] of this._assets) {
      ImageAsset.assertValidSerialized(asset);
      // Extract binary data from base64
      const base64Data = asset.base64.split(',')[1];
      const extension = asset.mimeType === 'image/jpeg' ? 'jpg' : asset.mimeType.split('/')[1];
      const filename = `${id}.${extension}`;
      
      assetsFolder.file(filename, base64Data, { base64: true });
      assetManifest.push({
        id: asset.id,
        filename,
        name: asset.name,
        width: asset.width,
        height: asset.height,
        mimeType: asset.mimeType,
        size: asset.size
      });
    }
    
    // Add background image if present
    if (backgroundBase64) {
      const backgroundMetadata = ImageAsset.inspectDataURL(backgroundBase64);
      if (!IMAGE_LIMITS.ALLOWED_MIME_TYPES.includes(backgroundMetadata.mimeType) ||
          backgroundMetadata.byteLength > PROJECT_ARCHIVE_LIMITS.MAX_BACKGROUND_BYTES) {
        throw new Error('Background image exceeds the project export limits');
      }
      const bgExtension = backgroundMetadata.mimeType === 'image/jpeg'
        ? 'jpg'
        : backgroundMetadata.mimeType.split('/')[1];
      const bgBase64Data = backgroundBase64.split(',')[1];
      zip.file(`background.${bgExtension}`, bgBase64Data, { base64: true });
      archivedProjectData.backgroundFile = `background.${bgExtension}`;
    }
    
    // Add asset manifest
    archivedProjectData.assetManifest = assetManifest;
    
    // Add project JSON
    const projectJSON = JSON.stringify(archivedProjectData, null, 2);
    if (new TextEncoder().encode(projectJSON).length > PROJECT_ARCHIVE_LIMITS.MAX_PROJECT_JSON_BYTES) {
      throw new Error('Project metadata exceeds the 2 MB limit');
    }
    zip.file('project.json', projectJSON);
    
    // Generate ZIP
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    if (blob.size > SIZE_LIMITS.ZIP_MAX) {
      throw new Error('Project ZIP exceeds the 50 MB limit');
    }
    return blob;
  }
  
  /**
   * Import project from ZIP file
   * 
   * @param {File|Blob} zipFile - ZIP file to import
   * @returns {Promise<{projectData: Object, backgroundBase64: string|null, imageAssets: ImageAsset[]}>}
   */
  async importZip(zipFile) {
    const compressedSize = getInputByteLength(zipFile);
    if (compressedSize != null && (compressedSize <= 0 || compressedSize > SIZE_LIMITS.ZIP_MAX)) {
      throw new Error('Project ZIP must be no larger than 50 MB');
    }
    const zipBytes = await readZipInputBytes(zipFile);
    if (zipBytes.byteLength <= 0 || zipBytes.byteLength > SIZE_LIMITS.ZIP_MAX) {
      throw new Error('Project ZIP must be no larger than 50 MB');
    }
    preflightProjectZip(zipBytes);
    // CRC verification in JSZip eagerly inflates every entry. Stream entries
    // below instead so decompression remains inside the aggregate budget.
    const zip = await JSZip.loadAsync(zipBytes);
    const entries = Object.values(zip.files);
    if (entries.length > PROJECT_ARCHIVE_LIMITS.MAX_ENTRIES) {
      throw new Error(`Project ZIP entry limit is ${PROJECT_ARCHIVE_LIMITS.MAX_ENTRIES}`);
    }
    for (const entry of entries) {
      const originalName = entry.unsafeOriginalName || entry.name;
      if (originalName.includes('\\') || originalName.split('/').includes('..')) {
        throw new Error('Project ZIP contains an unsafe entry path');
      }
      const declaredSize = entry._data?.uncompressedSize;
      if (declaredSize != null && (!Number.isFinite(declaredSize) || declaredSize < 0 ||
          declaredSize > PROJECT_ARCHIVE_LIMITS.MAX_DECOMPRESSED_BYTES)) {
        throw new Error(`Project ZIP entry is too large: ${entry.name}`);
      }
    }

    const budget = {
      used: 0,
      max: PROJECT_ARCHIVE_LIMITS.MAX_DECOMPRESSED_BYTES,
    };
    
    // Read project.json
    const projectJsonFile = zip.file('project.json');
    if (!projectJsonFile) {
      throw new Error('Invalid project file: missing project.json');
    }
    const projectBytes = await readEntryBytes(
      projectJsonFile,
      PROJECT_ARCHIVE_LIMITS.MAX_PROJECT_JSON_BYTES,
      budget
    );
    let projectData;
    try {
      projectData = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(projectBytes));
    } catch (error) {
      throw new Error(`Invalid project.json: ${error.message}`);
    }
    if (!projectData || typeof projectData !== 'object' || Array.isArray(projectData)) {
      throw new Error('Invalid project.json: expected an object');
    }
    
    // Load assets from manifest
    const manifest = projectData.assetManifest ?? [];
    if (!Array.isArray(manifest) || manifest.length > PROJECT_ARCHIVE_LIMITS.MAX_ASSETS) {
      throw new Error(`Project image-asset limit is ${PROJECT_ARCHIVE_LIMITS.MAX_ASSETS}`);
    }
    const expectedEntries = new Set(['project.json']);
    const imageAssets = [];
    const assetIds = new Set();
    let assetBytesTotal = 0;
    let assetPixelsTotal = 0;
    for (const assetInfo of manifest) {
      if (!assetInfo || typeof assetInfo !== 'object' || Array.isArray(assetInfo) ||
          typeof assetInfo.filename !== 'string' || !/^[A-Za-z0-9._-]+$/.test(assetInfo.filename)) {
        throw new Error('Invalid image asset manifest entry');
      }
      if (assetIds.has(assetInfo.id)) {
        throw new Error(`Duplicate image asset id: ${assetInfo.id}`);
      }
      assetIds.add(assetInfo.id);
      const entryName = `assets/${assetInfo.filename}`;
      const assetFile = zip.file(entryName);
      if (!assetFile) {
        throw new Error(`Project ZIP is missing image asset: ${assetInfo.filename}`);
      }
      expectedEntries.add(entryName);
      const bytes = await readEntryBytes(assetFile, IMAGE_LIMITS.MAX_BYTES, budget);
      assetBytesTotal += bytes.length;
      if (assetBytesTotal > PROJECT_ARCHIVE_LIMITS.MAX_ASSET_BYTES_TOTAL) {
        throw new Error('Project image assets exceed the 40 MB total limit');
      }
      const mimeType = typeof assetInfo.mimeType === 'string' ? assetInfo.mimeType.toLowerCase() : '';
      if (!IMAGE_LIMITS.ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new Error(`Unsupported image type: ${mimeType || 'unknown'}`);
      }
      const base64 = `data:${mimeType};base64,${bytesToBase64(bytes)}`;
      const asset = new ImageAsset({
        ...assetInfo,
        base64,
        mimeType,
        size: bytes.length
      });
      ImageAsset.assertValidSerialized(asset);
      const image = await asset.getImageElement();
      asset.width = image.naturalWidth || image.width;
      asset.height = image.naturalHeight || image.height;
      assetPixelsTotal += asset.width * asset.height;
      if (assetPixelsTotal > PROJECT_ARCHIVE_LIMITS.MAX_IMAGE_PIXELS_TOTAL) {
        throw new Error('Project image assets exceed the decoded pixel budget');
      }
      imageAssets.push(asset);
    }
    
    // Load background image if present
    let backgroundBase64 = null;
    if (projectData.backgroundFile) {
      if (typeof projectData.backgroundFile !== 'string' ||
          !/^background\.(png|jpe?g|webp)$/i.test(projectData.backgroundFile)) {
        throw new Error('Invalid project background filename');
      }
      const bgFile = zip.file(projectData.backgroundFile);
      if (!bgFile) {
        throw new Error('Project ZIP is missing its background image');
      }
      expectedEntries.add(projectData.backgroundFile);
      const backgroundBytes = await readEntryBytes(
        bgFile,
        PROJECT_ARCHIVE_LIMITS.MAX_BACKGROUND_BYTES,
        budget
      );
      const extension = projectData.backgroundFile.split('.').pop().toLowerCase();
      const mimeType = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`;
      backgroundBase64 = `data:${mimeType};base64,${bytesToBase64(backgroundBytes)}`;
      ImageAsset.inspectDataURL(backgroundBase64);
    }

    for (const entry of entries) {
      if (!entry.dir && !expectedEntries.has(entry.name)) {
        throw new Error(`Unexpected project ZIP entry: ${entry.name}`);
      }
    }
    
    // Clean up manifest from project data (not needed after import)
    delete projectData.assetManifest;
    delete projectData.backgroundFile;
    
    return { projectData, backgroundBase64, imageAssets };
  }
  
  /**
   * Download ZIP file to user's computer
   * @param {Blob} zipBlob - ZIP blob from exportZip
   * @param {string} filename - Filename for download
   */
  downloadZip(zipBlob, filename = 'route-project.zip') {
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default ImageAssetService;
