// CORE-05, stage 6 (brief 84): the preview, Frame's `preview` slot. Everything that decides what it draws and when is
// previewLogic.ts (proved in Node); this is the canvas that logic draws on, and nothing more: no zoom, no pan and no
// hover yet.
// Its claim:
// 1. One `<canvas>`, in a box named "Route animation preview" (v3's name, index.html 1468, with "preview" for
//    "canvas"; provisional). CORE-06 (brief 109): the box is operable, no longer an image: one tab stop, and the
//    editor's pointer acts on it. Its role is `toolbar`: the lint's strict set (4.1.2) refuses a tab stop and pointer
//    handlers on `application` (not an interactive role to it), as on an image, a group or a region; of the roles it
//    takes, toolbar needs no state and no owned items, asks for no typed text (as a textbox would) and is none a
//    control's graphic stands in (a button, a link, a tab, a menu item, a checkbox, a switch, an option), so the
//    preview stays set aside from the contrast check as the user's own picture. The role, name and tab stop stand on
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
//    where the column ends), again whenever the column or the window changes size, and handed to the box's style as
//    `--preview-room`; where the window is too short for that, the box keeps its former least, two fifths of the
//    window's height. The composer fits the picture (or, with none, the square the scene measures as) inside the frame. The bands about a picture are the background's white margin, drawn over the whole
//    frame before the picture as the export draws it (background.ts); with no picture shown the canvas holds nothing
//    there and the box's own background shows.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { compose, type Surface } from '../../player/compose';
import { canvasSize, frameShape, type Drawer, type FrameInputs } from './previewLogic';

export interface PreviewProps {
  /** The session's one drawer. */
  readonly drawer: Pick<Drawer, 'attach' | 'detach'>;
  /** The session's one inputs: the size is handed to it, and the box's shape read from it. */
  readonly inputs: Pick<FrameInputs, 'inputs' | 'resize'>;
  /** The store's telling of a change: an opened project, or a change of the export's size, may bring another shape. */
  readonly subscribe: (listener: () => void) => () => void;
}

/** The canvas's spoken name (1.1.1). */
export const PREVIEW_NAME = 'Route animation preview';

/** The least height the box takes, in `vh`, when the room left is smaller (point 5). */
export const PREVIEW_LEAST_VH = 40;

/**
 * The height the box may take (point 5), in CSS pixels: the window's height less everything else in its column, from
 * the top of the page to the column's end (`columnEnd`, in the page's coordinates); `box` is the box's height now. The
 * same whatever the box's height, so setting it changes it no further. Never below 0.
 */
export function previewRoom(windowHeight: number, columnEnd: number, box: number): number {
  return Math.max(0, Math.floor(windowHeight - (columnEnd - box)));
}

const surface = (size: { width: number; height: number }): Surface => {
  const image = new OffscreenCanvas(size.width, size.height);
  const context = image.getContext('2d');
  if (context === null) throw new Error('an offscreen canvas gave no 2D context');
  return { context, image };
};

export function Preview({ drawer, inputs, subscribe }: PreviewProps) {
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
    drawer.attach({
      paint: (request) => {
        const { width, height } = request.size;
        if (element.width !== width) element.width = width;
        if (element.height !== height) element.height = height;
        return compose(context, request);
      },
      surface,
    });

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
      ratio?.removeEventListener('change', onRatio);
      observer.disconnect();
      drawer.detach();
    };
  }, [drawer, inputs]);

  // The room left (point 5): measured in a task of its own after the column or the window changes size, so setting it
  // never resizes what is being observed within the observer's own call.
  useEffect(() => {
    const element = boxRef.current;
    const column = element?.parentElement?.parentElement;
    if (!element || !column) return undefined;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const measure = () => {
      pending = null;
      const room = previewRoom(innerHeight, column.getBoundingClientRect().bottom + scrollY, element.getBoundingClientRect().height);
      const value = `${String(room)}px`;
      if (element.style.getPropertyValue('--preview-room') !== value) element.style.setProperty('--preview-room', value);
    };
    const soon = () => {
      pending ??= setTimeout(measure, 0);
    };
    const observer = new ResizeObserver(soon);
    observer.observe(column);
    addEventListener('resize', soon);
    soon();
    return () => {
      if (pending !== null) clearTimeout(pending);
      removeEventListener('resize', soon);
      observer.disconnect();
    };
  }, []);

  // As wide as the slot, and no wider than the room left (or the least, if more) times the shape (point 5).
  const width = `min(100%, calc(max(var(--preview-room, 0px), ${String(PREVIEW_LEAST_VH)}vh) * ${aspect}))`;
  return (
    <div ref={boxRef} className="preview" role="toolbar" aria-label={PREVIEW_NAME} tabIndex={0} style={{ aspectRatio: aspect, width }}>
      <canvas ref={canvas} className="preview__canvas" />
    </div>
  );
}
