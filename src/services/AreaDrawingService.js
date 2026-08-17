/**
 * AreaDrawingService - Modal polygon drawing mode
 * 
 * Manages the interactive polygon vertex placement workflow:
 * 1. User clicks "Draw Area" → enters modal draw mode
 * 2. Each canvas click places a vertex (normalized image coords)
 * 3. Live preview shows edges + closing line to cursor
 * 4. Double-click or click near first vertex closes the polygon
 * 5. ESC cancels drawing, removing all placed vertices
 * 
 * ## Integration
 * - Intercepts canvas clicks via EventBus (`canvas:click-intercepted`)
 * - InteractionHandler checks `isDrawingArea` flag before normal processing
 * - Renders preview overlay via AreaHighlightRenderer
 * - On completion, writes points to waypoint.areaHighlight and emits area:changed
 * 
 * ## Accessibility
 * - Banner announces draw mode with instructions
 * - ESC key always available to cancel
 * - Minimum 3 vertices enforced before closing
 */

import { AREA_HIGHLIGHT } from '../config/constants.js';

export class AreaDrawingService {
  /**
   * @param {EventBus} eventBus - Application event bus
   */
  constructor(eventBus) {
    /** @type {EventBus} */
    this.eventBus = eventBus;
    
    /** @type {boolean} Whether polygon draw mode is active */
    this.isDrawing = false;
    
    /** @type {Object|null} Waypoint being drawn for */
    this.targetWaypoint = null;
    
    /** @type {Array<{x: number, y: number}>} Vertices placed so far (normalized 0-1) */
    this.vertices = [];
    
    /** @type {{x: number, y: number}|null} Current mouse position (normalized) for preview line */
    this.cursorPosition = null;
    
    /** @type {HTMLElement|null} Draw-mode banner element */
    this._banner = null;
    
    /** @type {Function|null} Bound keydown handler for cleanup */
    this._keyHandler = null;
    
    /** @type {Function|null} Bound mousemove handler for cleanup */
    this._moveHandler = null;
    
    this._subscribeToEvents();
  }
  
  /**
   * Subscribe to EventBus events
   * @private
   */
  _subscribeToEvents() {
    // Start drawing when user clicks "Draw Area" button
    this.eventBus.on('area:draw-start', ({ waypoint }) => {
      this.startDrawing(waypoint);
    });
    
    // Canvas click during draw mode — place vertex
    this.eventBus.on('area:draw-click', ({ imgX, imgY }) => {
      if (!this.isDrawing) return;
      this._placeVertex(imgX, imgY);
    });
    
    // Canvas mouse move during draw mode — update preview cursor
    this.eventBus.on('area:draw-move', ({ imgX, imgY }) => {
      if (!this.isDrawing) return;
      this.cursorPosition = { x: imgX, y: imgY };
      this.eventBus.emit('render:request');
    });
  }
  
  /**
   * Enter modal polygon draw mode
   * @param {Object} waypoint - Waypoint to attach the polygon to
   */
  startDrawing(waypoint) {
    if (this.isDrawing) {
      this.cancelDrawing();
    }
    
    this.isDrawing = true;
    this.targetWaypoint = waypoint;
    this.vertices = [];
    this.cursorPosition = null;
    
    // Show draw-mode banner
    this._showBanner();
    
    // Listen for ESC key to cancel
    this._keyHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.cancelDrawing();
      }
    };
    document.addEventListener('keydown', this._keyHandler, true); // capture phase
    
    // Notify InteractionHandler to intercept clicks
    this.eventBus.emit('area:draw-mode-changed', { active: true });
    
    console.log('[AreaDrawing] Entered polygon draw mode');
  }
  
  /**
   * Place a vertex at the given normalized image coordinates
   * @private
   * @param {number} imgX - Normalized X (0-1)
   * @param {number} imgY - Normalized Y (0-1)
   */
  _placeVertex(imgX, imgY) {
    // Check if clicking near first vertex to close polygon
    if (this.vertices.length >= AREA_HIGHLIGHT.DRAW_MIN_VERTICES) {
      const first = this.vertices[0];
      const dist = Math.sqrt((imgX - first.x) ** 2 + (imgY - first.y) ** 2);
      if (dist < AREA_HIGHLIGHT.DRAW_CLOSE_THRESHOLD) {
        this._completePolygon();
        return;
      }
    }
    
    this.vertices.push({ x: imgX, y: imgY });
    this._updateBannerCount();
    this.eventBus.emit('render:request');
    
    console.log(`[AreaDrawing] Vertex ${this.vertices.length} placed at (${imgX.toFixed(3)}, ${imgY.toFixed(3)})`);
  }
  
  /**
   * Complete the polygon and write to waypoint
   * @private
   */
  _completePolygon() {
    if (!this.targetWaypoint || this.vertices.length < AREA_HIGHLIGHT.DRAW_MIN_VERTICES) {
      this.cancelDrawing();
      return;
    }
    
    // Write polygon data to waypoint
    const ah = this.targetWaypoint.areaHighlight;
    ah.shape = 'polygon';
    ah.enabled = true;
    ah.points = this.vertices.map(v => ({ x: v.x, y: v.y })); // Deep copy
    
    console.log(`[AreaDrawing] Polygon completed with ${this.vertices.length} vertices`);
    
    // Clean up draw mode
    this._exitDrawMode();
    
    // Emit change event to trigger render + autosave
    this.eventBus.emit('area:changed', { waypoint: this.targetWaypoint });
    
    // Refresh sidebar controls to show polygon shape selected
    this.eventBus.emit('area:draw-completed', { waypoint: this.targetWaypoint });
  }
  
  /**
   * Cancel drawing without saving
   */
  cancelDrawing() {
    if (!this.isDrawing) return;
    
    console.log('[AreaDrawing] Drawing cancelled');
    this._exitDrawMode();
    this.eventBus.emit('render:request');
  }
  
  /**
   * Clean up draw mode state and DOM
   * @private
   */
  _exitDrawMode() {
    this.isDrawing = false;
    this.vertices = [];
    this.cursorPosition = null;
    this.targetWaypoint = null;
    
    // Remove banner
    this._hideBanner();
    
    // Remove ESC listener
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }
    
    // Notify InteractionHandler
    this.eventBus.emit('area:draw-mode-changed', { active: false });
  }
  
  /**
   * Show the draw-mode banner at the top of the canvas area
   * @private
   */
  _showBanner() {
    this._hideBanner(); // Remove any existing banner
    
    this._banner = document.createElement('div');
    this._banner.id = 'area-draw-banner';
    this._banner.setAttribute('role', 'status');
    this._banner.setAttribute('aria-live', 'polite');
    this._banner.innerHTML = `
      <span class="banner-text">
        <strong>Drawing polygon area</strong> — Click to place vertices. 
        Click near the first point or double-click to close. 
        <kbd>Esc</kbd> to cancel.
        <span class="banner-count">0 vertices</span>
      </span>
      <button class="banner-cancel" aria-label="Cancel drawing">Cancel</button>
    `;
    
    // Style inline to avoid CSS dependency for this transient element
    Object.assign(this._banner.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      zIndex: '1000',
      padding: '8px 16px',
      background: 'var(--cds-interactive-01, #0f62fe)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontFamily: 'var(--font-ui, "IBM Plex Sans", sans-serif)',
      fontSize: '14px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
    });
    
    const cancelBtn = this._banner.querySelector('.banner-cancel');
    Object.assign(cancelBtn.style, {
      background: 'transparent',
      border: '1px solid #fff',
      color: '#fff',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '13px'
    });
    cancelBtn.addEventListener('click', () => this.cancelDrawing());
    
    document.body.appendChild(this._banner);
  }
  
  /**
   * Update vertex count display in banner
   * @private
   */
  _updateBannerCount() {
    if (!this._banner) return;
    const countEl = this._banner.querySelector('.banner-count');
    if (countEl) {
      const n = this.vertices.length;
      const remaining = Math.max(0, AREA_HIGHLIGHT.DRAW_MIN_VERTICES - n);
      countEl.textContent = remaining > 0
        ? `${n} vertices (${remaining} more needed to close)`
        : `${n} vertices (click near first to close)`;
    }
  }
  
  /**
   * Hide and remove the draw-mode banner
   * @private
   */
  _hideBanner() {
    if (this._banner && this._banner.parentNode) {
      this._banner.parentNode.removeChild(this._banner);
    }
    this._banner = null;
  }
  
  /**
   * Render the in-progress polygon preview on canvas
   * Called by RenderingService during draw mode
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Function} imageToCanvas - Coordinate transform
   */
  renderPreview(ctx, imageToCanvas) {
    if (!this.isDrawing || this.vertices.length === 0) return;
    
    ctx.save();
    
    // Draw placed edges
    ctx.beginPath();
    const first = imageToCanvas(this.vertices[0].x, this.vertices[0].y);
    ctx.moveTo(first.x, first.y);
    
    for (let i = 1; i < this.vertices.length; i++) {
      const p = imageToCanvas(this.vertices[i].x, this.vertices[i].y);
      ctx.lineTo(p.x, p.y);
    }
    
    // Draw preview line to cursor
    if (this.cursorPosition) {
      const cursor = imageToCanvas(this.cursorPosition.x, this.cursorPosition.y);
      ctx.lineTo(cursor.x, cursor.y);
      
      // Draw closing line from cursor back to first vertex (dashed)
      ctx.stroke(); // Stroke the solid edges first
      
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(cursor.x, cursor.y);
      ctx.lineTo(first.x, first.y);
    }
    
    ctx.strokeStyle = '#0f62fe';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw vertex markers
    for (let i = 0; i < this.vertices.length; i++) {
      const p = imageToCanvas(this.vertices[i].x, this.vertices[i].y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === 0 ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#0f62fe' : '#fff';
      ctx.fill();
      ctx.strokeStyle = '#0f62fe';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw semi-transparent fill preview if enough vertices
    if (this.vertices.length >= AREA_HIGHLIGHT.DRAW_MIN_VERTICES) {
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < this.vertices.length; i++) {
        const p = imageToCanvas(this.vertices[i].x, this.vertices[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(15, 98, 254, 0.1)';
      ctx.fill();
    }
    
    ctx.restore();
  }
}
