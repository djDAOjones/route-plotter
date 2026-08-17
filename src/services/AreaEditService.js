/**
 * AreaEditService - Handles editing of existing area highlights
 * 
 * Capabilities:
 * - Drag circle/rectangle center to reposition
 * - Drag individual polygon vertices
 * - Render vertex handles and center handle in edit mode
 * - Hit-testing for handles (determines what the mouse is over)
 * 
 * ## Integration
 * - Listens for mouse events via EventBus during edit mode
 * - Only active when a waypoint with an area highlight is selected
 * - Renders edit handles via renderHandles() called by RenderingService
 * 
 * ## Coordinate System
 * All positions are normalized image coordinates (0-1).
 * Handle hit-testing uses pixel distance after coordinate transform.
 */

import { AREA_HIGHLIGHT } from '../config/constants.js';

/** @type {number} Pixel radius for handle hit detection */
const HANDLE_HIT_RADIUS = 8;

/** @type {number} Pixel size for rendered handle squares/circles */
const HANDLE_RENDER_SIZE = 5;

export class AreaEditService {
  /**
   * @param {EventBus} eventBus - Application event bus
   */
  constructor(eventBus) {
    /** @type {EventBus} */
    this.eventBus = eventBus;
    
    /** @type {boolean} Whether an area drag is in progress */
    this.isDragging = false;
    
    /** @type {string|null} What is being dragged: 'center', 'vertex' */
    this.dragTarget = null;
    
    /** @type {number} Index of polygon vertex being dragged (-1 if not vertex) */
    this.dragVertexIndex = -1;
    
    /** @type {Object|null} The waypoint whose area is being edited */
    this.activeWaypoint = null;
    
    /** @type {{x: number, y: number}|null} Drag start position (normalized) */
    this._dragStartImg = null;
    
    /** @type {{x: number, y: number}|null} Original center before drag (for undo) */
    this._origCenter = null;
    
    /** @type {{x: number, y: number}|null} Original vertex position before drag */
    this._origVertex = null;
    
    this._subscribeToEvents();
  }
  
  /**
   * Subscribe to EventBus events
   * @private
   */
  _subscribeToEvents() {
    // Track selected waypoint for handle rendering
    this.eventBus.on('waypoint:selected', (waypoint) => {
      this.activeWaypoint = waypoint;
    });
    
    this.eventBus.on('waypoint:deselected', () => {
      this.activeWaypoint = null;
      this.isDragging = false;
    });
    
    // Area edit drag events (emitted by InteractionHandler)
    this.eventBus.on('area:edit-start', ({ waypoint, imgX, imgY, imageToCanvas }) => {
      this._startDrag(waypoint, imgX, imgY, imageToCanvas);
    });
    
    this.eventBus.on('area:edit-move', ({ imgX, imgY }) => {
      this._updateDrag(imgX, imgY);
    });
    
    this.eventBus.on('area:edit-end', () => {
      this._endDrag();
    });
  }
  
  /**
   * Test if a screen position hits an area highlight handle
   * Returns the type of handle hit, or null if no hit
   * 
   * @param {Object} waypoint - Waypoint to test
   * @param {number} screenX - Screen X (CSS pixels relative to canvas)
   * @param {number} screenY - Screen Y (CSS pixels relative to canvas)
   * @param {Function} imageToCanvas - Coordinate transform
   * @param {number} displayWidth - Canvas width
   * @param {number} displayHeight - Canvas height
   * @returns {{type: string, vertexIndex?: number}|null} Hit result or null
   */
  hitTest(waypoint, screenX, screenY, imageToCanvas, displayWidth, displayHeight) {
    if (!waypoint?.hasAreaHighlight()) return null;
    
    const ah = waypoint.areaHighlight;
    const shape = ah.shape;
    
    if (shape === 'circle' || shape === 'rectangle') {
      // Test center handle
      const center = imageToCanvas(ah.centerX, ah.centerY);
      const dist = Math.sqrt((screenX - center.x) ** 2 + (screenY - center.y) ** 2);
      if (dist <= HANDLE_HIT_RADIUS) {
        return { type: 'center' };
      }
    }
    
    if (shape === 'polygon' && ah.points && ah.points.length > 0) {
      // Test each vertex handle
      for (let i = 0; i < ah.points.length; i++) {
        const p = imageToCanvas(ah.points[i].x, ah.points[i].y);
        const dist = Math.sqrt((screenX - p.x) ** 2 + (screenY - p.y) ** 2);
        if (dist <= HANDLE_HIT_RADIUS) {
          return { type: 'vertex', vertexIndex: i };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Start dragging a handle
   * @private
   * @param {Object} waypoint - Waypoint being edited
   * @param {number} imgX - Normalized image X
   * @param {number} imgY - Normalized image Y
   * @param {Function} imageToCanvas - Coordinate transform for hit test
   */
  _startDrag(waypoint, imgX, imgY, imageToCanvas) {
    if (!waypoint?.hasAreaHighlight()) return;
    
    const ah = waypoint.areaHighlight;
    this.activeWaypoint = waypoint;
    this._dragStartImg = { x: imgX, y: imgY };
    
    if (ah.shape === 'circle' || ah.shape === 'rectangle') {
      this.isDragging = true;
      this.dragTarget = 'center';
      this._origCenter = { x: ah.centerX, y: ah.centerY };
    } else if (ah.shape === 'polygon') {
      // Find which vertex is closest to drag start
      // We need canvas coords for hit testing, so use the imageToCanvas fn
      const canvasPos = imageToCanvas(imgX, imgY);
      const hit = this.hitTest(waypoint, canvasPos.x, canvasPos.y, imageToCanvas, 0, 0);
      if (hit && hit.type === 'vertex') {
        this.isDragging = true;
        this.dragTarget = 'vertex';
        this.dragVertexIndex = hit.vertexIndex;
        this._origVertex = { ...ah.points[hit.vertexIndex] };
      }
    }
  }
  
  /**
   * Update drag position
   * @private
   * @param {number} imgX - Current normalized image X
   * @param {number} imgY - Current normalized image Y
   */
  _updateDrag(imgX, imgY) {
    if (!this.isDragging || !this.activeWaypoint) return;
    
    const ah = this.activeWaypoint.areaHighlight;
    const clampedX = Math.max(0, Math.min(1, imgX));
    const clampedY = Math.max(0, Math.min(1, imgY));
    
    if (this.dragTarget === 'center') {
      ah.centerX = clampedX;
      ah.centerY = clampedY;
    } else if (this.dragTarget === 'vertex' && this.dragVertexIndex >= 0) {
      ah.points[this.dragVertexIndex] = { x: clampedX, y: clampedY };
    }
    
    this.eventBus.emit('render:request');
  }
  
  /**
   * End drag and commit changes
   * @private
   */
  _endDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.dragTarget = null;
    this.dragVertexIndex = -1;
    this._dragStartImg = null;
    this._origCenter = null;
    this._origVertex = null;
    
    if (this.activeWaypoint) {
      this.eventBus.emit('area:changed', { waypoint: this.activeWaypoint });
    }
  }
  
  /**
   * Render edit handles for the selected waypoint's area highlight
   * Called by RenderingService in edit mode
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} waypoint - Selected waypoint
   * @param {Function} imageToCanvas - Coordinate transform
   * @param {number} displayWidth - Canvas width
   * @param {number} displayHeight - Canvas height
   */
  renderHandles(ctx, waypoint, imageToCanvas, displayWidth, displayHeight) {
    if (!waypoint?.hasAreaHighlight()) return;
    
    const ah = waypoint.areaHighlight;
    const shape = ah.shape;
    
    ctx.save();
    
    if (shape === 'circle' || shape === 'rectangle') {
      // Draw center handle (crosshair style)
      const center = imageToCanvas(ah.centerX, ah.centerY);
      this._drawCenterHandle(ctx, center.x, center.y);
    }
    
    if (shape === 'polygon' && ah.points && ah.points.length > 0) {
      // Draw vertex handles
      for (let i = 0; i < ah.points.length; i++) {
        const p = imageToCanvas(ah.points[i].x, ah.points[i].y);
        this._drawVertexHandle(ctx, p.x, p.y, i === 0);
      }
    }
    
    ctx.restore();
  }
  
  /**
   * Draw a center reposition handle (filled circle with crosshair)
   * @private
   */
  _drawCenterHandle(ctx, x, y) {
    const s = HANDLE_RENDER_SIZE;
    
    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, s + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#0066CC';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Inner dot
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#0066CC';
    ctx.fill();
    
    // Crosshair lines
    ctx.beginPath();
    ctx.moveTo(x - s - 4, y);
    ctx.lineTo(x - s + 1, y);
    ctx.moveTo(x + s - 1, y);
    ctx.lineTo(x + s + 4, y);
    ctx.moveTo(x, y - s - 4);
    ctx.lineTo(x, y - s + 1);
    ctx.moveTo(x, y + s - 1);
    ctx.lineTo(x, y + s + 4);
    ctx.strokeStyle = '#0066CC';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  
  /**
   * Draw a polygon vertex handle (square for regular vertices, circle for first)
   * @private
   * @param {boolean} isFirst - Whether this is the first vertex (origin)
   */
  _drawVertexHandle(ctx, x, y, isFirst) {
    const s = HANDLE_RENDER_SIZE;
    
    if (isFirst) {
      // Circle for first vertex (matches drawing close target)
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#0f62fe';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Square for other vertices
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.strokeStyle = '#0066CC';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - s, y - s, s * 2, s * 2);
    }
  }
}
