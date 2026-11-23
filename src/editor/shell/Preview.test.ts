// CORE-05, stage 6 (brief 84): what the preview draws (react-dom/server, no page): one canvas, in a box that is an image
// named "Route animation preview", nothing in it to operate, its shape the background's or 16 to 9 with none. The
// drawing, the size and the picture are the page's (tests/a11y/project.mjs, the-preview-draws and after).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { newScene } from '../../core/model/scene';
import { Preview, PREVIEW_HEIGHT_VH, PREVIEW_NAME } from './Preview';
import { SEED, START_SIZE } from './previewLogic';

const drawn = (image: { width: number; height: number } | null) =>
  renderToStaticMarkup(
    createElement(Preview, {
      drawer: { attach: () => undefined, detach: () => undefined },
      inputs: { inputs: () => ({ scene: newScene(() => 'id'), seed: SEED, size: START_SIZE, image }), resize: () => undefined },
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

  it('takes 16 to 9 with no picture, and the picture\'s shape with one, never taller than 40vh', () => {
    const cap = `${String(PREVIEW_HEIGHT_VH)}vh`;
    expect(PREVIEW_HEIGHT_VH).toBe(40);
    expect(drawn(null)).toContain(`aspect-ratio:1920 / 1080;width:min(100%, calc(${cap} * 1920 / 1080))`);
    expect(drawn({ width: 200, height: 100 })).toContain(`aspect-ratio:200 / 100;width:min(100%, calc(${cap} * 200 / 100))`);
  });
});
