/**
 * RenderingService - Handles all canvas rendering operations
 * Extracted from main.js for better modularity
 * 
 * Supports two rendering modes:
 * - Edit mode (previewMode = false): Everything visible for editing
 * - Preview mode (previewMode = true): Applies motion visibility settings
 */

import { RENDERING, INTERACTION, PATH_VISIBILITY, WAYPOINT_VISIBILITY, BACKGROUND_VISIBILITY, MOTION, TEXT_LABEL } from '../config/constants.js';
import { Easing } from '../utils/Easing.js';
import { waypointPointIndices, legMidpointIndex } from '../utils/segmentHitTest.js';
import { BeaconRenderer } from './BeaconRenderer.js';
import { AreaHighlightRenderer } from './AreaHighlightRenderer.js';
import { DotRenderer } from './DotRenderer.js';
import { MotionVisibilityService } from './MotionVisibilityService.js';
import { TextLabelService } from './TextLabelService.js';

export class RenderingService {
  constructor() {
    this.vectorCanvas = null;
    this.waypointPositions = [];
    this.vectorCanvasScale = 1;
    this.vectorCanvasCssWidth = 0;
    this.vectorCanvasCssHeight = 0;
    
    /**
     * BeaconRenderer instance for managing beacon animations
     * @type {BeaconRenderer}
     */
    this.beaconRenderer = new BeaconRenderer();
    
    
    /**
     * Intro animation duration in milliseconds
     * @type {number}
     */
    this.INTRO_DURATION_MS = 1000;
    
    /**
     * Current coordinate transform for relative sizing
     * Set during render() for use by helper methods
     * @type {Object|null}
     */
    this._coordinateTransform = null;
    
    /**
     * Zoom clamp factor for vector-layer elements.
     * Computed once per frame in renderVectorLayerTo().
     * At zoom ≤3× this is 1 (no effect); above 3× it is 3/zoom,
     * dampening size growth so elements stay manageable.
     * @type {number}
     */
    this._zoomClampFactor = 1;
    
    /**
     * Global graphics scale multiplier (0.25–4×, default 1).
     * Applied in scaleSizeClamped() so it affects all vector-layer elements
     * (paths, markers, beacons, labels, path head) uniformly.
     * Set via setGraphicsScale() from the UI slider.
     * @type {number}
     */
    this._graphicsScale = 1;
  }
  
  /**
   * Calculate intro animation scale (0→1 over first second)
   * Uses ease-out cubic for smooth deceleration
   * @param {number} currentTimeMs - Current animation time in milliseconds
   * @returns {number} Scale factor from 0 to 1
   */
  getIntroScale(currentTimeMs) {
    if (currentTimeMs >= this.INTRO_DURATION_MS) return 1;
    if (currentTimeMs <= 0) return 0;
    const t = currentTimeMs / this.INTRO_DURATION_MS;
    // Ease-out cubic: 1 - (1 - t)^3
    return 1 - Math.pow(1 - t, 3);
  }
  
  /**
   * Scale a size value based on the current image dimensions
   * Sizes are scaled relative to a reference diagonal (1414px = ~1000x1000 image)
   * This ensures consistent visual appearance across different image sizes
   * 
   * @param {number} size - Size in "reference pixels" (calibrated for 1414px diagonal)
   * @returns {number} Scaled size in canvas pixels
   */
  scaleSize(size) {
    if (!this._coordinateTransform) return size; // Fallback to raw value
    const refDiagonal = RENDERING.REFERENCE_DIAGONAL || 1414;
    const currentDiagonal = this._coordinateTransform.getReferenceDimension();
    if (currentDiagonal <= 0) return size;
    return size * (currentDiagonal / refDiagonal);
  }

  /**
   * Scale a size value with viewport zoom clamping and global graphics scale.
   * Sizes grow naturally up to 3× zoom, then are dampened so elements
   * don't become overlapping blobs at extreme zoom levels.
   * The global _graphicsScale multiplier is applied here so one slider
   * uniformly affects all vector-layer elements (markers, paths, heads,
   * labels, beacons) without touching individual size values.
   */
  scaleSizeClamped(size) {
    return this.scaleSize(size) * this._zoomClampFactor * this._graphicsScale;
  }
  
  /**
   * Set the global graphics scale multiplier.
   * @param {number} scale - Multiplier (0.25–4, default 1)
   */
  setGraphicsScale(scale) {
    this._graphicsScale = Math.max(0.25, Math.min(4, scale));
  }
  
  /**
   * Compute the layered underlay strokes for the path glow (Option B).
   * Returns layers widest→narrowest; drawn additively (globalCompositeOperation
   * 'lighter') they stack into a soft halo that brightens toward the path centre.
   * Pure and static so it can be unit-tested without a canvas.
   * @param {number} baseWidthPx - already-scaled path stroke width (canvas px)
   * @param {number} intensity - 0–1 glow strength (slider value)
   * @param {number} [extraScale=1] - zoom×graphics scale applied to the halo width
   * @returns {{width:number, alpha:number}[]} layers, widest first (empty if off)
   */
  static glowLayers(baseWidthPx, intensity, extraScale = 1) {
    const i = Math.max(0, Math.min(1, intensity || 0));
    if (i <= 0) return [];
    const n = RENDERING.PATH_GLOW_LAYERS;
    const maxExtra = RENDERING.PATH_GLOW_MAX_EXTRA_WIDTH * i * extraScale;
    const layers = [];
    for (let k = 0; k < n; k++) {
      // k=0 widest (outermost), k=n-1 narrowest (innermost)
      const frac = (n - k) / n;
      layers.push({
        width: baseWidthPx + maxExtra * frac,
        alpha: RENDERING.PATH_GLOW_LAYER_ALPHA
      });
    }
    return layers;
  }
  
  /**
   * Draw alternating black/white dashed selection stroke around a circle
   * Creates a "marching ants" style selection indicator
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Center X coordinate
   * @param {number} y - Center Y coordinate
   * @param {number} radius - Circle radius
   * @param {number} lineWidth - Stroke width (default 3)
   */
  drawSelectionRing(ctx, x, y, radius, lineWidth = 3) {
    const circumference = 2 * Math.PI * radius;
    // 10 segments total (5 black, 5 white), so each segment is 1/10 of circumference
    const segmentLength = circumference / 10;
    
    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    
    // Draw white segments first (as background)
    ctx.strokeStyle = 'white';
    ctx.setLineDash([segmentLength, segmentLength]);
    ctx.lineDashOffset = 0;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw black segments on top (offset by one segment)
    ctx.strokeStyle = 'black';
    ctx.lineDashOffset = -segmentLength;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.setLineDash([]); // Reset dash pattern
    ctx.restore();
  }
  
  /**
   * Draw alternating black/white dashed selection stroke around a rectangle
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Top-left X coordinate
   * @param {number} y - Top-left Y coordinate
   * @param {number} width - Rectangle width
   * @param {number} height - Rectangle height
   * @param {number} lineWidth - Stroke width (default 3)
   */
  drawSelectionRect(ctx, x, y, width, height, lineWidth = 3) {
    const perimeter = 2 * (width + height);
    // 6 segments total (3 black, 3 white)
    const segmentLength = perimeter / 6;
    
    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    
    // Draw white segments first
    ctx.strokeStyle = 'white';
    ctx.setLineDash([segmentLength, segmentLength]);
    ctx.lineDashOffset = 0;
    ctx.strokeRect(x, y, width, height);
    
    // Draw black segments on top
    ctx.strokeStyle = 'black';
    ctx.lineDashOffset = -segmentLength;
    ctx.strokeRect(x, y, width, height);
    
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Draw a solid two-tone hover ring (white under, accent over) —
   * lighter than the marching-ants selection ring, so hover and
   * selection stay visually distinct.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Center X coordinate
   * @param {number} y - Center Y coordinate
   * @param {number} radius - Circle radius
   */
  drawHoverRing(ctx, x, y, radius) {
    const f = this._zoomClampFactor;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 4 * f;
    ctx.stroke();
    ctx.strokeStyle = RENDERING.HOVER_ACCENT_COLOR;
    ctx.lineWidth = 2 * f;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Resolve hovered-leg polyline span and validate the hover against
   * current data (route edits can leave a stale hover until the next
   * mousemove re-tests). Returns null when the hover no longer applies.
   * @param {Object} state - Render state
   * @returns {{a: number, b: number, legIndex: number}|null} Point span
   * @private
   */
  _hoverLegSpan(state) {
    const { hover, waypoints, pathPoints, waypointProgressValues } = state;
    const legIndex = hover?.waypointIndex;
    if (typeof legIndex !== 'number' || legIndex < 0 || legIndex >= waypoints.length - 1) return null;
    if (waypoints[legIndex] !== hover.waypoint) return null;
    if (!pathPoints || pathPoints.length < 2) return null;

    const totalPoints = pathPoints.length;
    const segments = waypoints.length - 1;
    const wpIndices = (waypointProgressValues && waypointProgressValues.length === waypoints.length)
      ? waypointPointIndices(waypointProgressValues, totalPoints)
      : waypoints.map((_, i) => Math.round((i / segments) * (totalPoints - 1)));
    const a = wpIndices[legIndex];
    const b = wpIndices[legIndex + 1];
    if (!(b > a)) return null;
    return { a, b, legIndex, wpIndices };
  }

  /**
   * Glow underlay along the hovered leg (drawn beneath the path so the
   * route reads as highlighted, not repainted). The leg span matches the
   * inspector's Leg card: waypoint i → waypoint i+1.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} state - Render state
   */
  renderLegHover(ctx, state) {
    const span = this._hoverLegSpan(state);
    if (!span) return;
    const { waypoints, pathPoints, styles, imageToCanvas } = state;

    // Width follows the leg's rendered thickness: styled by the last
    // major at or before the leg (same rule as renderPath)
    let controllerIdx = -1;
    for (let s = 0; s <= span.legIndex; s++) {
      if (waypoints[s].isMajor) controllerIdx = s;
    }
    const baseWidth = this.scaleSizeClamped(
      controllerIdx >= 0 ? waypoints[controllerIdx].segmentWidth : styles.pathThickness
    );
    const f = this._zoomClampFactor * this._graphicsScale;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const start = imageToCanvas(pathPoints[span.a].x, pathPoints[span.a].y);
    ctx.moveTo(start.x, start.y);
    for (let i = span.a + 1; i <= span.b; i++) {
      const p = imageToCanvas(pathPoints[i].x, pathPoints[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = baseWidth + 9 * f;
    ctx.stroke();
    ctx.strokeStyle = RENDERING.HOVER_ACCENT_GLOW;
    ctx.lineWidth = baseWidth + 4 * f;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Hover affordances above the markers: hover ring on waypoints and
   * area handles, and the midpoint "+" insert handle on the hovered leg.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} state - Render state
   */
  renderHoverAffordances(ctx, state) {
    const { hover, waypoints, styles, imageToCanvas, selectedWaypoint } = state;

    if (hover.type === 'waypoint') {
      const wp = hover.waypoint;
      // Selection already draws its own ring; stale hovers are skipped
      if (!wp || wp === selectedWaypoint || !waypoints.includes(wp)) return;
      const rawSize = wp.isMajor
        ? (wp.dotSize || styles.dotSize)
        : (styles.minorDotSize || RENDERING.MINOR_DOT_SIZE);
      const size = this.scaleSizeClamped(rawSize);
      const pos = imageToCanvas(wp.imgX, wp.imgY);
      this.drawHoverRing(ctx, pos.x, pos.y, size + 6 * this._zoomClampFactor);
      return;
    }

    if (hover.type === 'area-handle') {
      const wp = hover.waypoint;
      if (!wp || wp !== selectedWaypoint || !wp.hasAreaHighlight?.()) return;
      const ah = wp.areaHighlight;
      let imgPos = null;
      if (hover.handle?.type === 'center') {
        imgPos = { x: ah.centerX, y: ah.centerY };
      } else if (hover.handle?.type === 'vertex' && ah.points?.[hover.handle.vertexIndex]) {
        imgPos = ah.points[hover.handle.vertexIndex];
      }
      if (!imgPos) return;
      const pos = imageToCanvas(imgPos.x, imgPos.y);
      this.drawHoverRing(ctx, pos.x, pos.y, 10 * this._zoomClampFactor);
      return;
    }

    if (hover.type === 'leg' || hover.type === 'leg-plus') {
      const span = this._hoverLegSpan(state);
      if (!span) return;
      const midIdx = legMidpointIndex(span.wpIndices, span.legIndex);
      const midImg = state.pathPoints[midIdx];
      if (!midImg) return;
      const pos = imageToCanvas(midImg.x, midImg.y);
      const active = hover.type === 'leg-plus';
      const f = this._zoomClampFactor;
      const r = (active ? 11 : 9) * f;

      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = active ? RENDERING.HOVER_ACCENT_COLOR : 'rgba(255, 255, 255, 0.95)';
      ctx.fill();
      ctx.strokeStyle = active ? '#ffffff' : RENDERING.HOVER_ACCENT_COLOR;
      ctx.lineWidth = 1.5 * f;
      ctx.stroke();
      // The plus sign
      const arm = r * 0.5;
      ctx.beginPath();
      ctx.moveTo(pos.x - arm, pos.y);
      ctx.lineTo(pos.x + arm, pos.y);
      ctx.moveTo(pos.x, pos.y - arm);
      ctx.lineTo(pos.x, pos.y + arm);
      ctx.strokeStyle = active ? '#ffffff' : RENDERING.HOVER_ACCENT_COLOR;
      ctx.lineWidth = 2 * f;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Main render method - orchestrates all rendering layers
   *
   * Applies viewport zoom/pan transform to background and vector layers.
   * In preview mode, applies motion visibility settings.
   */
  render(ctx, displayWidth, displayHeight, state) {
    const cw = displayWidth || ctx.canvas.width;
    const ch = displayHeight || ctx.canvas.height;
    
    // Safety check - ensure canvas has valid dimensions
    if (cw <= 0 || ch <= 0) {
      console.warn('Cannot render to canvas with invalid dimensions:', { width: cw, height: ch });
      return; // Skip rendering
    }
    
    // Store coordinate transform for relative sizing (used by scaleSize helper)
    this._coordinateTransform = state.coordinateTransform || null;
    
    // Extract motion visibility state
    const { previewMode, motionSettings, motionVisibilityService } = state;
    const applyMotion = previewMode && motionSettings;
    
    // Clear
    ctx.clearRect(0, 0, cw, ch);
    
    // Apply zoom/pan transform for background
    const viewport = state.viewport;
    const hasZoom = viewport && viewport.zoom > 1;
    if (hasZoom) {
      ctx.save();
      ctx.scale(viewport.zoom, viewport.zoom);
      ctx.translate(-viewport.panX, -viewport.panY);
    }
    
    // Determine background rendering mode
    const bgMode = applyMotion ? motionSettings.backgroundVisibility : BACKGROUND_VISIBILITY.ALWAYS_SHOW;
    const hasPath = state.pathPoints?.length > 0;
    
    if (bgMode === BACKGROUND_VISIBILITY.ALWAYS_HIDE) {
      // Hide mode: don't render background at all
    } else if (bgMode === BACKGROUND_VISIBILITY.SPOTLIGHT && hasPath && motionVisibilityService) {
      // Spotlight: instant circular mask at head position (resets each frame)
      // Path points are in normalized coords, transform to canvas coords for rendering
      const headPosNorm = this.getHeadPosition(state.pathPoints, state.animationEngine);
      if (headPosNorm && state.imageToCanvas) {
        const headPos = state.imageToCanvas(headPosNorm.x, headPosNorm.y);
        const currentTimeMs = state.animationEngine.getTime();
        this.renderBackgroundWithSpotlight(ctx, state.background, cw, ch, headPos, motionSettings, currentTimeMs);
      }
    } else if (bgMode === BACKGROUND_VISIBILITY.SPOTLIGHT_REVEAL && hasPath && motionVisibilityService) {
      // Spotlight Reveal: path-based mask rebuilt each frame for bidirectional scrubbing
      // Pass imageToCanvas for coordinate transformation and current time for intro animation
      const progress = state.animationEngine.getPathProgress();
      const currentTimeMs = state.animationEngine.getTime();
      motionVisibilityService.buildSpotlightRevealMask(state.pathPoints, progress, cw, ch, motionSettings, state.imageToCanvas, currentTimeMs);
      this.renderBackgroundWithReveal(ctx, state.background, cw, ch, motionVisibilityService, state.cameraState);
    } else if (bgMode === BACKGROUND_VISIBILITY.ANGLE_OF_VIEW && hasPath && motionVisibilityService) {
      // Angle of View: instant cone mask at head position (resets each frame)
      // Path points are in normalized coords, transform to canvas coords for rendering
      const headPosNorm = this.getHeadPosition(state.pathPoints, state.animationEngine);
      const direction = this.getHeadDirection(state.pathPoints, state.animationEngine, state.waypointProgressValues, state.waypoints, cw, ch, state.imageToCanvas);
      if (headPosNorm && direction !== null && state.imageToCanvas) {
        const headPos = state.imageToCanvas(headPosNorm.x, headPosNorm.y);
        const currentTimeMs = state.animationEngine.getTime();
        this.renderBackgroundWithAOV(ctx, state.background, cw, ch, headPos, direction, motionSettings, currentTimeMs);
      }
    } else if (bgMode === BACKGROUND_VISIBILITY.ANGLE_OF_VIEW_REVEAL && hasPath && motionVisibilityService) {
      // Angle of View Reveal: path-based mask rebuilt each frame for bidirectional scrubbing
      // Pass imageToCanvas for coordinate transformation and current time for intro animation
      const progress = state.animationEngine.getPathProgress();
      const currentTimeMs = state.animationEngine.getTime();
      motionVisibilityService.buildAOVRevealMask(
        state.pathPoints, progress, cw, ch, motionSettings,
        state.waypoints, state.waypointProgressValues, state.animationEngine, state.imageToCanvas, currentTimeMs
      );
      this.renderBackgroundWithReveal(ctx, state.background, cw, ch, motionVisibilityService, state.cameraState);
      
      // DEBUG: Draw background mode info on main canvas for visualization
      motionVisibilityService.drawDebugOverlay(ctx, motionSettings);
    } else {
      // Always Show (default): render background normally
      // Pass camera state for zoom/pan effect centered on path head
      this.renderBackground(ctx, state.background, cw, ch, state.cameraState);
    }
    
    // 2) Contrast overlay (in zoomed space) - only affects image area
    this.renderOverlay(ctx, state.background.overlay, cw, ch, state.background);
    
    if (hasZoom) {
      ctx.restore();
    }
    
    // 3-6) Vector + head + UI handles on offscreen canvas
    //
    // Vectors are resolution-independent (Canvas2D path/stroke operations).
    // To keep them crisp when zoomed, the viewport or camera transform is
    // applied to the *vector canvas context* before drawing, so vectors are
    // rasterized at full display resolution for the visible viewport area.
    // The offscreen canvas is then composited 1:1 (no scaling) onto the
    // main canvas.  This costs zero additional memory — the canvas stays at
    // displayWidth × dpr — and vectors outside the viewport are automatically
    // clipped by Canvas2D.
    
    const vCanvas = this.getVectorCanvas(displayWidth, displayHeight, state.pixelScale);
    
    // Safety check for vector canvas
    if (vCanvas.width <= 0 || vCanvas.height <= 0) {
      console.warn('Vector canvas has invalid dimensions:', { width: vCanvas.width, height: vCanvas.height });
      return; // Skip drawing vector layer
    }
    
    const vctx = vCanvas.getContext('2d');
    const clearWidth = this.vectorCanvasCssWidth || vCanvas.width;
    const clearHeight = this.vectorCanvasCssHeight || vCanvas.height;
    vctx.clearRect(0, 0, clearWidth, clearHeight);
    
    // Determine which spatial transform to apply to the vector context.
    // Priority: user viewport zoom > animation camera zoom > identity.
    const cameraState = state.cameraState;
    const hasCamera = !hasZoom && cameraState && cameraState.enabled && Math.abs(cameraState.zoom - 1) > 0.001;
    
    // Apply transform to vctx so vectors are rasterized at zoomed resolution
    if (hasZoom) {
      vctx.save();
      vctx.scale(viewport.zoom, viewport.zoom);
      vctx.translate(-viewport.panX, -viewport.panY);
    } else if (hasCamera) {
      vctx.save();
      const zoom = cameraState.zoom;
      const cx = cameraState.centerX;
      const cy = cameraState.centerY;
      vctx.translate(cw / 2, ch / 2);
      vctx.scale(zoom, zoom);
      vctx.translate(-cx, -cy);
    }
    
    this.renderVectorLayerTo(vctx, state);
    
    // Restore vector context transform
    if (hasZoom || hasCamera) {
      vctx.restore();
    }
    
    // Composite vector layer 1:1 onto main canvas (no scaling — already
    // rasterized at the correct resolution for the current viewport)
    if (vCanvas.width > 0 && vCanvas.height > 0) {
      const drawWidth = this.vectorCanvasCssWidth || vCanvas.width;
      const drawHeight = this.vectorCanvasCssHeight || vCanvas.height;
      ctx.drawImage(vCanvas, 0, 0, drawWidth, drawHeight);
    }
  }

  /**
   * Get current head position from path points and animation state
   * Uses sub-pixel interpolation for smooth positioning
   * 
   * @private
   * @param {Array<{x: number, y: number}>} pathPoints - Array of path points
   * @param {AnimationEngine} animationEngine - Animation engine for progress
   * @returns {{x: number, y: number}|null} Interpolated head position or null
   */
  getHeadPosition(pathPoints, animationEngine) {
    if (!pathPoints || pathPoints.length === 0) return null;
    
    const progress = animationEngine.getPathProgress();
    const totalPoints = pathPoints.length;
    const exactPosition = totalPoints * progress;
    const pointIndex = Math.min(Math.floor(exactPosition), totalPoints - 1);
    const fraction = exactPosition - pointIndex;
    
    if (pointIndex >= totalPoints - 1) {
      return pathPoints[totalPoints - 1];
    }
    
    const p1 = pathPoints[pointIndex];
    const p2 = pathPoints[Math.min(pointIndex + 1, totalPoints - 1)];
    
    return {
      x: p1.x + (p2.x - p1.x) * fraction,
      y: p1.y + (p2.y - p1.y) * fraction
    };
  }

  /**
   * Get the direction angle at the current head position (in radians)
   * Uses backward-looking direction (where we came from) so the cone
   * points in the direction of travel, not ahead of it.
   * 
   * During waypoint pauses, maintains the incoming direction until
   * the pause completes and movement resumes. Uses waypoint positions
   * (not path points) to calculate direction at waypoints for accuracy.
   * 
   * @param {Array} pathPoints - Array of path points in normalized coords (0-1)
   * @param {AnimationEngine} animationEngine - Animation engine for progress
   * @param {Array} waypointProgressValues - Optional array of waypoint progress values
   * @param {Array} waypoints - Optional array of waypoint objects with imgX,imgY positions
   * @param {number} canvasWidth - Canvas width (unused, kept for compatibility)
   * @param {number} canvasHeight - Canvas height (unused, kept for compatibility)
   * @param {Function} imageToCanvas - Coordinate transform function (imgX, imgY) => {x, y}
   * @returns {number|null} Direction angle in radians, or null if unavailable
   */
  getHeadDirection(pathPoints, animationEngine, waypointProgressValues = null, waypoints = null, canvasWidth = 1, canvasHeight = 1, imageToCanvas = null) {
    if (!pathPoints || pathPoints.length < 2) return null;
    
    const progress = animationEngine.getPathProgress();
    const totalPoints = pathPoints.length;
    const exactPosition = totalPoints * progress;
    const pointIndex = Math.min(Math.floor(exactPosition), totalPoints - 1);
    const fraction = exactPosition - pointIndex;
    
    // Check if we're waiting at a waypoint
    const isWaiting = animationEngine.state?.isWaitingAtWaypoint;
    const pauseWaypointIndex = animationEngine.state?.pauseWaypointIndex ?? -1;
    
    // Helper to get waypoint canvas coordinates (waypoints use imgX/imgY normalized 0-1)
    // Uses imageToCanvas for proper coordinate transformation
    const getWpPos = (wp) => {
      if (imageToCanvas) {
        return imageToCanvas(wp.imgX, wp.imgY);
      }
      // Fallback to simple scaling (for backward compatibility)
      return { x: wp.imgX * canvasWidth, y: wp.imgY * canvasHeight };
    };
    
    // Helper to transform path point to canvas coords
    const getPathPos = (pt) => {
      if (imageToCanvas) {
        return imageToCanvas(pt.x, pt.y);
      }
      return pt;
    };
    
    // If waiting at a waypoint, use direction from previous waypoint to current waypoint
    // This prevents the cone from turning before the pause completes
    if (isWaiting && pauseWaypointIndex >= 0 && waypoints && waypoints.length > 1) {
      if (pauseWaypointIndex > 0) {
        const prevWp = getWpPos(waypoints[pauseWaypointIndex - 1]);
        const currWp = getWpPos(waypoints[pauseWaypointIndex]);
        return Math.atan2(currWp.y - prevWp.y, currWp.x - prevWp.x);
      } else {
        // First waypoint - use direction to next waypoint
        const currWp = getWpPos(waypoints[0]);
        const nextWp = getWpPos(waypoints[1]);
        return Math.atan2(nextWp.y - currWp.y, nextWp.x - currWp.x);
      }
    }
    
    // Use shared constants from MotionVisibilityService
    const { APPROACH_THRESHOLD, SMOOTHING_LOOKBACK, DEPARTURE_THRESHOLD } = MotionVisibilityService.AOV_DIRECTION;
    
    // Helper to blend two angles smoothly (handles wraparound at ±PI)
    const blendAngles = (angle1, angle2, t) => {
      const normalize = (a) => {
        while (a > Math.PI) a -= 2 * Math.PI;
        while (a < -Math.PI) a += 2 * Math.PI;
        return a;
      };
      const a1 = normalize(angle1);
      const a2 = normalize(angle2);
      let diff = a2 - a1;
      if (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff < -Math.PI) diff += 2 * Math.PI;
      return normalize(a1 + diff * t);
    };
    
    // Helper to get raw path direction (uses canvas coords for accurate angle calculation)
    // Uses a small lookback (3-5 points) for responsive direction following on squiggle paths
    const getRawPathDir = () => {
      if (pointIndex <= 0) {
        const p1 = getPathPos(pathPoints[0]);
        const p2 = getPathPos(pathPoints[Math.min(1, totalPoints - 1)]);
        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
      }
      // Use immediate tangent for responsive direction (small lookback of 3 points)
      // This allows the head to follow squiggle curves properly
      const immediateLookback = 3;
      const p1Raw = pathPoints[pointIndex];
      const p2Raw = pathPoints[Math.min(pointIndex + 1, totalPoints - 1)];
      const currentNorm = {
        x: p1Raw.x + (p2Raw.x - p1Raw.x) * fraction,
        y: p1Raw.y + (p2Raw.y - p1Raw.y) * fraction
      };
      const current = getPathPos(currentNorm);
      const lookbackIndex = Math.max(0, pointIndex - immediateLookback);
      const lookbackPt = getPathPos(pathPoints[lookbackIndex]);
      return Math.atan2(current.y - lookbackPt.y, current.x - lookbackPt.x);
    };
    
    // Check if we're APPROACHING or DEPARTING a waypoint
    if (waypointProgressValues && waypointProgressValues.length > 0 && waypoints && waypoints.length > 1) {
      for (let i = 0; i < waypointProgressValues.length; i++) {
        const wpProgress = waypointProgressValues[i];
        
        // Approaching waypoint (within threshold and not past it)
        if (progress >= wpProgress - APPROACH_THRESHOLD && progress <= wpProgress + 0.001) {
          if (i > 0) {
            const prevWp = getWpPos(waypoints[i - 1]);
            const currWp = getWpPos(waypoints[i]);
            return Math.atan2(currWp.y - prevWp.y, currWp.x - prevWp.x);
          }
          break;
        }
        
        // Departing waypoint (in transition zone after waypoint)
        if (progress > wpProgress && progress <= wpProgress + DEPARTURE_THRESHOLD) {
          if (i > 0) {
            const prevWp = getWpPos(waypoints[i - 1]);
            const currWp = getWpPos(waypoints[i]);
            const wpDir = Math.atan2(currWp.y - prevWp.y, currWp.x - prevWp.x);
            const pathDir = getRawPathDir();
            // Blend from waypoint direction to path direction
            const departureProgress = (progress - wpProgress) / DEPARTURE_THRESHOLD;
            const blendFactor = 1.0 - departureProgress;
            return blendAngles(pathDir, wpDir, blendFactor);
          }
          break;
        }
      }
    }
    
    return getRawPathDir();
  }

  /**
   * Render background with angle-of-view cone effect (non-persistent)
   * Creates a triangular cone pointing in the direction of travel
   * 
   * @private
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} background - Background state object
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {{x: number, y: number}} headPos - Current head position (cone vertex)
   * @param {number} direction - Direction angle in radians
   * @param {Object} settings - Motion settings with aovAngle, aovDistance, aovDropoff
   * @param {number} currentTimeMs - Current animation time in milliseconds (for intro animation)
   */
  renderBackgroundWithAOV(ctx, background, canvasWidth, canvasHeight, headPos, direction, settings, currentTimeMs = Infinity) {
    if (!background.image) return;
    
    // Apply intro animation scale
    const introScale = this.getIntroScale(currentTimeMs);
    
    const { aovAngle, aovDistance } = settings;
    // Default aovDropoff to 50% if null/undefined/NaN
    const aovDropoff = (settings.aovDropoff == null || isNaN(settings.aovDropoff)) ? 50 : settings.aovDropoff;
    
    // Distance is % of canvas diagonal, scaled by intro animation
    const diagonal = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
    const baseDistance = (aovDistance / 100) * diagonal;
    const distance = baseDistance * introScale;
    const halfAngleRad = (aovAngle / 2) * (Math.PI / 180);
    
    // Dropoff behavior (continuous gradient):
    // 0% = hard edge (no gradient)
    // 50% = gradient starts halfway from tip to base
    // 100% = full gradient from tip to base
    // The dropoff percentage determines where the gradient starts (as fraction from tip)
    const dropoffFraction = aovDropoff / 100;
    const solidStop = 1 - dropoffFraction; // Where solid white ends
    
    ctx.save();
    
    // Draw background first
    this.renderBackground(ctx, background, canvasWidth, canvasHeight);
    
    // Create cone mask using destination-in
    ctx.globalCompositeOperation = 'destination-in';
    
    // Calculate cone points
    const tipX = headPos.x;
    const tipY = headPos.y;
    
    // Use arc for smooth outer edge
    const startAngle = direction - halfAngleRad;
    const endAngle = direction + halfAngleRad;
    
    if (dropoffFraction <= 0) {
      // Hard edge - solid white, no gradient
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    } else {
      // Radial gradient from tip
      const gradient = ctx.createRadialGradient(
        tipX, tipY, 0,
        tipX, tipY, distance
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      if (solidStop > 0) {
        gradient.addColorStop(solidStop, 'rgba(255, 255, 255, 1)');
      }
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
    }
    
    // Draw pie slice with arc for smooth outer edge
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.arc(tipX, tipY, distance, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }

  /**
   * Render background with instant spotlight effect (non-persistent)
   * Creates a circular reveal at the current head position only
   * 
   * @private
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} background - Background state object
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {{x: number, y: number}} headPos - Current head position
   * @param {Object} settings - Motion settings with revealSize and revealFeather
   * @param {number} currentTimeMs - Current animation time in milliseconds (for intro animation)
   */
  renderBackgroundWithSpotlight(ctx, background, canvasWidth, canvasHeight, headPos, settings, currentTimeMs = Infinity) {
    if (!background.image) return;
    
    // Import intro scale calculation from MotionVisibilityService
    const introScale = this.getIntroScale(currentTimeMs);
    
    const { revealSize, revealFeather } = settings;
    const avgSize = (canvasWidth + canvasHeight) / 2;
    const baseRadius = (revealSize / 100) * avgSize;
    const radius = baseRadius * introScale; // Scale from 0 to full during intro
    // Feather is % of spotlight radius, not canvas
    const feather = (revealFeather / 100) * radius;
    const innerRadius = Math.max(0, radius - feather);
    
    ctx.save();
    
    // Draw background first
    this.renderBackground(ctx, background, canvasWidth, canvasHeight);
    
    // Create spotlight mask using destination-in with radial gradient
    ctx.globalCompositeOperation = 'destination-in';
    
    // Create radial gradient for feathered edge
    const gradient = ctx.createRadialGradient(
      headPos.x, headPos.y, innerRadius,
      headPos.x, headPos.y, radius
    );
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(headPos.x, headPos.y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  /**
   * Render background with reveal mask applied (persistent accumulation)
   * 
   * Camera transform is applied to both background and mask so they scale together.
   * The mask is built in canvas coordinates, so the same camera transform that
   * zooms the background must also be applied when drawing the mask.
   * 
   * @private
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} background - Background object with image
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {Object} motionVisibilityService - Service with reveal mask
   * @param {Object} cameraState - Optional camera state {zoom, centerX, centerY, enabled}
   */
  renderBackgroundWithReveal(ctx, background, canvasWidth, canvasHeight, motionVisibilityService, cameraState = null) {
    if (!background.image) return;
    
    const revealMask = motionVisibilityService.getRevealMask();
    if (!revealMask) {
      // No mask yet, render nothing (fully masked)
      return;
    }
    
    const cw = canvasWidth;
    const ch = canvasHeight;
    const hasCamera = cameraState && cameraState.enabled && Math.abs(cameraState.zoom - 1) > 0.001;
    
    // Save context state
    ctx.save();
    
    // Draw background with camera transform
    this.renderBackground(ctx, background, canvasWidth, canvasHeight, cameraState);
    
    // Apply reveal mask using destination-in composite
    // This keeps only the parts of the background where the mask is white
    ctx.globalCompositeOperation = 'destination-in';
    
    // Apply same camera transform to mask so it scales with background
    if (hasCamera) {
      const zoom = cameraState.zoom;
      const cx = cameraState.centerX;
      const cy = cameraState.centerY;
      
      // Same transform as background: center on canvas, scale, offset to camera center
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);
    }
    
    ctx.drawImage(revealMask, 0, 0, canvasWidth, canvasHeight);
    
    // Restore context
    ctx.restore();
  }

  /**
   * Get or create offscreen canvas for vector layer.
   * @param {number} displayWidth  - CSS-pixel width
   * @param {number} displayHeight - CSS-pixel height
   * @param {number} [pixelScale]  - Backing-store multiplier (default: devicePixelRatio, capped at 3).
   *                                  Pass 1 during export to match the identity-transform main canvas.
   * @returns {HTMLCanvasElement}
   */
  getVectorCanvas(displayWidth, displayHeight, pixelScale) {
    if (!this.vectorCanvas) {
      this.vectorCanvas = document.createElement('canvas');
    }
    
    const cssWidth = Math.max(displayWidth || 100, 1);
    const cssHeight = Math.max(displayHeight || 100, 1);
    const dpr = pixelScale != null ? pixelScale : (window.devicePixelRatio || 1);
    const scale = Math.min(dpr, 3);
    const pixelWidth = Math.round(cssWidth * scale);
    const pixelHeight = Math.round(cssHeight * scale);
    const needsResize =
      this.vectorCanvas.width !== pixelWidth ||
      this.vectorCanvas.height !== pixelHeight ||
      this.vectorCanvasScale !== scale;
    
    if (needsResize) {
      console.debug('Resizing vector canvas to:', cssWidth, 'x', cssHeight, 'at', scale + 'x scale');
      this.vectorCanvas.width = pixelWidth;
      this.vectorCanvas.height = pixelHeight;
      this.vectorCanvasScale = scale;
      this.vectorCanvasCssWidth = cssWidth;
      this.vectorCanvasCssHeight = cssHeight;
      
      const vctx = this.vectorCanvas.getContext('2d');
      if (vctx) {
        vctx.setTransform(1, 0, 0, 1, 0, 0);
        vctx.scale(scale, scale);
        // Note: imageSmoothingEnabled removed - smooth animation now achieved via
        // sub-pixel interpolation in path head rendering (main.js), not canvas smoothing
      }
    }
    
    // Ensure callers can rely on CSS-sized dimensions even if resize wasn't needed
    if (!needsResize && (!this.vectorCanvasCssWidth || !this.vectorCanvasCssHeight)) {
      this.vectorCanvasCssWidth = cssWidth;
      this.vectorCanvasCssHeight = cssHeight;
    }
    
    return this.vectorCanvas;
  }
  
  /**
   * Render background image with "contain" mode (letterboxing)
   * Supports optional camera transform for zoom/pan effects
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} background - Background object with image
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {Object} cameraState - Optional camera state {zoom, centerX, centerY, enabled}
   */
  renderBackground(ctx, background, canvasWidth, canvasHeight, cameraState = null) {
    if (!background.image) return;
    
    const img = background.image;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const cw = canvasWidth;
    const ch = canvasHeight;
    
    // Fill background with white for letterbox margins
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    
    // Apply background zoom (from export settings slider)
    // zoom = 1.0 means 100% (no zoom), zoom = 2.0 means 200% (2x zoom)
    const bgZoom = background.zoom || 1;
    
    // Use "contain" mode: full image visible, letterboxed if needed
    // scale = min() ensures the entire image fits within canvas
    // Then apply background zoom on top
    const baseScale = Math.min(cw / iw, ch / ih) * bgZoom;
    const drawW = iw * baseScale;
    const drawH = ih * baseScale;
    const offsetX = (cw - drawW) / 2;
    const offsetY = (ch - drawH) / 2;
    
    // Apply camera transform if zoom is not 1x (with small epsilon for float comparison)
    if (cameraState && cameraState.enabled && Math.abs(cameraState.zoom - 1) > 0.001) {
      ctx.save();
      
      // Camera centers on centerX, centerY (in canvas coords)
      // Transform: translate to center, scale, translate back offset by center point
      const zoom = cameraState.zoom;
      const cx = cameraState.centerX;
      const cy = cameraState.centerY;
      
      // Move origin to canvas center, scale, then offset so camera center is at canvas center
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);
      
      // Draw full image centered with letterboxing
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      
      ctx.restore();
    } else {
      // No camera transform - draw normally
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    }
  }
  
  /**
   * Render overlay for contrast adjustment
   * Only affects the image area, not letterbox regions
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} overlayValue - Tint value (-100 to 100)
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {Object} background - Background object with image and fit mode
   */
  renderOverlay(ctx, overlayValue, canvasWidth, canvasHeight, background) {
    if (overlayValue === 0) return;
    if (!background?.image) return;
    
    // Calculate image bounds based on fit mode
    const img = background.image;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    
    let dx = 0, dy = 0, dw = canvasWidth, dh = canvasHeight;
    
    if (background.fit === 'fit') {
      // Fit mode: image is letterboxed, calculate actual bounds
      const scale = Math.min(canvasWidth / iw, canvasHeight / ih);
      dw = Math.round(iw * scale);
      dh = Math.round(ih * scale);
      dx = Math.floor((canvasWidth - dw) / 2);
      dy = Math.floor((canvasHeight - dh) / 2);
    }
    // Fill mode: image covers entire canvas, no change needed
    
    ctx.save();
    ctx.globalAlpha = Math.min(Math.abs(overlayValue) / 100, 0.6);
    ctx.fillStyle = overlayValue < 0 ? '#000' : '#fff';
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
  }

  /**
   * Vector-layer draw order, bottom → top.
   *
   * Formalises the draw sequence that used to be hard-coded in
   * renderVectorLayerTo(): a new scene layer (e.g. the Phase 2 flow-layer
   * swarms, which sit beneath the hero route) is added by inserting an
   * entry here rather than editing the render body. Each entry guards its
   * own visibility; `frame` carries per-frame derivations shared between
   * layers so entries stay independent of one another.
   */
  static VECTOR_LAYERS = [
    {
      // Area highlights (below path, above background/overlay)
      name: 'area-highlights',
      draw(svc, ctx, state, frame) {
        const { waypoints, imageToCanvas, displayWidth, displayHeight } = state;
        if (state.previewMode) {
          AreaHighlightRenderer.render(ctx, waypoints, imageToCanvas, state.animationEngine, state.waypointProgressValues, state.motionSettings, displayWidth, displayHeight, state.previewMode);
        } else {
          AreaHighlightRenderer.renderEditMode(ctx, waypoints, imageToCanvas, displayWidth, displayHeight, state.selectedWaypoint);
        }
      },
    },
    {
      // Flow-layer swarms (Phase 3) — beneath the hero route, above area
      // highlights. Scene order: layer index 0 draws bottom-most.
      name: 'flow-layers',
      draw(svc, ctx, state, frame) {
        if (!state.scene || !state.swarmEngine || !state.animationEngine) return;
        const layers = state.scene.getFlowLayers();
        if (layers.length === 0) return;
        const durationMs = state.animationEngine.state.duration;
        if (!(durationMs > 0)) return;
        const timelineMs = state.animationEngine.getTime();
        for (const layer of layers) {
          if (!layer.visible) continue;
          const dots = state.swarmEngine.evaluate(timelineMs, layer, {
            durationMs,
            routePathPoints: state.pathPoints,
          });
          DotRenderer.render(ctx, dots, state.imageToCanvas, svc);
        }
      },
    },
    {
      // Hovered-leg glow underlay (Phase 4 canvas affordances) — beneath
      // the path so the route reads as highlighted, not repainted
      name: 'leg-hover',
      draw(svc, ctx, state, frame) {
        if (state.previewMode || !frame.hasPath) return;
        if (state.hover?.type !== 'leg' && state.hover?.type !== 'leg-plus') return;
        svc.renderLegHover(ctx, state);
      },
    },
    {
      // The hero route
      name: 'path',
      draw(svc, ctx, state, frame) {
        if (!frame.hasPath || !frame.shouldRenderPath) return;
        svc.renderPath(ctx, state.pathPoints, state.waypoints, state.styles, state.animationEngine, frame.applyMotion ? state.motionSettings : null, state.motionVisibilityService, state.waypointProgressValues, state.imageToCanvas);
      },
    },
    {
      // Path head follows the same visibility rule as the path.
      // Waypoint info is passed for proper rotation timing (rotate AFTER pause, not during)
      name: 'path-head',
      draw(svc, ctx, state, frame) {
        if (!frame.hasPath || !frame.shouldRenderPath) return;
        svc.renderPathHead(ctx, state.pathPoints, state.styles, state.animationEngine, state.imageToCanvas, state.waypointProgressValues, state.waypoints);
      },
    },
    {
      // Beacons (only in edit mode or if waypoints are visible)
      name: 'beacons',
      draw(svc, ctx, state, frame) {
        const shouldRenderBeacons = !frame.applyMotion ||
                                     state.motionSettings.waypointVisibility !== WAYPOINT_VISIBILITY.ALWAYS_HIDE;
        if (!shouldRenderBeacons) return;
        svc.renderBeacons(ctx, state.waypoints, state.animationEngine, state.beaconAnimation, state.imageToCanvas, state.styles,
                          frame.applyMotion ? state.motionSettings : null, state.waypointProgressValues);
      },
    },
    {
      // Waypoint markers (waypointProgressValues gives accurate animation timing)
      name: 'waypoints',
      draw(svc, ctx, state, frame) {
        svc.renderWaypoints(ctx, state.waypoints, state.selectedWaypoint, state.styles, state.imageToCanvas, state.displayWidth, state.displayHeight,
                            frame.applyMotion ? state.motionSettings : null, state.motionVisibilityService, state.animationEngine,
                            state.waypointProgressValues, state.suppressLabels);
      },
    },
    {
      // Area edit handles in edit mode (selected waypoint only)
      name: 'area-edit-handles',
      draw(svc, ctx, state, frame) {
        if (state.previewMode || !state.selectedWaypoint || !state.areaEditService) return;
        state.areaEditService.renderHandles(ctx, state.selectedWaypoint, state.imageToCanvas, state.displayWidth, state.displayHeight);
      },
    },
    {
      // Hover rings (waypoints, area handles) + the leg midpoint "+"
      // insert handle (Phase 4 canvas affordances, edit mode only)
      name: 'hover-affordances',
      draw(svc, ctx, state, frame) {
        if (state.previewMode || !state.hover) return;
        svc.renderHoverAffordances(ctx, state);
      },
    },
    {
      // Polygon draw preview (on top of everything in the vector layer)
      name: 'area-draw-preview',
      draw(svc, ctx, state, frame) {
        if (!state.areaDrawingService?.isDrawing) return;
        state.areaDrawingService.renderPreview(ctx, state.imageToCanvas);
      },
    },
  ];

  /**
   * Render complete vector layer (paths, waypoints, labels)
   *
   * The caller applies the viewport or camera transform to the canvas context
   * before invoking this method, so all vector drawing is rasterized at the
   * zoomed resolution.  This keeps vectors crisp at any zoom level without
   * additional memory — the offscreen canvas stays at displayWidth × dpr.
   *
   * In preview mode, applies motion visibility settings for path and waypoints.
   * Draw order is data-driven: see RenderingService.VECTOR_LAYERS above.
   */
  renderVectorLayerTo(ctx, state) {
    const applyMotion = state.previewMode && state.motionSettings;

    // Compute zoom clamp factor once per frame for all vector-layer elements
    const viewportZoom = state.viewport?.zoom || 1;
    this._zoomClampFactor = viewportZoom > 3 ? 3 / viewportZoom : 1;

    // Per-frame derivations shared across layers
    const frame = {
      applyMotion,
      hasPath: state.pathPoints.length > 0 && state.waypoints.length > 1,
      // In preview mode, honour the path visibility setting
      shouldRenderPath: !applyMotion ||
                        state.motionSettings.pathVisibility !== PATH_VISIBILITY.ALWAYS_HIDE,
    };

    for (const layer of RenderingService.VECTOR_LAYERS) {
      layer.draw(this, ctx, state, frame);
    }
  }
  
  /**
   * Render the animated path
   * Uses pathProgress (position along path) not timeline progress
   * 
   * In preview mode with motion settings:
   * - ALWAYS_SHOW: Full path visible
   * - SHOW_ON_PROGRESSION: Path from start to current position (default)
   * - HIDE_ON_PROGRESSION: Full path, fades behind head
   * - INSTANTANEOUS: Only trail segment visible
   * - ALWAYS_HIDE: No path (handled by caller)
   * 
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array} pathPoints
   * @param {Array} waypoints
   * @param {Object} styles
   * @param {AnimationEngine} animationEngine
   * @param {Object|null} motionSettings - Motion settings (null = edit mode, show all)
   * @param {MotionVisibilityService|null} motionVisibilityService
   * @param {Array|null} waypointProgressValues - Pre-calculated waypoint progress values (0-1)
   * @param {Function} imageToCanvas - Coordinate transform function (imgX, imgY) => {x, y}
   */
  renderPath(ctx, pathPoints, waypoints, styles, animationEngine, motionSettings = null, motionVisibilityService = null, waypointProgressValues = null, imageToCanvas = null) {
    const totalPoints = pathPoints.length;
    // Use pathProgress for rendering - stays fixed during pauses
    const progress = animationEngine.getPathProgress();
    
    const exactPosition = totalPoints * progress;
    const fraction = exactPosition - Math.floor(exactPosition); // Fractional part for partial segment
    const segments = waypoints.length - 1;
    const controllerForSegment = new Array(segments);
    
    // Calculate waypoint point indices from progress values (or fall back to even spacing)
    // This ensures segment boundaries align with actual waypoint positions
    const waypointPointIndices = waypointProgressValues 
      ? waypointProgressValues.map(p => Math.round(p * (totalPoints - 1)))
      : waypoints.map((_, i) => Math.round((i / segments) * (totalPoints - 1)));
    
    // Calculate visible range based on motion settings
    let visibleRange = { startProgress: 0, endProgress: progress, fadeStartProgress: 0 };
    let trailProgress = 0;
    
    if (motionSettings && motionVisibilityService) {
      const pathDuration = animationEngine.pathDuration || animationEngine.state.duration || 1;
      const isWaiting = animationEngine.state.isWaitingAtWaypoint || false;
      
      // Check if we're in tail time (path complete, trail fading)
      const isInTailTime = animationEngine.isInTailTime ? animationEngine.isInTailTime() : false;
      
      // Calculate elapsed time for trail shrinking
      // During waypoint pause: use pause elapsed time
      // During tail time: use tail time elapsed
      let pauseElapsed = 0;
      if (isInTailTime) {
        pauseElapsed = animationEngine.getTailTimeElapsed ? animationEngine.getTailTimeElapsed() : 0;
      } else if (isWaiting) {
        pauseElapsed = this._getPauseElapsed(animationEngine);
      }
      
      visibleRange = motionVisibilityService.getPathVisibleRange(
        progress, motionSettings, pathDuration, isWaiting, pauseElapsed, isInTailTime
      );
      trailProgress = motionSettings.pathTrail > 0 && pathDuration > 0 
        ? (motionSettings.pathTrail * 1000) / pathDuration 
        : 0;
    }
    
    // Convert progress to point indices
    const startPoint = Math.floor(visibleRange.startProgress * totalPoints);
    const endPoint = Math.min(Math.floor(visibleRange.endProgress * totalPoints), totalPoints);
    const fadeStartPoint = Math.floor(visibleRange.fadeStartProgress * totalPoints);
    
    // Store exact waypoint positions in path points for later use in labels
    this.waypointPositions = [];
    waypoints.forEach((wp, index) => {
      if (index < waypoints.length - 1) {
        const exactPointIndex = (index / segments) * totalPoints;
        this.waypointPositions.push({
          waypointIndex: index,
          pointIndex: exactPointIndex
        });
      }
    });
    
    let lastMajorIdx = -1;
    for (let s = 0; s < segments; s++) {
      if (waypoints[s].isMajor) lastMajorIdx = s;
      controllerForSegment[s] = lastMajorIdx;
    }
    
    // Use visible range for drawing (startPoint to endPoint)
    // In edit mode (no motionSettings), this is 0 to current progress
    const drawStart = Math.max(1, startPoint);
    const drawEnd = endPoint;
    
    // Helper function to draw a path segment (used for both casing and main path)
    const drawSegment = (i, isCasing = false) => {
      // Find which segment this point belongs to using actual waypoint positions
      let segmentIndex = 0;
      for (let s = 1; s < waypointPointIndices.length; s++) {
        if (i >= waypointPointIndices[s]) {
          segmentIndex = s;
        } else {
          break;
        }
      }
      segmentIndex = Math.min(segmentIndex, segments - 1);
      const controllerIdx = controllerForSegment[segmentIndex];
      const controller = controllerIdx >= 0 ? waypoints[controllerIdx] : {
        segmentColor: styles.pathColor,
        segmentWidth: styles.pathThickness,
        segmentStyle: 'solid',
        pathShape: 'line'
      };
      
      // Calculate opacity for trail fade effect
      let opacity = 1;
      const hasTrailFade = motionSettings && trailProgress > 0 && visibleRange.fadeStartProgress > 0;
      if (hasTrailFade) {
        const visibleLength = endPoint - startPoint;
        if (visibleLength > 0) {
          const distanceFromTail = i - startPoint;
          opacity = Math.max(0, Math.min(1, distanceFromTail / visibleLength));
        }
      }
      
      const needsAlphaChange = opacity < 1;
      if (needsAlphaChange) {
        ctx.save();
        ctx.globalAlpha = opacity;
      }
      
      // Skip segment if colour is transparent (None swatch)
      if (controller.segmentColor === 'transparent') {
        if (needsAlphaChange) ctx.restore();
        return;
      }
      
      // For casing: white, slightly wider, solid
      // For main path: colored, normal width, styled
      // Scale path thickness based on image dimensions
      const scaledWidth = this.scaleSizeClamped(controller.segmentWidth);
      if (isCasing) {
        ctx.strokeStyle = RENDERING.PATH_CASING_COLOR;
        ctx.lineWidth = scaledWidth + RENDERING.PATH_CASING_EXTRA_WIDTH * this._zoomClampFactor * this._graphicsScale; // scaled casing each side
        ctx.setLineDash([]); // Casing is always solid
      } else {
        ctx.strokeStyle = controller.segmentColor;
        ctx.lineWidth = scaledWidth;
        this.applyLineStyle(ctx, controller.segmentStyle);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      
      const rawP1 = pathPoints[i - 1];
      const rawP2 = pathPoints[i];
      const p1 = imageToCanvas ? imageToCanvas(rawP1.x, rawP1.y) : rawP1;
      const p2 = imageToCanvas ? imageToCanvas(rawP2.x, rawP2.y) : rawP2;
      
      // Path shapes (squiggle, randomised) are now baked into pathPoints by PathCalculator
      // Just draw straight lines between the transformed points
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      
      ctx.stroke();
      if (needsAlphaChange) {
        ctx.restore();
      }
    };
    
    // Group consecutive points by their controller for continuous path drawing
    // This allows dash patterns to work correctly across multiple points
    const drawContinuousPath = (isCasing) => {
      let currentControllerIdx = -1;
      let currentController = null;
      let pathStarted = false;
      
      for (let i = drawStart; i < drawEnd; i++) {
        if (i < startPoint) continue;
        
        // Find controller for this point
        let segmentIndex = 0;
        for (let s = 1; s < waypointPointIndices.length; s++) {
          if (i >= waypointPointIndices[s]) {
            segmentIndex = s;
          } else {
            break;
          }
        }
        segmentIndex = Math.min(segmentIndex, segments - 1);
        const controllerIdx = controllerForSegment[segmentIndex];
        
        // If controller changed, stroke current path and start new one
        if (controllerIdx !== currentControllerIdx) {
          if (pathStarted) {
            ctx.stroke();
            pathStarted = false;
          }
          
          currentControllerIdx = controllerIdx;
          currentController = controllerIdx >= 0 ? waypoints[controllerIdx] : {
            segmentColor: styles.pathColor,
            segmentWidth: styles.pathThickness,
            segmentStyle: 'solid',
            pathShape: 'line'
          };
          
          // Skip transparent segments entirely (no casing, no colored path)
          if (currentController.segmentColor === 'transparent') {
            continue;
          }
          
          // Set up stroke style for new controller - scale thickness
          const scaledControllerWidth = this.scaleSizeClamped(currentController.segmentWidth);
          if (isCasing) {
            ctx.strokeStyle = RENDERING.PATH_CASING_COLOR;
            ctx.lineWidth = scaledControllerWidth + RENDERING.PATH_CASING_EXTRA_WIDTH * this._zoomClampFactor * this._graphicsScale;
            ctx.setLineDash([]);
          } else {
            ctx.strokeStyle = currentController.segmentColor;
            ctx.lineWidth = scaledControllerWidth;
            this.applyLineStyle(ctx, currentController.segmentStyle);
          }
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          pathStarted = true;
          
          // Move to start point
          const rawP1 = pathPoints[i - 1];
          const p1 = imageToCanvas ? imageToCanvas(rawP1.x, rawP1.y) : rawP1;
          ctx.moveTo(p1.x, p1.y);
        }
        
        // Skip points belonging to transparent segments
        if (currentController && currentController.segmentColor === 'transparent') {
          continue;
        }
        
        // Draw line to current point
        // Path shapes (squiggle, randomised) are now baked into pathPoints by PathCalculator
        const rawP2 = pathPoints[i];
        const p2 = imageToCanvas ? imageToCanvas(rawP2.x, rawP2.y) : rawP2;
        ctx.lineTo(p2.x, p2.y);
      }
      
      // Stroke final path
      if (pathStarted) {
        ctx.stroke();
      }
    };
    
    // Glow pass: soft per-segment halo beneath the casing (Option B layered strokes).
    // Same controller grouping as drawContinuousPath, but each group is stroked as
    // several widening, translucent layers (additive) → a soft bloom. Solid + dash-free.
    const drawContinuousGlow = () => {
      const intensity = styles.pathGlow?.intensity ?? RENDERING.PATH_GLOW_DEFAULT_INTENSITY;
      const extraScale = this._zoomClampFactor * this._graphicsScale;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);

      let currentControllerIdx = -1;
      let currentController = null;
      let pathStarted = false;
      let layers = [];

      const strokeGlowGroup = () => {
        if (!pathStarted || layers.length === 0) return;
        for (const layer of layers) {
          ctx.strokeStyle = currentController.segmentColor;
          ctx.lineWidth = layer.width;
          ctx.globalAlpha = layer.alpha;
          ctx.stroke();
        }
      };

      for (let i = drawStart; i < drawEnd; i++) {
        if (i < startPoint) continue;
        let segmentIndex = 0;
        for (let s = 1; s < waypointPointIndices.length; s++) {
          if (i >= waypointPointIndices[s]) segmentIndex = s; else break;
        }
        segmentIndex = Math.min(segmentIndex, segments - 1);
        const controllerIdx = controllerForSegment[segmentIndex];

        if (controllerIdx !== currentControllerIdx) {
          strokeGlowGroup();
          pathStarted = false;
          currentControllerIdx = controllerIdx;
          currentController = controllerIdx >= 0 ? waypoints[controllerIdx] : {
            segmentColor: styles.pathColor,
            segmentWidth: styles.pathThickness
          };
          if (currentController.segmentColor === 'transparent') { layers = []; continue; }
          const scaledWidth = this.scaleSizeClamped(currentController.segmentWidth);
          layers = RenderingService.glowLayers(scaledWidth, intensity, extraScale);
          ctx.beginPath();
          pathStarted = true;
          const rawP1 = pathPoints[i - 1];
          const p1 = imageToCanvas ? imageToCanvas(rawP1.x, rawP1.y) : rawP1;
          ctx.moveTo(p1.x, p1.y);
        }

        if (currentController && currentController.segmentColor === 'transparent') continue;
        const rawP2 = pathPoints[i];
        const p2 = imageToCanvas ? imageToCanvas(rawP2.x, rawP2.y) : rawP2;
        ctx.lineTo(p2.x, p2.y);
      }
      strokeGlowGroup();
      ctx.restore();
    };

    // Glow first so it sits beneath the casing and the coloured path
    if (styles.pathGlow && styles.pathGlow.enabled) {
      drawContinuousGlow();
    }
    
    // First pass: draw white casing (skipped when showPathCasing is off)
    if (styles.showPathCasing !== false) {
      drawContinuousPath(true);
    }
    
    // Second pass: draw colored path on top
    drawContinuousPath(false);
    
    // Draw partial final segment for smooth animation (sub-pixel interpolation)
    // Only draw if the end point is within the visible range
    const pointsToRender = Math.floor(exactPosition);
    const shouldDrawPartial = pointsToRender > 0 && 
                              pointsToRender < totalPoints && 
                              fraction > 0.00001 &&
                              pointsToRender >= startPoint && 
                              pointsToRender <= endPoint;
    
    if (shouldDrawPartial) {
      const i = pointsToRender;
      // Find which segment this point belongs to using actual waypoint positions
      let segmentIndex = 0;
      for (let s = 1; s < waypointPointIndices.length; s++) {
        if (i >= waypointPointIndices[s]) {
          segmentIndex = s;
        } else {
          break;
        }
      }
      segmentIndex = Math.min(segmentIndex, segments - 1);
      const controllerIdx = controllerForSegment[segmentIndex];
      const controller = controllerIdx >= 0 ? waypoints[controllerIdx] : {
        segmentColor: styles.pathColor,
        segmentWidth: styles.pathThickness,
        segmentStyle: 'solid',
        pathShape: 'line'
      };
      
      const p1 = pathPoints[i - 1];
      const p2 = pathPoints[i];
      
      // Interpolate end point for smooth partial segment
      const partialEnd = {
        x: p1.x + (p2.x - p1.x) * fraction,
        y: p1.y + (p2.y - p1.y) * fraction
      };
      
      // Transform through imageToCanvas
      const p1Canvas = imageToCanvas ? imageToCanvas(p1.x, p1.y) : p1;
      const partialEndCanvas = imageToCanvas ? imageToCanvas(partialEnd.x, partialEnd.y) : partialEnd;
      
      const pathShape = controller.pathShape || 'line';
      
      // Helper to draw partial segment (for casing and main)
      // Scale path thickness for partial segment
      const scaledPartialWidth = this.scaleSizeClamped(controller.segmentWidth);
      const drawPartialSegment = (isCasing) => {
        if (isCasing) {
          ctx.strokeStyle = RENDERING.PATH_CASING_COLOR;
          ctx.lineWidth = scaledPartialWidth + RENDERING.PATH_CASING_EXTRA_WIDTH * this._zoomClampFactor * this._graphicsScale;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = controller.segmentColor;
          ctx.lineWidth = scaledPartialWidth;
          this.applyLineStyle(ctx, controller.segmentStyle);
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        if (pathShape === 'squiggle') {
          const midX = (p1Canvas.x + partialEndCanvas.x) / 2;
          const midY = (p1Canvas.y + partialEndCanvas.y) / 2;
          const perpX = -(partialEndCanvas.y - p1Canvas.y) * 0.15;
          const perpY = (partialEndCanvas.x - p1Canvas.x) * 0.15;
          ctx.moveTo(p1Canvas.x, p1Canvas.y);
          const wave = Math.sin(i * 0.5) * 0.5;
          ctx.quadraticCurveTo(midX + perpX * wave, midY + perpY * wave, partialEndCanvas.x, partialEndCanvas.y);
        } else {
          ctx.moveTo(p1Canvas.x, p1Canvas.y);
          ctx.lineTo(partialEndCanvas.x, partialEndCanvas.y);
        }
        ctx.stroke();
      };
      
      // Glow pass for the partial (animated head) segment — beneath casing.
      const drawPartialGlow = () => {
        const intensity = styles.pathGlow?.intensity ?? RENDERING.PATH_GLOW_DEFAULT_INTENSITY;
        const extraScale = this._zoomClampFactor * this._graphicsScale;
        const layers = RenderingService.glowLayers(scaledPartialWidth, intensity, extraScale);
        if (layers.length === 0) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        for (const layer of layers) {
          ctx.strokeStyle = controller.segmentColor;
          ctx.lineWidth = layer.width;
          ctx.globalAlpha = layer.alpha;
          ctx.beginPath();
          if (pathShape === 'squiggle') {
            const midX = (p1Canvas.x + partialEndCanvas.x) / 2;
            const midY = (p1Canvas.y + partialEndCanvas.y) / 2;
            const perpX = -(partialEndCanvas.y - p1Canvas.y) * 0.15;
            const perpY = (partialEndCanvas.x - p1Canvas.x) * 0.15;
            ctx.moveTo(p1Canvas.x, p1Canvas.y);
            const wave = Math.sin(i * 0.5) * 0.5;
            ctx.quadraticCurveTo(midX + perpX * wave, midY + perpY * wave, partialEndCanvas.x, partialEndCanvas.y);
          } else {
            ctx.moveTo(p1Canvas.x, p1Canvas.y);
            ctx.lineTo(partialEndCanvas.x, partialEndCanvas.y);
          }
          ctx.stroke();
        }
        ctx.restore();
      };
      
      // Skip transparent segments entirely (no glow, no casing, no colored path)
      if (controller.segmentColor !== 'transparent') {
        if (styles.pathGlow && styles.pathGlow.enabled) {
          drawPartialGlow();
        }
        if (styles.showPathCasing !== false) {
          drawPartialSegment(true);
        }
        drawPartialSegment(false);
      }
    }
    
    ctx.setLineDash([]);
  }
  
  /**
   * Render the path head (animated marker) with sub-pixel interpolation
   * 
   * Uses linear interpolation between path points for smooth movement at any speed.
   * This prevents the "jumping" effect that occurs when the head snaps to discrete points.
   * Uses pathProgress so head stays fixed during waypoint pauses.
   * 
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array} pathPoints - Path points in normalized image coordinates
   * @param {Object} styles - Style settings
   * @param {AnimationEngine} animationEngine
   * @param {Function} imageToCanvas - Coordinate transform function (imgX, imgY) => {x, y}
   * @param {Array} waypointProgressValues - Progress values for each waypoint (for rotation timing)
   * @param {Array} waypoints - Waypoint objects (for rotation timing)
   */
  renderPathHead(ctx, pathPoints, styles, animationEngine, imageToCanvas = null, waypointProgressValues = null, waypoints = null) {
    // Use pathProgress for head position - stays fixed during pauses
    const progress = animationEngine.getPathProgress();
    const totalPoints = pathPoints.length;
    const exactPosition = totalPoints * progress;
    
    // Only render if we have valid position and points
    if (exactPosition > 0 && totalPoints > 1) {
      // Determine if the head is on a transparent segment - if so, hide it
      if (waypoints && waypointProgressValues && waypoints.length > 1) {
        // Find which waypoint controls the current segment
        let controllerIdx = 0;
        for (let i = 1; i < waypointProgressValues.length; i++) {
          if (progress >= waypointProgressValues[i]) {
            controllerIdx = i;
          } else {
            break;
          }
        }
        // The segment after the last waypoint doesn't exist; cap at second-to-last
        controllerIdx = Math.min(controllerIdx, waypoints.length - 2);
        const controller = waypoints[controllerIdx];
        if (controller && controller.segmentColor === 'transparent') {
          return; // Don't draw head on transparent segments
        }
      }
      
      // Calculate interpolated position between path points
      // Clamp currentIndex to ensure we always have a valid nextIndex
      const currentIndex = Math.min(Math.floor(exactPosition), totalPoints - 2);
      const nextIndex = currentIndex + 1;
      const fraction = exactPosition - Math.floor(exactPosition);
      
      const currentPoint = pathPoints[currentIndex];
      const nextPoint = pathPoints[nextIndex];
      
      // Linear interpolation for smooth sub-pixel movement (in image coords)
      const rawHead = {
        x: currentPoint.x + (nextPoint.x - currentPoint.x) * fraction,
        y: currentPoint.y + (nextPoint.y - currentPoint.y) * fraction
      };
      
      // Transform to canvas coordinates for zoom-aware rendering
      const head = imageToCanvas ? imageToCanvas(rawHead.x, rawHead.y) : rawHead;
      
      // Use unified direction calculation (same as AOV) for consistent rotation timing
      // This ensures path head rotates AFTER waypoint pause, not during
      const rotation = this.getHeadDirection(
        pathPoints, 
        animationEngine, 
        waypointProgressValues, 
        waypoints, 
        1, 1, // Canvas dimensions not needed for direction calculation
        imageToCanvas
      ) || 0;
      
      // Store calculated rotation for external access
      styles.pathHead.rotation = rotation;
      
      // Draw path head at interpolated position
      this.drawPathHead(ctx, head.x, head.y, rotation, styles.pathHead);
    }
  }
  
  /**
   * Draw the path head based on current style settings
   */
  drawPathHead(ctx, x, y, rotation, pathHead) {
    // Safety check for valid coordinates
    if (!isFinite(x) || !isFinite(y)) {
      console.warn('Invalid path head coordinates:', {x, y});
      return;
    }
    
    // Scale path head size based on image dimensions (clamped at high zoom)
    const size = this.scaleSizeClamped(pathHead.size);
    
    ctx.save();
    ctx.translate(x, y);
    
    // Apply rotation based on mode
    // 'auto' follows path direction, 'fixed' stays upright (no rotation)
    let finalRotation = 0;
    if (pathHead.rotationMode !== 'fixed') {
      finalRotation = rotation;
    }
    // Add rotation offset (convert degrees to radians)
    const offsetRad = (pathHead.rotationOffset || 0) * Math.PI / 180;
    ctx.rotate(finalRotation + offsetRad);
    
    switch (pathHead.style) {
      case 'dot':
        // Simple dot (filled circle)
        ctx.beginPath();
        ctx.fillStyle = pathHead.color;
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'arrow':
        // Arrow shape
        ctx.beginPath();
        ctx.fillStyle = pathHead.color;
        
        // Draw arrow pointing right (rotation will handle direction)
        ctx.moveTo(size, 0);            // Tip
        ctx.lineTo(-size/2, size/2);    // Bottom corner
        ctx.lineTo(-size/4, 0);         // Indentation
        ctx.lineTo(-size/2, -size/2);   // Top corner
        ctx.closePath();
        ctx.fill();
        break;
        
      case 'custom':
        // Custom image
        if (pathHead.image) {
          const imgSize = size * 2; // Make image slightly larger for better visibility
          // Draw the image centered and rotated
          ctx.drawImage(
            pathHead.image, 
            -imgSize/2, -imgSize/2,
            imgSize, imgSize
          );
        } else {
          // Fallback to dot if no image loaded
          ctx.beginPath();
          ctx.fillStyle = pathHead.color;
          ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
        
      default:
        // Default to dot
        ctx.beginPath();
        ctx.fillStyle = pathHead.color;
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
  }
  
  /**
   * Update and render beacon effects at waypoints
   * Uses the modular BeaconRenderer for all beacon types
   * 
   * Beacon types: none, ripple, glow, pop, grow, pulse
   * Beacons use marker color (dotColor) - no separate beacon color
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} waypoints - Array of waypoints
   * @param {Object} animationEngine - Animation engine instance
   * @param {Object} beaconAnimation - Legacy beacon animation state (unused, kept for compatibility)
   * @param {Function} imageToCanvas - Coordinate transform function
   * @param {Object} styles - Style settings
   * @param {Object} motionSettings - Motion visibility settings
   * @param {Array} waypointProgressValues - Pre-calculated waypoint progress values
   */
  renderBeacons(ctx, waypoints, animationEngine, beaconAnimation, imageToCanvas, styles, motionSettings = null, waypointProgressValues = null) {
    if (!waypoints.length || !animationEngine) return;
    
    // Sync beacons to the current timeline instant (pause-marker axis: raw
    // time minus start handle and intro). Beacon phases are closed-form in
    // timeline time, so play, scrub, and export all see identical beacons.
    const adjustedTimelineMs = animationEngine.state.currentTime -
      (animationEngine.startHandleTime || 0) - (animationEngine.introTime || 0);
    this.beaconRenderer.update(adjustedTimelineMs, waypoints, animationEngine, motionSettings, waypointProgressValues);
    
    // Render beacons for each waypoint
    const currentProgress = animationEngine.getPathProgress();
    
    waypoints.forEach((waypoint, wpIndex) => {
      if (!waypoint.isMajor || waypoint.beaconStyle === 'none') return;
      
      // Get waypoint progress
      const waypointPathProgress = waypointProgressValues?.[wpIndex] ?? 
        wpIndex / Math.max(1, waypoints.length - 1);
      
      // Check if we should render beacon (at or past waypoint)
      const atOrPastWaypoint = currentProgress >= waypointPathProgress - 0.001;
      if (!atOrPastWaypoint) return;
      
      // Convert waypoint to canvas coords
      const wpCanvas = imageToCanvas(waypoint.imgX, waypoint.imgY);
      const rawMarkerSize = waypoint.dotSize || styles.dotSize || RENDERING.DEFAULT_DOT_SIZE;
      const markerSize = this.scaleSizeClamped(rawMarkerSize);
      
      // Calculate size scale factor for beacon thickness (clamped at high zoom, scaled)
      const sizeScale = (this._coordinateTransform 
        ? this._coordinateTransform.getReferenceDimension() / (RENDERING.REFERENCE_DIAGONAL || 1414)
        : 1) * this._zoomClampFactor * this._graphicsScale;
      
      // Render beacon effect (may return scale override)
      const scaleOverride = this.beaconRenderer.renderBeacon(
        ctx, waypoint, wpCanvas.x, wpCanvas.y, markerSize, 1.0, sizeScale
      );
      
      // Note: Scale overrides are handled in renderWaypoints for pop/grow/pulse beacons
      // The beacon renderer stores the scale which can be retrieved later
    });
  }
  
  /**
   * Get beacon scale override for a waypoint (O(1) lookup)
   * Used by renderWaypoints to apply beacon scale effects (pop, grow, pulse)
   * 
   * @param {Object} waypoint - Waypoint object
   * @returns {{scale: number}|null} Scale override or null
   */
  getBeaconScaleOverride(waypoint) {
    if (!waypoint || !waypoint.id) return null;
    
    // Direct beacon lookup - O(1) via Map
    const beacon = this.beaconRenderer.beacons.get(waypoint.id);
    if (!beacon || !beacon.isActive()) return null;
    
    // Pop and Grow beacons: only return scale after 'started' flag is set
    // This ensures the scale has been initialized based on hidesBefore
    // (PopBeacon/GrowBeacon.update() sets started=true and scale=startScale together)
    if (beacon.started !== undefined) {
      if (beacon.started && beacon.scale !== undefined) {
        return { scale: beacon.scale };
      }
      return null;
    }
    
    // Pulse beacons: use phase check (doesn't have started flag)
    // These beacons set scale immediately in update() based on phase
    if (beacon.scale !== undefined && beacon.phase !== 'inactive') {
      return { scale: beacon.scale };
    }
    return null;
  }
  
  /**
   * Reset beacon renderer (e.g., when animation resets)
   */
  resetBeacons() {
    this.beaconRenderer.reset();
  }
  
  /**
   * Render waypoint markers
   * Major waypoints: full color with configurable marker styles
   * Minor waypoints: small grey dots at 50% opacity for path shaping
   * 
   * In preview mode:
   * - Minor waypoints are always hidden
   * - Major waypoints visibility controlled by motionSettings.waypointVisibility
   * - Waypoints animate in/out based on path progress
   * 
   * @param {Object|null} motionSettings - Motion settings (null = edit mode)
   * @param {MotionVisibilityService|null} motionVisibilityService
   * @param {AnimationEngine|null} animationEngine
   * @param {boolean} suppressLabels - When true, skip text labels (export "Text labels" off)
   */
  renderWaypoints(ctx, waypoints, selectedWaypoint, styles, imageToCanvas, displayWidth, displayHeight, 
                  motionSettings = null, motionVisibilityService = null, animationEngine = null,
                  waypointProgressValues = null, suppressLabels = false) {
    const applyMotion = motionSettings !== null;
    // Use pathDuration (excludes pauses) for animation timing calculations
    const pathDuration = animationEngine?.pathDuration || animationEngine?.state?.duration || 1;
    const currentPathProgress = animationEngine?.getPathProgress() || 0;
    
    // Pre-calculate major waypoint progress values for O(1) lookup and neighbor access
    // We need both a Map (for O(1) lookup) and an ordered array (for prev/next neighbors)
    let majorWaypointProgressMap = null;
    let majorWaypointProgressList = null;  // Ordered list: [{waypoint, progress, index}]
    let majorWaypointCount = 0;
    
    if (applyMotion) {
      majorWaypointProgressMap = new Map();
      majorWaypointProgressList = [];
      let majorIdx = 0;
      
      waypoints.forEach((wp, idx) => {
        if (wp.isMajor) {
          // Use actual path progress from pre-calculated values, or estimate from index
          const progress = (waypointProgressValues && waypointProgressValues[idx] !== undefined)
            ? waypointProgressValues[idx] 
            : majorIdx / Math.max(1, waypoints.filter(w => w.isMajor).length - 1);
          
          majorWaypointProgressMap.set(wp, { progress, listIndex: majorIdx });
          majorWaypointProgressList.push({ waypoint: wp, progress, waypointIndex: idx });
          majorIdx++;
          majorWaypointCount++;
        }
      });
    }
    
    waypoints.forEach((waypoint, index) => {
      // Convert waypoint from image coords to canvas coords
      const wpCanvas = imageToCanvas(waypoint.imgX, waypoint.imgY);
      const isSelected = waypoint === selectedWaypoint;
      
      // Skip rendering if waypoint is outside visible canvas area (with margin for marker size)
      const margin = 50; // Allow some margin for marker visibility at edges
      if (wpCanvas.x < -margin || wpCanvas.x > displayWidth + margin ||
          wpCanvas.y < -margin || wpCanvas.y > displayHeight + margin) {
        return; // Skip this waypoint - it's outside the visible area
      }
      
      if (waypoint.isMajor) {
        // Major waypoint rendering - scale size based on image dimensions
        const rawMarkerSize = waypoint.dotSize || styles.dotSize;
        const markerSize = this.scaleSizeClamped(rawMarkerSize);
        let size = markerSize; // No size change on selection
        const markerStyle = waypoint.markerStyle || styles.markerStyle;
        
        // In preview mode, calculate visibility and scale based on motion settings
        let waypointScale = 1;
        let shouldRender = true;
        
        if (applyMotion && motionVisibilityService && majorWaypointProgressMap) {
          // Get pre-calculated path progress and list index for this waypoint (O(1) lookup)
          const wpData = majorWaypointProgressMap.get(waypoint);
          const waypointPathProgress = wpData?.progress || 0;
          const listIndex = wpData?.listIndex || 0;
          
          // Get prev/next waypoint progress for close-waypoint handling
          const prevProgress = listIndex > 0 
            ? majorWaypointProgressList[listIndex - 1].progress 
            : -1;  // No previous waypoint
          const nextProgress = listIndex < majorWaypointProgressList.length - 1
            ? majorWaypointProgressList[listIndex + 1].progress
            : 2;   // No next waypoint (value > 1 means unconstrained)
          
          // Get previous waypoint's pause duration for time-based pre-animation.
          // When paused at A, the next waypoint B can begin animating during
          // the tail end of A's pause (prevents freeze-mid-animation glitch).
          const prevWaypointPauseMs = listIndex > 0
            ? (majorWaypointProgressList[listIndex - 1].waypoint?.getPauseDuration?.() || 0)
            : 0;
          
          // Current pause state from animation engine (elapsed, total, waypointProgress)
          const pauseState = animationEngine?.getPauseState() || null;
          
          const visibility = motionVisibilityService.getWaypointVisibility(
            waypoint, waypointPathProgress, currentPathProgress, motionSettings, pathDuration,
            prevProgress, nextProgress, pauseState, prevWaypointPauseMs
          );
          
          shouldRender = visibility.visible;
          waypointScale = visibility.scale;
        }
        
        // Apply beacon scale override (for pop, grow, pulse beacons)
        // ONLY when animation is actually playing - not when paused or stopped
        // NOTE: Beacon scale REPLACES visibility scale, not multiplies, because
        // beacons like Pop/Grow/Pulse handle the full scale animation themselves
        // (including hide-before/hide-after behavior)
        const isAnimationPlaying = animationEngine?.state?.isPlaying === true;
        if (isAnimationPlaying) {
          const beaconOverride = this.getBeaconScaleOverride(waypoint);
          if (beaconOverride && beaconOverride.scale !== undefined) {
            waypointScale = beaconOverride.scale;
            shouldRender = true;
          }
        }
        
        // Render labels unless the export "Text labels" toggle is off (otherwise their
        // visibility is controlled by TextLabelService, independent of the waypoint marker).
        // suppressLabels comes from main.js renderState (Preview + export only).
        if (!suppressLabels) {
          const labelWpProgress = waypointProgressValues?.[index] ?? index / Math.max(1, waypoints.length - 1);
          this.renderLabel(ctx, waypoint, wpCanvas.x, wpCanvas.y, markerSize, index, animationEngine, displayWidth, displayHeight, labelWpProgress);
        }
        
        // Skip marker rendering if not visible
        if (!shouldRender || waypointScale <= 0) {
          return;
        }
        
        // Apply scale to size
        size = size * waypointScale;
        
        // Skip rendering marker if style is 'none' or colour is transparent
        if (markerStyle === 'none') {
          return;
        }
        
        const markerColor = waypoint.dotColor || waypoint.segmentColor || styles.dotColor;
        if (markerColor === 'transparent') {
          return;
        }
        
        ctx.fillStyle = markerColor;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2 * this._zoomClampFactor * this._graphicsScale;
        
        // Draw different marker types
        if (markerStyle === 'custom' && waypoint.customImage) {
          // Custom image marker
          ctx.save();
          ctx.translate(wpCanvas.x, wpCanvas.y);
          
          // Apply rotation if set to 'auto' (follow path direction)
          if (waypoint.customImageRotation === 'auto' && waypointProgressValues) {
            // Calculate path direction at this waypoint
            const wpProgress = waypointProgressValues[index] || 0;
            // Get direction from path (simplified - use neighbor waypoints)
            const prevWp = index > 0 ? waypoints[index - 1] : null;
            const nextWp = index < waypoints.length - 1 ? waypoints[index + 1] : null;
            
            let angle = 0;
            if (nextWp) {
              const nextCanvas = imageToCanvas(nextWp.imgX, nextWp.imgY);
              angle = Math.atan2(nextCanvas.y - wpCanvas.y, nextCanvas.x - wpCanvas.x);
            } else if (prevWp) {
              const prevCanvas = imageToCanvas(prevWp.imgX, prevWp.imgY);
              angle = Math.atan2(wpCanvas.y - prevCanvas.y, wpCanvas.x - prevCanvas.x);
            }
            
            // Add rotation offset (convert degrees to radians)
            const offsetRad = (waypoint.customImageRotationOffset || 0) * Math.PI / 180;
            ctx.rotate(angle + offsetRad);
          }
          
          // Draw the custom image centered on waypoint
          const imgSize = size * 2;
          ctx.drawImage(waypoint.customImage, -imgSize/2, -imgSize/2, imgSize, imgSize);
          
          ctx.restore();
          
          // Draw selection indicator if selected (after restore so it's not rotated)
          if (isSelected) {
            const gap = 2 * this._zoomClampFactor;
            this.drawSelectionRect(ctx, wpCanvas.x - size - gap, wpCanvas.y - size - gap, size * 2 + gap * 2, size * 2 + gap * 2, 3 * this._zoomClampFactor);
          }
        } else if (markerStyle === 'square') {
          // Square marker
          ctx.beginPath();
          ctx.rect(wpCanvas.x - size, wpCanvas.y - size, size * 2, size * 2);
          ctx.fill();
          ctx.stroke();
          // Draw selection indicator if selected
          if (isSelected) {
            const gap = 2 * this._zoomClampFactor;
            this.drawSelectionRect(ctx, wpCanvas.x - size - gap, wpCanvas.y - size - gap, size * 2 + gap * 2, size * 2 + gap * 2, 3 * this._zoomClampFactor);
          }
        } else if (markerStyle === 'flag') {
          // Flag marker - anchored at bottom of pole (waypoint position)
          // Offset all Y coordinates so pole bottom sits at waypoint
          const flagY = wpCanvas.y - size; // Shift up so pole bottom = waypoint
          ctx.beginPath();
          // Pole (from top to waypoint position)
          ctx.moveTo(wpCanvas.x, flagY - size * 2);
          ctx.lineTo(wpCanvas.x, wpCanvas.y); // Pole ends at waypoint
          // Flag (attached to top of pole)
          ctx.moveTo(wpCanvas.x, flagY - size * 2);
          ctx.lineTo(wpCanvas.x + size * 1.5, flagY - size * 1.3);
          ctx.lineTo(wpCanvas.x + size * 1.2, flagY - size);
          ctx.lineTo(wpCanvas.x, flagY - size * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Draw selection indicator if selected (ring around flag base)
          if (isSelected) {
            this.drawSelectionRing(ctx, wpCanvas.x, wpCanvas.y, size + 4 * this._zoomClampFactor, 3 * this._zoomClampFactor);
          }
        } else {
          // Default to dot
          ctx.beginPath();
          ctx.arc(wpCanvas.x, wpCanvas.y, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Draw selection indicator if selected
          if (isSelected) {
            this.drawSelectionRing(ctx, wpCanvas.x, wpCanvas.y, size + 4 * this._zoomClampFactor, 3 * this._zoomClampFactor);
          }
        }
        
        // Labels already rendered above (before marker visibility check)
      } else {
        // Minor waypoint rendering: small grey dot at 50% opacity
        // In preview mode, minor waypoints are always hidden
        if (applyMotion) {
          return; // Skip minor waypoints in preview/export mode
        }
        
        const rawMinorSize = styles.minorDotSize || RENDERING.MINOR_DOT_SIZE;
        const minorSize = this.scaleSizeClamped(rawMinorSize);
        const size = minorSize; // No size change on selection
        
        ctx.save();
        ctx.globalAlpha = RENDERING.MINOR_DOT_OPACITY;
        ctx.fillStyle = RENDERING.MINOR_DOT_COLOR;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 * this._zoomClampFactor * this._graphicsScale;
        
        ctx.beginPath();
        ctx.arc(wpCanvas.x, wpCanvas.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        // Draw selection indicator if selected (at full opacity, outside the save/restore)
        if (isSelected) {
          this.drawSelectionRing(ctx, wpCanvas.x, wpCanvas.y, size + 3 * this._zoomClampFactor, 2 * this._zoomClampFactor);
        }
      }
    });
  }
  
  /**
   * Render waypoint text labels with background, custom positioning, and visibility modes
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} waypoint - Waypoint with label properties
   * @param {number} x - Marker X position in canvas coords
   * @param {number} y - Marker Y position in canvas coords
   * @param {number} dotSize - Marker size for offset calculations
   * @param {number} wpIndex - Waypoint index (avoids O(n) indexOf lookup)
   * @param {AnimationEngine} animationEngine - Animation engine for timing
   * @param {number} displayWidth - Canvas width
   * @param {number} displayHeight - Canvas height
   */
  renderLabel(ctx, waypoint, x, y, dotSize, wpIndex, animationEngine, displayWidth, displayHeight, waypointProgress = null) {
    // Skip if no label text or mode is 'off'
    if (!waypoint.label || waypoint.labelMode === 'off') return;
    
    // Use provided waypointProgress (actual path progress) or fall back to 0
    const wpProgress = waypointProgress ?? 0;
    const currentProgress = animationEngine?.getPathProgress() || 0;
    const isWaiting = animationEngine?.state?.isWaitingAtWaypoint && 
                      animationEngine?.state?.pauseWaypointIndex === wpIndex;
    const hasPassedWaypoint = currentProgress > wpProgress;
    const animationDuration = animationEngine?.state?.duration || 10000;
    
    // Get visibility state from TextLabelService
    const { visible, opacity } = TextLabelService.getTextVisibility({
      labelMode: waypoint.labelMode,
      progress: currentProgress,
      waypointProgress: wpProgress,
      isWaiting,
      hasPassedWaypoint,
      animationDuration
    });
    
    if (!visible || opacity <= 0) return;
    
    // Get label properties with defaults - scale font size based on image dimensions (clamped at high zoom)
    const rawFontSize = waypoint.labelSize || TEXT_LABEL.SIZE_DEFAULT;
    const fontSize = this.scaleSizeClamped(rawFontSize);
    const textColor = waypoint.labelColor || TEXT_LABEL.COLOR_DEFAULT;
    const bgColor = waypoint.labelBgColor || TEXT_LABEL.BG_COLOR_DEFAULT;
    const bgOpacity = waypoint.labelBgOpacity !== undefined ? waypoint.labelBgOpacity : TEXT_LABEL.BG_OPACITY_DEFAULT;
    const clamp = this._zoomClampFactor;
    const labelWidth = (waypoint.labelWidth || TEXT_LABEL.WIDTH_DEFAULT) / 100 * displayWidth * clamp;
    const offsetX = (waypoint.labelOffsetX !== undefined ? waypoint.labelOffsetX : TEXT_LABEL.OFFSET_DEFAULT_X) / 100 * displayWidth * clamp;
    const offsetY = (waypoint.labelOffsetY !== undefined ? waypoint.labelOffsetY : TEXT_LABEL.OFFSET_DEFAULT_Y) / 100 * displayHeight * clamp;
    
    // Calculate label center position
    const labelCenterX = x + offsetX;
    const labelCenterY = y + offsetY;
    
    ctx.save();
    ctx.globalAlpha = opacity;
    
    // Set up font for text measurement
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Word wrap text to fit within labelWidth
    const words = waypoint.label.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > labelWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    // Calculate text box dimensions
    const lineHeight = fontSize * 1.3;
    const textHeight = lines.length * lineHeight;
    const padding = TEXT_LABEL.BG_PADDING;
    
    // Find max line width for background - background must cover all text
    let maxLineWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }
    
    // Background width must be at least as wide as the widest text line + padding
    const boxWidth = maxLineWidth + padding * 2;
    const boxHeight = textHeight + padding * 2;
    const boxX = labelCenterX - boxWidth / 2;
    const boxY = labelCenterY - boxHeight / 2;
    
    // Draw background with rounded corners
    if (bgOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = opacity * bgOpacity;
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      const r = TEXT_LABEL.BG_BORDER_RADIUS;
      ctx.moveTo(boxX + r, boxY);
      ctx.lineTo(boxX + boxWidth - r, boxY);
      ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + r);
      ctx.lineTo(boxX + boxWidth, boxY + boxHeight - r);
      ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - r, boxY + boxHeight);
      ctx.lineTo(boxX + r, boxY + boxHeight);
      ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - r);
      ctx.lineTo(boxX, boxY + r);
      ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    
    // Draw text lines
    ctx.fillStyle = textColor;
    const startY = labelCenterY - (textHeight / 2) + (lineHeight / 2);
    
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], labelCenterX, startY + i * lineHeight);
    }
    
    ctx.restore();
  }
  
  /**
   * Apply line style for path rendering
   */
  applyLineStyle(ctx, style) {
    switch (style) {
      case 'dotted':
        ctx.setLineDash([2, 6]);
        break;
      case 'dashed':
        ctx.setLineDash([10, 5]);
        break;
      case 'squiggle':
        // Approximated with dashed pattern - true squiggle would need complex path manipulation
        ctx.setLineDash([5, 3, 2, 3]);
        break;
      case 'solid':
      default:
        ctx.setLineDash([]);
        break;
    }
  }
  
  /**
   * Get elapsed time within current waypoint pause.
   * @param {AnimationEngine} engine - Animation engine instance
   * @returns {number} Elapsed pause time in ms, or 0 if not paused
   * @private
   */
  _getPauseElapsed(engine) {
    if (!engine.pauseMarkers) return 0;
    
    const marker = engine.pauseMarkers.find(m => m.waypointIndex === engine.state.pauseWaypointIndex);
    if (!marker) return 0;
    
    // Use absolute time (timelineStartMs) instead of percentage
    const timelineTime = engine.state.progress * engine.state.duration;
    return Math.max(0, timelineTime - marker.timelineStartMs);
  }
}
