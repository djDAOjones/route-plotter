// CORE-05, stage 5: what the timeline draws (react-dom/server, no page), on a real store and the session's pieces with
// a frame source of the test's own: the label "Timeline", the range 0 to 1000, the value and its words for a position
// and a length, and the two times by it, the time now before the slider and the whole time after (v3's row). A real
// drag, a key, Escape and the echo on Carbon's slider are the page's, owed to the chat that mounts it.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { newScene, type IdSource } from '../../core/model/scene';
import { createTransport, type FrameSource } from '../../player/transport/transport';
import { setSceneSetting } from '../store/command';
import { createStore } from '../store/store';
import { createEditorTransport } from '../transport/transport';
import { createLengthReader, createTimeline } from './timelineLogic';
import { Timeline, TIMELINE_ID } from './Timeline';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

const noFrames: FrameSource<number> = { request: () => 0, cancel: () => undefined };

/** The timeline on an empty scene (2,000 ms long, Hold at end's), or with both holds `holdMs` long, scrubbed to `atMs`. */
function drawn(atMs: number, holdMs?: number) {
  const store = createStore({ project: { scene: newScene(counter('empty')), images: [] }, nextId: counter('new') });
  if (holdMs !== undefined) {
    for (const key of ['holdAtStartMs', 'holdAtEndMs'] as const) expect(store.dispatch(setSceneSetting('clock', key, holdMs)).ok).toBe(true);
  }
  const player = createTransport({
    frames: noFrames,
    holder: store,
    inputs: () => ({ scene: store.getState().project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
    report: (error) => {
      throw error;
    },
  });
  const editor = createEditorTransport({ transport: player, playback: () => store.playback(), announce: () => undefined, canPlay: () => false });
  const length = createLengthReader({ store, length: () => player.length(), frames: noFrames });
  const timeline = createTimeline({ store, transport: editor, length });
  editor.scrub(atMs);
  return renderToStaticMarkup(createElement(Timeline, { timeline }));
}

const sliderTag = (html: string) => /<[a-z]+\s[^>]*\brole="slider"[^>]*>/.exec(html)?.[0] ?? '';
const attribute = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
/** The texts of Carbon's labels at the range's ends, in order. */
const ends = (html: string) => [...html.matchAll(/class="[^"]*slider__range-label[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1]);

describe('the timeline, as it draws', () => {
  it('is a slider labelled “Timeline”, id timeline, 0 to 1000 step 1, never disabled', () => {
    const html = drawn(0);
    const tag = sliderTag(html);
    expect(attribute(tag, 'id')).toBe(TIMELINE_ID);
    expect(attribute(tag, 'aria-valuemin')).toBe('0');
    expect(attribute(tag, 'aria-valuemax')).toBe('1000');
    expect(attribute(tag, 'tabindex')).toBe('0');
    expect(html).toMatch(new RegExp(`<label[^>]*for="${TIMELINE_ID}"[^>]*>Timeline</label>`));
    expect(html).not.toMatch(/disabled|aria-disabled/);
  });

  it('holds the position as thousandths of the length and reads out v3’s words: “0:01 of 0:02” at 1.5 s', () => {
    const tag = sliderTag(drawn(1500));
    expect(attribute(tag, 'aria-valuenow')).toBe('750');
    expect(attribute(tag, 'aria-valuetext')).toBe('0:01 of 0:02');
    const start = sliderTag(drawn(0));
    expect(attribute(start, 'aria-valuenow')).toBe('0');
    expect(attribute(start, 'aria-valuetext')).toBe('0:00 of 0:02');
  });

  it('shows the time now before the slider and the whole time after it, as visible text', () => {
    expect(ends(drawn(1500))).toEqual(['0:01', '0:02']);
    const html = drawn(15_432, 10_000);
    expect(ends(html)).toEqual(['0:15', '0:20']);
    expect(html.indexOf('0:15<')).toBeLessThan(html.indexOf('role="slider"'));
    expect(html.lastIndexOf('0:20<')).toBeGreaterThan(html.indexOf('role="slider"'));
    expect(attribute(sliderTag(html), 'aria-valuetext')).toBe('0:15 of 0:20');
    expect(attribute(sliderTag(html), 'aria-valuenow')).toBe('772');
  });
});
