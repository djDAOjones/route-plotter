// CORE-05, stage 6 (brief 84): what the preview draws (react-dom/server, no page): one canvas, in a box that is an image
// named "Route animation preview", nothing in it to operate, its shape the video's (D202), with a picture or none. The
// drawing, the size and the picture are the page's (tests/a11y/project.mjs, the-preview-draws and after).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { newScene } from '../../core/model/scene';
import { Preview, PREVIEW_HEIGHT_VH, PREVIEW_NAME } from './Preview';
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
  it('is one canvas in a box that is an image named "Route animation preview", nothing in it to operate', () => {
    const html = drawn(null);
    expect(PREVIEW_NAME).toBe('Route animation preview');
    expect(html.match(/<canvas/g)).toHaveLength(1);
    expect(html).toMatch(/^<div class="preview" role="img" aria-label="Route animation preview"/);
    expect(html).not.toMatch(/tabindex|aria-live|role="(?!img)/);
  });

  it('takes the video\'s shape, 1920 / 1080 by default, with a picture or none; another export size, another shape; never taller than 40vh', () => {
    const cap = `${String(PREVIEW_HEIGHT_VH)}vh`;
    const sixteenByNine = `aspect-ratio:1920 / 1080;width:min(100%, calc(${cap} * 1920 / 1080))`;
    expect(PREVIEW_HEIGHT_VH).toBe(40);
    expect(drawn(null)).toContain(sixteenByNine);
    expect(drawn({ width: 200, height: 100 })).toContain(sixteenByNine);
    expect(drawn({ width: 200, height: 100 })).not.toContain('200 / 100');
    const upright = { ...scene.settings.export, width: 1080, height: 1920 };
    expect(drawn({ width: 200, height: 100 }, upright)).toContain(`aspect-ratio:1080 / 1920;width:min(100%, calc(${cap} * 1080 / 1920))`);
    expect(drawn(null, upright)).toContain('aspect-ratio:1080 / 1920;');
  });
});
