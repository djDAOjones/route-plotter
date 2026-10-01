import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { CANDIDATE_KEYS } from './helpers/keyDomain.js';
import { keyListenersIn, lexedFiles } from './helpers/sourceScan.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const playerHarness = vi.hoisted(() => ({ latest: null }));

vi.mock('../src/player/PlayerApp.js', () => {
  class FakeEventBus {
    constructor() {
      this.listeners = new Map();
    }

    on(name, callback) {
      const listeners = this.listeners.get(name) || [];
      listeners.push(callback);
      this.listeners.set(name, listeners);
    }

    emit(name, value) {
      for (const callback of this.listeners.get(name) || []) callback(value);
    }
  }

  class FakePlayerApp {
    constructor() {
      const state = {
        currentTime: 0,
        duration: 65000,
        progress: 0,
        playbackSpeed: 1,
      };
      let activelyPlaying = false;

      this.eventBus = new FakeEventBus();
      const resetSpeed = () => {
        if (state.playbackSpeed === 1) return;
        state.playbackSpeed = 1;
        this.eventBus.emit('animation:playbackSpeedChange', 1);
      };
      this.animationEngine = {
        state,
        isPlaying: () => activelyPlaying,
        play: () => {
          activelyPlaying = true;
          this.eventBus.emit('animation:play');
        },
        pause: () => {
          activelyPlaying = false;
          resetSpeed();
          this.eventBus.emit('animation:pause');
        },
        togglePlayPause: () => {
          if (activelyPlaying) this.animationEngine.pause();
          else this.animationEngine.play();
        },
        seekToProgress: (progress) => {
          state.progress = Math.max(0, Math.min(1, Number(progress)));
          state.currentTime = state.progress * state.duration;
          this.eventBus.emit('animation:seek', state.currentTime);
        },
        seekToTime: (time) => {
          state.currentTime = Math.max(0, Math.min(state.duration, Number(time)));
          state.progress = state.currentTime / state.duration;
          this.eventBus.emit('animation:seek', state.currentTime);
        },
        setPlaybackSpeed: (speed) => {
          state.playbackSpeed = Number(speed);
          this.eventBus.emit('animation:playbackSpeedChange', state.playbackSpeed);
        },
      };

      this.queueRender = vi.fn();
      this.render = vi.fn();
      this.resize = vi.fn();
      playerHarness.latest = this;
    }

    async load() {
      this.waypoints = [
        {
          isMajor: true,
          name: 'Private authored name',
          label: '<script>window.leaked=true</script>',
          areaHighlight: { enabled: false, shape: 'none', points: [] },
          hasAreaHighlight: () => false,
        },
        {
          isMajor: false,
          areaHighlight: { enabled: false, shape: 'none', points: [] },
          hasAreaHighlight: () => false,
        },
      ];
      this.scene = { getFlowLayers: () => [] };
    }

    start(onFrame) {
      this.onFrame = onFrame;
    }

    resetPlayback() {
      this.animationEngine.state.currentTime = 0;
      this.animationEngine.state.progress = 0;
      // Model AnimationEngine.reset() ending active playback and resetting the
      // editor's temporary review speed.
      if (this.animationEngine.isPlaying()) this.animationEngine.pause();
      else this.animationEngine.setPlaybackSpeed(1);
    }

    updateTimeDisplay() {
      this.onTimeDisplay?.(
        this.animationEngine.state.currentTime,
        this.animationEngine.state.duration
      );
    }
  }

  return { PlayerApp: FakePlayerApp };
});

function installPlayerShell() {
  document.body.innerHTML = `
    <div class="canvas-wrapper">
      <canvas id="canvas" aria-describedby="scene-summary-content"></canvas>
    </div>
    <div id="player-error" hidden><span id="player-error-detail"></span></div>
    <section id="scene-summary"><p id="scene-summary-content">Loading scene summary.</p></section>
    <div class="controls">
      <button id="play-btn" type="button">Play</button>
      <button id="reset-btn" type="button">Reset</button>
      <label for="timeline">Timeline
        <input id="timeline" type="range" min="0" max="10000" value="0">
      </label>
      <span id="current-time">0:00</span>
      <span id="total-time">0:00</span>
      <select id="speed-select">
        <option value="1">1x</option>
        <option value="1.5">1.5x</option>
      </select>
    </div>
    <div id="player-announcer" role="status" aria-live="polite" aria-atomic="true"></div>
  `;
}

async function importAndBootPlayer() {
  await import('../src/player/playerEntry.js');
  // playerEntry waits for this event when jsdom still reports "loading".
  document.dispatchEvent(new Event('DOMContentLoaded'));
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  return playerHarness.latest;
}

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  delete window.__ROUTE_PLOTTER_PROJECT__;
  delete window.__ROUTE_PLOTTER_BG__;
  delete window.__routePlotterPlayer;
  document.body.innerHTML = '';
});

describe('standalone player accessibility wiring', () => {
  test('summarises once and announces discrete controls without frame, raw-seek, or pause-complete noise', async () => {
    vi.useFakeTimers();
    installPlayerShell();
    window.__ROUTE_PLOTTER_PROJECT__ = { coordVersion: 9 };
    window.__ROUTE_PLOTTER_BG__ = null;

    const app = await importAndBootPlayer();
    const announcer = document.getElementById('player-announcer');
    const timeline = document.getElementById('timeline');

    expect(app).not.toBeNull();
    expect(document.getElementById('scene-summary-content').textContent).toBe(
      'Timeline: 1:05. ' +
      'Route: 2 waypoints (1 major, 1 minor). ' +
      'Crowds: 0 layers, 0 emitters, 0 configured dots. ' +
      'Custom networks: 0 networks, 0 nodes, 0 edges. ' +
      'Highlights: 0 areas, 0 polygons, 0 polygon vertices.'
    );
    expect(document.getElementById('scene-summary-content').textContent)
      .not.toContain('Private authored name');
    expect(announcer.textContent).toBe(
      'Ready. 1:05 timeline, 1 major waypoint, 0 crowd layers.'
    );

    // Render/time synchronisation is deliberately silent.
    announcer.textContent = '';
    for (let frame = 0; frame < 500; frame += 1) {
      app.animationEngine.state.currentTime = frame * 10;
      app.animationEngine.state.progress = app.animationEngine.state.currentTime / 65000;
      app.onFrame(app.animationEngine.state);
    }
    expect(announcer.textContent).toBe('');

    // Raw scrub/input and raw engine seek events stay silent; change commits it.
    timeline.value = '5000';
    timeline.dispatchEvent(new Event('input', { bubbles: true }));
    app.eventBus.emit('animation:seek', app.animationEngine.state.currentTime);
    expect(announcer.textContent).toBe('');
    expect(timeline.getAttribute('aria-valuetext')).toBe('0:32 of 1:05');
    expect(document.getElementById('current-time').textContent).toBe('0:32');
    timeline.dispatchEvent(new Event('change', { bubbles: true }));
    expect(announcer.textContent).toBe('Moved to 0:32 of 1:05.');

    // A focused range gets useful five-second steps. Repeated key presses are
    // coalesced into one announcement, while its value text stays current.
    announcer.textContent = '';
    timeline.focus();
    timeline.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight', bubbles: true, cancelable: true,
    }));
    timeline.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight', bubbles: true, cancelable: true,
    }));
    expect(timeline.getAttribute('aria-valuetext')).toBe('0:42 of 1:05');
    vi.advanceTimersByTime(299);
    expect(announcer.textContent).toBe('');
    vi.advanceTimersByTime(1);
    expect(announcer.textContent).toBe('Moved to 0:42 of 1:05.');

    announcer.textContent = '';
    document.body.focus();
    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight', bubbles: true, cancelable: true,
    }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight', bubbles: true, cancelable: true,
    }));
    vi.advanceTimersByTime(299);
    expect(announcer.textContent).toBe('');
    vi.advanceTimersByTime(1);
    expect(announcer.textContent).toBe('Moved to 0:44 of 1:05.');

    document.getElementById('play-btn').click();
    expect(announcer.textContent).toBe('Playing from 0:44.');
    document.getElementById('play-btn').click();
    expect(announcer.textContent).toBe('Paused at 0:44.');
    document.getElementById('reset-btn').click();
    expect(announcer.textContent).toBe('Reset to start, 0:00.');

    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'End', bubbles: true, cancelable: true,
    }));
    expect(announcer.textContent).toBe('Moved to end, 1:05.');
    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Home', bubbles: true, cancelable: true,
    }));
    expect(announcer.textContent).toBe('Reset to start, 0:00.');

    const speed = document.getElementById('speed-select');
    speed.value = '1.5';
    speed.dispatchEvent(new Event('change', { bubbles: true }));
    expect(announcer.textContent).toBe('Playback speed set to 1.5 times normal.');
    expect(app.animationEngine.state.playbackSpeed).toBe(1.5);

    document.getElementById('play-btn').click();
    document.getElementById('play-btn').click();
    expect(app.animationEngine.state.playbackSpeed).toBe(1.5);
    expect(speed.value).toBe('1.5');
    document.getElementById('reset-btn').click();
    expect(app.animationEngine.state.playbackSpeed).toBe(1.5);
    expect(speed.value).toBe('1.5');

    document.getElementById('play-btn').click();
    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'End', bubbles: true, cancelable: true,
    }));
    expect(app.animationEngine.isPlaying()).toBe(false);
    expect(document.getElementById('play-btn').textContent).toBe('Play');
    expect(announcer.textContent).toBe('Moved to end, 1:05.');
    expect(app.animationEngine.state.playbackSpeed).toBe(1.5);

    // AnimationEngine emits pause immediately before complete. The player is
    // subscribed only to complete, so that autonomous transition is one message.
    announcer.textContent = '';
    app.animationEngine.pause();
    expect(announcer.textContent).toBe('');
    app.eventBus.emit('animation:complete');
    expect(announcer.textContent).toBe('Playback complete at 1:05.');
    expect(app.animationEngine.state.playbackSpeed).toBe(1.5);
    expect(speed.value).toBe('1.5');
  });

  test('freezes focused native range semantics during frames and cancels stale seek messages on scrub', async () => {
    vi.useFakeTimers();
    installPlayerShell();
    window.__ROUTE_PLOTTER_PROJECT__ = { coordVersion: 9 };
    window.__ROUTE_PLOTTER_BG__ = null;

    const app = await importAndBootPlayer();
    const timeline = document.getElementById('timeline');
    const announcer = document.getElementById('player-announcer');
    announcer.textContent = '';
    timeline.focus();

    timeline.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight', bubbles: true, cancelable: true,
    }));
    const focusedValue = timeline.value;
    expect(timeline.getAttribute('aria-valuetext')).toBe('0:05 of 1:05');

    app.animationEngine.state.currentTime = 30000;
    app.animationEngine.state.progress = 30000 / 65000;
    app.onFrame(app.animationEngine.state);
    expect(timeline.value).toBe(focusedValue);
    expect(timeline.getAttribute('aria-valuetext')).toBe('0:05 of 1:05');

    timeline.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(announcer.textContent).toBe('');

    timeline.blur();
    app.onFrame(app.animationEngine.state);
    expect(timeline.getAttribute('aria-valuetext')).toBe('0:30 of 1:05');
  });

  test("every key the player's two key listeners take, and what each does (TST-13)", async () => {
    // The key table (tests/keyTable.test.js) lists every key listener in
    // src/ and names this test for the player's: the page's transport keys,
    // which leave a focused control its own keys, and the timeline's steps.
    // It holds this test to what the key table holds its own rows to: each key
    // the handlers compare, read from their source, is pressed on its target,
    // and every other key of the domain is pressed there and does nothing.
    vi.useFakeTimers();
    installPlayerShell();
    window.__ROUTE_PLOTTER_PROJECT__ = { coordVersion: 9 };
    window.__ROUTE_PLOTTER_BG__ = null;

    const app = await importAndBootPlayer();
    const state = app.animationEngine.state;
    const timeline = document.getElementById('timeline');
    const playButton = document.getElementById('play-btn');
    const pressed = { page: new Set(), timeline: new Set() };
    const press = (key, target = document.body) => {
      pressed[target === timeline ? 'timeline' : 'page'].add(key);
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      const where = target === document.body ? 'the page' : `#${target.id}`;
      return `${key === ' ' ? 'Space' : key} on ${where}: ${event.defaultPrevented ? 'taken' : 'left'}; ` +
        `${app.animationEngine.isPlaying() ? 'playing' : 'paused'} at ${state.currentTime / 1000} s`;
    };

    expect([
      press('ArrowRight'), press('ArrowRight'), press('ArrowLeft'), press('End'), press('Home'),
      press(' '), press('k'), press('k'), press(' '), press('j'), press(' ', playButton),
      ...['ArrowRight', 'ArrowUp', 'PageUp', 'ArrowLeft', 'ArrowDown', 'PageDown', 'End', 'Home', 'k']
        .map(key => press(key, timeline))
    ]).toEqual([
      'ArrowRight on the page: taken; paused at 1 s',
      'ArrowRight on the page: taken; paused at 2 s',
      'ArrowLeft on the page: taken; paused at 1 s',
      'End on the page: taken; paused at 65 s',
      'Home on the page: taken; paused at 0 s',
      'Space on the page: taken; playing at 0 s',
      'k on the page: taken; paused at 0 s',
      'k on the page: taken; playing at 0 s',
      'Space on the page: taken; paused at 0 s',
      'j on the page: left; paused at 0 s',
      // A focused button keeps Space for itself.
      'Space on #play-btn: left; paused at 0 s',
      'ArrowRight on #timeline: taken; paused at 5 s',
      'ArrowUp on #timeline: taken; paused at 10 s',
      'PageUp on #timeline: taken; paused at 20 s',
      'ArrowLeft on #timeline: taken; paused at 15 s',
      'ArrowDown on #timeline: taken; paused at 10 s',
      'PageDown on #timeline: taken; paused at 0 s',
      'End on #timeline: taken; paused at 65 s',
      'Home on #timeline: taken; paused at 0 s',
      // The timeline keeps its own keys: K there neither plays nor is taken.
      'k on #timeline: left; paused at 0 s'
    ]);

    const { listeners } = keyListenersIn(lexedFiles(repoRoot, 'src/player'));
    const comparedBy = name => {
      const { reads } = listeners.find(listener => listener.name === `src/player/playerEntry.js: ${name} keydown`);
      expect(reads.unanalysed).toEqual([]);
      return [...reads.keys];
    };
    const compared = { page: comparedBy('document'), timeline: comparedBy('timeline') };
    for (const where of ['page', 'timeline']) {
      expect(compared[where].filter(key => !pressed[where].has(key)), `keys the ${where}'s handler compares, unpressed`)
        .toEqual([]);
      // Every other key: nothing taken, and the transport where it was.
      const target = where === 'timeline' ? timeline : document.body;
      const before = press('Home', target);
      expect(CANDIDATE_KEYS.filter(key => !compared[where].includes(key)).map(key => press(key, target))
        .filter(record => !record.endsWith(`left; ${before.split('; ')[1]}`)), `other keys on the ${where}`)
        .toEqual([]);
    }
  });

  test('a page without its project says why, in its own error panel (TST-13)', async () => {
    // The error detail is looked up by id: a lookup that named another id the
    // page has would pass the id checks and leave this panel empty.
    installPlayerShell();
    delete window.__ROUTE_PLOTTER_PROJECT__;
    await importAndBootPlayer();
    expect({
      panel: document.getElementById('player-error').hidden ? 'hidden' : 'shown',
      detail: document.getElementById('player-error-detail').textContent,
      controls: document.querySelector('.controls').hidden ? 'hidden' : 'shown',
      summary: document.getElementById('scene-summary-content').textContent,
      time: document.getElementById('current-time').textContent
    }).toEqual({
      panel: 'shown',
      detail: 'This export is missing its embedded project data. Re-export the file from Route Plotter.',
      controls: 'hidden',
      summary: 'Scene summary unavailable.',
      time: '0:00'
    });
  });
});
