/**
 * UIController - Manages all UI interactions and updates
 * Handles waypoint list, editor controls, tabs, and animation controls
 */

import { RENDERING, ANIMATION, MOTION, AREA_HIGHLIGHT, PATH_VISIBILITY, BACKGROUND_VISIBILITY } from '../config/constants.js';
import { getInlineHelpHTML, getSplashHelpHTML } from '../config/helpContent.js';
import { MotionVisibilityService } from '../services/MotionVisibilityService.js';
import { createFocusTrap } from '../utils/focusTrap.js';
import { VideoExporter } from '../services/VideoExporter.js';
import { pathWidthToSlider } from '../utils/pathWidthScale.js';
import { buildRouteNumbering } from '../utils/waypointNaming.js';
import { resolveRouteBranches } from '../utils/routeBranches.js';
import {
  formatBackgroundOverlay,
  formatRendererPixels,
  setRangeReadout,
} from '../utils/uiReadouts.js';

/**
 * Logarithmic speed curve for perceptually uniform slider control
 * Maps linear slider position (1-4000) to exponential speed values
 * This gives fine control at low speeds while allowing high speeds
 */
/**
 * What a branch row says to a screen reader. Indentation and the visible
 * "branch" tag carry this visually; this carries it for anyone who perceives
 * neither (WCAG 2.2 1.3.1).
 */
function branchRowContext(entry, rejoinName) {
  const fork = entry.forkNumber && entry.forkNumber !== '?'
    ? `waypoint ${entry.forkNumber}`
    : 'an earlier waypoint';
  const ending = rejoinName
    ? `, rejoins at ${rejoinName}`
    : ', ends the branch here';
  return `, branch ${entry.branchLetter} leaving ${fork}${ending}`;
}

const SPEED_CURVE = {
  MIN_SLIDER: 1,
  MAX_SLIDER: 4000,
  MIN_SPEED: 1,      // px/s at slider minimum
  MAX_SPEED: 4000,   // px/s at slider maximum
};

/**
 * Segment speed slider configuration
 * Logarithmic scale centered at 1.0x (slider midpoint = default speed)
 * Symmetric log ranges: left = slow down, right = speed up
 * 
 * Range: 0.1x to 10x, center at 1.0x
 * Left half:  slider 0-500  → 0.1x to 1.0x (slow down)
 * Right half: slider 500-1000 → 1.0x to 10x (speed up)
 */
const SEGMENT_SPEED = {
  MIN_SPEED: 0.1,    // 0.1x = 10× slower than normal
  MAX_SPEED: 10.0,   // 10x = 10× faster than normal
  CENTER: 1.0,       // 1.0x = normal speed (slider midpoint)
  SLIDER_CENTER: 500,
  SLIDER_MAX: 1000,
};

/**
 * Convert linear slider value to logarithmic speed
 * Slider is labeled "Duration" so polarity is inverted:
 * - Left (low value) = short duration = HIGH speed
 * - Right (high value) = long duration = LOW speed
 * @param {number} sliderValue - Linear slider position (1-4000)
 * @returns {number} Speed in px/s with log curve applied
 */
function sliderToSpeed(sliderValue) {
  const { MIN_SLIDER, MAX_SLIDER, MIN_SPEED, MAX_SPEED } = SPEED_CURVE;
  // Normalize to 0-1 range, then INVERT for duration polarity
  const normalized = 1 - (sliderValue - MIN_SLIDER) / (MAX_SLIDER - MIN_SLIDER);
  // Apply exponential curve: speed = min * (max/min)^normalized
  // This gives logarithmic perception
  const speed = MIN_SPEED * Math.pow(MAX_SPEED / MIN_SPEED, normalized);
  return Math.round(speed);
}

/**
 * Convert logarithmic speed back to linear slider value
 * Inverted polarity: high speed = low slider (short duration on left)
 * @param {number} speed - Speed in px/s
 * @returns {number} Linear slider position (1-4000)
 */
function speedToSlider(speed) {
  const { MIN_SLIDER, MAX_SLIDER, MIN_SPEED, MAX_SPEED } = SPEED_CURVE;
  // Clamp speed to valid range
  const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
  // Reverse the exponential: normalized = log(speed/min) / log(max/min)
  const normalized = Math.log(clampedSpeed / MIN_SPEED) / Math.log(MAX_SPEED / MIN_SPEED);
  // Convert back to slider range, then INVERT for duration polarity
  return Math.round(MIN_SLIDER + (1 - normalized) * (MAX_SLIDER - MIN_SLIDER));
}

// ============================================================================
// CONDITIONAL VISIBILITY UTILITIES
// ============================================================================

/**
 * Visibility condition registry for conditional UI elements
 * Maps element IDs to their visibility conditions
 * 
 * Usage:
 * - Register conditions with registerVisibilityCondition()
 * - Update visibility with updateConditionalVisibility()
 * - Supports multiple condition types: 'equals', 'notEquals', 'in', 'notIn'
 * 
 * @type {Map<string, {element: HTMLElement, condition: Object}>}
 */
const visibilityRegistry = new Map();

/**
 * Register a conditional visibility rule for a UI element
 * 
 * @param {string} elementId - ID of the element to show/hide
 * @param {Object} condition - Visibility condition
 * @param {string} condition.dependsOn - ID of the element this depends on (e.g., dropdown)
 * @param {string} condition.type - Condition type: 'equals', 'notEquals', 'in', 'notIn'
 * @param {*} condition.value - Value(s) to compare against
 * 
 * @example
 * // Show ripple controls when beacon style is 'ripple'
 * registerVisibilityCondition('ripple-controls', {
 *   dependsOn: 'editor-beacon-style',
 *   type: 'equals',
 *   value: 'ripple'
 * });
 */
function registerVisibilityCondition(elementId, condition) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`[Visibility] Element not found: ${elementId}`);
    return;
  }
  visibilityRegistry.set(elementId, { element, condition });
}

/**
 * Update visibility of all registered elements that depend on a specific control
 * 
 * @param {string} dependsOnId - ID of the control that changed
 * @param {*} currentValue - Current value of the control
 */
function updateConditionalVisibility(dependsOnId, currentValue) {
  for (const [elementId, { element, condition }] of visibilityRegistry) {
    if (condition.dependsOn !== dependsOnId) continue;
    
    let shouldShow = false;
    switch (condition.type) {
      case 'equals':
        shouldShow = currentValue === condition.value;
        break;
      case 'notEquals':
        shouldShow = currentValue !== condition.value;
        break;
      case 'in':
        shouldShow = Array.isArray(condition.value) && condition.value.includes(currentValue);
        break;
      case 'notIn':
        shouldShow = Array.isArray(condition.value) && !condition.value.includes(currentValue);
        break;
    }
    
    element.style.display = shouldShow ? '' : 'none';
  }
}

/**
 * UIController - Manages all UI interactions and state
 * 
 * ## Responsibilities
 * - Waypoint list rendering and interaction (selection, renaming, reordering)
 * - Waypoint editor panel (single waypoint or "all waypoints" mode)
 * - Animation transport controls (play, pause, seek)
 * - Tab switching and general settings
 * 
 * ## Multi-select
 * Selection is a set (`selectedWaypoints`) with a primary waypoint
 * (`selectedWaypoint`, the last one clicked). List gestures: click =
 * single, Cmd/Ctrl+click = toggle, Shift+click = range. Cards populate
 * from the primary; the app's DOM wiring writes changes to every
 * selected waypoint (the old hidden "All Waypoints" bulk mode dissolved
 * into this — Phase 4). Label text stays per-waypoint (hidden in multi).
 *
 * ## Performance Considerations
 * - Waypoint list uses event delegation where possible
 * - Display indices are pre-calculated by main.js (O(n) once, O(1) lookup)
 * - Modal elements are cached on init, not queried repeatedly
 * 
 * @class
 */
export class UIController {
  /**
   * @param {Object} elements - DOM element references
   * @param {EventBus} eventBus - Application event bus for decoupled communication
   */
  constructor(elements, eventBus) {
    this.elements = elements;
    this.eventBus = eventBus;
    
    /** @type {Object|null} Currently selected waypoint (primary selection) */
    this.selectedWaypoint = null;
    
    /** @type {Set<Object>} Set of selected waypoints for multi-select */
    this.selectedWaypoints = new Set();
    
    /** @type {number|null} Last selected waypoint index for shift-click range selection */
    this._lastSelectedIndex = null;
    this._listedWaypoints = [];
    this._listedNumbering = [];
    this._draggingBlock = null;
    
    // Trail and playback state for display updates
    /** @private */
    this._currentTrailFraction = MOTION.PATH_TRAIL_DEFAULT;
    /** @private */
    this._currentPlaybackSpeed = 1;
    
    // Double-click rename detection — survives DOM rebuilds by tracking at instance level.
    // Standard dblclick events break because selectWaypoint rebuilds the DOM between clicks.
    /** @private @type {number} Timestamp of last waypoint row click */
    this._renameLastClickTime = 0;
    /** @private @type {Object|null} Waypoint from last row click */
    this._renameLastClickWaypoint = null;
    
    // Waypoints in route order, cached from updateWaypointList so the
    // scope chip and Leg card header can name neighbours without a
    // round-trip to main.js
    /** @private @type {Array<Object>} */
    this._waypointsCache = [];

    // Bind methods that are passed as callbacks
    this.updateWaypointList = this.updateWaypointList.bind(this);
    this.updateWaypointEditor = this.updateWaypointEditor.bind(this);
    this.syncAnimationControls = this.syncAnimationControls.bind(this);

    this.setupEventListeners();
    this._setupCodecModal();
    this._registerConditionalVisibility();
    this._setupScopeChip();
  }

  /**
   * Wire the inspector's scope chip (Phase 4 one-inspector).
   * Prev/next step the selection through Route → Waypoint 1 → … → last:
   * prev from the first waypoint deselects back to Route scope, and next
   * from Route scope selects the first waypoint. Selection changes flow
   * through the normal waypoint:selected / waypoint:deselected events.
   * @private
   */
  _setupScopeChip() {
    this._scopeChip = document.getElementById('scope-chip');
    this._scopeChipText = document.getElementById('scope-chip-text');
    this._scopeRouteBtn = document.getElementById('scope-route-btn');
    this._scopePrevBtn = document.getElementById('scope-prev-btn');
    this._scopeNextBtn = document.getElementById('scope-next-btn');

    this._scopeRouteBtn?.addEventListener('click', () => {
      if (this.selectedWaypoint || this.selectedWaypoints.size > 0) {
        this.eventBus.emit('waypoint:deselected');
      }
    });
    this._scopePrevBtn?.addEventListener('click', () => this._navigateScope(-1));
    this._scopeNextBtn?.addEventListener('click', () => this._navigateScope(1));

    // Crowd scope (Phase 4): the chip names the selected crowd layer.
    // Crowds sit outside the Route ↔ waypoints step cycle.
    this._selectedCrowd = null;
    const chipRefresh = () => this._updateScopeChip(this.selectedWaypoint,
      this.selectedWaypoints.size > 1 ? [...this.selectedWaypoints] : null);
    this.eventBus.on('crowd:selected', (layer) => {
      this._selectedCrowd = layer;
      chipRefresh();
    });
    this.eventBus.on('crowd:deselected', () => {
      this._selectedCrowd = null;
      chipRefresh();
    });

    // Network node/edge scopes — the crowd family's green, with the chip
    // naming either a passively inspected item or what the pen selected.
    this._networkSelection = null;
    this.eventBus.on('network:node-selected', ({ node }) => {
      this._networkSelection = { kind: 'node', node };
      chipRefresh();
    });
    this.eventBus.on('network:node-deselected', () => {
      if (this._networkSelection?.kind === 'node') this._networkSelection = null;
      chipRefresh();
    });
    this.eventBus.on('network:edge-selected', ({ edge }) => {
      this._networkSelection = { kind: 'edge', edge };
      chipRefresh();
    });
    this.eventBus.on('network:edge-deselected', () => {
      if (this._networkSelection?.kind === 'edge') this._networkSelection = null;
      chipRefresh();
    });
    this.eventBus.on('network:edit-mode-changed', () => {
      // exit() publishes a node/edge deselection first; passive inspection
      // must not otherwise be coupled to the drawing mode flag.
      chipRefresh();
    });
    this.eventBus.on('project:replaced', () => {
      // A successful load replaces every canonical object. Discard transient
      // references from the previous project only after that commit boundary.
      this._selectedCrowd = null;
      this._networkSelection = null;
      this.setSelection([], null);
      chipRefresh();
    });
  }

  /**
   * Step the inspector selection along the route.
   * @param {number} delta - -1 for previous, +1 for next
   * @private
   */
  _navigateScope(delta) {
    const waypoints = this._waypointsCache;
    if (!waypoints.length) return;

    // Multi-select has no meaningful order to step through
    if (this.selectedWaypoints.size > 1) return;

    if (!this.selectedWaypoint) {
      // Route scope: next enters the route at Waypoint 1
      if (delta > 0) this.eventBus.emit('waypoint:selected', waypoints[0]);
      return;
    }

    const index = waypoints.indexOf(this.selectedWaypoint);
    if (index === -1) return;

    if (delta < 0) {
      if (index === 0) {
        this.eventBus.emit('waypoint:deselected');
      } else {
        this.eventBus.emit('waypoint:selected', waypoints[index - 1]);
      }
    } else if (index < waypoints.length - 1) {
      this.eventBus.emit('waypoint:selected', waypoints[index + 1]);
    }
  }

  /**
   * Human-readable name for a waypoint, as used by the scope chip and
   * the Leg card header ("Waypoint 2 'Library'", "minor waypoint").
   * @param {Object} waypoint
   * @returns {string}
   * @private
   */
  _waypointDisplayName(waypoint) {
    if (!waypoint) return '';
    // Number through the shared routing so the chip, the list row and the
    // semantic outline never name the same waypoint differently. `_displayIndex`
    // counts majors, which called a branch waypoint "Waypoint 3" while its row
    // read "2·B1" (ROUTE-01c).
    const index = (this._listedWaypoints || []).indexOf(waypoint);
    const entry = index === -1 ? null : this._listedNumbering?.[index];

    if (entry?.branchId) {
      const base = `Waypoint ${entry.displayNumber}`;
      const name = waypoint.name || waypoint.label;
      return name ? `${base} '${name}'` : base;
    }
    if (waypoint.isMajor) {
      const base = `Waypoint ${entry?.displayNumber ?? waypoint._displayIndex ?? '?'}`;
      const name = waypoint.name || waypoint.label;
      return name ? `${base} '${name}'` : base;
    }
    return waypoint.name ? `minor '${waypoint.name}'` : 'minor waypoint';
  }

  /**
   * Sync the scope chip (text, colour scope, prev/next state) with the
   * current selection. Called from updateWaypointEditor so every
   * selection path updates it.
   * @param {Object|null} waypoint - Selected waypoint (single selection)
   * @param {Array<Object>|null} multiSelect - Multi-select set, if any
   * @private
   */
  _updateScopeChip(waypoint, multiSelect) {
    if (!this._scopeChip) return;

    const isMultiSelect = multiSelect && multiSelect.length > 1;
    let scope, text;
    if (this._networkSelection) {
      // Network scopes wear the crowd family's tint — the node/edge
      // belongs to the selected crowd's network
      scope = 'crowd';
      if (this._networkSelection.kind === 'node') {
        const type = this._networkSelection.node?.type;
        text = `Editing · Node · ${type === 'normal' ? 'pass-through' : type}`;
      } else {
        text = `Editing · Edge · ${this._networkSelection.edge?.direction}`;
      }
    } else if (this._selectedCrowd) {
      scope = 'crowd';
      text = `Editing · ${this._selectedCrowd.name} · crowd`;
    } else if (isMultiSelect) {
      // The list shows majors only, so name any invisible minors in the
      // count ("5 waypoints (2 minor)") rather than leaving them silent
      scope = 'multi';
      const minors = multiSelect.filter(wp => !wp.isMajor).length;
      text = `Editing · ${multiSelect.length} waypoints${minors > 0 ? ` (${minors} minor)` : ''}`;
    } else if (waypoint) {
      scope = 'waypoint';
      const chipIndex = (this._listedWaypoints || []).indexOf(waypoint);
      const chipEntry = chipIndex === -1 ? null : this._listedNumbering?.[chipIndex];
      const kind = chipEntry?.branchId
        ? ` · branch ${chipEntry.branchLetter}`
        : (waypoint.isMajor ? ' · major' : '');
      text = `Editing · ${this._waypointDisplayName(waypoint)}${kind}`;
    } else {
      scope = 'route';
      text = 'Editing · Route';
    }

    this._scopeChip.dataset.scope = scope;
    if (this._scopeChipText) this._scopeChipText.textContent = text;
    if (this._scopeRouteBtn) {
      this._scopeRouteBtn.disabled = scope !== 'waypoint' && scope !== 'multi';
    }

    // Prev/next stepping: only meaningful in single-selection or route
    // scope — crowds sit outside the step cycle
    const waypoints = this._waypointsCache;
    const index = waypoint ? waypoints.indexOf(waypoint) : -1;
    const steppable = !this._selectedCrowd && !isMultiSelect && waypoints.length > 0;
    if (this._scopePrevBtn) {
      // From Waypoint 1, prev backs out to Route scope
      this._scopePrevBtn.disabled = !steppable || !waypoint;
    }
    if (this._scopeNextBtn) {
      this._scopeNextBtn.disabled = !steppable || (waypoint ? index >= waypoints.length - 1 : false);
    }
  }

  /**
   * Name the segment-ownership rule in the Leg card header:
   * "Leg → Waypoint 3 'Chapel'" for the segment leaving the selected
   * waypoint, or "Leg → route end" on the final waypoint.
   * @param {Object|null} waypoint - Selected waypoint
   * @private
   */
  _updateLegSectionTitle(waypoint) {
    const titleEl = document.getElementById('leg-section-title');
    if (!titleEl) return;

    if (!waypoint) {
      titleEl.textContent = 'Leg';
      return;
    }

    const waypoints = this._waypointsCache;
    const index = waypoints.indexOf(waypoint);
    const next = index >= 0 ? waypoints[index + 1] : null;
    titleEl.textContent = next
      ? `Leg → ${this._waypointDisplayName(next)}`
      : 'Leg → route end';
  }
  
  /**
   * Register conditional visibility rules for beacon-specific controls
   * These rules automatically show/hide controls based on dropdown selections
   * @private
   */
  _registerConditionalVisibility() {
    // Ripple controls: show when beacon style is 'ripple'
    registerVisibilityCondition('ripple-controls', {
      dependsOn: 'editor-beacon-style',
      type: 'equals',
      value: 'ripple'
    });
    
    // Pulse controls: show when beacon style is 'pulse'
    registerVisibilityCondition('pulse-controls', {
      dependsOn: 'editor-beacon-style',
      type: 'equals',
      value: 'pulse'
    });
  }
  
  /**
   * Setup modal for codec-unsupported warning (MP4 → WebM fallback).
   * Supports two modes:
   * - "no H.264": only WebM or Cancel
   * - "resolution too large": MP4 at reduced res, WebM at full res, or Cancel
   * @private
   */
  _setupCodecModal() {
    this._codecModal = document.getElementById('codec-unsupported-modal');
    this._codecTitle = document.getElementById('modal-title-codec');
    this._codecMessage = document.getElementById('codec-modal-message');
    this._codecMp4Btn = document.getElementById('codec-mp4-reduced');
    this._codecWebmBtn = document.getElementById('codec-webm');
    const cancelBtn = document.getElementById('codec-cancel');
    const closeXBtn = this._codecModal?.querySelector('[data-modal-close]');
    
    if (!this._codecModal || !this._codecWebmBtn || !cancelBtn) return;
    
    this._codecFocusTrap = createFocusTrap(this._codecModal);
    
    const closeModal = () => {
      this._codecModal.style.display = 'none';
      this._codecFocusTrap.deactivate();
    };
    
    this._codecWebmBtn.addEventListener('click', () => {
      closeModal();
      this.eventBus.emit('video:export-request', 'webm');
    });
    
    this._codecMp4Btn?.addEventListener('click', () => {
      closeModal();
      // Apply the reduced resolution stored when modal was configured
      if (this._codecReducedRes) {
        this.eventBus.emit('video:resolution-change', {
          width: this._codecReducedRes.w,
          height: this._codecReducedRes.h
        });
      }
      this.eventBus.emit('video:export-request', 'mp4');
    });
    
    cancelBtn.addEventListener('click', () => closeModal());
    closeXBtn?.addEventListener('click', () => closeModal());
    
    this._codecModal.addEventListener('click', (e) => {
      if (e.target === this._codecModal) closeModal();
    });
    
    this._codecModal.addEventListener('focustrap:escape', () => closeModal());
  }
  
  /**
   * Show the codec-unsupported modal configured for the appropriate scenario.
   * @param {Object} [opts] - Options for the modal
   * @param {number} [opts.fullW] - Full export width
   * @param {number} [opts.fullH] - Full export height
   * @param {number} [opts.reducedW] - Reduced MP4-compatible width (if available)
   * @param {number} [opts.reducedH] - Reduced MP4-compatible height (if available)
   * @private
   */
  _showCodecModal(opts) {
    if (!this._codecModal) return;
    
    if (opts?.reducedW && opts?.reducedH) {
      // Resolution too large — offer MP4 at reduced res or WebM at full res
      this._codecTitle.textContent = 'MP4 resolution too large';
      this._codecMessage.textContent =
        `H.264 encoding does not support ${opts.fullW}\u00d7${opts.fullH} on this device. ` +
        `You can export MP4 at a reduced resolution, or export as WebM at full resolution.`;
      this._codecMp4Btn.textContent = `Export MP4 at ${opts.reducedW}\u00d7${opts.reducedH}`;
      this._codecMp4Btn.style.display = '';
      this._codecWebmBtn.textContent = `Export WebM at ${opts.fullW}\u00d7${opts.fullH}`;
      this._codecReducedRes = { w: opts.reducedW, h: opts.reducedH };
    } else {
      // No H.264 support at all
      this._codecTitle.textContent = 'MP4 export unavailable';
      this._codecMessage.textContent =
        'Your browser does not support H.264 encoding, which is required for MP4 export. ' +
        'You can export as WebM instead \u2014 most video players and editors support this format.';
      this._codecMp4Btn.style.display = 'none';
      this._codecWebmBtn.textContent = 'Export as WebM';
      this._codecReducedRes = null;
    }
    
    this._codecModal.style.display = 'flex';
    this._codecFocusTrap?.activate();
  }
  
  /**
   * Get display index for a waypoint (1-based, major waypoints only)
   * @param {Object} waypoint - Waypoint to find index for
   * @returns {number} 1-based display index
   * @private
   */
  _getWaypointDisplayIndex(waypoint) {
    // This is called from updateWaypointEditor, we need to find the waypoint's index
    // We'll emit an event to get the waypoints array from main.js
    // For now, return a placeholder - the actual index will be set by main.js
    return waypoint._displayIndex || '?';
  }
  
  /**
   * Adopt a selection decided outside the list (canvas toggle, Cmd+A,
   * undo restore). Keeps the gesture bookkeeping — the Set, the primary,
   * the shift-range anchor — coherent without emitting selection events;
   * the caller (main.js) already owns the event flow.
   * @param {Array<Object>} waypoints - Full selection, route order
   * @param {Object|null} primary - Primary waypoint (last interacted)
   */
  setSelection(waypoints, primary) {
    this.selectedWaypoints = new Set(waypoints);
    this.selectedWaypoint = primary || null;
    // Anchor into the displayed route, not the majors subset: since UI-02 the
    // list shows minors too, so a shift-range must start where the row is.
    const anchor = primary && this._listedWaypoints
      ? this._listedWaypoints.indexOf(primary) : -1;
    this._lastSelectedIndex = anchor >= 0 ? anchor : null;
  }

  /**
   * Switch to the Waypoint Settings tab in the right sidebar.
   * Called when a waypoint is selected from the list.
   * Now handled by SectionController via events.
   * @private
   * @deprecated Tabs replaced with collapsible sections
   */
  _switchToWaypointTab() {
    // No-op: SectionController handles section state via events
  }
  
  /**
   * Waypoints the pause/speed/area controls below should write to:
   * the multi-selection when one exists, else the single selection.
   * Mirrors selectionTargets() on the app side (editorPanel mixin),
   * which serves the DOM-wired controls.
   * @param {boolean} [majorsOnly=false] - Filter to major waypoints
   * @returns {Array<Object>}
   * @private
   */
  _bulkTargets(majorsOnly = false) {
    const targets = this.selectedWaypoints.size > 0
      ? [...this.selectedWaypoints]
      : (this.selectedWaypoint ? [this.selectedWaypoint] : []);
    return majorsOnly ? targets.filter(wp => wp.isMajor) : targets;
  }

  /**
   * Format trail display showing percentage (1-100% UI range).
   * Actual trail fraction is 4x the displayed percentage.
   * @param {number} trailFraction - Trail as fraction of sequence (0-4.0)
   * @returns {string} Formatted display string
   * @private
   */
  _formatTrailDisplay(trailFraction) {
    if (trailFraction === 0) return 'Off';
    // Display as 1-100% even though actual range is 0.04-4.0
    const displayPercent = (trailFraction / MOTION.PATH_TRAIL_MAX) * 100;
    return MotionVisibilityService.formatUIValue(displayPercent, '%');
  }
  
  /**
   * Update trail display with current values.
   * @private
   */
  _updateTrailDisplay() {
    if (this.elements.pathTrailValue) {
      this.elements.pathTrailValue.textContent = this._formatTrailDisplay(this._currentTrailFraction);
    }
  }
  
  /**
   * Set trail value (for loading saved state).
   * @param {number} trailFraction - Trail as fraction of sequence (0-1)
   */
  setTrailValue(trailFraction) {
    this._currentTrailFraction = trailFraction;
    this._updateTrailDisplay();
  }
  
  // ========== TRAIL SLIDER CONVERSION ==========
  // Uses ^5 power curve for more control in lower range
  // UI displays 0-100%, actual values are 0-400% of path duration
  
  /**
   * Convert slider value (0-1000) to trail fraction.
   * 
   * Uses a ^5 power curve to provide fine-grained control in the lower range
   * where most useful trail values exist.
   * 
   * ## Mapping
   * - Slider 0 → OFF (trail disabled)
   * - Slider 500 (50%) → ~3% of max → ~0.16 fraction
   * - Slider 1000 (100%) → 100% of max → 4.0 fraction
   * 
   * ## Why ^5?
   * Most useful trail values are 1-20% of path duration. The ^5 curve
   * dedicates ~80% of slider range to this region.
   * 
   * @param {number} sliderValue - Slider value (0-1000)
   * @returns {number} Trail fraction (0 or 0.04-4.0)
   */
  sliderToTrailFraction(sliderValue) {
    if (sliderValue === 0) return 0; // OFF
    const normalized = (sliderValue - 1) / 999; // 0-1 for slider 1-1000
    const curved = Math.pow(normalized, 5);     // ^5 power curve
    return MOTION.PATH_TRAIL_MIN + curved * (MOTION.PATH_TRAIL_MAX - MOTION.PATH_TRAIL_MIN);
  }
  
  /**
   * Convert trail fraction to slider value (0-1000).
   * Inverse of sliderToTrailFraction using fifth root.
   * 
   * @param {number} trailFraction - Trail fraction (0 or 0.04-4.0)
   * @returns {number} Slider value (0-1000)
   */
  trailFractionToSlider(trailFraction) {
    if (trailFraction === 0) return 0; // OFF
    const range = MOTION.PATH_TRAIL_MAX - MOTION.PATH_TRAIL_MIN;
    const normalized = (trailFraction - MOTION.PATH_TRAIL_MIN) / range;
    const curved = Math.pow(normalized, 0.2);   // ^(1/5) = fifth root
    return Math.round(1 + curved * 999);
  }
  
  /**
   * Set playback speed (for loading saved state).
   * @param {number} speed - Playback speed multiplier
   */
  setPlaybackSpeed(speed) {
    this._currentPlaybackSpeed = speed;
    this._updateTrailDisplay();
  }
  
  /**
   * Set up all UI event listeners
   */
  setupEventListeners() {
    console.debug('🔧 [UIController] Setting up event listeners');
    // Note: Tab switching removed - now using collapsible sections via SectionController
    
    // Background controls
    this.elements.bgUploadBtn?.addEventListener('click', () => {
      this.elements.bgUpload.click();
    });
    
    this.elements.bgUpload?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) {
        this.eventBus.emit('background:upload', file);
      }
    });
    
    // Background tint (log2 scaled for fine control near 0)
    this.elements.bgOverlay?.addEventListener('input', (e) => {
      const sliderValue = parseInt(e.target.value);
      const tintValue = MotionVisibilityService.bipolarSliderToLog2Value(
        sliderValue,
        MOTION.TINT_MIN,
        MOTION.TINT_MAX
      );
      setRangeReadout(
        this.elements.bgOverlay,
        this.elements.bgOverlayValue,
        formatBackgroundOverlay(tintValue)
      );
      this.eventBus.emit('background:overlay-change', tintValue);
    });
    
    this.elements.bgFitToggle?.addEventListener('click', () => {
      const currentMode = this.elements.bgFitToggle.dataset.mode;
      const newMode = currentMode === 'fit' ? 'fill' : 'fit';
      this.elements.bgFitToggle.dataset.mode = newMode;
      this.elements.bgFitToggle.textContent = newMode === 'fit' ? 'Fit' : 'Fill';
      this.eventBus.emit('background:mode-change', newMode);
    });
    
    // Animation controls
    this.elements.playBtn?.addEventListener('click', () => {
      this.eventBus.emit('ui:animation:play');
    });
    
    this.elements.pauseBtn?.addEventListener('click', () => {
      this.eventBus.emit('ui:animation:pause');
    });
    
    this.elements.skipStartBtn?.addEventListener('click', () => {
      this.eventBus.emit('ui:animation:skip-start');
    });
    
    this.elements.skipEndBtn?.addEventListener('click', () => {
      this.eventBus.emit('ui:animation:skip-end');
    });
    
    this.elements.timelineSlider?.addEventListener('input', (e) => {
      const progress = e.target.value / ANIMATION.TIMELINE_RESOLUTION;
      this.eventBus.emit('ui:animation:seek', progress);
    });
    
    /**
     * Animation speed slider with feedback loop prevention
     * Uses multiple checks to distinguish between user input and programmatic updates
     * to avoid circular event chains when slider value is set by code
     */
    let isUpdatingSlider = false;
    
    // Helper to handle speed slider input (shared by both sliders)
    const handleSpeedSliderInput = (e) => {
      const currentValue = parseInt(e.target.value);
      
      // Check if this is a programmatic change
      if (isUpdatingSlider) {
        return;
      }
      
      // Apply logarithmic curve for perceptually uniform speed control
      const speed = sliderToSpeed(currentValue);
      this.eventBus.emit('animation:speed-change', speed);
      
      // Sync the other slider
      const otherSlider = e.target.id === 'animation-speed' 
        ? this.elements.animationSpeedRight 
        : this.elements.animationSpeed;
      const otherValue = e.target.id === 'animation-speed'
        ? this.elements.animationSpeedValueRight
        : this.elements.animationSpeedValue;
      if (otherSlider) {
        otherSlider.value = currentValue;
      }
    };
    
    this.elements.animationSpeed?.addEventListener('input', handleSpeedSliderInput);
    this.elements.animationSpeedRight?.addEventListener('input', handleSpeedSliderInput);
    
    /**
     * Listen for programmatic slider updates from other parts of the app
     * Temporarily sets flag to prevent the input event from firing
     * Rounds speed to nearest step value (5) to prevent snap-back
     * @param {number} speed - The speed value to set on the slider
     */
    this.eventBus.on('ui:slider:update-speed', (speed) => {
      // Convert speed back to slider position using inverse log curve
      const sliderValue = speedToSlider(speed);
      
      // Set protection and update both sliders
      isUpdatingSlider = true;
      if (this.elements.animationSpeed) this.elements.animationSpeed.value = sliderValue;
      if (this.elements.animationSpeedRight) this.elements.animationSpeedRight.value = sliderValue;
      
      // Clear protection after brief delay to ensure queued events are blocked
      setTimeout(() => { 
        isUpdatingSlider = false;
      }, 50);
    });
    
    // Clear button — destructive confirmation uses the shared modal focus
    // pattern: safe initial focus, inert background, Escape, and restoration.
    const clearModal = document.getElementById('clear-confirm-modal');
    const clearConfirmBtn = document.getElementById('clear-confirm');
    const clearCancelBtn = document.getElementById('clear-cancel');
    const clearReturnFocus = document.getElementById('file-dropdown-btn');
    if (clearModal) {
      this._clearFocusTrap = createFocusTrap(clearModal);
      const closeClearModal = () => {
        clearModal.style.display = 'none';
        this._clearFocusTrap.deactivate();
      };
      clearConfirmBtn?.addEventListener('click', () => {
        closeClearModal();
        this.eventBus.emit('waypoints:clear-all');
      });
      clearCancelBtn?.addEventListener('click', closeClearModal);
      clearModal.addEventListener('click', (e) => {
        if (e.target === clearModal) closeClearModal();
      });
      clearModal.addEventListener('focustrap:escape', closeClearModal);
    }
    this.elements.clearBtn?.addEventListener('click', () => {
      if (!clearModal) {
        this.eventBus.emit('waypoints:clear-all');
        return;
      }
      clearModal.style.display = 'flex';
      // Dropdown.js closes the File menu later in this click dispatch. Wait
      // until that listener has restored the menu trigger, then establish the
      // modal trap with the stable trigger as its explicit return target.
      queueMicrotask(() => {
        if (clearModal.style.display !== 'none') {
          this._clearFocusTrap.activate(clearCancelBtn, clearReturnFocus);
        }
      });
    });
    
    // Help button
    this.elements.helpBtn?.addEventListener('click', () => {
      this.showHelp();
    });
    
    // Export MP4 button — cascading H.264 probe at actual export dimensions
    this.elements.exportMp4Btn?.addEventListener('click', async () => {
      const w = parseInt(this.elements.exportResX?.value) || 1920;
      const h = parseInt(this.elements.exportResY?.value) || 1080;
      console.log(`🎬 [Export] MP4 probe at ${w}×${h}`);
      
      // 1. Probe at actual export dimensions
      const fullConfig = await VideoExporter._testWebCodecsConfig(
        w, h, undefined, undefined, 'mp4'
      );
      if (fullConfig) {
        this.eventBus.emit('video:export-request', 'mp4');
        return;
      }
      
      // 2. H.264 failed at full res — try a reduced resolution.
      //    Always attempt a fallback before declaring H.264 unsupported,
      //    since autosaved dimensions from a previous session may exceed
      //    the codec limit even when H.264 itself is available.
      const MAX_PIXELS = 9_000_000;
      const totalPixels = w * h;
      let rW, rH;
      if (totalPixels > MAX_PIXELS) {
        // Scale to fit within H.264 Level 5.1 (~9M pixels),
        // round to even for 4:2:0 chroma subsampling
        const scale = Math.sqrt(MAX_PIXELS / totalPixels);
        rW = Math.floor(w * scale / 2) * 2;
        rH = Math.floor(h * scale / 2) * 2;
      } else {
        // Resolution within pixel budget but probe still failed —
        // try a safe baseline (1920×1080 or halved, whichever is smaller)
        rW = Math.min(w, 1920);
        rH = Math.min(h, 1080);
        // Round to even
        rW = Math.floor(rW / 2) * 2;
        rH = Math.floor(rH / 2) * 2;
      }
      
      console.log(`🎬 [Export] Trying reduced ${rW}×${rH}`);
      const reducedConfig = await VideoExporter._testWebCodecsConfig(
        rW, rH, undefined, undefined, 'mp4'
      );
      if (reducedConfig) {
        this._showCodecModal({ fullW: w, fullH: h, reducedW: rW, reducedH: rH });
        return;
      }
      
      // 3. No H.264 support at any resolution
      this._showCodecModal();
    });
    
    // Export WebM button
    this.elements.exportWebmBtn?.addEventListener('click', () => {
      this.eventBus.emit('video:export-request', 'webm');
    });
    
    // Export HTML button
    this.elements.exportHtmlBtn?.addEventListener('click', () => {
      this.eventBus.emit('html:export-request');
    });
    
    // Export frame rate (number input)
    this.elements.exportFrameRate?.addEventListener('change', (e) => {
      // Clamp value to valid range
      let frameRate = parseInt(e.target.value) || 25;
      frameRate = Math.max(1, Math.min(60, frameRate));
      e.target.value = frameRate;
      this.eventBus.emit('video:frame-rate-change', frameRate);
    });
    
    // Export: include background image (unchecked = path only / transparent)
    this.elements.exportIncludeImage?.addEventListener('change', (e) => {
      // emits video:layers-change(pathOnly) → main.js sets exportSettings.pathOnly
      this.eventBus.emit('video:layers-change', !e.target.checked);
    });
    
    // Export: include camera movement (per-waypoint zoom/pan)
    this.elements.exportIncludeCamera?.addEventListener('change', (e) => {
      this.eventBus.emit('video:camera-change', e.target.checked);
    });
    
    // Export: include waypoint text labels
    this.elements.exportIncludeText?.addEventListener('change', (e) => {
      this.eventBus.emit('video:text-change', e.target.checked);
    });
    
    // Export resolution X
    this.elements.exportResX?.addEventListener('change', (e) => {
      let resX = parseInt(e.target.value) || 1920;
      resX = Math.max(100, Math.min(7680, resX));
      e.target.value = resX;
      this.eventBus.emit('video:resolution-change', { width: resX, height: null });
    });
    
    // Export resolution Y
    this.elements.exportResY?.addEventListener('change', (e) => {
      let resY = parseInt(e.target.value) || 1080;
      resY = Math.max(100, Math.min(4320, resY));
      e.target.value = resY;
      this.eventBus.emit('video:resolution-change', { width: null, height: resY });
    });
    
    // Aspect ratio preset buttons
    // Native - use loaded image dimensions
    this.elements.presetBtnNative?.addEventListener('click', () => {
      this.eventBus.emit('video:resolution-native');
    });
    
    // 16:9 - 1920x1080 (HD, good for web and Surface Hub)
    this.elements.presetBtn16_9?.addEventListener('click', () => {
      this.setExportResolution(1920, 1080);
    });
    
    // 1:1 - 1080x1080 (Square, good for social media)
    this.elements.presetBtn1_1?.addEventListener('click', () => {
      this.setExportResolution(1080, 1080);
    });
    
    // 9:16 - 1080x1920 (Portrait, good for mobile/stories)
    this.elements.presetBtn9_16?.addEventListener('click', () => {
      this.setExportResolution(1080, 1920);
    });
    
    // Background zoom slider
    this.elements.backgroundZoom?.addEventListener('input', (e) => {
      const zoom = parseInt(e.target.value);
      if (this.elements.backgroundZoomValue) {
        this.elements.backgroundZoomValue.textContent = `${zoom}%`;
      }
      this.eventBus.emit('background:zoom-change', zoom);
    });
    
    // ========== MOTION VISIBILITY CONTROLS ==========
    
    // Preview mode toggle
    this.elements.previewModeBtn?.addEventListener('click', () => {
      const isPressed = this.elements.previewModeBtn.getAttribute('aria-pressed') === 'true';
      const newState = !isPressed;
      this.elements.previewModeBtn.setAttribute('aria-pressed', newState);
      this.elements.previewModeBtn.textContent = newState ? 'Edit Mode' : 'Preview Mode';
      this.elements.previewModeBtn.classList.toggle('btn-primary', newState);
      this.elements.previewModeBtn.classList.toggle('btn-secondary', !newState);
      this.eventBus.emit('motion:preview-mode-change', newState);
    });
    
    // Path visibility
    this.elements.pathVisibility?.addEventListener('change', (e) => {
      this.eventBus.emit('motion:path-visibility-change', e.target.value);
      // Blur to prevent keyboard shortcuts from changing the dropdown
      e.target.blur();
    });
    
    // Path trail (0=off, then log scale 1%-100% of sequence)
    this.elements.pathTrail?.addEventListener('input', (e) => {
      const sliderValue = parseInt(e.target.value);
      const trailFraction = this.sliderToTrailFraction(sliderValue);
      this._currentTrailFraction = trailFraction;
      this._updateTrailDisplay();
      this.eventBus.emit('motion:path-trail-change', trailFraction);
    });
    
    // Listen for playback speed changes to update trail display
    this.eventBus.on('animation:playbackSpeedChange', (speed) => {
      this._currentPlaybackSpeed = speed;
      this._updateTrailDisplay();
    });
    
    // Waypoint visibility
    this.elements.waypointVisibility?.addEventListener('change', (e) => {
      this.eventBus.emit('motion:waypoint-visibility-change', e.target.value);
      e.target.blur();
    });
    
    // Background visibility
    this.elements.backgroundVisibility?.addEventListener('change', (e) => {
      this.eventBus.emit('motion:background-visibility-change', e.target.value);
      // Show/hide controls based on mode
      const spotlightControls = document.getElementById('spotlight-controls');
      const aovControls = document.getElementById('aov-controls');
      const mode = e.target.value;
      const isSpotlight = mode === 'spotlight' || mode === 'spotlight-reveal';
      const isAOV = mode === 'angle-of-view' || mode === 'angle-of-view-reveal';
      if (spotlightControls) spotlightControls.style.display = isSpotlight ? 'block' : 'none';
      if (aovControls) aovControls.style.display = isAOV ? 'block' : 'none';
      this.updateRevealTrailVisibility(mode);
      e.target.blur();
    });
    
    // Spotlight size (log2 scale slider)
    this.elements.revealSize?.addEventListener('input', (e) => {
      const sliderValue = parseInt(e.target.value);
      const sizePercent = MotionVisibilityService.sliderToLog2Value(
        sliderValue,
        MOTION.SPOTLIGHT_SIZE_MIN,
        MOTION.SPOTLIGHT_SIZE_MAX
      );
      this.elements.revealSizeValue.textContent = MotionVisibilityService.formatUIValue(sizePercent, '%');
      this.eventBus.emit('motion:reveal-size-change', sizePercent);
    });
    
    // Spotlight feather (log2 scale slider, % of spotlight size)
    this.elements.revealFeather?.addEventListener('input', (e) => {
      const sliderValue = parseInt(e.target.value);
      const featherPercent = MotionVisibilityService.sliderToLog2Value(
        sliderValue,
        MOTION.SPOTLIGHT_FEATHER_MIN,
        MOTION.SPOTLIGHT_FEATHER_MAX
      );
      this.elements.revealFeatherValue.textContent = MotionVisibilityService.formatUIValue(featherPercent, '%');
      this.eventBus.emit('motion:reveal-feather-change', featherPercent);
    });

    // REVEAL-01 — reveal trail (log2 scale, % of the whole path). At the top of
    // the range the reveal never fades, so the readout says so in words rather
    // than showing a bare 100% that reads like "almost, but not quite".
    this.elements.revealTrail?.addEventListener('input', (e) => {
      const trailPercent = MotionVisibilityService.sliderToLog2Value(
        parseInt(e.target.value),
        MOTION.SPOTLIGHT_TRAIL_MIN,
        MOTION.SPOTLIGHT_TRAIL_MAX
      );
      this.setRevealTrailReadout(trailPercent);
      this.eventBus.emit('motion:reveal-trail-change', trailPercent);
    });
    
    // Angle of View - angle (tan-based curve for perceptual smoothness)
    this.elements.aovAngle?.addEventListener('input', (e) => {
      const sliderValue = parseInt(e.target.value);
      const angleDegrees = MotionVisibilityService.sliderToAngle(
        sliderValue,
        MOTION.AOV_ANGLE_MIN,
        MOTION.AOV_ANGLE_MAX
      );
      this.elements.aovAngleValue.textContent = MotionVisibilityService.formatUIValue(angleDegrees, '°');
      this.eventBus.emit('motion:aov-angle-change', angleDegrees);
    });
    
    // Angle of View - distance (log2 scale, same as spotlight size)
    this.elements.aovDistance?.addEventListener('input', (e) => {
      const sliderValue = parseInt(e.target.value);
      const distancePercent = MotionVisibilityService.sliderToLog2Value(
        sliderValue,
        MOTION.AOV_DISTANCE_MIN,
        MOTION.AOV_DISTANCE_MAX
      );
      this.elements.aovDistanceValue.textContent = MotionVisibilityService.formatUIValue(distancePercent, '%');
      this.eventBus.emit('motion:aov-distance-change', distancePercent);
    });
    
    // Angle of View - dropoff (LINEAR scale 0-100%, not log2)
    this.elements.aovDropoff?.addEventListener('input', (e) => {
      const sliderValue = parseInt(e.target.value);
      // Linear mapping: slider 0-1000 → value 0-100%
      const dropoffPercent = (sliderValue / 1000) * MOTION.AOV_DROPOFF_MAX;
      this.elements.aovDropoffValue.textContent = MotionVisibilityService.formatUIValue(dropoffPercent, '%');
      this.eventBus.emit('motion:aov-dropoff-change', dropoffPercent);
    });
    
    // Waypoint editor controls
    this.setupWaypointEditorControls();
  }
  
  /**
   * Update trail control visibility based on path visibility mode.
   * Trail only applies to instantaneous (comet) mode.
   * @param {string} pathVisibility - Current path visibility mode
   */
  updateTrailControlVisibility(pathVisibility) {
    const trailControl = document.getElementById('path-trail-control');
    const pacingHint = document.getElementById('pacing-comet-hint');
    const showTrail = pathVisibility === PATH_VISIBILITY.INSTANTANEOUS;
    if (trailControl) {
      trailControl.style.display = showTrail ? 'flex' : 'none';
      trailControl.style.opacity = showTrail ? '1' : '0.5';
      const input = trailControl.querySelector('input');
      if (input) {
        input.disabled = !showTrail;
      }
    }
    if (pacingHint) pacingHint.hidden = !showTrail;
  }

  /**
   * REVEAL-01 — the reveal trail only means anything where the reveal
   * accumulates. Plain spotlight paints the head and nothing else, so a trail
   * control there would be a control that does nothing.
   * @param {string} backgroundVisibility - Current background visibility mode
   */
  updateRevealTrailVisibility(backgroundVisibility) {
    const control = document.getElementById('reveal-trail-control');
    if (!control) return;
    const applies = backgroundVisibility === BACKGROUND_VISIBILITY.SPOTLIGHT_REVEAL;
    control.hidden = !applies;
  }

  /**
   * REVEAL-01 — write the trail readout and keep `aria-valuetext` with it.
   * The slider runs on a log2 scale, so its raw position is meaningless to a
   * screen reader; the announced value has to be the one the renderer uses.
   * At the top of the range the reveal never fades, and saying "100%" would
   * read as "almost", so that end is named in words.
   * @param {number} trailPercent - Trail length as a % of the whole path
   */
  setRevealTrailReadout(trailPercent) {
    const text = trailPercent >= MOTION.SPOTLIGHT_TRAIL_MAX
      ? 'Whole path'
      : `${MotionVisibilityService.formatUIValue(trailPercent, '%')} of path`;
    if (this.elements.revealTrailValue) this.elements.revealTrailValue.textContent = text;
    if (this.elements.revealTrail) this.elements.revealTrail.setAttribute('aria-valuetext', text);
  }

  /**
   * REVEAL-01 — put the reveal sliders where the loaded project says they are.
   * These controls were never synced on load, so a restored project showed its
   * authored values in the render while the sliders sat at their markup
   * defaults. Adding a third unsynced control would have made that worse, so
   * all three are synced together here.
   * @param {Object} motionSettings - The project's motion settings
   */
  syncRevealControls(motionSettings) {
    const pairs = [
      [this.elements.revealSize, this.elements.revealSizeValue, motionSettings.revealSize,
        MOTION.SPOTLIGHT_SIZE_MIN, MOTION.SPOTLIGHT_SIZE_MAX],
      [this.elements.revealFeather, this.elements.revealFeatherValue, motionSettings.revealFeather,
        MOTION.SPOTLIGHT_FEATHER_MIN, MOTION.SPOTLIGHT_FEATHER_MAX],
    ];
    for (const [slider, readout, value, min, max] of pairs) {
      if (!slider || !Number.isFinite(value)) continue;
      slider.value = String(MotionVisibilityService.log2ValueToSlider(value, min, max));
      if (readout) readout.textContent = MotionVisibilityService.formatUIValue(value, '%');
    }

    const trail = motionSettings.revealTrail;
    if (this.elements.revealTrail && Number.isFinite(trail)) {
      this.elements.revealTrail.value = String(MotionVisibilityService.log2ValueToSlider(
        trail, MOTION.SPOTLIGHT_TRAIL_MIN, MOTION.SPOTLIGHT_TRAIL_MAX));
      this.setRevealTrailReadout(trail);
    }

    const spotlightControls = document.getElementById('spotlight-controls');
    const aovControls = document.getElementById('aov-controls');
    const mode = motionSettings.backgroundVisibility;
    const isSpotlight = mode === BACKGROUND_VISIBILITY.SPOTLIGHT ||
                        mode === BACKGROUND_VISIBILITY.SPOTLIGHT_REVEAL;
    const isAOV = mode === 'angle-of-view' || mode === BACKGROUND_VISIBILITY.ANGLE_OF_VIEW_REVEAL;
    if (spotlightControls) spotlightControls.style.display = isSpotlight ? 'block' : 'none';
    if (aovControls) aovControls.style.display = isAOV ? 'block' : 'none';
    this.updateRevealTrailVisibility(mode);
  }
  
  /**
   * Setup waypoint editor controls
   */
  setupWaypointEditorControls() {
    // Marker/segment/beacon/label controls are owned by the app's DOM
    // wiring (setupEventListeners), which writes to every selected
    // waypoint via selectionTargets() — the old bulk-only listeners here
    // dissolved with the "All Waypoints" mode (Phase 4 multi-select).
    // Only the controls whose single-selection path already lived here
    // (pause, segment speed, area highlights) remain, looping the same
    // way via _bulkTargets().

    // Beacon sub-control visibility still follows the dropdown even
    // though the model write happens in the app's DOM wiring
    this.elements.editorBeaconStyle?.addEventListener('change', (e) => {
      updateConditionalVisibility('editor-beacon-style', e.target.value);
    });

    // Pause time - power-curve slider (0-30 seconds)
    // Slider value 0-1000 maps via power curve to 0-30 seconds
    // Pauses live on majors only; one event per gesture keeps the
    // downstream duration recalc + debounced undo entry singular
    this.elements.waypointPauseTime?.addEventListener('input', (e) => {
      const sliderValue = parseInt(e.target.value);
      const timeSec = this.sliderToPauseTime(sliderValue);
      const timeMs = timeSec * 1000;

      // Format display nicely
      this.elements.waypointPauseTimeValue.textContent = MotionVisibilityService.formatUIValue(timeSec, 's');

      const targets = this._bulkTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) {
          wp.pauseTime = timeMs;
          wp.pauseMode = timeSec > 0 ? 'timed' : 'none';
        }

        // Emit event to trigger pause marker update and save
        this.eventBus.emit('waypoint:pause-changed', {
          waypoint: this.selectedWaypoint,
          pauseTime: timeMs,
          pauseMode: timeSec > 0 ? 'timed' : 'none'
        });
      }
    });

    // Segment speed - logarithmic slider (0.1x to 10x)
    // Slider value 0-1000 maps logarithmically: 0→0.1x, 500→1.0x, 1000→10x
    // Speed is keyframed on majors only (minors are geometry)
    this.elements.waypointSegmentSpeed?.addEventListener('input', (e) => {
      const sliderValue = parseInt(e.target.value);
      const speedMultiplier = this.sliderToSegmentSpeed(sliderValue);

      // Format display nicely (speed uses 2 decimal places when < 1 for precision)
      const displaySpeed = speedMultiplier < 1 ? speedMultiplier.toFixed(2) : MotionVisibilityService.formatUIValue(speedMultiplier);
      this.elements.waypointSegmentSpeedValue.textContent = `${displaySpeed}x`;

      const targets = this._bulkTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) {
          wp.segmentSpeed = speedMultiplier;
        }

        // Emit event to trigger recalculation
        this.eventBus.emit('waypoint:speed-changed', {
          waypoint: this.selectedWaypoint,
          segmentSpeed: speedMultiplier
        });
      }
    });
    
    // Path head is route-global and fully wired in the app's DOM layer
    // (setupEventListeners) — no listeners here (decision 2026-08-18).

    // ========== AREA HIGHLIGHT CONTROLS ==========

    // Every area control writes to the whole selection (minors carry
    // areas too, same as the single-selection path); one area:changed
    // per gesture keeps the debounced undo entry and autosave singular
    const applyAreaChange = (mutate) => {
      const targets = this._bulkTargets();
      if (targets.length === 0) return;
      for (const wp of targets) {
        mutate(wp.areaHighlight, wp);
      }
      this.eventBus.emit('area:changed', { waypoint: this.selectedWaypoint });
    };

    // Shape dropdown — toggles sub-control visibility and updates model
    this.elements.areaShape?.addEventListener('change', (e) => {
      const shape = e.target.value;
      this._updateAreaSubControls(shape);

      applyAreaChange((ah, wp) => {
        ah.shape = shape;
        ah.enabled = shape !== 'none';
        // Default center to waypoint position for new shapes
        if (ah.enabled && ah.centerX === 0.5 && ah.centerY === 0.5) {
          ah.centerX = wp.imgX;
          ah.centerY = wp.imgY;
        }
      });
    });

    // Circle radius slider (0-1000 → CIRCLE_RADIUS_MIN to CIRCLE_RADIUS_MAX)
    this.elements.areaCircleRadius?.addEventListener('input', (e) => {
      const normalized = parseInt(e.target.value) / 1000;
      const radius = AREA_HIGHLIGHT.CIRCLE_RADIUS_MIN + normalized * (AREA_HIGHLIGHT.CIRCLE_RADIUS_MAX - AREA_HIGHLIGHT.CIRCLE_RADIUS_MIN);
      this.elements.areaCircleRadiusValue.textContent = `${Math.round(radius * 100)}%`;
      applyAreaChange((ah) => { ah.radius = radius; });
    });

    // Rectangle width slider (0-1000 → RECT_SIZE_MIN to RECT_SIZE_MAX)
    this.elements.areaRectWidth?.addEventListener('input', (e) => {
      const normalized = parseInt(e.target.value) / 1000;
      const width = AREA_HIGHLIGHT.RECT_SIZE_MIN + normalized * (AREA_HIGHLIGHT.RECT_SIZE_MAX - AREA_HIGHLIGHT.RECT_SIZE_MIN);
      this.elements.areaRectWidthValue.textContent = `${Math.round(width * 100)}%`;
      applyAreaChange((ah) => { ah.width = width; });
    });

    // Rectangle height slider (0-1000 → RECT_SIZE_MIN to RECT_SIZE_MAX)
    this.elements.areaRectHeight?.addEventListener('input', (e) => {
      const normalized = parseInt(e.target.value) / 1000;
      const height = AREA_HIGHLIGHT.RECT_SIZE_MIN + normalized * (AREA_HIGHLIGHT.RECT_SIZE_MAX - AREA_HIGHLIGHT.RECT_SIZE_MIN);
      this.elements.areaRectHeightValue.textContent = `${Math.round(height * 100)}%`;
      applyAreaChange((ah) => { ah.height = height; });
    });

    // Fill colour (swatch picker writes to hidden input)
    this.elements.areaFillColor?.addEventListener('input', (e) => {
      applyAreaChange((ah) => { ah.fillColor = e.target.value; });
    });

    // Fill opacity slider (0-100 → 0-1)
    this.elements.areaFillOpacity?.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value);
      this.elements.areaFillOpacityValue.textContent = `${pct}%`;
      applyAreaChange((ah) => { ah.fillOpacity = pct / 100; });
    });

    // Border colour (swatch picker writes to hidden input)
    this.elements.areaBorderColor?.addEventListener('input', (e) => {
      applyAreaChange((ah) => { ah.borderColor = e.target.value; });
    });

    // Border style dropdown
    this.elements.areaBorderStyle?.addEventListener('change', (e) => {
      applyAreaChange((ah) => { ah.borderStyle = e.target.value; });
    });

    // Border width slider
    this.elements.areaBorderWidth?.addEventListener('input', (e) => {
      const width = parseInt(e.target.value);
      setRangeReadout(
        this.elements.areaBorderWidth,
        this.elements.areaBorderWidthValue,
        formatRendererPixels(width)
      );
      applyAreaChange((ah) => { ah.borderWidth = width; });
    });

    // Visibility dropdown
    this.elements.areaVisibility?.addEventListener('change', (e) => {
      applyAreaChange((ah) => { ah.visibility = e.target.value; });
    });

    // Fade in slider (0-10000ms)
    this.elements.areaFadeIn?.addEventListener('input', (e) => {
      const ms = parseInt(e.target.value);
      this.elements.areaFadeInValue.textContent = `${(ms / 1000).toFixed(1)}s`;
      applyAreaChange((ah) => { ah.fadeInMs = ms; });
    });

    // Fade out slider (0-10000ms)
    this.elements.areaFadeOut?.addEventListener('input', (e) => {
      const ms = parseInt(e.target.value);
      this.elements.areaFadeOutValue.textContent = `${(ms / 1000).toFixed(1)}s`;
      applyAreaChange((ah) => { ah.fadeOutMs = ms; });
    });

    // Draw Area button (enters polygon draw mode) — inherently a
    // one-waypoint gesture, so it targets the primary selection only
    this.elements.areaDrawBtn?.addEventListener('click', () => {
      if (this.selectedWaypoint) {
        this.eventBus.emit('area:draw-start', { waypoint: this.selectedWaypoint });
      }
    });

    // Delete Area button
    this.elements.areaDeleteBtn?.addEventListener('click', () => {
      applyAreaChange((ah) => {
        ah.enabled = false;
        ah.shape = 'none';
        ah.points = [];
      });
      if (this.elements.areaShape) {
        this.elements.areaShape.value = 'none';
        this._updateAreaSubControls('none');
      }
    });
  }
  
  /**
   * Begin inline rename on the list row of any listed waypoint.
   * Looks the row up fresh by route index in the current DOM, so it works
   * after any list rebuild — selection rebuilds the rows, destroying
   * closures over old elements (which is why the double-click and F2
   * paths used to carry duplicated copies of this logic).
   * Shared by double-click, F2, and the canvas context menu's Rename.
   * @param {Waypoint} waypoint - Major or minor waypoint to rename
   */
  startRenameFor(waypoint) {
    const listed = this._listedWaypoints || [];
    const index = listed.indexOf(waypoint);
    if (index === -1 || !this.elements.waypointList) return;

    const item = this.elements.waypointList.querySelector(
      `.waypoint-item[data-route-index="${index}"]`
    );
    const rowBtn = item?.querySelector('.waypoint-row');
    const currentTitle = item?.querySelector('.waypoint-title');
    if (!item || !rowBtn || !currentTitle) return;

    const entry = this._listedNumbering?.[index];
    const defaultName = `Waypoint ${entry ? entry.displayNumber : index + 1}`;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'waypoint-rename-input';
    input.value = waypoint.name || '';
    input.placeholder = defaultName;
    input.setAttribute('aria-label', `Rename ${waypoint.name || defaultName}`);

    currentTitle.replaceWith(input);
    input.focus();
    input.select();

    // Declared before finish() so finish() can detach it; committing on blur
    // is the "clicked away" path.
    const onBlur = () => finish(true);

    const finish = (commit) => {
      // Detach the blur listener before touching the DOM. Replacing the input
      // removes the focused node, and Chrome dispatches its blur from inside
      // that replaceWith call — the re-entrant pass then replaced a node that
      // no longer had a parent and threw NotFoundError into the console on
      // every successful rename (found live during UI-02 verification).
      input.removeEventListener('blur', onBlur);
      // The row can also be rebuilt out from under an open rename (autosave,
      // an app-side list refresh). A rebuilt row carries its own title span,
      // so there is nothing left to restore.
      if (!input.isConnected) return;
      const trimmed = input.value.trim();
      if (commit) {
        waypoint.name = trimmed; // Empty string = revert to default display
        waypoint._autoNamed = false; // Manual rename breaks auto-name link to label
      }
      const restored = document.createElement('span');
      restored.className = 'waypoint-title';
      restored.textContent = waypoint.name || defaultName;
      input.replaceWith(restored);
      if (commit) {
        this.eventBus.emit('waypoint:name-changed', { waypoint, name: trimmed });
        // The list does not rebuild on rename — refresh the row's labels
        const newDisplay = waypoint.name || defaultName;
        // Move buttons exist on major rows only; minors reorder with their leg.
        const [moveUpBtn, moveDownBtn] = item.querySelectorAll('.waypoint-move-btn');
        moveUpBtn?.setAttribute('aria-label', `Move ${newDisplay} up`);
        moveDownBtn?.setAttribute('aria-label', `Move ${newDisplay} down`);
        item.querySelector('.waypoint-delete')?.setAttribute('aria-label', `Delete ${newDisplay}`);
      }
      requestAnimationFrame(() => rowBtn.focus());
    };

    input.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') { ke.preventDefault(); finish(true); }
      if (ke.key === 'Escape') { ke.preventDefault(); finish(false); }
      ke.stopPropagation(); // Don't trigger global shortcuts while renaming
    });
    input.addEventListener('blur', onBlur, { once: true });
  }

  /**
   * Update waypoint list UI
   *
   * ## Structure (UI-02)
   * Every waypoint in the route gets a row. Majors are top level; minors are
   * indented under the major whose leg they shape and numbered `major.minor`
   * by `buildRouteNumbering`, the same routine the semantic outline uses.
   *
   * ## Features
   * - Double-click or F2 on any row to rename
   * - Drag handle, ▲/▼ on majors — a major reorders as its whole leg block
   * - Delete button (×) for removal, majors and minors alike
   * - Click to select; Cmd/Ctrl+click toggles, Shift+click ranges over the
   *   displayed route (Cmd/Ctrl+A selects the whole route)
   *
   * ## Performance
   * - O(n) where n = route length, plus one indexOf per major row
   * - Event listeners attached per-item (not delegation, for drag/drop support)
   *
   * @param {Array<Waypoint>} waypoints - Full route in order, majors and minors
   */
  updateWaypointList(waypoints) {
    // Cache route order for the scope chip and Leg card header, then
    // refresh both — list updates fire on add/delete/reorder, where
    // neighbours and display indices change without a reselection
    this._waypointsCache = waypoints;
    this._updateScopeChip(this.selectedWaypoint,
      this.selectedWaypoints.size > 1 ? [...this.selectedWaypoints] : null);
    this._updateLegSectionTitle(
      this.selectedWaypoints.size > 1 ? null : this.selectedWaypoint
    );

    if (!this.elements.waypointList) return;

    // UI-02: the list shows the whole route. Majors keep their existing row;
    // minors render as indented child rows of the leg they shape, numbered by
    // the same routine the semantic outline uses, so both surfaces name the
    // same waypoint the same way.
    const routeWaypoints = Array.isArray(waypoints) ? waypoints : [];
    const numbering = buildRouteNumbering(routeWaypoints);
    this._listedWaypoints = routeWaypoints;
    this._listedNumbering = numbering;
    // Only trunk majors carry the reorder payload: a branch member moves with
    // its branch, never as a top-level leg block.
    this._listedMajors = routeWaypoints.filter(
      (wp, index) => wp.isMajor && numbering[index].branchId == null
    );

    // Fork markers and rejoin names, resolved once per rebuild (ROUTE-01c).
    const structure = resolveRouteBranches(routeWaypoints);
    const nameOf = id => {
      const index = routeWaypoints.findIndex(wp => wp.id === id);
      if (index === -1) return null;
      return routeWaypoints[index].name || `Waypoint ${numbering[index].displayNumber}`;
    };
    this._listedForkIds = new Set(
      structure.branches.map(branch => branch.forkFromId).filter(Boolean)
    );
    this._listedRejoinNames = {};
    for (const branch of structure.branches) {
      this._listedRejoinNames[branch.id] = branch.rejoinAtId ? nameOf(branch.rejoinAtId) : null;
    }

    // This is an action list, not an ARIA listbox: each row remains a
    // native button alongside independent reorder/delete actions.
    this.elements.waypointList.removeAttribute('role');
    this.elements.waypointList.setAttribute('aria-label', 'Waypoints');
    this.elements.waypointList.removeAttribute('aria-multiselectable');

    // Rebuilding removes the focused row from the DOM. Only restore focus
    // to its replacement when focus belonged to this list beforehand;
    // semantic-outline and inspector interactions must retain their focus.
    const focusedBeforeRebuild = document.activeElement;
    const focusWasInWaypointList = this.elements.waypointList.contains(focusedBeforeRebuild);
    const focusedControlWasEditing = focusWasInWaypointList &&
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(focusedBeforeRebuild?.tagName);

    this.elements.waypointList.innerHTML = '';

    const majorWaypoints = this._listedMajors;

    // When no waypoints exist, show empty state message
    if (routeWaypoints.length === 0) {
      this.elements.waypointList.innerHTML = `
        <li class="waypoint-list-empty" role="status" aria-live="polite">
          <p>No waypoints yet</p>
          <p class="hint">Click on the map to add waypoints</p>
        </li>
      `;
      return;
    }

    // Add Waypoint button - keyboard-accessible way to add waypoints (AAA)
    const addItem = document.createElement('li');
    addItem.className = 'waypoint-item waypoint-item-add';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'waypoint-row waypoint-add-btn';
    addBtn.innerHTML = '<span class="waypoint-add-icon" aria-hidden="true">+</span><span>Add Waypoint</span>';
    addBtn.setAttribute('aria-label', 'Add new waypoint at center of map');

    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.eventBus.emit('waypoint:add-at-center');
    });

    addItem.appendChild(addBtn);
    this.elements.waypointList.appendChild(addItem);

    // Route order, majors and minors together. A minor is not draggable and
    // owns no reorder buttons: its place inside the leg is authored on the
    // canvas, and reorderWaypointBlocks already carries it with its major.
    // Each item is a <li> with a <button> row for proper keyboard semantics.
    routeWaypoints.forEach((waypoint, routeIndex) => {
      const entry = numbering[routeIndex];
      const onBranch = entry.branchId !== null && entry.branchId !== undefined;
      // A branch member is never a trunk major, so it never joins the
      // majors-only reorder payload even when it is a major of its own run.
      const isMajor = entry.isMajor && !onBranch;
      const majorIndex = isMajor ? majorWaypoints.indexOf(waypoint) : -1;
      const defaultName = `Waypoint ${entry.displayNumber}`;
      const displayName = waypoint.name || defaultName;

      const item = document.createElement('li');
      item.className = 'waypoint-item'
        + (isMajor ? '' : ' waypoint-item-minor')
        + (onBranch ? ' waypoint-item-branch' : '');
      item.draggable = isMajor;
      item.dataset.routeIndex = String(routeIndex);
      // Majors additionally carry their majors-only index: the reorder payload
      // is still the majors array, so blocks stay intact (review 2026-08-18).
      if (isMajor) item.dataset.originalIndex = String(majorIndex);

      // Check if waypoint is in multi-select set OR is the primary selection
      const isSelected = this.selectedWaypoints.has(waypoint) ||
        (waypoint === this.selectedWaypoint);
      if (isSelected) {
        item.classList.add('selected');
        item.classList.add('is-selected');
      }

      // Row button receives focus and exposes its multi-selection state
      // without replacing native button semantics with a partial listbox.
      const rowBtn = document.createElement('button');
      rowBtn.type = 'button';
      rowBtn.className = 'waypoint-row';
      rowBtn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      if (isMajor) {
        // Colour dot — shows waypoint's marker colour for quick recognition (N6-1)
        const colorDot = document.createElement('span');
        colorDot.className = 'waypoint-color-dot'
          + (waypoint.dotColor === 'transparent' ? ' is-none' : '');
        colorDot.setAttribute('aria-hidden', 'true');
        colorDot.style.backgroundColor = waypoint.dotColor === 'transparent'
          ? '#fff' : (waypoint.dotColor || '');
        rowBtn.appendChild(colorDot);
      } else {
        // Minors render on canvas as small grey shaping dots regardless of
        // dotColor, so the row shows that glyph rather than an unused swatch.
        const minorDot = document.createElement('span');
        minorDot.className = 'waypoint-minor-dot';
        minorDot.setAttribute('aria-hidden', 'true');
        rowBtn.appendChild(minorDot);
      }

      // Drag handle (inside button, aria-hidden). Minors keep the slot empty
      // so titles stay on one vertical rhythm without implying a drag target.
      const handle = document.createElement('span');
      handle.className = isMajor ? 'waypoint-handle' : 'waypoint-handle is-fixed';
      handle.setAttribute('aria-hidden', 'true');
      handle.textContent = isMajor ? '≡' : '';

      // Waypoint title — name is independent from canvas label (N6-3)
      const title = document.createElement('span');
      title.className = 'waypoint-title';
      title.textContent = displayName;

      rowBtn.appendChild(handle);
      rowBtn.appendChild(title);

      if (this._listedForkIds?.has(waypoint.id)) {
        const fork = document.createElement('span');
        fork.className = 'waypoint-fork-mark';
        fork.setAttribute('aria-hidden', 'true');
        fork.textContent = '⑂';
        rowBtn.appendChild(fork);
        const forkContext = document.createElement('span');
        forkContext.className = 'sr-only';
        forkContext.textContent = ', a branch leaves here';
        rowBtn.appendChild(forkContext);
      }

      if (!isMajor) {
        // Indentation is visual only, so the kind and what the row belongs to
        // are also written out: a visible tag plus the relationship for AT
        // users (WCAG 2.2 1.3.1 — structure must not be conveyed by layout).
        const tag = document.createElement('span');
        tag.className = 'waypoint-minor-tag';
        tag.textContent = onBranch ? 'branch' : 'minor';
        rowBtn.appendChild(tag);

        const context = document.createElement('span');
        context.className = 'sr-only';
        context.textContent = onBranch
          ? branchRowContext(entry, this._listedRejoinNames?.[entry.branchId])
          : (entry.legNumber > 0
            ? `, minor waypoint shaping the leg after waypoint ${entry.legNumber}, reorders with it`
            : ', minor waypoint before waypoint 1, reorders with it');
        rowBtn.appendChild(context);
      }

      item.appendChild(rowBtn);

      // Move up/down buttons - keyboard alternative to drag reorder (AAA
      // requirement). Majors only: the reorder unit is the leg block.
      let moveUpBtn = null;
      let moveDownBtn = null;
      if (isMajor) {
        const moveContainer = document.createElement('span');
        moveContainer.className = 'waypoint-move-btns';

        moveUpBtn = document.createElement('button');
        moveUpBtn.type = 'button';
        moveUpBtn.className = 'waypoint-move-btn';
        moveUpBtn.innerHTML = '&#x25B2;'; // ▲
        moveUpBtn.setAttribute('aria-label', `Move ${displayName} up`);
        moveUpBtn.disabled = majorIndex === 0;

        moveDownBtn = document.createElement('button');
        moveDownBtn.type = 'button';
        moveDownBtn.className = 'waypoint-move-btn';
        moveDownBtn.innerHTML = '&#x25BC;'; // ▼
        moveDownBtn.setAttribute('aria-label', `Move ${displayName} down`);
        moveDownBtn.disabled = majorIndex === majorWaypoints.length - 1;

        moveContainer.appendChild(moveUpBtn);
        moveContainer.appendChild(moveDownBtn);
        item.appendChild(moveContainer);
      }

      // Delete button - separate from row button, has own focus ring
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'waypoint-delete';
      delBtn.textContent = '×';
      delBtn.setAttribute('aria-label', `Delete ${displayName}`);
      item.appendChild(delBtn);

      // Selection handler - supports shift-click and cmd/ctrl-click.
      // Ranges run over the displayed route, so a shift-click selects exactly
      // the rows between the two the user clicked, minors included.
      const selectWaypoint = (e) => {
        const isShiftClick = e.shiftKey;
        const isMultiClick = e.metaKey || e.ctrlKey;

        if (isShiftClick && this._lastSelectedIndex !== null) {
          // Shift-click: select range
          const start = Math.min(this._lastSelectedIndex, routeIndex);
          const end = Math.max(this._lastSelectedIndex, routeIndex);
          for (let i = start; i <= end; i++) {
            this.selectedWaypoints.add(routeWaypoints[i]);
          }
          this.selectedWaypoint = waypoint;
          this.eventBus.emit('waypoint:multi-selected', {
            waypoints: Array.from(this.selectedWaypoints),
            primary: waypoint
          });
        } else if (isMultiClick) {
          // Cmd/Ctrl-click: toggle
          if (this.selectedWaypoints.has(waypoint)) {
            this.selectedWaypoints.delete(waypoint);
            if (this.selectedWaypoint === waypoint) {
              this.selectedWaypoint = this.selectedWaypoints.size > 0
                ? Array.from(this.selectedWaypoints)[0]
                : null;
            }
          } else {
            this.selectedWaypoints.add(waypoint);
            this.selectedWaypoint = waypoint;
          }
          this._lastSelectedIndex = routeIndex;

          if (this.selectedWaypoints.size > 1) {
            this.eventBus.emit('waypoint:multi-selected', {
              waypoints: Array.from(this.selectedWaypoints),
              primary: this.selectedWaypoint
            });
          } else if (this.selectedWaypoints.size === 1) {
            this.eventBus.emit('waypoint:selected', this.selectedWaypoint);
          } else {
            this.eventBus.emit('waypoint:deselected');
          }
        } else {
          // Normal click: single select
          this.selectedWaypoints.clear();
          this.selectedWaypoints.add(waypoint);
          this.selectedWaypoint = waypoint;
          this._lastSelectedIndex = routeIndex;
          this.eventBus.emit('waypoint:selected', waypoint);
        }

        this._switchToWaypointTab();
        this.updateWaypointList(this._waypointsCache);
      };

      // Row button click — selects waypoint, and detects double-click for rename.
      // Standard dblclick events break because selectWaypoint rebuilds the DOM
      // (innerHTML=''), so the element is destroyed before the browser fires dblclick.
      // Instead, we track click timing at the instance level which survives rebuilds.
      rowBtn.addEventListener('click', (e) => {
        const now = Date.now();
        const isDblClick = (this._renameLastClickWaypoint === waypoint) &&
                           (now - this._renameLastClickTime < 400);

        if (isDblClick) {
          // Double-click detected — select then rename
          this._renameLastClickWaypoint = null;
          this._renameLastClickTime = 0;
          selectWaypoint(e);
          // Defer rename to next frame so the rebuilt DOM is ready
          requestAnimationFrame(() => this.startRenameFor(waypoint));
        } else {
          // Single click — normal selection
          this._renameLastClickWaypoint = waypoint;
          this._renameLastClickTime = now;
          selectWaypoint(e);
        }
      });

      // F2 to rename (common desktop pattern). Deferred like double-click:
      // selectWaypoint rebuilds the list, so rename must target the new row
      rowBtn.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
          e.preventDefault();
          selectWaypoint(e);
          requestAnimationFrame(() => this.startRenameFor(waypoint));
        }
      });

      // Delete button
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.eventBus.emit('waypoint:delete', waypoint);
      });

      if (isMajor) {
        // Move up button - reorder waypoint
        moveUpBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (majorIndex > 0) {
            const newOrder = [...majorWaypoints];
            [newOrder[majorIndex - 1], newOrder[majorIndex]] =
              [newOrder[majorIndex], newOrder[majorIndex - 1]];
            this.eventBus.emit('waypoints:reordered', newOrder);
            this.announce(`${displayName} moved up`);
          }
        });

        // Move down button - reorder waypoint
        moveDownBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (majorIndex < majorWaypoints.length - 1) {
            const newOrder = [...majorWaypoints];
            [newOrder[majorIndex], newOrder[majorIndex + 1]] =
              [newOrder[majorIndex + 1], newOrder[majorIndex]];
            this.eventBus.emit('waypoints:reordered', newOrder);
            this.announce(`${displayName} moved down`);
          }
        });

        // Drag and drop handlers. A major drags as its whole leg block so the
        // minors visibly travel with it, matching where reorderWaypointBlocks
        // will actually put them.
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(majorIndex));
          this._draggingBlock = this._legBlockRows(item);
          this._draggingBlock.forEach(row => row.classList.add('dragging'));
        });

        item.addEventListener('dragend', () => {
          (this._draggingBlock || [item]).forEach(row => row.classList.remove('dragging'));
          this._draggingBlock = null;
        });
      }

      // Every row is a drop target; a drop onto a minor resolves to the major
      // that owns it, so a block can never land inside another leg.
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const block = this._draggingBlock;
        if (!block || !block.length || block.includes(item)) return;

        const anchor = this._legBlockAnchor(item);
        if (!anchor || block.includes(anchor)) return;

        const rect = anchor.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (e.clientY < midpoint) {
          anchor.before(...block);
        } else {
          const anchorBlock = this._legBlockRows(anchor);
          anchorBlock[anchorBlock.length - 1].after(...block);
        }
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        // Emit reorder event with the new majors order read from the DOM
        const rows = Array.from(
          this.elements.waypointList.querySelectorAll('.waypoint-item[data-original-index]')
        );
        const newOrder = rows
          .map(el => majorWaypoints[parseInt(el.dataset.originalIndex, 10)])
          .filter(wp => wp); // Filter out undefined
        this.eventBus.emit('waypoints:reordered', newOrder);
      });

      this.elements.waypointList.appendChild(item);

      // Restore keyboard position only for a rerender initiated from this
      // list. If focus moved elsewhere before the frame runs, leave it there.
      if (waypoint === this.selectedWaypoint && this.selectedWaypoints.size <= 1 &&
          focusWasInWaypointList && !focusedControlWasEditing) {
        requestAnimationFrame(() => {
          const active = document.activeElement;
          const rebuildDroppedFocus = !active || active === document.body || active === document.documentElement;
          if (rowBtn.isConnected &&
              (rebuildDroppedFocus || this.elements.waypointList.contains(active))) {
            rowBtn.focus();
          }
        });
      }
    });
  }

  /**
   * The major row that owns `row` — itself when it is a major, otherwise the
   * nearest preceding major. A minor before the first major has no owner.
   * @param {HTMLElement} row
   * @returns {HTMLElement|null}
   * @private
   */
  _legBlockAnchor(row) {
    let current = row;
    while (current && current.classList.contains('waypoint-item-minor')) {
      current = current.previousElementSibling;
    }
    return current && current.dataset?.originalIndex !== undefined ? current : null;
  }

  /**
   * A major row plus the minor rows that trail it — the unit reordering moves.
   * @param {HTMLElement} majorRow
   * @returns {Array<HTMLElement>}
   * @private
   */
  _legBlockRows(majorRow) {
    const rows = [majorRow];
    let next = majorRow.nextElementSibling;
    while (next && next.classList.contains('waypoint-item-minor')) {
      rows.push(next);
      next = next.nextElementSibling;
    }
    return rows;
  }
  
  /**
   * Update waypoint editor panel with selected waypoint data.
   *
   * ## Modes
   * - **Single waypoint**: populates all controls from the waypoint
   * - **Multiple waypoints**: populates from the primary waypoint (the
   *   values a change will write to the whole selection); label text is
   *   hidden — it stays per-waypoint
   * - **No selection**: SectionController shows Route scope
   *
   * @param {Waypoint|null} waypoint - Selected waypoint (primary), or null
   * @param {Array<Waypoint>} [multiSelect=null] - Full selection when more than one waypoint is selected
   */
  updateWaypointEditor(waypoint, multiSelect = null) {
    this.selectedWaypoint = waypoint;

    // Determine if we're in multi-select mode
    const isMultiSelect = multiSelect && multiSelect.length > 1;

    // Scope chip announces what the inspector is editing; the Leg card
    // header names the segment the selected waypoint owns
    this._updateScopeChip(waypoint, multiSelect);
    this._updateLegSectionTitle(isMultiSelect ? null : waypoint);

    // Note: Scope-group visibility is handled by SectionController which
    // listens to the same waypoint:selected/deselected events that trigger
    // this method. We don't emit events here to avoid infinite loops.

    if (!waypoint) {
      // No waypoint selected — SectionController shows Route scope
      return;
    }

    // Hide label text control in multi-select mode (label text stays
    // per-waypoint; every other label control bulk-applies)
    const labelTextControl = this.elements.waypointLabel?.closest('label');
    if (labelTextControl) {
      labelTextControl.style.display = isMultiSelect ? 'none' : 'block';
    }

    // Update controls with waypoint values (in multi-select: the
    // primary's values — what a change will write to the selection)
    if (this.elements.markerStyle) {
      this.elements.markerStyle.value = waypoint.markerStyle || 'dot';
    }
    
    if (this.elements.dotColor) {
      this.elements.dotColor.value = waypoint.dotColor || RENDERING.DEFAULT_PATH_COLOR;
    }
    
    if (this.elements.dotSize) {
      this.elements.dotSize.value = waypoint.dotSize || 8;
      setRangeReadout(
        this.elements.dotSize,
        this.elements.dotSizeValue,
        formatRendererPixels(waypoint.dotSize || 8)
      );
    }
    
    if (this.elements.segmentColor) {
      this.elements.segmentColor.value = waypoint.segmentColor || RENDERING.DEFAULT_PATH_COLOR;
    }
    
    if (this.elements.segmentWidth) {
      const width = waypoint.segmentWidth || 3;
      this.elements.segmentWidth.value = pathWidthToSlider(width);
      setRangeReadout(
        this.elements.segmentWidth,
        this.elements.segmentWidthValue,
        formatRendererPixels(width, 1)
      );
    }
    
    if (this.elements.segmentStyle) {
      this.elements.segmentStyle.value = waypoint.segmentStyle || 'solid';
    }
    
    if (this.elements.pathShape) {
      this.elements.pathShape.value = waypoint.pathShape || 'line';
    }
    
    if (this.elements.editorBeaconStyle) {
      this.elements.editorBeaconStyle.value = waypoint.beaconStyle || 'none';
      // Update conditional visibility for beacon-specific controls
      updateConditionalVisibility('editor-beacon-style', waypoint.beaconStyle || 'none');
    }
    
    // Update ripple-specific controls
    if (this.elements.rippleThickness) {
      const thickness = waypoint.rippleThickness || 2;
      this.elements.rippleThickness.value = thickness;
      if (this.elements.rippleThicknessValue) {
        setRangeReadout(
          this.elements.rippleThickness,
          this.elements.rippleThicknessValue,
          formatRendererPixels(thickness, Number.isInteger(thickness) ? 0 : 1)
        );
      }
    }
    
    if (this.elements.rippleMaxScale) {
      const maxScale = waypoint.rippleMaxScale || 1000;
      this.elements.rippleMaxScale.value = maxScale;
      if (this.elements.rippleMaxScaleValue) {
        this.elements.rippleMaxScaleValue.textContent = `${maxScale}%`;
      }
    }
    
    if (this.elements.rippleWait) {
      this.elements.rippleWait.checked = waypoint.rippleWait !== false; // Default to true
    }
    
    if (this.elements.waypointLabel) {
      this.elements.waypointLabel.value = waypoint.label || '';
    }
    
    if (this.elements.labelMode) {
      this.elements.labelMode.value = waypoint.labelMode || 'off';
    }
    
    if (this.elements.labelPosition) {
      this.elements.labelPosition.value = waypoint.labelPosition || 'auto';
    }
    
    if (this.elements.waypointPauseTime) {
      const pauseSeconds = (waypoint.pauseTime || 0) / 1000;
      // Convert seconds to slider value using logarithmic scale
      this.elements.waypointPauseTime.value = this.pauseTimeToSlider(pauseSeconds);
      // Format display nicely
      this.elements.waypointPauseTimeValue.textContent = MotionVisibilityService.formatUIValue(pauseSeconds, 's');
    }
    
    // Update segment speed slider
    if (this.elements.waypointSegmentSpeed) {
      const speed = waypoint.segmentSpeed || 1.0;
      this.elements.waypointSegmentSpeed.value = this.segmentSpeedToSlider(speed);
      const displaySpeed = speed < 1 ? speed.toFixed(2) : MotionVisibilityService.formatUIValue(speed);
      this.elements.waypointSegmentSpeedValue.textContent = `${displaySpeed}x`;
    }
    
    // Update pause control visibility
    const pauseControl = this.elements.pauseTimeControl;
    if (pauseControl) {
      pauseControl.style.display = waypoint.isMajor ? 'block' : 'none';
    }
    
    // Segment speed is keyframed on majors only: minor waypoints are geometry
    // (they shape the path) and never carry their own leg timing, so the
    // control is hidden for them. Mirrors the pause control above and the
    // major-leg timing model. See decision-log: major-leg keyframing.
    const speedControl = this.elements.segmentSpeedControl;
    if (speedControl) {
      speedControl.style.display = waypoint.isMajor ? 'block' : 'none';
    }
    
    // ========== AREA HIGHLIGHT CONTROLS ==========
    this._syncAreaHighlightControls(waypoint);
  }
  
  /**
   * Sync all area highlight controls with the selected waypoint's areaHighlight state
   * Called from updateWaypointEditor when a waypoint is selected
   * 
   * @private
   * @param {Object} waypoint - Selected waypoint
   */
  _syncAreaHighlightControls(waypoint) {
    if (!waypoint) return;
    const ah = waypoint.areaHighlight;
    
    // Shape dropdown
    if (this.elements.areaShape) {
      this.elements.areaShape.value = ah.shape || 'none';
    }
    
    // Circle radius slider (reverse map from value to 0-1000)
    if (this.elements.areaCircleRadius) {
      const range = AREA_HIGHLIGHT.CIRCLE_RADIUS_MAX - AREA_HIGHLIGHT.CIRCLE_RADIUS_MIN;
      const sliderVal = Math.round(((ah.radius - AREA_HIGHLIGHT.CIRCLE_RADIUS_MIN) / range) * 1000);
      this.elements.areaCircleRadius.value = Math.max(0, Math.min(1000, sliderVal));
      if (this.elements.areaCircleRadiusValue) {
        this.elements.areaCircleRadiusValue.textContent = `${Math.round(ah.radius * 100)}%`;
      }
    }
    
    // Rectangle width/height sliders
    if (this.elements.areaRectWidth) {
      const range = AREA_HIGHLIGHT.RECT_SIZE_MAX - AREA_HIGHLIGHT.RECT_SIZE_MIN;
      this.elements.areaRectWidth.value = Math.round(((ah.width - AREA_HIGHLIGHT.RECT_SIZE_MIN) / range) * 1000);
      if (this.elements.areaRectWidthValue) {
        this.elements.areaRectWidthValue.textContent = `${Math.round(ah.width * 100)}%`;
      }
    }
    if (this.elements.areaRectHeight) {
      const range = AREA_HIGHLIGHT.RECT_SIZE_MAX - AREA_HIGHLIGHT.RECT_SIZE_MIN;
      this.elements.areaRectHeight.value = Math.round(((ah.height - AREA_HIGHLIGHT.RECT_SIZE_MIN) / range) * 1000);
      if (this.elements.areaRectHeightValue) {
        this.elements.areaRectHeightValue.textContent = `${Math.round(ah.height * 100)}%`;
      }
    }
    
    // Fill colour + opacity
    if (this.elements.areaFillColor) {
      this.elements.areaFillColor.value = ah.fillColor || AREA_HIGHLIGHT.FILL_COLOR_DEFAULT;
    }
    if (this.elements.areaFillOpacity) {
      const pct = Math.round((ah.fillOpacity ?? AREA_HIGHLIGHT.FILL_OPACITY_DEFAULT) * 100);
      this.elements.areaFillOpacity.value = pct;
      if (this.elements.areaFillOpacityValue) {
        this.elements.areaFillOpacityValue.textContent = `${pct}%`;
      }
    }
    
    // Border colour, style, width
    if (this.elements.areaBorderColor) {
      this.elements.areaBorderColor.value = ah.borderColor || AREA_HIGHLIGHT.BORDER_COLOR_DEFAULT;
    }
    if (this.elements.areaBorderStyle) {
      this.elements.areaBorderStyle.value = ah.borderStyle || AREA_HIGHLIGHT.BORDER_STYLE_DEFAULT;
    }
    if (this.elements.areaBorderWidth) {
      this.elements.areaBorderWidth.value = ah.borderWidth || AREA_HIGHLIGHT.BORDER_WIDTH_DEFAULT;
      if (this.elements.areaBorderWidthValue) {
        setRangeReadout(
          this.elements.areaBorderWidth,
          this.elements.areaBorderWidthValue,
          formatRendererPixels(ah.borderWidth || AREA_HIGHLIGHT.BORDER_WIDTH_DEFAULT)
        );
      }
    }
    
    // Visibility
    if (this.elements.areaVisibility) {
      this.elements.areaVisibility.value = ah.visibility || AREA_HIGHLIGHT.VISIBILITY_DEFAULT;
    }
    
    // Fade sliders
    if (this.elements.areaFadeIn) {
      this.elements.areaFadeIn.value = ah.fadeInMs ?? AREA_HIGHLIGHT.FADE_IN_DEFAULT;
      if (this.elements.areaFadeInValue) {
        this.elements.areaFadeInValue.textContent = `${((ah.fadeInMs ?? AREA_HIGHLIGHT.FADE_IN_DEFAULT) / 1000).toFixed(1)}s`;
      }
    }
    if (this.elements.areaFadeOut) {
      this.elements.areaFadeOut.value = ah.fadeOutMs ?? AREA_HIGHLIGHT.FADE_OUT_DEFAULT;
      if (this.elements.areaFadeOutValue) {
        this.elements.areaFadeOutValue.textContent = `${((ah.fadeOutMs ?? AREA_HIGHLIGHT.FADE_OUT_DEFAULT) / 1000).toFixed(1)}s`;
      }
    }
    
    // Request swatch picker refresh for area colours (handled by main.js)
    this.eventBus.emit('ui:refresh-swatches', { targets: ['#area-fill-color', '#area-border-color'] });
    
    // Toggle sub-control visibility based on shape
    this._updateAreaSubControls(ah.shape || 'none');
  }
  
  /**
   * Toggle visibility of area highlight sub-controls based on selected shape
   * Shows/hides circle, rectangle, polygon, fill, border, visibility, and delete controls
   * 
   * @private
   * @param {string} shape - Shape type: 'none', 'circle', 'rectangle', 'polygon'
   */
  _updateAreaSubControls(shape) {
    const isActive = shape !== 'none';
    const isCircle = shape === 'circle';
    const isRect = shape === 'rectangle';
    const isPoly = shape === 'polygon';
    
    // Shape-specific geometry controls
    if (this.elements.areaCircleControls) this.elements.areaCircleControls.style.display = isCircle ? '' : 'none';
    if (this.elements.areaRectControls) this.elements.areaRectControls.style.display = isRect ? '' : 'none';
    if (this.elements.areaDrawControls) this.elements.areaDrawControls.style.display = isPoly ? '' : 'none';
    
    // Shared controls (fill, border, visibility, delete) — visible when any shape is active
    if (this.elements.areaFillControls) this.elements.areaFillControls.style.display = isActive ? '' : 'none';
    if (this.elements.areaBorderControls) this.elements.areaBorderControls.style.display = isActive ? '' : 'none';
    if (this.elements.areaVisibilityControls) this.elements.areaVisibilityControls.style.display = isActive ? '' : 'none';
    if (this.elements.areaDeleteControls) this.elements.areaDeleteControls.style.display = isActive ? '' : 'none';
  }
  
  /**
   * Sync animation controls with animation state
   */
  syncAnimationControls(state) {
    // Toggle play/pause button visibility
    if (state.isPlaying) {
      if (this.elements.playBtn) this.elements.playBtn.style.display = 'none';
      if (this.elements.pauseBtn) this.elements.pauseBtn.style.display = 'inline-block';
    } else {
      if (this.elements.playBtn) this.elements.playBtn.style.display = 'inline-block';
      if (this.elements.pauseBtn) this.elements.pauseBtn.style.display = 'none';
    }
    
    // Update timeline
    if (this.elements.timelineSlider && !state.isDraggingTimeline) {
      this.elements.timelineSlider.value = Math.round(state.progress * ANIMATION.TIMELINE_RESOLUTION);
    }
    
    // Update time display
    this.updateTimeDisplay(state.currentTime, state.duration);
  }
  
  /**
   * Update time display
   */
  updateTimeDisplay(currentTime, duration) {
    const formatTime = (ms) => {
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    
    if (this.elements.currentTime) {
      this.elements.currentTime.textContent = formatTime(currentTime);
    }
    if (this.elements.totalTime) {
      this.elements.totalTime.textContent = formatTime(duration);
    }
  }
  
  /**
   * Show help/splash screen
   * Populates help content from centralized source
   */
  showHelp() {
    if (this.elements.splash) {
      // Populate help content from centralized source
      const helpContainer = document.getElementById('splash-help');
      if (helpContainer) {
        helpContainer.innerHTML = getSplashHelpHTML();
      }
      this.elements.splash.style.display = 'flex';
    }
  }
  
  /**
   * Hide help/splash screen
   */
  hideHelp() {
    if (this.elements.splash) {
      this.elements.splash.style.display = 'none';
    }
  }
  
  /**
   * Make an announcement for screen readers
   */
  announce(message) {
    if (this.elements.announcer) {
      this.elements.announcer.textContent = message;
    }
  }
  
  /**
   * Set export resolution and update UI inputs
   * @param {number} width - Export width in pixels
   * @param {number} height - Export height in pixels
   */
  setExportResolution(width, height) {
    if (this.elements.exportResX) {
      this.elements.exportResX.value = width;
    }
    if (this.elements.exportResY) {
      this.elements.exportResY.value = height;
    }
    this.eventBus.emit('video:resolution-change', { width, height });
  }
  
  /**
   * Convert slider value (0-1000) to pause time in seconds (0-30)
   * Uses power curve for better control at low values
   * @param {number} sliderValue - Slider position 0-1000
   * @returns {number} Time in seconds 0-30
   */
  sliderToPauseTime(sliderValue) {
    if (sliderValue <= 0) return 0;
    // Power curve: slider 0-1000 maps to 0-30 seconds
    const maxSlider = 1000;
    const maxTime = 30;
    const normalized = sliderValue / maxSlider;
    // Use power curve for smoother feel: time = maxTime * (normalized ^ 2.5)
    // This gives more precision at low values
    return maxTime * Math.pow(normalized, 2.5);
  }
  
  /**
   * Convert pause time in seconds to slider value (0-1000)
   * Inverse of sliderToPauseTime
   * @param {number} timeSec - Time in seconds 0-30
   * @returns {number} Slider position 0-1000
   */
  pauseTimeToSlider(timeSec) {
    if (timeSec <= 0) return 0;
    const maxSlider = 1000;
    const maxTime = 30;
    // Inverse of power curve
    const normalized = Math.pow(timeSec / maxTime, 1 / 2.5);
    return Math.round(normalized * maxSlider);
  }
  
  /**
   * Convert slider value (0-1000) to segment speed multiplier
   * Uses symmetric logarithmic scale centered at 1.0x (slider value 500)
   * - Slider 0 → MIN_SPEED (0.1x)
   * - Slider 500 → 1.0x (normal)
   * - Slider 1000 → MAX_SPEED (10x)
   * 
   * @param {number} sliderValue - Slider position 0-1000
   * @returns {number} Speed multiplier (0.1 to 10)
   */
  sliderToSegmentSpeed(sliderValue) {
    const { MIN_SPEED, MAX_SPEED, CENTER, SLIDER_CENTER, SLIDER_MAX } = SEGMENT_SPEED;
    
    if (sliderValue <= SLIDER_CENTER) {
      // Lower half: logarithmic from MIN_SPEED to CENTER
      // normalized: 0 at slider=0, 1 at slider=500
      const normalized = sliderValue / SLIDER_CENTER;
      // Log interpolation: MIN_SPEED * (CENTER/MIN_SPEED)^normalized
      return MIN_SPEED * Math.pow(CENTER / MIN_SPEED, normalized);
    } else {
      // Upper half: logarithmic from CENTER to MAX_SPEED
      // normalized: 0 at slider=500, 1 at slider=1000
      const normalized = (sliderValue - SLIDER_CENTER) / (SLIDER_MAX - SLIDER_CENTER);
      // Log interpolation: CENTER * (MAX_SPEED/CENTER)^normalized
      return CENTER * Math.pow(MAX_SPEED / CENTER, normalized);
    }
  }
  
  /**
   * Convert segment speed multiplier to slider value (0-1000)
   * Inverse of sliderToSegmentSpeed - handles symmetric log scale
   * 
   * @param {number} speed - Speed multiplier (0.1 to 10)
   * @returns {number} Slider position 0-1000
   */
  segmentSpeedToSlider(speed) {
    const { MIN_SPEED, MAX_SPEED, CENTER, SLIDER_CENTER, SLIDER_MAX } = SEGMENT_SPEED;
    
    // Clamp speed to valid range
    const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
    
    if (clampedSpeed <= CENTER) {
      // Lower half: inverse log from MIN_SPEED to CENTER
      // normalized = log(speed/MIN_SPEED) / log(CENTER/MIN_SPEED)
      const normalized = Math.log(clampedSpeed / MIN_SPEED) / Math.log(CENTER / MIN_SPEED);
      return Math.round(normalized * SLIDER_CENTER);
    } else {
      // Upper half: inverse log from CENTER to MAX_SPEED
      // normalized = log(speed/CENTER) / log(MAX_SPEED/CENTER)
      const normalized = Math.log(clampedSpeed / CENTER) / Math.log(MAX_SPEED / CENTER);
      return Math.round(SLIDER_CENTER + normalized * (SLIDER_MAX - SLIDER_CENTER));
    }
  }
  
  /**
   * Get HTML for getting started instructions
   * 
   * Displayed in the waypoint list area when no waypoints exist.
   * Provides quick reference for basic controls and shortcuts.
   * 
   * Uses centralized help content from helpContent.js for consistency.
   * 
   * @returns {string} HTML string for instructions
   */
  getGettingStartedHTML() {
    return getInlineHelpHTML();
  }
}
