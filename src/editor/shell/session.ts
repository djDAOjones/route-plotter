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
// - The switch for single-key shortcuts (D183) is held here for the visit, on to begin with: the listener reads it at
//   each key, Help shows and sets it. It is not stored (CORE-09's), not a scene setting, and makes no undo step.
import { newScene } from '../../core/model/scene';
import { createTransport, type FrameSource } from '../../player/transport/transport';
import { createAnnouncementQueue, type Priority } from '../kit/announce';
import { createStore, type Store } from '../store/store';
import { createEditorTransport, hasSomethingToPlay, WORDS, type EditorTransport } from '../transport/transport';
import { holdForVisit, type Held } from './held';

export interface PageSession {
  readonly store: Store;
  readonly transport: EditorTransport;
  /** Whether the scene has anything to play now: the one rule the editor's transport and the Play button ask. */
  readonly canPlay: () => boolean;
  /** Whether single-key shortcuts are on (D183). */
  readonly singleKeys: Held<boolean>;
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
    // The seed and size are placeholders until the preview draws: an empty scene's length needs neither.
    inputs: () => ({ scene: store.getState().project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
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
  return Object.freeze({ store, transport, canPlay, singleKeys: holdForVisit(true) });
}

let made: PageSession | null = null;

/** The page's one session: made on the first call, the same one after (React's strict mode mounts twice). */
export function pageSession(): PageSession {
  made ??= make();
  return made;
}
