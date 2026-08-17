/**
 * VideoExporter - Frame-by-frame video export with background-tab resilience
 * 
 * ## Encoding Strategies
 * 
 * ### Primary: WebCodecs (VideoEncoder) + Mediabunny muxer
 * Uses explicit timestamps per frame, completely immune to browser tab
 * throttling. The user can freely switch tabs during export without
 * affecting output quality or duration.
 * - Chrome 94+, Edge 94+: Full VP8 support
 * - Safari 16.4+: May not support VP8; falls back to MediaRecorder
 * - Firefox: No WebCodecs support; falls back to MediaRecorder
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
 * - Chrome 94+/Edge 94+: WebCodecs (VP8, immune to tab throttling)
 * - Firefox: MediaRecorder fallback (pauses on tab switch)
 * - Safari 14.1+: MediaRecorder fallback (pauses on tab switch)
 */

import { Output, WebMOutputFormat, Mp4OutputFormat, BufferTarget, EncodedVideoPacketSource, EncodedPacket } from 'mediabunny';
import { VIDEO_EXPORT } from '../config/constants.js';

export class VideoExporter {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas element to capture
   * @param {EventBus} eventBus - Event bus for status updates
   */
  constructor(canvas, eventBus = null) {
    this.canvas = canvas;
    this.eventBus = eventBus;
    this.isExporting = false;
    this.abortController = null;
  }

  // ========== SUPPORT DETECTION ==========

  /**
   * Check if any video export is supported in this browser.
   * Reports which strategy will be used.
   * @returns {{ supported: boolean, strategy: string|null, mimeType: string|null, reason: string|null }}
   */
  static checkSupport() {
    // Check WebCodecs first (preferred — immune to tab throttling)
    const hasWebCodecs = typeof VideoEncoder !== 'undefined' &&
                         typeof VideoFrame !== 'undefined';
    
    if (hasWebCodecs) {
      // WebCodecs detected — actual codec check happens async in export()
      return { supported: true, mimeType: 'video/webm', strategy: 'webcodecs', reason: null };
    }

    // Fall back to MediaRecorder
    if (typeof MediaRecorder === 'undefined') {
      return { supported: false, mimeType: null, strategy: null, reason: 'No video export API available' };
    }

    const formats = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];

    for (const format of formats) {
      if (MediaRecorder.isTypeSupported(format)) {
        return { supported: true, mimeType: format, strategy: 'mediarecorder', reason: null };
      }
    }

    return { supported: false, mimeType: null, strategy: null, reason: 'No supported video format found' };
  }

  /**
   * Find the best WebCodecs encoder config for the given dimensions.
   * Tries H.264 with hardware acceleration first (fast on all modern
   * hardware), then falls back to VP8.
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
    if (typeof VideoEncoder === 'undefined') return null;

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
   * Automatically selects the best encoding strategy for the current browser.
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
      startBuffer = 0
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

    try {
      // Check WebCodecs support for the actual export dimensions
      const codecConfig = await VideoExporter._testWebCodecsConfig(
        this.canvas.width, this.canvas.height, videoBitrate, frameRate, format
      );

      if (codecConfig) {
        const hw = codecConfig.hardwareAcceleration || 'unknown';
        console.log(`\ud83c\udfac [VideoExporter] Using WebCodecs: ${codecConfig._label} (${codecConfig._container}) \u2014 hw=${hw}`);
        return await this._exportWebCodecs({
          frameRate, duration, renderFrame, onProgress, onComplete, videoBitrate, startBuffer,
          codecConfig
        });
      }

      // Fallback to MediaRecorder with visibility-aware pause
      const support = VideoExporter.checkSupport();
      if (!support.supported) {
        const error = new Error(`Video export not supported: ${support.reason}`);
        onError(error);
        throw error;
      }

      console.log('🎬 [VideoExporter] Using MediaRecorder fallback (pauses on tab switch)');
      return await this._exportMediaRecorder({
        frameRate, duration, renderFrame, onProgress, onComplete, videoBitrate, startBuffer,
        mimeType: support.mimeType
      });

    } catch (error) {
      console.error('❌ [VideoExporter] Export failed:', error);
      this.eventBus?.emit('video:export-error', { error });
      onError(error);
      throw error;

    } finally {
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
   * Uses Mediabunny for WebM container muxing.
   * @private
   */
  async _exportWebCodecs({ frameRate, duration, renderFrame, onProgress, onComplete, videoBitrate, startBuffer, codecConfig }) {
    const startBufferFrames = Math.ceil((startBuffer / 1000) * frameRate);
    const animationFrames = Math.ceil((duration / 1000) * frameRate);
    const totalFrames = startBufferFrames + animationFrames;
    const frameDurationUs = Math.round(1_000_000 / frameRate); // microseconds per frame
    const isH264 = codecConfig.codec.startsWith('avc1');

    console.warn(`🎬 [VideoExporter] STEP 1/4: Setup — ${totalFrames} frames at ${frameRate}fps, ` +
      `${this.canvas.width}×${this.canvas.height}, ${(videoBitrate / 1_000_000).toFixed(0)}Mbps, ` +
      `codec=${codecConfig._label}, container=${codecConfig._container}`);
    this.eventBus?.emit('video:export-started', { totalFrames, frameRate, duration, strategy: 'webcodecs' });

    // Yield so the log above can flush to console
    await this._yieldToMain();

    // ── Step 2: Initialize muxer ──
    const isMP4 = codecConfig._container === 'mp4';
    const mimeType = isMP4 ? 'video/mp4' : 'video/webm';
    let output, videoSource;
    try {
      output = new Output({
        format: isMP4 ? new Mp4OutputFormat() : new WebMOutputFormat(),
        target: new BufferTarget(),
      });
      videoSource = new EncodedVideoPacketSource(codecConfig._muxCodec);
      output.addVideoTrack(videoSource, { frameRate });
      await output.start();
      console.warn(`🎬 [VideoExporter] STEP 2/4: Muxer ready (${isMP4 ? 'MP4' : 'WebM'})`);
    } catch (e) {
      console.error('❌ [VideoExporter] Muxer init failed:', e);
      throw e;
    }

    await this._yieldToMain();

    // ── Step 3: Initialize encoder ──
    let encoder, encoderError = null;
    let muxCount = 0;
    try {
      encoder = new VideoEncoder({
        output: async (chunk, meta) => {
          try {
            await videoSource.add(EncodedPacket.fromEncodedChunk(chunk), meta);
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

    for (let frame = 0; frame <= totalFrames; frame++) {
      if (this.abortController.signal.aborted) {
        encoder.close();
        throw new Error('Export cancelled');
      }

      // Check for async encoder/muxer errors
      if (encoderError) {
        encoder.close();
        throw new Error(`Encoder/muxer error during export: ${encoderError.message}`);
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
      }

      // Calculate animation progress (0 to 1)
      const progress = frame < startBufferFrames
        ? 0
        : Math.min(1, (frame - startBufferFrames) / animationFrames);

      // Render the frame
      const renderStart = performance.now();
      await renderFrame(progress);
      diag.totalRenderMs += performance.now() - renderStart;

      // Create VideoFrame with explicit timestamp (microseconds) and encode
      const encodeStart = performance.now();
      const timestampUs = frame * frameDurationUs;
      const videoFrame = new VideoFrame(this.canvas, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      });

      const keyFrame = frame === 0 || frame % VIDEO_EXPORT.KEYFRAME_INTERVAL === 0;
      encoder.encode(videoFrame, { keyFrame });
      videoFrame.close();
      diag.totalEncodeMs += performance.now() - encodeStart;

      // Progress update
      const percent = Math.round((frame / totalFrames) * 100);
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
        console.warn(`📊 [VideoExporter] Frame ${frame}/${totalFrames}: ` +
          `${fps.toFixed(1)}fps | queue=${encoder.encodeQueueSize} | mux=${muxCount}pkts`);
      }
    }

    // Flush encoder and finalize muxer
    console.warn('🎬 [VideoExporter] Flushing encoder...');
    const flushStart = performance.now();
    await encoder.flush();
    encoder.close();
    await output.finalize();
    const flushMs = performance.now() - flushStart;

    const blob = new Blob([output.target.buffer], { type: mimeType });
    const totalMs = performance.now() - diag.startTime;
    const n = totalFrames + 1;

    // ── Performance summary ──
    console.warn(`✅ [VideoExporter] Export complete: ${(blob.size / 1024 / 1024).toFixed(2)}MB (${mimeType})`);
    console.warn(`📊 Performance: ${(totalMs / 1000).toFixed(1)}s for ${n} frames (${(n / (totalMs / 1000)).toFixed(1)} fps)`);
    console.warn(`   Render: ${(diag.totalRenderMs / n).toFixed(1)}ms avg | Encode: ${(diag.totalEncodeMs / n).toFixed(1)}ms avg`);
    console.warn(`   Backpressure: ${diag.backpressureHits} waits (${(diag.totalBackpressureMs / 1000).toFixed(1)}s) | Flush: ${flushMs.toFixed(0)}ms`);

    this.eventBus?.emit('video:export-complete', { blob, size: blob.size, strategy: 'webcodecs' });

    onComplete(blob);
    return blob;
  }

  // ========== MEDIARECORDER FALLBACK ==========

  /**
   * Export using MediaRecorder with visibility-aware pause.
   * When the tab becomes hidden, the recorder and frame loop pause to
   * prevent setTimeout throttling from stretching the video duration.
   * Resumes automatically when the tab becomes visible again.
   * @private
   */
  async _exportMediaRecorder({ frameRate, duration, renderFrame, onProgress, onComplete, mimeType, videoBitrate, startBuffer }) {
    const startBufferFrames = Math.ceil((startBuffer / 1000) * frameRate);
    const animationFrames = Math.ceil((duration / 1000) * frameRate);
    const totalFrames = startBufferFrames + animationFrames;
    const frameInterval = 1000 / frameRate;

    console.log(`🎬 [VideoExporter] MediaRecorder: ${totalFrames} frames at ${frameRate}fps (${startBufferFrames} buffer + ${animationFrames} animation)`);
    this.eventBus?.emit('video:export-started', { totalFrames, frameRate, duration, strategy: 'mediarecorder' });

    // Create stream with manual frame control (0 = no automatic capture)
    const stream = this.canvas.captureStream(0);
    const videoTrack = stream.getVideoTracks()[0];

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: videoBitrate
    });
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunks.push(event.data);
    };

    recorder.start();

    // Render each frame with adaptive timing and visibility awareness
    for (let frame = 0; frame <= totalFrames; frame++) {
      const frameStartTime = performance.now();

      // Check for abort
      if (this.abortController.signal.aborted) {
        recorder.stop();
        throw new Error('Export cancelled');
      }

      // Pause if tab is hidden — prevents setTimeout throttling from
      // stretching MediaRecorder timestamps between requestFrame() calls
      await this._waitForVisibility(recorder);

      // Calculate animation progress (0 to 1)
      const progress = frame < startBufferFrames
        ? 0
        : Math.min(1, (frame - startBufferFrames) / animationFrames);

      // Render the frame
      await renderFrame(progress);

      // Capture this frame
      videoTrack.requestFrame();

      // Progress update
      const percent = Math.round((frame / totalFrames) * 100);
      onProgress(percent);
      this.eventBus?.emit('video:export-progress', { frame, totalFrames, percent });

      // Adaptive timing: wait for remainder of frame interval.
      // If rendering took longer than the interval, still wait a minimum
      // time to let the encoder process the frame.
      const elapsed = performance.now() - frameStartTime;
      const remainingTime = Math.max(10, frameInterval - elapsed);
      await this._delay(remainingTime);
    }

    // Stop recording and wait for final data
    const blob = await new Promise((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = (e) => reject(e.error || new Error('Recording failed'));
      recorder.stop();
    });

    console.log(`✅ [VideoExporter] MediaRecorder export complete: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
    this.eventBus?.emit('video:export-complete', { blob, size: blob.size, strategy: 'mediarecorder' });

    onComplete(blob);
    return blob;
  }

  // ========== VISIBILITY MANAGEMENT ==========

  /**
   * Block the frame loop while the tab is hidden, pausing the
   * MediaRecorder to prevent dead time from being encoded into
   * the output video. Returns immediately if the tab is visible.
   * 
   * @param {MediaRecorder} recorder - Active recorder to pause/resume
   * @returns {Promise<void>}
   * @private
   */
  async _waitForVisibility(recorder) {
    if (document.visibilityState === 'visible') return;

    // Tab is hidden — pause recording to prevent timestamp stretching
    if (recorder.state === 'recording') {
      recorder.pause();
    }
    this.eventBus?.emit('video:export-paused', { reason: 'tab-hidden' });
    console.log('⏸️ [VideoExporter] Export paused (tab hidden)');

    return new Promise(resolve => {
      const handler = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', handler);
          if (recorder.state === 'paused') {
            recorder.resume();
          }
          this.eventBus?.emit('video:export-resumed');
          console.log('▶️ [VideoExporter] Export resumed (tab visible)');
          resolve();
        }
      };
      document.addEventListener('visibilitychange', handler);
    });
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
