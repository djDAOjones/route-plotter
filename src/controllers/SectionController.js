/**
 * SectionController - Manages collapsible settings sections
 * 
 * ## Features
 * - Expand/collapse sections independently (multiple can be open)
 * - Persist section state to localStorage
 * - Show help when no waypoints exist
 * - Disable waypoint-specific sections when no waypoint selected
 * - Update "Editing: [name]" subheading
 * 
 * ## Section State
 * - On clear/no waypoints: Show help, hide all sections
 * - On first waypoint added: Hide help, show sections, open Marker section only
 * - On waypoint selected: Update editing name, enable controls
 * - On waypoint deselected: Show "Select Waypoint", disable Marker/Path controls
 * 
 * @module SectionController
 */

const STORAGE_KEY = 'routePlotter_sectionState';
const LAST_KEY = 'routePlotter_lastSection';

/**
 * Default section states when no localStorage exists
 * @type {Object<string, boolean>}
 */
const DEFAULT_SECTION_STATE = {
  general: false,
  marker: true,  // Open by default when first waypoint added
  text: false,
  path: false,
  camera: false,
  'area-highlight': false,
  background: false,
  animation: false,
  export: false
};

/**
 * Sections that require a waypoint to be selected
 * @type {string[]}
 */
const WAYPOINT_DEPENDENT_SECTIONS = ['marker', 'text', 'path', 'camera', 'area-highlight'];

export class SectionController {
  /**
   * @param {EventBus} eventBus - Application event bus
   */
  constructor(eventBus) {
    /** @type {EventBus} */
    this.eventBus = eventBus;
    
    /** @type {Object<string, boolean>} Current section expanded states */
    this.sectionStates = this._loadSectionStates();
    
    /** @type {boolean} Whether any waypoints exist */
    this.hasWaypoints = false;
    
    /** @type {boolean} Whether a waypoint is currently selected */
    this.hasSelection = false;
    
    /** @type {HTMLElement|null} Settings sections container */
    this.sectionsContainer = null;
    
    /** @type {HTMLElement|null} Help placeholder element */
    this.helpPlaceholder = null;
    
    /** @type {NodeListOf<Element>|null} Cached section elements */
    this._sectionElements = null;
    
    /** @type {Map<string, Element>} Cached section elements by name */
    this._sectionsByName = new Map();
    
    /** @type {string} Last interacted section name */
    this.lastInteracted = this._loadLastInteracted();
  }
  
  /**
   * Initialize the section controller
   * Binds to DOM elements and sets up event listeners
   */
  init() {
    this.sectionsContainer = document.getElementById('settings-sections');
    this.helpPlaceholder = document.getElementById('settings-help-placeholder');
    
    if (!this.sectionsContainer) {
      console.warn('[SectionController] Settings sections container not found');
      return;
    }
    
    // Cache section elements for performance
    this._sectionElements = this.sectionsContainer.querySelectorAll('.settings-section');
    
    // Build name->element map for O(1) lookups
    this._sectionElements.forEach(section => {
      const name = section.dataset.section;
      if (name) this._sectionsByName.set(name, section);
    });
    
    this._bindSectionHeaders();
    this._bindLastInteractedListeners();
    this._subscribeToEvents();
    
    // Initial state: show help (no waypoints yet)
    this._updateUIState();
  }
  
  /**
   * Load section states from localStorage
   * @returns {Object<string, boolean>} Section states
   * @private
   */
  _loadSectionStates() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SECTION_STATE, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[SectionController] Failed to load section states:', e);
    }
    return { ...DEFAULT_SECTION_STATE };
  }
  
  /**
   * Save section states to localStorage
   * @private
   */
  _saveSectionStates() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sectionStates));
    } catch (e) {
      console.warn('[SectionController] Failed to save section states:', e);
    }
  }
  
  /**
   * Load last-interacted section from localStorage
   * @returns {string} Section name (defaults to 'marker')
   * @private
   */
  _loadLastInteracted() {
    try {
      return localStorage.getItem(LAST_KEY) || 'marker';
    } catch (e) {
      return 'marker';
    }
  }
  
  /**
   * Save last-interacted section to localStorage
   * @private
   */
  _saveLastInteracted() {
    try {
      localStorage.setItem(LAST_KEY, this.lastInteracted);
    } catch (e) {
      // Silently fail - not critical
    }
  }
  
  /**
   * Set the last-interacted section and update UI
   * @param {string} sectionName - Section to mark as last-interacted
   * @private
   */
  _setLastInteracted(sectionName) {
    if (!sectionName || sectionName === this.lastInteracted) return;
    this.lastInteracted = sectionName;
    this._saveLastInteracted();
    this._applyLastInteractedIndicator();
  }
  
  /**
   * Apply data-last attribute to the last-interacted section
   * @private
   */
  _applyLastInteractedIndicator() {
    if (!this._sectionElements) return;
    this._sectionElements.forEach(section => {
      if (section.dataset.section === this.lastInteracted) {
        section.setAttribute('data-last', 'true');
      } else {
        section.removeAttribute('data-last');
      }
    });
  }
  
  /**
   * Bind click handlers to section headers
   * @private
   */
  _bindSectionHeaders() {
    const sections = this.sectionsContainer.querySelectorAll('.settings-section');
    
    sections.forEach(section => {
      const header = section.querySelector('.section-header');
      const sectionName = section.dataset.section;
      
      if (!header || !sectionName) return;
      
      // Click handler - set last-interacted before toggling
      header.addEventListener('click', () => {
        this._setLastInteracted(sectionName);
        this.toggleSection(sectionName);
      });
      
      // Keyboard handler (Enter/Space)
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._setLastInteracted(sectionName);
          this.toggleSection(sectionName);
        }
      });
    });
  }
  
  /**
   * Bind focusin and input listeners for last-interacted tracking
   * @private
   */
  _bindLastInteractedListeners() {
    if (!this.sectionsContainer) return;
    
    // Track focus into sections (keyboard navigation)
    this.sectionsContainer.addEventListener('focusin', (e) => {
      const section = e.target?.closest?.('.settings-section');
      const name = section?.dataset?.section;
      if (name) this._setLastInteracted(name);
    });
    
    // Track input changes within sections
    this.sectionsContainer.addEventListener('input', (e) => {
      const section = e.target?.closest?.('.settings-section');
      const name = section?.dataset?.section;
      if (name) this._setLastInteracted(name);
    });
  }
  
  /**
   * Subscribe to application events
   * @private
   */
  _subscribeToEvents() {
    // Waypoint list changes
    this.eventBus.on('waypoint:list-updated', (waypoints) => {
      const hadWaypoints = this.hasWaypoints;
      this.hasWaypoints = waypoints && waypoints.length > 0;
      
      // First waypoint added - transition from help to sections
      if (!hadWaypoints && this.hasWaypoints) {
        this._onFirstWaypointAdded();
      }
      
      // All waypoints removed - show help
      if (hadWaypoints && !this.hasWaypoints) {
        this._onAllWaypointsRemoved();
      }
    });
    
    // Waypoint selection
    this.eventBus.on('waypoint:selected', (waypoint) => {
      this.hasSelection = true;
      this._updateUIState();
    });
    
    // Waypoint deselection
    this.eventBus.on('waypoint:deselected', () => {
      this.hasSelection = false;
      this._updateUIState();
    });
    
    // All waypoints selected
    this.eventBus.on('waypoint:all-selected', () => {
      this.hasSelection = true;
      this._updateUIState();
    });
    
    // Clear all
    this.eventBus.on('app:cleared', () => {
      this.hasWaypoints = false;
      this.hasSelection = false;
      this._onAllWaypointsRemoved();
    });
  }
  
  /**
   * Toggle a section's expanded state
   * @param {string} sectionName - Name of section to toggle
   */
  toggleSection(sectionName) {
    this.sectionStates[sectionName] = !this.sectionStates[sectionName];
    this._saveSectionStates();
    this._applySectionState(sectionName);
  }
  
  /**
   * Expand a specific section
   * @param {string} sectionName - Name of section to expand
   */
  expandSection(sectionName) {
    if (!this.sectionStates[sectionName]) {
      this.sectionStates[sectionName] = true;
      this._saveSectionStates();
      this._applySectionState(sectionName);
    }
  }
  
  /**
   * Collapse a specific section
   * @param {string} sectionName - Name of section to collapse
   */
  collapseSection(sectionName) {
    if (this.sectionStates[sectionName]) {
      this.sectionStates[sectionName] = false;
      this._saveSectionStates();
      this._applySectionState(sectionName);
    }
  }
  
  /**
   * Apply expanded/collapsed state to a section's DOM
   * @param {string} sectionName - Name of section
   * @private
   */
  _applySectionState(sectionName) {
    const section = this._sectionsByName.get(sectionName);
    if (!section) return;
    
    const header = section.querySelector('.section-header');
    const isExpanded = this.sectionStates[sectionName];
    
    section.classList.toggle('expanded', isExpanded);
    header?.setAttribute('aria-expanded', isExpanded.toString());
  }
  
  /**
   * Apply all section states to DOM
   * @private
   */
  _applyAllSectionStates() {
    Object.keys(this.sectionStates).forEach(name => {
      this._applySectionState(name);
    });
  }
  
  /**
   * Handle first waypoint being added
   * @private
   */
  _onFirstWaypointAdded() {
    // Reset to default state (only Marker open)
    this.sectionStates = { ...DEFAULT_SECTION_STATE };
    this._saveSectionStates();
    this._updateUIState();
  }
  
  /**
   * Handle all waypoints being removed
   * @private
   */
  _onAllWaypointsRemoved() {
    this.hasSelection = false;
    this._updateUIState();
  }
  
  /**
   * Update UI state based on current waypoint/selection state
   * @private
   */
  _updateUIState() {
    if (!this.sectionsContainer || !this.helpPlaceholder || !this._sectionElements) return;
    
    if (!this.hasWaypoints) {
      // No waypoints: show help, hide sections
      this.helpPlaceholder.style.display = 'block';
      this._sectionElements.forEach(s => s.style.display = 'none');
    } else {
      // Has waypoints: hide help, show sections
      this.helpPlaceholder.style.display = 'none';
      this._sectionElements.forEach(s => s.style.display = 'block');
      
      // Apply section states
      this._applyAllSectionStates();
      
      // Apply last-interacted indicator
      this._applyLastInteractedIndicator();
      
      // Disable waypoint-dependent sections if no selection
      WAYPOINT_DEPENDENT_SECTIONS.forEach(sectionName => {
        const section = this._sectionsByName.get(sectionName);
        if (section) {
          section.classList.toggle('settings-disabled', !this.hasSelection);
        }
      });
    }
  }
  
  /**
   * Set help content HTML
   * @param {string} html - Help content HTML
   */
  setHelpContent(html) {
    if (this.helpPlaceholder) {
      this.helpPlaceholder.innerHTML = html;
    }
  }
  
  /**
   * Force refresh of UI state
   * Call this after external state changes
   */
  refresh() {
    this._updateUIState();
  }
}
