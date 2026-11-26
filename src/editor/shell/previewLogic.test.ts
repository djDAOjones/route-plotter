// CORE-05, stage 6: the preview's rule (brief 82's rulings 1 to 7), on a real store, with one frame source run by hand
// and pictures a test makes. Nothing waits or reads a clock: a load is a promise the test settles, and a draw is
// counted, or recorded through the real composer into the recorder.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { Recorder } from '../../adapters/render/recorder';
import { playLength } from '../../core/clock/clock';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { compose, contentEnd, type FrameReport, type FrameRequest, type Surface } from '../../player/compose';
import { createTransport, type FrameSource } from '../../player/transport/transport';
import { setSceneSetting } from '../store/command';
import { createStore, type Store } from '../store/store';
import { bindCanvas, type PointerFields } from '../canvas/dom';
import { createHover } from '../canvas/hover';
import { OVERLAY_MAKERS } from '../../features/catalogue.editor';
import {
  backgroundOf, canvasSize, createDrawer, createFrameInputs, createPictures, frameShape, recordingPaint, SEED, START_SIZE,
  type LoadPicture, type Picture, type Target,
} from './previewLogic';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

/** A PNG's first 33 bytes: the signature, then the IHDR chunk declaring `width` by `height`; all `sizeOf` reads. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const data = new DataView(bytes.buffer);
  data.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  data.setUint32(16, width);
  data.setUint32(20, height);
  return bytes;
}

/**
 * One route up the middle of the picture, from y 0.1 to y 0.9, two stops with no pause, the lead at its default
 * 0.2 image widths a second. The line is 0.8 of the picture's height: 0.8 × aspect image widths, aspect = height /
 * width. So the lead takes 0.8 × aspect / 0.2 s: 4,000 ms on a square, 2,000 ms on a picture twice as wide as high.
 */
function upTheMiddle(images: Project['images'] = []): Project {
  const nextId = counter('up');
  const a = { ...newPoint(nextId, { x: 0.5, y: 0.9, kind: 'stop' }), pauseMs: 0 };
  const b = { ...newPoint(nextId, { x: 0.5, y: 0.1, kind: 'stop' }), pauseMs: 0 };
  const route = { ...newRoute(nextId), points: [a, b], lines: [newLine(nextId, a.id, b.id)], leadStart: a.id };
  return { scene: { ...newScene(nextId), routes: [route] }, images };
}

/**
 * `upTheMiddle` with a bend half-way: stop (0.5, 0.9), bend (0.5, 0.5), stop (0.5, 0.1), so the overlay draws a mark
 * for a point not selected (the bend's grey dot) as well as the selected point's rings.
 */
function withBend(images: Project['images'] = []): Project {
  const nextId = counter('bend');
  const a = { ...newPoint(nextId, { x: 0.5, y: 0.9, kind: 'stop' }), pauseMs: 0 };
  const m = newPoint(nextId, { x: 0.5, y: 0.5, kind: 'bend' });
  const b = { ...newPoint(nextId, { x: 0.5, y: 0.1, kind: 'stop' }), pauseMs: 0 };
  const lines = [newLine(nextId, a.id, m.id), newLine(nextId, m.id, b.id)];
  const route = { ...newRoute(nextId), points: [a, m, b], lines, leadStart: a.id };
  return { scene: { ...newScene(nextId), routes: [route] }, images };
}

const wide = { id: 'wide', type: 'image/png' as const, bytes: png(200, 100) };
const tall = { id: 'tall', type: 'image/png' as const, bytes: png(100, 300) };
const broken = { id: 'broken', type: 'image/png' as const, bytes: new Uint8Array(10) };

const storeOf = (project: Project = upTheMiddle()): Store => createStore({ project, nextId: counter('new') });

/** The store's images handed back to its Open: its own records, kept as they are (own.ts, point 3). */
const reopen = (store: Store, images: Project['images']) => {
  store.open({ scene: store.getState().project.scene, images });
};

/** A frame source a test runs by hand: `run` calls the frames booked now. */
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
    run(timeMs = 0) {
      const due = [...booked.values()];
      booked.clear();
      for (const callback of due) callback(timeMs);
    },
  };
}

describe('the background (ruling 1)', () => {
  it('is the project’s first image, or none', () => {
    expect(backgroundOf(upTheMiddle([wide, tall]))).toBe(wide);
    expect(backgroundOf(upTheMiddle([tall, wide]))).toBe(tall);
    expect(backgroundOf(upTheMiddle())).toBeNull();
  });
});

describe('the inputs: one source for a frame and the length (ruling 2)', () => {
  it('gives the store’s scene now, the seed, the size and the first image’s header size', () => {
    const store = storeOf(upTheMiddle([wide, tall]));
    const holder = createFrameInputs({ store });
    const now = holder.inputs();
    expect(now.scene).toBe(store.getState().project.scene);
    expect(now.seed).toBe(SEED);
    expect(SEED).toBe(1);
    expect(now.size).toEqual(START_SIZE);
    expect(START_SIZE).toEqual({ width: 1920, height: 1080 });
    expect(now.image).toEqual({ width: 200, height: 100 });
    reopen(store, []);
    expect(holder.inputs().image).toBeNull();
    expect(holder.inputs().scene).toBe(store.getState().project.scene);
  });

  it('reads a background’s header once for its record, again only for another record', () => {
    const store = storeOf(upTheMiddle([wide]));
    const holder = createFrameInputs({ store });
    const first = holder.inputs().image;
    expect(holder.inputs().image).toBe(first);
    store.open(upTheMiddle([tall]));
    expect(holder.inputs().image).toEqual({ width: 100, height: 300 });
    expect(holder.inputs().image).not.toBe(first);
  });

  it('reads a record that comes back as the background no more: the very object it gave first (Codex, 2)', () => {
    const store = storeOf(upTheMiddle([wide]));
    const holder = createFrameInputs({ store });
    const first = holder.inputs().image;
    const records = store.getState().project.images;
    store.open(upTheMiddle([tall]));
    expect(holder.inputs().image).toEqual({ width: 100, height: 300 });
    reopen(store, records);
    expect(store.getState().project.images[0]).toBe(records[0]);
    expect(holder.inputs().image).toBe(first);
  });

  it('gives no size for a header that cannot be read', () => {
    const holder = createFrameInputs({ store: storeOf(upTheMiddle([broken, wide])) });
    expect(holder.inputs().image).toBeNull();
  });

  it('takes a size of whole numbers of 1 or more, ignores anything else, and tells only a change', () => {
    const holder = createFrameInputs({ store: storeOf() });
    let told = 0;
    holder.subscribe(() => (told += 1));
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      holder.resize({ width: bad, height: 600 });
      holder.resize({ width: 800, height: bad });
    }
    expect(holder.inputs().size).toEqual(START_SIZE);
    expect(told).toBe(0);
    holder.resize({ width: 800, height: 600 });
    holder.resize({ width: 800, height: 600 });
    expect(holder.inputs().size).toEqual({ width: 800, height: 600 });
    expect(told).toBe(1);
    holder.resize({ width: 1, height: 1 });
    expect(holder.inputs().size).toEqual({ width: 1, height: 1 });
    expect(told).toBe(2);
  });

  it('B: an opened project is measured by its picture inside the open’s own telling, not as a square', () => {
    const store = storeOf(upTheMiddle());
    const holder = createFrameInputs({ store });
    const player = createTransport({
      frames: handMade().source, holder: store, inputs: holder.inputs, report: (error) => {
        throw error;
      },
    });
    const opened = upTheMiddle([wide]);
    const clock = opened.scene.settings.clock;
    const base = { scene: store.getState().project.scene, seed: SEED, size: START_SIZE };
    expect(player.length()).toBe(playLength(clock, contentEnd({ ...base, image: null })));
    const lengths: number[] = [];
    store.subscribe(() => lengths.push(player.length()));
    store.open(opened);
    const scene = store.getState().project.scene;
    const byPicture = playLength(clock, contentEnd({ scene, seed: SEED, size: START_SIZE, image: { width: 200, height: 100 } }));
    const asSquare = playLength(clock, contentEnd({ scene, seed: SEED, size: START_SIZE, image: null }));
    expect(contentEnd({ scene, seed: SEED, size: START_SIZE, image: { width: 200, height: 100 } })).toBeCloseTo(2000, 6);
    expect(contentEnd({ scene, seed: SEED, size: START_SIZE, image: null })).toBeCloseTo(4000, 6);
    expect(lengths).toEqual([byPicture]);
    expect(byPicture).not.toBe(asSquare);
  });
});

/** A drawable a test makes, a new object each time: an ImageBitmap by shape, as the composer's tests make one. */
const drawable = (): CanvasImageSource => ({ width: 1, height: 1, close: () => undefined });

/** A picture a test makes, counting its closes. */
function pictureOf() {
  const counts = { closed: 0 };
  const picture: Picture = { source: drawable(), close: () => (counts.closed += 1) };
  return { picture, counts };
}

/** A loader whose every load is a promise the test settles; each ask kept with its arguments. */
function loader() {
  const asks: { bytes: Uint8Array; settle: (picture: Picture | null) => void; refuse: (error: unknown) => void }[] = [];
  const load: LoadPicture = (bytes) =>
    new Promise((settle, refuse) => {
      asks.push({ bytes, settle, refuse });
    });
  return { load, asks };
}

/** Lets the promise jobs queued now run: microtasks only, no timer and no clock. */
async function settled(): Promise<void> {
  for (let n = 0; n < 3; n += 1) await Promise.resolve();
}

function picturesOf(project: Project, load: LoadPicture) {
  const store = storeOf(project);
  const reports: unknown[] = [];
  const pictures = createPictures({ store, load, report: (error) => reports.push(error) });
  let told = 0;
  pictures.subscribe(() => (told += 1));
  return { store, pictures, reports, told: () => told };
}

describe('the picture to draw (ruling 3)', () => {
  it('asks once for each background record, never with none, and holds what it gives', async () => {
    const { load, asks } = loader();
    const { store, pictures, told } = picturesOf(upTheMiddle(), load);
    expect(asks).toHaveLength(0);
    store.open(upTheMiddle([wide, tall]));
    expect(asks).toHaveLength(1);
    expect(asks[0]?.bytes).toEqual(wide.bytes);
    store.setPlayback({ playing: false, atMs: 10, speed: 1 });
    reopen(store, store.getState().project.images);
    expect(asks).toHaveLength(1);
    expect(pictures.held()).toBeNull();
    const a = pictureOf();
    asks[0]?.settle(a.picture);
    await settled();
    expect(pictures.held()).toBe(a.picture.source);
    expect(told()).toBe(1);
  });

  it('keeps the latest: a load that ends after the background changed is closed and never held', async () => {
    const { load, asks } = loader();
    const { store, pictures, told } = picturesOf(upTheMiddle([wide]), load);
    store.open(upTheMiddle([tall]));
    expect(asks).toHaveLength(2);
    const late = pictureOf();
    const latest = pictureOf();
    asks[1]?.settle(latest.picture);
    await settled();
    asks[0]?.settle(late.picture);
    await settled();
    expect(pictures.held()).toBe(latest.picture.source);
    expect(late.counts.closed).toBe(1);
    expect(latest.counts.closed).toBe(0);
    expect(told()).toBe(1);
  });

  it('closes the picture held once, when another replaces it, when the background goes, and on close', async () => {
    const { load, asks } = loader();
    const { store, pictures, told } = picturesOf(upTheMiddle([wide]), load);
    const a = pictureOf();
    asks[0]?.settle(a.picture);
    await settled();
    store.open(upTheMiddle([tall]));
    expect(a.counts.closed).toBe(1);
    expect(pictures.held()).toBeNull();
    const b = pictureOf();
    asks[1]?.settle(b.picture);
    await settled();
    reopen(store, []);
    expect(b.counts.closed).toBe(1);
    expect(asks).toHaveLength(2);
    expect(told()).toBe(4);
    store.open(upTheMiddle([wide]));
    const c = pictureOf();
    asks[2]?.settle(c.picture);
    await settled();
    pictures.close();
    pictures.close();
    store.open(upTheMiddle([tall]));
    expect([a.counts.closed, b.counts.closed, c.counts.closed]).toEqual([1, 1, 1]);
    expect(asks).toHaveLength(3);
    expect(pictures.held()).toBeNull();
  });

  it('closes a picture that arrives after close, and holds it not', async () => {
    const { load, asks } = loader();
    const { pictures } = picturesOf(upTheMiddle([wide]), load);
    pictures.close();
    const a = pictureOf();
    asks[0]?.settle(a.picture);
    await settled();
    expect(pictures.held()).toBeNull();
    expect(a.counts.closed).toBe(1);
  });

  it('a load that gives null, throws or rejects holds nothing, is reported once and is not asked again', async () => {
    const throwing: LoadPicture = () => {
      throw new Error('no decoder');
    };
    const cases: { name: string; load: () => { load: LoadPicture; asks: () => number; end: () => void } }[] = [
      { name: 'null', load: () => {
        const made = loader();
        return { load: made.load, asks: () => made.asks.length, end: () => made.asks[0]?.settle(null) };
      } },
      { name: 'rejects', load: () => {
        const made = loader();
        return { load: made.load, asks: () => made.asks.length, end: () => made.asks[0]?.refuse(new Error('bad')) };
      } },
      { name: 'throws', load: () => {
        let asked = 0;
        return { load: (...args) => ((asked += 1), throwing(...args)), asks: () => asked, end: () => undefined };
      } },
    ];
    for (const each of cases) {
      const made = each.load();
      const { store, pictures, reports, told } = picturesOf(upTheMiddle([wide]), made.load);
      const record = store.getState().project.images;
      made.end();
      await settled();
      expect(pictures.held(), each.name).toBeNull();
      expect(reports, each.name).toHaveLength(1);
      reopen(store, []);
      reopen(store, record);
      await settled();
      expect(made.asks(), each.name).toBe(1);
      expect(reports, each.name).toHaveLength(1);
      expect(told(), each.name).toBe(0);
    }
  });

  it('does not ask again for a record whose load is still pending', async () => {
    const { load, asks } = loader();
    const { store, pictures } = picturesOf(upTheMiddle([wide]), load);
    const record = store.getState().project.images;
    reopen(store, []);
    reopen(store, record);
    expect(asks).toHaveLength(1);
    const a = pictureOf();
    asks[0]?.settle(a.picture);
    await settled();
    expect(pictures.held()).toBe(a.picture.source);
  });
});

/** A surface for the composer's mask, in the recorder. */
const blank = (): Surface => {
  const recorder = new Recorder();
  return { context: recorder, image: drawable() };
};

/** The store, inputs, pictures held by hand, a drawer and frames run by hand; `paint` counts and keeps each request. */
function drawerOf(project: Project = upTheMiddle([wide]), paint?: (request: FrameRequest) => readonly FrameReport[]) {
  const store = storeOf(project);
  const inputs = createFrameInputs({ store });
  const frames = handMade();
  let held: CanvasImageSource | null = null;
  const pictureListeners = new Set<() => void>();
  const pictures = {
    held: () => held,
    subscribe: (listener: () => void) => {
      pictureListeners.add(listener);
      return () => pictureListeners.delete(listener);
    },
  };
  const hold = (source: CanvasImageSource | null) => {
    held = source;
    for (const listener of [...pictureListeners]) listener();
  };
  const requests: FrameRequest[] = [];
  const reports: unknown[] = [];
  const failures: (readonly FrameReport[])[] = [];
  const hover = createHover();
  const drawer = createDrawer({
    store, inputs, pictures, hover, frames: frames.source,
    report: (error) => reports.push(error),
    failed: (each) => failures.push(each),
  });
  const target: Target = {
    paint: (request) => {
      requests.push(request);
      return paint?.(request) ?? [];
    },
    surface: blank,
  };
  return { store, inputs, frames, drawer, target, requests, reports, failures, hold, pictureListeners, hover };
}

const at = (store: Store, atMs: number, speed = 1, playing = false) => store.setPlayback({ playing, atMs, speed });

describe('when a frame is drawn (ruling 4)', () => {
  it('(a, b) books at attach, draws once at that frame, and a still page then books nothing', () => {
    const { drawer, target, frames, requests } = drawerOf();
    expect(frames.booked()).toBe(0);
    drawer.attach(target);
    expect(frames.booked()).toBe(1);
    expect(requests).toHaveLength(0);
    frames.run();
    expect(requests).toHaveLength(1);
    for (let n = 0; n < 10; n += 1) frames.run();
    expect(frames.booked()).toBe(0);
    expect(requests).toHaveLength(1);
  });

  it('(b) books for each input a frame is made from, and not for the speed or `playing` alone', () => {
    const { store, inputs, drawer, target, frames, requests, hold } = drawerOf(upTheMiddle([wide]));
    drawer.attach(target);
    frames.run();
    const route = store.getState().project.scene.routes[0]?.id ?? null;
    const changes: [string, () => void][] = [
      ['position', () => at(store, 100)],
      ['scene', () => store.dispatch(setSceneSetting('clock', 'holdAtStartMs', 500))],
      ['selection', () => store.select({ route, points: [] })],
      ['picture', () => hold(drawable())],
      ['size', () => inputs.resize({ width: 800, height: 600 })],
      ['background size', () => reopen(store, [{ ...tall }])],
    ];
    for (const [name, change] of changes) {
      change();
      expect(frames.booked(), name).toBe(1);
      frames.run();
    }
    expect(requests).toHaveLength(1 + changes.length);
    at(store, store.playback().atMs, 4);
    at(store, store.playback().atMs, 4, true);
    hold(null);
    hold(null);
    expect(frames.booked()).toBe(1);
    frames.run();
    at(store, store.playback().atMs, 2, true);
    at(store, store.playback().atMs, 2, false);
    inputs.resize({ width: 800, height: 600 });
    expect(frames.booked()).toBe(0);
  });

  it('(b) books for the background’s size alone, with a stub store whose scene, position and selection stay (Codex, 4)', () => {
    // The real store's Open makes a new scene object and clears the selection, so a stub of its state is swapped here:
    // only the first image changes, the picture held stays none.
    let state = storeOf(upTheMiddle([wide])).getState();
    const listeners = new Set<() => void>();
    const store = {
      getState: () => state,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const swap = (images: Project['images']) => {
      state = { ...state, project: { ...state.project, images } };
      for (const listener of [...listeners]) listener();
    };
    const frames = handMade();
    const requests: FrameRequest[] = [];
    const drawer = createDrawer({
      store, inputs: createFrameInputs({ store }), pictures: { held: () => null, subscribe: () => () => undefined },
      frames: frames.source, report: () => undefined, failed: () => undefined,
    });
    drawer.attach({ paint: (request) => (requests.push(request), []), surface: blank });
    frames.run();
    swap([{ ...wide, id: 'same-size' }]);
    expect(frames.booked()).toBe(0);
    swap([tall]);
    expect(frames.booked()).toBe(1);
    frames.run();
    expect(requests.map((request) => request.image)).toEqual([{ width: 200, height: 100 }, { width: 100, height: 300 }]);
    expect(requests[1]?.scene).toBe(requests[0]?.scene);
  });

  it('(a) draws once a frame however many changes a frame, and nothing over a still run', () => {
    const { store, drawer, target, frames, requests } = drawerOf();
    drawer.attach(target);
    frames.run();
    for (let n = 1; n <= 30; n += 1) {
      for (let k = 1; k <= 5; k += 1) at(store, n * 100 + k);
      expect(frames.booked()).toBe(1);
      frames.run();
    }
    expect(requests).toHaveLength(31);
    for (let n = 0; n < 30; n += 1) frames.run();
    expect(requests).toHaveLength(31);
  });

  it('(c) makes the request when the frame runs, from what is held then', () => {
    const { store, inputs, drawer, target, frames, requests, hold } = drawerOf(upTheMiddle([wide]));
    drawer.attach(target);
    frames.run();
    const first = requests[0];
    expect(Object.keys(first ?? {}).sort()).toEqual(['image', 'sceneMs', 'scene', 'seed', 'size', 'surface'].sort());
    expect(first?.image).toEqual({ width: 200, height: 100 });
    expect(first?.surface).toBe(target.surface);
    at(store, 100);
    at(store, 250);
    const source = drawable();
    hold(source);
    inputs.resize({ width: 640, height: 360 });
    frames.run();
    const second = requests[1];
    expect(second?.sceneMs).toBe(250);
    expect(second?.scene).toBe(store.getState().project.scene);
    expect(second?.seed).toBe(SEED);
    expect(second?.size).toEqual({ width: 640, height: 360 });
    expect(second?.image).toEqual({ width: 200, height: 100, source });
    expect('viewing' in (second ?? {})).toBe(false);
    expect('images' in (second ?? {})).toBe(false);
  });

  it('(c) gives no image with no background, a picture held or not', () => {
    const { drawer, target, frames, requests, hold } = drawerOf(upTheMiddle());
    hold(drawable());
    drawer.attach(target);
    frames.run();
    expect(requests[0]?.image).toBeNull();
  });

  it('(d) passes no overlay with nothing selected; with a route, its selected points; through compose, only the overlay differs', () => {
    const recorder = new Recorder();
    const { store, drawer, target, frames, requests } = drawerOf(upTheMiddle([wide]), (request) => compose(recorder, request));
    drawer.attach(target);
    frames.run();
    const none = recorder.take();
    expect(requests[0]?.overlays).toBeUndefined();
    const route = store.getState().project.scene.routes[0];
    const pointId = route?.points[1]?.id ?? '';
    store.select({ route: route?.id ?? null, points: [pointId] });
    frames.run();
    const selected = recorder.take();
    expect(requests[1]?.overlays).toHaveLength(2); // the lines' (no hover: nothing for a line that shows), the points'
    expect(selected.length).toBeGreaterThan(none.length);
    expect(selected.slice(0, none.length)).toEqual(none);
    expect(selected.slice(none.length).some((line) => line.startsWith('arc') || line.startsWith('rect'))).toBe(true);
    store.select({ route: null, points: [] });
    frames.run();
    expect(recorder.take()).toEqual(none);
  });

  it('(b) a hover change books a frame; the same hover, as another object, books none; the drawer gives back the holder it reads', () => {
    const { store, drawer, target, frames, requests, hover } = drawerOf();
    expect(drawer.hover).toBe(hover);
    drawer.attach(target);
    frames.run();
    const route = store.getState().project.scene.routes[0];
    const lineId = route?.lines[0]?.id ?? '';
    hover.set({ routeId: route?.id ?? '', lineId });
    expect(frames.booked()).toBe(1);
    frames.run();
    hover.set({ routeId: route?.id ?? '', lineId });
    expect(frames.booked()).toBe(0);
    hover.set(null);
    expect(frames.booked()).toBe(1);
    frames.run();
    expect(requests).toHaveLength(3);
    drawer.detach();
    hover.set({ routeId: route?.id ?? '', lineId });
    expect(frames.booked()).toBe(0);
  });

  it('(d) a hover with no route selected draws nothing; with the route selected, its line with plus none, or its point; another route\'s, nothing (brief 118, ruling T)', () => {
    const recorder = new Recorder();
    const { store, drawer, target, frames, requests, hover } = drawerOf(upTheMiddle([wide]), (request) => compose(recorder, request));
    drawer.attach(target);
    frames.run();
    const none = recorder.take();
    const route = store.getState().project.scene.routes[0];
    const routeId = route?.id ?? '';
    const lineId = route?.lines[0]?.id ?? '';
    const pointId = route?.points[1]?.id ?? '';
    /** The frame the last request would give with these overlays in place of the drawer's. */
    const asked = (overlays: NonNullable<FrameRequest['overlays']>) => {
      const last = requests[requests.length - 1];
      if (last === undefined) throw new Error('no request');
      const own = new Recorder();
      compose(own, { ...last, overlays });
      return own.take();
    };
    // No route selected: a hover on a line or a point draws the export's frame, line for line (point 4d).
    for (const each of [{ routeId, lineId }, { routeId, pointId }]) {
      hover.set(each);
      frames.run();
      expect(requests[requests.length - 1]?.overlays).toBeUndefined();
      expect(recorder.take()).toEqual(none);
    }
    store.select({ route: routeId, points: [] });
    hover.set(null);
    frames.run();
    const plain = recorder.take();
    expect(plain).toEqual(asked([OVERLAY_MAKERS.lines([routeId], { hovered: null }), OVERLAY_MAKERS.points([routeId], { selected: [], hovered: null })]));
    // Its line: the lines' overlay hovers it with no "+"; the glow is drawn, and no "+" is.
    hover.set({ routeId, lineId });
    frames.run();
    const onLine = recorder.take();
    expect(onLine).toEqual(asked([OVERLAY_MAKERS.lines([routeId], { hovered: { routeId, lineId, plus: 'none' } }), OVERLAY_MAKERS.points([routeId], { selected: [], hovered: null })]));
    expect(onLine).not.toEqual(asked([OVERLAY_MAKERS.lines([routeId], { hovered: { routeId, lineId, plus: 'idle' } }), OVERLAY_MAKERS.points([routeId], { selected: [], hovered: null })]));
    expect(onLine.some((line) => line.includes('rgba(15, 98, 254, 0.45)'))).toBe(true);
    expect(plain.some((line) => line.includes('rgba(15, 98, 254, 0.45)'))).toBe(false);
    // Its point: the points' overlay hovers it.
    hover.set({ routeId, pointId });
    frames.run();
    const onPoint = recorder.take();
    expect(onPoint).toEqual(asked([OVERLAY_MAKERS.lines([routeId], { hovered: null }), OVERLAY_MAKERS.points([routeId], { selected: [], hovered: { routeId, pointId } })]));
    expect(onPoint).not.toEqual(plain);
    // Another route's line or point: nothing more than the selected route's frame.
    for (const each of [{ routeId: 'elsewhere', lineId }, { routeId: 'elsewhere', pointId }]) {
      hover.set(each);
      frames.run();
      expect(recorder.take()).toEqual(plain);
    }
  });

  it('(d) draws the rings of the selected point only, at its place; the point not selected keeps its own mark (Codex, 6)', () => {
    const recorder = new Recorder();
    const project = withBend([wide]);
    const { store, drawer, target, frames } = drawerOf(project, (request) => compose(recorder, request));
    drawer.attach(target);
    frames.run();
    const none = recorder.take();
    const route = store.getState().project.scene.routes[0];
    const top = route?.points[2]?.id ?? '';
    store.select({ route: route?.id ?? null, points: [top] });
    frames.run();
    // The picture, 200 × 100, is fitted whole into the 1920 × 1080 frame: 9.6 times, 1920 × 960, 60 px down. So x 0.5
    // is 960 px; the selected top stop, y 0.1, is 60 + 96 = 156 px; the bend, y 0.5, is 540 px; the first stop, y 0.9,
    // is 924 px. The overlay walks the points in order: the first stop, not selected, draws nothing; the bend draws
    // its grey dot (radius 4) and no ring; the top stop draws the selection ring (the marker's half-width 8, + 4),
    // white then black, two arcs at the one place.
    const arcs = recorder.take().slice(none.length).filter((line) => line.startsWith('arc'));
    const centre = (line: string) => line.split(' ').slice(1, 4).join(' ');
    expect(arcs.map(centre)).toEqual(['960 540 4', '960 156 12', '960 156 12']);
    expect(arcs.some((line) => centre(line).startsWith('960 924'))).toBe(false);
  });

  it('(e) reports a paint that throws, then books on the next change', () => {
    let throwing = true;
    const { store, drawer, target, frames, requests, reports } = drawerOf(upTheMiddle(), () => {
      if (throwing) throw new Error('paint');
      return [];
    });
    drawer.attach(target);
    frames.run();
    expect(reports).toHaveLength(1);
    expect(frames.booked()).toBe(0);
    throwing = false;
    at(store, 50);
    expect(frames.booked()).toBe(1);
    frames.run();
    expect(requests).toHaveLength(2);
    expect(reports).toHaveLength(1);
  });

  it('(e) tells `failed` a frame’s reports only when they differ from the last frame’s', () => {
    const broken: FrameReport = { routeId: 'r', featureId: 'line', reason: 'bad' };
    let now: FrameReport[] = [];
    const { store, drawer, target, frames, failures } = drawerOf(upTheMiddle(), () => now.map((each) => ({ ...each })));
    drawer.attach(target);
    frames.run();
    expect(failures).toHaveLength(0);
    now = [broken];
    for (let n = 1; n <= 60; n += 1) {
      at(store, n);
      frames.run();
    }
    expect(failures).toEqual([[broken]]);
    now = [];
    at(store, 100);
    frames.run();
    expect(failures).toEqual([[broken], []]);
  });

  it('(g) `drawNow` draws at once, in place of the frame booked, only when the store has moved on since the last frame (CORE-06, brief 113)', () => {
    const { store, drawer, target, frames, requests } = drawerOf(upTheMiddle([wide]));
    drawer.drawNow();
    expect(requests).toHaveLength(0);
    drawer.attach(target);
    frames.run();
    expect(requests).toHaveLength(1);
    drawer.drawNow();
    expect(requests).toHaveLength(1);
    at(store, 100);
    expect(frames.booked()).toBe(1);
    drawer.drawNow();
    expect(requests).toHaveLength(2);
    expect(requests[1]?.sceneMs).toBe(100);
    expect(frames.booked()).toBe(0);
    frames.run();
    expect(requests).toHaveLength(2);
    drawer.detach();
    at(store, 200);
    drawer.drawNow();
    expect(requests).toHaveLength(2);
  });

  it('(g) a good frame, a store edit, then a refresh whose paint throws: `drawNow` says the canvas is not the store\'s and books a frame; that booked frame draws it, and `drawNow` then says true without painting again (Codex lines 22 and 27)', () => {
    let throwing = false;
    const { store, drawer, target, frames, requests, reports } = drawerOf(upTheMiddle([wide]), () => {
      if (throwing) throw new Error('paint');
      return [];
    });
    drawer.attach(target);
    frames.run();
    expect(drawer.drawNow()).toBe(true);
    expect(requests).toHaveLength(1);
    throwing = true;
    at(store, 100);
    expect(drawer.drawNow()).toBe(false);
    expect(requests).toHaveLength(2);
    expect(reports).toHaveLength(1);
    expect(frames.booked()).toBe(1);
    // The key of the failed paint is not taken as drawn: the next down paints again, and says so again.
    expect(drawer.drawNow()).toBe(false);
    expect(requests).toHaveLength(3);
    expect(frames.booked()).toBe(1);
    // Recovery by the booked frame itself, not by another `drawNow` (Codex line 27).
    throwing = false;
    frames.run();
    expect(requests).toHaveLength(4);
    expect(requests[3]?.sceneMs).toBe(100);
    expect(frames.booked()).toBe(0);
    expect(drawer.drawNow()).toBe(true);
    expect(requests).toHaveLength(4);
    drawer.detach();
    expect(drawer.drawNow()).toBe(false);
  });

  it('(f) after detach a booked frame draws nothing and no telling is heard', () => {
    const { store, inputs, drawer, target, frames, requests, hold, pictureListeners } = drawerOf();
    drawer.attach(target);
    frames.run();
    at(store, 10);
    expect(frames.booked()).toBe(1);
    drawer.detach();
    expect(frames.booked()).toBe(0);
    at(store, 20);
    hold(drawable());
    inputs.resize({ width: 10, height: 10 });
    frames.run();
    expect(frames.booked()).toBe(0);
    expect(requests).toHaveLength(1);
    expect(pictureListeners.size).toBe(0);
  });

  it('(f) a frame booked and then detached draws nothing even when its callback runs', () => {
    const calls: (() => void)[] = [];
    const frames: FrameSource<number> = {
      request: (callback) => calls.push(() => callback(0)),
      cancel: () => undefined,
    };
    const store = storeOf();
    const requests: FrameRequest[] = [];
    const drawer = createDrawer({
      store, inputs: createFrameInputs({ store }), pictures: { held: () => null, subscribe: () => () => undefined },
      frames, report: () => undefined, failed: () => undefined,
    });
    drawer.attach({ paint: (request) => (requests.push(request), []), surface: blank });
    drawer.detach();
    for (const call of calls) call();
    expect(requests).toHaveLength(0);
  });

  it('(f) sets no transform and no style of its own: what it draws is the composer’s alone', () => {
    const direct = new Recorder();
    const store = storeOf(upTheMiddle([wide]));
    compose(direct, { ...createFrameInputs({ store }).inputs(), sceneMs: 0, surface: blank });
    const recorder = new Recorder();
    const { drawer, target, frames } = drawerOf(upTheMiddle([wide]), (request) => compose(recorder, request));
    drawer.attach(target);
    frames.run();
    expect(recorder.take()).toEqual(direct.take());
  });
});

describe('the canvas’s size (ruling 5)', () => {
  it('is the box times the ratio held to 3, each side whole and at least 1; anything unsound gives 1 by 1', () => {
    expect(canvasSize({ width: 800, height: 450 }, 2)).toEqual({ width: 1600, height: 900 });
    expect(canvasSize({ width: 800, height: 450 }, 4)).toEqual({ width: 2400, height: 1350 });
    expect(canvasSize({ width: 100.3, height: 50.6 }, 1.5)).toEqual({ width: 150, height: 76 });
    expect(canvasSize({ width: 0.1, height: 0.1 }, 1)).toEqual({ width: 1, height: 1 });
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(canvasSize({ width: bad, height: 100 }, 1)).toEqual({ width: 1, height: 1 });
      expect(canvasSize({ width: 100, height: bad }, 1)).toEqual({ width: 1, height: 1 });
      expect(canvasSize({ width: 100, height: 100 }, bad)).toEqual({ width: 1, height: 1 });
    }
  });
});

describe('the frame’s shape, the video’s (ruling 6, D202)', () => {
  const scene = newScene(() => 'id');
  const sized = (width: number, height: number) => ({ ...scene, settings: { ...scene.settings, export: { ...scene.settings.export, width, height } } });
  it('is the scene’s export width and height: 1920 by 1080 by default, 1080 by 1920 when the video is upright', () => {
    expect(frameShape(scene)).toEqual({ width: 1920, height: 1080 });
    expect(frameShape(sized(1080, 1920))).toEqual({ width: 1080, height: 1920 });
    expect(frameShape(sized(1000, 1000))).toEqual({ width: 1000, height: 1000 });
  });
  it('takes no part from the picture: with a 200 by 100 picture held it is the video’s, and follows the scene held', () => {
    const store = storeOf(upTheMiddle([wide]));
    const holder = createFrameInputs({ store });
    expect(holder.inputs().image).toEqual({ width: 200, height: 100 });
    expect(frameShape(holder.inputs().scene)).toEqual({ width: 1920, height: 1080 });
    store.dispatch(setSceneSetting('export', 'width', 1080));
    store.dispatch(setSceneSetting('export', 'height', 1920));
    expect(holder.inputs().image).toEqual({ width: 200, height: 100 });
    expect(frameShape(holder.inputs().scene)).toEqual({ width: 1080, height: 1920 });
  });
  it('gives START_SIZE’s for a width or height that is not a finite number above 0', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(frameShape(sized(bad, 1080))).toEqual(START_SIZE);
      expect(frameShape(sized(1920, bad))).toEqual(START_SIZE);
    }
  });
});

/** A canvas 1000 CSS pixels wide at (0, 0) on the page, its pointer listeners and capture held by hand. */
function canvasStandIn() {
  const live = new Map<string, Set<(event: PointerFields) => void>>();
  const captured = new Set<number>();
  const listened = {
    addEventListener: (type: string, listener: (event: PointerFields) => void) => {
      live.set(type, (live.get(type) ?? new Set()).add(listener));
    },
    removeEventListener: (type: string, listener: (event: PointerFields) => void) => {
      live.get(type)?.delete(listener);
    },
  };
  const canvas = {
    ...listened,
    width: 0,
    height: 0,
    captured,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000 }),
    setPointerCapture: (id: number) => captured.add(id),
    releasePointerCapture: (id: number) => captured.delete(id),
    hasPointerCapture: (id: number) => captured.has(id),
    fire: (type: string, clientX: number, clientY: number) => {
      const event: PointerFields = { pointerId: 1, isPrimary: true, button: 0, clientX, clientY, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false };
      for (const listener of [...(live.get(type) ?? [])]) listener(event);
    },
  };
  return { canvas, win: { ...listened } };
}

describe('the preview\'s paint (point 7)', () => {
  it('a good frame records, the store changes, the next paint returns without running its overlays: a down on the place tapped places nothing, joins nothing and takes no capture (brief 115, ruling V; Codex line 26)', () => {
    const { canvas, win } = canvasStandIn();
    const recorder = new Recorder();
    let overlaysRun = true;
    const painting = recordingPaint(canvas, (request) => {
      if (overlaysRun) return compose(recorder, request);
      return [];
    });
    const { store, drawer, target, frames } = drawerOf(upTheMiddle([wide]), painting.paint);
    drawer.attach(target);
    frames.run();
    const recorded = painting.geometry();
    if (recorded === null) throw new Error('the good frame recorded nothing');
    expect(canvas.width).toBe(START_SIZE.width);
    const unbind = bindCanvas({ canvas, win, store, geometry: painting.geometry, refresh: () => drawer.drawNow(), mac: true });
    // An empty place a fifth of the way across the picture, half-way down, in the pointer's CSS pixels.
    const ratio = canvas.width / 1000;
    const { bounds } = recorded;
    const x = (bounds.x + 0.2 * bounds.width) / ratio;
    const y = (bounds.y + 0.5 * bounds.height) / ratio;
    canvas.fire('pointerdown', x, y);
    canvas.fire('pointerup', x, y);
    const placed = store.getState().project.scene.routes[0];
    expect(placed?.points).toHaveLength(3);
    expect(placed?.points[2]).toMatchObject({ x: 0.2, y: 0.5 });
    // The store has moved on; the next paint (the down's own) returns without running the recording overlay.
    overlaysRun = false;
    canvas.fire('pointerdown', x, y);
    expect(canvas.captured.size).toBe(0);
    canvas.fire('pointerup', x, y);
    expect(store.getState().project.scene.routes[0]).toBe(placed);
    expect(canvas.captured.size).toBe(0);
    expect(store.getState().gesture).toBeNull();
    expect(painting.geometry()).toBeNull();
    unbind();
    drawer.detach();
  });
});
