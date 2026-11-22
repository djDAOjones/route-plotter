// V31-APP-PACK starter, editor, emptied by STACK-02: Carbon React renders one blank page and nothing else. The
// starter's canvas host, frame loop and shortcut dispatcher are left out: a still page queues no animation frame, and a
// control that does nothing is not shown. CORE-05 builds the editor shell here; nothing in it draws or saves yet.
// Stage 5: the page's one session, one keydown listener for the editor's keys, the live region the session's
// announcements are written to (visually hidden, empty at rest), and Help: its button, always on the page after the
// paragraph (a plain Carbon button until the frame's header comes), and its dialog, opened also by `?`. Then the play
// bar (PlayBar): "Skip to start", "Play" or "Pause" and "Skip to end", each calling the session's editor's transport
// as its key does, and the line saying why Play is off while there is nothing to play (on this page, always: the
// scene is empty until stage 6 brings Open). In the bar's group, after the buttons, the timeline (Timeline): a slider
// over the position, reading the time now of the whole time; an empty scene is 2 s long (Hold at end's), so it moves.
import { Button, Content, Heading, Link } from '@carbon/react';
import { useEffect, useRef, useState } from 'react';
import { Help } from './shell/Help';
import { listenForKeys, MAC } from './shell/keydown';
import { PlayBar } from './shell/PlayBar';
import { holdRegion, pageSession } from './shell/session';
import { Timeline } from './shell/Timeline';

/** The store's telling of a change, and whether it plays now: one function each for the page's life, so a draw of
 *  App does not make the play bar subscribe anew. (The bar holds two subscriptions, one per hook.) */
const toldOfChange = (listener: () => void) => pageSession().store.subscribe(listener);
const playsNow = () => pageSession().store.playback().playing;

export function App() {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButton = useRef<HTMLButtonElement>(null);
  useEffect(
    () =>
      listenForKeys(pageSession(), () => {
        setHelpOpen(true);
      }),
    [],
  );
  return (
    <Content>
      <Heading>Route Plotter</Heading>
      <p>
        Version 4 is being built here. It cannot make anything yet. Its progress is on{' '}
        <Link inline href="https://github.com/djDAOjones/route-plotter">GitHub</Link>.
      </p>
      <Button
        id="help"
        ref={helpButton}
        onClick={() => {
          setHelpOpen(true);
        }}
      >
        Help
      </Button>
      <PlayBar
        transport={pageSession().transport}
        subscribe={toldOfChange}
        playing={playsNow}
        canPlay={pageSession().canPlay}
      >
        <Timeline timeline={pageSession().timeline} />
      </PlayBar>
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
    </Content>
  );
}
