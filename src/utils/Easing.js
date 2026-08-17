/**
 * Essential easing functions for Route Plotter
 * Optimized for performance and clarity
 * 
 * All functions: t ∈ [0,1] → result ∈ [0,1]
 */
export class Easing {
  /**
   * Quadratic ease-in - slow start, accelerating
   * 
   * Usage: Corner slowing calculations in path generation
   * Called ~1000+ times per path during reparameterization
   * 
   * @param {number} t - Progress (0 to 1)
   * @returns {number} Eased value
   */
  static quadIn(t) {
    return t * t;
  }
  
  /**
   * Cubic ease-out - fast start, decelerating
   * 
   * Usage: Ripple fade effects in beacon animations
   * Called every frame (60 FPS) for each active ripple
   * 
   * @param {number} t - Progress (0 to 1)
   * @returns {number} Eased value
   */
  static cubicOut(t) {
    const t1 = t - 1;
    return t1 * t1 * t1 + 1;
  }
  
  /**
   * Cubic ease-in-out - smooth S-curve
   * 
   * Usage: Global animation timing for smooth start/stop
   * Called every frame (60 FPS) in main animation loop
   * 
   * @param {number} t - Progress (0 to 1)
   * @returns {number} Eased value
   */
  static cubicInOut(t) {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 + 4 * (t - 1) * (t - 1) * (t - 1);
  }
}
