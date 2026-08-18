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

const VALID_LIFECYCLE_MODES = ['disappear', 'respawn', 'loop', 'collect'];
const MIN_SPEED = 0.001;
const MIN_DOT_SIZE = 0.01;

export class Emitter {
  /**
   * @param {Object} [options={}]
   * @param {string}  [options.id]                  — Unique identifier (auto-generated if omitted).
   * @param {number}  [options.seed]                — Non-negative integer seed for hash(seed, dotIndex, hopIndex); random if omitted.
   * @param {number}  [options.dotCount=50]         — Total dots released within the window (integer ≥ 1).
   * @param {number}  [options.speed=0.15]          — Dot travel speed in normalised units/sec (≥ 0.001).
   * @param {number}  [options.speedVariance=0.2]   — Per-dot speed jitter, 0–1.
   * @param {number}  [options.dotSize=0.4]         — Dot size factor (≥ 0.01), scaled at render time.
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
    this.speed = Emitter._clampMin(options.speed ?? 0.15, MIN_SPEED);
    this.speedVariance = Emitter._clamp01(options.speedVariance ?? 0.2);
    this.dotSize = Emitter._clampMin(options.dotSize ?? 0.4, MIN_DOT_SIZE);
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
    if ('speed' in partial) this.speed = Emitter._clampMin(partial.speed, MIN_SPEED);
    if ('speedVariance' in partial) this.speedVariance = Emitter._clamp01(partial.speedVariance);
    if ('dotSize' in partial) this.dotSize = Emitter._clampMin(partial.dotSize, MIN_DOT_SIZE);
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
    this.seed = Emitter._randomSeed();
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
    return new Emitter(data);
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
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
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
    if (Number.isNaN(n) || n < 1) return 1;
    return Math.round(n);
  }

  /**
   * Clamp a value to the 0–1 range.
   * @private
   * @param {number} v
   * @returns {number}
   */
  static _clamp01(v) {
    const n = Number(v);
    if (Number.isNaN(n)) return 0;
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
    if (Number.isNaN(n)) return 0;
    return Math.max(-1, Math.min(1, n));
  }

  /**
   * Clamp a value to a positive minimum.
   * @private
   * @param {number} v
   * @param {number} min
   * @returns {number}
   */
  static _clampMin(v, min) {
    const n = Number(v);
    if (Number.isNaN(n) || n < min) return min;
    return n;
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
