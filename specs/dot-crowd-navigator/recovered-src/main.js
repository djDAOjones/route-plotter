/**
 * Dot Crowd Navigator — Main Application Entry Point
 *
 * Clean app shell for the graph-based crowd-flow simulation tool.
 * Bootstraps retained infrastructure (EventBus, CoordinateTransform,
 * StorageService, UndoService) and the graph subsystem (GraphModel,
 * GraphRenderer, GraphInteractionHandler, GraphUIController).
 *
 * APP_VERSION is injected at build time via esbuild's define feature.
 */
console.log(`🚀 Dot Crowd Navigator v${APP_VERSION} loaded`);

// ── Imports ──────────────────────────────────────────────
import { EventBus } from './core/EventBus.js';
import { CoordinateTransform } from './services/CoordinateTransform.js';
import { StorageService } from './services/StorageService.js';
import { UndoService } from './services/UndoService.js';
import { GraphModel } from './models/GraphModel.js';
import { GraphRenderer } from './services/GraphRenderer.js';
import { GraphInteractionHandler } from './handlers/GraphInteractionHandler.js';
import { GraphUIController } from './controllers/GraphUIController.js';
import { SimulationState } from './models/SimulationState.js';
import { SwarmEngine } from './services/SwarmEngine.js';
import { DotRenderer } from './services/DotRenderer.js';
import { attachAllTooltips } from './components/Tooltip.js';
import { initParamTooltips } from './components/ParamTooltip.js';
import { initAllDropdowns } from './components/Dropdown.js';

// ── Debug log buffer ─────────────────────────────────────
const DEBUG_LOG_BUFFER = [];
const DEBUG_LOG_MAX_SIZE = 500;
['log', 'warn', 'error'].forEach(method => {
  const original = console[method].bind(console);
  console[method] = function (...args) {
    original(...args);
    const tag = method === 'log' ? 'LOG' : method === 'warn' ? 'WRN' : 'ERR';
    const message = args.map(arg => {
      if (arg instanceof Error) return `${arg.message}\n${arg.stack}`;
      if (typeof arg === 'object') try { return JSON.stringify(arg); } catch { return String(arg); }
      return String(arg);
    }).join(' ');
    DEBUG_LOG_BUFFER.push(`[${new Date().toISOString().slice(11, 23)}] [${tag}] ${message}`);
    if (DEBUG_LOG_BUFFER.length > DEBUG_LOG_MAX_SIZE) DEBUG_LOG_BUFFER.shift();
  };
});

function buildDebugLogContent() {
  const now = new Date();
  return [
    `# Dot Crowd Navigator v${APP_VERSION} — Debug Log`, '',
    '| Field | Value |', '|-------|-------|',
    `| Generated | ${now.toISOString()} |`,
    `| User Agent | ${navigator.userAgent} |`,
    `| Screen | ${screen.width}\u00d7${screen.height} @ ${devicePixelRatio}x |`, '',
    '## Console Log', '', '```',
    DEBUG_LOG_BUFFER.join('\n'),
    '```', ''
  ].join('\n');
}

// ── Title & version ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.title = `Dot Crowd Navigator v${APP_VERSION}`;
  const h1 = document.getElementById('app-title');
  if (h1) { h1.textContent = 'Dot Crowd Navigator'; h1.title = `Version ${APP_VERSION}`; }
});

// ══════════════════════════════════════════════════════════
// Main Application
// ══════════════════════════════════════════════════════════

class DotCrowdNavigator {
  constructor() {
    // ── Core services ──
    this.eventBus = new EventBus();
    this.coordinateTransform = new CoordinateTransform();
    this.storageService = new StorageService();
    this.undoService = new UndoService(this.eventBus);

    // ── Graph subsystem ──
    this.graphModel = new GraphModel();
    this.graphRenderer = new GraphRenderer();

    // ── Simulation subsystem (Phase 2) ──
    this.simState = new SimulationState();
    this.swarmEngine = new SwarmEngine(this.graphModel, this.simState);
    this.dotRenderer = new DotRenderer();

    // ── Canvas ──
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.displayWidth = 0;
    this.displayHeight = 0;
    this.canvasScale = 1;

    // ── Background ──
    this.background = { image: null, overlay: 0 };

    // ── Viewport (zoom / pan) ──
    this.viewport = { zoom: 1, panX: 0, panY: 0, minZoom: 1, maxZoom: 48 };

    // ── Selection state (canonical in InteractionHandler, mirrored here for renderer) ──
    this._selectedNodeId = null;
    this._selectedEdgeId = null;

    // ── Render batching ──
    this._renderQueued = false;

    // ── Dirty flag for unsaved changes ──
    this._isDirty = false;

    this.init();
  }

  // ── Initialisation ─────────────────────────────────────

  init() {
    this.updateCanvasSize();
    window.addEventListener('resize', () => {
      this.updateCanvasSize();
      this.queueRender();
    });

    // Controllers
    this.interactionHandler = new GraphInteractionHandler(this.canvas, this.eventBus, this);
    this.uiController = new GraphUIController(this.eventBus, this.graphModel);

    this._setupEventBusListeners();
    this._setupHeaderControls();

    // UI components
    attachAllTooltips();
    initParamTooltips();
    initAllDropdowns();

    // Load saved state or default image
    this.loadAutosave();
    if (!this.background.image) this.loadDefaultImage();

    // Wire simulation controls
    this._setupSimulationControls();

    this.render();

    // Start the continuous animation loop for the swarm simulation
    this._lastFrameTime = performance.now();
    this._startRenderLoop();

    console.log(`✅ Dot Crowd Navigator v${APP_VERSION} initialized`);
  }

  // ── EventBus wiring ────────────────────────────────────

  _setupEventBusListeners() {
    // Graph mutations → re-render + autosave
    const rerender = () => this.queueRender();
    const rerenderAndSave = () => { this.queueRender(); this.autoSave(); };

    this.eventBus.on('graph:node:added', rerenderAndSave);
    this.eventBus.on('graph:node:moved', rerender);
    this.eventBus.on('graph:node:move:complete', rerenderAndSave);
    this.eventBus.on('graph:node:updated', rerenderAndSave);
    this.eventBus.on('graph:node:deleted', rerenderAndSave);
    this.eventBus.on('graph:edge:added', rerenderAndSave);
    this.eventBus.on('graph:edge:updated', rerenderAndSave);
    this.eventBus.on('graph:edge:deleted', rerenderAndSave);
    this.eventBus.on('graph:selection:changed', (data) => {
      this._selectedNodeId = data.nodeId;
      this._selectedEdgeId = data.edgeId;
      this.queueRender();
    });

    // Viewport changes (zoom/pan) → re-render
    this.eventBus.on('viewport:changed', () => this.queueRender());

    // Background drop from interaction handler
    this.eventBus.on('app:background:drop', (data) => {
      this.loadImageFile(data.file).then((img) => {
        this.background.image = img;
        this.updateImageTransform(img);
        this.queueRender();
        this.autoSave();
      });
    });

    // Undo / Redo
    this.eventBus.on('app:undo', () => {
      const state = this.undoService.undo();
      if (state) this._restoreState(state);
    });
    this.eventBus.on('app:redo', () => {
      const state = this.undoService.redo();
      if (state) this._restoreState(state);
    });

    // Undo button enable/disable
    this.eventBus.on('undo:state-change', (data) => {
      const undoBtn = document.getElementById('undo-btn');
      const redoBtn = document.getElementById('redo-btn');
      if (undoBtn) undoBtn.disabled = !data.canUndo;
      if (redoBtn) redoBtn.disabled = !data.canRedo;
    });
  }

  // ── Header controls (File menu, Help, Undo/Redo) ──────

  _setupHeaderControls() {
    // Help button
    document.getElementById('help-btn')?.addEventListener('click', () => this.showSplash());

    // Reset view button — same as F keyboard shortcut
    document.getElementById('reset-view-btn')?.addEventListener('click', () => {
      this.viewport.zoom = 1;
      this.viewport.panX = 0;
      this.viewport.panY = 0;
      this.queueRender();
    });

    // Splash close
    document.getElementById('splash-close')?.addEventListener('click', () => this.hideSplash());
    document.getElementById('splash-close-x')?.addEventListener('click', () => this.hideSplash());
    const splash = document.getElementById('splash');
    splash?.addEventListener('click', (e) => { if (e.target === splash) this.hideSplash(); });

    // File menu — example backgrounds
    document.getElementById('example-backgrounds-menu')?.querySelectorAll('[data-image]').forEach(item => {
      item.addEventListener('click', (e) => {
        const imagePath = e.currentTarget.dataset.image;
        if (imagePath) this.loadExampleImage(imagePath);
      });
    });

    // Clear all
    document.getElementById('clear-btn')?.addEventListener('click', () => this.clearAll());

    // Save / Load project
    document.getElementById('save-project-btn')?.addEventListener('click', () => this.saveProject());
    document.getElementById('load-project-btn')?.addEventListener('click', () => {
      document.getElementById('load-project-input')?.click();
    });
    document.getElementById('load-project-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.loadProject(file);
      e.target.value = '';
    });

    // Background upload
    document.getElementById('bg-upload-btn')?.addEventListener('click', () => {
      document.getElementById('bg-upload')?.click();
    });
    document.getElementById('bg-upload')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.loadImageFile(file).then((img) => {
          this.background.image = img;
          this.updateImageTransform(img);
          this.queueRender();
          this.autoSave();
        });
      }
    });

    // Background overlay slider
    document.getElementById('bg-overlay')?.addEventListener('input', (e) => {
      this.background.overlay = parseInt(e.target.value, 10);
      const valEl = document.getElementById('bg-overlay-value');
      if (valEl) valEl.textContent = this.background.overlay;
      this.queueRender();
    });

    // Undo / Redo buttons
    document.getElementById('undo-btn')?.addEventListener('click', () => this.eventBus.emit('app:undo'));
    document.getElementById('redo-btn')?.addEventListener('click', () => this.eventBus.emit('app:redo'));

    // Debug log
    document.getElementById('download-debug-btn')?.addEventListener('click', () => {
      const blob = new Blob([buildDebugLogContent()], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `dcn-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
      a.click(); URL.revokeObjectURL(url);
    });
    document.getElementById('copy-debug-btn')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(buildDebugLogContent()); } catch { /* ignore */ }
    });
  }

  // ── Canvas sizing ──────────────────────────────────────

  updateCanvasSize() {
    const container = this.canvas.parentElement;
    const availableWidth = container.clientWidth;
    const availableHeight = container.clientHeight;

    // Match image aspect ratio, or default to 16:9
    const targetAspect = this.background.image
      ? (this.background.image.naturalWidth || this.background.image.width) /
        (this.background.image.naturalHeight || this.background.image.height)
      : 16 / 9;

    const containerAspect = availableWidth / availableHeight;
    let w, h;
    if (targetAspect > containerAspect) {
      w = availableWidth; h = availableWidth / targetAspect;
    } else {
      h = availableHeight; w = availableHeight * targetAspect;
    }

    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvasScale = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    this.displayWidth = w;
    this.displayHeight = h;
    this.coordinateTransform.setCanvasDimensions(w, h);

    if (this.background.image) this.updateImageTransform(this.background.image);
  }

  // ── Coordinate pipeline ────────────────────────────────
  // Screen → Canvas → Image (normalised 0–1)

  screenToCanvas(screenX, screenY) {
    const z = this.viewport.zoom;
    if (z !== 1) {
      return { x: screenX / z + this.viewport.panX, y: screenY / z + this.viewport.panY };
    }
    return { x: screenX, y: screenY };
  }

  screenToImage(screenX, screenY) {
    const canvas = this.screenToCanvas(screenX, screenY);
    return this.coordinateTransform.canvasToImage(canvas.x, canvas.y);
  }

  imageToCanvas(imageX, imageY) {
    return this.coordinateTransform.imageToCanvas(imageX, imageY);
  }

  updateImageTransform(img) {
    if (!img) return;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    this.coordinateTransform.setImageDimensions(w, h, 'fit');
  }

  // ── Rendering ──────────────────────────────────────────

  queueRender() {
    if (this._renderQueued) return;
    this._renderQueued = true;
    requestAnimationFrame(() => {
      this._renderQueued = false;
      this.render();
    });
  }

  render() {
    const w = this.displayWidth || this.canvas.width;
    const h = this.displayHeight || this.canvas.height;
    if (w <= 0 || h <= 0) return;

    const ctx = this.ctx;
    const dpr = this.canvasScale;
    const vp = this.viewport;

    // Reset transform to identity (accounting for DPR)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear entire canvas
    ctx.clearRect(0, 0, w, h);

    // Apply viewport zoom + pan
    if (vp.zoom !== 1) {
      ctx.scale(vp.zoom, vp.zoom);
      ctx.translate(-vp.panX, -vp.panY);
    }

    // Background image
    this._renderBackground(ctx, w, h);

    // Graph overlay
    this.graphRenderer.render(
      ctx, this.graphModel,
      (x, y) => this.imageToCanvas(x, y),
      this.coordinateTransform,
      { selectedNodeId: this._selectedNodeId, selectedEdgeId: this._selectedEdgeId }
    );

    // Swarm dots (on top of graph edges, under nodes would be alternative)
    const dotPositions = this.swarmEngine.getDotPositions();
    if (dotPositions.length > 0) {
      this.dotRenderer.render(
        ctx, dotPositions,
        (x, y) => this.imageToCanvas(x, y),
        this.coordinateTransform
      );
    }

    // Reset transform for any HUD elements (future: zoom level indicator)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _renderBackground(ctx, w, h) {
    // Neutral grey when no image
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, w, h);

    if (!this.background.image) return;
    const img = this.background.image;

    // Contain-fit via CoordinateTransform
    const topLeft = this.coordinateTransform.imageToCanvas(0, 0);
    const bottomRight = this.coordinateTransform.imageToCanvas(1, 1);
    const imgW = bottomRight.x - topLeft.x;
    const imgH = bottomRight.y - topLeft.y;
    ctx.drawImage(img, topLeft.x, topLeft.y, imgW, imgH);

    // Overlay tint
    if (this.background.overlay !== 0) {
      const val = this.background.overlay;
      ctx.fillStyle = val > 0
        ? `rgba(255,255,255,${Math.abs(val) / 100})`
        : `rgba(0,0,0,${Math.abs(val) / 100})`;
      ctx.fillRect(topLeft.x, topLeft.y, imgW, imgH);
    }
  }

  // ── Simulation controls ─────────────────────────────────

  _setupSimulationControls() {
    // Play button — also validate graph has entry nodes
    document.getElementById('sim-play-btn')?.addEventListener('click', () => {
      const entries = this.graphModel.getNodesByType('entry');
      if (entries.length === 0) {
        this.showToast('Add at least one Entry node first (double-click a node)', 5000);
        return;
      }
      this.simState.isPlaying = true;
      this._updateSimButtons();
    });

    // Pause button
    document.getElementById('sim-pause-btn')?.addEventListener('click', () => {
      this.simState.isPlaying = false;
      this._updateSimButtons();
    });

    // Reset button
    document.getElementById('sim-reset-btn')?.addEventListener('click', () => {
      this.swarmEngine.reset();
      this._updateSimButtons();
      this.queueRender();
      this.showToast('Simulation reset');
    });

    // Dot count slider
    document.getElementById('sim-dot-count')?.addEventListener('input', (e) => {
      this.simState.dotCount = parseInt(e.target.value, 10);
      const valEl = document.getElementById('sim-dot-count-value');
      if (valEl) valEl.textContent = this.simState.dotCount;
    });

    // Speed slider
    document.getElementById('sim-speed')?.addEventListener('input', (e) => {
      this.simState.speed = parseFloat(e.target.value);
      const valEl = document.getElementById('sim-speed-value');
      if (valEl) valEl.textContent = this.simState.speed.toFixed(2);
    });

    // Lifecycle mode selector
    document.getElementById('sim-lifecycle')?.addEventListener('change', (e) => {
      this.simState.lifecycleMode = e.target.value;
    });
  }

  _updateSimButtons() {
    const playBtn = document.getElementById('sim-play-btn');
    const pauseBtn = document.getElementById('sim-pause-btn');
    if (playBtn) playBtn.disabled = this.simState.isPlaying;
    if (pauseBtn) pauseBtn.disabled = !this.simState.isPlaying;
  }

  _startRenderLoop() {
    const loop = (now) => {
      const delta = Math.min(now - this._lastFrameTime, 100); // cap at 100ms
      this._lastFrameTime = now;

      if (this.simState.isPlaying) {
        this.swarmEngine.tick(delta);
        this.render();
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ── Persistence ────────────────────────────────────────

  _saveUndoState() {
    this.undoService.saveState({ graph: this.graphModel.toJSON() });
  }

  autoSave() {
    this._isDirty = true;
    this._saveUndoState();
    try {
      const data = {
        coordVersion: 9,
        graph: this.graphModel.toJSON(),
        simulation: this.simState.toJSON(),
        background: { overlay: this.background.overlay },
      };
      this.storageService.autoSave(data);
    } catch (e) {
      console.error('Autosave failed:', e);
    }
  }

  loadAutosave() {
    try {
      const data = this.storageService.loadAutoSave();
      if (!data) return;
      if (!data.coordVersion || data.coordVersion < 8) {
        console.log('Old data format detected, clearing autosave');
        this.storageService.clearAutoSave();
        return;
      }
      if (data.graph) this.graphModel.fromJSON(data.graph);
      if (data.simulation) {
        this.simState.fromJSON(data.simulation);
        this._syncSimUI();
      }
      if (data.background) {
        this.background.overlay = data.background.overlay ?? 0;
        const overlayEl = document.getElementById('bg-overlay');
        if (overlayEl) overlayEl.value = this.background.overlay;
        const valEl = document.getElementById('bg-overlay-value');
        if (valEl) valEl.textContent = this.background.overlay;
      }
      this.eventBus.emit('app:project:loaded');
      this.queueRender();
      console.debug('Autosave loaded');
    } catch (e) {
      console.error('Failed to load autosave:', e);
    }
  }

  /**
   * Sync the simulation UI controls with the current simState.
   * Called after loading a saved project or autosave.
   */
  _syncSimUI() {
    const dotCount = document.getElementById('sim-dot-count');
    const dotCountVal = document.getElementById('sim-dot-count-value');
    const speed = document.getElementById('sim-speed');
    const speedVal = document.getElementById('sim-speed-value');
    const lifecycle = document.getElementById('sim-lifecycle');
    if (dotCount) dotCount.value = this.simState.dotCount;
    if (dotCountVal) dotCountVal.textContent = this.simState.dotCount;
    if (speed) speed.value = this.simState.speed;
    if (speedVal) speedVal.textContent = this.simState.speed.toFixed(2);
    if (lifecycle) lifecycle.value = this.simState.lifecycleMode;
  }

  _restoreState(state) {
    if (state.graph) this.graphModel.fromJSON(state.graph);
    this.queueRender();
    this.eventBus.emit('app:project:loaded');
  }

  clearAll() {
    this.graphModel.clear();
    this.interactionHandler.deselect();
    this._isDirty = false;
    this.autoSave();
    this.queueRender();
    this.eventBus.emit('app:project:loaded');
  }

  saveProject() {
    try {
      const data = JSON.stringify({
        version: APP_VERSION,
        coordVersion: 9,
        graph: this.graphModel.toJSON(),
        simulation: this.simState.toJSON(),
        background: { overlay: this.background.overlay },
      }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dot-crowd-navigator-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this._isDirty = false;
      this.showToast('Project saved');
    } catch (err) {
      console.error('Failed to save project:', err);
      this.showToast('Save failed — see console', 6000);
    }
  }

  loadProject(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.graph) this.graphModel.fromJSON(data.graph);
        if (data.simulation) {
          this.simState.fromJSON(data.simulation);
          this._syncSimUI();
        }
        if (data.background) {
          this.background.overlay = data.background.overlay ?? 0;
          const overlayEl = document.getElementById('bg-overlay');
          if (overlayEl) overlayEl.value = this.background.overlay;
          const valEl = document.getElementById('bg-overlay-value');
          if (valEl) valEl.textContent = this.background.overlay;
        }
        this.interactionHandler.deselect();
        this.swarmEngine.reset(); // Clear any active dots from previous project
        this.autoSave();
        this.queueRender();
        this.eventBus.emit('app:project:loaded');
        this.showToast(`Loaded: ${file.name}`);
      } catch (err) {
        console.error('Failed to load project:', err);
        this.showToast('Load failed — invalid file', 6000);
      }
    };
    reader.readAsText(file);
  }

  // ── Assets ─────────────────────────────────────────────

  loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  loadDefaultImage() {
    const img = new Image();
    img.onload = () => {
      this.background.image = img;
      this.updateImageTransform(img);
      this.updateCanvasSize();
      this.queueRender();
      console.debug('Default image loaded');
    };
    img.onerror = () => { this.queueRender(); };
    img.src = './UoN_map.png';
  }

  loadExampleImage(imagePath) {
    const img = new Image();
    img.onload = () => {
      this.background.image = img;
      this.updateImageTransform(img);
      this.updateCanvasSize();
      this.queueRender();
      this.autoSave();
      console.log(`Example image loaded: ${imagePath}`);
    };
    img.onerror = (err) => console.error(`Failed to load: ${imagePath}`, err);
    img.src = imagePath;
  }

  // ── Toast & Splash ─────────────────────────────────────

  showToast(message, duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  showSplash() {
    // Help content is embedded in index.html directly — no need to inject
    const splash = document.getElementById('splash');
    if (splash) splash.style.display = 'flex';
  }

  hideSplash() {
    const splash = document.getElementById('splash');
    if (splash) splash.style.display = 'none';
  }

  announce(message) {
    const el = document.getElementById('announcer');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = message; }, 100);
  }

  destroy() {
    this.interactionHandler?.destroy();
    this.eventBus?.removeAll();
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

// ── Bootstrap ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DotCrowdNavigator();
});
