import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  VideoExporter,
  createVideoFramePlan
} from '../src/services/VideoExporter.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createRecorderHarness({ requestFrame = () => {} } = {}) {
  const track = {
    requestFrame: vi.fn(requestFrame),
    stop: vi.fn()
  };
  const stream = {
    getVideoTracks: vi.fn(() => [track]),
    getTracks: vi.fn(() => [track])
  };
  const recorder = {
    state: 'inactive',
    start: vi.fn(function start() {
      this.state = 'recording';
    }),
    stop: vi.fn(function stop() {
      this.state = 'inactive';
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(['frame']) });
        this.onstop?.();
      });
    }),
    pause: vi.fn(function pause() {
      this.state = 'paused';
    }),
    resume: vi.fn(function resume() {
      this.state = 'recording';
    })
  };
  return {
    track,
    stream,
    recorder,
    capabilityPlan: {
      supported: true,
      strategy: 'mediarecorder',
      format: 'webm',
      mimeType: 'video/webm',
      mediaStream: stream,
      videoTrack: track,
      mediaRecorder: recorder,
      reason: null
    }
  };
}

async function flushUntil(assertion, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      assertion();
      return;
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await Promise.resolve();
    }
  }
}

function createMockMediaApi({ cancelPromise = null, finalizeError = null } = {}) {
  const outputs = [];
  class MockOutput {
    constructor() {
      this.state = 'pending';
      this.target = { buffer: new Uint8Array([1, 2, 3]) };
      this.addVideoTrack = vi.fn();
      this.start = vi.fn(async () => {
        this.state = 'started';
      });
      this.finalize = vi.fn(async () => {
        this.state = 'finalizing';
        if (finalizeError) throw finalizeError;
        this.state = 'finalized';
      });
      this.cancel = vi.fn(async () => {
        if (cancelPromise) await cancelPromise;
        this.state = 'canceled';
      });
      outputs.push(this);
    }
  }
  class MockPacketSource {
    constructor() {
      this.add = vi.fn().mockResolvedValue(undefined);
    }
  }
  return {
    outputs,
    api: {
      Output: MockOutput,
      WebMOutputFormat: class MockWebMOutputFormat {},
      Mp4OutputFormat: class MockMp4OutputFormat {},
      BufferTarget: class MockBufferTarget {},
      EncodedVideoPacketSource: MockPacketSource,
      EncodedPacket: {
        fromEncodedChunk: vi.fn(chunk => chunk)
      }
    }
  };
}

describe('video export frame planning', () => {
  test('announces and emits one exact endpoint-inclusive sample count', () => {
    const plan = createVideoFramePlan({
      frameRate: 25,
      duration: 1000,
      startBuffer: 80
    });
    const samples = [...plan.samples()];

    expect(plan.startBufferFrames).toBe(2);
    expect(plan.animationFrames).toBe(25);
    expect(plan.frameCount).toBe(27);
    expect(samples).toHaveLength(plan.frameCount);
    expect(samples.map(sample => sample.frameIndex)).toEqual(
      Array.from({ length: plan.frameCount }, (_, index) => index)
    );
    expect(samples.slice(0, 3).map(sample => sample.progress)).toEqual([0, 0, 0]);
    expect(samples.at(-1)).toMatchObject({ progress: 1, percent: 100 });
  });

  test('a sub-frame animation still includes both authored endpoints', () => {
    const plan = createVideoFramePlan({ frameRate: 25, duration: 1 });
    expect(plan.frameCount).toBe(2);
    expect([...plan.samples()].map(sample => sample.progress)).toEqual([0, 1]);
  });

  test('uses the same plan for a manually clocked MediaRecorder export', async () => {
    const track = { requestFrame: vi.fn(), stop: vi.fn() };
    const stream = {
      getVideoTracks: () => [track],
      getTracks: () => [track]
    };
    const recorder = {
      state: 'inactive',
      start: vi.fn(function start() { this.state = 'recording'; }),
      stop: vi.fn(function stop() {
        this.state = 'inactive';
        queueMicrotask(() => {
          this.ondataavailable?.({ data: new Blob(['frame']) });
          this.onstop?.();
        });
      }),
      pause: vi.fn(),
      resume: vi.fn()
    };
    const capabilityPlan = {
      supported: true,
      strategy: 'mediarecorder',
      format: 'webm',
      mimeType: 'video/webm',
      mediaStream: stream,
      videoTrack: track,
      mediaRecorder: recorder,
      reason: null
    };
    const eventBus = { emit: vi.fn() };
    const exporter = new VideoExporter(document.createElement('canvas'), eventBus);
    exporter._delay = vi.fn().mockResolvedValue(undefined);
    const renderFrame = vi.fn();

    await exporter.export({
      format: 'webm',
      frameRate: 2,
      duration: 1000,
      renderFrame,
      capabilityPlan
    });

    const started = eventBus.emit.mock.calls.find(([name]) => name === 'video:export-started')[1];
    const progressEvents = eventBus.emit.mock.calls.filter(([name]) => name === 'video:export-progress');
    expect(started.totalFrames).toBe(2);
    expect(renderFrame).toHaveBeenCalledTimes(started.totalFrames);
    expect(track.requestFrame).toHaveBeenCalledTimes(started.totalFrames);
    expect(progressEvents).toHaveLength(started.totalFrames);
    expect(progressEvents.at(-1)[1]).toMatchObject({ frame: 1, totalFrames: 2, percent: 100 });
    expect(track.stop).toHaveBeenCalledOnce();
  });

  test('passes the exact shared plan into the WebCodecs path', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const exporter = new VideoExporter(document.createElement('canvas'));
    exporter._exportWebCodecs = vi.fn(async ({ framePlan }) => {
      expect([...framePlan.samples()]).toHaveLength(framePlan.frameCount);
      return new Blob(['video'], { type: 'video/mp4' });
    });

    await exporter.export({
      format: 'mp4',
      frameRate: 25,
      duration: 1000,
      renderFrame: vi.fn(),
      capabilityPlan: {
        supported: true,
        strategy: 'webcodecs',
        format: 'mp4',
        mimeType: 'video/mp4',
        codecConfig: {
          codec: 'avc1.640033',
          _container: 'mp4',
          _label: 'H.264 test'
        }
      }
    });

    const framePlan = exporter._exportWebCodecs.mock.calls[0][0].framePlan;
    expect(framePlan.frameCount).toBe(25);
    expect(framePlan.sampleAt(0).progress).toBe(0);
    expect(framePlan.sampleAt(24).progress).toBe(1);
  });
});

describe('format-locked video capability planning', () => {
  test('locks MP4 to a proven H.264 WebCodecs config', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    class MockVideoEncoder {
      static isConfigSupported = vi.fn(async config => ({ supported: true, config }));
    }
    vi.stubGlobal('VideoEncoder', MockVideoEncoder);
    vi.stubGlobal('VideoFrame', class MockVideoFrame {});

    const plan = await VideoExporter.createExportPlan({
      format: 'mp4',
      width: 1920,
      height: 1080,
      frameRate: 25,
      canvas: document.createElement('canvas')
    });

    expect(plan).toMatchObject({
      supported: true,
      strategy: 'webcodecs',
      format: 'mp4',
      mimeType: 'video/mp4'
    });
    expect(plan.codecConfig._container).toBe('mp4');
    expect(plan.codecConfig.codec).toMatch(/^avc1\./);
  });

  test('never crosses an MP4 request into a generic MediaRecorder result', async () => {
    const captureStream = vi.fn();
    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.stubGlobal('VideoEncoder', undefined);
    vi.stubGlobal('VideoFrame', undefined);

    const plan = await VideoExporter.createExportPlan({
      format: 'mp4',
      width: 1920,
      height: 1080,
      frameRate: 25,
      canvas: { captureStream }
    });

    expect(plan).toMatchObject({ supported: false, strategy: null, format: 'mp4' });
    expect(plan.reason).toContain('H.264 WebCodecs');
    expect(captureStream).not.toHaveBeenCalled();
  });

  test('rejects a stale capability plan for a different requested format', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const exporter = new VideoExporter(document.createElement('canvas'));
    const renderFrame = vi.fn();

    await expect(exporter.export({
      format: 'mp4',
      frameRate: 25,
      duration: 1000,
      renderFrame,
      capabilityPlan: {
        supported: true,
        strategy: 'webcodecs',
        format: 'webm',
        mimeType: 'video/webm',
        codecConfig: { codec: 'vp8', _container: 'webm' }
      }
    })).rejects.toThrow('format mismatch');

    expect(renderFrame).not.toHaveBeenCalled();
  });

  test('proves the exact WebM MediaRecorder, stream and manual-frame APIs', async () => {
    const track = { requestFrame: vi.fn(), stop: vi.fn() };
    const stream = {
      getVideoTracks: vi.fn(() => [track]),
      getTracks: vi.fn(() => [track])
    };
    class MockMediaRecorder {
      static isTypeSupported = vi.fn(type => type === 'video/webm;codecs=vp8');
      constructor(receivedStream, options) {
        this.stream = receivedStream;
        this.options = options;
      }
      start() {}
      stop() {}
      pause() {}
      resume() {}
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.stubGlobal('VideoEncoder', undefined);
    vi.stubGlobal('VideoFrame', undefined);

    const plan = await VideoExporter.createExportPlan({
      format: 'webm',
      width: 1280,
      height: 720,
      frameRate: 25,
      videoBitrate: 5_000_000,
      canvas: { captureStream: vi.fn(() => stream) }
    });

    expect(plan).toMatchObject({
      supported: true,
      strategy: 'mediarecorder',
      format: 'webm',
      mimeType: 'video/webm;codecs=vp8',
      mediaStream: stream,
      videoTrack: track
    });
    expect(plan.mediaRecorder).toBeInstanceOf(MockMediaRecorder);
    expect(plan.mediaRecorder.options.videoBitsPerSecond).toBe(5_000_000);
    plan.dispose();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  test('rejects and cleans up a fallback without manual frame capture', async () => {
    const track = { stop: vi.fn() };
    const stream = {
      getVideoTracks: vi.fn(() => [track]),
      getTracks: vi.fn(() => [track])
    };
    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      start() {}
      stop() {}
      pause() {}
      resume() {}
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.stubGlobal('VideoEncoder', undefined);
    vi.stubGlobal('VideoFrame', undefined);

    const plan = await VideoExporter.createExportPlan({
      format: 'webm',
      width: 1280,
      height: 720,
      canvas: { captureStream: vi.fn(() => stream) }
    });

    expect(plan).toMatchObject({ supported: false, strategy: null, format: 'webm' });
    expect(plan.reason).toContain('manually capture');
    expect(track.stop).toHaveBeenCalledOnce();
  });
});

describe('MediaRecorder visibility and failure cleanup', () => {
  test('pauses immediately during pacing and counts only visible time after resume', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    let visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);

    const { capabilityPlan, recorder, track } = createRecorderHarness();
    const eventBus = { emit: vi.fn() };
    const exporter = new VideoExporter(document.createElement('canvas'), eventBus);
    const exportPromise = exporter.export({
      format: 'webm',
      frameRate: 2,
      duration: 1000,
      renderFrame: vi.fn(),
      capabilityPlan
    });

    await flushUntil(() => expect(track.requestFrame).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(100);

    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(recorder.pause).toHaveBeenCalledOnce();
    expect(recorder.state).toBe('paused');

    await vi.advanceTimersByTimeAsync(5000);
    expect(track.requestFrame).toHaveBeenCalledTimes(1);

    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(recorder.resume).toHaveBeenCalledOnce();
    expect(recorder.state).toBe('recording');

    await vi.advanceTimersByTimeAsync(399);
    expect(track.requestFrame).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(track.requestFrame).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(500);
    await exportPromise;

    expect(eventBus.emit.mock.calls.filter(([name]) => name === 'video:export-paused')).toHaveLength(1);
    expect(eventBus.emit.mock.calls.filter(([name]) => name === 'video:export-resumed')).toHaveLength(1);
  });

  test('cancels while hidden without waiting for visibility and removes the guard', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);

    const { capabilityPlan, recorder, track } = createRecorderHarness();
    const eventBus = { emit: vi.fn() };
    const exporter = new VideoExporter(document.createElement('canvas'), eventBus);
    const exportPromise = exporter.export({
      format: 'webm',
      frameRate: 2,
      duration: 1000,
      renderFrame: vi.fn(),
      capabilityPlan
    });

    await flushUntil(() => expect(track.requestFrame).toHaveBeenCalledTimes(1));
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(recorder.pause).toHaveBeenCalledOnce();

    exporter.cancel();
    await expect(exportPromise).rejects.toThrow('Export cancelled');
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(exporter.isExporting).toBe(false);
    expect(exporter.abortController).toBeNull();

    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(recorder.resume).not.toHaveBeenCalled();
    expect(eventBus.emit.mock.calls.filter(([name]) => name === 'video:export-resumed')).toHaveLength(0);
  });

  test('stops the recorder and stream without replacing a capture failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const captureError = new Error('manual frame capture failed');
    const { capabilityPlan, recorder, track } = createRecorderHarness({
      requestFrame: () => {
        throw captureError;
      }
    });
    const onError = vi.fn();
    const exporter = new VideoExporter(document.createElement('canvas'));

    await expect(exporter.export({
      format: 'webm',
      frameRate: 25,
      duration: 1000,
      renderFrame: vi.fn(),
      onError,
      capabilityPlan
    })).rejects.toBe(captureError);

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(captureError);
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(recorder.ondataavailable).toBeNull();
    expect(recorder.onstop).toBeNull();
    expect(recorder.onerror).toBeNull();
  });
});

describe('WebCodecs resource cleanup', () => {
  test('closes each VideoFrame, the encoder, and the muxer when encode throws', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const encodeError = new Error('encode failed');
    const frames = [];
    let encoderInstance;

    class MockVideoFrame {
      constructor() {
        this.close = vi.fn();
        frames.push(this);
      }
    }
    class MockVideoEncoder {
      constructor() {
        this.encodeQueueSize = 0;
        this.configure = vi.fn();
        this.encode = vi.fn(() => {
          throw encodeError;
        });
        this.flush = vi.fn().mockResolvedValue(undefined);
        this.close = vi.fn();
        this.addEventListener = vi.fn();
        this.removeEventListener = vi.fn();
        encoderInstance = this;
      }
    }
    vi.stubGlobal('VideoFrame', MockVideoFrame);
    vi.stubGlobal('VideoEncoder', MockVideoEncoder);

    const { api, outputs } = createMockMediaApi();
    const exporter = new VideoExporter(document.createElement('canvas'), null, api);
    exporter._yieldToMain = vi.fn().mockResolvedValue(undefined);

    await expect(exporter.export({
      format: 'webm',
      frameRate: 25,
      duration: 1000,
      renderFrame: vi.fn(),
      capabilityPlan: {
        supported: true,
        strategy: 'webcodecs',
        format: 'webm',
        mimeType: 'video/webm',
        codecConfig: {
          codec: 'vp8',
          _muxCodec: 'V_VP8',
          _container: 'webm',
          _label: 'VP8 test'
        }
      }
    })).rejects.toBe(encodeError);

    expect(frames).toHaveLength(1);
    expect(frames[0].close).toHaveBeenCalledOnce();
    expect(encoderInstance.close).toHaveBeenCalledOnce();
    expect(outputs[0].cancel).toHaveBeenCalledOnce();
    expect(outputs[0].finalize).not.toHaveBeenCalled();
  });

  test('awaits muxer cancellation and preserves the primary render failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const renderError = new Error('render failed');
    let resolveCancel;
    const cancelPromise = new Promise(resolve => {
      resolveCancel = resolve;
    });
    let encoderInstance;

    class MockVideoEncoder {
      constructor() {
        this.encodeQueueSize = 0;
        this.configure = vi.fn();
        this.encode = vi.fn();
        this.flush = vi.fn().mockResolvedValue(undefined);
        this.close = vi.fn();
        this.addEventListener = vi.fn();
        this.removeEventListener = vi.fn();
        encoderInstance = this;
      }
    }
    vi.stubGlobal('VideoEncoder', MockVideoEncoder);
    vi.stubGlobal('VideoFrame', class MockVideoFrame {});

    const { api, outputs } = createMockMediaApi({ cancelPromise });
    const exporter = new VideoExporter(document.createElement('canvas'), null, api);
    exporter._yieldToMain = vi.fn().mockResolvedValue(undefined);
    const exportPromise = exporter.export({
      format: 'webm',
      frameRate: 25,
      duration: 1000,
      renderFrame: vi.fn(() => {
        throw renderError;
      }),
      capabilityPlan: {
        supported: true,
        strategy: 'webcodecs',
        format: 'webm',
        mimeType: 'video/webm',
        codecConfig: {
          codec: 'vp8',
          _muxCodec: 'V_VP8',
          _container: 'webm',
          _label: 'VP8 test'
        }
      }
    });
    let settled = false;
    exportPromise.then(
      () => { settled = true; },
      () => { settled = true; }
    );

    await flushUntil(() => expect(outputs[0].cancel).toHaveBeenCalledOnce());
    expect(settled).toBe(false);
    expect(encoderInstance.close).toHaveBeenCalledOnce();

    resolveCancel();
    await expect(exportPromise).rejects.toBe(renderError);
    expect(outputs[0].finalize).not.toHaveBeenCalled();
    expect(exporter.isExporting).toBe(false);
  });

  test('finalizes successful output without canceling it', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let encoderInstance;
    const frames = [];

    class MockVideoEncoder {
      constructor() {
        this.encodeQueueSize = 0;
        this.configure = vi.fn();
        this.encode = vi.fn();
        this.flush = vi.fn().mockResolvedValue(undefined);
        this.close = vi.fn();
        this.addEventListener = vi.fn();
        this.removeEventListener = vi.fn();
        encoderInstance = this;
      }
    }
    class MockVideoFrame {
      constructor() {
        this.close = vi.fn();
        frames.push(this);
      }
    }
    vi.stubGlobal('VideoEncoder', MockVideoEncoder);
    vi.stubGlobal('VideoFrame', MockVideoFrame);

    const { api, outputs } = createMockMediaApi();
    const exporter = new VideoExporter(document.createElement('canvas'), null, api);
    exporter._yieldToMain = vi.fn().mockResolvedValue(undefined);
    const exportPromise = exporter.export({
      format: 'webm',
      frameRate: 2,
      duration: 1000,
      renderFrame: vi.fn(),
      capabilityPlan: {
        supported: true,
        strategy: 'webcodecs',
        format: 'webm',
        mimeType: 'video/webm',
        codecConfig: {
          codec: 'vp8',
          _muxCodec: 'V_VP8',
          _container: 'webm',
          _label: 'VP8 test'
        }
      }
    });

    await vi.runAllTimersAsync();
    const blob = await exportPromise;
    expect(blob.type).toBe('video/webm');
    expect(frames).toHaveLength(2);
    expect(frames.every(frame => frame.close.mock.calls.length === 1)).toBe(true);
    expect(encoderInstance.close).toHaveBeenCalledOnce();
    expect(outputs[0].finalize).toHaveBeenCalledOnce();
    expect(outputs[0].cancel).not.toHaveBeenCalled();
  });
});
