import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { CameraService } from '../src/services/CameraService.js';
import { AnimationEngine } from '../src/services/AnimationEngine.js';
import { playbackMixin } from '../src/app/playback.js';

function createFrameHarness() {
  let nextId = 1;
  const pending = new Map();

  const request = vi.fn(callback => {
    const id = nextId++;
    pending.set(id, callback);
    return id;
  });
  const cancel = vi.fn(id => pending.delete(id));
  const runNext = timestamp => {
    const entry = pending.entries().next().value;
    if (!entry) throw new Error('No animation frame is queued');
    const [id, callback] = entry;
    pending.delete(id);
    callback(timestamp);
  };

  return { pending, request, cancel, runNext };
}

describe('REV-06 animation scheduling', () => {
  let originalRequest;
  let originalCancel;
  let frames;

  beforeEach(() => {
    originalRequest = globalThis.requestAnimationFrame;
    originalCancel = globalThis.cancelAnimationFrame;
    frames = createFrameHarness();
    globalThis.requestAnimationFrame = frames.request;
    globalThis.cancelAnimationFrame = frames.cancel;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  });

  test('a stable paused engine performs one requested update and then has zero queued frames', () => {
    const update = vi.fn(() => false);
    const engine = new AnimationEngine();

    engine.start(update);
    expect(frames.pending.size).toBe(1);

    frames.runNext(20);

    expect(update).toHaveBeenCalledOnce();
    expect(frames.pending.size).toBe(0);
    expect(engine.animationFrameId).toBeNull();
  });

  test('play wakes the loop and pause settles through one final update without a time jump', () => {
    const update = vi.fn(() => false);
    const engine = new AnimationEngine();
    engine.state.duration = 1000;
    engine.start(update);
    frames.runNext(20);

    engine.play();
    expect(frames.pending.size).toBe(1);
    frames.runNext(40);
    const playingTime = engine.state.currentTime;
    expect(playingTime).toBeGreaterThan(0);
    expect(playingTime).toBeLessThan(50);
    expect(frames.pending.size).toBe(1);

    engine.pause();
    frames.runNext(60);

    expect(engine.state.currentTime).toBe(playingTime);
    expect(frames.pending.size).toBe(0);
  });

  test('a non-timeline visual may keep the loop alive only until it reports settled', () => {
    let updates = 0;
    const engine = new AnimationEngine();
    engine.start(() => {
      updates += 1;
      return updates < 3;
    });

    frames.runNext(20);
    frames.runNext(40);
    frames.runNext(60);

    expect(updates).toBe(3);
    expect(frames.pending.size).toBe(0);
  });

  test('export suspension cancels preview work, ignores export seeks, and wakes on restore', () => {
    const engine = new AnimationEngine();
    engine.state.duration = 1000;
    engine.start(() => false);
    frames.runNext(20);
    engine.play();
    expect(frames.pending.size).toBe(1);

    const snapshot = engine.suspendTransport();
    expect(frames.pending.size).toBe(0);
    expect(frames.cancel).toHaveBeenCalledOnce();

    engine.seekToTime(500);
    expect(frames.pending.size).toBe(0);

    engine.restoreTransportState(snapshot);
    expect(engine.isPlaying()).toBe(true);
    expect(frames.pending.size).toBe(1);
  });

  test('several paused seeks coalesce into one scheduled update', () => {
    const update = vi.fn(() => false);
    const engine = new AnimationEngine();
    engine.state.duration = 1000;
    engine.start(update);
    frames.runNext(20);

    engine.seekToProgress(0.25);
    engine.seekToProgress(0.5);
    engine.seekToTime(750);

    expect(frames.pending.size).toBe(1);
    frames.runNext(40);
    expect(update).toHaveBeenCalledTimes(2);
    expect(engine.state.currentTime).toBe(750);
    expect(frames.pending.size).toBe(0);
  });
});

describe('REV-06 camera settling', () => {
  test('a settled authored zoom is static even when it is not 1x', () => {
    const camera = new CameraService();
    camera._targetZoom = 4;
    camera._rateLimitedZoom = 4;
    camera._smoothedZoom = 4;
    camera._targetCenterX = 600;
    camera._targetCenterY = 400;
    camera._smoothedCenterX = 600;
    camera._smoothedCenterY = 400;

    expect(camera.isZoomTransitioning(1200, 800)).toBe(false);
  });

  test('rate-limited zoom and smoothed centre differences keep visual work awake', () => {
    const camera = new CameraService();
    camera._targetZoom = 4;
    camera._rateLimitedZoom = 3;
    camera._smoothedZoom = 3;
    camera._targetCenterX = 600;
    camera._targetCenterY = 400;
    camera._smoothedCenterX = 590;
    camera._smoothedCenterY = 400;

    expect(camera.isZoomTransitioning(1200, 800)).toBe(true);
  });

  test('the editor decides keep-alive after rendering the new camera target', () => {
    let update;
    const cameraService = {
      isZoomTransitioning: vi.fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
    };
    const app = {
      _isExportMode: false,
      animationEngine: {
        start: callback => { update = callback; },
        isPlaying: () => false
      },
      cameraService,
      displayWidth: 1200,
      displayHeight: 800,
      render: vi.fn(),
      syncUIWithAnimationState: vi.fn()
    };

    playbackMixin.startRenderLoop.call(app);
    const keepAlive = update({ progress: 0.5, isWaitingAtWaypoint: false });

    expect(app.render).toHaveBeenCalledOnce();
    expect(cameraService.isZoomTransitioning).toHaveBeenCalledTimes(2);
    expect(keepAlive).toBe(true);
  });
});
