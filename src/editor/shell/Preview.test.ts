// CORE-05, stage 6 (brief 84): what the preview draws (react-dom/server, no page): one canvas, in a box named "Route
// animation preview", its shape the video's (D202), with a picture or none. CORE-06 (brief 109): the box is a
// toolbar with one tab stop, and takes the room its column leaves (D209). The drawing, the size and the picture
// are the page's (tests/a11y/project.mjs, the-preview-draws and after).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { newScene } from '../../core/model/scene';
import { createStore } from '../store/store';
import { Preview, PREVIEW_LEAST_VH, PREVIEW_NAME, previewRoom, watchRoom, type RoomElement } from './Preview';
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
      store: createStore({ project: { scene, images: [] }, nextId: () => 'id' }),
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

  it('takes the video\'s shape, 1920 / 1080 by default, with a picture or none; another export size, another shape; as tall as the room left, or 30vh if more', () => {
    const cap = `max(var(--preview-room, 0px), ${String(PREVIEW_LEAST_VH)}vh)`;
    const sixteenByNine = `aspect-ratio:1920 / 1080;width:min(100%, calc(${cap} * 1920 / 1080))`;
    expect(PREVIEW_LEAST_VH).toBe(30);
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

  // The page's layout stood in for (Codex's lines 13 and 14, brief 111): the frame (`main`, a grid) holds the notice's
  // row and the columns; the centre column holds the preview's region and the play bar. A fake ResizeObserver calls
  // back only for what it observes and only when that changes size, as the browser's does; tasks run when flushed.
  const page = (layout: { columnBottom: number; contentEnd: number; box: number }) => {
    const at = { ...layout };
    const observers: { callback: () => void; targets: RoomElement[] }[] = [];
    const tasks: (() => void)[] = [];
    const rect = (bottom: () => number, height = () => 0) => ({ getBoundingClientRect: () => ({ bottom: bottom(), height: height() }) });
    const style = new Map<string, string>();
    const box = { ...rect(() => at.contentEnd - 100, () => at.box), style: { getPropertyValue: (n: string) => style.get(n) ?? '', setProperty: (n: string, v: string) => void style.set(n, v) } };
    const frame = rect(() => Math.max(at.columnBottom, at.contentEnd));
    const column = { ...rect(() => at.columnBottom), children: [rect(() => at.contentEnd - 24), rect(() => at.contentEnd)], parentElement: frame };
    const win = {
      innerHeight: 720,
      scrollY: 0,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      setTimeout: (task: () => void) => tasks.push(task),
      clearTimeout: () => undefined,
      ResizeObserver: class {
        readonly targets: RoomElement[] = [];
        constructor(callback: () => void) {
          observers.push({ callback, targets: this.targets });
        }
        observe(target: RoomElement) {
          this.targets.push(target);
        }
        disconnect() {
          this.targets.length = 0;
        }
      },
    };
    const flush = () => {
      while (tasks.length) tasks.shift()?.();
    };
    /** These elements changed size: every observer of one of them calls back. */
    const resized = (...changed: RoomElement[]) => {
      for (const { callback, targets } of observers) if (changed.some((c) => targets.includes(c))) callback();
    };
    const stop = watchRoom(box, column, win);
    flush();
    return { at, frame, column, flush, resized, stop, room: () => style.get('--preview-room') };
  };

  it('measures the room again when the notice above the columns is shown and when it is dismissed, though the column only moves (Codex line 13)', () => {
    const p = page({ columnBottom: 719, contentEnd: 719, box: 345 });
    expect(p.room()).toBe('346px');
    // The notice shows, 80 high: the column moves down 80 and keeps its size; the frame grows.
    p.at.columnBottom += 80;
    p.at.contentEnd += 80;
    p.resized(p.frame);
    p.flush();
    expect(p.room()).toBe('266px');
    // Dismissed: the column moves back up, its size the same; the frame shrinks.
    p.at.columnBottom -= 80;
    p.at.contentEnd -= 80;
    p.resized(p.frame);
    p.flush();
    expect(p.room()).toBe('346px');
    p.stop();
  });

  it('measures the room from the centre column\'s own content, not from a bottom stretched to a taller side column (Codex line 14)', () => {
    // A side column ends at 900: a stretched centre column would end there too, though its content ends at 719.
    const p = page({ columnBottom: 900, contentEnd: 719, box: 345 });
    expect(p.room()).toBe('346px');
    // The box at another height: the content's end moves with it, the stretched bottom does not; the room is the same.
    p.at.contentEnd = 719 - 345 + 200;
    p.at.box = 200;
    p.resized(p.column);
    p.flush();
    expect(p.room()).toBe('346px');
    p.stop();
  });
});
