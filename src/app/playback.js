/**
 * Transport + playback helpers: play/pause/skip, preview mode, render loop, and time display sync.
 *
 * RoutePlotter prototype mixin: methods moved verbatim out of main.js
 * (Phase 1 enabling refactor). Every method runs with `this` bound to the
 * RoutePlotter instance; main.js attaches the group via
 * Object.assign(RoutePlotter.prototype, playbackMixin).
 */
import { ANIMATION } from '../config/constants.js';
import { setTimelineReadout } from '../utils/uiReadouts.js';
import { isModalOpen, whenNoModalOpen } from '../utils/focusTrap.js';
import { returnFocus } from '../components/ModeBanner.js';
import { areaImageAspect } from '../utils/crowdArea.js';

/** Whether the first-start tip has been shown, in this browser's storage. */
const PREVIEW_TIP_KEY = 'routePlotter_previewTipDismissed';
/** The tip, as it is said. */
const PREVIEW_TIP = 'Tip: Check your sequence in Preview mode before exporting';
/** How long the tip shows once it does: its 8 s as a toast. */
const PREVIEW_TIP_MS = 8000;

// ========== JKL PLAYBACK METHODS ==========
// Video editor style playback controls (like Premiere Pro, Final Cut, etc.)
// State tracked via: _jklDirection (-1=reverse, 0=stopped, 1=forward)
//                    _jklSpeedMultiplier (1, 2, 4, 8, 16)
// These are temporary playback speeds, not saved to settings

/** @constant {number} Maximum JKL speed multiplier (4 doublings from 1x) */
const JKL_MAX_SPEED = 16;

/**
 * Why Play is off with nothing to play (CROWD-08 part A, the owner's words of
 * 2026-10-13): the playbar's reason line, and what a refused press says.
 */
const PLAY_REASON = 'Add at least two route waypoints, or draw a crowd\'s network, to play.';

export const playbackMixin = {

  /**
   * Whether the scene has anything to play (CROWD-08 part A): a route of two
   * or more waypoints, or a crowd whose dots the engine draws at some
   * instant of the playback (`SwarmEngine.canRelease`), visible or not, as a
   * hidden route still plays (the lead's settlement, §4.1). Play, Space, J,
   * K, L, both exports, their reasons and the Guide card's sentence all ask
   * this, so none can contradict another. Read live, never cached: a press
   * just after an edit is answered for the scene as it now stands.
   * @returns {boolean}
   */
  canPlayScene() {
    if ((this.waypoints?.length || 0) >= 2) return true;
    const engine = this.animationEngine;
    const context = {
      imageAspect: areaImageAspect(this.coordinateTransform),
      durationMs: engine.state.baseDuration ?? engine.state.duration,
      routePathPoints: this.pathPoints,
      routeAnchors: this.getRouteArrivalMap?.() || null,
    };
    return (this.scene?.getFlowLayers?.() || []).some(layer => this.swarmEngine.canRelease(layer, context));
  },

  /**
   * The one guard on a start (CROWD-08 part A), first in each transport
   * listener that starts the engine (Play, Space and K, J and L), before any
   * direction or speed is written: with nothing to play it refuses, says why
   * once and changes nothing. A pause is never refused. A start with no
   * route measures a scene end an edit has just queued (its 50 ms debounce),
   * so it plays to the end as it now stands.
   * @returns {boolean} Whether the start may go ahead
   */
  _admitPlayStart() {
    if (this.animationEngine.isPlaying()) return true;
    if (!this.canPlayScene()) {
      this.announce(PLAY_REASON);
      return false;
    }
    if (this.waypoints.length < 2 && this._sceneEndTimeout) this.refreshSceneEnd();
    return true;
  },

  /**
   * Keep what depends on whether the scene can play in step with it
   * (CROWD-08 part A): Play and its reason line, the export items and their
   * reasons, and the Guide card's sentence; and, as the route crosses two
   * waypoints, the Duration control's meaning. Called where every change
   * that can alter it already passes: the path rebuild, which resolves
   * anchored nodes (`calculatePath`), and the scene end's measure
   * (`measureSceneEnd`), which every crowd, network, seed, lifecycle and
   * timeline edit queues; never per frame. Writes only on a change.
   */
  refreshPlayAvailability() {
    const routeless = (this.waypoints?.length || 0) < 2;
    if (routeless !== this._durationRouteless) {
      this._durationRouteless = routeless;
      this.uiController?.setDurationRouteless?.(routeless);
      this.syncDurationThumb();
      this.updateDurationReadout?.();
    }
    const playable = this.canPlayScene();
    if (playable === this._scenePlayable) return;
    this._scenePlayable = playable;
    this.uiController?.setPlayAvailability?.(playable ? '' : PLAY_REASON);
    this.updateExportAvailability?.();
    this.updateGuideCard?.();
    // The reason line takes a row under the playbar, so the canvas is refitted to the room left.
    this._refitAfterModeBanner?.();
  },

  /**
   * A project left with at least one crowd, fewer than two route waypoints
   * and no base timeline takes `ANIMATION.DEFAULT_DURATION` (CROWD-08 part
   * A), so its crowds have a timeline to release across. The authored edits
   * that can leave one call it before their undo snapshot, so the default is
   * in that edit's undo step: adding a crowd and deleting route waypoints
   * below two (opening applies it as it stages the project). A positive
   * base is never touched; Clear All leaves no crowd, so it keeps 0; undo
   * and redo restore what they captured and never call it. Only the base is
   * set: the scene end the edit queues measures the end against it.
   * @returns {boolean} Whether the default was applied
   */
  applyRoutelessTimelineDefault() {
    const state = this.animationEngine.state;
    if (this.waypoints.length >= 2 || !(this.scene?.getFlowLayers?.().length > 0)) return false;
    if (state.baseDuration > 0) return false;
    state.baseDuration = ANIMATION.DEFAULT_DURATION;
    this.syncDurationThumb();
    return true;
  },

  /**
   * Put the Duration thumb where the project's timing is, through the one
   * event that moves it (`ui:slider:update-speed`): the route's speed with a
   * route, its payload exactly as before; with fewer than two route
   * waypoints the base timeline (CROWD-08 part A), `{baseDurationMs}`.
   */
  syncDurationThumb() {
    if (this.waypoints.length >= 2) {
      this.eventBus.emit('ui:slider:update-speed', this.animationEngine.state.speed);
    } else {
      this.eventBus.emit('ui:slider:update-speed', { baseDurationMs: this.animationEngine.state.baseDuration });
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
   * Update the mode switch UI to reflect current preview mode state, and
   * Preview's badge on the canvas with it: at the start (`_syncInitialUIState`)
   * and at every change, the switch's and an export's own (UI-06 J-12)
   * @private
   */
  _updateModeSwitch() {
    if (this.elements.modeToggleBtn) {
      this.elements.modeToggleBtn.setAttribute('aria-checked', this.previewMode);
    }
    // Its own `hidden`, which only its rule reads: the page's dormant
    // `body[data-mode="preview"]` rules stay as they are (Codex r1 on 7a74755, 2).
    if (this.elements.previewBadge) {
      this.elements.previewBadge.hidden = !this.previewMode;
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
   * The first start's one-time tip, shown in the banner slot below the
   * header as an owner with no mode (UI-06 PR 6, item 7; AUDIT §B: "The tip
   * belongs in the slot"): as a toast it painted over the welcome's
   * backdrop, an × that could not be clicked. Once start-up has settled, it
   * waits while a dialog is open (the welcome, on a first start) and while a
   * mode's banner holds the slot: a tip replaces nothing (the lead's
   * settlement, Codex on 9466a3f, blocking 3). It is marked seen when it
   * shows, so waiting spends nothing; a mode's banner replaces it, and it
   * does not come back.
   * @private
   */
  _showPreviewTip() {
    // Storage a browser blocks or has filled throws. The tip then shows at
    // each visit, rather than stopping the app starting or throwing from its
    // timer (DEF-48).
    let seen = false;
    try {
      seen = localStorage.getItem(PREVIEW_TIP_KEY) === 'true';
    } catch (error) {
      console.warn('Could not read whether the preview tip was seen:', error);
    }
    if (seen) return;
    
    // Show after a brief delay so UI settles first
    const tip = { timer: null, stopWaiting: null, expiry: null, owner: null, over: false };
    this._previewTip = tip;
    tip.timer = setTimeout(() => {
      tip.timer = null;
      // Not before start-up has finished saying what it restored (DEF-45).
      if (this.ready) this.ready.then(() => this._offerPreviewTip());
      else this._offerPreviewTip();
    }, 1500);
  },

  /**
   * Show the tip, or wait: for the dialog open to close, or for the mode
   * whose banner holds the slot to end.
   * @private
   */
  _offerPreviewTip() {
    const tip = this._previewTip;
    if (!tip || tip.over) return;
    tip.stopWaiting?.();
    tip.stopWaiting = null;
    if (isModalOpen()) {
      tip.stopWaiting = whenNoModalOpen(() => this._offerPreviewTip());
      return;
    }
    const banner = this.modeBanner;
    if (!banner) return;
    if (banner.isShowing()) {
      tip.stopWaiting = banner.whenFree(() => this._offerPreviewTip());
      return;
    }
    tip.owner = { onReplaced: () => this._endPreviewTip() };
    const shown = banner.show(tip.owner, {
      id: 'preview-tip-banner',
      title: 'Tip:',
      text: ' Check your sequence in Preview mode before exporting',
      actions: [{ label: 'Dismiss', className: 'banner-dismiss', onClick: () => this._endPreviewTip() }],
    });
    // Refused (offered inside a replacement's exits, past the slot's bound):
    // it waits for the slot as it waits for a mode (Codex r2 on 753f93f, 6).
    if (!shown) {
      tip.owner = null;
      tip.stopWaiting = banner.whenFree(() => this._offerPreviewTip());
      return;
    }
    // Read politely, after what start-up says it restored and whatever
    // else waits, so it never cuts in (UI-06; the owner, 2026-10-09)
    this.announce(PREVIEW_TIP, 'polite', { whenIdle: true });
    try {
      localStorage.setItem(PREVIEW_TIP_KEY, 'true');
    } catch (error) {
      console.warn('Could not remember that the preview tip was seen:', error);
    }
    tip.expiry = setTimeout(() => this._endPreviewTip(), PREVIEW_TIP_MS);
  },

  /**
   * Take the tip away: its Dismiss, its 8 s, or a mode's banner replacing
   * it. Focus held in it goes back to the control focused before it entered
   * the tip, PR 8's toast rule, else to the Route button (UI-06 PR 6, item 5).
   * @private
   */
  _endPreviewTip() {
    const tip = this._previewTip;
    if (!tip?.owner || tip.over) return;
    tip.over = true;
    clearTimeout(tip.expiry);
    tip.expiry = null;
    const banner = this.modeBanner;
    const heldFocus = banner?.holdsFocus(tip.owner) ?? false;
    const before = banner?.focusBefore ?? null;
    banner?.hide(tip.owner);
    if (heldFocus) returnFocus(before);
  },

  /**
   * Stop the tip: its delay, its waits and its 8 s (`_stopModeBannerWork`).
   * @private
   */
  _stopPreviewTip() {
    const tip = this._previewTip;
    if (!tip) return;
    tip.over = true;
    clearTimeout(tip.timer);
    clearTimeout(tip.expiry);
    tip.stopWaiting?.();
    tip.stopWaiting = null;
    this._previewTip = null;
  },
  
  /**
   * Play the animation
   * Delegates to AnimationEngine for state management
   */
  play() {
    // Dead (its callers are commented out, DEL-05), but held to the live routes' guard.
    if (!this.canPlayScene()) return;
    
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
      const shouldRender = this.animationEngine.isPlaying() ||
        progressChanged || waitingChanged || zoomTransitioning;
      
      if (shouldRender) {
        // Sync UI with animation state (minimal updates)
        this.syncUIWithAnimationState(state);
        
        // Render canvas
        this.render();
        
        // Update tracking for next frame
        lastProgress = state.progress;
        lastWaitingState = state.isWaitingAtWaypoint;
      }

      // AnimationEngine can now sleep. Keep it awake only while CameraService
      // still has visible momentum to settle after timeline playback pauses.
      return this.cameraService?.isZoomTransitioning(this.displayWidth, this.displayHeight) ?? false;
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
    
    setTimelineReadout(
      this.elements.timelineSlider, this.elements.currentTime, this.elements.totalTime,
      formatTime(current), formatTime(total)
    );
    
    // Also update export summary
    this.updateExportSummary();
  }
};
