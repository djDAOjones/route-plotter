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
//   `announce` and the browser's decoder (decode.ts): Open's button and notice are drawn from it. Since brief 145 (D276 (a),
//   kept as built: the parent chat's reading of the owner's answer of 2026-11-27, which stands unless he objects) it
//   carries the page's one `question` (ReplaceQuestion.tsx), handed to it as `confirmReplace`, so a
//   chosen project asks before it replaces a changed route; "Open project" draws that question. The player's
//   transport reads what the length is made from through the preview's inputs (previewLogic.ts): the store's scene,
//   the seed, the size and the background's size from its header, so an opened project is measured by its picture
//   from the open's own telling, not as a square.
// - Stage 6, the preview (brief 84): the inputs are made once and kept, and the same holder's `inputs` is handed to
//   the player's transport and to the drawer (one source, D174); the background's pictures, loaded by the browser's
//   decoder (loadPicture.ts) and never closed, as the session lives as long as the page; and the drawer, on the
//   session's own frame source. A paint that throws, a picture that cannot be loaded and a frame's reports when they
//   change go to the page's `reportError`; nothing is shown on the page for them (a later item's).
// - CORE-06 (brief 134, ruling CU; D263, the owner's "Yes, every edit", in D268's words): the queue is made before the
//   store, and the store's `stepped` hook says each step's words (../canvas/words.ts `stepWords`: an edit's line, "Undo",
//   "Redo") through it, a silent step's null left out before the queue. The session hands `announce` on, so select
//   all's line goes the same way (keydown.ts). The point's menu says nothing yet (D268: its own chat names its words).
import { newScene } from '../../core/model/scene';
import { createTransport, type FrameSource } from '../../player/transport/transport';
import { stepWords } from '../canvas/words';
import { createAnnouncementQueue, type Announce, type Priority } from '../kit/announce';
import { createStore, type Store } from '../store/store';
import { createEditorTransport, hasSomethingToPlay, WORDS, type EditorTransport } from '../transport/transport';
import { decode } from './decode';
import { holdForVisit, type Held } from './held';
import { createOpener, type Opener } from './openLogic';
import { createReplaceAsker, type ReplaceAsker } from './ReplaceQuestion';
import { loadPicture } from './loadPicture';
import { createDrawer, createFrameInputs, createPictures, type Drawer, type FrameInputs } from './previewLogic';
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
  readonly opener: Opener & { readonly question: ReplaceAsker };
  /** What the preview's canvas needs: the one inputs (its size, and the scene whose export gives its shape) and the one
   *  drawer (brief 84). */
  readonly preview: { readonly inputs: FrameInputs; readonly drawer: Drawer };
  /** The page's one status area's writer, for a line no step says: select all's (D268). */
  readonly announce: Announce;
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
  const { announce } = createAnnouncementQueue(regionNow, (callback, ms) => setTimeout(callback, ms));
  const store = createStore({
    project: { scene: newScene(nextId), images: [] },
    nextId,
    stepped: (step) => {
      const words = stepWords(step);
      if (words !== null) announce(words);
    },
  });
  const inputs = createFrameInputs({ store });
  const player = createTransport({
    frames,
    holder: store,
    inputs: inputs.inputs,
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
    frameRate: () => store.getState().project.scene.settings.export.frameRate,
  });
  const length = createLengthReader({ store, length: () => player.length(), frames });
  const question = createReplaceAsker();
  const opener = Object.freeze({ ...createOpener({ store, announce, player, decode, confirmReplace: question.ask }), question });
  const timeline = createTimeline({ store, transport, length, opened: () => opener.opened() });
  const pictures = createPictures({ store, load: loadPicture, report: (error) => { reportError(error); } });
  const drawer = createDrawer({
    store,
    inputs,
    pictures,
    frames,
    report: (error) => {
      reportError(error);
    },
    failed: (reports) => {
      if (reports.length === 0) return;
      const said = reports.map(({ routeId, featureId, reason }) => `${featureId}${routeId === null ? '' : ` (route ${routeId})`}: ${reason}`);
      reportError(new Error(`The preview could not draw: ${said.join('; ')}`));
    },
  });
  const preview = Object.freeze({ inputs, drawer });
  return Object.freeze({ store, transport, canPlay, timeline, singleKeys: holdForVisit(true), opener, preview, announce });
}

let made: PageSession | null = null;

/** The page's one session: made on the first call, the same one after (React's strict mode mounts twice). */
export function pageSession(): PageSession {
  made ??= make();
  return made;
}
