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
    // A record that could not be restored, held in the recovery key because
    // it could not move to its own (DEF-28). Nothing writes over it meanwhile.
    this._heldAutoSave = null;
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
    if (this._isHeld(key)) return false;
    return this._removeKey(key);
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
   * The recovery record exactly as stored. A record that cannot be restored
   * is kept byte for byte (DEF-28), so the restore reads it raw, once, and
   * parses that same text.
   * @returns {string|null} The stored text, or null
   */
  loadAutoSaveText() {
    return this._readText(STORAGE.AUTOSAVE_KEY);
  }

  /**
   * Keep a recovery record that could not be restored until the author
   * chooses (DEF-28). A copy goes under a key of its own, which autosave never
   * writes, and only then does the original go, so new work is still saved; a
   * record kept already is not copied again. Where no copy can be written,
   * nothing is removed to make room: the record stays in the recovery key,
   * held, and no write or clear reaches it, here or in another tab of this
   * app, or at a later start, until the author discards it.
   * @param {string} text - The record exactly as the restore read it
   * @returns {{ where: 'parked', key: string, existing: boolean }
   *   | { where: 'held' } | { where: 'unkept' }} Where it is now: under its own
   *   key (one that held it already, if `existing`), held in the recovery key,
   *   or in neither (no copy could be written, and the recovery key holds
   *   another record now, written while this one was restoring)
   */
  keepUnrestored(text) {
    const existingKey = this.listKept().records.find(record => record.text === text)?.key;
    const key = existingKey ?? this._copyToKept(text);
    if (key) {
      // A copy left in the recovery key would be tried, and kept, again.
      this._removeIfHolding(STORAGE.AUTOSAVE_KEY, text);
      if (this._heldAutoSave === text) this._releaseHold();
      return { where: 'parked', key, existing: Boolean(existingKey) };
    }
    const recovery = this._readKey(STORAGE.AUTOSAVE_KEY);
    // A key that cannot be read may still hold it, so it is held all the same.
    if (recovery.ok && recovery.value !== text) return { where: 'unkept' };
    this._hold(text);
    return { where: 'held' };
  }

  /**
   * Every record kept under a key of its own, newest first (DEF-28). A key
   * that cannot be read is listed with no text: it can still be removed.
   * @returns {{ ok: boolean, records: Array<{ key: string, text: string|null }> }}
   *   `ok` is false when the store could not be searched
   */
  listKept() {
    const keys = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(STORAGE.KEPT_AUTOSAVE_PREFIX)) keys.push(key);
      }
    } catch (error) {
      console.error('Failed to search localStorage for kept sessions:', error);
      return { ok: false, records: [] };
    }
    const records = keys
      .sort((a, b) => keptTime(b) - keptTime(a) || b.localeCompare(a))
      .map(key => ({ key, text: this._readText(key) }));
    return { ok: true, records };
  }

  /**
   * The record held in the recovery key, if one is (DEF-28): by this tab, or,
   * by the mark it left, by another tab or an earlier start, whose hold this
   * tab then takes on.
   * @returns {string|null} The held record's text, or null
   */
  adoptHeld() {
    if (this._heldAutoSave !== null) return this._heldAutoSave;
    const text = this._heldElsewhere();
    if (typeof text === 'string') this._heldAutoSave = text;
    return this._heldAutoSave;
  }

  /**
   * Remove a kept record, for the author's Discard — one of the two ways one
   * goes (DEF-28) — from where it was kept, and any identical copy left in
   * the recovery key, but never a different record written there since.
   * Ending a hold lets autosave write again.
   * @param {{ text: string, where: 'parked'|'held'|'unkept', key?: string }} kept
   * @returns {boolean} Whether no copy of it is left in the store
   */
  discardKept({ text, where, key }) {
    if (where === 'unkept') return true;
    // The recovery key's copy first: if it cannot go, the record stays on offer.
    if (!this._removeIfHolding(STORAGE.AUTOSAVE_KEY, text)) return false;
    if (this._heldAutoSave === text) this._releaseHold();
    return where !== 'parked' || this._removeIfHolding(key, text);
  }

  /**
   * Clear All's part (DEF-28): remove every kept record, readable or not,
   * and a held one, and end the hold.
   * @returns {{ ok: boolean, removed: number }} `ok` is false when a record
   *   could not be found or removed
   */
  discardAllKept() {
    const listed = this.listKept();
    let ok = listed.ok;
    let removed = 0;
    for (const { key } of listed.records) {
      if (this._removeKey(key)) removed += 1;
      else ok = false;
    }
    const held = this.adoptHeld();
    if (held !== null) {
      if (this._removeIfHolding(STORAGE.AUTOSAVE_KEY, held)) {
        this._releaseHold();
        removed += 1;
      } else {
        ok = false;
      }
    }
    return { ok, removed };
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
      
      let saved = true;
      if (data.autosave) {
        saved = this.save(STORAGE.AUTOSAVE_KEY, data.autosave) && saved;
      }
      
      if (data.preferences) {
        saved = this.save(STORAGE.PREFERENCES_KEY, data.preferences) && saved;
      }
      
      return saved;
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
  _readText(key) {
    return this._readKey(key).value;
  }

  /** @private */
  _readKey(key) {
    try {
      return { ok: true, value: localStorage.getItem(key) };
    } catch (error) {
      console.error(`Failed to load from localStorage (${key}):`, error);
      return { ok: false, value: null };
    }
  }

  /**
   * @private Whether `key` is the recovery key while it holds a record that
   * could not be restored (DEF-28), which no ordinary write or removal reaches.
   */
  _isHeld(key) {
    return key === STORAGE.AUTOSAVE_KEY && (this._heldAutoSave !== null || this._heldElsewhere() !== null);
  }

  /**
   * @private The recovery key's text when the mark another tab or an earlier
   * start left says it is held; null when it is not held. A mark that no
   * longer matches the key is cleared. A store that cannot be read is taken
   * to hold it (true): unknown ownership blocks the write.
   */
  _heldElsewhere() {
    const mark = this._readKey(STORAGE.HELD_AUTOSAVE_KEY);
    if (!mark.ok) return true;
    if (mark.value === null) return null;
    const recovery = this._readKey(STORAGE.AUTOSAVE_KEY);
    if (!recovery.ok) return true;
    if (recovery.value !== null && mark.value === fingerprint(recovery.value)) return recovery.value;
    this._removeKey(STORAGE.HELD_AUTOSAVE_KEY);
    return null;
  }

  /** @private Hold `text` in the recovery key, and mark it for other tabs and later starts. */
  _hold(text) {
    this._heldAutoSave = text;
    this._setKey(STORAGE.HELD_AUTOSAVE_KEY, fingerprint(text));
  }

  /** @private End a hold: autosave writes the recovery key again. */
  _releaseHold() {
    this._heldAutoSave = null;
    this._lastSerialized = null;
    this._removeKey(STORAGE.HELD_AUTOSAVE_KEY);
  }

  /** @private Copy `text` to a new key of its own; the key, or null. */
  _copyToKept(text) {
    const key = `${STORAGE.KEPT_AUTOSAVE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this._setKey(key, text) ? key : null;
  }

  /**
   * @private Remove `key` if it holds exactly `text`. True when it no longer
   * does; false when it could not be read, or could not be removed.
   */
  _removeIfHolding(key, text) {
    const stored = this._readKey(key);
    if (!stored.ok) return false;
    if (stored.value !== text) return true;
    if (!this._removeKey(key)) return false;
    if (key === STORAGE.AUTOSAVE_KEY) this._lastSerialized = null;
    return true;
  }

  /** @private A write the hold does not stop: only kept records use it. */
  _setKey(key, text) {
    try {
      localStorage.setItem(key, text);
      return true;
    } catch (error) {
      console.error(`Failed to save to localStorage (${key}):`, error);
      return false;
    }
  }

  /** @private A removal the hold does not stop. */
  _removeKey(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove from localStorage (${key}):`, error);
      return false;
    }
  }

  /** @private */
  _writeSerialized(key, serialized) {
    if (this._isHeld(key)) {
      return { ok: false, error: new Error("Browser recovery holds a session that couldn't be restored") };
    }
    try {
      localStorage.setItem(key, serialized);
      return { ok: true };
    } catch (error) {
      console.error(`Failed to save to localStorage (${key}):`, error);
      return { ok: false, error };
    }
  }
}

/** A kept record's key names when it was kept. */
function keptTime(key) {
  return Number.parseInt(key.slice(STORAGE.KEPT_AUTOSAVE_PREFIX.length), 10) || 0;
}

/**
 * A held record's mark: its length and an FNV-1a hash of its text, enough to
 * tell it from whatever autosave writes later (DEF-28).
 * @param {string} text
 * @returns {string}
 */
function fingerprint(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}
