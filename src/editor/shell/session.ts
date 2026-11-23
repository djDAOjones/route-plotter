// CORE-05, stage 5: the page's one editor session, made once, the first time the page asks for it. A page file: it
// names the browser's globals (the frame clock, the timer, the id source), so no Node test imports it; what it puts
// together is proved in Node piece by piece (the store, both transports, the announcement queue, the key dispatch).
//
// - The store holds an empty project, as a test makes one.
// - The player's transport keeps its playback in the store and books frames with `requestAnimationFrame`, only while
//   the store's playback plays (its claim's point 1): a still page asks for no frame.
// - The announcement queue writes the live region the page draws, through `holdRegion` (React's ref for it), with the
//   browser's timer. Until the region is drawn a message is dropped; the page draws it before any key can reach it.
// - The editor's transport speaks through the queue. It is handed `canPlay`, `hasSomethingToPlay` on the store's scene
//   as it is at each ask, and the same function is the session's `canPlay`, which the Play button asks (one rule);
//   the player's transport is handed `ended`, the saying of "Animation complete" (WORDS.complete)
//   through the same queue when a playing stops on an end by itself.
// - The timeline (timelineLogic.ts): its length reader reads the player's `length()` at most once a frame, booking that frame
//   with the same frame source; its `Setting` scrubs through the editor's transport. Made once, here, so the page has
//   one reader of the length (DEF-42.1's reader's half).
// - The switch for single-key shortcuts (D183) is held here for the visit, on to begin with: the listener reads it at
//   each key, Help shows and sets it. It is not stored (CORE-09's), not a scene setting, and makes no undo step.
// - Stage 6: the opener (openLogic.ts), made once beside the transports from the session's own store, the queue's
//   `announce` and the browser's decoder (decode.ts): Open's button and notice are drawn from it. The player's
//   transport reads what the length is made from through the preview's inputs (previewLogic.ts): the store's scene,
//   the seed, the size and the background's size from its header, so an opened project is measured by its picture
//   from the open's own telling, not as a square.
import { newScene } from '../../core/model/scene';
import { createTransport, type FrameSource } from '../../player/transport/transport';
import { createAnnouncementQueue, type Priority } from '../kit/announce';
import { createStore, type Store } from '../store/store';
import { createEditorTransport, hasSomethingToPlay, WORDS, type EditorTransport } from '../transport/transport';
import { decode } from './decode';
import { holdForVisit, type Held } from './held';
import { createOpener, type Opener } from './openLogic';
import { createFrameInputs } from './previewLogic';
import { createLengthReader, createTimeline, type Timeline } from './timelineLogic';

export interface PageSession {
  readonly store: Store;
  readonly transport: EditorTransport;
  /** Whether the scene has anything to play now: the one rule the editor's transport and the Play button ask. */
  readonly canPlay: () => boolean;
  /** The play bar's timeline: its `Setting` and its words, over the page's one reader of the length. */
  readonly timeline: Timeline;
  /** Whether single-key shortcuts are on (D183). */
  readonly singleKeys: Held<boolean>;
  /** Open's opener: a project file's bytes into the store (stage 6). */
  readonly opener: Opener;
}

/** The live region the page draws now, or null before it is drawn and after it is gone. */
let region: HTMLElement | null = null;

/** React's ref for the live region: the queue writes to whichever element holds it now. */
export function holdRegion(element: HTMLElement | null): void {
  region = element;
}

/** The region as the queue sees it: setting `aria-live` and the words on the element the page holds now. */
const regionNow = {
  setAttribute(name: 'aria-live', value: Priority): void {
    region?.setAttribute(name, value);
  },
  get textContent(): string | null {
    return region?.textContent ?? null;
  },
  set textContent(words: string | null) {
    if (region !== null) region.textContent = words;
  },
};

const frames: FrameSource<number> = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => {
    cancelAnimationFrame(handle);
  },
};

function make(): PageSession {
  const nextId = () => crypto.randomUUID();
  const store = createStore({ project: { scene: newScene(nextId), images: [] }, nextId });
  const { announce } = createAnnouncementQueue(regionNow, (callback, ms) => setTimeout(callback, ms));
  const player = createTransport({
    frames,
    holder: store,
    inputs: createFrameInputs({ store }).inputs,
    report: (error) => {
      reportError(error);
    },
    ended: () => {
      announce(WORDS.complete);
    },
  });
  const canPlay = () => hasSomethingToPlay(store.getState().project.scene);
  const transport = createEditorTransport({
    transport: player,
    playback: () => store.playback(),
    announce,
    canPlay,
  });
  const length = createLengthReader({ store, length: () => player.length(), frames });
  const timeline = createTimeline({ store, transport, length });
  const opener = createOpener({ store, announce, decode });
  return Object.freeze({ store, transport, canPlay, timeline, singleKeys: holdForVisit(true), opener });
}

let made: PageSession | null = null;

/** The page's one session: made on the first call, the same one after (React's strict mode mounts twice). */
export function pageSession(): PageSession {
  made ??= make();
  return made;
}
