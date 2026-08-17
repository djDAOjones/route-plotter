import { STORAGE } from '../config/constants.js';

/**
 * Service for handling localStorage operations
 * Provides methods for saving and loading application state with error handling
 */
export class StorageService {
  constructor() {
    this.debounceTimer = null;
    this._lastSerialized = null; // Track last saved state for change detection
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
      localStorage.setItem(key, serialized);
      return true;
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
   */
  autoSave(state) {
    // Skip if nothing changed - pure optimization with no downside
    const newSerialized = JSON.stringify(state);
    if (newSerialized === this._lastSerialized) {
      return; // No changes detected, skip save
    }
    
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Set new timer
    this.debounceTimer = setTimeout(() => {
      this.save(STORAGE.AUTOSAVE_KEY, state);
      this._lastSerialized = newSerialized; // Remember for next comparison
      console.debug('Auto-saved state');
    }, STORAGE.AUTOSAVE_INTERVAL);
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
    return this.remove(STORAGE.AUTOSAVE_KEY);
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
      const keys = [
        STORAGE.AUTOSAVE_KEY,
        STORAGE.PREFERENCES_KEY,
        STORAGE.SPLASH_SHOWN_KEY
      ];
      
      keys.forEach(key => this.remove(key));
      return true;
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
}
