/**
 * playerEntry - boot script for the exported HTML player page.
 *
 * Bundled by build.js into docs/player.js (IIFE); HTMLExportService inlines
 * that bundle into every exported file next to the embedded project payload:
 *   window.__ROUTE_PLOTTER_PROJECT__  — coordVersion-9 project data
 *   window.__ROUTE_PLOTTER_BG__       — background image data URL, or null
 *
 * Owns only page-shell concerns: decoding the background, transport controls,
 * timeline slider, time readout, keyboard shortcuts, resize. All evaluation
 * and rendering live in PlayerApp (the app's own modules).
 */

import { PlayerApp } from './PlayerApp.js';

const TIMELINE_RESOLUTION = 10000; // slider steps; matches the app's timeline precision

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The embedded background image could not be decoded.'));
    img.src = dataUrl;
  });
}

/** Visible, specific failure state — the page must never sit silently blank. */
function showError(message) {
  const panel = document.getElementById('player-error');
  if (panel) {
    panel.hidden = false;
    const detail = document.getElementById('player-error-detail');
    if (detail) detail.textContent = message;
  }
  const controls = document.querySelector('.controls');
  if (controls) controls.hidden = true;
}

async function boot() {
  const data = window.__ROUTE_PLOTTER_PROJECT__;
  const canvas = document.getElementById('canvas');
  if (!data || !canvas) {
    showError('This export is missing its embedded project data. Re-export the file from Route Plotter.');
    return;
  }

  let backgroundImage = null;
  const bgDataUrl = window.__ROUTE_PLOTTER_BG__;
  if (bgDataUrl) {
    try {
      backgroundImage = await loadImage(bgDataUrl);
    } catch (err) {
      // Keep playing without the background rather than dying: the route,
      // beacons and crowds are still meaningful over a blank canvas.
      console.warn(err.message);
    }
  }

  const app = new PlayerApp(canvas);

  const playBtn = document.getElementById('play-btn');
  const resetBtn = document.getElementById('reset-btn');
  const timeline = document.getElementById('timeline');
  const currentTimeEl = document.getElementById('current-time');
  const totalTimeEl = document.getElementById('total-time');
  const speedSelect = document.getElementById('speed-select');

  let isScrubbing = false;

  const syncTransportUI = (state) => {
    if (playBtn) {
      playBtn.textContent = state.isPlaying ? 'Pause' : 'Play';
    }
    if (timeline && !isScrubbing && state.duration > 0) {
      const progress = state.currentTime / state.duration;
      timeline.value = Math.round(progress * TIMELINE_RESOLUTION);
      timeline.setAttribute('aria-valuetext',
        `${formatTime(state.currentTime)} of ${formatTime(state.duration)}`);
    }
  };

  app.onTimeDisplay = (current, total) => {
    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
    if (totalTimeEl) totalTimeEl.textContent = formatTime(total);
  };

  try {
    await app.load(data, backgroundImage);
  } catch (err) {
    console.error('Player failed to load project data:', err);
    showError('The embedded project data could not be loaded. Re-export the file from Route Plotter.');
    return;
  }

  // Engine loop: syncs the transport UI, and the per-second readout via
  // updateTimeDisplay (same throttle rule as the app's playback mixin).
  let lastSecond = -1;
  app.start((state) => {
    syncTransportUI(state);
    const second = Math.floor(state.currentTime / 1000);
    if (second !== lastSecond) {
      app.updateTimeDisplay(state.currentTime, state.duration);
      lastSecond = second;
    }
  });

  const togglePlay = () => {
    const state = app.animationEngine.state;
    // Same rule as the app's play(): playing from the end restarts
    if (!state.isPlaying && state.progress >= 1.0) {
      app.resetPlayback();
    }
    app.animationEngine.togglePlayPause();
    syncTransportUI(state);
  };

  if (playBtn) {
    playBtn.addEventListener('click', togglePlay);
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      app.resetPlayback(); // full app reset recipe, not engine.reset() alone
      syncTransportUI(app.animationEngine.state);
      app.updateTimeDisplay();
      app.queueRender();
    });
  }
  if (timeline) {
    timeline.addEventListener('pointerdown', () => { isScrubbing = true; });
    timeline.addEventListener('pointerup', () => { isScrubbing = false; });
    timeline.addEventListener('input', () => {
      // Scrub = set time through the one evaluation path (seek, never advance)
      app.animationEngine.seekToProgress(timeline.value / TIMELINE_RESOLUTION);
      app.updateTimeDisplay();
      app.queueRender();
    });
  }
  if (speedSelect) {
    speedSelect.addEventListener('change', () => {
      app.animationEngine.setPlaybackSpeed(parseFloat(speedSelect.value));
    });
  }

  // Keyboard transport. Native control keys stay native: no hijacking while
  // an input, select, or button has focus (the app learned this the hard way).
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, button, textarea')) return;
    const state = app.animationEngine.state;
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlay();
        break;
      case 'Home':
        e.preventDefault();
        app.resetPlayback();
        syncTransportUI(state);
        app.queueRender();
        break;
      case 'End':
        e.preventDefault();
        app.animationEngine.seekToProgress(1);
        app.queueRender();
        break;
      // Seeks go through seekToProgress — seekToTime updates currentTime only
      // and leaves pathProgress stale (the head, reveal and areas would freeze)
      case 'ArrowLeft':
        e.preventDefault();
        app.animationEngine.seekToProgress(Math.max(0, state.currentTime - 1000) / state.duration);
        app.queueRender();
        break;
      case 'ArrowRight':
        e.preventDefault();
        app.animationEngine.seekToProgress(Math.min(state.duration, state.currentTime + 1000) / state.duration);
        app.queueRender();
        break;
    }
  });

  let resizePending = false;
  window.addEventListener('resize', () => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
      resizePending = false;
      app.resize();
    });
  });

  app.updateTimeDisplay();
  syncTransportUI(app.animationEngine.state);
  app.render();

  // Debug handle for exported files: lets a console (or automated check)
  // seek/inspect the deterministic timeline directly — e.g.
  // __routePlotterPlayer.animationEngine.seekToProgress(0.5); __routePlotterPlayer.render()
  window.__routePlotterPlayer = app;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
