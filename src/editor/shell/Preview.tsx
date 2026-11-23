// CORE-05, stage 6 (brief 84): the preview, Frame's `preview` slot. Everything that decides what it draws and when is
// previewLogic.ts (proved in Node); this is the canvas that logic draws on, and nothing more: no zoom, no pan, no hover
// and no click (CORE-06's).
// Its claim:
// 1. One `<canvas>`, in a box that is an image named "Route animation preview" (1.1.1: v3's name, index.html 1468, with
//    "preview" for "canvas"; provisional). The role and name stand on the box, not the canvas: the lint's rule for
//    4.1.2 refuses a non-interactive role on a canvas, and an image's children are not read, so the canvas is not
//    met by itself. Nothing in it can be operated: no tab stop, no key and no pointer handler. Nothing in it is live:
//    Play, Pause and "Animation complete" are said by the status region already.
// 2. At mount it attaches the session's drawer to the canvas (`attach({ paint, surface })`); at unmount it detaches.
//    React's strict mode mounts twice: `attach` lets an earlier target go.
// 3. `paint` sets the canvas's `width` and `height` to the request's size when they differ, then composes the request
//    on the canvas's context in the same call, so a resize never shows a blank frame; it gives back the composer's
//    reports. It sets no transform and no style of its own (the composer resets and clears first, CORE-04.6).
//    `surface` is an OffscreenCanvas the size asked, its context and itself, as the composer's `Surface`.
// 4. The size drawn is the canvas's box in CSS pixels times the device's pixel ratio (`canvasSize`, held to 3), handed
//    to the session's inputs (`resize`): a ResizeObserver hears the box, and a `matchMedia` on the resolution now hears
//    a change of the pixel ratio alone (a browser zoom, a move to another screen), armed again at each change.
// 5. The box (frameLook.css): the background's shape (the inputs' image, its height over its width), 16 to 9 with no
//    picture (START_SIZE's); as wide as its slot, and never taller than two fifths of the window's height, its width then
//    following the shape, so the play bar under it stays in sight. Where the frame's shape and the picture's differ the
//    composer fits the picture inside it; the box's own background shows round it.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { compose, type Surface } from '../../player/compose';
import { canvasSize, START_SIZE, type Drawer, type FrameInputs } from './previewLogic';

export interface PreviewProps {
  /** The session's one drawer. */
  readonly drawer: Pick<Drawer, 'attach' | 'detach'>;
  /** The session's one inputs: the size is handed to it, and the box's shape read from it. */
  readonly inputs: Pick<FrameInputs, 'inputs' | 'resize'>;
  /** The store's telling of a change: an opened project may bring a picture of another shape. */
  readonly subscribe: (listener: () => void) => () => void;
}

/** The canvas's spoken name (1.1.1). */
export const PREVIEW_NAME = 'Route animation preview';

/** The most of the window's height the box takes, in `vh` (point 5). */
export const PREVIEW_HEIGHT_VH = 40;

const surface = (size: { width: number; height: number }): Surface => {
  const image = new OffscreenCanvas(size.width, size.height);
  const context = image.getContext('2d');
  if (context === null) throw new Error('an offscreen canvas gave no 2D context');
  return { context, image };
};

export function Preview({ drawer, inputs, subscribe }: PreviewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // The box's shape: the background's size, or START_SIZE's with none (point 5), as one string so a telling that leaves
  // it as it was draws nothing again.
  const shape = () => {
    const { width, height } = inputs.inputs().image ?? START_SIZE;
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

  // As wide as the slot, and no wider than two fifths of the window's height times the shape, so never taller than that.
  const width = `min(100%, calc(${String(PREVIEW_HEIGHT_VH)}vh * ${aspect}))`;
  return (
    <div className="preview" role="img" aria-label={PREVIEW_NAME} style={{ aspectRatio: aspect, width }}>
      <canvas ref={canvas} className="preview__canvas" />
    </div>
  );
}
