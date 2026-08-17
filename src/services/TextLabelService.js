/**
 * TextLabelService - Handles text label positioning and collision detection
 * 
 * ## Responsibilities
 * - Auto-position text labels to avoid collisions with path, markers, and other labels
 * - Calculate text bounding boxes for collision detection
 * - Provide visibility state calculations for fade animations
 * 
 * ## Auto-Position Algorithm
 * 1. Calculate text bounding box based on labelWidth and font size
 * 2. Test 8 positions around marker (N, NE, E, SE, S, SW, W, NW)
 * 3. Score each position by overlap with path segments, markers, and other labels
 * 4. Pick lowest-overlap position
 * 5. Return optimal offsetX/offsetY
 * 
 * ## Performance Considerations
 * - Auto-position is triggered manually (button click), not per-frame
 * - Collision detection uses bounding box approximation, not pixel-perfect
 * - Path collision uses sampled points, not full path geometry
 */

import { TEXT_LABEL, TEXT_VISIBILITY } from '../config/constants.js';
import { Easing } from '../utils/Easing.js';

export class TextLabelService {
  
  /**
   * 8 cardinal/ordinal directions for auto-positioning
   * Each direction is [angle in radians, name]
   */
  static DIRECTIONS = [
    [0, 'E'],                    // East (right)
    [Math.PI / 4, 'NE'],         // Northeast
    [Math.PI / 2, 'N'],          // North (up)
    [3 * Math.PI / 4, 'NW'],     // Northwest
    [Math.PI, 'W'],              // West (left)
    [5 * Math.PI / 4, 'SW'],     // Southwest
    [3 * Math.PI / 2, 'S'],      // South (down)
    [7 * Math.PI / 4, 'SE']      // Southeast
  ];
  
  /**
   * Calculate the optimal position for a text label to minimize collisions
   * 
   * @param {Object} params - Auto-position parameters
   * @param {Object} params.waypoint - The waypoint with the label
   * @param {number} params.waypointIndex - Index of the waypoint
   * @param {Array} params.waypoints - All waypoints
   * @param {Array} params.pathPoints - Interpolated path points (canvas coords)
   * @param {number} params.canvasWidth - Canvas width in pixels
   * @param {number} params.canvasHeight - Canvas height in pixels
   * @param {Function} params.imageToCanvas - Coordinate transform function
   * @returns {{offsetX: number, offsetY: number}} Optimal offset percentages
   */
  static autoPosition({
    waypoint,
    waypointIndex,
    waypoints,
    pathPoints,
    canvasWidth,
    canvasHeight,
    imageToCanvas
  }) {
    if (!waypoint || !waypoint.label) {
      return { offsetX: TEXT_LABEL.OFFSET_DEFAULT_X, offsetY: TEXT_LABEL.OFFSET_DEFAULT_Y };
    }
    
    // Get marker position in canvas coordinates
    const markerPos = imageToCanvas(waypoint.imgX, waypoint.imgY);
    
    // Calculate text box dimensions
    const textWidth = (waypoint.labelWidth / 100) * canvasWidth;
    const textHeight = this.estimateTextHeight(waypoint.label, textWidth, waypoint.labelSize);
    
    // Distance from marker center (in pixels)
    const distance = (TEXT_LABEL.AUTO_POSITION_DISTANCE / 100) * Math.min(canvasWidth, canvasHeight);
    
    // Test each direction and score
    let bestScore = Infinity;
    let bestOffset = { offsetX: 0, offsetY: -TEXT_LABEL.AUTO_POSITION_DISTANCE };
    
    for (const [angle, name] of this.DIRECTIONS) {
      // Calculate offset in pixels
      const offsetPx = {
        x: Math.cos(angle) * distance,
        y: -Math.sin(angle) * distance // Negative because canvas Y is inverted
      };
      
      // Calculate text box center position
      const textCenterX = markerPos.x + offsetPx.x;
      const textCenterY = markerPos.y + offsetPx.y;
      
      // Create bounding box
      const textBox = {
        left: textCenterX - textWidth / 2,
        right: textCenterX + textWidth / 2,
        top: textCenterY - textHeight / 2,
        bottom: textCenterY + textHeight / 2
      };
      
      // Score this position
      const score = this.scorePosition({
        textBox,
        waypointIndex,
        waypoints,
        pathPoints,
        canvasWidth,
        canvasHeight,
        imageToCanvas
      });
      
      if (score < bestScore) {
        bestScore = score;
        // Convert pixel offset to percentage
        bestOffset = {
          offsetX: (offsetPx.x / canvasWidth) * 100,
          offsetY: (offsetPx.y / canvasHeight) * 100
        };
      }
    }
    
    return bestOffset;
  }
  
  /**
   * Score a text position based on collisions
   * Lower score = better position
   * 
   * @private
   */
  static scorePosition({
    textBox,
    waypointIndex,
    waypoints,
    pathPoints,
    canvasWidth,
    canvasHeight,
    imageToCanvas
  }) {
    let score = 0;
    
    // Check collision with path points (sample every 10th point for performance)
    // Path points are in normalized image coords (0-1), must transform to canvas
    if (pathPoints && pathPoints.length > 0 && imageToCanvas) {
      const sampleRate = Math.max(1, Math.floor(pathPoints.length / 100));
      for (let i = 0; i < pathPoints.length; i += sampleRate) {
        const pt = pathPoints[i];
        const canvasPt = imageToCanvas(pt.x, pt.y);
        if (this.pointInBox(canvasPt.x, canvasPt.y, textBox)) {
          score += 10; // Path collision penalty
        }
      }
    }
    
    // Check collision with markers
    if (waypoints) {
      for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        const pos = imageToCanvas(wp.imgX, wp.imgY);
        const markerRadius = wp.dotSize || 8;
        
        // Check if marker overlaps text box
        if (this.circleIntersectsBox(pos.x, pos.y, markerRadius, textBox)) {
          score += 20; // Marker collision penalty (higher than path)
        }
      }
    }
    
    // Check collision with other text labels
    if (waypoints) {
      for (let i = 0; i < waypoints.length; i++) {
        if (i === waypointIndex) continue; // Skip self
        
        const wp = waypoints[i];
        if (!wp.label || wp.labelMode === TEXT_VISIBILITY.OFF) continue;
        
        const pos = imageToCanvas(wp.imgX, wp.imgY);
        const otherWidth = (wp.labelWidth / 100) * canvasWidth;
        const otherHeight = this.estimateTextHeight(wp.label, otherWidth, wp.labelSize);
        
        const otherBox = {
          left: pos.x + (wp.labelOffsetX / 100) * canvasWidth - otherWidth / 2,
          right: pos.x + (wp.labelOffsetX / 100) * canvasWidth + otherWidth / 2,
          top: pos.y + (wp.labelOffsetY / 100) * canvasHeight - otherHeight / 2,
          bottom: pos.y + (wp.labelOffsetY / 100) * canvasHeight + otherHeight / 2
        };
        
        if (this.boxesIntersect(textBox, otherBox)) {
          score += 30; // Text collision penalty (highest)
        }
      }
    }
    
    // Penalize positions that go off-canvas
    if (textBox.left < 0) score += 50;
    if (textBox.right > canvasWidth) score += 50;
    if (textBox.top < 0) score += 50;
    if (textBox.bottom > canvasHeight) score += 50;
    
    return score;
  }
  
  /**
   * Estimate text height based on content and width
   * Uses approximate line wrapping calculation
   * 
   * @param {string} text - Text content
   * @param {number} maxWidth - Maximum width in pixels
   * @param {number} fontSize - Font size in pixels
   * @returns {number} Estimated height in pixels
   */
  static estimateTextHeight(text, maxWidth, fontSize) {
    if (!text) return fontSize + TEXT_LABEL.BG_PADDING * 2;
    
    // Approximate characters per line (assuming average char width ~0.5 * fontSize)
    const avgCharWidth = fontSize * 0.5;
    const charsPerLine = Math.floor(maxWidth / avgCharWidth);
    const lines = Math.ceil(text.length / charsPerLine);
    const lineHeight = fontSize * 1.2;
    
    return lines * lineHeight + TEXT_LABEL.BG_PADDING * 2;
  }
  
  /**
   * Check if a point is inside a bounding box
   * @private
   */
  static pointInBox(x, y, box) {
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }
  
  /**
   * Check if a circle intersects a bounding box
   * @private
   */
  static circleIntersectsBox(cx, cy, r, box) {
    // Find closest point on box to circle center
    const closestX = Math.max(box.left, Math.min(cx, box.right));
    const closestY = Math.max(box.top, Math.min(cy, box.bottom));
    
    // Check if closest point is within circle
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= (r * r);
  }
  
  /**
   * Check if two bounding boxes intersect
   * @private
   */
  static boxesIntersect(box1, box2) {
    return !(box1.right < box2.left || 
             box1.left > box2.right || 
             box1.bottom < box2.top || 
             box1.top > box2.bottom);
  }
  
  /**
   * Calculate text label visibility and opacity for animation
   * 
   * @param {Object} params - Visibility parameters
   * @param {string} params.labelMode - Visibility mode (off, on, fade-up, fade-up-down)
   * @param {number} params.progress - Current animation progress (0-1)
   * @param {number} params.waypointProgress - Progress when waypoint is reached
   * @param {boolean} params.isWaiting - Whether animation is paused at this waypoint
   * @param {boolean} params.hasPassedWaypoint - Whether animation has passed this waypoint
   * @param {number} params.animationDuration - Total animation duration in ms
   * @returns {{visible: boolean, opacity: number}}
   */
  static getTextVisibility({
    labelMode,
    progress,
    waypointProgress,
    isWaiting,
    hasPassedWaypoint,
    animationDuration
  }) {
    // Off mode - never visible
    if (labelMode === TEXT_VISIBILITY.OFF) {
      return { visible: false, opacity: 0 };
    }
    
    // On mode - always visible
    if (labelMode === TEXT_VISIBILITY.ON) {
      return { visible: true, opacity: 1 };
    }
    
    // Calculate fade timing as fraction of progress (1 second fade = 1000ms)
    const fadeDurationProgress = TEXT_LABEL.FADE_DURATION / animationDuration;
    
    // For first waypoint (progress 0), start visible immediately
    const isFirstWaypoint = waypointProgress <= 0.001;
    
    // Fade-up mode: fade in when approaching waypoint, remain visible
    if (labelMode === TEXT_VISIBILITY.FADE_UP) {
      // First waypoint - show immediately
      if (isFirstWaypoint) {
        return { visible: true, opacity: 1 };
      }
      // Before fade window - hidden
      if (progress < waypointProgress - fadeDurationProgress) {
        return { visible: false, opacity: 0 };
      }
      // During fade in
      if (progress < waypointProgress) {
        const fadeProgress = (progress - (waypointProgress - fadeDurationProgress)) / fadeDurationProgress;
        const opacity = Easing.cubicOut(Math.min(1, Math.max(0, fadeProgress)));
        return { visible: true, opacity };
      }
      // After waypoint - fully visible
      return { visible: true, opacity: 1 };
    }
    
    // Fade-up-down mode: fade in, remain during pause, fade out after
    if (labelMode === TEXT_VISIBILITY.FADE_UP_DOWN) {
      // First waypoint - show immediately, then fade out when passed
      if (isFirstWaypoint) {
        if (isWaiting) {
          return { visible: true, opacity: 1 };
        }
        if (hasPassedWaypoint && progress > fadeDurationProgress) {
          return { visible: false, opacity: 0 };
        }
        if (hasPassedWaypoint) {
          const fadeProgress = progress / fadeDurationProgress;
          const opacity = Easing.quadIn(Math.max(0, 1 - fadeProgress));
          return { visible: true, opacity };
        }
        return { visible: true, opacity: 1 };
      }
      
      // Before fade window - hidden
      if (progress < waypointProgress - fadeDurationProgress) {
        return { visible: false, opacity: 0 };
      }
      // During fade in
      if (progress < waypointProgress) {
        const fadeProgress = (progress - (waypointProgress - fadeDurationProgress)) / fadeDurationProgress;
        const opacity = Easing.cubicOut(Math.min(1, Math.max(0, fadeProgress)));
        return { visible: true, opacity };
      }
      // During pause - fully visible
      if (isWaiting) {
        return { visible: true, opacity: 1 };
      }
      // After fade out window - hidden
      if (hasPassedWaypoint && progress > waypointProgress + fadeDurationProgress) {
        return { visible: false, opacity: 0 };
      }
      // During fade out
      if (hasPassedWaypoint) {
        const fadeProgress = (progress - waypointProgress) / fadeDurationProgress;
        const opacity = Easing.quadIn(Math.max(0, 1 - fadeProgress));
        return { visible: true, opacity };
      }
      // Fallback - visible
      return { visible: true, opacity: 1 };
    }
    
    // Unknown mode - treat as fade-up (default behavior)
    // This handles legacy data with invalid modes like 'none'
    // First waypoint - show immediately
    if (isFirstWaypoint) {
      return { visible: true, opacity: 1 };
    }
    // Before fade window - hidden
    if (progress < waypointProgress - fadeDurationProgress) {
      return { visible: false, opacity: 0 };
    }
    // During fade in
    if (progress < waypointProgress) {
      const fadeProgress = (progress - (waypointProgress - fadeDurationProgress)) / fadeDurationProgress;
      const opacity = Easing.cubicOut(Math.min(1, Math.max(0, fadeProgress)));
      return { visible: true, opacity };
    }
    // After waypoint - fully visible
    return { visible: true, opacity: 1 };
  }
}
