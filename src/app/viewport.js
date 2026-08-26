/**
 * Canvas viewport: aspect ratio, visible bounds, screen/canvas/image coordinate conversion, manual zoom.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, viewportMixin).
 */

export const viewportMixin = {
  
  /**
   * Update canvas size to match export aspect ratio using contain-fit.
   * Maximizes canvas within available space while maintaining aspect ratio.
   * Called on export resolution change and window resize.
   */
  updateCanvasAspectRatio() {
    const targetAspect = this.exportSettings.resolutionX / this.exportSettings.resolutionY;
    
    // Get available space in canvas-area
    const container = this.canvas.parentElement;
    const playbar = container.querySelector('.controls');
    const playbarHeight = playbar ? playbar.offsetHeight : 60;
    const availableWidth = container.clientWidth;
    const availableHeight = container.clientHeight - playbarHeight;
    const containerAspect = availableWidth / availableHeight;
    
    // Contain fit: use whichever dimension is the constraint
    let canvasWidth, canvasHeight;
    if (targetAspect > containerAspect) {
      // Width-constrained (canvas is wider than container)
      canvasWidth = availableWidth;
      canvasHeight = availableWidth / targetAspect;
    } else {
      // Height-constrained (canvas is taller than container)
      canvasHeight = availableHeight;
      canvasWidth = availableHeight * targetAspect;
    }
    
    // Apply explicit dimensions
    this.canvas.style.width = `${canvasWidth}px`;
    this.canvas.style.height = `${canvasHeight}px`;
    this.canvas.style.aspectRatio = '';
    this.canvas.style.margin = '0';
    
    // Match playbar width to canvas for clean layout
    if (playbar) {
      const isReflowLayout = window.matchMedia?.('(max-width: 64rem)').matches ?? false;
      // The reflow stylesheet makes the controls span the viewport column.
      // Clear the desktop canvas-width override so its width:100% can apply.
      playbar.style.width = isReflowLayout ? '' : `${canvasWidth}px`;
    }
    
    // Update backing store for HiDPI
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(dpr, 3);
    this.canvasScale = scale;
    this.canvas.width = Math.round(canvasWidth * scale);
    this.canvas.height = Math.round(canvasHeight * scale);
    
    // Reset transform and apply scale
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(scale, scale);
    // Smooth interpolation for background image scaling (bilinear/bicubic).
    // Without this, zoomed raster images use nearest-neighbor (blocky pixels).
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    
    // Update display dimensions
    this.displayWidth = canvasWidth;
    this.displayHeight = canvasHeight;
    
    // Update coordinate transform service
    this.coordinateTransform.setCanvasDimensions(this.displayWidth, this.displayHeight);
    
    // Recalculate image bounds
    if (this.background.image) {
      this.updateImageTransform(this.background.image);
    }
    
    // Recalculate path and render
    if (this.waypoints.length >= 2) {
      this.calculatePath();
    }
    this.render();
    
    console.debug(`📐 [AspectRatio] Canvas set to ${Math.round(canvasWidth)}×${Math.round(canvasHeight)} (${targetAspect.toFixed(2)}:1)`);
  },
  
  /**
   * Calculate the visible image bounds in normalized coordinates (0-1)
   * Accounts for both canvas aspect ratio (cover mode) and zoom level.
   * 
   * Cover mode: image fills canvas, cropping the dimension that overflows.
   * Zoom > 1: crops further into the center
   * Zoom < 1: shrinks image with padding (all of cover-visible area is shown)
   * 
   * @returns {{minX: number, maxX: number, minY: number, maxY: number}} Visible bounds in image coords
   */
  getVisibleImageBounds() {
    // With contain mode rendering, the full image is always visible (no cropping)
    // Waypoint coordinates are stored in normalized image space (0-1)
    // The entire image is always accessible regardless of aspect ratio
    return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  },
  
  /**
   * Clamp all waypoints to stay within the visible canvas bounds
   * Called when zoom changes to prevent waypoints from going out of view
   * Waypoints are clamped to the edge of the visible area
   */
  clampWaypointsToCanvas() {
    const zoom = this.exportSettings.backgroundZoom / 100;
    
    // When zoomed out, waypoints are allowed outside image bounds
    if (zoom < 1) return;
    
    // Clamp waypoints to image bounds (0-1 normalized)
    let clampedCount = 0;
    for (const wp of this.waypoints) {
      if (wp.imgX < 0) { wp.imgX = 0; clampedCount++; }
      else if (wp.imgX > 1) { wp.imgX = 1; clampedCount++; }
      if (wp.imgY < 0) { wp.imgY = 0; clampedCount++; }
      else if (wp.imgY > 1) { wp.imgY = 1; clampedCount++; }
    }
    
    if (clampedCount > 0) {
      if (this.waypoints.length >= 2) {
        this.calculatePath();
      }
      this.showToast(`${clampedCount} waypoint(s) moved to fit within the image at this zoom level`, 4000);
    }
  },
  
  /**
   * Check if a waypoint is visible at the current zoom level
   * @param {Object} waypoint - Waypoint with imgX, imgY normalized coordinates
   * @returns {boolean} True if waypoint is within visible bounds
   */
  isWaypointVisible(waypoint) {
    const bounds = this.getVisibleImageBounds();
    return waypoint.imgX >= bounds.minX && waypoint.imgX <= bounds.maxX &&
           waypoint.imgY >= bounds.minY && waypoint.imgY <= bounds.maxY;
  },
  
  /**
   * Get the visible bounds in normalized coordinates at current zoom
   * @returns {{minX: number, maxX: number, minY: number, maxY: number}} Visible bounds
   */
  getVisibleBounds() {
    return this.getVisibleImageBounds();
  },
  
  /**
   * Update coordinateTransform service when image changes
   * @param {HTMLImageElement} img - The loaded image
   */
  updateImageTransform(img) {
    if (!img) {
      // No image: forget the previous bitmap bounds but keep the canvas size
      // so normalized authoring still spans the whole surface.
      this.coordinateTransform.clearImage();
      return;
    }
    
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    // Always use 'fit' mode for contain rendering (full image visible with letterboxing)
    this.coordinateTransform.setImageDimensions(width, height, 'fit');
  },
  
  // ========== COORDINATE TRANSFORM PIPELINE ==========
  // 
  // Three coordinate spaces:
  //   1. Screen coords  - CSS pixels from mouse events (relative to canvas element)
  //   2. Canvas coords  - Unzoomed canvas space (CSS pixels, what CoordinateTransform uses)
  //   3. Image coords   - Normalized 0-1 coordinates within the image
  //
  // The viewport (zoom/pan) transforms between Screen and Canvas.
  // CoordinateTransform handles Canvas ↔ Image (letterboxing, aspect ratio).
  //
  // Pipeline:
  //   Screen → screenToCanvas() → Canvas → canvasToImage() → Image
  //   Image  → imageToCanvas()  → Canvas → canvasToScreen() → Screen
  // ========================================================
  
  /**
   * Convert screen coordinates to canvas coordinates (inverse viewport transform)
   * 
   * Screen coords are CSS pixels from mouse events (e.g., clientX - rect.left).
   * Canvas coords are the unzoomed coordinate space used by CoordinateTransform.
   * 
   * The viewport renders with: ctx.scale(zoom) → ctx.translate(-panX, -panY)
   * This means canvas point (x,y) appears on screen at ((x - panX) * zoom, (y - panY) * zoom)
   * So to reverse: canvasX = screenX / zoom + panX
   * 
   * @param {number} screenX - X coordinate in screen space (CSS pixels)
   * @param {number} screenY - Y coordinate in screen space (CSS pixels)
   * @returns {{x: number, y: number}} Canvas coordinates (unzoomed space)
   */
  screenToCanvas(screenX, screenY) {
    if (this.viewport && this.viewport.zoom !== 1) {
      return {
        x: screenX / this.viewport.zoom + this.viewport.panX,
        y: screenY / this.viewport.zoom + this.viewport.panY
      };
    }
    return { x: screenX, y: screenY };
  },
  
  /**
   * Convert canvas coordinates to screen coordinates (forward viewport transform)
   * 
   * Canvas coords are the unzoomed coordinate space used by CoordinateTransform.
   * Screen coords are where things appear on screen after viewport zoom/pan.
   * 
   * @param {number} canvasX - X coordinate in canvas space (unzoomed)
   * @param {number} canvasY - Y coordinate in canvas space (unzoomed)
   * @returns {{x: number, y: number}} Screen coordinates (CSS pixels)
   */
  canvasToScreen(canvasX, canvasY) {
    if (this.viewport && this.viewport.zoom !== 1) {
      return {
        x: (canvasX - this.viewport.panX) * this.viewport.zoom,
        y: (canvasY - this.viewport.panY) * this.viewport.zoom
      };
    }
    return { x: canvasX, y: canvasY };
  },
  
  /**
   * Convert screen coordinates to normalized image coordinates (0-1)
   * Combines screenToCanvas + CoordinateTransform.canvasToImage
   * 
   * @param {number} screenX - X coordinate in screen space (CSS pixels from click)
   * @param {number} screenY - Y coordinate in screen space (CSS pixels from click)
   * @returns {{x: number, y: number}} Normalized image coordinates (0-1, clamped)
   */
  screenToImage(screenX, screenY) {
    // Convert screen → canvas (inverse viewport)
    const canvas = this.screenToCanvas(screenX, screenY);
    
    // Convert canvas → image (CoordinateTransform handles letterboxing)
    const result = this.coordinateTransform.canvasToImage(canvas.x, canvas.y);
    
    // When zoomed out, allow coords outside 0-1 (outside image area)
    // Downstream handlers (waypoint:position-changed, waypoint:add) handle clamping
    const zoom = this.exportSettings.backgroundZoom / 100;
    if (zoom < 1) {
      return result;
    }
    
    // Clamp to valid image bounds (0-1) when at or above 100% zoom
    return {
      x: Math.max(0, Math.min(1, result.x)),
      y: Math.max(0, Math.min(1, result.y))
    };
  },
  
  /**
   * Convert normalized image coordinates (0-1) to screen coordinates
   * Combines CoordinateTransform.imageToCanvas + canvasToScreen
   * 
   * @param {number} imageX - Normalized X coordinate (0-1)
   * @param {number} imageY - Normalized Y coordinate (0-1)
   * @returns {{x: number, y: number}} Screen coordinates (CSS pixels)
   */
  imageToScreen(imageX, imageY) {
    // Convert image → canvas (CoordinateTransform handles letterboxing)
    const canvas = this.coordinateTransform.imageToCanvas(imageX, imageY);
    
    // Convert canvas → screen (forward viewport)
    return this.canvasToScreen(canvas.x, canvas.y);
  },
  
  /**
   * Convert screen coordinates to canvas coordinates, then to image coordinates
   * DEPRECATED: Use screenToImage() for clarity. This alias exists for backwards compatibility.
   * 
   * @param {number} screenX - X coordinate in screen space (CSS pixels from click)
   * @param {number} screenY - Y coordinate in screen space (CSS pixels from click)
   * @returns {{x: number, y: number}} Normalized image coordinates (0-1)
   */
  canvasToImage(screenX, screenY) {
    // Note: Despite the name, this actually takes screen coords (for backwards compat)
    return this.screenToImage(screenX, screenY);
  },
  
  /**
   * Convert normalized image coordinates (0-1) to canvas coordinates (unzoomed space)
   * Accounts for letterboxing when image aspect ratio differs from canvas.
   * 
   * Note: Returns CANVAS coords, not screen coords. Use imageToScreen() if you need
   * screen coordinates that account for viewport zoom/pan.
   * 
   * @param {number} imageX - Normalized X coordinate (0-1)
   * @param {number} imageY - Normalized Y coordinate (0-1)
   * @param {boolean} clamp - If true, clamp result to canvas bounds (default: false)
   * @returns {{x: number, y: number}} Canvas coordinates (unzoomed space)
   */
  imageToCanvas(imageX, imageY, clamp = false) {
    // Use CoordinateTransform service for contain mode rendering
    // This accounts for letterboxing when image aspect ratio differs from canvas
    const result = this.coordinateTransform.imageToCanvas(imageX, imageY);
    
    // Optionally clamp to canvas boundaries
    if (clamp) {
      return {
        x: Math.max(0, Math.min(this.displayWidth, result.x)),
        y: Math.max(0, Math.min(this.displayHeight, result.y))
      };
    }
    
    return result;
  },
  
  /**
   * Check if screen coordinates are within the image bounds
   * Converts screen → canvas before checking bounds.
   * 
   * @param {number} screenX - X coordinate in screen space (CSS pixels)
   * @param {number} screenY - Y coordinate in screen space (CSS pixels)
   * @returns {boolean} True if coordinates are within image bounds
   */
  isWithinImageBounds(screenX, screenY) {
    // Convert screen → canvas first (inverse viewport)
    const canvas = this.screenToCanvas(screenX, screenY);
    return this.coordinateTransform.isWithinImageBounds(canvas.x, canvas.y);
  },
  
  // ========== ZOOM/PAN METHODS ==========
  
  /**
   * Zoom in by 1.5x, centered on selected waypoint
   * 
   * Zoom levels compound: 1x → 1.5x → 2.25x → 3.375x → ... → 32x max
   * If no waypoint is selected, shows a prompt to select one.
   */
  zoomIn() {
    if (!this.selectedWaypoint) {
      this.showSelectWaypointPrompt();
      return;
    }
    
    const newZoom = Math.min(this.viewport.zoom * 1.5, this.viewport.maxZoom);
    if (newZoom !== this.viewport.zoom) {
      this.setZoom(newZoom, this.selectedWaypoint);
    }
  },
  
  /**
   * Zoom out by 1.5x, centered on selected waypoint
   * 
   * Zoom levels compound: ... → 2.25x → 1.5x → 1x min
   * If no waypoint is selected, shows a prompt to select one.
   */
  zoomOut() {
    if (!this.selectedWaypoint) {
      this.showSelectWaypointPrompt();
      return;
    }
    
    const newZoom = Math.max(this.viewport.zoom / 1.5, this.viewport.minZoom);
    if (newZoom !== this.viewport.zoom) {
      this.setZoom(newZoom, this.selectedWaypoint);
    }
  },
  
  /**
   * Reset zoom to 1x and clear pan offset
   */
  resetZoom() {
    this.viewport.zoom = 1;
    this.viewport.panX = 0;
    this.viewport.panY = 0;
    
    // Update InteractionHandler for proportional nudge
    this.interactionHandler?.setZoomLevel(1);
    
    this.render();
    console.debug('🔍 Zoom reset to 1x');
  },
  
  /**
   * Set zoom level centered on a specific waypoint
   * 
   * The pan offset is calculated so the waypoint appears at the center
   * of the canvas after zooming.
   * 
   * @param {number} newZoom - Target zoom level (1-32)
   * @param {Waypoint} centerWaypoint - Waypoint to center zoom on
   */
  setZoom(newZoom, centerWaypoint) {
    // Get waypoint position in canvas coordinates (unzoomed)
    const waypointCanvas = this.imageToCanvas(centerWaypoint.imgX, centerWaypoint.imgY);
    
    // Canvas center in screen coordinates
    const canvasCenterX = this.displayWidth / 2;
    const canvasCenterY = this.displayHeight / 2;
    
    // Update zoom
    const oldZoom = this.viewport.zoom;
    this.viewport.zoom = newZoom;
    
    // Update InteractionHandler for proportional nudge
    this.interactionHandler?.setZoomLevel(newZoom);
    
    // Calculate pan offset to center the waypoint on screen
    // The transform is: screenPos = (canvasPos - panOffset) * zoom
    // We want the waypoint at canvas center, so:
    // canvasCenter = (waypointCanvas - panOffset) * zoom
    // panOffset = waypointCanvas - canvasCenter / zoom
    this.viewport.panX = waypointCanvas.x - canvasCenterX / newZoom;
    this.viewport.panY = waypointCanvas.y - canvasCenterY / newZoom;
    
    this.render();
    console.debug(`🔍 Zoom: ${oldZoom.toFixed(2)}x → ${newZoom.toFixed(2)}x (centered on waypoint at ${waypointCanvas.x.toFixed(0)}, ${waypointCanvas.y.toFixed(0)})`);
  },
  
  /**
   * Show a brief prompt asking user to select a waypoint for zoom
   */
  showSelectWaypointPrompt() {
    // Create or reuse prompt element
    let prompt = document.getElementById('zoom-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.id = 'zoom-prompt';
      prompt.className = 'zoom-prompt';
      prompt.innerHTML = '<span>Select a waypoint to zoom</span>';
      document.body.appendChild(prompt);
    }
    
    // Show prompt
    prompt.classList.add('visible');
    
    // Auto-hide after 2 seconds
    clearTimeout(this._zoomPromptTimeout);
    this._zoomPromptTimeout = setTimeout(() => {
      prompt.classList.remove('visible');
    }, 2000);
  }
};
