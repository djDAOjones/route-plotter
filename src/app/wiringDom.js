/**
 * DOM control wiring: setupEventListeners() connects every sidebar/header/canvas DOM control to app behaviour.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, wiringDomMixin).
 */
import { TEXT_LABEL } from '../config/constants.js';
import { TextLabelService } from '../services/TextLabelService.js';
import { CameraService, CAMERA_DEFAULTS, ZOOM_MODE } from '../services/CameraService.js';
import { createFocusTrap } from '../utils/focusTrap.js';
import { ImageAsset } from '../models/ImageAsset.js';
import {
  beginAsyncProjectOperation,
  isAsyncProjectOperationCurrent,
} from './operationGeneration.js';
import {
  formatRendererPixels,
  formatShapeAmplitude,
  setRangeReadout,
} from '../utils/uiReadouts.js';
import { bindMixedControlReset } from '../utils/mixedControlState.js';
import {
  pathHeadStyleUsesImageControls,
  resolvePathHeadImage,
} from '../utils/pathHeadPresets.js';
import { buildExampleProjects } from '../examples/index.js';

export const wiringDomMixin = {
  
  setupEventListeners() {
    const waypointScope = document.getElementById('waypoint-scope');
    bindMixedControlReset(waypointScope);
    waypointScope?.addEventListener('click', event => {
      const button = event.target.closest?.('[data-card-action][data-card]');
      if (!button || !waypointScope.contains(button)) return;
      this._handleWaypointCardAction(button.dataset.card, button.dataset.cardAction);
    });

    // Mode switch toggle (header)
    this.elements.modeToggleBtn?.addEventListener('click', () => {
      this._togglePreviewMode();
    });
    
    // Show one-time toast tip (replaces old tip banner)
    this._showPreviewTipToast();
    
    // Example Backgrounds dropdown - handle menu item clicks to load images
    // (Dropdown open/close is handled by initAllDropdowns() in Dropdown.js)
    this.elements.exampleBackgroundsMenu?.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const imagePath = e.target.dataset.image;
        if (imagePath) {
          this.loadExampleImage(imagePath);
        }
      });
    });

    // Example Projects (DEMO-01) — built from the same list the archives are
    // generated from, so the menu can never offer one that was not shipped.
    const exampleProjectsMenu = document.getElementById('example-projects-menu');
    if (exampleProjectsMenu) {
      for (const example of buildExampleProjects()) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'dropdown-item dropdown-item-example';
        item.setAttribute('role', 'menuitem');
        item.textContent = example.name;
        item.title = example.description;
        item.addEventListener('click', () => this.loadExampleProject(example.id));
        exampleProjectsMenu.appendChild(item);
      }
    }
    
    // Sidebar tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
      });
    });
    
    // ===== SPLASH SCREEN EVENT LISTENERS =====
    // Both first-run and Help paths show this dialog by changing its inline
    // display, so one observer keeps the shared focus trap in sync.
    if (this.elements.splash) {
      this._splashFocusTrap = createFocusTrap(this.elements.splash);
      const syncSplashFocus = () => {
        const isOpen = !this.elements.splash.hidden && this.elements.splash.style.display !== 'none';
        if (isOpen) {
          this._splashFocusTrap.activate();
        } else {
          this._splashFocusTrap.deactivate();
        }
      };
      this._splashObserver = new MutationObserver(syncSplashFocus);
      this._splashObserver.observe(this.elements.splash, {
        attributes: true,
        attributeFilter: ['hidden', 'style']
      });
      this.elements.splash.addEventListener('focustrap:escape', () => this.hideSplash());
      syncSplashFocus();
    }

    const closeSplash = () => {
      this.hideSplash();
      this._splashFocusTrap?.deactivate();
    };
    if (this.elements.splashClose) {
      this.elements.splashClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSplash();
      });
    } else {
      console.error('❌ [Splash] Close button element not found!');
    }
    
    // MOD-01: Close × button in top-right corner
    if (this.elements.splashCloseX) {
      this.elements.splashCloseX.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSplash();
      });
    }
    
    if (this.elements.splash) {
      this.elements.splash.addEventListener('click', (e) => {
        if (e.target === this.elements.splash) {
          closeSplash();
        }
      });
    } else {
      console.error('❌ [Splash] Splash element not found!');
    }
    
    /* Canvas events now handled by InteractionHandler
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    // Drag & drop background image
    this.canvas.addEventListener('dragover', (e) => { e.preventDefault(); });
    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.loadImageFile(file).then((img) => {
          this.background.image = img;
          this.updateImageTransform(img);
          // Auto-set export resolution to match image
          this.eventBus.emit('video:resolution-native');
          // Recalculate path with proper image bounds
          if (this.waypoints.length >= 2) {
            this.calculatePath();
          }
          this.render();
          this.autoSave();
          this.announce('Background image loaded');
        });
      }
    });
    */
    
    /* Header and transport controls now handled by UIController
    this.elements.helpBtn.addEventListener('click', () => this.showSplash());
    this.elements.clearBtn.addEventListener('click', () => this.clearAll());
    
    // Transport controls
    this.elements.playBtn.addEventListener('click', () => this.play());
    this.elements.pauseBtn.addEventListener('click', () => this.pause());
    this.elements.skipStartBtn.addEventListener('click', () => this.skipToStart());
    this.elements.skipEndBtn.addEventListener('click', () => this.skipToEnd());
    
    // Timeline slider - now handled by UIController
    */
    
    // ========== WAYPOINT EDITOR CONTROLS ==========
    // These controls modify per-waypoint style and path properties
    // Style changes: visual only, no path recalculation needed
    // Path property changes: require path recalculation
    //
    // Every handler writes to selectionTargets() — the multi-selection
    // when one exists, else the single selection — then emits its change
    // event ONCE with the primary, so a bulk edit still runs one path
    // recalc, one debounced undo entry, and one autosave (Phase 4).
    // Leg/path properties include minors (minors own legs too); marker,
    // beacon, and label properties are majors-only, matching the
    // single-selection UI that disables them for minors.

    // Waypoint editor controls
    // Segment color affects path rendering (requires recalculation)
    this.elements.segmentColor.addEventListener('input', (e) => {
      const targets = this.selectionTargets();
      if (targets.length > 0) {
        for (const wp of targets) wp.segmentColor = e.target.value;
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });

    // Segment width affects path rendering (requires recalculation)
    // Uses log scale: slider 0-1000 → width 1-40 (4x original range)
    this.elements.segmentWidth.addEventListener('input', (e) => {
      const targets = this.selectionTargets();
      if (targets.length > 0) {
        const width = this._sliderToPathWidth(parseFloat(e.target.value));
        for (const wp of targets) wp.segmentWidth = width;
        setRangeReadout(
          this.elements.segmentWidth,
          this.elements.segmentWidthValue,
          formatRendererPixels(width, 1)
        );
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });

    // Segment style affects path rendering (requires recalculation)
    this.elements.segmentStyle.addEventListener('change', (e) => {
      const targets = this.selectionTargets();
      if (targets.length > 0) {
        for (const wp of targets) wp.segmentStyle = e.target.value;
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });

    // Path shape control (line, squiggle, randomised) - affects path generation
    this.elements.pathShape.addEventListener('change', (e) => {
      const targets = this.selectionTargets();
      if (targets.length > 0) {
        for (const wp of targets) wp.pathShape = e.target.value;
        // Show/hide shape parameter controls
        this._updateShapeParamsVisibility(e.target.value);
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });

    // Shape amplitude control (for squiggle/randomised)
    this.elements.shapeAmplitude?.addEventListener('input', (e) => {
      const targets = this.selectionTargets();
      if (targets.length > 0) {
        for (const wp of targets) wp.shapeAmplitude = parseInt(e.target.value);
        setRangeReadout(
          this.elements.shapeAmplitude,
          this.elements.shapeAmplitudeValue,
          formatShapeAmplitude(e.target.value)
        );
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });

    // Shape frequency control (for squiggle/randomised)
    this.elements.shapeFrequency?.addEventListener('input', (e) => {
      const targets = this.selectionTargets();
      if (targets.length > 0) {
        for (const wp of targets) wp.shapeFrequency = parseInt(e.target.value);
        this.elements.shapeFrequencyValue.textContent = e.target.value;
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });

    // Marker style control (dot, square, flag, custom, none) - visual only
    this.elements.markerStyle.addEventListener('change', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.markerStyle = e.target.value;

        // Show/hide custom marker controls
        if (this.elements.customMarkerControls) {
          this.elements.customMarkerControls.style.display =
            e.target.value === 'custom' ? 'block' : 'none';
        }

        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Custom Marker Image Upload
    this.elements.markerUploadBtn?.addEventListener('click', () => {
      this.elements.markerUpload?.click();
    });
    
    this.elements.markerUpload?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      const targets = this.selectionTargets(true);
      if (file && targets.length > 0) {
        const token = beginAsyncProjectOperation(this, 'marker-image');
        try {
          // Decode outside the live asset collection. Clear/Open or a newer
          // marker request can then supersede this work without leaving a
          // late orphan asset behind.
          const candidate = await ImageAsset.fromFile(file);
          const image = await candidate.getImageElement();
          if (!isAsyncProjectOperationCurrent(this, token)) return;

          const liveTargets = targets.filter(wp => this.waypoints.includes(wp));
          if (liveTargets.length === 0) return;
          const previousTargets = liveTargets.map(waypoint => ({
            waypoint,
            customImageAssetId: waypoint.customImageAssetId,
            customImage: waypoint.customImage,
          }));
          const { asset, isNew, warning } = this.commitImageAssetEdit({
            candidate,
            apply: nextAsset => {
              for (const wp of liveTargets) {
                wp.customImageAssetId = nextAsset.id;
                wp.customImage = image;
              }
            },
            rollback: () => {
              for (const previous of previousTargets) {
                previous.waypoint.customImageAssetId = previous.customImageAssetId;
                previous.waypoint.customImage = previous.customImage;
              }
            },
          });

          if (warning) {
            console.warn(warning);
          }

          // Update preview
          if (this.elements.markerPreview) {
            this.elements.markerPreview.style.display = 'block';
            this.elements.markerFilename.textContent = asset.name;
            this.elements.markerPreviewImg.src = asset.base64;
          }

          this.eventBus.emit(
            'waypoint:style-changed',
            this.selectedWaypoint,
            { historyAlreadySaved: true }
          );

          console.log(`📷 Waypoint marker image ${isNew ? 'added' : 'reused'}: ${asset.name} (${asset.getFormattedSize()})`);
        } catch (err) {
          if (!isAsyncProjectOperationCurrent(this, token)) return;
          console.error('Failed to load marker image:', err);
          this.announce(err.message || 'Failed to load image');
        }
      }
    });

    // Dot color and size controls - visual only, no path recalculation
    this.elements.dotColor.addEventListener('input', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.dotColor = e.target.value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Per-waypoint beacon edits (only apply to major waypoints) - visual only
    this.elements.editorBeaconStyle.addEventListener('change', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        const newStyle = e.target.value;
        for (const wp of targets) {
          wp.beaconStyle = newStyle;
          // Reset beacon renderer for this waypoint
          this.renderingService.beaconRenderer.resetBeacon(wp.id);
          // Default rippleWait to true for newly selected ripple effects
          if (newStyle === 'ripple' && wp.rippleWait === undefined) {
            wp.rippleWait = true;
          }
        }

        // Show/hide ripple controls
        this._updateRippleControlsVisibility(newStyle);

        // When ripple is selected, sync the checkbox to the primary and
        // recalculate pause time wherever ripple wait is enabled
        if (newStyle === 'ripple') {
          if (this.elements.rippleWait && this.selectedWaypoint) {
            this.elements.rippleWait.checked = this.selectedWaypoint.rippleWait;
          }
          this._updateRippleWaitTime();
        }

        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });

    // Ripple thickness control
    this.elements.rippleThickness?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      setRangeReadout(
        this.elements.rippleThickness,
        this.elements.rippleThicknessValue,
        formatRendererPixels(value, Number.isInteger(value) ? 0 : 1)
      );
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.rippleThickness = value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });

    // Ripple max scale control
    this.elements.rippleMaxScale?.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.elements.rippleMaxScaleValue.textContent = `${value}%`;
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.rippleMaxScale = value;
        // Update wait times wherever ripple wait is enabled
        this._updateRippleWaitTime();
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });

    // Ripple wait checkbox - adds ripple animation time to pause
    this.elements.rippleWait?.addEventListener('change', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.rippleWait = e.target.checked;
        this._updateRippleWaitTime();
        this.eventBus.emit('waypoint:path-property-changed', this.selectedWaypoint);
      }
    });

    // Pulse amplitude control
    this.elements.pulseAmplitude?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.elements.pulseAmplitudeValue.textContent = value.toFixed(1);
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.pulseAmplitude = value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });

    // Pulse cycle speed control
    this.elements.pulseCycleSpeed?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.elements.pulseCycleSpeedValue.textContent = `${value}s`;
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.pulseCycleSpeed = value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Note: Beacon color removed - beacons now use marker color (dotColor)
    
    // Label controls (only enabled for major waypoints) - visual only.
    // Auto-names the waypoint from label text when no custom name has been set,
    // so the waypoint list shows meaningful names by default (N6-3: recognition).
    this.elements.waypointLabel.addEventListener('input', (e) => {
      if (this.selectedWaypoint && this.selectedWaypoint.isMajor) {
        const text = e.target.value;
        const wasEmpty = !this.selectedWaypoint.label;
        this.selectedWaypoint.label = text;

        // LABEL-01: a new label starts at the default offset, which frequently
        // sits under its own marker — so it is written and then invisible.
        // Place it the moment it first has text, unless the author has already
        // positioned this label themselves.
        if (wasEmpty && text && !this.selectedWaypoint.labelPlacedByHand) {
          this.applyAutoPosition([this.selectedWaypoint]);
        }
        // Auto-name: populate waypoint name from label text when no custom name exists
        if (!this.selectedWaypoint.name) {
          this.selectedWaypoint._autoNamed = true;
        }
        if (this.selectedWaypoint._autoNamed) {
          this.selectedWaypoint.name = text;
        }
        this.eventBus.emit('scene:semantic-changed', {
          kind: 'waypoint-label',
          waypointId: this.selectedWaypoint.id,
        });
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    // Label display mode - visual only
    this.elements.labelMode.addEventListener('change', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.labelMode = e.target.value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    // Label appearance is persisted already; the inspector now exposes the
    // exact model values without introducing a parallel UI state.
    this.elements.labelColor?.addEventListener('input', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.labelColor = e.target.value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    this.elements.labelBgColor?.addEventListener('input', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.labelBgColor = e.target.value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    this.elements.labelBgOpacity?.addEventListener('input', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        const opacityPct = Math.max(0, Math.min(100, parseInt(e.target.value)));
        for (const wp of targets) wp.labelBgOpacity = opacityPct / 100;
        setRangeReadout(
          this.elements.labelBgOpacity,
          this.elements.labelBgOpacityValue,
          `${opacityPct}%`
        );
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    // Label position - visual only. Was wired only through UIController's
    // bulk path, so single-selection changes never reached the model
    // (review 2026-08-18)
    this.elements.labelPosition?.addEventListener('change', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.labelPosition = e.target.value;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    // Label size: the control edits the model's renderer-pixel value directly.
    this.elements.labelSize?.addEventListener('input', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        const sizePx = Math.max(
          TEXT_LABEL.SIZE_PX_MIN,
          Math.min(TEXT_LABEL.SIZE_PX_MAX, parseInt(e.target.value))
        );
        for (const wp of targets) wp.labelSize = sizePx;
        setRangeReadout(
          this.elements.labelSize,
          this.elements.labelSizeValue,
          formatRendererPixels(sizePx)
        );
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });

    // Label width
    this.elements.labelWidth?.addEventListener('input', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        const width = parseInt(e.target.value);
        for (const wp of targets) wp.labelWidth = width;
        this.elements.labelWidthValue.textContent = `${width}%`;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });

    // Label X offset
    this.elements.labelOffsetX?.addEventListener('input', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        const offset = parseInt(e.target.value);
        // LABEL-01: moving it by hand settles it — auto-position stops
        // volunteering for this label from here on.
        for (const wp of targets) { wp.labelOffsetX = offset; wp.labelPlacedByHand = true; }
        this.elements.labelOffsetXValue.textContent = `${offset}%`;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });

    // Label Y offset
    this.elements.labelOffsetY?.addEventListener('input', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        const offset = parseInt(e.target.value);
        for (const wp of targets) { wp.labelOffsetY = offset; wp.labelPlacedByHand = true; }
        this.elements.labelOffsetYValue.textContent = `${offset}%`;
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });

    // Label auto-position button — each selected label gets its own
    // computed position (auto-position is inherently per-waypoint)
    this.elements.labelAutoPosition?.addEventListener('click', () => {
      // Asking for it explicitly is not the same as it happening to you, so
      // the button ignores labelPlacedByHand and always runs.
      this.applyAutoPosition(this.selectionTargets(true).filter(wp => wp.label));
    });

    // LABEL-01: once the text is committed the box has its final size, which
    // is the moment a collision is worth mentioning. Offering it while they
    // are still typing would nag at every keystroke.
    this.elements.waypointLabel.addEventListener('change', () => {
      this.offerAutoPositionIfColliding(this.selectedWaypoint);
    });
    
    // Label colour/background/opacity have model + rendering support but
    // no DOM controls — the dead listeners here were removed 2026-08-18
    // (wish-list: expose under Label → More in the Phase 4 inspector).

    // Path Head Style Controls - global settings (not per-waypoint)
    this.elements.pathHeadStyle.addEventListener('change', (e) => {
      const pathHead = this.styles.pathHead;
      const selectedStyle = e.target.value;
      const selectedAssetId = pathHead.imageAssetId;
      pathHead.style = selectedStyle;
      pathHead.image = null;
      
      // Presets share rotation controls with custom images, but do not expose
      // an upload affordance that would imply the preset itself is editable.
      this.elements.customHeadControls.style.display =
        pathHeadStyleUsesImageControls(selectedStyle) ? 'block' : 'none';
      if (this.elements.customHeadUploadControls) {
        this.elements.customHeadUploadControls.style.display =
          selectedStyle === 'custom' ? 'block' : 'none';
      }
      
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();

      resolvePathHeadImage(
        pathHead,
        assetId => this.imageAssetService.getImageElement(assetId)
      ).then(image => {
        if (this.styles.pathHead !== pathHead || pathHead.style !== selectedStyle) return;
        if (selectedStyle === 'custom' && pathHead.imageAssetId !== selectedAssetId) return;
        pathHead.image = image;
        this.queueRender();
      }).catch(error => {
        if (this.styles.pathHead !== pathHead || pathHead.style !== selectedStyle) return;
        console.error('Failed to load path head image:', error);
        this.announce(error.message || 'Failed to load path head image');
      });
    });
    
    this.elements.pathHeadColor.addEventListener('input', (e) => {
      this.styles.pathHead.color = e.target.value;
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    this.elements.pathHeadSize.addEventListener('input', (e) => {
      this.styles.pathHead.size = parseInt(e.target.value);
      setRangeReadout(
        this.elements.pathHeadSize,
        this.elements.pathHeadSizeValue,
        formatRendererPixels(e.target.value)
      );
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    // Custom Path Head Image Upload
    this.elements.headUploadBtn.addEventListener('click', () => {
      this.elements.headUpload.click();
    });
    
    this.elements.headUpload.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) {
        const token = beginAsyncProjectOperation(this, 'path-head-image');
        const pathHead = this.styles.pathHead;
        try {
          const candidate = await ImageAsset.fromFile(file);
          const image = await candidate.getImageElement();
          if (!isAsyncProjectOperationCurrent(this, token) || this.styles.pathHead !== pathHead) return;

          const previousAssetId = pathHead.imageAssetId;
          const previousImage = pathHead.image;
          const { asset, isNew, warning } = this.commitImageAssetEdit({
            candidate,
            apply: nextAsset => {
              pathHead.imageAssetId = nextAsset.id;
              pathHead.image = image;
            },
            rollback: () => {
              pathHead.imageAssetId = previousAssetId;
              pathHead.image = previousImage;
            },
          });
          
          if (warning) {
            console.warn(warning);
          }
          
          // Update preview
          this.elements.headPreview.style.display = 'block';
          this.elements.headFilename.textContent = asset.name;
          this.elements.headPreviewImg.src = asset.base64;
          
          this.queueRender();
          this.autoSave();
          
          console.log(`📷 Path head image ${isNew ? 'added' : 'reused'}: ${asset.name} (${asset.getFormattedSize()})`);
        } catch (err) {
          if (!isAsyncProjectOperationCurrent(this, token)) return;
          console.error('Failed to load path head image:', err);
          this.announce(err.message || 'Failed to load image');
        }
      }
    });
    
    // Path head rotation mode (auto follows path direction, fixed stays upright)
    this.elements.headRotationMode?.addEventListener('change', (e) => {
      this.styles.pathHead.rotationMode = e.target.value;
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    // Path head rotation offset (degrees added to auto-rotation)
    this.elements.headRotationOffset?.addEventListener('input', (e) => {
      this.styles.pathHead.rotationOffset = parseInt(e.target.value);
      if (this.elements.headRotationOffsetValue) {
        this.elements.headRotationOffsetValue.textContent = `${e.target.value}°`;
      }
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    // ===== GRAPHICS SCALE SLIDER =====
    // Logarithmic curve: slider (-200..200) → multiplier (0.25..4)
    // Formula: scale = 2^(sliderValue / 100) → center (0) = 1×
    // -200 → 0.25×, -100 → 0.5×, 0 → 1×, +100 → 2×, +200 → 4×
    this.elements.graphicsScale?.addEventListener('input', (e) => {
      const sliderVal = parseInt(e.target.value);
      const scale = Math.pow(2, sliderVal / 100);
      this.styles.graphicsScale = scale;
      this.renderingService.setGraphicsScale(scale);
      
      // Format display: "0.5×", "1×", "2.3×" etc.
      this.elements.graphicsScaleValue.textContent =
        (scale >= 1 ? scale.toFixed(scale === Math.round(scale) ? 0 : 1)
                     : scale.toFixed(2).replace(/0$/, '')) + '×';
      
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    // Double-click to reset to 1× (Nielsen N7: flexibility)
    this.elements.graphicsScale?.addEventListener('dblclick', () => {
      this.elements.graphicsScale.value = 0;
      this.elements.graphicsScale.dispatchEvent(new Event('input'));
    });
    // Tooltip for Graphics Scale label is handled by ParamTooltip (data-tip attr)
    
    // ===== PATH CASING TOGGLE =====
    this.elements.pathCasingToggle?.addEventListener('change', (e) => {
      this.styles.showPathCasing = e.target.checked;
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    
    // ===== PATH GLOW (toggle + intensity) =====
    // Soft halo beneath the path; visual style only (no path recalc) → queueRender
    // + autoSave, mirroring the casing toggle. Intensity slider 0–100 maps to 0–1.
    this.elements.pathGlowToggle?.addEventListener('change', (e) => {
      this.styles.pathGlow.enabled = e.target.checked;
      if (this.elements.pathGlowIntensity) {
        this.elements.pathGlowIntensity.disabled = !e.target.checked;
      }
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    this.elements.pathGlowIntensity?.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value);
      this.styles.pathGlow.intensity = pct / 100;
      if (this.elements.pathGlowValue) this.elements.pathGlowValue.textContent = pct + '%';
      this.queueRender();
      this.saveUndoStateDebounced();
      this.autoSave();
    });
    // Double-click resets glow intensity to default (Nielsen N7: flexibility)
    this.elements.pathGlowIntensity?.addEventListener('dblclick', () => {
      this.elements.pathGlowIntensity.value = 50;
      this.elements.pathGlowIntensity.dispatchEvent(new Event('input'));
    });
    
    // Dot size - visual only (majors only: minors keep their small fixed size)
    this.elements.dotSize.addEventListener('input', (e) => {
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) wp.dotSize = parseInt(e.target.value);
        setRangeReadout(
          this.elements.dotSize,
          this.elements.dotSizeValue,
          formatRendererPixels(e.target.value)
        );
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });
    
    // Always use constant-speed mode now (animation mode dropdown removed)
    // Animation speed now handled by UIController -> EventBus -> animation:speed-change event
    // Waypoint pause time now handled by UIController -> EventBus -> waypoint:pause-changed event
    
    // Background DOM controls are owned exclusively by UIController. It emits
    // one semantic EventBus command per action; wiringControllers performs the
    // corresponding state mutation, render, and autosave.
    
    // ===== CAMERA CONTROLS =====
    // "This Zoom" slider - updates current waypoint's camera.zoom (log scale: 0-1 → 1x-16x)
    // Zoom is keyframed on majors only (CameraService drops minors)
    this.elements.cameraZoom?.addEventListener('input', (e) => {
      const sliderValue = parseFloat(e.target.value);
      const zoom = CameraService.sliderToZoom(sliderValue);

      // Update display immediately for responsive feel
      const formattedZoom = CameraService.formatZoom(zoom);
      if (this.elements.cameraZoomValue) {
        this.elements.cameraZoomValue.textContent = formattedZoom;
      }
      e.target.setAttribute('aria-valuetext', formattedZoom);

      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) {
          if (!wp.camera) {
            wp.camera = { zoom: CAMERA_DEFAULTS.ZOOM, zoomMode: CAMERA_DEFAULTS.ZOOM_MODE };
          }
          wp.camera.zoom = zoom;
        }
        this.validateZoomTransitions(); // Check for rate limit warnings
        this.autoSave();
        if (this.previewMode) this.render();
      }
    });

    // The transition belongs to the destination waypoint: it describes how
    // CameraService reaches this waypoint's zoom over the incoming leg.
    this.elements.cameraZoomMode?.addEventListener('change', (e) => {
      if (!Object.values(ZOOM_MODE).includes(e.target.value)) return;
      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        for (const wp of targets) {
          if (!wp.camera) {
            wp.camera = { zoom: CAMERA_DEFAULTS.ZOOM, zoomMode: CAMERA_DEFAULTS.ZOOM_MODE };
          }
          wp.camera.zoomMode = e.target.value;
        }
        this.validateZoomTransitions();
        this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
      }
    });


    /**
     * Multi-select zoom slider - updates camera.zoom on all selected waypoints
     * Uses same log scale as single-select: 0-1 → 1x-16x
     */
    this.elements.cameraSelectedZoom?.addEventListener('input', (e) => {
      const sliderValue = parseFloat(e.target.value);
      const zoom = CameraService.sliderToZoom(sliderValue);

      // Update display immediately
      const formattedZoom = CameraService.formatZoom(zoom);
      if (this.elements.cameraSelectedZoomValue) {
        this.elements.cameraSelectedZoomValue.textContent = formattedZoom;
      }
      e.target.setAttribute('aria-valuetext', formattedZoom);

      const targets = this.selectionTargets(true);
      if (targets.length > 0) {
        // Update zoom on all selected waypoints
        for (const wp of targets) {
          if (!wp.camera) wp.camera = {};
          wp.camera.zoom = zoom;
        }
        this.validateZoomTransitions();
        this.autoSave();
        if (this.previewMode) this.queueRender();
      }
    });
    
    /* Keyboard shortcuts now handled by InteractionHandler
    document.addEventListener('keydown', (e) => {
      const nudgeAmount = e.shiftKey ? 0.05 : 0.01; // 5% or 1%
      const canvasWidth = this.canvas.width;
      const canvasHeight = this.canvas.height;
      
      switch(e.code) {
        case 'Space':
          e.preventDefault();
          if (this.animationEngine.state.isPlaying && !this.animationEngine.state.isPaused) {
            this.pause();
          } else {
            this.play();
          }
          break;
          
        case 'KeyJ': // 0.5x speed
          this.animationEngine.setPlaybackSpeed(0.5);
          this.announce('Playback speed: 0.5x');
          break;
          
        case 'KeyK': // 1x speed
          this.animationEngine.setPlaybackSpeed(1);
          this.announce('Playback speed: 1x');
          break;
          
        case 'KeyL': // 2x speed
          this.animationEngine.setPlaybackSpeed(2);
          this.announce('Playback speed: 2x');
          break;
          
        case 'ArrowLeft':
          if (this.selectedWaypoint) {
            e.preventDefault();
            // Convert current position to canvas, nudge, then back to image coords (clamped)
            const canvasPos = this.imageToCanvas(this.selectedWaypoint.imgX, this.selectedWaypoint.imgY);
            const newCanvasX = canvasPos.x - nudgeAmount * canvasWidth;
            const newImgPos = this.canvasToImage(newCanvasX, canvasPos.y);
            this.selectedWaypoint.imgX = Math.max(0, Math.min(1, newImgPos.x));
            this.selectedWaypoint.imgY = Math.max(0, Math.min(1, newImgPos.y));
            // Emit position changed event for consistent updates
            this.eventBus.emit('waypoint:position-changed', this.selectedWaypoint);
          }
          break;
          
        case 'ArrowRight':
          if (this.selectedWaypoint) {
            e.preventDefault();
            const canvasPos = this.imageToCanvas(this.selectedWaypoint.imgX, this.selectedWaypoint.imgY);
            const newCanvasX = canvasPos.x + nudgeAmount * canvasWidth;
            const newImgPos = this.canvasToImage(newCanvasX, canvasPos.y);
            this.selectedWaypoint.imgX = Math.max(0, Math.min(1, newImgPos.x));
            this.selectedWaypoint.imgY = Math.max(0, Math.min(1, newImgPos.y));
            // Emit position changed event
            this.eventBus.emit('waypoint:position-changed', this.selectedWaypoint);
          }
          break;
          
        case 'ArrowUp':
          if (this.selectedWaypoint) {
            e.preventDefault();
            const canvasPos = this.imageToCanvas(this.selectedWaypoint.imgX, this.selectedWaypoint.imgY);
            const newCanvasY = canvasPos.y - nudgeAmount * canvasHeight;
            const newImgPos = this.canvasToImage(canvasPos.x, newCanvasY);
            this.selectedWaypoint.imgX = Math.max(0, Math.min(1, newImgPos.x));
            this.selectedWaypoint.imgY = Math.max(0, Math.min(1, newImgPos.y));
            // Emit position changed event
            this.eventBus.emit('waypoint:position-changed', this.selectedWaypoint);
          }
          break;
          
        case 'ArrowDown':
          if (this.selectedWaypoint) {
            e.preventDefault();
            const canvasPos = this.imageToCanvas(this.selectedWaypoint.imgX, this.selectedWaypoint.imgY);
            const newCanvasY = canvasPos.y + nudgeAmount * canvasHeight;
            const newImgPos = this.canvasToImage(canvasPos.x, newCanvasY);
            this.selectedWaypoint.imgX = Math.max(0, Math.min(1, newImgPos.x));
            this.selectedWaypoint.imgY = Math.max(0, Math.min(1, newImgPos.y));
            // Emit position changed event
            this.eventBus.emit('waypoint:position-changed', this.selectedWaypoint);
          }
          break;
          
        case 'Escape':
          if (this.isDragging) {
            this.isDragging = false;
            this.canvas.classList.remove('dragging');
          }
          this.selectedWaypoint = null;
          this.updateWaypointList();
          this.updateWaypointEditor();
          break;
      }
    });
    */
  },

  /**
   * LABEL-01 — place each label where auto-position judges best.
   *
   * Shared by the explicit button and the automatic first-write placement so
   * the two can never drift apart. It does NOT set `labelPlacedByHand`: the
   * algorithm placing a label is not the author placing it, and treating it as
   * such would silence the very offer this ticket exists to make.
   *
   * @param {Array<Object>} targets - Waypoints whose labels to place
   */
  applyAutoPosition(targets) {
    if (!targets || targets.length === 0) return;

    for (const wp of targets) {
      const result = TextLabelService.autoPosition({
        waypoint: wp,
        waypointIndex: this.waypoints.indexOf(wp),
        waypoints: this.waypoints,
        pathPoints: this.pathPoints,
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height,
        imageToCanvas: (x, y) => this.coordinateTransform.imageToCanvas(x, y)
      });
      wp.labelOffsetX = Math.round(result.offsetX);
      wp.labelOffsetY = Math.round(result.offsetY);
    }

    // Offset sliders show the primary's result
    if (this.selectedWaypoint && targets.includes(this.selectedWaypoint)) {
      if (this.elements.labelOffsetX) {
        this.elements.labelOffsetX.value = this.selectedWaypoint.labelOffsetX;
        this.elements.labelOffsetXValue.textContent = `${this.selectedWaypoint.labelOffsetX}%`;
      }
      if (this.elements.labelOffsetY) {
        this.elements.labelOffsetY.value = this.selectedWaypoint.labelOffsetY;
        this.elements.labelOffsetYValue.textContent = `${this.selectedWaypoint.labelOffsetY}%`;
      }
    }

    this.eventBus.emit('waypoint:style-changed', this.selectedWaypoint);
  },

  /**
   * LABEL-01 — offer to move a label that has ended up overlapping something.
   *
   * An offer, never an action: a label the author placed by hand is left
   * exactly where they put it, and the prompt fades on its own. It is
   * deliberately not the only route to auto-position — the button sits in the
   * Label card's primary tier — so nothing is lost if the prompt is missed or
   * never seen.
   *
   * @param {Object|null} waypoint - The waypoint whose label was just edited
   * @returns {boolean} Whether an offer was made
   */
  offerAutoPositionIfColliding(waypoint) {
    if (!waypoint || !waypoint.label || !waypoint.isMajor) return false;
    if (!this.pathPoints || this.pathPoints.length === 0) return false;

    const collides = TextLabelService.collidesAtCurrentPosition({
      waypoint,
      waypointIndex: this.waypoints.indexOf(waypoint),
      waypoints: this.waypoints,
      pathPoints: this.pathPoints,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      imageToCanvas: (x, y) => this.coordinateTransform.imageToCanvas(x, y)
    });
    if (!collides) return false;

    this.showToast('This label overlaps something.', 8000, {
      label: 'Auto-position',
      onClick: () => this.applyAutoPosition([waypoint])
    });
    return true;
  }
};
