import { describe, expect, test, vi } from 'vitest';
import { contextFor } from './setup.js';
import { bootApp, retireApp, tipSeen } from './helpers/bootApp.js';
import { ANNOUNCEMENTS } from '../src/config/constants.js';

/**
 * The first tests to run the real application (TST-01). They pin what the
 * harness itself provides, so every later characterisation test can rely on
 * booting the app rather than assembling a partial one.
 */
describe('the whole app boots (TST-01)', () => {
  test('the shipped shell boots into a sized canvas and a live orchestrator', async () => {
    const app = await bootApp();

    expect(app.constructor.name).toBe('RoutePlotter');
    expect(app.waypoints).toEqual([]);
    expect(app.canvas.width).toBeGreaterThan(0);
    expect(app.canvas.height).toBeGreaterThan(0);
    expect(document.getElementById('canvas')).toBe(app.canvas);
  });

  test('the canvas contain-fits the viewport the harness sets', async () => {
    // 800 x (600 - 60 playbar) is flatter than 16:9, so width is the constraint.
    const app = await bootApp({ viewport: { width: 800, height: 600 } });

    expect([app.canvas.width, app.canvas.height]).toEqual([800, 450]);
  });

  test('the bundled example background loads through the served repository', async () => {
    const app = await bootApp();
    await vi.waitFor(() => expect(app.background.image).toBeTruthy());
  });

  test('a cold start does not announce a pause, but a pause the author makes does (DEF-33)', async () => {
    // Startup pauses the animation itself. It did so after the pause listener
    // was registered, so every load told a screen reader "Animation paused".
    const app = await bootApp();
    await app.ready;
    const announcer = document.getElementById('announcer');
    expect(announcer.textContent).toBe('');
    expect(app.elements.playBtn.style.display).not.toBe('none');
    expect(app.elements.pauseBtn.style.display).toBe('none');

    app.animationEngine.play();
    expect(announcer.textContent).toBe('Playing animation');
    app.animationEngine.pause();
    // Read in its turn, once "Playing animation" has had its time (DEF-45).
    await vi.waitFor(() => expect(announcer.textContent).toBe('Animation paused'),
      { timeout: 3 * ANNOUNCEMENTS.HOLD_MS });
    expect(app.elements.playBtn.style.display).not.toBe('none');
    expect(app.elements.pauseBtn.style.display).toBe('none');
  });

  test('a restored session keeps its announcement (DEF-33)', async () => {
    // The startup pause replaced "Previous session restored" a few
    // milliseconds after it was announced. Announcements are recorded, not
    // read back, because the live region clears itself after two seconds.
    // The start's tip seen: its timer runs on the real clock and would land mid-test on a slow runner.
    localStorage.getItem.mockImplementation(tipSeen());
    const first = await bootApp();
    await first.ready;
    first.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
    first.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });
    first.storageService.flushAutoSave();
    const saved = localStorage.setItem.mock.calls.findLast(([key]) => key === 'routePlotter_autosave')?.[1];
    expect(saved).toEqual(expect.any(String));

    const announce = vi.spyOn(Object.getPrototypeOf(first), 'announce');
    localStorage.getItem.mockImplementation(key => (key === 'routePlotter_autosave' ? saved : null));
    try {
      const app = await bootApp();
      await app.ready;
      expect(app.waypoints).toHaveLength(2);
      expect(announce.mock.calls.map(([message]) => message)).toEqual(['Previous session restored']);
    } finally {
      localStorage.getItem.mockImplementation(() => null);
      announce.mockRestore();
    }
  });

  test('a listener that throws fails the test instead of being swallowed', async () => {
    const app = await bootApp();
    app.eventBus.on('ui:toast', () => { throw new Error('handler is broken'); });

    // In the app this would only reach the console (ISO-02); here it is loud.
    expect(() => app.eventBus.emit('ui:toast', 'hello')).toThrow(/handler is broken/);
  });

  test('an authoring intent on the bus reaches the model and the canvas', async () => {
    const app = await bootApp();
    const ctx = contextFor(app.canvas);
    ctx.calls.length = 0;

    app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.5, isMajor: true });

    expect(app.waypoints).toHaveLength(2);
    expect(app.waypoints[0].imgX).toBeCloseTo(0.25);
    await vi.waitFor(() => expect(ctx.calls.length).toBeGreaterThan(0));
  });
});

/**
 * UI-06 — the harness lets a stopped app go, and nothing else. Vitest keeps
 * every mock it makes, and the canvas recorder's methods are mocks whose
 * closures reach the canvas, so every app ever booted in a worker stayed
 * alive, with its page, until the largest files ran out of heap. The
 * recorder now lets an app's contexts go when `bootApp` stops the app: the
 * contexts of the canvases its boot made, after the test's assertions, never
 * one a test holds of its own.
 */
describe('the harness lets a stopped app go, and only that (UI-06)', () => {
  test('an offscreen context held across a second boot keeps its canvas and transcript', async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillRect(1, 2, 3, 4);

    const first = await bootApp();
    await first.ready;
    retireApp(first);
    const second = await bootApp();
    await second.ready;

    expect(ctx.canvas).toBe(canvas);
    expect(ctx.calls).toEqual([['fillRect', 1, 2, 3, 4]]);
    ctx.fillRect(5, 6, 7, 8);
    expect(ctx.calls).toHaveLength(2);
    expect(second.canvas).not.toBe(first.canvas);
  });

  test('a canvas the test makes while a boot is still pending is the test’s: retiring the app leaves it', async () => {
    // Ownership is not a matter of timing: a context belongs to a boot only
    // because its canvas is the app's own (its page canvas, its layers') or
    // stands inside the shell that boot parsed. A canvas a test makes while
    // the boot's start-up is in flight is neither, wherever it is put.
    const pending = bootApp();
    const detached = document.createElement('canvas');
    const beside = document.body.appendChild(document.createElement('canvas'));
    const mine = [detached, beside].map(canvas => canvas.getContext('2d'));
    mine.forEach((ctx, index) => ctx.fillRect(index, 0, 1, 1));
    const app = await pending;
    await app.ready;
    retireApp(app);

    expect(mine[0].canvas).toBe(detached);
    expect(mine[1].canvas).toBe(beside);
    expect(mine.map(ctx => ctx.calls)).toEqual([[['fillRect', 0, 0, 1, 1]], [['fillRect', 1, 0, 1, 1]]]);
    mine.forEach(ctx => ctx.fillRect(2, 2, 2, 2));
    expect(mine.every(ctx => ctx.calls.length === 2)).toBe(true);
    // While the app's own canvases went with it.
    expect(() => contextFor(app.canvas).calls).toThrow(/released/);
    expect(() => contextFor(app.renderingService.vectorCanvas).calls).toThrow(/released/);
    beside.remove();
  });

  test('a context made while an app is live, after its boot, is the test’s: retiring the app leaves it', async () => {
    const app = await bootApp();
    await app.ready;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillRect(1, 1, 1, 1);
    retireApp(app);

    expect(ctx.canvas).toBe(canvas);
    expect(ctx.calls).toEqual([['fillRect', 1, 1, 1, 1]]);
  });

  test('the hint module’s document listeners, declared the document’s, outlive a stopped app', async () => {
    // ParamTooltip binds its delegated listeners once per document, in the
    // first boot; every later app relies on them. The listeners a stopped
    // app leaves on the document are removed, but not these: they say they
    // are the document's (`DOCUMENT_LIFETIME`), not an app's.
    const first = await bootApp();
    await first.ready;
    document.getElementById('splash-close').click();
    retireApp(first);
    const second = await bootApp();
    await second.ready;
    document.getElementById('splash-close').click();
    // The splash's focus trap lets go a tick after it closes; its own Escape
    // would otherwise take the key.
    await new Promise(resolve => setTimeout(resolve, 0));

    // A keyboard arrival on a hinted control opens its hint through the
    // document's focusin listener; Escape, through its keydown listener.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    document.getElementById('animation-speed-right').focus();
    const tooltip = document.getElementById('param-tooltip');
    expect(tooltip?.style.display).toBe('block');
    expect(tooltip.textContent).toMatch(/^Total animation playback time/);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tooltip.style.display).toBe('none');
  });

  test('a second boot in one test leaves no live trap from the first: its splash cannot take the next Escape (UI-06, Codex r1)', async () => {
    // Each boot replaces the shell. An app booted before it, its splash
    // still open, kept its trap's listeners on the window and the document,
    // detached from any dialog the author can see, and took the Escape meant
    // for the dialog in front of them.
    const first = await bootApp();
    await first.ready;
    await vi.waitFor(() => expect(first._splashFocusTrap.isActive).toBe(true));
    const second = await bootApp();
    await second.ready;
    await vi.waitFor(() => expect(second._splashFocusTrap.isActive).toBe(true));

    expect(first._splashFocusTrap.isActive).toBe(false);
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.getElementById('splash').style.display).toBe('none');
    expect(second._splashFocusTrap.isActive).toBe(false);
  });

  test('a stopped app’s own context is released: read, drawn on or restyled, it says so', async () => {
    const app = await bootApp();
    await app.ready;
    const ctx = contextFor(app.canvas);
    expect(ctx.calls.length).toBeGreaterThan(0);
    retireApp(app);

    // Nothing a released context is asked passes quietly: a transcript or
    // canvas read too late, a draw, a malformed draw, a style, all fail where
    // they happen. The app's own late frames are cancelled when it is
    // stopped, so none is left to fire.
    expect(() => ctx.calls).toThrow(/released/);
    expect(() => ctx.takeCalls()).toThrow(/released/);
    expect(() => ctx.canvas).toThrow(/released/);
    expect(() => ctx.fillRect(0, 0, 1, 1)).toThrow(/released/);
    expect(() => ctx.translate(1)).toThrow(/released/);
    expect(() => { ctx.fillStyle = '#000'; }).toThrow(/released/);
    expect(() => ctx.globalAlpha).toThrow(/released/);
    expect(() => ctx.createLinearGradient(0, 0, 1, 1)).toThrow(/released/);
  });
});
