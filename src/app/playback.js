/**
 * Transport + JKL playback: keyboard dispatch, play/pause/skip, preview mode, render loop, time display sync.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, playbackMixin).
 */
import { ANIMATION } from '../config/constants.js';

// ========== JKL PLAYBACK METHODS ==========
// Video editor style playback controls (like Premiere Pro, Final Cut, etc.)
// State tracked via: _jklDirection (-1=reverse, 0=stopped, 1=forward)
//                    _jklSpeedMultiplier (1, 2, 4, 8, 16)
// These are temporary playback speeds, not saved to settings

/** @constant {number} Maximum JKL speed multiplier (4 doublings from 1x) */
const JKL_MAX_SPEED = 16;

export const playbackMixin = {
  
  /**
   * Global keyboard shortcut handler
   * 
   * ## Shortcuts
   * | Key | Action |
   * |-----|--------|
   * | Cmd/Ctrl+Z | Undo |
   * | Cmd/Ctrl+Shift+Z | Redo |
   * | Ctrl+Y | Redo (Windows) |
   * | Space | Play/Pause toggle |
   * | K | Pause (JKL style) |
   * | L | Play forward, 2x/4x/8x/16x on repeat |
   * | J | Play reverse, 2x/4x/8x/16x on repeat |
   * 
   * @param {KeyboardEvent} e - Keyboard event
   * @private
   */
  _handleKeyDown(e) {
    // Skip if user is typing in an input field
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }
    
    const key = e.key.toLowerCase();
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
    
    // Undo: Cmd+Z (Mac) or Ctrl+Z (Windows/Linux)
    if (cmdOrCtrl && !e.shiftKey && key === 'z') {
      e.preventDefault();
      this.undo();
      return;
    }
    
    // Redo: Cmd+Shift+Z (Mac) or Ctrl+Shift+Z / Ctrl+Y (Windows/Linux)
    if (cmdOrCtrl && ((e.shiftKey && key === 'z') || key === 'y')) {
      e.preventDefault();
      this.redo();
      return;
    }
    
    // JKL video editor style playback controls
    switch (key) {
      case 'k':
        e.preventDefault();
        this._handleJKL_K();
        return;
      case 'l':
        e.preventDefault();
        this._handleJKL_L();
        return;
      case 'j':
        e.preventDefault();
        this._handleJKL_J();
        return;
      case ' ':
        e.preventDefault();
        this.animationEngine.togglePlayPause();
        this._updatePlayPauseUI();
        return;
    }
  },
  
  /**
   * Reset JKL playback state to defaults
   * Called on pause, stop, reset, and complete events
   * Ensures next L/J press starts fresh at 1x speed
   * @private
   */
  _resetJKLState() {
    this._jklSpeedMultiplier = 1;
    this._jklDirection = 0;
  },
  
  /**
   * K key: Pause playback and reset JKL state
   * Resets speed multiplier to 1x for next L/J press
   * @private
   */
  _handleJKL_K() {
    this.animationEngine.pause();
    // Note: _resetJKLState() will be called by animation:pause event handler
    this._updatePlayPauseUI();
  },
  
  /**
   * L key: Play forward with speed doubling
   * - First press: Play at 1x
   * - Subsequent presses: Double speed (2x → 4x → 8x → 16x)
   * - At 16x: No further effect
   * @private
   */
  _handleJKL_L() {
    const isPlaying = this.animationEngine.state.isPlaying && !this.animationEngine.state.isPaused;
    const wasForward = this._jklDirection === 1;
    
    if (!isPlaying || !wasForward) {
      // Start playing forward at 1x
      this._jklSpeedMultiplier = 1;
      this._jklDirection = 1;
      this.animationEngine.setPlaybackSpeed(1);
      this.animationEngine.play();
    } else if (this._jklSpeedMultiplier < JKL_MAX_SPEED) {
      // Double the speed
      this._jklSpeedMultiplier *= 2;
      this.animationEngine.setPlaybackSpeed(this._jklSpeedMultiplier);
    }
    
    this._updatePlayPauseUI();
    console.debug(`▶️ [JKL] Forward ${this._jklSpeedMultiplier}x`);
  },
  
  /**
   * J key: Play reverse with speed doubling
   * - First press: Play reverse at 1x
   * - Subsequent presses: Double speed (-2x → -4x → -8x → -16x)
   * - At -16x: No further effect
   * @private
   */
  _handleJKL_J() {
    const isPlaying = this.animationEngine.state.isPlaying && !this.animationEngine.state.isPaused;
    const wasReverse = this._jklDirection === -1;
    
    if (!isPlaying || !wasReverse) {
      // Start playing reverse at 1x
      this._jklSpeedMultiplier = 1;
      this._jklDirection = -1;
      this.animationEngine.setPlaybackSpeed(-1);
      this.animationEngine.play();
    } else if (this._jklSpeedMultiplier < JKL_MAX_SPEED) {
      // Double the reverse speed
      this._jklSpeedMultiplier *= 2;
      this.animationEngine.setPlaybackSpeed(-this._jklSpeedMultiplier);
    }
    
    this._updatePlayPauseUI();
    console.debug(`◀️ [JKL] Reverse ${this._jklSpeedMultiplier}x`);
  },
  
  /**
   * Update play/pause button visibility based on animation state
   * Called after any playback state change
   * @private
   */
  _updatePlayPauseUI() {
    const isPlaying = this.animationEngine.state.isPlaying && !this.animationEngine.state.isPaused;
    if (this.elements.playBtn) {
      this.elements.playBtn.style.display = isPlaying ? 'none' : '';
    }
    if (this.elements.pauseBtn) {
      this.elements.pauseBtn.style.display = isPlaying ? '' : 'none';
    }
  },
  
  /**
   * Update the mode switch UI to reflect current preview mode state
   * @private
   */
  _updateModeSwitch() {
    if (this.elements.modeToggleBtn) {
      this.elements.modeToggleBtn.setAttribute('aria-checked', this.previewMode);
    }
    if (this.elements.modeLabelEdit) {
      this.elements.modeLabelEdit.classList.toggle('active', !this.previewMode);
    }
    if (this.elements.modeLabelPreview) {
      this.elements.modeLabelPreview.classList.toggle('active', this.previewMode);
    }
  },
  
  /**
   * Set preview mode to a specific value
   * HDR-05: Replaces toggle for segmented control
   * @param {boolean} isPreview - Whether to enable preview mode
   * @private
   */
  _setPreviewMode(isPreview) {
    if (this.previewMode === isPreview) return; // No change
    this.previewMode = isPreview;
    this._updateModeSwitch();
    this.eventBus.emit('motion:preview-mode-change', this.previewMode);
    console.debug(`👁️ [Mode] Switched to ${this.previewMode ? 'Preview' : 'Edit'} mode`);
  },
  
  /**
   * Toggle preview mode and update UI
   * @deprecated Use _setPreviewMode instead
   * @private
   */
  _togglePreviewMode() {
    this._setPreviewMode(!this.previewMode);
  },
  
  /**
   * Show one-time preview tip as a toast (replaces old tip banner)
   * @private
   */
  _showPreviewTipToast() {
    const STORAGE_KEY = 'routePlotter_previewTipDismissed';
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    
    // Show after a brief delay so UI settles first
    setTimeout(() => {
      this.showToast('Tip: Check your sequence in Preview mode before exporting', 8000);
      localStorage.setItem(STORAGE_KEY, 'true');
    }, 1500);
  },
  
  /**
   * Play the animation
   * Delegates to AnimationEngine for state management
   */
  play() {
    if (this.waypoints.length < 2) return;
    
    // If animation is finished (at 100%), reset to beginning
    if (this.animationEngine.state.progress >= 1.0) {
      this.animationEngine.reset();
    }
    
    // Delegate to AnimationEngine
    this.animationEngine.play();
    
    // UI update handled by AnimationEngine event listeners
  },
  
  /**
   * Pause the animation
   * Delegates to AnimationEngine for state management
   */
  pause() {
    // Delegate to AnimationEngine
    this.animationEngine.pause();
    
    // UI update handled by AnimationEngine event listeners
  },
  
  /**
   * Skip to start of animation
   * Delegates to AnimationEngine for state management
   */
  skipToStart() {
    this.animationEngine.reset();
    this.announce('Skipped to start');
  },
  
  /**
   * Skip to end of animation
   * Delegates to AnimationEngine for state management
   */
  skipToEnd() {
    this.animationEngine.seekToProgress(1.0);
    this.announce('Skipped to end');
  },
  
  /**
   * Start the render loop using AnimationEngine
   * Performance optimizations:
   * - Conditional rendering: Only renders when state changes (~90% CPU reduction when paused)
   * - Throttled time display: Updates only when seconds change (~98% fewer DOM updates)
   * - Delegates animation logic to AnimationEngine service
   */
  startRenderLoop() {
    // Track state changes for conditional rendering
    let lastProgress = -1;
    let lastWaitingState = false;
    
    // Start AnimationEngine with update callback
    this.animationEngine.start((state) => {
      // The export loop owns rendering while export mode is active (its seeks
      // change state.progress); rendering here too would just duplicate work.
      if (this._isExportMode) return;

      // Performance optimization: Only render when animation state changes
      const progressChanged = Math.abs(state.progress - lastProgress) > 0.0001;
      const waitingChanged = state.isWaitingAtWaypoint !== lastWaitingState;
      // Also continue rendering while camera is transitioning (zoom or center position)
      const zoomTransitioning = this.cameraService?.isZoomTransitioning(this.displayWidth, this.displayHeight) ?? false;
      const shouldRender = state.isPlaying || progressChanged || waitingChanged || zoomTransitioning;
      
      if (shouldRender) {
        // Sync UI with animation state (minimal updates)
        this.syncUIWithAnimationState(state);
        
        // Render canvas
        this.render();
        
        // Update tracking for next frame
        lastProgress = state.progress;
        lastWaitingState = state.isWaitingAtWaypoint;
      }
    });
  },
  
  /**
   * Synchronize UI elements with AnimationEngine state
   * Performance optimization: Throttles time display updates to once per second
   */
  syncUIWithAnimationState(state) {
    // Update timeline slider (needs high precision)
    const timelineProgress = state.currentTime / state.duration;
    this.elements.timelineSlider.value = timelineProgress * ANIMATION.TIMELINE_RESOLUTION;
    
    // Update time display only when seconds change (98% fewer DOM updates)
    const currentSeconds = Math.floor(state.currentTime / 1000);
    if (currentSeconds !== this._lastDisplayedSecond) {
      this.updateTimeDisplay(state.currentTime, state.duration);
      this._lastDisplayedSecond = currentSeconds;
    }
  },
  
  /**
   * Update time display with current and total time
   * @param {number} currentTime - Current time in milliseconds (optional, uses engine state if not provided)
   * @param {number} duration - Total duration in milliseconds (optional, uses engine state if not provided)
   */
  updateTimeDisplay(currentTime = null, duration = null) {
    const formatTime = (ms) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Use provided values or fall back to AnimationEngine state
    const current = currentTime !== null ? currentTime : this.animationEngine.state.currentTime;
    const total = duration !== null ? duration : this.animationEngine.state.duration;
    
    this.elements.currentTime.textContent = formatTime(current);
    this.elements.totalTime.textContent = formatTime(total);
    
    // Also update export summary
    this.updateExportSummary();
  }
};
