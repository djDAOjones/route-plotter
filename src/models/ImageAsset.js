/**
 * Model representing an image asset (custom path head, waypoint marker, or background)
 * Stores image data with metadata for efficient deduplication and caching
 */
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
    this.id = options.id || '';
    this.base64 = options.base64 || '';
    this.name = options.name || 'untitled';
    this.width = options.width || 0;
    this.height = options.height || 0;
    this.mimeType = options.mimeType || 'image/png';
    this.size = options.size || 0;
    
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
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this._imageElement = img;
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${this.name}`));
      img.src = this.base64;
    });
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
   * Create ImageAsset from a File object
   * @param {File} file - Image file
   * @returns {Promise<ImageAsset>}
   */
  static async fromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const base64 = event.target.result;
        const img = new Image();
        
        img.onload = async () => {
          // Generate hash-based ID for deduplication
          const id = await ImageAsset.generateHash(base64);
          
          const asset = new ImageAsset({
            id,
            base64,
            name: file.name,
            width: img.width,
            height: img.height,
            mimeType: file.type || 'image/png',
            size: file.size
          });
          
          // Cache the already-loaded image
          asset._imageElement = img;
          
          resolve(asset);
        };
        
        img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
        img.src = base64;
      };
      
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Generate a hash ID from base64 data for deduplication
   * Uses a simple hash algorithm (not cryptographic, just for identification)
   * @param {string} base64 - Base64 data URL
   * @returns {Promise<string>} Hash string
   */
  static async generateHash(base64) {
    // Use SubtleCrypto if available for better hashing
    if (crypto.subtle) {
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
}

export default ImageAsset;
