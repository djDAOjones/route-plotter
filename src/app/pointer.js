/**
 * Canvas pointer fallbacks and hit-testing (InteractionHandler owns the primary pointer pipeline).
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, pointerMixin).
 */
import { INTERACTION } from '../config/constants.js';

export const pointerMixin = {
  
  /* Mouse handlers now managed by InteractionHandler
  handleMouseDown(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if clicking on existing waypoint
    const clickedWaypoint = this.findWaypointAt(x, y);
    
    if (clickedWaypoint) {
      this.selectedWaypoint = clickedWaypoint;
      this.isDragging = true;
      this.hasDragged = false; // Reset drag flag
      // Store canvas offset for smooth dragging
      const wpCanvas = this.imageToCanvas(clickedWaypoint.imgX, clickedWaypoint.imgY);
      this.dragOffset.x = x - wpCanvas.x;
      this.dragOffset.y = y - wpCanvas.y;
      this.canvas.classList.add('dragging');
      
      // Emit selection event (updates editor UI)
      this.eventBus.emit('waypoint:selected', clickedWaypoint);
      this.updateWaypointList(); // Update list to show selection
      event.preventDefault();
    }
  },
  
  handleMouseMove(event) {
    if (this.isDragging && this.selectedWaypoint) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Convert canvas position to image coordinates (clamped to bounds)
      const canvasX = x - this.dragOffset.x;
      const canvasY = y - this.dragOffset.y;
      const imgPos = this.canvasToImage(canvasX, canvasY);
      this.selectedWaypoint.imgX = Math.max(0, Math.min(1, imgPos.x));
      this.selectedWaypoint.imgY = Math.max(0, Math.min(1, imgPos.y));
      this.hasDragged = true; // Mark that actual dragging occurred
      
      // Update path immediately for smooth visual feedback during drag
      this.calculatePath();
      // Batch render calls to prevent excessive rendering (60fps → ~2-3fps)
      this.queueRender();
    }
  },
  
  handleMouseUp(event) {
    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.classList.remove('dragging');
      
      // Emit position changed event if waypoint was actually moved
      // This triggers single auto-save instead of 60+ during drag
      if (this.hasDragged && this.selectedWaypoint) {
        this.eventBus.emit('waypoint:position-changed', this.selectedWaypoint);
        this.hasDragged = false;
        this.announce('Waypoint moved');
      }
      
      this.updateWaypointList();
    }
  },
  
  handleCanvasClick(event) {
    // Don't add waypoint if we actually dragged
    if (this.hasDragged) {
      this.hasDragged = false; // Reset for next time
      return;
    }
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if clicking on existing waypoint for selection
    const clickedWaypoint = this.findWaypointAt(x, y);
    if (clickedWaypoint) {
      this.selectedWaypoint = clickedWaypoint;
      this.updateWaypointList();
      this.updateWaypointEditor();
      return;
    }
    
    // Determine if major or minor waypoint (Shift+Click for minor)
    const isMajor = !event.shiftKey;
    
    // Convert canvas coordinates to normalized image coordinates
    const imgPos = this.canvasToImage(x, y);
    
    // Create waypoint using factory method
    // Waypoint model handles default properties and validation
    const waypoint = isMajor
      ? Waypoint.createMajor(imgPos.x, imgPos.y)
      : Waypoint.createMinor(imgPos.x, imgPos.y);
    
    // Set default label for major waypoints
    if (isMajor) {
      waypoint.label = `Waypoint ${this.waypoints.length + 1}`;
    }
    
    // Inherit properties from previous waypoint if exists
    // This ensures consistent styling across the route
    if (this.waypoints.length > 0) {
      const previousWaypoint = this.waypoints[this.waypoints.length - 1];
      waypoint.copyPropertiesFrom(previousWaypoint);
    }
    
    // Add waypoint to array
    this.waypoints.push(waypoint);
    
    // Emit waypoint added event (triggers path calculation, save, render)
    // Decoupled approach prevents tight coupling to specific update sequence
    this.eventBus.emit('waypoint:added', waypoint);
    
    this.announce(`${isMajor ? 'Major' : 'Minor'} waypoint added`);
    console.log(`Added ${isMajor ? 'major' : 'minor'} waypoint at (${x.toFixed(0)}, ${y.toFixed(0)})`);
  },
  */ // End of mouse/keyboard handlers now managed by InteractionHandler
  
  /**
   * Find waypoint at screen coordinates (from mouse click)
   * 
   * @param {number} screenX - X coordinate in screen space (CSS pixels)
   * @param {number} screenY - Y coordinate in screen space (CSS pixels)
   * @returns {Waypoint|undefined} Waypoint at position, or undefined
   */
  findWaypointAt(screenX, screenY) {
    // Convert screen coords to canvas coords (inverse viewport transform)
    const click = this.screenToCanvas(screenX, screenY);
    
    // Zoom-aware hit radius: constant in screen space, shrinks in canvas space when zoomed
    const zoom = this.viewport?.zoom || 1;
    const threshold = INTERACTION.WAYPOINT_HIT_RADIUS / zoom;
    
    // Find the closest waypoint within the threshold (not first-match)
    let closest = null;
    let closestDist = Infinity;
    
    for (const wp of this.waypoints) {
      const wpCanvas = this.imageToCanvas(wp.imgX, wp.imgY);
      const dx = wpCanvas.x - click.x;
      const dy = wpCanvas.y - click.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= threshold && dist < closestDist) {
        closest = wp;
        closestDist = dist;
      }
    }
    
    return closest;
  }
};
