/**
 * UndoService - Manages undo/redo history for application state
 * 
 * ## Design
 * - Stores up to MAX_HISTORY (150) snapshots of application state
 * - Uses JSON serialization for deep cloning
 * - Emits events for UI updates (button enable/disable)
 * 
 * ## Usage
 * - Call `saveState(state)` after each user action that should be undoable
 * - Call `undo()` / `redo()` to navigate history
 * - Listen to 'undo:state-change' event for history availability updates
 * 
 * ## Performance
 * - State snapshots are JSON strings (efficient storage, fast comparison)
 * - O(1) undo/redo operations
 * - Automatic pruning when history exceeds MAX_HISTORY
 */

const MAX_HISTORY = 150;

export class UndoService {
  /**
   * @param {Object} eventBus - Event bus for emitting state change events
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    
    /** @type {string[]} Stack of serialized state snapshots */
    this._undoStack = [];
    
    /** @type {string[]} Stack of states for redo */
    this._redoStack = [];
    
    /** @type {string|null} Last saved state to detect duplicates */
    this._lastState = null;
  }
  
  /**
   * Save current state to undo history.
   * Call this after each undoable user action.
   * 
   * @param {Object} state - Application state to save (will be JSON serialized)
   */
  saveState(state) {
    const serialized = JSON.stringify(state);
    
    // Skip if state hasn't changed
    if (serialized === this._lastState) {
      return;
    }
    
    // Push to undo stack
    this._undoStack.push(serialized);
    
    // Clear redo stack (new action invalidates redo history)
    this._redoStack = [];
    
    // Prune if exceeds max history
    if (this._undoStack.length > MAX_HISTORY) {
      this._undoStack.shift();
    }
    
    this._lastState = serialized;
    this._emitStateChange();
  }
  
  /**
   * Undo the last action.
   * @returns {Object|null} Previous state to restore, or null if nothing to undo
   */
  undo() {
    if (this._undoStack.length <= 1) {
      // Need at least 2 states: current + previous
      return null;
    }
    
    // Pop current state and move to redo stack
    const currentState = this._undoStack.pop();
    this._redoStack.push(currentState);
    
    // Get previous state (don't pop, it's now current)
    const previousState = this._undoStack[this._undoStack.length - 1];
    this._lastState = previousState;
    
    this._emitStateChange();
    return JSON.parse(previousState);
  }
  
  /**
   * Redo the last undone action.
   * @returns {Object|null} Next state to restore, or null if nothing to redo
   */
  redo() {
    if (this._redoStack.length === 0) {
      return null;
    }
    
    // Pop from redo stack and push to undo stack
    const nextState = this._redoStack.pop();
    this._undoStack.push(nextState);
    this._lastState = nextState;
    
    this._emitStateChange();
    return JSON.parse(nextState);
  }
  
  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this._undoStack.length > 1;
  }
  
  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this._redoStack.length > 0;
  }
  
  /**
   * Clear all history (e.g., when loading a new project)
   */
  clear() {
    this._undoStack = [];
    this._redoStack = [];
    this._lastState = null;
    this._emitStateChange();
  }
  
  /**
   * Emit event with current undo/redo availability
   * @private
   */
  _emitStateChange() {
    this.eventBus?.emit('undo:state-change', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this._undoStack.length - 1,
      redoCount: this._redoStack.length
    });
  }
}
