/**
 * VideoExporter - Frame-by-frame video export with background-tab resilience
 * 
 * ## Encoding Strategies
 * 
 * ### Primary: WebCodecs (VideoEncoder) + Mediabunny muxer
 * Uses explicit timestamps per frame, so browser timer throttling cannot
 * stretch the authored video timeline. Runtime capability probes choose a
 * container-compatible encoder; no browser/version matrix is assumed here.
 * 
 * ### Fallback: MediaRecorder + visibility-aware pause
 * Uses captureStream(0) for manual frame control. Enhanced with
 * document.visibilitychange detection: export pauses when the tab
 * is hidden and resumes when visible, preventing the timestamp
 * stretching caused by setTimeout throttling in background tabs.
 * 
 * ## Why Two Strategies?
 * MediaRecorder timestamps frames by wall-clock time between
 * requestFrame() calls. In background tabs, browsers throttle
 * setTimeout from ~40ms to ~1000ms+, stretching the video duration.
 * WebCodecs accepts explicit microsecond timestamps, making it
 * immune to this throttling.
 * 
 * ## Usage (unchanged from original API)
 * ```javascript
 * const exporter = new VideoExporter(canvas, eventBus);
 * await exporter.export({
 *   frameRate: 25,
 *   duration: 10000,
 *   startBuffer: 2000,
 *   onProgress: (percent) => updateUI(percent),
 *   renderFrame: (progress) => { seekTo(progress); render(); }
 * });
 * ```
 * 
 * ## Events Emitted
 * - video:export-started   { totalFrames, frameRate, duration, strategy }
 * - video:export-progress  { frame, totalFrames, percent }
 * - video:export-paused    { reason: 'tab-hidden' }  (MediaRecorder only)
 * - video:export-resumed   {}                         (MediaRecorder only)
 * - video:export-complete  { blob, size, strategy }
 * - video:export-error     { error }
 * 
 * ## Browser Support
 * Support is determined at export time by probing the exact codec, container,
 * capture stream, and manual-frame controls required by the requested format.
 * Cross-browser claims remain an explicit release-verification item.
 */

import { Output, WebMOutputFormat, Mp4OutputFormat, BufferTarget, EncodedVideoPacketSource, EncodedPacket } from 'mediabunny';
import { VIDEO_EXPORT } from '../config/constants.js';

const VIDEO_FORMATS = new Set(['mp4', 'webm']);
const WEBM_RECORDER_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm'
];

const DEFAULT_MEDIA_API = Object.freeze({
  Output,
  WebMOutputFormat,
  Mp4OutputFormat,
  BufferTarget,
  EncodedVideoPacketSource,
  EncodedPacket
});

/**
 * Build the one authoritative sampling plan used by every video encoder.
 *
 * Animation duration determines how many frame slots are available; those
 * slots sample progress 0 through 1 inclusively. The start buffer adds its
 * own repeated progress-0 slots. `frameCount` is therefore both the intended
 * video length at the requested rate and the exact count emitted.
 */
export function createVideoFramePlan({ frameRate, duration, startBuffer = 0 }) {
  if (!Number.isFinite(frameRate) || frameRate <= 0) {
    throw new Error('Invalid frame rate: must be positive');
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Invalid duration: must be positive');
  }
  if (!Number.isFinite(startBuffer) || startBuffer < 0) {
    throw new Error('Invalid start buffer: must not be negative');
  }

  const startBufferFrames = Math.ceil((startBuffer / 1000) * frameRate);
  // A video shorter than one frame still needs both authored endpoints. Two
  // samples are the smallest honest representation of progress 0 through 1.
  const animationFrames = Math.max(2, Math.ceil((duration / 1000) * frameRate));
  const frameCount = startBufferFrames + animationFrames;
  const frameDurationUs = Math.round(1_000_000 / frameRate);

  const sampleAt = (frameIndex) => {
    if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= frameCount) {
      throw new RangeError(`Frame index ${frameIndex} is outside the export plan`);
    }

    return Object.freeze({
      frameIndex,
      ordinal: frameIndex + 1,
      progress: frameIndex < startBufferFrames
        ? 0
        : Math.min(1, (frameIndex - startBufferFrames) / (animationFrames - 1)),
      timestampUs: frameIndex * frameDurationUs,
      percent: frameCount === 1
        ? 100
        : Math.round((frameIndex / (frameCount - 1)) * 100)
    });
  };

  return Object.freeze({
    frameRate,
    duration,
    startBuffer,
    startBufferFrames,
    animationFrames,
    frameCount,
    frameDurationUs,
    sampleAt,
    *samples() {
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
        yield sampleAt(frameIndex);
      }
    }
  });
}

function unsupportedPlan(format, reason) {
  return Object.freeze({
    supported: false,
    strategy: null,
    format,
    mimeType: null,
    reason
  });
}

function stopMediaStream(stream) {
  if (typeof stream?.getTracks !== 'function') return;
  for (const track of stream.getTracks()) {
    if (typeof track.stop === 'function') track.stop();
  }
}

export class VideoExporter {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas element to capture
   * @param {EventBus} eventBus - Event bus for status updates
   */
  constructor(canvas, eventBus = null, mediaApi = DEFAULT_MEDIA_API) {
    this.canvas = canvas;
    this.eventBus = eventBus;
    this._mediaApi = mediaApi;
    this.isExporting = false;
    this.abortController = null;
  }

  // ========== SUPPORT DETECTION ==========

  /**
   * Coarse synchronous support hint retained for callers that cannot await a
   * real capability plan. Export execution never relies on this hint.
   * @param {'mp4'|'webm'} [format]
   * @returns {{ supported: boolean, strategy: string|null, mimeType: string|null, reason: string|null }}
   */
  static checkSupport(format = 'webm') {
    if (!VIDEO_FORMATS.has(format)) {
      return { supported: false, mimeType: null, strategy: null, reason: `Unknown video format: ${format}` };
    }

    const hasWebCodecs = typeof VideoEncoder !== 'undefined' &&
                         typeof VideoFrame !== 'undefined' &&
                         typeof VideoEncoder.isConfigSupported === 'function';
    if (hasWebCodecs) {
      return {
        supported: true,
        mimeType: format === 'mp4' ? 'video/mp4' : 'video/webm',
        strategy: 'webcodecs',
        reason: null
      };
    }

    // MP4 is intentionally H.264 WebCodecs-only. A generic MediaRecorder
    // result is not evidence that its MP4 output can satisfy this export.
    if (format === 'mp4') {
      return {
        supported: false,
        mimeType: null,
        strategy: null,
        reason: 'MP4 export requires H.264 WebCodecs support'
      };
    }

    const hasRecorder = typeof MediaRecorder !== 'undefined' &&
                        typeof MediaRecorder.isTypeSupported === 'function';
    const mimeType = hasRecorder
      ? WEBM_RECORDER_MIME_TYPES.find(candidate => MediaRecorder.isTypeSupported(candidate))
      : null;
    return mimeType
      ? { supported: true, mimeType, strategy: 'mediarecorder', reason: null }
      : { supported: false, mimeType: null, strategy: null, reason: 'No WebM video export API available' };
  }

  /**
   * Resolve and lock the complete export capability before emitting a frame.
   * The returned plan never crosses the requested container boundary. The
   * MediaRecorder fallback is WebM-only and carries the exact stream/track
   * whose manual-frame API was proven here.
   *
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  static async createExportPlan({
    format = 'mp4',
    width,
    height,
    frameRate = VIDEO_EXPORT.DEFAULT_FRAME_RATE,
    videoBitrate = VIDEO_EXPORT.DEFAULT_BITRATE,
    canvas = null
  }) {
    if (!VIDEO_FORMATS.has(format)) {
      return unsupportedPlan(format, `Unknown video format: ${format}`);
    }

    const codecConfig = await VideoExporter._testWebCodecsConfig(
      width,
      height,
      videoBitrate,
      frameRate,
      format
    );
    if (codecConfig?._container === format) {
      return Object.freeze({
        supported: true,
        strategy: 'webcodecs',
        format,
        mimeType: format === 'mp4' ? 'video/mp4' : 'video/webm',
        codecConfig,
        reason: null
      });
    }

    if (format === 'mp4') {
      return unsupportedPlan(format, 'MP4 export requires a supported H.264 WebCodecs encoder');
    }

    if (typeof MediaRecorder === 'undefined' ||
        typeof MediaRecorder.isTypeSupported !== 'function') {
      return unsupportedPlan(format, 'WebM export requires WebCodecs or MediaRecorder support');
    }
    if (typeof canvas?.captureStream !== 'function') {
      return unsupportedPlan(format, 'This browser cannot capture the export canvas');
    }

    const mimeType = WEBM_RECORDER_MIME_TYPES.find(candidate => {
      try {
        return MediaRecorder.isTypeSupported(candidate);
      } catch {
        return false;
      }
    });
    if (!mimeType) {
      return unsupportedPlan(format, 'No supported WebM MediaRecorder format was found');
    }

    let mediaStream;
    try {
      mediaStream = canvas.captureStream(0);
      const videoTracks = typeof mediaStream?.getVideoTracks === 'function'
        ? mediaStream.getVideoTracks()
        : [];
      const videoTrack = videoTracks[0];
      if (!videoTrack || typeof videoTrack.requestFrame !== 'function') {
        stopMediaStream(mediaStream);
        return unsupportedPlan(format, 'This browser cannot manually capture reliable video frames');
      }

      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType,
        videoBitsPerSecond: videoBitrate
      });
      const requiredRecorderMethods = ['start', 'stop', 'pause', 'resume'];
      if (requiredRecorderMethods.some(method => typeof mediaRecorder[method] !== 'function')) {
        stopMediaStream(mediaStream);
        return unsupportedPlan(format, 'This browser lacks the MediaRecorder controls required for reliable export');
      }

      return Object.freeze({
        supported: true,
        strategy: 'mediarecorder',
        format,
        mimeType,
        mediaStream,
        videoTrack,
        mediaRecorder,
        dispose: () => stopMediaStream(mediaStream),
        reason: null
      });
    } catch (error) {
      stopMediaStream(mediaStream);
      return unsupportedPlan(format, `The WebM MediaRecorder fallback could not be prepared: ${error.message}`);
    }
  }

  /**
   * Find the best WebCodecs encoder config for the requested container and
   * dimensions. MP4 probes H.264 only; WebM probes VP9 then VP8.
   *
   * Returns an augmented config with `_container` ('mp4'|'webm') and
   * `_muxCodec` (the codec name Mediabunny expects) for the muxer.
   *
   * @param {number} width - Video width in pixels
   * @param {number} height - Video height in pixels
   * @param {number} [bitrate] - Target bitrate
   * @param {number} [framerate] - Target framerate
   * @returns {Promise<Object|null>} Resolved config or null if unsupported
   * @private
   */
  static async _testWebCodecsConfig(width, height, bitrate = VIDEO_EXPORT.DEFAULT_BITRATE, framerate = VIDEO_EXPORT.DEFAULT_FRAME_RATE, format = 'mp4') {
    if (typeof VideoEncoder === 'undefined' ||
        typeof VideoFrame === 'undefined' ||
        typeof VideoEncoder.isConfigSupported !== 'function') return null;

    // Codec candidates filtered by requested format
    // MP4: H.264 (AVCC format for MP4 muxing, even dimensions required)
    // WebM: VP9 (better quality/compression) then VP8 fallback
    const mp4Candidates = [
      { codec: 'avc1.640033', hw: 'prefer-hardware', container: 'mp4', muxCodec: 'avc', label: 'H.264 High L5.1 HW', avc: { format: 'avc' } },
      { codec: 'avc1.4D0032', hw: 'prefer-hardware', container: 'mp4', muxCodec: 'avc', label: 'H.264 Main L5.0 HW', avc: { format: 'avc' } },
      { codec: 'avc1.640033', hw: 'prefer-software', container: 'mp4', muxCodec: 'avc', label: 'H.264 High L5.1 SW', avc: { format: 'avc' } },
    ];
    const webmCandidates = [
      { codec: 'vp09.00.31.08', hw: 'prefer-hardware', container: 'webm', muxCodec: 'vp9', label: 'VP9 Profile 0 HW' },
      { codec: 'vp09.00.31.08', hw: 'prefer-software', container: 'webm', muxCodec: 'vp9', label: 'VP9 Profile 0 SW' },
      { codec: 'vp8',           hw: 'prefer-hardware', container: 'webm', muxCodec: 'vp8', label: 'VP8 HW' },
      { codec: 'vp8',           hw: 'prefer-software', container: 'webm', muxCodec: 'vp8', label: 'VP8 SW' },
    ];
    const candidates = format === 'webm' ? webmCandidates : mp4Candidates;

    for (const c of candidates) {
      try {
        const config = {
          codec: c.codec,
          width,
          height,
          bitrate,
          framerate,
          hardwareAcceleration: c.hw,
          latencyMode: 'realtime',
        };
        // H.264 needs AVCC format for MP4 containers
        if (c.avc) config.avc = c.avc;

        const result = await VideoEncoder.isConfigSupported(config);
        if (result.supported) {
          const resolved = result.config || config;
          console.warn(`\ud83d\udd0d [VideoExporter] Codec probe: ${c.label} \u2192 SUPPORTED (hw=${resolved.hardwareAcceleration || c.hw})`);
          // Attach container and muxer codec metadata
          resolved._container = c.container;
          resolved._muxCodec = c.muxCodec;
          resolved._label = c.label;
          // Ensure avc format is preserved for H.264
          if (c.avc) resolved.avc = c.avc;
          return resolved;
        } else {
          console.warn(`\ud83d\udd0d [VideoExporter] Codec probe: ${c.label} \u2192 unsupported`);
        }
      } catch (e) {
        console.warn(`\ud83d\udd0d [VideoExporter] Codec probe: ${c.label} \u2192 error: ${e.message}`);
      }
    }

    console.warn('\ud83d\udd0d [VideoExporter] No WebCodecs config supported');
    return null;
  }

  // ========== PUBLIC API ==========

  /**
   * Export animation as video file.
   * Selects a proven encoding strategy without changing the requested format.
   * 
   * @param {Object} options - Export options
   * @param {number} options.frameRate - Frames per second (default: 25)
   * @param {number} options.duration - Animation duration in milliseconds
   * @param {Function} options.renderFrame - Renders a frame at given progress (0-1)
   * @param {Function} [options.onProgress] - Progress callback (0-100)
   * @param {Function} [options.onComplete] - Called with Blob when export finishes
   * @param {Function} [options.onError] - Called with Error on failure
   * @param {number} [options.videoBitrate] - Video bitrate (default: 20Mbps)
   * @param {number} [options.startBuffer] - Static frames at start in ms (default: 0)
   * @param {Object} [options.capabilityPlan] - A pre-resolved, format-locked capability plan
   * @returns {Promise<Blob>} Video blob
   */
  async export(options) {
    const {
      frameRate = VIDEO_EXPORT.DEFAULT_FRAME_RATE,
      duration,
      format = 'mp4',
      renderFrame,
      onProgress = () => {},
      onComplete = () => {},
      onError = () => {},
      videoBitrate = VIDEO_EXPORT.DEFAULT_BITRATE,
      startBuffer = 0,
      capabilityPlan = null
    } = options;

    // Validate inputs
    if (!duration || duration <= 0) {
      const error = new Error('Invalid duration: must be positive');
      onError(error);
      throw error;
    }

    if (!renderFrame || typeof renderFrame !== 'function') {
      const error = new Error('renderFrame function is required');
      onError(error);
      throw error;
    }

    // Prevent concurrent exports
    if (this.isExporting) {
      const error = new Error('Export already in progress');
      onError(error);
      throw error;
    }

    this.isExporting = true;
    this.abortController = new AbortController();
    let selectedPlan = capabilityPlan;

    try {
      const framePlan = createVideoFramePlan({ frameRate, duration, startBuffer });
      selectedPlan ||= await VideoExporter.createExportPlan({
        format,
        width: this.canvas.width,
        height: this.canvas.height,
        frameRate,
        videoBitrate,
        canvas: this.canvas
      });

      if (!selectedPlan?.supported) {
        throw new Error(`Video export not supported: ${selectedPlan?.reason || 'No compatible encoder found'}`);
      }
      if (selectedPlan.format !== format) {
        throw new Error(`Video export plan format mismatch: requested ${format}, received ${selectedPlan.format}`);
      }

      if (selectedPlan.strategy === 'webcodecs') {
        const { codecConfig } = selectedPlan;
        if (!codecConfig || codecConfig._container !== format) {
          throw new Error(`WebCodecs plan cannot produce the requested ${format.toUpperCase()} container`);
        }
        const hw = codecConfig.hardwareAcceleration || 'unknown';
        console.log(`\ud83c\udfac [VideoExporter] Using WebCodecs: ${codecConfig._label} (${codecConfig._container}) \u2014 hw=${hw}`);
        return await this._exportWebCodecs({
          frameRate,
          duration,
          renderFrame,
          onProgress,
          onComplete,
          videoBitrate,
          framePlan,
          codecConfig
        });
      }

      if (selectedPlan.strategy !== 'mediarecorder' ||
          selectedPlan.format !== 'webm' ||
          !selectedPlan.mimeType?.startsWith('video/webm') ||
          !selectedPlan.mediaStream ||
          typeof selectedPlan.videoTrack?.requestFrame !== 'function' ||
          !selectedPlan.mediaRecorder) {
        throw new Error('MediaRecorder plan does not prove a reliable WebM export path');
      }

      console.log('🎬 [VideoExporter] Using MediaRecorder fallback (pauses on tab switch)');
      return await this._exportMediaRecorder({
        frameRate,
        duration,
        renderFrame,
        onProgress,
        onComplete,
        framePlan,
        capabilityPlan: selectedPlan
      });

    } catch (error) {
      console.error('❌ [VideoExporter] Export failed:', error);
      this.eventBus?.emit('video:export-error', { error });
      onError(error);
      throw error;

    } finally {
      if (selectedPlan?.strategy === 'mediarecorder') {
        if (typeof selectedPlan.dispose === 'function') {
          selectedPlan.dispose();
        } else {
          stopMediaStream(selectedPlan.mediaStream);
        }
      }
      this.isExporting = false;
      this.abortController = null;
    }
  }

  /**
   * Cancel an in-progress export
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      console.log('🛑 [VideoExporter] Export cancelled');
    }
  }

  /**
   * Trigger download of video blob
   * @param {Blob} blob - Video blob to download
   * @param {string} [filename] - Filename (default: route-animation-{timestamp}.webm)
   */
  static downloadBlob(blob, filename = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const name = filename || `route-animation-${timestamp}.${extension}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`📥 [VideoExporter] Downloaded: ${name}`);
  }

  // ========== WEBCODECS PATH ==========

  /**
   * Export using WebCodecs VideoEncoder with explicit timestamps.
   * Each frame's presentation timestamp is computed mathematically
   * (frameIndex × frameDuration), making the output immune to
   * setTimeout throttling in background tabs.
   * 
   * Uses Mediabunny for MP4/WebM container muxing.
   * @private
   */
  async _exportWebCodecs({ frameRate, duration, renderFrame, onProgress, onComplete, videoBitrate, framePlan, codecConfig }) {
    const totalFrames = framePlan.frameCount;
    const isH264 = codecConfig.codec.startsWith('avc1');
    const {
      Output: OutputClass,
      WebMOutputFormat: WebMOutputFormatClass,
      Mp4OutputFormat: Mp4OutputFormatClass,
      BufferTarget: BufferTargetClass,
      EncodedVideoPacketSource: EncodedVideoPacketSourceClass,
      EncodedPacket: EncodedPacketClass
    } = this._mediaApi;

    console.warn(`🎬 [VideoExporter] STEP 1/4: Setup — ${totalFrames} frames at ${frameRate}fps, ` +
      `${this.canvas.width}×${this.canvas.height}, ${(videoBitrate / 1_000_000).toFixed(0)}Mbps, ` +
      `codec=${codecConfig._label}, container=${codecConfig._container}`);
    this.eventBus?.emit('video:export-started', { totalFrames, frameRate, duration, strategy: 'webcodecs' });

    // Yield so the log above can flush to console
    await this._yieldToMain();

    // ── Step 2: Initialize muxer ──
    const isMP4 = codecConfig._container === 'mp4';
    const mimeType = isMP4 ? 'video/mp4' : 'video/webm';
    let output = null;
    let videoSource = null;
    let encoder = null;
    let encoderError = null;
    let finalized = false;
    let muxCount = 0;

    try {
      try {
        output = new OutputClass({
          format: isMP4 ? new Mp4OutputFormatClass() : new WebMOutputFormatClass(),
          target: new BufferTargetClass(),
        });
        videoSource = new EncodedVideoPacketSourceClass(codecConfig._muxCodec);
        output.addVideoTrack(videoSource, { frameRate });
        await output.start();
        console.warn(`🎬 [VideoExporter] STEP 2/4: Muxer ready (${isMP4 ? 'MP4' : 'WebM'})`);
      } catch (e) {
        console.error('❌ [VideoExporter] Muxer init failed:', e);
        throw e;
      }

      await this._yieldToMain();

      // ── Step 3: Initialize encoder ──
      try {
        encoder = new VideoEncoder({
          output: async (chunk, meta) => {
            try {
              await videoSource.add(EncodedPacketClass.fromEncodedChunk(chunk), meta);
              muxCount++;
            } catch (e) {
              console.error('❌ [VideoExporter] Muxer add packet failed:', e);
              encoderError = e;
            }
          },
          error: (e) => {
            console.error('❌ [VideoExporter] Encoder error callback:', e);
            encoderError = e;
          }
        });

        const encConfig = {
          codec: codecConfig.codec,
          width: this.canvas.width,
          height: this.canvas.height,
          bitrate: videoBitrate,
          framerate: frameRate,
          hardwareAcceleration: codecConfig.hardwareAcceleration || 'prefer-hardware',
          latencyMode: codecConfig.latencyMode || 'realtime',
        };
        // H.264 needs AVCC byte format for MP4 container muxing
        if (isH264) encConfig.avc = { format: 'avc' };

        encoder.configure(encConfig);
        console.warn(`🎬 [VideoExporter] STEP 3/4: Encoder configured (${codecConfig._label})`);
      } catch (e) {
        console.error('❌ [VideoExporter] Encoder init failed:', e);
        throw e;
      }

      await this._yieldToMain();

      // ── Step 4: Render and encode frames ──
      console.warn(`🎬 [VideoExporter] STEP 4/4: Starting frame loop (${totalFrames} frames)`);
      const diag = {
        totalRenderMs: 0,
        totalEncodeMs: 0,
        totalBackpressureMs: 0,
        totalYieldMs: 0,
        backpressureHits: 0,
        startTime: performance.now(),
      };

      for (const sample of framePlan.samples()) {
        const { frameIndex: frame, progress, timestampUs, percent } = sample;
        if (this.abortController.signal.aborted) {
          throw new Error('Export cancelled');
        }

        // Check for async encoder/muxer errors
        if (encoderError) {
          throw new Error(`Encoder/muxer error during export: ${encoderError.message || encoderError}`);
        }

        // Backpressure: wait for encoder 'dequeue' event instead of polling
        // Race with abort signal so Escape key cancels immediately
        if (encoder.encodeQueueSize > VIDEO_EXPORT.ENCODER_QUEUE_LIMIT) {
          const bpStart = performance.now();
          diag.backpressureHits++;
          await new Promise(resolve => {
            const onDequeue = () => { cleanup(); resolve(); };
            const onAbort  = () => { cleanup(); resolve(); };
            const cleanup  = () => {
              encoder.removeEventListener('dequeue', onDequeue);
              this.abortController.signal.removeEventListener('abort', onAbort);
            };
            encoder.addEventListener('dequeue', onDequeue, { once: true });
            this.abortController.signal.addEventListener('abort', onAbort, { once: true });
          });
          diag.totalBackpressureMs += performance.now() - bpStart;
          if (this.abortController.signal.aborted) {
            throw new Error('Export cancelled');
          }
        }

        // Render the frame
        const renderStart = performance.now();
        await renderFrame(progress);
        diag.totalRenderMs += performance.now() - renderStart;

        // Create VideoFrame with explicit timestamp (microseconds) and encode.
        // Always close the frame, including when encode() throws synchronously.
        const encodeStart = performance.now();
        let videoFrame = null;
        try {
          videoFrame = new VideoFrame(this.canvas, {
            timestamp: timestampUs,
            duration: framePlan.frameDurationUs,
          });

          const keyFrame = frame === 0 || frame % VIDEO_EXPORT.KEYFRAME_INTERVAL === 0;
          encoder.encode(videoFrame, { keyFrame });
        } finally {
          videoFrame?.close();
        }
        diag.totalEncodeMs += performance.now() - encodeStart;

        // Progress update
        onProgress(percent);
        this.eventBus?.emit('video:export-progress', { frame, totalFrames, percent });

        // Yield EVERY frame via setTimeout to keep UI + console alive
        const yieldStart = performance.now();
        await new Promise(resolve => setTimeout(resolve, 0));
        diag.totalYieldMs += performance.now() - yieldStart;

        // Periodic diagnostic log (every 1 second of video)
        if (frame > 0 && frame % frameRate === 0) {
          const elapsed = performance.now() - diag.startTime;
          const fps = frame / (elapsed / 1000);
          console.warn(`📊 [VideoExporter] Frame ${sample.ordinal}/${totalFrames}: ` +
            `${fps.toFixed(1)}fps | queue=${encoder.encodeQueueSize} | mux=${muxCount}pkts`);
        }
      }

      // Flush encoder and finalize muxer
      console.warn('🎬 [VideoExporter] Flushing encoder...');
      const flushStart = performance.now();
      await encoder.flush();
      if (encoderError) {
        throw new Error(`Encoder/muxer error during export: ${encoderError.message || encoderError}`);
      }
      encoder.close();
      encoder = null;
      await output.finalize();
      finalized = true;
      const flushMs = performance.now() - flushStart;

      const blob = new Blob([output.target.buffer], { type: mimeType });
      const totalMs = performance.now() - diag.startTime;
      const n = totalFrames;

      // ── Performance summary ──
      console.warn(`✅ [VideoExporter] Export complete: ${(blob.size / 1024 / 1024).toFixed(2)}MB (${mimeType})`);
      console.warn(`📊 Performance: ${(totalMs / 1000).toFixed(1)}s for ${n} frames (${(n / (totalMs / 1000)).toFixed(1)} fps)`);
      console.warn(`   Render: ${(diag.totalRenderMs / n).toFixed(1)}ms avg | Encode: ${(diag.totalEncodeMs / n).toFixed(1)}ms avg`);
      console.warn(`   Backpressure: ${diag.backpressureHits} waits (${(diag.totalBackpressureMs / 1000).toFixed(1)}s) | Flush: ${flushMs.toFixed(0)}ms`);

      this.eventBus?.emit('video:export-complete', { blob, size: blob.size, strategy: 'webcodecs' });

      onComplete(blob);
      return blob;
    } finally {
      if (encoder) {
        try {
          encoder.close();
        } catch (cleanupError) {
          console.warn('⚠️ [VideoExporter] Encoder cleanup failed:', cleanupError);
        }
      }
      if (output && !finalized && typeof output.cancel === 'function') {
        try {
          await output.cancel();
        } catch (cleanupError) {
          console.warn('⚠️ [VideoExporter] Muxer cleanup failed:', cleanupError);
        }
      }
    }
  }

  // ========== MEDIARECORDER FALLBACK ==========

  /**
   * Export using MediaRecorder with visibility-aware pause.
   * When the tab becomes hidden, the recorder and frame loop pause to
   * prevent setTimeout throttling from stretching the video duration.
   * Resumes automatically when the tab becomes visible again.
   * @private
   */
  async _exportMediaRecorder({ frameRate, duration, renderFrame, onProgress, onComplete, framePlan, capabilityPlan }) {
    const totalFrames = framePlan.frameCount;
    const frameInterval = 1000 / frameRate;
    const { mimeType, videoTrack, mediaRecorder: recorder } = capabilityPlan;
    const signal = this.abortController.signal;

    console.log(`🎬 [VideoExporter] MediaRecorder: ${totalFrames} frames at ${frameRate}fps ` +
      `(${framePlan.startBufferFrames} buffer + ${framePlan.animationFrames} animation frames)`);
    this.eventBus?.emit('video:export-started', { totalFrames, frameRate, duration, strategy: 'mediarecorder' });

    const chunks = [];
    let visibilityController = null;
    let rejectRecorderFailure;
    const recorderFailure = new Promise((_, reject) => {
      rejectRecorderFailure = reject;
    });
    const guardRecorder = promise => Promise.race([Promise.resolve(promise), recorderFailure]);

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunks.push(event.data);
    };
    recorder.onerror = (event) => {
      rejectRecorderFailure(event.error || new Error('Recording failed'));
    };

    try {
      recorder.start();
      visibilityController = this._createRecorderVisibilityController(recorder, signal);

      // Render each frame with adaptive timing and continuous visibility awareness.
      for (const sample of framePlan.samples()) {
        const { frameIndex: frame, progress, percent } = sample;

        if (signal.aborted) {
          throw new Error('Export cancelled');
        }

        await guardRecorder(visibilityController.waitUntilVisible());
        const frameStartTime = visibilityController.activeNow();

        // Rendering may itself span a visibility transition. The recorder is
        // paused immediately by the lifetime guard, and capture waits until
        // the document is visible again.
        await guardRecorder(renderFrame(progress));
        await guardRecorder(visibilityController.waitUntilVisible());
        if (signal.aborted) {
          throw new Error('Export cancelled');
        }

        videoTrack.requestFrame();

        onProgress(percent);
        this.eventBus?.emit('video:export-progress', { frame, totalFrames, percent });

        // Exclude hidden time from pacing so a throttled background timer can
        // never become dead time in the recording.
        const elapsed = visibilityController.activeNow() - frameStartTime;
        const remainingTime = Math.max(10, frameInterval - elapsed);
        await guardRecorder(visibilityController.waitForVisibleDuration(remainingTime));
      }

      // Stop recording and wait for the final dataavailable/onstop sequence.
      const stopResult = new Promise((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        try {
          recorder.stop();
        } catch (error) {
          reject(error);
        }
      });
      const blob = await guardRecorder(stopResult);

      console.log(`✅ [VideoExporter] MediaRecorder export complete: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
      this.eventBus?.emit('video:export-complete', { blob, size: blob.size, strategy: 'mediarecorder' });

      onComplete(blob);
      return blob;
    } finally {
      visibilityController?.dispose();
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch (cleanupError) {
          console.warn('⚠️ [VideoExporter] Recorder cleanup failed:', cleanupError);
        }
      }
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
    }
  }

  // ========== VISIBILITY MANAGEMENT ==========

  /**
   * Install one export-lifetime visibility guard. It pauses the recorder as
   * soon as the document becomes hidden, exposes a clock that excludes hidden
   * time, and makes both pacing and hidden waits abortable.
   * @private
   */
  _createRecorderVisibilityController(recorder, signal) {
    let hidden = false;
    let hiddenStartedAt = null;
    let totalHiddenMs = 0;
    let pausedForVisibility = false;
    let disposed = false;
    let fatalError = null;
    const visibleWaiters = new Set();

    const cancellationError = () => new Error('Export cancelled');
    const settleVisibleWaiters = (error = null) => {
      for (const waiter of visibleWaiters) {
        if (error) waiter.reject(error);
        else waiter.resolve();
      }
      visibleWaiters.clear();
    };

    const activeNow = () => {
      const now = performance.now();
      const currentHiddenMs = hidden && hiddenStartedAt !== null
        ? now - hiddenStartedAt
        : 0;
      return now - totalHiddenMs - currentHiddenMs;
    };

    const handleVisibilityChange = () => {
      if (disposed) return;
      const nextHidden = document.visibilityState !== 'visible';
      if (nextHidden === hidden) return;

      const now = performance.now();
      if (nextHidden) {
        hidden = true;
        hiddenStartedAt = now;
        try {
          if (recorder.state === 'recording') {
            recorder.pause();
            pausedForVisibility = true;
          }
        } catch (error) {
          fatalError = error;
          settleVisibleWaiters(error);
          return;
        }
        this.eventBus?.emit('video:export-paused', { reason: 'tab-hidden' });
        console.log('⏸️ [VideoExporter] Export paused (tab hidden)');
        return;
      }

      if (hiddenStartedAt !== null) {
        totalHiddenMs += now - hiddenStartedAt;
      }
      hidden = false;
      hiddenStartedAt = null;
      try {
        if (pausedForVisibility && recorder.state === 'paused') {
          recorder.resume();
        }
      } catch (error) {
        fatalError = error;
        settleVisibleWaiters(error);
        return;
      }
      pausedForVisibility = false;
      this.eventBus?.emit('video:export-resumed');
      console.log('▶️ [VideoExporter] Export resumed (tab visible)');
      settleVisibleWaiters();
    };

    const handleAbort = () => settleVisibleWaiters(cancellationError());
    document.addEventListener('visibilitychange', handleVisibilityChange);
    signal.addEventListener('abort', handleAbort);
    handleVisibilityChange();

    const waitUntilVisible = () => {
      if (fatalError) return Promise.reject(fatalError);
      if (signal.aborted) return Promise.reject(cancellationError());
      if (!hidden && document.visibilityState === 'visible') return Promise.resolve();
      return new Promise((resolve, reject) => {
        visibleWaiters.add({ resolve, reject });
      });
    };

    const waitForVisibleDuration = async (durationMs) => {
      let remainingMs = Math.max(0, durationMs);
      while (remainingMs > 0) {
        await waitUntilVisible();
        const segmentStartedAt = activeNow();
        let cleanupInterruption = () => {};
        const interruption = new Promise((resolve, reject) => {
          const onVisibility = () => {
            if (document.visibilityState !== 'visible') {
              cleanup();
              resolve('hidden');
            }
          };
          const onAbort = () => {
            cleanup();
            reject(cancellationError());
          };
          const cleanup = () => {
            document.removeEventListener('visibilitychange', onVisibility);
            signal.removeEventListener('abort', onAbort);
          };
          cleanupInterruption = cleanup;
          document.addEventListener('visibilitychange', onVisibility);
          signal.addEventListener('abort', onAbort);
          onVisibility();
          if (signal.aborted) onAbort();
        });

        let outcome;
        try {
          outcome = await Promise.race([
            this._delay(remainingMs).then(() => 'elapsed'),
            interruption
          ]);
        } finally {
          cleanupInterruption();
        }
        if (outcome === 'elapsed') return;
        remainingMs = Math.max(0, remainingMs - (activeNow() - segmentStartedAt));
      }
    };

    return {
      activeNow,
      waitUntilVisible,
      waitForVisibleDuration,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        signal.removeEventListener('abort', handleAbort);
        settleVisibleWaiters(cancellationError());
      }
    };
  }

  // ========== UTILITIES ==========

  /**
   * Yield to main thread to prevent UI freeze.
   * Uses scheduler.yield() if available, falls back to setTimeout.
   * @private
   */
  async _yieldToMain() {
    if ('scheduler' in window && 'yield' in scheduler) {
      return scheduler.yield();
    }
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Delay for specified milliseconds.
   * Used to pace frame capture for MediaRecorder.
   * @param {number} ms - Milliseconds to delay
   * @private
   */
  async _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
