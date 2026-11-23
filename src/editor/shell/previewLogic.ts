// CORE-05, stage 6: the preview's rule, as logic with no page. The page (the next chat's) puts a canvas in the frame's
// `preview` slot and draws the scene on it through the one composer (src/player/compose.ts); everything that decides
// what it draws and when is here. Nothing here names a browser global: the store, the frame source, the picture's
// loader, `paint` and `surface` are handed in, so Node proves it with a store, frames run by hand and the recorder.
//
// Its claim:
// 1. The background is the project's first image, or none with no image: `backgroundOf` says so, and nothing else in
//    the editor picks an image by its place (provisional; the file names no background, D132).
// 2. One source for what a frame and the play length are made from, the inputs (`createFrameInputs`): `inputs()` gives
//    the store's scene as it is now, the seed `SEED` (1), the size last given to `resize` (from `START_SIZE`, 1920 by
//    1080) and the background's size from its header (`sizeOf`), read once for each background record and null with
//    no background or a header that cannot be read. Nothing waits for a decoder: an open's own telling already reads
//    the opened picture's size. `resize` takes whole numbers of 1 or more and ignores anything else; its listeners are
//    told only when the size changes. The session hands `inputs` to the player's transport; the drawer reads the same.
// 3. The picture to draw (`createPictures`) is loaded through the loader handed in, `load(bytes, type)`, apart from the
//    inputs: it is asked when a record becomes the background, never with no background, never for a record whose
//    load is still pending or has failed. The latest wins: a picture that arrives when its record is no longer the
//    background, or after `close()`, is closed and never held. The picture held is closed once, when the background
//    changes or `close()` is called. A load that gives null, throws or rejects holds nothing and is reported once
//    through `report`, never thrown. Listeners are told only when the picture held changes. Until one is held, a frame's
//    image is the size alone: the routes stand where they will, the picture not yet drawn.
// 4. When a frame is drawn (`createDrawer`; the page hands `paint` and `surface` to `attach`):
//    (a) a frame is drawn only at a frame it booked, one booked at a time, one draw a frame however many changes came;
//    (b) it books at attach, then only when what a frame is made from is not what the last draw used: the scene's
//        object, the position (`playback.atMs`), the selection's object, the picture held, the size and the background's
//        size. A telling that changes none of them (the speed, `playing` alone) books nothing: a still page draws nothing;
//    (c) the request is made when the frame runs, from what is held then: the inputs' scene, seed, size and image (with
//        the picture's `source` when one is held), `sceneMs` the position, the `surface`; no `viewing` (CORE-06's zoom
//        and pan) and no `images` (nothing names one yet);
//    (d) no overlays when no route is selected, so the frame is line for line an export's; with a route selected,
//        `OVERLAY_MAKERS.points([route], { selected })`, each selected point as `{ routeId, pointId }` (hover is CORE-06's);
//    (e) a `paint` that throws is reported and draws nothing more that frame; the next change books as before. The
//        reports a frame gives back go to `failed` only when they differ from the last frame's, so a module failing
//        through a whole playing is told once;
//    (f) it sets no transform and no style of its own (the composer resets before it draws, CORE-04.6). After `detach`
//        a frame already booked draws nothing and no telling is heard;
//    (g) said plainly, not mended: while a scene plays, the player's transport writes a position inside its own frame
//        and the drawer books the next one, so the canvas shows the position one frame late. One loop that runs the
//        transport's frame and then the draw in the same frame would change the frame source every proof here stands
//        on; the page chat measures it.
// 5. `canvasSize(box, ratio)`: the box in CSS pixels times the device's pixel ratio, held to at most 3 (v3's cap,
//    v3/src/main.js:1455), each side rounded to a whole number and at least 1; a box or a ratio that is not a finite
//    number above 0 gives 1 by 1.
// 6. It does not claim to withstand code written to break it.
import type { ImageType, Project } from '../../adapters/io/format';
import { sizeOf } from '../../adapters/io/images';
import type { Size } from '../../core/geometry/transform';
import type { Scene } from '../../core/model/scene';
import { OVERLAY_MAKERS } from '../../features/catalogue.editor';
import type { ContentRequest, FrameReport, FrameRequest, Surface } from '../../player/compose';
import type { FrameSource } from '../../player/transport/transport';
import type { Store } from '../store/store';
import type { Selection } from '../store/selection';

type ImageRecord = Project['images'][number];
type Listeners = Set<() => void>;

const tell = (listeners: Listeners): void => {
  for (const listener of [...listeners]) listener();
};

const listen = (listeners: Listeners, listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The seed every frame and the length use: a project holds none and today's catalogue draws nothing random. */
export const SEED = 1;
/** The size the inputs begin at, until the page tells them the canvas's. */
export const START_SIZE: Size = Object.freeze({ width: 1920, height: 1080 });

/** The project's background: its first image, or null with none (the claim's point 1). */
export function backgroundOf(project: Project): ImageRecord | null {
  return project.images[0] ?? null;
}

/** What a frame and the length are made from now (point 2). */
export interface FrameInputs {
  /** A property, so the session can hand it to the player's transport as it stands. */
  readonly inputs: () => ContentRequest;
  /** Keeps `size` when both sides are whole numbers of 1 or more; ignores anything else. */
  resize(size: Size): void;
  /** Calls `listener` when the size changes; gives back the call that stops it. */
  subscribe(listener: () => void): () => void;
}

export function createFrameInputs({ store }: { readonly store: Pick<Store, 'getState'> }): FrameInputs {
  let size = START_SIZE;
  let read: { readonly record: ImageRecord; readonly size: Size | null } | null = null;
  const listeners: Listeners = new Set();

  const imageSize = (): Size | null => {
    const record = backgroundOf(store.getState().project);
    if (record === null) return null;
    if (read?.record !== record) {
      const found = sizeOf(record.bytes, record.type);
      read = { record, size: found === null ? null : Object.freeze({ width: found.width, height: found.height }) };
    }
    return read.size;
  };

  return {
    inputs: () => ({ scene: store.getState().project.scene, seed: SEED, size, image: imageSize() }),
    resize: (next) => {
      const whole = (n: number) => Number.isInteger(n) && n >= 1;
      if (!whole(next.width) || !whole(next.height)) return;
      if (next.width === size.width && next.height === size.height) return;
      size = Object.freeze({ width: next.width, height: next.height });
      tell(listeners);
    },
    subscribe: (listener) => listen(listeners, listener),
  };
}

/** A decoded picture the page can draw, and how to let it go. */
export interface Picture {
  readonly source: CanvasImageSource;
  close(): void;
}

/** The page's is the browser's `createImageBitmap`; a test's is its own. */
export type LoadPicture = (bytes: Uint8Array, type: ImageType) => Promise<Picture | null>;

/** The background's picture, loaded apart from the inputs (point 3). */
export interface Pictures {
  /** The picture held now, or null. */
  held(): CanvasImageSource | null;
  /** Calls `listener` when the picture held changes; gives back the call that stops it. */
  subscribe(listener: () => void): () => void;
  /** Closes the picture held, hears the store no more, and closes any picture that arrives after. */
  close(): void;
}

export interface PicturesOptions {
  readonly store: Pick<Store, 'getState' | 'subscribe'>;
  readonly load: LoadPicture;
  /** Where a load that gives nothing, throws or rejects is told, once. */
  readonly report: (error: unknown) => void;
}

export function createPictures({ store, load, report }: PicturesOptions): Pictures {
  /** The record that is the background now, as last heard. */
  let wanted: ImageRecord | null = null;
  let held: { readonly record: ImageRecord; readonly picture: Picture } | null = null;
  let closed = false;
  const pending = new WeakSet<ImageRecord>();
  const failed = new WeakSet<ImageRecord>();
  const listeners: Listeners = new Set();

  const fail = (record: ImageRecord, error: unknown): void => {
    failed.add(record);
    report(error);
  };

  const arrived = (record: ImageRecord, picture: Picture | null): void => {
    pending.delete(record);
    if (picture === null) {
      fail(record, new Error('The background picture could not be loaded.'));
      return;
    }
    if (closed || wanted !== record || held !== null) {
      picture.close();
      return;
    }
    held = { record, picture };
    tell(listeners);
  };

  const follow = (): void => {
    const record = backgroundOf(store.getState().project);
    if (closed || record === wanted) return;
    wanted = record;
    if (held !== null) {
      const { picture } = held;
      held = null;
      picture.close();
      tell(listeners);
    }
    if (record === null || pending.has(record) || failed.has(record)) return;
    pending.add(record);
    let loading: Promise<Picture | null>;
    try {
      loading = load(record.bytes, record.type);
    } catch (error) {
      pending.delete(record);
      fail(record, error);
      return;
    }
    loading.then(
      (picture) => {
        arrived(record, picture);
      },
      (error: unknown) => {
        pending.delete(record);
        fail(record, error);
      },
    );
  };

  const stop = store.subscribe(follow);
  follow();

  return {
    held: () => held?.picture.source ?? null,
    subscribe: (listener) => listen(listeners, listener),
    close: () => {
      if (closed) return;
      closed = true;
      stop();
      if (held !== null) {
        const { picture } = held;
        held = null;
        picture.close();
      }
    },
  };
}

/** What the page hands the drawer at attach. */
export interface Target {
  /** Draws a request (the page's: the composer on the canvas's context) and gives back what could not be drawn. */
  readonly paint: (request: FrameRequest) => readonly FrameReport[];
  readonly surface: (size: Size) => Surface;
}

export interface DrawerOptions<H> {
  readonly store: Pick<Store, 'getState' | 'subscribe'>;
  readonly inputs: FrameInputs;
  readonly pictures: Pick<Pictures, 'held' | 'subscribe'>;
  readonly frames: FrameSource<H>;
  /** Where a `paint` that throws is told. */
  readonly report: (error: unknown) => void;
  /** Told a frame's reports when they differ from the last frame's. */
  readonly failed: (reports: readonly FrameReport[]) => void;
}

export interface Drawer {
  /** Begins drawing onto the page's target (any earlier one let go first) and books the first frame. */
  attach(target: Target): void;
  /** Draws nothing more: a frame booked is cancelled and no telling is heard. */
  detach(): void;
}

/** What a frame is made from, by value: objects by identity, then numbers (point 4b). */
type Key = readonly [Scene, number, Selection, CanvasImageSource | null, number, number, number | null, number | null];

const sameKey = (a: Key, b: Key): boolean => a.every((value, i) => Object.is(value, b[i]));

const sameReports = (a: readonly FrameReport[], b: readonly FrameReport[]): boolean =>
  a.length === b.length &&
  a.every((each, i) => each.routeId === b[i]?.routeId && each.featureId === b[i].featureId && each.reason === b[i].reason);

/** The editor's overlays for a selection: none with no route selected (point 4d). */
function overlaysOf(selection: Selection): FrameRequest['overlays'] {
  const { route } = selection;
  if (route === null) return undefined;
  const selected = selection.points.map((pointId) => ({ routeId: route, pointId }));
  return [OVERLAY_MAKERS.points([route], { selected })];
}

export function createDrawer<H>({ store, inputs, pictures, frames, report, failed }: DrawerOptions<H>): Drawer {
  let attached: { readonly target: Target; readonly stops: readonly (() => void)[] } | null = null;
  let booked: { readonly handle: H; readonly ticket: object } | null = null;
  let drawn: Key | null = null;
  let lastReports: readonly FrameReport[] = [];

  const keyNow = (): Key => {
    const { project, playback, selection } = store.getState();
    const { size, image } = inputs.inputs();
    return [project.scene, playback.atMs, selection, pictures.held(), size.width, size.height, image?.width ?? null, image?.height ?? null];
  };

  const requestNow = (surface: Target['surface']): FrameRequest => {
    const { scene, seed, size, image } = inputs.inputs();
    const source = pictures.held();
    const { playback, selection } = store.getState();
    const picture = image === null ? null : source === null ? image : { ...image, source };
    const overlays = overlaysOf(selection);
    return { scene, sceneMs: playback.atMs, seed, size, image: picture, surface, ...(overlays ? { overlays } : {}) };
  };

  const frame = (): void => {
    if (attached === null) return;
    drawn = keyNow();
    let reports: readonly FrameReport[];
    try {
      reports = attached.target.paint(requestNow(attached.target.surface));
    } catch (error) {
      report(error);
      return;
    }
    if (sameReports(reports, lastReports)) return;
    lastReports = reports;
    failed(reports);
  };

  const book = (): void => {
    if (booked !== null) return;
    const ticket = {};
    const handle = frames.request(() => {
      if (booked?.ticket !== ticket) return;
      booked = null;
      frame();
    });
    booked = { handle, ticket };
  };

  const changed = (): void => {
    if (attached === null) return;
    if (drawn === null || !sameKey(drawn, keyNow())) book();
  };

  const detach = (): void => {
    if (attached === null) return;
    for (const stop of attached.stops) stop();
    attached = null;
    if (booked !== null) {
      const { handle } = booked;
      booked = null;
      frames.cancel(handle);
    }
  };

  return {
    attach: (target) => {
      detach();
      attached = { target, stops: [store.subscribe(changed), pictures.subscribe(changed), inputs.subscribe(changed)] };
      drawn = null;
      lastReports = [];
      book();
    },
    detach,
  };
}

/** v3's cap on the device's pixel ratio (v3/src/main.js:1455). */
const MOST_RATIO = 3;

/** The canvas's size in device pixels for a box in CSS pixels (point 5). */
export function canvasSize(box: Size, ratio: number): Size {
  const sound = (n: number) => Number.isFinite(n) && n > 0;
  if (!sound(box.width) || !sound(box.height) || !sound(ratio)) return { width: 1, height: 1 };
  const scale = Math.min(ratio, MOST_RATIO);
  const side = (n: number) => Math.max(1, Math.round(n * scale));
  return { width: side(box.width), height: side(box.height) };
}
