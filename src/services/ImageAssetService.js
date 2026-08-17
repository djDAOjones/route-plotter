/**
 * Service for managing image assets (custom path heads, waypoint markers, background)
 * Handles storage, deduplication, caching, and ZIP export/import
 * 
 * Features:
 * - Hash-based deduplication (same image = same ID)
 * - Lazy loading of HTMLImageElement instances
 * - Size limits for autosave (5MB) vs ZIP export (50MB)
 * - ZIP export includes all assets + project JSON
 */

import { ImageAsset } from '../models/ImageAsset.js';

// Size limits in bytes
export const SIZE_LIMITS = {
  AUTOSAVE_MAX: 5 * 1024 * 1024,      // 5MB for localStorage autosave
  ZIP_MAX: 50 * 1024 * 1024,          // 50MB for ZIP export
  SINGLE_IMAGE_WARN: 2 * 1024 * 1024  // 2MB warning threshold per image
};

// JSZip CDN URL for dynamic loading
const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

/**
 * ImageAssetService - Centralized image asset management
 */
export class ImageAssetService {
  constructor() {
    // Map of asset ID -> ImageAsset
    this._assets = new Map();
    
    // Track total size for limit checking
    this._totalSize = 0;
    
    // JSZip library reference (loaded on demand)
    this._JSZip = null;
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
    // Calculate size from base64 (rough estimate: base64 is ~33% larger than binary)
    const sizeEstimate = Math.floor((base64.length - base64.indexOf(',') - 1) * 0.75);
    
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
    
    // Load image to get dimensions
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const asset = new ImageAsset({
          id,
          base64,
          name,
          width: img.width,
          height: img.height,
          mimeType: base64.split(';')[0].split(':')[1] || 'image/png',
          size: sizeEstimate
        });
        asset._imageElement = img;
        
        const result = this.addAsset(asset);
        resolve(result);
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${name}`));
      img.src = base64;
    });
  }
  
  /**
   * Add an ImageAsset (deduplicates by ID/hash)
   * @param {ImageAsset} asset
   * @returns {{asset: ImageAsset, isNew: boolean, warning: string|null}}
   */
  addAsset(asset) {
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
    
    // Add new asset
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
    if (!Array.isArray(data)) return;
    
    for (const assetData of data) {
      const asset = ImageAsset.fromJSON(assetData);
      this._assets.set(asset.id, asset);
      this._totalSize += asset.size;
    }
  }
  
  /**
   * Load JSZip library dynamically
   * @private
   * @returns {Promise<JSZip>}
   */
  async _loadJSZip() {
    if (this._JSZip) return this._JSZip;
    
    // Check if already loaded globally
    if (window.JSZip) {
      this._JSZip = window.JSZip;
      return this._JSZip;
    }
    
    // Load from CDN
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = JSZIP_CDN;
      script.onload = () => {
        this._JSZip = window.JSZip;
        resolve(this._JSZip);
      };
      script.onerror = () => reject(new Error('Failed to load JSZip library'));
      document.head.appendChild(script);
    });
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
    const JSZip = await this._loadJSZip();
    const zip = new JSZip();
    
    // Create assets folder
    const assetsFolder = zip.folder('assets');
    
    // Add all image assets to assets folder
    const assetManifest = [];
    for (const [id, asset] of this._assets) {
      // Extract binary data from base64
      const base64Data = asset.base64.split(',')[1];
      const extension = asset.mimeType.split('/')[1] || 'png';
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
      const bgExtension = backgroundBase64.split(';')[0].split('/')[1] || 'png';
      const bgBase64Data = backgroundBase64.split(',')[1];
      zip.file(`background.${bgExtension}`, bgBase64Data, { base64: true });
      projectData.backgroundFile = `background.${bgExtension}`;
    }
    
    // Add asset manifest
    projectData.assetManifest = assetManifest;
    
    // Add project JSON
    zip.file('project.json', JSON.stringify(projectData, null, 2));
    
    // Generate ZIP
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }
  
  /**
   * Import project from ZIP file
   * 
   * @param {File|Blob} zipFile - ZIP file to import
   * @returns {Promise<{projectData: Object, backgroundBase64: string|null}>}
   */
  async importZip(zipFile) {
    const JSZip = await this._loadJSZip();
    const zip = await JSZip.loadAsync(zipFile);
    
    // Read project.json
    const projectJsonFile = zip.file('project.json');
    if (!projectJsonFile) {
      throw new Error('Invalid project file: missing project.json');
    }
    
    const projectData = JSON.parse(await projectJsonFile.async('string'));
    
    // Clear existing assets
    this.clear();
    
    // Load assets from manifest
    if (projectData.assetManifest) {
      for (const assetInfo of projectData.assetManifest) {
        const assetFile = zip.file(`assets/${assetInfo.filename}`);
        if (assetFile) {
          const base64Data = await assetFile.async('base64');
          const mimeType = assetInfo.mimeType || 'image/png';
          const base64 = `data:${mimeType};base64,${base64Data}`;
          
          const asset = new ImageAsset({
            id: assetInfo.id,
            base64,
            name: assetInfo.name,
            width: assetInfo.width,
            height: assetInfo.height,
            mimeType,
            size: assetInfo.size
          });
          
          this._assets.set(asset.id, asset);
          this._totalSize += asset.size;
        }
      }
    }
    
    // Load background image if present
    let backgroundBase64 = null;
    if (projectData.backgroundFile) {
      const bgFile = zip.file(projectData.backgroundFile);
      if (bgFile) {
        const bgBase64Data = await bgFile.async('base64');
        const bgExtension = projectData.backgroundFile.split('.').pop();
        const bgMimeType = `image/${bgExtension === 'jpg' ? 'jpeg' : bgExtension}`;
        backgroundBase64 = `data:${bgMimeType};base64,${bgBase64Data}`;
      }
    }
    
    // Clean up manifest from project data (not needed after import)
    delete projectData.assetManifest;
    delete projectData.backgroundFile;
    
    return { projectData, backgroundBase64 };
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
