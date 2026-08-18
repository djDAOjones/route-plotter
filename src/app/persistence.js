/**
 * Project save/load, autosave/restore, and dirty-state title indicator.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, persistenceMixin).
 */
import { ANIMATION, MOTION } from '../config/constants.js';
import { MotionVisibilityService } from '../services/MotionVisibilityService.js';
import { Waypoint } from '../models/Waypoint.js';

export const persistenceMixin = {
  
  /**
   * Save project as ZIP file (includes all images and settings)
   */
  async saveProject() {
    try {
      this.announce('Saving project...');
      
      // Create a clean copy of styles without the pathHead image object
      const stylesCopy = { ...this.styles };
      if (stylesCopy.pathHead) {
        stylesCopy.pathHead = { ...stylesCopy.pathHead, image: null };
      }
      
      // Build project data (same structure as autosave)
      const projectData = {
        // v9: layered scene (v7 + additive `scene` block; 8 skipped — the
        // fork's local builds used it for graph-only saves)
        coordVersion: 9,
        waypoints: this.waypoints.map(wp => wp.toJSON()),
        scene: this.scene.toJSON(),
        styles: stylesCopy,
        animationState: {
          mode: this.animationEngine.state.mode,
          speed: this.animationEngine.state.speed,
          duration: this.animationEngine.state.duration
        },
        background: {
          overlay: this.background.overlay,
          fit: this.background.fit
        },
        exportSettings: {
          frameRate: this.exportSettings.frameRate,
          pathOnly: this.exportSettings.pathOnly,
          resolutionX: this.exportSettings.resolutionX,
          resolutionY: this.exportSettings.resolutionY,
          backgroundZoom: this.exportSettings.backgroundZoom,
          includeCamera: this.exportSettings.includeCamera,
          includeText: this.exportSettings.includeText
        },
        motionSettings: { ...this.motionSettings }
      };
      
      // Get background image as base64 if present
      let backgroundBase64 = null;
      if (this.background.image) {
        const canvas = document.createElement('canvas');
        canvas.width = this.background.image.width;
        canvas.height = this.background.image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.background.image, 0, 0);
        backgroundBase64 = canvas.toDataURL('image/png');
      }
      
      // Export as ZIP
      const zipBlob = await this.imageAssetService.exportZip(projectData, backgroundBase64, 'route-project');
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `route-project-${timestamp}.zip`;
      
      // Download
      this.imageAssetService.downloadZip(zipBlob, filename);
      
      // Mark as clean (saved)
      this._isDirty = false;
      this.updateTitleDirtyState();
      
      this.announce('Project saved');
      console.log(`📦 Project saved: ${filename}`);
    } catch (err) {
      console.error('Failed to save project:', err);
      this.announce('Failed to save project');
    }
  },
  
  /**
   * Load project from ZIP file
   * @param {File} file - ZIP file to load
   */
  async loadProject(file) {
    try {
      this.announce('Loading project...');
      
      // Import from ZIP
      const { projectData, backgroundBase64 } = await this.imageAssetService.importZip(file);
      
      // Clear existing state
      this.clearAll();
      
      // Load background image if present
      if (backgroundBase64) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = backgroundBase64;
        });
        this.background.image = img;
        this.updateImageTransform(img);
      }
      
      // Load waypoints
      if (projectData.waypoints && Array.isArray(projectData.waypoints)) {
        this.beginBatch();
        this.waypoints = projectData.waypoints
          .map(wpData => Waypoint.validate(wpData) ? Waypoint.fromJSON(wpData) : null)
          .filter(wp => wp !== null);
        this.waypoints.forEach(wp => this._addWaypointToMap(wp));
        this.endBatch();
      }

      // Load flow-layer scene (v9+; pre-v9 projects have none and clearAll
      // above already left the scene empty)
      if (projectData.scene) {
        this.scene.fromJSON(projectData.scene);
      }
      this.updateLayersStrip();

      // Load styles
      if (projectData.styles) {
        this.styles = { ...this.styles, ...projectData.styles };
        
        // Restore path head image from asset service
        if (this.styles.pathHead?.imageAssetId) {
          const img = await this.imageAssetService.getImageElement(this.styles.pathHead.imageAssetId);
          if (img) {
            this.styles.pathHead.image = img;
            const asset = this.imageAssetService.getAsset(this.styles.pathHead.imageAssetId);
            if (asset && this.elements.headPreview) {
              this.elements.headPreview.style.display = 'block';
              this.elements.headFilename.textContent = asset.name;
              this.elements.headPreviewImg.src = asset.base64;
            }
          }
        }
        // Sync graphics scale to RenderingService and slider
        this._syncGlobalStyleUI();
      }
      
      // Load other settings
      if (projectData.background) {
        this.background.overlay = projectData.background.overlay ?? 0;
        this.background.fit = projectData.background.fit ?? 'fit';
      }
      
      if (projectData.exportSettings) {
        Object.assign(this.exportSettings, projectData.exportSettings);
        // Object.assign restores state but not the checkbox UI — sync the inclusion toggles.
        // `!== false` so older projects without these keys default to checked (included).
        if (this.elements.exportIncludeImage) {
          // checked = include image; older projects without pathOnly default to included
          this.elements.exportIncludeImage.checked = this.exportSettings.pathOnly !== true;
        }
        if (this.elements.exportIncludeCamera) {
          this.elements.exportIncludeCamera.checked = this.exportSettings.includeCamera !== false;
        }
        if (this.elements.exportIncludeText) {
          this.elements.exportIncludeText.checked = this.exportSettings.includeText !== false;
        }
      }
      
      if (projectData.motionSettings) {
        Object.assign(this.motionSettings, projectData.motionSettings);
      }
      
      if (projectData.animationState) {
        this.animationEngine.setSpeed(projectData.animationState.speed);
        this.animationEngine.setDuration(projectData.animationState.duration);
      }
      
      // Calculate path and render
      if (this.waypoints.length >= 2) {
        this.calculatePath();
      }
      
      this.updateWaypointList();
      this.render();
      
      // Mark as clean (just loaded)
      this._isDirty = false;
      this.updateTitleDirtyState();
      
      this.announce('Project loaded');
      console.log(`📦 Project loaded: ${file.name} (${this.waypoints.length} waypoints, ${this.imageAssetService.getAssetCount()} assets)`);
    } catch (err) {
      console.error('Failed to load project:', err);
      this.announce('Failed to load project: ' + err.message);
    }
  },

  /**
   * Mark the project as having unsaved changes and update title indicator
   * Per UI spec §2.1: Append ● dot to title when dirty
   */
  markDirty() {
    if (!this._isDirty) {
      this._isDirty = true;
      this.updateTitleIndicator();
    }
  },
  
  /**
   * Mark the project as saved (no unsaved changes)
   */
  markClean() {
    if (this._isDirty) {
      this._isDirty = false;
      this.updateTitleIndicator();
    }
  },
  
  /**
   * Update the title to show/hide unsaved changes indicator
   * Per UI spec §2.1: "Route Plotter v3.1.9 ●" when dirty
   */
  updateTitleIndicator() {
    const titleEl = document.getElementById('app-title');
    if (!titleEl) return;
    
    const baseTitle = 'Route Plotter';
    titleEl.textContent = this._isDirty ? `${baseTitle} ●` : baseTitle;
    titleEl.title = this._isDirty ? `Version ${APP_VERSION} · Unsaved changes` : `Version ${APP_VERSION}`;
  },

  autoSave() {
    // Mark as dirty when changes are made
    this.markDirty();
    
    try {
      // Create a clean copy of styles without the pathHead image object (but keep imageAssetId)
      const stylesCopy = { ...this.styles };
      if (stylesCopy.pathHead) {
        stylesCopy.pathHead = { ...stylesCopy.pathHead, image: null };
      }
      
      // Check if image assets exceed autosave limit (5MB)
      const includeAssets = !this.imageAssetService.exceedsAutosaveLimit();
      if (!includeAssets && this.imageAssetService.getAssetCount() > 0) {
        console.warn(`⚠️ Image assets (${this.imageAssetService.getFormattedTotalSize()}) exceed autosave limit. Use Export Project to save with images.`);
      }
      
      const data = {
        // v9: layered scene (v7 + additive `scene` block; 8 skipped — the
        // fork's local builds used it for graph-only saves)
        coordVersion: 9,
        waypoints: this.waypoints.map(wp => wp.toJSON()), // Serialize Waypoint instances
        scene: this.scene.toJSON(), // Flow-layer params + seeds only — runtime dot state never persists
        styles: stylesCopy,
        animationState: {
          mode: this.animationEngine.state.mode,
          speed: this.animationEngine.state.speed,
          duration: this.animationEngine.state.duration
          // Note: playbackSpeed intentionally NOT saved - resets to 1x on each session
        },
        background: {
          overlay: this.background.overlay,
          fit: this.background.fit
        },
        exportSettings: {
          frameRate: this.exportSettings.frameRate,
          pathOnly: this.exportSettings.pathOnly,
          resolutionX: this.exportSettings.resolutionX,
          resolutionY: this.exportSettings.resolutionY,
          backgroundZoom: this.exportSettings.backgroundZoom,
          includeCamera: this.exportSettings.includeCamera,
          includeText: this.exportSettings.includeText
        },
        motionSettings: {
          pathVisibility: this.motionSettings.pathVisibility,
          pathTrail: this.motionSettings.pathTrail,
          waypointVisibility: this.motionSettings.waypointVisibility,
          backgroundVisibility: this.motionSettings.backgroundVisibility,
          revealSize: this.motionSettings.revealSize,
          revealFeather: this.motionSettings.revealFeather,
          aovAngle: this.motionSettings.aovAngle,
          aovDistance: this.motionSettings.aovDistance,
          aovDropoff: this.motionSettings.aovDropoff
        },
        // Include image assets if under size limit
        imageAssets: includeAssets ? this.imageAssetService.toJSON() : []
        // Note: Camera settings are per-waypoint, saved in waypoint.camera
      };
      
      // Use StorageService with debounced auto-save
      this.storageService.autoSave(data);
    } catch (e) {
      console.error('Error saving state:', e);
    }
  },
  
  loadAutosave() {
    console.debug('📥 [loadAutosave] Loading saved state...');
    try {
      const data = this.storageService.loadAutoSave();
      if (!data) return;
      
      // Check version - v6 and v7 are compatible (v7 adds imageAssets)
      const MIN_COORD_VERSION = 6;
      if (!data.coordVersion || data.coordVersion < MIN_COORD_VERSION) {
        console.log('Old data version detected (v' + (data.coordVersion || 1) + '), clearing saved data for v' + MIN_COORD_VERSION);
        this.storageService.clearAutoSave();
        return;
      }
      
      // Load image assets first (so they're available when loading styles)
      if (data.imageAssets && Array.isArray(data.imageAssets)) {
        this.imageAssetService.fromJSON(data.imageAssets);
        console.debug(`📷 Loaded ${this.imageAssetService.getAssetCount()} image assets (${this.imageAssetService.getFormattedTotalSize()})`);
      }
      
      // Hydrate waypoints from plain objects to Waypoint instances
      if (data.waypoints && Array.isArray(data.waypoints)) {
        // Use batch mode to prevent redundant calculations during loading
        this.beginBatch();
        
        // Convert plain objects to Waypoint instances with validation
        this.waypoints = data.waypoints
          .map(wpData => {
            // Validate waypoint data before hydration
            if (!Waypoint.validate(wpData)) {
              console.warn('Invalid waypoint data, skipping:', wpData);
              return null;
            }
            return Waypoint.fromJSON(wpData);
          })
          .filter(wp => wp !== null); // Remove invalid waypoints
        
        // Populate ID lookup map
        this.waypoints.forEach(wp => this._addWaypointToMap(wp));
        
        // End batch mode - triggers single path calculation
        this.endBatch();

        // Restore custom images for waypoints from asset service
        this._restoreWaypointCustomImages();

        console.debug('Loaded waypoints:', this.waypoints.length);
      }

      // Load flow-layer scene (v9+; pre-v9 autosaves have none — the fresh
      // Scene from the constructor is already empty)
      if (data.scene) {
        this.scene.fromJSON(data.scene);
        console.debug('Loaded flow layers:', this.scene.getFlowLayers().length);
      }
      this.updateLayersStrip();
      if (data.styles) {
        this.styles = { ...this.styles, ...data.styles };
        
        // Restore path head image from asset service
        if (this.styles.pathHead?.imageAssetId) {
          this.imageAssetService.getImageElement(this.styles.pathHead.imageAssetId)
            .then(img => {
              if (img) {
                this.styles.pathHead.image = img;
                // Update preview UI
                const asset = this.imageAssetService.getAsset(this.styles.pathHead.imageAssetId);
                if (asset && this.elements.headPreview) {
                  this.elements.headPreview.style.display = 'block';
                  this.elements.headFilename.textContent = asset.name;
                  this.elements.headPreviewImg.src = asset.base64;
                }
                this.queueRender();
              }
            })
            .catch(err => console.warn('Failed to restore path head image:', err));
        }
        // Sync graphics scale and other global style UI from autosave
        this._syncGlobalStyleUI();
      }
      if (data.exportSettings) {
        if (data.exportSettings.frameRate) {
          this.exportSettings.frameRate = data.exportSettings.frameRate;
          if (this.elements.exportFrameRate) {
            this.elements.exportFrameRate.value = data.exportSettings.frameRate;
          }
        }
        if (data.exportSettings.format) {
          this.exportSettings.format = data.exportSettings.format;
        }
        if (data.exportSettings.pathOnly !== undefined) {
          this.exportSettings.pathOnly = data.exportSettings.pathOnly;
          if (this.elements.exportIncludeImage) {
            // checkbox checked = include image = NOT path-only
            this.elements.exportIncludeImage.checked = !data.exportSettings.pathOnly;
          }
        }
        if (data.exportSettings.resolutionX) {
          this.exportSettings.resolutionX = data.exportSettings.resolutionX;
          if (this.elements.exportResX) {
            this.elements.exportResX.value = data.exportSettings.resolutionX;
          }
        }
        if (data.exportSettings.resolutionY) {
          this.exportSettings.resolutionY = data.exportSettings.resolutionY;
          if (this.elements.exportResY) {
            this.elements.exportResY.value = data.exportSettings.resolutionY;
          }
        }
        if (data.exportSettings.backgroundZoom) {
          this.exportSettings.backgroundZoom = data.exportSettings.backgroundZoom;
          // Update coordinate transform with loaded zoom factor
          this.coordinateTransform.setBackgroundZoom(data.exportSettings.backgroundZoom / 100);
          if (this.elements.backgroundZoom) {
            this.elements.backgroundZoom.value = data.exportSettings.backgroundZoom;
          }
          if (this.elements.backgroundZoomValue) {
            this.elements.backgroundZoomValue.textContent = `${data.exportSettings.backgroundZoom}%`;
          }
        }
        // Booleans: guard with !== undefined so a saved `false` restores correctly.
        if (data.exportSettings.includeCamera !== undefined) {
          this.exportSettings.includeCamera = data.exportSettings.includeCamera;
          if (this.elements.exportIncludeCamera) {
            this.elements.exportIncludeCamera.checked = data.exportSettings.includeCamera;
          }
        }
        if (data.exportSettings.includeText !== undefined) {
          this.exportSettings.includeText = data.exportSettings.includeText;
          if (this.elements.exportIncludeText) {
            this.elements.exportIncludeText.checked = data.exportSettings.includeText;
          }
        }
      }
      
      // Load motion visibility settings
      if (data.motionSettings) {
        const ms = data.motionSettings;
        if (ms.pathVisibility) {
          console.debug('[loadAutosave] Setting pathVisibility:', ms.pathVisibility);
          this.motionSettings.pathVisibility = ms.pathVisibility;
          if (this.elements.pathVisibility) {
            this.elements.pathVisibility.value = ms.pathVisibility;
          }
        }
        if (ms.pathTrail !== undefined) {
          this.motionSettings.pathTrail = ms.pathTrail;
          if (this.elements.pathTrail && this.uiController) {
            // Use UIController's conversion method for slider value
            const sliderValue = this.uiController.trailFractionToSlider(ms.pathTrail);
            this.elements.pathTrail.value = sliderValue;
          }
          // Update UIController's trail display
          this.uiController?.setTrailValue(ms.pathTrail);
        }
        if (ms.waypointVisibility) {
          this.motionSettings.waypointVisibility = ms.waypointVisibility;
          if (this.elements.waypointVisibility) {
            this.elements.waypointVisibility.value = ms.waypointVisibility;
          }
        }
        if (ms.backgroundVisibility) {
          this.motionSettings.backgroundVisibility = ms.backgroundVisibility;
          if (this.elements.backgroundVisibility) {
            this.elements.backgroundVisibility.value = ms.backgroundVisibility;
          }
          // Show/hide controls based on mode
          const spotlightControls = document.getElementById('spotlight-controls');
          const aovControls = document.getElementById('aov-controls');
          const isSpotlight = ms.backgroundVisibility === 'spotlight' || ms.backgroundVisibility === 'spotlight-reveal';
          const isAOV = ms.backgroundVisibility === 'angle-of-view' || ms.backgroundVisibility === 'angle-of-view-reveal';
          if (spotlightControls) spotlightControls.style.display = isSpotlight ? 'block' : 'none';
          if (aovControls) aovControls.style.display = isAOV ? 'block' : 'none';
        }
        if (ms.revealSize !== undefined) {
          this.motionSettings.revealSize = ms.revealSize;
          if (this.elements.revealSize && this.elements.revealSizeValue) {
            const sliderValue = MotionVisibilityService.log2ValueToSlider(
              ms.revealSize, MOTION.SPOTLIGHT_SIZE_MIN, MOTION.SPOTLIGHT_SIZE_MAX
            );
            this.elements.revealSize.value = sliderValue;
            this.elements.revealSizeValue.textContent = MotionVisibilityService.formatUIValue(ms.revealSize, '%');
          }
        }
        if (ms.revealFeather !== undefined) {
          this.motionSettings.revealFeather = ms.revealFeather;
          if (this.elements.revealFeather && this.elements.revealFeatherValue) {
            const sliderValue = MotionVisibilityService.log2ValueToSlider(
              ms.revealFeather, MOTION.SPOTLIGHT_FEATHER_MIN, MOTION.SPOTLIGHT_FEATHER_MAX
            );
            this.elements.revealFeather.value = sliderValue;
            this.elements.revealFeatherValue.textContent = MotionVisibilityService.formatUIValue(ms.revealFeather, '%');
          }
        }
        // Load AOV settings
        if (ms.aovAngle !== undefined) {
          this.motionSettings.aovAngle = ms.aovAngle;
          if (this.elements.aovAngle && this.elements.aovAngleValue) {
            const sliderValue = MotionVisibilityService.angleToSlider(
              ms.aovAngle, MOTION.AOV_ANGLE_MIN, MOTION.AOV_ANGLE_MAX
            );
            this.elements.aovAngle.value = sliderValue;
            this.elements.aovAngleValue.textContent = MotionVisibilityService.formatUIValue(ms.aovAngle, '°');
          }
        }
        if (ms.aovDistance !== undefined) {
          this.motionSettings.aovDistance = ms.aovDistance;
          if (this.elements.aovDistance && this.elements.aovDistanceValue) {
            const sliderValue = MotionVisibilityService.log2ValueToSlider(
              ms.aovDistance, MOTION.AOV_DISTANCE_MIN, MOTION.AOV_DISTANCE_MAX
            );
            this.elements.aovDistance.value = sliderValue;
            this.elements.aovDistanceValue.textContent = MotionVisibilityService.formatUIValue(ms.aovDistance, '%');
          }
        }
        if (ms.aovDropoff != null && !isNaN(ms.aovDropoff)) {
          this.motionSettings.aovDropoff = ms.aovDropoff;
          if (this.elements.aovDropoff && this.elements.aovDropoffValue) {
            // Linear mapping: value 0-100% → slider 0-1000
            const sliderValue = Math.round((ms.aovDropoff / MOTION.AOV_DROPOFF_MAX) * 1000);
            this.elements.aovDropoff.value = sliderValue;
            this.elements.aovDropoffValue.textContent = MotionVisibilityService.formatUIValue(ms.aovDropoff, '%');
          }
        } else {
          // Use default if saved value is null/undefined/NaN
          this.motionSettings.aovDropoff = MOTION.AOV_DROPOFF_DEFAULT;
          if (this.elements.aovDropoff && this.elements.aovDropoffValue) {
            const sliderValue = Math.round((MOTION.AOV_DROPOFF_DEFAULT / MOTION.AOV_DROPOFF_MAX) * 1000);
            this.elements.aovDropoff.value = sliderValue;
            this.elements.aovDropoffValue.textContent = MotionVisibilityService.formatUIValue(MOTION.AOV_DROPOFF_DEFAULT, '%');
          }
        }
      }
      
      // IMPORTANT: Load animation state BEFORE calculating path
      // This ensures path calculation uses the correct saved speed
      if (data.animationState) {
        const savedState = data.animationState;
        
        // Restore animation state to AnimationEngine
        this.animationEngine.setMode(savedState.mode || 'constant-speed');
        this.animationEngine.setSpeed(savedState.speed || ANIMATION.DEFAULT_SPEED);
        // Note: playbackSpeed always starts at 1x - not restored from saved state
        // This is intentional: JKL speed multipliers are temporary review aids
        this.animationEngine.setPlaybackSpeed(1);
        this.uiController?.setPlaybackSpeed(1);
        // Don't restore duration yet - will be recalculated from path length + speed
        
        // Update UI to match loaded values
        if (this.elements.animationSpeed) {
          const loadedSpeed = savedState.speed || ANIMATION.DEFAULT_SPEED;
          console.debug('🎯 [loadAutosave] Setting slider to:', loadedSpeed, '(from savedState.speed:', savedState.speed, ')');
          // Use event to avoid feedback loop
          this.eventBus.emit('ui:slider:update-speed', loadedSpeed);
          // Duration display will be updated after path calculation
        }
        
        // Always show speed control
        if (this.elements.speedControl) {
          this.elements.speedControl.style.display = 'flex';
        }
      }
      
      if (data.background) {
        this.background.overlay = data.background.overlay ?? this.background.overlay;
        this.background.fit = data.background.fit ?? this.background.fit;
        
        // Update toggle button to match loaded state
        if (this.elements.bgFitToggle) {
          this.elements.bgFitToggle.textContent = this.background.fit === 'fit' ? 'Fit' : 'Fill';
          this.elements.bgFitToggle.dataset.mode = this.background.fit;
        }
        // Reflect overlay in UI if controls exist (log2 scaled)
        if (this.elements.bgOverlay) {
          const sliderValue = MotionVisibilityService.bipolarLog2ValueToSlider(
            this.background.overlay, MOTION.TINT_MIN, MOTION.TINT_MAX
          );
          this.elements.bgOverlay.value = String(sliderValue);
          this.elements.bgOverlayValue.textContent = MotionVisibilityService.formatUIValue(this.background.overlay);
        }
      }
      
      // Note: Camera settings are per-waypoint, loaded via Waypoint.fromJSON
      
      // Calculate path with loaded speed - this will recalculate correct duration
      this.calculatePath();
      this.updateWaypointList();
      
      // Set animation to start position (paused)
      this.animationEngine.pause();
      this.animationEngine.seekToProgress(0);
      
      this.announce('Previous session restored');
    } catch (e) {
      console.warn('No autosave found or failed to load');
    }
  }
};
