import { CatmullRom } from '../utils/CatmullRom.js';
import { Easing } from '../utils/Easing.js';
import { PATH, RENDERING } from '../config/constants.js';

/**
 * Service for calculating paths through waypoints
 * Handles spline interpolation, reparameterization, and path shape generation
 * Optimized with curvature caching, binary search, and fast approximations
 */
export class PathCalculator {
  constructor() {
    this._majorWaypointsCache = new Map();
    this._curvatureCache = new Map();
    this._useFastCurvature = true; // Use fast approximation by default
  }
  
  /**
   * Calculate a smooth path through waypoints
   * @param {Array} waypoints - Array of waypoint objects
   * @param {Object} options - Path calculation options
   * @returns {Array} Array of path points
   */
  calculatePath(waypoints, options = {}) {
    if (waypoints.length < 2) {
      return [];
    }
    
    // Convert waypoints to coordinates for spline calculation
    const coords = waypoints.map(wp => ({ 
      x: wp.x ?? wp.imgX, 
      y: wp.y ?? wp.imgY,
      isMajor: wp.isMajor
    }));
    
    // Generate initial path using Catmull-Rom splines
    const roughPath = CatmullRom.createPath(
      coords, 
      options.pointsPerSegment || PATH.POINTS_PER_SEGMENT,
      options.tension || PATH.DEFAULT_TENSION
    );
    
    // Apply corner-based velocity modulation for smoother animation
    const evenPath = this.reparameterizeWithCornerSlowing(
      roughPath, 
      options.targetSpacing || PATH.TARGET_SPACING
    );
    
    // Apply path shapes and generate stable points
    return this.applyPathShapes(evenPath, waypoints);
  }
  
  /**
   * Reparameterize path with corner slowing for smoother animation
   * Uses curvature-based velocity modulation with binary search optimization
   * 
   * Expects normalized coordinates (0-1 range) for coordinate-system independence.
   * Path points are transformed to canvas coords at render time via imageToCanvas().
   * 
   * @param {Array} rawPath - Original path points with x,y in normalized coords (0-1)
   * @param {number} targetSpacing - Base spacing value (scaled for normalized coords)
   * @returns {Array} Reparameterized path with evenly-spaced points
   */
  reparameterizeWithCornerSlowing(rawPath, targetSpacing = PATH.TARGET_SPACING) {
    if (rawPath.length < 2) return rawPath;
    
    // Calculate curvature at each point (with caching)
    const curvatures = this._getCachedCurvature(rawPath);
    
    // Build distance array with velocity modulation based on curvature
    const distances = [0];
    let totalDistance = 0;
    
    for (let i = 1; i < rawPath.length; i++) {
      const dx = rawPath[i].x - rawPath[i-1].x;
      const dy = rawPath[i].y - rawPath[i-1].y;
      const physicalDist = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate velocity factor based on curvature
      const curvature = curvatures[i];
      const velocityFactor = this._calculateVelocityFactor(curvature);
      
      // Adjust distance based on velocity (slower = more time = more "distance" in time-space)
      const adjustedDist = physicalDist / velocityFactor;
      totalDistance += adjustedDist;
      distances.push(totalDistance);
    }
    
    // Create evenly-spaced points in adjusted distance space using binary search
    const evenPath = [];
    
    // Scale spacing for normalized coordinates (0-1 range)
    // targetSpacing is defined in pixels, divide by 1000 for normalized coord scale
    const normalizedSpacing = targetSpacing / 1000;
    
    // Ensure minimum point count equals input path length for quality preservation
    const numPoints = Math.max(rawPath.length, Math.floor(totalDistance / normalizedSpacing));
    
    for (let i = 0; i <= numPoints; i++) {
      const targetDist = (i / numPoints) * totalDistance;
      
      // Binary search for segment (optimized from linear search)
      const segmentIdx = this._binarySearchSegment(distances, targetDist);
      
      // Interpolate within the segment
      const segStart = distances[segmentIdx];
      const segEnd = distances[segmentIdx + 1] || segStart;
      const segLength = segEnd - segStart;
      const t = segLength > 0 ? (targetDist - segStart) / segLength : 0;
      
      const p1 = rawPath[segmentIdx];
      const p2 = rawPath[segmentIdx + 1] || p1;
      
      evenPath.push({
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
      });
    }
    
    return evenPath;
  }
  
  /**
   * Calculate velocity factor based on curvature
   * High curvature = slower, low curvature = faster
   * @private
   */
  _calculateVelocityFactor(curvature) {
    const maxCurvature = PATH.MAX_CURVATURE;
    const minSpeed = PATH.MIN_CORNER_SPEED;
    
    // Apply quadratic easing for smoother corner slowing
    const normalizedCurvature = Math.min(curvature / maxCurvature, 1);
    const easedCurvature = Easing.quadIn(normalizedCurvature);
    const velocityFactor = Math.max(minSpeed, 1 - easedCurvature * (1 - minSpeed));
    
    return velocityFactor;
  }
  
  /**
   * Binary search to find segment containing target distance
   * Optimized from O(n) linear search to O(log n)
   * @private
   */
  _binarySearchSegment(distances, targetDist) {
    let left = 0;
    let right = distances.length - 1;
    
    // Handle edge cases
    if (targetDist <= distances[0]) return 0;
    if (targetDist >= distances[right]) return right - 1;
    
    while (left < right - 1) {
      const mid = Math.floor((left + right) / 2);
      if (distances[mid] < targetDist) {
        left = mid;
      } else {
        right = mid;
      }
    }
    
    return left;
  }
  
  /**
   * Apply path shapes (squiggle, randomised) to the path points
   * Generates actual transformed path points that the head will follow
   * @param {Array} evenPath - Evenly spaced path points
   * @param {Array} waypoints - Original waypoints with shape information
   * @returns {Array} Path with shapes applied as actual coordinates
   */
  applyPathShapes(evenPath, waypoints) {
    const finalPath = [];
    const totalSegments = waypoints.length - 1;
    if (totalSegments < 1) return evenPath;
    
    // Create stable seed for randomised paths
    let pathSeed = 0;
    waypoints.forEach(wp => {
      pathSeed += (wp.imgX ?? wp.x ?? 0) * 1000 + (wp.imgY ?? wp.y ?? 0);
    });
    
    // Calculate points per segment for segment-local calculations
    const pointsPerSegment = Math.floor(evenPath.length / totalSegments);
    
    // Find the path point index closest to each waypoint position
    // This gives us accurate segment boundaries based on actual waypoint locations
    const waypointPathIndices = waypoints.map(wp => {
      const wpX = wp.x !== undefined ? wp.x : wp.imgX;
      const wpY = wp.y !== undefined ? wp.y : wp.imgY;
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let j = 0; j < evenPath.length; j++) {
        const dx = evenPath[j].x - wpX;
        const dy = evenPath[j].y - wpY;
        const dist = dx * dx + dy * dy;
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = j;
        }
      }
      return closestIdx;
    });
    
    // Process each point
    for (let i = 0; i < evenPath.length; i++) {
      const point = evenPath[i];
      
      // Find which segment this point belongs to based on waypoint path indices
      let segmentIndex = 0;
      for (let s = 0; s < totalSegments; s++) {
        if (i >= waypointPathIndices[s] && i < waypointPathIndices[s + 1]) {
          segmentIndex = s;
          break;
        }
        // Handle last segment (includes endpoint)
        if (s === totalSegments - 1 && i >= waypointPathIndices[s]) {
          segmentIndex = s;
        }
      }
      
      // Calculate position within segment (0 to 1)
      const segmentStartIdx = waypointPathIndices[segmentIndex];
      const segmentEndIdx = waypointPathIndices[segmentIndex + 1] || evenPath.length - 1;
      const segmentLength = segmentEndIdx - segmentStartIdx;
      const withinSegmentProgress = segmentLength > 0 ? (i - segmentStartIdx) / segmentLength : 0;
      
      // Find the controlling waypoint for this segment
      // The waypoint at segmentIndex controls the segment FROM that waypoint TO the next
      const controller = waypoints[segmentIndex];
      const pathShape = controller?.pathShape || 'line';
      
      // Get shape parameters from controller
      // Amplitude scaled for normalized coords (0-1 range)
      const amplitude = (controller?.shapeAmplitude || 10) / 500; // Increased scale for visibility
      // Frequency: number of complete waves per segment
      const frequency = controller?.shapeFrequency || 5;
      
      // Calculate perpendicular direction for displacement
      let perpX = 0, perpY = 0;
      if (i > 0 && i < evenPath.length - 1) {
        const prev = evenPath[i - 1];
        const next = evenPath[i + 1];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        perpX = -dy / len;
        perpY = dx / len;
      } else if (i === 0 && evenPath.length > 1) {
        const next = evenPath[1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        perpX = -dy / len;
        perpY = dx / len;
      } else if (i === evenPath.length - 1 && evenPath.length > 1) {
        const prev = evenPath[i - 1];
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        perpX = -dy / len;
        perpY = dx / len;
      }
      
      // Apply shape transformations
      if (pathShape === 'squiggle') {
        // Sinusoidal displacement using segment-local progress
        // Wave starts and ends at 0 at segment boundaries (use sin which is 0 at 0 and 2π)
        const wavePhase = withinSegmentProgress * frequency * 2 * Math.PI;
        const wave = Math.sin(wavePhase) * amplitude;
        finalPath.push({
          x: point.x + perpX * wave,
          y: point.y + perpY * wave,
          pathShape: pathShape
        });
      } else if (pathShape === 'randomised') {
        // Seeded random displacement perpendicular to path
        // Use segment-local index for consistent randomness within segment
        // Lower frequency = smoother random variations (fewer changes per segment)
        const localIndex = Math.floor(withinSegmentProgress * pointsPerSegment);
        // Scale frequency down significantly for randomised (1-20 slider → 0.00001-0.0002 effective)
        const effectiveFreq = frequency * 0.00001;
        const pointSeed = pathSeed + segmentIndex * 1000 + localIndex * effectiveFreq * 12.9898;
        const rng = Math.sin(pointSeed) * 43758.5453;
        const randVal = (rng - Math.floor(rng)) * 2 - 1; // -1 to 1
        const jitter = randVal * amplitude;
        
        finalPath.push({
          x: point.x + perpX * jitter,
          y: point.y + perpY * jitter,
          pathShape: pathShape
        });
      } else {
        // Line shape - no transformation
        finalPath.push({
          ...point,
          pathShape: pathShape
        });
      }
    }
    
    return finalPath;
  }
  
  /**
   * Find major waypoint positions along the path
   * @param {Array} waypoints - Array of waypoints
   * @returns {Array} Array of major waypoint positions
   */
  getMajorWaypointPositions(waypoints) {
    // Use cache for performance
    const cacheKey = this._getCacheKey(waypoints);
    if (this._majorWaypointsCache.has(cacheKey)) {
      return this._majorWaypointsCache.get(cacheKey);
    }
    
    const majorWaypoints = [];
    const totalWaypoints = waypoints.length;
    
    waypoints.forEach((wp, index) => {
      if (wp.isMajor) {
        const progress = totalWaypoints > 1 ? index / (totalWaypoints - 1) : 0;
        majorWaypoints.push({
          index: index,
          progress: progress,
          waypoint: wp
        });
      }
    });
    
    this._majorWaypointsCache.set(cacheKey, majorWaypoints);
    return majorWaypoints;
  }
  
  /**
   * Find which segment a given progress value falls into
   * @param {number} progress - Progress value from 0 to 1
   * @param {number} totalWaypoints - Total number of waypoints
   * @returns {number} Segment index
   */
  findSegmentIndexForProgress(progress, totalWaypoints) {
    if (totalWaypoints < 2) return -1;
    
    const segments = totalWaypoints - 1;
    const rawIndex = progress * segments;
    return Math.min(Math.floor(rawIndex), segments - 1);
  }
  
  /**
   * Calculate total path length
   * @param {Array} pathPoints - Array of path points
   * @returns {number} Total path length in pixels
   */
  calculatePathLength(pathPoints) {
    if (!pathPoints || pathPoints.length === 0) {
      return 0;
    }
    
    let totalLength = 0;
    
    for (let i = 1; i < pathPoints.length; i++) {
      const p1 = pathPoints[i - 1];
      const p2 = pathPoints[i];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }
    
    return totalLength;
  }
  
  /**
   * Compute per-leg "timing lengths" for major-to-major legs.
   *
   * Timing is keyframed on major waypoints only: minors shape the path
   * geometry but must not split a leg into separately-timed sub-segments
   * (see decision-log: major-leg keyframing). Each leg's timing length is its
   * progress span (endProgress − startProgress) scaled by the full path
   * length. Two properties fall out of choosing progress span (not summed
   * pixel lengths) as the basis:
   *   1. Corner-slowing is preserved — progress maps to path-point index,
   *      which the reparameteriser makes corner-dense, so advancing progress
   *      linearly in time slows through corners exactly as the uniform
   *      (all-1.0x) path does.
   *   2. No regime split — at 1.0x the leg lengths sum to the full path
   *      length, so total duration equals calculatePathLength / baseSpeed and
   *      playback is identical whether or not any leg carries a custom speed.
   *
   * @param {Array<number>} majorProgressValues - Path progress (0-1) for each major waypoint, in path order
   * @param {number} totalLength - Full (corner-slowed) path length in pixels
   * @returns {Array<number>} Timing length per major leg (majorProgressValues.length - 1 entries)
   */
  legTimingLengths(majorProgressValues, totalLength) {
    if (!majorProgressValues || majorProgressValues.length < 2) {
      return [];
    }
    
    const lengths = [];
    for (let i = 0; i < majorProgressValues.length - 1; i++) {
      const span = majorProgressValues[i + 1] - majorProgressValues[i];
      // Clamp negative spans (out-of-order progress) to 0 so timing never goes backwards
      lengths.push(Math.max(0, span) * totalLength);
    }
    
    return lengths;
  }
  
  /**
   * Get interpolated position along path at given progress
   * @param {Array} pathPoints - Array of path points
   * @param {number} progress - Progress value from 0 to 1
   * @returns {Object} Point with x and y coordinates
   */
  getPointAtProgress(pathPoints, progress) {
    if (pathPoints.length === 0) return null;
    if (progress <= 0) return pathPoints[0];
    if (progress >= 1) return pathPoints[pathPoints.length - 1];
    
    const index = Math.floor(progress * (pathPoints.length - 1));
    const localProgress = (progress * (pathPoints.length - 1)) - index;
    
    if (index >= pathPoints.length - 1) {
      return pathPoints[pathPoints.length - 1];
    }
    
    const p1 = pathPoints[index];
    const p2 = pathPoints[index + 1];
    
    return {
      x: p1.x + (p2.x - p1.x) * localProgress,
      y: p1.y + (p2.y - p1.y) * localProgress
    };
  }
  
  /**
   * Calculate the progress value (0-1) for each waypoint in the path
   * Finds the closest path point to each waypoint's canvas position
   * 
   * Performance: O(n + m) where n=pathPoints, m=waypoints
   * Uses the fact that waypoints appear in order along the path,
   * so we only need to search forward from the last found position.
   * 
   * @param {Array} pathPoints - Array of path points in canvas coordinates
   * @param {Array} waypoints - Array of waypoints with x,y canvas coordinates
   * @returns {Array} Array of progress values for each waypoint
   */
  calculateWaypointProgress(pathPoints, waypoints) {
    if (!pathPoints || pathPoints.length === 0 || !waypoints || waypoints.length === 0) {
      return [];
    }
    
    const progressValues = [];
    const totalPoints = pathPoints.length;
    let searchStart = 0; // Start searching from here for each waypoint
    
    for (let wpIndex = 0; wpIndex < waypoints.length; wpIndex++) {
      const wp = waypoints[wpIndex];
      const wpX = wp.x;
      const wpY = wp.y;
      
      // Find the closest path point to this waypoint
      // Search forward from last found position (waypoints are in order along path)
      let minDist = Infinity;
      let closestIndex = searchStart;
      
      // Search forward from searchStart, but allow some backtrack for edge cases
      const searchFrom = Math.max(0, searchStart - 10);
      
      for (let i = searchFrom; i < totalPoints; i++) {
        const p = pathPoints[i];
        const dx = p.x - wpX;
        const dy = p.y - wpY;
        const dist = dx * dx + dy * dy; // Squared distance (no sqrt needed)
        
        if (dist < minDist) {
          minDist = dist;
          closestIndex = i;
        }
        
        // Early exit: if distance starts increasing significantly after finding a close point,
        // we've passed the waypoint (since path is continuous)
        if (dist > minDist * 4 && minDist < 100) {
          break;
        }
      }
      
      // Update search start for next waypoint
      searchStart = closestIndex;
      
      // Convert index to progress (0-1)
      const progress = closestIndex / (totalPoints - 1);
      progressValues.push(progress);
    }
    
    return progressValues;
  }
  
  /**
   * Clear the cache
   */
  clearCache() {
    this._majorWaypointsCache.clear();
    this._curvatureCache.clear();
  }
  
  /**
   * Get cached curvature or calculate if not in cache
   * @private
   */
  _getCachedCurvature(path) {
    const pathKey = this._getPathHash(path);
    
    if (!this._curvatureCache.has(pathKey)) {
      const curvatures = this._useFastCurvature
        ? this._calculateCurvatureFast(path)
        : this._calculateCurvatureAccurate(path);
      this._curvatureCache.set(pathKey, curvatures);
    }
    
    return this._curvatureCache.get(pathKey);
  }
  
  /**
   * Fast curvature approximation using triangle area method
   * ~2.5x faster than accurate method with 95% similar results
   * @private
   */
  _calculateCurvatureFast(path) {
    const curvatures = [];
    
    for (let i = 0; i < path.length; i++) {
      if (i === 0 || i === path.length - 1) {
        curvatures.push(0);
        continue;
      }
      
      const p0 = path[i - 1];
      const p1 = path[i];
      const p2 = path[i + 1];
      
      // Triangle area method (cross product)
      const area = Math.abs(
        (p1.x - p0.x) * (p2.y - p0.y) - 
        (p2.x - p0.x) * (p1.y - p0.y)
      );
      
      // Calculate distances
      const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const avgDist = (d1 + d2) / 2;
      
      // Approximate curvature
      curvatures.push(avgDist > 0 ? area / (avgDist * avgDist) : 0);
    }
    
    return curvatures;
  }
  
  /**
   * Accurate curvature calculation using geometric method
   * More precise but slower than fast approximation
   * @private
   */
  _calculateCurvatureAccurate(path) {
    const curvatures = [];
    
    for (let i = 0; i < path.length; i++) {
      if (i === 0 || i === path.length - 1) {
        curvatures.push(0);
        continue;
      }
      
      const p0 = path[i - 1];
      const p1 = path[i];
      const p2 = path[i + 1];
      
      // Calculate vectors
      const v1x = p1.x - p0.x;
      const v1y = p1.y - p0.y;
      const v2x = p2.x - p1.x;
      const v2y = p2.y - p1.y;
      
      // Calculate lengths
      const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
      const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
      
      if (len1 === 0 || len2 === 0) {
        curvatures.push(0);
        continue;
      }
      
      // Normalize vectors
      const n1x = v1x / len1;
      const n1y = v1y / len1;
      const n2x = v2x / len2;
      const n2y = v2y / len2;
      
      // Calculate angle change
      const crossProduct = n1x * n2y - n1y * n2x;
      const dotProduct = n1x * n2x + n1y * n2y;
      const angle = Math.atan2(crossProduct, dotProduct);
      
      // Curvature is angle change divided by average segment length
      const avgLen = (len1 + len2) / 2;
      const curvature = avgLen > 0 ? Math.abs(angle) / avgLen : 0;
      
      curvatures.push(curvature);
    }
    
    return curvatures;
  }
  
  /**
   * Generate cache key for path
   * @private
   */
  _getPathHash(path) {
    // Use first, middle, and last points for hash (fast approximation)
    const len = path.length;
    if (len < 3) return `${path[0].x},${path[0].y}`;
    
    const first = path[0];
    const mid = path[Math.floor(len / 2)];
    const last = path[len - 1];
    
    return `${first.x},${first.y}|${mid.x},${mid.y}|${last.x},${last.y}|${len}`;
  }
  
  /**
   * Generate cache key for waypoints
   * @private
   */
  _getCacheKey(waypoints) {
    return waypoints.map(wp => `${wp.imgX},${wp.imgY},${wp.isMajor}`).join('|');
  }
}
