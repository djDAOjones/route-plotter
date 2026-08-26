/**
 * InteractionHandler - Manages mouse, keyboard, and touch interactions
 * 
 * Handles all user input on the canvas including:
 * - Mouse: click, drag, context menu
 * - Touch: tap, drag (mobile support)
 * - Keyboard: shortcuts for playback, waypoint manipulation, zoom
 * - Drag & drop: image file uploads
 * 
 * ## Architecture
 * Uses event-driven communication via EventBus. All handlers emit events
 * rather than directly manipulating state, maintaining loose coupling.
 * 
 * ## Efficiency
 * - Methods bound once in constructor (no re-binding per event)
 * - Early returns for non-applicable events
 * - Drag state tracked to distinguish clicks from drags
 * 
 * ## Keyboard Shortcuts
 * | Key | Action |
 * |-----|--------|
 * | Space | Play/pause |
 * | J/K/L | Video-style playback (reverse/pause/forward with speed doubling) |
 * | , / . | Skip to start/end (comma/period, no shift needed) |
 * | Arrows | Nudge waypoint (zoom-proportional, Shift for larger) |
 * | +/- | Zoom in/out |
 * | Del | Delete selected waypoint |
 * | Tab | Select next/prev waypoint |
 * | T | Toggle waypoint type |
 * | Ctrl+Z | Undo (Shift for redo) |
 * | ? | Help |
 */

import { INTERACTION } from '../config/constants.js';
import { getKeybindings, matchesMouseBinding, isMac } from '../config/keybindings.js';

export class InteractionHandler {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas element to attach listeners to
   * @param {EventBus} eventBus - Event bus for emitting interaction events
   */
  constructor(canvas, eventBus) {
    this.canvas = canvas;
    this.eventBus = eventBus;
    this.enabled = true;
    
    // Drag state
    this.isDragging = false;
    this.hasDragged = false;
    this.dragOffset = { x: 0, y: 0 };
    this.selectedWaypoint = null;
    
    /** @type {number} Current zoom level for proportional nudge */
    this.zoomLevel = 1;
    
    /** @type {boolean} Whether area polygon draw mode is active */
    this.isDrawingArea = false;
    
    /** @type {boolean} Whether an area edit drag is in progress */
    this.isEditingArea = false;

    /** @type {boolean} Whether an area edit drag just completed (suppresses click) */
    this._areaEditJustEnded = false;

    /** @type {boolean} Whether network edit mode is active (Phase 4) */
    this.isEditingNetwork = false;

    /** @type {{x: number, y: number}|null} Mousedown position during network mode */
    this._netMouseDown = null;

    /** @type {boolean} Whether the current network press became a drag */
    this._netDragStarted = false;

    /** @type {string|null} What the pointer is idle-hovering ('waypoint'|'area-handle'|'leg'|'leg-plus') */
    this._hoverKind = null;

    /** @type {number|null} Pending rAF id for throttled hover hit-testing */
    this._hoverRaf = null;

    /** @type {{x: number, y: number}|null} Latest pointer position for the pending hover test */
    this._hoverPos = null;

    /** @type {{alt: boolean, shift: boolean, meta: boolean}} Last known modifier state */
    this._modifiers = { alt: false, shift: false, meta: false };

    // Listen for draw-mode state changes
    this.eventBus.on('area:draw-mode-changed', ({ active }) => {
      this.isDrawingArea = active;
      if (active) {
        this._clearHover();
        this.canvas.style.cursor = 'crosshair';
      } else {
        this.canvas.style.cursor = '';
      }
    });

    // Network edit mode intercepts the canvas the same way (Phase 4)
    this.eventBus.on('network:edit-mode-changed', ({ active }) => {
      this.isEditingNetwork = active;
      this._netMouseDown = null;
      this._netDragStarted = false;
      this._clearHover();
      this.canvas.style.cursor = active ? 'crosshair' : '';
    });
    
    // Bind methods
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleDragOver = this.handleDragOver.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
    
    this.setupEventListeners();
  }
  
  /**
   * Set up all interaction event listeners
   */
  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('click', this.handleCanvasClick);
    this.canvas.addEventListener('mouseleave', () => this._clearHover());
    
    // Touch events (for mobile support)
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    
    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Modifier key tracking for cursor feedback
    document.addEventListener('keydown', this._updateCursorForModifiers.bind(this));
    document.addEventListener('keyup', this._updateCursorForModifiers.bind(this));
    // Reset cursor when window loses focus (user may release key while away)
    window.addEventListener('blur', () => {
      this._modifiers = { alt: false, shift: false, meta: false };
      this._refreshCursor();
    });
    
    // Drag and drop for images
    this.canvas.addEventListener('dragover', this.handleDragOver);
    this.canvas.addEventListener('drop', this.handleDrop);
    
    // Context menu (right-click)
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.handleContextMenu(e);
    });
    
    // Mouse wheel for zoom
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
  }
  
  /**
   * Handle mouse wheel for zoom
   * Scroll up = zoom in, scroll down = zoom out
   * @param {WheelEvent} event
   */
  handleWheel(event) {
    event.preventDefault();
    
    // Determine zoom direction from wheel delta
    // deltaY < 0 = scroll up = zoom in
    // deltaY > 0 = scroll down = zoom out
    if (event.deltaY < 0) {
      this.eventBus.emit('canvas:zoom-in');
    } else if (event.deltaY > 0) {
      this.eventBus.emit('canvas:zoom-out');
    }
  }
  
  /**
   * Handle mouse down - initiates waypoint drag if clicking on one.
   * @param {MouseEvent} event
   */
  handleMouseDown(event) {
    // Block drag initiation during area draw mode
    if (this.isDrawingArea) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Network edit mode: record the press; mousemove promotes it to a
    // drag past the threshold, click handles it otherwise
    if (this.isEditingNetwork) {
      this._netMouseDown = { x, y };
      this._netDragStarted = false;
      return;
    }
    
    // Check if clicking on an area highlight handle (before waypoint check)
    this.eventBus.emit('area:check-handle', { screenX: x, screenY: y }, (hit) => {
      if (hit) {
        this.isEditingArea = true;
        this._clearHover();
        this.canvas.classList.add('dragging');
        // Convert screen coords to image coords for the edit service
        this.eventBus.emit('coordinate:canvas-to-image', { canvasX: x, canvasY: y }, (imgPos) => {
          this.eventBus.emit('area:edit-start', {
            waypoint: hit.waypoint,
            imgX: imgPos.x,
            imgY: imgPos.y,
            imageToCanvas: hit.imageToCanvas
          });
        });
        return;
      }
      
      // Check if clicking on a waypoint
      this.eventBus.emit('waypoint:check-at-position', { x, y }, (waypoint) => {
        if (waypoint) {
          // Cmd/Ctrl+click toggles multi-selection membership on click —
          // selecting (or dragging) here on mousedown would collapse the
          // multi-selection before the toggle ever fires
          if (isMac ? event.metaKey : event.ctrlKey) return;

          this.selectedWaypoint = waypoint;
          this.isDragging = true;
          this.hasDragged = false;
          this._clearHover();

          // Calculate drag offset
          this.eventBus.emit('coordinate:image-to-canvas', 
            { imgX: waypoint.imgX, imgY: waypoint.imgY }, 
            (canvasPos) => {
              this.dragOffset.x = x - canvasPos.x;
              this.dragOffset.y = y - canvasPos.y;
            }
          );
          
          // Add dragging class to canvas
          this.canvas.classList.add('dragging');
          
          // Select the waypoint
          this.eventBus.emit('waypoint:selected', waypoint);
        }
      });
    });
  }
  
  /**
   * Handle mouse move - updates waypoint position during drag.
   * Emits 'waypoint:position-changed' with isDragging=true.
   * @param {MouseEvent} event
   */
  handleMouseMove(event) {
    // During area edit drag, send position updates
    if (this.isEditingArea) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.eventBus.emit('coordinate:canvas-to-image', { canvasX: x, canvasY: y }, (imgPos) => {
        this.eventBus.emit('area:edit-move', { imgX: imgPos.x, imgY: imgPos.y });
      });
      return;
    }
    
    // During area draw mode, send cursor position for preview line
    if (this.isDrawingArea) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.eventBus.emit('coordinate:canvas-to-image', { canvasX: x, canvasY: y }, (imgPos) => {
        this.eventBus.emit('area:draw-move', { imgX: imgPos.x, imgY: imgPos.y });
      });
      return;
    }

    // Network edit mode: button held = drag pipeline (past the same
    // threshold rule as everything else), idle = hover pipeline
    if (this.isEditingNetwork) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const shiftKey = !!event.shiftKey;
      if (this._netMouseDown) {
        if (!this._netDragStarted) {
          const moved = Math.hypot(x - this._netMouseDown.x, y - this._netMouseDown.y);
          if (moved > INTERACTION.DRAG_THRESHOLD) {
            this._netDragStarted = true;
            this.eventBus.emit('network:drag-start', {
              x: this._netMouseDown.x, y: this._netMouseDown.y, shiftKey
            });
          }
        }
        if (this._netDragStarted) {
          this.eventBus.emit('network:drag-move', { x, y, shiftKey });
        }
      } else {
        this._queueHoverTest(x, y);
      }
      return;
    }

    // Idle move (no drag in progress): hover affordance hit-testing
    if (!this.isDragging) {
      const rect = this.canvas.getBoundingClientRect();
      this._modifiers = {
        alt: !!event.altKey,
        shift: !!event.shiftKey,
        meta: isMac ? !!event.metaKey : !!event.ctrlKey
      };
      this._queueHoverTest(event.clientX - rect.left, event.clientY - rect.top);
      return;
    }

    if (this.isDragging && this.selectedWaypoint) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Track that we actually moved
      this.hasDragged = true;
      
      // Calculate new position accounting for offset
      const newX = x - this.dragOffset.x;
      const newY = y - this.dragOffset.y;
      
      // Convert to image coordinates
      const shiftKey = event.shiftKey;
      this.eventBus.emit('coordinate:canvas-to-image',
        { canvasX: newX, canvasY: newY },
        (imgPos) => {
          // Emit position change event
          this.eventBus.emit('waypoint:position-changed', {
            waypoint: this.selectedWaypoint,
            imgX: imgPos.x,
            imgY: imgPos.y,
            isDragging: true,
            shiftKey // For 15° angle snapping
          });
        }
      );
    }
  }
  
  /**
   * Handle mouse up - ends drag operation and saves position.
   * @param {MouseEvent} event
   */
  handleMouseUp(event) {
    // End a network drag; a plain press falls through to the click event
    if (this.isEditingNetwork) {
      if (this._netDragStarted) {
        this.eventBus.emit('network:drag-end');
      }
      this._netMouseDown = null;
      return;
    }

    // End area edit drag
    if (this.isEditingArea) {
      this.isEditingArea = false;
      this._areaEditJustEnded = true; // Suppress the subsequent click event
      this.canvas.classList.remove('dragging');
      this.eventBus.emit('area:edit-end');
      return;
    }
    
    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.classList.remove('dragging');
      
      // If we actually dragged, save the position
      if (this.hasDragged) {
        this.eventBus.emit('waypoint:drag-ended', this.selectedWaypoint);
      }
      
      this.selectedWaypoint = null;
      this.hasDragged = false;
    }
  }
  
  /**
   * Handle canvas click event
   * 
   * Mouse bindings (configurable via keybindings.js):
   * - Click on waypoint: select it
   * - Shift+click: delete waypoint
   * - Cmd/Ctrl+click: add minor waypoint
   * - Alt+click: force add major (bypass selection)
   * - Alt+Cmd/Ctrl+click: force add minor (bypass selection)
   * - Click on empty space: add major waypoint
   */
  handleCanvasClick(event) {
    // Suppress click after area edit drag (mouseUp fires before click)
    if (this._areaEditJustEnded) {
      this._areaEditJustEnded = false;
      return;
    }
    
    // Intercept clicks during network edit mode (a completed drag
    // suppresses its trailing click, same rule as waypoint drags)
    if (this.isEditingNetwork) {
      if (this._netDragStarted) {
        this._netDragStarted = false;
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      this.eventBus.emit('network:click', {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        shiftKey: !!event.shiftKey
      });
      return;
    }

    // Intercept clicks during area polygon draw mode
    if (this.isDrawingArea) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.eventBus.emit('coordinate:canvas-to-image', { canvasX: x, canvasY: y }, (imgPos) => {
        this.eventBus.emit('area:draw-click', { imgX: imgPos.x, imgY: imgPos.y });
      });
      return;
    }
    
    // Don't add waypoint if we actually dragged
    if (this.hasDragged) {
      this.hasDragged = false;
      return;
    }
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Get modifier states
    const bindings = getKeybindings().mouse;
    const isShiftClick = event.shiftKey;
    const isAltClick = event.altKey;
    const isMetaClick = isMac ? event.metaKey : event.ctrlKey; // Cmd on Mac, Ctrl on Windows
    
    // Priority order: Alt > Shift > Meta > plain click
    
    // Alt+Cmd/Ctrl+click: force add minor waypoint (bypass selection)
    if (isAltClick && isMetaClick) {
      this._addWaypointAtPosition(x, y, false, isShiftClick); // Minor
      return;
    }
    
    // Alt+click: force add major waypoint (bypass selection)
    if (isAltClick && !isShiftClick && !isMetaClick) {
      this._addWaypointAtPosition(x, y, true, false); // Major
      return;
    }
    
    // Check if clicking on existing waypoint
    this.eventBus.emit('waypoint:check-at-position', { x, y }, (waypoint) => {
      if (waypoint) {
        // Shift+click on waypoint: delete it. Stays instant by decision
        // 2026-08-18 — the toast advertises undo instead of a confirm
        if (isShiftClick) {
          const label = waypoint.name || 'waypoint';
          this.eventBus.emit('waypoint:delete', waypoint);
          this.eventBus.emit('ui:toast', {
            message: `Deleted ${label} — press ${isMac ? 'Cmd' : 'Ctrl'}+Z to undo`
          });
        } else if (isMetaClick) {
          // Cmd/Ctrl+click on a waypoint: toggle it in or out of the
          // multi-selection (on empty canvas the same modifier still
          // adds a minor — the waypoint hit wins here)
          this.eventBus.emit('waypoint:toggle-select', waypoint);
        } else {
          // Select existing waypoint
          this.eventBus.emit('waypoint:selected', waypoint);
        }
        return;
      }

      // Falls through to add-waypoint when nothing interactive is hit
      const addWaypointAt = () => {
        // Check if click is within image bounds before adding waypoint
        this.eventBus.emit('coordinate:check-bounds',
          { canvasX: x, canvasY: y },
          (isWithinBounds) => {
            if (!isWithinBounds) {
              return;
            }

            // Determine waypoint type:
            // - Cmd/Ctrl+click = minor waypoint
            // - Plain click = major waypoint
            const isMajor = !isMetaClick;

            // Convert to image coordinates
            this.eventBus.emit('coordinate:canvas-to-image',
              { canvasX: x, canvasY: y },
              (imgPos) => {
                this.eventBus.emit('waypoint:add', {
                  imgX: imgPos.x,
                  imgY: imgPos.y,
                  isMajor: isMajor,
                  shiftKey: isShiftClick // For 15° angle snapping
                });
              }
            );
          }
        );
      };

      // Plain click on a route leg: the "+" midpoint handle inserts a
      // minor on that leg; anywhere else on the leg selects the owning
      // waypoint (and the inspector flashes its Leg card). Modifier
      // clicks keep their add/delete semantics even over the path.
      if (isShiftClick || isAltClick || isMetaClick) {
        addWaypointAt();
        return;
      }
      this.eventBus.emit('segment:check-at-position', { x, y }, (segmentHit) => {
        if (!segmentHit) {
          addWaypointAt();
          return;
        }
        if (segmentHit.onPlus) {
          this.eventBus.emit('waypoint:insert-on-leg', {
            waypointIndex: segmentHit.waypointIndex,
            imgX: segmentHit.midImg.x,
            imgY: segmentHit.midImg.y
          });
        } else {
          this.eventBus.emit('segment:clicked', { waypoint: segmentHit.waypoint });
        }
      });
    });
  }
  
  /**
   * Add waypoint at screen position (helper for click handlers)
   * Checks bounds and converts coordinates before emitting add event.
   * 
   * @param {number} x - Screen X coordinate
   * @param {number} y - Screen Y coordinate
   * @param {boolean} isMajor - Whether to create a major waypoint
   * @private
   */
  _addWaypointAtPosition(x, y, isMajor, shiftKey = false) {
    this.eventBus.emit('coordinate:check-bounds',
      { canvasX: x, canvasY: y },
      (isWithinBounds) => {
        if (!isWithinBounds) return;
        
        this.eventBus.emit('coordinate:canvas-to-image',
          { canvasX: x, canvasY: y },
          (imgPos) => {
            this.eventBus.emit('waypoint:add', {
              imgX: imgPos.x,
              imgY: imgPos.y,
              isMajor: isMajor,
              shiftKey // For 15° angle snapping
            });
          }
        );
      }
    );
  }
  
  /**
   * Queue an idle-hover hit-test for the next animation frame.
   * Throttles mousemove (fires at input rate) to at most one bus
   * round-trip per frame; the answering side updates the app's hover
   * state and re-renders, the callback here drives the cursor.
   *
   * @param {number} x - X relative to canvas (CSS pixels)
   * @param {number} y - Y relative to canvas (CSS pixels)
   * @private
   */
  _queueHoverTest(x, y) {
    this._hoverPos = { x, y };
    if (this._hoverRaf !== null) return;
    this._hoverRaf = requestAnimationFrame(() => {
      this._hoverRaf = null;
      if (!this._hoverPos || this.isDragging || this.isEditingArea || this.isDrawingArea) return;
      // Network mode answers its own hover cascade; both drive the cursor
      const hoverEvent = this.isEditingNetwork ? 'network:hover-move' : 'canvas:hover-move';
      this.eventBus.emit(hoverEvent, this._hoverPos, (kind) => {
        this._hoverKind = kind || null;
        this._refreshCursor();
      });
    });
  }

  /**
   * Clear hover state (pointer left the canvas, or a drag/mode change
   * made hover affordances irrelevant).
   * @private
   */
  _clearHover() {
    this._hoverPos = null;
    if (this._hoverKind !== null) {
      this._hoverKind = null;
      this._refreshCursor();
    }
    this.eventBus.emit('canvas:hover-clear');
    if (this.isEditingNetwork) this.eventBus.emit('network:hover-clear');
  }

  /**
   * Update canvas cursor based on currently held modifier keys.
   * Provides visual feedback for modifier-based actions:
   * - Alt+Cmd/Ctrl: cell cursor (force add minor waypoint)
   * - Alt: copy cursor (force add major waypoint)
   * - Cmd/Ctrl: cell cursor (add minor waypoint)
   * - Shift: not-allowed cursor (delete mode)
   *
   * @param {KeyboardEvent} event
   * @private
   */
  _updateCursorForModifiers(event) {
    // Only care about modifier keys
    const isModifierKey = ['Alt', 'Control', 'Meta', 'Shift'].includes(event.key);
    if (!isModifierKey) return;

    this._modifiers = {
      alt: event.altKey,
      shift: event.shiftKey,
      meta: isMac ? event.metaKey : event.ctrlKey
    };
    this._refreshCursor();
  }

  /**
   * Resolve the canvas cursor from modifier and hover state.
   * Modifier gestures outrank hover (they change what a click does);
   * hovering an interactive target shows pointer; crosshair otherwise.
   * Area draw mode owns the cursor entirely (crosshair pen).
   * @private
   */
  _refreshCursor() {
    if (this.isDrawingArea) {
      this._setCursor('crosshair');
      return;
    }

    // Network mode: the pen is the tool — pointer over its targets,
    // crosshair otherwise; modifier cursors don't apply
    if (this.isEditingNetwork) {
      this._setCursor(this._hoverKind ? 'pointer' : 'crosshair');
      return;
    }

    const { alt, shift, meta } = this._modifiers;
    // Priority: Alt+Meta > Alt > Shift > Meta > hover > default
    if (alt && meta) {
      this._setCursor('cell'); // Force add minor mode
    } else if (alt) {
      this._setCursor('copy'); // Force add major mode
    } else if (shift) {
      this._setCursor('not-allowed'); // Delete mode
    } else if (meta) {
      this._setCursor('cell'); // Minor waypoint mode
    } else if (this._hoverKind) {
      this._setCursor('pointer'); // Waypoint, area handle, leg, or leg "+"
    } else {
      this._setCursor('crosshair'); // Default
    }
  }
  
  /**
   * Set canvas cursor style
   * 
   * @param {string} cursor - CSS cursor value
   * @private
   */
  _setCursor(cursor) {
    if (this.canvas.style.cursor !== cursor) {
      this.canvas.style.cursor = cursor;
    }
  }
  
  /**
   * Handle keyboard events
   * 
   * Controls:
   * - Space: Play/pause
   * - < / >: Skip to start/end of timeline
   * - J/K/L: Video editor style playback (reverse/pause/forward with speed doubling)
   * - Arrow keys: Nudge selected waypoint by 0.5% of canvas dimension
   * - Shift+Arrow: Nudge by 2% (larger movement)
   * - +/-: Zoom in/out
   * - Del/Backspace: Delete selected waypoint
   */
  handleKeyDown(event) {
    if (this.enabled === false) return;
    // Native controls and custom widgets own their keyboard interaction.
    // In particular, plain Tab must always remain a browser focus command.
    if (event.defaultPrevented) return;
    const target = event.target;
    const tag = target?.tagName;
    const isInteractive = target?.closest?.(
      'button, a[href], summary, [role="button"], [role="menuitem"], [role="option"]'
    );
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable || isInteractive) {
      return;
    }
    
    const key = event.key.toLowerCase();
    const shift = event.shiftKey;
    const ctrl = event.ctrlKey || event.metaKey;

    // During network edit mode the pen owns waypoint-shaped shortcuts
    // (its own keys — Esc/Delete/T — are handled by the service on the
    // capture phase; playback, zoom and undo stay live)
    if (this.isEditingNetwork &&
        (key === 'a' || (ctrl && key === 'd'))) {
      return;
    }

    // Animation controls
    if (key === ' ') {
      event.preventDefault();
      this.eventBus.emit('ui:animation:toggle');
    }
    
    // Timeline position: , for start, . for end (no shift required)
    else if (key === ',' || key === '<') {
      event.preventDefault();
      this.eventBus.emit('ui:animation:skip-start');
    } else if (key === '.' || key === '>') {
      event.preventDefault();
      this.eventBus.emit('ui:animation:skip-end');
    }
    
    // JKL playback controls (video editor style)
    // J: Reverse playback, double speed with each press (up to -4x)
    // K: Play/pause toggle
    // L: Forward playback, double speed with each press (up to 4x)
    else if (key === 'j') {
      event.preventDefault();
      this.eventBus.emit('animation:jkl-reverse');
    } else if (key === 'k') {
      event.preventDefault();
      this.eventBus.emit('ui:animation:toggle');
    } else if (key === 'l') {
      event.preventDefault();
      this.eventBus.emit('animation:jkl-forward');
    }
    
    // Waypoint nudge (arrow keys)
    // Moves selected waypoint by fraction of canvas dimension
    // Nudge is inversely proportional to zoom: 5x zoom = 0.2x nudge magnitude
    // Normal: 0.5%, Shift: 2% for larger movements (at 1x zoom)
    else if (this.selectedWaypoint && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
      const baseNudge = shift ? 0.02 : 0.005; // 2% or 0.5% of canvas at 1x zoom
      const nudgeFraction = baseNudge / this.zoomLevel; // Finer nudge at higher zoom
      let dx = 0, dy = 0;
      
      switch (key) {
        case 'arrowup':    dy = -nudgeFraction; break;
        case 'arrowdown':  dy = nudgeFraction; break;
        case 'arrowleft':  dx = -nudgeFraction; break;
        case 'arrowright': dx = nudgeFraction; break;
      }
      
      this.eventBus.emit('waypoint:nudge', {
        waypoint: this.selectedWaypoint,
        dxFraction: dx,
        dyFraction: dy
      });
    }
    
    // Delete selected waypoint
    else if ((key === 'delete' || key === 'backspace') && this.selectedWaypoint) {
      event.preventDefault();
      this.eventBus.emit('waypoint:delete-selected');
    }
    
    // Toggle waypoint type
    else if (key === 't' && this.selectedWaypoint) {
      event.preventDefault();
      this.eventBus.emit('waypoint:toggle-type', this.selectedWaypoint);
    }
    
    // Undo/Redo (Ctrl+Z, Ctrl+Shift+Z)
    else if (ctrl && key === 'z') {
      event.preventDefault();
      if (shift) {
        this.eventBus.emit('history:redo');
      } else {
        this.eventBus.emit('history:undo');
      }
    }
    
    // Save (Ctrl+S)
    else if (ctrl && key === 's') {
      event.preventDefault();
      this.eventBus.emit('file:save');
    }
    
    // Help (? key only - H is too common)
    else if (key === '?') {
      event.preventDefault();
      this.eventBus.emit('help:show-shortcuts');
    }
    
    // Add waypoint at canvas center
    else if (key === 'a' && !ctrl) {
      event.preventDefault();
      this.eventBus.emit('waypoint:add-at-center');
    }
    
    // Home/End: jump to start/end of timeline
    else if (key === 'home') {
      event.preventDefault();
      this.eventBus.emit('ui:animation:skip-start');
    } else if (key === 'end') {
      event.preventDefault();
      this.eventBus.emit('ui:animation:skip-end');
    }
    
    // Escape: deselect waypoint
    else if (key === 'escape') {
      event.preventDefault();
      this.eventBus.emit('waypoint:deselect');
    }
    
    // Duplicate waypoint (Cmd/Ctrl+D)
    else if (ctrl && key === 'd') {
      event.preventDefault();
      this.eventBus.emit('waypoint:duplicate');
    }
    
    // Select all waypoints (Cmd/Ctrl+A)
    else if (ctrl && key === 'a') {
      event.preventDefault();
      this.eventBus.emit('waypoint:select-all');
    }
    
    // Zoom controls (+ and - keys)
    // Zoom centers on selected waypoint; prompts user if none selected
    else if (key === '=' || key === '+') {
      event.preventDefault();
      this.eventBus.emit('canvas:zoom-in');
    } else if (key === '-' || key === '_') {
      event.preventDefault();
      this.eventBus.emit('canvas:zoom-out');
    } else if (key === '0' && !ctrl) {
      // Reset zoom to 1x
      event.preventDefault();
      this.eventBus.emit('canvas:zoom-reset');
    }
  }
  
  /**
   * Handle touch start - delegates to mouse handler for unified behavior.
   * @param {TouchEvent} event
   */
  handleTouchStart(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      // Simulate mouse down
      this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    }
  }
  
  /**
   * Handle touch move - delegates to mouse handler during drag.
   * @param {TouchEvent} event
   */
  handleTouchMove(event) {
    if (event.touches.length === 1 && this.isDragging) {
      event.preventDefault();
      const touch = event.touches[0];
      
      // Simulate mouse move
      this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
  }
  
  /**
   * Handle touch end - completes drag or triggers click.
   * @param {TouchEvent} event
   */
  handleTouchEnd(event) {
    if (event.changedTouches.length === 1) {
      const touch = event.changedTouches[0];
      
      // Simulate mouse up
      this.handleMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
      
      // If no drag occurred, treat as click
      if (!this.hasDragged) {
        this.handleCanvasClick({ 
          clientX: touch.clientX, 
          clientY: touch.clientY,
          shiftKey: false 
        });
      }
    }
  }
  
  /**
   * Handle drag over - enables drop zone visual feedback.
   * @param {DragEvent} event
   */
  handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.canvas.classList.add('drag-over');
  }
  
  /**
   * Handle drop - processes dropped image files.
   * @param {DragEvent} event
   */
  handleDrop(event) {
    event.preventDefault();
    this.canvas.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        this.eventBus.emit('background:upload', file);
      }
    }
  }
  
  /**
   * Handle context menu - shows waypoint or canvas context menu.
   * @param {MouseEvent} event
   */
  handleContextMenu(event) {
    // The network pen owns the canvas; no context menu during the mode
    if (this.isEditingNetwork) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if right-clicking on a waypoint
    this.eventBus.emit('waypoint:check-at-position', { x, y }, (waypoint) => {
      if (waypoint) {
        // Show waypoint context menu
        this.eventBus.emit('waypoint:show-context-menu', {
          waypoint: waypoint,
          x: event.clientX,
          y: event.clientY
        });
      } else {
        // Show canvas context menu
        this.eventBus.emit('canvas:show-context-menu', {
          x: event.clientX,
          y: event.clientY,
          canvasX: x,
          canvasY: y
        });
      }
    });
  }
  
  /**
   * Set selected waypoint from external source (e.g., sidebar selection).
   * @param {Object|null} waypoint - Waypoint object or null to deselect
   */
  setSelectedWaypoint(waypoint) {
    this.selectedWaypoint = waypoint;
  }

  /** Enable or suspend document-level application shortcuts. */
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }
  
  /**
   * Set current zoom level for proportional nudge calculation.
   * Higher zoom = finer nudge (inversely proportional).
   * @param {number} zoom - Current zoom level (1 = no zoom)
   */
  setZoomLevel(zoom) {
    this.zoomLevel = zoom;
  }
  
  /**
   * Clean up all event listeners. Call when removing handler.
   */
  destroy() {
    if (this._hoverRaf !== null) {
      cancelAnimationFrame(this._hoverRaf);
      this._hoverRaf = null;
    }
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('click', this.handleCanvasClick);
    document.removeEventListener('keydown', this.handleKeyDown);
    this.canvas.removeEventListener('dragover', this.handleDragOver);
    this.canvas.removeEventListener('drop', this.handleDrop);
  }
}
