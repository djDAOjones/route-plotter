import { describe, expect, test } from 'vitest';
import { BACKGROUND_VISIBILITY } from '../src/config/constants.js';
import { contextFor } from './setup.js';
import { bootApp } from './helpers/bootApp.js';

/**
 * DEF-01 — no background mode may draw developer output on the canvas.
 *
 * "Angle of View Reveal" painted a black panel and four lines of debug text
 * over the picture, every frame, in preview, video exports and the standalone
 * player — live on the public site.
 *
 * The fixture is deliberately bare: three plain waypoints, no labels, no tint.
 * Such a frame draws no text and fills no rectangle on the main canvas at all,
 * so the assertions below reject *any* text or panel rather than the wording
 * and size this overlay happened to use. A renamed or resized overlay is
 * caught just as well.
 */
const MODES = Object.values(BACKGROUND_VISIBILITY);

async function bootPlainRoute() {
  const app = await bootApp();
  app.eventBus.emit('waypoint:add', { imgX: 0.2, imgY: 0.4, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.5, imgY: 0.6, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.8, imgY: 0.35, isMajor: true });
  return app;
}

function drawn(ctx, name) {
  return ctx.calls.filter(([call]) => call === name);
}

describe('background modes draw no developer output (DEF-01)', () => {
  test.each(MODES)('%s draws neither text nor a panel', async (mode) => {
    const app = await bootPlainRoute();
    app.eventBus.emit('motion:background-visibility-change', mode);
    app.animationEngine.seekToProgress(0.5);

    const ctx = contextFor(app.canvas);
    ctx.takeCalls();
    app.render();

    // The frame must be the one this test means: previewing a real path.
    expect(app.previewMode).toBe(true);
    expect(app.motionSettings.backgroundVisibility).toBe(mode);
    expect(app.pathPoints.length).toBeGreaterThan(0);
    expect(drawn(ctx, 'drawImage').length).toBeGreaterThan(0);

    expect(drawn(ctx, 'fillText')).toEqual([]);
    expect(drawn(ctx, 'strokeText')).toEqual([]);
    expect(drawn(ctx, 'fillRect')).toEqual([]);
  });

  test('angle-of-view reveal builds its mask and still draws nothing over the picture', async () => {
    const app = await bootPlainRoute();
    app.eventBus.emit('motion:background-visibility-change', BACKGROUND_VISIBILITY.ANGLE_OF_VIEW_REVEAL);
    app.animationEngine.seekToProgress(0.6);

    const ctx = contextFor(app.canvas);
    ctx.takeCalls();
    app.render();

    // Non-vacuity: the reveal path really ran for this frame.
    expect(app.motionVisibilityService.revealMaskCanvas).toBeTruthy();
    expect(drawn(ctx, 'fillText')).toEqual([]);
    expect(drawn(ctx, 'fillRect')).toEqual([]);
  });
});
