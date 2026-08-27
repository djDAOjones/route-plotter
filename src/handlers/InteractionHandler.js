/**
 * InteractionHandler - Manages pointer, keyboard, wheel and drop interactions
 * 
 * Handles all user input on the canvas including:
 * - Pointer Events: mouse, touch and pen tap/drag/cancel
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
 * | Tab | Native browser focus navigation |
 * | T | Toggle waypoint type |
 * | Ctrl+Z | Undo (Shift for redo) |
 * | ? | Help |
 */

import { INTERACTION } from '../config/constants.js';
import { isMac } from '../config/keybindings.js';

export class InteractionHandler {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas element to attach listeners to
   * @param {EventBus} eventBus - Event bus for emitting interaction events
   */
  constructor(canvas, eventBus) {
    this.canvas = canvas;
    this.eventBus = eventBus;
    this.enabled = true;
    
    // Selection state is synchronized by the application. Active gesture state
    // lives separately so releasing a drag never clears keyboard selection.
    this.isDragging = false;
    this.selectedWaypoint = null;
    this.selectedWaypoints = [];
    /** @type {Object|null} Fork waypoint while a branch gesture is armed (ROUTE-01c) */
    this.branchArmed = null;

    /** @type {Object|null} The one captured primary-pointer transaction. */
    this.activePointer = null;
    
    /** @type {number} Current zoom level for proportional nudge */
    this.zoomLevel = 1;
    
    /** @type {boolean} Whether area polygon draw mode is active */
    this.isDrawingArea = false;
    
    /** @type {boolean} Whether an area edit drag is in progress */
    this.isEditingArea = false;

    /** @type {boolean} Whether network edit mode is active (Phase 4) */
    this.isEditingNetwork = false;

    /** @type {string|null} What the pointer is idle-hovering ('waypoint'|'area-handle'|'leg'|'leg-plus') */
    this._hoverKind = null;

    /** @type {number|null} Pending rAF id for throttled hover hit-testing */
    this._hoverRaf = null;

    /** @type {{x: number, y: number}|null} Latest pointer position for the pending hover test */
    this._hoverPos = null;

    /** @type {{alt: boolean, shift: boolean, meta: boolean}} Last known modifier state */
    this._modifiers = { alt: false, shift: false, meta: false };

    /** @type {Function[]} EventBus unsubscribe callbacks. */
    this._unsubscribers = [];

    // Listen for draw-mode state changes
    this._unsubscribers.push(this.eventBus.on('area:draw-mode-changed', ({ active }) => {
      if (this.activePointer) this._cancelActivePointer();
      this.isDrawingArea = active;
      if (active) {
        this._clearHover();
        this.canvas.style.cursor = 'crosshair';
      } else {
        this.canvas.style.cursor = '';
      }
    }));

    // Network edit mode intercepts the canvas the same way (Phase 4)
    this._unsubscribers.push(this.eventBus.on('network:edit-mode-changed', ({ active }) => {
      if (this.activePointer) this._cancelActivePointer();
      this.isEditingNetwork = active;
      this._clearHover();
      this.canvas.style.cursor = active ? 'crosshair' : '';
    }));

    // A rendering-mode or project boundary cannot inherit a half-finished
    // gesture. Failed loads emit neither project event and preserve the edit.
    this._unsubscribers.push(
      this.eventBus.on('motion:preview-mode-change', () => this._cancelActivePointer()),
      this.eventBus.on('project:replaced', () => this._cancelActivePointer({
        restoreGeometry: false,
        restoreSelection: false
      })),
      this.eventBus.on('app:cleared', () => this._cancelActivePointer({
        restoreGeometry: false,
        restoreSelection: false
      }))
    );
    
    // Bind methods
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
    this.handleLostPointerCapture = this.handleLostPointerCapture.bind(this);
    this._handlePointerLeave = this._handlePointerLeave.bind(this);
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this._updateCursorForModifiers = this._updateCursorForModifiers.bind(this);
    this._handleWindowBlur = this._handleWindowBlur.bind(this);
    this.handleDragOver = this.handleDragOver.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this._handleContextMenuEvent = this._handleContextMenuEvent.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    
    this.setupEventListeners();
  }
  
  /**
   * Set up all interaction event listeners
   */
  setupEventListeners() {
    // Pointer Events are the sole canvas mutation owner for mouse, touch and
    // pen. The native click event is intentionally not registered: pointerup
    // resolves either one tap or one drag commit itself.
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('lostpointercapture', this.handleLostPointerCapture);
    this.canvas.addEventListener('pointerleave', this._handlePointerLeave);

    // Capture is the primary outside-canvas path. Window fallbacks also close
    // the transaction when a browser or automation surface releases capture
    // before dispatching the terminal event to the canvas. Events delivered to
    // the canvas bubble here too; activePointer makes that second call a no-op.
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerCancel);
    
    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Modifier key tracking for cursor feedback
    document.addEventListener('keydown', this._updateCursorForModifiers);
    document.addEventListener('keyup', this._updateCursorForModifiers);
    window.addEventListener('blur', this._handleWindowBlur);
    
    // Drag and drop for images
    this.canvas.addEventListener('dragover', this.handleDragOver);
    this.canvas.addEventListener('drop', this.handleDrop);
    
    // Context menu (right-click)
    this.canvas.addEventListener('contextmenu', this._handleContextMenuEvent);
    
    // Mouse wheel for zoom
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  _handleContextMenuEvent(event) {
    event.preventDefault();
    this.handleContextMenu(event);
  }

  _handlePointerLeave() {
    if (!this.activePointer) this._clearHover();
  }

  _handleWindowBlur() {
    this._cancelActivePointer();
    this._modifiers = { alt: false, shift: false, meta: false };
    this._refreshCursor();
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
   * Begin one primary-pointer transaction. Hit-testing happens once at the
   * gesture boundary; model mutation waits until either tap resolution or the
   * common drag threshold is crossed.
   * @param {PointerEvent} event
   */
  handlePointerDown(event) {
    if (!this.enabled || this.activePointer) return;
    if (event.isPrimary === false || event.button !== 0) return;

    const point = this._canvasPoint(event);
    const metaKey = isMac ? !!event.metaKey : !!event.ctrlKey;
    const modifiers = {
      altKey: !!event.altKey,
      shiftKey: !!event.shiftKey,
      ctrlKey: !!event.ctrlKey,
      metaKey: !!event.metaKey,
      meta: metaKey
    };
    const selectionSnapshot = {
      waypoints: [...this.selectedWaypoints],
      primary: this.selectedWaypoint
    };
    const active = {
      pointerId: event.pointerId ?? 1,
      pointerType: event.pointerType || 'mouse',
      phase: 'pressed',
      mode: this.isDrawingArea ? 'area-draw' : (this.isEditingNetwork ? 'network' : 'canvas'),
      down: point,
      last: point,
      modifiers,
      hit: null,
      draggable: false,
      dragGroup: [],
      dragOffset: { x: 0, y: 0 },
      selectionSnapshot,
      captured: false
    };

    if (!this.isDrawingArea && !this.isEditingNetwork) {
      this.eventBus.emit('area:check-handle', {
        screenX: point.x,
        screenY: point.y,
        pointerType: active.pointerType
      }, (hit) => {
        if (hit) {
          active.mode = 'area-edit';
          active.hit = hit;
        }
      });

      if (!active.hit) {
        this.eventBus.emit('waypoint:check-at-position', {
          x: point.x,
          y: point.y,
          pointerType: active.pointerType
        }, (waypoint) => {
          if (!waypoint) return;
          active.mode = 'waypoint';
          active.hit = waypoint;
          active.draggable = !modifiers.altKey && !modifiers.shiftKey && !modifiers.meta;
          const group = this.selectedWaypoints.length > 1 && this.selectedWaypoints.includes(waypoint)
            ? this.selectedWaypoints
            : [waypoint];
          active.dragGroup = group.map(item => ({
            waypoint: item,
            imgX: item.imgX,
            imgY: item.imgY
          }));
          this.eventBus.emit('coordinate:image-to-canvas', {
            imgX: waypoint.imgX,
            imgY: waypoint.imgY
          }, (screenPos) => {
            active.dragOffset.x = point.x - screenPos.x;
            active.dragOffset.y = point.y - screenPos.y;
          });
        });
      }
    }

    this.activePointer = active;
    this._clearHover();
    try {
      this.canvas.setPointerCapture?.(active.pointerId);
      active.captured = this.canvas.hasPointerCapture
        ? this.canvas.hasPointerCapture(active.pointerId)
        : true;
    } catch {
      active.captured = false;
    }
    event.preventDefault?.();
  }
  
  /**
   * Route both idle hover and the captured gesture through one pointer path.
   * @param {PointerEvent} event
   */
  handlePointerMove(event) {
    const active = this.activePointer;
    if (active) {
      if ((event.pointerId ?? 1) !== active.pointerId) return;
      this._processActivePointerMotion(active, event);
      event.preventDefault?.();
      return;
    }

    const point = this._canvasPoint(event);
    if (this.isDrawingArea) {
      this._emitAreaPosition('area:draw-move', point);
      return;
    }
    if (this.isEditingNetwork) {
      this._queueHoverTest(point.x, point.y);
      return;
    }
    this._modifiers = {
      alt: !!event.altKey,
      shift: !!event.shiftKey,
      meta: isMac ? !!event.metaKey : !!event.ctrlKey
    };
    this._queueHoverTest(point.x, point.y);
  }

  _processActivePointerMotion(active, event) {
    const point = this._canvasPoint(event);
    active.last = point;
    active.modifiers = {
      altKey: !!event.altKey,
      shiftKey: !!event.shiftKey,
      ctrlKey: !!event.ctrlKey,
      metaKey: !!event.metaKey,
      meta: isMac ? !!event.metaKey : !!event.ctrlKey
    };

    if (active.mode === 'area-draw') {
      this._emitAreaPosition('area:draw-move', point);
    }

    if (active.phase === 'pressed') {
      const distance = Math.hypot(point.x - active.down.x, point.y - active.down.y);
      if (distance <= INTERACTION.DRAG_THRESHOLD) return;
      if ((active.mode === 'waypoint' && !active.draggable) ||
          active.mode === 'canvas' || active.mode === 'area-draw') {
        active.phase = 'moved';
        return;
      }
      active.phase = 'dragging';
      this.isDragging = active.mode === 'waypoint';
      this.isEditingArea = active.mode === 'area-edit';
      this.canvas.classList.add('dragging');

      if (active.mode === 'waypoint') {
        const movers = active.dragGroup.map(item => item.waypoint);
        if (movers.length > 1) {
          this.eventBus.emit('waypoint:multi-selected', {
            waypoints: movers,
            primary: active.hit
          });
        } else {
          this.eventBus.emit('waypoint:selected', active.hit);
        }
      } else if (active.mode === 'area-edit') {
        this.eventBus.emit('coordinate:canvas-to-image', {
          canvasX: active.down.x,
          canvasY: active.down.y
        }, (imgPos) => {
          this.eventBus.emit('area:edit-start', {
            waypoint: active.hit.waypoint,
            imgX: imgPos.x,
            imgY: imgPos.y,
            imageToScreen: active.hit.imageToScreen
          });
        });
      } else if (active.mode === 'network') {
        this.eventBus.emit('network:drag-start', {
          x: active.down.x,
          y: active.down.y,
          shiftKey: active.modifiers.shiftKey
        });
      }
    }

    if (active.phase !== 'dragging') return;
    if (active.mode === 'waypoint') {
      const newX = point.x - active.dragOffset.x;
      const newY = point.y - active.dragOffset.y;
      this.eventBus.emit('coordinate:canvas-to-image', {
        canvasX: newX,
        canvasY: newY
      }, (imgPos) => {
        this.eventBus.emit('waypoint:position-changed', {
          waypoint: active.hit,
          imgX: imgPos.x,
          imgY: imgPos.y,
          dragGroup: active.dragGroup,
          isDragging: true,
          shiftKey: active.modifiers.shiftKey
        });
      });
    } else if (active.mode === 'area-edit') {
      this._emitAreaPosition('area:edit-move', point);
    } else if (active.mode === 'network') {
      this.eventBus.emit('network:drag-move', {
        x: point.x,
        y: point.y,
        shiftKey: active.modifiers.shiftKey
      });
    }
  }

  _emitAreaPosition(eventName, point) {
    this.eventBus.emit('coordinate:canvas-to-image', {
      canvasX: point.x,
      canvasY: point.y
    }, (imgPos) => {
      this.eventBus.emit(eventName, { imgX: imgPos.x, imgY: imgPos.y });
    });
  }

  _canvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
  
  /** Complete exactly one tap or drag transaction. */
  handlePointerUp(event) {
    const active = this.activePointer;
    if (!active || (event.pointerId ?? 1) !== active.pointerId) return;

    // An up event can be the first delivered point beyond the threshold, but
    // must not replay an already-delivered final move.
    const upPoint = this._canvasPoint(event);
    if (upPoint.x !== active.last.x || upPoint.y !== active.last.y) {
      this._processActivePointerMotion(active, event);
    } else {
      active.modifiers = {
        altKey: !!event.altKey,
        shiftKey: !!event.shiftKey,
        ctrlKey: !!event.ctrlKey,
        metaKey: !!event.metaKey,
        meta: isMac ? !!event.metaKey : !!event.ctrlKey
      };
    }
    this.activePointer = null;
    event.preventDefault?.();

    if (active.phase === 'pressed') {
      if (active.mode !== 'area-edit') {
        this.handleCanvasClick({
          clientX: event.clientX,
          clientY: event.clientY,
          altKey: active.modifiers.altKey,
          shiftKey: active.modifiers.shiftKey,
          ctrlKey: active.modifiers.ctrlKey,
          metaKey: active.modifiers.metaKey
        });
      }
    } else if (active.phase === 'dragging') {
      if (active.mode === 'waypoint') {
        // Carry the drop point so the app can resolve a branch-end drop onto
        // another waypoint as a rejoin rather than an ordinary move (ROUTE-01c).
        this.eventBus.emit('waypoint:drag-ended', {
          waypoint: active.hit,
          dragGroup: active.dragGroup,
          dropX: upPoint.x,
          dropY: upPoint.y
        });
      } else if (active.mode === 'area-edit') {
        this.eventBus.emit('area:edit-end');
      } else if (active.mode === 'network') {
        this.eventBus.emit('network:drag-end');
      }
    }

    this._resetGestureState();
    this._releasePointer(active);
  }

  /** Cancel a browser-aborted gesture and restore its start snapshot. */
  handlePointerCancel(event) {
    if (!this.activePointer || (event.pointerId ?? 1) !== this.activePointer.pointerId) return;
    event.preventDefault?.();
    this._cancelActivePointer();
  }

  /** Unexpected capture loss is cancellation; loss after normal release is a no-op. */
  handleLostPointerCapture(event) {
    if (!this.activePointer || (event.pointerId ?? 1) !== this.activePointer.pointerId) return;
    this._cancelActivePointer({ releaseCapture: false });
  }

  _cancelActivePointer({
    restoreGeometry = true,
    restoreSelection = true,
    releaseCapture = true
  } = {}) {
    const active = this.activePointer;
    if (!active) return;
    this.activePointer = null;

    if (active.phase === 'dragging' && restoreGeometry) {
      if (active.mode === 'waypoint') {
        this.eventBus.emit('waypoint:drag-cancelled', {
          waypoint: active.hit,
          positions: active.dragGroup
        });
      } else if (active.mode === 'area-edit') {
        this.eventBus.emit('area:edit-cancel');
      } else if (active.mode === 'network') {
        this.eventBus.emit('network:drag-cancel');
      }
    }

    if (active.mode === 'waypoint' && active.phase === 'dragging' && restoreSelection) {
      const { waypoints, primary } = active.selectionSnapshot;
      if (waypoints.length > 1 && primary) {
        this.eventBus.emit('waypoint:multi-selected', { waypoints, primary });
      } else if (waypoints.length === 1) {
        this.eventBus.emit('waypoint:selected', waypoints[0]);
      } else {
        this.eventBus.emit('waypoint:deselected');
      }
    }

    this._resetGestureState();
    if (releaseCapture) this._releasePointer(active);
  }

  _resetGestureState() {
    this.isDragging = false;
    this.isEditingArea = false;
    this.canvas.classList.remove('dragging');
    this._refreshCursor();
  }

  _releasePointer(active) {
    if (!active?.captured || !this.canvas.releasePointerCapture) return;
    try {
      if (!this.canvas.hasPointerCapture || this.canvas.hasPointerCapture(active.pointerId)) {
        this.canvas.releasePointerCapture(active.pointerId);
      }
    } catch {
      // Capture may already have been released by the user agent.
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
    // Pointerup calls this only for a gesture that stayed below the threshold.
    if (this.isEditingNetwork) {
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
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Get modifier states
    const isShiftClick = event.shiftKey;
    const isAltClick = event.altKey;
    const isMetaClick = isMac ? event.metaKey : event.ctrlKey; // Cmd on Mac, Ctrl on Windows
    
    // Priority order: Alt > Shift > Meta > plain click
    
    // Alt+Cmd/Ctrl+click: force add minor waypoint (bypass selection)
    if (isAltClick && isMetaClick) {
      this._addWaypointAtPosition(x, y, false, isShiftClick); // Minor
      return;
    }
    
    // Alt+click: branch from a waypoint, or force-add a major on empty canvas.
    // The hit-test decides (ROUTE-01c): force-add exists so a major can be
    // placed without selecting, and on empty canvas that is unchanged. Landing
    // on a waypoint now arms a branch instead — the one case force-add loses,
    // and Alt+Cmd still force-adds a minor there.
    if (isAltClick && !isShiftClick && !isMetaClick) {
      this.eventBus.emit('waypoint:check-at-position', { x, y }, (waypoint) => {
        if (waypoint) {
          this.eventBus.emit('route:branch-arm', { waypoint });
        } else {
          this._addWaypointAtPosition(x, y, true, false); // Major
        }
      });
      return;
    }

    // An armed branch consumes the next plain click as its placement, so the
    // gesture is click-to-choose-a-fork then click-to-place, never a drag.
    if (this.branchArmed && !isShiftClick && !isMetaClick) {
      this.eventBus.emit('coordinate:check-bounds', { canvasX: x, canvasY: y }, (inBounds) => {
        if (!inBounds) {
          this.eventBus.emit('route:branch-cancel');
          return;
        }
        this.eventBus.emit('coordinate:canvas-to-image', { canvasX: x, canvasY: y }, (imgPos) => {
          this.eventBus.emit('route:branch-place', { imgX: imgPos.x, imgY: imgPos.y });
        });
      });
      return;
    }
    
    // The branch handle beside a crowd-entry waypoint arms the same fork
    // gesture Alt+click does, so there is one branch path, not two (COMPOSE-04).
    //
    // Hit-tested directly rather than gated on the hover state: a touch or pen
    // tap never hovers first, so trusting `_hoverKind` here would have left the
    // handle dead on exactly the devices REV-03 unified this transaction for.
    // Hover stays what it should be — the visual affordance, not the gate.
    if (!isShiftClick && !isMetaClick) {
      let armed = false;
      this.eventBus.emit('waypoint:check-branch-handle', { x, y }, (waypoint) => {
        if (!waypoint) return;
        this.eventBus.emit('route:branch-arm', { waypoint });
        armed = true;
      });
      if (armed) return;
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
   * Throttles pointermove (fires at input rate) to at most one bus
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
    
    // Escape: cancel an armed branch first, else deselect the waypoint.
    // An armed gesture is the more recent, more surprising state to be stuck
    // in, so it is the one Escape unwinds.
    else if (key === 'escape') {
      event.preventDefault();
      if (this.branchArmed) {
        this.eventBus.emit('route:branch-cancel');
      } else {
        this.eventBus.emit('waypoint:deselect');
      }
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
  
  /** Synchronize the canonical route selection used by keyboard/group drag. */
  setSelection(waypoints, primary = null) {
    this.selectedWaypoints = Array.isArray(waypoints) ? [...waypoints] : [];
    this.selectedWaypoint = primary || null;
  }

  /** Backward-compatible single-selection adapter. */
  setSelectedWaypoint(waypoint) {
    this.setSelection(waypoint ? [waypoint] : [], waypoint);
  }

  /** Enable or suspend document-level application shortcuts. */
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this._cancelActivePointer();
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
    this._cancelActivePointer();
    if (this._hoverRaf !== null) {
      cancelAnimationFrame(this._hoverRaf);
      this._hoverRaf = null;
    }
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('lostpointercapture', this.handleLostPointerCapture);
    this.canvas.removeEventListener('pointerleave', this._handlePointerLeave);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerCancel);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keydown', this._updateCursorForModifiers);
    document.removeEventListener('keyup', this._updateCursorForModifiers);
    window.removeEventListener('blur', this._handleWindowBlur);
    this.canvas.removeEventListener('dragover', this.handleDragOver);
    this.canvas.removeEventListener('drop', this.handleDrop);
    this.canvas.removeEventListener('contextmenu', this._handleContextMenuEvent);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this._unsubscribers = [];
  }
}
