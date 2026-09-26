import { describe, expect, test, vi } from 'vitest';
import { contextFor } from './setup.js';
import { bootApp } from './helpers/bootApp.js';

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
    expect(announcer.textContent).not.toBe('Animation paused');
    expect(app.elements.playBtn.style.display).not.toBe('none');
    expect(app.elements.pauseBtn.style.display).toBe('none');

    app.animationEngine.play();
    expect(announcer.textContent).toBe('Playing animation');
    app.animationEngine.pause();
    expect(announcer.textContent).toBe('Animation paused');
    expect(app.elements.playBtn.style.display).not.toBe('none');
    expect(app.elements.pauseBtn.style.display).toBe('none');
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
