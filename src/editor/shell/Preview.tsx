// CORE-05, stage 6 (brief 84): the preview, Frame's `preview` slot. Everything that decides what it draws and when is
// previewLogic.ts (proved in Node); this is the canvas that logic draws on, and nothing more: no zoom, no pan and no
// hover yet.
// Its claim:
// 1. One `<canvas>`, in a box named "Route animation preview" (v3's name, index.html 1468, with "preview" for
//    "canvas"; provisional). CORE-06 (brief 109): the box is operable, no longer an image: one tab stop, and the
//    editor's pointer acts on it. Its role is `application` (D245, the owner's ruling of 26 Nov: a toolbar is a row of
//    buttons, which this is not). The lint's strict set (4.1.2) counts `application` as no interactive role and so
//    refuses its tab stop: one disable on this element alone allows it (`no-noninteractive-tabindex`, the only rule it
//    trips; the pointer is bound by listeners, not JSX handlers). The preview stays set aside from the contrast check
//    as the user's own picture. The role, name and tab stop stand on
//    the box, not the canvas, so the canvas never takes Tab itself (2.1.2). Nothing in it is live: Play, Pause and
//    "Animation complete" are said by the status region already. The theme's focus ring rings it, as it rings anything
//    with a tab stop.
// 2. At mount it attaches the session's drawer to the canvas (`attach({ paint, surface })`); at unmount it detaches.
//    React's strict mode mounts twice: `attach` lets an earlier target go.
// 3. `paint` sets the canvas's `width` and `height` to the request's size when they differ, then composes the request
//    on the canvas's context in the same call, so a resize never shows a blank frame; it gives back the composer's
//    reports. It sets no transform and no style of its own (the composer resets and clears first, CORE-04.6).
//    `surface` is an OffscreenCanvas the size asked, its context and itself, as the composer's `Surface`.
// 4. The size drawn is the canvas's box in CSS pixels times the device's pixel ratio (`canvasSize`, held to 3), handed
//    to the session's inputs (`resize`): a ResizeObserver hears the box, and a `matchMedia` on the resolution now hears
//    a change of the pixel ratio alone (a browser zoom, a move to another screen), armed again at each change.
// 5. The box (frameLook.css): the video's shape (D202, the owner's choice): the scene's export width to its height
//    (`frameShape`, previewLogic.ts's point 6), with a picture or without one, so the preview draws the frame the video
//    draws. CORE-06 (D209, the owner's "Remove and enlarge"): it takes the height left in the window, as wide as its
//    slot and no taller than the room the rest of its column leaves (`previewRoom`), so the play bar and timeline under
//    it stay in sight; its width then follows the shape. Its column is the frame's column holding the preview's region
//    (the box's parent's parent, Frame.tsx). The room is measured from the column (the box's height and
//    where the column's own content ends, never a taller side column's end), again whenever the column, the frame
//    holding it (the notice above the columns shown or dismissed) or the window changes size (`watchRoom`), and handed
//    to the box's style as `--preview-room`; where the window is too short for that, the box keeps a least of three
//    tenths of the window's height (brief 111: two fifths, 288 px at 720, pushed the play bar out of sight under Open's
//    notice; three tenths leaves it in sight). The composer fits the picture (or, with none, the square the scene
//    measures as) inside the frame. The bands about a picture are the background's white margin, drawn over the whole
//    frame before the picture as the export draws it (background.ts); with no picture shown the canvas holds nothing
//    there and the box's own background shows.
// 6. CORE-06 (brief 112): the canvas takes the pointer (src/editor/canvas/dom.ts, `bindCanvas`), bound at mount and
//    unbound at unmount with the drawer. `paint` adds one overlay to each request, which draws nothing and keeps what the
//    frame was drawn with (the image's bounds as the frame's transform places them, each route's shape and timeline);
//    the pointer is hit-tested against that, in its CSS pixels. The pen's tap (on the up, never the down, 2.5.2) places
//    a point, joined from the selected one; each down first has the drawer draw now if the store has moved on since the
//    last frame (`drawNow`), so a quick second tap meets the point the first placed. The canvas takes no touch
//    scrolling (`touch-action: none`), so a finger draws as a mouse does.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Overlay } from '../../adapters/render/overlays';
import { compose, type Surface } from '../../player/compose';
import { bindCanvas, recordGeometry, type Geometry } from '../canvas/dom';
import type { Store } from '../store/store';
import { MAC } from './keydown';
import { canvasSize, frameShape, type Drawer, type FrameInputs } from './previewLogic';

export interface PreviewProps {
  /** The session's one drawer. */
  readonly drawer: Pick<Drawer, 'attach' | 'detach' | 'drawNow'>;
  /** The session's one inputs: the size is handed to it, and the box's shape read from it. */
  readonly inputs: Pick<FrameInputs, 'inputs' | 'resize'>;
  /** The store's telling of a change: an opened project, or a change of the export's size, may bring another shape. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The session's store, which the pen's taps change (point 6). */
  readonly store: Store;
}

/** The canvas's spoken name (1.1.1). */
export const PREVIEW_NAME = 'Route animation preview';

/** The least height the box takes, in `vh`, when the room left is smaller (point 5). */
export const PREVIEW_LEAST_VH = 30;

/**
 * The height the box may take (point 5), in CSS pixels: the window's height less everything else in its column, from
 * the top of the page to the column's end (`columnEnd`, in the page's coordinates); `box` is the box's height now. The
 * same whatever the box's height, so setting it changes it no further. Never below 0.
 */
export function previewRoom(windowHeight: number, columnEnd: number, box: number): number {
  return Math.max(0, Math.floor(windowHeight - (columnEnd - box)));
}

/** What `watchRoom` reads of an element: its box on the page now. */
export interface RoomElement {
  getBoundingClientRect(): { readonly bottom: number; readonly height: number };
}
/** The preview's box, whose style takes the room. */
export interface RoomBox extends RoomElement {
  readonly style: { getPropertyValue(name: string): string; setProperty(name: string, value: string): void };
}
/** The box's column: what stands in it, and the frame holding it. */
export interface RoomColumn extends RoomElement {
  readonly children: ArrayLike<RoomElement>;
  readonly parentElement: RoomElement | null;
}
/** What `watchRoom` takes of the window (the page's own `window`, or a stand-in in Node). */
export interface RoomWindow {
  readonly innerHeight: number;
  readonly scrollY: number;
  addEventListener(type: 'resize', listener: () => void): void;
  removeEventListener(type: 'resize', listener: () => void): void;
  setTimeout(handler: () => void, timeout: number): number;
  clearTimeout(id: number): void;
  readonly ResizeObserver: new (callback: () => void) => { observe(target: RoomElement): void; disconnect(): void };
}

/**
 * Keeps the box's `--preview-room` (point 5) up to date: measured in a task of its own after the column, the frame
 * holding it or the window changes size, so setting it never resizes what is being observed within the observer's own
 * call. The frame is watched for the notice above the columns (Frame.tsx): shown or dismissed, it moves the column
 * without resizing it, and grows or shrinks the frame. The column ends where its own content ends (its last child's
 * bottom, or its own with nothing in it), never at a bottom stretched to a taller side column. Gives back what stops it.
 */
export function watchRoom(box: RoomBox, column: RoomColumn, win: RoomWindow): () => void {
  let pending: number | null = null;
  const measure = () => {
    pending = null;
    let end = column.children.length ? -Infinity : column.getBoundingClientRect().bottom;
    for (let i = 0; i < column.children.length; i += 1) end = Math.max(end, column.children[i]?.getBoundingClientRect().bottom ?? end);
    const room = previewRoom(win.innerHeight, end + win.scrollY, box.getBoundingClientRect().height);
    const value = `${String(room)}px`;
    if (box.style.getPropertyValue('--preview-room') !== value) box.style.setProperty('--preview-room', value);
  };
  const soon = () => {
    pending ??= win.setTimeout(measure, 0);
  };
  const observer = new win.ResizeObserver(soon);
  observer.observe(column);
  if (column.parentElement) observer.observe(column.parentElement);
  win.addEventListener('resize', soon);
  soon();
  return () => {
    if (pending !== null) win.clearTimeout(pending);
    win.removeEventListener('resize', soon);
    observer.disconnect();
  };
}

const surface = (size: { width: number; height: number }): Surface => {
  const image = new OffscreenCanvas(size.width, size.height);
  const context = image.getContext('2d');
  if (context === null) throw new Error('an offscreen canvas gave no 2D context');
  return { context, image };
};

export function Preview({ drawer, inputs, subscribe, store }: PreviewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // The box's shape: the video's, the scene's export width and height (point 5), as one string so a telling that leaves
  // it as it was draws nothing again.
  const shape = () => {
    const { width, height } = frameShape(inputs.inputs().scene);
    return `${String(width)} / ${String(height)}`;
  };
  const aspect = useSyncExternalStore(subscribe, shape, shape);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return undefined;
    // What the last frame was drawn with (point 6), kept by an overlay that draws nothing.
    let drawn: Geometry | null = null;
    const record: Overlay = (_context, frame, screen) => {
      drawn = recordGeometry(frame, screen);
    };
    drawer.attach({
      paint: (request) => {
        // Unknown until this paint's record overlay runs: a paint that throws first leaves no old geometry to hit (P).
        drawn = null;
        const { width, height } = request.size;
        if (element.width !== width) element.width = width;
        if (element.height !== height) element.height = height;
        return compose(context, { ...request, overlays: [...(request.overlays ?? []), record] });
      },
      surface,
    });
    const unbind = bindCanvas({ canvas: element, win: window, store, geometry: () => drawn, refresh: () => drawer.drawNow(), mac: MAC });

    let box = { width: 0, height: 0 };
    const measure = () => {
      inputs.resize(canvasSize(box, devicePixelRatio));
    };
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      box = { width: entry.contentRect.width, height: entry.contentRect.height };
      measure();
    });
    observer.observe(element);

    let ratio: MediaQueryList | null = null;
    const hearRatio = () => {
      ratio?.removeEventListener('change', onRatio);
      ratio = matchMedia(`(resolution: ${String(devicePixelRatio)}dppx)`);
      ratio.addEventListener('change', onRatio);
    };
    function onRatio() {
      hearRatio();
      measure();
    }
    hearRatio();

    return () => {
      unbind();
      ratio?.removeEventListener('change', onRatio);
      observer.disconnect();
      drawer.detach();
    };
  }, [drawer, inputs, store]);

  // The room left (point 5).
  useEffect(() => {
    const element = boxRef.current;
    const column = element?.parentElement?.parentElement;
    if (!element || !column) return undefined;
    return watchRoom(element, column, window);
  }, []);

  // As wide as the slot, and no wider than the room left (or the least, if more) times the shape (point 5).
  const width = `min(100%, calc(max(var(--preview-room, 0px), ${String(PREVIEW_LEAST_VH)}vh) * ${aspect}))`;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- D245: the owner chose `application` for this one box, a canvas the pointer draws on with one tab stop; the strict set counts that role as not interactive.
    <div ref={boxRef} className="preview" role="application" aria-label={PREVIEW_NAME} tabIndex={0} style={{ aspectRatio: aspect, width }}>
      <canvas ref={canvas} className="preview__canvas" style={{ touchAction: 'none' }} />
    </div>
  );
}
