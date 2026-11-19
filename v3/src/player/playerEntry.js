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
import {
  createTransportAnnouncer,
  formatPlayerTime,
  renderPlayerSceneSummary,
} from './playerAccessibility.js';

const TIMELINE_RESOLUTION = 10000; // slider steps; matches the app's timeline precision

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
  const summary = document.getElementById('scene-summary-content');
  if (summary) summary.textContent = 'Scene summary unavailable.';
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
  const sceneSummaryEl = document.getElementById('scene-summary-content');
  const announcerEl = document.getElementById('player-announcer');
  const transportAnnouncer = createTransportAnnouncer(announcerEl);

  let isScrubbing = false;
  let preferredPlaybackSpeed = Number(speedSelect?.value) || 1;
  let restoringPreferredSpeed = false;

  const restorePreferredPlaybackSpeed = () => {
    if (app.animationEngine.state.playbackSpeed === preferredPlaybackSpeed) return;
    restoringPreferredSpeed = true;
    app.animationEngine.setPlaybackSpeed(preferredPlaybackSpeed);
    restoringPreferredSpeed = false;
  };

  const updateTimelineValueText = (state) => {
    if (!timeline || state.duration <= 0) return;
    const valueText = `${formatPlayerTime(state.currentTime)} of ${formatPlayerTime(state.duration)}`;
    if (timeline.getAttribute('aria-valuetext') !== valueText) {
      timeline.setAttribute('aria-valuetext', valueText);
    }
  };

  const syncTransportUI = (state, { forceTimeline = false } = {}) => {
    if (playBtn) {
      const label = app.animationEngine.isPlaying() ? 'Pause' : 'Play';
      if (playBtn.textContent !== label) playBtn.textContent = label;
    }
    const timelineHasFocus = timeline && document.activeElement === timeline;
    const canSyncTimeline = timeline && state.duration > 0
      && (forceTimeline || (!isScrubbing && !timelineHasFocus));
    if (canSyncTimeline) {
      const progress = state.currentTime / state.duration;
      const value = String(Math.round(progress * TIMELINE_RESOLUTION));
      if (timeline.value !== value) timeline.value = value;
      updateTimelineValueText(state);
    }
  };

  app.onTimeDisplay = (current, total) => {
    const currentText = formatPlayerTime(current);
    const totalText = formatPlayerTime(total);
    if (currentTimeEl && currentTimeEl.textContent !== currentText) currentTimeEl.textContent = currentText;
    if (totalTimeEl && totalTimeEl.textContent !== totalText) totalTimeEl.textContent = totalText;
  };

  try {
    await app.load(data, backgroundImage);
  } catch (err) {
    console.error('Player failed to load project data:', err);
    showError('The embedded project data could not be loaded. Re-export the file from Route Plotter.');
    return;
  }

  // One static, aggregate-only description of the canonical hydrated scene.
  // It is intentionally outside the render loop and never includes authored
  // names, labels, coordinates, identifiers, or asset details.
  const sceneSummary = renderPlayerSceneSummary(sceneSummaryEl, app);
  transportAnnouncer.ready(sceneSummary);

  // Completion is the sole engine-driven live announcement. AnimationEngine
  // emits pause immediately before complete; not subscribing to pause avoids
  // announcing both for the same autonomous milestone.
  app.eventBus.on('animation:complete', () => {
    const state = app.animationEngine.state;
    syncTransportUI(state, { forceTimeline: true });
    app.updateTimeDisplay();
    transportAnnouncer.complete(state);
  });

  // AnimationEngine resets speed on pause/reset/completion because the editor's
  // JKL speeds are temporary. The standalone selector is an explicit user
  // preference, so immediately restore it without announcing a second change.
  app.eventBus.on('animation:playbackSpeedChange', (speed) => {
    if (!restoringPreferredSpeed && Number(speed) !== preferredPlaybackSpeed) {
      restorePreferredPlaybackSpeed();
    }
  });

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
    if (!app.animationEngine.isPlaying() && state.progress >= 1.0) {
      app.resetPlayback();
    }
    app.animationEngine.togglePlayPause();
    syncTransportUI(state, { forceTimeline: true });
    if (app.animationEngine.isPlaying()) {
      transportAnnouncer.play(state);
    } else {
      transportAnnouncer.pause(state);
    }
  };

  const resetToStart = () => {
    app.resetPlayback(); // full app reset recipe, not engine.reset() alone
    syncTransportUI(app.animationEngine.state);
    app.updateTimeDisplay();
    app.queueRender();
    transportAnnouncer.reset();
  };

  const moveToEnd = () => {
    if (app.animationEngine.isPlaying()) app.animationEngine.pause();
    app.animationEngine.seekToProgress(1);
    syncTransportUI(app.animationEngine.state);
    app.updateTimeDisplay();
    app.queueRender();
    transportAnnouncer.end(app.animationEngine.state);
  };

  const seekByKeyboard = (deltaMs) => {
    const state = app.animationEngine.state;
    app.animationEngine.seekToTime(Math.max(0, Math.min(state.duration, state.currentTime + deltaMs)));
    syncTransportUI(state, { forceTimeline: true });
    app.updateTimeDisplay();
    app.queueRender();
    transportAnnouncer.scheduleKeyboardSeek(state);
  };

  if (playBtn) {
    playBtn.addEventListener('click', togglePlay);
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', resetToStart);
  }
  if (timeline) {
    timeline.addEventListener('pointerdown', () => {
      isScrubbing = true;
      transportAnnouncer.cancel();
    });
    timeline.addEventListener('pointerup', () => { isScrubbing = false; });
    timeline.addEventListener('pointercancel', () => { isScrubbing = false; });
    timeline.addEventListener('input', () => {
      // Scrub = set time through the one evaluation path (seek, never advance)
      isScrubbing = true;
      transportAnnouncer.cancel();
      app.animationEngine.seekToProgress(timeline.value / TIMELINE_RESOLUTION);
      syncTransportUI(app.animationEngine.state, { forceTimeline: true });
      app.updateTimeDisplay();
      app.queueRender();
    });
    timeline.addEventListener('change', () => {
      isScrubbing = false;
      syncTransportUI(app.animationEngine.state, { forceTimeline: true });
      transportAnnouncer.committedSeek(app.animationEngine.state);
    });
    timeline.addEventListener('keydown', (event) => {
      let deltaMs = null;
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          deltaMs = -5000;
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          deltaMs = 5000;
          break;
        case 'PageDown':
          deltaMs = -10000;
          break;
        case 'PageUp':
          deltaMs = 10000;
          break;
        case 'Home':
          deltaMs = -app.animationEngine.state.duration;
          break;
        case 'End':
          deltaMs = app.animationEngine.state.duration;
          break;
        default:
          return;
      }
      event.preventDefault();
      seekByKeyboard(deltaMs);
    });
    timeline.addEventListener('blur', () => {
      isScrubbing = false;
      syncTransportUI(app.animationEngine.state, { forceTimeline: true });
    });
  }
  if (speedSelect) {
    speedSelect.addEventListener('change', () => {
      preferredPlaybackSpeed = parseFloat(speedSelect.value);
      app.animationEngine.setPlaybackSpeed(preferredPlaybackSpeed);
      transportAnnouncer.speed(app.animationEngine.state.playbackSpeed);
    });
  }

  // Keyboard transport. Native control keys stay native: no hijacking while
  // an input, select, or button has focus (the app learned this the hard way).
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof Element && e.target.closest('input, select, button, textarea')) return;
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlay();
        break;
      case 'Home':
        e.preventDefault();
        resetToStart();
        break;
      case 'End':
        e.preventDefault();
        moveToEnd();
        break;
      // Absolute-time seeks still resolve path/wait state through PlayerCore.
      case 'ArrowLeft':
        e.preventDefault();
        seekByKeyboard(-1000);
        break;
      case 'ArrowRight':
        e.preventDefault();
        seekByKeyboard(1000);
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
