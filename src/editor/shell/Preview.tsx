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
// 2. to 4. STACK-06 (item B; the app opinion, project/digests/app-opinion.md: React "may mount the canvas host, never
//    draws"): the drawing is the canvas's owner, mountCanvas.ts, a plain TypeScript file (its points 2 to 6: the
//    drawer attached and detached, the paint and its surface, the size drawn and its watchers, the pointer's binding).
//    This screen renders the canvas and hands it there at mount, with its own menu openers and `pause`; it imports
//    nothing of the player or the renderer (the boundary rule `editor-screens-never-draw`).
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
//    unbound at unmount with the drawer, by the canvas's owner (mountCanvas.ts, since STACK-06). `paint` adds one overlay to each request, which draws nothing and keeps what the
//    frame was drawn with (the image's bounds as the frame's transform places them, each route's shape and timeline);
//    the pointer is hit-tested against that, in its CSS pixels. The pen's tap (on the up, never the down, 2.5.2) places
//    a point, joined from the selected one; each down first has the drawer draw now if the store has moved on since the
//    last frame (`drawNow`), so a quick second tap meets the point the first placed. The canvas takes no touch
//    scrolling (`touch-action: none`), so a finger draws as a mouse does. The drawer's hover (previewLogic.ts, point 4d)
//    is handed to the binding (brief 118, ruling T): a resting mouse or pen sets it, and the drawer draws the hovered
//    point's ring or the hovered stretch over its halo (D208) when that point or line is the selected route's.
// 7. CORE-06, chat G1b (brief 135; brief 130's CB and CD; D267 (a), provisional): the point's menu. The binding is
//    handed `menu`: a right-click on a point, or Shift+F10 / the ContextMenu key on the selected one (keydown.ts), opens
//    it, the point selected first (dom.ts point 9); the items are built then from the store (../canvas/menu.ts
//    `pointMenu`) and drawn by the kit's menu (../kit/ContextMenu.tsx), in a portal outside this box, named "Point
//    actions". An item chosen runs as one undo step (`runItem`); the menu closes and focus comes back to the box. Each
//    item that makes a step is said aloud by the store's hook in ../canvas/words.ts: Delete as the Delete key's is
//    (D268), the others in D269's words ("Start marked", "Point made a bend" and so on; provisional); an item that is off
//    makes no step and says nothing. The line's menu (point 9) is said the same way, in D271's words.
// 8. CORE-06, chat G2b (brief 139; brief 138's DD; D242, D250 (a), D270, provisional until the owner objects): the
//    menu's "Move" is handed to the binding (../canvas/dom.ts point 10, `startMove`), told the session's `announce` for
//    its prompt; the menu has already closed and given focus back to the box. While a wait is open (`watchMove`) the
//    canvas shows a crosshair. Focus leaving the box for anywhere outside it cancels the wait (`cancelMove`, which says
//    "Move cancelled"); the window's own blur is left to the binding, which ends it saying nothing.
// 9. CORE-06, chat G2c (brief 140, ruling EE; D271 (a), provisional until the owner answers): a line's menu. The binding
//    is also handed `lineMenu`: a right-click on a line or its "+" opens it, selecting nothing (dom.ts point 9); its
//    items are built then from the store (../canvas/menu.ts `lineMenu`: "Make line two-way" or "Make line one way",
//    then "Reverse line") and drawn by the same kit menu, named "Line actions". An item chosen runs as one undo step
//    (`runItem`), the store's hook says its words ("Line made two-way", "Line made one way", "Line reversed"), and the
//    menu closes with focus back on the box. It opens by pointer only: no key picks out a line yet.
// 10. CORE-06, close (brief 141, FD; D272 (c), provisional until the owner answers): the binding is handed `pause`, the
//    page's (App.tsx: Play or pause's toggle, heard "Animation paused"): a press or right-click on the picture while
//    the route plays pauses it and does nothing else (dom.ts point 11), and the drawer draws no hover while it plays.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cancelMove, startMove, watchMove, type LineMenuOpen, type MenuOpen, type Say } from '../canvas/dom';
import { lineMenu, pointMenu, runItem, type Menu, type MenuItem } from '../canvas/menu';
import { ContextMenu } from '../kit/ContextMenu';
import type { Store } from '../store/store';
import { mountCanvas } from './mountCanvas';
import { frameShape, type Drawer, type FrameInputs } from './previewLogic';

export interface PreviewProps {
  /** The session's one drawer. */
  readonly drawer: Pick<Drawer, 'attach' | 'detach' | 'drawNow'> & Partial<Pick<Drawer, 'hover'>>;
  /** The session's one inputs: the size is handed to it, and the box's shape read from it. */
  readonly inputs: Pick<FrameInputs, 'inputs' | 'resize'>;
  /** The store's telling of a change: an opened project, or a change of the export's size, may bring another shape. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The session's store, which the pen's taps change (point 6). */
  readonly store: Store;
  /** The session's status area, told "Move"'s prompt (point 8); silent when not given. */
  readonly announce?: Say;
  /** What pauses the play on a press on the picture while it plays (point 10); stable, as the binding is made once. */
  readonly pause?: () => void;
}

/** The canvas's spoken name (1.1.1). */
export const PREVIEW_NAME = 'Route animation preview';
/** The point's menu's name (point 7): v3's "Waypoint actions" (wiringControllers.js 788) with "point" for "waypoint"; provisional. */
const POINT_MENU_NAME = 'Point actions';
/** A line's menu's name (point 9; D271 (a), provisional). */
const LINE_MENU_NAME = 'Line actions';

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

export function Preview({ drawer, inputs, subscribe, store, announce, pause }: PreviewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // The box's shape: the video's, the scene's export width and height (point 5), as one string so a telling that leaves
  // it as it was draws nothing again.
  const shape = () => {
    const { width, height } = frameShape(inputs.inputs().scene);
    return `${String(width)} / ${String(height)}`;
  };
  const aspect = useSyncExternalStore(subscribe, shape, shape);
  // The point's menu or a line's (points 7 and 9): what it shows, its name and where, numbered so each opening draws it
  // afresh.
  const [menu, setMenu] = useState<{ readonly built: Menu; readonly label: string; readonly at: MenuOpen['at']; readonly serial: number } | null>(null);
  const openings = useRef(0);
  const choose = useCallback((item: MenuItem) => {
    if (item.move !== null && item.reason === null) startMove(item.move, announce);
    else runItem(store, item);
  }, [store, announce]);
  const close = useCallback(() => { setMenu(null); }, []);
  // "Move"'s wait (point 8): the crosshair while it is open; focus leaving the box cancels it.
  const [moving, setMoving] = useState(false);
  useEffect(() => watchMove(setMoving), []);
  useEffect(() => {
    const element = boxRef.current;
    if (!element) return undefined;
    const left = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && element.contains(next)) return;
      if (!document.hasFocus()) return;
      cancelMove();
    };
    element.addEventListener('focusout', left);
    return () => {
      element.removeEventListener('focusout', left);
    };
  }, []);

  // The canvas's owner (points 2 to 4 and 6): mountCanvas.ts draws, binds and measures; this hands it the menus' openers.
  useEffect(() => {
    const element = canvas.current;
    if (!element) return undefined;
    const openMenu = (open: MenuOpen) => {
      const built = pointMenu(store.getState(), open.route, open.point);
      if (built === null) return;
      openings.current += 1;
      setMenu({ built, label: POINT_MENU_NAME, at: open.at, serial: openings.current });
    };
    const openLineMenu = (open: LineMenuOpen) => {
      const built = lineMenu(store.getState(), open.route, open.line);
      if (built === null) return;
      openings.current += 1;
      setMenu({ built, label: LINE_MENU_NAME, at: open.at, serial: openings.current });
    };
    return mountCanvas(element, { drawer, inputs, store, menu: openMenu, lineMenu: openLineMenu, pause });
  }, [drawer, inputs, store, pause]);

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
    <>
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- D245: the owner chose `application` for this one box, a canvas the pointer draws on with one tab stop; the strict set counts that role as not interactive. */}
    <div ref={boxRef} className="preview" role="application" aria-label={PREVIEW_NAME} tabIndex={0} style={{ aspectRatio: aspect, width }}>
      <canvas ref={canvas} className="preview__canvas" style={moving ? { touchAction: 'none', cursor: 'crosshair' } : { touchAction: 'none' }} />
    </div>
    {menu && <ContextMenu key={menu.serial} label={menu.label} items={menu.built.items} at={menu.at} opener={boxRef} onChoose={choose} onClose={close} />}
    </>
  );
}
