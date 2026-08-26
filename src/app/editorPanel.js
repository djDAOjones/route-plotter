/**
 * Waypoint list + waypoint editor panel sync, and per-style control visibility helpers.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, editorPanelMixin).
 */
import { TEXT_LABEL, TEXT_VISIBILITY } from '../config/constants.js';
import { BEACON_TIMING } from '../services/BeaconRenderer.js';
import { MotionVisibilityService } from '../services/MotionVisibilityService.js';
import {
  setSwatchPickerEnabled,
  setSwatchPickerMixed,
} from '../components/SwatchPicker.js';
import { sliderToPathWidth, pathWidthToSlider } from '../utils/pathWidthScale.js';
import {
  MIXED_OPTION_VALUE,
  hasMixedValues,
  setCheckboxMixed,
  setRangeMixed,
  setSelectMixed,
} from '../utils/mixedControlState.js';
import {
  formatRendererPixels,
  formatShapeAmplitude,
  setRangeReadout,
} from '../utils/uiReadouts.js';
import {
  WAYPOINT_CARD,
  applyWaypointCardOnward,
  getWaypointCardActionState,
  resetWaypointCard,
} from '../utils/waypointCardActions.js';

const WAYPOINT_CARD_LABELS = Object.freeze({
  [WAYPOINT_CARD.MARKER]: 'Marker',
  [WAYPOINT_CARD.ON_ARRIVAL]: 'On arrival',
  [WAYPOINT_CARD.LABEL]: 'Label style',
  [WAYPOINT_CARD.LEG]: 'Leg',
});

const MAJOR_ONLY_CARDS = new Set([
  WAYPOINT_CARD.MARKER,
  WAYPOINT_CARD.ON_ARRIVAL,
  WAYPOINT_CARD.LABEL,
]);

export const editorPanelMixin = {

  /**
   * Waypoints an inspector-card edit should write to: the multi-selection
   * when one exists, else the single selection (Phase 4 multi-select —
   * every card honours the whole selection). Callers write to each target
   * and then emit their usual change event once, so the downstream
   * pipeline still runs one path recalc and one debounced undo entry
   * per gesture.
   * @param {boolean} [majorsOnly=false] - Filter to majors, for
   *   properties that only exist on major waypoints (beacons, labels,
   *   pauses, camera, marker styling)
   * @returns {Array<Object>} Waypoints to write to
   */
  selectionTargets(majorsOnly = false) {
    const targets = (this.selectedWaypoints && this.selectedWaypoints.length > 0)
      ? this.selectedWaypoints
      : (this.selectedWaypoint ? [this.selectedWaypoint] : []);
    return majorsOnly ? targets.filter(wp => wp.isMajor) : targets;
  },

  _waypointCardSource(card) {
    if (this.selectionTargets().length !== 1) return null;
    if (MAJOR_ONLY_CARDS.has(card) && this.selectedWaypoint?.isMajor === false) return null;
    return this.selectedWaypoint;
  },

  _syncWaypointCardActions() {
    const selection = this.selectionTargets();
    const waypointScope = document.getElementById('waypoint-scope');
    if (!waypointScope) return;

    for (const card of Object.values(WAYPOINT_CARD)) {
      const state = getWaypointCardActionState({
        card,
        waypoints: this.waypoints,
        selection,
        source: this._waypointCardSource(card),
        styles: this.styles,
      });
      const label = WAYPOINT_CARD_LABELS[card];
      const reset = waypointScope.querySelector(`[data-card="${card}"][data-card-action="reset"]`);
      const apply = waypointScope.querySelector(`[data-card="${card}"][data-card-action="apply-onward"]`);
      if (reset) {
        reset.disabled = !state.canReset;
        reset.title = state.resetReason;
        reset.setAttribute('aria-label', state.canReset
          ? `Reset ${label} to route style`
          : `Reset ${label}: ${state.resetReason}`);
      }
      if (apply) {
        apply.disabled = !state.canApplyOnward;
        apply.title = state.applyReason;
        apply.setAttribute('aria-label', state.canApplyOnward
          ? `Apply ${label} onward`
          : `Apply ${label} onward: ${state.applyReason}`);
      }
    }
  },

  _handleWaypointCardAction(card, action) {
    if (!Object.values(WAYPOINT_CARD).includes(card)) return;
    const selection = this.selectionTargets();
    const source = this._waypointCardSource(card);
    const state = getWaypointCardActionState({
      card,
      waypoints: this.waypoints,
      selection,
      source,
      styles: this.styles,
    });
    if ((action === 'reset' && !state.canReset) ||
        (action === 'apply-onward' && !state.canApplyOnward)) return;
    if (action !== 'reset' && action !== 'apply-onward') return;

    // Resolve any preceding slider gesture before this discrete action so Undo
    // reaches the exact state the author saw before clicking.
    this._flushPendingUndo?.();
    const result = action === 'reset'
      ? resetWaypointCard(card, selection, this.styles)
      : applyWaypointCardOnward(card, this.waypoints, source);
    if (result.changedWaypoints.length === 0) {
      this._syncWaypointCardActions();
      return;
    }

    if (result.effects.beacons) {
      for (const waypoint of result.changedWaypoints) {
        this.renderingService?.beaconRenderer?.resetBeacon?.(waypoint.id);
      }
    }
    if (result.effects.path) {
      this.calculatePath();
    } else if (result.effects.timing) {
      this.updateAnimationDuration();
    }
    this.validateZoomTransitions?.();
    if (result.effects.list) this.uiController?.updateWaypointList(this.waypoints);
    this.updateWaypointEditor();
    this.queueRender();
    this.saveUndoState();
    this.autoSave();

    const label = WAYPOINT_CARD_LABELS[card];
    const count = result.changedWaypoints.length;
    this.announce?.(action === 'reset'
      ? `${label} reset for ${count} ${count === 1 ? 'waypoint' : 'waypoints'}. Undo is available.`
      : `${label} applied to ${count} later ${count === 1 ? 'waypoint' : 'waypoints'}. Undo is available.`);
  },

  /**
   * Show/hide ripple-specific controls based on beacon style
   * @param {string} beaconStyle - Current beacon style
   * @private
   */
  _updateBeaconControlsVisibility(beaconStyle) {
    // Show/hide ripple controls
    if (this.elements.rippleControls) {
      this.elements.rippleControls.style.display = beaconStyle === 'ripple' ? 'block' : 'none';
    }
    // Show/hide pulse controls
    if (this.elements.pulseControls) {
      this.elements.pulseControls.style.display = beaconStyle === 'pulse' ? 'block' : 'none';
    }
  },
  
  /**
   * @deprecated Use _updateBeaconControlsVisibility instead
   */
  _updateRippleControlsVisibility(beaconStyle) {
    this._updateBeaconControlsVisibility(beaconStyle);
  },
  
  /**
   * Convert slider value (0-1000) to path width (1-40)
   * Uses logarithmic scale for finer control at lower values
   * @param {number} sliderValue - Slider position 0-1000
   * @returns {number} Path width 1-40
   * @private
   */
  _sliderToPathWidth(sliderValue) {
    return sliderToPathWidth(sliderValue);
  },

  /**
   * Convert path width (1-40) to slider value (0-1000)
   * Inverse of _sliderToPathWidth
   * @param {number} width - Path width 1-40
   * @returns {number} Slider position 0-1000
   * @private
   */
  _pathWidthToSlider(width) {
    return pathWidthToSlider(width);
  },
  
  /**
   * Show/hide shape parameter controls based on selected shape
   * @param {string} shape - The path shape (line, squiggle, randomised)
   * @private
   */
  _updateShapeParamsVisibility(shape) {
    if (this.elements.shapeParamsControls) {
      const showParams = shape === 'squiggle' || shape === 'randomised';
      this.elements.shapeParamsControls.style.display = showParams ? 'block' : 'none';
    }
  },
  
  /**
   * Update pause time based on ripple animation duration
   * 
   * Formula: totalTime = (maxScale / 1000) × RIPPLE_COUNT seconds
   * - Each ring takes (maxScale / 1000) seconds to complete its full animation
   * - Rings spawn at intervals equal to their duration
   * - Wait until the LAST ring has FINISHED (not just started)
   * - Example: 4 rings at 1000% scale = 4 × 1s = 4s total
   * 
   * @private
   */
  _updateRippleWaitTime() {
    // Applies to every selected major with ripple wait enabled — a
    // multi-selection edit re-times each waypoint from its own maxScale
    const targets = this.selectionTargets(true);
    if (targets.length === 0) return;

    for (const wp of targets) {
      if (!(wp.rippleWait && wp.beaconStyle === 'ripple')) continue;

      // Calculate total ripple animation time using constants
      // Each ring takes (maxScale / 1000) seconds to complete its growth and fade
      // Rings spawn at intervals equal to their duration
      // Wait until the LAST ring has FINISHED (not just started)
      // Formula: (RIPPLE_COUNT rings × durationPerRing) = time when last ring finishes
      const maxScale = wp.rippleMaxScale || 1000;
      const durationPerRing = maxScale / 1000; // seconds (1000% = 1s)
      const totalRippleTime = durationPerRing * BEACON_TIMING.RIPPLE_COUNT; // All rings complete

      // Set pause time to match ripple animation
      wp.pauseTime = totalRippleTime * 1000; // convert to ms
      wp.pauseMode = 'timed';

      // Update UI via UIController (pause slider shows the primary's value)
      if (wp === this.selectedWaypoint && this.uiController && this.elements.waypointPauseTime) {
        this.elements.waypointPauseTime.value = this.uiController.pauseTimeToSlider(totalRippleTime);
        this.elements.waypointPauseTimeValue.textContent = `${totalRippleTime.toFixed(1)}s`;
      }

      console.debug(`🔔 [Beacon] Ripple wait enabled - set pause time to ${totalRippleTime.toFixed(1)}s`);
    }

    // Trigger animation duration recalculation
    this.updateAnimationDuration();
  },
  
  updateWaypointList() {
    // Set display indices for waypoints (1-based, major only)
    let majorIndex = 1;
    this.waypoints.forEach(wp => {
      if (wp.isMajor) {
        wp._displayIndex = majorIndex++;
      }
    });
    
    // Emit event for SectionController to update UI state
    this.eventBus.emit('waypoint:list-updated', this.waypoints);
    
    // Delegate to UIController
    if (this.uiController) {
      this.uiController.updateWaypointList(this.waypoints);
      return;
    }
    
    // Fallback if UIController not initialized
    this.elements.waypointList.innerHTML = '';
    const majorWaypoints = this.waypoints.filter(wp => wp.isMajor);
    
    majorWaypoints.forEach((waypoint, index) => {
      const item = document.createElement('div');
      item.className = 'waypoint-item';
      if (waypoint === this.selectedWaypoint) {
        item.classList.add('selected');
      }
      
      // Header row
      const handle = document.createElement('span');
      handle.className = 'waypoint-item-handle';
      handle.textContent = '☰';
      const label = document.createElement('span');
      label.className = 'waypoint-item-label';
      label.textContent = `Waypoint ${index + 1}`;
      const delBtn = document.createElement('button');
      delBtn.className = 'waypoint-item-delete';
      delBtn.textContent = '×';
      
      item.appendChild(handle);
      item.appendChild(label);
      item.appendChild(delBtn);
      
      // Selection by clicking header bits
      const selectWaypoint = (e) => {
        e.stopPropagation();
        this.eventBus.emit('waypoint:selected', waypoint);
      };
      label.addEventListener('click', selectWaypoint);
      handle.addEventListener('click', selectWaypoint);
      item.addEventListener('click', selectWaypoint);
      
      // Delete button
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteWaypoint(waypoint);
      });
      
      this.elements.waypointList.appendChild(item);
    });
  },

  /**
   * Synchronize controls whose write target is selected major waypoints. The
   * source is always one of those targets, even when a minor is primary.
   * @param {Object|null} source
   * @param {Array<Object>} majorTargets
   * @private
   */
  _syncMajorWaypointControls(source, majorTargets) {
    const enabled = Boolean(source);
    const disableWhenUnavailable = [
      'markerStyle', 'dotSize', 'editorBeaconStyle',
      'rippleThickness', 'rippleMaxScale', 'rippleWait',
      'pulseAmplitude', 'pulseCycleSpeed', 'waypointLabel', 'labelMode',
      'labelSize', 'labelBgOpacity', 'labelWidth', 'labelOffsetX',
      'labelOffsetY', 'labelAutoPosition', 'waypointPauseTime',
      'waypointSegmentSpeed', 'markerUploadBtn',
    ];
    for (const key of disableWhenUnavailable) {
      if (this.elements[key]) this.elements[key].disabled = !enabled;
    }
    if (this.elements.dotColor) this.elements.dotColor.disabled = !enabled;
    if (this.elements.labelColor) this.elements.labelColor.disabled = !enabled;
    if (this.elements.labelBgColor) this.elements.labelBgColor.disabled = !enabled;
    setSwatchPickerEnabled('#dot-color', enabled);
    setSwatchPickerEnabled('#label-color', enabled);
    setSwatchPickerEnabled('#label-bg-color', enabled);

    if (!source) {
      this._updateBeaconControlsVisibility('none');
      if (this.elements.customMarkerControls) this.elements.customMarkerControls.style.display = 'none';
      if (this.elements.markerPreview) this.elements.markerPreview.style.display = 'none';
      if (this.elements.pauseTimeControl) this.elements.pauseTimeControl.style.display = 'none';
      if (this.elements.segmentSpeedControl) this.elements.segmentSpeedControl.style.display = 'none';
      return;
    }

    const markerStyle = source.markerStyle || 'dot';
    if (this.elements.markerStyle) this.elements.markerStyle.value = markerStyle;
    if (this.elements.dotColor) {
      this.elements.dotColor.value = source.dotColor || source.segmentColor || this.styles.dotColor;
    }
    if (this.elements.dotSize) {
      const size = source.dotSize || this.styles.dotSize;
      this.elements.dotSize.value = size;
      setRangeReadout(this.elements.dotSize, this.elements.dotSizeValue, formatRendererPixels(size));
    }
    if (this.elements.customMarkerControls) {
      this.elements.customMarkerControls.style.display = markerStyle === 'custom' ? 'block' : 'none';
    }
    if (source.customImageAssetId && this.elements.markerPreview) {
      const asset = this.imageAssetService?.getAsset(source.customImageAssetId);
      if (asset) {
        this.elements.markerPreview.style.display = 'block';
        this.elements.markerFilename.textContent = asset.name;
        this.elements.markerPreviewImg.hidden = false;
        this.elements.markerPreviewImg.src = asset.base64;
      } else {
        this.elements.markerPreview.style.display = 'none';
      }
    } else if (this.elements.markerPreview) {
      this.elements.markerPreview.style.display = 'none';
      if (this.elements.markerPreviewImg) this.elements.markerPreviewImg.hidden = false;
    }

    const beaconStyle = source.beaconStyle || 'none';
    if (this.elements.editorBeaconStyle) this.elements.editorBeaconStyle.value = beaconStyle;
    this._updateBeaconControlsVisibility(beaconStyle);
    if (this.elements.rippleThickness) {
      const value = source.rippleThickness || 2;
      this.elements.rippleThickness.value = value;
      setRangeReadout(
        this.elements.rippleThickness,
        this.elements.rippleThicknessValue,
        formatRendererPixels(value, Number.isInteger(value) ? 0 : 1)
      );
    }
    if (this.elements.rippleMaxScale) {
      const value = source.rippleMaxScale || 1000;
      this.elements.rippleMaxScale.value = value;
      this.elements.rippleMaxScaleValue.textContent = `${value}%`;
    }
    if (this.elements.rippleWait) this.elements.rippleWait.checked = source.rippleWait !== false;
    if (this.elements.pulseAmplitude) {
      const value = source.pulseAmplitude ?? 1;
      this.elements.pulseAmplitude.value = value;
      this.elements.pulseAmplitudeValue.textContent = value.toFixed(1);
    }
    if (this.elements.pulseCycleSpeed) {
      const value = source.pulseCycleSpeed ?? 4;
      this.elements.pulseCycleSpeed.value = value;
      this.elements.pulseCycleSpeedValue.textContent = `${value}s`;
    }

    if (this.elements.waypointLabel) this.elements.waypointLabel.value = source.label || '';
    if (this.elements.labelMode) this.elements.labelMode.value = source.labelMode || TEXT_VISIBILITY.FADE_UP;
    if (this.elements.labelSize) {
      const size = Math.max(
        TEXT_LABEL.SIZE_PX_MIN,
        Math.min(TEXT_LABEL.SIZE_PX_MAX, Math.round(source.labelSize || TEXT_LABEL.SIZE_DEFAULT))
      );
      this.elements.labelSize.value = size;
      setRangeReadout(this.elements.labelSize, this.elements.labelSizeValue, formatRendererPixels(size));
    }
    if (this.elements.labelColor) {
      this.elements.labelColor.value = source.labelColor || TEXT_LABEL.COLOR_DEFAULT;
    }
    if (this.elements.labelBgColor) {
      this.elements.labelBgColor.value = source.labelBgColor || TEXT_LABEL.BG_COLOR_DEFAULT;
    }
    if (this.elements.labelBgOpacity) {
      const value = Math.round((source.labelBgOpacity ?? TEXT_LABEL.BG_OPACITY_DEFAULT) * 100);
      this.elements.labelBgOpacity.value = value;
      setRangeReadout(this.elements.labelBgOpacity, this.elements.labelBgOpacityValue, `${value}%`);
    }
    if (this.elements.labelWidth) {
      const value = source.labelWidth ?? TEXT_LABEL.WIDTH_DEFAULT;
      this.elements.labelWidth.value = value;
      this.elements.labelWidthValue.textContent = `${value}%`;
    }
    if (this.elements.labelOffsetX) {
      const value = source.labelOffsetX ?? TEXT_LABEL.OFFSET_DEFAULT_X;
      this.elements.labelOffsetX.value = value;
      this.elements.labelOffsetXValue.textContent = `${value}%`;
    }
    if (this.elements.labelOffsetY) {
      const value = source.labelOffsetY ?? TEXT_LABEL.OFFSET_DEFAULT_Y;
      this.elements.labelOffsetY.value = value;
      this.elements.labelOffsetYValue.textContent = `${value}%`;
    }

    const pauseSeconds = (source.pauseTime || 0) / 1000;
    if (this.elements.waypointPauseTime) {
      this.elements.waypointPauseTime.value = this.uiController?.pauseTimeToSlider
        ? this.uiController.pauseTimeToSlider(pauseSeconds)
        : pauseSeconds;
      this.elements.waypointPauseTimeValue.textContent =
        MotionVisibilityService.formatUIValue(pauseSeconds, 's');
    }
    if (this.elements.pauseTimeControl) this.elements.pauseTimeControl.style.display = 'flex';

    const speed = source.segmentSpeed || 1;
    if (this.elements.waypointSegmentSpeed) {
      this.elements.waypointSegmentSpeed.value = this.uiController?.segmentSpeedToSlider
        ? this.uiController.segmentSpeedToSlider(speed)
        : speed;
      const display = speed < 1 ? speed.toFixed(2) : MotionVisibilityService.formatUIValue(speed);
      this.elements.waypointSegmentSpeedValue.textContent = `${display}x`;
    }
    if (this.elements.segmentSpeedControl) this.elements.segmentSpeedControl.style.display = 'flex';

    // Keep the ordinary checkbox value meaningful before an optional mixed
    // overlay is applied below.
    setCheckboxMixed(this.elements.rippleWait, false);
  },

  /**
   * Overlay mixed presentation after ordinary source synchronization.
   * @param {Array<Object>} targets
   * @param {Array<Object>} majorTargets
   * @private
   */
  _applyWaypointMixedStates(targets, majorTargets) {
    const mixed = (items, read) => hasMixedValues(items, read);
    const colour = value => String(value || '').toLowerCase();
    const markSelect = (element, items, read) => {
      const value = mixed(items, read);
      setSelectMixed(element, value);
      return value;
    };
    const markRange = (element, readout, items, read) => {
      const value = mixed(items, read);
      setRangeMixed(element, readout, value);
      return value;
    };

    const pathShapeMixed = markSelect(this.elements.pathShape, targets, wp => wp.pathShape || 'line');
    markSelect(this.elements.segmentStyle, targets, wp => wp.segmentStyle || 'solid');
    setSwatchPickerMixed('#segment-color', mixed(targets, wp => colour(wp.segmentColor)));
    markRange(this.elements.segmentWidth, this.elements.segmentWidthValue, targets, wp => wp.segmentWidth || 3);
    markRange(this.elements.shapeAmplitude, this.elements.shapeAmplitudeValue, targets, wp => wp.shapeAmplitude ?? 10);
    markRange(this.elements.shapeFrequency, this.elements.shapeFrequencyValue, targets, wp => wp.shapeFrequency ?? 5);
    if (pathShapeMixed) this._updateShapeParamsVisibility(MIXED_OPTION_VALUE);

    const markerStyleMixed = markSelect(this.elements.markerStyle, majorTargets, wp => wp.markerStyle || 'dot');
    setSwatchPickerMixed('#dot-color', mixed(majorTargets, wp => colour(wp.dotColor)));
    markRange(this.elements.dotSize, this.elements.dotSizeValue, majorTargets, wp => wp.dotSize || 8);
    if (markerStyleMixed && this.elements.customMarkerControls) {
      this.elements.customMarkerControls.style.display = 'none';
    }
    const markerImagesMixed = mixed(majorTargets, wp => wp.customImageAssetId || null);
    if (!markerStyleMixed
      && majorTargets[0]?.markerStyle === 'custom'
      && markerImagesMixed
      && this.elements.markerPreview) {
      this.elements.markerPreview.style.display = 'block';
      this.elements.markerFilename.textContent = 'Mixed images';
      if (this.elements.markerPreviewImg) this.elements.markerPreviewImg.hidden = true;
    }

    const beaconStyleMixed = markSelect(
      this.elements.editorBeaconStyle,
      majorTargets,
      wp => wp.beaconStyle || 'none'
    );
    markRange(this.elements.rippleThickness, this.elements.rippleThicknessValue, majorTargets, wp => wp.rippleThickness || 2);
    markRange(this.elements.rippleMaxScale, this.elements.rippleMaxScaleValue, majorTargets, wp => wp.rippleMaxScale || 1000);
    setCheckboxMixed(this.elements.rippleWait, mixed(majorTargets, wp => wp.rippleWait !== false));
    markRange(this.elements.pulseAmplitude, this.elements.pulseAmplitudeValue, majorTargets, wp => wp.pulseAmplitude ?? 1);
    markRange(this.elements.pulseCycleSpeed, this.elements.pulseCycleSpeedValue, majorTargets, wp => wp.pulseCycleSpeed ?? 4);
    markRange(this.elements.waypointPauseTime, this.elements.waypointPauseTimeValue, majorTargets, wp => wp.pauseTime || 0);
    markRange(this.elements.waypointSegmentSpeed, this.elements.waypointSegmentSpeedValue, majorTargets, wp => wp.segmentSpeed || 1);
    if (beaconStyleMixed) this._updateBeaconControlsVisibility(MIXED_OPTION_VALUE);

    markSelect(this.elements.labelMode, majorTargets, wp => wp.labelMode || TEXT_VISIBILITY.FADE_UP);
    markRange(this.elements.labelSize, this.elements.labelSizeValue, majorTargets, wp => wp.labelSize || TEXT_LABEL.SIZE_DEFAULT);
    setSwatchPickerMixed('#label-color', mixed(majorTargets, wp => colour(wp.labelColor || TEXT_LABEL.COLOR_DEFAULT)));
    setSwatchPickerMixed('#label-bg-color', mixed(majorTargets, wp => colour(wp.labelBgColor || TEXT_LABEL.BG_COLOR_DEFAULT)));
    markRange(this.elements.labelBgOpacity, this.elements.labelBgOpacityValue, majorTargets, wp => wp.labelBgOpacity ?? TEXT_LABEL.BG_OPACITY_DEFAULT);
    markRange(this.elements.labelWidth, this.elements.labelWidthValue, majorTargets, wp => wp.labelWidth ?? TEXT_LABEL.WIDTH_DEFAULT);
    markRange(this.elements.labelOffsetX, this.elements.labelOffsetXValue, majorTargets, wp => wp.labelOffsetX ?? TEXT_LABEL.OFFSET_DEFAULT_X);
    markRange(this.elements.labelOffsetY, this.elements.labelOffsetYValue, majorTargets, wp => wp.labelOffsetY ?? TEXT_LABEL.OFFSET_DEFAULT_Y);

    const areaShapeMixed = markSelect(this.elements.areaShape, targets, wp => wp.areaHighlight.shape || 'none');
    markRange(this.elements.areaCircleRadius, this.elements.areaCircleRadiusValue, targets, wp => wp.areaHighlight.radius);
    markRange(this.elements.areaRectWidth, this.elements.areaRectWidthValue, targets, wp => wp.areaHighlight.width);
    markRange(this.elements.areaRectHeight, this.elements.areaRectHeightValue, targets, wp => wp.areaHighlight.height);
    setSwatchPickerMixed('#area-fill-color', mixed(targets, wp => colour(wp.areaHighlight.fillColor)));
    markRange(this.elements.areaFillOpacity, this.elements.areaFillOpacityValue, targets, wp => wp.areaHighlight.fillOpacity);
    setSwatchPickerMixed('#area-border-color', mixed(targets, wp => colour(wp.areaHighlight.borderColor)));
    markSelect(this.elements.areaBorderStyle, targets, wp => wp.areaHighlight.borderStyle);
    markRange(this.elements.areaBorderWidth, this.elements.areaBorderWidthValue, targets, wp => wp.areaHighlight.borderWidth);
    markSelect(this.elements.areaVisibility, targets, wp => wp.areaHighlight.visibility);
    markRange(this.elements.areaFadeIn, this.elements.areaFadeInValue, targets, wp => wp.areaHighlight.fadeInMs);
    markRange(this.elements.areaFadeOut, this.elements.areaFadeOutValue, targets, wp => wp.areaHighlight.fadeOutMs);
    if (areaShapeMixed) this.uiController?._updateAreaSubControls(MIXED_OPTION_VALUE);

    const isMulti = targets.length > 1;
    if (this.elements.areaDrawBtn) {
      this.elements.areaDrawBtn.disabled = isMulti;
      this.elements.areaDrawBtn.title = isMulti
        ? 'Draw an area with one waypoint selected'
        : '';
    }
  },
  
  updateWaypointEditor() {
    if (this.selectedWaypoint) {
      const targets = this.selectionTargets();
      const majorTargets = this.selectionTargets(true);
      const majorSource = majorTargets.includes(this.selectedWaypoint)
        ? this.selectedWaypoint
        : majorTargets[0] || null;
      // Note: Section visibility now handled by SectionController via events
      
      // Path properties
      this.elements.segmentColor.value = this.selectedWaypoint.segmentColor;
      // Use log scale conversion for segment width
      const width = this.selectedWaypoint.segmentWidth || 3;
      this.elements.segmentWidth.value = this._pathWidthToSlider(width);
      setRangeReadout(
        this.elements.segmentWidth,
        this.elements.segmentWidthValue,
        formatRendererPixels(width, 1)
      );
      this.elements.segmentStyle.value = this.selectedWaypoint.segmentStyle || 'solid';
      this.elements.pathShape.value = this.selectedWaypoint.pathShape || 'line';
      
      // Shape parameters (amplitude/frequency for squiggle/randomised)
      const shapeAmplitude = this.selectedWaypoint.shapeAmplitude !== undefined ? this.selectedWaypoint.shapeAmplitude : 10;
      const shapeFrequency = this.selectedWaypoint.shapeFrequency !== undefined ? this.selectedWaypoint.shapeFrequency : 5;
      if (this.elements.shapeAmplitude) {
        this.elements.shapeAmplitude.value = shapeAmplitude;
        setRangeReadout(
          this.elements.shapeAmplitude,
          this.elements.shapeAmplitudeValue,
          formatShapeAmplitude(shapeAmplitude)
        );
      }
      if (this.elements.shapeFrequency) {
        this.elements.shapeFrequency.value = shapeFrequency;
        this.elements.shapeFrequencyValue.textContent = shapeFrequency;
      }
      this._updateShapeParamsVisibility(this.selectedWaypoint.pathShape || 'line');
      
      // Marker properties
      this.elements.markerStyle.value = this.selectedWaypoint.markerStyle || 'dot';
      this.elements.dotColor.value = this.selectedWaypoint.dotColor || this.selectedWaypoint.segmentColor || this.styles.dotColor;
      this.elements.dotSize.value = this.selectedWaypoint.dotSize || this.styles.dotSize;
      setRangeReadout(
        this.elements.dotSize,
        this.elements.dotSizeValue,
        formatRendererPixels(this.elements.dotSize.value)
      );
      
      // Custom marker controls visibility
      const markerStyle = this.selectedWaypoint.markerStyle || 'dot';
      if (this.elements.customMarkerControls) {
        this.elements.customMarkerControls.style.display = markerStyle === 'custom' ? 'block' : 'none';
      }
      
      // Update custom marker preview if asset exists
      if (this.selectedWaypoint.customImageAssetId && this.elements.markerPreview) {
        const asset = this.imageAssetService.getAsset(this.selectedWaypoint.customImageAssetId);
        if (asset) {
          this.elements.markerPreview.style.display = 'block';
          this.elements.markerFilename.textContent = asset.name;
          this.elements.markerPreviewImg.src = asset.base64;
        }
      } else if (this.elements.markerPreview) {
        this.elements.markerPreview.style.display = 'none';
      }
      
      // Path head is route-global (decision 2026-08-18). Reading the
      // waypoint's dead pathHead* fields first meant selecting any
      // waypoint reset these controls to defaults while the renderer
      // kept using the real global values.
      this.elements.pathHeadStyle.value = this.styles.pathHead.style;
      this.elements.pathHeadColor.value = this.styles.pathHead.color;
      this.elements.pathHeadSize.value = this.styles.pathHead.size;
      setRangeReadout(
        this.elements.pathHeadSize,
        this.elements.pathHeadSizeValue,
        formatRendererPixels(this.elements.pathHeadSize.value)
      );
      this.elements.customHeadControls.style.display =
        this.styles.pathHead.style === 'custom' ? 'block' : 'none';
      // Beacon editor fields
      if (this.selectedWaypoint.isMajor) {
        // Enable dot & beacon controls for major
        this.elements.dotColor.disabled = false;
        this.elements.dotSize.disabled = false;
        this.elements.editorBeaconStyle.disabled = false;
        this.elements.editorBeaconStyle.value = this.selectedWaypoint.beaconStyle || 'none';
        
        // Show/hide ripple controls and sync values
        const beaconStyle = this.selectedWaypoint.beaconStyle || 'none';
        this._updateRippleControlsVisibility(beaconStyle);
        if (this.elements.rippleThickness) {
          this.elements.rippleThickness.value = this.selectedWaypoint.rippleThickness || 2;
          const value = Number(this.elements.rippleThickness.value);
          setRangeReadout(
            this.elements.rippleThickness,
            this.elements.rippleThicknessValue,
            formatRendererPixels(value, Number.isInteger(value) ? 0 : 1)
          );
        }
        if (this.elements.rippleMaxScale) {
          this.elements.rippleMaxScale.value = this.selectedWaypoint.rippleMaxScale || 1000;
          this.elements.rippleMaxScaleValue.textContent = `${this.elements.rippleMaxScale.value}%`;
        }
        if (this.elements.rippleWait) {
          this.elements.rippleWait.checked = this.selectedWaypoint.rippleWait !== undefined 
            ? this.selectedWaypoint.rippleWait 
            : true; // Default to checked
        }
        
        // Sync pulse controls
        if (this.elements.pulseAmplitude) {
          const amplitude = this.selectedWaypoint.pulseAmplitude !== undefined 
            ? this.selectedWaypoint.pulseAmplitude 
            : 1.0;
          this.elements.pulseAmplitude.value = amplitude;
          this.elements.pulseAmplitudeValue.textContent = amplitude.toFixed(1);
        }
        if (this.elements.pulseCycleSpeed) {
          const cycleSpeed = this.selectedWaypoint.pulseCycleSpeed !== undefined 
            ? this.selectedWaypoint.pulseCycleSpeed 
            : 4.0;
          this.elements.pulseCycleSpeed.value = cycleSpeed;
          this.elements.pulseCycleSpeedValue.textContent = `${cycleSpeed}s`;
        }
        
        // Label controls
        this.elements.waypointLabel.disabled = false;
        this.elements.labelMode.disabled = false;
        this.elements.waypointLabel.value = this.selectedWaypoint.label || '';
        this.elements.labelMode.value = this.selectedWaypoint.labelMode || TEXT_VISIBILITY.FADE_UP;
        
        // Label size: model, control and readout all use renderer pixels.
        if (this.elements.labelSize) {
          const sizePx = this.selectedWaypoint.labelSize || TEXT_LABEL.SIZE_DEFAULT;
          const clampedSizePx = Math.max(
            TEXT_LABEL.SIZE_PX_MIN,
            Math.min(TEXT_LABEL.SIZE_PX_MAX, Math.round(sizePx))
          );
          this.elements.labelSize.value = clampedSizePx;
          setRangeReadout(
            this.elements.labelSize,
            this.elements.labelSizeValue,
            formatRendererPixels(clampedSizePx)
          );
        }

        // Label width
        if (this.elements.labelWidth) {
          const width = this.selectedWaypoint.labelWidth || TEXT_LABEL.WIDTH_DEFAULT;
          this.elements.labelWidth.value = width;
          this.elements.labelWidthValue.textContent = `${width}%`;
        }
        
        // Label offsets
        if (this.elements.labelOffsetX) {
          const offsetX = this.selectedWaypoint.labelOffsetX !== undefined ? this.selectedWaypoint.labelOffsetX : TEXT_LABEL.OFFSET_DEFAULT_X;
          this.elements.labelOffsetX.value = offsetX;
          this.elements.labelOffsetXValue.textContent = `${offsetX}%`;
        }
        if (this.elements.labelOffsetY) {
          const offsetY = this.selectedWaypoint.labelOffsetY !== undefined ? this.selectedWaypoint.labelOffsetY : TEXT_LABEL.OFFSET_DEFAULT_Y;
          this.elements.labelOffsetY.value = offsetY;
          this.elements.labelOffsetYValue.textContent = `${offsetY}%`;
        }
        
        // Enable pause controls for major waypoints
        this.elements.waypointPauseTime.disabled = false;
        const pauseTimeSec = (this.selectedWaypoint.pauseTime || 0) / 1000;
        this.elements.waypointPauseTime.value = pauseTimeSec;
        this.elements.waypointPauseTimeValue.textContent = pauseTimeSec + 's';
        this.elements.pauseTimeControl.style.display = 'flex';
      } else {
        // Minor waypoint - disable features that don't apply
        this.elements.dotColor.disabled = true;
        this.elements.dotSize.disabled = true;
        this.elements.editorBeaconStyle.disabled = true;
        this.elements.editorBeaconStyle.value = 'none';
        this._updateRippleControlsVisibility('none'); // Hide ripple controls
        
        // Disable label controls for minor waypoints
        this.elements.waypointLabel.disabled = true;
        this.elements.labelMode.disabled = true;
        this.elements.waypointLabel.value = '';
        this.elements.labelMode.value = 'off';
        
        // Disable pause controls for minor waypoints
        this.elements.waypointPauseTime.disabled = true;
        this.elements.waypointPauseTime.value = 0;
        this.elements.waypointPauseTimeValue.textContent = '0s';
        this.elements.pauseTimeControl.style.display = 'none';
      }

      // Major-only controls use an actual selected major as their source; the
      // mixed-state overlay then compares each control's real write targets.
      this._syncMajorWaypointControls(majorSource, majorTargets);

      // Camera controls are major-keyframed and own their mixed presentation.
      this._updateCameraControls(this.selectedWaypoint);
      this._applyWaypointMixedStates(targets, majorTargets);
      this._syncWaypointCardActions();
    }
    // Note: Section visibility handled by SectionController which listens to
    // the same waypoint:selected/deselected events that trigger this method.
  }
};
