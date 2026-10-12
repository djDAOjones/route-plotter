/**
 * AreaDrawingService - Modal polygon drawing mode
 * 
 * Manages the interactive polygon vertex placement workflow:
 * 1. User clicks "Draw Area" → enters modal draw mode
 * 2. Each canvas click places a vertex (normalized image coords)
 * 3. Live preview shows edges + closing line to cursor
 * 4. A click near the first vertex closes the polygon
 * 5. ESC cancels drawing, removing all placed vertices
 * 
 * ## Integration
 * - Intercepts canvas clicks via EventBus (`canvas:click-intercepted`)
 * - InteractionHandler checks `isDrawingArea` flag before normal processing
 * - Renders preview overlay via AreaHighlightRenderer
 * - On completion, writes points to waypoint.areaHighlight and emits area:changed
 * 
 * ## Accessibility
 * - Its banner shows in the page's one slot (ModeBanner, UI-06 J-12); the
 *   mode is announced once on entry and each corner's count as it is placed
 *   (the banner is not a live region: UI-06 J-05)
 * - ESC key always available to cancel; the banner's Cancel gives focus back
 *   to Draw area
 * - Minimum 3 vertices enforced before closing
 */

import { AREA_HIGHLIGHT } from '../config/constants.js';
import { clampImageCoordinate } from '../utils/imageCoordinates.js';
import { pageModeBanner, returnFocus, visibleFocusTarget } from '../components/ModeBanner.js';

/** Said once as the draw starts: the banner's words, Esc read as Escape (the network's pattern). */
const ENTRY_ANNOUNCEMENT = 'Drawing an area — Click to place corners. Click near the first point to close. Escape to cancel.';

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

    /** @type {import('../components/ModeBanner.js').ModeBanner|null} The slot the banner shows in */
    this._modeBanner = null;

    /** Its owner in the slot: another mode's banner ends the draw as Escape does. */
    this._bannerOwner = { onReplaced: () => this.cancelDrawing() };
    
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

    // A successful project replacement or Clear All invalidates every model
    // reference owned by the modal tool. Failed loads emit neither event and
    // deliberately leave the in-progress drawing untouched.
    this.eventBus.on('project:replaced', () => this.cancelDrawing());
    this.eventBus.on('app:cleared', () => this.cancelDrawing());
  }
  
  /**
   * Enter modal polygon draw mode
   * @param {Object} waypoint - Waypoint to attach the polygon to
   */
  startDrawing(waypoint) {
    // Draw Area keeps focus through the canvas clicks, so Space or Enter asks
    // again for the draw in progress: it goes on, its vertices kept (DEF-43).
    if (this.isDrawing && this.targetWaypoint === waypoint) return;
    if (this.isDrawing) {
      this.cancelDrawing();
    }

    // The slot first, before anything here changes: another mode's banner
    // ends that mode, its Preview restore included, before this draw records
    // the Preview it starts from (UI-06 PR 6; Codex on 9466a3f, blocking 1).
    this._showBanner();
    
    this.isDrawing = true;
    this.targetWaypoint = waypoint;
    this.vertices = [];
    this.cursorPosition = null;
    
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
    // Its banner was its voice: said once now, through the one announcer.
    this.eventBus.emit('ui:announce', { message: ENTRY_ANNOUNCEMENT });
    
    console.log('[AreaDrawing] Entered polygon draw mode');
  }
  
  /**
   * Place a vertex at the given normalized image coordinates
   * @private
   * @param {number} imgX - Normalized X (0–1 spans the image; outside it when zoomed out)
   * @param {number} imgY - Normalized Y (0–1 spans the image; outside it when zoomed out)
   */
  _placeVertex(imgX, imgY) {
    // Zoomed out, a vertex can be placed in the canvas margin, off the image;
    // keep it within what load accepts (DEF-03)
    imgX = clampImageCoordinate(imgX);
    imgY = clampImageCoordinate(imgY);

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
    
    // Leaving draw mode forgets the target, so keep it for the announcements
    // below; without it they named no waypoint (DEF-17)
    const waypoint = this.targetWaypoint;
    
    // Write polygon data to waypoint
    const ah = waypoint.areaHighlight;
    ah.shape = 'polygon';
    ah.enabled = true;
    ah.points = this.vertices.map(v => ({ x: v.x, y: v.y })); // Deep copy
    
    console.log(`[AreaDrawing] Polygon completed with ${this.vertices.length} vertices`);
    
    // Clean up draw mode
    this._exitDrawMode();
    
    // Emit change event to trigger render + autosave
    this.eventBus.emit('area:changed', { waypoint });
    
    // Refresh sidebar controls to show polygon shape selected
    this.eventBus.emit('area:draw-completed', { waypoint });
  }
  
  /**
   * The model's waypoints have changed under a draw: a deletion, an undo or a
   * redo. The draw follows its waypoint to the one with the same id (undo and
   * redo restore copies), and ends when there is none, rather than closing
   * onto a waypoint the project no longer has, where the polygon was lost
   * without a word (DEF-43). An id names one waypoint only within a project:
   * a load refuses duplicates, and opening a project ends a draw rather than
   * following it into the new one.
   * @param {Array<Object>} waypoints - The model's waypoints now
   * @returns {boolean} Whether a draw ended because its waypoint has gone
   */
  followModel(waypoints) {
    if (!this.isDrawing || !this.targetWaypoint) return false;
    if (waypoints.includes(this.targetWaypoint)) return false;
    const same = waypoints.find(waypoint => waypoint.id === this.targetWaypoint.id);
    if (same) {
      this.targetWaypoint = same;
      return false;
    }
    this.cancelDrawing();
    return true;
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
    
    // Remove banner. Focus in it (its Cancel pressed) would go with it.
    const heldFocus = this._modeBanner?.holdsFocus(this._bannerOwner) ?? false;
    this._hideBanner();
    
    // Remove ESC listener
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }
    
    // Notify InteractionHandler
    this.eventBus.emit('area:draw-mode-changed', { active: false });
    // Back to Draw area, which opened the draw and kept focus through it, by
    // Done's rule (its card's header when the card is collapsed); else the
    // Route button (UI-06 PR 6, item 5).
    if (heldFocus) {
      const opener = document.getElementById('area-draw-btn');
      returnFocus(opener && visibleFocusTarget(opener));
    }
  }
  
  /**
   * Show the draw-mode banner in the page's banner slot, below the header
   * (UI-06 J-12): another mode's banner there ends that mode first.
   * @private
   */
  _showBanner() {
    this._modeBanner = pageModeBanner();
    const shown = this._modeBanner?.show(this._bannerOwner, {
      id: 'area-draw-banner',
      title: 'Drawing an area',
      text: [' — Click to place corners. Click near the first point to close. ', { kbd: 'Esc' }, ' to cancel.'],
      count: '0 corners',
      // Its visible word is its name (UI-06 F9/B-04, as Done's).
      actions: [{ label: 'Cancel', className: 'banner-cancel', onClick: () => this.cancelDrawing() }],
    });
    this._banner = shown?.root ?? null;
  }
  
  /**
   * Update vertex count display in banner, and say it: the banner was the
   * only voice of each corner's count (UI-06 PR 6, item 6).
   * @private
   */
  _updateBannerCount() {
    if (!this._banner) return;
    const n = this.vertices.length;
    const remaining = Math.max(0, AREA_HIGHLIGHT.DRAW_MIN_VERTICES - n);
    // The outline's words: an area and its corners (UI-06 low items, one word per concept)
    const corners = `${n} ${n === 1 ? 'corner' : 'corners'}`;
    const line = remaining > 0
      ? `${corners} (${remaining} more needed to close)`
      : `${corners} (click near first to close)`;
    this._modeBanner?.update(this._bannerOwner, { count: line });
    this.eventBus.emit('ui:announce', { message: line });
  }
  
  /**
   * Hide and remove the draw-mode banner
   * @private
   */
  _hideBanner() {
    this._modeBanner?.hide(this._bannerOwner);
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
    
    // The preview's own blue, set before its first stroke. The solid edges
    // used to be stroked first, with whatever stroke the layer had last (a
    // marker's outline, the route's colour and width), while the rest of the
    // preview drew in this blue (DEF-47).
    ctx.strokeStyle = '#0f62fe';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.setLineDash([]);
    
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
