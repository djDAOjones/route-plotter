/**
 * Catmull-Rom Spline Implementation
 * Provides smooth curve interpolation through a set of waypoints
 */
export class CatmullRom {
  /**
   * Interpolates a point on a Catmull-Rom spline between p1 and p2
   * @param {Object} p0 - Previous control point {x, y}
   * @param {Object} p1 - Start point of segment {x, y}
   * @param {Object} p2 - End point of segment {x, y}
   * @param {Object} p3 - Next control point {x, y}
   * @param {number} t - Interpolation parameter (0 to 1)
   * @param {number} tension - Tension value (lower = tighter curves, higher = looser curves)
   * @returns {Object} Interpolated point {x, y}
   */
  static interpolate(p0, p1, p2, p3, t, tension) {
    
    const t2 = t * t;
    const t3 = t2 * t;
    
    // Pre-calculate tangent vectors
    const v0x = (p2.x - p0.x) * tension;
    const v0y = (p2.y - p0.y) * tension;
    const v1x = (p3.x - p1.x) * tension;
    const v1y = (p3.y - p1.y) * tension;
    
    // Calculate position using Hermite basis functions
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    
    return {
      x: p1.x + v0x * t + (3 * dx - 2 * v0x - v1x) * t2 + (2 * -dx + v0x + v1x) * t3,
      y: p1.y + v0y * t + (3 * dy - 2 * v0y - v1y) * t2 + (2 * -dy + v0y + v1y) * t3
    };
  }
  
  /**
   * Creates a smooth path through waypoints using Catmull-Rom splines
   * @param {Array} waypoints - Array of waypoint objects with x and y properties
   * @param {number} pointsPerSegment - Number of points to generate per segment (default: 30)
   * @param {number} tension - Tension value (lower = tighter curves, higher = looser curves)
   * @returns {Array} Array of interpolated points forming the path
   */
  static createPath(waypoints, pointsPerSegment = 30, tension = 0.5) {
    if (waypoints.length < 2) return [];
    
    const path = [];
    const lastIndex = waypoints.length - 1;
    const step = 1 / pointsPerSegment;
    
    // Generate path segments
    for (let i = 0; i < lastIndex; i++) {
      const p0 = waypoints[i === 0 ? 0 : i - 1];
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      const p3 = waypoints[i === lastIndex - 1 ? lastIndex : i + 2];
      
      // Generate points for this segment
      for (let j = 0; j < pointsPerSegment; j++) {
        path.push(CatmullRom.interpolate(p0, p1, p2, p3, j * step, tension));
      }
    }
    
    // Add the final waypoint
    path.push(waypoints[lastIndex]);
    
    return path;
  }
}
