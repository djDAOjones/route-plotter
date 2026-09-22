/**
 * Model representing an image asset (custom path head, waypoint marker, or background)
 * Stores image data with metadata for efficient deduplication and caching
 */
export const IMAGE_LIMITS = Object.freeze({
  MAX_BYTES: 16 * 1024 * 1024,
  MAX_DIMENSION: 8192,
  MAX_PIXELS: 24 * 1000 * 1000,
  MAX_NAME_LENGTH: 255,
  MAX_ID_LENGTH: 128,
  ALLOWED_MIME_TYPES: Object.freeze(['image/png', 'image/jpeg', 'image/webp']),
});

const SAFE_ASSET_ID = /^[A-Za-z0-9._-]+$/;

export class ImageAsset {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique identifier (hash-based for deduplication)
   * @param {string} options.base64 - Base64-encoded image data (data URL)
   * @param {string} options.name - Original filename
   * @param {number} options.width - Image width in pixels
   * @param {number} options.height - Image height in pixels
   * @param {string} options.mimeType - MIME type (image/png, image/jpeg, etc.)
   * @param {number} options.size - File size in bytes
   */
  constructor(options = {}) {
    this.id = typeof options.id === 'string' ? options.id : '';
    this.base64 = typeof options.base64 === 'string' ? options.base64 : '';
    this.name = typeof options.name === 'string' ? options.name : 'untitled';
    this.width = ImageAsset._finiteNonNegativeInteger(options.width);
    this.height = ImageAsset._finiteNonNegativeInteger(options.height);
    this.mimeType = typeof options.mimeType === 'string' ? options.mimeType : 'image/png';
    this.size = ImageAsset._finiteNonNegativeInteger(options.size);
    
    // Cached HTMLImageElement (not serialized)
    this._imageElement = null;
  }
  
  /**
   * Get or create cached HTMLImageElement
   * @returns {Promise<HTMLImageElement>}
   */
  async getImageElement() {
    if (this._imageElement) {
      return this._imageElement;
    }
    
    const img = await ImageAsset.decodeDataURL(this.base64, this.name);
    this._imageElement = img;
    return img;
  }
  
  /**
   * Clear cached image element (for memory management)
   */
  clearCache() {
    this._imageElement = null;
  }
  
  /**
   * Serialize to JSON (excludes cached image element)
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      base64: this.base64,
      name: this.name,
      width: this.width,
      height: this.height,
      mimeType: this.mimeType,
      size: this.size
    };
  }
  
  /**
   * Create ImageAsset from JSON data
   * @param {Object} data
   * @returns {ImageAsset}
   */
  static fromJSON(data) {
    return new ImageAsset(data);
  }

  /**
   * Validate an asset at a persistence boundary. Direct construction remains
   * tolerant for authoring and older unit callers; imports and autosaves call
   * this strict validator before retaining bytes.
   * @param {Object} data
   * @param {Object} [options]
   * @param {number} [options.maxBytes]
   * @returns {{mimeType: string, byteLength: number}}
   */
  static assertValidSerialized(data, { maxBytes = IMAGE_LIMITS.MAX_BYTES } = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid image asset: expected an object');
    }
    if (typeof data.id !== 'string' || data.id.length === 0 ||
        data.id.length > IMAGE_LIMITS.MAX_ID_LENGTH || !SAFE_ASSET_ID.test(data.id)) {
      throw new Error('Invalid image asset id');
    }
    if (typeof data.name !== 'string' || data.name.length > IMAGE_LIMITS.MAX_NAME_LENGTH) {
      throw new Error('Invalid image asset name');
    }

    const metadata = ImageAsset.inspectDataURL(data.base64);
    if (!IMAGE_LIMITS.ALLOWED_MIME_TYPES.includes(metadata.mimeType)) {
      throw new Error(`Unsupported image type: ${metadata.mimeType || 'unknown'}`);
    }
    if (!ImageAsset._hasExpectedSignature(data.base64, metadata.mimeType)) {
      throw new Error('Image bytes do not match the declared MIME type');
    }
    if (data.mimeType != null && data.mimeType !== metadata.mimeType) {
      throw new Error('Image MIME type does not match its data URL');
    }
    if (metadata.byteLength <= 0 || metadata.byteLength > maxBytes) {
      throw new Error(`Image exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB per-image limit`);
    }

    const width = Number(data.width);
    const height = Number(data.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('Invalid image dimensions');
    }
    if (width > IMAGE_LIMITS.MAX_DIMENSION || height > IMAGE_LIMITS.MAX_DIMENSION ||
        width * height > IMAGE_LIMITS.MAX_PIXELS) {
      throw new Error('Image dimensions exceed the supported pixel budget');
    }
    if (data.size != null && (!Number.isFinite(Number(data.size)) || Number(data.size) < 0)) {
      throw new Error('Invalid image byte size');
    }
    return metadata;
  }

  /**
   * Parse a base64 image data URL without decoding it into a bitmap.
   * @param {string} dataURL
   * @returns {{mimeType: string, byteLength: number}}
   */
  static inspectDataURL(dataURL) {
    if (typeof dataURL !== 'string') {
      throw new Error('Invalid image data URL');
    }
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataURL);
    if (!match) {
      throw new Error('Invalid image data URL');
    }
    const payload = match[2];
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    const byteLength = Math.max(0, Math.floor(payload.length * 3 / 4) - padding);
    return { mimeType: match[1].toLowerCase(), byteLength };
  }

  /**
   * Decode and dimension-check a raster image before it can enter live state.
   * @param {string} dataURL
   * @param {string} [name]
   * @returns {Promise<HTMLImageElement>}
   */
  static async decodeDataURL(dataURL, name = 'image') {
    const metadata = ImageAsset.inspectDataURL(dataURL);
    if (!IMAGE_LIMITS.ALLOWED_MIME_TYPES.includes(metadata.mimeType) || metadata.byteLength > IMAGE_LIMITS.MAX_BYTES) {
      throw new Error(`Unsupported or oversized image: ${name}`);
    }
    if (!ImageAsset._hasExpectedSignature(dataURL, metadata.mimeType)) {
      throw new Error(`Image bytes do not match the declared type: ${name}`);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const width = Number(img.naturalWidth || img.width);
        const height = Number(img.naturalHeight || img.height);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
            width > IMAGE_LIMITS.MAX_DIMENSION || height > IMAGE_LIMITS.MAX_DIMENSION ||
            width * height > IMAGE_LIMITS.MAX_PIXELS) {
          reject(new Error(`Image dimensions exceed the supported pixel budget: ${name}`));
          return;
        }
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${name}`));
      img.src = dataURL;
    });
  }
  
  /**
   * Create ImageAsset from a File object
   * @param {File} file - Image file
   * @returns {Promise<ImageAsset>}
   */
  static async fromFile(file) {
    if (!file || !Number.isFinite(Number(file.size)) || file.size <= 0 || file.size > IMAGE_LIMITS.MAX_BYTES) {
      throw new Error(`Image must be no larger than ${IMAGE_LIMITS.MAX_BYTES / (1024 * 1024)} MB`);
    }
    if (!IMAGE_LIMITS.ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error('Choose a PNG, JPEG, or WebP image');
    }
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });

    // Validate the actual signature as well as the browser-provided MIME hint,
    // then decode and dimension-check before any caller can retain the image.
    const img = await ImageAsset.decodeDataURL(base64, file.name);
    const metadata = ImageAsset.inspectDataURL(base64);
    const id = await ImageAsset.generateHash(base64);
    const asset = new ImageAsset({
      id,
      base64,
      name: file.name,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      mimeType: metadata.mimeType,
      size: metadata.byteLength
    });
    asset._imageElement = img;
    return asset;
  }
  
  /**
   * Generate a hash ID from base64 data for deduplication
   * Uses a simple hash algorithm (not cryptographic, just for identification)
   * @param {string} base64 - Base64 data URL
   * @returns {Promise<string>} Hash string
   */
  static async generateHash(base64) {
    // Use SubtleCrypto if available for better hashing
    if (globalThis.crypto?.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(base64);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback: simple hash for older browsers
    let hash = 0;
    for (let i = 0; i < base64.length; i++) {
      const char = base64.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
  
  /**
   * Check if this asset exceeds a size limit
   * @param {number} maxBytes - Maximum size in bytes
   * @returns {boolean}
   */
  exceedsSize(maxBytes) {
    return this.size > maxBytes;
  }
  
  /**
   * Get human-readable file size
   * @returns {string}
   */
  getFormattedSize() {
    if (this.size < 1024) return `${this.size} B`;
    if (this.size < 1024 * 1024) return `${(this.size / 1024).toFixed(1)} KB`;
    return `${(this.size / (1024 * 1024)).toFixed(2)} MB`;
  }

  /** @private */
  static _finiteNonNegativeInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
  }

  /** @private */
  static _hasExpectedSignature(dataURL, mimeType) {
    try {
      const payload = dataURL.slice(dataURL.indexOf(',') + 1);
      const prefix = atob(payload.slice(0, 24));
      const bytes = Array.from(prefix, char => char.charCodeAt(0));
      if (mimeType === 'image/png') {
        return [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
          .every((byte, index) => bytes[index] === byte);
      }
      if (mimeType === 'image/jpeg') {
        return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
      }
      if (mimeType === 'image/webp') {
        return prefix.slice(0, 4) === 'RIFF' && prefix.slice(8, 12) === 'WEBP';
      }
    } catch {
      return false;
    }
    return false;
  }
}

export default ImageAsset;
