// V31-APP-PACK starter, editor, emptied by STACK-02: Carbon React renders one blank page and nothing else. The
// starter's canvas host, frame loop and shortcut dispatcher are left out: a still page queues no animation frame, and a
// control that does nothing is not shown. CORE-05 builds the editor shell here; nothing in it draws or saves yet.
// Stage 5: the page's one session, one keydown listener for the editor's keys, the live region the session's
// announcements are written to (visually hidden, empty at rest), and Help: its button, in the frame's header, and its
// dialog, opened also by `?`. Then the play bar (PlayBar): "Skip to start", "Play" or "Pause" and "Skip to end", each
// calling the session's editor's transport as its key does, and the line saying why Play is off while there is nothing
// to play (until a project is opened: the page starts on an empty scene). In the bar's group, after the buttons, the timeline (Timeline): a slider
// over the position, reading the time now of the whole time; an empty scene is 2 s long (Hold at end's), so it moves.
// All of it is drawn through the frame (Frame): its header holds the page's name and Help; its slots, the preview and
// the play bar today. App is the wiring.
// Stage 6: "Open project" (OpenButton) in the frame's header before Help, and its notice (OpenNotice: the busy line, or
// a refusal's alert) first in main, both drawn from the session's one opener. When the refusal's Close is pressed, focus
// goes to "Open project" (the notice is gone, and focus must not fall to the page's body), as Help returns focus to its
// opener.
// Cmd or Ctrl+O (D207) presses "Open project" itself, so the key and the button open the one chooser and cannot differ.
// Stage 6, the preview (brief 84): the canvas (Preview) in the frame's `preview` slot, on the session's one inputs and
// drawer.
// CORE-06 (D209, the owner's "Remove and enlarge"): the paragraph that stood above the preview ("Version 4 is being
// built here", with its link to GitHub) is gone, nothing in its place, and the preview takes the height left.
import { Button } from '@carbon/react';
import { useEffect, useRef, useState } from 'react';
import { Frame } from './shell/Frame';
import { Help } from './shell/Help';
import { listenForKeys, MAC } from './shell/keydown';
import { OpenButton, OpenNotice, type OpenProps } from './shell/Open';
import { PlayBar } from './shell/PlayBar';
import { Preview } from './shell/Preview';
import { holdRegion, pageSession } from './shell/session';
import { Timeline } from './shell/Timeline';

/** The store's telling of a change, and whether it plays now: one function each for the page's life, so a draw of
 *  App does not make the play bar subscribe anew. (The bar holds two subscriptions, one per hook.) */
const toldOfChange = (listener: () => void) => pageSession().store.subscribe(listener);
const playsNow = () => pageSession().store.playback().playing;
/**
 * The preview's pause (brief 141, FD; D272 (c), answered by the owner, 2026-11-27): Play or pause's own toggle, so the
 * press is heard as
 * "Animation paused" as Space and the Pause button are. The canvas calls it only while the store plays (dom.ts point 11).
 */
const pausePlay = (): void => {
  pageSession().transport.playPause();
};

/** The notice's opener: the session's, but Close also puts focus on "Open project" before the notice goes. */
const noticeOpener: OpenProps['opener'] = {
  read: () => pageSession().opener.read(),
  subscribe: (listener) => pageSession().opener.subscribe(listener),
  openFile: (file) => pageSession().opener.openFile(file),
  dismiss: () => {
    document.getElementById('open-project')?.focus();
    pageSession().opener.dismiss();
  },
};

export function App() {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButton = useRef<HTMLButtonElement>(null);
  useEffect(
    () =>
      listenForKeys(
        pageSession(),
        () => {
          setHelpOpen(true);
        },
        () => {
          document.getElementById('open-project')?.click();
        },
      ),
    [],
  );
  return (
    <Frame
      open={<OpenButton opener={pageSession().opener} />}
      notice={<OpenNotice opener={noticeOpener} />}
      help={
        <Button
          id="help"
          ref={helpButton}
          onClick={() => {
            setHelpOpen(true);
          }}
        >
          Help
        </Button>
      }
      preview={<Preview drawer={pageSession().preview.drawer} inputs={pageSession().preview.inputs} subscribe={toldOfChange} store={pageSession().store} announce={pageSession().announce} pause={pausePlay} />}
      transport={
        <PlayBar
          transport={pageSession().transport}
          subscribe={toldOfChange}
          playing={playsNow}
          canPlay={pageSession().canPlay}
        >
          <Timeline timeline={pageSession().timeline} />
        </PlayBar>
      }
    >
      <div role="status" aria-live="polite" className="cds--visually-hidden" ref={holdRegion} />
      <Help
        opener={helpButton}
        open={helpOpen}
        onClose={() => {
          setHelpOpen(false);
        }}
        mac={MAC}
        singleKeys={pageSession().singleKeys}
      />
    </Frame>
  );
}
