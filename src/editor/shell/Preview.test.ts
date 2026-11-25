// CORE-05, stage 6 (brief 84): what the preview draws (react-dom/server, no page): one canvas, in a box named "Route
// animation preview", its shape the video's (D202), with a picture or none. CORE-06 (brief 109): the box is a
// toolbar with one tab stop, and takes the room its column leaves (D209). The drawing, the size and the picture
// are the page's (tests/a11y/project.mjs, the-preview-draws and after).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { newScene } from '../../core/model/scene';
import { Preview, PREVIEW_LEAST_VH, PREVIEW_NAME, previewRoom } from './Preview';
import { SEED, START_SIZE } from './previewLogic';

const scene = newScene(() => 'id');
const drawn = (image: { width: number; height: number } | null, video = scene.settings.export) =>
  renderToStaticMarkup(
    createElement(Preview, {
      drawer: { attach: () => undefined, detach: () => undefined },
      inputs: {
        inputs: () => ({ scene: { ...scene, settings: { ...scene.settings, export: video } }, seed: SEED, size: START_SIZE, image }),
        resize: () => undefined,
      },
      subscribe: () => () => undefined,
    }),
  );

describe('the preview', () => {
  it('is one canvas in a box that is a toolbar named "Route animation preview", with one tab stop, on the box', () => {
    const html = drawn(null);
    expect(PREVIEW_NAME).toBe('Route animation preview');
    expect(html.match(/<canvas/g)).toHaveLength(1);
    expect(html).toMatch(/^<div class="preview" role="toolbar" aria-label="Route animation preview" tabindex="0"/);
    expect(html.match(/tabindex/g)).toHaveLength(1);
    expect(html.match(/role=/g)).toHaveLength(1);
    expect(html).not.toMatch(/aria-live|aria-describedby|role="img"/);
  });

  it('takes the video\'s shape, 1920 / 1080 by default, with a picture or none; another export size, another shape; as tall as the room left, or 40vh if more', () => {
    const cap = `max(var(--preview-room, 0px), ${String(PREVIEW_LEAST_VH)}vh)`;
    const sixteenByNine = `aspect-ratio:1920 / 1080;width:min(100%, calc(${cap} * 1920 / 1080))`;
    expect(PREVIEW_LEAST_VH).toBe(40);
    expect(drawn(null)).toContain(sixteenByNine);
    expect(drawn({ width: 200, height: 100 })).toContain(sixteenByNine);
    expect(drawn({ width: 200, height: 100 })).not.toContain('200 / 100');
    const upright = { ...scene.settings.export, width: 1080, height: 1920 };
    expect(drawn({ width: 200, height: 100 }, upright)).toContain(`aspect-ratio:1080 / 1920;width:min(100%, calc(${cap} * 1080 / 1920))`);
    expect(drawn(null, upright)).toContain('aspect-ratio:1080 / 1920;');
  });

  it('measures the room as the window less the rest of its column, the same whatever the box\'s height, never below 0', () => {
    // 1280 by 720: the column ends at 719 with the box 345 high, so the rest takes 374 and the room is 346.
    expect(previewRoom(720, 719, 345)).toBe(346);
    expect(previewRoom(720, 719 - 345 + 200, 200)).toBe(346);
    expect(previewRoom(720, 719.6, 345)).toBe(345);
    expect(previewRoom(300, 719, 345)).toBe(0);
  });
});
