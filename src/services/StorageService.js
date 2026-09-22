import { STORAGE } from '../config/constants.js';

// localStorage quotas vary by browser and origin. Four MiB leaves headroom
// for preferences and browser accounting while still preserving useful image
// data in the autosave snapshot.
export const STORAGE_LIMITS = Object.freeze({
  AUTOSAVE_SERIALIZED_MAX: 4 * 1024 * 1024,
});

/**
 * Service for handling localStorage operations
 * Provides methods for saving and loading application state with error handling
 */
export class StorageService {
  constructor() {
    this.debounceTimer = null;
    this._lastSerialized = null; // Track last saved state for change detection
    this._pendingAutoSave = null;
    this._lifecycleTarget = null;
    this._pageHideHandler = null;
  }

  /**
   * Flush pending recovery state when the page is being discarded. Keeping
   * this opt-in makes the service testable and lets the app detach cleanly.
   * @param {EventTarget} target - Usually window
   */
  attachLifecycle(target) {
    if (!target?.addEventListener) return;
    this.detachLifecycle();
    this._lifecycleTarget = target;
    this._pageHideHandler = () => this.flushAutoSave();
    target.addEventListener('pagehide', this._pageHideHandler);
  }

  /** Remove the page lifecycle hook without cancelling pending recovery. */
  detachLifecycle() {
    if (this._lifecycleTarget && this._pageHideHandler) {
      this._lifecycleTarget.removeEventListener('pagehide', this._pageHideHandler);
    }
    this._lifecycleTarget = null;
    this._pageHideHandler = null;
  }
  
  /**
   * Save data to localStorage
   * @param {string} key - Storage key
   * @param {any} data - Data to save (will be JSON stringified)
   * @returns {boolean} True if successful
   */
  save(key, data) {
    try {
      const serialized = JSON.stringify(data);
      return this._writeSerialized(key, serialized).ok;
    } catch (error) {
      console.error(`Failed to save to localStorage (${key}):`, error);
      return false;
    }
  }
  
  /**
   * Load data from localStorage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if key doesn't exist or parse fails
   * @returns {any} Parsed data or default value
   */
  load(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch (error) {
      console.error(`Failed to load from localStorage (${key}):`, error);
      return defaultValue;
    }
  }
  
  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   * @returns {boolean} True if successful
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove from localStorage (${key}):`, error);
      return false;
    }
  }
  
  /**
   * Check if a key exists in localStorage
   * @param {string} key - Storage key
   * @returns {boolean} True if key exists
   */
  exists(key) {
    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      console.error(`Failed to check localStorage (${key}):`, error);
      return false;
    }
  }
  
  /**
   * Save application state (debounced with change detection)
   * @param {Object} state - Application state to save
   * @param {Function|null} onResult - Called after the actual storage write
   * @returns {{ok: boolean, pending?: boolean, unchanged?: boolean, error?: Error}}
   */
  autoSave(state, onResult = null) {
    let newSerialized;
    try {
      newSerialized = JSON.stringify(state);
      const bytes = new TextEncoder().encode(newSerialized).length;
      if (bytes > STORAGE_LIMITS.AUTOSAVE_SERIALIZED_MAX) {
        throw new Error('Autosave exceeds the 4 MB local-storage safety limit');
      }
    } catch (error) {
      console.error('Failed to prepare autosave:', error);
      return { ok: false, error };
    }

    // Skip if nothing changed - pure optimization with no downside.
    if (newSerialized === this._lastSerialized) {
      // A different state may already be pending. Reverting to the last
      // durable state must cancel that stale write.
      this.cancelAutoSave();
      onResult?.({ ok: true, unchanged: true });
      return { ok: true, unchanged: true };
    }
    
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this._pendingAutoSave = { serialized: newSerialized, onResult };

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      this.flushAutoSave();
    }, STORAGE.AUTOSAVE_INTERVAL);
    return { ok: true, pending: true };
  }

  /**
   * Write a pending debounced autosave immediately.
   * @returns {boolean} True when there was nothing pending or the write worked.
   */
  flushAutoSave() {
    if (!this._pendingAutoSave) return true;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;

    const pending = this._pendingAutoSave;
    this._pendingAutoSave = null;
    const result = this._writeSerialized(STORAGE.AUTOSAVE_KEY, pending.serialized);
    if (result.ok) {
      this._lastSerialized = pending.serialized;
      console.debug('Auto-saved state');
    }
    pending.onResult?.(result);
    return result.ok;
  }

  /**
   * Cancel a pending write so stale state cannot be written after Clear All or
   * a project replacement.
   * @returns {boolean} True if a pending write was cancelled.
   */
  cancelAutoSave() {
    const hadPending = Boolean(this._pendingAutoSave || this.debounceTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    this._pendingAutoSave = null;
    return hadPending;
  }

  /**
   * Persist an autosave immediately, replacing any pending older snapshot.
   * @param {Object} state
   * @returns {boolean}
   */
  saveAutoSave(state) {
    this.cancelAutoSave();
    let serialized;
    try {
      serialized = JSON.stringify(state);
      if (new TextEncoder().encode(serialized).length > STORAGE_LIMITS.AUTOSAVE_SERIALIZED_MAX) {
        throw new Error('Autosave exceeds the 4 MB local-storage safety limit');
      }
    } catch (error) {
      console.error('Failed to prepare autosave:', error);
      return false;
    }
    const result = this._writeSerialized(STORAGE.AUTOSAVE_KEY, serialized);
    if (result.ok) {
      this._lastSerialized = serialized;
      console.debug('Auto-saved state');
    }
    return result.ok;
  }
  
  /**
   * Load auto-saved application state
   * @returns {Object|null} Saved state or null
   */
  loadAutoSave() {
    return this.load(STORAGE.AUTOSAVE_KEY, null);
  }
  
  /**
   * Clear auto-saved state
   * @returns {boolean} True if successful
   */
  clearAutoSave() {
    this.cancelAutoSave();
    const removed = this.remove(STORAGE.AUTOSAVE_KEY);
    if (removed) this._lastSerialized = null;
    return removed;
  }
  
  /**
   * Save user preferences
   * @param {Object} preferences - User preferences
   * @returns {boolean} True if successful
   */
  savePreferences(preferences) {
    return this.save(STORAGE.PREFERENCES_KEY, preferences);
  }
  
  /**
   * Load user preferences
   * @returns {Object} User preferences with defaults
   */
  loadPreferences() {
    return this.load(STORAGE.PREFERENCES_KEY, {
      showSplash: true,
      theme: 'light',
      animationSpeed: 1,
      autoSave: true,
      keyboardShortcuts: true,
      highContrast: false
    });
  }
  
  /**
   * Check if splash screen should be shown
   * @returns {boolean} True if splash should be shown
   */
  shouldShowSplash() {
    return !this.exists(STORAGE.SPLASH_SHOWN_KEY);
  }
  
  /**
   * Mark splash screen as shown
   */
  markSplashShown() {
    this.save(STORAGE.SPLASH_SHOWN_KEY, true);
  }
  
  /**
   * Export all data as JSON string
   * @returns {string} JSON string of all localStorage data
   */
  exportData() {
    const data = {
      autosave: this.loadAutoSave(),
      preferences: this.loadPreferences(),
      timestamp: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Import data from JSON string
   * @param {string} jsonString - JSON string to import
   * @returns {boolean} True if successful
   */
  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      
      if (data.autosave) {
        this.save(STORAGE.AUTOSAVE_KEY, data.autosave);
      }
      
      if (data.preferences) {
        this.save(STORAGE.PREFERENCES_KEY, data.preferences);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }
  
  /**
   * Clear all stored data
   * @returns {boolean} True if successful
   */
  clearAll() {
    try {
      this.cancelAutoSave();
      const keys = [
        STORAGE.AUTOSAVE_KEY,
        STORAGE.PREFERENCES_KEY,
        STORAGE.SPLASH_SHOWN_KEY
      ];
      
      const removed = keys.map(key => this.remove(key)).every(Boolean);
      if (removed) this._lastSerialized = null;
      return removed;
    } catch (error) {
      console.error('Failed to clear all data:', error);
      return false;
    }
  }
  
  /**
   * Get storage size estimate
   * @returns {Promise<Object>} Storage quota and usage
   */
  async getStorageInfo() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage,
          quota: estimate.quota,
          percentage: (estimate.usage / estimate.quota) * 100
        };
      } catch (error) {
        console.error('Failed to estimate storage:', error);
      }
    }
    return null;
  }

  /** @private */
  _writeSerialized(key, serialized) {
    try {
      localStorage.setItem(key, serialized);
      return { ok: true };
    } catch (error) {
      console.error(`Failed to save to localStorage (${key}):`, error);
      return { ok: false, error };
    }
  }
}
