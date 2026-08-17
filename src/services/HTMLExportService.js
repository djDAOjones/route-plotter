/**
 * HTMLExportService - Exports animation as a self-contained HTML file
 * 
 * Version 2.0 - Full feature parity with app
 * 
 * Creates a standalone HTML file with:
 * - Embedded background image (base64)
 * - Complete project data (waypoints, styles, settings, pre-computed timing)
 * - Full-featured player script with:
 *   - Path visibility modes (show-on-progression, instantaneous, hide-on-progression, etc.)
 *   - Waypoint visibility modes with scale animations
 *   - Beacon animations (ripple, glow, pop, grow, pulse)
 *   - Camera following with pan/zoom
 *   - Trail effects with fade
 *   - Pre-computed waypoint progress values for performance
 * 
 * Benefits over video export:
 * - 80-95% smaller file size (stores image once, not every frame)
 * - Interactive playback (pause, scrub, speed control)
 * - Responsive/retina-ready (vector path rendering)
 * - Easy web embedding (iframe-friendly)
 */

import { CatmullRom } from '../utils/CatmullRom.js';
import { VIDEO_EXPORT, PATH_VISIBILITY, WAYPOINT_VISIBILITY, RENDERING } from '../config/constants.js';

export class HTMLExportService {
  constructor() {
    this.playerVersion = '2.0.0';
  }

  /**
   * Export the current project as a self-contained HTML file
   * @param {Object} options - Export options
   * @param {Object} options.waypoints - Array of waypoint data
   * @param {Object} options.styles - Path and marker styles
   * @param {Object} options.background - Background settings
   * @param {HTMLImageElement} options.backgroundImage - Background image element
   * @param {Object} options.motionSettings - Motion visibility settings
   * @param {Object} options.animationState - Animation timing settings
   * @param {number} options.pathLength - Total path length in pixels
   * @param {Array} options.waypointProgressValues - Pre-computed waypoint progress values (0-1)
   * @param {Array} options.pathPoints - Pre-computed path points [{x,y}] in normalized 0-1 coords
   * @param {Object} options.timeline - Pre-computed timeline data (pauses, segment speeds)
   * @param {Object} options.cameraSettings - Camera settings (zoom, follow mode)
   * @param {Object} options.displayDimensions - App display canvas dimensions for size scaling
   * @param {string} options.title - Project title for the HTML page
   * @returns {Promise<Blob>} HTML file as a Blob
   */
  async exportHTML(options) {
    const {
      waypoints,
      styles,
      background,
      backgroundImage,
      motionSettings,
      animationState,
      pathLength,
      pathPoints = null,
      waypointProgressValues = null,
      timeline = null,
      cameraSettings = null,
      includeCamera = true,
      includeText = true,
      displayDimensions = null,
      title = 'Route Animation'
    } = options;

    // Convert background image to base64
    let backgroundBase64 = null;
    if (backgroundImage) {
      backgroundBase64 = await this._imageToBase64(backgroundImage);
    }

    // Pre-compute waypoint progress values if not provided
    const wpProgressValues = waypointProgressValues || this._computeWaypointProgress(waypoints);

    // Prepare comprehensive project data for full feature parity
    const projectData = {
      version: this.playerVersion,
      waypoints: waypoints.map((wp, idx) => ({
        x: wp.imgX,
        y: wp.imgY,
        isMajor: wp.isMajor,
        pauseTime: wp.pauseTime || 0,
        segmentSpeed: wp.segmentSpeed || 1.0,
        segmentColor: wp.segmentColor || styles.pathColor,
        segmentWidth: wp.segmentWidth || styles.pathThickness || 3,
        segmentStyle: wp.segmentStyle || 'solid',
        dotColor: wp.dotColor || styles.dotColor,
        dotSize: wp.dotSize || styles.dotSize,
        beaconStyle: wp.beaconStyle || 'none',
        beaconScale: wp.beaconScale || 10,
        rippleThickness: wp.rippleThickness || 2,
        rippleMaxScale: wp.rippleMaxScale || 10,
        markerStyle: wp.markerStyle || 'dot',
        // includeText=false → blank the label so the embedded player renders no text.
        label: includeText ? (wp.label || '') : '',
        labelPosition: wp.labelPosition || 'right',
        progress: wpProgressValues[idx] || 0,
        // Camera settings per waypoint.
        // includeCamera=false → force zoom 1 so the player's hasZoom check is false (flat view).
        camera: {
          zoom: includeCamera ? (wp.camera?.zoom || 1) : 1,
          zoomMode: wp.camera?.zoomMode || 'continuous'
        }
      })),
      styles: {
        pathColor: styles.pathColor,
        pathWidth: styles.pathThickness || 3,
        pathHead: {
          style: styles.pathHead.style,
          color: styles.pathHead.color,
          size: styles.pathHead.size,
          rotationMode: styles.pathHead.rotationMode || 'auto',
          rotationOffset: styles.pathHead.rotationOffset || 0
        },
        dotColor: styles.dotColor,
        dotSize: styles.dotSize,
        // Path emphasis (parity with preview). showPathCasing was previously omitted
        // from this payload, so the casing toggle had no effect in HTML export.
        showPathCasing: styles.showPathCasing !== false,
        pathGlow: {
          enabled: styles.pathGlow?.enabled || false,
          intensity: styles.pathGlow?.intensity ?? 0.5
        }
      },
      background: {
        overlay: background.overlay,
        fit: background.fit
      },
      motion: {
        pathVisibility: motionSettings.pathVisibility || 'show-on-progression',
        pathTrail: motionSettings.pathTrail || 0,
        waypointVisibility: motionSettings.waypointVisibility || 'always-show',
        backgroundVisibility: motionSettings.backgroundVisibility || 'always-show',
        revealSize: motionSettings.revealSize || 20,
        revealFeather: motionSettings.revealFeather || 50
      },
      camera: (includeCamera && cameraSettings) ? {
        enabled: cameraSettings.enabled || false,
        zoom: cameraSettings.zoom || 1,
        followMode: cameraSettings.followMode || 'none'
      } : { enabled: false, zoom: 1, followMode: 'none' },
      animation: {
        speed: animationState.speed,
        duration: animationState.duration,
        startBuffer: 0 // No start buffer for HTML export (interactive playback)
      },
      pathLength: pathLength,
      waypointProgressValues: wpProgressValues,
      // Pre-computed path points (normalized 0-1) — eliminates client-side spline recomputation
      // and includes path shapes (squiggle, randomised) baked in by PathCalculator
      pathPoints: pathPoints ? pathPoints.map(p => ({ x: +p.x.toFixed(6), y: +p.y.toFixed(6) })) : null,
      // Pre-computed timeline from AnimationEngine (pauses + segment speeds)
      timeline: timeline || null,
      // Display dimensions for accurate size scaling
      // Sizes in the app are specified in display canvas pixels
      // HTML export uses full image dimensions, so we need to scale
      displayDimensions: displayDimensions || { width: 1000, height: 800 }
    };

    // Generate the HTML file
    const html = this._generateHTML(title, backgroundBase64, projectData);
    
    return new Blob([html], { type: 'text/html' });
  }

  /**
   * Compute waypoint progress values based on segment distances
   * @private
   */
  _computeWaypointProgress(waypoints) {
    if (waypoints.length < 2) return waypoints.map(() => 0);
    
    // Simple linear distribution for now
    // In the app, this is computed from actual path lengths
    return waypoints.map((_, idx) => idx / (waypoints.length - 1));
  }

  /**
   * Convert an image element to base64 data URL
   * Fills transparent areas with white before encoding to JPEG
   */
  async _imageToBase64(img) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      
      // Fill with white first to handle transparent images
      // JPEG doesn't support transparency, so transparent areas would become black
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw image on top of white background
      ctx.drawImage(img, 0, 0);
      
      // Use JPEG for smaller file size (transparency already handled)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(dataUrl);
    });
  }

  /**
   * Generate the complete HTML file with embedded player
   */
  _generateHTML(title, backgroundBase64, projectData) {
    const playerScript = this._getMinimalPlayerScript();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this._escapeHTML(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff; 
      color: #333;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .container {
      flex: 1;
      display: flex;
      flex-direction: column;
      max-width: 100%;
      max-height: 100vh;
    }
    .canvas-wrapper {
      flex: 1;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    canvas {
      max-width: 100%;
      max-height: calc(100vh - 60px);
      object-fit: contain;
    }
    .controls {
      padding: 12px 16px;
      background: #f0f0f0;
      border-top: 1px solid #ddd;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.15s;
    }
    .btn-primary {
      background: #3b82f6;
      color: white;
    }
    .btn-primary:hover { background: #2563eb; }
    .btn-secondary {
      background: #666;
      color: white;
    }
    .btn-secondary:hover { background: #555; }
    .timeline {
      flex: 1;
      min-width: 200px;
      height: 6px;
      background: #ccc;
      border-radius: 3px;
      cursor: pointer;
      position: relative;
    }
    .timeline-progress {
      height: 100%;
      background: #3b82f6;
      border-radius: 3px;
      width: 0%;
      pointer-events: none;
    }
    .time-display {
      font-size: 13px;
      color: #666;
      min-width: 80px;
      text-align: right;
    }
    .speed-control {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #666;
    }
    .speed-control select {
      background: #fff;
      color: #333;
      border: 1px solid #ccc;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="canvas-wrapper">
      <canvas id="canvas"></canvas>
    </div>
    <div class="controls">
      <button id="playBtn" class="btn btn-primary">▶ Play</button>
      <button id="resetBtn" class="btn btn-secondary">⏮ Reset</button>
      <div class="timeline" id="timeline">
        <div class="timeline-progress" id="timelineProgress"></div>
      </div>
      <div class="time-display" id="timeDisplay">0:00 / 0:00</div>
      <div class="speed-control">
        <span>Speed:</span>
        <select id="speedSelect">
          <option value="0.25">0.25x</option>
          <option value="0.5">0.5x</option>
          <option value="1" selected>1x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </div>
    </div>
  </div>

  <script>
    // Project data embedded at build time
    const PROJECT_DATA = ${JSON.stringify(projectData)};
    const BACKGROUND_IMAGE = ${backgroundBase64 ? `"${backgroundBase64}"` : 'null'};
    
    ${playerScript}
  </script>
</body>
</html>`;
  }

  /**
   * Get the full-featured player script (will be embedded in HTML)
   * This is a comprehensive animation player with full feature parity
   */
  _getMinimalPlayerScript() {
    return `
    // Route Animation Player v2.0 - Full Feature Parity
    (function() {
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      const playBtn = document.getElementById('playBtn');
      const resetBtn = document.getElementById('resetBtn');
      const timeline = document.getElementById('timeline');
      const timelineProgress = document.getElementById('timelineProgress');
      const timeDisplay = document.getElementById('timeDisplay');
      const speedSelect = document.getElementById('speedSelect');
      
      let backgroundImg = null;
      let isPlaying = false;
      let progress = 0;        // Path progress 0-1 (position along physical path)
      let currentTimeMs = 0;   // Wall-clock elapsed time in ms (for timeline tracking)
      let lastTime = 0;
      let playbackSpeed = 1;
      let pathPoints = [];
      let cw = 0, ch = 0;
      
      // Segment boundaries: indices into pathPoints for each waypoint
      let waypointPointIndices = [];
      
      // Beacon state for each waypoint
      const beaconStates = new Map();
      
      // Trail state for path visibility
      let trailTailProgress = 0;
      
      // ========== EASING FUNCTIONS ==========
      const Easing = {
        easeOutBack(t) {
          const c1 = 1.70158;
          const c3 = c1 + 1;
          return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        },
        easeInBack(t) {
          const c1 = 1.70158;
          const c3 = c1 + 1;
          return c3 * t * t * t - c1 * t * t;
        },
        easeInOut(t) {
          return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        }
      };
      
      // ========== TIMELINE → PATH PROGRESS ==========
      // Maps wall-clock time to path position, accounting for pauses + segment speeds
      
      function timelineToPathProgress(tlProgress) {
        const tl = PROJECT_DATA.timeline;
        if (!tl || (!tl.totalPauseTime && !tl.hasVariableSpeed && !tl.totalTailTime && !tl.introTime)) {
          return tlProgress;
        }
        if (tl.pathDuration <= 0) return tlProgress;
        if (tlProgress >= 1.0) return 1.0;
        
        let adj = tlProgress * tl.totalDuration;
        
        // Intro time: path stays at 0
        if (tl.introTime > 0 && adj < tl.introTime) return 0;
        adj -= (tl.introTime || 0);
        
        // Tail time: path stays at 1.0
        const tailStart = tl.pathDuration + tl.totalPauseTime;
        if (tl.totalTailTime > 0 && adj >= tailStart) return 1.0;
        
        // Check pause markers — if inside a pause, path progress is frozen
        let accPause = 0;
        for (const m of (tl.pauseMarkers || [])) {
          if (adj < m.timelineStartMs) break;
          if (adj < m.timelineEndMs) return m.pathProgress;
          accPause += m.duration;
        }
        
        // Path time = adjusted time minus accumulated pauses
        const pathTime = adj - accPause;
        return pathTimeToProgress(pathTime);
      }
      
      function pathTimeToProgress(pathTime) {
        const tl = PROJECT_DATA.timeline;
        if (!tl) return 0;
        if (pathTime <= 0) return 0;
        if (pathTime >= tl.pathDuration) return 1;
        if (!tl.hasVariableSpeed || !tl.segmentMarkers || tl.segmentMarkers.length === 0) {
          return tl.pathDuration > 0 ? pathTime / tl.pathDuration : 0;
        }
        // Find segment containing this path time (linear search — typically 2-10 segments)
        let seg = tl.segmentMarkers[0];
        for (const s of tl.segmentMarkers) {
          if (pathTime >= s.startPathTime && pathTime < s.endPathTime) { seg = s; break; }
          if (pathTime >= s.endPathTime) seg = s;
        }
        if (pathTime >= seg.endPathTime) return seg.endPathProgress;
        const dur = seg.endPathTime - seg.startPathTime;
        if (dur <= 0) return seg.startPathProgress;
        const t = (pathTime - seg.startPathTime) / dur;
        return seg.startPathProgress + (seg.endPathProgress - seg.startPathProgress) * t;
      }
      
      // ========== SEGMENT LOOKUP ==========
      // Find which waypoint segment a path point belongs to
      function findSegmentIndex(pointIndex) {
        let si = 0;
        for (let s = 1; s < waypointPointIndices.length; s++) {
          if (pointIndex >= waypointPointIndices[s]) si = s;
          else break;
        }
        return si;
      }
      
      // ========== FALLBACK CATMULL-ROM ==========
      // Used only for exports without pre-computed pathPoints
      function catmullRomInterpolate(p0, p1, p2, p3, t, tension) {
        const t2 = t * t;
        const t3 = t2 * t;
        const v0x = (p2.x - p0.x) * tension;
        const v0y = (p2.y - p0.y) * tension;
        const v1x = (p3.x - p1.x) * tension;
        const v1y = (p3.y - p1.y) * tension;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return {
          x: p1.x + v0x * t + (3 * dx - 2 * v0x - v1x) * t2 + (2 * -dx + v0x + v1x) * t3,
          y: p1.y + v0y * t + (3 * dy - 2 * v0y - v1y) * t2 + (2 * -dy + v0y + v1y) * t3
        };
      }
      
      function createPath(waypoints, pointsPerSegment = 30, tension = 0.5) {
        if (waypoints.length < 2) return [];
        const path = [];
        const lastIndex = waypoints.length - 1;
        const step = 1 / pointsPerSegment;
        for (let i = 0; i < lastIndex; i++) {
          const p0 = waypoints[i === 0 ? 0 : i - 1];
          const p1 = waypoints[i];
          const p2 = waypoints[i + 1];
          const p3 = waypoints[i === lastIndex - 1 ? lastIndex : i + 2];
          for (let j = 0; j < pointsPerSegment; j++) {
            path.push(catmullRomInterpolate(p0, p1, p2, p3, j * step, tension));
          }
        }
        path.push(waypoints[lastIndex]);
        return path;
      }
      
      // ========== WAYPOINT VISIBILITY ==========
      function getWaypointVisibility(wp, wpProgress, currentProgress) {
        const motion = PROJECT_DATA.motion;
        const mode = motion.waypointVisibility;
        
        // Animation window parameters
        const animDuration = 0.05; // 5% of path for animation
        const animInStart = Math.max(0, wpProgress - animDuration);
        const animOutEnd = Math.min(1, wpProgress + animDuration);
        
        if (mode === 'always-show') {
          return { visible: true, scale: 1 };
        }
        if (mode === 'always-hide') {
          return { visible: false, scale: 0 };
        }
        
        const hidesBefore = mode === 'hide-before' || mode === 'hide-before-and-after';
        const hidesAfter = mode === 'hide-after' || mode === 'hide-before-and-after';
        
        // Before animation window
        if (currentProgress < animInStart) {
          return hidesBefore 
            ? { visible: false, scale: 0 }
            : { visible: true, scale: 1 };
        }
        
        // Animate in
        if (currentProgress < wpProgress && hidesBefore) {
          const t = (currentProgress - animInStart) / (wpProgress - animInStart);
          return { visible: true, scale: Easing.easeOutBack(Math.min(1, t)) };
        }
        
        // At waypoint
        if (currentProgress >= wpProgress && currentProgress <= wpProgress + 0.001) {
          return { visible: true, scale: 1 };
        }
        
        // Animate out
        if (currentProgress > wpProgress && currentProgress < animOutEnd && hidesAfter) {
          const t = (currentProgress - wpProgress) / (animOutEnd - wpProgress);
          return { visible: true, scale: 1 - Easing.easeInBack(Math.min(1, t)) };
        }
        
        // After animation window
        if (currentProgress >= animOutEnd) {
          return hidesAfter
            ? { visible: false, scale: 0 }
            : { visible: true, scale: 1 };
        }
        
        return { visible: true, scale: 1 };
      }
      
      // ========== PATH VISIBILITY ==========
      function getPathVisibleRange(currentProgress) {
        const motion = PROJECT_DATA.motion;
        const mode = motion.pathVisibility;
        const trail = motion.pathTrail || 0;
        
        if (mode === 'always-show') {
          return { start: 0, end: 1, fadeStart: 0 };
        }
        if (mode === 'always-hide') {
          return { start: 0, end: 0, fadeStart: 0 };
        }
        if (mode === 'show-on-progression') {
          return { start: 0, end: currentProgress, fadeStart: 0 };
        }
        if (mode === 'hide-on-progression') {
          return { start: currentProgress, end: 1, fadeStart: currentProgress };
        }
        if (mode === 'instantaneous') {
          // Trail effect - tail follows head with fade
          const trailLength = Math.min(trail, currentProgress * 0.8);
          const fadeStart = Math.max(0, currentProgress - trailLength);
          
          // Update trail tail (can only move forward)
          if (fadeStart > trailTailProgress) {
            trailTailProgress = fadeStart;
          }
          
          return { start: trailTailProgress, end: currentProgress, fadeStart: trailTailProgress };
        }
        
        return { start: 0, end: currentProgress, fadeStart: 0 };
      }
      
      // ========== BEACON RENDERING ==========
      function updateBeacons(deltaTime, currentProgress) {
        PROJECT_DATA.waypoints.forEach((wp, idx) => {
          if (!wp.isMajor || wp.beaconStyle === 'none') return;
          
          const wpProgress = wp.progress;
          const atWaypoint = currentProgress >= wpProgress - 0.01;
          
          if (!beaconStates.has(idx)) {
            beaconStates.set(idx, { 
              time: 0, 
              active: false, 
              completed: false,
              // Ripple state
              rings: [],
              spawnCount: 0,
              allSpawned: false,
              // Scale beacons (pop, grow, pulse)
              scale: 1,
              // Glow state
              glowOpacity: 0,
              glowRadius: 0
            });
          }
          
          const state = beaconStates.get(idx);
          
          if (atWaypoint && !state.active) {
            state.active = true;
            state.time = 0;
          }
          
          if (state.active && !state.completed) {
            state.time += deltaTime;
            
            // Beacon timing constants (matching app's BeaconRenderer)
            const RIPPLE_COUNT = 4;
            const RIPPLE_BASE_DURATION = 1.0;
            const RIPPLE_REFERENCE_SCALE = 1000;
            const RIPPLE_FADE_START = 0.5;
            
            // Update based on beacon type
            if (wp.beaconStyle === 'ripple') {
              // Ripple: 4 rings, each spawns at interval, expands to maxScale, fades out
              const maxScale = (wp.beaconScale || 10) * 100; // Convert to percentage (10 = 1000%)
              const ringDuration = RIPPLE_BASE_DURATION * (maxScale / RIPPLE_REFERENCE_SCALE);
              const spawnInterval = ringDuration;
              
              // Spawn rings based on elapsed time (max 4)
              if (!state.allSpawned) {
                const targetRingCount = Math.min(RIPPLE_COUNT, Math.floor(state.time / spawnInterval) + 1);
                while (state.spawnCount < targetRingCount) {
                  state.rings.push({ startTime: state.spawnCount * spawnInterval });
                  state.spawnCount++;
                  if (state.spawnCount >= RIPPLE_COUNT) {
                    state.allSpawned = true;
                  }
                }
              }
              
              // Update ring opacities based on age
              const fadeStartTime = ringDuration * RIPPLE_FADE_START;
              state.rings = state.rings.filter(ring => {
                const age = state.time - ring.startTime;
                if (age >= fadeStartTime) {
                  const fadeProgress = (age - fadeStartTime) / (ringDuration - fadeStartTime);
                  ring.opacity = Math.max(0, 1 - fadeProgress);
                } else {
                  ring.opacity = 1;
                }
                ring.scale = Math.min(1, age / ringDuration); // 0 to 1 over duration
                return age < ringDuration && ring.opacity > 0.01;
              });
              
              // Mark completed when all rings done
              if (state.allSpawned && state.rings.length === 0) {
                state.completed = true;
              }
            } else if (wp.beaconStyle === 'glow') {
              // Glow: radius eases in 0-1s, opacity fades 1-3s
              const GLOW_ONSET = 1.0;
              const GLOW_FADE = 2.0;
              const maxRadius = (wp.beaconScale || 10) * 0.8; // Scale factor
              
              if (state.time < GLOW_ONSET) {
                state.glowRadius = Easing.easeInOut(state.time / GLOW_ONSET) * maxRadius;
                state.glowOpacity = 0.8;
              } else if (state.time < GLOW_ONSET + GLOW_FADE) {
                state.glowRadius = maxRadius;
                state.glowOpacity = 0.8 * (1 - (state.time - GLOW_ONSET) / GLOW_FADE);
              } else {
                state.glowOpacity = 0;
                state.completed = true;
              }
            } else if (wp.beaconStyle === 'pulse') {
              // Pulse: oscillates 100%→200%→50%→200%... during hold
              const PULSE_CYCLE = 4.0;
              const PULSE_MAX = 2.0;
              const PULSE_MIN = 0.5;
              
              // Initial scale up (1s)
              if (state.time < 1) {
                state.scale = 1 + Easing.easeInOut(state.time);
              } else {
                // Oscillate between max and min
                const cycleTime = (state.time - 1) % PULSE_CYCLE;
                const halfCycle = PULSE_CYCLE / 2;
                if (cycleTime < halfCycle) {
                  // Max to min
                  state.scale = PULSE_MAX - (PULSE_MAX - PULSE_MIN) * Easing.easeInOut(cycleTime / halfCycle);
                } else {
                  // Min to max
                  state.scale = PULSE_MIN + (PULSE_MAX - PULSE_MIN) * Easing.easeInOut((cycleTime - halfCycle) / halfCycle);
                }
              }
            } else if (wp.beaconStyle === 'pop') {
              // Pop: quick 100%→200%→100% (0.5s up, 0.5s down)
              const POP_UP = 0.5;
              const POP_DOWN = 0.5;
              const POP_PEAK = 2.0;
              
              if (state.time < POP_UP) {
                state.scale = 1 + (POP_PEAK - 1) * Easing.easeOutBack(state.time / POP_UP);
              } else if (state.time < POP_UP + POP_DOWN) {
                state.scale = POP_PEAK - (POP_PEAK - 1) * Easing.easeInOut((state.time - POP_UP) / POP_DOWN);
              } else {
                state.scale = 1;
                state.completed = true;
              }
            } else if (wp.beaconStyle === 'grow') {
              // Grow: 100%→200% over 2s, hold at 200%
              const GROW_UP = 2.0;
              const GROW_PEAK = 2.0;
              
              if (state.time < GROW_UP) {
                state.scale = 1 + (GROW_PEAK - 1) * Easing.easeInOut(state.time / GROW_UP);
              } else {
                state.scale = GROW_PEAK;
              }
            }
          }
        });
      }
      
      function renderBeacon(wp, idx, x, y, baseSize, sizeScale) {
        const state = beaconStates.get(idx);
        if (!state || !state.active) return 1; // Return scale 1 if no beacon
        
        const color = wp.dotColor || PROJECT_DATA.styles.dotColor;
        const scaledBaseSize = baseSize * sizeScale;
        
        if (wp.beaconStyle === 'ripple') {
          // Draw expanding rings - each ring scales from 0 to maxScale
          const maxScale = wp.rippleMaxScale || (wp.beaconScale || 10);
          
          state.rings.forEach(ring => {
            // ring.scale goes 0→1 over duration, multiply by maxScale for final size
            const radius = scaledBaseSize * ring.scale * maxScale;
            
            if (radius > 0 && ring.opacity > 0.01) {
              ctx.beginPath();
              ctx.strokeStyle = color;
              ctx.globalAlpha = ring.opacity;
              ctx.lineWidth = (wp.rippleThickness || 2) * sizeScale;
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.stroke();
            }
          });
          ctx.globalAlpha = 1;
          return 1;
        } else if (wp.beaconStyle === 'glow') {
          // Draw glow effect
          if (state.glowOpacity > 0) {
            const glowRadius = state.glowRadius * scaledBaseSize;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath();
            ctx.fillStyle = gradient;
            ctx.globalAlpha = state.glowOpacity;
            ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          return 1;
        }
        
        // For pop, grow, pulse - return scale to apply to waypoint
        return state.scale || 1;
      }
      
      // ========== CAMERA ==========
      // Camera state for smooth transitions
      let smoothedZoom = 1;
      let smoothedCenterX = 0;
      let smoothedCenterY = 0;
      let lastCameraProgress = -1;
      
      // Camera constants (matching app's CameraService)
      const CAMERA_SMOOTHING = 0.08;
      const ZOOM_SMOOTHING = 0.06;
      
      /**
       * Logarithmic zoom interpolation for perceptual consistency
       * 2x feels like same "step" as 1x→2x and 4x→8x
       */
      function interpolateZoomLog(fromZoom, toZoom, t) {
        if (fromZoom <= 0 || toZoom <= 0) return 1;
        const logFrom = Math.log2(fromZoom);
        const logTo = Math.log2(toZoom);
        return Math.pow(2, logFrom + (logTo - logFrom) * t);
      }
      
      /**
       * Find which waypoint segment we're in based on progress
       */
      function findWaypointSegment(currentProgress) {
        // Camera keyframes over MAJOR waypoints only (mirrors app CameraService):
        // minors shape path geometry, not zoom, so they must not inject a 1x
        // keyframe that dips the zoom at minors. See decision-log 2026-06-16.
        const waypoints = PROJECT_DATA.waypoints.filter(wp => wp.isMajor !== false);
        let prevIndex = -1;
        let nextIndex = 0;
        
        for (let i = 0; i < waypoints.length; i++) {
          if (currentProgress >= waypoints[i].progress) {
            prevIndex = i;
            nextIndex = i + 1;
          } else {
            break;
          }
        }
        
        // Calculate progress within segment
        let segmentProgress = 0;
        if (prevIndex >= 0 && nextIndex < waypoints.length) {
          const segmentStart = waypoints[prevIndex].progress;
          const segmentEnd = waypoints[nextIndex].progress;
          const segmentLength = segmentEnd - segmentStart;
          if (segmentLength > 0) {
            segmentProgress = (currentProgress - segmentStart) / segmentLength;
          }
        }
        
        return { prevIndex, nextIndex, segmentProgress };
      }
      
      /**
       * Calculate target zoom based on waypoint camera settings
       */
      function calculateTargetZoom(currentProgress) {
        // Same major-only predicate as findWaypointSegment so the returned
        // prev/next indices line up with this list. See decision-log 2026-06-16.
        const waypoints = PROJECT_DATA.waypoints.filter(wp => wp.isMajor !== false);
        if (!waypoints || waypoints.length === 0) return 1;
        
        const { prevIndex, nextIndex, segmentProgress } = findWaypointSegment(currentProgress);
        
        // Get zoom values
        const prevZoom = prevIndex >= 0 ? (waypoints[prevIndex].camera?.zoom || 1) : 1;
        const nextZoom = nextIndex < waypoints.length ? (waypoints[nextIndex].camera?.zoom || 1) : prevZoom;
        const zoomMode = nextIndex < waypoints.length ? (waypoints[nextIndex].camera?.zoomMode || 'continuous') : 'continuous';
        
        // Before first waypoint
        if (prevIndex === -1) {
          const firstZoom = waypoints[0].camera?.zoom || 1;
          const firstProgress = waypoints[0].progress || 0;
          if (currentProgress < firstProgress && firstProgress > 0) {
            const t = Easing.easeInOut(currentProgress / firstProgress);
            return interpolateZoomLog(1, firstZoom, t);
          }
          return firstZoom;
        }
        
        // At or after last waypoint
        if (nextIndex >= waypoints.length) {
          return prevZoom;
        }
        
        // Between waypoints - use continuous interpolation
        const easedProgress = Easing.easeInOut(segmentProgress);
        return interpolateZoomLog(prevZoom, nextZoom, easedProgress);
      }
      
      /**
       * Get camera transform with smooth follow-cam effect
       */
      function getCameraTransform(headX, headY, currentProgress) {
        const targetZoom = calculateTargetZoom(currentProgress);
        
        // Check if any MAJOR waypoint has zoom > 1 (minors aren't zoom keyframes)
        const hasZoom = PROJECT_DATA.waypoints.some(wp => wp.isMajor !== false && (wp.camera?.zoom || 1) > 1);
        if (!hasZoom && Math.abs(targetZoom - 1) < 0.001) {
          return null;
        }
        
        // Detect scrubbing/reset (large progress jump) - snap immediately
        const progressDelta = Math.abs(currentProgress - lastCameraProgress);
        const isJump = lastCameraProgress < 0 || progressDelta > 0.05;
        lastCameraProgress = currentProgress;
        
        // Calculate clamped center position
        const halfVisibleW = cw / (2 * targetZoom);
        const halfVisibleH = ch / (2 * targetZoom);
        const minX = halfVisibleW;
        const maxX = cw - halfVisibleW;
        const minY = halfVisibleH;
        const maxY = ch - halfVisibleH;
        
        let targetCenterX = Math.max(minX, Math.min(maxX, headX));
        let targetCenterY = Math.max(minY, Math.min(maxY, headY));
        
        if (isJump) {
          // Snap to target on scrub/reset
          smoothedZoom = targetZoom;
          smoothedCenterX = targetCenterX;
          smoothedCenterY = targetCenterY;
        } else {
          // Apply exponential smoothing for gentle momentum
          smoothedZoom += (targetZoom - smoothedZoom) * ZOOM_SMOOTHING;
          smoothedCenterX += (targetCenterX - smoothedCenterX) * CAMERA_SMOOTHING;
          smoothedCenterY += (targetCenterY - smoothedCenterY) * CAMERA_SMOOTHING;
        }
        
        // If effectively 1x zoom, transition smoothly to disabled
        if (Math.abs(smoothedZoom - 1) < 0.01) {
          smoothedZoom += (1 - smoothedZoom) * ZOOM_SMOOTHING;
          smoothedCenterX += (cw / 2 - smoothedCenterX) * CAMERA_SMOOTHING;
          smoothedCenterY += (ch / 2 - smoothedCenterY) * CAMERA_SMOOTHING;
          
          if (Math.abs(smoothedZoom - 1) < 0.001) {
            return null;
          }
        }
        
        return {
          zoom: smoothedZoom,
          centerX: smoothedCenterX,
          centerY: smoothedCenterY
        };
      }
      
      // ========== INITIALIZATION ==========
      function buildPathPoints() {
        if (PROJECT_DATA.pathPoints && PROJECT_DATA.pathPoints.length > 0) {
          // Use pre-computed path (includes shapes: squiggle, randomised)
          pathPoints = PROJECT_DATA.pathPoints.map(p => ({ x: p.x * cw, y: p.y * ch }));
        } else {
          // Fallback: recompute with Catmull-Rom (old exports without pre-computed points)
          const wps = PROJECT_DATA.waypoints.map(wp => ({ x: wp.x * cw, y: wp.y * ch }));
          pathPoints = createPath(wps);
        }
        // Build segment boundary indices from waypoint progress values
        const total = pathPoints.length;
        const wpProg = PROJECT_DATA.waypointProgressValues;
        const wps = PROJECT_DATA.waypoints;
        waypointPointIndices = wpProg
          ? wpProg.map(p => Math.round(p * (total - 1)))
          : wps.map((_, i) => Math.round((i / (wps.length - 1)) * (total - 1)));
      }
      
      function init() {
        if (BACKGROUND_IMAGE) {
          backgroundImg = new Image();
          backgroundImg.onload = () => {
            canvas.width = backgroundImg.width;
            canvas.height = backgroundImg.height;
            cw = canvas.width;
            ch = canvas.height;
            buildPathPoints();
            render();
          };
          backgroundImg.src = BACKGROUND_IMAGE;
        } else {
          canvas.width = 800;
          canvas.height = 600;
          cw = canvas.width;
          ch = canvas.height;
          buildPathPoints();
          render();
        }
      }
      
      // ========== MAIN RENDER ==========
      function render() {
        const styles = PROJECT_DATA.styles;
        const motion = PROJECT_DATA.motion;
        const duration = PROJECT_DATA.animation.duration;
        
        // Calculate scale factor for sizes
        // Sizes in the app are specified in display canvas pixels
        // HTML export uses full image dimensions, so we need to scale proportionally
        const displayDims = PROJECT_DATA.displayDimensions || { width: 1000, height: 800 };
        const displaySize = Math.min(displayDims.width, displayDims.height);
        const canvasSize = Math.min(cw, ch);
        const sizeScale = canvasSize / displaySize;
        
        // Get current head position for camera (smooth interpolation between path points)
        const totalPoints = pathPoints.length;
        const exactIndex = (totalPoints - 1) * progress;
        const lowIndex = Math.floor(exactIndex);
        const highIndex = Math.min(lowIndex + 1, totalPoints - 1);
        const t = exactIndex - lowIndex; // Fractional part for interpolation
        
        const lowPoint = pathPoints[lowIndex] || { x: cw/2, y: ch/2 };
        const highPoint = pathPoints[highIndex] || lowPoint;
        
        // Linear interpolation between adjacent path points for smooth camera
        const headPos = {
          x: lowPoint.x + (highPoint.x - lowPoint.x) * t,
          y: lowPoint.y + (highPoint.y - lowPoint.y) * t
        };
        
        // Camera transform (pass progress for per-waypoint zoom interpolation)
        const camera = getCameraTransform(headPos.x, headPos.y, progress);
        
        // Clear with white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
        
        // Apply camera transform
        if (camera) {
          ctx.save();
          ctx.translate(cw / 2, ch / 2);
          ctx.scale(camera.zoom, camera.zoom);
          ctx.translate(-camera.centerX, -camera.centerY);
        }
        
        // Draw background (respects backgroundVisibility mode)
        const bgMode = motion.backgroundVisibility || 'always-show';
        
        if (backgroundImg && bgMode !== 'always-hide') {
          if (bgMode === 'spotlight-reveal' && progress > 0) {
            // Spotlight reveal: show background only in a feathered circle at head
            const revealR = (motion.revealSize || 20) * sizeScale * 5;
            const feather = (motion.revealFeather || 50) / 100;
            const outerR = revealR * (1 + feather);
            
            // Draw background to offscreen, then composite via radial mask
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(backgroundImg, 0, 0);
            
            if (PROJECT_DATA.background.overlay !== 0) {
              const overlay = PROJECT_DATA.background.overlay;
              ctx.fillStyle = overlay > 0 
                ? \`rgba(255,255,255,\${Math.abs(overlay) / 100})\`
                : \`rgba(0,0,0,\${Math.abs(overlay) / 100})\`;
              ctx.fillRect(0, 0, cw, ch);
            }
            
            // Punch out everything outside the spotlight using destination-in
            ctx.globalCompositeOperation = 'destination-in';
            const grad = ctx.createRadialGradient(headPos.x, headPos.y, 0, headPos.x, headPos.y, outerR);
            grad.addColorStop(0, 'rgba(0,0,0,1)');
            grad.addColorStop(Math.max(0.01, 1 - feather), 'rgba(0,0,0,1)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, cw, ch);
            ctx.restore();
            
            // Re-fill white behind transparent areas (compositing cleared them)
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, cw, ch);
            ctx.globalCompositeOperation = 'source-over';
          } else {
            // Normal: draw full background
            ctx.drawImage(backgroundImg, 0, 0);
            
            if (PROJECT_DATA.background.overlay !== 0) {
              const overlay = PROJECT_DATA.background.overlay;
              ctx.fillStyle = overlay > 0 
                ? \`rgba(255,255,255,\${Math.abs(overlay) / 100})\`
                : \`rgba(0,0,0,\${Math.abs(overlay) / 100})\`;
              ctx.fillRect(0, 0, cw, ch);
            }
          }
        }
        
        // Get path visible range
        const pathRange = getPathVisibleRange(progress);
        
        // Draw path
        if (pathPoints.length > 1 && motion.pathVisibility !== 'always-hide') {
          const startPoint = Math.floor(pathRange.start * totalPoints);
          const fadeStartPoint = Math.floor(pathRange.fadeStart * totalPoints);
          
          // Use lowIndex (from head interpolation) as the endpoint for consistency
          // This ensures the discrete path ends exactly where the interpolated segment begins
          const endPoint = lowIndex + 1; // Draw up to and including lowIndex
          
          if (endPoint > startPoint || progress > 0) {
            // Helper: get trail opacity for a point
            const trailOpacity = (i) => {
              if (motion.pathVisibility !== 'instantaneous' || !motion.pathTrail) return 1;
              const visLen = endPoint - startPoint;
              return visLen > 0 ? (i - startPoint) / visLen : 1;
            };
            
            // Path glow pass (soft halo beneath the casing) — additive layered strokes,
            // colour derived per-segment. Mirrors RenderingService.glowLayers().
            if (styles.pathGlow && styles.pathGlow.enabled) {
              const glowIntensity = styles.pathGlow.intensity != null ? styles.pathGlow.intensity : ${RENDERING.PATH_GLOW_DEFAULT_INTENSITY};
              const glowLayerCount = ${RENDERING.PATH_GLOW_LAYERS};
              const glowMaxExtra = ${RENDERING.PATH_GLOW_MAX_EXTRA_WIDTH} * glowIntensity * sizeScale;
              const glowAlpha = ${RENDERING.PATH_GLOW_LAYER_ALPHA};
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.setLineDash([]);
              for (let i = Math.max(1, startPoint); i < endPoint; i++) {
                const si = findSegmentIndex(i);
                const wp = PROJECT_DATA.waypoints[si];
                const segColor = wp.segmentColor || styles.pathColor;
                if (segColor === 'transparent') continue;
                const segWidth = (wp.segmentWidth || styles.pathWidth) * sizeScale;
                ctx.strokeStyle = segColor;
                for (let gl = 0; gl < glowLayerCount; gl++) {
                  const frac = (glowLayerCount - gl) / glowLayerCount;
                  ctx.lineWidth = segWidth + glowMaxExtra * frac;
                  ctx.globalAlpha = glowAlpha * trailOpacity(i);
                  ctx.beginPath();
                  ctx.moveTo(pathPoints[i-1].x, pathPoints[i-1].y);
                  ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
                  ctx.stroke();
                }
              }
              ctx.restore();
            }
            
            // White casing pass (contrast outline underneath coloured path)
            if (styles.showPathCasing !== false) {
              for (let i = Math.max(1, startPoint); i < endPoint; i++) {
                const si = findSegmentIndex(i);
                const wp = PROJECT_DATA.waypoints[si];
                const segColor = wp.segmentColor || styles.pathColor;
                if (segColor === 'transparent') continue;
                const segWidth = (wp.segmentWidth || styles.pathWidth) * sizeScale;
                ctx.beginPath();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = segWidth + 4 * sizeScale;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = trailOpacity(i);
                ctx.moveTo(pathPoints[i-1].x, pathPoints[i-1].y);
                ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
                ctx.stroke();
              }
            }
            
            // Colour pass (per-segment colours, widths, and line styles)
            for (let i = Math.max(1, startPoint); i < endPoint; i++) {
              const si = findSegmentIndex(i);
              const wp = PROJECT_DATA.waypoints[si];
              const segColor = wp.segmentColor || styles.pathColor;
              if (segColor === 'transparent') continue;
              const segWidth = (wp.segmentWidth || styles.pathWidth) * sizeScale;
              const segStyle = wp.segmentStyle || 'solid';
              ctx.beginPath();
              ctx.strokeStyle = segColor;
              ctx.lineWidth = segWidth;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.globalAlpha = trailOpacity(i);
              if (segStyle === 'dashed') ctx.setLineDash([segWidth * 3, segWidth * 2]);
              else if (segStyle === 'dotted') ctx.setLineDash([segWidth, segWidth * 2]);
              else ctx.setLineDash([]);
              ctx.moveTo(pathPoints[i-1].x, pathPoints[i-1].y);
              ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
              ctx.stroke();
            }
            ctx.setLineDash([]);
            
            // Draw final interpolated segment (last discrete point → smooth head)
            if (lowIndex >= 0 && lowIndex < totalPoints) {
              const si = findSegmentIndex(lowIndex);
              const wp = PROJECT_DATA.waypoints[si];
              const segColor = wp.segmentColor || styles.pathColor;
              const segWidth = (wp.segmentWidth || styles.pathWidth) * sizeScale;
              if (segColor !== 'transparent') {
                // Path glow beneath the final interpolated segment (additive layers)
                if (styles.pathGlow && styles.pathGlow.enabled) {
                  const gI = styles.pathGlow.intensity != null ? styles.pathGlow.intensity : ${RENDERING.PATH_GLOW_DEFAULT_INTENSITY};
                  const gMaxExtra = ${RENDERING.PATH_GLOW_MAX_EXTRA_WIDTH} * gI * sizeScale;
                  const gLayers = ${RENDERING.PATH_GLOW_LAYERS};
                  const gAlpha = ${RENDERING.PATH_GLOW_LAYER_ALPHA};
                  ctx.save();
                  ctx.globalCompositeOperation = 'lighter';
                  ctx.lineCap = 'round';
                  ctx.lineJoin = 'round';
                  ctx.strokeStyle = segColor;
                  for (let gl = 0; gl < gLayers; gl++) {
                    const frac = (gLayers - gl) / gLayers;
                    ctx.lineWidth = segWidth + gMaxExtra * frac;
                    ctx.globalAlpha = gAlpha;
                    ctx.beginPath();
                    ctx.moveTo(pathPoints[lowIndex].x, pathPoints[lowIndex].y);
                    ctx.lineTo(headPos.x, headPos.y);
                    ctx.stroke();
                  }
                  ctx.restore();
                }
                ctx.beginPath();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = segWidth + 4 * sizeScale;
                ctx.lineCap = 'round';
                ctx.globalAlpha = 1;
                ctx.moveTo(pathPoints[lowIndex].x, pathPoints[lowIndex].y);
                ctx.lineTo(headPos.x, headPos.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.strokeStyle = segColor;
                ctx.lineWidth = segWidth;
                ctx.lineCap = 'round';
                ctx.globalAlpha = 1;
                ctx.moveTo(pathPoints[lowIndex].x, pathPoints[lowIndex].y);
                ctx.lineTo(headPos.x, headPos.y);
                ctx.stroke();
              }
            }
            
            ctx.globalAlpha = 1;
            
            // Draw path head (use interpolated position for smooth movement)
            if (endPoint > 0 && styles.pathHead.style !== 'none') {
              // Use the same interpolated headPos calculated earlier for camera
              const head = headPos;
              const prevIdx = Math.max(0, lowIndex - 1);
              const prev = pathPoints[prevIdx] || head;
              const rotation = Math.atan2(head.y - prev.y, head.x - prev.x);
              
              ctx.save();
              ctx.translate(head.x, head.y);
              
              let finalRotation = styles.pathHead.rotationMode !== 'fixed' ? rotation : 0;
              finalRotation += (styles.pathHead.rotationOffset || 0) * Math.PI / 180;
              ctx.rotate(finalRotation);
              
              const size = styles.pathHead.size * sizeScale;
              
              if (styles.pathHead.style === 'arrow') {
                ctx.beginPath();
                ctx.fillStyle = styles.pathHead.color;
                ctx.moveTo(size, 0);
                ctx.lineTo(-size/2, size/2);
                ctx.lineTo(-size/4, 0);
                ctx.lineTo(-size/2, -size/2);
                ctx.closePath();
                ctx.fill();
              } else if (styles.pathHead.style === 'dot') {
                ctx.beginPath();
                ctx.fillStyle = styles.pathHead.color;
                ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                ctx.fill();
              }
              
              ctx.restore();
            }
          }
        }
        
        // Draw waypoints with visibility, beacons, marker styles, and labels
        PROJECT_DATA.waypoints.forEach((wp, idx) => {
          if (!wp.isMajor) return;
          
          const wpX = wp.x * cw;
          const wpY = wp.y * ch;
          const wpProgress = wp.progress;
          
          // Get visibility state
          const visibility = getWaypointVisibility(wp, wpProgress, progress);
          if (!visibility.visible || visibility.scale <= 0) return;
          
          // Render beacon and get scale override
          const beaconScale = renderBeacon(wp, idx, wpX, wpY, wp.dotSize || styles.dotSize, sizeScale);
          const finalScale = visibility.scale * beaconScale;
          
          const size = (wp.dotSize || styles.dotSize) * finalScale * sizeScale;
          
          // Draw marker (respects style and transparent/none)
          const markerColor = wp.dotColor || styles.dotColor;
          const mStyle = wp.markerStyle || 'dot';
          
          if (markerColor !== 'transparent' && mStyle !== 'none') {
            if (mStyle === 'square') {
              // White outline
              ctx.fillStyle = 'white';
              ctx.fillRect(wpX - size - 2*sizeScale, wpY - size - 2*sizeScale,
                           (size + 2*sizeScale) * 2, (size + 2*sizeScale) * 2);
              // Fill
              ctx.fillStyle = markerColor;
              ctx.fillRect(wpX - size, wpY - size, size * 2, size * 2);
            } else {
              // Default: circle
              ctx.beginPath();
              ctx.fillStyle = markerColor;
              ctx.arc(wpX, wpY, size, 0, Math.PI * 2);
              ctx.fill();
              // White outline
              ctx.beginPath();
              ctx.strokeStyle = 'white';
              ctx.lineWidth = 2 * sizeScale;
              ctx.arc(wpX, wpY, size + 2 * sizeScale, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          
          // Draw label
          if (wp.label) {
            const fontSize = Math.max(12, 14 * sizeScale);
            ctx.font = fontSize + 'px sans-serif';
            ctx.textBaseline = 'middle';
            const pad = size + 8 * sizeScale;
            let lx = wpX, ly = wpY;
            const pos = wp.labelPosition || 'right';
            if (pos === 'right') { ctx.textAlign = 'left'; lx += pad; }
            else if (pos === 'left') { ctx.textAlign = 'right'; lx -= pad; }
            else if (pos === 'above') { ctx.textAlign = 'center'; ly -= pad; }
            else if (pos === 'below') { ctx.textAlign = 'center'; ly += pad; }
            else { ctx.textAlign = 'left'; lx += pad; }
            // White shadow for readability
            ctx.fillStyle = 'white';
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                if (dx || dy) ctx.fillText(wp.label, lx + dx, ly + dy);
              }
            }
            ctx.fillStyle = '#333333';
            ctx.fillText(wp.label, lx, ly);
          }
        });
        
        // Restore camera transform
        if (camera) {
          ctx.restore();
        }
        
        // Update UI (progress bar shows timeline progress, not path progress)
        const tlProg = duration > 0 ? Math.min(1, currentTimeMs / duration) : 0;
        timelineProgress.style.width = (tlProg * 100) + '%';
        const totalSec = duration / 1000;
        const currentSec = totalSec * tlProg;
        timeDisplay.textContent = formatTime(currentSec) + ' / ' + formatTime(totalSec);
      }
      
      function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + secs.toString().padStart(2, '0');
      }
      
      // ========== ANIMATION LOOP ==========
      function animate(timestamp) {
        if (!isPlaying) return;
        
        if (lastTime === 0) lastTime = timestamp;
        const deltaMs = (timestamp - lastTime) * playbackSpeed;
        const deltaSec = deltaMs / 1000;
        lastTime = timestamp;
        
        const duration = PROJECT_DATA.animation.duration;
        currentTimeMs += deltaMs;
        
        // Convert timeline progress to path progress using pre-computed timeline
        const tlProg = Math.min(1, currentTimeMs / duration);
        progress = timelineToPathProgress(tlProg);
        
        // Update beacons
        updateBeacons(deltaSec, progress);
        
        if (tlProg >= 1) {
          currentTimeMs = duration;
          progress = 1;
          isPlaying = false;
          playBtn.textContent = '▶ Play';
        }
        
        render();
        
        if (isPlaying) {
          requestAnimationFrame(animate);
        }
      }
      
      // ========== EVENT LISTENERS ==========
      playBtn.addEventListener('click', () => {
        const duration = PROJECT_DATA.animation.duration;
        if (currentTimeMs >= duration) {
          currentTimeMs = 0;
          progress = 0;
          trailTailProgress = 0;
          beaconStates.clear();
        }
        isPlaying = !isPlaying;
        playBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
        lastTime = 0;
        if (isPlaying) requestAnimationFrame(animate);
      });
      
      resetBtn.addEventListener('click', () => {
        isPlaying = false;
        currentTimeMs = 0;
        progress = 0;
        trailTailProgress = 0;
        beaconStates.clear();
        // Reset camera state
        lastCameraProgress = -1;
        smoothedZoom = 1;
        smoothedCenterX = cw / 2;
        smoothedCenterY = ch / 2;
        playBtn.textContent = '▶ Play';
        lastTime = 0;
        render();
      });
      
      timeline.addEventListener('click', (e) => {
        const rect = timeline.getBoundingClientRect();
        const tlProg = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const duration = PROJECT_DATA.animation.duration;
        const newTimeMs = tlProg * duration;
        const newProgress = timelineToPathProgress(tlProg);
        
        // Reset trail if scrubbing backward
        if (newProgress < progress) {
          trailTailProgress = 0;
          beaconStates.clear();
        }
        
        currentTimeMs = newTimeMs;
        progress = newProgress;
        render();
      });
      
      speedSelect.addEventListener('change', (e) => {
        playbackSpeed = parseFloat(e.target.value);
      });
      
      // Initialize
      init();
    })();
    `;
  }

  /**
   * Escape HTML special characters
   */
  _escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Estimate the file size of the export
   * @param {HTMLImageElement} backgroundImage - Background image
   * @returns {Promise<Object>} Size estimate { bytes, formatted }
   */
  async estimateSize(backgroundImage) {
    let imageSize = 0;
    if (backgroundImage) {
      const base64 = await this._imageToBase64(backgroundImage);
      imageSize = base64.length * 0.75; // Base64 is ~33% larger than binary
    }
    
    const playerSize = 8000; // ~8KB for player script
    const dataSize = 2000;   // ~2KB for project data (estimate)
    const htmlSize = 3000;   // ~3KB for HTML structure
    
    const totalBytes = imageSize + playerSize + dataSize + htmlSize;
    
    return {
      bytes: totalBytes,
      formatted: this._formatBytes(totalBytes)
    };
  }

  _formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}
