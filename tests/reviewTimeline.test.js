import { afterEach, describe, expect, test, vi } from 'vitest';

import { EventBus } from '../src/core/EventBus.js';
import { PATH_VISIBILITY } from '../src/config/constants.js';
import { AnimationEngine } from '../src/services/AnimationEngine.js';
import { MotionVisibilityService } from '../src/services/MotionVisibilityService.js';
import { VideoExporter } from '../src/services/VideoExporter.js';
import { pathTimingMixin } from '../src/app/pathTiming.js';
import { exportingMixin } from '../src/app/exporting.js';
import { wiringControllersMixin } from '../src/app/wiringControllers.js';
import { PlayerApp } from '../src/player/PlayerApp.js';

function makeLinearEngine(duration = 10000) {
  const engine = new AnimationEngine(new EventBus());
  engine.pathDuration = duration;
  engine.state.duration = duration;
  return engine;
}

function makeWiringApp() {
  const app = {
    eventBus: new EventBus(),
    animationEngine: makeLinearEngine(),
    elements: {},
    motionSettings: {
      pathVisibility: PATH_VISIBILITY.SHOW_ON_PROGRESSION,
      pathTrail: 0.2,
      backgroundVisibility: 'always-show'
    },
    motionVisibilityService: { resetRevealMask: vi.fn() },
    invalidateAnimationTiming: vi.fn(),
    queueRender: vi.fn(),
    autoSave: vi.fn(),
    previewMode: false
  };
  wiringControllersMixin.setupControllerEventConnections.call(app);
  return app;
}

function makeExportApp(transport, previewMode = false) {
  document.body.innerHTML = '<button id="export-dropdown-btn">Export</button>';
  const engine = makeLinearEngine();
  engine.seekToProgress(0.37);
  engine.state.isPlaying = transport.isPlaying;
  engine.state.isPaused = transport.isPaused;
  engine.state.playbackSpeed = transport.playbackSpeed;

  const steps = [];
  const app = {
    waypoints: [{}, {}],
    previewMode,
    videoExporter: {
      cancel: vi.fn(),
      export: vi.fn(async (options) => {
        steps.push('export');
        await options.renderFrame(0.9);
        return new Blob(['video']);
      })
    },
    canvas: document.createElement('canvas'),
    eventBus: engine.eventBus,
    animationEngine: engine,
    elements: {
      exportMp4Btn: document.createElement('button'),
      exportWebmBtn: document.createElement('button'),
      exportHtmlBtn: document.createElement('button')
    },
    exportSettings: {
      pathOnly: false,
      resolutionX: 1920,
      resolutionY: 1080,
      frameRate: 25,
      format: 'mp4'
    },
    background: { image: {} },
    motionVisibilityService: { resetRevealMask: vi.fn() },
    announce: vi.fn(),
    showExportModeWarning: vi.fn(),
    render: vi.fn(),
    queueRender: vi.fn(),
    _enterExportMode: vi.fn(),
    _exitExportMode: vi.fn()
  };

  app.invalidateAnimationTiming = vi.fn(() => {
    steps.push(`timing:${app.previewMode}`);
    const duration = app.previewMode ? 20000 : 10000;
    engine.pathDuration = duration;
    engine.setDuration(duration);
    return duration;
  });
  app._setPreviewMode = vi.fn((nextMode) => {
    if (app.previewMode === nextMode) return;
    app.previewMode = nextMode;
    steps.push(`mode:${nextMode}`);
    app.invalidateAnimationTiming();
  });

  return { app, engine, steps };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('REV-01 deterministic comet visibility', () => {
  const settings = {
    pathVisibility: PATH_VISIBILITY.INSTANTANEOUS,
    pathTrail: 0.2
  };

  test('a direct seek into a waypoint wait matches sequential evaluation', () => {
    const sequential = new MotionVisibilityService();
    sequential.getPathVisibleRange(0.2, settings, 10000);
    sequential.getPathVisibleRange(0.5, settings, 10000);
    const played = sequential.getPathVisibleRange(0.5, settings, 10000, true, 1000);

    const direct = new MotionVisibilityService()
      .getPathVisibleRange(0.5, settings, 10000, true, 1000);

    expect(direct).toEqual(played);
    expect(direct.startProgress).toBeCloseTo(0.4);
  });

  test('a direct seek into final tail time ignores prior render history', () => {
    const previouslyRendered = new MotionVisibilityService();
    previouslyRendered.getPathVisibleRange(0.75, settings, 10000);
    previouslyRendered.getPathVisibleRange(0.1, settings, 10000);
    const played = previouslyRendered.getPathVisibleRange(1, settings, 10000, false, 1000, true);

    const direct = new MotionVisibilityService()
      .getPathVisibleRange(1, settings, 10000, false, 1000, true);

    expect(direct).toEqual(played);
    expect(direct.startProgress).toBeCloseTo(0.9);
  });

  test('absolute pause context preserves the post-pause held-tail transition', () => {
    const engine = makeLinearEngine(11000);
    engine.pathDuration = 10000;
    engine.totalPauseTime = 1000;
    engine.pauseMarkers = [{
      pathProgress: 0.5,
      timelineStartMs: 5000,
      timelineEndMs: 6000,
      duration: 1000,
      waypointIndex: 1
    }];
    engine.seekToTime(6500);

    const range = new MotionVisibilityService().getPathVisibleRange(
      engine.state.pathProgress,
      settings,
      engine.pathDuration,
      false,
      0,
      false,
      engine.getTrailVisibilityContext()
    );

    expect(engine.state.pathProgress).toBeCloseTo(0.55);
    expect(range.startProgress).toBeCloseTo(0.4);
  });
});

describe('REV-01 canonical transport state', () => {
  test('seekToTime updates timeline, path and derived wait state together', () => {
    const engine = makeLinearEngine();

    engine.seekToTime(2500);

    expect(engine.state.currentTime).toBe(2500);
    expect(engine.state.progress).toBeCloseTo(0.25);
    expect(engine.state.pathProgress).toBeCloseTo(0.25);
  });

  test('suspend and restore distinguish active playback from the latched playing flag', () => {
    const engine = makeLinearEngine();
    engine.seekToProgress(0.37);
    engine.state.isPlaying = true;
    engine.state.isPaused = true;
    engine.state.playbackSpeed = -4;

    const snapshot = engine.suspendTransport();
    engine.seekToProgress(0.9);
    engine.state.isPlaying = false;
    engine.state.isPaused = false;
    engine.state.playbackSpeed = 1;
    engine.restoreTransportState(snapshot);

    expect(engine.state.captureTransportState()).toEqual(snapshot);
    expect(engine.state.pathProgress).toBeCloseTo(0.37);
    expect(engine.isPlaying()).toBe(false);
  });

  test('tail and end-handle helpers use the same intro offset as PlayerCore', () => {
    const engine = makeLinearEngine(18500);
    engine.startHandleTime = 2000;
    engine.introTime = 1000;
    engine.pathDuration = 10000;
    engine.totalTailTime = 2500;
    engine.endHandleTime = 3000;

    engine.state.currentTime = 12999;
    expect(engine.isInTailTime()).toBe(false);
    engine.state.currentTime = 13000;
    expect(engine.isInTailTime()).toBe(true);
    expect(engine.getTailTimeElapsed()).toBe(0);
    expect(engine.getTotalTimelineDuration()).toBe(18500);
  });

  test('video export uses preview duration then restores mode and exact transport state', async () => {
    vi.spyOn(VideoExporter, 'checkSupport').mockReturnValue({ supported: true });
    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});

    const cases = [
      { isPlaying: true, isPaused: false, playbackSpeed: -4 },
      { isPlaying: true, isPaused: true, playbackSpeed: 2 },
      { isPlaying: false, isPaused: false, playbackSpeed: 0.5 }
    ];

    for (const transport of cases) {
      const { app, engine, steps } = makeExportApp(transport);
      const before = engine.state.captureTransportState();

      await exportingMixin.exportVideo.call(app);

      const options = app.videoExporter.export.mock.calls[0][0];
      expect(options.duration).toBe(20000);
      expect(steps.indexOf('mode:true')).toBeLessThan(steps.indexOf('export'));
      expect(app.previewMode).toBe(false);
      expect(engine.state.captureTransportState()).toEqual(before);
      expect(engine.state.pathProgress).toBeCloseTo(0.37);
      expect(engine.isPlaying()).toBe(transport.isPlaying && !transport.isPaused);
    }
  });

  test('video export refreshes timing when Preview was already active', async () => {
    vi.spyOn(VideoExporter, 'checkSupport').mockReturnValue({ supported: true });
    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    const { app } = makeExportApp({ isPlaying: false, isPaused: true, playbackSpeed: 2 }, true);

    await exportingMixin.exportVideo.call(app);

    expect(app._setPreviewMode).toHaveBeenNthCalledWith(1, true);
    expect(app.invalidateAnimationTiming).toHaveBeenCalled();
    expect(app.videoExporter.export.mock.calls[0][0].duration).toBe(20000);
    expect(app.previewMode).toBe(true);
  });

  test('failed video export still restores the exact transport snapshot', async () => {
    vi.spyOn(VideoExporter, 'checkSupport').mockReturnValue({ supported: true });
    vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('alert', vi.fn());
    const transport = { isPlaying: true, isPaused: false, playbackSpeed: -2 };
    const { app, engine } = makeExportApp(transport);
    const before = engine.state.captureTransportState();
    app.videoExporter.export.mockRejectedValueOnce(new Error('encoder failed'));

    await exportingMixin.exportVideo.call(app);

    expect(app.previewMode).toBe(false);
    expect(engine.state.captureTransportState()).toEqual(before);
    expect(engine.state.pathProgress).toBeCloseTo(0.37);
  });
});

describe('REV-01 timing invalidation and paused rendering', () => {
  test('visibility settings share the timeline invalidation boundary', () => {
    const app = makeWiringApp();

    app.eventBus.emit('motion:preview-mode-change', true);
    app.eventBus.emit('motion:path-visibility-change', PATH_VISIBILITY.INSTANTANEOUS);
    app.eventBus.emit('motion:path-trail-change', 0.4);
    app.eventBus.emit('motion:background-visibility-change', 'spotlight-reveal');

    expect(app.invalidateAnimationTiming).toHaveBeenCalledTimes(4);
    expect(app.motionVisibilityService.resetRevealMask).toHaveBeenCalledOnce();
  });

  test('invalidateAnimationTiming cancels a stale path debounce before rebuilding', () => {
    const pending = setTimeout(() => {}, 10000);
    const app = {
      _durationUpdateTimeout: pending,
      animationEngine: { state: { duration: 4321 } },
      updateAnimationDuration: vi.fn()
    };

    const duration = pathTimingMixin.invalidateAnimationTiming.call(app, 180);

    expect(app._durationUpdateTimeout).toBeNull();
    expect(app.updateAnimationDuration).toHaveBeenCalledWith(180);
    expect(duration).toBe(4321);
  });

  test('JKL resumes a latched-but-paused engine', () => {
    const app = makeWiringApp();
    app.animationEngine.state.isPlaying = true;
    app.animationEngine.state.isPaused = true;

    app.eventBus.emit('animation:jkl-forward');

    expect(app.animationEngine.isPlaying()).toBe(true);
  });

  test('PlayerApp does not rerender an unchanged latched pause', () => {
    let onUpdate;
    const player = {
      animationEngine: {
        start: vi.fn((callback) => { onUpdate = callback; }),
        isPlaying: vi.fn(() => false)
      },
      cameraService: { isZoomTransitioning: vi.fn(() => false) },
      render: vi.fn()
    };
    const pausedState = { progress: 0.5, isWaitingAtWaypoint: false, isPlaying: true, isPaused: true };

    PlayerApp.prototype.start.call(player);
    onUpdate(pausedState);
    onUpdate(pausedState);

    expect(player.render).toHaveBeenCalledOnce();
  });
});
