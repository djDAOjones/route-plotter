// CORE-05, stage 5: the timeline's logic (brief 65's rulings 1 to 4), on a real store, the player's transport and the
// editor's transport put together as the session puts them, with one frame source run by hand for both, as the page
// shares requestAnimationFrame. Nothing waits or reads a clock: the length reader is proved by counting its reads of
// the length and the player's builds of it (DEF-42.1's reader's half). A drag, Escape and a key are the kit's slider
// logic (controls.ts) over the timeline's `Setting`: the page's events on Carbon's slider are owed to the page.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import type { Opened } from '../../adapters/io/open';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { CATALOGUE, type Catalogue, type SceneFeature } from '../../features/catalogue';
import { createTransport, type FrameSource } from '../../player/transport/transport';
import { createSlider } from '../kit/controls';
import { setSceneSetting } from '../store/command';
import { createStore } from '../store/store';
import { createEditorTransport, hasSomethingToPlay } from '../transport/transport';
import { createOpener } from './openLogic';
import { createLengthReader, createTimeline, formatTime } from './timelineLogic';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

/** One route, two stops joined by a line, the lead starting at the first: a scene that plays. */
function twoStops(): Project {
  const nextId = counter('seed');
  const a = newPoint(nextId, { x: 0.2, y: 0.2, kind: 'stop' });
  const b = newPoint(nextId, { x: 0.8, y: 0.8, kind: 'stop' });
  const route = { ...newRoute(nextId), points: [a, b], lines: [newLine(nextId, a.id, b.id)], leadStart: a.id };
  return { scene: { ...newScene(nextId), routes: [route] }, images: [] };
}

/** An empty scene: nothing to play, and Hold at end's 2,000 ms long. */
function empty(): Project {
  return { scene: newScene(counter('empty')), images: [] };
}

/** A frame source a test runs by hand: `run` calls the frames booked now, at the time it is given. */
function handMade() {
  let next = 0;
  const booked = new Map<number, (timeMs: number) => void>();
  const source: FrameSource<number> = {
    request: (callback) => {
      next += 1;
      booked.set(next, callback);
      return next;
    },
    cancel: (handle) => {
      booked.delete(handle);
    },
  };
  return {
    source,
    booked: () => booked.size,
    run(timeMs: number) {
      const due = [...booked.values()];
      booked.clear();
      for (const callback of due) callback(timeMs);
    },
  };
}

/** The real catalogue and one scene module more that ends at 0 and counts each time it is asked: once a build. */
function counting() {
  const count = { builds: 0 };
  const feature: SceneFeature<Record<string, never>, unknown> = {
    id: 'count', title: 'count', description: 'count', group: 'core', settings: {}, select: () => ({}),
    evaluate: () => ({ ok: true, value: null }),
    end: () => {
      count.builds += 1;
      return { endsAtMs: 0 };
    },
    refersTo: () => [],
  };
  const catalogue: Catalogue = { route: CATALOGUE.route, scene: [...CATALOGUE.scene, feature] };
  return { count, catalogue };
}

/** The store, both transports, the length reader and the timeline, as the session makes them; reads counted. */
function timelineOf(project: Project = twoStops()) {
  const store = createStore({ project, nextId: counter('new') });
  const frames = handMade();
  const { count, catalogue } = counting();
  const player = createTransport({
    frames: frames.source,
    holder: store,
    inputs: () => ({ scene: store.getState().project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
    report: (error) => {
      throw error;
    },
    catalogue,
  });
  const editor = createEditorTransport({
    transport: player,
    playback: () => store.playback(),
    announce: () => undefined,
    canPlay: () => hasSomethingToPlay(store.getState().project.scene),
  });
  const reads = { length: 0 };
  const length = createLengthReader({
    store,
    length: () => {
      reads.length += 1;
      return player.length();
    },
    frames: frames.source,
  });
  // The opener as the session makes it, made before the timeline and handing it its count; io's Open stood in: each
  // open gives `next.opened` (brief 94, PRS2).
  const next: { opened: Opened } = { opened: { ok: true, project: twoStops() } };
  const opener = createOpener({
    store,
    announce: () => undefined,
    player,
    decode: () => Promise.reject(new Error('not reached')),
    openProject: () => Promise.resolve(next.opened),
  });
  const timeline = createTimeline({ store, transport: editor, length, opened: () => opener.opened() });
  return { store, frames, player, editor, length, timeline, reads, count, opener, next };
}

/** Bytes for the stand-in Open: never read. */
const ANY_BYTES = Uint8Array.of(1);

/** Hold at start set to `ms`: a change to the scene, one undo step, that lengthens it by that much. */
const holdAtStart = (ms: number) => setSceneSetting('clock', 'holdAtStartMs', ms);

describe('the length reader: the length read at most once a frame (DEF-42.1, the reader’s half)', () => {
  it('reads nothing until asked, then once; a still page books no frame', () => {
    const { length, frames, reads, count } = timelineOf();
    expect(reads.length).toBe(0);
    expect(count.builds).toBe(0);
    const whole = length.held();
    expect(whole).toBeGreaterThan(0);
    expect(length.held()).toBe(whole);
    expect(reads.length).toBe(1);
    expect(count.builds).toBe(1);
    expect(frames.booked()).toBe(0);
  });

  it('n changes to the scene before a frame book one frame, which reads the length once and builds it once', () => {
    const { store, length, frames, reads, count } = timelineOf();
    const before = length.held();
    for (const ms of [100, 200, 300, 400, 500]) expect(store.dispatch(holdAtStart(ms)).ok).toBe(true);
    expect(frames.booked()).toBe(1);
    expect(reads.length).toBe(1);
    expect(length.held()).toBe(before);
    frames.run(16);
    expect(reads.length).toBe(2);
    expect(count.builds).toBe(2);
    expect(length.held()).toBe(before + 500);
    expect(frames.booked()).toBe(0);
  });

  it('asked many times between frames, it reads nothing more', () => {
    const { store, length, frames, reads } = timelineOf();
    length.held();
    store.dispatch(holdAtStart(1000));
    for (let n = 0; n < 10; n += 1) length.held();
    frames.run(16);
    for (let n = 0; n < 10; n += 1) length.held();
    expect(reads.length).toBe(2);
  });

  it('a change of the playback alone books no frame and reads nothing, also while a playing runs', () => {
    const { store, editor, length, frames, reads, count } = timelineOf();
    length.held();
    editor.scrub(500);
    store.setPlayback({ playing: false, atMs: 700, speed: 1 });
    expect(frames.booked()).toBe(0);
    editor.playPause();
    for (const at of [1000, 1016, 1032, 1048]) frames.run(at);
    expect(store.playback().playing).toBe(true);
    expect(reads.length).toBe(1);
    expect(count.builds).toBe(1);
  });

  it('a change undone before its frame reads nothing at it; Undo and Redo after it read once a frame', () => {
    const { store, length, frames, reads } = timelineOf();
    const before = length.held();
    store.dispatch(holdAtStart(1000));
    store.undo();
    frames.run(16);
    expect(reads.length).toBe(1);
    store.redo();
    frames.run(32);
    expect(reads.length).toBe(2);
    expect(length.held()).toBe(before + 1000);
    store.undo();
    frames.run(48);
    expect(reads.length).toBe(3);
    expect(length.held()).toBe(before);
  });

  it('tells its listeners when the length it holds changes, at the frame, and not when it stays', () => {
    const { store, length, frames } = timelineOf();
    length.held();
    let told = 0;
    const stop = length.subscribe(() => (told += 1));
    store.dispatch(holdAtStart(1000));
    expect(told).toBe(0);
    frames.run(16);
    expect(told).toBe(1);
    store.dispatch(setSceneSetting('clock', 'holdAtEndMs', 1000));
    store.dispatch(holdAtStart(2000));
    frames.run(32);
    expect(told).toBe(1);
    stop();
    store.dispatch(holdAtStart(0));
    frames.run(48);
    expect(told).toBe(1);
  });
});

describe('the timeline’s Setting: v3’s thousandths of the length', () => {
  it('reads the position as thousandths of the length, rounded, from 0 to 1000; 0 while the length is 0', () => {
    const { timeline, editor, length } = timelineOf(empty());
    expect(length.held()).toBe(2000);
    expect(timeline.setting.read()).toBe(0);
    editor.scrub(1000);
    expect(timeline.setting.read()).toBe(500);
    editor.scrub(1);
    expect(timeline.setting.read()).toBe(1);
    editor.scrub(0.9);
    expect(timeline.setting.read()).toBe(0);
    editor.scrub(2000);
    expect(timeline.setting.read()).toBe(1000);
    const none = timelineOf(empty());
    none.store.dispatch(setSceneSetting('clock', 'holdAtEndMs', 0));
    expect(none.length.held()).toBe(0);
    expect(none.timeline.setting.read()).toBe(0);
  });

  it('an edit scrubs to p / 1000 of the length at each set, is never refused, and commits no undo step', () => {
    const { store, timeline } = timelineOf(empty());
    const begun = timeline.setting.begin();
    if (!begun.ok) throw new Error('refused');
    expect(begun.edit.set(250)).toEqual({ ok: true, changed: true });
    expect(store.playback().atMs).toBe(500);
    expect(begun.edit.set(750)).toEqual({ ok: true, changed: true });
    expect(store.playback().atMs).toBe(1500);
    expect(begun.edit.set(750)).toEqual({ ok: true, changed: false });
    expect(begun.edit.commit()).toEqual({ ok: true, changed: false });
    expect(store.playback().atMs).toBe(1500);
    expect(store.getState().undo).toBeNull();
    expect(store.getState().gesture).toBeNull();
    expect(begun.edit.set(100)).toEqual({ ok: true, changed: false });
    expect(store.playback().atMs).toBe(1500);
  });

  it('a cancel puts the position back where the edit began, in ms exactly, not at a rounded thousandth', () => {
    const { store, editor, timeline } = timelineOf(empty());
    editor.scrub(1234.5);
    const begun = timeline.setting.begin();
    if (!begun.ok) throw new Error('refused');
    begun.edit.set(100);
    expect(store.playback().atMs).toBe(200);
    expect(begun.edit.cancel()).toEqual({ ok: true, changed: true });
    expect(store.playback().atMs).toBe(1234.5);
    editor.scrub(10);
    expect(begun.edit.cancel()).toEqual({ ok: true, changed: false });
    expect(store.playback().atMs).toBe(10);
    expect(store.getState().undo).toBeNull();
  });

  it('is told of the store’s changes and of the length’s, and of neither once stopped', () => {
    const { store, editor, timeline, length, frames } = timelineOf();
    length.held();
    let told = 0;
    const stop = timeline.setting.subscribe(() => (told += 1));
    editor.scrub(100);
    expect(told).toBe(1);
    store.dispatch(holdAtStart(1000));
    expect(told).toBe(2);
    frames.run(16);
    expect(told).toBe(3);
    stop();
    editor.scrub(200);
    expect(told).toBe(3);
  });
});

describe('the timeline’s words: v3’s time now “of” the whole time', () => {
  it('writes whole seconds as m:ss, rounded down, as v3’s formatTime', () => {
    expect([0, 999, 1000, 59_999, 60_000, 61_500, 600_000, 3_599_999].map(formatTime)).toEqual([
      '0:00', '0:00', '0:01', '0:59', '1:00', '1:01', '10:00', '59:59',
    ]);
  });

  it('reads out “0:01 of 0:02” on an empty scene at 1.5 s; each end’s label the time now and the whole time', () => {
    const { editor, timeline } = timelineOf(empty());
    expect(timeline.words()).toBe('0:00 of 0:02');
    editor.scrub(1500);
    expect(timeline.setting.read()).toBe(750);
    expect(timeline.words()).toBe('0:01 of 0:02');
    expect(timeline.readout(750)).toBe('0:01 of 0:02');
    expect(timeline.readout(750, 'start')).toBe('0:01');
    expect(timeline.readout(750, 'end')).toBe('0:02');
  });

  it('a thumb away from the position held reads out the time it stands for; at the position held, the time exactly', () => {
    const { editor, timeline } = timelineOf(empty());
    editor.scrub(1999);
    expect(timeline.setting.read()).toBe(1000);
    expect(timeline.readout(1000)).toBe('0:01 of 0:02');
    expect(timeline.readout(500)).toBe('0:01 of 0:02');
    expect(timeline.readout(499)).toBe('0:00 of 0:02');
  });
});

describe('the timeline’s words on a twenty-minute scene, through the kit’s slider (brief 86)', () => {
  it('as the thousandth steps, the words asked for the widget’s old thumb are the time now, never a second back', () => {
    const { store, frames, editor, length, timeline } = timelineOf();
    expect(store.dispatch(setSceneSetting('clock', 'length', 'fixed')).ok).toBe(true);
    expect(store.dispatch(setSceneSetting('clock', 'fixedLengthMs', 1_200_000)).ok).toBe(true);
    frames.run(16);
    expect(length.held()).toBe(1_200_000);
    const slider = createSlider(timeline.setting);
    expect(timeline.setting.read()).toBe(0);
    slider.drawn(0);
    editor.playPause();
    const said: string[] = [];
    const draw = (at: number) => said.push(timeline.readout(slider.readout(at)));
    // The page's three frames (sub-chat 83's probe at 4,440, 4,640 and 4,657 ms), played by hand from 4.1 s, where the
    // thousandth is still 3 (1.2 s each) and the time now already says 0:04.
    editor.scrub(4100);
    frames.run(1000);
    expect([Math.floor(store.playback().atMs / 100), timeline.setting.read()]).toEqual([41, 3]);
    slider.handed(3); // as the page does: handed 3, which the widget follows and says back
    expect(slider.report(3)).toEqual({ ok: true, changed: false });
    draw(3);
    // 100 ms later the thousandth steps to 4; the widget draws its old thumb, 3, before it is handed 4, and after.
    frames.run(1100);
    expect([Math.floor(store.playback().atMs / 100), timeline.setting.read()]).toEqual([42, 4]);
    draw(3);
    slider.handed(4);
    draw(3);
    // A frame later the widget follows and says it back.
    frames.run(1117);
    expect(slider.report(4)).toEqual({ ok: true, changed: false });
    draw(4);
    expect(said).toEqual(['0:04 of 20:00', '0:04 of 20:00', '0:04 of 20:00', '0:04 of 20:00']);
  });
});

describe('the timeline as the kit’s slider: a drag, Escape and a key, also while a playing runs (ruling 4)', () => {
  it('a drag while playing scrubs at each move, the playing goes on from there, and the release keeps nothing as a step', () => {
    const { store, editor, timeline, frames } = timelineOf();
    const slider = createSlider(timeline.setting);
    editor.playPause();
    frames.run(1000);
    frames.run(1100);
    expect(slider.press()).toEqual({ ok: true, changed: false });
    slider.report(500);
    expect(timeline.setting.read()).toBe(500);
    expect(store.playback().playing).toBe(true);
    const at = store.playback().atMs;
    frames.run(1150);
    expect(store.playback().atMs).toBeCloseTo(at + 50, 6);
    expect(store.playback().playing).toBe(true);
    slider.report(100);
    expect(timeline.setting.read()).toBe(100);
    expect(slider.release()).toEqual({ ok: true, changed: false });
    expect(store.playback().playing).toBe(true);
    expect(store.getState().undo).toBeNull();
    expect(store.getState().gesture).toBeNull();
  });

  it('Escape mid-drag while playing puts the position back where the press found it; the playing goes on', () => {
    const { store, editor, timeline, frames } = timelineOf();
    const slider = createSlider(timeline.setting);
    editor.playPause();
    frames.run(1000);
    frames.run(1100);
    const found = store.playback().atMs;
    slider.press();
    slider.report(800);
    frames.run(1150);
    expect(store.playback().atMs).toBeGreaterThan(found + 50);
    expect(slider.giveUp()).toEqual({ ok: true, changed: true });
    expect(store.playback().atMs).toBe(found);
    expect(store.playback().playing).toBe(true);
    slider.report(900);
    expect(store.playback().atMs).toBe(found);
    slider.release();
    expect(store.getState().undo).toBeNull();
  });

  it('a key’s nudge with no press is a scrub and no step (its commit answers nothing changed, as ruled); the echo is nothing', () => {
    const { store, editor, timeline } = timelineOf(empty());
    const slider = createSlider(timeline.setting);
    editor.scrub(1000);
    expect(slider.report(500)).toEqual({ ok: true, changed: false });
    expect(store.playback().atMs).toBe(1000);
    expect(slider.report(501)).toEqual({ ok: true, changed: false });
    expect(store.playback().atMs).toBe(1002);
    expect(timeline.setting.read()).toBe(501);
    expect(store.getState().undo).toBeNull();
  });
});

describe('an edit of the timeline begun before an Open changes nothing after it (PRS2, brief 94)', () => {
  it('begin, move, open, cancel: the position is where the open put it (the opened scene’s end, D251), not where the edit began; nothing changed', async () => {
    const { store, player, editor, timeline, opener } = timelineOf(empty());
    editor.scrub(1234.5);
    const begun = timeline.setting.begin();
    if (!begun.ok) throw new Error('refused');
    begun.edit.set(250);
    expect(store.playback().atMs).toBe(500);
    expect(await opener.open(ANY_BYTES)).toEqual({ kind: 'opened' });
    const end = player.length();
    expect(end).toBeGreaterThan(0);
    expect(store.playback().atMs).toBe(end);
    expect(begun.edit.cancel()).toEqual({ ok: true, changed: false });
    expect(store.playback().atMs).toBe(end);
  });

  it('begin, open, set: nothing scrubbed, and its commit answers as before', async () => {
    const { store, player, editor, timeline, opener } = timelineOf(empty());
    editor.scrub(1000);
    const begun = timeline.setting.begin();
    if (!begun.ok) throw new Error('refused');
    await opener.open(ANY_BYTES);
    const end = player.length();
    expect(end).toBeGreaterThan(0);
    expect(store.playback().atMs).toBe(end);
    expect(begun.edit.set(500)).toEqual({ ok: true, changed: false });
    expect(store.playback().atMs).toBe(end);
    expect(begun.edit.commit()).toEqual({ ok: true, changed: false });
    expect(store.playback().atMs).toBe(end);
    expect(store.getState().undo).toBeNull();
  });

  it('a refused open kills nothing: the edit still sets, and its cancel puts the position back', async () => {
    const { store, editor, timeline, opener, next } = timelineOf(empty());
    editor.scrub(1234.5);
    const begun = timeline.setting.begin();
    if (!begun.ok) throw new Error('refused');
    begun.edit.set(250);
    next.opened = { ok: false, refusal: { reason: 'not-a-project', message: 'not one' } };
    expect((await opener.open(ANY_BYTES)).kind).toBe('refused');
    expect(begun.edit.set(750)).toEqual({ ok: true, changed: true });
    expect(store.playback().atMs).toBe(1500);
    expect(begun.edit.cancel()).toEqual({ ok: true, changed: true });
    expect(store.playback().atMs).toBe(1234.5);
  });

  it('an edit begun after the open sets and cancels as before', async () => {
    const { store, editor, timeline, opener, next } = timelineOf(twoStops());
    next.opened = { ok: true, project: empty() };
    await opener.open(ANY_BYTES);
    editor.scrub(1234.5);
    const begun = timeline.setting.begin();
    if (!begun.ok) throw new Error('refused');
    expect(begun.edit.set(250)).toEqual({ ok: true, changed: true });
    expect(store.playback().atMs).toBe(500);
    expect(begun.edit.cancel()).toEqual({ ok: true, changed: true });
    expect(store.playback().atMs).toBe(1234.5);
  });

  it('Undo in the middle of an edit does not close it: its cancel still puts the position back', () => {
    const { store, editor, timeline } = timelineOf(empty());
    store.dispatch(holdAtStart(500));
    editor.scrub(1234.5);
    const begun = timeline.setting.begin();
    if (!begun.ok) throw new Error('refused');
    begun.edit.set(100);
    expect(store.undo().ok).toBe(true);
    expect(store.getState().undo).toBeNull();
    expect(begun.edit.cancel()).toEqual({ ok: true, changed: true });
    expect(store.playback().atMs).toBe(1234.5);
  });

  it('through the kit’s slider: a press, a move, an open, Escape, a move, the release: the position stays at the open’s end (D251)', async () => {
    const { store, player, editor, timeline, opener } = timelineOf(empty());
    const slider = createSlider(timeline.setting);
    editor.scrub(1000);
    slider.press();
    slider.report(250);
    expect(store.playback().atMs).toBe(500);
    await opener.open(ANY_BYTES);
    const end = player.length();
    expect(end).toBeGreaterThan(0);
    expect(store.playback().atMs).toBe(end);
    expect(slider.giveUp()).toEqual({ ok: true, changed: false });
    expect(store.playback().atMs).toBe(end);
    slider.report(900);
    expect(store.playback().atMs).toBe(end);
    slider.release();
    expect(slider.pressed()).toBe(false);
    expect(store.playback().atMs).toBe(end);
    expect(store.getState().undo).toBeNull();
  });
});
