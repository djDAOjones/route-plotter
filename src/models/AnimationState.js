import { ANIMATION } from '../config/constants.js';

/**
 * Model for managing animation state
 * Encapsulates all animation-related properties and provides methods for state updates
 */
export class AnimationState {
  constructor() {
    this.reset();
  }
  
  /**
   * Reset animation to initial state
   * Note: Preserves speed and playbackSpeed settings - only resets playback position
   */
  reset() {
    // Preserve current speed if already set, otherwise use default
    // IMPORTANT: Use !== undefined check, NOT ||, because speed=0 is a valid value
    const preservedSpeed = this.speed !== undefined ? this.speed : ANIMATION.DEFAULT_SPEED;
    const preservedPlaybackSpeed = this.playbackSpeed !== undefined ? this.playbackSpeed : ANIMATION.DEFAULT_PLAYBACK_SPEED;
    
    this.isPlaying = false;
    this.progress = 0;                    // Timeline progress 0 to 1 (includes pause time)
    this.pathProgress = 0;                // Path progress 0 to 1 (position along path)
    this.currentTime = 0;                 // in milliseconds
    this.duration = ANIMATION.DEFAULT_DURATION;
    this.mode = 'constant-speed';         // or 'constant-time'
    this.speed = preservedSpeed;          // Preserve user's speed setting (px/s)
    this.playbackSpeed = preservedPlaybackSpeed;  // Preserve playback multiplier (1x, 2x, etc.)
    
    // Pause states
    this.isPaused = false;                // User-triggered pause
    this.isWaitingAtWaypoint = false;     // Waypoint wait state
    this.pauseWaypointIndex = -1;         // Current waypoint index
    this.pauseStartTime = 0;              // When wait began
    this.pauseEndTime = 0;                // When wait should end
    this.waypointProgressSnapshot = 0;    // Progress frozen during wait
    
    // Timing
    this.lastTime = 0;
  }
  
  /**
   * Start animation playback
   */
  play() {
    this.isPlaying = true;
    this.isPaused = false;
    this.lastTime = performance.now();
  }
  
  /**
   * Pause animation playback
   */
  pause() {
    this.isPaused = true;
  }
  
  /**
   * Stop animation and reset
   */
  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.progress = 0;
    this.currentTime = 0;
  }
  
  /**
   * Toggle between play and pause
   */
  togglePlayPause() {
    if (this.isPlaying && !this.isPaused) {
      this.pause();
    } else {
      this.play();
    }
  }
  
  /**
   * Set animation progress directly
   * @param {number} progress - Progress value from 0 to 1
   */
  setProgress(progress) {
    this.progress = Math.max(0, Math.min(1, progress));
    this.currentTime = this.progress * this.duration;
  }
  
  /**
   * Set animation time directly
   * @param {number} time - Time in milliseconds
   */
  setTime(time) {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.progress = this.duration > 0 ? this.currentTime / this.duration : 0;
  }
  
  /**
   * Update animation mode
   * @param {string} mode - 'constant-speed' or 'constant-time'
   */
  setMode(mode) {
    if (mode === 'constant-speed' || mode === 'constant-time') {
      this.mode = mode;
    } else {
      throw new Error(`Invalid animation mode: ${mode}`);
    }
  }
  
  /**
   * Start waiting at a waypoint
   * @param {number} waypointIndex - Index of the waypoint
   * @param {number} waitDuration - Duration to wait in milliseconds
   * @param {number} progressSnapshot - Progress value to freeze at
   */
  startWaypointWait(waypointIndex, waitDuration, progressSnapshot) {
    this.isWaitingAtWaypoint = true;
    this.pauseWaypointIndex = waypointIndex;
    this.pauseStartTime = performance.now();
    this.pauseEndTime = this.pauseStartTime + waitDuration;
    this.waypointProgressSnapshot = progressSnapshot;
  }
  
  /**
   * End waypoint wait
   */
  endWaypointWait() {
    this.isWaitingAtWaypoint = false;
    this.pauseWaypointIndex = -1;
    this.waypointProgressSnapshot = 0;
  }
  
  /**
   * Check if currently waiting at a waypoint
   * @returns {boolean}
   */
  isWaiting() {
    return this.isWaitingAtWaypoint;
  }
  
  /**
   * Get effective progress (considering waypoint waits)
   * @returns {number} Progress value from 0 to 1
   */
  getEffectiveProgress() {
    return this.isWaitingAtWaypoint ? this.waypointProgressSnapshot : this.progress;
  }
  
  /**
   * Clone current state
   * @returns {Object} Plain object with current state
   */
  toJSON() {
    return {
      isPlaying: this.isPlaying,
      progress: this.progress,
      currentTime: this.currentTime,
      duration: this.duration,
      mode: this.mode,
      speed: this.speed,
      playbackSpeed: this.playbackSpeed,
      isPaused: this.isPaused,
      isWaitingAtWaypoint: this.isWaitingAtWaypoint,
      pauseWaypointIndex: this.pauseWaypointIndex
    };
  }
  
  /**
   * Restore state from JSON
   * @param {Object} data - State data to restore
   */
  fromJSON(data) {
    Object.assign(this, data);
  }
}
