// STACK-06 (item B; brief 148): the preview's canvas and its one owner. Plain TypeScript, so React never draws: the
// preview's screen (Preview.tsx) renders the box and the canvas element and hands it here at mount; this file holds
// the 2D context, the composer and everything that draws, binds or measures, and gives back what lets it all go.
// Moved whole from Preview.tsx's effect (its points 2 to 4 and 6), with nothing it does changed.
// Its claim:
// 1. The app opinion's editor rule (project/digests/app-opinion.md): React "may mount the canvas host, never draws";
//    "one owner per DOM subtree". This is the canvas's owner: the only editor file that imports the composer, and the
//    boundary rule `editor-screens-never-draw` (.dependency-cruiser.cjs) keeps every editor React file from importing
//    it, the player's transport or the renderer's kit itself.
// 2. At mount it attaches the session's drawer to the canvas (`attach({ paint, surface })`); its teardown detaches.
//    React's strict mode mounts twice: `attach` lets an earlier target go.
// 3. `paint` (previewLogic.ts's `recordingPaint`, its point 7, since brief 115) sets the canvas's `width` and
//    `height` to the request's size when they differ, then composes the request on the canvas's context in the same
//    call, so a resize never shows a blank frame; it gives back the composer's reports. It sets no transform and no
//    style of its own (the composer resets and clears first, CORE-04.6). `surface` is an OffscreenCanvas the size
//    asked, its context and itself, as the composer's `Surface`.
// 4. The size drawn is the canvas's box in CSS pixels times the device's pixel ratio (`canvasSize`, held to 3), handed
//    to the session's inputs (`resize`): a ResizeObserver hears the box, and a `matchMedia` on the resolution now hears
//    a change of the pixel ratio alone (a browser zoom, a move to another screen), armed again at each change.
// 5. The pointer (src/editor/canvas/dom.ts, `bindCanvas`, Preview.tsx's point 6) is bound at mount with the drawer:
//    the last frame's geometry from the paint, `drawNow` as its refresh, the drawer's hover, the two menu openers and
//    `pause` that the screen hands in (they set the screen's own state), and the machine's `MAC`.
// 6. The teardown runs in the order the effect's did: the pointer unbound, the pixel ratio's listener off, the
//    observer disconnected, the drawer detached. With no 2D context it does nothing and gives back a teardown that
//    does nothing, as the effect returned early.
// Its proof is the page's: Node has no canvas, ResizeObserver or matchMedia, and no package is added for one, so the
// drawing journeys (tests/a11y: the-preview-draws, the-preview-shows-the-picture, pen-drawn, point-menu, line-menu,
// point-move, group-drag, open-over-changes) hold it, unchanged by the move.
import { compose, type Surface } from '../../player/compose';
import { bindCanvas, type LineMenuOpen, type MenuOpen } from '../canvas/dom';
import type { Store } from '../store/store';
import { MAC } from './keydown';
import { canvasSize, recordingPaint, type Drawer, type FrameInputs } from './previewLogic';

/** What the screen hands the canvas's owner: the session's parts, and its own openers for the menus. */
export interface CanvasHost {
  /** The session's one drawer. */
  readonly drawer: Pick<Drawer, 'attach' | 'detach' | 'drawNow'> & Partial<Pick<Drawer, 'hover'>>;
  /** The session's one inputs: the size is handed to it (point 4). */
  readonly inputs: Pick<FrameInputs, 'resize'>;
  /** The session's store, which the pen's taps change. */
  readonly store: Store;
  /** Opens the point's menu (the screen's state). */
  readonly menu: (open: MenuOpen) => void;
  /** Opens a line's menu (the screen's state). */
  readonly lineMenu: (open: LineMenuOpen) => void;
  /** What pauses the play on a press on the picture while it plays. */
  readonly pause?: (() => void) | undefined;
}

const surface = (size: { width: number; height: number }): Surface => {
  const image = new OffscreenCanvas(size.width, size.height);
  const context = image.getContext('2d');
  if (context === null) throw new Error('an offscreen canvas gave no 2D context');
  return { context, image };
};

/** Takes the canvas: draws on it, binds the pointer to it and measures it; gives back what lets it all go (point 6). */
export function mountCanvas(element: HTMLCanvasElement, { drawer, inputs, store, menu, lineMenu, pause }: CanvasHost): () => void {
  const context = element.getContext('2d');
  if (!context) return () => undefined;
  // The paint (point 3) and what the last frame was drawn with: previewLogic.ts's `recordingPaint`, whose geometry is
  // unknown until a paint's record overlay runs (brief 115, ruling V).
  const painting = recordingPaint(element, (request) => compose(context, request));
  drawer.attach({ paint: painting.paint, surface });
  const unbind = bindCanvas({ canvas: element, win: window, store, geometry: painting.geometry, refresh: () => drawer.drawNow(), mac: MAC, hover: drawer.hover, menu, lineMenu, ...(pause === undefined ? {} : { pause }) });

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
}
