/**
 * HTMLExportService - Exports the animation as a self-contained HTML file.
 *
 * Version 3.0 - real-stack player (Phase 5 unification)
 *
 * The exported file embeds three things:
 * - the background image as a base64 data URL,
 * - the full coordVersion-9 project snapshot (waypoints, scene/flow layers,
 *   styles, motion, camera and export settings, custom image assets),
 * - the pre-built player bundle (docs/player.js) — PlayerApp plus the app's
 *   own PlayerCore/AnimationEngine/SwarmEngine/RenderingService stack.
 *
 * The former hand-written template player (its own timeline-mapping copy and
 * delta-time beacon updates) is gone: exported files now evaluate scenes with
 * literally the same code as the app, so swarm layers, beacons, pauses,
 * camera, labels and area highlights match preview by construction
 * (deterministic-timeline mandate, decision-log 2026-08-17).
 *
 * Benefits over video export are unchanged: 80–95% smaller files,
 * interactive scrubbing, responsive vector rendering, iframe-friendly.
 */

import { ImageAsset, IMAGE_LIMITS } from '../models/ImageAsset.js';

export class HTMLExportService {
  constructor() {
    this.playerVersion = '3.0.0';
    this._playerBundle = null;
    this._playerBundlePromise = null;

    // Warm the standalone player while the user works. A failed warm-up is
    // deliberately non-fatal and is not cached, so export can retry after a
    // transient network or deployment error.
    this._preloadAttempt = this.preloadPlayerBundle().catch(() => null);
  }

  /**
   * Start (or join) the successful-only player bundle cache.
   * @returns {Promise<string>}
   */
  preloadPlayerBundle() {
    return this._fetchPlayerBundle();
  }

  /**
   * Export the current project as a self-contained HTML file.
   * @param {Object} options - Export options
   * @param {Object} options.projectData - Full coordVersion-9 project snapshot
   *   (the persistence mixin's _buildProjectSnapshot shape, assets included)
   * @param {string} options.backgroundDataURL - Exact retained PNG/JPEG/WebP
   *   source data URL. The service never re-encodes it.
   * @param {string} options.title - Project title for the HTML page
   * @returns {Promise<Blob>} HTML file as a Blob
   */
  async exportHTML(options) {
    const { projectData, backgroundDataURL, title = 'Route animation' } = options;
    const retainedBackground = this._validateBackgroundDataURL(backgroundDataURL);

    const playerBundle = await this._fetchPlayerBundle();
    const html = this._generateHTML(title, retainedBackground, projectData, playerBundle);
    return new Blob([html], { type: 'text/html' });
  }

  /**
   * Fetch the pre-built player bundle from the app's own origin.
   * build.js emits it to docs/player.js beside app.js, so the dev server and
   * GitHub Pages both serve it at a URL relative to the page.
   * @returns {Promise<string>} The bundle source, ready to inline
   */
  _fetchPlayerBundle() {
    if (this._playerBundle !== null) {
      return Promise.resolve(this._playerBundle);
    }
    if (this._playerBundlePromise) {
      return this._playerBundlePromise;
    }

    this._playerBundlePromise = this._loadPlayerBundle()
      .then((playerBundle) => {
        this._playerBundle = playerBundle;
        this._playerBundlePromise = null;
        return playerBundle;
      })
      .catch((error) => {
        // Failure is never sticky: the next preload/export gets a fresh try.
        this._playerBundlePromise = null;
        throw error;
      });

    return this._playerBundlePromise;
  }

  async _loadPlayerBundle() {
    const url = new URL('player.js', document.baseURI);
    const version = typeof APP_VERSION === 'string' ? APP_VERSION : 'dev';
    url.searchParams.set('v', version);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`The player bundle could not be loaded (HTTP ${response.status}). ` +
        'Rebuild the app (npm run build) and reload the page, then try exporting again.');
    }
    const text = await response.text();
    // Dev builds carry a sourcemap pointer; the .map file never ships inside
    // an export, so strip the comment to avoid dead-reference DevTools noise.
    return text.replace(/\n?\/\/# sourceMappingURL=\S+\s*$/, '\n');
  }

  /**
   * Serialise a value for embedding inside an inline <script>.
   * Escapes `<` so no `</script>` sequence inside project strings can
   * terminate the script block early, and the line separators U+2028/2029
   * for defence in depth on older parsers.
   */
  _embedJSON(value) {
    return JSON.stringify(value)
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  _validateBackgroundDataURL(dataURL) {
    const unavailableMessage =
      'Original background bytes are unavailable. Reload the PNG, JPEG, or WebP background before exporting HTML.';
    try {
      const metadata = ImageAsset.inspectDataURL(dataURL);
      if (!IMAGE_LIMITS.ALLOWED_MIME_TYPES.includes(metadata.mimeType) ||
          metadata.byteLength <= 0 || metadata.byteLength > IMAGE_LIMITS.MAX_BYTES ||
          !ImageAsset._hasExpectedSignature(dataURL, metadata.mimeType)) {
        throw new Error('Unsupported or invalid background source');
      }
    } catch (error) {
      console.error('HTML export background source is invalid:', error);
      throw new Error(unavailableMessage);
    }
    return dataURL;
  }

  /**
   * Generate the complete HTML page: shell + embedded data + inlined player.
   *
   * Shell styling follows the app's standards (UI-STANDARDS.md): Carbon
   * productive patterns implemented with UoN token values inlined (the export
   * cannot reference styles/tokens.css), 44px targets, visible focus rings,
   * 7:1 text contrast, native form controls, sentence case.
   */
  _generateHTML(title, backgroundDataURL, projectData, playerBundle) {
    const safeTitle = this._escapeHTML(title);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    /* UoN token values (inlined from styles/tokens.css for standalone use) */
    :root {
      --uon-blue: #003A65;
      --text-primary: #161616;      /* 16.7:1 on white */
      --text-secondary: #525252;    /* 7.5:1 on white */
      --surface: #ffffff;
      --surface-secondary: #f4f4f4;
      --border-subtle: #e0e0e0;
      --border-interactive: #767676;
      --focus-outer: #0F62FE;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--surface);
      color: var(--text-primary);
      display: flex;
      flex-direction: column;
    }
    .canvas-wrapper {
      flex: 1;
      min-height: 0;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface);
    }
    canvas { display: block; }
    .player-error {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 32px;
      text-align: center;
      background: var(--surface);
    }
    .player-error[hidden] { display: none; }
    .controls {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      padding: 8px 16px;
      background: var(--surface-secondary);
      border-top: 1px solid var(--border-subtle);
    }
    .btn {
      min-height: 44px;
      min-width: 72px;
      padding: 0 16px;
      border: 1px solid transparent;
      cursor: pointer;
      font-size: 14px;
      font-family: inherit;
    }
    .btn-primary {
      background: var(--uon-blue);
      color: #ffffff;
    }
    .btn-secondary {
      background: var(--surface);
      color: var(--text-primary);
      border-color: var(--border-interactive);
    }
    .btn:hover { filter: brightness(1.15); }
    .btn:focus-visible,
    .timeline:focus-visible,
    select:focus-visible {
      outline: 3px solid var(--focus-outer);
      outline-offset: 2px;
    }
    .timeline {
      flex: 1;
      min-width: 160px;
      height: 44px;           /* full-height hit area; the track stays slim */
      accent-color: var(--uon-blue);
      cursor: pointer;
    }
    .time-display {
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .speed-control {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-primary);
    }
    .speed-control select {
      min-height: 44px;
      background: var(--surface);
      color: var(--text-primary);
      border: 1px solid var(--border-interactive);
      padding: 4px 8px;
      font-family: inherit;
      cursor: pointer;
    }
    @media (prefers-reduced-motion: reduce) {
      .btn { transition: none; }
    }
  </style>
</head>
<body>
  <div class="canvas-wrapper">
    <canvas id="canvas" role="img" aria-label="Animated route map: ${safeTitle}"></canvas>
    <div id="player-error" class="player-error" hidden role="alert">
      <strong>This export could not start.</strong>
      <span id="player-error-detail"></span>
    </div>
  </div>
  <div class="controls">
    <button id="play-btn" class="btn btn-primary" type="button">Play</button>
    <button id="reset-btn" class="btn btn-secondary" type="button">Reset</button>
    <input id="timeline" class="timeline" type="range" min="0" max="10000" step="1" value="0"
           aria-label="Timeline">
    <span class="time-display"><span id="current-time">0:00</span> / <span id="total-time">0:00</span></span>
    <label class="speed-control" for="speed-select">Speed
      <select id="speed-select">
        <option value="0.25">0.25x</option>
        <option value="0.5">0.5x</option>
        <option value="1" selected>1x</option>
        <option value="1.5">1.5x</option>
        <option value="2">2x</option>
      </select>
    </label>
  </div>
  <script>
    window.__ROUTE_PLOTTER_PROJECT__ = ${this._embedJSON(projectData)};
    window.__ROUTE_PLOTTER_BG__ = ${this._embedJSON(backgroundDataURL)};
  </script>
  <script>
${playerBundle}
  </script>
</body>
</html>`;
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
   * @param {string} backgroundDataURL - Exact retained source data URL
   * @returns {Promise<Object>} Size estimate { bytes, formatted }
   */
  async estimateSize(backgroundDataURL) {
    const retainedBackground = this._validateBackgroundDataURL(backgroundDataURL);
    // The data URL is embedded as text, so count its actual UTF-8 footprint;
    // estimating decoded binary bytes would understate the standalone file.
    const imageSize = new TextEncoder().encode(retainedBackground).length;

    const playerSize = 140000; // ~137KB minified player bundle (docs/player.js)
    const dataSize = 4000;     // project snapshot JSON (typical scene)
    const htmlSize = 6000;     // page shell

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
