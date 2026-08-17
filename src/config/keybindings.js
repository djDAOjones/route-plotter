/**
 * Keybindings Configuration
 * 
 * Single source of truth for all keyboard shortcuts and mouse modifiers.
 * Drives both event handlers and help/documentation UI.
 * 
 * Users can customize bindings via localStorage override.
 * Future: import/export of custom keybindings.
 * 
 * Structure:
 * - Each binding has: key(s), modifiers, action (eventBus event), description
 * - Mouse bindings use 'click' or 'drag' as the key
 * - Modifiers: shift, ctrl, alt, meta (cmd on Mac)
 * 
 * @module config/keybindings
 */

const STORAGE_KEY = 'routePlotter_customKeybindings';

/**
 * Platform detection for display purposes
 */
export const isMac = typeof navigator !== 'undefined' && 
  navigator.platform.toUpperCase().indexOf('MAC') >= 0;

/**
 * Modifier display names (platform-aware)
 */
export const MODIFIER_DISPLAY = {
  meta: isMac ? '⌘' : 'Ctrl',
  ctrl: isMac ? '⌃' : 'Ctrl',
  alt: isMac ? '⌥' : 'Alt',
  shift: '⇧'
};

/**
 * Default keybindings
 * 
 * Categories:
 * - waypoint: Waypoint creation/editing
 * - navigation: Canvas navigation and waypoint movement
 * - playback: Animation playback controls
 * - general: Undo/redo, save, help
 */
const DEFAULT_BINDINGS = {
  // ========== MOUSE BINDINGS ==========
  mouse: {
    addWaypoint: {
      key: 'click',
      modifiers: [],
      action: 'waypoint:add',
      description: 'Add waypoint',
      category: 'waypoint'
    },
    addMinorWaypoint: {
      key: 'click',
      modifiers: ['meta'], // Cmd/Ctrl+Click
      action: 'waypoint:add-minor',
      description: 'Add minor waypoint',
      category: 'waypoint'
    },
    forceAddWaypoint: {
      key: 'click',
      modifiers: ['alt'],
      action: 'waypoint:force-add',
      description: 'Force add major (bypass selection)',
      category: 'waypoint'
    },
    forceAddMinorWaypoint: {
      key: 'click',
      modifiers: ['alt', 'meta'], // Alt+Cmd/Ctrl+Click
      action: 'waypoint:force-add-minor',
      description: 'Force add minor (bypass selection)',
      category: 'waypoint'
    },
    deleteWaypoint: {
      key: 'click',
      modifiers: ['shift'],
      action: 'waypoint:delete',
      description: 'Delete waypoint',
      category: 'waypoint'
    },
    selectWaypoint: {
      key: 'click',
      modifiers: [],
      action: 'waypoint:select',
      description: 'Select waypoint',
      category: 'waypoint',
      context: 'on waypoint' // Only shown in detailed help
    },
    moveWaypoint: {
      key: 'drag',
      modifiers: [],
      action: 'waypoint:move',
      description: 'Move waypoint',
      category: 'waypoint',
      context: 'on waypoint'
    }
  },

  // ========== KEYBOARD BINDINGS ==========
  keyboard: {
    // ----- Waypoint actions -----
    addAtCenter: {
      key: 'a',
      modifiers: [],
      action: 'waypoint:add-at-center',
      description: 'Add waypoint at center',
      category: 'waypoint'
    },
    duplicateWaypoint: {
      key: 'd',
      modifiers: ['meta'],
      action: 'waypoint:duplicate',
      description: 'Duplicate selected',
      category: 'waypoint'
    },
    deleteSelected: {
      key: 'Delete',
      modifiers: [],
      altKeys: ['Backspace'], // Alternative keys
      action: 'waypoint:delete-selected',
      description: 'Delete selected',
      category: 'waypoint'
    },
    deselectWaypoint: {
      key: 'Escape',
      modifiers: [],
      action: 'waypoint:deselect',
      description: 'Deselect',
      category: 'waypoint'
    },
    selectNextWaypoint: {
      key: 'Tab',
      modifiers: [],
      action: 'waypoint:select-next',
      description: 'Select next waypoint',
      category: 'waypoint'
    },
    selectPrevWaypoint: {
      key: 'Tab',
      modifiers: ['shift'],
      action: 'waypoint:select-prev',
      description: 'Select previous waypoint',
      category: 'waypoint'
    },
    selectAllWaypoints: {
      key: 'a',
      modifiers: ['meta'],
      action: 'waypoint:select-all',
      description: 'Select all waypoints',
      category: 'waypoint'
    },
    toggleWaypointType: {
      key: 't',
      modifiers: [],
      action: 'waypoint:toggle-type',
      description: 'Toggle major/minor',
      category: 'waypoint'
    },

    // ----- Navigation -----
    nudgeUp: {
      key: 'ArrowUp',
      modifiers: [],
      action: 'waypoint:nudge-up',
      description: 'Nudge up',
      category: 'navigation'
    },
    nudgeDown: {
      key: 'ArrowDown',
      modifiers: [],
      action: 'waypoint:nudge-down',
      description: 'Nudge down',
      category: 'navigation'
    },
    nudgeLeft: {
      key: 'ArrowLeft',
      modifiers: [],
      action: 'waypoint:nudge-left',
      description: 'Nudge left',
      category: 'navigation'
    },
    nudgeRight: {
      key: 'ArrowRight',
      modifiers: [],
      action: 'waypoint:nudge-right',
      description: 'Nudge right',
      category: 'navigation'
    },
    nudgeUpLarge: {
      key: 'ArrowUp',
      modifiers: ['shift'],
      action: 'waypoint:nudge-up-large',
      description: 'Nudge up (large)',
      category: 'navigation',
      hidden: true // Don't show in compact help, shown in full
    },
    nudgeDownLarge: {
      key: 'ArrowDown',
      modifiers: ['shift'],
      action: 'waypoint:nudge-down-large',
      description: 'Nudge down (large)',
      category: 'navigation',
      hidden: true
    },
    nudgeLeftLarge: {
      key: 'ArrowLeft',
      modifiers: ['shift'],
      action: 'waypoint:nudge-left-large',
      description: 'Nudge left (large)',
      category: 'navigation',
      hidden: true
    },
    nudgeRightLarge: {
      key: 'ArrowRight',
      modifiers: ['shift'],
      action: 'waypoint:nudge-right-large',
      description: 'Nudge right (large)',
      category: 'navigation',
      hidden: true
    },
    zoomIn: {
      key: '=',
      modifiers: [],
      altKeys: ['+'],
      action: 'canvas:zoom-in',
      description: 'Zoom in',
      category: 'navigation'
    },
    zoomOut: {
      key: '-',
      modifiers: [],
      altKeys: ['_'],
      action: 'canvas:zoom-out',
      description: 'Zoom out',
      category: 'navigation'
    },
    zoomReset: {
      key: '0',
      modifiers: [],
      action: 'canvas:zoom-reset',
      description: 'Reset zoom',
      category: 'navigation'
    },

    // ----- Playback -----
    playPause: {
      key: ' ',
      modifiers: [],
      action: 'animation:toggle',
      description: 'Play / Pause',
      displayKey: 'Space', // For display purposes
      category: 'playback'
    },
    skipToStart: {
      key: 'Home',
      modifiers: [],
      action: 'ui:animation:skip-start',
      description: 'Go to start',
      category: 'playback'
    },
    skipToEnd: {
      key: 'End',
      modifiers: [],
      action: 'ui:animation:skip-end',
      description: 'Go to end',
      category: 'playback'
    },
    playReverse: {
      key: 'j',
      modifiers: [],
      action: 'animation:reverse',
      description: 'Play reverse',
      category: 'playback'
    },
    playPauseK: {
      key: 'k',
      modifiers: [],
      action: 'animation:pause',
      description: 'Pause',
      category: 'playback',
      hidden: true // J/K/L shown as group
    },
    playForward: {
      key: 'l',
      modifiers: [],
      action: 'animation:forward',
      description: 'Play forward',
      category: 'playback'
    },
    stepBackward: {
      key: ',',
      modifiers: [],
      action: 'animation:step-backward',
      description: 'Step backward',
      category: 'playback'
    },
    stepForward: {
      key: '.',
      modifiers: [],
      action: 'animation:step-forward',
      description: 'Step forward',
      category: 'playback'
    },

    // ----- General -----
    undo: {
      key: 'z',
      modifiers: ['meta'],
      action: 'history:undo',
      description: 'Undo',
      category: 'general'
    },
    redo: {
      key: 'z',
      modifiers: ['meta', 'shift'],
      action: 'history:redo',
      description: 'Redo',
      category: 'general'
    },
    save: {
      key: 's',
      modifiers: ['meta'],
      action: 'file:save',
      description: 'Save',
      category: 'general'
    },
    showShortcuts: {
      key: '?',
      modifiers: [],
      action: 'help:show-shortcuts',
      description: 'Show keyboard shortcuts',
      category: 'general'
    }
  }
};

/**
 * Category display order and titles
 */
export const CATEGORIES = {
  waypoint: { title: 'Waypoints', icon: '📍', order: 1 },
  navigation: { title: 'Navigation', icon: '🧭', order: 2 },
  playback: { title: 'Playback', icon: '▶️', order: 3 },
  general: { title: 'General', icon: '⚙️', order: 4 }
};

/**
 * Get current keybindings (defaults merged with user customizations)
 * 
 * @returns {Object} Current keybindings
 */
export function getKeybindings() {
  const customBindings = loadCustomBindings();
  if (!customBindings) {
    return DEFAULT_BINDINGS;
  }
  
  // Deep merge custom over defaults
  return mergeBindings(DEFAULT_BINDINGS, customBindings);
}

/**
 * Load user customizations from localStorage
 * 
 * @returns {Object|null} Custom bindings or null
 */
function loadCustomBindings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('Failed to load custom keybindings:', e);
    return null;
  }
}

/**
 * Save user customizations to localStorage
 * 
 * @param {Object} bindings - Custom bindings to save
 */
export function saveCustomBindings(bindings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch (e) {
    console.error('Failed to save custom keybindings:', e);
  }
}

/**
 * Reset to default keybindings
 */
export function resetToDefaults() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Deep merge bindings (custom over defaults)
 * 
 * @param {Object} defaults - Default bindings
 * @param {Object} custom - Custom overrides
 * @returns {Object} Merged bindings
 */
function mergeBindings(defaults, custom) {
  const result = JSON.parse(JSON.stringify(defaults));
  
  for (const type of ['mouse', 'keyboard']) {
    if (custom[type]) {
      for (const [id, binding] of Object.entries(custom[type])) {
        if (result[type][id]) {
          Object.assign(result[type][id], binding);
        }
      }
    }
  }
  
  return result;
}

/**
 * Format a binding for display (e.g., "⌘+Shift+Z")
 * 
 * @param {Object} binding - Binding object
 * @returns {string} Formatted shortcut string
 */
export function formatBinding(binding) {
  const parts = [];
  
  // Add modifiers in consistent order
  if (binding.modifiers.includes('meta')) parts.push(MODIFIER_DISPLAY.meta);
  if (binding.modifiers.includes('ctrl')) parts.push(MODIFIER_DISPLAY.ctrl);
  if (binding.modifiers.includes('alt')) parts.push(MODIFIER_DISPLAY.alt);
  if (binding.modifiers.includes('shift')) parts.push(MODIFIER_DISPLAY.shift);
  
  // Add key (use displayKey if available)
  const keyDisplay = binding.displayKey || formatKey(binding.key);
  parts.push(keyDisplay);
  
  return parts.join('+');
}

/**
 * Format a key for display
 * 
 * @param {string} key - Raw key value
 * @returns {string} Display-friendly key
 */
function formatKey(key) {
  const keyMap = {
    ' ': 'Space',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Escape': 'Esc',
    'Delete': 'Del',
    'Backspace': '⌫',
    'click': 'Click',
    'drag': 'Drag'
  };
  
  return keyMap[key] || key.toUpperCase();
}

/**
 * Get bindings grouped by category for UI rendering
 * 
 * @param {Object} options - Filter options
 * @param {boolean} options.includeHidden - Include hidden bindings
 * @param {boolean} options.includeMouse - Include mouse bindings
 * @returns {Object} Bindings grouped by category
 */
export function getBindingsByCategory(options = {}) {
  const { includeHidden = false, includeMouse = true } = options;
  const bindings = getKeybindings();
  const grouped = {};
  
  // Initialize categories
  for (const [catId, cat] of Object.entries(CATEGORIES)) {
    grouped[catId] = {
      ...cat,
      bindings: []
    };
  }
  
  // Add mouse bindings
  if (includeMouse) {
    for (const [id, binding] of Object.entries(bindings.mouse)) {
      if (!includeHidden && binding.hidden) continue;
      grouped[binding.category].bindings.push({
        id,
        ...binding,
        formatted: formatBinding(binding)
      });
    }
  }
  
  // Add keyboard bindings
  for (const [id, binding] of Object.entries(bindings.keyboard)) {
    if (!includeHidden && binding.hidden) continue;
    grouped[binding.category].bindings.push({
      id,
      ...binding,
      formatted: formatBinding(binding)
    });
  }
  
  // Sort by category order
  return Object.fromEntries(
    Object.entries(grouped)
      .sort(([, a], [, b]) => a.order - b.order)
  );
}

/**
 * Check if a keyboard event matches a binding
 * 
 * @param {KeyboardEvent} event - The keyboard event
 * @param {Object} binding - Binding to check against
 * @returns {boolean} True if event matches binding
 */
export function matchesBinding(event, binding) {
  const key = event.key.toLowerCase();
  const bindingKey = binding.key.toLowerCase();
  
  // Check key match (including alt keys)
  const keyMatches = key === bindingKey || 
    (binding.altKeys && binding.altKeys.some(alt => alt.toLowerCase() === key));
  
  if (!keyMatches) return false;
  
  // Check modifiers
  const wantsMeta = binding.modifiers.includes('meta');
  const wantsCtrl = binding.modifiers.includes('ctrl');
  const wantsAlt = binding.modifiers.includes('alt');
  const wantsShift = binding.modifiers.includes('shift');
  
  // On Mac, metaKey is Cmd; on Windows, check ctrlKey for 'meta' bindings
  const metaPressed = isMac ? event.metaKey : event.ctrlKey;
  
  return (
    metaPressed === wantsMeta &&
    event.altKey === wantsAlt &&
    event.shiftKey === wantsShift
  );
}

/**
 * Check if mouse event matches a binding
 * 
 * @param {MouseEvent} event - The mouse event
 * @param {Object} binding - Binding to check against
 * @returns {boolean} True if event matches binding
 */
export function matchesMouseBinding(event, binding) {
  const wantsMeta = binding.modifiers.includes('meta');
  const wantsAlt = binding.modifiers.includes('alt');
  const wantsShift = binding.modifiers.includes('shift');
  
  const metaPressed = isMac ? event.metaKey : event.ctrlKey;
  
  return (
    metaPressed === wantsMeta &&
    event.altKey === wantsAlt &&
    event.shiftKey === wantsShift
  );
}

/**
 * Get the default bindings (for reference/reset)
 * 
 * @returns {Object} Default bindings
 */
export function getDefaultBindings() {
  return JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
}
