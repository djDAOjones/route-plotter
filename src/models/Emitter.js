/**
 * Model representing one dot stream's authored parameters on a flow layer.
 * Pure data model — no EventBus dependency.
 *
 * Carries the full founding swarm vocabulary (decision-log 2026-08-17):
 * count, release window, onset variance, speed variance, intensity ramp,
 * wobble, lifecycle — plus the per-emitter seed. Holds NO transient state:
 * dot positions are computed by the Phase 3 engine as a pure function of
 * (timelineMs, layer, seed) and are never stored or persisted.
 *
 * The release window (`releaseStart`/`releaseDuration`) is expressed as
 * normalised fractions (0–1) of the master timeline, so windows rescale
 * when the derived timeline duration changes (route length / speed edits).
 * Both fields clamp independently; a window overhanging the timeline end
 * (start + duration > 1) is valid data — the engine clips the effective
 * window at evaluation time.
 */

import { assertSafeStoredColor } from '../utils/safeColor.js';

const VALID_LIFECYCLE_MODES = ['disappear', 'respawn', 'loop', 'collect'];
const MIN_SPEED = 0.001;
const MIN_DOT_SIZE = 0.01;

// An emitter is evaluated once per dot on every animation frame. Keep the
// authored cap deliberately below the point where a single malformed project
// can monopolise the main thread.
export const EMITTER_LIMITS = Object.freeze({
  MAX_DOT_COUNT: 5000,
  MAX_SEED: 0xFFFFFFFF,
  MAX_SPEED: 1000,
  MAX_DOT_SIZE: 100,
});

export class Emitter {
  /**
   * @param {Object} [options={}]
   * @param {string}  [options.id]                  — Unique identifier (auto-generated if omitted).
   * @param {number}  [options.seed]                — Non-negative integer seed for hash(seed, dotIndex, hopIndex); random if omitted.
   * @param {number}  [options.dotCount=50]         — Total dots released within the window (integer 1–5000).
   * @param {number}  [options.speed=0.15]          — Dot travel speed in normalised units/sec (0.001–1000).
   * @param {number}  [options.speedVariance=0.2]   — Per-dot speed jitter, 0–1.
   * @param {number}  [options.dotSize=0.4]         — Dot size factor (0.01–100), scaled at render time.
   * @param {string}  [options.dotColor='#E69F00']  — Dot colour (Okabe-Ito orange default).
   * @param {string}  [options.lifecycleMode='respawn'] — 'disappear' | 'respawn' | 'loop' | 'collect'.
   * @param {number}  [options.releaseStart=0]      — Onset window start as a fraction of the timeline, 0–1.
   * @param {number}  [options.releaseDuration=1]   — Onset window length as a fraction of the timeline, 0–1.
   * @param {number}  [options.onsetVariance=0.2]   — Jitter of each dot's onset around its even-spread slot, 0–1.
   * @param {number}  [options.intensityRamp=0]     — Release-density bias across the window, -1 (front-loaded) to 1 (back-loaded), 0 = uniform.
   * @param {number}  [options.wobble=0]            — Path-wobble amplitude, 0–1.
   */
  constructor(options = {}) {
    this.id = options.id || Emitter._generateId();
    this.seed = Emitter._validateSeed(options.seed);
    this.dotCount = Emitter._clampCount(options.dotCount ?? 50);
    this.speed = Emitter._clampMin(options.speed ?? 0.15, MIN_SPEED, EMITTER_LIMITS.MAX_SPEED);
    this.speedVariance = Emitter._clamp01(options.speedVariance ?? 0.2);
    this.dotSize = Emitter._clampMin(options.dotSize ?? 0.4, MIN_DOT_SIZE, EMITTER_LIMITS.MAX_DOT_SIZE);
    this.dotColor = typeof options.dotColor === 'string' ? options.dotColor : '#E69F00';
    this.lifecycleMode = Emitter._validateLifecycleMode(options.lifecycleMode);
    this.releaseStart = Emitter._clamp01(options.releaseStart ?? 0);
    this.releaseDuration = Emitter._clamp01(options.releaseDuration ?? 1);
    this.onsetVariance = Emitter._clamp01(options.onsetVariance ?? 0.2);
    this.intensityRamp = Emitter._clampSigned(options.intensityRamp ?? 0);
    this.wobble = Emitter._clamp01(options.wobble ?? 0);
  }

  /**
   * Apply a partial update, running each supplied field through the same
   * validation as the constructor. Unknown keys are ignored.
   * @param {Object} partial — Subset of constructor options (id is not updatable).
   */
  update(partial = {}) {
    if ('seed' in partial) this.seed = Emitter._validateSeed(partial.seed);
    if ('dotCount' in partial) this.dotCount = Emitter._clampCount(partial.dotCount);
    if ('speed' in partial) this.speed = Emitter._clampMin(partial.speed, MIN_SPEED, EMITTER_LIMITS.MAX_SPEED);
    if ('speedVariance' in partial) this.speedVariance = Emitter._clamp01(partial.speedVariance);
    if ('dotSize' in partial) this.dotSize = Emitter._clampMin(partial.dotSize, MIN_DOT_SIZE, EMITTER_LIMITS.MAX_DOT_SIZE);
    if ('dotColor' in partial && typeof partial.dotColor === 'string') this.dotColor = partial.dotColor;
    if ('lifecycleMode' in partial) this.lifecycleMode = Emitter._validateLifecycleMode(partial.lifecycleMode);
    if ('releaseStart' in partial) this.releaseStart = Emitter._clamp01(partial.releaseStart);
    if ('releaseDuration' in partial) this.releaseDuration = Emitter._clamp01(partial.releaseDuration);
    if ('onsetVariance' in partial) this.onsetVariance = Emitter._clamp01(partial.onsetVariance);
    if ('intensityRamp' in partial) this.intensityRamp = Emitter._clampSigned(partial.intensityRamp);
    if ('wobble' in partial) this.wobble = Emitter._clamp01(partial.wobble);
  }

  /**
   * Replace the seed with a fresh random one (re-roll the emitter's look).
   * @returns {number} The new seed.
   */
  reseed() {
    const previous = this.seed;
    const candidate = Emitter._randomSeed();
    this.seed = candidate === previous
      ? (previous === EMITTER_LIMITS.MAX_SEED ? 0 : previous + 1)
      : candidate;
    return this.seed;
  }

  /**
   * Serialise to a plain object. Every field is authored data — there is
   * no transient state to exclude.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      seed: this.seed,
      dotCount: this.dotCount,
      speed: this.speed,
      speedVariance: this.speedVariance,
      dotSize: this.dotSize,
      dotColor: this.dotColor,
      lifecycleMode: this.lifecycleMode,
      releaseStart: this.releaseStart,
      releaseDuration: this.releaseDuration,
      onsetVariance: this.onsetVariance,
      intensityRamp: this.intensityRamp,
      wobble: this.wobble,
    };
  }

  /**
   * Deserialise from a plain object with fallback defaults.
   * @param {Object} data
   * @returns {Emitter}
   */
  static fromJSON(data = {}) {
    Emitter.assertValidJSON(data);
    return new Emitter(data);
  }

  /**
   * Validate persisted emitter data without mutating or normalising it.
   * Missing fields retain their historical defaults, but supplied numeric
   * values must be finite and within the model's supported range.
   * @param {Object} data
   * @throws {Error} If persisted data is unsafe or invalid.
   */
  static assertValidJSON(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid emitter: expected an object');
    }

    const finiteFields = [
      'seed', 'dotCount', 'speed', 'speedVariance', 'dotSize',
      'releaseStart', 'releaseDuration', 'onsetVariance',
      'intensityRamp', 'wobble',
    ];
    for (const field of finiteFields) {
      if (field in data && !Number.isFinite(Number(data[field]))) {
        throw new Error(`Invalid emitter ${field}: expected a finite number`);
      }
    }

    if ('seed' in data && (!Number.isSafeInteger(Number(data.seed)) ||
        Number(data.seed) < 0 || Number(data.seed) > EMITTER_LIMITS.MAX_SEED)) {
      throw new Error('Invalid emitter seed: expected an unsigned 32-bit number');
    }
    if ('dotCount' in data) {
      const count = Number(data.dotCount);
      if (!Number.isSafeInteger(count) || count < 1 || count > EMITTER_LIMITS.MAX_DOT_COUNT) {
        throw new Error(`Invalid emitter dotCount: expected an integer from 1 to ${EMITTER_LIMITS.MAX_DOT_COUNT} (maximum ${EMITTER_LIMITS.MAX_DOT_COUNT})`);
      }
    }
    if ('speed' in data && (Number(data.speed) < MIN_SPEED || Number(data.speed) > EMITTER_LIMITS.MAX_SPEED)) {
      throw new Error(`Invalid emitter speed: expected ${MIN_SPEED} to ${EMITTER_LIMITS.MAX_SPEED}`);
    }
    if ('dotSize' in data && (Number(data.dotSize) < MIN_DOT_SIZE || Number(data.dotSize) > EMITTER_LIMITS.MAX_DOT_SIZE)) {
      throw new Error(`Invalid emitter dotSize: expected ${MIN_DOT_SIZE} to ${EMITTER_LIMITS.MAX_DOT_SIZE}`);
    }
    assertSafeStoredColor(data.dotColor, 'emitter dotColor', { allowTransparent: true });

    for (const field of ['speedVariance', 'releaseStart', 'releaseDuration', 'onsetVariance', 'wobble']) {
      if (field in data && (Number(data[field]) < 0 || Number(data[field]) > 1)) {
        throw new Error(`Invalid emitter ${field}: expected a value from 0 to 1`);
      }
    }
    if ('intensityRamp' in data && (Number(data.intensityRamp) < -1 || Number(data.intensityRamp) > 1)) {
      throw new Error('Invalid emitter intensityRamp: expected a value from -1 to 1');
    }
  }

  // ── private helpers ──────────────────────────────────

  /** @private */
  static _generateId() {
    return `em_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Random non-negative 32-bit integer seed.
   * Authoring-time randomness only — playback determinism comes from the
   * persisted value.
   * @private
   * @returns {number}
   */
  static _randomSeed() {
    return Math.floor(Math.random() * 0xFFFFFFFF);
  }

  /**
   * Coerce a seed to a non-negative integer, generating a random one if
   * the value is unusable.
   * @private
   * @param {*} s
   * @returns {number}
   */
  static _validateSeed(s) {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0) return Math.min(EMITTER_LIMITS.MAX_SEED, Math.floor(n));
    return Emitter._randomSeed();
  }

  /**
   * Clamp a dot count to a positive integer.
   * @private
   * @param {number} c
   * @returns {number}
   */
  static _clampCount(c) {
    const n = Number(c);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(EMITTER_LIMITS.MAX_DOT_COUNT, Math.round(n));
  }

  /**
   * Clamp a value to the 0–1 range.
   * @private
   * @param {number} v
   * @returns {number}
   */
  static _clamp01(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  /**
   * Clamp a value to the -1–1 range.
   * @private
   * @param {number} v
   * @returns {number}
   */
  static _clampSigned(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(-1, Math.min(1, n));
  }

  /**
   * Clamp a value to a positive minimum.
   * @private
   * @param {number} v
   * @param {number} min
   * @returns {number}
   */
  static _clampMin(v, min, max = Number.MAX_VALUE) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min) return min;
    return Math.min(max, n);
  }

  /**
   * Validate a lifecycle mode, falling back to 'respawn'.
   * @private
   * @param {string} m
   * @returns {string}
   */
  static _validateLifecycleMode(m) {
    return VALID_LIFECYCLE_MODES.includes(m) ? m : 'respawn';
  }
}
