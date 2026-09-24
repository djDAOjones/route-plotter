/**
 * DEF-26 — a short hex glow colour froze playback.
 *
 * Load accepts every hex form `safeColor` does — `#rgb`, `#rgba`, `#rrggbb`
 * and `#rrggbbaa` — but the glow beacon read colours as three fixed pairs, so
 * `#f80` became `rgba(248, 0, NaN, …)`. A browser's `addColorStop` throws on
 * that, on every glow frame. The throw escaped the frame: playback stopped
 * because the engine booked its next frame only after the callback returned,
 * and the editor stopped redrawing because `queueRender` cleared its flag only
 * after `render` returned. Eight-digit colours did not throw; they silently
 * lost their alpha.
 *
 * jsdom's canvas does not validate colours, so the colour tests check what a
 * browser would accept rather than waiting for a throw.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BeaconRenderer, BEACON_TIMING } from '../src/services/BeaconRenderer.js';
import { AnimationEngine } from '../src/services/AnimationEngine.js';
import { bootApp } from './helpers/bootApp.js';

/** True for a colour a browser's canvas accepts, as the glow writes them. */
function isCanvasColour(value) {
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return true;
  const match = /^rgba\((\d+), (\d+), (\d+), (\S+)\)$/.exec(value);
  if (!match) return false;
  const alpha = Number(match[4]);
  return match.slice(1, 4).every(channel => Number(channel) <= 255) &&
    Number.isFinite(alpha) && alpha >= 0 && alpha <= 1;
}

/** Animation frames that run only when a test says so. */
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
    const [id, callback] = pending.entries().next().value;
    pending.delete(id);
    callback(timestamp);
  };
  return { pending, request, cancel, runNext };
}

/** Swap in manual frames for the length of `body`. */
async function withManualFrames(body) {
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const frames = createFrameHarness();
  globalThis.requestAnimationFrame = frames.request;
  globalThis.cancelAnimationFrame = frames.cancel;
  try {
    await body(frames);
  } finally {
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
}

describe('the glow draws every colour a project may hold (DEF-26)', () => {
  const glow = () => new BeaconRenderer().getBeacon({ id: 'marker', beaconStyle: 'glow' });

  test('each hex form load accepts becomes a colour stop, its own alpha kept', () => {
    const beacon = glow();

    // Was `rgba(248, 0, NaN, 0.5)` for `#f80`, and `#ff8800cc` lost its alpha.
    expect(beacon.hexToRgba('#f80', 0.5)).toBe('rgba(255, 136, 0, 0.5)');
    expect(beacon.hexToRgba('#f80c', 0.5)).toBe(`rgba(255, 136, 0, ${0.5 * (0xcc / 255)})`);
    expect(beacon.hexToRgba('#ff8800', 0.5)).toBe('rgba(255, 136, 0, 0.5)');
    expect(beacon.hexToRgba('#ff8800cc', 0.5)).toBe(`rgba(255, 136, 0, ${0.5 * (0xcc / 255)})`);
    expect(beacon.hexToRgba('#FF8800', 0)).toBe('rgba(255, 136, 0, 0)');
  });

  test('a glow drawn in any of those colours hands the canvas exactly those colours', () => {
    // Exact stops, not just valid ones: a call site that trimmed the colour
    // before converting it would pass a validity check and lose the alpha
    // (Codex, DEF-26 review).
    const cases = [
      ['#f80', 1], ['#f80c', 0xcc / 255], ['#ff8800', 1], ['#ff8800cc', 0xcc / 255],
      ['#ff880000', 0], ['#ff8800ff', 1],
    ];
    for (const [colour, own] of cases) {
      const ctx = document.createElement('canvas').getContext('2d');
      const beacon = glow();
      beacon.opacity = 1;
      beacon.radius = 0.5;
      const alpha = beacon.opacity * BEACON_TIMING.GLOW_PEAK_OPACITY;

      beacon.render(ctx, 50, 50, 8, colour, 1);

      const stops = ctx.calls.filter(call => /addColorStop$/.test(call[0])).map(call => call[2]);
      expect(stops, colour).toEqual([
        colour,
        `rgba(255, 136, 0, ${alpha * own})`,
        `rgba(255, 136, 0, ${alpha * 0.5 * own})`,
        `rgba(255, 136, 0, ${0 * own})`,
      ]);
      for (const stop of stops) expect(isCanvasColour(stop), `${colour} → ${stop}`).toBe(true);
    }
  });
});

describe('one bad frame cannot freeze playback or the editor (DEF-26)', () => {
  let frames;
  let originalRequest;
  let originalCancel;

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

  test('playback carries on past a frame whose callback throws', () => {
    const engine = new AnimationEngine();
    engine.state.duration = 1000;
    let updates = 0;
    engine.start(() => {
      updates += 1;
      if (updates === 2) throw new Error('bad frame');
      return false;
    });
    frames.runNext(20);
    engine.play();

    expect(() => frames.runNext(40)).toThrow('bad frame');
    // Was 0: the next frame was booked only after the callback returned.
    expect(frames.pending.size).toBe(1);
    const reached = engine.state.currentTime;
    frames.runNext(60);
    expect(updates).toBe(3);
    expect(engine.state.currentTime).toBeGreaterThan(reached);
  });

  test('a paused frame that throws does not keep an idle loop spinning', () => {
    // The camera keep-alive is renewed only by a callback that returns; a
    // frame that throws while paused must not queue another one to throw.
    const engine = new AnimationEngine();
    let updates = 0;
    engine.start(() => {
      updates += 1;
      if (updates === 2) throw new Error('bad frame');
      return true;
    });
    frames.runNext(20);
    expect(frames.pending.size).toBe(1);

    expect(() => frames.runNext(40)).toThrow('bad frame');
    expect(frames.pending.size).toBe(0);
  });
});

describe('a render that throws does not stop later edits redrawing (DEF-26)', () => {
  test('queueRender clears its flag even when the frame throws', async () => {
    // RoutePlotter is not exported, so its own method is borrowed from a
    // booted app and run on a stand-in that records what it was asked to do.
    const app = await bootApp();
    await app.ready;
    const queueRender = Object.getPrototypeOf(app).queueRender;

    await withManualFrames(async (frames) => {
      const host = {
        renderQueued: false,
        renders: 0,
        render() {
          this.renders += 1;
          if (this.renders === 1) throw new Error('bad frame');
        },
      };

      queueRender.call(host);
      expect(() => frames.runNext(20)).toThrow('bad frame');
      // Was true for good: every later queueRender returned early.
      expect(host.renderQueued).toBe(false);

      queueRender.call(host);
      expect(frames.pending.size).toBe(1);
      frames.runNext(40);
      expect(host.renders).toBe(2);
    });
  });
});
