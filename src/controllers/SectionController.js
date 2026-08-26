/**
 * SectionController - Manages collapsible settings sections
 *
 * ## Features
 * - Expand/collapse sections independently (multiple can be open)
 * - Persist section state to localStorage
 * - Show help when no waypoints exist
 * - Scope switching (Phase 4 one-inspector): the sidebar shows the
 *   waypoint-scope cards when a waypoint is selected and the
 *   route-scope cards otherwise — the panel edits what's selected,
 *   so there is no disabled ghost state
 *
 * ## Section State
 * - On clear/no waypoints: Show help + Route scope (Background etc. stay usable)
 * - On first waypoint added: Reset card states (Marker open)
 * - On waypoint selected: Show waypoint scope
 * - On waypoint deselected: Show route scope
 *
 * @module SectionController
 */

const STORAGE_KEY = 'routePlotter_sectionState';
const LAST_KEY = 'routePlotter_lastSection';

/**
 * Default section states when no localStorage exists.
 * Waypoint scope opens on Marker; route scope opens on Pacing +
 * Background (the two entry points: tune timing, or start a project).
 * @type {Object<string, boolean>}
 */
const DEFAULT_SECTION_STATE = {
  // Waypoint scope
  marker: true,
  'on-arrival': false,
  label: false,
  leg: false,
  'area-highlight': false,
  // Route scope
  head: false,
  pacing: true,
  reveal: false,
  'path-emphasis': false,
  background: true,
  video: false,
  // Crowd scope (Dots + Release open: the look and the flow are what a
  // fresh crowd gets tuned first; Follow-route guide is already on)
  guide: false,
  dots: true,
  release: true,
  motion: false,
  // Network scopes (single card each — always open)
  node: true,
  edge: true
};

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

    /** @type {HTMLElement|null} Waypoint-scope card group */
    this.waypointScopeGroup = null;

    /** @type {HTMLElement|null} Route-scope card group */
    this.routeScopeGroup = null;

    /** @type {HTMLElement|null} Crowd-scope card group */
    this.crowdScopeGroup = null;

    /** @type {boolean} Whether a crowd layer is currently selected */
    this.hasCrowdSelection = false;

    /** @type {HTMLElement|null} Node-scope card group (network editing) */
    this.nodeScopeGroup = null;

    /** @type {HTMLElement|null} Edge-scope card group (network editing) */
    this.edgeScopeGroup = null;

    /** @type {string|null} Network selection kind: 'node' | 'edge' | null */
    this.networkSelection = null;
    
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
    this.waypointScopeGroup = document.getElementById('waypoint-scope');
    this.routeScopeGroup = document.getElementById('route-scope');
    this.crowdScopeGroup = document.getElementById('crowd-scope');
    this.nodeScopeGroup = document.getElementById('node-scope');
    this.edgeScopeGroup = document.getElementById('edge-scope');

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
    this._bindMoreDisclosures();
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
   * Give the native details element a deterministic keyboard path. Chromium's
   * default summary activation varies across embedded/automation surfaces, so
   * Enter and Space explicitly toggle the native `open` state while pointer
   * activation remains browser-owned.
   * @private
   */
  _bindMoreDisclosures() {
    const summaries = this.sectionsContainer.querySelectorAll('.section-more > summary');
    summaries.forEach(summary => {
      summary.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const disclosure = summary.parentElement;
        if (disclosure instanceof HTMLDetailsElement) {
          disclosure.open = !disclosure.open;
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

    // Multiple waypoints selected (shift/cmd-click, Cmd/Ctrl+A) — waypoint scope
    this.eventBus.on('waypoint:multi-selected', () => {
      this.hasSelection = true;
      this._updateUIState();
    });
    
    // Crowd layer selection (Phase 4 Crowd scope)
    this.eventBus.on('crowd:selected', () => {
      this.hasCrowdSelection = true;
      this._updateUIState();
    });

    this.eventBus.on('crowd:deselected', () => {
      this.hasCrowdSelection = false;
      this._updateUIState();
    });

    // Network node/edge selection — one more scope on the same skeleton,
    // available from either passive scene inspection or drawing mode.
    this.eventBus.on('network:node-selected', () => {
      this.networkSelection = 'node';
      this._updateUIState();
    });
    this.eventBus.on('network:node-deselected', () => {
      if (this.networkSelection === 'node') this.networkSelection = null;
      this._updateUIState();
    });
    this.eventBus.on('network:edge-selected', () => {
      this.networkSelection = 'edge';
      this._updateUIState();
    });
    this.eventBus.on('network:edge-deselected', () => {
      if (this.networkSelection === 'edge') this.networkSelection = null;
      this._updateUIState();
    });
    this.eventBus.on('network:edit-mode-changed', () => {
      // exit() emits the matching node/edge deselection itself. Keeping
      // selection ownership on those events also supports passive inspection.
      this._updateUIState();
    });

    this.eventBus.on('project:replaced', () => {
      // The commit replaced every selectable object. Failed project loads do
      // not emit this event, so their still-live inspector state is preserved.
      this.hasSelection = false;
      this.hasCrowdSelection = false;
      this.networkSelection = null;
      this._updateUIState();
    });

    // Clear all
    this.eventBus.on('app:cleared', () => {
      this.hasWaypoints = false;
      this.hasSelection = false;
      this.hasCrowdSelection = false;
      this._onAllWaypointsRemoved();
    });

    // Flash a card to direct the eye (e.g. clicking a route leg on the
    // canvas flashes the Leg card that owns it). Expands the section
    // first — a flash on a collapsed card teaches nothing.
    this.eventBus.on('section:flash', ({ section }) => {
      this.flashSection(section);
    });
  }

  /**
   * Expand a section, scroll it into view, and run its flash animation.
   * Selection events may rebuild sidebar state in the same tick, so the
   * scroll/flash is deferred a frame to target the settled DOM.
   * @param {string} sectionName - Name of section to flash
   */
  flashSection(sectionName) {
    this.expandSection(sectionName);
    requestAnimationFrame(() => {
      const section = this._sectionsByName.get(sectionName) ||
        document.querySelector(`.settings-section[data-section="${sectionName}"]`);
      if (!section) return;
      section.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      // Restart the animation if it's already running
      section.classList.remove('section-flash');
      void section.offsetWidth;
      section.classList.add('section-flash');
      section.addEventListener('animationend', () => {
        section.classList.remove('section-flash');
      }, { once: true });
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
   * Update UI state based on current waypoint/selection state.
   * Scope rule (Phase 4): a selection shows the waypoint-scope cards;
   * no selection shows the route-scope cards. With no waypoints at all
   * the help placeholder sits above the route scope, so Background and
   * the other route settings stay reachable before the first click.
   * @private
   */
  _updateUIState() {
    if (!this.sectionsContainer || !this.helpPlaceholder || !this._sectionElements) return;

    // Help placeholder only while the canvas is empty
    this.helpPlaceholder.style.display = this.hasWaypoints ? 'none' : 'block';

    // Scope switch — the panel edits what's selected: a network node or
    // edge (passively inspected or in drawing mode), a crowd, a waypoint, or
    // (nothing selected) the route
    const nodeScope = this.networkSelection === 'node';
    const edgeScope = this.networkSelection === 'edge';
    const crowdScope = !nodeScope && !edgeScope && this.hasCrowdSelection;
    const waypointScope = !nodeScope && !edgeScope && !crowdScope &&
                          this.hasWaypoints && this.hasSelection;
    if (this.nodeScopeGroup) this.nodeScopeGroup.hidden = !nodeScope;
    if (this.edgeScopeGroup) this.edgeScopeGroup.hidden = !edgeScope;
    if (this.crowdScopeGroup) this.crowdScopeGroup.hidden = !crowdScope;
    if (this.waypointScopeGroup) this.waypointScopeGroup.hidden = !waypointScope;
    if (this.routeScopeGroup) this.routeScopeGroup.hidden =
      nodeScope || edgeScope || crowdScope || waypointScope;

    // Apply section states + last-interacted indicator
    this._applyAllSectionStates();
    this._applyLastInteractedIndicator();
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
