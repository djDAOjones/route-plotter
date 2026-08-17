/**
 * AreaHighlightRenderer - Renders per-waypoint area highlights on canvas
 * 
 * Supports three shape types:
 * - Circle: centered at (centerX, centerY) with configurable radius
 * - Rectangle: centered at (centerX, centerY) with configurable width/height
 * - Polygon: arbitrary vertices defined by points array
 * 
 * All geometry is stored in normalized image coordinates (0-1).
 * Visibility modes match WAYPOINT_VISIBILITY for consistency.
 * Fade animations use eased opacity transitions.
 * 
 * Rendering order: drawn BEFORE path layer (between overlay and path).
 */

import { AREA_HIGHLIGHT, AREA_VISIBILITY } from '../config/constants.js';
import { Easing } from '../utils/Easing.js';

export class AreaHighlightRenderer {
  /**
   * Render all area highlights for the current animation frame
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context (already transformed for viewport)
   * @param {Array} waypoints - All waypoints
   * @param {Function} imageToCanvas - Coordinate transform (imgX, imgY) => {x, y}
   * @param {Object} animationEngine - Animation engine instance
   * @param {Array|null} waypointProgressValues - Pre-calculated waypoint progress values
   * @param {Object|null} motionSettings - Motion visibility settings (null = edit mode)
   * @param {number} displayWidth - Canvas width in CSS pixels
   * @param {number} displayHeight - Canvas height in CSS pixels
   * @param {boolean} previewMode - Whether in preview/animation mode
   */
  static render(ctx, waypoints, imageToCanvas, animationEngine, waypointProgressValues, motionSettings, displayWidth, displayHeight, previewMode) {
    if (!waypoints || waypoints.length === 0) return;

    const currentPathProgress = animationEngine?.getPathProgress() || 0;
    const pathDuration = animationEngine?.pathDuration || animationEngine?.state?.duration || 1;
    const isAnimating = previewMode && animationEngine;

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      if (!wp.hasAreaHighlight()) continue;

      const ah = wp.areaHighlight;

      // Calculate visibility/opacity
      let opacity = 1;
      if (isAnimating) {
        const wpProgress = waypointProgressValues?.[i] ?? i / Math.max(1, waypoints.length - 1);
        opacity = AreaHighlightRenderer._getVisibilityOpacity(
          ah, wpProgress, currentPathProgress, pathDuration, animationEngine, i
        );
      }

      if (opacity <= 0) continue;

      // Draw the shape
      ctx.save();
      ctx.globalAlpha = opacity;
      AreaHighlightRenderer._drawShape(ctx, ah, imageToCanvas, displayWidth, displayHeight);
      ctx.restore();
    }
  }

  /**
   * Render area highlights in edit mode (non-animated, shows all enabled areas)
   * Used when not in preview mode — draws areas with full opacity, no visibility logic
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} waypoints - All waypoints
   * @param {Function} imageToCanvas - Coordinate transform
   * @param {number} displayWidth - Canvas width
   * @param {number} displayHeight - Canvas height
   * @param {Object|null} selectedWaypoint - Currently selected waypoint (for highlight)
   */
  static renderEditMode(ctx, waypoints, imageToCanvas, displayWidth, displayHeight, selectedWaypoint) {
    if (!waypoints || waypoints.length === 0) return;

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      if (!wp.hasAreaHighlight()) continue;

      const ah = wp.areaHighlight;
      const isSelected = wp === selectedWaypoint;

      ctx.save();
      AreaHighlightRenderer._drawShape(ctx, ah, imageToCanvas, displayWidth, displayHeight);

      // Draw selection indicator for the selected waypoint's area
      if (isSelected) {
        AreaHighlightRenderer._drawSelectionIndicator(ctx, ah, imageToCanvas, displayWidth, displayHeight);
      }
      ctx.restore();
    }
  }

  /**
   * Calculate opacity based on visibility mode, fade timing, and animation progress
   * 
   * @private
   * @param {Object} ah - Area highlight properties
   * @param {number} wpProgress - Waypoint's position in path (0-1)
   * @param {number} currentProgress - Current animation progress (0-1)
   * @param {number} pathDuration - Total path duration in ms
   * @param {Object} animationEngine - Animation engine
   * @param {number} wpIndex - Waypoint index
   * @returns {number} Opacity 0-1
   */
  static _getVisibilityOpacity(ah, wpProgress, currentProgress, pathDuration, animationEngine, wpIndex) {
    const visibility = ah.visibility || AREA_HIGHLIGHT.VISIBILITY_DEFAULT;
    const fadeInMs = ah.fadeInMs ?? AREA_HIGHLIGHT.FADE_IN_DEFAULT;
    const fadeOutMs = ah.fadeOutMs ?? AREA_HIGHLIGHT.FADE_OUT_DEFAULT;

    // Convert fade durations to progress fractions
    const fadeInProgress = pathDuration > 0 ? fadeInMs / pathDuration : 0;
    const fadeOutProgress = pathDuration > 0 ? fadeOutMs / pathDuration : 0;

    const reachedWaypoint = currentProgress >= wpProgress;
    const isWaitingHere = animationEngine?.state?.isWaitingAtWaypoint &&
                          animationEngine?.state?.pauseWaypointIndex === wpIndex;

    switch (visibility) {
      case AREA_VISIBILITY.ALWAYS_SHOW:
        return 1;

      case AREA_VISIBILITY.ALWAYS_HIDE:
        return 0;

      case AREA_VISIBILITY.HIDE_BEFORE: {
        // Hidden before waypoint, visible after (with fade-in)
        if (!reachedWaypoint) {
          // Fade in as we approach
          if (fadeInProgress > 0 && currentProgress >= wpProgress - fadeInProgress) {
            const t = (currentProgress - (wpProgress - fadeInProgress)) / fadeInProgress;
            return Easing.cubicOut(Math.min(1, Math.max(0, t)));
          }
          return 0;
        }
        return 1;
      }

      case AREA_VISIBILITY.HIDE_AFTER: {
        // Visible before waypoint, hidden after (with fade-out)
        if (reachedWaypoint && !isWaitingHere) {
          if (fadeOutProgress > 0 && currentProgress <= wpProgress + fadeOutProgress) {
            const t = (currentProgress - wpProgress) / fadeOutProgress;
            return Easing.quadIn(Math.max(0, 1 - t));
          }
          return 0;
        }
        return 1;
      }

      case AREA_VISIBILITY.HIDE_BEFORE_AND_AFTER: {
        // Hidden before, visible at waypoint, hidden after
        if (!reachedWaypoint) {
          if (fadeInProgress > 0 && currentProgress >= wpProgress - fadeInProgress) {
            const t = (currentProgress - (wpProgress - fadeInProgress)) / fadeInProgress;
            return Easing.cubicOut(Math.min(1, Math.max(0, t)));
          }
          return 0;
        }
        if (isWaitingHere) return 1;
        if (reachedWaypoint) {
          if (fadeOutProgress > 0 && currentProgress <= wpProgress + fadeOutProgress) {
            const t = (currentProgress - wpProgress) / fadeOutProgress;
            return Easing.quadIn(Math.max(0, 1 - t));
          }
          return 0;
        }
        return 1;
      }

      default:
        return 1;
    }
  }

  /**
   * Draw a single area highlight shape
   * 
   * @private
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} ah - Area highlight properties
   * @param {Function} imageToCanvas - Coordinate transform
   * @param {number} displayWidth - Canvas width
   * @param {number} displayHeight - Canvas height
   */
  static _drawShape(ctx, ah, imageToCanvas, displayWidth, displayHeight) {
    const shape = ah.shape;

    switch (shape) {
      case AREA_HIGHLIGHT.SHAPE_CIRCLE:
        AreaHighlightRenderer._drawCircle(ctx, ah, imageToCanvas, displayWidth, displayHeight);
        break;
      case AREA_HIGHLIGHT.SHAPE_RECTANGLE:
        AreaHighlightRenderer._drawRectangle(ctx, ah, imageToCanvas, displayWidth, displayHeight);
        break;
      case AREA_HIGHLIGHT.SHAPE_POLYGON:
        AreaHighlightRenderer._drawPolygon(ctx, ah, imageToCanvas);
        break;
    }
  }

  /**
   * Draw circle area highlight
   * @private
   */
  static _drawCircle(ctx, ah, imageToCanvas, displayWidth, displayHeight) {
    const center = imageToCanvas(ah.centerX, ah.centerY);
    // Radius is fraction of image diagonal — approximate diagonal from display dims
    const diagonal = Math.sqrt(displayWidth * displayWidth + displayHeight * displayHeight);
    const radiusPx = ah.radius * diagonal;

    // Fill
    if (ah.fillOpacity > 0 && ah.fillColor !== 'transparent') {
      ctx.beginPath();
      ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = ah.fillColor;
      ctx.globalAlpha *= ah.fillOpacity;
      ctx.fill();
      // Reset alpha for border (globalAlpha was already set by caller)
      ctx.globalAlpha /= ah.fillOpacity;
    }

    // Border
    if (ah.borderStyle !== 'none' && ah.borderWidth > 0) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
      AreaHighlightRenderer._applyBorderStyle(ctx, ah);
      ctx.stroke();
    }
  }

  /**
   * Draw rectangle area highlight
   * @private
   */
  static _drawRectangle(ctx, ah, imageToCanvas, displayWidth, displayHeight) {
    const center = imageToCanvas(ah.centerX, ah.centerY);
    const w = ah.width * displayWidth;
    const h = ah.height * displayHeight;
    const x = center.x - w / 2;
    const y = center.y - h / 2;

    // Fill
    if (ah.fillOpacity > 0 && ah.fillColor !== 'transparent') {
      ctx.fillStyle = ah.fillColor;
      ctx.globalAlpha *= ah.fillOpacity;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha /= ah.fillOpacity;
    }

    // Border
    if (ah.borderStyle !== 'none' && ah.borderWidth > 0) {
      AreaHighlightRenderer._applyBorderStyle(ctx, ah);
      ctx.strokeRect(x, y, w, h);
    }
  }

  /**
   * Draw polygon area highlight
   * @private
   */
  static _drawPolygon(ctx, ah, imageToCanvas) {
    const points = ah.points;
    if (!points || points.length < AREA_HIGHLIGHT.DRAW_MIN_VERTICES) return;

    ctx.beginPath();
    const first = imageToCanvas(points[0].x, points[0].y);
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < points.length; i++) {
      const p = imageToCanvas(points[i].x, points[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();

    // Fill
    if (ah.fillOpacity > 0 && ah.fillColor !== 'transparent') {
      ctx.fillStyle = ah.fillColor;
      ctx.globalAlpha *= ah.fillOpacity;
      ctx.fill();
      ctx.globalAlpha /= ah.fillOpacity;
    }

    // Border
    if (ah.borderStyle !== 'none' && ah.borderWidth > 0) {
      AreaHighlightRenderer._applyBorderStyle(ctx, ah);
      ctx.stroke();
    }
  }

  /**
   * Apply border style (stroke color, width, dash pattern) to context
   * @private
   */
  static _applyBorderStyle(ctx, ah) {
    ctx.strokeStyle = ah.borderColor || AREA_HIGHLIGHT.BORDER_COLOR_DEFAULT;
    ctx.lineWidth = ah.borderWidth || AREA_HIGHLIGHT.BORDER_WIDTH_DEFAULT;

    switch (ah.borderStyle) {
      case 'dashed':
        ctx.setLineDash([ah.borderWidth * 4, ah.borderWidth * 2]);
        break;
      case 'dotted':
        ctx.setLineDash([ah.borderWidth, ah.borderWidth * 2]);
        break;
      default:
        ctx.setLineDash([]);
    }
  }

  /**
   * Draw selection indicator around the area (dashed blue outline)
   * Shown in edit mode for the selected waypoint's area
   * @private
   */
  static _drawSelectionIndicator(ctx, ah, imageToCanvas, displayWidth, displayHeight) {
    ctx.save();
    ctx.strokeStyle = '#0066CC';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.8;

    switch (ah.shape) {
      case AREA_HIGHLIGHT.SHAPE_CIRCLE: {
        const center = imageToCanvas(ah.centerX, ah.centerY);
        const diagonal = Math.sqrt(displayWidth * displayWidth + displayHeight * displayHeight);
        const radiusPx = ah.radius * diagonal + 4; // 4px padding
        ctx.beginPath();
        ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case AREA_HIGHLIGHT.SHAPE_RECTANGLE: {
        const center = imageToCanvas(ah.centerX, ah.centerY);
        const w = ah.width * displayWidth + 8;
        const h = ah.height * displayHeight + 8;
        ctx.strokeRect(center.x - w / 2, center.y - h / 2, w, h);
        break;
      }
      case AREA_HIGHLIGHT.SHAPE_POLYGON: {
        const points = ah.points;
        if (points && points.length >= AREA_HIGHLIGHT.DRAW_MIN_VERTICES) {
          ctx.beginPath();
          const first = imageToCanvas(points[0].x, points[0].y);
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < points.length; i++) {
            const p = imageToCanvas(points[i].x, points[i].y);
            ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          ctx.stroke();
        }
        break;
      }
    }

    ctx.restore();
  }
}
