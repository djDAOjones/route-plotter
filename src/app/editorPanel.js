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
import { sliderToPathWidth, pathWidthToSlider } from '../utils/pathWidthScale.js';

export const editorPanelMixin = {
  
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
    if (!this.selectedWaypoint) return;
    
    const maxScale = this.selectedWaypoint.rippleMaxScale || 1000;
    
    if (this.selectedWaypoint.rippleWait && this.selectedWaypoint.beaconStyle === 'ripple') {
      // Calculate total ripple animation time using constants
      // Each ring takes (maxScale / 1000) seconds to complete its growth and fade
      // Rings spawn at intervals equal to their duration
      // Wait until the LAST ring has FINISHED (not just started)
      // Formula: (RIPPLE_COUNT rings × durationPerRing) = time when last ring finishes
      const durationPerRing = maxScale / 1000; // seconds (1000% = 1s)
      const totalRippleTime = durationPerRing * BEACON_TIMING.RIPPLE_COUNT; // All rings complete
      
      // Set pause time to match ripple animation
      this.selectedWaypoint.pauseTime = totalRippleTime * 1000; // convert to ms
      this.selectedWaypoint.pauseMode = 'timed';
      
      // Update UI via UIController
      if (this.uiController && this.elements.waypointPauseTime) {
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
        this.selectedWaypoint = waypoint;
        this.updateWaypointList();
        this.updateWaypointEditor();
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
  
  updateWaypointEditor() {
    if (this.selectedWaypoint) {
      // Note: Section visibility now handled by SectionController via events
      
      // Path properties
      this.elements.segmentColor.value = this.selectedWaypoint.segmentColor;
      // Use log scale conversion for segment width
      const width = this.selectedWaypoint.segmentWidth || 3;
      this.elements.segmentWidth.value = this._pathWidthToSlider(width);
      this.elements.segmentWidthValue.textContent = width.toFixed(1);
      this.elements.segmentStyle.value = this.selectedWaypoint.segmentStyle || 'solid';
      this.elements.pathShape.value = this.selectedWaypoint.pathShape || 'line';
      
      // Shape parameters (amplitude/frequency for squiggle/randomised)
      const shapeAmplitude = this.selectedWaypoint.shapeAmplitude !== undefined ? this.selectedWaypoint.shapeAmplitude : 10;
      const shapeFrequency = this.selectedWaypoint.shapeFrequency !== undefined ? this.selectedWaypoint.shapeFrequency : 5;
      if (this.elements.shapeAmplitude) {
        this.elements.shapeAmplitude.value = shapeAmplitude;
        this.elements.shapeAmplitudeValue.textContent = shapeAmplitude;
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
      this.elements.dotSizeValue.textContent = this.elements.dotSize.value;
      
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
      
      // Path head properties
      this.elements.pathHeadStyle.value = this.selectedWaypoint.pathHeadStyle || this.styles.pathHead.style;
      this.elements.pathHeadColor.value = this.selectedWaypoint.pathHeadColor || this.styles.pathHead.color;
      this.elements.pathHeadSize.value = this.selectedWaypoint.pathHeadSize || this.styles.pathHead.size;
      this.elements.pathHeadSizeValue.textContent = this.elements.pathHeadSize.value;
      this.elements.customHeadControls.style.display = 
        (this.selectedWaypoint.pathHeadStyle || this.styles.pathHead.style) === 'custom' ? 'block' : 'none';
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
          this.elements.rippleThicknessValue.textContent = `${this.elements.rippleThickness.value}px`;
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
        
        // Label size (convert px to 1-10 scale)
        if (this.elements.labelSize) {
          const sizePx = this.selectedWaypoint.labelSize || TEXT_LABEL.SIZE_DEFAULT;
          // Convert 16-48px to 1-10 scale: scale = 1 + (sizePx - 16) * 9 / (48 - 16)
          const scale = Math.round(1 + (sizePx - TEXT_LABEL.SIZE_PX_MIN) * 9 / (TEXT_LABEL.SIZE_PX_MAX - TEXT_LABEL.SIZE_PX_MIN));
          this.elements.labelSize.value = Math.max(1, Math.min(10, scale));
          this.elements.labelSizeValue.textContent = scale;
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
        
        // Label colors
        if (this.elements.labelColor) {
          this.elements.labelColor.value = this.selectedWaypoint.labelColor || TEXT_LABEL.COLOR_DEFAULT;
        }
        if (this.elements.labelBgColor) {
          this.elements.labelBgColor.value = this.selectedWaypoint.labelBgColor || TEXT_LABEL.BG_COLOR_DEFAULT;
        }
        
        // Label background opacity
        if (this.elements.labelBgOpacity) {
          const opacity = this.selectedWaypoint.labelBgOpacity !== undefined ? this.selectedWaypoint.labelBgOpacity : TEXT_LABEL.BG_OPACITY_DEFAULT;
          this.elements.labelBgOpacity.value = Math.round(opacity * 100);
          this.elements.labelBgOpacityValue.textContent = `${Math.round(opacity * 100)}%`;
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
      
      // Camera controls (apply to all waypoints)
      this._updateCameraControls(this.selectedWaypoint);
    }
    // Note: Section visibility handled by SectionController which listens to
    // the same waypoint:selected/deselected events that trigger this method.
  }
};
